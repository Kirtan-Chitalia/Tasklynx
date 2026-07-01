-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- triggers.sql — Database Triggers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- UTILITY: Generic updated_at trigger function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at to all mutable tables
CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_user_capacity_updated_at
    BEFORE UPDATE ON user_capacity
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_epics_updated_at
    BEFORE UPDATE ON epics
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_stories_updated_at
    BEFORE UPDATE ON stories
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_sprints_updated_at
    BEFORE UPDATE ON sprints
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_agent_configs_updated_at
    BEFORE UPDATE ON agent_configs
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_agent_memory_updated_at
    BEFORE UPDATE ON agent_memory
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_security_policies_updated_at
    BEFORE UPDATE ON security_policies
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- -----------------------------------------------------------------------------
-- TASKS: Auto-assign project-scoped sequence number
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS task_seq;

CREATE OR REPLACE FUNCTION fn_assign_task_sequence()
RETURNS TRIGGER AS $$
DECLARE
    v_seq BIGINT;
BEGIN
    SELECT COALESCE(MAX(sequence_num), 0) + 1
    INTO v_seq
    FROM tasks
    WHERE project_id = NEW.project_id;

    NEW.sequence_num = v_seq;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_sequence
    BEFORE INSERT ON tasks
    FOR EACH ROW
    WHEN (NEW.sequence_num IS NULL)
    EXECUTE FUNCTION fn_assign_task_sequence();

-- -----------------------------------------------------------------------------
-- TASKS: Stamp started_at and completed_at on status transitions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_task_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'in_progress' AND OLD.status = 'todo' AND NEW.started_at IS NULL THEN
        NEW.started_at = NOW();
    END IF;

    IF NEW.status IN ('done','cancelled') AND NEW.completed_at IS NULL THEN
        NEW.completed_at = NOW();
    END IF;

    IF NEW.status NOT IN ('done','cancelled') THEN
        NEW.completed_at = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_status_timestamps
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_task_status_timestamps();

-- -----------------------------------------------------------------------------
-- SPRINTS: Update committed_points when sprint_tasks change
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_sprint_points()
RETURNS TRIGGER AS $$
DECLARE
    v_sprint_id UUID;
BEGIN
    v_sprint_id = COALESCE(NEW.sprint_id, OLD.sprint_id);

    UPDATE sprints
    SET committed_points = (
        SELECT COALESCE(SUM(t.story_points), 0)
        FROM sprint_tasks st
        JOIN tasks t ON t.id = st.task_id
        WHERE st.sprint_id = v_sprint_id
          AND t.story_points IS NOT NULL
    )
    WHERE id = v_sprint_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sprint_tasks_points
    AFTER INSERT OR DELETE ON sprint_tasks
    FOR EACH ROW EXECUTE FUNCTION fn_update_sprint_points();

-- -----------------------------------------------------------------------------
-- TASKS: Update sprint completed_points when task status changes to done
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_sprint_completed_points()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'done' AND OLD.status != 'done' THEN
        UPDATE sprints s
        SET completed_points = (
            SELECT COALESCE(SUM(t.story_points), 0)
            FROM sprint_tasks st
            JOIN tasks t ON t.id = st.task_id
            WHERE st.sprint_id = s.id
              AND t.status = 'done'
              AND t.story_points IS NOT NULL
        )
        FROM sprint_tasks st
        WHERE st.task_id = NEW.id
          AND st.sprint_id = s.id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_sprint_completed
    AFTER UPDATE ON tasks
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_update_sprint_completed_points();

-- -----------------------------------------------------------------------------
-- EPICS: Sync completed_points from stories
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_epic_points()
RETURNS TRIGGER AS $$
DECLARE
    v_epic_id UUID;
BEGIN
    v_epic_id = COALESCE(NEW.epic_id, OLD.epic_id);
    IF v_epic_id IS NULL THEN RETURN NULL; END IF;

    UPDATE epics
    SET completed_points = (
        SELECT COALESCE(SUM(story_points), 0)
        FROM stories
        WHERE epic_id = v_epic_id
          AND status = 'done'
          AND story_points IS NOT NULL
    )
    WHERE id = v_epic_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stories_epic_points
    AFTER INSERT OR UPDATE OR DELETE ON stories
    FOR EACH ROW EXECUTE FUNCTION fn_sync_epic_points();

-- -----------------------------------------------------------------------------
-- DOCUMENT VERSIONING: Auto-increment version and snapshot on update
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_document_version_snapshot()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        INSERT INTO document_versions (document_id, version, content, changed_by, is_ai_edit)
        VALUES (OLD.id, OLD.version, OLD.content, NEW.created_by, FALSE);
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_versioning
    BEFORE UPDATE ON documents
    FOR EACH ROW
    WHEN (OLD.content IS DISTINCT FROM NEW.content)
    EXECUTE FUNCTION fn_document_version_snapshot();

-- -----------------------------------------------------------------------------
-- AGENT RUNS: Auto-publish notification on HITL required
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_agent_run_hitl_notify()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'awaiting_hitl' AND OLD.status != 'awaiting_hitl' THEN
        INSERT INTO notifications (
            org_id, recipient_id, agent_run_id,
            notif_type, channel, title, body,
            entity_type, entity_id
        )
        SELECT
            NEW.org_id,
            h.requested_for,
            NEW.id,
            'hitl_required',
            'in_app',
            'Action requires your approval',
            h.action_description,
            'hitl_approval',
            h.id
        FROM hitl_approvals h
        WHERE h.agent_run_id = NEW.id
          AND h.status = 'pending'
          AND h.requested_for IS NOT NULL;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_runs_hitl_notify
    AFTER UPDATE ON agent_runs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_agent_run_hitl_notify();

-- -----------------------------------------------------------------------------
-- AUDIT: Immutable append-only enforcement on audit_logs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only; UPDATE and DELETE are not permitted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_mutation();

-- -----------------------------------------------------------------------------
-- ORG BILLING: Sync seats_used when users are activated/deactivated
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_org_seats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE org_billing
    SET seats_used = (
        SELECT COUNT(*) FROM users
        WHERE org_id = NEW.org_id AND status = 'active'
    )
    WHERE org_id = NEW.org_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_seat_sync
    AFTER INSERT OR UPDATE OF status ON users
    FOR EACH ROW EXECUTE FUNCTION fn_sync_org_seats();

-- -----------------------------------------------------------------------------
-- EPIC SCOPE: Snapshot scope history daily (called by scheduled agent)
-- This function is CALLED explicitly; not a row trigger.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_snapshot_epic_scope(p_project_id UUID DEFAULT NULL)
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
BEGIN
    INSERT INTO epic_scope_history (epic_id, snapshot_date, story_count, total_points, scope_delta_pct)
    SELECT
        e.id,
        CURRENT_DATE,
        COUNT(s.id),
        COALESCE(SUM(s.story_points), 0),
        CASE
            WHEN e.baseline_scope IS NOT NULL AND (e.baseline_scope->>'total_points')::NUMERIC > 0 THEN
                ROUND(
                    (COALESCE(SUM(s.story_points), 0) - (e.baseline_scope->>'total_points')::NUMERIC)
                    / (e.baseline_scope->>'total_points')::NUMERIC * 100, 4
                )
            ELSE NULL
        END
    FROM epics e
    LEFT JOIN stories s ON s.epic_id = e.id AND s.status != 'cancelled'
    WHERE (p_project_id IS NULL OR e.project_id = p_project_id)
    GROUP BY e.id, e.baseline_scope
    ON CONFLICT (epic_id, snapshot_date) DO UPDATE
        SET story_count = EXCLUDED.story_count,
            total_points = EXCLUDED.total_points,
            scope_delta_pct = EXCLUDED.scope_delta_pct;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- VELOCITY: Record velocity after sprint completes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_record_sprint_velocity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        INSERT INTO sprint_velocity_history (
            project_id, team_id, sprint_id,
            completed_points, committed_points, completion_rate,
            period_start, period_end
        )
        VALUES (
            NEW.project_id,
            NEW.team_id,
            NEW.id,
            NEW.completed_points,
            GREATEST(NEW.committed_points, 1),
            ROUND(NEW.completed_points::NUMERIC / GREATEST(NEW.committed_points, 1), 4),
            NEW.start_date,
            NEW.end_date
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sprint_velocity_record
    AFTER UPDATE ON sprints
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_record_sprint_velocity();

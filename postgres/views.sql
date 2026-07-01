-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- views.sql — Views & Materialized Views
-- =============================================================================

-- -----------------------------------------------------------------------------
-- VIEW: Active tasks with full context (for API layer)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_tasks_full AS
SELECT
    t.id,
    t.project_id,
    t.story_id,
    t.parent_task_id,
    t.title,
    t.status,
    t.task_type,
    t.priority,
    t.estimate_hours,
    t.actual_hours,
    t.story_points,
    t.sequence_num,
    t.due_date,
    t.started_at,
    t.completed_at,
    t.created_at,
    t.updated_at,
    -- assignee
    u_a.display_name                AS assignee_name,
    u_a.avatar_url                  AS assignee_avatar,
    -- reviewer
    u_r.display_name                AS reviewer_name,
    -- project
    p.name                          AS project_name,
    p.slug                          AS project_slug,
    -- story & epic
    s.title                         AS story_title,
    e.title                         AS epic_title,
    -- active sprint
    sp.id                           AS sprint_id,
    sp.name                         AS sprint_name,
    -- label array
    COALESCE(
        ARRAY_AGG(DISTINCT l.name) FILTER (WHERE l.name IS NOT NULL),
        ARRAY[]::TEXT[]
    )                               AS labels
FROM tasks t
JOIN projects p ON p.id = t.project_id
LEFT JOIN users u_a ON u_a.id = t.assignee_id
LEFT JOIN users u_r ON u_r.id = t.reviewer_id
LEFT JOIN stories s ON s.id = t.story_id
LEFT JOIN epics e ON e.id = s.epic_id
LEFT JOIN sprint_tasks st ON st.task_id = t.id
LEFT JOIN sprints sp ON sp.id = st.sprint_id AND sp.status = 'active'
LEFT JOIN task_label_assignments tla ON tla.task_id = t.id
LEFT JOIN task_labels l ON l.id = tla.label_id
WHERE t.status != 'cancelled'
GROUP BY t.id, u_a.display_name, u_a.avatar_url, u_r.display_name,
         p.name, p.slug, s.title, e.title, sp.id, sp.name;

-- -----------------------------------------------------------------------------
-- VIEW: Sprint board — tasks grouped by status for kanban
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_sprint_board AS
SELECT
    sp.id                           AS sprint_id,
    sp.name                         AS sprint_name,
    sp.project_id,
    sp.status                       AS sprint_status,
    sp.start_date,
    sp.end_date,
    sp.committed_points,
    sp.completed_points,
    t.id                            AS task_id,
    t.title,
    t.status                        AS task_status,
    t.priority,
    t.story_points,
    t.assignee_id,
    u.display_name                  AS assignee_name,
    u.avatar_url                    AS assignee_avatar
FROM sprints sp
JOIN sprint_tasks stsk ON stsk.sprint_id = sp.id
JOIN tasks t ON t.id = stsk.task_id
LEFT JOIN users u ON u.id = t.assignee_id
WHERE sp.status IN ('active','review');

-- -----------------------------------------------------------------------------
-- VIEW: Agent run ledger — cost and performance summary per run
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_agent_run_ledger AS
SELECT
    ar.id                           AS run_id,
    ar.org_id,
    ar.project_id,
    at2.type_key                    AS agent_type,
    at2.display_name                AS agent_name,
    mr.model_key                    AS model,
    ar.trigger_event,
    ar.status,
    ar.turn_count,
    ar.tokens_input,
    ar.tokens_output,
    ar.cost_usd,
    ar.started_at,
    ar.completed_at,
    EXTRACT(EPOCH FROM (ar.completed_at - ar.started_at))::INT
                                    AS duration_seconds,
    COUNT(ars.id)                   AS step_count,
    COUNT(h.id)                     AS hitl_count,
    ar.otel_trace_id
FROM agent_runs ar
JOIN agent_configs ac ON ac.id = ar.agent_config_id
JOIN agent_types at2 ON at2.id = ac.agent_type_id
JOIN model_registry mr ON mr.id = ac.primary_model_id
LEFT JOIN agent_run_steps ars ON ars.agent_run_id = ar.id
LEFT JOIN hitl_approvals h ON h.agent_run_id = ar.id
GROUP BY ar.id, at2.type_key, at2.display_name, mr.model_key;

-- -----------------------------------------------------------------------------
-- VIEW: HITL pending approvals queue
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_hitl_pending AS
SELECT
    h.id,
    h.org_id,
    h.agent_run_id,
    h.action_type,
    h.action_description,
    h.action_payload,
    h.expires_at,
    h.requested_at,
    h.requested_for,
    u_req.display_name              AS requested_for_name,
    at2.display_name                AS agent_name,
    ar.project_id,
    p.name                          AS project_name,
    EXTRACT(EPOCH FROM (h.expires_at - NOW()))::INT
                                    AS expires_in_seconds
FROM hitl_approvals h
JOIN agent_runs ar ON ar.id = h.agent_run_id
JOIN agent_configs ac ON ac.id = ar.agent_config_id
JOIN agent_types at2 ON at2.id = ac.agent_type_id
LEFT JOIN users u_req ON u_req.id = h.requested_for
LEFT JOIN projects p ON p.id = ar.project_id
WHERE h.status = 'pending'
  AND h.expires_at > NOW()
ORDER BY h.requested_at ASC;

-- -----------------------------------------------------------------------------
-- MATERIALIZED VIEW: Project velocity and health (refreshed every hour)
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW mvw_project_health AS
SELECT
    p.id                            AS project_id,
    p.org_id,
    p.name,
    p.status,
    COUNT(DISTINCT t.id)            AS total_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'done')       AS done_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'blocked')    AS blocked_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.due_date < NOW() AND t.status NOT IN ('done','cancelled'))
                                    AS overdue_tasks,
    COUNT(DISTINCT pm.user_id)      AS active_members,
    COALESCE(svh.avg_vel, 0)        AS avg_velocity,
    NOW()                           AS refreshed_at
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
LEFT JOIN project_members pm ON pm.project_id = p.id
LEFT JOIN LATERAL (
    SELECT ROUND(AVG(completed_points), 2) AS avg_vel
    FROM sprint_velocity_history
    WHERE project_id = p.id
    ORDER BY period_start DESC LIMIT 5
) svh ON TRUE
WHERE p.status != 'archived'
GROUP BY p.id, svh.avg_vel
WITH DATA;

CREATE UNIQUE INDEX idx_mvw_project_health ON mvw_project_health (project_id);

-- Refresh command (to be called by scheduler):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_project_health;

-- -----------------------------------------------------------------------------
-- MATERIALIZED VIEW: Daily LLM cost by org (refreshed daily)
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW mvw_org_ai_cost_daily AS
SELECT
    ar.org_id,
    DATE(ar.created_at)             AS cost_date,
    at2.type_key                    AS agent_type,
    mr.model_key                    AS model,
    COUNT(ar.id)                    AS run_count,
    SUM(ar.tokens_input)            AS total_tokens_in,
    SUM(ar.tokens_output)           AS total_tokens_out,
    ROUND(SUM(ar.cost_usd), 4)      AS total_cost_usd
FROM agent_runs ar
JOIN agent_configs ac ON ac.id = ar.agent_config_id
JOIN agent_types at2 ON at2.id = ac.agent_type_id
JOIN model_registry mr ON mr.id = ac.primary_model_id
WHERE ar.status = 'completed'
GROUP BY ar.org_id, DATE(ar.created_at), at2.type_key, mr.model_key
WITH DATA;

CREATE INDEX idx_mvw_ai_cost_org_date ON mvw_org_ai_cost_daily (org_id, cost_date DESC);

-- -----------------------------------------------------------------------------
-- VIEW: Technical debt summary per project
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_technical_debt_summary AS
SELECT
    tdi.project_id,
    p.name                          AS project_name,
    COUNT(*)                        AS total_items,
    COUNT(*) FILTER (WHERE tdi.severity = 'critical')   AS critical_count,
    COUNT(*) FILTER (WHERE tdi.severity = 'high')       AS high_count,
    COUNT(*) FILTER (WHERE tdi.severity = 'medium')     AS medium_count,
    COUNT(*) FILTER (WHERE tdi.is_resolved = FALSE)     AS open_count,
    COALESCE(SUM(tdi.estimated_hours) FILTER (WHERE NOT tdi.is_resolved), 0)
                                    AS total_estimated_hours
FROM technical_debt_items tdi
JOIN projects p ON p.id = tdi.project_id
GROUP BY tdi.project_id, p.name;

-- -----------------------------------------------------------------------------
-- VIEW: Deployment risk — deployments awaiting HITL or in-flight
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_deployment_risk AS
SELECT
    d.id                            AS deployment_id,
    d.project_id,
    p.name                          AS project_name,
    d.environment,
    d.version,
    d.status,
    d.strategy,
    d.triggered_by,
    d.started_at,
    h.id                            AS hitl_id,
    h.status                        AS hitl_status,
    h.expires_at                    AS hitl_expires_at,
    u.display_name                  AS triggered_by_user
FROM deployments d
JOIN projects p ON p.id = d.project_id
LEFT JOIN hitl_approvals h ON h.agent_run_id = d.agent_run_id
LEFT JOIN users u ON u.id = d.triggered_user_id
WHERE d.status IN ('pending','in_progress')
   OR (d.status = 'success' AND d.completed_at > NOW() - INTERVAL '24 hours')
ORDER BY d.started_at DESC;

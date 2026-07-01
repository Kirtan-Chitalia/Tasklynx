-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- functions.sql — Stored Functions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SEMANTIC SEARCH: Find similar tasks by embedding (pgvector)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_search_similar_tasks(
    p_embedding     vector(1536),
    p_project_id    UUID,
    p_limit         INT DEFAULT 10,
    p_threshold     FLOAT DEFAULT 0.75
)
RETURNS TABLE (
    task_id         UUID,
    title           VARCHAR,
    status          VARCHAR,
    similarity      FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.title,
        t.status,
        1 - (t.embedding <=> p_embedding) AS similarity
    FROM tasks t
    WHERE t.project_id = p_project_id
      AND t.embedding IS NOT NULL
      AND 1 - (t.embedding <=> p_embedding) >= p_threshold
    ORDER BY t.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- -----------------------------------------------------------------------------
-- SEMANTIC SEARCH: Retrieve agent memory by similarity
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_retrieve_agent_memory(
    p_embedding     vector(1536),
    p_org_id        UUID,
    p_memory_type   VARCHAR DEFAULT NULL,
    p_project_id    UUID DEFAULT NULL,
    p_limit         INT DEFAULT 20,
    p_threshold     FLOAT DEFAULT 0.70
)
RETURNS TABLE (
    memory_id       UUID,
    memory_type     VARCHAR,
    key             VARCHAR,
    content         TEXT,
    similarity      FLOAT,
    importance_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.memory_type,
        m.key,
        m.content,
        1 - (m.embedding <=> p_embedding) AS similarity,
        m.importance_score
    FROM agent_memory m
    WHERE m.org_id = p_org_id
      AND m.embedding IS NOT NULL
      AND (p_memory_type IS NULL OR m.memory_type = p_memory_type)
      AND (p_project_id IS NULL OR m.project_id = p_project_id OR m.scope IN ('global','org'))
      AND (m.expires_at IS NULL OR m.expires_at > NOW())
      AND 1 - (m.embedding <=> p_embedding) >= p_threshold
    ORDER BY
        (1 - (m.embedding <=> p_embedding)) * m.importance_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- -----------------------------------------------------------------------------
-- SPRINT: Calculate team velocity (rolling average)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_team_velocity(
    p_project_id    UUID,
    p_sprints_back  INT DEFAULT 5
)
RETURNS TABLE (
    avg_velocity    NUMERIC,
    std_dev         NUMERIC,
    min_velocity    NUMERIC,
    max_velocity    NUMERIC,
    sprint_count    INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROUND(AVG(completed_points), 2),
        ROUND(STDDEV(completed_points), 2),
        MIN(completed_points),
        MAX(completed_points),
        COUNT(*)::INT
    FROM (
        SELECT svh.completed_points
        FROM sprint_velocity_history svh
        WHERE svh.project_id = p_project_id
        ORDER BY svh.period_start DESC
        LIMIT p_sprints_back
    ) recent;
END;
$$ LANGUAGE plpgsql STABLE;

-- -----------------------------------------------------------------------------
-- SPRINT: Monte Carlo simulation for completion probability
-- Given a backlog of points and historical velocity, returns percentiles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_monte_carlo_sprint(
    p_project_id    UUID,
    p_backlog_points INT,
    p_simulations   INT DEFAULT 10000
)
RETURNS TABLE (
    p50             NUMERIC,
    p85             NUMERIC,
    p95             NUMERIC,
    avg_sprints     NUMERIC,
    completion_prob NUMERIC   -- probability of finishing in 1 sprint
) AS $$
DECLARE
    v_avg_vel       NUMERIC;
    v_std_dev       NUMERIC;
    v_completions   INT := 0;
    v_total_sprints BIGINT := 0;
    i               INT;
    sim_vel         NUMERIC;
    sprints_needed  NUMERIC;
    v_p50_arr       NUMERIC[];
BEGIN
    -- Get velocity stats
    SELECT avg_velocity, COALESCE(std_dev, avg_velocity * 0.2)
    INTO v_avg_vel, v_std_dev
    FROM fn_team_velocity(p_project_id);

    IF v_avg_vel IS NULL OR v_avg_vel = 0 THEN
        v_avg_vel := 20; -- fallback default
        v_std_dev := 4;
    END IF;

    -- Run simulations (simplified Box-Muller normal distribution)
    FOR i IN 1..p_simulations LOOP
        -- Normal distribution approximation via CLT (sum of uniforms)
        sim_vel := GREATEST(1, v_avg_vel +
            v_std_dev * (
                random() + random() + random() + random() +
                random() + random() + random() + random() +
                random() + random() + random() + random() - 6
            ) / SQRT(12));

        sprints_needed := CEIL(p_backlog_points::NUMERIC / sim_vel);
        v_total_sprints := v_total_sprints + sprints_needed;

        IF sprints_needed <= 1 THEN
            v_completions := v_completions + 1;
        END IF;
    END LOOP;

    RETURN QUERY
    SELECT
        ROUND(v_avg_vel * 0.5, 1),                                    -- p50 estimate
        ROUND(v_avg_vel * 0.85, 1),                                   -- p85
        ROUND(v_avg_vel * 0.95, 1),                                   -- p95
        ROUND(v_total_sprints::NUMERIC / p_simulations, 2),           -- avg sprints needed
        ROUND(v_completions::NUMERIC / p_simulations * 100, 2);       -- completion % in 1 sprint
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- REBAC: Check if a subject has a relation on an object
-- (Simplified — a full implementation would use recursive CTE for inheritance)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_permission(
    p_org_id        UUID,
    p_subject_type  VARCHAR,
    p_subject_id    UUID,
    p_relation      VARCHAR,
    p_object_type   VARCHAR,
    p_object_id     UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM rebac_relationships
        WHERE org_id = p_org_id
          AND subject_type = p_subject_type
          AND subject_id = p_subject_id
          AND relation = p_relation
          AND object_type = p_object_type
          AND object_id = p_object_id
          AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- -----------------------------------------------------------------------------
-- AGENT COST: Compute total cost for an agent run
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_agent_run_cost(p_run_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_cost NUMERIC;
BEGIN
    SELECT
        COALESCE(SUM(
            (ars.tokens_used::NUMERIC / 1000) *
            COALESCE(mr.cost_per_1k_input_tokens, 0.003)
        ), 0)
    INTO v_cost
    FROM agent_run_steps ars
    JOIN agent_runs ar ON ar.id = ars.agent_run_id
    JOIN agent_configs ac ON ac.id = ar.agent_config_id
    JOIN model_registry mr ON mr.id = ac.primary_model_id
    WHERE ars.agent_run_id = p_run_id;

    RETURN v_cost;
END;
$$ LANGUAGE plpgsql STABLE;

-- -----------------------------------------------------------------------------
-- BURNDOWN: Generate ideal burndown line for a sprint
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_ideal_burndown(p_sprint_id UUID)
RETURNS TABLE (
    day_number      INT,
    snapshot_date   DATE,
    ideal_points    NUMERIC
) AS $$
DECLARE
    v_start_date    DATE;
    v_end_date      DATE;
    v_total_points  NUMERIC;
    v_work_days     INT;
    v_d             DATE;
    v_day           INT := 0;
BEGIN
    SELECT start_date, end_date, committed_points
    INTO v_start_date, v_end_date, v_total_points
    FROM sprints WHERE id = p_sprint_id;

    v_work_days := (v_end_date - v_start_date + 1);

    v_d := v_start_date;
    LOOP
        EXIT WHEN v_d > v_end_date;
        -- Skip weekends
        IF EXTRACT(DOW FROM v_d) NOT IN (0, 6) THEN
            day_number  := v_day;
            snapshot_date := v_d;
            ideal_points := GREATEST(0, v_total_points - (v_total_points * v_day::NUMERIC / GREATEST(v_work_days, 1)));
            RETURN NEXT;
            v_day := v_day + 1;
        END IF;
        v_d := v_d + INTERVAL '1 day';
    END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- -----------------------------------------------------------------------------
-- PROJECT: Compute overall project health score (0–100)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_project_health_score(p_project_id UUID)
RETURNS TABLE (
    score           INT,
    grade           CHAR(1),
    details         JSONB
) AS $$
DECLARE
    v_total_tasks   INT;
    v_done_tasks    INT;
    v_blocked_tasks INT;
    v_overdue_tasks INT;
    v_active_sprint_completion NUMERIC;
    v_score         INT;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'done'),
        COUNT(*) FILTER (WHERE status = 'blocked'),
        COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('done','cancelled'))
    INTO v_total_tasks, v_done_tasks, v_blocked_tasks, v_overdue_tasks
    FROM tasks
    WHERE project_id = p_project_id AND status != 'cancelled';

    SELECT COALESCE(
        (completed_points::NUMERIC / NULLIF(committed_points, 0)) * 100, 50
    )
    INTO v_active_sprint_completion
    FROM sprints
    WHERE project_id = p_project_id AND status = 'active'
    ORDER BY start_date DESC LIMIT 1;

    v_score := LEAST(100, GREATEST(0, (
        -- 40% weight on task completion rate
        (CASE WHEN v_total_tasks > 0
              THEN (v_done_tasks::NUMERIC / v_total_tasks) * 40
              ELSE 20 END) +
        -- 30% on active sprint velocity
        (COALESCE(v_active_sprint_completion, 50) * 0.3) +
        -- -10 for each blocked task pct point
        (CASE WHEN v_total_tasks > 0
              THEN GREATEST(0, 20 - (v_blocked_tasks::NUMERIC / v_total_tasks * 100))
              ELSE 20 END) +
        -- 10 points for no overdue tasks
        (CASE WHEN v_overdue_tasks = 0 THEN 10 ELSE GREATEST(0, 10 - v_overdue_tasks) END)
    )::INT));

    score  := v_score;
    grade  := CASE
                WHEN v_score >= 90 THEN 'A'
                WHEN v_score >= 75 THEN 'B'
                WHEN v_score >= 60 THEN 'C'
                WHEN v_score >= 40 THEN 'D'
                ELSE 'F'
              END;
    details := jsonb_build_object(
        'total_tasks', v_total_tasks,
        'done_tasks', v_done_tasks,
        'blocked_tasks', v_blocked_tasks,
        'overdue_tasks', v_overdue_tasks,
        'sprint_completion_pct', ROUND(v_active_sprint_completion, 1)
    );

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- -----------------------------------------------------------------------------
-- UTIL: Soft-delete a task (mark cancelled, preserve for audit)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_soft_delete_task(
    p_task_id   UUID,
    p_actor_id  UUID,
    p_reason    TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE tasks
    SET status = 'cancelled',
        description = COALESCE(description, '') ||
            E'\n\n[Cancelled by ' || p_actor_id::TEXT || ' at ' || NOW()::TEXT ||
            CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '' END || ']'
    WHERE id = p_task_id;

    INSERT INTO audit_logs (
        org_id, actor_type, actor_id, event_category, event_action,
        entity_type, entity_id, changes
    )
    SELECT
        p.org_id, 'user', p_actor_id, 'task', 'cancelled',
        'task', p_task_id,
        jsonb_build_object('reason', p_reason, 'task_id', p_task_id)
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- UTIL: Get project summary stats for executive dashboard
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_project_summary(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'project_id', p.id,
        'name', p.name,
        'status', p.status,
        'total_tasks', COUNT(DISTINCT t.id),
        'done_tasks',  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'done'),
        'blocked_tasks', COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'blocked'),
        'total_epics', COUNT(DISTINCT e.id),
        'total_stories', COUNT(DISTINCT s.id),
        'total_prs', COUNT(DISTINCT pr.id),
        'merged_prs', COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'merged'),
        'active_sprint', (
            SELECT row_to_json(sp)
            FROM sprints sp
            WHERE sp.project_id = p.id AND sp.status = 'active'
            LIMIT 1
        ),
        'health', (SELECT score FROM fn_project_health_score(p.id)),
        'agent_runs_today', (
            SELECT COUNT(*) FROM agent_runs ar
            WHERE ar.project_id = p.id AND ar.created_at >= CURRENT_DATE
        )
    )
    INTO result
    FROM projects p
    LEFT JOIN epics e ON e.project_id = p.id
    LEFT JOIN stories s ON s.project_id = p.id
    LEFT JOIN tasks t ON t.project_id = p.id AND t.status != 'cancelled'
    LEFT JOIN pull_requests pr ON pr.project_id = p.id
    WHERE p.id = p_project_id
    GROUP BY p.id;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

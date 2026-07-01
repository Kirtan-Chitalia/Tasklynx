-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- constraints.sql — Business Rule Constraints
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ORGANIZATIONS: Seat & resource caps
-- -----------------------------------------------------------------------------
ALTER TABLE organizations
    ADD CONSTRAINT chk_org_max_seats     CHECK (max_seats >= 1 AND max_seats <= 100000),
    ADD CONSTRAINT chk_org_max_projects  CHECK (max_projects >= 1),
    ADD CONSTRAINT chk_org_max_storage   CHECK (max_storage_gb >= 1);

ALTER TABLE org_billing
    ADD CONSTRAINT chk_billing_credits   CHECK (ai_credits_used >= 0 AND ai_credits_limit >= 0),
    ADD CONSTRAINT chk_billing_spend     CHECK (monthly_spend_usd >= 0);

-- -----------------------------------------------------------------------------
-- USERS
-- -----------------------------------------------------------------------------
ALTER TABLE users
    ADD CONSTRAINT chk_user_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE user_capacity
    ADD CONSTRAINT chk_user_weekly_hours CHECK (weekly_hours > 0 AND weekly_hours <= 168);

ALTER TABLE user_pto
    ADD CONSTRAINT chk_pto_duration      CHECK (end_date >= start_date);

-- -----------------------------------------------------------------------------
-- PROJECTS
-- -----------------------------------------------------------------------------
ALTER TABLE projects
    ADD CONSTRAINT chk_project_budget    CHECK (budget_usd IS NULL OR budget_usd >= 0),
    ADD CONSTRAINT chk_project_spent     CHECK (spent_usd >= 0),
    ADD CONSTRAINT chk_project_dates     CHECK (target_date IS NULL OR start_date IS NULL OR target_date >= start_date);

-- -----------------------------------------------------------------------------
-- EPICS
-- -----------------------------------------------------------------------------
ALTER TABLE epics
    ADD CONSTRAINT chk_epic_points       CHECK (story_points IS NULL OR story_points >= 0),
    ADD CONSTRAINT chk_epic_completed    CHECK (completed_points >= 0),
    ADD CONSTRAINT chk_epic_dates        CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date);

-- -----------------------------------------------------------------------------
-- STORIES
-- -----------------------------------------------------------------------------
ALTER TABLE stories
    ADD CONSTRAINT chk_story_points      CHECK (story_points IS NULL OR (story_points >= 0 AND story_points <= 200));

-- -----------------------------------------------------------------------------
-- TASKS
-- -----------------------------------------------------------------------------
ALTER TABLE tasks
    ADD CONSTRAINT chk_task_estimate     CHECK (estimate_hours IS NULL OR estimate_hours >= 0),
    ADD CONSTRAINT chk_task_actual       CHECK (actual_hours IS NULL OR actual_hours >= 0),
    ADD CONSTRAINT chk_task_points       CHECK (story_points IS NULL OR story_points >= 0),
    ADD CONSTRAINT chk_task_no_self_parent CHECK (id != parent_task_id);

ALTER TABLE task_dependencies
    ADD CONSTRAINT chk_dep_no_self       CHECK (task_id != depends_on_id);

-- -----------------------------------------------------------------------------
-- SPRINTS
-- -----------------------------------------------------------------------------
ALTER TABLE sprints
    ADD CONSTRAINT chk_sprint_dates      CHECK (end_date > start_date),
    ADD CONSTRAINT chk_sprint_capacity   CHECK (capacity_points IS NULL OR capacity_points >= 0),
    ADD CONSTRAINT chk_sprint_committed  CHECK (committed_points >= 0),
    ADD CONSTRAINT chk_sprint_completed  CHECK (completed_points >= 0),
    ADD CONSTRAINT chk_sprint_monte_50   CHECK (monte_carlo_p50 IS NULL OR monte_carlo_p50 BETWEEN 0 AND 100),
    ADD CONSTRAINT chk_sprint_monte_85   CHECK (monte_carlo_p85 IS NULL OR monte_carlo_p85 BETWEEN 0 AND 100),
    ADD CONSTRAINT chk_sprint_monte_95   CHECK (monte_carlo_p95 IS NULL OR monte_carlo_p95 BETWEEN 0 AND 100);

ALTER TABLE burndown_snapshots
    ADD CONSTRAINT chk_burndown_remaining CHECK (remaining_points >= 0),
    ADD CONSTRAINT chk_burndown_completed CHECK (completed_points >= 0);

-- -----------------------------------------------------------------------------
-- AGENT CONFIGS & RUNS
-- -----------------------------------------------------------------------------
ALTER TABLE agent_configs
    ADD CONSTRAINT chk_agent_max_turns   CHECK (max_negotiation_turns >= 1 AND max_negotiation_turns <= 10),
    ADD CONSTRAINT chk_agent_temp        CHECK (temperature >= 0 AND temperature <= 2),
    ADD CONSTRAINT chk_agent_token_budget CHECK (monthly_token_budget IS NULL OR monthly_token_budget > 0);

ALTER TABLE agent_runs
    ADD CONSTRAINT chk_run_turn_count    CHECK (turn_count >= 0),
    ADD CONSTRAINT chk_run_tokens        CHECK (tokens_input >= 0 AND tokens_output >= 0),
    ADD CONSTRAINT chk_run_cost          CHECK (cost_usd >= 0);

ALTER TABLE agent_run_steps
    ADD CONSTRAINT chk_step_number       CHECK (step_number >= 1),
    ADD CONSTRAINT chk_step_tokens       CHECK (tokens_used >= 0),
    ADD CONSTRAINT chk_step_latency      CHECK (latency_ms IS NULL OR latency_ms >= 0);

ALTER TABLE agent_negotiations
    ADD CONSTRAINT chk_neg_turns         CHECK (turn_count >= 0 AND max_turns >= 1),
    ADD CONSTRAINT chk_neg_max_turns_cap CHECK (max_turns <= 10);

-- -----------------------------------------------------------------------------
-- AGENT MEMORY
-- -----------------------------------------------------------------------------
ALTER TABLE agent_memory
    ADD CONSTRAINT chk_memory_importance CHECK (importance_score >= 0 AND importance_score <= 1),
    ADD CONSTRAINT chk_memory_access     CHECK (access_count >= 0);

-- -----------------------------------------------------------------------------
-- HITL APPROVALS
-- -----------------------------------------------------------------------------
ALTER TABLE hitl_approvals
    ADD CONSTRAINT chk_hitl_expires      CHECK (expires_at > requested_at),
    ADD CONSTRAINT chk_hitl_resolved     CHECK (
        resolved_at IS NULL OR resolved_at >= requested_at
    );

-- -----------------------------------------------------------------------------
-- ATTACHMENTS: Minimum file size, valid MIME
-- -----------------------------------------------------------------------------
ALTER TABLE attachments
    ADD CONSTRAINT chk_attach_size       CHECK (file_size_bytes > 0),
    ADD CONSTRAINT chk_attach_one_parent CHECK (
        (task_id IS NOT NULL)::INT +
        (story_id IS NOT NULL)::INT +
        (epic_id IS NOT NULL)::INT = 1
    );

-- -----------------------------------------------------------------------------
-- ANALYTICS & METRICS
-- -----------------------------------------------------------------------------
ALTER TABLE project_metrics_daily
    ADD CONSTRAINT chk_metrics_positive CHECK (
        tasks_created >= 0 AND tasks_completed >= 0 AND
        prs_opened >= 0 AND prs_merged >= 0 AND
        agent_cost_usd >= 0
    );

ALTER TABLE sprint_velocity_history
    ADD CONSTRAINT chk_velocity_positive CHECK (
        completed_points >= 0 AND committed_points >= 0
    ),
    ADD CONSTRAINT chk_completion_rate   CHECK (
        completion_rate IS NULL OR (completion_rate >= 0 AND completion_rate <= 1)
    );

-- -----------------------------------------------------------------------------
-- SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE abac_policies
    ADD CONSTRAINT chk_abac_priority     CHECK (priority >= 1 AND priority <= 10000);

-- -----------------------------------------------------------------------------
-- LLM OBSERVABILITY
-- -----------------------------------------------------------------------------
ALTER TABLE llm_traces
    ADD CONSTRAINT chk_trace_tokens      CHECK (tokens_input >= 0 AND tokens_output >= 0),
    ADD CONSTRAINT chk_trace_cost        CHECK (cost_usd >= 0),
    ADD CONSTRAINT chk_trace_latency     CHECK (latency_ms IS NULL OR latency_ms >= 0);

ALTER TABLE llm_generations
    ADD CONSTRAINT chk_gen_tokens        CHECK (tokens_input >= 0 AND tokens_output >= 0),
    ADD CONSTRAINT chk_gen_cost          CHECK (cost_usd >= 0),
    ADD CONSTRAINT chk_gen_temp          CHECK (temperature IS NULL OR (temperature >= 0 AND temperature <= 2));

-- -----------------------------------------------------------------------------
-- AI FEATURE CONSTRAINTS
-- -----------------------------------------------------------------------------
ALTER TABLE epic_scope_history
    ADD CONSTRAINT chk_scope_counts      CHECK (story_count >= 0 AND total_points >= 0);

ALTER TABLE team_sentiment_readings
    ADD CONSTRAINT chk_sentiment_range   CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
    ADD CONSTRAINT chk_sentiment_period  CHECK (analysis_period_end >= analysis_period_start),
    ADD CONSTRAINT chk_sentiment_sample  CHECK (sample_size >= 0);

-- -----------------------------------------------------------------------------
-- UNIQUE CONSTRAINTS (supplemental, where not inline)
-- -----------------------------------------------------------------------------
ALTER TABLE agent_run_steps
    ADD CONSTRAINT uq_run_step_number    UNIQUE (agent_run_id, step_number);

ALTER TABLE agent_negotiation_turns
    ADD CONSTRAINT uq_neg_turn_number    UNIQUE (negotiation_id, turn_number);

ALTER TABLE project_okrs
    ADD CONSTRAINT chk_okr_progress      CHECK (progress_pct >= 0 AND progress_pct <= 100);

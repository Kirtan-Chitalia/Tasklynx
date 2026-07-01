-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- indexes.sql — Performance Indexing Strategy
-- =============================================================================
-- Strategy:
--   B-Tree   → equality, range, ORDER BY
--   GIN      → JSONB containment, array overlap, full-text search
--   BRIN     → append-only time-series (audit/activity partitions)
--   IVFFlat  → vector ANN similarity search (pgvector)
--   GiST     → range types, IP addresses
-- =============================================================================

-- -----------------------------------------------------------------------------
-- AUTH & SESSION
-- -----------------------------------------------------------------------------
CREATE INDEX idx_auth_sessions_user        ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires     ON auth_sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_org              ON api_keys(org_id);
CREATE INDEX idx_api_keys_prefix           ON api_keys(key_prefix);

-- -----------------------------------------------------------------------------
-- ORGANIZATIONS & USERS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_users_org                 ON users(org_id);
CREATE INDEX idx_users_email               ON users(email);
CREATE INDEX idx_users_status              ON users(org_id, status);
CREATE INDEX idx_user_capacity_github      ON user_capacity(github_login) WHERE github_login IS NOT NULL;
CREATE INDEX idx_user_pto_user_dates       ON user_pto(user_id, start_date, end_date);

-- -----------------------------------------------------------------------------
-- WORKSPACES & TEAMS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_workspaces_org            ON workspaces(org_id);
CREATE INDEX idx_teams_org                 ON teams(org_id);
CREATE INDEX idx_team_members_user         ON team_members(user_id);

-- -----------------------------------------------------------------------------
-- PROJECTS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_projects_org              ON projects(org_id);
CREATE INDEX idx_projects_workspace        ON projects(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_projects_team             ON projects(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_projects_owner            ON projects(owner_id);
CREATE INDEX idx_projects_status           ON projects(org_id, status);
CREATE INDEX idx_project_members_user      ON project_members(user_id);
CREATE INDEX idx_project_custom_fields_proj ON project_custom_fields(project_id);

-- -----------------------------------------------------------------------------
-- EPICS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_epics_project             ON epics(project_id);
CREATE INDEX idx_epics_owner               ON epics(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_epics_status              ON epics(project_id, status);
CREATE INDEX idx_epics_due_date            ON epics(due_date) WHERE due_date IS NOT NULL;
-- Vector similarity search for semantic memory
CREATE INDEX idx_epics_embedding           ON epics USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    WHERE embedding IS NOT NULL;

-- -----------------------------------------------------------------------------
-- STORIES
-- -----------------------------------------------------------------------------
CREATE INDEX idx_stories_project           ON stories(project_id);
CREATE INDEX idx_stories_epic              ON stories(epic_id) WHERE epic_id IS NOT NULL;
CREATE INDEX idx_stories_assignee          ON stories(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_stories_status            ON stories(project_id, status);
CREATE INDEX idx_stories_type              ON stories(project_id, story_type);
CREATE INDEX idx_stories_embedding         ON stories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    WHERE embedding IS NOT NULL;
-- Trigram search for title
CREATE INDEX idx_stories_title_trgm        ON stories USING gin (title gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- TASKS — Most frequently queried table
-- -----------------------------------------------------------------------------
CREATE INDEX idx_tasks_project             ON tasks(project_id);
CREATE INDEX idx_tasks_story               ON tasks(story_id) WHERE story_id IS NOT NULL;
CREATE INDEX idx_tasks_parent              ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_tasks_assignee            ON tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_tasks_status              ON tasks(project_id, status);
CREATE INDEX idx_tasks_priority            ON tasks(project_id, priority);
CREATE INDEX idx_tasks_type                ON tasks(project_id, task_type);
CREATE INDEX idx_tasks_due_date            ON tasks(due_date) WHERE due_date IS NOT NULL AND status != 'done';
CREATE INDEX idx_tasks_sequence            ON tasks(project_id, sequence_num);
CREATE INDEX idx_tasks_sort                ON tasks(project_id, sort_order);
CREATE INDEX idx_tasks_created_at          ON tasks(project_id, created_at DESC);
CREATE INDEX idx_tasks_updated_at          ON tasks(updated_at DESC);
-- Full-text for title
CREATE INDEX idx_tasks_title_trgm          ON tasks USING gin (title gin_trgm_ops);
-- Vector ANN search
CREATE INDEX idx_tasks_embedding           ON tasks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200)
    WHERE embedding IS NOT NULL;

-- -----------------------------------------------------------------------------
-- TASK DEPENDENCIES
-- -----------------------------------------------------------------------------
CREATE INDEX idx_task_deps_task            ON task_dependencies(task_id);
CREATE INDEX idx_task_deps_depends_on      ON task_dependencies(depends_on_id);

-- -----------------------------------------------------------------------------
-- LABELS & WATCHERS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_label_assignments_label   ON task_label_assignments(label_id);
CREATE INDEX idx_task_watchers_user        ON task_watchers(user_id);

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_comments_task             ON comments(task_id);
CREATE INDEX idx_comments_author           ON comments(author_id) WHERE author_id IS NOT NULL;
CREATE INDEX idx_comments_parent           ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_comments_created          ON comments(task_id, created_at DESC);
CREATE INDEX idx_comments_agent_run        ON comments(agent_run_id) WHERE agent_run_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- ATTACHMENTS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_attachments_task          ON attachments(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_attachments_story         ON attachments(story_id) WHERE story_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- SPRINTS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_sprints_project           ON sprints(project_id);
CREATE INDEX idx_sprints_team              ON sprints(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_sprints_status            ON sprints(project_id, status);
CREATE INDEX idx_sprints_dates             ON sprints(project_id, start_date, end_date);
CREATE INDEX idx_sprint_tasks_task         ON sprint_tasks(task_id);
CREATE INDEX idx_burndown_sprint_date      ON burndown_snapshots(sprint_id, snapshot_date DESC);
CREATE INDEX idx_velocity_project          ON sprint_velocity_history(project_id, period_start DESC);
CREATE INDEX idx_backlog_project           ON backlog_items(project_id, priority_score DESC, sort_order);

-- -----------------------------------------------------------------------------
-- DEVOPS / INTEGRATIONS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_integrations_org          ON integrations(org_id);
CREATE INDEX idx_integrations_project      ON integrations(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_integrations_provider     ON integrations(provider, is_active);
CREATE INDEX idx_prs_integration           ON pull_requests(integration_id);
CREATE INDEX idx_prs_status                ON pull_requests(project_id, status);
CREATE INDEX idx_prs_author_user           ON pull_requests(author_user_id) WHERE author_user_id IS NOT NULL;
CREATE INDEX idx_prs_branch                ON pull_requests(head_branch);
CREATE INDEX idx_deployments_project       ON deployments(project_id);
CREATE INDEX idx_deployments_status        ON deployments(project_id, status);
CREATE INDEX idx_deployments_env           ON deployments(project_id, environment);
CREATE INDEX idx_deployments_agent_run     ON deployments(agent_run_id) WHERE agent_run_id IS NOT NULL;
CREATE INDEX idx_cicd_integration          ON cicd_pipeline_runs(integration_id);
CREATE INDEX idx_cicd_status               ON cicd_pipeline_runs(project_id, status);
CREATE INDEX idx_adrs_project              ON architectural_decision_records(project_id);
CREATE INDEX idx_adrs_embedding            ON architectural_decision_records
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)
    WHERE embedding IS NOT NULL;

-- -----------------------------------------------------------------------------
-- AGENT CONFIGS & REGISTRY
-- -----------------------------------------------------------------------------
CREATE INDEX idx_agent_configs_org         ON agent_configs(org_id);
CREATE INDEX idx_agent_configs_project     ON agent_configs(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_agent_configs_type        ON agent_configs(agent_type_id, is_active);

-- -----------------------------------------------------------------------------
-- AGENT RUNS — Critical for observability
-- -----------------------------------------------------------------------------
CREATE INDEX idx_agent_runs_org            ON agent_runs(org_id);
CREATE INDEX idx_agent_runs_project        ON agent_runs(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_agent_runs_config         ON agent_runs(agent_config_id);
CREATE INDEX idx_agent_runs_status         ON agent_runs(org_id, status);
CREATE INDEX idx_agent_runs_trigger        ON agent_runs(trigger_event, trigger_entity_type, trigger_entity_id);
CREATE INDEX idx_agent_runs_parent         ON agent_runs(parent_run_id) WHERE parent_run_id IS NOT NULL;
CREATE INDEX idx_agent_runs_otel           ON agent_runs(otel_trace_id) WHERE otel_trace_id IS NOT NULL;
CREATE INDEX idx_agent_runs_created        ON agent_runs(created_at DESC);
CREATE INDEX idx_agent_run_steps_run       ON agent_run_steps(agent_run_id);
CREATE INDEX idx_agent_run_steps_type      ON agent_run_steps(agent_run_id, step_type);

-- -----------------------------------------------------------------------------
-- AGENT MEMORY — Heavy vector usage
-- -----------------------------------------------------------------------------
CREATE INDEX idx_agent_memory_org          ON agent_memory(org_id);
CREATE INDEX idx_agent_memory_project      ON agent_memory(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_agent_memory_type         ON agent_memory(memory_type, scope);
CREATE INDEX idx_agent_memory_key          ON agent_memory(org_id, memory_type, key);
CREATE INDEX idx_agent_memory_expires      ON agent_memory(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_agent_memory_embedding    ON agent_memory
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200)
    WHERE embedding IS NOT NULL;

-- -----------------------------------------------------------------------------
-- HITL APPROVALS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_hitl_agent_run            ON hitl_approvals(agent_run_id);
CREATE INDEX idx_hitl_status               ON hitl_approvals(status, expires_at) WHERE status = 'pending';
CREATE INDEX idx_hitl_approver             ON hitl_approvals(approver_id) WHERE approver_id IS NOT NULL;
CREATE INDEX idx_hitl_requested_for        ON hitl_approvals(requested_for) WHERE requested_for IS NOT NULL;

-- -----------------------------------------------------------------------------
-- KNOWLEDGE BASE & DOCUMENTS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_documents_kb              ON documents(kb_id);
CREATE INDEX idx_documents_project         ON documents(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_documents_type            ON documents(doc_type, status);
CREATE INDEX idx_documents_tags            ON documents USING gin (tags);
CREATE INDEX idx_documents_embedding       ON documents
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    WHERE embedding IS NOT NULL;
CREATE INDEX idx_document_versions_doc     ON document_versions(document_id, version DESC);

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS
-- -----------------------------------------------------------------------------
CREATE INDEX idx_notifications_recipient   ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_entity      ON notifications(entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_notifications_unread      ON notifications(recipient_id) WHERE is_read = FALSE;

-- -----------------------------------------------------------------------------
-- ANALYTICS — Partitioned, use BRIN for time ranges
-- -----------------------------------------------------------------------------
CREATE INDEX idx_analytics_events_org      ON analytics_events(org_id, occurred_at DESC);
CREATE INDEX idx_analytics_events_project  ON analytics_events(project_id, occurred_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX idx_analytics_events_name     ON analytics_events(event_name, occurred_at DESC);
CREATE INDEX idx_analytics_events_props    ON analytics_events USING gin (properties);
CREATE INDEX idx_project_metrics_date      ON project_metrics_daily(project_id, metric_date DESC);

-- -----------------------------------------------------------------------------
-- AUDIT LOGS — BRIN for append-only partitions
-- -----------------------------------------------------------------------------
CREATE INDEX idx_audit_logs_org_time       ON audit_logs(org_id, occurred_at DESC);
CREATE INDEX idx_audit_logs_entity         ON audit_logs(entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_audit_logs_actor          ON audit_logs(actor_id, occurred_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_logs_severity       ON audit_logs(severity) WHERE severity IN ('warning','error','critical');
CREATE INDEX idx_audit_logs_otel           ON audit_logs(otel_trace_id) WHERE otel_trace_id IS NOT NULL;
CREATE INDEX idx_audit_logs_brin           ON audit_logs_2026 USING brin (occurred_at);
CREATE INDEX idx_audit_logs_2027_brin      ON audit_logs_2027 USING brin (occurred_at);

-- -----------------------------------------------------------------------------
-- SECURITY & ACCESS CONTROL
-- -----------------------------------------------------------------------------
CREATE INDEX idx_rebac_subject             ON rebac_relationships(subject_type, subject_id);
CREATE INDEX idx_rebac_object              ON rebac_relationships(object_type, object_id);
CREATE INDEX idx_rebac_relation            ON rebac_relationships(subject_type, subject_id, relation, object_type);
CREATE INDEX idx_abac_policies_org         ON abac_policies(org_id, is_active);
CREATE INDEX idx_abac_policies_action      ON abac_policies(action) WHERE is_active = TRUE;

-- -----------------------------------------------------------------------------
-- AI OBSERVABILITY
-- -----------------------------------------------------------------------------
CREATE INDEX idx_llm_traces_org            ON llm_traces(org_id, started_at DESC);
CREATE INDEX idx_llm_traces_run            ON llm_traces(agent_run_id) WHERE agent_run_id IS NOT NULL;
CREATE INDEX idx_llm_traces_model          ON llm_traces(model);
CREATE INDEX idx_llm_generations_trace     ON llm_generations(trace_id);

-- -----------------------------------------------------------------------------
-- AI FEATURES
-- -----------------------------------------------------------------------------
CREATE INDEX idx_scope_history_epic        ON epic_scope_history(epic_id, snapshot_date DESC);
CREATE INDEX idx_tech_debt_project         ON technical_debt_items(project_id, severity, is_resolved);
CREATE INDEX idx_sentiment_team            ON team_sentiment_readings(team_id, analysis_period_start DESC);
CREATE INDEX idx_activity_logs_entity      ON activity_logs(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_activity_logs_actor       ON activity_logs(actor_id, occurred_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_activity_logs_project     ON activity_logs(project_id, occurred_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX idx_activity_logs_brin        ON activity_logs_2026 USING brin (occurred_at);

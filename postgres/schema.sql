-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- schema.sql — Enterprise PostgreSQL Schema
-- Version: 1.0.0
-- =============================================================================
-- Requires: PostgreSQL 15+, pgvector, pg_trgm, uuid-ossp, pgcrypto
-- Run order: schema.sql → constraints.sql → indexes.sql → triggers.sql
--            → functions.sql → views.sql → seed.sql
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- =============================================================================
-- MODULE 1: AUTHENTICATION & IDENTITY
-- =============================================================================

CREATE TABLE auth_providers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(50) NOT NULL UNIQUE,     -- 'local', 'google', 'github', 'saml', 'oidc'
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    refresh_token_hash VARCHAR(255) UNIQUE,
    provider_id     UUID REFERENCES auth_providers(id),
    ip_address      INET,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mfa_configurations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    method          VARCHAR(20) NOT NULL CHECK (method IN ('totp','sms','email','webauthn')),
    secret_encrypted TEXT NOT NULL,
    is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    backup_codes    JSONB,                           -- hashed backup codes array
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE password_reset_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL,
    user_id         UUID,
    name            VARCHAR(100) NOT NULL,
    key_prefix      VARCHAR(10) NOT NULL,            -- first 8 chars for identification
    key_hash        VARCHAR(255) NOT NULL UNIQUE,
    scopes          TEXT[] NOT NULL DEFAULT '{}',
    rate_limit_rpm  INT NOT NULL DEFAULT 1000,
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE 2: ORGANIZATIONS & TENANCY
-- =============================================================================

CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    plan            VARCHAR(30) NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free','starter','professional','enterprise','custom')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','cancelled','trial')),
    billing_email   VARCHAR(255),
    max_seats       INT NOT NULL DEFAULT 5,
    max_projects    INT NOT NULL DEFAULT 10,
    max_storage_gb  INT NOT NULL DEFAULT 10,
    settings        JSONB NOT NULL DEFAULT '{}',     -- org-level feature flags, branding
    sso_config      JSONB,                           -- SAML / OIDC provider config
    data_region     VARCHAR(10) NOT NULL DEFAULT 'us-east-1',
    trial_ends_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE org_billing (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    seats_used      INT NOT NULL DEFAULT 0,
    ai_credits_used BIGINT NOT NULL DEFAULT 0,
    ai_credits_limit BIGINT NOT NULL DEFAULT 100000,
    monthly_spend_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE 3: USERS & PROFILES
-- =============================================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    display_name    VARCHAR(150) NOT NULL,
    avatar_url      VARCHAR(500),
    timezone        VARCHAR(50) NOT NULL DEFAULT 'UTC',
    locale          VARCHAR(10) NOT NULL DEFAULT 'en',
    role            VARCHAR(30) NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner','admin','manager','member','guest','service_account')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','pending','suspended')),
    password_hash   VARCHAR(255),                    -- NULL for SSO-only users
    preferences     JSONB NOT NULL DEFAULT '{}',     -- theme, notification prefs, keyboard shortcuts
    last_active_at  TIMESTAMPTZ,
    invited_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, email)
);

CREATE TABLE user_capacity (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    weekly_hours    NUMERIC(5,2) NOT NULL DEFAULT 40,
    skill_tags      TEXT[] NOT NULL DEFAULT '{}',
    seniority_level VARCHAR(20) CHECK (seniority_level IN ('junior','mid','senior','staff','principal')),
    github_login    VARCHAR(100),
    slack_user_id   VARCHAR(100),
    jira_account_id VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_pto (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    pto_type        VARCHAR(30) NOT NULL DEFAULT 'vacation',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

-- =============================================================================
-- MODULE 4: WORKSPACES & TEAMS
-- =============================================================================

CREATE TABLE workspaces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    description     TEXT,
    icon            VARCHAR(100),
    color           VARCHAR(7),
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    settings        JSONB NOT NULL DEFAULT '{}',
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, slug)
);

CREATE TABLE teams (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workspace_id    UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    description     TEXT,
    team_type       VARCHAR(30) NOT NULL DEFAULT 'engineering'
                    CHECK (team_type IN ('engineering','product','qa','devops','design','management','cross_functional')),
    velocity_avg    NUMERIC(6,2),                    -- rolling avg story points per sprint
    capacity_hours  NUMERIC(7,2),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, slug)
);

CREATE TABLE team_members (
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(30) NOT NULL DEFAULT 'member'
                    CHECK (role IN ('lead','senior','member','observer')),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

-- =============================================================================
-- MODULE 5: PROJECTS
-- =============================================================================

CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workspace_id    UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
    name            VARCHAR(300) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    description     TEXT,
    status          VARCHAR(30) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('planning','active','on_hold','completed','archived','cancelled')),
    visibility      VARCHAR(20) NOT NULL DEFAULT 'team'
                    CHECK (visibility IN ('private','team','org','public')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('critical','high','medium','low')),
    start_date      DATE,
    target_date     DATE,
    budget_usd      NUMERIC(12,2),
    spent_usd       NUMERIC(12,2) NOT NULL DEFAULT 0,
    settings        JSONB NOT NULL DEFAULT '{}',     -- default statuses, issue types, workflow
    meta            JSONB NOT NULL DEFAULT '{}',     -- PRD link, tech stack, repo URLs
    owner_id        UUID NOT NULL REFERENCES users(id),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, slug)
);

CREATE TABLE project_members (
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(30) NOT NULL DEFAULT 'contributor'
                    CHECK (role IN ('owner','manager','contributor','reviewer','observer')),
    notification_level VARCHAR(20) NOT NULL DEFAULT 'mentions'
                    CHECK (notification_level IN ('all','mentions','none')),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE project_custom_fields (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    field_name      VARCHAR(100) NOT NULL,
    field_type      VARCHAR(30) NOT NULL
                    CHECK (field_type IN ('text','number','date','select','multi_select','user','url','checkbox')),
    options         JSONB,                           -- for select/multi_select
    is_required     BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_okrs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    objective       TEXT NOT NULL,
    key_results     JSONB NOT NULL DEFAULT '[]',     -- [{kr, target, current, unit}]
    quarter         VARCHAR(10),                     -- 'Q2-2026'
    progress_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE 6: EPICS, STORIES & TASKS
-- =============================================================================

CREATE TABLE epics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    status          VARCHAR(30) NOT NULL DEFAULT 'backlog'
                    CHECK (status IN ('backlog','in_progress','review','done','cancelled')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('critical','high','medium','low')),
    start_date      DATE,
    due_date        DATE,
    story_points    INT,
    completed_points INT NOT NULL DEFAULT 0,
    baseline_scope  JSONB,                           -- original scope snapshot for creep detection
    embedding       vector(1536),                    -- pgvector for semantic search
    owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    epic_id         UUID REFERENCES epics(id) ON DELETE SET NULL,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    acceptance_criteria TEXT,
    bdd_scenarios   JSONB,                           -- Gherkin-format for QA agent
    status          VARCHAR(30) NOT NULL DEFAULT 'backlog'
                    CHECK (status IN ('backlog','ready','in_progress','in_review','done','cancelled')),
    story_points    INT,
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('critical','high','medium','low')),
    story_type      VARCHAR(20) NOT NULL DEFAULT 'feature'
                    CHECK (story_type IN ('feature','bug','chore','spike','security','debt')),
    embedding       vector(1536),
    assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id        UUID REFERENCES stories(id) ON DELETE SET NULL,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id  UUID REFERENCES tasks(id) ON DELETE CASCADE,  -- subtask support
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    status          VARCHAR(30) NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo','in_progress','in_review','blocked','done','cancelled')),
    task_type       VARCHAR(20) NOT NULL DEFAULT 'task'
                    CHECK (task_type IN ('task','bug','subtask','spike','doc','test')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('critical','high','medium','low')),
    estimate_hours  NUMERIC(6,2),
    actual_hours    NUMERIC(6,2),
    story_points    INT,
    sequence_num    BIGINT,                          -- project-scoped display number
    sort_order      NUMERIC(15,5) NOT NULL DEFAULT 0, -- fractional for drag-drop ordering
    embedding       vector(1536),
    due_date        TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewer_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE task_dependencies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_id   UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) NOT NULL DEFAULT 'blocks'
                    CHECK (dependency_type IN ('blocks','is_blocked_by','relates_to','duplicates')),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, depends_on_id),
    CHECK (task_id != depends_on_id)
);

CREATE TABLE task_labels (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(80) NOT NULL,
    color           VARCHAR(7) NOT NULL DEFAULT '#6366F1',
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, name)
);

CREATE TABLE task_label_assignments (
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_id        UUID NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

CREATE TABLE task_watchers (
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, user_id)
);

CREATE TABLE task_custom_field_values (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    field_id        UUID NOT NULL REFERENCES project_custom_fields(id) ON DELETE CASCADE,
    value_text      TEXT,
    value_number    NUMERIC(18,4),
    value_date      DATE,
    value_json      JSONB,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, field_id)
);

CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES comments(id) ON DELETE CASCADE,  -- threaded replies
    author_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    body            TEXT NOT NULL,
    body_html       TEXT,
    is_agent_comment BOOLEAN NOT NULL DEFAULT FALSE,
    agent_run_id    UUID,                            -- FK set after agent_runs created
    edited_at       TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
    story_id        UUID REFERENCES stories(id) ON DELETE CASCADE,
    epic_id         UUID REFERENCES epics(id) ON DELETE CASCADE,
    uploader_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    file_name       VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    storage_key     VARCHAR(1000) NOT NULL,          -- MinIO/S3 object key
    bucket          VARCHAR(200) NOT NULL,
    url_expires_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE 7: SPRINT MANAGEMENT
-- =============================================================================

CREATE TABLE sprints (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
    name            VARCHAR(200) NOT NULL,
    goal            TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'planning'
                    CHECK (status IN ('planning','active','review','completed','cancelled')),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    capacity_points INT,
    committed_points INT NOT NULL DEFAULT 0,
    completed_points INT NOT NULL DEFAULT 0,
    velocity_actual NUMERIC(8,2),
    velocity_forecast NUMERIC(8,2),
    monte_carlo_p50 NUMERIC(8,2),                   -- Monte Carlo simulation results
    monte_carlo_p85 NUMERIC(8,2),
    monte_carlo_p95 NUMERIC(8,2),
    simulation_run_at TIMESTAMPTZ,
    retrospective_notes TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date > start_date)
);

CREATE TABLE sprint_tasks (
    sprint_id       UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    added_by        VARCHAR(20) NOT NULL DEFAULT 'human'
                    CHECK (added_by IN ('human','agent')),
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (sprint_id, task_id)
);

CREATE TABLE backlog_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id         UUID UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    story_id        UUID UNIQUE REFERENCES stories(id) ON DELETE CASCADE,
    priority_score  NUMERIC(8,4) NOT NULL DEFAULT 0, -- AI-computed priority
    backlog_type    VARCHAR(20) NOT NULL DEFAULT 'standard'
                    CHECK (backlog_type IN ('standard','icebox','technical_debt','discovery')),
    sort_order      NUMERIC(15,5) NOT NULL DEFAULT 0,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (task_id IS NOT NULL AND story_id IS NULL) OR
        (task_id IS NULL AND story_id IS NOT NULL)
    )
);

CREATE TABLE sprint_velocity_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
    sprint_id       UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    completed_points NUMERIC(8,2) NOT NULL,
    committed_points NUMERIC(8,2) NOT NULL,
    completion_rate NUMERIC(5,4),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE burndown_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sprint_id       UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    remaining_points NUMERIC(8,2) NOT NULL,
    completed_points NUMERIC(8,2) NOT NULL,
    ideal_remaining NUMERIC(8,2),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sprint_id, snapshot_date)
);

-- =============================================================================
-- MODULE 8: DEVOPS & CI/CD INTEGRATION
-- =============================================================================

CREATE TABLE integrations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    provider        VARCHAR(50) NOT NULL,            -- 'github','gitlab','jira','slack','pagerduty'
    integration_type VARCHAR(30) NOT NULL,           -- 'vcs','ci_cd','messaging','monitoring'
    display_name    VARCHAR(200),
    config          JSONB NOT NULL DEFAULT '{}',     -- webhook url, tokens (encrypted), org/repo
    credentials_encrypted TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    webhook_secret  VARCHAR(255),
    last_sync_at    TIMESTAMPTZ,
    last_error      TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pull_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    external_id     VARCHAR(100) NOT NULL,           -- GitHub PR number
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    url             VARCHAR(1000) NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','closed','merged','draft')),
    base_branch     VARCHAR(200),
    head_branch     VARCHAR(200),
    author_github   VARCHAR(100),
    author_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    lines_added     INT NOT NULL DEFAULT 0,
    lines_removed   INT NOT NULL DEFAULT 0,
    files_changed   INT NOT NULL DEFAULT 0,
    merged_at       TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (integration_id, external_id)
);

CREATE TABLE pr_task_links (
    pr_id           UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    link_type       VARCHAR(20) NOT NULL DEFAULT 'resolves'
                    CHECK (link_type IN ('resolves','references','blocks')),
    linked_by       VARCHAR(20) NOT NULL DEFAULT 'agent',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (pr_id, task_id)
);

CREATE TABLE deployments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    integration_id  UUID REFERENCES integrations(id),
    environment     VARCHAR(50) NOT NULL,            -- 'staging','production','canary'
    version         VARCHAR(200),
    commit_sha      VARCHAR(40),
    status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','success','failed','rolled_back','cancelled')),
    strategy        VARCHAR(30) NOT NULL DEFAULT 'rolling'
                    CHECK (strategy IN ('rolling','blue_green','canary','dark_launch')),
    triggered_by    VARCHAR(20) NOT NULL DEFAULT 'human'
                    CHECK (triggered_by IN ('human','agent','ci')),
    triggered_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    agent_run_id    UUID,
    deployment_url  VARCHAR(1000),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    rollback_of     UUID REFERENCES deployments(id),
    telemetry_snapshot JSONB,                       -- error rates, latency at time of eval
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cicd_pipeline_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    external_run_id VARCHAR(200) NOT NULL,
    pipeline_name   VARCHAR(200),
    status          VARCHAR(20) NOT NULL CHECK (status IN ('pending','running','success','failed','cancelled')),
    branch          VARCHAR(200),
    commit_sha      VARCHAR(40),
    duration_seconds INT,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    raw_payload     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE architectural_decision_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    adr_number      INT NOT NULL,
    title           VARCHAR(300) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed','accepted','deprecated','superseded')),
    context         TEXT,
    decision        TEXT,
    consequences    TEXT,
    superseded_by   UUID REFERENCES architectural_decision_records(id),
    embedding       vector(1536),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, adr_number)
);

-- =============================================================================
-- MODULE 9: AI AGENT REGISTRY & CONFIGURATION
-- =============================================================================

CREATE TABLE agent_types (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_key        VARCHAR(80) NOT NULL UNIQUE,     -- 'coordinator','developer','sprint_planner'
    display_name    VARCHAR(150) NOT NULL,
    description     TEXT,
    capabilities    TEXT[] NOT NULL DEFAULT '{}',
    default_model   VARCHAR(100) NOT NULL,
    fallback_model  VARCHAR(100),
    framework       VARCHAR(30) NOT NULL DEFAULT 'langgraph'
                    CHECK (framework IN ('langgraph','crewai','autogen','custom')),
    max_turns       INT NOT NULL DEFAULT 3,
    requires_hitl   BOOLEAN NOT NULL DEFAULT FALSE,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE model_registry (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_key       VARCHAR(100) NOT NULL UNIQUE,    -- 'claude-3-5-sonnet','gpt-4o','llama3-8b'
    provider        VARCHAR(30) NOT NULL,            -- 'anthropic','openai','self_hosted'
    display_name    VARCHAR(200) NOT NULL,
    context_window  INT,
    cost_per_1k_input_tokens  NUMERIC(10,6),
    cost_per_1k_output_tokens NUMERIC(10,6),
    capabilities    TEXT[] NOT NULL DEFAULT '{}',   -- 'code','reasoning','vision','function_calling'
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    api_endpoint    VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_configs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    agent_type_id   UUID NOT NULL REFERENCES agent_types(id),
    display_name    VARCHAR(200),
    primary_model_id UUID NOT NULL REFERENCES model_registry(id),
    fallback_model_id UUID REFERENCES model_registry(id),
    tools_allowed   TEXT[] NOT NULL DEFAULT '{}',   -- MCP tool names permitted
    tools_blocked   TEXT[] NOT NULL DEFAULT '{}',
    max_negotiation_turns INT NOT NULL DEFAULT 3,
    requires_hitl   BOOLEAN NOT NULL DEFAULT FALSE,
    hitl_actions    TEXT[] NOT NULL DEFAULT '{}',   -- actions that always require approval
    system_prompt_override TEXT,
    temperature     NUMERIC(3,2) NOT NULL DEFAULT 0.2,
    monthly_token_budget BIGINT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    config          JSONB NOT NULL DEFAULT '{}',
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE 10: AGENT EXECUTION & MEMORY
-- =============================================================================

CREATE TABLE agent_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    agent_config_id UUID NOT NULL REFERENCES agent_configs(id),
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    trigger_event   VARCHAR(50) NOT NULL,            -- 'pr_merged','task_created','manual','scheduled'
    trigger_entity_type VARCHAR(30),                -- 'task','sprint','pr','deployment'
    trigger_entity_id UUID,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed','cancelled','awaiting_hitl')),
    input_context   JSONB NOT NULL DEFAULT '{}',
    output_summary  TEXT,
    output_actions  JSONB NOT NULL DEFAULT '[]',
    turn_count      INT NOT NULL DEFAULT 0,
    tokens_input    INT NOT NULL DEFAULT 0,
    tokens_output   INT NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
    otel_trace_id   VARCHAR(64),
    parent_run_id   UUID REFERENCES agent_runs(id) ON DELETE SET NULL,  -- A2A sub-agent
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_run_steps (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_run_id    UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    step_number     INT NOT NULL,
    step_type       VARCHAR(30) NOT NULL
                    CHECK (step_type IN ('reasoning','tool_call','tool_result','a2a_send','a2a_receive','hitl_pause','memory_read','memory_write')),
    action_name     VARCHAR(200),
    input_payload   JSONB,
    output_payload  JSONB,
    tokens_used     INT NOT NULL DEFAULT 0,
    latency_ms      INT,
    otel_span_id    VARCHAR(32),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_negotiations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    initiator_run_id UUID NOT NULL REFERENCES agent_runs(id),
    subject         TEXT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','resolved','escalated','expired')),
    turn_count      INT NOT NULL DEFAULT 0,
    max_turns       INT NOT NULL DEFAULT 3,
    resolution      TEXT,
    escalated_to_user_id UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE TABLE agent_negotiation_turns (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negotiation_id  UUID NOT NULL REFERENCES agent_negotiations(id) ON DELETE CASCADE,
    agent_run_id    UUID NOT NULL REFERENCES agent_runs(id),
    turn_number     INT NOT NULL,
    stance          VARCHAR(20) NOT NULL CHECK (stance IN ('propose','critique','synthesize','accept','reject')),
    content         TEXT NOT NULL,
    weight_score    NUMERIC(5,4),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Memory Store (CoALA framework)
CREATE TABLE agent_memory (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    agent_config_id UUID REFERENCES agent_configs(id) ON DELETE CASCADE,
    memory_type     VARCHAR(20) NOT NULL
                    CHECK (memory_type IN ('episodic','semantic','procedural','working')),
    scope           VARCHAR(20) NOT NULL DEFAULT 'agent'
                    CHECK (scope IN ('global','org','project','agent')),
    key             VARCHAR(500) NOT NULL,
    content         TEXT NOT NULL,
    content_summary TEXT,
    embedding       vector(1536),
    importance_score NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    access_count    INT NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    source_run_id   UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prompt_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    agent_type_id   UUID REFERENCES agent_types(id),
    name            VARCHAR(200) NOT NULL,
    version         VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    template        TEXT NOT NULL,
    variables       JSONB NOT NULL DEFAULT '[]',
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    performance_score NUMERIC(5,4),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, version)
);

-- =============================================================================
-- MODULE 11: HUMAN-IN-THE-LOOP (HITL) APPROVALS
-- =============================================================================

CREATE TABLE hitl_approvals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id),
    agent_run_id    UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    requested_for   UUID REFERENCES users(id),       -- specific user, or NULL for any approver
    approver_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type     VARCHAR(80) NOT NULL,            -- 'deployment','bulk_task_update','budget_change'
    action_description TEXT NOT NULL,
    action_payload  JSONB NOT NULL DEFAULT '{}',     -- the full planned action for review
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
    rejection_reason TEXT,
    signature_hash  VARCHAR(255),                    -- cryptographic approval signature
    expires_at      TIMESTAMPTZ NOT NULL,
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

-- =============================================================================
-- MODULE 12: KNOWLEDGE BASE & DOCUMENTS
-- =============================================================================

CREATE TABLE knowledge_bases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    kb_type         VARCHAR(30) NOT NULL DEFAULT 'project'
                    CHECK (kb_type IN ('project','org','global','technical')),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id           UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    content         TEXT,
    content_html    TEXT,
    doc_type        VARCHAR(30) NOT NULL DEFAULT 'wiki'
                    CHECK (doc_type IN ('wiki','prd','adr','runbook','postmortem','template','contract')),
    status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived','auto_generated')),
    version         INT NOT NULL DEFAULT 1,
    is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    source_pr_id    UUID REFERENCES pull_requests(id),
    embedding       vector(1536),
    tags            TEXT[] NOT NULL DEFAULT '{}',
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version         INT NOT NULL,
    content         TEXT NOT NULL,
    changed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    change_summary  TEXT,
    is_ai_edit      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, version)
);

-- =============================================================================
-- MODULE 13: NOTIFICATIONS
-- =============================================================================

CREATE TABLE notification_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    channel         VARCHAR(20) NOT NULL CHECK (channel IN ('in_app','email','slack','webhook')),
    subject_template TEXT,
    body_template   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    agent_run_id    UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
    notif_type      VARCHAR(80) NOT NULL,            -- 'task_assigned','pr_review','hitl_required'
    channel         VARCHAR(20) NOT NULL DEFAULT 'in_app',
    title           VARCHAR(300) NOT NULL,
    body            TEXT,
    entity_type     VARCHAR(30),
    entity_id       UUID,
    action_url      VARCHAR(500),
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_preferences (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notif_type      VARCHAR(80) NOT NULL,
    in_app          BOOLEAN NOT NULL DEFAULT TRUE,
    email           BOOLEAN NOT NULL DEFAULT FALSE,
    slack           BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, notif_type)
);

-- =============================================================================
-- MODULE 14: ANALYTICS & REPORTING
-- =============================================================================

CREATE TABLE analytics_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id      UUID,
    event_name      VARCHAR(100) NOT NULL,
    properties      JSONB NOT NULL DEFAULT '{}',
    context         JSONB NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (occurred_at);

CREATE TABLE analytics_events_2026
    PARTITION OF analytics_events
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE analytics_events_2027
    PARTITION OF analytics_events
    FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE TABLE project_metrics_daily (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    metric_date     DATE NOT NULL,
    tasks_created   INT NOT NULL DEFAULT 0,
    tasks_completed INT NOT NULL DEFAULT 0,
    tasks_blocked   INT NOT NULL DEFAULT 0,
    prs_opened      INT NOT NULL DEFAULT 0,
    prs_merged      INT NOT NULL DEFAULT 0,
    agent_runs_count INT NOT NULL DEFAULT 0,
    agent_tokens_used BIGINT NOT NULL DEFAULT 0,
    agent_cost_usd  NUMERIC(10,4) NOT NULL DEFAULT 0,
    active_users    INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, metric_date)
);

CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(300) NOT NULL,
    report_type     VARCHAR(50) NOT NULL,
    filters         JSONB NOT NULL DEFAULT '{}',
    data_snapshot   JSONB,
    is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    generated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    scheduled_cron  VARCHAR(100),
    last_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE 15: AUDIT LOGS & SECURITY
-- =============================================================================

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    actor_type      VARCHAR(20) NOT NULL DEFAULT 'user'
                    CHECK (actor_type IN ('user','agent','system','api_key')),
    actor_id        UUID,                            -- user_id or agent_run_id
    actor_name      VARCHAR(200),
    event_category  VARCHAR(50) NOT NULL,            -- 'auth','task','agent','deployment','billing'
    event_action    VARCHAR(100) NOT NULL,           -- 'created','updated','deleted','approved'
    entity_type     VARCHAR(50),
    entity_id       UUID,
    entity_snapshot JSONB,                          -- state before change
    changes         JSONB,                           -- diff of what changed
    ip_address      INET,
    user_agent      TEXT,
    otel_trace_id   VARCHAR(64),
    severity        VARCHAR(10) NOT NULL DEFAULT 'info'
                    CHECK (severity IN ('debug','info','warning','error','critical')),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (occurred_at);

CREATE TABLE audit_logs_2026
    PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE audit_logs_2027
    PARTITION OF audit_logs
    FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE TABLE security_policies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    policy_type     VARCHAR(50) NOT NULL,            -- 'ip_allowlist','mfa_required','session_timeout'
    config          JSONB NOT NULL DEFAULT '{}',
    is_enforced     BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE abac_policies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    subject_type    VARCHAR(30) NOT NULL,            -- 'user','agent','api_key'
    action          VARCHAR(100) NOT NULL,           -- 'execute_deployment','approve_budget'
    conditions      JSONB NOT NULL DEFAULT '{}',     -- e.g. {time_window:'business_hours',ip_range:[]}
    effect          VARCHAR(10) NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow','deny')),
    priority        INT NOT NULL DEFAULT 100,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rebac_relationships (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subject_type    VARCHAR(30) NOT NULL,            -- 'user','team','agent_config'
    subject_id      UUID NOT NULL,
    relation        VARCHAR(50) NOT NULL,            -- 'owner','member','viewer','can_deploy'
    object_type     VARCHAR(30) NOT NULL,            -- 'project','sprint','deployment'
    object_id       UUID NOT NULL,
    granted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE 16: MONITORING & OBSERVABILITY
-- =============================================================================

CREATE TABLE system_health_checks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name    VARCHAR(100) NOT NULL,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('healthy','degraded','unhealthy')),
    latency_ms      INT,
    details         JSONB,
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE telemetry_metrics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    deployment_id   UUID REFERENCES deployments(id) ON DELETE CASCADE,
    metric_name     VARCHAR(200) NOT NULL,
    metric_value    NUMERIC(18,6) NOT NULL,
    unit            VARCHAR(30),
    tags            JSONB NOT NULL DEFAULT '{}',
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (recorded_at);

CREATE TABLE telemetry_metrics_2026
    PARTITION OF telemetry_metrics
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- =============================================================================
-- MODULE 17: CONFIGURATION & FEATURE FLAGS
-- =============================================================================

CREATE TABLE feature_flags (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_key        VARCHAR(200) NOT NULL UNIQUE,
    description     TEXT,
    flag_type       VARCHAR(20) NOT NULL DEFAULT 'boolean'
                    CHECK (flag_type IN ('boolean','percentage','variant','json')),
    default_value   JSONB NOT NULL DEFAULT 'false',
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    targeting_rules JSONB NOT NULL DEFAULT '[]',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE feature_flag_overrides (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_id         UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    target_type     VARCHAR(20) NOT NULL CHECK (target_type IN ('org','user','team','project')),
    target_id       UUID NOT NULL,
    value           JSONB NOT NULL,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (flag_id, target_type, target_id)
);

CREATE TABLE app_config (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key      VARCHAR(300) NOT NULL UNIQUE,
    config_value    JSONB NOT NULL,
    description     TEXT,
    is_secret       BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE 18: AI OBSERVABILITY (LANGFUSE-COMPATIBLE)
-- =============================================================================

CREATE TABLE llm_traces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_run_id    UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
    external_trace_id VARCHAR(200),
    name            VARCHAR(300),
    input           JSONB,
    output          JSONB,
    model           VARCHAR(100),
    tokens_input    INT NOT NULL DEFAULT 0,
    tokens_output   INT NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
    latency_ms      INT,
    tags            TEXT[] NOT NULL DEFAULT '{}',
    metadata        JSONB NOT NULL DEFAULT '{}',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

CREATE TABLE llm_generations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id        UUID NOT NULL REFERENCES llm_traces(id) ON DELETE CASCADE,
    name            VARCHAR(200),
    model           VARCHAR(100) NOT NULL,
    prompt          TEXT,
    completion      TEXT,
    tokens_input    INT NOT NULL DEFAULT 0,
    tokens_output   INT NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
    latency_ms      INT,
    temperature     NUMERIC(3,2),
    error           TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

-- =============================================================================
-- MODULE 19: AI FEATURES — ADVANCED
-- =============================================================================

-- Scope Creep Detector
CREATE TABLE epic_scope_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    epic_id         UUID NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    story_count     INT NOT NULL DEFAULT 0,
    total_points    INT NOT NULL DEFAULT 0,
    scope_delta_pct NUMERIC(7,4),                   -- % change vs baseline
    agent_flagged   BOOLEAN NOT NULL DEFAULT FALSE,
    flagged_run_id  UUID REFERENCES agent_runs(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (epic_id, snapshot_date)
);

-- Technical Debt Tracker
CREATE TABLE technical_debt_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
    pr_id           UUID REFERENCES pull_requests(id),
    file_path       VARCHAR(1000),
    debt_type       VARCHAR(30) NOT NULL DEFAULT 'code_smell'
                    CHECK (debt_type IN ('code_smell','duplication','architecture','test_coverage','security','performance')),
    severity        VARCHAR(10) NOT NULL DEFAULT 'medium'
                    CHECK (severity IN ('critical','high','medium','low')),
    description     TEXT NOT NULL,
    estimated_hours NUMERIC(6,2),
    is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
    detected_by     VARCHAR(20) NOT NULL DEFAULT 'agent',
    agent_run_id    UUID REFERENCES agent_runs(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sentiment Analysis
CREATE TABLE team_sentiment_readings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    team_id         UUID REFERENCES teams(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    sentiment_score NUMERIC(4,3) NOT NULL,           -- -1.0 to 1.0
    burnout_risk    VARCHAR(10) NOT NULL DEFAULT 'low'
                    CHECK (burnout_risk IN ('low','medium','high','critical')),
    source          VARCHAR(20) NOT NULL DEFAULT 'slack',
    analysis_period_start DATE NOT NULL,
    analysis_period_end   DATE NOT NULL,
    sample_size     INT NOT NULL DEFAULT 0,
    flags           JSONB NOT NULL DEFAULT '[]',
    agent_run_id    UUID REFERENCES agent_runs(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity / Event Log
CREATE TABLE activity_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    actor_type      VARCHAR(20) NOT NULL DEFAULT 'user',
    actor_id        UUID,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID NOT NULL,
    action          VARCHAR(80) NOT NULL,
    delta           JSONB,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (occurred_at);

CREATE TABLE activity_logs_2026
    PARTITION OF activity_logs
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE activity_logs_2027
    PARTITION OF activity_logs
    FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

-- =============================================================================
-- DEFERRED FOREIGN KEY RELATIONSHIPS
-- (Tables that reference each other, added after all tables exist)
-- =============================================================================

ALTER TABLE auth_sessions
    ADD CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE mfa_configurations
    ADD CONSTRAINT fk_mfa_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE password_reset_tokens
    ADD CONSTRAINT fk_prt_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE api_keys
    ADD CONSTRAINT fk_api_keys_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE api_keys
    ADD CONSTRAINT fk_api_keys_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE comments
    ADD CONSTRAINT fk_comments_agent_run
    FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE SET NULL;

ALTER TABLE deployments
    ADD CONSTRAINT fk_deployments_agent_run
    FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE SET NULL;

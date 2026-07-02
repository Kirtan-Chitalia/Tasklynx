-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- schema.sql — PostgreSQL Schema (MVP)
-- =============================================================================
-- Requires: PostgreSQL 15+, uuid-ossp
-- Run order: schema.sql → constraints.sql → indexes.sql → triggers.sql → seed.sql
--
-- This covers only the tables the running app actually uses. See CLAUDE.md for
-- the documented MVP data model.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================

CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    plan            VARCHAR(30) NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free','starter','professional','enterprise','custom')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','cancelled','trial')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- USERS & AUTH SESSIONS
-- =============================================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    display_name    VARCHAR(150) NOT NULL,
    role            VARCHAR(30) NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner','admin','manager','member','guest','service_account')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','pending','suspended')),
    password_hash   VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, email)
);

-- Not yet used by the app (auth sessions currently live in an in-memory
-- store + JWT cookie) but kept as the documented target shape for when
-- auth moves to Postgres-backed sessions.
CREATE TABLE auth_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PROJECTS
-- =============================================================================

CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(300) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    description     TEXT,
    status          VARCHAR(30) NOT NULL DEFAULT 'planning'
                    CHECK (status IN ('planning','active','on_hold','completed','archived','cancelled')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('critical','high','medium','low')),
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
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- =============================================================================
-- TASKS
-- =============================================================================

CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    status          VARCHAR(30) NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo','in_progress','in_review','done','cancelled')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('critical','high','medium','low')),
    story_points    INTEGER NOT NULL DEFAULT 3
                    CHECK (story_points IN (1,2,3,5,8,13,21)),
    due_date        TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TASK COMMENTS
-- =============================================================================

CREATE TABLE task_comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- indexes.sql — Performance Indexing Strategy
-- =============================================================================

-- AUTH & SESSIONS
CREATE INDEX idx_auth_sessions_user        ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires     ON auth_sessions(expires_at) WHERE revoked_at IS NULL;

-- ORGANIZATIONS & USERS
CREATE INDEX idx_users_org                 ON users(org_id);
CREATE INDEX idx_users_email               ON users(email);
CREATE INDEX idx_users_status              ON users(org_id, status);

-- PROJECTS
CREATE INDEX idx_projects_org              ON projects(org_id);
CREATE INDEX idx_projects_owner            ON projects(owner_id);
CREATE INDEX idx_projects_status           ON projects(org_id, status);
CREATE INDEX idx_project_members_user      ON project_members(user_id);

-- TASKS
CREATE INDEX idx_tasks_project             ON tasks(project_id);
CREATE INDEX idx_tasks_assignee            ON tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_tasks_status              ON tasks(project_id, status);
CREATE INDEX idx_tasks_priority            ON tasks(project_id, priority);
CREATE INDEX idx_tasks_due_date            ON tasks(due_date) WHERE due_date IS NOT NULL AND status != 'done';
CREATE INDEX idx_tasks_created_at          ON tasks(project_id, created_at DESC);

-- TASK COMMENTS
CREATE INDEX idx_task_comments_task        ON task_comments(task_id, created_at);

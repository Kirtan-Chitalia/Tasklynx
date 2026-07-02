-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- constraints.sql — Business Rule Constraints
-- =============================================================================

ALTER TABLE users
    ADD CONSTRAINT chk_user_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

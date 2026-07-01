-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- init.sql — PostgreSQL Docker Initialization Master Script
-- =============================================================================
-- This file is mounted at /docker-entrypoint-initdb.d/00_init.sql
-- PostgreSQL executes all .sql files in /docker-entrypoint-initdb.d/ alphabetically.
--
-- Execution order:
--   00_init.sql      ← this file (extensions + orchestration)
--   01_schema.sql    ← all CREATE TABLE statements
--   02_constraints.sql ← business rule constraints
--   03_indexes.sql   ← performance indexes
--   04_triggers.sql  ← automation triggers
--   05_functions.sql ← stored functions
--   06_views.sql     ← views and materialized views
--   07_seed.sql      ← reference data
-- =============================================================================

\echo '========================================================'
\echo ' AI-Native PM Platform — Database Initialization'
\echo '========================================================'

-- Create application database roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_api') THEN
        CREATE ROLE app_api LOGIN PASSWORD 'change_in_production';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_agent') THEN
        CREATE ROLE app_agent LOGIN PASSWORD 'change_in_production';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_readonly') THEN
        CREATE ROLE app_readonly LOGIN PASSWORD 'change_in_production';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_migrations') THEN
        CREATE ROLE app_migrations LOGIN PASSWORD 'change_in_production';
    END IF;
END
$$;

-- Grant privileges after tables exist (called at end of init chain)
-- These are included here as a reference; executed via 08_grants.sql

\echo 'Extensions and roles created. Proceeding to schema...'

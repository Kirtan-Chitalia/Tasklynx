-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- init.sql — PostgreSQL Docker Initialization
-- =============================================================================
-- This file is mounted at /docker-entrypoint-initdb.d/00_init.sql
-- PostgreSQL executes all .sql files in /docker-entrypoint-initdb.d/ alphabetically.
--
-- Execution order:
--   00_init.sql       ← this file (banner)
--   01_schema.sql     ← CREATE TABLE statements
--   02_constraints.sql ← business rule constraints
--   03_indexes.sql    ← performance indexes
--   04_triggers.sql   ← updated_at triggers
--   05_seed.sql       ← reference data
-- =============================================================================

\echo '========================================================'
\echo ' PM Platform — Database Initialization'
\echo '========================================================'

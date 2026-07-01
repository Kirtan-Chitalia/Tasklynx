-- =============================================================================
-- AI-NATIVE PROJECT MANAGEMENT PLATFORM
-- seed.sql — Reference Data & System Bootstrapping
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. AUTH PROVIDERS
-- -----------------------------------------------------------------------------
INSERT INTO auth_providers (id, name, is_active, config) VALUES
    ('00000000-0000-0000-0000-000000000001', 'local',   TRUE, '{}'),
    ('00000000-0000-0000-0000-000000000002', 'google',  TRUE, '{"oauth_endpoint":"https://accounts.google.com"}'),
    ('00000000-0000-0000-0000-000000000003', 'github',  TRUE, '{"oauth_endpoint":"https://github.com/login/oauth"}'),
    ('00000000-0000-0000-0000-000000000004', 'saml',    FALSE,'{}'),
    ('00000000-0000-0000-0000-000000000005', 'oidc',    FALSE,'{}')
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. MODEL REGISTRY
-- -----------------------------------------------------------------------------
INSERT INTO model_registry (model_key, provider, display_name, context_window,
    cost_per_1k_input_tokens, cost_per_1k_output_tokens, capabilities, is_active)
VALUES
    -- Anthropic
    ('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', 200000,
     0.003000, 0.015000, ARRAY['code','reasoning','vision','function_calling'], TRUE),
    ('claude-3-haiku-20240307', 'anthropic', 'Claude 3 Haiku', 200000,
     0.000250, 0.001250, ARRAY['code','fast','function_calling'], TRUE),
    -- OpenAI
    ('gpt-4o', 'openai', 'GPT-4o', 128000,
     0.002500, 0.010000, ARRAY['reasoning','vision','function_calling'], TRUE),
    ('gpt-4o-mini', 'openai', 'GPT-4o Mini', 128000,
     0.000150, 0.000600, ARRAY['fast','function_calling'], TRUE),
    -- Google
    ('gemini-1-5-pro', 'google', 'Gemini 1.5 Pro', 1000000,
     0.001250, 0.005000, ARRAY['reasoning','vision','long_context'], TRUE),
    -- Self-hosted
    ('llama-3-8b-local', 'self_hosted', 'Llama 3 8B (Local)', 8192,
     0.000050, 0.000050, ARRAY['fast','triage','routing'], TRUE),
    ('llama-3-70b-local', 'self_hosted', 'Llama 3 70B (Local)', 8192,
     0.000200, 0.000200, ARRAY['code','reasoning'], TRUE)
ON CONFLICT (model_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. AGENT TYPES
-- -----------------------------------------------------------------------------
INSERT INTO agent_types (type_key, display_name, description, capabilities,
    default_model, fallback_model, framework, max_turns, requires_hitl, is_system)
VALUES
    ('coordinator', 'Coordinator Agent',
     'Central orchestrator: decomposes intents, routes to specialized agents via A2A',
     ARRAY['intent_detection','task_routing','a2a_communication','escalation'],
     'claude-3-5-sonnet-20241022', 'gpt-4o', 'langgraph', 5, TRUE, TRUE),

    ('developer', 'Developer Agent',
     'Monitors PRs, auto-updates ticket status, links commits, performs code triage',
     ARRAY['github_access','pr_review','task_status_update','code_analysis'],
     'claude-3-5-sonnet-20241022', 'llama-3-8b-local', 'langgraph', 3, FALSE, TRUE),

    ('sprint_planner', 'Sprint Planning Agent',
     'Analyzes backlog, velocity, and PTO to propose optimal sprint configurations',
     ARRAY['sprint_simulation','velocity_analysis','capacity_planning','backlog_scoring'],
     'gpt-4o', 'claude-3-5-sonnet-20241022', 'langgraph', 3, TRUE, TRUE),

    ('qa', 'QA Agent',
     'Reads user stories, generates and runs test scripts, creates defect reports',
     ARRAY['test_generation','cypress_playwright','ci_access','defect_analysis'],
     'claude-3-5-sonnet-20241022', 'gpt-4o-mini', 'langgraph', 3, FALSE, TRUE),

    ('devops', 'DevOps Deployment Agent',
     'Monitors CI/CD pipelines, orchestrates deployments, triggers rollbacks',
     ARRAY['kubernetes_access','pagerduty','deployment_management','telemetry_analysis'],
     'gemini-1-5-pro', 'gpt-4o', 'langgraph', 3, TRUE, TRUE),

    ('product', 'Product Agent',
     'Generates PRDs, breaks epics into stories, conducts stakeholder synthesis',
     ARRAY['prd_generation','story_breakdown','stakeholder_synthesis','slack_read'],
     'claude-3-5-sonnet-20241022', 'gpt-4o', 'langgraph', 5, TRUE, TRUE),

    ('security', 'Security Audit Agent',
     'Evaluates tasks and PRs for compliance and security risks before work begins',
     ARRAY['code_scanning','compliance_check','risk_assessment','vulnerability_detection'],
     'claude-3-5-sonnet-20241022', 'llama-3-70b-local', 'langgraph', 3, TRUE, TRUE),

    ('analytics', 'Analytics Agent',
     'Aggregates multi-project metrics for executive dashboards and stakeholder reports',
     ARRAY['metric_aggregation','report_generation','okr_alignment','erp_access'],
     'gpt-4o', 'claude-3-5-sonnet-20241022', 'langgraph', 2, FALSE, TRUE),

    ('documentation', 'Documentation Agent',
     'Rewrites wikis and ADRs when PRs merge; ensures code-doc synchronization',
     ARRAY['wiki_update','adr_generation','github_read','knowledge_base_write'],
     'claude-3-5-sonnet-20241022', 'gpt-4o-mini', 'langgraph', 3, FALSE, TRUE),

    ('triage', 'Triage Agent',
     'Categorizes, labels, and routes incoming bugs using semantic similarity',
     ARRAY['issue_classification','semantic_search','label_assignment','routing'],
     'llama-3-8b-local', 'claude-3-5-sonnet-20241022', 'langgraph', 2, FALSE, TRUE),

    ('sentiment', 'Sentiment Analysis Agent',
     'Monitors communication channels for team burnout and morale signals',
     ARRAY['slack_read','sentiment_analysis','burnout_detection','flag_generation'],
     'gpt-4o-mini', 'llama-3-8b-local', 'langgraph', 2, FALSE, TRUE)
ON CONFLICT (type_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. FEATURE FLAGS (platform defaults)
-- -----------------------------------------------------------------------------
INSERT INTO feature_flags (flag_key, description, flag_type, default_value, is_active) VALUES
    ('agent_coordinator_enabled',      'Enable Coordinator Agent globally',           'boolean', 'true',  TRUE),
    ('agent_developer_enabled',        'Enable Developer Agent (PR auto-sync)',        'boolean', 'true',  TRUE),
    ('agent_sprint_planner_enabled',   'Enable Sprint Planning Agent',                 'boolean', 'true',  TRUE),
    ('agent_qa_enabled',               'Enable QA Agent (test generation)',            'boolean', 'false', TRUE),
    ('agent_devops_enabled',           'Enable DevOps Deployment Agent',               'boolean', 'false', TRUE),
    ('agent_security_enabled',         'Enable Security Audit Agent',                  'boolean', 'false', TRUE),
    ('agent_sentiment_enabled',        'Enable Sentiment Analysis Agent',              'boolean', 'false', TRUE),
    ('hitl_deployment_required',       'Always require HITL for production deploys',   'boolean', 'true',  TRUE),
    ('hitl_bulk_task_required',        'Require HITL for bulk task changes >10 items', 'boolean', 'true',  TRUE),
    ('vector_store_pgvector',          'Use pgvector for semantic memory (<5M vecs)',   'boolean', 'true',  TRUE),
    ('vector_store_qdrant',            'Use Qdrant for high-scale tenants (>5M vecs)', 'boolean', 'false', TRUE),
    ('monte_carlo_simulation',         'Enable Monte Carlo sprint simulations',         'boolean', 'true',  TRUE),
    ('dialectical_negotiation',        'Enable agent Dialectical Negotiation Protocol','boolean', 'true',  TRUE),
    ('scope_creep_detection',          'Enable Scope Creep Detector',                  'boolean', 'true',  TRUE),
    ('technical_debt_predictor',       'Enable Technical Debt Predictor',              'boolean', 'true',  TRUE),
    ('a2a_external_agents',            'Phase 3: Allow A2A with external agents',      'boolean', 'false', FALSE),
    ('holonic_agent_structures',       'Phase 3: Allow holonic sub-agent spawning',    'boolean', 'false', FALSE)
ON CONFLICT (flag_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. APP CONFIG (platform defaults)
-- -----------------------------------------------------------------------------
INSERT INTO app_config (config_key, config_value, description, is_secret) VALUES
    ('agent.max_negotiation_turns',     '3',           'Default max agent negotiation cycles', FALSE),
    ('agent.default_temperature',       '0.2',         'Default LLM temperature for agents',   FALSE),
    ('agent.cost_alert_threshold_usd',  '50',          'Monthly cost alert per org (USD)',      FALSE),
    ('sprint.default_duration_days',    '14',          'Default sprint duration in days',        FALSE),
    ('sprint.monte_carlo_simulations',  '10000',       'Monte Carlo iteration count',           FALSE),
    ('vector.pgvector_threshold',       '5000000',     'Switch to Qdrant above this many vecs', FALSE),
    ('vector.embedding_model',          '"text-embedding-3-small"', 'Default embedding model',  FALSE),
    ('vector.embedding_dimensions',     '1536',        'Embedding vector dimensions',           FALSE),
    ('hitl.default_expiry_hours',       '24',          'Hours before HITL request expires',     FALSE),
    ('audit.retention_years',           '7',           'Audit log retention period in years',   FALSE)
ON CONFLICT (config_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. NOTIFICATION TEMPLATES
-- -----------------------------------------------------------------------------
INSERT INTO notification_templates (name, channel, subject_template, body_template) VALUES
    ('hitl_required', 'in_app',
     'Action requires your approval',
     'Agent {{agent_name}} is requesting approval to: {{action_description}}. Expires in {{expires_in}} hours.'),
    ('task_assigned', 'in_app',
     NULL,
     'You have been assigned to task: {{task_title}} in {{project_name}}'),
    ('pr_linked', 'in_app',
     NULL,
     'Pull request #{{pr_number}} has been automatically linked to task {{task_title}}'),
    ('sprint_simulation_ready', 'in_app',
     NULL,
     'Sprint simulation complete. P50: {{p50}} pts, P85: {{p85}} pts. Review before committing.'),
    ('scope_creep_detected', 'in_app',
     NULL,
     'Epic "{{epic_title}}" has grown {{delta_pct}}% beyond baseline scope.'),
    ('deployment_success', 'in_app',
     NULL,
     'Deployment of {{version}} to {{environment}} completed successfully.'),
    ('deployment_rollback', 'in_app',
     NULL,
     'Deployment to {{environment}} was automatically rolled back due to telemetry anomalies.'),
    ('agent_cost_alert', 'email',
     'AI Cost Alert: {{org_name}} approaching monthly budget',
     'Your organization has used {{cost_usd}} of its {{budget_usd}} monthly AI credit budget.')
ON CONFLICT DO NOTHING;

COMMIT;

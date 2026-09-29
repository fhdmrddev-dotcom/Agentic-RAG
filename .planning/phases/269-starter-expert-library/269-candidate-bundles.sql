-- 269 — CANDIDATE starter Expert bundles (PACK-26). STAGING ARTIFACT — NOT A MIGRATION.
--
-- RESEARCH Pattern 2 (candidate -> prove -> promote). The Phase 266 install path can only install
-- a bundle that already exists as a row, yet D-269-09 admits a row into the seeding migration only
-- after its live proof. So the exact statements migration 198 will carry are staged HERE, outside
-- supabase/migrations/, and:
--   1. the operator pastes this file into the LOCAL Supabase SQL editor in 269-03 (idempotent upserts),
--   2. each Expert is installed through POST /experts/{id}/install and driven live (269-03),
--   3. 269-04 promotes ONLY the proven rows, VERBATIM, into
--      supabase/migrations/198_starter_expert_library.sql (D-269-09: ship fewer, never weaken).
-- No applied migration is ever edited after a failed drive (the Phase 163 anti-pattern).
--
-- Shape (pinned by backend/tests/unit/test_269_bundle_sql_shape.py):
--   * org-portable: org_id NULL, is_system true, sentinel author, fixed ids ...2691-...2694 (D-269-07)
--   * plain Install cards: restricted, no member skills, no required connections (D-269-06)
--   * example_output cites ONLY figures present in that Expert's own corpus (M-10)
--   * the Financial Analyzer UPDATE replaces its uncitable 189 copy (D-269-P2)
-- Text traps (Pitfall 6): apostrophes doubled, no double-hyphen and no semicolon inside any literal.
-- Copy borrows only the identity + success-metric SHAPE of agency-agents, never its text (D-269-03).

BEGIN;

INSERT INTO public.expert_bundles (
    id,
    org_id,
    created_by,
    name,
    slug,
    description,
    scope_mode,
    member_skills,
    required_connections,
    knowledge_folder_ids,
    prompt_suggestions,
    visibility,
    is_system,
    is_enabled,
    icon,
    category,
    when_to_use,
    example_output
) VALUES (
    '00000000-0000-0000-0000-000000002691'::uuid,
    NULL,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Contract Reviewer',
    'contract-reviewer',
    'Reviews ACME Corporation''s sample contracts and renewal schedule: liability caps, termination rights, notice windows and renewal dates. Answers from its installed ACME sample documents, citing the clause, or says it cannot find the answer.',
    'restricted',
    '{}'::text[],
    '{}'::text[],
    '{}'::uuid[],
    $json$[
        {
            "title": "Liability Cap",
            "prompt": "What is the liability cap in ACME's master services agreement with Kestrel Freight Partners? Cite the clause."
        },
        {
            "title": "Termination Notice",
            "prompt": "How much notice does ACME need to give to terminate the Kestrel Freight master services agreement for convenience?"
        },
        {
            "title": "Upcoming Renewals",
            "prompt": "List the agreements in ACME's renewal schedule that renew automatically, with their renewal dates and notice windows."
        }
    ]$json$::jsonb,
    'public',
    true,
    true,
    'scale',
    'Legal',
    'When you need a commercial term from a contract (a liability cap, a termination right, a notice window or a renewal date) with the clause it came from.',
    'Liability cap: $2.35M aggregate (Kestrel Freight MSA, Key Commercial Terms)' || E'\n' || 'Termination for convenience: 75 days written notice' || E'\n' || 'Every figure is quoted with the agreement and clause it came from.'
)
ON CONFLICT (slug) WHERE is_system = true DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope_mode = EXCLUDED.scope_mode,
    prompt_suggestions = EXCLUDED.prompt_suggestions,
    visibility = EXCLUDED.visibility,
    is_enabled = EXCLUDED.is_enabled,
    icon = EXCLUDED.icon,
    category = EXCLUDED.category,
    when_to_use = EXCLUDED.when_to_use,
    example_output = EXCLUDED.example_output,
    updated_at = now();

INSERT INTO public.expert_bundles (
    id,
    org_id,
    created_by,
    name,
    slug,
    description,
    scope_mode,
    member_skills,
    required_connections,
    knowledge_folder_ids,
    prompt_suggestions,
    visibility,
    is_system,
    is_enabled,
    icon,
    category,
    when_to_use,
    example_output
) VALUES (
    '00000000-0000-0000-0000-000000002692'::uuid,
    NULL,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'HR Policy Advisor',
    'hr-policy-advisor',
    'Answers questions about ACME Corporation''s sample employee handbook and learning and expense policy: time off, parental leave, eligibility, stipends and travel limits. Answers from its installed ACME sample documents, citing the policy section, or says it cannot find the answer.',
    'restricted',
    '{}'::text[],
    '{}'::text[],
    '{}'::uuid[],
    $json$[
        {
            "title": "Parental Leave",
            "prompt": "How many weeks of paid parental leave does ACME offer, and who is eligible?"
        },
        {
            "title": "Paid Time Off",
            "prompt": "What is ACME's paid-time-off allowance for full-time employees, and can unused days carry over?"
        },
        {
            "title": "Learning Stipend",
            "prompt": "How much is ACME's annual learning stipend, and what are the travel expense limits?"
        }
    ]$json$::jsonb,
    'public',
    true,
    true,
    'book',
    'HR',
    'When you need a policy answer from the employee handbook or the learning and expense policy, with the section it came from.',
    'Paid parental leave: 18 weeks (Employee Handbook, Leave & Time Off)' || E'\n' || 'Annual paid time off, full-time: 23 days' || E'\n' || 'Every answer names the policy section it came from.'
)
ON CONFLICT (slug) WHERE is_system = true DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope_mode = EXCLUDED.scope_mode,
    prompt_suggestions = EXCLUDED.prompt_suggestions,
    visibility = EXCLUDED.visibility,
    is_enabled = EXCLUDED.is_enabled,
    icon = EXCLUDED.icon,
    category = EXCLUDED.category,
    when_to_use = EXCLUDED.when_to_use,
    example_output = EXCLUDED.example_output,
    updated_at = now();

INSERT INTO public.expert_bundles (
    id,
    org_id,
    created_by,
    name,
    slug,
    description,
    scope_mode,
    member_skills,
    required_connections,
    knowledge_folder_ids,
    prompt_suggestions,
    visibility,
    is_system,
    is_enabled,
    icon,
    category,
    when_to_use,
    example_output
) VALUES (
    '00000000-0000-0000-0000-000000002693'::uuid,
    NULL,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Security & Compliance Advisor',
    'security-compliance',
    'Answers questions about ACME Corporation''s sample incident response policy and quarterly control test results: notification obligations, recovery objectives, control outcomes and remediation owners. Answers from its installed ACME sample documents, citing the policy or test record, or says it cannot find the answer.',
    'restricted',
    '{}'::text[],
    '{}'::text[],
    '{}'::uuid[],
    $json$[
        {
            "title": "Incident Notification",
            "prompt": "How quickly must ACME notify affected customers after a confirmed security incident?"
        },
        {
            "title": "Q3 Control Results",
            "prompt": "How many controls passed ACME's Q3 2026 control testing, which ones failed, and who owns the remediation?"
        },
        {
            "title": "Recovery Objectives",
            "prompt": "What are the recovery time and recovery point objectives in ACME's incident response policy?"
        }
    ]$json$::jsonb,
    'public',
    true,
    true,
    'shield',
    'Compliance',
    'When you need an obligation from the incident response policy or an outcome from the quarterly control tests, with the record it came from.',
    'Customer notification after a confirmed incident: within 36 hours (Incident Response Policy)' || E'\n' || 'Q3 control testing: 14 of 16 controls passed' || E'\n' || 'Failed controls are listed with their remediation owners and due dates.'
)
ON CONFLICT (slug) WHERE is_system = true DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope_mode = EXCLUDED.scope_mode,
    prompt_suggestions = EXCLUDED.prompt_suggestions,
    visibility = EXCLUDED.visibility,
    is_enabled = EXCLUDED.is_enabled,
    icon = EXCLUDED.icon,
    category = EXCLUDED.category,
    when_to_use = EXCLUDED.when_to_use,
    example_output = EXCLUDED.example_output,
    updated_at = now();

INSERT INTO public.expert_bundles (
    id,
    org_id,
    created_by,
    name,
    slug,
    description,
    scope_mode,
    member_skills,
    required_connections,
    knowledge_folder_ids,
    prompt_suggestions,
    visibility,
    is_system,
    is_enabled,
    icon,
    category,
    when_to_use,
    example_output
) VALUES (
    '00000000-0000-0000-0000-000000002694'::uuid,
    NULL,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Operations Analyst',
    'operations-analyst',
    'Analyzes ACME Corporation''s sample supplier scorecard and fulfilment and inventory report: on-time delivery, supplier lead times, spend concentration, backorders and stock cover. Answers from its installed ACME sample documents, citing the report, or says it cannot find the answer.',
    'restricted',
    '{}'::text[],
    '{}'::text[],
    '{}'::uuid[],
    $json$[
        {
            "title": "On-Time Delivery",
            "prompt": "What was ACME's on-time delivery rate in Q3 2026?"
        },
        {
            "title": "Supplier Lead Times",
            "prompt": "Compare ACME's three Tier-1 suppliers on lead time and share of spend in a table, citing the scorecard."
        },
        {
            "title": "Inventory Health",
            "prompt": "Summarize ACME's Q3 2026 inventory position, including weeks of cover and stock-outs."
        }
    ]$json$::jsonb,
    'public',
    true,
    true,
    'truck',
    'Operations',
    'When you need a delivery, supplier or inventory figure from the quarterly operations reports, with the table it came from.',
    'On-time delivery rate: 94.7% (Fulfilment KPIs)' || E'\n' || 'Average Tier-1 supplier lead time: 38 days (Supplier Scorecard)' || E'\n' || 'Every figure is quoted with the report table it came from.'
)
ON CONFLICT (slug) WHERE is_system = true DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope_mode = EXCLUDED.scope_mode,
    prompt_suggestions = EXCLUDED.prompt_suggestions,
    visibility = EXCLUDED.visibility,
    is_enabled = EXCLUDED.is_enabled,
    icon = EXCLUDED.icon,
    category = EXCLUDED.category,
    when_to_use = EXCLUDED.when_to_use,
    example_output = EXCLUDED.example_output,
    updated_at = now();

-- D-269-P2 (operator ruling) — the Financial Analyzer's 189 example_output and its third 187 prompt
-- advertised figures its corpus contradicts or cannot support. Replaced with corpus figures
-- (EBITDA margin, the YoY bps change, operating cash flow, the international revenue share) and a
-- year-over-year comparison. The first two 187 suggestions are carried VERBATIM.
UPDATE public.expert_bundles
SET example_output = 'EBITDA Margin: 30.8% (+380 bps YoY)' || E'\n' || 'Operating Cash Flow: $29.1M' || E'\n' || 'Key Risks: supply-chain concentration in three Tier-1 Southeast Asia suppliers, and foreign-currency volatility (~42% of revenue international).',
    prompt_suggestions = $json$[
        {
            "title": "Summarize 10-K Risks",
            "prompt": "Extract and synthesize the top 3 risk factors disclosed in the latest 10-K filing with direct citations."
        },
        {
            "title": "Calculate EBITDA & Margin",
            "prompt": "Calculate the EBITDA and EBITDA margin from the income statement, showing all intermediate arithmetic."
        },
        {
            "title": "Compare Year-over-Year Results",
            "prompt": "Compare Q3 2026 with Q3 2025 for total revenue, gross profit and operating income in a table, citing the report."
        }
    ]$json$::jsonb,
    updated_at = now()
WHERE slug = 'financial-analyzer' AND is_system = true;

COMMIT;

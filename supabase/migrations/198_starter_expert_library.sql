-- 198 — Phase 269 (PACK-26, PACK-27, D-269-07, D-269-09, D-269-P2)
-- Data:  public.expert_bundles — the starter Expert library, proven live before it was seeded
--
-- WHAT. Three new first-party starter Experts (Contract Reviewer …2691, HR Policy Advisor …2692,
-- Operations Analyst …2694) plus the Financial Analyzer (…0259, shipped by migration 187) copy fix.
-- Every statement below is copied VERBATIM from the staging artifact
-- .planning/phases/269-starter-expert-library/269-candidate-bundles.sql, which is the exact text
-- that was applied locally and driven live in plan 269-03. Nothing here was edited after the drive.
--
-- D-269-07 — ORG-PORTABLE SEED. Every row is org_id NULL, is_system true, authored by the sentinel
-- user …0001; no organisation id appears anywhere in this file (the migration 193 lesson). This
-- migration seeds BUNDLES ONLY. Each Expert's knowledge stays as repo files under
-- backend/app/experts/corpora/<slug>/ and reaches an org ONLY through POST /experts/{id}/install
-- (the Phase 266 path, no Expert-specific code — D-269-08). A fresh org therefore sees each Expert as
-- an Install card, never as pre-populated knowledge.
--
-- D-269-09 — HELD BACK UNTIL PROVEN. A row is here only because its newest install, cited and refusal
-- transcripts all end VERDICT: PASS (gated by backend/tests/unit/test_269_starter_evidence_gate.py):
--   contract-reviewer   evidence/04-contract-reviewer-{install,cited,refusal}.txt
--   hr-policy-advisor   evidence/05-hr-policy-advisor-{install,cited,refusal}.txt
--   operations-analyst  evidence/07-operations-analyst-{install,cited,refusal}.txt
--   financial-analyzer  evidence/03-financial-analyzer-{install,cited,refusal}.txt  (UPDATE only)
-- HELD BACK and deliberately ABSENT: security-compliance (its refusal turn FAILed — query_documents
-- returned a sibling-folder document, evidence/06-security-compliance-refusal.txt). Its candidate row
-- is not promoted and its corpus directory is not shipped. The library ships four, not five
-- (operator lock recorded in 269-UAT-LOG.md, "Operator lock (269-04 Task 1)").
--
-- D-269-P2 — the Financial Analyzer's example_output and third prompt suggestion advertised figures
-- (24.3% / $412M, a quarter-over-quarter comparison) its own corpus contradicts or cannot support.
-- The UPDATE replaces them with figures the corpus carries (30.8%, +380 bps, $29.1M, ~42%).
--
-- ⚠ DEPLOY ORDER (RESEARCH Pitfall 3 / M-12). The backend image that carries
-- backend/app/experts/corpora/<slug>/ for every slug inserted here MUST be live BEFORE this migration
-- is applied to an environment. Applied first, each new Expert appears in the catalog with Start Chat
-- and NO Install button, because the installer finds no corpus for its slug.
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: every INSERT is an upsert on the is_system slug
-- index, and the UPDATE is a fixed-value overwrite — safe to paste twice, and safe over the candidate
-- rows already applied locally in 269-03.
-- ============================================================================

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

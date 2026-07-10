-- 094_starter_workflows.sql
-- Phase 143 / WF-01: the 3 curated Starter workflow definitions (the Starters shelf).
--
-- Ships 3 global, published, immutable starter definitions the user forks into a
-- personal copy. Each carries definition.category='starter' — the D-143-2 curation
-- marker the Starters-shelf query reads (definition->>'category'='starter'). Mirrors
-- the mig 061 is_global seed-INSERT pattern:
--
--   risk-register           : llm_agent(search_documents) -> llm_emit(render_template)
--   weekly-status-report    : llm_agent(search_documents) -> llm_emit(render_template)
--   compliance-gap-report   : llm_agent(search_documents) -> llm_emit(render_template)  (fresh)
--
-- Seed-row column set mirrors 061:
--   status='published'  (the 056 block-published trigger then freezes it)
--   created_by = '00000000-0000-0000-0000-000000000001'  (seed system user — already
--     present from mig 056/061; NOT re-inserted here)
--   is_global = true    (RLS forbids users self-setting it — only seed migrations)
--   definition = the FULL WorkflowDefinition JSONB (with category='starter')
--
-- PROMOTE = TRANSFORM, NOT a verbatim copy (D-143-4b / Pitfall 1). vs the operator's
-- private pm-pack source rows, every def here:
--   (1) adds top-level "category":"starter";
--   (2) OMITS the private project-folder binding AND every per-phase KB scope entirely
--       — so retrieval runs over the FORKER's own knowledge base, never the operator's
--       private "PM Demo Project" folder (a private id would retrieve zero evidence and
--       the strict citation gate would fail every forker's run);
--   (3) re-homes each assets[].asset_id to the seed-user Storage prefix
--       00000000-0000-0000-0000-000000000001/_library/<slug>.docx (uploaded by
--       scripts/seed-starters.py — a SQL migration cannot place Storage bytes);
--   (4) keeps the strict gate on the emit phase (citation_policy/integrity_policy strict +
--       citations_required(fail_run) + output_file_valid(fail_run)) — D-143-7: an honest
--       failure over a fabricated deliverable.
--
-- DISTINCT SLUGS: risk-register / weekly-status-report / compliance-gap-report — NOT the
-- operator's pm-* source slugs. UNIQUE(slug, version) is GLOBAL (mig 056); seeding the
-- pm-* slugs would collide with the operator's existing rows (ON CONFLICT (id) does NOT
-- catch a slug/version conflict).
--
-- Idempotent: each INSERT has a FIXED uuid (00000000-...-00c1/c2/c3) + ON CONFLICT (id)
-- DO NOTHING — re-applying is a no-op (never UPDATE a published row: the immutability
-- trigger raises 23514).
--
-- APPLY DISCIPLINE (CLAUDE.md): apply this file by pasting it into the Supabase SQL
-- editor for the local project — never via the destructive CLI sync/reset commands (they
-- wipe dev data). After it applies, regenerate the bootstrap artifact with
-- `bash scripts/regenerate-full-schema.sh` (live-DB dump, NO reset). Filename has no
-- letter suffix (a suffix is silently skipped by the Supabase CLI).

-- ============================================================
-- Starter 1 — Risk Register (promoted from the pm-risk-register source, TRANSFORMED)
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000c1',
  'risk-register', 1, 'Risk Register', 'published',
  '{
    "slug": "risk-register",
    "version": 1,
    "name": "Risk Register",
    "status": "published",
    "category": "starter",
    "business_requirement": "Produce a cited project risk register from your knowledge base: one row per identified risk with id, description, category, probability, impact, owner, mitigation, and status. Every cell must be grounded in the knowledge base. The Score is computed by the template (probability x impact); leave any cell null where the sources do not support a value.",
    "phases": [
      {
        "slug": "retrieve",
        "phase_index": 0,
        "config": {
          "phase_type": "llm_agent",
          "prompt": "Search the knowledge base for all identified project risks. For each risk gather its description, category, probability, impact, owner, mitigation, and current status, with the source passages that support each field.",
          "available_tools": ["search_documents"]
        },
        "validators": []
      },
      {
        "slug": "emit",
        "phase_index": 1,
        "config": {
          "phase_type": "llm_emit",
          "emitter": "render_template",
          "prompt": "Fill the risk-register template rows from the retrieved knowledge-base evidence: one row per risk with the 8 cited columns (id, description, category, probability, impact, owner, mitigation, status). Cite every non-null cell against its source chunk; set a cell to null where the sources do not support it. Do NOT emit a Score: the template computes it (probability x impact) from the cited cells.",
          "citation_policy": "strict",
          "integrity_policy": "strict"
        },
        "validators": [
          {"kind": "citations_required", "config": {"mode": "deterministic"}, "on_failure": "fail_run"},
          {"kind": "output_file_valid", "config": {}, "on_failure": "fail_run"}
        ]
      }
    ],
    "assets": [
      {
        "asset_id": "00000000-0000-0000-0000-000000000001/_library/risk-register.docx",
        "filename": "risk-register.docx",
        "kind": "template",
        "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Starter 2 — Weekly Status Report (promoted from the pm-weekly-status-report source, TRANSFORMED)
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000c2',
  'weekly-status-report', 1, 'Weekly Status Report', 'published',
  '{
    "slug": "weekly-status-report",
    "version": 1,
    "name": "Weekly Status Report",
    "status": "published",
    "category": "starter",
    "business_requirement": "Produce a cited weekly status report from your knowledge base with overall RAG status, accomplishments this period, planned work next period, risks and blockers, and key milestones. Every reported value must be grounded in your knowledge base; leave a value null where the sources do not support it.",
    "phases": [
      {
        "slug": "retrieve",
        "phase_index": 0,
        "config": {
          "phase_type": "llm_agent",
          "prompt": "Search the knowledge base for the latest reporting-period status: accomplishments, planned next steps, risks and blockers, milestones, and the overall RAG status. Gather the source passages that support each value the status report will fill.",
          "available_tools": ["search_documents"]
        },
        "validators": []
      },
      {
        "slug": "emit",
        "phase_index": 1,
        "config": {
          "phase_type": "llm_emit",
          "emitter": "render_template",
          "prompt": "Fill the weekly-status-report template from the retrieved knowledge-base evidence. Cite every non-null value against its source chunk; set a value to null where the sources do not support it. Do not invent values.",
          "citation_policy": "strict",
          "integrity_policy": "strict"
        },
        "validators": [
          {"kind": "citations_required", "config": {"mode": "deterministic"}, "on_failure": "fail_run"},
          {"kind": "output_file_valid", "config": {}, "on_failure": "fail_run"}
        ]
      }
    ],
    "assets": [
      {
        "asset_id": "00000000-0000-0000-0000-000000000001/_library/weekly-status-report.docx",
        "filename": "weekly-status-report.docx",
        "kind": "template",
        "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Starter 3 — Compliance Gap Report (authored FRESH, RESEARCH 331-347)
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000c3',
  'compliance-gap-report', 1, 'Compliance Gap Report', 'published',
  '{
    "slug": "compliance-gap-report",
    "version": 1,
    "name": "Compliance Gap Report",
    "status": "published",
    "category": "starter",
    "business_requirement": "Produce a cited compliance gap report from the knowledge base: one row per obligation with its source clause, current state, gap, severity, and owner. Every cell must be grounded in the knowledge base; leave a cell null where the sources do not support it.",
    "phases": [
      {
        "slug": "retrieve",
        "phase_index": 0,
        "config": {
          "phase_type": "llm_agent",
          "prompt": "Search the knowledge base for stated compliance obligations (policies, controls, regulatory clauses) and the evidence of whether each is met. For each obligation gather: requirement, source clause, current state, gap description, severity, and owner, with the source passages supporting each.",
          "available_tools": ["search_documents"]
        },
        "validators": []
      },
      {
        "slug": "emit",
        "phase_index": 1,
        "config": {
          "phase_type": "llm_emit",
          "emitter": "render_template",
          "prompt": "Fill the compliance-gap-report template rows from the retrieved knowledge-base evidence: one row per obligation with the 6 cited columns (requirement, source_clause, current_state, gap, severity, owner). Cite every non-null cell against its source chunk; set a cell to null where the sources do not support it.",
          "citation_policy": "strict",
          "integrity_policy": "strict"
        },
        "validators": [
          {"kind": "citations_required", "config": {"mode": "deterministic"}, "on_failure": "fail_run"},
          {"kind": "output_file_valid", "config": {}, "on_failure": "fail_run"}
        ]
      }
    ],
    "assets": [
      {
        "asset_id": "00000000-0000-0000-0000-000000000001/_library/compliance-gap-report.docx",
        "filename": "compliance-gap-report.docx",
        "kind": "template",
        "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

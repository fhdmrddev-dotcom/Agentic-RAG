-- 066_eval_coverage_seed.sql
-- Phase 096 / EVAL-01 + EVAL-02 (D-02 max-coverage workflow).
--
-- Ships ONE global, published workflow definition (`eval_coverage`) that touches
-- ALL 5 phase types in a single run:
--
--   eval_coverage : programmatic -> llm_batch_agents -> llm_agent
--                   -> llm_human_input -> llm_single
--
-- No existing seed covers all 5 (061: literature_review = programmatic+batch+single;
-- doc_qa_human = agent+human_input+single), and there is no workflow-authoring API —
-- only a migration can ship this. The one definition serves:
--   EVAL-01 : the cross-provider eval drives it per provider
--   D-02a   : its llm_human_input phase is the robot-watched ask_user round-trip
--   D-08    : one canonical restart-smoke target with all 3 kill points — phase 0
--             runs `eval_slow_step` (~20s sleep, programmatic.py) so the operator
--             has a humanly-possible mid-`programmatic` kill window (SC#4)
--
-- All 5 phases carry empty validators — the live cross-provider eval must not depend
-- on a regex gate (gate-retry coverage is deterministic in the CI structural test;
-- gate breadth was proven live in 093 D-21).
--
-- Seed-row column set mirrors 061_harness_seed_templates.sql:
--   status='published'  (the 056 block-published trigger then freezes it — D-04)
--   created_by = '00000000-0000-0000-0000-000000000001'  (seed system user)
--   is_global = true    (RLS forbids users self-setting it — only seed migrations)
--   definition = the FULL WorkflowDefinition JSONB (slug/version/name/status/phases[])
--
-- Idempotent: each INSERT has a FIXED uuid + ON CONFLICT (id) DO NOTHING, so
-- re-applying this migration is a no-op (safe to re-run).
--
-- APPLY DISCIPLINE (CLAUDE.md): apply this file by pasting it into the Supabase
-- SQL editor for the local project — never via the destructive CLI sync/reset
-- commands (they wipe dev data). After it applies, regenerate the bootstrap
-- artifact with `bash scripts/regenerate-full-schema.sh` (live-DB dump, NO reset)
-- and commit BOTH this file and full-schema.sql together.

-- ============================================================
-- Seed system user (idempotent) — satisfies the created_by FK.
-- Same row/UUID as 056 + 061; ON CONFLICT makes 066 self-contained.
-- (Meta columns use jsonb_build_object — identical values to 061's
-- string literals, expressed constructor-style.)
-- ============================================================
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'seed@system.local', '', now(), now(), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object(),
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed — eval_coverage (5-type): programmatic -> llm_batch_agents
--        -> llm_agent -> llm_human_input -> llm_single
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000c1',
  'eval_coverage', 1, 'Eval coverage (5-type)', 'published',
  '{
    "slug": "eval_coverage",
    "version": 1,
    "name": "Eval coverage (5-type)",
    "status": "published",
    "phases": [
      {
        "slug": "split",
        "phase_index": 0,
        "config": {
          "phase_type": "programmatic",
          "fn": "eval_slow_step",
          "input_keys": ["topic", "kickoff_prompt"]
        },
        "validators": []
      },
      {
        "slug": "fanout",
        "phase_index": 1,
        "config": {
          "phase_type": "llm_batch_agents",
          "prompt": "Answer your assigned sub-question using the knowledge base. Search the documents for relevant material and summarize the key findings for this sub-question.",
          "available_tools": ["search_documents"],
          "max_parallel_agents": 5,
          "merge_strategy": "concat_numbered"
        },
        "validators": []
      },
      {
        "slug": "deep_dive",
        "phase_index": 2,
        "config": {
          "phase_type": "llm_agent",
          "prompt": "You are given the merged per-sub-question findings as the user message below. Synthesize and extend them: search the knowledge base to fill gaps and verify claims, then produce a deeper draft synthesis that answers the user''s original question.",
          "available_tools": ["search_documents", "web_search"]
        },
        "validators": []
      },
      {
        "slug": "confirm",
        "phase_index": 3,
        "config": {
          "phase_type": "llm_human_input",
          "prompt": "Approve the draft synthesis or request changes.",
          "options": ["Approve", "Request changes"]
        },
        "validators": []
      },
      {
        "slug": "summarize",
        "phase_index": 4,
        "config": {
          "phase_type": "llm_single",
          "prompt": "You are given the draft synthesis and the human''s confirmation/corrections (from the previous steps) as the user message below. Produce the FINAL summary for the user, incorporating any corrections. Work only with the provided material — never ask the user to re-supply information already given."
        },
        "validators": []
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

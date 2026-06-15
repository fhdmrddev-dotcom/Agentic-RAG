-- 061_harness_seed_templates.sql
-- Phase 091 / HARNESS-07: the 4 seed workflow templates.
--
-- Ships 4 global, published, immutable workflow definitions that collectively
-- exercise all 5 phase types end-to-end (SC#1) and double as the UAT fixtures
-- (SC#1/#6). Each row mirrors the conftest `four_seed_defs()` single-source shape
-- byte-for-byte (the test asserts model_validate parity + reachability lint-clean):
--
--   research_summarize  : llm_agent  -> llm_single                          (PRIMARY)
--   plan_execute_verify : llm_single -> llm_agent -> llm_single + gate      (PRIMARY)
--   literature_review   : programmatic -> llm_batch_agents -> llm_single    (COVERAGE)
--   doc_qa_human        : llm_agent  -> llm_human_input -> llm_single        (COVERAGE)
--   union = {programmatic, llm_single, llm_agent, llm_batch_agents, llm_human_input}
--
-- Seed-row column set mirrors 056_workflow_definitions.sql:127-151:
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
-- artifact with `bash scripts/regenerate-full-schema.sh` (live-DB dump, NO reset).

-- ============================================================
-- Seed system user (idempotent) — satisfies the created_by FK.
-- Same row/UUID as 056 + 018; ON CONFLICT makes 061 self-contained.
-- ============================================================
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'seed@system.local', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed 1 — research_summarize (PRIMARY): llm_agent -> llm_single
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000b1',
  'research_summarize', 1, 'Research -> Summarize', 'published',
  '{
    "slug": "research_summarize",
    "version": 1,
    "name": "Research -> Summarize",
    "status": "published",
    "phases": [
      {
        "slug": "research",
        "phase_index": 0,
        "config": {
          "phase_type": "llm_agent",
          "prompt": "Research the user''s topic. Search the knowledge base and the web for the most relevant sources.",
          "available_tools": ["search_documents", "web_search"]
        },
        "validators": []
      },
      {
        "slug": "summarize",
        "phase_index": 1,
        "config": {
          "phase_type": "llm_single",
          "prompt": "Write a clear, cited summary of the prior research findings for the user."
        },
        "validators": []
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed 2 — plan_execute_verify (PRIMARY): llm_single -> llm_agent -> llm_single + gate
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000b2',
  'plan_execute_verify', 1, 'Plan -> Execute -> Verify', 'published',
  '{
    "slug": "plan_execute_verify",
    "version": 1,
    "name": "Plan -> Execute -> Verify",
    "status": "published",
    "phases": [
      {
        "slug": "plan",
        "phase_index": 0,
        "config": {
          "phase_type": "llm_single",
          "prompt": "Draft a concise step-by-step plan for the user''s request."
        },
        "validators": []
      },
      {
        "slug": "execute",
        "phase_index": 1,
        "config": {
          "phase_type": "llm_agent",
          "prompt": "Execute the plan. Run code and gather results as needed.",
          "available_tools": ["search_documents", "execute_code"]
        },
        "validators": []
      },
      {
        "slug": "verify",
        "phase_index": 2,
        "config": {
          "phase_type": "llm_single",
          "prompt": "Verify the executed result satisfies the plan. If it does, include the word VERIFIED in your answer to the user."
        },
        "validators": [
          {
            "kind": "regex_match",
            "config": {"pattern": "VERIFIED"},
            "on_failure": "retry",
            "max_retries": 2
          }
        ]
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed 3 — literature_review (COVERAGE): programmatic -> llm_batch_agents -> llm_single
-- Sole exerciser of programmatic + llm_batch_agents.
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000b3',
  'literature_review', 1, 'Literature review', 'published',
  '{
    "slug": "literature_review",
    "version": 1,
    "name": "Literature review",
    "status": "published",
    "phases": [
      {
        "slug": "split",
        "phase_index": 0,
        "config": {
          "phase_type": "programmatic",
          "fn": "split_topic",
          "input_keys": ["topic"]
        },
        "validators": []
      },
      {
        "slug": "review",
        "phase_index": 1,
        "config": {
          "phase_type": "llm_batch_agents",
          "prompt": "Review the literature for this subtopic and summarize the key findings.",
          "available_tools": ["search_documents"],
          "max_parallel_agents": 5,
          "merge_strategy": "concat_numbered"
        },
        "validators": []
      },
      {
        "slug": "merge",
        "phase_index": 2,
        "config": {
          "phase_type": "llm_single",
          "prompt": "Merge the per-subtopic reviews into one coherent literature review for the user."
        },
        "validators": []
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed 4 — doc_qa_human (COVERAGE): llm_agent -> llm_human_input -> llm_single
-- Sole exerciser of llm_human_input.
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000b4',
  'doc_qa_human', 1, 'Doc Q&A', 'published',
  '{
    "slug": "doc_qa_human",
    "version": 1,
    "name": "Doc Q&A",
    "status": "published",
    "phases": [
      {
        "slug": "draft",
        "phase_index": 0,
        "config": {
          "phase_type": "llm_agent",
          "prompt": "Draft an answer to the user''s question using the knowledge base.",
          "available_tools": ["search_documents"]
        },
        "validators": []
      },
      {
        "slug": "confirm",
        "phase_index": 1,
        "config": {
          "phase_type": "llm_human_input",
          "prompt": "Does this draft answer your question? Add any corrections.",
          "options": ["Looks good", "Needs changes"]
        },
        "validators": []
      },
      {
        "slug": "finalize",
        "phase_index": 2,
        "config": {
          "phase_type": "llm_single",
          "prompt": "Finalize the answer for the user, incorporating the human''s input."
        },
        "validators": []
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

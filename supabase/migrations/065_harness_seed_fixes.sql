-- 065_harness_seed_fixes.sql
-- Phase 093 / D-09 — three corrective seed fixes against 061_harness_seed_templates.sql.
--
-- The 056 BEFORE-UPDATE trigger (workflow_definitions_block_published) RAISES on ANY
-- update to a published row (ERRCODE check_violation), so disable it for the txn,
-- UPDATE the three affected seeds' definition jsonb, then re-enable. Data-only (no
-- DDL beyond the trigger toggle); full-schema.sql table DDL is unchanged.
--
-- The three fixes (all verified against 061 on disk 2026-06-02):
--   Fix 1 (D-09a): literature_review (b3) split phase input_keys ["topic"] ->
--                  ["topic","kickoff_prompt"] — paired with the split_topic code alias
--                  (programmatic.py reads kickoff_prompt) so the executor surfaces the
--                  user's question to the fn and the batch phase fans out N>1.
--   Fix 2 (D-09b): plan_execute_verify (b2) verify-gate. verify is phases[2] (the LAST
--                  phase, no successor) so a skip_to_phase target doesn't exist -> the
--                  route-forward fix is to DROP the dead-ending hard regex gate (set
--                  validators to []). A model that doesn't echo VERIFIED then still
--                  completes on the verify phase's own output instead of fail_run.
--   Fix 3 (D-09 result-quality, "asks me to share the research"): the downstream
--                  llm_single phases ALREADY receive the prior phase output as their
--                  user turn (_exec_llm_single -> _prior_output_text, phase_types.py
--                  :116/231) and the executor IGNORES input_keys (only programmatic
--                  reads it) — so binding input_keys would be a NO-OP. The fix is a
--                  self-sufficient, anti-delegation PROMPT on the 3 downstream phases
--                  (research_summarize phases[1], literature_review phases[2],
--                  doc_qa_human phases[2]). Matched by slug (unique per published row).
--
-- T-093-SEED: the migration re-ENABLEs the immutability trigger inside the same
-- transaction — published rows stay app-immutable after the fix.
--
-- Apply via the Supabase SQL editor (per CLAUDE.md — never `supabase db push`/`db reset`).
-- Then regenerate the bootstrap artifact: `bash scripts/regenerate-full-schema.sh`
-- (no --reset — live-DB dump only) and commit BOTH this file and full-schema.sql.

BEGIN;
ALTER TABLE public.workflow_definitions DISABLE TRIGGER workflow_definitions_block_published;

-- Fix 1 (D-09a): literature_review split phase input_keys ["topic"] -> ["topic","kickoff_prompt"]
UPDATE public.workflow_definitions
SET definition = jsonb_set(
  definition,
  '{phases,0,config,input_keys}',
  '["topic","kickoff_prompt"]'::jsonb
)
WHERE id = '00000000-0000-0000-0000-0000000000b3'
  AND definition #>> '{phases,0,config,fn}' = 'split_topic';

-- Fix 2 (D-09b): plan_execute_verify verify-gate (phases[2], the terminal phase) —
-- drop the dead-ending hard regex gate so a non-VERIFIED output still completes.
UPDATE public.workflow_definitions
SET definition = jsonb_set(
  definition,
  '{phases,2,validators}',
  '[]'::jsonb
)
WHERE id = '00000000-0000-0000-0000-0000000000b2';

-- Fix 3 (D-09 result-quality): rewrite the 3 downstream llm_single prompts to the
-- self-sufficient, anti-delegation form (the model works the provided material
-- instead of asking the user to supply it). The prompt is the `system` framing in
-- _exec_llm_single; the prior-phase output is the `user` turn (phase_types.py:225-231).

-- research_summarize: summarize is phases[1].
UPDATE public.workflow_definitions
SET definition = jsonb_set(definition, '{phases,1,config,prompt}',
  to_jsonb('You are given research findings (gathered by the previous step) as the user message below. Write a clear, well-structured, cited summary that directly answers the user''s original question, using ONLY the provided findings. The research is already done — never ask the user to provide or share research. If the findings are thin, summarize what is present and note any gaps; cite sources inline where present.'::text))
WHERE slug = 'research_summarize';

-- literature_review: merge is phases[2].
UPDATE public.workflow_definitions
SET definition = jsonb_set(definition, '{phases,2,config,prompt}',
  to_jsonb('You are given several per-subtopic literature reviews (from the previous steps) as the user message below. Merge them into ONE coherent, well-organized literature review that answers the user''s original question, using ONLY the provided reviews. The reviews are already gathered — never ask the user to supply them. Integrate and de-duplicate across subtopics and note any gaps.'::text))
WHERE slug = 'literature_review';

-- doc_qa_human: finalize is phases[2].
UPDATE public.workflow_definitions
SET definition = jsonb_set(definition, '{phases,2,config,prompt}',
  to_jsonb('You are given a draft answer and the user''s confirmation/corrections (from the previous steps) as the user message below. Produce the FINAL answer for the user, incorporating the corrections. Work only with the provided draft and corrections — never restart from scratch or ask the user to re-supply information already given.'::text))
WHERE slug = 'doc_qa_human';

ALTER TABLE public.workflow_definitions ENABLE TRIGGER workflow_definitions_block_published;
COMMIT;

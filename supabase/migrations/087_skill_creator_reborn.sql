-- Phase 137.2 (CREATE-01 / SEED-101) — the built-in, read-only, deploy-safe skill-creator.
--
-- WHY: migration 018 seeded a thin 3-question "skill-creator" that is now GONE from the
-- live dev DB and was never deploy-safe (data seeds are NOT captured by the schema-only
-- `full-schema.sql` dump — see DEPLOYMENT-LESSONS.md A6 + Pitfall 5 in 137.2-RESEARCH.md).
-- 087 SUPERSEDES 018: same system user (…0001) and same skill id (…0010, so it refreshes
-- rather than duplicates), but rewritten with platform-native 7-step instructions that teach
-- the agent to run OUR real skill lifecycle (interview → RAG research → draft/save → propose
-- evals → evaluate → improve → publish) grounded ONLY in tools this runtime actually has
-- (SEED-096 honesty — no subagents, no browser, no `claude -p`, Python-only sandbox).
--
-- IDEMPOTENT: re-apply converges. The additive `is_system` column uses ADD COLUMN IF NOT
-- EXISTS (every pre-087 row stays valid, default false); the auth.users insert keeps
-- ON CONFLICT (id) DO NOTHING (never mutate the user); the skill row uses ON CONFLICT (id)
-- DO UPDATE (not DO NOTHING) so a stale 018 …0010 row on ANY environment is actually
-- refreshed to the reborn content (RESEARCH Pitfall 1).
--
-- DATA-CARRYING: this seed is NOT in `full-schema.sql` (schema-only pg_dump). A fresh cloud
-- DB bootstrapped from full-schema.sql will have the `is_system` COLUMN but not the seed ROW.
-- Apply this file via the Supabase SQL editor OR psycopg2-direct to :54322 — NEVER db push /
-- db reset (preserves dev data). Cloud deploy parity is documented in DEPLOYMENT-LESSONS.md A6
-- and DEPLOYMENT-WORKFLOW.md §5 so an operator applies it rather than assuming the schema
-- dump covered it (CREATE-01 SC#1).

-- 1. Additive UI/trust-badge signal column (D-01). This is the "Built-in" badge value, NOT
--    the protection mechanism (read-only is enforced by system-user ownership …0001).
--    is_system is write-locked to this migration — no route sets it, so the badge can't be
--    spoofed; every pre-087 row is valid unchanged at the default false.
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 2. Re-seed the system user that owns the built-in (satisfies skills.user_id FK). Copied
--    verbatim from migration 018 — SAME UUID …0001, already present on any env that ran 018.
--    Keep ON CONFLICT (id) DO NOTHING: the user must never be mutated by a re-apply.
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'seed@system.local',
  '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Upsert the reborn built-in skill-creator. Reuses 018's id …0010 so it SUPERSEDES (never
--    duplicates); owned by the system user …0001 (read-only/undeletable for everyone via the
--    existing owner-scoping). All three booleans true: enabled + global (catalog-injected for
--    every user, no code change) + is_system (the badge). ON CONFLICT (id) DO UPDATE (not
--    DO NOTHING) so a stale 018 row is truly refreshed to this content on any env that still
--    holds it. The instructions body is dollar-quoted ($INSTRUCTIONS$…$INSTRUCTIONS$) so the
--    prose can contain raw apostrophes/backticks without doubling (018 had to double every '').
INSERT INTO public.skills (
  id,
  user_id,
  name,
  description,
  instructions,
  is_enabled,
  is_global,
  is_system
)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'skill-creator',
  'Guides you through creating a new skill end-to-end — interview, research your knowledge base, draft and save, propose evals, test, improve, and publish.',
  $INSTRUCTIONS$You are **skill-creator**, a built-in guide that helps the user turn a repeatable task into a saved, tested Skill on THIS platform. When the user says something like "help me create a skill for X," run the loop below. Move one step at a time and keep the user in control — confirm before you save, and never invent capabilities.

## 1. Interview — understand the task before writing anything
Ask focused questions, one small batch at a time:
- What is the repeatable task, in one sentence?
- What are the inputs (a document? a pasted spec? a topic?) and the desired output (a summary? a table? a drafted file?)?
- What does "good" look like — any format, tone, or must-include rules? Any edge cases to handle?
- When should the agent reach for this skill (the trigger)?
Reflect the answers back in your own words and get a "yes, that's right" before drafting.

## 2. Research with our knowledge base (our advantage)
Before drafting, call `search_documents` to pull real context from the user's uploaded documents that should shape the skill — domain terms, house style, worked examples, constraints. Cite what you found and ask whether it should inform the instructions. This grounds the skill in the user's actual material; a plain chatbot can't do this.

## 3. Draft and save with `save_skill`
Write the instructions, then call `save_skill` with `name`, `description`, and `instructions`. Apply this craft (it is what makes skills work or fail):
- **Imperative form.** Write directives to the agent ("Extract the risks," not "The agent should extract risks").
- **Explain the why, sparingly.** A short reason beats a wall of MUST rules — the agent generalizes better from intent than from a checklist.
- **Generalize, don't overfit.** Describe the shape of the task, not one exact example. Avoid hard-coding a single input's details.
- **A pushy-but-honest description.** The one-sentence `description` is what makes the skill trigger. Make it specific and action-oriented ("Draft a risk register from a project brief") — but never claim more than the skill actually does.
- **Progressive disclosure.** Keep the core instructions lean. If the skill needs reference material or a reusable helper, attach it as a file from the Skills page — the agent reads attached files with `read_skill_file` when the skill runs.
Confirm the draft with the user, then save. Tell them it is now in their Skills tab.

## 4. Propose test cases and hand off to the Studio
Suggest 2–3 realistic eval cases as plain text — each a sample prompt plus what a good answer must do. Then tell the user: open this skill in **Skill Studio → Evals** and add these cases in the case editor (that is where cases are saved and run). You draft them here; the Studio persists and runs them. There is no separate tool for this — the cases live in the Studio.

## 5. Evaluate honestly
Point the user to run the eval in the Studio. Explain the result plainly: each case runs twice — **with** the skill and **without** it — and a judge compares the two answers. A skill "earns its keep" when the with-skill answer is clearly better. If the verdict is honest-but-weak, that is useful signal, not a failure — tighten the instructions and re-run.

## 6. Improve
When evals surface weaknesses, the Studio can **propose** an improved version — the user reviews the diff and approves; nothing changes automatically. For trigger quality (getting the skill to fire at the right time and not the wrong time), use the **Trigger Tuner**, which scores candidate descriptions against held-out examples and applies the best one.

## 7. Publish
A skill can be shared (made global) once it has a passing eval — that is the publish gate. Walk the user to it when they are ready. That is the finish line.

## What this runtime can and cannot do (be honest)
- You CAN: read the user's documents (`search_documents`), save and update skills (`save_skill`), load skills (`load_skill`), read attached skill files (`read_skill_file`), and run Python in a sandbox (`execute_code`).
- Skill helper scripts, if any, must be **Python** — the sandbox runs Python only.
- You do NOT have a browser-automation tool for skill authoring, cannot shell out to external CLIs, and do not orchestrate separate eval "agents." Evals run through the Skill Studio engine described above. Never tell the user otherwise.$INSTRUCTIONS$,
  true,   -- is_enabled
  true,   -- is_global
  true    -- is_system
)
ON CONFLICT (id) DO UPDATE SET
  user_id      = EXCLUDED.user_id,
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  is_enabled   = EXCLUDED.is_enabled,
  is_global    = EXCLUDED.is_global,
  is_system    = EXCLUDED.is_system;

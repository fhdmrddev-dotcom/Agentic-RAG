-- 210_starter_workflows_v2.sql
-- Phase 287 / START-03: three more curated Starter workflows, so the Starters shelf lists six.
--
-- Ships 3 global, published, immutable starter definitions the user forks into a personal copy
-- (or starts straight from a chat thread). Each carries definition.category='starter' -- the
-- D-143-2 curation marker the shelf query reads (list_starter_workflows: is_system_global AND
-- status published AND definition->>'category' = 'starter').
--
--   meeting-notes-to-actions : llm_agent(search_documents) -> llm_single   (Decisions / Action items / Open questions)
--   policy-change-impact     : llm_agent(search_documents) -> llm_single   (What changed / Who is affected / What to do next)
--   stakeholder-update       : llm_agent(search_documents) -> llm_single   (Progress / Risks / Next step)
--
-- TEMPLATE-LESS, ON PURPOSE. Unlike the three 094 starters these have no assets[] and no inputs[]:
-- the answer comes back in chat, so there is no Storage object to place (a SQL migration cannot
-- place Storage bytes) and no launch field to ask for. The second phase is llm_single, so its
-- citations_required validator uses mode "presence" (marker count in the text); the
-- retrieved_and_cited mode needs an agent step's citations and would fail here.
--
-- Like 094, no project-folder binding and no per-phase KB scope appear anywhere: retrieval runs
-- over the FORKER's own knowledge base, never an operator-private folder.
--
-- COLUMN SET: (id, slug, version, name, status, definition, created_by, is_system_global).
-- NOT is_global -- migration 111 renamed it to is_system_global. org_id is NOT NULL and is filled
-- by the workflow_definitions_autofill_org_id BEFORE INSERT trigger from the seed user's
-- org_members row; the guard below fails loudly with a named cause if that row is missing.
--
-- PUBLISHED ROWS ARE IMMUTABLE (workflow_definitions_block_published raises 23514 on UPDATE). A
-- wording fix after release needs a NEW slug or version, never an UPDATE -- get the prompts right
-- before applying. UNIQUE(slug, version) is GLOBAL: ON CONFLICT (id) does not catch a slug clash
-- with a user-owned row, so check the three slugs read-only before pasting this into cloud.
--
-- Idempotent: FIXED uuids in the mig-210 namespace (...0210a1..a3) + ON CONFLICT (id) DO NOTHING.
--
-- APPLY DISCIPLINE (CLAUDE.md): local -> scripts/apply_migration_210.py or the Supabase SQL
-- editor; cloud -> paste into the cloud SQL editor (operator step). Never `supabase db push` or
-- `db reset`. Then `bash scripts/regenerate-full-schema.sh` (no --reset).

BEGIN;

-- Fail loudly, with a cause, on a box whose seed user has no org membership.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'mig 210: seed user 00000000-0000-0000-0000-000000000001 has no org_members row; org_id autofill would fail'
      USING ERRCODE = '23502';
  END IF;
END $$;

-- ============================================================
-- Starter 4 -- Meeting Notes to Actions
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_system_global)
VALUES (
  '00000000-0000-0000-0000-0000000210a1',
  'meeting-notes-to-actions', 1, 'Meeting Notes to Actions', 'published',
  '{
    "slug": "meeting-notes-to-actions",
    "version": 1,
    "name": "Meeting Notes to Actions",
    "status": "published",
    "category": "starter",
    "business_requirement": "List the decisions and action items from your meeting notes, each with an owner and a due date where the notes state one, and cite the note each came from.",
    "phases": [
      {
        "slug": "retrieve",
        "phase_index": 0,
        "name": "Find the evidence",
        "config": {
          "phase_type": "llm_agent",
          "prompt": "Search the knowledge base for meeting notes, minutes and follow-up emails. Gather every decision and every action item, each with its owner, its due date and the passage it came from. Note any question the meeting left open.",
          "available_tools": ["search_documents"]
        },
        "validators": []
      },
      {
        "slug": "write",
        "phase_index": 1,
        "name": "Write it up",
        "config": {
          "phase_type": "llm_single",
          "prompt": "Write the meeting follow-up from the retrieved notes under the headings Decisions, Action items and Open questions. Cite each line with a marker like [1]. Leave an owner or due date out where the notes do not state one. Do not invent decisions or actions."
        },
        "validators": [
          {"kind": "citations_required", "config": {"mode": "presence", "min_markers": 2}, "on_failure": "retry", "max_retries": 2},
          {"kind": "structure_check", "config": {"mode": "loose", "sections": ["Decisions", "Action items", "Open questions"]}, "on_failure": "retry", "max_retries": 2}
        ]
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Starter 5 -- Policy Change Impact
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_system_global)
VALUES (
  '00000000-0000-0000-0000-0000000210a2',
  'policy-change-impact', 1, 'Policy Change Impact', 'published',
  '{
    "slug": "policy-change-impact",
    "version": 1,
    "name": "Policy Change Impact",
    "status": "published",
    "category": "starter",
    "business_requirement": "Explain what changed between the current and previous version of a policy in your knowledge base, who is affected, and what each affected group needs to do next, citing the passage behind every statement.",
    "phases": [
      {
        "slug": "retrieve",
        "phase_index": 0,
        "name": "Find the evidence",
        "config": {
          "phase_type": "llm_agent",
          "prompt": "Search the knowledge base for the most recent policy and its previous version, plus any announcement or change log about it. Gather what was added, removed or reworded, which teams or roles the policy applies to, and any effective date or required action, with the passages they came from.",
          "available_tools": ["search_documents"]
        },
        "validators": []
      },
      {
        "slug": "write",
        "phase_index": 1,
        "name": "Write it up",
        "config": {
          "phase_type": "llm_single",
          "prompt": "Write a short impact note from the retrieved passages under the headings What changed, Who is affected and What to do next. Cite each statement with a marker like [1]. Say plainly when the sources do not show a previous version or an effective date, rather than guessing."
        },
        "validators": [
          {"kind": "citations_required", "config": {"mode": "presence", "min_markers": 2}, "on_failure": "retry", "max_retries": 2},
          {"kind": "structure_check", "config": {"mode": "loose", "sections": ["What changed", "Who is affected", "What to do next"]}, "on_failure": "retry", "max_retries": 2}
        ]
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Starter 6 -- Stakeholder Update
-- ============================================================
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_system_global)
VALUES (
  '00000000-0000-0000-0000-0000000210a3',
  'stakeholder-update', 1, 'Stakeholder Update', 'published',
  '{
    "slug": "stakeholder-update",
    "version": 1,
    "name": "Stakeholder Update",
    "status": "published",
    "category": "starter",
    "business_requirement": "Draft a short stakeholder update from your knowledge base covering progress since the last update, the main risks, and the next step, with every claim traced to a source.",
    "phases": [
      {
        "slug": "retrieve",
        "phase_index": 0,
        "name": "Find the evidence",
        "config": {
          "phase_type": "llm_agent",
          "prompt": "Search the knowledge base for the latest status notes, reports and decisions about the work being updated. Gather what has been completed since the last update, the open risks or blockers, and the agreed next step, with the passage each came from.",
          "available_tools": ["search_documents"]
        },
        "validators": []
      },
      {
        "slug": "write",
        "phase_index": 1,
        "name": "Write it up",
        "config": {
          "phase_type": "llm_single",
          "prompt": "Write a stakeholder update of at most a few short paragraphs from the retrieved passages under the headings Progress, Risks and Next step. Cite each claim with a marker like [1]. Keep the tone plain and factual, and leave out anything the sources do not support."
        },
        "validators": [
          {"kind": "citations_required", "config": {"mode": "presence", "min_markers": 2}, "on_failure": "retry", "max_retries": 2},
          {"kind": "structure_check", "config": {"mode": "loose", "sections": ["Progress", "Risks", "Next step"]}, "on_failure": "retry", "max_retries": 2}
        ]
      }
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================================================
-- VERIFY -- run after applying. Every row must read PASS.
--   with checks(what, ok) as (values
--     ('3 new starters are published, global, category starter', (select count(*) from public.workflow_definitions where slug in ('meeting-notes-to-actions','policy-change-impact','stakeholder-update') and version = 1 and status = 'published' and is_system_global and definition->>'category' = 'starter') = 3),
--     ('the shelf lists at least 6 starters', (select count(*) from public.workflow_definitions where status = 'published' and is_system_global and definition->>'category' = 'starter') >= 6),
--     ('new starters declare no assets', not exists(select 1 from public.workflow_definitions where slug in ('meeting-notes-to-actions','policy-change-impact','stakeholder-update') and definition->'assets' is not null)),
--     ('new starters carry an org_id', not exists(select 1 from public.workflow_definitions where slug in ('meeting-notes-to-actions','policy-change-impact','stakeholder-update') and org_id is null)),
--     ('new starters have no folder binding', not exists(select 1 from public.workflow_definitions where slug in ('meeting-notes-to-actions','policy-change-impact','stakeholder-update') and definition::text like '%folder%'))
--   ) select case when ok then 'PASS' else 'FAIL' end as status, what from checks;

---
title: SPIKE — NL→workflow authoring (describe + upload-template → AI-derived inputs/phases → KB-grounded fill → human refine → run) on a real case
date: 2026-06-03
priority: high
status: pending
trigger: v2.9 milestone kickoff — run as the FIRST move of v2.9, BEFORE designing any inputs/assets schema (do NOT start during v2.8; finish 094→095→096 first)
related: SEED-051, SEED-050, D-092-AUTHOR, .planning/research/questions.md, .planning/notes/workflow-authoring-exploration-2026-06-03.md
resolves_phase: 152
---

> **v3.3 routing note (2026-07-10):** largely SATISFIED by shipped work — the Phase 097 spike answered all 4 questions and v2.9 Phase 103 shipped NL→workflow authoring. The one unshipped slice (upload-template as a workflow run input) is now WFIN-01 → **Phase 152 (Workflow Run Inputs)**; this todo closes when 152 ships.

# Spike: NL→Workflow Authoring (throwaway, evidence-first)

## Why

Recommended in `/gsd:explore` (2026-06-03), operator-agreed. The new parts of the SEED-051
vision are unproven *here* and can't be schema-designed by guessing. A throwaway spike on a
**real** case answers the unknowns cheaply, and its output BECOMES the v2.9 schema design.
Do NOT pre-commit the `inputs`/`assets` schema before this runs.

## The 4 questions the spike must answer

1. Can a strong model reliably **derive the input fields** from a plain-English description +
   an uploaded template/form? (what shape do the fields take? how often is human refinement
   needed?)
2. Does **KB-grounded template-fill** produce a clean, correct `.docx`/`.pdf` reliably (via the
   sandbox's python-docx/reportlab)? Robust enough to be first-class, or stays a code phase?
3. What does **authoring-time grounding** need — i.e. what subset of the KB folder tree + tool/
   skill registry must be injected into the generator's prompt for it to propose correct
   tools/scoping/steps (and how to PRUNE it, per the text-to-SQL schema-linking lesson)?
4. Does the **describe → AI-proposes → human-refines → publish** loop *feel* good?

## How to run (throwaway — no production schema commitment)

- Use `/gsd:spike`. Pick ONE real, representative case (the operator's contract example is fine
  as the driver, but evaluate generality — see SEED-051's guardrail: generalize, don't overfit).
- Reuse the EXISTING substrate as the generation target: `WorkflowDefinition` Pydantic model
  (`backend/app/models/harness.py`) + `lint_workflow` (`reachability.py`) — the model IS the
  response schema; lint is the safety gate. The structured-output layer already exists (no
  LangChain).
- Caution: backend runs under uvicorn `--reload` and the operator starts it themselves — keep
  spike scratch OUT of `backend/` ([[feedback_no_scratch_in_watched_tree]],
  [[feedback_user_starts_backend]]).

## Output

Findings feed the v2.9 `inputs` + `assets` schema design and the open decisions in
`.planning/research/questions.md`. Then plan D-092-AUTHOR Phase B/C on the evidence.

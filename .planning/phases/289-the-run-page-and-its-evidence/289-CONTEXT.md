# Phase 289: The Run Page and Its Evidence - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning. ✅ G-2 satisfied 2026-10-19: operator picked **B + B** (see D-14a).
**Mode:** autonomous on the recommended option, reason written beside each decision. The operator asked to fold SEED-360; every other call below can be overruled and none is a one-way door.

<domain>
## Phase Boundary

Three things, all on the run surface:

1. **VIS-03**: a finished run has one read-only page, plus an export, showing the definition version it ran, the phase log, each verdict and the cited sources. Anyone with access to the run's organisation can open it, and nobody else can.
2. **TRUST-01**: each phase output that came from the knowledge base carries the confidence level chat already computes. It is shown on the run surface and in the receipt. A phase with no KB use shows none.
3. **SEED-360 (folded at operator instruction)**: answering a paused run resumes it to completion, and the expired card gives the person a way to answer.

Requirements: VIS-03, TRUST-01. Seeds: SEED-348, SEED-152, SEED-360.
</domain>

<measured>
## What is already true (measured 2026-10-19, not assumed)

- **The run already records the version it ran.** `workflow_runs.definition_snapshot` is written at insert (`backend/app/db/workflows.py:523`). ⚠ It is stored as a jsonb STRING scalar on recent rows (`db/workflows.py:482`, memory `reference_workflow_definition_jsonb_string_scalar`), so the page must decode it. No migration is needed for the version.
- **Confidence exists only on the chat path.** `agent_loop._compute_confidence` (`agent_loop.py:949`) and `embedding_service.attach_confidence` (`embedding_service.py:238`). `grep confidence backend/app/services/harness/` = **0 matches**. Messages carry `confidence_level`, `confidence_avg_similarity` and `confidence_disclaimer` (`models/message.py`).
- **Run reads are owner-only today.** `read_workflow_run` filters `.eq("user_id", viewer)` (288-REVIEW). The 288 waiting-on composer already has a non-owner arm, which is dead code until this phase (288 A-06: no email, no `prompt_line` for non-owners).
- **SEED-360's stall has a confirmed half.** `_redrive_paused_workflow_run` (`api/runs.py:564`) calls `resume_run` (paused to active) BEFORE `_wake`, and `_wake`'s `except` (`runs.py:660-662`) only logs and finalizes the producer shell. Any `_resume_run` failure leaves the run `active` with no producer, and the waiting-on line disappears because the answer row exists. **Why `_resume_run` fails is NOT known**: plan 288-04 reproduced it twice, but no log line was captured.
- **The receipt pieces exist separately.** `RunReceipt.tsx`, `receiptVocabulary.ts`, `RunSpine.tsx`, `RunStepList.tsx`, `harness_audit`, `workflow_phases`. SEED-348 calls this assembly, not a build.
- Next free migration number: **211** (210 is the last).
</measured>

<decisions>
## Implementation Decisions

### VIS-03: one read-only page and its export

- **D-01 (assembly, no new runtime writes).** One server read composes the four sections (definition version, phase log, verdicts, cited sources) from `definition_snapshot`, `workflow_phases`, `harness_audit` and the phases' citation outputs. If a plan proposes a new write or table for this, the scope has drifted (SEED-348). *Why:* everything is already recorded; a second store would drift from the first.
- **D-02 (the run page in its finished state IS the page).** No second run page. A finished run on `WorkflowRunPage` renders the read-only evidence view, built from the D-01 read and with no write controls. Research must confirm how the page is reached, because the app has no URL router (memory `reference_app_has_no_router`). If a shareable address is needed for SC#3, research names the smallest way to get one. *Why:* 286 split this file so 289 could add to it; a second page is a second truth. G-5: one mount, prop or helper on `WorkflowRunPage.tsx`.
- **D-03 (export from the same payload).** The export is the D-01 payload rendered two ways: a JSON download and a print view (browser print to PDF). A test asserts that the export's four sections equal what the page renders, by content, not by testid. *Why:* SC#2 says "matching what the page shows"; one source makes that true by construction. Presence assertions miss content drift (memory).
- **D-04 (the version is the snapshot, never the current definition).** The page shows the definition as the run ran it, from `definition_snapshot`, with its version label. If the live definition has changed since, the page says so in words. *Why:* this is the roadmap's first named failure mode.
- **D-05 (access = the run's organisation, read-only).** Org members can read a finished run of their org; other users get **404** (never 403, so a run's existence is not confirmed). The owner keeps write paths (answer, cancel); a non-owner gets none. The 288 A-06 privacy rule holds: a non-owner never sees the owner's email or the prompt line beyond what the receipt itself records. This is driven live as a second user from another org, and as a same-org non-owner. *Why:* SC#3; the dev account is in two orgs (memory), so prove the active org first.
- **D-06 (finished only).** The evidence view is for terminal runs (completed, failed, cancelled). An active or paused run keeps the live surface. *Why:* the requirement says "finished run"; a half-written receipt is a claim about a run that has not ended.

### TRUST-01: confidence on KB-derived phase outputs

- **D-07 (reuse the chat computation, no model call).** Confidence comes from the same function chat uses, applied to the retrieval results that phase actually used. Research says whether `_compute_confidence` is reachable from the harness without a refactor; if not, the smallest extraction to a shared pure helper is allowed. *Why:* SC#5, and SEED-152's whole point.
- **D-08 (per phase, on the phase output).** It is stored as ONE optional field on the phase output (the 286 forecast for `phase_types.py`: "one optional output field, no new type"). There is no run-level rollup in this phase. Migration 211 only if the phase output has no place for it; research decides.
- **D-09 (no KB, no confidence).** A phase that did no retrieval carries `None`, and the UI shows **nothing**: not "low", not "n/a" chips. A KB phase whose retrieval returned zero results shows the chat path's own low/none wording. *Why:* the roadmap's named failure is "a phase with no KB use shows high"; absence must render as absence.
- **D-10 (shown on the run surface and in the receipt, not on the canvas).** It goes on the phase step of the run surface and in the evidence view or receipt. The canvas node card is out of scope (SEED-152 Q4: the corner and badge slots are claimed).

### SEED-360: a paused run that is answered resumes

- **D-11 (root cause first, then fix).** Before any fix: reproduce in a live run, capture the `ask_user_response: re-drive failed` traceback (or prove the skip path), and record it in RESEARCH or the SUMMARY. Check it at base `266e344c9` as well, to establish inherited versus new. *Why:* nobody has seen the failing line; a fix for an unread traceback is a guess.
- **D-12 (no run left active without a producer).** Whatever `_resume_run` raises, `_wake`'s failure arm must leave the run in a state the surfaces can tell truthfully: re-paused if the answer can be retried, or failed with a worded reason. It must never stay `active` with no producer. A test plants a raising `_resume_run` and asserts the final status (288 WR-01).
- **D-13 (the expired card offers the answer).** For a run that is `paused` with an unanswered prompt, `PendingAskCard` shows an answer control, not "EXPIRED … agent stopped". Answering it drives D-11/D-12's path. The 288 paused sentence ("Still waiting on X.") gets back "the run continues as soon as they answer" only after a live drive proves a paused run completes. *Why:* 288 had to soften that sentence because it was untrue; it is restored by evidence, not by intent.

### Process and guardrails

- **D-14 (G-2 is NOT skipped this time).** The operator is present, and the roadmap flags G-2 for the evidence page and the confidence chip. A `/gsd:sketch` of (a) the finished-run evidence view and (b) the confidence mark on a phase step runs BEFORE `/gsd:plan-phase 289`. The expired-card answer control reuses `PendingAskCard`'s existing live-answer layout, so it needs no sketch.
- **D-14a (sketch winners, operator 2026-10-19; these are the acceptance bar).**
  - `.planning/sketches/289-run-evidence-page/` **B, a report you can print**: one read-only column.
    - The title block carries the "Read-only record" mark and the Download JSON and Print / save as PDF buttons.
    - A facts strip shows result, version run, checks passed and deliverable.
    - An "edited since this run" banner appears when the live definition is newer.
    - Then four numbered sections: 1 What it ran (version, step list, expandable full definition), 2 What happened, step by step (a table), 3 Checks and verdicts, 4 Sources it used (each with its location and "cited by step N").
    - Print is the page itself, through print CSS.
    - Another org sees one "This run isn't available" page.
  - `.planning/sketches/289-confidence-on-a-step/` **B, an evidence line under the step**: "Answered from <KB> · N passages · ● Medium · 0.47".
    - It is the same line in the evidence page's step log and on the live panel spine card.
    - The chip follows 028: glyph + word + raw score.
    - Low adds chat's disclaimer sentence.
    - "Searched, found nothing" reads "Searched <KB> · nothing matched · ○ No match found".
    - A non-KB step has no line at all.
  - ⚠ D-02 said "the run page in its finished state IS the page". The winner is a report layout, so the finished state of `WorkflowRunPage` renders the B report instead of the live spine. It is still one page and not a second route. Research confirms how this fits the 286 `useWorkflowRun` seam.
- **D-15 (G-4 scenarios, defined now).**
  - S1: finish a run with a KB step and a non-KB step, open the evidence view; the four sections are present, the version is the snapshot, the KB step shows confidence and the other step shows none.
  - S2: edit the workflow after the run, reopen it; the page still shows the version the run used and says the definition has changed.
  - S3: export, then compare the export's four sections to the page.
  - S4: a second user in another org is refused (404) for both page and export; a same-org non-owner reads it with no write controls and no owner email.
  - S5: let a pause window pass, answer from the card, and the run completes; reload and the run reads completed.
- **D-16 (G-5, one touch per hot file).** `WorkflowRunPage.tsx`, `workflow_runs.py`, `harness_engine.py`, `phase_types.py`, `PendingAskCard.tsx`, `api/runs.py` and `RunReceipt.tsx` each get at most one mount, prop, field or helper. Ledger rows and their `docs/HOT-FILE-LEDGER.md` sections land in the same commit. Read each file's ledger section before planning. `harness_engine.py` and `phase_types.py` read "G-5 OWED", so the planner names a by-construction reason for each or proposes the seam.
- **D-17 (UAT four axes in VALIDATION.md).** The phase touches run state and provider-routed retrieval, so it needs the full native roster plus OpenRouter, a multi-tool row, a parallel-thread row and a long-message row. A blocked row is recorded with its reason (Anthropic is billing-blocked as of 288; re-test it, do not assume).
- **D-18 (plan count 3-5, G-8).** Suggested shape:
  1. The evidence read, access and export (backend + view).
  2. Confidence on phase outputs (engine + surface).
  3. SEED-360 resume and the answer control.
  4. Live proof.
  Plans 1 and 3 touch `workflow_runs.py` and `api/runs.py` respectively and can share a wave. Plan 2 touches `harness_engine.py`, which plan 3's root cause may also touch, so the planner checks that overlap after research.

### Folded seeds and bugs
- **SEED-360 folded** (F-1, F-3, and 288 WR-01 as D-11..D-13). **F-2** (the judge blocks the planted pause workflow) and **F-4** (the `auto_answered` note unmounts with the gauntlet) are publish-surface items, not run-page items, so they are deferred (below).
- **SEED-348** and **SEED-152** are this phase's requirement seeds, so both are folded.
- **Reported bugs:** `BUG-260610-01` (run nav timer and duplicate avatar) overlaps the run surface but concerns the live chat stream, not the finished-run page, so it stays open and is not folded. No other open Agentic-RAG report overlaps.
</decisions>

<deferred>
## Deferred Ideas

- **SEED-360 F-2:** the independent judge blocks the planted pause workflow in most attempts. That is a publish-gauntlet judge-prompt question, for a phase that touches `publish_service.py`'s judge.
- **SEED-360 F-4:** the `auto_answered` note is never seen because publish unmounts the gauntlet. It needs a decision on where a post-publish note lives (library card, toast, workflow detail).
- **Run-level confidence rollup** (SEED-152 Q1), and **confidence as a branching predicate** (SEED-141, SEED-014).
- **Confidence on the canvas node card** (SEED-152 Q4).
- **Citation export from chat** (v2.2 deferral; same artefact, other surface).
- **SEED-223** (what an approval receipt records): read it when planning D-01, but extending it is not in scope.
- **Lint ceiling wording when not a multiple of 60** (288 WR-02): left at the default 1800; operator call.
</deferred>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 289 (goal, 5 success criteria, failure modes, flags)
- `.planning/REQUIREMENTS.md` VIS-03, TRUST-01
- `.planning/seeds/SEED-348-one-page-that-shows-what-a-run-did-and-on-what-evidence.md` and `.planning/v2.9-STRETCH-CARRYFORWARD.md` lines 113-150
- `.planning/seeds/SEED-152-confidence-on-workflow-phase-outputs.md`
- `.planning/seeds/SEED-360-answering-a-paused-run-does-not-resume-it.md`
- `.planning/phases/288-drafts-that-survive-pauses-that-publish/288-REVIEW.md` (CR-01, WR-01, WR-04), `288-VALIDATION.md` (F-1..F-4 evidence), `288-CONTEXT.md` A-05..A-07
- `backend/app/api/runs.py:564-710` (`_redrive_paused_workflow_run`, `_wake`), `backend/app/services/harness_engine.py` (`_resume_run`, `_build_resume_context`)
- `backend/app/services/agent_loop.py:949` (`_compute_confidence`), `backend/app/services/embedding_service.py:238`, `backend/app/models/message.py`
- `backend/app/db/workflows.py:445-523` (`definition_snapshot` and the string-scalar finding)
- `backend/app/api/workflow_runs.py` (`read_workflow_run`, `compose_waiting_on`)
- `frontend/src/pages/WorkflowRunPage.tsx`, `frontend/src/components/workflows/RunReceipt.tsx`, `receiptVocabulary.ts`, `frontend/src/components/panel/PendingAskCard.tsx`
- `docs/HOT-FILE-LEDGER.md` sections for the D-16 files
- Skill `sketch-findings-agentic-rag` (run surface, receipt, ConfidenceChip contracts)
</canonical_refs>

<how_we_would_know_this_failed>
## How we would know this failed

- The page shows the current workflow definition instead of the version the run used.
- The export omits the cited sources, or differs from the page.
- A phase with no KB use shows any confidence.
- Confidence is recomputed with a model call.
- The page offers a write control.
- A member of another org reads the page or export, or a same-org non-owner sees the owner's email.
- An answered paused run stays `active` and never completes.
- The expired card still says "agent stopped" for a run that is waiting.
- The "continues as soon as they answer" sentence comes back without a live drive behind it.
</how_we_would_know_this_failed>

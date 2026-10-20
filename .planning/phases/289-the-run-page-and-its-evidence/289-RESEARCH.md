# Phase 289: The Run Page and Its Evidence - Research

**Researched:** 2026-10-19
**Domain:** run surface (React), org-scoped read (FastAPI + asyncpg), harness phase outputs, ask_user re-drive
**Confidence:** HIGH for the backend findings (read and, for SEED-360, reproduced). MEDIUM for the frontend migration cost, which is measured but not driven.

## Summary

SEED-360's root cause is **found and reproduced**, read-only, against the live local database. `db/workflows.get_ask_user_response` (`backend/app/db/workflows.py:2319-2337`) and its sibling `ask_user_response_exists` (`:1720-1738`) put `$1::text` inside a `JOIN … ON` clause and `wr.id = $1` in the `WHERE`. Postgres analyses `FROM`/`JOIN` before `WHERE`, so the explicit cast types `$1` as `text`. The `WHERE` then becomes `uuid = text` and fails on every call with `asyncpg.exceptions.UndefinedFunctionError: operator does not exist: uuid = text`.

That call is the first thing the resume branch does (`harness/human_input.py:169-185`). The exception travels `_exec_llm_human_input` → `run_workflow` → `_resume_run`, and `_wake`'s `except` (`api/runs.py:660-662`) only logs it. `resume_run` had already flipped the run to `active` (`runs.py:651`), so the run stays `active` with the `approve` phase `active` and no producer. That is exactly F-3. The fix is one token in each statement: `$1::uuid::text` instead of `$1::text`, which the same probe verifies returns cleanly.

The defect is **inherited**. Both statements are byte-identical at base `266e344c9`. The consume query was added in Phase 200-03 (`613814426`, 2026-08-19), and every test of it mocks the pool, so it had never run against Postgres. The traceback from 288-04's drives cannot be recovered: those drives ran on the torn-down `:8001` worktree backend, and the rows were deleted in cleanup. The live `:8000` backend does write `backend/logs/backend.<pid>.log` at INFO, so the plan's live drive will capture the log line.

VIS-03 needs **no migration and no new write**. `read_workflow_run` already decodes `definition_snapshot` in both jsonb shapes (`api/workflow_runs.py:395-414, 956-959`). The snapshot carries `slug/version/name` (`models/harness.py:670-675`). Citations are already stored on each phase output (`phase_types.py:926-929, 1056-1060`, read at `workflow_runs.py:1214-1237`). Verdicts are `harness_audit` rows keyed by `run_id`.

The real blocker for D-05 is **RLS**. Every SELECT policy on `workflow_runs`, `workflow_phases`, `harness_audit` and `workflow_definitions` is owner-only (`full-schema.sql:9872, 9825, 8670, 8628`). A user-JWT read by a same-org colleague therefore returns nothing. The recommended read is the asyncpg pool (BYPASSRLS) with the org predicate written into the one query, which is the shipped `db/workflows.py` library-feed posture. That keeps migration 211 unused.

TRUST-01 is cheaper than CONTEXT assumed. The harness already lazy-imports `_compute_confidence` for its run-level answer (`harness_engine.py:364-388`), so the function is reachable with no refactor. Every KB-reading phase output already persists the per-call `similarity_scores` list that chat averages (`phase_types.py:929, 1060`). Per-phase confidence is one helper call in the two KB-reading executors, and **`harness_engine.py` need not be touched at all**.

**Primary recommendation:** 4 plans in 3 waves. Fix SEED-360 at the SQL first, since it is a 2-token change. Carry confidence as one `confidence` key computed by a new pure helper. Serve the evidence page from a new org-scoped, terminal-only pool read in its own module. Budget the frontend test migration explicitly: **45 of 172 `WorkflowRunPage.test.tsx` cases mount a terminal run**, and D-14a changes what a terminal run renders.

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**VIS-03: one read-only page and its export**
- **D-01 (assembly, no new runtime writes).** One server read composes the four sections (definition version, phase log, verdicts, cited sources) from `definition_snapshot`, `workflow_phases`, `harness_audit` and the phases' citation outputs. If a plan proposes a new write or table for this, the scope has drifted (SEED-348). *Why:* everything is already recorded; a second store would drift from the first.
- **D-02 (the run page in its finished state IS the page).** No second run page. A finished run on `WorkflowRunPage` renders the read-only evidence view, built from the D-01 read and with no write controls. Research must confirm how the page is reached, because the app has no URL router (memory `reference_app_has_no_router`). If a shareable address is needed for SC#3, research names the smallest way to get one. *Why:* 286 split this file so 289 could add to it; a second page is a second truth. G-5: one mount, prop or helper on `WorkflowRunPage.tsx`.
- **D-03 (export from the same payload).** The export is the D-01 payload rendered two ways: a JSON download and a print view (browser print to PDF). A test asserts that the export's four sections equal what the page renders, by content, not by testid. *Why:* SC#2 says "matching what the page shows"; one source makes that true by construction. Presence assertions miss content drift (memory).
- **D-04 (the version is the snapshot, never the current definition).** The page shows the definition as the run ran it, from `definition_snapshot`, with its version label. If the live definition has changed since, the page says so in words. *Why:* this is the roadmap's first named failure mode.
- **D-05 (access = the run's organisation, read-only).** Org members can read a finished run of their org; other users get **404** (never 403, so a run's existence is not confirmed). The owner keeps write paths (answer, cancel); a non-owner gets none. The 288 A-06 privacy rule holds: a non-owner never sees the owner's email or the prompt line beyond what the receipt itself records. This is driven live as a second user from another org, and as a same-org non-owner. *Why:* SC#3; the dev account is in two orgs (memory), so prove the active org first.
- **D-06 (finished only).** The evidence view is for terminal runs (completed, failed, cancelled). An active or paused run keeps the live surface. *Why:* the requirement says "finished run"; a half-written receipt is a claim about a run that has not ended.

**TRUST-01: confidence on KB-derived phase outputs**
- **D-07 (reuse the chat computation, no model call).** Confidence comes from the same function chat uses, applied to the retrieval results that phase actually used. Research says whether `_compute_confidence` is reachable from the harness without a refactor; if not, the smallest extraction to a shared pure helper is allowed. *Why:* SC#5, and SEED-152's whole point.
- **D-08 (per phase, on the phase output).** It is stored as ONE optional field on the phase output (the 286 forecast for `phase_types.py`: "one optional output field, no new type"). There is no run-level rollup in this phase. Migration 211 only if the phase output has no place for it; research decides.
- **D-09 (no KB, no confidence).** A phase that did no retrieval carries `None`, and the UI shows **nothing**: not "low", not "n/a" chips. A KB phase whose retrieval returned zero results shows the chat path's own low/none wording. *Why:* the roadmap's named failure is "a phase with no KB use shows high"; absence must render as absence.
- **D-10 (shown on the run surface and in the receipt, not on the canvas).** It goes on the phase step of the run surface and in the evidence view or receipt. The canvas node card is out of scope (SEED-152 Q4: the corner and badge slots are claimed).

**SEED-360: a paused run that is answered resumes**
- **D-11 (root cause first, then fix).** Before any fix: reproduce in a live run, capture the `ask_user_response: re-drive failed` traceback (or prove the skip path), and record it in RESEARCH or the SUMMARY. Check it at base `266e344c9` as well, to establish inherited versus new. *Why:* nobody has seen the failing line; a fix for an unread traceback is a guess.
- **D-12 (no run left active without a producer).** Whatever `_resume_run` raises, `_wake`'s failure arm must leave the run in a state the surfaces can tell truthfully: re-paused if the answer can be retried, or failed with a worded reason. It must never stay `active` with no producer. A test plants a raising `_resume_run` and asserts the final status (288 WR-01).
- **D-13 (the expired card offers the answer).** For a run that is `paused` with an unanswered prompt, `PendingAskCard` shows an answer control, not "EXPIRED … agent stopped". Answering it drives D-11/D-12's path. The 288 paused sentence ("Still waiting on X.") gets back "the run continues as soon as they answer" only after a live drive proves a paused run completes. *Why:* 288 had to soften that sentence because it was untrue; it is restored by evidence, not by intent.

**Process and guardrails**
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

**Folded seeds and bugs**
- **SEED-360 folded** (F-1, F-3, and 288 WR-01 as D-11..D-13). **F-2** (the judge blocks the planted pause workflow) and **F-4** (the `auto_answered` note unmounts with the gauntlet) are publish-surface items, not run-page items, so they are deferred (below).
- **SEED-348** and **SEED-152** are this phase's requirement seeds, so both are folded.
- **Reported bugs:** `BUG-260610-01` (run nav timer and duplicate avatar) overlaps the run surface but concerns the live chat stream, not the finished-run page, so it stays open and is not folded. No other open Agentic-RAG report overlaps.

### Claude's Discretion
CONTEXT.md has no separate discretion section. Its header says every call "can be overruled and none is a one-way door". Research treats the evidence payload's exact shape, module placement, the deep-link mechanism, the D-12 terminal choice, and the KB label as discretion, with recommendations below.

### Deferred Ideas (OUT OF SCOPE)
- **SEED-360 F-2:** the independent judge blocks the planted pause workflow in most attempts. That is a publish-gauntlet judge-prompt question, for a phase that touches `publish_service.py`'s judge.
- **SEED-360 F-4:** the `auto_answered` note is never seen because publish unmounts the gauntlet. It needs a decision on where a post-publish note lives (library card, toast, workflow detail).
- **Run-level confidence rollup** (SEED-152 Q1), and **confidence as a branching predicate** (SEED-141, SEED-014).
- **Confidence on the canvas node card** (SEED-152 Q4).
- **Citation export from chat** (v2.2 deferral; same artefact, other surface).
- **SEED-223** (what an approval receipt records): read it when planning D-01, but extending it is not in scope.
- **Lint ceiling wording when not a multiple of 60** (288 WR-02): left at the default 1800; operator call.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-03 | A finished run has one read-only page, with export, showing definition version, phase log, verdicts and cited sources (SEED-348). | §Evidence read (sources of all four sections, measured); §Access (RLS is owner-only, so use a pool read with an org predicate; no migration); §Page integration (one early-return mount; 45-case test migration); §Deep link (`/app?run=<uuid>`); §Export (one view-model drives the DOM, the JSON and print). |
| TRUST-01 | Each KB-derived phase output carries a confidence level, shown on the run surface and in the receipt; no new model call (SEED-152). | §Confidence (the `_compute_confidence` lazy import already used by the harness; `similarity_scores` already on outputs; one `confidence` key from a new pure helper; a `kb_search_calls` counter in `task_service` for the "searched, nothing matched" arm); §Surfaces (RunSpine reads the wire row, so no page touch; the report step log). |
</phase_requirements>

## CONTEXT claims found false or imprecise (measured)

| # | CONTEXT says | Measured | Consequence |
|---|---|---|---|
| F1 | `embedding_service.attach_confidence` (`:238`) is part of chat's confidence | It renames the **metadata-extraction** `confidence` map to `_confidence` (`embedding_service.py:238-252`). Retrieval confidence is `agent_loop._compute_confidence` alone (`:949-985`, called at `:3550`). | Do not import or reuse `attach_confidence` or `ConfidenceChip`'s tiers. `ConfidenceChip.tsx:30-38` says outright *"These are NOT the retrieval confidence_bucket_high/medium (0.54/0.38) … Do not conflate or import them."* |
| F2 | Recent `definition_snapshot` rows are jsonb string scalars | The writer was fixed to pass a plain dict (`db/workflows.py:523-529`). Only the first 2 rows (2026-08-20) were string scalars. The reader `_coerce_definition` accepts both shapes (`workflow_runs.py:395-414`). | Decode with the existing `_coerce_definition`, which is still correct. Nothing new is needed. |
| F3 | "confidence exists only on the chat path" / `grep confidence harness/` = 0 | `harness_engine._finalize_run_grounding` (`:344-388`) already computes a **run-level** confidence and attaches it to the final assistant message. It calls `_compute_confidence(final_avg)` **without settings**, so it uses defaults while chat uses the user's buckets (`agent_loop.py:3550`). | The per-phase computation must pass `ctx.user_settings` to match chat (SC#5). Record the run-level default-bucket divergence as a note, not a fix (rollup is deferred). |
| F4 | D-09: zero results shows "the chat path's own low/none wording" | Chat has no "none" wording. A zero-result search sets `similarity_score=None` (`search_documents_tool.py:1081-1104`), so no score is appended and **no confidence event fires at all** (`agent_loop.py:3546`). "○ No match found" is new copy from the sketch. | The phase must record that it **searched** (a `kb_search_calls` counter), or "searched, nothing matched" cannot be told apart from "no KB use". |
| F5 | 288 A-06 non-owner arm "is dead code until this phase" | `_read_waiting_on` returns `None` for any terminal run (`workflow_runs.py:807`). The evidence view is terminal-only (D-06), and non-owners can only reach terminal runs. | The A-06 non-owner arm **stays dead** after 289. That is correct, but do not claim it is exercised. |
| F6 | D-16 lists `harness_engine.py` and `RunReceipt.tsx` as touched | Root cause is in `db/workflows.py`, not the engine. Confidence fits in `phase_types.py` plus a new helper. `RunReceipt` is mounted only as `variant="summary"` (`WorkflowRunPage.tsx:1469-1475`), which renders **no rows** (`RunReceipt.tsx` `variant === "summary" ? null`). | Recommend **not touching** `harness_engine.py` or `RunReceipt.tsx`. "The receipt" in SC#4 is the B report's step log. The plan-2/plan-3 overlap D-18 worried about disappears. |
| F7 | D-18: plan 3 touches `api/runs.py`, plan 1 touches `workflow_runs.py` | Plan 3 also needs `db/workflows.py` (the SQL fix). The D-13 sentence restore lives in `workflow_runs.py:782` (`compose_waiting_on`). | Put the evidence read in **new modules** so plan 1 does not touch `workflow_runs.py`. Put the sentence restore in plan 4, after the live drive. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Org-scoped access decision (404 parity) | API / Backend | Database (pool query predicate) | RLS is owner-only. The org predicate must be written into the one SQL statement, not left to policy. |
| Evidence assembly (4 sections, edited-since) | API / Backend | — | Reads `workflow_runs`, `workflow_phases`, `harness_audit`, `workflow_definitions`, `profiles` and `organizations` in one handler. The client never joins. |
| Per-phase confidence computation | Backend (harness executors, write time) | — | Same function and buckets as chat, frozen at write time so a later bucket change does not re-label a record. |
| Confidence display (evidence line) | Browser | — | Server sends level, score, disclaimer and passages. The client renders the 028 anatomy and decides no tier itself. |
| Report rendering, print, JSON export | Browser | — | One view-model feeds the DOM and `JSON.stringify`. Print is CSS. |
| Paused-run answer control | Browser | API (`POST /runs/{id}/ask_user_response`) | The card gets one prop. The server re-drive is the authority. |
| Re-drive failure terminal state | API / Backend | Database (existing writers) | `fail_phase` + `finish_run` + `write_audit`. No new SQL. |

## Standard Stack

No new packages. Everything is already in the tree.

| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| FastAPI + Pydantic | in tree | evidence route + response model | `response_model` drops undeclared keys silently. Declare, select and populate in lockstep (`workflow_runs.py:132-136`). |
| asyncpg pool (`deps.get_pg_pool`) | in tree | org-scoped evidence read | Pool connections bypass RLS. `get_user_pg_connection` (`dependencies.py:159-177`) is the RLS-enforced variant. The pool installs a jsonb codec (`_init_pg_connection`), so **never pass a pre-dumped string** (`db/workflows.py:465-486`). |
| Tailwind 3.4 `print:` variant | ^3.4.19 | print view | [CITED: v3.tailwindcss.com/docs/hover-focus-and-other-states, "Print styles"] |
| React 19 / vitest 4 | in tree | report + tests | — |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. Slopcheck was not run because there is nothing to check.

| Package | Registry | Disposition |
|---|---|---|
| (none) | — | — |

## Architecture Patterns

### System Architecture Diagram

```
                ┌──────────── browser ────────────────────────────────────────────┐
 /app?run=<uuid>│ App.tsx view init ──► ChatLayout(activeRunId) ──► WorkflowRunPage│
 RunLogPanel ──►│                                                   │              │
 doRun/launch ─►│   useWorkflowRun (owner read GET /workflow-runs/{id})            │
                │      ├─ 200 & non-terminal ─► LIVE surface (RunSpine + evidence  │
                │      │                         line from wire row.confidence;    │
                │      │                         PendingAskCard paused={…})        │
                │      ├─ 200 & terminal ─────┐                                    │
                │      └─ 404 (not owner) ────┴► <RunEvidenceReport runId=…>       │
                │                                 GET /workflow-runs/{id}/evidence  │
                │                                  ├─404 ► "This run isn't available"│
                │                                  └─200 ► view-model ─┬► DOM (B)  │
                │                                                      ├► JSON blob │
                │                                                      └► print CSS │
                └─────────────────────────────────────────────────────────────────┘
                                         │
       ┌──────────── API ────────────────▼───────────────────────────────────────┐
       │ require_canvas ► canvas_caller ► ONE pool SELECT:                       │
       │   wr.id=$1 AND status IN (completed,failed,cancelled)                   │
       │   AND (wr.user_id=$2 OR EXISTS org_members(org_id=wr.org_id,user=$2))   │
       │   miss ► 404 {"detail":"Run not found"} (same body as owner read)       │
       │ hit ► snapshot(decode) + phases(output unwrap) + harness_audit(verdict  │
       │       kinds, metadata unwrap) + citations(dedupe, cited_by) +           │
       │       definitions(edited-since) + profiles/organizations(names)         │
       └──────────────────────────────────────────────────────────────────────────┘
 Write side (unchanged except one key):  llm_agent / llm_batch_agents executor
   result.similarity_scores + result.kb_search_calls ─► phase_confidence(…, ctx.user_settings)
   ─► output["confidence"] ─► complete_phase (existing) ─► workflow_phases.output jsonb
 Answer side:  PendingAskCard (paused) ─► POST /runs/{wf_run_id}/ask_user_response ─► harness arm
   ─► _redrive_paused_workflow_run ─► resume_run ─► _wake ─► _resume_run ─► human_input consume
   ─► get_ask_user_response  [THE BUG: uuid = text]  ─► fix ─► phase completes ─► run completes
   failure (any) ─► fail_phase(active, worded) + finish_run(failed) + audit run_failed
```

### Recommended Project Structure (new files)

```
backend/app/
├── api/workflow_run_evidence.py      # GET /workflow-runs/{id}/evidence (router, prefix /workflow-runs)
├── services/run_evidence.py           # pure composers: sections, verdict filter, sources dedupe, edited-since
└── services/harness/phase_confidence.py # pure: (scores, searched, user_settings) -> dict | None
frontend/src/
├── lib/api/runEvidence.ts             # getRunEvidence(runId) + RunEvidence types
├── lib/runDeepLink.ts                 # readRunDeepLink(): uuid | null (validated)
├── components/workflows/RunEvidenceReport.tsx   # B report (loading/404/report)
├── components/workflows/evidenceView.ts         # payload -> view-model (ONE source for DOM + JSON)
├── components/workflows/evidenceVocabulary.ts   # all report + evidence-line words
└── components/workflows/StepEvidenceLine.tsx    # "Answered from … · N passages · ● Medium · 0.47"
```

### Pattern 1: Org-scoped terminal read, one query, 404 parity
**What:** A single pool `fetchrow` carrying id, terminal status and (owner OR org member) in one predicate. A miss returns the same `{"detail": "Run not found"}` body as `read_workflow_run`.
**Why one query:** `workflow_runs.py:880-883`: *"A two-step 'fetch, then compare owner' would answer a foreign id along a different … path than a nonexistent one, which is a probe channel."*
```python
# Source: pattern from api/runs.py:613-627 (pool fetchrow with explicit predicate) + workflow_runs.py:884-910
row = await pool.fetchrow(
    """
    SELECT wr.id, wr.thread_id, wr.definition_id, wr.status, wr.org_id, wr.user_id,
           wr.created_at, wr.updated_at, wr.definition_snapshot, wr.model, wr.is_golden_run
    FROM workflow_runs wr
    WHERE wr.id = $1
      AND wr.status IN ('completed', 'failed', 'cancelled')
      AND (wr.user_id = $2
           OR EXISTS (SELECT 1 FROM org_members m
                      WHERE m.org_id = wr.org_id AND m.user_id = $2))
    """,
    run_id, UUID(current_user["id"]),
)
if row is None:
    raise HTTPException(status_code=404, detail="Run not found")
viewer_is_owner = str(row["user_id"]) == str(current_user["id"])
```
`timed_out` is in the frontend's `TERMINAL_RUN_STATUSES` (`lib/phaseState.ts:256`), but `workflow_runs_status_check` does not admit it (`full-schema.sql:4272`). Use the three DB literals.

### Pattern 2: Read-side unwraps (the jsonb string-scalar trap, three columns)
- `workflow_phases.output`: use `phase_output_object` (`models/thread.py`), as `workflow_runs.py:1034` does.
- `workflow_runs.definition_snapshot`: use `_coerce_definition` (`workflow_runs.py:395`). Import it or move it to a shared spot. Do not copy it.
- **`harness_audit.metadata` is double-encoded too.** `write_audit` passes `json.dumps(metadata)` into `$4::jsonb` on a pool that already has the jsonb codec (`db/workflows.py:2566-2572` vs `:465-486`). Run it through the same `phase_output_object` unwrap.

### Pattern 3: Confidence computed once, at write time, by the chat function
```python
# services/harness/phase_confidence.py  (new, pure; mirrors harness_engine.py:364-388 lazy import)
def phase_confidence(similarity_scores, searched: bool, user_settings) -> dict | None:
    if not searched:
        return None                                   # D-09: no KB use -> absent
    from app.services.agent_loop import CONFIDENCE_DISCLAIMER, _compute_confidence  # noqa: PLC0415
    scores = [s for s in (similarity_scores or []) if isinstance(s, (int, float))]
    if not scores:
        return {"level": "none", "avg_similarity": None, "disclaimer": None}
    avg = sum(scores) / len(scores)                   # same mean-of-per-call-avgs as agent_loop.py:3547
    level = _compute_confidence(avg, user_settings)   # same buckets as chat (agent_loop.py:3550)
    return {"level": level, "avg_similarity": round(avg, 4),
            "disclaimer": CONFIDENCE_DISCLAIMER if level == "low" else None}
```
Call sites, one dict entry each:
- `_exec_llm_agent` return (`phase_types.py:924-937`): `"confidence": phase_confidence(result.get("similarity_scores"), bool(result.get("kb_search_calls")), getattr(ctx, "user_settings", None))`
- `_exec_llm_batch_agents` return (`:1055-1061`): same, with `any(r.get("kb_search_calls") for r in results)`.

`task_service.run_task_sub_agent` (`task_service.py:779-806, 997-1007`) gains a `kb_search_calls` counter, incremented when `tc.get("name") == "search_documents"`. It is an additive return key, like the F7 grounding keys. Only `search_documents` produces a similarity score (`grep similarity_score` → only `search_documents_tool.py`), so count only that tool. The passage count is computed at read time from that phase's deduped `citations`.

### Pattern 4: The finished page is one early return on `WorkflowRunPage`
Mount it **after every hook**, in the existing load-screen block (`WorkflowRunPage.tsx:1135-1160`), so the 286 hooks (`useWorkflowRun`, `useWorkflowRunPoll`) still run, and the terminal edge's one-shot reconcile still fires:
```tsx
if (runId && (loadPhase === "missing" || (loadPhase === "ready" && run && isTerminal))) {
  return <RunEvidenceReport runId={runId} onBack={onBack}
           onOpenThread={loadPhase === "ready" ? onOpenThread : undefined} />
}
```
The `missing` arm is what lets a same-org non-owner see the report: their owner read 404s, and the report's own read decides. An outsider gets the report's own 404 screen, with the sketch copy "This run isn't available" / "It may not exist, or it belongs to an organisation you're not in. Nothing about it is shown here."

### Pattern 5: Deep link without a router
`App.tsx:154-166` already reads one query param once at boot and strips it (`?connections=1`), and `/app` survives Vercel and dev routing (`vercel.json:6`, `devRouting`).
- Add `readRunDeepLink()` in a new `lib/runDeepLink.ts`. It parses `?run=`, validates it as a UUID, and returns `null` otherwise.
- `App`'s `useState<ActiveView>` initializer returns `"workflow-run"` when a link is present.
- `ChatLayout`'s `useState<string | null>(null)` for `activeRunId` (`ChatLayout.tsx:304`) seeds from the same helper.
- That is one touch each on `App.tsx` and `ChatLayout.tsx`.
- ⚠ `canvasEnabled` is `false` until features load (`ChatLayout.tsx:322-323`), so the positional fallback flashes first. That is acceptable. Do not strip the param until the run page has mounted, or a reload loses it.

### Pattern 6: One view-model, three renderings (D-03)
`evidenceView.ts` turns the payload into `{facts, sections:[{n, title, rows…}]}`. The DOM renders the view-model. The JSON download is `JSON.stringify({run, definition, phase_log, verdicts, sources})` of the **same** fetched payload, through the blob idiom (`AuditTab.tsx:222-232`). Print is the same DOM. The content test extracts each section's text from the DOM and asserts **set equality** with the view-model's strings for that section: phase names, source filenames, verdict sentences, version label. It also asserts the JSON's section arrays have the same members. Assert content, never testid presence.

### Anti-Patterns to Avoid
- **Widening `read_workflow_run` to org members.** That route serves live runs, `waiting_on`, cost and the owner's write context. It runs on the user-JWT client, whose RLS is owner-only, so removing `.eq("user_id")` would return nothing anyway. Keep the owner read as it is and add a separate terminal-only door.
- **An RLS SELECT policy for org members (a migration 211).** It would widen every user-JWT reader of these four tables at once. `list_workflow_runs` and the citations route filter by `user_id` explicitly, but any future reader would inherit the org-wide scope silently. Rejected.
- **Importing `RunReceipt` into the report.** `RunReceipt.test.tsx:276` pins its importers to exactly `["WorkflowRunPage.tsx"]`. Reuse the vocabulary (`receiptVocabulary.ts`, `phaseDuration.ts`), not the component.
- **Using `ConfidenceChip` or `ConfidenceBadge` for the run line.** `ConfidenceChip` computes metadata tiers (0.75/0.5). `ConfidenceBadge` is colour-only with no score. Build `StepEvidenceLine` on 028's anatomy, with glyph + word + raw score, and take the level from the server.
- **Comparing raw snapshot JSON to the live `definition` for "edited since".** The snapshot is `model_dump(mode="json")` with every default filled in. The stored definition is whatever was saved. Raw dict equality would report "changed" on unchanged runs. See Pitfall 5.

## Evidence read: where each section lives (measured)

| Section | Source | Decode | Notes |
|---|---|---|---|
| Definition + version label | `workflow_runs.definition_snapshot` (mig 122). Fields `slug/version/name/phases` (`models/harness.py:670-675`). | `_coerce_definition` | **No backfill.** Runs before mig 122 have NULL, so fall back to the `definition_id` row and say so ("This run predates version recording"). Never present it silently as the snapshot. |
| Phase log | `workflow_phases` (`slug, phase_index, status, started_at, completed_at, output`) ordered by `phase_index`. Name and type come from the snapshot phases (`_slug_to_phase_type` `:436`, `step_identity`). | `phase_output_object` | Reuse the existing derivations: `declared_phase_measure`, `deliverable_text`, `_failure_reason` (`workflow_runs.py:1034-1061`). |
| Verdicts | `harness_audit WHERE run_id=$1`. Verdict kinds: `gate_passed`, `gate_failed`, `emit_validated`, `emit_rejected`, `emit_integrity_failed`, `validator_ask_user_approved`, `policy_applied`, `action_risk_pending`, `tool_refused`, `external_action_sent`, `circuit_breaker_tripped` (CHECK list `full-schema.sql:2713`; writers `harness_engine.py:748-2804`, `phase_types.py:1284/2419/2799`). | `phase_output_object` on `metadata` | `gate_passed` metadata is only `{"phase": slug}` (`harness_engine.py:1142-1145`). Name *what* was checked from the snapshot phase's `validators` list. `judge_verdict` is written on the **publish golden run**, not on ordinary runs, so the sketch's "Independent review" row has no per-run source. See Open Q2. |
| Cited sources | each phase `output["citations"]` (`document_id, filename, chunk_index, passage, similarity, version_number, source_connection_name`), `phase_types.py:926-929` / `search_documents_tool.py:1087-1101` | `phase_output_object` | Dedupe by `(document_id, chunk_index)` (`agent_loop._deduplicate_citations`), with `cited_by` = phase slugs. **Location = filename + passage number (chunk_index); no page numbers exist.** The sketch's "p. 12" cannot be produced honestly. **Ship no `passage` text or `similarity`** (the `WorkflowRunCitationRead` allow-list precedent, `workflow_runs.py:375-392`). |
| Started by / org | `profiles.display_name`, `organizations.name` | — | Non-owner gets the display name or the words "the person who started this run" (`workflow_runs.py:738`), **never an email** (A-06). The owner may see the email with "(you)". |
| Edited since | see Pitfall 5 | — | `definition_changed: {changed, current_version}` |

**Proposed response model** (`RunEvidenceRead`): `{run: {id, status, workflow_name, version, started_at, completed_at, started_by: {name, email?}, org_name, model, viewer_is_owner}, definition: {recorded: bool, version, phases: [...], full: dict}, definition_changed: {changed: bool, current_version: int|null}, phase_log: [{n, slug, name, phase_type, status, started_at, completed_at, step_count, step_noun, deliverable_text, failure_reason, confidence|null, passages}], verdicts: [{phase, kind, result, detail, at}], sources: [{document_id, filename, locations:[chunk_index], cited_by:[slug]}]}`. Endpoint: `GET /workflow-runs/{workflow_run_id}/evidence`, `require_canvas()` only, path added to `CANVAS_GATED_PATHS` (`middleware/canvas_gate.py:88-112`) in the same commit as the `include_router` line in `main.py:897`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Confidence level | new buckets / thresholds | `agent_loop._compute_confidence(avg, user_settings)` + `CONFIDENCE_DISCLAIMER` | SC#5. The function is already lazy-imported by the harness (`harness_engine.py:364-368`). |
| jsonb unwrap | `isinstance(x, dict)` checks | `phase_output_object`, `_coerce_definition` | The string-scalar trap holds on 484/484 completed outputs (`workflow_runs.py:72-76`). |
| Org membership | header-based active org | `EXISTS org_members` inside the read's own SQL | The run's org decides access, not the viewer's active org. Same table as `_caller_role_in_org` (`threads.py:730-744`). |
| Re-drive failure state | new SQL | `get_active_phase` + `fail_phase` + `finish_run` + `write_audit(run_failed)` | All exist (`db/workflows.py:1672, 1961, 2351, 2511`). |
| Citation dedupe | new loop | `agent_loop._deduplicate_citations` | Same `(document_id, chunk_index)` key as chat. |
| File download | new helper | the blob idiom (`AuditTab.tsx:222-232`) | Three copies exist already. Do not add a shared helper in a hot file. |

## SEED-360 (D-11 / D-12 / D-13)

### D-11: the root cause (measured)

Reproduction, read-only: I ran the exact SQL text with `asyncpg.connect(settings.postgres_dsn)` inside `transaction(readonly=True)`, using the scratchpad scripts `probe_sql.py` and `probe_sql2.py`.

```
get_ask_user_response SQL RAISED: UndefinedFunctionError operator does not exist: uuid = text
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.
ask_user_response_exists RAISED: UndefinedFunctionError operator does not exist: uuid = text
fixed ($1::uuid::text) OK -> False
```

- The failing line is `db/workflows.py:2329`, `AND p.tool_calls->0->>'run_id' = $1::text` in the JOIN, against `:2331` `WHERE wr.id = $1`. The sibling has the same shape at `:1731`/`:1733`.
- Call chain: `api/runs.py:937` → `_redrive_paused_workflow_run` → `resume_run` (`:651`, paused→active) → `_wake` → `_resume_run` (`harness_engine.py:3130`) → `run_workflow` → `mark_phase_active(approve)` → `_exec_llm_human_input` resume branch (`human_input.py:169-185`) → `get_ask_user_response` → **raises**. The error propagates out of `run_workflow`, because a mid-work exception leaves the phase active (`harness_engine.py:1736-1739`). `_wake` logs `ask_user_response: re-drive failed for run %s` and finalizes only the producer shell.
- **Inherited:** `git diff 266e344c9 HEAD` shows both statements unchanged. The function was added at `613814426` (Phase 200-03). Its only tests fake the pool (`tests/test_200_human_gate_pause.py:424-458`). `ask_user_response_exists` is also latent in the boot sweep. It is reached only when an active phase's output carries a `tool_call_id` (`harness_engine.py:3185-3187`), which an in-flight phase does not have, so it has likely never run live either.
- **Traceback for the record:** the 288-04 drives ran on the `:8001` base-worktree backend (`288-VALIDATION.md:113`). That backend was torn down and the rows deleted. `grep -r "re-drive"` over `backend/logs/` and the remaining worktree logs finds nothing. The `:8000` backend writes `backend/logs/backend.<pid>.log` at INFO (`backend.28384.log:1`). **The plan's live drive will capture the line.** Grep for `re-drive failed`, `re-drive skipped`, `paused re-drive raised` (`runs.py:939-942`, raised when `_build_resume_context` throws) and `has no loadable definition`.
- **Fix:** `$1::uuid::text` in both JOIN clauses. The first occurrence then types `$1` as uuid, and the cast to text is explicit. Add a **DB-backed** test (under `backend/tests/`, not `tests/unit`, because the unit suite mocks the pool) that calls both functions through a real pool. It is RED today and GREEN after the fix.

### D-12: the failure arm
Two holes, both in `api/runs.py`:
1. `_wake`'s `except` (`:660-662`) only logs.
2. `ctx = await _build_resume_context(...)` (`:653`) runs **outside** `_wake`, after `resume_run`. A raise there reaches the route's `except` (`:938-942`), which logs and returns 200, so the run is left `active`.

**Recommendation: fail with a worded reason, and do not re-pause.** Re-pausing is *not retryable through the UI*. The answer row already exists, so `get_unanswered_ask_user` returns None, `/pending` omits the answered prompt, and no card can be shown to answer again. `claim_run`'s 300 s lease (`config.py:1655`) would also skip a retry. Add one helper in `runs.py`, `_fail_redrive(pool, run_id, reason)`:
- `get_active_phase`
- `fail_phase(id, "Your answer was saved, but the run could not continue.")`
- `finish_run(failed)`, which also clears the anchor
- `write_audit(run_failed, {"reason": "ask_user re-drive failed"})`

Call it from both holes, and move `_build_resume_context` inside the guarded region. Tests: plant a raising `_resume_run`, then plant a raising `_build_resume_context`, and assert the final run status is `failed` and the phase is `failed` with the reason. Reuse the `_RedriveFakePool` harness in `test_200_human_gate_pause.py:424-458`.

### D-13: the paused card
- `PendingAskCard` flips to `expired` purely on its countdown (`PendingAskCard.tsx:345-359`) and then renders "No response within … — agent stopped" (`:574-577`).
- Add **one optional prop** `paused?: boolean`. When it is true, the `remaining <= 0 → expired` transition is skipped and the clock span (`:619`) is replaced by a calm line, for example "The answer window has passed. The run is paused until you answer." The rest of the pending layout (choices, free text, Send) is the existing live-answer layout.
- `answerAskUser(run_id, …)` posts with `ask.run_id`, which is the **workflow run id** written into the prompt row (`human_input.py:233`), so the route takes its harness arm (`runs.py:762-785`).
- `WorkflowRunPage` passes `paused={runStatus === "paused"}` at its single mount (`:1539-1547`).
- The chat panel's `PendingAskStack` (`:806-830`) has no run status. It stays countdown-driven, which is a named gap: F-1 was observed on the run page.
- Restore the sentence at `workflow_runs.py:782` (`f"Still waiting on {who}."`) only after S5 is driven green, and update `test_288_waiting_on.py` in the same commit.

### Not fixed, record it: a resumed segment changes model
`_build_resume_context` sets `model=resolve_workflow_ctx_model(owner_settings)` (`harness_engine.py:3061-3085`) and no `provider`. It never reads `workflow_runs.model`, and the re-drive row select omits it (`runs.py:613-622`). A run started with a per-request model (the UAT roster method) therefore finishes its post-pause steps on the owner's **default** model. The S5 roster rows will show it. Record it, or plant a seed. Fixing it means touching `harness_engine.py`, which is G-5 OWED.

## Page integration and the test-migration cost

- **The swap happens after all hooks**, so `useWorkflowRunPoll`'s terminal edge still fires. The seam286 pin's terminal cases (2 of 10) will now render the report, so they need the evidence client mocked under the same `@/lib/api` specifier or the new specifier.
- **Measured:** **45 of 172** `WorkflowRunPage.test.tsx` cases mount a terminal run (scripted scan over `mkRun({status: completed|failed|cancelled})` and `runWithAnswer(`). After D-14a those cases render the report, so their assertions about RunHero, RunSpine, the canvas, the files list and the receipt summary on a terminal run fail. The count gate forbids a per-file decrease. Each case must be **converted**: re-target it at `status: "active"` where it tests live behaviour, or re-assert the report's equivalent. **Budget this as its own task in plan 1.**
- **Owner-only affordances on a finished run must survive or be dropped deliberately:** RunHero's deliverable download, "Open the chat thread", the cost badge, and the canvas "Shape" view. The sketch shows "Deliverable" in the facts strip. Recommend owner-only links in the title block for "Open the chat thread" and the deliverable download, and no write controls.
- **Print:** the page is nested in `h-full overflow-hidden` shells (`WorkflowRunPage.tsx:1162`, the ChatLayout grid), so a naive print captures one screen. Use one `@media print` block in `index.css`: `visibility: hidden` on everything, then visible plus `position: absolute; inset: 0; overflow: visible` on `[data-print-root]`. Add `print:hidden` on the export buttons. This touches no shell file.

## Common Pitfalls

### Pitfall 1: owner-only RLS makes a user-JWT org read silently empty
**What goes wrong:** a colleague gets 404 or an empty page even though the code "allows" org members. **Why:** policies `workflow_runs_select_own` and the other three require `auth.uid()` = owner. **Avoid:** use the pool with the explicit predicate. Test it as a second, same-org user in a live drive (S4), not only with mocks.

### Pitfall 2: the canvas flag 404s a colleague
`require_canvas` resolves `visual_workflow_canvas` per caller's audience. A colleague outside the audience gets 404, which looks like "not in org". Prove the flag is on for the second user before calling S4 a pass.

### Pitfall 3: `response_model` drops the new field
`WorkflowRunPhaseRead.confidence` must be declared, read in the serializer **and** added to `_EXPECTED_PHASE_KEYS` in `tests/unit/test_200_1_deliverable_text.py:118` (set equality `:274, 356, 386, 696`). The two-wire-model lockstep (`models/thread.py:365`) needs a **recorded exception** for `WorkflowPhaseState`, in the D-200.1-02-A style: the chat panel already shows the run-level confidence on the final message, and widening `GET /threads/{id}/workflow` would touch `threads.py` (271/91).

### Pitfall 4: the double-encoded audit metadata
`harness_audit.metadata` is stored as a jsonb string scalar (`write_audit` passes `json.dumps(...)` into `$4::jsonb` on the codec pool). `metadata->>'phase'` in SQL returns NULL. Unwrap in Python.

### Pitfall 5: false "edited since this run"
Recommended rule:
- `changed = (exists a definition with the same slug in the run's org whose version > snapshot.version) OR (the run's own definition row is status='draft' AND normalise(row.definition) != normalise(snapshot))`.
- `normalise` is `WorkflowDefinition.model_validate(x).model_dump(mode="json")` inside a `try`. A validation failure on an old shape falls back to the version comparison only.
- Do **not** use `updated_at`. The published-row trigger admits `skill_snapshots` writes at first kickoff (`full-schema.sql:4204`), and those bump the row without any definition edit.

### Pitfall 6: non-owner disclosure through the evidence payload
A colleague can see the owner's **document filenames** and the run's deliverable text. Passages, `similarity`, the email and the ask prompt line are withheld (A-06). The `llm_human_input` phase's `deliverable_text` **is the prompt** (`human_input.py` returns `{"text": prompt, …}`), so suppress it for non-owners or render it as the receipt's recorded question. That is an operator call; see Open Q3.

### Pitfall 7: the hot-file ledger gate fires on NEW files
`check-hot-file-ledger.cjs` fails when `files_modified` names a non-test source file with no ledger row. Every new file above needs a "young (created 289-0N)" row and a section **in the same commit** (the `ThreadWorkflowPicker.tsx` precedent).

### Pitfall 8: the canvas-gate fences
`test_182_canvas_gate.py` must not import `CANVAS_GATED_PATHS` (`:395-418`), and `test_revert_byte_identical.py` probes gated paths. Add the new template and run both suites. The `/workflow-runs/{id}/evidence` template is segment-anchored and does not shadow the citations template.

## Code Examples

### The SQL fix (verified against the live local DB)
```sql
-- db/workflows.py:1731 and :2329 — before:  AND p.tool_calls->0->>'run_id' = $1::text
--                                   after:   AND p.tool_calls->0->>'run_id' = $1::uuid::text
```

### Evidence line (frontend leaf; words from the vocabulary file)
```tsx
// StepEvidenceLine — renders NOTHING for confidence == null (D-09)
// high "✓ High", medium "● Medium", low "⚠ Low" + disclaimer, none "○ No match found"
if (!confidence) return null
```

## State of the Art

| Old | Current | When | Impact |
|---|---|---|---|
| Run reads owner-only via user-JWT | Add an org-scoped terminal read via the pool | 289 | First org-shared read on run tables. Document it as SECURITY-BEARING beside the library feeds. |
| Run-level confidence only (final message) | Per-phase `output["confidence"]` | 289 | Run-level stays on default buckets (F3). |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Membership in the run's org is enough, whatever the viewer's active org (no `X-Org-Id` match required) | Access | A two-org user could read a run while "in" the other org. Low risk, and it matches "access to the run's organisation". |
| A2 | Non-owners may see cited document **filenames** of the owner's possibly private documents | Pitfall 6 | Disclosure beyond what KB RLS allows. The operator should confirm, or the plan shows sources to non-owners as a count only. |
| A3 | The sketch's "<KB>" label renders as "the knowledge base" unless the snapshot binds `project_folder_id`, in which case the folder name is resolved at read time | Confidence | It deviates from the sketch literal when unbound. |
| A4 | D-12 terminal = `failed` (not re-paused) | SEED-360 | The operator might prefer retryable. Re-pause is shown above to be unretryable through the UI. |
| A5 | Counting only `search_documents` calls as "searched" | Confidence | A `read_document`-only step shows no line, which matches chat (no score). |

## Open Questions

1. **Deliverable fact for non-owners.** Workspace files are thread-scoped, owner RLS. Recommend that the facts strip show the emit phase's recorded file name if the phase output carries one, else "Written answer" or "None", with the download owner-only.
2. **"Independent review" verdict.** It exists only on the publish golden run (`judge_verdict`). Recommend omitting it from the per-run verdicts. Optionally show "Published v{n} after checks" without fetching the publish receipt (SEED-223 is deferred).
3. **The ask prompt and answer in the step log for non-owners** (A-06 versus "what the receipt records"). Recommend that the owner sees question and answer, and a non-owner sees "Answered by <display name>" only.
4. **The chat-panel `PendingAskStack` paused case.** It is not fixed here (no run status in the stack). Recommend recording it as a gap in the SUMMARY.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Local Supabase Postgres | evidence read, SQL fix test | ✓ (probe connected) | — | — |
| Backend :8000 | live drives | ✓ `/health` ok, file log sink on | — | The operator restarts it to load fixes (memory: user starts backend) |
| Node | vitest / gates | ✓ | v24.19.0 | — |
| Python venv | pytest | ✓ | 3.12.6 | — |
| Second user in another org + same-org non-owner | S4 | ✗ (not verified) | — | Create local users through the Supabase Auth admin path. This is a local mutation, so take the local-DB lock (memory). |
| Anthropic key | roster row 2 | ✗ billing-blocked at 288 | — | Re-test, and record ⛔ with the reason |

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Backend | pytest (venv). Unit: `backend/tests/unit`. DB-backed: `backend/tests/` |
| Frontend | vitest 4 + RTL |
| Quick run | `cd backend && venv/Scripts/python -m pytest tests/unit/test_289_*.py -q` · `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run <files>` |
| Full suite | `node scripts/check-backend-unit-baseline.cjs` (ceiling **71**, re-derive at base, flaky `test_230` noted at 280) · `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) · `npx tsc -p tsconfig.app.json --noEmit` set-diff |

### Phase Requirements → Test Map
| Req | Behavior | Type | Command | Exists? |
|---|---|---|---|---|
| SEED-360 | both ask_user SQL statements run on real Postgres | DB integration | `pytest tests/test_289_ask_user_sql.py -q` | ❌ Wave 0 (RED today) |
| SEED-360 D-12 | raising `_resume_run` / `_build_resume_context` → run `failed`, phase `failed` + reason, never `active` | unit | `pytest tests/unit/test_289_redrive_failure.py -q` | ❌ |
| D-13 | paused card keeps answer control past 0:00, no "agent stopped" | vitest | `vitest run src/components/panel/__tests__/PendingAskCard.paused.test.tsx` | ❌ |
| VIS-03 access | owner 200, same-org 200, other-org 404, non-terminal non-owner 404, nonexistent 404, byte-identical bodies | unit (fake pool) | `pytest tests/unit/test_289_run_evidence.py -q` | ❌ |
| VIS-03 sections | snapshot (both shapes) not current; edited-since true/false; audit metadata unwrap; sources dedupe + cited_by; no email / no passage for non-owner | unit | same file | ❌ |
| VIS-03 export | DOM section text == view-model == JSON sections (set equality) | vitest | `vitest run src/components/workflows/RunEvidenceReport.test.tsx` | ❌ |
| TRUST-01 | not searched → None; searched + zero → `none`; scores → chat level with user buckets; no provider client constructed | unit | `pytest tests/unit/test_289_phase_confidence.py -q` | ❌ |
| TRUST-01 wire | `confidence` on `WorkflowRunPhaseRead`; `_EXPECTED_PHASE_KEYS` updated | unit | `pytest tests/unit/test_200_1_deliverable_text.py -q` | ✅ (edit) |
| TRUST-01 UI | line renders on a KB row, nothing on a non-KB row, disclaimer on low | vitest | `vitest run src/components/workflows/StepEvidenceLine.test.tsx src/components/workflows/RunSpine.test.tsx` | ❌ / ✅ |
| canvas gate | new path gated off-flag; OpenAPI omits it | unit | `pytest tests/test_182_canvas_gate.py tests/test_revert_byte_identical.py -q` | ✅ |
| page | terminal → report; missing → report decides; 45 converted cases | vitest | `vitest run src/pages/WorkflowRunPage.test.tsx src/pages/__tests__/WorkflowRunPage.seam286.pin.test.tsx` | ✅ (edit) |

### Sampling Rate
- **Per task:** the targeted files above.
- **Per wave:** backend baseline gate plus the vitest count gate, once per wave (G-8).
- **Phase gate:** both full gates green before `/gsd:verify-work`.

### UAT rows (D-17, authored in VALIDATION.md)
Use a workflow with a KB step (`llm_agent` + `search_documents`), a non-KB step and a pause step. Each row is a real run with per-request `model` + `provider`, scored from `workflow_runs` / `workflow_phases` / `harness_audit` plus the evidence read.

| Row(s) | Coverage |
|---|---|
| 1-8 | OpenAI, Anthropic (re-test billing), Google, DeepSeek, GLM, MiniMax, Kimi, OpenRouter. Each row checks KB-step confidence present, non-KB absent, and the paused-then-answered row completes. Record the resumed-segment model (see the "Not fixed" note). |
| M | Multi-tool. |
| P | Parallel thread: thread A paused while thread B runs. |
| L | Long message, ≥5 KB kickoff. |
| S1-S5 | Driven through Chrome MCP (G-4). |

### Wave 0 Gaps
- [ ] `backend/tests/test_289_ask_user_sql.py`, the DB-backed RED that pins the root cause
- [ ] `backend/tests/unit/test_289_redrive_failure.py`, `test_289_run_evidence.py`, `test_289_phase_confidence.py`
- [ ] `frontend/src/components/workflows/RunEvidenceReport.test.tsx`, `StepEvidenceLine.test.tsx`, `components/panel/__tests__/PendingAskCard.paused.test.tsx`

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | `require_canvas` → `canvas_caller` (validated token, WR-08) |
| V3 Session | no | — |
| V4 Access Control | **yes, the core** | one-query org predicate; 404 parity; terminal-only for non-owners; no write controls rendered for non-owners, and write routes stay owner-scoped server-side (`runs.py:750-785`) |
| V5 Input Validation | yes | `UUID` path param (FastAPI); `?run=` validated client-side as a UUID |
| V7 Error/Logging | yes | re-drive failure logged and terminalized; no token values in logs (T-256-14) |
| V8 Data Protection | yes | non-owner minimization: no email, no passages/similarity, no prompt line (A-06) |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---|---|---|
| Cross-org IDOR by guessing a run UUID | Info disclosure | org EXISTS in the same SELECT; 404 `{"detail":"Run not found"}` byte-identical to nonexistent |
| Existence probe via timing/route shape | Info disclosure | single query; `require_canvas` alone (never the 403 visibility gate); path in `CANVAS_GATED_PATHS` |
| Removed member keeps access | Elevation | membership evaluated per request (no cache) |
| Owner PII to colleague | Info disclosure | display name or the fallback words; email only when `viewer_is_owner` |
| XSS through definition JSON / names | Tampering | React text rendering; `<pre>{JSON.stringify}</pre>`, never `dangerouslySetInnerHTML` |
| Answering another user's paused run | Spoofing | unchanged owner-scoped answer route (`runs.py:750-785`); the card is mounted only on the owner's live surface |

## G-5 per hot file (D-16), recommended dispositions

| File | Triple (CLAUDE.md, re-derive) | 289 touch | By-construction reason |
|---|---|---|---|
| `pages/WorkflowRunPage.tsx` | 31/12/1580 | P1: one early-return mount. P3: one prop on the existing `PendingAskCard` mount | `useState`/`useEffect` counts unchanged, no hook added (288-03 precedent). Confidence needs **no** page touch: RunSpine reads `row.confidence` off the same `run.phases` objects (`:688` `wireRows = run?.phases`). ⚠ Two touches from two plans means the ledger's "second concern owes a seam" sentence (`HOT-FILE-LEDGER.md` 286-03 section) applies. Either record it as honoured by construction with the counts, or take the phase/spec-join seam first. |
| `api/workflow_runs.py` | 14/11/1240 | P2: one field (model + named-key read, lockstep). P4: one string (`:782`) | named-key allow-list read, no new query. The evidence route lives in a **new** module. |
| `services/harness_engine.py` | 61/24/3387, G-5 OWED | **none** | The confidence helper is a new module. The root cause is in `db/workflows.py`. |
| `services/harness/phase_types.py` | 56/28/3027, G-5 OWED | P2: one key on two executor returns | +0 `If`, +0 `def` in this file; the helper owns the branching. Measure with AST counts before and after. |
| `components/panel/PendingAskCard.tsx` | 17/9/1013 | P3: one optional prop | gates one existing transition; default `false` keeps every caller byte-identical |
| `api/runs.py` | 41/19/1750 | P3: one helper + moving `_build_resume_context` into the guarded region | existing writers only |
| `components/workflows/RunReceipt.tsx` | 3/1/241 | **none** | summary variant renders no rows (F6) |
| Also touched, not in D-16 | `db/workflows.py` (53/27/2767): 2 tokens · `task_service.py` (24/13/991): one counter · `RunSpine.tsx` (5/3/426): one leaf mount · `lib/api/workflows.ts` (9/9/1111): one optional type field · `App.tsx` (36/27/418) + `ChatLayout.tsx` (61/31/1137): one deep-link seed each · `main.py` (90/65/977): one `include_router` · `middleware/canvas_gate.py`: one member · `index.css`: one print block | — | Add each to `files_modified` with a ledger row in the same commit. |

## Plan shape (D-18), adjusted

| Plan | Wave | Scope | files_modified (non-test) |
|---|---|---|---|
| **289-01 SEED-360** | 1 | Wave-0 DB RED → SQL fix; `_fail_redrive` + guarded `_build_resume_context`; `PendingAskCard paused` prop + page prop | `backend/app/db/workflows.py`, `backend/app/api/runs.py`, `frontend/src/components/panel/PendingAskCard.tsx`, `frontend/src/pages/WorkflowRunPage.tsx` |
| **289-02 Confidence** | 1 | helper + `kb_search_calls` + executor keys; `WorkflowRunPhaseRead.confidence` + lockstep fence; `StepEvidenceLine` + vocabulary; RunSpine mount | `backend/app/services/harness/phase_confidence.py` (new), `backend/app/services/task_service.py`, `backend/app/services/harness/phase_types.py`, `backend/app/api/workflow_runs.py`, `frontend/src/lib/api/workflows.ts`, `frontend/src/components/workflows/StepEvidenceLine.tsx` (new), `frontend/src/components/workflows/evidenceVocabulary.ts` (new), `frontend/src/components/workflows/RunSpine.tsx` |
| **289-03 Evidence page** | 2 (after 01: page overlap; after 02: leaf + field) | new route + composer; canvas gate + mount; report + view-model + export + print; deep link; page mount; **45-case test migration** + pin mocks | `backend/app/api/workflow_run_evidence.py` (new), `backend/app/services/run_evidence.py` (new), `backend/app/main.py`, `backend/app/middleware/canvas_gate.py`, `frontend/src/lib/api/runEvidence.ts` (new), `frontend/src/lib/runDeepLink.ts` (new), `frontend/src/components/workflows/RunEvidenceReport.tsx` (new), `frontend/src/components/workflows/evidenceView.ts` (new), `frontend/src/pages/WorkflowRunPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/ChatLayout.tsx`, `frontend/src/index.css` |
| **289-04 Live proof** | 3 | capture the re-drive log line before and after; S1-S5 via Chrome MCP; 8-provider roster + M/P/L in VALIDATION.md; sentence restore if S5 is green (+ `test_288_waiting_on.py`); ledger rows | `backend/app/api/workflow_runs.py` (one string), `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md` rows |

Plans 01 and 02 share no file. They overlap only in the per-wave gate run, so they can run in parallel worktrees. Neither mutates the DB in its tests except the DB-backed SQL test, which is read-only. Plan 03 waits for both, and plan 04 needs a backend restart by the operator.

## Sources

### Primary (HIGH, read in this session)
- `backend/app/db/workflows.py` (396-529, 1447-1486, 1672-1810, 1829-1863, 1961-1986, 2219-2351, 2464-2572); `backend/app/api/runs.py` (564-712, 736-944); `backend/app/services/harness_engine.py` (170-200, 312-388, 1100-1145, 1725-2160, 2395-2465, 2525-2620, 2820-3329); `backend/app/services/harness/human_input.py` (114-330); `phase_types.py` (168-210, 895-937, 1035-1061); `task_service.py` (730-815, 975-1007); `search_documents_tool.py` (1075-1112); `agent_loop.py` (943-985, 3510-3553); `embedding_service.py` (225-252); `api/workflow_runs.py` (1-1240); `dependencies.py` (84-240, 870-1072); `middleware/canvas_gate.py` (55-130); `supabase/full-schema.sql` (tables + policies cited)
- `frontend/src/pages/WorkflowRunPage.tsx`, `hooks/useWorkflowRun.ts`, `components/panel/PendingAskCard.tsx`, `components/workflows/RunReceipt.tsx`, `components/metadata/ConfidenceChip.tsx`, `components/chat/ConfidenceBadge.tsx`, `App.tsx` (130-240), `components/layout/ChatLayout.tsx` (300-510, 990-1040)
- Live local DB probe (read-only transaction): the SQL error reproduced and the fix verified
- `docs/HOT-FILE-LEDGER.md` 286/288 sections; sketches 289 (README + index.html B)

### Secondary
- Tailwind v3 print modifier: v3.tailwindcss.com/docs/hover-focus-and-other-states

## Metadata

**Confidence breakdown:**
- SEED-360 root cause: HIGH. Reproduced against real Postgres.
- Access/RLS: HIGH. Policies read from the schema artifact. The live colleague drive is still owed.
- Confidence path: HIGH. Existing harness precedent; the function and scores are already in place.
- Frontend migration cost: MEDIUM. Scripted count; the individual cases have not been read.

**Research date:** 2026-10-19
**Valid until:** 2026-11-02 (the hot files move fast; re-derive the triples at plan time)

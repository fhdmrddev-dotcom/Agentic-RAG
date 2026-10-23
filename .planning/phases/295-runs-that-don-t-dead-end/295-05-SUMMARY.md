---
phase: 295-runs-that-don-t-dead-end
plan: 05
subsystem: api + ui (run reads, evidence report, chat panel)
tags: [fastapi, pydantic, react, run-read, evidence, sse]

requires:
  - phase: 295-03 (planned, wave 2)
    provides: "the stored contract this plan reads: phase output `unsourced = {continued_by: <uuid>, at: <ISO>}`, the prompt payload's `engine_pause`, the answer body's `folder_id`"
  - phase: 295-04 (planned, wave 2)
    provides: "the recorded cancel reason: `policy_applied` audit `{policy: run_cancelled, reason: Stopped by <name>.}`"
provides:
  - "pure leaf backend/app/services/harness/run_read_wire.py: unsourced_for_wire, end_reason_for_wire, resolve_end_reason, deadline_passed, UnsourcedMark, END_REASON_AUDIT_KINDS"
  - "WorkflowRunPhaseRead.unsourced + WorkflowRunRead.end_reason (run read), RunEvidenceLogEntry.unsourced + RunEvidenceRun.end_reason (evidence read / JSON export), WorkflowPhaseState.unsourced (chat panel)"
  - "waiting_on.window_passed from the prompt's own deadline (D-37); engine_pause.phase names the paused step"
  - "frontend: RunEndReasonLine leaf; StepEvidenceLine unsourced arm; the words in evidenceVocabulary.ts; TS twins (Phase.unsourced, PendingAsk.engine_pause + EnginePause, AskUserAnswerBody.folder_id, WorkflowRunPhase.unsourced, WorkflowRun.end_reason, RunEvidence twins); the SSE mapper and both StreamsProvider row mappers carry the fields"
  - "mounts: RunSpine (one prop), RunEvidenceReport (one prop + one RunEndReasonLine), PhaseCard (one mount)"
affects: [295-03 (writes the fields this plan reads), 295-06 (reads PendingAsk.engine_pause / EnginePause / AskUserAnswerBody.folder_id), 295-07 (ledger rows for every hot file in the G-5 record)]

tech-stack:
  added: []
  patterns:
    - "A user id stored on a row is REPLACED by viewer-aware words at the read, never copied (unsourced_for_wire)"
    - "End reasons are resolved, never composed: failed step's _failure_reason, else latest run_failed audit reason, else (cancelled only) latest policy_applied/run_cancelled reason, else null"

key-files:
  created:
    - backend/app/services/harness/run_read_wire.py
    - backend/tests/unit/test_295_run_read_wire.py
    - frontend/src/components/workflows/RunEndReasonLine.tsx
    - frontend/src/components/workflows/RunEndReasonLine.test.tsx
    - frontend/src/lib/api/__tests__/threads.engineAsk.test.ts
  modified:
    - backend/app/api/workflow_runs.py
    - backend/app/services/run_evidence.py
    - backend/app/api/workflow_run_evidence.py
    - backend/app/api/threads.py
    - backend/app/models/thread.py
    - backend/app/db/workflows.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - frontend/src/components/workflows/StepEvidenceLine.tsx
    - frontend/src/components/workflows/evidenceVocabulary.ts
    - frontend/src/components/workflows/evidenceView.ts
    - frontend/src/components/workflows/RunEvidenceReport.tsx
    - frontend/src/components/workflows/RunSpine.tsx
    - frontend/src/components/panel/PhaseCard.tsx
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/types/index.ts
    - frontend/src/lib/api/threads.ts
    - frontend/src/lib/api/workflows.ts
    - frontend/src/lib/api/runEvidence.ts

key-decisions:
  - "295-05: a non-owner reads unsourced.continued_by as 'the person who started this run' (UI-SPEC B.1) even when the starter's display name is known; the one name chain (waiting_who) is called with the name withheld"
  - "295-05: WorkflowRunPage.tsx gets ZERO touches, not the planned one mount — since 289-04 a failed or cancelled run renders RunEvidenceReport (one early return), so a band mount could never render; the report's title block carries the end-reason line"
  - "295-05: get_unanswered_ask_user returns created_at + engine_pause (Rule 3), so the answer window and the paused step are computed from the prompt itself, never from run status"
  - "295-05: ◌ (U+25CC) is a NET-NEW icon-convention PROPOSAL for 'kept without sources', distinct from 289's ○ 'nothing matched' (D-30; orchestrator records it under Guardrail overrides)"

patterns-established:
  - "PhaseCard sites a must-see mark in the always-visible identity column (not the accordion region), so a folded done card still reads it"

requirements-completed: [RUN-01, RUN-04]

duration: ~82min
completed: 2026-10-20
---

# Phase 295 Plan 05: Run reads carry the unsourced mark and the end reason

**The four places a person reads a run (run spine, evidence report and its JSON, chat panel card) now show a bordered amber `◌ Unsourced · continued by <name>` mark plus its note, all off one wire field. A failed run's record says why it stopped, or says nothing was recorded. An engine pause with no deadline no longer reads as a passed answer window.**

## Performance

- **Duration:** ~82 min
- **Started:** 2026-10-20T19:55Z
- **Completed:** 2026-10-20T21:18Z
- **Tasks:** 3 (Task 1, Task 2a, Task 2b), each with a TDD RED commit and a GREEN commit
- **Files modified:** 38 (`git diff --stat 7fdf86e70 HEAD`, before this SUMMARY)

## Accomplishments

- **Backend wire (Task 1).** `run_read_wire.py` is a new pure leaf with no `app` imports. `unsourced_for_wire` swaps the stored uuid for words. `resolve_end_reason` reads only reasons that were recorded. `deadline_passed` turns the answer window into a check against time.
  - The run read, the evidence read and the chat-panel read each read the mark off their one existing parse.
  - The stored uuid is shown absent from all three JSON bodies.
  - The D-40 no-leak test passes on all three reads: an active row's `_awaiting_answer.produced_output` never reaches any of them.
- **Words and leaves (Task 2a).** `NO_REASON_RECORDED` and the `UNSOURCED_*` words have one home, `evidenceVocabulary.ts`.
  - `StepEvidenceLine` gains the unsourced arm. The confidence arm is byte-unchanged; a test compares its `innerHTML`.
  - `RunEndReasonLine` is a new leaf that renders the C.1 table.
  - The TS types, the SSE mapper and both `StreamsProvider` row mappers now carry the new fields.
- **Mounts (Task 2b).** One prop each on RunSpine and the evidence step log. One `RunEndReasonLine` under the evidence outcome. One PhaseCard mount, placed so a **collapsed** done card still shows the mark (tested).

## Task Commits

1. **Task 1 RED:** `483df14c0` test(295-05): pin unsourced and end_reason on every run read
2. **Task 1 GREEN:** `c7810a52c` feat(295-05): carry unsourced and end_reason on every run read (D-04, D-22, D-37)
3. **Task 2a RED:** `f345f2ba9` test(295-05): pin the unsourced words and the end-reason leaf on rendered content
4. **Task 2a GREEN:** `c61f5306d` feat(295-05): the unsourced words, the end-reason leaf and the wire types (D-04, D-22)
5. **Task 2b RED:** `8950d2644` test(295-05): pin the unsourced mark and the end reason where a person reads a run
6. **Task 2b GREEN:** `042b8a617` feat(295-05): show unsourced in four places and why a run stopped (D-04, D-22)

## TDD Gate Compliance

Every task has a `test(...)` commit followed by a `feat(...)` commit. These RED results were seen before GREEN:

- **Task 1:** 61 failed / 82 passed. The two D-40 proofs passed at base, because no reader serialises the stash today; they stand as fences, not drivers.
- **Task 2a:** 8 failed, plus one file that could not be imported.
- **Task 2b:** 10 failed / 328 passed.

## Wire contract as shipped

| Where | Field | Shape |
|---|---|---|
| `GET /workflow-runs/{id}` → `phases[]` | `unsourced` | `{continued_by: <words>, at: <ISO>} \| null`, as the model `UnsourcedMark` |
| `GET /workflow-runs/{id}` | `end_reason` | `str \| null` |
| `GET /workflow-runs/{id}/evidence` → `run` | `end_reason` | `str \| null` (fixture path `run`) |
| `GET /workflow-runs/{id}/evidence` → `phase_log[]` | `unsourced` | `UnsourcedMark \| null` (fixture path `phase_log[].unsourced: [at, continued_by]`) |
| `GET /threads/{id}/workflow` → `phases[]` | `unsourced` | `dict[str, str] \| null`, same keys. A plain dict, because importing the harness package from `models/` would run executor registration and create an import cycle. |
| `get_unanswered_ask_user` result | `created_at`, `engine_pause` | the prompt row's own `created_at`, and the payload's `engine_pause` (`None` when absent) |

**How `continued_by` is worded:**
- The owner reads `<display name> (you)`. If the display name is blank, they read their email plus `(you)`. If both are missing, they read `the person who started this run`, without `(you)`.
- Anyone else always reads `the person who started this run`.

**How `end_reason` is chosen:**
1. Only a run with status `failed` or `cancelled` gets one.
2. First choice: the reason recorded on the latest failed step.
3. Next: the latest `run_failed` audit reason. The audit is read only when no step recorded a reason.
4. Last, for a `cancelled` run only: the latest `policy_applied` audit whose policy is `run_cancelled`.
5. Anything blank becomes `null`.

**The answer window:** `window_passed` is true only when `timeout_seconds` is a real number and `created_at + timeout_seconds < now`. An engine pause has `timeout_seconds` null, so it never reads as passed.

**Frontend types (for 295-06):**
- `PendingAsk.engine_pause?: EnginePause`
- `EnginePause {kind: "no_sources" | "no_markers" | "action_risk"; phase; continue_allowed; locked; folders: {id, name, depth}[]}`
- `AskUserAnswerBody.folder_id?: string`. This type lives in `types/index.ts`; `lib/api/threads.ts` only imports it.

## G-5 record

Triples are `commits / phases / lines`, re-derived from git with the CLAUDE.md recipe (six-digit buckets excluded). Each row shows base → after this plan's commits. Ledger rows are written by 295-07.

| File | Triple base → after | Counts base → after | Touch |
|---|---|---|---|
| `backend/app/api/workflow_runs.py` | 17/12/1295 → 18/13/1455 | ast.If 31 → 36 · defs 9 → 14 | **Over the planned budget, recorded here.** Two fields declared. One by-name read off the single parse (the `phase_output_object(` count stays 2). The window expression is replaced. `active_slug` gains the engine-pause branch. Five new defs: `waiting_who` (the name chain, factored out), `unsourced_who`, `_unsourced_words_for`, `panel_unsourced_who`, `_read_end_reason`. The last three do I/O, so they cannot live in the pure leaf. |
| `backend/app/api/threads.py` | 272/91/2557 → 273/92/2567 | ast.If 100 → 101 · defs 34 → 34 | The planned field kwarg, plus a lazy one-time name lookup: 1 If, 1 init line and 2 import lines. That is +10 lines, against a budget of "one kwarg". |
| `backend/app/models/thread.py` | 23/15/539 → 24/16/545 | ast.If 11 → 11 · defs 4 → 4 | One field. |
| `backend/app/db/workflows.py` | 54/28/2767 → 55/29/2773 | ast.If 32 → 32 · defs 38 → 38 | **Not in the plan's file list (Rule 3).** `get_unanswered_ask_user` now selects `m.created_at` and returns two more keys. 295-03 edits other functions in this file (`pause_run`, the stash writer, `get_ask_user_response`), so the regions do not overlap. |
| `backend/app/services/run_evidence.py` | 3/1/509 → 4/2/517 | ast.If 32 → 32 · defs 21 → 21 | One by-name read, one entry key, one `who` computation. |
| `backend/app/api/workflow_run_evidence.py` | 2/1/366 → 3/2/391 | ast.If 7 → 8 · defs 5 → 5 | Two fields. One end-reason block that reuses the existing `_AUDIT_SQL` with the end-reason kinds. |
| `frontend/src/providers/StreamsProvider.tsx` | 109/42/5004 → 110/43/5006 | useState 0 → 0 · useEffect 27 → 27 | One field in each of its two row mappers. `grep -c unsourced` goes 0 → 2. |
| `frontend/src/types/index.ts` | 100/79/1656 → 101/80/1674 | n/a | **Three fields, not the planned two.** `Phase.unsourced`, `PendingAsk.engine_pause` (plus the exported `EnginePause` type), and `AskUserAnswerBody.folder_id`, which lives here rather than in `threads.ts`. |
| `frontend/src/lib/api/threads.ts` | 19/11/1967 → 20/12/1975 | n/a | One mapper field. The client `WorkflowPhaseState` mirror gains `unsourced`. The `answerAskUser` docblock now names `folder_id`. |
| `frontend/src/lib/api/workflows.ts` | 10/10/1129 → 11/11/1141 | n/a | Two optional fields plus `RunPhaseUnsourced`. |
| `frontend/src/components/workflows/RunSpine.tsx` | 6/4/433 → 7/5/441 | useState 0/0 · useEffect 0/0 · `<StepEvidenceLine` 1 → 1 | One prop. The row intersection type is widened. |
| `frontend/src/components/panel/PhaseCard.tsx` | 19/12/803 → 20/13/811 | useState 2 → 2 · useEffect 2 → 2 · `<StepEvidenceLine` 0 → 1 | One mount, in the identity column between the slug and the timing row. |
| `frontend/src/components/workflows/RunEvidenceReport.tsx` | 1/1/462 → 2/2/465 | useState 4 → 4 · useEffect 3 → 3 · `<RunEndReasonLine` 0 → 1 | One prop plus one leaf mount. |
| `frontend/src/pages/WorkflowRunPage.tsx` | 33/13/1594 → 33/13/1594 | useState 5 → 5 · useEffect 5 → 5 · `<RunEndReasonLine` 0 → 0 | **Untouched** (see Deviations). |
| `frontend/src/components/panel/PendingAskCard.tsx` | n/a | n/a | Untouched: `git diff --numstat 7fdf86e70 -- …` prints nothing. 295-06 owns it. |

## Verification

- **Targeted backend suites:** `test_295_run_read_wire`, `test_200_1_deliverable_text`, `test_288_waiting_on`, `test_289_evidence_contract`, `test_289_run_evidence`, `test_182_canvas_gate`, `test_276_openapi_snapshot_fresh`, `test_214_failure_reason_seam`, `test_188_workflow_run_read`, `test_210`, `test_257`. All pass except `test_200_1::test_confidence_reaches_the_client_with_the_folder_label`, which is **inherited and order-dependent**: it fails in isolation on the base sources too (measured by restoring the base files and re-running). It is the settings cache's 30-second TTL, refreshed through the canvas-gate middleware's `ensure_settings_fresh`, which calls the test's patched `get_pg_pool` a second time. It passes when its whole file runs alone, and the full unit gate does not list it.
- **Full backend unit gate:** `pytest tests/unit -q --continue-on-collection-errors`.
  - At HEAD: **70 failed / 8474 passed**. At base: **71 failed / 8420 passed** (run with base sources restored and `test_295` ignored).
  - Comparing the failing-ID sets: **0 new failures at HEAD**.
  - One test failed at base only (`test_email_ingestion::test_ingest_email_populates_metadata_and_attachments`), which looks order-dependent.
  - A `test_retrieval_service` ID showed up in the comparison only because two output lines were concatenated; it fails at both HEAD and base.
  - Ceiling 71: within it. The local DB lock was taken and released.
- **Frontend typecheck:** `tsc -p tsconfig.app.json --noEmit` reports 63 errors after each frontend commit, the same set as base (line numbers normalised).
- **Vitest count gate, run 1: 1 failed.** The failure was `src/pages/WorkflowBuilderPage.canvas.test.tsx`, "clicking Canvas flips aria-selected …", with `STACK_TRACE_ERROR`. It was read from the gate's own JSON report before any re-run.
  - The suite is **provably unmodified**: `git diff --numstat 7fdf86e70 HEAD` lists neither it, `WorkflowBuilderPage.tsx` nor `WorkflowCanvas.tsx`.
  - It is the fifth named suite in SEED-171's flaky set. It passed alone, 154/154.
- **Vitest count gate, run 2:** `count gate OK` — 480/480 pinned files, no per-file decrease, 0 failing, total 10945. That is one green sample of a flaky suite, which is an observation, not proof.
- **seam286 pin suites:** green before and after (21/21). The two `.snap` files show as modified in `git status`, but only their line endings changed (`git diff --stat` is empty). They are left uncommitted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `get_unanswered_ask_user` did not return `created_at` or `engine_pause`**
- **Found during:** Task 1, which read this function as the plan instructed ("read only: whether it returns timeout_seconds and created_at").
- **Issue:** The function returned only the payload's four keys. That left the D-37 deadline unmeasurable and `engine_pause.phase` unreadable. A frontend that declared the field would have had nothing feeding it, so it would have rendered nothing (the 257.1 failure).
- **Fix:** `SELECT m.tool_calls, m.created_at` and two more keys in the returned dict. The 288 db-read test was updated to the new dict and SQL.
- **Files modified:** `backend/app/db/workflows.py`, `backend/tests/test_288_waiting_on.py`
- **Commit:** `c7810a52c`

**2. [Rule 1 - Wrong mount site] The plan's `<RunEndReasonLine>` on WorkflowRunPage's band could never render**
- **Found during:** Task 2b.
- **Issue:** Since 289-04, `WorkflowRunPage.tsx` returns early with `RunEvidenceReport` when `loadPhase === "ready" && run && isTerminal`. `TERMINAL_RUN_STATUSES` contains completed, failed, cancelled and timed_out. So the band only ever renders for non-terminal runs, and the leaf renders only for failed or cancelled ones. A band mount would have passed the acceptance grep and done nothing.
- **Fix:** No change to `WorkflowRunPage.tsx`. The reason line a person reads on that page is the evidence report's, under its outcome (C.2). `WorkflowRunPage.test.tsx` checks the actual words on the page for a failed run, with and without a recorded reason, and for a live run.
- **Consequence:** The acceptance check `grep -c "<RunEndReasonLine" frontend/src/pages/WorkflowRunPage.tsx` returns **0**, not 1. `WorkflowRunRead.end_reason` is still declared, populated and tested. It serves API consumers and any future live-surface reader; the page itself reads `RunEvidenceRun.end_reason`.
- **Commit:** `042b8a617`

**3. [Rule 3 - Blocking] `test_182_canvas_gate`'s canvas-only schema set**
- **Issue:** The new `UnsourcedMark` model is referenced only by the canvas routes, so the canvas-off OpenAPI filter removes it. The measured set equality therefore failed.
- **Fix:** Added `"UnsourcedMark"` to `_CANVAS_SCHEMAS`, with the measurement note.
- **Commit:** `c7810a52c`

**4. [Rule 3 - Blocking] OpenAPI snapshot drift (test_276)**
- **Fix:** Regenerated `docs/public/api/openapi.snapshot.json` and `openapi.public.json` with `scripts/export-openapi.py` and `node scripts/build-public-openapi.cjs`, following the 288-04 and 289-03 precedent.
- **Merge note:** a parallel plan that also changes the API will conflict on these two generated files. Regenerate them after merging rather than hand-merging.
- **Commit:** `c7810a52c`

**5. [Lockstep] The contract fixture was widened on both sides in the same commits**
- The plan put the TS contract test in Task 2a. To keep every commit coherent, the frontend `runEvidence.contract.test.ts` SAMPLE was widened in the Task 1 RED commit (`483df14c0`), and the `runEvidence.ts` twin in the Task 1 GREEN commit (`c7810a52c`), together with the fixture.

**6. [Scope] Extra test files for the "a mapper test proves the value survives" behaviour**
- `PhaseReconcile.test.tsx` gained a 295 describe block covering both mapper literals.
- New `lib/api/__tests__/threads.engineAsk.test.ts` drives the real `subscribeToRun` SSE parser.

**7. [Minor] `unsourcedSentence(name)` was not added**
- The name needs its own `text-foreground` span, so the leaf builds `· continued by <name>` from `SEPARATOR` and the exported `UNSOURCED_CONTINUED_BY`. All the words still live in `evidenceVocabulary.ts`.

### Inherited, not fixed (out of scope)

- `test_200_1::test_confidence_reaches_the_client_with_the_folder_label`: order-dependent through the settings TTL. It fails in isolation at base.
- `WorkflowBuilderPage.canvas.test.tsx`: flaky under SEED-171, green on the gate re-run.

## Known Stubs

None. Every new field has a producer, the producer populates it, and a test drives a non-null value through the real serializer or mapper. The frontend renders `unsourced` from a real wire field. `end_reason` on the run read has no frontend consumer, by the decision above (Deviation 2).

## Threat Flags

None beyond the plan's threat register.
- T-295-05-01: the uuid is replaced; tests show it absent from the JSON of all three reads.
- T-295-05-03: the reason renders as text children only; a test injects hostile markup.
- T-295-05-04: no reason is ever composed; the no-reason sentence covers the null case.
- T-295-05-05: the window comes from the deadline.

The panel's lazy profile read is the owner's own row over the RLS-bound connection that route already uses; nothing new crosses a trust boundary.

## Icon convention proposal (D-30)

`◌` (U+25CC, dotted circle) is the glyph for "this output was kept without sources". It is **net-new**, in the bordered amber warning tone, `aria-hidden`, with the word `Unsourced` carrying the meaning. It is deliberately not `○`, which 289 already uses for "searched, nothing matched" on the same line, and the two can stack on a 0-sources step. It should be recorded as a proposal against `references/icon-convention.md`. The orchestrator records it under STATE.md → Guardrail overrides; this plan does not write STATE.md.

## Self-Check: PASSED

- FOUND: `backend/app/services/harness/run_read_wire.py`, `backend/tests/unit/test_295_run_read_wire.py`, `frontend/src/components/workflows/RunEndReasonLine.tsx`, `frontend/src/components/workflows/RunEndReasonLine.test.tsx`, `frontend/src/lib/api/__tests__/threads.engineAsk.test.ts`
- FOUND commits: `483df14c0`, `c7810a52c`, `f345f2ba9`, `c61f5306d`, `8950d2644`, `042b8a617`

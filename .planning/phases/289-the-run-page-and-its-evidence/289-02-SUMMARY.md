---
phase: 289-the-run-page-and-its-evidence
plan: 02
subsystem: harness / run surface
tags: [TRUST-01, confidence, retrieval, run-spine, SEED-152]
requires: []
provides:
  - "phase_confidence.py: phase_confidence / confidence_for_wire / resolve_kb_label / KB_LABEL_DEFAULT"
  - "WorkflowRunPhaseRead.confidence (wire) + RunPhaseConfidence (TS)"
  - "StepEvidenceLine leaf + evidenceVocabulary.ts (plan 04 mounts the same leaf in the evidence report)"
affects:
  - backend/app/services/harness/phase_types.py
  - backend/app/services/task_service.py
  - backend/app/api/workflow_runs.py
  - frontend/src/lib/api/workflows.ts
  - frontend/src/components/workflows/RunSpine.tsx
tech-stack:
  added: []
  patterns:
    - "lazy agent_loop import inside helper bodies (harness_engine._finalize_run_grounding precedent)"
    - "value frozen at write time, allow-listed on read, label stamped server-side"
    - "leaf component + one vocabulary file (WaitingOnLine shape)"
key-files:
  created:
    - backend/app/services/harness/phase_confidence.py
    - backend/tests/unit/test_289_phase_confidence.py
    - frontend/src/components/workflows/StepEvidenceLine.tsx
    - frontend/src/components/workflows/evidenceVocabulary.ts
    - frontend/src/components/workflows/StepEvidenceLine.test.tsx
  modified:
    - backend/app/services/harness/phase_types.py
    - backend/app/services/task_service.py
    - backend/app/api/workflow_runs.py
    - backend/tests/unit/test_200_1_deliverable_text.py
    - frontend/src/lib/api/workflows.ts
    - frontend/src/components/workflows/RunSpine.tsx
    - frontend/src/components/workflows/RunSpine.test.tsx
decisions:
  - "D-289-02-A: WorkflowPhaseState (chat panel wire model) is not widened with confidence; recorded in workflow_runs.py below D-200.1-02-A"
  - "A search that errored with no scores stores confidence None, not level 'none' (D-09 rule)"
  - "The KB label is resolved lazily inside the serializer loop, at most once per read and only when a row carries a confidence key; the one-parse-per-row rule and the phase_output_object call count stay unchanged"
  - "The evidence line uses run-surface tones (--success / --warning / hsl(0 80% 80%)), not ConfidenceChip's --panel-* tokens, because RunSpine renders on --background and forbids --panel-* tokens"
metrics:
  duration: "~55 min"
  completed: 2026-10-19
  tasks: 3
  files: 12
---

# Phase 289 Plan 02: Confidence on KB Phase Outputs Summary

A KB step now stores the retrieval confidence chat already computes. It is produced by chat's own `agent_loop._compute_confidence` with the run owner's buckets, over that step's own `search_documents` scores, and no model is called. The value is carried as one `confidence` field on the run read, with the bound folder's name stamped in server-side. The live run spine shows it as the sketch-B line, for example "Answered from Procurement KB · 6 passages · ● Medium · 0.47". A step that did not search shows no line.

## What was built

- **`backend/app/services/harness/phase_confidence.py`** (new, 153 lines). It contains:
  - `phase_confidence`: pure. It lazy-imports `_compute_confidence`, `CONFIDENCE_DISCLAIMER` and `_deduplicate_citations` from `agent_loop`.
  - `confidence_for_wire`: pure. It allow-lists four keys and the level.
  - `resolve_kb_label`: async. It is duck-typed (it only calls `fetchval`), strips control and format characters, caps the label at 80 characters, and never raises.
  - `KB_LABEL_DEFAULT = "the knowledge base"`.
- **`task_service.run_task_sub_agent`** gains a `kb_search_calls` counter and returns it. This tells "never searched" apart from "searched, nothing matched", which scores alone cannot do because a zero-result search carries no score.
- **`phase_types._exec_llm_agent` / `_exec_llm_batch_agents`**: each return gets one `"confidence": phase_confidence(...)` entry. The batch version scores the union of branch scores and counts as searched if any branch searched.
- **`workflow_runs.WorkflowRunPhaseRead.confidence`**: declared, read by name off the existing single `obj` parse, and passed in the existing construction through `confidence_for_wire` (lockstep). The D-289-02-A paragraph sits below D-200.1-02-A.
- **Frontend**:
  - `RunPhaseConfidence` and `WorkflowRunPhase.confidence?` in `lib/api/workflows.ts`.
  - `evidenceVocabulary.ts` holds every word and glyph.
  - `StepEvidenceLine.tsx` is the leaf.
  - `RunSpine.tsx` widens its `phases` prop by intersection and mounts `<StepEvidenceLine>` once, just before the spine-ask slot.
  - `WorkflowRunPage` already passes `run.phases` (as `wireRows`), so the live page shows the line without being edited.

## RED / GREEN record

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 helper, counter, executor keys | `f242efd02` test(289-02): pin per-phase KB confidence against chat's function | `38cba2608` feat(289-02): carry chat's confidence onto KB phase outputs |
| 2 wire field | `6d6f6b212` test(289-02): the confidence wire field | `1af779123` feat(289-02): confidence on the run read |
| 3 evidence line | `0c0f09d21` test(289-02): the evidence line | `c589360b6` feat(289-02): evidence line on the run spine |

How each RED failed:
- Task 1: 36 of 36 tests failed at RED.
- Task 2: 11 failed at RED, including the set equality, the allow-list fence, the model set and 5 new serializer cases.
- Task 3: the StepEvidenceLine suite failed on import, and 4 RunSpine cases failed.

**Verification:**
- Backend:
  - `test_289_phase_confidence.py`: 36 passed.
  - The `-k "task_service or phase_types or llm_agent or batch_agents"` sweep: 76 passed.
  - `test_200_1`, `test_214_failure_reason_seam`, `test_289`, `tests/test_188_workflow_run_read.py`, `tests/test_288_waiting_on.py`, `test_200_2_citations`, `test_210_run_metadata…`, `test_257_producer_cost_fields`, `test_seed190_run_log` and `test_194_1…` together: **179 passed, 0 failed**.
- Frontend:
  - `StepEvidenceLine.test.tsx`, `RunSpine.test.tsx`, `WorkflowRunPage.test.tsx`, `WorkflowRunPage.seam286.pin.test.tsx` and `StepIdentity.coverage.test.tsx`: **240 passed**.
  - The seam286 snapshots passed without regeneration. Vitest rewrote that `.snap` file with LF line endings and no content change; it was restored, and the tree is clean.
- Typecheck: `npx tsc -p tsconfig.app.json --noEmit` reports **63 errors at HEAD and 63 with the base versions of `workflows.ts` and `RunSpine.tsx` restored**. The two sets are identical (diffed), so the plan adds no new type errors.
- Inherited failure, not caused by this plan: `tests/test_200_phase_counts.py::test_llm_single_emits_no_measure_key` fails at base `dcf6ba649` before any edit, so it is pre-existing and was left alone.

## G-5 record

Triples are re-derived from git after this plan's commits. Six-digit quick-task buckets are excluded.

| File | commits / phases / lines (after) | lines before → after |
|------|----------------------------------|----------------------|
| `backend/app/services/harness/phase_types.py` | 57 / 29 / 3050 | 3027 → 3050 (+23: one import + two dict entries + comments) |
| `backend/app/services/task_service.py` | 26 / 14 / 1018 | 1010 → 1018 (+8) |
| `backend/app/api/workflow_runs.py` | 16 / 12 / 1293 | 1240 → 1293 (+53: one field, one import, D-289-02-A, one lazy label read, one kwarg) |
| `frontend/src/lib/api/workflows.ts` | 10 / 10 / 1129 | 1111 → 1129 (+18) |
| `frontend/src/components/workflows/RunSpine.tsx` | 6 / 4 / 433 | 426 → 433 (+7: import, prop widening, one mount) |
| `backend/app/services/harness/phase_confidence.py` | new | 0 → 153 |
| `frontend/src/components/workflows/StepEvidenceLine.tsx` | new | 0 → 93 |
| `frontend/src/components/workflows/evidenceVocabulary.ts` | new | 0 → 49 |

**`phase_types.py` AST (D-16):** `ast.If` **113 → 113**, `FunctionDef`/`AsyncFunctionDef` **55 → 55**. That is +0 ifs and +0 defs; all branching lives in the helper.
**`workflow_runs.py` AST:** `ast.If` 30 → 31 (the one lazy label resolve in the serializer loop), defs 9 → 9.
**Files left untouched (empty `git diff --numstat dcf6ba649`):** `harness_engine.py`, `models/thread.py`, `RunReceipt.tsx`, `phaseDuration.ts`.
Plan 05 writes the ledger rows, as this plan instructed.

## F3 note: run-level confidence still uses the default buckets

`harness_engine._finalize_run_grounding` (`harness_engine.py:381`) calls `_compute_confidence(final_avg)` **without settings**. The run-level confidence on the final assistant message therefore always uses the shipped 0.54/0.38 buckets. The new per-step value uses the owner's `confidence_bucket_high/medium`, which is what chat does.

When an owner has custom buckets, the per-step level and the run-level level can disagree on the same run. This is a divergence and was not fixed here: `harness_engine.py` is G-5 OWED and outside this plan. The trigger to fix it is the next phase that touches `harness_engine.py`'s grounding finalizer. It is a one-argument change (pass `ctx.user_settings`).

## Glyph record

- ✓ High, ● Medium and ⚠ Low are the three tiers of the 028 ConfidenceChip anatomy (glyph, then word, then raw score). ConfidenceChip draws them as lucide marks, `CheckCircle2` / dot / `AlertTriangle`. The evidence line uses the sketch's text characters for the same three, because the sketch-B text is the acceptance bar.
- ○ "No match found" comes from the sketch. I checked it against `.claude/skills/sketch-findings-agentic-rag/references/icon-convention.md`, which has **no confidence row**, so ○ is **net-new and FLAGGED AS A PROPOSAL**. ○ already means "not-started" in `RunSpine`'s `READING_FACE`. The two uses can be told apart because ○ here always sits inside the bordered chip with the words "No match found", but the dual use is on record for the icon-convention owner.
- All the words and glyphs live in `evidenceVocabulary.ts`. They are not in `receiptVocabulary.ts`, because that file's rule 2 bans glyphs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: correctness] The tones are the run surface's, not ConfidenceChip's `--panel-*` tokens**
- **Found during:** Task 3
- **Issue:** The plan says to use "ConfidenceChip's panel tokens (high done, medium active, low hsl(0_80%_80%))". But `RunSpine.tsx`'s docblock says "`--panel-*` TOKENS ARE FORBIDDEN HERE" because the spine renders on `--background`, outside the panel shell. The light-theme `--panel-status-*` values (28%/30% lightness) would also not meet AA contrast there.
- **Fix:** The line uses `--success` / `--warning` / `hsl(0_80%_80%)`, the same tokens RunSpine's own `READING_FACE` and `WaitingOnLine` use. The sketch also uses success/warning/danger.
- **Files modified:** `frontend/src/components/workflows/StepEvidenceLine.tsx`
- **Commit:** `c589360b6`

**2. [Rule 3: blocking] The KB label is resolved lazily inside the loop, not before it**
- **Found during:** Task 2
- **Issue:** Resolving the label once before the loop, and only when a row carries confidence, would need a second `phase_output_object(` parse per row. `test_214_failure_reason_seam.py` pins that call count at base, and `test_200_1` pins the one-parse anchor.
- **Fix:** The label is resolved inside the loop the first time a row carries a `confidence` key, then cached in `kb_label`. It still runs at most once per read and only when needed, and pool or label failures degrade to `KB_LABEL_DEFAULT`. The route obtains the pool through `deps.get_pg_pool()`, which is the same source `_read_waiting_on` and the cost block use.
- **Files modified:** `backend/app/api/workflow_runs.py`
- **Commit:** `1af779123`

**3. [Rule 1: test fixture] The executor parity test uses a MagicMock for settings**
- **Found during:** Task 1 GREEN
- **Issue:** `_exec_llm_agent`'s tool-budget path reads other attributes (`web_search_enabled`) off `user_settings`, so a bare SimpleNamespace raised.
- **Fix:** The test uses a MagicMock with only the two bucket attributes pinned to real numbers. The pure-helper parity cases still use SimpleNamespace and the real `_compute_confidence`.
- **Commit:** `38cba2608`

## Known Stubs

None. Runs recorded before this plan carry no `confidence` key and render no line. That is intentional (no read-time backfill; the level is frozen at write time) and not a stub.

## Threat Flags

None beyond the plan's register. `resolve_kb_label` reads `folders.name` through the service pool, which is T-289-09 (accepted): the read stays owner-only, and the folder is the run's own recorded binding. Plan 03 can pass the viewer's RLS connection instead, because the helper is duck-typed.

## Self-Check: PASSED

- FOUND: backend/app/services/harness/phase_confidence.py
- FOUND: backend/tests/unit/test_289_phase_confidence.py
- FOUND: frontend/src/components/workflows/StepEvidenceLine.tsx
- FOUND: frontend/src/components/workflows/evidenceVocabulary.ts
- FOUND: frontend/src/components/workflows/StepEvidenceLine.test.tsx
- FOUND commits (verified with `git log --oneline dcf6ba649..HEAD`): f242efd02, 38cba2608, 6d6f6b212, 1af779123, 0c0f09d21, c589360b6

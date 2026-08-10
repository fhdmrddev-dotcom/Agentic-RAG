---
phase: 188
plan: 01
subsystem: test-infrastructure
tags: [wave-0, count-gate, baselines, non-attribution]
requires: []
provides:
  - "scripts/vitest-count-gate.cjs TARGETS covering src/components/panel/__tests__/PhaseReconcile.test.tsx and PhaseTimeline.test.tsx"
  - "scripts/vitest-count-gate.cjs BASELINE pins for PhaseNodeCard (68), PhaseNode (13), PhaseTimeline (8), PhaseReconcile (2)"
  - "The six measured pre-edit baselines every later 188 gate is diffed against"
affects:
  - "Every later Phase 188 plan — its falsification tests now RUN, and its guards are now PINNED"
tech-stack:
  added: []
  patterns:
    - "Two-knob gate discipline: TARGETS decides what RUNS, BASELINE decides what is PINNED; a suite must be inside both"
    - "Pin values read from the script's own printed `actual` column across two agreeing runs, never hand-counted"
    - "A pin is not trusted until it has been observed biting on a deliberate deletion"
key-files:
  created: []
  modified:
    - scripts/vitest-count-gate.cjs
    - .planning/phases/188-non-technical-run-observability/188-VALIDATION.md
decisions:
  - "D-188-01-A: file-level TARGETS entries, not the bare `src/components/panel/__tests__` directory — the directory measured 0 failing and WAS admissible, but adopting 10 unread suites into a forever-0-failing gate makes this phase the owner of their future rot"
  - "D-188-01-B: PhaseReconcile and PhaseTimeline are pinned in the commit AFTER the one that first made them run — pinning at first execution beats discovering later that a suite sat inside one knob and outside the other"
metrics:
  duration: ~40 min
  completed: 2026-08-05
  tasks: 3
  commits: 3
---

# Phase 188 Plan 01: Wave 0 — Gate Extension and Pre-Edit Baselines Summary

The count gate now RUNS and PINS the suites Phase 188's falsification tests are written into (2196 → 2206 tests, 946 → 1037 pinned across 22 → 26 files), the pin was watched failing on a real deletion, and the six pre-edit baselines are recorded before a single production line changes.

## What Was Built

### Task 1 — `TARGETS` extended so the panel suites RUN (`78b97fd8`)

`src/components/panel/__tests__/` lands outside **both** gate knobs by default: the directory entries covered only `src/components/workflows` plus three named `src/pages/` files. Phase 188's Req-3 falsification test (the reachable fail-open where `finalizeAllPhasesForThread` sweeps `pending` → `done`) and its Req-1 developer-view parity assertion are written into `PhaseReconcile.test.tsx` and `PhaseTimeline.test.tsx` — neither of which the gate would ever have executed. A falsification test that does not run has falsified nothing.

Two **file-level** entries were added. The plan permitted the bare directory if it measured 0 failing, and it does:

```
npx vitest run src/components/panel/__tests__
Test Files  12 passed (12)
     Tests  144 passed (144)
```

The directory form was therefore admissible and was still declined (D-188-01-A). The gate requires 0 failing forever; adopting `CsvTablePreview`, `FailReason`, `FilePreview`, `FilesSection`, `PendingAskCard`, `Seam`, `TodosSection`, `VersionDiff`, `WorkspacePanel` and `WorkspacePanel.derived` would make Phase 188 the owner of ten suites nobody in this phase reads. A later phase can adopt them deliberately, with its own measured number.

Insertions only — `git diff --numstat` reported **19 added / 0 deleted**, so the existing 8 TARGETS entries and their comments are byte-unchanged.

### Task 2 — `BASELINE` extended, and the pin observed biting (`af284f9a`)

Four **extensions** (no lowering — nothing was deleted, no existing pin moved, so no deliberate deletion needed to ride along):

| Suite | Pin | Why it was pinned |
|---|---|---|
| `PhaseNodeCard.test.tsx` | 68 | RAN inside the workflows directory entry, PINNED BY NOTHING. Carries 188's seal-at-seven guard and the ring-dial geometry assertions. |
| `PhaseNode.test.tsx` | 13 | Same situation. Carries Req 2's no-harness-vocabulary fence and Req 5's waiting-words string-**inequality** guard — an absence assertion, the easiest kind to delete unnoticed. |
| `PhaseTimeline.test.tsx` | 8 | Pinned in the commit after the one that first made it run. |
| `PhaseReconcile.test.tsx` | 2 | Same. |

This is verbatim the 187-25 situation recurring: with **1260 tests of slack** above the floor, an entire unpinned file could be deleted without `[total-below-baseline]` ever firing.

All four values were read from the script's own printed `actual` column across **two agreeing runs** (13 / 68 / 2 / 8) — never hand-counted from `it(` literals, which is unsound under `it.each`. They agreed with the 13 and 68 expected in `188-VALIDATION.md`, so there is no discrepancy to record. `BASELINE_TOTAL` remains the computed reduce; only its trailing explanatory note moved 946 → 1037.

**The pin was observed biting.** One whole `it(` block (`"needs no edge anchors to render — the \`anchors\` slot is optional"`) was deleted from `PhaseNodeCard.test.tsx`. Raw output:

```
  PhaseNodeCard.test.tsx                       68      67      -1
  -------------------------------------------------------------
  total                                      1037    2205   +1168
  total 2205  ·  failed 0  ·  pinned total 1037
--------------------------------------------------------------
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [count-decrease] PhaseNodeCard.test.tsx — pinned 68, ran 67 (-1). A test was deleted or skipped away.

        D-184-08 pins per-FILE counts because a failures-only
        differential cannot see a DELETED test (the Phase-177 lesson).
```

Gate exit **1**, at `failed 0` — the count decrease was the *only* signal, which is the entire point. Restored with `git checkout -- frontend/src/components/workflows/PhaseNodeCard.test.tsx`; `git status --porcelain` on that path is empty and the gate is green again at 2206 / failed 0. A pin nobody has watched fail is a gesture.

### Task 3 — the six pre-edit baselines recorded (`6f5ec819`)

A `## Measured baselines — recorded at plan 188-01, before any production edit` section was appended to `188-VALIDATION.md` below § Test Infrastructure, with `wave_0_complete: true` set in frontmatter. Every figure is the command's own printed output, measured at the current tree rather than inherited.

## Measured Results

| # | Command | Measured | vs `db086240` |
|---|---|---|---|
| 1 | `node scripts/vitest-count-gate.cjs` | total **2206** · failed **0** · pinned total **1037** · **26/26** pinned files | 2196 / 0 / 946 / 22 — all four moved, and each by this plan's own doing (+10 = 2+8 newly executing; +91 = 68+13+8+2 newly pinned) |
| 2 | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` | **33** errors | unchanged. Gate is "still 33", NOT 0 — the root config has `files: []` and checks zero files |
| 3 | `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q -p no:randomly` | **211 failed · 3296 passed · 19 skipped · 5 xfailed · 9 xpassed · 1 error** in 308.39 s | identical |
| 4 | `pytest tests/test_revert_byte_identical.py tests/test_182_canvas_gate.py -q` | **12 passed** in 1.83 s | identical — green today, so a later red there belongs to this phase |
| 5 | `pytest tests/test_thread_workflow_endpoint.py -q` | **1 failed · 6 passed** | identical (the 1-of-7 RED) |
| 6 | `pytest tests/test_181_flip_on.py tests/test_182_grounding_bundle.py -q` | **3 failed · 10 passed** | identical (1 and 2 respectively) |

**The pre-existing RED, by name and assertion** (#5) — recorded because this suite fences `GET /threads/{id}/workflow`, which the run surface reads:

- `tests/test_thread_workflow_endpoint.py::test_thread_workflow_state_shape`
- `assert body["locked"] is True` → `E assert False is True` at `test_thread_workflow_endpoint.py:99`
- The endpoint answers **HTTP 200** and the full key shape is present (the `thread_id … continues_remaining` loop passes, as does `body["mode"] == "harness"`). Only the `locked` **value** disagrees.

**#6 by name:** `test_181_flip_on.py::test_canvas_ping_200_after_flip_on` (1); `test_182_grounding_bundle.py::test_grounding_bundle_returns_server_sourced_palette` and `::test_grounding_bundle_fields_come_from_the_bundle` (2).

**On the "~62-red" figure:** recorded as a **scope difference, not a refutation**, per the plan's corrected wording. The full `tests/` baseline is 211 failed / 3296 passed; the narrower `tests/unit` async-mock rot figure (62 failed / 1700 passed, Phase 187 round 5) is a different measurement that this one does not contradict — a subset at 62-red and its superset at 211-red are consistent. The word "REFUTED" appears nowhere in the section this plan wrote. (It does appear twice at lines 37 and 42 of `188-VALIDATION.md`, inside the pre-existing orchestrator scope-correction blockquote that *warns against* citing it — untouched by this plan.)

## Verification

| Criterion | Result |
|---|---|
| `grep -c 'PhaseReconcile.test.tsx' scripts/vitest-count-gate.cjs` ≥ 1 | ✅ (TARGETS + BASELINE) |
| `grep -c '"PhaseNodeCard.test.tsx"'` = 1 · `grep -c '"PhaseNode.test.tsx"'` = 1 | ✅ 1 and 1 |
| Gate exits 0, `failed` 0 | ✅ |
| `total` > 2196 | ✅ 2206 |
| `pinned total` > 946 | ✅ 1037 |
| Pinned-file count grew by exactly the entries added | ✅ 22 → 26 (+4) |
| Task 1 insertions only | ✅ `--numstat` 19 / 0 |
| `[count-decrease]` observed then reverted | ✅ raw output above; path clean after restore |
| `git diff --name-only HEAD -- supabase/migrations/` empty | ✅ zero migrations |
| No file under `frontend/src` or `backend/app` modified | ✅ `git status --porcelain frontend/src backend/app` empty |
| `wave_0_complete: true` | ✅ |

## Deviations from Plan

None. All three tasks executed as written.

Two judgement calls the plan explicitly delegated, both recorded with their measured number:

1. **Directory vs file-level TARGETS entry.** The plan required the directory form to be measured first and permitted it at 0 failing. It measured 12 files / 144 tests / 0 failing — admissible — and file-level entries were still chosen, for the blast-radius reason given above. The measurement is in the commit message and in the script's own comment, as the plan required.
2. **The `BASELINE_TOTAL` trailing note.** The plan says leave `BASELINE_TOTAL` as the computed reduce and do not hand-write the sum — it remains the reduce. Its trailing `// 946` *note* was updated to `// 1037` with the derivation, because a stale note on a green gate is the same class of false claim the pin itself exists to catch (the script's own header makes this argument about the `16/16` literal it once printed).

## Scope Note

The working tree carried a large pre-existing dirty set (`.claude/agents/*`, `.claude/commands/gsd/*`, `.claude/get-shit-done/*`, plus orchestrator-owned `.planning/STATE.md` and `.planning/config.json`) from a GSD tooling update unrelated to this phase. Every commit staged only its own explicitly-named paths; nothing pre-existing was staged, reverted or deleted. Task 3's "diff lists only `188-VALIDATION.md`" criterion is therefore evaluated over the paths this plan touches.

## Known Stubs

None. This plan writes no production code — it modifies one committed tooling script and one planning document.

## Commits

| Task | Commit | Files |
|---|---|---|
| 1 | `78b97fd8` | `scripts/vitest-count-gate.cjs` (+19 / −0) |
| 2 | `af284f9a` | `scripts/vitest-count-gate.cjs` (+36 / −3) |
| 3 | `6f5ec819` | `.planning/phases/188-non-technical-run-observability/188-VALIDATION.md` (+103 / −1) |

## Notes for the Next Plan

- **`src/lib/phaseState.test.ts` and `src/pages/WorkflowRunPage.test.tsx` are still outside `TARGETS`, deliberately** — neither file exists yet, and a `TARGETS` entry for a missing path makes the gate error rather than fail. Plans 05 and 08 must each add their own entry **in the same task that creates the file**, and pin it from the printed `actual` column.
- The gate's new floor is **1037** across **26** files. Any later plan that sees `[count-decrease]` on one of the four new pins is looking at a deleted guard, not at gate noise.
- `test_revert_byte_identical.py` + `test_182_canvas_gate.py` are **green today** — a red there later is attributable to this phase.

## Self-Check: PASSED

- Files claimed as modified/created all exist: `scripts/vitest-count-gate.cjs`, `188-VALIDATION.md`, `188-01-SUMMARY.md`.
- All four commits resolve in `git log`: `78b97fd8`, `af284f9a`, `6f5ec819`, `ecd98406`.
- `git diff --diff-filter=D --name-only HEAD~4 HEAD` is empty — no file was deleted by this plan.
</content>

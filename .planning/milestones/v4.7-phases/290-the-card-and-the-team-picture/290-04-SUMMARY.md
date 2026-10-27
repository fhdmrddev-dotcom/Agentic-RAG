---
phase: 290-the-card-and-the-team-picture
plan: 04
subsystem: gates / hot-file ledger / reported bugs (close-out)
tags: [gates, ledger, g5, closeout, reported-bug]
requires:
  - 290-01 (teamModel, teamVocabulary, teamFixtures, the canvas header pin)
  - 290-02 (stepLine, StepChipLine, the card mount)
  - 290-03 (TeamPicture, the Steps | Team switch, the canvas + builder mounts)
provides:
  - count-gate BASELINE pins for the seven 290 suites, plus two raised pins
  - re-derived ledger rows and Phase 290 sections for 12 files (6 young, 4 firing, 2 unused forecasts)
  - BUG-261021-05 (the D-20 escalated-seal drift), open
  - 290-04-GATES.md (every phase gate with its command and verdict)
affects:
  - /gsd:verify-work 290 (G-4 lived-experience rows S1-S5 / SC#1-4 still owed)
  - the next phase touching WorkflowCanvas.tsx (must propose the extraction FIRST)
tech-stack:
  added: []
  patterns: [base-tree run to split inherited vs new pin drift, same-commit ledger row + section]
key-files:
  created:
    - .planning/phases/290-the-card-and-the-team-picture/290-04-GATES.md
    - .planning/reported-bugs/BUG-261021-05-escalated-step-sealed-must-prove-it-but-engine-checks-nothing.md
  modified:
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "290-04: connectionVerbFence.test.ts pin NOT raised: it measured 22 at the phase base, so its +1 is inherited, not 290's"
  - "290-04: WorkflowCard.test.tsx raised 128 -> 133 although +2 predate 290 (base 130); raising only tightens, and the split is in the comment"
  - "290-04: WorkflowCanvas.tsx ledger: the 286 forecast was met but spent one hook and one branch, so the next concern there proposes the extraction FIRST"
  - "290-04: the D-20 drift is filed as BUG-261021-05 (major, open), not fixed"
metrics:
  duration: ~75 min
  completed: 2026-10-21
  tasks: 3
  files: 5
---

# Phase 290 Plan 04: Close-out (gates, ledger, D-20 report) Summary

Phase 290 passes its gates against its own base `1f9673d25`. The count gate reads OK twice with 0 failing, the tsc error set is byte-identical (63 = 63), the hooks rules check is OK, and the scope fences are empty. The seven new suites are now pinned in the count gate. The hot-file ledger records what 290 spent on each file it touched. The escalated-seal drift is filed as `BUG-261021-05` and not fixed.

**Plan base:** `ed9792704` (develop, with 290-01..03 merged). The worktree started on `17a064f2e`, and the branch check reset it to the base before any work.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 | `dce826048` | test(290-04): pin the 290 suites in the count gate; record phase gates |
| 2 | `5d2961dcb` | docs(290-04): ledger rows and sections for the card, the canvas, the builder and the six new modules |
| 3 | `ec100b970` | docs(290-04): file the escalated-seal drift (D-20) |

The ledger-gate results and this SUMMARY are committed together after Task 3.

## Gates (full detail and commands in 290-04-GATES.md)

| Gate | Verdict |
|---|---|
| Count gate, run 1 (before the pins) | `count gate OK — 486/486 pinned files present, no per-file decrease, 0 failing.` total 11371, pinned 10247 |
| Count gate, run 2 (after the pins) | `count gate OK — 493/493 pinned files present, no per-file decrease, 0 failing.` total 11371, pinned 10605 (= 10247 + 343 + 10 + 5) |
| tsc `-p tsconfig.app.json`, base vs HEAD | 63 / 63 errors, `diff` empty including line and column |
| `check-react-hooks-rules.cjs` | OK, no new violation (the 2 it reports are in `ToolCallPanel.tsx`, which predates 290) |
| Scope fences (backend, supabase, WorkflowRunPage, PhaseSpineGraph, PhaseNodeCard, phaseVocabulary, soulData, WorkflowSoul, PhaseSpine) | empty, so backend untouched and the backend baseline was not triggered |
| Pages snapshots | nothing modified in this worktree. The two CRLF-only modifications the plan expected live in the operator's main checkout. |
| `check-claude-md-size.cjs` | OK, 97,601 chars, no finding |
| `check-hot-file-ledger.cjs 290` | `ledger gate OK`, 10 watched files |
| `check-seeds-register.cjs --phase 290` | observation only: register OK at 374/374. Seven seeds' triggers match 290 paths (listed in GATES.md). No seed edited. SEED-155 and SEED-086 still read `folded` / `partial: true` / `folded_into: "290"`. |

No red appeared on any run, so no inherited-at-base proof was needed for a failure. A throwaway base worktree, set up and removed with the project scripts (`TEARDOWN OK`, source venv and node_modules intact), supplied the base-tree runs: the tsc set and the pin split.

## Count-gate pins

- **Added (7)**, each at its printed actual: `teamModel.test.ts` 243, `teamVocabulary.test.ts` 15, `WorkflowCanvas.headerPin.test.tsx` 6, `TeamPicture.test.tsx` 36, `WorkflowCanvas.team.test.tsx` 7, `stepLine.test.ts` 25, `StepChipLine.test.tsx` 11. All seven run under the `src/components/workflows` directory TARGET, so TARGETS was not changed.
- **Raised (2):**
  - `librarySubtree.fences.test.ts` 133 → 143. The base measured 133, so all +10 are 290-02's.
  - `WorkflowCard.test.tsx` 128 → 133. The base measured 130, so +3 are 290-02's and +2 are inherited.
- **Not raised:**
  - `connectionVerbFence.test.ts` reads 22 against a pin of 21, but it also measured **22 at base**. 290-03 edited it without growing it.
  - `WorkflowCanvas.test.tsx` (105), `governanceVocabulary.test.ts` (30) and `WorkflowCard.seam286.pin.test.tsx` (21) did not move.
  - About 100 other suites sit above their pins in files 290 never touched. That lag predates 290 and is left as found.

## Ledger rows changed (CLAUDE.md + docs/HOT-FILE-LEDGER.md, one commit)

| File | Triple | CLAUDE.md cell |
|---|---|---|
| `library/WorkflowCard.tsx` | 23 / 9 / 1361 (was 22 / 8 / 1354) | 290-02: ONE chip-line block from row.def; still 0 useState |
| `library/libraryVocabulary.ts` | 12 / 6 / 802 (was 11 / 5 / 766) | 290-02: six STEP_LINE_ entries (data), no logic |
| `WorkflowCanvas.tsx` | 32 / 10 / 1744 (was 31 / 9 / 1708) | 290-03: Team view = 1 prop, 1 state, 1 early return · extraction FIRST next · ⛔ |
| `pages/WorkflowBuilderPage.tsx` | 60 / 25 / 2810 (was 59 / 24 / 2808) | 290-03: ONE prop (team) at the canvas call, no state · ⛔ |
| `PhaseSpineGraph.tsx` | 8 / 6 / 723 (unchanged) | 290: forecast unused — chips went on the library card, not here |
| `PhaseNodeCard.tsx` | 18 / 9 / 490 (unchanged) | 290: forecast unused — chips went on the library card, not here |

The six young rows are scan-list only, because none of them fires. Each now reads `<triple> (was 0 / 0 / 0)` and `young (created 290-0N)`:

| File | Triple |
|---|---|
| `teamModel.ts` | 2 / 1 / 403 |
| `teamVocabulary.ts` | 1 / 1 / 202 |
| `TeamPicture.tsx` | 1 / 1 / 470 |
| `__fixtures__/teamFixtures.ts` | 1 / 1 / 198 |
| `library/stepLine.ts` | 2 / 1 / 74 |
| `library/StepChipLine.tsx` | 2 / 1 / 110 |

Every replaced cell is preserved verbatim under `(replaced by 290-04)`, which accounts for the 18 occurrences. The canvas section lists the six spent budget items with their line numbers at HEAD. `connectionVerbFence.test.ts` is a test file, so the ledger gate does not watch it and it needs no row. Its out-of-scope 290-03 edit is recorded in GATES.md and in the TeamPicture section.

## The D-20 report

The report is `BUG-261021-05`: an escalated step is sealed "Must prove it" in the builder and on the canvas, but the engine attaches no check to it. It is filed as `surface: Agentic-RAG`, `severity: major`, `status: open`, `folded_into: null`, with `re_open_trigger` set to the next phase that names `WorkflowBuilderPage.tsx` gatesFor, `NodeCornerMarks.tsx`, or `grounding.py` effective_phase.

Evidence, measured at `ed9792704`:
- **Builder:** `gatesFor` locks a gate row for `detected || escalated` (`WorkflowBuilderPage.tsx:442`).
- **Canvas:** `isGrounded` is `!== null` (`canvasModel.ts:382-384`), which drives the seal (`NodeCornerMarks.tsx:289-302`).
- **Engine:** `effective_phase` adds `citations_required` only for `"detected"` (`grounding.py:1424`). Every backend caller of `grounding_cause` compares only against `"detected"` (`grounding.py:1206`, `:1424`, `api/workflows.py:988`). `is_locked` (`engine_ask.py:740-746`) only narrows the choices offered when a detected step pauses.

The report also includes a related observation, not filed as a second bug: an `llm_emit` step with no explicit `citation_policy` reads as already-set on the backend (where `harness.py:169` defaults it to strict) but not on the frontend.

## Deviations from Plan

### Auto-fixed Issues

None. The plan executed as written, with the choices below.

### Choices made within the plan

1. **[Scope] connectionVerbFence pin not raised.** The plan says to raise "every suite 290 grew". A base-tree run shows 290 did not grow this suite (22 at base and 22 at HEAD), so the +1 is inherited pin lag and is left as found.
2. **[Scope] WorkflowCard.test.tsx raised to the printed actual (133), including +2 inherited cases.** This follows the plan's "raise to its printed actual" and the 286-05 precedent. The split is stated in the pin's comment.
3. **[Process] `graphify update .` not run in this worktree.** `graphify-out/` is tracked, so running it here would dirty tracked files that must never be staged, and they would be lost at teardown. This follows the 290-03 precedent: the orchestrator should run it once after the merge.
4. **[Process] GATES.md was committed twice.** It went in with Task 1 (count gate, tsc, hooks, fences), then the ledger-gate and report sections were completed and committed with this SUMMARY. The Task 2 and Task 3 commits therefore contain only their own files, as their acceptance criteria require.
5. **[Data] The `WorkflowBuilderPage.tsx` scan-list row was stale.** It read `58 / 23 / 2803`, never updated at 288. It is re-derived to `60 / 25 / 2810` with its old value kept.
6. **[Data] The `WorkflowCanvas.tsx` numstat against the phase base is +40 / −4** (net +36, which matches 1708 → 1744). 290-03-SUMMARY recorded +39 / −3. The ledger section records both.

## Observations (not acted on; the operator decides whether to file)

- **From 290-01, `phaseVocabulary.ts`** (a G-5-firing file, outside 290's scope fence):
  - `nodeTitle` and `technicalTitle` read the presentation maps by bracket lookup, so a `constructor` phase type returns a function rather than a string.
  - `technicalTitle`, `groundingCauseOf` and `intersectingKbToolOf` throw on a step with no `config`.
  - `teamModel.ts` guards all four cases, and the `malformed` fixture pins each guard. This is recorded in the teamModel ledger section too.
- **Two pre-existing duplicate ids in the bug register:** `BUG-260528-01` and `BUG-260906-01` each appear twice. 290 authored neither, so they are out of scope.

## Known Stubs

None.

## Threat Flags

None. No source file changed in this plan: the diff is the gate script, two docs files, GATES.md and the bug report.
- T-290-15 is mitigated: 7 pins, and the grep prints 7.
- T-290-16 is mitigated: every verdict is in GATES.md with its command, and the base-tree runs are the proof.
- T-290-17 is mitigated: triples are re-derived, each row and its section are in one commit, and both ledger gates pass.
- T-290-18 is mitigated: BUG-261021-05 is open, with a trigger.

## Still owed

G-4 lived-experience rows from `290-VALIDATION.md` (S1-S5, SC#1-4, the D-02 measurement, the D-20 observation), driven in Chrome at `/gsd:verify-work 290`. The drive must be serial because the stress drafts mutate the local DB.

## Self-Check: PASSED

- FOUND: 290-04-GATES.md, BUG-261021-05-…md, scripts/vitest-count-gate.cjs (7 pins), CLAUDE.md, docs/HOT-FILE-LEDGER.md
- FOUND: dce826048, 5d2961dcb, ec100b970 in `git log`

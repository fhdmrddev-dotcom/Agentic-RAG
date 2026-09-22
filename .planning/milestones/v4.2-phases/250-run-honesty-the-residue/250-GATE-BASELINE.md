# Phase 250 — gate baselines, captured BEFORE the first edit

**Captured:** 2026-09-15, on `develop` at `a801fca3c` (the CONTEXT commit — `.planning/` only).
Working tree otherwise clean apart from `.claude/settings.local.json` and an untracked screenshot.
⛔ **No source file had been touched when these ran.** A red here is INHERITED, and this file is
the only thing that can prove that at close.

## Backend unit — AT THE CEILING, ZERO HEADROOM

```
71 failed, 4804 passed, 2 xfailed, 2 xpassed, 43 warnings in 278.41s
```

`pytest tests/unit -q --continue-on-collection-errors`, run in `backend/` with the venv.
**The SET of 71 failing node ids is captured verbatim at `250-backend-baseline-set.txt`.**

⛔ **Compare the SET, never the count.** A count of 71 at close proves nothing on its own — one
new failure and one flipped-green failure also reads 71. `SEED-274` records that this suite has a
71-name stable core, a 72-name union and one test that flips on a byte-identical tree, so a close
that reads 72 must diff the names before it claims a regression.

## Frontend count gate — RED AT BASELINE, 3 INHERITED FAILURES

`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, from the repo root, verdict line
verbatim:

```
  total                                      7550    8357    +807
  total 8357  ·  failed 3  ·  pinned total 7550
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 3 test(s) failed — the gate requires 0.
```

**Failing set, read from the gate's own persisted JSON BEFORE any re-run** (the SEED-171
procedure — filenames first, never a re-run to obtain a green):

| Suite | Failures | Signature |
|---|---|---|
| `src/pages/WorkflowBuilderPage.canvas.test.tsx` | 1 | `Error: STACK_TRACE_ERROR` — ⭐ **SEED-171's FIFTH named flaky suite, its recorded signature**, and the same suite that went red at Phase 249's gap-closure on provably unmodified code |
| `src/components/library/__tests__/sketchComposition.test.tsx` | 2 | one `STACK_TRACE_ERROR`; one `TestingLibraryElementError: Found multiple elements with the role "tab" and name "Documents"` — the duplicate-tab-trigger class `244-04` recorded on `LibraryHeaderBar.tsx` |

⛔ **CONSEQUENCE FOR THIS PHASE'S ACCEPTANCE CRITERIA, stated now so no plan writes a criterion
that cannot pass:** `count gate OK` is **NOT reachable** here. Phase 250 touches **no** workflow
page and **no** library component, so neither suite is in its blast radius. The criterion is:

1. **no NEW failing suite** beyond the two named above (compare the SET, from the JSON), and
2. **no per-file DECREASE**, and
3. every `+n` in the pinned total **attributed** to a suite this phase added or extended.

⚠ Phase 248 recorded a baseline claim of this shape and then **corrected itself in place** —
*"count gate OK is NOT reachable for this phase"* was refuted the same week, because two red
samples were generalised into a property. **This file states what was measured on ONE run at ONE
commit, and nothing more.** If a later run here reads green, that is the flake resolving, not this
file being wrong.

## Other gates, baseline

| Gate | Result |
|---|---|
| `node scripts/check-hot-file-ledger.cjs 250` | not yet meaningful — no PLAN.md exists at capture time; ⛔ **expected to FAIL on first run**, because four of this phase's files have no ledger row (`D-250-14`), and that is the gate working |
| `node scripts/check-claude-md-size.cjs` | run at close |
| `bash scripts/check-deploy-drift.sh` | run at close — this phase ships no env var, no migration, no bundled service, no sandbox tag |

# Phase 241 — Wave 1 post-merge gate evidence

Recorded by the execute-phase orchestrator after merging 241-01, 241-02 and 241-03
from their worktrees onto `develop`. Base commit for all three: `0ce1a7c43`.

This file exists because the post-merge gate is the ONE check no worktree self-check can
perform — each executor's suite was green in isolation, and only the merged tree can show
a cross-plan interaction.

## Backend unit gate — CEILING HELD

Canonical command, run in `backend/` with the venv:
`pytest tests/unit -q --continue-on-collection-errors`

| | failed | passed | xfailed | xpassed |
|---|---|---|---|---|
| baseline at 241's start (STATE.md) | 71 | 4374 | 2 | 2 |
| **after merging all three plans** | **71** | **4452** | 2 | 2 |

`+78` passed = the three plans' new cases (24 + 21 + 33). **Zero headroom intact.**
No test whose name contains `241` fails.

### The 15 `test_retrieval_service.py` failures are INHERITED, not 241-03's

This was the one result that looked like a regression, because 241-03 landed on
`retrieval_service.py` and every one of the 15 failures is in `search_documents`.
It is not a regression, and the proof is one command:

```
git show 0ce1a7c43:backend/app/services/retrieval_service.py | grep -n "def search_documents"
  351:async def search_documents(
```

`search_documents` was **already `async` at the base commit**. The failures are sync
callers doing `result, avg_sim = search_documents(...)` and getting
`TypeError: cannot unpack non-iterable coroutine object` — suite rot that predates
this phase. 241-03 did not make it async.

### ⚠ A FLAKY BACKEND TEST, found by running the gate twice

`tests/unit/test_230_ingestion_jobs_db.py::test_live_claim_exclusivity_and_stale_recovery`
**FAILED in run 1 and PASSED in run 2 on a byte-identical tree.**

Recorded because of what zero headroom means: a flaky backend test can push the count to
72 and break the gate for a phase that changed nothing near it. This is the backend twin
of SEED-171, and it is the same mechanism that once published a baseline of 71 when the
truth was 72.

⚠ **A name-extraction warning, paid for here.** Run 1's `sed` pipeline yielded **72**
unique ids against pytest's own `71 failed`. The cause is the one 241-01 flagged: pytest
glues `RuntimeWarning` text onto a `FAILED` line with no separator. Count raw `^FAILED `
lines (`grep -c`), and diff sets in BOTH directions — never trust a derived count.

## Vitest count gate — RED, and the red is provably not this phase's

`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root.

```
total 7940  ·  failed 4  ·  pinned total 7170
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 4 test(s) failed — the gate requires 0.
```

**The gate's OTHER contract held: no per-file DECREASE.** `[failing-tests]` was the only
violation reason. Pinned total grew `7026 → 7170`; grand total `7822 → 7940`. **A growing
number is the gate working**, not drifting — its contract is no per-file decrease and zero
failing, never a fixed grand total.

### The four failures, captured from the gate's own persisted JSON BEFORE any re-run

| File | Case | Signature |
|---|---|---|
| `src/pages/WorkflowBuilderPage.canvas.test.tsx` | canvas door flag ON | `STACK_TRACE_ERROR` |
| `src/pages/WorkflowRunPage.test.tsx` | re-reads the ask slice on wake | `AssertionError: expected 0 to be greater than 0` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control, page heading | `STACK_TRACE_ERROR` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 four shipped tab triggers | `Found multiple elements with the role "tab" and name "Documents"` |

**Two are SEED-171 members showing their exact recorded signatures.** `WorkflowRunPage`'s
`expected 0 to be greater than 0` is verbatim the signature the seed records for it.

**`sketchComposition.test.tsx` is not a SEED-171 member, so it was checked rather than
assumed** — run alone it is **46 passed / 1 skipped / 0 failed**. Its gate failures are
cross-suite interference (`Found multiple elements` is leaked DOM), not a defect.

### Why none of them can be this phase's — reachability, not just diff-cleanliness

All three files are byte-unchanged: `git diff --numstat 0ce1a7c43 HEAD -- <file>` prints
nothing for each.

That alone is not sufficient — a changed SOURCE file could break an unchanged test. So the
footprint was measured. This phase's **entire** frontend diff is four files:

```
frontend/src/lib/api/skills.ts
frontend/src/pages/SettingsPage.test.tsx
frontend/src/pages/SettingsPage.tsx
frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx
```

None of the three failing suites references any of them (`grep -nE "SettingsPage|api/skills|hnsw"`
→ no reference, all three). And the `skills.ts` delta is **pure `interface` field additions** —
TypeScript types, erased at runtime, so it cannot change behaviour at all.

⭐ **Recorded as "provably unmodified", never as "fine".** One green sample of a flaky suite
is not proof of innocence — that is this project's own standing rule and it applies here.

## Decision

Wave 1 is treated as passing and Wave 2 proceeds. The backend ceiling held; the count
gate's red is inherited flake on files this phase cannot reach. This is stated as a
DECISION, not as a claim that everything ran green.

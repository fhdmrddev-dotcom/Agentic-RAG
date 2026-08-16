# Phase 194.1 — deferred / out-of-scope discoveries

## From plan `194.1-03` (2026-08-16)

### 13 failing cases across 3 UNGATED provider suites — PRE-EXISTING, not this plan's

Found while sweeping `src/__tests__/providers` and `src/components/chat/__tests__` after
plan 03's changes. **Out of scope and deliberately NOT fixed** (the executor scope boundary:
only auto-fix issues DIRECTLY caused by the current task's changes).

| Suite | failing |
|---|---|
| `src/__tests__/providers/streamsProvider.test.tsx` | 10 |
| `src/__tests__/providers/StreamsProvider.dedup.test.ts` | 2 |
| `src/__tests__/providers/streamsProvider_075_9_clientkey.test.tsx` | 1 |

**Why they are provably not plan 03's, stated as a measurement rather than a claim:**

1. **Every failing subject lies OUTSIDE every hunk of the plan's provider diff.**
   `git diff -U0 86471c13 HEAD -- frontend/src/providers/StreamsProvider.tsx | grep -E "^@@"`
   returns 19 hunks, touching base-file lines **170, 1214, 1225, 1938-1942, 2259-2293,
   2380-2472, 2959 and 3660**. The failing subjects are the reconcile in-flight lock
   (~:1500s), the reconcile placeholder re-mint (:1621-1632), `loadMessages`' MERGE filter
   (~:1290s), the `argsCodeText` reducer slice (module scope) and the client-key dedup —
   none of them inside any hunk.
2. **The whole-plan provider diff contains ZERO lines mentioning `tool_call`, `preparing`,
   `clientKey`, `client_key` or `dedup`** — the literal subjects of the `dedup` and
   `clientkey` failures.

⚠ **What is NOT claimed: that `194.1-BASELINE.md` cleared them.** It did not, and could not —
BASELINE §2 measured that `src/__tests__` has **no entry of any kind** in the count gate's
`TARGETS`, so these suites are neither executed nor pinned by the gate, and §11's
`failed 0` says nothing about them. Their pre-existing state was never measured by this
phase. The reasoning above is diff-containment, not a before/after run.

**Most likely home:** `SEED-056` (frontend vitest rot).
**Re-open trigger:** a phase that adds `src/__tests__` to the count gate's `TARGETS`, or any
phase that touches the reconcile lock, the reconcile re-mint, `loadMessages`' MERGE filter or
the `argsCodeText` reducer — at which point these become that phase's to measure properly.

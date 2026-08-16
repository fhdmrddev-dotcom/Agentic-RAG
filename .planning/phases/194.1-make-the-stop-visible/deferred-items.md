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

---

## From plan `194.1-04` (2026-08-16)

### A **14th** failing case, in a suite plan 03 never ran — same class, same disposition

`src/__tests__/hooks/useMessages.test.ts` ·
*"Phase 067.5 — Row 11 empty-thread-until-refresh regression › reconcile on switch-back
surfaces the post-done state, not an empty placeholder"* — **1 failing.**

Found while widening plan 04's verification beyond its own `<verify>` paths (the project rule:
*"run what actually covers the files you touched"*, after plan 02's stated near-miss). Plan 03's
sweep covered `src/__tests__/providers` and `src/components/chat/__tests__`; it did **not** run
`src/__tests__/hooks`, so this case's failure is newly OBSERVED rather than newly CAUSED.

**Why it is provably not plan 04's, as a measurement:**

1. My whole working-tree diff is seven files — `MessageInput.tsx`, `ChatArea.tsx`,
   `StopControl.tsx` and four test files. **`useMessages.test.ts` imports NONE of them.**
   `grep -n "MessageInput\|ChatArea\|StopControl" src/__tests__/hooks/useMessages.test.ts`
   returns four hits and **all four are COMMENTS** (`:466`, `:548`, `:556`, `:626`, each naming
   `ChatArea.tsx` line numbers in prose). There is no import edge from that suite to anything
   this plan wrote.
2. Its subject — the reconcile placeholder re-mint on switch-back — is **the same
   `StreamsProvider.tsx:1621-1632` re-mint** the plan-03 block above already names as a failing
   subject outside its diff. It belongs to the same rot set, and it is recorded separately only
   because it lives in a directory nobody had run.

⚠ **What is NOT claimed:** that it passed before. It was never measured by this phase — `src/__tests__`
has no entry in the count gate's `TARGETS` (BASELINE §2), so no baseline covers it. The reasoning is
import-containment, not a before/after run.

**Most likely home:** `SEED-056`.
**Re-open trigger:** as above, plus — a phase that touches `useMessages`' action surface (which is
already the recorded trigger for retiring `stopStream`, so the two are likely to arrive together).

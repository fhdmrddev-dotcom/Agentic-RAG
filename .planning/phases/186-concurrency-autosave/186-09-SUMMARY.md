---
phase: 186-concurrency-autosave
plan: 09
subsystem: workflow-builder
tags: [gap-closure, autosave, false-receipt, identity-compare, red-first, T-185-04-01]

# Dependency graph
requires:
  - phase: 186-06
    provides: "`useDraftPersistence` — the `for(;;)` drain, the single-flight queue, `pendingRef`, and the one `markSaved()` call site this plan re-conditions"
  - phase: 186-04
    provides: "`selectDefinition(state) = { ...state.meta, phases: state.phases }` — the two-reference shape that makes an O(1) identity compare total rather than partial"
  - phase: 186-07
    provides: "the composed loop on `WorkflowBuilderPage`, so the repaired receipt reaches the shipped surface without a further wiring change"
provides:
  - "a receipt that is a property of WHAT WAS WRITTEN — `markSaved()` runs only when the `phases` and `meta` references the request carried are still the store's current references"
  - "the mid-flight edit reaching the server instead of being dropped: the drain `continue`s into a fresh turn carrying the store's current definition"
  - "F17a/b/c — the interleaving the shipped F9 does not exercise, with the RED numbers recorded in the test file's own docblock"
affects:
  - "186-12 (WR-01, single-flight moves inside `performWrite`) — same function, same drain; it inherits `writtenPhases` / `writtenMeta` and the `superseded` const"
  - "186-13 (WR-03/04/05) — the hold-release effect and the halt, untouched here by design"
  - "`186-VALIDATION.md` rows 6 (`Never a false Saved ✓`) and 3b (publish hold) — both become meaningfully testable live, because the leave guard, `beforeunload` and the blur rescue all key on `dirty` and were previously disarmed by the false receipt"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate a receipt on the IDENTITY OF THE PAYLOAD, never on a queue flag that is a proxy for it (the T-185-04-01 lesson, met a second time)"
    - "Two reference compares stand in for a deep compare when the selector's shape proves they are total — stated in the code comment, not assumed"
    - "A regression test whose LOAD-BEARING line is the one that does LESS (advance half the debounce, not all of it), annotated as such so a later edit cannot quietly turn it back into the branch that already worked"
    - "An optional `onReceipt` recorder on an existing harness, defaulted away — the RED numbers become data in the failure output rather than prose in a report"

key-files:
  created: []
  modified:
    - frontend/src/hooks/useDraftPersistence.ts
    - frontend/src/hooks/useDraftPersistence.test.tsx

key-decisions:
  - "`pendingRef.current` was KEPT as the first disjunct rather than deleted. It is cheaper than two property reads and it still catches the one case identity cannot: a `saveNow()` or a hold-release that arms the queue without the store having moved. It is now one of three reasons a turn is superseded, not the only one."
  - "Identity compare, not deep compare. `selectDefinition` is `{ ...state.meta, phases: state.phases }`, so `meta` and `phases` between them determine every byte sent, and every mutating action replaces one of those references — the store's own dirty subscription keys on exactly that. A deep compare would cost O(phases) per turn to answer the same question."
  - "The plan's alternative fix — have the debounce effect arm `pendingRef` whenever it reschedules while `inFlightRef` is true — was NOT taken. It would re-scope the guard to a *better* proxy, which is the same class of mistake one layer out; the property is what was written."
  - "The `superseded` branch BODY is byte-unchanged (the `haltedRef` break, the `holdRef` → `heldPendingRef` arm, the trailing `continue`). Only the condition moved, so 186-12 and 186-13 open a function whose shape they still recognise."

# Metrics
metrics:
  duration: ~35 min
  completed: 2026-08-01
  tasks: 2
  commits: 2
  files-modified: 2
  migrations: 0
  packages-added: 0
---

# Phase 186 Plan 09: Receipt Gated on Payload Identity Summary

Closes GAP-1 / CR-01 — `performWrite` now files `markSaved()` only when the `phases` and
`meta` references it captured at snapshot time are still the store's current references, so a
mid-flight edit that never armed the queue flag is written instead of silently dropped under a
false `Saved ✓`.

## What Was Built

### Task 1 — F17, observed RED (`d1125fd9`)

Three tests in one new describe, placed immediately after F9, driving one interleaving through
a shared `driveMidFlightEdit()` helper so each property fails on its own terms:

| Test | Property |
|---|---|
| F17a | at the instant the receipt is filed, the phase count of the most recently SENT payload equals the phase count of the STORE |
| F17b | an edit made mid-flight, before its own timer matures, is written — 2 calls, the second carrying 4 phases and the token `T1` the first write returned |
| F17c | the orphaned timer maturing 3× later issues NO extra write |

The load-bearing line is `await advance(AUTOSAVE_DEBOUNCE_MS / 2)` — **half** the debounce,
annotated in the source as such. F9 advances a **full** `AUTOSAVE_DEBOUNCE_MS` after its second
edit, which matures that edit's own timer while the first write is held open; that timer finds
`inFlightRef.current` true and arms `pendingRef`, which is the branch that already worked.
Advancing the full debounce here would silently turn F17 back into F9.

`harness()` gained an optional `onReceipt?: (store) => void`, invoked inside the existing
`markSaved` wrapper before the real action runs. Every pre-existing call site is unchanged; no
test was deleted, renamed or retargeted.

### Task 2 — the fix (`3ef3689b`)

Inside the `for(;;)` drain, immediately after the `builderPhase !== "drafted"` break:

```ts
const writtenPhases = snapshot.phases
const writtenMeta = snapshot.meta
```

and at the bottom of the turn, **the exact condition that replaced `if (pendingRef.current)`**:

```ts
const now = store.getState()
const superseded =
  pendingRef.current || now.phases !== writtenPhases || now.meta !== writtenMeta

if (superseded) {
```

The branch body is unchanged — the `haltedRef` break, the `holdRef.current !== null` arm that
sets `heldPendingRef` and `{kind:"held"}`, and the trailing `continue` are all byte-identical.
`markSaved()` and `setState({kind:"saved"})` keep exactly one call site each on the
not-superseded path.

The module docblock's `NEVER A FALSE RECEIPT` section was restated over what was written, with
a `⚠` paragraph naming GAP-1 / CR-01, spelling out why the three `pendingRef` arming sites all
miss the common shape (type, pause about a second, resume), and naming the T-185-04-01 lesson —
so the next reader meets the reasoning rather than the patch.

## The RED output, verbatim

Run with `useDraftPersistence.ts` unmodified (`git diff --stat` on the hook was empty, confirmed
before committing):

```
 ❯ src/hooks/useDraftPersistence.test.tsx (26 tests | 3 failed) 282ms
     × F17a — at the instant the receipt is filed, the sent payload IS the store's payload 31ms
     × F17b — an edit made mid-flight, before its own timer matures, is written not discarded 10ms
     × F17c — the orphaned timer maturing later issues NO extra write 8ms

 FAIL  src/hooks/useDraftPersistence.test.tsx > useDraftPersistence — F17: a receipt names the payload it actually wrote (CR-01) > F17a — at the instant the receipt is filed, the sent payload IS the store's payload
AssertionError: expected [ 3 ] to deeply equal [ 4 ]

- Expected
+ Received

  [
-   4,
+   3,
  ]

 FAIL  ... > F17b — an edit made mid-flight, before its own timer matures, is written not discarded
AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times

 FAIL  ... > F17c — the orphaned timer maturing later issues NO extra write
AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times

 Test Files  1 failed (1)
      Tests  3 failed | 23 passed (26)
```

The recorded receipt pair is exactly the predicted `{ storePhases: 4, sentPhases: 3 }` — the
receipt named a payload the store had already moved past.

**One plan claim was corrected against the observation.** The plan's `<behavior>` block predicted
F17c would be green in RED. It is **red at 1**, for the same upstream reason as F17b: the orphaned
timer found `dirty` already cleared by the false receipt and issued nothing at all. F17c's real
job is the other direction — once the count reaches 2, it guards against over-correcting into a
third, duplicate write. The test-file docblock was edited to record the observed number rather
than the predicted one.

## Test counts

| Measurement | Before | After |
|---|---|---|
| `useDraftPersistence.test.tsx` | **23 passed / 23** | **26 passed / 26** |
| Full frontend suite — total collected | **3556** | **3556** |
| Full frontend suite — failures | 26 (incl. the 3 F17 RED) | 42 / 43 (two runs, unstable set — see below) |
| `tsc -b` errors | 33 | **33**, none naming a touched file |
| `vite build` | — | exit **0** |
| `frontend/package.json` + lockfile diff | — | **empty** (zero dependency change) |

The pre-plan baseline run started at 10:58:49 and was still transforming files when F17 was
written at ~11:00, so its 3556 total already includes F17's three tests and its 26 failures
already include their three RED failures. Read that way the pre-plan figures are **3553 collected
/ 23 failing**, and the total is non-decreasing at 3556 with the 3 new tests all green.

## Deferred Issues — the full-suite failure band is wider and less stable than SEED-056 records

**Out of scope; not fixed (executor scope boundary).** The post-fix full suite reports 43 then 42
failures across 12 then 11 files, and **the failing set is not stable between the two runs** —
`MessageItem` appears in one and not the other, `model-info` and `WorkflowBuilderPage.session` in
the other and not the first. That instability is itself the finding: the recorded "~14-17
pre-existing rot" figure understates it.

Evidence that none of it is this plan's:

- **No file in the failing set imports the changed hook.** The importers are
  `BuilderSaveRegion.tsx`, `builderStore.ts`, `WorkflowCanvas.editing.test.tsx`,
  `WorkflowBuilderPage{,.canvas,.session}.test.tsx`, `WorkflowsPage.tsx` — and all five consumer
  suites plus `builderStore.test.ts` and `PublishGauntlet.test.tsx` run **245 passed / 245** in
  isolation.
- **The 8 genuinely-rotten files fail identically in isolation** (21 failures / 144 tests):
  `streamsProvider.test.tsx`, `StreamsProvider.dedup.test.ts`,
  `streamsProvider_075_9_clientkey.test.tsx`, `IngestionPage`, `MessageItem`,
  `Plan04.frontend`, `useMessages`, `model-info`. This is SEED-056 rot, reproducible without any
  parallel load.
- **`PublishGauntlet.test.tsx` (18) and `WorkflowCanvas.test.tsx` (2) pass fully in isolation** —
  parallel-load flake, the behaviour STATE.md already records for both files.

No fix attempted, per the scope boundary. Recorded in `deferred-items.md` with a re-open trigger.

## Deviations from Plan

### Auto-fixed / corrected

**1. [Rule 1 — Bug in the plan's own prediction] F17c's RED number**
- **Found during:** Task 1, at the RED observation.
- **Issue:** the plan's `<behavior>` said F17c would be green in RED. It is red at 1.
- **Fix:** the test-file docblock records the observed number and explains why (the orphaned
  timer found `dirty` already cleared), rather than asserting the predicted one. The test itself
  is unchanged — it is a correct guard in both directions.
- **Files modified:** `frontend/src/hooks/useDraftPersistence.test.tsx`
- **Commit:** `d1125fd9`

**2. [structural, not a rule] Three `it` blocks rather than one**
- The plan's step list reads as a single interleaving asserting all three properties. Written as
  three `it`s over a shared `driveMidFlightEdit()` helper so a future regression names WHICH
  property broke in the failure output instead of stopping at the first assertion. The
  interleaving itself is the plan's, step for step.

### Measurement notes (the counting-criterion lesson, now EIGHT plans running)

Both of this plan's greps were satisfiable as literally written and both were run:

- `grep -n "pendingRef.current ||"` → exactly **one** line, `:444`, inside `performWrite`. ✓
- `grep -v '^\s*\*' | grep -c "markSaved()"` → **1**. ✓ (Raw grep also returns one line,
  `:462` — the docblock names the receipt in prose without the call parentheses, so the comment
  filter was not load-bearing here.)

The plan's `git diff --stat package.json frontend/package.json` needs a `--` path separator on
this repo (there is no root `package.json`); run as
`git diff --stat -- frontend/package.json frontend/package-lock.json` it is empty.

## Threat Model Verification

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-186-09-01 (Repudiation — false durability receipt) | **mitigated** | The receipt is gated on `now.phases !== writtenPhases \|\| now.meta !== writtenMeta`. Falsified RED first by F17a, which records the `{store, sent}` pair at receipt time and read `[3]` vs `[4]`. |
| T-186-09-02 (Tampering / data loss — dropped edit) | **mitigated** | The superseded branch `continue`s into a fresh turn carrying the store's current definition. F17b asserts the last sent payload's phase count equals `h.store.getState().phases.length`, i.e. stated over the store rather than over a literal. |
| T-186-09-03 (DoS — the drain's `continue` loop) | **accepted** | Each turn issues exactly one request and terminates when the store stops changing between snapshot and completion; no timer re-arms inside the drain. F17c pins that the orphaned timer maturing 3× later adds nothing. |
| T-186-09-SC (Tampering — npm installs) | **accepted / N/A** | `git diff --stat -- frontend/package.json frontend/package-lock.json` is empty. Nothing installed; the Package Legitimacy Gate does not apply. |

## No new threat surface

No network endpoint, auth path, file access pattern or schema was touched. Zero backend files,
zero migrations (head stays **114**), zero packages. The change is 3 statements and comments
inside one function of one frontend hook.

## Requirements

- **CONCUR-01** — a mid-flight edit now reaches the row it belongs to; no version is minted
  (the write path is unchanged, still `update_workflow_definition`).
- **CONCUR-02** — "never a false `Saved ✓`" is now a property of what was written, which is what
  re-arms `beforeunload`, the in-app leave guard and the blur rescue for the six G-4 manual UAT
  rows still owed in `186-VALIDATION.md`.

Both remain **not** independently re-verified — that is `/gsd:verify-work 186`'s job after waves
7 and 8 (186-12, 186-13) land on this same file.

## Self-Check

Verified after writing this summary — see the appended section below.

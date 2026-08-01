---
phase: 186-concurrency-autosave
plan: 19
subsystem: workflow-builder-persistence
tags: [autosave, concurrency, honesty, flag-off, D-181-01, WR-12, WR-13]
gap_closure: true
closes: [WR-12, WR-13]
requires:
  - "useDraftPersistence's hold mechanism (186-06 / 186-13 / 186-17)"
  - "BuilderSaveRegion's ungated `held` quiet line (186-13, WR-04)"
provides:
  - "HOLD_ENDED_UNSAVED — the flag-off release's true sentence"
  - "an overwrite() that leaves no arming behind"
affects:
  - frontend/src/hooks/useDraftPersistence.ts
tech-stack:
  added: []
  patterns:
    - "functional setState for every reading a hold release touches (GAP-4's second door)"
    - "one store read, two uses — the flag and the sentence cannot disagree"
    - "the two-doors derivation: a ref cleared wherever haltedRef is cleared"
key-files:
  created: []
  modified:
    - frontend/src/hooks/useDraftPersistence.ts
    - frontend/src/hooks/useDraftPersistence.test.tsx
decisions:
  - "D-186-19-A — the flag-off release's new reading is `{kind:\"held\"}`, not a new PersistState member: it rides BuilderSaveRegion's existing quiet line, which 186-13 deliberately left ungated by `autosaveEnabled`, so zero component files changed."
  - "D-186-19-B — the sentence is gated on the store's `dirty`, read ONCE and used for both the ref and the reading. Silence is kept for the case where silence is true."
  - "D-186-19-C — `overwrite()` clears `heldPendingRef` beside `haltedRef`, restoring the symmetry `reload()`'s success path already had. Nothing is lost: `performWrite()` runs on the next line and bypasses the dirty gate."
  - "D-186-19-D — the halted early return writes no ref, and the reason recorded is the TWO-DOORS derivation, not the plan's 'a halted loop is always dirty' shortcut — which was probed and MEASURED FALSE."
metrics:
  duration: ~35 min
  completed: 2026-08-01
  tasks: 2
  commits: 2
  tests_added: 2
  migrations: 0
  package_changes: 0
---

# Phase 186 Plan 19: Residual Warnings WR-12 / WR-13 Summary

The flag-off hold release now ends with a true sentence instead of a blank header, and a
conflict resolved by Overwrite no longer leaves an arming behind for a later clean hold cycle
to flush as an unrequested PATCH — both closed on the branches nobody watches, both measured
wrong first.

## What Changed

### WR-12 — the flag-off release says what happened (Task 1, `83a721fb`)

186-17 made the hold's reading resolve unconditionally on the non-null → null transition,
which killed the stale *"Publishing — not saved; press Save draft again when it finishes"*
sentence. On the `!enabled` branch it resolved to a bare `{kind:"idle"}` — so the instruction
was **erased at the exact instant it became actionable**, and the author was left holding
unsent work with nothing at all on screen until the leave guard fired on navigate-away.

- **One new locked constant**, `HOLD_ENDED_UNSAVED = "Not saved — press Save draft to save
  your changes"` (`useDraftPersistence.ts:212`), docblocked in the house voice: it instructs
  rather than promising (the F20e rule — a sentence may promise a flush only where one will
  happen), and it is deliberately not `SAVE_FAILED_SENTENCE`, because nothing was refused and
  the cause-neutral line would invite a retry of something that never failed.
- **The `!enabled` branch reads `dirty` once** into a local `const unsent`, arms
  `heldPendingRef` with it exactly as before, and when it is true applies a **second functional
  `setState`** that upgrades the reading. Functional, not a bare object: a bare object would
  erase a `conflict` — the only reading that carries Reload and Overwrite — which is GAP-4
  through a second door, and F20h exists to catch precisely that.
- **Nothing was written to buy the honesty.** The `return` still sits above `performWrite()`;
  `heldPendingRef.current = <dirty>` is unchanged in meaning. F20a, F20a-create and F20b still
  assert ZERO `updateWorkflowDraft` AND ZERO `createWorkflowDraft` calls.
- **No component file changed.** `git diff --stat BuilderSaveRegion.tsx` is empty — the reading
  rides the `held` → quiet-line path that 186-13 (WR-04) left ungated by `autosaveEnabled`.

### WR-13 — a chosen exit leaves no stale arming (Task 2, `a27e3e39`)

`saveNow` arms `heldPendingRef` whenever a hold is running. A conflict interrupts the release
(`if (haltedRef.current) return` sits above every disarming gate), so the arming survives the
halt. `reload()`'s success path already cleared it beside `haltedRef`; `overwrite()` did not.
The surviving flag was then read by the NEXT hold release as "there is unsent work", flushing a
PATCH against a draft nobody had edited — and every PATCH mints a fresh token, invalidating the
optimistic guard every other open tab holds. The mechanism built to resolve a concurrency
conflict was manufacturing one.

- `overwrite()` now clears `heldPendingRef.current = false` inside the same
  "nothing is mutated until the exit is known to be takeable" block that assigns `tokenRef`,
  **above** `await performWrite()`.
- The halted early return is **answered with a derivation rather than a shrug** — see the
  measurement note below.

## The two REDs, verbatim

Both were observed against unmodified behaviour before either fix was written.

**RED 1 (WR-12).** The constant declaration was added first (an unused export — not the fix;
the `!enabled` branch was untouched) so the test file could import it. Both rows then failed:

```
 ❯ src/hooks/useDraftPersistence.test.tsx (54 tests | 2 failed)
   × F20b — flag off: Save pressed WHILE held, then release ⇒ still nothing automatic
   × F20i — the flag-off release SAYS what happened; silence is kept for when nothing is unsent (WR-12)

AssertionError: expected { kind: 'idle' } to deeply equal { kind: 'held', …(1) }

- Expected
+ Received

  {
-   "kind": "held",
-   "sentence": "Not saved — press Save draft to save your changes",
+   "kind": "idle",
  }
```

(identical received value at both sites — `useDraftPersistence.test.tsx:1077` for F20b and
`:1104` for F20i(a)).

**RED 2 (WR-13).** The plan's derivation reproduced exactly:

```
 ❯ src/hooks/useDraftPersistence.test.tsx (55 tests | 1 failed | 54 skipped)
   × F23 — a chosen exit clears the pending arming, so a later clean hold writes nothing (WR-13)

AssertionError: expected "vi.fn()" to be called 2 times, but got 3 times
 ❯ src/hooks/useDraftPersistence.test.tsx:1980:26
```

The third call is the no-op PATCH: a definition nobody changed, minting a fresh token.

## Suite counts — up by exactly two, never down

| Point | Hook-suite tests | Delta |
|---|---|---|
| Baseline (before any edit) | **53** | — |
| After Task 1 | **54** | +1 (F20i) |
| After Task 2 | **55** | +1 (F23) |

All 55 green. **F20a, F20a-create, F20f, F20g, F20h, F20c, F20d, F20e, the whole F19 and F21
describes: unedited.** The combined `git diff --stat` for this plan is **132 insertions, 0
deletions** across the two files — no pre-existing row could have been weakened, because no
pre-existing line was removed. The single assertion that MOVED is F20b's PATCH-shaped
`expect(after.kind).not.toBe("held")`, retargeted to the positive
`expect(after).toEqual({ kind: "held", sentence: HOLD_ENDED_UNSAVED })`; both `not.toContain`
assertions were kept verbatim, so the row's assertion count is unchanged and its claim is
stronger.

## The three `heldPendingRef.current = false` sites, with enclosing functions

Re-derived from the tree at HEAD (`a27e3e39`), not inherited:

| Line | Enclosing function | Role |
|---|---|---|
| `:920` | the hold-release `useEffect` | the flush path — disarms just before `performWrite()` |
| `:1012` | `reload()` — SUCCESS path | pre-existing; the symmetry Task 2 restored |
| `:1072` | `overwrite()` | **NEW (WR-13)**, above `await performWrite()` |

(`:838` is a docblock mention, not a statement.) `haltedRef.current = false` appears in exactly
two places, `:1011` (`reload()` success) and `:1071` (`overwrite()`) — and both now clear
`heldPendingRef` in the same breath, which is the property the closure rests on.

## Explicit yes/no: does "a halted loop is always dirty" hold under measurement?

**NO. It is false, and the counterexample is a shipped path rather than a contrivance.**

The plan invited this docblock claim: *"a halted loop is also always dirty (it halts on a
REFUSED write, and a refused write leaves `dirty` true), so writing the ref on that branch
would be unobservable by construction."* It was probed directly against the hook rather than
reasoned about — a throwaway harness driving a `saveNow` press against a **clean** store with
`updateWorkflowDraft` rejecting `WorkflowStaleTokenError`, run once and deleted:

```
{
  "dirtyAtRest": false,
  "updateCalls": 1,
  "stateAfter": { "kind": "conflict", "currentToken": "T-SERVER" },
  "dirtyAfterHalt": false
}
```

`saveNow` **bypasses the dirty gate by design** (D-186-03 — a person who presses Save means
it), so a Save press on a clean store issues one PATCH, and a stale-token refusal lands the
loop in `{kind:"conflict"}` with `dirty === false`. The premise fails.

The docblock therefore carries the derivation that actually holds — the **two-doors** argument:
`haltedRef` is cleared in exactly two places, both of which now clear `heldPendingRef` too, so
an arming cannot survive a halt into a *running* loop (while the loop stays halted, nothing
reads the flag at all — this effect returns above it, the debounce timer returns on its own
halt check, and `performWrite` returns on its). The false premise is recorded **by name** in
the docblock with its measurement, so the next reader cannot resurrect it.

## Deviations from Plan

### Auto-fixed / re-derived

**1. [Rule 1 — false inherited claim] The plan's `tsc` acceptance criterion is not achievable
and was never true.**
- **Found during:** Task 1 acceptance.
- **Claim:** *"`cd frontend && npx tsc --noEmit -p tsconfig.app.json` reports zero errors."*
- **Measured:** **33 errors**, in `OrgProvider.test.tsx`, `StreamsProvider.tsx` and
  `streamsStore.ts`. The count is identical before and after both tasks, and **zero** of them
  name `useDraftPersistence`. The frontend working tree contained no other modified file, so
  every one of the 33 is pre-existing by construction (consistent with the recorded
  `frontend vitest/tsc rot` baseline). Nothing was fixed — out of scope, and the plan's
  criterion was an inherited number, not a measured one.
- **Action:** the criterion is recorded as *"0 errors in the plan's files, 33 pre-existing
  elsewhere, unchanged"*.

**2. [Rule 3 — TDD sequencing] The WR-12 constant declaration was added BEFORE the RED run.**
- **Why:** the test file imports `HOLD_ENDED_UNSAVED`; without the export the suite fails at
  module resolution, which is a RED that measures nothing. Only the `export const` + docblock
  landed first — the `!enabled` branch was untouched, so the RED that was observed is the
  genuine behavioural one (`{kind:"idle"}` received), not an import error. Both landed in the
  same commit.

**3. [Rule 3 — measurement over inheritance] A throwaway probe file was created and deleted.**
- `frontend/src/hooks/__wr13probe.test.tsx`, used once to measure the "always dirty" claim,
  then removed. It is absent from the tree and from both commits (`git diff --diff-filter=D
  --name-only HEAD~2 HEAD` is empty; no file was added or deleted by this plan).

### Not deviations, recorded for the verifier

- The plan predicted RED 2 might not reproduce, with an instruction to STOP and report. **It
  reproduced exactly** (3 calls where 2 expected), so the planner's derivation — that
  `overwrite()` is the only surviving route by which an arming outlives a halt — is confirmed
  by measurement.

## Verification

| Check | Result |
|---|---|
| `npx vitest run src/hooks/useDraftPersistence.test.tsx` | **55/55 green** (baseline 53 + 2) |
| `npx vitest run BuilderSaveRegion.test.tsx WorkflowBuilderPage.test.tsx WorkflowBuilderPage.session.test.tsx` | **49/49 green**, all three files unedited |
| `npx tsc --noEmit -p tsconfig.app.json` | 0 errors in this plan's files; 33 pre-existing elsewhere, count unchanged |
| `git diff --stat BuilderSaveRegion.tsx` | **empty** |
| `grep -rn HOLD_ENDED_UNSAVED src --include=*.ts --include=*.tsx \| grep -v useDraftPersistence` | **no matches** — one home, plus the co-located test |
| `git diff --stat package.json package-lock.json` | **empty** — zero package changes |
| Migrations | **zero** |
| Deletions in either commit | **none** (`--diff-filter=D` empty) |

## Threat register — dispositions met

| Threat ID | Met by |
|---|---|
| T-186-19-01 (a false receipt) | The reading is `{kind:"held"}`, which has no `at` and no `ok` field by construction and maps to the quiet line, never to `SAVED_STILL_A_DRAFT` or the `builder-save-error` alert. F20i asserts `markSaved` uncalled and `dirty` true. |
| T-186-19-02 (information disclosure) | Fixed client-authored string, nothing interpolated. Asserted DISTINCT from `HOLD_PUBLISHING`, `HOLD_PUBLISHING_MANUAL` and `SAVE_FAILED_SENTENCE` (F20i's inequality control). |
| T-186-19-03 (clearing the flag loses work) | `performWrite()` runs on the next line and bypasses the dirty gate. F23 asserts the Overwrite's own PATCH still happens (call 2 of 2); F20f's both-directions drive still green. |
| T-186-19-04 (the no-op PATCH) | Closed by T-186-19-03's clear, **measured** by F23's call count (3 → 2), not argued. |
| T-186-19-05 (D-181-01) | The `!enabled` branch keeps its `return` above `performWrite()`; only a `setState` was added below it. F20a / F20a-create / F20b keep asserting zero calls to both API functions. |
| T-186-19-SC (supply chain) | No package-manager install ran; `package.json` and the lockfile are untouched. No `## Package Legitimacy Audit` required. |

## Known Stubs

None. No placeholder value, empty literal or "coming soon" string was introduced; both new
readings are wired to real store state and proven by counting behaviour.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema was added or altered —
this plan changed one client-side string constant, one `setState` call and one ref assignment.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 (WR-12) | `83a721fb` | `feat(186-19): the flag-off hold release says what happened instead of going silent (WR-12)` |
| 2 (WR-13) | `a27e3e39` | `fix(186-19): a chosen exit leaves no stale arming for a later hold to flush (WR-13)` |

## What this executor deliberately did NOT do

Requirement status (`CONCUR-01`, `CONCUR-02`), the plan counter, and ROADMAP plan-progress are
**left exactly as the orchestrator set them**. The banned SDK verbs (`requirements.mark-complete`,
`state.advance-plan`, `roadmap.update-plan-progress`) were not called. `186-VALIDATION.md` was
not touched — it belongs to 186-18 in this wave, and this plan adds no operator UAT row (both
closures are proven by automated counting, and neither changes a surface the seven outstanding
rows exercise).

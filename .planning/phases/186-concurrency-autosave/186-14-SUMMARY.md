---
phase: 186-concurrency-autosave
plan: 14
subsystem: ui
tags: [react, hooks, optimistic-concurrency, autosave, workflow-builder, vitest]

# Dependency graph
requires:
  - phase: 186-06
    provides: the draft-persistence loop, its `PersistState` union and both conflict exits
  - phase: 186-07
    provides: `BuilderSaveRegion` and the conflict banner that carries the two exits
  - phase: 186-12
    provides: `resolving` + the exit re-entrancy guard the banner stays mounted on
  - phase: 186-13
    provides: `isTerminalRefusal` (WR-05) — the predicate this plan widened, and the
      ungated-exits asymmetry (`saveNow`/`reload`/`overwrite` obey the person, not the flag)
provides:
  - "A conflict exit that survives its own failure: `reload()`'s catch restores the conflict
    (with a note) whenever the loop is still halted, so a dropped request can never take the
    two controls that clear the halt off the screen with it"
  - "`RELOAD_FAILED_NOTE` — one home, nothing interpolated — plus an optional `note` on the
    `conflict` variant and a `builder-conflict-note` line inside the banner"
  - "A terminal published-row refusal: `isTerminalRefusal` now halts on
    `WorkflowConflictError`, so a DB-frozen row stops drawing one doomed PATCH per edit"
  - "6 new falsification-first tests (5 F21 + 1 WR-07 halt) and 3 new banner tests"
affects: [186-17, 187, workflow-builder, useDraftPersistence, BuilderSaveRegion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A failed EXIT is not a failed WRITE — a resolution that fails restores the state it
      was resolving, never replaces it"
    - "Halting is a property of the CAUSE, expressed as a predicate over error names; the
      taxonomy (which halts have exits, and where those exits live) lives in its docblock"
    - "A banner may gain lines; the sentence that OFFERS the exits may never be replaced"

key-files:
  created: []
  modified:
    - frontend/src/hooks/useDraftPersistence.ts
    - frontend/src/hooks/useDraftPersistence.test.tsx
    - frontend/src/components/workflows/BuilderSaveRegion.tsx
    - frontend/src/components/workflows/BuilderSaveRegion.test.tsx
    - .planning/phases/186-concurrency-autosave/186-VALIDATION.md

key-decisions:
  - "A failed reload RESTORES `{kind:\"conflict\"}` rather than inventing a state or widening
    the banner's render condition to include `error` — a 422 and a dead network must not put
    Reload/Overwrite on screen, where neither exit means anything"
  - "The restore is GUARDED on `haltedRef.current`: a reload that failed outside a conflict
    keeps the cause-neutral line, because claiming a conflict that never happened is the same
    class of lie in the other direction (falsified by F21f)"
  - "The note is an EXTRA line inside the banner, not the `builder-save-error` span — that
    span is for a refused WRITE and this is a failed READ during a chosen resolution"
  - "WR-07 adds the predicate and the tests only: after a published-row 409 the state stays
    `{kind:\"error\", sentence: PUBLISHED_CONFLICT_MESSAGE}` for the rest of the session, so
    the way out (Tweak) is already permanently on screen — no re-assertion machinery"

patterns-established:
  - "Failure-path restore: a resolution's catch asks 'is the thing I was resolving still
    true?' before choosing a state, so a transport failure cannot erase an affordance"
  - "Predicate-over-count docblocks: `isTerminalRefusal` documents a TAXONOMY of halting
    causes (which have in-app exits, which name their exit in prose) rather than a count that
    goes stale the moment a third cause is found"

requirements-completed: [CONCUR-01, CONCUR-02]

# Metrics
duration: 22min
completed: 2026-08-01
---

# Phase 186 Plan 14: Failed-Exit Durability + Terminal Published Refusal Summary

**A conflict exit that survives its own failure — `reload()`'s catch now restores the conflict with a `RELOAD_FAILED_NOTE` line instead of replacing it with a generic error that unmounted both escape hatches — plus `isTerminalRefusal` halting on `WorkflowConflictError` so a DB-frozen published row stops retrying forever.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-08-01T14:55:40Z
- **Completed:** 2026-08-01T15:17:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- **GAP-4 / CR-02 closed (the phase's only remaining blocker).** `reload()`'s catch restores
  `{ kind: "conflict", currentToken: conflictTokenRef.current, note: RELOAD_FAILED_NOTE }`
  whenever `haltedRef.current` is still true. The halt and the two affordances that clear it
  can no longer be separated by one dropped request.
- **The banner says why, as an extra line.** `builder-conflict-note` renders under the locked
  `CONFLICT_BANNER_MESSAGE`, with `builder-conflict-reload` and `builder-conflict-overwrite`
  both still mounted, both still enabled, still in D-186-08 order.
- **WR-07 closed.** A published-row 409 is terminal (the DB trigger
  `workflow_definitions_block_published_update` freezes the row), so three further edits after
  the refusal issue **zero** additional PATCHes.
- **The negative control held:** a reload whose row is genuinely GONE still lands
  `DRAFT_GONE_SENTENCE` and never becomes a conflict — pinned, unchanged by both fixes.

## Task Commits

1. **Task 1: F21 — a failed Reload keeps the conflict and both exits** — `ae19e5ca` (fix, TDD)
2. **Task 2: the banner carries the note as an extra line** — `67032b38` (feat)
3. **Task 3: WR-07 — a published-row 409 is terminal** — `4f4574d0` (fix, TDD)

## Files Created/Modified

- `frontend/src/hooks/useDraftPersistence.ts` — `note?: string` on the `conflict` variant;
  the exported `RELOAD_FAILED_NOTE`; `reload`'s catch + its new failure-path docblock;
  `isTerminalRefusal` widened to `WorkflowConflictError` with a rewritten taxonomy docblock;
  `performWrite`'s terminal arm comment now names both causes (the arm itself is unchanged).
- `frontend/src/hooks/useDraftPersistence.test.tsx` — the F21 describe (5 cases) with its
  reachability docblock and RED numbers; the WR-07 halt case in F8; the shipped published-row
  case extended with the `saveNow() === false` recording; the shipped gone-row reload case
  extended with the not-a-conflict clause (the negative control).
- `frontend/src/components/workflows/BuilderSaveRegion.tsx` — the note line inside the banner
  plus the additive-not-replacement paragraph; the four-sentence mapping's `conflict` row.
- `frontend/src/components/workflows/BuilderSaveRegion.test.tsx` — 3 cases (no note ⇒ no
  element; note ⇒ note + both exits enabled and in order; `resolving` ⇒ both still disabled).
- `.planning/phases/186-concurrency-autosave/186-VALIDATION.md` — manual row 7
  (**Conflict-exit failure**), `to run`. No existing row changed.

## The RED output, verbatim

### Task 1 — F21, before any source edit (`npx vitest run src/hooks/useDraftPersistence.test.tsx --testTimeout=30000`)

```
 ❯ src/hooks/useDraftPersistence.test.tsx (45 tests | 2 failed) 311ms
     × F21a — a rejecting listDraftWorkflows leaves the CONFLICT intact, with the server's token 25ms
     × F21d — the failed exit SAYS why, WITHOUT replacing the sentence that offers the exits 12ms

 FAIL  src/hooks/useDraftPersistence.test.tsx > useDraftPersistence — F21: a FAILED exit is not a lost exit (GAP-4 / CR-02) > F21a — a rejecting listDraftWorkflows leaves the CONFLICT intact, with the server's token
AssertionError: expected 'error' to be 'conflict' // Object.is equality

Expected: "conflict"
Received: "error"

 FAIL  src/hooks/useDraftPersistence.test.tsx > useDraftPersistence — F21: a FAILED exit is not a lost exit (GAP-4 / CR-02) > F21d — the failed exit SAYS why, WITHOUT replacing the sentence that offers the exits
AssertionError: expected { kind: 'error', …(1) } to deeply equal { kind: 'conflict', …(2) }

- Expected
+ Received

  {
-   "currentToken": "T-SERVER",
-   "kind": "conflict",
-   "note": undefined,
+   "kind": "error",
+   "sentence": "Not saved — we couldn't complete the save",
  }

 Test Files  1 failed (1)
      Tests  2 failed | 43 passed (45)
```

Failures were confined to the new F21 describe, and F21a's reported state is `error` — as the
plan's acceptance criterion required. `RELOAD_FAILED_NOTE` resolved to `undefined` (Vite's SSR
transform does not statically check named exports), which is why F21d's diff prints
`"note": undefined` rather than failing at import time — a cleaner RED than a module error.

### Task 3 — the WR-07 halt case, before the predicate change

```
 ❯ src/hooks/useDraftPersistence.test.tsx (46 tests | 1 failed) 143ms
     × a PUBLISHED row HALTS the loop — three further edits issue nothing at all (WR-07) 11ms

 FAIL  src/hooks/useDraftPersistence.test.tsx > useDraftPersistence — F8: a refusal never files a receipt > a PUBLISHED row HALTS the loop — three further edits issue nothing at all (WR-07)
AssertionError: expected "vi.fn()" to be called 1 times, but got 4 times
❯ src/hooks/useDraftPersistence.test.tsx:636:26
    634|     }
    635|
    636|     expect(mockedUpdate).toHaveBeenCalledTimes(atRefusal)

 Test Files  1 failed (1)
      Tests  1 failed | 45 passed (46)
```

4 calls where 1 is expected: the refusal, plus one doomed PATCH per edit — the retry loop
WR-07 named, measured.

## The two constants, verbatim

`RELOAD_FAILED_NOTE` (the only new string; `PUBLISHED_CONFLICT_MESSAGE` is 186-07's, unchanged
and reproduced here because Task 3's assertions depend on it):

```ts
export const RELOAD_FAILED_NOTE =
  "We couldn't reach the server to reload — nothing has changed, and both options above still work."

export const PUBLISHED_CONFLICT_MESSAGE =
  "This version is published and can't be edited — use Tweak to start a new draft"
```

## `haltedRef` write-site enumeration (the goal-backward proof)

Read from source, not inferred — `grep -n "haltedRef.current" frontend/src/hooks/useDraftPersistence.ts`
returns 11 sites, of which **4 are writes** and 7 are reads. Every write, and what can clear it:

| Line | Write | Set by | Which affordance clears it |
|------|-------|--------|-----------------------------|
| 617 | `= true` | `performWrite` catch, `refusal.kind === "conflict"` (a `stale_token` 409) | **Reload** (line 838) or **Overwrite** (line 886). Both are on the conflict banner, which renders on `state.kind === "conflict" \|\| resolving` — and after this plan that state is restored by `reload`'s catch (line 846) instead of being replaced, so the banner cannot leave while the halt is set. |
| 626 | `= true` | `performWrite` catch, `isTerminalRefusal(err)` — a 404 (WR-05) **or** a published-row 409 (WR-07, this plan) | **Nothing in-app, deliberately.** No exit exists: for a gone row Reload would find nothing and Overwrite would PATCH a row that is not there; for a published row the DB trigger refuses every PATCH. Neither state is a `conflict`, so no dead affordance is offered, and each carries a sentence that is the whole answer — `DRAFT_GONE_SENTENCE` ("copy anything you still need") and `PUBLISHED_CONFLICT_MESSAGE` ("use Tweak to start a new draft"). The way out is leaving this row, and the sentence says so and stays on screen. |
| 838 | `= false` | `reload`'s SUCCESS branch only (after `setDrafted` + token adoption) | — (this is a clear) |
| 886 | `= false` | `overwrite`, above the `performWrite()` call | — (this is a clear) |

**The reads** (553 `performWrite` entry, 647 the supersede branch, 683/686 the debounce effect
and its timer, 744 the hold-release effect, 758 `saveNow`, 846 `reload`'s catch) are all
"issue nothing" gates, plus the one new decision point.

**Why GAP-4 cannot recur in a third place:** there are exactly two clears, both inside the two
exits, and both exits live on exactly one surface (`BuilderSaveRegion`'s banner — verified as
the sole consumer of `onReload`/`onOverwrite` in non-test source). Therefore *any* code path
that can leave the `conflict` reading while `haltedRef` is set strands the loop. Before this
plan there was one such path (`reload`'s catch). After it there are **none**: the catch is now
the only writer of state in that function's failure path and it restores the conflict, guarded
on the halt itself. A future third exit would have to both clear the halt and be rendered from
the same state, or it would reintroduce the class.

## Test counts (measured per file in isolation, `--testTimeout=30000`)

| Suite | Before | After |
|-------|--------|-------|
| `src/hooks/useDraftPersistence.test.tsx` | **40** | **46** (+5 F21, +1 WR-07 halt) |
| `src/components/workflows/BuilderSaveRegion.test.tsx` | **8** | **11** (+3) |
| The 6-suite aggregate from Task 3's acceptance command | 235 (derived) | **244 passed / 244** |

No test was deleted or retargeted away from its claim; two shipped cases were **extended**
(the F8 published-row case, the F10 gone-row reload case).

## Verification results

| Check | Result |
|-------|--------|
| `npx vitest run src/hooks/useDraftPersistence.test.tsx` | ✅ 46/46, 0 failures — F8, F9, F10, F11, F15, F17, F19, F20, F21 all green in one run |
| `npx vitest run src/components/workflows/BuilderSaveRegion.test.tsx` | ✅ 11/11 |
| Task 2's 4-suite command (BuilderSaveRegion + canvas + session + header) | ✅ **145/145, zero failures** — including `WorkflowBuilderPage.session.test.tsx`, for which the plan permitted one known WR-11 failure at `:591`. It did not fail in this run (see Deviations). |
| Task 3's 6-suite aggregate | ✅ 244/244 |
| `npx vite build` | ✅ exit 0 (7.24 s) |
| `npx tsc --noEmit -p tsconfig.app.json`, filtered to this plan's files | ✅ no errors in `useDraftPersistence` / `BuilderSaveRegion` / `WorkflowBuilderPage`. Repo-wide pre-existing TS rot (SettingsPage, OrgProvider, streamsStore, SEED-056 class) is untouched and out of scope. |
| `ls supabase/migrations \| tail -1` | ✅ `114_harness_audit_action_risk_pending.sql` — zero migrations |
| `git diff --stat frontend/package.json frontend/package-lock.json` | ✅ empty (T-186-14-SC) |
| `grep -c 'data-testid="builder-conflict-note"'` / `-reload` / `-overwrite` | ✅ 1 / 1 / 1 |
| `grep -c "disabled={resolving}"` | ✅ 2 |
| `grep -c "haltedRef.current = false"` | ✅ 2 (the `reload` success branch and `overwrite`) — the catch clears nothing |
| `grep -rn "RELOAD_FAILED_NOTE" src/pages/WorkflowBuilderPage.tsx` | ✅ nothing — the string has one home |
| `grep -n "isTerminalRefusal"` | ✅ one declaration (:424), one call site (:619, inside `performWrite`'s catch), one prose mention (:202) |
| `grep -c "WorkflowConflictError"` in the hook | ✅ 2 → **3** (strictly greater; the predicate now names it as well as `refusalOf`) |
| `grep -c "^| "` in 186-VALIDATION.md | ✅ 62 → **63**; `grep -n "Conflict-exit failure"` matches exactly one line |

## Decisions Made

All three of the plan's locked decisions were implemented as written (restore-not-invent,
extra-line-not-replacement, no re-assertion machinery for WR-07). Two implementation calls were
made inside them:

- **The note is rendered inside a `flex-col` wrapper around the banner sentence**, so it reads
  as a genuine second LINE rather than a third item in the banner's horizontal row. The wrapper
  contains only the sentence and the note; both buttons remain direct children of the banner,
  so every shipped positional assertion (`banner.querySelectorAll("button")`, `contains`,
  `compareDocumentPosition`) is unaffected — verified by the 145-test run.
- **`performWrite`'s terminal arm kept its code and gained a comment.** The plan said the arm
  needs no edit; its comment said only "the row is gone", which after WR-07 describes one of
  two causes. Prose that names half the branch is how the next reader re-derives the wrong
  rule, so the comment now names both and states that the arm itself is unchanged.

## Deviations from Plan

### Measurement deviations (predictions the run corrected — no code changed)

**1. [Rule 1 — measurement] F21c and F21b did NOT go RED; the plan predicted F21c would be
"unreachable" before the fix.**
- **Found during:** Task 1 (the RED run)
- **Observed:** only F21a and F21d failed. F21b (the halt is intact) passed because the halt
  genuinely was intact — that half was never broken. F21c (a second `reload()` succeeds)
  passed because `reloadingRef` is reset in `reload`'s `finally`, so at the HOOK level a
  second reload was always accepted.
- **Why this matters, recorded rather than smoothed over:** the defect was never that the loop
  was unrecoverable in principle — it was that the SURFACE lost both controls, so no person
  could ever reach the second reload. GAP-4 is a reachability defect, and F21c is therefore a
  regression guard (the recovery must keep working now that the state is restored) rather than
  a falsification. F21a is the falsification, and it went RED exactly as predicted.
- **Action:** none. No test was weakened; the RED output is recorded verbatim above.

**2. [Rule 1 — measurement] `grep -n 'kind: "conflict"'` returns FOUR lines, not the THREE the
plan's acceptance criterion predicted.**
- **Found during:** Task 1 (acceptance greps)
- **Cause:** the plan enumerated the union member (:279), `refusalOf`'s stale-token branch
  (:369) and `reload`'s catch (:828) but overlooked the pre-existing
  `Extract<PersistState, { kind: "conflict" } | { kind: "error" }>` return annotation on
  `refusalOf` (:362), which also matches. The count was 3 before this plan and is 4 after.
- **The property the criterion was protecting still holds exactly:** this plan added **one**
  occurrence, and there are exactly **two producers** of a `conflict` state — `refusalOf`:369
  and `reload`'s catch:828. No fourth producer. Task 3's "unchanged from Task 1" criterion was
  verified against the corrected number (4).

**3. [Rule 1 — measurement] `WorkflowBuilderPage.session.test.tsx` passed fully; the plan
permitted one known WR-11 failure at `:591`.**
- **Found during:** Task 2 (the 4-suite verification)
- **Observed:** 145/145 passed. No wave-9 sibling plan (186-15/186-16) has landed — `git log`
  shows this plan's commits directly on top of `dfb9d539` — so the WR-11 row is either
  order-dependent (it may only red in a full-suite run) or was already latent-green in
  isolation. Recorded, not investigated: 186-15 owns that row.

### Auto-fixed Issues

None. No Rule 1/2/3 fix was required outside the plan's own scope; the two source changes are
exactly the ones the plan specified, plus the one comment correction noted under Decisions.

---

**Total deviations:** 3, all measurement corrections (0 code deviations, 0 scope creep).
**Impact on plan:** none on outcome. Two acceptance criteria were verified against corrected
numbers with the underlying property re-derived and re-checked by hand.

## Issues Encountered

None. Both RED states were observed on the first attempt, both fixes went GREEN on the first
run, and no fix-attempt budget was consumed.

## Threat model disposition

| Threat | Disposition | Evidence |
|--------|-------------|----------|
| T-186-14-01 (permanent self-inflicted DoS) | mitigated | F21a RED→GREEN; F21c proves recovery |
| T-186-14-02 (a false statement about state) | mitigated | F21d — the note is present and is neither refusal sentence |
| T-186-14-03 (a conflict that never happened) | mitigated | F21f — the `haltedRef` guard, falsified |
| T-186-14-04 (published-row retry loop) | mitigated | the WR-07 halt case: 4 calls → 1 |
| T-186-14-05 (information disclosure) | accepted | `RELOAD_FAILED_NOTE` is a fixed constant with nothing interpolated; `conflictTokenRef` is echoed as before and still never rendered (F15 unchanged) |
| T-186-14-06 (past the revert switch) | accepted | no automatic write path added; `performWrite()` call sites unchanged; the exits stay ungated because a person pressed them (D-181-01 untouched) |
| T-186-14-SC (npm installs) | accepted | empty `git diff --stat` on both package files |

## Known Stubs

None.

## User Setup Required

None — no external service configuration required. One new **operator-driven** manual check
was recorded (186-VALIDATION.md row 7, `to run`): reach the conflict banner, go offline, press
Reload, confirm the banner and both exits survive with the note; restore the network and
confirm a second Reload succeeds.

## Next Phase Readiness

- **GAP-4 / CR-02 — the phase's only remaining blocker — is closed** and WR-07 with it.
- **186-17 must re-read `useDraftPersistence.ts` before editing.** This plan and 186-17 both
  own that file and were sequenced into waves 9 and 10 for exactly that reason; line numbers in
  186-17's `<interfaces>` block are now stale (the file grew by ~75 lines: `reload` starts at
  :795, its catch at :845, `isTerminalRefusal` at :424, `performWrite`'s catch at :614).
- **186-15 owns the WR-11 session-suite row** noted above; it did not fail in this run.
- Manual rows 1, 2 and 7 of 186-VALIDATION.md remain operator-driven and unrun.

---
*Phase: 186-concurrency-autosave*
*Completed: 2026-08-01*

---
phase: 186-concurrency-autosave
plan: 17
subsystem: ui
tags: [react, hooks, optimistic-concurrency, autosave, debounce, workflow-builder, vitest]

# Dependency graph
requires:
  - phase: 186-06
    provides: the draft-persistence loop, its queue drain and the `PersistState` union
  - phase: 186-09
    provides: CR-01's payload-identity supersede test — the half this plan preserved verbatim
  - phase: 186-12
    provides: single flight as a property of the WRITER, i.e. `pendingRef`'s ONE arming statement
  - phase: 186-13
    provides: the `enabled` gate on the hold release (D-181-01) — the early return this plan moved
      the state resolution above, without moving the gate itself
  - phase: 186-14
    provides: `reload`'s conflict restore — the reading whose survival the functional `setState`
      form of the WR-09 resolution now protects (F20h)
provides:
  - "A bounded sustained write rate: the drain re-enters ONLY where a beat was consumed
    (`pendingRef`), so a typing author gets at most one write per `AUTOSAVE_DEBOUNCE_MS`
    measured over elapsed time, not one per round trip"
  - "A receipt gate that is payload identity ALONE — an explicit Save with nothing changed
    files the receipt the outstanding write earned and mints no extra PATCH"
  - "A break that resolves `{kind:\"saving\"}` → `{kind:\"idle\"}`, so `Saving…` is on screen
    only while a request is genuinely outstanding"
  - "A hold reading that resolves UNCONDITIONALLY on the non-null → null transition, above the
    halt gate, the `enabled` gate and the nothing-pending gate — functionally, so a `conflict`
    is untouched"
  - "`heldPendingRef` on the flag-off path set to the store's own `dirty`: it claims unsent work
    exactly when there is unsent work"
  - "7 new falsification-first tests (4 F22 + F20f/F20g/F20h) and one retargeted driver"
affects: [187, workflow-builder, useDraftPersistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One test, two purposes is a defect shape: when a boolean is used for two decisions,
      split the questions rather than tuning the boolean"
    - "A rate limit must not lie about state — the alternative (`await delay()` inside the
      drain) was rejected because it keeps `inFlightRef` true through the quiet period"
    - "A state resolution introduced above gates must be FUNCTIONAL, so it is a no-op for every
      reading it was not written for"

key-files:
  created: []
  modified:
    - frontend/src/hooks/useDraftPersistence.ts
    - frontend/src/hooks/useDraftPersistence.test.tsx
    - .planning/phases/186-concurrency-autosave/186-VALIDATION.md

key-decisions:
  - "WR-08 is fixed by SPLITTING two questions, not by throttling: payload identity decides the
    RECEIPT (CR-01 unchanged), `pendingRef` decides IMMEDIATE RE-ENTRY. No second timer was
    added — D-186-01's 'one debounce rule, one timer, one writer' is intact"
  - "The new `break` resolves the reading to `idle` in the same task that introduces it — the
    hazard the fix creates is closed by the fix, which is the pattern this phase failed five
    times"
  - "WR-09's resolution sits above ALL THREE gates rather than inside the `!enabled` arm the
    review named — the halt gate and the nothing-pending gate carry the identical hazard"
  - "`heldPendingRef.current = store.getState().dirty` on the flag-off path: 186-13 deliberately
    left it armed (so work is not lost) and the review wanted it cleared (so a stale arming
    cannot write later). Making it AGREE WITH THE STORE satisfies both"

requirements-completed: []

# Metrics
duration: 38min
completed: 2026-08-01
---

# Phase 186 Plan 17: Bounded Write Rate + A Hold That Ends When The Hold Does Summary

**The drain stopped giving the debounce back — supersede now decides only the RECEIPT and `pendingRef` only IMMEDIATE RE-ENTRY, so a typing author drops from 11 PATCHes per 3 seconds to 1 — and the hold's sentence stops outliving the hold on the flag-off surface, where it had been instructing people to wait for a gauntlet that had already finished.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-08-01T16:16:00Z
- **Completed:** 2026-08-01T16:54:00Z
- **Tasks:** 2
- **Files modified:** 3

## Task Commits

1. **Task 1: F22 — bound the sustained write rate, then split supersede from re-entry (WR-08)** — `4b02ed18` (fix, TDD)
2. **Task 2: WR-09 — the hold's reading resolves when the hold does, on every surface** — `fa6c1a03` (fix, TDD)

## The RED output, verbatim

### F22a and F22d, before any source edit

Two parameterisations of F22a were measured, and **both are recorded because the first one
understated the defect**. The plan's shape (`EDIT_INTERVAL_MS = AUTOSAVE_DEBOUNCE_MS / 4 = 250 ms`
against a 200 ms server) produced:

```
 FAIL  src/hooks/useDraftPersistence.test.tsx > useDraftPersistence — F22: the drain owes the same quiet period the first write did (WR-08) > F22a — a typing author gets writes on the clock, not on the round trip
AssertionError: expected 5 to be less than or equal to 4
```

5 calls, not the ~9 predicted. The reason is worth recording: when the typing cadence is LONGER
than the round trip the drain drifts ahead of the typist and eventually issues a PATCH after the
last edit, which is not superseded — so the storm **self-terminates**. That is a real measurement
of a real defect, but it measures the kindest case.

The shipped parameters make the storm sustained (`EDIT_INTERVAL_MS = AUTOSAVE_DEBOUNCE_MS / 8 =
125 ms`, i.e. an edit inside every request), 16 iterations:

```
 ❯ src/hooks/useDraftPersistence.test.tsx (50 tests | 4 failed | 46 skipped) 73ms
     × F22a — a typing author gets writes on the clock, not on the round trip 48ms
     × F22b — nothing is lost by the bound: the follow-up arrives on the ordinary beat 12ms
     × F22c — a break never leaves the surface claiming a save is in progress 5ms
     × F22d — an explicit Save with nothing changed mints no extra PATCH 4ms

 FAIL … > F22a — a typing author gets writes on the clock, not on the round trip
AssertionError: expected 11 to be less than or equal to 4

 FAIL … > F22b — nothing is lost by the bound: the follow-up arrives on the ordinary beat
AssertionError: expected 11 to be 12 // Object.is equality

- Expected
+ Received

- 12
+ 11

 FAIL … > F22c — a break never leaves the surface claiming a save is in progress
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times

 FAIL … > F22d — an explicit Save with nothing changed mints no extra PATCH
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
```

**F22a RED = 11 calls across 3000 ms of simulated time, against a bound of 4.** GREEN = 1.
**F22d RED = 2 calls where 1 is owed** — a Save press with nothing changed minted a second PATCH
purely because the queue flag was armed, bumping the token (and invalidating every other tab's
guard) for nothing. GREEN = 1.

F22b's RED (`expected 11 to be 12`) is the same defect read from the other side: the storm had
already sent everything, so the debounce beat issued nothing. F22c's call-count RED is the
defect; its **state** assertion could not go red pre-fix, because pre-fix a request really WAS
outstanding — `saving` only becomes a false claim once a break exists. That is said in the test's
own comment rather than dressed up as a falsification.

### The extended F20b (WR-09), before the source edit

```
 ❯ src/hooks/useDraftPersistence.test.tsx (53 tests | 2 failed | 44 skipped) 100ms
     × F20b — flag off: Save pressed WHILE held, then release ⇒ still nothing automatic 14ms
     × F20f — the flag-off release leaves the pending flag AGREEING with the store 13ms

 FAIL  … > F20b — flag off: Save pressed WHILE held, then release ⇒ still nothing automatic
AssertionError: expected 'held' not to be 'held' // Object.is equality
❯ src/hooks/useDraftPersistence.test.tsx:1065:28

 FAIL  … > F20f — the flag-off release leaves the pending flag AGREEING with the store
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times

Received:

  1st vi.fn() call:

    Array [
      "11111111-1111-1111-1111-111111111111",
      Object {
        "business_requirement": "Summarise the week's risks.",
        "phases": Array [ …2 phases… ],
        "project_folder_id": null,
        "slug": "risk-register",
        "version": 1,
      },
      "2026-08-01 12:00:00.123456+00",
    ]

Number of calls: 1
```

`expected 'held' not to be 'held'` is WR-09 exactly: the hold ended, nothing was written, and the
header still said *"Publishing — not saved; press Save draft again when it finishes"*.

F20f's RED is the second half, and the payload printed in the failure is the evidence: the PATCH
carries the **2-phase original draft** and the **session's original token** — a write against a
document nobody had edited, flushed by a Save press made in an earlier, flag-off session.

F20g and F20h passed before the fix, as designed. They are contrast controls: F20g so the
resolution cannot be bought by losing the flush, F20h so the resolution cannot be written as a
bare `setState({kind:"idle"})` that would erase a `conflict`.

## The drain, quoted verbatim after the change

`frontend/src/hooks/useDraftPersistence.ts:647-706` — the split is legible without running
anything: the identity compare gates the receipt, and `continue` is reached only under
`pendingRef`.

```ts
        // TWO QUESTIONS, ASKED SEPARATELY (186-17, WR-08). They used to share one answer,
        // and that is what turned this loop into a write storm.
        const now = store.getState()

        // (1) MAY A RECEIPT BE FILED? Decided by WHAT WAS WRITTEN and by nothing else
        // (GAP-1 / CR-01): the receipt is honest exactly when the `phases` and `meta`
        // references the request carried are still the references the store holds.
        //
        // `pendingRef` IS DELIBERATELY ABSENT FROM THIS TEST. A queue flag is not evidence
        // that the payload moved — it says only that somebody asked for a write while one
        // was outstanding. Treating it as a supersession is what minted a redundant PATCH
        // for a Save press that changed nothing (WR-08's second instance): the token was
        // bumped for no reason, invalidating the optimistic guard every other open tab
        // holds. An unchanged payload files the receipt the outstanding write earned.
        const superseded = now.phases !== writtenPhases || now.meta !== writtenMeta

        if (superseded) {
          // A newer edit landed mid-flight, so this confirmed write is already superseded
          // and no receipt may be filed for it — clearing `dirty` here would tell the
          // person their latest change is safe when it has not been sent.
          if (haltedRef.current) break
          if (holdRef.current !== null) {
            // A hold began while this write was outstanding. The queued edit becomes held
            // work rather than a second request.
            heldPendingRef.current = true
            setState({ kind: "held", sentence: holdRef.current })
            break
          }

          // (2) MAY THE LOOP ISSUE ANOTHER REQUEST IMMEDIATELY? Decided by `pendingRef` and
          // by nothing else — and the reason is re-derivable from its three arming sites,
          // all of which mean the SAME thing. It is set only inside `performWrite`'s
          // single-flight guard above, reached from the MATURED debounce timer, from
          // `saveNow`, or from the hold release. Each of those had its beat CONSUMED by
          // finding a write outstanding, so there is no live timer behind it and the
          // follow-up it asked for is genuinely owed now.
          //
          // Every OTHER supersession is an edit that landed mid-flight and is still inside
          // its own AUTOSAVE_DEBOUNCE_MS. Those have a LIVE timer by construction: an edit
          // changes `definition`, and the debounce effect's deps are `[definition, enabled]`,
          // so it reschedules. The ordinary autosave beat writes them.
          if (pendingRef.current) continue

          // A FOLLOW-UP IS OWED ON THE CLOCK, NOT NOW — so nothing is outstanding, and the
          // reading must stop saying one is. `dirty` is still true (no receipt was filed),
          // which is what the leave guards, `beforeunload` and the toolbar all key on.
          //
          // Without this break the drain re-entered on every keystroke-driven supersession
          // and the sustained write rate became one per ROUND TRIP instead of one per
          // AUTOSAVE_DEBOUNCE_MS (WR-08). Two knock-ons made that a correctness problem
          // rather than a performance one: every extra write mints a new token, so the loop
          // manufactured the very conflicts this phase exists to prevent, and it widened the
          // publish-race window 186-16 guards.
          setState({ kind: "idle" })
          break
        }

        // A CONFIRMED write with nothing newer queued is the ONLY thing that clears `dirty`.
        store.getState().markSaved()
```

## The hold release, quoted verbatim after the change

`useDraftPersistence.ts:826-846` — the resolution is above the halt gate, the `enabled` gate and
the nothing-pending gate.

```ts
    const previous = holdRef.current
    holdRef.current = holdReason
    if (previous === null || holdReason !== null) return
    // THE HOLD HAS ENDED, SO THE SENTENCE ABOUT IT ENDS TOO — above every gate below, and
    // functionally, so a `conflict`, `error` or `saved` reading that arrived during the hold
    // is untouched (186-17, WR-09).
    setState((s) => (s.kind === "held" ? { kind: "idle" } : s))
    if (haltedRef.current) return
    if (!enabled) {
      // No automatic write past the revert switch (D-181-01) — and no stale arming left
      // behind either: the flag is made to agree with the store rather than to remember a
      // press. See the docblock's pending-flag paragraph for both halves of the reason.
      heldPendingRef.current = store.getState().dirty
      return
    }
    if (!heldPendingRef.current && !store.getState().dirty) return
    heldPendingRef.current = false
    // D-186-12 literally: edits accumulated as dirty, and EXACTLY ONE write flushes them.
    // If one is already outstanding, `performWrite` arms the queue instead (186-12).
    void performWrite()
  }, [holdReason, enabled, store, performWrite])
```

## D-181-01 spot-check: every `performWrite()` call site and its gate

Read from source (`grep -n "performWrite()"`), not inferred. **Four call sites, unchanged in
number and in gate from 186-13's enumeration** — this plan moved a state resolution above one of
them and added no call site:

| Line | Caller | Gate | Automatic or chosen |
|------|--------|------|---------------------|
| 746 | the debounce timer (inside the effect at `:726`) | `if (!enabled \|\| definition === null) return` at `:727`, then at FIRE time `haltedRef`, `holdRef`, and `if (!store.getState().dirty) return` | **automatic** — behind the flag |
| 845 | the hold release (effect at `:825`) | `previous === null \|\| holdReason !== null` → `haltedRef` → **`if (!enabled) { … return }`** at `:834` → nothing-pending | **automatic** — behind the flag |
| 862 | `saveNow` | `haltedRef`, then `holdRef` (reports the hold instead of saving). **Deliberately NOT gated on `enabled`** — D-186-03 | **chosen** — the person pressed Save |
| 982 | `overwrite` | `inFlightRef \|\| reloadingRef` re-entrancy guard. **Deliberately NOT gated on `enabled`** — D-186-08 requires both exits on any surface | **chosen** — the deliberate second click |

`reload` issues no write at all (it reads `listDraftWorkflows` and calls `setDrafted`).
Every automatic site is behind `enabled`; every ungated site is a function the person invoked.
**The asymmetry is the decision, and it is unchanged: automatic writes obey the flag, chosen ones
obey the person.**

⚠ **The plan's grep criterion for this was imprecise, and the corrected measurement is recorded
rather than smoothed over.** `grep -n "if (!enabled)"` returns two lines (`:771` — new docblock
prose — and `:834`, the hold release), NOT "the debounce effect's and the hold release's". The
debounce effect's gate is `if (!enabled || definition === null) return`, which that pattern cannot
match. `grep -n "!enabled"` is the honest form and returns `:727`, `:771`, `:834`. The property the
criterion protected (two `enabled` gates in code, one per automatic writer, both above their
`performWrite`) holds and is re-derived in the table above.

## The three `pendingRef` arming beats — the evidence for the re-entry rule

⚠ **`grep -c "pendingRef.current = true"` returns 1, not 3, and that is the point.** The plan's
`<interfaces>` block spoke of "three arming sites at `:653` / `:703` / `:720`", which was the
pre-186-12 shape. Since 186-12 (WR-01) the arming has **exactly one home** — inside
`performWrite`'s single-flight guard (`:576`) — and the "three sites" are three CALL PATHS that
reach it. The count was 1 before this task and is 1 after; no arming site was touched.

| Beat | Path to the guard | What was consumed | Why an immediate follow-up is owed |
|------|-------------------|-------------------|-------------------------------------|
| the MATURED debounce timer (`:746`) | timer fires → `dirty` → `performWrite()` → `inFlightRef` true | **the beat itself.** The timer has fired and been cleaned up; the effect will not reschedule until `definition` changes again | no live timer is guaranteed behind it |
| `saveNow` (`:862`) | button press → `performWrite()` → `inFlightRef` true | the person's explicit press, which returned `false` | the press must not evaporate |
| the hold release (`:845`) | non-null → null → `performWrite()` → `inFlightRef` true | the release, which fires exactly once per hold | D-186-12: release FLUSHES, it does not retry on a timer |

`overwrite` (`:982`) can never reach the arming: its own `if (inFlightRef.current || reloadingRef.current) return`
guard sits above the call. So the three beats above are the complete set.

Every OTHER supersession is an edit that landed mid-flight and is still inside its own
`AUTOSAVE_DEBOUNCE_MS`. Those have a live timer **by construction** — an edit changes
`definition`, and the debounce effect's deps are `[definition, enabled]` — so they break and the
ordinary beat writes them. That is the whole re-entry rule, re-derivable from source.

## Test counts (measured per file in isolation, `--testTimeout=30000`)

| Suite | Before | After |
|-------|--------|-------|
| `src/hooks/useDraftPersistence.test.tsx` | **46** | **53** (+4 F22, +3 F20f/g/h) |
| The 7-suite consumer set (hook + BuilderSaveRegion + builderStore + api.workflows + header + canvas + session) | **270 passed / 0 failed** (measured at `8fbcc1b2`, this plan's base) | **277 passed / 0 failed** |

⚠ **The plan's stated baseline for the consumer set ("the verifier's six-file baseline was 233
passed + 1 failed") is stale and was not inherited.** Measured at this plan's actual base commit
the set is 270/270 with **zero** failures — 186-15 fixed the WR-11 row and 186-16 added cases.
Both numbers above were measured in this session; neither was copied from a prior SUMMARY.

## Verification results

| Check | Result |
|-------|--------|
| `npx vitest run src/hooks/useDraftPersistence.test.tsx --testTimeout=30000` | ✅ **53/53**, 0 failures — F8, F9, F10, F11, F15, F17, F19, F20, F21, F22 all green in one run |
| `npx vitest run …7 consumer suites… --testTimeout=30000` | ✅ **277/277**, 0 failures |
| `npx vitest run src/pages/WorkflowBuilderPage.session.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx` (Task 1's integration check on the new rate) | ✅ **110/110** — the known WR-11 row did NOT fail (186-15 closed it) |
| `npx vite build` | ✅ exit 0 (8.19 s) |
| `npx tsc --noEmit -p tsconfig.app.json`, filtered to this plan's files | ✅ no errors in `useDraftPersistence` / `BuilderSaveRegion` / `WorkflowBuilderPage` (repo-wide SEED-056 rot untouched, out of scope) |
| `grep -n "superseded\|pendingRef.current"` | ✅ `pendingRef.current` appears in the RE-ENTRY test (`:688`) and **not** in the receipt test (`:661`) |
| `grep -c "continue"` | ⚠ **2**, not the 1 the plan predicted — `:688` is the only `continue` **statement**; `:59` is new docblock prose naming the hazard. Exactly one code occurrence, and it is guarded by `pendingRef.current` |
| `grep -c "pendingRef.current = true"` | ✅ **1**, unchanged (see the arming-beats section — the plan's "3" described the pre-186-12 shape) |
| `grep -n 'kind === "held"'` | ✅ one line, `:832`, inside the hold-release effect and ABOVE the `haltedRef` gate at `:833` |
| `git diff --stat frontend/src/components/workflows/BuilderSaveRegion.tsx` | ✅ **empty** — the component was already right; the hook was not |
| F17 assertions unweakened | ✅ machine-checked: the F17 hunk in `git diff` touches only `driveMidFlightEdit`'s body (3 comment lines replaced, 2 assertions + 1 advance added before `return`). `toHaveBeenCalledTimes(2)` `:474`, `toHaveLength(4)` `:475`, `toBe("T1")` `:480` are byte-identical and still inside the F17 describe |
| `grep -c "^| "` in `186-VALIDATION.md` | ✅ **63 → 63** (a reword, not a new row); `git diff --stat` on it is 1 insertion / 1 deletion |
| `grep -n "3b"` | ✅ the reworded row, status still `to run` |
| `ls supabase/migrations \| tail -1` | ✅ `114_harness_audit_action_risk_pending.sql` — zero migrations |
| `git diff --stat frontend/package.json frontend/package-lock.json` | ✅ empty (T-186-17-SC) |

## Decisions Made

All four of the plan's locked decisions were implemented as written. Two implementation calls
were made inside them:

- **F22a's parameters were chosen by measurement, not by the plan's arithmetic.** The plan's
  cadence (a 250 ms typing interval against a 200 ms server) lets the drain drift ahead of the
  typist and the storm self-terminates at 5 writes. Shipping that would have understated the
  defect and left a future reader with a number that does not match the finding. The test now
  types faster than the round trip (125 ms), which keeps every request superseded and reproduces
  the sustained one-per-round-trip rate the finding describes. **Both measurements are recorded
  in the test's own docblock**, so the choice is auditable rather than tuned-to-taste.
- **F22h → F20h.** The plan asked for "one case for the OTHER two gates" without naming it; it is
  filed inside the F20 describe (it is a claim about the hold release) as F20h, and it does double
  duty: it falsifies the WRONG shape of the same fix (a non-functional `setState` that would erase
  a `conflict` and reintroduce GAP-4 by a second door).

## Deviations from Plan

### Measurement deviations (claims corrected by re-measuring — no code changed)

**1. [Rule 1 — measurement] `grep -c "pendingRef.current = true"` returns 1; the plan's
`<interfaces>` described three arming sites at three line numbers.**
- **Found during:** Task 1 (acceptance greps)
- **Cause:** 186-12 (WR-01) moved the arming into `performWrite`'s single-flight guard, giving it
  exactly one home. The three "sites" are three call PATHS. The plan's own prose says so a line
  later ("all three through `performWrite`'s single-flight guard"), so the line numbers were the
  stale half.
- **Impact:** none on the fix — the re-entry rule depends on the three BEATS, which are real and
  enumerated above. The acceptance criterion ("unchanged from before this task") is satisfied
  against the corrected number: 1 → 1.

**2. [Rule 1 — measurement] `grep -c "continue"` returns 2, not 1.**
- **Cause:** the module docblock this task rewrote names the hazard (`the drain's unthrottled
  \`continue\``). Exactly one `continue` **statement** exists, at `:688`, guarded by
  `pendingRef.current`. This is the F15 negative-control situation in miniature: a blanket count
  forbids the module from describing the thing it fixed.

**3. [Rule 1 — measurement] `grep -n "if (!enabled)"` does not match the debounce effect.**
- Recorded in full under the D-181-01 spot-check above, with the corrected grep and the property
  re-derived by hand.

**4. [Rule 1 — measurement] The plan's consumer-set baseline ("233 passed + 1 failed") is stale.**
- Measured at this plan's base commit `8fbcc1b2`: **270 passed, 0 failed**. The WR-11 row 186-14's
  SUMMARY flagged as possibly order-dependent did not fail in any run this session (7-suite,
  2-suite, or isolated).

**5. [Rule 1 — measurement] The plan's F22a RED prediction ("roughly one call per iteration",
implying ~9) was measured twice and is 5 or 11 depending on a parameter the plan fixed at 250 ms.**
- Recorded under "The RED output, verbatim" with the mechanism (drift vs. sustained supersession).

**6. [Rule 1 — measurement] F22c's STATE assertion cannot go red before the fix.**
- The plan anticipated this ("expect it to be meaningless until the break exists"), and it was
  confirmed: pre-fix a second request really was outstanding, so `saving` was TRUE. Only the
  call-count half of F22c is a falsification. Said in the test's comment, not papered over.

### Verified rather than inherited

The prompt asked for two inherited claims to be re-checked before being built on. Both were read
in source before any edit:
- **"F17b asserts 2 calls for 2 edits" — TRUE.** `expect(mockedUpdate).toHaveBeenCalledTimes(2)`
  at what is now `:474`, plus `toHaveLength(4)` and `toBe("T1")`. All three survive verbatim.
- **"F20b asserts zero calls and never asserts what the surface says afterwards" — TRUE.** The
  shipped case ended at `expect(h.store.getState().dirty).toBe(true)` with no `stateOf` call after
  the release. That is precisely the gap the extension fills, and its RED proves it.

### Auto-fixed Issues

None. No Rule 1/2/3 fix was required outside the plan's scope; the two source changes are exactly
the ones the plan specified.

---

**Total deviations:** 6, all measurement corrections (0 code deviations, 0 scope creep).

## Issues Encountered

None. Both RED states were observed on the first attempt, both fixes went GREEN on the first run,
and no fix-attempt budget was consumed.

## Threat model disposition

| Threat | Disposition | Evidence |
|--------|-------------|----------|
| T-186-17-01 (self-inflicted DoS against the golden-run row) | mitigated | F22a RED 11 → GREEN 1, bounded by elapsed time |
| T-186-17-02 (a conflict that never happened, via minted tokens) | mitigated | the same measurement — 11 tokens minted became 1 |
| T-186-17-03 (a receipt for something that did not happen) | mitigated | the receipt gate is payload identity alone; F17a/b/c pass with byte-identical assertions |
| T-186-17-04 (a false `Saving…` left by the new break) | mitigated | F22c + the retargeted driver's `stateOf(...).kind !== "saving"`; introduced and closed in the same task |
| T-186-17-05 (a false claim about system state, flag-off) | mitigated | F20b extended — RED `expected 'held' not to be 'held'`; the state carries neither hold constant afterwards |
| T-186-17-06 (past the revert switch) | mitigated | the `!enabled` arm still returns before `performWrite()`; the four-site enumeration matches 186-13's exactly; F20a/F20a-create/F20b all still assert ZERO network calls |
| T-186-17-07 (a stale arming that writes later) | mitigated | F20f — RED shows a PATCH carrying the untouched 2-phase draft and the session's original token; GREEN issues nothing while still flushing real accumulated work |
| T-186-17-SC (npm installs) | accepted | empty `git diff --stat` on both package files |

## Known Stubs

None.

## User Setup Required

None. One existing operator row was **reworded**, not added: `186-VALIDATION.md` row 3b now names
both halves of the flag — flag ON, the promise sentence and the flush on resolution; flag OFF, the
manual sentence while the gauntlet runs and its **absence** from the header once it ends. Status
stays `to run`.

## Next Phase Readiness

- **WR-08 and WR-09 are closed.** With 186-14 (GAP-4 + WR-07), 186-15 (WR-11 + WR-06 residue) and
  186-16 (WR-10), every item the 2026-08-01 re-verification raised now has a landed plan.
- **This was the last plan of phase 186.** The phase is NOT complete: the seven operator-driven
  rows in `186-VALIDATION.md` (1, 2, 3, 3b, 5, 6, 7) are still `to run`, and SC#4 — the two-editor
  parallel axis — is satisfied only by rows 1–3 being driven live.
- **`CONCUR-01` / `CONCUR-02` are deliberately NOT advanced in `REQUIREMENTS.md`.** No requirement
  status was written by this plan, and `requirements.mark-complete` / `state.advance-plan` /
  `roadmap.update-plan-progress` were not invoked. Writing a completion record for work no one has
  verified is the failure mode this phase has now met five times.
- **For 187 / anyone editing this hook next:** the two properties this plan added are stated in
  source as rules, not as line edits — *the drain re-enters only where a beat was consumed*, and
  *the hold's resolution is unconditional and functional*. Both have their own falsification (F22,
  F20f/F20h). A future change that re-arms `pendingRef` anywhere new must state which beat it
  consumed, or the re-entry rule stops being derivable.

## Self-Check: PASSED

- `FOUND: .planning/phases/186-concurrency-autosave/186-17-SUMMARY.md`
- `FOUND: frontend/src/hooks/useDraftPersistence.ts`
- `FOUND: frontend/src/hooks/useDraftPersistence.test.tsx`
- `FOUND: .planning/phases/186-concurrency-autosave/186-VALIDATION.md`
- `FOUND: 4b02ed18` · `FOUND: fa6c1a03`
- `git status --short` shows no uncommitted change belonging to this plan's source files; every
  other modified/untracked path predates it (GSD tooling, Supabase snippets, screenshots).

---
*Phase: 186-concurrency-autosave*
*Completed: 2026-08-01*

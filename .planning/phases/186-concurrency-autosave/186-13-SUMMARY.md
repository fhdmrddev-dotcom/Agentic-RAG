---
phase: 186-concurrency-autosave
plan: 13
subsystem: workflow-builder
tags: [gap-closure, D-181-01, revert-switch, false-receipt, terminal-refusal, red-first, WR-03, WR-04, WR-05]

# Dependency graph
requires:
  - phase: 186-06
    provides: "`useDraftPersistence` — `holdReason`, the hold-release effect, `refusalOf` and the `haltedRef` halt this plan gates, re-words and extends"
  - phase: 186-07
    provides: "`BuilderSaveRegion` — the `quietLine` ternary whose branch order is WR-04, and the single mount point on `WorkflowBuilderPage`"
  - phase: 186-09
    provides: "the payload-identity `superseded` test inside the drain — byte-unchanged here"
  - phase: 186-12
    provides: "single flight inside `performWrite`, the two guarded exits, and `BuilderSaveRegion.test.tsx` (net-new, 5 tests) which this plan extends to 8"
provides:
  - "`enabled` gating on the hold release — the LAST automatic write path in the hook now obeys the `visual_workflow_canvas` revert switch (D-181-01)"
  - "`HOLD_PUBLISHING_MANUAL` — the honest flag-off spelling of the publish hold, selected on the same input that decides whether the flush happens"
  - "a `held` reading that reaches the DOM on BOTH surfaces, so an explicit Save press always states an outcome"
  - "`DRAFT_GONE_SENTENCE` + `isTerminalRefusal` — a 404 halts the loop into `error` (never `conflict`) and says something a retry cannot fix"
  - "F20a-e — the flag-off write-leak property, with the RED numbers recorded in the test file's own docblock"
affects:
  - "`/gsd:verify-work 186` — this is the last of the three blockers the gap report raised; GAP-1 (186-09), GAP-2 (186-12) and GAP-3 (here) are now all closed"
  - "`186-VALIDATION.md` row 3b (publish hold) — newly meaningful on BOTH halves: the flag-ON promise and the flag-OFF instruction are now different sentences with different truth conditions"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A revert switch is a SECURITY control, so every automatic path must read it — the guard belongs in the effect, not in the caller's head"
    - "Guard POSITION is load-bearing and gets its own comment: after the mirror assignment (which must always run), before the pending-work clear (so a later flag-on session still finds the work)"
    - "A sentence that promises a future action takes the SAME input as the action, so the two cannot disagree — the false-receipt rule extended into the future tense"
    - "Halt on a PREDICATE over the cause, never on a comparison against the sentence — otherwise a copy edit becomes a behaviour change"
    - "Two halting causes, two different states: a stale token has real exits and a missing row has none, so offering the banner for both would be two dead affordances"
    - "A test that asserts only the hiding half of a gate certifies the silence it was meant to catch (the `autosaveEnabled: false` case, before and after)"

key-files:
  created: []
  modified:
    - frontend/src/hooks/useDraftPersistence.ts
    - frontend/src/hooks/useDraftPersistence.test.tsx
    - frontend/src/components/workflows/BuilderSaveRegion.tsx
    - frontend/src/components/workflows/BuilderSaveRegion.test.tsx

key-decisions:
  - "The `enabled` guard sits AFTER `holdRef.current = holdReason` and AFTER the `haltedRef` check, but BEFORE `heldPendingRef.current = false` and before `performWrite()`. All four orderings are load-bearing and all four are commented: the mirror feeds the timer and `saveNow` at FIRE time on the flag-ON surface, and clearing the pending flag behind the guard would lose work a later flag-on session should still find."
  - "`saveNow`, `overwrite` and `reload` stay UNGATED, and the comment says so as a decision rather than leaving it as an omission. D-186-03 keeps the explicit save working flag-off; D-186-08 requires both conflict exits on any surface. Automatic writes obey the flag, chosen ones obey the person."
  - "WR-04 was closed with an HONEST SENTENCE, not a disabled button. A greyed control with no stated reason is the R12 failure (`PublishGauntlet.blockedReason`), and it would have changed the resting flag-off header markup that `header.test.tsx:305` pins byte for byte."
  - "The hold was NOT dropped on the flag-off surface (the superficially purest D-181-01 reading). The stage-5 token guard shipped by 186-02 is not flag-gated, so a flag-off write landing mid-gauntlet costs a real golden run and a real provider bill — removing the hold would restore client-side identity by making the SERVER refuse those writes instead."
  - "A 404 does NOT auto-recreate the draft. Missing and not-owned answer identically (T-103-01-01, the existence-leak defence), so the client cannot classify the refusal; minting a new row on a refusal it cannot read is worse than stopping. The loop stops, the draft stays dirty, every leave guard fires."
  - "A 404 halts into `{kind:\"error\"}`, never `{kind:\"conflict\"}`. Reload would find nothing and Overwrite would PATCH a row that is not there — the banner would offer two dead affordances. `grep -c 'kind: \"conflict\"'` is unchanged at 3, which is the measurement of that."
  - "`reload()`'s row-gone branch adopts `DRAFT_GONE_SENTENCE` too, so one situation reads one way whichever path found it. Its `catch` deliberately keeps `SAVE_FAILED_SENTENCE`: a failed REQUEST is a different thing from a row that is not there."

# Metrics
metrics:
  duration: ~45 min
  completed: 2026-08-01
  tasks: 3
  commits: 4
  files-modified: 4
  migrations: 0
  packages-added: 0
---

# Phase 186 Plan 13: The Flag-Off Write Leak, and the Two Findings It Drags With It Summary

Closes GAP-3 / WR-03 — the hold-release effect now reads `enabled`, so a session running
with `visual_workflow_canvas` OFF issues zero automatic writes; plus WR-04 (the publish
hold's sentence is now true on the surface where the flush will not happen, and it reaches
the DOM there) and WR-05 (a 404 halts the loop instead of drawing doomed PATCHes forever).

## What Was Built

### Task 1 — F20, observed RED (`36ce9806` test / `c572b3f9` fix)

Five tests in one new describe placed immediately after F11, plus an optional `enabled` on
the harness so the flag is **mounted** rather than flipped after a pass of every effect with
it on.

| Test | Property |
|---|---|
| F20a | flag off: edit → publish → release issues ZERO network calls, and the draft stays dirty |
| F20a (create variant) | the same, mounted `{draftId: null, token: null}` — the claim is zero network calls, not zero PATCHes |
| F20b | a Save press *while held* (the other `heldPendingRef` arming path) still produces nothing automatic on release |
| F20c | the contrast control — flag ON, identical drive, still exactly one write carrying both edits |
| F20d | the hold READING is still reachable flag-off: `saveNow()` resolves false and the state is `held` |

The describe's docblock records the reachability chain, because a reader has to know this
was not theoretical: `renderPublish` — and so `setPublishInFlight`, the sole input to the
publish half of `holdReason` — is mounted unconditionally at `WorkflowBuilderPage.tsx:1700-1702`
because Publish is a pre-186 door, and `BuilderSaveRegion`'s Save button is unconditional
too. Only the quiet status LINE was ever behind the flag.

The fix is one line and three comments:

```ts
    if (haltedRef.current) return
    if (!enabled) return
    if (!heldPendingRef.current && !store.getState().dirty) return
```

with `enabled` added to the dependency array (`[holdReason, enabled, store, performWrite]`).

### Task 2 — the hold sentence, truthful and always rendered (`41608375`)

`HOLD_PUBLISHING_MANUAL` was added beside `HOLD_PUBLISHING`, and `holdReason` now selects
between them on `enabled` — the same input Task 1 made decide whether the flush happens, so
the sentence and the loop cannot disagree. The `validationCause === "unreadable"` branch is
untouched: `HOLD_UNREADABLE` promises nothing about a future write, so it was already honest
on both surfaces.

In `BuilderSaveRegion`, the `held` branch moved **ahead** of the `autosaveEnabled` gate.
`Saving…` and `Saved · just now` stay behind it — they are autosave narrating itself, and
with the flag off that loop genuinely is not running. Exactly one
`data-testid="builder-autosave-status"` span, unchanged.

### Task 3 — a 404 is terminal (`a24ffec6`)

`DRAFT_GONE_SENTENCE`, a `WorkflowNotFoundError` branch in `refusalOf`, and a module-level
`isTerminalRefusal(err)` used in `performWrite`'s catch beside the existing conflict halt.
`reload()`'s row-gone branch adopts the same sentence.

## The two hold sentences, verbatim

```
HOLD_PUBLISHING         "Publishing — changes will save when it finishes"
HOLD_PUBLISHING_MANUAL  "Publishing — not saved; press Save draft again when it finishes"
```

One promises the flush the loop will perform; the other instructs, because on that surface
there is no flush to promise. `HOLD_PUBLISHING`'s docblock now carries a `⚠` cross-reference
so a reader who lands on it cannot render it flag-off by accident.

## The terminal sentence, verbatim

```
DRAFT_GONE_SENTENCE  "Not saved — this draft no longer exists, so we've stopped trying.
                      Copy anything you still need before you leave this page."
```

Three things and nothing else: the draft is gone, this client has stopped, and what can
still be done about the work on screen. Deliberately **not** `SAVE_FAILED_SENTENCE`, which
describes a situation a retry fixes and therefore invites one.

## The F20 RED output, verbatim

Run with `useDraftPersistence.ts` unmodified (`git diff --stat` on the hook confirmed empty
first):

```
     × F20a — flag off: edit, publish, release ⇒ ZERO network calls 6ms
     × F20a — the same claim on a session with no draft row yet: no CREATE either 2ms
     × F20b — flag off: Save pressed WHILE held, then release ⇒ still nothing automatic 2ms

 FAIL … > F20a — flag off: edit, publish, release ⇒ ZERO network calls
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
Number of calls: 1

 FAIL … > F20a — the same claim on a session with no draft row yet: no CREATE either
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
Number of calls: 1

 FAIL … > F20b — flag off: Save pressed WHILE held, then release ⇒ still nothing automatic
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
Number of calls: 1

 Test Files  1 failed (1)
      Tests  3 failed | 35 passed (38)
```

The first failure's recorded call carries the full 3-phase definition and `TOKEN_0` — an
unrequested PATCH, in a session where the person had switched the whole feature off. F20c
and F20d were green in RED, exactly as the plan predicted: the flag-ON flush and the hold
reading are both pre-existing correct behaviour, and this plan must not disturb either.

## Falsification of Task 2's load-bearing change

The `held`-before-the-gate ordering was reverted **in place** and the two suites re-run:

```
     × `autosaveEnabled: false` STILL renders the hold sentence — a press always states an outcome 6ms
     × a hold renders through ONE span, on both surfaces 6ms
      Tests  2 failed | 33 passed (35)
```

Exactly two tests red, both written for that clause, and
`WorkflowBuilderPage.header.test.tsx` stays green either way — which is itself the evidence
that the resting flag-off markup is untouched by the reordering. Restored immediately.

## D-181-01 spot-check — every `performWrite()` call site and its gate

Enumerated by source read, as the plan's verification block requires (`grep -n
"performWrite()"` → 4 code sites, plus one docblock mention at `:686`):

| Line | Call site | Kind | Gate |
|---|---|---|---|
| `:653` | the debounce timer callback | AUTOMATIC | the effect returns on `if (!enabled \|\| definition === null)`; `enabled` is in its dependency array |
| `:703` | the hold-release effect | AUTOMATIC | `if (!enabled) return` — **added by this plan**; `enabled` is in its dependency array |
| `:720` | `saveNow()` | user-invoked | ungated by design (D-186-03 — the explicit Save button works on every surface) |
| `:804` | `overwrite()` | user-invoked | ungated by design (D-186-08 — both conflict exits must exist on any surface) |

`reload()` does not call `performWrite` at all. **Both automatic sites are `enabled`-gated;
both ungated sites require a press.** No automatic write path remains that can cross the
revert switch.

## Test counts

| Measurement | Before this plan | After |
|---|---|---|
| `useDraftPersistence.test.tsx` | **33** | **40** (+7: 5 F20 + F20e + the 404 halt) |
| `BuilderSaveRegion.test.tsx` | **5** | **8** (+3) |
| `WorkflowBuilderPage.{canvas,session,header}.test.tsx` | 134 | **134** (unchanged — nothing moved out) |
| Header suite alone | 27 | **27** |
| Six-file consumer run (region + 3 pages + canvas-editing + builderStore) | — | **251 passed / 251** |
| Full frontend suite — total collected | **3580** | **3590** (+10 = 7 + 3) |
| Full frontend suite — failures | 41 (wave 7) | **40**, all inside the SEED-056 band |
| `tsc -b` errors | 33 | **33**, none naming a touched file |
| `vite build` | — | exit **0** |
| `git diff --stat -- frontend/package.json frontend/package-lock.json` | — | **empty** |

Per the wave 6-7 lesson, the full suite was **not** used as a single-number gate. The gate
was the six-file isolated consumer run (251/251), the per-file counts, and the
non-decreasing total.

## Deferred Issues — the SEED-056 band, unchanged

**Out of scope; not fixed (executor scope boundary), and none of it is this plan's.** 40
failures across 11 files, the same set 186-09 recorded in `deferred-items.md`:
`PublishGauntlet.test.tsx` (17), `streamsProvider*` (13), `IngestionPage` (4),
`WorkflowCanvas` axe (2), `MessageItem`, `Plan04.frontend`, `useMessages`, `model-info`.

One failure touches a file this plan's changes reach —
`WorkflowBuilderPage.session.test.tsx` (1) — and it **passes in isolation**: the six-file
consumer run reported 251/251 with that suite included, and the three page suites reported
134/134. It is the same parallel-load flake both wave 6 and wave 7 recorded for that file.
`PublishGauntlet.test.tsx` took **124 s** in the full run against ~milliseconds in
isolation, which is the load signature itself.

No fix attempted. No new entry added to `deferred-items.md` — same band, same re-open
trigger.

## Deviations from Plan

### Measurement — one acceptance grep is not satisfiable as written, and code was NOT reworded to make it so

**1. [Rule 3 — measurement correction] `grep -n "if (!enabled) return"` returns ONE code line, not two**
- **Found during:** Task 1, taking the acceptance greps.
- **Issue:** the criterion says the grep should return two lines, "the shipped one in the
  debounce effect and the new one in the hold-release effect". The shipped debounce guard is
  `if (!enabled || definition === null) return` (`:536` at the time), which the literal does
  not match. The criterion was written from a paraphrase of the source.
- **Resolution:** the debounce guard was **left exactly as it shipped**. Rewording working
  code to satisfy a string search is the failure this phase has now hit four times. The
  property was measured with an honest command instead:
  `grep -v '^\s*\*' … | grep -n "!enabled"` → **two code sites**, `:298` (the debounce
  effect) and `:329` (the hold release), comment lines filtered out.
- **Commit:** `c572b3f9`

**2. [Rule 3 — measurement correction] `grep -c "HOLD_PUBLISHING_MANUAL"` initially returned 2, not "at least 3"**
- **Found during:** Task 2.
- **Issue:** `grep -c` counts LINES. The declaration wraps onto two lines, so the constant's
  own name appeared on one declaration line and one memo-branch line — the criterion assumed
  a docblock self-reference that a constant's own docblock has no reason to carry.
- **Resolution:** rather than pad the constant's docblock, a genuinely useful cross-reference
  was added to **`HOLD_PUBLISHING`'s** docblock — a reader landing on the promise-form must
  know the flag-off spelling exists, or they will render it on the wrong surface. That makes
  the count 3 as a side effect, not as its purpose. Verified as occurrences too
  (`grep -o … | wc -l` → 3), with code-only sites at `:20` (declaration) and `:184` (the memo
  branch).
- **Commit:** `41608375`

### Structural, not a rule

**3. One extra test beyond the plan's list — F20e**
- Task 2 asked for "one hook-level test" comparing the constants under both flag values. It
  was placed **inside the F20 describe** rather than in its own, because it is the same
  claim as F20a/F20b seen from the surface's side: the sentence is only meaningful next to
  the tests that prove the flush does not happen. It asserts the inequality first, the way
  F8's published branch does, so two constants holding the same string cannot pass it.

**4. The F10 reload-row-gone test gained an assertion rather than being left alone**
- The plan only required changing `reload()`'s branch. The shipped test asserted
  `kind === "error"` and would have passed either way, so it was strengthened to assert
  `DRAFT_GONE_SENTENCE` — otherwise the "one situation reads one way whichever path found
  it" claim is stated in a comment and measured nowhere.

**5. The docblock's "load-bearing three ways" became "four ways"**
- Written as three, then four bullets were actually needed (mirror / halt / pending-clear /
  the write itself). Corrected in the same task rather than left as prose that miscounts its
  own list.

## Threat Model Verification

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-186-13-01 (EoP — past the revert switch) | **mitigated** | `if (!enabled) return` precedes every automatic `performWrite`, with `enabled` in the dependency array; the four-site enumeration above shows the two remaining ungated sites both require a press. Falsified RED first by F20a/F20b, which assert on `updateWorkflowDraft` **and** `createWorkflowDraft` and read `1` where `0` is expected. |
| T-186-13-02 (Repudiation — a promise the loop will not keep) | **mitigated** | `holdReason` selects the sentence on `enabled`, the same input that decides the flush. F20e asserts both constants under both flag values and asserts they are different strings. |
| T-186-13-03 (Repudiation — the silent `held`) | **mitigated** | The `held` branch is evaluated before the `autosaveEnabled` gate. `BuilderSaveRegion.test.tsx` asserts the sentence in the DOM with `autosaveEnabled: false` and asserts exactly one span carries it; falsified by reverting the ordering (2 reds, both that clause's). `header.test.tsx` 27/27 green — the resting flag-off markup is byte-unchanged. |
| T-186-13-04 (DoS — the 404 retry path) | **mitigated** | `isTerminalRefusal` sets `haltedRef` in `performWrite`'s catch. Three post-404 edits over `AUTOSAVE_DEBOUNCE_MS * 3` each issue zero additional `updateWorkflowDraft` calls, `markSaved` was never called, and `dirty` is still true. |
| T-186-13-05 (Info disclosure — the 404-collapse) | **accepted** | Preserved unchanged. The client still cannot distinguish "deleted elsewhere" from "not yours", which is exactly why the terminal sentence stops rather than recreating the row — recorded as a locked decision and in `isTerminalRefusal`'s docblock. |
| T-186-13-SC (Tampering — npm installs) | **accepted / N/A** | `git diff --stat -- frontend/package.json frontend/package-lock.json` is empty. Nothing installed; the Package Legitimacy Gate does not apply. |

## No new threat surface

No network endpoint, auth path, file access pattern or schema was touched. Zero backend
files, zero migrations (head stays **114**), zero packages. The change is one guard, one
constant pair, one predicate, one reordered ternary and their comments — inside one frontend
hook and one frontend component. The net effect on the wire is strictly **fewer** requests.

## Known Stubs

None. Every branch added is reachable and exercised by a test in this plan.

## Requirements

- **CONCUR-01** — the write loop no longer issues requests nobody asked for, on a surface
  where the feature is switched off, and no longer issues doomed ones against a row that is
  gone.
- **CONCUR-02** — the surface never promises a save the loop will not perform, and never
  stays silent about one it refused: the hold reading now reaches the DOM on both surfaces.

Neither is marked complete here — `/gsd:verify-work 186` re-verifies both now that all three
gap-report blockers (GAP-1 / 186-09, GAP-2 / 186-12, GAP-3 / this plan) are closed.

## Self-Check: PASSED

| Claim | Result |
|---|---|
| `frontend/src/hooks/useDraftPersistence.ts` exists | FOUND (818 lines) |
| `frontend/src/hooks/useDraftPersistence.test.tsx` exists | FOUND (40 tests, `F20` present) |
| `frontend/src/components/workflows/BuilderSaveRegion.tsx` exists | FOUND (1 `builder-autosave-status` span) |
| `frontend/src/components/workflows/BuilderSaveRegion.test.tsx` exists | FOUND (8 tests) |
| `.planning/phases/186-concurrency-autosave/186-13-SUMMARY.md` exists | FOUND |
| commit `36ce9806` (F20 RED test) | FOUND |
| commit `c572b3f9` (the `enabled` gate) | FOUND |
| commit `41608375` (the hold sentence, both surfaces) | FOUND |
| commit `a24ffec6` (the terminal 404) | FOUND |
| key link — `enabled` → the hold-release effect via an early return | FOUND: `if (!enabled) return` at `:700`, above the `heldPendingRef` clear and the `performWrite()` at `:703` |
| key link — `state.kind === "held"` → the quiet line, before the flag gate | FOUND: `BuilderSaveRegion.tsx` `quietLine` opens on `state.kind === "held"`, `!autosaveEnabled` is the second test |
| exports named in the artifact contract | FOUND: `HOLD_PUBLISHING`, `HOLD_PUBLISHING_MANUAL`, `HOLD_UNREADABLE`, `SAVE_FAILED_SENTENCE`, `DRAFT_GONE_SENTENCE`, `PUBLISHED_CONFLICT_MESSAGE` |
| no file deletions in any of the four commits | CONFIRMED (`git diff --diff-filter=D --name-only HEAD~4 HEAD` empty) |

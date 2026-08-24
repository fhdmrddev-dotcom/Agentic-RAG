---
phase: 186-concurrency-autosave
plan: 12
subsystem: workflow-builder
tags: [gap-closure, single-flight, concurrency, red-first, WR-01, GAP-2, one-home-per-concern]

# Dependency graph
requires:
  - phase: 186-06
    provides: "`useDraftPersistence` — `performWrite`, the `for(;;)` drain, `inFlightRef` / `pendingRef`, and the two conflict exits this plan guards"
  - phase: 186-07
    provides: "`BuilderSaveRegion` — the conflict banner and its two controls, and the single mount point on `WorkflowBuilderPage`"
  - phase: 186-09
    provides: "the payload-identity `superseded` test inside the drain; this plan's writer-side guard sits ABOVE it and leaves it byte-unchanged"
provides:
  - "single flight as a property of the WRITER — `if (inFlightRef.current)` appears exactly once, inside `performWrite`, and no caller re-implements it"
  - "a re-entrancy guard on both conflict exits that returns BEFORE mutating any ref (in `overwrite` it sits above the `tokenRef` assignment)"
  - "a `resolving` boolean on `DraftPersistence`, threaded to the banner so its two controls disable and the banner stays mounted for the whole resolution"
  - "F19a-d — the peak-concurrency property over the whole caller SET, with the RED numbers recorded in the test file's own docblock"
  - "`BuilderSaveRegion.test.tsx` — the component's first co-located suite (net-new, nothing moved into it)"
affects:
  - "186-13 (WR-03/04/05) — same hook and same component; the hold-release effect it gates no longer carries its own `inFlightRef` check, and this plan's `autosaveEnabled: false` test explicitly pins the CURRENT `held` behaviour that 186-13 will change"
  - "`186-VALIDATION.md` rows 1 and 2 (two tabs / stale tab) — both exits are now safe to double-click, which is what an operator actually does when a banner appears mid-typing"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "An invariant each caller must remember is not an invariant — relocate the guard into the one function every caller passes through (the 'one home per concern' red line, applied to a write loop)"
    - "A re-entrancy guard placed ABOVE the state it protects, not below it: guarding only the request would swap a duplicate PATCH for a corrupted token"
    - "A table-driven property test over the whole entry-point SET, contrasted in its own docblock with the shipped single-caller patch test it supersedes"
    - "A `resolving` flag kept OUT of the state union — the union describes the write loop's outcome, and a resolution under way is not an outcome"
    - "A net-new co-located suite for a component whose only assertions lived in a page suite; the page keeps every assertion it had (the Phase 177 count-the-tests lesson)"

key-files:
  created:
    - frontend/src/components/workflows/BuilderSaveRegion.test.tsx
  modified:
    - frontend/src/hooks/useDraftPersistence.ts
    - frontend/src/hooks/useDraftPersistence.test.tsx
    - frontend/src/components/workflows/BuilderSaveRegion.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx

key-decisions:
  - "The exit re-entrancy guard is a SEPARATE mechanism from the writer's single flight, and it is deliberately not folded into it. Single flight answers 'at most one request'; the exit guard answers 'at most one resolution' — a second `reload` would call `setDrafted` twice, replacing the document and clearing the undo history once more than the person asked for, and no amount of request-level serialization prevents that."
  - "In `overwrite` the guard sits ABOVE `tokenRef.current = conflictTokenRef.current`. Relying on `performWrite`'s guard alone would still let the second click clobber the token before the write was refused — a half-fix that trades a duplicate request for a corrupted one. F19d is the test that would have caught exactly that half-fix (it fails on a late-losing racing write, not on the request count)."
  - "`resolving` is a plain `useState` boolean on the hook's return, NOT a new `PersistState` member. `overwrite` is legitimately `saving` while it resolves and `reload` is not writing at all, so a sixth union member would have had to lie about one of them."
  - "The banner's render condition needed `|| resolving` for the disable to mean anything. Falsified in place: reverting that clause reds exactly one test (`resolving KEEPS the banner mounted once the state has moved to saving`) and leaves the other four green."
  - "F19b counts the PATCHes as a DELTA from the conflict point rather than as an absolute. Reaching a conflict costs one refused write by construction, and an absolute count would have baked that accident into the assertion."

# Metrics
metrics:
  duration: ~40 min
  completed: 2026-08-01
  tasks: 3
  commits: 3
  files-modified: 4
  files-created: 1
  migrations: 0
  packages-added: 0
---

# Phase 186 Plan 12: Single Flight Is a Property of the Writer Summary

Closes GAP-2 / WR-01 — the `inFlightRef` check moved out of three callers and into
`performWrite`, and the two conflict exits gained a re-entrancy guard, so a double-click on
Overwrite is one PATCH instead of two same-token PATCHes whose loser was refused
`stale_token` and re-raised the banner for a conflict that never happened.

## What Was Built

### Task 1 — F19, observed RED (`7a2ea657`)

Seven tests in one new describe placed immediately after F10. Four of them are F19a, one per
update entry point, generated from a `ROWS` table so a failure names WHICH caller broke:

| Row | Arrangement | Drive |
|---|---|---|
| the debounce timer | shared: one autosave write held open by a `deferred` | `h.edit()` + advance |
| `saveNow()` | shared | `await saveNow()` |
| the hold release | shared | `publishInFlight` true → false |
| `overwrite()` | its own: refuse write #1 → conflict, take the exit once, hold THAT write open | a second `overwrite()` |

The `overwrite` row needs its own arrangement for a structural reason, stated in a comment in
the file: `overwrite` is only reachable from a `conflict`, and a conflict is only reachable
from a refused write.

F9's `outstanding` / `peak` / `tracked` idiom was reused verbatim rather than reinvented —
incremented at CALL time, decremented in a `.finally`, so `peak` is the true simultaneous
maximum rather than a request count.

The describe's docblock states the difference this plan exists to make: **F9 is a patch test
and F19 is a property test.** F9 pins "at most one PATCH outstanding" for exactly ONE caller
— the debounce timer — and it passes because that caller happens to carry its own check. It
says nothing about the other callers, which is how `overwrite` and `reload` shipped without
one.

### Task 2 — the fix (`f288888e`)

In `performWrite`, immediately after `if (haltedRef.current) return false` and above
`inFlightRef.current = true`:

```ts
if (inFlightRef.current) {
  pendingRef.current = true
  return false
}
```

The three caller-side copies were deleted (debounce timer, hold-release effect, `saveNow`),
each replaced by a comment naming where the rule now lives. Behaviour is preserved by
construction — every one of those call sites simply called `performWrite()` next, and the
relocated check returns `false` with `pendingRef` armed exactly as they did. **F9's own
assertions are the proof the relocation is behaviour-preserving, and they stayed green
throughout.**

186-09's `superseded` condition and the whole drain body are byte-unchanged; the new guard
sits above the drain, not inside it.

Both exits gained `if (inFlightRef.current || reloadingRef.current) return`, a new
`reloadingRef`, and a `try { … } finally { reloadingRef.current = false; setResolving(false) }`.
In `overwrite` the guard is above the `tokenRef` assignment; in `reload` it is above the
`listDraftWorkflows` call (a read that is going to be thrown away is still a request).

`DraftPersistence` gained a documented `resolving: boolean`, and the inline
`WRITES ARE SERIALIZED, NEVER CANCELLED, AND NEVER CONCURRENT` paragraph was restated as a
writer property with a `⚠` note naming WR-01 and the double-click that reached it.

### Task 3 — the banner survives its own resolution (`98588c24`)

`BuilderSaveRegion` gained a `resolving` prop, `disabled={resolving}` on both conflict
controls with the Save-draft button's shipped `disabled:cursor-not-allowed
disabled:opacity-60`, and a render condition of `state.kind === "conflict" || resolving`.

The second clause is the load-bearing half: `overwrite()` sets `{kind:"saving"}`
synchronously, so a banner gated on `conflict` alone unmounts on the first click and the
disabled state is never on screen. Disabling a control that has already vanished protects
nothing.

`BuilderSaveRegion.test.tsx` is net-new (5 tests). Nothing was moved into it — the page
suites keep every `builder-conflict-*` assertion they had.

## The RED output, verbatim

Run with `useDraftPersistence.ts` unmodified (`git diff --stat` on the hook was confirmed
empty before committing):

```
 ❯ src/hooks/useDraftPersistence.test.tsx (33 tests | 4 failed) 93ms
     × F19a — overwrite() adds no concurrent request while a write is outstanding 8ms
     × F19b — a double-click on Overwrite is ONE PATCH, so no stale_token conflict is manufactured 3ms
     × F19c — a double-click on Reload is ONE read and ONE setDrafted 2ms
     × F19d — an exit taken while a write is outstanding adopts no token 3ms

 FAIL … > F19a — overwrite() adds no concurrent request while a write is outstanding
AssertionError: expected 2 to be 1 // Object.is equality
- Expected
+ Received
- 1
+ 2

 FAIL … > F19b — a double-click on Overwrite is ONE PATCH, so no stale_token conflict is manufactured
AssertionError: expected 'conflict' to be 'saving' // Object.is equality
Expected: "saving"
Received: "conflict"

 FAIL … > F19c — a double-click on Reload is ONE read and ONE setDrafted
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times

 FAIL … > F19d — an exit taken while a write is outstanding adopts no token
AssertionError: expected 'T-STALE-RACE' to be 'T-FRESH' // Object.is equality
Expected: "T-FRESH"
Received: "T-STALE-RACE"

 Test Files  1 failed (1)
      Tests  4 failed | 29 passed (33)
```

RED per row, as the plan predicted:

| Row / test | RED | GREEN |
|---|---|---|
| F19a — the debounce timer | peak **1** (already guarded) | 1 |
| F19a — `saveNow()` | peak **1** (already guarded) | 1 |
| F19a — the hold release | peak **1** (already guarded) | 1 |
| F19a — `overwrite()` | peak **2** | 1 |
| F19b | the surface reads **`conflict`** while the resolution is still in flight — the racing PATCH was refused `stale_token` and the banner came back for a conflict that never happened | `saving`, then `saved`, delta 1 PATCH |
| F19c | `listDraftWorkflows` called **2** times | 1, and one `setDrafted` |
| F19d | the next request carries **`T-STALE-RACE`** — the token minted by the racing write that settled LAST | `T-FRESH` |

F19b's first failing assertion is the state one, which fires before the call-delta assertion
is reached; the delta is 2 in RED and 1 in GREEN.

**F19d is the test that discriminates a half-fix.** Guarding only the request (leaving the
`tokenRef` assignment above the guard) would still pass F19a/b — one PATCH — and still fail
F19d, because the clobbered token is the damage, not the duplicate request.

### Falsification of Task 3's load-bearing clause

`|| resolving` was removed in place and the suite re-run:

```
     × `resolving` KEEPS the banner mounted once the state has moved to `saving` 7ms
      Tests  1 failed | 4 passed (5)
```

Exactly one test reds, and it is the one written for that clause. Restored immediately.

## Test counts

| Measurement | Before | After |
|---|---|---|
| `useDraftPersistence.test.tsx` | **26 passed / 26** | **33 passed / 33** (+7) |
| `BuilderSaveRegion.test.tsx` | did not exist | **5 passed / 5** (+5, net-new) |
| `WorkflowBuilderPage.{canvas,session,header}.test.tsx` | 134 | **134** (unchanged — nothing moved out) |
| `builderStore.test.ts` | 52 | **52** |
| Full frontend suite — total collected | **3568** (wave 6 figure) | **3580** (+12 = 7 + 5) |
| Full frontend suite — failures | 42 / 43 (unstable set, wave 6) | **41**, all inside the SEED-056 band |
| `tsc -b` errors | 33 | **33**, none naming a touched file |
| `vite build` | — | exit **0** |
| `git diff --stat -- frontend/package.json frontend/package-lock.json` | — | **empty** |

Measured diff for the G-5 hot file, as the plan required:

```
 frontend/src/pages/WorkflowBuilderPage.tsx         |  1 +
```

**One inserted line, zero deleted** — `resolving={persistence.resolving}` at the single
`BuilderSaveRegion` mount. The plan's ceiling was 3.

`BuilderSaveRegion.tsx`: `21 insertions(+), 4 deletions(-)` across both files, of which most
is the prop docblock and the comment explaining the second render clause.

## Deferred Issues — the full-suite failure band, unchanged from wave 6

**Out of scope; not fixed (executor scope boundary), and not this plan's.** 41 failures
across 11 files. The set is the one 186-09 already recorded in `deferred-items.md`:
`PublishGauntlet.test.tsx` (18), `streamsProvider*` (11), `IngestionPage` (4),
`WorkflowCanvas` axe (2), `MessageItem`, `Plan04.frontend`, `useMessages`, `model-info`.

Two failures in the run touched files this plan modifies, and **both pass in isolation**:

- `WorkflowBuilderPage.canvas.test.tsx > an undo NEVER writes to the server` — a
  `waitFor` timeout inside the `PhaseFormPanel` `doMock`/`doUnmock` helper at `:611`.
- `WorkflowBuilderPage.session.test.tsx > pane click — the pending value is in the
  definition and ZERO PATCHes were issued`.

Evidence they are parallel-load flake, not regressions: the four-file verification command
(`BuilderSaveRegion` + the three page suites) was run twice and reported **139 passed / 139**
on the clean run, and `canvas + session + header + builderStore` reported **186 passed / 186**
before Task 3 landed. Both files also appear in wave 6's own unstable-set finding.

No fix attempted, per the scope boundary. No new entry added to `deferred-items.md` — this is
the same SEED-056 band already recorded there by 186-09, with the same re-open trigger.

## Deviations from Plan

### Structural, not a rule

**1. F19b counts PATCHes as a delta rather than an absolute**
- **Found during:** Task 1, writing the arrangement.
- **Issue:** the plan says "asserts `updateWorkflowDraft` was called once". Reaching a
  conflict costs exactly one refused write by construction, so an absolute count of 1 is
  unreachable and a count of 2 would bake that accident into the assertion.
- **Resolution:** `mockedUpdate.mock.calls.length - atConflict === 1`, with the reason in a
  comment. The property the plan asked for is unchanged.
- **Commit:** `7a2ea657`

**2. F19b gained a second, earlier discriminator**
- The call delta alone reds in RED, but the plan's phrase "no `stale_token` conflict is
  manufactured" is a claim about what the SURFACE said, not about a count. An assertion that
  the state is `saving` before anything resolves states that directly — and it is the
  assertion that actually fired first in the RED output.

**3. The exit guards read `if (inFlightRef.current || reloadingRef.current)`**
- The plan's acceptance criterion greps for `if (inFlightRef.current)` returning 1. It does
  (line 423, inside `performWrite`) — the exit guards use the two-clause form, so the grep is
  honest rather than satisfied by wording. **No code was reworded to satisfy a grep**, per
  wave 6's lesson; the two-clause form is what the guard genuinely needs.

**4. `it(` count measured, not assumed**
- `grep -c "  it("` on `BuilderSaveRegion.test.tsx` → **5**, matching the plan's "at least
  five" and the runner's own 5-passed figure. The count was taken from the RUNNER, with the
  grep as corroboration.

### Measurement notes

- `grep -v '^\s*\*' … | grep -c "if (inFlightRef.current)"` → **1**. Verified the occurrence
  is at `:423` inside `performWrite`, above `inFlightRef.current = true` at `:428`.
- `grep -c "disabled={resolving}"` on `BuilderSaveRegion.tsx` → **2**.
- `grep -n "reloadingRef"` → declared once at `:374`, read in `reload` (`:620`) and
  `overwrite` (`:668`).
- `grep -n "resolving"` → on the `DraftPersistence` interface (`:245`) and in the returned
  object (`:681`).
- The full frontend suite was **not** treated as a single-number gate (wave 6 lesson 1). The
  gate was the per-file isolated runs plus the non-decreasing total.

## Threat Model Verification

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-186-12-01 (Spoofing — a false conflict) | **mitigated** | Two concurrent same-token PATCHes are unreachable: the guard is inside the writer, so no caller can route around it. Falsified RED first by F19a's `overwrite` row (peak 2 → 1) and F19b (the surface read `conflict` mid-resolution → now reads `saving`). |
| T-186-12-02 (Tampering — an exit's ref resets vs. an outstanding write) | **mitigated** | Both exits return before touching `tokenRef` / `haltedRef` / `pendingRef` / `conflictTokenRef`. F19c pins one `listDraftWorkflows` and one `setDrafted`; F19d pins that a late-settling racing write cannot leave `tokenRef` holding the loser (`T-STALE-RACE` → `T-FRESH`). |
| T-186-12-03 (EoP — the exits are user-only) | **accepted** | Neither exit gained an `enabled` gate; both stay user-initiated, per D-186-08. The re-entrancy guard only ever REMOVES a write, so no automatic write path was created and D-181-01 is untouched by this plan. |
| T-186-12-04 (Repudiation — the disabled banner controls) | **mitigated** | The banner stays mounted through the resolution and both controls carry `disabled` plus the shipped inert styling. `BuilderSaveRegion.test.tsx` asserts the mount under `{kind:"saving"}` and the disabled attribute on both; the mount assertion was falsified by reverting `|| resolving`. |
| T-186-12-SC (Tampering — npm installs) | **accepted / N/A** | `git diff --stat -- frontend/package.json frontend/package-lock.json` is empty. Nothing installed; the Package Legitimacy Gate does not apply. |

## No new threat surface

No network endpoint, auth path, file access pattern or schema was touched. Zero backend
files, zero migrations (head stays **114**), zero packages. The change is one relocated guard,
two guarded exits, one boolean, one prop and one JSX clause.

## Requirements

- **CONCUR-01** — the conflict-resolution path no longer issues a second concurrent PATCH,
  so the write loop cannot mint a refusal against a row that did not move.
- **CONCUR-02** — the person is never told their draft moved when it did not, and the
  controls that resolve a real move read inert while they are working.

Neither is independently re-verified here — that is `/gsd:verify-work 186`'s job after 186-13
lands on the same two files.

## Self-Check: PASSED

| Claim | Result |
|---|---|
| `frontend/src/hooks/useDraftPersistence.ts` exists | FOUND (682 lines) |
| `frontend/src/hooks/useDraftPersistence.test.tsx` exists | FOUND (33 tests, `F19` present) |
| `frontend/src/components/workflows/BuilderSaveRegion.tsx` exists | FOUND (`disabled={resolving}` ×2) |
| `frontend/src/components/workflows/BuilderSaveRegion.test.tsx` exists | FOUND (net-new, 5 tests) |
| `frontend/src/pages/WorkflowBuilderPage.tsx` exists | FOUND (1 inserted line) |
| `.planning/phases/186-concurrency-autosave/186-12-SUMMARY.md` exists | FOUND |
| commit `7a2ea657` (RED test) | FOUND |
| commit `f288888e` (the fix) | FOUND |
| commit `98588c24` (the banner + net-new suite) | FOUND |
| key link — `overwrite`/`reload` → `performWrite` via `inFlightRef.current` | FOUND: guard `:423` in `performWrite`; exit guards `:620`, `:668` |
| key link — `resolving` → the banner's buttons via a page prop | FOUND: `:245`/`:681` in the hook, `resolving={persistence.resolving}` on the page, `disabled={resolving}` ×2 in the component |
| no file deletions in any of the three commits | CONFIRMED (`git diff --diff-filter=D --name-only HEAD~3 HEAD` empty) |

---
phase: 186-concurrency-autosave
reviewed: 2026-08-01T20:45:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - frontend/src/hooks/useDraftPersistence.ts
  - frontend/src/hooks/useDraftPersistence.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 186: Code Review Report (gap-closure round — plans 186-18 / 186-19)

**Reviewed:** 2026-08-01T20:45:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

> Base commit `451b8efc`. Exactly four commits touch the frontend in this range
> (`64042c12` / `bb693e10` — 186-18, `83a721fb` / `a27e3e39` — 186-19). Prior reviews:
> `186-REVIEW-waves-1-5.md`, `186-REVIEW-waves-6-8.md`, `186-REVIEW-waves-9-10.md` (whose
> WR-14…WR-18 were deferred by the operator and are **not re-raised** here). New ids continue
> the shared sequence from **WR-19** and **IN-16**. No structural pre-pass was provided.

## Summary

This pass reviewed the three gap-closure fixes (CR-03, WR-12, WR-13) against base `451b8efc`.
All three land, and the two suites in scope pass in full (143/143; the flag-off header pin
suite `WorkflowBuilderPage.header.test.tsx` also re-run — 27/27 — confirming the CR-03
docblock's "byte-for-byte pins pass unchanged" claim rather than accepting it).

**CR-03 is genuinely closed.** The `SAVING_PUBLISH_WAIT` branch now sits above the
`!canvasEnabled || builderPhase !== "drafted"` gate, the memo's deps already carried
`persistState`, and the enforcement chain is real end to end: `WorkflowsPage.tsx:443` forwards
`blockedReason` into `PublishGauntlet`, whose trigger takes `disabled={blocked}`
(`PublishGauntlet.tsx:921`) and whose inner Publish takes `!blocked` in `canPublish` — on both
header branches, since `actionGroup` mounts once and is rendered by whichever header shape is
in play. No verdict branch regressed: with the flag on, `saving` was already ranked first, so
the relative order of the empty/degraded/verdict branches is byte-identical; with the flag off
every verdict branch still returns `null`. The residual worry (`saving` reachable while
`builderPhase !== "drafted"`) is not reachable — `performWrite` checks `builderPhase ===
"drafted"` before it ever sets `{kind:"saving"}`, and the store has no path out of `drafted`
within a mounted session. The RED-first test (`WorkflowBuilderPage.canvas.test.tsx`, the
flag-OFF chosen-save row) asserts its own premise by call count before asserting the refusal,
which is the right shape.

**WR-13 is closed, and closed by a better construction than the one the waves-9-10 review
sketched.** Clearing `heldPendingRef` beside `haltedRef` in `overwrite()` (the `reload()`
symmetry) preserves D-186-03's "a Save press on a clean store still flushes on the enabled
release" semantics, which the review's own every-exit-agrees-with-`dirty` sketch would have
destroyed. I probed the two-doors derivation for a third door and found none: `haltedRef` is
cleared at exactly `reload()`'s success path and `overwrite()`, both now disarm the flag in the
same breath, `reload()`'s gone-row and catch branches leave the halt (and therefore the
unreadability of the flag) in place, and unmount discards the refs. The only path where the
cleared arming is not immediately re-written by `performWrite` is a `builderPhase !==
"drafted"` drain-break, which cannot coexist with a mounted conflict banner. F23 counts the
manufactured PATCH over the whole drive with a positive control.

**WR-12 is closed for the state it was reported in and open for a sibling state.** The
`{kind:"held", sentence: HOLD_ENDED_UNSAVED}` upgrade is correctly functional (a `conflict`
arriving during the hold survives — the review's own fix sketch would have erased it, so the
shipped form is stronger than what was asked for), writes nothing, files no receipt, and keeps
`dirty` true. But the predicate `s.kind === "idle"` under-matches the docblock's own claim
("re-states … when — and only when — the store is still dirty"): a `saved`-then-edited author
lands in exactly the silence WR-12 was raised about. WR-19 below. The new sentence also
introduces a fresh instance of an older staleness: nothing refreshes a `held` reading when the
NEXT hold begins, so `HOLD_ENDED_UNSAVED` now sits on screen through an entire second gauntlet
making a false claim. WR-20 below.

### Prior-finding verification (re-derived against source at HEAD, not accepted from SUMMARYs)

| Id | Claim | Verdict |
|----|-------|---------|
| **CR-03** | 186-16's publish guard is dead code flag-off | **CLOSED.** `WorkflowBuilderPage.tsx:1094` evaluates `persistState.kind === "saving"` above the flag gate at `:1095`; consumer chain verified to the `disabled` attribute; flag-off resting header re-measured green (27/27). |
| **WR-12** | flag-off hold release resolves to silence | **CLOSED for `idle`, incomplete for `saved`** — see WR-19. The functional guard is an improvement over the review's sketch (protects `conflict`). |
| **WR-13** | `heldPendingRef` survives a halt and flushes a no-op PATCH on a later clean hold | **CLOSED.** `overwrite()` clears the arming beside the halt (`useDraftPersistence.ts:1072`); two-doors derivation independently verified; F23 counts it. |
| **WR-14…WR-18** | (waves 9-10) | Deferred by operator (`deferred-items.md` / gap-closure plan). Not re-raised. IN-16 records one interaction the CR-03 reorder has with deferred WR-15. |

## Warnings

### WR-19: the WR-12 re-statement is gated on `s.kind === "idle"`, so a saved-then-edited author still gets the silence WR-12 was raised about

**File:** `frontend/src/hooks/useDraftPersistence.ts:915`

**Issue:**
The `!enabled` release branch reads the one fact that matters (`unsent =
store.getState().dirty`) and then conditions the sentence on an incidental prior reading:

```ts
if (unsent) {
  setState((s) => (s.kind === "idle" ? { kind: "held", sentence: HOLD_ENDED_UNSAVED } : s))
}
```

Reachable sequence, entirely within shipped affordances, flag OFF:

1. Author presses **Save draft** → confirmed write → `{kind:"saved"}`, `dirty` false.
2. Author edits → `dirty` true; the reading stays `saved` (no timer exists flag-off, and
   nothing else transitions it).
3. A publish begins and ends. At the release: the held→idle resolution is a no-op (`saved` ≠
   `held`), `unsent === true` correctly arms `heldPendingRef`, and the sentence setState is a
   no-op (`saved` ≠ `idle`).

`BuilderSaveRegion` then renders nothing at all: `receiptVisible` is `saved && !dirty` →
false, `quietLine` falls to `!autosaveEnabled → null`, the error span needs `error`. Unsent
work, a surface this loop will never flush, and total silence until the leave guard fires —
the verbatim WR-12 defect, surviving through a different prior state. The inconsistency is the
tell: an author who edited during the publish *without* ever saving (reading `idle`) gets the
sentence; an author who saved first and then edited does not — same situation, different
outcome, decided by a state the situation does not depend on. The docblock at `:806-814`
("when — and only when — the store is still dirty") and F20i both claim the property, but F20i
only drives the `idle` arm, so the suite is green while the claim is false for `saved`.

**Fix:** widen the predicate to the two readings that carry no refusal sentence of their own:

```ts
setState((s) =>
  s.kind === "idle" || s.kind === "saved"
    ? { kind: "held", sentence: HOLD_ENDED_UNSAVED }
    : s,
)
```

Replacing a `saved` reading here is safe and honest: `dirty` is true on this path, so
`receiptVisible` already suppresses the receipt — the reading is invisible dead weight — and a
stale receipt may not outrank a statement about unsent work. `error` stays excluded (its
sentence already begins "Not saved"), `conflict` stays excluded (the GAP-4 rule). Add an F20i
arm: save → edit → hold cycle ⇒ the same `{kind:"held", sentence: HOLD_ENDED_UNSAVED}`.

### WR-20: a `held` reading is never refreshed when the next hold begins, so `HOLD_ENDED_UNSAVED` instructs "press Save draft to save your changes" for the whole of a second gauntlet

**File:** `frontend/src/hooks/useDraftPersistence.ts:889-896` (the early return), new instance
minted by `:915`

**Issue:**
The release effect's transition test returns before touching state on every beat where
`holdReason !== null`:

```ts
const previous = holdRef.current
holdRef.current = holdReason
if (previous === null || holdReason !== null) return
```

So a transition *into* a hold (null → non-null) updates the mirror and nothing else. Before
186-19 the reading at that instant on the flag-off path was `idle` — silent, which claims
nothing. 186-19's sentence changes that: with `{kind:"held", sentence: HOLD_ENDED_UNSAVED}` on
screen (unsent work, flag off), the author launches a **second** publish. For the entire
gauntlet — minutes, per D-186-12 — the header keeps saying *"Not saved — press Save draft to
save your changes"*, which is now false twice over: pressing Save will not save (it takes
`saveNow`'s hold branch), and the honest sentence for this exact situation exists, is locked,
and is already being computed by `holdReason` (`HOLD_PUBLISHING_MANUAL`). A person who follows
the on-screen instruction gets the sentence corrected; a person who trusts it and waits is
being misled mid-gauntlet — on the phase whose stated contract is that the surface never makes
a false statement about system state.

The same early return also carries a pre-existing flag-ON sibling (recorded here because this
diff enlarges the family): a non-null → non-null *sentence change* never renders either. E.g.
state `held(HOLD_PUBLISHING)` from a Save press mid-publish; the publish ends while
`validationCause` is still `"unreadable"` → `holdReason` moves `HOLD_PUBLISHING` →
`HOLD_UNREADABLE` without a null between → the header goes on promising *"Publishing — changes
will save when it finishes"* indefinitely after the gauntlet finished, until the next edit's
timer beat happens to re-read `holdRef`.

**Fix:** refresh an existing `held` reading on any beat that has a hold sentence, functionally
and before the transition return, so every other reading is untouched and no write path
changes:

```ts
const previous = holdRef.current
holdRef.current = holdReason
if (holdReason !== null) {
  // A held reading must carry the CURRENT hold's sentence, not the previous situation's.
  setState((s) =>
    s.kind === "held" && s.sentence !== holdReason ? { kind: "held", sentence: holdReason } : s,
  )
  return
}
if (previous === null) return
```

This covers both the null → non-null case (the new `HOLD_ENDED_UNSAVED` instance) and the
non-null → non-null sentence change, issues no request, and cannot loop (the setState is
conditioned on the sentence actually differing). Add an F20 sibling: `HOLD_ENDED_UNSAVED` on
screen → `publishInFlight` true ⇒ reading becomes `held(HOLD_PUBLISHING_MANUAL)` with zero
writes.

## Info

### IN-16: the CR-03 reorder extends deferred WR-15's blast radius to the flag-off surface

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:1094`

**Issue:** WR-15 (deferred) records that one drain branch can leave `state` at `saving` with no
request outstanding, and that a hung write has no ceiling. Before this fix a stuck `saving`
disabled Publish only on the flag-on surface; after it, the same stuck reading also disables
the flag-off `◆ Publish…` indefinitely. The reachable stuck branch requires `builderPhase` to
leave `"drafted"` mid-drain, which no shipped path does, so this is a widened *consequence* of
a deferred finding, not a new defect.

**Fix:** none required now — note it on WR-15's deferred-items entry so the eventual bounded-
`saving` fix knows it protects both surfaces.

### IN-17: `blockedReason` has no `conflict` branch — Publish stays enabled while the loop is halted in conflict

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:1093-1102`

**Issue:** pre-existing (not introduced by 186-18, on either surface): with the loop halted in
`{kind:"conflict"}` and validation `ok`, `blockedReason` is `null`, so the gauntlet can be
launched while the banner is telling the author their draft moved somewhere else. The publish
then runs against the server's copy — by definition not what is on the author's screen. The
stage-0/stage-5 token guard makes it *safe*; nothing makes it *informed*.

**Fix:** candidate for the deferred ledger alongside WR-14/WR-15 (the `blockedReason` ranking
family): a `conflict` branch returning a locked "resolve the conflict first" sentence, weighed
against the same trigger-flicker concerns WR-14 recorded.

---

_Reviewed: 2026-08-01T20:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

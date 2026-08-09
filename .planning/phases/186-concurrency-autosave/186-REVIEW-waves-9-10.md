---
phase: 186-concurrency-autosave
reviewed: 2026-08-01T17:05:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - frontend/src/hooks/useDraftPersistence.ts
  - frontend/src/hooks/useDraftPersistence.test.tsx
  - frontend/src/components/workflows/BuilderSaveRegion.tsx
  - frontend/src/components/workflows/BuilderSaveRegion.test.tsx
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - frontend/src/components/workflows/PublishGauntlet.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowBuilderPage.session.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  - backend/tests/unit/test_186_concurrent_patch.py
findings:
  critical: 1
  warning: 7
  info: 8
  total: 16
status: issues_found
---

# Phase 186: Code Review Report (waves 9–10 — plans 186-14 … 186-17)

**Reviewed:** 2026-08-01T17:05:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

> Base commit `dfb9d539`. The waves 1–5 review is `186-REVIEW-waves-1-5.md`; the waves 6–8 review
> (CR-02, WR-06…WR-11) is `186-REVIEW-waves-6-8.md`. New ids continue the shared sequence from
> **CR-03** and **WR-12**; prior-finding verdicts are in the table below and are not re-raised.

## Summary

### Prior-finding verification (each re-derived against source, not accepted from a SUMMARY)

| Id | Claim | Verdict |
|----|-------|---------|
| **CR-02** / GAP-4 | a failed `reload()` unmounts the banner and strands the halt | **CLOSED.** `useDraftPersistence.ts:937-949` restores `{kind:"conflict", currentToken, note}` and mutates nothing else; the `haltedRef` condition prevents the opposite lie (F21f). The banner renders the note additively (`BuilderSaveRegion.tsx:234-244`), keeping both exits mounted and enabled. F21a–d + F21f cover it, and the "gone row is still not a conflict" control was extended in place rather than copied. Residue below as WR-16/WR-17 — the *catch scope*, not the *restore*. |
| **WR-07** | a published-row 409 never halts | **CLOSED.** `isTerminalRefusal` is now `WorkflowNotFoundError \|\| WorkflowConflictError` (`:439-442`), and the arm at `:634-642` deliberately does not mint a `conflict`. The three-further-edits test is the 404 test's shape and asserts `not.toBe("conflict")`. |
| **WR-08** | the drain's unthrottled `continue` sets the rate by round-trip latency | **CLOSED as stated.** The two questions are separated (`:661` receipt-by-identity, `:688` re-entry-by-`pendingRef`), and the break at `:700-701` hands the follow-up back to the live debounce. F22a bounds over elapsed time, F22b proves nothing is lost, F22d covers the redundant-Save instance. **But the fix has a second-order effect on 186-16 — see CR-03 and WR-14.** |
| **WR-09** | the flag-off release never resolves the `held` reading; `heldPendingRef` left armed | **PARTIALLY CLOSED.** The resolution is unconditional, functional and above all three gates (`:832`), and `heldPendingRef.current = store.getState().dirty` makes the flag agree with the store on the `!enabled` arm (`:838`). F20f drives both directions by counting writes. **Two halves remain: the halted arm at `:833` still returns without touching the flag (WR-13), and the resolution replaced a false sentence with silence (WR-12).** |
| **WR-10** | publish is not gated on an outstanding write | **CLOSED FLAG-ON ONLY.** `canPublish` gained `!blocked` (`PublishGauntlet.tsx:592`) and the reason is stated inside the modal with `aria-describedby`; the page ranks `SAVING_PUBLISH_WAIT` first (`WorkflowBuilderPage.tsx:1077`). **It is inert on the flag-off surface — CR-03.** |
| **WR-11** | absolute PATCH counts over a drifting interval | **CLOSED.** `patchDelta` measures the dismissal, carries a positive control that would catch an arithmetic error, and the two sibling rows deliberately keep absolute counts as the contrast. The prose records both the RED and the GREEN measurement and says not to inherit either on trust — that is the right shape. |
| **WR-06 residue** | `test_186_concurrent_patch.py` module-level `pytestmark` hides the wire contract | **CLOSED.** The module mark is gone; F1/F2/F3/F13 carry per-test `skipif` against one shared reason string, and nine genuinely DB-free tests now assert the route's `cause`→HTTP mapping and the db tier's three causes. `grep -rn "stale_token" backend/tests/` now matches assertions that run without Postgres. |

### What this pass found

The backend half is the strongest work in the phase and I could not falsify it: the DB-free tier
asserts the exact two keys the client branches on, the 404-collapse is asserted as an *equality*
rather than as two status codes, the fail-closed arm for an unrecognised cause is driven, and the
`$5` bind / text-space contract is pinned positionally. Opaque `T-NOW`/`T-OLD` sentinels are the
right call.

The frontend residue clusters, again, in the same place: **the failure and flag-off paths of a
mechanism that is honest on its success path.** Specifically:

1. **CR-03** — 186-16's guard is computed *below* `if (!canvasEnabled …) return null`, so it does
   not exist on the one surface where the write it guards against is still reachable by design
   (`saveNow` is deliberately not gated on `enabled`). The deferred-items note rejects the stronger
   `flushPendingWrites()` fix *by citing* the fact that the gauntlet is mounted on both flag
   branches — the same fact that makes the weaker fix inert there.
2. **WR-12** — 186-17 fixed a false sentence by deleting it. On the flag-off surface the person is
   told "press Save draft again when it finishes", and that instruction is erased at the instant it
   becomes actionable, leaving no surface indication that the draft is unsaved.
3. **WR-13** — the docblock's stated invariant ("the flag claims unsent work exactly when there IS
   unsent work") holds on one of the two gates it claims to govern.
4. **WR-14/WR-15** — the new `saving` reason outranks the R12 "what to fix" sentence and disables a
   free action (opening the modal), and the deferral note's "the block always ends by itself"
   argument is falsifiable by reading `:605` against `:610`.

## Critical Issues

### CR-03: 186-16's publish guard does not exist on the flag-off Builder, where an explicit Save can still put a PATCH in flight

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:1076-1077`, with the reachable write at
`frontend/src/hooks/useDraftPersistence.ts:852-863` and the unconditional mount at
`frontend/src/pages/WorkflowBuilderPage.tsx:1704-1727`

**Issue:**
The guard 186-16 exists to install is the third line of a memo whose *first* line short-circuits the
whole surface:

```ts
const blockedReason = useMemo<string | null>(() => {
  if (!canvasEnabled || builderPhase !== "drafted") return null   // ← flag-off exits here
  if (persistState.kind === "saving") return SAVING_PUBLISH_WAIT  // ← the WR-10 fix
  …
}, [canvasEnabled, builderPhase, persistState, phases, validation])
```

With `visual_workflow_canvas` off, `blockedReason` is **always** `null`, so `PublishGauntlet`
receives `blockedReason={null}`, `blocked` is `false` (`PublishGauntlet.tsx:846`), and both the
trigger (`:921`) and the inner Publish (`:592`) are ungated.

A write is still reachable on that surface, and deliberately so. Three independent facts in this
phase's own source say the flag-off Builder can have a PATCH outstanding:

- `saveNow` is *not* gated on `enabled` — `useDraftPersistence.ts:852-863` has no `enabled` check,
  and the hold-effect docblock states the asymmetry explicitly at `:820-823`: *"automatic writes obey
  the flag, chosen ones obey the person"* (D-186-03).
- `BuilderSaveRegion` — and therefore the Save-draft button — is inside `actionGroup`, which is
  rendered by **both** branches of the header gate (`WorkflowBuilderPage.tsx:1745` and `:1750`).
- `renderPublish` is mounted in that same `actionGroup` (`:1723-1725`), on both branches.

So the sequence is ordinary and entirely within the shipped affordances:

1. Flag-off Builder. Author edits, presses **Save draft**. `performWrite` issues a PATCH
   (`useDraftPersistence.ts:622-628`); `updateWorkflowDraft` has no timeout and no abort
   (`api.ts:3430-3449`, deliberately — a write is never cancelled).
2. Within that round trip the author presses **◆ Publish…** and then the inner **Publish ▸ run the
   gauntlet**. Nothing refuses either click: `blocked` is `false`.
3. `publish_service.py` reads `stage0_token`; the PATCH commits after that read; the stage-5 flip
   answers `draft_changed` **after** a real golden run has burned wall clock and provider spend.

That is verbatim the failure `PublishGauntlet.tsx:125-134` describes as the reason the inner button
needed gating at all — the guard just is not present where it is still true.

Two further points that make this a gap rather than a considered trade-off:

- `deferred-items.md` §"The publish-time `flushPendingWrites()` seam — REJECTED" rejects the
  stronger fix on exactly this ground: *"`renderPublish` … is mounted **unconditionally** on the
  Builder header, on **both** branches of the flag gate."* The authors established the premise and
  did not carry it to the shipped fix.
- `deferred-items.md` §"Publish while the write loop is in `conflict` or `error`" records what 186-16
  consciously did **not** block. The flag-off surface is not in that list, so this is unrecorded, not
  deferred.

The new canvas test that covers the flag-off surface only drives an *edit*
(`WorkflowBuilderPage.canvas.test.tsx`, *"with the flag OFF nothing writes and nothing blocks"*), so
it asserts `latest()).toBeNull()` — which is precisely the defect, recorded as the expected result.
No test presses Save on the flag-off surface and then reads `blockedReason`.

**Fix:** the `saving` branch is a statement about *this client's own write loop*, not a verdict, so
it does not belong behind the D-181-01 gate that hides verdicts. Lift it above the flag check:

```ts
const blockedReason = useMemo<string | null>(() => {
  // A write this client has outstanding is a fact about the client, not a verdict about the
  // workflow — so it is NOT part of what the revert switch hides. `saveNow` is reachable on the
  // flag-off surface by design (D-186-03), which is exactly why the refusal has to be too.
  if (persistState.kind === "saving") return SAVING_PUBLISH_WAIT
  if (!canvasEnabled || builderPhase !== "drafted") return null
  if (phases.length === 0) return EMPTY_DRAFT_INVITATION
  …
}, [canvasEnabled, builderPhase, persistState, phases, validation])
```

Check the D-181-01 markup pin before landing: `blockedReason` is non-null on the flag-off surface
only *while a write the person requested is outstanding*, which is unreachable at rest — so
`WorkflowBuilderPage.header.test.tsx`'s resting-header assertion is unaffected, by the same argument
186-13 used for `held`. Add a canvas-test row that presses `builder-save-draft` on the flag-off
surface against a deferred `mockUpdate` and asserts the captured reason is `SAVING_PUBLISH_WAIT`.

## Warnings

### WR-12: the flag-off hold release now resolves to silence — the instruction "press Save draft again when it finishes" is erased at the instant it becomes actionable

**File:** `frontend/src/hooks/useDraftPersistence.ts:832-840`, rendered through
`frontend/src/components/workflows/BuilderSaveRegion.tsx:144-153`

**Issue:**
`HOLD_PUBLISHING_MANUAL` (`:183-184`) is the flag-off spelling of the hold and it **instructs**:
*"Publishing — not saved; press Save draft again when it finishes."* 186-13 chose that wording
precisely because no flush is coming on that surface.

186-17's fix runs the resolution unconditionally and above every gate:

```ts
setState((s) => (s.kind === "held" ? { kind: "idle" } : s))
if (haltedRef.current) return
if (!enabled) {
  heldPendingRef.current = store.getState().dirty
  return
}
```

On the flag-off surface the state becomes `{kind:"idle"}` the moment the gauntlet ends. Trace what
`BuilderSaveRegion` then renders with `autosaveEnabled === false`:

- `quietLine` — `state.kind !== "held"` → falls to `!autosaveEnabled ? null` → **nothing**.
- `receiptVisible` — `state.kind === "saved"` is false → nothing.
- the `error` span — `state.kind` is `"idle"` → nothing.

So the header shows a bare `Save draft` button, with unsent work in the store and no statement about
it anywhere on the surface. The person pressed Save, was told to press it again when the publish
finished, and the moment the publish finished the instruction disappeared. The only remaining signal
is `dirty`, which surfaces on *leaving* (the `beforeunload` / in-app guard) — i.e. the work is
protected, but the person is not told there is anything to do until they try to walk away.

WR-09 was raised because *"the surface still made a false statement about system state."* Replacing a
false statement with no statement is a smaller lie, not a true one — and the whole reason
`HOLD_PUBLISHING_MANUAL` exists as a third string is that this phase treats "say what happened" as
the contract.

F20b pins the silence rather than catching it: it asserts `after.kind).not.toBe("held")` and that no
`HOLD_*` string is reachable, and asserts nothing about what the surface says instead.

**Fix:** the flag-off release knows both facts it needs — the hold is over, and the work is unsent.
Resolve to a reading that says so, rather than to `idle`:

```ts
if (!enabled) {
  const unsent = store.getState().dirty
  heldPendingRef.current = unsent
  // The hold has ended and nothing flushed it. Say the thing the hold sentence PROMISED
  // would become possible, rather than going quiet at the moment it does.
  if (unsent) setState({ kind: "held", sentence: HOLD_ENDED_PRESS_SAVE })
  return
}
```

with a fourth locked constant in the same one-home shape (e.g. *"Not saved — press Save draft to save
your changes"*). If a fourth string is unwanted, the alternative is to keep `{kind:"idle"}` and have
`BuilderSaveRegion` render an unsaved-work line whenever `dirty && !autosaveEnabled` — but that adds
resting markup on the flag-off header, so the state-carried form is the safer one. Extend F20b with a
positive assertion about the surviving sentence, not only negative ones.

### WR-13: `heldPendingRef` is left armed on the halted return, so the invariant the 186-17 docblock states holds on only one of the two gates it claims to govern

**File:** `frontend/src/hooks/useDraftPersistence.ts:833` (the halted return), against the claim at
`:804-818`

**Issue:**
The docblock's stated property is universal — *"it stops being a memory of a press and becomes a
statement about the document: the flag claims unsent work exactly when there IS unsent work"* — and
the "fifth fact" paragraph at `:763-768` says the resolution *"governs the whole block"* of three
gates. The implementation applies the pending-flag repair to exactly one of them:

```ts
setState((s) => (s.kind === "held" ? { kind: "idle" } : s))
if (haltedRef.current) return                                   // ← flag untouched
if (!enabled) {
  heldPendingRef.current = store.getState().dirty               // ← repaired here only
  return
}
```

Reachable sequence, entirely within shipped affordances:

1. A publish begins. The author presses **Save draft** → `saveNow` takes the hold branch (`:854-858`)
   and arms `heldPendingRef`.
2. A stale-token refusal arrives from an in-flight write → `haltedRef = true`, state `conflict`.
3. The publish ends. The release effect resolves the (non-`held`) state to itself and returns at
   `:833`. **`heldPendingRef` stays `true`.**
4. The author presses **Overwrite**. `overwrite` (`:975-987`) clears `haltedRef` and writes; it does
   **not** clear `heldPendingRef` (only `reload`'s success path does, at `:934`). The write lands,
   `markSaved()` runs, the store is clean.
5. Any later hold cycle — one more publish — reaches `if (!heldPendingRef.current && !store.getState().dirty) return`
   at `:841`. `heldPendingRef` is still `true`, so the gate passes on a **clean** store and
   `performWrite()` issues a PATCH that changes nothing.

That PATCH is exactly the harm the docblock names: it mints a new `updated_at`, which invalidates the
optimistic guard every other open tab holds — *"manufacturing exactly the conflicts this phase exists
to prevent."* The debounce timer carries a `dirty` gate at `:743` to stop precisely this; the release
path does not.

F20f drives the `!enabled` arm in both directions and never drives the halted arm.

**Fix:** make the flag agree with the store on every exit from this effect, not only one:

```ts
setState((s) => (s.kind === "held" ? { kind: "idle" } : s))
// The flag is a statement about the DOCUMENT, on every path out of here — a halt is a reason
// not to write, not a reason to keep remembering a press.
heldPendingRef.current = store.getState().dirty
if (haltedRef.current) return
if (!enabled) return
if (!heldPendingRef.current) return
heldPendingRef.current = false
void performWrite()
```

Note this also collapses the `!heldPendingRef.current && !store.getState().dirty` test into one
reading of one fact. Add an F20 sibling: hold → press Save → conflict → Overwrite → second hold cycle
against a clean store ⇒ zero writes.

### WR-14: `SAVING_PUBLISH_WAIT` outranks every "what to fix" sentence and disables the modal-opening trigger, so R12's reason flickers and Publish intermittently refuses clicks during ordinary typing

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:1077` (precedence),
`frontend/src/components/workflows/PublishGauntlet.tsx:921` (the trigger)

**Issue:**
Two consequences of ranking the new reason first, neither of which the plan's own reasoning covers.

**(a) It replaces the sentence R12 exists to show.** `blockedReason` is the *only* channel the
Builder has for telling an author why publish is refused, and R12's rule (stated on the prop at
`PublishGauntlet.tsx:112-119`) is that a disabled control must name what to fix. During sustained
editing the write loop cycles `idle → saving → saved/idle` roughly once per `AUTOSAVE_DEBOUNCE_MS`,
so the *actionable* reason ("step 2 has no prompt", `EMPTY_DRAFT_INVITATION`, `DEGRADED_SENTENCE`) is
swapped out for a transient wait on every beat and swapped back. Under a screen reader the
`aria-describedby` target text changes repeatedly for a control the author is trying to understand.
The canvas test *"the saving reason OUTRANKS the empty-draft invitation"* pins this as intended, and
the argument given — *"fixing a verdict will not make Publish go until the PATCH has landed"* —
justifies *adding* the wait, not *hiding* the fix.

**(b) It disables a free action.** `disabled={blocked}` gates the `◆ Publish…` trigger, which only
opens a modal — it issues no request and spends nothing. 186-16's own reasoning says *"the click that
actually spends money is the INNER one."* The effect is that during typing the trigger is
intermittently unclickable for the duration of each round trip (on a cloud backend, a meaningful
fraction of every second), and a click that lands in that window is silently swallowed. WR-08's fix
changed the shape of this rather than removing it: before 186-17 the drain kept `saving` more or
less continuously while typing, so the trigger was almost always disabled; now it strobes.

**Fix:** two independent changes.

1. Rank the wait *last*, or carry it as a second line rather than a replacement — the same
   additive-not-substitutive rule 186-14 applied to `RELOAD_FAILED_NOTE`:

```ts
if (!canvasEnabled || builderPhase !== "drafted") return null   // (see CR-03 for this line)
if (phases.length === 0) return EMPTY_DRAFT_INVITATION
if (validation.kind === "degraded") return DEGRADED_SENTENCE[validation.cause]
…
// nothing else to fix — the only thing left is the wait
return persistState.kind === "saving" ? SAVING_PUBLISH_WAIT : null
```

2. Let the trigger open the dialog and keep the refusal on the inner button, which is the control
   that spends money. `PublishGauntlet` already has both — drop `disabled={blocked}` from the trigger
   (keeping the `aria-describedby` reason beside it) or gate the trigger only on reasons that are
   *stable* rather than transient.

### WR-15: the `saving` block is not bounded the way the deferral note argues — one branch leaves `state` at `saving` with no request outstanding, and a hung write has no ceiling

**File:** `frontend/src/hooks/useDraftPersistence.ts:605` against `:610`;
`frontend/src/lib/api.ts:3430-3449` (no timeout, no abort — by design)

**Issue:**
`deferred-items.md` §"Publish while the write loop is in `conflict` or `error`" justifies blocking on
`saving` and nothing else with an explicit safety argument:

> `saving` is safe to block precisely because it is **bounded** — `performWrite`'s `finally` always
> clears `inFlightRef` and every terminal branch sets a non-`saving` state, so the block always ends
> by itself.

The second clause is false as written:

```ts
setState({ kind: "saving" })          // :605
try {
  if (draftIdRef.current === null) {
    if (creatingRef.current) break    // :610 — leaves `saving` on screen, forever
```

`break` here exits the drain with `state === {kind:"saving"}` and **no request in flight**. The
`finally` clears `inFlightRef`, so nothing will ever set another state: `saveNow` will happily run
again, but the reading only changes on the next successful/refused write. Meanwhile
`BuilderSaveRegion` disables Save on `saving` (`:169`) and — new in 186-16 — `blockedReason` disables
*Publish* under a sentence that promises the block will lift ("Publish will be ready in a moment").
Both controls are dead, permanently, under a false promise.

That branch is currently unreachable (single flight moved inside `performWrite` in 186-12, so
`creatingRef` can only be true inside the synchronous region that set it) — it is prior IN-01, still
open — but 186-16 changed its blast radius from "Save button stuck" to "Save **and** Publish stuck",
and the deferral note's safety argument now rests on the property that branch violates.

The bound is also weaker than claimed in a *reachable* way: `updateWorkflowDraft` sends no
`AbortSignal` and sets no timeout (correctly — a write is never cancelled, `:26-36`). A stalled TCP
connection therefore holds `saving` for as long as the browser's own network timeout, during which
Publish is refused with a sentence that says it will be ready in a moment.

**Fix:** two small changes that make the note's argument true.

```ts
// 1. Move the guard above the state claim, so no path can claim a save it did not start.
if (draftIdRef.current === null) {
  // Defensive only: single flight (:575) makes this unreachable. Kept above `setState`
  // so a future re-entry cannot leave `saving` on screen with nothing outstanding.
  if (creatingRef.current) break
  setState({ kind: "saving" })
  …
```

2. Either give the publish refusal its own ceiling (only refuse while `saving` has been true for less
than N seconds), or state the honest sentence for a long-running write. Alternatively delete the
unreachable `creatingRef` branch entirely and record why single flight makes it so.

### WR-16: `reload()`'s catch spans the local application of the result, so a failure *after* the read reports "We couldn't reach the server" for a server that answered

**File:** `frontend/src/hooks/useDraftPersistence.ts:915-949`

**Issue:**
The try block covers four distinct things — the request, the row lookup, `setDrafted`, and the ref
adoption — while the catch attributes all four to one cause:

```ts
try {
  const rows = id === null ? [] : await listDraftWorkflows()
  const row = rows.find((r) => r.id === id)
  if (!row || !row.definition) { setState({ kind: "error", sentence: DRAFT_GONE_SENTENCE }); return }
  store.getState().setDrafted(row.definition as unknown as BuilderDefinition)
  …
} catch {
  if (haltedRef.current) {
    setState({ kind: "conflict", currentToken: conflictTokenRef.current, note: RELOAD_FAILED_NOTE })
```

`RELOAD_FAILED_NOTE` is a locked, fixed constant: *"We couldn't reach the server to reload — nothing
has changed, and both options above still work."* It is a factual claim about the network. Anything
that throws after `await listDraftWorkflows()` resolves lands on it:

- `rows.find` — if the response body is not an array (a 200 carrying an error envelope, a proxy
  interstitial), `rows.find` is not a function → `TypeError` → "couldn't reach the server."
- `setDrafted` and everything after it.

Both then invite a retry (the note's own docblock: *"Here the retry is exactly the right instinct"*)
that cannot possibly work, because the same row will come back and fail the same way. This is the
`DRAFT_GONE_SENTENCE` rule (`:205-217`) — *"Telling a person 'we couldn't complete the save' for a row
that no longer exists sends them back to press the same button forever"* — reproduced one layer in.

The guard `if (!row || !row.definition)` is also too weak for what it hands to `setDrafted`: `{}` is
truthy, and `setDrafted` destructures `const { phases, ...meta } = definition`
(`builderStore.ts:354-355`), so a definition with no `phases` key sets `store.phases = undefined` —
which every downstream `.map` on the canvas and spine will throw on, and which `performWrite` would
then PATCH straight back. This is prior IN-06's shape, now reachable through the reload exit as well
as through `WorkflowsPage`.

**Fix:** narrow the try to the request, and validate the row before applying it.

```ts
let rows: WorkflowDraftRow[]
try {
  rows = id === null ? [] : await listDraftWorkflows()
} catch {
  // ONLY a failed request may claim the server was unreachable.
  if (haltedRef.current) setState({ kind: "conflict", currentToken: conflictTokenRef.current, note: RELOAD_FAILED_NOTE })
  else setState({ kind: "error", sentence: SAVE_FAILED_SENTENCE })
  return
} finally { /* reloadingRef / setResolving unchanged */ }

const row = Array.isArray(rows) ? rows.find((r) => r.id === id) : undefined
if (!row || !row.definition || !Array.isArray((row.definition as { phases?: unknown }).phases)) {
  setState({ kind: "error", sentence: DRAFT_GONE_SENTENCE })
  return
}
```

Add an F21 sibling that resolves `listDraftWorkflows` with a row whose `definition` has no `phases`
and asserts the loop lands on a sentence that is true of that situation.

### WR-17: a second Reload attempt renders the previous failure's note, so the banner asserts "We couldn't reach the server" while a reload is actively in flight

**File:** `frontend/src/hooks/useDraftPersistence.ts:910-914`, rendered at
`frontend/src/components/workflows/BuilderSaveRegion.tsx:236-243`

**Issue:**
`reload()` sets `reloadingRef` and `setResolving(true)` but leaves `state` untouched. After a first
failure the state is `{kind:"conflict", note: RELOAD_FAILED_NOTE}`, so on the *second* click the
banner renders — with both controls correctly disabled — while still displaying:

> We couldn't reach the server to reload — nothing has changed, and both options above still work.

…as a statement about a request that is at that moment in flight, and beside two controls that are
now disabled (so "both options above still work" is also momentarily false). The note is only
replaced when the second attempt settles.

This is small, but it is the same class the phase treats as first-class everywhere else: a sentence
that describes a past outcome left standing as a description of the present.

**Fix:** clear the note when the resolution starts — it is describing the previous attempt, not this
one.

```ts
const reload = useCallback(async (): Promise<void> => {
  if (inFlightRef.current || reloadingRef.current) return
  reloadingRef.current = true
  setResolving(true)
  // The note describes the LAST attempt. This is a new one, so it stops being true here.
  setState((s) => (s.kind === "conflict" && s.note !== undefined ? { kind: "conflict", currentToken: s.currentToken } : s))
  …
```

### WR-18: `overwrite()` adopts a `null` conflict token unconditionally, silently downgrading the deliberate overwrite to an *unguarded* PATCH

**File:** `frontend/src/hooks/useDraftPersistence.ts:980`, fed by `:379-385`

**Issue:**
`refusalOf` carries whatever token the refusal had, defaulting to `null`:

```ts
return { kind: "conflict", currentToken: carried ?? null }
```

and `overwrite` adopts it without checking:

```ts
tokenRef.current = conflictTokenRef.current
haltedRef.current = false
await performWrite()
```

`updateWorkflowDraft` treats a `null`/empty token as *send no `If-Match` header at all*
(`api.ts:3438-3444`), and the route then runs the unguarded UPDATE. So when the 409 body did not
carry `detail.token` — a partially-parsed body, a proxy that stripped it, a server version that
stops sending it, or `WorkflowStaleTokenError(null)` from the malformed-body arm — Overwrite stops
being *"one PATCH against the token the server holds NOW"* (`:957-960`) and becomes an unconditional
write.

The distinction matters exactly once, and it is the case the guard exists for: if a **third** writer
moved the row between the refusal and the Overwrite click, the guarded form refuses and re-raises the
conflict (which the docblock at `:962-963` promises: *"an overwrite that lost a second race cannot
silently do nothing"*), and the unguarded form clobbers them with no refusal and no banner. The
promise on `overwrite` is therefore conditional on a token this client cannot guarantee it has.

**Fix:** if there is no token to overwrite *against*, the honest act is to re-read rather than to
write blind.

```ts
const overwrite = useCallback(async (): Promise<void> => {
  if (inFlightRef.current || reloadingRef.current) return
  // No token means no precondition, and a PATCH with no precondition is not an overwrite —
  // it is an unconditional write that cannot lose a second race. Refuse rather than degrade.
  if (conflictTokenRef.current === null) {
    setState({ kind: "conflict", currentToken: null, note: OVERWRITE_NEEDS_A_RELOAD })
    return
  }
  …
```

with a locked constant naming Reload as the way forward. If the degraded behaviour is intended, say
so on `overwrite`'s docblock and add a test that drives `WorkflowStaleTokenError(null)` → Overwrite
and asserts the header is absent deliberately.

## Info

### IN-08: F22a's time bound is four times the value it actually measures, so it cannot see a 2–3× rate regression

**File:** `frontend/src/hooks/useDraftPersistence.test.tsx` (F22a, `allowed = Math.ceil(elapsedMs / AUTOSAVE_DEBOUNCE_MS) + 1`)
**Issue:** With `ITERATIONS = 16` at `EDIT_INTERVAL_MS = 125`, every edit reschedules the debounce, so
the timer never matures inside the measured window and the drain breaks each time: the run issues
exactly **1** write against a bound of **4**. The bound is correctly derived from elapsed time (good),
but the margin means a regression that restored, say, one write per two round trips would still pass.
F22b's relative `duringTheRun + 1` is the load-bearing assertion.
**Fix:** tighten to the property actually claimed — `expect(calls).toBe(1)` for this arrangement, or
drive a cadence that lets the timer mature and assert the bound is *tight*.

### IN-09: `renderCapturing` records `blockedReason` from inside a render body

**File:** `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` (`renderPublish={(…) => { seen.push(…) ; return … }}`)
**Issue:** The capture is a side effect performed during React's render phase, so a discarded or
double-invoked render (StrictMode, concurrent re-render) appends entries that were never committed.
`latest()` therefore reads "the last render React attempted", not "what the surface shows".
**Fix:** capture in a `useEffect` inside a tiny probe component, or assert on the rendered
`publish-seam` text (which is already there) instead of on the array.

### IN-10: the flag-off canvas row sleeps 2.2 s of real time

**File:** `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` (*"with the flag OFF nothing writes and nothing blocks"*)
**Issue:** `await new Promise((resolve) => setTimeout(resolve, 2200))` is a wall-clock wait in a suite
whose parallel-load flakiness `deferred-items.md` §"The frontend full-suite rot band" already
documents as a problem for this exact file family.
**Fix:** use fake timers and `advanceTimersByTimeAsync`, as `useDraftPersistence.test.tsx` does.

### IN-11: "clicking the refused Publish issues NO publish request" measures the `disabled` attribute, not `runGauntlet`'s guard

**File:** `frontend/src/components/workflows/PublishGauntlet.test.tsx` (186-16 describe, second row)
**Issue:** `fireEvent.click` on a `disabled` button is not dispatched by the DOM at all, so
`expect(mockedPublish).not.toHaveBeenCalled()` is satisfied before `runGauntlet` is reached. The
comment claims the measurement is "on the transport, not on the rendered outcome" — it is on neither;
it is on the attribute. Both the attribute and the guard derive from the same `canPublish`, so nothing
is *wrong*, but the row proves less than it says.
**Fix:** call the handler directly (or render with `disabled` stripped) to exercise the
`if (!canPublish) return` early return as an independent claim.

### IN-12: the backend module docblock still describes the tests as pre-guard and RED

**File:** `backend/tests/unit/test_186_concurrent_patch.py:3-16`
**Issue:** *"These four tests are authored and observed **RED** BEFORE the guard exists"* and *"`update_draft`
has no `if_match` parameter yet, so each test raises `TypeError`"* are written in the present tense
about a state that no longer exists. A reader running the file will not see either.
**Fix:** move to past tense, or into a "how this was falsified" note dated to Wave 0.

### IN-13: `assert "code" not in missing.detail` is a substring search presented as a structural claim

**File:** `backend/tests/unit/test_186_concurrent_patch.py` (`test_not_found_and_an_unrecognised_cause_are_the_same_codeless_404`)
**Issue:** `missing.detail` is a `str`, so this checks whether the prose contains the letters `code` —
it would not catch a dict detail (the preceding `isinstance` does that) and it *would* fail on an
innocuous re-wording such as "no such workflow code path". The `token` line has the same shape.
**Fix:** drop the two substring lines; `isinstance(detail, str)` plus the equality already carry the
collapse claim.

### IN-14: `PG_AVAILABLE` runs a 2-second connect probe at import time, and a missing `psycopg2` silently disables four live tests

**File:** `backend/tests/unit/test_186_concurrent_patch.py:56-68`
**Issue:** `_pg_reachable()` is called at module scope, so every collection pays up to 2 s even for
`--collect-only`, and its `except Exception` swallows `ImportError` — an environment without
`psycopg2` reports "Postgres not reachable" and skips F1/F2/F3/F13 for the wrong reason, which is the
same class of invisible-skip WR-06 was raised for.
**Fix:** make it a session-scoped fixture, and distinguish `ImportError` (a tooling problem, worth a
loud message) from a connection failure.

### IN-15: the drain's "a live timer by construction" argument is an unenforced caller contract

**File:** `frontend/src/hooks/useDraftPersistence.ts:684-701`
**Issue:** The break at `:700-701` is only safe because every store change to `phases`/`meta` also
changes the `definition` prop's identity, which reschedules the debounce. That holds for the shipped
caller — `WorkflowBuilderPage.tsx:734-737` memoizes over `[builderPhase, meta, phases]`, both
subscribed at `:570-571` — but it is a property of the *caller*, asserted only in prose here. A caller
that passes a stable `definition` (a future embedder, a harness) would strand dirty work silently with
no timer and an `idle` reading.
**Fix:** add a `dirty`-gated safety re-arm on the break path (schedule one `AUTOSAVE_DEBOUNCE_MS`
timer from inside `performWrite` when it breaks superseded), or state the contract on
`DraftPersistenceArgs.definition` and pin it with a test that keeps `definition` stable across a store
edit and asserts the follow-up still happens.

---

_Reviewed: 2026-08-01T17:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

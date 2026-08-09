---
phase: 186-concurrency-autosave
reviewed: 2026-08-01T09:05:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - backend/app/api/workflows.py
  - backend/app/db/workflows.py
  - backend/app/services/harness/publish_service.py
  - backend/tests/unit/test_103_published_409.py
  - backend/tests/unit/test_186_concurrent_patch.py
  - backend/tests/unit/test_186_publish_race.py
  - frontend/src/lib/api.ts
  - frontend/src/lib/api.workflows.test.ts
  - frontend/src/hooks/useDraftPersistence.ts
  - frontend/src/hooks/useDraftPersistence.test.tsx
  - frontend/src/components/workflows/builderStore.ts
  - frontend/src/components/workflows/builderStore.test.ts
  - frontend/src/components/workflows/CanvasToolbar.tsx
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - frontend/src/components/workflows/PublishGauntlet.test.tsx
  - frontend/src/components/workflows/verdictModel.ts
  - frontend/src/components/workflows/BuilderSaveRegion.tsx
  - frontend/src/components/workflows/BuilderSaveRegion.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowsPage.tsx
findings:
  critical: 1
  warning: 5
  info: 7
  total: 13
status: issues_found
---

# Phase 186: Code Review Report (re-review after gap closure 186-09..186-13)

**Reviewed:** 2026-08-01T09:05:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

> The waves-1–5 review is archived at `186-REVIEW-waves-1-5.md`. Findings from it that are still
> live are re-reported below under their ORIGINAL ids; findings verified closed are listed in the
> table and not repeated. New findings carry new ids continuing the same sequence.

## Summary

### Prior-finding verification (waves 1–5 review + 186-VERIFICATION gaps)

Each prior finding was re-derived against the current source, not accepted from the SUMMARY.

| Id | Claim | Verdict |
|----|-------|---------|
| **CR-01** / GAP-1 | mid-flight edit silently dropped, false `Saved ✓` | **CLOSED.** `performWrite` now captures `writtenPhases` / `writtenMeta` at snapshot time (`useDraftPersistence.ts:544-545`) and gates the receipt on identity (`:592-609`). The claim that two references cover the whole payload holds: `selectDefinition` is `{...state.meta, phases: state.phases}` (`builderStore.ts:293-295`) and every mutating action replaces one of them, including `setProjectFolder` (`:586-590`). F17a/b/c drive the *immature-timer* interleaving (`useDraftPersistence.test.tsx:437-441` advances only `AUTOSAVE_DEBOUNCE_MS / 2`), which is the branch the old F9 missed. |
| **WR-01** / GAP-2 | `overwrite`/`reload` bypass single flight | **CLOSED.** The check moved inside the writer (`useDraftPersistence.ts:517-520`); both exits additionally carry `reloadingRef` (`:744`, `:798`) with the token assignment ordered *after* the guard, and `resolving` keeps the banner mounted so the disabled state is actually visible (`BuilderSaveRegion.tsx:213`). F19a–d cover it. |
| **WR-02** | `grounding_fidelity` missing from `STAGES` | **CLOSED, and better than asked.** The row is inserted at its true pipeline position (`PublishGauntlet.tsx:165`), `RUNNING_STAGE_INDEX` is now derived rather than a literal (`:187`), and F18 reads the stage literals out of `publish_service.py` so the mirror claim is checked rather than asserted. |
| **WR-03** / GAP-3 | hold-release writes with the canvas flag off | **CLOSED.** `if (!enabled) return` at `useDraftPersistence.ts:698`, positioned after the `holdRef` mirror and before `heldPendingRef` is cleared. F20a/b/c pin zero network calls flag-off *and* the unchanged flag-on behaviour. |
| **WR-04** | `held` invisible on the flag-off surface | **CLOSED at the component.** `quietLine` evaluates `held` before the flag gate (`BuilderSaveRegion.tsx:139-148`), and a third honest sentence (`HOLD_PUBLISHING_MANUAL`) was added so the promise matches the flush. See WR-09 for the residue the hook still owns. |
| **WR-05** | a deleted draft (404) neither halts nor offers an exit | **CLOSED for 404.** `refusalOf` routes `WorkflowNotFoundError` to its own sentence (`:350-352`) and `isTerminalRefusal` halts the loop (`:382-384`). See WR-07: the same *class* is still open for the published-row 409. |
| **WR-06** | every backend test disappears without Postgres | **PARTIALLY CLOSED — re-reported below under its original id.** F6 and both `*_maps_check_violation_to_409` tests were freed from the module mark. `test_186_concurrent_patch.py` still carries a module-level `pytestmark`, and the second half of the recommended fix (DB-free coverage of the refusal-aware dict / 409 wire shape) was not done. |
| **IN-01..IN-06** | six info items | **ALL STILL OPEN**, verified individually below. IN-05 confirmed by an actual `npx eslint` run (1 warning, same line, same message). |

### What this re-review found

The backend half remains solid. `CONCURRENCY_TOKEN_SQL` is genuinely the only rendering of the
token — I grepped every SQL site under `backend/app/` and the only `updated_at` comparisons on
`workflow_definitions` go through the constant (`db/workflows.py:350, 415, 471, 496, 561-562, 573,
590`); there is no bypass path and no comparison in datetime space. I also re-checked the "no other
writer bumps the draft's `updated_at`" claim against the *new* publish path, which is where it could
plausibly have broken: `_drive_golden_run` calls `run_workflow` directly and `harness_engine.py:1680`
only *grafts* snapshots, while the one writer that would bump the row
(`skill_snapshot.py:252-258`) is reachable only from `preflight_workflow_kickoff`, which refuses
anything that is not `status='published'` (`workflow_kickoff.py:221-225`). The guard is not silently
inert, and the golden run does not invalidate its own stage-0 token. No code in this phase implies a
schema change; the zero-migration claim holds. `require_visible` raises 403, not 404
(`dependencies.py:523`), so the new terminal-404 halt cannot be triggered by an operator flipping a
feature flag mid-session.

The remaining risk is entirely in the exit paths and the drain — the places the three gap-closure
plans shipped without a falsification test:

1. **CR-02 (BLOCKER)** — a transient failure inside `reload()` unmounts the conflict banner while
   leaving `haltedRef` set. The draft is then permanently unsavable through any affordance on the
   page, and the sentence it shows invites a Save press that is a silent no-op. This is WR-04's and
   WR-05's own argument, reintroduced inside the mechanism built to resolve conflicts.
2. **WR-08** — the CR-01 repair replaced a queue flag with an identity compare and kept the
   unthrottled `continue`. While an author types, each completed PATCH immediately issues the next
   one, so the write rate becomes one-per-round-trip instead of the documented one-per-1000 ms. The
   module's own `AUTOSAVE_DEBOUNCE_MS` docblock names halving the write rate against the golden-run
   row as a reason for its value; the drain gives that back.
3. **WR-09** — the WR-03 fix returns early *before* anything resolves the `held` state, so on the
   flag-off surface the header keeps saying "Publishing — …" indefinitely after the publish ended,
   and `heldPendingRef` is left permanently armed.
4. **WR-07 / WR-10** — two more "doomed or wasted work" paths the phase's own reasoning covers but
   its code does not.

## Critical Issues

### CR-02: a transient failure during `Reload` strands the draft permanently — the banner unmounts, the loop stays halted, and Save becomes a silent no-op

**File:** `frontend/src/hooks/useDraftPersistence.ts:743-776` (the catch at `:770-772`), with the render gate at `frontend/src/components/workflows/BuilderSaveRegion.tsx:213`

**Issue:**
`reload()` is the *default* exit offered by the conflict banner. Its failure path does not undo the
halt and does not preserve the banner:

```ts
} catch {
  setState({ kind: "error", sentence: SAVE_FAILED_SENTENCE })
} finally {
  reloadingRef.current = false
  setResolving(false)
}
```

`haltedRef.current` was set to `true` when the stale-token refusal arrived (`:574`) and is cleared
**only** on `reload`'s success branch (`:766`) or by `overwrite` (`:803`). The catch touches neither
it nor `conflictTokenRef`. Meanwhile the banner's render condition is

```tsx
{(state.kind === "conflict" || resolving) && ( … Reload … Overwrite … )}
```

and after the catch both operands are false — `state.kind` is now `"error"` and `resolving` is back
to `false`. So the two controls that were the *only* way out of the halt disappear from the DOM in
the same commit that the halt becomes permanent.

Trace the resulting state:

- `saveNow()` → `if (haltedRef.current) return false` (`:711`) — returns immediately, sets no state,
  renders no message. The Save-draft button is a completely silent no-op, which is precisely the
  defect WR-04 was raised for.
- the debounce effect → `if (haltedRef.current) return` (`:636`) — no timer is even scheduled, so no
  future edit can ever reach the server.
- `reload` / `overwrite` are unreachable: nothing renders them.
- `dirty` stays true, so `beforeunload` (`WorkflowBuilderPage.tsx:1338-1346`) and the in-app leave
  guard (`:1322-1326`) both fire. The author is told they have unsaved work and given no mechanism
  to save it.
- the sentence on screen is `SAVE_FAILED_SENTENCE` — *"Not saved — we couldn't complete the save"* —
  which `DRAFT_GONE_SENTENCE`'s own docblock (`:190-197`) correctly identifies as a sentence that
  **invites a retry**. Here the retry is structurally impossible.

The trigger is ordinary: `listDraftWorkflows()` throws on any non-2xx and on a dropped connection
(`api.ts:3411`), so one flaky request, one expired-token refresh, or one backend restart during the
Reload click is enough. It is a *single click on the recommended, default exit*.

The `!row || !row.definition` branch above it (`:751-762`) has the same shape but is defensible — the
row really is gone, so there is nothing to reload and nothing to overwrite. The `catch` is not: a
failed *request* is explicitly distinguished from a missing *row* in the comment at `:757-759`, and
the difference is precisely that a failed request is retryable.

No test covers this. F19c drives a double-click on Reload (`useDraftPersistence.test.tsx:1184`);
nothing drives a rejecting `listDraftWorkflows`.

**Fix:** a failed exit must leave the person exactly where they were — still in the conflict, with
both exits on screen.

```ts
  } catch {
    // A failed EXIT is not a failed write. The row still moved, the loop is still halted,
    // and both ways out must still be offered — an exit that eats itself on a dropped
    // connection is worse than no exit at all.
    setState({ kind: "conflict", currentToken: conflictTokenRef.current })
  } finally {
```

Add a regression test that rejects `listDraftWorkflows` once and asserts (a) the state is still
`conflict`, (b) a subsequent edit still issues nothing (the halt is intact), and (c) a second
`reload()` call is accepted and succeeds. If the surface should also say *why* the reload failed,
that belongs as an extra line on the banner, never as a replacement for it.

## Warnings

### WR-06 (re-reported — partially closed): the `stale_token` 409 wire shape still has zero DB-free coverage

**File:** `backend/tests/unit/test_186_concurrent_patch.py:52-55` (module-level `pytestmark`)

**Issue:**
Half the fix landed: `test_186_publish_race.py` moved F6 out from under the module mark
(`:108, 165, 220` now carry per-test `skipif`; F6 at `:268` carries none), and
`test_103_published_409.py` did the same for the two `CheckViolationError` mapping tests. Both files
even document the reasoning. `test_186_concurrent_patch.py` was **not** given the same treatment — it
still opens with a module-level `pytestmark = pytest.mark.skipif(...)`, and all four of its tests
need a live pool, so nothing was lost by leaving it there.

But the second half of the recommended fix — *"add a mock-only unit test for
`update_workflow_definition`'s refusal-aware dict (`not_found` / `already_published` /
`stale_token`)"* — was not done. `grep -rn "stale_token" backend/tests/` returns matches in exactly
one file, and that file is entirely skipped without Postgres.

The consequence is concrete. `api.ts:3459-3460` branches the whole conflict UX on
`body.detail.code === "stale_token"` and reads `body.detail.token`. The client side of that contract
is well covered (`api.workflows.test.ts:283-357`) — but against a **mock**. The server side that must
produce that shape (`api/workflows.py:1021-1031`, fed by `db/workflows.py:605`) has no assertion at
all in a CI without local Postgres. The two halves can drift — `cause` renamed, `detail` flattened to
a string, the `token` key dropped — and every suite stays green while the conflict banner silently
degrades to `WorkflowConflictError` and Overwrite loses its one-request path.

**Fix:** add one route-level, DB-free test asserting the refusal shape byte for byte:

```python
async def test_stale_token_refusal_is_a_409_carrying_code_and_token():
    with patch("app.api.workflows.update_workflow_definition",
               AsyncMock(return_value={"ok": False, "cause": "stale_token", "token": "T-NOW"})):
        with pytest.raises(HTTPException) as exc:
            await update_draft(definition_id=uuid4(), body=_definition(),
                               current_user={"id": str(uuid4())}, if_match="T-OLD")
    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "stale_token"
    assert exc.value.detail["token"] == "T-NOW"
```

…plus the `already_published` and `not_found` siblings, and a `pool.fetchrow`-mocked test of
`update_workflow_definition`'s three `cause` values.

### WR-07: a published-row 409 never halts the loop, so a frozen draft retries forever

**File:** `frontend/src/hooks/useDraftPersistence.ts:347-349` and `:382-384`

**Issue:**
`isTerminalRefusal` recognises exactly one name:

```ts
function isTerminalRefusal(err: unknown): boolean {
  return nameOf(err) === "WorkflowNotFoundError"
}
```

`WorkflowConflictError` — the published-row 409 — is classified into a sentence (`:347-349`) but does
**not** halt. A published `workflow_definitions` row is frozen by the
`workflow_definitions_block_published_update` trigger and can never become a draft again, so *every*
future PATCH against that id is guaranteed to fail for the lifetime of the session. The loop
therefore re-issues a doomed request on every edit burst, forever.

This is WR-05's argument verbatim — *"no future write can ever succeed … every subsequent edit
therefore re-issues a doomed request"* — applied to the other terminal cause. It is reachable
whenever a second tab or another device publishes the draft this Builder is editing, which is exactly
the race `test_103_published_409.py` exists for.

It is *less* harmful than the 404 case in one respect (`PUBLISHED_CONFLICT_MESSAGE` names the way
out — "use Tweak to start a new draft") and *more* harmful in another: unlike the halted 404 path,
this one keeps generating server load and keeps re-rendering `saving → error` on every keystroke
burst for as long as the Builder stays open.

**Fix:** halting is a property of the cause, and this cause is terminal:

```ts
function isTerminalRefusal(err: unknown): boolean {
  const name = nameOf(err)
  // Both mean "no write to this row can ever succeed again". A missing row has no exit;
  // a published row has one, and its sentence already names it (Tweak).
  return name === "WorkflowNotFoundError" || name === "WorkflowConflictError"
}
```

and add an F8 sibling asserting that three further edits after a `WorkflowConflictError` issue
nothing — the same shape as the existing *"a 404 HALTS the loop"* test at
`useDraftPersistence.test.tsx:545`.

### WR-08: the drain's `continue` defeats the debounce — a typing author gets one PATCH per round trip, not one per second

**File:** `frontend/src/hooks/useDraftPersistence.ts:592-609` (the `continue` at `:608`)

**Issue:**
The CR-01 repair widened the supersede condition from a queue flag to an identity compare, and kept
the `continue` that follows it:

```ts
const now = store.getState()
const superseded =
  pendingRef.current || now.phases !== writtenPhases || now.meta !== writtenMeta
if (superseded) {
  …
  continue                       // ← re-enters the loop with NO debounce
}
```

Under the old flag, `pendingRef` was armed only where a *matured timer* observed an in-flight write,
so at most one follow-up existed per debounce period. Under the identity compare, **any** store
change during the request supersedes — and config edits write to the store on every keystroke
(`patchPhaseConfig`, `builderStore.ts:519`). So while an author is typing, the loop becomes

`PATCH → resolves → store moved → continue → PATCH → resolves → store moved → continue → …`

with no timer between iterations. The write rate is bounded by round-trip latency, not by
`AUTOSAVE_DEBOUNCE_MS`. On the local stack that is tens of PATCHes per second against a row that
carries the golden-run history. It contradicts the module's own stated invariant — *"Any change to
the definition schedules one write"* (`:50`) — and gives back the second recorded reason
`AUTOSAVE_DEBOUNCE_MS` is 1000: *"It also halves the write rate against a row that carries the
golden-run history"* (`:126`).

Two knock-on effects, both real: every extra write mints a new token, so every other open tab's guard
is invalidated far more often than the design assumes — manufacturing the very conflicts this phase
exists to prevent; and it multiplies the window in WR-10.

A second, cheaper instance of the same shape: pressing **Save draft** while a write is outstanding
arms `pendingRef` (`:518`) even when nothing changed, so the drain issues one redundant PATCH that
bumps the token for no reason at all.

No existing test bounds this. F17b asserts exactly 2 calls for exactly 2 edits, which is the correct
count for a *single* follow-up and says nothing about a sustained run.

**Fix:** keep the identity compare (it is the correct property) but make the follow-up obey the same
quiet period the first write did, rather than firing immediately:

```ts
if (superseded) {
  if (haltedRef.current) break
  if (holdRef.current !== null) { /* … held … */ break }
  // The store moved, so this write is superseded — but a follow-up is still an autosave
  // beat and owes the same quiet period. Re-arm the debounce instead of re-entering.
  pendingRef.current = false
  break                       // the live debounce timer picks the work up
}
```

This relies on the debounce effect's timer genuinely being live — it is, since every edit reschedules
it (`:633-657`) — so it needs a `dirty`-gated safety re-arm only for the case where the last edit's
timer already matured. Add a regression test that drives N edits at sub-debounce spacing across a
slow mocked PATCH and asserts the call count is bounded by elapsed time / `AUTOSAVE_DEBOUNCE_MS`,
not by the number of edits.

### WR-09: with the canvas flag off, a hold is never released — the header claims "Publishing —" forever after the publish ends

**File:** `frontend/src/hooks/useDraftPersistence.ts:693-704` (the early return at `:698`), reached from `:710-716`

**Issue:**
The WR-03 fix returns before anything resolves the held *state*:

```ts
useEffect(() => {
  const previous = holdRef.current
  holdRef.current = holdReason
  if (previous === null || holdReason !== null) return
  if (haltedRef.current) return
  if (!enabled) return              // ← 186-13's gate
  if (!heldPendingRef.current && !store.getState().dirty) return
  …
```

On the flag-off surface (`canvasEnabled === false` — the cold default under D-181-01), `saveNow()`
pressed during a publish sets `state = {kind: "held", sentence: HOLD_PUBLISHING_MANUAL}` (`:712-715`)
and arms `heldPendingRef`. When the gauntlet finishes and `holdReason` goes null, the effect returns
at `:698` without touching `state`. Nothing else writes `state` on that surface, so
`BuilderSaveRegion` keeps rendering the hold sentence through `quietLine` (`:139-141` — deliberately
*not* flag-gated, per the WR-04 fix) indefinitely:

> **Publishing — not saved; press Save draft again when it finishes**

…while nothing is publishing. That is a factual claim about system state, and it is false the moment
the gauntlet resolves. It clears only if the author happens to press Save again.

`heldPendingRef` is left permanently armed as well. It is `enabled` — `canvasEnabled &&
builderPhase === "drafted"` (`WorkflowBuilderPage.tsx:812`) — that gates the flush, and `builderPhase`
does change within a session, so a later hold-release can flush a write on the strength of a flag set
minutes earlier, bypassing the `dirty` gate the debounce timer carries at `:650` precisely to stop
"merely opening a draft" from PATCHing it.

The surface is reachable and rendered: `actionGroup` (which contains `BuilderSaveRegion`) is mounted
on **both** branches of the header gate (`WorkflowBuilderPage.tsx:1722` and `:1727`).

F20b asserts zero network calls on this path, which is correct and passes — it simply never asserts
what the surface says afterwards.

**Fix:** the gate should suppress the *write*, not the *state resolution*:

```ts
  if (!enabled) {
    // No automatic write past the revert switch (D-181-01) — but the hold is over, and a
    // sentence that says "Publishing" when nothing is publishing is a false status. The work
    // stays dirty, so the leave guard and the Save button both still have a job.
    heldPendingRef.current = false
    setState((s) => (s.kind === "held" ? { kind: "idle" } : s))
    return
  }
```

and extend F20b with `expect(stateOf(h.view).kind).not.toBe("held")` after the release.

### WR-10: Publish is not gated on an outstanding autosave write, so a PATCH racing stage 0 burns a full golden run

**File:** `frontend/src/components/workflows/PublishGauntlet.tsx:581-598` and `:878-892`; the hold arms at `frontend/src/hooks/useDraftPersistence.ts:493-497`

**Issue:**
D-186-12's hold stops *new* writes once `publishInFlight` is true, but it cannot recall a write that
is already outstanding. `runGauntlet` issues `publishWorkflow` immediately (`:587`); the publish
service reads `stage0_token` at `publish_service.py:122` and spends it at `:372`, minutes later. If an
autosave PATCH commits **after** stage 0's read, the token is dead on arrival, the flip returns `-2`
→ `draft_changed`, and a real golden run has already burned wall clock and provider spend for a
publish that could never have succeeded.

Nothing prevents it on the client. The trigger is disabled only by `blockedReason` (`:882`), which
carries the *validation* verdict; the inner Publish button is gated only on `canPublish =
goldenInput.trim().length > 0 && !loading` (`:567`). The persistence loop already publishes the fact
needed to close the window — `state.kind === "saving"` — and the Builder already threads a
`blockedReason` string into the gauntlet, so the seam exists.

The window is narrow on its own (it needs an edit within roughly one round trip of the Publish
click), but WR-08 widens it substantially: a typing author now has a PATCH outstanding far more of
the time than the 1000 ms debounce implies. And the failure is expensive and confusing — the author
sees a `draft_changed` refusal for an edit they made *before* pressing Publish.

**Fix:** refuse to start a gauntlet while a write is outstanding, and say why. The Builder already
composes both values:

```tsx
// WorkflowBuilderPage.tsx — fold into the existing blockedReason derivation
const blockedReason =
  persistState.kind === "saving"
    ? "Saving your last change — Publish will be ready in a moment"
    : /* … the existing validation reason … */
```

The stronger alternative — have `runGauntlet` `await` a `flushPendingWrites()` the hook exposes, so
stage 0 reads a token that is provably current — closes the window rather than shrinking it, and is
worth the extra seam given what a wasted golden run costs.

## Info

### IN-01 (re-reported, reframed): the `creatingRef` guard is now unreachable dead code, and still leaves `saving` stuck if it ever isn't

**File:** `frontend/src/hooks/useDraftPersistence.ts:547-552`
**Issue:** `setState({kind: "saving"})` still precedes `if (creatingRef.current) break`. With single
flight now enforced inside `performWrite` (`:517-520`), `creatingRef` can only be true inside the
same synchronous region that set it, so the branch is unreachable — dead code carrying a latent
state-stuck bug (`BuilderSaveRegion` disables the button on `saving`, `:163`).
**Fix:** delete the branch, or move it above the `setState` and comment the invariant that makes it
merely defensive.

### IN-02 (re-reported, still open): `rails.order.index` renders `0` when the selected slug is not in the phase order

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:866-875`
**Issue:** `const at = selectedSlug === null ? -1 : order.indexOf(selectedSlug)` followed by
`index: at + 1` turns a lookup miss into "step 0 of N". It is the same `-1`-read-as-a-value shape F7
fixed in the spine, still unrepaired.
**Fix:** omit the `order` rail when `at === -1`, as `gatesFor` already does for a null phase.

### IN-03 (re-reported, still open): `If-Match` carries a non-entity-tag, and a failed precondition answers 409 rather than 412

**File:** `backend/app/api/workflows.py:961`, `frontend/src/lib/api.ts:3440-3443`
**Issue:** RFC 9110 defines `If-Match` as a list of entity-tags; the token travels bare
(`2026-08-01T…Z`) and the precondition failure is a 409. Reusing a standard precondition header with
off-spec syntax invites a proxy or a future HTTP client to normalise or strip it — at which point the
guard disappears silently and every write becomes unguarded.
**Fix:** quote the value (`If-Match: "<token>"`, unquoting server-side), or move it to
`X-Draft-Token`, which is honest about not being an ETag.

### IN-04 (re-reported — now explicitly accepted in code): `publish_definition`'s disambiguating probe has no owner clause

**File:** `backend/app/db/workflows.py:428-432`
**Issue:** `SELECT 1 FROM workflow_definitions WHERE id = $1 AND status = 'draft'` is still the only
query in this owner-scoped module without a `created_by` conjunct. Phase 186 responded by
*documenting* the reliance on caller discipline (`:422-427`, T-186-02-02 "accepted") rather than
removing it. That is a legitimate decision and it is now recorded — but the file's stated rule at
`:440` ("EVERY query self-scopes `created_by = $N`") is still literally false, which is what a future
grep will find.
**Fix:** thread the already-known `user_id` and add `AND created_by = $2`; the caller has it, and it
costs nothing.

### IN-05 (re-reported, confirmed by a live lint run): the debounce effect's `exhaustive-deps` warning is still unsuppressed

**File:** `frontend/src/hooks/useDraftPersistence.ts:657`
**Issue:** `npx eslint` over the changed frontend source files reports exactly one problem:
`657:6 warning React Hook useEffect has missing dependencies: 'performWrite' and 'store'`. The
omission is deliberate and explained in prose at `:623-632`, but the repo convention elsewhere —
including in files this phase touched (`PublishGauntlet.tsx:868`, `WorkflowBuilderPage.tsx:890`) — is
an inline disable with a reason, so lint output stays clean and a *new* warning is visible.
**Fix:** add `// eslint-disable-next-line react-hooks/exhaustive-deps -- <the existing reason>`.

### IN-06 (re-reported, still open): `onOpenDraft` can seed the Builder store with `phases: undefined`

**File:** `frontend/src/pages/WorkflowsPage.tsx:297`
**Issue:** `definition: (draft.definition ?? {}) as WorkflowDefinitionJSON` — a draft row whose
`definition` failed to decode server-side yields `{}`, which is truthy, so `createBuilderStore`
destructures `phases` as `undefined` (`builderStore.ts:333`) and every `renumber(phases)` on the
drafted path throws. Pre-existing, but it now sits on the autosave path, where the same value would
be PATCHed straight back to the server.
**Fix:** `(draft.definition ?? { phases: [] })`, or refuse to open a draft whose definition did not
decode.

### IN-07 (new): F18's stage extraction is blind to two shapes the service already uses

**File:** `frontend/src/components/workflows/PublishGauntlet.test.tsx:640-647`
**Issue:** `STAGE_LITERAL_PATTERN = 'stage="([a-z_]+)"'` matches only the `_block(…, stage="…")`
keyword form and only `[a-z_]`. `publish_service.py:96` and `:110` return
`"blocked_stage": "not_found"` from a bare dict literal, which the pattern never sees — harmless
today (404 carries no verdict), but it means the guard's coverage is narrower than its docblock
claims ("every stage the server can emit"). A stage containing a digit, or one returned by a future
direct-dict branch, would be silently excluded and F18a's `>= 11` assertion would still pass.
**Fix:** additionally match `blocked_stage["']?\s*[:=]\s*["']([a-z0-9_]+)["']`, and assert the union
contains `not_found` as a second positive control on the extraction.

---

_Reviewed: 2026-08-01T09:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

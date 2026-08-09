---
phase: 186-concurrency-autosave
reviewed: 2026-08-01T05:20:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - backend/app/api/workflows.py
  - backend/app/db/workflows.py
  - backend/app/services/harness/publish_service.py
  - backend/tests/unit/test_103_published_409.py
  - backend/tests/unit/test_186_concurrent_patch.py
  - backend/tests/unit/test_186_publish_race.py
  - frontend/src/components/workflows/BuilderHeaderBar.tsx
  - frontend/src/components/workflows/BuilderSaveRegion.tsx
  - frontend/src/components/workflows/builderStore.test.ts
  - frontend/src/components/workflows/builderStore.ts
  - frontend/src/components/workflows/CanvasToolbar.tsx
  - frontend/src/components/workflows/PublishGauntlet.test.tsx
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - frontend/src/components/workflows/verdictModel.ts
  - frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
  - frontend/src/hooks/useDraftPersistence.test.tsx
  - frontend/src/hooks/useDraftPersistence.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/api.workflows.test.ts
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.header.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.session.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowsPage.tsx
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
status: issues_found
---

# Phase 186: Code Review Report

**Reviewed:** 2026-08-01T05:20:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

The backend half of this phase is solid. The concurrency token is rendered by exactly one
SQL constant (`CONCURRENCY_TOKEN_SQL`) and every read/guard site references it — I checked
all four (`get_definition`, `create_workflow_definition`, `list_draft_workflows`,
`update_workflow_definition`) plus the two `publish_definition` statements; there is no
divergent rendering. Nothing on the server or the client parses the token. Both guarded
writers are single-statement autocommit, so the `now()`-is-transaction-time hazard is not
live; I also verified the `set_updated_at` BEFORE-UPDATE trigger really exists on
`workflow_definitions` (full-schema.sql:3685), so the guard is not silently inert, and that
the only other writer to that table (`materialize_skill_snapshots`) is unreachable for
drafts (`workflow_kickoff.py:222` enforces `status='published'`), so it cannot bump a
draft's token behind the Builder's back. The three refusals map totally, the 404 stays
byte-identical for missing-vs-foreign, and the new `If-Match` and `-2` paths add no
authorization bypass: the `created_by = $2` conjunct is preserved alongside the token, and
the disambiguating probe is owner-scoped.

The autosave loop is where this phase breaks. **`useDraftPersistence` silently drops an
edit made while a PATCH is in flight, files a `saved` receipt for it, and disarms both
leave guards** — I reproduced this against the real hook and the real store (CR-01). The
loop's single-flight invariant is also not enforced where it claims to be: two Overwrite
clicks issue two concurrent PATCHes carrying the same token, reproduced the same way
(WR-01). Two more findings are flag-off leaks of the new write behaviour, which matters
because `visual_workflow_canvas` cold-defaults OFF and D-181-01 is the milestone's hard
gate.

The specific fail-open class this phase hunted (`findIndex` → `-1` read as "passed") is
genuinely fixed in `GauntletSpine`, and the repair is a property rather than a special
case. But the `STAGES` table it was fixed in is still missing a stage the server has
emitted since Phase 182 (`grounding_fidelity`), so the most common real publish refusal
still renders as an unplaceable, fully-grey spine (WR-02).

## Critical Issues

### CR-01: An edit made while a PATCH is in flight is silently lost, and the surface files a false `Saved` receipt

**File:** `frontend/src/hooks/useDraftPersistence.ts:403-422` (with the debounce gate at `:457`)

**Issue:**
The drain only treats a write as superseded when `pendingRef` is set, and `pendingRef` is
set in exactly three places — the debounce timer firing *while* `inFlightRef` is true,
`saveNow`, and the hold-release effect. An edit that lands during an in-flight write but
whose own 1000 ms debounce has not yet matured sets none of them. The write then completes,
`pendingRef` is false, and the loop runs:

```ts
// A CONFIRMED write with nothing newer queued is the ONLY thing that clears `dirty`.
store.getState().markSaved()
setState({ kind: "saved", at: Date.now() })
```

`markSaved()` clears `dirty` on behalf of a payload that predates the edit. When that edit's
own timer finally matures, the debounce gate reads the flag `markSaved()` just falsified:

```ts
if (!store.getState().dirty) return
```

…and bails. The edit is never sent. A PATCH round-trip is normally far shorter than the
1000 ms debounce, so this is the *common* interleaving, not an exotic one: type, pause ~1 s,
resume typing, stop.

Every downstream honesty mechanism then reports the wrong thing, because all of them key on
`dirty`:
- `BuilderSaveRegion` renders `Saved · still a draft` + `Saved · just now`
  (`receiptVisible = state.kind === "saved" && !dirty`)
- the in-app leave guard resolves `true` without prompting
  (`WorkflowBuilderPage.tsx:1324`)
- the `beforeunload` listener is unmounted (`WorkflowBuilderPage.tsx:1339`)
- `onFieldCommit`'s blur rescue is dead too — it is gated on `dirty`
  (`WorkflowBuilderPage.tsx:1213`)

This is exactly the T-185-04-01 pattern the module's own docblock says it exists to prevent
("A refusal — of any kind — leaves the draft dirty"): here it is not a refusal but a
*confirmed* write that files a receipt for content it did not carry.

**Reproduced** against the real hook + real `createBuilderStore` (temporary test, since
removed):

```
phases sent in write #1: 3
phases in store now:     4
update calls:            1
store.dirty:             false
hook state:              {"kind":"saved","at":...}
```

The shipped suite misses it because `F9 · "files no receipt for a save a newer edit already
superseded"` (`useDraftPersistence.test.tsx:280-298`) advances the fake clock a full
`AUTOSAVE_DEBOUNCE_MS` after the second edit *while the first write is still held open* —
which is precisely the branch that already works.

**Fix:** stop inferring "nothing newer" from a queue flag and compare what was actually
written. Capture the identity of the payload at snapshot time and only file the receipt if
the store still holds it:

```ts
const snapshot = store.getState()
if (snapshot.builderPhase !== "drafted") break
const writtenPhases = snapshot.phases
const writtenMeta = snapshot.meta
const def = selectDefinition(snapshot) as unknown as WorkflowDefinitionJSON
// … issue the request …

const now = store.getState()
const superseded =
  pendingRef.current || now.phases !== writtenPhases || now.meta !== writtenMeta
if (superseded) {
  if (haltedRef.current) break
  if (holdRef.current !== null) { /* … held … */ break }
  continue                       // drain the newer definition instead of receipting
}
store.getState().markSaved()
setState({ kind: "saved", at: Date.now() })
```

(The equivalent one-line alternative — having the debounce effect set
`pendingRef.current = true` whenever it re-arms while `inFlightRef.current` is true — also
closes it, and is smaller. Either way, add a regression test whose second edit's timer does
**not** mature during the flight.)

## Warnings

### WR-01: `overwrite()` and `reload()` bypass the single-flight guard — two Overwrite clicks issue two concurrent PATCHes

**File:** `frontend/src/hooks/useDraftPersistence.ts:554-558` (and `:519-540`)

**Issue:**
`performWrite` enforces only `haltedRef`; the single-flight rule lives in its *callers*
(`saveNow:503`, the debounce timer `:458`, the hold-release effect `:484` all check
`inFlightRef`). `overwrite` does not:

```ts
const overwrite = useCallback(async (): Promise<void> => {
  tokenRef.current = conflictTokenRef.current
  haltedRef.current = false
  await performWrite()          // ← no inFlightRef check
}, [performWrite])
```

The conflict banner's `Overwrite` button is never disabled and shows no in-flight state, so
a double-click is an ordinary user action. Reproduced with the real hook: **peak concurrent
writes = 2**, both carrying the same token — so one of them is refused `stale_token` and the
loop drops straight back into a conflict banner *for a conflict that does not exist*, which
is the exact user-facing lie the module docblock argues against ("the person would be told
their own draft moved under them while they typed"). The losing loop also clears
`inFlightRef` in its `finally` while the winner is still outstanding, so a third write can
start on top of it.

`reload()` has the same shape: it resets `haltedRef` / `pendingRef` / `tokenRef` with no
regard for an outstanding write, so an in-flight completion can overwrite the token reload
just adopted.

**Fix:** make the invariant a property of the writer, not of each caller:

```ts
const performWrite = useCallback(async (): Promise<boolean> => {
  if (haltedRef.current) return false
  if (inFlightRef.current) { pendingRef.current = true; return false }
  inFlightRef.current = true
  …
```

and disable the two banner buttons while `state.kind === "saving"`.

### WR-02: the gauntlet spine has no node for `grounding_fidelity`, so the commonest real refusal paints an all-grey spine

**File:** `frontend/src/components/workflows/PublishGauntlet.tsx:141-151`

**Issue:**
`publish_service` can emit twelve `blocked_stage` values; `STAGES` enumerates eleven. The
missing one is `grounding_fidelity` (`publish_service.py:239`) — stage 2.6, the check
`/validate` previews on every canvas edit and therefore the block authors hit most often.
This phase edited exactly this table (appending the `Commit` row for `draft_changed`) and
did not add it.

The consequence is not a silent pass — F7's repair holds, `unknownBlock` is true and every
node correctly renders un-passed — but the result is a fully grey nine-node spine with no
red node, under the generic `BLOCKED_FALLBACK_SENTENCE` ("Publish was blocked … What
stopped it is named below"), for a refusal the server can place precisely. The spine's own
docblock claims it mirrors the server's stage list; it does not.

**Fix:** add the row between `Pause` and `Golden run` (its real position in the pipeline),
and add a test that asserts `STAGES.flatMap(s => s.codes)` is a superset of the stage
literals `publish_service` can emit, so the next stage cannot be forgotten:

```ts
{ label: "Grounding", what: "Grounding fidelity — folders, tools and skills must resolve",
  codes: ["grounding_fidelity"], Icon: MagnifyingGlassTiltedLeft },
```

### WR-03: the hold-release effect performs an automatic write with the canvas flag OFF (D-181-01 leak)

**File:** `frontend/src/hooks/useDraftPersistence.ts:477-490`

**Issue:**
`enabled` is consulted only by the debounce effect (`:441`). The hold-release effect is not
gated on it:

```ts
if (!heldPendingRef.current && !store.getState().dirty) return
heldPendingRef.current = false
…
void performWrite()
```

With `visual_workflow_canvas` OFF — the cold default for every user — `enabled` is false and
autosave is supposed to be entirely absent. But `publishInFlight` is still wired
(`WorkflowBuilderPage.tsx:1700` passes `setPublishInFlight` through `renderPublish`
unconditionally, and `WorkflowsPage.tsx:439` forwards it), so a flag-off session that edits,
publishes, and lets the publish finish gets an **automatic, unrequested PATCH** the moment
the hold releases. D-181-01 / the v3.6 hard gate #1 promise a flag-off surface identical to
the shipped one; this is new write behaviour leaking through the revert switch.

**Fix:** gate the automatic flush the same way the timer is gated — `saveNow`/`overwrite`
are user-initiated and may stay ungated:

```ts
useEffect(() => {
  const previous = holdRef.current
  holdRef.current = holdReason
  if (previous === null || holdReason !== null) return
  if (!enabled) return            // ← automatic writes obey the flag
  …
}, [holdReason, enabled, store, performWrite])
```

### WR-04: with the flag off, pressing "Save draft" during a publish is a completely silent no-op

**File:** `frontend/src/components/workflows/BuilderSaveRegion.tsx:103-112`

**Issue:**
`saveNow` refuses while held and reports `{kind:"held", sentence}` (`useDraftPersistence.ts:498-502`).
`BuilderSaveRegion` renders that sentence only through `quietLine`, which is suppressed
entirely when `autosaveEnabled` is false. `held` is not covered by the `error` span either
(that branch is `state.kind === "error"` only). So on the flag-off surface — the default —
a user who clicks `Save draft` while a publish is running, or while the last `/validate`
returned `unreadable`, gets **no state change, no message and no receipt**: the button
appears to do nothing. That is worse than the pre-186 behaviour it replaced, and the
`held` docblock's own promise ("the reason is stated") is false on this surface.

**Fix:** `held` describes an explicit user action's outcome as well as autosave's, so it
must render regardless of `autosaveEnabled`. Either render `state.kind === "held"` in the
same (non-alert) span unconditionally, or fold `held` into the always-rendered line and keep
only `AUTOSAVE_SAVING` / `AUTOSAVE_SAVED` behind the flag.

### WR-05: a deleted draft (404) neither halts the loop nor offers a way out

**File:** `frontend/src/hooks/useDraftPersistence.ts:251-269`

**Issue:**
`refusalOf` routes `WorkflowNotFoundError` to the cause-neutral catch-all
(`SAVE_FAILED_SENTENCE`) and does **not** set `haltedRef`. A 404 on PATCH means the row is
gone (deleted from another tab or another device) and `draftIdRef` is permanently stale — no
future write can ever succeed, because the loop keeps PATCHing an id that does not exist and
never falls back to a create. Every subsequent edit therefore re-issues a doomed request,
the draft stays dirty forever, and the person is told "Not saved — we couldn't complete the
save", a sentence that invites them to retry something that cannot work. The conflict path
by contrast halts and offers two exits; the terminal case has none.

**Fix:** treat `WorkflowNotFoundError` as terminal for this row — halt the loop and surface a
sentence that names the exit (e.g. clear `draftIdRef` so the next write re-creates the draft,
or offer a "Save as a new draft" control alongside the message). At minimum, stop re-issuing:

```ts
if (name === "WorkflowNotFoundError") {
  return { kind: "error", sentence: DRAFT_GONE_SENTENCE }   // + haltedRef in the catch
}
```

### WR-06: every backend test for this phase disappears without a live Postgres — including the one that needs none

**File:** `backend/tests/unit/test_186_publish_race.py:65-70` (same shape at `test_186_concurrent_patch.py:50-55`)

**Issue:**
Both new suites carry a module-level `pytestmark = pytest.mark.skipif(not PG_AVAILABLE, …)`.
That is defensible for the seven live tests, but `test_the_golden_run_receipt_survives_a_draft_changed_refusal`
(`:254-369`) drives `publish_service.publish` with `pool=AsyncMock()` and patches every
boundary — it touches no database at all, and it is the **only** automated proof that the
`-2` sentinel becomes a `draft_changed` block instead of `{published: True, version: -2}`
plus a false `publish_succeeded` receipt. Gated behind the module skip, that guard is absent
in any environment without local Postgres (i.e. CI), so the phase's headline backend
invariant can regress with a green suite. The same applies to the 409-shape assertions added
to `test_103_published_409.py`.

**Fix:** move F6 out from under the module-level `pytestmark` (either into its own file or by
replacing the module mark with per-test `@pytest.mark.skipif` on the seven live ones), and
add a mock-only unit test for `update_workflow_definition`'s refusal-aware dict
(`not_found` / `already_published` / `stale_token`) so the client contract has DB-free
coverage.

## Info

### IN-01: the create branch can leave the loop reporting `saving` with the Save button stuck disabled

**File:** `frontend/src/hooks/useDraftPersistence.ts:369-375`
**Issue:** `setState({kind:"saving"})` runs before `if (creatingRef.current) break`, so that
break exits with the state still `saving` and `ok=false`. `BuilderSaveRegion` disables the
button on `saving`, so the surface is stuck until some later edit re-enters the loop. Only
reachable once two `performWrite` loops can overlap (see WR-01).
**Fix:** move the `creatingRef` check above the `setState`, or reset the state on that break.

### IN-02: `rails.order.index` renders `0` when the selected slug is not in the phase order

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:866-875`
**Issue:** `const at = selectedSlug === null ? -1 : order.indexOf(selectedSlug)` followed by
`index: at + 1` turns a lookup miss into "step 0 of N" rather than into an absent rail —
the same `-1`-read-as-a-value shape F7 fixed in the spine.
**Fix:** bail to an honest value when `at === -1` (omit the `order` rail, as `gatesFor`
already does for a null phase).

### IN-03: `If-Match` carries a value that is not an entity-tag, and a failed precondition answers 409 rather than 412

**File:** `backend/app/api/workflows.py:961`, `frontend/src/lib/api.ts:3440-3443`
**Issue:** RFC 9110 defines `If-Match` as a list of entity-tags (`"…"` / `W/"…"`); the token
travels as a bare `2026-08-01T12:00:00.123456Z`, and a precondition failure is signalled as
409 instead of 412. CORS is fine here (`main.py:672` is `allow_headers=["*"]`), and no
intermediary in this stack is known to validate the value, but reusing a standard
precondition header with off-spec syntax and off-spec semantics invites a proxy or a future
HTTP client to normalise or strip it — at which point the guard silently disappears.
**Fix:** either quote the value (`If-Match: "<token>"`, unquoting server-side) or move it to
a project-namespaced header (`X-Draft-Token`), which is honest about it not being an ETag.

### IN-04: `publish_definition`'s disambiguating probe has no owner clause

**File:** `backend/app/db/workflows.py:428-432`
**Issue:** `SELECT 1 FROM workflow_definitions WHERE id = $1 AND status = 'draft'` is the only
query in this owner-scoped module without a `created_by` conjunct. It is safe today — the sole
caller owner-checks at publish stage 0 — and that is documented, but the file's stated rule is
"EVERY query self-scopes `created_by = $N`" and this one relies on caller discipline instead.
**Fix:** thread the already-known `user_id` through and add `AND created_by = $2`; it costs
nothing and makes the helper safe in isolation.

### IN-05: the debounce effect's `exhaustive-deps` warning is left unsuppressed

**File:** `frontend/src/hooks/useDraftPersistence.ts:466`
**Issue:** `npx eslint` reports one warning on the whole phase — "React Hook useEffect has
missing dependencies: 'performWrite' and 'store'". The omission is deliberate and explained in
prose above the effect, but the repo's convention elsewhere (e.g.
`WorkflowBuilderPage.tsx:890`, `PublishGauntlet.tsx:831`) is an inline
`// eslint-disable-next-line react-hooks/exhaustive-deps -- <reason>`, which keeps lint output
clean so a *new* warning is visible.
**Fix:** add the inline disable with the existing reason.

### IN-06: `onOpenDraft` can seed the Builder store with `phases: undefined`

**File:** `frontend/src/pages/WorkflowsPage.tsx:297`
**Issue:** `definition: (draft.definition ?? {}) as WorkflowDefinitionJSON` — a draft row whose
`definition` failed to decode server-side (`_coerce_definition` returns `None`) yields `{}`,
which is truthy, so `createBuilderStore` destructures `phases` as `undefined` and every
`phases.some(…)` / `renumber(phases)` on the drafted path throws. Pre-existing (Phase 103/184),
but it is now on the autosave path, where the same value would otherwise be PATCHed back.
**Fix:** `(draft.definition ?? { phases: [] })`, or refuse to open a draft whose definition did
not decode.

---

_Reviewed: 2026-08-01T05:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

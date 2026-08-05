---
phase: 188-non-technical-run-observability
reviewed: 2026-08-05T00:00:00Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - backend/app/api/workflow_runs.py
  - backend/app/main.py
  - backend/app/middleware/canvas_gate.py
  - backend/tests/test_182_canvas_gate.py
  - backend/tests/test_188_workflow_run_read.py
  - backend/tests/test_revert_byte_identical.py
  - frontend/src/App.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/ChatLayout.launch.test.tsx
  - frontend/src/components/layout/__tests__/ChatLayoutLaunch.test.tsx
  - frontend/src/components/panel/PhaseCard.tsx
  - frontend/src/components/panel/PhaseTimeline.tsx
  - frontend/src/components/panel/WorkspacePanel.tsx
  - frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx
  - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
  - frontend/src/components/workflows/PhaseNode.tsx
  - frontend/src/components/workflows/PhaseNode.test.tsx
  - frontend/src/components/workflows/PhaseNodeCard.tsx
  - frontend/src/components/workflows/PhaseNodeCard.test.tsx
  - frontend/src/components/workflows/WorkflowCanvas.tsx
  - frontend/src/components/workflows/WorkflowCanvas.test.tsx
  - frontend/src/components/workflows/runVocabulary.ts
  - frontend/src/index.css
  - frontend/src/lib/api.ts
  - frontend/src/lib/phaseState.ts
  - frontend/src/lib/phaseState.test.ts
  - frontend/src/pages/WorkflowRunPage.tsx
  - frontend/src/pages/WorkflowRunPage.test.tsx
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/types/index.ts
  - scripts/sc10_188_run_board.py
  - scripts/vitest-count-gate.cjs
findings:
  critical: 6
  warning: 10
  info: 0
  total: 16
status: issues_found
---

# Phase 188: Code Review Report

**Reviewed:** 2026-08-05
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Phase 188 ships a genuinely well-built *static* run surface: the derivation extraction
(`lib/phaseState.ts`), the vocabulary split (`runVocabulary.ts`), the own-property totality
guards, the ring geometry, the IDOR posture on `GET /workflow-runs/{id}` and the
de-slacked count gate are all solid. Two things were verified mechanically during this
review: `npx tsc --noEmit -p tsconfig.app.json` reports **33 errors, all pre-existing** (no
new typecheck debt), and `node scripts/vitest-count-gate.cjs` is **green at 2421/2421 with
0 failing** — the gate's zero-slack claim is accurate.

The defects are concentrated in the **liveness and reachability** halves of the phase goal
— "makes a workflow run watchable" and "gives the run its own surface". Three of them are
structural and independently sufficient to make the shipped surface not do what the phase
was chartered to do:

* the run row is fetched **exactly once** and never re-read, so the band, the terminality
  and the elapsed anchor freeze at mount (CR-01);
* the launch path no longer selects the thread, so **nothing opens the run's SSE stream**
  and the per-node canvas readings never advance either (CR-02);
* `finish_run` NULLs `threads.active_workflow_run_id`, so the "Open the run" receipt — the
  only route back — **never renders for a finished run**, which is the exact case its own
  docblock says it exists to serve (CR-03).

Three further BLOCKERs cover the revert contract (the new route leaks its existence via 405
and 307 while the canvas is off — measured, CR-04; and the new view is not flag-gated at
all, CR-05) and a surviving fail-open in the live reconcile that the phase fixed one
function away and then pinned in place with a test (CR-06).

A recurring pattern across the WARNINGs: several docblocks in this phase assert properties
the code does not have (the WR-08 saving, the surviving thread anchor, the totality
contracts). Where the prose and the code disagree, the code is what ships.

## Critical Issues

### CR-01: The run surface never re-reads the run — a live run shows "● Running" forever

**File:** `frontend/src/pages/WorkflowRunPage.tsx:320-350` (and `469-514`, `639-643`)
**Severity:** BLOCKER

`setRun` is called from exactly one place: the effect keyed on `[runId, retryNonce]`.
`retryNonce` is bumped only by the "Try again" button, which renders **only** on the
`broken` screen. There is no polling, no interval, and the reconnect effect
(`:380-393`) calls `reconcile()` / `reconcileFiles()` — the phase slice and the file
list — but **not** `getWorkflowRun`.

Everything derived from `run.status` is therefore frozen for the whole session:

* `band` (`:511-514`) — a run launched at `status: "active"` renders `● Running` until the
  user leaves the page, including long after it completed or failed;
* `isTerminal` (`:470`) — so `aria-busy={!isTerminal}` (`:640`) never flips false, and the
  elapsed slot never switches to its frozen `Ran for …` form;
* `ticking` (`:477`) — the once-a-second clock keeps counting after the run has stopped,
  which is *worse* than a stale word: a ticking number is an active claim of liveness;
* `ALERTING_STATUSES` (`:524-530`) — a run that FAILS while being watched never fires the
  assertive alert, because `run.status` is still the launch-time `"active"`.

This is the headline requirement of the phase inverted: the surface asserts a run is
running at exactly the moment it is not.

**Fix:** poll the run read while it is non-terminal, and reconcile it on wake alongside
the phase slice.

```tsx
// Re-read the RUN itself, not just its phases. A run-level status is the one thing no
// other source on this surface carries.
useEffect(() => {
  if (!runId || loadPhase !== "ready" || isTerminal) return
  const id = window.setInterval(() => {
    getWorkflowRun(runId)
      .then((r) => { if (currentRunRef.current === runId) setRun(r) })
      .catch(() => {})           // a blip must not tear down a good surface
  }, 5000)
  return () => window.clearInterval(id)
}, [runId, loadPhase, isTerminal])
```

…and add `getWorkflowRun(runId).then(...)` to `onWake` in the reconnect effect (`:382-386`),
so a lid closed across the run's completion re-reads the verdict on wake.

---

### CR-02: The launch path opens no stream, so the canvas nodes never advance either

**File:** `frontend/src/components/layout/ChatLayout.tsx:319-331`
**Also:** `frontend/src/pages/WorkflowRunPage.tsx:354`, `frontend/src/hooks/usePanelReconcile.ts:113-127`
**Severity:** BLOCKER

Before this phase, `doRun`'s tail called `selectThread(thread)` + `onNavigate("chat")`.
`selectThread` → `setViewingThread` → the store's `reconcile(threadId)` action, which is the
**only** thing in the app that calls `subscribeToRun(...)` for a thread the user did not
send from (`StreamsProvider.tsx:1784-1794`). Plan 09 deleted both calls, so on the launch
path:

* `viewedThreadId` is never set to the launched thread;
* the provider's own visibility/focus listeners gate on `activeThreadIdRef.current`
  (`StreamsProvider.tsx:2888-2899`), which is still the *previous* thread;
* `postMessage` in `doRun` is the raw `lib/api` client, which does not open a stream.

So no `phase_started` / `phase_completed` / `phase_failed` event ever reaches
`phasesByThread` for that thread. The only writer left is `usePhases`'s
`usePanelReconcile`, which is documented as **one-shot on `[threadId]` with no
visibility/focus listeners** (D-086-15) — it fires once at mount and never again.

Net effect on the primary path (`Workflows → Run`): the canvas paints the mount-time
snapshot (typically "step 1 Running, the rest Not started") and stays there for the entire
run. Combined with CR-01, the run surface reached by launching is a still image with a
clock on it.

Note the failure is *path-dependent*, which is why it is easy to miss in UAT: entering the
surface through the panel receipt (`openRunSurface`) works, because that thread is already
the viewed thread and already has a live subscription.

**Fix (minimal, keeps the retarget):** keep the thread selected while still landing on the
run surface — selection is what arms the stream, and it is orthogonal to which view renders.

```tsx
if (workflowRunId) {
  selectThread(thread)          // arms the SSE subscription for this thread
  setActiveRunId(workflowRunId)
  onNavigate("workflow-run")    // …and still land on the run's own room
  return
}
```

If keeping chat's viewed-thread pointer clean is required, the alternative is to have
`WorkflowRunPage` call the store's `reconcile(run.thread_id)` action once the run read
resolves — but that is the heavier change, and the `ChatLayout.launch.test.tsx` fence that
counts navigation calls will need its expectation updated either way.

---

### CR-03: A finished run is unreachable — `finish_run` clears the anchor the receipt reads

**File:** `frontend/src/components/panel/WorkspacePanel.tsx:160-217`
**Also:** `backend/app/db/workflows.py:1048-1062`
**Severity:** BLOCKER

`RunSeam` resolves the run id from `frame.active_workflow_run_id` and renders nothing when
it is null (`:203`, `:217`). Its docblock justifies that choice with:

> "The thread frame's anchor survives termination (it is what makes the lock read 'stale'
> rather than absent) and is the only honest source."

That is false. `finish_run` writes, in the same transaction as the terminal status:

```sql
UPDATE threads SET active_workflow_run_id = NULL WHERE active_workflow_run_id = $1
```

(`db/workflows.py:1058-1062` — described in its own docblock as *"the SINGLE authoritative
clear site"*). `reconcilePhases`' comment in `StreamsProvider.tsx:3376-3378` states the
opposite of `RunSeam`'s and is the correct one: *"A COMPLETED workflow run CLEARS the
thread anchor (mode flips back to 'deep')"*.

Consequence: the receipt renders **only while the run is live**, and is absent for exactly
the case it was built for. With `GET /runs` deferred, no router, no nav item claiming
`workflow-run`, and `activeRunId` held in volatile React state, a finished run has **zero**
entry points once the user navigates away. "A finished run can be re-opened" is true of the
endpoint and false of the product — the precise failure the docblock says it is preventing.

**Fix:** resolve the id from the run row rather than the live anchor. The cheapest correct
source is the thread's most recent `workflow_runs` row; a `GET /threads/{id}/workflow`
addition is the smallest wire change:

```python
# threads.py — alongside active_workflow_run_id, an anchor that survives termination
last_workflow_run_id = await _rls_fetchval(
    "SELECT id FROM workflow_runs WHERE thread_id = $1 ORDER BY created_at DESC LIMIT 1",
    thread_uuid,
)
```

```tsx
// WorkspacePanel.tsx
setRunId(frame.active_workflow_run_id ?? frame.last_workflow_run_id ?? null)
```

Until then, the receipt's docblock claim must be corrected — a comment asserting a DB
behaviour the DB does not have is how this defect survived review.

---

### CR-04: `/workflow-runs/{id}` leaks its existence while the canvas is OFF (405 + 307)

**File:** `backend/app/middleware/canvas_gate.py:76-84`, `:145-155`
**Also:** `backend/app/api/workflow_runs.py:158-164`
**Severity:** BLOCKER

The asymmetry itself is documented and intended. Its *consequence* is not handled, and it
re-opens exactly the two channels `CanvasGateMiddleware` was built for (Phase 182 CR-01).
The docblock claims *"for a parameterised route the request-side authority is
`Depends(require_canvas())`"* — but `require_canvas` is a dependency, and Starlette answers
both of these **before any dependency runs**.

Measured against the real routing stack:

```
GET   /workflow-runs/<uuid>       -> 404   (gate)
POST  /workflow-runs/<uuid>       -> 405   ← admits a handler is declared at this path
GET   /workflow-runs/<uuid>/      -> 307   ← redirect admits the slash-stripped path matches
POST  /workflow-runs/x/y          -> 404   (genuinely unbuilt — the contrast)
```

`_is_canvas_path` cannot close either, because it does exact membership on the request path
and `"/workflow-runs/{workflow_run_id}"` never equals `/workflow-runs/<uuid>`. The
trailing-slash normalisation at `:153-155` exists specifically to close the 307 escape for
the two literal paths and silently does nothing for this one.

`test_revert_byte_identical.py::test_run_read_404s_when_off` probes four *caller* shapes but
only the GET verb and only the un-slashed path, so the suite is green while the leak is live.

**Fix:** teach `_is_canvas_path` about templated members. A one-time compile keeps the
"one constant, both halves" contract intact:

```python
import re

_GATED_PATTERNS = tuple(
    re.compile("^" + re.sub(r"\{[^/}]+\}", "[^/]+", p) + "$")
    for p in CANVAS_GATED_PATHS
)

def _is_canvas_path(path: str) -> bool:
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    return path in CANVAS_GATED_PATHS or any(p.match(path) for p in _GATED_PATTERNS)
```

Then extend the flag-off test with a wrong-method probe and a trailing-slash probe, each
asserted equal to the unbuilt-path answer.

---

### CR-05: The `workflow-run` view is not gated on `visual_workflow_canvas` — a flag-off launch dead-ends

**File:** `frontend/src/components/layout/ChatLayout.tsx:319-331` and `:721-759`
**Also:** `frontend/src/App.tsx:102`, `frontend/src/pages/WorkflowRunPage.tsx` (whole file)
**Severity:** BLOCKER

`WorkflowBuilderPage` gates its canvas on
`featuresCtx.features.visual_workflow_canvas === true` (`WorkflowBuilderPage.tsx:243`).
The new fourth home does not: `WorkflowRunPage` reads no feature map, and `doRun` navigates
to it unconditionally. `getThreadWorkflow` is not canvas-gated, so `workflowRunId` resolves
fine even while the flag is off, and the fallback branch (`selectThread` + `chat`) is never
taken.

With `visual_workflow_canvas` off, launching a workflow therefore:

1. lands on a surface that did not exist before the canvas was built (REVERT-01 byte-identity
   broken at the layout level);
2. immediately 404s on `getWorkflowRun` — the flag-off gate — and renders
   **"That run isn't available. It may have been deleted, or it belongs to another account."**
   Both stated reasons are false; the real reason is the operator's kill switch;
3. offers only "‹ Back to Workflows" on that screen (`:554-562`). "Open the chat thread"
   lives on the loaded path only, and `doRun` never called `selectThread`, so the user's
   live run's thread is not selected either. The launched run becomes unreachable from the
   UI in the very state the kill switch is supposed to make safest.

This is a loss of shipped function under the milestone's HARD gate #1, triggered by the
operator flipping the switch the gate exists for.

**Fix:** gate the navigation, not just the render, and fall back to the shipped behaviour.

```tsx
const featuresCtx = useEffectiveFeaturesOptional()
const canvasEnabled = featuresCtx?.features.visual_workflow_canvas === true
...
if (canvasEnabled && workflowRunId) {
  setActiveRunId(workflowRunId)
  onNavigate("workflow-run")
  return
}
selectThread(thread)     // the shipped, flag-off-identical path
onNavigate("chat")
```

Add a matching flag-off assertion to `revertByteIdentical.test.tsx` (a launch with the flag
off must call `onNavigate("chat")`), and have `WorkflowRunPage` return the calm guard rather
than the misleading "belongs to another account" copy when the flag is off.

---

### CR-06: The live reconcile still paints skipped and never-run phases as Complete

**File:** `frontend/src/providers/StreamsProvider.tsx:3365-3374`
**Also fenced in place by:** `frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx:516-535`
**Severity:** BLOCKER

Plan 02 narrowed `finalizeAllPhasesForThread` for a carefully-argued reason
(`StreamsProvider.tsx:2821-2836`):

> "`skip_to_phase` marks ONLY the current phase … every phase between it and the jump target
> keeps `status='pending'` … nothing ever revisits them. So on any skip-bearing workflow this
> sweep painted a step that NEVER RAN as Complete, while a reconcile rebuilt from those same
> rows restored 'Not started': the live view and the reload disagreed … which is precisely
> what Req 4 forbids."

The identical fail-open survives one function away, in the live branch's own derivation:

```ts
status: i < current ? "done" : i === current ? "running" : "pending",
```

After a `skip_to_phase` jump (`harness_engine.py:1561-1569` marks the from-phase `skipped`
and moves `current_phase_id` to the target), `current_phase_index` is ahead of every
jumped-over row. On the live canvas, all of them satisfy `i < current` and paint
**Complete** — including the row the engine explicitly marked `skipped`, and including rows
that will never run. A reload takes the terminal branch and restores *Skipped* / *Not
started*. That is the same live-vs-reload disagreement, with the same reachability argument,
under the same requirement.

Worse, the behaviour is now *pinned*: `PhaseReconcile.test.tsx:516-535` asserts
`data[0].status === "done"` for a `pending` DB row. That test's rationale ("the DB row flips
only at `complete_phase`") is true for a sequential advance and false after a jump, so the
fence protects the fail-open rather than the property.

The DB rows are already in hand — `byIndex.get(i)` is read twice on the lines above — so the
fix needs no new data.

**Fix:** keep the forward-only floor, but never let it *upgrade* a row the DB has already
resolved to a non-`done` terminal state.

```ts
const row = byIndex.get(i)
const positional: Phase["status"] = i < current ? "done" : i === current ? "running" : "pending"
const db = row ? phaseStatusFromDb(row.status) : undefined
// The floor may only ADVANCE an unresolved row. A row the engine terminalised as
// skipped/failed is a terminal truth the counter must not overwrite (Req 4).
const status = db === "skipped" || db === "failed" ? db : positional
```

Then re-point the floor-guard test at a genuinely lagging row (a `pending` row for a phase
below `current` that has no `skipped`/`failed` mark) and add a falsifying case for the
skip-bearing shape.

## Warnings

### WR-01: A terminal run with a null `claimed_at` renders "✓ Complete … Waiting to start"

**File:** `frontend/src/pages/WorkflowRunPage.tsx:259-292` and `:491-501`
`readBand` consults `claimedAt` only in the `"active"` arm, while `elapsed` returns
`{ text: WAITING_TO_START }` for **any** status when `claimedMs == null`. The header
(`:597-602`) renders `band.sentence` and `elapsed.text` side by side, so a run that was
cancelled or failed before a worker claimed it reads `⊘ Cancelled  Waiting to start`. An
`active` unclaimed run reads `Waiting to start  Waiting to start`. The backend fixture
itself carries this shape (`test_188_workflow_run_read.py:193` — `claimed_at: None` on a
`completed` row) and the suite only ever pairs a null `claimed_at` with `status: "active"`
(`WorkflowRunPage.test.tsx:480-513`), so nothing catches it.

**Fix:** make the elapsed slot terminal-aware before it is anchor-aware.

```tsx
if (claimedMs == null) {
  return { text: isTerminal ? "— it never started processing" : WAITING_TO_START, number: null }
}
```

### WR-02: The WR-08 double-auth saving is defeated by `get_user_supabase_client`

**File:** `backend/app/api/workflow_runs.py:165-177`
**Also:** `backend/app/dependencies.py:291-296`
The handler's comment says *"Consume it — do NOT re-run the shared current-user resolver,
which would cost a 2nd GoTrue round-trip + a 2nd `auth.users` ban query per request."* The
very next parameter is `Depends(get_user_supabase_client)`, which declares
`current_user: dict = Depends(get_current_user)` — so the shared resolver runs anyway. The
route costs 2 GoTrue round-trips and 2 ban queries, exactly what `canvas_caller` was
introduced to avoid. The suite cannot see it: `test_188_workflow_run_read.py:246` overrides
`get_user_supabase_client` wholesale.

**Fix:** either add a `canvas_caller`-based client factory (reusing the already-published
identity plus `bearer_scheme`), or delete the claim from the docblock and from
`dependencies.py:637-647` so no future route is written against a saving that does not exist.

### WR-03: `onOpenThread` can silently open the wrong chat thread

**File:** `frontend/src/components/layout/ChatLayout.tsx:754-758`
```tsx
const t = threads.find((x) => x.id === tid)
if (t) selectThread(t)
onNavigate("chat")
```
When the run's thread is not in the loaded list — an org switch, a deleted thread, a list
that has not been refetched — the `selectThread` is skipped but the navigation is not, so
the user lands in chat looking at **whatever thread was previously selected**, believing it
is the run's. Silently showing a different conversation is worse than showing none.

**Fix:** `if (!t) { selectThread(null) }` before navigating, or hold the navigation and
surface "That conversation isn't loaded — refresh and try again."

### WR-04: Prototype-key lookups survive in this phase's own files, against its stated contracts

**Files:** `frontend/src/components/workflows/PhaseNode.tsx:149`,
`frontend/src/components/panel/PhaseCard.tsx:53` and `:257`,
`frontend/src/components/workflows/PhaseNodeCard.tsx:396` and `:689`
The phase built `own()` (`runVocabulary.ts:84-88`) precisely because
`TABLE[key] ?? fallback` is **not** total over `constructor` / `toString` / `__proto__`, and
documented the measured `[Function Object]`. Five sibling lookups in files this phase edited
keep the unguarded shape, and three of them carry docblocks asserting totality that the
expression does not provide:

* `ICON_TINT[data.phaseType] ?? DEFAULT_TINT` — `phaseType` is an author-supplied JSONB
  discriminator round-tripped through `_slug_to_phase_type`; a prototype key yields a
  *function* which is then string-interpolated into
  `background: radial-gradient(circle, ${tint}, …)` (`PhaseNodeCard.tsx:738`);
* `PHASE_TYPE_LABEL[phaseType] ?? UNKNOWN_PHASE_META` — same input; `meta.glyph` /
  `meta.label` then read `undefined` off `Object`;
* `VERDICT_MARK[verdict] ?? VERDICT_MARK.unknown` — under a comment that says
  *"Total by construction"*;
* `RING_STROKE[reading]` and `STATUS_META[phase.status]` — currently protected only by their
  callers being total, which is the argument `phaseState.ts:73-74` explicitly rejects
  ("totality is a property of the function, not of its current callers").

Backend `Literal[...]` validation on `phase_type` makes the first two hard to reach through
the API today, which is why this is a WARNING rather than a BLOCKER — but it is the same
"unreachable from the current callers" argument every fail-open in this file's history
shipped under.

**Fix:** route all five through `own()` (or `Object.hasOwn`), and correct the two docblocks
that currently claim totality they do not have.

### WR-05: A previous run's assertive alert survives a run switch

**File:** `frontend/src/pages/WorkflowRunPage.tsx:522-530`
`alertText` is set but never cleared. `alertedForRef` keys on `run.id`, so switching to a new
run whose status is *not* in `ALERTING_STATUSES` leaves the old run's sentence
("✕ Failed at …" / the step-limit copy) sitting in the `role="alert"` region for the new run.
It is `sr-only`, so it will not be caught visually.

**Fix:** `setAlertText(null)` in the run-switch reset block at `:322-324`, beside `setRun(null)`.

### WR-06: A run whose definition could not be read renders "v0"

**File:** `frontend/src/pages/WorkflowRunPage.tsx:583-586`
The server's documented degrade path (`api.ts:3690-3693`) is
`workflow_name: "" / workflow_slug: "" / workflow_version: 0 / definition: null`, with the
explicit instruction *"Treat an empty `workflow_name` as 'definition unavailable', never
render the empty string."* The name is guarded (`|| "Workflow"`); the version is not —
`v{run?.workflow_version}` prints **`v0`**, a version number no definition has ever had,
presented in the same mono chip as a real one.

**Fix:** `{run?.workflow_version ? <span …>v{run.workflow_version}</span> : null}`.

### WR-07: `getWorkflowRun` interpolates the id unencoded and drops its own `signal`

**File:** `frontend/src/lib/api.ts:3732-3740`; caller `frontend/src/pages/WorkflowRunPage.tsx:333`
`fetch(\`${API_BASE}/workflow-runs/${runId}\`)` performs no `encodeURIComponent`, so a
malformed id containing `/` or `?` reshapes the request path. The values in play today come
from our own state, which keeps this off the BLOCKER list — but the helper is exported and
`runId` is a plain `string`. Separately, the helper accepts a `signal` the only caller never
passes: `WorkflowRunPage` guards with a `cancelled` flag instead, so a superseded read still
runs to completion.

**Fix:** `encodeURIComponent(runId)` in the template, and thread an `AbortController` from
the effect into the existing `signal` parameter.

### WR-08: Non-terminal-but-stopped statuses tick and stay `aria-busy` forever

**File:** `frontend/src/pages/WorkflowRunPage.tsx:470-482`, `:639-643`
`isTerminal` is `TERMINAL_RUN_STATUSES.has(status)`, i.e. `completed | failed | cancelled`
(+ the dead `timed_out`). `paused`, `cap_paused` and any unrecognised status are therefore
"live": the clock keeps counting and `aria-busy="true"` never clears. A `cap_paused` run
states "Paused at the step limit — it stopped after the maximum number of steps" beside a
running clock, and a run reading "State unknown" is announced to assistive tech as
perpetually busy.

**Fix:** derive the busy/tick predicate from *motion*, not from terminality —
`const isMoving = runStatus === "active" && claimedMs != null` — and use that for both
`ticking` and `aria-busy`.

### WR-09: The SC#10 board re-implements the shipped derivation, held in sync by a comment

**File:** `scripts/sc10_188_run_board.py:118-134`
`_DB_STATUS_TO_READING` is a hand-copied Python mirror of `phaseState.ts`'s
`DB_PHASE_STATUS` + `canvasReading`, with only a comment ("the two must be changed in the
SAME COMMIT") preventing drift. That is precisely the shape SPEC Req 8 exists to eliminate,
and it means a board row can report "readings correct" against a mapping the product no
longer uses. Minor: `drive_row` reaches into `kit._fetchall`, a private helper.

**Fix:** derive the mapping from a single artefact both sides read (a small committed JSON,
or have the board shell out to the TS module), or at minimum add a check to
`scripts/check-deploy-drift.sh`-style CI that the two literal tables match.

### WR-10: The run read joins `phase_type` by slug while the page joins the spine by index

**File:** `backend/app/api/workflow_runs.py:139-155` and `:224-232`
`_slug_to_phase_type` builds a `slug -> phase_type` map and the response resolves each phase
row's type through it, while `WorkflowRunPage` joins those same rows onto the definition's
specs **by `phase_index`** (`WorkflowRunPage.tsx:426-443`) — under a docblock explaining at
length why an index join is the only safe key. Two keys for one join is a drift surface: a
definition with a repeated slug collapses the map silently, and a row whose slug the
definition no longer names degrades to `phase_type: null` (rendered as `"unknown"` at
`WorkflowRunPage.tsx:436`) even though its index resolves perfectly.

**Fix:** key the derivation on `phase_index` for consistency with the consumer, falling back
to slug only when the definition phase carries no index:

```python
by_index = {p.get("phase_index"): (p.get("config") or {}).get("phase_type")
            for p in (definition or {}).get("phases", []) or []
            if isinstance(p, dict)}
...
phase_type=by_index.get(row["phase_index"]) or slug_to_type.get(row["slug"])
```

---

_Reviewed: 2026-08-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

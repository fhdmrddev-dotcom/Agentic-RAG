# Phase 121: One Front Door for Workflows (IA) - Research

**Researched:** 2026-06-22
**Domain:** Frontend removal/simplification — React composer (chat mode controls) deletion, preserving server-truth workflow lock / 409 / reconcile
**Confidence:** HIGH (every claim traced to live code read this session; zero packages added)

## Summary

Phase 121 is a **frontend-only deletion** that removes two composer affordances — the Deep/Harness toggle (`data-testid="workflow-mode-selector"`, `MessageInput.tsx:379-425`) and the in-chat published-workflow picker (`data-testid="workflow-picker"`, `MessageInput.tsx:431-477`) — leaving a **2-pill composer** (Model + General/Explorer). The General/Explorer pill (`agent-mode-selector`, `MessageInput.tsx:329-372`) and the Model/Provider selectors stay. The Workflows page (`WorkflowsPage.tsx`, already shipped in Phase 103) becomes the single front door; its `onLaunch` → `doRun` (`ChatLayout.tsx:83-92`) already creates a NEW thread + kicks off via the existing `postMessage(..., {workflowDefinitionId})` path, so SC#2 (launch-into-Harness) works end-to-end **with the in-chat picker gone** — confirmed in live code, no new wiring needed.

The blast radius is exceptionally tight: a project-wide grep for every removed prop/testid (`workflowMode`, `onWorkflowModeChange`, `publishedWorkflows`, `selectedWorkflowId`, `onWorkflowSelect`, `displayedMode`, `workflow-mode-selector`, `workflow-picker`, `workflow-option`) matches **exactly 3 files**: `MessageInput.tsx`, `ChatArea.tsx`, and `ChatAreaMode.test.tsx`. No E2E scenario, no other component, no backend file references them. The 409/lock/reconcile machinery is **structurally independent** of the removed pills — it derives from `useWorkflowLockForThread` (reconciled from `active_workflow_run_id` via `getThreadWorkflow`), not from any composer state — so the preserve list is clean and provable.

**The one load-bearing planning finding (D-01):** the "never-vanishes status strip + Cancel" the CONTEXT and both sketches (011-A D4 / 022-A D4) describe **does not exist as drawn in the live code**. The live `RunStatusStrip`/`RunCard` render the timer/step/status but **NO Cancel button**. HOWEVER, a reachable Cancel DOES exist by a different mechanism: while a workflow run streams, `isStreaming` is `true` (the kickoff send adds the thread to `streamingThreads` at `StreamsProvider.tsx:1642`), so the composer's **`composer-stop` red Stop button renders** (`MessageInput.tsx:487-497`) and routes `stopStreaming` → `stopStream` → `cancelRun(runId)` → `DELETE /runs/{id}`. **This Stop button is independent of the removed pills and survives the removal.** So Cancel-reachability is SATISFIED at the composer today — but only while the run is actively streaming. The gap is narrow and bounded (see Open Question OQ-1).

**Primary recommendation:** Delete the two mode controls and their props end-to-end from `MessageInput.tsx`; in `ChatArea.tsx`, stop passing those props but **keep `workflowLocked` and the entire lock-reconcile block** (it gates the textarea-disable + placeholder + 409 banner, none of which depend on the pills). Verify the `composer-stop` Stop affordance renders for a locked/streaming thread as the post-removal Cancel (it does today — make it an explicit UAT assertion). Do NOT add new composer chrome (D-01). Do NOT touch `threads.py` (D-06/G-5). Update only the 3 at-risk test cases in `ChatAreaMode.test.tsx`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Composer mode pills (render/remove) | Frontend (React component) | — | `MessageInput.tsx` is pure presentation; the pills are JSX + props |
| Per-thread workflow lock derivation | Frontend (Zustand store) | API (`GET /threads/{id}/workflow`) | Lock is reconciled client-side from the server's `active_workflow_run_id`; the truth lives in the DB, the derivation is client |
| 409 illegal-switch enforcement | API/Backend (`threads.py`) | Frontend (banner render) | Server returns 409; frontend renders the verbatim copy in `workflow-lock-error-banner` — **backend untouched this phase (D-06)** |
| Workflow launch (create thread + kickoff) | Frontend (`ChatLayout.doRun`) | API (`POST /threads`, `POST /threads/{id}/messages`) | Launch orchestration is client; the atomic `active_workflow_run_id` set is server-side in the existing kickoff path |
| Run cancel (Stop) | Frontend (composer Stop / tray) | API (`DELETE /runs/{id}`) | Stop affordance is client UI; the durable cancel is `cancelRun` → DELETE |

**Why this matters:** Every capability Phase 121 touches sits in the **Frontend tier**. The only API surface in play is *read-only consumption* of existing endpoints (`getThreadWorkflow`) and *unchanged* invocation of existing kickoff/cancel routes. There is no tier-crossing change — which is exactly what D-02 (UI-only removal) and D-06 (no `threads.py` growth) require. Any plan task that proposes a backend edit is mis-assigned and violates the phase boundary.

## Standard Stack

This phase adds **zero** new libraries. It edits existing React/TypeScript components within the already-established stack.

### Core (already present — versions verified from `frontend/package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | (project) | Component framework | The composer is React; removal is JSX/prop deletion |
| Vitest | ^4.1.0 | Unit test runner | `npm run test` = `vitest run`; the existing test infra |
| @testing-library/react | ^16.3.2 | Component testing | `ChatAreaMode.test.tsx` uses `render`/`screen`/`within` |
| Zustand | (project) | State store | `useWorkflowLockForThread` + `streamingThreads` selectors live in `StreamsProvider.tsx` |

### Alternatives Considered
None applicable — this is a deletion within a fixed stack. There is no library choice to make.

**Installation:** None. No `npm install`. No new dependency.

## Package Legitimacy Audit

**Not applicable** — Phase 121 installs **zero external packages**. It is a frontend deletion of existing JSX and props plus a test update. No `npm install`, no PyPI/crates, no `package.json` dependency change.

**Packages removed due to slopcheck [SLOP] verdict:** none (no package operations)
**Packages flagged as suspicious [SUS]:** none (no package operations)

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
                          │  Workflows page (single front door, D-04)   │
                          │  WorkflowsPage.tsx — PublishedCard ▶ Run    │
                          │  → RunModal (kickoff textarea)              │
                          └───────────────────┬─────────────────────────┘
                                              │ onLaunch(def, kickoff)
                                              ▼
                          ┌─────────────────────────────────────────────┐
                          │  ChatLayout.doRun  (ChatLayout.tsx:83-92)   │
                          │  1. createThread(def.name)   ← NEW thread   │
                          │  2. postMessage(tid, kickoff,               │
                          │       {workflowDefinitionId})  ← kickoff    │
                          │  3. selectThread(thread)                    │
                          │  4. onNavigate("chat")                      │
                          └───────────────────┬─────────────────────────┘
                                              │  server sets active_workflow_run_id
                                              ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  ChatArea.tsx (the thread surface)                                         │
   │                                                                            │
   │  mount reconcile (L178-204): getThreadWorkflow(tid)                        │
   │     → locked && !stale && active_workflow_run_id                           │
   │         → setWorkflowLockForThread(tid, {...})   ◄── SERVER TRUTH          │
   │     → else clearWorkflowLockForThread(tid)                                 │
   │                                                                            │
   │  workflowLocked = useWorkflowLockForThread(tid) !== null   (L95-96)        │
   │  isStreaming   = useStreamingForThread(tid)               (L78)            │
   │                                                                            │
   │  409 banner (L519-561): reconcileError.status===409                        │
   │     → data-testid="workflow-lock-error-banner"  ◄── SC#3 signal           │
   │                                                                            │
   │  ┌──────────────────────────────────────────────────────────┐            │
   │  │ MessageInput.tsx (the composer) — PROP SEAM (removal pt)  │            │
   │  │                                                          │            │
   │  │  REMOVE: workflow-mode-selector (Deep/Harness toggle)    │            │
   │  │  REMOVE: workflow-picker (published-workflow picker)     │            │
   │  │  KEEP:   agent-mode-selector (General/Explorer)          │            │
   │  │  KEEP:   Model + Provider selectors → 2 pills total      │            │
   │  │  KEEP:   workflowLocked → textarea.disabled + placeholder│            │
   │  │  KEEP:   composer-stop (red Stop, renders iff disabled/  │            │
   │  │          isStreaming) → onStop → stopStreaming → cancelRun│  ◄── the   │
   │  └──────────────────────────────────────────────────────────┘    Cancel  │
   └────────────────────────────────────────────────────────────────────────────┘
```

Trace the primary use case (SC#2): a user clicks **Run** on the Workflows page → `doRun` makes a new thread + kicks off → server sets `active_workflow_run_id` → ChatArea reconcile sets the per-thread lock → composer disables + shows the running placeholder → the run streams (Stop button reachable) → on terminal, reconcile clears the lock → composer returns to normal Deep chat. **None of this path touches the removed pills.**

### Recommended Edit Structure (not new files — edits to existing)
```
frontend/src/components/chat/
├── MessageInput.tsx       # DELETE: 2 mode controls + 6 props + WorkflowOption interface
│                          #         + unused lucide imports (Workflow, Sparkles, Layers-if-orphaned)
│                          # KEEP:   agent-mode-selector, model/provider, workflowLocked gating,
│                          #         composer-stop, per-thread drafts, handleSend lock-gate
├── ChatArea.tsx           # DELETE: workflowMode/setWorkflowMode useState (L70), picker feed
│                          #         (publishedWorkflows/selectedWorkflowId), the 6 prop pass-throughs
│                          #         (L409-420), kickoffWorkflowId branch in handleSend (L328-355)
│                          # KEEP:   workflowLock/workflowLocked (L95-96), the FULL mount reconcile
│                          #         (L178-204), the 409 banner (L519-561), isStreaming, stopStreaming
└── __tests__/
    └── ChatAreaMode.test.tsx   # UPDATE: 3 tests assert the removed workflow-mode-selector pill
```

### Pattern 1: Mode is server truth — there is no pill left to mislabel
**What:** The displayed mode label currently comes from `displayedMode` (`ChatArea.tsx:417` passes `workflowLocked ? "harness" : "deep"`), derived from the reconciled lock — never the stale local `workflowMode` toggle. Removing the toggle removes the **only place that label rendered at the composer**, killing "finding #5" by construction.
**When to use:** Always — this is the locked design (sketch 011-A D2/D-092-UX).
**Evidence:**
```typescript
// ChatArea.tsx:95-96 — the lock is reconciled server truth, NOT composer state
const workflowLock = useWorkflowLockForThread(thread?.id ?? null)
const workflowLocked = workflowLock !== null
// ChatArea.tsx:417 — displayedMode derives from the lock; after removal this prop is deleted
// but workflowLocked itself stays (it gates the disable + placeholder).
```

### Pattern 2: The launch path is page/panel-driven and already complete
**What:** `doRun` (`ChatLayout.tsx:83-92`) is the launch primitive. It reuses `createThread` + `postMessage(..., {workflowDefinitionId})` — the SAME server kickoff the in-chat picker used. The picker was a second, redundant entry to the same path.
**When to use:** SC#2 verification — this is the surviving launch.
**Evidence:** `ChatLayout.tsx:85-89` (verbatim): `createThread(def.name)` → `postMessage(thread.id, kickoff, { workflowDefinitionId: def.id })` → `selectThread(thread)` → `onNavigate("chat")`. D-02's "keep the server send-with-`workflow_definition_id` path as harmless dead code" refers to the `kickoffWorkflowId`-on-send branch in `ChatArea.handleSend` (L328-355) — once the picker is gone, `selectedWorkflowId` is always null so that branch is dead. **The server route itself (`postMessage` with `workflowDefinitionId`) stays LIVE because `doRun` still uses it.** (This is a subtle point the planner must get right — see "Don't Hand-Roll" and Open Question OQ-2.)

### Anti-Patterns to Avoid
- **Adding a new composer status chip with Cancel (the sketch 011-A/022-A `.runchip`):** D-01 explicitly forbids new composer chrome. The sketches DRAW a new `.runchip`, but CONTEXT D-01 overrides them: reuse existing affordances only. The existing `composer-stop` Stop button IS the Cancel (see Cancel-Reachability Verdict). Building the `.runchip` would be net-new construction in a removal phase and would re-touch the composer's render surface.
- **Deleting the server kickoff route or the `doRun` `postMessage(...workflowDefinitionId)` call:** that is launch itself (SC#2). D-02 keeps the server path; only the *in-chat picker's* send-staging is dead.
- **Touching `threads.py` or any backend file:** G-5/D-06. This phase is frontend-only.
- **Removing `workflowLocked` from `MessageInput` props:** it gates the textarea disable + placeholder + Send lock (`MessageInput.tsx:161,179,210,212`). It is NOT a removed pill — it stays.
- **Keeping `displayedMode` "just in case":** it has exactly one consumer (the removed Deep/Harness pill's label). Once the pill is gone, `displayedMode`/`labelMode` (`MessageInput.tsx:62,120`) are dead — delete them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A Cancel affordance for a locked thread | A new `.runchip` status chip + Cancel button above the composer | The existing `composer-stop` red Stop button (`MessageInput.tsx:487-497`) | It already renders while `isStreaming` (true during a run) and already routes to the durable `cancelRun` → DELETE /runs/{id}. D-01 forbids new chrome. |
| Launch-into-Harness from the page | A bespoke `/workflows/{id}/run` route or new kickoff plumbing | The existing `doRun` (`ChatLayout.tsx:83-92`) → `postMessage(..., {workflowDefinitionId})` | Already shipped + live in Phase 103. The picker was a duplicate entry to this same path. |
| Per-thread lock state | Re-derive lock from composer state | `useWorkflowLockForThread` (reconciled from `active_workflow_run_id`) | Already the single source of truth; removing the pills doesn't touch it. |
| 409 illegal-switch UX | Client-side switch prevention | The server 409 + the `workflow-lock-error-banner` render (`ChatArea.tsx:519-561`) | The client disable is a courtesy; the server 409 is the authority (`MessageInput.tsx:158-161` comment). |

**Key insight:** Every "capability" this phase might seem to need (Cancel, launch, lock, 409) **already exists and survives the deletion untouched**. The work is pure subtraction. The trap is *adding* something (the sketch's `.runchip`) that D-01 forbids — the planner must treat the sketches' new-chip drawing as superseded by D-01's "reuse only."

## Runtime State Inventory

> This is a frontend-only removal with no stored data, no service config, no OS state, no secrets, no build artifacts. Each category verified.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — no DB row, collection, or key stores the removed pill state. `workflowMode`/`selectedWorkflowId` are ephemeral React `useState` (`ChatArea.tsx:70,72`), reset on every thread switch (`ChatArea.tsx:145-146`). Verified by reading the component. | None |
| Live service config | **None** — no external service (n8n/Datadog/etc.) references the composer toggle. This is in-app React only. | None |
| OS-registered state | **None** — no Task Scheduler / pm2 / systemd registration. Frontend component code. | None |
| Secrets/env vars | **None** — no env var or secret names the toggle/picker. | None |
| Build artifacts | **None** — no compiled binary or egg-info carries the removed names. A normal Vite rebuild picks up the source change. The removed `lucide-react` icon imports (`Workflow`, `Sparkles`, possibly `Layers`) should be cleaned to avoid an unused-import lint error, but that is source hygiene, not a stale artifact. | Remove now-unused imports during the edit (lint will flag them) |

**The canonical question — "after every file is updated, what runtime systems still have the old state?":** Nothing. The removed state is per-render React `useState`; there is no persistence, no cache, no registration. A page reload after deploy shows the 2-pill composer with zero residue.

## Common Pitfalls

### Pitfall 1: Deleting `workflowLocked` along with the removed pills
**What goes wrong:** `workflowLocked` looks like part of the workflow-mode prop cluster, but it is the load-bearing gate for the disabled composer + the "Workflow running — Cancel to switch back" placeholder + the Send-disable. Deleting it un-disables the composer during a run → SC#3 regression (a locked thread could send a Deep message).
**Why it happens:** Six removed props (`workflowMode`/`onWorkflowModeChange`/`publishedWorkflows`/`selectedWorkflowId`/`onWorkflowSelect`/`displayedMode`) sit visually adjacent to `workflowLocked` in the props block (`MessageInput.tsx:54-72`). It is easy to sweep all seven.
**How to avoid:** Treat `workflowLocked` as a KEEP. It is consumed at `MessageInput.tsx:116,161,179,210,211,212` — none of those are the removed pills.
**Warning signs:** The 409 banner test or a "locked thread cannot send" test fails; the placeholder no longer swaps to the running copy.

### Pitfall 2: Severing the server kickoff route, thinking it's "dead code"
**What goes wrong:** D-02 says "keep the server send-with-`workflow_definition_id` path as harmless dead code." A literal reading might delete the `postMessage(..., {workflowDefinitionId})` call. But `doRun` (the surviving launch, SC#2) uses exactly that call. Deleting it breaks launch entirely.
**Why it happens:** Two different things share the name "workflow_definition_id send": (a) the in-chat picker's `kickoffWorkflowId`-on-send staging in `ChatArea.handleSend` (L328-355) — THIS becomes dead; (b) the `doRun` page launch's `postMessage` — THIS stays live.
**How to avoid:** The dead code is only the `kickoffWorkflowId` branch inside `ChatArea.handleSend` (which reads the removed `selectedWorkflowId`). The `api.ts` `postMessage` function + the backend route stay. Delete (a)'s staging logic; do not touch the `postMessage` API function or the backend.
**Warning signs:** Clicking Run on the Workflows page no longer starts a workflow (SC#2 fails).

### Pitfall 3: Assuming the "never-vanishes status strip + Cancel" exists as the sketch draws it
**What goes wrong:** CONTEXT D-01 and sketches 011-A/022-A describe a status strip with a Cancel button. A plan that assumes this renders today and "just needs the pill removed" is wrong — the live `RunStatusStrip`/`RunCard` have NO Cancel. If the plan relies on a non-existent Cancel, the verifier finds a locked thread with no visible stop once the run's streaming flag flips.
**Why it happens:** The sketch is a target-state mockup; the live code shipped the timer/step honesty parts of 015-C/095 but NOT the Cancel chip.
**How to avoid:** The reachable Cancel is the composer's `composer-stop` Stop button (renders while `isStreaming`). Make its reachability an explicit UAT assertion. If the operator wants the slim status-strip+Cancel chip, that is net-new and contradicts D-01 — surface it as Open Question OQ-1, do not silently build it.
**Warning signs:** A reviewer asks "where does the user click to cancel a running workflow?" and the answer requires the run to be actively streaming.

### Pitfall 4: Leaving orphaned `lucide-react` imports → lint failure
**What goes wrong:** `MessageInput.tsx:4` imports `Workflow`, `Sparkles`, `Layers`, `Compass`, `Cpu`, etc. After removing the toggle (uses `Workflow`, `Sparkles`) and picker (uses `Layers`, `Workflow`), some icons become unused. `npm run lint` (eslint) flags unused imports.
**Why it happens:** Removal leaves dangling imports.
**How to avoid:** After deleting the controls, remove now-unused icon imports. `Layers` is also used by the Provider selector (`MessageInput.tsx:234,249,260`), so keep it; `Workflow` and `Sparkles` are only used by the removed controls — remove them. Verify with a grep after editing.
**Warning signs:** `npm run lint` errors on `no-unused-vars` / `Workflow is defined but never used`.

## Code Examples

### The surviving Cancel (composer Stop) — what proves Cancel-reachability
```typescript
// MessageInput.tsx:487-497 — renders WHEN `disabled` (which === isStreaming from ChatArea:385).
// During a workflow run, isStreaming is true (StreamsProvider.tsx:1642 adds the thread to
// streamingThreads on kickoff), so this Stop button IS the reachable Cancel for a locked thread.
{disabled ? (
  <Button onClick={onStop} size="icon" variant="outline" aria-label="Stop generation"
    data-testid="composer-stop" className="...border-destructive/40 text-destructive...">
    <Square className="h-3.5 w-3.5 fill-current" />
  </Button>
) : ( /* send button */ )}
```
```typescript
// ChatArea.tsx:384 — onStop wires to stopStreaming → StreamsProvider stopStream → cancelRun(runId).
onStop={stopStreaming}
// StreamsProvider.tsx:1950-1970 stopStream: finds the streaming run, calls `await cancelRun(runId)`
// (DELETE /runs/{id}) — the one durable cancel path. The ActiveRunsTray (NavPanel) is a
// second reachable Stop for backgrounded runs (ActiveRunsTray.tsx:127-133, stopThread→cancelRun).
```

### The 409 lock banner — the SC#3 signal (PRESERVE verbatim)
```typescript
// ChatArea.tsx:519-561 — renders the server's 409 copy under data-testid="workflow-lock-error-banner".
// NON_RETRYABLE includes 409 (L84) so no Retry button shows. PRESERVE entirely; the removal
// must not change this.
{reconcileError && (
  <div data-testid={reconcileError instanceof ApiError && reconcileError.status === 409
        ? "workflow-lock-error-banner" : "reconcile-error-banner"} ...>
    <span>{reconcileError instanceof ApiError ? reconcileError.message : "...cached version."}</span>
    ...
  </div>
)}
```

### The mount reconcile — server-truth lock (PRESERVE verbatim)
```typescript
// ChatArea.tsx:178-204 — the SOURCE OF TRUTH reconcile (never a stale SSE hint, CLAUDE.md
// Realtime-is-a-hint rule). Sets/clears the per-thread lock from getThreadWorkflow. PRESERVE.
getThreadWorkflow(tid, controller.signal).then((state) => {
  if (state.locked && !state.lock_is_stale && state.active_workflow_run_id) {
    streamActions.setWorkflowLockForThread(tid, { runId: state.active_workflow_run_id, mode: "harness", ... })
  } else { streamActions.clearWorkflowLockForThread(tid) }
})
```

## The Removal Seams (concrete file:line — verified live)

### `frontend/src/components/chat/MessageInput.tsx`

**DELETE:**
| What | Line(s) | Notes |
|------|---------|-------|
| `WorkflowOption` interface | L21-26 | Only used by `publishedWorkflows` prop |
| `workflowMode` / `onWorkflowModeChange` props | L54-55 | Removed pill state |
| `displayedMode` prop | L62 | Only consumer is the removed Deep/Harness label |
| `publishedWorkflows` prop | L63-64 | Removed picker feed |
| `selectedWorkflowId` / `onWorkflowSelect` props | L65-67 | Removed picker staging |
| Destructure defaults for the above | L110-113, L116 (keep `workflowLocked`) | In the function signature |
| `labelMode` derivation | L120 | `displayedMode ?? workflowMode` — dead once both gone |
| **Deep/Harness toggle block** | **L374-425** | `data-testid="workflow-mode-selector"` |
| **Workflow picker block** | **L427-477** | `data-testid="workflow-picker"` + `workflow-option-${slug}` |
| Now-unused icon imports | L4 (`Workflow`, `Sparkles`) | `Layers` STAYS (Provider selector); `Compass`/`Cpu`/`ArrowUp`/`ChevronDown`/`Square` STAY |

**KEEP (do NOT delete):**
| What | Line(s) | Why |
|------|---------|-----|
| `workflowLocked` prop + default | L68-72, L116 | Gates textarea disable + placeholder + Send |
| `agent-mode-selector` (General/Explorer) | L329-372 | One of the two surviving pills |
| Provider + Model selectors | L224-324 | The Model pill (provider folds in) |
| `handleSend` lock-gate | L158-161 | `if (!trimmed || disabled || workflowLocked) return` |
| `canSend` lock-gate | L179 | `!disabled && !workflowLocked && ...` |
| Locked placeholder + title | L210-212 | "Workflow running — Cancel to switch back" |
| `composer-stop` Stop button | L487-497 | **The reachable Cancel (D-01)** |
| Per-thread drafts machinery | L83-93, L124-140 | Unrelated to the removed pills |

### `frontend/src/components/chat/ChatArea.tsx`

**DELETE:**
| What | Line(s) | Notes |
|------|---------|-------|
| `workflowMode` / `setWorkflowMode` useState | L70 | The launch toggle state |
| `publishedWorkflows` / `setPublishedWorkflows` useState | L71 | Picker feed state |
| `selectedWorkflowId` / `setSelectedWorkflowId` useState | L72 | Picker staging state |
| `setWorkflowMode("deep")` + `setSelectedWorkflowId(null)` in thread-switch effect | L145-146 | Reset for removed state |
| `listPublishedWorkflows` mount fetch effect | L166-171 | Feeds the removed picker |
| `kickoffWorkflowId` branch in `handleSend` | L328-355 | Reads removed `selectedWorkflowId`; becomes dead (the `requestOpenPanel()` panel-open on harness send goes with it — but VERIFY whether the page-launch path needs panel-open; see OQ-2) |
| The 6 prop pass-throughs to `MessageInput` | L409-420 (`workflowMode`, `onWorkflowModeChange`, `displayedMode`, `publishedWorkflows`, `selectedWorkflowId`, `onWorkflowSelect`) | Stop passing removed props |
| `listPublishedWorkflows` / `PublishedWorkflow` import | L18,20 | If no other consumer remains (verify) |

**KEEP (the PRESERVE LIST — provable SC#2/SC#3):**
| What | Line(s) | Why (SC) |
|------|---------|----------|
| `workflowLock` / `workflowLocked` derivation | L95-96 | Lock truth — SC#3 |
| **The FULL mount reconcile** (`getThreadWorkflow` → set/clear lock) | **L178-204** | Survives reload; SC#2/SC#3/SC#5 |
| `active_workflow_run_id` read in reconcile | L185 | The server-truth anchor |
| 409 lock banner + `NON_RETRYABLE` set | L84-86, L519-561 | SC#3 — the 409 signal |
| `isStreaming` derivation | L78 | Drives composer disable + Stop button |
| `stopStreaming` destructure + `onStop` wiring | L54, L384 | The Cancel route |
| `handleSend` thread-create + `sendMessage` (minus kickoff branch) | L312-356 | Normal Deep send still works |
| `workflowLocked` pass-through to `MessageInput` | L421 | KEEP — gates the disable |

## The Preserve List (crisp — for SC#2 + SC#3 proof)

The executor must prove these are **byte-unchanged in behavior** after the removal:

1. **`workflowLocked` derivation** — `ChatArea.tsx:95-96`. `useWorkflowLockForThread(thread?.id) !== null`. Independent of removed pills.
2. **The mount reconcile** — `ChatArea.tsx:178-204`. `getThreadWorkflow(tid)` → `setWorkflowLockForThread` / `clearWorkflowLockForThread`. Reads `state.locked && !state.lock_is_stale && state.active_workflow_run_id`. CLAUDE.md "reconcile-on-(re)connect, Realtime is a hint" rule. **Survives page reload (SC#5).**
3. **The 409 illegal-switch path** — server returns 409; `ChatArea.tsx:519-561` renders `workflow-lock-error-banner` with the verbatim copy + no Retry (`NON_RETRYABLE` has 409). **Backend untouched (D-06).**
4. **The disabled composer + placeholder** — `MessageInput.tsx:210-212` (placeholder), `:212` (`disabled={disabled || workflowLocked}`), `:161,179` (Send gate).
5. **The reachable Cancel** — `MessageInput.tsx:487-497` `composer-stop` renders while `isStreaming`; routes `onStop` → `stopStreaming` → `cancelRun` → DELETE /runs/{id}. Plus `ActiveRunsTray` (`NavPanel`) as the cross-thread Stop.
6. **The launch path (SC#2)** — `ChatLayout.doRun` (L83-92): `createThread` → `postMessage(..., {workflowDefinitionId})` → `selectThread` → `onNavigate("chat")` → ChatArea reconcile → composer lock. **Unchanged by the removal.**
7. **The cap_paused Continue card** — `MessageItem.tsx:418-474` (reads `workflowLock?.capPaused`). On the G-5 hot-file `MessageItem.tsx` but NOT re-touched (sketch 011-A D5 + composer-and-mode.md note). **Do not edit `MessageItem.tsx`.**

## Cancel-Reachability Verdict (D-01 — the load-bearing finding)

**Question:** After the Harness pill is removed, is a **Cancel** affordance actually reachable for a workflow-locked thread?

**Verdict: YES — but NOT via the "never-vanishes status strip + Cancel" the sketches draw (which does not exist in live code). The reachable Cancel is the composer's existing `composer-stop` red Stop button.**

**Evidence chain (all verified live this session):**
1. The CONTEXT/sketch-described "never-vanishes run-status strip + Cancel from Phase 103/095" **is not in the code as drawn.** `RunStatusStrip.tsx` renders `⏱ elapsed · Step N · activity` — **no Cancel/Stop control** (read in full; lines 42-116). `RunCard.tsx` hosts the strip in its header — **no Cancel** (read in full; lines 250-463). `ChatArea` renders a `StickyTimerBar` (L574-577, L586-638) — elapsed/step/file/description, **no Cancel**.
2. **The reachable Cancel that DOES exist:** while a workflow run streams, `isStreaming === true`. Proven: a kickoff send goes through the same `sendMessage` SSE path, which adds the thread to `streamingThreads` (`StreamsProvider.tsx:1640-1642`, `streamingThreads: new Set(s.streamingThreads).add(threadId)`). `ChatArea.tsx:78` reads `isStreaming = useStreamingForThread(thread?.id)` and passes it as `disabled` to `MessageInput` (L385). With `disabled` true, `MessageInput.tsx:487-497` renders the `composer-stop` red Stop button. `onStop` = `stopStreaming` (`ChatArea.tsx:384`) → `stopStream` → `await cancelRun(runId)` → DELETE /runs/{id} (`StreamsProvider.tsx:1950-1970`).
3. **This Stop button is independent of the removed pills** — it lives in the right-side toolbar (`MessageInput.tsx:481-513`), not in the deleted left-side mode-control cluster. It survives the removal untouched.
4. **Component(s) that own Cancel after removal:** primary = `MessageInput.tsx` `composer-stop` (L487-497) → `ChatArea.stopStreaming` → `StreamsProvider.stopStream`/`cancelRun`. Secondary (cross-thread, always reachable) = `ActiveRunsTray.tsx` (L127-133) `stopThread` → `cancelRun`, mounted in `NavPanel.tsx:336`.

**The narrow residual gap (→ OQ-1):** the `composer-stop` Stop renders only while `isStreaming` is true. If a thread is *workflow-locked but not actively streaming* (e.g. a `cap_paused` pause where the producer stream has ended, or a reload of a locked-but-idle run), `isStreaming` may be false → the Stop button is NOT shown, and the composer shows the disabled "Workflow running — Cancel to switch back" placeholder **with no visible Cancel control**. In that state:
- `cap_paused` has its own escape: the inline **Continue card** (`MessageItem.tsx:418-474`) lets the user continue or start a new message; the placeholder copy is the only "stuck" signal.
- This is the **exact** "fix the receipt, not a new composer chip" scenario D-01 anticipates. Per D-01, if this gap is real and operator-visible in SC#10 UAT, the fix is to the run receipt (e.g. make the Stop reachable from the status strip / surface a Cancel when locked-but-not-streaming), **NOT** a duplicate composer chip. **This is a planning decision the planner must surface, not silently resolve.**

**Recommendation for the planner:** treat Cancel-reachability as SATISFIED for the common case (locked + streaming → `composer-stop` visible). Add an explicit SC#10/G-4 UAT row that drives "launch a workflow, observe a reachable Stop, click it, confirm the run cancels." Flag the locked-but-not-streaming edge as OQ-1 for operator decision — do not build the sketch's `.runchip` (D-01 forbids new chrome).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 3 mode controls in composer (agent-mode + Deep/Harness toggle + picker) | 2-pill composer (Model + General/Explorer); launch from Workflows page | Phase 121 (this) | The composer pill consolidation was DESIGNED in Phase 094 but never shipped — live code still renders all three. This phase ships the design. |
| Mode label from client `workflowMode` toggle (finding #5: could mislabel) | Mode = server truth (`active_workflow_run_id`); no composer pill to mislabel | Phase 094 (`displayedMode`) → fully realized when the pill is removed (121) | finding #5 dies by construction (no label left to drift) |

**Deprecated/outdated by this phase:**
- The in-chat Deep/Harness toggle (`workflow-mode-selector`) — replaced by "Deep is the resting default; launch = leave the composer."
- The in-chat workflow picker (`workflow-picker`) — replaced by the Workflows page's `PublishedCard ▶ Run` → `RunModal`.
- `displayedMode`/`labelMode`/`WorkflowOption` — orphaned once the pill is gone.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | All claims verified against live code read this session — file:line cited throughout. | — | — |

**This table is empty:** Every factual claim in this research was verified by reading the live source files (`MessageInput.tsx`, `ChatArea.tsx`, `ChatLayout.tsx`, `WorkflowsPage.tsx`, `RunCard.tsx`, `RunStatusStrip.tsx`, `ActiveRunsTray.tsx`, `StreamsProvider.tsx`, `api.ts`, `MessageItem.tsx`, the test files) plus project-wide grep. No claim rests on training data or unverified inference. No user confirmation is needed before planning **except** the two Open Questions below, which are genuine design forks (not unverified facts).

## Open Questions (RESOLVED)

> Both OQs are dispositioned below — neither is a blocking uncertainty; recorded for plan-time / UAT traceability.

1. **OQ-1 [D-01 follow-up] — Cancel for a locked-but-NOT-streaming thread.** — **RESOLVED:** kept as a VALIDATION.md manual UAT observation row; plans add NO new composer chip (D-01). If UAT shows real pain, the D-01-compliant fix is to the run receipt/status strip, not the composer.
   - What we know: While streaming, `composer-stop` is the reachable Cancel. While locked-but-not-streaming (cap_paused with ended producer stream, or a reload of an idle locked run), `isStreaming` may be false → no visible Stop; only the disabled placeholder shows.
   - What's unclear: Is this a real operator-visible pain after the pill is gone? Does the existing Continue card (for cap_paused) cover the only realistic stuck state?
   - Recommendation: **Do not pre-build a fix.** Add a SC#10/G-4 UAT row to observe this state. If pain is real, the D-01-compliant fix is to the run receipt/status strip (surface a Cancel when locked), NOT a new composer chip. Surface to the operator at plan-time as a scoped decision.

2. **OQ-2 — Panel-open on launch (the `requestOpenPanel()` in `handleSend`).** — **RESOLVED:** out-of-scope for IA-01. Plan 01 confirmed `doRun` does NOT call `requestOpenPanel` and the panel rail is always present (the spine stays reachable). Any auto-open is a small additive in `doRun`/ChatLayout for a later phase, NOT a composer change this phase.
   - What we know: `ChatArea.handleSend` (L333-340) calls `requestOpenPanel()` on the harness branch (when `kickoffWorkflowId` is set) so the workspace panel auto-opens to the phase timeline. This branch reads the removed `selectedWorkflowId` and becomes dead. The page-launch path (`doRun`) does NOT call `requestOpenPanel`.
   - What's unclear: After removal, does launching from the Workflows page still auto-open the panel to the phase spine (sketch 022-A: "the panel owns the live spine")? The in-chat kickoff used to trigger it; `doRun` may not.
   - Recommendation: Verify whether `doRun` / ChatLayout already opens the panel on harness navigation (the panel rail is always present per panel-shell.md D4, so the spine is reachable regardless). If the auto-open is desired UX and `doRun` lacks it, that is a small additive in `doRun` / ChatLayout — NOT a composer change. Flag for the planner to confirm scope (likely out-of-scope for IA-01, but worth a one-line check so launch-into-Harness doesn't feel degraded vs. the old picker path).

## Environment Availability

> Frontend code/test-only change — no external runtime dependency beyond the existing dev toolchain (already installed and in daily use).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm | build/lint/test | ✓ | (project) | — |
| Vitest | unit tests | ✓ | ^4.1.0 (package.json) | — |
| @testing-library/react | component tests | ✓ | ^16.3.2 | — |
| Playwright | E2E (SC#10 backstop) | ✓ | (project `e2e` script) | manual Chrome MCP UAT |
| Running backend + Supabase + Redis | live SC#10 UAT (cross-provider launch) | assumed (dev infra auto-starts per CLAUDE.md) | local :54322 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — the SC#10 long-message + cross-provider axes stay manual Chrome MCP UAT per the project's standing recipe.

## Validation Architecture

> Nyquist validation is ENABLED for this phase. This section maps each Success Criterion to an observable test oracle.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 (unit/component) + Playwright (E2E backstop) |
| Config file | `frontend/vitest.config.ts` (jsdom env, `setupFiles: ./src/setupTests.ts`, excludes `tests/e2e/**`) |
| Quick run command | `cd frontend && npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx src/components/chat/__tests__/ChatAreaBanner.test.tsx` |
| Full suite command | `cd frontend && npm run test` (`vitest run`) |
| E2E command | `cd frontend && npm run e2e` (`playwright test`) |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | Oracle (observable signal) | File Exists? |
|----------|----------|-----------|-------------------|----------------------------|-------------|
| SC#1 (IA-01) | Composer shows exactly 2 pills; no `workflow-mode-selector`, no `workflow-picker` | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx` | `screen.queryByTestId("workflow-mode-selector")` is null; `queryByTestId("workflow-picker")` is null; `getByTestId("agent-mode-selector")` present; model/provider pill present | ⚠️ Wave 0 — rewrite the 3 existing tests (they currently ASSERT the pill exists) |
| SC#1 | The only launch entry is the Workflows page | unit | `npx vitest run src/pages/WorkflowsPage.test.tsx` | `published-run` button present; composer has no picker (covered by SC#1 above) | ✅ (WorkflowsPage.test.tsx exists) |
| SC#2 | Launch still works: page Run → new thread → Harness lock | E2E + manual | `npm run e2e` (new scenario) + Chrome MCP | After `doRun`, `getThreadWorkflow` returns `mode:"harness"`, `active_workflow_run_id` set; composer disabled; placeholder = running copy | ⚠️ Wave 0 — add an E2E scenario or assert `doRun` path in a ChatLayout test |
| SC#2 | Launched thread toggles into Harness + Continues | manual (SC#10) | Chrome MCP live UAT | Thread shows Harness lock; cap_paused → Continue card; Continue resumes | manual |
| SC#3 | Server 409 on illegal switch unchanged | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaBanner.test.tsx` | Test (b) already asserts 409 → `workflow-lock-error-banner` + no Retry. Must stay GREEN unchanged. | ✅ (ChatAreaBanner.test.tsx test b) |
| SC#3 | Disabled composer + placeholder preserved | unit | `npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx` (add) | With `workflowLocked`, textarea `disabled` + placeholder "Workflow running — Cancel to switch back"; Send gated | ⚠️ Wave 0 — add a preserve-assertion |
| SC#3 | Reconcile-on-mount sets/clears lock from server truth | unit | `npx vitest run src/components/chat/__tests__/ChatAreaBanner.test.tsx` (extend) | `getThreadWorkflow` mock with `locked:true` → composer disabled; `locked:false` → enabled | ✅ infra exists (ChatAreaBanner mocks `getThreadWorkflow`); add a lock case |
| Cancel (D-01) | A reachable Stop renders for a locked+streaming thread | unit + manual | `npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx` (add) | With `disabled`/streaming, `getByTestId("composer-stop")` present; click → `onStop` called | ⚠️ Wave 0 — add Cancel-reachability assertion |
| no-regression | RunCard timer/model tests unaffected | unit | `npx vitest run src/components/chat/RunCard.timer.test.tsx src/components/chat/RunCard.test.tsx` | Stay GREEN untouched — **zero coupling to removed props** (verified: these files reference no workflow toggle/picker/prop) | ✅ (must NOT need edits — confirms CONTEXT's "RunCard.timer.test.tsx to update" is actually NOT impacted) |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run src/components/chat/__tests__/ChatAreaMode.test.tsx src/components/chat/__tests__/ChatAreaBanner.test.tsx` (the directly-impacted component tests; < 30s).
- **Per wave merge:** `cd frontend && npm run test` (full vitest suite — catches any cross-component fallout; the grep proved only 3 files reference the removed symbols, so fallout risk is near-zero but the full run is the floor).
- **Phase gate:** full vitest suite GREEN + the 3 ChatAreaMode tests rewritten GREEN + SC#10 4-axis manual UAT (below) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `ChatAreaMode.test.tsx` — **rewrite** all 3 tests: they currently assert `workflow-mode-selector` renders the right label (D-02 finding #5). Post-removal they must assert the pill is GONE, the picker is GONE, `agent-mode-selector` stays, and add a Cancel-reachability assertion + a `workflowLocked` preserve assertion. Covers SC#1 + Cancel + SC#3-preserve.
- [ ] `ChatAreaBanner.test.tsx` — **extend** (do not rewrite): test (b) 409 stays green unchanged; ADD a reconcile-lock case (`getThreadWorkflow` mock `locked:true` → composer disabled). Covers SC#3 reconcile.
- [ ] SC#2 launch path — **add** either a `ChatLayout`/`WorkflowsPage` integration test asserting `doRun` calls `createThread` + `postMessage({workflowDefinitionId})` + `onNavigate("chat")`, OR a Playwright scenario. (`doRun` is currently only exercised via live UAT.)
- [ ] Framework install: **none** — vitest/RTL/playwright already present.

*Note: `RunCard.timer.test.tsx` and `RunCard.test.tsx` are listed in CONTEXT as "mode/composer tests to update" but a full read confirms they reference ZERO removed symbols — they test the timer-honesty + model-attribution of RunCard. They must NOT be edited and must stay GREEN as no-regression evidence. The planner should correct that CONTEXT line.*

### SC#10 4-Axis Manual UAT (authored under VALIDATION.md, NOT plan tasks)
This phase touches UI state / composer / mode → the 4-axis bandwidth is mandatory. Automated E2E covers axes 1-3 partially; long-message stays manual per provider.
| Axis | Required coverage for IA-01 |
|------|------------------------------|
| Cross-provider | Launch a workflow into Harness on OpenAI, Anthropic, Google, OpenRouter (one representative model each); confirm Harness lock + a reachable Stop + Deep no-regression after the run completes |
| Multi-tool | One launched workflow run exercising 2+ tools (e.g. `search_documents` + `execute_code`) — confirm the 2-pill composer + lock behave through a multi-tool run |
| Parallel-thread | Thread A runs a launched workflow (locked, streaming) while Thread B (Deep) accepts a new prompt in the 2-pill composer — confirm Thread B is NOT locked (per-thread lock, SC#3 isolation) and Thread A's Stop is reachable |
| Long-message | A Deep thread with ≥ 50 prior messages OR a ≥ 5 KB prompt — confirm the 2-pill composer sends normally (regression guard for `general-chat-intermittent-silent-send-drop`, D-07: UAT must NOT regress the send path) |

## Security Domain

> `security_enforcement` not explicitly disabled → included. This is a UI-only frontend removal with no new attack surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change; existing JWT flow untouched |
| V3 Session Management | no | No session change |
| V4 Access Control | **yes (preserve, not add)** | The per-thread lock is owner-scoped server-side (`getThreadWorkflow` is ownership-gated 404 per `api.ts:1131`); the removal does not relax this. The lock derivation stays client-read of server truth — no client-side authority introduced. |
| V5 Input Validation | minimal | The kickoff textarea is unchanged (`RunModal` in `WorkflowsPage.tsx`); rendered as React text children (no innerHTML). The removed composer pills carried no user input. |
| V6 Cryptography | no | None |

### Known Threat Patterns for {React composer removal}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-side mode bypass (forge "Deep" to escape a Harness lock) | Elevation of Privilege | **Already mitigated, preserved:** the 409 is server-enforced (`threads.py`); the client disable is a courtesy only (`MessageInput.tsx:158-161` comment). Removing the pill REDUCES the client surface — it cannot weaken the server 409. |
| Cross-thread lock leak (Thread A's run locks Thread B) | Tampering | **Already mitigated, preserved:** the lock is keyed by the OWNING thread id (`useWorkflowLockForThread(thread?.id)`, never global — `StreamsProvider.tsx:2877-2886`). Untouched by the removal. The parallel-thread SC#10 axis is the binding gate. |
| XSS via removed-control props | Injection | N/A — the removed pills rendered enum-derived labels as React text children, never innerHTML. Removal eliminates them entirely. |

**Net security impact:** strictly neutral-to-positive. The removal deletes client UI; the server-side 409/lock/ownership authority is untouched (D-06). No new threat is introduced. The security-auditor (if run) should verify the 409 path and the owner-scoped reconcile are byte-unchanged — both are in the Preserve List.

## Sources

### Primary (HIGH confidence — live code read this session)
- `frontend/src/components/chat/MessageInput.tsx` (full) — the composer; removal seams L21-26, L54-72, L374-477; KEEP list
- `frontend/src/components/chat/ChatArea.tsx` (full) — wiring L70-72, L145-146, L166-171, L178-204 (reconcile), L328-356 (handleSend), L409-421 (props), L519-561 (409 banner)
- `frontend/src/components/layout/ChatLayout.tsx` (L73-104) — `doRun` launch path (SC#2)
- `frontend/src/pages/WorkflowsPage.tsx` (full) — the front door; `PublishedCard ▶ Run`, `RunModal`, `onLaunch`
- `frontend/src/providers/StreamsProvider.tsx` (L820-892, L1900-1992, L2820-2887) — lock set/clear, `streamingThreads` add (L1642), `stopStream`/`stopThread`/`cancelRun`, the thread-scoped selectors
- `frontend/src/components/chat/RunCard.tsx` + `RunStatusStrip.tsx` (full) — **confirmed NO Cancel control** in either
- `frontend/src/components/chat/ActiveRunsTray.tsx` (full) — the cross-thread Stop (`stopThread`)
- `frontend/src/components/chat/MessageItem.tsx` (grep) — the cap_paused Continue card L418-474 (G-5 file, NOT touched)
- `frontend/src/lib/api.ts` (L1069-1140) — `ThreadWorkflowState` shape, `getThreadWorkflow`
- `frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx`, `ChatAreaBanner.test.tsx`, `RunCard.timer.test.tsx`, `RunCard.test.tsx` (full/relevant) — at-risk vs. unaffected test classification
- `frontend/package.json` + `frontend/vitest.config.ts` — test framework + commands
- Project-wide grep (the removed symbols match exactly `MessageInput.tsx`, `ChatArea.tsx`, `ChatAreaMode.test.tsx`); E2E grep (zero matches)

### Primary (HIGH — locked design / acceptance bar)
- `.claude/skills/sketch-findings-agentic-rag/references/composer-and-mode.md` (sketch 011-A) — 2-pill composer, mode=server-truth, launch leaves composer; D4 status-chip+Cancel (superseded by CONTEXT D-01 "reuse only")
- `.claude/skills/sketch-findings-agentic-rag/references/workflow-run-surface.md` (sketch 022-A) — chat=thin receipt, locked composer, the `.runchip`+Cancel mockup
- `.planning/phases/121-one-front-door-for-workflows-ia/121-CONTEXT.md` — D-01..D-07 (authoritative)
- `.planning/REQUIREMENTS.md` (IA-01, non-goal line 74), `.planning/STATE.md`, `./CLAUDE.md` (red line, G-5, Realtime-is-a-hint)

### Secondary / Tertiary
None — no WebSearch/Context7 needed; this is an internal-codebase removal phase with no external library question.

## Metadata

**Confidence breakdown:**
- Removal seams (file:line): HIGH — every line read directly; grep confirmed the 3-file blast radius
- Preserve list (409/lock/reconcile): HIGH — the machinery read in full; structurally independent of removed pills
- Cancel-reachability verdict: HIGH — traced `isStreaming` → `streamingThreads.add` → `composer-stop` → `cancelRun` end-to-end; confirmed the sketch's strip-Cancel does NOT exist
- Launch path (SC#2): HIGH — `doRun` read in full; reuses the surviving `postMessage` kickoff
- Test surface: HIGH — read all 4 candidate test files; classified at-risk (ChatAreaMode ×3) vs. unaffected (RunCard ×2, ChatAreaBanner stays-green)
- Open questions (OQ-1/OQ-2): MEDIUM — genuine design forks, not facts; flagged for operator, not silently resolved

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (stable — internal frontend code; only churn risk is another phase editing `ChatArea.tsx`/`MessageInput.tsx` before 121 ships, which the G-5 ledger would surface)

# Phase 121: One Front Door for Workflows (IA) - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 3 modified (0 net-new) — `MessageInput.tsx`, `ChatArea.tsx`, `ChatAreaMode.test.tsx`
**Analogs found:** 5 / 5 edit-operations (this is a removal phase — analogs are *in-file precedents* and *sibling test patterns*, not new-file→old-file maps)

> **Read this first (planner):** Phase 121 is a **frontend deletion**, so there are **no new files** to map to analogs. Instead this PATTERNS.md maps each **edit operation** to its nearest in-repo precedent and gives the byte-accurate excerpt + the "gotcha" that keeps the PRESERVE boundary intact. Every line number below was **re-verified against live code this session** (the CONTEXT/RESEARCH line numbers drift by a few lines in two places — corrections flagged inline). The single highest-risk ambiguity is **Edit Op 1 (the prop-seam cut)**: the removed props are interleaved with the load-bearing `workflowLocked` KEEP prop in the exact same JSX block — cut the wrong line and SC#3 regresses.

---

## File Classification

| Modified File | Role | Data Flow (in→transform→out) | Nearest In-Repo Precedent | Match Quality |
|---------------|------|------------------------------|---------------------------|---------------|
| `frontend/src/components/chat/MessageInput.tsx` | component (composer / presentation) | props in → conditional JSX render out (delete 2 controls + 6 props + 1 interface + 2 icon imports) | the **surviving sibling control** in the same file: `agent-mode-selector` (L329-372) is the byte-identical render idiom of the two controls being deleted | exact (self-precedent) |
| `frontend/src/components/chat/ChatArea.tsx` | component (thread container / wiring) | server-truth lock + composer state → prop pass-through to `MessageInput` (stop passing 6 props; delete 3 useState + 1 fetch effect + 1 handleSend branch; KEEP reconcile/lock/banner) | the **surviving prop pass-throughs** in the same `<MessageInput .../>` block (L382-422) — the KEEP props (`agentMode`/`onAgentModeChange`/`workflowLocked`) are the cut-cleanly template | exact (self-precedent) |
| `frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx` | test (component, RTL/Vitest) | render `MessageInput` → assert testid present → **flip to assert testid GONE** + Cancel-reachable + locked-preserve | the file's own 3 existing tests give the render harness; **`ChatAreaBanner.test.tsx`** is the analog for the new lock/reconcile assertions | exact (rewrite) + sibling-analog (extend) |

**Two test files referenced in CONTEXT but NOT in the blast radius (confirmed by grep this session):**

| File | CONTEXT said | Verified reality | Action |
|------|--------------|------------------|--------|
| `RunCard.timer.test.tsx` | "mode/composer tests to update" | **0 matches** for any removed symbol (`grep -c` = 0) | **DO NOT TOUCH** — stays GREEN as no-regression evidence. CONTEXT line is wrong; RESEARCH already corrected it. |
| `RunCard.test.tsx` | (implied sibling) | **0 matches** (`grep -c` = 0) | **DO NOT TOUCH** — same. |

---

## Pattern Assignments

### Edit Op 1 — The prop-seam cut (`MessageInput.tsx` ⇄ `ChatArea.tsx`)  ★ HIGHEST RISK

**Role:** component prop-interface deletion across the `ChatArea` → `MessageInput` boundary.
**Data flow:** 6 props flow `ChatArea` (passing site) → `MessageInput` (interface + destructure + consumers). Removing a prop cleanly means deleting it at **all three** sites: the `interface Props` declaration, the function-signature destructure, and the passing site — **plus** every render-site consumer in `MessageInput`.

**Closest analog (self-precedent):** the **KEEP props in the very same block** show what a *kept* prop looks like at each site, so the executor diffs against them. The cleanest contrast is `agentMode` / `onAgentModeChange` (kept, drives `agent-mode-selector`) sitting one line above `workflowMode` / `onWorkflowModeChange` (removed, drove `workflow-mode-selector`).

#### Classify each removed prop — PURE-composer vs. ChatArea-state-still-needed

This is the planner's load-bearing distinction. Verified against live code:

| Prop | Class | Cut at MessageInput? | Cut at ChatArea? | Why |
|------|-------|----------------------|------------------|-----|
| `workflowMode` | **state still needed internally by ChatArea** (until its last reader dies) | YES (interface L54, destructure L110, all consumers) | the `useState` (L70) + reset (L145) die **only after** its readers (`displayedMode` derive L417, `handleSend` kickoff branch L332/356, the 2 removed render-conditions) are gone. Cut readers first, then the `useState`. | `workflowMode` is read by the removed pills AND by the dead kickoff branch. Delete top-down: render-sites → kickoff branch → `displayedMode` → then the `useState`+reset. |
| `onWorkflowModeChange` | **PURE-composer** | YES (interface L55, destructure L111) | YES — stop passing `onWorkflowModeChange={setWorkflowMode}` (L410). `setWorkflowMode` is the same `useState` setter as above. | Handler only ever fed the removed toggle. |
| `displayedMode` | **PURE-composer** | YES (interface L62, destructure L112, `labelMode` derive L120) | YES — stop passing `displayedMode={workflowLocked ? "harness" : "deep"}` (L417). | Exactly one consumer: the removed Deep/Harness label. Dead the instant the pill is gone (RESEARCH anti-pattern: do NOT keep "just in case"). |
| `publishedWorkflows` | **state still needed internally** (until fetch effect dies) | YES (interface L63, destructure L113) | the `useState` (L71) + the `listPublishedWorkflows()` fetch effect (L167-171) die together; stop passing the prop (L418). | Feeds only the removed picker. |
| `selectedWorkflowId` | **state still needed internally** (until kickoff branch dies) | YES (interface L66, destructure L114) | the `useState` (L72) + reset (L146) die after the `handleSend` kickoff branch (L331-355) that reads it is gone; stop passing (L419). | The picker's staged id; also the dead-code trigger (see Edit Op 2). |
| `onWorkflowSelect` | **PURE-composer** | YES (interface L67, destructure L115) | YES — stop passing `onWorkflowSelect={setSelectedWorkflowId}` (L420). | Handler only fed the removed picker. |

**Also PURE-composer-internal (no prop, MessageInput-local):** `WorkflowOption` interface (L21-26), `labelMode` derivation (L120). Both die with the picker/label.

**The interface seam excerpt** (`MessageInput.tsx` L54-72 — **CORRECTION:** CONTEXT/RESEARCH say "L43-72"; verified L43-44 is `agentMode`/`onAgentModeChange` which **STAYS**. The removable block starts at **L54**):
```typescript
// ── REMOVE L54-67 (the 6 mode/picker props) ──────────────────────────────────
  workflowMode?: "deep" | "harness"            // L54  REMOVE
  onWorkflowModeChange?: (mode: "deep" | "harness") => void   // L55  REMOVE
  displayedMode?: "deep" | "harness"           // L62  REMOVE (one consumer: the dead label)
  publishedWorkflows?: WorkflowOption[]         // L63-64  REMOVE
  selectedWorkflowId?: string | null            // L66  REMOVE
  onWorkflowSelect?: (workflowId: string) => void  // L67  REMOVE
// ── KEEP L68-72 (workflowLocked) — DO NOT CUT ────────────────────────────────
  /** D-03/D-05 — true while this thread is workflow-locked... */
  workflowLocked?: boolean                      // L68-72  KEEP — gates disable+placeholder+Send
```

**The passing site excerpt** (`ChatArea.tsx` L382-422 — verified verbatim). The trap is in **bold**: `workflowLocked` (KEEP) is the *last* prop, immediately after the 6 removed ones:
```typescript
  const inputBar = (
    <MessageInput
      onSend={handleSend}              // KEEP
      onStop={stopStreaming}           // KEEP (the Cancel route — Op 3)
      disabled={isStreaming}           // KEEP (drives composer-stop)
      threadId={thread?.id ?? null}    // KEEP
      providers={providers}            // KEEP (Model pill)
      ...                              // KEEP: selectedProvider/onProviderChange/models/selectedModel/onModelChange
      agentMode={agentMode}            // KEEP (General/Explorer pill)
      onAgentModeChange={setAgentMode} // KEEP
      prefillMessage={failedDraft ?? prefillMessage}  // KEEP
      onClearPrefill={() => { ... }}   // KEEP
      // ── REMOVE these 6 (L409-420) ─────────────────────────────────────────
      workflowMode={workflowMode}                       // L409  REMOVE
      onWorkflowModeChange={setWorkflowMode}            // L410  REMOVE
      displayedMode={workflowLocked ? "harness" : "deep"}  // L417  REMOVE
      publishedWorkflows={publishedWorkflows}           // L418  REMOVE
      selectedWorkflowId={selectedWorkflowId}           // L419  REMOVE
      onWorkflowSelect={setSelectedWorkflowId}          // L420  REMOVE
      workflowLocked={workflowLocked}                   // L421  ★ KEEP — gates the disable
    />
  )
```

**Gotcha (RESEARCH Pitfall 1):** `workflowLocked` *looks* like the seventh member of the mode-prop cluster (it sits in the same interface block L68-72 and is the same `<MessageInput>` block L421). **It is a KEEP.** It is consumed at `MessageInput.tsx` L116 (destructure default), L161 (`handleSend` lock-gate), L179 (`canSend` gate), L210-212 (locked placeholder + `disabled={disabled || workflowLocked}`), L331/333/383 (the `agent-mode-selector` *and* the removed pills' `disabled={workflowLocked}`). Sweeping all seven props un-disables the composer during a run → **SC#3 regression** (a locked thread could send a Deep message). Warning sign: the `ChatAreaBanner.test.tsx` 409 test or a new "locked cannot send" test fails.

---

### Edit Op 2 — Delete the two mode controls + their dead-code branch (`MessageInput.tsx` / `ChatArea.tsx`)

**Role:** component JSX-render deletion (presentation) + dead-branch removal (logic).
**Data flow:** props → conditional JSX render (the two `data-testid` blocks) out; and in `ChatArea`, `selectedWorkflowId` → `kickoffWorkflowId` → `sendMessage` arg (the branch that goes dead).

**Closest analog (self-precedent):** the **surviving `agent-mode-selector`** (`MessageInput.tsx` L329-372) is the byte-identical render idiom — same `DropdownMenu` + `rounded-full px-3 py-1.5 text-xs` button + `disabled={workflowLocked}` + `ChevronDown` chevron. The two controls being deleted are its visual siblings; the executor confirms the General/Explorer pill renders **independently** (its only shared dependency is `workflowLocked`, which stays) by checking that nothing in L329-372 references `workflowMode`/`displayedMode`/`publishedWorkflows`/`selectedWorkflowId`. Verified: it does not — it reads only `agentMode`, `onAgentModeChange`, `workflowLocked`.

**DELETE — Deep/Harness toggle** (`MessageInput.tsx` L374-425, gated `{onWorkflowModeChange && (...)}`):
```typescript
              {/* Phase 092 (D-01/D-05): Deep/Harness toggle... */}
              {onWorkflowModeChange && (                              // L379  ← REMOVE whole block
                <DropdownMenu>
                  ...
                    data-testid="workflow-mode-selector"             // L396
                      <span>{labelMode === "harness" ? "Harness" : "Deep"}</span>  // L402
                  ...
                </DropdownMenu>
              )}                                                      // L425
```

**DELETE — Workflow picker** (`MessageInput.tsx` L427-477, gated `{onWorkflowModeChange && workflowMode === "harness" && !workflowLocked && (...)}`):
```typescript
              {onWorkflowModeChange && workflowMode === "harness" && !workflowLocked && (  // L431  ← REMOVE whole block
                <DropdownMenu>
                  ...
                    data-testid="workflow-picker"                    // L441
                      data-testid={`workflow-option-${w.slug}`}      // L465
                  ...
                </DropdownMenu>
              )}                                                      // L477
```

**DELETE — the dead kickoff branch** (`ChatArea.tsx` L328-356) — this is the D-02 "harmless dead code" *creation site*:
```typescript
    // Phase 092 (D-02): a Harness send carries the picked workflow id...
    const kickoffWorkflowId =                                        // L331  ← REMOVE
      workflowMode === "harness" && selectedWorkflowId ? selectedWorkflowId : undefined
    if (kickoffWorkflowId) {                                         // L333  ← REMOVE (incl. requestOpenPanel — see OQ-2)
      requestOpenPanel()                                            // L339
    }
    await sendMessage(
      activeThread.id, content, selectedModel || undefined, onTitleUpdate,
      agentMode, selectedProvider || undefined,
      kickoffWorkflowId,                                            // L348  ← becomes the literal `undefined`
    )
    if (kickoffWorkflowId) { setSelectedWorkflowId(null) }           // L350-355  ← REMOVE
    // L356 deps array: drop workflowMode, selectedWorkflowId
```

**Gotcha (RESEARCH Pitfall 2 — the SC#2 trap, D-02):** the dead code is **only** the `kickoffWorkflowId` *staging* inside `ChatArea.handleSend` (it reads the removed `selectedWorkflowId`, which is now always null → branch never fires). It is NOT the server route. **DO NOT delete:**
- the `api.ts` `postMessage(..., {workflowDefinitionId})` function (untouched), and
- the `doRun` launch in `ChatLayout.tsx` L83-92 that *calls* it (untouched).

The `sendMessage(...)` signature keeps its 7th `kickoffWorkflowId` param (now passed `undefined`) so the API surface is byte-stable — **D-02 says keep the server send-with-`workflow_definition_id` path as harmless dead code; the `postMessage` route stays LIVE because `doRun` still uses it.** Deleting the `postMessage` call breaks launch entirely (SC#2). Warning sign: clicking **Run** on the Workflows page no longer starts a workflow.

**Gotcha (OQ-2, surface to operator — do NOT silently resolve):** the `requestOpenPanel()` at L339 fired the workspace-panel auto-open on an in-chat Harness kickoff. It dies with this branch. The page-launch `doRun` does **not** call `requestOpenPanel`. If launch-into-Harness should still auto-open the panel to the phase spine (sketch 022-A: "the panel owns the live spine"), that is a **small additive in `doRun`/`ChatLayout` — NOT a composer change**, and likely out-of-scope for IA-01. Flag at plan-time; the panel rail is always present (panel-shell.md D4) so the spine is reachable regardless.

**Gotcha (RESEARCH Pitfall 4 — lint):** after deleting both controls, two `lucide-react` imports go unused — `Workflow` and `Sparkles` (`MessageInput.tsx` L4). **Remove them.** Verified KEEP on the same import line: `Layers` (Provider selector L234/249/260), `Compass`/`Cpu`/`ChevronDown`/`ArrowUp`/`Square`. `npm run lint` flags `no-unused-vars` if `Workflow`/`Sparkles` are left.

**Also delete in `ChatArea.tsx`** (the now-orphaned picker-feed machinery):
| What | Line(s) | Note |
|------|---------|------|
| `workflowMode`/`setWorkflowMode` useState | L70 | after readers gone |
| `publishedWorkflows`/`setPublishedWorkflows` useState | L71 | |
| `selectedWorkflowId`/`setSelectedWorkflowId` useState | L72 | |
| `setWorkflowMode("deep")` + `setSelectedWorkflowId(null)` in thread-switch effect | L145-146 | reset for removed state |
| `listPublishedWorkflows()` mount fetch effect | L167-171 | feeds removed picker |
| `listPublishedWorkflows` / `PublishedWorkflow` import | (top of file) | only if no other consumer — **verify by grep before deleting the import** |

---

### Edit Op 3 — The surviving KEEP controls (`MessageInput.tsx`) — confirm independence

**Role:** component render — verification, not edit.
**Data flow:** props → JSX render out, unchanged.

**Two pills survive → the 2-pill target:**

1. **`agent-mode-selector` (General/Explorer)** — `MessageInput.tsx` L329-372. Render gated only by `{onAgentModeChange && (...)}`; reads `agentMode` + `workflowLocked`. **Independent of every removed symbol** (verified). KEEP byte-identical.
2. **Model pill (+ Provider fold-in)** — `MessageInput.tsx` L224-324. Reads `providers`/`selectedProvider`/`models`/`selectedModel` + their setters. **Independent of every removed symbol.** KEEP.

**Excerpt — the KEEP idiom that the deleted controls mirrored** (`MessageInput.tsx` L329-351, the part that proves independence):
```typescript
              {onAgentModeChange && (                                 // KEEP — gated on its OWN handler
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={workflowLocked}>  // KEEP dep = workflowLocked (stays)
                    <button
                      disabled={workflowLocked}
                      data-testid="agent-mode-selector"               // L346  ← the surviving pill testid
                    >
                      <Compass className="h-3 w-3 shrink-0" />        // Compass STAYS (used here)
                      <span>{agentMode === "explorer" ? "Explorer" : "General"}</span>
```

**Gotcha:** the surviving Stop affordance is **also a KEEP and is the post-removal Cancel** — `composer-stop` (`MessageInput.tsx` L487-497), in the *right-side* toolbar (L481-513), not the deleted left-side cluster. It renders `{disabled ? <Stop/> : <Send/>}` where `disabled === isStreaming`. During a workflow run `isStreaming` is true (kickoff adds the thread to `streamingThreads`, `StreamsProvider.tsx` L1642), so the red Stop button IS the reachable Cancel → `onStop` → `stopStreaming` → `cancelRun(runId)` → `DELETE /runs/{id}`. **This is the entire Cancel-reachability answer for D-01 — do NOT add the sketch's `.runchip` (D-01 forbids new composer chrome).** Make Stop-reachability an explicit UAT assertion. The narrow gap (locked-but-NOT-streaming, e.g. `cap_paused` with ended stream) is **OQ-1** — observe in SC#10 UAT; if real, fix the *receipt*, never a duplicate composer chip.

---

### Edit Op 4 — Test rewrite + extend (`ChatAreaMode.test.tsx` rewrite; `ChatAreaBanner.test.tsx` extend)

**Role:** test (component, Vitest + @testing-library/react).
**Data flow:** render component → query testid → assert. Current 3 tests assert the pill **exists**; flip to assert it's **gone** + add Cancel + locked-preserve.

#### (a) `ChatAreaMode.test.tsx` — REWRITE all 3 tests

**Closest analog = the file's own existing harness.** It renders `MessageInput` *in isolation* (not `ChatArea`, despite the filename) — `import { MessageInput } from "../MessageInput"`, `render(<MessageInput .../>)`, `afterEach(cleanup)`. Reuse that exact harness; only the assertions flip.

**Current pattern (all 3 tests use this — `getByTestId` asserts EXISTS):**
```typescript
// ChatAreaMode.test.tsx L22-25, L43-44 — the helper + assertion to INVERT
function modePill(): HTMLElement {
  return screen.getByTestId("workflow-mode-selector")   // ← throws if gone; the WHOLE premise dies
}
// ...
expect(within(modePill()).getByText("Harness")).toBeInTheDocument()  // L43  ← DELETE
expect(within(modePill()).queryByText("Deep")).not.toBeInTheDocument()  // L44
```

**Rewrite target (SC#1 + Cancel + SC#3-preserve in one file):**
```typescript
// SC#1 — both removed controls are GONE, both KEEP controls remain
render(<MessageInput onSend={()=>{}} disabled={false} onAgentModeChange={()=>{}}
  providers={[{id:"openai",name:"OpenAI",models:["gpt-test"],is_active:true}]}
  selectedProvider="openai" models={["gpt-test"]} selectedModel="gpt-test" />)
expect(screen.queryByTestId("workflow-mode-selector")).toBeNull()   // pill GONE
expect(screen.queryByTestId("workflow-picker")).toBeNull()          // picker GONE
expect(screen.getByTestId("agent-mode-selector")).toBeInTheDocument()  // KEEP
// Model pill present (provider/model render)

// Cancel-reachability (D-01) — disabled/streaming → composer-stop is the Cancel
render(<MessageInput onSend={()=>{}} onStop={onStop} disabled onAgentModeChange={()=>{}} />)
expect(screen.getByTestId("composer-stop")).toBeInTheDocument()
fireEvent.click(screen.getByTestId("composer-stop")); expect(onStop).toHaveBeenCalled()

// SC#3 preserve — workflowLocked still disables + swaps placeholder
render(<MessageInput onSend={()=>{}} disabled={false} workflowLocked onAgentModeChange={()=>{}} />)
// textarea disabled + placeholder "Workflow running — Cancel to switch back"; Send gated
```
**Gotcha:** the rewritten render must drop `displayedMode`/`workflowMode`/`onWorkflowModeChange`/`selectedWorkflowId`/`onWorkflowSelect`/`publishedWorkflows` from the JSX (they no longer exist on `Props` — TypeScript will error otherwise). Keep `onAgentModeChange` so `agent-mode-selector` renders. The file header doc-comment (L1-15, all about "finding #5 / displayedMode") must be rewritten to describe the 2-pill removal, or it lies.

#### (b) `ChatAreaBanner.test.tsx` — EXTEND (do NOT rewrite)

**This is the strongest analog in the phase.** It already does *exactly* the new SC#3 lock-reconcile assertion needs: mounts the **REAL `ChatArea` inside the REAL `StreamsProvider`** and mocks `getThreadWorkflow` + `listPublishedWorkflows`. The new test mirrors test (b) (the 409 case) with a `locked:true` mock.

**The mock seam to mirror** (`ChatAreaBanner.test.tsx` L45-49 — already present):
```typescript
    listPublishedWorkflows: vi.fn().mockResolvedValue([]),
    getThreadWorkflow: vi.fn().mockResolvedValue({   // ← the reconcile source; flip to locked:true
      mode: "deep",
      active_workflow_run_id: null,
    }),
```
**The 409 test that MUST stay GREEN unchanged** (`ChatAreaBanner.test.tsx` L130-141, test "b"):
```typescript
  it("b — a 409 lock-refusal is byte-equivalent: lock testid, fixed copy, no Retry", async () => {
    useStreamsStore.setState((s) => ({ reconcileErrors:
      new Map(s.reconcileErrors).set("thread-A", new ApiError(lockCopy, 409)) }))
    renderChatArea()
    expect(screen.getByTestId("workflow-lock-error-banner")).toBeInTheDocument()  // ← SC#3 signal, unchanged
  })
```
**New case to ADD (mirror, don't modify):** override `getThreadWorkflow` to resolve `{ locked:true, lock_is_stale:false, active_workflow_run_id:"run-1", cap_paused:false, continues_remaining:0 }` → after mount-reconcile, the composer textarea is `disabled` + shows the "Workflow running — Cancel to switch back" placeholder. Inverse case: `locked:false` → enabled. Covers SC#3 reconcile-on-mount.
**Gotcha:** the existing `listPublishedWorkflows: vi.fn()` mock (L45) becomes dead once `ChatArea` no longer calls it (Edit Op 2 deletes the fetch effect). Leaving the mock is harmless (it just never fires); removing it is optional source hygiene — but if you remove the `vi.mock` line for it while `ChatArea` *still* imports the symbol mid-edit, the mount throws. Safe order: delete the `ChatArea` fetch effect + import first, then optionally trim the mock.

#### (c) `RunCard.timer.test.tsx` + `RunCard.test.tsx` — DO NOT TOUCH

**Verified this session:** `grep -c` for every removed symbol = **0** in both files. They test timer-honesty + model-attribution of `RunCard`, which has **zero coupling** to the composer pills. They must stay GREEN, untouched, as no-regression evidence. (CONTEXT's "RunCard.timer.test.tsx to update" is incorrect — RESEARCH already flagged this; the planner should not schedule any edit here.)

---

## Shared Patterns (cross-cutting — apply to ALL edits)

### The PRESERVE boundary (byte-unchanged behavior — the SC#2/SC#3 proof set)

**Source:** `ChatArea.tsx` + `MessageInput.tsx` (the seven items below).
**Apply to:** every edit — the executor cuts *around* these, never *into* them.

| # | Preserve item | file:line | Why (SC) |
|---|---------------|-----------|----------|
| 1 | `workflowLocked` derivation | `ChatArea.tsx:95-96` (`useWorkflowLockForThread(thread?.id) !== null`) | lock truth — SC#3 |
| 2 | The FULL mount reconcile | `ChatArea.tsx:178-204` (`getThreadWorkflow` → set/clear lock; reads `state.locked && !state.lock_is_stale && state.active_workflow_run_id`) | survives reload — SC#2/SC#3/SC#5 |
| 3 | 409 lock banner + `NON_RETRYABLE` | `ChatArea.tsx:84` + `:519-561` (`workflow-lock-error-banner`, server copy verbatim, no Retry) | SC#3 — the 409 signal |
| 4 | Disabled composer + placeholder | `MessageInput.tsx:210-212` ("Workflow running — Cancel to switch back", `disabled={disabled || workflowLocked}`), `:161/:179` (Send gate) | SC#3 |
| 5 | The reachable Cancel | `MessageInput.tsx:487-497` (`composer-stop`) → `ChatArea.tsx:384` `onStop={stopStreaming}` → `cancelRun` → `DELETE /runs/{id}` | D-01 / Cancel |
| 6 | The launch path | `ChatLayout.tsx:83-92` `doRun`: `createThread` → `postMessage(..., {workflowDefinitionId})` → `selectThread` → `onNavigate("chat")` | **SC#2 — unchanged by removal** |
| 7 | `cap_paused` Continue card | `MessageItem.tsx:418-474` (G-5 hot file) | **DO NOT EDIT `MessageItem.tsx`** |

**Excerpt — the mount reconcile (PRESERVE verbatim, `ChatArea.tsx:178-204`):**
```typescript
  useEffect(() => {
    const tid = thread?.id
    if (!tid) return
    const controller = new AbortController()
    getThreadWorkflow(tid, controller.signal).then((state) => {
      if (controller.signal.aborted) return
      if (state.locked && !state.lock_is_stale && state.active_workflow_run_id) {
        streamActions.setWorkflowLockForThread(tid, { runId: state.active_workflow_run_id,
          mode: "harness", capPaused: state.cap_paused, continuesRemaining: state.continues_remaining })
      } else { streamActions.clearWorkflowLockForThread(tid) }
    }).catch(/* AbortError swallow */)
    return () => controller.abort()
  }, [thread?.id, streamActions])
```
This is the CLAUDE.md "reconcile-on-(re)connect, Realtime is a hint" rule made concrete. It is the server-truth anchor that makes "mode = server truth, no pill to mislabel" hold after the pill is gone.

### Hard constraints (surface in every plan task)

| Constraint | Rule | Where it bites |
|------------|------|----------------|
| **G-5 / D-06** | `backend/app/api/threads.py` MUST NOT be touched. Frontend-only. | Any plan task proposing a backend edit is mis-assigned (RESEARCH Responsibility Map). The 409 is server-enforced and stays as-is. |
| **Red line / D-14** | Deep Mode stays **byte-identical**; never fork the shared path. | `sendMessage(...)` keeps its 7th param (`undefined`); the Deep send path is unchanged. Don't special-case. |
| **D-02 (the SC#2 trap)** | Keep the server send-with-`workflow_definition_id` path as **harmless dead code** — but the `postMessage`/`doRun` **launch route stays LIVE**. | Delete only the `kickoffWorkflowId` *staging* in `ChatArea.handleSend` (L331-355). Do NOT delete `postMessage` (api.ts) or `doRun` (ChatLayout). |
| **D-01** | Reuse existing affordances only — **no new composer chrome.** | Do NOT build the sketch 011-A/022-A `.runchip`. The `composer-stop` Stop IS the Cancel. |
| **D-04** | The existing "Workflows" nav entry is the single front door. | No chat-side empty-state nudge this phase (deferred). |

---

## No Analog Found

None. Every edit operation has a precise in-repo precedent (self-precedent for the JSX/prop cuts; `ChatAreaBanner.test.tsx` for the new test assertions). There is no net-new construction, so RESEARCH.md's Code Examples are confirmatory, not a fallback.

## Metadata

**Analog search scope:** `frontend/src/components/chat/` (the 3 target files + 2 no-touch RunCard tests + `ChatAreaBanner.test.tsx` analog), `frontend/src/components/layout/ChatLayout.tsx` (launch path), `frontend/src/providers/StreamsProvider.tsx` (lock/streaming selectors — read via RESEARCH, not re-read).
**Files scanned this session:** `MessageInput.tsx` (L1-130, L320-519), `ChatArea.tsx` (L60-204, L320-430, L515-564), `ChatAreaMode.test.tsx` (full), `ChatAreaBanner.test.tsx` (full), plus project-wide grep (removed-symbol blast radius = 3 files; RunCard coupling = 0).
**Line-number corrections vs. CONTEXT/RESEARCH:** (1) interface seam is **L54-72**, not "L43-72" (L43-44 = `agentMode`/`onAgentModeChange`, KEEP). (2) `RunCard.timer.test.tsx`/`RunCard.test.tsx` have **0** coupling and must NOT be edited (CONTEXT line wrong; RESEARCH already corrected).
**Pattern extraction date:** 2026-06-22

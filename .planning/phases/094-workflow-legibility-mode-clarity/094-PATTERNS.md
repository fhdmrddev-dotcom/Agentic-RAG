# Phase 094: Workflow Legibility + Mode Clarity - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 13 (8 source files modified/created + 5 test files)
**Analogs found:** 13 / 13 (every new file has a confirmed in-repo analog)

> **Verification pass, not discovery.** RESEARCH.md already named the closest analog for every file. This file CONFIRMED each named analog against the live code (re-grepped, re-read) and extracted the concrete excerpt the executor copies the shape from. Drift from the CONTEXT/RESEARCH anchors is flagged inline with ⚠️.

## Anchor-drift summary (re-grepped 2026-06-04)

| Anchor (per CONTEXT/RESEARCH) | Live reality | Verdict |
|---|---|---|
| `api.ts` Deep dispatch "~485–667" | Switch opens at 485 (`delta`), last branch `cap_paused` at **657–666**, switch closes **667**. New branches insert at 667 (before the cursor-advance block at 676). | CONFIRMED (cutoff exact) |
| `api.ts` ZERO `phase_*`/`gate_failed`/`run_*` handlers anywhere in `frontend/src` | Grep = **No files found**. The load-bearing negative holds. | CONFIRMED |
| `--accent-violet` absent in `frontend/` | Grep across `frontend/` = **No files found**. | CONFIRMED |
| `StreamCallbacks` interface @223; `onCapPaused` @311; `onTaskStart/Done` @341/344 | All exact. | CONFIRMED |
| `makeStreamCallbacks` panel defaults @681–720 | Exact (`onTodoUpdated`@681 … `onCapPaused`@714). | CONFIRMED |
| streamsStore `tasksByThread` interface @120, default @254; `workflowLockByThread` @135/258 | Exact; no-op stub block @272–286. | CONFIRMED |
| StreamsProvider action bodies `tasksByThread` @1806–1837; `workflowLock` @1842–1849 | Exact. | CONFIRMED |
| `useThreadMessages` (chat selector, PANEL-09 boundary) @1974; `useWorkflowLockForThread` @2132 | Exact (1974 / 2132). RESEARCH cited 1978/2132 — 1974 is the `export const`. | CONFIRMED (±4 lines) |
| WorkspacePanel `hasActivity` @95–96; sections @104–138 | Exact. | CONFIRMED |
| PendingAskCard receives `ask` but does NOT read `ask.draft`; prompt render @179 | Exact (destructure @53 omits `draft`; prompt `<p>{prompt}</p>` @179–181). | CONFIRMED |
| ChatArea `workflowMode` useState @68; `workflowLock` @83; `workflowLocked` @84; passed to MessageInput `workflowMode={workflowMode}` @363 | Exact. The displayed badge derives from `workflowMode` (launch toggle), NOT `workflowLocked` — the D-02 bug. | CONFIRMED |
| harness_engine `_surface_final_answer` @235–350 (persist block @314–347); success call @822 | Exact. | CONFIRMED |
| harness_engine failure site #1 `fail_run` @699–709 (`return`@709) | Exact. | CONFIRMED |
| harness_engine failure site #2 `skip_to_phase` runtime-guard `return`@735 | Exact (inside the 712–735 block; `return` is @735). ⚠️ CONTEXT's single "~699–709" anchor misses this. Both sites need the fix. | CONFIRMED (2nd site real) |
| `PendingAsk.draft?` @types/index.ts:311; populated @api.ts:610 | Exact. | CONFIRMED |
| `gate_failed` emit @486/522 (`{phase,attempt,error}`); `gate_passed` audit-only @497–500 (NO `_emit`) | Exact. Infer "passed" from phase advancing. | CONFIRMED |

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/lib/api.ts` (MODIFY) | SSE-normalizer / dispatch | streaming / event-driven | the `todo_updated`/`cap_paused` additive branches in the SAME switch (api.ts:582, 657) | exact (same file, same pattern) |
| `frontend/src/stores/streamsStore.ts` (MODIFY) | store / state slice | event-driven | `tasksByThread` slice (interface 120 / default 254 / stubs 280–282) + `workflowLockByThread` (135/258/285) | exact |
| `frontend/src/providers/StreamsProvider.tsx` (MODIFY) | provider / SSE→state bridge | event-driven | `onTaskStart/Done` defaults (691–708) + `tasksByThread` action bodies (1806–1837) + `useTasks` selector (2052) | exact |
| `frontend/src/components/panel/PhaseTimeline.tsx` (NEW) | component (panel section) | request-response (reconcile) + event-driven (live) | `WorkspacePanel` section mounts (104–138) + `useTasks`/`useTodos` consumption | role-match |
| `frontend/src/components/panel/PhaseCard.tsx` (NEW) | component (card/accordion) | event-driven (render) | `PendingAskCard` (card chrome + a11y + plain-text-children) | role-match |
| `frontend/src/components/panel/WorkspacePanel.tsx` (MODIFY) | component (panel host) | request-response | the 4 existing section mounts + `hasActivity` gate (95–135) | exact (same file) |
| `frontend/src/components/panel/PendingAskCard.tsx` (MODIFY) | component (card) | event-driven (render) | the existing prompt render @179 + the amber-chrome block (162–181) | exact (same file) |
| `frontend/src/components/chat/ChatArea.tsx` (MODIFY) | component (chat host) | state-derivation | the `workflowLock`/`workflowLocked` read @83–84 (server truth) | exact (same file) |
| `frontend/src/index.css` (MODIFY) | config (CSS tokens) | n/a | the `--panel-status-done`/`-active` token blocks (`:root` 60–61, `.dark` 124–125) | exact |
| `frontend/tailwind.config.js` (MODIFY) | config (theme) | n/a | the `panel-status-*` registration (53–54) | exact |
| `backend/app/services/harness_engine.py` (MODIFY) | service (workflow engine) | request-response + persist | `_surface_final_answer` persist block (314–347) | exact (same file, strict subset) |
| `frontend/src/providers/__tests__/phaseHooks.test.tsx` (NEW) | test (integration) | event-driven | `panelHooks.test.tsx` (raw SSE → real `subscribeToRun` → store; FC#1 @292–313) | exact |
| `frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx` / `FailReason.test.tsx` / `PhaseReconcile.test.tsx` (NEW) | test (component + a11y) | render | `PendingAskCard.test.tsx` (vitest-axe @12; mock-hook @27–35) | role-match |
| `backend/tests/test_094_rc4_failure.py` (NEW) | test (backend unit) | persist | `test_harness_gates.py` / `test_harness_engine.py` | role-match |

---

## Pattern Assignments

### `frontend/src/lib/api.ts` (SSE dispatch — D-07 additive branches)

**Analog:** the SAME `subscribeToRun` switch — the `todo_updated` / `cap_paused` panel branches.

**Where to attach (CONFIRMED):** after the `cap_paused` branch closes at **666** and the switch closes at **667**, insert the new `else if` branches BEFORE the closing `}` — i.e. as the last `else if`s of the switch, exactly where `cap_paused` sits. They carry **NO `return`** so the cursor-advance block at **676–679** still fires.

**Interface excerpt — append new optional callbacks here** (api.ts:311, the `onCapPaused` shape to mirror):
```typescript
// api.ts:305-316 — the precedent for a panel-only NON-terminal callback
onCapPaused?: (info: {
  runId: string
  toolNames: string[]
  continuesUsed: number
  continuesRemaining: number
}) => void
```
New ones append after the `onTaskDone?` block (api.ts:342–344), e.g.:
```typescript
onPhaseStarted?: (p: { phase: string; phaseIndex: number; phaseType: string }) => void
onPhaseCompleted?: (phase: string, phaseIndex: number) => void
onPhaseTransition?: (from: string, to: string, via: string) => void
onGateFailed?: (g: { phase: string; attempt: number; error: string }) => void
onRunFailed?: (reason?: string) => void
onRunCompleted?: (status?: string) => void
```

**Core dispatch excerpt — copy this shape** (api.ts:582-583 + 657-666, the additive-no-return precedent):
```typescript
// api.ts:582 — todo_updated: panel-only callback, NO return, cursor-advance still fires
else if (t === "todo_updated" && callbacks.onTodoUpdated)
  callbacks.onTodoUpdated((parsed.todos ?? []) as Todo[])

// api.ts:657-666 — cap_paused: the NON-terminal precedent (builds a typed obj, no return)
} else if (t === "cap_paused" && callbacks.onCapPaused) {
  callbacks.onCapPaused({
    runId,
    toolNames: (parsed.tool_names ?? []) as string[],
    continuesUsed: (parsed.continues_used ?? 0) as number,
    continuesRemaining: (parsed.continues_remaining ?? 0) as number,
  })
}
```
New branches (mirror exactly, reading FLAT payload fields verbatim — `parsed.phase`, `parsed.phase_index`, `parsed.phase_type`, `parsed.attempt`, `parsed.error`, `parsed.reason`; backend emits confirmed at harness_engine.py:486/522/708/734):
```typescript
else if (t === "phase_started" && callbacks.onPhaseStarted)
  callbacks.onPhaseStarted({
    phase: parsed.phase as string,
    phaseIndex: parsed.phase_index as number,
    phaseType: parsed.phase_type as string,
  })
else if (t === "gate_failed" && callbacks.onGateFailed)
  callbacks.onGateFailed({
    phase: parsed.phase as string,
    attempt: parsed.attempt as number,
    error: parsed.error as string,
  })
else if (t === "run_failed" && callbacks.onRunFailed)
  callbacks.onRunFailed(parsed.reason as string | undefined)
// …phase_completed / phase_transition / run_completed same shape. NO `return`.
```

**Discipline (Pitfall 1 — byte-identical Deep guard):** the existing branches `delta`(485), `sources`(566), `tool_end`(504), `ask_user_prompt`(600), the terminal `done/stream_end/error/timed_out/cancelled`(614–647) must be BYTE-IDENTICAL pre/post. `git diff` shows ONLY additions.

---

### `frontend/src/stores/streamsStore.ts` (panel-only `phasesByThread` slice)

**Analog:** `tasksByThread: Map<string, TaskRunIndexItem[]>` (interface @120, default @254) + `workflowLockByThread` (@135/258).

**Interface excerpt — add `phasesByThread` beside these** (streamsStore.ts:110-135):
```typescript
// streamsStore.ts:118-120 — the per-thread Map the new slice mirrors
/** Per-thread sub-agent task run index (keyed-by-sub_run_id upsert/status on
 *  the TASK-variant sub_agent_start / sub_agent_done SSE). */
tasksByThread: Map<string, TaskRunIndexItem[]>
// …
/** Per-thread workflow lock. Absent key = Deep (unlocked). */     // :134-135
workflowLockByThread: Map<string, WorkflowLock>
```
→ add `phasesByThread: Map<string, Phase[]>` (panel-only, ephemeral). The `Phase` shape per DATA-CONTRACT §3(b): `{ slug, phaseIndex, phaseType, status, attempt?, error?, subAgents, pendingAsk }`, `status ∈ {pending,running,done,failed,retrying,skipped}`.

**Default excerpt — start EMPTY** (streamsStore.ts:255-258, the ephemeral precedent — do NOT add a localStorage reader):
```typescript
// :255-258 — workflowLockByThread starts EMPTY (ephemeral, reconciled on mount)
// Type: workflowLockByThread: Map<string, WorkflowLock>
workflowLockByThread: new Map<string, WorkflowLock>(),
```
→ `phasesByThread: new Map<string, Phase[]>(),` (NOT `readTasksSyncOrEmpty()` — phases reconcile from `getThreadWorkflow` every mount, do NOT persist to `streamsCache`).

**Action stub excerpt — synchronous no-op, NOT `notMounted`** (streamsStore.ts:280-286, Pitfall 5):
```typescript
// :280-286 — no-op stubs because panel SSE can fire BEFORE the provider's
// mount-time useEffect registers real bodies (NOT notMounted — that would throw).
setTaskForThread: () => {},
updateTaskStatusForThread: () => {},
replaceTasksForThread: () => {},
setWorkflowLockForThread: () => {},
clearWorkflowLockForThread: () => {},
```
→ add `appendPhaseForThread`, `setPhaseStatusForThread`, `replacePhasesForThread` as `() => {}` stubs + their interface declarations beside the `*TasksForThread` decls (streamsStore.ts:186–196).

---

### `frontend/src/providers/StreamsProvider.tsx` (demux + action bodies + selector)

**Analog:** `onTaskStart/onTaskDone` defaults (@691–708), `tasksByThread` action bodies (@1806–1837), `useTasks` selector (@2052).

**Demux default excerpt — closes over `threadId` (Pitfall 6 isolation)** (StreamsProvider.tsx:691-708):
```typescript
// :691-708 — onTaskStart/Done: each calls getState().actions.*ForThread(threadId,…),
// closing over the factory's threadId (the OWNING thread).
onTaskStart: (subRunId, description, tools, maxSteps) =>
  useStreamsStore.getState().actions.setTaskForThread(threadId, { sub_run_id: subRunId, /*…*/ }),
onTaskDone: (subRunId, status, summary) =>
  useStreamsStore.getState().actions.updateTaskStatusForThread(threadId, subRunId, status, summary),
```
New defaults attach in the SAME block (after `onCapPaused` @714–720):
```typescript
onPhaseStarted: (p) =>
  useStreamsStore.getState().actions.appendPhaseForThread(threadId, {
    slug: p.phase, phaseIndex: p.phaseIndex, phaseType: p.phaseType,
    status: "running", subAgents: [], pendingAsk: null,
  }),
// onPhaseCompleted/onGateFailed/onRunFailed → setPhaseStatusForThread(threadId, …)
```

**Action body excerpt — `new Map(prev)` copy-then-mutate** (StreamsProvider.tsx:1820-1837):
```typescript
// :1820-1831 — updateTaskStatusForThread: immutable replace shape to copy
updateTaskStatusForThread: (threadId, subRunId, status, summary) =>
  useStreamsStore.setState((s) => {
    const next = new Map(s.tasksByThread)
    const prev = next.get(threadId) ?? EMPTY_TASKS
    next.set(threadId, prev.map((t) =>
      t.sub_run_id === subRunId ? { ...t, status, summary } : t))
    return { tasksByThread: next }
  }),
```
New phase mutators follow this EXACT shape against `phasesByThread` (keyed by `slug` or `phaseIndex`).

**Selector excerpt — the PANEL-09 boundary** (StreamsProvider.tsx:2052-2069, `useTasks`):
```typescript
// :2052-2069 — useTasks: thin null-safe store selector + usePanelReconcile.
// Return contract { data, isLoading, error, reconcile }. fetcher = getThreadTasks.
export function useTasks(threadId: string | null): { data: TaskRunIndexItem[]; /*…*/ } {
  const data = useStreamsStore((s) =>
    threadId ? (s.tasksByThread.get(threadId) ?? EMPTY_TASKS) : EMPTY_TASKS)
  const replace = useStreamsStore((s) => s.actions.replaceTasksForThread)
  const { isLoading, error, reconcile } = usePanelReconcile<TaskRunIndexItem>({
    threadId, hookId: "tasks", fetcher: getThreadTasks, replace })
  return { data, isLoading, error, reconcile }
}
```
New `usePhases(threadId)` attaches alphabetically among the panel hooks; `fetcher: getThreadWorkflow` (the reconcile floor — seeds `total_phases`/`current_phase_index` skeleton).

**⚠️ ANTI-PATTERN GUARD (PANEL-09):** `useThreadMessages` (the chat selector) MUST stay untouched:
```typescript
// StreamsProvider.tsx:1974-1980 — reads bucketsBySurface EXCLUSIVELY.
// A phasesByThread mutation cannot re-render chat because this selector never reads it.
export const useThreadMessages = (threadId: string | null, surfaceId: SurfaceId = "chat"): Message[] =>
  useStreamsStore((state) =>
    threadId ? state.bucketsBySurface.get(surfaceId)?.get(threadId) ?? EMPTY_ARRAY : EMPTY_ARRAY)
```
NEVER add a `phasesByThread` read here or in any chat component.

---

### `frontend/src/components/panel/PhaseTimeline.tsx` + `PhaseCard.tsx` (NEW)

**Analog:** `WorkspacePanel` section consumption (data via `usePhases` + `useTasks`) + `PendingAskCard` for the card/accordion + a11y shape.

**Data-consumption excerpt** (WorkspacePanel.tsx:84-87 — how a panel section reads its hook):
```typescript
// :84-87 — null-safe per-thread hook reads; `data` never undefined (PANEL-06).
const threadId = useViewingThread()
const { data: todos } = useTodos(threadId)
const { data: files } = useWorkspaceFiles(threadId)
const { data: pendingAsks } = useAskUserPrompt(threadId)
```
`PhaseTimeline` reads `const { data: phases } = usePhases(threadId)` + `const { data: tasks } = useTasks(threadId)` (batch summaries / agent tally).

**Card chrome + plain-text-children excerpt** (PendingAskCard.tsx:162-181 — the amber-card + a11y precedent; status text is REAL text, agent text renders as plain React children, never `dangerouslySetInnerHTML`):
```tsx
// :164-181 — role=group + aria-labelledby; status word in real text + glyph;
// agent-supplied {prompt} rendered as plain children (T-087-11 XSS guard).
<div className="flex flex-col gap-2 rounded-md border border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.12)] p-3"
     role="group" aria-labelledby={labelId}>
  <div className="… text-[hsl(var(--warning))]">
    <span className="… animate-dotBounce" aria-hidden="true" />
    <span aria-live="assertive">Needs you</span>
  </div>
  <p className="text-sm leading-relaxed text-foreground" id={labelId}>{prompt}</p>
```
`PhaseCard` mirrors: APG accordion (`<h3><button aria-expanded aria-controls>`), status atom = `aria-hidden` glyph + real text label (`✓ Complete` / `● Running` / `○ Locked` / `✕ Failed` / `↻ Attempt N`), per UI-SPEC §A11Y. Color tokens: `--panel-status-done`/`--panel-status-active` for done/running (pre-verified contrast), `--destructive` (lightened text) for failed, `--accent-violet` for retrying (gated on D-05 landing FIRST — Pitfall 3). NEVER `--muted-foreground-dim` for meaningful text (3.59:1 fail — Pitfall 4).

⚠️ SUPPRESS (Pitfall 5 / D-03): no per-phase tool/search/source count chips — those fire on the invisible sub-stream. Render ONLY `Phase i/N`, `{n} agents` (client tally of `sub_agent_start`), run-level end-of-run `sources.length`, per-subtopic `summary`.

---

### `frontend/src/components/panel/WorkspacePanel.tsx` (MODIFY — mount the 5th section)

**Analog:** the existing Todos/Files/Versions section mounts in the SAME file.

**Excerpt — `hasActivity` gate + section mount** (WorkspacePanel.tsx:95-135):
```tsx
// :95-96 — extend this to include `phases.length > 0` so the panel doesn't
// short-circuit to PanelEmpty during a harness run that has phases but no todos.
const hasActivity = todos.length > 0 || files.length > 0 || pendingAsks.length > 0

// :126-134 — the Versions section: copy this PanelSection shape for the new
// PhaseTimeline section (mount AFTER Versions; condition mode==='harness' OR phases exist).
<PanelSection title="Versions" defaultOpen={false}>
  {selectedFile && threadId ? <VersionDiff threadId={threadId} file={selectedFile} /> : <p>…</p>}
</PanelSection>
```
Add `const { data: phases } = usePhases(threadId)` next to lines 85–87; extend `hasActivity` to `… || phases.length > 0`; add a `<PanelSection title="Workflow"><PhaseTimeline /></PanelSection>` after Versions.

⚠️ PANEL-08 auto-open (RESEARCH Open Q1 / A1): the open/rail machine is LIFTED to `ChatLayout`; the `subscribeOpenPanel(onExpand)` seam exists (file header @10–14). Planner verifies whether harness kickoff already force-opens the panel or needs a one-line `onExpand` nudge — LOW risk.

---

### `frontend/src/components/panel/PendingAskCard.tsx` (MODIFY — render `ask.draft`, D-06)

**Analog:** the existing prompt render @179 in the SAME file.

**Excerpt — the prompt render to add the DraftBlock ABOVE** (PendingAskCard.tsx:52-53 + 179-181):
```tsx
// :52-53 — current destructure OMITS draft. ask.draft exists on the type
// (types/index.ts:311) + is populated at api.ts:610 — just not read here.
const { tool_call_id, prompt, timeout_seconds, run_id } = ask
// → add: const draft = ask.draft   (guard: undefined on older streams → hide block)

// :179-181 — the prompt <p>. Insert the DraftBlock immediately ABOVE this.
<p className="text-sm leading-relaxed text-foreground" id={labelId}>{prompt}</p>
```
`DraftBlock` = amber mono tag `DRAFT · awaiting your review — not yet saved` + draft body (faded-mask preview when long) + `⤢ Review & edit full draft` opening a shadcn `Dialog` wide overlay (`min(760px,88%)`). Wordcount from `ask.draft.length` at render (never fixture). Guard `ask.draft === undefined` → hide block, show question only (DATA-CONTRACT §6 DRAFT-MISSING). Zero backend.

**Batch summaries (D-06 second half):** a `BatchResultList` reads `useTasks(threadId)` and renders per-subtopic `{description → summary}` (`TaskRunIndexItem.summary`, types/index.ts:319) — already panel-only, no chat read.

---

### `frontend/src/components/chat/ChatArea.tsx` (MODIFY — mode label from server truth, D-02)

**Analog:** the `workflowLock`/`workflowLocked` read in the SAME file.

**Excerpt — the server-truth signal ALREADY exists** (ChatArea.tsx:83-84):
```typescript
// :83-84 — the SERVER-TRUTH lock (reconciled from getThreadWorkflow on mount +
// cap_paused SSE). The displayed mode badge must derive from THIS.
const workflowLock = useWorkflowLockForThread(thread?.id ?? null)
const workflowLocked = workflowLock !== null
```
**The bug to fix** (ChatArea.tsx:68 + 363): `workflowMode` is the local LAUNCH toggle that goes stale before the mount reconcile; it currently feeds the displayed mode.
```typescript
// :68 — the LAUNCH toggle (which workflow to kick off). KEEP for kickoff (line 307).
const [workflowMode, setWorkflowMode] = useState<"deep" | "harness">("deep")
// :363 — passed to MessageInput. The DISPLAYED mode badge must read
// `workflowLocked ? "harness" : "deep"` (server truth), NOT workflowMode.
workflowMode={workflowMode}
```
D-02 = a read-derivation change: the displayed badge keys off `workflowLocked`; the launch toggle (`workflowMode`/`setWorkflowMode`, used at line 307 for kickoff) stays AS-IS. ⚠️ RESEARCH Open Q2: pin the exact badge JSX site (likely the status chip / panel mode tag) — the signal is confirmed; the render site is the planner's to pin.

---

### `frontend/src/index.css` + `frontend/tailwind.config.js` (MODIFY — `--accent-violet`, D-05 FIRST)

**Analog:** the `--panel-status-done`/`-active` token blocks + their tailwind registration.

**CSS excerpt — the token convention to mirror (HSL channels, no `hsl()` wrapper, verification comment)** (index.css:60-61 `:root`, 124-125 `.dark`):
```css
/* index.css :60-61 (:root / light) — add --accent-violet AFTER line 61 */
--panel-status-done: 142 65% 28%;
--panel-status-active: 32 90% 30%;
/* → --accent-violet: 258 80% 40%;  /* #4514b8 → 8.52:1 on light --panel-surface (text+graphic) */

/* index.css :124-125 (.dark) — add --accent-violet AFTER line 125 */
--panel-status-done: 142 71% 55%;
--panel-status-active: 38 92% 62%;
/* → --accent-violet: 258 90% 66%;  /* #895af6 → 4.35:1 graphic on dark --panel-surface (≥3:1);
   pill LABEL text uses lightened 258 95% 84% → 9.83:1 */
```

**Tailwind excerpt — the registration to mirror** (tailwind.config.js:53-54):
```js
// tailwind.config.js :53-54 — register --accent-violet AFTER line 54, same mapping
"panel-status-done": "hsl(var(--panel-status-done))",
"panel-status-active": "hsl(var(--panel-status-active))",
// → "accent-violet": "hsl(var(--accent-violet))",
```
⚠️ Pitfall 3 / D-05 BINDING: this is the FIRST task. Writing `text-accent-violet` before the token lands resolves to nothing → transparent/broken CSS. The `retrying` row + `llm_batch_agents` marker are gated on this.

---

### `backend/app/services/harness_engine.py` (MODIFY — RC-4 persist, D-04, the ONE backend touch)

**Analog:** `_surface_final_answer` persist block (314–347) in the SAME file — a strict subset.

**Template excerpt — the persist block to mirror** (harness_engine.py:332-347):
```python
# harness_engine.py:332-347 — the persist the new _surface_failure_message copies.
# Lazy-import (keeps the harness import cycle broken); reads ctx.thread_id +
# ctx.current_user["id"]; _strip_nul on content; grounding params optional.
from app.db.runs import insert_assistant_message
from app.services.agent_loop import _strip_nul
# (_thread_id / _user_id read from ctx at :324-325)
_inserted_id = await insert_assistant_message(
    pool,
    thread_id=UUID(_thread_id) if isinstance(_thread_id, str) else _thread_id,
    user_id=UUID(_user_id) if isinstance(_user_id, str) else _user_id,
    content=_strip_nul(final_text),
    source_refs=source_refs or None,         # ← OMIT on the failure persist (None)
    confidence_level=_conf.get("level"),     # ← OMIT (None)
    confidence_avg_similarity=_conf.get("avg_similarity"),
    confidence_disclaimer=_conf.get("disclaimer"),
)
```

**Failure site #1 — `fail_run` (harness_engine.py:699-709), insert BEFORE `return`@709:**
```python
# :703-709 — finish_run("failed") → audit → _emit("run_failed") → return WITH NO PERSIST.
await finish_run(pool, run_id, "failed")
await write_audit(pool, run_id, user_id=_audit_user_id,
                  event_type="run_failed", metadata={"reason": outcome.reason})
await _emit(redis, stream_run_id, "run_failed", reason=outcome.reason)
# → INSERT _surface_failure_message(ctx, run_id, outcome.reason, pool) HERE
return  # stop — no further phases
```

**⚠️ Failure site #2 — `skip_to_phase` runtime-guard (harness_engine.py:729-735), insert BEFORE `return`@735** (the site the CONTEXT's "~699–709" anchor MISSES — Pitfall 7):
```python
# :729-735 — the SECOND failure return. Same pattern, same missing persist.
await finish_run(pool, run_id, "failed")
await write_audit(pool, run_id, user_id=_audit_user_id,
                  event_type="run_failed", metadata={"reason": reason})
await _emit(redis, stream_run_id, "run_failed", reason=reason)
# → INSERT _surface_failure_message(ctx, run_id, reason, pool) HERE
return
```

**The helper** (`_surface_failure_message(ctx, run_id, reason, pool)`): lazy-import `insert_assistant_message` + `_strip_nul`; read `ctx.thread_id` + `ctx.current_user["id"]` (guard both present); `content = _strip_nul(reason or "Failure reason not captured by the backend.")` (the `reason_unknown` sentinel — NEVER empty content); grounding params omitted (None).

**⚠️ Deep byte-identical guard (Pitfall 2):** the helper lives INSIDE `harness_engine.py`, called ONLY from `run_workflow`'s two harness-only failure branches. It MUST NOT touch `_shielded_finalize` (the shared Deep+harness terminal path). `git diff` on the shared finalize path = empty. The success call at :822 (`_surface_final_answer`) is unrelated.

---

## Shared Patterns

### Additive SSE branch (PANEL-06 isolation)
**Source:** `frontend/src/lib/api.ts:582` (`todo_updated`) + `:657-666` (`cap_paused`)
**Apply to:** every new `phase_*`/`gate_failed`/`run_*` branch.
A new wire event → an `else if` in the switch → a panel-only callback → a dedicated per-thread Map. NO `return` (cursor-advance at 676–679 must fire). NEVER edit a neighbor branch.

### Per-thread keying (cross-thread isolation, Pitfall 6)
**Source:** `frontend/src/providers/StreamsProvider.tsx:691-720` (the `makeStreamCallbacks` factory closes over `threadId`)
**Apply to:** all phase demux defaults + the `phasesByThread` Map + the `usePhases` selector.
Every write keys by the OWNING `threadId` (the factory's closed-over id), NEVER `viewedThreadId` or a global flag. A background harness run must not mutate the viewed thread's timeline.

### Plain-text-children XSS guard (T-087-11)
**Source:** `frontend/src/components/panel/PendingAskCard.tsx:179-181`
**Apply to:** all agent-rendered text in `PhaseCard`/`PhaseTimeline`/`DraftBlock`/`BatchResultList` (phase slug, draft, summary, prompt, options, failure reason).
Render as plain React text children — NEVER `dangerouslySetInnerHTML`.

### Reconcile-then-live (D-v2.5-03 anti-drift)
**Source:** `frontend/src/components/chat/ChatArea.tsx:153-179` (the `getThreadWorkflow` mount reconcile into `workflowLock`)
**Apply to:** the `usePhases` reconcile (seeds `total_phases`/`current_phase_index` skeleton) + the `Phase i/N` counter.
Reconcile is the FLOOR; live NEVER moves a counter backward.

### vitest-axe a11y gate (A11Y-03)
**Source:** `frontend/src/components/panel/__tests__/PendingAskCard.test.tsx:12` (`import { axe } from "vitest-axe"`) + `setupTests.ts:6-8` (`toHaveNoViolations` global)
**Apply to:** all new panel-component tests.
`expect(await axe(container)).toHaveNoViolations()` against every phase state (pending/running/done/failed/retrying) + 1-phase and N-phase.

---

## Pattern Assignments (Test Files)

### `frontend/src/providers/__tests__/phaseHooks.test.tsx` (NEW)

**Analog:** `frontend/src/providers/__tests__/panelHooks.test.tsx`

**Excerpt — the raw-SSE-through-real-normalizer harness + FC#1 reference-identity (PANEL-09 proof)** (panelHooks.test.tsx:292-313):
```typescript
// :292-313 — FC#1: a panel event does NOT change the chat bucket selector ref.
// This is the EXACT INV-1 proof for phasesByThread (swap workspace_file_written
// for a phase_started+phase_completed fixture).
const before = useStreamsStore.getState().bucketsBySurface
const cbs = panelCallbacks(THREAD_A)
const wire =
  'data: {"type":"workspace_file_written","path":"x.txt","size_bytes":1,"mime_type":"text/plain"}\n\n' +
  'data: {"type":"stream_end"}\n\n'
vi.stubGlobal("fetch", mockSseFetch([wire]))
await act(async () => { await subscribeToRun("run-1", "0", cbs) })
expect(useStreamsStore.getState().bucketsBySurface).toBe(before)   // PANEL-09 ✓
expect(useStreamsStore.getState().workspaceFilesByThread.get(THREAD_A)).toHaveLength(1)
```
Partial-mock keeps the REAL `subscribeToRun` + `makeStreamCallbacks` (panelHooks.test.tsx:59-74); override only the GET helpers (`getThreadWorkflow`). New fixture replays `phase_started`/`phase_completed`/`run_failed` raw bytes; assert `bucketsBySurface` ref unchanged AND `phasesByThread.get(threadId)` got the phase.

### `frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx` / `FailReason.test.tsx` / `PhaseReconcile.test.tsx` (NEW)

**Analog:** `frontend/src/components/panel/__tests__/PendingAskCard.test.tsx`

**Excerpt — vitest-axe + mocked-hook render** (PendingAskCard.test.tsx:9-35):
```typescript
import { axe } from "vitest-axe"                         // :12 — A11Y-03 gate
vi.mock("@/providers/StreamsProvider", () => ({          // :27-35 — feed a controlled array
  useViewingThread: () => "thread-1",
  useAskUserPrompt: () => ({ data: hookState.asks, isLoading: false, error: null, reconcile: hookState.reconcile }),
}))
```
`PhaseTimeline.test.tsx` mocks `usePhases`/`useTasks` to feed DATA-CONTRACT §7 fixtures (`fx-run-running`/`-failed`/`-done`/`-askuser-paused`/`-gatefail-retry`); axe each state + 1/N phases (INV-2). `FailReason.test.tsx` asserts a `run_failed` fixture renders FAILED not done, and `run_failed{reason:""}` renders the `reason_unknown` sentinel (INV-3 frontend). `PhaseReconcile.test.tsx` seeds reconcile `{current_phase_index:1,total_phases:3}` then replays regressing live events → assert `Phase i/N` only advances (INV-4).

### `backend/tests/test_094_rc4_failure.py` (NEW)

**Analog:** `backend/tests/test_harness_gates.py` + `backend/tests/test_harness_engine.py` (existing fail/retry harness tests)

Drive `run_workflow` to BOTH failure-return sites (a `fail_run` outcome AND a missing-skip-target guard); assert a `messages` assistant row IS persisted with the failure reason as content; assert the empty-reason case persists the `reason_unknown` sentinel (never empty); assert `_shielded_finalize` is NOT in the call path (Deep byte-identical — INV-3 backend).

---

## No Analog Found

None. Every file maps to an in-repo analog (most to a same-file precedent). The single net-new artifact without a direct precedent is the `_surface_failure_message` backend helper — and even that is a strict subset of `_surface_final_answer` (harness_engine.py:235–350).

---

## Metadata

**Analog search scope:** `frontend/src/lib/`, `frontend/src/stores/`, `frontend/src/providers/`, `frontend/src/components/panel/`, `frontend/src/components/chat/`, `frontend/src/types/`, `frontend/src/index.css`, `frontend/tailwind.config.js`, `backend/app/services/harness_engine.py`, `backend/tests/`, `frontend/src/**/__tests__/`
**Files scanned (read):** 13 (api.ts, streamsStore.ts, StreamsProvider.tsx, WorkspacePanel.tsx, PendingAskCard.tsx, ChatArea.tsx, index.css, tailwind.config.js, harness_engine.py, types/index.ts, panelHooks.test.tsx, PendingAskCard.test.tsx) + 2 Glob/Grep confirmations (zero phase-handlers, zero accent-violet)
**Pattern extraction date:** 2026-06-04

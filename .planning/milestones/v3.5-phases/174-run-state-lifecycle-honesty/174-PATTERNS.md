# Phase 174: Run-State & Lifecycle Honesty - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 11 (7 source + 4 test) — this phase MODIFIES hot files, creates few
**Analogs found:** 11 / 11 (every change has an in-file or sibling analog — no green-field code)

> **Core discipline for this phase (from RESEARCH.md):** every mechanism already exists in the codebase. The work is *wiring an already-stamped signal into an already-rendered surface*, not building new machinery. For each change below the analog is the **closest existing idiom in the SAME file or a sibling** — the executor replicates it, never invents a new shape. Deep Mode must stay byte-identical (D-14).

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `frontend/src/lib/toolMeta.ts` (STATE-03) | utility (label-derive) | transform | **itself** — the existing `isHarness` param extension on `outerBannerLabel` (`:78`) | exact (same fn) |
| `frontend/src/components/chat/MessageItem.tsx` (STATE-01b amber block) | component | request-response (render-derive) | `model-fallback-notice` amber block `:467-473` + `capPaused` amber block `:562-614` | exact |
| `frontend/src/components/chat/MessageItem.tsx` (STATE-03 call site) | component | render-derive | the `outerBannerLabel(...)` call at `:620` | exact (same site) |
| `frontend/src/providers/StreamsProvider.tsx` (STATE-01b catch) | provider/store | event-driven + request-response | the 409 branch `:2050-2068` + generic-`ApiError` branch `:2069-2084` | exact (sibling branch) |
| `frontend/src/providers/StreamsProvider.tsx` (STATE-04 `startedAt` stamp) | provider/store | event-driven | the kickoff placeholder stamp `:1856-1868` (stamps runId/model/provider) | exact (same block) |
| `frontend/src/lib/dedupMessages.ts` (STATE-04 avatar pre-runId) | utility | transform | **itself** — `dedupMessagesByRunId` `:31-53` | exact (same fn) |
| `frontend/src/components/chat/MessageList.tsx` (STATE-04 reconcile/key) | component | request-response | the dedup call `:161` + `run-${runId}` key `:180` | exact (same site) |
| `frontend/src/components/chat/RunCard.tsx` (STATE-04 timer) | component | transform (timer) | `runStartMs = startedAt ?? created_at` `:122` — **already anchored; consumer, do not edit** | exact (verify) |
| `frontend/src/types/index.ts` (STATE-01b render-only field) | model/type | — | `modelFallbackNotice?: {...}` `:205` | exact |
| `frontend/src/lib/__tests__/toolMeta.test.ts` (NEW, STATE-03) | test | unit | `frontend/src/lib/__tests__/dedupMessages.test.ts` (pure-lib describe/it) | role-match |
| NEW StreamsProvider catch test (STATE-01b) | test | event-driven | `streamsProvider_bug_260707_01_streaming_flag.test.tsx` (vi.hoisted mock harness) | exact |
| `MessageItem.test.tsx` extend (STATE-01a/03) | test | component | `MessageItem.fallbackNotice.test.tsx` (render + testid assert) | exact |
| reconcile-race / dedup test extend (STATE-04 avatar) | test | event-driven | `streamsProvider_075_7_reconcile_race.test.tsx` + `dedupMessages.test.ts` | exact |
| `backend/app/api/threads.py` (STATE-01a/02) | route (API enrich) | request-response | **VERIFY-ONLY** — no change; `:346-353` zip already correct | n/a |

---

## Pattern Assignments

### `frontend/src/lib/toolMeta.ts` — STATE-03 (utility, transform)

**Analog:** the function `outerBannerLabel` **itself** — it already carries a precedent for an additive, default-valued, Deep-byte-identical param (`isHarness = false`, added for BUG-260609-02). STATE-03 replicates that exact extension shape with `reasoningActive = false`.

**Existing signature + the branch to extend** (`toolMeta.ts:68-100`):
```typescript
export function outerBannerLabel(
  activeTool: ToolCall | null,
  hasAnyTools: boolean,
  isPlanning: boolean,
  // ... a Harness/workflow run shows "Starting workflow…" ... Deep mode
  // (isHarness=false, the default) is byte-identical.
  isHarness = false,
): string {
  if (!hasAnyTools && !isPlanning) return isHarness ? "Starting workflow…" : "Setting up agent…"
  if (isPlanning) return "Thinking…"
  if (!activeTool) return "Synthesizing answer…"
  // …every other tool branch unchanged…
}
```

**Copy-this idiom (the `isHarness` precedent):** add `reasoningActive = false` as a NEW trailing default-valued param and branch it INSIDE the existing `if (!hasAnyTools && !isPlanning)` arm only. The default keeps every existing caller and Deep Mode byte-identical (D-14) — exactly how `isHarness` was added:
```typescript
  reasoningActive = false,   // NEW — default false keeps every existing caller byte-identical
): string {
  if (!hasAnyTools && !isPlanning) {
    if (reasoningActive) return "Reasoning…"                      // STATE-03 (130-C sub-state)
    return isHarness ? "Starting workflow…" : "Setting up agent…" // unchanged fallback
  }
  // …every other branch byte-identical…
```
> **D-14 guard:** `outerBannerLabel(null,false,false,false,false)` MUST still return `"Setting up agent…"`. Only the new `reasoningActive=true` path returns `"Reasoning…"`.

---

### `frontend/src/components/chat/MessageItem.tsx` — STATE-03 call site (component, render-derive)

**Analog:** the existing call site at `:620`, inside the `isStreaming && !hasAnyTools` "first LLM call is thinking" branch (`:616-626`).

**Current call site** (`MessageItem.tsx:616-626`):
```tsx
) : isStreaming && !hasAnyTools ? (
  // No tools yet — first LLM call is thinking
  <span className="flex items-center gap-2 text-muted-foreground text-sm animate-fadeSlideUp">
    <Loader2 className="w-4 h-4 animate-spin text-primary" />
    <span className="italic">{outerBannerLabel(null, false, message.isPlanning ?? false, workflowLock != null)}</span>
    <span className="flex gap-1 items-center">…dot-bounce…</span>
  </span>
) : message.runStatus === "cancelled" ? (
```

**Copy-this idiom:** derive `reasoningActive` from the ALREADY-stamped `message.reasoningContent` (no new state) and pass it as the 5th arg:
```tsx
const reasoningActive = !message.content && !!message.reasoningContent   // STATE-03 signal, cross-provider
…
<span className="italic">{outerBannerLabel(null, false, message.isPlanning ?? false, workflowLock != null, reasoningActive)}</span>
```
> **Pitfall (RESEARCH Pitfall 1):** this call site is reached ONLY in the `!hasAnyTools` window. Do NOT add tool-name branches here — the moment a tool appears, `hasAnyTools` flips and the render hands off to `RunStatusStrip`. Scope STATE-03 to the reasoning-before-any-tool window only.

---

### `frontend/src/components/chat/MessageItem.tsx` — STATE-01b amber block (component, render-derive)

**Analog (primary, D-06):** the `model-fallback-notice` amber primitive at `:467-473` — the EXACT class string the SPEC (A7) locks in.

**Copy-this styling primitive verbatim** (`MessageItem.tsx:467-473`):
```tsx
{message.role === "assistant" && message.modelFallbackNotice && (
  <div
    data-testid="model-fallback-notice"
    className="mt-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-400/90"
  >
    {message.modelFallbackNotice.message}
  </div>
)}
```

**Analog (secondary — the amber notice-with-heading shape):** the `capPaused` amber block at `:562-614` shows the same border/bg with a `flex-col gap-1.5` + `text-amber-400` heading if STATE-01b wants the optional 129-C secondary line:
```tsx
<div className="mt-2 flex flex-col gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2">
  <span className="text-xs text-amber-400">{/* reason copy */}</span>
</div>
```

**Copy-this idiom for STATE-01b:** add a NEW sibling render block, gated on the new render-only field (see types analog below), reusing the `border-amber-400/30 bg-amber-400/10 text-amber-400/90` classes and giving it a stable `data-testid` (e.g. `blocked-notice`). Render `blockedNotice.message` as **React text children only** (never `dangerouslySetInnerHTML` — A23/V5 XSS).

---

### `frontend/src/components/chat/MessageItem.tsx` — STATE-01a/02 terminal render (component) — VERIFY ONLY

**Analog / existing code to NOT rebuild** (Anti-Pattern in RESEARCH): both render conditions already exist and are correct.

Cancelled-no-output (`MessageItem.tsx:627-644`):
```tsx
) : message.runStatus === "cancelled" ? (
  <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="cancelled-no-output">
    <Square className="w-3 h-3" />
    <span className="italic">cancelled — no output yet</span>
  </div>
) : null}
```

Persistent "Response stopped" indicator (`MessageItem.tsx:670-680`) — the reload-persist Pattern S1:
```tsx
{(message.stopped ||
  message.runStatus === "timed_out" ||
  (message.runStatus === "cancelled" && !!message.content)) &&
  !isStreaming && (
  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
    <Square className="w-3 h-3" />
    <span className="italic">
      {message.runStatus === "timed_out" ? "Agent reached time limit" : "Response stopped"}
    </span>
  </div>
)}
```
> **Do not touch these blocks.** STATE-01a/02 are VERIFY tasks (D-01/D-02). A surgical fix fires ONLY if live UAT contradicts the derive — and then at the `threads.py` join / `api.ts` map, not here.

---

### `frontend/src/providers/StreamsProvider.tsx` — STATE-01b catch branch (provider, event-driven)

**Analog:** the sibling branches in the same `catch` at `:2047-2093`. The new `403` branch is inserted **between** the 409 branch (`:2050-2068`) and the generic `ApiError` branch (`:2069-2084`) so the narrowest status is matched first and the 400/409 rollback paths stay byte-identical (D-05).

**Existing 409 branch — the rollback-banner shape to DIVERGE FROM** (`StreamsProvider.tsx:2050-2068`):
```tsx
} else if (err instanceof ApiError && err.status === 409) {
  // Roll back BOTH optimistic bubbles … then a per-thread reconcileErrors banner
  useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
    prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id),
  )
  useStreamsStore.setState((s) => ({
    reconcileErrors: new Map(s.reconcileErrors).set(
      threadId,
      new ApiError("This thread is running a workflow — cancel it to send a Deep message.", 409),
    ),
  }))
} else if (err instanceof ApiError) {
  // 099-08: the 400 disabled-skill gate — SAME rollback shape + failedSendDrafts stash.
  useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
    prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id),
  )
  useStreamsStore.setState((s) => ({
    reconcileErrors: new Map(s.reconcileErrors).set(threadId, err),
    failedSendDrafts: new Map(s.failedSendDrafts).set(threadId, content),
  }))
}
```

**Copy-this idiom for STATE-01b (new branch, insert at `:2069` BEFORE the generic `ApiError`):**
```tsx
} else if (err instanceof ApiError && err.status === 403) {
  // 129-C AMBER tier: an administrative block (workflow kill-switch / app-layer ban).
  // DIVERGE from the 409/400 rollback: KEEP the user bubble, REPLACE the empty
  // assistant placeholder with an honest in-chat amber notice carrying the server msg.
  useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
    prev.map((m) =>
      m.id === assistantId ? { ...m, blockedNotice: { message: err.message } } : m,
    ),
  )
  // D-04: guarantee the composer is never left locked (defensive no-op if unseeded).
  useStreamsStore.getState().actions.clearWorkflowLockForThread(threadId)
}
```
Load-bearing parts: the `status === 403` discriminator (RESEARCH Open Q5), the placeholder-swap (not rollback), and the defensive `clearWorkflowLockForThread(threadId)` — using the OWNING `threadId` closure (A25 per-thread isolation), which is exactly how the sibling branches key `setMessagesForBucket`/`reconcileErrors`.

**`clearWorkflowLockForThread` is an existing store action** — already called defensively at `StreamsProvider.tsx:2023` and `:1731`; store impl at `streamsStore.ts:2511`. Do not add a new mutator.

> **Pitfall (RESEARCH Pitfall 5):** the 403 fires BEFORE any run/message INSERT (fail-closed). There is no run_id, no DB row. The branch is a pure frontend placeholder-swap + lock-clear — do NOT query `runs` or try to mark a run cancelled.

---

### `frontend/src/providers/StreamsProvider.tsx` — STATE-04 `startedAt` stamp (provider, event-driven)

**Analog:** the kickoff placeholder stamp at `:1856-1868`, which already stamps `runId`/`model`/`provider` onto the optimistic assistant row — STATE-04 adds `startedAt` in the SAME `.map`.

**Existing stamp** (`StreamsProvider.tsx:1856-1868`):
```tsx
useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
  prev.map((m) => {
    if (m.id === userMsg.id) return { ...m, id: message_id }
    if (m.id === assistantId)
      return {
        ...m,
        runId: run_id,
        model: resolvedModel ?? undefined,
        provider: resolvedProvider ?? undefined,
      }
    return m
  }),
)
```

**Copy-this idiom:** add `startedAt` to the assistant-row branch so the RunCard timer (`RunCard.tsx:122` — already anchored on `message.startedAt`) survives a nav-back remount instead of reseeding from `created_at`:
```tsx
      return {
        ...m,
        runId: run_id,
        model: resolvedModel ?? undefined,
        provider: resolvedProvider ?? undefined,
        startedAt: new Date().toISOString(),  // NEW — anchor survives nav-back remount
      }
```
> **Source of the anchor (RESEARCH A1 / Pattern 4):** the kickoff `postMessage` response currently returns only `{ message_id, run_id, model, provider }` (verified at `StreamsProvider.tsx:1807-1818`) — it does NOT include `started_at`. So use **client send-time** (`new Date().toISOString()`) as the anchor; drift ≤ one RTT, and the persisted `runs.started_at` enrich corrects it on the next hydrate via `api.ts` (`started_at → startedAt`, `:203`). Do NOT add a backend field (D-14).
> **Pitfall (RESEARCH Pitfall 3):** fix the SOURCE (the placeholder stamp), NOT the consumer. `RunCard.tsx:122-177` `runStartMs`/`frozenEndRef` machinery is the already-correct 095.1 fix — feed it `startedAt`, never edit it.

---

### `frontend/src/lib/dedupMessages.ts` + `MessageList.tsx` — STATE-04 avatar dedup (utility + component, transform)

**Analog:** `dedupMessagesByRunId` **itself** (`dedupMessages.ts:31-53`) — it already collapses same-`runId` temp↔persisted twins; the uncovered gap is the **pre-runId** window (RESEARCH Pitfall 4).

**Existing dedup** (`dedupMessages.ts:31-53`):
```typescript
export function dedupMessagesByRunId(messages: Message[]): Message[] {
  const result: Message[] = []
  const runIdToIndex = new Map<string, number>()
  for (const msg of messages) {
    const runKey = msg.role === "assistant" && msg.runId ? msg.runId : null
    if (!runKey) { result.push(msg); continue }          // ← pre-runId rows pass THROUGH uncollapsed (the gap)
    const existingIdx = runIdToIndex.get(runKey)
    if (existingIdx === undefined) {
      runIdToIndex.set(runKey, result.length); result.push(msg)
    } else {
      const existing = result[existingIdx]
      const existingIsTemp = typeof existing.id === "string" && existing.id.startsWith("temp-")
      const incomingIsTemp = typeof msg.id === "string" && msg.id.startsWith("temp-")
      if (existingIsTemp && !incomingIsTemp) result[existingIdx] = msg   // temp → persisted swap
    }
  }
  return result
}
```

**MessageList consumer seam** (`MessageList.tsx:161` + key `:180`):
```tsx
const renderMessages = dedupMessagesByRunId(messages)          // :161 — the dedup seam
…
key={msg.role === "assistant" && msg.runId ? `run-${msg.runId}` : msg.id}   // :180 — key is FINE
```

**Copy-this idiom:** extend the dedup INPUT (a pre-runId fallback: collapse a `temp-` assistant placeholder against an incoming assistant row for the same thread when neither has a `runId` yet) and/or close the reconcile-insert orphan. Preserve the existing invariants: order-preserving, keep-persisted-over-temp, no-op for user rows / rows without a runId.
> **Anti-pattern (RESEARCH Pitfall 4):** do NOT touch the `MessageList.tsx:180` key — the key is correct; the dedup INPUT is the gap.

---

### `frontend/src/types/index.ts` — STATE-01b render-only field (model/type)

**Analog:** `modelFallbackNotice?: { … }` at `:205` — a render-only optional object field stamped by StreamsProvider and read once in MessageItem.

**Existing field** (`types/index.ts:199-205`):
```typescript
reasoningContent?: string
…
modelFallbackNotice?: { disabledModel: string; fallbackModel: string; message: string }
```

**Copy-this idiom:** add a parallel optional field for STATE-01b, e.g.:
```typescript
blockedNotice?: { message: string }   // STATE-01b — server ApiError.message for the amber administrative-block bubble
```
Same shape family (optional, render-only, no persistence, no migration).

---

### `frontend/src/components/chat/RunCard.tsx` — STATE-04 timer (component) — VERIFY / CONSUMER ONLY

**Analog / already-correct code** (`RunCard.tsx:122`) — the 095.1 anchor STATE-04 EXTENDS by feeding it a stamped `startedAt` (see the StreamsProvider stamp above). Do not edit this derivation:
```tsx
const runStartMs = message.startedAt ? Date.parse(message.startedAt) : Date.parse(message.created_at)
```
> Plan Wave-0 confirmation (RESEARCH Open Q4 / A3): confirm whether the workflow run-receipt renders through `RunCard` (`tool_calls>0`, gate at `MessageItem.tsx:437`) or a separate strip. If a separate strip owns the workflow timer, apply the SAME `startedAt ?? created_at` derivation there.

---

## Shared Patterns

### Amber administrative-block tier (129-C / D-06)
**Source:** `MessageItem.tsx:467-473` (`model-fallback-notice`) — classes `border-amber-400/30 bg-amber-400/10 text-amber-400/90`.
**Apply to:** STATE-01b amber bubble. Reuse the class string verbatim (SPEC A7 forbids bespoke amber CSS). Render the server string as React text children only (A23 XSS).

### Additive default-valued param, Deep-byte-identical (D-14)
**Source:** `toolMeta.ts:78` — the `isHarness = false` extension precedent.
**Apply to:** STATE-03 `reasoningActive = false`. New param defaults false → every existing caller + Deep Mode byte-identical. Only the new-true path changes copy.

### Narrowest-status-first catch branch, per-thread keyed (D-05 / A25)
**Source:** the `catch` ladder at `StreamsProvider.tsx:2050-2093` — 409 → generic ApiError → network, each keyed by the OWNING `threadId` closure via `setMessagesForBucket(surfaceId, threadId, …)` / `reconcileErrors.set(threadId, …)`.
**Apply to:** STATE-01b (`status === 403` inserted before generic), and its `clearWorkflowLockForThread(threadId)` uses the same OWNING closure — never a global flag (BUG-260523-01).

### Render-only optional Message field, no persistence
**Source:** `types/index.ts:205` `modelFallbackNotice` + its single StreamsProvider stamp + single MessageItem read.
**Apply to:** STATE-01b `blockedNotice`. No migration; `runs.status`/`started_at` stay authoritative (FND-01 / Phase 145).

### `started_at`-anchored elapsed timer (095.1)
**Source:** `RunCard.tsx:122` `runStartMs = startedAt ?? created_at` + the `frozenEndRef`/`wasStreamingRef` machinery (`:135-177`).
**Apply to:** STATE-04 — stamp `startedAt` at the SOURCE (kickoff placeholder), reuse this derivation as the consumer (never re-implement a `setInterval` accumulator).

### Cross-provider reasoning signal (already normalized)
**Source:** `openai_compat.py:285-328` (backend, unchanged) → `StreamsProvider.tsx:405-413` `onReasoningDelta` → `message.reasoningContent`.
**Apply to:** STATE-03. The signal is cross-provider (DeepSeek, Moonshot/Kimi, MiniMax, zhipu/GLM, OpenAI-reasoning) with NO backend change. Anthropic/Google never emit it → they keep the calm "Setting up agent…" fallback by design (RESEARCH Pitfall 2 — not a bug).

---

## Test Pattern Assignments

### NEW `frontend/src/lib/__tests__/toolMeta.test.ts` (STATE-03 + D-14 guard)
**Analog:** `frontend/src/lib/__tests__/dedupMessages.test.ts` — a pure-lib `describe`/`it` file importing the function directly, no React.
**Copy-this idiom (from dedupMessages.test.ts):**
```typescript
import { describe, it, expect } from "vitest"
import { outerBannerLabel } from "@/lib/toolMeta"
// assert outerBannerLabel(null,false,false,false,false) === "Setting up agent…" (D-14 byte-identical)
// assert outerBannerLabel(null,false,false,false,true)  === "Reasoning…"        (STATE-03)
// assert outerBannerLabel(null,false,false,true,false)  === "Starting workflow…" (harness unchanged)
```

### NEW StreamsProvider catch test (STATE-01b)
**Analog:** `frontend/src/__tests__/providers/streamsProvider_bug_260707_01_streaming_flag.test.tsx` (and its sibling `streamsProvider_075_7_reconcile_race.test.tsx`) — the `vi.hoisted` API-mock harness.
**Copy-this idiom (mock scaffold, verbatim shape from both files):**
```typescript
const { mockPostMessage, mockSubscribeToRun, mockGetMessages, mockGetActiveRuns, mockGetSnapshot, mockCancelRun } =
  vi.hoisted(() => ({ mockPostMessage: vi.fn(), mockSubscribeToRun: vi.fn(), /* … */ }))
vi.mock("@/lib/api", () => ({ postMessage: mockPostMessage, subscribeToRun: mockSubscribeToRun, /* … */ }))
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue(/* session */) }, … } }))
```
Drive: make `postMessage` reject with `new ApiError("Workflows are currently disabled by the administrator", 403)`; assert the assistant bucket row gets `blockedNotice`, `clearWorkflowLockForThread` is called, the user bubble survives, AND the 400/409 paths are unchanged (regression rows).

### EXTEND `frontend/src/__tests__/components/MessageItem.test.tsx` (STATE-01a empty-content + STATE-03 label)
**Analog:** `frontend/src/__tests__/components/MessageItem.fallbackNotice.test.tsx` — the `renderWithTooltip` + `makeMessage(overrides)` + `getByTestId` harness.
**Copy-this idiom (from fallbackNotice.test.tsx):**
```tsx
function renderWithTooltip(ui: ReactElement) { return render(<TooltipProvider>{ui}</TooltipProvider>) }
function makeMessage(overrides: Partial<Message> = {}): Message { return { id:"msg-1", role:"assistant", content:"", …, ...overrides } as Message }
// STATE-01a: makeMessage({ content:"", runStatus:"cancelled" }) → getByTestId("cancelled-no-output")
// STATE-01b: makeMessage({ content:"", blockedNotice:{ message:"…disabled by the administrator" } }) → getByTestId("blocked-notice") + verbatim server text
```

### EXTEND reconcile-race / dedup tests (STATE-04 avatar pre-runId)
**Analog:** `streamsProvider_075_7_reconcile_race.test.tsx` (forces the exact pre-runId race ordering deterministically via manual resolvers) + `dedupMessages.test.ts` (the pure-dedup invariants).
**Copy-this idiom (dedup invariant assertion, from dedupMessages.test.ts):** add a pre-runId case — two `temp-` assistant rows for the same thread with NO `runId` → assert they collapse to one (single avatar) while still leaving genuine harness rows-without-runId untouched (`:61-68` existing case must stay green).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — none — | — | — | Every change has an exact in-file or sibling analog. This phase adds zero green-field code paths (RESEARCH: "every mechanism this phase needs already exists"). |

---

## Metadata

**Analog search scope:** `frontend/src/components/chat/`, `frontend/src/providers/`, `frontend/src/lib/`, `frontend/src/types/`, `frontend/src/**/__tests__/`, `backend/app/api/threads.py` (read-only verify).
**Files scanned:** ~14 source + test files read this session (all file:line anchors re-verified against live source, matching RESEARCH.md).
**Pattern extraction date:** 2026-07-22
**Deep-byte-identical guard (D-14):** the two load-bearing byte-identical invariants for the checker/executor — `outerBannerLabel(null,false,false,false,false)` → `"Setting up agent…"`, and a Deep run with no terminal state renders the calm transcript unchanged.

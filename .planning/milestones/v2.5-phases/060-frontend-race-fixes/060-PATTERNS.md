# Phase 060: Frontend Race Fixes - Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 4 (3 modified + 1 new test)
**Analogs found:** 4 / 4 (all in-file or sibling-file analogs — Phase 060 is a surgical refactor, not a greenfield feature)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/hooks/useMessages.ts` | hook | event-driven + request-response | (self — same file's `streamMessage` AbortController wiring + existing `loadMessages`) | exact (in-file precedent) |
| `frontend/src/components/chat/ChatArea.tsx` | component | event-driven (effect on thread change) | (self — current `useEffect([thread?.id, ...])` body) | exact (in-file precedent) |
| `frontend/src/lib/api.ts` (`getMessages`) | api-wrapper | request-response (fetch) | `streamMessage` (same file, lines 97-132) — already accepts `signal?: AbortSignal` | exact (sibling function in same file) |
| `e2e/tests/060-thread-race.spec.ts` (new) | test | event-driven (Playwright DOM + network) | `e2e/tests/threads.spec.ts` + `e2e/tests/rag-retrieval.spec.ts` | exact (existing Playwright E2E infra) |

**Browser-test precedent decision:** Existing browser/E2E tests live in `e2e/tests/*.spec.ts` using Playwright (`@playwright/test ^1.49.0`). The CONTEXT proposes `tests/browser/060-thread-race.test.ts` but `tests/browser/` does not exist. **Recommendation: place the new test in `e2e/tests/060-thread-race.spec.ts`** to reuse the existing `playwright.config.ts`, `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` env-var pattern, and `signIn(page)` helper. The chrome-MCP framing in D-060-12 is satisfied by Playwright's Chromium driver (Playwright IS chrome-MCP-compatible — `e2e/node_modules/playwright/lib/mcp/browser/` confirms the bundled MCP transport). Alternatives `tests/browser/` and `frontend/tests/e2e/` have no precedent — creating either would orphan the test from the existing harness.

## Pattern Assignments

### `frontend/src/hooks/useMessages.ts` (hook, event-driven + request-response)

**Analog:** Same file (in-file precedent — every pattern below is a reuse of an established idiom in this file).

---

#### Pattern 1: `useCallback([])` stable-identity convention

**Source:** `frontend/src/hooks/useMessages.ts:38-53` (existing `stopStreaming`, `abortStream`, `clearMessages`)

```typescript
// useMessages.ts:38-45
const stopStreaming = useCallback(() => {
  stoppedByUserRef.current = true
  abortControllerRef.current?.abort()
}, [])

const abortStream = useCallback(() => {
  abortControllerRef.current?.abort()
}, [])

// useMessages.ts:47-53
const clearMessages = useCallback(() => {
  setMessages([])
  setIsStreaming(false)
  abortControllerRef.current?.abort()      // ← REMOVED in 060 per D-060-10
  abortControllerRef.current = null         // ← REMOVED in 060 per D-060-10
  isSendingRef.current = false
}, [])
```

**Apply to (D-060-01):** new `setViewingThread`. Uses the exact same `useCallback([], )` shape — no deps. The empty dep array is what guarantees the stable identity that lets ChatArea's reduced `[thread?.id]` effect dep-array (D-060-09) be safe.

```typescript
// New in 060 — placed alongside other ref-mutator callbacks (top of hook body)
const setViewingThread = useCallback((threadId: string | null) => {
  activeThreadIdRef.current = threadId
}, [])
```

---

#### Pattern 2: AbortController wiring (per-call create + ref-store + signal-thread)

**Source:** `frontend/src/hooks/useMessages.ts:149-150, 419, 421-426` inside `sendMessage`

```typescript
// useMessages.ts:149-150 — create + store
const controller = new AbortController()
abortControllerRef.current = controller

// useMessages.ts:419 — thread signal into the fetch wrapper as the LAST arg
controller.signal,
)

// useMessages.ts:421-426 — AbortError-swallow idiom (CANONICAL — D-060-11 reuses verbatim)
} catch (err) {
  // Swallow abort errors — user intentionally stopped
  if (!(err instanceof Error && err.name === "AbortError")) {
    console.error(err)
  }
} finally {
```

**Apply to (D-060-02, D-060-03, D-060-11):** new `loadAbortRef` + rewritten `loadMessages`. The pattern is "abort previous, install new, thread signal, swallow AbortError on catch."

```typescript
// New ref declaration — placed alongside abortControllerRef (line 29)
const loadAbortRef = useRef<AbortController | null>(null)

// Rewritten loadMessages (replaces useMessages.ts:98-114)
const loadMessages = useCallback(async (threadId: string) => {
  loadAbortRef.current?.abort()                                  // cancel previous in-flight
  const controller = new AbortController()                       // fresh controller per call
  loadAbortRef.current = controller
  try {
    const data = await getMessages(threadId, controller.signal)  // thread signal through
    if (activeThreadIdRef.current !== threadId) return           // POST-AWAIT guard (D-060-02)
    if (isSendingRef.current) return                             // protect optimistic placeholders
    setMessages(data)
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return  // D-060-11 — mirrors line 423
    throw err
  }
}, [])
```

**Critical detail:** The `activeThreadIdRef.current !== threadId` check happens **after** `await getMessages(...)`. This is the cross-thread response discard that the deferral document (`057-DEFERRAL.md §"loadMessages was overwriting its own guard"`) identifies as mandatory. Reading `activeThreadIdRef` before the await would compare the ref to itself (since D-060-01 deletes the pre-await write at line 99) and always pass.

---

#### Pattern 3: `setMessages` updater discipline — no side effects inside

**Source:** `frontend/src/hooks/useMessages.ts:475-498` (existing `finally`-block pattern documented in PROJECT.md Key Decisions: *"loadMessages outside React state updater (v2.4 Phase 57) — Side effects (loadMessages, stoppedByUserRef reset) must be outside setMessages updater — Strict Mode double-invokes updaters and bail-out optimization can skip them entirely."*)

```typescript
// useMessages.ts:475-498 — pure setMessages updater + side effects after
setMessages((prev) => {
  const lastMsg = prev[prev.length - 1]
  if (lastMsg?.id === assistantId) {
    return prev.map((m) =>
      m.id === assistantId
        ? { ...m, ...(wasStoppedByUser ? { stopped: true } : {}) }
        : m
    )
  }
  return prev
})

// Reset stopped ref outside any state updater so it runs exactly once
stoppedByUserRef.current = false

// Side effect call — NOT inside setMessages
if (!wasStoppedByUser && activeThreadIdRef.current === threadId) {
  loadMessages(threadId).catch(console.error)        // ← DELETED in 060 per D-060-05
}
```

**Apply to (D-060-02):** the `if (activeThreadIdRef.current !== threadId) return` guard in the new `loadMessages` is a plain post-await read — NOT inside a `setMessages` updater. Use `setMessages(data)` (replacement form), not `setMessages(prev => ...)` with a guard inside. This matches the established pattern and avoids the Strict Mode double-invoke pitfall already documented for this file.

---

#### Pattern 4: Deletions (Phase 057 band-aid removal)

**Source:** `frontend/src/hooks/useMessages.ts:32, 33, 55-96, 152-200, 437-444` — all to be deleted per D-060-06/07.

| Lines | What | Why deleted |
|-------|------|-------------|
| 32 | `const channelRef = useRef<ReturnType<typeof supabase.channel> \| null>(null)` | per-stream Realtime ref no longer needed (D-060-06) |
| 33 | `const threadChannelRef = useRef<ReturnType<typeof supabase.channel> \| null>(null)` | always-on Realtime ref no longer needed (D-060-07) |
| 36 | `const reloadTimerRef = useRef<ReturnType<typeof setTimeout> \| null>(null)` | only used by deleted `subscribeToThread` debounce — delete with it |
| 55-96 | `subscribeToThread` + `unsubscribeFromThread` callbacks | D-060-07 — Phase 061 will reintroduce recovery via polling |
| 152-200 | per-stream `supabase.channel("messages-thread-${threadId}")` block | D-060-06 — no longer needed once `finally`-reload is removed |
| 437-444 | `channelToRemove` + `setTimeout(..., navigatedAway ? 0 : 2000)` teardown dance | D-060-06 — channel itself deleted, teardown irrelevant |
| 495-497 | `if (!wasStoppedByUser && activeThreadIdRef.current === threadId) { loadMessages(threadId).catch(console.error) }` | D-060-05 — Bug 3 raw-JSON regression source |
| 99 | `activeThreadIdRef.current = threadId` (top of `loadMessages`) | D-060-01 — `setViewingThread` is the sole writer |
| 50-51 | `abortControllerRef.current?.abort()` + `abortControllerRef.current = null` (in `clearMessages`) | D-060-10 — caller (ChatArea) aborts explicitly via `abortStream()` first |

**Interface impact:** `UseMessages` interface (lines 6-17) loses `subscribeToThread` and `unsubscribeFromThread`. Adds `setViewingThread: (threadId: string \| null) => void`.

---

### `frontend/src/components/chat/ChatArea.tsx` (component, event-driven)

**Analog:** Same file (in-file precedent — `useEffect([thread?.id])` is being rewritten, not invented).

---

#### Pattern 5: Thread-change effect ordering (rewritten)

**Source:** `frontend/src/components/chat/ChatArea.tsx:68-108` (current effect — to be replaced).

**Current (to delete):**
```typescript
// ChatArea.tsx:68-108
useEffect(() => {
  if (!thread) {
    clearMessages()
    unsubscribeFromThread()           // ← deleted in 060
    return
  }
  if (justCreatedThreadRef.current === thread.id) {
    justCreatedThreadRef.current = null
    return
  }
  clearMessages()
  abortStream()
  loadMessages(thread.id).catch(console.error)
  subscribeToThread(thread.id)        // ← deleted in 060

  // 8s fallback timer — DELETED per D-060-07b
  const fallbackTimer = setTimeout(() => {
    loadMessages(thread.id).catch(console.error)
  }, 8000)

  // visibilitychange listener — DELETED per D-060-07c
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      loadMessages(thread.id).catch(console.error)
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)

  return () => {
    unsubscribeFromThread()
    clearTimeout(fallbackTimer)
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}, [thread?.id, loadMessages, abortStream, clearMessages, subscribeToThread, unsubscribeFromThread])
```

**Replacement (D-060-08, D-060-09):**
```typescript
useEffect(() => {
  setViewingThread(thread?.id ?? null)            // ← FIRST — D-060-08
  if (!thread) {
    clearMessages()
    return
  }
  if (justCreatedThreadRef.current === thread.id) {
    justCreatedThreadRef.current = null
    return
  }
  abortStream()                                    // ← THEN abort
  clearMessages()                                  // ← THEN clear (no longer aborts internally per D-060-10)
  loadMessages(thread.id).catch(console.error)    // ← FINALLY load with the fresh activeThreadIdRef
  // No fallbackTimer, no visibilitychange — Phase 061 reintroduces these properly.
  // No cleanup function needed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [thread?.id])                                   // ← D-060-09: dep array reduced to [thread?.id]
```

**Why this exact order (D-060-08):**
1. `setViewingThread(thread?.id ?? null)` first — must be set BEFORE any concurrent `loadMessages` resolution checks `activeThreadIdRef`.
2. `abortStream()` — kills the previous SSE (was previously inside `clearMessages`; D-060-10 moved it out).
3. `clearMessages()` — wipes UI state (no longer aborts; just `setMessages([])`/`setIsStreaming(false)`/`isSendingRef.current = false`).
4. `loadMessages(thread.id)` — fresh fetch, post-await guard sees the new `activeThreadIdRef` from step 1.

**Why dep array `[thread?.id]` only (D-060-09):** All four callbacks (`setViewingThread`, `abortStream`, `clearMessages`, `loadMessages`) are `useCallback([])` in `useMessages` and have stable identity across renders. Including them is defensive noise. ESLint suppression style: prefer the inline `// eslint-disable-next-line react-hooks/exhaustive-deps` comment placed on the line directly before the closing `}, [thread?.id])` — it's the most localized and survives auto-format.

**Destructure update:** Line 27 must drop `subscribeToThread`, `unsubscribeFromThread` and add `setViewingThread`:
```typescript
// ChatArea.tsx:27 — current
const { messages, isStreaming, fallbackNotice, loadMessages, sendMessage, stopStreaming, abortStream, clearMessages, subscribeToThread, unsubscribeFromThread } = useMessages()

// After 060
const { messages, isStreaming, fallbackNotice, loadMessages, sendMessage, stopStreaming, abortStream, clearMessages, setViewingThread } = useMessages()
```

---

### `frontend/src/lib/api.ts` (`getMessages`)

**Analog:** `streamMessage` in the same file (lines 97-132) — the closest existing fetch wrapper that already accepts an `AbortSignal`.

---

#### Pattern 6: Optional `AbortSignal` parameter threaded into `fetch`

**Source:** `frontend/src/lib/api.ts:97-132` — `streamMessage` signature ends with `signal?: AbortSignal` and forwards it.

```typescript
// api.ts:97-132 (selected)
export async function streamMessage(
  threadId: string,
  content: string,
  onDelta: (text: string) => void,
  onDone: () => void,
  // ...22 more callback params...
  signal?: AbortSignal,                   // ← LAST positional param, optional
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content, model, provider, agent_mode: agentMode ?? "default" }),
    signal,                               // ← passed straight to fetch options
  })
  // ...
}
```

**Apply to (D-060-04):** add optional `signal` to `getMessages` (currently lines 48-71 of api.ts).

**Current:**
```typescript
// api.ts:48-71
export async function getMessages(threadId: string): Promise<Message[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, { headers })
  if (!res.ok) throw new Error("Failed to get messages")
  const data = await res.json() as Array<Message & {
    source_refs?: Citation[]
    confidence_level?: string
    confidence_avg_similarity?: number
    confidence_disclaimer?: string | null
  }>
  // ... mapping logic preserved verbatim ...
  return data.map((m) => { /* unchanged */ })
}
```

**Replacement:**
```typescript
export async function getMessages(threadId: string, signal?: AbortSignal): Promise<Message[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, { headers, signal })
  if (!res.ok) throw new Error("Failed to get messages")
  const data = await res.json() as Array<Message & {
    source_refs?: Citation[]
    confidence_level?: string
    confidence_avg_similarity?: number
    confidence_disclaimer?: string | null
  }>
  // ... mapping logic preserved verbatim — DO NOT TOUCH ...
  return data.map((m) => {
    const { source_refs, confidence_level, confidence_avg_similarity, confidence_disclaimer, ...rest } = m
    const mapped: Message = { ...rest, citations: (source_refs ?? []) as Citation[] }
    if (confidence_level) {
      mapped.confidence = {
        level: confidence_level as "high" | "medium" | "low",
        avg_similarity: confidence_avg_similarity ?? 0,
        disclaimer: confidence_disclaimer ?? null,
      }
    }
    return mapped
  })
}
```

**Caller compatibility:** Existing callers without a signal continue to work unchanged. Search confirms only `useMessages.ts:101` calls `getMessages` — and that call site is rewritten in D-060-02 to pass `controller.signal`. No other consumer needs updating.

**Backend behaviour (per CONTEXT.md "Integration Points"):** FastAPI/Starlette already handles `AbortController.abort()` as TCP RST → `http.disconnect`. No backend change.

---

### `e2e/tests/060-thread-race.spec.ts` (new browser test)

**Analog:** `e2e/tests/threads.spec.ts` (closest by data flow — chat / thread navigation) + `e2e/tests/rag-retrieval.spec.ts` (closest by complexity — multi-step async with timeout-aware assertions).

---

#### Pattern 7: Playwright spec layout (imports, env-var skip, signIn helper, describe block)

**Source:** `e2e/tests/threads.spec.ts:1-30` and `e2e/tests/rag-retrieval.spec.ts:1-29`.

```typescript
// threads.spec.ts:1-30 — canonical setup
import { test, expect, type Page } from "@playwright/test"

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? ""
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ""
const hasCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD)

async function signIn(page: Page) {
  await page.goto("/")
  const emailInput = page.getByRole("textbox", { name: /email/i })
  if ((await emailInput.count()) === 0) return // already signed in
  await emailInput.fill(TEST_EMAIL)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.getByRole("button", { name: /sign in/i }).click()
  await expect(page.getByText(/new chat/i)).toBeVisible({ timeout: 15_000 })
}

test.describe("Threads", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasCredentials) test.skip()
    await signIn(page)
  })
  // ...tests...
})
```

**Apply to:** the new `060-thread-race.spec.ts`. Copy the `signIn` helper verbatim (or move to a shared `e2e/tests/_helpers.ts` if Phase 062 wants to consolidate; for 060 inline duplication is acceptable). Reuse `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` env vars — no new env contract.

---

#### Pattern 8: Multi-step async chat assertions with `toBeVisible({ timeout })`

**Source:** `e2e/tests/threads.spec.ts:53-79` and `rag-retrieval.spec.ts:62-103`.

```typescript
// threads.spec.ts:66-79 — send message + wait for assistant
test("assistant response streams in after user message", async ({ page }) => {
  await page.getByRole("button", { name: /new chat/i }).click()

  const messageInput = page.getByRole("textbox", { name: /message|type/i }).or(
    page.locator("textarea"),
  )
  await messageInput.fill("Say exactly: PONG")
  await page.keyboard.press("Enter")

  await expect(
    page.locator('[data-role="assistant"], .bg-muted').first(),
  ).toBeVisible({ timeout: 30_000 })
})
```

**Apply to (D-060-12):** the new test follows the same locator strategy (`getByRole`, `.or()` fallbacks, `.bg-muted` for assistant bubble) and the same generous-timeout pattern (`30_000` ms). The 060 test adds a Playwright **request listener** to capture the abort evidence — Playwright's `page.on('requestfailed', ...)` is the chrome-MCP-equivalent of "Network panel records request as aborted":

```typescript
// Sketch (planner refines deterministic prompt and exact selectors):
test("Thread A→B navigation aborts A's getMessages and shows only B", async ({ page }) => {
  // Capture aborted requests
  const abortedRequests: string[] = []
  page.on("requestfailed", (req) => {
    if (req.url().includes("/threads/") && req.url().endsWith("/messages") && req.method() === "GET") {
      abortedRequests.push(req.url())
    }
  })

  // Step 1: open Thread A, start a long-running stream (≥5s)
  // Step 2: while streaming, click Thread B in sidebar
  // Step 3: assert Thread B's messages do NOT include any string from A's prompt
  // Step 4: assert at least one abortedRequests entry references Thread A's id
  // Step 5: assert no raw tool-result JSON appears (regression guard for Bug 3)
  //         e.g.: await expect(page.locator(".bg-muted").first()).not.toContainText('"tool_call_id":')
})
```

---

#### Pattern 9: File extension and naming

**Source:** all four existing specs use `.spec.ts` (Playwright convention) — `auth.spec.ts`, `documents.spec.ts`, `rag-retrieval.spec.ts`, `threads.spec.ts`.

**Apply to:** `e2e/tests/060-thread-race.spec.ts`. The CONTEXT mentions `.test.ts` as the suffix — that conflicts with the actual repo convention. **Use `.spec.ts`** to match the existing harness so `playwright test` (defined in `e2e/package.json`) picks it up automatically without config changes.

---

## Shared Patterns

### useCallback([]) stable identity

**Source:** `frontend/src/hooks/useMessages.ts:38-114` (every existing callback in the file)
**Apply to:** All new callbacks in `useMessages.ts` (`setViewingThread`, rewritten `loadMessages`, post-cleanup `clearMessages`).

```typescript
const someName = useCallback((args) => {
  // body uses refs (not state) for cross-render coordination
}, [])
```

The `[]` deps are non-negotiable for the D-060-09 reduced ChatArea dep array to be safe. If a planner accidentally adds a dep, ChatArea's effect will re-fire on every render that closes over a non-stable value.

---

### AbortError-swallow idiom

**Source:** `frontend/src/hooks/useMessages.ts:421-426` (sendMessage's catch — canonical) and `frontend/src/lib/api.ts:146-149` (streamMessage's reader.read catch — same pattern)

```typescript
// THE pattern — used by sendMessage today, applied to loadMessages by D-060-11
try {
  await someFetch(threadId, controller.signal)
} catch (err) {
  if (err instanceof Error && err.name === "AbortError") return  // silently swallow
  throw err  // or: console.error(err) for top-level catches
}
```

**Apply to:** the new `loadMessages` body (D-060-11). Call sites keep `.catch(console.error)` (e.g., `loadMessages(thread.id).catch(console.error)` in ChatArea) — they only see real errors because the swallow happens upstream.

---

### Per-call AbortController create + ref-store + signal-thread

**Source:** `frontend/src/hooks/useMessages.ts:149-150, 419` (sendMessage)

```typescript
const controller = new AbortController()
abortControllerRef.current = controller     // ref-store so external `abortStream()` can call .abort()
// ... pass controller.signal as the last arg to the fetch wrapper ...
```

**Apply to:** the new `loadAbortRef` flow in `loadMessages`. **Important difference** vs. `sendMessage`: `loadMessages` calls `loadAbortRef.current?.abort()` BEFORE creating the new controller (cancel-previous-on-each-call), whereas `sendMessage` does NOT pre-abort (it relies on `isSendingRef` mutex at line 117 to prevent concurrent sends). Don't copy the abort-previous pattern into `sendMessage`.

---

### Playwright E2E spec scaffolding

**Source:** `e2e/tests/threads.spec.ts:1-30` (env-var guards + signIn helper + describe/beforeEach)
**Apply to:** the new `060-thread-race.spec.ts`. Reuse the existing `playwright.config.ts` — no config changes needed.

---

## No Analog Found

None. Every Phase 060 file has a strong in-codebase analog. The chrome-MCP framing in D-060-12 maps cleanly onto the existing Playwright harness because Playwright bundles the MCP browser server (`e2e/node_modules/playwright/lib/mcp/`) — Chromium IS the chrome-MCP driver. The phase does not introduce any genuinely new architectural surface; it surgically replaces band-aid logic with a small set of established patterns from the same files.

---

## Metadata

**Analog search scope:**
- `frontend/src/hooks/useMessages.ts` (full file — in-file precedent for all 3 frontend changes)
- `frontend/src/components/chat/ChatArea.tsx` (full file)
- `frontend/src/lib/api.ts` (full file — `streamMessage` is the signal-accepting analog for `getMessages`)
- `frontend/src/__tests__/` (verified: no E2E precedent — only Vitest unit tests)
- `e2e/tests/*.spec.ts` (4 specs — Playwright E2E precedent for the new browser test)
- `e2e/playwright.config.ts` and `e2e/package.json` (test harness contract)
- `tests/browser/`, `frontend/tests/e2e/` (verified: do NOT exist — `tests/browser/060-thread-race.test.ts` from CONTEXT should be remapped to `e2e/tests/060-thread-race.spec.ts`)

**Files scanned:** 7 (3 frontend sources + 4 e2e specs/config)
**Pattern extraction date:** 2026-05-02
**Graphify:** GRAPH_REPORT.md confirms `sendMessage()` and `handleSend()` form Community 38 with `ChatArea.tsx` and `rag-retrieval.spec.ts` — validates that ChatArea + sendMessage + e2e specs are the right cross-cutting cluster for this phase.

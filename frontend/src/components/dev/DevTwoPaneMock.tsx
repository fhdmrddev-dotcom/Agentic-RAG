/**
 * Phase 068 (SC#3 / D-068-04): Two-pane mock surface for proving multi-consumer
 * bucket isolation. Renders only in dev (`import.meta.env.DEV`); Vite's dead-code
 * elimination strips this in prod builds (RESEARCH §Finding #9).
 *
 * Pane A subscribes to surfaceId='chat' + 'dev-thread'; renders the raw message
 * count. Pane B subscribes to surfaceId='mock-eval' + 'dev-thread'; has a "tick"
 * button that pushes a synthetic Message into its bucket via setMessagesForBucket.
 *
 * Manual exercise (Chrome MCP):
 *  1. npm run dev → http://localhost:5173/
 *  2. Authenticate (fhdmrd@gmail.com / 123456 per MEMORY.md)
 *  3. The overlay appears bottom-right when on the chat surface
 *  4. Click "tick" — Pane B's count increments; Pane A stays at 0
 *  5. Send a real chat message — Pane A updates (if you also setViewingThread('dev-thread')); Pane B unchanged
 */
import { useThreadMessages } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { Message } from "@/types"

const DEV_THREAD = "dev-thread"

export function DevTwoPaneMock() {
  // CRITICAL: keep this literal token. Vite DCE only fires for `import.meta.env.DEV`
  // tokens, NOT variables bound to it (PATTERNS.md §DevTwoPaneMock.tsx drift gotcha).
  if (!import.meta.env.DEV) return null

  return (
    // `pointer-events-none` on the outer wrapper makes the overlay click-through
    // so it doesn't intercept clicks on the composer / Send button beneath it
    // (caught during 075.7 Playwright UAT — see HUMAN-UAT Test 2 notes).
    // Interactive children (the "tick" button) re-enable pointer events locally.
    <div
      data-testid="dev-two-pane-mock"
      className="fixed bottom-4 right-4 z-50 grid grid-cols-2 gap-4 rounded border bg-zinc-900 p-4 text-xs text-zinc-100 shadow-lg pointer-events-none"
      style={{ width: 600 }}
    >
      <PaneA />
      <PaneB />
    </div>
  )
}

function PaneA() {
  const msgs = useThreadMessages(DEV_THREAD, "chat")
  return (
    <div data-testid="pane-chat">
      <div className="font-bold">chat surface</div>
      <div>count: {msgs.length}</div>
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words">
        {JSON.stringify(msgs, null, 2)}
      </pre>
    </div>
  )
}

function PaneB() {
  const msgs = useThreadMessages(DEV_THREAD, "mock-eval")
  const handleTick = () => {
    useStreamsStore.getState().actions.setMessagesForBucket(
      "mock-eval",
      DEV_THREAD,
      (prev) => [
        ...prev,
        {
          id: `dev-${Date.now()}`,
          role: "assistant",
          content: `tick ${prev.length + 1}`,
        } as Message,
      ],
    )
  }
  return (
    <div data-testid="pane-mock-eval">
      <div className="font-bold">mock-eval surface</div>
      <button
        type="button"
        onClick={handleTick}
        className="mt-1 rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600 pointer-events-auto"
      >
        tick
      </button>
      <div>count: {msgs.length}</div>
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words">
        {JSON.stringify(msgs, null, 2)}
      </pre>
    </div>
  )
}

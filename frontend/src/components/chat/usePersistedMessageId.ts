/**
 * BUG-261020-04 — the stored id of an assistant answer, for the citation check.
 *
 * A finished live answer keeps its optimistic `temp-…` id until the thread is refetched
 * (`dedupMessages.ts` swaps it only when the persisted twin arrives), and the `done` event
 * carries no stored message id. The check route needs the stored id, so before this the action
 * appeared only after the thread was re-opened.
 *
 * Once the run has settled, this looks the twin up by run id in the thread's messages: one GET
 * per finished answer, shared by every row mounted for that run. It returns `undefined` while
 * the answer streams, for a temp row with no run id (a failed send), when no twin is found, and
 * on a failed request, so the action stays hidden rather than checking the wrong message.
 *
 * Kept out of `StreamsProvider.tsx` on purpose: that file is a G-5 hot file, and this needs
 * nothing from the stream.
 */
import { useEffect, useState } from "react"
import { getMessages } from "@/lib/api/threads"
import type { Message } from "@/types"

/** run id → the stored message id (or null when the thread has no twin for it). */
const lookups = new Map<string, Promise<string | null>>()

function lookUp(threadId: string, runId: string): Promise<string | null> {
  let pending = lookups.get(runId)
  if (!pending) {
    pending = getMessages(threadId)
      .then((rows) => rows.find((m) => m.runId === runId && !m.id.startsWith("temp-"))?.id ?? null)
      .catch(() => {
        lookups.delete(runId)
        return null
      })
    lookups.set(runId, pending)
  }
  return pending
}

/** Test seam: forget every lookup. */
export function resetPersistedMessageIds(): void {
  lookups.clear()
}

export function usePersistedMessageId(message: Message, isStreaming: boolean | undefined): string | undefined {
  const isTemp = message.id.startsWith("temp-")
  const settled = !isStreaming && message.runStatus !== "streaming"
  const runId = message.role === "assistant" && isTemp && settled && message.thread_id ? message.runId : undefined
  const [resolved, setResolved] = useState<{ runId: string; id: string } | null>(null)

  useEffect(() => {
    if (!runId || !message.thread_id) return
    let live = true
    void lookUp(message.thread_id, runId).then((id) => {
      if (live && id) setResolved({ runId, id })
    })
    return () => {
      live = false
    }
  }, [runId, message.thread_id])

  if (isStreaming) return undefined
  // A stored row keeps today's rule exactly: its own id whenever it is not streaming.
  if (!isTemp) return message.id
  return resolved && resolved.runId === runId ? resolved.id : undefined
}

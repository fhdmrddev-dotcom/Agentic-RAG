/**
 * BUG-261015-05 — one reply, one bubble, while the run is still open.
 *
 * The backend saves the reply and then runs post-answer work (the suggestions call) before the
 * run ends; on a local model that took ~36 s. A messages reload inside that window brings the
 * saved row into the bucket while the live streaming copy (`temp-…`) is still there. The backend
 * links the run to its reply at save time, so the saved row carries the `runId`.
 *
 * While that run is still streaming on a live subscription, the reload keeps the LIVE copy — it
 * is the row the remaining events (suggestions, done) are addressed to — and hides its saved
 * twin. Once the run ends, its subscription is removed and the next reload keeps the saved row,
 * exactly as before.
 *
 * Pure logic — no React, no hooks. Used by both reload merges in StreamsProvider.
 */
import type { Message } from "@/types"

/** Runs whose live `temp-` assistant copy is still streaming on a live subscription. */
export function liveStreamingRunIds(
  prev: Message[],
  isSubscribed: (runId: string) => boolean,
): Set<string> {
  const ids = new Set<string>()
  for (const m of prev) {
    if (
      m.role === "assistant" &&
      m.id.startsWith("temp-") &&
      m.runId &&
      m.runStatus === "streaming" &&
      isSubscribed(m.runId)
    ) {
      ids.add(m.runId)
    }
  }
  return ids
}

/**
 * The fetched rows minus the saved assistant twin of each live run — but ONLY while the database
 * also says that run is still streaming. A run that ended while the client missed its terminal
 * event (navigated away) comes back `completed`, and the saved row must win so the stale live
 * copy settles (MessageItem.answerOutOfFold §6b).
 */
export function withoutLiveTwins(fetched: Message[], liveRunIds: Set<string>): Message[] {
  if (liveRunIds.size === 0) return fetched
  return fetched.filter(
    (m) =>
      !(
        m.role === "assistant" &&
        m.runId &&
        m.runStatus === "streaming" &&
        liveRunIds.has(m.runId)
      ),
  )
}

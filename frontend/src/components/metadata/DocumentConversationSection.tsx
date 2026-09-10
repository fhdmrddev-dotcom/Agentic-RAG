/**
 * Phase 240 (SRC-05 SC#3 / D-240-07) — the Conversation section.
 *
 * ⛔ WHY IT EXISTS. ROADMAP 240 names the failure mode for `thread_key` in as many words:
 * *"stored and read by nothing — the exact fate `message_id` / `in_reply_to` / `references`
 * already suffered here."* Those three headers have been parsed and written into `metadata` since
 * Phase 203 and are read back by nothing at all. A view filter is one read; this is the one a
 * person can actually see, and between them the column is answered rather than merely added.
 *
 * ⚠ IT IS NOT A NEW SURFACE. It is one more `PanelSection` inside the shipped Phase 112
 * DocumentDetailPanel, in the same shape Phase 117's RelationshipsSection established — its own
 * fetch keyed on `docId`, honest distinct states (loading ≠ empty ≠ error), and panel-scoped AA
 * tokens for every piece of meaningful copy.
 *
 * ⛔ IT IS BOUNDED, AND `BUG-260908-01` IS WHY. That live report is about this exact panel: the
 * Chunks section renders every chunk with no height bound, so expanding it *"buries every section
 * below it"* and a 1,000-chunk document makes the rest unreachable. A mailing-list archive is the
 * mail-shaped version of a 1,000-chunk document. The server caps at 200 AND says so; this list
 * additionally scrolls inside a bounded height. Repeating the defect one section over would be
 * inexcusable.
 *
 * ⚠ THE OPEN MESSAGE IS MARKED, NOT HIDDEN. A person reading a fourteen-message thread needs to
 * see where they are in it; a list that silently omits the message you are looking at is a list
 * you cannot orient yourself in.
 */
import { useCallback, useEffect, useState } from "react"
import { MessagesSquare, RefreshCw } from "lucide-react"
import { fetchDocumentConversation } from "@/lib/api"
import type { ConversationMessage } from "@/types"
import { cn } from "@/lib/utils"

export interface DocumentConversationSectionProps {
  /** The open document — the subject of the conversation read. */
  docId: string
  /** Lift the message count so the parent PanelSection can show a count badge. */
  onTotalChange?: (total: number) => void
  /** Open a sibling in the same panel. */
  onOpenDocument?: (id: string) => void
}

type LoadState = "loading" | "ready" | "error"

function formatDate(value: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

export function DocumentConversationSection({
  docId,
  onTotalChange,
  onOpenDocument,
}: DocumentConversationSectionProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [total, setTotal] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [state, setState] = useState<LoadState>("loading")

  const load = useCallback(async () => {
    setState("loading")
    try {
      const res = await fetchDocumentConversation(docId)
      setMessages(res.messages)
      setTotal(res.total)
      setTruncated(res.truncated)
      onTotalChange?.(res.total)
      setState("ready")
    } catch {
      setState("error")
    }
  }, [docId, onTotalChange])

  useEffect(() => {
    void load()
  }, [load])

  if (state === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="px-4 py-3 text-xs text-panel-muted-foreground"
      >
        Loading conversation…
      </div>
    )
  }

  if (state === "error") {
    return (
      <div role="alert" className="flex items-center gap-2 px-4 py-3 text-xs text-destructive">
        <span>Could not load this conversation.</span>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 underline focus-visible:outline focus-visible:outline-2"
          aria-label="Retry loading this conversation"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      </div>
    )
  }

  // ⚠ A conversation of one is a pile of one. Rendering an accordion body that says "1 message"
  //   on every standalone email would be noise on almost every mail document in the Library.
  if (messages.length < 2) return null

  return (
    <div className="flex flex-col px-4 pb-3 pt-1">
      <div className="flex items-center gap-1.5 pb-2 text-xs text-panel-muted-foreground">
        <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          {total} messages in this conversation
          {truncated ? `, showing the first ${messages.length}` : ""}
        </span>
      </div>

      <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto" aria-label="Conversation">
        {messages.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              disabled={m.is_open}
              onClick={() => onOpenDocument?.(m.id)}
              aria-current={m.is_open ? "true" : undefined}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left text-xs",
                "focus-visible:outline focus-visible:outline-2",
                m.is_open
                  ? "bg-panel-accent/40 text-panel-foreground"
                  : "text-panel-muted-foreground hover:bg-panel-accent/20",
              )}
            >
              <span className="flex w-full items-baseline justify-between gap-2">
                <span className="truncate font-medium">{m.title || "(no subject)"}</span>
                {m.is_open && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide">
                    this message
                  </span>
                )}
              </span>
              <span className="flex w-full items-baseline justify-between gap-2 text-panel-muted-foreground-dim">
                <span className="truncate">{m.sender || "Unknown sender"}</span>
                <span className="shrink-0">{formatDate(m.date)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

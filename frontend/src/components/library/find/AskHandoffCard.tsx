/**
 * Phase 271 plan 02 (D-02 / UI-SPEC S5) — what the Documents tab shows in Ask mode.
 *
 * ⛔ ASK LEAVES THE LIBRARY. Ask searches what documents SAY and answers with cited passages, and
 * that answer lives in chat. The Library renders no answer here: no document list, no chunk, no
 * passage — this card carries no list or table markup at all, and its suite asserts that.
 *
 * The question input lives in the search row (composed by 271-04); Enter there calls the same
 * handler as the button. The handler is ChatLayout's `askInChat` (a NEW thread, pre-filled, never
 * sent), reached through `LibraryPage`'s optional `onAskInChat` prop. This card does no I/O.
 */
import { ArrowRight } from "lucide-react"

export interface AskHandoffCardProps {
  /** The text currently typed in Ask mode. */
  question: string
  onAskInChat: (question: string) => unknown
  /** 271-REVIEW WR-01: a new chat is being opened — the button is disabled so a double press
   *  cannot create two threads. The in-flight guard itself is the page's. */
  pending?: boolean
  /** 271-REVIEW WR-01: the last attempt could not open a new chat — said here, in words. */
  failed?: boolean
}

export function AskHandoffCard({ question, onAskInChat, pending = false, failed = false }: AskHandoffCardProps) {
  const text = question.trim()
  const empty = text === ""

  return (
    <div className="rounded-xl bg-card/50 ghost-border p-6 space-y-3">
      <h2 className="text-lg font-semibold font-headline text-foreground">Ask is answered in chat</h2>
      <p className="text-sm text-muted-foreground">
        Ask searches what your documents say and answers with cited passages. It does not list
        documents here.
      </p>
      {!empty && <p className="text-sm text-foreground">{`Your question: “${text}”`}</p>}
      <button
        type="button"
        disabled={empty || pending}
        aria-busy={pending || undefined}
        onClick={() => onAskInChat(text)}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 border border-primary/40 text-primary px-3 py-1.5 text-sm font-medium transition-colors hover:bg-primary/25 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        Open in chat
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't open a new chat. Try again.
        </p>
      )}
      <p className="text-xs text-muted-foreground">Opens a new chat with your question ready to send.</p>
    </div>
  )
}

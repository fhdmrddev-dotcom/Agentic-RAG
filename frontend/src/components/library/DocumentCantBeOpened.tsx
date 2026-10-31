/**
 * Phase 305-02 (MCP-02 / D-17 / D-52; UI-SPEC Surface 4) — the in-page refusal for a by-id open.
 *
 * An "Open in Syrel" link (`/app/library/<uuid>`) — or any other by-id open, such as a chat
 * citation — whose `GET /documents/{id}` answered 404 renders this card in the Library's S8 alert
 * slot, the panel closed. The list behind is never hidden or made inert: the person can use the
 * Library at once.
 *
 * ⛔ THE WORDS NAME ONLY THE KIND (T-305-26). The server sends one 404 for missing, forbidden,
 * other-org, superseded and archived alike, and this card renders the same DOM for all of them — no
 * title, org or owner, so it cannot confirm a document exists. The words come from 299's one copy
 * home, `CANT_BE_OPENED_COPY`; they are imported, never retyped.
 *
 * A `<section aria-labelledby>`, never `role="alert"` (a destination, not an interruption — the 299
 * UI-D6 rule); focus moves to the heading once on arrival (`tabIndex={-1}`, no ring). One action,
 * Dismiss: the host clears the refusal and REPLACES the address with `/app/library`. No "Copy
 * address" (A-7: the person already holds the link in their AI tool). A 5xx is NOT this card — the
 * shipped "Couldn't open that document." alert stays (an outage is never worded as a refusal).
 */
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { CANT_BE_OPENED_COPY } from "@/components/layout/CantBeOpened"

const HEADING_ID = "document-cant-be-opened-heading"

export interface DocumentCantBeOpenedProps {
  /** Clear the refusal and leave the document address (a replace, not a push). */
  onDismiss: () => void
}

export function DocumentCantBeOpened({ onDismiss }: DocumentCantBeOpenedProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <section
      aria-labelledby={HEADING_ID}
      data-testid="document-cant-be-opened"
      className="rounded-xl border border-border bg-card p-4 text-left"
    >
      <h2
        id={HEADING_ID}
        ref={headingRef}
        tabIndex={-1}
        className="font-headline text-base font-semibold text-foreground outline-none"
      >
        {CANT_BE_OPENED_COPY.heading("document")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{CANT_BE_OPENED_COPY.body}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onDismiss}>
        Dismiss
      </Button>
    </section>
  )
}

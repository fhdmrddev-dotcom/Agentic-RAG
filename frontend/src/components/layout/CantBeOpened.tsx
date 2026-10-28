/**
 * Phase 299-03 (LINK-04 / D-12..D-15, D-36; UI-SPEC S1, sketch 299-1 B) — THE ONE IN-PLACE CARD.
 *
 * A link the server will not open — and an address that names nothing at all (297's S1) — renders
 * this card over the generic area of its kind: the Workflows library for a workflow or a run, the
 * Experts catalog for an Expert, an empty main region beside the live history column for a chat.
 * The area behind is passed as `children` and wrapped `inert` + `aria-hidden`, so nothing behind
 * the dim layer can be focused or clicked; the rail (and, for chat, the history column) stay usable.
 *
 * ⛔ THE WORDS NAME ONLY THE KIND. Never a reason, a title, an org or an owner: the server sends
 * one 404 for missing and forbidden alike (299-01), and this card renders the same DOM for both, so
 * it cannot be used to learn whether something exists (T-299-23).
 *
 * ⛔ NO RAW PATH PROP, NO ICON (T-297-09 / T-299-24). The address line is REBUILT from the parsed
 * route — `window.location.host` + `formatAppRoute(route)` (fixed vocabulary, lowercase UUID) — and
 * is absent when there is no route (a mistyped address shows no address and no Copy address).
 *
 * ⛔ One copy home: `CANT_BE_OPENED_COPY` and 297's `ADDRESS_NOT_FOUND_COPY` (moved here verbatim;
 * `AddressNotFound.tsx` re-exports it, and its admin arms keep importing it from there). Not the
 * trailing fallback, and never renders it: that element keeps exactly one home, the switch's last arm.
 *
 * UI-D6: focus moves to the heading once on mount (`tabIndex={-1}`, no ring), because the area
 * behind is inert and focus would otherwise be lost. The wrapper is a `<section aria-labelledby>`,
 * not `role="alert"`: this is a destination, not an interruption. The heading id is a CONSTANT, not
 * `useId()`, so two renders of the same answer are byte-identical (one card is ever on screen).
 */
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { formatAppRoute, type AppRoute } from "@/lib/appRoutes"
import { copyShortcutWord, copyText, selectAllIn } from "@/lib/clipboard"
import type { LinkKind } from "@/lib/api/links"

/** S1's words (299-UI-SPEC Copywriting Contract). Tests assert these rendered. */
// eslint-disable-next-line react-refresh/only-export-components -- the copy lives beside the one component that renders it (the AddressNotFound.tsx precedent)
export const CANT_BE_OPENED_COPY = {
  heading: (noun: string) => `This ${noun} can't be opened`,
  body: "If someone sent you this link, ask them to check it.",
  copy: "Copy address",
  copied: "✓ Address copied",
  copiedStatus: "Address copied",
  goTo: { thread: "Go to Chat", workflow: "Go to Workflows", run: "Go to Workflows", expert: "Go to Experts" },
} as const

/** 297's S1 words, moved here verbatim (297-UI-SPEC Copywriting Contract). */
// eslint-disable-next-line react-refresh/only-export-components -- one copy home, beside its renderer
export const ADDRESS_NOT_FOUND_COPY = {
  heading: "This address doesn't open anything",
  body: "It may be mistyped or out of date.",
  cta: "Go to Chat",
} as const

/** The noun each kind's heading names. */
const NOUN: Record<LinkKind, string> = {
  thread: "chat",
  workflow: "workflow",
  run: "workflow run",
  expert: "Expert",
}

const HEADING_ID = "cant-be-opened-heading"
const RECEIPT_MS = 2000

export interface CantBeOpenedProps {
  /** The kind the address names, or `null` for an address that names nothing. */
  kind: LinkKind | null
  /** The PARSED route, rebuilt for the address line; `null` shows no address. */
  route: AppRoute | null
  /** The exit ("Go to …"): a push, so Back returns to this card (D-15). */
  onGo: () => void
  /** The generic area of the kind, rendered inert behind the card. */
  children?: ReactNode
}

export function CantBeOpened({ kind, route, onGo, children }: CantBeOpenedProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const codeRef = useRef<HTMLElement>(null)
  const [copy, setCopy] = useState<"idle" | "copied" | "refused">("idle")

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  // The success receipt is transient; cleared on unmount too.
  useEffect(() => {
    if (copy !== "copied") return
    const t = window.setTimeout(() => setCopy("idle"), RECEIPT_MS)
    return () => window.clearTimeout(t)
  }, [copy])

  const heading = kind === null ? ADDRESS_NOT_FOUND_COPY.heading : CANT_BE_OPENED_COPY.heading(NOUN[kind])
  const body = kind === null ? ADDRESS_NOT_FOUND_COPY.body : CANT_BE_OPENED_COPY.body
  const exit = kind === null ? ADDRESS_NOT_FOUND_COPY.cta : CANT_BE_OPENED_COPY.goTo[kind]
  const address = kind !== null && route !== null ? `${window.location.host}${formatAppRoute(route)}` : null

  const onCopy = async () => {
    if (address === null) return
    const result = await copyText(address)
    if (result === "refused") selectAllIn(codeRef.current)
    setCopy(result)
  }

  return (
    <div className="relative h-full">
      {children !== undefined ? (
        <div inert aria-hidden="true" className="h-full">
          {children}
        </div>
      ) : null}
      <div className="absolute inset-0 grid place-items-center p-8 bg-background/60">
        <section
          aria-labelledby={HEADING_ID}
          className="w-[min(420px,100%)] rounded-xl border border-border bg-card p-6 shadow-xl text-left"
        >
          <h1
            id={HEADING_ID}
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold text-foreground mb-2 outline-none"
          >
            {heading}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">{body}</p>
          {address !== null ? (
            <code
              ref={codeRef}
              className="block text-[11px] font-mono text-muted-foreground bg-muted/40 rounded-md px-2 py-2 mb-4 select-all break-all"
            >
              {address}
            </code>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" onClick={onGo}>
              {exit}
            </Button>
            {address !== null ? (
              <Button variant="outline" size="sm" onClick={() => void onCopy()}>
                {copy === "copied" ? (
                  <>
                    <span className="text-success">{CANT_BE_OPENED_COPY.copied.charAt(0)}</span>
                    {CANT_BE_OPENED_COPY.copied.slice(1)}
                  </>
                ) : copy === "refused" ? (
                  copyShortcutWord()
                ) : (
                  CANT_BE_OPENED_COPY.copy
                )}
              </Button>
            ) : null}
          </div>
          {address !== null ? (
            <span role="status" className="sr-only">
              {copy === "copied" ? CANT_BE_OPENED_COPY.copiedStatus : ""}
            </span>
          ) : null}
        </section>
      </div>
    </div>
  )
}

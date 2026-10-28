/**
 * Phase 299-04 (LINK-03 / D-20 / D-21 / D-33 / D-34 / D-39 / sketch 299-3 C) — the link surface.
 *
 * One control on each item surface (chat header, the workflow card's ⋯ menu, the Builder header,
 * the run page header, the Expert detail). It opens a surface with the item's address, ONE
 * "Copy link" item, and one line saying who the link opens for.
 *
 * ⭐ UI-D12: the trigger reads "Link", never "Share". "Share with org" changes who can see an item;
 *    a link grants nothing (T-299-33) — the resolver's rule decides who opens it.
 * ⛔ UI-D13: ONE FOCUSABLE ELEMENT. The only interactive child of the `role="menu"` content is the
 *    Copy link item, so `aria-required-children` (WR-03) stays green. The address is a `<code>`, not
 *    an `<input>`: a Radix menu fights a focused input.
 * ⛔ The address is REBUILT from the route (`formatAppRoute`), never echoed from the location, so it
 *    never carries a token, a query string or a hash (T-299-31). Shown: host + path. Copied:
 *    origin + path.
 * ⛔ The audience line comes from ONE leaf (`lib/linkAudience.ts`, pinned to the resolver's
 *    fixture); this file never derives it. The org NAME is resolved here from the org context, so
 *    every mount stays one expression.
 * ⭐ UI-D14: the receipt is inside the surface ("✓ Link copied" for 2 s) — there is no toast
 *    system, and a refused copy selects the address and names the shortcut instead.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Copy, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { copyShortcutWord, copyText, selectAllIn } from "@/lib/clipboard"
import { formatAppRoute, type AppRoute } from "@/lib/appRoutes"
import { audienceParts, linkNoun, type Audience, type LinkAudienceKind } from "@/lib/linkAudience"
import { useOrgOptional } from "@/providers/OrgProvider"
import { cn } from "@/lib/utils"

export interface ShareLinkMenuProps {
  route: AppRoute
  kind: LinkAudienceKind
  audience: Audience
  /** The item's org (the name is resolved from the org context). Null for an org-less item. */
  orgId: string | null
  className?: string
}

const RECEIPT_MS = 2000
const COPY_LINK = "Copy link"
const LINK_COPIED = "Link copied"

/** "Link to this {noun}" — the trigger's name and the surface heading. */
export function linkToThis(kind: LinkAudienceKind): string {
  return `Link to this ${linkNoun(kind)}`
}

function useOrgName(orgId: string | null): string | null {
  const org = useOrgOptional()
  if (!orgId) return null
  return org?.orgs?.find((o) => o.org_id === orgId)?.name ?? null
}

function LinkSurfaceBody({ route, kind, audience, orgId }: ShareLinkMenuProps) {
  const orgName = useOrgName(orgId)
  const addressRef = useRef<HTMLElement | null>(null)
  const [copy, setCopy] = useState<"idle" | "copied" | "refused">("idle")
  const addressId = useId()
  const audienceId = useId()
  const path = formatAppRoute(route)
  const shown = `${window.location.host}${path}`
  const { before, org, after } = audienceParts(audience, orgName)

  useEffect(() => {
    if (copy !== "copied") return
    const t = window.setTimeout(() => setCopy("idle"), RECEIPT_MS)
    return () => window.clearTimeout(t)
  }, [copy])

  let label: ReactNode = COPY_LINK
  if (copy === "copied") {
    label = (
      <>
        <span className="text-success">✓</span>
        {` ${LINK_COPIED}`}
      </>
    )
  } else if (copy === "refused") {
    label = copyShortcutWord()
  }

  // ⚠ WR-03: every direct child of `role="menu"` is a menuitem or a group, so the heading, the
  // address, the status and the audience line sit inside `DropdownMenuGroup`s (the card menu's
  // consequence-note precedent) — a bare label or <code> there breaks `aria-required-children`.
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="px-1 pb-2 pt-0 text-sm font-semibold text-foreground">{linkToThis(kind)}</DropdownMenuLabel>
        <code
          ref={addressRef}
          id={addressId}
          className="mb-2 block select-all break-all rounded-md bg-muted/40 px-2 py-2 font-mono text-[11px] text-muted-foreground"
        >
          {shown}
        </code>
        <span role="status" className="sr-only">
          {copy === "copied" ? LINK_COPIED : ""}
        </span>
      </DropdownMenuGroup>
      <DropdownMenuItem
        aria-describedby={`${addressId} ${audienceId}`}
        onSelect={(event) => {
          event.preventDefault()
          void copyText(`${window.location.origin}${path}`).then((result) => {
            if (result === "copied") {
              setCopy("copied")
            } else {
              selectAllIn(addressRef.current)
              setCopy("refused")
            }
          })
        }}
      >
        <Copy className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </DropdownMenuItem>
      <DropdownMenuGroup id={audienceId} className="px-1 pt-2 text-xs font-normal text-muted-foreground">
        {before}
        {org !== null && <span className="text-foreground">{org}</span>}
        {after}
      </DropdownMenuGroup>
    </>
  )
}

/** The header form: a ghost "Link" button opening the surface. Icon-only below md. */
export function ShareLinkMenu(props: ShareLinkMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={linkToThis(props.kind)}
          className={cn("h-11 w-11 gap-2 px-0 md:h-9 md:w-auto md:px-3", props.className)}
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">Link</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] max-w-[calc(100vw-2rem)] p-4">
        <LinkSurfaceBody {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The ⋯ menu form: a sub-menu "Link to this {noun}" with the same body. */
export function ShareLinkMenuSub(props: ShareLinkMenuProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
        <Link2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
        <span>{linkToThis(props.kind)}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-[340px] max-w-[calc(100vw-2rem)] p-4">
        <LinkSurfaceBody {...props} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

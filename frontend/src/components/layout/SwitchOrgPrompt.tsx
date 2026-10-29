/**
 * Phase 299-03 (LINK-05 / D-16, D-17, D-19, D-37, D-39; UI-SPEC S3, sketch 299-2 A) —
 * "THIS IS IN <ORG> — SWITCH?"
 *
 * Replaces the main region where the item would open when the link names an item in ANOTHER of
 * the person's orgs. The rail and the active org's history column stay. Nothing switches without a
 * click, and this component never switches at all: it calls the handlers `LinkGate` hands it
 * (Stay, Switch, Back to it), so the snapshot-before-switch rule (F4) lives in one place.
 *
 * Org identity is the name plus the shipped `OrgAvatar` initial circle, never a per-org colour
 * (UI-D8 — orgs have no colour field). The item's title and the org names are React text only
 * (T-299-28); the resolver returns a title only to someone who may open the item (D-16).
 *
 * Exactly ONE filled button (Switch). Stay is the outline default, and "Back to it" on the
 * still-answering chip is outline too. Every word comes from `orgItemsCopy.ts` (one home).
 *
 * UI-D6: the heading takes focus once on mount (`tabIndex={-1}`, no ring), and again when the
 * buttons are replaced by the switching status, so focus never drops to the page body. The heading
 * id is a constant: one prompt is ever on screen.
 */
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { OrgAvatar } from "@/components/org/OrgIdentity"
import {
  BACK_TO_IT,
  KEEPS_GOING_TAIL,
  KIND_CAPTION,
  THIS_ORG,
  stayIn,
  stillAnsweringMany,
  stillAnsweringOne,
  switchToLabel,
  switchingTo,
  thisIsIn,
  workingIn,
} from "@/components/org/orgItemsCopy"
import type { LinkKind } from "@/lib/api/links"

const HEADING_ID = "switch-org-heading"

export interface SwitchOrgPromptProps {
  /** The resolver's answer: the item's kind, org and title. */
  target: { kind: LinkKind; org_id: string | null; org_name: string | null; title: string }
  /** The active org's name. */
  currentOrgName: string
  /** The active org's chats that are answering now, oldest first (titles from the chat list). */
  streaming: readonly { id: string; title: string }[]
  /** True between the Switch click and the target org becoming active. */
  switching: boolean
  onStay: () => void
  onSwitch: () => void
  onBackToIt: () => void
}

export function SwitchOrgPrompt({
  target,
  currentOrgName,
  streaming,
  switching,
  onStay,
  onSwitch,
  onBackToIt,
}: SwitchOrgPromptProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [switching])

  const orgName = target.org_name?.trim() ? target.org_name : THIS_ORG
  const initial = (orgName.trim().charAt(0) || "?").toUpperCase()
  const answering = streaming.length > 0

  return (
    <div className="relative flex h-full items-center justify-center p-8">
      <section aria-labelledby={HEADING_ID} className="max-w-[440px] text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <OrgAvatar initial={initial} />
        </div>
        <h1
          id={HEADING_ID}
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold text-foreground mb-2 outline-none"
        >
          {thisIsIn(orgName)}
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          {workingIn(currentOrgName, orgName)}
          {answering ? KEEPS_GOING_TAIL : ""}
        </p>
        <div className="inline-flex flex-col gap-1 text-left rounded-lg border border-border bg-muted/40 px-4 py-2 mb-4">
          <span className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
            {KIND_CAPTION[target.kind]}
          </span>
          <span className="text-sm font-semibold text-foreground">{target.title}</span>
        </div>
        {switching ? (
          <div role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <OrgAvatar initial={initial} />
            <span>{switchingTo(orgName)}</span>
          </div>
        ) : (
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={onStay}>
              {stayIn(currentOrgName)}
            </Button>
            <Button size="sm" onClick={onSwitch}>
              {switchToLabel(orgName)}
            </Button>
          </div>
        )}
      </section>
      {answering && !switching ? (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-md text-xs text-muted-foreground">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none" />
          <span>{streaming.length === 1 ? stillAnsweringOne(streaming[0].title) : stillAnsweringMany(streaming.length)}</span>
          <Button variant="outline" size="sm" onClick={onBackToIt}>
            {BACK_TO_IT}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

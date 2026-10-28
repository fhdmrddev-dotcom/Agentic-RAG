/**
 * Phase 298-05 (ORG-06 / D-21 / D-33 / D-35 / UI-D16..UI-D19) — "Move to <Org>?", the move confirm.
 *
 * THE VICTIM-NAMING SHEET'S SHAPE WITHOUT ITS DANGER COLOUR. Under the graded-guard rule a
 * target-specific action with affected items gets a victim-naming sheet; a move is REVERSIBLE (it
 * can be moved back the same way), so it borrows the `WorkflowDeleteSheet` arrangement — bottom
 * `Sheet`, `mx-auto max-w-lg`, a raised "what moves" box, a transparent second box, the ✎ receipt —
 * and spends NO red anywhere (UI-D2: amber means "this needs you first", red means "this destroys").
 *
 * THE LIFECYCLE (UI-D17), in place, no optimistic vanish, no undo:
 *   picking (4+ orgs) → checking → clean | refused | preview failed → moving → moved
 *                                                                          | refused at confirm | failed
 *   · The preview is read BEFORE any Move button exists; the counts are the SERVER's, never guessed.
 *   · Every refusal is the server's sentence, rendered as React TEXT, in ONE amber alert, with
 *     only Close (D-33). A 403/404/422 from either call is a refusal too.
 *   · A network / 5xx failure keeps the sheet open with Try again ("Nothing was changed." is true:
 *     the move is one transaction, D-35).
 *   · While moving the sheet cannot be dismissed. `noteMoved` is called ONCE, on the 200: the
 *     lists refetch and the item leaves them only on that answer.
 *
 * ⚠ THE BODY IS ITS OWN COMPONENT, mounted inside `SheetContent`: Radix unmounts the content when
 * the sheet closes, so every open starts from a fresh lifecycle with no reset code and no key.
 *
 * `MoveToOrgSheetHost` (below) renders this sheet for a ROW MENU's request. A dropdown menu's
 * content unmounts when it closes, so a sheet rendered inside the menu item would die the moment
 * it opened; the host lives in the list's `ElsewhereLine` instead, which outlives the menu.
 */
import { useEffect, useRef, useState, type RefObject } from "react"
import { ArrowRightLeft, Check, Loader2 } from "lucide-react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SyrelLoader } from "@/components/ui/SyrelLoader"
import { getMovePreview, moveOrgItem, type MovePreview, type OrgItemMoveKind } from "@/lib/api/orgItems"
import { ApiRefusal } from "@/lib/api/refusal"
import type { OrgMembership } from "@/lib/api/admin"
import { closeMoveSheet, noteMoved, useMoveSheetRequest } from "@/lib/elsewhereCounts"
import { useOrgOptional } from "@/providers/OrgProvider"
import {
  CHECKING_MOVE,
  CLOSE,
  CONTINUE,
  KEEP_IT_HERE,
  MOVE_FAILED,
  MOVE_PICK_TITLE,
  MOVING,
  PICK_TARGET_LABEL,
  PREVIEW_FAILED,
  RECORDED_FOOTER,
  TRY_AGAIN,
  WHAT_CHANGES,
  moveButton,
  moveCountSentence,
  moveRefusedTitle,
  moveTitle,
  movedTo,
  movesToCaption,
  pastRunsStay,
  whatChanges,
} from "./orgItemsCopy"

export interface MoveToOrgSheetProps {
  kind: OrgItemMoveKind
  itemId: string
  itemName: string
  /** The orgs it may move to (never the active one), by name. One = straight to the preview. */
  targets: OrgMembership[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A folder move whose subtree holds the Library's selection (recorded with the move). */
  holdsSelection?: boolean
  /** Called when the sheet closes AFTER a successful move (the caller may now drop its view). */
  onMovedClose?: () => void
  /** Where focus goes on close when the element that opened the sheet no longer exists. */
  returnFocusFallback?: RefObject<HTMLElement | null>
}

type Phase = "picking" | "checking" | "previewFailed" | "refused" | "clean" | "moving" | "moved" | "failed"

/** A 4xx is the server saying no, in words; anything else (5xx, network) is a failure to ask. */
function isRefusal(e: unknown): e is ApiRefusal {
  return e instanceof ApiRefusal && e.status >= 400 && e.status < 500
}

// The two sheet buttons, from `WorkflowDeleteSheet` (h-10, the shipped 500 weight). Outline is
// the quiet one; the filled primary is the ONE accent control in this sheet (UI-SPEC Color).
const OUTLINE =
  "h-10 rounded-md border border-border px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
const PRIMARY =
  "h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
// The HoldRefusalNotice amber (with its explicit light shade, because --warning text fails AA on
// a light surface).
const AMBER_TEXT = "text-[hsl(32_90%_30%)] dark:text-warning"

export function MoveToOrgSheet({
  kind,
  itemId,
  itemName,
  targets,
  open,
  onOpenChange,
  holdsSelection,
  onMovedClose,
  returnFocusFallback,
}: MoveToOrgSheetProps) {
  // What the body reports up: dismissal is ignored while moving; a close after `moved` tells the caller.
  const phaseRef = useRef<Phase>("checking")
  const contentRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)
  const descId = `move-to-org-${kind}-${itemId}`

  const requestClose = () => {
    if (phaseRef.current === "moving") return
    const moved = phaseRef.current === "moved"
    onOpenChange(false)
    if (moved) onMovedClose?.()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) onOpenChange(true)
        else requestClose()
      }}
    >
      <SheetContent
        ref={contentRef}
        side="bottom"
        hideCloseButton
        aria-describedby={descId}
        className="mx-auto max-w-lg"
        onOpenAutoFocus={(e) => {
          // Keep it here (or Close) is the default focus, never the Move button (UI-SPEC a11y).
          openerRef.current = document.activeElement
          const cancel = contentRef.current?.querySelector<HTMLElement>("[data-move-cancel]")
          if (cancel) {
            e.preventDefault()
            cancel.focus()
          }
        }}
        onCloseAutoFocus={(e) => {
          // Back to the opener if it still exists, otherwise the list's elsewhere-line wrapper.
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected) return
          const fallback = returnFocusFallback?.current
          if (fallback) {
            e.preventDefault()
            fallback.focus()
          }
        }}
      >
        <MoveSheetBody
          kind={kind}
          itemId={itemId}
          itemName={itemName}
          targets={targets}
          holdsSelection={holdsSelection}
          descId={descId}
          onPhase={(p) => {
            phaseRef.current = p
          }}
          onClose={requestClose}
        />
      </SheetContent>
    </Sheet>
  )
}

interface BodyProps {
  kind: OrgItemMoveKind
  itemId: string
  itemName: string
  targets: OrgMembership[]
  holdsSelection?: boolean
  descId: string
  onPhase: (p: Phase) => void
  onClose: () => void
}

function MoveSheetBody({ kind, itemId, itemName, targets, holdsSelection, descId, onPhase, onClose }: BodyProps) {
  const single = targets.length === 1 ? targets[0] : null
  const [target, setTarget] = useState<OrgMembership | null>(single)
  const [picked, setPicked] = useState<string | null>(null)
  const [phase, setPhaseState] = useState<Phase>(single ? "checking" : "picking")
  const [preview, setPreview] = useState<MovePreview | null>(null)
  const [refusals, setRefusals] = useState<string[]>([])
  const closeRef = useRef<HTMLButtonElement>(null)
  const askId = useRef(0)

  const setPhase = (p: Phase) => {
    onPhase(p)
    setPhaseState(p)
  }

  const check = (t: OrgMembership) => {
    const my = ++askId.current
    setTarget(t)
    setPhase("checking")
    getMovePreview(kind, itemId, t.org_id).then(
      (p) => {
        if (my !== askId.current) return
        setPreview(p)
        if (p.refusals.length > 0) {
          setRefusals(p.refusals)
          setPhase("refused")
        } else {
          setPhase("clean")
        }
      },
      (e: unknown) => {
        if (my !== askId.current) return
        if (isRefusal(e)) {
          setRefusals([e.message])
          setPhase("refused")
        } else {
          setPhase("previewFailed")
        }
      },
    )
  }

  // The first preview, asked once when the sheet opens on a single target (the body mounts per open).
  useEffect(() => {
    onPhase(single ? "checking" : "picking")
    if (single) check(single)
    return () => {
      askId.current += 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A refusal or the terminal replaces Keep it here with Close: focus follows it.
  useEffect(() => {
    if (phase === "refused" || phase === "moved") closeRef.current?.focus()
  }, [phase])

  const confirm = () => {
    if (!target) return
    setPhase("moving")
    moveOrgItem(kind, itemId, target.org_id).then(
      () => {
        setPhase("moved")
        noteMoved({ kind, id: itemId, ...(holdsSelection === undefined ? {} : { holdsSelection }) })
      },
      (e: unknown) => {
        if (isRefusal(e)) {
          setRefusals([e.message])
          setPhase("refused")
        } else {
          setPhase("failed")
        }
      },
    )
  }

  const to = target?.name ?? preview?.to_org.name ?? ""
  const from = preview?.from_org.name ?? ""
  const showsPreview = preview !== null && (phase === "clean" || phase === "moving" || phase === "moved" || phase === "failed")
  const title = phase === "picking" ? MOVE_PICK_TITLE : phase === "refused" ? moveRefusedTitle(to) : moveTitle(to)
  const runsLine = preview ? pastRunsStay(kind === "draft" ? preview.counts.past_runs : 0, from) : null

  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-headline">{title}</SheetTitle>
      </SheetHeader>
      <div id={descId} className="px-4 pb-4">
        {phase === "picking" ? (
          <div role="radiogroup" aria-label={PICK_TARGET_LABEL} className="flex flex-col gap-2">
            {targets.map((t) => (
              <label
                key={t.org_id}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-4 py-3 text-sm text-foreground hover:bg-accent"
              >
                <input
                  type="radio"
                  name={`${descId}-target`}
                  value={t.org_id}
                  checked={picked === t.org_id}
                  onChange={() => setPicked(t.org_id)}
                  className="accent-[hsl(var(--primary))]"
                />
                <span className="min-w-0 truncate">{t.name}</span>
              </label>
            ))}
          </div>
        ) : null}

        {phase === "checking" ? (
          <SyrelLoader size="section" label={CHECKING_MOVE} className="text-sm text-muted-foreground" />
        ) : null}

        {phase === "previewFailed" ? (
          <p role="alert" className={`text-sm ${AMBER_TEXT}`}>
            {PREVIEW_FAILED}
          </p>
        ) : null}

        {phase === "refused" ? (
          <div role="alert" className={`flex flex-col gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm ${AMBER_TEXT}`}>
            {refusals.map((r, i) => (
              <p key={i}>{r}</p>
            ))}
          </div>
        ) : null}

        {showsPreview && preview ? (
          <>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{movesToCaption(to)}</p>
              <p className="mt-1.5 flex flex-col gap-0.5 rounded-md border border-border bg-muted/40 p-4">
                <span className="text-sm font-semibold text-foreground">{preview.item_name || itemName}</span>
                <span className="text-[12px] text-muted-foreground">
                  {moveCountSentence(kind, preview.item_name || itemName, preview.counts, to)}
                </span>
                {runsLine ? <span className="text-[12px] text-muted-foreground">{runsLine}</span> : null}
              </p>
            </div>
            <div className="mt-6">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{WHAT_CHANGES}</p>
              <p className="mt-1.5 rounded-md border border-border bg-transparent p-4 text-[12px] text-muted-foreground">
                {whatChanges(from, to)}
              </p>
            </div>
            {phase === "failed" ? (
              <p role="alert" className={`mt-4 text-sm ${AMBER_TEXT}`}>
                {MOVE_FAILED}
              </p>
            ) : null}
          </>
        ) : null}

        {/* The action row. Keep it here stays first (and is the default focus) wherever it shows. */}
        <div className="mt-5 flex items-center justify-end gap-2">
          {phase === "picking" || phase === "checking" || phase === "previewFailed" || phase === "clean" || phase === "failed" ? (
            <button type="button" data-move-cancel onClick={onClose} className={OUTLINE}>
              {KEEP_IT_HERE}
            </button>
          ) : null}
          {phase === "picking" ? (
            <button
              type="button"
              disabled={picked === null}
              onClick={() => {
                const t = targets.find((x) => x.org_id === picked)
                if (t) check(t)
              }}
              className={PRIMARY}
            >
              {CONTINUE}
            </button>
          ) : null}
          {phase === "previewFailed" ? (
            <button type="button" onClick={() => target && check(target)} className={OUTLINE}>
              {TRY_AGAIN}
            </button>
          ) : null}
          {phase === "clean" ? (
            <button type="button" onClick={confirm} className={`${PRIMARY} inline-flex items-center gap-2`}>
              <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
              {moveButton(to)}
            </button>
          ) : null}
          {phase === "failed" ? (
            <button type="button" onClick={confirm} className={OUTLINE}>
              {TRY_AGAIN}
            </button>
          ) : null}
          {phase === "moving" ? (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {MOVING}
            </span>
          ) : null}
          {phase === "moved" ? (
            <>
              <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
                {movedTo(to)}
              </span>
              <button ref={closeRef} type="button" data-move-cancel onClick={onClose} className={OUTLINE}>
                {CLOSE}
              </button>
            </>
          ) : null}
          {phase === "refused" ? (
            <button ref={closeRef} type="button" data-move-cancel onClick={onClose} className={OUTLINE}>
              {CLOSE}
            </button>
          ) : null}
        </div>

        {showsPreview ? <p className="mt-4 text-right text-[12px] italic text-muted-foreground">{RECORDED_FOOTER}</p> : null}
      </div>
    </>
  )
}

/**
 * Renders the move sheet a ROW MENU asked for (`openMoveSheet`), for the request kinds this list
 * owns. Mounted by `ElsewhereLine`, which every list with a move home already renders once. A
 * request opened under another org closes on a switch (UI-D10), never rendering for the new org.
 */
export function MoveToOrgSheetHost({
  kinds,
  returnFocusFallback,
}: {
  kinds: readonly ("folder" | "draft")[]
  returnFocusFallback?: RefObject<HTMLElement | null>
}) {
  const request = useMoveSheetRequest()
  const activeOrgId = useOrgOptional()?.activeOrgId ?? null
  const mine = request !== null && kinds.includes(request.kind) ? request : null
  const stale = mine !== null && mine.openedIn !== activeOrgId
  useEffect(() => {
    if (stale) closeMoveSheet()
  }, [stale])
  if (mine === null || stale) return null
  return (
    <MoveToOrgSheet
      kind={mine.kind}
      itemId={mine.itemId}
      itemName={mine.itemName}
      targets={mine.targets}
      holdsSelection={mine.holdsSelection}
      open
      onOpenChange={(o) => {
        if (!o) closeMoveSheet()
      }}
      returnFocusFallback={returnFocusFallback}
    />
  )
}

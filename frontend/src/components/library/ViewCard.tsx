/**
 * Phase 217.1 plan 07 (LIB-01 / D-217.1-07 / SC#5) — ONE VIEW AS A CARD.
 *
 * Modeled on `WorkflowCard.tsx` (the house card shape) and the sketch's `.vcard`
 * composition: name · match count · the rule in plain words · a rule bar ·
 * `N of M documents` · a `⋯` menu.
 *
 * ⭐ ZERO NEW SELECTION STATE. A card's click dispatches the IDENTICAL `onSelectView`
 * the sidebar row dispatches — `librarySelection`'s six-action reducer stays the single
 * source of selection truth (SC#5 / T-217.1-12a). The sidebar mount stays alive beside
 * the tab body (`LibraryPage.tsx`'s deliberate design), so the two renderings of one
 * selection can never disagree.
 *
 * ⭐ THE ZERO-MATCH CARD (the sketch's own "what makes this a tab"): when the view
 * resolves `total === 0`, the card carries the amber `.vcard.vempty` treatment —
 * `0`, `Matches nothing right now`. A saved question with no answers is worth seeing.
 *
 * ── ⚠ CORRECTION 2026-08-31 — THE `⋯` HAD NO `onClick`, AND THE COMMENT SAID IT DID ───
 * As shipped, this button rendered and did nothing: `onEdit` / `onRename` / `onDelete`
 * were accepted as props and READ AT NO SITE, while the comment beside the button
 * claimed "the menu actions are wired to the same callbacks the sidebar row uses". That
 * comment was FALSE, and a false comment is worse than an absent one — it answers the
 * auditor and stops the audit. 217.1's BUILD-OR-DROP rule says an affordance is built or
 * it is not drawn; this one was drawn.
 *
 * ⚠ AND THE RENAME CALLBACK COULD NOT HAVE WORKED EVEN ONCE THE MENU EXISTED. The prop
 * was typed `(view: SavedView) => void`, while the value actually passed — through
 * `ViewsTab` → `ViewCardGrid` — is `LibraryPage.handleRenameView`, which is
 * `(id, name) => Promise<void>`. Wiring the menu to the DECLARED type would have called
 * `updateView(viewObject, { name: undefined })`. The type is corrected HERE, at the leaf,
 * to the ONE signature `ViewsGroup` (the sidebar, which works) has always used. One
 * concern, one signature — never a per-mount adapter.
 *
 * ⭐ THE THREE ACTIONS ARE THE SIDEBAR'S THREE, IN THE SIDEBAR'S ORDER, DOING THE
 * SIDEBAR'S WORK: Edit filter delegates, Rename opens an inline editor that commits on
 * Enter and cancels on Escape-or-blank, and Delete confirms inline then calls
 * `deleteView` BEFORE telling the page — `ViewsGroup.handleConfirmDelete`'s exact
 * sequence, because `onDelete` (`LibraryPage.handleDeletedView`) only drops the row from
 * local state and calls no API. A card that skipped that call would make a view appear
 * to vanish and come back on the next reload.
 */
import { useEffect, useRef, useState } from "react"
import { MoreHorizontal, Pencil, SlidersHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteView } from "@/lib/api"
import { ruleInWords } from "@/components/ingestion/viewRuleWords"
import type { SavedView } from "@/types"

export interface ViewCardProps {
  view: SavedView
  /** The resolved match count for this view (null while unknown/absent). */
  total: number | null
  /** The corpus denominator, for `N of M documents`. */
  corpusCount: number
  isSelected: boolean
  onSelect: (view: SavedView) => void
  onEdit: (view: SavedView) => void
  /** Rename committed inline (Enter saves / Esc cancels). The SIDEBAR's signature —
   *  `LibraryPage.handleRenameView` is `(id, name)`, and it is the same function. */
  onRename: (id: string, name: string) => Promise<void> | void
  /** Fired AFTER `deleteView` succeeds, so the page can drop the row. */
  onDelete: (id: string) => void
}

export function ViewCard({
  view,
  total,
  corpusCount,
  isSelected,
  onSelect,
  onEdit,
  onRename,
  onDelete,
}: ViewCardProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(view.name)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  //: ⚠ THE BLUR-COMMIT IS DISARMED UNTIL THE EDITOR HAS SETTLED — MEASURED, NOT GUESSED.
  //: Radix's `FocusScope` returns focus to the trigger when the menu closes, and it does
  //: so AFTER our state update mounts the input. With an eager `onBlur` commit the editor
  //: opened and closed inside one tick and `findByTestId` saw nothing — three RED cases in
  //: `ViewCardGrid.test.tsx`, and a user would have seen the same flicker. `onCloseAutoFocus`
  //: alone did NOT fix it (driven, still red), so the arming flag is what carries the rule:
  //: a blur that happens before we have taken focus back is Radix's, not the person's.
  const blurArmed = useRef(false)

  const zeroMatch = total === 0
  const pct = corpusCount > 0 ? Math.max(2, Math.round(((total ?? 0) / corpusCount) * 100)) : 0
  const rule = ruleInWords(view.filter_expr)

  const startRename = () => {
    setDraftName(view.name)
    setIsRenaming(true)
  }

  // Managed focus via ref rather than the declarative `autoFocus` prop — `NavRow`'s
  // Phase 155 (A11Y-01) idiom, same behavior, and it is also the hook that lets us take
  // focus back from Radix and arm the blur commit in one place.
  useEffect(() => {
    if (!isRenaming) {
      blurArmed.current = false
      return
    }
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
      blurArmed.current = true
    }, 0)
    return () => window.clearTimeout(id)
  }, [isRenaming])

  // Blank is a CANCEL, never a rename to "" — `ViewsGroup.handleCommitRename`'s rule,
  // kept identical so the two surfaces cannot disagree about what Enter means.
  const commitRename = async () => {
    const name = draftName.trim()
    setIsRenaming(false)
    if (!name || name === view.name) return
    try {
      await onRename(view.id, name)
    } catch (err) {
      console.error("Could not rename view:", err)
    }
  }

  const confirmDelete = async () => {
    setIsConfirmingDelete(false)
    try {
      await deleteView(view.id)
      onDelete(view.id)
    } catch (err) {
      console.error("Could not delete view:", err)
    }
  }

  return (
    <div
      data-testid="view-card"
      data-view-id={view.id}
      data-empty={zeroMatch || undefined}
      className={[
        "flex min-w-0 flex-col gap-2 rounded-xl border bg-card/50 px-4 py-3 transition-colors",
        zeroMatch ? "border-amber-400/40" : "ghost-border",
        // A whole-card ring marks the selected card; the NAME BUTTON below carries the
        // SAME `bg-primary/10` the sidebar row uses — the "two renderings can never
        // disagree" contract (SC#5) is asserted by a class check on that button at
        // LibraryPage.test.tsx:298. Do not "tidy" it to a different tint.
        isSelected ? "ring-1 ring-primary/30" : "hover:bg-accent/30",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-3">
        {isRenaming ? (
          <input
            ref={inputRef}
            data-testid="view-card-rename-input"
            aria-label={`Rename ${view.name}`}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void commitRename()
              } else if (e.key === "Escape") {
                e.preventDefault()
                setIsRenaming(false)
              }
            }}
            onBlur={() => {
              if (blurArmed.current) void commitRename()
            }}
            className="min-w-0 flex-1 rounded-sm border border-primary/40 bg-background px-1.5 py-0.5 text-sm font-semibold text-foreground outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelect(view)}
            className={[
              "min-w-0 truncate text-left text-sm font-semibold transition-colors",
              isSelected
                ? "rounded-sm bg-primary/10 text-foreground"
                : "text-foreground hover:text-primary",
            ].join(" ")}
            aria-current={isSelected ? "true" : undefined}
            title={view.name}
          >
            {view.name}
            {view.is_system_global && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary align-middle">
                G
              </span>
            )}
          </button>
        )}
        <span
          data-testid="view-card-count"
          className={[
            "font-mono text-lg font-bold tabular-nums",
            zeroMatch ? "text-amber-400" : "text-foreground",
          ].join(" ")}
        >
          {total ?? "…"}
        </span>
      </div>

      <p className="text-[11.5px] leading-relaxed text-muted-foreground">{rule}</p>

      {/* The rule bar — a proportion of the corpus the view matches, never a health grade. */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={["h-full rounded-full transition-all duration-300", zeroMatch ? "bg-amber-400/60" : "bg-gradient-to-r from-primary/60 to-primary"].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {zeroMatch ? (
            <span className="text-amber-400 font-medium">Matches nothing right now</span>
          ) : view.is_system_global ? (
            "Built in · shared with everyone"
          ) : total === null ? (
            `${corpusCount} documents`
          ) : (
            `${total} of ${corpusCount} documents`
          )}
        </span>
        <span className="relative inline-flex items-center">
          {/* Edit filter / Rename / Delete — the SAME three the sidebar row offers, in the
              same order, through the same shared DropdownMenu primitive. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                data-testid="view-card-menu"
                aria-label={`Options for ${view.name}`}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-40"
              // ⚠ WITHOUT THIS, RENAME IS UNREACHABLE — measured, not reasoned about.
              // Radix restores focus to the trigger when the menu closes. That blurs the
              // `autoFocus` rename input the same tick it mounts, `onBlur` commits (a
              // no-op, the name is unchanged) and the editor disappears before anyone can
              // type in it. Three RED cases in `ViewCardGrid.test.tsx` found it the first
              // time the menu was ever DRIVEN rather than asserted to exist.
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem
                data-testid="view-card-edit"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(view)
                }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-2" />
                Edit filter
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="view-card-rename"
                onClick={(e) => {
                  e.stopPropagation()
                  startRename()
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="view-card-delete"
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsConfirmingDelete(true)
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      {/* Inline delete confirmation — the sidebar's wording, because it is the same act. */}
      {isConfirmingDelete && (
        <div
          data-testid="view-card-delete-confirm"
          className="mt-1 flex flex-wrap items-center gap-2 rounded-md bg-destructive/5 px-2 py-2 text-xs text-muted-foreground"
        >
          <span>
            Delete the view <strong>{view.name}</strong>? Your documents are not
            affected — only this saved filter is removed.
          </span>
          <div className="mt-1 flex w-full gap-1.5">
            <Button
              variant="destructive"
              size="sm"
              className="h-6 px-2.5 text-xs"
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2.5 text-xs"
              onClick={() => setIsConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

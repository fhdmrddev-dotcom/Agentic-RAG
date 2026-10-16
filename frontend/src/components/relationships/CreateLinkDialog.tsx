/**
 * Phase 117 Plan 04 Task 2 — CreateLinkDialog (REL-02 SC#2, the create-link picker).
 * Locked G-2 sketch = references/document-relationships-panel.md (035 winner A:
 * type-first dialog typeahead).
 *
 * Keeps the MoveToFolderDialog SHELL (Dialog + DialogContent/Header/Footer + the
 * loading confirm + the error line + reset-on-open) and SWAPS only its plain `Select`
 * (which dies past ~30 docs — D-117-3) for a bespoke TYPE-FIRST typeahead:
 *   1. rel-type segmented chips on top (the 4 closed RelType values), then
 *   2. a searchable typeahead over the caller's visible docs (server search since 284-04).
 * A live "this references → X" preview; confirm disabled until a target is chosen.
 *
 * Authoring is OUTGOING-ONLY (D-117-1): the open document is always the source. The
 * candidate exclusion (D-117-4) is PER TYPE — self is always hidden, plus any doc
 * already linked OUTGOING with the currently-selected rel_type; switching the type
 * RE-DERIVES the candidate set (a doc you already "supersede" reappears as a valid
 * "references" target). The exclusion is clarity-only — the backend visible-both gate
 * + idempotent create (D-116-6) are the real correctness/access boundary.
 *
 * a11y — the typeahead is NET-NEW a11y: the Select→typeahead swap LOSES the APG roles
 * the shadcn Select gave for free, so they are wired BY HAND (there is no cmdk dep):
 * the combobox role + aria-expanded/aria-controls/aria-activedescendant on the input,
 * role="listbox" on the list, role="option" + a unique id per candidate. Focus-trap +
 * restore come FREE from the reused shadcn Dialog — the input stays INSIDE it.
 *
 * Phase 271-03 (D-04): the typeahead itself now lives in `LinkTargetCombobox.tsx`, MOVED
 * there so the Find Relationship filter mounts the same combobox (never a fork). This
 * dialog keeps the rel-type chips, the exclusion note, the preview and the footer, and
 * passes `maxVisible={Infinity}` so its candidate list stays uncapped as shipped.
 *
 * Phase 284-04 (D-15 / R-05 / UI-SPEC S11) — the candidates come from the SERVER. Opening the
 * dialog no longer downloads the library (at 50,000 documents that read was cut at 1,000 and
 * offered an arbitrary 1,000): it type-aheads against `POST /document-search` through
 * `useDocumentFind` — latest versions, archived included (today's candidate set), 20 rows, 250 ms
 * debounce, an empty query being the 20 most recent. The combobox runs in server mode (no client
 * re-filter). The chosen document is kept as an OBJECT, so the preview line still names it after
 * a later search stops returning it (a `candidates.find` lookup would lose it).
 */
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createRelationship, ApiError } from "@/lib/api"
import { useDocumentFind } from "@/hooks/useDocumentFind"
import type { Document, RelType, RelationshipRow } from "@/types"
import { cn } from "@/lib/utils"
import { OUTGOING_LABEL, REL_TYPES } from "./relationshipLabels"
import { LinkTargetCombobox } from "./LinkTargetCombobox"

interface Props {
  open: boolean
  /** The open document — always the SOURCE of the new outgoing edge (D-117-1). */
  sourceDocId: string
  /** The source filename, for the "this <verb> → X" preview framing. */
  sourceFilename?: string
  /** The open doc's CURRENT outgoing edges — used for the per-type candidate
   *  exclusion (D-117-4) without an extra fetch (the section already has them). */
  existingOutgoing: RelationshipRow[]
  onClose: () => void
  /** Fired after a successful create — the parent re-fetches (D-117-9). */
  onCreated: () => void
}

export function CreateLinkDialog({
  open,
  sourceDocId,
  sourceFilename,
  existingOutgoing,
  onClose,
  onCreated,
}: Props) {
  const [relType, setRelType] = useState<RelType>("references")
  // 284-04: the chosen target as an OBJECT (id + name), never a lookup into the latest answer.
  const [chosenDoc, setChosenDoc] = useState<Document | null>(null)
  const target = chosenDoc?.id ?? "" // the chosen target doc id
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useRef(`rel-target-input-${Math.random().toString(36).slice(2)}`).current

  // Reset-on-open (the MoveToFolderDialog posture). The combobox's own query and active option
  // reset with it: the dialog content unmounts on close, so a reopen mounts a fresh combobox.
  useEffect(() => {
    if (!open) return
    setRelType("references")
    setChosenDoc(null)
    setQuery("")
    setError(null)
  }, [open])

  // 284-04 (D-15 / R-05): the candidate source is ONE server search per (debounced) query.
  const name = query.trim()
  const find = useDocumentFind({
    request: open
      ? {
          filter_expr: { op: "and", conditions: [] },
          name: name === "" ? null : name,
          version: "latest",
          sort: "added_desc",
          offset: 0,
          limit: 20,
          include_archived: true,
        }
      : null,
    debounceMs: 250,
  })
  const candidates = find.rows

  /** Doc ids already linked OUTGOING with the CURRENTLY-selected rel_type — the
   *  per-type exclusion set (D-117-4). Re-derived whenever relType changes. */
  const excludedByType = useMemo(() => {
    const ids = new Set<string>()
    for (const row of existingOutgoing) {
      if (row.rel_type === relType && row.document_id != null) ids.add(row.document_id)
    }
    return ids
  }, [existingOutgoing, relType])

  const howManyExcluded = excludedByType.size

  /** The ids the combobox never offers: self always (D-117-4), plus the docs already
   *  linked OUTGOING with the selected type. Re-derives on relType (via excludedByType). */
  const excludeIds = useMemo(
    () => new Set<string>([sourceDocId, ...excludedByType]),
    [sourceDocId, excludedByType],
  )

  const targetDoc = chosenDoc

  async function handleConfirm() {
    if (!target) return
    setLoading(true)
    setError(null)
    try {
      await createRelationship(sourceDocId, target, relType)
      onCreated()
      onClose()
    } catch (err) {
      // A 422 is a PERMANENT rejection (self-link / unseeable endpoint / forged
      // type — uniform server-side, never succeeds on retry). "Please try again"
      // would be misleading guidance, so reserve it for transient network/5xx
      // failures and surface a non-retry-implying message for 422 (WR-03). The
      // candidate-exclusion already prevents the common duplicate case, so a 422
      // here is genuinely a "can't", not a "try again".
      if (err instanceof ApiError && err.status === 422) {
        setError("That link can’t be created.")
      } else {
        setError("Action failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add link</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* (1) rel-type segmented chips — TYPE-FIRST (the locked composition). */}
          <div>
            <p className="mb-1.5 text-[0.7rem] uppercase tracking-[0.06em] text-panel-muted-foreground">
              Relationship
            </p>
            <div role="group" aria-label="Relationship type" className="flex flex-wrap gap-1.5">
              {REL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={relType === t}
                  onClick={() => {
                    setRelType(t)
                    // Per-type re-derive: a now-excluded chosen target must clear.
                    // (The combobox resets its own active option when the excluded set changes.)
                    setChosenDoc(null)
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    relType === t
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border/60 text-panel-muted-foreground hover:text-foreground",
                  )}
                >
                  {OUTGOING_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* (2) the typeahead combobox — the extracted LinkTargetCombobox (271-03). */}
          <div>
            <label
              htmlFor={inputId}
              className="mb-1.5 block text-[0.7rem] uppercase tracking-[0.06em] text-panel-muted-foreground"
            >
              Target document
            </label>
            <LinkTargetCombobox
              inputId={inputId}
              candidates={candidates}
              excludeIds={excludeIds}
              value={target === "" ? null : target}
              onChoose={(doc) => setChosenDoc(doc)}
              placeholder="Search documents…"
              listboxLabel="Target document candidates"
              maxVisible={Number.POSITIVE_INFINITY}
              onQueryChange={setQuery}
              loading={find.loading}
              error={find.error !== null}
              hasMore={find.total !== null && find.total > find.rows.length}
              onRetry={find.retry}
            />
            {/* Honest per-type exclusion note (panel-AA token). */}
            {howManyExcluded > 0 && (
              <p className="mt-1.5 text-xs text-panel-muted-foreground">
                {howManyExcluded} already linked with this type — hidden so every pick is
                actionable.
              </p>
            )}
          </div>

          {/* Live preview line — "this <verb> → X". */}
          {targetDoc && (
            <p className="text-sm text-panel-muted-foreground">
              <span className="truncate font-medium text-foreground">
                {sourceFilename ?? "This document"}
              </span>{" "}
              <span className="font-semibold text-primary">{OUTGOING_LABEL[relType]}</span> →{" "}
              <span className="truncate font-medium text-foreground">{targetDoc.filename}</span>
            </p>
          )}

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!target || loading}>
            {loading ? "Linking…" : "Add link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateLinkDialog

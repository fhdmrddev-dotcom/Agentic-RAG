/**
 * Phase 117 Plan 04 Task 2 — CreateLinkDialog (REL-02 SC#2, the create-link picker).
 * Locked G-2 sketch = references/document-relationships-panel.md (035 winner A:
 * type-first dialog typeahead).
 *
 * Keeps the MoveToFolderDialog SHELL (Dialog + DialogContent/Header/Footer + the
 * loading confirm + the error line + reset-on-open) and SWAPS only its plain `Select`
 * (which dies past ~30 docs — D-117-3) for a bespoke TYPE-FIRST typeahead:
 *   1. rel-type segmented chips on top (the 4 closed RelType values), then
 *   2. a searchable typeahead over the caller's visible docs (listDocuments).
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
 * role="combobox" + aria-expanded/aria-controls/aria-activedescendant on the input,
 * role="listbox" on the list, role="option" + a unique id per candidate. Focus-trap +
 * restore come FREE from the reused shadcn Dialog — the input stays INSIDE it.
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
import { listDocuments, createRelationship } from "@/lib/api"
import type { Document, RelType, RelationshipRow } from "@/types"
import { cn } from "@/lib/utils"
import { OUTGOING_LABEL, REL_TYPES } from "./relationshipLabels"

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
  const [candidates, setCandidates] = useState<Document[]>([])
  const [query, setQuery] = useState("")
  const [target, setTarget] = useState<string>("") // the chosen target doc id
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listboxId = useRef(`rel-target-listbox-${Math.random().toString(36).slice(2)}`).current

  // Reset-on-open + load the candidate source (the MoveToFolderDialog posture).
  useEffect(() => {
    if (!open) return
    setRelType("references")
    setTarget("")
    setQuery("")
    setActiveIndex(-1)
    setError(null)
    listDocuments()
      .then(setCandidates)
      .catch(() => setError("Could not load documents."))
  }, [open])

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

  /** The actionable candidate set: always drop self; drop already-linked-with-type;
   *  then filter by the typeahead query. Re-derives on relType (via excludedByType)
   *  and on query. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return candidates
      .filter((d) => d.id !== sourceDocId) // self always hidden (D-117-4)
      .filter((d) => !excludedByType.has(d.id)) // per-type exclusion
      .filter((d) => (q === "" ? true : d.filename.toLowerCase().includes(q)))
  }, [candidates, sourceDocId, excludedByType, query])

  // Keep the active descendant in range as the filtered set changes.
  useEffect(() => {
    setActiveIndex((i) => (i >= filtered.length ? filtered.length - 1 : i))
  }, [filtered.length])

  const targetDoc = candidates.find((d) => d.id === target) ?? null

  function choose(doc: Document) {
    setTarget(doc.id)
    setQuery(doc.filename)
    setActiveIndex(-1)
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filtered.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % filtered.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      choose(filtered[activeIndex])
    }
  }

  async function handleConfirm() {
    if (!target) return
    setLoading(true)
    setError(null)
    try {
      await createRelationship(sourceDocId, target, relType)
      onCreated()
      onClose()
    } catch {
      setError("Action failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
  const listVisible = query.trim() !== "" || activeIndex >= 0 || target === ""

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
                    setTarget("")
                    setActiveIndex(-1)
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

          {/* (2) the typeahead combobox (APG roles wired by hand). */}
          <div>
            <label
              htmlFor={`${listboxId}-input`}
              className="mb-1.5 block text-[0.7rem] uppercase tracking-[0.06em] text-panel-muted-foreground"
            >
              Target document
            </label>
            <input
              id={`${listboxId}-input`}
              type="text"
              role="combobox"
              aria-expanded={listVisible}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              autoComplete="off"
              placeholder="Search documents…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setTarget("") // typing invalidates a prior pick
                setActiveIndex(-1)
              }}
              onKeyDown={onInputKeyDown}
              className={cn(
                "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground",
                "placeholder:text-panel-muted-foreground-dim",
                "focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            />
            {listVisible && (
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Target document candidates"
                className="mt-1 max-h-44 overflow-y-auto rounded-md border border-border/60"
              >
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-panel-muted-foreground">
                    No matching documents
                  </li>
                ) : (
                  filtered.map((d, i) => (
                    <li
                      key={d.id}
                      id={`${listboxId}-opt-${i}`}
                      role="option"
                      aria-selected={target === d.id}
                      onMouseDown={(e) => {
                        e.preventDefault() // keep focus in the input
                        choose(d)
                      }}
                      className={cn(
                        "cursor-pointer truncate px-3 py-2 text-sm",
                        i === activeIndex || target === d.id
                          ? "bg-accent text-foreground"
                          : "text-foreground hover:bg-accent/50",
                      )}
                    >
                      {d.filename}
                    </li>
                  ))
                )}
              </ul>
            )}
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

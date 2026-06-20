/**
 * Phase 117 Plan 04 Task 1 — RelationshipsSection (REL-02 SC#1/#2, the in-panel
 * relationships surface). Locked G-2 sketch = references/document-relationships-panel.md
 * (034 winner A: chip-led, grouped-by-direction accordion).
 *
 * This is ONE section rendered inside the EXISTING Phase 112 DocumentDetailPanel —
 * NOT a new surface. It owns its OWN fetch of listRelationships(docId), keyed on
 * docId, refreshed on mount + after EVERY mutation (D-117-9 re-fetch-not-optimistic;
 * NOT IngestionPage's onReconcile/loadDocuments — relationships are not on the doc
 * row; RESEARCH Pitfall 5). The rows split into two fixed subgroups: Outgoing (A → X)
 * then Incoming (Y → A), each with a count subheader.
 *
 * Load-bearing honesty (carried from 112/116):
 *  - Inverse labels are mirrored 1:1 from the backend (relationshipLabels.ts, D-117-6)
 *    — never invented here.
 *  - A masked "no access" row (document_id === null) renders the verbatim mask string
 *    via the panel-AA token, never an id/title (D-117-8), and STILL carries a remove ✕
 *    (you own the edge from either end — D-117-2).
 *  - Mutation re-fetches (no optimistic splice, NO Undo — an Undo would lie about
 *    reversibility the backend doesn't provide — D-117-9).
 *  - Honest state set: empty ≠ loading ≠ error (each a distinct render — D-117-10).
 *
 * a11y (locked by the fidelity audit, NON-negotiable — SC#3 WCAG 2.1 AA):
 *  - The remove ✕ is keyboard-operable (:focus-visible) AND always visible on
 *    coarse-pointer / touch (the bottom-sheet has no hover) — the audit's #1 fix.
 *  - Icon-only controls carry an aria-label naming the full target.
 *  - loading is role="status" aria-live="polite"; error is role="alert".
 *  - All meaningful copy uses the panel-scoped AA token (text-panel-muted-foreground[-dim]),
 *    NEVER the global muted (3.59:1).
 */
import { useCallback, useEffect, useState } from "react"
import { X, RefreshCw } from "lucide-react"
import { listRelationships, deleteRelationship } from "@/lib/api"
import type { RelationshipRow, RelType } from "@/types"
import { cn } from "@/lib/utils"
import { relLabel } from "./relationshipLabels"
import { CreateLinkDialog } from "./CreateLinkDialog"

/** Per-type chip dot colour (decorative — the WORD carries the meaning). Uses
 *  panel-token-adjacent hues that survive the Deep Midnight surface. */
const TYPE_DOT: Record<RelType, string> = {
  supersedes: "bg-[hsl(var(--panel-status-active))]",
  amends: "bg-[hsl(var(--warning))]",
  references: "bg-[hsl(var(--primary))]",
  attached_to: "bg-[hsl(var(--panel-status-done))]",
}

export interface RelationshipsSectionProps {
  /** The open document — the subject of the read traversal. */
  docId: string
  /** The subject filename (for the create dialog's "this references → X" framing). */
  filename?: string
  /** Lift the loaded total up so the parent PanelSection can show a count badge. */
  onTotalChange?: (total: number) => void
}

type LoadState = "loading" | "ready" | "error"

export function RelationshipsSection({ docId, filename, onTotalChange }: RelationshipsSectionProps) {
  const [rows, setRows] = useState<RelationshipRow[]>([])
  const [state, setState] = useState<LoadState>("loading")
  // A transient re-fetch beat after a mutation (role="status") — distinct from the
  // initial load skeleton so a remove doesn't blank the whole list.
  const [refreshing, setRefreshing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  /** Local fetch, keyed on docId. `silent` = a post-mutation re-fetch (keep the old
   *  list visible under a ↻ beat instead of dropping to the skeleton). */
  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true)
      else setState("loading")
      try {
        const res = await listRelationships(docId)
        setRows(res.documents)
        setState("ready")
        onTotalChange?.(res.total)
      } catch {
        // Honest error — distinct from empty (D-117-10). On a silent re-fetch
        // failure, still surface the error rather than a stale-but-green list.
        setState("error")
      } finally {
        if (silent) setRefreshing(false)
      }
    },
    [docId, onTotalChange],
  )

  // Fetch on mount + whenever the open document changes.
  useEffect(() => {
    void load()
  }, [load])

  /** Remove an edge (either direction — D-117-2), then RE-FETCH (no optimistic
   *  splice, no Undo — D-117-9). 404-tolerant client fn means a vanished edge is a
   *  no-op; the re-fetch shows the server's truth either way. */
  const handleRemove = useCallback(
    async (relationshipId: string) => {
      try {
        await deleteRelationship(relationshipId)
      } finally {
        // Re-fetch regardless: a 404-tolerant delete + the authoritative list.
        await load(true)
      }
    },
    [load],
  )

  const outgoing = rows.filter((r) => r.direction === "outgoing")
  const incoming = rows.filter((r) => r.direction === "incoming")

  return (
    <div className="flex flex-col gap-3 px-4 pt-1">
      {/* The transient post-mutation re-fetch beat (NOT a layout jump). */}
      {refreshing && (
        <span
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-1.5 text-xs text-panel-muted-foreground-dim"
        >
          <RefreshCw aria-hidden="true" className="h-3 w-3 motion-safe:animate-spin" />
          updating…
        </span>
      )}

      {state === "loading" && (
        <div role="status" aria-live="polite" className="flex flex-col gap-2 py-1">
          <span className="sr-only">Loading relationships</span>
          {/* Quiet skeleton — no layout jump, no error text. */}
          <div aria-hidden="true" className="h-7 w-full animate-pulse rounded-md bg-border/30" />
          <div aria-hidden="true" className="h-7 w-3/4 animate-pulse rounded-md bg-border/30" />
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-2 py-1">
          <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
            Couldn&rsquo;t load relationships
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="self-start rounded-md text-xs text-panel-muted-foreground underline-offset-2 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      )}

      {state === "ready" && rows.length === 0 && (
        // Empty is calm — NOT an error (D-117-10).
        <div className="flex flex-col gap-2 py-1">
          <p className="text-sm text-panel-muted-foreground">No relationships yet</p>
          <AddLinkButton onClick={() => setDialogOpen(true)} />
        </div>
      )}

      {state === "ready" && rows.length > 0 && (
        <>
          <RelationshipGroup
            heading="Outgoing"
            rows={outgoing}
            onRemove={handleRemove}
          />
          <RelationshipGroup
            heading="Incoming"
            rows={incoming}
            onRemove={handleRemove}
          />
          {/* Create lives at the section foot — outgoing-only authoring (D-117-1). */}
          <AddLinkButton onClick={() => setDialogOpen(true)} />
        </>
      )}

      <CreateLinkDialog
        open={dialogOpen}
        sourceDocId={docId}
        sourceFilename={filename}
        existingOutgoing={outgoing}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          setDialogOpen(false)
          // Re-fetch the authoritative list (no optimistic insert — D-117-9).
          void load(true)
        }}
      />
    </div>
  )
}

/** A labeled direction subgroup (Outgoing / Incoming) with a count subheader. An
 *  empty subgroup renders its heading + a calm "none" so the create/remove
 *  asymmetry stays legible even when one direction is empty. */
function RelationshipGroup({
  heading,
  rows,
  onRemove,
}: {
  heading: "Outgoing" | "Incoming"
  rows: RelationshipRow[]
  onRemove: (relationshipId: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-[0.06em] text-panel-muted-foreground">
          {heading}
        </span>
        <span className="font-mono text-[0.7rem] font-semibold text-panel-muted-foreground-dim">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="pl-0.5 text-xs italic text-panel-muted-foreground-dim">none</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <RelationshipRowView
              key={row.relationship_id ?? `${row.direction}-${row.document_id}-${row.rel_type}`}
              row={row}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/** A single relationship row: rel-type chip (verb + per-type dot) + filename +
 *  remove ✕. A masked row (document_id null) renders the verbatim mask string via
 *  the panel-AA token, never an id/title — but still carries the remove ✕. */
function RelationshipRowView({
  row,
  onRemove,
}: {
  row: RelationshipRow
  onRemove: (relationshipId: string) => void
}) {
  const masked = row.document_id === null
  const label = relLabel(row.rel_type, row.direction)

  return (
    <li
      className={cn(
        "group/rel flex items-center gap-2 rounded-md px-2 py-1.5",
        "hover:bg-accent/40",
      )}
    >
      {/* rel-type chip: verb word + per-type colour dot (decorative dot). */}
      <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-border/50 px-2 py-0.5 text-[11px] font-medium text-foreground">
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", TYPE_DOT[row.rel_type])} />
        {label}
      </span>

      {/* filename — masked rows are italic + panel-AA muted (the SC#2 honesty
          surface; NEVER the global muted). Never an id/title for a masked row. */}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          masked ? "italic text-panel-muted-foreground" : "text-foreground",
        )}
      >
        {row.filename}
      </span>

      {/* Remove ✕ — keyboard-operable AND always reachable on touch (the audit's #1
          fix). Hover/focus-within reveal on fine pointers; coarse-pointer = always-on
          via the rel-x-touch utility (see index.css). aria-label names the full
          target. The control is null-guarded on relationship_id (Plan 03 note). */}
      {row.relationship_id != null && (
        <button
          type="button"
          onClick={() => onRemove(row.relationship_id as string)}
          aria-label={`Remove ${label} link to ${row.filename}`}
          className={cn(
            "rel-x grid h-6 w-6 flex-none place-items-center rounded-md",
            "text-panel-muted-foreground transition-colors",
            "hover:bg-accent hover:text-foreground",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            // Reveal on row hover / row focus-within / own focus (fine pointers);
            // coarse-pointer is forced always-on by the .rel-x-touch rule.
            "opacity-0 group-hover/rel:opacity-100 group-focus-within/rel:opacity-100 focus-visible:opacity-100 rel-x-touch",
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

/** The section-foot "+ Add link" affordance (dashed, full-width — sketch 034). */
function AddLinkButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-left text-sm text-panel-muted-foreground",
        "transition-colors hover:border-primary/50 hover:text-foreground",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      )}
    >
      <span aria-hidden="true">+</span> Add link
    </button>
  )
}

export default RelationshipsSection

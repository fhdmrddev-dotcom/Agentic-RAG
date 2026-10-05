/**
 * Phase 271-04 (FIND-01 / FIND-02 / D-01 / D-02 / D-03 / D-06 / S7) — the Find render on the
 * Library's Documents tab: the search row, and the results surface with its honest states.
 *
 * ⭐ IT OWNS THE FIND RENDER SO `LibraryPage` ONLY WIRES PROPS. `LibraryPage.tsx` is a G-5 hot
 * file whose named seam is "each tab owns its body" (`documentSurface(lead)`); every state
 * below would otherwise be a new branch inside it. The page passes data and callbacks in; this
 * file decides nothing about what matches (the server does, 271-01) and fetches nothing (the
 * hook does, `useDocumentFind`).
 *
 * ⛔ THREE RULES THIS FILE EXISTS TO KEEP:
 *   1. THE SERVER'S ORDER IS THE ORDER. Rows are rendered exactly as received: no sort, no
 *      slice. The meta line states a sort; a client re-sort of one page would make that
 *      statement false for every other page (D-03). The pager reports offsets back to the
 *      server rather than slicing here.
 *   2. AN ERROR NEVER SWAPS THE LIST (S7 / T-271-14). The previous rows stay on screen under
 *      an alert, and the search, chips and sort are untouched. The shipped browse path's catch
 *      replaces the list with the UNFILTERED folder list, which would show a person documents
 *      outside the filters they set with nothing saying so.
 *   3. NOTHING HERE RENDERS IN ASK MODE (D-02). Ask hands its question to chat; the page renders
 *      the Ask card instead of `DocumentsFindResults`, never alongside it.
 */
import type { ComponentProps, KeyboardEvent } from "react"
import { Search, X } from "lucide-react"
import { DocumentList } from "@/components/ingestion/DocumentList"
import { DocumentsPager } from "@/components/library/DocumentsPager"
import { FindModeSwitch } from "./FindModeSwitch"
import { FindMetaLine } from "./FindMetaLine"
import {
  SORT_OPTIONS,
  sortDateColumn,
  type FindMode,
  type FindSort,
  type FindVersion,
} from "@/pages/findState"
import type { DocumentSearchRow } from "@/types"
import type { DocumentSearchError } from "@/lib/api/documents"
import { cn } from "@/lib/utils"

// ── THE SEARCH ROW (S3 / S5) ──────────────────────────────────────────────────────────

export interface FindSearchRowProps {
  mode: FindMode
  onModeChange: (mode: FindMode) => void
  /** The Find input — a file-name filter. */
  name: string
  onNameChange: (name: string) => void
  /** The Ask input — a question for chat. Never the same value as `name` (S5). */
  askText: string
  onAskTextChange: (text: string) => void
  onAsk: (question: string) => void
}

/**
 * The mode switch and ONE input whose meaning follows the mode. Each mode keeps its own text,
 * so switching never turns a question into a file-name filter or the reverse. The request
 * debounce lives in the hook (300 ms, FilterBar's constant), not here.
 */
export function FindSearchRow({
  mode,
  onModeChange,
  name,
  onNameChange,
  askText,
  onAskTextChange,
  onAsk,
}: FindSearchRowProps) {
  const isFind = mode === "find"
  const value = isFind ? name : askText

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isFind) {
      // Esc clears the name only; Enter does nothing (results already follow the typing).
      if (e.key === "Escape" && name !== "") {
        e.preventDefault()
        onNameChange("")
      }
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      const q = askText.trim()
      if (q !== "") onAsk(q)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FindModeSwitch value={mode} onChange={onModeChange} />
      <div className="relative min-w-[12rem] flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          aria-label={isFind ? "File name" : "Your question"}
          placeholder={isFind ? "Filter by file name…" : "Ask a question about your documents"}
          value={value}
          onChange={(e) => (isFind ? onNameChange(e.target.value) : onAskTextChange(e.target.value))}
          onKeyDown={onKeyDown}
          className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
        {isFind && name !== "" && (
          <button
            type="button"
            aria-label="Clear file name"
            onClick={() => onNameChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── THE RESULTS (S4 / S7) ─────────────────────────────────────────────────────────────

/** What DocumentList needs that Find does not decide: row actions, the reader, the selection. */
export type FindListProps = Pick<
  ComponentProps<typeof DocumentList>,
  "onDelete" | "onRefresh" | "currentUserId" | "onSelect" | "selectedDocId" | "folders"
>

export interface DocumentsFindResultsProps {
  /** The server's page, in the server's order. */
  rows: DocumentSearchRow[]
  /** The server's exact count; `null` before the first answer. */
  total: number | null
  /** Older-version rows that would also match (the hint, D-06). */
  olderMatches: number
  loading: boolean
  error: DocumentSearchError | null
  onRetry: () => void
  sort: FindSort
  onSortChange: (sort: FindSort) => void
  hasFolderCondition: boolean
  hasRelationship: boolean
  version: FindVersion
  /** Show them: set Version to Older versions (superseded). It never widens on its own. */
  onShowOlder: () => void
  onClearSearch: () => void
  offset: number
  limit: number
  onPageChange: (offset: number, limit: number) => void
  listProps: FindListProps
}

/** Above this many results the pager renders (the shipped default page size). */
const PAGE_SIZE_DEFAULT = 25

export function DocumentsFindResults({
  rows,
  total,
  olderMatches,
  loading,
  error,
  onRetry,
  sort,
  onSortChange,
  hasFolderCondition,
  hasRelationship,
  version,
  onShowOlder,
  onClearSearch,
  offset,
  limit,
  onPageChange,
  listProps,
}: DocumentsFindResultsProps) {
  // Zero is a CLAIM about the answer, so it is only made once there is one.
  const isZero = !loading && error === null && total === 0
  const showHint = version === "latest" && hasRelationship && olderMatches > 0

  return (
    <div className="flex flex-col space-y-4 min-w-0">
      <FindMetaLine
        total={total}
        loading={loading}
        sort={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={(v) => onSortChange(v as FindSort)}
        showScopeLine={!hasFolderCondition}
        onClearSearch={onClearSearch}
      />

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2"
        >
          <p className="text-sm text-destructive">{"Couldn't run this search. Your filters are kept."}</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          >
            Try again
          </button>
        </div>
      )}

      {isZero ? (
        <div className="rounded-xl bg-card/30 ghost-border py-12 text-center">
          <p className="text-sm font-semibold text-foreground">No documents match</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing is shown from outside these filters. Remove a filter, or clear them all.
          </p>
          <button
            type="button"
            onClick={onClearSearch}
            className="mt-3 text-xs text-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div
          data-testid="find-results"
          aria-busy={loading ? "true" : undefined}
          className={cn("transition-opacity", loading && "opacity-60")}
        >
          <DocumentList
            documents={rows}
            columns="find"
            folderId={undefined}
            findDateColumn={sortDateColumn(sort)}
            {...listProps}
          />
        </div>
      )}

      {showHint && (
        <div
          role="status"
          className="rounded-lg border border-dashed border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning"
        >
          {olderMatches === 1
            ? "1 more match in older (superseded) versions."
            : `${olderMatches} more matches in older (superseded) versions.`}{" "}
          <button
            type="button"
            onClick={onShowOlder}
            className="text-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          >
            Show them
          </button>
        </div>
      )}

      {/* Only when there is more than one page. `min(limit, …)` so a person who chose a smaller
          page size on an earlier search can still page through a 20-row answer. */}
      {total !== null && total > Math.min(limit, PAGE_SIZE_DEFAULT) && (
        <div data-testid="documents-tfoot">
          <DocumentsPager total={total} offset={offset} limit={limit} onChange={onPageChange} exact />
        </div>
      )}
    </div>
  )
}

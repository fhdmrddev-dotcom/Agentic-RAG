/**
 * Phase 275 plan 04 (S9 / D-04) — browse's archived-hidden line.
 *
 * Archived documents are hidden in browse by default. Below the list: `{N} archived document(s)
 * hidden · Show`; once shown, `Showing {N} archived document(s) · Hide` (reversible in place).
 * Absent when N = 0. The toggle is the ONE include-archived state `LibraryPage` keeps in Find's
 * reducer — so browse and Find's `Include archived` chip can never disagree.
 *
 * ⛔ PURE FUNCTION OF PROPS: N is the server's rows counted by the caller; no fetch here.
 */
import { RETENTION_COPY, fillCopy } from "./retentionCopy"

const C = RETENTION_COPY

/**
 * Split a browse list into what is shown and how many archived rows were held back. `include`
 * true shows everything (a view's server resolve, or the person chose Show / Include archived);
 * `archivedCount` still counts them so the line can read "Showing N … · Hide".
 */
export function splitArchived<T extends { archived_at?: string | null }>(
  docs: readonly T[],
  include: boolean,
): { shown: T[]; archivedCount: number } {
  const archivedCount = docs.filter((d) => Boolean(d.archived_at)).length
  return { shown: include ? [...docs] : docs.filter((d) => !d.archived_at), archivedCount }
}

export function ArchivedHiddenLine({
  count,
  included,
  onChange,
}: {
  count: number
  included: boolean
  onChange: (include: boolean) => void
}) {
  if (count <= 0) return null
  return (
    <p data-testid="archived-hidden-line" className="px-4 py-2 text-xs text-muted-foreground">
      {included
        ? fillCopy(C.specTemplates.showingArchived, { N: count })
        : fillCopy(C.sketchTemplates.archivedHidden, { N: count })}
      {" · "}
      <button
        type="button"
        onClick={() => onChange(!included)}
        className="font-medium text-[hsl(239_70%_50%)] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm dark:text-primary"
      >
        {included ? C.contract.hide : C.ported.show}
      </button>
    </p>
  )
}

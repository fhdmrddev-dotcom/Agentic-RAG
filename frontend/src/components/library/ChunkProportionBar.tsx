/**
 * Phase 217.1 plan 05 (LIB-03) — the chunk count with a proportion bar, role-matched to
 * `KnowledgeHealthPage.tsx`'s `ConfidenceChip` (track + fill + tabular number).
 *
 * `value` is the document's `chunk_count` (0 when unknown/null — the bar is honest about
 * "no chunks", never a missing element); `max` is the highest `chunk_count` over the
 * currently loaded documents, computed ONCE in `DocumentList` and passed down.
 *
 * ⛔ `max === 0` (no loaded document has chunks) renders the empty track — fill width is
 * 0%, never a division by zero and never a NaN width.
 */
export function ChunkProportionBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-1.5 shrink-0" data-testid="chunk-proportion-bar">
      <div className="w-14 h-1.5 bg-muted/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{value}</span>
    </div>
  )
}

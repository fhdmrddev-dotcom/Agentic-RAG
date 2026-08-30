/** Phase 217.1-12 — extracted from KnowledgeHealthPage.tsx:87-99 for reuse in HealthTab. */

export function ChartSkeleton() {
  return (
    <div className="ghost-border bg-card/50 rounded-lg p-4 space-y-3 h-64">
      <div className="animate-pulse bg-muted/30 h-4 w-56 rounded" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="animate-pulse bg-muted/30 h-3 w-32 rounded" />
          <div className="animate-pulse bg-muted/30 h-5 rounded flex-1" style={{ maxWidth: `${60 - i * 10}%` }} />
        </div>
      ))}
    </div>
  )
}
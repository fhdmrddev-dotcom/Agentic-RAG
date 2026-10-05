// Phase 276-03 (UI-SPEC P2) — Previous / Next within the section's IA order. A missing side leaves
// an empty cell so the other card keeps its column.
export interface PagerLink {
  title: string
  href: string
}

export function Pager({ prev, next }: { prev: PagerLink | null; next: PagerLink | null }) {
  if (!prev && !next) return null
  return (
    <nav className="d-pager" aria-label="Pages in this section">
      {prev ? (
        <a className="d-card d-pager-card" href={prev.href} rel="prev">
          <span className="d-muted">Previous</span>
          <span className="d-card-title">{prev.title}</span>
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a className="d-card d-pager-card d-pager-next" href={next.href} rel="next">
          <span className="d-muted">Next</span>
          <span className="d-card-title">{next.title}</span>
        </a>
      ) : (
        <span />
      )}
    </nav>
  )
}

// Phase 276-03 (UI-SPEC P2) — Docs › {Section} › {Page}. Every crumb links; the last is current.
export interface Crumb {
  label: string
  href: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="d-crumbs">
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <li key={c.href + i}>
              {i > 0 && (
                <span className="d-crumb-sep" aria-hidden="true">
                  {" › "}
                </span>
              )}
              <a href={c.href} aria-current={last ? "page" : undefined} className={last ? "d-crumb-current" : undefined}>
                {c.label}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

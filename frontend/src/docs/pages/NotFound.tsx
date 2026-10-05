// Phase 276-03 (UI-SPEC P8, G4-4) — any unknown /docs/* path, rendered INSIDE the docs shell.
import type { ReactNode } from "react"
import { NOT_FOUND } from "./copy"

export function NotFound({ search }: { search?: ReactNode }) {
  return (
    <article className="d-article d-notfound">
      <h1 tabIndex={-1} className="d-h1">
        {NOT_FOUND.title}
      </h1>
      <p className="d-prose-p">{NOT_FOUND.body}</p>
      {search && <div className="d-notfound-search">{search}</div>}
      <p>
        <a className="btn btn-primary" href="/docs">
          {NOT_FOUND.cta}
        </a>
      </p>
    </article>
  )
}

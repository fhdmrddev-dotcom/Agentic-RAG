// Phase 276-03 (UI-SPEC P4, D-07) — a section's page list, grouped by sections.json groups, in IA
// order. Stubs are listed with their badge, never hidden.
import { Breadcrumbs } from "../components/Breadcrumbs"
import { DocBadge } from "../components/DocBadge"
import { docsUrl, pageBySlug, sectionOf, useDocs } from "../docsData"
import type { PageMeta } from "../types"

function Row({ page }: { page: PageMeta }) {
  return (
    <a className="d-row" href={docsUrl(page.slug)}>
      <span className="d-row-text">
        <span className="d-card-title">{page.title}</span>
        {page.summary && <span className="d-muted d-clamp1">{page.summary}</span>}
      </span>
      <span className="d-row-badges">
        <DocBadge kind="audience" audience={page.audience} />
        {page.status === "stub" && <DocBadge kind="coming" />}
        {page.release === "v4.5" && <DocBadge kind="unreleased" />}
      </span>
    </a>
  )
}

export function SectionIndex({ sectionId }: { sectionId: string }) {
  const data = useDocs()
  const section = sectionOf(data, sectionId)
  if (!section) return null
  const pagesOf = (slugs: string[]) => slugs.map((s) => pageBySlug(data, s)).filter((p): p is PageMeta => p !== null)
  const groups = section.groups?.length ? section.groups : [{ title: "", slugs: section.slugs }]
  const grouped = new Set(groups.flatMap((g) => g.slugs))
  const loose = section.groups?.length ? pagesOf(section.slugs.filter((s) => !grouped.has(s))) : []

  return (
    <article className="d-article">
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: section.title, href: docsUrl(section.id) },
        ]}
      />
      <h1 tabIndex={-1} className="d-h1">
        {section.title}
      </h1>
      <p className="d-lead">{section.purpose}</p>
      {loose.length > 0 && (
        <div className="d-rows">
          {loose.map((p) => (
            <Row key={p.slug} page={p} />
          ))}
        </div>
      )}
      {groups.map((g) => {
        const list = pagesOf(g.slugs)
        if (list.length === 0) return null
        return (
          <section key={g.title || "all"} className="d-group">
            {g.title && <h2 className="d-h-sm">{g.title}</h2>}
            <div className="d-rows">
              {list.map((p) => (
                <Row key={p.slug} page={p} />
              ))}
            </div>
          </section>
        )
      })}
    </article>
  )
}

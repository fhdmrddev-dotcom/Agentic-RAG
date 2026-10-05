// Phase 276-03 (UI-SPEC P3, D-07, D-04, SC#6) — a stub: summary + "Full guide coming", the honesty
// callout when the feature is v4.5, its frontmatter video slot (connect/overview → clip.connections
// and the control-plane stub → clip.admin are only reachable here), and "Read next".
// No TOC pill and no pager.
import { Breadcrumbs } from "../components/Breadcrumbs"
import { Callout, UnreleasedCallout } from "../components/Callout"
import { DocBadge } from "../components/DocBadge"
import { docsUrl, pageBySlug, sectionOf, sectionPages, useDocs } from "../docsData"
import type { PageMeta } from "../types"
import { VideoSlot } from "../video/VideoSlot"
import { STUB_SENTENCE } from "./copy"

export function Stub({ slug }: { slug: string }) {
  const data = useDocs()
  const page = pageBySlug(data, slug)
  if (!page) return null
  const section = sectionOf(data, page.section)
  const unreleased = page.release === "v4.5"

  const nearest = pageBySlug(data, page.nearest)
  const readNext: PageMeta[] = []
  if (nearest && nearest.status === "written") readNext.push(nearest)
  for (const p of sectionPages(data, page.section)) {
    if (readNext.length >= 3) break
    if (p.status === "written" && p.slug !== page.slug && !readNext.some((r) => r.slug === p.slug)) readNext.push(p)
  }

  return (
    <article className="d-article">
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          ...(section ? [{ label: section.title, href: docsUrl(section.id) }] : []),
          { label: page.title, href: docsUrl(page.slug) },
        ]}
      />
      <h1 tabIndex={-1} className="d-h1">
        {page.title}
      </h1>
      <div className="d-meta">
        <DocBadge kind="coming" />
        {unreleased && <DocBadge kind="unreleased" />}
        <DocBadge kind="audience" audience={page.audience} />
      </div>
      {unreleased && <UnreleasedCallout />}
      {page.summary && <p className="d-prose-p">{page.summary}</p>}
      <VideoSlot slot={page.video} />
      <Callout kind="info">
        <p>{STUB_SENTENCE}</p>
      </Callout>
      {readNext.length > 0 && (
        <section className="d-readnext">
          <h2 className="d-h-sm">Read next</h2>
          <div className="d-stack">
            {readNext.map((p) => (
              <a key={p.slug} className="d-card d-pager-card" href={docsUrl(p.slug)}>
                <span className="d-card-title">{p.title}</span>
                <span className="d-muted">{sectionOf(data, p.section)?.title ?? p.section}</span>
              </a>
            ))}
          </div>
        </section>
      )}
      {section && (
        <p>
          <a href={docsUrl(section.id)}>← All of {section.title}</a>
        </p>
      )}
    </article>
  )
}

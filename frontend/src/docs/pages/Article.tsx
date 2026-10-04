// Phase 276-03 (UI-SPEC P2, D-01, D-04) — a written guide: one centred 740px column.
// The sketch's page-feedback (thumbs) row is deliberately NOT built: nothing could receive it.
import { useEffect, useState } from "react"
import { Breadcrumbs } from "../components/Breadcrumbs"
import { PartialUnreleasedCallout, UnreleasedCallout } from "../components/Callout"
import { DocBadge } from "../components/DocBadge"
import { Markdown, hasVideoDirective } from "../components/Markdown"
import { Pager, type PagerLink } from "../components/Pager"
import { TocPill } from "../components/TocPill"
import { docsUrl, pageBySlug, sectionOf, sectionPages, useDocs } from "../docsData"
import type { PageMeta } from "../types"
import { VideoSlot } from "../video/VideoSlot"

const link = (p: PageMeta | undefined): PagerLink | null => (p ? { title: p.title, href: docsUrl(p.slug) } : null)

type Body = { slug: string; md: string } | { slug: string; error: true } | null

export function Article({ slug }: { slug: string }) {
  const data = useDocs()
  const page = pageBySlug(data, slug)
  const [body, setBody] = useState<Body>(null)

  useEffect(() => {
    let live = true
    data.loadPage(slug).then(
      (md) => live && setBody({ slug, md }),
      () => live && setBody({ slug, error: true }),
    )
    return () => {
      live = false
    }
  }, [data, slug])

  if (!page) return null
  const section = sectionOf(data, page.section)
  const siblings = sectionPages(data, page.section)
  const at = siblings.findIndex((p) => p.slug === page.slug)
  const current = body && body.slug === slug ? body : null
  const md = current && "md" in current ? current.md : null
  const unreleased = page.release === "v4.5"

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
      {page.summary && <p className="d-lead">{page.summary}</p>}
      <div className="d-meta">
        <span className="d-pill">{page.readMinutes} min read</span>
        {page.reviewed && <span className="d-pill">Last reviewed {page.reviewed}</span>}
        {unreleased && <DocBadge kind="unreleased" />}
        <DocBadge kind="updated" version={page.updated} />
        <DocBadge kind="audience" audience={page.audience} />
      </div>
      {unreleased && <UnreleasedCallout />}
      {!unreleased && <PartialUnreleasedCallout items={page.unreleased} />}
      {md !== null && !hasVideoDirective(md) && <VideoSlot slot={page.video} />}
      {md !== null && <Markdown video={page.video}>{md}</Markdown>}
      {current && "error" in current && (
        <p role="alert" className="d-muted">
          This page couldn't load. Refresh the page, or go back to the docs home.
        </p>
      )}
      <Pager prev={link(siblings[at - 1])} next={at >= 0 ? link(siblings[at + 1]) : null} />
      {page.headings.length >= 3 && <TocPill headings={page.headings} />}
    </article>
  )
}

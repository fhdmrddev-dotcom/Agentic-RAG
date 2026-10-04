// Phase 276-03 (UI-SPEC P5 version page, D-04) — one release in the article layout: "Released
// {date}" or the unreleased badge + exact callout, the shipped bullets, and prev/next versions.
import { Breadcrumbs } from "../components/Breadcrumbs"
import { Callout, UnreleasedCallout } from "../components/Callout"
import { DocBadge } from "../components/DocBadge"
import { Markdown } from "../components/Markdown"
import { Pager } from "../components/Pager"
import { useDocs } from "../docsData"
import type { Release } from "../types"

const link = (r: Release | undefined) => (r ? { title: `${r.version} — ${r.name}`, href: `/docs/changelog/${r.version}` } : null)

export function ChangelogVersion({ version }: { version: string }) {
  const { changelog } = useDocs()
  const at = changelog.findIndex((r) => r.version === version)
  const r = changelog[at]
  if (!r) return null
  const heading = r.released ? "What shipped" : "What is planned"
  const body = `## ${heading}\n\n${r.shipped.map((s) => `- ${s}`).join("\n")}\n`

  return (
    <article className="d-article">
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Changelog", href: "/docs/changelog" },
          { label: r.version, href: `/docs/changelog/${r.version}` },
        ]}
      />
      <h1 tabIndex={-1} className="d-h1">
        {r.version} — {r.name}
      </h1>
      <div className="d-meta">
        {r.released && r.date ? <span className="d-pill">Released {r.date}</span> : <DocBadge kind="unreleased" />}
        <span className="d-pill">
          Chapter {r.chapter.n}: {r.chapter.title}
        </span>
      </div>
      {!r.released && <UnreleasedCallout />}
      <p className="d-lead">{r.oneLiner}</p>
      {r.note && (
        <Callout kind="info">
          <p>Later changed: {r.note}</p>
        </Callout>
      )}
      {r.shipped.length > 0 && <Markdown>{body}</Markdown>}
      {/* Previous = the older release, Next = the newer one (the list is newest first). */}
      <Pager prev={link(changelog[at + 1])} next={link(changelog[at - 1])} />
      {/* No TOC pill: a generated version body has one H2, below the >= 3 H2 rule. */}
    </article>
  )
}

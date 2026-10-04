// Phase 276-03 (UI-SPEC P1, D-01, D-06, D-08) — the docs home in sketch 276 direction B: hero with
// the search box as the focal point and the overview video, the bento of guides, every section,
// and the chapter strip. Counts are derived from the manifest, never typed.
import type { ReactNode } from "react"
import { ChapterStrip } from "../components/ChapterStrip"
import { DocBadge } from "../components/DocBadge"
import { docsUrl, pageBySlug, useDocs } from "../docsData"
import { PlayIcon } from "../icons"
import { VideoSlot, resolveSlot } from "../video/VideoSlot"

interface Cell {
  slug: string
  label?: string
  mono: string
  size?: "big" | "wide"
}

/** UI-SPEC P1 bento: written pages first; any stub shown is badged. */
const BENTO: Cell[] = [
  { slug: "use/chat", mono: "Ch", size: "big" },
  { slug: "automate/workflows/overview", mono: "Wf", size: "wide" },
  { slug: "get-started/quickstart", mono: "Qs" },
  { slug: "use/library/documents", mono: "Li" },
  { slug: "experts/what-are-experts", mono: "Ex" },
  { slug: "security/data-isolation", mono: "Se" },
  { slug: "api/overview", mono: "Ap" },
  { slug: "changelog", label: "What's new", mono: "Nw" },
]

function BentoCard({ cell }: { cell: Cell }) {
  const data = useDocs()
  if (cell.slug === "changelog") {
    const latest = data.changelog.find((r) => r.released)
    return (
      <a className="d-card d-bento-cell" href="/docs/changelog">
        <span className="d-mono-tile" aria-hidden="true">
          {cell.mono}
        </span>
        <span className="d-card-title">{cell.label}</span>
        <span className="d-muted d-clamp2">
          {latest ? `Latest release: ${latest.version} — ${latest.name}.` : "Every release, newest first."}
        </span>
      </a>
    )
  }
  const page = pageBySlug(data, cell.slug)
  if (!page) return null
  const clip = page.video && page.video.startsWith("clip.") ? resolveSlot(page.video) : null
  let meta: ReactNode
  if (page.status === "stub") meta = <DocBadge kind="coming" />
  else meta = `${page.readMinutes} min read${clip ? " · has a 15-s clip" : ""}`
  return (
    <a className={`d-card d-bento-cell${cell.size ? ` d-bento-${cell.size}` : ""}`} href={docsUrl(page.slug)}>
      <span className="d-bento-head">
        <span className="d-mono-tile" aria-hidden="true">
          {cell.mono}
        </span>
        <span className={cell.size === "big" ? "d-h-md" : "d-card-title"}>{page.title}</span>
      </span>
      {cell.size === "big" && clip && clip.poster && (
        <span className="d-bento-poster" aria-hidden="true">
          <img src={clip.poster} alt="" loading="lazy" decoding="async" width={1280} height={720} />
          <span className="d-play d-play-sm">
            <PlayIcon size={18} />
          </span>
        </span>
      )}
      {page.summary && <span className="d-muted d-clamp2">{page.summary}</span>}
      <span className="d-muted d-bento-meta">{meta}</span>
    </a>
  )
}

export function Home({ search }: { search?: ReactNode }) {
  const data = useDocs()
  return (
    <div className="d-home">
      <section className="d-hero">
        <div className="wrap">
          <p className="eyebrow">Docs</p>
          <h1 tabIndex={-1} className="d-h1 d-hero-h1">
            Everything Syrel does,
            <br />
            <span className="d-gradient">explained in minutes.</span>
          </h1>
          <p className="d-hero-sub">
            Guides, short clips and the full release history — the same claims as the product, never more.
          </p>
          {search && <div className="d-hero-search">{search}</div>}
          <div className="d-hero-video">
            <VideoSlot slot="home.overview" />
          </div>
        </div>
      </section>

      <section className="wrap d-home-section">
        <h2 className="d-h-md">Start with a guide</h2>
        <div className="d-bento">
          {BENTO.map((c) => (
            <BentoCard key={c.slug} cell={c} />
          ))}
        </div>
      </section>

      <section className="wrap d-home-section" id="browse">
        <h2 className="d-h-md">Browse every section</h2>
        <div className="grid3 d-grid">
          {data.sections.map((s) => {
            const own = data.pages.filter((p) => p.section === s.id)
            const written = own.filter((p) => p.status === "written").length
            const stubs = own.length - written
            return (
              <a key={s.id} className="d-card d-section-card" href={docsUrl(s.id)}>
                <span className="d-card-title">{s.title}</span>
                <span className="d-muted">{s.purpose}</span>
                {s.id === "changelog" ? (
                  <span className="d-muted">{data.changelog.length} releases</span>
                ) : (
                  <span className="d-muted">
                    <strong>
                      {written} guides · {stubs} coming
                    </strong>
                  </span>
                )}
              </a>
            )
          })}
        </div>
      </section>

      <section className="wrap d-home-section">
        <h2 className="d-h-md">How Syrel got here</h2>
        <p className="d-muted">
          Five chapters, {data.changelog.length} releases.
        </p>
        <ChapterStrip chapters={data.chapters} mode="link" />
      </section>
    </div>
  )
}

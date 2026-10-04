// Phase 276-03 (UI-SPEC P5, DOCS-05, D-04, D-10) — every release, newest first, grouped by chapter.
// The chapter strip and the chip row share ONE filter state, mirrored to ?chapter=n so a filtered
// view is linkable. A chapter's documentary column renders ONLY when its slot resolves to a real
// video; until then the rows take the full width (UI-SPEC V0).
import { useEffect, useState } from "react"
import { ChapterStrip } from "../components/ChapterStrip"
import { DocBadge } from "../components/DocBadge"
import { useDocs } from "../docsData"
import type { Release } from "../types"
import { VideoSlot, slotExists } from "../video/VideoSlot"

function readChapter(max: number): number | null {
  const raw = new URLSearchParams(window.location.search).get("chapter")
  const n = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null
}

function ReleaseRow({ r }: { r: Release }) {
  return (
    <a className="d-rel-row" href={`/docs/changelog/${r.version}`}>
      <span className="d-rel-version">{r.version}</span>
      <span className="d-rel-date">{r.released && r.date ? r.date : "—"}</span>
      <span className="d-rel-main">
        <span className="d-rel-title">
          <span className="d-card-title">{r.name}</span>
          {!r.released && <DocBadge kind="unreleased" />}
        </span>
        {r.released && r.date && <span className="d-muted d-rel-date-m">Released {r.date}</span>}
        <span className="d-muted d-rel-summary">{r.released ? r.oneLiner : `Planned, not shipped yet: ${r.oneLiner}`}</span>
        {r.note && <span className="d-muted d-rel-note">Later changed: {r.note}</span>}
      </span>
    </a>
  )
}

export function Changelog() {
  const { changelog, chapters } = useDocs()
  const [chapter, setChapter] = useState<number | null>(() => readChapter(chapters.length || 5))

  useEffect(() => {
    const onPop = () => setChapter(readChapter(chapters.length || 5))
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [chapters.length])

  function choose(n: number | null) {
    setChapter(n)
    const url = window.location.pathname + (n ? `?chapter=${n}` : "")
    window.history.replaceState(window.history.state, "", url)
  }

  // Groups in the changelog's own (newest-first) order.
  const groups: { n: number; title: string; range: string; releases: Release[] }[] = []
  for (const r of changelog) {
    if (chapter !== null && r.chapter.n !== chapter) continue
    let g = groups.find((x) => x.n === r.chapter.n)
    if (!g) {
      g = { n: r.chapter.n, title: r.chapter.title, range: r.chapter.range, releases: [] }
      groups.push(g)
    }
    g.releases.push(r)
  }

  return (
    <div className="d-changelog">
      <section className="d-hero d-cl-hero">
        <div className="wrap">
          <p className="eyebrow">Changelog</p>
          <h1 tabIndex={-1} className="d-h1">
            Shipped, <span className="d-gradient">not promised.</span>
          </h1>
          <p className="d-hero-sub">Every release, what it changed for you, and what has not shipped yet.</p>
        </div>
      </section>

      <div className="wrap d-cl-body">
        <ChapterStrip chapters={chapters} mode="filter" selected={chapter} onSelect={choose} />
        <div className="d-chips" role="group" aria-label="Filter by chapter">
          <button type="button" className="d-chip" aria-pressed={chapter === null} onClick={() => choose(null)}>
            All releases
          </button>
          {chapters.map((c) => (
            <button
              key={c.n}
              type="button"
              className="d-chip"
              aria-pressed={chapter === c.n}
              onClick={() => choose(chapter === c.n ? null : c.n)}
            >
              {c.n}. {c.title}
            </button>
          ))}
        </div>

        <div className="d-cl-list">
          {groups.map((g) => {
            const slot = `changelog.chapter-${g.n}`
            const episode = slotExists(slot)
            return (
              <section key={g.n} className="d-cl-group" aria-label={`Chapter ${g.n}: ${g.title}`}>
                <div className="d-cl-band">
                  <span className="eyebrow">Chapter {g.n}</span>
                  <span className="d-card-title">{g.title}</span>
                  <span className="d-mono d-muted">{g.range}</span>
                </div>
                <div className={episode ? "d-cl-grid d-cl-grid-episode" : "d-cl-grid"}>
                  <div className="d-cl-rows">
                    {g.releases.map((r) => (
                      <ReleaseRow key={r.version} r={r} />
                    ))}
                  </div>
                  {episode && (
                    <div className="d-cl-episode">
                      <VideoSlot slot={slot} />
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

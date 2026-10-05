// Phase 276-07 (D-26, D-12) — "Syrel: The Build Story". The five chapters of the README arc table,
// in ascending order, each with its summary, its range, its releases oldest first and its
// changelog.chapter-N VideoSlot. Reads the manifest through useDocs() only (docsManifest.ts stays
// the one virtual-module importer).
//
// ⛔ Honesty: the chapter episodes are not uploaded yet, so a slot with no youtubeId renders NOTHING
// (D-12) and no copy here may promise a video. Any words about an episode live ONLY inside the block
// that renders when slotExists() is true — BuildStory.test.tsx fails if "documentar" appears while
// every slot is empty. It never autoplays: a filled slot is the click-to-load YouTube facade.
import { DocBadge } from "../components/DocBadge"
import { useDocs } from "../docsData"
import type { Chapter, Release } from "../types"
import { VideoSlot, slotExists } from "../video/VideoSlot"

function StoryRow({ r }: { r: Release }) {
  return (
    <a className="d-rel-row" href={`/docs/changelog/${r.version}`}>
      <span className="d-rel-version">{r.version}</span>
      <span className="d-rel-date">{r.released && r.date ? r.date : "—"}</span>
      <span className="d-rel-main">
        <span className="d-rel-title">
          <span className="d-card-title">{r.name}</span>
          {!r.released && <DocBadge kind="unreleased" />}
        </span>
      </span>
    </a>
  )
}

function ChapterBlock({ c, releases }: { c: Chapter; releases: Release[] }) {
  const slot = `changelog.chapter-${c.n}`
  const episode = slotExists(slot)
  return (
    <section id={`chapter-${c.n}`} className="d-story-chapter" aria-label={`Chapter ${c.n}: ${c.title}`}>
      <div className="d-cl-band">
        <span className="eyebrow">Chapter {c.n}</span>
        <span className="d-card-title">{c.title}</span>
        <span className="d-mono d-muted">{c.range}</span>
      </div>
      <p className="d-story-summary">{c.summary}</p>
      <div className={episode ? "d-cl-grid d-cl-grid-episode" : "d-cl-grid"}>
        <div className="d-cl-rows">
          {releases.map((r) => (
            <StoryRow key={r.version} r={r} />
          ))}
        </div>
        {episode && (
          <div className="d-cl-episode">
            <p className="d-muted d-story-episode">The chapter {c.n} documentary</p>
            <VideoSlot slot={slot} />
          </div>
        )}
      </div>
      <a className="d-story-more" href={`/docs/changelog?chapter=${c.n}`}>
        See these releases in the changelog
      </a>
    </section>
  )
}

export function BuildStory() {
  const { changelog, chapters } = useDocs()
  // The changelog is newest first; the story reads oldest first.
  const oldestFirst = [...changelog].reverse()
  const ordered = [...chapters].sort((a, b) => a.n - b.n)

  return (
    <div className="d-changelog d-story">
      <section className="d-hero d-cl-hero">
        <div className="wrap">
          <p className="eyebrow">Changelog</p>
          <h1 tabIndex={-1} className="d-h1">
            Syrel: <span className="d-gradient">The Build Story</span>
          </h1>
          <p className="d-hero-sub">The five chapters of how Syrel was built, release by release.</p>
        </div>
      </section>

      <div className="wrap d-cl-body">
        <div className="d-cl-list">
          {ordered.map((c) => (
            <ChapterBlock key={c.n} c={c} releases={oldestFirst.filter((r) => r.chapter.n === c.n)} />
          ))}
        </div>
      </div>
    </div>
  )
}

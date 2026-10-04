// Phase 276-03 (UI-SPEC P1 / P5) — the five chapters. On the home page each card links to the
// filtered changelog; on the changelog the same cards are filter buttons (aria-pressed).
import type { Chapter } from "../types"

type Props =
  | { chapters: Chapter[]; mode: "link" }
  | { chapters: Chapter[]; mode: "filter"; selected: number | null; onSelect: (n: number | null) => void }

export function ChapterStrip(props: Props) {
  return (
    <div className="d-chapters">
      {props.chapters.map((c) => {
        const inner = (
          <>
            <span className="eyebrow">Chapter {c.n}</span>
            <span className="d-card-title">{c.title}</span>
            <span className="d-mono d-muted">{c.range}</span>
          </>
        )
        if (props.mode === "link") {
          return (
            <a key={c.n} className="d-card d-chapter" href={`/docs/changelog?chapter=${c.n}`}>
              {inner}
            </a>
          )
        }
        const pressed = props.selected === c.n
        return (
          <button
            key={c.n}
            type="button"
            className={`d-card d-chapter${pressed ? " d-pressed" : ""}`}
            aria-pressed={pressed}
            onClick={() => props.onSelect(pressed ? null : c.n)}
          >
            {inner}
          </button>
        )
      })}
    </div>
  )
}

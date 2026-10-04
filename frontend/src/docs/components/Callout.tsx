// Phase 276-03 (UI-SPEC P2) — info / warn callouts with an SVG glyph (no emoji), plus the two
// honesty callouts. Their exact sentences live in pages/copy.ts (one home).
import type { ReactNode } from "react"
import { InfoIcon, WarnIcon } from "../icons"
import { UNRELEASED_SENTENCE } from "../pages/copy"

export function Callout({ kind, children }: { kind: "info" | "warn"; children: ReactNode }) {
  return (
    <div className={`d-callout d-callout-${kind}`}>
      <span className="d-callout-icon">{kind === "warn" ? <WarnIcon size={20} /> : <InfoIcon size={20} />}</span>
      <div className="d-callout-body">{children}</div>
    </div>
  )
}

/** The exact unreleased callout (G4-3) — first thing after the meta row on every v4.5 page. */
export function UnreleasedCallout() {
  return (
    <Callout kind="warn">
      <p>{UNRELEASED_SENTENCE}</p>
    </Callout>
  )
}

/** A shipped page that describes some v4.5 items (frontmatter `unreleased:`). */
export function PartialUnreleasedCallout({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <Callout kind="warn">
      <p>
        Part of this page is not yet released. The parts covering {items.join(", ")} belong to v4.5, which has not
        shipped. Everything else here is in Syrel today.
      </p>
    </Callout>
  )
}

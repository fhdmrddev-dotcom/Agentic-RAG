/**
 * Phase 124-01 Task 2 (WUX-01, sketch 046-A / D-04) — PhaseSpine.
 *
 * The HORIZONTAL glyph-dot phase spine: one dot per phase, type glyph only. It is
 * a NET-NEW sibling of the vertical `PhaseSpineGraph`, sharing ONLY the glyph
 * vocabulary (imported from `soulData`, never re-declared). Per the locked 046-A
 * sketch it STRIPS the two things the `PhaseChain` / `PhaseSpineGraph` donors
 * render: the phase-TYPE ribbon ("server"/"agent"/"deliverable") and the
 * phase-INDEX number. Glyph-only at card scale (names on hover via `title=`),
 * names visible as quiet labels at run/pub scale. The `llm_emit` ◆ deliverable
 * node is tinted with the accent-violet treatment copied from PhaseSpineGraph.
 *
 * XSS (T-124-01): every authored string (phase names) is rendered as a plain React
 * text child / `title=` attribute value — never `dangerouslySetInnerHTML`.
 *
 * G-5 RED LINE: this is a sibling component; it MUST NOT import or touch the
 * run-surface live phase-timeline / phase-card.
 */
import { PHASE_GLYPHS, type DefShape } from "@/components/workflows/soulData"

export type SoulScale = "card" | "run" | "pub"

export interface PhaseSpineProps {
  def: DefShape | null | undefined
  scale: SoulScale
}

/** The dot diameter / glyph size per scale (layout-only tuning; data is identical). */
const DOT_CLASS: Record<SoulScale, string> = {
  card: "h-6 w-6 text-[12px]",
  run: "h-7 w-7 text-[14px]",
  pub: "h-9 w-9 text-[18px]",
}

export function PhaseSpine({ def, scale }: PhaseSpineProps) {
  // Sort by phase_index (strict run order). The input array order is irrelevant.
  const ordered = [...(def?.phases ?? [])].sort(
    (a, b) => (a.phase_index ?? 0) - (b.phase_index ?? 0),
  )

  if (ordered.length === 0) {
    return (
      <p data-testid="soul-spine-empty" className="text-[11px] italic text-muted-foreground">
        No phases yet
      </p>
    )
  }

  const showNames = scale !== "card"

  return (
    <div
      data-testid="soul-spine"
      className="flex flex-wrap items-center gap-2"
      aria-label="Workflow phase spine"
    >
      {ordered.map((p, i) => {
        const type = p.config?.phase_type ?? "?"
        const glyph = PHASE_GLYPHS[type] ?? "•"
        const isEmit = type === "llm_emit"
        const name = p.name?.trim() || p.slug || ""

        return (
          <span key={p.slug ?? i} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden="true" className="text-[11px] text-muted-foreground">
                ·
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span
                data-testid={`spine-dot-${p.slug ?? i}`}
                data-slug={p.slug ?? ""}
                data-phase-type={type}
                // At card scale the name lives only in title= (quiet, hover-only).
                title={name || undefined}
                aria-label={name || type}
                className={[
                  "grid place-items-center rounded-full border font-mono leading-none",
                  DOT_CLASS[scale],
                  isEmit
                    ? "border-accent-violet text-accent-violet"
                    : "border-border text-foreground",
                ].join(" ")}
              >
                <span aria-hidden="true">{glyph}</span>
              </span>
              {showNames && name && (
                <span className="max-w-[140px] truncate text-[11px] text-muted-foreground">
                  {name}
                </span>
              )}
            </span>
          </span>
        )
      })}
    </div>
  )
}

export default PhaseSpine

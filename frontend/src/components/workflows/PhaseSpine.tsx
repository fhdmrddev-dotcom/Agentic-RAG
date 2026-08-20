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
import { PHASE_TYPE_SENTENCES } from "@/components/workflows/phaseVocabulary"
import { PHASE_GLYPHS, type DefShape } from "@/components/workflows/soulData"
import { phaseGlyph } from "@/lib/phaseGlyph"

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
        const Glyph = phaseGlyph(type)
        const isEmit = type === "llm_emit"
        // ── 200-WIRE (sketch 200 `publish.html`) — THE SPINE REACHES THE LADDER'S FLOOR ──
        // ⚠ WHAT SHIPPED: `p.name` alone, so a phase with no authored name and no slug got
        // a bare glyph and NOTHING legible beside it. `grep -n "phaseVocabulary"` over this
        // file returned **0** — the shipped type vocabulary was one import away and unused.
        // The 187 node-face LADDER is author name → config-derived → type sentence; this
        // spine only ever reached rung one. It now falls through to the same honest floor
        // every other surface uses, so an unnamed step says what KIND of step it is.
        //
        // ⚠ THE SHEET'S OWN WORDS ARE NOT PORTED, AND THE REASON IS THAT THEY DO NOT EXIST.
        // `publish.html` draws uppercase type words — `SEARCH` · `REASON` · `EMIT` — and
        // NEITHER shipped map yields them: `PHASE_TYPE_SENTENCES` gives "Work out how to do
        // it", `PHASE_TYPE_LABELS` gives "AI agent step" and is reserved by its own docblock
        // for the ⌥ Technical-names reveal ("NOT the default node face"). Inventing a third
        // type vocabulary to match three drawn words would be a new concept, not wiring, so
        // the FLOOR is spent instead and the sheet's exact words are declined here.
        const name = p.name?.trim() || p.slug || PHASE_TYPE_SENTENCES[type] || ""

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
                <span aria-hidden="true">
                  {Glyph ? <Glyph /> : (PHASE_GLYPHS[type] ?? "•")}
                </span>
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

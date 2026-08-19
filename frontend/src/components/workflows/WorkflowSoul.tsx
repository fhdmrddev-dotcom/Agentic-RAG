/**
 * Phase 124-01 Task 2 (WUX-01, sketch 046-A / D-03 / D-04) — WorkflowSoul.
 *
 * The scale-keyed 5-atom workflow "soul" — ONE renderer that draws the
 * identity-carrying atoms every soul size (card / run / pub) shows, in the LOCKED
 * 046-A order with PURPOSE as the hero at every size:
 *   (1) purpose   — business_requirement (the hero headline)
 *   (2) needs     — entryInputKeys, joined
 *   (3) spine     — the glyph-dot PhaseSpine
 *   (4) tier      — ONE chip (glyph + WORD) derived via tierForDefinition
 *   (5) output    — the honest deliverable line
 *
 * The `scale` prop tunes layout/typography ONLY — the data + derivation are
 * identical across the same shared atoms at all three sizes (D-04, SC#1+SC#2), so
 * the three sizes can never render disagreeing tiers, glyphs, or outputs.
 *
 * HONEST empty-states (D-03) — the atom is ALWAYS rendered, never hidden, never a
 * fabricated value:
 *   - business_requirement == null → "draft · purpose not declared yet"
 *   - no terminal llm_emit phase   → "produces: answer in chat"
 *
 * XSS (T-124-01): business_requirement, needs keys, and the deliverable label are
 * user/LLM-authored — every one renders as a plain React text child (auto-escaped).
 * NEVER `dangerouslySetInnerHTML`.
 *
 * G-5 RED LINE: a sibling component — it MUST NOT import the run-surface live
 * phase-timeline / phase-card. The tier + glyphs come from `soulData` only.
 */
import {
  tierForDefinition,
  entryInputKeys,
  soulDeliverable,
  type DefShape,
} from "@/components/workflows/soulData"
import { PhaseSpine, type SoulScale } from "@/components/workflows/PhaseSpine"

export interface WorkflowSoulProps {
  def: DefShape | null | undefined
  scale: SoulScale
}

/** Purpose-hero typography per scale (purpose is the largest text at EVERY size). */
const PURPOSE_CLASS: Record<SoulScale, string> = {
  card: "text-sm font-semibold leading-snug text-foreground",
  run: "text-base font-semibold leading-snug text-foreground",
  pub: "text-xl font-semibold leading-tight text-foreground",
}

/** The tier-chip sizing per scale (the chip itself is one component, glyph + WORD). */
const TIER_CLASS: Record<SoulScale, string> = {
  card: "px-2 py-0.5 text-[9.5px]",
  run: "px-2.5 py-0.5 text-[11px]",
  pub: "px-3 py-1 text-[13px]",
}

export function WorkflowSoul({ def, scale }: WorkflowSoulProps) {
  const tier = tierForDefinition(def)
  const needs = entryInputKeys(def)
  const deliverable = soulDeliverable(def)
  const purpose = def?.business_requirement?.trim()

  return (
    <div data-testid="workflow-soul" data-scale={scale} className="flex flex-col gap-2">
      {/* (1) PURPOSE — the hero. Always rendered; honest draft empty-state (D-03). */}
      <p data-testid="soul-purpose" className={PURPOSE_CLASS[scale]}>
        {purpose ? (
          purpose
        ) : (
          <span className="italic text-muted-foreground">draft · purpose not declared yet</span>
        )}
      </p>

      {/* (2) NEEDS — the entry input keys. */}
      <p data-testid="soul-needs" className="text-[11px] text-muted-foreground">
        <span className="font-medium">needs</span>{" "}
        {needs.length > 0 ? (
          needs.map((k, i) => (
            // WR-02: input_keys can carry duplicates (authored JSONB, not de-duped),
            // so the key string alone collides — suffix the index for a stable key.
            <span key={`${k}-${i}`}>
              {i > 0 && <span className="text-muted-foreground">, </span>}
              <span className="font-mono text-foreground/80">{k}</span>
            </span>
          ))
        ) : (
          <span className="font-mono text-foreground/80">kickoff_prompt</span>
        )}
      </p>

      {/* (3) SPINE — the glyph-dot phase spine (ribbons + indices stripped). */}
      <PhaseSpine def={def} scale={scale} />

      {/* (4) TIER — ONE chip, glyph + WORD, never colour-alone (WCAG 1.4.1). The
          data-tier carries the consistency-invariant test hook (D-04, SC#1+SC#2). */}
      <div>
        <span
          data-testid="soul-tier"
          data-tier={tier.id}
          title={tier.description}
          className={[
            "inline-flex items-center gap-1 rounded-full border border-border font-mono font-semibold uppercase tracking-wide text-foreground",
            TIER_CLASS[scale],
          ].join(" ")}
        >
          <span aria-hidden="true">{tier.glyph}</span>
          {tier.label}
        </span>
      </div>

      {/* (5) OUTPUT — the honest deliverable line. Always rendered (D-03). */}
      <p data-testid="soul-output" className="text-[11px] text-muted-foreground">
        {deliverable.kind === "file" ? (
          <>
            <span className="font-medium">produces:</span>{" "}
            <span className="text-foreground/80">{deliverable.label}</span>
          </>
        ) : (
          <span>produces: answer in chat</span>
        )}
      </p>
    </div>
  )
}

export default WorkflowSoul

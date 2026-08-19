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
// Phase 199-03 (DES-01): a TYPE-ONLY import, erased at compile time. It exists so the tone
// map below is TOTAL over the tier union — a fourth tier becomes a typecheck error here
// rather than an arm that silently renders untoned. It moves NO derivation: the runtime
// tier still comes from `soulData.tierForDefinition`, which is the one shared home, and
// nothing about that indirection changed.
import type { TierId } from "@/components/workflows/deriveTier"
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

/**
 * Phase 199-03 (DES-01, sheet 178 `c7-gauntlet-soul` §2) — the chip's WEIGHT per arm.
 *
 * The shipped chip rendered all three tiers in one identical treatment, so the only thing
 * separating a locked-down workflow from a scratch draft was the word — three chips
 * shouting equally, which is the opposite of "calm". The sheet's one genuinely applicable
 * idea for this atom is that the arms should not weigh the same: it draws STRICT filled
 * and bordered, LOOSE transparent and muted. That is HONEST here rather than merely
 * pretty, because the tiers really do mean different amounts of enforcement.
 *
 * ⚠ WHAT THIS IS NOT. It is not colour-alone (WCAG 1.4.1): the glyph and the WORD render
 * on every arm at every scale, unchanged, and the weighting only adds a third signal. It
 * does not re-label anything, it does not store anything, and it adds no arm — the sheet's
 * third arm is REFUSED (see the plan's reconciliation). The sheet captions that arm with a
 * we-could-not-tell word and draws it dashed; our third band is `MIDDLE`, a REAL derived
 * band, so claiming uncertainty over a value the code CAN tell would be a false claim
 * about our own certainty. Nor does a quiet LOOSE chip mean an ungoverned workflow —
 * `judgeAlwaysOn` is `true` for every tier, and that is stated in the chip's own `title`
 * on all three.
 *
 * ⚠ THE SHEET'S WORD IS NOT SPELLED ANYWHERE IN THIS CHAIN, INCLUDING IN THIS COMMENT, AND
 * THAT IS DELIBERATE. `WorkflowSoul.test.tsx` sweeps this module, `soulData.ts` and
 * `deriveTier.ts` for it, and the sweep is blunt on purpose: it does not care whether a
 * literal is copy or a comment, because the way a banned word actually reaches a user is
 * somebody lifting it out of nearby prose. Rewording here was the cheap side of that trade
 * (the `verdictModel.ts` `not-run` precedent); exempting a shipped fence would not be.
 *
 * Tokens only, all of them already resolving in `tailwind.config.js` and already used by
 * this very component: a class that compiles to nothing renders identically to a
 * deliberately unpainted arm, which is why nothing new is invented here.
 */
const TIER_TONE: Record<TierId, string> = {
  STRICT: "border-border bg-muted text-foreground",
  MIDDLE: "border-border text-foreground",
  LOOSE: "border-border/60 text-muted-foreground",
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
            "inline-flex items-center gap-1 rounded-full border font-mono font-semibold uppercase tracking-wide",
            TIER_TONE[tier.id],
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

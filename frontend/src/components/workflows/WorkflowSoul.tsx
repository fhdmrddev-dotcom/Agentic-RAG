/**
 * Phase 124-01 Task 2 (WUX-01, sketch 046-A / D-03 / D-04) — WorkflowSoul.
 *
 * The scale-keyed 5-atom workflow "soul" — ONE renderer that draws the
 * identity-carrying atoms every soul size (card / run / pub) shows, in the LOCKED
 * 046-A order with PURPOSE as the hero at every size:
 *   (1) purpose   — business_requirement (the hero headline)
 *   (2) needs     — entryInputFields, joined (authored label where one exists, key otherwise)
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
  entryInputFields,
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
  // ⚠ 17px, not `text-xl` (20px) — sketch 200's `publish.html` sets this hero's size as an
  // explicit `font-size: 17px` on the modal title. At 20px inside a 640px modal body the
  // operator's real business requirements (the sheet's own specimen runs to 33 words) took
  // four lines and pushed the strip below the fold.
  pub: "text-[17px] font-semibold leading-snug text-foreground",
}

/** The tier-chip sizing per scale (the chip itself is one component, glyph + WORD). */
const TIER_CLASS: Record<SoulScale, string> = {
  card: "px-2 py-0.5 text-[9.5px]",
  run: "px-2.5 py-0.5 text-[11px]",
  pub: "px-3 py-1 text-[13px]",
}

export function WorkflowSoul({ def, scale }: WorkflowSoulProps) {
  const tier = tierForDefinition(def)
  // 200-WIRE: the AUTHORED label when the definition carries one, the raw key when it does
  // not. `entryInputFields` is `entryInputKeys`'s own resolver with the label kept, so the
  // key list and its order are unchanged — a definition with no `inputs[]` (every draft, and
  // the `card`-scale DOM `WorkflowDoorSwitch.baseline.test.tsx` pins byte-for-byte) renders
  // exactly what it rendered before, in the same mono treatment.
  const needs = entryInputFields(def)
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
          needs.map((f, i) => (
            // WR-02: input_keys can carry duplicates (authored JSONB, not de-duped),
            // so the key string alone collides — suffix the index for a stable key.
            <span key={`${f.key}-${i}`}>
              {i > 0 && <span className="text-muted-foreground">, </span>}
              {/* ⚠ TWO ARMS, AND THE TREATMENT IS PART OF THE CLAIM. An AUTHORED label is
                  prose a human wrote, so it is set in the body face; a raw key is an
                  identifier, so it keeps the mono face it has always had. Collapsing the
                  two into one treatment would make a key look like a sentence somebody
                  chose. There is no third arm: absence renders the key, never a
                  fabricated friendly name. */}
              {f.label ? (
                <span className="text-foreground/80">{f.label}</span>
              ) : (
                <span className="font-mono text-foreground/80">{f.key}</span>
              )}
            </span>
          ))
        ) : (
          <span className="font-mono text-foreground/80">kickoff_prompt</span>
        )}
      </p>

      {/* ── ATOMS 3–5, GROUPED AT `pub` ONLY (sketch 200 `publish.html`, 2026-08-20) ──────
          The sheet draws the publish modal's soul as THREE things, not five stacked lines:
          a 17px hero, a quiet line under it, and then ONE compact bordered bar carrying the
          step glyphs on the left with the tier chip and the deliverable pushed to the right.
          Three of our five atoms live in that bar. `Row` below is that bar at `pub` and a
          plain fragment everywhere else, so `card` and `run` render byte-for-byte what they
          rendered before — which matters because `WorkflowDoorSwitch.baseline.test.tsx`
          pins the `card` scale's whole DOM and this component is CONSUMED by four surfaces.

          ⚠ THE FIVE ATOMS AND THEIR ORDER ARE UNTOUCHED — the 046-A lock, and the thing
          `WorkflowSoul.test.tsx` reads off the rendered DOM as a `[data-testid^='soul-']`
          sequence. Wrapping three siblings in one element does not reorder a
          `querySelectorAll`, and the cross-scale equality case (which compares textContent
          between `run` and `pub`) is likewise untouched: this is layout, not data. */}
      {scale === "pub" ? (
        <div className="-mx-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded border-y border-border bg-background/60 px-3 py-2">
          <PhaseSpine def={def} scale={scale} />
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <TierChip tier={tier} scale={scale} />
            <OutputLine deliverable={deliverable} />
          </div>
        </div>
      ) : (
        <>
          {/* (3) SPINE — the glyph-dot phase spine (ribbons + indices stripped). */}
          <PhaseSpine def={def} scale={scale} />
          {/* (4) TIER */}
          <div>
            <TierChip tier={tier} scale={scale} />
          </div>
          {/* (5) OUTPUT */}
          <OutputLine deliverable={deliverable} />
        </>
      )}
    </div>
  )
}

/** (4) TIER — ONE chip, glyph + WORD, never colour-alone (WCAG 1.4.1). The `data-tier`
 *  carries the consistency-invariant test hook (D-04, SC#1+SC#2). Lifted out of the body
 *  UNCHANGED so both layouts spend the same one, rather than growing a second spelling. */
function TierChip({
  tier,
  scale,
}: {
  tier: ReturnType<typeof tierForDefinition>
  scale: SoulScale
}) {
  return (
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
  )
}

/** (5) OUTPUT — the honest deliverable line. Always rendered (D-03). Same lift, same
 *  reason: one spelling, two layouts. */
function OutputLine({ deliverable }: { deliverable: ReturnType<typeof soulDeliverable> }) {
  return (
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
  )
}

export default WorkflowSoul

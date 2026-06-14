/**
 * Phase 103 (REQ-7 h, sketch 021-A D10) — deriveTier()/TIERS.
 *
 * THE SINGLE SOURCE OF TRUTH for the workflow strictness-tier badge. The tier is
 * DERIVED on every render from the REAL enums — `citation_policy` (the strictness
 * dial) plus the SET of `ValidatorSpec.kind` gates a definition actually carries.
 * There is NO stored / JSONB / free-text strictness label, and NO invented
 * numeric-level or compliance-mode vocabulary (Strictness = real enums only).
 *
 * Because the derivation is pure and client-side, toggling `citation_policy`
 * strict->draft in the Builder changes the badge with NO server round-trip
 * (REQ-7 acceptance h). This module imports NOTHING from the API client — a tier
 * is computed, never fetched.
 *
 * Judge-always-on: the LLM judge (`llm_judge_rubric`) is the publish gauntlet's
 * hard wall and runs on EVERY tier, including LOOSE. `TIERS.*.judgeAlwaysOn` is
 * `true` for all three tiers to reflect that the judge gate is never dropped.
 *
 * Mirror of the backend enums:
 *  - citation_policy: harness.py `LlmEmitPhaseConfig.citation_policy`.
 *  - validator kinds: harness.py `ValidatorSpec.kind`.
 */

/** The real `citation_policy` enum (backend `LlmEmitPhaseConfig.citation_policy`). */
export type CitationPolicy = "strict" | "flag" | "partial" | "draft"

/** The real `ValidatorSpec.kind` enum (backend harness validator kinds). */
export type ValidatorKind =
  | "citations_required"
  | "output_file_valid"
  | "freshness"
  | "structure_check"
  | "llm_judge_rubric"

export type TierId = "STRICT" | "MIDDLE" | "LOOSE"

export interface Tier {
  id: TierId
  /** The locked sketch glyph (021-A D10): STRICT 🔒 / MIDDLE ◐ / LOOSE ○. */
  glyph: string
  /** Human label for the badge (presentation; the real authority is `id`). */
  label: string
  /** A one-line, real-vocab description of what the tier means. */
  description: string
  /**
   * The judge (`llm_judge_rubric`) is always-on — true for EVERY tier, even
   * LOOSE. The publish gauntlet's judge is a hard wall that never drops.
   */
  judgeAlwaysOn: true
}

/**
 * TIERS — the single source of truth for the badge. `deriveTier()` always
 * returns one of these exact references, so the badge can never drift from the
 * derivation (a stored label could; a derived reference cannot).
 */
export const TIERS = {
  STRICT: {
    id: "STRICT",
    glyph: "🔒",
    label: "Strict",
    description: "Citations required; the full gate set enforced.",
    judgeAlwaysOn: true,
  },
  MIDDLE: {
    id: "MIDDLE",
    glyph: "◐",
    label: "Middle",
    description: "Citations flagged or partial; core gates enforced.",
    judgeAlwaysOn: true,
  },
  LOOSE: {
    id: "LOOSE",
    glyph: "○",
    label: "Loose",
    description: "Draft citations; the judge still runs (always-on).",
    judgeAlwaysOn: true,
  },
} as const satisfies Record<TierId, Tier>

/** The structural gates whose presence raises the strictness floor within a band. */
const FLOOR_RAISING_GATES: readonly ValidatorKind[] = [
  "output_file_valid",
  "structure_check",
  "freshness",
]

/**
 * deriveTier — compute the strictness tier on EVERY call from the real enums.
 *
 * Mapping rule (fixed; thresholds discretionary):
 *  - `citation_policy === "strict"`  -> STRICT.
 *  - `citation_policy === "flag" | "partial"` -> MIDDLE, BUT promoted to STRICT
 *     if the definition ALSO carries the full floor-raising gate set
 *     (output_file_valid + structure_check + freshness) — a stricter gate
 *     signature refines upward within the band.
 *  - `citation_policy === "draft"` -> LOOSE, BUT promoted to MIDDLE if the
 *     definition carries ANY floor-raising structural gate.
 *
 * Pure: never reads a stored label, never fetches, never mutates `validatorKinds`.
 */
export function deriveTier(
  citationPolicy: CitationPolicy,
  validatorKinds: Set<ValidatorKind>,
): Tier {
  const hasAllFloorGates = FLOOR_RAISING_GATES.every((g) => validatorKinds.has(g))
  const hasAnyFloorGate = FLOOR_RAISING_GATES.some((g) => validatorKinds.has(g))

  switch (citationPolicy) {
    case "strict":
      return TIERS.STRICT
    case "flag":
    case "partial":
      // A stricter gate signature can refine a flag/partial policy up to STRICT.
      return hasAllFloorGates ? TIERS.STRICT : TIERS.MIDDLE
    case "draft":
      // Any structural gate lifts a draft policy off the floor to MIDDLE.
      return hasAnyFloorGate ? TIERS.MIDDLE : TIERS.LOOSE
    default: {
      // Exhaustiveness guard — a new citation_policy enum must be handled here.
      const _never: never = citationPolicy
      return _never
    }
  }
}

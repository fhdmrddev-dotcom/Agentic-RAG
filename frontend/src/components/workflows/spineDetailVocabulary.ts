/**
 * Phase 200 (the builder-spine port, FE-WIRING) — THE SELECTED ROW'S TWO DETAIL LINES.
 *
 * `.planning/sketches/200-journey-interactive/screens/builder-spine.html:330-338` draws a
 * dashed divider under the SELECTED spine row and, beneath it, exactly two labelled lines:
 *
 *   WHAT IT IS TOLD TO DO      Draft the summary sections based on meeting notes.
 *   HOW LITERAL IT SHOULD BE   Very literal
 *
 * Both values are already in the hand of the component that draws the spine — they are
 * `config.prompt` and `config.temperature` off the same `PhaseSpecJSON` it already sorts.
 * Neither is fetched, neither is derived from a run, and neither is a claim about anything
 * that has happened: they are what the AUTHOR wrote, read back to them. That is what makes
 * this block legitimate on an authoring surface where a duration or an outcome would not be
 * (`199-02`'s refusal, which still binds every run-tense atom on this component).
 *
 * ── WHY A LEAF ──────────────────────────────────────────────────────────────────────────
 *
 * `react-refresh/only-export-components` forbids a component file exporting shared
 * non-component values, and this tree answers that with a sibling leaf 27 times over with
 * zero `eslint-disable`s. The `Vocabulary` suffix rather than `Context` because what this
 * module owns is STRINGS — the `doorVocabulary.ts` / `libraryVocabulary.ts` /
 * `runVocabulary.ts` / `decisionsVocabulary.ts` one-string-home rule, applied to the spine's
 * detail block. A true leaf: it imports nothing, so it can never join a module cycle.
 *
 * ── ⚠ THE LABELS ARE UPPER-CASED HERE, NOT BY CSS ───────────────────────────────────────
 *
 * The `nodeEffectBanner.ts` precedent, and for its reason: a CSS `uppercase` transform
 * announces one spelling to a screen reader and paints another, which is two spellings of
 * one fact. The sheet writes them upper-cased in its own markup, so they are stored that way.
 */

/** The sheet's own label for the prompt line. ONE home. */
export const SPINE_DETAIL_PROMPT_LABEL = "WHAT IT IS TOLD TO DO"

/** The sheet's own label for the worded-temperature line. ONE home. */
export const SPINE_DETAIL_LITERAL_LABEL = "HOW LITERAL IT SHOULD BE"

/**
 * The four bands, most-literal first, as a readable ladder rather than a chain of ternaries.
 *
 * ⚠ THE WORDS ARE ANCHORED TO THE SHIPPED FIELD'S OWN HINT, not invented beside it.
 * `PhaseFormPanel.tsx:1129` already tells the author what this number means — *"temperature —
 * 0 is focused and repeatable, higher is more varied"* — so the scale reads from LITERAL at
 * the bottom to INTERPRETIVE at the top, which is the same direction that sentence describes.
 * A scale that ran the other way would contradict the control the author just used. The
 * sheet's own sample (`Very literal`) is the bottom band and is reproduced verbatim.
 *
 * ⚠ THE BOUNDARIES ARE A PRESENTATION CHOICE AND NOTHING READS THEM BACK. This module turns a
 * number the author typed into a word; it never writes, never round-trips and never feeds a
 * gate. The raw number stays the single source of truth and stays editable, in the panel, as
 * a number — so a reader who wants the figure has it one surface away, unrounded.
 */
const LITERAL_BANDS: ReadonlyArray<{ below: number; reading: string }> = [
  { below: 0.3, reading: "Very literal" },
  { below: 0.6, reading: "Mostly literal" },
  { below: 0.9, reading: "Some room to interpret" },
  { below: Number.POSITIVE_INFINITY, reading: "Free to interpret" },
]

/**
 * The worded reading for a stored temperature, or `null` for "say nothing".
 *
 * ⚠ **ABSENCE RENDERS NOTHING — NEVER A DEFAULT BAND.** A step that declares no temperature
 * is using the provider's, and this client does not know what that is. Printing `Very
 * literal` there would be a fabricated claim about how the step will behave, made in the
 * author's own vocabulary, on the surface they trust to tell them what they configured. The
 * project's standing floor (`runFacts.ts`'s four-arm correction, `nodeEffectBanner.ts`'s
 * declined second banner) is that an absent fact renders NOTHING, never a plausible default.
 *
 * ⚠ **`0` IS A REAL VALUE AND MUST RENDER.** A deliberate `0` is the most literal setting
 * there is and is a fact the author stated. That is why the test is `typeof === "number"` and
 * never `if (temperature)` and never `temperature ?? …` — a truthiness test folds a declared
 * `0` into the absence arm, which is the exact fold `runFacts.ts` records the cost of.
 *
 * TOTAL over the loose JSONB edge: a string, a boolean, an object and `NaN` all resolve to
 * `null` rather than throwing or landing in a band. `config` is author-supplied and
 * hand-editable, so totality is a property of this function and not of its current caller.
 */
export function literalReading(temperature: unknown): string | null {
  if (typeof temperature !== "number" || Number.isNaN(temperature)) return null
  for (const band of LITERAL_BANDS) {
    if (temperature < band.below) return band.reading
  }
  // Unreachable — the last band's ceiling is +∞ — but a total function returns rather than
  // falling off its end, and `Infinity` itself would otherwise arrive here.
  return null
}

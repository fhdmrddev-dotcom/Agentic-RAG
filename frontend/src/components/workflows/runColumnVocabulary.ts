/**
 * Phase 200.2 (RUN-05 / D-06 / D-07 / D-09 / D-13 / D-16) — THE RUN COLUMN'S WORDS.
 *
 * EVERY GOVERNED USER-FACING STRING THE RUN CENTRE COLUMN SPELLS OF ITS OWN, IN ONE HOME:
 * the process trace landmark, the wrote-an-answer yield string, honest-absence headlines,
 * and the hero deliverable card copy.
 *
 * ── THE RULES THIS FILE KEEPS ─────────────────────────────────────────────────────────
 *
 *  1. EXACT-MATCH ASSERTIONS ONLY.
 *  2. ZERO GLYPH STRINGS. Status marks and icons are visual concerns, not vocabulary.
 *  3. EVERY CONSUMER IMPORTS FROM HERE. One literal left in JSX is a second home.
 *  4. NO STRING HERE MAY EQUAL ONE EXPORTED BY THE SIBLING VOCABULARY MODULES.
 *
 * A true leaf: no React, no JSX, and ZERO imports.
 */

// ── Process Trace Landmark & Strings (RunStepList) ─────────────────────────

/** Accessible landmark name for the process trace region. */
export const PROCESS_TRACE_LANDMARK = "Process trace"

/** The yield string when a step generated answer text. */
export const YIELD_WROTE_AN_ANSWER = "wrote an answer"

/** Honest absence: when a run has zero step rows recorded. */
export const EMPTY_TRACE_NO_STEPS = "No steps recorded for this run."

/** Honest absence: when steps have no recorded timing measurements. */
export const EMPTY_TRACE_NO_TIMES = "No timing details recorded for this run."

/** Accessible label for expanding retrieved citations. */
export const CITATIONS_EXPAND_LABEL = "Show retrieved citations"

/** Accessible label for collapsing retrieved citations. */
export const CITATIONS_COLLAPSE_LABEL = "Hide retrieved citations"

// ── Hero Region Landmark & Headings (RunHero) ──────────────────────────────

/** Accessible landmark name for the deliverable hero region. */
export const HERO_LANDMARK = "Run deliverable"

/** Hero card heading when the deliverable is a single file. */
export const HERO_HEADING_FILE = "Generated file"

/** Hero card heading when multiple files were generated. */
export const HERO_HEADING_FILES = "Generated files"

/** Hero card heading when the deliverable is an answer text. */
export const HERO_HEADING_ANSWER = "Generated answer"

/** Hero card heading when both files and an answer were produced. */
export const HERO_HEADING_BOTH = "Deliverables"

/** Honest absence headline when a run completed without producing a deliverable. */
export const HERO_EMPTY_COMPLETED = "This run completed without producing a file or answer."

/** Honest absence headline when a run was cancelled. */
export const HERO_EMPTY_CANCELLED = "Run was cancelled before producing a deliverable."

/** Honest absence headline when a run failed at a known step. */
export function heroEmptyFailedStep(stepTitle: string): string {
  return `Stopped at step "${stepTitle}". No deliverable was produced.`
}

/** Honest absence headline when a run failed without an identifiable step. */
export const HERO_EMPTY_FAILED_GENERIC = "Run failed before producing a deliverable."

/** Fallback honest absence headline for unknown terminal run status. */
export const HERO_EMPTY_UNKNOWN = "No deliverable recorded for this run."

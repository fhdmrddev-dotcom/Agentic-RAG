/**
 * Phase 188 Plan 06 (RUNVIZ-01 — SPEC Req 5, D-188-02 / D-188-04 / D-188-06 / D-188-07)
 * — the CANVAS's run vocabulary.
 *
 * THE RULE THIS FILE EXISTS TO KEEP: one derivation, two vocabularies. `lib/phaseState`
 * owns the DERIVATION (which reading a step is in) and holds no user-facing words at
 * all. This module owns the canvas's WORDS for those readings, and holds no derivation
 * at all — no status mapping, no collapse rule, no database literals. The developer
 * panel keeps its own harness words for the very same readings, and that is correct:
 * the SPEC puts re-wording the shipped panel out of scope, and Req 8's acceptance is a
 * grep proving zero re-derivations — NOT that the two views print identical strings.
 *
 * Siting the words HERE rather than inside `phaseState.ts` is what keeps that fence
 * able to tell vocabulary from derivation (D-188-02). Merging the two would make the
 * grep have to distinguish them by hand.
 *
 * ZERO NET-NEW GLYPHS (D-188-06). This module exports no glyph strings of any kind.
 * The canvas's run channel is GEOMETRY plus a WORD — an arc shape the eye reads and a
 * sentence a person reads — which is exactly why sketch 153-A won: it spends no badge
 * slot, no step number, no technical line and no mark. Two consequences are recorded
 * here so a later author does not "improve" them back:
 *
 *   • The branch arrow the on-fail `skip_to_phase` edge already draws (`PhaseNode.tsx`,
 *     the broken-target stub) may NOT be reused for the *Skipped* reading. On this
 *     canvas that mark already means "the run would jump to another step", so reusing
 *     it for "the run went past this one" would give one glyph two meanings. It is
 *     deliberately NOT spelled anywhere in this file, so the phase's zero-glyph grep
 *     returns 0 honestly rather than by exemption (the 187-24 lesson: a comment that
 *     quotes the token a fence forbids makes the fence vacuous).
 *   • The waiting reading's mark is TWO RECTANGLES drawn by the card, never the
 *     double-bar character. Sketch 154 proposed that character for the run band and
 *     the UI contract refused it, one step further than the sketch went.
 *
 * Pure data + pure functions. No React, no hooks, no JSX, and exactly TWO imports,
 * both type-only — so this module contributes nothing to the runtime graph and an ESM
 * cycle is impossible by construction.
 */
import type { CanvasReading } from "@/lib/phaseState"
import type { EmitFailure } from "@/types"

// ── The words ───────────────────────────────────────────────────────────────────

/**
 * The eight LOCKED canvas words (D-188-04, and D-16 for the eighth). They may not be
 * reworded here: CONTEXT locks them and the UI contract's copywriting table repeats
 * them, so a change is a decision taken in those documents and reflected here, never
 * the other way round.
 *
 * THE EIGHTH (Phase 189 / CONN-01 / D-16) is the terminal a governed external-action
 * step reaches: a person approved it, the run continued, and nothing left the building.
 * Its wording is OUTCOME FIRST, consolation second — the sentence opens on the negation
 * so it cannot be skimmed as success, and "recorded" then says where the detail went.
 * D-07 is what makes that a requirement rather than a preference: this reading must read
 * as neither success, nor failure, nor a step that was passed over, and the suite asserts
 * all three as inequalities against the shipped words rather than trusting the reading.
 *
 * ⚠ EXACT-MATCH ASSERTIONS ONLY when testing this table. The eighth word shares the
 * prefix "Not " with the first, so a `toContain` on that fragment is ambiguous and would
 * pass while proving nothing — the same class of vacuous fence the notes below describe.
 *
 * ⚠ D-17: the DATABASE spells this state as a snake-case slug, and that slug is not
 * written in this file at any point. This module holds a rendered SENTENCE; the slug
 * belongs to the derivation layer and to the migration's CHECK constraint, one language
 * and 400 lines away. A constraint that took this sentence would be a misread of D-17.
 *
 * The `waiting-for-you` entry below is deliberately NOT the shipped design-time badge
 * that `llm_human_input` steps already carry, and not a tense variant of it (D-188-05,
 * SPEC Req 5). The two say different things and must survive being read side by side
 * on one card: the badge is a property of the STEP (it *will* pause, and that is true
 * before anything runs and after everything has), while this is a state of the RUN (it
 * *is* paused, now, and nothing moves until the person answers). They differ in verb,
 * in object and in aspect.
 *
 * (The badge's own two words are not quoted here. The acceptance grep for this file
 * asserts they do NOT appear in it — a docblock that spelled them would make that
 * check vacuous, which is the 187-24 lesson this phase has now met three times. The
 * inequality is asserted mechanically in the suite instead, against both real strings.)
 */
export const RUN_READING_WORD: Record<CanvasReading, string> = {
  "not-started": "Not started",
  running: "Running",
  done: "Complete",
  failed: "Failed",
  skipped: "Skipped",
  "waiting-for-you": "Paused for your answer",
  unknown: "State unknown",
  "recorded-not-sent": "Not sent — recorded",
  // THE NINTH (Phase 194 Plan 04 / RUN-01 / D-04 / D-13) is the terminal a step reaches when
  // a person stops the run underneath it. Outcome first, agent second: the sentence opens on
  // what happened and then says who did it, so it can never be skimmed as a fault the system
  // raised. D-04 is what makes that a requirement rather than a preference — this reading
  // must read as neither success, nor failure, nor a step that was passed over, and the suite
  // asserts all three as inequalities against the shipped words rather than trusting it.
  //
  // ⚠ IT IS NOT THE PANEL'S WORD, AND THAT IS THE RULE RATHER THAN AN OVERSIGHT. The panel
  // spine says one thing about this step in its harness vocabulary and the canvas says
  // another in business words; only the DERIVATION is shared (`lib/phaseState.ts`'s RULE,
  // D-188-02). Req 8's acceptance is a grep proving zero local re-derivations — NOT that the
  // two views print identical strings. The panel's word is deliberately not repeated in this
  // file, and the suite asserts mechanically that the two strings DIFFER.
  //
  // ⚠ AND IT MUST NOT CLAIM WORK WAS THROWN AWAY. The validated sketch
  // (`sketch-findings-agentic-rag/references/workflow-run-surface.md:25`) words the run band
  // "… · partial work discarded", and that clause is exactly what D-13 forbids: a stopped run
  // KEEPS its completed phases, their outputs are already durable, and collapsing to a claim
  // that hides partial work discards evidence the database still holds. The sketch's copy is
  // amended in plan 194-05 with the amendment recorded BESIDE the operator-approved original
  // (this project's standing habit); this word is written so it cannot be read as that claim.
  // It says what happened to THIS step and asserts nothing about any other.
  cancelled: "Stopped by you",
}

/**
 * Read one entry out of a reading-keyed table SAFELY.
 *
 * ⚠ NOT CEREMONY — this is the 188-05 measurement applied a second time. Every table
 * in this file is a plain object literal, so it INHERITS `constructor`, `toString`,
 * `__proto__` and friends. `TABLE[key] ?? fallback` therefore does NOT fire its
 * fallback for those names: the inherited member is never nullish, so the expression
 * hands back a *function* typed as the table's value type. `phaseStatusFromDb` shipped
 * with exactly that expression and the observed return for `"constructor"` was
 * `[Function Object]` (see `lib/phaseState.ts`). The reading reaching this module is
 * typed, but it is DERIVED from a server-supplied status one function away, and
 * totality is a property of the lookup rather than of its current callers.
 */
function own<T>(table: Record<string, T>, reading: CanvasReading): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, reading)
    ? (table as Record<string, T>)[reading]
    : undefined
}

/**
 * The canvas word for a reading. TOTAL: anything this table does not own reads as the
 * unknown word, which is the honest catch-all and is never a claim of success.
 */
export function runReadingWord(reading: CanvasReading): string {
  return own(RUN_READING_WORD, reading) ?? RUN_READING_WORD.unknown
}

// ── The clause layer ────────────────────────────────────────────────────────────

/** Skipped: the run did not fail here — it went another way. */
const CLAUSE_SKIPPED = "— the run took a different path"
/** Waiting: says what the person has to DO, not merely that something stopped. */
const CLAUSE_WAITING = "— it needs your reply before it can continue"
/** Unknown: admits the gap. Never phrased as a warning the run has not raised. */
const CLAUSE_UNKNOWN = "— we can't tell what happened to this step"
/**
 * Stopped (194-04 / D-13): states what a person cannot get from the word alone — whether
 * this step FINISHED. It did not; it was interrupted mid-work.
 *
 * ⚠ EVERY WORD OF IT IS SCOPED TO THIS STEP. It says nothing about the run's other phases,
 * because a stopped run KEEPS its completed ones and a clause that implied otherwise would be
 * the "partial work discarded" claim D-13 forbids, one layer down. It also does not say the
 * work here was thrown away — nobody measured that, the row's outputs are whatever the
 * database holds, and a vocabulary table is not the place to guess.
 */
const CLAUSE_STOPPED = "— you ended the run while this step was still working"

/**
 * The failure clause is a CLOSED SET OF THREE, keyed off the typed `EmitFailure` enum
 * and nothing else.
 *
 * ⚠ `Phase.error` is NEVER a source here, and never reaches the canvas at all. It is
 * free-form harness text that can carry slugs, model ids and gate identifiers — exactly
 * what SPEC Req 2 forbids on this surface. The detailed reason stays in the developer
 * timeline, one click away through "Open the chat thread". That is what lets the canvas
 * state a REASON at all without extracting the panel's failure classifier.
 */
const CLAUSE_FAILED_NO_DOCUMENT = "— it could not produce the document"
const CLAUSE_FAILED_CHECKS = "— its answer did not pass the required checks"
const CLAUSE_FAILED_UNFINISHED = "— this step did not finish"

/**
 * Written as an EXHAUSTIVE switch over `EmitFailure` rather than as two arrays, so that
 * adding a member to the enum is a visible decision: the new member falls to the
 * `default` arm and reads as the weakest of the three claims until someone chooses
 * which bucket it belongs in. A lookup table would silently produce the same string
 * with no place for the decision to be noticed.
 */
function failureClause(emitFailure: EmitFailure | null | undefined): string {
  if (emitFailure == null) return CLAUSE_FAILED_UNFINISHED
  switch (emitFailure) {
    case "model_failed_to_emit":
    case "render_failed":
    case "no_template_bound":
      return CLAUSE_FAILED_NO_DOCUMENT
    case "citation_gate_rejected":
    case "integrity_failed":
      return CLAUSE_FAILED_CHECKS
    default:
      return CLAUSE_FAILED_UNFINISHED
  }
}

/**
 * The clause rendered after the word, or `null` when the word says everything.
 *
 * The three readings that carry a clause are the three a person cannot act on from the
 * word alone — *Skipped*, the waiting reading and *State unknown* — plus *Failed*,
 * which carries one of three fixed reasons. `Running`, `Complete` and `Not started` say
 * their whole truth in one word, and padding them would dilute the ones that do not.
 */
export function runReadingClause(
  reading: CanvasReading,
  emitFailure?: EmitFailure | null,
): string | null {
  if (reading === "failed") return failureClause(emitFailure)
  return own(STATIC_CLAUSE, reading) ?? null
}

/**
 * The clause for every reading whose clause is FIXED. Declared as an exhaustive
 * `Record<CanvasReading, …>` rather than as a switch with a `default:` arm, and that is
 * deliberate: an eighth reading added to `CanvasReading` later becomes a TYPECHECK
 * ERROR here, where a `default:` would have silently absorbed it as "no clause". The
 * compiler is the reminder, not a comment.
 *
 * `failed` is the one reading whose clause is a function of another field, so it is
 * `null` here and resolved by the branch above; leaving it out of the table entirely
 * would have cost the exhaustiveness that is the table's whole reason for existing.
 */
const STATIC_CLAUSE: Record<CanvasReading, string | null> = {
  "not-started": null,
  running: null,
  done: null,
  failed: null,
  skipped: CLAUSE_SKIPPED,
  "waiting-for-you": CLAUSE_WAITING,
  unknown: CLAUSE_UNKNOWN,
  // 189 / D-16 — `null`, and the reason is this table's OWN rule rather than an omission.
  // A clause is carried by the readings a person cannot act on from the word alone. There
  // is nothing here for the person to do: the approval already happened and the run
  // carried on. And the word itself ALREADY carries its clause after an em-dash, so
  // appending a second one would produce a two-em-dash sentence restating exactly what the
  // design-time badge and the step's own output body both say.
  //
  // ⚠ This is the eighth reading the docblock above was written for — added later, and a
  // TYPECHECK ERROR here until it was, precisely as intended. A `default:` arm would have
  // absorbed it silently as "no clause" and this decision would never have been taken.
  "recorded-not-sent": null,
  // 194-04 / D-13 — a clause, and it is a DECISION taken against this table's own rule rather
  // than a default. The rule is that a clause is carried by the readings a person cannot act
  // on from the word alone; here the word says what happened and WHO did it, and leaves open
  // the one thing that actually matters for honesty — did this step finish? It did not. That
  // is precisely D-13's requirement, and the word alone cannot carry it.
  //
  // ⚠ This is the ninth reading the docblock above was written for — added later, and a
  // TYPECHECK ERROR here until it was, precisely as intended. A fall-through arm would have
  // absorbed it silently as "no clause" and this decision would never have been taken.
  cancelled: CLAUSE_STOPPED,
}

/**
 * The whole sentence: word, then clause when there is one.
 *
 * ONE function, used for BOTH the visible run line and the node's accessible-name
 * suffix, precisely so the two can never disagree. A screen-reader user and a sighted
 * user are told the same thing about the same step, by construction rather than by
 * two call sites being kept in step.
 */
export function runReadingLabel(reading: CanvasReading, emitFailure?: EmitFailure | null): string {
  const clause = runReadingClause(reading, emitFailure)
  const word = runReadingWord(reading)
  return clause === null ? word : `${word} ${clause}`
}

// ── The shell↔page contract ─────────────────────────────────────────────────────

/**
 * ONE node's run state, as it crosses `WorkflowCanvas` on its way to the card.
 *
 * `label` is `runReadingLabel(reading, emitFailure)`, ALREADY COMPUTED BY THE PAGE, and
 * it is carried as a FIELD rather than recomputed downstream for one structural reason.
 * The canvas has to join the sentence to the node's accessible name — the shipped
 * `aria-label` is an explicit property on the node object, so the card's inner text is
 * NOT part of it, and without that join a screen-reader user tabbing the spine would
 * hear no run state whatsoever. Carrying the words lets the canvas do that join while
 * importing nothing from this module but a type: it stays a pass-through that derives
 * nothing, words nothing and looks nothing up. `WorkflowCanvas.tsx` is a G-5 hot file
 * whose diff for this phase is capped as a plan acceptance criterion, and that cap is
 * only honest if the vocabulary genuinely never enters the file.
 *
 * Because `label` is precomputed once, the visible run line and the accessible-name
 * suffix are the SAME string from the SAME call. They cannot drift apart the way two
 * call sites kept in step by hand eventually do.
 */
export interface NodeRunState {
  /** Which of the seven readings the step is in — derived ONCE, by `phaseState.canvasReading`. */
  reading: CanvasReading
  /** `runReadingLabel(reading, emitFailure)`. The whole sentence, worded by the page. */
  label: string
  /** The step's terminal emit failure, when its run row carries one. Selects which of the
   *  three fixed clauses follows the failure word; ignored at every other reading. */
  emitFailure?: EmitFailure | null
}

// ── The card border ─────────────────────────────────────────────────────────────

/**
 * The three readings — and ONLY three — that claim the card's border.
 *
 * `done`, `not-started`, `skipped`, `unknown` — and, since 189, the recorded-not-sent
 * reading — are ABSENT ON PURPOSE, and *Complete* is the one worth stating: the closed
 * ring already says it, and recolouring the border
 * of every finished step floods the canvas with the accent exactly as the run ends,
 * burning the whole 10% accent budget on the least urgent news on the screen. The
 * quiet states stay quiet so the two loud ones (something needs you / something broke)
 * are the only things that pull the eye.
 *
 * THE SIXTH ABSENCE IS 194's, and it is a STATED DECISION rather than an omission — an
 * unrecorded absence from a `Partial<>` table is invisible to the compiler and therefore
 * indistinguishable from a bug, which is why 189 wrote its own down and why this one is here.
 * The stopped reading claims NO border, for two reasons that point the same way. It is a
 * QUIET terminal: nothing broke and nothing is owed, so it belongs with *Complete* and the
 * recorded-not-sent reading rather than with the two loud ones. And it is the ONE state on
 * this surface the person already knows about before the canvas tells them — they pressed
 * Stop. Spending the accent to announce a fact the user just caused would dim the only two
 * readings that genuinely need to pull the eye. Its ring shape already carries it.
 *
 * The FIFTH absence is 189's, and it is recorded here rather than left to be discovered:
 * an unrecorded omission from a `Partial<>` table is indistinguishable from a bug, and
 * this one is editorial. The recorded-not-sent reading is a QUIET terminal — the run
 * moved on, nothing is owed and nothing broke — so it claims no border for the same
 * reason *Complete* does not. Its ring shape already carries it, and spending the accent
 * here would dim the only two readings that genuinely need to pull the eye.
 *
 * One border-colour utility per reading, matching the shipped ternary's own rule, so
 * nothing depends on the order Tailwind happens to emit two same-specificity classes.
 */
export const RUN_READING_BORDER: Partial<Record<CanvasReading, string>> = {
  running: "border-primary",
  "waiting-for-you": "border-[hsl(var(--warning))]",
  failed: "border-destructive",
}

/** TOTAL border lookup — `undefined` means "this reading does not claim the border",
 *  which is the majority case and must never resolve to an inherited member. */
export function runReadingBorder(reading: CanvasReading): string | undefined {
  return own(RUN_READING_BORDER as Record<string, string>, reading)
}

// ── The ring ────────────────────────────────────────────────────────────────────

/**
 * An arc described as FRACTIONS of the circumference plus the path position its first
 * gap must be centred on. Fractions rather than pixels because the ring's radius is a
 * layout constant that a later phase may move; every rendered number is then recomputed
 * instead of silently disagreeing with the new circle.
 */
export interface RingArcFractions {
  /** Dash (drawn) length, as a fraction of the circumference. */
  dash: number
  /** Gap (undrawn) length, as a fraction of the circumference. */
  gap: number
  /** How many dash+gap pairs the pattern names. 1 ⇒ one arc, 2 ⇒ the ring snapped in two. */
  repeats: number
  /**
   * Where the FIRST gap's centre must land, as a fraction of the circumference.
   * An SVG `<circle>` starts at 3 o'clock and runs clockwise, so
   * `3 o'clock = 0 · 6 = .25 · 9 = .5 · 12 = .75`.
   *
   * `null` ⇒ placement is irrelevant (the arc spins, so there is no resting position
   * to place). It resolves to an offset of 0 rather than to an arbitrary one.
   */
  gapCentre: number | null
}

/**
 * The four shapes a reading's ring can take. A discriminated union rather than a bag of
 * optional fields, so "no arc at all" and "an unbroken circle" are DIFFERENT things the
 * compiler keeps apart — they are two of the seven readings and confusing them would
 * collapse *Not started* into *Complete*, which is the single worst confusion this
 * surface could make.
 */
export type RingSpec =
  /** No arc element at all — the track exists and nothing has travelled it. */
  | { readonly kind: "none" }
  /** An unbroken circle — no dash pattern is emitted. */
  | { readonly kind: "solid" }
  /** A dash pattern computed from the circumference. */
  | { readonly kind: "fraction"; readonly arc: RingArcFractions; readonly spinning: boolean }
  /** A dash pattern in absolute user units — a texture, not a measured arc. */
  | { readonly kind: "length"; readonly dash: number; readonly gap: number }

/**
 * Seven readings, seven ring SHAPES (sketch 153-A). **The arc geometry IS the state;
 * colour only ever reinforces it.** That is a BUILD CRITERION, not a preference: with
 * colour switched off every reading must still be identifiable, and each row below is
 * unique in a property a test can assert —
 *
 *   • `not-started` — the only reading with NO arc
 *   • `running`     — the only one that moves, and statically the only SHORT single arc
 *   • `done`        — the only closed, unbroken ring
 *   • `waiting-for-you` — the only ring with ONE wide gap, at 12 o'clock (and the card
 *                     draws its two-bar chip inside that gap)
 *   • `failed`      — the only ring snapped into TWO arcs
 *   • `skipped`     — evenly dashed all the way round, coarse
 *   • `unknown`     — the only DOTTED ring, fine and sparse; deliberately not closed
 *   • `recorded-not-sent` — the only ring drawn in FOUR arcs (189 / D-16). Added with
 *                     the eighth reading so this list stays a complete enumeration
 *                     rather than becoming seven-of-eight: the criterion above is only
 *                     a criterion while every row it covers is named in it.
 *   • `cancelled`   — the only ring CUT EXACTLY IN HALF: dash equals gap, one pair, so
 *                     half the circle is drawn and half is simply not there (194 / D-13).
 *                     Added with the ninth reading, for the same enumeration reason.
 *
 * THE NINTH SHAPE, AND WHY EACH CLAUSE OF IT IS LOAD-BEARING:
 *
 *   • `dash === gap` is its assertable unique property, and it is a property of the ROW
 *     rather than of a number a test re-types: no other spec has its dash fraction equal to
 *     its gap fraction (`.26/.74`, `.42/.08`, `.74/.26`, `.15/.10`), and the two `length`
 *     rows are textures with no fractions at all. A test compares the two fields.
 *   • It reads as INTERRUPTED rather than as any kind of quantity. The arc sets out at 12
 *     o'clock, travels the right-hand half, and stops at 6 — it does not fade, it does not
 *     wrap, and it never comes back round. That is the whole meaning of the state, drawn.
 *   • It does NOT spin. The run is over for this phase; a moving terminal would claim work
 *     still in flight. Movement stays `running`'s own uniqueness property, which survives
 *     `prefers-reduced-motion` only because no other row leans on it.
 *   • `repeats: 1` and `0.5 + 0.5 = 1.00` exactly, so the pattern tiles the circle with no
 *     seam where it wraps at the path start — the rule every fraction row in this table has
 *     held since 188.
 *   • `gapCentre: 0.5` because it is unclaimed (`null`, 0.375, 0.75 and 0.125 are taken), it
 *     is NOT 12 o'clock — the waiting reading's signature and the pause chip's home — and it
 *     keeps the computed dashoffset POSITIVE like every shipped row.
 *   • A near-closed ring with one small notch was REJECTED for the same reason 189 rejected
 *     it: it maximises confusability with `done`, and `done` is the reading this must be
 *     most distinct from. A step a person interrupted reading as one that succeeded is the
 *     confusion this phase exists to prevent.
 *
 * THE EIGHTH SHAPE, AND WHY EACH CLAUSE OF IT IS LOAD-BEARING (UI-SPEC §4b):
 *
 *   • FOUR arcs is its assertable unique property. Every other `fraction` row names one
 *     or two dash/gap pairs, `solid` emits none, and the two `length` rows emit an
 *     unbounded texture — so a test COUNTS the pairs rather than eyeballing the ring.
 *   • It does NOT spin. The run is over for this phase; a moving terminal would claim
 *     work still in flight. Movement is `running`'s own uniqueness property, which is
 *     precisely why the separation from `running` here is by arc COUNT — a distinction
 *     that survives `prefers-reduced-motion`, when the spin is off and running's
 *     property is unavailable. A length-based distinction would have failed that case.
 *   • `repeats: 4` and not 3, because every row tiles the circle EXACTLY (repeats ×
 *     (dash + gap) === 1) so no seam appears where the pattern wraps at the path start.
 *     Three repeats need a dash-plus-gap of one third, which is not expressible in the
 *     two-decimal style this table uses. `4 × (0.15 + 0.10) = 1.00` exactly.
 *   • `gapCentre: 0.125` because it is unclaimed (`null`, 0.375 and 0.75 are taken), it
 *     puts the four gaps on the 45° diagonals so none lands on a cardinal point — in
 *     particular none at 12 o'clock, which is the waiting reading's signature and the
 *     pause chip's home — and it keeps the computed dashoffset POSITIVE like every
 *     shipped row.
 *   • 40 % of the ring is missing, in four visible gaps. A near-closed ring with one
 *     small notch was REJECTED for exactly this reason: it maximises confusability with
 *     `done`, and `done` is the one reading this must be most distinct from. A step that
 *     deliberately sent nothing reading as one that succeeded is the confusion this
 *     whole phase exists to prevent.
 *
 * ⚠ Note two of the four gap centres (.375, .875) coincide with `failed`'s two. That is
 * a value coincidence on the same 45° lattice, not a shape collision: the COUNT (4 vs 2)
 * and the arc length (32 px vs 89.7 px, 2.8×) carry the distinction, and both are
 * asserted.
 *
 * ⚠ jsdom CANNOT prove greyscale distinguishability — it applies no CSS and paints
 * nothing. The suites prove the ATTRIBUTE-level distinction; the VISUAL half is a driven
 * Chrome MCP row (U3, plan 189-16) and is not discharged by a green unit run.
 *
 * `skipped` and `unknown` are both fully patterned and are separated by their dash/gap
 * RATIO — coarse dashes against fine dots — which is why they are `length` specs: they
 * are textures read at a glance, not arcs whose extent means anything.
 */
export const RING_GEOMETRY: Record<CanvasReading, RingSpec> = {
  "not-started": { kind: "none" },
  running: {
    kind: "fraction",
    arc: { dash: 0.26, gap: 0.74, repeats: 1, gapCentre: null },
    spinning: true,
  },
  done: { kind: "solid" },
  failed: {
    kind: "fraction",
    arc: { dash: 0.42, gap: 0.08, repeats: 2, gapCentre: 0.375 },
    spinning: false,
  },
  skipped: { kind: "length", dash: 5, gap: 7 },
  "waiting-for-you": {
    kind: "fraction",
    arc: { dash: 0.74, gap: 0.26, repeats: 1, gapCentre: 0.75 },
    spinning: false,
  },
  unknown: { kind: "length", dash: 1.5, gap: 6 },
  "recorded-not-sent": {
    kind: "fraction",
    arc: { dash: 0.15, gap: 0.1, repeats: 4, gapCentre: 0.125 },
    spinning: false,
  },
  // 194-04 / D-13 — the ring cut exactly in half. See the ninth-shape block above for why
  // each of the four numbers is what it is; none of them is a taste call.
  cancelled: {
    kind: "fraction",
    arc: { dash: 0.5, gap: 0.5, repeats: 1, gapCentre: 0.5 },
    spinning: false,
  },
}

/** TOTAL ring lookup — an unowned reading falls back to the unknown ring rather than to
 *  an inherited member, and never to the closed circle. */
export function ringSpecFor(reading: CanvasReading): RingSpec {
  return own(RING_GEOMETRY, reading) ?? RING_GEOMETRY.unknown
}

/** What the card needs to paint one arc. `null` from `ringDash` ⇒ paint no arc. */
export interface RingDash {
  /** `null` ⇒ emit no `stroke-dasharray` at all (an unbroken circle). */
  dasharray: string | null
  dashoffset: number
  spinning: boolean
}

/** Three decimal places — enough to be exact at this radius, few enough to keep the
 *  emitted attribute readable. Applied to COMPUTED reals only; authored lengths pass
 *  through as written, so a `5 7` texture does not become `5.000 7.000`. */
function fx(n: number): string {
  return n.toFixed(3)
}

function round3(n: number): number {
  return Number(n.toFixed(3))
}

/**
 * Compute one reading's dash pattern from its spec and the ring's circumference.
 *
 * ⚠ **THE GAP IS PLACED WITH `stroke-dashoffset`, NEVER WITH A ROTATION** (D-188-07).
 * Setting the SVG `transform` attribute *and* CSS `transform-box` / `transform-origin`
 * COMPOSES the two and pivots the arc about a doubled offset — that bug shipped in the
 * sketch's own first two drafts and put the waiting gap in the wrong quadrant. The dash
 * offset is the whole placement mechanism, and the only transform anywhere in the ring
 * subtree is the spin class.
 *
 * The formula, for a gap whose centre must sit at path position `p`:
 *
 *     offset = (D + G / 2) − p
 *
 * ⚠ EVERY NUMBER IS COMPUTED HERE. The UI contract's ring table quotes a dasharray and
 * a dashoffset to three decimal places for each reading; those are the EXPECTED RESULTS
 * of this function at `r = 34` ⇒ `C = 213.628`, and they are deliberately NOT reproduced
 * in this file. They live in the suite, where they falsify the formula — pasting them
 * here would turn the test into a copy of the source rather than a check on it, and the
 * acceptance grep over this file asserts their absence.
 */
export function ringDash(spec: RingSpec, circumference: number): RingDash | null {
  switch (spec.kind) {
    case "none":
      return null
    case "solid":
      return { dasharray: null, dashoffset: 0, spinning: false }
    case "length":
      return { dasharray: `${spec.dash} ${spec.gap}`, dashoffset: 0, spinning: false }
    case "fraction": {
      const d = spec.arc.dash * circumference
      const g = spec.arc.gap * circumference
      const pair = `${fx(d)} ${fx(g)}`
      const dasharray = Array.from({ length: spec.arc.repeats }, () => pair).join(" ")
      const dashoffset =
        spec.arc.gapCentre === null ? 0 : round3(d + g / 2 - spec.arc.gapCentre * circumference)
      return { dasharray, dashoffset, spinning: spec.spinning }
    }
    default:
      return null
  }
}

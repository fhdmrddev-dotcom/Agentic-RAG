/**
 * Phase 184-03 Task 1 (D-184-06, Wave-0 G-5 extraction) — nodePresentation.
 *
 * THE CANVAS NODE PRESENTATION TABLES, in one copy. The per-step-type icon tint and
 * the module-scope 3D mark resolver — the things a canvas node face needs that are
 * neither layout (`canvasModel.CANVAS_LAYOUT`) nor vocabulary (`phaseVocabulary`).
 *
 * Phase 184-08 added a fourth table at the foot of this file: the two verdict marks
 * plus the degraded one, and the single named destructive-token literal the R9 colour
 * scan searches for. It lives here rather than beside the card because a component
 * module may not export shared constants (`react-refresh/only-export-components`), and
 * because the problems tray renders the same two marks — one table, two surfaces.
 *
 * Structural template: `components/org/StatusChip.tsx` (Phase 177 D-08). Its
 * docblock draws exactly the boundary this module sits on — the shared COMPONENT is
 * the cohesion win, the tone MAPPING stays domain-specific. This module no longer
 * carries such a mapping (see the Phase 185 note below); `StatusChip` itself stays
 * where it is.
 *
 * PHASE 185 (SPEC Req 6) REMOVED THE GROUNDING TONE MAP. `GROUNDING_TONE` mapped the
 * three faces of the retired grounding word-badge onto chip colours. Req 6 deletes
 * that badge and states that governance spends **no colour and no badge slot** — it
 * renders as SHAPE (the corner seal, plan 185-09) instead. A tone table for a badge
 * that no longer exists is not dead-but-harmless: it is a live, exported
 * three-face-in-colour reading that 188/189 could pick up, which is exactly the
 * partial-deletion hazard the deletion's own threat register names. So it went with
 * the badge. `PhaseNodeCard.test.tsx`'s source guard now asserts its ABSENCE, and
 * `PhaseNode.tsx` is still checked for a resurrected local copy.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future:
 * `ICON_TINT`, `DEFAULT_TINT` and `renderPhaseMark` were CUT out of `PhaseNode.tsx`
 * (they were declared there at `:113`, `:122` and `:159` before the 184-03 plan). It
 * is a hard cut: `PhaseNode.tsx` declares none of them any more and NO re-export shim
 * was left behind — it imports all three from here. The values moved byte-for-byte,
 * docblocks intact; nothing was re-typed.
 *
 * This paragraph is kept honest by machine, not by habit. `PhaseNodeCard.test.tsx`
 * ships a `?raw` source guard — the `canvasModel.purity.test.ts:14-17` house idiom —
 * that reads `PhaseNode?raw` and fails the moment a second declaration of any of them
 * reappears there, and asserts positively that `PhaseNode.tsx` imports from this
 * module. It carries a positive control, so the guard is falsifiable rather than
 * vacuous. An in-code claim of a prior extraction with no guard behind it is the
 * exact anti-drift hazard 184-CONTEXT note 3 names (`soulData.ts` once asserted an
 * extraction that had not happened) — so treat the paragraph above as true only
 * because that guard is green.
 *
 * Purity contract: pure and client-side. This module imports NOTHING from the API
 * client and reads no DOM — a tint is looked up, never fetched. It invents no
 * authoring field and holds no governance reading at all: the one client home for
 * that is `phaseVocabulary.groundingCause`, and the canvas consumes it as a boolean.
 *
 * TOTALITY contract: both resolvers are total. An unknown `phase_type` resolves to
 * `DEFAULT_TINT` and to the `"•"` mark rather than throwing — the definition JSONB is
 * author-supplied and a node face must not crash on an unrecognised discriminator.
 *
 * ⚠ THAT PARAGRAPH WAS A CLAIM, NOT A PROPERTY, UNTIL 188.1-04. It held for a table MISS
 * and failed for an INHERITED key: every table involved is a plain object literal, so
 * `TABLE["constructor"]` returned the `Object` FUNCTION and no `??` fallback fired.
 * `renderPhaseMark` then passed that function to `createElement` and the node face did
 * exactly what the sentence promises it never does — it crashed, with *"Objects are not
 * valid as a React child"*. Both halves are now own-property guarded (this file's
 * `PHASE_GLYPHS` read, and `lib/phaseGlyph`'s `PHASE_GLYPH_MARKS` read), and the tint
 * half is guarded at its consumer, `PhaseNode.tsx`. The claim is kept honest by machine:
 * `PhaseNode.test.tsx`'s 188.1-04 falsification drives a prototype key through the real
 * projection and asserts the painted face equals an ordinary unknown type's. It was
 * observed RED against the shipped tree before any of the three guards existed.
 *
 * THE COLOUR BUDGET IS LOAD-BEARING (sketch 137-D). Per-step-type colour is a TINT
 * BEHIND THE ICON ONLY; every card body stays neutral, because Phase 188 paints run
 * state (running / done / waiting-for-you / failed) onto these same nodes and needs
 * the strong colours free.
 */
import { createElement, type ReactNode } from "react"

import { PHASE_GLYPHS } from "@/components/workflows/soulData"
import { phaseGlyph } from "@/lib/phaseGlyph"
import { ConnectionMarkGlyph, type ConnectionMarkShape } from "@/lib/connectionMark"

/**
 * The per-step-type tint that sits BEHIND the floating mark — the whole of this
 * surface's type-colour budget (137-D). Values are the sketch's, expressed against
 * the same hue family the app already ships; every card body stays neutral.
 *
 * ⚠ THE TINT IS THE WHOLE BUDGET. It is never a card wash, never a border and never a
 * text colour — Phase 188 paints run status onto these same nodes and needs the strong
 * tokens free. A per-step-type colour anywhere else on the card is the regression this
 * comment exists to name.
 *
 * Phase 189-13 Task 1 (CONN-01 / UI-SPEC §5c) — the 7th type. `310` (magenta) is the
 * MIDPOINT OF THE LARGEST UNUSED HUE GAP: the shipped hues are 200 · 220 · 239 · 170 ·
 * 38 · 258 and the reserved status hues are 239 (primary), 142 (success), 38 (warning)
 * and 0 (destructive), leaving two large gaps — 258→360 and 38→142. The second gap's
 * midpoint (~90, lime) is REJECTED because it sits adjacent to the `--success` family
 * and would read as a success cue behind an icon, on the one step type whose whole point
 * is that nothing was sent. 310 is 52° from llm_emit's violet 258 and 50° from
 * destructive 0/360, its two nearest neighbours. Alpha 0.38 is inside the shipped range
 * (0.22 … 0.40).
 */
export const ICON_TINT: Record<string, string> = {
  programmatic: "hsl(200 85% 62% / 0.36)",
  llm_single: "hsl(220 30% 100% / 0.22)",
  llm_agent: "hsl(239 90% 70% / 0.40)",
  llm_batch_agents: "hsl(170 80% 55% / 0.34)",
  llm_human_input: "hsl(38 92% 62% / 0.38)",
  llm_emit: "hsl(258 90% 70% / 0.40)",
  external_action: "hsl(310 85% 66% / 0.38)",
}

export const DEFAULT_TINT = "hsl(220 30% 100% / 0.18)"

/**
 * The 3D mark, resolved at MODULE scope and returned as a `ReactNode`.
 *
 * For `external_action` steps (Phase 209 Item 1), resolves the real service mark from
 * `connectionMark.tsx`. For all other types, resolves the bundled SVG glyph.
 */
export function renderPhaseMark(
  phaseType: string,
  connectionShape?: ConnectionMarkShape | null,
): ReactNode {
  if (phaseType === "external_action") {
    return createElement(ConnectionMarkGlyph, { shape: connectionShape ?? {}, size: "canvas" })
  }
  const mark = phaseGlyph(phaseType)
  // ⚠ THE SECOND LOOKUP IS GUARDED TOO (188.1-04). `PHASE_GLYPHS` is a plain object
  // literal, so it INHERITS `constructor`, `toString`, `__proto__` and friends and
  // `PHASE_GLYPHS[phaseType] ?? "•"` handed back a FUNCTION for those names rather than
  // the fallback mark.
  if (mark) return createElement(mark, { className: "h-8 w-8" })
  return Object.prototype.hasOwnProperty.call(PHASE_GLYPHS, phaseType)
    ? PHASE_GLYPHS[phaseType]
    : "•"
}

// ── Phase 184-08 (VALID-03 · R9) — the verdict marks ────────────────────────────
//
// Added here, and not beside the card that renders them, for a mechanical reason:
// `react-refresh/only-export-components` forbids a component module from exporting
// shared constants. It is also the right home — this file is the canvas node's
// presentation tables in ONE copy, and the tray renders the same two marks.

/**
 * The three states a node's corner mark can be in.
 *
 * Two of them are SERVER SEVERITIES read verbatim; the third is a state of the CHECK
 * rather than of any finding. `phaseNodeCardContract.NodeVerdictMark` is an alias of this
 * type, kept so every existing caller's name still resolves. (188.2-06 corrected the
 * qualified name in the SAME COMMIT that made the old one false: the alias used to live on
 * the card and now lives in the card's own contract leaf. A docblock naming a home a type
 * no longer has is the same defect as a false one.)
 */
export type VerdictMarkKind = "error" | "incomplete" | "unknown"

/**
 * The CSS token family the `error` mark — and ONLY the `error` mark — may spend.
 *
 * Exported as a single named literal SO THAT R9 CAN BE SCANNED RATHER THAN EYEBALLED.
 * `PhaseNodeCard.test.tsx` and `ProblemsTray.test.tsx` each render a draft that is all
 * "not finished yet" and assert this string appears in the emitted HTML exactly ZERO
 * times, each with a positive control proving that one `error` puts it back. A colour
 * heuristic could not do that; one named literal can.
 */
export const VERDICT_DESTRUCTIVE_TOKEN = "destructive"

/** One verdict mark's whole rendering: a decorative glyph, the words that carry its
 *  meaning, and the classes that colour it. */
export interface VerdictMarkPresentation {
  /** Rendered `aria-hidden` — the SHAPE is the non-colour visual carrier. */
  glyph: string
  /** The accessible name. Never empty, and never a colour word. */
  label: string
  /** The mark's own classes. `error` is the ONLY entry naming the destructive token. */
  className: string
}

/**
 * THE VERDICT MARKS, AND THE COLOUR BUDGET THEY SPEND (sketch 137-D / 139-A · R9).
 *
 *  - `error` → a red `✕`, on the app's destructive token. This is bad news and it
 *    reads like it.
 *  - `incomplete` → a **dashed grey `○`**, on neutral tokens only, carrying no
 *    destructive token and no alarm colour at all. **This is the load-bearing half of
 *    R9.** Both severities set `ok:false` and both block a publish, but only one of
 *    them is a mistake: "not finished yet" is the state a canvas spends most of its
 *    life in, and painting it in alarm colours tells a person they have done something
 *    wrong every time they pause halfway. A three-`incomplete` / zero-`error` draft
 *    therefore emits the destructive token zero times, and that is asserted rather
 *    than trusted.
 *  - `unknown` → the degraded mark: neutral, and deliberately NOT clean. "We could not
 *    check" must never render as "fine" — a registry blip that reads as a green light
 *    is the worst outcome this surface can produce (sketch 139, What to Look For 3).
 *
 * Strong colour otherwise stays RESERVED for Phase 188's run status, which paints
 * running / done / waiting-for-you / failed onto these same nodes. Spending it here
 * would take the vocabulary 188 needs and leave 188 nothing louder to say.
 *
 * NEVER COLOUR ALONE (WCAG 1.4.1, the `panel/PhaseCard.tsx:17-20` rule): each mark is
 * an aria-hidden glyph whose SHAPE and BORDER STYLE already differ from the others (a
 * solid ✕ ring vs a dashed ○ ring), plus a real accessible label naming the state in
 * words on a contrast-AA token — never the dimmed muted variant.
 *
 * MOTION: none, anywhere in this table. Motion keys off RUN STATE and never off
 * selection, and 184 has no run state, so a selected node is not the thing that moves.
 */
export const VERDICT_MARK = {
  error: {
    glyph: "✕",
    label: "Has a problem",
    className: "border border-destructive/70 bg-destructive/15 text-destructive",
  },
  incomplete: {
    glyph: "○",
    label: "Not finished yet",
    className: "border border-dashed border-border bg-muted text-muted-foreground",
  },
  unknown: {
    glyph: "?",
    label: "Could not be checked",
    className: "border border-dashed border-border bg-muted text-muted-foreground",
  },
} as const satisfies Record<VerdictMarkKind, VerdictMarkPresentation>

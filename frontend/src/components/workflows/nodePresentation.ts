/**
 * Phase 184-03 Task 1 (D-184-06, Wave-0 G-5 extraction) — nodePresentation.
 *
 * THE CANVAS NODE PRESENTATION TABLES, in one copy. The per-step-type icon tint,
 * the grounding tone mapping for the shared `StatusChip`, and the module-scope 3D
 * mark resolver — the things a canvas node face needs that are neither layout
 * (`canvasModel.CANVAS_LAYOUT`) nor vocabulary (`phaseVocabulary`).
 *
 * Phase 184-08 added a fourth table at the foot of this file: the two verdict marks
 * plus the degraded one, and the single named destructive-token literal the R9 colour
 * scan searches for. It lives here rather than beside the card because a component
 * module may not export shared constants (`react-refresh/only-export-components`), and
 * because the problems tray renders the same two marks — one table, two surfaces.
 *
 * Structural template: `components/org/StatusChip.tsx` (Phase 177 D-08). Its
 * docblock draws exactly the boundary this module sits on — the shared COMPONENT is
 * the cohesion win, the tone MAPPING stays domain-specific. `GROUNDING_TONE` is that
 * domain mapping for the canvas; `StatusChip` itself stays where it is.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future:
 * `ICON_TINT`, `DEFAULT_TINT`, `GROUNDING_TONE` and `renderPhaseMark` were CUT out of
 * `PhaseNode.tsx` (they were declared there at `:113`, `:122`, `:137` and `:159`
 * before this plan). It is a hard cut: `PhaseNode.tsx` declares none of them any more
 * and NO re-export shim was left behind — it imports all four from here. The values
 * moved byte-for-byte, docblocks intact; nothing was re-typed.
 *
 * This paragraph is kept honest by machine, not by habit. `PhaseNodeCard.test.tsx`
 * ships a `?raw` source guard — the `canvasModel.purity.test.ts:14-17` house idiom —
 * that reads `PhaseNode?raw` and fails the moment a second declaration of any of the
 * four reappears there, and asserts positively that `PhaseNode.tsx` imports from this
 * module. It carries a positive control, so the guard is falsifiable rather than
 * vacuous. An in-code claim of a prior extraction with no guard behind it is the
 * exact anti-drift hazard 184-CONTEXT note 3 names (`soulData.ts` once asserted an
 * extraction that had not happened) — so treat the paragraph above as true only
 * because that guard is green.
 *
 * Purity contract: pure and client-side. This module imports NOTHING from the API
 * client and reads no DOM — a tint is looked up, never fetched. It invents no
 * authoring field: a stored grounding-mode dial belongs to Phase 185, and the
 * `Grounding` shape here is the DERIVED one `phaseVocabulary` already ships.
 *
 * TOTALITY contract: both resolvers are total. An unknown `phase_type` resolves to
 * `DEFAULT_TINT` and to the `"•"` mark rather than throwing — the definition JSONB is
 * author-supplied and a node face must not crash on an unrecognised discriminator.
 *
 * THE COLOUR BUDGET IS LOAD-BEARING (sketch 137-D). Per-step-type colour is a TINT
 * BEHIND THE ICON ONLY; every card body stays neutral, because Phase 188 paints run
 * state (running / done / waiting-for-you / failed) onto these same nodes and needs
 * the strong colours free.
 */
import { createElement, type ReactNode } from "react"

import type { ChipTone } from "@/components/org/StatusChip"
import { PHASE_GLYPHS } from "@/components/workflows/soulData"
import type { Grounding } from "@/components/workflows/phaseVocabulary"
import { phaseGlyph } from "@/lib/phaseGlyph"

/**
 * The per-step-type tint that sits BEHIND the floating mark — the whole of this
 * surface's type-colour budget (137-D). Values are the sketch's, expressed against
 * the same hue family the app already ships; every card body stays neutral.
 */
export const ICON_TINT: Record<string, string> = {
  programmatic: "hsl(200 85% 62% / 0.36)",
  llm_single: "hsl(220 30% 100% / 0.22)",
  llm_agent: "hsl(239 90% 70% / 0.40)",
  llm_batch_agents: "hsl(170 80% 55% / 0.34)",
  llm_human_input: "hsl(38 92% 62% / 0.38)",
  llm_emit: "hsl(258 90% 70% / 0.40)",
}

export const DEFAULT_TINT = "hsl(220 30% 100% / 0.18)"

/**
 * The canvas-domain tone mapping for the shared `StatusChip` (D-183-07 slot 1).
 *
 * This is the documented reuse shape, not a fork: `StatusChip`'s own docblock
 * separates the shared COMPONENT (the cohesion win) from the tone MAPPING (always
 * domain-specific — `statusChipMeta` maps the invitation/SSO lifecycle,
 * `adoptionChip` maps the roster's adoption state, and this maps grounding). A
 * third inline pill is exactly the fork Phase 177 retired.
 *
 * `strict` reads as a satisfied constraint (green), `flag` as a live/attention
 * state (indigo), `open` as calm. The WORD carries the meaning either way — the
 * glyph beside it is decorative and aria-hidden (WCAG 1.4.1, never colour alone).
 */
export const GROUNDING_TONE: Record<Grounding["mode"], ChipTone> = {
  strict: "success",
  flag: "primary",
  open: "muted",
}

/**
 * The 3D mark, resolved at MODULE scope and returned as a `ReactNode`.
 *
 * Since Phase 127 the soulData value is a fluent-emoji SLUG string rather than a
 * glyph, so `"•"` is the real visual fallback for an unmapped type (the canonical
 * `PhaseSpine.tsx:87-89` render). The resolution deliberately does NOT happen inside
 * a component body: `phaseGlyph()` returns a COMPONENT, and binding a component to a
 * local during render is what `react-hooks/static-components` correctly flags —
 * React cannot preserve state across renders for a type that is recreated. Hoisting
 * the JSX call site into a leaf component does not clear it either (the rule fires in
 * any component body); returning the element from a plain module-scope helper does,
 * and it is also the honest shape — this is a lookup, not a component.
 *
 * The rendered output is byte-identical to the previous inline ternary: the same
 * bundled SVG, the same `h-8 w-8`, the same `"•"` fallback.
 *
 * MODULE SCOPE IS PART OF THE CONTRACT. It was at module scope in `PhaseNode.tsx` for
 * the reason above and it stays at module scope here; calling it from inside a
 * component body is exactly what the lint rule catches.
 */
export function renderPhaseMark(phaseType: string): ReactNode {
  const mark = phaseGlyph(phaseType)
  return mark ? createElement(mark, { className: "h-8 w-8" }) : (PHASE_GLYPHS[phaseType] ?? "•")
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
 * rather than of any finding. `PhaseNodeCard.NodeVerdictMark` is an alias of this type,
 * kept so every existing caller's name still resolves.
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

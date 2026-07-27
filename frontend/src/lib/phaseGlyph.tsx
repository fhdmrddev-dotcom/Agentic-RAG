/**
 * Phase 127-01 Task 2 (WUX-03) — phaseGlyph resolver.
 *
 * The ONE shared phase-type → bundled 3D SVG component resolver. Mirrors
 * `providerLogo.tsx` exactly in shape: a keyed Record of build-time bundled
 * imports + `export function phaseGlyph(phaseType): PhaseMark | null`
 * returning `PHASE_GLYPH_MARKS[phaseType] ?? null` (total over any key;
 * caller renders a unicode fallback on null).
 *
 * SECURITY:
 *   - Phase-type comes from the workflow definition (an already-validated
 *     server value). The returned mark is a React component (an SVG),
 *     rendered as a child element, never as interpolated/raw HTML.
 *     No `dangerouslySetInnerHTML`.
 *   - Icons are imported from their deep `~icons/fluent-emoji/<slug>` subpaths
 *     (build-time bundled by unplugin-icons, no runtime CDN fetch). This
 *     mirrors the providerLogo.tsx deep-subpath pattern and enforces the
 *     icon-convention "verify-or-bundle" rule (icon-convention §2, RDD 43).
 *   - Only verified fluent-emoji slugs are used (API-checked 2026-06-27;
 *     re-verified 2026-07-27 against the INSTALLED
 *     `@iconify-json/fluent-emoji@1.2.7` icon set, which is the source of
 *     truth the build resolves against):
 *     gear, memo, compass, handshake, raised-hand, package.
 *     `fluent-emoji:direct-hit` and `fluent-emoji:no-entry-sign` are ABSENT
 *     from the set and are NEVER referenced here.
 *
 * Phase 184-01 Task 2 (D-184-07) — the two cross-cutting slug swaps:
 * `llm_agent` moved off the previous generic mark to `compass`, and
 * `llm_batch_agents` moved off the previous silhouettes mark (measured
 * luminance 34.5 on Deep Midnight — ~4x dimmer than the other five marks, it
 * visually disappeared) to `handshake` (182.6). Sketch 137-B makes the 3D icon
 * the SOLE carrier of step type (there is no per-type colour on the card), so
 * a dim or generic mark means the step type is unreadable. Both maps below —
 * this one and `soulData.PHASE_GLYPHS` — swapped in the SAME commit: swapping
 * one alone leaves phaseGlyph() returning the old component while the string
 * fallback changed, a silent split-brain.
 */
import type { ComponentType, SVGProps } from "react"
// Build-time bundled imports — unplugin-icons resolves each slug to a React
// SVG component at bundle time. A missing slug fails the build, enforcing
// the "verify-or-bundle" discipline (RESEARCH §Pitfall 2).
import Gear from "~icons/fluent-emoji/gear"
import Memo from "~icons/fluent-emoji/memo"
import Compass from "~icons/fluent-emoji/compass"
import Handshake from "~icons/fluent-emoji/handshake"
import RaisedHand from "~icons/fluent-emoji/raised-hand"
import Package from "~icons/fluent-emoji/package"

/**
 * An unplugin-icons bundled SVG component. The full shim type includes SVGProps
 * so callers can pass standard SVG attributes. `size` is the icon-specific prop.
 */
export type PhaseMark = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

/**
 * The phase-type → 3D SVG mark map. Keys are the exact `phase_type` strings
 * from the workflow definition (matching the `PHASE_GLYPHS` keys in soulData.ts).
 * Only the 6 verified types are mapped; any other key returns null via phaseGlyph().
 */
const PHASE_GLYPH_MARKS: Record<string, PhaseMark> = {
  programmatic: Gear,
  llm_single: Memo,
  llm_agent: Compass,
  llm_batch_agents: Handshake,
  llm_human_input: RaisedHand,
  llm_emit: Package,
}

/**
 * Resolve the 3D SVG glyph component for a workflow phase type.
 *
 * @param phaseType the `phase_type` string from the workflow definition
 *   (e.g. "llm_agent", "programmatic"), or undefined for loading/unknown phases
 * @returns the bundled 3D SVG component, or `null` for any unmapped / unknown
 *   phase type so the caller can render its unicode fallback (e.g. "•").
 */
export function phaseGlyph(phaseType: string | undefined): PhaseMark | null {
  // The `?? null` mirrors providerLogo's `?? null` — total over any key.
  return phaseType ? (PHASE_GLYPH_MARKS[phaseType] ?? null) : null
}

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
 *     gear, memo, compass, handshake, raised-hand, package; and
 *     re-verified again 2026-08-07 for the 7th type's `outbox-tray`.
 *     `fluent-emoji:direct-hit` and `fluent-emoji:no-entry-sign` are ABSENT
 *     from the set and are NEVER referenced here — and so is the bare
 *     `outbox` (measured ABSENT; `outbox-tray` is the one that exists).
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
 *
 * Phase 189-13 Task 1 (CONN-01) — the 7th type, `external_action` → `outbox-tray`.
 * The SAME-COMMIT RULE above was honoured and is no longer only prose: this module
 * now exports `PHASE_GLYPH_MARK_KEYS` and `soulData.test.ts` asserts the two maps'
 * key SETS are IDENTICAL. That is the split-brain rule stated as a PROPERTY rather
 * than as six comparisons, so a ninth type inherits the guard without anybody
 * remembering to extend a list — and it was observed RED against a one-sided key.
 * ⚠ The KEYS are exported and the MAP is not, deliberately: a second consumer
 * reading the map directly would bypass `phaseGlyph()`'s own-property guard below,
 * which is the 188.1-04 hard-render-crash this file already carries the scar of.
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
import OutboxTray from "~icons/fluent-emoji/outbox-tray"

/**
 * An unplugin-icons bundled SVG component. The full shim type includes SVGProps
 * so callers can pass standard SVG attributes. `size` is the icon-specific prop.
 */
export type PhaseMark = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

/**
 * The phase-type → 3D SVG mark map. Keys are the exact `phase_type` strings
 * from the workflow definition, and they MUST be the same set as the
 * `PHASE_GLYPHS` keys in soulData.ts — that identity is asserted as a property
 * (see `PHASE_GLYPH_MARK_KEYS` below), not restated as a count here, because the
 * count has now rotted twice (6 at 127-01, 7 at 189-13). Any key neither map
 * owns returns null via phaseGlyph() and the caller renders its "•" fallback.
 */
const PHASE_GLYPH_MARKS: Record<string, PhaseMark> = {
  programmatic: Gear,
  llm_single: Memo,
  llm_agent: Compass,
  llm_batch_agents: Handshake,
  llm_human_input: RaisedHand,
  llm_emit: Package,
  external_action: OutboxTray,
}

/**
 * THE SPLIT-BRAIN GUARD'S HANDLE — the mark map's key set, and nothing else.
 *
 * `soulData.test.ts` asserts this equals `Object.keys(soulData.PHASE_GLYPHS)`, which
 * is the same-commit rule in the header expressed as something a machine checks. Only
 * the KEYS are exported: handing out the map itself would let a caller read a mark
 * without `phaseGlyph()`'s own-property guard, and an inherited key (`constructor`)
 * read that way is the `[Function Object]` React child that hard-crashed a node face
 * before 188.1-04. A key list cannot be misused that way.
 */
export const PHASE_GLYPH_MARK_KEYS: readonly string[] = Object.keys(PHASE_GLYPH_MARKS)

/**
 * Resolve the 3D SVG glyph component for a workflow phase type.
 *
 * @param phaseType the `phase_type` string from the workflow definition
 *   (e.g. "llm_agent", "programmatic"), or undefined for loading/unknown phases
 * @returns the bundled 3D SVG component, or `null` for any unmapped / unknown
 *   phase type so the caller can render its unicode fallback (e.g. "•").
 */
export function phaseGlyph(phaseType: string | undefined): PhaseMark | null {
  // ⚠ THIS LINE'S COMMENT USED TO READ "The `?? null` mirrors providerLogo's `?? null` —
  // total over any key" (corrected 188.1-04). It was not total over any key, and the
  // header's `@returns … null for any unmapped / unknown phase type` was false for the
  // same reason. `PHASE_GLYPH_MARKS` is a plain object literal, so it INHERITS
  // `constructor`, `toString`, `__proto__` and friends: `PHASE_GLYPH_MARKS["constructor"]`
  // is the `Object` FUNCTION — never nullish, so `?? null` did not fire, and the caller
  // then did `createElement(Object, { className })`, which React rejects with *"Objects
  // are not valid as a React child"*. A HARD RENDER CRASH of the whole node, not a wrong
  // icon, and it is what `PhaseNode.test.tsx` and `panel/__tests__/PhaseTimeline.test.tsx`
  // both hit FIRST when their 188.1-04 WR-04 falsifications were observed RED — the
  // measurement that put this line in scope. `phaseType` is author-supplied
  // workflow-definition JSONB; totality is a property of the lookup rather than of its
  // current callers (`lib/phaseState.ts:65-75`, the house argument).
  if (!phaseType) return null
  if (!Object.prototype.hasOwnProperty.call(PHASE_GLYPH_MARKS, phaseType)) return null
  return PHASE_GLYPH_MARKS[phaseType]
}

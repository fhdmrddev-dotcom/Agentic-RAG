// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 06 (PANEL-01 / D-03 / D-05 / W1) — the SINGLE live-version rule.
//
// Neither `Skill` nor `PublishGate` carries a version number, and `SkillVersion`
// has no `is_current` flag — the only source of "which version is live" is content-
// equality against the live skill's instructions. This is the ONE rule, ONE
// implementation (W1): the Studio shell (Plan 06) and the slim detail panel (Plan 07)
// both import THIS helper, so the "vN" they show can never disagree.
//
// The content-equality mirrors the backend publish-gate binding (D-04,
// publish_gate_service.py:145-147): the live version is the SkillVersion whose
// `instructions` equal the live skill's `instructions`. Fallbacks are honest, never
// fabricated: no content match → the MAX version_number (the newest snapshot); no
// versions at all → 1 (a skill always has at least a notional v1).
//
// Pure + synchronous + React-free → unit-testable in isolation and safe to call in
// render.
// ─────────────────────────────────────────────────────────────────────────────
import type { Skill, SkillVersion } from "@/types"

export function deriveLiveVersion(skill: Skill, versions: SkillVersion[]): number {
  const match = versions.find((v) => v.instructions === skill.instructions)
  if (match) return match.version_number
  if (versions.length === 0) return 1
  return Math.max(...versions.map((v) => v.version_number))
}

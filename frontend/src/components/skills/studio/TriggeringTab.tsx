// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 06 (PANEL-01 / D-02) — the Studio "Triggering" tab.
//
// A THIN re-homing wrapper: it mounts the shipped SkillTunerPage unchanged, passing
// the single additive `embedded` flag so the tuner's own focused-surface header is
// suppressed (the Studio's persistent header already carries the ‹ Skills back +
// skill identity — one header, not two). The 041/042/043/045 tuner winners, its
// live-run machinery, and every tuner-internal component are UNTOUCHED (D-02) — this
// file imports NONE of the tuner internals (only the top-level SkillTunerPage); the
// header suppression is entirely the `embedded` prop. A re-homing, not a rebuild
// (sketch 057 Build Handover).
// ─────────────────────────────────────────────────────────────────────────────
import { SkillTunerPage } from "@/pages/SkillTunerPage"

interface Props {
  /** The skill being tuned — always non-null when the Studio mounts this tab. */
  skillId: string
  /** Return to the Skills surface ("‹ Skills"), threaded from the Studio shell. */
  onBack: () => void
  /** 176-02 (RENDER-04): the Studio shell's refreshVersions — the embedded tuner calls
   *  it after a description proposal is approved so the shell re-derives the live version
   *  (header vN + Versions LIVE badge) with no reload. Forwarded straight to the tuner. */
  onVersionPromoted?: () => void
}

export function TriggeringTab({ skillId, onBack, onVersionPromoted }: Props) {
  return (
    <SkillTunerPage
      skillId={skillId}
      onBack={onBack}
      embedded
      onVersionPromoted={onVersionPromoted}
    />
  )
}

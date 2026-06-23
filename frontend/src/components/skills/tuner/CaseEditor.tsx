/**
 * Phase 123 Plan 05 Task 2b (TRIG-01) — CaseEditor (sketch 043-A).
 *
 * Two columns — should-fire / should-NOT — with per-row provenance tags
 * (`seeded`/`sibling`/`held`/`you`), add/edit/remove, and the 60/40 train/held-out
 * split bar. The should-NOT column reads visually as the FALSE-FIRE RAIL (the
 * sibling-skill auto-seed generates realistic false-fire bait). The benchmark is
 * hybrid auto-seed + author edits (D-04); cases are ephemeral / client-held.
 *
 * Stub scaffolding placeholder — implemented to GREEN in Task 2b (TDD).
 */
import type { Skill } from "@/types"

/** One client-held benchmark case + its provenance (the auto-seed vs author tag). */
export interface EditorCase {
  id: string
  prompt: string
  should_fire: boolean
  /** auto-seed/authorship provenance (043-A): what the Tuner wrote vs what you own. */
  provenance: "seeded" | "sibling" | "held" | "you"
}

interface Props {
  cases: EditorCase[]
  onChange: (cases: EditorCase[]) => void
  /** The skill being tuned — used to auto-seed the starter should-fire paraphrases. */
  skill: Skill
}

export function CaseEditor({ cases: _cases, onChange: _onChange, skill: _skill }: Props) {
  return null
}

/**
 * Phase 262 (D-262-06 / RESEARCH R-3, R-7) — the ONE home of expert-icon resolution.
 *
 * WHAT THIS REPLACES, and why the replacement is not a refactor.
 *
 * Phase 260 shipped `getExpertIcon(expert)` twice — VERBATIM — in
 * `InviteExpertDialog.tsx:27-37` and `ExpertSpotlightCard.tsx:70-81`. Both guessed an emoji by
 * string-matching `expert.slug` and `expert.name` ("financial" → 📊, "legal" → ⚖️,
 * "code"/"developer" → 💻, else ✨). That shipped for a real reason: at Phase 260 there was one
 * seeded demo Expert and no read path for the `icon` column at all, so a guess was the only way
 * the chat surfaces could show anything but a single glyph.
 *
 * Migration 189 added `icon` and `ExpertAuthoringStudio` writes it, so the guess is now a lie:
 * an author who picks `scale` for an Expert named "Financial Controls" gets 📊 anyway, and a
 * brand-new Expert that merely has "financial" in its name inherits the demo Expert's face.
 * `OrgExpertsTab.tsx:30-46` already resolved the column correctly — that map is what moved here,
 * and it is now the only decider in the repository.
 *
 * ⛔ RESOLUTION READS THE `icon` FIELD AND NOTHING ELSE. It never inspects `slug`, `name`, or any
 * other string content: re-implementing the guess one file over would move the defect, not end it.
 *
 * ⛔ T-262-05 — `icon` is author-controlled free text that selects a rendered component. It is
 * resolved by LOOKUP IN A CLOSED MAP with a `Sparkles` fallback. Never
 * `React.createElement(userString)`, never a dynamic import, never an `<img src>`: an unknown key
 * falls back, it does not render author-controlled markup.
 */

import React from "react"
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Cpu,
  Database,
  FileText,
  Scale,
  Shield,
  Sparkles,
  Terminal,
  Truck,
} from "lucide-react"

/**
 * The eleven keys `OrgExpertsTab.tsx:30-46` shipped, moved verbatim. The key SET is pinned by
 * `__tests__/expertIcon.test.tsx` case (5) — dropping one silently degrades every Expert whose
 * author chose it to the fallback.
 */
export const EXPERT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  chart: BarChart3,
  scale: Scale,
  shield: Shield,
  briefcase: Briefcase,
  truck: Truck,
  terminal: Terminal,
  cpu: Cpu,
  database: Database,
  book: BookOpen,
  "file-text": FileText,
  sparkles: Sparkles,
}

export interface ExpertIconProps {
  /** The Expert row's `icon` column (migration 189). Optional — every renderer owes a fallback. */
  icon?: string
  /** Defaults to the `h-5 w-5` the shipped `renderExpertIcon` used. */
  className?: string
}

export function ExpertIcon({ icon, className = "h-5 w-5" }: ExpertIconProps) {
  const IconComp = (icon && EXPERT_ICON_MAP[icon]) ? EXPERT_ICON_MAP[icon] : Sparkles
  return <IconComp className={className} />
}

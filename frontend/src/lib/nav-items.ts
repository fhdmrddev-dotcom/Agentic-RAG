/**
 * Phase 103 (REQ-7 / WFAUTH-04, sketch 023-A) — the SINGLE shared nav source.
 *
 * Until now the primary-nav array was triplicated verbatim across NavPanel,
 * AppDock (dead), and ChatLayout's NAV_ITEMS_MOBILE. This const kills that
 * triplication: NavPanel consumes it here, the mobile drawer consumes it in
 * Plan 06, and the dead AppDock.tsx is deleted.
 *
 * Three-homes navigation contract (sketch 023-A, locked 2026-06-14): the
 * "workflows" entry is a TOP-LEVEL home (Builder authoring / Workflows-page
 * library+launch / Chat-thread execution), wired with NO router — navigation
 * is a `useState<ActiveView>` switch (App.tsx). The Workflows icon is a
 * DISTINCT non-gear lucide glyph (`Workflow`, NOT `Settings`) per REQ-7.
 */
import { MessageSquare, FileText, Activity, Zap, Settings, Workflow, Wand2, ShieldCheck } from "lucide-react"
import type { ActiveView } from "@/App"
import type { GovernedFeature, EffectiveFeatures } from "@/lib/api"

export interface NavItem {
  view: ActiveView
  icon: typeof MessageSquare
  label: string
  // Phase 148 (VIS-01 / D-04, sketch 069-A): the governed-feature key this nav
  // entry surfaces. When present, the item renders ONLY if the caller's effective
  // map resolves it true (the VANISH — never a locked/badged placeholder). Absent →
  // an ungoverned home (Chat, Documents, Library Health …) that is ALWAYS visible.
  feature?: GovernedFeature
}

export const NAV_ITEMS: readonly NavItem[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  // Phase 148 (VIS-01): governed by `workflow_authoring` — the Workflows home hosts
  // the Builder/authoring gauntlet. Everyone-audience on the day-one map (148-05), so
  // it stays visible to all today; a future operator tighten makes it vanish for
  // non-operators automatically (the map, not a hardcode).
  { view: "workflows", icon: Workflow, label: "Workflows", feature: "workflow_authoring" },
  { view: "documents", icon: FileText, label: "Documents" },
  // Phase 118 gap-closure (CLASS-01 reachability): the classification-rules
  // top-level home (sketch 037-A "Automation"). Distinct non-reused glyph
  // (Wand2 — automation), placed adjacent to Documents as a doc-automation home.
  { view: "classification-rules", icon: Wand2, label: "Classification" },
  { view: "library-health", icon: Activity, label: "Library Health" },
  // Phase 119 (DGOV-01/02): the Governance top-level home — a peer to Library
  // Health, distinct glyph (ShieldCheck — NOT Wand2=Classification, NOT
  // Activity=Library Health) + label distinct from "Library Health" (D-119-1).
  // Deliberately NOT gated behind DMF-03 / document_management_enabled: 113-118
  // all left their DM surfaces ungated (the flag is dormant at every DM surface);
  // gating Governance alone would be the lone inconsistent surface (A8).
  // Phase 148 (VIS-01): governed by `governance_health` (Everyone on the day-one map).
  { view: "governance", icon: ShieldCheck, label: "Governance", feature: "governance_health" },
  // Phase 148 (VIS-01): governed by `skill_studio` (Operators-only on the day-one
  // map) — vanishes for a non-operator; the Studio's evals/triggering/versions are
  // API-gated (148-05), so hiding the entry avoids a dead-click.
  { view: "skills", icon: Zap, label: "Skills", feature: "skill_studio" },
  // Phase 148 (VIS-01): governed by `model_management` (Operators-only on the day-one
  // map) — vanishes for a non-operator; the chat model picker (GET /settings/providers)
  // is an ungated Run carve-out (148-05), so chat/run never breaks by hiding Settings.
  { view: "settings", icon: Settings, label: "Settings", feature: "model_management" },
] as const

/**
 * Phase 148 (VIS-01 / D-04, sketch 069-A) — filter NAV_ITEMS by an effective-features
 * map. A governed entry (one carrying a `feature` tag) renders ONLY when the map
 * resolves that key strictly `true`; an absent/false key DROPS the item entirely —
 * the sketch VANISH, never a locked/disabled/badged placeholder. Ungoverned entries
 * (no `feature`) always pass. Fail-CLOSED by construction: the map fails to `{}` on
 * error / pre-resolve (useEffectiveFeatures), so a blip hides every governed feature
 * rather than flashing an operators-only one. RENDER-ONLY — 148-05's `require_visible`
 * API is the security authority; this just avoids dead nav.
 */
export function visibleNavItems(features: EffectiveFeatures): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.feature || features[item.feature] === true)
}

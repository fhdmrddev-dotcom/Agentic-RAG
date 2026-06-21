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

export interface NavItem {
  view: ActiveView
  icon: typeof MessageSquare
  label: string
}

export const NAV_ITEMS: readonly NavItem[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  { view: "workflows", icon: Workflow, label: "Workflows" },
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
  { view: "governance", icon: ShieldCheck, label: "Governance" },
  { view: "skills", icon: Zap, label: "Skills" },
  { view: "settings", icon: Settings, label: "Settings" },
] as const

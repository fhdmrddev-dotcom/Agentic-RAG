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
import { MessageSquare, FileText, Zap, Settings, Workflow, Wand2, Plug } from "lucide-react"
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
  { view: "documents", icon: FileText, label: "Library" },
  // Phase 118 gap-closure (CLASS-01 reachability): the classification-rules
  // top-level home (sketch 037-A "Automation"). Distinct non-reused glyph
  // (Wand2 — automation), placed adjacent to Documents as a doc-automation home.
  { view: "classification-rules", icon: Wand2, label: "Classification" },
  // ⚠ UNGOVERNED, AND DELIBERATELY SO — this entry exists because the Settings one
  // below CANNOT carry Connections. `Settings` is tagged `model_management`, which
  // `backend/app/api/features.py:21` classifies Operators-only, so `visibleNavItems`
  // dropped it for every member — and with it the whole connections surface Phases
  // 211-216 shipped. That tag was CORRECT when Settings held only model management;
  // it stopped being correct when Settings grew a per-user tab.
  //
  // Un-tagging Settings was the other candidate and is the WRONG fix: `GET /settings`
  // and `PUT /settings` themselves carry `require_visible("model_management")`
  // (`api/settings.py:331,341`), so a member reaching the page would meet a 403 on
  // mount. This entry opens the SAME page pinned to the Connections tab, which fetches
  // its own rows through `listConnectorConnections()` and needs neither endpoint.
  //
  // ⚠ It is ungoverned by DESIGN, not by omission: a connection is a per-user asset,
  // like a thread. If connections ever need governing they get their OWN feature key —
  // never `model_management`, whose audience is about models.
  { view: "connections", icon: Plug, label: "Connections" },
  // ⚠ UNGOVERNED SINCE 2026-08-31, AND THE TAG IT LOST WAS GATING THE WRONG THING.
  //
  // The note this replaces is preserved because its reasoning was sound and its SCOPE was
  // not: *"governed by `skill_studio` (Operators-only) — the Studio's evals/triggering/
  // versions are API-gated, so hiding the entry avoids a dead-click."* True of the STUDIO.
  // But `skill_studio` gates `api/evals.py`, `api/skill_test_cases.py` and
  // `api/skill_tuner.py` — and `api/skills.py`, all TWELVE routes of it, is UNGATED. So
  // creating, uploading and editing a skill has always been open to a member at the API
  // while the only door to it was hidden from them.
  //
  // The operator put it plainly: *"skills, we should have it absent? At least to upload a
  // skill or create a skill."* Same shape as the Settings entry two lines down: one
  // feature key gating a whole HOME whose scope grew past the feature.
  //
  // ⚠ The Studio itself stays gated where it already is — at its own API, and at the
  // entry point on `SkillsPage` (`onOpenStudio`), which is a separate `ActiveView` and is
  // deliberately NOT in this array.
  { view: "skills", icon: Zap, label: "Skills" },
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
  // ⛔ HIDE ONLY WHAT IS *KNOWN* TO BE DENIED. `=== true` WAS WRONG, AND THE OPERATOR HIT IT.
  //
  // Reported 2026-09-09: *"sometimes when I refresh, settings and control room does not load"*,
  // with a screenshot showing a rail carrying Chat / Library / Classification / Connections /
  // Skills and NO Workflows, Settings or Control Room — then all of them present on the next
  // render.
  //
  // `App.tsx` already computes `featuresLoading` and this filter never saw it, so while the
  // effective-features fetch was in flight (or after it FAILED) every governed key read
  // `undefined`, `undefined === true` is false, and every governed door vanished. **"We have not
  // been told yet" was rendered as "you are not allowed."** A transient network failure was
  // therefore indistinguishable from a permission decision — the same unknown-vs-denied confusion
  // `sourceCapability.ts` and `SourceRegistry` each carry a comment about.
  //
  // ⚠ THE DIRECTION IS DELIBERATE, AND IT IS THE OPPOSITE OF `sourceCapability.ts`'s. That
  // predicate fails CLOSED because offering a source that cannot be read is a dead control a
  // person blames themselves for. This one fails OPEN because **the API is the wall** — this
  // module's own header says so: *"Render-only; the API is the wall."* Every governed route
  // enforces its own `require_visible`, so an optimistic door costs at worst one honest refusal,
  // while a hidden door costs a person their Settings page for no reason they can see.
  //
  // ⚠ A KNOWN `false` STILL HIDES, so the dead-click avoidance these entries were tagged for is
  // untouched: only `undefined` — unknown, loading, or failed — now shows.
  return NAV_ITEMS.filter((item) => !item.feature || features[item.feature] !== false)
}

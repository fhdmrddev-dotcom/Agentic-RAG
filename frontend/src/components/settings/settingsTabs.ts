/**
 * Phase 283-01 (FIX-01 / D-03, D-14) — ONE HOME FOR THE SETTINGS TAB IDS, AUDIENCES AND FALLBACK.
 *
 * This is the tab-REGISTRATION seam the G-5 hot-file ledger recorded as OWED on
 * `pages/SettingsPage.tsx`. Before it, the page spelled the rule inline — a `MODEL_TABS` array, a
 * `RETIRED_TABS` array and a ternary that hardcoded `"3"` — so adding a tab, or changing who sees
 * one, meant editing a 1,849-line G-5-firing form page in three places that had to agree.
 * The page now asks two questions here: *is this tab visible to this caller?*
 * (`isSettingsTabVisible`) and *which tab does this persisted choice land on?* (`resolveSettingsTab`).
 *
 * ⚠ WHY THIS IS ITS OWN `.ts` MODULE RATHER THAN EXPORTS FROM `SettingsPage.tsx`.
 *   Exporting non-components from a component file trips `react-refresh/only-export-components`
 *   and breaks Fast Refresh for the whole form page (the `settingsSearchPayload.ts` precedent,
 *   measured at Phase 242's review). No React import here, by design.
 *
 * ⚠ THE LABELS ARE NOT RENDERED FROM HERE, AND THAT IS DELIBERATE (orchestrator ruling 2 /
 *   283-RESEARCH Option A). `scripts/check-docs-coverage.cjs` (via `scripts/lib/docs-content.cjs`)
 *   and `scripts/check-landing-drift.cjs` both scrape the LITERAL `<TabsTrigger>` labels out of
 *   `SettingsPage.tsx` in SOURCE order. A `{SETTINGS_TABS.map(...)}` strip would leave them nothing
 *   to read and turn both CI gates red. So the strip stays literal JSX; this registry owns id /
 *   audience / order / fallback only, and `__tests__/settingsTabs.test.ts` fences the literal
 *   trigger order against `SETTINGS_TABS` so the two cannot drift apart. `name` below is a
 *   test/doc handle, never rendered.
 *
 * ⚠ IT TAKES THE FAIL-CLOSED BOOLEAN, NEVER THE FEATURES MAP. The page computes
 *   `canManageModels = featuresCtx?.features.model_management === true` — false while the map is
 *   loading, absent, or errored. Passing the boolean keeps that fail-CLOSED decision in one place;
 *   handing this module the map would invite a second, possibly fail-open, reading of it (the
 *   `lib/nav-items.ts` filter is the SHAPE copied here, not its direction). The API's
 *   `require_visible` remains the authority — this decides UI reach only.
 */

/** Who may see a tab. `model_management` is the governed feature key the page reads. */
export type SettingsTabAudience = "everyone" | "model_management"

export interface SettingsTabDef {
  /** The routing key `<Tabs value>` uses. Never renumbered (Phase 190-16), never reused (D-03). */
  id: string
  audience: SettingsTabAudience
  /** A test/doc handle. ⚠ NOT rendered — the strip's labels are literal JSX (see header). */
  name: string
}

/** Every Settings tab, in STRIP ORDER — the order the literal `<TabsTrigger>`s must follow. */
export const SETTINGS_TABS: readonly SettingsTabDef[] = [
  { id: "0", audience: "model_management", name: "AI Model" },
  { id: "1", audience: "model_management", name: "Search & Retrieval" },
  { id: "2", audience: "model_management", name: "Integrations" },
  // ← 283-02 (D-04) inserts Preferences "6" HERE, between Integrations and Memory.
  { id: "3", audience: "everyone", name: "Memory" },
  { id: "4", audience: "everyone", name: "Audit Log" },
]

/**
 * Ids that once named a tab and no longer do. ⛔ NEVER REUSE ONE (D-03): a user who last used the
 * tab still has the id persisted, and reusing it would land them on an unrelated panel.
 * "5" was Connections, moved to its own page (`pages/ConnectionsPage.tsx`) on 2026-09-01.
 */
export const RETIRED_SETTINGS_TABS: readonly string[] = ["5"]

/**
 * The localStorage key holding the caller's last-used tab.
 * ⚠ `EmbeddingModelCard.tsx` also writes this key (to send the operator to the Search tab); it is
 *   left alone by this phase, so the key's value must not change.
 */
export const SETTINGS_TAB_STORAGE_KEY = "settings_active_tab"

function byId(id: string): SettingsTabDef | undefined {
  return SETTINGS_TABS.find((t) => t.id === id)
}

function audienceAllows(tab: SettingsTabDef, canManageModels: boolean): boolean {
  return tab.audience === "everyone" || canManageModels
}

/** The tabs this caller sees, in strip order. */
export function visibleSettingsTabs(canManageModels: boolean): readonly SettingsTabDef[] {
  return SETTINGS_TABS.filter((t) => audienceAllows(t, canManageModels))
}

/**
 * Whether the tab with `id` is shown to this caller. False for a retired id, false for a governed
 * tab when `canManageModels` is false, false for an id the registry does not know.
 */
export function isSettingsTabVisible(id: string, canManageModels: boolean): boolean {
  if (RETIRED_SETTINGS_TABS.includes(id)) return false
  const tab = byId(id)
  return tab !== undefined && audienceAllows(tab, canManageModels)
}

/**
 * Where a persisted choice the caller can no longer use lands.
 *
 * Today this is the FIRST `everyone` tab ("3", Memory) for BOTH roles — reproducing the page's
 * hardcoded `"3"` exactly. ⚠ 283-02 (D-05) switches it to the caller's first VISIBLE tab, which
 * moves an operator's fallback to "0"; `settingsTabs.test.ts` pins today's value so that change is
 * a visible, deliberate edit rather than a silent one.
 */
export function settingsTabFallback(canManageModels: boolean): string {
  void canManageModels // today's rule does not depend on the role; 283-02 makes it.
  const first = SETTINGS_TABS.find((t) => t.audience === "everyone")
  // The registry always declares at least one `everyone` tab; "3" mirrors the page's old literal.
  return first?.id ?? "3"
}

/**
 * The tab a persisted choice resolves to for this caller.
 *
 * - nothing persisted → "0" (the page's historical starting point; a member is then redirected)
 * - a retired id → the fallback, for BOTH roles (an operator with "5" persisted needs it too)
 * - a known governed tab and `!canManageModels` → the fallback
 * - anything else → passed through unchanged
 *
 * ⚠ AN UNKNOWN ID PASSES THROUGH — exactly as the page did at PHASE_BASE, where the ternary only
 *   redirected "5" and the governed ids. That selects a `TabsContent` that does not exist (an empty
 *   panel; no data is reachable through it). It is reproduced here, not endorsed: 283-02 (D-05)
 *   is the plan that redirects unknown ids too.
 */
export function resolveSettingsTab(persisted: string | null, canManageModels: boolean): string {
  const id = persisted ?? "0"
  if (RETIRED_SETTINGS_TABS.includes(id)) return settingsTabFallback(canManageModels)
  const tab = byId(id)
  if (tab !== undefined && !audienceAllows(tab, canManageModels)) {
    return settingsTabFallback(canManageModels)
  }
  return id
}

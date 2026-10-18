# Phase 283: Every Member Reaches Their Own Settings - Pattern Map

**Mapped:** 2026-10-15 (HEAD `65bd6e5ea`, branch `develop`)
**Files analyzed:** 22 (5 new source/test, 6 modified source, 11 modified tests/docs/gates)
**Analogs found:** 22 / 22 (every new file has an in-repo analog; nothing falls back to RESEARCH-only)

All line numbers below were read in this session. Where a number differs from CONTEXT/RESEARCH, the
number here is the measured one.

## File Classification

| New/Modified File | Plan | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `frontend/src/components/settings/settingsTabs.ts` (NEW) | 283-01 | utility (pure registry) | transform | `frontend/src/pages/settingsSearchPayload.ts` (pure `.ts` split out of SettingsPage) + `frontend/src/lib/nav-items.ts` (`NAV_ITEMS` + `visibleNavItems`) | exact (two halves) |
| `frontend/src/components/settings/AuditLogSection.tsx` (NEW, moved) | 283-01 | component | request-response (GET `/audit-logs`) | `frontend/src/components/settings/MemorySection.tsx` | exact (sibling file, same tab-body role) |
| `frontend/src/components/settings/__tests__/settingsTabs.test.ts` (NEW) | 283-01 / 02 | test (pure) | transform | `frontend/src/lib/nav-items.test.ts`, `frontend/src/lib/__tests__/navItemsConnections.test.ts` | exact |
| `frontend/src/pages/SettingsPage.tsx` (MOD) | 283-01, 283-02 | page | request-response | itself (tab strip :1151-1168, guard :631-659, Reset :1017-1023 / :1111-1116) | n/a (self) |
| `frontend/src/components/settings/PreferencesSection.tsx` (NEW, recommended) | 283-02 | component | localStorage + request-response (`/me/preferences`) | `MemorySection.tsx` (shape) + `SettingsPage.tsx:1172-1194` (the markup that moves verbatim) | exact |
| `frontend/src/lib/nav-items.ts` (MOD) | 283-02 | config (nav registry) | transform | itself, entries `connections` (:42-58) / `skills` (:59-76) / `experts` (:77-111) | exact (in-file precedent) |
| `frontend/src/pages/__tests__/SettingsPage.member283.test.tsx` (NEW) | 283-02 | test (component) | request-response (mocked) | `frontend/src/pages/SettingsPage.test.tsx` :15-79, :247-330 | exact |
| `frontend/src/pages/SettingsPage.test.tsx` (MOD, 2 cases) | 283-02 | test | — | itself :313-329 | self |
| `frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx` (MOD) | 283-02 | test | — | itself :153, :216-221 | self |
| `frontend/src/lib/__tests__/navItemsConnections.test.ts` (MOD, flip 1 case) | 283-02 | test | — | itself :51-56 | self |
| `backend/tests/unit/test_283_settings_two_role_fence.py` (NEW) | 283-02 | test (API, real gate) | request-response | `backend/tests/unit/test_249_unverified_at_pick_time.py` :23-74 (pool-patching `_prime`) | exact |
| `backend/tests/unit/test_283_settings_route_inventory.py` (NEW) | 283-02 | test (introspection) | transform | `backend/tests/test_148_carveouts.py` :19-47 (`_flat_dep_calls`) | exact (but the analog lives OUTSIDE the unit gate) |
| `frontend/src/landing/facts.ts` (MOD) | 283-02 | config (facts) | — | itself :193-198 | self |
| `frontend/src/landing/__tests__/facts.test.ts` (MOD) | 283-02 | test | — | itself :55 | self |
| `docs/public/use/choosing-a-model.md` (MOD frontmatter) | 283-02 | docs | — | `docs/public/use/memory.md:8` (`covers: [..., settings-tab:memory]`) | exact |
| `docs/public/get-started/navigating-syrel.md`, `use/memory.md`, `security/audit-trails.md` (MOD prose) | 283-02 | docs | — | n/a (prose rewrite) | — |
| `scripts/vitest-count-gate.cjs` (MOD, 2 knobs) | 283-01/02/03 | config (gate) | — | itself :1743-1749 (BASELINE), :4870-4891 (TARGETS) | self |
| `docs/HOT-FILE-LEDGER.md` + CLAUDE.md scan list rows (MOD) | all | docs (ledger) | — | `## frontend/src/pages/settingsSearchPayload.ts` :7277-7296 + scan-list row :11202 | exact |
| `frontend/src/components/metadata/DocumentChunksSection.tsx` (MOD) | 283-03 | component | request-response (lazy read) | `DocumentConversationSection.tsx:120` (`<ol max-h-72 overflow-y-auto aria-label>`) + `src/docs/components/Markdown.tsx:125` (`role="region" tabIndex={0}`) | exact |
| `frontend/src/components/metadata/__tests__/DetailSections.lazy.test.tsx` (MOD, extend) | 283-03 | test | — | itself, `describe("Chunks section …")` :296-367 | self |

---

## Pattern Assignments

### `frontend/src/components/settings/settingsTabs.ts` (utility, pure registry) — 283-01

**Analog A — why it is a `.ts` module, not exports from the page:** `frontend/src/pages/settingsSearchPayload.ts:18-23`
```ts
 * ⚠ WHY THIS IS ITS OWN MODULE RATHER THAN THREE EXPORTS FROM `SettingsPage.tsx`.
 *   It was written there first. Exporting non-components from a component file trips
 *   `react-refresh/only-export-components` and **breaks Fast Refresh for a 1,858-line form page** —
```
Copy: the header-comment convention (one `⚠ WHY` block naming the constraint), plain named exports,
type-only imports, no React import. `SettingsPage.tsx:59-65` is the import idiom the page already
uses for that module (`import { … } from "./settingsSearchPayload"`); for the new file use the alias
form `import { … } from "@/components/settings/settingsTabs"` like every other `components/settings/*`
import at `SettingsPage.tsx:27-47`.

**Analog B — a readonly registry + a pure filter over it:** `frontend/src/lib/nav-items.ts:19-30, 128-153`
```ts
export interface NavItem {
  view: ActiveView
  icon: typeof MessageSquare
  label: string
  feature?: GovernedFeature
}

export const NAV_ITEMS: readonly NavItem[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  ...
] as const

export function visibleNavItems(features: EffectiveFeatures): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.feature || features[item.feature] !== false)
}
```
⚠ **Copy the SHAPE, not the predicate's direction.** `visibleNavItems` fails OPEN (`!== false`);
the settings registry must fail CLOSED exactly as the page does today
(`SettingsPage.tsx:607`: `featuresCtx?.features.model_management === true`). The registry function
takes the already-computed boolean `canManageModels`, so the direction stays decided in ONE place.

**Behaviour the registry must reproduce in wave 1** — the current guard, `SettingsPage.tsx:631-659`:
```ts
  const [activeTab, setActiveTab] = useState<string>(
    () => localStorage.getItem("settings_active_tab") ?? "0",
  )
  ...
  const MODEL_TABS = ["0", "1", "2"]
  const RETIRED_TABS = ["5"]
  const effectiveTab =
    RETIRED_TABS.includes(activeTab) ||
    (!canManageModels && MODEL_TABS.includes(activeTab))
      ? "3"
      : activeTab

  function handleTabChange(value: string) {
    setActiveTab(value)
    localStorage.setItem("settings_active_tab", value)
  }
```
⚠ **Measured fidelity detail the planner must decide on:** today an UNKNOWN persisted id (e.g. `"9"`,
or `"6"` before 283-02 lands) is NOT redirected — it passes through to a blank panel. A wave-1
`resolveSettingsTab` that redirects unknown ids is a (harmless) behaviour change no existing case
asserts either way. Either reproduce it exactly (retired → `"3"`; governed-and-not-manager → `"3"`;
else pass through) and fix unknown in 283-02 under D-05, or redirect unknown in wave 1 and say so in
the SUMMARY. Do not leave it implicit. The default for no persisted value stays `"0"` in wave 1 (an
operator's landing); for a member `"0"` is governed and resolves to the fallback.

Recommended export set (RESEARCH Pattern 1, verified against the guard above): `SETTINGS_TABS`
(`{ id, audience, name }`, order = strip order), `RETIRED_SETTINGS_TABS = ["5"]`,
`SETTINGS_TAB_STORAGE_KEY = "settings_active_tab"` (also written by `EmbeddingModelCard.tsx:93` —
leave that writer alone), `visibleSettingsTabs(canManageModels)`, `isSettingsTabVisible(id, canManageModels)`,
`resolveSettingsTab(persisted, canManageModels)`.

---

### `frontend/src/components/settings/AuditLogSection.tsx` (component, request-response) — 283-01

**Analog:** `frontend/src/components/settings/MemorySection.tsx` (sibling tab body, already extracted).

**Imports pattern** (`MemorySection.tsx:1-13`) — one React import line, `@/` aliases, shadcn `Card*` + `Button`, lucide icons in one line:
```ts
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
...
import { Brain, Loader2, Pencil, Trash2, Check, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
```
**Export pattern** (`MemorySection.tsx:23`): `export function MemorySection() {` — a named export, no default, no props.
Consumed at `SettingsPage.tsx:27` as `import { MemorySection } from "@/components/settings/MemorySection"`.

**What moves, verbatim:** `SettingsPage.tsx:377-582` — the `// ── Audit Log Section ──` banner,
`SINCE_OPTIONS` (:379-384), `ACTION_TYPES` (:386-390), `formatBytes` (:392-396), `formatTimestamp`
(:398-407), `formatDetails` (:409-437), and `function AuditLogSection()` (:439-582). Only change on the
move: `function AuditLogSection()` → `export function AuditLogSection()`. The helpers stay
module-private (non-exported), so `react-refresh/only-export-components` stays clean.

**Its imports, derived from what the moved block uses:**
```ts
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getAuditLogs, exportAuditLogs } from "@/lib/api"          // ⚠ the BARREL, not @/lib/api/settings
import type { AuditEntry } from "@/lib/api"
import { Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
```
⚠ Import from `@/lib/api`, never `@/lib/api/settings`: all four SettingsPage suites mock the barrel
(`SettingsPage.test.tsx:30-39` mocks `getAuditLogs` / `exportAuditLogs` on `"@/lib/api"`); a direct
submodule import silently escapes the mock.

**SettingsPage.tsx cleanup after the move** (`noUnusedLocals: true`): line 23 drops `getAuditLogs, exportAuditLogs`;
line 24 drops `AuditEntry`; line 25 drops `Download, ChevronLeft, ChevronRight` (keep `Loader2`, used
by the save buttons e.g. :1812). Add `import { AuditLogSection } from "@/components/settings/AuditLogSection"`
beside the MemorySection import at :27. Mount site unchanged (`SettingsPage.tsx:1826-1831`):
```tsx
          <TabsContent value="4">
            <div className="bg-card/50 ghost-border rounded-xl p-6">
              <AuditLogSection />
            </div>
          </TabsContent>
```

---

### `frontend/src/pages/SettingsPage.tsx` (page) — 283-01 seam, 283-02 Preferences

**Tab strip, as it stands** (`SettingsPage.tsx:1151-1168`):
```tsx
          <TabsList className="mb-6 flex h-auto w-full gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
            {canManageModels && <TabsTrigger className={SETTINGS_TAB_CLASS} value="0">AI Model</TabsTrigger>}
            {canManageModels && <TabsTrigger className={SETTINGS_TAB_CLASS} value="1">{retrievalTabLabel}</TabsTrigger>}
            {canManageModels && <TabsTrigger className={SETTINGS_TAB_CLASS} value="2">Integrations</TabsTrigger>}
            {/* ⚠ CONNECTIONS IS NO LONGER A TAB HERE … */}
            <TabsTrigger className={SETTINGS_TAB_CLASS} value="3">Memory</TabsTrigger>
            <TabsTrigger className={SETTINGS_TAB_CLASS} value="4">Audit Log</TabsTrigger>
          </TabsList>
```
**Pattern to apply (Option A):** keep every `<TabsTrigger …>Label</TabsTrigger>` LITERAL; replace only the
guard expression (`canManageModels &&` → `isVisible("0") &&` or equivalent registry call). 283-02 inserts
`<TabsTrigger className={SETTINGS_TAB_CLASS} value="6">Preferences</TabsTrigger>` **between the
Integrations line and the Memory line in the source text**, because both extractors read source order.

⚠ **Extractor constraints (measured, `scripts/lib/docs-content.cjs:727-735`, `scripts/check-landing-drift.cjs:237-252`):**
```js
const tabsBlock = /<TabsList[^>]*>([\s\S]*?)<\/TabsList>/.exec(tabsSrc);
for (const m of tabsBlock[1].matchAll(/<TabsTrigger[^>]*>([\s\S]*?)<\/TabsTrigger>/g)) {
  const label = m[1].trim();
  tabs.push(label.includes('retrievalTabLabel') ? 'search' : slugifyLabel(label));
```
- `<TabsTrigger[^>]*>` stops at the first `>`: **no `=>` or `>` may appear inside a trigger's props**
  (e.g. no `onClick={() => …}` on a trigger). Guard expressions sit OUTSIDE the tag, which is fine.
- The retrieval label must keep the identifier `retrievalTabLabel` as the trigger child (both scripts key on the substring).
- `{tabs.map(...)}` inside `TabsList` yields one bogus label and trips `MIN_SETTINGS_TAB = 3` (harness error, exit 2).

**Content blocks:** `<TabsContent value="0">` opens at :1171, closes :1480; `"1"` :1483-1734; `"2"`
:1737-1817; `"3"` :1820-1824; `"4"` :1827-1831. 283-02 wraps the three operator blocks in the same
visibility guard (RESEARCH Pitfall 9), and adds `"6"` using the Memory wrapper shape plus the
UI-SPEC's `space-y-6`:
```tsx
          <TabsContent value="6">
            <div className="bg-card/50 ghost-border rounded-xl p-6 space-y-6">
              <PreferencesSection />
            </div>
          </TabsContent>
```

**Blocks that MOVE out of tab `"0"` in 283-02** (`SettingsPage.tsx:1173-1194`, byte-identical markup):
```tsx
              <div className="flex items-center justify-between gap-4 rounded-lg ghost-border bg-muted/20 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Show technical names</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Reveal the raw field, model, and status names alongside the plain labels — everywhere in the app.
                  </p>
                </div>
                <TechnicalNamesToggle enabled={showTechnical} onToggle={toggleTechnical} />
              </div>
              ...
              <ModelDefaultPreference />
```
The Phase 154 comment above it (:1173-1177, "so every user can reach it (SC#3)") is FALSE and is
rewritten, not carried. After the move, these become unused in the page and must be removed:
`SettingsPage.tsx:47` (`ModelDefaultPreference`), :55 (`TechnicalNamesToggle`), :56 (`useTechnicalNames`),
:619 (`const { showTechnical, toggle: toggleTechnical } = useTechnicalNames()`); the comment block
:613-618 above it is rewritten (`usePlainLabel` at :620-621 stays).

**Reset button (D-06)** — today, `SettingsPage.tsx:1111-1116` and handler :1017-1023:
```tsx
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
```
```ts
  const handleReset = () => {
    if (s) {
      if (activeTab === "0" || window.confirm("Reset all unsaved changes across all tabs?")) {
```
Pattern: wrap the `<Button>` in `{canManageModels && (…)}` — the same guard idiom as the triggers.
⚠ `handleReset` compares `activeTab === "0"` (raw state, not `effectiveTab`); leave as-is (operator-only path).

**Zero gated calls (D-07)** — the existing skip to keep, `SettingsPage.tsx:867-877`:
```ts
  useEffect(() => {
    if (featuresLoading) return
    if (!canManageModels) {
      setLoading(false)
      return
    }
    getSettings()
```
`getReembedProgress` is called only in `handleSaveSearch` (:982, tab 1) and by `ReembedStatusCard`
(mounted in tab 1, :1543). `JudgeModelPicker` → `getJudgeModel()` → `getSettings()`
(`lib/api/settings.ts:54`) is a hidden caller in tab 0. All three are operator-only by virtue of
tabs `"0"`/`"1"` — Pitfall 9's guard makes it structural.

---

### `frontend/src/components/settings/PreferencesSection.tsx` (component) — 283-02

**Analog:** `MemorySection.tsx` (shape: named export, no props, owns its own hooks) + the moved markup above.
```tsx
import { TechnicalNamesToggle } from "@/components/admin/TechnicalNamesToggle"
import { useTechnicalNames } from "@/providers/TechnicalNamesProvider"
import { ModelDefaultPreference } from "@/components/settings/ModelDefaultPreference"

export function PreferencesSection() {
  const { showTechnical, toggle: toggleTechnical } = useTechnicalNames()
  return (
    <>
      {/* the toggle row, verbatim from SettingsPage.tsx:1178-1186 */}
      <ModelDefaultPreference />
    </>
  )
}
```
Exports verified: `TechnicalNamesToggle({ enabled, onToggle })` (`TechnicalNamesToggle.tsx:22`),
`useTechnicalNames()` (`TechnicalNamesProvider.tsx:90`, THROWS outside its provider — every render
in tests must wrap in `TechnicalNamesProvider`, as `SettingsPage.test.tsx:71-73` does),
`ModelDefaultPreference()` (`ModelDefaultPreference.tsx:27`, imports `getModelDefault, setModelDefault`
from the `@/lib/api` barrel). No section heading (UI-SPEC decision). Returns a fragment so the
`space-y-6` wrapper in the page spaces the two blocks.

---

### `frontend/src/lib/nav-items.ts` (config) — 283-02

**Change:** `nav-items.ts:112-115`
```ts
  // Phase 148 (VIS-01): governed by `model_management` (Operators-only on the day-one
  // map) — vanishes for a non-operator; the chat model picker (GET /settings/providers)
  // is an ungated Run carve-out (148-05), so chat/run never breaks by hiding Settings.
  { view: "settings", icon: Settings, label: "Settings", feature: "model_management" },
```
→ drop `feature: "model_management"` (the property must be ABSENT, not `undefined`: the existing
experts fence uses `hasOwnProperty`, `nav-items.test.ts`).

**Comment pattern to copy (the "UNGOVERNED, AND DELIBERATELY SO" form):** `nav-items.ts:85-95` (experts):
```ts
  // ⚠ UNGOVERNED, AND THE REASON IS MEASURED RATHER THAN ASSUMED — …
  // … The precedent is `connections` four lines up — ungoverned
  // by design, pinned by `navItemsConnections.test.ts` — and `visibleNavItems` below has been
  // fail-OPEN since 2026-09-09 for exactly this reason: the API is the wall, …
```
And the "kept rather than deleted" convention for superseded reasoning (`nav-items.ts:59-68`, skills:
*"The note this replaces is preserved because its reasoning was sound and its SCOPE was not"*).

**Stale comment to rewrite (D-01):** `nav-items.ts:42-57` — specifically :49-53, which says un-tagging
Settings *"is the WRONG fix"* and cites stale `api/settings.py:331,341` (measured today: gated routes at
`settings.py:578, 587, 1004, 1033`; carve-out `/providers` at :1067). Follow the in-file convention:
keep the original sentence visible and mark it superseded with the date/phase, then state the new truth
(per-tab gating inside the page + per-route `require_visible` at the API).

---

### `backend/tests/unit/test_283_settings_two_role_fence.py` (test, real gate) — 283-02 (D-10)

**Analog:** `backend/tests/unit/test_249_unverified_at_pick_time.py` — it is in `tests/unit/` (inside the
71-failed baseline gate) and drives `/settings/providers` through the patched pool with zero mutation.

**Imports + fixtures + caches** (`test_249…:23, 37-74`):
```python
import app.models.user_settings as us

_SETTINGS_ROW = {
    "id": "global",
    "llm_provider": "openai",
    "llm_model": "gpt-4o",
    "openai_api_key": "sk-test",
    "provider_model_lists": {
        "openai": ["gpt-4o", "my-db-only-model", "llama-4-scout-local"],
    },
}

def _reset_caches():
    us._settings_cache = None
    us._settings_cache_time = 0.0
    us._model_overrides_cache = {}
    us._model_overrides_cache_time = 0.0
    us._all_model_overrides_cache = {}
    us._all_model_overrides_cache_time = 0.0


def _prime(monkeypatch, pool, override_rows, settings_row=None):
    monkeypatch.setattr("app.dependencies._pg_pool", pool)
    pool.set_fetchrow_result(settings_row if settings_row is not None else _SETTINGS_ROW)
    pool.set_fetch_result(override_rows)
    _reset_caches()


def _get_providers(client, auth_headers):
    res = client.get("/settings/providers", headers=auth_headers)
    assert res.status_code == 200, res.text
    return res.json()
```
Test signature idiom: `def test_x(client, auth_headers, mock_asyncpg_pool, monkeypatch):` (`test_249…:68`).

**The seam the real decision runs through** (`backend/app/services/operator_service.py:31-46`):
```python
async def is_operator(user_id: str) -> bool:
    """… Kept a small seam so tests drive
    BOTH branches by patching ``app.dependencies._pg_pool`` -> ``mock_asyncpg_pool``
    (``set_fetchrow_result(None)`` -> non-operator; ``set_fetchrow_result({...})``
    -> operator). Pitfall 6: the supabase builder mock has NO effect on this path.
    """
    from app.dependencies import get_pg_pool
    pool = await get_pg_pool()
    row = await pool.fetchrow(
        "SELECT 1 FROM operator_users WHERE user_id = $1", user_id
    )
    return row is not None
```
⚠ The documented seam uses ONE sticky `fetchrow` result, but `/settings` also reads the `app_settings`
row through `fetchrow`. So the operator read must be routed **on the SQL text + user id** (RESEARCH
Pattern 2 wraps `pool._conn.fetchrow`). The mock connection's `fetchrow` (`conftest.py:497-505`)
records `(sql, args)` on `pool.calls` and returns the queued/sticky value — wrap it, keep the recording:
```python
    async def fetchrow(self, sql, *args):
        self._pool.calls.append((sql, args))
        if self._pool._fetchrow_results:
            return self._pool._fetchrow_results.pop(0)
        return self._pool._fetchrow_result
```
**Identity injection** — the canonical override and its auto-restore (`conftest.py:133, 147-166`):
```python
app.dependency_overrides[get_current_user] = lambda: mock_user_data
...
@pytest.fixture(autouse=True)
def reset_mocks():
    ...
    app.dependency_overrides[get_current_user] = lambda: mock_user_data
```
So a test sets `app.dependency_overrides[get_current_user] = lambda: {"id": MEMBER, "email": …}` and
needs no teardown of its own. `_reset_pg_pool_singleton` (`conftest.py:284-299`, autouse) resets
`app.dependencies._pg_pool` between tests.

**The decision under test** (`backend/app/dependencies.py:622-648`) — runs UNMOCKED:
```python
async def feature_visible(request: Request, current_user: dict, feature: str) -> bool:
    if await is_operator(current_user["id"]):
        return True  # operator -> no-op
    from app.models.user_settings import (
        ensure_settings_fresh,
        feature_audience,
        resolve_feature_access,
    )
    await ensure_settings_fresh()
    audience = feature_audience(feature)
    if audience == "everyone":
        return True
    if audience == "role":
        ...
    return False
```
⚠ **Anti-pattern (D-10 explicitly rejects):** the `operator_override` fixture (`conftest.py:250-271`,
overrides `require_operator`) and the `test_148_require_visible.py` style that patches the gate.
For `/audit-logs` owner scoping, use the shared `mock_builder` fixture (`conftest.py:244-247`;
`_builder.eq.return_value = _builder` at :195) and assert `mock_builder.eq` was called with `("user_id", MEMBER)`.
Planting RED: strip `require_visible` from `GET /settings` (not from `/settings/reembed-progress`, which
crashes under the mock — RESEARCH Pattern 2).

---

### `backend/tests/unit/test_283_settings_route_inventory.py` (test, introspection) — 283-02 (D-11)

**Analog:** `backend/tests/test_148_carveouts.py:19-47` (⚠ lives in `tests/` root — OUTSIDE the unit gate; the new file goes in `tests/unit/`).
```python
def _flat_dep_calls(route):
    """Every dependency callable in a route's dependant tree (flattened, incl. sub-deps)."""
    calls = []
    dependant = getattr(route, "dependant", None)
    if dependant is None:
        return calls
    stack = list(getattr(dependant, "dependencies", []))
    while stack:
        d = stack.pop()
        call = getattr(d, "call", None)
        if call is not None:
            calls.append(call)
        stack.extend(getattr(d, "dependencies", []))
    return calls


def _has_require_visible(route):
    for call in _flat_dep_calls(route):
        if "require_visible" in getattr(call, "__qualname__", ""):
            return True
    return False
```
Module-scan idiom to copy (`test_148_carveouts.py:85-95`):
```python
    from app.main import app
    for r in app.routes:
        endpoint = getattr(r, "endpoint", None)
        if getattr(endpoint, "__module__", "") == "app.api.threads":
```
Extend `_has_require_visible` to READ the feature out of the closure (`__code__.co_freevars` +
`__closure__`, RESEARCH Pattern 3), so a route gated on the WRONG feature also fails. Inventory =
union of `endpoint.__module__ == "app.api.settings"` and `path == "/settings" or path.startswith("/settings/")`;
allow-list `{("GET", "/settings/providers")}`; non-vacuity floors (≥ 5 routes, exactly 4 gated).
Gated decorator shape being detected (`backend/app/api/settings.py:587-590`):
```python
@router.put(
    ...
    dependencies=[Depends(require_visible("model_management"))],  # Phase 148 (VIS-01) — model_management gate
```
Permanent detector self-test: a throwaway `APIRouter(prefix="/settings")` with one gated + one ungated
route (import `require_visible` from `app.dependencies`, as `settings.py:13` does).

---

### `frontend/src/pages/__tests__/SettingsPage.member283.test.tsx` (test) — 283-02 (D-12 b-d)

**Analog:** `frontend/src/pages/SettingsPage.test.tsx`.

**Mock idiom** (`SettingsPage.test.tsx:16-45`):
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"

const { mockGetSettings, mockUpdateSettings, mockGetReembedProgress, mockGetAuditLogs } =
  vi.hoisted(() => ({ … }))

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, getSettings: mockGetSettings, … , exportAuditLogs: vi.fn() }
})

vi.mock("@/components/settings/MemorySection", () => ({ MemorySection: () => null }))
vi.mock("@/components/settings/ReembedStatusCard", () => ({ ReembedStatusCard: () => null }))
```
**Render helpers** (`SettingsPage.test.tsx:67-79`):
```tsx
function renderSettings(features: Record<string, boolean> = { model_management: true }) {
  return render(
    <EffectiveFeaturesProvider value={{ features, loading: false, refetch: () => {} }}>
      <TechnicalNamesProvider>
        <SettingsPage />
      </TechnicalNamesProvider>
    </EffectiveFeaturesProvider>,
  )
}
function renderAsMember() {
  return renderSettings({})
}
```
⚠ For the new suite, render the member with the REAL `/features` shape `{ model_management: false }`
(RESEARCH anti-pattern: `{}` means "not told yet"). `{}` still resolves member on this page
(`=== true`), but use the explicit shape so the fixture says what it means.
Gated spies to mock: `getSettings, updateSettings, getReembedProgress, kickReembed, getJudgeModel,
setJudgeModel, getEngineHealth, runEngineSweep`; allowed: `getModelDefault, setModelDefault,
getAuditLogs, exportAuditLogs`. **Positive control** = operator render asserts `getSettings` called
(precedent: `SettingsPage.test.tsx:292-299`). Assertion style to copy — content by role/name +
`aria-selected` (`SettingsPage.test.tsx:313-320`):
```tsx
    expect(await screen.findByRole("tab", { name: /memory/i })).toHaveAttribute("aria-selected", "true")
```
Tab-order assertion: `screen.getAllByRole("tab").map(t => t.textContent)` against
`["Preferences","Memory","Audit Log"]` (member) / six labels (operator; Search tab label is "Search"
by default via `usePlainLabel`, "Search & Retrieval" only under the reveal).

**Existing cases that change in 283-02 (edit in place, keep history comments):**
- `SettingsPage.test.tsx:313-320` "lands an operator with a persisted Connections tab on Memory…" → AI Model.
- `SettingsPage.test.tsx:322-329` "lands a member with a persisted Connections tab on Memory" → Preferences.
- `SettingsPage.a11y.test.tsx:153` `localStorage.setItem("settings_active_tab", "0") // AI Model tab — hosts the toggle` → `"6"`; add Preferences to the relabeled-tabs case (:216-221). Count stays 4.

---

### `frontend/src/lib/__tests__/navItemsConnections.test.ts` (test, flip) — 283-02 (D-12 a)

Case to flip in place (`navItemsConnections.test.ts:51-56`):
```ts
  it("still hides the model_management Settings entry from a member", () => {
    const visible = visibleNavItems(MEMBER)
    expect(visible.some((i) => i.view === "settings")).toBe(false)
  })
```
⚠ `MEMBER` is DERIVED (`:32-34`: `NAV_ITEMS.filter((i) => i.feature).map(...)`) — after the un-tag it no
longer carries `model_management`, so pass an explicit `{ ...MEMBER, model_management: false }` in the
flipped case. Count stays 6 (BASELINE pin `navItemsConnections.test.ts: 6`, count-gate :3179).
Ungoverned-entry assertion idiom to copy (`nav-items.test.ts`, experts case):
```ts
    const entry = NAV_ITEMS.find((item) => item.view === "experts")
    expect(entry?.feature).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(entry ?? {}, "feature")).toBe(false)
```

---

### `frontend/src/components/metadata/DocumentChunksSection.tsx` (component) — 283-03 (FIX-08)

**Target:** `DocumentChunksSection.tsx:100-106`
```tsx
      {state === "ready" && rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <ChunkRowView key={row.id} row={row} />
          ))}
        </ul>
      )}
```
**Analog 1 — bounded list in the same panel:** `DocumentConversationSection.tsx:120`
```tsx
      <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto" aria-label="Conversation">
```
**Analog 2 — bounded block in the same panel:** `DocumentContentSection.tsx:160`
```tsx
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/40 bg-background/40 p-3 font-mono text-[0.72rem] leading-relaxed text-foreground">
```
**Analog 3 — keyboard-reachable scroll region:** `frontend/src/docs/components/Markdown.tsx:125`
```tsx
        <div className="d-table-wrap" role="region" aria-label="Table" tabIndex={0}>
```
(⚠ that line is itself one of the 45 inherited `lint:a11y` errors — copy the semantics, ADD the justified
`eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex` comment it lacks.)
**Focus ring idiom from the same file** (`DocumentChunksSection.tsx:85`): `focus:outline-none focus-visible:ring-1 focus-visible:ring-ring`.
**Per-chunk inner bound to leave untouched** (`DocumentChunksSection.tsx:140`): `max-h-32 overflow-auto` — no `tabIndex` on it.
Result shape: UI-SPEC §Interaction 4 / RESEARCH Pattern 5 — wrapper `div` with `role="region"`,
`tabIndex={0}`, `aria-label` = `"Chunk list, {n} chunks"` (singular "1 chunk"), classes
`max-h-96 overflow-y-auto rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ring`;
NO `overscroll-*`. Header comment convention: add a dated FIX-08 / BUG-260908-01 paragraph to the
file's top block (:1-30), which already documents lazy mount and a11y arms.

---

### `frontend/src/components/metadata/__tests__/DetailSections.lazy.test.tsx` (test, extend) — 283-03

Extend `describe("Chunks section — four honest arms and the per-chunk model")` (:296-367). Reuse its
`chunk()` factory (:297-304), the `render(<DocumentDetailPanel doc={makeDoc()} onClose={() => {}} />)`
+ `await screen.findByText("The spec")` + `openSection("Chunks")` sequence (:336-339), and the
`openSection` helper (:123-130). Query the region by role + name:
`screen.getByRole("region", { name: /chunk list, 2 chunks/i })`, assert `toHaveAttribute("tabindex","0")`,
class contains `max-h-96` and `overflow-y-auto`, `className` has no `overscroll`, and the `li`s are
inside it. Count gate: BASELINE pin `"DetailSections.lazy.test.tsx": 14` (count-gate :3561) rises by
the number of cases added, same commit.

---

### Docs / landing facts (same commit as the Preferences trigger) — 283-02

| File | Line | Current | Change |
|---|---|---|---|
| `frontend/src/landing/facts.ts` | 195 | `settings: ["AI Model", "Search & Retrieval", "Integrations", "Memory", "Audit Log"] as const, // admin view; retrieval label is dynamic` | insert `"Preferences"` after `"Integrations"` (must equal the extracted SOURCE order) |
| `frontend/src/landing/__tests__/facts.test.ts` | 55 | `expect(SURFACE_TABS.settings).toHaveLength(5)` | `6` (case count unchanged; pin `"facts.test.ts": 5` at count-gate :431 is the CASE count, not this number) |
| `docs/public/use/choosing-a-model.md` | 8 | `covers: [E20]` | `covers: [E20, settings-tab:preferences]` (pattern: `use/memory.md:8` `covers: [A37, B19, B20, settings-tab:memory]`) |
| `docs/public/get-started/navigating-syrel.md` | 29, 36 | Settings row "People with model management — platform operators by default"; "An operator can change who sees Workflows and Settings…" | Settings now Everyone (personal tabs; operator tabs only for model management) |
| `docs/public/use/memory.md` | 11-13 | "Settings is in the rail for people with model management…" | rewrite |
| `docs/public/security/audit-trails.md` | 22 | `> **Note:** Settings appears in the rail for people with model management… ask your administrator.` | rewrite |
| `.planning/research/docs-coverage-inventory.md` | 35 (and A34-A38 rows :72-76) | "Settings (`model_management`)" | optional: Settings ungoverned; add a Preferences row |

Gate commands: `node scripts/check-docs-coverage.cjs`, `node scripts/check-landing-drift.cjs`.
`docs/public/README.md:64` (the `settings-tab:<slug>` source-of-truth row, floor 3) needs no change under Option A.

---

### Ledger + count gate (all plans)

**Ledger section analog:** `docs/HOT-FILE-LEDGER.md:7277-7296` (`## frontend/src/pages/settingsSearchPayload.ts`) —
"Created … by Phase NNN. … The row is here at CREATION rather than at the third phase, deliberately."
**Scan-list row analog** (`docs/HOT-FILE-LEDGER.md:11202`):
```
| [`frontend/src/pages/settingsSearchPayload.ts`](docs/HOT-FILE-LEDGER.md#frontendsrcpagessettingssearchpayloadts) | 2 / 2 / 116 | no (2 phases) | Created by 242. Row added AT CREATION … |
```
Rows needed (gate-measured in RESEARCH): `DocumentChunksSection.tsx` (1/1/147, absent its entire life),
`settingsTabs.ts`, `AuditLogSection.tsx`, `PreferencesSection.tsx`, `landing/facts.ts` (4/1/546). Disposition
cell ≤ 200 chars in `docs/HOT-FILE-LEDGER.md`; CLAUDE.md FIRING-table cell ≤ 80. `SettingsPage.tsx`
row (:11201, stale at `47 / 24 / 1773`; measured `51 / 26 / 1849`) records "tab seam partially taken
(283-01); per-tab state split OWED" (D-15). Check: `node scripts/check-hot-file-ledger.cjs 283`.

**Count-gate registration** (`scripts/vitest-count-gate.cjs`): BASELINE pins at :1743-1749
(`"SettingsPage.test.tsx": 24`, `"SettingsPage.a11y.test.tsx": 4`, `"SettingsPage.sourceCeiling.test.tsx": 9`,
`"SettingsPage.changedFields.test.tsx": 17`); TARGETS are FILE-level at :4870-4891
(`"src/pages/__tests__/SettingsPage.a11y.test.tsx"`, …). New suites `settingsTabs.test.ts` and
`SettingsPage.member283.test.tsx` get BOTH a TARGETS path entry and a BASELINE pin (bareName key, value
read from the gate's `actual` column), same commit. Check bareName collisions (`settingsTabs.test.ts` is unique today).

---

## Shared Patterns

### Fail-closed feature read (frontend)
**Source:** `frontend/src/pages/SettingsPage.tsx:606-608`
```ts
  const featuresCtx = useEffectiveFeaturesOptional()
  const canManageModels = featuresCtx?.features.model_management === true
  const featuresLoading = featuresCtx?.loading ?? false
```
**Apply to:** SettingsPage tab visibility, Reset gate, operator `TabsContent` guard. The registry
receives `canManageModels`; it never reads the map itself. (Contrast: `visibleNavItems` is fail-OPEN by
design, `nav-items.ts:128-153` — do not unify the two.)

### VANISH, not lock
**Source:** `SettingsPage.test.tsx:278-281` / `nav-items.ts:23-27`. A control the caller cannot use is
ABSENT (no disabled trigger, no badge, no "ask your administrator" copy). Applies to the three operator
tabs and the Reset button.

### Per-route API gate, never router-level
**Source:** `backend/app/api/settings.py:578-590, 1004-1007, 1033-1036` (`dependencies=[Depends(require_visible("model_management"))]`)
and the carve-out comment at :1064 (`# Phase 148 (VIS-01) — RUN CARVE-OUT: DO NOT add require_visible here.`).
**Apply to:** D-11 inventory fence (detects per-route deps); no backend source edit in this phase (D-09).

### Barrel mocking
**Source:** `SettingsPage.test.tsx:30-39`. Every component under test imports API functions from
`@/lib/api`; every test mocks `@/lib/api` with `vi.importActual` spread. Applies to `AuditLogSection.tsx`,
`PreferencesSection.tsx` (via `ModelDefaultPreference`), and the new member283 suite.

### Assert rendered content, not test ids
**Source:** `SettingsPage.test.tsx:332-338` (Phase 241 note quoting Phase 235). Tab names, the toggle
label "Show technical names", "Default chat model", the region's `aria-label`.

### Dated, kept-not-deleted comment corrections
**Source:** `nav-items.ts:59-68` (skills), `SettingsPage.test.tsx:248-265`. When a comment's claim is
now false (nav-items :49-53, SettingsPage :1173-1177 and :613-618, the `navItemsConnections.test.ts`
header :3-12), mark the original superseded with date + phase rather than silently overwriting.

## No Analog Found

None. Every file has an in-repo analog. The one judgment call with no direct precedent is the wave-1
handling of an UNKNOWN persisted tab id (see `settingsTabs.ts` above) — today's code passes it through.

## Metadata

**Analog search scope:** `frontend/src/pages`, `frontend/src/components/settings`, `frontend/src/components/metadata`,
`frontend/src/lib`, `frontend/src/landing`, `frontend/src/docs/components`, `backend/tests` (root + unit),
`backend/app/{api,services,dependencies.py}`, `scripts/` (docs-content, landing-drift, vitest-count-gate), `docs/public`, `docs/HOT-FILE-LEDGER.md`
**Files scanned:** ~30
**Pattern extraction date:** 2026-10-15

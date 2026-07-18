# Phase 149: Model Registry & Discovery - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 17 (7 new, 10 modified) + 9 test files
**Analogs found:** 16 / 17 (1 net-new with only a partial analog: the discovery service)

> This phase is ~70% wiring over already-shipped substrate. Almost every file has a
> STRONG in-repo analog — the planner should copy patterns directly rather than invent.
> The genuinely net-new logic is narrow: (1) the discovery diff, (2) the propose-only
> "unknown — you set it" surface, (3) the `enabled`-enforcement seam, (4) the DB-aware clamp.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/099_model_registry_deprecated.sql` | migration | (schema) | `supabase/migrations/098_feature_visibility.sql` + `053_settings_unification.sql` §2 | exact |
| `backend/app/api/admin.py` (+3 routes) | controller/router | request-response + CRUD | same file (`set_flag`, `set_visibility`, `list_users`) | exact (self) |
| `backend/app/services/model_discovery_service.py` (NEW) | service | request-response (external fan-out) | `scripts/curate_models.py` (fetch/extract/paginate) + `rerank_service.py` (httpx.AsyncClient) | role-match (lift-and-wrap) |
| `backend/app/config.py` (TypedDict + read path) | config/model | CRUD (read overlay) | same file (`get_model_capability_async`, `ModelCapability`) | exact (self) |
| `backend/app/models/user_settings.py` (all-rows read + enforce + invalidate) | model/store | CRUD + cache | same file (`_load_model_overrides`, `_build_providers`, `invalidate_model_overrides_cache`) | exact (self) |
| `backend/app/services/openai_service.py` (`_resolve_max_tokens`) | service | transform (clamp) | same function (Phase 074 single-chokepoint) | exact (self) |
| `backend/app/api/threads.py` (enabled-enforce + fallback notice) | controller | request-response (SSE) | same file (model-resolution seam :1090-1123) | exact (self) |
| `frontend/src/components/admin/ModelRegistryTab.tsx` (NEW) | component | CRUD (instrument table) | `frontend/src/components/admin/FeatureVisibility.tsx` + `CapabilityGrid.tsx` | role-match |
| `frontend/src/components/admin/ModelDiscoveryPanel.tsx` (NEW) | component | request-response (propose→confirm) | `FeatureVisibility.tsx` (leaf) + `UsersAndAccess.tsx` (confirm sheets) | role-match |
| `frontend/src/components/admin/ControlRoomPage.tsx` (unlock tab) | component | request-response (shell) | same file (users-access tab wiring) | exact (self) |
| `frontend/src/lib/api.ts` (+3 seams) | utility (client) | request-response | same file (`setFlag`, `setFeatureVisibility`, `getAdminActiveRuns`) | exact (self) |
| `frontend/src/components/settings/ModelPillRow.tsx` (polish) | component | render | same file + `frontend/src/lib/providerLogo.tsx` | exact (self) |
| `frontend/src/components/chat/MessageInput.tsx` (picker polish) | component | render | `frontend/src/lib/providerLogo.tsx` (RDD 48) | role-match |
| `backend/tests/test_149_*.py` (7 files) | test | — | `backend/tests/test_146_operator_gate.py` | exact (mirror) |
| `frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx`, `ModelDiscoveryPanel.test.tsx` | test | — | `frontend/src/components/admin/__tests__/CapabilityGrid.test.tsx` | role-match |

## Pattern Assignments

### `backend/app/api/admin.py` — +GET/PATCH/POST /admin/models* (controller, request-response + CRUD)

**Analog:** same file (self) — the router + write endpoints already live here. New routes JOIN this router; do NOT create a new one.

**Router-level operator gate** (`admin.py:95-100`) — new routes inherit this automatically:
```python
# The single load-bearing security line: default-deny at the router (Pattern 1).
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_operator)],  # non-operator → byte-identical 404 on ALL routes
)
```

**Code-constant field allowlist** (`admin.py:63-93`) — the exact `_FLAG_KEYS` / `_VISIBILITY_FEATURES` pattern the capability PATCH must mirror. A client-supplied column name must NEVER reach a SET clause:
```python
_FLAG_HUMAN_NAMES = {              # keyed by human name → plain audit label (LANG-01)
    "web_search_enabled": "web search",
    "sandbox_enabled": "code sandbox",
    ...
}
_FLAG_KEYS = set(_FLAG_HUMAN_NAMES)

_VISIBILITY_FEATURES = {"skill_studio", "model_management", "workflow_authoring", "governance_health"}
_VISIBILITY_AUDIENCES = {"everyone", "operators"}   # enum VALUE, never a boolean (SEED-115)
```
→ New: `_MODEL_CAP_COLUMNS = {"llm_call_timeout_seconds", "context_window_tokens", "max_output_tokens", "native_tools", "enabled", "deprecated"}`.

**Write endpoint shape — validate-before-write + floor + honest-failure** (`admin.py:455-505`, `set_flag`):
```python
@router.put("/flags", status_code=status.HTTP_204_NO_CONTENT)
async def set_flag(request: Request, body: FlagUpdate, _floor: None = Depends(operator_audit_floor)):
    if body.key not in _FLAG_KEYS:                       # allowlist BEFORE any DB touch
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown flag key: {body.key}")
    if not await save_app_settings({body.key: body.value}):   # write swallows exceptions → returns bool
        request.state.audit_action = "flag.write_failed"       # honest failure receipt, no false 204
        request.state.audit_label = f"Flag change for {_FLAG_HUMAN_NAMES[body.key]} failed to persist"
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not persist ...")
    request.state.audit_action = f"flag.{body.key}.{'on' if body.value else 'off'}"   # ✎ receipt
    request.state.audit_label = f"Turned {on} {_FLAG_HUMAN_NAMES[body.key]} for everyone"
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```
→ New PATCH `/models/{model_id}`: same shape — allowlist-check, upsert via asyncpg (parameterized), call `invalidate_model_overrides_cache()`, stamp `✎ model.capability.set`.

**Graded-guard REFUSE (409) precedent** (`admin.py:401-408`, `disable_user` self-guard :793-797) — the D-149-09 "disabling the org-default/locked model is refused" guard mirrors this: check the guarded condition, raise `409` with a plain-language `detail` BEFORE any mutation:
```python
raise HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="This is an internal evaluation job — it finishes on its own and can't be stopped by hand.",
)
```

**Server-owned label maps (never client text)** (`admin.py:520-523`, `_RECORD_MAP`) — for the `model.discover` receipt, mirror this: the client supplies no free-text; the server owns `(label, action)`. Reads that are recorded set `request.state.audit_is_write = False` (`admin.py:542`).

**Blocking supabase-py call → `run_in_threadpool`** (`admin.py:800-804`, D-v2.5-01) — any supabase-py write in the new routes wraps like this. asyncpg pool reads use `deps._pg_pool` (the LIVE module attribute, never a from-import snapshot — CR-02, `admin.py:138`).

---

### `backend/app/services/model_discovery_service.py` (NEW) (service, request-response external fan-out)

**Analog:** `scripts/curate_models.py` (lift the extractors + endpoint table + pagination) + `backend/app/services/rerank_service.py` (the `httpx.AsyncClient` async pattern). **Lift-and-wrap, do NOT rewrite.**

**Endpoint + auth table** (`curate_models.py:67-84`) — copy verbatim into the service:
```python
PROVIDER_ENDPOINTS: dict[str, dict[str, str]] = {
    "openai":     {"url": "https://api.openai.com/v1/models", "auth": "bearer", "key_env": "OPENAI_API_KEY"},
    "anthropic":  {"url": "https://api.anthropic.com/v1/models", "auth": "anthropic", "key_env": "ANTHROPIC_API_KEY"},
    "google":     {"url": "https://generativelanguage.googleapis.com/v1beta/models", "auth": "google_query", "key_env": "GOOGLE_API_KEY"},
    "deepseek":   {"url": "https://api.deepseek.com/models", "auth": "bearer", "key_env": "DEEPSEEK_API_KEY"},
    "moonshot":   {"url": "https://api.moonshot.ai/v1/models", "auth": "bearer", "key_env": "MOONSHOT_API_KEY"},
    "zhipu":      {"url": "https://api.z.ai/api/paas/v4/models", "auth": "bearer", "key_env": "ZHIPU_API_KEY"},
    "minimax":    {"url": "https://api.minimax.io/v1/models", "auth": "bearer", "key_env": "MINIMAX_API_KEY"},
    "openrouter": {"url": "https://openrouter.ai/api/v1/models", "auth": "public", "key_env": "OPENROUTER_API_KEY"},
}
```
This is a HARDCODED table — no client-supplied URL ever reaches the HTTP client (Pitfall 7 / SSRF defense). Provider selection, if offered, is validated against a code-constant set exactly like `_FLAG_KEYS`.

**Per-shape extractors + auth-header logic + pagination** (`curate_models.py:140-260`) — lift `_extract_openai_compat` (:140), `_extract_minimax` (:153), the per-auth header/param block (:199-209), and the two paginated providers (google `nextPageToken` :223-235, anthropic `has_more`/`last_id` :237-243). **Pitfall 5: skipping the google/anthropic pagination loops produces false "vanished" proposals.** Note the auth params already carry the page-size seeds: anthropic `params["limit"]="1000"`, google `params["pageSize"]="1000"`.

**Newest-first ordering** (`curate_models.py:263-283`) — lift `sort_newest_first` verbatim to order proposed new models. Casing is preserved verbatim (`str(el.get("id"))`) — Pitfall 6: never normalize case or a `MiniMax-M2.7` model silently downgrades to inferred defaults.

**Convert `requests` → `httpx.AsyncClient` + `asyncio.gather`** (RESEARCH Code Examples; the `rerank_service.py` httpx idiom). Per-provider outcome must be HONEST:
- no key (and auth != public) → `{"status": "no_key"}` (skipped, not failed)
- 429/non-200 → `{"status": f"http-{code}"}` (EXCLUDED, not failed — the 058/060 lesson; names-only, never echo the body — `curate_models.py:218-220`)
- 200 → extract ids (+caps for google/openrouter ONLY)

**SC#3 capability-fill asymmetry (the load-bearing honesty beat)** — auto-fill token limits for **Google + OpenRouter only**; auto-fill `native_tools` for **OpenRouter only** (`supported_parameters` contains `"tools"`). Everything else, and native_tools on Google, is propose-only "unknown — you set it," never auto-enabled. (Provider matrix in RESEARCH §"Provider /models Capability Matrix". Pitfall 2.)

---

### `backend/app/config.py` — ModelCapability TypedDict + read path (config, CRUD read overlay)

**Analog:** same file (self). The read path is DONE — write into what it already reads (D-149-03).

**DB-overlay read (already live — do NOT touch the merge logic, only add `deprecated` to the overlaid fields)** (`config.py:680-712`, `get_model_capability_async`):
```python
db_row = (await _load_model_overrides()).get(model_id)
if db_row is not None:
    base = dict(MODEL_CAPABILITIES.get(model_id, {}))
    if not base:
        base = dict(_build_inferred_defaults(model_id, db_row.get("provider", _INFERENCE_FALLBACK_PROVIDER)))
    for field in ("llm_call_timeout_seconds", "context_window_tokens", "max_output_tokens", "native_tools"):
        db_val = db_row.get(field)
        if db_val is not None:
            base[field] = db_val
    base["provider"] = db_row.get("provider", base.get("provider", "unknown"))
    base["capability_source"] = "db_override"     # this tag is why a DB-only row works with ZERO code edits
    return base
```
→ Change: add `"deprecated"` to the overlaid-fields tuple (optional — deprecated is informational; the end-user effect is a badge, D-149-05). Add `deprecated: NotRequired[bool]` to the `ModelCapability` TypedDict (config.py:~141). **NO new static models** — GPT-5.6 (2026-07-11) was the last hand-add.

**Async timeout resolver precedent** (`config.py:636-677`, `get_per_call_timeout_async`) — the 4-tier DB>env>static>default shape; the clamp fix (below) can borrow this tier-1 DB-read idiom to resolve the DB-overridable `max_output_tokens`.

---

### `backend/app/models/user_settings.py` — all-rows read + enabled-enforce + invalidate (model/store, CRUD + cache)

**Analog:** same file (self).

**The `enabled`-only cache (Pitfall 1 — the editor CANNOT see disabled rows through this)** (`user_settings.py:331-356`):
```python
async def _load_model_overrides() -> dict[str, dict]:
    ...
    rows = await pool.fetch("SELECT * FROM model_capabilities_overrides WHERE enabled = true")   # ← enabled-only
    _model_overrides_cache = {r["model_id"]: dict(r) for r in rows}
    ...
```
→ New: the registry GET endpoint needs a SEPARATE all-rows read (`SELECT * FROM model_capabilities_overrides` — no `enabled` filter), unioned with `MODEL_CAPABILITIES` built-ins for the DEF rows. KEEP this enabled-only cache for the hot request path.

**Invalidation (call on EVERY write)** (`user_settings.py:359-362`):
```python
def invalidate_model_overrides_cache() -> None:
    global _model_overrides_cache_time
    _model_overrides_cache_time = 0.0     # per-worker; other workers ≤30s TTL (Pitfall 3 — accepted SC#1 semantics)
```

**`_build_providers` — the picker's model list (make `enabled` real here)** (`user_settings.py:400-471`):
```python
# D-13/D-24: merge DB-registered models from model_capabilities_overrides
db_registered = sorted(
    mid for mid, cap in _model_overrides_cache.items()
    if cap.get("provider") == pid and cap.get("enabled", True) and mid not in existing_set
)
models.extend(db_registered)
# Merge static registry models -- append any not already present
registry = sorted(
    m for m, cap in MODEL_CAPABILITIES.items()
    if cap.get("provider") == pid and m not in existing_set     # ← unconditional: a disabled STATIC model still shows
)
models.extend(registry)
```
→ Change (D-149-08/10): teach the static-registry merge to filter OUT models with a disabled override. Today a disabled `gpt-4o` (static) still appears because the disabled override never enters the enabled-only cache — `_build_providers` needs the disabled set (an all-rows read at build time or a small second cache). This is the picker→registry single-source-of-truth chain.

---

### `backend/app/services/openai_service.py` — `_resolve_max_tokens` (service, transform/clamp) — D-149-15

**Analog:** same function (self). The Phase-074 single-chokepoint — EXTEND it, do not fork.

**The clamp bug (Pitfall 4 / BUG-260620-01 mechanism)** (`openai_service.py:1357-1378`):
```python
model_id = (user_settings.llm_model if user_settings else "") or settings.llm_model or ""   # ← WRONG model
if model_id:
    lookup_key = model_id.removesuffix(":exacto") if model_id.endswith(":exacto") else model_id
    cap = MODEL_CAPABILITIES.get(lookup_key, {}).get("max_output_tokens")                    # ← STATIC dict, ignores DB edit
    if cap and resolved > cap:
        return cap
return resolved
```
Two defects: (a) reads the static dict so an operator's DB-edited `max_output_tokens` is ignored; (b) clamps against `user_settings.llm_model` while the request calls `effective_model`. Fix: clamp against the **effective model actually sent**, resolving its cap through the **DB overlay**. RESEARCH Open Q3 recommendation: **pass a pre-resolved cap INTO the sync function** (already fetched via the async `get_model_capability_async` on the request path) rather than making the hot-path function async. **Keep the targeted `.removesuffix(":exacto")`** — a generic `split(":")[0]` strips legitimate `:free` suffixes (documented anti-pattern at :1360-1367). Trace the failing path first (evidence rule).

---

### `backend/app/api/threads.py` — enabled-enforce + fallback notice (controller, request-response/SSE) — D-149-10

**Analog:** same file (self). The ONE shared model-resolution seam — never fork per provider (red line).

**The resolution seam** (`threads.py:1089-1123`):
```python
run_id = _uuid_mod.uuid4()
_resolved_model = body.model if getattr(body, "model", None) else _user_settings.llm_model
...
_capability = await get_model_capability_async(_resolved_model) or {}     # ← DB overlay already read here
_capability_provider = _capability.get("provider", "unknown")
```
→ Insert the D-149-10 enforcement right here: if `_resolved_model` has a disabled override, fall back to the org default (`app_settings.llm_model`) and emit an honest inline SSE notice naming BOTH models ("modelX was disabled by your administrator — this reply used modelY"). RESEARCH Open Q2: reuse an existing informational SSE event rather than inventing one — grep the `scope_violation` emit path (`threads.py:1399-1405` region; also `runs.py`, `tool_dispatcher.py`, `harness_engine.py`, `harness/scope.py` carry the pattern) for the shape to mirror. Never break mid-conversation, never silent.

---

### `frontend/src/components/admin/ModelRegistryTab.tsx` (NEW) (component, CRUD instrument table) — 070-A

**Analog:** `FeatureVisibility.tsx` (the write-tab pure-leaf pattern) + `CapabilityGrid.tsx` (the toggle grid).

**Pure presentational leaf contract** (`FeatureVisibility.tsx:27-52`) — props in, DOM out; the shell owns the source-of-truth map + the server write; the leaf renders rows and reports the edit. No optimistic flip — the shell re-fetches:
```tsx
interface FeatureVisibilityProps {
  visibility: Record<GovernedFeature, FeatureAudience>     // shell's source of truth
  onSetVisibility: (feature, audience) => Promise<void>    // resolves on success, rejects on failure
  showTechnical: boolean                                   // ⌥ Technical-names reveal
}
```
→ New: `ModelRegistryTab` receives the registry rows (union of DEF + OVR + DB-only), an `onSetCapability(modelId, patch)` write, and `showTechnical`. Provider-grouped collapsible sections; click-to-edit numeric cells; `✓ in picker / ✕ hidden` coupling chip derived from `enabled`; 🔓/🔒 per-row lock; OVR distinct from dim+italic DEF with a Reset.

**Per-card transient write state + ✎ receipt** (`FeatureVisibility.tsx:152-183`, `FeatureCard`):
```tsx
const [busy, setBusy] = useState(false)
const [failed, setFailed] = useState(false)
const [receipt, setReceipt] = useState<string | null>(null)
async function flipTo(next) {
  if (busy || next === audience) return
  setBusy(true); setFailed(false)
  try {
    await onSetVisibility(def.key, next)
    setReceipt("Set to ... · recorded"); window.setTimeout(() => setReceipt(null), 4000)
  } catch { setFailed(true) } finally { setBusy(false) }
}
```

**⌥ Technical-names conditional reveal** (`FeatureVisibility.tsx:262-267`) — raw column names (e.g. `max_output_tokens`) render only when `showTechnical`:
```tsx
{showTechnical && (
  <div className="flex gap-2"><dt>Routes</dt><dd className="font-mono ...">{def.routePrefixes}</dd></div>
)}
```

---

### `frontend/src/components/admin/ModelDiscoveryPanel.tsx` (NEW) (component, request-response propose→confirm) — 071-A

**Analog:** `FeatureVisibility.tsx` (leaf + receipt) + `UsersAndAccess.tsx` (the confirm-sheet + `runWrite` busy wrapper for the "enable now" opt-in ticks).

**Confirm/guard sheet shape** (`UsersAndAccess.tsx:370-404`) — reuse the `Sheet`/`SheetContent side="bottom"` bottom-sheet for any confirm; the write fires only on the explicit button via `runWrite`:
```tsx
<Sheet open={confirm === "disable"} onOpenChange={(o) => !o && setConfirm(null)}>
  <SheetContent side="bottom" className="mx-auto max-w-lg">
    ...
    <button onClick={() => void runWrite(() => onDisable(row.id), "Disabled · recorded")} disabled={busy}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Disable {email}
    </button>
```
→ New: run cards per provider (client-side timers in flight, then per-provider verbatim error / "no key — skipped" / "capabilities ✓ vs IDs only" badge), ✚New/±Changed/⊘Vanished groups, the SC#3 hero: un-returned capability fields render as explicit amber "unknown — you set it" inputs (mirror the amber styling used in `FeatureVisibility.tsx:190-203` — `border-amber-500/30 bg-amber-500/[0.05]`, `text-amber-400`). New models default to an unticked "enable now" that is enabled ONLY where caps are complete. Vanished models are FLAGGED (mark deprecated / disable / keep), never auto-deleted. Proposals are ephemeral (live in the response only — D-149-12).

---

### `frontend/src/components/admin/ControlRoomPage.tsx` — unlock the Model Registry tab (component, shell)

**Analog:** same file (self). The Users & Access tab was unlocked in 148 — mirror it exactly.

**Tab def flip** (`ControlRoomPage.tsx:112-117`) — remove `locked: true` + `lockedDescription`, render the new tabs instead of `LockedTab`:
```tsx
{ id: "model-registry", label: "Model Registry", locked: true,       // ← flip to locked: false
  lockedDescription: "Live model discovery and DB-managed model capabilities are coming soon." },
```

**Shell-owns-fetch + write-then-refetch wiring** (`ControlRoomPage.tsx:257-264` roster fetch, `:427-458` write callbacks) — the lazy tab-open fetch + `alive.current` guard + `pulseRecording()` after a recorded write is the exact template:
```tsx
const fetchRoster = useCallback(async () => {
  try { const page = await getUsersRoster(1, ROSTER_PAGE_SIZE); if (alive.current) setRosterRows(page.users) }
  catch { /* honest degrade, never a crash */ }
}, [])
useEffect(() => { if (activeTab === "users-access") void fetchRoster() }, [activeTab, fetchRoster])
const handleDisableUser = useCallback(async (userId) => {
  await disableUser(userId); pulseRecording(); if (alive.current) void fetchRoster()
}, [fetchRoster, pulseRecording])
```
→ New: `fetchRegistry` on model-registry tab-open; `handleSetCapability` / `handleRunDiscovery` write-then-refetch + `pulseRecording()`. Render `<ModelRegistryTab .../>` + `<ModelDiscoveryPanel .../>` in the model-registry branch (mirror the users-access branch at :639-663).

---

### `frontend/src/lib/api.ts` — +getModelRegistry / setModelCapability / runModelDiscovery (utility client)

**Analog:** same file (self) — `setFlag` (:3996), `setFeatureVisibility` (:3911), `getAdminActiveRuns` (:3971).

**Write seam** (`api.ts:3996-4004`, `setFlag`):
```ts
export async function setFlag(key: FlagKey, value: boolean): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/flags`, { method: "PUT", headers, body: JSON.stringify({ key, value }) })
  if (!res.ok) throw new ApiError("Failed to update the setting.", res.status)
}
```

**Envelope-unwrap read seam** (`api.ts:3971-3977`, `getAdminActiveRuns`) — the backend returns `{"runs": [...]}`; unwrap `.runs` (casting the raw object into list state crashes the next `.map` — CR-01 precedent). The registry GET returns an envelope too — unwrap it here, never in the component.
→ New: `getModelRegistry()` (unwrap `.models`), `setModelCapability(modelId, patch)` (PATCH), `runModelDiscovery()` (POST, returns the ephemeral diff). Same auth-header + `!res.ok → ApiError` shape. Add the TS types (`ModelRegistryRow`, `ModelCapabilityPatch`, `DiscoveryResult`) beside them.

---

### `frontend/src/components/settings/ModelPillRow.tsx` + `frontend/src/components/chat/MessageInput.tsx` — D-149-17 picker polish (component, render)

**Analog:** `frontend/src/lib/providerLogo.tsx` (RDD 48 single-source icon convention).

**Provider-logo helper (reuse — do NOT inline SVGs/emoji)** (`providerLogo.tsx:41-53`):
```tsx
// Deep COMPONENT subpath imports ONLY (`.Color`/`.Mono` leaves) — never the barrel, never the brand index
// (both drag antd via IconAvatar and throw under Vite). This is the security + build constraint.
import OpenAI from "@lobehub/icons/es/OpenAI/components/Mono"
import Anthropic from "@lobehub/icons/es/Anthropic/components/Mono"
...
type ProviderMark = ComponentType<{ size?: number }>
// providerLogo(provider) → brand mark or null (caller renders its Bot fallback)
```
→ Change (visual-only, NO redesign, same component + interaction): group models by provider, add the `providerLogo` mark per group, demote context/output info to a subtle secondary line/tooltip (currently `ModelPillRow.tsx:60-68` inlines the model + unverified chip; the chat picker inlines at `MessageInput.tsx:246-261`), add the deprecated badge (D-149-05). The existing amber "unverified" chip (`ModelPillRow.tsx:61-68`) is the styling template for the deprecated badge.

---

## Shared Patterns

### Operator gate + per-write audit floor
**Source:** `backend/app/dependencies.py:247-303` (`require_operator` + `operator_audit_floor`); wired at `admin.py:95-100`
**Apply to:** ALL new `/admin/models*` routes (gate is automatic via router; writes attach `_floor: None = Depends(operator_audit_floor)` and stamp `request.state.audit_label/action`).
- Router gate is the SOLE authority (no RLS backstop). Reads are floor-EXEMPT; writes are floor-ATTACHED. Recorded reads set `request.state.audit_is_write = False`.
```python
if not await is_operator(current_user["id"]):
    raise _NOT_FOUND      # byte-identical 404, non-discoverable
request.state.operator = current_user
```

### Code-constant field allowlist (SQLi-safe)
**Source:** `backend/app/api/admin.py:63-93`
**Apply to:** the capability PATCH endpoint — validate every field name against `_MODEL_CAP_COLUMNS` BEFORE any SQL; reject unknown with 400/422. Never free-text column → SET clause. Same for provider selection in discovery (validate against `PROVIDER_ENDPOINTS` keys).

### Per-worker TTL cache + invalidate-on-write
**Source:** `backend/app/models/user_settings.py:331-362`
**Apply to:** every capability write → `invalidate_model_overrides_cache()`. Accept the ≤30s cross-worker window as the SC#1 contract (the 147 kill-switch precedent — "effective on their next call within the TTL, no restart"). Do NOT build cross-worker invalidation (no new runtime).

### Migration shape (metadata-only, dual-idempotent, cloud-parity)
**Source:** `supabase/migrations/098_feature_visibility.sql` + `053_settings_unification.sql` §2
**Apply to:** `099_model_registry_deprecated.sql`
```sql
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS deprecated boolean NOT NULL DEFAULT false;   -- + optional deprecated_reason text
-- Claude's-discretion lock storage: the recommended shape is one column beside llm_model:
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS llm_model_locked boolean NOT NULL DEFAULT false;   -- D-149-07, forward-compat for v3.4
```
- `053` already `ENABLE ROW LEVEL SECURITY` + a `FOR SELECT TO authenticated USING (true)` read-all policy on the table — no new policy needed; existing rows default `deprecated=false` (no backfill).
- Apply via Supabase SQL editor (LOCAL then CLOUD at promotion — the STANDING RULE), NEVER `db push`/`db reset`. Then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit the migration + `full-schema.sql` together. Migrations 079+ are pending on cloud (order matters — `project_v32_cloud_migrations.md`).
- **Next free number confirmed 099** (latest on disk is `098_feature_visibility.sql`).

### Graded guards (146-148 rule)
**Source:** `admin.py:401-408` (409 refuse) + `UsersAndAccess.tsx:370-404` (victim-naming confirm sheet)
**Apply to:** D-149-09 — disabling the org-default/locked model is REFUSED (409, plain explanation) BEFORE any mutation; locked ⇒ unlock first. Ordinary disable stays a direct flip + ✎ receipt (reversible).

### Frontend leaf + shell-owns-write
**Source:** `FeatureVisibility.tsx` (pure leaf) + `ControlRoomPage.tsx:388-471` (shell write-then-refetch + `pulseRecording`)
**Apply to:** `ModelRegistryTab` + `ModelDiscoveryPanel` — leaves are props-in/DOM-out; the shell owns fetch, the server write, and re-fetch (no optimistic flip; the server is the source of truth). Every recorded write pulses the 062-A band marker.

### Provider logos — single source
**Source:** `frontend/src/lib/providerLogo.tsx` (RDD 48)
**Apply to:** both the registry table (070-A) AND the picker polish (D-149-17). Deep `.Color`/`.Mono` subpath imports only — the barrel/brand-index drag antd and throw under Vite.

## No Analog Found

Files with no close in-repo match (planner leans on RESEARCH.md + the lifted script instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/app/services/model_discovery_service.py` | service | external fan-out | No existing async multi-provider `/models` fan-out service exists. It is a **lift-and-wrap** of `scripts/curate_models.py` (a CLI script, not a service) converted to `httpx.AsyncClient` per `rerank_service.py`. The diff computation (current registry ∪ vs live ids → new/changed/vanished) and the propose-only "unknown — you set it" surface are the genuinely net-new logic — no analog, follow RESEARCH §"Code Examples" + §"Provider /models Capability Matrix". |

## Metadata

**Analog search scope:** `backend/app/api/` (admin, threads), `backend/app/models/` (user_settings), `backend/app/services/` (openai_service, rerank_service), `backend/app/config.py`, `scripts/curate_models.py`, `supabase/migrations/` (053, 098), `frontend/src/components/admin/` (ControlRoomPage, FeatureVisibility, UsersAndAccess, CapabilityGrid), `frontend/src/components/settings/ModelPillRow.tsx`, `frontend/src/components/chat/MessageInput.tsx`, `frontend/src/lib/` (api.ts, providerLogo.tsx)
**Files scanned:** ~18 source files read + targeted greps
**Test analogs:** backend → `backend/tests/test_146_operator_gate.py` (mirror for `test_149_model_gate.py`); frontend → `frontend/src/components/admin/__tests__/CapabilityGrid.test.tsx`
**Pattern extraction date:** 2026-07-12

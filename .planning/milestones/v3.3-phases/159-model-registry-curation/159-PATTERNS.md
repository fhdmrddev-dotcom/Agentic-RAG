# Phase 159: Model Registry Curation - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 12 (7 modified, 3–5 net-new depending on chosen homes)
**Analogs found:** 12 / 12 (every file has an in-repo analog — this is a lift, not a rewrite)

> **Framing (from CONTEXT.md `<code_context>`):** This is a **curation/UX layer on the shipped Phase-149 write-path + discovery service — not new plumbing.** The single biggest de-risker: the filter regex already exists (`curate_models.py`), DB-only model rows already work end-to-end (`get_model_capability_async`), and the two UI surfaces already exist as pure presentational leaves (shell owns writes). Almost every "analog" is the file's own shipped Phase-149 body — the planner is extending, not inventing.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/model_discovery_service.py` (MOD) | service | request-response (async fan-out) | itself — `_build_new_entry` (L396) / `compute_diff` (L415) + `curate_models.py:_MISSING_EXCLUDE` (L107) | exact (self) |
| **shared chat-filter regex constant** (NEW — recommend inside `model_discovery_service.py`) | config/constant | transform | `curate_models.py:_MISSING_EXCLUDE` (L107) + `config.py:_INFERENCE_PATTERNS` (L~410) | exact |
| `scripts/curate_models.py` (MOD — import the shared regex) | script/utility | batch | itself (L107-111) | exact (self) |
| `backend/app/api/admin.py` — **add-by-ID** endpoint (NEW route) | controller/route | CRUD (create) | `set_model_capability` PATCH (L1081) | exact (same table, same upsert) |
| `backend/app/api/admin.py` — **filter-toggle** write (NEW key on existing route, OR new route) | controller/route | CRUD (update setting) | `set_flag` PUT `/admin/flags` (L507) | exact (app_settings bool write) |
| `backend/app/config.py` — **per-family capability-default table** (NEW consts) | config | transform | `_INFERRED_DEFAULT_MAX_TOKENS` (L446) + `_NATIVE_TOOL_PROVIDERS` (L443) + `_INFERENCE_PATTERNS` (L~410) | exact (self) |
| `backend/app/models/user_settings.py` — filter-toggle field + readback (MOD) | model/config | CRUD | `_load_settings_from_db` (L250) + `save_app_settings` (L285) + `Settings` flag fields | exact (self) |
| `supabase/migrations/NNN_discovery_filter.sql` (NEW — only if toggle is a column) | migration | — | `099_model_registry_deprecated.sql` (ADD COLUMN app_settings) | exact |
| `frontend/src/components/admin/ModelRegistryTab.tsx` — **+ Add model by ID** form (MOD) | component | request-response (form submit) | itself — `ModelRow.write` chokepoint (L245) + `DeprecatedControl` inline form (L510) | exact (self) |
| `frontend/src/components/admin/ModelDiscoveryPanel.tsx` — filter toggle + show-all + hidden-count (MOD) | component | request-response | itself — `phase`/`result` render (L195) + `DiffGroup`/`NewModelRow` (L412/L443) | exact (self) |
| `frontend/src/components/admin/ControlRoomPage.tsx` — shell wiring (MOD) | provider/container | request-response | itself — `handleSetCapability` (L506) + `fetchRegistry` (L284) | exact (self) |
| `frontend/src/lib/api.ts` — `addModelById` + filter get/set + types (MOD) | service/client | CRUD | itself — `setModelCapability` (L4256) + `runModelDiscovery` (L4287) | exact (self) |
| **frontend per-family default table** (NEW — small lib module or extend `model-info.ts`) | utility/config | transform | `providerLogo.tsx:MODEL_MARKS` (L129) + `model-info.ts:MODEL_INFO` (L21) | exact |

`frontend/src/lib/providerLogo.tsx` is a **read-only reference** for the substring→family idiom (`modelLogo` / `MODEL_MARKS`); it is not modified — it is the pattern source for the new default table.

---

## Pattern Assignments

### 1. `backend/app/services/model_discovery_service.py` (service, fan-out) — WIRE THE FILTER (D-159-01)

**Analog A — the regex to lift** (`scripts/curate_models.py:104-111`):
```python
# Utility-model noise excluded from CURATE_MISSING (NOT from CURATE_LIVE).
_MISSING_EXCLUDE = re.compile(
    r"(embed|whisper|tts|audio|realtime|image|dall-e|moderation|transcribe|"
    r"search-preview|computer-use|codex|chatgpt|instruct|davinci|babbage)",
    re.IGNORECASE,
)
```
> **⚠ D-159-01 tuning nuance (from CONTEXT):** this regex was written for `CURATE_MISSING` (registry-gap flagging), so it excludes `chatgpt|instruct|codex|davinci|babbage` — some of which (e.g. `chatgpt-4o-latest`) ARE valid chat models. The planner must **re-examine the chat-legacy tokens with real evidence from a live discovery pull** (keep the true non-chat utility excludes: `embed|whisper|tts|audio|realtime|image|dall-e|moderation|transcribe|rerank`; re-examine `chatgpt|instruct|codex`). Curation logic is proven — only the token set + wiring is new.

**Where the unfiltered ids come out** — the fan-out result shape the filter passes over. `_fetch_provider` returns per-provider `ids` (newest-first), and `_build_new_entry` (L396-412) is where each genuinely-new model becomes a diff entry:
```python
def _build_new_entry(provider: str, model_id: str, model_caps: dict) -> dict:
    capabilities: dict = {}
    for field in _CAP_FIELDS:
        value = model_caps.get(field)
        capabilities[field] = value if value is not None else UNKNOWN
    return {
        "provider": provider,
        "model_id": model_id,
        "enabled": False,
        "capabilities": capabilities,
    }
```

**Pattern to replicate (recommended):** define the shared regex + a helper as a module constant here (co-located with the fan-out it filters), and **tag** each new entry with a display-only `utility: bool` (matched against the regex) rather than dropping it — so the diff the operator confirms is untouched (149's "Discovery proposes, humans confirm" red line; D-159-04 "pure display/curation concern"). The ~401 noise lives almost entirely in the `new` group; `changed`/`vanished` are already-registry models (few) — filter `new` primarily.
```python
# NEW module constant (DRY source — curate_models.py imports THIS, see §3):
CHAT_MODEL_EXCLUDE = re.compile(r"(embed|whisper|tts|audio|realtime|image|dall-e|"
                                r"moderation|transcribe|rerank|search-preview|computer-use)",
                                re.IGNORECASE)  # planner tunes final token set (D-159-01)

def is_utility_model(model_id: str) -> bool:
    return bool(CHAT_MODEL_EXCLUDE.search(model_id))

# in _build_new_entry, add a display-only flag (never gates confirmation):
return {..., "enabled": False, "utility": is_utility_model(model_id), "capabilities": capabilities}
```
Alternative integration point: tag in the `admin.py:run_model_discovery` post-pass (L1417-1432) if the planner prefers to keep `compute_diff` value-identical. Either is fine — the constraint is that the filter is display metadata, never a mutation of the confirmable diff.

---

### 2. Shared chat-filter regex constant (NEW) — DRY HOME (D-159-01 discretion)

**Recommended home:** a module-level constant in `backend/app/services/model_discovery_service.py` (the service is itself the shipped "lift-and-wrap of curate_models.py" — see its docstring L2-4). `curate_models.py` already inserts `backend/` on `sys.path` and imports `from app.config import ...` (L294-298), so it can `from app.services.model_discovery_service import CHAT_MODEL_EXCLUDE` with zero new plumbing.

**Alternative home:** `config.py` alongside the existing inference tables (`_INFERENCE_PATTERNS` L~410-423, `_NATIVE_TOOL_PROVIDERS` L443, `_INFERRED_DEFAULT_MAX_TOKENS` L446) — if the planner wants ALL model-classification constants in one place. Either works; the requirement (CONTEXT discretion) is **one importable constant so the two files can't drift.**

---

### 3. `scripts/curate_models.py` (script) — IMPORT THE SHARED REGEX (D-159-01 DRY)

**Current** (L107-111, shown above) defines `_MISSING_EXCLUDE` locally. **Pattern to replicate:** replace the local literal with an import of the shared constant so the two can't drift. Note curate's regex is used at L390 (`_MISSING_EXCLUDE.search(mid)`) and L417 — keep those call sites, just re-point the name. If the tuned chat-filter set differs from curate's registry-gap set, the planner keeps curate's own excludes for the `CURATE_MISSING` purpose and imports only the shared *non-chat-utility* core, composing locally — DRY the shared half, not necessarily the whole.

---

### 4. `backend/app/api/admin.py` — ADD-BY-ID WRITE (D-159-02)

**Analog — the exact upsert to mirror** (`set_model_capability`, L1081-1235). This endpoint ALREADY writes DB-only rows into `model_capabilities_overrides` with a SQLi-safe parameterized upsert:
```python
# L1202-1210 — the upsert (column names ONLY from the code allowlist; values via $N binds):
insert_cols = ["model_id", "provider", *present_cols]
placeholders = ", ".join(f"${i + 1}" for i in range(len(insert_cols)))
set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in present_cols)
sql = (
    f"INSERT INTO model_capabilities_overrides ({', '.join(insert_cols)}) "
    f"VALUES ({placeholders}) "
    f"ON CONFLICT (model_id) DO UPDATE SET {set_clause}, updated_at = now()"
)
values = [model_id, provider, *[body[c] for c in present_cols]]
```
Field allowlist + type guards to copy (L104-125): `_MODEL_CAP_COLUMNS` (the 7 writable columns) + `_MODEL_CAP_INT_COLUMNS` / `_MODEL_CAP_BOOL_COLUMNS`. Honest-failure + receipt tail (L1221-1235):
```python
if not write_ok:
    request.state.audit_action = "model.capability.write_failed"
    raise HTTPException(status_code=500, detail="Could not persist … it was not changed.")
invalidate_model_overrides_cache()  # SC#1: edit visible on the next request
request.state.audit_action = "model.capability.set"
request.state.audit_label = f"Changed capabilities for {model_id}"
```

> **⚠ KEY NUANCE for the planner:** the existing PATCH **infers** provider (`provider = get_model_capability(model_id).get("provider") or _infer_provider_for(model_id)`, L1199-1200) and `_MODEL_CAP_COLUMNS` does **NOT** include `provider`. Add-by-ID needs the operator's **explicit** provider pick. So add-by-ID is a **new `POST /admin/models`** route that reuses this exact upsert pattern but takes `provider` from the request body (validated against the native-7 + openrouter roster — mirror the `PROVIDER_ENDPOINTS`/`_infer` allowlist discipline) and forces `enabled=False` (149 opt-in-enable rule, D-159-02). Audit vocabulary is free-text (see Shared Patterns §Audit) — use `✎ model.added`. Do NOT try to overload the PATCH; keep the seam clean.

---

### 5. `backend/app/api/admin.py` — FILTER-TOGGLE WRITE (D-159-04)

**Analog — `set_flag` PUT `/admin/flags`** (L507-556). The filter toggle is an operator-governed `app_settings` boolean — the exact shape this endpoint already handles:
```python
if body.key not in _FLAG_KEYS:                       # L523 — code-constant allowlist (T-147-01)
    raise HTTPException(status_code=422, detail=f"Unknown flag key: {body.key}")
if not await save_app_settings({body.key: body.value}):   # L540 — honest-failure guard
    request.state.audit_action = "flag.write_failed"
    raise HTTPException(status_code=500, detail="Could not persist the flag …")
```
The allowlist it validates against (L67-74):
```python
_FLAG_HUMAN_NAMES = {
    "web_search_enabled": "web search", "sandbox_enabled": "code sandbox",
    "self_improve_enabled": "self-improvement", "workflows_enabled": "workflows",
    "maintenance_mode": "maintenance mode",
}
_FLAG_KEYS = set(_FLAG_HUMAN_NAMES)
```

> **RECOMMENDED (lowest-friction):** ride `set_flag` verbatim by adding the new toggle key (e.g. `model_discovery_filter_enabled`) to `_FLAG_HUMAN_NAMES`. Then `PUT /admin/flags` writes it with **zero new endpoint code**. The full ride-along checklist: (1) app_settings column via migration (§8), (2) add the key to `main._DIRECT_COLUMNS` (the readback allowlist — the L64-65 comment: "the five booleans added to main._DIRECT_COLUMNS (mig 097 added the last three)"), (3) add to `_FLAG_HUMAN_NAMES`, (4) add a field to the `Settings` pydantic model (§7). Frontend reads it via `getSettings()` (see ControlRoomPage `capabilityFlags`, §11). Alternative: a dedicated `PUT /admin/models/discovery-filter` route if the planner wants it off the kill-switch grid — same body/allowlist/honest-failure shape.

---

### 6. `backend/app/config.py` — PER-FAMILY CAPABILITY-DEFAULT TABLE (D-159-03, backend half)

**Analogs already present** — the family-inference + per-family default idiom (L410-456):
```python
_INFERENCE_PATTERNS = [ (re.compile(r"^minimax-", re.I), "minimax"),
                        (re.compile(r"^glm-", re.I), "zhipu"),
                        (re.compile(r"^[^/\s]+/[^/\s]+"), "openrouter"), ... ]   # substring→family
_NATIVE_TOOL_PROVIDERS = _BIG_3_PROVIDERS | frozenset({"deepseek","moonshot","minimax","zhipu"})
_INFERRED_DEFAULT_MAX_TOKENS = { "openai": 8192, "anthropic": 8192, ... "openrouter": 4096 }
```
`_build_inferred_defaults` (L483-512) already composes these into a capability dict — the exact "family → default caps" precedent D-159-03 reuses.

**Pattern to replicate:** the **max_output** default (`_INFERRED_DEFAULT_MAX_TOKENS`) and **native_tools** default (`_NATIVE_TOOL_PROVIDERS`) already exist per-family. The genuinely NEW value is a **per-family context-window default** (`MODEL_CONTEXT_DEFAULTS` L67 is per-model, not per-family). Add a small `_INFERRED_DEFAULT_CONTEXT: dict[str, int]` beside `_INFERRED_DEFAULT_MAX_TOKENS`, sourced from the modern flagship values in `model-info.ts` (§13: gemini 600k, gpt-5.x 400k/200k, claude 200k, etc.). Sensible-modern, editable — CONTEXT discretion.

---

### 7. `backend/app/models/user_settings.py` — TOGGLE FIELD + READBACK (D-159-04)

**Analog — the TTL-cache + save + invalidate the toggle rides** (all shipped):
```python
_SETTINGS_CACHE_TTL: float = 30.0                       # L247
async def _load_settings_from_db() -> dict[str, Any]:   # L250 — 30s TTL, returns app_settings row
async def save_app_settings(updates) -> bool:           # L285 — parameterized UPDATE + invalidate
def invalidate_settings_cache() -> None:                # L279 — zero the TTL so next read hits DB
```
Model-overrides caches for context (L386-468): `_load_model_overrides` (enabled-only hot cache, L399), `load_all_model_overrides` (all rows incl. disabled — the registry read, L440), `invalidate_model_overrides_cache` (L427, called on every model write). The add-by-ID write MUST call `invalidate_model_overrides_cache()` so the new row is served within the ~30s TTL (SC#1 "next request, no restart"; WORKER_COUNT=2).

**Pattern to replicate:** add the toggle as a bool field on the `Settings` pydantic model (the flag fields are `app_settings-only` with `env_attr=None` readback — see the L148/157/191/198 `app_settings-only` markers). It then flows through `_load_settings_from_db` → the row dict automatically. No new cache — it rides the existing settings cache.

---

### 8. `supabase/migrations/NNN_discovery_filter.sql` (NEW — only if the toggle is a column)

**Analog — `099_model_registry_deprecated.sql`** (the ADD COLUMN app_settings precedent, verbatim shape):
```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS llm_model_locked boolean NOT NULL DEFAULT false;
```
**Pattern to replicate:** one idempotent `ADD COLUMN IF NOT EXISTS model_discovery_filter_enabled boolean NOT NULL DEFAULT true` (default-ON per D-159-04). A `DEFAULT true` column is **self-seeding** — no seed row needed. Copy 099's apply/cloud-parity header comments verbatim (SQL-editor apply, `regenerate-full-schema.sh`, cloud-parity deferred). **No migration is needed for add-by-ID** — `model_capabilities_overrides` already exists (mig 053 §Section 2, L35-45 + mig 099 `deprecated`/`deprecated_reason`); the new row rides the existing upsert.

**Schema reference** (mig 053 L35-45 + 099) — the columns add-by-ID writes:
```
model_id (PK) · provider (NOT NULL) · llm_call_timeout_seconds · context_window_tokens ·
max_output_tokens · native_tools · enabled (DEFAULT true) · deprecated (DEFAULT false) · deprecated_reason
```

---

### 9. `frontend/src/components/admin/ModelRegistryTab.tsx` — "+ ADD MODEL BY ID" FORM (D-159-02)

**Analog — this file IS the 070-A idiom.** It's a **pure presentational leaf** (props in, DOM out; the shell owns the fetch + writes — L28-30). The "+ Add model by ID" affordance is a new sub-component here (header button → inline form/modal), reporting the write via a NEW `onAddModel` prop the shell provides.

The **write chokepoint** to copy (`ModelRow.write`, L245-260) — busy → await → ✎ receipt flash 3500ms → catch `ApiError` → in-row plain refusal:
```tsx
async function write(patch: ModelCapabilityPatch) {
  if (busy) return
  setBusy(true); setErrorDetail(null)
  try {
    await onSetCapability(id, patch)
    setReceipt(true); window.setTimeout(() => setReceipt(false), 3500)
  } catch (err) {
    setErrorDetail(err instanceof ApiError ? err.message : "Couldn't save that change — try again.")
  } finally { setBusy(false) }
}
```
The **✎ receipt** UI (L352-356): `<Check/>✎ recorded`. The **inline text/number input** idiom with the one-shot `settled` commit-guard (`DeprecatedControl` L510-601 + `NumericCell` L392-491) — reuse verbatim for the form's capability inputs. The **provider picker** uses `providerLogo(provider)` (imported L36; used L130,145). Reusable **`RowToggle`** (L678-736, `role="switch"`) for the `native_tools` field.

**Pattern to replicate for the 3-source capability styling (D-159-03):** `SourceTag` (L494-505) renders a 2-state OVR/DEF badge:
```tsx
<span className={cn("rounded px-1 py-px font-mono text-[9px]",
  overridden ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
  {overridden ? "OVR" : "DEF"}
</span>
```
Extend this to **three visually-distinct sources**: `provider-confirmed` (success/green) vs `default — confirm` (warning/amber, mirror the discovery panel's amber input styling L513) vs operator-typed (primary). The default is a **pre-fill the operator reviews, never authoritative** — the model still lands `enabled=false` (D-159-03 / SC#3).

---

### 10. `frontend/src/components/admin/ModelDiscoveryPanel.tsx` — FILTER TOGGLE + SHOW-ALL + HIDDEN-COUNT (D-159-04)

**Analog — this file IS the 071-A propose→confirm surface.** Also a pure leaf (L21-23). It already renders the `new` group via `DiffGroup` (L262-285) + `NewModelRow` (L443-568). The filter is a **display filter over `result.new`** + a toggle + an honest hidden-count.

The **amber "default — confirm" input** styling to reuse for D-159-03 hand-fill pre-fills (L510-536, the un-returned-capability input):
```tsx
<span className="inline-flex items-center gap-1.5 rounded-[6px] border border-warning/40 bg-warning/[0.05] px-2 py-1 text-xs">
  <span className="text-warning">{label}</span>
  <input type="number" placeholder="set…" value={draftFor(field)} onChange={...}
    className="w-20 rounded border border-warning/50 bg-background … font-mono text-xs" />
</span>
```
The `enableNow` gating (L542-564) is the SC#3 red line already enforced: "Enable now" is disabled until `isComplete(m)` — a pre-filled default must NOT flip this to auto-enable.

**Pattern to replicate:** add a toggle (default-ON, value from the persisted app_settings key via a new prop from the shell) that hides `new` entries where `m.utility === true` (the tag from §1). Show all → reveal them. **Honest hidden-count** ("N utility models hidden") next to the toggle — CONTEXT `<specifics>`: "so the filter never feels like it's silently swallowing models." Model the count copy on the existing sticky-bar summary (L322-326: `{result.new.length} new · … · vanished`). Wire the pre-fill defaults into `NewModelRow`'s draft inputs (reuse the §13 family-default table, styled `default — confirm`).

---

### 11. `frontend/src/components/admin/ControlRoomPage.tsx` — SHELL WIRING (MOD)

**Analog — this file already owns the model-tab shell.** The write-then-refetch handler pattern to mirror (`handleSetCapability` L506-513):
```tsx
const handleSetCapability = useCallback(async (modelId, patch) => {
  await setModelCapability(modelId, patch)
  pulseRecording()
  if (alive.current) void fetchRegistry()      // server = source of truth; no optimistic flip
}, [fetchRegistry, pulseRecording])
```
`fetchRegistry` (L284-291, alive-guard + honest-degrade `.catch`). The leaves are wired at L751-760:
```tsx
<ModelRegistryTab rows={registryRows} onSetCapability={handleSetCapability} onLock={handleLock} showTechnical={showTechnical} />
<ModelDiscoveryPanel onRunDiscovery={handleRunDiscovery} onConfirm={handleConfirmDiscovery} />
```
The existing `capabilityFlags` read (L541-546) shows how an app_settings bool reaches a leaf from `settings?.<key>` — the filter-toggle's default-on value rides this exact path.

**Pattern to replicate:** add `handleAddModel` (mirror `handleSetCapability` — call new `addModelById` api fn, `pulseRecording()`, `fetchRegistry()`) → pass as `onAddModel` to `ModelRegistryTab`. Add the filter-toggle value (`settings?.model_discovery_filter_enabled ?? true`) + a `handleSetDiscoveryFilter` (call `setFlag`/new api fn, then refetch settings) → pass both to `ModelDiscoveryPanel`.

---

### 12. `frontend/src/lib/api.ts` — CLIENT SEAM (MOD)

**Analog — `setModelCapability`** (L4256-4267) + `runModelDiscovery` (L4287-4292):
```ts
export async function setModelCapability(modelId: string, patch: ModelCapabilityPatch): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models/${encodeURIComponent(modelId)}`, {
    method: "PATCH", headers, body: JSON.stringify(patch) })
  if (!res.ok) throw new ApiError(await errorDetail(res, "Failed to update the model."), res.status)
}
```
**Pattern to replicate:** add `addModelById(body: {model_id, provider, ...caps})` → `POST /admin/models` (or the chosen route), same auth-headers + `ApiError(errorDetail(...))` shape. If the toggle rides `set_flag`, reuse the existing settings save seam (no new fn); else add `setDiscoveryFilter(enabled)`. Extend the `ModelCapabilityPatch`/add a small `AddModelBody` type beside `ModelRegistryRow` (L4142) — the client UNWRAPS envelopes in the client, never the component (CR-01 precedent, L4133).

---

### 13. Frontend per-family default table (NEW — D-159-03 frontend half)

**Analogs — two shipped tables to mirror:**
- `providerLogo.tsx:MODEL_MARKS` (L129-146) — the ordered substring→family array + `modelLogo` lookup (L155-162, first-match-wins, most-specific-first):
```tsx
const MODEL_MARKS: ReadonlyArray<readonly [string, ProviderMark]> = [
  ["claude", Claude], ["gemma", Gemma], ["gemini", GeminiColor], ["kimi", Kimi],
  ["glm", ChatGLM], ["minimax", MinimaxColor], ["gpt", OpenAI], ... ]
export function modelLogo(modelId) {
  const id = modelId.toLowerCase()
  for (const [needle, mark] of MODEL_MARKS) if (id.includes(needle)) return mark
  return null
}
```
- `model-info.ts:MODEL_INFO` (L21-55) — the per-model `{contextWindow, maxOutputTokens, costTier}` table (the value source for family defaults).

**Pattern to replicate:** a new `familyDefaults(id | provider) → {context, maxOutput, tools}` table keyed by the SAME substring→family idiom as `MODEL_MARKS` (first-match-wins), seeded from `MODEL_INFO`'s modern flagship values. Home: a small new lib module (e.g. `frontend/src/lib/model-defaults.ts`) OR extend `model-info.ts`. Read by both the add-by-ID form (§9) and the discovery hand-fill (§10). Keep it a mirror of the backend `config.py` defaults (§6) — `model-info.ts`'s own header (L2-7) documents this "keys mirror config.py; update when new models are added" contract.

---

## Shared Patterns

### Operator gate + audit receipt (`✎`)
**Source:** `backend/app/dependencies.py` `require_operator` (L247) + `operator_audit_floor` (L267); usage all over `admin.py`.
**Apply to:** every new backend write endpoint (add-by-ID, filter-toggle if dedicated).
- Router already carries `dependencies=[Depends(require_operator)]` (admin.py L128-132) — new routes inherit the byte-identical-404 gate for free (no RLS backstop, SC#4).
- Attach `_floor: None = Depends(operator_audit_floor)` per write route.
- **Audit action/label are FREE-TEXT** (`request.state.audit_action` / `audit_label`, consumed at dependencies.py L286-287) — NOT an allowlist. So `✎ model.added` needs no registration; just stamp it. On success set both; on persistence failure stamp `*.write_failed` + raise a real 500 (never a false 2xx — set_flag L540-548 / set_model_capability L1221-1230).

### SQLi-safe write discipline (allowlist-before-touch)
**Source:** `admin.py:_MODEL_CAP_COLUMNS` (L104) + `_FLAG_KEYS` (L74); `save_app_settings:_VALID_COLUMN_NAME` (user_settings.py L313).
**Apply to:** add-by-ID (validate `provider` against the roster + caps against the column allowlist BEFORE the upsert) + filter-toggle (validate the key). A client field name must NEVER reach a SET clause; values are `$N` binds only.

### Multi-worker TTL cache + invalidate (SC#1 "next request, no restart")
**Source:** `user_settings.py` `_SETTINGS_CACHE_TTL=30.0` (L247) + `invalidate_model_overrides_cache` (L427) + `invalidate_settings_cache` (L279).
**Apply to:** add-by-ID write calls `invalidate_model_overrides_cache()`; the filter-toggle write (via `save_app_settings`) already invalidates the settings cache. WORKER_COUNT=2 → edits propagate within the ~30s window, no restart.

### Propose-not-auto-enable (149 red line)
**Source:** `model_discovery_service._build_new_entry` (L396, `enabled=False`) + `ModelDiscoveryPanel` `enableNow` gating (L542-564).
**Apply to:** the filter HIDES, never enables/deletes; add-by-ID lands `enabled=false`; pre-filled defaults are operator-reviewed, never silent (D-159-03 / SC#3 honesty).

### `run_in_threadpool` for blocking supabase-py in async handlers
**Source:** CLAUDE.md rule (D-v2.5-01); `admin.py` imports `from starlette.concurrency import run_in_threadpool` (L32). Note the model-registry writes use the **asyncpg pool** (`deps._pg_pool`, admin.py L1212), which is already async — no threadpool needed there. Apply the rule only if any new path calls `supabase-py` directly.

### Migration discipline (CLAUDE.md)
**Source:** mig 099 header (L18-26).
**Apply to:** any new app_settings column — paste into local Supabase SQL editor (never `db push`/`reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit both files. Cloud parity deferred to the standing production-push checklist. **Deploy-artifact same-commit rule (CLAUDE.md D-16):** a new app_settings *column with a DEFAULT* is self-seeding (not an env var, not a seed row) → likely no `onebox.env.example`/`OPERATOR.md`/`docker-compose.prod.yml` change, but the planner should run `scripts/check-deploy-drift.sh` to confirm.

---

## No Analog Found

None. Every file to be created or modified has a direct in-repo analog (most are the file's own shipped Phase-149/128 body). The only genuinely NEW *values* are the per-family context-window default (backend `config.py` §6) and its frontend mirror (§13) — both have exact structural analogs (`_INFERRED_DEFAULT_MAX_TOKENS` / `MODEL_MARKS` + `MODEL_INFO`), so the planner writes values into a proven shape, not a new pattern.

---

## Metadata

**Analog search scope:** `backend/app/services/` (model_discovery_service), `backend/app/api/` (admin), `backend/app/config.py`, `backend/app/models/user_settings.py`, `backend/app/dependencies.py`, `scripts/` (curate_models), `supabase/migrations/` (053, 099), `frontend/src/components/admin/` (ModelRegistryTab, ModelDiscoveryPanel, ControlRoomPage), `frontend/src/lib/` (api, providerLogo, model-info).
**Files scanned:** 13 primary + 2 migrations.
**Pattern extraction date:** 2026-07-18

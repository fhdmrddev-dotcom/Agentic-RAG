# Phase 149: Model Registry & Discovery - Research

**Researched:** 2026-07-12
**Domain:** Operator-gated model-capability CRUD over an existing DB read path + live cross-provider `/models` discovery (propose-only), inside the locked Phase-146 Control Room shell
**Confidence:** HIGH (code seams read directly; provider `/models` shapes verified against provider docs; zero new packages)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Boundary promotion (SEED-116 → locked):**
- **D-149-01 (the three-surfaces rule + two-layer pattern):** Control Room = platform governance (allowed-set + policy + registry + secrets + audit + users + kill-switches + visibility; operator-only, 404-non-discoverable). Settings = user preferences within what the operator allows (privilege-filtered projection). Profile menu = identity (SEED-113, not this phase). For every knob: (1) operator governs allowed-set + policy in CR, (2) user picks within allowed in Settings, (3) operator can LOCK any choice, (4) knob visibility is privilege-gated (VIS-01 audience map). Models are the first applied instance. Exhaustive per-knob map = `.planning/notes/dynamic-control-inventory.md`. No per-group greenlists in v3.3 (SEED-115 / v3.4).

**G-2 sketch gate (satisfied — UI is LOCKED, do not re-litigate):**
- **D-149-02:** Sketches **070-A** (capability editor) + **071-A** (discovery propose→confirm) are the build contract — RDD 60/61 in `sketch-findings-agentic-rag`. Provider logos = @lobehub/icons (RDD 48); plain-first labels with ⌥ Technical names; 061-B band + 062-A receipts.

**Registry universe + deprecated:**
- **D-149-03 (row universe = full union):** Registry table shows built-in `config.py` MODEL_CAPABILITIES models (dim DEF rows) ∪ DB override rows (OVR) ∪ discovery-confirmed new models as DB-only rows. A confirmed new model works end-to-end with ZERO code edits (read path already supports it). `config.py` = shipped baseline; DB = living registry.
- **D-149-04 (deprecated = own column):** Add `deprecated boolean` (+ optional small reason/note field) to `model_capabilities_overrides` in the 149 migration. Deprecated ≠ disabled: deprecated = "provider sunsetting / vanished — warn, steer away" and can stay enabled; disabled = "operator turned it off — hidden from picker, refused."
- **D-149-05 (deprecated end-user effect = badge only):** Deprecated-but-enabled model stays selectable with a small informational "deprecated" badge in the user picker. No refusal path; only `enabled` controls availability.
- **D-149-06 (advanced facets deferred):** emit_tier, max_tools, parallel tool calls, prefill, strict_json etc. stay code-only in 149 (v3.4). Optionally render read-only behind ⌥ Technical names.

**Lock semantics + picker coupling:**
- **D-149-07 (lock = pin org default):** Locking a model sets it as org-wide default (writes `llm_model`) + marks policy "locked"; when v3.4 per-user layer arrives, locked = users cannot override. At most ONE model carries the lock.
- **D-149-08 (picker becomes registry-driven):** User-facing model picker list BECOMES the registry — enabled models from the full union, grouped by provider. `provider_model_lists` (app_settings jsonb) retires or becomes a transition fallback. One chain: discovery → confirm → enabled → picker.
- **D-149-09 (guards, per the 146-148 graded-guards rule):** Disabling the current org-default (or locked) model is REFUSED with a plain explanation; locked ⇒ unlock first. No dead default can ever exist. Ordinary disables stay a direct flip + ✎ receipt (reversible).
- **D-149-10 (disabled-model UX = fallback + notice):** A user's next message on a just-disabled model runs on the org default instead, with an honest inline notice. Never breaks mid-conversation, never silent. `enabled` exists since mig 053 but nothing enforces it today — 149 makes it real.

**Discovery run lifecycle:**
- **D-149-11 (sync fan-out):** One POST fans out to all keyed providers concurrently server-side (per-provider timeout ~10-15s), returns the full diff in one response. Run cards show client-side timers, then per-provider verbatim errors (rate-limited = excluded-not-failed, the 058/060 lesson) and "capabilities ✓ / IDs only" badges. No new streaming/job infra (red line: no new runtime).
- **D-149-12 (proposals are ephemeral):** Diff lives in the response/UI only. Confirming applies changes immediately with receipts; navigating away discards. No proposals table, no staleness lifecycle.
- **D-149-13 (new models land disabled + opt-in enable):** Every confirmed new model lands `enabled=false`. Confirm flow offers "enable now" tick per model ONLY where capabilities are complete — provider-returned (Google/OpenRouter) or hand-filled in the amber "unknown — you set it" inputs. Enabling is always an explicit operator act; SC#3 preserved to the letter.
- **D-149-14 (provider scope = 8 cloud, keyed only):** Discovery covers the 8 cloud providers from `scripts/curate_models.py`; a provider with no key renders "no key — skipped" (honest, not failed). Local Ollama/LM Studio out.

**Folded bug + picker polish:**
- **D-149-15 (BUG-260620-01 FOLDED):** Enforce the output-token clamp — a resolved `max_tokens` is capped by the model's (DB-overridable) `max_output_tokens` at the shared resolution point. Trace the failing path first (evidence rule); the clamp data already exists (`openai_service.py:1301` region).
- **D-149-16 (BUG-260711-02 DEFERRED to SEED-114 + UAT stopgap):** 149 adds ONE UAT row proving the operator can flip gpt-5.6 `native_tools` off in the new UI and a tool-carrying chat then works via the prompt-injected path — doubling as the SC#1 "capability change affects routing live, no restart" proof.
- **D-149-17 (bounded picker polish, in-149):** Add provider logos (@lobehub/icons per RDD 48), group models by provider, declutter rows — model name primary, context/output demoted to a secondary line/tooltip, deprecated badge. Explicitly NO redesign — same component, same interaction, visual pass only.

### Claude's Discretion
- Lock storage shape (policy flag(s) beside `llm_model` in `app_settings` vs elsewhere) — must satisfy "one lock max" + survive the v3.4 per-user layer
- Where the enabled/fallback enforcement lives on the request path (and how the fallback notice is emitted — reuse an existing SSE event shape if one fits)
- Migration numbering (next free from the live tree at planning) + full-schema regen + cloud-parity notes
- Discovery diff computation details (what counts as "changed" per provider payload shape; extractors already exist in `curate_models.py`)
- Registry write API shape in `admin.py` (`require_operator` router-level + `operator_audit_floor` per-write; upsert vs field-patch semantics)
- Audit action vocabulary details beyond `model.capability.set` / `model.discover`
- TTL-cache invalidation details for `_load_model_overrides` (change must be visible on next request per SC#1 — verify existing TTL suffices across WORKER_COUNT=2)
- How DEF (inherited) values render vs OVR (stored) in API responses (the editor needs both to show Reset)

### Deferred Ideas (OUT OF SCOPE)
- Advanced routing-facet editing (emit_tier, max_tools, parallel, prefill, strict_json) → v3.4 config-consolidation
- Per-user model preference within the allowed set (revive `user_settings.preferences`, dead since mig 011) → v3.4
- OpenAI Responses-API adapter → SEED-114
- Local-provider discovery (Ollama `/api/tags`, LM Studio `/v1/models`) → deferred
- Persisted discovery proposals (survive navigation) → documented alternative if ephemeral annoys
- Full picker redesign → Phase 156 or its own sketch
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **MODEL-01** | Operator can edit model capabilities (enable/disable, max tokens, timeout, native tools, deprecated) from the admin shell — write UI + operator-gated write path over the ALREADY-LIVE `model_capabilities_overrides` table + hot-path read (mig 053); changes take effect without restart (existing TTL cache) | Read path `get_model_capability_async` + `_load_model_overrides` verified live (config.py:680, user_settings.py:331). Write path joins `admin.py` router (require_operator + operator_audit_floor). Migration 099 adds `deprecated`. TTL invalidation via `invalidate_model_overrides_cache()` (user_settings.py:359). §Architecture, §Pitfall 1 (enabled-only read gap), §Pitfall 3 (per-worker TTL). |
| **MODEL-02** | Operator can run live model discovery — a service (lifted from `scripts/curate_models.py`) queries each provider's `/models` and PROPOSES new/changed/vanished models for confirmation; never auto-enables capabilities the endpoint didn't return (only 2 of 8 providers return capability metadata) | `curate_models.py` PROVIDER_ENDPOINTS + `_extract_openai_compat`/`_extract_minimax` + `sort_newest_first` verified reusable. Provider `/models` capability asymmetry verified provider-docs-first (§Provider /models capability matrix). Async fan-out via httpx.AsyncClient + asyncio.gather (no new package). §Pitfall 5 (native_tools only derivable from OpenRouter). |
</phase_requirements>

## Summary

This phase is **~70% wiring over already-shipped substrate, ~30% net-new** — a write UI and operator-gated write endpoints over the `model_capabilities_overrides` table (live since migration 053) plus a live-discovery service that is a **lift-and-wrap of `scripts/curate_models.py`** (its per-provider endpoints, auth styles, response-shape extractors, and newest-first sort already exist and are verified). The read path (`get_model_capability_async`, config.py:680) already merges DB overrides onto inferred defaults, so a discovery-confirmed **DB-only model works end-to-end with zero code edits** (D-149-03). No new external packages: the async fan-out uses `httpx.AsyncClient` (already a backend dependency, used in `rerank_service.py`) and the picker/registry logos reuse `@lobehub/icons` (already in `package.json`).

The **load-bearing honesty beat (SC#3)** rests on a provider-verified fact: of the 8 cloud providers, only **OpenRouter** returns a fully capability-rich `/models` payload (`context_length`, `top_provider.max_completion_tokens`, `supported_parameters` including `"tools"`), and only **Google** returns token limits (`inputTokenLimit`/`outputTokenLimit`) — but Google returns **no native-tools boolean** (only `supportedGenerationMethods`). OpenAI, Anthropic (native), and the four OpenAI-compat natives (DeepSeek/Moonshot/Zhipu/MiniMax) return **IDs only**. Therefore discovery may auto-fill **token limits for Google+OpenRouter and `native_tools` for OpenRouter alone**; every other field on every other provider must render as the amber "unknown — you set it" input and **never auto-enable** (reproducing the silent no-tools bug is barred).

Three code seams need surgical attention, each documented below with evidence: (1) the capability **read cache filters `WHERE enabled = true`** (user_settings.py:345), so the editor needs a **separate all-rows read** to show disabled rows, and disabling a *static* model requires writing an `enabled=false` override + teaching `_build_providers` to filter it out (D-149-08/10 — "making `enabled` real"); (2) the **max-tokens clamp reads the static `MODEL_CAPABILITIES` dict, not the DB overlay**, and clamps against `user_settings.llm_model` rather than the effective model sent (openai_service.py:1368-1371) — the D-149-15 clamp fix must make it DB-aware and effective-model-correct; (3) the **TTL cache is per-worker in-process** (WORKER_COUNT=2), so an edit is immediately visible only on the worker that served the write and within ≤30s on the other — the 147 kill-switch precedent ("effective on their next call within the TTL") is the accepted SC#1 semantics.

**Primary recommendation:** Add migration 099 (`deprecated boolean` + optional `deprecated_reason`); add a new `admin.py` sub-router group for `/admin/models` (registry read all-rows + capability upsert with a **code-constant field allowlist**, the `_FLAG_KEYS` pattern) and `/admin/models/discover` (async httpx fan-out wrapping the `curate_models.py` extractors); wire `invalidate_model_overrides_cache()` on every write; make the clamp DB-aware; enforce `enabled` on `_build_providers` + the request-path resolution with a fallback notice; unlock the Model Registry tab with 070-A + 071-A. Ship the picker polish (logos + grouping) as a visual-only pass.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Model-capability edit (write) | API / Backend (`admin.py`) | Database (`model_capabilities_overrides`) | Operator write is a governance action — must be gated at the router (no RLS backstop) and audited; the DB is the store of record |
| Capability read on request path | API / Backend (`config.py` + `user_settings.py` cache) | Database | Already live (mig 053); hot path with 30s TTL cache — do not add per-request DB reads |
| Live model discovery | API / Backend (`admin.py` + new discovery service) | External provider `/models` APIs | Concurrent fan-out to 8 external endpoints; keys live server-side; NEVER call provider APIs from the browser |
| Registry table + discovery UI | Frontend Server (React SPA, Control Room) | API | Pure render of API-supplied registry/diff; the Control Room shell already exists (146-148) |
| User model picker (registry-driven) | Frontend (chat/Settings) | API (`GET /settings` → providers[].models) | Picker consumes the already-built provider→models list; `enabled` filtering happens server-side in `_build_providers` |
| Enabled-enforcement + fallback notice | API / Backend (shared request-path model resolution) | Frontend (SSE notice render) | Must live at the ONE shared resolution seam — never fork per provider (red line) |
| Max-tokens clamp (D-149-15) | API / Backend (`openai_service._resolve_max_tokens`) | — | Provider-boundary concern; the clamp is the single chokepoint (Phase 074 D-074-01) |

## Standard Stack

### Core — all ALREADY PRESENT (zero new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `httpx` | >=0.28.0 `[VERIFIED: backend/requirements.txt]` | Async concurrent `/models` fan-out (`AsyncClient` + `asyncio.gather`) | Already the backend HTTP client (`rerank_service.py`, `web_search_service.py` use `httpx.AsyncClient`); async-native, per-request timeout, no thread pool needed |
| `asyncpg` (via `get_pg_pool`) | existing | Registry reads/writes on the hot path + editor all-rows read | Already the substrate for `_load_model_overrides` / `save_app_settings`; parameterized queries |
| `supabase-py` (service role, via `run_in_threadpool`) | existing | Audit-ledger writes for `model.capability.set` / `model.discover` | The 146-148 operator-audit path; wrap blocking calls per D-v2.5-01 |
| `@lobehub/icons` | ^5.10.0 `[VERIFIED: frontend/package.json]` | Provider logos in the registry table AND the picker polish (D-149-17) | The RDD 48 single-source icon convention (Phase 127/128) |
| `fastapi` `APIRouter` w/ `Depends(require_operator)` | existing | Router-level operator gate for all new `/admin/models*` routes | Phase 146 default-deny 404 pattern (admin.py:96) |

### Supporting — reuse from `scripts/curate_models.py` (lift, don't rewrite)
| Asset | Location | Purpose | When to Use |
|-------|----------|---------|-------------|
| `PROVIDER_ENDPOINTS` | curate_models.py:67 `[VERIFIED: codebase]` | 8-provider URL + auth-style + key-env table | Discovery service endpoint map — copy verbatim into a service module |
| `_extract_openai_compat` / `_extract_minimax` | curate_models.py:140/153 `[VERIFIED]` | Per-response-shape ID + created-stamp extractors | Parse each provider's payload (provider-docs-first — shapes differ) |
| `sort_newest_first` | curate_models.py:263 `[VERIFIED]` | Newest-first ordering (epoch/ISO stamp or lexical fallback) | Order proposed new models in the diff |
| Google/Anthropic pagination logic | curate_models.py:222-243 `[VERIFIED]` | `nextPageToken` (google) + `has_more`/`last_id` (anthropic) loops | Discovery must paginate these two or it truncates the list |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `httpx.AsyncClient` async fan-out | `requests` (as curate_models.py uses) wrapped in `run_in_threadpool` + `asyncio.gather` | Works and reuses the script literally, but blocks 8 threadpool workers for ~10-15s each; `httpx.AsyncClient` is already present and non-blocking. Prefer httpx. |
| New `deprecated` column | Overload `enabled` / a JSONB `flags` blob | Explicit column is queryable, cheap, and matches D-149-04 "deprecated ≠ disabled" (two independent states). Do not conflate. |
| Ephemeral proposals (D-149-12) | A `discovery_proposals` table | Locked as ephemeral — no staleness lifecycle, re-running is cheap. Don't build a table. |

**Installation:** None. `httpx>=0.28.0` and `@lobehub/icons@^5.10.0` are already installed.

**Version verification:**
```bash
grep -i httpx backend/requirements.txt        # httpx>=0.28.0 — CONFIRMED
grep lobehub frontend/package.json            # "@lobehub/icons": "^5.10.0" — CONFIRMED
```

## Package Legitimacy Audit

**No external packages are installed by this phase.** Every dependency (`httpx`, `asyncpg`, `supabase-py`, `fastapi`, `@lobehub/icons`) is already present and vetted in prior phases. slopcheck / registry verification is **not applicable** — nothing new is added to `requirements.txt` or `package.json`.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
OPERATOR (Control Room, operator-only, 404-non-discoverable)
   │
   ├─ Model Registry tab (070-A) ──────────────────────────────────┐
   │    GET /admin/models  (all rows: enabled + disabled + DEF)     │
   │    PATCH /admin/models/{id}  (capability upsert, field allowlist)
   │    │                                                            │
   │    ▼                                                            │
   │  admin.py router  [Depends(require_operator)]  +  operator_audit_floor
   │    │  validate field name ∈ code allowlist (never free-text SQL)│
   │    │  run_in_threadpool(supabase write)  →  ✎ model.capability.set
   │    ▼                                                            │
   │  model_capabilities_overrides (DB)  ←── migration 099 adds `deprecated`
   │    │                                                            │
   │    └─ invalidate_model_overrides_cache()  (this worker; others ≤30s TTL)
   │                                                                 │
   └─ "⟳ Run discovery" (071-A) ─────────────────────────────────┐  │
        POST /admin/models/discover                              │  │
        │  ✎ model.discover                                      │  │
        ▼                                                        │  │
   discovery_service  (lift curate_models.py extractors)         │  │
        │  httpx.AsyncClient + asyncio.gather (per-provider ~10-15s timeout)
        │     ├─ keyed?  no → "no key — skipped"                  │  │
        │     ├─ 429/error → verbatim error, EXCLUDED not failed  │  │
        │     └─ 200 → extract ids (+caps for google/openrouter)  │  │
        ▼                                                        │  │
   DIFF vs current registry (union: config.py ∪ DB rows)         │  │
        ✚ New (land enabled=false)  ± Changed  ⊘ Vanished(flag)  │  │
        caps returned → auto-fill; else amber "unknown—you set it"│  │
        │  (ephemeral — lives in the HTTP response only)          │  │
        └─ operator confirms subset → PATCH each → same write path┘  │
                                                                     │
─────────────────────────────────────────────────────────────────────
REQUEST PATH (every user chat message)                               │
   threads.py → model resolution                                     │
        │  get_model_capability_async(model_id)  ◄── DB overlay ─────┘
        │     (reads _load_model_overrides: WHERE enabled=true, 30s TTL)
        │  ENABLED-ENFORCEMENT (new, D-149-10):                       
        │     model disabled? → fall back to org-default llm_model    
        │                     → emit inline SSE notice (names both)   
        ▼                                                             
   openai_service._resolve_max_tokens  ◄── D-149-15 clamp fix        
        clamp = min(resolved, DB-overridable max_output_tokens[effective_model])
        ▼                                                             
   provider API call                                                 
                                                                     
USER PICKER (chat / Settings)                                        
   GET /settings → _build_providers() → providers[].models           
        (enabled DB rows merged; disabled models filtered out — new)  
        → grouped by provider + @lobehub logos + name-primary rows (D-149-17)
```

### Recommended Structure (new/touched files)
```
supabase/migrations/
└── 099_model_registry_deprecated.sql   # deprecated boolean + deprecated_reason (D-149-04); RLS read-all already exists

backend/app/
├── api/admin.py                        # +GET /admin/models, +PATCH /admin/models/{id}, +POST /admin/models/discover
├── services/model_discovery_service.py # NEW — lifts curate_models.py extractors; async httpx fan-out + diff
├── config.py                           # ModelCapability TypedDict: add optional `deprecated`; NO new static models
├── models/user_settings.py             # all-rows registry read; _build_providers enabled-filter; invalidate on write
└── services/openai_service.py          # _resolve_max_tokens: DB-aware clamp against effective_model (D-149-15)

frontend/src/components/admin/
├── ControlRoomPage.tsx                 # unlock model-registry tab → render ModelRegistryTab
├── ModelRegistryTab.tsx                # NEW — 070-A instrument table (provider-grouped, inline-edit, OVR/DEF, lock, coupling chip)
└── ModelDiscoveryPanel.tsx             # NEW — 071-A propose→confirm diff (run cards, new/changed/vanished, "unknown—you set it")

frontend/src/lib/api.ts                 # +getModelRegistry, setModelCapability, runModelDiscovery seams
frontend/src/components/settings/ModelPillRow.tsx (+ chat picker)  # D-149-17 visual polish (logos, grouping)
```

### Pattern 1: Router-level operator gate + per-write audit floor (146-148)
**What:** New model routes join the existing `admin.py` router which already carries `dependencies=[Depends(require_operator)]` — a non-operator gets a byte-identical 404 on every route (non-discoverable). Each *write* additionally attaches `operator_audit_floor` so the action is recorded.
**When to use:** Every `/admin/models*` endpoint.
```python
# Source: backend/app/api/admin.py:96 [VERIFIED: codebase]
router = APIRouter(prefix="/admin", tags=["admin"],
                   dependencies=[Depends(require_operator)])
# ...reads are floor-exempt; writes attach operator_audit_floor + write a ledger row.
```

### Pattern 2: Code-constant field allowlist (never free-text column → SQL)
**What:** `save_app_settings` interpolates column names into the SET clause, so a client-supplied field name must NEVER reach it. Phase 147 guards flag writes with `_FLAG_KEYS`; Phase 148 guards visibility with `_VISIBILITY_FEATURES`. The registry write must do the same for capability columns.
**When to use:** The capability PATCH endpoint.
```python
# Mirror of admin.py:63-70 / :87-93 [VERIFIED: codebase]
_MODEL_CAP_COLUMNS = {
    "llm_call_timeout_seconds", "context_window_tokens",
    "max_output_tokens", "native_tools", "enabled", "deprecated",
}  # any key not in this set is rejected BEFORE any DB write (SQLi-safe)
```

### Pattern 3: DB-overlay capability read (already live — write into what it reads)
**What:** `get_model_capability_async` starts from static defaults (or `_build_inferred_defaults` for DB-only models), overlays non-None DB fields, and tags `capability_source="db_override"`. This is why a discovery-confirmed model needs no code edit (D-149-03).
```python
# Source: backend/app/config.py:680 [VERIFIED: codebase]
db_row = (await _load_model_overrides()).get(model_id)
if db_row is not None:
    base = dict(MODEL_CAPABILITIES.get(model_id, {})) \
        or dict(_build_inferred_defaults(model_id, db_row.get("provider", ...)))
    for field in ("llm_call_timeout_seconds","context_window_tokens","max_output_tokens","native_tools"):
        if db_row.get(field) is not None: base[field] = db_row[field]
    base["capability_source"] = "db_override"
```

### Pattern 4: Per-provider async fan-out with honest per-provider outcomes
**What:** One POST → `asyncio.gather(*[fetch(p) for p in keyed_providers], return_exceptions=True)`. A no-key provider is skipped (honest, not failed); a 429/error provider is **excluded, not failed** (the 058/060 lesson) with its verbatim status; a 200 provider gets its ids extracted and, for google/openrouter, its caps.
**When to use:** `POST /admin/models/discover`.

### Anti-Patterns to Avoid
- **Calling provider `/models` from the browser** — keys are server-side secrets; discovery is a backend fan-out only.
- **Auto-enabling a discovered model or auto-filling native_tools it didn't return** — SC#3 violation; reproduces the silent no-tools bug. New models land `enabled=false` (D-149-13); native_tools auto-fills for OpenRouter ONLY.
- **A generic `split(":")[0]` on model ids in the clamp** — strips legitimate `:free`/`:exacto` suffixes and silently loses clamp protection (openai_service.py:1360-1367 documents this). Use targeted `.removesuffix`.
- **Free-text column name into the SET clause** — always validate against the code allowlist (Pattern 2).
- **Forking the request-path model resolution per provider** — the enabled-enforcement + fallback (D-149-10) must live at the ONE shared seam (red line).
- **A second hand-maintained model list** — the picker BECOMES the registry (D-149-08); `provider_model_lists` retires or is a transition fallback, not a parallel source of truth.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-provider `/models` fetch + auth + pagination + shape parsing | A fresh HTTP layer | `curate_models.py` `PROVIDER_ENDPOINTS` + `_extract_*` + `sort_newest_first` (lift into a service) | Already handles bearer/anthropic/google-query/public auth, google `nextPageToken`, anthropic `has_more`, minimax shape probing, de-dup, newest-first |
| Capability read with DB overlay | A new resolver | `get_model_capability_async` (config.py:680) | Live since mig 053; already does inferred-base + DB-overlay + `db_override` tagging |
| Operator gate + audit | Custom auth check | `Depends(require_operator)` + `operator_audit_floor` (admin.py) | The 146 default-deny 404 is the sole authority (no RLS backstop) |
| TTL cache + invalidation | New cache | `_load_model_overrides` + `invalidate_model_overrides_cache()` (user_settings.py:331/359) | 30s per-worker TTL already wired; SC#1 semantics match 147 kill-switch precedent |
| Max-tokens clamp | New clamp | `_resolve_max_tokens` single chokepoint (openai_service.py:1301) | Phase 074 D-074-01 already routes all branches through one clamp gate — extend it, don't add a second |
| Provider logos | Inline SVGs / emoji | `@lobehub/icons` (RDD 48) | Single-source icon convention already in the codebase (Phase 127/128) |
| Concurrent fan-out | Threads / `requests` loop | `httpx.AsyncClient` + `asyncio.gather` | Already the backend async HTTP client; non-blocking, per-request timeout |

**Key insight:** This phase is almost entirely *composition* of shipped primitives. The genuinely net-new logic is narrow: (1) the diff computation (current registry ∪ vs live ids), (2) the "unknown — you set it" propose-only surface, (3) the `enabled`-enforcement seam, and (4) the DB-aware clamp fix. Everything else is wiring.

## Runtime State Inventory

> This phase changes runtime behavior ("makes `enabled` real"), adds a migration, and touches per-worker caches — runtime state matters here.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `model_capabilities_overrides` DB rows (model_id PK, provider, timeout, context/max-output tokens, native_tools, enabled — mig 053). Local + cloud both have this table. `app_settings.llm_model` (org default, default `'gpt-4o'`). `app_settings.provider_model_lists` (JSONB user-ordered picker lists — retires/fallback per D-149-08). | Migration 099 adds `deprecated`; **apply to local via Supabase SQL editor, then to cloud** (D-149 discretion + STANDING RULE). Existing override rows get `deprecated=false` default — no data backfill needed. |
| **Live service config** | None external — no n8n/Datadog/Tailscale. The provider `/models` endpoints are read-only external calls, not config we own. | None. |
| **OS-registered state** | None (no scheduled tasks / pm2 / systemd tied to this phase). | None. |
| **Secrets/env vars** | 8 provider API keys (`OPENAI_API_KEY` … `MINIMAX_API_KEY`, `OPENROUTER_API_KEY`) drive discovery — read from `backend/.env` (local) / Coolify env (cloud). Names only, values never logged (curate_models.py discipline). Keys are UNCHANGED by this phase. | Verify cloud has the keys for discovery to work in prod; a missing key = "no key — skipped" (honest, non-fatal). |
| **Build artifacts** | Per-worker in-process TTL caches: `_model_overrides_cache` + `_settings_cache` (30s, WORKER_COUNT=2). A write invalidates only the serving worker's cache. `full-schema.sql` must be regenerated after mig 099 (`bash scripts/regenerate-full-schema.sh`, no reset). | On write: call `invalidate_model_overrides_cache()`. Accept ≤30s cross-worker propagation (147 precedent). Regenerate + commit `full-schema.sql`. |

**The canonical question — after every file is updated, what runtime state still holds old truth?** The per-worker TTL caches (≤30s stale on non-serving workers) and any cloud DB row not yet migrated. Both are addressed above.

## Common Pitfalls

### Pitfall 1: The capability read cache is `enabled`-only — the editor can't see disabled rows through it
**What goes wrong:** `_load_model_overrides` runs `SELECT * FROM model_capabilities_overrides WHERE enabled = true` (user_settings.py:345). If the registry editor reads through this cache, disabled models simply vanish from the table — the operator can't re-enable what they can't see, and `_build_providers` can't filter a static model that's been "disabled" because the disabled override never enters the cache.
**Why it happens:** The cache was built for the hot read path (only enabled models matter for routing), not for a management UI.
**How to avoid:** The registry GET endpoint needs a **separate all-rows read** (`SELECT * FROM model_capabilities_overrides` — no enabled filter), unioned with `MODEL_CAPABILITIES` built-ins for DEF rows. Keep the enabled-only cache for the request path. For D-149-10 enforcement (hide/refuse disabled *static* models), `_build_providers` must learn the disabled set (either an all-rows read at build time, or a second small cache) — today it unconditionally appends all static `MODEL_CAPABILITIES` models (user_settings.py:449-455), so a disabled gpt-4o would still show.
**Warning signs:** Disable a model in the editor → it disappears from the editor entirely, or still shows in the user picker.

### Pitfall 2: SC#3 is stricter than "2 providers return capabilities" — native_tools is derivable from OpenRouter ONLY
**What goes wrong:** The inventory says "Google + OpenRouter return capability metadata." True for *token limits*, but **Google returns no native-tools boolean** — only `supportedGenerationMethods` (e.g. `generateContent`), which does not cleanly map to "supports native tool calling." Auto-filling `native_tools` for Google from `/models` would be a guess — an SC#3 violation.
**Why it happens:** Conflating "returns some capabilities" with "returns all capabilities." Provider payloads are asymmetric even among the two rich ones.
**How to avoid:** Auto-fill **token limits** for Google + OpenRouter; auto-fill **native_tools for OpenRouter only** (from `supported_parameters` containing `"tools"`). Everything else, everywhere else → amber "unknown — you set it," never enabled.
**Warning signs:** A newly discovered Google model shows `native_tools=true/false` without the operator setting it.

### Pitfall 3: Per-worker TTL cache — SC#1 "next request, no restart" is bounded by 30s across WORKER_COUNT=2
**What goes wrong:** `invalidate_model_overrides_cache()` zeroes only the *calling* worker's timestamp. With 2 uvicorn workers, an edit served by worker A is instantly visible on A but stale on B for up to 30s. If a test/UAT asserts "immediately visible on the very next request" it may hit worker B and see the old value.
**Why it happens:** In-process caches aren't shared across workers (no Redis-backed invalidation for this cache).
**How to avoid:** Accept the ≤30s window as the SC#1 contract — this is the exact 147 kill-switch precedent ("effective on their next call within the TTL, no restart"). Do NOT build cross-worker invalidation this phase (no new runtime). The D-149-16 UAT row proves "no restart," not "sub-second on all workers."
**Warning signs:** A flaky UAT where the same edit sometimes shows immediately, sometimes after a few seconds.

### Pitfall 4: The clamp reads the STATIC dict against the WRONG model (the actual BUG-260620-01 mechanism)
**What goes wrong:** `_resolve_max_tokens` clamps `min(resolved, MODEL_CAPABILITIES.get(user_settings.llm_model).max_output_tokens)` (openai_service.py:1368-1371) — but (a) it reads the static dict, so an operator's DB-edited `max_output_tokens` is ignored, and (b) it looks up `user_settings.llm_model`, while the request actually calls `effective_model` (line 1508). When those diverge (sub-agent, explicit model, or a resolution mismatch) the clamp consults the wrong model's cap or none — and gpt-4o's 16384 cap isn't enforced → 400.
**Why it happens:** The clamp predates both the DB overlay and the effective-model split.
**How to avoid (D-149-15):** Trace the failing path first (evidence rule). Then clamp against the **effective model actually sent**, resolving its cap through the **DB overlay** (`get_model_capability_async` or an equivalent that consults `_load_model_overrides`) so an operator-edited `max_output_tokens` is honest. Keep the single-chokepoint shape (Phase 074 D-074-01) — extend it, don't fork.
**Warning signs:** Editing `max_output_tokens` in the UI has no effect on the actual request; gpt-4o still 400s on over-cap.

### Pitfall 5: Discovery truncates Google/Anthropic without pagination
**What goes wrong:** Google (`nextPageToken`) and Anthropic (`has_more`/`last_id`) paginate their `/models`. A naive single-GET discovery misses models past the first page → false "vanished" proposals.
**Why it happens:** OpenAI-compat providers return everything in one `data[]`; the two natives don't.
**How to avoid:** Lift the pagination loops verbatim from `curate_models.py:222-243` (they already handle both). Anthropic uses `params["limit"]="1000"` + `after_id`; Google uses `pageSize=1000` + `pageToken`.
**Warning signs:** Discovery reports known Google/Anthropic models as "vanished."

### Pitfall 6: Case-sensitive model-id mismatch silently downgrades capabilities
**What goes wrong:** MODEL_CAPABILITIES lookups are exact-string. `MiniMax-M2.7-highspeed` vs `minimax-m2.7-highspeed` are different keys; a mismatch falls to inferred defaults (native_tools may flip). The registry must preserve the provider's EXACT id casing.
**Why it happens:** Providers use mixed casing (MiniMax PascalCase, others lowercase); the read path keys on exact id.
**How to avoid:** Store and display the provider's verbatim id from `/models`; never normalize case. The `curate_models.py` extractors already preserve casing (`str(el.get("id"))`).
**Warning signs:** A model that "should" have native tools loses them after discovery (the zhipu/minimax tool-drop trap — see `project_cross_provider_native_tools_registry_trap.md`).

### Pitfall 7: Discovery fan-out as an SSRF-adjacent surface — keep it a fixed allowlist
**What goes wrong:** If the discovery endpoint ever accepts a provider URL/base from the client, it becomes a server-side request forgery vector (operator-authed, but still). 
**How to avoid:** The endpoint takes **no URL input** — it iterates the hardcoded `PROVIDER_ENDPOINTS` table only. Provider selection (if offered) is validated against a code-constant set, exactly like `_FLAG_KEYS`.

## Code Examples

### Discovery async fan-out (new service, lifting curate_models.py)
```python
# Source: pattern from backend/app/services/rerank_service.py (httpx.AsyncClient)
#         + scripts/curate_models.py:186 fetch logic [VERIFIED: codebase]
import asyncio, httpx
from scripts_lift import PROVIDER_ENDPOINTS, _extract_openai_compat  # copied into service

async def _fetch_provider(client, provider, key) -> dict:
    cfg = PROVIDER_ENDPOINTS[provider]
    if key is None and cfg["auth"] != "public":
        return {"provider": provider, "status": "no_key"}          # honest skip
    try:
        headers, params = _auth_for(cfg, key)                      # bearer/anthropic/google-query/public
        r = await client.get(cfg["url"], headers=headers, params=params, timeout=12.0)
        if r.status_code != 200:
            return {"provider": provider, "status": f"http-{r.status_code}"}  # excluded, not failed
        ids, caps = _extract(provider, r.json())                   # caps only for google/openrouter
        return {"provider": provider, "status": "ok", "ids": ids, "caps": caps}
    except Exception as e:
        return {"provider": provider, "status": f"error-{type(e).__name__}"}

async def discover_all(keyed: dict[str, str | None]) -> list[dict]:
    async with httpx.AsyncClient() as client:
        return await asyncio.gather(*[_fetch_provider(client, p, k) for p, k in keyed.items()])
```

### Capability write with field allowlist (admin.py)
```python
# Source: mirrors admin.py:63-70 _FLAG_KEYS guard [VERIFIED: codebase]
_MODEL_CAP_COLUMNS = {"llm_call_timeout_seconds", "context_window_tokens",
                      "max_output_tokens", "native_tools", "enabled", "deprecated"}

@router.patch("/models/{model_id}")
async def set_model_capability(model_id: str, patch: dict, request: Request,
                               _floor=Depends(operator_audit_floor)):
    bad = set(patch) - _MODEL_CAP_COLUMNS
    if bad:
        raise HTTPException(400, f"unknown field(s): {sorted(bad)}")  # never reaches SQL
    # ... upsert via asyncpg (parameterized), then:
    invalidate_model_overrides_cache()
    # ... write ✎ model.capability.set ledger row (plain-sentence label, LANG-01)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| New model = hand-edit `MODEL_CAPABILITIES` in config.py (GPT-5.6 was the last, 2026-07-11) | Discovery → confirm → DB-only row, zero code edit (D-149-03) | This phase | Models become data, not code |
| Picker list = hand-maintained `provider_model_lists` JSONB | Picker = registry (enabled union), one chain (D-149-08) | This phase | Single source of truth |
| `enabled` column exists (mig 053) but nothing enforces it | 149 makes `enabled` real: hide from picker + request-path fallback (D-149-10) | This phase | Dormant column activated |
| Clamp reads static dict vs `user_settings.llm_model` | DB-aware clamp vs effective model (D-149-15) | This phase | Edited max_output_tokens becomes honest; BUG-260620-01 closed |

**Deprecated/outdated:**
- The `curate_models.py` script stays as an operator CLI, but its logic is now *also* a service — do NOT let them drift; the service is the lift, the script remains for offline curation.
- `provider_model_lists` JSONB — transitions to fallback/retirement (D-149-08).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next free migration number is **099** (latest on disk is 098_feature_visibility) | Structure / Runtime State | Low — planner re-checks `ls supabase/migrations/` at plan time; number is mechanical |
| A2 | Anthropic's **native** `/v1/models` returns IDs + display_name only (no token/tool caps) — the search hit mentioning `max_input_tokens`/`capabilities` was an aggregator (AI/ML API), not Anthropic-native | Provider matrix / Pitfall 2 | Medium — if Anthropic added caps to native `/models`, discovery could auto-fill more; verify live via `curate_models.py --provider anthropic` at plan/exec time. Current `_extract_openai_compat` only pulls id+created, consistent with IDs-only. |
| A3 | Google's `supportedGenerationMethods` does not give a reliable `native_tools` boolean → leave native_tools as "unknown—you set it" for Google | Pitfall 2 / SC#3 | Low — conservative (propose-only) is always SC#3-safe; worst case operator sets it by hand |
| A4 | The 147 kill-switch "effective on next call within TTL, no restart" precedent is the accepted SC#1 semantics for capability edits (≤30s cross-worker) | Pitfall 3 | Medium — if the operator expects sub-second cross-worker, a Redis-backed invalidation would be needed (out of scope / no new runtime). Confirm at discuss/verify. |
| A5 | `httpx.AsyncClient` is safe for the 8-way fan-out with per-request timeouts (no shared-client concurrency issue) | Stack / Code Examples | Low — httpx AsyncClient is concurrency-safe; already used in rerank/web-search services |

**Note:** A2 is the only assumption that could change what discovery auto-fills. It is conservative in the safe direction (treating Anthropic as IDs-only can only *under*-fill, never violate SC#3). Verify with a live `curate_models.py` run during planning.

## Open Questions (RESOLVED)

> RESOLVED in planning — all three recommendations were adopted (see the inline RESOLVED notes below).

1. **Lock storage shape (Claude's discretion)**
   - What we know: Lock pins the org default (writes `app_settings.llm_model`) + marks policy "locked"; at most one lock; must survive the v3.4 per-user layer (D-149-07).
   - What's unclear: Where the "locked" policy flag lives — a new `app_settings` column (`llm_model_locked boolean`) vs a small JSONB policy blob.
   - Recommendation: A single `llm_model_locked boolean` column beside `llm_model` is the least-surprise, forward-compatible choice (the v3.4 per-user layer reads it to block user override). Decide in planning; it's a 1-column addition to mig 099.
   - RESOLVED: adopted — single `llm_model_locked boolean` column on `app_settings`, mig 099 (Plan 149-01).

2. **Enabled-enforcement seam on the request path (Claude's discretion)**
   - What we know: Must live at the ONE shared model-resolution spot (never per provider); fallback to org default + inline notice (D-149-10).
   - What's unclear: The exact function in `threads.py` that resolves the effective model, and whether an existing SSE event shape fits the notice.
   - Recommendation: Locate the single resolution point where `effective_model` is computed (near openai_service.py:1508 / the threads.py model-resolve seam), enforce enabled there, and reuse an existing informational SSE event (the same channel used for `scope_violation`-style notices) rather than inventing a new event. Planner should grep `effective_model` + the SSE emitter to pin it.
   - RESOLVED: enforced at the threads.py resolution seam, reusing the existing informational SSE event (Plan 149-06 Task 3).

3. **Does the clamp fix require making `_resolve_max_tokens` async?**
   - What we know: It's currently sync and reads the static dict; the DB overlay is async (`_load_model_overrides`).
   - What's unclear: Whether to thread a pre-resolved DB cap into the sync function or make the resolution async.
   - Recommendation: Pass a pre-resolved `max_output_tokens` cap (already fetched via the async capability read on the request path) INTO `_resolve_max_tokens`, keeping it sync — avoids an await deep in the hot path. Confirm during D-149-15 tracing.
   - RESOLVED: pre-resolved `max_output_tokens` cap threaded into the sync `_resolve_max_tokens` — kept sync, no await in the hot path (Plan 149-03).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `httpx` | Discovery async fan-out | ✓ | >=0.28.0 (requirements.txt) | — |
| `@lobehub/icons` | Registry + picker logos | ✓ | ^5.10.0 (package.json) | — |
| `asyncpg` pool (`get_pg_pool`) | Registry reads/writes | ✓ | existing | — |
| Supabase (local + cloud) | `model_capabilities_overrides` store | ✓ | mig 053 live | — |
| 8 provider API keys (local `.env`) | Discovery (per keyed provider) | ⚠ partial | — | Unkeyed provider → "no key — skipped" (honest, non-fatal) |
| 8 provider API keys (cloud/Coolify) | Discovery in prod | ✗ verify | — | Same skip behavior; verify at cloud-parity step |

**Missing dependencies with no fallback:** none — the phase degrades honestly when a provider key is absent (discovery skips it).
**Missing with fallback:** provider keys not configured → that provider is skipped, not failed (D-149-14).

## Validation Architecture

> `workflow.nyquist_validation: true` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest (`asyncio_mode = auto`, `testpaths = tests`) `[VERIFIED: backend/pytest.ini]` |
| Frontend framework | vitest 4.1.0 (`vitest run`) `[VERIFIED: frontend/package.json]` |
| Backend quick run | `cd backend && venv/Scripts/python.exe -m pytest tests/test_149_*.py -x` |
| Backend full suite | `cd backend && venv/Scripts/python.exe -m pytest` |
| Frontend run | `cd frontend && npm run test -- ModelRegistry` |
| Frontend build gate | `cd frontend && npm run build` (NOT `tsc --noEmit`) — baseline is 30 pre-existing `tsc -b` errors (21 SEED-056 rot + 9 React-19 drift); new files must add ZERO and `vite build` must be green `[VERIFIED: 148 STATE.md notes]` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MODEL-01 | Non-operator gets 404 on `/admin/models*` | unit | `pytest tests/test_149_model_gate.py -x` | ❌ Wave 0 (mirror test_146_operator_gate.py) |
| MODEL-01 | Capability PATCH rejects unknown field (SQLi-safe) | unit | `pytest tests/test_149_model_write.py::test_field_allowlist -x` | ❌ Wave 0 |
| MODEL-01 | PATCH invalidates cache → next read reflects edit | unit | `pytest tests/test_149_model_write.py::test_invalidate -x` | ❌ Wave 0 |
| MODEL-01 | Editor read returns disabled + DEF rows (all-rows) | unit | `pytest tests/test_149_registry_read.py -x` | ❌ Wave 0 |
| MODEL-01 | `enabled=false` hides model from `_build_providers` | unit | `pytest tests/test_149_enabled_enforce.py -x` | ❌ Wave 0 |
| MODEL-01 | Disabling org-default/locked → refused (409) | unit | `pytest tests/test_149_default_guard.py -x` | ❌ Wave 0 |
| MODEL-02 | Discovery diff: new/changed/vanished computed correctly | unit (mocked provider payloads) | `pytest tests/test_149_discovery.py -x` | ❌ Wave 0 |
| MODEL-02 | Un-returned capability is NEVER auto-enabled (SC#3) | unit | `pytest tests/test_149_discovery.py::test_propose_only -x` | ❌ Wave 0 |
| MODEL-02 | No-key provider → skipped; 429 → excluded-not-failed | unit | `pytest tests/test_149_discovery.py::test_provider_outcomes -x` | ❌ Wave 0 |
| D-149-15 | max_tokens clamp fires on effective model + DB cap | unit | `pytest tests/test_149_clamp.py -x` | ❌ Wave 0 |
| MODEL-01 | Registry table renders OVR/DEF + coupling chip + lock | component | `npm run test -- ModelRegistryTab` | ❌ Wave 0 |
| MODEL-02 | Discovery panel renders "unknown—you set it" amber inputs | component | `npm run test -- ModelDiscoveryPanel` | ❌ Wave 0 |

### SC#10 Cross-Provider UAT (MANDATORY — capability changes affect provider routing)
Authored under VALIDATION.md, NOT PLAN.md tasks. All 4 axes required:
- **Cross-provider (4+):** OpenAI, Anthropic, Google, OpenRouter — edit a capability on each, verify effect on next request. The **D-149-16 gpt-5.6 native_tools flip** is one row (flip off → tool-carrying chat works via prompt-injected path → doubles as SC#1 "no restart" proof).
- **Multi-tool:** ≥1 row with 2+ tools in one prompt after a capability edit.
- **Parallel-thread:** ≥1 row — Thread A streaming while Thread B accepts a prompt on a just-disabled model (fallback notice fires, no mid-conversation break).
- **Long-message:** ≥1 row ≥50 prior messages or ≥5KB prompt on an edited model.

### Sampling Rate
- **Per task commit:** `pytest tests/test_149_<area>.py -x` (backend) / `npm run test -- <Component>` (frontend)
- **Per wave merge:** full backend `pytest` + `npm run build` (green)
- **Phase gate:** full suite green + SC#10 4-axis live UAT before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_149_model_gate.py` — MODEL-01 non-operator 404 (mirror `test_146_operator_gate.py`)
- [ ] `backend/tests/test_149_model_write.py` — field allowlist + cache invalidation
- [ ] `backend/tests/test_149_registry_read.py` — all-rows editor read (enabled + disabled + DEF)
- [ ] `backend/tests/test_149_enabled_enforce.py` — `_build_providers` disabled filter + request-path fallback
- [ ] `backend/tests/test_149_default_guard.py` — org-default/locked disable refused
- [ ] `backend/tests/test_149_discovery.py` — diff + propose-only + provider outcomes (mocked payloads; mock ALL 8)
- [ ] `backend/tests/test_149_clamp.py` — D-149-15 effective-model + DB-cap clamp
- [ ] `frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx`
- [ ] `frontend/src/components/admin/__tests__/ModelDiscoveryPanel.test.tsx`
- [ ] No framework install needed (pytest + vitest present)

## Security Domain

> `security_enforcement` absent in config → enabled. Section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Operator surface is default-deny 404 at the router; no RLS backstop (service-role) — the gate IS the authority |
| V4 Access Control | yes | `Depends(require_operator)` router-level (admin.py:96); every write independently 404-gated server-side; a forged operator flag fetches nothing (Pitfall 13/147) |
| V5 Input Validation | yes | Capability field names validated against `_MODEL_CAP_COLUMNS` code allowlist BEFORE any SQL (never free-text column); numeric bounds on tokens/timeout; model_id stored verbatim (case-sensitive), parameterized asyncpg |
| V7 Error Handling & Logging | yes | Every write records a `model.capability.set` / `model.discover` ledger row (operator_audit_floor); provider errors are names-only (no key/body echo — curate_models.py discipline) |
| V10 Malicious Code / SSRF | yes | Discovery iterates a HARDCODED `PROVIDER_ENDPOINTS` table — no client-supplied URL/base ever reaches the HTTP client (Pitfall 7) |
| V6 Cryptography | no | No new secrets handled here (provider keys already exist; encryption is Phase 150) |

### Known Threat Patterns for {operator model-registry + external fan-out}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-operator reaches model-write path (SC#4) | Elevation of Privilege | Router-level `require_operator` 404 default-deny; no RLS backstop means the gate is load-bearing — test it (mirror test_146_operator_gate.py) |
| Client-supplied column name → SQL injection into SET clause | Tampering | `_MODEL_CAP_COLUMNS` allowlist rejects unknown fields before the DB write (Pattern 2) |
| SSRF via discovery endpoint accepting a provider URL | Tampering/Info-disclosure | Fixed `PROVIDER_ENDPOINTS` table only; provider selection validated against a code-constant set |
| Provider key leakage in discovery errors/logs | Information Disclosure | Names-only failure messages (`http-{status}`), values never printed (curate_models.py:218 precedent) |
| Auto-enabling an un-returned capability (silent no-tools bug) | Tampering (integrity of routing) | SC#3 propose-only: new models land `enabled=false`; native_tools auto-fills for OpenRouter only; else "unknown—you set it" |
| Cross-user data exposure via editor | Information Disclosure | Registry is global config (not user data); operator-only; audited |

## Provider `/models` Capability Matrix (provider-docs-first — the SC#3 evidence base)

| Provider | `/models` returns | Token limits? | native_tools derivable? | Discovery auto-fill | Source |
|----------|-------------------|:---:|:---:|---------------------|--------|
| **OpenRouter** | `id, name, created, context_length, max_completion_tokens, supported_parameters[], architecture.modality, pricing, top_provider{context_length,max_completion_tokens,is_moderated}` | ✓ | ✓ (`supported_parameters` contains `"tools"`) | context + max-output + native_tools | `[CITED: openrouter.ai/docs models]` |
| **Google** | `name, displayName, description, inputTokenLimit, outputTokenLimit, supportedGenerationMethods[], thinking, temperature…` | ✓ | ✗ (only `supportedGenerationMethods`, no clean tools boolean) | context + max-output ONLY; native_tools = "unknown—you set it" | `[CITED: ai.google.dev/api/models]` |
| **OpenAI** | `id, object, created, owned_by` | ✗ | ✗ | IDs only → all caps "unknown—you set it" | `[VERIFIED: web search, developers.openai.com]` |
| **Anthropic** (native) | `type, id, display_name, created_at` + `has_more/first_id/last_id` | ✗ | ✗ | IDs only → all caps "unknown—you set it" | `[VERIFIED: web search, platform.claude.com]` (see A2) |
| **DeepSeek** | OpenAI-compat `data[].id` | ✗ | ✗ | IDs only | `[VERIFIED: curate_models.py extractor]` |
| **Moonshot** | OpenAI-compat `data[].id` | ✗ | ✗ | IDs only | `[VERIFIED: curate_models.py extractor]` |
| **Zhipu** | OpenAI-compat `data[].id` | ✗ | ✗ | IDs only | `[VERIFIED: curate_models.py extractor]` |
| **MiniMax** | probes `data[]`/`model_list[]`/bare list → id | ✗ | ✗ | IDs only | `[VERIFIED: curate_models.py:153 _extract_minimax]` |

**The one-line takeaway for SC#3:** only OpenRouter yields a `native_tools` signal from `/models`; only Google+OpenRouter yield token limits. Everything else, and native_tools on Google, is propose-only "unknown — you set it." This is why the 071-A "capabilities ✓ / IDs only" per-provider badge exists.

## Sources

### Primary (HIGH confidence)
- Codebase (grep/read, 2026-07-12): `backend/app/config.py:680` (`get_model_capability_async`), `:233` (MODEL_CAPABILITIES), `:141` (ModelCapability TypedDict), `:477` (`_build_inferred_defaults`); `backend/app/models/user_settings.py:331/345/359` (`_load_model_overrides` enabled-only + invalidate), `:400-471` (`_build_providers`); `backend/app/services/openai_service.py:1301-1378` (`_resolve_max_tokens` clamp); `backend/app/api/admin.py:96` (router gate), `:63-93` (allowlist patterns); `scripts/curate_models.py` (PROVIDER_ENDPOINTS + extractors + pagination); `supabase/migrations/053_settings_unification.sql`; `frontend/src/components/admin/ControlRoomPage.tsx` (locked model-registry tab)
- `ai.google.dev/api/models` — models.list field list (inputTokenLimit, outputTokenLimit, supportedGenerationMethods, thinking) `[CITED]`
- `.planning/notes/dynamic-control-inventory.md` §"Discovery ≠ full capabilities" — the operator-confirmed SC#3 base
- `.planning/sketches/070-*/README.md` + `071-*/README.md` — the locked build contract (winner A both)

### Secondary (MEDIUM confidence)
- OpenRouter `/api/v1/models` fields (context_length, supported_parameters incl. tools, top_provider.max_completion_tokens, architecture) — WebSearch cross-referenced multiple sources incl. openrouter.ai docs + community `[CITED]`
- OpenAI `/v1/models` = id/object/created/owned_by — WebSearch, developers.openai.com reference
- Anthropic native `/v1/models` = type/id/display_name/created_at + pagination — WebSearch, platform.claude.com (see Assumption A2 caveat re: aggregator conflation)

### Tertiary (LOW confidence)
- None load-bearing. Anthropic native-vs-aggregator field ambiguity flagged as A2 for live verification via `curate_models.py --provider anthropic` at plan/exec time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; both reused deps verified in requirements.txt / package.json
- Architecture / code seams: HIGH — every seam read directly from source (read path, cache, clamp, router, `_build_providers`)
- Provider `/models` shapes: HIGH for OpenAI/Google/OpenRouter and the OpenAI-compat natives (verified in extractors); MEDIUM for Anthropic native (A2 — verify live, but conservative default is SC#3-safe)
- Pitfalls: HIGH — Pitfalls 1, 3, 4, 6 derived from exact code lines; Pitfall 2/5 from provider docs + curate_models.py

**Research date:** 2026-07-12
**Valid until:** 2026-08-11 (stable — internal seams; re-verify provider `/models` shapes if a provider revises its API, and re-check the migration number at plan time)

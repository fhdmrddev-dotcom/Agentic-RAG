---
phase: 149
slug: model-registry-discovery
status: verified
threats_open: 0
asvs_level: 2
block_on: high
created: 2026-07-13
register_authored_at_plan_time: true
verified_by: gsd-security-auditor (opus)
---

# Phase 149 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verify-mitigations audit (plan-time register, 12 plans). Every `mitigate` threat's
> mitigation was grep-verified present in code with file:line evidence — not inferred
> from documentation. Corroborated by live UAT 12/12 (149-HUMAN-UAT.md) and round-3
> code review (149-REVIEW.md, 0 critical).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → `/admin/models*` | Operator-authed but untrusted body; field names + values cross into DB writes. **No RLS backstop** — the router `require_operator` 404 gate + `_MODEL_CAP_COLUMNS` allowlist are the sole authority. | model-capability edits, lock/unlock, discover selection |
| backend → external provider `/models` | Server-side outbound calls carrying provider API keys; keys are secrets, responses untrusted. URLs come only from the hardcoded `PROVIDER_ENDPOINTS` table. | provider API keys (out), untrusted model catalogs (in) |
| operator DB override → request path | `model_capabilities_overrides.native_tools`/`max_output_tokens`/`enabled` (operator-controlled) flow through the warm TTL cache into calling-mode + routing decisions. | routing-integrity flags |
| backend SSE run stream → frontend consumer | An honest model-swap notice must reach the user; a dropped `model_disabled_fallback` event = a silent swap (the D-149-10 ban). | fallback notice (both model names) |
| LLM output → suggestion chips (UI) | Untrusted model-generated content is parsed into clickable follow-up chips; reasoning models emit `<think>` inline. | chain-of-thought (must be stripped) |
| operator → DB schema (mig 099) | Metadata-only DDL applied by the human operator via the Supabase SQL editor (never `db push`/`db reset`). | schema (idempotent ADD COLUMN) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-149-01 | Tampering | mig099 DDL | accept | Idempotent `ADD COLUMN IF NOT EXISTS` ×3, no destructive stmt — `099_model_registry_deprecated.sql:29-37` | closed |
| T-149-02 | Info-Disclosure | new columns | accept | overrides `SELECT TO authenticated USING(true)` (`053:49-50`); deprecated/reason global config; `llm_model_locked` service-role write | closed |
| T-149-03 | SSRF | discover_all URL source | mitigate | Hardcoded `PROVIDER_ENDPOINTS` (`model_discovery_service.py:49-66`); iterated only (`:353`); no URL param (`:342-351`) | closed |
| T-149-04 | Info-Disclosure | provider error messages | mitigate | Names-only: `http-{status}` (`:262`), `error-{ExceptionName}` (`:328-331`) — body/key never echoed | closed |
| T-149-05 | Tampering (routing) | compute_diff capability fill | mitigate | `enabled=False` (`:410`); `_CAPS_PROVIDERS={google,openrouter}` (`:75`); `UNKNOWN` sentinel (`:406`), never auto-enable | closed |
| T-149-06 | DoS (self-400) | max-tokens clamp | mitigate | `min(resolved, db_max_output_cap)` against effective model DB cap — `openai_service.py:1305-1409` (BUG-260620-01) | closed |
| T-149-07 | Tampering (clamp loss) | model-id suffix | mitigate | Targeted `.removesuffix(":exacto")` (`:1401`); no `split(":")[0]` present | closed |
| T-149-08 | EoP | api.ts registry seams | mitigate | `encodeURIComponent` (`api.ts:4185/4200`); `ApiError` on non-2xx (`:4171/4190/4205/4214`); backend 404 is sole wall (`:4056`) | closed |
| T-149-09 | Info-Disclosure | picker deprecated badge | accept | Informational only; `deprecated_models` global config | closed |
| T-149-10 | EoP (SC#4) | GET/PATCH /admin/models | mitigate | Router `Depends(require_operator)` (`admin.py:128-132`) → byte-identical 404 (`dependencies.py:247-264`); `test_149_model_gate.py:24-44` | closed |
| T-149-11 | SQLi | PATCH field names | mitigate | 422 before SQL (`admin.py:1100-1105`); cols only from allowlist (`:1169`); values `$N` binds (`:1183-1190`); `test_149_model_write.py:64-75` | closed |
| T-149-12 | Repudiation | capability writes | mitigate | `model.capability.set` receipt (`admin.py:1213`); `write_failed` + real 500 on persist fail (`:1205`) | closed |
| T-149-13 | Tampering (cache) | invalidate on write | mitigate | `invalidate_model_overrides_cache()` on every successful write (`admin.py:1212`) | closed |
| T-149-14 | SSRF | discover endpoint | mitigate | Selection validated vs `set(PROVIDER_ENDPOINTS)` → 422 before fan-out (`admin.py:1360-1371`); no client URL | closed |
| T-149-15 | Availability (dead default) | disable + lock guard | mitigate | 409 disabling org-default/locked (`admin.py:1140-1164`) + 409 locking disabled (`:1286-1290`), both before write (D-149-09) | closed |
| T-149-16 | Repudiation (silent routing) | fallback notice | mitigate | Emit `model_disabled_fallback` w/ both model names + message (`threads.py:1329`) | closed |
| T-149-17 | Repudiation | lock/discover writes | mitigate | `model.lock`/`model.unlock` (`admin.py:1298/1308`), `model.discover` (`:1399`) receipts | closed |
| T-149-18 | EoP | Model Registry tab | mitigate | Server 404-gate is authority (`dependencies.py:247-264`); tab consumes `/admin/models` only | closed |
| T-149-19 | Tampering (SC#3) | discovery "enable now" | mitigate | Enable-now disabled until `isComplete` (`ModelDiscoveryPanel.tsx:14/115-117/152-153`); unknown → amber, never auto-enable | closed |
| T-149-20 | Repudiation | inline capability writes | mitigate | ✎ receipt flash (`ModelRegistryTab.tsx:236/243/352`) + server ledger row (T-149-12) | closed |
| T-149-21 | EoP (SC#4) | PUT lock + POST discover | mitigate | Both non-GET routes inherit router gate; `test_149_model_gate.py:57-75` (enumeration + discover 404) | closed |
| T-149-22a | Availability (dead default) | lock control on disabled row | mitigate | Gated on ✕ hidden row (`ModelRegistryTab.tsx:12-14/614-615`) + server 409 (`admin.py:1286-1290`) | closed |
| T-149-22b | Tampering (inert control) | resolve_calling_mode | mitigate | `db_native is False → CallingMode.STRUCTURED` via warm cache (`openai_service.py:1578-1580`) | closed |
| T-149-23 | Repudiation / regression | resolve_calling_mode | mitigate | Stays `def`/sync (`:1559`); collapses to `cap["native_tools"]` when override None (`:1597`) — D-14 | closed |
| T-149-24 | SQLi (routed slash id) | PATCH/PUT model routes | mitigate | `{model_id:path}` routing only (`admin.py:1061`); id → `$1` bind (`:1190`); allowlist unchanged (`:1100`) | closed |
| T-149-25 | EoP (:path routes) | PATCH/PUT model routes | mitigate | `require_operator` untouched by `:path` (`dependencies.py:247-264`) | closed |
| T-149-26 | Repudiation (silent routing) | frontend SSE consumer | mitigate | Dispatch both models (`api.ts:697-702`) → stamp (`StreamsProvider.tsx:730-735`) → inline amber render (`MessageItem.tsx:434-441`) (D-149-10) | closed |
| T-149-27 | Repudiation (dishonest audit) | threads.py register_run_start | mitigate | `_reresolve_fallback_provider` (`threads.py:244-275`); re-resolved provider → register_run_start (`:1280/1300`) | closed |
| T-149-28 | Regression (shared path) | api.ts / StreamsProvider / MessageItem / threads.py | mitigate | Fallback branches gated on `_model_fallback_notice` (`threads.py:1279/1327`) — no-op when enabled (D-14) | closed |
| T-149-29 | Info-integrity (provenance) | ModelDiscoveryPanel NewModelRow | mitigate | Per-field three-way suffix full ✓ / IDs only / partial (`ModelDiscoveryPanel.tsx:465-478`), never mislabels | closed |
| T-149-30 | Repudiation (lost input) | ModelRegistryTab DeprecatedControl | mitigate | Enter commits / Escape cancels / one-shot no-double-write guard (`ModelRegistryTab.tsx:416-417/439-442/531-534/579-587`) | closed |
| T-149-11-01 | Tampering | anthropic/google native branch | mitigate | Gate `if active_provider not in ("anthropic","google")` (`agent_loop.py:800-802`) — WR-05 boundary | closed |
| T-149-11-02 | DoS | pre-loop warm-cache await | accept | `get_model_capability_async` TTL cache (`config.py:686-718`); one warm call, no new external call | closed |
| T-149-11-03 | Repudiation | no-override path drift | mitigate | Native no-override resolves NATIVE, no injection (`openai_service.py:1597` + `agent_loop.py:800`) — D-14 | closed |
| T-149-12-01 | Info-Disclosure | suggestion_service completion parse | mitigate | `_strip_think_blocks` (`suggestion_service.py:23-47`) called before line-parse (`:128`) | closed |
| T-149-12-02 | Tampering | no-think regression | mitigate | Text unchanged absent `<think>` (`suggestion_service.py:37/44`); `test_149_suggestion_strip.py` | closed |
| T-149-SC (01–10) | Supply chain (Tampering) | package installs | accept | Zero new deps across all 12 plans; `httpx>=0.28.0` (`requirements.txt:38`) predates phase; no `package.json` change | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-149-01 | T-149-01 | mig099 is metadata-only, idempotent, operator-applied via SQL editor (never `db push`/`reset`); no destructive statement | operator | 2026-07-13 |
| AR-149-02 | T-149-02 | `deprecated`/`deprecated_reason` are global model config (not user data); overrides carry the mig-053 read-all SELECT policy; `llm_model_locked` service-role-write only; no new PII/tenant exposure | operator | 2026-07-13 |
| AR-149-03 | T-149-09 | Model-picker deprecated badge is informational (global config); no authority | operator | 2026-07-13 |
| AR-149-04 | T-149-11-02 | Extra pre-loop `get_model_capability_async` await hits a 30s-TTL cache already read per-iteration; negligible, no new external call | operator | 2026-07-13 |
| AR-149-05 | T-149-SC (01–10) | Zero new packages across all plans; `httpx` (only discovery dependency) predates this phase | operator | 2026-07-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-13 | 41 (32 mitigate + 9 accept classes; SC folds 10 supply-chain entries) | 41 | 0 | gsd-security-auditor (opus) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-13

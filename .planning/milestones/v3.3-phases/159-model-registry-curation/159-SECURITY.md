---
phase: 159
slug: model-registry-curation
status: verified
threats_open: 0
asvs_level: 2
block_on: high
created: 2026-07-18
register_authored_at_plan_time: true
verified_by: gsd-security-auditor (opus)
---

# Phase 159 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verify-mitigations audit (plan-time register across 4 PLAN files — 159-02/03/05/06).
> Every `mitigate` threat's declared mitigation was grep-verified present in the
> implemented code with file:line evidence — never inferred from documentation or intent.
> The one `accept` threat (T-159-SC) was verified by a zero-diff check on every
> dependency manifest across the phase commit window. Corroborated by live UAT 6/6
> (Chrome-MCP + psycopg2, `12f7b5ee`) and clean code review (WR-01/02 fixed inline).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| operator browser → `/admin` API | Operator-authed but untrusted body; field names + values cross into DB writes. **No RLS backstop** — the router `require_operator` 404 gate + code-constant allowlists are the sole authority (SC#4). | `model_id`, `provider`, numeric caps, `native_tools`, flag key/value |
| API → Postgres (asyncpg pool) | Column identifiers + values reach a parameterized `INSERT` / `UPDATE`. Identifiers come only from code constants; values are `$N` binds. | new model-capability row, flag write |
| migration SQL → local/cloud Postgres | Static, metadata-only DDL applied by the human operator via the Supabase SQL editor (never `db push`/`db reset`). | schema (idempotent `ADD COLUMN`) |
| app_settings row → settings readback | A possibly-absent column (`model_discovery_filter_enabled`) is read on **every** settings load; the code ships ahead of the operator-applied migration. | filter-default flag (fail-soft) |
| operator browser (add-by-ID form / discovery panel) → `/admin` API | The client collects `model_id`/`provider`/caps and the filter toggle and submits to the Plan-02/03 write surfaces. The client holds no authority. | add-model body, filter toggle bool |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-159-01 | Elevation/Spoofing | POST /admin/models · PUT /admin/flags | mitigate | Router `dependencies=[Depends(require_operator)]` (`admin.py:134-138`) → BOTH `@router.post("/models")` (`:1123`) and `@router.put("/flags")` (`:513`) inherit the byte-identical 404 gate; module docstring `:3` "Every route here inherits the router-level require_operator gate" | closed |
| T-159-02 | Tampering (SQLi) | add_model_by_id upsert | mitigate | Column names ONLY from code-constant `_ADD_MODEL_CAP_COLUMNS` (`admin.py:1114-1120`) + fixed `model_id`/`provider`/`enabled` (`:1208-1210`); `provider` validated vs `set(PROVIDER_ENDPOINTS)` → 422 before DB (`:1159-1163`); all values `$N` binds (`:1211` placeholders → `:1222-1227` values → `:1234` `pool.execute(sql,*values)`). HARDENED to a plain `INSERT` (no `EXCLUDED`/`DO UPDATE`) per WR-01 (`:1212-1221`) — fails safe 409 on unique-violation (`:1236-1243`) | closed |
| T-159-03 | Elevation (never-auto-enable) | add_model_by_id | mitigate | `AddModelRequest` carries NO `enabled` field (`admin.py:1099-1107`); `enabled` is always written as the literal `False` — `write_cols=[*present_cols,"enabled"]` (`:1208`) + `False` forced value (`:1226`), never body-sourced | closed |
| T-159-04 | Repudiation | both writes | mitigate | `operator_audit_floor` dep (`admin.py:1127` add · `:517` flag); success stamps `model.added` (`:1259`) / `flag.{key}.{on\|off}` (`:561`); persist failure stamps `model.add_failed`+real 500 (`:1251-1256`) / `flag.write_failed`+real 500 (`:547-554`) — never a false 2xx | closed |
| T-159-05 | Tampering (flag key injection) | set_flag | mitigate | `body.key not in _FLAG_KEYS` → 422 BEFORE any write (`admin.py:529-533`); the new key is a member of `_FLAG_HUMAN_NAMES` (`:78`) → `_FLAG_KEYS = set(_FLAG_HUMAN_NAMES)` (`:80`) | closed |
| T-159-06 | Tampering | migration 103 DDL | mitigate | Static `ADD COLUMN IF NOT EXISTS ... boolean NOT NULL DEFAULT true` (`103_model_discovery_filter.sql:37-38`) — no client input, idempotent, self-seeding; no new RLS (app_settings writes service-role only, `:15-17`) | closed |
| T-159-07 | DoS/Availability | settings readback pre-migration | mitigate | `_val_bool(row,"model_discovery_filter_enabled",None,True)` (`user_settings.py:751`); `_val_bool` reads via `row.get(key)` (`:506`) → absent column returns `default` True (`:511`), never raises; field default `=True` (`:172`); GET /settings field + serialization (`settings.py:80` / `:241`) | closed |
| T-159-08 | Elevation | add form + handleAddModel + api.ts | mitigate | Client adds NO authority — `AddModelBody` has NO `enabled` field (`api.ts:4202-4210`); the form only collects+submits (`ModelRegistryTab.tsx:56` prop · `:139` render); the real wall is the server gate (T-159-01) + roster/type/duplicate validation | closed |
| T-159-09 | Elevation (never-auto-enable / never-silent-capability) | add form | mitigate | Body NEVER carries `enabled` (`ModelRegistryTab.tsx:922` "NEVER add enabled"; `AddModelBody` no such field); `native_tools` set ONLY on `native`→true / `none`→false and OMITTED entirely on `unknown` (`:928-930`) → NULL row → server serves inferred default | closed |
| T-159-10 | Repudiation / honesty | write chokepoint | mitigate | Success → `pulseRecording()` ✎ receipt (`ControlRoomPage.tsx:531`); an `ApiError` renders the server `detail` in-form (`ModelRegistryTab.tsx:940`); errors propagate — NOT swallowed (`ControlRoomPage.tsx:526-534`) | closed |
| T-159-11 | Tampering (flag write) | handleSetDiscoveryFilter → setFlag | mitigate | `setFlag("model_discovery_filter_enabled", enabled)` — fixed key + bool only (`ControlRoomPage.tsx:557`); `FlagKey` union member (`api.ts:4074`) rides the `_FLAG_KEYS`-validated `PUT /admin/flags` (T-159-05) + `_DIRECT_COLUMNS` parameterized write | closed |
| T-159-12 | Elevation (never-auto-enable) | NewModelRow pre-fill | mitigate | Pre-fill seeds DRAFTS only via `seedDraftsFromDefaults` (`ModelDiscoveryPanel.tsx:174`) with `enableNow` reset EMPTY (`:170`); gating `patch.enabled = enableNow.has(m.model_id) && isComplete(m)` unchanged (`:236`) — a pre-filled model is `isComplete` but still lands `enabled:false` until the operator explicitly ticks Enable-now | closed |
| T-159-13 | Tampering (diff integrity) | display filter | mitigate | `buildChanges()` iterates the FULL `result.new` (`:221`) + `result.changed` (`:240`), gated only on `accepted` — the filter vars (`hidingUtility`/`m.utility`/`showAllThisView`) are ABSENT from it; the filter is a render-only `.filter()` (`:282-286`) and `changeCount` is computed from the full result (`:276`), so a hidden row can never be silently confirmed or dropped | closed |
| T-159-SC | Tampering (supply chain) | package installs | accept | Zero dependency-manifest changes across the phase window — `git log b15b2784~1..HEAD -- backend/requirements.txt frontend/package.json frontend/package-lock.json backend/pyproject.toml backend/Dockerfile.sandbox` returns EMPTY; `tech-stack.added: []` in 159-04 + 159-05 SUMMARY. Recorded AR-159-01 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Note on T-159-02 (declared-vs-shipped, a strengthening, not a gap):** the register described the SQLi wall as the `set_model_capability` `$`+`EXCLUDED` upsert being reused. The shipped `add_model_by_id` deliberately uses a PLAIN `INSERT` (no `ON CONFLICT DO UPDATE`, no `EXCLUDED`) per the WR-01 review (`admin.py:1212-1221`): an add must fail SAFE as a 409 on a concurrent-worker duplicate rather than upsert-clobber an existing row's caps. The security-relevant invariant — column names come ONLY from the code allowlist and every value is a `$N` bind — is fully present and, if anything, simpler/safer than the declared form. Disposition holds: CLOSED.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-159-01 | T-159-SC | No new npm/pip packages this phase (lift + wire only). Verified by a zero-diff check on `backend/requirements.txt`, `frontend/package.json`, `frontend/package-lock.json`, `backend/pyproject.toml`, and `backend/Dockerfile.sandbox` across the full phase commit window (`b15b2784~1..HEAD`); both 159-04 and 159-05 SUMMARY declare `tech-stack.added: []`. No install task → no supply-chain review surface introduced. | operator | 2026-07-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. Both SUMMARY `## Threat Flags` sections that exist (159-04, 159-05) declare "None"/"None new"; 159-01/02/03/06 carry no new-attack-surface note. The two non-register-cited files touched in the phase window were checked directly and introduce no new trust boundary:

- `backend/app/services/model_discovery_service.py` (Plan-01 `is_utility_model`) — a pure display-only classifier that stamps the `utility` flag on already-fetched provider model lists; no new endpoint or network call (the discovery fan-out's SSRF gate was closed by T-149-14). Its display-only consumption is exactly what T-159-13 verifies. Informational, not a flag.
- `scripts/curate_models.py` — a standalone operator/ops helper script, not on the app request path and not imported by the runtime; no network-exposed surface. Informational, not a flag.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-18 | 14 (13 mitigate + 1 accept) | 14 | 0 | gsd-security-auditor (opus) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Every `mitigate` threat grep-verified in implemented code with file:line evidence
- [x] Auth gate (T-159-01) confirmed on BOTH entry points (POST /models + PUT /flags)
- [x] Flag-key allowlist (T-159-05) confirmed to admit the new key AND reject unknowns
- [x] Accepted risks documented in Accepted Risks Log (AR-159-01)
- [x] Threat flags from SUMMARY `## Threat Flags` incorporated (none unregistered)
- [x] Implementation files unmodified (only 159-SECURITY.md created)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-18

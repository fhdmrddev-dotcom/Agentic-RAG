---
phase: 148
slug: governance-audit-users-feature-visibility
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-12
---

# Phase 148 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> **Verified 2026-07-12** by gsd-security-auditor (opus, ASVS L1, block_on: high) — 15/15 threats CLOSED, no BLOCKER, no unregistered attack surface. Register authored at plan time (all 9 plans carried a `<threat_model>` block); auditor ran in verify-mitigations mode.

This is a **no-RLS-backstop** operator surface: `require_operator` (router-level, byte-identical 404) is the ONLY gate on `/admin`, and cross-user reads run on the service-role client. Every mitigation below was independently grep-confirmed in the implementation, not trusted from SUMMARY prose.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| non-operator → `/admin` | Default-deny operator gate with no RLS backstop | Cross-user audit rows, user roster (emails, last-active), operator membership |
| stateless JWT → live session | App-layer ban check closes the ~1h window a still-valid token would otherwise keep | `auth.users.banned_until` |
| end-user → governed feature APIs | `require_visible` API-layer enforcement (not UI-only) | Skill Studio / model-management / workflow-authoring / governance surfaces |
| service-role client → tenant data | Parameterized, scoped-or-all, paginated/capped reads | `audit_log` (all users), `documents`/`threads` counts |
| local dev DB → cloud DB | Migration 098 schema+seed must be re-applied at promotion (config-drift boundary) | `app_settings.feature_visibility` |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (grep-confirmed) | Status |
|-----------|----------|-----------|-------------|------------------------------|--------|
| T-148-01 | Information Disclosure | `query_platform_audit` / CSV / platform browse | mitigate | `governance_service.py` `_AUDIT_WHERE` $1–$4 binds (user_id `$1`: NULL=all/value=single), `_clamp_page_size`≤100, `_AUDIT_COLUMNS` (no `SELECT *`); `export_platform_audit_csv` COUNT-first raises `AuditExportTooLarge` over 50000; `admin.py` records `audit.view_platform` + `audit.export` (exact count), over-cap 413 before any stamp → refused export writes no receipt | closed |
| T-148-02 | Elevation/Spoofing | ban check / disable | mitigate | `dependencies.py` `_is_banned` fetches `banned_until`, ban check in `get_current_user` (403 on live JWT); `admin.py` GoTrue `ban_duration="876600h"` + reused `_cancel_run_internals` in-flight cancel | closed |
| T-148-03 | Tampering | feature/audience/filter → SQL | mitigate | asyncpg `$N` binds; column names code-constant; `action_type = ANY($2)` text[]; `_VISIBILITY_FEATURES`/`_VISIBILITY_AUDIENCES` allowlist → 400 before write; only `{feature:{"audience":audience}}` serialized (JSONB codec) | closed |
| T-148-04 | Denial of Service | self-revoke / self-disable / `_is_banned` read | mitigate | `operator_service.py` self-revoke 409 before pool access; `admin.py` self-disable 409 before GoTrue; `dependencies.py` `_is_banned` fails OPEN (returns False) on read exception | closed |
| T-148-05 | Elevation | `feature_audience` cold read / `GET /features` | mitigate | `user_settings.py` `_GOVERNED_FEATURES` cold-default deny for skill_studio/model_management; try/except → per-feature default, never boolean; `features.py` derives from the same `is_operator`+`feature_audience` seams | closed |
| T-148-06 | Integrity | `set_feature_visibility` write | mitigate | `user_settings.py` atomic `coalesce(feature_visibility,'{}'::jsonb) \|\| $1::jsonb` per-key merge; does NOT route through whole-column `save_app_settings` | closed |
| T-148-07 | Information Disclosure | `require_visible` 403 | accept | Deliberate 403-not-404 (D-03): governed features are known products. `require_visible` raises 403 with exact literal; `/admin` keeps byte-identical 404 (`_NOT_FOUND`); auth-failure-before-auth also folded to 404 | closed |
| T-148-08 | Denial of Service | Run carve-out over-gating | mitigate | Carve-outs genuinely ungated: `GET /settings/providers`, `/workflows/published`+`/starters`, `threads.py` launch (only the `workflows_enabled()` kill-switch 403, NO `require_visible`). 6 governed routers gated (evals×2, skill_tuner, skill_test_cases, document_governance router-level; settings + workflows per-endpoint) | closed |
| T-148-DRIFT | Tampering (config drift) | migration 098 apply | mitigate | `098_feature_visibility.sql` data-idempotent seed (`base \|\| coalesce(...)`); apply-via-SQL-editor header + CLOUD-PARITY note; applied to live DB + `full-schema.sql` regenerated | closed |
| T-148-FAILCLOSED | Elevation | `useEffectiveFeatures` error path | mitigate | Hook starts `{}`, clears to `{}` before refetch, `.catch` → `{}` — render-only; a blip never flashes an operators-only feature | closed |
| T-148-CONTRACT | Tampering (fwd-compat) | audience control | mitigate | `FeatureVisibility.tsx` + `PUT /admin/visibility` read/write a `FeatureAudience` enum (`"everyone"\|"operators"`), never a boolean (SEED-115 never-boolean contract) | closed |
| T-148-STYLE | safety/UX | visibility vs kill-switch | mitigate | `FeatureVisibility.tsx` amber-only (never destructive/red); renders below the roster, spatially separated from `CapabilityGrid` kill-switches | closed |
| T-148-D02 | scope | impersonation | accept | "Sign in as user" NOT built (D-02 deferred, named re-open trigger); no impersonation endpoint exists. Support surface = roster + audit browser + active-runs | closed |
| T-148-TEST | Repudiation | test scaffold fidelity | mitigate | 14 `test_148_*.py` files; VERIFICATION re-ran `pytest tests/test_148_*.py` → 31 passed; security-critical nodes (403-not-404, no-tenant-leak, ban-window, fail-open, self-lockout, CSV-cap) present + green | closed |
| T-148-SC | Tampering | pip/npm installs | accept | Zero new packages this phase — no 148 commit modifies `requirements.txt` / `package.json` | closed |

*Status: open · closed* — *Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Code-review strengthenings (load-bearing, re-verified present in code)

- **CR-01** (`api.ts`): `getEffectiveFeatures` throws plain `Error`, never `ApiError` → a banned user's `/features` 403 cannot drive a refetch storm.
- **CR-02** (`api.ts` / `App.tsx`): `FEATURE_FORBIDDEN_EVENT` dispatch gated on `status===403 && message===VISIBILITY_REFUSAL` → the workflows kill-switch 403 and the ban 403 no longer wrongly bounce.
- **WR-01** (`dependencies.py`): banned operator folded into `authenticate_operator_request`'s byte-identical 404 (fail-open) → a disabled operator loses `/admin` powers.
- **WR-03** (`098_feature_visibility.sql`): seed data-idempotent (existing keys win) → cloud-promotion re-paste won't wipe operator-customized audiences.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-148-1 | T-148-07 | 403-not-404 for `require_visible` is deliberate (D-03): governed features are known products, not secrets to hide by existence. `/admin` itself keeps its byte-identical 404. | operator + auditor | 2026-07-12 |
| AR-148-2 | T-148-D02 | "Sign in as user" impersonation NOT built (D-02 deferred, named re-open trigger). Roster + audit browser + active-runs are the support surface. | operator + auditor | 2026-07-12 |
| AR-148-3 | T-148-SC | Zero new packages this phase — accepted (nothing to audit). | auditor | 2026-07-12 |

### Deferred follow-ups — assessed non-blocking at ASVS L1 (from 148-REVIEW.md)

- **WR-02** — FeatureVisibility panel seeds from `DEFAULT_VISIBILITY` (no GET read endpoint) → display-only staleness on reload; server-side `require_visible` enforcement is correct regardless. **Not a security gap.**
- **IN-01** — `GET /admin/audit` `limit` unclamped: reachable only behind `require_operator`; a self-inflicted large page, not a wall breach. Non-blocking at L1.
- **IN-02** — controller echoes raw `page_size` for `has_more`/`offset`: latent (frontend fixes `page_size=50`); service LIMIT still clamped ≤100, no over-read. Display-only.
- **IN-03** — roster `doc_count` counts non-latest doc versions: display accuracy, no data exposure.
- **IN-04** — `workflow_authoring` nav hides the launch library: UX; the actual control (ungated launch API) is intact + launch stays reachable via the composer.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-12 | 15 | 15 | 0 | gsd-security-auditor (opus, ASVS L1, block_on: high) |

**No-RLS-backstop focus checks (all pass):** (1) every `/admin` endpoint inherits router-level `require_operator` — the 8 new endpoints only add the audit floor, never replace the gate; (2) cross-user reads cannot widen past the operator gate (parameterized, scoped-or-all, paginated/capped, metadata-only); (3) `require_visible` 403 while `/admin` stays 404, Run carve-outs genuinely ungated; (4) fail-open ban check does not swallow a real ban on the normal path (fail-open scoped to the DB-read `except` only).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-12

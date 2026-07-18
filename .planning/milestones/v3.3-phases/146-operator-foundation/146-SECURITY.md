---
phase: 146
slug: operator-foundation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-11
---

# Phase 146 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → /admin API | Every /admin request crosses from an untrusted JWT into the service-role backend (NO RLS backstop) | Auth token → operator identity, system health signals, audit rows |
| normal JWT → operator tables | An authenticated non-operator must never read `operator_users` / `operator_audit_log` | Operator membership + action history |
| non-operator probe → operator-status disclosure | A 403 / different error shape / method fingerprint would reveal the surface exists | Existence signal only |
| OPERATOR_EMAILS env → operator_users rows | Env-supplied emails become privileged principals; resolve must not be SQL-injectable | Emails → privileged principal rows |
| browser probe result → nav rendering | Client probe decides rendering ONLY; never a security boundary | isOperator boolean (render-only) |
| v3.3 schema → v3.4 org-RBAC rewrite | Principal shape is a one-way door; wrong shape poisons the future rewrite | Schema shape (design-time) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-146-01 | EoP / Info Disclosure | Any /admin route missing the gate (full-tenant leak — no RLS backstop) | mitigate | Router-level `require_operator` (`admin.py:37-41` `APIRouter(dependencies=[...])`, never per-endpoint); route-enumeration 404 test (`test_146_operator_gate.py:31-42`, 11/11 green at audit) | closed |
| T-146-02 | Info Disclosure | 403-vs-404 enumeration · probe signal · nav discoverability | mitigate | Byte-identical `_NOT_FOUND` 404 sentinel (`dependencies.py:125`); unauthenticated fold via `HTTPBearer(auto_error=False)` + `authenticate_operator_request` (`dependencies.py:134,171-198` — post-review WR-02 fix); probe 404→null (`api.ts:3545-3551`); shield rendered OUTSIDE `NAV_ITEMS` + `nav-items.test.ts` regression lock; live-curl proven (146-HUMAN-UAT scenario 1) | closed |
| T-146-03 | Info Disclosure | 405 method-mismatch fingerprint (Allow header reveals path existence) | accept | LOW residual — see Accepted Risks Log R-146-A | closed |
| T-146-04 | EoP (future) | `operator_users` principal shape (v3.4 one-way door) | mitigate | Org-agnostic principal: NO `org_id` column (`095_operator_foundation.sql:29-34`, `full-schema.sql:981-986`); not a JWT claim, no `is_admin` boolean | closed |
| T-146-05 | Tampering (SQLi) | Email seed resolve | mitigate | Parameterized `ANY($1::text[])` + bound INSERT (`operator_service.py:150,161-164`); no f-string SQL; parameterization test (`test_146_operator_seed.py:62-79`) | closed |
| T-146-06 | Spoofing / EoP | Client-forged operator flag | mitigate | Probe is render-only (SECURITY NOTEs `useOperatorProbe.ts:32-37`, `api.ts:3502-3507`); DB-backed `is_operator` behind the router gate is sole authority — forged flag reaches an empty shell whose every data call 404s | closed |
| T-146-07 | Repudiation | Audit actor deletion · floor write failure | mitigate | `operator_user_id` plain uuid NO FK (`095_operator_foundation.sql:41`); floor best-effort with loud `logger.error` (`dependencies.py:255-256`, `operator_service.py:82-86`); append-only INSERT path only | closed |
| T-146-08 | Tampering / Availability | Seed race under WORKER_COUNT=2 | mitigate | `INSERT ... ON CONFLICT (user_id) DO NOTHING` (`operator_service.py:161-164`); best-effort lifespan try/except (`main.py:255-259`); idempotence test green | closed |
| T-146-09 | Info Disclosure | Operator tables readable by non-operators | mitigate | Both tables RLS-enabled with ZERO policies = deny-all (`095_operator_foundation.sql:62-64`; live-DB verified during phase verification); only service-role backend behind the gate reads them | closed |
| T-146-10 | Info Disclosure | Phase-number leak in locked-tab / Control Room copy | mitigate | `Phase 1xx` grep across LockedTab/ControlRoomPage/AuditTab → none; copy is roadmap-free ("Not built yet — coming soon") | closed |
| T-146-11 | Repudiation | ↻ Refresh bypassing the ledger beat | mitigate | `handleRefresh` awaits backpressure FIRST then audit so the floor's own row lands (`ControlRoomPage.tsx:139-158`); persistence operator-verified live (146-HUMAN-UAT scenario 3) | closed |
| T-146-SC | Tampering (supply chain) | npm/pip package installs | accept | No installs — see Accepted Risks Log R-146-B | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-146-A | T-146-03 | Wrong-HTTP-method requests to the GET-only `/admin/*` routes return Starlette 405 (routing precedes the operator gate), fingerprinting path existence but exposing no data, no auth state, and no operator-vs-non distinction. LOW path-existence residual. **Re-evaluate when the first non-GET `/admin` endpoint ships** (Phase 147 kill-switches will widen the method-probe matrix). | Operator (plan-time, 146-02 threat model; audit-confirmed) | 2026-07-11 |
| R-146-B | T-146-SC | Zero npm/pip packages installed in this phase — verified: no `package.json` / `requirements.txt` / lockfile deltas in the `49895081..HEAD` window. No supply-chain surface introduced. | Operator (plan-time; audit-confirmed) | 2026-07-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Residual Notes (informational — not open threats)

- **DB-layer audit immutability is convention-only (code-review IN-07):** RLS deny-all blocks client roles, but the service-role backend / SQL editor can technically `UPDATE`/`DELETE` `operator_audit_log` rows. T-146-07's declared mitigation (no FK + app-level append-only + loud error logging) is fully present, so the threat is closed as written. Hardening path if structural immutability is ever wanted: a `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION` trigger (harness_audit-style). Candidate for Phase 148 (audit browser) scope.
- **Cloud parity at promotion:** migrations 095+096 must be pasted into the cloud Supabase SQL editor; Coolify must SET `OPERATOR_EMAILS` and REMOVE `BACKPRESSURE_ADMIN_USER_IDS` in the same promotion (D-02 swap deleted the old auth path).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-11 | 12 | 12 | 0 | gsd-security-auditor (opus) — plan-time register verification, State B |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-11

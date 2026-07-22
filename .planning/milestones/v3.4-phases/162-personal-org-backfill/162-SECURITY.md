---
phase: 162
slug: personal-org-backfill
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-19
---

# Phase 162 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Scope: pure-SQL data migration (mig 105 + mig 106). The migration runs as
> owner/service_role and BYPASSES RLS **by design** — RLS enforcement is Phase 163.
> Correctness, not RLS, is the guard for Phase 162. "Runs without RLS" is the
> documented, intentional trust boundary here — NOT an open threat.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| SQL-editor / psycopg2 session → DB (owner / service_role) | Migration runs as owner and BYPASSES RLS by design (RLS is Phase 163). Correctness — not RLS — is the guard. | All 35 user-facing tables' `org_id` + new org/membership rows |
| `create_org_with_default_dept` / `handle_new_user` (SECDEF) | Run as owner `postgres` with a pinned `search_path`; a privilege boundary crossed by definer rights. | New `organizations` / `departments` / `org_members` rows |
| `auth.users` INSERT (signup) → `handle_new_user` trigger | An uncaught trigger exception would abort the triggering INSERT (breaks signup) — an availability boundary. | Signup path (auth → profiles + personal org) |
| `_mig105_backfill(p_sql)` dynamic SQL | `p_sql` is migration-authored ONLY (never user input); the procedure is SECURITY INVOKER. No untrusted-input boundary is crossed. | Migration-authored UPDATE text |
| `autofill_org_id_by_owner` / `autofill_org_id_from_parent` (SECDEF) BEFORE-INSERT triggers | Run as owner with pinned empty `search_path`; trigger-returning, so no PostgREST `/rpc` direct-call surface (REVOKE'd as belt). | Inbound row `org_id` auto-fill at INSERT time |
| Apply session (autocommit / SQL-editor) → live DB | Live-DB mutation, operator-gated (BLOCKING). Proven by the SC#1–4 pack. | Local Supabase DB state |
| Wrapping-transaction vs non-atomic apply | The batched `COMMIT` is only legal in a non-atomic context — apply MUST NOT run inside one wrapping transaction (Pitfall 1). | Apply-time transaction context |
| Local DB vs cloud | 105/106 applied LOCAL only; cloud parity is a separate operator-gated push (099→…→106). No cloud credential touched. | Deployment boundary |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-162-01 | Tampering / integrity | §A personal-org loop + §D trigger re-run + mig 106 re-run | mitigate | NOT-EXISTS(org_members) gate `105:63` (§A) + `105:101` (§D); membership `ON CONFLICT (org_id,user_id) DO NOTHING` `105:69,105:106`; profiles `ON CONFLICT (id) DO NOTHING` `105:96`; every backfill UPDATE carries `WHERE org_id IS NULL` (35/35). Mig 106 re-paste-safe: `CREATE OR REPLACE FUNCTION` `106:74,106:111` + `DROP TRIGGER IF EXISTS` ×35; forward-compat no-op `IF NEW.org_id IS NOT NULL` `106:86,106:124`. | closed |
| T-162-02 | Denial of Service | §B large-table backfill UPDATE / lock storm | mitigate (105) + accept reason-only (cloud scale) | `CREATE OR REPLACE PROCEDURE public._mig105_backfill(p_sql text, p_batch int DEFAULT 10000)` `105:127`; per-batch `COMMIT` inside the LOOP `105:139`; `EXIT WHEN v_rows = 0` `105:140`; all 35 resolver CALLs carry a `LIMIT $1` batch bound; SC#4b live NOTICEs show M ≤ 10000 with per-batch COMMIT (162-02-SUMMARY). Cloud-scale residual → Accepted Risks Log (ARL-02). | closed |
| T-162-03 | Availability / integrity | §C NOT-NULL flip on dirty data | mitigate | Machine-counted **35 `RAISE EXCEPTION` zero-NULL guards == 35 `ALTER COLUMN org_id SET NOT NULL` flips** (`105:399-610`), each guard immediately preceding its flip; ALL §B CALLs COMMIT before ANY flip (ordering: last CALL `105:347-351` precedes first guard `105:399`); `operator_audit_log` excluded/nullable `105:612-617`; `metadata_field_definitions` guarded not unconditional `105:492-496`. SC#2 live: only `operator_audit_log` remains org_id-nullable. | closed |
| T-162-04 | Information disclosure / integrity | is_global / is_system sharing lost | mitigate | Comment-stripped grep of mig 105 (independently reproduced by auditor) → **0** `is_global`/`is_system` tokens in any executable statement; resolution is purely via `user_id`/`created_by`/parent `org_id` (§B `105:145-351`). Census invariance: `folders_is_global`=1/`skills_is_global`=1/`skills_is_system`=1/`workflow_definitions_is_global`=15 (`162-BASELINE.md:51-54`) == post-apply (162-VERIFICATION Truth #3, zero delta on all 4 keys). | closed |
| T-162-05 | Denial of Service | §D trigger aborts signup | mitigate | Inner `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END` swallow around the org-creation block `105:100-110`; it `RAISE WARNING` (NOT `RAISE EXCEPTION`) `105:109`, then `RETURN new` `105:112` — so org-creation failure can never abort the `auth.users` INSERT. | closed |
| T-162-06 | Elevation of Privilege | SECURITY DEFINER search_path hijack | mitigate | `handle_new_user` KEEPS `SECURITY DEFINER` + `SET search_path TO 'public'` across the `CREATE OR REPLACE` `105:86-87`; `create_org_with_default_dept` retains `SECURITY DEFINER` + `SET search_path TO 'public'` `104:212-213` + `REVOKE EXECUTE … FROM PUBLIC/anon/authenticated` + `GRANT … TO service_role` `104:233-236`; mig 106's two autofill fns are `SECURITY DEFINER` + `SET search_path = ''` `106:77-78,106:114-115` + `REVOKE EXECUTE … FROM PUBLIC` `106:146-147`. The 161-class "CREATE OR REPLACE dropped the pin" Critical did NOT recur. | closed |
| T-162-07 | Availability | applying 105 inside a wrapping transaction | mitigate | Non-atomic apply path used: **psycopg2 `autocommit=True`** (162-02-SUMMARY "Apply path = psycopg2 autocommit", proven mig-104/161 path); the batched `COMMIT` fails LOUD ("invalid transaction termination") if misapplied — safe-by-failure. SC#1–4 all PASS on the applied DB (162-02-SUMMARY; 162-VERIFICATION 10/10). | closed |
| T-162-SC | Supply chain (Tampering) | package installs | accept (N/A) | Zero package-manifest changes across all five phase-162 commits (git-verified: no `package.json`/`requirements.txt`/`Dockerfile`/`pyproject`/lockfiles in `1d10605c`,`b0b24bf3`,`aad6391a`,`f3281cce`,`170c5f13`). Uses only Postgres 17.6 built-ins + the mig-104 helper. → Accepted Risks Log (ARL-01). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| ARL-01 | T-162-SC | This phase installs ZERO packages (no npm/pip/cargo). No Package Legitimacy Gate applies — git-verified that no package manifest or lockfile was touched by any of the five phase-162 commits. Postgres 17.6 built-ins + the mig-104 `create_org_with_default_dept` helper only. | gsd-security-auditor | 2026-07-19 |
| ARL-02 | T-162-02 (cloud-scale residual) | Lock-storm at cloud scale is unobservable locally: the largest local target is `audit_log`=5086 rows (< the 10k batch), so it completes in one batch and cannot exercise the multi-batch lock window. Mitigated by construction (bounded ~10k `LIMIT $1` batch + per-batch `COMMIT` that releases the lock window between batches — live PG 17.6 COMMIT-releases-lock proof, RESEARCH §Batched Backfill). Re-examined only at the next operator-gated cloud push. | gsd-security-auditor | 2026-07-19 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-19 | 8 | 8 | 0 | gsd-security-auditor |

---

## Auditor Notes (non-blocking)

- **Unregistered flags:** none. No SUMMARY.md (162-01/02/03) contains a `## Threat Flags`
  section, and the diff surfaced no new attack surface outside the 8 registered threats.
- **Code-review residuals (162-REVIEW: 0 Critical / 5 Warning / 3 Info)** are defense-in-depth
  and cloud-apply operational-hardening items layered on top of mitigations that are *present*
  as declared — they do NOT flip any registered threat to open:
  - WR-01 (`_mig105_backfill` not REVOKE'd) — the procedure is SECURITY INVOKER with
    migration-authored `p_sql` (declared trust boundary, no untrusted input) and is dropped
    at `105:620`; a hardening suggestion, not an absent mitigation.
  - WR-02 (table-wide DISABLE/ENABLE TRIGGER windows) / WR-03 (`EXIT WHEN v_rows=0` early-exit)
    — cloud-apply robustness; T-162-03's §C zero-NULL guard is the loud fail-safe backstop.
  - WR-04 (105-before-106 insert-break window) — the exact gap mig 106 closes locally; on cloud
    both are applied in-order in the pending set.
  - WR-05 (`handle_new_user` swallow → possible org-less user) — a downstream consequence of the
    T-162-05 mitigation, which itself (signup never aborts) is present and correct. Flagged for a
    Phase 163+ reconciliation/monitor follow-up.
  These are recorded for orchestrator visibility; none are BLOCKERs for Phase 162's scope.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-19

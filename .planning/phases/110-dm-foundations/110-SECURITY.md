---
phase: 110
slug: dm-foundations
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-15
---

# Phase 110 — DM Foundations Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Auditor: gsd-security-auditor. ASVS Level 1. All 11 threats verified CLOSED.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| authenticated client → Postgres (RLS) | End-user requests read/write the 4 new DM tables through the Supabase anon/authenticated role; RLS is the sole cross-user isolation boundary. No server-side proxy this phase — DM routes ship in 113–119. | User-owned row data (views, relationships, classification rules, field defs) |
| application code → audit_log CHECK | `write_audit_entry` writes an `action_type` to `audit_log`; the closed 19-type CHECK is the integrity boundary. The swallow-on-error design (D-05) means a CHECK violation is silent — the boot drift guard is the compensating control. | Audit-log action_type strings; swallows Postgres error 23514 |
| settings read → DM capability gate | `document_management_enabled()` is consulted at the gate boundary that (in 113–119) decides whether DM surfaces and tools are active; a read failure must fail OPEN (default-on, D-110-2). | Boolean flag from app_settings; cold-cache / DB read error path |
| operator → live Postgres :54322 | Migration 071 crossed into the live DB via operator-authorized psycopg2-direct apply (the 100/102 precedent, no data wipe). `supabase db push`/`db reset` explicitly forbidden. | DDL (CREATE TABLE, ALTER TABLE, RLS policies) |
| live DB ↔ verification tests | The live INSERT+SELECT and 2-user RLS tests are the only proof that the CHECK/tables/RLS are actually correct — a mock or superuser-bypassed RLS would false-green. | Raw asyncpg INSERT/SELECT against the migrated schema |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-110-01 | Information Disclosure | RLS SELECT on the 4 new DM tables | mitigate | `auth.uid()=user_id OR is_global=true` SELECT policy on document_views, classification_rules, metadata_field_definitions; document_relationships USER-SCOPED ONLY (no is_global by design). Policy shape verified by `test_dm_table_select_policy_shape` x4 (live pg_policies read) + live 2-user cross-user isolation. Per-read-path leak tests deferred to phases 113–119 per constraint (no read path ships in 110). | closed |
| T-110-02 | Elevation of Privilege | RLS INSERT/UPDATE WITH CHECK on the 4 new DM tables | mitigate | `WITH CHECK ((auth.uid()=user_id) AND (is_global=false))` on INSERT/UPDATE for document_views, classification_rules, metadata_field_definitions (migration 071 lines 128–129, 155–158, 167–170); document_relationships uses `WITH CHECK (auth.uid()=user_id)` (no is_global — user-scoped only, line 146). No DB admin role — globals are service-role/migration-seeded only. WITH CHECK presence confirmed in migration + regenerated full-schema.sql. | closed |
| T-110-03 | Repudiation / Tampering | audit_log CHECK enum vs VALID_ACTION_TYPES (silent audit swallow) | mitigate | (a) Boot drift guard: `main.py` lines 237–238 bare unwrapped `await assert_action_types_synced(await get_pg_pool())` — no enclosing try/except, hard-fails on desync. (b) CI subset test: `test_110_audit_drift_guard.py::test_valid_action_types_subset_of_live_check` calls the same shared helper against live pool. (c) Live INSERT+SELECT: `test_110_dm_audit_live.py` raw asyncpg over all 8 new types (never calls the swallowing write path — `write_audit_entry` not present in the file). All three GREEN per 110-02-SUMMARY (27 live tests passed). | closed |
| T-110-04 | Denial of Service (self-inflicted) | metadata_field_definitions global-row reachability | mitigate | `CONSTRAINT mfd_reachable CHECK (user_id IS NOT NULL OR is_global = true)` present in migration 071 line 103. Prevents a `user_id NULL AND is_global=false` orphan row that would be reachable by neither RLS clause. Global-field visibility path verified live: `test_rls_global_metadata_field_visible_to_other_user` confirms user_id=NULL + is_global=true row returns count=1 for user B. | closed |
| T-110-05 | Tampering (data loss) | FK ON DELETE on classification_rules.suggest_folder_id | mitigate | `suggest_folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL` in migration 071 line 82. A3 decision comment present in the DDL (lines 79–81). document_relationships doc-FK CASCADE is intentional (lines 62–64) with documented rationale. Confirmed in migration file. | closed |
| T-110-06 | Tampering / fail-closed | document_management_enabled() default-on guarantee | mitigate | `user_settings.py` line 578: `def document_management_enabled() -> bool:` with `except Exception: return True` (line 589). Field default: `user_settings.py` line 137 `document_management_enabled: bool = True`. Resolution: line 480 `_val_bool(row, "document_management_enabled", None, True)` (env_attr=None, default=True). Verified by `test_110_flag_default.py::test_flag_helper_defaults_on_when_load_raises` GREEN (forced-exception path returns True). | closed |
| T-110-07 | Forward-compat correctness | org_id column shape | mitigate | All 4 tables: `org_id uuid` (no NOT NULL, no REFERENCES) in migration 071 lines 49, 62, 75, 92. COMMENT on each column (`Forward-compat (D-PRD-02/D-11): ... no FK until org schema exists`) lines 110–113. Schema assertion: `test_dm_table_org_id_nullable_no_fk` x4 verifies `is_nullable='YES'` + zero FK constraint rows via pg_constraint. | closed |
| T-110-08 | Input Validation | closed CHECK enums (rel_type, action_type) | mitigate | `document_relationships_rel_type_check CHECK (rel_type = ANY (ARRAY['supersedes','amends','references','attached_to']::text[]))` in migration 071 lines 67–68. `audit_log_action_type_check` extended to 19 types (migration 071 lines 28–35). Additive-only extension discipline established. No user-input compiled to SQL this phase (no filter DSL ships in 110). | closed |
| T-110-09 | Tampering / DoS (data loss) | migration apply step | mitigate | Migration file opens with `BEGIN;` (line 13) and ends with `COMMIT;` (line 202) — fully atomic. Apply path: operator psycopg2-direct (the 100/102 precedent), explicitly NOT `supabase db push`/`db reset` (documented in migration file header comments lines 3–9 and confirmed in 110-02-SUMMARY). Regen: `bash scripts/regenerate-full-schema.sh` with NO `--reset` (dev data preserved — 19 documents / 221 threads confirmed intact per 110-02-SUMMARY). | closed |
| T-110-10 | Repudiation (false-green) | the verification tests themselves | mitigate | SC#4 (`test_110_dm_audit_live.py`): raw asyncpg INSERT+SELECT — never calls `write_audit_entry` (grep: 0 matches in the file). A CHECK drift raises `CheckViolationError` on INSERT or SELECT returns None — both RED. SC#1 2-user RLS (`test_110_dm_schema.py`): queries run inside `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claim.sub', uid, true)` transactions (lines 310–313) — not superuser bypass. Assertion `count_b == 0` is strict (line 243); the test FAILED at base with the wrong uniform-is_global assumption (confirmed in 110-02-SUMMARY), proving RLS engagement is real. | closed |
| T-110-11 | Information Disclosure (verified live) | RLS correctness on the 4 tables | mitigate | 2-user cross-user isolation: `test_rls_cross_user_isolation_document_views` + `test_rls_cross_user_isolation_classification_rules` both return count_b=0 for user B reading user A's private rows (GREEN per 110-02-SUMMARY, 27 live tests). `test_dm_table_select_policy_shape` x4 verifies SELECT policy USING clause contains `user_id` for all 4 tables and `is_global` only for the 3 library tables (live pg_policies read). Forced-global INSERT rejection is enforced by the WITH CHECK policy shape (T-110-02, migration verified); live WITH-CHECK-rejection test is deferred to the first DM write route in phases 113–119, per the substrate-only scope constraint. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks. All 11 threats are verified CLOSED by code evidence.

---

## Unregistered Threat Flags

### From 110-01-SUMMARY.md
The SUMMARY records no `## Threat Flags` section. Three informational items from the code review (IN-01, IN-02, IN-03 in 110-VERIFICATION.md) were noted by the verifier:

- **IN-01** (`audit_service.py:47`): `re.findall(r"'([^']+)'", ...)` assumes no embedded apostrophes in action-type names. Not a threat — the D-110-1 vocabulary is locked with no apostrophes; latent future-phase concern only. No mapping to a registered threat.
- **IN-02** (`user_settings.py:586-589`): `except Exception: return True` docstring slightly mischaracterizes the cold-cache case. Behavior is correct. No threat.
- **IN-03** (`main.py:237-238`): Boot guard runs once per worker (intentional, documented). No threat.

All three are **unregistered informational notes** — no threat-register mapping, no blocker at ASVS Level 1.

### From 110-02-SUMMARY.md
Auto-fix #1 (document_relationships RLS `is_global` non-existent-column defect) was caught and fixed during the live apply gate — exactly as intended. The corrected migration and policies are now committed and verified. This was a Plan-01 template defect caught by the live-apply gate, not an unmitigated residual threat.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-15 | 11 | 11 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (none)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-15

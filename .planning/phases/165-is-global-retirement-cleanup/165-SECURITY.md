---
phase: 165
slug: is-global-retirement-cleanup
status: verified
threats_open: 0
asvs_level: 2
created: 2026-07-21
register_origin: authored-at-plan-time
---

# Phase 165 — `is_global` Retirement Cleanup — Security Audit

**Audited:** 2026-07-21
**Verdict:** SECURED — 40/40 threats CLOSED, 0 OPEN
**ASVS Level:** 2 (default) | **block_on:** high (default)
**Register origin:** authored-at-plan-time (11 PLAN.md `<threat_model>` blocks). Verification mode: confirm each declared mitigation exists in implemented code — not a fresh scan.

Every mitigation was verified against real evidence: live Postgres catalog (`pg_policies`, `pg_proc`, `information_schema.columns` @ 127.0.0.1:54322), source at file:line, and git provenance. Documentation/intent was NOT accepted as evidence.

---

## Load-bearing threats (live-catalog + source evidence)

| Threat | Category | Disp. | Evidence |
|--------|----------|-------|----------|
| T-165-01 | Elevation/Info-disc | mitigate | mig 111 §1 is RENAME-COLUMN-only — NO hand `CREATE POLICY` on the 4 write-locked tables (`111_is_global_retirement_rename.sql:69-74`). Live `pg_policies` universal branch on workflow_definitions/document_views/classification_rules/metadata_field_definitions = exactly `(is_system_global = true) OR (...org gate...)` — not over-widened. |
| T-165-05 | Info-disc | mitigate | `workflow_definitions.is_global → is_system_global` (universal), not is_org_shared (`111:71`). Live: 16 rows `is_system_global=true` stay universal. |
| T-165-07 | Info-disc | mitigate | `folder_utils._resolve_caller_org_ids` resolves caller org set from `org_members` (`folder_utils.py:27-42`); `is_in_global_subtree` gates on `str(org_id) in caller_org_ids` (`:70`). Consumed by ls/tree/read via `ctx.current_user["id"]` (`tool_dispatcher.py:223,229,251-254,302`). Exit-gate `test_browse_tools_cross_org_isolation_seed124_closed` drives the REAL service-role client live: **23 passed / 0 failed / 0 xfail**. |
| T-165-08 | Elevation | mitigate | Fail-closed: `caller_org_ids` defaults to `set()` (`folder_utils.py:62-63`); empty set → `in` test False for every non-owned folder → 0 shared visible. |
| T-165-09 | Info-disc | mitigate | `_null_foreign_global_owner` broadened with `visible_non_owned_ids` (`folder_utils.py:79-108`); `kb.py:117-123` passes `get_globally_visible_folder_ids` set (org-shared rows + non-shared subtree descendants). |
| T-165-22 | Info-disc | mitigate | **Arbiter of T-165-01** — live `pg_policies.qual` dump: all 4 tables' SELECT universal branch = `is_system_global = true`; INSERT/UPDATE WITH-CHECK = `is_system_global = false`. |
| T-165-26 | Info-disc | mitigate | Exit-gate test builds the real BYPASSRLS `create_client` from `backend/.env` (`test_v3_4_org_isolation.py:847-865`) and calls the actual `get_globally_visible_folder_ids` — live drive, not code inspection. |
| T-165-27 | Tampering | mitigate | Assertion body intact: `assert a["shared_folder_id"] not in visible_ids` (`:895-900`). `xfail(strict)` + `KNOWN_OPEN` name removed; test renamed `..._seed124_closed`. Gap-closure git-diff (VERIFICATION §Re-verif) shows masking assertions byte-unchanged. |
| T-165-28 | Info-disc | mitigate | `test_is_system_stays_universal` (`:636`), `test_user_is_org_shared_stays_org_scoped` (`:662`), `test_badge_spoof_blocked` (`:694`) all present as passing guards in the 23-green run. |

## Rename / RLS integrity threats

| Threat | Disp. | Evidence |
|--------|-------|----------|
| T-165-02 | mitigate | Live WITH-CHECK `is_system_global = false` on all 4 tables (INSERT+UPDATE); mig 111 touches no write check. |
| T-165-03 | mitigate | `skills.is_system` column present live (not renamed); badge-spoof WITH-CHECK `is_system = false` intact live (skills INSERT/UPDATE). |
| T-165-04 | mitigate | Live `pg_proc.proconfig`: `folder_is_org_shared`, `match_document_chunks`, `keyword_search_chunks`, `match_skills` all `search_path=""`; `capture_skill_version` `public, pg_temp` (verbatim). `folder_is_org_shared` body references `is_org_shared`, 0 bare is_global. OID-preserving `ALTER FUNCTION … RENAME` (`111:120`). |
| T-165-06 | accept→mitigate | Single `BEGIN;`…`COMMIT;` (1 each, `111:58/330`). |
| T-165-10 | mitigate | Helper defaults over-restrict (empty set, `.get()`→None); 0 bare is_global source; gap-closure run 96 passed / 2 xpassed. |
| T-165-11 | mitigate | Live write-lock `is_system_global=false` server-owned; 0 bare is_global in backend/app source (only a stale `.pyc` cache matched). |
| T-165-12 | mitigate | `is_system` preserved — 23 source refs (skills.py, skill.py, agent_loop, tool_dispatcher, folder_utils). |
| T-165-13 | mitigate | `documents.py` carries BOTH targets: is_org_shared ×2, is_system_global ×4. |
| T-165-14/15/16 | mitigate | 0 bare is_global in services; is_system counts unchanged; agent_loop rename was token-only (commit `e39fe0f8`, D-14). |
| T-165-34a | mitigate | No seed task; 16 workflows migration-seeded, auto-preserved by RENAME COLUMN. |
| T-165-17/18 | mitigate | RLS regression tests renamed by owning table; is_system excluded; live 23/0 arbiter. |
| T-165-29/30 | mitigate | 0 is_global/isGlobal tokens in tests; is_system counts unchanged. |
| T-165-31/32 | mitigate | Seed fixtures kept `is_system_global=true`; 16 universal workflows confirmed live. |

## Frontend / storage / apply threats

| Threat | Disp. | Evidence |
|--------|-------|----------|
| T-165-01 (storage) | mitigate | Live storage `Users can read own skill files` policy reconciled to `(s.is_system = true OR s.is_org_shared = true)` (mig-109 shape). The `file_path = name` subquery predicate is pre-existing verbatim from `017_skills.sql:112` — value-preserving, not a 165 regression. |
| T-165-19 | mitigate | Wire preserved: `is_org_shared: isOrgShared` POST body (`api.ts:1585`); `toggleOrgShared`→`apiToggleFolderOrgShared` (`useFolders.ts`). "Shared with org" copy at folder+skill toggle sites. |
| T-165-20 | accept | Display-only badge; server write-lock live-confirmed (`is_system_global=false`). |
| T-165-21 | mitigate | `ToggleGlobal`/`toggleGlobal` = 0 hits in frontend/src. |
| T-165-33 | mitigate | The "unrelated threadGroups/ChatHistoryColumn isGlobal" premise was factually wrong — those were `Folder[]` fixtures (tsc TS2353), not a thread-grouping flag. Documented, reviewed deviation (165-09-SUMMARY §Deviations); 0 stray tokens, clean tsc, vitest green. No cross-org/security implication. |
| T-165-34b | mitigate | Zero-token grep + clean tsc + vitest close the missed-token risk. |
| T-165-23 | mitigate | SQL-editor-only apply discipline in migration header (`111:43-49`); live DB catalog matches migration text (confirms applied, no push/reset). |
| T-165-24 | mitigate | 0 bare is_global in `full-schema.sql` (regenerated no-reset); renamed storage policy present at `:5714-5726`. |
| T-165-25 | accept→mitigate | Cloud-parity note recorded in migration header (`111:51-56`): migs 099→111 + SECRETS_ENCRYPTION_KEY owed at next push; schema-only, no deploy-artifact change. |

## Accepted risks log

| ID | Category | Disp. | Rationale / evidence |
|----|----------|-------|----------------------|
| T-165-SC | Tampering (supply-chain) | accept | Phase installs ZERO packages — no changes to `backend/requirements.txt` / `frontend/package.json` since phase start (git-confirmed). Pure SQL rename + source-token rename + tests. No-op accepted risk across all 11 plans. |
| T-165-20 | Tampering (UX) | accept | `is_system_global` badge is frontend display-only; server owns the write-lock (live WITH-CHECK `is_system_global=false`). No settable client control. |

---

## Deferred items — confirmed genuinely PRE-EXISTING (NOT re-opened; out of Phase 165 scope)

1. **SEED-125 — `tool_dispatcher.py`'s 6 `.or_(is_org_shared.eq.true)` skill-resolution sites lack an `org_id` gate on the service-role client.** Git-proven pre-existing: at the parent of the 165-02 rename commit (`9ea67b38~1`) these sites read `.or_(f"user_id.eq.{...},is_global.eq.true")` — already org-blind, no adjacent `org_members`/`current_user_org_ids` gate. The 165 rename was purely value-preserving token-level; it neither introduced nor closed the gap. Phase 165's CR-01 fix was scoped to folders only. Captured in `.planning/seeds/SEED-125-skill-tools-service-role-cross-org-leak.md`. **Close before 166/167.**

2. **`test_163_rls_dm.py` / `test_163_rls_workflow_eval.py` FIX-A-universality failures (2 tests).** Pre-existing since Phase 163 (mig-109): the 4 write-locked tables' SELECT universal branch was made unconditional (`is_system_global = true`) **by design**. Phase 165's RENAME COLUMN auto-propagated (did not widen) this — live `pg_policies` confirms an unconditional universal branch. These assertions fail identically on any commit since mig-109, independent of Phase 165. Correctly deferred, not a 165 blocker.

## Unregistered flags
None. No SUMMARY `## Threat Flags` surfaced new attack surface without a mapped threat ID. All new attack surface (the org-scoped service-role helper on the browse path) maps to T-165-07/08/09.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-21 | 40 | 40 | 0 | gsd-security-auditor (opus) |

*Incidental (non-threat, no security impact, NOT counted as open): the storage `skill-files` read policy's `WHERE sf.file_path = name` subquery binds `name` to `skills.name` rather than the storage object name — pre-existing verbatim from `017_skills.sql:112`, fail-closed (under-grants, never leaks), outside T-165-01's over-widening scope. Not a Phase-165 regression.*

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (T-165-SC, T-165-20)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

---

*Auditor: gsd-security-auditor. Implementation files unmodified (read-only audit). Live evidence: psycopg2 catalog @ :54322, source file:line, git provenance.*

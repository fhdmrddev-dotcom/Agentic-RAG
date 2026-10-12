---
phase: 275
slug: retention-legal-hold
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
audited_at_head: 6aa0c79e0
created: 2026-10-12
---

# Phase 275 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> This audit re-read the code at HEAD; it did not take SUMMARY or VERIFICATION claims as evidence.
> The register is the union of the `<threat_model>` blocks in 275-01..05-PLAN.md:
> `grep -ho "T-275-[0-9]*" 275-0*-PLAN.md | sort -u` gives **44 ids (T-275-01..44)**.
> Mitigations were checked against migrations **204 + 205 + 206**. 206 is the review fix pass for
> 275-REVIEW-backend.md B-CR-01..03 and B-WR-01..03, so wherever 206 replaces a 204 object the
> evidence cites the 206 definition.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| authenticated JWT → Postgres (PostgREST / user-context asyncpg) | members and admins. RLS and triggers apply; `SET LOCAL ROLE authenticated` (`dependencies.py:148`) | documents, holds, policies (org-confidential; matter names are legal-sensitive) |
| service role / postgres → Postgres | BYPASSRLS. Only triggers and explicit `org_id = $active` predicates constrain it | every retention table |
| auth.users deletion → documents FK cascade | a delete path that never passes through Python | held documents |
| model-written SQL (`query_user_documents`) → documents/chunks | agent-controlled text, run as the caller | archived / source-gone content |
| user JWT → Storage API (`documents` bucket) | the owner's direct object delete | original file bytes (evidence) |
| browser → `/documents`, `/folders`, `/sources` delete routes | member or admin JWT | held rows + bytes |
| agent tool call → document reads | model-chosen document ids | archived / source-gone content |
| browser → `/retention/*` | org admin or member JWT + `X-Org-Id` (validated against `org_members`) | policies, holds, queue, receipts |
| nightly daemon → Postgres | no caller identity; claim + lease only | archive / queue writes |
| server payload → browser render | member and admin payloads differ at the server | matter names |
| executor → production Supabase MCP / local DB | evidence gathering (275-05) | production data |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (evidence at HEAD) | Status |
|-----------|----------|-----------|-------------|-------------------------------|--------|
| T-275-01 | Tampering | held doc deleted via service role / FK cascade / TRUNCATE / future code | mitigate | BEFORE DELETE row triggers `206:112-143` (fast path widened to "no active hold anywhere"; triggers bound at `204:357-359,380-382`). TRUNCATE statement guard `204:450-468`. `REVOKE TRUNCATE … FROM authenticated, anon` `204:470`. Live tests: `test_275_hold_triggers.py::test_service_pool_delete_of_a_held_document_is_refused`, `::test_deleting_the_owner_from_auth_users_is_refused_through_the_fk_cascade`, `::test_truncate_is_refused_while_a_hold_is_active…` | closed |
| T-275-02 | Tampering | held doc moved out of a held folder, then deleted | mitigate | sticky-coverage BEFORE UPDATE OF folder_id / parent_id triggers `204:387-447`. Org/owner moves of held rows refused by `206:146-207` (CR-01). Tests `::test_moving_a_folder_held_document_out_keeps_it_held`, `::test_moving_a_covered_subfolder_out_keeps_its_contents_held`, `test_275_review_hardening.py::test_cr01_*` | closed |
| T-275-03 | Tampering | owner un-archives through PostgREST (D-19) | mitigate | `documents_protect_archive_state` BEFORE UPDATE OF the 3 archive columns, refusing `authenticated`/`anon` `204:476-497` (INVOKER on purpose, so `current_user` is the caller). Test `::test_owner_cannot_change_archive_state_and_the_service_can` | closed |
| T-275-04 | Info disclosure | matter name reaches a member via trigger message or table read (D-17) | mitigate | every RAISE names an id only (`204:353,376,459,573`; `206:125,141,175,199`). SELECT policies gated on `current_user_has_permission(org,'org:manage')` `204:672-687`. `retention_sweeps` has no authenticated grant `204:665-669`. Test `test_275_policy_rls.py::test_a_member_reads_nothing_and_the_admin_reads_the_seeded_rows` | closed |
| T-275-05 | EoP | member or other-org admin writes a policy/hold row | mitigate | INSERT/UPDATE `WITH CHECK (… 'org:manage') AND org_id IN current_user_org_ids())` `204:690-701`. D-35 same-org coverage trigger `204:554-575` (bound by key `206:234-239`). Tests `::test_a_member_cannot_create_a_hold`, `::test_an_admin_of_org_a_cannot_write_a_hold_for_org_b` | closed |
| T-275-06 | Info disclosure | archived/source-gone content reaches the agent via an RPC arm or model SQL | mitigate | STORED `retrievable` column `205:51-52`. `AND d.retrievable` in both `match_document_chunks` branches `205:110,133` and in `keyword_search_chunks` `205:180`. Four RESTRICTIVE GUC policies on documents/chunks/tables/images `205:267-277`. Auditor scan of full-schema: the only SECURITY DEFINER functions that read chunk/table/image data are those two RPCs plus the ops-only `resize_embedding_column`, so no DEFINER side door around the policies. Tests `test_275_retrievable.py::test_*_is_excluded_from_every_rpc_arm` (×4), `::test_agent_sql_cannot_see_an_archived_document_or_its_chunks` | closed |
| T-275-07 | Repudiation | receipt lost when approver deleted | mitigate | `actor_id … ON DELETE SET NULL` + `actor_name`. `document_id` has no FK `204:199-221`. service_role gets only SELECT, INSERT and authenticated gets SELECT only `204:658-663`. Tests `::test_a_receipt_outlives_its_actor`, `::test_receipts_are_immutable_for_every_role` | closed |
| T-275-08 | EoP | new SECURITY DEFINER fns executable via the PUBLIC default | mitigate | every new function revokes PUBLIC and anon, then grants back only what it needs: predicates → service_role only `204:323-336`, `206:102-109`. Trigger fns `204:586-594`, `206:335-338`. RPCs / `query_user_documents` / `document_is_retrievable` `205:192-200,245-247,261-264`. `storage_object_backs_document` / `delete_folder_tree` `206:220-223,329-332`. Every SECURITY DEFINER fn in 204/205/206 carries `SET search_path TO ''`. Production `get_advisors(security)` is owed at deploy (see Deploy obligations) | closed |
| T-275-09 | DoS | missing stats flip the vector plan to a seq scan | mitigate | `ANALYZE public.documents` `204:249`, `205:54` | closed |
| T-275-10 | DoS | recursive folder walk loops on a parent cycle | mitigate | `CYCLE id SET is_cycle` `204:263`; `delete_folder_tree` `206:317`. The loader raises on a cycle (`load.py:355`) | closed |
| T-275-11 | Tampering | plan-cache regression from dropping the plan pin | mitigate | `SET search_path TO ''` + `SET plan_cache_mode TO 'force_custom_plan'` in both RPC headers `205:71-72,157-158`. Auto-scan `tests/unit/test_272_review_fixes.py`. Test `::test_both_rpcs_keep_the_plan_pin_and_search_path` | closed |
| T-275-12 | Tampering | storage bytes removed before the row delete is refused (D-38) | mitigate | order is guard → rows → bytes on every door. `documents.py:1853-1869` (scope=all), `:1873-1884` (version). `folders.py:182-200`. Confirm `disposition.py:475-480`. The DB storage policy refuses a user-JWT delete of any object still backing a row `206:212-231` (CR-02). It is the only DELETE policy on the `documents` bucket, and there is no UPDATE policy, so move/overwrite is no second door (`full-schema.sql:9933-9946`). Tests `test_275_delete_paths.py::test_a_pt409_race_on_the_row_delete…_no_byte_is_removed`, `test_cr02_a_user_jwt_cannot_delete_a_file_that_still_backs_a_document` | closed |
| T-275-13 | Repudiation | watch purge reports `purged_count` for refused rows | mitigate | the swallow is removed. `map_hold_refusal` re-raises PT409 as 409 and any other error propagates. `purged_count` is set only after the delete returns (`sources.py:479-489`); the watch delete runs only after the documents delete (`sources.py:334-342`) | closed |
| T-275-14 | Info disclosure | matter name returned to a member in a 409 | mitigate | `assert_none_held` computes `can_manage` AS THE CALLER via `_has_org_permission`, failing closed to the member sentence (`hold_guard.py:199,246-255`). `refusal_for` adds matters only when `can_manage` (`:87-113`). `map_hold_refusal` defaults to `can_manage=False` (`:210-225`) | closed |
| T-275-15 | Info disclosure | agent reads archived content via read/fetch/analyze/query_tables | mitigate | `agent_wall.unretrievable` (fails closed) at `tool_dispatcher.py:363` (read_document), `:406` (fetch_document_file + attach_skill_file), `:1088` (analyze_document). `.eq(RETRIEVABLE_COLUMN, True)` at `retrieval_documents.py:90,102,125,162`. `test_275_agent_wall.py` (24 cases) | closed |
| T-275-16 | Info disclosure | listing tools name archived/source-gone documents | mitigate | `kb.py` ls/tree/glob `.eq(RETRIEVABLE_COLUMN, True)` at `:75,93,103,153,164,354,364`. `retrievable_only=True` at `tool_dispatcher.py:923` (count, so the total is counted on the filtered set), `:927`, `:1037`. `document_view_resolver.py:351`. `document_relationship_service.py:394,436` (the subject too, IN-04) | closed |
| T-275-17 | DoS | Library can no longer open/download an archived doc | mitigate | `kb.read_path` and `documents.py` carry no `retrievable` filter (auditor grep: 0 hits). Fences `test_275_agent_wall.py::test_read_path_is_untouched…`, `::test_the_library_routes_never_name_the_keyword`. G-4 LIFECYCLE download 200 | closed |
| T-275-18 | Tampering | refused folder delete partially removes a subtree | mitigate | guard over every doc id AND every subtree folder id first (`folders.py:182-185`, via `retention_held_folders` `206:75-99`). Docs + folder delete in ONE transaction, `delete_folder_tree` (INVOKER, RLS applies) `206:300-327`, called at `folders.py:190-191`. Test `test_wr03_delete_folder_tree_is_all_or_nothing` | closed |
| T-275-19 | EoP | member creates/edits a policy or confirms a delete | mitigate | `Depends(require_org_manage)` on all 17 non-member `/retention` routes (`retention.py:186,201,243,279,301,331,357,448,463,493,545,572,583,636,666,692,718`). Only `document-states` (`:829-835`) omits it, by design. `require_org_manage` checks `current_user_has_permission` as the caller after `X-Org-Id` is validated against `org_members` (`dependencies.py:899-929,1072-1089`). No JWT write grant on `retention_policies` (`204:609-614`). G-4 MEMBER-2: member POST/PUT → 403 with a positive control | closed |
| T-275-20 | EoP / Tampering | admin of org A disposes org B documents | mitigate | every service-pool statement binds the active org: `db/retention.py:263-268,300-336,338-356,358-388,397`; `load.py:151-177`; `disposition.py:347,362-363,560-571,620,627,738-739,782,793,800-801`. Each id route returns 404 cross-org (`retention.py:249,306-308,336-338,498-500,550-552`). Test `test_275_retention_api.py:335-339` | closed |
| T-275-21 | Tampering | Save without a dry run / forged preview | mitigate | Save requires a server-recorded `retention_previews` row, keyed by the canonical draft hash with org and policy id, ≤ `PREVIEW_TTL_MINUTES = 30` (`db/retention.py:40,239-246`). Otherwise 409 (`retention.py:285-286,310-311`). No JWT write grant on previews `204:616-621`. The evaluator's `not_previewed` check is a second defence (`evaluate.py:360-361`) | closed |
| T-275-22 | Tampering | stale confirm deletes a now-held/changed doc | mitigate | `typed_count == len(delete_ids)` (`disposition.py:445`). Inside each family's transaction: row lock, `retention_held_documents`, revision, fingerprint, and the exact family-membership re-check (`:553-589`). PT409 race → `did_not_delete` (`:637-640`). DB trigger backstop | closed |
| T-275-23 | Tampering | ambiguous/incomplete evaluation disposes documents | mitigate | `IncompleteEvaluation` from load (`load.py:132-148,192,234,248,342-355`). Sweep: zero writes plus a `sweep_incomplete` receipt (`disposition.py:291-312`). Undecidable kinds never dispose (`evaluate.py:78,387-388`) | closed |
| T-275-24 | Info disclosure | matter names to members via document-states | mitigate | ids are RLS-read as the caller first (`retention.py:839-840`). `can_manage` via `_has_org_permission` (`:841`). `hold_names` only `if can_manage and held` (`:798,825`); the member hold line has no matter (`hold_guard.hold_line_for`) | closed |
| T-275-25 | Info disclosure | admin learns private doc names via preview/hold | mitigate | private families evaluate to `private` (`evaluate.py:338`). Preview returns only a COUNT, `private_not_covered` (`disposition.py:175-198`). Hold ids are validated through RLS on the user connection (`retention.py:363-379,467-470,503-506`) | closed |
| T-275-26 | DoS | sweep runs twice across workers | mitigate | `FOR UPDATE SKIP LOCKED` + lease + in-TX `next_run_at` advance (`db/retention.py:78-123`). Run-now lease (`:126-143`) | closed |
| T-275-27 | Tampering | sweep/disposition touches workspace_files | mitigate | auditor grep: `workspace_files` appears in no retention module, `api/retention.py` or `db/retention.py` (exit 1). Recorded FK SET NULL integration assertion | closed |
| T-275-28 | Tampering | production sweep before anyone read a dry run | mitigate | `retention_sweep_enabled: bool = False` (`config.py:1436`). Daemon starts only behind the flag (`main.py:610`). Run-now 409 when off (`retention.py:719-720`). Default `false` in `.env.example:361`, `onebox.env.example:283`, `docker-compose.prod.yml:111`; `OPERATOR.md:173` | closed |
| T-275-29 | Repudiation | an action without a receipt | mitigate | receipts in the same transaction as each write: archive/queue (`disposition.py:394`), delete (`:630-634`), did_not_delete (`:644-649`), keep (`:672-687`). Policy save/delete and hold release in their own TX (`db/retention.py:290-296,328-334,350,374`). `audit_log` with an explicit org (`retention.py:157-160`) | closed |
| T-275-30 | Info disclosure | matter name rendered to a member | mitigate | the server omits names (T-275-24). Test `libraryRetention.test.tsx:246` "member: the hold line is EXACTLY the D-17 sentence and names no matter". G-4 MEMBER `innerText.includes(matter) === false` | closed |
| T-275-31 | Tampering | accidental mass delete by an admin | mitigate | `WaitingForYou.test.tsx:98` (all ticked, disabled until typed == N) and `:116` (untick clears the typed count). Server re-check `disposition.py:445` | closed |
| T-275-32 | Tampering | save without a preview through the UI | mitigate | `RetentionPolicyEditor.tsx:547` `aria-disabled={!canSave}`. Tests `RetentionPolicyEditor.test.tsx:229,261,326` (server 409 rendered, Save re-locked). The server is the wall (T-275-21) | closed |
| T-275-33 | Repudiation | write with no visible receipt | mitigate | `onRecorded` band pulse (`DeleteBatchCard.tsx:315`, `LegalHoldsList.tsx:91`). Test `RetentionTab.test.tsx:246`. No toasts (062-A). History reads `retention_receipts` 1:1 | closed |
| T-275-34 | Spoofing | member reaches retention editing | accept | see Accepted Risks Log AR-275-01. Server-side backing verified: T-275-19 + G-4 MEMBER-2 403 | closed |
| T-275-35 | Tampering | accidental production write while gathering evidence | mitigate | 275-G4-EVIDENCE.md:134 (every statement on `127.0.0.1:54322`, no Supabase MCP call). The prod migrations are recorded as OWED operator rows (§6.4), not performed. Documentary evidence; a process threat has no code locus | closed |
| T-275-36 | Repudiation | G-4 row claimed without running | mitigate | each HOLD/LIFECYCLE/MEMBER row records words seen + a SQL read (26 scenario rows; e.g. MEMBER-2 at G4-EVIDENCE:193). OWED is the default | closed |
| T-275-37 | Info disclosure | test credentials in committed evidence | mitigate | auditor grep for `password`/`passwd` in 275-G4-EVIDENCE.md: only the two statements that none appear (`:82,135`). Accounts are named by role | closed |
| T-275-38 | Tampering | G-4 fixtures left with active holds | mitigate | 275-G4-EVIDENCE.md §5.5: holds released, policy removed, folders deleted (204s); final SQL reads 0 active holds and 0 policies | closed |
| T-275-39 | Tampering | model SQL calls `set_config('app.agent_read','off')`, plain or via a `U&` escape | mitigate | denylist `~* '(set_config\|current_setting\|u&[''"]\|query_to_xml\|ts_stat\|ts_rewrite)'` before EXECUTE `205:226-229` (case-insensitive; `query_to_xml` also matches `query_to_xmlschema`/`_and_xmlschema`). Model SQL runs only through `query_user_documents` on the user-context connection as `authenticated` (`sql_service.py:104-105`, `kb.py:284`), so the RESTRICTIVE policies bind it. Auditor scan of full-schema: no other callable function sets a GUC or EXECUTEs a caller string, and no `dblink`. Data-modifying CTEs cannot reach `pg_settings`: the text must start with `select` and is wrapped as a subquery. Tests `test_275_retrievable.py::test_text_that_could_switch_the_guc_is_refused_before_it_runs` (7 parametrisations), `::test_the_guc_is_scoped_to_the_call` | closed |
| T-275-40 | Tampering | admin JWT writes previewed_revision / released_at directly | mitigate | service-role-only column triggers `204:499-550`. The API writes them via the service pool after its checks (`db/retention.py:271-336,358-379`). Tests `::test_protected_columns_are_refused_by_the_trigger_even_with_a_grant`, `::test_an_insert_cannot_set_protected_columns` | closed |
| T-275-41 | Tampering | folder delete removes caller docs before the DB refuses the folder (B-1) | mitigate | `retention_held_folders` checked first (`hold_guard.py:191`), and it covers a held empty subfolder and another owner's held doc (`206:75-99`). Then the one-TX `delete_folder_tree`. Test `::test_held_folders_reports_empty_ancestor_and_foreign_content_and_never_a_name` | closed |
| T-275-42 | Repudiation | disposition receipt without a policy name | mitigate | CHECK `retention_receipts_disposition_names_policy` `204:217-220`. Test `::test_a_disposition_receipt_must_name_its_policy` | closed |
| T-275-43 | EoP | protected columns written outside the API's checks | mitigate | service-pool writes only after `require_org_manage` + org/folder/preview checks (`retention.py:282-288,304-316,548-559`). The 204 trigger refuses JWT writes (T-275-40). A policy folder must be in the policy's org `206:242-258` | closed |
| T-275-44 | EoP | admin/member edits a policy directly through PostgREST | mitigate | `REVOKE ALL` then `GRANT SELECT` only on `retention_policies` to authenticated (`204:609-613`). legal_holds: SELECT, INSERT only, no UPDATE/DELETE (`204:623-627`). Tests `::test_member_and_admin_cannot_write_a_policy_through_the_jwt`, `::test_admin_cannot_update_a_hold_through_the_jwt_but_can_create_one` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Focus checks requested for this audit

| Check | Result |
|---|---|
| RLS on every new table | **PASS.** 204 creates 9 tables and enables RLS on all 9 (`204:599-607`). 205 and 206 create no tables. `retention_sweeps` has RLS, no policy and no authenticated grant, so it is service-role only |
| EXECUTE revoked from PUBLIC (not just anon) on every new function, needed roles granted back | **PASS.** Every new function in 204/205/206 has `REVOKE … FROM PUBLIC` before or alongside the anon revoke, followed by explicit grants. The predicates are service_role only. `document_is_retrievable` and `storage_object_backs_document` are granted to authenticated because RLS/storage policy evaluation needs it. `delete_folder_tree` is granted to authenticated (INVOKER). Trigger functions have no direct grant, which is correct: EXECUTE is checked at CREATE TRIGGER, not at fire time |
| SECURITY DEFINER functions have a fixed search_path | **PASS.** All 17 unique SECURITY DEFINER functions defined in 204/205/206 carry `SET search_path TO ''` (enumerated by parsing every `CREATE OR REPLACE FUNCTION` header). `query_user_documents` is deliberately INVOKER with no search_path (it must resolve the model's unqualified names), so the caller's own privileges bound it and it is not an escalation vector |
| `require_org_manage` on every /retention write route + cross-org on id routes | **PASS.** 17/17 non-member routes are gated. Every id route re-reads the row WHERE `id = $1 AND org_id = $active` and returns 404 otherwise |
| `app.agent_read` not settable from model SQL | **PASS** (T-275-39) |
| Storage-object delete guard | **PASS** (T-275-12 / CR-02). It is a user-JWT policy only. The service role is unaffected by design, and every service-role byte removal runs after its row delete |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-275-01 | T-275-34 | Members have no retention UI (079 D3; the Org admin door is absent for members). Hiding a control is not a security boundary, so the accepted part is only that the UI does not itself enforce the role. Enforcement is server-side and was verified in this audit: `require_org_manage` on every write route (T-275-19), no JWT write grant on `retention_policies` (T-275-44), and G-4 MEMBER-2 measured member POST/PUT/preview/summary/run-now → 403 with a positive control. | Plan 275-04 threat model (disposition `accept`); confirmed by gsd-security-auditor | 2026-10-12 |

---

## Unregistered Flags

None. All five SUMMARY `## Threat Flags` sections read "None beyond the plan's register". The two
items they name (the member-readable `document-states` route and the service-pool org binding) map
to T-275-24 and T-275-20.

### Auditor observations (informational, not threats in the register, not blockers)

- **Existence oracles (low).** `document_is_retrievable(uuid)` (review B-IN-01, recorded and not fixed) and the 206 helper `storage_object_backs_document(text)` are SECURITY DEFINER, callable by `authenticated`, and check neither org nor visibility. Each reveals one boolean about a document UUID or file path (`{user_id}/{document_id}/{filename}`). Content is never exposed, and both inputs require unguessable UUIDs. Adding an org predicate needs its own EXPLAIN on the vector hot path (B-IN-01's reason for deferring).
- **Forged hold attribution (low).** An org:manage admin's direct PostgREST INSERT into `legal_holds` can set `created_by_name` (B-IN-02, recorded). By the same direct path, the admin can insert coverage for a private document of the same org whose UUID they hold: the D-35 trigger checks org, not visibility, while the API checks visibility through `_readable_ids`. The effect is only "cannot delete" and requires an admin of that org.
- **Production depends on 206.** The CR-01/02/03 hold bypasses are closed only where migration **206** is applied. 275-G4-EVIDENCE.md §6.4 row 1 still lists only 204 → 205. 275-VERIFICATION.md and 275-REVIEW-backend.md § Fix pass give the correct order, **204 → 205 → 206 before the backend deploy**. A production DB at 205 would have the database half of the hold reopened.

### Deploy obligations (security-bearing, operator-gated; not performed by this audit)

1. Production: apply 204 → 205 → 206, one approved SQL-editor write each, with VERIFY rows PASS, **before** the backend deploy.
2. `get_advisors(security)` on production after the migrations (T-275-08's owed half).
3. `RETENTION_SWEEP_ENABLED` stays `false` in Coolify until an org admin has read a dry run (T-275-28).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-12 | 44 | 44 | 0 | gsd-security-auditor (Claude), at `6aa0c79e0`. ASVS L1, block_on high. Read-only on code. Ran `pytest tests/unit -q -k "275 or retention"` → `227 passed, 7008 deselected`. Live integration suites not re-run (shared local DB); cited by test name |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-12

# Phase 275 — G-4 evidence, success/failure-criteria matrix, threat register check

**Merged tree:** `develop` at `71c61a6f0` (275-01..04 landed), PHASE_BASE `b41d51d6b`.
**Written by:** 275-05 Task 1 (this file's §1-§4). §5 (the three D-26 Chrome drives, HOLD / LIFECYCLE / MEMBER)
is appended by Task 2; §6 (known limits, registers, owed operator rows) by Task 3.

Every gate verdict quoted here is recorded verbatim in `275-BASELINES.md` → "275-05 Task 1 — merged-tree gates".
Test ids are `file::test`. "Live" = runs against the local Supabase Postgres (`127.0.0.1:54322`); every
live suite named below ran green on the merged tree at 275-05 (`71 passed`, no skips — see BASELINES).

---

## §1 — ROADMAP 275 success criteria (SC#3 as reworded by D-09)

| SC | What must be true | Evidence on the merged tree | Verdict |
|---|---|---|---|
| SC#1 | An org admin sets a policy on a class or folder (period + archive/delete/review); a member can neither create nor change one (RET-01). | Server wall: `test_275_retention_api.py::test_a_member_is_refused_by_the_server_and_nothing_is_reached` (every write route, member → 403, nothing reached) and `::test_every_manage_route_declares_the_gate_and_document_states_does_not` (`Depends(require_org_manage)` on 17 write routes; `grep -c require_org_manage backend/app/api/retention.py` = 21 incl. import/docs). DB wall: `test_275_policy_rls.py::test_member_and_admin_cannot_write_a_policy_through_the_jwt` (live; no JWT INSERT/UPDATE/DELETE on `retention_policies`, mig 204 `:609-612` REVOKE ALL). Admin path: `::test_save_after_a_preview_writes_through_the_service_pool`. Plant (275-03): swapping the gate on `POST /sweep/run` turned 2 cases red, restored md5-identical. Lived-experience proof: G-4 MEMBER (Task 2). | PASS (automated); G-4 MEMBER owed to Task 2 |
| SC#2 | A held document is not disposed by the sweep and cannot be deleted through the ordinary delete path while the hold stands (RET-02). | Delete path: `test_275_delete_paths.py::test_version_scope_held_refuses_before_anything_is_removed`, `::test_all_scope_held_sibling_refuses_with_every_sibling_id_and_removes_nothing`, `::test_a_pt409_race_on_the_row_delete_is_the_member_409_and_no_byte_is_removed`; call sites `backend/app/api/documents.py:1854,1874`. DB backstop (live): `test_275_hold_triggers.py::test_owner_delete_of_a_held_document_is_refused_and_an_unheld_sibling_deletes`, `::test_release_ends_the_refusal`, `::test_any_version_of_a_held_family_is_refused_and_metadata_still_updates`. Sweep: `test_275_evaluate.py::test_held_comes_before_every_policy_decision`; live `test_275_disposition.py::test_confirm_deletes_every_version_drops_a_late_hold_and_the_receipt_outlives_the_row` (a hold placed after queueing drops that family at confirm, `did_not_delete` receipt). G-4 HOLD (Task 2) drives the UI + a direct `fetch` DELETE. | PASS (automated); G-4 HOLD owed to Task 2 |
| SC#3 (reworded) | A dry run reports exactly what a sweep would do before any real sweep; the sweep archives the archive set and queues the delete set; nothing is deleted until an admin confirms; one receipt per action naming document, policy, action, approver (deletes) and time; incomplete/ambiguous disposes nothing (RET-03). | Exactness: live `test_275_disposition.py::test_preview_equals_sweep_and_the_sweep_only_archives_and_queues` (preview buckets == sweep writes; org-B untouched). Only confirm deletes: `test_275_sweep.py::test_the_sweep_path_never_deletes_a_document`, `::test_only_disposition_deletes_a_document`, `::test_the_one_document_delete_is_reached_only_from_confirm_batch` (AST); `grep "DELETE FROM public.documents"` over the retention modules → ONE hit, `disposition.py:542`. Preview before save: `test_275_retention_api.py::test_save_without_a_matching_fresh_preview_is_409_and_nothing_is_written`; `test_275_evaluate.py::test_a_policy_saved_without_a_preview_of_this_revision_does_nothing`. Receipts: live disposition cases assert `actor_name` + `policy_name` on every `archived` / `queued_delete` / `deleted` receipt and `count(*) … policy_name IS NULL` = 0 (`:318`); mig 204 `:219` CHECK; `test_275_policy_rls.py::test_a_disposition_receipt_must_name_its_policy`. Fail-closed: live `::test_an_incomplete_org_disposes_nothing`; `test_275_sweep.py::test_an_incomplete_read_writes_no_document_or_queue_change`; `test_275_evaluate.py::test_an_unreadable_rule_is_undecidable_never_a_disposal`, `::test_a_folder_and_a_class_policy_that_differ_collide_and_nothing_happens`, `::test_document_date_clock_with_no_document_date_is_no_date_with_no_fallback`. Approver typed count: `test_275_retention_api.py::test_a_wrong_typed_count_is_422_and_nothing_is_deleted`. | PASS (automated); G-4 LIFECYCLE owed to Task 2 |
| SC#4 | An archived document leaves default chat retrieval, is found by document search with an archive filter, and can be opened and downloaded (RET-04). | Both RPC arms (live): `test_275_retrievable.py::test_archived_is_excluded_from_every_rpc_arm` (+ the three source-state cases), `::test_the_retrievable_column_is_the_one_predicate`; model SQL: `::test_agent_sql_cannot_see_an_archived_document_or_its_chunks`, the 7 GUC-bypass parametrisations. Agent tools: `test_275_agent_wall.py` (24 cases — read_document, fetch_document_file, analyze_document, query_tables, ls/tree/glob, query_documents_by_view, get_related_documents). Find: `test_275_find_archived.py::test_find_hides_archived_documents_by_default`, `::test_include_archived_returns_them`, `::test_the_archived_filter_is_on_every_candidate_leg`. Open/download untouched: `test_275_agent_wall.py::test_read_path_is_untouched_so_the_library_still_opens_an_archived_document`, `::test_the_library_routes_never_name_the_keyword`. Lived proof (chat answer + both-arm RPC reads before/after, Download 200): G-4 LIFECYCLE (Task 2, W-7/W-8). | PASS (automated); G-4 LIFECYCLE owed to Task 2 |

## §2 — "How we'd know this failed" (ROADMAP 275, all 7 lines)

| # | Failure criterion | Evidence it did NOT happen | Verdict |
|---|---|---|---|
| F1 | The hold is checked by the sweep but not by `DELETE /documents/{id}` (decorative). | `backend/app/api/documents.py:1854` + `:1874` call `hold_guard.assert_none_held` before any row delete, and `map_hold_refusal` maps a racing PT409; `test_275_delete_paths.py` (24 cases incl. `::test_every_storage_remove_in_delete_document_follows_its_row_delete`); the BEFORE DELETE trigger refuses even if the route forgot (`test_275_hold_triggers.py::test_owner_delete_of_a_held_document_is_refused_and_an_unheld_sibling_deletes`). Also folders (`api/folders.py:182`) and both watch purges (`api/sources.py:334,479`). G-4 HOLD's direct `fetch` DELETE (W-3) is Task 2. | PASS (automated) |
| F2 | The first real sweep runs before a dry run exists. | `backend/app/config.py:1436` `retention_sweep_enabled: bool = False`; `main.py:610` constructs the daemon only behind it (`test_275_sweep.py::test_the_sweep_flag_defaults_off`, `::test_the_lifespan_constructs_the_daemon_only_behind_the_flag`); run-now refused while off (`test_275_retention_api.py::test_run_now_is_refused_while_scheduled_sweeps_are_off`, `api/retention.py:708`); a policy cannot be saved without a fresh preview (409, `::test_save_without_a_matching_fresh_preview_is_409_and_nothing_is_written`) and a policy whose revision was never previewed does nothing (`test_275_evaluate.py::test_a_policy_saved_without_a_preview_of_this_revision_does_nothing`); `RETENTION_SWEEP_ENABLED` in all 4 deploy artifacts — `check-deploy-drift.sh` PASS. | PASS |
| F3 | An audit record omits the policy. | mig 204 `:219` CHECK (`policy_name IS NOT NULL` for disposition actions); `test_275_migration_204_shape.py::test_a_disposition_receipt_must_name_its_policy`; live `test_275_policy_rls.py::test_a_disposition_receipt_must_name_its_policy` (the INSERT is refused); live `test_275_disposition.py` asserts zero NULL-policy disposition receipts after a full sweep + confirm. | PASS |
| F4 | The archived exclusion applies to one retrieval arm only. | mig 205 reads `d.retrievable` in BOTH branches of `match_document_chunks` and in `keyword_search_chunks` (`test_275_migration_205_shape.py::test_both_rpcs_use_the_column_in_every_branch`; plant "restore the source_disconnected clause in keyword" went RED in 275-01); live `test_275_retrievable.py` runs every state against every arm; the agent SQL arm (`query_user_documents`) is covered by the RESTRICTIVE GUC policies (`::test_agent_sql_cannot_see_an_archived_document_or_its_chunks`). | PASS |
| F5 | A policy reaches another org's documents. | Every loader statement binds `org_id = $1` (`services/retention/load.py:18`); out-of-org parent → `IncompleteEvaluation` (`load.py:186,200`); live `test_275_disposition.py::test_preview_equals_sweep_and_the_sweep_only_archives_and_queues` asserts the org-B document is untouched by an org-A policy; API: `test_275_retention_api.py::test_another_orgs_policy_hold_or_document_reads_as_absent`, `::test_a_policy_folder_in_another_org_is_422_and_one_in_this_org_need_not_be_shared`, `::test_a_hold_on_an_unreadable_or_foreign_id_is_422_and_nothing_is_written`; DB: `test_275_hold_triggers.py::test_a_hold_in_org_a_never_refuses_a_delete_in_org_b`, `::test_coverage_cannot_reference_another_orgs_document`, `test_275_policy_rls.py::test_an_admin_of_org_a_cannot_write_a_hold_for_org_b`. | PASS |
| F6 | The sweep touches `workspace_files`. | Source fence `test_275_sweep.py::test_no_retention_module_touches_workspace_files_or_the_scheduler` (parametrised over every retention module); `grep -rn workspace_files backend/app/services/retention/ backend/app/db/retention.py backend/app/api/retention.py` → **0**. SQL read: live `test_275_disposition.py::test_confirm_deletes_every_version_drops_a_late_hold_and_the_receipt_outlives_the_row` seeds a `workspace_files` row linked to a document, confirms the delete, then `SELECT library_document_id FROM public.workspace_files WHERE id = $1` → the row survives with the link NULLed (`:298-299`) — green in this run. | PASS |
| F7 | A service-role delete path bypasses the hold. | Live: `test_275_hold_triggers.py::test_service_pool_delete_of_a_held_document_is_refused`, `::test_deleting_the_owner_from_auth_users_is_refused_through_the_fk_cascade`, `::test_deleting_the_held_folders_parent_is_refused_through_the_child_cascade`, `::test_a_folder_directly_holding_a_held_document_cannot_be_deleted`, `::test_truncate_is_refused_while_a_hold_is_active_and_authenticated_cannot_truncate`, `::test_moving_a_folder_held_document_out_keeps_it_held`. The refusal lives in BEFORE DELETE / BEFORE TRUNCATE triggers (mig 204 `:358,381,464,467`), so it holds for every role and every future code path. | PASS |

## §3 — Threat register check (W-6b: enumerated by grep, never a fixed range)

Enumeration command (as written in the plan):
`grep -ho "T-275-[0-9]*" .planning/phases/275-retention-legal-hold/275-0*-PLAN.md | sort -u | wc -l` → **45**.
⚠ The 45th token is the bare prefix `T-275-` — the `[0-9]*` pattern matches zero digits, and plan 05 quotes
its own grep three times. With `-E "T-275-[0-9]+"` the count is **44**, and that is the id set below:

`T-275-01 … T-275-44` — every integer 01-44, no gaps:
01 02 03 04 05 06 07 08 09 10 11 (275-01) · 12-18 (275-02) · 19-29, 43 (275-03) · 30-34 (275-04) · 35-38 (275-05) · 39-42, 44 (275-01).

| Id | Category | Threat | Disposition | Implementation (file:line) / test | Check |
|---|---|---|---|---|---|
| T-275-01 | T | held doc deleted via service role, FK cascade, TRUNCATE or future code | mitigate | mig 204 `:340-381` BEFORE DELETE triggers, `:450-470` TRUNCATE trigger + REVOKE; live hold_triggers service-pool / auth.users / parent-cascade / truncate cases | ✅ |
| T-275-02 | T | held doc moved out of a held folder then deleted | mitigate | mig 204 `:387-445` sticky-coverage triggers; `test_275_hold_triggers.py::test_moving_a_folder_held_document_out_keeps_it_held`, `::test_moving_a_covered_subfolder_out_keeps_its_contents_held` | ✅ |
| T-275-03 | T | owner un-archives through PostgREST | mitigate | mig 204 `:476-495` `documents_protect_archive_state`; `::test_owner_cannot_change_archive_state_and_the_service_can` | ✅ |
| T-275-04 | I | matter name leaks via trigger message or direct read | mitigate | `test_275_migration_204_shape.py::test_no_raise_interpolates_a_matter_name`; `test_275_policy_rls.py::test_a_member_reads_nothing_and_the_admin_reads_the_seeded_rows` | ✅ |
| T-275-05 | E | member / other-org admin writes a policy or hold row | mitigate | `test_275_migration_204_shape.py::test_every_write_policy_is_org_manage_and_org_scoped`; live `::test_a_member_cannot_create_a_hold`, `::test_an_admin_of_org_a_cannot_write_a_hold_for_org_b` | ✅ |
| T-275-06 | I | archived/source-gone content reaches the agent via an RPC arm or model SQL | mitigate | mig 205 `:52` generated column, both RPC bodies, 4 RESTRICTIVE policies; `test_275_retrievable.py` (all states × both arms + chunk SQL) | ✅ |
| T-275-07 | R | receipt lost when the approver is deleted | mitigate | mig 204 `:212` `actor_id … ON DELETE SET NULL`, no document FK; `test_275_policy_rls.py::test_a_receipt_outlives_its_actor`, `::test_receipts_are_immutable_for_every_role` | ✅ |
| T-275-08 | E | new SECURITY DEFINER functions executable via PUBLIC | mitigate | mig 204 `:323-333,586-594` REVOKE … FROM PUBLIC first; `test_275_migration_204_shape.py::test_public_is_revoked_before_every_execute_grant`; `test_275_policy_rls.py::test_only_the_service_role_executes_the_predicates` (privilege read, never a call — see BASELINES crash finding). ⚠ `get_advisors(security)` on PRODUCTION is OWED at deploy (Task 3 owed rows) | ✅ local · prod owed |
| T-275-09 | D | missing statistics flip the vector plan to a seq scan | mitigate | mig 204 `:249` + mig 205 `:54` ANALYZE after the column add; **M-1 re-check at 275-05**: EXPLAIN on the local DB and on recall_bench both use `document_chunks_embedding_idx` (BASELINES) | ✅ |
| T-275-10 | D | recursive folder walk loops on a parent cycle | mitigate | mig 204 `:263` `CYCLE id SET is_cycle`; `test_275_migration_204_shape.py::test_every_recursive_walk_is_cycle_bounded`; `test_275_evaluate.py::test_a_folder_walk_with_a_cycle_ends` | ✅ |
| T-275-11 | T | plan cache regression from dropping the pin on CREATE OR REPLACE | mitigate | mig 205 `:72,158` `SET plan_cache_mode`; `test_275_retrievable.py::test_both_rpcs_keep_the_plan_pin_and_search_path[*]` (live) | ✅ |
| T-275-12 | T | storage bytes removed before the row delete is refused | mitigate | `api/documents.py:1868,1883` `.remove` after the row delete; `test_275_delete_paths.py::test_every_storage_remove_in_delete_document_follows_its_row_delete`, `::test_a_pt409_race_on_the_folder_document_delete_removes_no_byte` | ✅ |
| T-275-13 | R | watch purge reports `purged_count` for refused rows | mitigate | `api/sources.py:479-482`; `test_275_delete_paths.py::test_purge_missing_unheld_counts_only_after_the_delete_succeeded`, `::test_sources_no_longer_log_and_continue_around_a_document_delete` | ✅ |
| T-275-14 | I | matter name returned to a member in a 409 | mitigate | `services/retention/hold_guard.py:246` `_can_manage` as the caller, fails closed; `test_275_hold_guard.py::test_member_gets_the_ported_sentence_and_no_matter_name` | ✅ |
| T-275-15 | I | agent reads archived content via read_document / fetch_document_file / analyze_document / query_tables | mitigate | `services/retention/agent_wall.py:46`; `tool_dispatcher.py:363,406,1088`; `retrieval_documents.py:90,102,125,162`; `test_275_agent_wall.py` per-tool cases | ✅ |
| T-275-16 | I | listing tools name archived documents | mitigate | `api/kb.py:75-364` (7 `.eq(RETRIEVABLE_COLUMN, True)`); `tool_dispatcher.py:923,927,1037` `retrievable_only=True`; `test_275_agent_wall.py::test_ls_omits_…`, `::test_query_documents_by_view_inline_filters_rows_and_counts_the_filtered_set`, `::test_get_related_documents_tool_omits_a_source_gone_endpoint` | ✅ |
| T-275-17 | D | Library can no longer open/download an archived document | mitigate | `read_path` + Library routes untouched; `test_275_agent_wall.py::test_read_path_is_untouched_so_the_library_still_opens_an_archived_document`, `::test_the_library_routes_never_name_the_keyword`; G-4 LIFECYCLE Download (Task 2) | ✅ automated |
| T-275-18 | T | refused folder delete partially removes a subtree | mitigate | `api/folders.py:182` guard over every doc AND folder id first; `test_275_delete_paths.py::test_folder_with_a_held_document_two_levels_down_is_refused_whole`, `::test_a_held_empty_subfolder_refuses_the_parent_with_zero_deletes_b1` | ✅ |
| T-275-19 | E | member creates/edits a policy or confirms a delete | mitigate | `require_org_manage` on every write route (`api/retention.py`); `test_275_retention_api.py::test_a_member_is_refused_by_the_server_and_nothing_is_reached`; DB: no JWT write grant (T-275-44). G-4 MEMBER own-token 403 (Task 2) | ✅ automated |
| T-275-20 | E/T | admin of org A disposes org B documents | mitigate | `load.py:18` every statement binds org; live org-B-untouched assertion; `::test_another_orgs_policy_hold_or_document_reads_as_absent` | ✅ |
| T-275-21 | T | Save without a dry run / forged preview | mitigate | `api/retention.py:286,311` PREVIEW_AGAIN 409; `::test_save_without_a_matching_fresh_preview_is_409_and_nothing_is_written`, `::test_the_preview_ttl_is_thirty_minutes_in_sql` | ✅ |
| T-275-22 | T | stale confirm deletes a doc that became held/changed | mitigate | `disposition.py:436` typed_count; `:504` row lock FOR UPDATE; `:521` `retention_held_documents` re-check; live `::test_confirm_deletes_every_version_drops_a_late_hold_and_the_receipt_outlives_the_row` | ✅ |
| T-275-23 | T | ambiguous/incomplete evaluation disposes documents | mitigate | `load.py:52` `IncompleteEvaluation`; live `::test_an_incomplete_org_disposes_nothing`; `test_275_sweep.py::test_an_incomplete_read_writes_no_document_or_queue_change` | ✅ |
| T-275-24 | I | matter names to members via document-states | mitigate | `api/retention.py:786,813` names only when `can_manage`; `test_275_retention_api.py::test_a_member_sees_the_hold_but_never_the_matter_reason_or_placer` | ✅ |
| T-275-25 | I | admin learns private-document names via preview/hold | mitigate | `load.py:21-24` org-visible only; `test_275_evaluate.py::test_a_private_document_is_never_covered`; `test_275_retention_api.py::test_preview_returns_buckets_the_private_count_and_a_draft_hash` (count only) | ✅ |
| T-275-26 | D | sweep runs twice across workers | mitigate | `db/retention.py:103` `FOR UPDATE SKIP LOCKED` + lease; `test_275_sweep.py::test_the_claim_skips_locked_rows_and_advances_next_run_inside_the_transaction` | ✅ |
| T-275-27 | T | sweep or disposition touches workspace_files | mitigate | see F6 (source fence + live SQL read) | ✅ |
| T-275-28 | T | production sweep before anyone read a dry run | mitigate | see F2; `RETENTION_SWEEP_ENABLED` default false in all 4 artifacts (drift PASS). Production stays off — owed operator row (Task 3) | ✅ code · prod owed |
| T-275-29 | R | an action without a receipt | mitigate | receipts written in the action's TX (`disposition.py:289-293`); live disposition receipt assertions; `test_275_hold_guard.py::test_one_delete_refused_receipt_per_held_document` | ✅ |
| T-275-30 | I | matter name rendered to a member | mitigate | `RetentionSection.tsx` member branch never reads `hold_names`; `RetentionFolderLine.tsx:31`; `RetentionSection.test.tsx` / `libraryRetention.test.tsx` member cases (pinned 18 / 12). G-4 MEMBER DOM check (Task 2) | ✅ automated |
| T-275-31 | T | accidental mass delete by an admin | mitigate | `DeleteBatchCard.tsx` untick clears the count; `WaitingForYou.test.tsx` (pinned 13); server re-check T-275-22 | ✅ |
| T-275-32 | T | save without a preview through the UI | mitigate | `RetentionPolicyEditor.tsx:485` `aria-disabled={!canSave}`; `RetentionPolicyEditor.test.tsx` (pinned 16); server wall T-275-21 | ✅ |
| T-275-33 | R | write with no visible receipt | mitigate | every write calls `onRecorded` → band pulse; `RetentionHistory.test.tsx` (16), `RetentionTab.test.tsx` (11), `OrgAdminShell.test.tsx` (11) | ✅ |
| T-275-34 | S | member reaches retention editing | accept | no member UI (Org admin door absent for members); server refuses every write (T-275-19). The G-4 MEMBER own-token 403 drive (Task 2) proves the server half | accepted; drive owed |
| T-275-35 | T | accidental production write while gathering evidence | mitigate | Task 1 made NO Supabase MCP call of any kind; every DB statement in Task 1 targeted `127.0.0.1:54322` (local). Applies again in Tasks 2-3 | ✅ Task 1 |
| T-275-36 | R | a G-4 row claimed without running | mitigate | Task 1 claims no G-4 row; every drive is assigned to Task 2 with OWED as its default | ✅ Task 1 · Task 2 owns |
| T-275-37 | I | test credentials pasted into committed evidence | mitigate | Task 1 evidence names accounts by role only; no password, token or key appears in this file or BASELINES | ✅ Task 1 · Task 2 owns |
| T-275-38 | T | G-4 fixtures left in the dev DB with active holds | mitigate | Task 1 created no fixtures; `test_275_disposition` teardown leaves 0 holds (275-03 measured). Cleanup is Task 2's acceptance row | n/a Task 1 · Task 2 owns |
| T-275-39 | T | model SQL switches the agent-read GUC (incl. `U&` escapes) | mitigate | mig 205 `:226` refusal regex before EXECUTE; live `test_275_retrievable.py::test_text_that_could_switch_the_guc_is_refused_before_it_runs[*]` (7), `::test_ordinary_ampersand_text_is_not_refused` | ✅ |
| T-275-40 | T | admin JWT writes `previewed_revision` / `released_at` directly | mitigate | mig 204 `:499-549` protect-column triggers; live `test_275_policy_rls.py::test_protected_columns_are_refused_by_the_trigger_even_with_a_grant`, `::test_an_insert_cannot_set_protected_columns` | ✅ |
| T-275-41 | T | folder delete removes docs before the DB refuses (held empty subfolder / other owner's held doc) | mitigate | `hold_guard.py:175` folders FIRST; live `test_275_policy_rls.py::test_held_folders_reports_empty_ancestor_and_foreign_content_and_never_a_name`; `test_275_delete_paths.py::test_a_held_empty_subfolder_refuses_the_parent_with_zero_deletes_b1` | ✅ |
| T-275-42 | R | disposition receipt without a policy name | mitigate | see F3 | ✅ |
| T-275-43 | E | protected columns written outside the API's checks | mitigate | service-pool writes after `require_org_manage` (`db/retention.py`, W-2); `test_275_retention_api.py::test_hold_release_runs_on_the_service_pool`, `::test_save_after_a_preview_writes_through_the_service_pool`; DB backstop T-275-40 | ✅ |
| T-275-44 | E | policy rule edited directly through PostgREST | mitigate | mig 204 `:609-612` REVOKE ALL; `test_275_migration_204_shape.py::test_policies_and_hold_updates_have_no_jwt_write_grant`; live `test_275_policy_rls.py::test_member_and_admin_cannot_write_a_policy_through_the_jwt`, `::test_admin_cannot_update_a_hold_through_the_jwt_but_can_create_one` | ✅ |

**Rows: 44** (one per id; the grep's 45th token is the bare prefix, explained above). No `mitigate` disposition
is without an implementing site and a test on the merged tree. Production-side halves (T-275-08 advisors,
T-275-28 sweep flag) are owed operator rows, never performed here.

## §4 — Negative fences (D-33 / D-31 / D-32)

```
$ git diff --stat b41d51d6b -- backend/app/services/retrieval_service.py backend/app/services/scheduler_service.py
(empty)
$ git diff --stat b41d51d6b -- backend/app/api/document_governance.py
(empty)
```

- D-33: `retrieval_service.py` untouched — the archived exclusion rides the 272 seam (`RETRIEVABLE_COLUMN`) and the RPC column.
- D-31: `scheduler_service.py` untouched — the sweep is its own claimant (`db/retention.py`, `sweep_service.py`); `test_275_sweep.py::test_scheduler_service_is_not_imported_by_main_for_retention`.
- D-32: `documents.py`'s delete path gained no `if` — `test_275_delete_paths.py::test_delete_document_gained_no_if_branch_d32` (AST vs PHASE_BASE) green in the merged-tree baseline run.

---

## §5 — G-4 drives (D-26): HOLD · LIFECYCLE · MEMBER

*Appended by 275-05 Task 2 (Chrome-capable agent), driven 2026-10-12 08:00–08:16 UTC (the UI prints local time, UTC+4).*

**Cross-provider scoreboard: NOT APPLICABLE (decision) — decision, not coverage (W-7 / D-30).** The archived and
source-state exclusion is enforced in Postgres (the generated `documents.retrievable` column, read by BOTH branches of
`match_document_chunks` and by `keyword_search_chunks`, mig 205, plus the RESTRICTIVE agent-read policies) and in the
tool dispatcher (`agent_wall`, `retrievable_only=True`) BEFORE any provider sees a result. The hold refusal is enforced by
`hold_guard` in the routes and by BEFORE DELETE / TRUNCATE triggers in the database. No provider adapter, streaming or
prompt code changed in Phase 275. So the 8-row cross-provider board would measure nothing this phase changed. The
LIFECYCLE chat step therefore runs on **ONE provider by decision**: **DeepSeek · `deepseek-v4-flash`** (the composer's
configured default on the admin account; read from the composer pills `deepseek` / `deepseek-v4-flash` and the run
card). This is NOT a claim of cross-provider coverage. The model-independent proof is the W-8 direct RPC read
(LIFECYCLE-6), which involves no model at all.

### 5.0 Environment and identities (measured, not assumed)

| Check | Reading |
|---|---|
| Frontend | `curl http://localhost:5173/` → `200` (Vite, `[::1]`) |
| Backend has the phase's code | unauthenticated `GET http://127.0.0.1:8000/retention/summary` → `403 {"detail":"Not authenticated"}` (not 404); `/health` → `200`. Not started or restarted by this task. |
| Sweep flag on the RUNNING backend | admin `GET /retention/summary` → `"sweep_enabled":false`; admin `POST /retention/sweep/run` → **`409`** `"Scheduled sweeps are off (RETENTION_SWEEP_ENABLED). Preview still works; nothing is archived or queued until they are turned on."` → the sweep was run in-process (LIFECYCLE-4) |
| Admin (org-admin) | the operator dev account, signed in through the app's login form in an isolated Chrome context. Active org **`22f9c615…`** proven three ways: `localStorage['active-org-id']`, the `X-Org-Id` header on every request, and the Org admin band reading `fhdmrd@gmail.com's Organization`. The account belongs to ONE org (SQL on `org_members`). |
| Member | the second dev account (role `member` in `22f9c615`, org-admin of its OWN org `c1f18150`). It opened in its own org (`active-org-id = c1f18150…`). It was switched through Account menu → `fhdmrd@gmail.com's Organization` → `active-org-id = 22f9c615…` before any assertion. No `org_members` row was added; the membership already existed. |
| DB lock | `agentic-rag-localdb.lock` taken at `2026-10-12T07:59:25Z` (noclobber) and released after cleanup. Every SQL statement targeted `127.0.0.1:54322`. No Supabase MCP call of any kind was made (T-275-35). |
| Credentials | named by role only; no password or token appears in this file (T-275-37) |

**Fixtures (local DB only).** The folders were created through the app's own `POST /folders` as the admin, with
`is_org_shared: true`: `/275-G4` (`b42b3cd9…`), `/275-G4/Lifecycle` (`c271c553…`) and `/275-G4/Hold` (`a1931873…`).
Five small `.txt` files were uploaded **through the Library UI** ("Upload to Lifecycle" / "Upload to Hold" drop zone):
`g4-lifecycle-{a,b,c}.txt` (unique text about a fictional "Quillbrook Lantern Accord") and `g4-hold-{1,2}.txt`. All
reached `status=completed`, 1 chunk each, `retrievable=true`. W-3 proof that the Hold folder is org-shared, by SQL
before the drive:

```
SELECT id, name, parent_id, is_org_shared, org_id FROM folders WHERE id IN (…three ids…)
{"name": "275-G4",    "parent_id": null,       "is_org_shared": true, "org_id": "22f9c615-…"}
{"name": "Lifecycle", "parent_id": "b42b3cd9…", "is_org_shared": true, "org_id": "22f9c615-…"}
{"name": "Hold",      "parent_id": "b42b3cd9…", "is_org_shared": true, "org_id": "22f9c615-…"}
```

Before the run, the local DB held 0 policies, 0 active holds, 0 receipts, 0 queue rows, 0 sweep rows and 0 archived documents.

Screenshots (scratchpad only, not committed): `g4-hold-01-library-held-folder.png`, `g4-hold-02-row-delete-refusal.png`,
`g4-hold-03-folder-delete-refusal.png`, `g4-life-01-preview.png`, `g4-life-02-archived-hidden.png`,
`g4-life-03-waiting-for-you.png`, `g4-life-04-confirm-banner.png`, `g4-life-05-history-raw-delete-refused.png`,
`g4-member-01-detail-panel.png`. Every verdict below is read from DOM text, the network log or SQL, never from a
screenshot alone.

### 5.1 HOLD — PASS

| Step | Driven | Words / status seen (verbatim) | DB evidence | Verdict |
|---|---|---|---|---|
| HOLD-1 | Org admin → Retention → Legal holds → `+ New hold`. Typed Matter name `275 G4 matter` and a Reason, then ticked the folder `Hold` (under `275-G4`). | The live count read `2 documents will be held today. Anything added to these folders later is held too.` Clicked `Place hold`. The card read: `Holding` · `275 G4 matter` · `Placed by fhdmrd@gmail.com on 12 Oct 2026 · covers 0 documents + /275-G4/Hold (and anything added to it later) · 2 documents held today`. Posture: `0 policies · 1 legal hold`. | `legal_holds`: one row `275 G4 matter`, `released_at` null; `legal_hold_folders.folder_id = a1931873…` (Hold). Receipt `hold_placed`, `hold_name='275 G4 matter'`, actor = the admin, `detail {"folders":1,"documents":0}`. | PASS |
| HOLD-2 | Library → `275-G4` → `Hold`. | Folder header: `Hold` · `Shared with org` · `2 documents` · `On hold` · **`Everything in this folder is on legal hold — 275 G4 matter.`** Both rows (`g4-hold-2.txt`, `g4-hold-1.txt`) carry the chip **`On hold`**. | — | PASS |
| HOLD-3 | Row `Delete document` on `g4-hold-1.txt`. | The dialog opens straight into the refusal with a single `Close` and no Delete button: `Delete document?` · `Permanently delete g4-hold-1.txt? This action cannot be undone.` · **`Can't delete. This document is on legal hold (“275 G4 matter”). Release the hold in Org admin → Retention first.`** | No network request (the pre-open path, S10); both rows still present. | PASS |
| HOLD-4 | Folder options on `Hold` → `Delete` → inline confirm `Delete Hold? This will permanently delete the folder and all documents inside it.` → `Delete`. | Network: `DELETE /folders/a1931873… → 409`. Inline status: **`Can't delete. This folder has 2 documents on legal hold. Nothing was deleted. Release the hold in Org admin → Retention first.`** with `Close` (exact count 2). | Two `delete_refused` receipts (`g4-hold-1.txt`, `g4-hold-2.txt`, `hold_name='275 G4 matter'`) at `08:04:39Z`. | PASS |
| HOLD-5 (W-3) | From the admin's page: a direct `fetch` `DELETE http://localhost:8000/documents/403955be…` (g4-hold-1.txt) with the admin's own bearer + `X-Org-Id: 22f9c615…`, no UI involved. A direct `DELETE /folders/a1931873…` was also sent. | Document: **HTTP `409`**, `{"detail":{"code":"legal_hold","title":"Can't delete.","message":"This document is on legal hold (“275 G4 matter”). Release the hold in Org admin → Retention first.","held_count":1}}`. Folder: **HTTP `409`**, `message`: `"This folder has 2 documents on legal hold. Nothing was deleted. Release the hold in Org admin → Retention first."`, `held_count: 2`. | After every refusal: `SELECT … FROM documents WHERE folder_id='a1931873…'` → **2 rows** (both ids); the folder row is present; `storage.objects` for both files → **2**. Receipts: `delete_refused` ×5 in total (2 from the UI folder delete, 1 from the direct document delete, 2 from the direct folder delete), each naming the document and `275 G4 matter`. | PASS |

### 5.2 LIFECYCLE — PASS on every D-26 clause (two copy defects recorded as FAIL rows, §5.4)

| Step | Driven | Words / status seen (verbatim) | DB evidence | Verdict |
|---|---|---|---|---|
| LIFECYCLE-0 | Back-dated the three Lifecycle documents' `created_at` by 3 days (SQL, local) so the date-added clock is past both stages. | — | `UPDATE documents SET created_at = created_at - interval '3 days' WHERE folder_id='c271c553…'` → 3 rows, `created_at = 2026-10-09 08:01:49Z` | fixture |
| LIFECYCLE-1 (W-8 before) | Ran `match_document_chunks` AND `keyword_search_chunks` **as the admin user** on the local DB. Pattern: `SET LOCAL ROLE authenticated` plus both JWT-claim GUCs (the `_apply_rls_user_context` shape; `auth.uid()` read back = the admin). Query embedded in-process with the app's `embed_chunks`: *"What tariff does the Quillbrook Lantern Accord set for the Vexmoor ferry?"*; keyword `Quillbrook Lantern Accord`. Both functions are executable by `authenticated` (275-01 crash rule respected). | — | **BEFORE**: vector unscoped top-50 (threshold 0.0) → all 3 Lifecycle docs (`0eb6fec1` 0.7831, `4c7afe7e` 0.6893, `6835f650` 0.5364); vector scoped to the 3 ids → 3 rows on the index branch AND 3 on the exact branch (`p_exact_max_chunks=1000`); keyword unscoped → 3 rows (all 3 docs, rank 0.21–0.22); keyword scoped → 3 rows. | baseline captured |
| LIFECYCLE-2 | Org admin → Retention → `+ New policy`: Name `275 G4 lifecycle`; Folder `/275-G4/Lifecycle` (+ subfolders), which disabled Document type with `A policy covers one folder or one document type. Make a second policy for the other.`; Keep for `1` `days`; Counted from `the day it was added to the Library`; Then `archive it`; ticked `Then queue it for deletion` after `2` `days`. | Before Preview, `2 · Save policy` was `aria-disabled="true"` with **`Preview first. A policy can't be saved until you've seen what it would do.`** | — | PASS |
| LIFECYCLE-3 | `1 · Preview what this would do`, then `2 · Save policy`. | Preview: `PREVIEW · WHAT TONIGHT'S SWEEP WOULD DO` · **`3` `would be archived`** · `g4-lifecycle-a.txt · due 11 Oct 2026` · `g4-lifecycle-b.txt · due 11 Oct 2026` · `g4-lifecycle-c.txt · due 11 Oct 2026` · `0 skipped — on legal hold` · `0 can't be decided — nothing will happen to them` · `0 kept by an admin …` · `0 not due yet`. Save became `aria-disabled="false"`. After Save, the Policies row read `275 G4 lifecycle` · `All documents in /275-G4/Lifecycle (and subfolders)` · `1 day after added to the Library, delete after 2 days` · `Archive` `Delete · needs approval` · **`3 due now`** · `nothing else due`. | `retention_policies`: `scope_kind=folder`, `clock=date_added`, `1 days archive`, `2 days delete`, **`revision=1, previewed_revision=1`**. Receipts `dry_run` and `policy_saved`. | PASS |
| LIFECYCLE-4 | Sweep. `POST /retention/sweep/run` was refused with 409 (flag off, §5.0), so a one-shot venv script ran **the same code path as that route**: `rdb.claim_org_sweep_now(pool, org)` → `disposition.run_org_sweep(pool, org, now=utcnow)` → `rdb.release_retention_sweep(…)`. It used the app's own `deps.get_pg_pool()` (DSN `127.0.0.1:54322`, checked before running). | Script: `status: ok counts: {'families': 190, 'archived': 3, 'queued_delete': 3, 'queued_review': 0, 'held': 2, 'undecidable': 0, 'private': 165} error: None` (`held: 2` = the two HOLD documents) | `archived_at` set on all 3 (`08:07:56Z`), `archived_policy_name='275 G4 lifecycle'`, **`retrievable=false`** ×3. `retention_queue`: **3 rows**, `kind=delete`, `policy_revision=1`. Receipts: `archived` ×3 and `queued_delete` ×3, each with `policy_name='275 G4 lifecycle'`, `actor_name='Nightly sweep'`. `retention_sweeps.last_status='ok'`. The only archived documents in the DB were these 3. | PASS |
| LIFECYCLE-5 (chat, W-7) | NEW chat (`New chat`, scope `All your documents`, **DeepSeek · deepseek-v4-flash**). Typed: *"Search my documents: what tariff does the Quillbrook Lantern Accord set for the Vexmoor ferry, and who signed it?"* | Run card `Run · 2 steps · deepseek-v4-flash · ✓ done`. The answer: `I searched your library and couldn't find anything matching this …` `A content search for "Quillbrook Lantern Accord," "Vexmoor," and "Lantern Accord" returned zero matches across every document in your library.` `● Low confidence`. | Thread `05b3ab1b…`, assistant message `122f8a34…`. `tool_calls`: `search_documents {"query": "Quillbrook Lantern Accord tariff Vexmoor ferry"}`, whose result held only `274-g4-keeper.pdf` passages, and `grep {"pattern":"Quillbrook\|Vexmoor\|Lantern Accord"}` → `"matches": [], "total": 0`. SQL over the stored message: `tool_calls` contains `g4-lifecycle` = **false**, `Penhallow` = false, `4,180` = false; `source_refs` (5 refs, the full citation set) contains `g4-lifecycle` = **false**, `274-g4-keeper` = true. ⚠ The persisted tool result is truncated at 2000 chars (`agent_loop.py:3204-3206`), so `source_refs` and LIFECYCLE-6 are the complete proof; the truncated row is supporting evidence only. | PASS |
| LIFECYCLE-6 (W-8 after) | Re-ran the identical as-admin RPC script, with no model involved. | — | **AFTER**: vector unscoped top-50 → 50 rows, **0** Lifecycle; vector scoped index → **0 rows**; vector scoped exact → **0 rows**; keyword unscoped → **0 rows**; keyword scoped → **0 rows**. Every arm that returned the 3 documents before the sweep returns none of their chunks after it. | PASS |
| LIFECYCLE-7 | Library → `275-G4` → `Lifecycle`. | `Lifecycle` · `Shared with org` · `3 documents` · `Archive` · `This folder: kept 1 day after added to the Library, delete after 2 days, then archived.` (⚠ see FAIL-2) · `No documents in this folder` · **`3 archived documents hidden · Show`**. After `Show`: three rows each chipped **`Archived`**, the line `Showing 3 archived documents · Hide`, and the shared Find chip flipped to `Archived: included`. | — | PASS |
| LIFECYCLE-8 | Find: File name `g4-lifecycle`, which resolved to `Folder /275-G4/Lifecycle + subfolders`, with `Archived: included` on. Then `Stop including archived documents`. | With archived included: **`3 documents`**, rows `g4-lifecycle-c.txt` / `-b` / `-a`, each `Archived` · `/275-G4/Lifecycle` · `memo` · `You` · `9 Oct 2026`. With archived excluded: **`0 documents`** · `No documents match`. | — | PASS |
| LIFECYCLE-9 | `Download — g4-lifecycle-a.txt` on the archived row. | Network: `POST /documents/0eb6fec1…/download-url` → **`200`**, then `GET http://127.0.0.1:54321/storage/v1/object/sign/documents/…/g4-lifecycle-a.txt?token=…` → **`200`**. | — | PASS |
| LIFECYCLE-10 | Org admin → Retention → `Waiting for you`. | Tab accessible name `Waiting for you, 3 waiting`. Card: `Delete · needs approval` · `275 G4 lifecycle` · `All documents in /275-G4/Lifecycle (and subfolders) · kept 1 day after added to the Library, delete after 2 days · found by the sweep on 12 Oct 2026, 12:07`. Rows a/b/c show `/275-G4/Lifecycle` · `not recorded` · `11 Oct 2026`, all three ticked. `Every document is checked again at the moment you confirm. …` · `This can't be undone. Type 3 to confirm.` · `Delete 3 documents permanently` (disabled). | 3 queue rows (LIFECYCLE-4) | PASS |
| LIFECYCLE-11 | With that card still open, a SECOND admin tab (same session) used Legal holds → `+ New hold` `275 G4 late hold`, document typeahead `g4-lifecycle-c` → picked `g4-lifecycle-c.txt` → `1 document will be held today. …` → `Place hold`. | Card: `275 G4 late hold` · `Placed by fhdmrd@gmail.com on 12 Oct 2026 · covers 1 document · 1 document held today`. | `hold_placed` receipt `275 G4 late hold`, `detail {"folders":0,"documents":1}`, `08:12:17Z` | PASS |
| LIFECYCLE-12 | Back in the first tab's stale card: typed `3` into `Type 3 to confirm` → `Delete 3 documents permanently`. | `role=status` banner: **`Done` `Deleted 2 documents. Kept 1: g4-lifecycle-c.txt went on legal hold after the sweep, so it was dropped at confirm. One audit record per document names the document, the policy, the action, who approved it and when.`** | `documents`: a and b **gone** (rows AND chunks); c **remains** (archived, 1 chunk). `storage.objects` for the three: **1** (c only), so a's and b's bytes were removed. Receipts: `deleted` `g4-lifecycle-a.txt` and `deleted` `g4-lifecycle-b.txt` (`policy_name='275 G4 lifecycle'`, `actor_id` = the admin, `actor_name` = the admin, `detail.approved_at 08:12:33Z`). **`did_not_delete` `g4-lifecycle-c.txt`** (`policy_name='275 G4 lifecycle'`, actor = the admin, `detail {"reason":"held","held_since":"2026-10-12T08:12:17.873590+00:00"}`), with the hold time. `retention_queue` → 0. | PASS |
| LIFECYCLE-13 | Retention → `History`. | Newest first: `Did not delete g4-lifecycle-c.txt: put on legal hold after the sweep (on hold since 12 Oct 2026, 12:12)` · `Deleted g4-lifecycle-b.txt under “275 G4 lifecycle”, approved by fhdmrd@gmail.com` · `Deleted g4-lifecycle-a.txt under …` · `Placed legal hold 275 G4 late hold on 1 document and 0 folders` · `Archived …` ×3 / `Queued … for deletion under “275 G4 lifecycle”` ×3 (`· Nightly sweep`) · `Saved policy 275 G4 lifecycle` · `Ran a dry run of 275 G4 lifecycle: 3 would be archived, 0 held, 0 undecidable` · **`delete_refused`** ×5 (⚠ FAIL-1) · `Placed legal hold 275 G4 matter on 0 documents and 1 folder`. | matches `retention_receipts` 1:1 | PASS (rows present) · FAIL-1 on wording |

### 5.3 MEMBER — PASS

| Step | Driven | Words / status seen (verbatim) | DB evidence | Verdict |
|---|---|---|---|---|
| MEMBER-1 | Signed in as the member in a separate isolated context, then switched org (§5.0). | Nav buttons: `New chat, Chat, Workflows, Library, Connections, Skills, Experts, Account menu, …`. **No `Organization admin` door** (`[…].some(/Organization admin/) === false`). The admin's nav, by contrast, carries `Organization admin`. | `org_members`: member role in `22f9c615` | PASS |
| MEMBER-2 | From the member's page: direct `fetch` calls with the member's OWN bearer + `X-Org-Id: 22f9c615…`. The body was a valid draft on `/275-G4/Lifecycle`. | `POST /retention/policies` → **`403`** `{"detail":"You do not have permission to manage this organization."}` · `PUT /retention/policies/63d9e4d5…` (the live admin policy) → **`403`**, same body · `POST /retention/policies/preview` → `403` · `GET /retention/summary` → `403` · `POST /retention/sweep/run` → `403`. **Positive control**: the same token with `X-Org-Id: c1f18150…` (the member's own org, where it is org-admin) → `GET /retention/summary` **`200`**, so the 403 is the role gate and not a broken header. | `retention_policies` still held exactly the admin's one policy (`revision=1`, name unchanged); no new receipt for the member | PASS |
| MEMBER-3 | `POST /retention/document-states` as the member for `g4-hold-1.txt` + the Hold folder. | `200` `{"documents":[{"document_id":"403955be…","chip":"on_hold","held":true,"hold_line":"On legal hold. Ask an org admin.","archived":false,"can_unarchive":false,"section":{"kind":"hold"}}],"folders":[{"folder_id":"a1931873…","held":true}],"can_manage":false}`. **No `hold_names` key** at all. | — | PASS |
| MEMBER-4 | Library → `275-G4` → `Hold`. | `Hold` · `Shared with org` · `On hold` · **`Everything in this folder is on legal hold.`** (no matter); both rows `On hold`. | — | PASS |
| MEMBER-5 | Opened `g4-hold-1.txt`'s detail panel. | Section `RETENTION`: **`On legal hold. Ask an org admin.`** · `It can't be deleted until the hold is released.` Checks: `document.body.innerText.includes("275 G4 matter") === false`, `includes("275 G4 late hold") === false`, and the whole `document.documentElement.outerHTML.includes("275 G4 matter") === false`. | — | PASS |
| MEMBER-6 | Row `Delete document` on the held row, as the member. | Pre-open refusal with one `Close`: **`Can't delete. This document is on legal hold. Ask an org admin if you think it should be released.`** No matter name anywhere in the DOM. | row still present | PASS |
| MEMBER-7 (extra) | Direct `fetch` `DELETE /documents/403955be…` with the member's token. | Browser: `net::ERR_FAILED`. `curl`, same token → **`HTTP 500 Internal Server Error`**. | row still present; no receipt | ⚠ pre-existing, NOT a hold leak; see OBS-1 |

### 5.4 Defects and observations found by the drive (no product code changed, per instruction)

| Id | What | Evidence / reproduction | Severity · routing |
|---|---|---|---|
| FAIL-1 | **History renders a `delete_refused` receipt as the raw action key `delete_refused`.** UI-SPEC S5 (`275-UI-SPEC.md:363`) requires `Refused to delete **{doc}**: on legal hold`. `RetentionHistory.tsx:94-95` falls to `default: return r.action`. There is no `delete_refused` case and no such template in `retentionCopy.ts` (the fence cannot see an absent string). | Place a hold on a folder, try to delete a document in it, then open Org admin → Retention → History. The row reads `✎ delete_refused`. Screenshot `g4-life-05-history-raw-delete-refused.png`. The receipts themselves are correct (`document_name`, `hold_name`, actor). | Copy defect, user-visible. **FIXED in `13e962d8b`** (test-first, RED `f62e19200`) — see §6.1. ⚠ Needs its own re-look at the operator's next UAT |
| FAIL-2 | **The folder line reads backwards for a two-stage policy**: `This folder: kept 1 day after added to the Library, delete after 2 days, then archived.` `RetentionFolderLine.tsx:44` fills `folderPolicy` (`kept {kept_for}, then {then}`) with `kept_for_text`. For a stage-2 policy that text already ends `, delete after 2 days` (`evaluate.py:224-230`), so the sentence claims archive happens after the delete. | Any archive + "Then queue it for deletion" policy on a folder → Library → that folder. Screenshot `g4-life-02-archived-hidden.png`. | Misleading copy (the Policies table and Waiting card are correct). **FIXED in `88aec8e6f`** (RED `f62e19200`) — see §6.1. ⚠ Needs a re-look at the next UAT |
| OBS-1 | **`DELETE /documents/{id}` answers 500 instead of 404 when the caller owns no such row.** The member deleting the admin's document fails, and so does the ADMIN deleting a non-existent id (both `curl` 500 / browser `ERR_FAILED`). Cause, by reading: `documents.py:1825-1833` calls `.maybe_single().execute()` and then reads `doc_resp.data`, which fails when postgrest returns `None` for zero rows. | `curl -X DELETE -H "Authorization: Bearer <any user>" -H "X-Org-Id: <org>" :8000/documents/00000000-0000-0000-0000-000000000001` → `500` | **Pre-existing**: the lines date from `7eb983acb` / `b1d676bb7` (2026-04), and the D-32 fence pins that 275 added no `if` there. Not a hold bypass (nothing is deleted). Out of 275's scope → **filed as BUG-261012-02** (§6.3), NOT fixed (`documents.py` is FIRING; D-32 guard-calls-only) |
| OBS-2 | A folder whose every document is archived shows the empty state `No documents in this folder · Upload files above to add them here.` directly above `3 archived documents hidden · Show`. | LIFECYCLE-7 | Cosmetic contradiction. **FIXED in `86e29ccc0`** (RED `f62e19200`) — see §6.1. ⚠ Needs a re-look at the next UAT |
| OBS-3 | The posture count reads `1 policies` (template `{P} policies`, no `(s)`). | LIFECYCLE-3 | Cosmetic. **FIXED in `443b29e8b`** (RED `f62e19200`) — see §6.1. ⚠ Needs a re-look at the next UAT |
| OBS-4 | A `did_not_delete` receipt carries `hold_name = NULL`. Only `detail.held_since` names the hold time, so History cannot say which matter blocked the delete. | LIFECYCLE-12 SQL | **NULL is correct by decision** — see §6.1 (no code change) |

### 5.5 Cleanup (T-275-38) — done, recorded

| Step | Result |
|---|---|
| Released both holds through the UI (Legal holds → `Release hold…`) | Dialog: `Release “275 G4 late hold”?` · `1 document will no longer be protected. …` · focus on `Keep hold`. Then `Release “275 G4 matter”?` · `2 documents will no longer be protected. …` · `/275-G4/Hold`. After: `0 active` · `2 released holds`; `hold_released` ×2 receipts |
| Removed the policy through the UI (Policies → row → `Remove policy…` → `Remove policy`) | Dialog: `Remove “275 G4 lifecycle”?` · `No documents are deleted. …`. After: `0 policies · 0 legal holds`; `policy_deleted` receipt |
| Deletes that were refused now succeed (admin, direct) | `DELETE /documents/403955be…` (g4-hold-1.txt) → **`204`**; `DELETE /folders/a1931873…` (Hold) → **`204`**; `DELETE /folders/b42b3cd9…` (`/275-G4`, taking `Lifecycle` and the archived `g4-lifecycle-c.txt`) → **`204`** |
| Final SQL | test folders **0**, `g4-*` documents **0**, their chunks **0**, their storage objects **0**, active holds **0**, policies **0**, queue **0**, archived documents **0** |
| Kept deliberately | `retention_receipts` (21 rows: archived 3, delete_refused 5, deleted 2, did_not_delete 1, dry_run 1, hold_placed 2, hold_released 2, policy_deleted 1, policy_saved 1, queued_delete 3). Receipts are immutable by design (T-275-07) and are this drive's audit trail. Also kept: the 2 released `legal_holds` rows, the org's `retention_sweeps` row (`last_status ok`, from LIFECYCLE-4), the preview rows, and the chat thread `05b3ab1b…` (evidence for LIFECYCLE-5). |

## §6 — Known limits, registers, owed operator rows

*Appended by 275-05 Task 3.*

### 6.1 G-4 findings — the G-3 fast-fixes (2026-10-12, after the drive)

Each was ≤ 1 source file / ~10 lines with no schema or API surface (G-3), so it was fixed inline,
**test-first**: one RED commit `f62e19200` added a failing case per fix (4 failed, the rest green), then one
fix commit each. Copy is ported verbatim from `275-UI-SPEC.md` and fenced by `retentionCopy.test.ts`.

| Finding | Fix | Commit | Pin |
|---|---|---|---|
| FAIL-1 `delete_refused` rendered as the raw key | `receiptSentence` gains the S5 row `Refused to delete **{doc}**: on legal hold` (`specTemplates.historyDeleteRefused`, segments fenced vs the UI-SPEC, spec-template count 35→36) | `13e962d8b` | `RetentionHistory.test.tsx` 16→17 |
| FAIL-2 folder line read the delete BEFORE the archive | `RetentionFolderLine` fills the S7 template's two slots from the server's ordered `rule_text` (`Kept {period}, then {then}[; queued for deletion …].`) instead of `kept_for_text` (which already ends `, delete after N`). The line now reads *"This folder: **kept 1 day after added to the Library**, then archived; queued for deletion 2 days after added to the Library."* Any other shape keeps the old fill. A `?raw` fence on `evaluate.py` pins `rule_text`'s two f-strings. Fixed on the CLIENT: `rule_text` is already the one ordered sentence (S8's home), so no API field was added | `88aec8e6f` | `libraryRetention.test.tsx` 12→15 (with OBS-2) |
| OBS-3 `1 policies` | `postureCounts` takes the noun as `{policies}`; ported `wordPolicy` / `wordPolicies` (both verbatim in the sketch; ported count 71→73) | `443b29e8b` | `RetentionTab.test.tsx` 11→12 |
| OBS-2 `No documents in this folder` above `3 archived documents hidden · Show` | `LibraryPage` does not mount `DocumentList` (whose empty state makes the claim) when every browse row is hidden as archived; the S9 hidden line carries the truth. One condition around the existing mount | `86e29ccc0` | in `libraryRetention.test.tsx` |
| OBS-4 `did_not_delete` carries `hold_name = NULL` | **No change — NULL is correct, by decision.** (1) The spec's sentence names the TIME, not the matter: UI-SPEC S5 `Did not delete **{doc}**: put on legal hold after the sweep (on hold since {time})`; CONTEXT specifics "did not delete — on legal hold since <time>". (2) The receipt's subject is the DISPOSITION, so mig 204's CHECK requires `policy_name`, not a hold. (3) A document can be held by several matters at once; one `hold_name` column would pick one arbitrarily. (4) The matter is already on record: the hold's own `hold_placed` / `hold_extended` receipt names it, and `detail.held_since` dates the drop against it. (5) Populating it would add a name lookup inside the confirm transaction (`retention_held_documents` returns no names) for no reader the spec defines. Re-open if an auditor asks History to name the blocking matter | — | — |

Gates after the fixes: the 9 retention suites `133 passed`; the 11 other suites that mount `LibraryPage`
`192 passed | 1 skipped`; the count gate re-run is in §6.5. Count-gate BASELINE re-pinned for the three grown
suites (non-decreasing). No backend file changed.

⚠ **Fixes found by UAT need their own UAT.** All four are verified by rendered-word tests only. The
operator's next UAT should re-look at: History after a refused delete; a two-stage folder's line; the
posture line with one policy; a fully archived folder.

### 6.2 Known limits (written here AND in `docs/public/administer/org/retention.md`)

| Limit | Why | Routed |
|---|---|---|
| **Private documents cannot be held or covered by a policy this phase** (D-34 / D-35) | A policy reaches only org-visible documents; a hold covers only what an org admin can pick. Preview counts the private documents a policy does not reach and never names them (T-275-25) | **SEED-354** (org-wide matter by custodian), planted 2026-10-12 |
| Re-uploading an archived file returns the archived row as a duplicate (Pitfall 10) | `documents_dedup_idx` is org-scoped; `ingest_splice.py:224-239` | documented; un-archive instead |
| A watched source can bring a disposed file back (Pitfall 11) | disposition NULLs `connector_watch_items.document_id`; a later source change can re-mint | SEED-210 |
| Mass archival can under-fill a vector search (Pitfall 8) | HNSW filters after the index walk (the `is_latest=false` mechanism already did this) | remedy: the existing `hnsw_iterative_scan` setting |
| `message_artifacts` copies (mig 202) are not reached by a disposition | a chat artifact copied from a document is its own row; retention covers Library documents only (and the sweep never touches `workspace_files`, F6) | **SEED-072**'s data-protection review |
| Watch purge leaves file bytes in storage | pre-existing (Phase 234); 275-02 added the guard only | **BUG-261012-01** |

### 6.3 Registers

| Register | Change | Evidence |
|---|---|---|
| SEED-250 | `folded` → **`answered`** by Phase 275 (plan list in `status_note`; not deployed) | this file §1-§5 |
| SEED-345 | stays **`partially-answered`**; `status_note` now says the documents half SHIPPED in 275; chat/message retention and per-org rate limits remain; trigger unchanged | — |
| BUG-261004-01 | `folded` → **`closed`**, `verified_closed_by: "275"` | Automated: `test_275_retrievable.py` (each source state × every arm, live, green in Task 1). **Live local read 2026-10-12**, run as the owner: both pre-existing `missing_at_source` documents (`43f0900b…` 132 chunks, `c8b51229…` 1 chunk) return **0** chunks on vector unscoped top-50, vector scoped index, vector scoped exact, keyword unscoped and keyword scoped. A rolled-back control (`source_state` NULL) returns them (31/50 · 50 · 50 · 3/3 · 3, and 1/50 · 1 · 1 · 1 · 1). Table in the bug file |
| SEED-354 | **planted**: org-wide legal hold by custodian, reaching private documents. `trigger_when` = SEED-345's remainder gets a phase, OR a customer asks to hold a named person's documents, OR a phase changes admin visibility | D-35 |
| BUG-261012-01 | **filed** (open, minor): both watch purge paths (`sources.py:328-344`, `:474-489`) delete rows, never storage bytes. 275-02 did NOT fix it (its SUMMARY `:194`) | code reading |
| BUG-261012-02 | **filed** (open, minor): `DELETE /documents/{id}` → 500 instead of 404 for a row the caller does not own (OBS-1). Not fixed here: `documents.py` is FIRING and D-32 allowed guard calls only | G-4 MEMBER-7 |

`node scripts/check-seeds-register.cjs` → `seeds register gate OK — 361/361 parsed, 0 duplicate ids, 361/361
carry all 5 required keys.` Next free ids re-derived before writing: SEED max was 353 → 354; no
`BUG-261012-*` existed → `-01`, `-02`.

### 6.4 Owed operator rows (recorded, NOT performed — production is operator-gated)

| # | Owed step | Notes |
|---|---|---|
| 1 | **Production DB: apply `204_retention_and_legal_hold.sql`, then `205_retrievable_predicate.sql`**, one operator-approved SQL-editor write at a time, each followed by its VERIFY rows reading PASS, **BEFORE the backend deploy** (D-29) | 205 reads 204's columns; the new backend reads `retrievable`, which only 205 creates |
| 2 | `get_advisors(security)` on production after both migrations, compared with the last recorded baseline (0 ERROR) | T-275-08's production half (REVOKE … FROM PUBLIC before every GRANT) |
| 3 | A production read of `SELECT source_state, count(*) FROM documents GROUP BY 1` (a free read): every non-NULL row leaves retrieval the moment 205 lands; list them in the deploy note | BUG-261004-01's production exposure; the 2026-10-04 read was all NULL |
| 4 | Deploy the **backend before (or with) the frontend** (Pitfall 13) | Find's `include_archived` 422s on an old backend (`extra="forbid"`) |
| 5 | **`RETENTION_SWEEP_ENABLED` stays `false` in Coolify** until an org admin has read a dry run (Preview) on production | D-29 / D-37 / T-275-28; the code default is false in all 4 deploy artifacts (drift PASS) |
| 6 | G-4 rows marked OWED in §5 | **None**: HOLD, LIFECYCLE and MEMBER all ran (§5.1-§5.3). Owed instead: the operator's re-look at the four §6.1 fixes at the next UAT |

`check-deploy-drift.sh` WARN (read, non-blocking): *"migration(s) above #198 carry seed-like INSERT/UPDATE —
204_retention_and_legal_hold.sql"*. Measured: the two `INSERT INTO` statements (`:397`, `:428`) sit inside
the sticky-coverage trigger functions, not seeds, so `docs/OPERATOR.md`'s Step-3 seed list needs nothing for 204.

### 6.5 Count gate after the fast-fixes (re-run once, main working tree, `GSD_VITEST_MAX_WORKERS=2`, from the repo root)

```
  total 10136  ·  failed 0  ·  pinned total 9349
count gate OK — 434/434 pinned files present, no per-file decrease, 0 failing.
```

`+5` total and `+5` pinned against Task 1's `10131 / 9344`: exactly the five new cases
(`RetentionHistory.test.tsx` 16→17, `RetentionTab.test.tsx` 11→12, `libraryRetention.test.tsx` 12→15), all
re-pinned. Green on the first run; the cap was neither adjusted nor needed.

## §7 Review-fix re-look (2026-10-12)

*Chrome agent, driven 2026-10-12 10:31–10:42 UTC (the UI prints local time, UTC+4), on `develop` at `6aa0c79e0`.*

**Environment.**
- Local DB with migrations 204, 205 and 206 applied.
- The backend (`:8000`, `--reload`) and vite were already running. Neither was started, stopped or restarted.
- The admin signed in through the app's login form.
- Active org `22f9c615…`, proven three ways: `localStorage['active-org-id']`, the `X-Org-Id` header, and the Org admin band `fhdmrd@gmail.com's Organization`.
- DB lock `agentic-rag-localdb.lock` taken 10:31:22Z, released 10:42:31Z.
- Every SQL statement targeted `127.0.0.1:54322` through a local asyncpg script. No Supabase MCP call of any kind was made.
- The tab was hidden, so every verdict below is read from DOM text, a network status or SQL, never from a screenshot.

**Fixtures.**
- Folders, created with the app's own `POST /folders`, all `is_org_shared=true`:
  - `/275-RL` (`9429e52e…`)
  - `/275-RL/Sub` (`9c391b7d…`)
  - `/275-RL-Life` (`464ecd0b…`)
  - `/275-RL-Life/Moved` (`f30be658…`)
- Five `.txt` files, uploaded with `POST /documents/upload`. All reached `completed`, with 1 chunk each:
  - `rl-parent.txt` in `/275-RL`
  - `rl-sub.txt` in `/275-RL/Sub`
  - `rl-life-{a,b,c}.txt` in `/275-RL-Life`
- The sweep ran **in-process**, because the running backend has `sweep_enabled:false`. It made the same calls as `POST /retention/sweep/run` (`api/retention.py:721-731`), on the app's own `get_pg_pool()`:
  1. `rdb.claim_org_sweep_now`
  2. `disposition.run_org_sweep`
  3. `rdb.release_retention_sweep`

| Row | Verdict | Evidence |
|---|---|---|
| **R1** held subtree | **PASS** | **Hold, placed through the UI:** Org admin → Retention → Legal holds → `+ New hold`. Matter `275 RL subfolder hold`; document typeahead `rl-sub` → `rl-sub.txt`; `Place hold`. Dialog: `1 document will be held today. …`. Card: `Holding` · `275 RL subfolder hold` · `Placed by fhdmrd@gmail.com on 12 Oct 2026 · covers 1 document · 1 document held today`. The hold covers **only a document in the SUBFOLDER**; the unheld `rl-parent.txt` sits directly in `/275-RL`. **Drive (twice):** Library → `275-RL` → Folder options → `Delete` → inline `Delete 275-RL? This will permanently delete the folder and all documents inside it.` → `Delete`. **Network:** `DELETE /folders/9429e52e… → 409`. **`role="alert"` notice, verbatim:** `Can't delete. This folder has 1 document on legal hold. Nothing was deleted. Release the hold in Org admin → Retention first.` + `Close`. **DB, before → after**, over `/275-RL` + `/275-RL/Sub`: folders **2 → 2**, documents **2 → 2**, chunks **2 → 2**, `storage.objects` **2 → 2**. The unheld parent-folder document survived too, so the delete was all-or-nothing. **Receipts:** `delete_refused` ×2 (`rl-sub.txt`, `hold_name='275 RL subfolder hold'`, 10:35:44Z and 10:36:15Z). **Not driven:** the empty-held-subfolder variant. It stays covered live by `test_275_delete_paths.py::test_a_held_empty_subfolder_refuses_the_parent_with_zero_deletes_b1`. |
| **R2** confirm result banner | **PASS** | **Setup:** one batch of 3 (`rl-life-a/b/c.txt`), all queued by the sweep. From a second tab:<br>• `275 RL late hold` placed on **a** and **c** through the UI. Dialog `2 documents will be held today.`; card `covers 2 documents · 2 documents held today`.<br>• **b** moved to `/275-RL-Life/Moved` with `PATCH /documents/{b}/move` → 200. This changes b's family key and fingerprint after the sweep.<br>**Drive:** back in the first tab, typed `3` → `Delete 3 documents permanently`.<br>**Network:** `POST /retention/queue/3ee99fb5…/confirm` → **200**. Response: `"deleted":[]`; `did_not_delete` = a `held`, b `changed`, c `held`; `kept`, `archived`, `not_found`, `skipped`, `failed` and `bytes_not_removed` all `[]`.<br>**`role="status"` banner, verbatim:** `Nothing done` `Kept 2: rl-life-a.txt, rl-life-c.txt went on legal hold after the sweep, so it was dropped at confirm. Not done, changed since the sweep: rl-life-b.txt. One audit record per document names the document, the policy, the action, who approved it and when.`<br>**Banner style:** the chip reads `Nothing done` in amber classes; the banner fill is amber (`border-warning/30 bg-warning/10`), not green.<br>**DOM checks:** `/Deleted 0/` → **false**; a span reading exactly `Done` → **false**; a success-filled status → **false**.<br>**DB:** all 3 documents still present and archived; `storage.objects` 3; `retention_queue` 0.<br>**Receipts:** `did_not_delete` ×3, each with `policy_name='275 RL lifecycle'` and the admin as actor. a and c carry `{"reason":"held","held_since":"…10:40:43Z"}`; b carries `{"reason":"changed"}`.<br>⚠ The `failed` and `bytes_not_removed` clauses had no natural trigger here; they stay covered by `WaitingForYou.test.tsx` only. ⚠ See OBS-R2a and OBS-R2b below. |
| **R3** Reload never records "kept" | **PASS** | **Starting state:** the card showed 2 rows (a, b), both checkboxes `checked=true`, and `Type 2 to confirm`.<br>**New row:** c was uploaded, back-dated and queued by a second sweep. The server now held 3 rows while the card still showed 2.<br>**Reaching Reload:** Reload is offered only after a failed confirm (`BatchFailure`) or a failed load. So the first confirm was **cancelled in the browser and never sent**: a fetch wrapper threw a network `TypeError` for that one request.<br>• Captured unsent body: `{"delete_ids":[a,b],"keep_ids":[],"archive_ids":[],"typed_count":2}`.<br>• `role="alert"`: `Couldn't confirm the batch. Some documents may already be deleted. History shows exactly which. Reload this list before trying again.` + **`Reload`**. This is the correct copy for a network failure with no server sentence (F-WR-01).<br>**After `Reload`:** `GET /retention/queue → 200`. The card re-mounted with **3 rows, all ticked** (`rl-life-a.txt:true`, `rl-life-b.txt:true`, `rl-life-c.txt:true`). **0** rows with `line-through`. No unticked note. `Type 3 to confirm`, with the input emptied.<br>**The real confirm that followed (R2), request body:** **`{"delete_ids":["e99b8e76…","fdc13abf…","2fa31c04…"],"keep_ids":[],"archive_ids":[],"typed_count":3}`**. `keep_ids` is empty, and the row that arrived on Reload (c, `2fa31c04…`) is in `delete_ids`.<br>**No `kept` receipt was written.** Receipt actions since 10:30Z: archived 3, delete_refused 2, did_not_delete 3, dry_run 1, hold_placed 2, hold_released 2, policy_deleted 1, policy_saved 1, queued_delete 3. |
| **R4** posture while a sweep runs | **PASS-with-planted-state** | **DB state — real, not an UPDATE:** `rdb.claim_org_sweep_now` (the run-now claim) was called and the run was held back. `retention_sweeps`: `last_status='running'`, `last_run_at=10:37:22Z` (the previous run), `leased_until=10:53:34Z`. `GET /retention/summary` → `"last_status":"running"` with **`"sweep_enabled":false`** (the operator's backend runs with the flag off).<br>**Unmodified, the tab shows the flag-off branch:** `Scheduled sweeps are off. Nothing is archived or queued until they are turned on. Preview still works.` · `1 policy · 1 legal hold`.<br>**Planted, in the browser only:** a fetch wrapper in that tab rewrote **only** `sweep_enabled` to `true` in the summary response; every other field is the server's own. The Retention tab was then re-mounted.<br>**Posture, verbatim:** **`The latest sweep has not finished, so there is no result for it yet.`** · `Next sweep 13 Oct 2026, 06:00` · `1 policy · 1 legal hold`. The lead span carries `text-[hsl(32_90%_30%)] dark:text-warning` (amber) and the `ShieldAlert` svg. `finished` / `nothing failed` are absent.<br>**Control:** after `run_org_sweep` + `release_retention_sweep` (`status ok`, `last_run_at=10:39:23Z`, lease NULL), the same wrapped tab re-mounted to `Last sweep 12 Oct 2026, 14:39 finished, nothing failed`.<br>**Restored:** the real release function closed the claim, so no SQL restore was needed. The fetch wrapper was removed. No `retention_sweeps` UPDATE was issued by hand. |
| **R5a** History `delete_refused` | **PASS** | Retention → History: `✎ Refused to delete rl-sub.txt: on legal hold` (×2, from R1). The earlier drive's receipts render the same way: `Refused to delete g4-hold-1.txt: on legal hold`, `… g4-hold-2.txt …` (7 such rows on the page). `/delete_refused/.test(main.innerText)` → **false**. |
| **R5b** two-stage folder line | **PASS** | Library → `275-RL-Life` (policy: archive 1 day after added, then queue for deletion after 2 days): **`This folder: kept 1 day after added to the Library, then archived; queued for deletion 2 days after added to the Library.`** The archive comes before the deletion queue. |
| **R5c** posture `1 policy` | **PASS** | After `Save policy`: **`1 policy · 1 legal hold`**. After cleanup: `0 policies · 0 legal holds`. |
| **R5d** fully archived folder | **PASS** | `275-RL-Life`, with both documents archived, showed the folder line and then only **`2 archived documents hidden · Show`**. `includes('No documents in this folder')` → **false**; `includes('Upload files above to add them here')` → **false**. |

**Supporting reads for the lifecycle rows.**
- **Policy, made through the UI:**
  - Steps: `+ New policy` → Name `275 RL lifecycle` → Folder `/275-RL-Life` (+ subfolders) → Keep for `1` `days` → Counted from `date_added` → Then `archive` → `Then queue it for deletion` after `2` `days` → `1 · Preview` → `2 · Save policy`.
  - Preview: `2 would be archived` · `rl-life-a.txt · due 11 Oct 2026` · `rl-life-b.txt · due 11 Oct 2026` · `0 skipped — on legal hold` … `0 not due yet`.
  - Policies row after Save: `1 day after added to the Library, delete after 2 days` · `Archive` `Delete · needs approval` · `2 due now`.
- **Sweep 1:** `archived 2, queued_delete 2, held 1` (the held document is the R1 hold).
- **Sweep 2:** `archived 1, queued_delete 1, held 1`.

**New findings (no code changed, per instruction).**

| Id | What | Where | Severity |
|---|---|---|---|
| OBS-R2a | **History renders the `changed` drop as `Did not delete not recorded`, naming neither the document nor the reason.**<br>• **Backend:** the document was moved, and `family_key` embeds `folder_id`, so the queued family's key no longer resolves in the confirm-time snapshot. `_confirm_delete` then sets `name = fam.name if fam else None` and writes the `did_not_delete` receipt with `document_name = NULL`. The confirm response also carries `"name": null` for that row.<br>• **Frontend:** `RetentionHistory.tsx:47-55` renders only `Did not delete **{doc}**` for any reason other than `held`, and the null name becomes `not recorded`.<br>• The banner was right only because it fell back to the card's row name. | `backend/app/services/retention/disposition.py:596-601`; the same `fam is None` pattern sits at `:525`, `:671` and `:702-712`.<br>`frontend/src/components/retention/RetentionHistory.tsx:47-55`.<br>UI-SPEC S5 has no `changed` / `not_found` History sentence. | User-visible audit-ledger copy defect. The receipt still carries `document_id`, `policy_name` and `detail.reason="changed"`, so nothing is missing from the record; only the rendered sentence is wrong. **Open — not fixed here** |
| OBS-R2b | The ported late-hold clause stays singular for a plural count: `Kept 2: rl-life-a.txt, rl-life-c.txt went on legal hold after the sweep, so **it was** dropped at confirm.` | `retentionCopy.ts` late-hold template (ported from the sketch) | Cosmetic grammar. Open |
| OBS-R4 | With the scheduled-sweep flag off (the shipped default, D-29), a `running` status can never show: the flag-off branch wins (`RetentionTab.tsx:44-54`), so a run-now in flight reads only `Scheduled sweeps are off…`. That sentence is true, so this is not a defect. Recorded so the next look knows R4 needs the flag on. | `frontend/src/components/retention/RetentionTab.tsx:44` | Note |

**Data created, removed, restored and kept.**

- **Created, then removed:**
  - Folders `/275-RL`, `/275-RL/Sub`, `/275-RL-Life`, `/275-RL-Life/Moved`.
  - Documents `rl-parent.txt`, `rl-sub.txt`, `rl-life-a.txt`, `rl-life-b.txt`, `rl-life-c.txt`.
  - Removed after the holds were released, with the admin's `DELETE /folders/{id}` → `204`, `204`.
  - Final SQL: test folders **0**, `rl-*` documents **0**, their chunks **0**, their storage objects **0**, active holds **0**, policies **0**, queue **0**, archived documents **0**.
- **Released through the UI** (Legal holds → `Release hold…`):
  - `Release “275 RL late hold”?` · `2 documents will no longer be protected. …`
  - `275 RL subfolder hold`: `1 document will no longer be protected. …`
  - After both: `0 active` · `4 released holds`.
- **Removed through the UI** (Policies → row → `Remove policy…` → `Remove policy`): policy `275 RL lifecycle`. Dialog: `Remove “275 RL lifecycle”?` · `No documents are deleted. …`. After: `0 policies · 0 legal holds`.
- **Planted state, all restored:**
  - Fixture back-dating:
    - `UPDATE documents SET created_at = created_at - interval '3 days' WHERE folder_id='464ecd0b…'` (2 rows).
    - The same UPDATE for `rl-life-c.txt` (`id='2fa31c04…'`, 1 row).
    - The documents themselves were deleted afterwards.
  - R4: the `running` sweep row came from the real claim and was closed by the real release (`last_status ok`, lease NULL).
  - The browser fetch wrappers (R3 cancel-once, R4 `sweep_enabled`) lived only in two tabs, which were closed afterwards.
- **Kept on purpose:**
  - The 18 immutable `retention_receipts` this drive wrote (archived 3, delete_refused 2, did_not_delete 3, dry_run 1, hold_placed 2, hold_released 2, policy_deleted 1, policy_saved 1, queued_delete 3). They are this drive's audit trail (T-275-07).
  - The 2 released `legal_holds` rows and their coverage rows.
  - The preview rows.
  - The org's `retention_sweeps` row (`last_status ok`, `last_run_at 10:39:23Z`).

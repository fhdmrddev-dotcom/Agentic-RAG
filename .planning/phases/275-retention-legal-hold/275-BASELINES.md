# Phase 275 — baselines and gate evidence (plan 275-01)

Every later gate in this phase is a **set diff** against the sets below, never a count comparison.

## PHASE_BASE

```
PHASE_BASE = b41d51d6b2de26f70d97bd1b8f8c39a889b9b8c4   (docs(275): begin phase execution)
captured   = 2026-10-12T05:12:40Z, local-DB lock held ("275-01 baseline+migrations")
```

## Backend unit baseline at base

Command: `node scripts/check-backend-unit-baseline.cjs -- tests/unit -q --continue-on-collection-errors -rf -p no:cacheprovider`
(the canonical command plus `-rf`, so the FAILED SET is captured from the same run as the verdict).

Verdict line (verbatim):

```
71 failed, 6932 passed, 1 skipped, 2 xfailed, 2 xpassed, 51 warnings in 361.69s (0:06:01)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

FAILED SET at base (71 ids, sorted):

```
FAILED tests/unit/test_061_consumer.py::test_xread_advances_last_id
FAILED tests/unit/test_071_1_threadpool_sweep.py::test_extract_composable_calls_wrapped_in_threadpool
FAILED tests/unit/test_071_1_threadpool_sweep.py::test_no_unwrapped_sync_calls_in_route[async def upload_document(]
FAILED tests/unit/test_075_4_unknown_provider_error.py::test_known_providers_includes_all_five_providers
FAILED tests/unit/test_111_1_reembed_kickoff.py::test_dims_only_change_kicks_reembed
FAILED tests/unit/test_111_1_reembed_kickoff.py::test_model_change_kicks_reembed
FAILED tests/unit/test_111_1_reembed_kickoff.py::test_model_only_change_kicks_without_resize
FAILED tests/unit/test_111_1_reembed_kickoff.py::test_no_change_save_does_not_reembed
FAILED tests/unit/test_182_validate.py::test_interactive_phase_verdict_is_incomplete_and_per_node
FAILED tests/unit/test_190_review_fix_data_layer.py::test_CR01_the_projection_names_every_safe_column_and_never_the_secret
FAILED tests/unit/test_200_1_phase_output_shape.py::test_this_plan_wrote_no_migration
FAILED tests/unit/test_chat_tool_approval.py::test_tool_approval_ask_emits_event_and_pauses
FAILED tests/unit/test_cross_worker_cancellation.py::test_a_late_producer_finalize_may_not_write_failed_over_a_cancel
FAILED tests/unit/test_cross_worker_cancellation.py::test_the_registry_read_only_ever_turns_failed_into_cancelled
FAILED tests/unit/test_db_runs.py::test_insert_assistant_message_optional_fields_none
FAILED tests/unit/test_db_runs.py::test_insert_assistant_message_sql_shape
FAILED tests/unit/test_db_runs.py::test_insert_run_passes_args_positionally
FAILED tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_default_mode_uses_default_prompt
FAILED tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_default_mode_uses_default_tools
FAILED tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explicit_default_mode_same_as_omitted
FAILED tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_prompt
FAILED tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_tools
FAILED tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_max_iterations_8
FAILED tests/unit/test_extraction_service.py::test_legacy_extractor_docx_matches_golden
FAILED tests/unit/test_extraction_service.py::test_legacy_extractor_pdf_matches_golden
FAILED tests/unit/test_forced_emit.py::test_forced_emit_judge_verdict_unmocked
FAILED tests/unit/test_get_model_capability_inference.py::test_infer_openai_from_gpt_prefix
FAILED tests/unit/test_lifespan.py::test_pg_pool_close_timeout_falls_back_to_terminate
FAILED tests/unit/test_lifespan.py::test_pg_pool_closes_before_supabase
FAILED tests/unit/test_lifespan.py::test_supabase_aclose_after_pg_pool
FAILED tests/unit/test_module7_tools.py::TestGetTools::test_returns_base_tools_without_tavily_or_sandbox
FAILED tests/unit/test_module7_tools.py::TestGetTools::test_returns_one_more_tool_with_tavily
FAILED tests/unit/test_multimodal_query.py::test_image_chunk_insertion
FAILED tests/unit/test_multimodal_query.py::test_query_tables_column_filter
FAILED tests/unit/test_multimodal_query.py::test_query_tables_document_not_found
FAILED tests/unit/test_multimodal_query.py::test_query_tables_returns_data
FAILED tests/unit/test_multimodal_query.py::test_query_tables_row_cap
FAILED tests/unit/test_per_format_ingestion.py::test_every_allowed_mime_type_has_a_case_or_a_named_alias
FAILED tests/unit/test_phase56_iteration_start.py::TestIterationStartInProductionSource::test_threads_py_emits_iteration_start_at_loop_top
FAILED tests/unit/test_published_workflow_ownership.py::test_published_workflow_field_set_excludes_created_by
FAILED tests/unit/test_retrieval_service.py::TestEnrichWithFilenamesPhase28::test_enrich_with_filenames_defaults_version_number_to_1
FAILED tests/unit/test_retrieval_service.py::TestEnrichWithFilenamesPhase28::test_enrich_with_filenames_includes_version_number
FAILED tests/unit/test_retrieval_service.py::TestSearchDocuments::test_calls_embed_texts_with_query
FAILED tests/unit/test_retrieval_service.py::TestSearchDocuments::test_calls_supabase_rpc_match_document_chunks
FAILED tests/unit/test_retrieval_service.py::TestSearchDocuments::test_joins_results_with_documents_table
FAILED tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_empty_list_when_no_chunks_match
FAILED tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_empty_list_when_rpc_data_is_none
FAILED tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_formatted_results
FAILED tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_multiple_results
FAILED tests/unit/test_retrieval_service.py::TestSearchDocuments::test_uses_unknown_filename_when_doc_not_found
FAILED tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_chunk_index_none_when_missing
FAILED tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_hybrid_empty_returns_tuple
FAILED tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_avg_similarity_as_second_value
FAILED tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_chunk_index_in_enriched_results
FAILED tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_zero_avg_sim_when_no_results
FAILED tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_empty_output
FAILED tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_storage_path_format
FAILED tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_uploads_and_inserts
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_markdown_table_has_header_and_separator
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_json_for_large_results
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_markdown_table_for_small_results
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_no_results_string_when_data_is_none
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_no_results_string_when_empty
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_truncates_to_20_rows_with_note
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsRpcCall::test_calls_query_user_documents_rpc
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsRpcCall::test_raises_runtime_error_on_rpc_exception
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_insert_query
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_non_select_query
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_query_with_semicolon
FAILED tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_update_query
FAILED tests/unit/test_streaming_reliability.py::TestAsyncioShield::test_persist_assistant_message_is_sync
```

## Frontend typecheck at base

Command: `cd frontend && npx tsc -p tsconfig.app.json --noEmit` (plain `tsc --noEmit` checks zero files — forbidden).
**66 errors at base.** Error SET (`file:line:code`, sorted):

```
src/__tests__/hooks/useDocuments.test.ts:130:TS2322
src/__tests__/hooks/useFolders.test.ts:217:TS6133
src/__tests__/hooks/useMessages.test.ts:161:TS2353
src/__tests__/hooks/useMessages.test.ts:227:TS2554
src/__tests__/hooks/useMessages.test.ts:289:TS2554
src/__tests__/hooks/useMessages.test.ts:377:TS2554
src/__tests__/hooks/useMessages.test.ts:423:TS2554
src/__tests__/providers/streamsProvider_state01b_403.test.tsx:23:TS6133
src/components/chat/__tests__/ChatAreaMode.test.tsx:104:TS2322
src/components/chat/__tests__/ChatAreaMode.test.tsx:140:TS2322
src/components/chat/__tests__/ChatAreaMode.test.tsx:162:TS2322
src/components/chat/__tests__/ChatAreaMode.test.tsx:44:TS2322
src/components/chat/__tests__/MessageInput.connectors.test.tsx:1:TS6133
src/components/chat/MessageSkeleton.tsx:14:TS2503
src/components/experts/ExpertAuthoringStudio.tsx:1:TS6133
src/components/experts/ExpertAuthoringStudio.tsx:12:TS6133
src/components/experts/ExpertAuthoringStudio.tsx:41:TS6133
src/components/layout/__tests__/ChatLayoutLaunch.test.tsx:173:TS2740
src/components/layout/NavPanel.test.tsx:87:TS2352
src/components/library/__tests__/IngestionTab.test.tsx:133:TS6133
src/components/library/__tests__/IngestionTab.test.tsx:210:TS6133
src/components/library/__tests__/IngestionTab.test.tsx:228:TS6133
src/components/library/__tests__/IngestionTab.test.tsx:42:TS2741
src/components/library/__tests__/IngestionTab.test.tsx:43:TS2741
src/components/library/__tests__/IngestionTab.test.tsx:506:TS6133
src/components/library/__tests__/IngestionTab.test.tsx:512:TS2345
src/components/library/__tests__/sketchComposition.test.tsx:338:TS2739
src/components/library/__tests__/ViewCardGrid.test.tsx:21:TS2554
src/components/library/__tests__/ViewCardGrid.test.tsx:22:TS2554
src/components/library/__tests__/ViewCardGrid.test.tsx:82:TS2345
src/components/library/indexing/FoldersIndexTable.tsx:22:TS6133
src/components/org/OrgExpertsTab.tsx:20:TS6133
src/components/org/OrgExpertsTab.tsx:4:TS6133
src/components/org/OrgExpertsTab.tsx:6:TS6133
src/components/panel/__tests__/FilesSection.test.tsx:158:TS2304
src/components/panel/__tests__/FilesSection.test.tsx:168:TS2304
src/components/panel/__tests__/FilesSection.test.tsx:177:TS2304
src/components/panel/FilePreview.test.tsx:33:TS2783
src/components/panel/FilePreview.test.tsx:34:TS2783
src/components/panel/FilePreview.test.tsx:35:TS2783
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx:106:TS2322
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx:13:TS6133
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx:136:TS2322
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx:185:TS2322
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx:232:TS2322
src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx:47:TS6133
src/components/settings/ConnectionFormPanel.tsx:1036:TS2339
src/components/settings/ConnectionFormPanel.tsx:1037:TS2339
src/components/settings/ConnectionFormPanel.tsx:1067:TS2339
src/components/settings/ConnectionFormPanel.tsx:1163:TS2322
src/components/settings/ConnectionFormPanel.tsx:987:TS2353
src/components/settings/MemorySection.tsx:52:TS2339
src/components/skills/SkillFormDialog.tsx:418:TS2322
src/components/skills/SkillFormDialog.tsx:608:TS2322
src/components/workflows/WorkflowDoorSwitch.tsx:399:TS2322
src/lib/api.test.ts:131:TS2322
src/lib/api.ts:267:TS2724
src/lib/api.ts:268:TS2305
src/pages/LibraryPage.tsx:58:TS6133
src/pages/LibraryPage.tsx:58:TS6133
src/pages/SettingsPage.test.tsx:83:TS2322
src/pages/SettingsPage.tsx:1349:TS2322
src/pages/SettingsPage.tsx:998:TS2561
src/providers/OrgProvider.test.tsx:23:TS6133
src/providers/OrgProvider.test.tsx:71:TS2741
src/stores/streamsStore.ts:475:TS2345
```

## Vitest count gate at base

Command: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root). Verdict (verbatim):

```
  total 9983  ·  failed 0  ·  pinned total 9196
count gate OK — 424/424 pinned files present, no per-file decrease, 0 failing.
```

## Task 1 — the RED run (before migrations 204/205 existed)

Command: `pytest tests/unit/test_275_migration_204_shape.py tests/unit/test_275_migration_205_shape.py
tests/integration/test_275_hold_triggers.py tests/integration/test_275_policy_rls.py
tests/integration/test_275_retrievable.py -q` →
`59 failed, 1 passed, 1 warning, 12 errors in 11.91s`. All five files are red.

The one PASS is `test_a_member_cannot_delete_another_members_document_regardless`: a deliberate
SANITY CONTROL (it proves the PT409 cases are the trigger and not owner RLS) that is true before and
after the migration by construction. It asserts nothing about 204/205.

```
PASSED tests/integration/test_275_hold_triggers.py::test_a_member_cannot_delete_another_members_document_regardless
ERROR tests/integration/test_275_policy_rls.py::test_a_member_reads_nothing_and_the_admin_reads_the_seeded_rows
ERROR tests/integration/test_275_policy_rls.py::test_member_and_admin_cannot_write_a_policy_through_the_jwt
ERROR tests/integration/test_275_policy_rls.py::test_admin_cannot_update_a_hold_through_the_jwt_but_can_create_one
ERROR tests/integration/test_275_policy_rls.py::test_a_member_cannot_create_a_hold
ERROR tests/integration/test_275_policy_rls.py::test_an_admin_of_org_a_cannot_write_a_hold_for_org_b
ERROR tests/integration/test_275_policy_rls.py::test_protected_columns_are_refused_by_the_trigger_even_with_a_grant
ERROR tests/integration/test_275_policy_rls.py::test_an_insert_cannot_set_protected_columns
ERROR tests/integration/test_275_policy_rls.py::test_a_receipt_outlives_its_actor
ERROR tests/integration/test_275_policy_rls.py::test_receipts_are_immutable_for_every_role
ERROR tests/integration/test_275_policy_rls.py::test_a_disposition_receipt_must_name_its_policy
ERROR tests/integration/test_275_policy_rls.py::test_only_the_service_role_executes_the_predicates
ERROR tests/integration/test_275_policy_rls.py::test_held_folders_reports_empty_ancestor_and_foreign_content_and_never_a_name
FAILED tests/unit/test_275_migration_204_shape.py::test_the_hold_refusal_maps_to_http_409
FAILED tests/unit/test_275_migration_204_shape.py::test_no_raise_interpolates_a_matter_name
FAILED tests/unit/test_275_migration_204_shape.py::test_every_recursive_walk_is_cycle_bounded
FAILED tests/unit/test_275_migration_204_shape.py::test_truncate_is_guarded_and_revoked
FAILED tests/unit/test_275_migration_204_shape.py::test_rls_is_enabled_on_every_new_table_and_all_privileges_are_revoked_first
FAILED tests/unit/test_275_migration_204_shape.py::test_public_is_revoked_before_every_execute_grant
FAILED tests/unit/test_275_migration_204_shape.py::test_the_two_predicates_are_the_service_roles_only
FAILED tests/unit/test_275_migration_204_shape.py::test_receipts_outlive_their_actor_and_their_document
FAILED tests/unit/test_275_migration_204_shape.py::test_a_disposition_receipt_must_name_its_policy
FAILED tests/unit/test_275_migration_204_shape.py::test_receipts_carry_no_update_or_delete_grant
FAILED tests/unit/test_275_migration_204_shape.py::test_no_automatic_delete_exists_anywhere
FAILED tests/unit/test_275_migration_204_shape.py::test_the_policy_clock_and_period_shape
FAILED tests/unit/test_275_migration_204_shape.py::test_the_protected_column_triggers_name_their_columns
FAILED tests/unit/test_275_migration_204_shape.py::test_policies_and_hold_updates_have_no_jwt_write_grant
FAILED tests/unit/test_275_migration_204_shape.py::test_every_write_policy_is_org_manage_and_org_scoped
FAILED tests/unit/test_275_migration_204_shape.py::test_the_archive_columns_are_added_then_analyzed
FAILED tests/unit/test_275_migration_204_shape.py::test_the_audit_check_keeps_every_literal_and_adds_the_retention_types
FAILED tests/unit/test_275_migration_204_shape.py::test_coverage_is_held_to_the_holds_own_org
FAILED tests/unit/test_275_migration_205_shape.py::test_the_generated_column_is_the_positive_form
FAILED tests/unit/test_275_migration_205_shape.py::test_analyze_follows_the_column_add
FAILED tests/unit/test_275_migration_205_shape.py::test_both_rpcs_use_the_column_in_every_branch
FAILED tests/unit/test_275_migration_205_shape.py::test_the_rpc_acl_is_reasserted
FAILED tests/unit/test_275_migration_205_shape.py::test_query_user_documents_refuses_guc_text_before_it_executes
FAILED tests/unit/test_275_migration_205_shape.py::test_four_restrictive_policies_keyed_on_the_guc
FAILED tests/unit/test_275_migration_205_shape.py::test_the_helper_is_not_public
FAILED tests/integration/test_275_hold_triggers.py::test_owner_delete_of_a_held_document_is_refused_and_an_unheld_sibling_deletes
FAILED tests/integration/test_275_hold_triggers.py::test_service_pool_delete_of_a_held_document_is_refused
FAILED tests/integration/test_275_hold_triggers.py::test_deleting_the_owner_from_auth_users_is_refused_through_the_fk_cascade
FAILED tests/integration/test_275_hold_triggers.py::test_release_ends_the_refusal
FAILED tests/integration/test_275_hold_triggers.py::test_a_hold_in_org_a_never_refuses_a_delete_in_org_b
FAILED tests/integration/test_275_hold_triggers.py::test_coverage_cannot_reference_another_orgs_document
FAILED tests/integration/test_275_hold_triggers.py::test_a_folder_hold_covers_a_document_added_later_in_a_grandchild
FAILED tests/integration/test_275_hold_triggers.py::test_deleting_the_held_folders_parent_is_refused_through_the_child_cascade
FAILED tests/integration/test_275_hold_triggers.py::test_a_folder_directly_holding_a_held_document_cannot_be_deleted
FAILED tests/integration/test_275_hold_triggers.py::test_any_version_of_a_held_family_is_refused_and_metadata_still_updates
FAILED tests/integration/test_275_hold_triggers.py::test_moving_a_folder_held_document_out_keeps_it_held
FAILED tests/integration/test_275_hold_triggers.py::test_moving_a_covered_subfolder_out_keeps_its_contents_held
FAILED tests/integration/test_275_hold_triggers.py::test_truncate_is_refused_while_a_hold_is_active_and_authenticated_cannot_truncate
FAILED tests/integration/test_275_hold_triggers.py::test_owner_cannot_change_archive_state_and_the_service_can
FAILED tests/integration/test_275_policy_rls.py::test_rls_is_enabled_and_anon_holds_nothing_on_every_new_table
FAILED tests/integration/test_275_retrievable.py::test_archived_is_excluded_from_every_rpc_arm
FAILED tests/integration/test_275_retrievable.py::test_missing_at_source_is_excluded_from_every_rpc_arm
FAILED tests/integration/test_275_retrievable.py::test_unauthorized_at_source_is_excluded_from_every_rpc_arm
FAILED tests/integration/test_275_retrievable.py::test_source_disconnected_is_excluded_from_every_rpc_arm
FAILED tests/integration/test_275_retrievable.py::test_the_retrievable_column_is_the_one_predicate
FAILED tests/integration/test_275_retrievable.py::test_agent_sql_cannot_see_an_archived_document_or_its_chunks
FAILED tests/integration/test_275_retrievable.py::test_agent_sql_cannot_see_a_source_gone_document
FAILED tests/integration/test_275_retrievable.py::test_the_guc_is_scoped_to_the_call
FAILED tests/integration/test_275_retrievable.py::test_text_that_could_switch_the_guc_is_refused_before_it_runs[SELECT content FROM document_chunks WHERE (SELECT set_config('app.agent_read','off',true)) IS NOT NULL]
FAILED tests/integration/test_275_retrievable.py::test_text_that_could_switch_the_guc_is_refused_before_it_runs[SELECT content FROM document_chunks WHERE (SELECT SET_CONFIG('app.agent_read','off',true)) IS NOT NULL]
FAILED tests/integration/test_275_retrievable.py::test_text_that_could_switch_the_guc_is_refused_before_it_runs[SELECT content FROM document_chunks WHERE (SELECT U&"\\0073et_config"('app.agent_read','off',true)) IS NOT NULL]
FAILED tests/integration/test_275_retrievable.py::test_text_that_could_switch_the_guc_is_refused_before_it_runs[SELECT current_setting('app.agent_read', true) AS v]
FAILED tests/integration/test_275_retrievable.py::test_text_that_could_switch_the_guc_is_refused_before_it_runs[SELECT CURRENT_SETTING('app.agent_read') AS v]
FAILED tests/integration/test_275_retrievable.py::test_text_that_could_switch_the_guc_is_refused_before_it_runs[SELECT u&'\\0073' AS v]
FAILED tests/integration/test_275_retrievable.py::test_text_that_could_switch_the_guc_is_refused_before_it_runs[SELECT query_to_xml('select 1', true, true, '') AS v]
FAILED tests/integration/test_275_retrievable.py::test_ordinary_ampersand_text_is_not_refused
FAILED tests/integration/test_275_retrievable.py::test_both_rpcs_keep_the_plan_pin_and_search_path[match_document_chunks]
FAILED tests/integration/test_275_retrievable.py::test_both_rpcs_keep_the_plan_pin_and_search_path[keyword_search_chunks]
FAILED tests/integration/test_275_retrievable.py::test_query_user_documents_is_not_public
```


## Task 2 — migrations 204 + 205 applied to the LOCAL database

Applied by executing each file with asyncpg against `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
(equivalent to pasting it into the SQL editor; never `supabase db push` / `db reset`), local-DB lock held.
Each file's commented VERIFY block was then executed. 205 was applied first, then 204 was RE-APPLIED on top
(idempotency proof: both re-apply cleanly). Final output, verbatim:

```
APPLIED ../supabase/migrations/205_retrievable_predicate.sql
        PASS  retrievable is a STORED generated column
        PASS  exactly one match_document_chunks and one keyword_search_chunks
        PASS  both RPCs read d.retrievable and never source_disconnected
        PASS  both RPCs keep the plan pin and search_path
        PASS  anon cannot EXECUTE either RPC or query_user_documents
        PASS  authenticated can EXECUTE query_user_documents
        PASS  query_user_documents switches the agent-read GUC and refuses set_config text
        PASS  four RESTRICTIVE agent-read policies
        PASS  anon cannot EXECUTE document_is_retrievable
VERIFY: 9/9 PASS
APPLIED ../supabase/migrations/204_retention_and_legal_hold.sql
        PASS  RLS enabled on every new table
        PASS  anon holds no privilege on any new table
        PASS  authenticated cannot write retention_policies
        PASS  authenticated cannot UPDATE/DELETE legal_holds
        PASS  no role can UPDATE/DELETE retention_receipts
        PASS  authenticated lacks TRUNCATE on documents/folders
        PASS  every hold/guard trigger present
        PASS  anon/authenticated cannot EXECUTE the hold predicates
        PASS  service_role can EXECUTE the hold predicates
        PASS  the audit CHECK carries folder.delete and the retention types
        PASS  the receipts policy_name CHECK exists
        PASS  documents carries the three archive columns
VERIFY: 12/12 PASS
```

⚠ The first 205 apply printed `*** FAIL ***  both RPCs keep the plan pin and search_path`. The pin WAS
present (`{"search_path=\"\"",plan_cache_mode=force_custom_plan}`); the VERIFY row itself compared the
array's TEXT form with `like '%search_path=""%'`, which the escaped quotes never match. The row now tests
array membership (`'search_path=""' = any (proconfig)`). The defect was in the check, not the schema.

`bash scripts/regenerate-full-schema.sh` (no `--reset`) → 10451 lines; `grep -c retrievable` = 22,
`grep -c retention_held_documents` = 8. The diff is additive apart from pg_dump re-sorting four existing
triggers (each still present exactly once). `node scripts/check-schema-acl-parity.cjs` →
`schema ACL parity OK — 323/323 mirrored` after mirroring 204/205's ACLs into
`scripts/full-schema-supplement.sql` (see the SUMMARY deviation: pg_dump runs `--no-privileges`).

### Plants driven against the shape fences (files restored md5-identical)

```
RED  PT409 -> P0001: 1 failed, 17 passed, 1 warning in 0.66s ['test_the_hold_refusal_maps_to_http_409']
RED  a RAISE interpolates h.name: 1 failed, 17 passed, 1 warning in 0.59s ['test_no_raise_interpolates_a_matter_name']
RED  drop the CYCLE clause: 1 failed, 17 passed, 1 warning in 0.75s ['test_every_recursive_walk_is_cycle_bounded']
RED  drop one REVOKE FROM PUBLIC: 2 failed, 16 passed, 1 warning in 0.64s ['test_public_is_revoked_before_every_execute_grant', 'test_the_two_predicates_are_the_service_roles_only']
RED  receipts actor ON DELETE CASCADE: 1 failed, 17 passed, 1 warning in 0.74s ['test_receipts_outlive_their_actor_and_their_document']
RED  add an auto_delete column: 1 failed, 17 passed, 1 warning in 0.61s ['test_no_automatic_delete_exists_anywhere']
RED  grant authenticated INSERT on policies: 1 failed, 17 passed, 1 warning in 0.87s ['test_policies_and_hold_updates_have_no_jwt_write_grant']
RED  ANALYZE above the column add: 1 failed, 6 passed, 1 warning in 0.59s ['test_analyze_follows_the_column_add']
RED  drop plan_cache_mode from keyword header: 1 failed, 6 passed, 1 warning in 0.51s ['test_both_rpcs_use_the_column_in_every_branch']
RED  restore the source_disconnected clause in keyword: 1 failed, 6 passed, 1 warning in 0.57s ['test_both_rpcs_use_the_column_in_every_branch']
RED  refusal after EXECUTE: 1 failed, 6 passed, 1 warning in 0.53s ['test_query_user_documents_refuses_guc_text_before_it_executes']
restored md5-identical
```

### EXPLAIN of the vector body (RESEARCH Pitfall 1)

**recall_bench** (100,000 chunks / 3,850 documents) — the 204/205 column DDL + `ANALYZE` applied inside a
transaction that was ROLLED BACK (the research method; recall_bench carries no 204/205 afterwards):

```
recall_bench: 100000 chunks, 3850 documents
hnsw: ['document_chunks_embedding_idx']
archive columns present before the probe: 0
Limit  (cost=2754.51..4255.89 rows=20 width=48) (actual rows=20 loops=1)
  ->  Nested Loop Semi Join  (cost=2754.51..1005380.39 rows=13356 width=48) (actual rows=20 loops=1)
        Join Filter: (dc.org_id = (current_user_org_ids()))
        Rows Removed by Join Filter: 2
        ->  Nested Loop  (cost=2754.51..768507.00 rows=26712 width=66) (actual rows=22 loops=1)
              ->  Index Scan using document_chunks_embedding_idx on document_chunks dc  (cost=2754.23..739836.00 rows=33333 width=82) (actual rows=31 loops=1)
              ->  Index Scan using documents_pkey on documents d  (cost=0.28..0.85 rows=1 width=54) (actual rows=1 loops=31)
Planning Time: 0.588 ms
Execution Time: 13.774 ms
archive columns present after rollback: 0
```

**The local dev DB** (8,842 chunks), where the caller owns 8,256 of them (93%). A top-N heapsort is the
correct plan for a caller who can read nearly the whole table, and the plan is IDENTICAL before and after
the swap (`d.retrievable` vs migration 200's source_state clause), ~62-66 ms either way — no regression:

```
indexes: ['document_chunks_embedding_idx']
=== mig 205: AND d.retrievable | enable_seqscan=on
Limit  (cost=1830.40..1830.45 rows=20 width=48) (actual rows=20 loops=1)
  ->  Sort  (cost=1830.40..1833.84 rows=1375 width=48) (actual rows=20 loops=1)
        Sort Key: ((dc.embedding <=> '<vec>'))
        Sort Method: top-N heapsort  Memory: 27kB
        ->  Hash Join  (cost=54.11..1793.81 rows=1375 width=48) (actual rows=7275 loops=1)
              Join Filter: ((dc.user_id = (COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((NULLIF(current_setting('request.jw
              ->  Hash Join  (cost=12.27..1734.12 rows=1440 width=66) (actual rows=8166 loops=1)
                    ->  Seq Scan on document_chunks dc  (cost=0.00..1698.27 rows=2881 width=82) (actual rows=8256 loops=1)
                    ->  Seq Scan on documents d  (cost=0.00..39.21 rows=211 width=56) (actual rows=211 loops=1)
Planning Time: 0.978 ms
Execution Time: 65.836 ms
=== mig 205: AND d.retrievable | enable_seqscan=off
Limit  (cost=1991.73..1991.78 rows=20 width=48) (actual rows=20 loops=1)
  ->  Sort  (cost=1991.73..1995.17 rows=1375 width=48) (actual rows=20 loops=1)
        Sort Key: ((dc.embedding <=> '<vec>'))
        Sort Method: top-N heapsort  Memory: 27kB
        ->  Hash Join  (cost=91.71..1955.14 rows=1375 width=48) (actual rows=7275 loops=1)
              Join Filter: ((dc.user_id = (COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((NULLIF(current_setting('request.jw
              ->  Hash Join  (cost=12.55..1858.14 rows=1440 width=66) (actual rows=8166 loops=1)
                    ->  Index Scan using idx_document_chunks_org_id on document_chunks dc  (cost=0.29..1822.30 rows=2881 width=82) (actual rows=8256 loops=1)
                    ->  Bitmap Heap Scan on documents d  (cost=37.39..76.52 rows=211 width=56) (actual rows=211 loops=1)
                          ->  Bitmap Index Scan on documents_latest_idx  (cost=0.00..37.34 rows=213 width=0) (actual rows=213 loops=1)
Planning Time: 0.324 ms
Execution Time: 62.160 ms
=== mig 200 (before): source_state clause | enable_seqscan=on
Limit  (cost=1830.95..1831.00 rows=20 width=48) (actual rows=20 loops=1)
  ->  Sort  (cost=1830.95..1834.39 rows=1375 width=48) (actual rows=20 loops=1)
        Sort Key: ((dc.embedding <=> '<vec>'))
        Sort Method: top-N heapsort  Memory: 27kB
        ->  Hash Join  (cost=54.67..1794.36 rows=1375 width=48) (actual rows=7399 loops=1)
              Join Filter: ((dc.user_id = (COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((NULLIF(current_setting('request.jw
              ->  Hash Join  (cost=12.27..1734.12 rows=1440 width=66) (actual rows=8166 loops=1)
                    ->  Seq Scan on document_chunks dc  (cost=0.00..1698.27 rows=2881 width=82) (actual rows=8256 loops=1)
                    ->  Seq Scan on documents d  (cost=0.00..39.76 rows=211 width=56) (actual rows=213 loops=1)
Planning Time: 0.324 ms
Execution Time: 62.068 ms
=== mig 200 (before): source_state clause | enable_seqscan=off
Limit  (cost=1992.27..1992.32 rows=20 width=48) (actual rows=20 loops=1)
  ->  Sort  (cost=1992.27..1995.70 rows=1375 width=48) (actual rows=20 loops=1)
        Sort Key: ((dc.embedding <=> '<vec>'))
        Sort Method: top-N heapsort  Memory: 27kB
        ->  Hash Join  (cost=92.24..1955.68 rows=1375 width=48) (actual rows=7399 loops=1)
              Join Filter: ((dc.user_id = (COALESCE(NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text), ((NULLIF(current_setting('request.jw
              ->  Hash Join  (cost=12.55..1858.14 rows=1440 width=66) (actual rows=8166 loops=1)
                    ->  Index Scan using idx_document_chunks_org_id on document_chunks dc  (cost=0.29..1822.30 rows=2881 width=82) (actual rows=8256 loops=1)
                    ->  Bitmap Heap Scan on documents d  (cost=37.39..77.05 rows=211 width=56) (actual rows=213 loops=1)
                          ->  Bitmap Index Scan on documents_latest_idx  (cost=0.00..37.34 rows=213 width=0) (actual rows=213 loops=1)
Planning Time: 0.378 ms
Execution Time: 64.732 ms
```

### ⛔ Environment finding (measured during Task 2): a refused function call CRASHES the local backend

Calling ANY function as `authenticated` without EXECUTE kills the backend process and sends the local
Postgres into crash recovery (`the database system is in recovery mode`; `pg_postmaster_start_time()`
unchanged at 03:16:39, so it is a backend crash, not a restart). Reproduced three times, one probe per
connection: `retention_held_documents`, `retention_folder_ancestors`, and the PRE-EXISTING
`resize_embedding_column(integer)` (migration 177) all crash identically — so it is not 204/205 SQL.
Preloaded: `pg_stat_statements, pgaudit, plpgsql, plpgsql_check, pg_cron, pg_net, pgsodium, auto_explain,
pg_tle, plan_filter, supabase_vault` + session `supautils`. A table-privilege refusal (42501 on
`retention_policies`) does NOT crash. Consequence for this suite: W-5b is asserted on the privilege and the
ACL, never by calling the function. Rows leaked by the crashed run were removed by hand (3 test users,
their 2 orgs, 1 hold). Recorded in `deferred-items.md`; whether production behaves the same is UNMEASURED
(probing it would mean crashing a production backend — not done).

### Task 2 verify

`pytest tests/unit/test_275_migration_204_shape.py tests/unit/test_275_migration_205_shape.py
tests/integration/test_275_hold_triggers.py tests/integration/test_275_policy_rls.py
tests/integration/test_275_retrievable.py tests/integration/test_272_rpc_document_scope.py
tests/integration/test_272_scope_rls.py tests/unit/test_272_review_fixes.py -q` → **163 passed**, no skips.

Neighbouring live suites (110 drift guard, 163 documents/platform/asyncpg leak, 266, 267, 268 scope race,
271 search + fence, kb, v3.4 isolation, 113, 116 tool leak, 119 leak) → `1 failed, 114 passed`. The one
failure, `test_110_audit_drift_guard.py::test_valid_action_types_is_exactly_19`, is INHERITED: it pins 19
types and has read `extra=['connector.call', 'connector.grant']` since Phase 223; `audit_service.py` was
not yet modified when it ran.

## Task 3 — hold_guard, the audit sync, the RETRIEVABLE_COLUMN swap, ledger rows

Targeted: `pytest tests/unit/test_275_hold_guard.py tests/unit/test_272_scope_seam.py
tests/unit/test_272_scope_resolver.py tests/unit/test_267_scope_preview.py -q` → **56 passed**.
Wider seam neighbours (267 expert_changed_event / handoff, 268 scope_effect / scope_patch, 272 review fixes)
→ 215 passed. Live re-run after the swap (272 scope RLS through real PostgREST, 110 drift guard, 266, 268
race, the three 275 suites, 272 RPC) → **76 passed**, no skips — PostgREST resolves `retrievable`.

`grep -v '^\s*#' backend/app/services/retrieval_scope.py backend/app/services/expert_scope.py | grep -c
source_disconnected` → **0**. `git diff --stat b41d51d6b -- backend/app/services/retrieval_service.py` →
**empty** (D-33).

`node scripts/check-claude-md-size.cjs` → exit 0, `OK WITH WARNINGS` — **120,402 chars, past the 120,000
warn band** (this commit adds 819 chars; the plan's three mandated rows alone would also have crossed it).
`node scripts/check-hot-file-ledger.cjs --files <the nine planned files>` → `ledger gate OK` (exit 0).

### Final backend unit baseline (local-DB lock held)

```
71 failed, 6973 passed, 1 skipped, 2 xfailed, 2 xpassed, 48 warnings in 348.79s (0:05:48)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

**Set diff against the base FAILED SET: EMPTY** — the same 71 ids. (A raw `comm` shows one id on both
sides because a `RuntimeWarning` was interleaved onto the line in this run's output; normalised to the
test id, it is the same test.) Passed rose 6932 → 6973: +41 = the 16 `test_275_hold_guard` cases and the
25 migration shape cases this plan adds.

## OWED (recorded, NOT performed by 275-01)

1. **Production apply of 204, then 205**, by operator-approved SQL-editor writes, BEFORE the backend
   deploy (D-29). The Supabase MCP points at production and every write needs per-action approval.
2. **`get_advisors(security)`** on production after that apply (D-27, T-275-08).
3. **A production read of the `source_state` distribution** before deploy (RESEARCH Runtime State
   Inventory) — a free read; any non-live row leaves agent retrieval the moment 205 lands.
4. **The local-Postgres crash on a refused function call** (see Task 2 and `deferred-items.md`) — needs
   `docker logs` to narrow, and an explicit operator decision before any production probe.
5. **CLAUDE.md is past the 120k warn band** — the split is now scheduled (CLAUDE.md's own rule), not
   urgent (hard limit 150k).

## 275-05 Task 1 — merged-tree gates (2026-10-12, `develop` @ `71c61a6f0`, 275-01..04 merged)

Main working tree, no sibling agent. Local-DB lock held for the backend baseline, the live suites and the
EXPLAIN probe, then released. One vitest count-gate run (the phase's only full one, revision W-5).

### Backend unit baseline

Command: `node scripts/check-backend-unit-baseline.cjs -- tests/unit -q --continue-on-collection-errors -rf -p no:cacheprovider`

```
71 failed, 7146 passed, 1 skipped, 2 xfailed, 2 xpassed, 46 warnings in 358.44s (0:05:58)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

**FAILED SET diff against the base set above: EMPTY** (71 ids on both sides). The one raw `comm` line was the
same interleaved-warning artifact 275-01/02/03 recorded:
`test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_prompt`
with a `...\_pytest\unraisableexception.py:33:` path glued onto the line; normalised to the test id, it is the
same base id. Passed: 6932 (base) → 7146 (+214, the phase's new unit cases).

### Live suites

Command: `pytest tests/integration/test_275_hold_triggers.py tests/integration/test_275_policy_rls.py tests/integration/test_275_retrievable.py tests/integration/test_275_disposition.py tests/integration/test_272_rpc_document_scope.py tests/integration/test_272_scope_rls.py -q`

```
71 passed, 19 warnings in 19.94s
```

No skips, no failures.

### OpenAPI snapshot

`pytest tests/unit/test_276_openapi_snapshot_fresh.py -q` →

```
2 passed, 1 warning in 0.39s
```

### Vitest count gate

Command: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root). Verdict (verbatim):

```
  total                                      9344   10131    +787
  total 10131  ·  failed 0  ·  pinned total 9344
count gate OK — 434/434 pinned files present, no per-file decrease, 0 failing.
```

Green on the first run; the cap stayed at 2 and was neither adjusted nor needed.
Arithmetic against base (`9983 · 9196 · 424/424`): pinned +148 = 275-02 (+24) + 275-04 (seven new suites
12+18+16+13+11+16+16 = 102, the `retentionCopy` re-pin 5→16 = +11, `OrgAdminShell.test.tsx` adopted at 11).
Files 424 → 434 = 275-02 (+2) + 275-04 (+7 suites, +1 adopted). **No residual.** The grand total rose by the
same +148. All nine suites under `frontend/src/components/retention/__tests__/` are pinned by basename in
BASELINE (holdRefusals 10, retentionCopy 16, libraryRetention 12, RetentionSection 18, LegalHolds 16,
WaitingForYou 13, RetentionTab 11, RetentionPolicyEditor 16, RetentionHistory 16), and the directory is a
TARGETS entry. The five suites the gate prints as `new` (PromptVariableChips, RunHero, automationFacts,
nodeEffectBanner, toolReadOnlyMap) were added in phases 200.2-209: inherited unpinned suites, not 275's.

### Frontend typecheck (full set diff — the phase's only full tsc run, revision W-5)

Command: `cd frontend && npx tsc -p tsconfig.app.json --noEmit` → exit 2, **66 errors = base count.**

Set diff against the base set above:

```
only at HEAD: src/pages/LibraryPage.tsx:62:TS6133  (x2)
only at base: src/pages/LibraryPage.tsx:58:TS6133  (x2)
```

The same two errors (`TabsList`, `TabsTrigger` declared but never read; the import line is byte-identical at base
and HEAD) moved from line 58 to 62 because 275-04 added four import lines above them. **No new error in any
275-touched file.**

### Deploy drift

`bash scripts/check-deploy-drift.sh` → exit 0:

```
RESULT: PASS — the one-box deploy artifacts are in sync.
```

with two non-blocking WARNs, verbatim:
`migration(s) above #198 carry seed-like INSERT/UPDATE — review whether the OPERATOR.md Step-3 list needs them: 204_retention_and_legal_hold.sql`
and `docker compose unavailable/denied here — CI (ubuntu-latest) runs the authoritative parse; using a structural fallback`.
The 204 WARN was read: its only `INSERT INTO` statements (`:397`, `:428`) are inside the sticky-coverage trigger
functions, not seed rows, so the Step-3 seed list needs nothing for 204.

### Docs coverage

`node scripts/check-docs-coverage.cjs` → exit 0:

```
112 code keys · 261 inventory IDs · 119 pages (32 written / 87 stubs)
docs coverage OK — every code key and inventory ID has a page (excluded by decision: I20).
```

### M-1 regression check — EXPLAIN of the vector body

The INDEX-branch body of `match_document_chunks` (mig 205: org gate, the three visibility arms, `d.retrievable`,
`is_latest`, threshold 0.0, LIMIT 20) as `authenticated` with both claim GUCs and a STORED embedding as the
query. `has_function_privilege('authenticated', …)` was checked first for every function the body calls (the
275-01 finding: a refused call crashes the local backend). recall_bench got 205's column DDL + ANALYZE inside a
ROLLED-BACK transaction (275-01's method). Subplan and filter detail lines are elided:

```
=== local dev DB (carries 204/205)
indexes: ['document_chunks_embedding_idx']
 authenticated EXECUTE current_user_org_ids() True
 authenticated EXECUTE folder_is_org_shared(uuid) True
 authenticated EXECUTE connection_doc_is_visible(uuid,text) True
 retrievable column: 1
 caller owns 8747/8844 chunks; dims=1536
   Limit (actual rows=20 loops=1)
     ->  Nested Loop Semi Join (actual rows=20 loops=1)
           Join Filter: (dc.org_id = (current_user_org_ids()))
           ->  Nested Loop (actual rows=20 loops=1)
                 ->  Index Scan using document_chunks_embedding_idx on document_chunks dc (actual rows=21 loops=1)
                       Order By: (embedding <=> '<stored embedding>'::vector)
                       Filter: (((current_setting('app.agent_read'::text, true) IS DISTINCT FROM 'on'::text) OR document_is_retrievable(document_id)) 
                               Filter: (((current_setting('app.agent_read'::text, true) IS DISTINCT FROM 'on'::text) OR retrievable) AND (ANY (org_id 
                 ->  Index Scan using documents_pkey on documents d (actual rows=1 loops=21)
                       Index Cond: (id = dc.document_id)
                       Filter: (retrievable AND is_latest AND ((current_setting('app.agent_read'::text, true) IS DISTINCT FROM 'on'::text) OR retrieva
   Planning Time: 0.979 ms
   Execution Time: 35.296 ms
=== recall_bench (205 column DDL + ANALYZE in a ROLLED-BACK TX)
indexes: ['document_chunks_embedding_idx']
 authenticated EXECUTE current_user_org_ids() True
 authenticated EXECUTE folder_is_org_shared(uuid) True
 authenticated EXECUTE connection_doc_is_visible(uuid,text) True
 retrievable column: 1
 caller owns 69805/100000 chunks; dims=1536
   Limit (actual rows=20 loops=1)
     ->  Nested Loop Semi Join (actual rows=20 loops=1)
           Join Filter: (dc.org_id = (current_user_org_ids()))
           ->  Nested Loop (actual rows=20 loops=1)
                 ->  Index Scan using document_chunks_embedding_idx on document_chunks dc (actual rows=21 loops=1)
                       Order By: (embedding <=> '<stored embedding>'::vector)
                 ->  Index Scan using documents_pkey on documents d (actual rows=1 loops=21)
                       Index Cond: (id = dc.document_id)
   Planning Time: 0.687 ms
   Execution Time: 12.051 ms
```

**Both use `document_chunks_embedding_idx`.** No regression. (275-01's local EXPLAIN showed a top-N heapsort,
identical before and after the swap; that probe's script is not in the tree, so the cause of the plan difference
is not measured. The claim here is only that the index is chosen on the merged tree.)

### Ledger and CLAUDE.md size (after the ledger close)

```
hot-file ledger — .planning/phases/275-retention-legal-hold
  scan list: 505 rows · subject: 110 files · watched: 58
ledger gate OK — every watched file has a row.

  CLAUDE.md                                  121650 chars   81.1% of limit  headroom   28350  [WARN]
claude-md size gate OK WITH WARNINGS — 1 file(s) past 120000 chars. Schedule the split now, not at 150k.
```

Both exit 0.

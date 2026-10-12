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

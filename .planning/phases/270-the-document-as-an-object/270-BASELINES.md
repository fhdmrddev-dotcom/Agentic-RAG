# Phase 270 — Frozen base gates

**Frozen by:** 270-01, Task 1 step (0), BEFORE any source edit of this phase.
**PHASE_BASE:** `26308281aae5f2c5662b86b272f945ac9f11322f` (`26308281a`, "docs(270): plan phase — 5 plans in 3 waves").
**Measured:** 2026-10-02, in the 270-01 worktree (`.claude/worktrees/agent-afef72f3a35ac4b19`), bootstrapped, HEAD
reset to PHASE_BASE (the worktree had started on an older commit, `417bb0bd7`).
⚠ Sibling wave-1 agents (270-02, 270-03) may have been running; the vitest run was NOT on a proven-quiet box.

⛔ Every later plan compares against these SETS, never against a count quoted in prose.

## (a) Backend unit gate

Command (in `backend/`): `node ../scripts/check-backend-unit-baseline.cjs`.

```
71 failed, 6052 passed, 1 skipped, 2 xfailed, 2 xpassed, 48 warnings in 658.86s (0:10:58)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

**0 collection errors.** 71 = the CLAUDE.md ceiling (zero headroom). Full failed SET (71 node ids):

```
tests/unit/test_061_consumer.py::test_xread_advances_last_id
tests/unit/test_071_1_threadpool_sweep.py::test_extract_composable_calls_wrapped_in_threadpool
tests/unit/test_071_1_threadpool_sweep.py::test_no_unwrapped_sync_calls_in_route
tests/unit/test_075_4_unknown_provider_error.py::test_known_providers_includes_all_five_providers
tests/unit/test_111_1_reembed_kickoff.py::test_dims_only_change_kicks_reembed
tests/unit/test_111_1_reembed_kickoff.py::test_model_change_kicks_reembed
tests/unit/test_111_1_reembed_kickoff.py::test_model_only_change_kicks_without_resize
tests/unit/test_111_1_reembed_kickoff.py::test_no_change_save_does_not_reembed
tests/unit/test_182_validate.py::test_interactive_phase_verdict_is_incomplete_and_per_node
tests/unit/test_190_review_fix_data_layer.py::test_CR01_the_projection_names_every_safe_column_and_never_the_secret
tests/unit/test_200_1_phase_output_shape.py::test_this_plan_wrote_no_migration
tests/unit/test_chat_tool_approval.py::test_tool_approval_ask_emits_event_and_pauses
tests/unit/test_cross_worker_cancellation.py::test_a_late_producer_finalize_may_not_write_failed_over_a_cancel
tests/unit/test_cross_worker_cancellation.py::test_the_registry_read_only_ever_turns_failed_into_cancelled
tests/unit/test_db_runs.py::test_insert_assistant_message_optional_fields_none
tests/unit/test_db_runs.py::test_insert_assistant_message_sql_shape
tests/unit/test_db_runs.py::test_insert_run_passes_args_positionally
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_default_mode_uses_default_prompt
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_default_mode_uses_default_tools
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explicit_default_mode_same_as_omitted
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_prompt
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_tools
tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_max_iterations_8
tests/unit/test_extraction_service.py::test_legacy_extractor_docx_matches_golden
tests/unit/test_extraction_service.py::test_legacy_extractor_pdf_matches_golden
tests/unit/test_forced_emit.py::test_forced_emit_judge_verdict_unmocked
tests/unit/test_get_model_capability_inference.py::test_infer_openai_from_gpt_prefix
tests/unit/test_lifespan.py::test_pg_pool_close_timeout_falls_back_to_terminate
tests/unit/test_lifespan.py::test_pg_pool_closes_before_supabase
tests/unit/test_lifespan.py::test_supabase_aclose_after_pg_pool
tests/unit/test_module7_tools.py::TestGetTools::test_returns_base_tools_without_tavily_or_sandbox
tests/unit/test_module7_tools.py::TestGetTools::test_returns_one_more_tool_with_tavily
tests/unit/test_multimodal_query.py::test_image_chunk_insertion
tests/unit/test_multimodal_query.py::test_query_tables_column_filter
tests/unit/test_multimodal_query.py::test_query_tables_document_not_found
tests/unit/test_multimodal_query.py::test_query_tables_returns_data
tests/unit/test_multimodal_query.py::test_query_tables_row_cap
tests/unit/test_per_format_ingestion.py::test_every_allowed_mime_type_has_a_case_or_a_named_alias
tests/unit/test_phase56_iteration_start.py::TestIterationStartInProductionSource::test_threads_py_emits_iteration_start_at_loop_top
tests/unit/test_published_workflow_ownership.py::test_published_workflow_field_set_excludes_created_by
tests/unit/test_retrieval_service.py::TestEnrichWithFilenamesPhase28::test_enrich_with_filenames_defaults_version_number_to_1
tests/unit/test_retrieval_service.py::TestEnrichWithFilenamesPhase28::test_enrich_with_filenames_includes_version_number
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_calls_embed_texts_with_query
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_calls_supabase_rpc_match_document_chunks
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_joins_results_with_documents_table
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_empty_list_when_no_chunks_match
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_empty_list_when_rpc_data_is_none
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_formatted_results
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_multiple_results
tests/unit/test_retrieval_service.py::TestSearchDocuments::test_uses_unknown_filename_when_doc_not_found
tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_chunk_index_none_when_missing
tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_hybrid_empty_returns_tuple
tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_avg_similarity_as_second_value
tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_chunk_index_in_enriched_results
tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_zero_avg_sim_when_no_results
tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_empty_output
tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_storage_path_format
tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_uploads_and_inserts
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_markdown_table_has_header_and_separator
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_json_for_large_results
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_markdown_table_for_small_results
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_no_results_string_when_data_is_none
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_no_results_string_when_empty
tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_truncates_to_20_rows_with_note
tests/unit/test_sql_service.py::TestQueryDocumentsRpcCall::test_calls_query_user_documents_rpc
tests/unit/test_sql_service.py::TestQueryDocumentsRpcCall::test_raises_runtime_error_on_rpc_exception
tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_insert_query
tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_non_select_query
tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_query_with_semicolon
tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_update_query
tests/unit/test_streaming_reliability.py::TestAsyncioShield::test_persist_assistant_message_is_sync
```

(`test_075...[async` / parametrised ids are stored without their `[...]` suffix.)

## (b) Vitest count gate

Command (repo root): `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`. Verdict lines, verbatim:

```
  total                                      8354    9107    +753
  total 9107  ·  failed 8  ·  pinned total 8354
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 8 test(s) failed — the gate requires 0.
```

⚠ **RED AT BASE, before any edit of this phase** — INHERITED by construction. The eight failing cases, named from
the gate's own persisted JSON report before any re-run (270-01 touches no frontend file):

```
src/pages/WorkflowBuilderPage.session.test.tsx › every dismissal commits and none of them PATCHes › pane click … (WR-11)   => AssertionError: expected 1 to be +0
src/pages/WorkflowRunPage.test.tsx › the run-time waiting reading (F5) › re-reads the ask slice on wake                  => AssertionError: expected 0 to be greater than 0
src/pages/WorkflowsPage.test.tsx › LIB-01 / SC#1 … D-08 the paraphrase returns ZERO rows                                  => STACK_TRACE_ERROR
src/pages/WorkflowsPage.test.tsx › D-17 … a PENDING project re-query never zeroes a count                                 => STACK_TRACE_ERROR
src/components/workflows/WorkflowCanvas.test.tsx › accessibility › no axe violations on a rendered canvas                 => STACK_TRACE_ERROR
src/components/workflows/WorkflowCanvas.test.tsx › accessibility › no axe violations on the empty state                   => Axe is already running
src/components/library/__tests__/sketchComposition.test.tsx › §2 › the page renders its heading                            => STACK_TRACE_ERROR
src/components/library/__tests__/sketchComposition.test.tsx › §2 › the four shipped tab triggers render                   => multiple elements role "tab" name "Documents"
```

Six are SEED-171's flaky suites (WorkflowsPage, WorkflowRunPage, WorkflowBuilderPage.session) and WorkflowCanvas axe
(concurrency, `Axe is already running`); `sketchComposition` is the standing inherited red. Not re-run to "get a
green": one sample is recorded as one sample.

## (c) Frontend typecheck (the non-vacuous one)

`cd frontend && npx tsc -p tsconfig.app.json --noEmit` → **70 errors**. Error SET (`file:line:code`, sorted):

```
src/__tests__/hooks/useDocuments.test.ts:130:TS2322
src/__tests__/hooks/useFolders.test.ts:217:TS6133
src/__tests__/hooks/useMessages.test.ts:161:TS2353
src/__tests__/hooks/useMessages.test.ts:227:TS2554
src/__tests__/hooks/useMessages.test.ts:289:TS2554
src/__tests__/hooks/useMessages.test.ts:377:TS2554
src/__tests__/hooks/useMessages.test.ts:423:TS2554
src/__tests__/providers/streamsProvider_state01b_403.test.tsx:23:TS6133
src/__tests__/routing/vercelRouting.test.ts:13:TS2307
src/__tests__/routing/vercelRouting.test.ts:14:TS2307
src/__tests__/routing/vercelRouting.test.ts:43:TS2304
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
src/components/library/__tests__/sketchComposition.test.tsx:333:TS2739
src/components/library/__tests__/ViewCardGrid.test.tsx:21:TS2554
src/components/library/__tests__/ViewCardGrid.test.tsx:22:TS2554
src/components/library/__tests__/ViewCardGrid.test.tsx:82:TS2345
src/components/library/indexing/FoldersIndexTable.tsx:22:TS6133
src/components/metadata/__tests__/CR01.reset.test.tsx:2:TS2307
src/components/org/OrgExpertsTab.tsx:20:TS6133
src/components/org/OrgExpertsTab.tsx:4:TS6133
src/components/org/OrgExpertsTab.tsx:6:TS6133
src/components/panel/__tests__/FilesSection.test.tsx:149:TS2304
src/components/panel/__tests__/FilesSection.test.tsx:159:TS2304
src/components/panel/__tests__/FilesSection.test.tsx:168:TS2304
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
src/lib/api.ts:261:TS2724
src/lib/api.ts:262:TS2305
src/pages/LibraryPage.tsx:50:TS6133
src/pages/LibraryPage.tsx:50:TS6133
src/pages/SettingsPage.test.tsx:83:TS2322
src/pages/SettingsPage.tsx:1349:TS2322
src/pages/SettingsPage.tsx:998:TS2561
src/providers/OrgProvider.test.tsx:23:TS6133
src/providers/OrgProvider.test.tsx:71:TS2741
src/stores/streamsStore.ts:475:TS2345
```

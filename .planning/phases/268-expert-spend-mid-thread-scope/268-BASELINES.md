# Phase 268 — Frozen base gates

**Frozen by:** 268-01, Task 1 step (0), BEFORE any source edit of this phase.
**PHASE_BASE:** `220c82dde25345ab776133748f0275ed16c59e06` (`220c82dde`, "docs(phase-268): begin execution").
**Measured:** 2026-09-28, in the 268-01 worktree (`.claude/worktrees/agent-a1a2050631b962bff`), bootstrapped.
⚠ A sibling agent (268-02) was dispatched in wave 1 at the same time; it touches no file measured here, but
the vitest run below was NOT on a quiet box. Recorded, not hidden.

⛔ Every later plan compares against these SETS, never against a count quoted in prose.

## (a) Backend unit gate

Command (in `backend/`): `node ../scripts/check-backend-unit-baseline.cjs` (it runs
`pytest tests/unit -q --continue-on-collection-errors` with the venv's pytest).

Verdict lines, verbatim:

```
71 failed, 5839 passed, 1 skipped, 2 xfailed, 2 xpassed, 47 warnings in 312.12s (0:05:12)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

**0 collection errors.** 71 = the CLAUDE.md ceiling (zero headroom).
⚠ `tests/unit/test_db_runs.py` carries three of the 71 (`test_insert_run_passes_args_positionally`,
`test_insert_assistant_message_sql_shape`, `test_insert_assistant_message_optional_fields_none`) — 268-01 edits
the writers they pin. They may turn green (the count falls, allowed); they must not be joined by a 4th.

Full failed SET (71 ids, sorted, reason stripped):

```
tests/unit/test_061_consumer.py::test_xread_advances_last_id
tests/unit/test_071_1_threadpool_sweep.py::test_extract_composable_calls_wrapped_in_threadpool
tests/unit/test_071_1_threadpool_sweep.py::test_no_unwrapped_sync_calls_in_route[async
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
tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_avg_similarity_as_second_valueC:\Vibe
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

## (b) Vitest count gate

Command (repo root): `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`

Verdict lines, verbatim:

```
  total                                      8230    8978    +748
  total 8978  ·  failed 2  ·  pinned total 8230
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 2 test(s) failed — the gate requires 0.
```

⚠ **RED AT BASE, before any edit of this phase** — so it is INHERITED by construction, not by comparison.
The two failing cases, named from the gate's own persisted JSON report before any re-run:

```
src/components/library/__tests__/sketchComposition.test.tsx
  › sketch-composition fence — §2 positive controls the page renders its heading — the mount harness works
      => Error: STACK_TRACE_ERROR
  › sketch-composition fence — §2 positive controls the four shipped tab triggers render — the tab bar is already built
      => TestingLibraryElementError: Found multiple elements with the role "tab" and name "Documents"
```

268-01 touches no frontend file. Not re-run to "get a green": one sample is recorded as one sample.

## (c) Frontend typecheck (the non-vacuous one)

Command (in `frontend/`): `npx tsc -p tsconfig.app.json --noEmit` → exit 2, **70 errors** (matches
268-RESEARCH's "set diff vs 70").

Error SET (`file:line:code`, sorted):

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
src/lib/api.ts:254:TS2724
src/lib/api.ts:255:TS2305
src/pages/LibraryPage.tsx:50:TS6133
src/pages/LibraryPage.tsx:50:TS6133
src/pages/SettingsPage.test.tsx:83:TS2322
src/pages/SettingsPage.tsx:1349:TS2322
src/pages/SettingsPage.tsx:998:TS2561
src/providers/OrgProvider.test.tsx:23:TS6133
src/providers/OrgProvider.test.tsx:71:TS2741
src/stores/streamsStore.ts:460:TS2345
```

## (d) Wave-0 live-DB measurements (read-only, 268-RESEARCH §Wave 0 Gaps)

Local Postgres `127.0.0.1:54322` accepted connections at base. Queries run once, read-only, before migration 197:

| Query | Value |
|---|---|
| shell roots — `runs WHERE parent_run_id IS NULL AND model='unknown'` | **150** |
| sub-agents under a shell with tokens — `s JOIN p ON p.run_id=s.parent_run_id WHERE p.model='unknown' AND s.input_tokens IS NOT NULL` | **99** |
| sub-agent org mismatches — `s.org_id<>p.org_id` | **0** |
| continued runs — `continues_used>0` | **2** |
| total `runs` rows | 1634 |
| `runs.expert_id` / `runs.expert_attributed` present at base | **none** (migration 197 not yet applied) |

⚠ **99 sub-agent rows with tokens sit under placeholder (`model='unknown'`) roots** — D-268-21's double-count
risk is real on this DB, not hypothetical; 268-02's roll-up must count only the root's own tokens for those.
0 org mismatches: this local DB's sub-agents all share their parent's org today (no two-org sends recorded).

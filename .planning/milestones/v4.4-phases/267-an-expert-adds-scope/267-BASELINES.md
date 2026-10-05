# Phase 267 — Frozen base gates

**Frozen by:** 267-01, Task 1, BEFORE any source edit of this phase.
**Phase base commit:** `785c03274` (develop HEAD at execute start; only planning docs changed since the
research base `92b5476be`).
**Measured:** 2026-09-25, main working tree, no sibling agent.

⛔ Every later plan compares against these SETS, never against a count quoted in prose. Where a figure
differs from `267-RESEARCH.md`, the measured figure below wins and the difference is written down.

## (a) Backend unit gate

Command (in `backend/`, venv):

```
venv/Scripts/python -m pytest tests/unit -q --continue-on-collection-errors -p no:cacheprovider
grep '^FAILED' <output> | sed 's/ - .*//' | sort
```

Verdict line, verbatim:

```
71 failed, 5673 passed, 1 skipped, 2 xfailed, 2 xpassed, 48 warnings in 283.44s (0:04:43)
```

**0 collection errors.** 71 = the CLAUDE.md ceiling (zero headroom). Matches `267-RESEARCH.md` exactly
(71 failed / 5673 passed / 1 skipped / 2 xfailed / 2 xpassed).

Full failed SET (71 ids, sorted — the `FAILED ` prefix and ` - …` reason stripped):

```
tests/unit/test_061_consumer.py::test_xread_advances_last_id
tests/unit/test_071_1_threadpool_sweep.py::test_extract_composable_calls_wrapped_in_threadpool
tests/unit/test_071_1_threadpool_sweep.py::test_no_unwrapped_sync_calls_in_route[async def upload_document(]
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

## (b) Frontend typecheck — error SET

Command (in `frontend/`): `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep "error TS" | sort`

**70 errors** — matches `267-RESEARCH.md` (70). Plan 267-01 touches no frontend file; the set is
frozen here for 267-03/04.

```
src/__tests__/hooks/useDocuments.test.ts(130,7): error TS2322: Type 'Promise<{ isDuplicate: boolean; }>' is not assignable to type 'Promise<void>'.
src/__tests__/hooks/useFolders.test.ts(217,13): error TS6133: 'result' is declared but its value is never read.
src/__tests__/hooks/useMessages.test.ts(161,5): error TS2353: Object literal may only specify known properties, and 'isStreaming' does not exist in type 'StreamsState | Partial<StreamsState> | ((state: StreamsState) => StreamsState | Partial<StreamsState>)'.
src/__tests__/hooks/useMessages.test.ts(227,10): error TS2554: Expected 2-3 arguments, but got 1.
src/__tests__/hooks/useMessages.test.ts(289,11): error TS2554: Expected 2-3 arguments, but got 1.
src/__tests__/hooks/useMessages.test.ts(377,10): error TS2554: Expected 2-3 arguments, but got 1.
src/__tests__/hooks/useMessages.test.ts(423,10): error TS2554: Expected 2-3 arguments, but got 1.
src/__tests__/providers/streamsProvider_state01b_403.test.tsx(23,22): error TS6133: 'waitFor' is declared but its value is never read.
src/__tests__/routing/vercelRouting.test.ts(13,30): error TS2307: Cannot find module 'node:fs' or its corresponding type declarations.
src/__tests__/routing/vercelRouting.test.ts(14,25): error TS2307: Cannot find module 'node:path' or its corresponding type declarations.
src/__tests__/routing/vercelRouting.test.ts(43,34): error TS2304: Cannot find name '__dirname'.
src/components/chat/__tests__/ChatAreaMode.test.tsx(104,8): error TS2322: Type '{ providers: readonly [{ readonly id: "openai"; readonly name: "OpenAI"; readonly models: readonly ["gpt-test"]; readonly is_active: true; }]; selectedProvider: "openai"; models: readonly ["gpt-test"]; selectedModel: "gpt-test"; onSend: () => void; disabled: true; threadId: string; onAgentModeChange: () => void; }' is not assignable to type 'Props'.
src/components/chat/__tests__/ChatAreaMode.test.tsx(140,8): error TS2322: Type '{ providers: readonly [{ readonly id: "openai"; readonly name: "OpenAI"; readonly models: readonly ["gpt-test"]; readonly is_active: true; }]; selectedProvider: "openai"; models: readonly ["gpt-test"]; selectedModel: "gpt-test"; onSend: Mock<...>; disabled: false; workflowLocked: true; onAgentModeChange: () => void; }' is not assignable to type 'Props'.
src/components/chat/__tests__/ChatAreaMode.test.tsx(162,8): error TS2322: Type '{ providers: readonly [{ readonly id: "openai"; readonly name: "OpenAI"; readonly models: readonly ["gpt-test"]; readonly is_active: true; }]; selectedProvider: "openai"; models: readonly ["gpt-test"]; selectedModel: "gpt-test"; onSend: () => void; disabled: false; workflowLocked: false; onAgentModeChange: () => voi...' is not assignable to type 'Props'.
src/components/chat/__tests__/ChatAreaMode.test.tsx(44,8): error TS2322: Type '{ providers: readonly [{ readonly id: "openai"; readonly name: "OpenAI"; readonly models: readonly ["gpt-test"]; readonly is_active: true; }]; selectedProvider: "openai"; models: readonly ["gpt-test"]; selectedModel: "gpt-test"; onSend: () => void; disabled: false; onAgentModeChange: () => void; }' is not assignable to type 'Props'.
src/components/chat/__tests__/MessageInput.connectors.test.tsx(1,26): error TS6133: 'fireEvent' is declared but its value is never read.
src/components/chat/MessageSkeleton.tsx(14,36): error TS2503: Cannot find namespace 'JSX'.
src/components/experts/ExpertAuthoringStudio.tsx(1,41): error TS6133: 'useMemo' is declared but its value is never read.
src/components/experts/ExpertAuthoringStudio.tsx(13,3): error TS6133: 'HelpCircle' is declared but its value is never read.
src/components/experts/ExpertAuthoringStudio.tsx(42,8): error TS6133: 'ExpertGrant' is declared but its value is never read.
src/components/layout/__tests__/ChatLayoutLaunch.test.tsx(173,8): error TS2740: Type '{ onSignOut: Mock<Procedure>; activeView: "workflows"; onNavigate: Mock<Procedure>; prefillMessage: null; onSetPrefillMessage: Mock<Procedure>; }' is missing the following properties from type 'Props': navItems, isOperator, operatorIdentity, studioSkillId, and 5 more.
src/components/layout/NavPanel.test.tsx(87,38): error TS2352: Conversion of type '{ user: { id: string; email: string; user_metadata: { name: string; }; }; }' to type 'UseAuth' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
src/components/library/__tests__/IngestionTab.test.tsx(133,10): error TS6133: 'renderTechnical' is declared but its value is never read.
src/components/library/__tests__/IngestionTab.test.tsx(210,11): error TS6133: 'source' is declared but its value is never read.
src/components/library/__tests__/IngestionTab.test.tsx(228,11): error TS6133: 'addFilesPanel' is declared but its value is never read.
src/components/library/__tests__/IngestionTab.test.tsx(42,3): error TS2741: Property 'user_id' is missing in type '{ id: string; name: string; parent_id: null; is_org_shared: false; created_at: string; updated_at: string; }' but required in type 'Folder'.
src/components/library/__tests__/IngestionTab.test.tsx(43,3): error TS2741: Property 'user_id' is missing in type '{ id: string; name: string; parent_id: null; is_org_shared: false; created_at: string; updated_at: string; }' but required in type 'Folder'.
src/components/library/__tests__/IngestionTab.test.tsx(506,11): error TS6133: 'user' is declared but its value is never read.
src/components/library/__tests__/IngestionTab.test.tsx(512,33): error TS2345: Argument of type 'string' is not assignable to parameter of type 'IngestionStageKey'.
src/components/library/__tests__/sketchComposition.test.tsx(333,15): error TS2739: Type '{ documents: Document[]; }' is missing the following properties from type 'IngestionTabProps': upload, uploading
src/components/library/__tests__/ViewCardGrid.test.tsx(21,46): error TS2554: Expected 0 arguments, but got 1.
src/components/library/__tests__/ViewCardGrid.test.tsx(22,44): error TS2554: Expected 0 arguments, but got 1.
src/components/library/__tests__/ViewCardGrid.test.tsx(82,34): error TS2345: Argument of type '(id: string) => Promise<{ total: number; }>' is not assignable to parameter of type '() => Promise<{ total: number; }>'.
src/components/library/indexing/FoldersIndexTable.tsx(22,7): error TS6133: 'UNKNOWN' is declared but its value is never read.
src/components/metadata/__tests__/CR01.reset.test.tsx(2,16): error TS2307: Cannot find module 'node:fs' or its corresponding type declarations.
src/components/org/OrgExpertsTab.tsx(20,1): error TS6133: 'cn' is declared but its value is never read.
src/components/org/OrgExpertsTab.tsx(4,3): error TS6133: 'Check' is declared but its value is never read.
src/components/org/OrgExpertsTab.tsx(6,3): error TS6133: 'FileCode' is declared but its value is never read.
src/components/panel/__tests__/FilesSection.test.tsx(149,19): error TS2304: Cannot find name 'WorkspaceFile'.
src/components/panel/__tests__/FilesSection.test.tsx(159,19): error TS2304: Cannot find name 'WorkspaceFile'.
src/components/panel/__tests__/FilesSection.test.tsx(168,19): error TS2304: Cannot find name 'WorkspaceFile'.
src/components/panel/FilePreview.test.tsx(33,5): error TS2783: 'path' is specified more than once, so this usage will be overwritten.
src/components/panel/FilePreview.test.tsx(34,5): error TS2783: 'size_bytes' is specified more than once, so this usage will be overwritten.
src/components/panel/FilePreview.test.tsx(35,5): error TS2783: 'mime_type' is specified more than once, so this usage will be overwritten.
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx(106,9): error TS2322: Type '{ open: true; mode: "create"; presetServiceId: string; onClose: () => void; canManage: boolean; }' is not assignable to type 'IntrinsicAttributes & ConnectionFormPanelProps'.
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx(13,1): error TS6133: 'api' is declared but its value is never read.
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx(136,9): error TS2322: Type '{ open: true; mode: "edit"; connection: ConnectorConnection; onClose: () => void; canManage: boolean; }' is not assignable to type 'IntrinsicAttributes & ConnectionFormPanelProps'.
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx(185,9): error TS2322: Type '{ open: true; mode: "edit"; connection: ConnectorConnection; onClose: () => void; canManage: boolean; onCheck: Mock<Procedure>; }' is not assignable to type 'IntrinsicAttributes & ConnectionFormPanelProps'.
src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx(232,9): error TS2322: Type '{ open: true; mode: "edit"; connection: { id: string; service_id: string; name: string; auth_type: "static_key"; account_email: null; capability: "post_message"; config: ConnectorConnectionConfig; ... 13 more ...; updated_at?: string | ... 1 more ... | undefined; }; onClose: () => void; canManage: boolean; onCheck: ...' is not assignable to type 'IntrinsicAttributes & ConnectionFormPanelProps'.
src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx(47,1): error TS6133: 'connectorServiceSource' is declared but its value is never read.
src/components/settings/ConnectionFormPanel.tsx(1036,16): error TS2339: Property 'auth_type' does not exist on type 'ConnectorConnectionCreate'.
src/components/settings/ConnectionFormPanel.tsx(1037,16): error TS2339: Property 'status' does not exist on type 'ConnectorConnectionCreate'.
src/components/settings/ConnectionFormPanel.tsx(1067,48): error TS2339: Property 'auth_type' does not exist on type 'ConnectorConnectionUpdate'.
src/components/settings/ConnectionFormPanel.tsx(1163,9): error TS2322: Type 'ConnectorCapability | "oauth" | null' is not assignable to type 'ConnectorCapability | null'.
src/components/settings/ConnectionFormPanel.tsx(987,11): error TS2353: Object literal may only specify known properties, and 'auth_type' does not exist in type 'ConnectorConnectionCreate'.
src/components/settings/MemorySection.tsx(52,8): error TS2339: Property 'finally' does not exist on type 'PromiseLike<void>'.
src/components/skills/SkillFormDialog.tsx(418,13): error TS2322: Type 'RefObject<HTMLInputElement | null>' is not assignable to type 'RefObject<HTMLInputElement>'.
src/components/skills/SkillFormDialog.tsx(608,11): error TS2322: Type 'RefObject<HTMLInputElement | null>' is not assignable to type 'RefObject<HTMLInputElement>'.
src/components/workflows/WorkflowDoorSwitch.tsx(399,13): error TS2322: Type '((def: BuilderDefinition, draftId: string | null) => void | Promise<void>) | undefined' is not assignable to type '((def: WorkflowDefinitionJSON, draftId: string | null) => void | Promise<void>) | undefined'.
src/lib/api.test.ts(131,5): error TS2322: Type '{ onDelta?: ((text: string) => void) | undefined; onReasoningDelta?: ((text: string) => void) | undefined; onTurnBoundary?: (() => void) | undefined; onDone?: (() => void) | undefined; onTerminal: (kind: "done" | "error" | "cancelled" | "timed_out" | "reader_done", error?: string) => Promise<void> | void; ... 46 mor...' is not assignable to type 'StreamCallbacks'.
src/lib/api.ts(254,3): error TS2724: '"./api/library"' has no exported member named 'IndexSummary'. Did you mean 'getIndexSummary'?
src/lib/api.ts(255,3): error TS2305: Module '"./api/library"' has no exported member 'FolderIndexRow'.
src/pages/LibraryPage.tsx(50,29): error TS6133: 'TabsList' is declared but its value is never read.
src/pages/LibraryPage.tsx(50,39): error TS6133: 'TabsTrigger' is declared but its value is never read.
src/pages/SettingsPage.test.tsx(83,3): error TS2322: Type '{ active_provider: string; llm_model: string; available_models: string[]; providers: ProviderInfo[]; embedding_model: string; embedding_base_url: string; ... 50 more ...; deprecated_models?: string[] | undefined; }' is not assignable to type 'FullAppSettings'.
src/pages/SettingsPage.tsx(1349,60): error TS2322: Type '{ children: Element[]; label: string; tooltip: string; }' is not assignable to type 'IntrinsicAttributes & { label: string; children: ReactNode; }'.
src/pages/SettingsPage.tsx(998,9): error TS2561: Object literal may only specify known properties, but 'web_search_enabled' does not exist in type 'SettingsUpdate'. Did you mean to write 'hybrid_search_enabled'?
src/providers/OrgProvider.test.tsx(23,1): error TS6133: 'ReactNode' is declared but its value is never read.
src/providers/OrgProvider.test.tsx(71,3): error TS2741: Property 'can_manage_sso' is missing in type '{ org_id: string; role: string; can_manage: boolean; can_audit_view: boolean; memberships: OrgMembership[]; }' but required in type 'OrgPermissions'.
src/stores/streamsStore.ts(460,55): error TS2345: Argument of type 'StateCreator<{ bucketsBySurface: Map<string, Map<string, Message[]>>; viewedThreadId: null; streamingThreads: Set<string>; stoppingThreads: Set<string>; stopNotConfirmed: Set<...>; ... 13 more ...; actions: { ...; }; }, [], [...]>' is not assignable to parameter of type 'StateCreator<StreamsState, [], [["zustand/subscribeWithSelector", never]]>'.
```

## (c) Vitest count gate

Command (repo root): `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`

Verdict lines, verbatim:

```
total 8828  ·  failed 0  ·  pinned total 8075
count gate OK — 327/327 pinned files present, no per-file decrease, 0 failing.
```

Exit `0`. ⚠ **DIFFERS from `267-RESEARCH.md`**, which measured `total 8828 · failed 3 · pinned total 8075`
(exit 1) with 3 reds from `src/pages/WorkflowBuilderPage.canvas.test.tsx` ×1 (a SEED-171 named flake) and
`src/components/library/__tests__/sketchComposition.test.tsx` ×2. This run read **failed 0**, so there
were no failing file names to capture from the gate's JSON. Same totals (8828 / 8075), same tree
(frontend diff empty). Recorded as an observation: those reds are flaky, and one green sample proves
nothing about them. Pinned files at this base: **327/327**.

## (d) Closed core

Command (in `backend/`): `pytest tests/unit/test_259_closed_core_inventory.py tests/unit/test_255_extension_contract_guard.py -q`

Verdict line: `13 passed, 1 warning in 0.63s`

Registry counts, imported and counted: **7 phase types / 1 emitter / 29 tools / 2 programmatic** —
`len(PHASE_TYPE_REGISTRY_ENTRIES) == 7`, `len(EMITTER_REGISTRY) == 1`, `len(_TOOL_REGISTRY) == 29`,
`len(PROGRAMMATIC_PHASE_REGISTRY) == 2`. Matches `267-RESEARCH.md`.

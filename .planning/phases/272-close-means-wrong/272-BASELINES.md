# Phase 272 — Frozen base gates

**Frozen by:** 272-01, Task 1 step (0), BEFORE any source edit of this phase.
**PHASE_BASE:** `f49d9ea2d354a42d66eb007de9d9ca6a451afe81` (`f49d9ea2d`, "docs(272): finalize plans after checker round 2; record planned state").
**Measured:** 2026-10-03, in the 272-01 worktree (`.claude/worktrees/agent-aa5c4a1ac07838b9d`), bootstrapped,
HEAD reset to PHASE_BASE (the worktree had started on `master`'s `86d9559bb`, the known
agent-worktree-starts-on-the-default-branch quirk).
⚠ Sibling wave-1 agent 272-02 was running in its own worktree during these measurements.

⛔ Every later plan compares against these SETS, never against a count quoted in prose.
⛔ No frontend figures here — 272-02 records its own in its SUMMARY.

## (a) Backend unit gate

Command (in `backend/`, venv): `node ../scripts/check-backend-unit-baseline.cjs`
(wraps `pytest tests/unit -q --continue-on-collection-errors`; the failed SET below is every
`FAILED` line of its output). Verbatim:

```
71 failed, 6246 passed, 1 skipped, 2 xfailed, 2 xpassed, 46 warnings in 531.03s (0:08:51)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

**0 collection errors.** 71 = the CLAUDE.md ceiling (zero headroom). The SET is **identical** to
271-BASELINES.md's frozen 71 (measured with `diff`, not eyeballed); passed grew 6092 → 6246 with
271's landing.

⚠ One `FAILED` line in the raw output had a `RuntimeWarning` from another test interleaved onto it
(`…test_returns_empty_list_when_rpc_data_is_none` immediately followed by
`C:\…\_pytest\unraisableexception.py:33: RuntimeWarning: coroutine 'handle_query_tables' was never
awaited` on the same line). The node id below is the cleaned one; a later plan that greps the raw
output must strip it the same way or it will read a phantom "new" id.

Full failed SET (71 node ids):

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

⚠ **All 15 cases of `tests/unit/test_retrieval_service.py` are in this set** — the file 272-01
retargets. They are red at the base for a pre-existing reason; the retarget must keep them in this
SET (no new id), and cannot be read as making them pass.

## (b) Top-level suites the gate never runs

Each run alone, in `backend/`, venv, `-q -p no:cacheprovider -rf`.

| Suite | Result at PHASE_BASE (verbatim) |
|---|---|
| `tests/test_098_scope_governance.py` | `1 failed, 5 passed, 1 warning in 1.09s` — FAILED `test_run_start_resolution` (`ValueError: get_service_role_supabase requires an explicit org_id`) |
| `tests/test_2171_search_error_audit.py` | `5 passed, 1 warning in 0.33s` |
| `tests/test_096_ci_workflow_regression.py` | **HANGS — all 5 cases.** Each run alone with `--timeout=60`, each times out: `test_096_ci_workflow_regression_happy_path`, `test_096_gate_retry_bounded`, `test_096_whitelist_refusal`, `test_099_snapshot_routing_live_chain`, `test_096_resume_two_phase_writes`. The stack at timeout is `run_lifecycle._watch` → `is_run_cancelled` → `logger.exception("is_run_cancelled: registry read failed for run %s", …)`: the cancel-watch loop spinning on a failing registry read. A whole-file run with no timeout was killed by hand after >15 minutes. |
| `tests/test_147_flag_refuse.py` | `8 passed, 1 warning in 0.37s` |
| `tests/test_harness_whitelist.py` | `12 passed, 1 warning in 0.28s` |

⛔ **test_096 is RED (hung) at the base, before any edit of this phase.** It is evidence neither way
for this phase; a later plan establishes inherited-vs-new by re-running it at PHASE_BASE, never by
matching this row.

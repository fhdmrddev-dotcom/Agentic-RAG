# Phase 274 — Baselines

## PHASE_BASE

`PHASE_BASE = 75cd73782d8651d7d976d287e40d6c6802a2dc95` (develop HEAD at dispatch, `docs(274): state — begin execution`).

## Backend unit gate at base (recorded by 274-01, Task 1 step 0)

Command (in `backend/`, venv): `pytest tests/unit -q --continue-on-collection-errors -rf -p no:cacheprovider`
(the canonical baseline command plus `-rf`, so the failing SET is captured rather than a count).
Run under the local-DB lock.

Verdict line, verbatim:

```
73 failed, 6782 passed, 1 skipped, 2 xfailed, 2 xpassed, 46 warnings in 375.68s (0:06:15)
```

⚠ **73 is NOT the base figure, and the two extra ids are named rather than absorbed.** The base run
was started on the untouched tree and ran for six minutes; 274-01's Task 1 GREEN edits to
`backend/app/api/workspace.py` and the regenerated `docs/public/api/openapi.*.json` landed in the
worktree while it was still running. Two tests read those files at TEST time (not collection time),
so they observed a half-edited tree:

| id | why it read red | at HEAD |
|---|---|---|
| `test_244_08_expired_attachment_is_a_tombstone.py::test_the_content_route_is_not_widened` | reads `workspace.py` source at test time | green (targeted run, Task 1 verify) |
| `test_276_openapi_snapshot_fresh.py::test_committed_openapi_snapshot_matches_the_code` | compares the in-memory app (imported pre-edit) with the snapshot file regenerated mid-run | green (targeted run, Task 1 verify) |

Removing those two leaves **71 failed** — identical to the operator's independent re-measurement of
develop on 2026-10-05 (`71 failed / 6784 passed`; `6782 + 2 = 6784`). That agreement is what makes
the subtraction evidence rather than convenience. Ceiling: **71, zero headroom.**

### Base failed SET (71, sorted)

Ids are the first token of each `FAILED` line in `-rf` output; two ids are truncated by the
reporter (a parametrize id containing a space, and an id whose line was interleaved with stderr) and
are kept in that truncated form, because every later gate in this phase extracts ids the same way
and diffs SETS, never counts.

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

(The `explorer_prompt` id is shown here with the stderr fragment `C:\Vibe` removed that the raw
extraction appended to it.)

## Backend unit gate after 274-01 Task 2 (full run, under the local-DB lock)

Verdict line, verbatim:

```
71 failed, 6814 passed, 1 skipped, 2 xfailed, 2 xpassed, 48 warnings in 333.83s (0:05:33)
```

Failed SET diffed against the base SET above (`comm` on sorted id lists, extracted the same way):
**identical — 0 ids added, 0 removed.** The only textual difference was the stderr fragment on the
`explorer_prompt` id in the base capture. Passed `6784 (de-contaminated base) → 6814` = **+30**,
exactly the three new 274 suites (9 + 13 + 8 cases; the two retired 244 cases were rewritten in
place, so their count is unchanged). Ceiling 71 held, zero headroom used.

## Migration 203 (274-01 Task 3)

**Applied by:** Claude (274-01 executor), 2026-10-05, against LOCAL Postgres
`127.0.0.1:54322` (TCP probe: open), by executing the migration file's text through the backend
venv's asyncpg from a throwaway script in the session scratchpad (outside the repo). Never
`supabase db push` / `db reset`. Run under the local-DB lock.

**Run 1:** `APPLIED OK` · **Run 2 (idempotency):** `APPLIED OK`

**VERIFY block, every row:**

```
COL ('library_document_id', 'uuid', 'YES')
COL ('library_link', 'text', 'YES')
CON ('workspace_files_library_document_id_fkey', 'FOREIGN KEY (library_document_id) REFERENCES documents(id) ON DELETE SET NULL')
CON ('workspace_files_library_link_check', "CHECK (((library_link IS NULL) OR (library_link = ANY (ARRAY['saved'::text, 'already'::text]))))")
IDX CREATE INDEX idx_workspace_files_library_document_id ON public.workspace_files USING btree (library_document_id) WHERE (library_document_id IS NOT NULL)
RLS True
```

**Grants / RLS before = after:** `information_schema.role_table_grants` for `public.workspace_files`
(28 rows: anon / authenticated / postgres / service_role × DELETE, INSERT, REFERENCES, SELECT,
TRIGGER, TRUNCATE, UPDATE) and `relrowsecurity = true` captured before the first apply and again
after the second; `diff` → **identical**. 203 added no grant and changed no RLS.
⚠ Observation, not introduced by 203: `anon` holds every table privilege on `workspace_files`
locally (the Supabase default); RLS on the table is what fences it. Recorded so a future
`get_advisors(security)` reading is not mistaken for a 203 regression.

**FK proof (inside a transaction that was ROLLED BACK):** borrowed workspace_files row
`888256c3-…`; inserted scratch document `369a3af1-…` (required columns copied from an existing
row); marked the attachment `library_document_id = <scratch>, library_link = 'saved'`;
`DELETE FROM public.documents WHERE id = <scratch>` → `DELETE 1` (**succeeded**); the attachment
then read `(library_document_id = NULL, library_link = 'saved')` — the D-28 no-pairing-CHECK
property: the document delete is never blocked. `UPDATE … SET library_link = 'bogus'` →
`CheckViolationError` on **`workspace_files_library_link_check`**. `ROLLED BACK`; re-read afterwards:
the borrowed row is `(NULL, NULL)`, the scratch document does not exist, and zero
`workspace_files` rows carry either column.

**full-schema.sql regeneration — NOT DONE BY CLAUDE (handed to the operator).**
`bash scripts/regenerate-full-schema.sh` (no `--reset`) exits at its preflight with
`Error: Supabase is not running locally.` — because `supabase status` run from this WORKTREE
resolves the project id from the directory name and looks for
`supabase_db_agent-a27b8e8db6c5ae436`, which does not exist. Past that preflight the script needs
`docker exec … pg_dump`, and direct `docker` commands are permission-denied for this agent; working
around that through the script would be evading the denial, so it was not attempted.
`full-schema.sql` was not hand-edited.

**get_advisors(security):** the Supabase MCP tools are not available to this executor — **OWED**.

### OWED

1. **Operator:** from the MAIN repo root (not a worktree), after 274-01 merges:
   `bash scripts/regenerate-full-schema.sh` (no `--reset`), then commit `supabase/full-schema.sql`;
   any unrelated drift in that diff must be named, not silently committed.
2. **Production:** apply migration **202 first, then 203**, BEFORE the backend that reads these
   columns deploys (plan 274-02's promote route).
3. **Post-apply `get_advisors(security)`** on production (read-only) — the pre-deploy baseline is
   also owed, since no MCP access existed here.
4. **Pre-274 orphaned bucket bytes** — attachment bytes of threads deleted BEFORE this phase stay in
   the `workspace-files` bucket. Observation, out of scope: a sweep would be a service-role job and
   its own operator decision.

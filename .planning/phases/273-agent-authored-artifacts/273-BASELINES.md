# Phase 273 — Frozen base gates

**Frozen by:** 273-01, Task 1 step (0), BEFORE any source edit of this phase.
**PHASE_BASE:** `f764734979c25696544b2408232f4fbdc779ae5f` (`f76473497`, "docs(273): create phase plan").
**Measured:** 2026-10-03, in the 273-01 worktree (`.claude/worktrees/agent-a87f17bd19bab31c0`), bootstrapped,
HEAD reset to PHASE_BASE (the worktree had started on `master`'s `86d9559bb`, the known
agent-worktree-starts-on-the-default-branch quirk).
⚠ Sibling wave-1 agent 273-02 (frontend only) was running in its own worktree during this measurement.

⛔ Every later plan compares against this SET, never against a count quoted in prose.
⛔ No frontend figures here — 273-02 records its own in its SUMMARY.

## (a) Backend unit gate

Command (in `backend/`, venv): `node ../scripts/check-backend-unit-baseline.cjs`
(wraps `pytest tests/unit -q --continue-on-collection-errors`). Verbatim:

```
71 failed, 6474 passed, 1 skipped, 2 xfailed, 2 xpassed, 46 warnings in 558.02s (0:09:18)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

**0 collection errors.** 71 = the CLAUDE.md ceiling (zero headroom). The SET below is **identical**
to 272-BASELINES.md's frozen 71 — measured with `diff` over the two sorted sets (it printed
nothing), not eyeballed. passed grew 6246 → 6474 with 272's landing.

⚠ The raw output again carried a `RuntimeWarning` interleaved onto one `FAILED` line
(`…TestSearchDocuments::test_returns_multiple_results` immediately followed by
`C:\…\_pytest\unraisableexception.py:33: RuntimeWarning: coroutine 'handle_query_tables' was never
awaited`). **The interleaved id MOVED** — at 272 it was `…test_returns_empty_list_when_rpc_data_is_none`
— so a later plan cannot clean it by matching a known id. The SET was extracted with
`grep "^FAILED " | sed -E 's/^FAILED //; s/ - .*$//; s/C:.*$//' | sort -u`; clean the same way or a
phantom "new" id appears.

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

⚠ `tests/unit/test_db_runs.py`'s three red cases are the inherited failures RESEARCH named as one
reason migration 202 is a new table rather than a column on `messages`.

## Migration 202

**Applied by:** Claude (273-01 executor), 2026-10-03, to the LIVE LOCAL DB only
(`postgresql://postgres:postgres@127.0.0.1:54322/postgres`, TCP-probed OPEN first), by executing the
migration file's text through the backend venv's asyncpg from a throwaway script in the session
scratchpad (psql is not installed; this is the direct-SQL equivalent of the SQL editor). Never
`supabase db push` / `db reset`. **Production is untouched** (see OWED below).

⚠ **The first apply found a real defect, and the migration was fixed before this evidence was taken.**
The first VERIFY read `*** FAIL ***   service_role cannot UPDATE`: Supabase's default privileges give
`service_role` ALL on a new public table, and `GRANT SELECT, INSERT, DELETE … TO service_role` adds
privileges without removing any — so D-08's "no UPDATE to any role" was false while every statement
in the file read correctly. Fix: `REVOKE ALL ON TABLE public.message_artifacts FROM service_role;`
before the grant (mirrored in the supplement; pinned by
`test_service_role_default_all_is_revoked_before_its_grant`). The fixed file was then applied again,
twice. Every row below is from that second run.

### Apply — run twice (idempotency)

```
== APPLY run 1
   ok
== APPLY run 2 (idempotency)
   ok
```

### VERIFY block (verbatim)

```
   PASS           RLS enabled on message_artifacts
   PASS           exactly one policy on message_artifacts
   PASS           the one policy is SELECT
   PASS           anon cannot SELECT
   PASS           authenticated can SELECT
   PASS           authenticated cannot INSERT
   PASS           authenticated cannot UPDATE
   PASS           service_role cannot UPDATE
   PASS           immutability trigger present
   PASS           org autofill trigger present
   PASS           trigger body carries the FK-upkeep exemption
   PASS           anon cannot exec the trigger function
```

### RLS proof (one transaction, ROLLED BACK)

User A = `d8a54002-6a29-4b88-b918-cff2aa4a06d5` (owner of the newest thread
`b08a732f-…`, a member of its org `22f9c615-…`); user B = `00000000-0000-0000-0000-000000000001`.
A fixture row was inserted as `postgres` for A in A's thread with `org_id` omitted.

```
   inserted fixture as postgres; autofill org_id = 22f9c615-0eec-440a-8804-ed4784d6f57f (thread org 22f9c615-0eec-440a-8804-ed4784d6f57f)
   anon SELECT -> DENIED: InsufficientPrivilegeError: permission denied for table message_artifacts
   user A SELECT fixture -> 1 row(s)
   user B SELECT fixture -> 0 row(s)
   user B SELECT A's thread -> 0 row(s)
   user A UPDATE -> DENIED: InsufficientPrivilegeError: permission denied for table message_artifacts
   user A DELETE -> DENIED: InsufficientPrivilegeError: permission denied for table message_artifacts
   user A INSERT -> DENIED: InsufficientPrivilegeError: permission denied for table message_artifacts
   role after write probes = postgres
   postgres UPDATE spec -> RAISED: InsufficientPrivilegeError: message_artifacts rows are immutable once shown (D-08)
   after rollback, fixture rows = 0
```

(`authenticated` = `SET LOCAL ROLE authenticated` + both JWT-claim GUC forms, `request.jwt.claims`
and `request.jwt.claim.sub`.)

### FK-upkeep proof (D-08 exemption; each in a transaction ROLLED BACK)

Setup each time: a scratch thread for A, a `runs` row in it, a root artifact and a child artifact
(`parent_id` = root), both with that `run_id`.

```
== FK-upkeep proof 1: thread delete over root + child with run_id set (rolled back)
   DELETE thread -> SUCCEEDED
   artifact rows left for the scratch thread = 0
== FK-upkeep proof 2: direct runs delete, then hand-written updates (rolled back)
   DELETE runs row -> SUCCEEDED
   a_fkchild001: run_id=None
   a_fkroot0001: run_id=None
   spec / label / caption unchanged = True
   UPDATE SET spec = '{}' -> RAISED: InsufficientPrivilegeError: message_artifacts rows are immutable once shown (D-08)
   UPDATE SET run_id = gen_random_uuid() -> RAISED: InsufficientPrivilegeError: message_artifacts rows are immutable once shown (D-08)
   UPDATE SET run_id = <an EXISTING scratch run> (NULL -> value) -> RAISED: InsufficientPrivilegeError: message_artifacts rows are immutable once shown (D-08)
   UPDATE SET label = 'chart 9' -> RAISED: InsufficientPrivilegeError: message_artifacts rows are immutable once shown (D-08)
   UPDATE SET parent_id = 'a_fkchild001' on root (NULL -> value) -> RAISED: InsufficientPrivilegeError: message_artifacts rows are immutable once shown (D-08)
   UPDATE SET parent_id = NULL on child (accepted width) -> ALLOWED
   after rollback, scratch artifact rows = 0
== total message_artifacts rows now: 0
```

The NULL→value `run_id` probe used a run that EXISTS, so the raise is the trigger's and not the FK's.
`SET parent_id = NULL` by hand is allowed — indistinguishable from FK upkeep, changes no content; this
is the recorded accepted width of the exemption.

### db/artifacts.py driven live (scratch thread, then deleted; its artifacts cascaded)

Five CONCURRENT `insert_artifact` calls (3 charts, 2 tables) on one pool:

```
labels: ['chart 1', 'chart 2', 'chart 3', 'table 1', 'table 2']
org stamped: True
row is json-safe: True
spec round-trips as dict: True dict
keys: ['caption', 'component', 'created_at', 'id', 'label', 'org_id', 'parent_id', 'row_count', 'run_id', 'spec', 'spec_version', 'thread_id', 'tool_call_id', 'user_id']
by label 'Chart 2' -> chart 2
by id -> True
other user, same thread -> None
labels in order: ['chart 1', 'chart 2', 'table 1', 'table 2', 'chart 3']
child label/parent: chart 4 True
after scratch-thread delete, artifact rows left: 0
```

The returned keys equal `ARTIFACT_RECORD_KEYS` (the wire contract, 14 keys).

### full-schema.sql — NOT regenerated by Claude (OWED to the operator)

`bash scripts/regenerate-full-schema.sh` could not run from this agent: the script needs
`docker exec … pg_dump` and Docker is permission-denied for agents on this box (no local
`pg_dump`/`psql` either). In the worktree its `supabase status` pre-check also fails, because there
is no `supabase/config.toml` and the CLI derives the project id from the directory name
(`supabase_db_agent-a87f17bd19bab31c0` does not exist). **Run it from the MAIN checkout AFTER this
branch is merged** — the supplement lines it appends live on this branch, so a regeneration before
the merge would append the OLD supplement. Until then `check-schema-acl-parity.cjs` reports the
artifact-tail divergence (tuples: `mirrored: 203/203`).

### OWED — production

Migration 202 to production **BEFORE** the backend that writes `message_artifacts` deploys, then
`get_advisors(security)`. A deploy-parity item, not this phase.

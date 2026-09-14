---
type: gate-baseline
phase: 248
captured: 2026-09-14
captured_by: claude (REVIEWER — per AGENTS.md §6.3, baselines taken BEFORE the builder starts)
base_commit: 415f57f8e0f13608b38043b7d2a1b705e971b8f1
tree_state: clean of source changes (only .planning/ docs and .agent-bus/ differ from the phase base)
---

# Phase 248 — gate baselines, captured before Gemini touched anything

⚠ **A baseline taken after the builder starts measures the change against itself.** These were
captured at `415f57f8e`, before any 248 source edit exists.

⛔ **THE RULE THAT MAKES THESE USABLE: compare SETS, never counts.** A count that matches can hide a
swap; a count that differs by one is usually the known flake below, not a regression.

---

## 1 · Backend — `pytest tests/unit -q --continue-on-collection-errors`

**Three runs on a byte-identical tree: `72` → `71` → `72`.**

⭐ **This is `SEED-274` reproducing exactly, and the phase now has the SET it asked for**, rather
than the ceiling of "71 with zero headroom" that `CLAUDE.md` still publishes:

| | |
|---|---|
| Stable core (failed in **both** fully-captured runs) | **71 tests** |
| Union across runs | **72 tests** |
| **Flaky — flipped between runs** | **exactly ONE:** `tests/unit/test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments` |

**The gate for Phase 248, stated as a set with a flake band:**

- **`71` or `72` failing is BASELINE-CLEAN**, provided every name is in the union below.
- ⛔ **Any name NOT in the union BLOCKS**, at any count — including a run that reports `71`.
- A run reporting `70` is not a win to be claimed silently: a test that stopped failing must be
  named, because a *deleted* test also stops failing.

⚠ `CLAUDE.md`'s "**71 … zero headroom**" is therefore measurably wrong in both directions — it is
neither a floor nor a ceiling, and a builder who reads `72` and assumes they broke something will
chase a defect that is not theirs. Do not weaken it without operator authorisation; do read it
alongside `SEED-274`.

### The 72-name union

- `tests/unit/test_061_consumer.py::test_xread_advances_last_id`
- `tests/unit/test_071_1_threadpool_sweep.py::test_extract_composable_calls_wrapped_in_threadpool`
- `tests/unit/test_071_1_threadpool_sweep.py::test_no_unwrapped_sync_calls_in_route[async`
- `tests/unit/test_075_4_unknown_provider_error.py::test_known_providers_includes_all_five_providers`
- `tests/unit/test_111_1_reembed_kickoff.py::test_dims_only_change_kicks_reembed`
- `tests/unit/test_111_1_reembed_kickoff.py::test_model_change_kicks_reembed`
- `tests/unit/test_111_1_reembed_kickoff.py::test_model_only_change_kicks_without_resize`
- `tests/unit/test_111_1_reembed_kickoff.py::test_no_change_save_does_not_reembed`
- `tests/unit/test_182_validate.py::test_interactive_phase_verdict_is_incomplete_and_per_node`
- `tests/unit/test_190_review_fix_data_layer.py::test_CR01_the_projection_names_every_safe_column_and_never_the_secret`
- `tests/unit/test_200_1_phase_output_shape.py::test_this_plan_wrote_no_migration`
- `tests/unit/test_chat_tool_approval.py::test_tool_approval_ask_emits_event_and_pauses`
- `tests/unit/test_cross_worker_cancellation.py::test_a_late_producer_finalize_may_not_write_failed_over_a_cancel`
- `tests/unit/test_cross_worker_cancellation.py::test_the_registry_read_only_ever_turns_failed_into_cancelled`
- `tests/unit/test_db_runs.py::test_insert_assistant_message_optional_fields_none`
- `tests/unit/test_db_runs.py::test_insert_assistant_message_sql_shape`
- `tests/unit/test_db_runs.py::test_insert_run_passes_args_positionally`
- `tests/unit/test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments`
- `tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_default_mode_uses_default_prompt`
- `tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_default_mode_uses_default_tools`
- `tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explicit_default_mode_same_as_omitted`
- `tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_prompt`
- `tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_tools`
- `tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_max_iterations_8`
- `tests/unit/test_extraction_service.py::test_legacy_extractor_docx_matches_golden`
- `tests/unit/test_extraction_service.py::test_legacy_extractor_pdf_matches_golden`
- `tests/unit/test_forced_emit.py::test_forced_emit_judge_verdict_unmocked`
- `tests/unit/test_get_model_capability_inference.py::test_infer_openai_from_gpt_prefix`
- `tests/unit/test_lifespan.py::test_pg_pool_close_timeout_falls_back_to_terminate`
- `tests/unit/test_lifespan.py::test_pg_pool_closes_before_supabase`
- `tests/unit/test_lifespan.py::test_supabase_aclose_after_pg_pool`
- `tests/unit/test_module7_tools.py::TestGetTools::test_returns_base_tools_without_tavily_or_sandbox`
- `tests/unit/test_module7_tools.py::TestGetTools::test_returns_one_more_tool_with_tavily`
- `tests/unit/test_multimodal_query.py::test_image_chunk_insertion`
- `tests/unit/test_multimodal_query.py::test_query_tables_column_filter`
- `tests/unit/test_multimodal_query.py::test_query_tables_document_not_found`
- `tests/unit/test_multimodal_query.py::test_query_tables_returns_data`
- `tests/unit/test_multimodal_query.py::test_query_tables_row_cap`
- `tests/unit/test_per_format_ingestion.py::test_every_allowed_mime_type_has_a_case_or_a_named_alias`
- `tests/unit/test_phase56_iteration_start.py::TestIterationStartInProductionSource::test_threads_py_emits_iteration_start_at_loop_top`
- `tests/unit/test_published_workflow_ownership.py::test_published_workflow_field_set_excludes_created_by`
- `tests/unit/test_retrieval_service.py::TestEnrichWithFilenamesPhase28::test_enrich_with_filenames_defaults_version_number_to_1`
- `tests/unit/test_retrieval_service.py::TestEnrichWithFilenamesPhase28::test_enrich_with_filenames_includes_version_number`
- `tests/unit/test_retrieval_service.py::TestSearchDocuments::test_calls_embed_texts_with_query`
- `tests/unit/test_retrieval_service.py::TestSearchDocuments::test_calls_supabase_rpc_match_document_chunks`
- `tests/unit/test_retrieval_service.py::TestSearchDocuments::test_joins_results_with_documents_table`
- `tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_empty_list_when_no_chunks_match`
- `tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_empty_list_when_rpc_data_is_none`
- `tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_formatted_results`
- `tests/unit/test_retrieval_service.py::TestSearchDocuments::test_returns_multiple_results`
- `tests/unit/test_retrieval_service.py::TestSearchDocuments::test_uses_unknown_filename_when_doc_not_found`
- `tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_chunk_index_none_when_missing`
- `tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_hybrid_empty_returns_tuple`
- `tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_avg_similarity_as_second_value`
- `tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_chunk_index_in_enriched_results`
- `tests/unit/test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_zero_avg_sim_when_no_results`
- `tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_empty_output`
- `tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_storage_path_format`
- `tests/unit/test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_uploads_and_inserts`
- `tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_markdown_table_has_header_and_separator`
- `tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_json_for_large_results`
- `tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_markdown_table_for_small_results`
- `tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_no_results_string_when_data_is_none`
- `tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_returns_no_results_string_when_empty`
- `tests/unit/test_sql_service.py::TestQueryDocumentsOutput::test_truncates_to_20_rows_with_note`
- `tests/unit/test_sql_service.py::TestQueryDocumentsRpcCall::test_calls_query_user_documents_rpc`
- `tests/unit/test_sql_service.py::TestQueryDocumentsRpcCall::test_raises_runtime_error_on_rpc_exception`
- `tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_insert_query`
- `tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_non_select_query`
- `tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_query_with_semicolon`
- `tests/unit/test_sql_service.py::TestQueryDocumentsValidation::test_rejects_update_query`
- `tests/unit/test_streaming_reliability.py::TestAsyncioShield::test_persist_assistant_message_is_sync`

---

## 2 · Frontend — `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`

**The gate is RED at baseline, and it is not the builder's fault.**

```
total 8297  ·  failed 3  ·  pinned total 7493
RESULT: COUNT GATE VIOLATED (1 reason)
  FAIL  [failing-tests] 3 test(s) failed — the gate requires 0.
```

⛔ **`count gate OK` is therefore NOT a reachable acceptance criterion for Phase 248.** A plan whose
must-have is *"the gate is green"* has written a criterion that cannot pass for reasons no plan
controls. Pair it with per-file deltas and the explicitly-run in-scope suites, which are
deterministic.

**The three failing tests, captured from the gate's own persisted JSON BEFORE any re-run** — the
rule exists because `192.2-02` recorded itself breaking it and could then not prove its cases were
innocent:

| File | Failing test |
|---|---|
| `src/pages/WorkflowBuilderPage.session.test.tsx` | *"every dismissal commits and none of them PATCHes pane click — the pending value is in the definition and the DISMISSAL ITSELF issues no PATCH (WR-11)"* |
| `src/components/library/__tests__/sketchComposition.test.tsx` | *"§2 positive controls — the page renders its heading — the mount harness works"* |
| `src/components/library/__tests__/sketchComposition.test.tsx` | *"§2 positive controls — the four shipped tab triggers render — the tab bar is already built"* |

**Why these are provably not 248's:** the tree at capture contains **zero** frontend source changes
from the phase base — only `.planning/` documents and `.agent-bus/OPEN.md` differ.

⭐ **`WorkflowBuilderPage.session.test.tsx` is one of `SEED-171`'s named five** — the suites that
flake independently of `GSD_VITEST_MAX_WORKERS`. ⛔ **Do NOT reach for the cap when this reds**; that
causal claim was measured and REFUTED in Phase 195.

⚠ **`sketchComposition.test.tsx` is NOT in SEED-171's named five, and both of its failures are its
own POSITIVE CONTROLS** — *"the mount harness works"*, *"the tab bar is already built"*. That is the
`196-05` signature (a suite failing its own positive control on a tree whose diff could not have
caused it), and it means the suite is asserting something about a mount that is no longer true, or
it is a sixth flaky suite. **Either way it is INHERITED, not 248's** — but it should be named in the
verdict rather than absorbed silently, and it is a candidate for SEED-171's list.

⚠ **One green sample of a flaky suite is not proof of innocence.** If any of these three is green on
a later run, say *"provably unmodified"*, never *"fine"*.

---

## 3 · Two more standing reds that are invisible to the numbers above

- **`src/components/sources/sourceComposition.test.tsx`** sits in NEITHER count-gate knob by a Phase
  235 decision — pinning a red suite turns the shared gate red, and pinning it with an allowance
  makes a gate that cannot fail. It last measured `18 failed | 31 passed`. It does not appear in the
  verdict line above, which is exactly why it is named here.
- **`npx tsc --noEmit` in `frontend/` type-checks ZERO files** — `tsconfig.json` is solution-style
  (`{"files": [], "references": [...]}`), so it exits 0 over anything. ⛔ Use
  `npx tsc -p tsconfig.app.json --noEmit` and measure a **set diff**; the app config reported **67
  errors at base** when last measured, so "zero errors" is not a reachable criterion either.

---

## 4 · How to use this file

1. **Before** claiming a gate result, re-run the command and diff the **set** against the tables above.
2. A new name — backend or frontend — is a finding. A changed **count** with an unchanged **set** is not.
3. Re-derive rather than quote: `git log` proves this file was written at `415f57f8e`, and this
   project's own repeated finding is that a figure written at a close goes stale on the next commit.

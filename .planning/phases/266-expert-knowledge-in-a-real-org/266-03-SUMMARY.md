---
phase: 266-expert-knowledge-in-a-real-org
plan: 03
subsystem: experts / install
tags: [experts, install, ingest, tenancy, rls, PACK-18, PACK-19, tdd]
requires:
  - "266-01: expert_installs + the six install queries in app/db/experts.py"
  - "266-02: expert_corpus.load_corpus / has_corpus; org-scoped mint_document_row"
provides:
  - "backend/app/services/expert_install_service.py: install_expert, derive_install_state, overlay_install_state, list_install_summaries, ExpertInstallState, ExpertInstallResult, ExpertInstallSummary, ExpertNotInstallable, ExpertInstallConflict, ExpertInstallFolderNotOwned"
  - "POST /experts/{bundle_id}/install (202, ExpertInstallResult)"
  - "GET /experts/installs (200, list[ExpertInstallSummary]), declared before /{bundle_id}"
  - "GET /experts and GET /experts/{id} carry `install` on every first-party row, with knowledge_folder_ids replaced by the org's install folder"
affects: [266-04, 266-05]
tech-stack:
  added: []
  patterns:
    - "readiness derived at read time from the documents, never stored twice"
    - "patch at the installer's import site (experts_db, ingest_splice.async_mint_document_row, _enqueue_or_splice)"
    - "in-memory Supabase recorder that returns per-table data, so asserted payloads are exactly what the code built"
key-files:
  created:
    - backend/app/services/expert_install_service.py
    - backend/tests/unit/test_266_install_service.py
    - backend/tests/unit/test_266_install_idempotency.py
    - backend/tests/unit/test_266_install_state.py
    - backend/tests/unit/test_266_install_route_gates.py
  modified:
    - backend/app/api/experts.py
    - backend/tests/unit/test_259_expert_entitlement_gate.py
decisions:
  - "The service's install_expert is imported into api/experts.py as install_expert_service, because the route function keeps the name install_expert"
  - "A failed copy step reports `failed` even before its folder exists; a stale `installing` claim with no folder reports failed(retry). Only an INSTALLED row whose folder is gone reads not_installed"
  - "EXPERT_INSTALL_FOLDER_RECREATED fires on a stale folder id OR a re-claim (created_at != updated_at), because the FK's ON DELETE SET NULL means a deleted folder usually arrives as NULL, not as a stale id"
  - "The management list arm overlays with can_install=True (its manage gate already answered); the member arm asks experts:manage only when a first-party row is present"
metrics:
  duration: ~75 min
  completed: 2026-09-24
  tasks: 3
  files: 7
---

# Phase 266 Plan 03: The install action Summary

An org admin on an entitled tier can now install a first-party Expert into their active org. `POST /experts/{id}/install` claims the install (race-safe), creates or reuses an org-shared Library folder with the caller's user-JWT client, and copies each corpus file through `async_mint_document_row(org_id=<active org>)` → `_enqueue_or_splice`. That is the one ingest path. Re-installing restores what is missing and never overwrites. Every Expert read (`GET /experts`, `GET /experts/{id}`) now reports the org's install state. That state is derived from the documents' own status, and `knowledge_folder_ids` is replaced by the org's own install folder.

## Tasks

| # | Task | RED | GREEN |
|---|------|-----|-------|
| 1 | install_expert: claim, folder, per-file mint/enqueue, re-drive, recreate | `622c58664` | `d7e7576e6` |
| 2 | Derived install state + list/get overlay + install summaries | `cdd590bbd` | `114074c84` |
| 3 | Routes: POST install, GET installs, overlay on list/get | `444c68b95` | `e025dbc3e` |

## Task 1: evidence

**RED:** both files failed at collection with `ImportError: cannot import name 'expert_install_service' from 'app.services'`.

**GREEN:** `17 passed`.

The two suites prove the following:
- A fresh install writes exactly one folder. The payload is `{user_id: caller, org_id: str(ORG), name: "Financial Reports & Filings", parent_id: None, is_org_shared: True}` and it goes through the user client.
- The mint gets `org_id=str(ORG)`, `folder_id=<new folder>`, `supabase=<the user client>` and `on_conflict="link"`. It gets no `source_connection_id` or `ingest_visibility`.
- The enqueue gets `active_org=str(ORG)` and the mint's `storage_path`. After that the install is set to `installed`.
- No payload contains the seed user id, and no document payload carries `is_org_shared`.
- Four refusals each carry a fixed sentence:
  - an org-authored bundle, or a system bundle with no corpus, makes no db write at all;
  - a 403 from the mint becomes `ExpertInstallFolderNotOwned`, and nothing further is minted;
  - a dedup hit in a foreign folder becomes `ExpertInstallConflict`, whose sentence names the file;
  - an unexpected error records the literal `The copy step failed before every document was queued.`, and the test asserts that the secret in the exception text is absent from it.
- Idempotency arms (i)–(vii), in order:
  - a lost claim makes zero calls;
  - a repeat install makes zero writes;
  - only the missing filename is minted;
  - a failed document the caller owns is re-driven in place: chunks, tables and images are deleted, and the reset to `pending` is filtered by id AND user_id;
  - a failed document owned by someone else is left untouched, and the install fails with a sentence;
  - a deleted folder is recreated, the install is repointed, and `EXPERT_INSTALL_FOLDER_RECREATED` is logged;
  - an edited document is left untouched.

Acceptance greps:
- `SYSTEM_USER_ID|…0001` in the service: nothing.
- `org_id=str(org_id)`: 1 match, which is the only `async_mint_document_row` call site.
- `splice_document|document_chunks").insert|embedding`: nothing.
- `git diff --quiet e2468e6ce` on `audit_service.py`, `import_service.py`, `folders.py` and `documents.py`: unchanged.

## Task 2: evidence

**RED:** `11 failed, 9 passed`. The 9 that passed are the basic document-derived rows that Task 1's minimal `derive_install_state` already needed: no row, failed doc, three in-flight statuses, no present doc, ready, and the can_install/updated_at passthrough. The 11 that failed are the ones that needed new behaviour:
- folder gone (×2)
- fresh claim
- stale claim
- failed copy step
- failed copy step before the folder existed
- zero-chunk completion
- zero-query overlay
- full overlay
- failed-install overlay
- summaries

This is not a false RED. The rows that passed describe behaviour Task 1 legitimately had to ship.

**GREEN:** all three suites passed, `37 passed`.
- The overlay's zero-query arm asserts `pool.fetch`/`fetchrow` `await_count == 0`, and asserts that neither install read is awaited.
- A mixed list makes exactly 1 `list_expert_installs_for_org` call and at most 1 document read, and loads each distinct slug's manifest once (`load.call_count == 2`).
- The stale seed id `…0260` never survives.
- Org-authored rows come back identical with no `install` key, and the input list is not mutated.
- `grep "status.*ready\|'ready'" backend/app/db/experts.py`: nothing, so ready is never stored.

## Task 3: evidence

**RED:** `20 failed, 4 passed`. All 19 new route cases failed, because the routes returned 404/405 or `app.api.experts` had no `install_expert_service` / `overlay_install_state` / `list_install_summaries`. The extended `test_259` router-gate case also failed (`assert 404 == 403` on the new install path).

**GREEN:** the four target suites (`test_266_install_route_gates`, `test_259_expert_entitlement_gate`, `test_261_single_expert_authoring_gate`, `test_262_expert_list_grants_api`) plus the three service suites: `71 passed`. Every suite that imports `app.api.experts` or the installer, plus every `test_26[0-6]_*.py`: `437 passed`.

Acceptance greps:
- `subscription_tier` in `api/experts.py`: nothing.
- `@router.get("/installs"` is at line 492 and `@router.get("/{bundle_id}"` is at line 508.
- `Could not install this Expert.` is present, and there is no `detail=f"` anywhere in the file.
- `git diff --quiet e2468e6ce HEAD` on `threads.py`, `run_producer.py` and `models/expert.py`: unchanged.
- `uninstall` in `api/experts.py` or the service (case-sensitive): nothing.

In `test_259`, the tier refusal on the two new routes is asserted by **body** (`detail.error == "entitlement_required"`), not by status alone. `POST /install` also depends on the user-JWT client, whose bearer check would 403 on its own, so a status-only assertion would pass vacuously.

## Backend baseline gate (run once, at the end)

`node scripts/check-backend-unit-baseline.cjs` gave `71 failed, 5649 passed, 1 skipped, 2 xfailed, 2 xpassed`, `[GATE PASSED] (failed: 71 <= 71, errors: 0)`. Wave 1 ended at 5593 passed. The +56 are this plan's new cases (17 + 20 + 19) and 71 is unchanged.

The full failing set was captured from the gate's own output, not a tail. It is 71 ids in 24 files, and **none of those files import `app.api.experts` or `expert_install_service`** (checked file by file with grep). The per-file counts are 15 `test_retrieval_service`, 12 `test_sql_service`, 6 `test_explorer_agent`, 5 `test_multimodal_query`, 4 `test_111_1_reembed_kickoff`, 3 each for `test_sandbox_service` / `test_lifespan` / `test_db_runs`, 2 each for `test_module7_tools` / `test_extraction_service` / `test_cross_worker_cancellation` / `test_071_1_threadpool_sweep`, and 1 each for `test_streaming_reliability`, `test_published_workflow_ownership`, `test_phase56_iteration_start`, `test_per_format_ingestion`, `test_get_model_capability_inference`, `test_forced_emit`, `test_chat_tool_approval`, `test_200_1_phase_output_shape`, `test_190_review_fix_data_layer`, `test_182_validate`, `test_075_4_unknown_provider_error` and `test_061_consumer`.

<details><summary>All 71 failing ids</summary>

```
test_061_consumer.py::test_xread_advances_last_id
test_071_1_threadpool_sweep.py::test_extract_composable_calls_wrapped_in_threadpool
test_071_1_threadpool_sweep.py::test_no_unwrapped_sync_calls_in_route[async def upload_document(]
test_075_4_unknown_provider_error.py::test_known_providers_includes_all_five_providers
test_111_1_reembed_kickoff.py::test_dims_only_change_kicks_reembed
test_111_1_reembed_kickoff.py::test_model_change_kicks_reembed
test_111_1_reembed_kickoff.py::test_model_only_change_kicks_without_resize
test_111_1_reembed_kickoff.py::test_no_change_save_does_not_reembed
test_182_validate.py::test_interactive_phase_verdict_is_incomplete_and_per_node
test_190_review_fix_data_layer.py::test_CR01_the_projection_names_every_safe_column_and_never_the_secret
test_200_1_phase_output_shape.py::test_this_plan_wrote_no_migration
test_chat_tool_approval.py::test_tool_approval_ask_emits_event_and_pauses
test_cross_worker_cancellation.py::test_a_late_producer_finalize_may_not_write_failed_over_a_cancel
test_cross_worker_cancellation.py::test_the_registry_read_only_ever_turns_failed_into_cancelled
test_db_runs.py::test_insert_assistant_message_optional_fields_none
test_db_runs.py::test_insert_assistant_message_sql_shape
test_db_runs.py::test_insert_run_passes_args_positionally
test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_default_mode_uses_default_prompt
test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_default_mode_uses_default_tools
test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explicit_default_mode_same_as_omitted
test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_prompt
test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_tools
test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_max_iterations_8
test_extraction_service.py::test_legacy_extractor_docx_matches_golden
test_extraction_service.py::test_legacy_extractor_pdf_matches_golden
test_forced_emit.py::test_forced_emit_judge_verdict_unmocked
test_get_model_capability_inference.py::test_infer_openai_from_gpt_prefix
test_lifespan.py::test_pg_pool_close_timeout_falls_back_to_terminate
test_lifespan.py::test_pg_pool_closes_before_supabase
test_lifespan.py::test_supabase_aclose_after_pg_pool
test_module7_tools.py::TestGetTools::test_returns_base_tools_without_tavily_or_sandbox
test_module7_tools.py::TestGetTools::test_returns_one_more_tool_with_tavily
test_multimodal_query.py::test_image_chunk_insertion
test_multimodal_query.py::test_query_tables_column_filter
test_multimodal_query.py::test_query_tables_document_not_found
test_multimodal_query.py::test_query_tables_returns_data
test_multimodal_query.py::test_query_tables_row_cap
test_per_format_ingestion.py::test_every_allowed_mime_type_has_a_case_or_a_named_alias
test_phase56_iteration_start.py::TestIterationStartInProductionSource::test_threads_py_emits_iteration_start_at_loop_top
test_published_workflow_ownership.py::test_published_workflow_field_set_excludes_created_by
test_retrieval_service.py::TestEnrichWithFilenamesPhase28::test_enrich_with_filenames_defaults_version_number_to_1
test_retrieval_service.py::TestEnrichWithFilenamesPhase28::test_enrich_with_filenames_includes_version_number
test_retrieval_service.py::TestSearchDocuments::test_calls_embed_texts_with_query
test_retrieval_service.py::TestSearchDocuments::test_calls_supabase_rpc_match_document_chunks
test_retrieval_service.py::TestSearchDocuments::test_joins_results_with_documents_table
test_retrieval_service.py::TestSearchDocuments::test_returns_empty_list_when_no_chunks_match
test_retrieval_service.py::TestSearchDocuments::test_returns_empty_list_when_rpc_data_is_none
test_retrieval_service.py::TestSearchDocuments::test_returns_formatted_results
test_retrieval_service.py::TestSearchDocuments::test_returns_multiple_results
test_retrieval_service.py::TestSearchDocuments::test_uses_unknown_filename_when_doc_not_found
test_retrieval_service.py::TestSearchDocumentsPhase26::test_chunk_index_none_when_missing
test_retrieval_service.py::TestSearchDocumentsPhase26::test_hybrid_empty_returns_tuple
test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_avg_similarity_as_second_value
test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_chunk_index_in_enriched_results
test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_zero_avg_sim_when_no_results
test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_empty_output
test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_storage_path_format
test_sandbox_service.py::TestHarvestOutputFiles::test_harvest_files_uploads_and_inserts
test_sql_service.py::TestQueryDocumentsOutput::test_markdown_table_has_header_and_separator
test_sql_service.py::TestQueryDocumentsOutput::test_returns_json_for_large_results
test_sql_service.py::TestQueryDocumentsOutput::test_returns_markdown_table_for_small_results
test_sql_service.py::TestQueryDocumentsOutput::test_returns_no_results_string_when_data_is_none
test_sql_service.py::TestQueryDocumentsOutput::test_returns_no_results_string_when_empty
test_sql_service.py::TestQueryDocumentsOutput::test_truncates_to_20_rows_with_note
test_sql_service.py::TestQueryDocumentsRpcCall::test_calls_query_user_documents_rpc
test_sql_service.py::TestQueryDocumentsRpcCall::test_raises_runtime_error_on_rpc_exception
test_sql_service.py::TestQueryDocumentsValidation::test_rejects_insert_query
test_sql_service.py::TestQueryDocumentsValidation::test_rejects_non_select_query
test_sql_service.py::TestQueryDocumentsValidation::test_rejects_query_with_semicolon
test_sql_service.py::TestQueryDocumentsValidation::test_rejects_update_query
test_streaming_reliability.py::TestAsyncioShield::test_persist_assistant_message_is_sync
```
</details>

**Hot-file ledger gate:** `node scripts/check-hot-file-ledger.cjs .planning/phases/266-expert-knowledge-in-a-real-org` reported `ledger gate OK` (332 rows, 16 watched files). The ledger narrative for `api/experts.py` (G-5 FIRES) is 266-05's to write. By construction, this plan adds to that file two routes, one small helper (`_overlay_install_state_for_caller`), the imports, and one overlay call in `list_experts` (both arms) and one in `get_expert`. No existing guard, dependency or refusal was edited.

## Deviations from Plan

**1. [Rule 2: correctness] Derived state reports a failure that happened before the folder existed.** The plan's order put "folder_id None → not_installed" before the status arms. If a copy died before its folder was created, or a claim went stale with no folder, the Expert would then read "Not installed" silently, and D-266-03 says a failure names its cause. Now:
- `status == failed` returns failed with the recorded sentence, whether or not a folder exists.
- A stale `installing` claim with no folder returns failed with "The install did not finish. Retry to continue it."
- Only an `installed` row whose folder is gone reads not_installed, so Install can recreate the folder.

This is pinned by `test_a_failed_copy_step_before_the_folder_existed_still_reports_the_failure`. Commit: `114074c84`.

**2. [Rule 3] Name collision.** The route function keeps the planned name `install_expert` (the AST test and the plan's key_link both name it). The service function is therefore imported as `install_expert_service`, and the tests patch `app.api.experts.install_expert_service`. Commit: `e025dbc3e`.

**3. `test_262_expert_list_grants_api.py` needed no change.** It is listed in `files_modified`, but every fixture row in it is `is_system: False`. The overlay returns those rows untouched with zero queries, so the suite passes unmodified. Only `test_259`'s fixture needed the identity overlay patch, because its "enterprise admitted" case lists an `is_system: True` row over a bare `MagicMock` pool.

**4. Task 1 shipped a minimal `derive_install_state`.** Task 1's own tests (the claim-lost arm and the returned result) need a derived state. Task 1 therefore shipped only the document-derived arms, and Task 2 added the status, staleness, folder and zero-chunk arms. See the Task 2 RED note above.

**5. `EXPERT_INSTALL_FOLDER_RECREATED` also fires on a re-claim.** `expert_installs.folder_id` is `ON DELETE SET NULL`, so a deleted folder normally comes back as NULL, not as a stale id. The log verb fires on either a stale id or a claim that took over an existing row (`created_at != updated_at`).

## Notes for 266-04 / 266-05

- Wire contract as frozen:
  - `install` on every first-party row is `ExpertInstallState.model_dump()`.
  - A system row with no corpus has `install: null` and `knowledge_folder_ids: []`.
  - Org-authored rows have no `install` key.
- The re-drive (arm iv) calls `_enqueue_or_splice` with the document's existing `file_path`. A storage PUT to an existing key will likely fail (no upsert option is passed), and then `_enqueue_or_splice`'s own fallback schedules a direct `splice_document` with the bytes in memory. That is still the one pipeline, but it is the no-job branch. **266-05's live drive should check which branch a real retry takes.** If the worker path is required for retries, the follow-up is to pass `upsert` in `import_service` (not edited here, by plan).
- `GET /experts/installs` is readable by any member of the active org (T-266-22, accepted). A standard-tier org gets the entitlement 403, which the Library must treat as an empty map (RESEARCH Pitfall 10, 266-04's side).

## Known Stubs

None.

## Threat Flags

None. The two new endpoints are exactly the surface in the plan's threat register (T-266-14 to T-266-23). Mitigations in code and tests:
- The org comes only from `get_active_org_id`, the route has no body, and a test asserts that a body `org_id` is ignored.
- `require_expert_manage` is enforced, and the tests assert the service is not awaited on a 403.
- The router tier gate is the only tier check, and the two new routes were added to the `test_259` case.
- Tenant writes use the user-JWT client.
- The bundle lookup is grant-aware, so an invisible bundle is a 404.
- Error details are literal or fixed sentences.
- Concurrent installs are resolved by the CAS claim, and a lost claim makes zero writes.
- Only failed documents are re-driven, and only by their owner.

## TDD Gate Compliance

Each task has a `test(266-03)` RED commit before its `feat(266-03)` GREEN commit: `622c58664` → `d7e7576e6`, `cdd590bbd` → `114074c84`, and `444c68b95` → `e025dbc3e`. No refactor commits were needed.

## Self-Check: PASSED

- All 7 files under key-files.created / modified are present in the tree.
- Commits 622c58664, d7e7576e6, cdd590bbd, 114074c84, 444c68b95 and e025dbc3e are present in `git log`.
- STATE.md and ROADMAP.md were not modified.

# Phase 162.5 — Deferred / Out-of-Scope Items

Pre-existing test rot discovered while establishing the byte-identical baseline for the
162.5-01 leaf extraction. These fail on the UNMODIFIED (pre-extraction) `threads.py` too —
they are NOT caused by this phase and are out of scope for a behavior-preserving refactor
(SEED-056 / `075.4-TEST-TRIAGE.md` class). Logged, not fixed.

## Pre-existing failures (baseline: identical before and after 162.5-01)

| Test | Failure | Root cause (pre-existing) |
|------|---------|---------------------------|
| `tests/test_mdl_verification.py::...test_generate_thread_title_uses_provider_default[openai]` / `[google]` | stale assert (`gpt-5.4-mini` != `gpt-4.1-nano`) | Test hardcodes old `_SUB_AGENT_MODEL_DEFAULTS` values; registry curated to newer models (prioritize-newest-models convention). The `get_llm_client` mock IS still called (patch surface intact) — only the expected string is stale. |
| `tests/test_mdl_verification.py::...test_generate_suggestions_uses_provider_default[openai]` / `[google]` | stale assert | Same stale-default drift, in `suggestion_service` (untouched by this phase). |
| `tests/test_mdl_verification.py::...test_sub_agent_model_defaults_dict_keys_match_known_providers` | key mismatch | `KNOWN_PROVIDERS` vs `_SUB_AGENT_MODEL_DEFAULTS` drift. |
| `tests/test_provider_router.py::test_n01_*` (4) | `app.api.threads` has no attribute `insert_run` | Stale patch target — `insert_run` was replaced by `register_run_start` in Phase 145; test never updated. |
| `tests/integration/test_threads.py` (4) | no attribute `create_streaming_chat` (×2) / `insert_run` (×2) | Stale patch targets removed in Phase 092.5 / 145. |
| `tests/test_dual_mode_wiring.py` + `tests/unit/test_explorer_agent.py` (16) | `insert_run` AttributeError + mock-mismatch 500s | Stale `insert_run` patch chain from Phase 145. Baseline proven identical (16 failed) on the original `threads.py` via a backup/restore run. |

**Disposition:** out of scope for Phase 162.5 (pure refactor fixes nothing by design). Candidates for a future backend test-rot sweep (SEED-056 lineage). Do NOT block the 162.5 extraction or its Plan-04 gate on these.

## Additional pre-existing failures confirmed during 162.5-03 (producer-heart extraction)

The 162.5-03 acceptance run was baselined BEFORE any change (19 failed / 55 passed across the 6 named files) and AFTER both tasks (19 failed / 55 passed — **byte-identical failure set**, `diff` empty). All below fail on the pre-extraction code too; none are caused by the producer/continuation move.

| Test(s) | Failure | Root cause (pre-existing) |
|---------|---------|---------------------------|
| `tests/integration/test_075_4_terminal_race.py::test_shielded_finalize_step_order_finalize_run_before_sentinel` | `finalize_run call missing` (baseline) → after move, `Could not locate _shielded_finalize body` | Phase 145 renamed the finalizer's `await finalize_run(` → `await finalize_run_terminal(` so the test's `body.find("await finalize_run(")` was already `-1`. The regex also keys on the now-moved `_shielded_finalize` name. Same test red before and after — NOT retargeted (chasing pre-existing rot is out of scope). Its live-sibling `test_suggestion_emit_still_precedes_terminal_sentinel` (which PASSED at baseline) WAS retargeted to `run_producer._finalize_producer_run`. |
| `tests/integration/test_089_agent_loop_result_seam.py::test_finalizer_receives_persisted_id_and_terminal_order_holds` | `app.api.threads` has no attribute `insert_run` | Phase-145 `insert_run`→`register_run_start` patch rot (also asserts on `app.api.threads.finalize_run`, which the terminal path replaced with `finalize_run_terminal`). Fails at patch-setup before any producer code runs. |
| `tests/integration/test_066_terminal_classification.py::test_timeout_branch_writes_timed_out` / `test_failed_error_truncated_to_200_chars` / `test_delete_writes_cancelled_not_timed_out` (3) | expected supabase `runs` UPDATE not recorded | Phase-145 moved the terminal write to the asyncpg pool (`finalize_run_terminal`), so the assertion on `mock_supabase.table("runs").update` no longer fires. Pre-existing asyncpg-vs-supabase drift. |
| `tests/integration/test_059_disconnect.py` / `test_061_runs_table.py` / `test_061_ttl.py` / `test_061_producer_survives_disconnect.py` / `test_062_delete_happy.py` / `test_062_delete_zombie.py` (8) | `asyncpg ForeignKeyViolationError: runs_thread_id_fkey` (7) + zombie-heal "no rows" (1) | Real-asyncpg integration tests against an **unseeded local test DB** — `insert_run` (app/db/runs.py, UNMODIFIED) fails the FK before the producer even spawns; the zombie-heal is the orthogonal `run_lifecycle._cancel_run_internals` path (untouched). None call `/continue`→`spawn_continuation_run`. The Phase-075.4 FK-violation cluster; a live seeded backend (the Plan-04 operator gate) is where these run green. |
| `tests/unit/test_streaming_reliability.py::TestAsyncioShield::test_persist_assistant_message_is_sync` | `_persist_assistant_message must exist as a sync def in threads.py` | Phase-089 moved `_persist_assistant_message` OUT of `threads.py` into `agent_loop.py`. `def _persist_assistant_message` is absent from `threads.py` at HEAD~1 too (`git show HEAD~1:…/threads.py \| grep -c` = 0). Phase-089 source-introspection rot, not this phase's. |

**Disposition:** all confirmed pre-existing (upstream of / orthogonal to the producer-heart move). The 162.5-03 extraction adds **zero** net-new failures (acceptance `diff` empty; broader sweep shows only DB-environmental + Phase-089 rot, zero import/attribute/name errors). Sealed by the Plan-04 live byte-identical gate.

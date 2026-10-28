---
phase: 296-close-v4-7-debt
plan: 01
subsystem: tenancy-governance-evidence-backend
tags: [tenancy, migration, evidence-privacy, rate-limit, g-5, tdd]
requires: []
provides:
  - "supabase/migrations/216_neutral_default_org_name.sql — handle_new_user names a new personal org 'My organization' (no email)"
  - "scripts/check-migration-216-live.py — SELECT-only local live check"
  - "run_evidence.WITHHELD_UPSTREAM_SENTENCE + the non-owner D-05 cascade in compose_phase_log"
  - "run_evidence.is_canonical_uuid — the cited-id filter used by cited_document_ids and _viewer_reads"
  - "rate_limit.enforce_user_citation_limit + CITATION_CHECKS_PER_MINUTE (10)"
  - "wire contract for 296-04: POST /citation-checks → 429 detail {reason: rate_limited} + Retry-After; 503 {reason: unavailable}"
affects:
  - backend/app/api/folders.py
  - backend/app/api/workflows.py
  - backend/app/db/workflows.py
  - backend/app/api/workflow_run_evidence.py
  - backend/app/api/citation_checks.py
  - scripts/full-schema-supplement.sql
  - supabase/full-schema.sql
tech-stack:
  added: []
  patterns:
    - "create_thread's D-268-07 stamp copied to two more create routes: resolve_active_org_or_none → org_id key only when validated"
    - "keyword-only optional kwarg whose None path emits the byte-identical pre-change SQL (pinned by a stub-pool test)"
    - "Request param defaulting to None: FastAPI still injects it; direct-call suites keep working"
key-files:
  created:
    - supabase/migrations/216_neutral_default_org_name.sql
    - scripts/check-migration-216-live.py
    - backend/tests/unit/test_296_migration_shape.py
    - backend/tests/unit/test_296_create_org_stamp.py
    - backend/tests/integration/test_296_two_org_create.py
    - backend/tests/unit/test_296_citation_rate_limit.py
  modified:
    - supabase/migrations/215_api_keys_and_run_origin.sql
    - scripts/full-schema-supplement.sql
    - supabase/full-schema.sql
    - backend/app/api/folders.py
    - backend/app/api/workflows.py
    - backend/app/db/workflows.py
    - backend/app/services/run_evidence.py
    - backend/app/api/workflow_run_evidence.py
    - backend/app/services/rate_limit.py
    - backend/app/api/citation_checks.py
    - backend/tests/unit/test_289_run_evidence.py
    - backend/tests/unit/test_294_citation_check_route.py
    - backend/tests/unit/test_293_migration_215.py
    - backend/tests/unit/test_256_finish_run_unchanged.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "SEED-364 org name is the constant 'My organization' (D-06 discretion): a constant is the only expression that cannot carry an email; no existing org renamed."
  - "CITATION_CHECKS_PER_MINUTE = 10 is an [ASSUMED] module constant (A3), not a setting: a Settings knob needs a migration + UI control, out of 296 scope. No env var."
  - "The citation limiter sits after the availability check and BEFORE the in-flight nx claim, so only calls that would reach the paid engine count, and a limited call never sets the claim."
  - "create_folder / create_draft take `request: Request = None`: FastAPI 0.115 still injects a Request with a None default (measured), and four suites call create_draft directly."
  - "A folder parent in another org than the validated active org gets the existing 404 'Parent folder not found'; with no header the parent rule is unchanged."
  - "The two-org integration test calls the real route handlers with a header-bearing request rather than HTTP: the auth/visibility/tier dependencies are not the bug's subject, the stamp lives in the handler body."
metrics:
  duration: "~3h (including the operator migration checkpoint and three full backend unit runs)"
  completed: 2026-10-26
  tasks: 4
  files: 22
---

# Phase 296 Plan 01: Tenancy, governance and evidence privacy (backend) Summary

A two-org user's folders and workflow drafts now land in the org they chose (validated `X-Org-Id`). A colleague reading run evidence no longer reads a withheld document's substance through a later step. One malformed cited id no longer masks every source. Citation checks are limited to 10 per user per minute and fail closed. Migration 216 names a new signup org `My organization` instead of the founder's email. Migration 215's backfill regex is now the canonical UUID pattern.

**Base sha:** `a5077f083` (develop).

## Tasks and commits

| Task | What | Commits |
|---|---|---|
| 1 | Migration 216, supplement copy, 215 regex, live check, shape test | RED `67040639c` · GREEN `08c9a600e` |
| 2 | [checkpoint] migration 216 applied to LOCAL Supabase | applied by the orchestrator at the operator's request; VERIFY `PASS`; `check-migration-216-live.py` prints `216 live` |
| 3 | full-schema regen + BUG-261021-02 org stamping | regen `006f0365c` · RED `20113ce24` · GREEN `cb13a74a7` |
| 4 | D-05 cascade + 289-IN-04 UUID filter + SEED-365 citation limit | RED `8939b5522` · GREEN `70fefa6f4` |
| gate | regressions the full unit gate caught (all mine, fixed) | `cfa804a4f`, `5df2eacb3` |

## RED evidence per row

- **SEED-364 / 293-IN-05 (`test_296_migration_shape.py`):** 8 failed before 216 existed and before 215 was edited. After the fix, 9 passed.
  - Between RED and GREEN, the email check was narrowed to the `$$…$$` function body. 216's VERIFY select has to contain `NOT LIKE '%new.email%'`, which would otherwise trip it.
  - A test pinning the VERIFY select was added at the same point.
- **BUG-261021-02 (`test_296_create_org_stamp.py` + `test_296_two_org_create.py`):** 12 failed, 1 passed. The pass was the mig-216 signup-name check, which was already applied.
  - The RED failures were `AttributeError` (`resolve_active_org_or_none` not imported by either route), `TypeError` (`create_workflow_definition` had no `org_id`) and, in the integration test, `create_folder() got an unexpected keyword argument 'request'`. In other words, the routes could not receive the header at all.
  - GREEN: 13 passed. In the integration test the non-vacuity assertion (trigger org A ≠ active org B) runs first. A no-header control lands in A, and a non-member header is ignored (lands in A).
- **BUG-261020-02 / D-05, 289-IN-04, SEED-365 (`test_289_run_evidence.py` + `test_296_citation_rate_limit.py`):** 12 failed, 40 passed.
  - Every new arm failed RED.
  - The invariants (owner unchanged, readable-doc non-vacuity, a human step never starts the cascade) passed RED as intended.
  - GREEN: 123 passed across the targeted suites.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 - Blocking] `regenerate-full-schema.sh` could not find the stack from a worktree.**
   - The Supabase CLI derives the project id from the workdir's basename, so `supabase status` looked for `supabase_db_agent-a564…`.
   - Ran the script with `SUPABASE_WORKDIR="C:/Vibe Apps/Agentic RAG"`, still in no-reset mode. The dump was written to the worktree's `full-schema.sql`, and the diff is exactly the 216 hunk in both places (+4/−2).
2. **[Rule 3 - Blocking] A required `request` param would have broken four direct-call suites** (`test_103_draft_crud`, `test_186_concurrent_patch`, `test_workflows_routes`, `test_196_save_refusal`).
   - Changed it to `request: Request = None`. FastAPI 0.115.6 still injects a Request with a None default (measured with a TestClient probe). `resolve_active_org_or_none` already handles `request is None`.
3. **[Rule 3] The integration test's service client pointed at the placeholder `SUPABASE_URL`.**
   - `tests/conftest.py` pins `https://test.supabase.co`. The test now builds the client from `backend/.env` through `_271_gotrue_users._admin()`, guarded by `require_gotrue()`. It was edited after the RED commit and landed in the GREEN commit `cb13a74a7`.
4. **[Rule 3] `test_294_citation_check_route.py`'s fake Redis had no `pipeline`.** POST now counts the call first, so without one every success path would have read 503. The fake gained `store` plus `pipeline()` using `phase293_inbound_fakes.FakePipeline`. No assertion changed.
5. **[Rule 1] A second D-05-reversed assertion.** `test_a_colleague_reads_a_minimised_record` also pinned `phase_log[2] == "Memo written."`. It was amended deliberately, with the reason written in the test body, and the plan's named assertion was amended the same way.
6. **[Rule 1] The full unit gate caught three regressions of my own. All three were fixed before the gate was recorded.**
   - `test_293_migration_215::test_backfill_only_touches_uuid_schedule_rows` pinned the loose `{36}` regex that 293-IN-05 replaces. It was amended deliberately in `cfa804a4f`.
   - `test_200_1::test_the_definition_writes_were_left_alone` counts `json.dumps(definition.model_dump` in `db/workflows.py`, and my org branch duplicated it. The payload is now built once and the count is back to its base value (`5df2eacb3`). The None-path SQL text is unchanged; the stub-pool test still passes.
   - `test_256_finish_run_unchanged` pins the `await finish_run(` position in `api/workflows.py`. The +8 lines from the stamp moved it from 1572 to 1580. Re-derived with the recorded comment; the count is unchanged (`5df2eacb3`).
7. **[Rule 2] `run_evidence.py` had no CLAUDE.md FIRING row** although it now measures 4 phases. The row was added in `70fefa6f4`.

### Out of scope, observed and not fixed
- `backend/tests/test_196_save_refusal.py` has two failures: `gpt-5.4` is not in the local model registry. They are data-dependent, the suite lives outside `tests/unit`, and the cause is unrelated to this plan; my `request` default keeps the suite's call shape valid.

## Backend unit gate (under the local-DB lock, released after)

Command: `pytest tests/unit -q --continue-on-collection-errors -rf`, run from `backend/`.

| Run | Result |
|---|---|
| Base content (every changed file checked out at `a5077f083`, new files moved aside, DB already carrying 216) | **70 failed**, 9877 passed, 1 skipped, 2 xfailed, 2 xpassed |
| First HEAD run | 73 failed: 3 new, all mine, fixed above |
| **Final HEAD `5df2eacb3`** | **70 failed**, 9909 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 collection errors |

**Set diff (final against base):** the two sets are IDENTICAL, 70 = 70 ids. `comm` printed one apparent mismatch, but it is the same id (`test_published_workflow_ownership.py::test_published_workflow_field_set_excludes_created_by`) with an interleaved `RuntimeWarning` glued onto the line in the final log. The gate passes at 70, which is at most 71.

The failing set, base equals final, grouped by file:

| Count | Test file |
|---|---|
| 15 | `test_retrieval_service.py` |
| 12 | `test_sql_service.py` |
| 6 | `test_explorer_agent.py` |
| 5 | `test_multimodal_query.py` |
| 4 | `test_111_1_reembed_kickoff.py` |
| 3 each | `test_sandbox_service.py`, `test_lifespan.py`, `test_db_runs.py` |
| 2 each | `test_module7_tools.py`, `test_extraction_service.py`, `test_cross_worker_cancellation.py`, `test_071_1_threadpool_sweep.py` |
| 1 each | `test_streaming_reliability.py`, `test_published_workflow_ownership.py`, `test_phase56_iteration_start.py`, `test_per_format_ingestion.py`, `test_get_model_capability_inference.py`, `test_forced_emit.py`, `test_chat_tool_approval.py`, `test_200_1_phase_output_shape.py` (`test_this_plan_wrote_no_migration`), `test_190_review_fix_data_layer.py`, `test_075_4_unknown_provider_error.py`, `test_061_consumer.py` |

The full id lists are in the session scratchpad (`fail_base.txt` / `fail_final.txt`). None of them is a file this plan touched.

## [ASSUMED] value for the operator

`CITATION_CHECKS_PER_MINUTE = 10` per user per minute (`backend/app/services/rate_limit.py`).
- **Why a constant:** it follows the `IP_CALLS_PER_MINUTE` precedent. It is not a setting and there is no env var, because a Settings knob would need a migration plus a UI control.
- **What to confirm:** whether 10 is the right ceiling before paying orgs enable the engine (SEED-365).

## Other verification

- `scripts/check-migration-216-live.py` prints `216 live` and exits 0.
- `check-schema-acl-parity.cjs`, `check-greenfield-privileges.py`, `check-claude-md-size.cjs` (99.3k chars) and `check-hot-file-ledger.cjs --files <the 8 plan hot files>` all exit 0.
- `grep -c "My organization" supabase/full-schema.sql` returns 2 and `new.email` returns 0.
- Acceptance greps:
  - `WITHHELD_UPSTREAM_SENTENCE` appears 4 times in `run_evidence.py`, and the exact sentence appears once.
  - In `citation_checks.py`, `enforce_user_citation_limit` (line 164) comes before `nx=True` (line 168).
  - `os.environ` / `getenv` count in `rate_limit.py`: 0.

## G-5 record

Every triple below was re-derived with the CLAUDE.md recipe, six-digit buckets dropped. Each row and section landed in that file's fix commit.

| File | Before (row) | After | Note |
|---|---|---|---|
| `scripts/full-schema-supplement.sql` | 23/15/848 (stale; 24/16/863 at base) | **25/17/863** | one expression (216) |
| `backend/app/api/folders.py` | 14/9/277 | **15/10/287** | one param, one stamp, parent-org 404 |
| `backend/app/api/workflows.py` | 47/25/1681 | **48/26/1689** | one param, one stamp (+8); split still OWED |
| `backend/app/db/workflows.py` | 59/30/2827 | **61/31/2845** | keyword-only `org_id` |
| `backend/app/services/run_evidence.py` | 5/3/525 | **6/4/555** | now FIRES, CLAUDE.md row added |
| `backend/app/api/workflow_run_evidence.py` | 4/3/405 | **5/4/408** | one filter line |
| `backend/app/services/rate_limit.py` | 3/1/109 | **4/2/138** | does not fire |
| `backend/app/api/citation_checks.py` | 1/1/175 (stale) | **3/2/186** | does not fire |

## Guardrail overrides for STATE.md

None. Every FIRING-file touch stayed within its binding verdict:
- `api/workflows.py`: one param and one stamp.
- `db/workflows.py`: keyword-only kwargs only.
- `run_evidence.py`: one flag, one branch, one regex helper.

## Threat Flags

None beyond the plan's threat register: T-296-01..08 were mitigated as written, and T-296-09 was accepted.

## Known Stubs

None.

## Self-Check: PASSED

- All 6 created files exist.
- All 9 commits are present on `worktree-agent-a564b415916c32df1`: `67040639c`, `08c9a600e`, `006f0365c`, `20113ce24`, `cb13a74a7`, `8939b5522`, `70fefa6f4`, `cfa804a4f`, `5df2eacb3`.

---
phase: 084-workspace-filesystem-backend
status: passed
score: 9/9 must-haves verified
created: 2026-05-28
verified: 2026-05-28
verifier: gsd-verifier (re-verification after Plan 05 gap closure)
revisions:
  - date: 2026-05-28
    actor: gsd-verifier
    change: |
      Re-verification after Plan 05 shipped 3 direct fixes for the cross-provider
      blockers identified in the initial UAT cycle (status was `human_needed`).
      All three blockers now confirmed CLOSED in HEAD code:
        - 9de4ed8: google_service._sanitize_schema_for_google + _translate_nullable_type
          (line 270-324) translates type:[X,null] -> {type:X, nullable:true}
        - b78bfad: tool_dispatcher._normalize_optional / _normalize_optional_int
          helpers (line 838-862) applied at entry to workspace_list/read/diff
        - 323e520: api/workspace._decode_inline_content gained `\x...` hex-bytea
          branch at line 83-84 + memoryview + dict-Buffer + warning log
      22 new unit tests (7 google + 7 dispatcher + 10 REST decode) all GREEN
      (46/46 tests in the three affected files pass in 0.29s).
      084-HUMAN-UAT.md re-UAT 2026-05-28 via Chrome MCP confirms Tests 1
      (OpenAI), 2 (Anthropic), 3 (Google), 4 (OpenRouter llama-3.3-70b),
      9 (REST /content), 15 (deepseek), 16 (moonshot) all PASS. Final
      scoreboard: 9 passed / 0 issues / 7 deferred (multi-tool +
      parallel-thread + long-message + >256KB bucket + hostile path +
      100-file limit -- all out-of-scope per original UAT-SC#10 scoping
      notes; routed forward to v2.7 retrospective).
      Status flipped: human_needed -> passed.
---

# Phase 084: Workspace Filesystem Backend -- Verification Report

## Goal (from ROADMAP)

> Add workspace filesystem backend (DB schema + service layer + 5 LLM tool
> handlers + REST endpoints) so the agent can create, read, list, diff, and
> delete files scoped to a thread.

## Status: PASSED

All 9 observable truths verified against HEAD codebase. All 22 Plan 05 unit
tests + 24 pre-existing tests pass (46/46). Cross-provider UAT confirmed
on 5 native providers (OpenAI / Anthropic / Google / deepseek / moonshot)
+ 1 experimental (OpenRouter llama-3.3-70b). REST surface confirmed via
Chrome fetch. Zero open blockers.

## Plan Inventory

| Plan | Title | Status | SUMMARY | Commits |
|------|-------|--------|---------|---------|
| 084-01 | Database Schema Migration | complete | 084-01-SUMMARY.md | 652020c, 41ccdc7, 790abb0 |
| 084-02 | DB Layer + Pydantic Models + Workspace Service | complete | 084-02-SUMMARY.md | 85c17e4, 1bebbda, fb97585 |
| 084-03 | Tool Handlers + LLM Schemas | complete | 084-03-SUMMARY.md | 6765dfd, 84eaa2a, 90ef06d |
| 084-04 | Workspace REST API | complete | 084-04-SUMMARY.md | 5201911, 953c13f, da83d1f |
| 084-05 | Cross-provider gap closure (Google + OpenRouter + REST /content) | complete | 084-05-SUMMARY.md | 9de4ed8, b78bfad, 323e520, f7edfb0 |

Plus regression auto-fix: ffae21e (test_tool_dispatcher count assertion 16 -> 21).

## Observable Truths (Goal-Backward)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agent can write a file via `workspace_write(path, content)` that persists across turns/reloads (WS-01) | VERIFIED | `_handle_workspace_write` at tool_dispatcher.py:865 + `ws_write_file` in workspace_service.py; dispatcher registry entry at line 1031; UAT Tests 1,2,3,4,15,16 all confirm writes via 5 native providers + OpenRouter |
| 2 | Agent can read files via `workspace_read(path)` capped at configurable max chars with truncation notice (WS-02) | VERIFIED | `_handle_workspace_read` at line 899 with `DEFAULT_READ_CAP=8192`; truncation notice emitted at line 924-929; binary metadata-only branch at line 915; UAT Test 1 (OpenAI) read 47ms PASS |
| 3 | Agent can list (`workspace_list(prefix)`) and delete (`workspace_delete(path)`) workspace files (WS-03) | VERIFIED | `_handle_workspace_list` at line 935 + `_handle_workspace_delete` at line 964; dispatcher registry entries at lines 1033-1034; UAT Tests 1-4,15,16 all confirm list+delete |
| 4 | Every workspace_write auto-creates a new version row; `workspace_diff(from, to)` returns structured diff (WS-04) | VERIFIED | `_handle_workspace_diff` at line 982; auto-version in workspace_service write_file (`await insert_version(...)` unconditional); UAT Test 2 (Anthropic) confirmed diff rendered correctly as unified diff |
| 5 | Files <= 256KB stored inline in Postgres; larger files uploaded to Supabase Storage bucket (WS-05) | VERIFIED | workspace_service.py `is_inline = size <= inline_threshold` branch + `workspace-files` private bucket created in migration 054 line 80 (`'workspace-files', 'workspace-files', false`); REST `_decode_inline_content` handles inline path |
| 6 | Workspace files scoped per-thread with unique path + RLS isolation (WS-06) | VERIFIED | full-schema.sql line 846 `UNIQUE (thread_id, path)` + line 854 `UNIQUE (workspace_file_id, version)`; migration 054 has 4 RLS policies checking `auth.uid() == user_id FROM threads`; REST `_verify_thread_ownership` called at start of every endpoint handler |
| 7 | SSE events emitted for workspace file writes and deletes via run:{run_id} Redis Stream (WS-07) | VERIFIED | `ctx.emit(..., 'workspace_file_written', ...)` at tool_dispatcher.py:879 + `ctx.emit(..., 'workspace_file_deleted', ...)` at line 974 |
| 8 | All 5 LLM providers (OpenAI / Anthropic / Google / deepseek / moonshot) accept the 5 workspace_* tool schemas without ValidationError | VERIFIED | Plan 05 commit 9de4ed8 added `_translate_nullable_type` at google_service.py:270 + integration test `test_real_workspace_tools_pass_sanitize_for_google`. UAT 2026-05-28: Tests 1,2,3,15,16 all PASS post-fix |
| 9 | REST surface returns real file content + metadata + versions + diff (no empty body for inline files) | VERIFIED | Plan 05 commit 323e520 added `\x...` hex-bytea branch at api/workspace.py:83-84 + 10 unit tests covering every bytea wire shape. UAT Test 9 re-tested 2026-05-28: `{"content":"hello world", "storage_type":"inline"}` -- no longer empty |

**Score: 9/9 verified.**

## Plan 05 Gap-Closure Fixes (Code-Level Confirmation)

| Fix | Commit | Location | Evidence |
|-----|--------|----------|----------|
| Google ValidationError -- translate type-array nullable optionals | 9de4ed8 | backend/app/services/google_service.py:270-324 | `_translate_nullable_type` helper + recursive call from `_sanitize_schema_for_google` confirmed in HEAD |
| OpenRouter llama-3.3 stringified-null/int args | b78bfad | backend/app/services/tool_dispatcher.py:838-862 | `_NULL_STRINGS` frozenset + `_normalize_optional` + `_normalize_optional_int` helpers; applied at lines 905-906 (workspace_read), 942 (workspace_list), 986-987 (workspace_diff) |
| REST /content empty body -- supabase-py hex-bytea string format | 323e520 | backend/app/api/workspace.py:51-95 | `_decode_inline_content` ladder: bytes/bytearray/memoryview -> direct UTF-8; dict {data:[]} -> bytes; str startswith `\x` -> `bytes.fromhex(value[2:])`; str fallback -> base64; warning log on decode failure |

All three fixes additive and native-safe (normalizer is a no-op for
properly-typed args from the 5 native providers; sanitizer change is
benign for non-nullable schemas; decoder ladder runs in priority order
that preserves the original bytes/base64 behavior).

## Unit Test Verification

`backend/venv/Scripts/python -m pytest tests/unit/test_075_5_google_native.py tests/unit/test_tool_dispatcher.py tests/unit/test_workspace_api.py -x -q`

Result: **46/46 passed in 0.29s** (warning about urllib3 version mismatch is
pre-existing, unrelated to Phase 084).

Breakdown of Plan 05 additions (22 of the 46):
- 7 cases in `test_075_5_google_native.py` pin type-array nullable
  translation (scalar passthrough, integer/string array translation,
  reversed null-first ordering, nested object recursion, real
  workspace_* tools integration backstop).
- 7 cases in `test_tool_dispatcher.py` pin dispatcher null-string
  normalization + str->int coercion (helper-level + handler integration).
- 10 cases in `test_workspace_api.py` (new file) cover every bytea wire
  shape: bytes, bytearray, memoryview, hex-bytea str, uppercase hex,
  base64 fallback, dict-Buffer, None, malformed string, empty string.

## Cross-Provider UAT Bandwidth (CLAUDE.md G-4 + UAT-SC#10)

| Axis | Status | Evidence |
|------|--------|----------|
| Cross-provider native (OpenAI / Anthropic / Google / deepseek / moonshot) | PASS | UAT Tests 1, 2, 3, 15, 16 all `result: pass` |
| Cross-provider experimental (OpenRouter llama-3.3-70b) | PASS | UAT Test 4 `result: pass` post b78bfad |
| Multi-tool (workspace_write + execute_code in one prompt) | DEFERRED | Routed to v2.7 retrospective per UAT-SC#10 scoping |
| Parallel-thread (Thread A workspace ops while Thread B accepts new prompt) | DEFERRED | Routed to v2.7 retrospective; Phase 077 multi-worker harness already covers thread-parallelism at streaming layer |
| Long-message (>= 50 prior messages OR >= 5KB user prompt with workspace_write) | DEFERRED | Routed to v2.7 retrospective |

Deferred items are tracked in 084-HUMAN-UAT.md as `result: skipped` with
explicit `reason:` blocks and do not block phase ship per the original
scoping notes in Plan 05 SUMMARY.

## Requirements Coverage

| Requirement | Plan(s) | Status | Evidence |
|-------------|---------|--------|----------|
| WS-01 (workspace_write persists across turns) | 084-02, 084-03 | SATISFIED | Truth #1 + UAT Tests 1-4, 15, 16 confirm writes succeed across all 6 providers |
| WS-02 (workspace_read with cap + truncation) | 084-02, 084-03, 084-05 | SATISFIED | Truth #2 + Plan 05 dispatcher normalizer ensures weak-model integer args work |
| WS-03 (workspace_list + workspace_delete) | 084-02, 084-03, 084-04, 084-05 | SATISFIED | Truth #3 + Plan 05 normalizer fixes OpenRouter list-empty bug |
| WS-04 (auto-versioning + workspace_diff) | 084-02, 084-03, 084-05 | SATISFIED | Truth #4 + UAT Test 2 confirms diff renders correctly |
| WS-05 (hybrid inline/bucket storage with configurable threshold) | 084-01, 084-02 | SATISFIED | Truth #5 + migration 054 bucket creation + service-layer threshold branch; >256KB bucket path covered by Plan 02 unit tests (live UAT deferred) |
| WS-06 (per-thread scope + RLS) | 084-01, 084-04, 084-05 | SATISFIED | Truth #6 + 4 RLS policies in migration 054 + REST `_verify_thread_ownership` |
| WS-07 (SSE events for write/delete) | 084-03, 084-05 | SATISFIED | Truth #7 + `ctx.emit` calls at dispatcher lines 879 + 974 |

## Artifact Verification (Three Levels)

| Artifact | Exists | Substantive | Wired | Status |
|----------|--------|-------------|-------|--------|
| supabase/migrations/054_workspace_files.sql | YES (105 lines) | YES (2 tables + RLS + bucket + constraints) | YES (applied to live DB; full-schema.sql contains 50 workspace_* refs) | VERIFIED |
| backend/app/db/workspace.py | YES | YES | YES (imported by workspace_service + tool_dispatcher) | VERIFIED |
| backend/app/services/workspace_service.py | YES | YES (write/read/list/delete/diff + hybrid storage + validate_path + soft limit) | YES (imported by tool_dispatcher + api/workspace) | VERIFIED |
| backend/app/services/tool_dispatcher.py | YES | YES (5 handlers + registry entries + Plan 05 normalizers) | YES (imported by agent loop) | VERIFIED |
| backend/app/services/openai_service.py (tool schemas) | YES | YES (5 workspace_* tools in get_tools) | YES (consumed by stream_*) | VERIFIED |
| backend/app/services/google_service.py (_sanitize + _translate_nullable_type) | YES | YES (Plan 05 fix) | YES (called by `_convert_tools_to_google`) | VERIFIED |
| backend/app/api/workspace.py | YES | YES (4 endpoints + `_decode_inline_content` ladder) | YES (`app.include_router(workspace.router)` at main.py:316) | VERIFIED |

## Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| google_service._sanitize_schema_for_google | google-genai types.Tool construction | _translate_nullable_type rewrites type:[X,null] -> nullable:true | WIRED |
| tool_dispatcher._handle_workspace_{list,read,diff} | db.workspace.list_files_in_thread / read_file / diff_versions | _normalize_optional + _normalize_optional_int at handler entry | WIRED |
| api/workspace._decode_inline_content | supabase-py content_inline bytea read path | hex-bytea decode at startswith(r"\x") branch | WIRED |
| api/workspace.router | FastAPI app | app.include_router at main.py:316 | WIRED |
| tool_dispatcher handler registry | agent loop tool execution | TOOL_HANDLERS dict entries at lines 1031-1035 | WIRED |

## Anti-Patterns Found

None. All code changes are additive, defensive, and pinned by unit tests.
No TODO/FIXME comments introduced in Plan 05; no placeholder return
values; no hardcoded empty data paths in the 3 modified source files.

## Schema Drift Gate

Migration 054 applied to live DB; full-schema.sql contains all 50
workspace_* references including the 2 UNIQUE constraints, 2 CHECK
constraints (size_bytes <= 10485760, char_length(path) <= 500), and 4
RLS policies.

## Goal Achievement

All 7 ROADMAP success criteria (WS-01..WS-07) satisfied with code +
unit-test + live-UAT evidence. The Plan 05 gap-closure plan converted
the previous `human_needed` status into `passed` by landing 3
confirmed-root-cause direct fixes and 22 pinning unit tests, then
operator-driven Chrome MCP re-UAT flipped the 3 blocker UAT rows
(Tests 3, 4, 9) from `issue` to `pass` without regressing the 4 already-
passing native-provider rows (Tests 1, 2, 15, 16).

7 deferred UAT scenarios (multi-tool, parallel-thread, long-message,
>256KB bucket, hostile path validation, 100-file soft limit) are
explicitly out-of-scope per the original UAT-SC#10 scoping notes in
084-HUMAN-UAT.md; they are routed forward to the v2.7 milestone
retrospective for separate evaluation.

## Status: PASSED

Phase 084 is ready for `/gsd:phase-complete`. No outstanding blockers.
No human verification items remaining (all 9 attempted UAT rows passed
2026-05-28).

---

*Verified: 2026-05-28*
*Verifier: gsd-verifier (re-verification mode -- post Plan 05 gap closure)*

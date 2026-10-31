---
phase: 306-ask-the-agent-and-run-workflows
plan: 03
subsystem: mcp / agent tool closure / outside ask start
tags: [mcp, tool-closure, contextvar, allow-list, trust-03, run-path, scope-binding]
requires:
  - 306-01 (search_vocabulary.py young home; migration 223 threads.origin_* + freeze)
  - 306-02 (outside_admission; not called here)
provides:
  - backend/app/services/outside_run_scope.py (ASK_TOOL_ALLOWLIST, outside_run_context, current_allowlist, narrow_schemas, outside_allowlist_for, refusal_payload, OUTSIDE_TOOL_REFUSAL, OutsideToolsetEmpty)
  - Seam A in search_vocabulary.with_search_vocabulary (offered tools narrowed on every provider branch)
  - Seam B in tool_dispatcher.dispatch_tool (refusal before every other gate; durable on mcp-origin threads)
  - inbound_inputs.wrap_untrusted_input(source=, notice=) + ASK_NOTICE; shared fixture tests/fixtures/phase306/ask_envelope.json
  - backend/app/services/outside_ask.py (ask_scope, resolve_ask_model, start_ask, wait_for_ask, read_ask, AskRead, AskModel, StartedAsk, AskScopeRefusal)
affects: [306-04, 306-05]
tech-stack:
  added: []
  patterns:
    - "a FRESH contextvars.Context passed to asyncio.create_task(context=...) carries a run-scoped allow-list into the producer, its child tasks and thread hops, and nothing from the caller"
    - "an allow-list read at two seams (offered schemas, dispatch) instead of a filter in get_tools (which would poison per-process caches)"
    - "a durable per-thread fact (frozen origin) cached per worker; read error fails closed and is never cached"
key-files:
  created:
    - backend/app/services/outside_run_scope.py
    - backend/app/services/outside_ask.py
    - backend/tests/unit/test_306_outside_run_scope.py
    - backend/tests/unit/test_306_dispatch_closure.py
    - backend/tests/unit/test_306_tool_closure_wire.py
    - backend/tests/unit/test_306_ask_envelope.py
    - backend/tests/unit/test_306_outside_ask.py
    - backend/tests/fixtures/phase306/ask_envelope.json
    - backend/tests/integration/test_306_ask_live.py
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/search_vocabulary.py
    - backend/app/services/inbound_inputs.py
    - backend/tests/unit/test_306_search_vocabulary_pure_move.py
    - backend/tests/unit/test_278_pure_move.py
    - .planning/seeds/SEED-303-an-expert-adds-scope-it-does-not-replace-it.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "306-03: the durable D-28 check refuses on a thread-origin READ ERROR and does not cache it; no pool or a non-UUID thread id is a literal no-op (no read, no refusal); a listed name never triggers a read; a phase_whitelist dispatch never reads"
  - "306-03: the STRUCTURED wire branch is OpenRouter on openrouter_tool_strategy='xml' (the setting that actually routes a native_tools=False OpenRouter row STRUCTURED); its offered set is read from the tool-list prose in the system message"
  - "306-03: test_278_pure_move keeps dispatch_tool AST-pinned with its two leading 306 statements exempted BY NAME (UNMOVED_AMENDED), rather than retiring the whole function from the fence"
  - "306-03: wrap_untrusted_input keeps ONE writer of the envelope (3 changed lines) rather than a second copy of the shape to hit the plan's 1-line diff target"
  - "306-03: start_ask takes keyword redis= (defaults to get_redis()) and reads the pool via get_pg_pool(), so 306-04 needs no extra plumbing"
requirements-completed: [MCP-04]
duration: ~70 min
completed: 2026-11-01
---

# Phase 306 Plan 03: The outside-run tool closure and the non-HTTP ask start Summary

**An ask started from an AI tool can only search and read the folders its key sees in its org, on
every provider path, and every later turn on its thread stays closed: one leaf module, two seams
(offered schemas in `with_search_vocabulary`, refusal first in `dispatch_tool`), a fresh-context
producer spawn in `outside_ask.py`, proven by a per-provider wire test and a two-org live test.**

## Performance

- **Duration:** ~70 min (first commit 2026-10-31T20:48Z, last task commit 21:09Z, plus the 10 min
  baseline run and the inherited-set proof)
- **Tasks:** 3 of 3
- **Commits:** 8 task commits (3 RED, 4 GREEN, 1 docs)
- **Files:** 9 created, 8 modified

## Tasks

| # | Task | RED commit | GREEN commit(s) |
|---|------|------------|-----------------|
| 1 | The closure: leaf, Seam B, Seam A (D-26 / D-27 / D-28) | `d19729812` | A `4d7a0b1c6` (leaf), B `a9cb8e23d` (Seam B + 278 fence amendment), C `cd5d0a71e` (Seam A + fence retirement) |
| 2 | The ask envelope + non-HTTP ask start / wait / read (D-01 / D-03 / D-08 / D-29 / D-30 / D-32 / D-33 / D-36 / D-37) | `5fdc40b47` | `b4e439701` |
| 3 | Live proof + ledger + SEED-303 note | `b0cc42d2f` (test) | docs `4cd6f752a` |

## Evidence

**Task 1.** The plan's verify set (`test_306_outside_run_scope`, `_dispatch_closure`,
`_tool_closure_wire`, `test_306_search_vocabulary_pure_move`, `test_278_registry_pin`,
`test_267_tool_floor_union`, `test_272_prompt_and_vocabulary`, `test_272_review_fixes`) plus
`test_278_pure_move`: **274 passed**. RED was run first: 14 failed + 2 collection errors.

- **Wire branches and models** (derived from `MODEL_CAPABILITIES`, first registry row per provider
  with no `api_surface`): OpenAI-compatible `gpt-4o` (native `tools` kwarg captured at the OpenAI
  client's `create`), Anthropic `claude-sonnet-5` (`tools` handed to `stream_anthropic`), Google
  `gemini-2.5-pro` (`tools` handed to `stream_google`), STRUCTURED `deepseek/deepseek-chat` on
  OpenRouter with `openrouter_tool_strategy='xml'` (no `tools` kwarg; names read from the tool-list
  prose in the system message). The REAL `run_agent_loop`, the REAL `open_stream` dispatcher and
  each REAL adapter run. Inside `outside_run_context` each branch offers **exactly the six**; outside
  it each offers the full list (non-vacuity). `tool_parser._KNOWN_TOOLS` and
  `context_window._TOOL_SCHEMA_TOKENS` are equal before and after (Pitfall 1). No `pytest.skip` in
  the file.
- Static checks: `grep -cE "^(from|import) app" outside_run_scope.py` = 0;
  `grep -c "narrow_schemas(" search_vocabulary.py` = 1; `tool_dispatcher.py` diff vs base: 4
  non-comment lines added, only the two `OWED, NOT BUILT` comment lines removed; `_TOOL_REGISTRY`
  = 30; `git diff 1e5364747 --stat` on `openai_service.py`, `agent_loop.py`, `run_producer.py`,
  `threads.py`, `provider_gateway/dispatcher.py` is empty.

**Task 2.** `test_306_ask_envelope` + `test_306_outside_ask` + `test_293_untrusted_fence` +
`test_293_inbound_inputs` + `test_293_inbound_start`: **95 passed** (RED first: 6 failed + a
collection error). `wait_for(` = 0, `copy_context` = 0, `context=outside_run_context(ASK_TOOL_ALLOWLIST)`
= 1, `httpx|fastapi` = 0 in `outside_ask.py`; `_ENVELOPE_RE = re.compile` still 1.

**Task 3.** `tests/integration/test_306_ask_live.py`: **5 passed, no SKIPPED line**, on the local
stack (Postgres :54322, Redis :6379), U a plain member of X and Y:
- all-folders X key: search, grep and read_document each find the in-scope token (`T_IN`, f2_doc in
  F2) and F's token; Y's token and the root document's token are never returned; read_document of
  the Y doc and the root doc return errors; the advertised tools are exactly the six with no
  `svc__tool` schema (plan-checker warning 3); thread `org_id` X, `origin_kind 'mcp'`, label and
  ref = the key; the user message equals the envelope; the runs row is X / U / completed.
- narrowed key (F2 only): scope = {F2}; only `T_IN` is found; F, root and Y tokens never appear;
  grep for them returns 0 matches.
- power tools (`execute_code`, `web_search`, `remember`, `save_skill`) and `gmail__send_message`:
  each refused with `tool_not_available_for_outside_ask`, zero handler calls, no `user_memory`,
  `skills` or `workspace_files` row for U after the test start.
- cap pause (`chat_max_tool_rounds=2` on the run's own settings copy): `runs.status` is `completed`
  while `read_ask` returns `needs_input`; then a `ToolContext` for that thread with the ContextVar
  unset and the real pool: `execute_code` refused (the durable D-28 read of the frozen origin),
  `search_documents` reaches its handler.
- `include_external=False` key: `ask_scope` refuses with `ask_needs_external`.
- **Driven RED by counterfactual** (each edit reverted, file byte-identical after): spawning the
  producer in a plain `Context()` (no allow-list) → 1 failed (the advertised set was the full list;
  the power-tool test still passed because the durable origin check refused them — which is the
  D-28 layer working on its own); additionally stamping `origin_kind='key'` → 4 failed.

**Backend unit baseline gate** (`node scripts/check-backend-unit-baseline.cjs`, once for the plan,
at `4cd6f752a`): **`70 failed, 11646 passed, 1 skipped, 2 xfailed, 2 xpassed`, 0 collection
errors — GATE PASSED (70 <= 71).** Inherited, proven by id set rather than a written number: the 70
ids re-run in isolation at HEAD → 68 failed; the same 70 ids with this plan's five modified backend
files (`tool_dispatcher.py`, `search_vocabulary.py`, `inbound_inputs.py`, `test_278_pure_move.py`,
`test_306_search_vocabulary_pure_move.py`) checked out at base `1e5364747` → 68 failed; **the two
sets are identical (`diff` empty)**. The other 2 are the known order-dependent
`test_cross_worker_cancellation` ids (pass in isolation on both trees). The live-LLM
`test_email_ingestion` id passed in this run.

**Ledger and size gates:** `check-hot-file-ledger.cjs 306` OK; `check-claude-md-size.cjs` OK
(108,501 chars); `check-seeds-register.cjs` OK. SEED-303 diff touches only the `status_note` line;
`status:` still `partially-answered`.

**Local-DB lock:** taken with noclobber (`306-03 1170 2026-10-31T21:01:26Z`) before the live suite,
released after the baseline and its inherited-set re-runs. No `anon` statement
(`grep -c "SET ROLE anon\|role anon"` = 0). The cloud project and the Supabase MCP were not touched.

## Decisions Made

- **Durable-check failure modes (the plan asked for these to be recorded):** read error → refuse
  (fail closed), NOT cached, so the next call reads again; no pool or a thread id that is not a
  UUID → no read and no refusal; an allow-listed name never triggers the read; a dispatch with a
  `phase_whitelist` never reads (the phase branch behaves exactly as before). The cache is a bounded
  per-process dict (4096, cleared when full), safe across workers because mig 223 freezes the origin.
- The STRUCTURED branch uses OpenRouter's `xml` tool strategy: that is the setting that actually
  routes a `native_tools=False` OpenRouter row STRUCTURED (`resolve_calling_mode` returns NATIVE for
  OpenRouter on `quality`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `test_278_pure_move` pins `dispatch_tool` AST-identical to 278's base**
- **Found during:** Task 1, commit B
- **Issue:** Seam B's two statements broke `test_unmoved_bindings_are_ast_identical`; that fence's
  `RETIRED` mechanism only covers moved names.
- **Fix:** a named `UNMOVED_AMENDED = {"dispatch_tool": (reason, 2)}` entry; the comparison drops
  exactly the two statements after the docstring and still pins every other statement. Reason text
  names D-26 / D-28 and the owning suite (SEED-177: retire deliberately).
- **Files:** `backend/tests/unit/test_278_pure_move.py` · **Commit:** `a9cb8e23d`

**2. [Plan target vs one writer] `inbound_inputs.py` removed 3 lines, not ≤ 1**
- The acceptance criterion asked for only the signature line to change. The `source` literal and
  the notice expression sit inside the one return expression, so ≤ 1 would have needed a second copy
  of the envelope shape. One writer was kept; the 293 output is pinned byte-identical by a literal in
  `test_306_ask_envelope.py`, and every 293 envelope suite is green. `_ENVELOPE_RE` is unchanged.
- **Commit:** `b4e439701`

**3. [Rule 1 - Test harness] Tool results echo their own arguments**
- **Found during:** Task 3, first live run
- **Issue:** grep and search return the caller's `pattern` / `query`, so the Y token appeared in a
  result the MODEL had sent, not one the knowledge base returned.
- **Fix:** the live suite strips the top-level `pattern` / `query` keys before scanning, and checks
  each tool on its own (search hit, grep match counts, read_document text) so no tool carries
  another's non-vacuity.
- **Commit:** `b0cc42d2f`

**4. [Interface] `start_ask` takes `redis=` (keyword, defaults to `get_redis()`)**
- The plan's signature had no redis; the `mcp/dispatch.py` precedent passes it optionally. The pool
  comes from `get_pg_pool()`.

**5. [Wording] `outside_run_scope.py`'s docblock avoids the token `copy_context`** so the static
fence that forbids a copied context in the leaf stays meaningful.

### TDD note

Task 3's live suite was not observed RED before its commit: the code it proves landed in Tasks 1-2
(whose RED commits precede their GREEN). It was instead driven RED by two counterfactual edits of
`outside_ask.py` (1 and 4 failures), both reverted before commit.

## Known Stubs

None. `start_ask` / `read_ask` have no production caller yet by design: 306-04 registers
`ask_agent` / `get_answer` on top of them.

## Threat Flags

None outside the plan's register. T-306-01/02/03/04/14/15/16/21/29 are mitigated and each has a
test named above (T-306-15: `test_the_producer_runs_in_a_fresh_context_with_the_allowlist_and_the_acting_org`
asserts a request-set `usage_sink` collector is invisible in the task).

## Owed (not done here, by design)

- 306-04 must register `ask_agent` only on top of this closure (D-02 fail-closed gate: the wire test
  is green on all four branches) and prove D-37 (no MCP / HTTP input reaches the overrides).
- `graphify update .` was not run in the worktree (generated output); run it on the merged tree.
- Cloud migration 223 remains owed (306-01's note).

## Self-Check: PASSED

All 9 created files exist; the 8 task commits (`d19729812`, `4d7a0b1c6`, `a9cb8e23d`, `cd5d0a71e`,
`5fdc40b47`, `b4e439701`, `b0cc42d2f`, `4cd6f752a`) are in this branch since base `1e5364747`.
STATE.md and ROADMAP.md were not modified (the orchestrator owns them).

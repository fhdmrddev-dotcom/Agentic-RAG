---
phase: 306-ask-the-agent-and-run-workflows
plan: 05
subsystem: mcp / workflow tools / spend / api-key activity / verification tooling
tags: [mcp, workflows, run-workflow, spend, api-keys-activity, validation, uat-tooling]
requires:
  - 306-01 (key_run_start.validate_key_start, key_run_read.read_key_run, migration 223 threads.origin_*)
  - 306-02 (outside_admission claim / bind / drop, acquire / release)
  - 306-03 (outside_ask: ask_scope / resolve_ask_model / start_ask)
  - 306-04 (results.HandlerRefusal, tools.STARTS + start bucket, is_granted, the mcp origin kind)
provides:
  - backend/app/mcp/run_tools.py (list_workflows, run_workflow, get_workflow_run, NO_WORKFLOW_SENTENCE, NO_RUN_SENTENCE)
  - app.mcp.results ListWorkflowsArgs / RunWorkflowArgs / GetRunArgs / WorkflowList / RunStarted / RunRead + render arms, run_link
  - unattended_launch.launch_unattended_run(thread_origin=...)
  - key_run_read files_base=None MCP arm
  - outside_ask.composed_folder_ids
  - rates.py per_root runs arm keyed from the thread's mcp origin; ledger source mcp for a keyed run
  - mcpKeyFacts.mcpBarKind; MCP activity words replied / run started / ask_needs_external / starts limit; the D-29 draft hint
  - scripts/uat-306-ask-roster.py, scripts/burst-306-outside-starts.py
  - 306-VALIDATION.md
affects: [phase verification / UAT drive after the merge]
tech-stack:
  added: []
  patterns:
    - "the launch is awaited in asyncio.create_task(coro, context=contextvars.Context()), so the MCP request's ContextVars never reach the run, and the drive task inherits the fresh context"
    - "spend attributes a run to a key through a primary-key LEFT JOIN on the thread's frozen origin; the SQL source stays 'run' and Python maps the display"
key-files:
  created:
    - backend/app/mcp/run_tools.py
    - backend/tests/unit/test_306_run_tools.py
    - backend/tests/unit/test_306_spend_by_key.py
    - backend/tests/unit/test_306_uat_scripts.py
    - backend/tests/integration/test_306_workflow_tools_live.py
    - backend/tests/integration/test_306_spend_live.py
    - scripts/uat-306-ask-roster.py
    - scripts/burst-306-outside-starts.py
    - .planning/phases/306-ask-the-agent-and-run-workflows/306-VALIDATION.md
  modified:
    - backend/app/mcp/results.py
    - backend/app/mcp/tools.py
    - backend/app/services/key_run_read.py
    - backend/app/services/outside_ask.py
    - backend/app/services/unattended_launch.py
    - backend/app/db/rates.py
    - backend/tests/unit/test_306_tool_defs.py
    - backend/tests/unit/test_305_tool_defs.py
    - backend/tests/unit/test_305_spend_cte.py
    - backend/tests/unit/test_306_key_run_pure_move.py
    - frontend/src/components/settings/apiKeys/mcpCallWords.ts
    - frontend/src/components/settings/apiKeys/mcpKeyFacts.ts
    - frontend/src/components/settings/apiKeys/ApiKeyCallStrip.tsx
    - frontend/src/components/settings/apiKeys/mcpKeyCopy.ts
    - frontend/src/components/settings/apiKeys/McpKeyFields.tsx
    - frontend/src/components/settings/apiKeys/__tests__/mcpCallWords.test.ts
    - frontend/src/components/settings/apiKeys/__tests__/mcpKeyFacts.test.ts
    - frontend/src/components/settings/apiKeys/__tests__/ApiKeyCallStrip.test.tsx
    - frontend/src/components/settings/apiKeys/__tests__/McpKeyFields.test.tsx
    - frontend/src/components/settings/apiKeys/__tests__/ApiKeyActivity.mcp.test.tsx
    - frontend/src/components/settings/apiKeys/__tests__/ApiKeyKindChoice.test.tsx
    - frontend/src/components/org/__tests__/OrgMcpSwitchCard.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "306-05: run_workflow checks the narrowed list BEFORE claiming, so an id outside the key never takes an idempotency claim or a lease; validate_key_start then gets the same narrowed ids"
  - "306-05: an idempotency Existing returns the first run's RunStarted, read through the same credential-bound access statement (a different request adds a note); a claim whose run this key cannot read answers NO_RUN_SENTENCE"
  - "306-05: an entitlement refusal answers its upgrade_hint (or a fixed sentence), never the raw detail dict"
  - "306-05: the spend tool is derived in SQL (one EXISTS on workflow_runs by thread): run_workflow when the thread has a workflow run, else ask_agent. This changes fewer pinned lines than a Python lookup"
  - "306-05: the MCP file arm lives in _file_links(base=None) and returns names only; _file_links is retired by name from the pure-move fence, and read_key_run's body is still the base slice"
  - "306-05: mcpBarKind names ask_agent / run_workflow, mirroring the server's STARTS annotation (the strip has no catalogue); McpKeyFields reads the ask lead from the catalogue"
requirements-completed: [MCP-06, GUARD-01, MCP-04, MCP-05]
duration: ~1 h 50 min (first commit 02:24, last 03:20 local, plus the 11 min baseline and the inherited-set proof)
completed: 2026-11-01
---

# Phase 306 Plan 05: The workflow tools, spend by key, the key activity words, and the owed UAT scoreboard Summary

**An AI tool can now list the workflows its key may run, start one, and get the run id back
straight away. It can then follow the run to its result, or to "Waiting on {who}. It can only be
answered in Syrel: {link}". It can never read a run another credential started. Operator spend shows
MCP asks and runs under the key that started them, and the totals do not change. A key's activity
says "replied" or "run started" for the new tools. Finally, the phase's lived, cross-provider and
burst rows are written up in 306-VALIDATION.md as owed rows, with dry-run-proven driver scripts
ready for each.**

## Tasks

| # | Task | RED commit | GREEN commit(s) |
|---|------|------------|-----------------|
| 1 | list_workflows / run_workflow / get_workflow_run, thread_origin kwarg, MCP file arm (D-10..D-15, D-05, D-35, D-28) | `e30236c47` | `94ae11178` |
| 2 | Spend by key (D-18 / D-34) and the MCP key activity words (D-19, UI-SPEC §7) | `d0bec3a61` | `450c5d18f`, refactor `45f5733d2` |
| 3 | Roster driver, burst script, 306-VALIDATION.md, gates, ledger (D-20 / D-21 / D-22 / D-37 / D-38) | `c432e7cf6` | `2b835735c`, docs `520a45770`, `a9f2de15e` |

## Evidence

**Task 1.**
- Unit suites: `test_306_run_tools` (46), `test_306_tool_defs`, `test_305_tool_defs`,
  `test_306_outside_ask` and `test_306_key_run_pure_move` gave 137 passed. The wider
  293/304/305/306/scheduler/unattended set gave 1501 passed. The RED run failed at collection.
- Live suite `test_306_workflow_tools_live` (4 tests, **no SKIPPED**) runs the real `/mcp` path,
  the real `validate_key_start`, admission on local Redis, and the **real unattended drive**
  (harness engine and agent sub-loop). Only the model is scripted. It shows:
  1. `run_workflow` returns in under 2 s while the gated model still blocks the drive. The run is
     asserted not terminal at that point.
  2. The `workflow_runs` row and its thread both carry `origin_kind 'mcp'` plus this key.
  3. A second key, and a random id, get the one refusal sentence.
  4. **D-28 guard:** the agent phase's `workspace_write` (not on the ask allow-list) ran on an
     mcp-origin thread. One `notes.md` row is in `workspace_files`, and the completed read lists it
     by name with no `/inbound/files/` link.
  5. An input step reads `Waiting on …`, and the question text is not shown.
  6. Maintenance refuses `run_workflow` while `list_workflows` and `get_workflow_run` still answer.
  7. A key narrowed to a sibling folder neither lists nor starts the workflow.
  8. The key's lease set is back at 0 after the drive ends.
- Neighbouring suites `test_306_ask_mcp_live`, `test_305_tools_live`, `test_306_ask_live`, the 293
  inbound units and `test_304_acting_reads_fence`: 66 passed.
- Acceptance checks:
  - `unattended_launch.py` adds 2 non-comment lines.
  - The diffs of `workflow_kickoff.py`, `acting_member_reads.py` and `threads.py` are empty.
  - `/inbound/files` appears 0 times in `run_tools.py`.
  - `origin_kind = 'mcp'` appears exactly once in `run_tools.py`.

**Task 2.**
- Backend unit: `test_306_spend_by_key`, `test_305_spend_cte` and `test_268_spend_rollup` gave 32
  passed. Every spend / rates / ledger unit suite gave 95 passed.
- Live: `test_306_spend_live` and `test_305_spend_live` gave 3 passed. Input and output totals rise
  by **exactly** the two MCP runs' tokens (4000 / 900). Roots rose by 2 and No Expert by 2. The
  ledger reads `mcp` with the label for both runs (`ask_agent` and `run_workflow`). An in-app run
  still reads `("run", None, None, None)`.
- Acceptance counts:
  - `'run'::text AS source` 1, the same as base.
  - `WHERE ro.source = 'run'` 1, the same as base.
  - `parent_run_id IS NULL` 1.
  - `m.org_id` 0.
  - The admin spend diff is empty.
  - `mcpKeyCopy.ts` has 0 imports.
- Frontend: all 23 apiKeys + OrgMcpSwitchCard files pass, 303 tests.

**Task 3.**
- `test_306_uat_scripts`: 11 passed.
- The roster `--dry-run` printed:
  - OpenAI `gpt-5.6-sol`
  - Anthropic `claude-sonnet-5` and `claude-opus-4-8`
  - Google `gemini-3.5-flash`
  - DeepSeek `deepseek-v4-pro`
  - Zhipu `glm-5.2`
  - MiniMax `MiniMax-M3`
  - Moonshot `kimi-k2.6` (⛔ expected, BUG-261024-01)
  - OpenRouter `deepseek/deepseek-v4-pro` (STRUCTURED)

  This matches the 306-RESEARCH derivation. The ids are re-derived at run time.
- The burst `--dry-run --count 30` printed its plan (20 MCP asks + 10 `/inbound` starts) and the env
  var names. It never printed their values.
- `grep -rn "uat-306\|burst-306" backend/app` returns 0.
- VALIDATION.md: 29 `OWED`, 1 `⛔`.

**Plan gates (once):**
- **Backend baseline:** `70 failed, 11779 passed`, GATE PASSED (≤ 71).
  - 68 are stable. Re-run in isolation at HEAD and again with this plan's six backend app files at
    base `78030de06`, both runs gave 68 failed, and the sets are identical.
  - The other 2 are the order-dependent `test_cross_worker_cancellation` pair.
- **Count gate:** `count gate OK — 597/597 pinned files present, no per-file decrease, 0 failing`
  (13754 / 12714).
- **tsc:** 61 errors in 27 files, the same as at base. None is in a changed file.
- **Neutrality fence:** empty, pasted in VALIDATION §8.
- `_TOOL_REGISTRY` is 30.
- **Ledger and CLAUDE.md size:** both gates OK.

**Local-DB lock:** taken with noclobber three times (Task 1 live, Task 2 live, the baseline plus
inherited-set reruns) and released after each. The cloud project and the Supabase MCP were not
touched. No roster or burst row was run against a provider or a running backend.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three suites outside the plan pinned the old `mcpKeyCopy` wording**
- `OrgMcpSwitchCard.test.tsx`, `ApiKeyActivity.mcp.test.tsx` and `ApiKeyKindChoice.test.tsx`
  asserted the 305 sentences that UI-SPEC rewords. All three were updated to the new wording in the
  RED commit `d0bec3a61`.

**2. [Rule 3 - Deliberate fence retirement] `test_305_tool_defs.py`**
- Its `SERVED` list gains the three workflow names.
- Its "an unregistered 307 name is a protocol error" case now uses a truly unknown name
  (`delete_workflow`), because `run_workflow` is served now (D-15, SEED-177 wording in the
  docblock).

**3. [Rule 2 - Correctness] Entitlement refusals**
- `validate_key_start`'s entitlement refusal carries a dict detail. `run_workflow` answers its
  `upgrade_hint` (or a fixed sentence) instead of rendering a raw dict to the AI tool.

**4. [Rule 1 - D-11 invariant] McpKeyFields no longer names `ask_agent`**
- The GREEN commit keyed the D-29 hint on a literal tool name. The refactor `45f5733d2` reads the
  ask group's lead from the server catalogue instead, so the file's "tool names only from the
  catalogue" invariant holds.

**5. [Test setup] Live suite stubs, each named in the suite**
- The live workflow suite stubs `entitlement_service.enforce_entitlement`, because the local test
  org's plan is not what this suite measures.
- It points `app.dependencies.get_service_role_supabase` at the local admin client, the way the
  306-03 `ask` fixture does for `outside_ask`.
- Its workflows declare one input. A key cannot send a typed task (293-IN-06 `needs_task`).

### Design notes inside the plan's latitude
- The plan suggested `composed_folder_ids` be called from `ask_scope`. Instead, both read through
  one private `_compose`, so `ask_scope` still gets the visible-folder list for a key that is not
  narrowed. It is still one composition and one acting connection.
- The live spend suite seeds the two runs through the app's own writers (`insert_run`, a thread
  stamped at INSERT, a `workflow_runs` row) rather than driving full asks. That isolates the spend
  path. The full drives are covered by the Task 1 and 306-04 live suites.

## Known Stubs

None.

## Threat Flags

None outside the plan's register. Each of the following has a named test above: T-306-07, -09,
-10, -13, -15, -17, -18, -32, -33, -34 and -35.

## Owed (not done here, by design)

- Every UAT row in 306-VALIDATION.md §2-§5 is owed to the orchestrator after the merge:
  - the 8-row roster
  - 1-2 real `claude` CLI rows
  - the four axes, including the ≥ 30-start burst and the D-35 re-measure
  - the Redis-down drill
  - the 45 s wait call
  - the three G-4 rows
- Deploy (D-25): cloud 220 → 221 → 222 → 223, each with its own per-action approval, then
  `get_advisors(security)`. 306 deploys after 304+305.
- `graphify update .` should run on the merged tree.

## Self-Check: PASSED

All 9 created files exist. The 9 commits (`e30236c47`, `94ae11178`, `d0bec3a61`, `450c5d18f`,
`c432e7cf6`, `2b835735c`, `45f5733d2`, `520a45770`, `a9f2de15e`) are on this branch since base
`78030de06`. STATE.md and ROADMAP.md were not modified.

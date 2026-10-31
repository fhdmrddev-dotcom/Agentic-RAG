---
phase: 306-ask-the-agent-and-run-workflows
written_by: 306-05 (2026-11-01)
status: automated proof recorded; every lived / cross-provider / burst row OWED
independent_review: self
---

# Phase 306 — Validation: SC → proof map, owed UAT rows, gate record

This file is the 305-04 pattern. Plans 306-01..05 prove each success criterion in code and record
the result here. Every row that needs a real provider, a real `claude` CLI, a running backend or
Chrome is written down as **OWED**, with what it must show and where its evidence goes. None of
them was run by an executor. The orchestrator drives them after the merge (D-20, D-21, D-22). No
row is marked as passing before it has been driven.

Evidence folder: `.planning/phases/306-ask-the-agent-and-run-workflows/evidence/`. The two driver
scripts write there.

## 1. SC → proof map (automated)

| SC | What must be true (ROADMAP Phase 306) | Proven by (automated) | Latest result |
|----|----------------------------------------|-----------------------|---------------|
| **SC1** (MCP-04) | `ask_agent` answers with citations and confidence within the wait budget; past it, a handle that `get_answer` reads; the same idempotency key returns the same run | `test_306_ask_tools.py`, `test_306_tool_defs.py`, `test_306_idempotency.py`, `test_306_settings_knobs.py`; live `test_306_ask_mcp_live.py` (answer + citation, one run per key, 5 s budget then handle, foreign handle refused) | 306-04: 156 passed, no SKIPPED; re-run green in 306-05 (66 passed with the 293 / 305 neighbours) |
| **SC2** (MCP-04) | Across the 8-row roster, an ask's audit shows read-only tools only, even when the prompt asks for power tools; an ask needing a person ends "needs input in the app" + link | `test_306_outside_run_scope.py`, `test_306_dispatch_closure.py`, `test_306_tool_closure_wire.py` (4 wire branches: OpenAI-compatible, Anthropic, Google, STRUCTURED OpenRouter), `test_306_outside_ask.py`; live `test_306_ask_live.py` (two orgs, power tools refused, cap pause reads `needs_input`) | 306-03: 274 passed. **The roster itself is OWED (§2).** |
| **SC3** (MCP-05) | The ask appears in the member's history, marked as started from MCP | `test_306_thread_origin_wire.py`, `test_293_origin_reads.py`, `ChatHistoryColumn.origin306.test.tsx`, `RunOriginLine.test.tsx`, `runOriginVocabulary.test.ts`, `UserMessageBubble.outsideAsk.test.tsx`, `outsideAskEnvelope.test.ts`; `test_306_migration_223_live.py` (origin frozen) | 306-04 green. **G-4 row 1 is OWED (§5).** |
| **SC4** (MCP-06) | `list_workflows` lists only what the key may run; `run_workflow` returns a run id at once; `get_workflow_run` returns status and result; a paused run reads "waiting on {person}" + link and cannot be answered over MCP; a key reads only runs it started; a workflow outside a narrowed key is refused | `test_306_run_tools.py` (46: narrowing incl. unbound = outside, start order, fresh Context, at-once return, one access statement, every status sentence, no `/inbound/files` link, `thread_origin`, `composed_folder_ids`), `test_306_tool_defs.py` (eight served names, `run_workflow` STARTS, maintenance), `test_306_key_run_pure_move.py` (`_file_links` retired by name); live `test_306_workflow_tools_live.py` (4: real `/mcp` + real unattended drive; run id in < 2 s while the drive is gated; run + thread stamped `mcp` + this key; a second key reads the one refusal; **D-28 guard: the phase's `workspace_write` ran on an mcp-origin thread**; input step reads `Waiting on …` without the question; maintenance refuses the start, reads answer; a key narrowed elsewhere neither lists nor starts; lease back to 0 after the drive) | 306-05: unit 137 passed; live 4 passed, no SKIPPED. **G-4 row 2 is OWED (§5).** |
| **SC5** (GUARD-01) | At a limit, MCP ask / run and `/inbound` starts get "try again in N s" (tool error / 429 + `Retry-After`) while in-app chat is not slowed; Redis down refuses outside starts only; ask and run usage in spend by org and key | `test_306_admission.py`, `test_306_inbound_admission.py`, `test_306_settings_knobs.py`; live `test_306_admission_redis_live.py`, `test_306_ask_mcp_live.py` (per-key refusal, lease released); spend: `test_306_spend_by_key.py`, `test_305_spend_cte.py` (the `NULL::uuid AS api_key_id` pin retired under D-34), `test_268_spend_rollup.py`; live `test_306_spend_live.py` (input / output totals rise by EXACTLY the two runs' tokens, roots +2, No Expert +2, ledger rows `mcp` + label + `ask_agent` / `run_workflow`, an in-app row unchanged), `test_305_spend_live.py`; frontend `mcpCallWords.test.ts`, `mcpKeyFacts.test.ts`, `ApiKeyCallStrip.test.tsx`, `McpKeyFields.test.tsx`, `apiKeyFacts.test.ts` | 306-05: spend unit 32 passed, live 3 passed; the four apiKeys suites green. **The in-app-not-slowed half, the Redis-down drill and the burst are OWED (§3, §4).** |

## 2. The cross-provider roster (D-20 / D-37 / D-38) — all OWED

Driver: `backend/venv/Scripts/python scripts/uat-306-ask-roster.py --key-id <an MCP key with
ask_agent and Include mail and synced sources>`. It derives the ids from `MODEL_CAPABILITIES` at
run time (never the table below), drives each row per-request through `resolve_ask_model(model=…,
provider=…)` (no global setting is changed), sends one power-tool request and one benign question,
and writes `evidence/roster-<provider>-<model>.json`. A row passes only when the executed tool names
stay inside `ASK_TOOL_ALLOWLIST` and the benign question got an answer.

The ids below are what `--dry-run` printed on 2026-11-01. Re-derive before driving: never trust them.

| # | Provider | Model (dry-run 2026-11-01) | Must show | Evidence | Status |
|---|----------|----------------------------|-----------|----------|--------|
| 1 | OpenAI | `gpt-5.6-sol` | power ask: no `execute_code` / `web_search` / `remember` executed; benign: an answer with citations | `roster-openai-*.json` | OWED |
| 2 | Anthropic | `claude-sonnet-5` and `claude-opus-4-8` (Open Q5: both rows) | same | `roster-anthropic-*.json` | OWED |
| 3 | Google | `gemini-3.5-flash` | same (historically the highest-risk emission row) | `roster-google-*.json` | OWED |
| 4 | DeepSeek | `deepseek-v4-pro` | same | `roster-deepseek-*.json` | OWED |
| 5 | Zhipu / GLM | `glm-5.2` | same | `roster-zhipu-*.json` | OWED |
| 6 | MiniMax | `MiniMax-M3` | same | `roster-minimax-*.json` | OWED |
| 7 | Moonshot / Kimi | `kimi-k2.6` | same; **⛔ expected: BUG-261024-01** (the account's balance / 429). Drive it and record what happens; a blocked row stays in the table | `roster-moonshot-*.json` | OWED (⛔ expected) |
| 8 | OpenRouter | `deepseek/deepseek-v4-pro` | same, on the STRUCTURED path (`native_tools: False`, Pitfall 1) | `roster-openrouter-*.json` | OWED |

**Real `claude` CLI rows (1-2), OWED.** A separate `claude -p --strict-mcp-config --mcp-config`
process with the key from `SYREL_MCP_KEY` (secret never printed): (a) `ask_agent` with a question
about a document in the key's org returns the answer, its Sources and the chat link; (b)
`run_workflow` then `get_workflow_run` on a published workflow. Evidence: `evidence/cli-ask.txt`,
`evidence/cli-run.txt`, plus the `audit_log` rows. Status: **OWED**.

## 3. The four axes (D-21) — all OWED

| Axis | Scenario | Must show | Evidence | Status |
|------|----------|-----------|----------|--------|
| Multi-tool | One MCP ask whose answer needs `search_documents` then `read_document` | The run's assistant messages show both tools executed, both inside the allow-list; the answer cites the read document | `evidence/axis-multitool.json` (run id, tool names) | OWED |
| Parallel-thread | An in-app thread streams while an MCP ask runs | The in-app first-token time (TTFT) beside a baseline taken with no MCP ask running: not slowed beyond noise; both finish | `evidence/axis-parallel.json` (two TTFTs, run ids) | OWED |
| Long-message | One MCP ask with a ≥ 5 KB question | Answered, or a handle then `get_answer`; the bubble in the app shows the whole question with no envelope | `evidence/axis-long.json` + a screenshot | OWED |
| **Burst (≥ 30 starts)** | `SYREL_MCP_KEY=… SYREL_WORKFLOW_KEY=… SYREL_WORKFLOW_ID=… backend/venv/Scripts/python scripts/burst-306-outside-starts.py --count 30` against the running backend, while one in-app chat is sent | Every call classified (answered / handle / started / refused-admission / limited / unavailable); **0 connections `idle in transaction`** after (the BUG-261031-03 shape); one `audit_log` row per call (the BUG-261031-04 shape, allowing the CR-02 refusal throttle); the in-app chat answers. Then re-measure the D-35 defaults (2 per key, 4 per org, 6 per provider) against what the burst shows and record whether they stand | `evidence/burst-<timestamp>.json` (written by the script) + the `audit_log` count | OWED |

## 4. The Redis-down drill and the wait budget — OWED

| Row | Scenario | Must show | Evidence | Status |
|-----|----------|-----------|----------|--------|
| Redis-down drill | `docker stop` the dev Redis; call `ask_agent` and `run_workflow` over MCP and `POST /inbound/...`; send one in-app chat; start Redis again | MCP: **Rate limiting is unavailable right now, so this call was refused. Try again in a minute.**; `/inbound`: 503 with that detail; the in-app chat still answers (no new check on the in-app path, D-16); after restart, outside starts are admitted again | `evidence/redis-down.txt` (each reply), `audit_log` `admission_unavailable` rows | OWED |
| One 45 s wait call (Pitfall 3) | Set `mcp_ask_wait_seconds` to 45 in Settings → Integrations; one `ask_agent` from the real `claude` CLI whose answer takes longer | The CLI receives the handle sentence before its ~60 s default abort (305 §5); `get_answer` later returns the answer. Restore 30 afterwards | `evidence/wait-45s.txt` (wall times) | OWED |

## 5. G-4 lived-experience rows (D-22; UI-SPEC §Surface 5, verbatim) — all OWED

Claude drives each in Chrome and with a real `claude` CLI after the merge. **Switch to the key's
org first, then reload** (Pitfall 11: the history filters by the active org; Pitfall 12: a new
thread appears only after a refetch). Each row keeps its own evidence: screenshot + DOM read + DB row.

| Row | Scenario (verbatim) | Evidence it needs | Status |
|-----|---------------------|-------------------|--------|
| **G4-1 The ask in thread history, marked.** (run first) | A real `claude` CLI session (key from `SYREL_MCP_KEY`) calls `ask_agent` with a question about a document in the key's org. In Chrome, with **that org active**, reload: the history column shows the thread (title from the question) with the second line **[Bot] Started by AI tool key {label}** (`data-origin-kind="mcp"`). Opening it shows the question bubble with **only the question text** (no `<external_input`, no `[SYSTEM NOTICE`), the bubble note **Asked from an AI tool. In this chat the agent only searches and reads your documents.**, and the answer with its citations and confidence. Readback: Admin → Spend shows the run as **MCP · {label}**, never "No Expert". | CLI transcript; history-row DOM + screenshot; bubble DOM; the `threads` row (`origin_kind = 'mcp'`); the Admin → Spend ledger cell (DOM) | OWED |
| **G4-2 A paused run waits on a person.** | `run_workflow` on a published workflow with an approval or input step returns a run id at once; `get_workflow_run` returns **Waiting on {who}. It can only be answered in Syrel: {link}**. Opening the link in Chrome shows the run page, paused, with the shipped `WaitingOnLine` and **[Bot] Started by AI tool key {label}**; the 301 "Waiting on you" list reads **started by an AI tool**. No MCP tool answers it. | CLI transcript (start + read); run page DOM + screenshot; the Waiting-on-you list DOM; the `workflow_runs` row (`origin_kind = 'mcp'`) | OWED |
| **G4-3 Admission refusal while in-app chat answers.** | In Settings → Integrations set **Running at once, per key** to 1 and Save. From the CLI start two asks back to back while, in the same moment, an in-app chat is sent. The second ask returns **Too many questions and runs are already in progress for this key. Try again in 15 seconds.**; the in-app chat streams normally (its first-token time recorded beside a baseline). Settings → API keys → the key's **Show activity** reads **✕ refused: too many questions and runs already in progress for this key** with the tall refused bar. Restore the limit to 2 afterwards. | CLI transcript; the Settings field before/after (DOM); in-app TTFT + baseline; Show activity row DOM + screenshot; `audit_log` `api_key.refused` `admission:credential` | OWED |

## 6. Deploy — owed to the operator (D-25)

306 deploys **after** the 304+305 deploy, never before it.

1. Cloud migrations in order, each pasted into the cloud SQL editor with its own per-action
   approval: **220 → 221 → 222 → 223**. Then `get_advisors(security)` (CLAUDE.md: run it as part of
   the deploy parity checklist).
2. No new env var: the four outside-start knobs and `mcp_ask_wait_seconds` are `app_settings` rows
   with defaults from migration 223.
3. After deploy: one `claude` CLI `ask_agent` and one `run_workflow` against the cloud `/mcp` URL.

## 7. Recorded decisions

- **G-2 waived (D-23).** The UI is the shipped 293 origin mark plus Settings number controls; no
  sketch. Re-open trigger: the operator asks to see one.
- **G-8 (D-24).** Five serial plans, because every plan writes the local DB (worktree rule 4).
- **D-28 regression guard.** An MCP-started workflow's phases keep their published tool lists:
  the live suite runs `workspace_write` (not on the ask allow-list) on an mcp-origin thread.
- **D-34.** The spend key comes from the thread's origin. A later in-app message on an MCP ask's
  thread is attributed to the same key: a thread's origin is frozen (migration 223).

## 8. Gate record (306-05, the phase's last plan)

| Gate | Result |
|------|--------|
| Backend unit baseline (`check-backend-unit-baseline.cjs`, ceiling 71) | 70 failed, GATE PASSED; all inherited (§8.1) |
| Vitest count gate (`GSD_VITEST_MAX_WORKERS=2`) | count gate OK, 0 failing (§8.1) |
| Frontend typecheck (`tsc -p tsconfig.app.json`) | 61 errors in 27 files, the same count and files as 306-04's close; none in a file 306-05 changed |
| `_TOOL_REGISTRY` | 30 (unchanged) |
| `grep -rn "uat-306\|burst-306" backend/app` | 0 |
| Ledger / size | both gates OK (§8.1) |

**Phase neutrality fence** (against the phase base `c3a5ea888`), output pasted verbatim:

```
$ git diff c3a5ea888 --stat -- backend/app/api/threads.py backend/app/services/agent_loop.py backend/app/services/provider_gateway/dispatcher.py backend/app/services/run_producer.py backend/app/services/workflow_kickoff.py frontend/src/lib/api.ts frontend/src/pages/SettingsPage.tsx frontend/src/components/chat/MessageItem.tsx
$
```

(empty: none of the eight files changed in Phase 306)

### 8.1 Gate results

Run once for the plan (and the phase), 2026-11-01, in the 306-05 worktree.

- **Backend unit baseline** (`node scripts/check-backend-unit-baseline.cjs`, local-DB lock held):
  `70 failed, 11779 passed, 1 skipped, 2 xfailed, 2 xpassed`, 0 collection errors, **GATE PASSED
  (70 ≤ 71)**. These 70 are inherited and none was added by this plan:
  - **68 stable.** The 70 ids were re-run in isolation at HEAD, then again with this plan's six
    changed backend app files checked out at base `78030de06` (`results.py`, `tools.py`,
    `key_run_read.py`, `outside_ask.py`, `unattended_launch.py`, `rates.py`). Both runs gave
    **68 failed, and the two sets are identical** (`diff` empty). The files were restored to HEAD
    afterwards. The 68 are spread across 22 files that this plan never touched (`test_sql_service`,
    `test_retrieval_service`, `test_explorer_agent`, …).
  - **2 order-dependent.** The two `test_cross_worker_cancellation` ids pass in isolation. This is
    the same pair 306-01 and 306-04 recorded.
- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, worktree
  root): **`count gate OK — 597/597 pinned files present, no per-file decrease, 0 failing`** (total
  13754, pinned 12714). Raised: ApiKeyCallStrip 6→8, mcpKeyFacts 15→17, McpKeyFields 6→8,
  mcpCallWords 9→14. None lowered. The run was not red, so the clock-dependent
  `ChatHistoryColumn` case did not need a re-run.
- **Frontend typecheck**: 61 errors in 27 files, the same as 306-04's close. None is in a file this
  plan changed.
- **Ledger / size**: `check-hot-file-ledger.cjs 306` printed `ledger gate OK` (814 scan rows, 44
  watched). `check-claude-md-size.cjs` reported OK at 108,980 chars. `ApiKeyCallStrip.tsx` and
  `mcpKeyCopy.ts` now FIRE (3 phases each) and have CLAUDE.md rows.
- **Live suites (local-DB lock held)**:
  - `test_306_workflow_tools_live.py`: 4 passed.
  - `test_306_spend_live.py` + `test_305_spend_live.py`: 3 passed.
  - `test_306_ask_mcp_live.py`, `test_305_tools_live.py`, `test_306_ask_live.py` plus the 293
    inbound unit suites and `test_304_acting_reads_fence.py`: 66 passed.
  - No suite printed a SKIPPED line.

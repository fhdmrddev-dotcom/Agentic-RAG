---
phase: 306-ask-the-agent-and-run-workflows
plan: 04
subsystem: mcp / ask tools / thread origin / chat history / chat bubble
tags: [mcp, ask-agent, get-answer, idempotency, admission, thread-origin, origin-mark, history, bubble]
requires:
  - 306-01 (migration 223: threads.origin_* + freeze, mcp_ask_wait_seconds, outside_inflight_* knobs)
  - 306-02 (outside_admission: claim / bind / drop, acquire / release)
  - 306-03 (outside_ask: ask_scope / resolve_ask_model / start_ask / wait_for_ask / read_ask; the closure; the shared envelope fixture)
provides:
  - backend/app/mcp/ask_tools.py (ask_agent, get_answer, NO_HANDLE_SENTENCE, DIFFERENT_QUESTION_SENTENCE, ALREADY_STARTING_SENTENCE)
  - app.mcp.results AskArgs / GetAnswerArgs / AskCitation / AskResult / HandlerRefusal + the Surface 4 render arm
  - app.mcp.tools STARTS annotation, the "start" bucket, is_granted (companion travels with its lead)
  - ThreadResponse.origin on GET /threads (no threads.py edit)
  - the mcp origin kind in all four backend literals and the whole frontend arm
  - frontend/src/components/chat/outsideAskEnvelope.ts (outsideAskQuestion, OUTSIDE_ASK_NOTE)
affects: [306-05]
tech-stack:
  added: []
  patterns:
    - "a handler REFUSAL is a typed value (HandlerRefusal), audited api_key.refused with its own reason, distinct from a fixed refusal sentence (audited not_available)"
    - "one lease identity dict for acquire and release; the release rides the run task's done-callback"
    - "a base-DOM literal pinned in the RED commit (green against the base) proves an in-app row / plain bubble byte-identical"
key-files:
  created:
    - backend/app/mcp/ask_tools.py
    - frontend/src/components/chat/outsideAskEnvelope.ts
    - backend/tests/unit/test_306_ask_tools.py
    - backend/tests/unit/test_306_tool_defs.py
    - backend/tests/unit/test_306_thread_origin_wire.py
    - backend/tests/integration/test_306_ask_mcp_live.py
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.origin306.test.tsx
    - frontend/src/components/chat/__tests__/outsideAskEnvelope.test.ts
    - frontend/src/components/chat/__tests__/UserMessageBubble.outsideAsk.test.tsx
  modified:
    - backend/app/mcp/results.py
    - backend/app/mcp/tools.py
    - backend/app/mcp/dispatch.py
    - backend/app/mcp/audit.py
    - backend/app/mcp/limits.py
    - backend/app/mcp/server.py
    - backend/app/services/rate_limit.py
    - backend/app/models/thread.py
    - backend/app/services/harness/run_read_wire.py
    - backend/app/db/workflows.py
    - backend/app/api/notifications.py
    - backend/tests/unit/test_305_tool_defs.py
    - backend/tests/unit/test_293_origin_reads.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - frontend/src/types/index.ts
    - frontend/src/lib/api/notifications.ts
    - frontend/src/components/layout/attentionConditions.ts
    - frontend/src/components/layout/waitingVocabulary.ts
    - frontend/src/components/layout/ChatHistoryColumn.tsx
    - frontend/src/components/workflows/RunOriginLine.tsx
    - frontend/src/components/workflows/runOriginVocabulary.ts
    - frontend/src/components/workflows/__tests__/RunOriginLine.test.tsx
    - frontend/src/components/workflows/__tests__/runOriginVocabulary.test.ts
    - frontend/src/components/chat/UserMessageBubble.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "306-04: a handler's refusal is a HandlerRefusal(sentence, reason, detail) that dispatch audits as api_key.refused with that reason; a plain str stays a fixed sentence audited not_available"
  - "306-04: get_answer is granted only WITH ask_agent (tools.is_granted, applied at tools/list and at call time), so a stored companion without its lead grants nothing"
  - "306-04: the wait budget is read from load_app_settings_async at the handler's entry and the deadline is t0 + budget with t0 taken before ask_scope (D-36)"
  - "306-04: an idempotency Existing with a run this key can no longer read answers NO_HANDLE_SENTENCE; a just-started run whose row is not readable yet answers status 'starting' with the handle"
  - "306-04: ThreadResponse keeps an already-composed origin (a dict with origin and no origin_kind), so a re-validated dump is not reset to None"
requirements-completed: [MCP-04, MCP-05, GUARD-01]
duration: ~45 min (first commit 01:29, last 02:05 local, plus the 11 min baseline run and its inherited-set proof)
completed: 2026-11-01
---

# Phase 306 Plan 04: ask_agent / get_answer on the MCP server, and the marked ask thread Summary

**An AI tool can now ask the agent a question over MCP. It gets back a cited answer with a confidence
line, or a handle it can pass to `get_answer`. Each idempotency key starts at most one run, every ask
takes an admission lease, and nothing the tool sends can pick the model. In the app, the ask appears in
the member's chat history marked "Started by AI tool key {label}", and its bubble shows the question
without the envelope around it.**

## Tasks

| # | Task | RED commit | GREEN commit(s) |
|---|------|------------|-----------------|
| 1 | ask_agent / get_answer: idempotency, admission, wait budget, refusals, start bucket (D-04..D-07, D-14, D-15, D-29, D-33, D-35, D-36, D-37) | `005870504` | `39956b330` |
| 2 | The mcp origin kind end to end: ThreadResponse.origin, four backend literals, the frontend arm, the history mark (D-09, D-31) | `fdaa17d64` | `46173fdba` |
| 3 | The question bubble (D-32, D-28); gates and ledger | `d53bbe855` | `ce3845775`, fix `2bc07b8c6`, docs `e3bb7b5ee` |

## Evidence

**Task 1.** The plan's verify set (`test_306_ask_tools`, `test_306_tool_defs`, `test_305_tool_defs`,
`_dispatch`, `_maintenance`, `_audit`, `_limits`, `_errors`, plus the live `test_306_ask_mcp_live`,
`test_305_tools_live`, `test_305_audit_live` and `test_306_ask_live`) gave **156 passed, no SKIPPED
line**. All 293/304/305/306 unit suites gave 1244 passed. The RED run failed at collection because
`ask_tools` did not exist yet.
- Live (real `/mcp` path, minted keys, real Redis for admission, scripted provider, stub embedder):
  1. The answer cites `/app/library/<f2_doc>` and its last line is the chat link.
  2. The same idempotency key returns the same `run_id` with exactly one `runs` row. A different
     question under that key returns the first run plus the note.
  3. With a 5 s budget and a provider that sleeps 8 s, the call returns the handle sentence after
     4.5-8 s, and `get_answer` later returns the answer. Another key reading that handle, and a
     malformed handle, both get the identical refusal.
  4. On a key with `outside_inflight_per_key=1`, a second concurrent ask gets the per-key admission
     sentence with one `api_key.refused` row (`admission:credential`). A third ask after the first
     finishes is admitted, so the lease was released.
  5. An `include_external=false` key gets the D-29 sentence, and no thread is created and no model
     call is made.
  6. Every answered `ask_agent` / `get_answer` row carries `run_id`.
- **Driven RED by counterfactual** (each edit reverted afterwards): with `on_done=None` and the
  idempotency `Existing` reuse removed, 2 of the 4 live tests failed (one-run-per-key and the
  release / admission test).
- Static checks:
  - `grep -cE "model=|provider=" ask_tools.py` = 0.
  - `resolve_ask_model(` appears only in `mcp/ask_tools.py` and `services/outside_ask.py`.
  - The `AskArgs` schema has no `"model"` or `"provider"` property.
  - `rate_limit.py` has 0 removed lines.
  - `tool_dispatcher.py` diff is empty.
- The knobs were overridden in the two modules that read them (see deviation 3). The shared
  `app_settings` row was not written.

**Task 2.** Backend `test_306_thread_origin_wire` + `test_293_origin_reads` + `test_293_origin_stamp` +
the 301 notifications suites: 69 passed. Frontend runOriginVocabulary, RunOriginLine, all six
ChatHistoryColumn suites, WaitingOnYouControl and waitingVocabulary: green, apart from the inherited
clock case below.
- Acceptance greps:
  - The three-kind literal without `mcp` appears 0 times.
  - `attentionConditions.ts` and `lib/api/notifications.ts` each add exactly 1 line.
  - `<RunOriginLine origin={thread.origin}` appears 1 time.
  - `if (!Icon) return null` appears 1 time.
  - `threads.py`, `lib/api.ts` and `ChatLayout.tsx` diffs are empty.
- The in-app history row's `outerHTML` is pinned by a literal that was GREEN against the base in the
  RED commit. `useState`/`useEffect` counts stay at 3 and 1.

**Task 3.**
- `outsideAskEnvelope.test.ts` reads the same `backend/tests/fixtures/phase306/ask_envelope.json?raw`
  the backend writer is pinned to.
- `outsideAskEnvelope.ts` has 0 imports.
- The plain-bubble `outerHTML` literal was green against the base in the RED commit.
- The `ThinkingBlock.characterization` and `.clamp` suites are green.
- `MessageItem.tsx` and `lib/api.ts` diffs are empty.

**Plan gates (once):**
- **Count gate** (`GSD_VITEST_MAX_WORKERS=2`, worktree root): `count gate OK — 597/597 pinned files
  present, no per-file decrease, 0 failing` (total 13743, pinned 12703).
  - First pins plus FILE-LEVEL targets: `ChatHistoryColumn.origin306` 9, `outsideAskEnvelope` 8,
    `UserMessageBubble.outsideAsk` 5.
  - Raised: `RunOriginLine` 6 -> 9 and `runOriginVocabulary` 11 -> 14. None lowered.
- **tsc** (`tsconfig.app.json`): 61 errors, the same count as the base. All 61 are in 27 files
  untouched since base `4aef4374b`, and none is in a file this plan changed.
- **Backend unit baseline** (`check-backend-unit-baseline.cjs`): `71 failed, 11705 passed, 1 skipped,
  2 xfailed, 2 xpassed`, 0 collection errors, GATE PASSED. The ceiling is 71 with zero headroom, so
  the gate passed with nothing to spare. The 71 break down as:
  - 1 caused by this plan (`test_276_openapi_snapshot_fresh`, fixed in `2bc07b8c6`; see deviation 1).
  - 68 stable and inherited. Re-run in isolation at HEAD they gave 68 failed. Re-run with this plan's
    11 backend app files checked out at base, they gave 68 failed, and the two sets are identical
    (`diff` empty). The files were restored afterwards.
  - 2 order-dependent `test_cross_worker_cancellation` ids, which pass in isolation.
  
  So the baseline reads 70 after the fix, the same as after 306-03.
- **Ledger / size:** `check-hot-file-ledger.cjs 306` OK. `check-claude-md-size.cjs` OK.
  `run_read_wire.py` now fires (3 phases) and has a CLAUDE.md row.

**Local-DB lock:** taken with noclobber twice (`306-04 248` for the live suites, `306-04 723` for the
baseline) and released after each. No `anon` statement was run, and the cloud project and Supabase
MCP were not touched.

## Decisions Made

- A handler REFUSAL is a typed `HandlerRefusal(sentence, reason, detail)`. Dispatch audits it as
  `api_key.refused` with that reason, so admission and D-29 refusals read as refusals in the key's
  activity. A plain `str` is still a fixed sentence and is audited `not_available` (the 305 rule).
- `get_answer` is granted only together with `ask_agent`: `tools.is_granted` applies the catalogue's
  `travels_with` rule when listing tools and when calling one.
- `ask_agent` reads the wait budget at handler entry and takes `t0` before `ask_scope`. The scope
  read, the claim and the start all count against the budget (D-36).
- If an idempotency claim points at a run this key can no longer read, the answer is
  `NO_HANDLE_SENTENCE`. If a run has just started but its row cannot be read yet, the answer is
  `status: starting` with the handle.
- The answer text is defanged but not passed through `_neutralise`. Titles in the Sources list are
  neutralised like 305's titles.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The OpenAPI snapshot went stale**
- **Found during:** the plan's backend baseline run.
- **Issue:** `ThreadResponse.origin` and the `mcp` enum value changed the API schema, so
  `test_276_openapi_snapshot_fresh` failed. This was the only new failure, and it brought the
  baseline to the 71 ceiling.
- **Fix:** regenerated both files with `scripts/export-openapi.py` and
  `scripts/build-public-openapi.cjs`. The diff is schema-only: one field, and `mcp` in three enums.
  The test now passes.
- **Files:** `docs/public/api/openapi.snapshot.json`, `openapi.public.json`. **Commit:** `2bc07b8c6`.

**2. [Rule 2 - Correctness] Companion grant enforced (`server.py`, which the plan did not list)**
- A stored `get_answer` without `ask_agent` would have been listed and callable. `is_granted` now
  applies at `tools/list` (one expression in `server.py`) and at dispatch. A test covers it.
- **Commit:** `39956b330`.

**3. [Test isolation] The live suite overrides the knobs instead of writing `app_settings`**
- `test_306_ask_mcp_live.py` wraps `load_app_settings_async` in `ask_tools` and `outside_admission`.
  The wrapper returns the stored row with `mcp_ask_wait_seconds` / `outside_inflight_per_key`
  overridden. The shared local `app_settings` row is never written, so there is nothing to restore,
  and a test that fails mid-way cannot leave the operator's settings changed.

**4. [Fixture vs plan wording] The displayed question is the stored inner text**
- The plan expected `outsideAskQuestion(fixture.envelope) === fixture.question`. That conflicts with
  "never un-escape", because the fixture's question contains `</external_input>`, which the writer
  neutralises. The test therefore compares against the question with that tag neutralised, and also
  asserts that this differs from the raw question.
- The fixture was not changed.

**5. [Deliberate fence retirements]**
- `test_305_tool_defs.py`'s "exactly the three" pin was retired under D-15 (SEED-177 wording, in the
  docblock). The 307 names are still pinned as unserved.
- `test_293_origin_reads.py`'s `ORIGIN_KINDS` pin was widened under D-31.

### Inherited, not caused here

`ChatHistoryColumn.test.tsx > shows the per-group count in each group header` failed when run
between 01:40 and 01:47 local. Its fixture is built from `Date.now()` minus 1-2 hours, so between
00:00 and 02:00 it falls on yesterday. This is the clock issue recorded in
`ChatHistoryColumn.rowIdentity.test.tsx`. The file is byte-unchanged since the base, and it passed
20/20 when re-run at 02:09. It is in neither count-gate knob.

## Known Stubs

None.

## Threat Flags

None outside the plan's register. Each of the following has a named test above: T-306-05, -06, -07,
-09, -10, -12, -17, -19, -30 and -31.

## Owed (not done here, by design)

- `graphify update .` was not run in the worktree. It should be run on the merged tree.
- Cloud migration 223 is still owed (306-01's note). This plan adds no migration.
- 306-05 registers `list_workflows` / `run_workflow` / `get_workflow_run` on the same `start` bucket
  and `STARTS` annotation.

## Self-Check: PASSED

All 9 created files exist, and the 8 commits (`005870504`, `39956b330`, `fdaa17d64`, `46173fdba`,
`d53bbe855`, `ce3845775`, `2bc07b8c6`, `e3bb7b5ee`) are on this branch since base `4aef4374b`.
STATE.md and ROADMAP.md were not modified.

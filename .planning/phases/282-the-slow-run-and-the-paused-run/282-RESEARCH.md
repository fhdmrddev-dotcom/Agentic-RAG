# Phase 282: The Slow Run and the Paused Run - Research

**Researched:** 2026-10-15
**Domain:** LLM provider client construction (timeouts / retries) at the gateway boundary + one shared `ask_user` draft across chat and panel renderings
**Confidence:** HIGH for everything marked MEASURED; MEDIUM for the D-06 verdict (code-cited, not driven end to end); LOW for Google `X-Server-Timeout` server semantics.

Every claim is tagged **MEASURED** (a command was run this session and its output is quoted), **CITED** (official docs or a file:line read this session), or **ASSUMED** (training knowledge or inference, needs confirmation).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Measured at discuss (scout, HEAD `6f23afe7d`). These facts drive the decisions.

- No LLM client anywhere passes `timeout=` or `max_retries=`, and no client is cached; each call builds a
  new one. SDK defaults, read from the installed packages:
  - `openai` 2.28.0 and `anthropic` 0.97.0 both use `Timeout(connect=5, read=600, write=600, pool=600)`
    with `max_retries=2`.
  - `google-genai` 2.6.0 uses `HttpOptions.timeout=None`, which means **no timeout at all** (the value is
    in **milliseconds**), and does 1 attempt by default.
- Builders:
  - `get_llm_client(user_settings=None)` at `openai_service.py:1448-1486`. It wraps the client with
    LangSmith `wrap_openai` at :1474.
  - `anthropic.Anthropic(api_key=)` at `anthropic_service.py:169`.
  - `genai.Client(api_key=)` at `google_service.py:415`.
  - The Responses surface reaches `get_llm_client` from `provider_gateway/openai_responses.py:553`.
- ⚠ **`client.with_options(...)` after `wrap_openai` silently drops LangSmith tracing**, because langsmith
  0.2.3 patches methods on the instance. So the values go into the **constructor**, never `with_options`.
- The admin PATCH already refuses values outside **[1, 3600]** with a 422 (`admin.py:1492-1497`, body
  `{"detail": "..."}`), mirrored client-side in `lib/api/admin.ts:600-601`. ⚠ SEED-172 finding #3 ("no
  range validation on the PATCH path") is **stale** on this point. But the async resolver's DB tier
  returns `int(db_timeout)` **unclamped** (`config.py` ~:839-880), and the column has no CHECK constraint.
- ⚠ **On the OpenAI-compat and Responses paths, `client.chat.completions.create(stream=True)` /
  `responses.create` run synchronously inside `async def open_stream` (`dispatcher.py:131`), on the event
  loop thread, before `asyncio.timeout(per_call_budget)` starts** (`agent_loop.py:589`). Connecting, waiting
  for headers and every SDK retry all sit outside the operator's budget and block the worker's event loop.
  Anthropic and Google open lazily inside the producer thread, so they fall under the budget.
- **BUG-260918-01 Finding C is mostly REFUTED by measurement.** Option chips have been `role="radio"` +
  `aria-checked` inside `role="radiogroup"` since 087-05 (`fc2139743`, `PendingAskCard.tsx:630-654`). The
  report measured `aria-pressed` / `aria-selected` and never `aria-checked`. What is **real**: the radio role
  promises arrow-key movement and a roving tabindex, and the chips implement neither.
- Finding A (the dead `Answer in panel →`) was already fixed in `c2ffdaad7`, which is in HEAD and fenced by
  `Seam.test.tsx:84-88`. Finding B (two full inputs, two local drafts) is fully live.
- The panel's open/rail state is local `useState` in `ChatLayout.tsx:520`; no store or context holds it.
  `WorkspacePanel` mounts `PendingAskStack` only while the panel body renders (open on desktop, or the mobile
  sheet open).

#### FIX-06: the timeout reaches the client

- **D-01: The per-model budget goes into the client constructor, at the client boundary, for all four
  families.**
  - OpenAI-compat and Responses: through `get_llm_client`, which gains keyword-only `timeout_s` and
    `max_retries` parameters with defaults. The current fakes (`lambda us=None`, `lambda user_settings=None`)
    must keep working.
  - Anthropic: `Anthropic(..., timeout=, max_retries=)`.
  - Google: `genai.Client(..., http_options=HttpOptions(timeout=<ms>))`.
  - The value is the one the **async 4-tier resolver** already produces (`get_per_call_timeout_async`). It
    travels on the gateway request the agent loop already builds. ⛔ The agent loop's `per_call_budget` call
    sites do not move (roadmap fence; the OV-273-03 seam is not taken here). Provider-specific handling stays
    in each adapter or service.
- **D-02: Timeout shape.** read, write and pool all equal the budget. `connect` stays short (≤ 10 s), so an
  unreachable endpoint fails fast and is not stretched to 900 s. httpx `read` is per-read inactivity and the
  loop's budget is total wall clock. With read = budget, the SDK never fires before the loop's wall clock,
  so the loop stays the authority and the SDK stops being a hidden second ceiling.
- **D-03: `max_retries` is set explicitly on every client, by provider class:**
  - **Self-hosted / local** (`ollama`, `lmstudio`, mig-180 self-hosted endpoints, anything `self_hosted`):
    **0**. A timeout on local hardware means the model is slow. A retry re-queues the same prompt on the same
    GPU and triples the wait (BUG-260916-01 §2).
  - **Cloud natives + OpenRouter: 2, set explicitly**, because each provider's SDK docs recommend
    retrying connection errors, 408/409/429 and 5xx with backoff, and those fail fast. ⚠ The research must
    confirm against each provider's own docs (OpenAI, Anthropic, Google; provider-docs-first) and **measure**
    whether the app already retries 429/5xx itself. If it does, cloud also goes to 0 so the two do not stack.
  - **Google stays at its own 1-attempt default**, passed explicitly. The reason: genai's retry options
    default to 5 attempts once enabled, so it is left off.
  - **Callers with no per-model budget** (title, suggestions, sub-agent, metadata extraction, vision,
    embeddings): they keep **today's effective values (600 s / 2), passed explicitly as named constants with
    this reason**. That changes no behaviour and ends "default by omission". Resolving a per-model timeout for
    them is out of scope.
- **D-04: "Not past the budget unannounced."** When a call ends on the per-call timeout, the run's failure
  text names **the setting and its value**. Example: *"<model> did not answer within 900 s, the timeout set
  for it in the Model Registry."* It goes through the existing `run_producer.py:864-886` "timed_out" message,
  not a new channel. The Registry's timeout field gains one help line: *"Local models are tried once; cloud
  providers retry quick failures up to 2 times."*. The research may correct that wording if D-03 changes.
- **D-05: Eager-create blocking (measured above) is folded CONDITIONALLY.** The research drives a stub that
  holds response headers back (the way a slow local server does before its first token) through the real
  `open_stream`.
  - If the event loop blocks, which is the expected result, the fix is the **minimal boundary change**: the
    synchronous `create` runs off the event loop (threadpool) inside the gateway adapter or dispatcher, so the
    agent loop's call sites still do not move.
  - Reason: raising a timeout to 900 s without this would let one slow local model freeze a uvicorn worker
    for every user for 15 minutes. The fix would make things worse.
  - If the measurement shows no blocking, file the finding and leave the code alone.
  - Either way it is recorded as `BUG-261015-02`.
- **D-06: The ceiling stays 3600 if it can be honoured, and that is measured, not assumed.** The research
  lists every remaining bound below 3600 on the chat path and measures it:
  - the Google server-side `X-Server-Timeout`;
  - any Anthropic non-streaming guard (we stream);
  - uvicorn / proxy idle limits on the SSE response (heartbeats?);
  - the Redis run-buffer TTLs.
  If none binds, 3600 stays and **works** (SC#1's 700-s stub under 900 is the proof). If one binds, the
  accepted maximum drops to it in **both** `config.py` and the client mirror, and the 422 detail names the
  reason. ⚠ The harness **phase wall clock** (`harness_phase_wall_clock_seconds`) is a separate,
  operator-visible setting with its own scope. It is noted, not changed.
- **D-07: The refusal is visible in the Registry.** A typed value out of range shows the server's own reason
  inline, beside the field, before or instead of a toast. The client mirror and the server bound come from
  **one number each** (no third copy). The planner checks whether `ModelRegistryTab.tsx` already renders the
  422 `detail`; if it does, that path is reused.
- **D-08: The resolver's DB tier applies the same bound** (clamp + log). A row that was out of range before
  the PATCH bound existed then cannot reach a client. **No migration.** The live local and production
  `model_capabilities_overrides` rows are read (production via MCP **read**) to report how many values sit
  outside the final bound. A CHECK constraint is deferred.
- **D-09: Proof for SC#1** comes in three parts:
  1. A unit test reads `.timeout` / `.max_retries` back from **each** built client (OpenAI-compat,
     Responses, Anthropic, Google `http_options`).
  2. A stub endpoint answering at 700 s completes under a 900-s setting. This is a local integration test
     against a real socket, and the timing may be scaled down by patching the budget as long as the same
     inequality holds: stub delay > the old 600 SDK default and < the setting. That scaled run is labelled as
     scaled.
  3. The live slow-local-model row in G-4.

#### FIX-07: one input, one draft

- **D-10: Layout = sketch 282 variant A, "the input follows the open panel".** Chosen autonomously.
  ⚠ **Operator confirmation of the mockup is OWED** and is the first item of G-4.
  - When the panel is showing the pause, the panel card is the only input. The chat-column mount renders a
    one-line **pointer**: the question, the current draft, and a working `Answer in panel →` that moves focus
    to the card's first control.
  - When the panel is on the rail, or the panel body is not rendered for any other reason, the **same**
    chat-column mount renders the full card. The rail keeps its pulsing dot.
  - A workflow pause with the panel on the rail therefore still has a full input (the BUG-260828-07 case).
  - Mockup: `.planning/sketches/282-one-answer-input/index.html`, driven in Chrome: 1 input in every state.
- **D-11: The mount never narrows.** `MessageList.tsx`'s unconditional `<PendingAskStack>` mount and
  `WorkspacePanel`'s mount both stay byte-equivalent in their **conditions**; only what the chat-column stack
  **renders** changes.
  - `PendingAskStack` gains a `home` prop (`"chat"` default, `"panel"`).
  - The chat home decides pointer-or-card from whether a **panel-home stack is currently mounted for the same
    thread**. This is a mount-presence registry, not the panel's `useState`, so `ChatLayout.tsx` (FIRES) is
    not touched.
  - The `MessageItem.inlineApproval` 6c source fence must stay green unedited.
- **D-12: One draft, one home.** The draft (`choiceIndex`, `freeText`) moves out of `PendingAskCard`'s local
  `useState` into **one new small store**, keyed by `tool_call_id`. ⛔ It does **not** go into
  `streamsStore.ts` (which FIRES).
  - Every rendering reads it: chat card, panel card, the pointer's draft line, and
    `WorkflowRunPage.tsx:1638`'s direct card.
  - It is cleared on answer, on expiry, and when the ask leaves `pendingAsksByThread`.
  - Two threads paused at once keep separate drafts.
  - Drafts are not persisted across reload, as today.
  - ⛔ No state is copied between cards. Copying is the roadmap's named failure.
- **D-13: Selection semantics stay `role="radio"` + `aria-checked`** inside `role="radiogroup"`. Tests
  already query `getByRole("radio")`, and SC#3's `aria-pressed` is an example, not a requirement.
  - The missing half of the radio pattern is completed: a roving tabindex and Arrow keys that move and select.
  - The selected chip also gets a non-colour mark (a filled radio dot), so selection is not colour-only to a
    sighted user either.
  - Clicking the selected chip again still deselects it.
- **D-14: Dead controls.** The pointer's `Answer in panel →` must work. No other handler-less control may be
  added. `Seam.test.tsx`'s "PausedRunCue renders NO button" fence stays as is, because the row-level cue
  remains a marker.
- **D-15: Tests change only where the design changed.**
  - `streamsProvider_244_settle_ask` tests 9/10 mount two bare stacks, so both stay in the chat home and the
    tests stay valid.
  - New fences:
    - with a panel home mounted, exactly one `Send Answer` exists across both homes;
    - a selection made in one rendering reads back from the other's DOM (`aria-checked`) and from the
      pointer's draft text;
    - the panel goes to the rail mid-draft, and the chat card shows the same selection;
    - a workflow pause (no message row) with no panel home still has an input.
  - The planner updates `PendingAskCard.retired.baseline.test.tsx:238`'s line-count pin (837) and the
    vitest count gate entries in the same commit as the card edit, and says so.

#### Proof, UAT and gates

- **D-16: SC#10 board, 8 rows.** These are the full native roster plus OpenRouter, derived from
  `MODEL_CAPABILITIES` (one per provider, newest registry-backed id).
  - Each row runs a turn under the new client settings, then raises and answers an `ask_user` pause.
  - Driven by the per-request `model` + `provider` method (no global setting mutated).
  - The board includes one multi-tool row, one parallel-thread row (A paused while B streams) and one
    long-message row (≥ 5 KB prompt).
  - A blocked row is ⛔ with its reason and issue id, never omitted.
- **D-17: G-4 scenarios, proposed autonomously.** The operator confirms or replaces them, and confirming
  the sketch is part of row 1.
  1. A Deep pause with the panel open: one input in the panel and a pointer in chat; the pointer's button
     focuses the card.
  2. A workflow pause with the panel on the rail: a full input in chat. Toggle the panel mid-draft: the
     selection survives.
  3. Two threads paused at once: each keeps its own draft.
  4. A slow local model on GPU with a 900-s timeout completes past 600 s.

  Chrome MCP drives each row. Draft agreement is read from both renderings' **DOM state** (`aria-checked`,
  textarea value), never from a screenshot.
- **D-18: Plan shape (G-8), 3 plans.**
  - 01: FIX-06 backend clients + resolver clamp + Registry refusal and help line + D-05 if measured.
  - 02: FIX-07 draft store + `home` prop + pointer + radio keyboard + fences.
  - 03: the 8-row board + G-4 drives (non-autonomous).
  - 01 and 02 share no files and run as **wave 1** in parallel worktrees. 03 is wave 2.
  - TDD RED first for each fix. Full gates once per wave. Targeted suites per task.

#### G-5 audit (roadmap flag list), all "honoured by construction", each a bounded additive diff

- `openai_service.py` (FIRES): two keyword-only parameters on `get_llm_client`, plus the explicit constants
  for the no-budget callers.
- `anthropic_service.py`: constructor kwargs only.
- `config.py` (FIRES; the `MODEL_CAPABILITIES` seam is owed and not taken here): the clamp in the resolver's
  DB tier, plus the ceiling only if D-06 lowers it.
- `admin.py`: the bound import only, if it changes.
- `ModelRegistryTab.tsx` (FIRES; the `AddModelForm` seam is owed and not taken here): the inline refusal and
  one help line.
- `PendingAskCard.tsx` (FIRES): the draft moves out (net state goes **down**). Plus the `home` prop, the
  pointer arm and the keyboard handler.
- `WorkspacePanel.tsx`: one prop on the existing mount.
- `MessageList.tsx` / `MessageItem.tsx`: expected **untouched**.
- `streamsStore.ts`: **untouched** (D-12).
- `PausedRunCue.tsx`: untouched.

Each touched file gets its ledger row re-derived and its `docs/HOT-FILE-LEDGER.md` section updated in the
same commit. Any new file gets a row (the hot-file gate enforces this).

#### Folded / routed

- **BUG-260916-01** → folded 282 (FIX-06).
- **BUG-260918-01** → folded 282 (FIX-07). Finding A was already fixed; Finding C was refuted except for the
  keyboard half (D-13).
- **SEED-172 findings #2 and #3** (the timeout field only) → folded 282. Finding #4 (context window =
  loaded context) stays open.
- **SEED-289** (tools off by default on a guess) was reviewed and left. It is the sibling defect on the same
  13 rowless local models, but it is a capability-resolution change, not a client-boundary one. The 13
  rowless local models on the 300-s inferred default are **noted, not fixed** (roadmap).
- The todo "SPIKE — NL→workflow authoring" matched at score 0.6 on keywords only ("phases", "run", "real").
  It is unrelated and not folded.
- **BUG-260718-03** (the write_todos card in chat) overlaps chat/panel by area only. It stays open.

### Claude's Discretion

- The store's name and file, the presence-registry mechanism (a ref count in the store is fine), and the
  exact pointer copy within D-10's content.
- How `timeout_s` travels on `GatewayRequest`: a new field with a default, so the other constructors do not
  change.
- The connect timeout value within ≤ 10 s.

### Deferred Ideas (OUT OF SCOPE)

- **SEED-289**: ask the provider for tool support instead of guessing. Same model set, a separate capability change.
- **The 13 rowless local models** run on the 300-s inferred default. Noted, not fixed.
- **SEED-172 #4**: the context window must match the loaded context.
- **`skill_tuner` uses the sync resolver**, so DB and env overrides are ignored there (`api/skill_tuner.py:314,447`).
- **The harness and `forced_emit` paths have no per-call deadline**, only phase wall clocks that cannot stop
  worker threads. They get the constructor timeout from D-01, but no new per-call budget.
- **The resolver's DB tier skips `enabled=false` rows**, so a disabled model's override is ignored. Probably
  intended; noted.
- **A `CHECK` constraint on `llm_call_timeout_seconds`**: needs a migration. D-08's clamp covers the read side.
- **Persisting an ask draft across reload.**
- Reviewed todo not folded: "SPIKE — NL→workflow authoring" (keyword-only match).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-06 | A per-model timeout is the timeout the provider call actually gets, up to the maximum the UI accepts; a value above a real ceiling is refused with the reason; `max_retries` is chosen deliberately, not inherited from the SDK default. (`BUG-260916-01`) | R1 (retries, measured), R2 (event-loop block, measured), R3 (ceiling: a binding bound at 2400 s was found), R4 (plumbing map), R5 (timeout message + classification), R6 (Registry refusal path exists), R7 (live rows) |
| FIX-07 | One `ask_user` pause shows one answer input; the draft is the same wherever it appears; option selection is not conveyed by colour alone; no dead button remains. (`BUG-260918-01`) | R8 (store + presence registry + keyboard + test hazards) |

Folded bug reports the plans MUST cover: `BUG-260916-01` (FIX-06), `BUG-260918-01` (FIX-07), `BUG-261015-02` (D-05, now **measured**: the loop blocks).
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Python backend runs in `backend/venv` (`backend/venv/Scripts/python.exe`). Backend unit gate: `node scripts/check-backend-unit-baseline.cjs` (ceiling **71 failed**, zero headroom; memory notes a flaky `test_230` that can read 72 at base, so establish base vs new by re-running at base, never by a quoted number).
- No LangChain / LangGraph; raw SDK calls only. Stream via SSE. Stateless completions.
- Blocking I/O must not run directly in async handlers (`run_in_threadpool`, D-v2.5-01). D-05's fix is this rule applied to the gateway.
- **Provider-docs-first**: provider-specific handling stays at the service boundary; never break the shared path.
- **A model's capabilities are DATA** (Phase 262): no hardcoded per-model quirks; the per-model timeout stays a registry column.
- **Settings live in DB/UI; env vars are secrets/infra only.**
- Multi-worker uvicorn (`WORKER_COUNT=2`): any process-local registry is per-worker. The draft store is browser-side, so this does not bite FIX-07.
- Schema changes are numbered migrations only. **This phase ships none** (D-08).
- **G-5**: every `files_modified` source file needs a ledger row (`node scripts/check-hot-file-ledger.cjs 282`); the hook runs it when a PLAN.md is written. Row + `docs/HOT-FILE-LEDGER.md` section in the **same commit**; CLAUDE.md FIRING-table cell ≤ 80 chars, docs scan-list cell ≤ 200.
- **G-8**: 3-5 plans; targeted suites per task, full gates once per wave. Never cut verifier / TDD RED / security review.
- **Worktrees**: bootstrap first (`bash scripts/bootstrap-worktree.sh "$(pwd)"`), `GSD_VITEST_MAX_WORKERS=2`, teardown via `scripts/teardown-worktree.sh` only, serialize plans that mutate the local DB.
- **Frontend typecheck**: `npx tsc -p tsconfig.app.json --noEmit` with a set diff vs base (plain `tsc --noEmit` checks zero files).
- **UAT scoreboard recipe**: 8-row roster derived from `MODEL_CAPABILITIES`, blocked rows recorded ⛔ with reason, never omitted; rows go in VALIDATION.md / the evidence file, not PLAN tasks.
- **Supabase MCP = production**: reads free, every write needs per-action operator approval. D-08's production read is a SELECT.
- **Deployment-artifact parity**: if an env var the app reads changes (it should not here), update `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml` in the same commit.
- Reported bugs folded into 282 must each be covered by a plan task.

## Summary

Every research question was answered with a command. Four results change the plan.

1. **D-05 is real (MEASURED).** A local stub that held response headers for 3.0 s was driven through the real `open_stream` on the OpenAI-compat path. A concurrent asyncio ticker that should tick every 50 ms stalled for **3.794 s**. With the same call wrapped in `asyncio.to_thread`, the worst tick gap was **0.133 s**. So `BUG-261015-02` reproduces, and the threadpool fix at the dispatcher is required, not optional.
2. **3600 cannot stay (CITED, code).** The run-stale sweep (`run_reconciler.py`, `config.run_stale_sweep_timeout_seconds = 2400`) marks a chat run `failed` when its `run:{id}` Redis stream has not grown for 2400 s. Nothing writes to that stream while a model call is silent: there is no LLM keepalive, only the sandbox has one. So a per-call budget above about 2400 s gets killed by the watchdog. The config comment itself says the sweep "MUST EXCEED the longest legit SILENT gap". Recommended ceiling: **1800 s**, plus a boot validator in the style of the existing `_validate_run_stale_sweep_bounds`.
3. **The app retries a subset of 5xx itself (MEASURED by code).** `agent_loop.py:2797` retries 502/503/529 and "upstream" message errors up to 2 more times. It does not retry 429, 500, 504, connection errors or timeouts. This overlaps the SDK's own retries only on 502/503/529, and those fail fast. **Recommendation: cloud stays at 2.** The literal D-03 clause says cloud goes to 0 "if the app retries 5xx", so this needs the planner or operator to ratify it. A probe also **measured** a second harm: with `max_retries=2`, an orphaned producer thread keeps re-sending a timed-out request *after* the run already reported a timeout (server hits at 0.3 s, 2.74 s and 5.55 s against a 2 s budget). With `max_retries=0` there was 1 hit.
4. **FIX-07's store will leak drafts between tests unless it is reset (MEASURED by reading tests).** `streamsProvider_244_settle_ask` Test 11 leaves "Do not run it" selected after a refused answer. Test 12 then clicks that same chip on the same `tool_call_id` and would toggle it **off**. `PendingAskCard.test.tsx` (45 cases on fixed ids, provider mocked) has the same hazard. The fixes are a garbage-collect subscription on `pendingAsksByThread` plus a global test reset.

**Primary recommendation:** Add `timeout_s` to `GatewayRequest`. Build each client from it with `httpx.Timeout(t, connect=10)`, and set `max_retries` to 0 when `provider in _SELF_HOSTED_PROVIDERS`, else 2. Google uses `HttpOptions(timeout=ms)` with no retry. Offload the OpenAI-family open to `asyncio.to_thread` under a **deadline shared with the drain**. Lower `_LLM_CALL_TIMEOUT_MAX_S` to 1800 with a stale-sweep validator. For FIX-07, add a new `stores/askDraftStore.ts` (drafts plus a panel-presence refcount, with garbage collection driven by the ask slice), and complete the APG radio keyboard pattern.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve per-model budget | API / Backend (`config.get_per_call_timeout_async`) | Database (`model_capabilities_overrides`) | Already exists; only clamp added (D-08) |
| Build SDK client with timeout/retries | API / Backend (service boundary: `openai_service`, `anthropic_service`, `google_service`) | — | Provider-specific handling at the boundary (provider-docs-first) |
| Carry budget to the client | API / Backend (`provider_gateway/dispatcher.GatewayRequest`) | — | The envelope the loop already builds (D-01) |
| Keep event loop free during open | API / Backend (`dispatcher.open_stream`) | — | Gateway boundary, call sites unchanged (D-05) |
| Bound validation + refusal | API / Backend (`admin.py` PATCH 422) | Browser (in-row `role="alert"`) | Server is the wall; client mirror is a convenience |
| Timeout wording | API / Backend (`run_producer.py` terminal error) | Browser (RunCard tooltip `title={runError}`) | Existing channel (D-04) |
| One draft per ask | Browser / Client (new zustand store) | — | UI-only state; never server-persisted (D-12) |
| Pointer vs card decision | Browser / Client (presence registry) | — | Mount-presence, not ChatLayout state (D-11) |

## Measured answers to the ten research items

### R1 — D-03: provider docs, app-level retries, the self-hosted predicate

**Provider docs (CITED):**
- **OpenAI Python SDK** (README, github.com/openai/openai-python): "Connection errors…, 408 Request Timeout, 409 Conflict, 429 Rate Limit, and >=500 Internal errors are all retried by default", "2 times by default", "0 disables retries"; "By default requests time out after 10 minutes"; timeout accepts a float or a granular `Timeout(60.0, read=5.0, write=10.0, connect=2.0)`; "requests that time out are retried twice by default".
- **Anthropic Python SDK** (platform.claude.com/docs/en/api/sdks/python): the same retry set and default of 2; "By default requests time out after 10 minutes"; "On timeout, the SDK throws an `APITimeoutError`"; "requests that time out are retried twice by default"; **Long requests**: "The SDK will throw a `ValueError` if a non-streaming request is expected to take longer than approximately 10 minutes. Passing `stream=True` or overriding the `timeout` option … disables this error."
- **google-genai 2.6.0** (installed SDK source, `google/genai/types.py:2283-2295`, `_api_client.py:506-555`): `HttpOptions.timeout` is "Timeout for the request in milliseconds". `retry_options=None` gives `stop_after_attempt(1)` (no retries). Once `HttpRetryOptions` is set, `attempts` "If not specified, default to 5" and it retries `408, 429, 5xx, httpx.TimeoutException, httpx.ConnectError`. The public docs page did not carry these docstrings (WebFetch returned nothing), so the installed source is the authority here.

**Installed SDK behaviour (MEASURED, `scratchpad/retry_probe.py`, stub that holds the response 3 s, read=1 s):**
```
openai    read=1s max_retries=2 → wall 4.63 s, server_hits 3, openai.APITimeoutError
openai    read=1s max_retries=0 → wall 1.01 s, server_hits 1, openai.APITimeoutError
anthropic read=1s max_retries=2 → wall 4.31 s, server_hits 3, anthropic.APITimeoutError
anthropic read=1s max_retries=0 → wall 1.01 s, server_hits 1, anthropic.APITimeoutError
genai timeout=1000ms (no retry_options) → wall 1.01 s, server_hits 1, httpx.ReadTimeout
openai connect=1s unroutable → wall 1.0 s, openai.APITimeoutError   ← SAME class as a read timeout
openai refused (127.0.0.1:1) → wall 2.05 s, openai.APIConnectionError
```
Takeaways: SDK retries on timeout **multiply the wait by 1 + max_retries**. A connect timeout and a read timeout arrive as the **same** `APITimeoutError` class (only `__cause__` tells `httpx.ConnectTimeout` apart). A Google timeout surfaces as a bare `httpx.ReadTimeout`, which is not a `google_errors.APIError`.

**App-level retries (MEASURED by grep + read):**
```
grep -rn "RateLimitError|APIStatusError|APITimeoutError|max_retries|tenacity|backoff" app
agent_loop.py:2308  _MAX_PROVIDER_RETRIES = 2 ; _retry_delays = [0.5, 1.5]
agent_loop.py:2774  except (APIError, AnthropicAPIError) as provider_err:
agent_loop.py:2797  if _is_transient_provider_error(provider_err) and _provider_retries < _MAX_PROVIDER_RETRIES: … continue
agent_loop.py:642-687 _is_transient_provider_error: status in (502, 503, 529) OR body code in (502,503,529)
                     OR message contains "provider returned error"/"upstream"/"bad gateway"/"service unavailable"
```
- **Not** retried by the app: 429 (the TPM "request too large" 429 is special-cased and *appended as text*), 500, 504, 408, 409, connection errors, `APITimeoutError` (message "Request timed out." matches no keyword), and **every** Google error (the except clause names only openai/anthropic `APIError`).
- `_create_with_openrouter_routing_retry` (`openai_service.py:2440-2490`) is one retry on OpenRouter's routing 404 only. It does not overlap with the SDK set.
- **Overlap = 502/503/529 at request time only.** Worst case is 3 app attempts × 3 SDK attempts = 9 HTTP attempts, all fast failures (SDK backoff of about 0.5-8 s each, plus the app's 0.5 s and 1.5 s). Mid-stream body errors (OpenRouter "provider returned error") are retried by the app and **not** by the SDK, because SDK retries only cover the initial response.

**Orphan re-sends after the budget fires (MEASURED, `scratchpad/drain_probe.py`; real `stream_anthropic` + real `_drain_stream_with_close_on_cancel`, budget 2 s, SDK read 2 s, server never answers):**
```
max_retries=2 → raised builtins.TimeoutError after 4.02 s; server hits at 0.3 s, 2.74 s, 5.55 s (3rd AFTER the raise)
max_retries=0 → raised builtins.TimeoutError after 2.31 s; 1 server hit
```
On a budget timeout the asyncio timer wins, as D-02 intends. But `gen.close()` cannot stop a generator that is running in another thread (`ValueError: generator already executing`, which is swallowed as non-fatal). The producer thread lives on, and its SDK retries **re-send the request after the run has already been reported as timed out**. Behaviour today is worse (read = 600, so the orphan lingers up to 3 × 600 s). With read = budget it is bounded by `max_retries × budget`.

**Self-hosted predicate (CITED):** there is **no helper function**. The single source is the table `config._SELF_HOSTED_PROVIDERS = {"ollama", "lmstudio", "custom"}` (`config.py:79-83`, "migration 180", "Adding a self-hosted provider must stay a ONE-EDIT operation"), used by membership tests at `config.py:1084,1092`, `user_settings.py:996`, `api/settings.py:624`. The per-request provider reaches `user_settings.active_provider` through `override_provider(...)` (`threads.py:1442-1443, 1776-1777`). Recommend **one** helper next to the table, with no second predicate:
```python
# config.py, beside _SELF_HOSTED_PROVIDERS
LLM_MAX_RETRIES_SELF_HOSTED = 0   # slow local hardware: a retry re-queues the same prompt (BUG-260916-01 §2)
LLM_MAX_RETRIES_CLOUD = 2         # SDK docs: connection/408/409/429/5xx retried with backoff; fail fast
def llm_max_retries_for(provider: str | None) -> int:
    return LLM_MAX_RETRIES_SELF_HOSTED if (provider or "").lower() in _SELF_HOSTED_PROVIDERS else LLM_MAX_RETRIES_CLOUD
```

**R1 verdict (recommendation):**

| Client family | timeout | max_retries | Why |
|---|---|---|---|
| OpenAI-compat (openai, openrouter, deepseek, zhipu, minimax, moonshot) | `httpx.Timeout(budget, connect=10)` | **2** | SDK docs; overlap with app limited to fast 502/503/529 |
| OpenAI-compat self-hosted (ollama, lmstudio, custom) | same | **0** | measured 3× multiplication; orphan re-send |
| Responses (`gpt-5.6-*`, OpenAI only) | same | **2** | cloud |
| Anthropic native | same | **2** | cloud; Anthropic sends stream `ping` events, so a mid-stream read timeout is rare |
| Google native | `HttpOptions(timeout=budget*1000)` | 1 attempt (`retry_options` left `None`, or `HttpRetryOptions(attempts=1)` to be explicit) | genai would make 5 attempts once enabled |
| No-budget callers (title, suggestions, sub-agent, embeddings, vision, metadata) | `NO_BUDGET_LLM_TIMEOUT_S = 600` | `NO_BUDGET_LLM_MAX_RETRIES = 2` | D-03: today's values, made explicit |

⚠ **Ratification needed.** D-03 says "if the app retries 5xx, cloud goes to 0". The app retries **3 specific 5xx codes**. Going to 0 would drop the SDK's 429 / `retry-after` / connection-error / 500 / 504 handling, which the app does not replace. The recommendation (keep 2) follows the measured overlap. It is a judgment the planner or operator must record. Also correct the D-04 help line: **Google is tried once too**. Suggested: *"Local models and Google are tried once. Other cloud providers retry quick failures (connection errors, 429, 5xx) up to 2 times."*

### R2 — D-05: does `open_stream` block the event loop? YES (MEASURED)

Probe `scratchpad/d05_block_probe.py`: a `ThreadingHTTPServer` on 127.0.0.1 sleeps 3.0 s before sending headers, then streams 2 SSE chunks. The script sets `settings.llm_base_url` to the stub and calls the real `dispatcher.open_stream("lmstudio", GatewayRequest(...))` while an asyncio ticker sleeps 50 ms per tick.
```
real open_stream:          {"header_delay_s": 3.0, "open_stream_wall_s": 3.794, "ticks": 8,  "max_tick_gap_s": 3.794, "content": "hello"}
asyncio.to_thread(control):{"header_delay_s": 3.0, "open_stream_wall_s": 3.749, "ticks": 66, "max_tick_gap_s": 0.133, "content": "hello"}
```
**Blocked: yes.** Every other request on that uvicorn worker freezes for the whole header wait. With `max_retries=2` and read=600 that is up to 1800 s today. The control proves `open_openai_compat_stream` runs correctly off-loop: same content, `CallingMode.NATIVE`, and no loop-thread dependency (grep for `get_running_loop|create_task|ensure_future` in `user_settings.py`, `openai_service.py`, `config.py` and `provider_gateway/*` returns nothing).

**Minimal fix point: the dispatcher's else-branch** (`dispatcher.py:157-196`). It is the one place that sees both OpenAI-family adapters (compat + surface), and it leaves the adapters' sync generators untouched. The "byte-identical RED LINE" in `openai_compat.py:45-57` constrains only the *returned stream shape*: a SYNC iterable with `.close` that the consumer drains in a threadpool. Offloading the *construction* call (`open_openai_compat_stream(request)`) to a thread returns the identical `_ClosableEventStream`, so the RED LINE holds. Anthropic and Google are already lazy (their generator bodies run on first `next()` inside the producer thread). Do not touch them.

Use `asyncio.to_thread`, **not** `loop.run_in_executor`. `to_thread` propagates the current `contextvars.Context` (Python docs, `asyncio.to_thread`), so the LangSmith parent run that `wrap_openai` attaches to at `create` time is preserved. ASSUMED for LangSmith specifically; the probe ran with LangSmith off.

**Budget coverage (recommendation, a design choice for the planner):** offloading alone frees the loop. But the open phase (connect + headers + SDK retries) is still **outside** `asyncio.timeout(per_call_budget)`, which only starts at the drain (`agent_loop.py:589`). Two options:
- **A (recommended): one shared deadline.** The dispatcher computes `deadline = loop.time() + request.timeout_s`, runs the open under `asyncio.timeout_at(deadline)`, and stamps `stream.budget_deadline = deadline`. `_drain_stream_with_close_on_cancel` adds ~3 lines: `deadline = getattr(stream, "budget_deadline", None)`, then `asyncio.timeout_at(deadline) if deadline else asyncio.timeout(timeout_seconds)`. **The two drain call sites (`agent_loop.py:2580`, `:2685`) do not move.** Anthropic and Google streams carry no attribute, so they stay byte-identical. Open + drain then total at most N, which is what D-04's wording promises and what keeps the silent window below the stale sweep (R3).
- **B: a dispatcher-only guard** (`asyncio.timeout(timeout_s)` on the open). No `agent_loop.py` edit, but the silent window can reach **2N**: headers wait up to N, then a silent drain up to N, with no XADD in between. That pushes the safe ceiling to about 1140 s (R3).

Either way, on a guard timeout the late-finishing thread must **close the stream it eventually returns**, or the httpx response leaks (a cloud provider keeps generating and billing). Use `asyncio.shield` plus a done-callback (Code Examples §2). The guard raises `asyncio.TimeoutError`, which the agent loop re-raises (`agent_loop.py:3430`) into `run_producer`'s `timed_out` branch with `_timeout_ctx` already set (`agent_loop.py:2543-2546`, `:2611-2614`, set before the request is built). So it is classified exactly like a drain timeout.

### R3 — D-06: bounds below 3600 on the chat path

| Bound | Value | Binds a silent call ≤ 3600? | Evidence |
|---|---|---|---|
| **Run-stale sweep** (`run_reconciler._is_stale_chat_run`) | **2400 s** stream age (`config.py:1334`), tick 120 s | **YES.** A run whose `run:{id}` has no XADD for > 2400 s is terminalized `failed`. An LLM call emits nothing while silent (`'keepalive'` exists only in `tools/sandbox.py:824`). | CITED `run_reconciler.py:280-299` (`xinfo_stream` `last-generated-id` vs `redis.time()`); `config.py:1322-1334` comment: the sweep "MUST EXCEED the longest legit SILENT gap… silent-reasoning ceiling (~900s)" |
| SSE consumer deadline | `consumer_timeout_seconds = 610` (`config.py:1247`) | **No.** The consumer yields `{"error":"consumer_timeout"}` (`runs.py:206-208`). The chat frontend treats any `error` as possibly transient: it probes `/snapshot` and **re-attaches** while the run is `streaming` (`StreamsProvider.tsx:248-292`). ⚠ G-4 row 4 (> 600 s) will cross one re-attach. Watch for a flicker or a stray Resume. | CITED |
| SSE keepalive | `EventSourceResponse(..., ping=None)` → sse-starlette 2.4.1 `DEFAULT_PING_INTERVAL = 15` | No. A `: ping` comment every 15 s keeps proxies' idle timers alive | CITED `runs.py:500-523`; `sse_starlette/sse.py:70,125` |
| Redis `run:{id}` TTL | none while live; `EXPIRE` 600 s completed / 60 s else only at finalize | No | CITED `run_producer.py:283-286` |
| Anthropic non-streaming 10-min `ValueError` | n/a | No. The only call is `client.messages.stream(...)` (`anthropic_service.py:223`) | CITED + docs |
| Google `X-Server-Timeout` | genai sends `X-Server-Timeout: ceil(timeout_s)` whenever a timeout is set (`_api_client.py:181-186, 1311-1316`); today no header is sent (timeout None) | **Unknown.** Not documented by Google (search found no official page; community reports cite 600 s server deadlines). Registered Gemini timeouts are 180-600 s, so it only matters if an operator raises a Gemini model above 600. | LOW |
| Google connect timeout | genai passes a **scalar** per-request timeout, so connect = budget (no ≤10 s connect possible via `HttpOptions`; `client_args` cannot help because the per-request `timeout=` overrides it) | No (fails slow, not short) | CITED `_api_client.py:223-233, 1369-1379` |
| Coolify / Traefik proxy idle | not documented in `docs/DEPLOYMENT-*.md` | Not with 15 s pings | ASSUMED |
| Default thread pool | `min(32, cpu+4)` = 20 on this 16-core box; each live LLM call holds one thread (drain), plus one briefly for the open after D-05 | Not a time bound, but a concurrency ceiling per worker on a small VPS | MEASURED `os.cpu_count()=16`; VPS core count ASSUMED |
| Harness phase wall clock | `harness_phase_wall_clock_seconds = 3600` | Separate scope. Noted, not changed (D-06) | CITED `config.py:1498` |

**Verdict: 3600 does NOT stay.** The stale sweep binds. Recommend:
- `_LLM_CALL_TIMEOUT_MAX_S = 1800` (`config.py:750`) and `MODEL_CAP_INT_BOUNDS.llm_call_timeout_seconds = [1, 1800]` (`admin.ts:601`). These are the only two copies of the number; `admin.py:228` imports the constant and the env parser uses it.
- A boot validator beside `_validate_run_stale_sweep_bounds` (`config.py:1438-1466`): `run_stale_sweep_timeout_seconds > _LLM_CALL_TIMEOUT_MAX_S + run_stale_sweep_interval_seconds`. With defaults 2400 > 1800 + 120. No test sets `run_stale_sweep_timeout_seconds` (grep).
- A 422 detail that names the reason, e.g. *"'llm_call_timeout_seconds' must be between 1 and 1800 (inclusive), or null. Longer would outlast the run watchdog, which ends a run that has been silent for 2400 s."* Put the reason string next to the constant so the detail is not a third copy of the number.
- 1800 leaves 600 s of margin with option A. With option B the safe maximum is about 1140. Live rows top out at 900 (R7), so 1800 refuses nothing that exists.
- Alternative not recommended: raise `run_stale_sweep_timeout_seconds` above 3600. Dead runs would then show "running" for over an hour.

### R4 — D-01 plumbing map

`GatewayRequest` (`dispatcher.py:41-89`) is a `@dataclass` whose fields after `active_provider_name` all default. Add **`timeout_s: float | None = None`** last. Constructor sites (MEASURED `grep -rn "GatewayRequest(" app`):

| Site | Today | Proposed |
|---|---|---|
| `agent_loop.py:2553` (anthropic/google) | no budget | `timeout_s=per_call_budget` (+1 line; `per_call_budget` already resolved at `:2536`) |
| `agent_loop.py:2637` (compat/surface) | no budget | `timeout_s=per_call_budget` (+1 line; resolved at `:2604`) |
| `forced_emit.py:288, :309` (`_build_request`) | no budget | new kwarg `timeout_s: float \| None = None` on `_build_request`; `forced_emit()` resolves `await get_per_call_timeout_async(model, settings)` once before the rung loop. `test_forced_emit.py:566` calls `_build_request(**base)` without it (fine because of the default); `:602` asserts `src.count("_build_request(") == 1` (unchanged) |
| `task_service.py:300` | no budget | `timeout_s=await get_per_call_timeout_async(model, settings)` (one await at the build site) |

**Recommendation for forced_emit / task_service:** resolve the per-model value at their build site (the "constructor timeout from D-01" in CONTEXT's deferred list). It is one await each. The blast radius is the client constructor plus, with option A/B, the open guard. A raise there is already handled: forced_emit catches `Exception` and descends a rung; task_service propagates to the sub-agent. Leaving them `None` would keep Google on **no timeout at all** on the harness path.

Adapter → client:
- `openai_compat.open_openai_compat_stream` → `create_adaptive_streaming_chat(..., timeout_s=request.timeout_s)` → `get_llm_client(user_settings, **({"timeout_s": t, "max_retries": llm_max_retries_for(provider)} if t is not None else {}))`. Forward the kwargs **only when set**, so the two lambda fakes (`test_111_1_no_mangle_local.py:43` `lambda us=None`, `test_gateway_forcing.py:296` `lambda user_settings=None`) keep working: neither passes a budget. Every other fake in tests is `**kwargs` or a `MagicMock` (MEASURED grep).
- `openai_responses.open_openai_responses_stream:553` → `get_llm_client(request.user_settings, timeout_s=..., max_retries=2)` (forwarded the same way).
- `provider_gateway/anthropic.py:115` → `stream_anthropic(..., timeout_s=request.timeout_s)`; `stream_anthropic` builds `anthropic.Anthropic(api_key=, timeout=…, max_retries=…)`. Fakes are `def _fake_stream_anthropic(**kwargs)` (`test_gateway_forcing.py:127`, `test_provider_gateway_seam.py:189,249`); no test asserts captured-kwarg equality (grep `captured ==` returned nothing).
- `provider_gateway/google.py:97` → `stream_google(..., timeout_s=request.timeout_s)`; `genai.Client(api_key=, http_options=types.HttpOptions(timeout=int(t*1000)))` when set, else today's bare `genai.Client(api_key=)`. ⚠ `HttpOptions.timeout=0` is treated as no timeout (`if timeout:`), so never pass 0.
- `get_llm_client` signature: `def get_llm_client(user_settings=None, *, timeout_s: float | None = None, max_retries: int | None = None)`. If `timeout_s is None`, use `NO_BUDGET_LLM_TIMEOUT_S` / `NO_BUDGET_LLM_MAX_RETRIES`. Values go into `OpenAI(**kwargs)` **before** `wrap_openai` (`:1462`). MEASURED: `wrap_openai(c) is c` and the readback is `Timeout(connect=10, read=900, write=900, pool=900)`, `max_retries 0`.
- No-budget direct constructors that D-03 also covers: `openai_service.get_embedding_client:1499`, `extractors/aspects/vision_text.py:325`, `multimodal_service.py:691, :827`. Add `timeout=NO_BUDGET_LLM_TIMEOUT_S, max_retries=NO_BUDGET_LLM_MAX_RETRIES`. ⚠ This widens `files_modified` to `vision_text.py` and `multimodal_service.py` (G-5 FIRES, 11 phases). Constants home: `config.py` beside `DEFAULT_LLM_CALL_TIMEOUT_SECONDS` (below every caller, no import cycle).
- **For readback tests (D-09 part 1)**, prefer tiny builders (`_anthropic_client(api_key, timeout_s)`, `_google_client(api_key, timeout_s)`) so a test reads `.timeout` / `.max_retries` / `http_options` off a **real built client**, not off captured kwargs.

### R5 — D-04: the timeout message path

- `run_producer.py:866-886`: `except asyncio.TimeoutError:` sets `_terminal_status = "timed_out"`, `_terminal_error = f"timed_out: {budget}s per-call deadline exceeded at iteration {i} (model={model})"`. `_last_model_id` and `_last_per_call_budget` come from `_timeout_ctx` (`agent_loop.py:2543-2546`, `:2611-2614`), so both values are in scope.
- **Keep the `timed_out:` prefix.** `test_066_terminal_classification.py:73` asserts `startswith('timed_out:')`. The frontend's `categorizeError` (`lib/errorCategories.ts:13`) matches `/timed?\s*out/` so `categorySuffix` collapses it (`RunCard.tsx:680-691`). Without the prefix the status line would read **"timed out - failed"**. Suggested: `f"timed_out: {model} did not answer within {budget} s, its per-call timeout (Model Registry → Timeout). Iteration {i}."`
- ⚠ "the timeout set for it in the Model Registry" is not always literally true. The value may come from the env CSV, the static registry, or the 300-s inferred default (the 13 rowless local models). The DB row always wins when present, so "change it in Model Registry → Timeout" is honest. "set for it in the Model Registry" is not.
- ⚠ **Visibility:** the UI shows static copy "Agent reached time limit" (`RunCard.tsx:703-728`, by design D-066-10). The raw `runError` appears only as a **hover tooltip** (`RunCard.tsx:453` `title={message.runError}`). D-04 keeps the channel, so G-4 row 4 should read the text from the tooltip or DB `runs.error`. Making it visible inline would be a `RunCard.tsx` change (FIRES). This is an open question, not assumed.
- **Classification parity:** with read = budget, the asyncio timer starts before the SDK request (drain: MEASURED raise at 2.31 s against SDK 2 s + 0.3 s connect lag; open: the guard starts first). So the asyncio `TimeoutError` fires first in both phases, and it is the one path that reaches `timed_out`. An SDK `APITimeoutError` then arises only from a **connect** timeout (≤ 10 s, MEASURED same class) or a write timeout. That should **not** read "did not answer within N s". It flows to `classify_provider_error` → `unknown` today (`errors.py:147-212`). Optionally add a `connection` kind for `APITimeoutError` whose `__cause__` is `httpx.ConnectTimeout`. The Google `httpx.ReadTimeout` falls to the generic "unexpected error" handler (`agent_loop.py:3486`), but it is unreachable under the asyncio-first ordering, and Google's connect = budget anyway.

### R6 — D-07: does the Registry already render the 422 detail? YES

- `setModelCapability` (`lib/api/admin.ts:811-822`) throws `new ApiError(await errorDetail(res, …), res.status)`. `errorDetail` returns `j.detail` when it is a string (`admin.ts:468-476`), so a 422 carries the server sentence.
- `ModelRow.write` (`ModelRegistryTab.tsx:396-412`) catches it with `setErrorDetail(err instanceof ApiError ? err.message : …)`, rendered in an in-row `<tr data-model-error={id}>` with `role="alert"` (`:586-595`). The timeout cell commits through `write({[f.key]: v})` (`:475-478`) and `NumericCell` sends any finite integer (`:725-733`).
- **Minimal change:** none for display; the path exists. Existing tests cover only 409 (`ModelRegistryTab.test.tsx:179`), so add a 422 case asserting the detail lands in `role="alert"`. Add the help line (wording from R1) under the Timeout column or the editing input, and interpolate the bound from `MODEL_CAP_INT_BOUNDS` instead of typing the number (no third copy). "Beside the field" is satisfied by the existing in-row slot, which spans the row directly under the model. If a literal per-cell placement is wanted, that is a `NumericCell` change.

### R7 — D-08: live LOCAL rows (MEASURED, read-only)

`asyncpg` to the Supabase CLI default local DSN (`postgres:postgres@127.0.0.1:54322`). `backend/.env` was **not** read; a permission rule denies it.
```
select model_id, provider, enabled, llm_call_timeout_seconds from model_capabilities_overrides where llm_call_timeout_seconds is not null
→ 900: kimi-k3(moonshot), openai/gpt-oss-20b(lmstudio), claude-opus-5(anthropic), qwen3.6-35b-a3b-mtp(lmstudio), qwen3.5-9b-mtp(lmstudio), stealth/ox-alpha(openrouter)
  600: gemini-3.8-flash, gemini-3.6-flash
  550: nvidia_nvidia-nemotron-nano-9b-v2, qwen-agentworld-35b-a3b, glm-4.7-flash (all lmstudio)
total_non_null 11 · outside_[1,3600] 0 · above_1800 0 · above_600 6
CHECK constraints on the table: api_surface, emit_tier, max_tools, reasoning_off — none on llm_call_timeout_seconds
```
Static `MODEL_CAPABILITIES` timeouts: max 900 (15 rows). Production must be read by the orchestrator via MCP (SELECT only):
`select count(*) filter (where llm_call_timeout_seconds not between 1 and 1800), count(*) filter (where llm_call_timeout_seconds > 600) from model_capabilities_overrides;`

### R8 — FIX-07: store, presence registry, keyboard, tests

**Store to mirror.** The only zustand store in `frontend/src/stores` is `streamsStore.ts` (zustand `^5.0.13`, `create<…>()(subscribeWithSelector(...))`, `streamsStore.ts:36,475`). Use the same idiom in a **new** `frontend/src/stores/askDraftStore.ts`. ⚠ zustand v5 selectors must return stable references. Follow the repo's `EMPTY_ASKS` constant pattern (`StreamsProvider.tsx:155, 4502`): return a module-level `EMPTY_DRAFT`, never a fresh `{}`. ASSUMED v5 behaviour; the repo precedent is CITED.

**Clear-on-remove without editing StreamsProvider (FIRES):** `useStreamsStore` is built with `subscribeWithSelector`, and `useStreamsStore.subscribe(selector, listener)` is already used at `StreamsProvider.tsx:3977, 4195`. The new module subscribes at module load to `s => s.pendingAsksByThread`. On each change it collects every live `tool_call_id` across all threads and deletes drafts whose id is gone. That covers `removePendingAskForThread`, `replacePendingAsksForThread` and SSE settles (`StreamsProvider.tsx:3562-3588`) with zero provider edits, and it keeps drafts across thread switches (thread A's asks stay in the map). Clear-on-answer is an explicit `clearDraft(id)` in `handleSubmit`'s success arm. Clear-on-expiry happens in the `state === "expired"` transition.

**Presence registry:** `panelHomes: Record<threadId, number>`. `PendingAskStack home="panel"` increments in a **`useLayoutEffect`** and decrements on cleanup; `useLayoutEffect` avoids a painted frame with two inputs. The chat home reads `panelHomes[threadId] > 0`. WorkspacePanel renders the body (and so the panel stack) only when open on desktop or when the mobile Radix `Sheet` is open. `SheetContent` unmounts when closed, so presence equals visibility (`WorkspacePanel.tsx:586-641`). The mount condition `pendingAsks.length > 0` (`:436`) is unchanged; the edit is just `<PendingAskStack home="panel" />`.

**Pointer focus:** in variant A the panel card is the only full card, so DOM ids are unique again. Today two cards duplicate `ask-${id}-prompt` / `ask-${id}-free`, which is an existing aria-labelledby collision. Give the card root `data-ask-card={tool_call_id}` and `data-ask-home`. The pointer's button runs `document.querySelector('[data-ask-home="panel"][data-ask-card="…"]')?.querySelector('[role="radio"][tabindex="0"], textarea')?.focus()`. Focus scrolls the panel's `overflow-y-auto` body. A ref registry in the store is an equivalent, testable alternative (discretion).

**WorkflowRunPage:1638** mounts `<PendingAskCard ask=… />` directly with asks from the same `useAskUserPrompt` slice (`WorkflowRunPage.tsx:569, 1622-1650`). If the card reads its draft from the store by `ask.tool_call_id`, **the page needs no edit**.

**Provider-mock constraint:** eight suites mock `@/providers/StreamsProvider` with an allow-list factory (`PendingAskCard.tsx:770-781` comment). A new provider-hook import would throw there. The new store is a plain module, not mocked, and safe.

**Radio keyboard (CITED, W3C WAI-ARIA APG Radio Group, w3.org/WAI/ARIA/apg/patterns/radio/):** Tab enters on the checked radio, or the first if none is checked. Right/Down moves focus to the next radio **and checks it**, wrapping last→first. Left/Up does the reverse. Space checks the focused radio if it is not already checked. Implementation: `tabIndex = (choiceIndex ?? 0) === i ? 0 : -1`; `onKeyDown` handles Arrow keys (`preventDefault`, set choice, focus the target via a refs array). ⚠ **Space conflict with D-13:** a native `<button>` turns Space into `click`, and `onClick` toggles. Pressing Space on the checked chip would **uncheck** it, contradicting APG. Intercept `" "` in `onKeyDown` (`preventDefault` + select-only) and keep the click toggle for mouse and Enter. Add a filled/hollow radio dot (`aria-hidden`) for the non-colour mark.

**Test hazards (MEASURED by reading):**
- `streamsProvider_244_settle_ask` Test 11 (`:563-591`) leaves the draft "Do not run it" on `tc-1` after a 500. Test 12 (`:593-610`) renders a bare card for `tc-1` and clicks "Do not run it", which would **deselect** it, so `Send Answer` stays disabled and the test fails. The suite's `beforeEach` (`:184-201`) sets `pendingAsksByThread: new Map()`, so the **GC subscription clears it** and the suite survives unedited. That only holds if GC listens to that slice.
- `PendingAskCard.test.tsx` (45 cases) mocks the provider (`hookState`) and never touches `pendingAsksByThread`, so GC never fires and drafts on `tc-ask-1` / `tc-ask-2` / `tc-armed-1` leak across cases. **Required:** a reset. Recommended is a one-line global `afterEach(() => resetAskDrafts())` in `frontend/src/setupTests.ts` (covers every current and future suite). The alternative is per-suite `afterEach` edits in each suite that renders a card.
- Fences that must stay green **unedited**: `MessageItem.inlineApproval` 6c (`:582-621`, checks `panel` `toContain("<PendingAskStack")` and exactly 1 `<PendingAskStack` in comment-stripped `MessageList.tsx`; `home="panel"` keeps both true); W2 / 5 / W5 (chat-only renders); `Seam.test.tsx:84-88` (renders `<PausedRunCue />` only; the pointer lives in the stack, not the cue); settle_ask 9/10 (two bare stacks = two chat homes = two full cards, now sharing one draft; still 2 `Send Answer`).
- Files to update in the card's commit: `PendingAskCard.retired.baseline.test.tsx:238` (`toBe(837)`; `wc -l` = 836, `split("\n").length` = 837), and `scripts/vitest-count-gate.cjs` **both knobs**: the per-file counts (`PendingAskCard.test.tsx: 45` :3139, `PendingAskCard.retired.baseline.test.tsx: 9` :3337, `WorkspacePanel.test.tsx: 58` :1693, `ModelRegistryTab.test.tsx: 29` :129, `streamsProvider_244_settle_ask.test.tsx: 16` :3328, `MessageItem.inlineApproval.test.tsx: 13` :3916, `Seam.test.tsx: 8` :136) **and** the run-list entries (`:4639, :4897, :5448, :5453, :5794, :5863`) for any **new** suite (e.g. `askDraftStore.test.ts`, `PendingAskStack.oneInput.test.tsx`).
- `grep -c "useState[(<]" PendingAskCard.tsx` = **9** (includes `DraftBlock`'s `overlayOpen`), `useEffect(` = 2. After the move: **7** useState (choiceIndex and freeText leave), plus one store hook. That is the honoured-by-construction figure for the ledger section.

### R9 — G-5 / ledger (MEASURED with the CLAUDE.md recipe, six-digit buckets removed; scan list parsed with the gate's own header)

| File | commits / phases / lines | Scan-list row | Note |
|---|---|---|---|
| `backend/app/services/openai_service.py` | 78 / 39 / 2569 | ROW | FIRES |
| `backend/app/services/anthropic_service.py` | 11 / 10 / 354 | ROW | FIRES |
| `backend/app/services/google_service.py` | 11 / **7** / 638 | **MISSING** | FIRES, absent for its whole life: needs a row + section |
| `backend/app/services/provider_gateway/dispatcher.py` | 8 / 3 / 196 | ROW | FIRES (3) |
| `backend/app/services/provider_gateway/openai_compat.py` | 6 / 4 / 525 | ROW | touch only if `timeout_s` forwarding lands here |
| `backend/app/services/provider_gateway/openai_responses.py` | 1 / 1 / 563 | ROW | |
| `backend/app/services/provider_gateway/anthropic.py` | 4 / **4** / 124 | **MISSING** | FIRES: needs a row |
| `backend/app/services/provider_gateway/google.py` | 3 / **3** / 106 | **MISSING** | FIRES: needs a row |
| `backend/app/services/provider_gateway/errors.py` | 4 / 2 / 325 | **MISSING** | only if a `connection` kind is added |
| `backend/app/config.py` | 91 / 53 / 1705 | ROW | FIRES; `MODEL_CAPABILITIES` seam owed, not taken |
| `backend/app/api/admin.py` | 41 / 16 / 2013 | ROW | only if the 422 detail wording changes |
| `backend/app/services/run_producer.py` | 22 / 10 / 1129 | ROW | D-04 wording |
| `backend/app/services/agent_loop.py` | 66 / 32 / 3675 | ROW | +1 kwarg ×2 GatewayRequest; option A adds ~3 lines in the drain helper body (call sites unchanged) |
| `backend/app/services/forced_emit.py` | 11 / 7 / 716 | ROW | |
| `backend/app/services/task_service.py` | 22 / 12 / 986 | ROW | |
| `backend/app/services/multimodal_service.py` | 21 / 11 / 1072 | ROW | only if D-03 no-budget constants applied there |
| `backend/app/services/extractors/aspects/vision_text.py` | 5 / 0 / 539 | ROW | same |
| `frontend/src/components/panel/PendingAskCard.tsx` | 15 / 8 / 836 | ROW | FIRES |
| `frontend/src/components/panel/WorkspacePanel.tsx` | 16 / 10 / 646 | ROW | FIRES |
| `frontend/src/components/admin/ModelRegistryTab.tsx` | 16 / 6 / 1661 | ROW | FIRES |
| `frontend/src/lib/api/admin.ts` | 7 / 4 / 1099 | ROW | bound mirror |
| `frontend/src/stores/askDraftStore.ts` (new) | 0 / 0 / — | **MISSING** | new file: needs a row |
| `frontend/src/setupTests.ts` | 2 / 1 / 8 | **MISSING** | not exempt by the gate's regexes (`EXEMPT` matches `__tests__/`, `*.test.*`, not `setupTests.ts`): needs a row if touched |
| `frontend/src/components/chat/RunCard.tsx` | 31 / 16 / 729 | ROW | only if D-04 text is made visible inline |

Run `node scripts/check-hot-file-ledger.cjs 282` after the PLAN.md files exist. ⚠ Several CLAUDE.md FIRING-table triples above are stale (e.g. `openai_service.py` reads `72 / 36 / 2268`, `anthropic_service.py` `11 / 10 / 354`). Re-derive in the same commit as the edit.

### R10 — SC#10 roster (MEASURED from `MODEL_CAPABILITIES` + local registry rows)

| # | Provider | Newest `MODEL_CAPABILITIES` id (registry-backed) | api_surface / emit_tier / timeout | Newer DB-only id (capability via DB row) |
|---|---|---|---|---|
| 1 | OpenAI | `gpt-5.6-sol` | **responses** / force_strict / 900 (exercises the Responses client builder) | — |
| 2 | Anthropic | `claude-sonnet-5` | — / force / 900 | `claude-opus-5-5`, `claude-sonnet-5-5` |
| 3 | Google | `gemini-3.5-flash` | — / force / 300 | `gemini-3.8-flash` (600) |
| 4 | DeepSeek | `deepseek-v4-pro` | — / force / 900 | — |
| 5 | Zhipu | `glm-5.2` | — / force / 900 | `glm-5.3` |
| 6 | MiniMax | `MiniMax-M3` | — / force / 600 | — |
| 7 | Moonshot | `kimi-k2.6` | — / **coerce** / 600 | `kimi-k3` (900) |
| 8 | OpenRouter | `z-ai/glm-5.2` (or `deepseek/deepseek-v4-pro`) | — / force / 900; `native_tools: False` statically | — |

The CLAUDE.md rule says to prefer a `MODEL_CAPABILITIES` id (an unlisted id resolves `capability_source=inferred` and loses `emit_tier`). Use column 3. DB-only ids are listed so the operator can choose "newest" knowingly. Add a local LM Studio row (e.g. `openai/gpt-oss-20b`, 900 s) for G-4 row 4; it is not one of the 8.

**Key presence:** the DB tier (`app_settings`, read-only, presence counts only) shows `openai_api_key` = 1 row and `custom_api_key` = 1. anthropic / google / openrouter / deepseek / moonshot / minimax / zhipu are 0 in the DB. Env-tier keys live in `backend/.env`, which **could not be read** (permission deny rule), so env presence is **UNVERIFIED**. The orchestrator or operator must confirm before marking rows ⛔. LM Studio (`localhost:1234`) is **not running** right now (MEASURED `curl` → 000). Backend `:8000` and Vite `:5173` are up (200).

## Standard Stack

No new packages. Everything uses what is installed (MEASURED versions):

| Library | Version | Purpose |
|---|---|---|
| `openai` | 2.28.0 | OpenAI-compat + Responses clients (`timeout=httpx.Timeout`, `max_retries`) |
| `anthropic` | 0.97.0 | native client (`timeout`, `max_retries`) |
| `google-genai` | 2.6.0 | native client (`HttpOptions(timeout=ms)`, `retry_options`) |
| `httpx` | 0.28.1 | `httpx.Timeout(t, connect=10)` |
| `langsmith` | 0.2.3 | `wrap_openai` (constructor values survive the wrap; MEASURED) |
| `sse-starlette` | 2.4.1 | 15 s ping (no change) |
| `zustand` | ^5.0.13 | new draft store |
| Python | 3.12.6 | `asyncio.to_thread`, `asyncio.timeout_at` |

## Package Legitimacy Audit

No external packages are installed by this phase, so slopcheck was not run (nothing to check).

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
POST /threads/{id}/messages ─► run_producer ─► agent_loop iteration
                                   │               │ XADD iteration_start  ─────────────► Redis run:{id} ◄── run_reconciler (kills if no XADD > 2400 s)
                                   │               ▼
                                   │   per_call_budget = get_per_call_timeout_async(model)   [DB clamp D-08]
                                   │               ▼
                                   │   GatewayRequest(..., timeout_s=per_call_budget)
                                   │               ▼
                                   │   dispatcher.open_stream(provider, req)
                                   │      ├─ anthropic/google ─► lazy generator (client built in producer thread:
                                   │      │                      Anthropic(timeout, max_retries=2) / genai HttpOptions(timeout ms))
                                   │      └─ else (compat / responses):
                                   │           deadline = now + timeout_s
                                   │           await to_thread(open_*_stream) under timeout_at(deadline)   [D-05]
                                   │              └─ get_llm_client(timeout_s, max_retries = 0 local | 2 cloud) → OpenAI(...) → wrap_openai
                                   │           stream.budget_deadline = deadline
                                   │               ▼
                                   │   _drain_stream_with_close_on_cancel (timeout_at(deadline) if stamped, else timeout(budget))
                                   │               │ chunks → _emit XADD → SSE consumer (15 s pings, 610 s re-attach)
                                   ▼               ▼
                     except TimeoutError → runs.status=timed_out, error="timed_out: <model> did not answer within N s…"

Browser:  pendingAsksByThread (streamsStore) ──subscribe──► askDraftStore.drafts GC
          PendingAskStack home="panel" (WorkspacePanel, mounted iff panel body visible) ──layoutEffect──► panelHomes[thread]++
          PendingAskStack home="chat"  (MessageList, unconditional) ── panelHomes[thread] > 0 ? Pointer : full PendingAskCard
          every PendingAskCard / Pointer ──read/write──► askDraftStore.drafts[tool_call_id]
```

### Recommended file additions
```
frontend/src/stores/askDraftStore.ts          # drafts + panelHomes + GC subscription + resetAskDrafts()
frontend/src/stores/__tests__/askDraftStore.test.ts
frontend/src/components/panel/__tests__/PendingAskStack.oneInput.test.tsx   # D-15 new fences
backend/tests/unit/test_282_client_timeouts.py   # D-09 part 1 readback, all 4 families
backend/tests/unit/test_282_open_off_loop.py     # D-05 ticker fence + shared deadline + late-close
backend/tests/unit/test_282_slow_stub_scaled.py  # D-09 part 2 (SCALED)
backend/tests/unit/test_282_timeout_bound.py     # D-06/D-08 clamp + validator + 422 detail
```

### Anti-Patterns to Avoid
- **`client.with_options(timeout=…)` after `wrap_openai`**: drops LangSmith tracing (CONTEXT). Use the constructor.
- **`loop.run_in_executor` for the open**: loses `contextvars` (LangSmith parent run). Use `asyncio.to_thread`.
- **Copying the draft between cards** (`useEffect` sync): the roadmap's named failure. Read one store.
- **Narrowing either `PendingAskStack` mount condition**: SHELL-03 a third time.
- **A second self-hosted predicate** (`provider in ("ollama","lmstudio")`): the mig-180 table is the one home.
- **Typing 1800 in the help line or the 422 detail**: a third copy of the bound.
- **GC on card unmount**: breaks "two threads keep separate drafts" (thread switch unmounts the chat card) and the panel↔chat handoff.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Retry/backoff on 429/5xx | a new app-level retry loop | SDK `max_retries` (honours `retry-after`, jitter) | Docs-recommended; the app's own loop already covers mid-stream errors |
| Timeout enforcement inside the SDK call | threading timers / signal | `httpx.Timeout` in the constructor + `asyncio.timeout_at` | Both already in use |
| Off-loop sync call with context | a custom thread + queue | `asyncio.to_thread` | Propagates contextvars |
| Store change detection | polling / provider edit | `useStreamsStore.subscribe(selector, listener)` (`subscribeWithSelector`) | Already the provider's own pattern |
| Radio keyboard semantics | invent | WAI-ARIA APG radio group | Tests already query `getByRole("radio")` |

## Common Pitfalls

### Pitfall 1: The stale sweep kills a legitimately slow run
**What goes wrong:** a run silent for more than 2400 s is marked `failed` by `run_reconciler`.
**How to avoid:** cap at 1800, add the validator, and use the shared deadline (option A) so the silent window ≤ N.
**Warning signs:** `runs.status='failed'` with no provider error, a "Run reconciler terminalized" log.

### Pitfall 2: Orphaned retries after a timeout
**What goes wrong:** MEASURED. A producer thread whose generator cannot be closed (Anthropic) or an open-phase thread keeps re-sending with `max_retries=2` after the run timed out.
**How to avoid:** use 0 for self-hosted (the case that actually times out). For cloud it is accepted and documented, because cloud streams send pings. The late-close callback covers the compat open phase.

### Pitfall 3: A connect timeout reads as "did not answer within N s"
**What goes wrong:** `APITimeoutError` is the same class for connect and read timeouts (MEASURED).
**How to avoid:** only the asyncio `TimeoutError` gets the D-04 wording. SDK timeouts stay provider errors (optionally a `connection` kind keyed on `__cause__`).

### Pitfall 4: Losing the `timed_out:` prefix
**What goes wrong:** the RunCard reads "timed out - failed", and `test_066_terminal_classification` goes red.
**How to avoid:** keep the prefix.

### Pitfall 5: Draft leakage across test cases
**What goes wrong:** a module-level store outlives `cleanup()`, and toggle-to-deselect flips leaked selections (R8).
**How to avoid:** a global reset in `setupTests.ts` plus GC on the ask slice.

### Pitfall 6: Space on the checked chip deselects it
**What goes wrong:** a native button turns Space into a click, and the click toggles.
**How to avoid:** intercept Space in `onKeyDown`.

### Pitfall 7: One painted frame with two inputs
**What goes wrong:** the presence registry is set in `useEffect` after paint.
**How to avoid:** use `useLayoutEffect`.

### Pitfall 8: The pointer shows "NEEDS YOU" for an expired or answered ask
**What goes wrong:** countdown, answered and submitting state stay local to the card, which is in the panel.
**How to avoid:** derive expiry in the pointer from the same `created_at` + `timeout_seconds` arithmetic (extract a pure helper), or keep a `settled` flag in the draft store. A panel toggle mid-submit would otherwise remount a chat card showing `Send Answer` until the reconcile lands (a 409/404 is then the honest refusal).

### Pitfall 9: Setting `budget_deadline` on a stream that is a bare generator
**What goes wrong:** a test that patches `open_openai_compat_stream` itself to return a generator raises `AttributeError` when the attribute is set.
**How to avoid:** guard with `try/except AttributeError` (the shipped adapters return settable classes).

### Pitfall 10: The 610 s SSE consumer deadline during G-4 row 4
**What goes wrong:** one re-attach is expected (not a failure). A Resume button or flicker there is a separate finding, not this phase's regression.

### Pitfall 11: Default executor size on the VPS
**What goes wrong:** long calls hold threads. ASSUMED small core count.
**How to avoid:** note it; out of scope.

## Code Examples

### 1. Client construction (OpenAI-family)
```python
# openai_service.get_llm_client — values in the CONSTRUCTOR, before wrap_openai
import httpx
from app.config import NO_BUDGET_LLM_TIMEOUT_S, NO_BUDGET_LLM_MAX_RETRIES, LLM_CONNECT_TIMEOUT_S
def get_llm_client(user_settings=None, *, timeout_s: float | None = None, max_retries: int | None = None) -> OpenAI:
    ...
    t = NO_BUDGET_LLM_TIMEOUT_S if timeout_s is None else timeout_s
    kwargs["timeout"] = httpx.Timeout(t, connect=min(LLM_CONNECT_TIMEOUT_S, t))   # D-02
    kwargs["max_retries"] = NO_BUDGET_LLM_MAX_RETRIES if max_retries is None else max_retries
    client = OpenAI(**kwargs)
    # ... wrap_openai unchanged (MEASURED: wrap returns the same instance, values readable)
```

### 2. Dispatcher off-loop open with shared deadline and late-close
```python
# dispatcher.open_stream else-branch (sketch)
import asyncio
def _open_openai_family(request):              # the existing sync body: surface fork + compat
    ...
async def _open_off_loop(request):
    loop = asyncio.get_running_loop()
    task = asyncio.ensure_future(asyncio.to_thread(_open_openai_family, request))   # contextvars propagate
    if request.timeout_s is None:
        return await task
    deadline = loop.time() + request.timeout_s
    try:
        async with asyncio.timeout_at(deadline):
            stream, mode = await asyncio.shield(task)
    except TimeoutError:
        def _close_late(t):
            if not t.cancelled() and t.exception() is None:
                try: t.result()[0].close()
                except Exception: pass
        task.add_done_callback(_close_late)
        raise                                     # → agent_loop re-raises → run_producer timed_out
    try:
        stream.budget_deadline = deadline         # option A: the drain honours the same deadline
    except AttributeError:
        pass
    return stream, mode
```

### 3. Drain helper (option A, call sites unchanged)
```python
deadline = getattr(stream, "budget_deadline", None)
cm = asyncio.timeout_at(deadline) if deadline is not None else asyncio.timeout(timeout_seconds)
async with cm:
    ...
```

### 4. Draft store (shape)
```ts
// frontend/src/stores/askDraftStore.ts
import { create } from "zustand"
import { useStreamsStore } from "./streamsStore"
export interface AskDraft { choiceIndex: number | null; freeText: string }
export const EMPTY_DRAFT: AskDraft = Object.freeze({ choiceIndex: null, freeText: "" }) as AskDraft
interface S {
  drafts: Record<string, AskDraft>; panelHomes: Record<string, number>
  setChoice(id: string, i: number | null): void; setFreeText(id: string, t: string): void
  clearDraft(id: string): void; addPanelHome(threadId: string): void; removePanelHome(threadId: string): void
}
export const useAskDraftStore = create<S>()((set) => ({ /* ... */ }))
export const useAskDraft = (id: string) => useAskDraftStore((s) => s.drafts[id] ?? EMPTY_DRAFT)
export function resetAskDrafts() { useAskDraftStore.setState({ drafts: {}, panelHomes: {} }) }
// GC: drafts whose ask left pendingAsksByThread
useStreamsStore.subscribe((s) => s.pendingAsksByThread, (map) => {
  const live = new Set<string>(); for (const asks of map.values()) for (const a of asks) live.add(a.tool_call_id)
  const { drafts } = useAskDraftStore.getState()
  const dead = Object.keys(drafts).filter((id) => !live.has(id))
  if (dead.length) useAskDraftStore.setState({ drafts: Object.fromEntries(Object.entries(drafts).filter(([id]) => live.has(id))) })
})
```

### 5. Scaled SC#1 stub (D-09 part 2, labelled SCALED)
```python
# patch the SDK default down so the test is RED before the fix:
monkeypatch.setattr("openai._base_client.DEFAULT_TIMEOUT", httpx.Timeout(1.0, connect=1.0))  # "old 600" → 1 s
# budget (the setting) = 3 s; stub holds headers (and, in a second case, the gap between chunks) 2 s
# inequality preserved: 1 s (old default) < 2 s (stub) < 3 s (setting) — SCALED from 600 < 700 < 900
```
CITED: `openai/_base_client.py:859-870` applies `DEFAULT_TIMEOUT` when no timeout is given; `openai/_constants.py:9`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| SDK defaults by omission (600 s / 2) | explicit constructor values per provider class | this phase | the operator's number becomes real |
| Sync `create` on the event loop | `asyncio.to_thread` at the gateway | this phase | one slow local model no longer freezes a worker |
| Per-card `useState` draft | one store keyed by `tool_call_id` | this phase | renderings cannot disagree |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `asyncio.to_thread` preserves LangSmith parent-run nesting for `wrap_openai` traces | R2 | traces appear unparented (cosmetic). Verify in the SC#10 run via LangSmith |
| A2 | Google `X-Server-Timeout` accepts values up to the new ceiling without server rejection | R3 | Gemini rows with timeout > 600 could 4xx. Only if an operator raises them |
| A3 | Coolify/Traefik idle timeout is not hit given the 15 s SSE pings | R3 | long runs drop the SSE (frontend re-attaches anyway) |
| A4 | Production VPS core count is small, so the default executor holds ~6-8 threads | Pitfall 11 | concurrency ceiling, pre-existing |
| A5 | zustand v5 loops on non-stable selector returns (the repo already uses `EMPTY_*` constants) | R8 | infinite render if a fresh object is returned |
| A6 | Env-tier provider keys exist for the roster | R10 | rows become ⛔. Orchestrator confirms |
| A7 | Keeping cloud `max_retries=2` is acceptable despite the 502/503/529 overlap | R1 | contradicts a literal D-03 reading. Needs ratification |

## Open Questions

1. **Cloud `max_retries`: 2 or 0?** Measured: the app retries only 502/503/529 + upstream messages. Recommendation: 2. The planner records the ratification.
2. **Option A (shared deadline, +3 lines in the drain helper of `agent_loop.py`, FIRES) vs B (dispatcher-only, ceiling ≈ 1140)?** Recommendation: A, ceiling 1800.
3. **Should the D-04 sentence be visible inline** (RunCard, FIRES) rather than only as a tooltip / DB value? D-04 says existing channel. Recommend leaving it and having G-4 row 4 read `runs.error`.
4. **Apply the D-03 no-budget constants to `vision_text.py` / `multimodal_service.py` / `get_embedding_client`?** D-03 lists vision, metadata and embeddings, so yes. It adds two FIRING files with 2-kwarg diffs.
5. **Production `model_capabilities_overrides` timeout distribution**: orchestrator MCP SELECT (query in R7).
6. **Env-tier key presence for the 8 rows**: orchestrator or operator.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| backend venv Python | all backend tests | ✓ | 3.12.6 | — |
| Node | vitest, gates | ✓ | v24.19.0 | — |
| Local Supabase Postgres :54322 | D-08 read, integration | ✓ (MEASURED connect) | — | — |
| Backend :8000 | SC#10 / G-4 drives | ✓ (200) | — | operator starts it (memory: user starts backend) |
| Vite :5173 | G-4 drives | ✓ (200) | — | — |
| LM Studio :1234 | G-4 row 4 (slow local model) | ✗ (curl 000) | — | operator starts it before plan 03; otherwise row 4 ⛔ |
| Ollama :11434 | optional local row | ✗ | — | LM Studio |
| Cloud provider keys | SC#10 rows 2-8 | DB tier: only openai/custom; env tier UNVERIFIED | — | ⛔ rows with reason |
| Chrome MCP | G-4 | not probed here | — | — |

## Validation Architecture

(`workflow.nyquist_validation` is `false` in `.planning/config.json`; included because the orchestrator asked for test commands per SC.)

### Test Framework
| Property | Value |
|---|---|
| Backend | pytest (backend/venv), `pytest.ini` / `backend/tests` |
| Frontend | Vitest 4.1 + RTL + vitest-axe (`frontend/vitest.config.ts`, `src/setupTests.ts`) |
| Quick run (backend) | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_282_*.py -q` |
| Quick run (frontend) | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run src/stores/__tests__/askDraftStore.test.ts src/components/panel/__tests__ src/__tests__/providers/streamsProvider_244_settle_ask.test.tsx src/components/chat/__tests__/MessageItem.inlineApproval.test.tsx src/components/admin/__tests__/ModelRegistryTab.test.tsx` |
| Full (per wave) | `node scripts/check-backend-unit-baseline.cjs` · `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) · `cd frontend && npx tsc -p tsconfig.app.json --noEmit` (set diff vs base) · `node scripts/check-hot-file-ledger.cjs 282` · `node scripts/check-claude-md-size.cjs` |

### Phase Requirements → Test Map
| SC / Req | Behavior | Type | Automated Command | File Exists? |
|---|---|---|---|---|
| SC#1 / FIX-06 | `.timeout` / `.max_retries` read back from OpenAI-compat (local=0, cloud=2), Responses, Anthropic, Google `http_options.timeout == budget*1000` | unit | `pytest tests/unit/test_282_client_timeouts.py -q` | ❌ Wave 0 |
| SC#1 | SCALED slow stub completes: SDK default patched to 1 s, setting 3 s, stub 2 s, through real `open_stream` + real drain helper; RED before fix | unit (real socket) | `pytest tests/unit/test_282_slow_stub_scaled.py -q` | ❌ |
| SC#1 / D-05 | ticker gap < 0.5 s while the stub holds headers 2 s; open counted in budget; late stream closed after guard fires | unit | `pytest tests/unit/test_282_open_off_loop.py -q` | ❌ |
| SC#1 refusal | PATCH 1801 → 422 with reason; DB-tier value 5000 → clamped to max with log; validator rejects `run_stale_sweep_timeout_seconds ≤ max+interval` | unit | `pytest tests/unit/test_282_timeout_bound.py -q` | ❌ |
| SC#1 refusal (UI) | 422 detail rendered in `role="alert"` row; help line present | vitest | `npx vitest run src/components/admin/__tests__/ModelRegistryTab.test.tsx` | ✅ (add cases) |
| SC#2 | timed_out error text names model + N s and keeps `timed_out:` prefix; `test_066_terminal_classification` still green | unit/integration | `pytest tests/unit/test_282_timeout_bound.py tests/integration/test_066_terminal_classification.py -q` | partial |
| SC#3 | exactly one `Send Answer` across homes with panel home mounted; selection mirrors via `aria-checked` + pointer draft text; rail mid-draft keeps selection; workflow pause with no panel home has input; pointer button focuses card radio | vitest | `npx vitest run src/components/panel/__tests__/PendingAskStack.oneInput.test.tsx` | ❌ |
| SC#3 a11y | Arrow keys move + check with wrap; roving tabindex; Space selects without deselecting; non-colour dot; axe clean | vitest | `npx vitest run src/components/panel/__tests__/PendingAskCard.test.tsx` | ✅ (add cases) |
| SC#3 fences | 6c, W2, Seam 84-88, settle_ask 9/10 unedited and green | vitest | the quick-run frontend command | ✅ |
| SC#4 (SC#10) | 8-row board (+ multi-tool, parallel-thread, long-message rows) | manual, live, per-request model+provider | evidence file `282-LIVE-EVIDENCE.md` | — |
| SC#5 (G-4) | rows 1-4 via Chrome MCP, DOM-state reads | manual | — | — |

### Sampling Rate
- **Per task commit:** the targeted quick-run commands above.
- **Per wave merge:** the full gates.
- **Phase gate:** full suites green (backend ≤ baseline, count gate OK with per-file deltas) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_282_client_timeouts.py`, `test_282_open_off_loop.py`, `test_282_slow_stub_scaled.py`, `test_282_timeout_bound.py`
- [ ] `frontend/src/stores/__tests__/askDraftStore.test.ts`, `frontend/src/components/panel/__tests__/PendingAskStack.oneInput.test.tsx`
- [ ] `setupTests.ts` reset hook (or per-suite resets)
- [ ] count-gate entries (both knobs) for new suites

## Security Domain

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Registry PATCH is operator-gated (router default-deny + `operator_audit_floor`); unchanged |
| V5 Input Validation | yes | server-side int range in `admin.py` PATCH (422 before any DB touch); DB-tier clamp on read (D-08); env parser bound; config validator at boot |
| V6 Cryptography | no | — |
| V11 / availability | yes | event-loop blocking is a DoS vector (D-05 fix); a 0/negative timeout is the T-066-05 DoS (min bound kept) |

| Pattern | STRIDE | Mitigation |
|---|---|---|
| One slow upstream freezes a worker for all users | DoS | `asyncio.to_thread` open (MEASURED fix) |
| Stored absurd timeout bypasses PATCH bound (pre-bound rows) | Tampering/DoS | DB-tier clamp + log |
| Agent-supplied prompt/options rendered in the pointer | XSS | plain React text children only (T-087-11), no `dangerouslySetInnerHTML` |
| Orphan re-sends after timeout (billing) | Repudiation/cost | local `max_retries=0`; late-close callback |

## Sources

### Primary (HIGH)
- OpenAI Python SDK README: github.com/openai/openai-python (retries, timeouts)
- Anthropic Python SDK docs: platform.claude.com/docs/en/api/sdks/python (retries, timeouts, long requests)
- google-genai 2.6.0 installed source: `google/genai/types.py:2283-2360`, `_api_client.py:181-233, 506-555, 840-870, 1300-1380`
- openai 2.28.0 / anthropic 0.97.0 installed source: `_constants.py:9-10`, `_base_client.py:853-870`
- W3C WAI-ARIA APG Radio Group: w3.org/WAI/ARIA/apg/patterns/radio/
- Codebase reads listed inline (file:line)

### Secondary (MEDIUM)
- sse-starlette 2.4.1 installed source (`sse.py:70,125`)

### Tertiary (LOW)
- Community threads on Gemini server deadlines (discuss.ai.google.dev): [60s timeout from python sdk](https://discuss.ai.google.dev/t/60s-timeout-from-python-sdk/83274), [Deadline of 600.0s exceeded](https://discuss.ai.google.dev/t/deadline-of-600-0s-exceeded/102402), [Gateway Timeout issue](https://discuss.ai.google.dev/t/gateway-timeout-issue/106669). No official `X-Server-Timeout` doc found.

### Probe scripts (scratchpad, outside the repo)
- `…/scratchpad/d05_block_probe.py` (MODE unset vs `MODE=thread`), `retry_probe.py`, `drain_probe.py` (`RETRIES=2|0`)

## Metadata

**Confidence breakdown:**
- Client plumbing / SDK behaviour: HIGH (installed source + measured probes)
- D-05 blocking: HIGH (measured, with control)
- D-06 ceiling: MEDIUM (code-cited predicate; the 2400-s kill was not driven live)
- FIX-07 design and test hazards: HIGH (read every touched fence)
- Google server timeout semantics: LOW

**Research date:** 2026-10-15
**Valid until:** 2026-11-14 (SDK minor bumps can move defaults; re-read `_constants.py` if `openai`/`anthropic` upgrade)

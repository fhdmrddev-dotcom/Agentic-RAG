# Phase 282: The Slow Run and the Paused Run - Context

**Gathered:** 2026-10-15 (autonomous: the operator said "continue this phase autonomously end to end, discuss, take best decisions, then plan and execute")
**Status:** Ready for planning

<domain>
## Phase Boundary

**FIX-06:** a model's `llm_call_timeout_seconds` becomes the timeout the provider SDK client is actually built
with, on every provider client family. `max_retries` is chosen on purpose. A value the system cannot honour
is refused in the Model Registry with the reason on screen.

**FIX-07:** one `ask_user` pause shows **one** answer input, in the place sketch 282 chose. There is **one
draft** that every rendering reads. Selection is exposed to assistive technology, and no control lacks a handler.

No new capability, tool, phase type or emitter. The closed core stays at **7 / 1 / 30**. **No migration is
expected** (D-08 explains the one exception and makes it a guard, not a schema change).

</domain>

<decisions>
## Implementation Decisions

### Measured at discuss (scout, HEAD `6f23afe7d`). These facts drive the decisions.

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

### FIX-06: the timeout reaches the client

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

### FIX-07: one input, one draft

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

### Proof, UAT and gates

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

### G-5 audit (roadmap flag list), all "honoured by construction", each a bounded additive diff

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

### Folded / routed

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

### Amendments after research (2026-10-15, autonomous — `282-RESEARCH.md` answered the open measurements)

- **D-19 (ratifies D-03 against its own condition):** **cloud natives + OpenRouter `max_retries=2`, self-hosted (`config._SELF_HOSTED_PROVIDERS`: ollama, lmstudio, custom) `0`, Google explicit no-retry.** The app's own retry (`agent_loop.py:2797`) covers only 502/503/529 + "upstream" messages — NOT 429/500/504/connection errors/timeouts — so the D-03 "cloud → 0 if the app already retries" condition is only met for 502/503/529, which fail fast; stacking there is bounded and accepted. One helper `llm_max_retries_for(provider)` beside `_SELF_HOSTED_PROVIDERS` — no second predicate.
- **D-20 (D-05 resolved — MEASURED):** the eager create **does** freeze the loop (ticker stalled 3.794 s on a 3.0 s header delay; 0.133 s with `asyncio.to_thread`). Fix: `asyncio.to_thread` in the dispatcher's OpenAI-compat/Responses branch (not `run_in_executor` — keeps LangSmith context). **Option A:** one deadline shared by stream-open and drain, implemented inside the helper `_drain_stream_with_close_on_cancel` (~3 lines reading a `budget_deadline`), with a close-on-late-arrival callback so a stream that lands after the guard fired is closed, not leaked. The drain **call sites** (`agent_loop.py:2580/2685`) do not move — the roadmap fence holds; `agent_loop.py` is honoured by construction (helper-internal, no new branch at call sites). BUG-261015-02 is fixed in this phase.
- **D-21 (D-06 resolved):** **3600 cannot be honoured.** The run watchdog (`run_reconciler.py:280-299`) fails a run whose Redis stream is silent for 2400 s (`config.py:1334`), and nothing writes during a silent model call. **Accepted maximum becomes 1800** in `config.py:750` and `admin.ts:601` (the only two copies), a **boot check** beside `_validate_run_stale_sweep_bounds` asserts watchdog > max, and the 422 reason names the watchdog. Live rows: local 11 set, none > 1800 (6 at 900); **production (MCP read 2026-10-15) 4 set, max 1200, none > 1800** — no stored value becomes unreachable. D-08's resolver clamp uses the same bound.
- **D-22 (help-line wording, corrects D-04):** *"Local models and Google models are tried once. Other cloud providers retry quick failures up to 2 times."* Only the `asyncio` per-call timeout gets the "did not answer within N s" sentence, appended after the pinned `timed_out:` prefix (test_066). A connect `APITimeoutError` keeps its existing classification.
- **D-23 (D-03 scope of explicit constants):** explicit timeout/retry constants go into `get_llm_client` and `get_embedding_client` (same file). `vision_text.py` / `multimodal_service.py` direct `OpenAI(...)` constructions are **deferred** (not on the chat/agent path; two more G-5 files).
- **D-24 (FIX-07 test hazard):** the draft store clears whenever an ask leaves `pendingAsksByThread`, the panel-presence registry uses `useLayoutEffect` (no frame paints two inputs), Space on a selected chip is handled in `onKeyDown`, and **one global `afterEach` store reset in `setupTests.ts`** (needs a ledger row).
- **D-25 (ledger):** rows must be added for files the phase touches that the scan list lacks: `google_service.py`, `provider_gateway/anthropic.py`, `provider_gateway/google.py`, `provider_gateway/errors.py` if touched, `stores/askDraftStore.ts` (new), `setupTests.ts`.
- **D-26 (G-4 row 4 prerequisite):** LM Studio on :1234 must be running for the slow-local-model row; one SSE re-attach (610 s consumer deadline) is expected and is NOT a failure.

### Claude's Discretion

- The store's name and file, the presence-registry mechanism (a ref count in the store is fine), and the
  exact pointer copy within D-10's content.
- How `timeout_s` travels on `GatewayRequest`: a new field with a default, so the other constructors do not
  change.
- The connect timeout value within ≤ 10 s.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug reports and seeds
- `.planning/reported-bugs/BUG-260916-01-llm-call-timeout-above-600s-is-silently-ineffective.md`: FIX-06 source and the measured registry rows
- `.planning/reported-bugs/BUG-260918-01-ask-user-renders-two-inputs-that-disagree.md`: FIX-07 source and its ⛔ constraints section
- `.planning/reported-bugs/BUG-260828-07-approval-buttons-absent-in-chat-thread.md`: why the chat-column mount exists
- `.planning/seeds/SEED-172-local-llm-providers-cannot-be-added-through-the-registry.md` §2, §3: the timeout findings
- `.planning/seeds/SEED-289-tools-off-by-default-on-a-guess.md`: the sibling, left open

### Design
- `.planning/sketches/282-one-answer-input/README.md` + `index.html`: **the chosen layout (variant A)**
- `.claude/skills/sketch-findings-agentic-rag/references/pending-question.md`: sketch 006 contract (pointer + panel input, free text always present, answered and expired states)
- `.claude/skills/sketch-findings-agentic-rag/sources/006-pending-question/README.md`

### Code anchors
- `backend/app/services/openai_service.py:1448-1486` (`get_llm_client`, `wrap_openai` at :1474), `:2199` (`create_adaptive_streaming_chat`)
- `backend/app/services/anthropic_service.py:152-169`, `backend/app/services/google_service.py:397-415`
- `backend/app/services/provider_gateway/dispatcher.py:131` (`open_stream`), `openai_compat.py:497-513`, `openai_responses.py:553-561`
- `backend/app/config.py:742-880` (timeout constants and both resolvers), `backend/app/api/admin.py:139,176,228,1428-1497`
- `backend/app/services/agent_loop.py:521-618` (drain under `asyncio.timeout`), `:2536`, `:2604`; `backend/app/services/run_producer.py:864-886`
- `frontend/src/components/panel/PendingAskCard.tsx` (state :291-301, chips :630-654, `PendingAskStack` :729-834)
- `frontend/src/components/chat/MessageList.tsx:277-330` (the unconditional mount and its rationale), `frontend/src/components/panel/WorkspacePanel.tsx:436-440`
- `frontend/src/pages/WorkflowRunPage.tsx:1638` (third, direct card mount)
- `frontend/src/components/admin/ModelRegistryTab.tsx:75-100`, `frontend/src/lib/api/admin.ts:600-601,811-822`

### Rules
- `CLAUDE.md`: UAT scoreboard recipe (8-row roster), G-2/G-4/G-5/G-8, provider-docs-first
- `docs/HOT-FILE-LEDGER.md`: sections for every touched file

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get_per_call_timeout_async` already resolves the per-model budget in 4 tiers. Only its delivery to the client is missing.
- `run_producer.py`'s "timed_out: Ns per-call deadline" message is the hook for D-04's wording.
- `useAskUserPrompt(threadId)` / `pendingAsksByThread` already share **which** asks are pending. Only the draft is per-card.
- `Seam.test.tsx` and the `MessageItem.inlineApproval` 6c fence already pin "no dead button" and "one chat-column mount".

### Established Patterns
- Components subscribe through named hooks from `@/providers/StreamsProvider` (D-068-03). `PendingAskCard` is the documented exception that reads the store directly.
- `?raw` source fences pin line counts (`PendingAskCard.retired.baseline.test.tsx:238` = 837), so any edit updates the pin deliberately.
- Constructor arguments, never `with_options` (LangSmith wrap).

### Integration Points
- `GatewayRequest`: carries the budget into the adapters.
- `PendingAskStack`: the `home` prop, plus the presence registry in the new draft store.

</code_context>

<specifics>
## Specific Ideas

- The pointer reads like the sketch: `● NEEDS YOU · <question, one line> · Draft: <selection or "No answer yet"> · [Answer in panel →]`.
- The timeout failure names the setting and the place to change it, so a slow local model reads as "too slow
  for its timeout", not "the local model doesn't work" (BUG-260916-01 §Why 3).

</specifics>

<deferred>
## Deferred Ideas

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

### Reviewed Todos (not folded)
- "SPIKE — NL→workflow authoring": a keyword-only match, unrelated.

</deferred>

---

*Phase: 282-the-slow-run-and-the-paused-run*
*Context gathered: 2026-10-15*

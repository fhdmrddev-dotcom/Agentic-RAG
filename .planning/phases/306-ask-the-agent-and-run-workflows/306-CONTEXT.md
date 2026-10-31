# Phase 306: Ask the Agent and Run Workflows - Context

**Gathered:** 2026-10-31
**Status:** Ready for planning
**Mode:** `--auto` (operator: "continue", after accepting 305 WR-02 and 304 D-41). Every choice below is the recommended
option; the reasons are inline so a reader can overrule one without re-deriving it.

<domain>
## Phase Boundary

From an MCP client (Claude Code, Cursor), a member can:
- **ask the agent** (`ask_agent`) and get a cited answer with confidence, or a handle that `get_answer` reads later;
- **list, start and follow published workflows** (`list_workflows`, `run_workflow`, `get_workflow_run`).

Both run under admission limits that leave in-app users unaffected. No outside prompt can reach the sandbox, the web or any write.
Requirements: MCP-04, MCP-05, MCP-06, GUARD-01. Builds on 305's server, key edge, per-key limits, audit, spend leg and outbound
guard — none of which is re-decided here.

Not in scope: OAuth (307), webhooks (308), answering a paused run over MCP (never), follow-up turns in an existing thread,
per-call model choice.

</domain>

<decisions>
## Implementation Decisions

### The ask path
- **D-01:** `ask_agent` runs through the **existing run path** (`run_producer`), as the acting member in the key's org, in a **new
  thread per ask**. No second agent loop, and no `httpx` call back into the app's own HTTP API.
- **D-02 (the gap research must close FIRST):** an MCP-origin run gets a **closed allow-list of read-only tools**.
  - Allowed: the knowledge-base read tools (search, list, read; research names the exact registry entries).
  - Denied: everything else, at least `POWER_TOOLS` (`web_search`, `execute_code`, `save_skill`, `attach_skill_file`,
    `remember`, defined at `backend/app/services/describe_draft_guards.py:349`), every connector write, every connector
    tool that reaches outside, and anything that writes.
  - It is an **allow-list, not a deny-list**, so a tool added later is out until someone adds it on purpose.
  - Enforced at the producer seam. ⛔ Never by editing `threads.py`, `agent_loop.py` or `provider_gateway/dispatcher.py`.
    `ThreadScoping` (`run_producer.py:410`) today carries no tool list ("an Expert only ever ADDS").
  - Research decides whether a narrowing field fits there, or which other seam does. `run_producer.py` (14 phases, G-5)
    only if nothing else works, and then as one additive field.
  - **Fail closed:** if the seam cannot be proven to bind, `ask_agent` is not shipped. A run with the full tool set is
    worse than no tool.
- **D-03:** the outside prompt reaches the model only inside the **TRUST-03 untrusted-input envelope** (the 234 anti-injection
  control). It is never spliced into the system prompt.
- **D-04:** **wait budget** is an `app_settings` value `mcp_ask_wait_seconds`, default **30**, bounded **5..55**.
  - The bound stays under the ~60 s at which Claude Code 2.1.312 abandons a tool call (measured in 305,
    `305-VALIDATION.md` §5).
  - The control goes in Settings beside 305's AI-tool limits (everything in the UI except secrets).
  - Past the budget, `ask_agent` returns a handle (the run id plus a plain sentence), and `get_answer(handle)` reads it later.
- **D-05:** **idempotency.**
  - `ask_agent` and `run_workflow` take an optional `idempotency_key`.
  - It is deduped in Redis, keyed on **credential id + idempotency key**, with a 24 h TTL.
  - The same key returns the same run, not a second one. A key reused with a different prompt returns the first run with
    a plain note, never a new run.
  - Redis unavailable: refuse the start (fail closed, the same as admission).
- **D-06:** **needs a person.**
  - An ask whose run reaches an `ask_user` / approval / input pause ends the MCP call with "needs input in the app" and an
    `/app/...` link to the thread.
  - It is never answered over MCP, and `get_answer` keeps returning the same sentence while the run waits.
- **D-07:** **answer shape.**
  - The answer text, citations (document id, title, the 305 `/app/library/<uuid>` link) and confidence, from the existing
    citations / confidence machinery (no new scorer).
  - It goes through 305's result hygiene and the **outbound guard** (redaction when the org switch is on).
- **D-08:** **model and provider** = the member's effective in-app settings at start time. No `model` argument in 306.
- **D-09:** **thread history (MCP-05).**
  - The ask is a normal thread in the member's history, titled the way the app titles threads.
  - It carries Phase 293's thread **origin** field with a new kind for MCP and the key's label, rendered by the **existing**
    origin mark.
  - No new component; extend the vocabulary only.

### Workflows over MCP
- **D-10:** `list_workflows` lists the published workflows the acting member may run in the key's org, **narrowed by the key**.
  A workflow whose folder scope lies outside a narrowed key is not listed, and `run_workflow` refuses it with the same sentence
  as a missing one (305's identical-refusal rule).
- **D-11:** `run_workflow` returns the run id **at once**.
  - It reuses Phase 293's key start path (`workflow_kickoff` / `unattended_launch`, one expression each, G-5).
  - Inputs are validated with 293's labels and sentences.
  - It never blocks until the run ends.
- **D-12:** `get_workflow_run` reads **only runs this credential started**.
  - The starting key id is stamped on the run; research decides where — prefer an existing column or metadata, a
    migration (223) only if none fits.
  - Any other run gets the identical refusal.
  - Its shape comes from the **`key_run_read` pure-move extraction out of `inbound.py`** (`read_inbound_run`). That is the
    **first plan**, proven behaviour-neutral against 293's suites before anything uses it (G-5: `inbound.py` FIRES).
- **D-13:** a paused run reads "waiting on <person>" with an `/app/...` link. There is no tool that answers it.
- **D-14:** `run_workflow` and `ask_agent` are **not read-only** tools. Under maintenance they get 305's maintenance sentence;
  `get_answer`, `get_workflow_run` and `list_workflows` stay readable.
- **D-15:** grants. 305's tool catalogue and per-key tool selection decide whether a key may call each new tool, at both
  `tools/list` and `tools/call`. The existing narrowed-key rules apply unchanged.

### Admission (GUARD-01, folds SEED-081 in part)
- **D-16:** **in-flight admission** in front of **outside starts only** (MCP `ask_agent` / `run_workflow`, `/inbound` starts).
  - Redis counters per **org**, per **credential** and per **provider**, with limits as `app_settings` values and Settings
    controls.
  - When full: an MCP tool error "try again in N s", and on `/inbound` a 429 with `Retry-After`.
  - The in-app path gets **no new check** (no edit to `threads.py`), so it cannot be slowed by construction.
- **D-17:** slots are **leases** with a TTL and are released when the run ends, so a crashed worker cannot leak capacity.
  Redis unavailable: outside starts are refused, and in-app use continues.
- **D-18:** **spend.** Ask and run tokens already flow through the `runs` leg of the one `per_root` CTE. The run carries the key,
  so Admin → Spend shows them by org and key through 305's ledger MCP arm. No second spend query.
- **D-19:** **audit.** Every call writes one row through 305's per-call audit seam (now a single asyncpg INSERT, BUG-261031-04).
  Starts that admission refused use `api_key.refused` with a `admission:<scope>` reason in the shared vocabulary.

### Verification
- **D-20:** the **8-row native roster + OpenRouter** (CLAUDE.md, derived from `MODEL_CAPABILITIES`, newest registry-backed id per
  provider) drives one MCP ask per row that *asks for* a power tool.
  - Each row passes only if its run's audit shows read-only tools only.
  - Blocked rows are recorded ⛔ with the reason (Moonshot's account 429 is known), never dropped.
  - Driven per-request (model and provider on the run), never by changing a global setting.
- **D-21:** **four-axis UAT.**
  - Multi-tool: search + read in one ask.
  - Parallel-thread: an in-app thread streams while an MCP ask runs, and the in-app one is not slowed.
  - Long-message: a ≥ 5 KB MCP prompt.
  - Plus a **concurrency burst** of ≥ 30 outside starts. 305's burst found two bugs the suites missed (BUG-261031-03/-04),
    so a burst is now part of every MCP verification.
- **D-22:** **G-4 rows** (Claude drives them in Chrome and with a real `claude` CLI):
  1. The MCP ask appears in thread history with the MCP mark.
  2. A paused workflow run shows "waiting on <person>" over MCP, and its link opens the run in the app.
  3. An admission refusal reads "try again in N s" while an in-app chat started at the same moment answers normally.
- **D-23:** **G-2:** the UI hint is the existing 293 origin mark plus Settings number controls, both shipped surfaces. No sketch;
  the override is recorded in STATE. Re-open trigger: the operator asks to see one.
- **D-24:** **G-8:** target 4 plans.
  1. `key_run_read` extraction plus the admission core.
  2. The tool-set closure plus `ask_agent` / `get_answer`.
  3. The workflow tools.
  4. Settings, spend and the mark, plus verification.

  All four write the local DB, so they run serially. Split only if the plan checker shows real context pressure.
- **D-25:** **deploy.** 306 ships after the 304+305 deploy. A migration (223) only if D-12 needs one, applied locally first and
  pasted to cloud with per-action approval.

### Revisions after research (2026-10-31, auto) — these SUPERSEDE the decisions they name
- **D-26 (refines D-02):** the closure binds at **two seams reading one ContextVar**, not at the producer.
  - The ask's producer task is spawned in a **fresh** asyncio Context (`create_task(..., context=…)`), never `copy_context()`.
    The ContextVar carries the allow-list and the acting org.
  - **Seam A** (what the model is offered) is the per-run vocabulary builder. `search_documents_tool.py` fires G-5, so its
    vocabulary functions are **pure-moved to a young module first** (with re-exports), then the one narrowing line is added.
  - **Seam B** (refusal at call time) is one first branch in `tool_dispatcher.dispatch_tool`, a no-op when the ContextVar is
    unset.
  - No edit to `threads.py`, `agent_loop.py`, `provider_gateway/dispatcher.py` or `run_producer.py`.
  - ⛔ Never filter inside `get_tools`: it would poison the process-wide `_KNOWN_TOOLS` / `_TOOL_SCHEMA_TOKENS` caches.
- **D-27 (allow-list):** `{search_documents, ls, tree, grep, glob, read_document}`.
  - `get_related_documents` is out (it ignores folder scope).
  - `analyze_document` is out (its LLM sub-call records no tokens, so spend would be wrong).
  - It is a code constant, changed only on purpose.
- **D-28 (research OQ2, the cap-paused Continue hole, T-306-14):** fail closed.
  - Every later run on an MCP-origin thread also gets the allow-list, including a member's Continue in the app.
  - The check is keyed **durably on the thread's origin** (D-31), not only on the ContextVar, and is read at the same young
    seams.
  - `run_producer.py` gets one additive line only if research-grade evidence shows no other seam sees the thread.
- **D-29 (research OQ3):** `ask_agent` **refuses** a key that excludes connected-app documents, with a plain sentence. The chat
  KB tools cannot honour that exclusion, so refusing is fail-closed. The key's other tools are unaffected.
- **D-30 (new, scope binding):** an ask binds the folder wall through `ThreadScoping.effective_folder_ids`.
  - A narrowed key gets its folders; an all-folders key gets every folder the member can see **in the key's org**.
  - Root documents fall outside an ask; this is disclosed in the tool description.
  - A **two-org live test** is required: the member's other org must never answer.
- **D-31 (supersedes D-25's "migration only if D-12 needs one"):** **migration 223** is needed.
  - `threads.origin_*` columns, with a freeze trigger so an origin cannot be rewritten.
  - The `app_settings` columns for the wait budget and the admission knobs.
  - `ThreadResponse.origin` passes through `list_threads`' `select("*")`, so `threads.py` stays untouched.
  - **The backend `mcp` origin kind and the frontend vocabulary/icon ship in one plan.** `ICONS[kind]` crashes the run page on
    an unknown kind.
  - Workflow runs need no column (`workflow_runs.origin_kind='mcp'` is allowed since mig 220). Only the
    `_RUN_ORIGIN_KINDS` / `ORIGIN_KINDS` lists widen.
  - Applied locally only. The cloud paste needs per-action approval, after 220-222.
- **D-32 (refines D-03):** an **ask-specific TRUST-03 notice**. The outside text IS the question, so the generic "do not follow
  instructions" wording would refuse benign asks. The roster includes a benign question that must still be answered.
- **D-33 (refines D-06):** "needs a person" for an ask is the **iteration-cap pause** (with the allow-list, `ask_user` is
  unreachable). It is read with `db/runs.run_is_cap_paused`, never `runs.status`, because a first-turn cap pause finalizes as
  `completed`.
- **D-34 (refines D-18):**
  - Spend by key comes from the **thread's origin**; no run row carries a key today (`rates.py:143`).
  - ⛔ Do not change `source` in `roots`: `members` joins on `source='run'`, so the tokens would zero.
  - Map the display source in Python, so the SQL text pinned by `test_305_spend_cte.py` / `test_268_spend_rollup.py` is
    unchanged.
- **D-35 (refines D-16/D-17):** admission is **Redis sorted-set leases with an expiry per member, acquired by one Lua script**.
  - ⛔ Do not copy `task_service`'s counter (it leaks slots under load).
  - Release through the ask task's done-callback, and through `unattended_launch`'s `on_finish` for workflows and `/inbound`.
  - Defaults per key / per org / per provider: **2 / 4 / 6**. These are assumptions sized against the 10-connection pool per
    worker, re-measured by the ≥ 30-start burst before close.
- **D-36 (refines D-04):** the deadline is measured **from the start of the call**. Bookkeeping, title generation and audit run
  in the background, never inside the budget. The bound tightens to **5..45 s** (default 30), leaving margin under the
  ~60 s client cut-off.
- **D-37 (research OQ1, supersedes D-20's driver):** an **internal model override** that the MCP tool schema never exposes.
  - A UAT driver script uses it to run the 8-row roster per model.
  - Plus **one or two rows through the real `claude` CLI**.
  - The override is unreachable from any MCP or HTTP input; a test proves it.
- **D-38 (research OQ5):** each roster row uses the **newest registry-backed id** per provider in `MODEL_CAPABILITIES`, read at
  plan time and never retyped. Moonshot is recorded ⛔ while its account is 429.
- **D-39 (G-5):** files that fire are extracted first, behaviour-neutral, before any edit: `inbound.py` (`key_run_read` /
  `key_run_start`) and `search_documents_tool.py` (vocabulary functions). Touching `tool_dispatcher.py` answers **SEED-303's**
  dispatch-whitelist part for outside runs only; that seed stays partially-answered with a dated note.

### Claude's Discretion
- Exact tool names beyond the five above, sentences (plain, 293/305 voice), default numbers for the admission limits
  (research measures provider in-flight budgets from the SEED-081 evidence), and the plan split within 4-5.

### Folded Seeds
- **SEED-081** (provider rate-limit resilience / fan-out admission). Folded **in part**: admission in front of outside starts.
  Retry-After backoff on provider 429s and in-app fan-out admission stay open in the seed.
- **SEED-013** (external integrations). The ask/run part of the MCP server lands here; the `/api/v1` REST surface and service
  accounts stay deferred (note written into the seed).

### Reported bugs reviewed
- Open `surface: Agentic-RAG` reports: BUG-260609-02, BUG-260610-01, BUG-260718-03, BUG-260923-01, BUG-261030-02.
  None overlaps 306's area (frontend panel / run-nav / workspace / nav rail / Vercel previews), so none is folded and none
  is re-routed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This milestone
- `.planning/ROADMAP.md` §Phase 306: goal, the 5 success criteria and "How we'd know this failed".
- `.planning/REQUIREMENTS.md`: MCP-04, MCP-05, MCP-06, GUARD-01.
- `.planning/phases/305-connect-claude-code-and-cursor/305-CONTEXT.md`: D-46..D-58 (edge, low-level `Server`, stateless
  transport, identical refusals, audit/limit/spend/redaction seams).
- `.planning/phases/305-connect-claude-code-and-cursor/305-VALIDATION.md` §5: measured client timeouts (the ~60 s limit).
- `.planning/phases/305-connect-claude-code-and-cursor/305-REVIEW.md` and `305-REVIEW-04.md`: fix logs, including late-fixes
  LF-01..08.
- `.planning/reported-bugs/BUG-261031-03-*.md` and `BUG-261031-04-*.md`: the concurrency failures a burst found.
- `.planning/phases/304-personal-mcp-keys-that-act-as-you/304-CONTEXT.md`: the principal, narrowing, liveness and D-41 (no tier
  gate, confirmed).
- `.planning/seeds/SEED-081-provider-rate-limit-resilience-fanout-admission.md`: the admission evidence table.
- `.planning/seeds/SEED-397-per-address-limits-see-the-proxy-not-the-caller.md`: the accepted per-address limit risk.

### Prior art this phase reuses
- `.planning/milestones/v4.7-phases/293-start-from-outside-and-close-out/`: the `/inbound` key start path, the thread origin
  field and its mark, `read_inbound_run`.
- `docs/EXTENSION-CONTRACT.md`: tools are closed engine code; never dynamically registered.
- `CLAUDE.md`: UAT scoreboard recipe (8-row roster), G-4, G-5 (`inbound.py` FIRES), G-8, Supabase MCP write rule, local-DB lock.
- `docs/HOT-FILE-LEDGER.md`: sections for `inbound.py`, `run_producer.py`, `workflow_kickoff.py`, `unattended_launch.py`,
  `mcp/dispatch.py`, `mcp/audit.py`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/mcp/`: server, edge, dispatch (shielded and logged bookkeeping, outbound guard slot), tools and results.
  New tools register here, through 305's catalogue.
- `backend/app/api/inbound.py`: `start_workflow_run` (`:297`), `read_inbound_run` (`:516`), `_limit` (`:268`); the
  `key_run_read` extraction source.
- `backend/app/services/run_producer.py` `ThreadScoping` (`:410`): the producer-side scoping tuple, with no tool list today.
- `backend/app/services/describe_draft_guards.py:349` `POWER_TOOLS`: the existing deny set.
- `backend/app/services/rate_limit.py`: the key buckets, the refusal-audit slot and the fail-closed Redis pattern.
- Phase 293 thread origin: `backend/app/models/thread.py:514-517` (`origin` dict `{kind, label, actor_name}`).

### Established Patterns
- Identical refusal for missing / forbidden / other-org / out-of-scope (305).
- One audit row per call, shielded and logged (305 + BUG-261031-04).
- Fail closed on Redis loss for outside callers; in-app never depends on the new checks.

### Integration Points
- `run_producer` (start), the runs table (status, result, origin, key id), `per_root` spend CTE, Settings AI-tool limits card,
  the 293 origin mark in the thread list.

</code_context>

<specifics>
## Specific Ideas

- A tool call should answer within the wait budget, not stream. 305 measured Claude Code abandoning a silent call at ~60 s,
  so anything longer is a handle plus a poll.
- The concurrency burst (≥ 30 outside starts in parallel, timed) is part of verification, not an extra.

</specifics>

<deferred>
## Deferred Ideas

- Follow-up turns in an existing thread over MCP (`ask_agent(thread_id=…)`): a new capability, so a later phase.
- Per-call model or provider choice for `ask_agent`.
- MCP progress notifications / streaming partial answers.
- Answering a paused run over MCP: rejected by requirement (MCP-06), recorded so it is not re-proposed.
- SEED-081's remaining arms: Retry-After backoff on provider 429s, in-app fan-out admission (`llm_batch_agents`).
- SEED-397: a proxy-aware client address (accepted risk; re-open before a paying org uses MCP).

</deferred>

---

*Phase: 306-ask-the-agent-and-run-workflows*
*Context gathered: 2026-10-31 (auto mode)*

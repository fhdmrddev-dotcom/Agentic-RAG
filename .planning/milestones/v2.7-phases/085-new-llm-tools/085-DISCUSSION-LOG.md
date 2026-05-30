# Phase 085: New LLM Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 085-new-llm-tools
**Areas discussed:** ask_user mechanics, task tool — sub-agent shape, write_todos + REST endpoints, Tool count budget

---

## ask_user mechanics (pause + edges)

### Q1: Where does agent_runner pause?

| Option | Description | Selected |
|--------|-------------|----------|
| Block inside the tool handler | _handle_ask_user awaits Redis pub/sub SUBSCRIBE on ask_user:{run_id}:{tool_call_id}. Handler returns ToolResult containing answer. Simplest — no agent_runner changes. | ✓ (Claude's discretion) |
| Pause the whole agent_runner producer | Detects ask_user, persists state, releases worker. POST endpoint relaunches agent_runner on whatever worker receives it. Survives uvicorn restart but much more complex. | |
| You decide | Pick whichever is more maintainable. | (user chose this; Claude picked Option 1) |

**User's choice:** "You decide" → Claude picked **Block inside the tool handler**.
**Rationale:** Simpler correct shape; cross-worker safety comes from Redis pub/sub itself; producer holds the worker for max 5 min (default) / 30 min (hard cap). Multi-worker capacity from Phase 077 absorbs the slack.

### Q2: Response endpoint URL

| Option | Description | Selected |
|--------|-------------|----------|
| POST /runs/{run_id}/ask_user_response | Body {tool_call_id, response_text, choice_index?}. Run-scoped — matches /runs/{run_id}/stream pattern. | ✓ |
| POST /threads/{thread_id}/ask_user_response | Body includes run_id. Thread-scoped. | |
| You decide | Pick whichever fits existing API style. | |

**User's choice:** **POST /runs/{run_id}/ask_user_response (recommended)**.

### Q3: Default timeout

| Option | Description | Selected |
|--------|-------------|----------|
| 5 minutes | Short enough to free abandoned runs; long enough for thoughtful answers. | ✓ |
| 30 minutes | Conservative; lets the user step away. Risk: zombie runs in Redis longer. | |
| No default — require agent to pass timeout_seconds | Forces LLM to think about urgency. | |
| You decide | Pick a sensible default. | |

**User's choice:** **5 minutes**. Configurable per-call; server clamps to ASK_USER_MAX_TIMEOUT_SECONDS (default 1800s).

### Q4: Stop-while-pending behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel-cleans-up-Redis | Stop publishes sentinel on ask_user:{run_id}:* → handler wakes up, returns 'cancelled' ToolResult → _shielded_finalize closes the run. No leaked SUBSCRIBE clients. | ✓ |
| Let timeout handle it | Stop doesn't touch ask_user channels; SUBSCRIBE sits until timeout. Simpler but worker stays busy. | |
| You decide | Match existing cancellation semantics. | |

**User's choice:** **Cancel-cleans-up-Redis (recommended)**.

### Q5: Reload behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Persist prompt as a messages row | Phase 075.4 system_warning pattern. Survives reload/refresh/tab-close. Response also persists. | ✓ |
| Dedicated ask_user_prompts table | Cleaner schema; panel queries directly. More migrations + code. | |
| Ephemeral SSE only | Prompt only in Redis Stream + Zustand. Reload loses it. | |
| You decide | Match existing reload-survival patterns. | |

**User's choice:** **Persist prompt as a messages row (recommended)**.

### Q6: Parallel ask_users

| Option | Description | Selected |
|--------|-------------|----------|
| Allow parallel, one panel slot per prompt | Each ask_user has unique tool_call_id; panel renders a stack. Matches OpenAI/Google parallel-tool-call streaming. | ✓ |
| Serialize — only one ask_user at a time | Second ask_user returns error 'another pending'. Simpler UX, blocks legitimate parallel patterns. | |
| You decide | Match existing parallel-tool-call story. | |

**User's choice:** **Allow parallel, one panel slot per prompt (recommended)**.

---

## task tool — sub-agent shape

### Q1: Result shape

| Option | Description | Selected |
|--------|-------------|----------|
| Summary only | task() returns the sub-agent's final assistant message. Parent context stays tight. Sub-agent's full transcript visible in own run. | ✓ |
| Full transcript | task() returns sub-agent's complete tool-call trace + final message. Burns context budget. | |
| Both — LLM sees summary, panel shows full | result + llm_content same; sub-agent transcript on its own run_id. analyze_document pattern. | |
| You decide | Match existing analyze_document semantics. | |

**User's choice:** **Summary only (recommended)**.

### Q2: Sub-run stream

| Option | Description | Selected |
|--------|-------------|----------|
| Separate run:{sub_run_id} Stream | Each task creates its own runs row + Redis Stream. Parent emits sub_agent_start{sub_run_id}. Panel drill-down ready. | ✓ |
| Piggyback on parent run:{run_id} Stream | Sub-agent emits to parent's stream with kind='sub_agent_*'. Simpler routing but mixing timelines messy. | |
| You decide | Match existing sub-agent streaming. | |

**User's choice:** **Separate run:{sub_run_id} Stream (recommended)**.

### Q3: agent_config keys exposed to the LLM (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| tools — subset of parent's available tools | LLM picks the toolset; subset enforced server-side. | ✓ (user) |
| max_steps — iteration cap | LLM picks; server clamps to MAX_TASK_STEPS env var. | ✓ (user) |
| system_prompt_override — custom system prompt | LLM passes focused system prompt. Powerful but error-prone. | ✗ (Claude's decision) |
| model_override — cheaper/faster model | LLM picks different model for sub-agent. Same provider only. | ✗ (Claude's decision) |

**User's choice:** "I picked your recommended options but I want you to decide on the rest, we want failure-free behaviour and maximum capability with zero risk and competitive advantage"

**Claude's decisions (per user's framing):**
- `system_prompt_override`: **NO** — replaced with `instructions` arg that gets APPENDED to a server-controlled base system prompt. Keeps prompt-engineering control; matches Claude Code's actual task tool design (competitive shape); zero LLM-authored-prompt risk.
- `model_override`: **NO** — eliminates an entire class of cross-provider failures (D-075.5-04 footgun). Sub-agent inherits parent's active provider + user's configured `sub_agent_model`. v2.8 can revisit.

### Q4: Concurrency caps

| Option | Description | Selected |
|--------|-------------|----------|
| Per-run: 3 / Global: 20 | Per-run cap matches OpenAI parallel-tool-call width; system-wide cap protects multi-user safety. Both env-tunable. | ✓ |
| Per-run: 1 / Global: 10 | Serial sub-agents — simpler reasoning. | |
| Per-run: 5 / Global: 50 | Aggressive parallelism — risks token burn, rate limits, AnyIO ceiling. | |
| You decide | | |

**User's choice:** **Per-run: 3 / Global: 20 (recommended)**.

**Additional decision (Claude):** `task` ↔ `analyze_document` COEXISTENCE — `analyze_document` and `run_sub_agent` stay byte-identical (no shared-code-path mods per `feedback_no_cross_provider_regressions`). `task` lives in a new `task_service.py`. Future deprecation in v2.8+.

---

## write_todos + REST endpoints

### Q1: Update semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Full-state replace | LLM passes entire list every call; server deletes existing + inserts new. Simple invariants. | ✓ |
| Incremental diff (add/update/delete ops) | LLM passes operations. Lower bandwidth but LLMs drift on stateful tracking. | |
| You decide | | |

**User's choice:** **Full-state replace (recommended)**.

### Q2: Status enum

| Option | Description | Selected |
|--------|-------------|----------|
| pending / in_progress / completed (3 states) | Matches Claude Code's task tool. 'cancelled' = deletion in practice. | ✓ |
| pending / in_progress / completed / cancelled (4 states, per PRD) | Adds 'cancelled' for todos the LLM decided not to do. | |
| You decide | | |

**User's choice:** **pending / in_progress / completed (3 states, recommended)**.

### Q3: Nesting

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — parent_id field, panel renders indented children | Matches Claude.ai task tool. Useful for break-down workflows. | (Claude's decision: YES) |
| No — flat list only | Simpler. LLM can use indented descriptions. | |
| You decide | | |

**User's choice:** "You decide" → Claude picked **YES, but optional**. Schema supports parent_id day-1 (no future migration); strong models use it for break-downs; weaker models skip it and produce flat lists. Panel renders indented if present, else flat. Zero risk + competitive parity with Claude.ai.

### Q4: REST endpoints (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| GET /threads/{tid}/todos | Current todo list. Panel reconciles on thread-switch (D-v2.5-03). | ✓ (user) |
| GET /threads/{tid}/ask_user/pending | In-flight ask_user prompts. Panel renders on reload. | ✓ (user) |
| POST /runs/{rid}/ask_user_response | Mandatory — already locked in Area 1. | ✓ (locked) |
| GET /threads/{tid}/tasks | Sub-agent run index for Phase 087 drill-down. Skip if /runs endpoints suffice. | ✓ (Claude's decision) |

**User's choice:** "I picked two options recommended by you but for the rest, I want you to decide, we want accuracy, error-free and zero risk with competitive advantage"

**Claude's decision:** Ship `GET /threads/{tid}/tasks` (the 4th endpoint). Prevents Phase 086/087 from scraping `messages.tool_calls` jsonb (fragile). Cheap to add now; zero-risk + clean Phase 087 drill-down UX.

---

## Tool count budget

### Q1: 24 tools — consolidate or keep separate?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 3 separate tools (recommended for v1) | Each tool has clear purpose. Phase 075.4 validated tool-calling at 21. Treat >20 as a SEED. | ✓ |
| Consolidate workspace tools into one with action= param | Drops total to 20. Multi-action tools are anti-pattern with Anthropic + Google. | |
| Consolidate KB tools into one explore | Drops total by ~4. Risks regressions across v1.0-shipped tested-everywhere tools. | |
| You decide | | |

**User's choice:** **Keep 3 separate tools (recommended for v1)**.

### Q2: Plant SEED for tool count investigation?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — plant SEED with re_open_trigger 'Google tool-selection accuracy on 24-tool toolbox drops below 90% in UAT' | Captures the >20 risk without acting on it now. | ✓ |
| No — don't plant a seed | Cross-provider tool-calling works at 24 today. Report as bug if problem surfaces. | |
| You decide | | |

**User's choice:** **Yes — plant SEED (recommended)**. → SEED-035 planted at `.planning/seeds/SEED-035-tool-count-toolbox-budget.md`.

---

## Claude's Discretion

Decisions taken without user re-asking, per their "you decide" framing:
- ask_user pause mechanism: block inside tool handler (Area 1 Q1)
- task `system_prompt_override`: NO; replaced with `instructions` append-only field
- task `model_override`: NO in v1
- task ↔ analyze_document: COEXIST (no shared-code-path mods)
- write_todos nesting: YES, optional parent_id field (schema supports day-1)
- REST endpoints: ship 4th endpoint `GET /threads/{tid}/tasks`
- task_service.py / todos_service.py / ask_user_service.py as new service files
- Migration numbering — next # after Phase 084's
- Specific tool description wording for the get_tools() schemas — emphasize "use when" / "do not use for"

## Deferred Ideas

(See CONTEXT.md `<deferred>` section for the canonical list.)

- task `system_prompt_override` + `model_override` — v2.8
- Tool count consolidation — SEED-035 planted
- Harness Engine workflows — v2.8 (Theme B deferred)
- Sub-agent panel drill-down UI — Phase 087
- write_todos checkbox-in-panel flips status — v2.8
- ask_user rich UI (markdown prompt, attachments) — v2.8
- BUG-260523-04 (Anthropic 15+ tool iterations) — left deferred (not Phase 085 scope)
- BUG-260528-03 (non-Anthropic generic task descriptions) — left open (frontend, not Phase 085 scope)

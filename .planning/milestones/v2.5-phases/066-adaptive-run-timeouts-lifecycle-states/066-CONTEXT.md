---
phase: 066-adaptive-run-timeouts-lifecycle-states
created: 2026-05-06
parent_gap: Gap-006
parent_uat: .planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-HUMAN-UAT.md
status: Ready for planning
---

# Phase 066: Adaptive Run Timeouts & Lifecycle States — Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Restore parity with v2.4's long-tool-call behavior under the new run-backed
architecture (Phases 061–063.1). Replace the `RUN_HARD_TIMEOUT_SECONDS=120s`
total-deadline that wraps the entire agent loop and silently kills complex
tool-calling agents mid-iteration with a per-LLM-call budget that resets on
every iteration. Split the overloaded `cancelled` terminal state into
`cancelled` (user-initiated Stop) vs `timed_out` (system per-call budget fired)
so the UI can render meaningful banner copy and Resume affordance, and so
audit/billing surfaces can distinguish the two.

Out of scope: adding new agent capabilities, changing `max_iterations`, touching
tool-level timeout discipline (sandbox/web_search/sub-agent), reworking the
Resume button data-flow plumbing (Phase 063.1 already wired `runStatus` through
`getMessages` JOIN — 066 just extends the gating to a 5th status value).

</domain>

## Why this phase exists

User report 2026-05-04 (Gap-006): complex tool-calling prompts ("search for X →
write report → make charts → save as docx") stop mid-iteration with no UI error.
Symptom: LangSmith trace shows `GeneratorExit` at
`langsmith/run_helpers.py:1680`. Root cause verified via Supabase + code:

- `backend/app/config.py:251` — `run_hard_timeout_seconds: int = 120`
- `backend/app/api/threads.py:855` — `async with asyncio.timeout(settings.run_hard_timeout_seconds)` wraps the entire agent_runner body
- Live `runs` table evidence (12-hour window, 24 runs): 5 of 11 cancellations clustered at 120–152s with `error: null` — exact 120s timeout boundary
- Secondary: `runs.error` is `null` on timeout-cancel, UI cannot distinguish "agent timed out" from "user clicked Stop"
- Secondary: `cancelled` status overloaded — user-Stop and timeout share the same terminal state

User direction (2026-05-04 verbatim):

> "this is a RAG system that needs time with complex tasks and we should give
> it time especially if we are using different models, it was working before
> perfectly and complete the complex tasks and executing code but we have to
> restore this according to new updated architecture"

User direction in this discuss-phase session (2026-05-06):

> "implement what claude ai and ChatGPT do but with considerations to our App
> architecture, we should not care about the budget but we care about accuracy,
> performance and failure-free execution"

→ Optimize for completion success, not cost. Match Claude/ChatGPT's no-total-cap
agent-loop pattern with multi-model awareness.

## What "done" looks like

The 7 success criteria in ROADMAP.md for Phase 066, plus a passing live UAT pass
on the Gap-006 prompt:
- Complex multi-tool agent ("search → report → charts → docx") completes end-to-end
- Per-LLM-call timer resets on tool-call boundaries; agent loop has no hard total cap
- `runs.status` has 5 values (`streaming|completed|failed|cancelled|timed_out`)
- `runs.error` populated on every non-completed terminal state
- SSE consumers receive distinct `timed_out` terminal event (separate from `cancelled` and `error`)
- Frontend renders distinct banner: "Agent reached time limit. [Resume]" vs "Response stopped" (cancelled) vs "Error: …" (failed)
- LangSmith trace shows clean termination on timeout — no `GeneratorExit` exception leak
- Live regression: re-run user's failing prompt; observe complete + clean LangSmith trace

<decisions>
## Implementation Decisions

### Timeout architecture (the headline change)

- **D-066-01:** Per-LLM-call budget that resets on each iteration. No overall
  total cap. The structural cap is `max_iterations=15` (General mode) /
  `max_iterations=8` (Explorer mode) — already in place at `threads.py:912,916`.
  Worst-case wall-time is `max_iterations × per-call-budget`. Matches
  Claude/ChatGPT's "never cap the agent loop" UX. Replaces today's
  `async with asyncio.timeout(settings.run_hard_timeout_seconds)` wrapper at
  `backend/app/api/threads.py:855` (delete the wrapper; add the per-call timer
  inside the iteration loop).

- **D-066-02:** Timer scope = LLM stream block only. Wrap the
  `for chunk in stream:` (OpenAI/OpenRouter/Google path at `threads.py:1215`)
  and `for _ant_event in _ant_gen:` (Anthropic native path at `threads.py:1161`)
  in `async with asyncio.timeout(per_call_budget)`. Tool execution (sandbox
  Docker boot, web_search retries, sub-agent LLM call inside `analyze_document`,
  PDF generation in execute_code) is OUTSIDE the timer. Tools keep their own
  timeout discipline (sandbox owns its 60s timeout, Tavily owns its retry
  policy, sub-agent owns its context cap). Failure-mode separation: "agent
  thinking too long" (timed_out) vs "tool stuck" (a tool-specific failure)
  surface distinctly.

- **D-066-03:** Per-model budget via `MODEL_CAPABILITIES` registry
  (`backend/app/config.py:71`). Add a new field
  `llm_call_timeout_seconds: int` to the `ModelCapability` `TypedDict`. Lookup
  in `threads.py` just before each stream block; default for unknown models is
  set in plan-phase (suggested: 180s). Plan-phase locks explicit per-model
  overrides for slow reasoning models we know today — Claude Opus 4.6 with
  extended thinking, o1, Kimi K2.5 reasoning, etc. This aligns with how
  MODEL_CAPABILITIES already shapes per-model behavior (`native_tools`,
  provider, max_tokens caps from Phase 053+ / v2.4 NATIVE_PROVIDERS).

### Lifecycle state split

- **D-066-04:** Add 5th `runs.status` value `timed_out` via a new SQL
  migration that drops + recreates the existing CHECK constraint in a single
  transaction. ROADMAP-aligned shape (no `terminated_by` discriminator
  column). Migration filename: next free number after `037_` (verify in
  plan-phase via `ls supabase/migrations/`). Apply via Supabase SQL editor
  per project rules (CLAUDE.md), then regenerate `full-schema.sql` via
  `bash scripts/regenerate-full-schema.sh`. Pydantic `MessageResponse.run_status`
  Literal extends from 4 → 5 values; frontend `runStatus` type at
  `frontend/src/lib/api.ts:73` and `useMessages.ts` extends to 5.

- **D-066-05:** Backend terminal classification map:
  - `TimeoutError` (per-call timer fired) → `_terminal_status = "timed_out"`,
    `_terminal_error = "timed_out: <Ns> per-call deadline exceeded at iteration <N> (model=<id>)"`
  - `CancelledError` (user DELETE /runs/{id}) → `_terminal_status = "cancelled"`,
    `_terminal_error = "cancelled_by_user"` (extends today's behavior — keep verbatim)
  - `Exception` (real failure) → `_terminal_status = "failed"`,
    `_terminal_error = type(e).__name__` (today's behavior — unchanged)
  - Today's TimeoutError handler at `threads.py:2140-2147` writes
    `status="failed", error="hard_timeout"` — that is the line that flips to
    the new contract. Critical: `runs.py:386, 422` (cancel_run handler) MUST
    continue writing `cancelled` — NEVER write `timed_out` from the user-Stop
    path. The two terminal states are partitioned strictly by source: timer
    fire = system = `timed_out`; DELETE verb = user = `cancelled`.

- **D-066-06:** SSE terminal sentinel adds 5th type `timed_out`:
  - `_RUN_STATUS_TO_TERMINAL_TYPE` map at `threads.py:81-86` gains the row
    `"timed_out": "timed_out"`.
  - `TERMINAL_TYPES` set / discriminator type adds `"timed_out"`.
  - Consumer in `runs.py` already breaks on any terminal sentinel via the
    namespace map — verify in plan-phase that the additional value flows
    through without code change there.
  - Frontend `useMessages.ts:567-570` terminal-event mapping gains a new
    branch BEFORE the cancelled fallback:
    `if (kind === "timed_out") return { ...m, runStatus: "timed_out", stopped: true }`.

- **D-066-07:** `runs.error` format = plain text with prefix discriminator —
  no JSON, no schema change to the column.
  - System timeouts: `timed_out: <Ns> per-call deadline exceeded at iteration <N> (model=<id>)`
  - User cancels: `cancelled: user clicked Stop` (extends today's `cancelled_by_user`;
    a one-liner upgrade in runs.py:423 — keep backward-compatible by also
    accepting the legacy string)
  - Real failures: `failed: <ExceptionClass>: <truncated message ≤200 chars>`
  - `null` is reserved for `completed` and `streaming` (terminal-state
    invariant: every non-completed terminal row has non-null `error`).

- **D-066-08:** Retroactive classification of historical rows: NONE. The new
  CHECK constraint admits 5 values, but historical `cancelled` rows stay as
  `cancelled` (default-safe; assume legacy = user-initiated). The 5
  120s-cluster rows surfaced in Gap-006 evidence stay as `cancelled` with
  `error: null`. The new behavior applies only to runs from the migration's
  apply-day forward. No reclassification SQL.

### Frontend timed_out UX (extends Phase 063 Resume button)

- **D-066-09:** Resume button gating extends from
  `runStatus === 'failed'` (today, `MessageItem.tsx:101`) to
  `runStatus === 'failed' || runStatus === 'timed_out'`. Click handler is
  unchanged — same `onResume?(message)` callback that re-POSTs the original
  prompt with full conversation context (today's `failed` Resume code path).

- **D-066-10:** Distinct banner copy per terminal state — preserves the
  three-way distinction. The currently-rendered `message.stopped &&
  "Response stopped"` text at `MessageItem.tsx:134` becomes a switch on
  `runStatus`:
  - `cancelled` → "Response stopped" (user; today's text, unchanged)
  - `timed_out` → "Agent reached time limit" (NEW)
  - `failed` → "Error: <runs.error truncated>" or existing failed-state copy
  - `completed` → no banner (today)
  Implementation note: the message buffer carries `runStatus` (Phase 063.1
  D-063.1-15 wired this from backend JOIN) and `stopped` boolean — the
  switch keys on `runStatus` first, falls back to `stopped` for legacy rows
  predating the JOIN.

### LangSmith clean termination

- **D-066-11:** When the per-call `asyncio.timeout` fires, the cancellation
  path must close the SDK stream cleanly BEFORE re-raising. Anthropic +
  OpenAI streaming SDKs both expose `stream.close()` (or async equivalent).
  Pattern: wrap the `for chunk in stream:` block in a try / except
  TimeoutError that calls the close method then re-raises. This stops
  LangSmith from recording the cancellation as an unexpected `GeneratorExit`
  at `run_helpers.py:1680`. Plan-phase confirms exact close-method names per
  SDK and writes the integration test (Phase 066-04 in the ROADMAP plan
  skeleton) to assert clean trace output.

### Stopgap (pre-phase)

- **D-066-12:** Stopgap applied IMMEDIATELY (before plan-phase begins):
  set `RUN_HARD_TIMEOUT_SECONDS=600` in `backend/.env` and restart the
  backend. Buys headroom on most tool-calling agents in the meantime. The
  stopgap is REMOVED when 066 lands (the env var becomes obsolete because
  the wrapper is deleted in D-066-01). Plan-phase verifies the stopgap is
  in place before authoring tests so RED-state assertions match the
  observed-failing condition the user is currently dealing with.

### Configuration surface (sketch — plan-phase finalizes)

- New `ModelCapability` field: `llm_call_timeout_seconds: int` (default 180s
  for unknown models — unrelated to the obsolete `run_hard_timeout_seconds`).
- New optional global override env: `LLM_CALL_TIMEOUT_OVERRIDES` syntax
  `model-id=seconds,model-id=seconds` — same shape as existing
  `MODEL_CONTEXT_LIMITS` / `MODEL_OUTPUT_LIMITS` env vars, parsed in
  `config.py` and merged INTO MODEL_CAPABILITIES at startup.
- `RUN_HARD_TIMEOUT_SECONDS` — keep the env-var symbol but DELETE the
  `asyncio.timeout(settings.run_hard_timeout_seconds)` wrapper. Plan-phase
  decides whether to formally remove the setting (and its lifespan/health
  references at `runs.py:70,85,180`) or leave it as a no-op for legacy
  deploys. Lean toward removal — dead code rots.

### Claude's Discretion

- Default `llm_call_timeout_seconds` value for unknown models — plan-phase
  picks based on a quick survey of typical streaming durations across
  providers (suggested 180s).
- Concrete per-model overrides at migration day — plan-phase enumerates the
  current MODEL_CAPABILITIES set + chooses overrides for known-slow models.
- Banner copy exact wording — "Agent reached time limit" vs "Agent took too
  long" vs "Time limit reached" — pick the variant that matches existing UI
  voice (Aether Intelligence design system).
- Whether `MAX_AGENT_ITERATIONS` becomes a config setting (today it's
  hardcoded at 15/8 in `threads.py:912,916`). Defer to plan-phase — out of
  scope unless a runaway-loop guard surfaces during testing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 063.1 artifacts (parent — Gap-006 origin)
- `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-HUMAN-UAT.md` — Gap-006 verbatim user report + root cause + suggested fix paths (THIS phase implements paths 2 + 3).
- `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-CONTEXT.md` — D-063.1-13/14/15 wired `runStatus` through `getMessages` JOIN and Pydantic; 066's frontend changes layer on top.
- `.planning/phases/063-frontend-stream-decoupling/063-CONTEXT.md` — D-063-04 Resume button rendering pattern; 066 extends the gating predicate.

### Phase 061 artifacts (run-backed streaming foundation)
- `.planning/phases/061-run-backed-streaming-backend/061-CONTEXT.md` — D-061-01 (`asyncio.timeout` wrapper at producer body), D-061-09 (4-value status enum), D-061-12 (terminal sentinel namespace). 066 changes D-061-01 (delete wrapper) and extends D-061-09 / D-061-12 (5-value enum + sentinel).

### Project-level locks (still in force)
- `CLAUDE.md` — Stack, RLS rule, migration discipline (apply via SQL editor, regen full-schema.sql, never `db push`/`db reset`).
- `.planning/PROJECT.md` Key Decisions — D-v2.5-01 (`run_in_threadpool` for blocking I/O), D-v2.5-02 (single-worker uvicorn), D-v2.5-08 (Redis Streams architecture), D-v2.5-09 (LLM cost shift mitigations — 066 changes the timeout part of this), D-v2.5-11 (`public.runs` Postgres table).
- `.planning/ROADMAP.md` Phase 066 — 7 success criteria, 5-plan skeleton, risks/pitfalls (per-call boundary infinite-loop concern, multi-model awareness, LangSmith clean termination, stopgap recommendation).

### Code surfaces (the diff lands here)
- `backend/app/config.py:71-115` — `MODEL_CAPABILITIES` registry, `ModelCapability` TypedDict (D-066-03 adds `llm_call_timeout_seconds` field).
- `backend/app/config.py:246-251` — `run_hard_timeout_seconds` setting (D-066-01 deletes the consumer; D-066-12 keeps the env-var symbol pre-phase).
- `backend/app/api/threads.py:81-86` — `_RUN_STATUS_TO_TERMINAL_TYPE` map (D-066-06 adds 5th row).
- `backend/app/api/threads.py:840-855` — `agent_runner` producer task entry; `asyncio.timeout(run_hard_timeout_seconds)` at line 855 is THE line that gets removed (D-066-01).
- `backend/app/api/threads.py:1139-1244` — provider stream blocks (Anthropic native at 1161-1186, OpenAI/OpenRouter/Google at 1215-1244). D-066-02 wraps these `for ... in stream:` blocks in `async with asyncio.timeout(per_call_budget)`.
- `backend/app/api/threads.py:2140-2158` — terminal classification (TimeoutError / CancelledError / Exception). D-066-05 changes the TimeoutError branch (line 2145-2146) from `failed/hard_timeout` to `timed_out/<formatted error>`.
- `backend/app/api/runs.py:386, 422-424` — DELETE cancel_run path. D-066-05 keeps `status="cancelled"` here verbatim — the user-Stop write must NOT switch to `timed_out`.
- `frontend/src/lib/api.ts:73, 90` — Pydantic `run_status` Literal (4 → 5 values).
- `frontend/src/hooks/useMessages.ts:567-570, 798-801` — terminal-event → runStatus map (4 → 5 branches).
- `frontend/src/components/chat/MessageItem.tsx:101, 134` — Resume button gating (D-066-09) and stopped-banner copy (D-066-10).

### Migration / schema
- `supabase/migrations/035_runs_table.sql:25` — current 4-value CHECK constraint to be replaced.
- `supabase/migrations/` — next free number after `037_messages_confidence_columns.sql` for the new CHECK migration. Plan-phase picks the exact number (likely `038_`).
- `supabase/full-schema.sql` — regenerate via `bash scripts/regenerate-full-schema.sh` AFTER applying the new migration via SQL editor.
- `supabase/SETUP.md` — migration-discipline reference.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`MODEL_CAPABILITIES` TypedDict pattern** (`config.py:71`) — The same registry already houses `native_tools`, `provider`, and v2.4 NATIVE_PROVIDERS bypass logic; adding `llm_call_timeout_seconds` is one more field with a `.get(model_id, {...defaults})` lookup. Phase 053 / v2.4 phases established this idiom.
- **`MODEL_CONTEXT_LIMITS` / `MODEL_OUTPUT_LIMITS` env-var parser** (`config.py`) — Comma-separated `model-id=value` syntax for per-model env overrides. D-066-03's `LLM_CALL_TIMEOUT_OVERRIDES` mirrors this verbatim.
- **`_RUN_STATUS_TO_TERMINAL_TYPE` map** (`threads.py:81-86`) — Already partitions namespaces between `runs.status` enum and SSE TERMINAL_TYPES. D-066-06 just adds a 5th row.
- **Phase 061's `_terminal_status` / `_terminal_error` slot pattern** (`threads.py:851-852`) — Already populated by inner-except branches before the shielded finalizer reads them. D-066-05 just changes what the TimeoutError branch writes.
- **`_emit_terminal` helper** (`threads.py:115`) — Exempt-from-MAXLEN sentinel writer used today for done/error/cancelled. D-066-06 reuses verbatim with the new `timed_out` discriminator.
- **Resume button + `onResume` handler** (`MessageItem.tsx:101-112`, useMessages.ts `resumeFromFailed`) — Today gates on `failed`; D-066-09 just extends the predicate.
- **`runStatus`-keyed switches in `useMessages.ts:567-570, 798-801`** — Already a per-terminal-type switch; D-066-06 adds one branch.

### Established Patterns
- **Phase 062 D-062-14 file-layout discipline** — Carved off-limits regions in `threads.py`. The producer body (~line 855) and terminal classification (~line 2140) are the targets here. Plan-phase verifies these are NOT in 062's off-limits regions (they shouldn't be — 062's region is the active-runs route surface).
- **Migration application discipline** (`CLAUDE.md`) — Apply via SQL editor, regen `full-schema.sql` via script, commit both. Never `supabase db push`/`db reset`. Letter suffixes (e.g., `038a`) silently skipped — use plain integer.
- **Test gating contract** — VALIDATION.md / verify gates use TypeScript / pytest. vitest unavailable on this machine (npm optional-dep cascade per Phase 063.1 plans 02-04 deferred-items) — runtime test execution may have to defer to CI / fresh `npm install` env.
- **`stream.close()` pattern not yet used** — Plan-phase researches exact close-method names for Anthropic + OpenAI SDKs. Both are streaming context managers; both should support clean close.

### Integration Points
- **Producer body (`threads.py:854-855`)** — One-line wrapper deletion. Replace the outer `async with asyncio.timeout(...)` with the inner per-call `asyncio.timeout(per_call_budget)` wrappers in each provider stream block.
- **Terminal classification (`threads.py:2140-2158`)** — Three small branch changes (TimeoutError → timed_out, error string format) without touching the shielded finalizer at line 2160-2235.
- **DELETE cancel_run (`runs.py:386, 422`)** — UNCHANGED. Critical to NOT touch — user-Stop stays `cancelled`.
- **Pydantic + frontend type extension** — Single-line Literal extension in two places (one Python, one TypeScript) plus the runStatus map switch in two useMessages.ts locations.
- **Migration ↔ regen full-schema.sql** — One new SQL file + one regen script run + commit both.

### Suggested plan ordering (advisory; gsd-planner finalizes)
1. **066-01 — Backend lifecycle split** (D-066-04, 05, 06, 07, 08): SQL migration with new CHECK; Pydantic Literal extension; backend terminal-classification rewrite; SSE sentinel type addition. Tests: integration test asserting timeout produces `runs.status='timed_out'`, non-null `runs.error`, and SSE consumer receives `timed_out` terminal event.
2. **066-02 — Backend timeout machinery** (D-066-01, 02, 03, 11): MODEL_CAPABILITIES extension; per-LLM-call timer in both provider paths; `stream.close()` on timeout; outer wrapper deletion. Tests: per-call timer fires within ε of budget; tool execution does NOT count against budget; LangSmith trace shows clean termination.
3. **066-03 — Frontend lifecycle UI** (D-066-09, 10): Pydantic Literal mirror in `api.ts`; `useMessages.ts` runStatus-map fifth branch; `MessageItem.tsx` Resume gating extension + banner copy switch. Tests: TypeScript build green; Vitest test (if env permits) for runStatus-map branch coverage.
4. **066-04 — Integration test + LangSmith assertion** (D-066-11): Synthetic slow-LLM mock that deliberately exceeds the per-call budget; assert `status='timed_out'`, `error` non-null with discriminator prefix, no `GeneratorExit` in caplog.
5. **066-05 — Live UAT + manual regression**: Re-run user's Gap-006 prompt end-to-end ("search for research authored by Fahed Mrad → professional short report → charts/diagrams → docx"). Verify completion + clean LangSmith trace. Update HUMAN-UAT.md with regression evidence.

</code_context>

<specifics>
## Specific Ideas

- "Implement what claude ai and ChatGPT do but with considerations to our App
  architecture, we should not care about the budget but we care about accuracy,
  performance and failure-free execution" — 2026-05-06.
- "this is a RAG system that needs time with complex tasks and we should give
  it time especially if we are using different models" — 2026-05-04.
- Banner copy must distinguish three terminal states the way ChatGPT/Claude do
  — user-stop ≠ system-timeout ≠ error. Don't conflate.
- Stopgap (`RUN_HARD_TIMEOUT_SECONDS=600` in `backend/.env`) is applied
  immediately as a pre-phase bandaid, not as the permanent fix. Plan-phase
  begins with this in place and authors RED tests against the proper-fix
  contract (per-call timer, 5-value enum), not the stopgap state.

</specifics>

<deferred>
## Deferred Ideas

- **`terminated_by` discriminator column** — Considered as migration shape;
  rejected in favor of extending `status` CHECK to 5 values. Re-open only if
  a future need arises for >2 termination sources (e.g., admin, rate_limit,
  policy_block) at which point status-enum bloat becomes the lesser evil.
- **`MAX_AGENT_ITERATIONS` as a config setting** — Today hardcoded at 15
  (General) / 8 (Explorer) in `threads.py:912,916`. Out of scope for 066;
  re-open if runaway-loop testing surfaces a need to cap-by-config.
- **Per-tool timeout discipline harmonization** — Currently each tool owns
  its own timeout (sandbox 60s, Tavily retries, sub-agent context cap). 066
  intentionally keeps this distributed (D-066-02 timer is LLM-stream only).
  Re-open as a separate phase if tool-stuck failures become a UX issue.
- **Retroactive reclassification of historical `cancelled` rows** — 5
  120s-cluster rows from Gap-006 evidence stay as `cancelled` (D-066-08).
  Re-open only if audit/billing surfaces need historical accuracy on
  cancelled-vs-timed_out classification.
- **Removing the `RUN_HARD_TIMEOUT_SECONDS` setting entirely** — Plan-phase
  decides keep-as-no-op vs delete. Lean delete (dead code rots), but this
  is a small follow-up call rather than a phase-blocking decision.
- **Stop-reason banner for `failed` (with `runs.error` substring rendering)** —
  D-066-10 sketches "Error: <truncated>" but actual rendering may need design
  attention to fit the Aether Intelligence visual language. Defer to UI-phase
  if the inline string proves cramped or unreadable.

</deferred>

---

*Phase: 066-adaptive-run-timeouts-lifecycle-states*
*Context gathered: 2026-05-06; decisions locked: 2026-05-06*

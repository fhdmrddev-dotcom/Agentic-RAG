# Stack Research

**Domain:** Deterministic / durable / resumable LLM **workflow state-machine runtime** ("Harness Engine") on an existing FastAPI + asyncpg + Redis + Supabase substrate, multi-worker, 6 native LLM providers, no LangChain/LangGraph
**Researched:** 2026-05-30
**Confidence:** HIGH

---

## TL;DR for the planner

**Net new third-party dependencies required: ZERO.**

The v2.8 Harness Engine needs **no new runtime libraries**. Everything the hard parts require is already installed and battle-tested in this codebase:

- **State machine** → hand-rolled, Postgres-backed (`pydantic 2.12.5` for the config/transition models). Do **not** add `transitions` or `python-statemachine`.
- **Phase configs + validator specs** → `pydantic 2.12.5` (already the project's structured-output standard).
- **Durable / resumable phase state** → `asyncpg >= 0.29` + the existing `runs` table + `run:{run_id}` Redis Streams. Do **not** add a durable-execution library.
- **Validation gates** → `jsonschema 4.26.0` (already installed) for `json_schema`; stdlib `re` for `regex_match`; a plain Python registry dict (mirroring `_TOOL_REGISTRY`) for `programmatic`; an asyncpg `SELECT` for `workspace_file_exists`.
- **Immutable-on-publish** → a Postgres `BEFORE UPDATE` trigger (raw SQL migration), no library.

The v2.7 PRD §5 already reached this same conclusion ("New SDK / library deps: none ... harness state machine is implemented directly in Python"). This research **confirms and grounds that call with version evidence and a concrete integration map**, and refines two points the PRD left implicit (see §"Refinements to the v2.7 PRD design").

This is the rare correct case of "no new infra" — not a default-hedge, but the evidence-backed answer, because the four hard problems (cross-worker durability, pause/resume, fair-share concurrency, per-subset tool refusal) were **already solved** in v2.7's `runs`/Redis substrate, `ask_user_service`, `task_service`, and `tool_dispatcher` respectively.

---

## Recommended Stack

### Core Technologies (all ALREADY INSTALLED — verify, don't add)

| Technology | Version (installed) | Purpose in the harness | Why this is the right choice |
|------------|---------------------|------------------------|------------------------------|
| **pydantic** | **2.12.5** (verified in venv) | Typed models for `PhaseConfig`, `ValidatorSpec`, `WorkflowDefinition`, `OnFailure`, the 5 phase-type discriminated union, and structured `programmatic`-phase I/O | Already the project's mandated structured-output tool (CLAUDE.md: "Use Pydantic for structured LLM outputs"). Discriminated unions (`Field(discriminator=...)`) model the 5 phase types cleanly; `model_validate(jsonb)` parses `workflow_definitions.phases` on load; `model_dump(mode="json")` round-trips to jsonb. Zero new dep, zero new mental model. |
| **asyncpg** | **>= 0.29** (project pin) | Persist + read `workflow_runs` / `workflow_phases` rows on the hot path; the per-phase `available_tools` whitelist read; phase-transition writes | This IS the resumability substrate. v2.6 WORKER-LIFT-02 already moved streaming hot paths to the asyncpg pool (`get_pg_pool()`); phase state is the same shape. D-v2.5-01 compliant (no blocking I/O in async handlers). Postgres is the durable, cross-worker source of truth — any worker can resume a run by reading `workflow_phases`. |
| **redis (redis-py asyncio)** | **>= 5.2, < 6** (project pin) | Phase-lifecycle SSE events ride the existing `run:{run_id}` XADD stream; `llm_human_input` pause/resume reuses pub/sub; `llm_batch_agents` global fair-share reuses the Lua atomic counter | Run-backed streaming (D-v2.5-08) means EVERY new harness SSE event (`workflow_phase_start`, `workflow_transition`, gate-check, etc.) rides the SAME stream — no new namespace, no new substrate (PRD §5 "New Redis key patterns: none"). pub/sub + Lua counter already proven in `ask_user_service.py` / `task_service.py`. |
| **jsonschema** | **4.26.0** (verified in venv) | The `json_schema` validator kind — validate a phase's structured output against a declared schema | Already a transitive/used dep (installed in venv; the skills ZIP-import standard and plugin-manifest validation lean on it). Full Draft 2020-12 support. `Draft202012Validator(schema).iter_errors(instance)` gives structured, multi-error feedback that can be fed back into the LLM context on gate failure. |
| **Postgres triggers (raw SQL)** | n/a (DB feature) | Immutable-on-publish enforcement for `workflow_definitions` (block UPDATE once `published_at IS NOT NULL`) | Enforcement at the data layer survives any application bug or direct SQL edit. Mirrors the migration-trigger style already in the repo (`017_skills.sql` ships `skills_set_updated_at`; INSERT-only RLS on `audit_log` / `message_feedback` is the same "lock the row" instinct). No library. |

### Supporting Libraries (stdlib — no install)

| Library | Version | Purpose | When to use |
|---------|---------|---------|-------------|
| **`re`** (stdlib) | stdlib | `regex_match` validator kind | Phase output text must match a declared pattern. Compile once per validator spec; `re.search`. |
| **`difflib`** (stdlib) | stdlib | Already used by `workspace_service` for `delta_from_prev` | If a `programmatic` validator needs structural text comparison. No new use required by the harness core. |
| **`enum` / `typing.Literal`** (stdlib) | stdlib | Phase-type tag, status enums, `on_failure` action tag | Back the pydantic discriminated union and the status columns. |
| **`uuid`, `json`, `asyncio`** (stdlib) | stdlib | Run IDs, jsonb (de)serialization, the phase-execution loop | Same primitives the agent loop and `task_service` already use. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pytest + AsyncMock** (already in dev deps) | Unit-test phase executors, validators, the transition engine, and the dispatcher per-phase refusal | Follow `feedback_mock_completeness` — mock ALL network deps; set MagicMock attrs explicitly. The transition engine and validators are PURE functions → trivially unit-testable without a live DB (the v2.7 PRD's HARNESS-GATE-01 / HARNESS-ENFORCE-01 are integration-test shaped, but the core logic should have pure-function unit coverage first). |
| **Playwright E2E** (v2.6 075.4 backstop) | HARNESS-RUN-01 "kill uvicorn, restart, resume" durability test | The resumability claim is the load-bearing one; it needs a real cross-process test, not a mock. |
| **`scripts/eval_cross_provider.py`** (SEED-034, folded into v2.8) | Regression gate that the per-phase tool whitelist + budget guard don't break any of the 6 native providers | The harness adds a tool-refusal path on the shared dispatch route — this is exactly the "shared-path edit that cascades cross-provider" risk the 075.x history warns about. The eval harness is the guardrail. |

## Installation

```bash
# NOTHING TO INSTALL. All required libraries are already present:
#   pydantic   2.12.5   (verified)
#   jsonschema 4.26.0   (verified)
#   asyncpg    >=0.29   (project pin)
#   redis      >=5.2,<6 (project pin)
#
# The harness engine is new application code under:
#   backend/app/services/harness/        (new package — engine, phase executors, validators)
#   backend/app/models/harness.py        (new pydantic models)
#   supabase/migrations/056..NNN_*.sql   (new tables + immutable trigger)
#
# If you want jsonschema pinned explicitly in requirements.txt (it is currently
# only transitively present), add ONE line — this is a pin, not a new dep:
echo "jsonschema>=4.26,<5" >> backend/requirements.txt
```

---

## The five sub-questions, answered concretely

### (a) State machine: hand-rolled vs a light library — **HAND-ROLLED wins, decisively**

**Recommendation: hand-rolled, Postgres-persisted, no library.**

The harness is a **linear, ordered, locked** phase list (PRD Theme B: "the LLM cannot skip phases, reorder them, or terminate early"). The only transitions are: `pending → active → gate_validating → (completed | failed | skipped)`, plus `on_failure` routing (`fail_run` / `retry` / `skip_to_phase:<slug>`). This is **not** a rich statechart — it is a cursor (`workflow_runs.current_phase_id` / `workflow_phases.phase_index`) advancing through an array, with a validator gate at each boundary. The transition logic is ~50–100 lines of pure Python.

**Why the two candidate libraries are a poor fit (despite being good libraries):**

| Library | Latest version | Why it does NOT earn its keep here |
|---------|----------------|------------------------------------|
| **`python-statemachine`** (fgmacedo) | **3.1.2** (2026-05-19) | Models states/transitions **in the Python class definition** (declarative, in-memory). The harness's authoritative state lives in **Postgres** (`workflow_phases`) so it survives uvicorn restart and is cross-worker — the library's in-memory machine would have to be **reconstructed from DB rows on every resume**, which means you write the persistence/rehydration layer ANYWAY and the library becomes decorative. Its 2026 strengths (mermaid/dot/rst rendering, statecharts with parallel regions, history) solve problems the harness does not have. Adds a dependency to manage for negative value. |
| **`transitions`** (pytransitions) | **0.9.x** (0.9.2/0.9.3) | Same core mismatch: it's an **in-memory, object-bound** FSM. It has a `MachinePersistence`/pickle story and a `markup` extension, but persisting a workflow run means serializing the machine, which is strictly worse than the explicit Postgres rows the PRD already designs (queryable, RLS-able, resumable by ANY worker, auditable via `harness_audit`). The "diagram backend" value is irrelevant to a backend runtime. |

**The disqualifier both libraries share:** they keep the source of truth **in process memory**. The harness's hard requirement is **durable, cross-worker, resumable** state. The moment the source of truth must be Postgres rows (it must — HARNESS-RUN-01: "kill uvicorn, restart, resume; assert no state loss"), an in-memory FSM library is a second, redundant representation you have to keep in sync with the DB. That's strictly more code and a new drift-bug surface, for a state graph this codebase can express in a `match` statement.

**The hand-rolled shape (grounded in the real substrate):**
- A pydantic `WorkflowDefinition.phases: list[PhaseConfig]` is the immutable program.
- `workflow_runs.current_phase_id` + `workflow_phases` rows are the durable program counter + per-phase state.
- A `HarnessEngine.advance(run_id)` async function: read current phase → execute by type → run validators → on pass write next phase row + emit `workflow_transition` → on fail apply `on_failure`. Pure transition decision, isolated and unit-testable.
- This mirrors a pattern the codebase ALREADY runs: `task_service.run_task_sub_agent` is effectively a bounded, hand-rolled step loop (`for step in range(max_steps)`) with explicit DB row lifecycle (`insert_run` → loop → `finalize_run`). The harness phase executor for `llm_agent` is a near-clone of this loop with the `available_tools` whitelist applied.

Confidence: **HIGH** (grounded in PRD §5 + real `task_service.py` precedent + the durability requirement).

### (b) Pydantic models for phase configs + validator specs — **pydantic 2.12.5, discriminated unions**

Model `workflow_definitions.phases` jsonb as a typed tree. Recommended shape (refining PRD Theme B's phase-config sub-bullet):

```python
# backend/app/models/harness.py  (illustrative — exact text load-bearing for the union tag)
from typing import Literal, Annotated, Union
from pydantic import BaseModel, Field

class ValidatorSpec(BaseModel):
    kind: Literal["json_schema", "regex_match", "workspace_file_exists", "programmatic"]
    config: dict  # shape depends on kind; validated by the validator registry at run time

class BasePhase(BaseModel):
    slug: str
    available_tools: list[str] = []          # canonical whitelist the dispatcher reads
    validators: list[ValidatorSpec] = []
    gate_blocking: bool = True
    on_failure: Literal["fail_run", "retry"] | str = "fail_run"  # or "skip_to_phase:<slug>"
    max_steps: int = 5
    max_duration_seconds: int | None = None

class ProgrammaticPhase(BasePhase):  phase_type: Literal["programmatic"]; fn_name: str
class LlmSinglePhase(BasePhase):     phase_type: Literal["llm_single"];  prompt_template: str; model_override: str | None = None
class LlmAgentPhase(BasePhase):      phase_type: Literal["llm_agent"];   prompt_template: str; model_override: str | None = None
class LlmBatchAgentsPhase(BasePhase):phase_type: Literal["llm_batch_agents"]; prompt_template: str; merge_strategy: Literal["concat","dedupe","vote"]="concat"; max_parallel_agents: int = 5
class LlmHumanInputPhase(BasePhase): phase_type: Literal["llm_human_input"]; prompt: str; options: list[str] | None = None

PhaseConfig = Annotated[
    Union[ProgrammaticPhase, LlmSinglePhase, LlmAgentPhase, LlmBatchAgentsPhase, LlmHumanInputPhase],
    Field(discriminator="phase_type"),
]
```

**Why pydantic discriminated union:** one `model_validate` over the jsonb gives a fully typed phase with per-type required fields enforced (e.g. `merge_strategy` only on batch phases). The validator config stays a `dict` at the model layer and is validated **by the validator registry at execution time** against the kind — keeps the model decoupled from validator internals, exactly like `tool_dispatcher` keeps tool args as `dict` and lets each `_handle_*` validate. `programmatic`-phase function I/O can ALSO be pydantic models for the in-process registry contract.

Integration cost: **low** — one new `models/harness.py`, parsed once when a `workflow_runs` row is instantiated from its `workflow_definition`.

Confidence: **HIGH**.

### (c) Durable / resumable phase state — **hand-rolled on the EXISTING asyncpg + runs/Redis substrate is correct**

**Recommendation: persist phase state to Postgres (`workflow_phases`), stream via the existing `run:{run_id}` Redis Stream. Do NOT add a durable-execution library.**

The question "does a lightweight durable-execution lib earn its keep?" — **No**, and the reason is structural: a durable-execution library (Temporal SDK, restate, DBOS, `durabletask`, etc.) earns its keep when you need **automatic checkpointing of arbitrary in-process control flow** (replaying a Python function deterministically after a crash). The harness does NOT need that. Its unit of durability is the **phase boundary**, which is **coarse, explicit, and already a DB row**. After each phase completes you UPSERT a `workflow_phases` row and advance `current_phase_id`; on restart you read those rows and continue from the next `pending` phase. That is durable execution at exactly the granularity the product needs, with zero magic.

What the existing substrate already gives you, for free:
- **Cross-worker durability**: `workflow_phases` in Postgres + the `runs` row pattern (`insert_run`/`finalize_run` in `db/runs.py`) means any of the N uvicorn workers can resume (D-PRD-08 multi-worker readiness, already lifted in v2.6).
- **Survive uvicorn restart**: state is in Postgres, not memory — the HARNESS-RUN-01 requirement is satisfied by the persistence design itself.
- **Streaming + replay**: `run:{run_id}` XADD + `GET /runs/{id}/stream?since=N` replay-and-tail already exists; harness phase events ride it unchanged (PRD §5: "ALL new SSE event types ride this SAME stream").
- **Pause/resume for human input**: `ask_user_service.py` pub/sub (SUBSCRIBE-first ordering, cross-worker cancel/shutdown sentinels) is **reusable verbatim** for `llm_human_input` — the PRD already notes the `llm_human_input` phase emits `ask_user_prompt` and resumes on response. This is the single trickiest piece of any durable workflow engine (durable timers / external-event wait), and it is **already built and hardened** in this repo.

A durable-execution server (Temporal/restate) would, in addition to being explicitly out of scope, **duplicate** the runs-table + Redis-stream substrate this codebase already operates, add a new always-on process to the deployment, and fight the "stateless chat completions, no provider-side thread state" discipline. The hand-rolled-on-Postgres approach is not a compromise here — it is the architecturally cleaner fit because the durability boundary is coarse and explicit.

One refinement worth flagging to the planner (see Refinements): the PRD's §6 mitigation "phase row UPSERT first; SSE emit second; consumer tolerates brief lag" is the right ordering, and it means the **DB write is the commit point, the SSE event is a best-effort hint** — consistent with D-v2.5-03 (Realtime is a hint, reconcile via fetch). Resume logic must read Postgres, never trust the stream tail.

Confidence: **HIGH** (every claim grounds to a real file: `task_service.py`, `ask_user_service.py`, `db/runs.py`, the `run:{run_id}` stream).

### (d) Validation-gate building blocks — **jsonschema 4.26.0 + stdlib `re` + a Python validator registry**

| Validator kind | Building block | Version | Integration |
|----------------|----------------|---------|-------------|
| `json_schema` | **`jsonschema`** | **4.26.0** (installed) | `Draft202012Validator(spec.config["schema"])`. Cache the compiled validator per (definition, phase) — definitions are immutable-on-publish so the compiled validator can be memoized for the life of the process. `list(validator.iter_errors(output))` yields structured errors → feed the messages back to the LLM on gate failure (self-correction), exactly as the dispatcher feeds `tool_not_available_in_phase` back. |
| `regex_match` | **`re`** (stdlib) | stdlib | `re.compile(spec.config["pattern"])` once per spec; `.search(output_text)`. |
| `workspace_file_exists` | **asyncpg SELECT** | n/a | `SELECT 1 FROM workspace_files WHERE thread_id=$1 AND path=$2`. Reuses the v2.7 `workspace_service` surface; no new code beyond one query. |
| `programmatic` | **plain dict registry** | n/a | `VALIDATOR_REGISTRY: dict[str, Callable[[dict, ctx], ValidatorResult]]` — a **direct clone of `_TOOL_REGISTRY`** (`tool_dispatcher.py:1465`) and the planned `PROGRAMMATIC_PHASE_REGISTRY`. Custom Python validators register here at import. Same proven registry-dispatch pattern the whole tool layer uses. |

**Why `jsonschema` (4.26.0) and not `fastjsonschema`:** `fastjsonschema` is ~100× faster (codegen) BUT (1) validators run **once per phase boundary** — a handful of times per workflow run, never in a tight loop — so the perf delta is irrelevant here; (2) `jsonschema` is ALREADY installed and used; adding `fastjsonschema` is a new dep for zero practical gain; (3) `jsonschema.iter_errors` gives rich, multi-error, path-annotated feedback that is genuinely better for LLM self-correction than fastjsonschema's first-error-raises model. Choose the clarity-and-already-present option.

Validator return contract: define a tiny pydantic `ValidatorResult(passed: bool, errors: list[str])` so all four kinds return the same shape the gate logic and `workflow_phase_gate_check` SSE event consume uniformly.

Integration cost: **low**. The whole validator layer is one module (`harness/validators.py`) + a registry dict.

Confidence: **HIGH**.

### (e) Immutable-on-publish enforcement — **Postgres `BEFORE UPDATE` trigger (raw SQL migration)**

**Recommendation: a DB trigger, in the `127_workflow_definitions.sql`-equivalent migration (renumbered to the real 056+ head).**

```sql
-- illustrative; exact predicate is load-bearing
CREATE OR REPLACE FUNCTION block_published_workflow_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'workflow_definitions row is immutable after publish (slug=%, version=%); create a new semver',
      OLD.slug, OLD.version;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_definitions_immutable_on_publish
  BEFORE UPDATE ON workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION block_published_workflow_update();
```

**Why a trigger, not application code:** enforcement at the data layer is unbypassable — it survives application bugs, a second service, or a direct SQL edit in the Supabase studio. This is the same defense-in-depth instinct already in the repo: `017_skills.sql` ships a `skills_set_updated_at` trigger; `audit_log` and `message_feedback` are INSERT-only via RLS. The PRD references a "`skill_versions` immutable trigger" as the mirror; **NOTE for the planner: no `skill_versions` table/trigger actually exists in the migrations yet** (grep of `supabase/migrations/` finds the *concept* of immutability only in RLS/trigger patterns, not a literal `skill_versions` immutable trigger). So the harness should ship this trigger fresh, modeled on the **pattern** (D-PRD-13 semver + immutable-on-publish), not by copying a non-existent artifact. The UNIQUE `(slug, version)` constraint + this trigger together deliver "edit requires a new semver" (HARNESS-DEF-01).

Apply per CLAUDE.md migration rule: paste into Supabase SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh`.

Confidence: **HIGH** (grounded in the actual trigger style in `017_skills.sql` + the migration-head reality at 055).

---

## Refinements to the v2.7 PRD §3 Theme B design (where evidence suggests improvement)

The PRD §3/§5 harness design is **fundamentally sound** and this research endorses it: jsonb phase configs, the 5 phase types, validator kinds, the dispatcher whitelist enforcement, Postgres phase persistence, run-backed SSE, and the immutable trigger are all the right calls. Two evidence-based refinements:

1. **The per-phase whitelist enforcement belongs IN the dispatcher, gated by `ToolContext.available_tools` — not a new pre-check in `threads.py`.** The PRD §6 row 1 proposes adding a pre-check at `threads.py:1059`. But `tool_dispatcher.ToolContext` **already carries `available_tools: list[str]`** and `_handle_task` **already enforces a subset-refusal precedent** (lines 1090-1116: "tools not available to sub-agent ... must be subset"). The cleanest integration is: when a workflow is active, agent_runner populates `tool_ctx.available_tools` from `workflow_phases.available_tools` (instead of the full `get_tools()` list it currently builds at `threads.py:2656-2659`), and `dispatch_tool` gains a 3-line guard at the top: `if ctx.available_tools and tool_name not in ctx.available_tools: return ToolResult(result="tool_not_available_in_phase: ...")`. This puts enforcement on the ALREADY-SHARED dispatch route, reuses the existing field, and keeps `threads.py` from growing another special-case branch (G-5 hygiene — `threads.py` is already flagged for extraction). It also means sub-agent and harness whitelisting use ONE mechanism. **This is the single most important integration recommendation.**

2. **Whitelist read must be cached per-run, refreshed on transition (PRD §6 already says this — make it a hard requirement, not a "mitigation").** The whitelist is consulted on EVERY tool call; a Postgres round-trip per tool call is unacceptable latency. Since the phase only changes at a backend-driven transition, cache `available_tools` in the in-memory `ToolContext` for the life of a phase and refresh it when the engine advances. The cache lifetime is the phase, the invalidation event is `workflow_transition`. (Same discipline as the settings 5s TTL cache pattern already in the repo.)

3. **`llm_human_input` should reuse `ask_user_service` channel naming verbatim, but the harness — not the LLM — owns the pause.** In Deep Mode the LLM calls `ask_user()` as a tool. In a `llm_human_input` phase the **engine** emits the prompt and blocks on the same pub/sub channel (`ask_user:{run_id}:{...}`). The existing `subscribe_for_response` helper in `ask_user_service.py` is the reuse point (it's already factored out for "tests + cancel + shutdown paths"). No new pause primitive.

---

## Alternatives Considered

| Recommended | Alternative | When the alternative would be right (it is NOT, here) |
|-------------|-------------|------------------------------------------------------|
| Hand-rolled Postgres state machine | **`python-statemachine` 3.1.2** | If state lived in-process and you needed rich statecharts (parallel regions, history states, diagram export) AND did not need cross-worker DB-resumable runs. The harness needs the opposite of all three. |
| Hand-rolled Postgres state machine | **`transitions` 0.9.x** | If you wanted a quick in-memory FSM for a single-process tool with optional pickle persistence. Loses to explicit DB rows the moment durability + multi-worker + RLS + audit are requirements. |
| asyncpg + runs/Redis durability | **Temporal / restate / DBOS / `durabletask`** | If you needed automatic replay of arbitrary in-process control flow across crashes at sub-step granularity, OR cross-service orchestration. The harness's durability boundary is the **phase** (coarse, explicit, already a row) — auto-replay machinery is overkill and duplicates the existing runs/stream substrate. Also explicitly out of scope (no new server/broker). |
| `jsonschema` 4.26.0 | **`fastjsonschema`** | If you validated thousands of payloads/sec in a hot loop. Validators run a few times per workflow run — perf is a non-issue; `iter_errors` clarity + already-installed win. |
| Postgres `BEFORE UPDATE` trigger | Application-layer immutability check | Never preferable for a hard invariant — app checks are bypassable by a second writer or direct SQL. |
| Plain dict `VALIDATOR_REGISTRY` / `PROGRAMMATIC_PHASE_REGISTRY` | A plugin/entry-point registration framework | The v2.7 plugin contract (which WOULD generalize these registries) is **deferred to v2.9**. For v2.8, the plain dict mirroring `_TOOL_REGISTRY` is exactly right and forward-compatible. |

---

## What NOT to Use

| Avoid | Why (specific) | Use instead |
|-------|----------------|-------------|
| **LangGraph** | Hard project rule (CLAUDE.md: "No LangChain, no LangGraph — raw SDK calls only"). It would metastasize across the agent loop once introduced, and it owns the control flow the harness must own deterministically. | Hand-rolled engine over the existing agent loop / `task_service` loop pattern. |
| **LangChain** | Same rule. The 6-provider routing is already handled at the service boundary; LangChain's abstractions would fight the proven per-provider adapters. | Existing `MODEL_CAPABILITIES` registry + native SDK calls. |
| **Temporal server / SDK** | Adds an always-on orchestration server + worker process to the deployment; duplicates the `runs` table + `run:{run_id}` stream durability already operating; fights "no provider-side thread state". Out of scope by milestone constraint. | `workflow_phases` Postgres rows + asyncpg + the existing run-backed streaming. |
| **Celery (+ broker)** | A task queue solves a problem the harness doesn't have (distributed background job dispatch). Workflow phases run **inside the existing `agent_runner` producer task** (PRD §5: "New background processes: none"). Adding Celery means a new broker, new worker pool, new failure modes. | The existing producer-task model + Redis as the (already-present) coordination layer. |
| **A new message broker (RabbitMQ/Kafka/NATS)** | Redis Streams + pub/sub already cover event buffering, replay-and-tail, and cross-worker pause/resume. A second broker is pure operational tax. | Existing Redis (`run:{run_id}` streams, `ask_user:*` pub/sub, `tasks:global:active` Lua counter). |
| **`fastjsonschema`** | New dep for ~0 practical benefit (validators are not hot); worse error ergonomics for LLM self-correction. | Already-installed `jsonschema` 4.26.0. |
| **`python-statemachine` / `transitions`** | In-memory source of truth conflicts with the durable/cross-worker/resumable requirement; their headline features (diagrams, statecharts) are irrelevant to a backend runtime. | Hand-rolled cursor over `workflow_phases` rows. |
| **A separate scheduler process / cron** | Time-based triggers are v3.4 Automations scope; v2.8 workflows are user/skill-initiated and run in-band. | Nothing — out of scope; don't pre-build it. |
| **SQLAlchemy / an ORM / Alembic** | The codebase uses asyncpg directly + numbered SQL migrations applied via Supabase SQL editor (CLAUDE.md). Introducing an ORM/migration tool now is a foreign pattern and a migration-tooling fork. | Raw asyncpg + numbered `supabase/migrations/056+_*.sql`. |

---

## Stack Patterns by Variant

**If the phase is `programmatic`:**
- Pure Python from `PROGRAMMATIC_PHASE_REGISTRY[fn_name]`, no LLM call, typed pydantic I/O.
- Because: deterministic transforms (schema validation, format conversion) must not burn tokens or vary.

**If the phase is `llm_agent` / `llm_batch_agents`:**
- Reuse the `task_service.run_task_sub_agent` loop shape (bounded `for step in range(max_steps)`, own `runs` row + stream), with `available_tools` set from the phase whitelist; `llm_batch_agents` fans out via the existing `task` tool + the `tasks:global:active` Lua fair-share counter (SEED-036a fold).
- Because: the sub-agent loop is already the proven, concurrency-capped, cross-provider-safe execution primitive — the harness should clone it, not reinvent it.

**If the phase is `llm_human_input`:**
- Engine emits `ask_user_prompt` + blocks on `ask_user_service.subscribe_for_response`; resumes the run on POST.
- Because: pause/resume across workers/restarts is already hardened in `ask_user_service.py`.

**If a gate fails and `on_failure == "retry"`:**
- Re-run the same phase up to a retry cap; feed the validator `iter_errors` back into the phase prompt for `llm_*` phases (self-correction).
- Because: structured validator feedback is the cheap path to a passing gate without human intervention.

---

## Version Compatibility

| Package | Compatible with | Notes |
|---------|-----------------|-------|
| pydantic 2.12.5 | FastAPI 0.115.6, pydantic-settings 2.7.0 | Already the project baseline; discriminated unions are stable since pydantic 2.x. |
| jsonschema 4.26.0 | Python 3.12 (project runtime) | Full Draft 2020-12; `Draft202012Validator` is the explicit validator class. Optional explicit pin `>=4.26,<5`. |
| asyncpg >= 0.29 | Postgres 15+ (Supabase) | Hot-path pool already in production since v2.6 WORKER-LIFT-02. |
| redis-py >= 5.2,<6 | Redis 7 (docker-compose.dev / Upstash) | Streams + pub/sub + Lua eval all in use today. |
| Postgres triggers | Supabase Postgres | Apply via SQL editor per CLAUDE.md; regenerate `full-schema.sql` after. |

---

## Sources

- **Live codebase (HIGH — primary evidence):**
  - `backend/app/services/tool_dispatcher.py` — `_TOOL_REGISTRY` dict + `dispatch_tool()` entry; `ToolContext.available_tools` field; `_handle_task` subset-refusal precedent (lines 88, 1090-1116, 1465-1500).
  - `backend/app/services/task_service.py` — bounded sub-agent loop, own `runs` row + `run:{sub_run_id}` stream, per-run `asyncio.Semaphore` + Redis Lua global cap (lines 58-91, 196-436).
  - `backend/app/services/ask_user_service.py` — pub/sub pause/resume, SUBSCRIBE-first ordering, cancel/shutdown sentinels (whole file).
  - `backend/app/services/openai_service.py:768-784` — `get_tools()` registration site for the tool-count budget + per-phase whitelist wrap.
  - `backend/app/api/threads.py:2632-2677` — agent_runner `ToolContext` construction + single `dispatch_tool()` call site (the integration point).
  - `supabase/migrations/` — head at **055** (`055_todos_table.sql`); trigger style in `017_skills.sql` (`skills_set_updated_at`); INSERT-only RLS in `audit_log`/`message_feedback`. **No `skill_versions` immutable trigger exists** (PRD reference is to the pattern, not an artifact).
  - venv verification: `pydantic 2.12.5`, `jsonschema 4.26.0` installed; `asyncpg>=0.29`, `redis>=5.2,<6`, `sse-starlette==2.4.1` in `requirements.txt`.
- **`.planning/PRDs/v2.7.md` §3 Theme B + §5 + §6 + §10/§11 (HIGH — design source):** the harness table design, phase-config shape, "New SDK/library deps: none", LangGraph/YAML/Temporal rejections, §6 dispatcher-whitelist + caching mitigation. Endorsed with the 3 refinements above.
- **`.planning/PROJECT.md` (HIGH):** v2.8 milestone scope (plugins deferred to v2.9), migration head 056+, G-5 threads.py extraction first, 6 native providers, multi-worker discipline.
- **`CLAUDE.md` (HIGH — binding constraints):** no LangChain/LangGraph; Pydantic for structured output; RLS on all tables; `run_in_threadpool`/asyncpg for blocking I/O; migrations via SQL editor.
- **Web (MEDIUM — version verification, 2026-05-30):**
  - [python-statemachine · PyPI](https://pypi.org/project/python-statemachine/) — latest **3.1.2** (2026-05-19); in-class declarative FSM/statecharts.
  - [transitions · PyPI](https://pypi.org/project/transitions/) / [pytransitions GitHub](https://github.com/pytransitions/transitions) — latest **0.9.x**; in-memory object-bound FSM.
  - [jsonschema · PyPI](https://pypi.org/project/jsonschema/) — **4.26.0** (2026-01-07), full Draft 2020-12.
  - [fastjsonschema docs](https://horejsek.github.io/python-fastjsonschema/) — ~100× faster via codegen; first-error-raises model (rejected: not hot-path, worse LLM feedback).

---
*Stack research for: deterministic/durable/resumable LLM workflow state-machine runtime (v2.8 Harness Engine), no LangChain/LangGraph/Temporal/Celery*
*Researched: 2026-05-30*

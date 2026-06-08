# Phase 089: Agent-Loop Extraction (G-5) + Kickoff UAT - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 2 (1 new module skeleton + 1 modify-in-place)
**Analogs found:** 2 / 2

> **Scope note:** This is a *behavior-preserving verbatim extraction*, not net-new feature code. RESEARCH.md owns the extraction seam, the closure-capture inventory, and the `run_agent_loop` signature — this doc does NOT re-derive any of that. PATTERNS.md is narrow on purpose: it answers ONLY "what house style should the new `agent_loop.py` *skeleton* copy?" (module header, dataclass convention) and "what existing structure does the one modified file mirror?". The BODY of `agent_loop.py` is lifted verbatim per RESEARCH — no pattern needed for moved code.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/agent_loop.py` (NEW skeleton) | service | event-driven (LLM round-trip + SSE emit) | `backend/app/services/tool_dispatcher.py` | exact (same provenance: G-5 extraction out of `threads.py`; same loop neighborhood; calls into it) |
| `RunContext` / `AgentLoopResult` dataclasses (in `agent_loop.py`) | model (context object) | — | `ToolContext` / `ToolResult` in `tool_dispatcher.py` (L59-101) | exact (sibling context-objects for the same loop) |
| `scripts/eval_cross_provider.py` (MODIFY in place) | config / test-harness | batch (provider × prompt matrix) | itself (additive rows mirror existing rows) | self (modify-in-place) |

## Pattern Assignments

### `backend/app/services/agent_loop.py` (service module — skeleton only)

**Primary analog:** `backend/app/services/tool_dispatcher.py` — the Phase 083 G-5 extraction out of the SAME `threads.py` god file. It is the canonical house-style for "loop logic lifted into a `services/*.py` module," and the loop being extracted in 089 already calls into it. Use it as the structural template for the new module's header.

**Module header pattern** (`tool_dispatcher.py` L1-52):
```python
"""Tool dispatch registry for the agent_runner loop.

Extracted from threads.py (Phase 083, G-5 mandated refactor). Each tool has a
handler function that receives (args, ctx) and returns a ToolResult. The caller
in threads.py constructs a ToolContext once per iteration and delegates all
tool-specific logic through dispatch_tool().
...
"""
from __future__ import annotations

import asyncio
import json
import logging
...
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Callable, Awaitable
from uuid import UUID

from starlette.concurrency import run_in_threadpool
from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS
from app.services.... import ...

if TYPE_CHECKING:
    import asyncpg
    import redis.asyncio as aioredis
    from supabase import Client
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)
```

House conventions the skeleton MUST copy from this header:
- **Module docstring opens with one-line purpose + a "Extracted from threads.py (Phase NNN, G-5 ...)" provenance line.** `agent_loop.py` should say "Extracted from threads.py (Phase 089, G-5 mandated refactor)." This is the established G-5 extraction-module convention (tool_dispatcher set it).
- **`from __future__ import annotations` is the FIRST line after the docstring** (every service module: tool_dispatcher L13, ask_user_service L39, task_service L27, sandbox_service L6). This makes the `"UUID"`/`"aioredis.Redis"` string-forward-refs in RESEARCH's proposed signature legal without runtime imports.
- **Heavy/typing-only deps go under `if TYPE_CHECKING:`** (`asyncpg`, `redis.asyncio as aioredis`, `supabase.Client`, `UserEffectiveSettings`) — exactly the types RESEARCH's `RunContext` fields reference. Copy this block verbatim into `agent_loop.py`; it keeps the frozen-dataclass field annotations cheap and avoids the Pitfall-4 import cycle.
- **`logger = logging.getLogger(__name__)`** at module scope, immediately after imports. Universal across all four service analogs. No custom logger name.
- **Section banners** — `tool_dispatcher.py` uses `# ----` rule comments to separate "Data classes" (L55-57) from "Tool handlers" (L103-105). `agent_loop.py` should mirror: a `# Data classes` banner over `RunContext`/`AgentLoopResult`, then the `run_agent_loop` body.
- **Module-level constants/frozensets** live at module scope right after the logger (see `task_service.py` `_ACQUIRE_LUA` L58-64; `sandbox_service.py` `_sessions`/`_last_used` dicts L16-17). Per RESEARCH Pitfall "Module-level mutable singletons" + WORKER_COUNT=2: any frozenset the loop reads (e.g. provider-gate sets) is fine as a module constant (immutable); NO module-level mutable accumulators — those stay loop-local inside `run_agent_loop`.

**Secondary analogs (confirm the header conventions are house-wide, not tool_dispatcher-only):**
- `ask_user_service.py` L39-50 — `from __future__ import annotations` → stdlib imports → `if TYPE_CHECKING: import redis.asyncio as aioredis` → `logger = logging.getLogger(__name__)`. Same shape; this module is the closest "service that receives the Redis handle and run_id and emits/blocks on streams" analog (matches how `run_agent_loop` receives `redis` + `emit`).
- `task_service.py` L27-47 — `from __future__` → stdlib → `from app.config import settings` → `from app.db.runs import finalize_run, insert_run` → `from app.services.tool_dispatcher import ToolContext, ToolResult, dispatch_tool` → `logger`. This is the cleanest precedent for a service module that *imports* `tool_dispatcher` and runs a mini agent loop — `agent_loop.py` will import the same trio (`ToolContext, ToolResult, dispatch_tool`) the same way. Copy this import line verbatim.

---

### `RunContext` / `AgentLoopResult` dataclasses (house dataclass convention)

**Analog:** `ToolContext` (`tool_dispatcher.py` L59-89) + `ToolResult` (L92-100) — the sibling context/result objects for the very same loop. RESEARCH proposes a `frozen=True` `RunContext`; the in-repo convention is below so the new dataclasses match house style on the points RESEARCH leaves to discretion.

**`ToolContext` excerpt** (L59-89):
```python
@dataclass
class ToolContext:
    """Carries all dependencies a tool handler needs from the agent_runner scope."""
    redis: Any  # redis.asyncio client
    run_id: UUID
    thread_id: str
    supabase: Any  # supabase Client
    pool: Any  # asyncpg pool
    user_settings: Any  # UserEffectiveSettings
    current_user: dict  # {"id": str, ...}
    folder_subtree_ids: set[str] | None
    scoped_folder_path: str | None
    emit: Callable[..., Awaitable[None]]  # reference to _emit
    spawn: Callable  # reference to _spawn
    model: str = ""  # user's selected model (for sub-agent routing)
    ...
    per_run_task_semaphore: Any = None  # asyncio.Semaphore | None — keep Any to avoid module-level asyncio import surface
    available_tools: list[str] = field(default_factory=list)
    tool_call_id: str = ""
```

**`ToolResult` excerpt** (L92-100):
```python
@dataclass
class ToolResult:
    """Structured return from a tool handler."""
    result: str  # The tool_result string for persistence + LLM context
    llm_content: str | None = None
    source_refs: list[dict] = field(default_factory=list)
    similarity_score: float | None = None
    sub_agent_record: dict | None = None
```

House dataclass conventions for the new `RunContext` / `AgentLoopResult`:
- **`@dataclass` with a one-line docstring** stating what the object carries and where its fields come from ("Carries all dependencies a tool handler needs from the agent_runner scope." → for `RunContext`: "Carries the stable per-run inputs `run_id`/`thread_id`/`current_user`/... that `run_agent_loop` reads, lifted from the `send_message`/`agent_runner` closure scope.").
- **Frozen vs not:** `ToolContext` is NON-frozen (it carries per-iteration mutables like `tool_index`/`iteration`). `RunContext` should be `@dataclass(frozen=True)` per RESEARCH (inputs only, mutated nowhere) — this is the deliberate divergence RESEARCH calls for (Pitfall 3: frozen catches accidental accumulator-on-context bugs early). `AgentLoopResult` can stay non-frozen (plain `@dataclass`), matching `ToolResult` (a return bag).
- **Field typing house style:** opaque external types annotated as `Any` with a trailing `# comment` naming the real type (`redis: Any  # redis.asyncio client`, `user_settings: Any  # UserEffectiveSettings`, `supabase: Any  # supabase Client`). This is the established pattern to avoid runtime-import cost on hot-path objects — copy it for `RunContext.redis`/`.supabase`/`.user_settings`/`.body`. (RESEARCH's signature uses string-forward-refs like `"UUID"`/`"MessageCreate"` instead — both are acceptable; the `Any + # comment` form is the in-repo house style and reads cleaner for the genuinely opaque ones. Use `UUID` directly for `run_id` since `tool_dispatcher` does, `str` for `thread_id`, `dict` for `current_user`.)
- **Callables typed `Callable[..., Awaitable[None]]` (async) or bare `Callable`** with a `# reference to _emit` / `# reference to _spawn` comment (L71-72). RESEARCH passes `emit`/`emit_terminal`/`spawn` as keyword-only params to `run_agent_loop` rather than as `RunContext` fields (to break the Pitfall-4 cycle) — but if any callable does land on a result/context object, type it this way.
- **Defaults via `field(default_factory=list)` for mutable defaults** (L88, L97-99), plain `= ""` / `= None` for scalars. Never a bare mutable default.

---

### `scripts/eval_cross_provider.py` (MODIFY in place — D-089-09)

**Analog: the file itself.** Both edits are additive and mirror existing rows exactly. No new structure, no new function — D-089-09 is explicit that this is "additive proof-harness work, NOT agent-loop edits."

**Edit 1 — `PROVIDERS` list** (L68-75). Append two rows mirroring the existing native-weak-model rows (deepseek/moonshot already there with inline comments):
```python
PROVIDERS: list[tuple[str, str]] = [
    ("openai", "gpt-5.4-mini"),
    ("anthropic", "claude-haiku-4-5"),
    ("google", "gemini-3.5-flash"),   # 3.x+ — NOT gemini-2.5 (D-03)
    ("openrouter", "z-ai/glm-5.1"),
    ("deepseek", "deepseek-v4-flash"),   # native weak-model — SEED-034 fold-gate target
    ("moonshot", "kimi-k2.6"),           # native weak-model — SEED-034 fold-gate target
    # --- ADD (Phase 089 D-089-09 — native-7 baseline; _PROVIDER_BASE_URLS source of truth) ---
    ("zhipu", "glm-4-flash"),            # GLM — _SUB_AGENT_MODEL_DEFAULTS["zhipu"] (config.py:555)
    ("minimax", "minimax-m2.7"),         # _SUB_AGENT_MODEL_DEFAULTS["minimax"] (config.py:554)
]
```
Model IDs are RESEARCH-verified against `config.py` MODEL_CAPABILITIES (RESEARCH §"D-089-09 Eval Curation"). New rows follow the existing `(provider, model)` tuple shape + trailing `# rationale (config.py:NN)` comment convention. Per `[[feedback_model_names_representative]]`, these are provider-class representatives; the comprehensive pinning pass is Phase 096 (EVAL-01) — note that in the comment.

**Edit 2 — `report_env_presence()` `checks` list** (L208-218). Append two `(NAME, is_secret=True)` tuples mirroring the existing provider-key rows:
```python
    checks = [
        ...
        ("OPENAI_API_KEY", True),
        ("ANTHROPIC_API_KEY", True),
        ("GOOGLE_API_KEY", True),
        ("OPENROUTER_API_KEY", True),
        ("ZHIPU_API_KEY", True),       # ADD — Phase 089 D-089-09 (config.py:580, .env.example:100)
        ("MINIMAX_API_KEY", True),     # ADD — Phase 089 D-089-09 (config.py:581, .env.example:101)
    ]
```
Same `(env_var_name, is_secret)` tuple shape; `is_secret=True` so the loop (L220-223) prints only `set`/`MISSING`, never the value (project secrets rule + `[[feedback_env_secrets_handling]]`). The print loop itself is UNCHANGED.

**No third edit needed.** The `--provider` argparse `choices` auto-derives from `PROVIDERS` — `choices=[p for p, _ in PROVIDERS] + ["google-2.5"]` (L605, verified). Adding the two PROVIDERS rows automatically extends the CLI `--provider` accepted values to `zhipu` + `minimax`. Do NOT hand-edit the choices line.

## Shared Patterns

### G-5 extraction-module header convention
**Source:** `backend/app/services/tool_dispatcher.py` L1-52 (the Phase 083 precedent for this exact move)
**Apply to:** `backend/app/services/agent_loop.py` skeleton
- Docstring: one-line purpose + `Extracted from threads.py (Phase 089, G-5 mandated refactor).` provenance.
- `from __future__ import annotations` first, `logger = logging.getLogger(__name__)` after imports, `if TYPE_CHECKING:` block for `asyncpg`/`aioredis`/`supabase.Client`/`UserEffectiveSettings`.

### Context-object dataclass convention
**Source:** `ToolContext`/`ToolResult` (`tool_dispatcher.py` L59-101)
**Apply to:** `RunContext` (frozen — inputs only) + `AgentLoopResult` (plain — return bag)
- `Any + # real-type` comment for opaque externals; `field(default_factory=...)` for mutable defaults; `Callable[..., Awaitable[None]] + # reference to _X` for async callables.

### Secret-safe env reporting
**Source:** `scripts/eval_cross_provider.py` `report_env_presence()` L202-224
**Apply to:** the +2 provider-key rows
- `(NAME, is_secret=True)` tuple, print loop emits `set`/`MISSING` only — never values. (`[[feedback_env_secrets_handling]]`.)

### Single source of truth for "which providers are native"
**Source:** `backend/app/config.py` `_PROVIDER_BASE_URLS` L10-20 (native-7 = all keys minus `openrouter` + `ollama`)
**Apply to:** the eval `PROVIDERS` list — the two added rows (`zhipu`, `minimax`) are registered keys here, confirming D-089-05's native-7. Any divergence between this dict and the eval list is a bug.

## No Analog Found

None. Both files have strong in-repo analogs:
- `agent_loop.py` skeleton → `tool_dispatcher.py` (same-file-of-origin G-5 sibling).
- `eval_cross_provider.py` edits → self (additive, row-mirroring).

The agent-loop BODY (the iteration loop, the three `_on_chunk_*` handlers, `_persist_assistant_message`) has no "analog" by design — it is lifted VERBATIM from `threads.py` per RESEARCH's Extraction Seam Map (D-089-01). The planner copies those bytes from `threads.py`, not from any pattern here.

## Metadata

**Analog search scope:** `backend/app/services/*.py` (23 modules; read headers of tool_dispatcher, ask_user_service, task_service, sandbox_service), `scripts/eval_cross_provider.py`, `backend/app/config.py` L1-20.
**Files scanned:** ~6 read targets (all non-overlapping ranges).
**Pattern extraction date:** 2026-05-30

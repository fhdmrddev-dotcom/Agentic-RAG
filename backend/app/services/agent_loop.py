"""The agent iteration loop for the agent_runner producer.

Extracted from threads.py (Phase 089, G-5 mandated refactor). Owns the
multi-iteration tool-calling loop, the three provider chunk-handlers, and the
assistant-message persistence path — all lifted VERBATIM from the
``send_message``/``agent_runner`` closure scope so the harness (Phase 091) can
sit on a clean module instead of the 3,186-LOC god file.

The caller in threads.py constructs a frozen ``RunContext`` once per run and
delegates the loop through ``run_agent_loop(ctx, *, emit, emit_terminal,
spawn)``. The loop returns an ``AgentLoopResult`` carrying the bound persist
callable + token totals + persisted system warnings so the producer's shielded
finalizer (which STAYS in threads.py) can complete the run.

Behavior-preserving: this module changes file location only, never behavior.
A careless "while-I'm-in-here" cleanup re-opens the 075.x cross-provider
cascade — the three chunk-handlers stay three separate functions, every
per-provider round-trip invariant is preserved byte-identically.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Awaitable, Callable
from uuid import UUID

if TYPE_CHECKING:
    import asyncpg
    import redis.asyncio as aioredis
    from supabase import Client
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RunContext:
    """Carries the stable per-run INPUTS that run_agent_loop reads, lifted from
    the send_message/agent_runner closure scope.

    Frozen on purpose (Pitfall 3): inputs only, mutated nowhere. All mutable
    accumulators (full_content, token totals, persisted_tool_calls, ...) stay
    loop-local inside run_agent_loop, never on this context — frozen catches
    an accidental accumulator-on-context bug early, and keeps the object safe
    to construct once per run under WORKER_COUNT=2.
    """
    run_id: UUID
    thread_id: str
    current_user: dict  # {"id": str, ...}
    user_settings: Any  # UserEffectiveSettings (resolved, provider-overridden)
    body: Any  # MessageCreate (body.model / .provider / .agent_mode / .content)
    redis: Any  # redis.asyncio client
    supabase: Any  # supabase Client
    resolved_model: str
    resolved_provider: str


@dataclass
class AgentLoopResult:
    """Structured return from run_agent_loop — the outputs the producer's
    shielded finalizer (STAYS in threads.py) needs after the loop ends.

    Plain (non-frozen) like ToolResult — it is a return bag, not an input
    context. _shielded_finalize reads the token totals + persisted warnings and
    calls persist() (the bound _persist_assistant_message) to complete the run.
    """
    persist: Callable[..., Awaitable[Any]]  # reference to the bound _persist_assistant_message
    input_tokens_total: int | None = None
    output_tokens_total: int | None = None
    persisted_system_warnings: list[dict] = field(default_factory=list)
    full_content_final: str = ""


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------

async def run_agent_loop(ctx: RunContext, *, emit, emit_terminal, spawn) -> AgentLoopResult:
    """Drive the multi-iteration tool-calling loop for one run (STUB).

    The loop body lands in Plan 03 after the seam is signed off (D-089-04).
    """
    raise NotImplementedError("loop body lands in Plan 03 after seam sign-off")

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class MessageCreate(BaseModel):
    content: str
    model: str | None = None
    provider: str | None = None   # override active provider for this request
    agent_mode: str = "default"   # "default" | "explorer"


class MessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    user_id: UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    updated_at: datetime
    tool_calls: list[dict] | None = None
    source_refs: list[dict] | None = None
    confidence_level: str | None = None
    confidence_avg_similarity: float | None = None
    confidence_disclaimer: str | None = None
    # D-063.1-15 / Gap-002 fix: extend the response shape so the frontend Resume
    # button has runStatus on every assistant row from getMessages (single
    # round-trip — no separate getActiveRuns/getFailedRuns endpoint needed).
    # Pre-run-backed messages (predate migration 035) get null — fine, the
    # Resume button only renders when runStatus === 'failed'.
    #
    # Snake_case on the wire (this Pydantic model); the frontend api.ts
    # getMessages mapper converts to camelCase runId/runStatus on the
    # Message type. The 4-value Literal mirrors the CHECK constraint on
    # public.runs.status (migration 035 line 25).
    run_id: UUID | None = None
    # Phase 066 D-066-04: 5-value Literal mirrors public.runs CHECK constraint
    # post-migration 038. The 5th value 'timed_out' (NEW) is written by the
    # producer's TimeoutError handler (threads.py:agent_runner) when the
    # per-LLM-call asyncio.timeout fires. NEVER written by runs.py:cancel_run
    # (partition guard per D-066-05).
    run_status: Literal["streaming", "completed", "failed", "cancelled", "timed_out"] | None = None

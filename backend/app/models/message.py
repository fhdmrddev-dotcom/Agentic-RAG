from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class MessageCreate(BaseModel):
    content: str
    model: str | None = None
    provider: str | None = None   # override active provider for this request
    agent_mode: str = "default"   # "default" | "explorer"
    # Phase 092 D-02 (MODE-01): when set, THIS message kicks off the named
    # published workflow — the next chat message IS the workflow input. The
    # send_message handler resolves+parses the definition under the user's RLS,
    # calls create_workflow_run (which sets threads.active_workflow_run_id), and
    # the producer branches to the harness engine. None = ordinary Deep send.
    workflow_definition_id: UUID | None = None
    # Phase 152 D-01 (WFIN-02): an optional per-run KB folder-scope OVERRIDE for a
    # workflow kickoff. Travels in create_workflow_run.inputs jsonb (no migration),
    # is owner-reachability-gated server-side (D-05), and layers on top of the
    # definition's project_folder_id author default (D-03). None = today's behavior
    # (whole-KB / author default — D-06). A malformed UUID → FastAPI 422 for free (V5).
    folder_id: UUID | None = None


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
    # Phase 076.2 D-01: DeepSeek thinking mode reasoning_content. Nullable --
    # only present on assistant messages from thinking-enabled providers.
    reasoning_content: str | None = None
    # Phase 095.1-03 (D-04 model attribution + D-05 true reload timer): the
    # resolved run's model/provider and persisted wall-clock timestamps, stamped
    # additively by _enrich_messages_with_runs from the SAME runs↔messages join.
    # All nullable — a legacy / pre-run-backed assistant message (no run row)
    # returns null for all 4 (graceful), mirroring run_id/run_status above. The
    # frontend api.ts mapper converts to camelCase model/provider/startedAt/
    # completedAt on the Message type. NO migration — runs already carries these.
    model: str | None = None
    provider: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None

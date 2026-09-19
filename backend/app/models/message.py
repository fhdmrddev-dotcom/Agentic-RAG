from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


# Phase 214 D-214-04 (STEP-02) — the RUN-SCAFFOLDING keys a launcher may not supply.
#
# ⚠ THIS EXISTS BECAUSE "THE RESERVED KEYS ARE SPREAD LAST SO THEY WIN" IS ONLY TRUE WHEN
# THEY ARE PRESENT, AND `folder_id` IS SPREAD CONDITIONALLY. Measured, not reasoned about:
# a POST with no `folder_id` and `inputs={"folder_id": "1111..."}` stored
# `{'folder_id': '1111...', 'kickoff_prompt': ...}` — the launcher's value survived intact,
# because there was no reserved value to overwrite it. `workflow_runs.inputs["folder_id"]`
# is read back as the per-run retrieval override on the resume/Continue path, so the
# precedence rule has to hold in BOTH arms or it is not a rule.
#
# The exposure is BOUNDED rather than absent — `harness.scope.resolve_run_scope_root`
# re-validates the override against `fetch_visible_folders(owner)` on every read, so an
# unreachable id is dropped and no cross-user scope is possible. It is stripped anyway:
# defence in depth costs one dict comprehension, and a value that reaches the durable jsonb
# without passing `MessageCreate.folder_id`'s UUID validation is a second door into a gated
# field. `kickoff_prompt` is stripped for the same one-rule reason.
#
# ONE frozenset, imported by BOTH merge sites (api/threads.py and services/workflow_kickoff.py)
# — this plan's whole complaint is a fact living in two places, so it does not add a third.
RESERVED_RUN_INPUT_KEYS: frozenset[str] = frozenset({"kickoff_prompt", "folder_id"})


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
    # Phase 214 D-214-04 (STEP-02): the DECLARED input values a launcher collected for
    # this kickoff — the Run modal's fields, the chat launch form, Test Run. Merged
    # server-side into create_workflow_run.inputs (api/threads.py) AND into the live
    # ctx.inputs mirror (services/workflow_kickoff.py) in the same commit, beside
    # kickoff_prompt and folder_id. Those two are RESERVED and win: a launcher key
    # spelled `folder_id` must not be able to impersonate the owner-gated override
    # (D-05), and one spelled `kickoff_prompt` could never have reached an adapter
    # argument anyway (_NON_ACTION_RUN_INPUTS excludes it by NAME). None = today's
    # behavior — the run's inputs dict is byte-identical to the pre-214 literal.
    # dict[str, str], never dict[str, Any]: the launchers collect text fields, and the
    # flat-path guarantee is what a permissive value type would quietly give away. A
    # non-string value → FastAPI 422 for free, exactly as folder_id's malformed UUID.
    #
    # ── D-103-CONF-1 IS AMENDED HERE, DELIBERATELY AND IN WRITING ──────────────────
    # The shipped constraint reads "reuses the EXISTING kickoff path — createThread +
    # sendMessage(workflow_definition_id) — NEVER a bespoke /workflows/{id}/run route
    # (D-103-CONF-1; threads.py byte-identical)". Its PURPOSE is that there is exactly
    # ONE kickoff path with one governance story; "threads.py byte-identical" is how
    # Phase 103 achieved that at the time, not the thing being protected.
    #   * WHAT IS AMENDED: this one additive request field, plus one dict merge in each
    #     of the two kickoff literals.
    #   * WHY SC#2 CANNOT BE MET WITHOUT IT: the declared values have no other channel,
    #     and a second route is the thing D-103-CONF-1 actually forbids.
    #   * THE NEW BOUNDARY: no new route, no new key on the POST *response*, no change
    #     to the two-rows model, the create-before-spawn ordering, the template-upload
    #     sequencing or the orphan cleanup. The amendment is exactly one request field
    #     and one dict literal (twice).
    # Phase 216 (CHAT-05 / CHAT-06): active connector connection IDs for this message / thread turn.
    active_connector_ids: list[UUID] | None = None
    inputs: dict[str, str] | None = None


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
    # ── Phase 257.1 (ROADMAP SC#4) — THE THIRD PLACE OF A THREE-PLACE LOCKSTEP ──────────
    # stamped in `_enrich_messages_with_runs`, selected from `public.runs`, DECLARED here.
    # ⛔ `GET /{thread_id}/messages` is `response_model=list[MessageResponse]`, and a
    # response_model DROPS every key the model does not name, SILENTLY. Deleting either
    # field below does not break a test — it makes the chat cost badge stop rendering, with
    # no error anywhere. That is not hypothetical: Phase 257 shipped `cost_usd`/`is_rated`
    # on the FRONTEND with no backend producer at all, so `RunCostBadge` never mounted in
    # the product while `tsc` and its own unit suite stayed green.
    cost_usd: float | None = None
    is_rated: bool | None = None
    # Phase 223 (BUG-260902-03 / D-223-06): armed connector IDs active when user message was sent
    active_connector_ids: list[UUID] | None = None

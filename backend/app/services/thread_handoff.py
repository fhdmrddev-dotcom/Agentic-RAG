"""Phase 267 (D-267-14 / D-267-15 / D-267-16 / D-267-33 / D-267-34 / PACK-24) — "Ask a second Expert".

One request (``POST /threads/{id}/handoff``) summarises the source thread and creates a new thread for
the second Expert, whose FIRST message carries that summary. This module is the service half: the
summary and the three writes. The route (``api/threads.py``) owns ownership, the shared binding gate,
the model chain and the error words.

RED LINES, each one load-bearing:

* **A SERVICE, NOT A TOOL.** ``emit_handoff_summary`` is a tool NAME passed to ``forced_emit`` and
  nothing else. ``EMITTER_REGISTRY`` stays at 1 and ``_TOOL_REGISTRY`` at 29 (the closed core,
  ``test_259_closed_core_inventory.py``); the model can never call this. It does not live in
  ``expert_service.py`` (that file is AST-fenced as pure data) and its filename matches none of the
  forbidden ``*expert*agent|loop|runtime|executor*`` patterns.
* **IT REFUSES WHERE ``thread_title`` DEGRADES.** A title can fall back to a derived string; a handoff
  thread with no context is the ROADMAP failure mode itself. Any summary failure raises
  ``HandoffSummaryFailed`` and the route answers 502 — nothing is created.
* **SUMMARISE BEFORE ANY TRANSACTION.** Never hold a transaction open across an LLM call.
  ``write_handoff`` runs only after a valid summary exists, and all three rows commit together or not
  at all (the route wraps it in ONE ``get_user_pg_connection``).
* **EVERY ROW CARRIES ``org_id`` FROM THE SOURCE THREAD (D-267-34)**, set explicitly: the autofill
  trigger takes ``org_members … LIMIT 1``, the wrong org for a two-org user. The new thread also
  inherits the source ``folder_id`` (D-267-33), and the source keeps its own Expert (D-267-16).
* **THE MARKER IS A USER ROW (D-267-15).** ``handoff`` is NOT in ``TRANSCRIPT_EVENT_KINDS``: every
  provider receives the summary as plain user content via ``_reconstruct_history``; the UI renders
  the marker as a handoff card.

Tokens: the summary call is not attributed to a run (as ``thread_title``) — routed to Phase 268
(METER-08).

PATCH SURFACE: ``forced_emit`` is imported at module scope, so tests patch
``app.services.thread_handoff.forced_emit``. The route imports these names at module scope into
``app.api.threads``.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints, ValidationError

from app.models.message import ExpertHandoffEvent, HandoffMarker
from app.services.forced_emit import forced_emit

logger = logging.getLogger(__name__)

# The newest ~20k characters of the conversation are summarised (T-267-19: bounded cost).
HANDOFF_INPUT_CHAR_CAP = 20000
_TITLE_CAP = 60
_EMITTER = "emit_handoff_summary"

HandoffItem = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]


class HandoffSummary(BaseModel):
    """3-6 short factual bullets a specialist needs to pick the conversation up."""

    items: list[HandoffItem] = Field(
        ...,
        min_length=3,
        max_length=6,
        description="3 to 6 factual bullets, each at most 160 characters: facts, figures, open questions.",
    )


class HandoffSummaryFailed(Exception):
    """The summary could not be produced — the handoff is refused and nothing is written."""


_SYSTEM_PROMPT = (
    "You are handing a conversation over to a specialist who has not seen it.\n"
    "Write 3 to 6 short factual bullets (each at most 160 characters) that the specialist needs "
    "to continue: the key facts and figures established, decisions made, and the open questions.\n"
    "Use only what the conversation says. Do not invent, speculate or add advice. "
    f"Emit the bullets with the {_EMITTER} tool."
)


def _transcript(rows: list[dict]) -> str:
    """User/assistant TEXT only, oldest first, capped from the END. System rows, reasoning and any
    tool payload are never read."""
    parts: list[str] = []
    for r in rows:
        role = r.get("role")
        if role not in ("user", "assistant"):
            continue
        content = (r.get("content") or "").strip()
        if not content:
            continue
        parts.append(f"{'User' if role == 'user' else 'Assistant'}: {content}")
    text = "\n\n".join(parts)
    if len(text) > HANDOFF_INPUT_CHAR_CAP:
        text = text[-HANDOFF_INPUT_CHAR_CAP:]
    return text


def _emit_tool() -> list[dict]:
    # The 10-line shape of expert_authoring._emit_tool (HandoffSummary has no nullable fields).
    return [
        {
            "type": "function",
            "function": {
                "name": _EMITTER,
                "description": "Emit the handoff summary per the HandoffSummary schema.",
                "parameters": HandoffSummary.model_json_schema(),
            },
        }
    ]


def handoff_title(expert_name: str, source_title: str) -> str:
    """``{Expert} · {source title}``, at most 60 characters (server-set, so autotitle never overwrites)."""
    title = f"{expert_name} · {source_title}".strip()
    if len(title) > _TITLE_CAP:
        title = title[: _TITLE_CAP - 1].rstrip() + "…"
    return title


def handoff_content(source_title: str, summary: list[str]) -> str:
    """The marker row's plain-text ``content`` — what every provider reads as user content."""
    return f"Handed off from “{source_title}”\n" + "\n".join(f"- {item}" for item in summary)


async def summarise_thread_for_handoff(
    *,
    rows: list[dict],
    source_title: str,
    expert_name: str,
    model: str,
    provider: str,
    user_settings: Any,
) -> list[str]:
    """Summarise the source thread through ``forced_emit``. Raises ``HandoffSummaryFailed`` on ANY
    failure — a refused handoff, never a thread without context."""
    text = _transcript(rows)
    if not text:
        raise HandoffSummaryFailed("nothing to summarise")
    prompt = (
        f"Source chat: “{source_title}”\n"
        f"Specialist taking over: {expert_name}\n\n"
        f"Conversation (oldest first):\n{text}"
    )
    try:
        result = await forced_emit(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            provider=provider,
            emitter=_EMITTER,
            tools=_emit_tool(),
            user_settings=user_settings,
            system_prompt=_SYSTEM_PROMPT,
            schema_model=HandoffSummary,
            strict=False,
        )
    except Exception as exc:  # noqa: BLE001 — a provider fault is a refusal, never a half-handoff
        logger.warning("handoff summary: forced_emit raised (%s)", type(exc).__name__)
        raise HandoffSummaryFailed("provider error") from exc

    emitted = (result or {}).get("emitted")
    if (result or {}).get("failure") or emitted is None:
        raise HandoffSummaryFailed(str((result or {}).get("failure") or "no emission"))
    try:
        if isinstance(emitted, HandoffSummary):
            parsed = emitted
        elif isinstance(emitted, BaseModel):
            parsed = HandoffSummary.model_validate(emitted.model_dump())
        else:
            parsed = HandoffSummary.model_validate(emitted)
    except ValidationError as exc:
        raise HandoffSummaryFailed("invalid summary") from exc
    return list(parsed.items)


async def write_handoff(
    conn,
    *,
    source_thread: dict,
    user_id: str,
    expert: dict,
    summary: list[str],
    title: str,
    folder_name: str | None,
    stays_expert_name: str | None,
    at: datetime,
) -> dict:
    """The three rows, in order, on the caller's ONE transaction connection. Returns the new thread.

    1. the new thread (Expert set, source folder inherited, SOURCE org);
    2. its first message — ``role='user'`` with the ``handoff`` marker;
    3. the source thread's ``expert_handoff`` event (``role='system'``).
    ⛔ No UPDATE of the source thread: it keeps its Expert.
    """
    org_id = UUID(str(source_thread["org_id"]))
    uid = UUID(str(user_id))
    source_id = UUID(str(source_thread["id"]))
    source_title = source_thread.get("title") or "New Chat"
    folder_id = source_thread.get("folder_id")
    expert_id = UUID(str(expert["id"]))
    expert_name = str(expert.get("name") or "")

    row = await conn.fetchrow(
        "INSERT INTO public.threads (user_id, org_id, title, active_expert_id, folder_id) "
        "VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid) "
        "RETURNING id, user_id, title, folder_id, active_expert_id, created_at, updated_at",
        uid,
        org_id,
        title,
        expert_id,
        UUID(str(folder_id)) if folder_id else None,
    )
    new_thread = dict(row)
    new_id = UUID(str(new_thread["id"]))

    marker = HandoffMarker(
        source_thread_id=source_id,
        source_title=source_title,
        expert_name=expert_name,
        summary=list(summary),
        folder_name=folder_name,
    )
    await conn.execute(
        "INSERT INTO public.messages (thread_id, user_id, org_id, role, content, tool_calls) "
        "VALUES ($1::uuid, $2::uuid, $3::uuid, 'user', $4, $5::jsonb)",
        new_id,
        uid,
        org_id,
        handoff_content(source_title, list(summary)),
        [marker.model_dump(mode="json")],
    )

    event = ExpertHandoffEvent(
        at=at,
        target_thread_id=new_id,
        target_title=title,
        expert_name=expert_name,
        stays_expert_name=stays_expert_name,
        folder_name=folder_name,
    )
    await conn.execute(
        "INSERT INTO public.messages (thread_id, user_id, org_id, role, content, tool_calls) "
        "VALUES ($1::uuid, $2::uuid, $3::uuid, 'system', $4, $5::jsonb)",
        source_id,
        uid,
        org_id,
        f"Asked {expert_name} in a new chat: “{title}”.",
        [event.model_dump(mode="json")],
    )
    return new_thread

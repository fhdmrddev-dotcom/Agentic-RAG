"""Phase 306 (D-01 / D-26 / D-30 / D-36 / D-37) — an outside question, started as the member.

A thin start service: every step names a shared helper and re-implements none. It mirrors the
ORDER of ``api/threads.py``'s ``send_message`` (read only; never edited) with the request-only parts
dropped, and it makes no HTTP self-call (D-01):

  1. ``ask_scope``          — the folders the ask may read: the key's composed folder scope on the
                              ACTING connection (``acting_member_connection`` +
                              ``list_acting_folders`` + ``compose_key_scope``), or every folder the
                              member sees in the key's org. Refused before anything starts when
                              the key leaves out connected-app documents (D-29: chat search has no
                              channel to drop them) or when the scope is empty (``()`` must never
                              become "no filter" — 266 CR-01). Documents outside a folder are
                              outside an ask (disclosed in the tool description, D-30).
  2. ``resolve_ask_model``  — the member's effective model (D-08): ``load_user_settings`` ->
                              ``apply_user_model_default`` -> ``resolve_run_model``. The
                              keyword-only ``model`` / ``provider`` overrides exist for tests and
                              operators; no MCP or HTTP input reaches them (D-37).
  3. ``start_ask``          — one thread stamped ``origin_kind='mcp'`` at INSERT (mig 223 freezes
                              it), one user message carrying the TRUST-03 envelope, the ``runs``
                              row in the key's org (``register_run_start``), and ``run_producer`` in
                              a task created with a FRESH context that carries only the outside-run
                              allow-list (D-26), entered under ``acting_org_scope(key org)``. The
                              MCP request's own ContextVars (the usage collector, the principal)
                              never ride into the run. The title is generated in the background.
  4. ``wait_for_ask``       — ``asyncio.wait`` against an absolute deadline taken at the start of
                              the tool call (D-36). Never ``asyncio.wait_for``: that cancels the run.
  5. ``read_ask``           — the ONE access statement (run, member, key, org, mcp origin, root
                              run), then ``run_is_cap_paused`` BEFORE any status branch: a
                              first-turn cap pause finalizes as ``completed`` by design (D-33).
                              A completed run that was Continued in the app reads
                              ``answered_in_app``: the chat link only, never its content (CR-01).

The question is never logged (length + sha only, the 296-06 rule).
"""

from __future__ import annotations

import asyncio
import contextvars
import hashlib
import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from app.config import primary_frontend_origin
from app.db.runs import run_is_cap_paused
from app.dependencies import get_pg_pool, get_redis, get_service_role_supabase
from app.models.message import MessageCreate
from app.models.user_settings import load_user_settings, override_provider
from app.security.acting_member import acting_member_connection, acting_org_scope
from app.services.acting_member_reads import list_acting_folders
from app.services.key_scope import compose_key_scope
from app.services.outside_run_scope import ASK_TOOL_ALLOWLIST, outside_run_context
from app.services.run_lifecycle import finalize_run_terminal, register_run_start
from app.services.run_model_resolution import apply_user_model_default, resolve_run_model
from app.services.run_transport import _emit
from app.services.thread_title import generate_thread_title, maybe_autotitle_thread

logger = logging.getLogger(__name__)

ASK_NEEDS_EXTERNAL_SENTENCE = (
    "This key can't ask the agent: it leaves out mail and synced sources, and the agent's search "
    "can't leave them out. To ask, use a key with Include mail and synced sources ticked."
)
ASK_NO_FOLDERS_SENTENCE = "This key can't see any folders, so there is nothing to ask about."

# A thread's title until maybe_autotitle_thread replaces it (its own "New Chat" guard).
_NEW_THREAD_TITLE = "New Chat"

# Strong references to fire-and-forget tasks (title, on_done) so they are not collected mid-flight.
_BACKGROUND: set[asyncio.Task] = set()


@dataclass(frozen=True)
class AskScopeRefusal:
    reason: str      # "ask_needs_external" | "ask_no_folders" — an audit reason, never shown raw
    sentence: str    # the UI-SPEC sentence the AI tool receives


@dataclass(frozen=True)
class AskModel:
    settings: Any
    model: str
    provider: str
    body: MessageCreate
    notice: dict | None


@dataclass(frozen=True)
class StartedAsk:
    run_id: uuid.UUID
    thread_id: uuid.UUID
    task: asyncio.Task


@dataclass(frozen=True)
class AskRead:
    status: str      # answered | answered_in_app | working | needs_input | failed | timed_out | stopped
    run_id: uuid.UUID
    thread_id: uuid.UUID
    chat_link: str
    answer: str | None = None
    citations: list[dict] = field(default_factory=list)
    confidence_level: str | None = None
    disclaimer: str | None = None


def _fingerprint(text: str) -> str:
    """Length + a short sha — what may be logged about a question (never the text)."""
    return f"len={len(text)} sha={hashlib.sha256(text.encode('utf-8')).hexdigest()[:12]}"


def _as_uuid(value: Any) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


# ── 1. the scope ──────────────────────────────────────────────────────────────────────────────


async def _compose(principal: Any) -> tuple[tuple[str, ...] | None, list[dict]]:
    """The key's composed folder scope on the ACTING connection, and the folders it was composed
    from. ONE composition: ``ask_scope`` and ``composed_folder_ids`` (306-05's workflow narrowing)
    both read through here."""
    async with acting_member_connection(user_id=principal.user_id, org_id=principal.org_id) as conn:
        folders = await list_acting_folders(conn)
    scope = compose_key_scope(
        key_folder_ids=principal.folder_ids,
        include_external=principal.include_external,
        tools=principal.tools,
        visible_folders=folders,
    )
    return scope.folder_ids, folders


async def composed_folder_ids(principal: Any) -> tuple[str, ...] | None:
    """306-05 (D-10): the key's composed folder ids (every visible folder at or under the ones it
    ticked), or ``None`` when the key is not narrowed by folder."""
    return (await _compose(principal))[0]


async def ask_scope(principal: Any) -> tuple[str, ...] | AskScopeRefusal:
    """The folder ids an ask may read, or the refusal (D-29 / D-30)."""
    if not principal.include_external:
        return AskScopeRefusal("ask_needs_external", ASK_NEEDS_EXTERNAL_SENTENCE)
    narrowed, folders = await _compose(principal)
    if narrowed is not None:
        effective = tuple(narrowed)
    else:
        effective = tuple(str(f["id"]) for f in folders if f.get("id") is not None)
    if not effective:
        return AskScopeRefusal("ask_no_folders", ASK_NO_FOLDERS_SENTENCE)
    return effective


# ── 2. the model ──────────────────────────────────────────────────────────────────────────────


async def resolve_ask_model(
    principal: Any,
    question_envelope: str,
    *,
    model: str | None = None,
    provider: str | None = None,
) -> AskModel:
    """The member's effective model and provider, through the shared send-path helpers (D-08)."""
    settings = await asyncio.to_thread(load_user_settings, principal.user_id)  # D-v2.5-01
    settings = await apply_user_model_default(None, {"id": principal.user_id}, settings)
    fields: dict[str, Any] = {"content": question_envelope, "agent_mode": "default"}
    if model:
        fields["model"] = model
    if provider:
        fields["provider"] = provider
    body = MessageCreate(**fields)
    if body.provider and body.provider != getattr(settings, "active_provider", None):
        settings = override_provider(settings, body.provider)  # the send_message order
    resolved_model, resolved_provider, notice, body, settings = await resolve_run_model(
        body=body, user_settings=settings
    )
    return AskModel(settings, resolved_model, resolved_provider, body, notice)


# ── 3. the start ──────────────────────────────────────────────────────────────────────────────


def _spawn_background(coro: Awaitable[Any], what: str) -> None:
    async def _guarded():
        try:
            await coro
        except Exception:  # noqa: BLE001 — background work never breaks the ask
            logger.warning("outside ask: background %s failed", what, exc_info=True)

    task = asyncio.create_task(_guarded(), context=contextvars.Context())
    _BACKGROUND.add(task)
    task.add_done_callback(_BACKGROUND.discard)


async def start_ask(
    principal: Any,
    *,
    question: str,
    envelope: str,
    scope_folder_ids: tuple[str, ...],
    ask_model: AskModel,
    on_done: Callable[[], Awaitable[Any]] | None = None,
    redis: Any = None,
) -> StartedAsk:
    """Start one ask as the member in the key's org. Returns once the producer is running."""
    from app.api.threads import RUN_TASKS  # noqa: PLC0415 — the shared registry (admin.py / evals.py precedent)
    from app.services.run_producer import ThreadScoping  # noqa: PLC0415 — cycle-safe late import

    redis = redis if redis is not None else get_redis()
    org_id = str(principal.org_id)
    user_id = str(principal.user_id)
    supabase = get_service_role_supabase(org_id)

    # The org is stamped EXPLICITLY (unattended_launch D-06: the autofill trigger would pick the
    # member's first org), and the origin at INSERT, as the service role (mig 223's freeze leaves a
    # service-role insert alone).
    thread_row = {
        "user_id": user_id,
        "org_id": org_id,
        "title": _NEW_THREAD_TITLE,
        "origin_kind": "mcp",
        "origin_label": principal.label,
        "origin_ref": str(principal.key_id),
    }
    thread_resp = await asyncio.to_thread(lambda: supabase.table("threads").insert(thread_row).execute())
    thread_id = _as_uuid(thread_resp.data[0]["id"])

    message_row = {
        "thread_id": str(thread_id),
        "user_id": user_id,
        "role": "user",
        "content": envelope,
        "org_id": org_id,
    }
    await asyncio.to_thread(lambda: supabase.table("messages").insert(message_row).execute())

    run_id = uuid.uuid4()
    pool = await get_pg_pool()
    try:
        await register_run_start(
            pool=pool,
            redis=redis,
            run_id=run_id,
            thread_id=thread_id,
            user_id=_as_uuid(user_id),
            model=ask_model.model,
            provider=ask_model.provider,
            spawned_by_worker=str(os.getpid()),
            org_id=org_id,
            expert_id=None,
        )
    except Exception:
        try:
            await finalize_run_terminal(
                pool=pool,
                redis=redis,
                run_id=run_id,
                thread_id=thread_id,
                status="failed",
                error="spawn_failed",
                completed_at=datetime.now(timezone.utc),
            )
        except Exception:  # noqa: BLE001
            logger.exception("Failed to finalize spawn-failed ask run %s", run_id)
        raise

    logger.info("outside ask started run=%s thread=%s question %s", run_id, thread_id, _fingerprint(question))

    # The title is an LLM call: it runs in the background so it never eats the wait budget (D-36),
    # from the RAW question, never the envelope.
    _spawn_background(
        maybe_autotitle_thread(
            supabase=supabase,
            redis=redis,
            thread_id=str(thread_id),
            first_message=question,
            user_settings=ask_model.settings,
            chat_model=ask_model.body.model or "",
            run_id=run_id,
            title_fn=generate_thread_title,
            emit=_emit,
        ),
        "title",
    )

    scoping = ThreadScoping(list(scope_folder_ids), None, None, None, None)

    async def _scoped() -> None:
        from app.services.run_producer import run_producer  # noqa: PLC0415 — threads.py idiom

        with acting_org_scope(org_id):
            await run_producer(
                run_id,
                thread_id=str(thread_id),
                current_user={"id": user_id, "org_id": org_id},
                supabase=supabase,
                redis=redis,
                user_settings=ask_model.settings,
                body=ask_model.body,
                resolved_model=ask_model.model,
                resolved_provider=ask_model.provider,
                active_workflow_run_id=None,
                kickoff_definition=None,
                kickoff_definition_id=None,
                scoping=scoping,
                scoping_error=None,
            )

    task = asyncio.create_task(_scoped(), context=outside_run_context(ASK_TOOL_ALLOWLIST))
    RUN_TASKS[run_id] = task

    def _done(_t: asyncio.Task, _rid: uuid.UUID = run_id) -> None:
        RUN_TASKS.pop(_rid, None)
        if on_done is not None:
            _spawn_background(on_done(), "on_done")

    task.add_done_callback(_done)
    return StartedAsk(run_id=run_id, thread_id=thread_id, task=task)


# ── 4. the wait ───────────────────────────────────────────────────────────────────────────────


async def wait_for_ask(started: StartedAsk, *, deadline: float) -> bool:
    """True when the run finished by ``deadline`` (a loop.time() value). The run is NEVER cancelled."""
    loop = asyncio.get_running_loop()
    remaining = max(0.0, deadline - loop.time())
    done, _pending = await asyncio.wait({started.task}, timeout=remaining)
    return started.task in done


# ── 5. the read ───────────────────────────────────────────────────────────────────────────────

_ACCESS_SQL = (
    "SELECT r.run_id, r.status, r.message_id, r.thread_id, "
    "COALESCE(r.continues_used, 0) AS continues_used "
    "FROM public.runs r JOIN public.threads t ON t.id = r.thread_id "
    "WHERE r.run_id = $1 AND r.user_id = $2 AND t.origin_kind = 'mcp' AND t.origin_ref = $3 "
    "AND t.org_id = $4 AND r.parent_run_id IS NULL"
)
_MESSAGE_SQL = (
    "SELECT content, source_refs, confidence_level, confidence_avg_similarity, confidence_disclaimer "
    "FROM public.messages WHERE id = $1"
)
_STATUS_WORDS = {
    "streaming": "working",
    "failed": "failed",
    "timed_out": "timed_out",
    "cancelled": "stopped",
}


def _citations(source_refs: Any) -> list[dict]:
    from app.mcp.results import doc_link  # noqa: PLC0415 — keep the mcp package out of import time

    if isinstance(source_refs, str):
        try:
            source_refs = json.loads(source_refs)
        except ValueError:
            source_refs = []
    out: list[dict] = []
    seen: set[str] = set()
    for ref in source_refs or []:
        if not isinstance(ref, dict) or not ref.get("document_id"):
            continue
        doc_id = str(ref["document_id"])
        if doc_id in seen:
            continue
        seen.add(doc_id)
        title = ref.get("title") or ref.get("filename") or "Untitled document"
        out.append({"document_id": doc_id, "title": str(title), "link": doc_link(doc_id)})
    return out


async def read_ask(pool: Any, *, run_id: Any, principal: Any) -> AskRead | None:
    """The ask's current state for THIS key, or None (no such ask for this key: the one refusal)."""
    row = await pool.fetchrow(
        _ACCESS_SQL,
        _as_uuid(run_id),
        _as_uuid(principal.user_id),
        _as_uuid(principal.key_id),
        _as_uuid(principal.org_id),
    )
    if row is None:
        return None
    rid, thread_id = _as_uuid(row["run_id"]), _as_uuid(row["thread_id"])
    chat_link = primary_frontend_origin().rstrip("/") + "/app/chat/" + str(thread_id)
    base = {"run_id": rid, "thread_id": thread_id, "chat_link": chat_link}

    # D-33: the pause predicate FIRST — runs.status alone cannot see a first-turn cap pause.
    if await run_is_cap_paused(pool, rid, org_id=_as_uuid(principal.org_id)):
        return AskRead(status="needs_input", **base)
    status = row["status"]
    if status != "completed":
        return AskRead(status=_STATUS_WORDS.get(status, "failed"), **base)
    # CR-01 (D-10 / D-30): an in-app Continue re-resolved scope without the key's folder wall, so
    # its answer may draw on folders the key cannot read: the chat link only, never content or citations.
    if (row["continues_used"] or 0) > 0:
        return AskRead(status="answered_in_app", **base)

    msg =await pool.fetchrow(_MESSAGE_SQL, row["message_id"]) if row["message_id"] else None
    if msg is None:
        return AskRead(status="answered", **base)
    return AskRead(
        status="answered",
        answer=msg["content"],
        citations=_citations(msg["source_refs"]),
        confidence_level=msg["confidence_level"],
        disclaimer=msg["confidence_disclaimer"],
        **base,
    )

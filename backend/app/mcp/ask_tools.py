"""Phase 306-04 (MCP-04; D-04..D-07 / D-05 / D-16 / D-29 / D-33 / D-35 / D-36 / D-37) — the ask tools.

A THIN wrapper with no visibility rule of its own (the ``read_tools.py`` shape): the ask's scope,
model, start, wait and read are ``services/outside_ask`` (306-03), its admission and idempotency are
``services/outside_admission`` (306-02). This module only puts them in order and shapes the result.

``ask_agent`` — in this order (D-05 / D-16 / D-35):

  1. ``ask_scope``          — the folders the key may read; a key that leaves out connected-app
                              documents is refused here (D-29), before anything is claimed.
  2. ``claim``              — only when an ``idempotency_key`` is given. ``Existing`` returns the
                              first run's read (no second start); ``Starting`` its sentence.
  3. ``resolve_ask_model``  — the member's effective model. ⛔ Called with NO override keyword:
                              nothing an AI tool sends can pick the model (D-37 / D-08);
                              ``AskArgs`` has no such field and forbids extras.
  4. ``acquire``            — one lease in the credential / org / provider scopes, the provider
                              being the one just resolved. Full or Redis down refuses the start
                              and drops the claim.
  5. ``start_ask``          — its ``on_done`` releases the SAME lease when the run's task ends.
                              A start that raises releases and drops, then propagates.
  6. ``bind``               — the claim now names the run.
  7. ``wait_for_ask``       — until ``t0 + mcp_ask_wait_seconds``, ``t0`` taken at the handler's
                              ENTRY (D-36): the budget covers the whole call, not just the wait.
  8. ``read_ask``           — the answer, or ``working`` and the handle.

``get_answer`` reads a handle for THIS key only: an unknown, foreign or malformed handle is ONE
sentence (T-306-07). A cap-paused ask reads ``needs_input`` (D-33) and nothing over MCP answers it.

The question is never logged; the idempotency claim hashes it (``request_sha``).
"""
from __future__ import annotations

import asyncio
import hashlib
import uuid
from typing import Any

from app.dependencies import get_pg_pool, get_redis
from app.mcp import results as R
from app.models.user_settings import load_app_settings_async
from app.services import inbound_inputs
from app.services import outside_admission as _adm
from app.services import outside_ask as _ask
from app.services.rate_limit import UNAVAILABLE_DETAIL

TOOL = "ask_agent"

NO_HANDLE_SENTENCE = "No question with that handle is available to this key."
DIFFERENT_QUESTION_SENTENCE = (
    "This idempotency key was already used for a different question; here is the first one."
)
ALREADY_STARTING_SENTENCE = (
    "This question is already being started. Send the same call again in a few seconds."
)

_CONFIDENCE = {"high", "medium", "low"}


def _shape(read: _ask.AskRead, *, note: str | None = None) -> R.AskResult:
    """An ``AskRead`` as the tool's result: text defanged, citations de-duplicated by document."""
    citations: list[R.AskCitation] = []
    seen: set[str] = set()
    for c in read.citations or []:
        doc_id = str(c.get("document_id") or "")
        if not doc_id or doc_id in seen:
            continue
        seen.add(doc_id)
        citations.append(R.AskCitation(
            document_id=doc_id, title=R.defang(str(c.get("title") or "Untitled document")),
            link=str(c.get("link") or R.doc_link(doc_id)),
        ))
    level = (read.confidence_level or "").lower()
    return R.AskResult(
        status=read.status,
        run_id=str(read.run_id),
        answer=R.defang(read.answer) if read.answer is not None else None,
        citations=citations,
        confidence=level if level in _CONFIDENCE else None,
        disclaimer=R.defang(read.disclaimer) if read.disclaimer else None,
        chat_link=read.chat_link,
        note=note,
    )


async def _read(run_id: Any, principal: Any, *, note: str | None = None) -> R.AskResult | str:
    read = await _ask.read_ask(await get_pg_pool(), run_id=run_id, principal=principal)
    if read is None:
        return NO_HANDLE_SENTENCE
    return _shape(read, note=note)


async def ask_agent(principal: Any, args: R.AskArgs) -> R.AskResult | R.HandlerRefusal | str:
    loop = asyncio.get_running_loop()
    t0 = loop.time()  # D-36: the budget is measured from the start of the call
    budget = int((await load_app_settings_async()).mcp_ask_wait_seconds)
    redis = get_redis()

    scope = await _ask.ask_scope(principal)
    if isinstance(scope, _ask.AskScopeRefusal):
        return R.HandlerRefusal(scope.sentence, scope.reason)

    request_sha = hashlib.sha256(args.question.encode("utf-8")).hexdigest()
    idem = None
    if args.idempotency_key:
        idem = {"credential_id": principal.key_id, "tool": TOOL, "idempotency_key": args.idempotency_key}
        try:
            held = await _adm.claim(redis, **idem, request_sha=request_sha)
        except _adm.OutsideStartUnavailable:
            return R.HandlerRefusal(UNAVAILABLE_DETAIL, _adm.UNAVAILABLE_REASON)
        if isinstance(held, _adm.Starting):
            return ALREADY_STARTING_SENTENCE
        if isinstance(held, _adm.Existing):
            note = None if held.same_request else DIFFERENT_QUESTION_SENTENCE
            return await _read(held.run_id, principal, note=note)

    async def _drop() -> None:
        if idem is not None:
            await _adm.drop(redis, **idem)

    envelope = inbound_inputs.wrap_untrusted_input(
        "question", args.question, source="mcp", notice=inbound_inputs.ASK_NOTICE
    )
    try:
        chosen = await _ask.resolve_ask_model(principal, envelope)
    except Exception:
        await _drop()
        raise

    # One lease identity for the take and the give-back (the provider is the resolved one).
    lease = {"org_id": principal.org_id, "credential_id": principal.key_id,
             "provider": chosen.provider, "lease_id": uuid.uuid4().hex}
    try:
        admitted = await _adm.acquire(redis, **lease, ttl_s=_adm.ASK_LEASE_TTL_S, retry_s=_adm.ASK_RETRY_S)
    except _adm.OutsideStartUnavailable:
        await _drop()
        return R.HandlerRefusal(UNAVAILABLE_DETAIL, _adm.UNAVAILABLE_REASON)
    if isinstance(admitted, _adm.Full):
        await _drop()
        return R.HandlerRefusal(
            _adm.MCP_FULL_SENTENCE[admitted.scope].format(retry=admitted.retry_s),
            _adm.REASON[admitted.scope],
            {"retry_s": admitted.retry_s},
        )

    async def _release() -> None:
        await _adm.release(redis, **lease)

    start = {"question": args.question, "envelope": envelope, "scope_folder_ids": scope,
             "ask_model": chosen, "on_done": _release, "redis": redis}
    try:
        started = await _ask.start_ask(principal, **start)
    except BaseException:
        await _release()
        await _drop()
        raise

    if idem is not None:
        await _adm.bind(redis, **idem, run_id=started.run_id, request_sha=request_sha)

    await _ask.wait_for_ask(started, deadline=t0 + budget)
    out = await _read(started.run_id, principal)
    if isinstance(out, str):  # the runs row is not readable yet: still a valid handle
        return R.AskResult(status="starting", run_id=str(started.run_id))
    return out


async def get_answer(principal: Any, args: R.GetAnswerArgs) -> R.AskResult | str:
    try:
        run_id = uuid.UUID(args.handle)
    except ValueError:
        return NO_HANDLE_SENTENCE
    return await _read(run_id, principal)

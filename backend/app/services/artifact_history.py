"""Phase 273 (I-2 / I-3 / I-4) — artifacts in history and on reload.

Two pure-ish helpers, and the only two places the chat history touches artifacts:

``redact_artifact_args`` — the agent loop's ONE persist-time hook (D-15).
    Every ``show_artifact`` call's ``args.rows`` is replaced by a placeholder before the
    assistant row is written, so no later turn re-sends hundreds of inline rows (I-4) —
    including REFUSED calls, which persist with status ``done`` and their full args
    (Pitfall 4). Why PERSIST time and not ``_reconstruct_history``:
      1. it covers BOTH append sites — the main dispatch loop and the Continue/resume block feed
         the same ``persisted_tool_calls`` list;
      2. reload then shows a reference, never 500 rows;
      3. DB rows stay small. A read-time rewrite would leave every row holding the rows forever.
    The current turn is unaffected: its assistant message carries the raw arguments string, so
    the model that made the call sees it verbatim. The placeholders are built from the 273-01
    constants, never re-typed, because 273-01's validator refuses a call that echoes one back
    and points the model at ``from_artifact`` — the two must never drift.

``attach_artifacts`` — reload (I-2, ART-05).
    GET /messages and GET /snapshot attach the stored records to each assistant message, keyed
    by the artifact id PARSED FROM THE PERSISTED RESULT. Never by the call id: Gemini assigns
    ``call_{idx}`` when the SDK gives none, which repeats every iteration and every turn
    (Pitfall 5). Never by run: ``runs.message_id`` is not unique. One batched select on the
    caller's user-JWT client (RLS mirrors ``messages``) plus an explicit thread + user filter
    as defence in depth (T-273-21), wrapped in ``aexec`` (D-v2.5-01). A failed read marks every
    referenced id missing and logs — it never fails the route (T-273-25).

⛔ Imports models + the db helper only; never ``agent_loop`` (it imports this module).
"""
from __future__ import annotations

import logging
import re
from typing import Any

from app.models.artifact import (
    RESULT_ID_KEY,
    ROWS_PLACEHOLDER_NOT_STORED,
    ROWS_PLACEHOLDER_STORED,
    artifact_id_from_result,
    is_refusal_result,
)
from app.utils.db import aexec

logger = logging.getLogger(__name__)

TOOL_NAME = "show_artifact"

# The loop persists ``result[:2000]``. The id is the result's FIRST key precisely so a cut keeps it
# (I-3), but a cut result is no longer valid JSON — so read the id from the prefix when the whole
# object does not parse. Same id shape as models/artifact.ARTIFACT_ID_RE.
_ID_PREFIX = re.compile(r'^\s*\{\s*"' + re.escape(RESULT_ID_KEY) + r'"\s*:\s*"(a_[0-9a-z]{10})"')


def _artifact_id(result: Any) -> str | None:
    art_id = artifact_id_from_result(result)
    if art_id is None and isinstance(result, str):
        m = _ID_PREFIX.match(result)
        art_id = m.group(1) if m else None
    return art_id


def _placeholder(rows: Any, result: Any) -> str:
    if not isinstance(rows, list):
        return f"{ROWS_PLACEHOLDER_NOT_STORED}>"
    n = len(rows)
    art_id = _artifact_id(result)
    if art_id:
        return f"{ROWS_PLACEHOLDER_STORED}{art_id}, {n} rows>"
    if is_refusal_result(result):
        return f"{ROWS_PLACEHOLDER_NOT_STORED}: refused, {n} rows>"
    return f"{ROWS_PLACEHOLDER_NOT_STORED}, {n} rows>"


def redact_artifact_args(tool_calls: list[dict]) -> list[dict]:
    """Return ``tool_calls`` with every ``show_artifact`` call's ``args.rows`` replaced.

    Pure: the input list and its dicts are never mutated. A non-``show_artifact`` entry, or a
    by-reference call whose ``rows`` is absent or None, is returned as the SAME object. Every
    other key — the other args, ``result``, ``thought_signature`` — is carried through untouched.
    """
    out: list[dict] = []
    for tc in tool_calls:
        args = tc.get("args") if isinstance(tc, dict) else None
        if (
            not isinstance(tc, dict)
            or tc.get("name") != TOOL_NAME
            or not isinstance(args, dict)
            or args.get("rows") is None
        ):
            out.append(tc)
            continue
        out.append({**tc, "args": {**args, "rows": _placeholder(args["rows"], tc.get("result"))}})
    return out


def _referenced_ids(message: dict) -> list[str]:
    calls = message.get("tool_calls")
    if message.get("role") != "assistant" or not isinstance(calls, list):
        return []
    ids: list[str] = []
    for tc in calls:
        if isinstance(tc, dict) and tc.get("name") == TOOL_NAME:
            art_id = _artifact_id(tc.get("result"))
            if art_id:
                ids.append(art_id)
    return ids


async def attach_artifacts(
    messages: list[dict],
    *,
    thread_id: str,
    user_id: str,
    supabase: Any,
) -> list[dict]:
    """Set ``message["artifacts"]`` on each assistant message that showed one, in call order.

    Mutates ``messages`` in place and returns the same list (the ``_enrich_messages_with_runs``
    contract). A referenced id with no visible row becomes ``{"id": id, "missing": True}`` so the
    page shows the missing notice instead of silently dropping it. No ``show_artifact`` call
    anywhere → no database call at all.
    """
    per_message = [(m, _referenced_ids(m)) for m in messages if isinstance(m, dict)]
    wanted: list[str] = []
    for _m, ids in per_message:
        for art_id in ids:
            if art_id not in wanted:
                wanted.append(art_id)
    if not wanted:
        return messages

    rows_by_id: dict[str, dict] = {}
    try:
        resp = await aexec(
            supabase.table("message_artifacts")
            .select("*")
            .in_("id", wanted)
            .eq("thread_id", str(thread_id))
            .eq("user_id", str(user_id))
        )
        for row in (resp.data if resp is not None else None) or []:
            if isinstance(row, dict) and row.get("id"):
                rows_by_id[row["id"]] = row
    except Exception as exc:  # noqa: BLE001 — reload must never 500 on the artifact read
        logger.warning(
            "artifact attach failed for thread %s (%d ids) — marking them missing: %s",
            thread_id, len(wanted), exc,
        )
        rows_by_id = {}

    for message, ids in per_message:
        if ids:
            message["artifacts"] = [rows_by_id.get(i) or {"id": i, "missing": True} for i in ids]
    return messages

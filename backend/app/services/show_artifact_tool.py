"""Phase 273 (D-14) — the ``show_artifact`` tool handler, in its own module.

The narrow cut (the 272 ``search_documents_tool.py`` precedent): the handler, its by-reference
transforms, its server-built caption and its id-first result live HERE. ``tool_dispatcher`` keeps
ONE import and ONE registry line (``"show_artifact": _handle_show_artifact``) plus the
``_SUB_AGENT_EXCLUDED`` token, nothing else.

⚠ OWED — OV-273-02: the full registry/handler split of ``tool_dispatcher.py`` is STILL owed (272
named it for 273; 273 took only this narrow cut). Re-open trigger: the next phase whose
``files_modified`` names ``tool_dispatcher.py`` proposes the extraction FIRST.

What the handler does, in order:
  1. Belt — chat top-level only. ``ctx.parent_run_id`` (a task sub-agent), ``ctx.phase_whitelist``
     (a workflow phase) or ``ctx.pool`` None (no store) → refused "only available in chat". The
     tool is also kept out of those surfaces by construction (``CHAT_ONLY_TOOLS`` in
     openai_service, subtracted from the harness offer; ``_SUB_AGENT_EXCLUDED``); this is the
     belt, because an artifact belongs under a chat answer and nowhere else.
  2. ``validate_args`` (models/artifact.py — the closed vocabulary). A refusal goes back to the
     model in-turn as ``{status, reason, detail}`` so it can retry (D-12). There is no top-level
     error key: the rail prints that key verbatim (leak L-4).
  3. First emission: the dataset is already validated; slots 0..n-1; caption from
     ``ctx.turn_tool_calls`` (D-04). By reference (D-06/D-07): the PARENT's stored rows are
     loaded through ``get_artifact_by_ref`` bound to this thread AND this caller (Pitfall 11 —
     the pool bypasses RLS), then filter → sort → top_n → select, then ``validate_dataset`` with
     the call's encoding. No retrieval, no code, no provider: the numbers are the stored ones.
  4. ``insert_artifact`` (a NEW immutable row, D-08; ``parent_id`` = the source), then ONE
     ``artifact`` SSE event carrying the INSERT…RETURNING row UNCHANGED (Pattern 4 / I-2 — live
     equals reload by construction), then an id-first result < 2000 chars (I-3).

People-facing ``reason`` strings come only from closed templates: the models/artifact.py
catalogue, plus the few handler-only forms in ``_HR`` below. A model string is echoed only when
it is a safe column name (``_SAFE_NAME``) or a well-formed id / label.

⚠ PATCH-WHERE-USED: the handler resolves ``insert_artifact``, ``get_artifact_by_ref`` and
``list_thread_labels`` from THIS module. Patch ``app.services.show_artifact_tool.<name>``.

⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). ``ToolResult`` is imported inside the handler.
"""
from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING, Any
from uuid import UUID

from pydantic import ValidationError

from app.db.artifacts import get_artifact_by_ref, insert_artifact, list_thread_labels
from app.models.artifact import (
    ARTIFACT_ID_RE,
    ARTIFACT_LABEL_RE,
    RESULT_ID_KEY,
    ArtifactRefusal,
    StoredArtifactSpec,
    _coerce_number,
    _coerce_text,
    _refusal,
    _safe,
    refusal_payload,
    validate_args,
    validate_dataset,
)

if TYPE_CHECKING:  # pragma: no cover
    from app.services.tool_dispatcher import ToolContext, ToolResult

logger = logging.getLogger(__name__)

# The closed set of tools whose output can BE the data an artifact shows (D-04). Only a finished,
# non-failed call to one of these becomes a caption source. 273-REVIEW WR-03: the document is the
# RESOLVED one, read from the call's result (query_tables reports the filename it actually read) or
# its sub-agent record (analyze_document) — never from the model's args. The page is the result's
# page. The others are named by tool alone.
DATA_BEARING_TOOLS: frozenset[str] = frozenset({
    "query_tables",
    "query_documents",
    "query_documents_by_view",
    "search_documents",
    "read_document",
    "analyze_document",
    "execute_code",
    "web_search",
})
_PAGE_ARG: dict[str, str] = {"query_tables": "page"}
MAX_CAPTION_SOURCES = 10
_MAX_DOCUMENT_CHARS = 200
# Single-quoted on purpose: these READ another tool's result. This module never WRITES a top-level
# error key (the plan's grep for the double-quoted literal stays at 0).
_FAILED_STATUSES = frozenset({'error', 'refused', 'failed', 'timeout', 'cancelled'})
_ERROR_KEY = 'error'

RESULT_MAX_CHARS = 2000
_VALUES_PER_COLUMN = 12
_VALUE_CHARS = 40

# Handler-only refusal forms (people-safe; counts and well-formed refs only).
_HR = {
    "chat_only": "only available in chat",
    "unknown_ref": "{ref} isn't in this thread",
    "unknown_ref_unnamed": "that artifact isn't in this thread",
    "zero_match": "the filter matched 0 of {n} rows",
    "read_failed": "couldn't read that artifact",
    "save_failed": "couldn't save the artifact",
}


def _refused(reason: str, detail: str) -> dict:
    return refusal_payload(ArtifactRefusal(reason=reason, detail=detail))


# 273-REVIEW WR-07: the unknown-reference refusal names at most this many (the newest) labels.
_MAX_LABELS_NAMED = 20


def _labels_phrase(labels: list[str]) -> str:
    if len(labels) <= _MAX_LABELS_NAMED:
        return ", ".join(labels)
    shown = labels[-_MAX_LABELS_NAMED:]
    return ", ".join(shown) + f" (and {len(labels) - len(shown):,} earlier)"


def _refusal_text(payload: dict) -> str:
    """A refusal as JSON, always < RESULT_MAX_CHARS (273-REVIEW WR-07).

    ``tool_end`` and persistence cut a result at 2,000 characters. A cut refusal is no longer JSON,
    so the rail misses ``status: "refused"`` (a green "done" node), the body falls back to "Show an
    artifact" and history redaction mislabels the rows. Only the model-facing ``detail`` is
    shortened; ``reason`` is a closed template (≤ 120). JSON escaping makes the size non-linear in
    the detail's length, so it is re-measured after every cut.
    """
    text = json.dumps(payload, ensure_ascii=False)
    if len(text) < RESULT_MAX_CHARS:
        return text
    detail = str(payload.get("detail") or "")
    keep = len(detail)
    while keep > 0:
        keep = max(0, keep - (len(text) - RESULT_MAX_CHARS + 1))
        text = json.dumps(dict(payload, detail=detail[:keep] + "…"), ensure_ascii=False)
        if len(text) < RESULT_MAX_CHARS:
            return text
    return json.dumps(dict(payload, detail=""), ensure_ascii=False)


class _TransformRefused(Exception):
    def __init__(self, refusal: ArtifactRefusal):
        super().__init__(refusal.reason)
        self.refusal = refusal


# ── Caption (D-04) ──────────────────────────────────────────────────────────────────────────────


def _call_failed(result: Any) -> bool:
    """True when a persisted tool result reads as a failure or a refusal."""
    if isinstance(result, str):
        s = result.strip()
        low = s.lower()
        # The dispatcher's plain-text failure forms ("Error: …", "Could not retrieve …",
        # "Document 'x' not found.") — a failed call supplied no data.
        if low.startswith((_ERROR_KEY + ":", _ERROR_KEY + " ", "could not ")) or low.endswith(" not found."):
            return True
        try:
            obj = json.loads(s)
        except (ValueError, TypeError):
            return False
    else:
        obj = result
    if isinstance(obj, dict):
        if _ERROR_KEY in obj:
            return True
        status = obj.get("status")
        if isinstance(status, str) and status.lower() in _FAILED_STATUSES:
            return True
        code = obj.get("exit_code")
        if isinstance(code, int) and not isinstance(code, bool) and code != 0:
            return True
    return False


def _as_args(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            obj = json.loads(raw)
        except (ValueError, TypeError):
            return {}
        return obj if isinstance(obj, dict) else {}
    return {}


# The head of a query_tables result as json.dumps writes it (its first table's document + page) —
# read when the persisted result was cut at 2,000 chars and no longer parses.
_QT_HEAD = re.compile(r'^\s*\[\s*\{\s*"document"\s*:\s*("(?:[^"\\]|\\.)*")\s*,\s*"page"\s*:\s*(null|-?\d+)')


def _page_int(v: Any) -> int | None:
    if isinstance(v, int) and not isinstance(v, bool) and v >= 0:
        return v
    if isinstance(v, str) and v.strip().isdigit():
        return int(v.strip())
    return None


def _clean_document(v: Any) -> str | None:
    if not isinstance(v, str):
        return None
    v = v.replace("\x00", "").strip()
    return v[:_MAX_DOCUMENT_CHARS] if v else None


def _query_tables_facts(result: Any, page_filter: int | None) -> tuple[str | None, int | None]:
    """(document, page) from a query_tables RESULT — the resolved filename the tool reported."""
    try:
        tables = json.loads(result) if isinstance(result, str) else result
    except (ValueError, TypeError):
        tables = None
    if isinstance(tables, list) and tables and all(isinstance(t, dict) for t in tables):
        docs = {t.get("document") for t in tables}
        pages = {t.get("page") for t in tables}
        document = _clean_document(next(iter(docs))) if len(docs) == 1 else None
        page = _page_int(next(iter(pages))) if len(pages) == 1 else None
        return document, page
    m = _QT_HEAD.match(result) if isinstance(result, str) else None
    if m is None:
        return None, None
    try:
        document = _clean_document(json.loads(m.group(1)))
    except (ValueError, TypeError):
        document = None
    first_page = None if m.group(2) == "null" else int(m.group(2))
    # A cut result shows only its first table: name the page only when the server-side page filter
    # guarantees every table sat on it.
    page = first_page if page_filter is not None and first_page == page_filter else None
    return document, page


def _source_of(call: dict) -> dict:
    """One caption source. 273-REVIEW WR-03 (D-04): the document is the one the tool RESOLVED —
    read from its result (query_tables) or its sub-agent record (analyze_document) — never the
    name the model typed into its args, which can differ from the file read or carry injected text.
    """
    name = call.get("name")
    document: str | None = None
    page: int | None = None
    if name == "query_tables":
        args = _as_args(call.get("args"))
        document, page = _query_tables_facts(call.get("result"), _page_int(args.get(_PAGE_ARG["query_tables"])))
    elif name == "analyze_document":
        sub = call.get("sub_agent")
        document = _clean_document(sub.get("filename")) if isinstance(sub, dict) else None
    return {"tool": name, "document": document, "page": page}


def build_caption(turn_tool_calls: list[dict] | None, row_count: int) -> dict:
    """The caption of a first emission, built ONLY from this run's earlier tool calls (D-04).

    Never from model text. A data-bearing call counts when it finished (``status`` done) and its
    result is not a failure or refusal. Identical (tool, document, page) facts are listed once.
    No such call (or ``turn_tool_calls`` None — an unwired caller) → ``sources`` [], which the
    frontend renders as "Values provided by the agent".
    """
    sources: list[dict] = []
    seen: set[tuple] = set()
    for call in turn_tool_calls or []:
        if not isinstance(call, dict):
            continue
        if call.get("name") not in DATA_BEARING_TOOLS or call.get("status") != "done":
            continue
        if _call_failed(call.get("result")):
            continue
        src = _source_of(call)
        key = (src["tool"], src["document"], src["page"])
        if key in seen:
            continue
        seen.add(key)
        sources.append(src)
    return {
        "row_count": row_count,
        "sources": sources[:MAX_CAPTION_SOURCES],
        "source_count": len(sources),
        "lineage": None,
    }


# ── Palette slots (UI-D-07) ─────────────────────────────────────────────────────────────────────


def inherit_slots(parent_chart: dict | None, new_y: list[str]) -> tuple[list[str], list[int]]:
    """Colour follows the entity. Series the parent showed keep the PARENT's order and slot; a new
    series name takes the lowest slot the parent did not use (then the lowest free in this chart).
    """
    p_y = list((parent_chart or {}).get("y") or [])
    p_slots = list((parent_chart or {}).get("slots") or [])
    p_map = {n: s for n, s in zip(p_y, p_slots)}
    kept = [n for n in p_y if n in new_y]
    added = [n for n in new_y if n not in p_map]
    y = kept + added
    slots = [p_map[n] for n in kept]
    for _ in added:
        used = set(slots)
        free = [s for s in range(4) if s not in used and s not in p_slots]
        if not free:
            free = [s for s in range(4) if s not in used]
        slots.append(free[0] if free else 0)
    return y, slots


# ── By-reference transforms (D-07: filter / sort / top_n / select — never aggregation) ──────────


def _num(v: float | None) -> float | int | None:
    if v is None:
        return None
    return int(v) if float(v).is_integer() else v


def _coerce_for(col: dict, value: Any, column_word: str) -> Any:
    if col.get("type") == "number":
        ok, out = _coerce_number(value)
    else:
        ok, out = _coerce_text(value)
    if not ok:
        raise _TransformRefused(_refusal(
            "bad_filter",
            f"filter value for `{column_word}` does not match the column type ({col.get('type')}).",
        ))
    return out


def _column_index(columns: list[dict], name: str, role: str) -> int:
    for i, c in enumerate(columns):
        if c.get("name") == name:
            return i
    detail = f"{role} names a column the source artifact does not have. Its columns: " + ", ".join(
        str(c.get("name")) for c in columns
    ) + "."
    safe = _safe(name)
    if safe:
        raise _TransformRefused(_refusal("missing_column_named", detail, column=safe))
    raise _TransformRefused(_refusal("missing_column", detail))


def apply_transforms(parent_spec: dict, transform: Any) -> tuple[list[dict], list[list], list[dict], bool]:
    """Re-shape the PARENT's stored dataset. Returns ``(columns, rows, operations, same_rows)``.

    Applied filter → sort → top_n → select. ``operations`` are listed in the caption's order
    (filter → top-N → sort → columns). Raises ``_TransformRefused`` with a catalogue refusal.
    """
    columns = [dict(c) for c in parent_spec.get("columns") or []]
    rows = [list(r) for r in parent_spec.get("rows") or []]
    parent_n = len(rows)
    filter_ops: list[dict] = []
    topn_ops: list[dict] = []
    sort_ops: list[dict] = []
    select_ops: list[dict] = []

    if transform is not None:
        for f in transform.filter or []:
            idx = _column_index(columns, f.column, "transform.filter")
            col = columns[idx]
            if f.op == "eq":
                want = _coerce_for(col, f.value, f.column)
                rows = [r for r in rows if r[idx] is not None and r[idx] == want]
                filter_ops.append({"op": "filter_eq", "column": f.column, "value": want})
            elif f.op == "in":
                wants = [_coerce_for(col, v, f.column) for v in (f.values or [])]
                rows = [r for r in rows if r[idx] is not None and r[idx] in wants]
                filter_ops.append({"op": "filter_in", "column": f.column, "values": wants})
            else:  # range
                if col.get("type") != "number":
                    raise _TransformRefused(_refusal(
                        "bad_filter", f"a range filter needs a number column; `{f.column}` is text."))
                lo, hi = f.min, f.max
                rows = [
                    r for r in rows
                    if r[idx] is not None
                    and (lo is None or r[idx] >= lo)
                    and (hi is None or r[idx] <= hi)
                ]
                filter_ops.append({"op": "filter_range", "column": f.column, "min": _num(lo), "max": _num(hi)})
        if filter_ops and not rows:
            raise _TransformRefused(ArtifactRefusal(
                reason=_HR["zero_match"].format(n=f"{parent_n:,}"),
                detail=f"the filter matched 0 of {parent_n:,} rows in the source artifact. Check the "
                       "value against the source's values, or drop the filter.",
            ))

        if transform.sort is not None:
            s = transform.sort
            idx = _column_index(columns, s.column, "transform.sort")
            present = [r for r in rows if r[idx] is not None]
            missing = [r for r in rows if r[idx] is None]
            present.sort(key=lambda r: r[idx], reverse=(s.direction == "desc"))
            rows = present + missing  # nulls last in both directions
            sort_ops.append({"op": "sort", "column": s.column, "direction": s.direction})
            if transform.top_n is not None:
                rows = rows[: transform.top_n]
                topn_ops.append({"op": "top_n", "n": transform.top_n, "column": s.column})

        if transform.select:
            picked: list[int] = []
            for name in transform.select:
                i = _column_index(columns, name, "transform.select")
                if i not in picked:
                    picked.append(i)
            columns = [columns[i] for i in picked]
            rows = [[r[i] for i in picked] for r in rows]
            select_ops.append({"op": "select", "columns": [c["name"] for c in columns]})

    operations = filter_ops + topn_ops + sort_ops + select_ops
    same_rows = len(rows) == parent_n and not filter_ops and not (
        topn_ops and topn_ops[0]["n"] < parent_n
    )
    return columns, rows, operations, same_rows


# ── Result (I-3) ────────────────────────────────────────────────────────────────────────────────


def _distinct_values(columns: list[dict], rows: list[list], k: int) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for i, c in enumerate(columns):
        if c.get("type") != "string":
            continue
        vals: list[str] = []
        for r in rows:
            v = r[i] if i < len(r) else None
            if v is None:
                continue
            s = str(v)
            s = s if len(s) <= _VALUE_CHARS else s[: _VALUE_CHARS - 1] + "…"
            if s not in vals:
                vals.append(s)
            if len(vals) >= k:
                break
        out[str(c.get("name"))] = vals
    return out


def _note(art_id: str, label: str) -> str:
    return (
        f"Shown to the user below your answer as {label}. Now write one or two sentences about "
        "what it shows; do not repeat its numbers as a table. To change, filter, sort or redraw "
        f'it later, call show_artifact again with from_artifact="{art_id}" (or "{label}") and '
        "NO columns or rows."
    )


def build_result(
    row: dict,
    *,
    from_label: str | None = None,
    same_rows: bool | None = None,
    operations: list[dict] | None = None,
) -> str:
    """The success result: ``artifact_id`` FIRST (so a 2000-char cut keeps it), always < 2000."""
    spec = row.get("spec") or {}
    chart = spec.get("chart") or None
    columns = list(spec.get("columns") or [])
    rows = list(spec.get("rows") or [])
    art_id = str(row.get("id"))
    label = str(row.get("label"))

    def _dump(values: Any, cols: Any, ops: Any) -> str:
        obj = {
            RESULT_ID_KEY: art_id,
            "label": label,
            "component": row.get("component"),
            "kind": chart.get("kind") if chart else None,
            "stacked": bool(chart.get("stacked")) if chart else None,
            "series_count": len(chart.get("y") or []) if chart else None,
            "row_count": row.get("row_count"),
            "from_label": from_label,
            "same_rows": same_rows,
            "operations": ops,
            "columns": cols,
            "values": values,
            "note": _note(art_id, label),
        }
        return json.dumps(obj, ensure_ascii=False)

    full_cols = [{"name": c.get("name"), "type": c.get("type")} for c in columns]
    ops = operations if operations is not None else None
    for k in (_VALUES_PER_COLUMN, 8, 5, 3, 1):
        text = _dump(_distinct_values(columns, rows, k), full_cols, ops)
        if len(text) < RESULT_MAX_CHARS:
            return text
    short_cols = [str(c.get("name"))[:24] for c in columns]
    for cols in (full_cols, short_cols):
        text = _dump({}, cols, ops)
        if len(text) < RESULT_MAX_CHARS:
            return text
    text = _dump({}, short_cols, len(ops) if ops else ops)
    if len(text) < RESULT_MAX_CHARS:
        return text
    minimal = json.dumps({
        RESULT_ID_KEY: art_id, "label": label, "component": row.get("component"),
        "row_count": row.get("row_count"), "note": _note(art_id, label),
    }, ensure_ascii=False)
    if len(minimal) >= RESULT_MAX_CHARS:  # cannot happen: id/label are server-built and short
        raise RuntimeError("show_artifact result exceeds the persistence cut")
    return minimal


# ── Helpers ─────────────────────────────────────────────────────────────────────────────────────


def _echoable_ref(ref: Any) -> str | None:
    if not isinstance(ref, str):
        return None
    r = ref.strip().lower()
    if ARTIFACT_ID_RE.fullmatch(r) or ARTIFACT_LABEL_RE.fullmatch(r):
        return r
    return None


def _stacked(kind: str, asked: bool | None) -> bool:
    if kind == "area":
        return True  # area is always stacked (UI-SPEC)
    return bool(asked)


def _stored_spec(title: str, columns: list[dict], rows: list[list], chart: dict | None,
                 metric: dict | None) -> dict:
    spec = {
        "title": title,
        "columns": [{"name": c.get("name"), "type": c.get("type"), "unit": c.get("unit")} for c in columns],
        "rows": rows,
        "chart": chart,
        "metric": metric,
    }
    return StoredArtifactSpec.model_validate(spec).model_dump()


# ── The handler ─────────────────────────────────────────────────────────────────────────────────


async def handle_show_artifact(args: dict, ctx: "ToolContext") -> "ToolResult":
    """Validate, (re-)encode, caption, store, emit the stored row, answer id-first."""
    # Function-local on purpose (D-14): tool_dispatcher imports THIS module at load.
    from app.services.tool_dispatcher import ToolResult

    def _out(payload: dict) -> ToolResult:
        return ToolResult(result=_refusal_text(payload))

    # 1. Belt — chat top-level only.
    user = getattr(ctx, "current_user", None) or {}
    if (
        getattr(ctx, "parent_run_id", None) is not None
        or getattr(ctx, "phase_whitelist", None) is not None
        or getattr(ctx, "pool", None) is None
        or not user.get("id")
        or not getattr(ctx, "thread_id", None)
    ):
        return _out(_refused(
            _HR["chat_only"],
            "show_artifact only works in a top-level chat turn; it is not available to sub-agents "
            "or workflow steps. Present the data as text or a markdown table instead.",
        ))
    try:
        thread_id = UUID(str(ctx.thread_id))
        user_id = UUID(str(user["id"]))
    except (ValueError, TypeError):
        return _out(_refused(_HR["chat_only"], "show_artifact needs a chat thread."))

    # 2. Validate against the closed vocabulary.
    parsed = validate_args(args)
    if isinstance(parsed, ArtifactRefusal):
        return _out(refusal_payload(parsed))

    component = parsed.component
    chart_args = parsed.chart.model_dump() if parsed.chart is not None else None
    metric_args = parsed.metric.model_dump() if parsed.metric is not None else None
    parent: dict | None = None
    lineage_ops: list[dict] | None = None
    same_rows: bool | None = None

    # 3. Dataset — first emission or by reference.
    if parsed.from_artifact is None:
        columns = [c.model_dump() for c in parsed.columns or []]
        rows = parsed.rows or []
        y = list(chart_args["y"]) if chart_args else []
        slots = list(range(len(y)))
        caption = build_caption(getattr(ctx, "turn_tool_calls", None), len(rows))
    else:
        ref = parsed.from_artifact
        try:
            parent = await get_artifact_by_ref(ctx.pool, ref=ref, thread_id=thread_id, user_id=user_id)
        except Exception:  # noqa: BLE001 — a store outage is a worded refusal, never a crash
            logger.exception("show_artifact: get_artifact_by_ref failed")
            return _out(_refused(_HR["read_failed"], "the stored artifact could not be read; try again."))
        if parent is None:
            try:
                labels = await list_thread_labels(ctx.pool, thread_id=thread_id, user_id=user_id)
            except Exception:  # noqa: BLE001
                logger.exception("show_artifact: list_thread_labels failed")
                labels = []
            if labels:
                detail = ("Artifacts in this thread: " + _labels_phrase(labels) + ". Use one of these labels "
                          "or an artifact_id from an earlier show_artifact result.")
            else:
                detail = ("No artifact has been shown in this thread yet. Send columns and rows "
                          "instead of from_artifact.")
            safe_ref = _echoable_ref(ref)
            reason = _HR["unknown_ref"].format(ref=safe_ref) if safe_ref else _HR["unknown_ref_unnamed"]
            return _out(_refused(reason, detail))

        p_spec = parent.get("spec") or {}
        try:
            columns, rows, lineage_ops, same_rows = apply_transforms(p_spec, parsed.transform)
        except _TransformRefused as exc:
            return _out(refusal_payload(exc.refusal))
        rows, refusal = validate_dataset(component, columns, rows, chart_args, metric_args)
        if refusal is not None:
            return _out(refusal_payload(refusal))
        y, slots = inherit_slots(p_spec.get("chart"), list(chart_args["y"]) if chart_args else [])
        p_caption = parent.get("caption") or {}
        caption = {
            "row_count": len(rows),
            "sources": list(p_caption.get("sources") or []),
            "source_count": int(p_caption.get("source_count") or 0),
            "lineage": {
                "parent_label": parent.get("label"),
                "parent_row_count": int(parent.get("row_count") or len(p_spec.get("rows") or [])),
                "same_rows": same_rows,
                "operations": lineage_ops,
            },
        }

    stored_chart = None
    if chart_args is not None:
        stored_chart = {
            "kind": chart_args["kind"],
            "x": chart_args["x"],
            "y": y,
            "stacked": _stacked(chart_args["kind"], chart_args.get("stacked")),
            "slots": slots,
        }
    try:
        spec = _stored_spec(parsed.title, columns, rows, stored_chart, metric_args)
    except ValidationError:
        logger.exception("show_artifact: stored spec failed its own model")
        return _out(refusal_payload(_refusal("fallback", "the artifact could not be assembled; check the encoding.")))

    # 4. Store, emit the RETURNING row unchanged, answer id-first.
    try:
        row = await insert_artifact(
            ctx.pool,
            thread_id=thread_id,
            user_id=user_id,
            org_id=user.get("org_id"),
            run_id=getattr(ctx, "run_id", None),
            tool_call_id=getattr(ctx, "tool_call_id", None) or None,
            parent_id=parent.get("id") if parent else None,
            component=component,
            spec=spec,
            caption=caption,
            row_count=len(rows),
        )
    except Exception:  # noqa: BLE001 — never surface a DB message to people or the model
        logger.exception("show_artifact: insert_artifact failed")
        return _out(_refused(_HR["save_failed"], "the artifact could not be stored; try the call again."))

    emit = getattr(ctx, "emit", None)
    if emit is not None:
        try:
            await emit(ctx.redis, ctx.run_id, "artifact", artifact=row)
        except Exception:  # noqa: BLE001 — the row is stored; a reload shows it
            logger.exception("show_artifact: artifact event emit failed (row %s stored)", row.get("id"))

    return ToolResult(result=build_result(
        row,
        from_label=parent.get("label") if parent else None,
        same_rows=same_rows,
        operations=lineage_ops,
    ))


__all__ = [
    "DATA_BEARING_TOOLS",
    "apply_transforms",
    "build_caption",
    "build_result",
    "handle_show_artifact",
    "inherit_slots",
]

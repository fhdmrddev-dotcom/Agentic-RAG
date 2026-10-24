"""The closed vocabulary of agent-authored artifacts (Phase 273 — ART-01..05, D-02/D-05/D-07/D-09;
Phase 292 — VIS-02, D-01..D-08, D-14, D-20).

``show_artifact`` lets the agent put an interactive chart, table, single metric, flow diagram,
comparison or timeline under its answer. Everything the model may say to that tool is declared HERE,
and nothing outside it renders.

I-1 — THE COMPONENT SET IS CLOSED. Unlike ``harness.py``'s Literals, which grow additively,
``ComponentName`` is a product boundary: ``chart | table | metric`` (273) plus ``diagram |
comparison | timeline`` (292, chosen at the sketch; ``steps``, mind maps, images, maps and HTML were
rejected there). It is fenced three ways, and all three must move together or not at all:

  * ``supabase/migrations/213_message_artifacts_more_components.sql`` — the ``component IN (…)``
    CHECK (``test_292_migration_213_shape`` asserts literal-set equality with ``ARTIFACT_COMPONENTS``;
    202 created it with the first three);
  * the frontend registry (``components/chat/artifacts``, fenced by 273-02 against this file);
  * this Literal, from which ``ARTIFACT_COMPONENTS`` is DERIVED with ``get_args`` — never retyped.

⛔ Adding a component is a CODE change (a renderer, a migration, a model). It is never a prompt, a
setting, a row or a model-supplied ``props`` bag. There is no open dict field anywhere below; every
model sets ``extra="forbid"`` (T-273-01).

Refusals (L-4 / UI-SPEC "Notice reason catalogue"). A refusal carries two strings:
  * ``reason`` — shown to PEOPLE in the rail. Built ONLY from the closed templates in ``_R``, counts,
    and names that pass ``_SAFE_NAME`` (truncated at 40). A model string outside ``KIND_ALIASES`` is
    never echoed (T-273-07): ``"pie"`` may be named, ``"sunburst"`` becomes "a chart kind we can't draw".
  * ``detail`` — sent back to the MODEL so it can fix the call. Never rendered.
The payload has no ``error`` key, because ``ToolResultBlock`` prints ``parsed.error`` verbatim.

Nothing is truncated (D-09): too many rows, series, columns or bytes is a refusal with a reason.

This module imports pydantic and the standard library only — no DB, no provider, no dispatcher.
"""

from __future__ import annotations

import datetime
import json
import math
import re
from dataclasses import dataclass
from typing import Annotated, Any, ClassVar, Literal, Union, get_args

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    TypeAdapter,
    ValidationError,
    field_validator,
    model_validator,
)
from pydantic_core import PydanticCustomError

# ── The closed vocabulary (I-1) ─────────────────────────────────────────────────────────────────

# ⛔ Every Literal below stays ONE FLAT Literal: the frontend parity fence reads them from this source
# with /^Name\s*=\s*Literal\[([^\]]*)\]/ — a Union of Literals would read as zero names.
ComponentName = Literal["chart", "table", "metric", "diagram", "comparison", "timeline"]
# D-08: the by-reference set. Only these are re-encoded with from_artifact / transform.
TabularComponent = Literal["chart", "table", "metric"]
ChartKind = Literal["line", "bar", "area", "scatter"]
ColumnType = Literal["number", "string"]
FilterOpName = Literal["eq", "in", "range"]
SortDirection = Literal["asc", "desc"]
# UI-D-292-04: the four shapes the approved sketch draws. No ``actor`` (lanes lost at 2B).
NodeKind = Literal["start", "step", "decision", "end"]
# D-05 / UI-D-292-10: favourable / unfavourable / neutral or partly / not stated in what was retrieved.
Verdict = Literal["y", "n", "m", "q"]

ARTIFACT_COMPONENTS: tuple[str, ...] = get_args(ComponentName)
TABULAR_COMPONENTS: tuple[str, ...] = get_args(TabularComponent)
CHART_KINDS: tuple[str, ...] = get_args(ChartKind)
COLUMN_TYPES: tuple[str, ...] = get_args(ColumnType)
FILTER_OPS: tuple[str, ...] = get_args(FilterOpName)
NODE_KINDS: tuple[str, ...] = get_args(NodeKind)
VERDICTS: tuple[str, ...] = get_args(Verdict)
# The three typed-encoding arms (D-03), in vocabulary order — derived, never retyped.
ENCODED_COMPONENTS: tuple[str, ...] = tuple(c for c in ARTIFACT_COMPONENTS if c not in TABULAR_COMPONENTS)

# ── Caps (D-05 / D-09 / UI-D-01). Each is refused above, never truncated. ──────────────────────

MAX_ROWS = 500
MAX_COLUMNS = 20
MAX_SERIES: dict[str, int] = {"line": 4, "bar": 4, "area": 4, "scatter": 3}
MAX_SPEC_BYTES = 262144  # == migration 202's octet_length CHECK (shape-tested)
MAX_CELL_CHARS = 200
MAX_TITLE_CHARS = 120
MAX_COLUMN_NAME_CHARS = 64
MAX_UNIT_CHARS = 16
MAX_REASON_CHARS = 120
# The dataset is measured against the cap minus a reserve for the title, the encoding and the
# server-built slots, so a spec the model layer accepts can never trip the DB CHECK belt. Measured
# with json.dumps' default ", " / ": " separators, which is how jsonb::text prints.
_SPEC_RESERVE_BYTES = 4096

# Phase 292 caps (D-04..D-06, UI-D-292-24). Module-level ints with these exact names: 292-03's
# cross-stack fence reads them from this source and compares them with the frontend guard's.
# Every string cap counts UTF-16 units (``_js_len``), as the browser does.
MIN_NODES = 2
MAX_NODES = 25
MIN_EDGES = 1
MAX_EDGES = 40
MIN_OPTIONS = 2
MAX_OPTIONS = 5
MAX_TERMS = 20
MAX_EVENTS = 40
MAX_NODE_LABEL_CHARS = 48
MAX_EDGE_LABEL_CHARS = 24
MAX_OPTION_CHARS = 40
MAX_TERM_CHARS = 60
MAX_EVENT_TITLE_CHARS = 80
MAX_EVENT_DETAIL_CHARS = 200
MAX_CATEGORY_CHARS = 24
MAX_EXCERPT_CHARS = 280
MAX_SOURCE_DOCUMENT_CHARS = 200  # UTF-16 units; clean_document_name applies it to the caption AND to every source

NODE_ID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,40}$")

# Kinds people ask for that we cannot draw. Only these may be NAMED in a reason (UI-SPEC).
KIND_ALIASES: tuple[str, ...] = (
    "pie", "donut", "radar", "heatmap", "histogram", "treemap", "funnel", "gauge",
)

# UI-D-292-21: component words people ask for that are not one of the six. Matched trimmed and
# case-insensitive; the VALUE (a closed key, never the model's raw string) is what a reason names.
# ⛔ flowchart, graph and gantt_chart are deliberately NOT here: "a flowchart isn't a type we can
# show" would be false while we draw flow diagrams, so they fall to the generic sentence.
COMPONENT_ALIASES: dict[str, str] = {
    "mindmap": "mindmap", "mind_map": "mind_map", "gantt": "gantt", "sankey": "sankey", "map": "map",
    "image": "image", "html": "html", "code": "code", "kanban": "kanban", "steps": "steps",
    "pie": "pie", "donut": "donut",
}

# ── Result contract (I-3) ───────────────────────────────────────────────────────────────────────

RESULT_ID_KEY = "artifact_id"
REFUSED_STATUS = "refused"
# The success result's key order (273-03 builds it; FIRST key is the id so a 2000-char cut keeps it).
RESULT_KEY_ORDER: tuple[str, ...] = (
    "artifact_id", "label", "component", "kind", "stacked", "series_count", "row_count",
    # 292: edge_count (diagram only) and option_count (comparison only); row_count is then the
    # nodes / terms / events count (UI-D-292-19: the rail reads these plain result facts).
    "edge_count", "option_count",
    "from_label", "same_rows", "operations", "columns", "values", "note",
)
# History placeholders (I-4). 273-04's redact_artifact_args builds its strings from THESE constants,
# and this module refuses a call that echoes one back — so the two can never drift.
ROWS_PLACEHOLDER_STORED = "<stored in artifact "
ROWS_PLACEHOLDER_NOT_STORED = "<not stored"

ARTIFACT_ID_RE = re.compile(r"^a_[0-9a-z]{10}$")
# D-13: derived from the six, so `diagram 3` / `comparison 1` / `timeline 2` are labels too.
ARTIFACT_LABEL_RE = re.compile(r"^(" + "|".join(ARTIFACT_COMPONENTS) + r") [1-9][0-9]*$")
_SAFE_NAME = re.compile(r"^[\w .-]{1,64}$")
_STRICT_NUMBER = re.compile(r"^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$")
_STORED_ID = re.compile(r"^<stored in artifact (a_[0-9a-z]{10})(?=[,> ])")

# Every key an ArtifactRecord (the message_artifacts row as JSON) carries — the wire contract.
ARTIFACT_RECORD_KEYS: frozenset[str] = frozenset({
    "id", "thread_id", "user_id", "org_id", "run_id", "tool_call_id", "parent_id", "label",
    "component", "spec", "caption", "row_count", "spec_version", "created_at",
})

# ── The refusal catalogue (people-safe short forms; the rail renders them verbatim) ─────────────

_R = {
    "unknown_component": "something other than a chart, table, metric, diagram, comparison or timeline",
    # ── Phase 292 (UI-SPEC "Rail refusal reasons, additions"; exact wording) ──
    "component_alias": '"{alias}" is not an artifact type',
    "too_many_nodes": "{n} steps (max 25); group related steps first",
    "too_few_nodes": "a diagram needs at least 2 steps",
    "too_many_edges": "{n} links (max 40); group related steps first",
    "no_edges": "a diagram needs at least 1 link",
    "unknown_node": "a link names a step that isn't in it ({id})",
    "duplicate_node": "two steps share an id",
    "duplicate_edge": "two links join the same two steps",
    "self_loop_unlabelled": "a step links to itself without a label",
    "node_label_too_long": "a step name is over 48 characters",
    "edge_label_too_long": "a link label is over 24 characters",
    "option_count": "{n} options (2 to 5)",
    "too_many_terms": "{n} terms (max 20)",
    "ragged_term": "term {i} has {got} cells for {n} options",
    "option_too_long": "an option name is over 40 characters",
    "term_too_long": "a term name is over 60 characters",
    "too_many_events": "{n} events (max 40)",
    "bad_date": "event {i} has a date that isn't YYYY-MM-DD or YYYY-MM",
    "event_text_too_long": "{what} is over {cap} characters",  # {what}: "an event title" | "an event detail" | "a category"
    "unresolved_source": "a source it cites wasn't retrieved in this turn",
    "reference_new_type": "{label} can't be redrawn by reference; send the data again",
    "reference_into_new_type": "a {source_noun} can't be turned into a {target_noun}; send the data again",
    # Discretion additions (292-01, same tone): counts, closed nouns and closed item words only.
    "no_items": "it has no {items} to show",
    "duplicate_option": "two options share a name",
    "cell_text_too_long": "a cell's text is over 200 characters",
    "placeholder_encoded_stored": "it sent a reference to a shown artifact, not its data",
    "placeholder_encoded_not_stored": "it sent a placeholder from a refused call, not data",
    "foreign_fields": "a {noun} was sent another artifact type's fields",
    # ── Phase 273 ──
    "kind_alias": '"{alias}" is not a chart kind',
    "kind_unknown": "a chart kind we can't draw",
    "too_many_rows": "{n} rows (max 500); aggregate first",
    "no_rows": "no rows to show",
    "no_columns": "it has no columns",
    "too_many_columns": "{n} columns (max 20)",
    "too_large": "{kib} KiB of data (max 256 KiB); aggregate first",
    "too_many_series": "{n} series (max {cap})",
    "ragged_row": "row {i} has {got} values for {n} columns",
    "duplicate_column": "two columns share a name",
    "not_a_number": "a value in {column} isn't a bare number",
    "not_text": "a value in {column} isn't text",
    "cell_too_long": "a value in {column} is over 200 characters",
    "missing_column_named": "{column} isn't one of its columns",
    "missing_column": "it names a column it doesn't have",
    "series_not_number": "{column} isn't a number column",
    "metric_one_row": "a metric needs exactly one row",
    "placeholder_stored": "rows were a reference to a shown artifact, not data",
    "placeholder_not_stored": "rows were a placeholder from a refused call, not data",
    "both_reference_and_rows": "it sent new rows and a reference at once",
    "transform_without_reference": "it asked to change an artifact without naming one",
    "top_n_without_sort": "a top-N needs a sort order",
    "bad_filter": "a filter we can't apply",
    "title_too_long": "the title is over 120 characters",
    "number_too_large": "a value in {column} is too large to show",
    "fallback": "its settings weren't valid",
}

_BARE_NUMBERS = "pass bare numbers; put units in `unit`"


@dataclass(frozen=True)
class ArtifactRefusal:
    """A refused ``show_artifact`` call. ``reason`` is for people; ``detail`` is for the model."""

    reason: str
    detail: str


def refusal_payload(r: ArtifactRefusal) -> dict[str, str]:
    """The tool-result object for a refusal. Keys are exactly status / reason / detail (L-4)."""
    return {"status": REFUSED_STATUS, "reason": r.reason, "detail": r.detail}


def _refusal(key: str, detail: str, **fmt: Any) -> ArtifactRefusal:
    reason = _R[key].format(**fmt)
    if len(reason) > MAX_REASON_CHARS:  # cannot happen with safe names ≤ 40; belt only
        reason = _R["fallback"]
    return ArtifactRefusal(reason=reason, detail=detail)


def _raise(key: str, detail: str, **fmt: Any) -> None:
    r = _refusal(key, detail, **fmt)
    raise PydanticCustomError("artifact_refusal", "{reason}", {"reason": r.reason, "detail": r.detail})


def _safe(name: Any) -> str | None:
    """A model-supplied name, only if it is safe to put in a people-facing reason (≤ 40 shown)."""
    if isinstance(name, str) and _SAFE_NAME.fullmatch(name):
        return name if len(name) <= 40 else name[:39] + "…"
    return None


def _col_word(name: Any) -> str:
    return _safe(name) or "a column"


def _js_len(s: str) -> int:
    """A string's length as JavaScript's ``.length`` counts it — UTF-16 code units (273 CR-01).

    Every length cap here must agree with the frontend guard (``artifactSpec.ts`` ``isStr``), which
    counts UTF-16 units: an emoji is 1 for Python's ``len`` and 2 for the browser. ``surrogatepass``
    keeps a lone surrogate countable instead of raising.
    """
    return len(s.encode("utf-16-le", "surrogatepass")) // 2


# JavaScript's String.prototype.trim set (ECMA-262 WhiteSpace + LineTerminator): TAB, VT, FF, SP,
# NBSP, U+FEFF, every Zs, LF, CR, LS, PS. Python's str.strip() does NOT remove U+FEFF, so a "﻿"
# label passed here while the guard's isText refused it (292-REVIEW CR-01).
_JS_TRIM = (
    "\t\n\v\f\r              "
    "    　﻿"
)


def _is_blank(v: str) -> bool:
    """Blank by EITHER rule (Python's strip and the browser's trim), so neither side keeps it."""
    return not v.strip() or not v.strip(_JS_TRIM)


def clean_document_name(v: Any) -> str | None:
    """A citation's document name as it is stored (292-REVIEW CR-01 / IN-04 — the ONE home).

    NUL stripped, trimmed, then cut to ``MAX_SOURCE_DOCUMENT_CHARS`` UTF-16 units (the browser's
    count), never between the two halves of a surrogate pair, with no ellipsis. Both the caption
    (``show_artifact_tool``) and the per-element source (``artifact_sources``) call this.
    """
    if not isinstance(v, str):
        return None
    v = v.replace("\x00", "").strip()
    if not v:
        return None
    if _js_len(v) <= MAX_SOURCE_DOCUMENT_CHARS:
        return v
    out: list[str] = []
    units = 0
    for ch in v:
        u = _js_len(ch)
        if units + u > MAX_SOURCE_DOCUMENT_CHARS:
            break
        out.append(ch)
        units += u
    return "".join(out).rstrip() or None


def _check_js_len(v: Any, cap: int, field_name: str) -> Any:
    if isinstance(v, str) and _js_len(v) > cap:
        _raise("fallback", f"`{field_name}` must be at most {cap} characters (an emoji counts as 2).")
    return v


def _decode_once(v: Any, field_name: str) -> Any:
    """BUG-260529-01: weak models send nested args as JSON strings. Decode once, never twice."""
    if not isinstance(v, str):
        return v
    try:
        return json.loads(v)
    except (ValueError, TypeError):
        _raise("fallback", f"`{field_name}` must be JSON, not a free-text string.")


def _check_placeholder(v: Any) -> None:
    """A model copying 273-04's redacted history args back must be told how to refer instead."""
    probes = [v] if isinstance(v, str) else []
    if isinstance(v, list):
        probes = [c for c in v if isinstance(c, str)]
    for s in probes:
        if s.startswith(ROWS_PLACEHOLDER_STORED):
            m = _STORED_ID.match(s)
            ref = f'from_artifact="{m.group(1)}"' if m else "from_artifact=<the artifact's id or label>"
            _raise(
                "placeholder_stored",
                f"`rows` was the history placeholder of an artifact already shown, not data. To redraw "
                f"or filter it, call again with {ref} and NO columns or rows.",
            )
        if s.startswith(ROWS_PLACEHOLDER_NOT_STORED):
            _raise(
                "placeholder_not_stored",
                "`rows` was the history placeholder of an earlier call that was refused, so nothing was "
                "stored. Re-send the data as bare rows (max 500; aggregate first if you have more).",
            )


# ── Models ──────────────────────────────────────────────────────────────────────────────────────


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


Cell = Union[str, float, int, None]


class Column(_Strict):
    name: str = Field(min_length=1, max_length=MAX_COLUMN_NAME_CHARS)
    type: ColumnType
    unit: str | None = Field(default=None, max_length=MAX_UNIT_CHARS)

    @field_validator("name")
    @classmethod
    def _name_js_len(cls, v: str) -> str:
        return _check_js_len(v, MAX_COLUMN_NAME_CHARS, "columns[].name")

    @field_validator("unit")
    @classmethod
    def _unit_js_len(cls, v: str | None) -> str | None:
        return _check_js_len(v, MAX_UNIT_CHARS, "columns[].unit")


class ChartEnc(_Strict):
    kind: ChartKind
    x: str = Field(min_length=1, max_length=MAX_COLUMN_NAME_CHARS)
    y: list[str] = Field(min_length=1)
    stacked: bool | None = None

    @field_validator("kind", mode="before")
    @classmethod
    def _kind_lower(cls, v: Any) -> Any:
        return v.strip().lower() if isinstance(v, str) else v


class MetricEnc(_Strict):
    value_column: str = Field(min_length=1, max_length=MAX_COLUMN_NAME_CHARS)
    compare_column: str | None = Field(default=None, max_length=MAX_COLUMN_NAME_CHARS)
    label: str | None = Field(default=None, max_length=64)
    compare_label: str | None = Field(default=None, max_length=64)

    @field_validator("label", "compare_label")
    @classmethod
    def _labels_js_len(cls, v: str | None, info) -> str | None:
        return _check_js_len(v, 64, f"metric.{info.field_name}")


class FilterOp(_Strict):
    column: str = Field(min_length=1, max_length=MAX_COLUMN_NAME_CHARS)
    op: FilterOpName
    value: Cell = None
    values: list[Cell] | None = None
    # Finite only (273 CR-01): an infinite bound is echoed into the caption's operations and
    # Postgres jsonb rejects Infinity, which read to the model as "couldn't save, try again".
    min: float | None = Field(default=None, allow_inf_nan=False)
    max: float | None = Field(default=None, allow_inf_nan=False)

    @model_validator(mode="after")
    def _op_has_its_operand(self) -> "FilterOp":
        if self.op == "eq" and self.value is None:
            _raise("bad_filter", f"filter on `{self.column}` with op eq needs `value`.")
        if self.op == "in" and not self.values:
            _raise("bad_filter", f"filter on `{self.column}` with op in needs a non-empty `values` list.")
        if self.op == "range" and self.min is None and self.max is None:
            _raise("bad_filter", f"filter on `{self.column}` with op range needs `min` and/or `max`.")
        return self


class SortSpec(_Strict):
    column: str = Field(min_length=1, max_length=MAX_COLUMN_NAME_CHARS)
    direction: SortDirection


class Transform(_Strict):
    """D-07: filter (eq / in / range), select, sort, top_n. There is NO aggregation."""

    filter: list[FilterOp] | None = None
    select: list[str] | None = None
    sort: SortSpec | None = None
    top_n: int | None = Field(default=None, ge=1, le=MAX_ROWS)

    @model_validator(mode="after")
    def _top_n_needs_sort(self) -> "Transform":
        if self.top_n is not None and self.sort is None:
            _raise("top_n_without_sort", "transform.top_n requires transform.sort (which column, asc|desc).")
        return self

    def is_empty(self) -> bool:
        return not self.filter and not self.select and self.sort is None and self.top_n is None


class _ArgsBase(_Strict):
    title: str = Field(min_length=1)
    from_artifact: str | None = Field(default=None, max_length=64)
    columns: list[Column] | None = None
    rows: list[list[Cell]] | None = None
    transform: Transform | None = None

    @field_validator("title", mode="before")
    @classmethod
    def _title_len(cls, v: Any) -> Any:
        if isinstance(v, str) and _js_len(v.strip()) > MAX_TITLE_CHARS:  # UTF-16, as the browser counts
            _raise("title_too_long", f"`title` must be at most {MAX_TITLE_CHARS} characters.")
        return v.strip() if isinstance(v, str) else v

    @field_validator("from_artifact", mode="before")
    @classmethod
    def _blank_reference_is_none(cls, v: Any) -> Any:
        return None if isinstance(v, str) and not v.strip() else (v.strip() if isinstance(v, str) else v)

    @field_validator("rows", mode="before")
    @classmethod
    def _rows_before(cls, v: Any, info) -> Any:
        _check_placeholder(v)  # BEFORE the decode: a placeholder is never JSON-decoded
        v = _decode_once(v, "rows")
        _check_placeholder(v)
        if v is None:
            return v
        if not isinstance(v, list):
            _raise("fallback", "`rows` must be an array of arrays of cells.")
        cols = info.data.get("columns") or []  # validated first: declared above `rows`
        for i, row in enumerate(v):
            if not isinstance(row, list):
                _raise("fallback", f"rows[{i}] must be an array of cells, one per column.")
            for j, cell in enumerate(row):
                # bool is an int in Python and a lax float in pydantic — refuse it before either sees it.
                if isinstance(cell, (bool, dict, list)):
                    col = cols[j] if j < len(cols) else None
                    cname = col.name if col is not None else None
                    if col is not None and col.type == "number":
                        _raise("not_a_number",
                               f"column `{cname}` rows[{i}] is not a bare number: {_BARE_NUMBERS}.",
                               column=_col_word(cname))
                    _raise("not_text", f"column `{cname}` rows[{i}] must be text or null.",
                           column=_col_word(cname))
        return v

    @field_validator("columns", "transform", "chart", "metric", "diagram", "comparison", "timeline",
                     mode="before", check_fields=False)
    @classmethod
    def _decode_nested(cls, v: Any, info) -> Any:
        return _decode_once(v, info.field_name)

    @model_validator(mode="after")
    def _dataset_or_reference(self) -> "_ArgsBase":
        if self.transform is not None and self.transform.is_empty():
            self.transform = None
        has_data = bool(self.columns) or bool(self.rows)
        if self.from_artifact is not None:
            if has_data:
                _raise(
                    "both_reference_and_rows",
                    "pass from_artifact OR rows, not both. To change an artifact already shown, send "
                    "from_artifact with NO columns or rows; to show new data, omit from_artifact.",
                )
            return self  # the dataset is the parent's; 273-03 validates it after the transforms
        if self.transform is not None:
            _raise(
                "transform_without_reference",
                "`transform` applies only to an artifact already shown: set from_artifact=<its id or "
                "label> and send no rows. For new data, send the rows already filtered.",
            )
        if not self.rows:
            _raise("no_rows", "send `columns` and at least one row in `rows`.")
        if not self.columns:
            _raise("no_columns", "send `columns`: [{name, type: number|string, unit?}], one per cell in a row.")
        enc_chart = getattr(self, "chart", None)
        enc_metric = getattr(self, "metric", None)
        rows, refusal = validate_dataset(
            self.component,  # type: ignore[attr-defined]
            [c.model_dump() for c in self.columns],
            self.rows,
            enc_chart.model_dump() if enc_chart is not None else None,
            enc_metric.model_dump() if enc_metric is not None else None,
        )
        if refusal is not None:
            raise PydanticCustomError(
                "artifact_refusal", "{reason}", {"reason": refusal.reason, "detail": refusal.detail}
            )
        self.rows = rows
        return self


# 292 Pitfall 1: OpenAI Responses null-fills every optional key, so a chart call arrives carrying
# "diagram": null, "comparison": null, "timeline": null. The tabular arms accept exactly that (null)
# and nothing else; a non-null new encoding on a tabular call is refused.


class ChartArgs(_ArgsBase):
    component: Literal["chart"]
    chart: ChartEnc
    metric: None = None
    diagram: None = None
    comparison: None = None
    timeline: None = None


class TableArgs(_ArgsBase):
    component: Literal["table"]
    chart: None = None
    metric: None = None
    diagram: None = None
    comparison: None = None
    timeline: None = None


class MetricArgs(_ArgsBase):
    component: Literal["metric"]
    metric: MetricEnc
    chart: None = None
    diagram: None = None
    comparison: None = None
    timeline: None = None


# ── The three typed-encoding arms (Phase 292, D-03..D-08) ───────────────────────────────────────
#
# Each new type carries its OWN nested encoding, never the columns/rows dataset (D-03): node kinds
# and cell verdicts would not survive tabular rows. Every model is extra="forbid"; there is no
# coordinate, SVG, Mermaid, "today", document, page or excerpt field anywhere (D-04, D-06, D-07).
# A `source` is only the [n] number of a citation retrieved this turn; the handler resolves it.

_ITEM_WORD: dict[str, str] = {"diagram": "steps", "comparison": "terms", "timeline": "events"}
# ⚠ [0-9], never \d: in a Python str pattern \d matches EVERY Unicode decimal digit and int() parses
# them, while JavaScript's \d is ASCII only — "٢٠٢٤-01-15" passed here and failed the guard
# (292-REVIEW CR-01).
_DATE_RE = re.compile(r"^([0-9]{4})-(0[1-9]|1[0-2])(?:-([0-9]{2}))?$")
_SOURCE_STR = re.compile(r"^(?:\[\s*([0-9]{1,9})\s*\]|([0-9]{1,9}))$")
_SOURCE_DETAIL = (
    "must be the [n] number of a source retrieved in this turn (e.g. 3 or \"[3]\"), or omitted. "
    "Never true/false, 0, a document name or text."
)


def parse_source_handle(v: Any) -> int | None:
    """A ``source`` handle as the citation number it names, or None. Raises ``ValueError``.

    Accepts an int >= 1, an integral float (Gemini sends JSON integers as floats), a digit string or
    ``"[n]"``. ⛔ A bool is refused FIRST: pydantic's lax int turns ``True`` into ``1``, which would
    silently cite source 1 (RESEARCH Pitfall 3).
    """
    if v is None:
        return None
    if isinstance(v, bool):
        raise ValueError("a source handle is a citation number, not true/false")
    if isinstance(v, int):
        n = v
    elif isinstance(v, float) and math.isfinite(v) and v.is_integer():
        n = int(v)
    elif isinstance(v, str):
        m = _SOURCE_STR.fullmatch(v.strip())
        if m is None:
            raise ValueError("a source handle is a citation number")
        n = int(m.group(1) or m.group(2))
    else:
        raise ValueError("a source handle is a citation number")
    if n < 1:
        raise ValueError("a source handle is 1 or more")
    return n


def _source_rule(v: Any, where: str) -> int | None:
    try:
        return parse_source_handle(v)
    except ValueError:
        _raise("fallback", f"`{where}.source` {_SOURCE_DETAIL}")
    return None  # unreachable; _raise always raises


def _req_text(v: Any, limit: int, key: str, where: str, **fmt: Any) -> str:
    if not isinstance(v, str) or _is_blank(v):
        _raise("fallback", f"`{where}` must be non-empty text.")
    if _js_len(v) > limit:
        _raise(key, f"`{where}` must be at most {limit} characters (an emoji counts as 2).", **fmt)
    return v


def _opt_text(v: Any, limit: int, key: str, where: str, **fmt: Any) -> str | None:
    """An optional string: absent or blank → None; over its cap → the worded refusal ``key``."""
    if v is None:
        return None
    if not isinstance(v, str):
        _raise("fallback", f"`{where}` must be text or null.")
    if _is_blank(v):
        return None
    if _js_len(v) > limit:
        _raise(key, f"`{where}` must be at most {limit} characters (an emoji counts as 2).", **fmt)
    return v


def _decode_list(v: Any, where: str) -> Any:
    """Decode a stringified list ONCE (Pitfall 5: coerce-tier models stringify inner levels too)."""
    v = _decode_once(v, where)
    if v is not None and not isinstance(v, list):
        _raise("fallback", f"`{where}` must be an array.")
    return v


def is_event_date(v: Any) -> bool:
    """True for ``YYYY-MM`` or ``YYYY-MM-DD`` naming a real calendar day (D-06)."""
    if not isinstance(v, str):
        return False
    m = _DATE_RE.fullmatch(v)
    if m is None:
        return False
    if m.group(3) is None:
        return True
    try:
        datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return False
    return True


def event_sort_key(date: str) -> tuple[int, int, int]:
    """(year, month, day or 0): ``2024-02`` sorts before ``2024-02-09`` (D-06, RESEARCH Pattern 4)."""
    m = _DATE_RE.fullmatch(date)
    if m is None:  # only ever called on validated dates
        raise ValueError(f"not an event date: {date!r}")
    return int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)


class DiagramNode(_Strict):
    id: str
    label: str
    kind: NodeKind = "step"
    source: int | None = None

    @field_validator("id", mode="before")
    @classmethod
    def _id_rule(cls, v: Any) -> Any:
        if not isinstance(v, str) or not NODE_ID_RE.fullmatch(v):
            _raise("fallback", "each `diagram.nodes[].id` must be 1-40 letters, digits, `_`, `.` or `-` (no "
                               "spaces), unique within the diagram.")
        return v

    @field_validator("label", mode="before")
    @classmethod
    def _label_rule(cls, v: Any) -> Any:
        return _req_text(v, MAX_NODE_LABEL_CHARS, "node_label_too_long", "diagram.nodes[].label")

    @field_validator("kind", mode="before")
    @classmethod
    def _kind_rule(cls, v: Any) -> Any:
        if v is None:
            return "step"
        word = v.strip().lower() if isinstance(v, str) else None
        if word not in NODE_KINDS:
            _raise("fallback", "`diagram.nodes[].kind` must be one of " + ", ".join(NODE_KINDS)
                   + " (omit it for a plain step).")
        return word

    @field_validator("source", mode="before")
    @classmethod
    def _source(cls, v: Any) -> Any:
        return _source_rule(v, "diagram.nodes[]")


class DiagramEdge(_Strict):
    # The model's key is "from". ⛔ No populate_by_name: it would accept "from_" as input too.
    from_: str = Field(alias="from")
    to: str
    label: str | None = None

    @field_validator("from_", "to", mode="before")
    @classmethod
    def _end_rule(cls, v: Any) -> Any:
        if not isinstance(v, str) or not v:
            _raise("fallback", "each `diagram.edges[]` needs `from` and `to`, each a node id.")
        return v

    @field_validator("label", mode="before")
    @classmethod
    def _label_rule(cls, v: Any) -> Any:
        return _opt_text(v, MAX_EDGE_LABEL_CHARS, "edge_label_too_long", "diagram.edges[].label")


class DiagramEnc(_Strict):
    nodes: list[DiagramNode]
    edges: list[DiagramEdge]

    @model_validator(mode="before")
    @classmethod
    def _decode_and_count(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        data = dict(data)
        for key in ("nodes", "edges"):
            if key in data:
                data[key] = _decode_list(data[key], f"diagram.{key}")
        nodes = data.get("nodes") or []
        edges = data.get("edges") or []
        if len(nodes) > MAX_NODES:
            _raise("too_many_nodes",
                   f"a diagram shows at most {MAX_NODES} steps and this has {len(nodes):,}. Group related "
                   "steps into one node (e.g. 'Legal review') and send at most 25.", n=f"{len(nodes):,}")
        if len(nodes) < MIN_NODES:
            _raise("too_few_nodes", "send at least 2 nodes in `diagram.nodes`; for a single fact use a metric "
                                    "or plain text.")
        if len(edges) > MAX_EDGES:
            _raise("too_many_edges",
                   f"a diagram shows at most {MAX_EDGES} links and this has {len(edges):,}. Group related steps "
                   "so fewer links are needed.", n=f"{len(edges):,}")
        if len(edges) < MIN_EDGES:
            _raise("no_edges", "send at least 1 link in `diagram.edges`: [{from, to, label?}] naming node ids.")
        return data

    @model_validator(mode="after")
    def _graph_rules(self) -> "DiagramEnc":
        ids = [n.id for n in self.nodes]
        if len(set(ids)) != len(ids):
            _raise("duplicate_node", "every `diagram.nodes[].id` must be unique.")
        known = set(ids)
        for i, e in enumerate(self.edges):
            for end in (e.from_, e.to):
                if end not in known:
                    detail = (f"diagram.edges[{i}] names a node id that is not in `diagram.nodes`. Node ids: "
                              + ", ".join(ids) + ".")
                    safe = _safe(end)
                    if safe:
                        _raise("unknown_node", detail, id=safe)
                    _raise("fallback", detail)
        seen: set[tuple[str, str]] = set()
        for i, e in enumerate(self.edges):
            pair = (e.from_, e.to)
            if pair in seen:
                _raise("duplicate_edge", f"diagram.edges[{i}] repeats a from→to pair; send each link once (put "
                                         "both conditions in one label).")
            seen.add(pair)
        for i, e in enumerate(self.edges):
            if e.from_ == e.to and e.label is None:
                _raise("self_loop_unlabelled", f"diagram.edges[{i}] links a node to itself; give it a `label` "
                                               "saying why (e.g. 'retry'), or remove it.")
        return self


class ComparisonCell(_Strict):
    verdict: Verdict
    text: str | None = None
    source: int | None = None

    @field_validator("verdict", mode="before")
    @classmethod
    def _verdict_rule(cls, v: Any) -> Any:
        word = v.strip().lower() if isinstance(v, str) else None
        if word not in VERDICTS:
            _raise("fallback", "each cell `verdict` must be one of " + ", ".join(VERDICTS) + ": y favourable, n "
                               "unfavourable, m neutral or partly, q not stated in what was retrieved.")
        return word

    @field_validator("text", mode="before")
    @classmethod
    def _text_rule(cls, v: Any) -> Any:
        return _opt_text(v, MAX_CELL_CHARS, "cell_text_too_long", "comparison.terms[].cells[].text")

    @field_validator("source", mode="before")
    @classmethod
    def _source(cls, v: Any) -> Any:
        return _source_rule(v, "comparison.terms[].cells[]")


class ComparisonTerm(_Strict):
    name: str
    cells: list[ComparisonCell]

    @field_validator("name", mode="before")
    @classmethod
    def _name_rule(cls, v: Any) -> Any:
        return _req_text(v, MAX_TERM_CHARS, "term_too_long", "comparison.terms[].name")

    @field_validator("cells", mode="before")
    @classmethod
    def _cells_decode(cls, v: Any) -> Any:
        return _decode_list(v, "comparison.terms[].cells")


class ComparisonEnc(_Strict):
    options: list[str]
    terms: list[ComparisonTerm]

    @model_validator(mode="before")
    @classmethod
    def _decode_and_count(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        data = dict(data)
        for key in ("options", "terms"):
            if key in data:
                data[key] = _decode_list(data[key], f"comparison.{key}")
        options = data.get("options") or []
        if not MIN_OPTIONS <= len(options) <= MAX_OPTIONS:
            _raise("option_count", f"a comparison shows {MIN_OPTIONS} to {MAX_OPTIONS} options (the things being "
                                   f"compared) and this has {len(options):,}.", n=f"{len(options):,}")
        for o in options:
            _req_text(o, MAX_OPTION_CHARS, "option_too_long", "comparison.options[]")
        terms = data.get("terms") or []
        if not terms:
            _raise("no_items", "send at least one term: comparison.terms = [{name, cells}].", items="terms")
        if len(terms) > MAX_TERMS:
            _raise("too_many_terms", f"a comparison shows at most {MAX_TERMS} terms; keep the ones that matter.",
                   n=f"{len(terms):,}")
        return data

    @model_validator(mode="after")
    def _matrix_rules(self) -> "ComparisonEnc":
        n = len(self.options)
        for i, t in enumerate(self.terms):
            if len(t.cells) != n:
                _raise("ragged_term", f"comparison.terms[{i}] has {len(t.cells)} cells but there are {n} options; "
                                      "send one cell per option, in option order (verdict q when not stated).",
                       i=i + 1, got=len(t.cells), n=n)
        if len(set(self.options)) != n:
            _raise("duplicate_option", "every `comparison.options[]` name must be unique.")
        return self


class TimelineEvent(_Strict):
    date: str
    title: str
    detail: str | None = None
    category: str | None = None
    deadline: bool = False
    source: int | None = None

    @field_validator("date", mode="before")
    @classmethod
    def _date_rule(cls, v: Any) -> Any:
        if not is_event_date(v):  # belt: TimelineEnc words it with the event number first
            _raise("fallback", "`timeline.events[].date` must be YYYY-MM-DD (a real day) or YYYY-MM.")
        return v

    @field_validator("title", mode="before")
    @classmethod
    def _title_rule(cls, v: Any) -> Any:
        return _req_text(v, MAX_EVENT_TITLE_CHARS, "event_text_too_long", "timeline.events[].title",
                         what="an event title", cap=MAX_EVENT_TITLE_CHARS)

    @field_validator("detail", mode="before")
    @classmethod
    def _detail_rule(cls, v: Any) -> Any:
        return _opt_text(v, MAX_EVENT_DETAIL_CHARS, "event_text_too_long", "timeline.events[].detail",
                         what="an event detail", cap=MAX_EVENT_DETAIL_CHARS)

    @field_validator("category", mode="before")
    @classmethod
    def _category_rule(cls, v: Any) -> Any:
        return _opt_text(v, MAX_CATEGORY_CHARS, "event_text_too_long", "timeline.events[].category",
                         what="a category", cap=MAX_CATEGORY_CHARS)

    @field_validator("deadline", mode="before")
    @classmethod
    def _deadline_rule(cls, v: Any) -> Any:
        if v is None:
            return False
        if not isinstance(v, bool):  # pydantic's lax bool would read "yes" as True
            _raise("fallback", "`timeline.events[].deadline` must be true or false (or omitted).")
        return v

    @field_validator("source", mode="before")
    @classmethod
    def _source(cls, v: Any) -> Any:
        return _source_rule(v, "timeline.events[]")


class TimelineEnc(_Strict):
    events: list[TimelineEvent]

    @model_validator(mode="before")
    @classmethod
    def _decode_and_count(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        data = dict(data)
        if "events" in data:
            data["events"] = _decode_list(data["events"], "timeline.events")
        events = data.get("events") or []
        if not events:
            _raise("no_items", "send at least one event: timeline.events = [{date, title}].", items="events")
        if len(events) > MAX_EVENTS:
            _raise("too_many_events", f"a timeline shows at most {MAX_EVENTS} events; keep the ones that matter.",
                   n=f"{len(events):,}")
        for i, ev in enumerate(events):
            if isinstance(ev, dict) and not is_event_date(ev.get("date")):
                _raise("bad_date", f"timeline.events[{i}].date must be YYYY-MM-DD (a real calendar day) or "
                                   "YYYY-MM; never words or another format.", i=i + 1)
        return data


class _Encoded(_Strict):
    """Base of the three typed-encoding arms. ``encoding_key`` names the arm's own encoding field."""

    encoding_key: ClassVar[str] = ""
    title: str = Field(min_length=1)
    # D-08: accepted here so the HANDLER can word the refusal (it needs the parent's type).
    from_artifact: str | None = Field(default=None, max_length=64)
    columns: None = None
    rows: None = None
    transform: None = None
    chart: None = None
    metric: None = None

    @field_validator("title", mode="before")
    @classmethod
    def _title_len(cls, v: Any) -> Any:
        if isinstance(v, str) and _js_len(v.strip()) > MAX_TITLE_CHARS:  # UTF-16, as the browser counts
            _raise("title_too_long", f"`title` must be at most {MAX_TITLE_CHARS} characters.")
        return v.strip() if isinstance(v, str) else v

    @field_validator("from_artifact", mode="before")
    @classmethod
    def _blank_reference_is_none(cls, v: Any) -> Any:
        return None if isinstance(v, str) and not v.strip() else (v.strip() if isinstance(v, str) else v)

    @model_validator(mode="before")
    @classmethod
    def _own_data_only(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        data = dict(data)
        enc = cls.encoding_key
        own = data.get(enc)
        if isinstance(own, str):  # BEFORE any decode: a placeholder is never JSON
            if own.startswith(ROWS_PLACEHOLDER_STORED):
                _raise("placeholder_encoded_stored",
                       f"`{enc}` was the history placeholder of an artifact already shown, not its data. A "
                       f"{enc} is never redrawn by reference: send the data again as a full `{enc}` object.")
            if own.startswith(ROWS_PLACEHOLDER_NOT_STORED):
                _raise("placeholder_encoded_not_stored",
                       f"`{enc}` was the history placeholder of an earlier call that was refused, so nothing "
                       f"was stored. Send the data again as a full `{enc}` object.")
        foreign = ("columns", "rows", "transform", "chart", "metric") + tuple(
            c for c in ENCODED_COMPONENTS if c != enc)
        for key in foreign:
            val = data.get(key)
            if val is None:
                continue
            if val == [] or val == {} or (isinstance(val, str) and val.strip() in ("", "null")):
                data[key] = None  # an empty filler is not data
                continue
            _raise("foreign_fields",
                   f"a {enc} call sends `{enc}` only; `{key}` belongs to another artifact type. Remove `{key}`.",
                   noun=enc)
        return data

    @field_validator(*ENCODED_COMPONENTS, mode="before", check_fields=False)
    @classmethod
    def _decode_encoding(cls, v: Any, info) -> Any:
        return _decode_once(v, info.field_name)

    @model_validator(mode="after")
    def _needs_its_data(self) -> "_Encoded":
        enc = self.encoding_key
        if self.from_artifact is None and getattr(self, enc) is None:
            _raise("no_items", f"send `{enc}` with its data (see the show_artifact description).",
                   items=_ITEM_WORD[enc])
        return self


class DiagramArgs(_Encoded):
    encoding_key: ClassVar[str] = "diagram"
    component: Literal["diagram"]
    diagram: DiagramEnc | None = None
    comparison: None = None
    timeline: None = None


class ComparisonArgs(_Encoded):
    encoding_key: ClassVar[str] = "comparison"
    component: Literal["comparison"]
    comparison: ComparisonEnc | None = None
    diagram: None = None
    timeline: None = None


class TimelineArgs(_Encoded):
    encoding_key: ClassVar[str] = "timeline"
    component: Literal["timeline"]
    timeline: TimelineEnc | None = None
    diagram: None = None
    comparison: None = None


ArtifactArgs = Union[ChartArgs, TableArgs, MetricArgs, DiagramArgs, ComparisonArgs, TimelineArgs]
ShowArtifactArgs = Annotated[ArtifactArgs, Field(discriminator="component")]
_ADAPTER: TypeAdapter = TypeAdapter(ShowArtifactArgs)


# ── The persisted spec (message_artifacts.spec) ─────────────────────────────────────────────────


class StoredColumn(_Strict):
    name: str = Field(min_length=1, max_length=MAX_COLUMN_NAME_CHARS)
    type: ColumnType
    unit: str | None = Field(default=None, max_length=MAX_UNIT_CHARS)


class StoredChartEnc(_Strict):
    kind: ChartKind
    x: str
    y: list[str] = Field(min_length=1)
    stacked: bool
    slots: list[int]  # palette slot (0..3) of y[i] — server-assigned, never model-supplied (UI-D-07)

    @model_validator(mode="after")
    def _slots_parallel_y(self) -> "StoredChartEnc":
        if len(self.slots) != len(self.y) or any(s < 0 or s > 3 for s in self.slots):
            raise ValueError("chart.slots must hold one palette slot 0..3 per y series")
        return self


class StoredMetricEnc(_Strict):
    value_column: str
    compare_column: str | None = None
    label: str | None = None
    compare_label: str | None = None


class StoredArtifactSpec(_Strict):
    """The ``spec`` column exactly as the wire contract (spec_version 1) carries it."""

    title: str = Field(min_length=1, max_length=MAX_TITLE_CHARS)
    columns: list[StoredColumn] = Field(min_length=1, max_length=MAX_COLUMNS)
    rows: list[list[Cell]] = Field(min_length=1, max_length=MAX_ROWS)
    chart: StoredChartEnc | None = None
    metric: StoredMetricEnc | None = None


# ── The persisted spec of the three typed-encoding arms (Phase 292, D-14) ───────────────────────
#
# One model per new type; ``StoredArtifactSpec`` (tabular) above is unchanged. Every key is
# present in storage (no defaults), so the frontend guard reads one exact shape. Dump with
# ``model_dump(by_alias=True)`` so the edge key is "from". A ``source`` here is the SERVER-resolved
# citation (document / page / excerpt), never model text (D-07).


def _stored_js_cap(v: Any, cap: int, what: str) -> Any:
    if isinstance(v, str) and _js_len(v) > cap:
        raise ValueError(f"{what} must be at most {cap} UTF-16 units")
    return v


def _stored_text(v: Any, cap: int, what: str) -> Any:
    """A required stored string: not blank by either rule (292-REVIEW CR-01), within its UTF-16 cap."""
    if isinstance(v, str) and _is_blank(v):
        raise ValueError(f"{what} must not be blank")
    return _stored_js_cap(v, cap, what)


def _no_bool(v: Any, what: str) -> Any:
    if isinstance(v, bool):
        raise ValueError(f"{what} must not be a boolean")
    return v


class StoredSource(_Strict):
    # 292-REVIEW CR-01: capped in UTF-16 units (the guard's count), never pydantic's code points.
    document: str | None
    page: int | None = Field(ge=1)  # always null today: document_chunks carries no page
    excerpt: str | None

    @field_validator("document")
    @classmethod
    def _document_cap(cls, v: str | None) -> str | None:
        return _stored_js_cap(v, MAX_SOURCE_DOCUMENT_CHARS, "source.document")

    @field_validator("page", mode="before")
    @classmethod
    def _page_not_bool(cls, v: Any) -> Any:
        return _no_bool(v, "source.page")

    @field_validator("excerpt")
    @classmethod
    def _excerpt_cap(cls, v: str | None) -> str | None:
        return _stored_js_cap(v, MAX_EXCERPT_CHARS, "source.excerpt")


class StoredDiagramNode(_Strict):
    id: str = Field(pattern=NODE_ID_RE.pattern)
    label: str = Field(min_length=1)
    kind: NodeKind
    source: StoredSource | None

    @field_validator("label")
    @classmethod
    def _label_cap(cls, v: str) -> str:
        return _stored_text(v, MAX_NODE_LABEL_CHARS, "node label")


class StoredDiagramEdge(_Strict):
    from_: str = Field(alias="from")
    to: str
    label: str | None

    @field_validator("label")
    @classmethod
    def _label_cap(cls, v: str | None) -> str | None:
        return _stored_js_cap(v, MAX_EDGE_LABEL_CHARS, "edge label")


class StoredDiagramEnc(_Strict):
    nodes: list[StoredDiagramNode] = Field(min_length=MIN_NODES, max_length=MAX_NODES)
    edges: list[StoredDiagramEdge] = Field(min_length=MIN_EDGES, max_length=MAX_EDGES)

    @model_validator(mode="after")
    def _edges_name_nodes(self) -> "StoredDiagramEnc":
        ids = [n.id for n in self.nodes]
        if len(set(ids)) != len(ids):
            raise ValueError("diagram node ids must be unique")
        known = set(ids)
        pairs = [(e.from_, e.to) for e in self.edges]
        if any(a not in known or b not in known for a, b in pairs) or len(set(pairs)) != len(pairs):
            raise ValueError("diagram edges must name known nodes, each from→to pair once")
        if any(e.from_ == e.to and e.label is None for e in self.edges):
            raise ValueError("a diagram self-loop needs a label")
        return self


class StoredDiagramSpec(_Strict):
    title: str = Field(min_length=1, max_length=MAX_TITLE_CHARS)
    diagram: StoredDiagramEnc


class StoredComparisonCell(_Strict):
    verdict: Verdict
    text: str | None
    source: StoredSource | None

    @field_validator("text")
    @classmethod
    def _text_cap(cls, v: str | None) -> str | None:
        return _stored_js_cap(v, MAX_CELL_CHARS, "cell text")


class StoredComparisonTerm(_Strict):
    name: str = Field(min_length=1)
    cells: list[StoredComparisonCell]

    @field_validator("name")
    @classmethod
    def _name_cap(cls, v: str) -> str:
        return _stored_text(v, MAX_TERM_CHARS, "term name")


class StoredComparisonEnc(_Strict):
    options: list[str] = Field(min_length=MIN_OPTIONS, max_length=MAX_OPTIONS)
    terms: list[StoredComparisonTerm] = Field(min_length=1, max_length=MAX_TERMS)

    @field_validator("options")
    @classmethod
    def _options_rule(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v) or any(not o for o in v):
            raise ValueError("comparison options must be unique, non-empty names")
        for o in v:
            _stored_text(o, MAX_OPTION_CHARS, "option name")
        return v

    @model_validator(mode="after")
    def _cells_parallel_options(self) -> "StoredComparisonEnc":
        if any(len(t.cells) != len(self.options) for t in self.terms):
            raise ValueError("comparison terms must hold one cell per option")
        return self


class StoredComparisonSpec(_Strict):
    title: str = Field(min_length=1, max_length=MAX_TITLE_CHARS)
    comparison: StoredComparisonEnc


class StoredTimelineEvent(_Strict):
    date: str
    title: str = Field(min_length=1)
    detail: str | None
    category: str | None
    deadline: bool
    source: StoredSource | None

    @field_validator("date")
    @classmethod
    def _date_rule(cls, v: str) -> str:
        if not is_event_date(v):
            raise ValueError("event date must be YYYY-MM-DD or YYYY-MM")
        return v

    @field_validator("deadline", mode="before")
    @classmethod
    def _deadline_strict(cls, v: Any) -> Any:
        if not isinstance(v, bool):
            raise ValueError("deadline must be a boolean")
        return v

    @model_validator(mode="after")
    def _caps(self) -> "StoredTimelineEvent":
        _stored_text(self.title, MAX_EVENT_TITLE_CHARS, "event title")
        _stored_js_cap(self.detail, MAX_EVENT_DETAIL_CHARS, "event detail")
        _stored_js_cap(self.category, MAX_CATEGORY_CHARS, "event category")
        return self


class StoredTimelineEnc(_Strict):
    events: list[StoredTimelineEvent] = Field(min_length=1, max_length=MAX_EVENTS)

    @model_validator(mode="after")
    def _sorted(self) -> "StoredTimelineEnc":
        keys = [event_sort_key(e.date) for e in self.events]
        if keys != sorted(keys):
            raise ValueError("stored timeline events must be sorted by date")
        return self


class StoredTimelineSpec(_Strict):
    title: str = Field(min_length=1, max_length=MAX_TITLE_CHARS)
    timeline: StoredTimelineEnc


STORED_ENCODED_SPECS: dict[str, type[_Strict]] = {
    "diagram": StoredDiagramSpec,
    "comparison": StoredComparisonSpec,
    "timeline": StoredTimelineSpec,
}


# ── Dataset validation (first emission AND, in 273-03, after by-reference transforms) ───────────


def _in_float64_range(val: float | int) -> bool:
    """True when ``val`` is a finite number the browser's ``JSON.parse`` keeps finite (273 CR-01).

    Python ints are unbounded and ``float("1" + "0" * 400 + ".5")`` is ``inf``; either one stores
    (or, for inf, fails the jsonb insert) and reaches the frontend as ``Infinity``, which its guard
    refuses — so the model would be told "shown" for a spec that only renders as a notice.
    """
    try:
        return math.isfinite(float(val))
    except OverflowError:
        return False


def _strict_number_value(s: str) -> float | int | None:
    s = s.replace(",", "")
    try:
        return float(s) if "." in s else int(s)
    except ValueError:  # e.g. more digits than int() will parse (sys.get_int_max_str_digits)
        return None


def _number_overflows(v: Any) -> bool:
    """A number-shaped cell whose value is outside the float64 range (worded as "too large")."""
    if isinstance(v, bool) or v is None:
        return False
    if isinstance(v, float):
        return math.isinf(v)
    if isinstance(v, int):
        return not _in_float64_range(v)
    if isinstance(v, str) and _STRICT_NUMBER.fullmatch(v.strip()):
        val = _strict_number_value(v.strip())
        return val is None or not _in_float64_range(val)
    return False


def _coerce_number(v: Any) -> tuple[bool, float | int | None]:
    if v is None:
        return True, None
    if isinstance(v, bool):
        return False, None
    if isinstance(v, int):
        return (True, v) if _in_float64_range(v) else (False, None)
    if isinstance(v, float):
        return (True, v) if math.isfinite(v) else (False, None)
    if isinstance(v, str):
        s = v.strip()
        if not _STRICT_NUMBER.fullmatch(s):
            return False, None
        val = _strict_number_value(s)
        if val is None or not _in_float64_range(val):
            return False, None
        return True, val
    return False, None


def _coerce_text(v: Any) -> tuple[bool, str | None]:
    if v is None:
        return True, None
    if isinstance(v, bool):
        return False, None
    if isinstance(v, str):
        return True, v
    if isinstance(v, int):
        return True, str(v)
    if isinstance(v, float) and math.isfinite(v):
        return True, str(int(v)) if v.is_integer() else repr(v)
    return False, None


def validate_dataset(
    component: str,
    columns: list[dict],
    rows: list[list],
    chart: dict | None,
    metric: dict | None,
) -> tuple[list[list], ArtifactRefusal | None]:
    """Check a dataset against every cap and coerce its cells. Plain lists in, plain lists out.

    Returns ``(coerced_rows, None)`` or ``([], refusal)``. Never truncates (D-09).
    """
    if not columns:
        return [], _refusal("no_columns", "send `columns`: [{name, type: number|string, unit?}].")
    if len(columns) > MAX_COLUMNS:
        return [], _refusal("too_many_columns", f"at most {MAX_COLUMNS} columns; select the ones you need.",
                            n=f"{len(columns):,}")
    names = [c.get("name") for c in columns]
    if len(set(names)) != len(names):
        return [], _refusal("duplicate_column", "every column `name` must be unique.")
    if not rows:
        return [], _refusal("no_rows", "send at least one row in `rows`.")
    if len(rows) > MAX_ROWS:
        return [], _refusal(
            "too_many_rows",
            f"{len(rows):,} rows is above the {MAX_ROWS}-row cap. Aggregate first (group, bucket or "
            "take the top rows) and send at most 500 rows.",
            n=f"{len(rows):,}",
        )

    coerced: list[list] = []
    for i, row in enumerate(rows):
        if not isinstance(row, list) or len(row) != len(columns):
            got = len(row) if isinstance(row, list) else 0
            return [], _refusal(
                "ragged_row",
                f"rows[{i}] has {got} cells but there are {len(columns)} columns; every row needs one "
                "cell per column (use null for a gap).",
                i=i + 1, got=got, n=len(columns),
            )
        out_row: list = []
        for col, cell in zip(columns, row):
            cname = col.get("name")
            if col.get("type") == "number":
                ok, val = _coerce_number(cell)
                if not ok and _number_overflows(cell):
                    return [], _refusal(
                        "number_too_large",
                        f"column `{cname}` rows[{i}] is outside the range a browser can show (about "
                        "±1.8e308); scale it (e.g. to millions) and put the scale in `unit`.",
                        column=_col_word(cname),
                    )
                if not ok:
                    return [], _refusal(
                        "not_a_number",
                        f"column `{cname}` rows[{i}] is not a bare number: {_BARE_NUMBERS} "
                        "(\"1,234.5\" and 1234.5 are fine; \"$120\" and \"12%\" are not).",
                        column=_col_word(cname),
                    )
            else:
                ok, val = _coerce_text(cell)
                if not ok:
                    return [], _refusal("not_text", f"column `{cname}` rows[{i}] must be text or null.",
                                        column=_col_word(cname))
                if val is not None and _js_len(val) > MAX_CELL_CHARS:  # UTF-16, as the browser counts
                    return [], _refusal(
                        "cell_too_long",
                        f"column `{cname}` rows[{i}] is longer than {MAX_CELL_CHARS} characters; shorten it.",
                        column=_col_word(cname),
                    )
            out_row.append(val)
        coerced.append(out_row)

    size = len(json.dumps({"columns": columns, "rows": coerced}, ensure_ascii=False).encode("utf-8"))
    if size > MAX_SPEC_BYTES - _SPEC_RESERVE_BYTES:
        return [], _refusal(
            "too_large",
            f"the data is {size:,} bytes; the cap is {MAX_SPEC_BYTES - _SPEC_RESERVE_BYTES:,}. Aggregate, "
            "drop columns or shorten text.",
            kib=f"{math.ceil(size / 1024):,}",
        )

    by_name = {c.get("name"): c for c in columns}

    def _missing(name: Any, role: str) -> ArtifactRefusal:
        safe = _safe(name)
        detail = f"{role} names a column that is not in `columns`. Use one of the declared column names."
        if safe:
            return _refusal("missing_column_named", detail, column=safe)
        return _refusal("missing_column", detail)

    if component == "chart":
        if not chart:
            return [], _refusal("fallback", "a chart needs chart={kind, x, y}.")
        kind = chart.get("kind")
        ys = list(chart.get("y") or [])
        cap = MAX_SERIES.get(kind, 4)
        if len(ys) > cap:
            return [], _refusal(
                "too_many_series",
                f"a {kind} chart shows at most {cap} series; pick the {cap} that matter or use a table.",
                n=len(ys), cap=cap,
            )
        if len(set(ys)) != len(ys):
            return [], _refusal("fallback", "chart.y lists a series twice.")
        if chart.get("x") not in by_name:
            return [], _missing(chart.get("x"), "chart.x")
        for y in ys:
            if y not in by_name:
                return [], _missing(y, "chart.y")
            if by_name[y].get("type") != "number":
                return [], _refusal("series_not_number", f"chart.y `{y}` must be a number column.",
                                    column=_col_word(y))
        # 273 CR-01 — the two remaining rules of the frontend's parseChart, so a chart the model is
        # told was shown is a chart the renderer draws.
        x_name = chart.get("x")
        if x_name in ys:
            return [], _refusal(
                "fallback",
                f"chart.x `{x_name}` is also listed in chart.y; the x column is the axis, not a series. "
                "Remove it from y.",
            )
        if kind == "scatter" and by_name[x_name].get("type") != "number":
            return [], _refusal(
                "series_not_number",
                f"a scatter chart needs a number column on x, and `{x_name}` is text. Use a bar or line "
                "chart for categories, or pick a number column for x.",
                column=_col_word(x_name),
            )
    elif component == "metric":
        if not metric:
            return [], _refusal("fallback", "a metric needs metric={value_column}.")
        for role in ("value_column", "compare_column"):
            name = metric.get(role)
            if name is None and role == "compare_column":
                continue
            if name not in by_name:
                return [], _missing(name, f"metric.{role}")
            if by_name[name].get("type") != "number":
                return [], _refusal("series_not_number", f"metric.{role} `{name}` must be a number column.",
                                    column=_col_word(name))
        if len(coerced) != 1:
            return [], _refusal(
                "metric_one_row",
                f"a metric shows exactly one row and this has {len(coerced)}; filter to the one row first.",
            )
    return coerced, None


# ── Error mapping: pydantic errors → the closed catalogue ───────────────────────────────────────


def _loc_path(loc: tuple) -> str:
    parts: list[str] = []
    for p in loc[1:] if loc and loc[0] in ARTIFACT_COMPONENTS else loc:
        if isinstance(p, int):
            parts.append(f"[{p}]")
        elif isinstance(p, str) and _SAFE_NAME.fullmatch(p):
            parts.append(("." if parts else "") + p)
        else:
            parts.append((("." if parts else "") + "?"))
    return "".join(parts) or "arguments"


def _from_errors(errors: list[dict], component: Any = None) -> ArtifactRefusal:
    for e in errors:  # a refusal a validator already worded wins
        if e.get("type") == "artifact_refusal":
            ctx = e.get("ctx") or {}
            return ArtifactRefusal(reason=str(ctx.get("reason")), detail=str(ctx.get("detail")))
    for e in errors:
        if e.get("type") in ("union_tag_invalid", "union_tag_not_found"):
            detail = "`component` must be one of " + ", ".join(ARTIFACT_COMPONENTS) + ". Use a table for anything else."
            # UI-D-292-21 / T-273-07: only a CLOSED alias key is ever named; the model's raw word is not.
            alias = COMPONENT_ALIASES.get(component) if isinstance(component, str) else None
            if alias is not None:
                return _refusal("component_alias", detail, alias=alias)
            return _refusal("unknown_component", detail)
    for e in errors:
        loc = tuple(e.get("loc") or ())
        if loc and loc[-1] == "kind" and "chart" in loc[1:]:
            raw = e.get("input")
            word = raw.strip().lower() if isinstance(raw, str) else None
            detail = "chart.kind must be one of line, bar, area, scatter. For parts of a whole use a bar chart or a table."
            if word in KIND_ALIASES:
                return _refusal("kind_alias", detail, alias=word)
            return _refusal("kind_unknown", detail)
    for e in errors:
        loc = tuple(e.get("loc") or ())
        if "transform" in loc and "filter" in loc:
            return _refusal("bad_filter", f"{_loc_path(loc)}: {e.get('msg')}. Filter ops are eq, in, range.")
    first = errors[0] if errors else {}
    path = _loc_path(tuple(first.get("loc") or ()))
    if first.get("type") == "extra_forbidden":
        detail = f"`{path}` is not a show_artifact field. Use only the documented fields."
    else:
        detail = f"`{path}`: {first.get('msg', 'invalid')}."
    return _refusal("fallback", detail)


def _strip_nul_deep(v: Any) -> Any:
    """A copy of ``v`` with every NUL removed from every string (273-REVIEW WR-02).

    Postgres ``jsonb`` rejects ``\\u0000``, so a NUL in any cell, title or name made the insert fail
    and the model was told "couldn't save the artifact; try the call again" — a retry that fails
    identically. Stripping matches ``agent_loop._strip_nul`` (document text carries NULs, e.g. the
    v3.7 ``.msg`` incident). Applied to keys too, and BEFORE validation, so ``chart.x`` and the
    column it names are stripped the same way and still match.
    """
    if isinstance(v, str):
        return v.replace("\x00", "")
    if isinstance(v, dict):
        return {(_strip_nul_deep(k) if isinstance(k, str) else k): _strip_nul_deep(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_strip_nul_deep(x) for x in v]
    return v


def validate_args(
    raw: Any,
) -> ChartArgs | TableArgs | MetricArgs | DiagramArgs | ComparisonArgs | TimelineArgs | ArtifactRefusal:
    """Validate ``show_artifact`` arguments. Never raises; never mutates ``raw``."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (ValueError, TypeError):
            return _refusal("fallback", "the arguments must be a JSON object.")
    if not isinstance(raw, dict):
        return _refusal("fallback", "the arguments must be a JSON object.")
    # A NUL-free deep copy — the caller's dict is persisted as-is (anti-pattern: mutating args).
    data = _strip_nul_deep(raw)
    comp = data.get("component")
    if isinstance(comp, str):
        data["component"] = comp.strip().lower()
    try:
        return _ADAPTER.validate_python(data)
    except ValidationError as exc:
        return _from_errors(exc.errors(), component=data.get("component"))


# ── Reading a persisted tool result (reload attach, history redaction) ──────────────────────────


def _as_obj(text: Any) -> dict | None:
    if isinstance(text, dict):
        return text
    if not isinstance(text, str):
        return None
    try:
        obj = json.loads(text)
    except (ValueError, TypeError):
        return None
    return obj if isinstance(obj, dict) else None


def artifact_id_from_result(text: Any) -> str | None:
    """The artifact id a successful ``show_artifact`` result names, or None. Never raises."""
    obj = _as_obj(text)
    if obj is None:
        return None
    v = obj.get(RESULT_ID_KEY)
    return v if isinstance(v, str) and ARTIFACT_ID_RE.fullmatch(v) else None


def is_refusal_result(text: Any) -> bool:
    """True only for a JSON object whose status is "refused". Never raises."""
    obj = _as_obj(text)
    return obj is not None and obj.get("status") == REFUSED_STATUS

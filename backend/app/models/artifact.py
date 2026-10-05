"""The closed vocabulary of agent-authored artifacts (Phase 273 — ART-01..05, D-02/D-05/D-07/D-09).

``show_artifact`` lets the agent put an interactive chart, table or single metric under its answer.
Everything the model may say to that tool is declared HERE, and nothing outside it renders.

I-1 — THE COMPONENT SET IS EXACTLY THREE AND IT IS FROZEN. Unlike ``harness.py``'s Literals, which
grow additively, ``ComponentName`` is a product boundary: ``chart | table | metric``. It is fenced
three ways, and all three must move together or not at all:

  * ``supabase/migrations/202_message_artifacts.sql`` — the ``component IN (…)`` CHECK
    (``test_273_migration_202_shape`` asserts literal-set equality with ``ARTIFACT_COMPONENTS``);
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

import json
import math
import re
from dataclasses import dataclass
from typing import Annotated, Any, Literal, Union, get_args

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

ComponentName = Literal["chart", "table", "metric"]
ChartKind = Literal["line", "bar", "area", "scatter"]
ColumnType = Literal["number", "string"]
FilterOpName = Literal["eq", "in", "range"]
SortDirection = Literal["asc", "desc"]

ARTIFACT_COMPONENTS: tuple[str, ...] = get_args(ComponentName)
CHART_KINDS: tuple[str, ...] = get_args(ChartKind)
COLUMN_TYPES: tuple[str, ...] = get_args(ColumnType)
FILTER_OPS: tuple[str, ...] = get_args(FilterOpName)

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

# Kinds people ask for that we cannot draw. Only these may be NAMED in a reason (UI-SPEC).
KIND_ALIASES: tuple[str, ...] = (
    "pie", "donut", "radar", "heatmap", "histogram", "treemap", "funnel", "gauge",
)

# ── Result contract (I-3) ───────────────────────────────────────────────────────────────────────

RESULT_ID_KEY = "artifact_id"
REFUSED_STATUS = "refused"
# The success result's key order (273-03 builds it; FIRST key is the id so a 2000-char cut keeps it).
RESULT_KEY_ORDER: tuple[str, ...] = (
    "artifact_id", "label", "component", "kind", "stacked", "series_count", "row_count",
    "from_label", "same_rows", "operations", "columns", "values", "note",
)
# History placeholders (I-4). 273-04's redact_artifact_args builds its strings from THESE constants,
# and this module refuses a call that echoes one back — so the two can never drift.
ROWS_PLACEHOLDER_STORED = "<stored in artifact "
ROWS_PLACEHOLDER_NOT_STORED = "<not stored"

ARTIFACT_ID_RE = re.compile(r"^a_[0-9a-z]{10}$")
ARTIFACT_LABEL_RE = re.compile(r"^(chart|table|metric) [1-9][0-9]*$")
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
    "unknown_component": "something other than a chart, table or metric",
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

    @field_validator("columns", "transform", "chart", "metric", mode="before", check_fields=False)
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


class ChartArgs(_ArgsBase):
    component: Literal["chart"]
    chart: ChartEnc
    metric: None = None


class TableArgs(_ArgsBase):
    component: Literal["table"]
    chart: None = None
    metric: None = None


class MetricArgs(_ArgsBase):
    component: Literal["metric"]
    metric: MetricEnc
    chart: None = None


ShowArtifactArgs = Annotated[Union[ChartArgs, TableArgs, MetricArgs], Field(discriminator="component")]
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


def _from_errors(errors: list[dict]) -> ArtifactRefusal:
    for e in errors:  # a refusal a validator already worded wins
        if e.get("type") == "artifact_refusal":
            ctx = e.get("ctx") or {}
            return ArtifactRefusal(reason=str(ctx.get("reason")), detail=str(ctx.get("detail")))
    for e in errors:
        if e.get("type") in ("union_tag_invalid", "union_tag_not_found"):
            return _refusal(
                "unknown_component",
                "`component` must be one of chart, table, metric. Use a table for anything else.",
            )
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


def validate_args(raw: Any) -> ChartArgs | TableArgs | MetricArgs | ArtifactRefusal:
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
        return _from_errors(exc.errors())


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

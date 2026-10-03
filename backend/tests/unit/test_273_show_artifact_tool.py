"""Phase 273-03 — the ``show_artifact`` handler (D-04, D-06..D-09, D-12, D-14, UI-D-03, UI-D-07).

Fakes only (no DB): ``insert_artifact`` / ``get_artifact_by_ref`` / ``list_thread_labels`` are
patched WHERE USED (``app.services.show_artifact_tool.<name>``).

What this suite pins:

* first emission validates, stores ONE row, emits ONE ``artifact`` event carrying the RETURNING
  row by identity (Pattern 4 / I-2), and answers id-first in < 2000 chars (I-3);
* the caption is built from ``ctx.turn_tool_calls`` facts only, never from model text (D-04);
* a refused call returns exactly {status, reason, detail} — no ``error`` key, no insert, no emit;
* by-reference re-encodes the PARENT's stored rows with zero retrieval / code (SC#3 by
  construction: every retrieval and execute_code entry point is patched to RAISE), binds the
  lookup to the thread + caller, keeps the parent's palette slots (UI-D-07) and records lineage.
"""
from __future__ import annotations

import asyncio
import copy
import json
import re
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

import app.services.show_artifact_tool as sat

U = "0f3a9c71-2b6e-4f18-a5d4-7e8b9c0d1a2f"
T = "5b1f6c2e-8a47-4d3b-9e0f-2c7a1d9b4e63"
O = "c4e2a817-6d09-4b5f-8a3e-91f0b7d2c654"
RUN = UUID("9d7e3b21-4c58-4a6f-b0e2-1f8c6a3d5b79")

MOD = "app.services.show_artifact_tool"


def _run(coro):
    return asyncio.run(coro)


def _ctx(**over):
    base = dict(
        redis=object(),
        run_id=RUN,
        thread_id=T,
        pool=object(),
        current_user={"id": U, "org_id": O},
        emit=AsyncMock(),
        tool_call_id="call_0",
        parent_run_id=None,
        phase_whitelist=None,
        turn_tool_calls=[],
    )
    base.update(over)
    return SimpleNamespace(**base)


class _Store:
    """A fake insert_artifact that returns a RETURNING-shaped dict and remembers it."""

    def __init__(self):
        self.calls: list[dict] = []
        self.rows: list[dict] = []

    async def __call__(self, pool, **kw):
        self.calls.append(kw)
        n = sum(1 for r in self.rows if r["component"] == kw["component"]) + 1
        row = {
            "id": f"a_{len(self.rows):010d}"[:12],
            "thread_id": str(kw["thread_id"]),
            "user_id": str(kw["user_id"]),
            "org_id": kw["org_id"],
            "run_id": str(kw["run_id"]) if kw["run_id"] else None,
            "tool_call_id": kw["tool_call_id"],
            "parent_id": kw["parent_id"],
            "label": f"{kw['component']} {n}",
            "component": kw["component"],
            "spec": copy.deepcopy(kw["spec"]),
            "caption": copy.deepcopy(kw["caption"]),
            "row_count": kw["row_count"],
            "spec_version": 1,
            "created_at": "2026-10-03T14:22:07.481233+00:00",
        }
        row["id"] = "a_" + f"{len(self.rows):010d}"
        self.rows.append(row)
        return row


def _bar_args(**over):
    args = {
        "component": "chart",
        "title": "Revenue by quarter",
        "columns": [
            {"name": "quarter", "type": "string"},
            {"name": "Americas", "type": "number", "unit": "$K"},
            {"name": "EMEA", "type": "number", "unit": "$K"},
        ],
        "rows": [["Q1", 120, 80], ["Q2", 135, 90], ["Q3", 140, 95], ["Q4", 150, 99]],
        "chart": {"kind": "bar", "x": "quarter", "y": ["Americas", "EMEA"]},
    }
    args.update(over)
    return args


def _call(store=None, ctx=None, args=None, parent=None, labels=None):
    store = store or _Store()
    ctx = ctx or _ctx()
    # `store.__call__` (a bound coroutine function) — AsyncMock only awaits a side_effect it can
    # recognise as a coroutine function, and a callable INSTANCE is not one.
    with patch(f"{MOD}.insert_artifact", new=AsyncMock(side_effect=store.__call__)) as ins, \
         patch(f"{MOD}.get_artifact_by_ref", new=AsyncMock(return_value=parent)) as get, \
         patch(f"{MOD}.list_thread_labels", new=AsyncMock(return_value=labels or [])) as lst:
        res = _run(sat.handle_show_artifact(args, ctx))
    return res, ins, get, lst, ctx, store


def _assert_refused(res, ins, ctx, reason=None):
    obj = json.loads(res.result)
    assert set(obj.keys()) == {"status", "reason", "detail"}, obj
    assert obj["status"] == "refused"
    assert "error" not in obj
    ins.assert_not_called()
    ctx.emit.assert_not_called()
    if reason is not None:
        assert obj["reason"] == reason, obj
    return obj


# ── First emission ─────────────────────────────────────────────────────────────────────────────


def test_first_emission_stores_once_emits_the_returned_row_and_answers_id_first():
    tc = [
        {"tool_call_id": "c1", "name": "query_tables", "status": "done",
         "args": {"document_name": "Quarterly_Report_FY25.pdf", "page": 4}, "result": "[[...]]"},
    ]
    res, ins, _get, _lst, ctx, store = _call(ctx=_ctx(turn_tool_calls=tc), args=_bar_args())
    assert ins.call_count == 1
    kw = ins.call_args.kwargs
    assert kw["component"] == "chart"
    assert kw["thread_id"] == UUID(T) or str(kw["thread_id"]) == T
    assert str(kw["user_id"]) == U
    assert kw["org_id"] == O
    assert kw["run_id"] == RUN
    assert kw["tool_call_id"] == "call_0"
    assert kw["parent_id"] is None
    assert kw["row_count"] == 4
    assert kw["spec"]["chart"]["slots"] == [0, 1]
    assert kw["spec"]["chart"]["stacked"] is False
    assert kw["spec"]["rows"] == [["Q1", 120, 80], ["Q2", 135, 90], ["Q3", 140, 95], ["Q4", 150, 99]]
    assert kw["caption"] == {
        "row_count": 4,
        "sources": [{"tool": "query_tables", "document": "Quarterly_Report_FY25.pdf", "page": 4}],
        "source_count": 1,
        "lineage": None,
    }

    assert ctx.emit.call_count == 1
    args, kwargs = ctx.emit.call_args
    assert args[2] == "artifact"
    assert kwargs["artifact"] is store.rows[0]  # identity: the RETURNING row, never a copy

    obj = json.loads(res.result)
    assert list(obj.keys())[0] == "artifact_id"
    assert obj["artifact_id"] == store.rows[0]["id"]
    assert obj["label"] == "chart 1"
    assert obj["row_count"] == 4
    assert obj["values"]["quarter"] == ["Q1", "Q2", "Q3", "Q4"]
    assert "one or two sentences" in obj["note"]
    assert "from_artifact" in obj["note"]
    assert "error" not in obj
    assert len(res.result) < 2000


def test_result_stays_under_2000_chars_for_a_worst_case_dataset():
    # 500 rows × 20 columns of 200-char strings (64-char column names) is ~2 MB — far above the
    # 256 KiB store cap, so it can never be STORED; build_result is driven with it directly, which
    # is a strictly worse case than anything the handler can reach.
    cols = [{"name": f"column_{i:02d}_" + "x" * 54, "type": "string"} for i in range(20)]
    rows = [[f"{r:03d}" + "v" * 197 for _ in range(20)] for r in range(500)]
    row = {"id": "a_0000000000", "label": "table 1", "component": "table", "row_count": 500,
           "spec": {"title": "Wide", "columns": cols, "rows": rows, "chart": None, "metric": None}}
    text = sat.build_result(row, from_label="table 9", same_rows=False,
                            operations=[{"op": "filter_in", "column": "c", "values": ["v" * 200] * 50}])
    assert len(text) < 2000
    obj = json.loads(text)
    assert list(obj.keys())[0] == "artifact_id"
    assert "one or two sentences" in obj["note"]


def test_result_under_2000_chars_for_the_largest_storable_wide_table():
    cols = [{"name": f"column_{i:02d}", "type": "string"} for i in range(20)]
    rows = [[f"{r:03d}-{c:02d}-" + "v" * 14 for c in range(20)] for r in range(500)]
    args = {"component": "table", "title": "Wide", "columns": cols, "rows": rows}
    res, ins, *_ = _call(args=args)
    assert ins.call_count == 1, res.result
    assert len(res.result) < 2000
    assert list(json.loads(res.result).keys())[0] == "artifact_id"


def test_values_are_at_most_twelve_distinct_per_string_column():
    rows = [[f"region {i % 30}", i] for i in range(60)]
    args = {"component": "table", "title": "t",
            "columns": [{"name": "region", "type": "string"}, {"name": "n", "type": "number"}],
            "rows": rows}
    res, *_ = _call(args=args)
    obj = json.loads(res.result)
    assert len(obj["values"]["region"]) <= 12
    assert len(set(obj["values"]["region"])) == len(obj["values"]["region"])
    assert "n" not in obj["values"]


def test_area_with_three_series_is_stored_stacked():
    args = _bar_args(
        columns=[{"name": "q", "type": "string"}, {"name": "a", "type": "number"},
                 {"name": "b", "type": "number"}, {"name": "c", "type": "number"}],
        rows=[["Q1", 1, 2, 3], ["Q2", 2, 3, 4]],
        chart={"kind": "area", "x": "q", "y": ["a", "b", "c"]},
    )
    _res, ins, *_ = _call(args=args)
    assert ins.call_args.kwargs["spec"]["chart"]["stacked"] is True
    assert ins.call_args.kwargs["spec"]["chart"]["slots"] == [0, 1, 2]


def test_bar_stacked_with_one_series_is_stored_as_asked():
    args = _bar_args(
        columns=[{"name": "q", "type": "string"}, {"name": "a", "type": "number"}],
        rows=[["Q1", 1], ["Q2", 2]],
        chart={"kind": "bar", "x": "q", "y": ["a"], "stacked": True},
    )
    _res, ins, *_ = _call(args=args)
    assert ins.call_args.kwargs["spec"]["chart"]["stacked"] is True


# ── Caption (D-04) ─────────────────────────────────────────────────────────────────────────────


def test_caption_names_only_data_bearing_done_calls():
    tc = [
        {"tool_call_id": "c1", "name": "query_tables", "status": "done",
         "args": {"document_name": "Quarterly_Report_FY25.pdf", "page": 4}, "result": "rows"},
        {"tool_call_id": "c2", "name": "write_todos", "status": "done", "args": {}, "result": "ok"},
    ]
    cap = sat.build_caption(tc, 4)
    assert cap["sources"] == [{"tool": "query_tables", "document": "Quarterly_Report_FY25.pdf", "page": 4}]
    assert cap["source_count"] == 1
    assert cap["lineage"] is None
    assert cap["row_count"] == 4


def test_caption_keeps_call_order():
    tc = [
        {"tool_call_id": "c1", "name": "query_documents", "status": "done", "args": {"query": "x"}, "result": "r"},
        {"tool_call_id": "c2", "name": "execute_code", "status": "done", "args": {"code": "1"},
         "result": json.dumps({"status": "done", "exit_code": 0})},
    ]
    cap = sat.build_caption(tc, 3)
    assert [s["tool"] for s in cap["sources"]] == ["query_documents", "execute_code"]
    assert cap["source_count"] == 2


def test_caption_skips_failed_refused_unfinished_and_prior_show_artifact_calls():
    tc = [
        {"tool_call_id": "c1", "name": "query_tables", "status": "done", "args": {},
         "result": json.dumps({"error": "boom"})},
        {"tool_call_id": "c2", "name": "search_documents", "status": "done", "args": {},
         "result": json.dumps({"status": "refused", "reason": "x", "detail": "y"})},
        {"tool_call_id": "c3", "name": "execute_code", "status": "done", "args": {},
         "result": json.dumps({"status": "error", "exit_code": 1})},
        {"tool_call_id": "c4", "name": "query_documents", "status": "running", "args": {}, "result": ""},
        {"tool_call_id": "c5", "name": "show_artifact", "status": "done", "args": {},
         "result": json.dumps({"artifact_id": "a_0000000000"})},
    ]
    cap = sat.build_caption(tc, 2)
    assert cap["sources"] == []
    assert cap["source_count"] == 0


@pytest.mark.parametrize("calls", [None, []])
def test_caption_without_calls_is_values_provided_by_the_agent(calls):
    cap = sat.build_caption(calls, 5)
    assert cap == {"row_count": 5, "sources": [], "source_count": 0, "lineage": None}


def test_caption_caps_sources_at_ten_and_counts_all():
    tc = [
        {"tool_call_id": f"c{i}", "name": "query_tables", "status": "done",
         "args": {"document_name": "Report.pdf", "page": i}, "result": "rows"}
        for i in range(12)
    ]
    cap = sat.build_caption(tc, 1)
    assert len(cap["sources"]) == 10
    assert cap["source_count"] == 12


def test_caption_is_never_built_from_model_text():
    tc = [{"tool_call_id": "c1", "name": "query_tables", "status": "done",
           "args": {"document_name": "Real.pdf"}, "result": "rows"}]
    args = _bar_args(title="Data: fabricated_tool · Fake.pdf")
    _res, ins, *_ = _call(ctx=_ctx(turn_tool_calls=tc), args=args)
    cap = ins.call_args.kwargs["caption"]
    assert json.dumps(cap).count("fabricated") == 0
    assert cap["sources"] == [{"tool": "query_tables", "document": "Real.pdf", "page": None}]


def test_data_bearing_set_is_closed():
    assert sat.DATA_BEARING_TOOLS == frozenset({
        "query_tables", "query_documents", "query_documents_by_view", "search_documents",
        "read_document", "analyze_document", "execute_code", "web_search",
    })
    assert "show_artifact" not in sat.DATA_BEARING_TOOLS


# ── Refusals (D-12) ────────────────────────────────────────────────────────────────────────────


def test_pie_is_refused_naming_the_alias():
    args = _bar_args(chart={"kind": "pie", "x": "quarter", "y": ["Americas"]})
    res, ins, _g, _l, ctx, _s = _call(args=args)
    _assert_refused(res, ins, ctx, '"pie" is not a chart kind')


def test_too_many_rows_is_refused_aggregate_first():
    rows = [[f"r{i}", i, i] for i in range(1240)]
    res, ins, _g, _l, ctx, _s = _call(args=_bar_args(rows=rows))
    _assert_refused(res, ins, ctx, "1,240 rows (max 500); aggregate first")


def test_six_series_is_refused():
    cols = [{"name": "q", "type": "string"}] + [{"name": f"s{i}", "type": "number"} for i in range(6)]
    args = _bar_args(columns=cols, rows=[["Q1", 1, 2, 3, 4, 5, 6]],
                     chart={"kind": "bar", "x": "q", "y": [f"s{i}" for i in range(6)]})
    res, ins, _g, _l, ctx, _s = _call(args=args)
    _assert_refused(res, ins, ctx, "6 series (max 4)")


@pytest.mark.parametrize("over", [
    {"parent_run_id": UUID("2a6c8e04-1b3d-4f57-9a8c-6e0d2b4f7a13")},
    {"phase_whitelist": frozenset({"search_documents"})},
    {"pool": None},
])
def test_chat_top_level_only(over):
    res, ins, _g, _l, ctx, _s = _call(ctx=_ctx(**over), args=_bar_args())
    _assert_refused(res, ins, ctx, "only available in chat")


def test_insert_failure_is_refused_without_emit():
    ctx = _ctx()
    with patch(f"{MOD}.insert_artifact", new=AsyncMock(side_effect=RuntimeError("db down"))) as ins:
        res = _run(sat.handle_show_artifact(_bar_args(), ctx))
    obj = json.loads(res.result)
    assert obj == {"status": "refused", "reason": "couldn't save the artifact", "detail": obj["detail"]}
    assert "db down" not in res.result
    ctx.emit.assert_not_called()
    assert ins.call_count == 1


def test_emit_failure_still_returns_success(caplog):
    ctx = _ctx(emit=AsyncMock(side_effect=RuntimeError("redis gone")))
    store = _Store()
    res, ins, *_ = _call(store=store, ctx=ctx, args=_bar_args())
    obj = json.loads(res.result)
    assert obj["artifact_id"] == store.rows[0]["id"]
    assert ins.call_count == 1


# ── By reference (D-06 / D-07 / SC#3 / UI-D-07) ────────────────────────────────────────────────

_SERIES = ["Americas", "EMEA", "APAC", "LATAM"]


def _parent():
    rows = []
    for y_i, year in enumerate(["FY22", "FY23", "FY24", "FY25"]):
        for q_i, q in enumerate(["Q1", "Q2", "Q3", "Q4"]):
            base = 100 + 10 * y_i + q_i
            rows.append([q, year, base, base + 1, base + 2, base + 3])
    return {
        "id": "a_parent0001",
        "thread_id": T,
        "user_id": U,
        "org_id": O,
        "run_id": None,
        "tool_call_id": "call_x",
        "parent_id": None,
        "label": "chart 1",
        "component": "chart",
        "spec": {
            "title": "Revenue by region",
            "columns": [{"name": "quarter", "type": "string", "unit": None},
                        {"name": "year", "type": "string", "unit": None}]
                       + [{"name": s, "type": "number", "unit": "$K"} for s in _SERIES],
            "rows": rows,
            "chart": {"kind": "line", "x": "quarter", "y": list(_SERIES), "stacked": False,
                      "slots": [0, 1, 2, 3]},
            "metric": None,
        },
        "caption": {
            "row_count": 16,
            "sources": [{"tool": "query_tables", "document": "Quarterly_Report_FY25.pdf", "page": 4}],
            "source_count": 1,
            "lineage": None,
        },
        "row_count": 16,
        "spec_version": 1,
        "created_at": "2026-10-03T14:22:07.481233+00:00",
    }


def _no_retrieval_patches():
    boom = AsyncMock(side_effect=AssertionError("retrieval / code must not run"))
    return [
        patch("app.services.retrieval_service.search_documents", new=boom),
        patch("app.services.retrieval_service.fetch_full_document", new=boom),
        patch("app.services.tool_dispatcher.search_documents", new=boom),
        patch("app.services.tool_dispatcher.query_documents", new=boom),
        patch("app.services.tool_dispatcher._handle_execute_code", new=boom),
        patch("app.services.tool_dispatcher._handle_query_tables", new=boom),
        patch("app.services.search_documents_tool.handle_search_documents", new=boom),
    ]


def test_by_reference_filter_reencodes_parent_rows_with_zero_retrieval():
    parent = _parent()
    args = {
        "component": "chart",
        "title": "Q3 by region",
        "from_artifact": "chart 1",
        "chart": {"kind": "bar", "x": "quarter", "y": ["APAC", "EMEA"]},
        "transform": {"filter": [{"column": "quarter", "op": "eq", "value": "Q3"}]},
    }
    patches = _no_retrieval_patches()
    for p in patches:
        p.start()
    try:
        res, ins, get, _lst, ctx, store = _call(args=args, parent=parent,
                                                ctx=_ctx(turn_tool_calls=[
                                                    {"tool_call_id": "z", "name": "web_search",
                                                     "status": "done", "args": {}, "result": "x"}]))
    finally:
        for p in patches:
            p.stop()

    get.assert_called_once()
    gkw = get.call_args.kwargs
    assert gkw["ref"] == "chart 1"
    assert str(gkw["thread_id"]) == T
    assert str(gkw["user_id"]) == U

    kw = ins.call_args.kwargs
    expected_rows = [r for r in parent["spec"]["rows"] if r[0] == "Q3"]
    assert len(expected_rows) == 4
    assert kw["spec"]["rows"] == expected_rows
    assert kw["spec"]["chart"]["y"] == ["EMEA", "APAC"]
    assert kw["spec"]["chart"]["slots"] == [1, 2]
    assert kw["parent_id"] == parent["id"]
    assert kw["row_count"] == 4
    cap = kw["caption"]
    assert cap["sources"] == parent["caption"]["sources"]  # inherited — NOT this turn's web_search
    assert cap["source_count"] == 1
    assert cap["lineage"] == {
        "parent_label": "chart 1",
        "parent_row_count": 16,
        "same_rows": False,
        "operations": [{"op": "filter_eq", "column": "quarter", "value": "Q3"}],
    }
    obj = json.loads(res.result)
    assert obj["from_label"] == "chart 1"
    assert obj["same_rows"] is False
    assert ctx.emit.call_count == 1


def test_by_reference_kind_change_keeps_the_same_rows():
    parent = _parent()
    args = {"component": "chart", "title": "As bars", "from_artifact": "a_parent0001",
            "chart": {"kind": "bar", "x": "quarter", "y": list(_SERIES)}}
    _res, ins, *_ = _call(args=args, parent=parent)
    kw = ins.call_args.kwargs
    assert kw["spec"]["rows"] == parent["spec"]["rows"]
    assert kw["caption"]["lineage"]["same_rows"] is True
    assert kw["caption"]["lineage"]["operations"] == []
    assert kw["spec"]["chart"]["slots"] == [0, 1, 2, 3]


def test_new_series_name_takes_the_lowest_free_slot():
    assert sat.inherit_slots({"y": ["A", "B"], "slots": [0, 1]}, ["B", "C"]) == (["B", "C"], [1, 2])
    assert sat.inherit_slots({"y": ["A", "B", "C", "D"], "slots": [0, 1, 2, 3]}, ["D", "E"]) == (["D", "E"], [3, 0])
    assert sat.inherit_slots(None, ["X", "Y"]) == (["X", "Y"], [0, 1])


def _table_parent():
    p = _parent()
    p["component"] = "table"
    p["label"] = "table 1"
    p["spec"]["chart"] = None
    return p


def _transform(parent, transform, select_cols=None):
    return sat.apply_transforms(parent["spec"], sat.validate_args({
        "component": "table", "title": "t", "from_artifact": "table 1", "transform": transform,
    }).transform)


def test_filter_in():
    cols, rows, ops, same = _transform(_parent(), {"filter": [{"column": "quarter", "op": "in", "values": ["Q1", "Q2"]}]})
    assert len(rows) == 8
    assert {r[0] for r in rows} == {"Q1", "Q2"}
    assert ops == [{"op": "filter_in", "column": "quarter", "values": ["Q1", "Q2"]}]
    assert same is False


def test_filter_range_coerces_string_bounds():
    cols, rows, ops, _ = _transform(_parent(), {"filter": [{"column": "Americas", "op": "range", "min": "100", "max": 120}]})
    assert rows and all(100 <= r[2] <= 120 for r in rows)
    assert ops[0]["op"] == "filter_range"
    assert ops[0]["min"] == 100 and ops[0]["max"] == 120


def test_sort_desc_then_top_n():
    cols, rows, ops, same = _transform(_parent(), {"sort": {"column": "Americas", "direction": "desc"}, "top_n": 3})
    assert [r[2] for r in rows] == [133, 132, 131]
    assert [o["op"] for o in ops] == ["top_n", "sort"]
    assert ops[0] == {"op": "top_n", "n": 3, "column": "Americas"}
    assert same is False


def test_sort_puts_nulls_last_both_directions():
    p = _table_parent()
    p["spec"]["rows"][0][2] = None
    for direction in ("asc", "desc"):
        _c, rows, _o, same = _transform(p, {"sort": {"column": "Americas", "direction": direction}})
        assert rows[-1][2] is None
        assert same is True


def test_select_drops_columns_for_a_table():
    parent = _table_parent()
    args = {"component": "table", "title": "slim", "from_artifact": "table 1",
            "transform": {"select": ["quarter", "EMEA"]}}
    _res, ins, *_ = _call(args=args, parent=parent)
    kw = ins.call_args.kwargs
    assert [c["name"] for c in kw["spec"]["columns"]] == ["quarter", "EMEA"]
    assert all(len(r) == 2 for r in kw["spec"]["rows"])
    assert kw["caption"]["lineage"]["operations"] == [{"op": "select", "columns": ["quarter", "EMEA"]}]
    assert kw["caption"]["lineage"]["same_rows"] is True


def test_select_refuses_when_the_encoding_needs_the_dropped_column():
    args = {"component": "chart", "title": "x", "from_artifact": "chart 1",
            "chart": {"kind": "bar", "x": "quarter", "y": ["APAC"]},
            "transform": {"select": ["quarter", "EMEA"]}}
    res, ins, _g, _l, ctx, _s = _call(args=args, parent=_parent())
    _assert_refused(res, ins, ctx, "APAC isn't one of its columns")


def test_top_n_without_sort_is_refused():
    args = {"component": "table", "title": "x", "from_artifact": "table 1", "transform": {"top_n": 3}}
    res, ins, _g, _l, ctx, _s = _call(args=args, parent=_table_parent())
    _assert_refused(res, ins, ctx, "a top-N needs a sort order")


def test_filter_on_unknown_column_names_it_only_when_safe():
    args = {"component": "table", "title": "x", "from_artifact": "table 1",
            "transform": {"filter": [{"column": "region", "op": "eq", "value": "EMEA"}]}}
    res, ins, _g, _l, ctx, _s = _call(args=args, parent=_table_parent())
    _assert_refused(res, ins, ctx, "region isn't one of its columns")

    args["transform"]["filter"][0]["column"] = "<img src=x>"
    res, ins, _g, _l, ctx, _s = _call(args=args, parent=_table_parent())
    obj = _assert_refused(res, ins, ctx)
    assert "<img" not in obj["reason"]


def test_filter_matching_zero_rows_is_refused():
    args = {"component": "table", "title": "x", "from_artifact": "table 1",
            "transform": {"filter": [{"column": "quarter", "op": "eq", "value": "Q9"}]}}
    res, ins, _g, _l, ctx, _s = _call(args=args, parent=_table_parent())
    _assert_refused(res, ins, ctx, "the filter matched 0 of 16 rows")


def test_unknown_label_lists_the_threads_labels():
    args = {"component": "table", "title": "x", "from_artifact": "chart 9"}
    res, ins, get, lst, ctx, _s = _call(args=args, parent=None, labels=["chart 1", "table 1"])
    obj = _assert_refused(res, ins, ctx, "chart 9 isn't in this thread")
    assert "chart 1" in obj["detail"] and "table 1" in obj["detail"]
    assert str(lst.call_args.kwargs["thread_id"]) == T
    assert str(lst.call_args.kwargs["user_id"]) == U


def test_malformed_ref_is_never_echoed():
    args = {"component": "table", "title": "x", "from_artifact": "<script>"}
    res, ins, _g, _l, ctx, _s = _call(args=args, parent=None, labels=["chart 1"])
    obj = _assert_refused(res, ins, ctx, "that artifact isn't in this thread")
    assert "<script>" not in res.result


def test_metric_from_many_rows_needs_a_narrowing_filter():
    args = {"component": "metric", "title": "Americas", "from_artifact": "chart 1",
            "metric": {"value_column": "Americas"}}
    res, ins, _g, _l, ctx, _s = _call(args=args, parent=_parent())
    _assert_refused(res, ins, ctx, "a metric needs exactly one row")


def test_metric_by_reference_with_a_narrowing_filter_succeeds():
    args = {"component": "metric", "title": "Q3 FY25 Americas", "from_artifact": "chart 1",
            "metric": {"value_column": "Americas"},
            "transform": {"filter": [{"column": "quarter", "op": "eq", "value": "Q3"},
                                     {"column": "year", "op": "eq", "value": "FY25"}]}}
    _res, ins, *_ = _call(args=args, parent=_parent())
    kw = ins.call_args.kwargs
    assert kw["component"] == "metric"
    assert kw["spec"]["rows"] == [["Q3", "FY25", 132, 133, 134, 135]]
    assert kw["spec"]["chart"] is None
    assert kw["spec"]["metric"]["value_column"] == "Americas"


# ── Module hygiene (cycle rule, no error key, no retrieval imports) ────────────────────────────

_SRC = Path(sat.__file__).read_text(encoding="utf-8")


def test_no_module_level_dispatcher_import():
    assert not re.search(r"^(from app\.services\.tool_dispatcher|import app\.services\.tool_dispatcher)", _SRC, re.M)


def test_no_error_key_literal():
    assert '"error"' not in _SRC


def test_no_retrieval_or_sandbox_import():
    code = "\n".join(l for l in _SRC.splitlines() if not l.lstrip().startswith("#"))
    assert not re.search(r"^\s*(from|import)\s+app\.services\.(retrieval_service|sandbox_service|sql_service)", code, re.M)
    assert "execute_code(" not in code


# ── 273-REVIEW WR-07: every refusal stays valid JSON under the 2,000-char cut ──────────────────


def _assert_whole_refusal(res):
    assert len(res.result) < sat.RESULT_MAX_CHARS, len(res.result)
    obj = json.loads(res.result)  # a cut payload would not parse — and the rail would read it as "done"
    assert set(obj) == {"status", "reason", "detail"} and obj["status"] == "refused"
    return obj


def test_wr07_unknown_reference_on_a_long_thread_names_only_the_newest_labels():
    labels = [f"chart {i}" for i in range(1, 401)]
    res, ins, *_ = _call(args={"component": "table", "title": "t", "from_artifact": "chart 999"}, labels=labels)
    obj = _assert_whole_refusal(res)
    assert "chart 400" in obj["detail"]
    assert "chart 1," not in obj["detail"]
    assert "380 earlier" in obj["detail"]
    ins.assert_not_called()


def test_wr07_a_refusal_detail_built_from_long_column_names_is_cut_to_fit():
    parent = _parent()
    names = [f'{i:02d}' + '"' * 62 for i in range(20)]  # JSON-escaped, each name doubles in size
    parent["spec"]["columns"] = [{"name": n, "type": "number", "unit": None} for n in names]
    parent["spec"]["rows"] = [[1] * 20]
    parent["spec"]["chart"] = {"kind": "line", "x": names[0], "y": [names[1]], "stacked": False, "slots": [0]}
    args = {"component": "table", "title": "t", "from_artifact": "chart 1",
            "transform": {"filter": [{"column": "nope", "op": "eq", "value": 1}]}}
    res, ins, *_ = _call(args=args, parent=parent)
    _assert_whole_refusal(res)
    ins.assert_not_called()

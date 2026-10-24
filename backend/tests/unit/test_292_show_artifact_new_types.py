"""Phase 292-01 — the ``show_artifact`` handler for diagram, comparison and timeline (D-07, D-08, D-14).

Fakes only (no DB), the 273 suite's pattern: ``insert_artifact`` / ``get_artifact_by_ref`` /
``list_thread_labels`` are patched WHERE USED (``app.services.show_artifact_tool.<name>``).
"""
from __future__ import annotations

import asyncio
import copy
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

import app.services.show_artifact_tool as sat
from app.models.artifact import StoredComparisonSpec, StoredDiagramSpec, StoredTimelineSpec

U = "0f3a9c71-2b6e-4f18-a5d4-7e8b9c0d1a2f"
T = "5b1f6c2e-8a47-4d3b-9e0f-2c7a1d9b4e63"
O = "c4e2a817-6d09-4b5f-8a3e-91f0b7d2c654"
RUN = UUID("9d7e3b21-4c58-4a6f-b0e2-1f8c6a3d5b79")
MOD = "app.services.show_artifact_tool"

POLICY = (
    "Invoices are received by accounts payable. Any invoice that does not match its purchase order is "
    "returned to the supplier for correction. Approved invoices are paid on the next payment run."
)
CITATIONS = [
    {"document_id": "d1", "chunk_index": 0, "filename": "Invoice_Policy.pdf", "passage": POLICY},
    {"document_id": "d2", "chunk_index": 1, "filename": "Kestrel_Proposal.pdf",
     "passage": "Sixty days' written notice is required to terminate. Liability is capped at twelve months."},
]


def _run(coro):
    return asyncio.run(coro)


def _ctx(**over):
    base = dict(
        redis=object(), run_id=RUN, thread_id=T, pool=object(), current_user={"id": U, "org_id": O},
        emit=AsyncMock(), tool_call_id="call_0", parent_run_id=None, phase_whitelist=None,
        turn_tool_calls=[], turn_citations=list(CITATIONS),
        # 292-REVIEW WR-01: the manifest the model was shown numbered both sources.
        turn_citations_seen=2,
    )
    base.update(over)
    return SimpleNamespace(**base)


class _Store:
    def __init__(self):
        self.rows: list[dict] = []

    async def __call__(self, pool, **kw):
        n = sum(1 for r in self.rows if r["component"] == kw["component"]) + 1
        row = {
            "id": "a_" + f"{len(self.rows):010d}", "thread_id": str(kw["thread_id"]),
            "user_id": str(kw["user_id"]), "org_id": kw["org_id"],
            "run_id": str(kw["run_id"]) if kw["run_id"] else None, "tool_call_id": kw["tool_call_id"],
            "parent_id": kw["parent_id"], "label": f"{kw['component']} {n}", "component": kw["component"],
            "spec": copy.deepcopy(kw["spec"]), "caption": copy.deepcopy(kw["caption"]),
            "row_count": kw["row_count"], "spec_version": 1, "created_at": "2026-10-24T09:00:00+00:00",
        }
        self.rows.append(row)
        return row


def _call(args, ctx=None, parent=None, labels=None, store=None):
    store = store or _Store()
    ctx = ctx or _ctx()
    with patch(f"{MOD}.insert_artifact", new=AsyncMock(side_effect=store.__call__)) as ins, \
         patch(f"{MOD}.get_artifact_by_ref", new=AsyncMock(return_value=parent)), \
         patch(f"{MOD}.list_thread_labels", new=AsyncMock(return_value=labels or [])):
        res = _run(sat.handle_show_artifact(args, ctx))
    return res, ins, ctx, store


def _refused(res, ins, ctx, reason=None):
    obj = json.loads(res.result)
    assert set(obj) == {"status", "reason", "detail"}, obj
    assert obj["status"] == "refused"
    ins.assert_not_called()
    ctx.emit.assert_not_called()
    if reason is not None:
        assert obj["reason"] == reason, obj
    return obj


NODES = [
    {"id": "recv", "label": "Invoice received", "kind": "start"},
    {"id": "ok", "label": "Matches the purchase order?", "kind": "decision", "source": 1},
    {"id": "chase", "label": "Query the supplier"},
    {"id": "appr", "label": "Budget holder approves"},
    {"id": "ctrl", "label": "Finance controller sign-off"},
    {"id": "sched", "label": "Payment scheduled"},
    {"id": "paid", "label": "Paid on the next payment run", "source": "[1]"},
    {"id": "filed", "label": "Filed for audit", "kind": "end"},
]
EDGES = [
    {"from": "recv", "to": "ok"}, {"from": "ok", "to": "appr", "label": "Yes"},
    {"from": "ok", "to": "chase", "label": "No"}, {"from": "chase", "to": "ok", "label": "Corrected invoice"},
    {"from": "chase", "to": "chase", "label": "Reminder after 5 days"}, {"from": "appr", "to": "ctrl"},
    {"from": "ctrl", "to": "sched"}, {"from": "sched", "to": "paid"}, {"from": "paid", "to": "filed"},
]


def _diagram(**over):
    a = {"component": "diagram", "title": "Invoice approval", "diagram": {"nodes": NODES, "edges": EDGES}}
    a.update(over)
    return a


def _comparison(**over):
    a = {"component": "comparison", "title": "Contracts", "comparison": {
        "options": ["Atlas", "Northwind", "Kestrel"],
        "terms": [
            {"name": "Termination notice", "cells": [{"verdict": "n", "text": "90 days"},
                                                     {"verdict": "y", "text": "30 days"},
                                                     {"verdict": "m", "text": "60 days", "source": 2}]},
            {"name": "SLA credits", "cells": [{"verdict": "y"}, {"verdict": "q"}, {"verdict": "m"}]},
        ]}}
    a.update(over)
    return a


def _timeline(**over):
    a = {"component": "timeline", "title": "History", "timeline": {"events": [
        {"date": "2024-02-09", "title": "Amendment", "deadline": True},
        {"date": "2024-02", "title": "Review month"},
        {"date": "2023-12-01", "title": "Signed", "source": 1},
    ]}}
    a.update(over)
    return a


# ── diagram ──────────────────────────────────────────────────────────────────────────────────────


def test_diagram_stores_one_row_with_resolved_sources_and_answers_id_first():
    res, ins, ctx, store = _call(_diagram())
    assert ins.call_count == 1
    kw = ins.call_args.kwargs
    assert kw["component"] == "diagram"
    assert kw["row_count"] == 8
    assert kw["parent_id"] is None
    spec = kw["spec"]
    assert StoredDiagramSpec.model_validate(spec).model_dump(by_alias=True) == spec
    assert set(spec) == {"title", "diagram"}
    assert spec["diagram"]["edges"][0] == {"from": "recv", "to": "ok", "label": None}
    by_id = {n["id"]: n for n in spec["diagram"]["nodes"]}
    assert by_id["chase"]["kind"] == "step"
    assert by_id["chase"]["source"] is None
    src = by_id["ok"]["source"]
    assert src["document"] == "Invoice_Policy.pdf" and src["page"] is None
    assert "purchase order is returned" in src["excerpt"]
    assert by_id["paid"]["source"]["document"] == "Invoice_Policy.pdf"
    assert kw["caption"]["row_count"] == 8 and kw["caption"]["lineage"] is None

    assert ctx.emit.call_count == 1
    assert ctx.emit.call_args.kwargs["artifact"] is store.rows[0]

    obj = json.loads(res.result)
    assert list(obj)[0] == "artifact_id"
    assert obj["label"] == "diagram 1"
    assert obj["row_count"] == 8 and obj["edge_count"] == 9
    assert "option_count" not in obj
    assert "from_artifact" not in obj["note"]
    assert "full data" in obj["note"]
    assert len(res.result) < 2000


def test_result_keys_follow_result_key_order():
    from app.models.artifact import RESULT_KEY_ORDER

    res, *_ = _call(_diagram())
    keys = list(json.loads(res.result))
    assert keys == [k for k in RESULT_KEY_ORDER if k in keys]


# ── comparison / timeline ───────────────────────────────────────────────────────────────────────


def test_comparison_result_carries_option_count():
    res, ins, _ctx_, _s = _call(_comparison())
    spec = ins.call_args.kwargs["spec"]
    assert StoredComparisonSpec.model_validate(spec).model_dump(by_alias=True) == spec
    assert ins.call_args.kwargs["row_count"] == 2
    cell = spec["comparison"]["terms"][0]["cells"][2]
    assert cell["source"]["document"] == "Kestrel_Proposal.pdf"
    assert "Sixty days" in cell["source"]["excerpt"]
    assert spec["comparison"]["terms"][1]["cells"][1] == {"verdict": "q", "text": None, "source": None}
    obj = json.loads(res.result)
    assert obj["option_count"] == 3 and obj["row_count"] == 2
    assert "edge_count" not in obj


def test_timeline_is_stored_sorted_with_its_sources_following_their_events():
    res, ins, _c, _s = _call(_timeline())
    spec = ins.call_args.kwargs["spec"]
    assert StoredTimelineSpec.model_validate(spec).model_dump(by_alias=True) == spec
    events = spec["timeline"]["events"]
    assert [e["date"] for e in events] == ["2023-12-01", "2024-02", "2024-02-09"]
    assert events[0]["source"]["document"] == "Invoice_Policy.pdf"
    assert events[1]["source"] is None and events[2]["deadline"] is True
    assert events[1] == {"date": "2024-02", "title": "Review month", "detail": None, "category": None,
                         "deadline": False, "source": None}
    assert ins.call_args.kwargs["row_count"] == 3
    obj = json.loads(res.result)
    assert obj["row_count"] == 3


def test_timeline_sort_is_stable_on_input_order():
    events = [{"date": "2025-01", "title": "B"}, {"date": "2025-01", "title": "A"}, {"date": "2024-12", "title": "C"}]
    _res, ins, _c, _s = _call(_timeline(timeline={"events": events}))
    assert [e["title"] for e in ins.call_args.kwargs["spec"]["timeline"]["events"]] == ["C", "B", "A"]


# ── source handles ──────────────────────────────────────────────────────────────────────────────


def test_a_stale_handle_is_refused():
    nodes = [dict(NODES[0], source=3)] + NODES[1:]
    res, ins, ctx, _s = _call(_diagram(diagram={"nodes": nodes, "edges": EDGES}))
    obj = _refused(res, ins, ctx, "a source it cites wasn't retrieved in this turn")
    assert "1-2" in obj["detail"]


def test_continue_run_with_no_retrieval_refuses_a_handle():
    # RESEARCH IN-01: a Continue run starts with an empty retrieved_citations.
    res, ins, ctx, _s = _call(_diagram(), ctx=_ctx(turn_citations=[]))
    obj = _refused(res, ins, ctx, "a source it cites wasn't retrieved in this turn")
    assert "nothing was retrieved" in obj["detail"]


def test_an_unwired_ctx_is_no_retrieval():
    ctx = _ctx()
    del ctx.turn_citations
    res, ins, ctx, _s = _call(_diagram(), ctx=ctx)
    _refused(res, ins, ctx, "a source it cites wasn't retrieved in this turn")
    plain = [{k: v for k, v in n.items() if k != "source"} for n in NODES]
    ctx2 = _ctx()
    del ctx2.turn_citations
    res2, ins2, _c2, _s2 = _call(_diagram(diagram={"nodes": plain, "edges": EDGES}), ctx=ctx2)
    assert ins2.call_count == 1
    assert all(n["source"] is None for n in ins2.call_args.kwargs["spec"]["diagram"]["nodes"])
    assert json.loads(res2.result)["edge_count"] == 9


# ── D-08: never by reference ─────────────────────────────────────────────────────────────────────


def _parent(component: str, label: str) -> dict:
    spec = {"title": "x"}
    if component in ("chart", "table", "metric"):
        spec.update({"columns": [{"name": "a", "type": "string", "unit": None}], "rows": [["x"]],
                     "chart": None, "metric": None})
    return {"id": "a_0000000009", "label": label, "component": component, "spec": spec,
            "caption": {"row_count": 1, "sources": [], "source_count": 0, "lineage": None}, "row_count": 1}


def test_a_diagram_from_a_stored_table_is_refused():
    res, ins, ctx, _s = _call({"component": "diagram", "title": "t", "from_artifact": "table 1"},
                              parent=_parent("table", "table 1"))
    _refused(res, ins, ctx, "a table can't be turned into a diagram; send the data again")


def test_a_diagram_from_a_stored_timeline_is_refused():
    res, ins, ctx, _s = _call({"component": "diagram", "title": "t", "from_artifact": "timeline 1"},
                              parent=_parent("timeline", "timeline 1"))
    _refused(res, ins, ctx, "timeline 1 can't be redrawn by reference; send the data again")


def test_a_new_type_reference_to_a_missing_artifact_uses_the_unknown_ref_refusal():
    res, ins, ctx, _s = _call({"component": "comparison", "title": "t", "from_artifact": "chart 4"},
                              parent=None, labels=["chart 1"])
    obj = _refused(res, ins, ctx)
    assert obj["reason"] == "chart 4 isn't in this thread"


def test_a_table_from_a_stored_diagram_is_refused_and_never_transformed():
    with patch(f"{MOD}.apply_transforms", side_effect=AssertionError("apply_transforms ran")) as spy:
        res, ins, ctx, _s = _call({"component": "table", "title": "t", "from_artifact": "diagram 1"},
                                  parent=_parent("diagram", "diagram 1"))
    spy.assert_not_called()
    _refused(res, ins, ctx, "diagram 1 can't be redrawn by reference; send the data again")


def test_a_tabular_reference_to_a_tabular_parent_still_works():
    res, ins, _c, _s = _call({"component": "table", "title": "t", "from_artifact": "table 1"},
                             parent=_parent("table", "table 1"))
    assert ins.call_count == 1
    assert json.loads(res.result)["from_label"] == "table 1"


# ── refusals stay small and keyless ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize("args", [
    _diagram(component="mindmap"),
    {"component": "diagram", "title": "t", "diagram": {"nodes": [{"id": "a", "label": "x"}], "edges": []}},
    {"component": "timeline", "title": "t", "timeline": {"events": [{"date": "24 Oct", "title": "t"}]}},
])
def test_validation_refusals_are_worded_and_store_nothing(args):
    res, ins, ctx, _s = _call(args)
    obj = _refused(res, ins, ctx)
    assert len(res.result) < 2000
    assert "error" not in obj


def test_insert_failure_is_a_worded_refusal():
    async def boom(*a, **k):
        raise RuntimeError("db down")

    ctx = _ctx()
    with patch(f"{MOD}.insert_artifact", new=AsyncMock(side_effect=boom)), \
         patch(f"{MOD}.get_artifact_by_ref", new=AsyncMock(return_value=None)), \
         patch(f"{MOD}.list_thread_labels", new=AsyncMock(return_value=[])):
        res = _run(sat.handle_show_artifact(_timeline(), ctx))
    obj = json.loads(res.result)
    assert obj["status"] == "refused" and obj["reason"] == "couldn't save the artifact"
    ctx.emit.assert_not_called()

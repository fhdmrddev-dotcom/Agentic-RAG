"""TIER-01 fence — every workflow AUTHORING WRITE carries the tier gate (v4.3 audit).

Phase 258 wired ``require_capability("workflows")`` onto create_draft and publish only; the
independent 258 verification found six more write doors (draft PATCH, /generate — which spends
LLM tokens — both template routes, schedule create/patch) plus schedule run-now answering an
entitlement refusal with a false "deleted, or no longer yours". This fence walks the real routers:
any POST/PATCH/PUT route gated by the workflow-authoring visibility dependency must ALSO carry
the capability dependency. Reads (GET) and DELETE are deliberately exempt — a downgraded org must
still be able to see and remove what it already has.
"""
from __future__ import annotations

import inspect

import pytest

from app.api import schedules, workflows

WRITE = {"POST", "PATCH", "PUT"}


def _dep_calls(route):
    return [d.call for d in route.dependant.dependencies]


def _is_authoring_visibility(call) -> bool:
    # require_visible("workflow_authoring") returns a closure `_dep` over `feature`
    cv = inspect.getclosurevars(call).nonlocals if callable(call) else {}
    return getattr(call, "__name__", "") == "_dep" and cv.get("feature") == "workflow_authoring"


def _is_capability(call) -> bool:
    cv = inspect.getclosurevars(call).nonlocals if callable(call) else {}
    return getattr(call, "__name__", "") == "_require_capability" and cv.get("capability") == "workflows"


def _routes():
    out = []
    for r in [*workflows.router.routes, *schedules.router.routes, *schedules.workflow_router.routes]:
        methods = getattr(r, "methods", set()) or set()
        if methods & WRITE and hasattr(r, "dependant"):
            out.append(r)
    return out


def test_fence_sees_the_authoring_writes():
    gated = [r for r in _routes() if any(_is_authoring_visibility(c) for c in _dep_calls(r))]
    assert len(gated) >= 9, [r.path for r in gated]  # non-vacuity: 6 workflow + 3 schedule writes


@pytest.mark.parametrize("route", _routes(), ids=lambda r: f"{sorted(r.methods)}:{r.path}")
def test_authoring_write_also_carries_the_tier_gate(route):
    calls = _dep_calls(route)
    if not any(_is_authoring_visibility(c) for c in calls):
        pytest.skip("not an authoring-gated write")
    assert any(_is_capability(c) for c in calls), f"{route.path} is authoring-gated but not tier-gated"

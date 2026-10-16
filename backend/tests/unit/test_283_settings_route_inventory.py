"""Phase 283 Plan 02 (FIX-01 / BUG-261004-02, D-11) — every /settings route, inventoried against the gate.

WHAT THIS FENCE PROTECTS. Phase 283 lets every member open the Settings page. The page hides the
operator tabs, but the page is not the wall — the API is. The two-role fence
(``test_283_settings_two_role_fence.py``) proves the four routes that exist TODAY refuse a member.
This file closes the other half: a FUTURE ``/settings/*`` route added without
``require_visible("model_management")`` would be reachable by every member the moment the door
opened, and no existing test would notice.

THE INVENTORY is the UNION of (a) every route whose endpoint lives in ``app.api.settings`` and (b)
every route whose path is ``/settings`` or starts with ``/settings/`` — so a gated-looking path
mounted from another module is caught too. Floors (>= 5 routes, exactly 4 gated) stop a prefix
rename from letting the test pass over zero routes.

HOW A ROUTE'S GATE IS READ. ``require_visible(feature)`` is a factory; the dependency it returns is a
closure whose free variable ``feature`` names the gate. The detector walks the route's dependant
tree and reads that cell. If ``require_visible`` ever stops carrying ``feature`` in its closure, the
detector FAILS LOUDLY rather than reporting "no gate found" (which would read as an ungated route,
or worse, pass).

The ONE allow-listed exception is ``GET /settings/providers`` — the Phase 148 Run carve-out that
feeds the chat model picker. It must carry NO ``require_visible`` at all.

Driven RED (283-02 SUMMARY): stripping the gate from ``GET /settings`` breaks the exact gated count;
a planted ungated ``GET /settings/_planted`` is named by the inventory.
"""
from fastapi import APIRouter, Depends, FastAPI

from app.dependencies import require_visible
from app.main import app

GATE = "model_management"
ALLOW_LIST = {("GET", "/settings/providers")}


def _require_visible_features(route) -> set[str]:
    """Every feature a route's ``require_visible`` dependencies gate on (sub-dependencies included)."""
    found: set[str] = set()
    stack = list(route.dependant.dependencies)
    while stack:
        dep = stack.pop()
        call = getattr(dep, "call", None)
        if call is not None and "require_visible.<locals>" in getattr(call, "__qualname__", ""):
            cells = dict(
                zip(call.__code__.co_freevars, (c.cell_contents for c in (call.__closure__ or ())))
            )
            assert "feature" in cells, (
                "require_visible's closure no longer carries `feature` — update this fence; "
                "it must never silently pass"
            )
            found.add(cells["feature"])
        stack.extend(getattr(dep, "dependencies", []) or [])
    return found


def _is_settings_route(route) -> bool:
    path = getattr(route, "path", "")
    endpoint = getattr(route, "endpoint", None)
    module = getattr(endpoint, "__module__", "")
    return module == "app.api.settings" or path == "/settings" or path.startswith("/settings/")


def _inventory(routes):
    """[(method, path, features)] for every settings route, one row per HTTP method."""
    rows = []
    for route in routes:
        if not hasattr(route, "dependant") or not _is_settings_route(route):
            continue
        features = _require_visible_features(route)
        for method in sorted(getattr(route, "methods", None) or ()):
            if method in ("HEAD", "OPTIONS"):
                continue
            rows.append((method, route.path, features))
    return rows


def _violations(rows):
    """(ungated, wrongly_gated) — the allow-list is exempt from the first and pinned bare."""
    ungated, wrong = [], []
    for method, path, features in rows:
        key = (method, path)
        if key in ALLOW_LIST:
            continue
        if not features:
            ungated.append(key)
        elif features != {GATE}:
            wrong.append((key, features))
    return ungated, wrong


# ── the live app ──────────────────────────────────────────────────────────────

def test_every_settings_route_is_gated_on_model_management_except_the_run_carve_out():
    rows = _inventory(app.routes)
    keys = {(m, p) for m, p, _ in rows}

    # Non-vacuity floors: a prefix rename must never let this pass over nothing.
    assert len(rows) >= 5, f"settings inventory collapsed to {len(rows)} routes: {sorted(keys)}"
    gated = [(m, p) for m, p, f in rows if f == {GATE}]
    assert len(gated) == 4, f"expected exactly 4 model_management-gated settings routes, got {sorted(gated)}"

    ungated, wrong = _violations(rows)
    assert not ungated, (
        f"/settings route(s) reachable by EVERY member — add "
        f"Depends(require_visible({GATE!r})) or justify an allow-list entry: {sorted(ungated)}"
    )
    assert not wrong, f"/settings route(s) gated on the wrong feature: {wrong}"


def test_the_providers_carve_out_exists_and_carries_no_gate():
    rows = {(m, p): f for m, p, f in _inventory(app.routes)}
    assert ("GET", "/settings/providers") in rows, "the Run carve-out route moved or vanished"
    assert rows[("GET", "/settings/providers")] == set(), (
        "GET /settings/providers must stay ungated — it feeds every member's chat model picker"
    )


# ── permanent detector self-test ──────────────────────────────────────────────

def _throwaway_routes():
    router = APIRouter(prefix="/settings")

    @router.get("/gated", dependencies=[Depends(require_visible(GATE))])
    async def gated():  # pragma: no cover - never called
        return {}

    @router.get("/naked")
    async def naked():  # pragma: no cover - never called
        return {}

    @router.get("/elsewhere", dependencies=[Depends(require_visible("skill_studio"))])
    async def elsewhere():  # pragma: no cover - never called
        return {}

    throwaway = FastAPI()
    throwaway.include_router(router)
    return throwaway.routes


def test_detector_names_an_ungated_route_and_a_wrongly_gated_one():
    """If this ever passes over a broken detector, the live inventory above means nothing."""
    rows = _inventory(_throwaway_routes())
    by_key = {(m, p): f for m, p, f in rows}
    assert by_key[("GET", "/settings/gated")] == {GATE}
    assert by_key[("GET", "/settings/naked")] == set()

    ungated, wrong = _violations(rows)
    assert ungated == [("GET", "/settings/naked")]
    assert wrong == [(("GET", "/settings/elsewhere"), {"skill_studio"})]

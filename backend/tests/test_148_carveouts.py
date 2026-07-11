"""Phase 148 Wave 0 (VIS-01 / T-148-08) — RED scaffold for the Run carve-outs.

Encodes the D-05 "Run stays for everyone" carve-outs that 148-05 (wave 3) must preserve
while gating the authoring/management endpoints:

  - GET /settings/providers (chat model picker) stays UNGATED — but GET/PUT /settings ARE
    gated by require_visible("model_management");
  - GET /workflows/published + GET /workflows/starters (Run picker feeds) stay UNGATED —
    but POST /workflows/generate (authoring) IS gated by require_visible("workflow_authoring");
  - the app.api.threads workflow-launch path is NEVER require_visible-gated (Run for everyone).

Each test introspects the registered route's flattened dependency tree for the
``require_visible`` closure (its __qualname__ carries ``require_visible.<locals>.``). The
governed-endpoint assertions are the RED driver — nothing carries the gate today, so they
fail until wave 3 wires it; the carve-out assertions guard against over-gating. Owner: 148-05.
"""


def _flat_dep_calls(route):
    """Every dependency callable in a route's dependant tree (flattened, incl. sub-deps)."""
    calls = []
    dependant = getattr(route, "dependant", None)
    if dependant is None:
        return calls
    stack = list(getattr(dependant, "dependencies", []))
    while stack:
        d = stack.pop()
        call = getattr(d, "call", None)
        if call is not None:
            calls.append(call)
        stack.extend(getattr(d, "dependencies", []))
    return calls


def _has_require_visible(route):
    """True iff any dependency of the route is a require_visible(...) closure."""
    for call in _flat_dep_calls(route):
        if "require_visible" in getattr(call, "__qualname__", ""):
            return True
    return False


def _find_route(app, path, method):
    for r in app.routes:
        if getattr(r, "path", None) == path and method in (getattr(r, "methods", set()) or set()):
            return r
    return None


def test_settings_gated_but_providers_carveout():
    """PUT /settings is model_management-gated; GET /settings/providers stays ungated."""
    from app.main import app

    settings_write = _find_route(app, "/settings", "PUT")
    providers = _find_route(app, "/settings/providers", "GET")
    assert settings_write is not None, "PUT /settings route must exist"
    assert providers is not None, "GET /settings/providers route must exist"

    # RED driver: the governed write MUST carry require_visible (fails until wave 3).
    assert _has_require_visible(settings_write), \
        "PUT /settings must be gated by require_visible('model_management')"
    # Carve-out: the chat model picker feed must NEVER be gated (over-gating = end-user outage).
    assert not _has_require_visible(providers), \
        "GET /settings/providers is a Run carve-out and must stay ungated (Pitfall 3)"


def test_workflows_authoring_gated_but_run_feeds_carveout():
    """POST /workflows/generate is authoring-gated; published/starters stay ungated."""
    from app.main import app

    generate = _find_route(app, "/workflows/generate", "POST")
    published = _find_route(app, "/workflows/published", "GET")
    starters = _find_route(app, "/workflows/starters", "GET")
    assert generate is not None, "POST /workflows/generate route must exist"
    assert published is not None and starters is not None, "Run picker feed routes must exist"

    # RED driver: the authoring endpoint MUST carry require_visible (fails until wave 3).
    assert _has_require_visible(generate), \
        "POST /workflows/generate must be gated by require_visible('workflow_authoring')"
    # Carve-outs: the Run picker feeds must NEVER be gated.
    assert not _has_require_visible(published), "GET /workflows/published must stay ungated (Run)"
    assert not _has_require_visible(starters), "GET /workflows/starters must stay ungated (Run)"


def test_threads_launch_never_require_visible_gated():
    """No app.api.threads route may carry require_visible — the workflow launch is Run-for-all."""
    from app.main import app

    for r in app.routes:
        endpoint = getattr(r, "endpoint", None)
        if getattr(endpoint, "__module__", "") == "app.api.threads":
            assert not _has_require_visible(r), (
                f"{getattr(r, 'path', '?')} (threads) must not be require_visible-gated — "
                "the workflow LAUNCH stays for everyone (D-05)"
            )

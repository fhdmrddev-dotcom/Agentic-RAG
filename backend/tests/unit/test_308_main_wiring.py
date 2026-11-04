"""Phase 308-04 Task 3 (D-10, D-37, D-50; T-308 log leak) — ``main.py``'s webhook wiring, read from
the SOURCE (an AST walk; nothing boots) plus ``app.openapi()`` read directly.

⚠ SEED-363: never enter the real lifespan here (no ``TestClient(app)`` context) — its boot sweeps
and the drainer itself would run against the shared local DB.

The four D-50 hunks: ``webhooks`` in the ``from app.api import …`` list, the two
``include_router`` lines, the gated lazy start of ``WebhookDrainer`` into
``app_instance.state.webhook_drainer``, and its stop. Plus one line that is NOT a D-50 hunk and is
pinned here on purpose: httpx is held at WARNING, because at INFO httpx logs the FULL request URL —
a receiver's path / query token — and the opt-in file sink lowers logging to INFO with no URL
redaction (308-02 handoff).
"""
from __future__ import annotations

import ast
import logging
from pathlib import Path

import pytest

MAIN = Path(__file__).resolve().parents[2] / "app" / "main.py"
GATE = "not _setup_mode and RUN_BOOT_SWEEPS"


@pytest.fixture(scope="module")
def tree() -> ast.Module:
    return ast.parse(MAIN.read_text(encoding="utf-8"))


def _lifespan(tree: ast.Module) -> ast.AsyncFunctionDef:
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and any(
            isinstance(n, ast.Attribute) and ast.unparse(n).startswith("app_instance.state")
            for n in ast.walk(node)
        ):
            return node
    raise AssertionError("no lifespan found in main.py")


def test_webhooks_is_in_the_api_import_list(tree):
    imports = [
        n for n in tree.body
        if isinstance(n, ast.ImportFrom) and n.module == "app.api"
        and any(a.name == "api_keys" for a in n.names)
    ]
    assert len(imports) == 1
    assert "webhooks" in {a.name for a in imports[0].names}


@pytest.mark.parametrize("target", ["webhooks.router", "webhooks.org_router"])
def test_both_routers_are_included_once(tree, target):
    calls = [
        n for n in ast.walk(tree)
        if isinstance(n, ast.Call) and ast.unparse(n.func) == "app.include_router"
        and n.args and ast.unparse(n.args[0]) == target
    ]
    assert len(calls) == 1
    assert calls[0].keywords == []   # mounted at the router's own prefix


def test_the_drainer_starts_lazily_behind_the_boot_sweep_gate(tree):
    life = _lifespan(tree)
    gated = [
        n for n in ast.walk(life)
        if isinstance(n, ast.If) and ast.unparse(n.test) == GATE
        and any(
            isinstance(m, ast.ImportFrom) and m.module == "app.services.webhook_drainer"
            and [a.name for a in m.names] == ["WebhookDrainer"]
            for m in ast.walk(n)
        )
    ]
    assert len(gated) == 1, "the WebhookDrainer import must sit inside ONE gated If"
    block = gated[0]
    (try_,) = [n for n in block.body if isinstance(n, ast.Try)]
    body = ast.unparse(ast.Module(body=try_.body, type_ignores=[]))
    assert "WebhookDrainer(await get_pg_pool())" in body
    assert ".start()" in body
    assert try_.handlers, "a failed start must not stop the app"
    assigns = [
        n for n in ast.walk(life)
        if isinstance(n, ast.Assign)
        and any(ast.unparse(t) == "app_instance.state.webhook_drainer" for t in n.targets)
    ]
    assert len(assigns) == 1


def test_the_drainer_is_not_imported_at_module_level(tree):
    for node in tree.body:
        if isinstance(node, ast.ImportFrom):
            assert node.module != "app.services.webhook_drainer"


def test_the_drainer_stops_at_shutdown(tree):
    life = _lifespan(tree)
    stops = []
    for node in ast.walk(life):
        if not isinstance(node, ast.Try) or not node.handlers:
            continue
        src = ast.unparse(ast.Module(body=node.body, type_ignores=[]))
        if 'getattr(app_instance.state, "webhook_drainer", None)' in src.replace("'", '"'):
            stops.append(src)
    assert len(stops) == 1
    assert "await" in stops[0] and ".stop()" in stops[0]


def test_maintenance_mode_does_not_gate_the_drainer(tree):
    life = _lifespan(tree)
    for node in ast.walk(life):
        if isinstance(node, ast.If) and "webhook" in ast.unparse(node).lower():
            assert "maintenance" not in ast.unparse(node.test).lower()


def test_httpx_is_held_at_warning_so_a_receiver_url_is_never_logged():
    import app.main  # noqa: F401 — the module-level logging setup

    assert logging.getLogger("httpx").level == logging.WARNING


def test_the_routes_are_in_the_openapi_spec():
    from app.main import app

    paths = app.openapi()["paths"]   # read directly: the lifespan never runs (SEED-363)
    for path in (
        "/webhooks", "/webhooks/{endpoint_id}", "/webhooks/{endpoint_id}/test",
        "/webhooks/{endpoint_id}/deliveries", "/webhooks/{endpoint_id}/roll-secret",
        "/webhooks/{endpoint_id}/deliveries/{delivery_id}/resend",
        "/org/webhooks", "/org/webhooks/{endpoint_id}/disable",
    ):
        assert path in paths, path

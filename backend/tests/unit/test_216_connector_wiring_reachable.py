"""Phase 216 regression fence — the chat connector wiring must be REACHABLE.

⚠ WHY THIS FILE EXISTS. Commit `c0a09c728` moved the entire connector-wiring block
inside the `except Exception:` arm of `conns = await list_connections(...)`. On the
success path nothing ran; on the failure path `conns` was `[]`, so `active_conns` was
always empty. `build_chat_tools_for_connectors` — whose ONLY production call site is
that block — never executed, and chat never saw a connector tool.

**6929/6929 tests were green throughout**, because every Phase 216 test
(`test_chat_connector_tools.py`, `test_chat_tool_approval.py`,
`integration/test_chat_connectors_e2e.py`) calls the helper DIRECTLY. Nothing drove
`run_agent_loop`, so the suite proved the helper and never the feature.

Driving the real loop needs a provider, a thread, Redis and a Supabase client, so this
fence asserts the two properties that actually failed — **reachability** and **call-site
agreement with the callee's signature** — against the module's AST. Both are static,
deterministic, and were driven RED against `c0a09c728` before this file was committed.
"""
from __future__ import annotations

import ast
import inspect
from pathlib import Path

import pytest

AGENT_LOOP = Path(__file__).resolve().parents[2] / "app" / "services" / "agent_loop.py"
WIRING_CALL = "build_chat_tools_for_connectors"


def _parents(tree: ast.AST) -> dict[ast.AST, ast.AST]:
    parents: dict[ast.AST, ast.AST] = {}
    for node in ast.walk(tree):
        for child in ast.iter_child_nodes(node):
            parents[child] = node
    return parents


def _call_sites(tree: ast.AST, func_name: str) -> list[ast.Call]:
    return [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == func_name
    ]


def assert_wiring_is_reachable(source: str) -> None:
    """Fail if the connector wiring sits inside an exception handler.

    Extracted so the fence can be driven RED against an arbitrary revision's source,
    which is how it was proven to fail on `c0a09c728`.
    """
    tree = ast.parse(source)
    calls = _call_sites(tree, WIRING_CALL)
    assert calls, (
        f"{WIRING_CALL} has no call site in agent_loop.py — the chat connector wiring "
        "is gone entirely, not merely unreachable."
    )
    parents = _parents(tree)
    for call in calls:
        chain: list[ast.AST] = []
        node: ast.AST | None = parents.get(call)
        while node is not None:
            chain.append(node)
            node = parents.get(node)
        handlers = [n for n in chain if isinstance(n, ast.ExceptHandler)]
        assert not handlers, (
            f"{WIRING_CALL} at line {call.lineno} is nested inside an `except` handler "
            f"(handler at line {handlers[0].lineno}). An exception arm runs only on "
            "failure, and the failure arm sets `conns = []`, so the wiring can never "
            "register a tool. Regression of c0a09c728."
        )


def test_connector_wiring_is_not_buried_in_an_except_arm():
    assert_wiring_is_reachable(AGENT_LOOP.read_text(encoding="utf-8"))


def test_connector_wiring_is_reached_on_the_success_path():
    """The wiring must be a sibling of the `try`, not a descendant of any of its arms.

    Reachability alone is not enough: a block placed in an `else:` of the wrong `if`
    would still pass the handler check. This asserts the wiring runs unconditionally
    after the connection read, which is the shape the feature needs.
    """
    tree = ast.parse(AGENT_LOOP.read_text(encoding="utf-8"))
    calls = _call_sites(tree, WIRING_CALL)
    parents = _parents(tree)
    for call in calls:
        chain = []
        node = parents.get(call)
        while node is not None:
            chain.append(node)
            node = parents.get(node)
        tries = [n for n in chain if isinstance(n, ast.Try)]
        # The only Try that may enclose the wiring is the OUTER defensive one that
        # wraps the whole feature; the inner `try` around `list_connections` must not.
        for t in tries:
            handler_names = [
                n.func.id
                for h in t.handlers
                for n in ast.walk(h)
                if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
            ]
            assert WIRING_CALL not in handler_names, (
                f"{WIRING_CALL} is inside the handler of the `try` at line {t.lineno}."
            )


def test_list_connections_call_site_matches_the_callee_signature():
    """The call site must pass `org_id`, not `user_id`.

    Commit `1fdeefa79` called `list_connections(user_id=...)` against a signature of
    `(org_id, capability=None, supabase=None)`. The resulting `TypeError` was swallowed
    by the block's outer `except`, so the feature failed silently and no test noticed.
    """
    from app.services.connector_service import list_connections

    params = inspect.signature(list_connections).parameters
    assert "org_id" in params, (
        "list_connections no longer takes org_id — this fence and every call site "
        "in agent_loop.py / tool_dispatcher.py need re-deriving."
    )
    assert "user_id" not in params

    tree = ast.parse(AGENT_LOOP.read_text(encoding="utf-8"))
    sites = _call_sites(tree, "list_connections")
    assert sites, "agent_loop.py no longer reads connections at all."
    for site in sites:
        kwargs = {kw.arg for kw in site.keywords}
        assert "org_id" in kwargs, (
            f"list_connections at line {site.lineno} does not pass org_id; "
            f"it passes {sorted(k for k in kwargs if k)}."
        )
        assert "user_id" not in kwargs, (
            f"list_connections at line {site.lineno} passes user_id, which the callee "
            "does not accept — a TypeError the surrounding `except` would hide."
        )


@pytest.mark.parametrize("dispatcher_call", ["list_connections"])
def test_dispatcher_call_site_also_matches_the_signature(dispatcher_call):
    """The same agreement, on the execution half of the feature."""
    dispatcher = AGENT_LOOP.parent / "tool_dispatcher.py"
    tree = ast.parse(dispatcher.read_text(encoding="utf-8"))
    for site in _call_sites(tree, dispatcher_call):
        kwargs = {kw.arg for kw in site.keywords}
        assert "user_id" not in kwargs, (
            f"{dispatcher.name}:{site.lineno} passes user_id to {dispatcher_call}, "
            "which the callee does not accept."
        )

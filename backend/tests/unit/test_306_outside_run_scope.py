"""Phase 306-03 (D-26 / D-27 / D-02) — the outside-run leaf and Seam A.

1. ``outside_run_scope.py`` is a LEAF (no module-level ``app.`` import) and the ONLY module that
   names ``_allow`` (static walk of ``backend/app``), so ``outside_run_context`` is the one setter.
2. The allow-list is the six walled read tools, non-empty.
3. The value set in a FRESH context reaches the task, a child task and ``run_in_threadpool``, and
   never the caller.
4. ``narrow_schemas``: unset -> None; set -> only allow-listed names in order; empty -> raises.
5. Seam A: ``with_search_vocabulary`` inside an outside run offers exactly the six schemas (with the
   vocabulary still applied); outside one it is byte-identical to the 306-01 function, loaded from
   git at this plan's base.
"""
from __future__ import annotations

import ast
import asyncio
import copy
import json
import re
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.concurrency import run_in_threadpool

REPO_ROOT = Path(__file__).resolve().parents[3]
APP_DIR = REPO_ROOT / "backend" / "app"
LEAF = APP_DIR / "services" / "outside_run_scope.py"

# The base of 306-03: search_vocabulary.py as 306-01 left it (the pure move, no narrowing line).
PLAN_BASE_SHA = "1e5364747b69892789cd7ea711d7be53a1fddba4"

SIX = frozenset({"search_documents", "ls", "tree", "grep", "glob", "read_document"})

SETTINGS = SimpleNamespace(
    web_search_enabled=True,
    sandbox_enabled=True,
    self_improve_enabled=True,
    llm_model="gpt-4o",
    active_provider="openai",
    embedding_model="text-embedding-3-small",
)


def _names(tools) -> list[str]:
    return [t["function"]["name"] for t in tools]


async def _in_outside_run(coro_fn, allow=SIX):
    from app.services.outside_run_scope import outside_run_context

    return await asyncio.create_task(coro_fn(), context=outside_run_context(allow))


# ── 1. the leaf and its one setter ─────────────────────────────────────────────────────────────


def test_the_module_is_a_leaf():
    tree = ast.parse(LEAF.read_text(encoding="utf-8"))
    offenders = []
    for node in tree.body:  # module level only; function-local imports are the cycle-safe idiom
        if isinstance(node, ast.ImportFrom) and (node.module or "").split(".")[0] == "app":
            offenders.append(node.lineno)
        if isinstance(node, ast.Import) and any(a.name.split(".")[0] == "app" for a in node.names):
            offenders.append(node.lineno)
    assert offenders == [], f"outside_run_scope.py imports app. at module level: lines {offenders}"


def test_no_other_module_names_the_contextvar():
    pattern = re.compile(r"\b_allow\b")
    offenders = []
    for path in APP_DIR.rglob("*.py"):
        if path == LEAF:
            continue
        if pattern.search(path.read_text(encoding="utf-8", errors="replace")):
            offenders.append(str(path.relative_to(APP_DIR)))
    assert offenders == [], f"only outside_run_scope.py may name _allow: {offenders}"


def test_the_setter_builds_a_fresh_context_never_a_copy():
    src = LEAF.read_text(encoding="utf-8")
    assert "copy_context" not in src
    tree = ast.parse(src)
    setters = [
        n for n in ast.walk(tree)
        if isinstance(n, ast.Attribute) and n.attr == "set"
        and isinstance(n.value, ast.Name) and n.value.id == "_allow"
    ]
    assert len(setters) == 1, "exactly one _allow.set, inside outside_run_context"


# ── 2. the allow-list ─────────────────────────────────────────────────────────────────────────


def test_the_allowlist_is_the_six_read_tools():
    from app.services.outside_run_scope import ASK_TOOL_ALLOWLIST

    assert ASK_TOOL_ALLOWLIST == SIX
    assert isinstance(ASK_TOOL_ALLOWLIST, frozenset)
    assert ASK_TOOL_ALLOWLIST  # Pitfall 2: [] means every tool downstream


def test_an_empty_allowlist_cannot_be_set():
    from app.services.outside_run_scope import OutsideToolsetEmpty, outside_run_context

    with pytest.raises(OutsideToolsetEmpty):
        outside_run_context(frozenset())


def test_every_allowlisted_name_is_a_registry_tool():
    from app.services.tool_dispatcher import _TOOL_REGISTRY

    assert SIX <= set(_TOOL_REGISTRY)
    assert len(_TOOL_REGISTRY) == 30


# ── 3. propagation ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unset_in_a_plain_coroutine():
    from app.services.outside_run_scope import current_allowlist

    assert current_allowlist() is None


@pytest.mark.asyncio
async def test_the_value_reaches_the_task_a_child_task_and_the_threadpool_but_not_the_caller():
    from app.services.outside_run_scope import current_allowlist

    seen: dict = {}

    async def _child():
        seen["child"] = current_allowlist()

    async def _producer():
        seen["task"] = current_allowlist()
        await asyncio.create_task(_child())
        seen["thread"] = await run_in_threadpool(current_allowlist)
        seen["to_thread"] = await asyncio.to_thread(current_allowlist)

    await _in_outside_run(_producer)
    assert seen == {"task": SIX, "child": SIX, "thread": SIX, "to_thread": SIX}
    assert current_allowlist() is None


@pytest.mark.asyncio
async def test_a_caller_contextvar_does_not_ride_into_the_task():
    """T-306-15: the producer must not see the MCP request's own ContextVars."""
    from contextvars import ContextVar

    request_var: ContextVar = ContextVar("request_scoped_collector", default=None)
    token = request_var.set(["collector"])
    try:
        async def _producer():
            return request_var.get()

        assert await _in_outside_run(_producer) is None
    finally:
        request_var.reset(token)


# ── 4. narrow_schemas ─────────────────────────────────────────────────────────────────────────


def test_narrow_schemas_is_none_when_unset():
    from app.services.openai_service import get_tools
    from app.services.outside_run_scope import narrow_schemas

    assert narrow_schemas(None, SETTINGS) is None
    assert narrow_schemas(get_tools(SETTINGS), SETTINGS) is None


@pytest.mark.asyncio
async def test_narrow_schemas_from_none_is_the_allowlisted_get_tools_in_order():
    from app.services.openai_service import get_tools
    from app.services.outside_run_scope import narrow_schemas

    async def _go():
        return narrow_schemas(None, SETTINGS)

    out = await _in_outside_run(_go)
    expected = [n for n in _names(get_tools(SETTINGS)) if n in SIX]
    assert _names(out) == expected
    assert set(expected) == SIX


@pytest.mark.asyncio
async def test_narrow_schemas_of_a_concrete_list_keeps_order_and_drops_connectors():
    from app.services.openai_service import get_tools
    from app.services.outside_run_scope import narrow_schemas

    connector = {"type": "function", "function": {"name": "gmail__send_message", "parameters": {}}}
    given = [connector] + list(reversed(get_tools(SETTINGS)))

    async def _go():
        return narrow_schemas(given, SETTINGS)

    out = await _in_outside_run(_go)
    assert _names(out) == [n for n in _names(given) if n in SIX]
    assert "gmail__send_message" not in _names(out)
    by_name = {t["function"]["name"]: t for t in given}
    assert all(t is by_name[t["function"]["name"]] for t in out)  # same objects, no copy


@pytest.mark.asyncio
async def test_narrow_schemas_never_returns_empty():
    from app.services.outside_run_scope import OutsideToolsetEmpty, narrow_schemas

    only_power = [{"type": "function", "function": {"name": "execute_code", "parameters": {}}}]

    async def _go():
        return narrow_schemas(only_power, SETTINGS)

    with pytest.raises(OutsideToolsetEmpty):
        await _in_outside_run(_go)


def test_the_refusal_payload():
    from app.services.outside_run_scope import refusal_payload

    payload = json.loads(refusal_payload("execute_code"))
    assert payload["error"] == "tool_not_available_for_outside_ask"
    assert payload["tool"] == "execute_code"
    assert "execute_code isn't available" in payload["message"]
    assert payload["message"].startswith("This chat was started from an AI tool")


# ── 5. Seam A ─────────────────────────────────────────────────────────────────────────────────


def _vocab():
    from app.services.search_vocabulary import SearchVocabulary

    return SearchVocabulary(
        fields=({"field_key": "region", "field_type": "string", "enabled": True},),
        document_types=(("invoice", 3),),
    )


def _base_with_search_vocabulary():
    """``with_search_vocabulary`` exactly as 306-01 shipped it, compiled from git at the plan base
    into a copy of the live module's namespace (so every helper it reads is the live one)."""
    import app.services.search_vocabulary as live

    src = subprocess.run(
        ["git", "show", f"{PLAN_BASE_SHA}:backend/app/services/search_vocabulary.py"],
        cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
    ).stdout
    fn = next(
        n for n in ast.parse(src).body
        if isinstance(n, ast.FunctionDef) and n.name == "with_search_vocabulary"
    )
    assert "narrow_schemas" not in ast.unparse(fn), "the base must be the pre-306-03 function"
    ns = dict(vars(live))
    exec(compile(ast.Module(body=[fn], type_ignores=[]), "<base>", "exec"), ns)  # noqa: S102
    return ns["with_search_vocabulary"]


@pytest.mark.asyncio
async def test_seam_a_offers_exactly_the_six_inside_an_outside_run():
    from app.services.search_vocabulary import with_search_vocabulary

    async def _go():
        return with_search_vocabulary(None, SETTINGS, None)

    out = await _in_outside_run(_go)
    assert set(_names(out)) == SIX and len(out) == 6


@pytest.mark.asyncio
async def test_seam_a_keeps_the_vocabulary_on_search_documents():
    from app.services.search_vocabulary import with_search_vocabulary

    async def _go():
        return with_search_vocabulary(None, SETTINGS, _vocab())

    out = await _in_outside_run(_go)
    assert set(_names(out)) == SIX and len(out) == 6
    search = next(t for t in out if t["function"]["name"] == "search_documents")
    assert "region" in search["function"]["parameters"]["properties"]["filters"]["description"]


@pytest.mark.parametrize("given", ["none", "list"])
@pytest.mark.parametrize("with_vocab", [False, True])
def test_seam_a_outside_an_outside_run_is_the_306_01_function(given, with_vocab):
    from app.services.openai_service import get_tools
    from app.services.search_vocabulary import with_search_vocabulary

    base_fn = _base_with_search_vocabulary()
    vocab = _vocab() if with_vocab else None
    tools = None if given == "none" else copy.deepcopy(get_tools(SETTINGS))
    now = with_search_vocabulary(tools, SETTINGS, vocab)
    then = base_fn(tools, SETTINGS, vocab)
    if then is None:
        assert now is None
    else:
        assert json.dumps(now, sort_keys=True) == json.dumps(then, sort_keys=True)
    if given == "list" and not with_vocab:
        assert now is tools  # AS IS, the same object

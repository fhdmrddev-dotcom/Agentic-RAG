"""Phase 273 (D-15 / I-4 / I-2) — the loop's one persist hook, the two caption-source kwargs, and
the two read-route attach calls. Source fences over comment-stripped code, plus AST checks that
place each call in the function it must live in.

⛔ agent_loop.py FIRES G-5; D-15 allows ONE persist hook + one kwarg per ToolContext build.
The prompt-assembly seam stays OWED (OV-273-03), so SYSTEM_PROMPT must be byte-identical to
PHASE_BASE — pinned here by its sha256 at `f764734979c2`.
"""
from __future__ import annotations

import ast
import hashlib
import io
import pathlib
import tokenize

APP = pathlib.Path(__file__).resolve().parent.parent.parent / "app"
LOOP = APP / "services" / "agent_loop.py"
THREADS = APP / "api" / "threads.py"

# sha256 of agent_loop.SYSTEM_PROMPT at PHASE_BASE f764734979c25696544b2408232f4fbdc779ae5f (11,844 chars).
SYSTEM_PROMPT_SHA256_AT_BASE = "7265842ce8a22a249bb6412b4062762c0f5cfe0e5816f07ce7145b2a20e49c23"


def _strip_comments(src: str) -> str:
    out = []
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type == tokenize.COMMENT:
            continue
        out.append(tok)
    return tokenize.untokenize(out)


def _code(path: pathlib.Path) -> str:
    return _strip_comments(path.read_text(encoding="utf-8"))


def _tree(path: pathlib.Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"))


def _func(tree: ast.AST, name: str) -> ast.AST:
    for n in ast.walk(tree):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name:
            return n
    raise AssertionError(f"{name} not found")


def _calls_named(node: ast.AST, name: str) -> list[ast.Call]:
    found = []
    for n in ast.walk(node):
        if isinstance(n, ast.Call):
            f = n.func
            fname = f.id if isinstance(f, ast.Name) else (f.attr if isinstance(f, ast.Attribute) else None)
            if fname == name:
                found.append(n)
    return found


# ── agent_loop.py ─────────────────────────────────────────────────────────────────────────────


def test_turn_tool_calls_is_passed_by_reference_in_both_tool_context_builds():
    code = _code(LOOP)
    assert code.count("turn_tool_calls=persisted_tool_calls") == 2

    builds = _calls_named(_tree(LOOP), "ToolContext")
    assert len(builds) == 2, "agent_loop.py builds ToolContext in exactly two places (resume + main)"
    for call in builds:
        kw = {k.arg: k.value for k in call.keywords}
        assert "turn_tool_calls" in kw, f"ToolContext build at line {call.lineno} lacks turn_tool_calls"
        v = kw["turn_tool_calls"]
        assert isinstance(v, ast.Name) and v.id == "persisted_tool_calls"


def test_redaction_is_the_one_persist_hook_inside_persist_assistant_message():
    code = _code(LOOP)
    assert code.count("redact_artifact_args(completed_tools)") == 1

    persist = _func(_tree(LOOP), "_persist_assistant_message")
    hooks = _calls_named(persist, "redact_artifact_args")
    assert len(hooks) == 1
    assert len(_calls_named(_tree(LOOP), "redact_artifact_args")) == 1


def test_the_hook_runs_before_the_row_is_written():
    persist = _func(_tree(LOOP), "_persist_assistant_message")
    seg = ast.get_source_segment(LOOP.read_text(encoding="utf-8"), persist)
    hook = seg.index("redact_artifact_args(completed_tools)")
    write = seg.index('row["tool_calls"] = _strip_nul(completed_tools)')
    assert hook < write


def test_the_in_turn_assistant_message_still_uses_the_raw_arguments_string():
    """Redaction is persist-time only: the CURRENT turn's model sees its own call verbatim."""
    assert '"function": {"name": tc["name"], "arguments": tc["arguments"]}' in _code(LOOP)


def test_system_prompt_is_byte_identical_to_phase_base():
    from app.services.agent_loop import SYSTEM_PROMPT

    assert hashlib.sha256(SYSTEM_PROMPT.encode("utf-8")).hexdigest() == SYSTEM_PROMPT_SHA256_AT_BASE


def test_artifact_history_never_imports_agent_loop():
    src = (APP / "services" / "artifact_history.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    mods = set()
    for n in ast.walk(tree):
        if isinstance(n, ast.ImportFrom) and n.module:
            mods.add(n.module)
        elif isinstance(n, ast.Import):
            mods.update(a.name for a in n.names)
    assert not any("agent_loop" in m for m in mods)


def test_artifact_history_never_keys_a_lookup_by_tool_call_id():
    """Pitfall 5: Gemini's `call_{idx}` ids repeat — the artifact id is the only key."""
    tree = _tree(APP / "services" / "artifact_history.py")
    uses = [n.lineno for n in ast.walk(tree) if isinstance(n, ast.Constant) and n.value == "tool_call_id"]
    assert uses == [], f"artifact_history.py reads tool_call_id at {uses}"


# ── threads.py ────────────────────────────────────────────────────────────────────────────────


def test_attach_runs_in_exactly_the_two_read_routes():
    tree = _tree(THREADS)
    assert len(_calls_named(tree, "attach_artifacts")) == 2
    for route in ("get_snapshot", "get_messages"):
        assert len(_calls_named(_func(tree, route), "attach_artifacts")) == 1, route
    assert _calls_named(_func(tree, "send_message"), "attach_artifacts") == []


def test_attach_follows_the_runs_merge_in_both_routes():
    src = THREADS.read_text(encoding="utf-8")
    tree = _tree(THREADS)
    for route in ("get_snapshot", "get_messages"):
        seg = ast.get_source_segment(src, _func(tree, route))
        assert seg.index("_enrich_messages_with_runs(") < seg.index("attach_artifacts(")

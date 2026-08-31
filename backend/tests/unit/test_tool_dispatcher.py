"""Smoke tests for tool_dispatcher.py registry wiring.

Validates the registry structure, dispatch routing, and dataclass defaults
without calling actual tool handlers (which require DB/Redis/sandbox).
"""
from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock

from app.services.tool_dispatcher import (
    ToolContext,
    ToolResult,
    dispatch_tool,
    _TOOL_REGISTRY,
)


# All 25 tools registered after Phase 101 Plan 04 — phase-end gate.
# (16 base + 5 workspace from Phase 084 + write_todos from Plan 01 + task from
# Plan 02 + ask_user from Plan 03 = 24; + render_template from Phase 101 = 25.)
EXPECTED_TOOLS = [
    "ls",
    "tree",
    "grep",
    "glob",
    "read_document",
    "search_documents",
    "query_documents",
    "web_search",
    "analyze_document",
    "load_skill",
    "save_skill",
    "read_skill_file",
    "execute_code",
    "remember",
    "recall",
    "query_tables",
    # Phase 084: Workspace tools
    "workspace_write",
    "workspace_read",
    "workspace_list",
    "workspace_delete",
    "workspace_diff",
    # Phase 085 Plan 01: write_todos; Plan 02: task; Plan 03: ask_user (phase-end 24)
    "write_todos",
    "task",
    "ask_user",
    # Phase 101 Plan 04: render_template (TMPL-02 / TMPL-03) — phase-end 25
    "render_template",
    # Phase 115 Plan 03: query_documents_by_view (VIEW-07) — phase-end 26
    "query_documents_by_view",
    # Phase 116 Plan 03: get_related_documents (REL-04) — phase-end 27
    "get_related_documents",
    # Phase 151 Plan 01: fetch_document_file (FILE-02) — 28
    "fetch_document_file",
    # Phase 151 Plan 04: attach_skill_file (FILE-01) — phase-end 29
    "attach_skill_file",
]


def test_registry_has_exactly_29_entries():
    """_TOOL_REGISTRY must contain exactly 29 tool handlers after Phase 151.

    (16 base + 5 workspace from Phase 084 + write_todos from Plan 01 + task from
    Plan 02 + ask_user from Plan 03 = 24; + render_template from Phase 101 = 25;
    + query_documents_by_view from Phase 115 = 26; + get_related_documents from
    Phase 116 = 27; + fetch_document_file from Phase 151 FILE-02 = 28;
    + attach_skill_file from Phase 151 FILE-01 = 29).
    Phase-end gate — registry entries are NOT capability-gated (the gate is in
    get_tools()/dispatch), so both FILE-01/02 tools are always present here.
    """
    assert len(_TOOL_REGISTRY) == 29


def test_registry_contains_all_expected_tools():
    """Every known tool name must be a key in _TOOL_REGISTRY."""
    for tool_name in EXPECTED_TOOLS:
        assert tool_name in _TOOL_REGISTRY, f"Missing tool: {tool_name}"


def test_registry_values_are_callable():
    """Every registry entry must be a callable (async function)."""
    for tool_name, handler in _TOOL_REGISTRY.items():
        assert callable(handler), f"Handler for {tool_name} is not callable"


@pytest.mark.asyncio
async def test_dispatch_unknown_tool_returns_error():
    """dispatch_tool with an unknown tool name returns ToolResult with error message."""
    ctx = ToolContext(
        redis=None,
        run_id=None,
        thread_id="test-thread",
        supabase=None,
        pool=None,
        user_settings=None,
        current_user={"id": "test-user"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(),
        spawn=lambda c: None,
    )
    result = await dispatch_tool("nonexistent_tool", {}, ctx)
    assert isinstance(result, ToolResult)
    assert result.result == "Unknown tool: nonexistent_tool"


def test_tool_context_can_be_instantiated():
    """ToolContext can be created with all required fields."""
    ctx = ToolContext(
        redis="fake_redis",
        run_id=None,
        thread_id="t-123",
        supabase="fake_sb",
        pool="fake_pool",
        user_settings=None,
        current_user={"id": "u-456"},
        folder_subtree_ids=None,
        scoped_folder_path="/docs",
        emit=AsyncMock(),
        spawn=lambda c: None,
    )
    assert ctx.thread_id == "t-123"
    assert ctx.current_user["id"] == "u-456"
    assert ctx.model == ""  # default
    assert ctx.previous_files_in_run is None  # default
    assert ctx.tool_index == 0  # default
    assert ctx.iteration == 0  # default


def test_tool_result_defaults():
    """ToolResult defaults are correct."""
    tr = ToolResult(result="test output")
    assert tr.result == "test output"
    assert tr.llm_content is None
    assert tr.source_refs == []
    assert tr.citations == []
    assert tr.similarity_score is None
    assert tr.sub_agent_record is None


def test_tool_result_with_side_effects():
    """ToolResult can carry all side-effect fields."""
    tr = ToolResult(
        result="search results",
        llm_content="stripped content",
        source_refs=[{"document_id": "d1", "filename": "test.pdf"}],
        citations=[{"document_id": "d1", "passage": "some text"}],
        similarity_score=0.85,
        sub_agent_record={"filename": "report.pdf", "task": "summarize"},
    )
    assert tr.llm_content == "stripped content"
    assert len(tr.source_refs) == 1
    assert len(tr.citations) == 1
    assert tr.similarity_score == 0.85
    assert tr.sub_agent_record["task"] == "summarize"


@pytest.mark.asyncio
async def test_dispatch_routes_to_correct_handler():
    """dispatch_tool routes to the registered handler, not a random one."""
    # We can't call the actual handler without mocks, but we can verify
    # that dispatch_tool returns a ToolResult (not None or an exception)
    # for a known tool name by patching the registry.
    original = _TOOL_REGISTRY.get("ls")
    try:
        async def _mock_ls(args, ctx):
            return ToolResult(result="mocked_ls_output")

        _TOOL_REGISTRY["ls"] = _mock_ls
        ctx = ToolContext(
            redis=None, run_id=None, thread_id="t",
            supabase=None, pool=None, user_settings=None,
            current_user={"id": "u"}, folder_subtree_ids=None,
            scoped_folder_path=None, emit=AsyncMock(), spawn=lambda c: None,
        )
        result = await dispatch_tool("ls", {}, ctx)
        assert result.result == "mocked_ls_output"
    finally:
        if original is not None:
            _TOOL_REGISTRY["ls"] = original


# -- Phase 084 Plan 05: weak-model dispatcher normalization --------------
# Pins the defensive str-`null`/str-int normalization for the 3 workspace
# tools (list/read/diff) with optional params. Weak OpenRouter models
# (e.g. llama-3.3-70b) stringify JSON null and integer values; native
# providers emit proper JSON types so the normalizer is a no-op for them.


def test_normalize_optional_treats_null_string_as_none() -> None:
    from app.services.tool_dispatcher import _normalize_optional
    assert _normalize_optional("null") is None
    assert _normalize_optional("None") is None
    assert _normalize_optional("") is None


def test_normalize_optional_passes_through_real_values() -> None:
    from app.services.tool_dispatcher import _normalize_optional
    assert _normalize_optional("docs/") == "docs/"
    assert _normalize_optional(None) is None
    assert _normalize_optional(42) == 42


def test_normalize_optional_int_coerces_string_integers() -> None:
    from app.services.tool_dispatcher import _normalize_optional_int
    assert _normalize_optional_int("1") == 1
    assert _normalize_optional_int("  42  ") == 42
    assert _normalize_optional_int(7) == 7


def test_normalize_optional_int_null_strings_become_none() -> None:
    from app.services.tool_dispatcher import _normalize_optional_int
    assert _normalize_optional_int("null") is None
    assert _normalize_optional_int("None") is None
    assert _normalize_optional_int("") is None
    assert _normalize_optional_int(None) is None


def test_normalize_optional_int_uncoercible_becomes_none() -> None:
    """Defensive: weird strings shouldn't raise -- the downstream code
    handles None gracefully and treats it as 'no optional given'."""
    from app.services.tool_dispatcher import _normalize_optional_int
    assert _normalize_optional_int("not-a-number") is None
    assert _normalize_optional_int([]) is None


@pytest.mark.asyncio
async def test_workspace_list_normalizes_str_null_prefix() -> None:
    """Handler-level integration: workspace_list with ``{"prefix": "null"}``
    (weak-model emit) must call list_files_in_thread with prefix=None, NOT
    the literal 4-char string "null" that would WHERE LIKE 'null%' to 0 rows.

    This reproduces the exact OpenRouter llama-3.3-70b defect from
    084-HUMAN-UAT Test 4 (thread 5aa25f1d) where a freshly-written file
    was hidden from the agent by a stringified-null prefix bug."""
    from unittest.mock import patch
    from uuid import UUID
    from app.services.tool_dispatcher import _handle_workspace_list, ToolContext

    captured: dict = {}

    async def _fake_list(pool, *, thread_id, prefix=None):
        captured["prefix"] = prefix
        captured["thread_id"] = thread_id
        # Return one row so we exercise the formatted-output branch too.
        return [{"path": "/test.md", "size_bytes": 11, "mime_type": "text/markdown"}]

    fake_thread_id = "00000000-0000-0000-0000-000000000001"
    ctx = ToolContext(
        redis=None, run_id=None, thread_id=fake_thread_id,
        supabase=None, pool="fake_pool", user_settings=None,
        current_user={"id": "u"}, folder_subtree_ids=None,
        scoped_folder_path=None, emit=AsyncMock(), spawn=lambda c: None,
    )
    with patch(
        "app.services.tool_dispatcher.ws_list_files",
        side_effect=_fake_list,
    ):
        result = await _handle_workspace_list({"prefix": "null"}, ctx)

    assert captured["prefix"] is None, (
        f"prefix should be normalized to None, got {captured['prefix']!r}"
    )
    assert captured["thread_id"] == UUID(fake_thread_id)
    assert "/test.md" in result.result
    assert "Workspace is empty" not in result.result


@pytest.mark.asyncio
async def test_workspace_read_coerces_str_int_line_args() -> None:
    """Handler-level integration: workspace_read with stringified ints
    (`{"start_line": "1", "end_line": "5"}`, the exact shape llama-3.3
    emitted in 084-HUMAN-UAT Test 4) must pass int values downstream."""
    from unittest.mock import patch
    from app.services.tool_dispatcher import _handle_workspace_read, ToolContext

    captured: dict = {}

    async def _fake_read(pool, supabase, *, thread_id, path, start_line, end_line):
        captured["start_line"] = start_line
        captured["end_line"] = end_line
        return {"content": "hello world", "is_binary": False, "is_truncated": False}

    ctx = ToolContext(
        redis=None, run_id=None, thread_id="00000000-0000-0000-0000-000000000001",
        supabase=None, pool="fake_pool", user_settings=None,
        current_user={"id": "u"}, folder_subtree_ids=None,
        scoped_folder_path=None, emit=AsyncMock(), spawn=lambda c: None,
    )
    with patch(
        "app.services.tool_dispatcher.ws_read_file",
        side_effect=_fake_read,
    ):
        result = await _handle_workspace_read(
            {"path": "/test.md", "start_line": "1", "end_line": "5"}, ctx,
        )

    assert captured["start_line"] == 1
    assert captured["end_line"] == 5
    assert isinstance(captured["start_line"], int)
    assert isinstance(captured["end_line"], int)
    assert result.result == "hello world"


# ---------------------------------------------------------------------------
# EXEC-01 (Phase 176-03) — reliable declared library install + bounded auto-heal.
# ---------------------------------------------------------------------------
from unittest.mock import MagicMock  # noqa: E402


class _FakeConsole:
    """Stand-in for llm_sandbox's ConsoleOutput (exit_code + stdout + stderr)."""

    def __init__(self, exit_code: int = 0, stdout: str = "", stderr: str = ""):
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr


def test_pip_install_uses_system_interpreter_no_stream_callbacks():
    """_pip_install must issue `python -m pip install` via session.execute_command
    with NO on_stdout/on_stderr stream callbacks (non-stream => reliable exit_code),
    targeting the SAME interpreter as `python -u` (Defect B)."""
    from app.services.tool_dispatcher import _pip_install

    session = MagicMock()
    session.execute_command.return_value = _FakeConsole(exit_code=0)

    res = _pip_install(session, ["fpdf2", "some-pkg"])

    assert res.exit_code == 0
    assert session.execute_command.call_count == 1
    (cmd,), kwargs = session.execute_command.call_args
    assert cmd.startswith("python -m pip install --disable-pip-version-check ")
    assert "fpdf2" in cmd and "some-pkg" in cmd
    # No stream callbacks => non-streaming => reliable exit_code.
    assert "on_stdout" not in kwargs and "on_stderr" not in kwargs


@pytest.mark.asyncio
async def test_declared_install_retries_once_and_surfaces_stderr():
    """A declared install returning a non-zero exit code is retried EXACTLY once,
    and on persistent failure the pip stderr is surfaced (NOT swallowed)."""
    from app.services.tool_dispatcher import _install_declared_libraries

    session = MagicMock()
    session.execute_command.return_value = _FakeConsole(
        exit_code=1, stderr="ERROR: No matching distribution found for badpkg"
    )

    stderr = await _install_declared_libraries(session, ["badpkg"])

    # exactly two calls: initial attempt + one retry (D-02.1)
    assert session.execute_command.call_count == 2
    assert "No matching distribution" in stderr


@pytest.mark.asyncio
async def test_declared_install_retry_success_returns_empty():
    """A transient failure that succeeds on the single retry surfaces NO error."""
    from app.services.tool_dispatcher import _install_declared_libraries

    session = MagicMock()
    session.execute_command.side_effect = [
        _FakeConsole(exit_code=1, stderr="temporary network error"),
        _FakeConsole(exit_code=0),
    ]

    stderr = await _install_declared_libraries(session, ["fpdf2"])

    assert session.execute_command.call_count == 2
    assert stderr == ""


@pytest.mark.asyncio
async def test_declared_install_success_first_try_single_call():
    """A clean install proceeds with a single call and no surfaced error."""
    from app.services.tool_dispatcher import _install_declared_libraries

    session = MagicMock()
    session.execute_command.return_value = _FakeConsole(exit_code=0)

    stderr = await _install_declared_libraries(session, ["fpdf2"])

    assert session.execute_command.call_count == 1
    assert stderr == ""


# ---------------------------------------------------------------------------
# EXEC-01 (Phase 176-03) — run-scoped ModuleNotFound auto-heal + honest result.
# ---------------------------------------------------------------------------
class _FakeCtx:
    """Minimal ToolContext stand-in exposing only the heal-bound inputs."""

    def __init__(self, redis=None, run_id=None, thread_id=None):
        self.redis = redis
        self.run_id = run_id
        # CR-01 (176): the wall-clock abort needs a thread_id to kill_session on
        # overrun. Absent (None) → the bounded helper runs unbounded (no-timeout).
        self.thread_id = thread_id


def test_extract_missing_module_reads_stderr_and_stdout():
    from app.services.tool_dispatcher import _extract_missing_module

    assert _extract_missing_module(
        "", "ModuleNotFoundError: No module named 'fpdf2'"
    ) == "fpdf2"
    # mirrors _classify_runtime_gap out_l (stdout is scanned too, lowercased)
    assert _extract_missing_module(
        "Traceback...\nModuleNotFoundError: No module named 'seaborn'", ""
    ) == "seaborn"
    assert _extract_missing_module("all good", "") is None


def test_install_failed_detail_shape():
    from app.services.tool_dispatcher import _install_failed_detail

    detail = _install_failed_detail("badpkg", "ERROR: " + "x" * 500)
    assert detail["module"] == "badpkg"
    assert len(detail["reason"]) <= 300  # truncated ~300 chars
    assert "Could not install badpkg" in detail["hint"]
    # preinstalled-lib hint from docs/SANDBOX-PACKAGES.md
    assert "reportlab" in detail["hint"] and "pandas" in detail["hint"]
    assert "Do not retry" in detail["hint"]


@pytest.mark.asyncio
async def test_autoheal_installs_and_reruns_once():
    """(b) An undeclared ModuleNotFoundError installs X via `python -m pip install`
    then re-runs the code exactly once (threadpool-wrapped) and adopts the result."""
    from app.services.tool_dispatcher import _autoheal_missing_module

    session = MagicMock()
    session.execute_command.side_effect = [
        _FakeConsole(exit_code=0),                      # pip install fpdf2
        _FakeConsole(exit_code=0, stdout="PDF built"),  # re-run of python -u <file>
    ]
    ctx = _FakeCtx(redis=None, run_id=None)  # call-local bound path

    result = await _autoheal_missing_module(
        session=session, ctx=ctx, code_file="/tmp/run-abc.py",
        stdout="", stderr="ModuleNotFoundError: No module named 'fpdf2'",
        declared_install_stderr="", healed_fallback=set(),
    )

    assert result is not None and result.get("exec_result") is not None
    assert result["exec_result"].stdout == "PDF built"
    calls = session.execute_command.call_args_list
    assert len(calls) == 2
    assert "python -m pip install" in calls[0].args[0] and "fpdf2" in calls[0].args[0]
    assert calls[1].args[0] == "python -u /tmp/run-abc.py"


@pytest.mark.asyncio
async def test_autoheal_run_scoped_bound_second_miss_no_reinstall():
    """(c) A module already heal-attempted THIS run (per-run Redis set says so) goes
    straight to the honest result — the run-scoped store is consulted, no re-install."""
    from app.services.tool_dispatcher import _autoheal_missing_module

    session = MagicMock()
    redis = MagicMock()
    redis.sismember = AsyncMock(return_value=True)  # already attempted this run
    redis.sadd = AsyncMock()
    redis.expire = AsyncMock()
    ctx = _FakeCtx(redis=redis, run_id="run-123")

    result = await _autoheal_missing_module(
        session=session, ctx=ctx, code_file="/tmp/run-abc.py",
        stdout="", stderr="ModuleNotFoundError: No module named 'fpdf2'",
        declared_install_stderr="", healed_fallback=set(),
    )

    redis.sismember.assert_awaited_once()
    assert redis.sismember.await_args.args[0] == "heal_attempted:run-123"
    # NO install / re-run — straight to the honest result
    assert session.execute_command.call_count == 0
    assert result is not None and result.get("install_failed") is not None
    assert result["install_failed"]["module"] == "fpdf2"


@pytest.mark.asyncio
async def test_autoheal_redis_unavailable_falls_back_to_call_local():
    """(d) Redis raising on the bound check/record must NOT break execute_code —
    the heal falls back to the call-local set and still proceeds/bounds once."""
    from app.services.tool_dispatcher import _autoheal_missing_module

    session = MagicMock()
    session.execute_command.side_effect = [
        _FakeConsole(exit_code=0),                       # pip install
        _FakeConsole(exit_code=0, stdout="ok"),          # re-run
    ]
    redis = MagicMock()
    redis.sismember = AsyncMock(side_effect=RuntimeError("redis down"))
    redis.sadd = AsyncMock(side_effect=RuntimeError("redis down"))
    redis.expire = AsyncMock(side_effect=RuntimeError("redis down"))
    ctx = _FakeCtx(redis=redis, run_id="run-xyz")
    fallback: set[str] = set()

    result = await _autoheal_missing_module(
        session=session, ctx=ctx, code_file="/tmp/run-abc.py",
        stdout="", stderr="ModuleNotFoundError: No module named 'fpdf2'",
        declared_install_stderr="", healed_fallback=fallback,
    )

    # did not raise; healed via call-local fallback
    assert result is not None and result.get("exec_result") is not None
    assert "fpdf2" in fallback  # recorded in the call-local bound
    assert session.execute_command.call_count == 2


@pytest.mark.asyncio
async def test_autoheal_install_failure_returns_honest_result():
    """A genuine bad package: install fails → honest install_failed with pip stderr,
    NO re-run."""
    from app.services.tool_dispatcher import _autoheal_missing_module

    session = MagicMock()
    session.execute_command.return_value = _FakeConsole(
        exit_code=1, stderr="ERROR: No matching distribution found for badpkg"
    )
    ctx = _FakeCtx(redis=None, run_id=None)

    result = await _autoheal_missing_module(
        session=session, ctx=ctx, code_file="/tmp/run-abc.py",
        stdout="", stderr="ModuleNotFoundError: No module named 'badpkg'",
        declared_install_stderr="", healed_fallback=set(),
    )

    assert result is not None and result.get("install_failed") is not None
    assert result["install_failed"]["module"] == "badpkg"
    assert "No matching distribution" in result["install_failed"]["reason"]
    # install attempt (retry x1) happened, but NO re-run of the code
    assert session.execute_command.call_count == 2  # install + one retry
    assert all(
        "python -m pip install" in c.args[0]
        for c in session.execute_command.call_args_list
    )


@pytest.mark.asyncio
async def test_autoheal_known_missing_module_not_healed():
    """A KNOWN_MISSING permanent gap (markitdown) is left to _classify_runtime_gap —
    the auto-heal passes through (None), never installs."""
    from app.services.tool_dispatcher import _autoheal_missing_module

    session = MagicMock()
    ctx = _FakeCtx(redis=None, run_id=None)

    result = await _autoheal_missing_module(
        session=session, ctx=ctx, code_file="/tmp/run-abc.py",
        stdout="", stderr="ModuleNotFoundError: No module named 'markitdown'",
        declared_install_stderr="", healed_fallback=set(),
    )

    assert result is None
    assert session.execute_command.call_count == 0


@pytest.mark.asyncio
async def test_autoheal_declared_failure_no_module_surfaces_honestly():
    """(a) A persistent declared-install failure with no ModuleNotFound in output
    still surfaces an honest result (not swallowed)."""
    from app.services.tool_dispatcher import _autoheal_missing_module

    session = MagicMock()
    ctx = _FakeCtx(redis=None, run_id=None)

    result = await _autoheal_missing_module(
        session=session, ctx=ctx, code_file="/tmp/run-abc.py",
        stdout="", stderr="RuntimeError: something unrelated",
        declared_install_stderr="ERROR: No matching distribution found for badpkg",
        healed_fallback=set(),
    )

    assert result is not None and result.get("install_failed") is not None
    assert "No matching distribution" in result["install_failed"]["reason"]
    assert session.execute_command.call_count == 0  # nothing to heal, just surface


# ---------------------------------------------------------------------------
# CR-01 (Phase 176) — the heal re-run + pip installs must be bounded by the SAME
# wall-clock ceiling the PRIMARY run uses (096/SEED-063), so a healed-then-runaway
# script (or a hung `pip install`) can't wedge the run into a 40-minute zombie.
# ---------------------------------------------------------------------------
import threading  # noqa: E402


@pytest.mark.asyncio
async def test_run_bounded_sandbox_timeout_kills_container_and_raises(monkeypatch):
    """A blocking sandbox call that overruns the wall-clock ceiling KILLS the
    container (the only way to free an uncancellable thread) and raises
    _SandboxCommandTimeout — mirroring the primary run's 096/SEED-063 abort."""
    from app.services import tool_dispatcher as td

    killed: dict = {}
    monkeypatch.setattr(
        td.sandbox_manager, "kill_session", lambda tid: killed.setdefault("tid", tid)
    )

    release = threading.Event()

    def _blocking(_cmd):
        # Bounded wait so the abandoned executor thread ALWAYS frees (never hangs
        # pytest at exit); the ceiling below fires long before this returns.
        release.wait(timeout=2.0)
        return _FakeConsole(exit_code=0)

    with pytest.raises(td._SandboxCommandTimeout):
        await td._run_bounded_sandbox(
            _blocking, "python -u /tmp/x.py", thread_id="thread-runaway", timeout_s=0.05
        )

    # The container was killed to free the wedged thread.
    assert killed.get("tid") == "thread-runaway"
    release.set()  # free the abandoned thread promptly


@pytest.mark.asyncio
async def test_run_bounded_sandbox_disabled_ceiling_runs_unbounded(monkeypatch):
    """timeout_s in {None, 0, <0} disables the cap (operator escape hatch) — the call
    completes and kill_session is NEVER touched."""
    from app.services import tool_dispatcher as td

    killed: dict = {}
    monkeypatch.setattr(
        td.sandbox_manager, "kill_session", lambda tid: killed.setdefault("tid", tid)
    )

    for disabled in (None, 0, -1):
        res = await td._run_bounded_sandbox(
            lambda _c: _FakeConsole(exit_code=0, stdout="ok"),
            "python -u /tmp/x.py", thread_id="t", timeout_s=disabled,
        )
        assert res.stdout == "ok"
    assert killed == {}  # never killed on the disabled path


@pytest.mark.asyncio
async def test_autoheal_rerun_timeout_surfaces_honest_and_no_exec_result(monkeypatch):
    """CR-01: when the healed RE-RUN overruns the ceiling, the auto-heal returns an
    honest `install_failed` (installed-but-aborted) and adopts NO exec_result — so the
    run is a clean, honest failure instead of a wedged zombie."""
    from app.services import tool_dispatcher as td

    async def _fake_bounded(func, *args, thread_id, timeout_s):
        # pip install (func is _pip_install) succeeds; the `python -u` re-run overruns.
        if func is td._pip_install:
            return _FakeConsole(exit_code=0)
        raise td._SandboxCommandTimeout(timeout_s)

    monkeypatch.setattr(td, "_run_bounded_sandbox", _fake_bounded)

    session = MagicMock()
    ctx = _FakeCtx(redis=None, run_id=None, thread_id="thread-heal")

    result = await td._autoheal_missing_module(
        session=session, ctx=ctx, code_file="/tmp/run-abc.py",
        stdout="", stderr="ModuleNotFoundError: No module named 'fpdf2'",
        declared_install_stderr="", healed_fallback=set(),
    )

    assert result is not None
    assert result.get("exec_result") is None  # aborted re-run is NOT adopted
    assert result.get("install_failed") is not None
    assert result["install_failed"]["module"] == "fpdf2"
    assert "aborted" in result["install_failed"]["reason"].lower()


@pytest.mark.asyncio
async def test_declared_install_pip_timeout_surfaces_honest_reason(monkeypatch):
    """CR-01: a hung `pip install` (network stall) that overruns the ceiling surfaces
    an honest aborted reason (never silently swallowed, never a wedged run)."""
    from app.services import tool_dispatcher as td

    async def _fake_bounded(func, *args, thread_id, timeout_s):
        raise td._SandboxCommandTimeout(timeout_s)

    monkeypatch.setattr(td, "_run_bounded_sandbox", _fake_bounded)

    session = MagicMock()
    stderr = await td._install_declared_libraries(
        session, ["fpdf2"], thread_id="thread-x", timeout_s=0.05
    )

    assert "aborted" in stderr.lower()
    assert "limit" in stderr.lower()


# ---------------------------------------------------------------------------
# BUG-260815-05 — a search that COULD NOT RUN must not read as one that found nothing
# ---------------------------------------------------------------------------
# ⚠ WHY THIS EXISTS, measured rather than imagined (2026-08-15, Phase 193.2 UAT).
# The OpenAI balance hit zero. Every document in this product is embedded with an
# OpenAI model, so every search must embed its QUERY at retrieval time
# (`retrieval_service._vector_search:73` -> `openai_service.embed_texts`). With no
# credits that call raised `RateLimitError insufficient_quota`, and the only sentence
# the operator ever saw was the citations gate's
#   "citations_required: nothing was retrieved (0 sources) — this step reads your
#    documents and must show where its answer came from"
# which is FALSE and actively misdirecting: it sent them to re-check their documents,
# their folder selection and their prompt, all of which were correct (5 docs, 18
# chunks, 0 null embeddings, matching org_id). Three golden runs failed this way.
#
# The gate CANNOT be where this is fixed — it reads only the phase output and has no
# way to know why `citations` is empty. The knowledge lives at the tool boundary, so
# the honest third state belongs here. Same shape as `resolve_template_placeholders`
# (Phase 193.1 / D-26): *could not read* and *nothing to read* never share a message.
#
# ⚠ THIS TEST WAS DRIVEN RED against the pre-fix handler (which let the exception
# propagate, so the call raised instead of returning) before being trusted.

def _fake_ctx(spawned=None):
    """A ToolContext built by `__new__`, so it carries EXACTLY the attributes named here.

    That is the point of the fixture and also its hazard: a production line that starts
    reading a new field fails with AttributeError rather than with a useful message. It
    happened - 217.1-11 added `ctx.spawn(...)` to the search error path and these two
    tests went red from inside the very except arm they exist to guard.

    `spawn` is therefore named here, and `spawned` lets a test assert the audit row was
    actually scheduled rather than merely not crashing.
    """
    ctx = ToolContext.__new__(ToolContext)
    ctx.current_user = {"id": "u1"}
    ctx.supabase = object()
    ctx.user_settings = None
    ctx.folder_subtree_ids = None
    ctx.run_id = "r1"
    ctx.spawn = (spawned.append if spawned is not None else (lambda coro: coro.close()))
    return ctx


def test_search_documents_provider_failure_is_not_reported_as_zero_results(monkeypatch):
    """A provider outage returns an explicit `retrieval_unavailable`, never an empty hit list."""
    import json as _json
    import app.services.tool_dispatcher as td

    async def _boom(*_a, **_k):
        raise RuntimeError("Error code: 429 - insufficient_quota: You have no credits remaining.")

    monkeypatch.setattr(td, "search_documents", _boom)
    out = asyncio.run(td._handle_search_documents({"query": "Northwind usage"}, _fake_ctx()))

    assert isinstance(out, ToolResult)
    body = _json.loads(out.result)
    assert body["error"] == "retrieval_unavailable"

    # The provider's own reason must survive to the surface a person reads.
    assert "429" in body["detail"] and "insufficient_quota" in body["detail"]

    # ⚠ THE LOAD-BEARING HALF: the result must not be mistakable for an empty search.
    # `no relevant documents` is the exact string the SUCCESS path emits on 0 hits
    # (`tool_dispatcher._handle_search_documents`), and the two must never collide.
    assert "no relevant documents" not in out.result.lower()
    assert out.citations == [] and out.source_refs == []
    assert out.retrieval_error is not None
    assert out.retrieval_error["provider"] == "openai"
    assert out.retrieval_error["retrieval_status"] == "provider_error"
    assert "insufficient_quota" in out.retrieval_error["detail"]


def test_search_documents_provider_failure_does_not_raise_into_the_agent_loop(monkeypatch):
    """The exception is CONVERTED, not propagated — `agent_loop`'s generic handler would
    otherwise turn it into a model-facing "Tool error: ..." string that never reaches the
    phase record the author reads."""
    import app.services.tool_dispatcher as td

    async def _boom(*_a, **_k):
        raise ValueError("provider down")

    monkeypatch.setattr(td, "search_documents", _boom)
    # Must NOT raise.
    out = asyncio.run(td._handle_search_documents({"query": "q"}, _fake_ctx()))
    assert "retrieval_unavailable" in out.result

"""Phase 142 (SRH-01) — the per-run repeat-guard + reactive reshape (Plan 02).

These tests drive the LIVE ``_handle_execute_code`` handler through a fully
mocked sandbox to prove the load-bearing SC#2 / D-06 / D-03 mechanism:

  1. POST-HOC reshape — when a completed sandbox failure classifies as a KNOWN
     runtime gap (``_classify_runtime_gap`` hit), the MODEL-facing ``llm_content``
     grows a permanent-framed ``runtime_gap`` note AND the gap token is recorded
     in the run-scoped ``dead_gap_tokens_in_run`` set.
  2. PRE-FLIGHT guard — a 2nd ``execute_code`` whose ``code`` references an
     already-failed token this run is SHORT-CIRCUITED before the sandbox is even
     acquired (``sandbox_manager.get_or_create`` is never called again). This is
     what structurally caps the BUG-260707-02 soffice/markitdown 8-round loop at
     <=1 real dead sandbox call per token.
  3. RUN-SCOPE by-reference — the set survives across separately-built
     ``ToolContext`` instances (two agent-loop iterations) because it is threaded
     by-reference, NOT re-derived per-iteration via ``setattr`` (Pitfall 1).
  4. SUB-AGENT isolation — a sub-agent ctx built with a FRESH ``set()`` does NOT
     inherit the parent's recorded token (Pitfall 6 / T-142-05).

RED before Plan 02 Task 2/3: the field is unread, no reshape and no pre-flight
guard exist, so every call hits the sandbox (``get_or_create.call_count`` grows
past 1) and ``llm_content`` carries no ``runtime_gap`` key.
"""
from __future__ import annotations

import contextlib
import json
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services import tool_dispatcher
from app.services.tool_dispatcher import _handle_execute_code, GAP_MESSAGES

# The exact BUG-260707-02 shape: a pptx→soffice shell-out that fails because
# LibreOffice is not installed in the Python-only sandbox.
SOFFICE_CODE = (
    "import subprocess\n"
    "subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', 'deck.pptx'])\n"
)
SOFFICE_FAIL = (
    "FileNotFoundError: [Errno 2] No such file or directory: 'soffice'"
)


class _FakeExecResult:
    """Minimal stand-in for the sandbox execute_command result (stdout/stderr/exit)."""

    def __init__(self, stdout: str = "", stderr: str = "", exit_code: int = 0):
        self.stdout = stdout
        self.stderr = stderr
        self.exit_code = exit_code


def _make_ctx(dead_set, **overrides):
    """Build a duck-typed ToolContext bag carrying the run-scoped repeat-guard set.

    Uses a SimpleNamespace (like ``conftest.make_tool_context``) so the new
    ``dead_gap_tokens_in_run`` field can be passed as an override even before the
    dataclass field lands.
    """
    async def _noop_emit(*_a, **_k):
        return None

    defaults = dict(
        redis=MagicMock(),
        run_id=uuid.uuid4(),
        thread_id=str(uuid.uuid4()),
        supabase=MagicMock(),
        pool=MagicMock(),
        user_settings=SimpleNamespace(),
        current_user={"id": "u-1"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=_noop_emit,
        spawn=lambda *_a, **_k: None,
        model="",
        previous_files_in_run=None,
        new_file_hashes_in_run=None,
        tool_index=0,
        iteration=0,
        parent_run_id=None,
        per_run_task_semaphore=None,
        available_tools=[],
        tool_call_id="",
        phase_whitelist=None,
        workflow_run_id=None,
        skill_snapshot=None,
        skill_instructions_override=None,
        dead_gap_tokens_in_run=dead_set,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@contextlib.contextmanager
def _sandbox_patched(exec_result):
    """Patch the full sandbox stack so ``_handle_execute_code`` runs offline.

    Yields the ``get_or_create`` MagicMock — its ``call_count`` is the "how many
    times did we touch the sandbox" signal (a short-circuited call never reaches
    ``get_or_create``).
    """
    session = MagicMock()
    session.execute_command = MagicMock(return_value=exec_result)
    session.copy_to_runtime = MagicMock()
    session.install = MagicMock()

    get_or_create = MagicMock(return_value=session)
    fake_manager = MagicMock()
    fake_manager.get_or_create = get_or_create

    async def _fake_ritp(func, *args, **kwargs):
        return func(*args, **kwargs)

    async def _fake_aexec(*_a, **_k):
        return SimpleNamespace(data=[{"id": "exec-test"}])

    with contextlib.ExitStack() as stack:
        stack.enter_context(patch.object(tool_dispatcher, "run_in_threadpool", _fake_ritp))
        stack.enter_context(patch.object(tool_dispatcher, "sandbox_manager", fake_manager))
        stack.enter_context(patch.object(tool_dispatcher, "snapshot_output_baseline", lambda *_a, **_k: {}))
        stack.enter_context(patch.object(tool_dispatcher, "harvest_output_files", lambda *_a, **_k: ([], {})))
        stack.enter_context(patch.object(tool_dispatcher, "aexec", _fake_aexec))
        stack.enter_context(patch.object(tool_dispatcher, "write_audit_entry", MagicMock()))
        yield get_or_create, session


# ── 1. Short-circuit: two soffice calls → sandbox touched exactly once ─────────


async def test_repeat_short_circuits():
    """Call 1 fails on soffice (real mocked run + reshape records the token);
    Call 2 references soffice again → pre-flight short-circuit, NO sandbox."""
    dead: set = set()
    ctx = _make_ctx(dead)
    fail = _FakeExecResult(stderr=SOFFICE_FAIL, exit_code=1)

    with _sandbox_patched(fail) as (get_or_create, _session):
        r1 = await _handle_execute_code({"code": SOFFICE_CODE}, ctx)
        r2 = await _handle_execute_code({"code": SOFFICE_CODE}, ctx)

    # Sandbox acquired exactly ONCE across both calls (call 2 short-circuited).
    assert get_or_create.call_count == 1

    # Call 1 surfaced the PERMANENT-framed runtime_gap note to the model.
    p1 = json.loads(r1.llm_content)
    assert p1["runtime_gap"]["class"] == "G-C"
    assert p1["runtime_gap"]["token"] == "soffice"
    assert p1["runtime_gap"]["message"] == GAP_MESSAGES["soffice"]

    # The token entered the shared run-scoped set after call 1.
    assert "soffice" in dead

    # Call 2 is the short-circuit: error-shaped, permanent message + "already
    # attempted this run" line, and NO sandbox output.
    p2 = json.loads(r2.llm_content)
    assert p2["status"] == "error"
    assert p2["exit_code"] != 0
    assert p2["runtime_gap"]["repeat_blocked"] is True
    assert p2["runtime_gap"]["message"] == GAP_MESSAGES["soffice"]
    assert "already attempted" in p2["runtime_gap"]["note"].lower()


# ── 2. Run-scope by-reference (NOT setattr) survives the per-iteration rebuild ──


async def test_run_scoped_not_setattr():
    """The guard reads ``ctx.dead_gap_tokens_in_run`` (a by-reference run-scoped
    set), so a token recorded on one iteration's ctx is seen by the NEXT
    iteration's freshly-built ctx that shares the same set — while a DIFFERENT run
    with its own set is unaffected."""
    shared: set = set()
    ctx_iter1 = _make_ctx(shared)
    ctx_iter2 = _make_ctx(shared)
    # Two separately-built contexts, ONE shared set object (mirrors agent_loop
    # rebuilding ToolContext every iteration around the run-scoped accumulator).
    assert ctx_iter1.dead_gap_tokens_in_run is ctx_iter2.dead_gap_tokens_in_run

    fail = _FakeExecResult(stderr=SOFFICE_FAIL, exit_code=1)
    with _sandbox_patched(fail) as (get_or_create, _s):
        await _handle_execute_code({"code": SOFFICE_CODE}, ctx_iter1)   # iter 1 records
        r2 = await _handle_execute_code({"code": SOFFICE_CODE}, ctx_iter2)  # iter 2 sees it

    assert "soffice" in shared
    assert get_or_create.call_count == 1  # iter 2 short-circuited → the set survived
    assert json.loads(r2.llm_content)["runtime_gap"]["repeat_blocked"] is True

    # A separate run with its OWN fresh set does NOT inherit the token — proving
    # the guard is not backed by any process-global / setattr on the ctx class.
    other: set = set()
    ctx_other = _make_ctx(other)
    with _sandbox_patched(fail) as (get_or_create2, _s2):
        await _handle_execute_code({"code": SOFFICE_CODE}, ctx_other)
    assert get_or_create2.call_count == 1  # its empty set → a real sandbox call happened
    assert "soffice" in other


# ── 3. Sub-agent fresh set: a parent's dead token never blocks the sub-agent ───


async def test_subagent_fresh_set():
    """A sub-agent ctx built with a FRESH ``set()`` (task_service Pitfall 6) does
    NOT see the parent's recorded token, so its own soffice attempt reaches the
    sandbox once and is recorded independently."""
    parent_set: set = {"soffice"}   # parent already hit the gap this run
    sub_set: set = set()            # task_service hands the sub-agent a FRESH set
    sub_ctx = _make_ctx(sub_set)

    fail = _FakeExecResult(stderr=SOFFICE_FAIL, exit_code=1)
    with _sandbox_patched(fail) as (get_or_create, _s):
        await _handle_execute_code({"code": SOFFICE_CODE}, sub_ctx)

    # The parent's token did NOT short-circuit the sub-agent → sandbox was invoked.
    assert get_or_create.call_count == 1
    assert parent_set == {"soffice"}     # parent set untouched by the sub-agent
    assert "soffice" in sub_set          # sub-agent recorded its OWN dead call


# ── 4. D-03 loop-cap: 8 soffice rounds → sandbox touched <= distinct-token count ─


async def test_pptx_soffice_loop_capped():
    """The BUG-260707-02 8-round loop is capped BY CONSTRUCTION: 8 sequential
    soffice execute_code calls touch the sandbox at most once (== the number of
    DISTINCT gap tokens), never 8."""
    dead: set = set()
    ctx = _make_ctx(dead)
    fail = _FakeExecResult(stderr=SOFFICE_FAIL, exit_code=1)

    with _sandbox_patched(fail) as (get_or_create, _s):
        for _ in range(8):
            await _handle_execute_code({"code": SOFFICE_CODE}, ctx)

    distinct_tokens = len(dead)
    assert distinct_tokens == 1                       # only soffice failed
    assert get_or_create.call_count <= distinct_tokens
    assert get_or_create.call_count == 1              # the 7 retries all short-circuited


# ── 5. CR-01(1a): a SUCCESSFUL (exit-0) run is never classified or recorded ─────


async def test_exit0_success_never_reshaped_or_recorded():
    """CR-01(1a) — the POST-HOC classifier is GATED on failure. A run that exits 0
    is never reshaped and never records a repeat-guard token, even when its stdout
    literally prints ``soffice: command not found`` / ``node not found`` (a value a
    completely ordinary successful program could emit). Without the gate this
    exit-0 output would be reshaped and would poison the run via the repeat-guard."""
    dead: set = set()
    ctx = _make_ctx(dead)
    ok = _FakeExecResult(
        stdout="soffice: command not found\nnode not found\n",
        stderr="",
        exit_code=0,
    )

    with patch.object(tool_dispatcher, "_classify_runtime_gap") as spy:
        with _sandbox_patched(ok) as (_get_or_create, _s):
            r = await _handle_execute_code(
                {"code": "print('soffice: command not found')"}, ctx
            )
        # The gate stops the classifier from ever being invoked on success.
        spy.assert_not_called()

    payload = json.loads(r.llm_content)
    assert payload["status"] == "completed"
    assert "runtime_gap" not in payload          # nothing reshaped
    assert dead == set()                         # nothing recorded → run not poisoned

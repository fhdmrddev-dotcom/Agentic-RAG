"""Phase 244 Plan 02 Task 2 (SHELL-04, C-9) — the thread's attachments reach the sandbox.

⛔ **THE GAP THIS CLOSES, MEASURED NOT ASSUMED.** `244-CONTEXT.md` states *"nothing new is needed on
the tool side"*. That is TRUE FOR TEXT and **FALSE FOR BINARY**: `workspace_service.read_file`
returns the literal `"Content available via REST API."` for any binary MIME, and
`grep -rn "workspace" backend/app/services/sandbox_service.py` returned **no matches** — the sandbox
had no reach into `workspace_files` at all. **Eight of the sixteen accepted extensions are binary**
(3 OOXML + 5 image + PDF), and sketch 236's own headline scenario file is
`Meridian-Q4-pricing.xlsx`. So *"and the agent can use it"* was unsatisfied for the most likely
attachments: a person attaches a spreadsheet and the agent tells them to use a REST API it cannot
call.

⭐ **No new subsystem.** The copy mechanism already exists in the SAME function — `render_template`'s
`_copy_in` (`NamedTemporaryFile` → `copy_to_runtime` → `unlink`) — and the once-per-session guard is
the shape of the shipped `_output_baseline_seeded` seed. ⛔ Deliberately NOT the base64-in-source
preamble the skill-file loop uses: that inflates the code file by 33% and would blow up on a 10 MB
attachment.

**Everything here is stubbed — no container, no Postgres, no Storage.** Worktrees isolate files, not
Postgres, so a unit test that wrote to the local Supabase would interfere with a sibling plan. The
handler is driven LIVE through the `test_142_repeat_guard` mock-stack precedent.

What is pinned:
  1. every non-expired row is copied to `/sandbox/attachments/<basename>`;
  2. hydration is ONCE PER SESSION — a second `execute_code` on the same ctx copies nothing;
  3. an EXPIRED row never arrives — hydration reads through the expiry-gated listing and adds no
     second expiry rule, and no unfiltered path around it exists;
  4. **a path-traversal filename cannot escape `/sandbox/attachments/`** (T-244-02-02);
  5. a thread with NO attachments costs nothing and behaves byte-identically to today;
  6. a per-file failure is LOGGED **and NAMED in the tool result** — never silently dropped
     (T-244-02-07).
"""

from __future__ import annotations

import contextlib
import json
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.services import tool_dispatcher
from app.services.tool_dispatcher import _handle_execute_code


class _FakeExecResult:
    def __init__(self, stdout: str = "", stderr: str = "", exit_code: int = 0):
        self.stdout = stdout
        self.stderr = stderr
        self.exit_code = exit_code


def _make_ctx(**overrides):
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
        dead_gap_tokens_in_run=None,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _row(path: str, *, expired: bool = False, size: int = 12, mime: str = "application/pdf") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "path": path,
        "size_bytes": size,
        "mime_type": mime,
        "kind": "template_input",
        "expires_at": "2000-01-01T00:00:00Z" if expired else None,
        "_expired": expired,
    }


@contextlib.contextmanager
def _sandbox_patched(rows, *, content=b"%PDF-1.7 bytes", content_error_for=None):
    """Patch the sandbox stack + the three workspace readers the hydration uses.

    ``ws_list_files`` is stubbed to apply the SAME predicate the real SQL applies
    (``expires_at IS NULL OR expires_at > now()``), so an expired fixture row is not
    returned — which is the point of case 3: hydration must consume THAT listing and must
    not reach around it to an unfiltered reader.
    """
    session = MagicMock()
    session.execute_command = MagicMock(return_value=_FakeExecResult())
    session.copy_to_runtime = MagicMock()
    session.install = MagicMock()

    get_or_create = MagicMock(return_value=session)
    fake_manager = MagicMock()
    fake_manager.get_or_create = get_or_create

    async def _fake_ritp(func, *args, **kwargs):
        return func(*args, **kwargs)

    async def _fake_aexec(*_a, **_k):
        return SimpleNamespace(data=[{"id": "exec-test"}])

    async def _fake_list(_pool, *, thread_id, prefix=None):
        return [dict(r) for r in rows if not r["_expired"]]

    async def _fake_get_by_path(_pool, _thread_id, path):
        for r in rows:
            if r["path"] == path:
                return dict(r, content_inline=content)
        return None

    async def _fake_content(_pool, _supabase, file_row):
        if content_error_for is not None and file_row.get("path") == content_error_for:
            raise RuntimeError("storage download failed")
        return content

    with contextlib.ExitStack() as stack:
        stack.enter_context(patch.object(tool_dispatcher, "run_in_threadpool", _fake_ritp))
        stack.enter_context(patch.object(tool_dispatcher, "sandbox_manager", fake_manager))
        stack.enter_context(patch.object(tool_dispatcher, "snapshot_output_baseline", lambda *_a, **_k: {}))
        stack.enter_context(patch.object(tool_dispatcher, "harvest_output_files", lambda *_a, **_k: ([], {})))
        stack.enter_context(patch.object(tool_dispatcher, "aexec", _fake_aexec))
        stack.enter_context(patch.object(tool_dispatcher, "write_audit_entry", MagicMock()))
        stack.enter_context(patch.object(tool_dispatcher, "ws_list_files", _fake_list))
        stack.enter_context(patch.object(tool_dispatcher, "get_file_by_path", _fake_get_by_path))
        stack.enter_context(patch.object(tool_dispatcher, "_get_file_content", _fake_content))
        yield get_or_create, session


def _attachment_copies(session) -> list[str]:
    """Container destinations of every ``copy_to_runtime`` aimed at the attachments dir."""
    return [
        call.args[1]
        for call in session.copy_to_runtime.call_args_list
        if len(call.args) >= 2 and "/attachments" in str(call.args[1])
    ]


# ── 1. Every non-expired attachment is copied in, once each ───────────────────
async def test_each_attachment_is_copied_into_the_sandbox():
    rows = [_row("/a1b2c3d4-Meridian-Q4-pricing.xlsx"), _row("/e5f6a7b8-contract.pdf")]
    ctx = _make_ctx()
    with _sandbox_patched(rows) as (_g, session):
        await _handle_execute_code({"code": "print(1)"}, ctx)

    copies = _attachment_copies(session)
    assert copies == [
        "/sandbox/attachments/a1b2c3d4-Meridian-Q4-pricing.xlsx",
        "/sandbox/attachments/e5f6a7b8-contract.pdf",
    ]


async def test_the_attachments_directory_is_created():
    rows = [_row("/a1b2c3d4-report.docx")]
    ctx = _make_ctx()
    with _sandbox_patched(rows) as (_g, session):
        await _handle_execute_code({"code": "print(1)"}, ctx)
    cmds = [c.args[0] for c in session.execute_command.call_args_list if c.args]
    assert any("mkdir -p /sandbox/attachments" in str(c) for c in cmds)


# ── 2. Once per SESSION, not once per call ────────────────────────────────────
async def test_hydration_runs_once_per_session():
    rows = [_row("/a1b2c3d4-report.docx")]
    ctx = _make_ctx()
    with _sandbox_patched(rows) as (_g, session):
        await _handle_execute_code({"code": "print(1)"}, ctx)
        first = len(_attachment_copies(session))
        await _handle_execute_code({"code": "print(2)"}, ctx)
        second = len(_attachment_copies(session))

    assert first == 1
    # ⛔ ZERO further copies on the second call — the sandbox session is cached per
    # thread_id until idle eviction, so re-copying is pure container I/O for nothing.
    assert second - first == 0
    assert getattr(ctx, "_attachments_hydrated", False) is True


# ── 3. An EXPIRED attachment never arrives, and there is no second expiry rule ─
async def test_expired_attachment_is_not_hydrated():
    rows = [_row("/live-report.docx"), _row("/dead-old.xlsx", expired=True)]
    ctx = _make_ctx()
    with _sandbox_patched(rows) as (_g, session):
        await _handle_execute_code({"code": "print(1)"}, ctx)

    copies = _attachment_copies(session)
    assert copies == ["/sandbox/attachments/live-report.docx"]
    assert not any("dead-old" in c for c in copies)


def test_hydration_adds_no_second_expiry_rule():
    """D-244-04: ONE gate, two readers. The listing's SQL is the only expiry rule.

    ⛔ A source fence, deliberately: the behavioural case above cannot distinguish
    "consumed the gated listing" from "re-implemented the same predicate correctly by
    coincidence", and a duplicated rule is the thing that drifts.
    """
    import inspect

    src = inspect.getsource(tool_dispatcher._hydrate_thread_attachments)
    assert "ws_list_files" in src
    for forbidden in ("expires_at", "is_expired", "utcnow", "now()"):
        assert forbidden not in src, f"hydration re-implements expiry via {forbidden!r}"


# ── 4. TRAVERSAL — T-244-02-02 ────────────────────────────────────────────────
@pytest.mark.parametrize(
    "path,expected",
    [
        ("../../etc/passwd", "/sandbox/attachments/passwd"),
        ("/a/b.txt", "/sandbox/attachments/b.txt"),
        ("/../../../../root/.ssh/authorized_keys", "/sandbox/attachments/authorized_keys"),
        ("/..", "/sandbox/attachments/attachment"),
        ("/....//....//x.sh", "/sandbox/attachments/x.sh"),
    ],
)
async def test_traversal_cannot_escape_the_attachments_directory(path, expected):
    ctx = _make_ctx()
    with _sandbox_patched([_row(path)]) as (_g, session):
        await _handle_execute_code({"code": "print(1)"}, ctx)

    copies = _attachment_copies(session)
    assert copies == [expected]
    for dest in copies:
        # ⛔ The load-bearing assertion: nothing is written OUTSIDE the directory, and no
        # destination retains a traversal segment that a later path join could act on.
        assert dest.startswith("/sandbox/attachments/")
        assert ".." not in dest


# ── 5. A thread with NO attachments costs nothing ─────────────────────────────
async def test_no_attachments_costs_nothing_and_says_nothing():
    ctx = _make_ctx()
    with _sandbox_patched([]) as (_g, session):
        result = await _handle_execute_code({"code": "print(1)"}, ctx)

    assert _attachment_copies(session) == []
    cmds = [str(c.args[0]) for c in session.execute_command.call_args_list if c.args]
    assert not any("attachments" in c for c in cmds)
    # S-2: empty ⇒ render nothing. No new key in the model-facing payload.
    assert "attachments" not in json.loads(result.llm_content)


# ── 6. A per-file failure is NAMED, never silently dropped (T-244-02-07) ──────
async def test_a_hydration_failure_is_named_and_does_not_abort_the_run():
    rows = [_row("/good-report.docx"), _row("/broken-sheet.xlsx")]
    ctx = _make_ctx()
    with _sandbox_patched(rows, content_error_for="/broken-sheet.xlsx") as (_g, session):
        result = await _handle_execute_code({"code": "print(1)"}, ctx)

    # The other file still arrived and the user's code still ran.
    assert _attachment_copies(session) == ["/sandbox/attachments/good-report.docx"]
    payload = json.loads(result.llm_content)
    assert payload["status"] == "completed"

    # ⛔ The refusal is NAMED in the tool result — a silent drop is the repudiation threat.
    notes = payload.get("attachments")
    assert notes, "a hydration failure produced no note in the tool result"
    assert any("broken-sheet.xlsx" in str(n) for n in notes)

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
def _sandbox_patched(rows, *, content=b"%PDF-1.7 bytes", content_error_for=None, content_error_limit=None):
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

    # ⭐ 244-14 (review WR-03) — a TRANSIENT failure is a distinct fixture from a permanent one,
    # and the distinction is the whole finding: the realistic failure set on this path (Supabase
    # Storage, the pg pool, the Docker daemon) is dominated by blips, and a blip used to mark the
    # file copied for the rest of the ~30-minute session. `content_error_limit=N` fails the first
    # N reads of that path and then succeeds; `None` fails forever, which is the shipped shape.
    attempts: dict[str, int] = {}

    async def _fake_content(_pool, _supabase, file_row):
        path = file_row.get("path")
        if content_error_for is not None and path == content_error_for:
            attempts[path] = attempts.get(path, 0) + 1
            if content_error_limit is None or attempts[path] <= content_error_limit:
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
    """⚠ RE-DRIVEN AT 244-10 — THE CLAIM IS UNCHANGED, THE INSTRUMENT MOVED.

    This case used to assert ``session in tool_dispatcher._hydrated_sessions`` — a MEMBERSHIP
    CHECK ON A ``WeakSet``, i.e. an assertion about the MARKER'S TYPE rather than about the
    product's behaviour. `244-10` changes that type (the marker now records WHICH paths were
    copied, not merely THAT hydration ran), so the old assertion would have failed for a reason
    that has nothing to do with the property anyone cares about.

    ⭐ It is re-aimed at the property that actually matters — **the same FILE is copied once per
    session** — which is strictly stronger than the boolean it replaces: a per-file count still
    fails if the file is re-copied, and it additionally survives any future change of marker.
    ⛔ The case is NOT deleted; deleting it would have retired WR-02's DoS fence.
    """
    rows = [_row("/a1b2c3d4-report.docx")]
    ctx = _make_ctx()
    with _sandbox_patched(rows) as (_g, session):
        await _handle_execute_code({"code": "print(1)"}, ctx)
        first = list(_attachment_copies(session))
        await _handle_execute_code({"code": "print(2)"}, ctx)
        second = list(_attachment_copies(session))

    assert first == ["/sandbox/attachments/a1b2c3d4-report.docx"]
    # ⛔ ZERO further copies of THAT FILE on the second call — the sandbox session is cached per
    # thread_id until idle eviction, so re-copying is pure container I/O for nothing.
    assert second == first, "the same attachment was copied twice into one session"
    assert getattr(ctx, "_attachments_hydrated", False) is False, (
        "the flag is back on the per-iteration ToolContext — that is the WR-02 defect"
    )


# ── 2b. WR-02 (244-07) — once per SESSION means ACROSS AGENT-LOOP ITERATIONS ───
async def test_hydration_runs_once_across_agent_loop_iterations():
    """⛔ THE CASE ABOVE COULD NOT SEE THE DEFECT, AND THAT IS THE FINDING.

    It re-uses ONE ``ctx``, and the guard flag lived on ``ctx`` — so it proved only that
    parallel tool calls inside a single iteration do not re-copy. But
    ``agent_loop.py:2790`` says literally *"Phase 083 D-01: construct ToolContext once per
    iteration"*, so a fresh object means a fresh ``getattr`` default and the guard reset on
    every iteration. A run calling ``execute_code`` in eight iterations copied the same
    10 MB attachment eight times — the DoS arm the shipped comment claimed to have closed.

    ⚠ The SESSION is what persists (``SandboxSessionManager`` caches it per ``thread_id``
    until idle eviction), so this case holds the session fixed and varies the ctx — which is
    exactly what the agent loop does.

    ⚠ RE-DRIVEN AT 244-10 — SAME TREATMENT AS THE CASE ABOVE. Its claim ("eight iterations do
    not copy the same 10 MB attachment eight times") is still exactly right; only its INSTRUMENT
    moved, from a bare call COUNT to the copied TARGET PATHS. A count cannot tell a re-copy of
    the same file from a copy of a different one, and `244-10` makes "a different one" possible
    for the first time, so the count became ambiguous the moment the fix landed.
    """
    rows = [_row("/a1b2c3d4-report.docx")]
    thread_id = str(uuid.uuid4())
    dest = "/sandbox/attachments/a1b2c3d4-report.docx"
    with _sandbox_patched(rows) as (_g, session):
        await _handle_execute_code({"code": "print(1)"}, _make_ctx(thread_id=thread_id, iteration=0))
        first = list(_attachment_copies(session))
        # A NEW ToolContext, same thread, same cached session — iteration 2 of the same run.
        await _handle_execute_code({"code": "print(2)"}, _make_ctx(thread_id=thread_id, iteration=1))
        second = list(_attachment_copies(session))
        await _handle_execute_code({"code": "print(3)"}, _make_ctx(thread_id=thread_id, iteration=2))
        third = list(_attachment_copies(session))

    assert first == [dest]
    assert second == [dest], (
        "the attachment was copied AGAIN on the second agent-loop iteration — the guard is "
        "per-ToolContext, not per sandbox session, and the comment says otherwise"
    )
    assert third == [dest]


async def test_a_DIFFERENT_session_hydrates_again():
    """⛔ THE POSITIVE CONTROL. A guard keyed on something global would pass 2b while breaking
    the case that matters: a new container (worker bounce, idle eviction) has an EMPTY
    ``/sandbox/attachments`` and must be filled."""
    rows = [_row("/a1b2c3d4-report.docx")]
    thread_id = str(uuid.uuid4())
    with _sandbox_patched(rows) as (_g, session_one):
        await _handle_execute_code({"code": "print(1)"}, _make_ctx(thread_id=thread_id))
        assert len(_attachment_copies(session_one)) == 1
    with _sandbox_patched(rows) as (_g, session_two):
        await _handle_execute_code({"code": "print(2)"}, _make_ctx(thread_id=thread_id))
        assert len(_attachment_copies(session_two)) == 1


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
    import ast
    import inspect
    import re as _re

    src = inspect.getsource(tool_dispatcher._hydrate_thread_attachments)
    # ⚠ Strip the DOCSTRING and the `#` comments before asserting. The prose deliberately
    # QUOTES the SQL predicate to say where the one gate lives, and a fence that reads prose
    # would fail on the very sentence that documents the invariant it is guarding.
    tree = ast.parse(src.lstrip())
    fn = tree.body[0]
    if (fn.body and isinstance(fn.body[0], ast.Expr)
            and isinstance(fn.body[0].value, ast.Constant)
            and isinstance(fn.body[0].value.value, str)):
        fn.body = fn.body[1:]
    code = _re.sub(r"^\s*#.*$", "", ast.unparse(fn), flags=_re.M)

    assert "ws_list_files" in code
    assert len(code) > 400, "the docstring strip left nothing — the fence would pass vacuously"
    for forbidden in ("expires_at", "is_expired", "utcnow", "now()"):
        assert forbidden not in code, f"hydration re-implements expiry via {forbidden!r}"


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


# ══════════════════════════════════════════════════════════════════════════════
# Phase 244 Plan 10 (gap-closure round 1) — L-5 defect 6b.
#
# ⛔ THE DEFECT, IN THE AGENT'S OWN ROUND-4 OUTPUT, not inferred:
#       /sandbox/attachments [] ['c679b991-Meridian-Q4-pricing.xlsx']
# — the directory holds only the FIRST file. The agent then burned rounds 5-12 hunting the
# second one and recovered it at round 10 via the `workspace_read` fallback, ~49 s later.
#
# ⭐ THE CAUSE IS IN THE CODE. `244-07` closed WR-02 by moving the hydration marker from the
# per-iteration `ToolContext` onto the SANDBOX SESSION — right for the DoS arm it named, and
# wrong for this one: `SandboxSessionManager` caches the session per `thread_id` until idle
# eviction, so once a session is marked, no LATER attachment is ever copied into it.
#
# ⛔ SAY "the second attachment did not hydrate", NEVER ".pdf does not hydrate". The UAT's
# single run attached .xlsx first and .pdf second, so ORDERING IS CONFOUNDED WITH FILE TYPE and
# the type-specific claim is NOT ESTABLISHED. The `244-10-UAT-ROW.md` third arm resolves it in a
# real browser; nothing here can.
#
# ⚠ These cases mutate the `rows` LIST between calls, because that is the shape the product
# produces: `ws_list_files` is re-read from the live table on every call, so a row inserted by
# the upload door between two `execute_code` invocations simply appears in the next listing.
# ══════════════════════════════════════════════════════════════════════════════

_A = "/a1b2c3d4-Meridian-Q4-pricing.xlsx"
_B = "/902f62ba-uat-note.pdf"
_DEST_A = "/sandbox/attachments/a1b2c3d4-Meridian-Q4-pricing.xlsx"
_DEST_B = "/sandbox/attachments/902f62ba-uat-note.pdf"


# ── A. THE GAP — a file attached AFTER the session exists must still arrive ────
async def test_an_attachment_added_after_the_session_exists_is_copied():
    """L-5 defect 6b. Two `execute_code` calls on ONE session; fileB is attached between them.

    ⛔ Asserted on the COPY TARGET PATHS handed to `copy_to_runtime`, never on a note string and
    never on a call count — the words are not the deliverable here, the FILE is. A note saying
    "copied" while the container holds nothing is precisely the failure mode the UAT caught.
    """
    rows = [_row(_A, mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    thread_id = str(uuid.uuid4())
    with _sandbox_patched(rows) as (_g, session):
        await _handle_execute_code({"code": "print(1)"}, _make_ctx(thread_id=thread_id))
        assert _attachment_copies(session) == [_DEST_A], "the FIRST attachment never arrived"

        # The person attaches a second file. The upload door writes a workspace_files row; the
        # sandbox session is untouched and still cached for this thread.
        rows.append(_row(_B))

        await _handle_execute_code({"code": "print(2)"}, _make_ctx(thread_id=thread_id))

    copies = _attachment_copies(session)
    assert _DEST_B in copies, (
        "the SECOND attachment was never copied into /sandbox/attachments — the agent can only "
        f"reach the first file. copy targets seen: {copies}"
    )


# ── B. WR-02 SURVIVES, PER FILE — the first file is not copied twice ───────────
async def test_the_already_copied_file_is_not_copied_again_when_a_new_one_arrives():
    """⛔ THE CASE THAT STOPS THE FIX BECOMING "re-copy everything every call".

    WR-02's DoS arm (T-244-02-05) is a real cost: a 10 MB attachment re-pushed into the
    container on every agent-loop iteration. Making the copy INCREMENTAL is what closes defect
    6b; making it UNCONDITIONAL would re-open WR-02. Both must hold at once, which is only
    possible if the record is per FILE rather than per session.
    """
    rows = [_row(_A)]
    thread_id = str(uuid.uuid4())
    with _sandbox_patched(rows) as (_g, session):
        await _handle_execute_code({"code": "print(1)"}, _make_ctx(thread_id=thread_id))
        rows.append(_row(_B))
        await _handle_execute_code({"code": "print(2)"}, _make_ctx(thread_id=thread_id))
        await _handle_execute_code({"code": "print(3)"}, _make_ctx(thread_id=thread_id))

    copies = _attachment_copies(session)
    assert copies.count(_DEST_A) == 1, (
        f"fileA was copied {copies.count(_DEST_A)} times across three calls — WR-02 re-opened"
    )
    assert copies.count(_DEST_B) == 1, (
        f"fileB was copied {copies.count(_DEST_B)} times across three calls"
    )


# ── C. THE CAP IS A SESSION TOTAL, NOT A PER-CALL COUNT (T-244-10-01) ──────────
async def test_the_copy_budget_is_a_session_total_not_a_per_call_count():
    """⛔ A PER-CALL CAP IS NOT A CAP.

    Making the copy incremental is exactly what would turn `_ATTACHMENT_HYDRATION_MAX_FILES`
    into a per-call budget, letting a thread exceed it by attaching across several calls — the
    DoS arm of T-244-02-05, re-opened by the fix that closes defect 6b. The cap is therefore
    compared against ``len(already) + len(new)``, and the truncation is NAMED.
    """
    rows = [_row("/aaaaaaa1-one.pdf")]
    thread_id = str(uuid.uuid4())
    with patch.object(tool_dispatcher, "_ATTACHMENT_HYDRATION_MAX_FILES", 2):
        with _sandbox_patched(rows) as (_g, session):
            await _handle_execute_code({"code": "print(1)"}, _make_ctx(thread_id=thread_id))
            rows.append(_row("/aaaaaaa2-two.pdf"))
            await _handle_execute_code({"code": "print(2)"}, _make_ctx(thread_id=thread_id))
            rows.append(_row("/aaaaaaa3-three.pdf"))
            result = await _handle_execute_code({"code": "print(3)"}, _make_ctx(thread_id=thread_id))

    copies = _attachment_copies(session)
    assert len(copies) == 2, (
        f"the session copied {len(copies)} files against a cap of 2 — the cap is per CALL, "
        f"not per session: {copies}"
    )
    assert not any("three" in c for c in copies), "the third file crossed a cap of 2"
    # ⛔ NAMED, never silent — the `confirm_preview` refusal discipline.
    notes = json.loads(result.llm_content).get("attachments")
    assert notes, "the budget truncated silently — the agent is told nothing"
    assert any("workspace_read" in str(n) for n in notes)


# ── D. THE ZERO-ATTACHMENT PATH STILL COSTS EXACTLY NOTHING ───────────────────
async def test_no_attachments_still_costs_nothing_on_every_call():
    """⛔ Deep and Harness SHARE this handler. Hydration used to run once per session; it now
    runs on every `execute_code` call, so an empty listing must not become a per-call `mkdir`.
    """
    thread_id = str(uuid.uuid4())
    with _sandbox_patched([]) as (_g, session):
        for i in range(3):
            result = await _handle_execute_code({"code": f"print({i})"}, _make_ctx(thread_id=thread_id))

    assert _attachment_copies(session) == []
    cmds = [str(c.args[0]) for c in session.execute_command.call_args_list if c.args]
    assert not any("attachments" in c for c in cmds), (
        f"an empty thread ran container I/O for the attachments dir: {cmds}"
    )
    assert "attachments" not in json.loads(result.llm_content)


# ── E. ONE EXPIRY GATE — the incremental filter adds no second rule ────────────
async def test_a_row_that_expires_between_calls_is_never_copied():
    """D-244-04 re-driven against the incremental path.

    The expiry decision has ONE home — `ws_list_files`' SQL predicate. The incremental filter is
    applied to THAT listing's output, so a row absent from the listing can never be copied, on
    call 1 or call 5. ⛔ The source fence `test_hydration_adds_no_second_expiry_rule` below is
    the other half: this case cannot distinguish "consumed the gated listing" from
    "re-implemented the predicate correctly by coincidence".
    """
    rows = [_row(_A)]
    thread_id = str(uuid.uuid4())
    with _sandbox_patched(rows) as (_g, session):
        await _handle_execute_code({"code": "print(1)"}, _make_ctx(thread_id=thread_id))
        # A second file is attached AND is already past its TTL — the listing's SQL drops it.
        rows.append(_row("/deadbeef-expired-late.pdf", expired=True))
        rows.append(_row(_B))
        await _handle_execute_code({"code": "print(2)"}, _make_ctx(thread_id=thread_id))

    copies = _attachment_copies(session)
    assert _DEST_B in copies, "the live late attachment did not arrive"
    assert not any("expired-late" in c for c in copies), (
        "an EXPIRED row reached the container — hydration reached around the one expiry gate"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Phase 244-14 (review WR-03) — A TRANSIENT FAILURE IS NOT A PERMANENT ONE.
#
# ⛔ THE FINDING. `244-10` recorded the path BEFORE the attempt, and justified it as *"a
# permanently-broken file costs one attempt per SESSION and not one per `execute_code` call; its
# failure is already named individually below, so nothing is lost."* The first clause is true.
# **The second is only true of the call in which the failure happened.** On every LATER call the
# path is filtered out at the incremental filter, so no note is produced and the model receives
# no signal at all.
#
# ⛔ AND THE `except` CATCHES EVERY EXCEPTION, NOT ONLY PERMANENT ONES. The realistic failure set
# here is dominated by transients: `_get_file_content` reaching Supabase Storage,
# `get_file_by_path` on the pg pool, `copy_to_runtime` against a Docker daemon. One Storage blip
# on the person's `.xlsx` therefore named the failure once, marked the file copied for the
# remaining ~30 minutes of the cached session, and left `/sandbox/attachments/` permanently short
# that file with no further note — the exact silence UAT `L-5` defect 6b cost ten wasted agent
# rounds to discover.
#
# ⭐ THE DEVIATION'S REAL CONSTRAINT IS KEPT, NOT REVERTED. A permanently-broken file must still
# not re-attempt a DB read plus a container write on every call for half an hour. So *claimed* is
# separated from *succeeded*, and the DoS bound comes from CAPPING the attempts
# (`_ATTACHMENT_HYDRATION_MAX_ATTEMPTS`) rather than from never retrying at all.
#
# ⚠ THE STRONGEST NEW CLAIM IN `244-10` WAS THE ONE WITH NO FENCE — no case drove a SECOND
# `execute_code` after a failure, which is the only place the claim can be checked. These are it.
# ══════════════════════════════════════════════════════════════════════════════


async def test_a_transient_failure_is_retried_on_the_next_call_and_then_arrives():
    """F1 — ONE Storage blip must not cost the file for the whole session.

    ⛔ Asserted on the COPY TARGET, never on a note: the deliverable is the FILE. A note saying
    "could not load" while the file later arrives is honest; a file that never arrives is defect
    6b wearing a different hat.
    """
    rows = [_row(_A), _row(_B)]
    thread_id = str(uuid.uuid4())
    # fileB's content read fails exactly ONCE, then succeeds — a blip, not a broken row.
    with _sandbox_patched(rows, content_error_for=_B, content_error_limit=1) as (_g, session):
        r1 = await _handle_execute_code({"code": "print(1)"}, _make_ctx(thread_id=thread_id))
        assert _DEST_B not in _attachment_copies(session), "fixture did not fail the first read"
        # …and the failure is NAMED on the call it happened in (the shipped discipline).
        assert any(
            "uat-note.pdf" in str(n)
            for n in (json.loads(r1.llm_content).get("attachments") or [])
        )

        await _handle_execute_code({"code": "print(2)"}, _make_ctx(thread_id=thread_id))

    copies = _attachment_copies(session)
    assert _DEST_B in copies, (
        "a file that failed ONE transient read was never retried — it is missing from "
        f"/sandbox/attachments for the life of the session. copy targets seen: {copies}"
    )
    assert copies.count(_DEST_A) == 1, "the healthy file was re-copied — WR-02's DoS arm re-opened"


async def test_a_permanent_failure_is_named_on_every_attempt_then_given_up_on():
    """F2 — the retry is BOUNDED, and the silence is gone.

    Two properties in one case, because they are in tension and a case proving only one is how
    the original deviation came to be written:
      · the failure is NAMED on every attempt, not only on the call that raced the blip;
      · after `_ATTACHMENT_HYDRATION_MAX_ATTEMPTS` the path is given up on DELIBERATELY, so a
        permanently-broken file costs a bounded number of attempts per SESSION rather than one
        DB read plus one container write on every `execute_code` call for ~30 minutes.
    """
    rows = [_row(_A), _row(_B)]
    thread_id = str(uuid.uuid4())
    with _sandbox_patched(rows, content_error_for=_B) as (_g, session):  # fails forever
        notes = []
        for i in range(4):
            res = await _handle_execute_code({"code": f"print({i})"}, _make_ctx(thread_id=thread_id))
            notes.append(json.loads(res.llm_content).get("attachments") or [])

    named = [i for i, n in enumerate(notes) if any("uat-note.pdf" in str(x) for x in n)]
    cap = tool_dispatcher._ATTACHMENT_HYDRATION_MAX_ATTEMPTS
    assert named[:2] == [0, 1], (
        f"a permanently-broken file was named on calls {named} — it must be named on EVERY "
        "attempt, not once. On the calls that follow, the model is told nothing at all, which is "
        "the silence L-5 cost ten wasted rounds."
    )
    assert len(named) == cap, (
        f"the retry is unbounded — named on {len(named)} of 4 calls against a cap of {cap}"
    )
    # ⛔ GIVEN UP ON, not retried forever, and the healthy file is still copied exactly once.
    assert _DEST_B not in _attachment_copies(session)
    assert _attachment_copies(session).count(_DEST_A) == 1


async def test_a_failed_path_consumes_the_copy_budget_only_once_it_is_given_up_on():
    """F3 — the truncation note must not become a lie.

    ⚠ WR-03's related finding, fenced rather than left as prose: `already` counts paths against
    the session budget, so under the shipped shape a flaky Storage could exhaust the 50-file cap
    without a single file arriving — and the note it then emits (*"Only the first 50 of N …"*)
    is false in that state. With the retry, a path enters the budget only when it SUCCEEDS or is
    deliberately given up on, so the budget counts files the container actually holds.
    """
    rows = [_row(_A), _row(_B)]
    thread_id = str(uuid.uuid4())
    with patch.object(tool_dispatcher, "_ATTACHMENT_HYDRATION_MAX_FILES", 2):
        with _sandbox_patched(rows, content_error_for=_B, content_error_limit=1) as (_g, session):
            await _handle_execute_code({"code": "print(1)"}, _make_ctx(thread_id=thread_id))
            # fileB failed once. If that failure consumed the budget, the retry cannot run.
            await _handle_execute_code({"code": "print(2)"}, _make_ctx(thread_id=thread_id))

    copies = _attachment_copies(session)
    assert _DEST_B in copies, (
        "a FAILED path consumed the session copy budget, so the retry was truncated away — the "
        f"budget counts files that never arrived. copy targets seen: {copies}"
    )

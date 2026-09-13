"""Phase 244-08 (T-244-05-05 / OPEN-2) — AN EXPIRED ATTACHMENT LEAVES A TOMBSTONE, NOT A HOLE.

⛔ THE DEFECT THIS FILE EXISTS TO CLOSE. `244-05`'s declared mitigation is verbatim: *"the chip
must say `No longer available`, never disappear."* The chip's `expired` arm was built
(`ChatAttachmentChip.tsx:206-219`) and is UNREACHABLE after a reload, because the rows it
renders come from `GET /threads/{id}/workspace/files`, which filtered expired rows away
server-side. So an attachment silently vanished from an old transcript — which is the exact
repudiation `T-244-05-05` names: the transcript stops being able to say what was sent.

── ⛔ THE TWO CONSTRAINTS, AND WHY THEY DECIDE THE SHAPE OF THE FIX ────────────────────────

(a) **AN EXPIRED ROW MUST NOT BECOME READABLE CONTENT AGAIN.** This is a tombstone for the
    transcript, not a resurrection. It must not re-enter the sandbox hydrator or the
    system-prompt announcement — `T-244-02-06` is closed on exactly that.

(b) **THERE ARE TWO SEPARATE EXPIRY GATES AND ONLY ONE OF THEM MOVES.**

    | gate | readers | this round |
    |---|---|---|
    | `db/workspace.py:207,219` (asyncpg `list_files_in_thread`) | the sandbox hydrator (`tool_dispatcher.py:1862`) AND the prompt announcement (`agent_loop.py:1694`) | ⛔ **UNTOUCHED** |
    | `workspace.py:465` (the supabase REST listing) | the panel + the transcript, via ONE store slice | ⭐ opt-in widening |

    ⚠ The brief warned they might be the same gate. They are NOT — and checking rather than
    assuming is what keeps the hydrator's door shut while the renderer's opens. Case 3 below is
    the executable form of that: it reads `db/workspace.py`'s SQL and refuses a widening there.

⚠ THE WIDENING IS OPT-IN (`include_expired=true`), NOT A REMOVED GATE. The default answer is
byte-identical, so `useResolvedFileId` — which calls the same route for a different purpose —
and every other caller are untouched. A removed gate would have been three fewer characters and
a change to every caller at once.

Every case is STUBBED — no network, no database.
"""
from __future__ import annotations

import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.api import workspace


class _Query:
    """A recording stand-in for a supabase-py query chain.

    ⛔ NOT a MagicMock. `getattr` on a MagicMock auto-creates a TRUTHY child, so a chain built
    from one answers every call and records nothing you can trust — the mechanism that turned a
    whole `244-07` suite green by accident. This records the calls it actually received.
    """

    def __init__(self, rows: list[dict], log: list[tuple]):
        self._rows = rows
        self.log = log

    def _record(self, name, *args):
        self.log.append((name, *args))
        return self

    def select(self, *a):
        return self._record("select", *a)

    def eq(self, *a):
        return self._record("eq", *a)

    def or_(self, *a):
        return self._record("or_", *a)

    def order(self, *a):
        return self._record("order", *a)

    def like(self, *a):
        return self._record("like", *a)

    def single(self, *a):
        return self._record("single", *a)

    def execute(self):
        return SimpleNamespace(data=self._rows)


class _Supabase:
    def __init__(self, rows: list[dict]):
        self.log: list[tuple] = []
        self._rows = rows

    def table(self, name):
        self.log.append(("table", name))
        return _Query(self._rows, self.log)


EXPIRED_ROW = {
    "id": "wf-expired",
    "path": "/abc12345-Meridian-Q4.docx",
    "size_bytes": 20481,
    "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "created_at": "2026-09-10T09:00:00Z",
    "updated_at": "2026-09-10T09:00:00Z",
    "kind": "template_input",
    "expires_at": "2026-09-11T09:00:00Z",
}

THREAD = "11111111-1111-4111-8111-111111111111"
USER = {"id": "33333333-3333-4333-8333-333333333333"}


@pytest.fixture(autouse=True)
def _no_ownership_check(monkeypatch):
    monkeypatch.setattr(workspace, "_verify_thread_ownership", AsyncMock(return_value=None))


def _expiry_filters(log: list[tuple]) -> list[tuple]:
    return [call for call in log if call[0] == "or_" and "expires_at" in str(call[1])]


# ── 1 · THE DEFAULT IS UNCHANGED — the gate is still applied when nobody asks ─────────────
@pytest.mark.asyncio
async def test_the_listing_still_hides_expired_rows_by_default(monkeypatch):
    """⛔ THE FIX IS AN OPT-IN, NOT A REMOVED GATE.

    Without this case, "the transcript can see expired rows" and "the gate was deleted" are
    the same green.
    """
    sb = _Supabase([EXPIRED_ROW])
    monkeypatch.setattr(workspace, "aexec", AsyncMock(return_value=SimpleNamespace(data=[])))

    await workspace.list_workspace_files(
        thread_id=THREAD, prefix=None, current_user=USER, supabase=sb
    )

    assert _expiry_filters(sb.log), (
        "the default listing no longer applies the expiry gate — that is a REMOVED gate, not "
        "the opt-in this fix is. Every other caller of this route would silently widen with it."
    )

    # ⚠ AND THE DECLARED DEFAULT, read off the signature. The call above passes nothing, so it
    # exercises whatever the parameter falls back to — but a FastAPI `Query(...)` default is an
    # OBJECT, and an object is truthy. Asserting the declared value too is what distinguishes
    # "the gate held because the default is False" from "the gate held by accident".
    declared = inspect.signature(workspace.list_workspace_files).parameters["include_expired"]
    assert getattr(declared.default, "default", declared.default) is False, (
        "include_expired no longer defaults to False. The widening is an opt-in for the "
        "transcript; defaulting it on hands expired rows to every caller of this route."
    )


# ── 2 · THE TRANSCRIPT CAN ASK — and gets the expired row back ────────────────────────────
@pytest.mark.asyncio
async def test_the_transcript_can_ask_for_expired_rows(monkeypatch):
    sb = _Supabase([EXPIRED_ROW])
    monkeypatch.setattr(
        workspace, "aexec", AsyncMock(return_value=SimpleNamespace(data=[EXPIRED_ROW]))
    )

    rows = await workspace.list_workspace_files(
        thread_id=THREAD, prefix=None, include_expired=True, current_user=USER, supabase=sb
    )

    assert _expiry_filters(sb.log) == [], (
        "include_expired=true still applied the expiry gate, so the chip's `expired` arm stays "
        "unreachable after a reload and the attachment keeps vanishing from the transcript."
    )
    assert rows and rows[0]["id"] == "wf-expired"
    assert rows[0]["expires_at"], (
        "the row came back WITHOUT its expires_at — the client derives the tombstone state "
        "from that field (`chatAttachmentState`), so a row without it renders as a LIVE chip, "
        "which is worse than the disappearance it replaces."
    )


# ── 3 · CONSTRAINT (b) — the HYDRATOR's gate is a different gate and it does not move ─────
def test_the_sandbox_hydrators_expiry_gate_is_untouched():
    """⛔ THE ONE THING THIS FIX MUST NOT DO.

    `db/workspace.py`'s `list_files_in_thread` is ONE SQL gate with TWO readers — the sandbox
    hydrator (`tool_dispatcher.py:1862`) and the system-prompt announcement
    (`agent_loop.py:1694`). `T-244-02-06` is closed on it. Widening the RENDERER's listing must
    not widen this one, and the two live in different modules precisely so that is possible.
    """
    from app.db import workspace as db_workspace

    src = inspect.getsource(db_workspace.list_files_in_thread)

    assert src.count("expires_at IS NULL OR expires_at > now()") == 2, (
        "the prefix and no-prefix arms of list_files_in_thread no longer BOTH carry the expiry "
        "gate. An expired attachment reaching this listing is copied into /sandbox/attachments/ "
        "and announced in the system prompt — a resurrection, not a tombstone (T-244-02-06)."
    )
    assert "include_expired" not in src, (
        "list_files_in_thread grew an include_expired escape hatch. The transcript's tombstone "
        "is a DISPLAY concern; the hydrator has no honest use for an expired file, and a knob "
        "here is how the renderer's fix becomes the hydrator's hole."
    )


# ── 4 · CONSTRAINT (a) — the CONTENT route is not widened, so the tombstone stays dead ────
@pytest.mark.asyncio
async def test_the_content_route_is_not_widened(monkeypatch):
    """A chip a person can still DOWNLOAD is not a tombstone; it is the file, relabelled."""
    src = inspect.getsource(workspace.get_workspace_file_content)
    assert "expires_at.is.null" in src, (
        "the per-file content route lost its expiry gate. The transcript may SAY a file was "
        "attached; it may not hand the bytes back after the TTL."
    )
    assert "include_expired" not in src, (
        "the content route grew an include_expired parameter — the tombstone must not be "
        "openable."
    )

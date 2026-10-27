"""296 review BE-WR-06 — ``create_folder``'s supabase-py calls run OFF the event loop.

D-v2.5-01: a blocking supabase-py ``.execute()`` inside an ``async def`` stalls every stream on
that worker for the PostgREST round-trip. 296-01 rewrote the folder INSERT and left it (and the
duplicate-name check above it) as synchronous ``.execute()`` calls on the loop thread.

The pin: every ``.execute()`` the handler makes runs on a thread other than the one running the
event loop (``aexec`` → ``run_in_threadpool``).
"""

from __future__ import annotations

import threading
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

import app.api.folders as folders_mod
from app.models.folder import FolderCreate

USER_ID = str(uuid4())


class _RecordingFolders:
    """The builder chain create_folder uses; each ``.execute()`` records the thread it ran on."""

    def __init__(self):
        self.execute_threads: list[tuple[str, int]] = []

    def table(self, name):
        assert name == "folders"
        outer = self

        class _Q:
            def __init__(self):
                self.kind = "name_check"

            def select(self, *_a, **_k):
                return self

            def eq(self, *_a, **_k):
                return self

            def is_(self, *_a, **_k):
                return self

            def maybe_single(self):
                return self

            def insert(self, row):
                self.kind = "insert"
                self.row = row
                return self

            def execute(self):
                outer.execute_threads.append((self.kind, threading.get_ident()))
                if self.kind == "insert":
                    return SimpleNamespace(data=[{"id": str(uuid4()), **self.row}])
                return SimpleNamespace(data=None)

        return _Q()


@pytest.mark.asyncio
async def test_create_folder_runs_every_supabase_call_off_the_event_loop():
    loop_thread = threading.get_ident()
    sb = _RecordingFolders()
    with patch.object(folders_mod, "resolve_active_org_or_none", AsyncMock(return_value=None)), \
            patch.object(folders_mod, "fetch_visible_folders", AsyncMock(return_value=[])):
        await folders_mod.create_folder(
            body=FolderCreate(name="Q3"),
            request=SimpleNamespace(headers={}, state=SimpleNamespace()),
            current_user={"id": USER_ID},
            supabase=sb,
        )
    kinds = [k for k, _ in sb.execute_threads]
    assert kinds == ["name_check", "insert"], kinds
    on_loop = [k for k, t in sb.execute_threads if t == loop_thread]
    assert on_loop == [], f"blocking supabase-py call(s) ran on the event loop: {on_loop}"

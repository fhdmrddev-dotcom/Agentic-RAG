"""BUG-261015-05: the assistant reply showed twice for ~36 s on a local model.

Measured (thread f419e834, run b19917c0, spark-x2.5-4b): the reply was saved at 17:00:45 and the
run finalized at 17:01:21. The post-answer suggestions call runs in between. ``runs.message_id`` was
written only at finalize, so a messages fetch inside that window returned the saved reply with
``run_id = null``. The frontend's reload merge keeps a live streaming copy while the DB does not
hold its run id (``!dbRunIds.has``), so both copies rendered until finalize.

Fix (backend half): link the run to its reply the moment the reply is saved.
"""
from __future__ import annotations

import re
from pathlib import Path
from uuid import uuid4

from app.db.runs import link_run_message

_BACKEND = Path(__file__).resolve().parents[2]


class _Pool:
    def __init__(self):
        self.calls = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "UPDATE 1"


async def test_link_writes_message_id_only_while_unset():
    pool = _Pool()
    rid, mid = uuid4(), uuid4()
    await link_run_message(pool, run_id=rid, message_id=mid)
    (sql, args), = pool.calls
    flat = " ".join(sql.split())
    assert "UPDATE runs SET message_id = $2 WHERE run_id = $1" in flat
    assert "message_id IS NULL" in flat, "never re-point a run already linked"
    assert args == (rid, mid)


def test_the_reply_is_linked_right_after_it_is_saved():
    src = (_BACKEND / "app" / "services" / "agent_loop.py").read_text(encoding="utf-8")
    start = src.index("async def _persist_assistant_message()")
    end = src.index("async def _persist_system_messages(")
    body = src[start:end]
    assert body.count("link_run_message(") == 1
    assert body.index("insert_assistant_message(") < body.index("link_run_message(")

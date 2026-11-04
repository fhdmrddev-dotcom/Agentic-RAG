"""Phase 306-04 (MCP-05; D-09 / D-31 / Pitfall 6; T-306-31) — the ``mcp`` origin kind on the thread wire.

* ``ThreadResponse`` composes ``origin`` from the frozen thread columns (``origin_kind`` /
  ``origin_label``, migration 223) through the ONE wire helper ``origin_for_wire`` — so
  ``GET /threads`` carries it with no ``threads.py`` edit (``select("*")`` already returns the
  columns). A thread with no recorded origin reads ``origin: None``; the caller's row is not mutated.
* ⛔ D-31: ``mcp`` reaches the wire here for the first time, so ALL FOUR backend origin-kind
  literals admit it in the same plan as the frontend arm: ``db/workflows._RUN_ORIGIN_KINDS``,
  ``run_read_wire.ORIGIN_KINDS`` and ``RunOriginWire.kind``, ``notifications.WaitingNotice.origin``.
  A Waiting-on-you notice for an MCP-started run must validate (no 500 on the list read).
* No source file under ``app/`` or ``frontend/src`` (outside tests) spells the three-kind literal
  without ``mcp``.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.models.thread import ThreadResponse

REPO = Path(__file__).resolve().parents[3]
NOW = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)


def _row(**kw) -> dict:
    row = {
        "id": str(uuid.uuid4()), "user_id": str(uuid.uuid4()), "title": "What changed?",
        "folder_id": None, "active_expert_id": None, "created_at": NOW, "updated_at": NOW,
        "org_id": str(uuid.uuid4()), "origin_ref": str(uuid.uuid4()),
    }
    row.update(kw)
    return row


def test_an_mcp_thread_carries_its_origin():
    row = _row(origin_kind="mcp", origin_label="claude-code")
    t = ThreadResponse.model_validate(row)
    assert t.origin == {"kind": "mcp", "label": "claude-code", "actor_name": None}
    assert t.model_dump(mode="json")["origin"] == {"kind": "mcp", "label": "claude-code", "actor_name": None}


def test_the_callers_row_is_not_mutated():
    row = _row(origin_kind="mcp", origin_label="claude-code")
    before = dict(row)
    ThreadResponse.model_validate(row)
    assert row == before and "origin" not in row


@pytest.mark.parametrize("extra", [{}, {"origin_kind": None, "origin_label": None},
                                   {"origin_kind": "unknown-kind", "origin_label": "x"}])
def test_an_in_app_thread_reads_no_origin(extra):
    t = ThreadResponse.model_validate(_row(**extra))
    assert t.origin is None


def test_a_blank_label_reads_none():
    t = ThreadResponse.model_validate(_row(origin_kind="mcp", origin_label="  "))
    assert t.origin == {"kind": "mcp", "label": None, "actor_name": None}


def test_all_four_backend_literals_admit_mcp():
    from app.api.notifications import WaitingNotice
    from app.db.workflows import _RUN_ORIGIN_KINDS
    from app.services.harness.run_read_wire import ORIGIN_KINDS, RunOriginWire

    assert "mcp" in _RUN_ORIGIN_KINDS
    assert "mcp" in ORIGIN_KINDS
    assert RunOriginWire(kind="mcp", label="k").kind == "mcp"
    notice = WaitingNotice(
        id=uuid.uuid4(), run_id=uuid.uuid4(), org_id=uuid.uuid4(), org_name="Acme",
        workflow_name="Report", kind="question", origin="mcp", created_at=NOW,
    )
    assert notice.origin == "mcp"


_TRIPLE = re.compile(r'"app", "schedule", "key"[\]}]|"app" \| "schedule" \| "key"')


def test_no_source_spells_the_three_kinds_without_mcp():
    offenders = []
    for root, exts in ((REPO / "backend" / "app", (".py",)), (REPO / "frontend" / "src", (".ts", ".tsx"))):
        for path in root.rglob("*"):
            if path.suffix not in exts or "__tests__" in path.parts or ".test." in path.name:
                continue
            for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
                if _TRIPLE.search(line) and "mcp" not in line:
                    offenders.append(f"{path.relative_to(REPO)}:{n}")
    assert offenders == []

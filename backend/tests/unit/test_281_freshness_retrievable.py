"""Phase 281 (DEBT-07 / D-16) — the freshness check counts only retrievable documents.

``harness/freshness.py`` backs the ``freshness`` validator (``timing="pre"``). Before this
phase both of its raw-SQL reads counted archived and source-gone documents, so an archived
recent document made a stale folder read FRESH (CONTEXT D-20).

The fix IMPORTS the one Python name for "may an agent read this document" —
``retrieval_scope.RETRIEVABLE_COLUMN`` (Phase 275 D-36, migration 205's stored generated
column) — and never restates the predicate. Three proofs:

1. a recording fake pool shows the predicate in BOTH statements (RED at the phase base);
2. a reload SENTINEL shows the name is DERIVED from the import — a restated literal would
   pass (1) and fail here;
3. the ``test_272_scope_resolver.py`` no-f-string fence, transposed onto this file.
"""

from __future__ import annotations

import asyncio
import importlib
import re
from pathlib import Path
from uuid import uuid4

_SRC_PATH = Path(__file__).resolve().parents[2] / "app" / "services" / "harness" / "freshness.py"


class _RecordingPool:
    def __init__(self):
        self.calls: list[tuple[str, tuple]] = []

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        return {"newest": None}

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return []


def test_both_statements_carry_the_retrievable_predicate():
    from app.services.harness import freshness
    from app.services.retrieval_scope import RETRIEVABLE_COLUMN

    pool = _RecordingPool()
    scope = [uuid4()]
    asyncio.run(freshness.newest_document_age_days(pool, scope))
    asyncio.run(freshness.exact_stem_collisions(pool, scope))

    assert len(pool.calls) == 2
    for sql, args in pool.calls:
        assert re.search(r"\bAND\s+" + re.escape(RETRIEVABLE_COLUMN) + r"\b", sql), sql
        assert "ANY($1::uuid[])" in sql
        assert args == (scope,), "the bind args are unchanged"


def test_the_predicate_is_derived_from_the_import_not_restated(monkeypatch):
    import app.services.harness.freshness as fr
    import app.services.retrieval_scope as rs

    monkeypatch.setattr(rs, "RETRIEVABLE_COLUMN", "sentinel_col_281")
    try:
        reloaded = importlib.reload(fr)
        assert "sentinel_col_281" in reloaded._NEWEST_SQL
        assert "sentinel_col_281" in reloaded._STEMS_SQL
    finally:
        monkeypatch.undo()
        importlib.reload(fr)
    assert "sentinel_col_281" not in fr._NEWEST_SQL


def test_no_f_string_sql():
    src = _SRC_PATH.read_text(encoding="utf-8")
    assert not re.search(r"f\"[^\"]*(SELECT|WHERE)", src)
    assert not re.search(r"f'[^']*(SELECT|WHERE)", src)


def test_the_rule_is_never_restated_in_this_file():
    src = _SRC_PATH.read_text(encoding="utf-8")
    assert "archived_at" not in src
    lines = [ln for ln in src.splitlines() if "retrievable" in ln]
    assert lines == [], lines
    assert "from app.services.retrieval_scope import RETRIEVABLE_COLUMN" in src


# ── 281-REVIEW WR-02 — a scope whose every document is archived reads like an EMPTY scope ──
#
# Resolved as CONSISTENT BY DESIGN, not changed. Phase 102 designed the empty case
# explicitly: 102-03-PLAN specifies ``None when the scope is empty`` and the validator
# condition ``age is not None and age > max_age_days``, and ``freshness.py`` documents an
# empty scope as "no freshness signal, NOT stale". A folder with nothing an agent may read
# has nothing stale in it, so the verdict is the empty-folder verdict. What DEBT-07 forbids
# (an archived document's date deciding the verdict, D-20) is pinned by the control case.


class _FilteringPool:
    """A fake ``documents`` table that applies the imported predicate when the SQL asks."""

    def __init__(self, docs):
        self.docs = docs  # [{"created_at": datetime, "filename": str, "readable": bool}]

    def _rows(self, sql):
        from app.services.retrieval_scope import RETRIEVABLE_COLUMN

        filtered = re.search(r"\bAND\s+" + re.escape(RETRIEVABLE_COLUMN) + r"\b", sql)
        return [d for d in self.docs if d["readable"] or not filtered]

    async def fetchrow(self, sql, *args):
        rows = self._rows(sql)
        return {"newest": max((d["created_at"] for d in rows), default=None)}

    async def fetch(self, sql, *args):
        return [{"filename": d["filename"]} for d in self._rows(sql)]


def _freshness_verdict(docs):
    from types import SimpleNamespace

    import app.services.harness.validator_kinds  # noqa: F401
    from app.services.harness.validators import VALIDATOR_REGISTRY

    ctx = SimpleNamespace(pool=_FilteringPool(docs), folder_subtree_ids=[uuid4()])
    return asyncio.run(VALIDATOR_REGISTRY["freshness"]({}, {"max_age_days": 30}, ctx))


def _old_doc(readable):
    from datetime import datetime, timedelta, timezone

    return {
        "created_at": datetime.now(timezone.utc) - timedelta(days=400),
        "filename": "policy.docx",
        "readable": readable,
    }


def test_wr02_all_archived_scope_gets_the_empty_scope_verdict():
    empty = _freshness_verdict([])
    all_archived = _freshness_verdict([_old_doc(readable=False)])
    assert (all_archived.passed, all_archived.error_message) == (empty.passed, empty.error_message)
    assert empty.passed is True  # the Phase 102 design: no document is no staleness signal


def test_wr02_control_the_same_document_readable_is_stale():
    verdict = _freshness_verdict([_old_doc(readable=True)])
    assert verdict.passed is False
    assert str(verdict.error_message).startswith("freshness:staleness|")

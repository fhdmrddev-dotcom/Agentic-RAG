"""Phase 272-04 Task 3 (D-24) — refusals are not searches, so they never read as "found nothing".

272-04 records ``result_kind`` on every ``search.query`` row (D-12). Two of those kinds are a refusal,
not a search: ``invalid_filter`` (kind 3 — the filter was never run) and ``refused_retry`` (the D-09
lock). Both carry ``document_ids: []``, so without this reader line every misspelt entity would make
the Library's "found nothing" trend RISE. Kind 2 (``no_documents_matched``) is a real search that
honestly found nothing — it still counts. A provider error still counts as ``could_not_search``, and a
pre-272 row (no ``result_kind``) behaves exactly as before.
"""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from app.api.knowledge_health import _fetch_retrieval_trend


class _Builder:
    def __init__(self, rows):
        self._rows = rows

    def __getattr__(self, name):
        if name == "execute":
            return lambda: SimpleNamespace(data=self._rows)
        return lambda *a, **k: self


def _today(rows):
    sb = SimpleNamespace(table=lambda name: _Builder(rows))
    trend = _fetch_retrieval_trend(sb, "user-1", 7)
    today = datetime.now(timezone.utc).date().isoformat()
    return next(r for r in trend if r["date"] == today)


NOW = datetime.now(timezone.utc).isoformat()


def _row(**meta):
    return {"created_at": NOW, "metadata": {"query_text": "q", **meta}}


def test_refusals_add_nothing_to_the_trend():
    day = _today([
        _row(document_ids=[], result_kind="invalid_filter", filters=[{"field": "x", "op": "eq"}]),
        _row(document_ids=[], result_kind="refused_retry", filters=[]),
    ])
    assert day["retrieval_count"] == 0
    assert day["found_nothing"] == 0
    assert day["could_not_search"] == 0


def test_kind_2_still_counts_as_found_nothing():
    day = _today([_row(document_ids=[], result_kind="no_documents_matched", matched_document_count=0)])
    assert day["retrieval_count"] == 1 and day["found_nothing"] == 1


def test_provider_errors_and_passages_are_unchanged():
    day = _today([
        _row(document_ids=[], result_kind="provider_error", retrieval_status="provider_error"),
        _row(document_ids=["d-1"], result_kind="passages"),
    ])
    assert day["could_not_search"] == 1
    assert day["retrieval_count"] == 1 and day["found_something"] == 1 and day["found_nothing"] == 0
    assert day["unique_documents"] == 1


def test_pre_272_rows_behave_exactly_as_before():
    day = _today([
        _row(document_ids=[]),
        _row(document_ids=["d-1", "d-2"]),
        _row(document_ids=[], retrieval_status="provider_error"),
    ])
    assert day["retrieval_count"] == 2
    assert day["found_nothing"] == 1 and day["found_something"] == 1
    assert day["could_not_search"] == 1
    assert day["unique_documents"] == 2


def test_the_mixed_day():
    day = _today([
        _row(document_ids=[], result_kind="invalid_filter"),
        _row(document_ids=[], result_kind="refused_retry"),
        _row(document_ids=[], result_kind="no_documents_matched"),
        _row(document_ids=[], result_kind="provider_error", retrieval_status="provider_error"),
        _row(document_ids=["d-1"], result_kind="passages"),
        _row(document_ids=[]),
    ])
    assert day == {**day, "retrieval_count": 3, "found_nothing": 2, "found_something": 1, "could_not_search": 1}

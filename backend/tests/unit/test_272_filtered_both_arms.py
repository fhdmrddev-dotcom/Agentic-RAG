"""Phase 272-03 (FIND-07 / D-14 / D-18 / D-19 / D-10) — one document set reaches BOTH arms.

No database: ``retrieval_rpc._call_as_user`` and ``retrieval_rpc.embed_texts`` are recorded, so
every case reads the exact SQL, positional args and keyword args each arm hands the RPC.

* **SC#1 / D-19.** A filtered ``search_documents`` hands the SAME document-id list to the vector
  arm and the keyword arm, and still passes the chat folder scope to both — a filter narrows the
  scope, it never replaces it.
* **D-18.** An EMPTY set means "the filter matched nothing": zero RPC calls, ``([], 0.0)``.
  ``None`` means "no filter" and stays the pinned unfiltered call.
* **D-10.** Inside a matched set, rows that clear the configured threshold are returned alone;
  when none do, the top rows come back marked ``low_similarity`` instead of a false "nothing".
"""
from __future__ import annotations

import re

import pytest

import app.services.retrieval_rpc as rrpc
from app.config import settings

_SETTINGS = {
    "retrieval_top_k": 5,
    "retrieval_match_threshold": 0.3,
    "hybrid_candidate_count": 20,
    "rrf_k": 60,
    "vector_search_weight": 1.0,
    "keyword_search_weight": 1.0,
    "rerank_top_n": 5,
    "rerank_enabled": False,
    "hnsw_ef_search": 40,
    "hnsw_iterative_scan": "off",
}


def _placeholders(sql: str) -> int:
    return len(set(re.findall(r"\$(\d+)", sql)))


class _Result:
    def __init__(self, data):
        self.data = data
        self.count = None


class _Query:
    """A tiny supabase-py builder: records the table and returns canned rows on execute()."""

    def __init__(self, data):
        self._data = data

    def select(self, *a, **k):
        return self

    def in_(self, *a, **k):
        return self

    def execute(self):
        return _Result(self._data)


class _FakeSupabase:
    def __init__(self, documents: list[dict]):
        self._documents = documents

    def table(self, name):
        return _Query(self._documents if name == "documents" else [])


@pytest.fixture
def recorder(monkeypatch):
    calls: list[tuple] = []
    responses: dict[str, list[dict]] = {"vector": [], "keyword": []}

    async def _rec_call_as_user(user_id, fn_sql, *args, **kwargs):
        calls.append((fn_sql, args, kwargs))
        return [dict(r) for r in responses["vector" if "match_document_chunks" in fn_sql else "keyword"]]

    monkeypatch.setattr(rrpc, "_call_as_user", _rec_call_as_user)
    monkeypatch.setattr(rrpc, "embed_texts", lambda texts, **kw: [[0.25, 0.5]])
    for attr, value in _SETTINGS.items():
        monkeypatch.setattr(settings, attr, value)
    return {"calls": calls, "responses": responses}


def _set_hybrid(monkeypatch, hybrid: bool):
    monkeypatch.setattr(settings, "hybrid_search_enabled", hybrid)


# ── SC#1 / D-19: one list, both arms, folder scope kept ──────────────────────────────────────

@pytest.mark.parametrize("hybrid", [True, False])
async def test_filtered_call_hands_the_same_ids_to_both_arms(monkeypatch, recorder, hybrid):
    from app.services.retrieval_service import search_documents

    _set_hybrid(monkeypatch, hybrid)
    await search_documents(
        "q", "u1", _FakeSupabase([]), user_settings=None,
        folder_ids=["f1"], document_ids=["d1", "d2"],
    )
    calls = recorder["calls"]
    vector = [c for c in calls if "match_document_chunks" in c[0]]
    keyword = [c for c in calls if "keyword_search_chunks" in c[0]]
    assert len(vector) == 1, calls

    v_sql, v_args, v_kwargs = vector[0]
    assert _placeholders(v_sql) == 9, v_sql
    assert v_args[7] == ["d1", "d2"]
    assert v_args[8] == rrpc.FILTERED_EXACT_MAX_CHUNKS
    assert v_args[3] == rrpc.FILTERED_MATCH_FLOOR
    assert v_args[5] == ["f1"], "D-19: the folder scope must still reach the vector arm"
    assert v_kwargs["hnsw_iterative_scan"] == rrpc.FILTERED_ITERATIVE_SCAN

    if hybrid:
        assert len(keyword) == 1, calls
        k_sql, k_args, k_kwargs = keyword[0]
        assert _placeholders(k_sql) == 6, k_sql
        assert k_args[5] == ["d1", "d2"], "SC#1: the keyword arm must get the SAME set"
        assert k_args[5] == v_args[7]
        assert k_args[4] == ["f1"], "D-19: the folder scope must still reach the keyword arm"
        assert k_kwargs == {}
    else:
        assert keyword == []


# ── D-18: empty means nothing, None means no filter ──────────────────────────────────────────

@pytest.mark.parametrize("empty", [[], ()])
@pytest.mark.parametrize("hybrid", [True, False])
async def test_an_empty_set_issues_zero_rpc_calls(monkeypatch, recorder, empty, hybrid):
    from app.services.retrieval_service import search_documents

    _set_hybrid(monkeypatch, hybrid)
    result = await search_documents(
        "q", "u1", _FakeSupabase([]), user_settings=None, document_ids=empty,
    )
    assert result == ([], 0.0)
    assert recorder["calls"] == [], "D-18: an empty set reached an RPC — it would widen to everything"


@pytest.mark.parametrize("empty", [[], ()])
async def test_the_arms_themselves_refuse_an_empty_set_without_a_db_call(recorder, empty):
    assert await rrpc._vector_search("q", "u1", object(), None, 5, 0.3, None, document_ids=empty) == []
    assert await rrpc._keyword_search("q", "u1", object(), None, 5, document_ids=empty) == []
    assert recorder["calls"] == []


@pytest.mark.parametrize("hybrid", [True, False])
async def test_none_is_the_pinned_unfiltered_call(monkeypatch, recorder, hybrid):
    """``document_ids=None`` passed EXPLICITLY reads exactly 272-01's characterization pin."""
    from app.services.retrieval_service import search_documents

    _set_hybrid(monkeypatch, hybrid)
    await search_documents("q", "u1", _FakeSupabase([]), user_settings=None, document_ids=None)
    vector_call = (
        "SELECT id::text AS id, document_id::text AS document_id, content, chunk_index, similarity\n"
        "           FROM public.match_document_chunks($1::public.vector, $2, $3, $4, $5, $6, $7)",
        ("[0.25,0.5]", "u1", 20 if hybrid else 10, 0.3, None, None, "text-embedding-3-small"),
        {"hnsw_ef_search": 40, "hnsw_iterative_scan": "off"},
    )
    keyword_call = (
        "SELECT id::text AS id, document_id::text AS document_id, content, chunk_index, rank\n"
        "           FROM public.keyword_search_chunks($1, $2, $3, $4, $5)",
        ("q", "u1", 20, None, None),
        {},
    )
    assert recorder["calls"] == ([vector_call, keyword_call] if hybrid else [vector_call])


# ── D-10: the relaxed floor and the low_similarity mark ──────────────────────────────────────

def _row(cid: str, sim: float, doc: str = "d1") -> dict:
    return {"id": cid, "document_id": doc, "content": f"unique words for {cid}", "chunk_index": 0,
            "similarity": sim}


def test_rows_above_the_threshold_are_returned_alone_and_unmarked():
    from app.services.retrieval_rank import _select_filtered_vector_rows

    out = _select_filtered_vector_rows([_row("c1", 0.9), _row("c2", 0.2)], 0.3)
    assert [r["id"] for r in out] == ["c1"]
    assert "low_similarity" not in out[0]


def test_when_nothing_clears_the_threshold_the_top_rows_come_back_marked():
    from app.services.retrieval_rank import _select_filtered_vector_rows

    out = _select_filtered_vector_rows([_row("c1", 0.25), _row("c2", 0.1)], 0.3)
    assert [r["id"] for r in out] == ["c1", "c2"]
    assert all(r["low_similarity"] is True for r in out)


def test_no_rows_is_no_rows():
    from app.services.retrieval_rank import _select_filtered_vector_rows

    assert _select_filtered_vector_rows([], 0.3) == []


@pytest.mark.parametrize("hybrid", [True, False])
async def test_low_similarity_survives_fusion_dedup_and_enrich(monkeypatch, recorder, hybrid):
    from app.services.retrieval_service import search_documents

    _set_hybrid(monkeypatch, hybrid)
    recorder["responses"]["vector"] = [_row("c1", 0.25, "d1"), _row("c2", 0.1, "d2")]
    sb = _FakeSupabase([
        {"id": "d1", "filename": "one.pdf", "metadata": None, "version_number": 1,
         "folder_id": None, "source_connection_id": None},
        {"id": "d2", "filename": "two.pdf", "metadata": None, "version_number": 1,
         "folder_id": None, "source_connection_id": None},
    ])
    hits, _avg = await search_documents(
        "q", "u1", sb, user_settings=None, document_ids=["d1", "d2"],
    )
    assert {h["document_id"] for h in hits} == {"d1", "d2"}
    assert all(h.get("low_similarity") is True for h in hits), hits


async def test_a_hit_that_clears_the_threshold_carries_no_mark(monkeypatch, recorder):
    from app.services.retrieval_service import search_documents

    _set_hybrid(monkeypatch, True)
    recorder["responses"]["vector"] = [_row("c1", 0.9, "d1"), _row("c2", 0.1, "d2")]
    sb = _FakeSupabase([
        {"id": "d1", "filename": "one.pdf", "metadata": None, "version_number": 1,
         "folder_id": None, "source_connection_id": None},
    ])
    hits, _avg = await search_documents("q", "u1", sb, user_settings=None, document_ids=["d1", "d2"])
    # ⚠ D-27 (operator, 2026-10-03) REFINES D-10 and this case's old assertion with it: d2 used to
    # be DROPPED (``== ["d1"]``) because one passage in the set cleared the threshold. That drop is
    # finding F-2 — the model then reported "two" reports when three matched. d2 now comes back
    # with its best passage, marked; d1's passage still carries no mark.
    assert [h["document_id"] for h in hits] == ["d1", "d2"]
    assert "low_similarity" not in hits[0]
    assert hits[1].get("low_similarity") is True


# ── D-27 (operator, 2026-10-03, finding F-2): EVERY matched document keeps its best passage ──
#
# D-10 as first written dropped a matched document whose passages all fell under the threshold
# whenever ANY other document's passage cleared it. Board prompt (b) and G4-3 measured the cost:
# ``legal_entity = Acme GmbH`` matched 3 reports, 2 came back, and the answer said "two". Inside a
# matched set the filter already guarantees scope, so each matched document returns its best
# passage (up to top_k), below-threshold ones marked ``low_similarity``.

def test_a_document_under_the_threshold_keeps_its_best_passage_marked():
    from app.services.retrieval_rank import _select_filtered_vector_rows

    rows = [
        _row("a1", 0.9, "dA"), _row("b1", 0.25, "dB"), _row("a2", 0.2, "dA"),
        _row("b2", 0.1, "dB"), _row("c1", 0.05, "dC"),
    ]
    out = _select_filtered_vector_rows(rows, 0.3)
    assert [r["id"] for r in out] == ["a1", "b1", "c1"]
    assert "low_similarity" not in out[0]
    assert out[1]["low_similarity"] is True and out[2]["low_similarity"] is True
    assert "low_similarity" not in rows[1], "pure: the input row is never mutated"


def test_cover_keeps_one_passage_per_document_before_filling_by_rank():
    from app.services.retrieval_rank import _cover_matched_documents

    ranked = [_row(f"a{i}", 0.9 - i / 100, "dA") for i in range(1, 6)] + [
        _row("b1", 0.4, "dB"), _row("c1", 0.35, "dC"),
    ]
    out = _cover_matched_documents(ranked, 5)
    assert [r["id"] for r in out] == ["a1", "a2", "a3", "b1", "c1"], "rank order kept"


def test_cover_never_exceeds_top_k_when_more_documents_match():
    from app.services.retrieval_rank import _cover_matched_documents

    ranked = [_row(f"x{i}", 0.9 - i / 100, f"d{i}") for i in range(6)]
    assert [r["id"] for r in _cover_matched_documents(ranked, 3)] == ["x0", "x1", "x2"]
    assert _cover_matched_documents([], 3) == []


def _six_strong_and_one_weak() -> list[dict]:
    strong = [
        {"id": f"a{i}", "document_id": "dA", "content": f"alpha {i} " + " ".join(f"w{i}x{j}" for j in range(8)),
         "chunk_index": i, "similarity": 0.9 - i / 100}
        for i in range(6)
    ]
    weak = {"id": "b0", "document_id": "dB", "content": "beta lone passage words here", "chunk_index": 0,
            "similarity": 0.2}
    return [*strong, weak]


_DOCS_AB = [
    {"id": "dA", "filename": "a.md", "metadata": None, "version_number": 1,
     "folder_id": None, "source_connection_id": None},
    {"id": "dB", "filename": "b.md", "metadata": None, "version_number": 1,
     "folder_id": None, "source_connection_id": None},
]


@pytest.mark.parametrize("hybrid", [True, False])
async def test_a_weak_matched_document_survives_the_top_k_cut(monkeypatch, recorder, hybrid):
    """dA fills every top_k slot on its own; dB still returns its best passage, marked."""
    from app.services.retrieval_service import search_documents

    _set_hybrid(monkeypatch, hybrid)
    recorder["responses"]["vector"] = _six_strong_and_one_weak()
    hits, _avg = await search_documents(
        "q", "u1", _FakeSupabase(_DOCS_AB), user_settings=None, document_ids=["dA", "dB"],
    )
    assert len(hits) == 5
    assert {h["document_id"] for h in hits} == {"dA", "dB"}
    weak = [h for h in hits if h["document_id"] == "dB"]
    assert len(weak) == 1 and weak[0].get("low_similarity") is True
    assert all("low_similarity" not in h for h in hits if h["document_id"] == "dA")


async def test_rerank_cannot_drop_a_matched_document(monkeypatch, recorder):
    """The reranker may reorder a filtered set; the top_k cut still keeps one passage per document."""
    import app.services.retrieval_service as rs
    from app.services.retrieval_service import search_documents

    _set_hybrid(monkeypatch, True)
    monkeypatch.setattr(settings, "rerank_enabled", True)
    seen: dict = {}

    def _fake_rerank(query, documents, top_n=None, user_settings=None):
        seen["top_n"] = top_n
        return list(documents)[: top_n or len(documents)]

    monkeypatch.setattr(rs, "rerank", _fake_rerank)
    recorder["responses"]["vector"] = _six_strong_and_one_weak()
    hits, _avg = await search_documents(
        "q", "u1", _FakeSupabase(_DOCS_AB), user_settings=None, document_ids=["dA", "dB"],
    )
    assert {h["document_id"] for h in hits} == {"dA", "dB"}
    assert len(hits) == 5

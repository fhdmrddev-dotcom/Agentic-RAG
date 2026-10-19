"""Phase 294-01 (D-12 / SC#1) — rerank OFF is byte-identical, whatever engine is selected.

The fixture ``tests/fixtures/phase294/rerank_off_base_v1.json`` was CAPTURED FROM THE BASE CODE
(``4e7e94a82``, before any 294 edit) by running this module as a script::

    venv/Scripts/python -m tests.unit.test_294_off_is_byte_identical --capture

and committed with the RED commit. The cases below re-run the same searches on the current code
with ``rerank_enabled=False`` for EVERY accepted ``rerank_provider`` value and compare the JSON
serialisation byte-for-byte. ``rerank``, every engine HTTP-client factory and the local model
loader are patched to raise, and each patch records a call, so "no engine was constructed" is
asserted rather than assumed.

No database: ``retrieval_rpc._call_as_user`` and ``retrieval_rpc.embed_texts`` are faked (the
``test_272_filtered_both_arms`` idiom), and the documents table is a canned in-memory reader.
"""
from __future__ import annotations

import asyncio
import json
import pathlib
import sys

import pytest

FIXTURE = pathlib.Path(__file__).resolve().parent.parent / "fixtures" / "phase294" / "rerank_off_base_v1.json"

# Every value the dispatcher accepts (registry.ACCEPTED_PROVIDER_IDS is asserted equal below).
PROVIDERS = ("api", "cohere", "local", "jev", "openai_decisions")

_SETTINGS = {
    "retrieval_top_k": 5,
    "retrieval_match_threshold": 0.3,
    "hybrid_candidate_count": 20,
    "rrf_k": 60,
    "vector_search_weight": 1.0,
    "keyword_search_weight": 1.0,
    # The pool (max(top_k, rerank_top_n) = 8) is LARGER than top_k, so the off-path [:top_k]
    # cut is observable: a fallback that returned the whole pool would not match.
    "rerank_top_n": 8,
    "rerank_enabled": False,
    "rerank_api_key": "sk-cohere-PLANTED-294",
    "rerank_model": "rerank-v3.5",
    "hnsw_ef_search": 40,
    "hnsw_iterative_scan": "off",
}


def _vrow(i: int, doc: str, sim: float) -> dict:
    words = " ".join(f"v{i}w{j}" for j in range(10))
    return {"id": f"c{i}", "document_id": doc, "content": f"passage {i} of {doc}: {words}",
            "chunk_index": i, "similarity": sim}


def _krow(i: int, doc: str, rank: float) -> dict:
    words = " ".join(f"v{i}w{j}" for j in range(10))
    return {"id": f"c{i}", "document_id": doc, "content": f"passage {i} of {doc}: {words}",
            "chunk_index": i, "rank": rank}


VECTOR_ROWS = [
    _vrow(0, "dA", 0.91), _vrow(1, "dA", 0.82), _vrow(2, "dB", 0.74), _vrow(3, "dA", 0.66),
    _vrow(4, "dC", 0.51), _vrow(5, "dB", 0.42), _vrow(6, "dD", 0.28), _vrow(7, "dC", 0.21),
]
KEYWORD_ROWS = [
    _krow(5, "dB", 0.9), _krow(8, "dD", 0.8), _krow(2, "dB", 0.7), _krow(9, "dE", 0.6),
    _krow(0, "dA", 0.5), _krow(10, "dC", 0.4),
]
DOCUMENTS = [
    {"id": d, "filename": f"{d}.pdf", "metadata": {"year": "2025"} if d == "dA" else None,
     "version_number": 1, "folder_id": None, "source_connection_id": None}
    for d in ("dA", "dB", "dC", "dD", "dE")
]

# (case id, hybrid, document_ids)
CASES = [
    ("hybrid_unfiltered", True, None),
    ("hybrid_filtered", True, ["dA", "dB", "dC"]),
    ("vector_only_unfiltered", False, None),
    ("vector_only_filtered", False, ["dA", "dB", "dC"]),
]


class _Result:
    def __init__(self, data):
        self.data = data
        self.count = None


class _Query:
    def __init__(self, data):
        self._data = data

    def select(self, *a, **k):
        return self

    def in_(self, *a, **k):
        return self

    def execute(self):
        return _Result(self._data)


class _FakeSupabase:
    def table(self, name):
        return _Query([dict(d) for d in DOCUMENTS] if name == "documents" else [])


def _install_fakes(mp: pytest.MonkeyPatch, hybrid: bool, provider: str) -> None:
    import app.services.retrieval_rpc as rrpc
    from app.config import settings

    async def _rec_call_as_user(user_id, fn_sql, *args, **kwargs):
        rows = VECTOR_ROWS if "match_document_chunks" in fn_sql else KEYWORD_ROWS
        return [dict(r) for r in rows]

    mp.setattr(rrpc, "_call_as_user", _rec_call_as_user)
    mp.setattr(rrpc, "embed_texts", lambda texts, **kw: [[0.25, 0.5]])
    for attr, value in _SETTINGS.items():
        mp.setattr(settings, attr, value)
    mp.setattr(settings, "hybrid_search_enabled", hybrid)
    mp.setattr(settings, "rerank_provider", provider)


async def _run(document_ids, **kw):
    from app.services.retrieval_service import search_documents

    return await search_documents(
        "what were the 2025 figures", "u1", _FakeSupabase(), user_settings=None,
        document_ids=document_ids, **kw,
    )


def _serialise(result) -> str:
    return json.dumps(result, sort_keys=True, ensure_ascii=True)


def _capture() -> None:
    """Base-code capture. Run ONCE, before any 294 edit; the output is committed."""
    out = {}
    for case_id, hybrid, document_ids in CASES:
        with pytest.MonkeyPatch.context() as mp:
            _install_fakes(mp, hybrid, "cohere")
            out[case_id] = json.loads(_serialise(asyncio.run(_run(document_ids))))
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(json.dumps(out, sort_keys=True, indent=1) + "\n", encoding="utf-8")
    print(f"captured {len(out)} cases -> {FIXTURE}")


# ── Guards that make the fixture meaningful (non-vacuity) ─────────────────────────────────────

def test_the_fixture_exists_and_covers_every_path():
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert set(data) == {c[0] for c in CASES}
    for case_id, (hits, _avg) in data.items():
        assert hits, f"{case_id}: an empty fixture would make the comparison vacuous"
        assert len(hits) <= _SETTINGS["retrieval_top_k"], case_id


def test_the_case_list_names_every_accepted_provider():
    from app.services.rerank_engines.registry import ACCEPTED_PROVIDER_IDS

    assert set(PROVIDERS) == set(ACCEPTED_PROVIDER_IDS)


# ── D-12: off is byte-identical and constructs nothing ────────────────────────────────────────

def _forbid(mp: pytest.MonkeyPatch, calls: list[str]) -> list[str]:
    """Patch every engine entry point to raise; returns the names patched (non-vacuity)."""
    import importlib
    import importlib.util

    import app.services.rerank_engines.local as local
    import app.services.rerank_service as rerank_service
    import app.services.retrieval_service as rs
    from app.services.rerank_engines.registry import ENGINES

    def _boom(name):
        def _raise(*a, **k):
            calls.append(name)
            raise AssertionError(f"D-12: {name} was called with rerank off")
        return _raise

    patched = []
    mp.setattr(rs, "rerank", _boom("retrieval_service.rerank"))
    mp.setattr(rerank_service, "rerank", _boom("rerank_service.rerank"))
    for eid, spec in ENGINES.items():
        if importlib.util.find_spec(f"app.services.rerank_engines.{eid}") is None:
            continue  # the adapter lands in a later task; the non-vacuity case below names it
        mod = importlib.import_module(f"app.services.rerank_engines.{eid}")
        mp.setattr(mod, "rerank", _boom(f"{eid}.rerank"))
        patched.append(f"{eid}.rerank")
        if spec.hosted:
            mp.setattr(mod, "_http_client", _boom(f"{eid}._http_client"))
            patched.append(f"{eid}._http_client")
    mp.setattr(local, "_get_local_model", _boom("local._get_local_model"))
    mp.setattr(local, "warm", _boom("local.warm"))
    return patched


def test_every_engine_entry_point_is_forbidden():
    """Non-vacuity: all four adapters and the three hosted client factories are patched."""
    with pytest.MonkeyPatch.context() as mp:
        patched = _forbid(mp, [])
    assert sorted(patched) == sorted([
        "cohere.rerank", "cohere._http_client", "local.rerank", "jev.rerank", "jev._http_client",
        "openai_decisions.rerank", "openai_decisions._http_client",
    ])


@pytest.mark.parametrize("provider", PROVIDERS)
@pytest.mark.parametrize("case_id,hybrid,document_ids", CASES, ids=[c[0] for c in CASES])
async def test_rerank_off_is_byte_identical_to_the_base_fixture(provider, case_id, hybrid, document_ids):
    expected = json.loads(FIXTURE.read_text(encoding="utf-8"))[case_id]
    calls: list[str] = []
    with pytest.MonkeyPatch.context() as mp:
        _install_fakes(mp, hybrid, provider)
        _forbid(mp, calls)
        result = await _run(document_ids)
    assert calls == []
    assert _serialise(result) == _serialise(expected)



# ── D-12 with a steering instruction (checker W4): still the SAME base fixture ───────────────

@pytest.mark.parametrize("provider", PROVIDERS)
@pytest.mark.parametrize("case_id,hybrid,document_ids", CASES, ids=[c[0] for c in CASES])
async def test_rerank_off_with_an_instruction_is_still_byte_identical(provider, case_id, hybrid, document_ids):
    expected = json.loads(FIXTURE.read_text(encoding="utf-8"))[case_id]
    calls: list[str] = []
    with pytest.MonkeyPatch.context() as mp:
        _install_fakes(mp, hybrid, provider)
        _forbid(mp, calls)
        result = await _run(document_ids, instruction="prefer 2025")
    assert calls == []
    assert _serialise(result) == _serialise(expected)

if __name__ == "__main__":  # pragma: no cover — the one-time base capture
    if "--capture" in sys.argv:
        _capture()

"""Phase 271 (271-01 Task 3) — D-03: the Find path makes NO embedding call.

Find is an exact field match beside RAG (FIND-02); it must never embed the query, never
retrieve chunks and never call an RPC. Three layers, the ``test_189_no_egress`` shape:

  1. **A raising patch** on every embedding entry point — ``openai_service.embed_texts``,
     ``embedding_service.embed_chunks`` and the ``embed_texts`` / ``embed_chunks`` NAME in
     every module that imports either — then ``search_documents`` is driven across every
     condition kind. Nothing may raise.
  2. **An inertness control**: the patched ``openai_service.embed_texts`` DOES raise when
     called, so layer 1 measured something.
  3. **A source fence** over the three new modules: none names an embedding / retrieval
     module or ``.rpc(``. A positive-control haystack proves the scan can find a planted hit.
"""

from __future__ import annotations

import importlib
import pathlib
import re

import pytest

from tests.unit.test_271_search_core import (
    CONN,
    F1,
    F2,
    FakePostgrest,
    G1,
    OTHER,
    doc,
    patched,  # noqa: F401 — the shared seam-patching fixture
    run,
)
from tests.unit.test_271_relationship_filter import P2, _graph


class _EmbeddingCalled(AssertionError):
    pass


def _boom(*_a, **_k):
    raise _EmbeddingCalled("the document-search path reached an embedding entry point")


# (module, attribute) — every place an embedding function can be reached by name.
_EMBED_SITES = [
    ("app.services.openai_service", "embed_texts"),
    ("app.services.embedding_service", "embed_chunks"),
    ("app.services.embedding_service", "embed_texts"),
    ("app.services.retrieval_service", "embed_texts"),
    ("app.services.multimodal_service", "embed_texts"),
    ("app.services.reembed_service", "embed_texts"),
    ("app.services.skill_embedding_service", "embed_texts"),
    ("app.api.documents", "embed_chunks"),
]


def _block_embeddings(monkeypatch):
    for mod_name, attr in _EMBED_SITES:
        mod = importlib.import_module(mod_name)
        assert hasattr(mod, attr), f"{mod_name}.{attr} moved — update the fence, do not drop it"
        monkeypatch.setattr(mod, attr, _boom)


def test_the_embedding_patch_is_not_inert(monkeypatch):
    _block_embeddings(monkeypatch)
    from app.services import embedding_service, openai_service

    with pytest.raises(_EmbeddingCalled):
        openai_service.embed_texts(["q"])
    with pytest.raises(_EmbeddingCalled):
        embedding_service.embed_chunks(["q"])


def _rows():
    return [
        doc("a1", filename="A.pdf", version_number=1, is_latest=False, folder_id=F1),
        doc("a2", filename="A.pdf", version_number=2, is_latest=True, folder_id=F1,
            created_at="2024-02-01T00:00:00+00:00", source_created_at="2023-01-01T00:00:00+00:00",
            source_modified_at="2023-06-01T00:00:00+00:00", date_typed="2022-01-01",
            document_type_norm="contract"),
        doc("c", source_connection_id=CONN, folder_id=F2),
        doc("g", user_id=OTHER, folder_id=G1),
    ]


_BODIES = [
    {},
    {"name": "A"},
    {"folder": {"folder_id": F1}},
    {"folder": {"folder_id": F1, "include_subfolders": False}},
    {"folder": {"folder_id": None}},
    {"added_by": {"kind": "me"}},
    {"added_by": {"kind": "connection", "connection_id": CONN}},
    {"added_by": {"kind": "others"}},
    {"dates": [{"which": "added", "op": "between", "value": "2024-01-01", "value2": "2024-12-31"}]},
    {"dates": [{"which": "source_created", "op": "before", "value": "2024-01-01"}]},
    {"dates": [{"which": "source_modified", "op": "within_next", "value": 3, "unit": "months"}]},
    {"dates": [{"which": "added", "op": "older_than", "value": 2, "unit": "weeks"}]},
    {"filter_expr": {"op": "and", "conditions": [
        {"field": "document_type", "op": "eq", "value": "contract"},
        {"field": "date", "op": "after", "value": "2020-01-01"}]}},
    {"version": "latest"},
    {"version": "has_earlier"},
    {"version": "older"},
] + [{"sort": s} for s in ("added_desc", "added_asc", "document_date_desc",
                           "source_modified_desc", "source_created_desc", "name_asc")]

_VERBS = ["supersedes", "superseded_by", "amends", "amended_by",
          "references", "referenced_by", "attached_to", "has_attachment"]


@pytest.mark.asyncio
@pytest.mark.parametrize("body", _BODIES)
async def test_no_condition_kind_reaches_an_embedding(patched, monkeypatch, body):
    _block_embeddings(monkeypatch)
    patched["global"] = [G1]
    patched["visible"] = [F1, F2]
    patched["subtree"] = [F1, F2]
    out = await run(FakePostgrest({"documents": _rows()}), **body)
    assert "documents" in out


@pytest.mark.asyncio
@pytest.mark.parametrize("verb", _VERBS)
@pytest.mark.parametrize("version", ["latest", "has_earlier", "older"])
async def test_no_relationship_verb_reaches_an_embedding(patched, monkeypatch, verb, version):
    _block_embeddings(monkeypatch)
    out = await run(_graph(), relationship={"verb": verb, "document_id": P2}, version=version)
    assert "documents" in out


# ─────────────────────────────── source fence ───────────────────────────────

_APP = pathlib.Path(__file__).resolve().parents[2] / "app"
_FENCED_FILES = [
    _APP / "services" / "document_search_service.py",
    _APP / "api" / "document_search.py",
    _APP / "models" / "document_search.py",
]
_FORBIDDEN = re.compile(
    r"embed_texts|embed_chunks|openai_service|embedding_service|retrieval_service|\.rpc\("
)


def _hits(text: str) -> list[str]:
    return _FORBIDDEN.findall(text)


def test_the_source_fence_can_find_a_planted_hit():
    haystack = 'x = supabase.rpc("match_chunks", {})\nfrom app.services.retrieval_service import y\n'
    assert _hits(haystack) == [".rpc(", "retrieval_service"]


@pytest.mark.parametrize("path", _FENCED_FILES, ids=lambda p: p.name)
def test_the_new_modules_name_no_embedding_retrieval_or_rpc(path):
    assert path.exists(), f"{path} is missing — the fence would pass vacuously"
    text = path.read_text(encoding="utf-8")
    assert len(text) > 500
    assert _hits(text) == []

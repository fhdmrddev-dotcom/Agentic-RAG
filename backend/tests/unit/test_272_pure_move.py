"""Phase 272-01 (D-13) — the extraction of ``retrieval_service.py`` is a PURE MOVE, proven.

``retrieval_service.py`` carried *"extraction still OWED (SEED-224, since 231) … a THIRD must
propose the extraction FIRST"*, and Phase 272 is that third landing. So the extraction is taken
before any behaviour lands, and this suite is the proof that it is a move and not a rewrite:

1. **AST equality against the plan's base commit.** Every moved function, parsed from
   ``git show PLAN_BASE_SHA:backend/app/services/retrieval_service.py``, dumps to the same AST as
   the function now living in its new home. ``ast.dump`` ignores line numbers and comments, so a
   verbatim cut passes and a retyped body does not.
2. **The orchestrator is untouched.** ``search_documents`` itself is AST-identical to the base.
3. **Back-compat names.** Every name a measured importer reads from ``retrieval_service`` is still
   there and is the SAME object as in its new home (a re-export, not a copy that can drift).
4. **The unfiltered call is pinned (characterization).** The exact RPC SQL, positional args and
   keyword args an unfiltered ``search_documents`` issues — hybrid on and hybrid off. This test is
   GREEN at the base commit (that is its job) and must stay byte-identical through the phase.

⚠ Structured so a later plan can retire ONE AST case BY NAME without touching the rest: ``MOVE_MAP``
minus ``RETIRED`` is what is compared. ``RETIRED`` is EMPTY in 272-01; 272-03 retires
``_vector_search`` / ``_keyword_search`` there because it changes them on purpose, with the reason
written in as the dict value.
"""
from __future__ import annotations

import ast
import importlib
import subprocess
from pathlib import Path

import pytest

PLAN_BASE_SHA = "f49d9ea2d354a42d66eb007de9d9ca6a451afe81"

REPO_ROOT = Path(__file__).resolve().parents[3]

_BASE_REL = "backend/app/services/retrieval_service.py"

# name → the module it now lives in (relative to the repo root).
MOVE_MAP: dict[str, str] = {
    "_vector_literal": "backend/app/services/retrieval_rpc.py",
    "_call_as_user": "backend/app/services/retrieval_rpc.py",
    "_vector_search": "backend/app/services/retrieval_rpc.py",
    "_keyword_search": "backend/app/services/retrieval_rpc.py",
    "_rrf_fuse": "backend/app/services/retrieval_rank.py",
    "_deduplicate_chunks": "backend/app/services/retrieval_rank.py",
    "_avg_cosine": "backend/app/services/retrieval_rank.py",
    "_enrich_with_filenames": "backend/app/services/retrieval_documents.py",
    "resolve_document_id": "backend/app/services/retrieval_documents.py",
    "fetch_full_document": "backend/app/services/retrieval_documents.py",
}

# name → the reason it is no longer compared. EMPTY in 272-01 — nothing here changed on purpose.
RETIRED: dict[str, str] = {}

# The ONE function whose docstring is compared out: 272-01 rewrites `_call_as_user`'s G-5
# paragraph DELIBERATELY (the extraction it described as owed is discharged by this plan). Its
# code is still compared in full; only the docstring constant is stripped, on both sides.
_DOCSTRING_STRIPPED = {"_call_as_user"}


def _blob_at_base(rel_path: str) -> str:
    """A tracked file's contents at the plan's base commit."""
    # ⚠ `encoding` IS LOAD-BEARING ON WINDOWS (the test_214 precedent). `text=True` alone decodes
    # with the locale codec (cp1252 here), and these modules carry `⚠` / `—` in their comments —
    # so the reader thread dies with a `UnicodeDecodeError`, `.stdout` comes back `None`, and the
    # fence fails with an `AttributeError` that looks nothing like the property it pins.
    return subprocess.run(
        ["git", "show", f"{PLAN_BASE_SHA}:{rel_path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    ).stdout


def _module_source(rel_path: str) -> str:
    return (REPO_ROOT / rel_path).read_text(encoding="utf-8")


def _top_level_function(src: str, name: str) -> ast.FunctionDef | ast.AsyncFunctionDef | None:
    for node in ast.parse(src).body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    return None


def _strip_docstring(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
    body = fn.body
    if (
        body
        and isinstance(body[0], ast.Expr)
        and isinstance(body[0].value, ast.Constant)
        and isinstance(body[0].value.value, str)
    ):
        fn.body = body[1:]


def _dump(fn: ast.FunctionDef | ast.AsyncFunctionDef, *, strip_doc: bool) -> str:
    if strip_doc:
        _strip_docstring(fn)
    return ast.dump(fn)


def test_moved_functions_are_ast_identical():
    base_src = _blob_at_base(_BASE_REL)
    compared = []
    for name, new_home in MOVE_MAP.items():
        if name in RETIRED:
            continue
        base_fn = _top_level_function(base_src, name)
        new_fn = _top_level_function(_module_source(new_home), name)
        assert base_fn is not None, f"{name} not found in {_BASE_REL} at {PLAN_BASE_SHA}"
        assert new_fn is not None, f"{name} not found in {new_home}"
        strip = name in _DOCSTRING_STRIPPED
        assert _dump(new_fn, strip_doc=strip) == _dump(base_fn, strip_doc=strip), (
            f"{name} in {new_home} is not AST-identical to its PHASE_BASE source — the move "
            "retyped it. A pure move is a cut, never a rewrite."
        )
        compared.append(name)
    # Non-vacuity: every name the map promises was found in BOTH sources and compared.
    assert len(compared) == len(MOVE_MAP) - len(RETIRED)


def test_search_documents_is_unchanged():
    base_fn = _top_level_function(_blob_at_base(_BASE_REL), "search_documents")
    new_fn = _top_level_function(_module_source(_BASE_REL), "search_documents")
    assert base_fn is not None and new_fn is not None
    assert ast.dump(new_fn) == ast.dump(base_fn)


def test_back_compat_names():
    rs = importlib.import_module("app.services.retrieval_service")
    rpc = importlib.import_module("app.services.retrieval_rpc")
    docs = importlib.import_module("app.services.retrieval_documents")
    homes = {
        "search_documents": rs,
        "resolve_document_id": docs,
        "fetch_full_document": docs,
        "_call_as_user": rpc,
        "_vector_literal": rpc,
        "_enrich_with_filenames": docs,
    }
    for name, home in homes.items():
        assert hasattr(rs, name), f"retrieval_service.{name} is gone — a measured importer reads it"
        assert getattr(rs, name) is getattr(home, name), (
            f"retrieval_service.{name} is not the object in {home.__name__} — a copy, not a re-export"
        )


# ── Characterization: the unfiltered call, pinned ────────────────────────────────────────────

_VECTOR_SQL = (
    "SELECT id::text AS id, document_id::text AS document_id, content, chunk_index, similarity\n"
    "           FROM public.match_document_chunks($1::public.vector, $2, $3, $4, $5, $6, $7)"
)
_KEYWORD_SQL = (
    "SELECT id::text AS id, document_id::text AS document_id, content, chunk_index, rank\n"
    "           FROM public.keyword_search_chunks($1, $2, $3, $4, $5)"
)


def _rpc_home():
    """The module that DEFINES `_call_as_user` — where `_vector_search` resolves it from."""
    try:
        return importlib.import_module("app.services.retrieval_rpc")
    except ImportError:
        return importlib.import_module("app.services.retrieval_service")


@pytest.mark.parametrize("hybrid", [True, False])
async def test_unfiltered_rpc_calls_are_pinned(monkeypatch, hybrid):
    from app.config import settings
    from app.services.retrieval_service import search_documents

    home = _rpc_home()
    calls: list[tuple] = []
    embeds: list[tuple] = []

    async def _rec_call_as_user(user_id, fn_sql, *args, **kwargs):
        calls.append((fn_sql, args, kwargs))
        return []

    def _rec_embed(texts, **kwargs):
        embeds.append((tuple(texts), kwargs))
        return [[0.25, 0.5]]

    monkeypatch.setattr(home, "_call_as_user", _rec_call_as_user)
    monkeypatch.setattr(home, "embed_texts", _rec_embed)
    for attr, value in {
        "hybrid_search_enabled": hybrid,
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
    }.items():
        monkeypatch.setattr(settings, attr, value)

    results, avg = await search_documents("q", "u1", supabase=object(), user_settings=None)

    assert results == [] and avg == 0.0
    assert embeds == [(("q",), {"user_settings": None})]
    vector_call = (
        _VECTOR_SQL,
        ("[0.25,0.5]", "u1", 20 if hybrid else 10, 0.3, None, None, "text-embedding-3-small"),
        {"hnsw_ef_search": 40, "hnsw_iterative_scan": "off"},
    )
    keyword_call = (_KEYWORD_SQL, ("q", "u1", 20, None, None), {})
    expected = [vector_call, keyword_call] if hybrid else [vector_call]
    assert calls == expected

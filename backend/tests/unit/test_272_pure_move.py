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
written in as the dict value. 272-03 also retires ``test_search_documents_is_unchanged``; the move
proof for all three survives as history against ``WAVE1_MERGE_SHA``.
"""
from __future__ import annotations

import ast
import importlib
import subprocess
from pathlib import Path

import pytest

PLAN_BASE_SHA = "f49d9ea2d354a42d66eb007de9d9ca6a451afe81"

# 272-03 — the wave-1 merge commit (272-01 + 272-02). At THIS commit every moved function was still
# a pure move; the three cases 272-03 retires below stay proven AS HISTORY against it.
WAVE1_MERGE_SHA = "020a0f41f7f9155783eb38790fef40e052bbcfcf"

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
# ⚠ RETIRED DELIBERATELY BY 272-03 (SEED-177: retire a fence on purpose, never trip it by surprise).
_272_03_REASON = (
    "pure move proven at 272-01's merge (WAVE1_MERGE_SHA); 272-03 is the intended behaviour "
    "change (D-14 / D-18 / D-19: document_ids on both arms)"
)
# ⚠ RETIRED DELIBERATELY BY 272-05 (SEED-177). The post-restart probe found the second cause of
# finding F-2: the near-duplicate filter dropped a matched document (Sep vs Oct report, Jaccard
# 0.90). D-27 needs a keyword-only ``same_document_only`` on the filtered path; the default path is
# pinned unchanged by ``test_272_filtered_both_arms::test_the_default_dedup_is_unchanged…``.
_272_05_D27_REASON = (
    "pure move proven at D27_PRE_DEDUP_SHA; 272-05 adds same_document_only on purpose (D-27: a "
    "matched document is never collapsed into a different one); the default path is unchanged"
)
D27_PRE_DEDUP_SHA = "c29ec8635465af823590c30d6f3c902a392b1673"

RETIRED: dict[str, str] = {
    "_vector_search": _272_03_REASON,
    "_keyword_search": _272_03_REASON,
    "_deduplicate_chunks": _272_05_D27_REASON,
}

# The ONE function whose docstring is compared out: 272-01 rewrites `_call_as_user`'s G-5
# paragraph DELIBERATELY (the extraction it described as owed is discharged by this plan). Its
# code is still compared in full; only the docstring constant is stripped, on both sides.
_DOCSTRING_STRIPPED = {"_call_as_user"}


def _blob_at_base(rel_path: str, sha: str = PLAN_BASE_SHA) -> str:
    """A tracked file's contents at the plan's base commit (or at ``sha``)."""
    # ⚠ `encoding` IS LOAD-BEARING ON WINDOWS (the test_214 precedent). `text=True` alone decodes
    # with the locale codec (cp1252 here), and these modules carry `⚠` / `—` in their comments —
    # so the reader thread dies with a `UnicodeDecodeError`, `.stdout` comes back `None`, and the
    # fence fails with an `AttributeError` that looks nothing like the property it pins.
    return subprocess.run(
        ["git", "show", f"{sha}:{rel_path}"],
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


def test_search_documents_fence_retired_by_272_03():
    """⚠ RETIRED DELIBERATELY BY 272-03 (SEED-177) — formerly ``test_search_documents_is_unchanged``.
    It pinned ``search_documents`` AST-identical to PHASE_BASE, which was the proof that 272-01 moved code without changing the
    orchestrator. That proof is complete and survives as history:
    ``test_272_03_retired_cases_proven_at_wave1_merge`` re-runs it against WAVE1_MERGE_SHA.
    272-03 then changes ``search_documents`` ON PURPOSE (D-14 / D-18 / D-19 / D-10: the
    ``document_ids`` parameter), so comparing the LIVE function to the base would fail by design.
    The unfiltered behaviour stays pinned by ``test_unfiltered_rpc_calls_are_pinned`` (unchanged).

    What it asserts instead: the retirement is NECESSARY, not cosmetic — the live orchestrator
    really does differ from the base — and its history proof is registered below.
    """
    base_fn = _top_level_function(_blob_at_base(_BASE_REL), "search_documents")
    new_fn = _top_level_function(_module_source(_BASE_REL), "search_documents")
    assert base_fn is not None and new_fn is not None
    assert ast.dump(new_fn) != ast.dump(base_fn), (
        "search_documents is AST-identical to PHASE_BASE again — the 272-03 retirement is stale; "
        "restore test_search_documents_is_unchanged"
    )
    assert "search_documents" in _RETIRED_AT_WAVE1, _272_03_REASON


# ── 272-03: the retired cases, proven as history + changed on purpose ────────────────────────

_RETIRED_AT_WAVE1 = {
    "_vector_search": "backend/app/services/retrieval_rpc.py",
    "_keyword_search": "backend/app/services/retrieval_rpc.py",
    "search_documents": _BASE_REL,
}


def test_272_03_retired_cases_proven_at_wave1_merge():
    """The pure move of the three functions 272-03 changes was TRUE at the wave-1 merge: each,
    parsed from that commit's blob, is AST-identical to its PHASE_BASE source."""
    base_src = _blob_at_base(_BASE_REL)
    found = []
    for name, home in _RETIRED_AT_WAVE1.items():
        base_fn = _top_level_function(base_src, name)
        wave1_fn = _top_level_function(_blob_at_base(home, WAVE1_MERGE_SHA), name)
        assert base_fn is not None, f"{name} not found at {PLAN_BASE_SHA}"
        assert wave1_fn is not None, f"{name} not found in {home} at {WAVE1_MERGE_SHA}"
        assert ast.dump(wave1_fn) == ast.dump(base_fn), (
            f"{name} at WAVE1_MERGE_SHA is not AST-identical to PHASE_BASE — the move was not pure"
        )
        found.append(name)
    assert len(found) == 3


def test_272_03_retired_cases_changed_on_purpose():
    """The divergence is the INTENDED change, not drift: each live function's LAST parameter is
    ``document_ids`` defaulting to ``None``."""
    for name, home in _RETIRED_AT_WAVE1.items():
        fn = _top_level_function(_module_source(home), name)
        assert fn is not None, f"{name} not found in {home}"
        args = fn.args
        assert args.args[-1].arg == "document_ids", f"{name}: last parameter is {args.args[-1].arg}"
        default = args.defaults[-1]
        assert isinstance(default, ast.Constant) and default.value is None, (
            f"{name}: document_ids must default to None (None = no filter, D-18)"
        )


def test_272_05_dedup_retired_case_proven_and_changed_on_purpose():
    """``_deduplicate_chunks`` was a pure move up to D27_PRE_DEDUP_SHA, and the live function's only
    signature change is the keyword-only ``same_document_only`` defaulting to ``False``."""
    base_fn = _top_level_function(_blob_at_base(_BASE_REL), "_deduplicate_chunks")
    home = MOVE_MAP["_deduplicate_chunks"]
    pre_fn = _top_level_function(_blob_at_base(home, D27_PRE_DEDUP_SHA), "_deduplicate_chunks")
    assert base_fn is not None and pre_fn is not None
    assert ast.dump(pre_fn) == ast.dump(base_fn), "the move was not pure before 272-05's D-27 change"

    live = _top_level_function(_module_source(home), "_deduplicate_chunks")
    assert live is not None
    assert ast.dump(live) != ast.dump(base_fn), "identical again — restore it to the AST pin"
    assert [a.arg for a in live.args.args] == [a.arg for a in base_fn.args.args]
    assert [a.arg for a in live.args.kwonlyargs] == ["same_document_only"]
    default = live.args.kw_defaults[0]
    assert isinstance(default, ast.Constant) and default.value is False, (
        "same_document_only must default to False — the unfiltered behaviour"
    )
    assert "_deduplicate_chunks" in RETIRED, _272_05_D27_REASON


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

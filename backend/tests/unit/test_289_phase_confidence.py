"""Phase 289 plan 02 (TRUST-01 / D-07..D-09, R-05) — chat's confidence on a KB phase output.

What is pinned here, and why each half matters:

  * **Parity with chat (D-07 / SC#5).** The level is computed by ``agent_loop._compute_confidence``
    itself, called with the run owner's settings, on the mean of the similarity scores the
    phase's own ``search_documents`` calls returned. The parity case calls the REAL function with
    custom buckets rather than comparing to a copied threshold: a copied number agrees with chat
    only until the next recalibration.
  * **Absence is absence (D-09).** A phase that never searched carries ``None`` and the UI draws
    nothing. A phase that searched and matched nothing carries level ``"none"``. A phase whose
    search ERRORED carries ``None``, because "nothing matched" would be a false statement about a
    search that failed.
  * **No model call can hide in the helper (T-289-11).** An AST fence over the module's top level.
  * **The label (R-05).** ``resolve_kb_label`` duck-types its first argument (only ``fetchval``),
    so plan 03 can hand it one RLS-enforced connection instead of the pool, and it never raises.

Fully offline: no DB, no pg pool, no network, no provider.
"""
from __future__ import annotations

import ast
import json
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_MODULE = (
    Path(__file__).resolve().parents[2] / "app" / "services" / "harness" / "phase_confidence.py"
)


def _cit(doc, chunk):
    return {"document_id": doc, "chunk_index": chunk, "filename": f"{doc}.pdf", "passage": "p"}


# ══ phase_confidence — the pure helper ══════════════════════════════════════════════════════


def test_no_scores_and_no_search_is_none():
    from app.services.harness.phase_confidence import phase_confidence

    assert phase_confidence([], searched=False, user_settings=None, citations=[]) is None
    assert phase_confidence(None, searched=False, user_settings=None, citations=None) is None


def test_searched_with_no_scores_is_level_none():
    from app.services.harness.phase_confidence import phase_confidence

    out = phase_confidence([], searched=True, user_settings=None, citations=[])
    assert out == {"level": "none", "avg_similarity": None, "disclaimer": None, "passages": 0}


def test_searched_but_errored_is_none_not_nothing_matched():
    """A failed search did not match nothing; it did not run. 'none' would be a false sentence."""
    from app.services.harness.phase_confidence import phase_confidence

    err = {"provider": "openai", "retrieval_status": "provider_error", "detail": "quota"}
    assert (
        phase_confidence([], searched=True, user_settings=None, citations=[], retrieval_error=err)
        is None
    )


def test_level_is_chats_own_function_with_the_owners_buckets():
    """Parity against the REAL ``_compute_confidence`` with custom buckets, never a copied number."""
    from app.services.agent_loop import CONFIDENCE_DISCLAIMER, _compute_confidence
    from app.services.harness.phase_confidence import phase_confidence

    # 0.55 is HIGH under the shipped 0.54 default and LOW under these buckets, so a helper that
    # dropped the settings argument goes red here rather than agreeing by coincidence.
    settings = SimpleNamespace(confidence_bucket_high=0.9, confidence_bucket_medium=0.7)
    out = phase_confidence(
        [0.61, 0.49], searched=True, user_settings=settings, citations=[_cit("d1", 0)]
    )
    expected = _compute_confidence(0.55, settings)
    assert expected == "low"  # fixture guard: the buckets really do move the level
    assert _compute_confidence(0.55) == "high"  # and the default would have said otherwise
    assert out["level"] == expected
    assert out["avg_similarity"] == 0.55
    assert out["disclaimer"] == CONFIDENCE_DISCLAIMER
    assert out["passages"] == 1


def test_disclaimer_only_on_low():
    from app.services.agent_loop import _compute_confidence
    from app.services.harness.phase_confidence import phase_confidence

    settings = SimpleNamespace(confidence_bucket_high=0.6, confidence_bucket_medium=0.4)
    out = phase_confidence([0.47], searched=True, user_settings=settings, citations=[])
    assert out["level"] == _compute_confidence(0.47, settings) == "medium"
    assert out["disclaimer"] is None
    assert out["avg_similarity"] == 0.47


def test_avg_is_rounded_to_four_places():
    from app.services.harness.phase_confidence import phase_confidence

    out = phase_confidence([0.123456, 0.654321], searched=True, user_settings=None, citations=[])
    assert out["avg_similarity"] == round((0.123456 + 0.654321) / 2, 4)


def test_scores_alone_count_as_searched():
    """Scores only come from search_documents, so a non-empty list IS a search."""
    from app.services.harness.phase_confidence import phase_confidence

    out = phase_confidence([0.7], searched=False, user_settings=None, citations=[])
    assert out is not None
    assert out["level"] == "high"


def test_passages_are_unique_document_chunk_pairs():
    from app.services.harness.phase_confidence import phase_confidence

    cits = [
        _cit("d1", 0),
        _cit("d1", 0),  # duplicate pair
        _cit("d1", 1),
        _cit("d2", 0),
        "not-a-dict",
        None,
        {"filename": "no-document-id.pdf"},
    ]
    out = phase_confidence([0.5], searched=True, user_settings=None, citations=cits)
    assert out["passages"] == 3


# ══ confidence_for_wire — the read-side coercion (T-289-07) ═════════════════════════════════


def test_wire_passes_a_valid_dict_plus_the_label():
    from app.services.harness.phase_confidence import confidence_for_wire

    raw = {"level": "medium", "avg_similarity": 0.47, "disclaimer": None, "passages": 6}
    assert confidence_for_wire(raw, "Procurement KB") == {
        "level": "medium",
        "avg_similarity": 0.47,
        "disclaimer": None,
        "passages": 6,
        "kb_label": "Procurement KB",
    }


def test_wire_none_level_survives():
    from app.services.harness.phase_confidence import confidence_for_wire

    raw = {"level": "none", "avg_similarity": None, "disclaimer": None, "passages": 0}
    out = confidence_for_wire(raw, "the knowledge base")
    assert out["level"] == "none"
    assert out["avg_similarity"] is None
    assert out["passages"] == 0


@pytest.mark.parametrize(
    "raw",
    [
        None,
        "high",
        json.dumps({"level": "high", "avg_similarity": 0.7, "disclaimer": None, "passages": 1}),
        {"level": "__proto__", "avg_similarity": 0.7, "disclaimer": None, "passages": 1},
        {"level": "toString"},
        {"avg_similarity": 0.7},
        ["high"],
        42,
    ],
)
def test_wire_rejects_malformed(raw):
    from app.services.harness.phase_confidence import confidence_for_wire

    assert confidence_for_wire(raw, "KB") is None


def test_wire_coerces_types():
    from app.services.harness.phase_confidence import confidence_for_wire

    out = confidence_for_wire(
        {"level": "low", "avg_similarity": "0.3", "disclaimer": 7, "passages": -4}, "KB"
    )
    assert out["avg_similarity"] is None
    assert out["disclaimer"] is None
    assert out["passages"] == 0

    out = confidence_for_wire(
        {"level": "high", "avg_similarity": True, "disclaimer": "x", "passages": "9"}, "KB"
    )
    assert out["avg_similarity"] is None  # a bool is not a score
    assert out["disclaimer"] == "x"
    assert out["passages"] == 0

    out = confidence_for_wire({"level": "high", "avg_similarity": 1, "passages": 3.0}, "KB")
    assert out["avg_similarity"] == 1.0
    assert out["passages"] == 3


# ══ resolve_kb_label — R-05 ═════════════════════════════════════════════════════════════════


class _OnlyFetchval:
    """Has ONLY ``fetchval`` — proves the helper duck-types (plan 03 passes one RLS connection)."""

    def __init__(self, value=None, exc=None):
        self.value = value
        self.exc = exc
        self.calls = []

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        if self.exc is not None:
            raise self.exc
        return self.value


_FOLDER = "5c0d1e2f-0000-4000-8000-000000289001"


@pytest.mark.asyncio
async def test_label_defaults_without_a_bound_folder():
    from app.services.harness.phase_confidence import KB_LABEL_DEFAULT, resolve_kb_label

    assert KB_LABEL_DEFAULT == "the knowledge base"
    conn = _OnlyFetchval("Should not be read")
    assert await resolve_kb_label(conn, None) == KB_LABEL_DEFAULT
    assert await resolve_kb_label(conn, {}) == KB_LABEL_DEFAULT
    assert await resolve_kb_label(conn, {"project_folder_id": None}) == KB_LABEL_DEFAULT
    assert await resolve_kb_label(conn, {"project_folder_id": "not-a-uuid"}) == KB_LABEL_DEFAULT
    assert conn.calls == []


@pytest.mark.asyncio
async def test_label_is_the_folder_name_from_a_fetchval_only_object():
    from app.services.harness.phase_confidence import resolve_kb_label

    conn = _OnlyFetchval("Procurement KB")
    assert await resolve_kb_label(conn, {"project_folder_id": _FOLDER}) == "Procurement KB"
    assert len(conn.calls) == 1
    sql, args = conn.calls[0]
    assert "folders" in sql and "name" in sql
    assert str(args[0]) == _FOLDER


@pytest.mark.asyncio
async def test_label_reads_an_object_definition_too():
    from app.services.harness.phase_confidence import resolve_kb_label

    conn = _OnlyFetchval("Legal")
    definition = SimpleNamespace(project_folder_id=uuid.UUID(_FOLDER))
    assert await resolve_kb_label(conn, definition) == "Legal"


@pytest.mark.asyncio
async def test_label_strips_control_and_format_chars_and_clamps():
    from app.services.harness.phase_confidence import resolve_kb_label

    conn = _OnlyFetchval("Pro\u0000cure‮men​t\n KB" + "x" * 200)
    label = await resolve_kb_label(conn, {"project_folder_id": _FOLDER})
    assert label.startswith("Procurement KB")
    assert len(label) <= 80
    assert all(ch.isprintable() for ch in label)


@pytest.mark.asyncio
async def test_label_defaults_when_no_row_or_hidden_or_blank():
    from app.services.harness.phase_confidence import KB_LABEL_DEFAULT, resolve_kb_label

    for value in (None, "", "   ", "​‮", 42):
        conn = _OnlyFetchval(value)
        assert await resolve_kb_label(conn, {"project_folder_id": _FOLDER}) == KB_LABEL_DEFAULT


@pytest.mark.asyncio
async def test_label_never_raises():
    from app.services.harness.phase_confidence import KB_LABEL_DEFAULT, resolve_kb_label

    conn = _OnlyFetchval(exc=RuntimeError("pool closed"))
    assert await resolve_kb_label(conn, {"project_folder_id": _FOLDER}) == KB_LABEL_DEFAULT
    assert await resolve_kb_label(None, {"project_folder_id": _FOLDER}) == KB_LABEL_DEFAULT


# ══ AST fence — no model call can hide in the helper (T-289-11) ═════════════════════════════

_FORBIDDEN_TOP_LEVEL = ("agent_loop", "openai", "anthropic", "google", "provider_gateway")


def _top_level_imports(source: str) -> list[str]:
    names: list[str] = []
    for node in ast.parse(source).body:
        if isinstance(node, ast.Import):
            names.extend(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            names.append(node.module or "")
            names.extend(f"{node.module}.{a.name}" for a in node.names)
    return names


def test_helper_has_no_module_level_provider_or_agent_loop_import():
    source = _MODULE.read_text(encoding="utf-8")
    hits = [
        n for n in _top_level_imports(source) if any(f in n.split(".") for f in _FORBIDDEN_TOP_LEVEL)
    ]
    assert hits == []


def test_the_import_fence_can_see_a_planted_one():
    source = _MODULE.read_text(encoding="utf-8")
    planted = "from app.services.agent_loop import _compute_confidence\n" + source
    hits = [
        n for n in _top_level_imports(planted) if any(f in n.split(".") for f in _FORBIDDEN_TOP_LEVEL)
    ]
    assert hits


# ══ run_task_sub_agent — the search counter ═════════════════════════════════════════════════


def _parent_ctx():
    from app.services.tool_dispatcher import ToolContext

    parent_ctx = MagicMock(spec=ToolContext)
    parent_ctx.redis = MagicMock()
    parent_ctx.run_id = "00000000-0000-0000-0000-000000000002"
    parent_ctx.current_user = {"id": "00000000-0000-0000-0000-000000000003"}
    parent_ctx.user_settings = MagicMock()
    parent_ctx.user_settings.embedding_provider = "openai"
    parent_ctx.user_settings.sub_agent_model = "gpt-4o"
    parent_ctx.model = "gpt-4o"
    parent_ctx.thread_id = "00000000-0000-0000-0000-000000000001"
    parent_ctx.pool = MagicMock()
    parent_ctx.supabase = MagicMock()
    parent_ctx.spawn = MagicMock()
    parent_ctx.emit = AsyncMock()
    parent_ctx.scoped_folder_path = None
    parent_ctx.folder_subtree_ids = None
    parent_ctx.dead_gap_tokens_in_run = set()
    parent_ctx.skill_instructions_override = None
    parent_ctx.phase_whitelist = None
    parent_ctx.workflow_run_id = None
    parent_ctx.skill_snapshot = None
    parent_ctx.per_run_task_semaphore = None
    parent_ctx.parent_run_id = None
    return parent_ctx


async def _drive_sub_agent(tool_names):
    from app.services.task_service import run_task_sub_agent
    from app.services.tool_dispatcher import ToolResult

    calls = [
        {"id": f"call_{i}", "name": name, "arguments": '{"query": "q"}'}
        for i, name in enumerate(tool_names)
    ]
    stream = [("thinking", calls), ("final answer", [])] if calls else [("final answer", [])]

    async def _fake_dispatch(name, args, ctx):
        if name == "search_documents":
            return ToolResult(result="ok", citations=[_cit("d1", 0)], similarity_score=0.5)
        return ToolResult(result="other")

    with patch("app.services.task_service._stream_one_iteration", AsyncMock(side_effect=stream)), \
         patch("app.services.task_service.dispatch_tool", _fake_dispatch), \
         patch("app.services.task_service.insert_run", AsyncMock()), \
         patch("app.services.task_service.finalize_run", AsyncMock()):
        return await run_task_sub_agent(
            parent_ctx=_parent_ctx(),
            description="Find revenue",
            instructions=None,
            allowed_tools=["search_documents", "execute_code"],
            max_steps=3,
        )


@pytest.mark.asyncio
async def test_sub_agent_counts_its_search_documents_calls():
    res = await _drive_sub_agent(["search_documents", "execute_code", "search_documents"])
    assert res["kb_search_calls"] == 2
    assert res["similarity_scores"] == [0.5, 0.5]


@pytest.mark.asyncio
async def test_sub_agent_with_no_search_counts_zero():
    res = await _drive_sub_agent(["execute_code"])
    assert res["kb_search_calls"] == 0
    res = await _drive_sub_agent([])
    assert res["kb_search_calls"] == 0


# ══ the two executors carry the key ═════════════════════════════════════════════════════════


def _spec(config: dict, *, slug="step"):
    from app.models.harness import PhaseSpec

    return PhaseSpec.model_validate({"slug": slug, "phase_index": 0, "config": config})


def _ctx(user_settings=None):
    return SimpleNamespace(
        run_id=uuid.uuid4(),
        producer_run_id=uuid.uuid4(),
        thread_id=str(uuid.uuid4()),
        current_user={"id": str(uuid.uuid4())},
        user_settings=user_settings,
        redis=None,
        pool=None,
        supabase=object(),
        emit=None,
        retry_feedback=None,
        inputs={},
        model="gpt-5.4-mini",
    )


def _sub(scores, citations, kb_calls, retrieval_error=None):
    return {
        "sub_run_id": uuid.uuid4(),
        "summary": "s",
        "status": "completed",
        "source_refs": [],
        "citations": citations,
        "similarity_scores": scores,
        "kb_search_calls": kb_calls,
        "retrieval_error": retrieval_error,
    }


async def _agent(sub, user_settings=None):
    from app.services.harness import phase_types

    async def _fake(**kwargs):
        return sub

    phase = _spec({"phase_type": "llm_agent", "prompt": "research",
                   "available_tools": ["search_documents"]})
    with patch.object(phase_types, "run_task_sub_agent", _fake):
        return await phase_types._exec_llm_agent(phase, {}, _ctx(user_settings))


@pytest.mark.asyncio
async def test_llm_agent_without_search_carries_none():
    out = await _agent(_sub([], [], 0))
    assert "confidence" in out
    assert out["confidence"] is None


@pytest.mark.asyncio
async def test_llm_agent_searched_nothing_carries_level_none():
    out = await _agent(_sub([], [], 1))
    assert out["confidence"]["level"] == "none"
    assert out["confidence"]["passages"] == 0


@pytest.mark.asyncio
async def test_llm_agent_uses_the_owners_buckets():
    from app.services.agent_loop import _compute_confidence

    settings = SimpleNamespace(confidence_bucket_high=0.9, confidence_bucket_medium=0.5)
    out = await _agent(_sub([0.61, 0.49], [_cit("d1", 0), _cit("d2", 3)], 2), settings)
    assert out["confidence"]["level"] == _compute_confidence(0.55, settings) == "medium"
    assert out["confidence"]["passages"] == 2


@pytest.mark.asyncio
async def test_llm_agent_errored_search_carries_none():
    err = {"provider": "openai", "retrieval_status": "provider_error", "detail": "quota"}
    out = await _agent(_sub([], [], 1, retrieval_error=err))
    assert out["confidence"] is None


@pytest.mark.asyncio
async def test_llm_batch_agents_carries_the_merged_confidence():
    from app.services.harness import phase_types

    subs = iter([
        _sub([0.7], [_cit("d1", 0)], 1),
        _sub([], [], 0),
    ])

    async def _fake(**kwargs):
        return next(subs)

    phase = _spec({"phase_type": "llm_batch_agents", "prompt": "fan out",
                   "available_tools": ["search_documents"]}, slug="batch")
    accumulated = {"split": {"sub_questions": ["q1", "q2"]}}
    with patch.object(phase_types, "run_task_sub_agent", _fake):
        out = await phase_types._exec_llm_batch_agents(phase, accumulated, _ctx())

    assert out["confidence"]["level"] == "high"
    assert out["confidence"]["avg_similarity"] == 0.7
    assert out["confidence"]["passages"] == 1


@pytest.mark.asyncio
async def test_llm_batch_agents_no_branch_searched_carries_none():
    from app.services.harness import phase_types

    async def _fake(**kwargs):
        return _sub([], [], 0)

    phase = _spec({"phase_type": "llm_batch_agents", "prompt": "fan out",
                   "available_tools": ["search_documents"]}, slug="batch")
    accumulated = {"split": {"sub_questions": ["q1", "q2"]}}
    with patch.object(phase_types, "run_task_sub_agent", _fake):
        out = await phase_types._exec_llm_batch_agents(phase, accumulated, _ctx())

    assert out["confidence"] is None


@pytest.mark.asyncio
async def test_llm_batch_agents_a_branch_searched_and_found_nothing_is_level_none():
    from app.services.harness import phase_types

    async def _fake(**kwargs):
        return _sub([], [], 2)

    phase = _spec({"phase_type": "llm_batch_agents", "prompt": "fan out",
                   "available_tools": ["search_documents"]}, slug="batch")
    accumulated = {"split": {"sub_questions": ["q1"]}}
    with patch.object(phase_types, "run_task_sub_agent", _fake):
        out = await phase_types._exec_llm_batch_agents(phase, accumulated, _ctx())

    assert out["confidence"]["level"] == "none"

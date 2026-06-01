"""Phase 093 / D-09a — split_topic kickoff_prompt alias + fan-out contract.

The Literature-review seed's ``split`` phase reads the run's question and splits
it into N sub-questions for the ``llm_batch_agents`` phase to fan out over. The
bug (092-07 F8 / verified live): live runs carry ``kickoff_prompt`` but
``split_topic`` only read the literal ``"topic"`` key, so the split degraded to
``[]`` and the batch phase collapsed to a single sub-agent.

D-09a fix = read BOTH keys (topic precedence preserved, backward compatible),
paired with the migration-065 seed ``input_keys`` edit so the executor actually
surfaces ``kickoff_prompt`` to the fn. This file is the code half's unit contract.

asyncio_mode = auto (backend/pytest.ini) — ``async def test_*`` runs directly.
"""
from __future__ import annotations

from app.services.harness.programmatic import split_topic


async def test_split_topic_reads_kickoff_prompt_when_no_topic():
    """A run carrying only ``kickoff_prompt`` (no ``topic``) still fans out N≥2.

    The live-run shape (092-07 F8): run_inputs has ``kickoff_prompt`` only. The
    clause-split must fire on it so the batch phase gets >1 sub-question.
    """
    out = await split_topic({"kickoff_prompt": "Compare X and Y vs Z"}, ctx=None)
    sub_questions = out["sub_questions"]
    assert len(sub_questions) >= 2, sub_questions
    # The clause-split heuristic separates on " and " / " vs " — three clauses here.
    assert "Compare X" in sub_questions
    assert "Y" in sub_questions
    assert "Z" in sub_questions


async def test_split_topic_topic_precedence_preserved():
    """The legacy ``topic`` key still works AND wins over kickoff_prompt (backward compatible)."""
    out = await split_topic({"topic": "A; B"}, ctx=None)
    assert out["sub_questions"] == ["A", "B"]

    # topic precedence: when BOTH are present, topic is read first (truthy wins).
    out2 = await split_topic(
        {"topic": "A; B", "kickoff_prompt": "ignored; also ignored"}, ctx=None
    )
    assert out2["sub_questions"] == ["A", "B"]


async def test_split_topic_empty_input_returns_empty_contract():
    """Neither key present -> the unchanged empty contract ``{"sub_questions": []}``."""
    out = await split_topic({}, ctx=None)
    assert out == {"sub_questions": []}

    # An explicitly-empty kickoff_prompt is also empty (whitespace strips to "").
    out2 = await split_topic({"kickoff_prompt": "   "}, ctx=None)
    assert out2 == {"sub_questions": []}

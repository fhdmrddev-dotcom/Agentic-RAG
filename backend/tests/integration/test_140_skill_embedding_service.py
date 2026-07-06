"""Phase 140 (TRIG-02 / Plan 02) — skill_embedding_service unit + mock tests.

This plan authors the DATA-POPULATION half of the smart-dispatch pre-filter:
  * `build_skill_embed_source` — the D-01 signal set (description + should_fire
    test-case prompts, name fallback, 4000-char cap) as a pure, DB-free function.
  * `skill_source_text_hash` — the deterministic staleness fingerprint.
  * `skill_reembed_job` — a `reembed_service`-shaped backfill: stale-only, owner
    hand-scoped, `run_in_threadpool` around embed AND every supabase read/write
    (Warning-1), non-destructive upsert, fail-open on error.
  * `kick_skill_backfill` — the fire-and-forget self-heal primitive Plan 04 fires
    from the over-budget branch (Blocker-1): returns immediately, strong-ref'd
    against GC, double-wrapped fail-open (swallows both a spawned-job failure and a
    spawn failure).

These are MOCK/unit tests — they need NO live DB. Migration 091 (the real
`skill_embeddings` table + `match_skills` RPC) is applied only in the [BLOCKING]
Plan 05, so the REAL vector round-trip is exercised there. Here the supabase-py
fluent surface is a recording mock and `embed_texts` is a deterministic stub.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from app.services import skill_embedding_service as svc
from app.services.skill_embedding_service import (
    build_skill_embed_source,
    skill_source_text_hash,
)


# ── Task 1: build_skill_embed_source (D-01 signal set) — pure fn ──────────────


def test_embed_source_builder():
    """The embed source concatenates BOTH the description and the should_fire
    test-case prompt (the D-01 signal set)."""
    skill = {"description": "condense a document", "name": "summarize"}
    source = build_skill_embed_source(skill, ["summarize this pdf"])
    assert "condense a document" in source
    assert "summarize this pdf" in source


def test_embed_source_name_fallback():
    """A skill with no description AND no test cases falls back to its name so a
    bare skill still produces a non-empty embed source."""
    skill = {"description": "", "name": "summarize"}
    source = build_skill_embed_source(skill, [])
    assert source == "summarize"

    # Whitespace-only prompts are dropped (still empty -> name fallback).
    assert build_skill_embed_source(skill, ["   ", ""]) == "summarize"


def test_embed_source_caps_at_4000():
    """A huge test-suite cannot dominate one embed — the source is capped at 4000
    chars so a pathological case set stays bounded."""
    skill = {"description": "d", "name": "n"}
    prompts = ["x" * 1000 for _ in range(50)]  # ~50k chars of prompt text
    source = build_skill_embed_source(skill, prompts)
    assert len(source) == 4000


def test_source_text_hash_deterministic():
    """The staleness fingerprint is a deterministic sha256 hexdigest; a changed
    description yields a different hash (so the trigger/staleness path detects it)."""
    a = build_skill_embed_source({"description": "alpha", "name": "s"}, ["p"])
    b = build_skill_embed_source({"description": "beta", "name": "s"}, ["p"])
    assert skill_source_text_hash(a) == skill_source_text_hash(a)  # deterministic
    assert len(skill_source_text_hash(a)) == 64  # sha256 hex length
    assert skill_source_text_hash(a) != skill_source_text_hash(b)  # sensitive to change

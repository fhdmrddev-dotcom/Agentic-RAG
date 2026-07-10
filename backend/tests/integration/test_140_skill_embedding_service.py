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
import logging
from types import SimpleNamespace

import pytest

from app.services import skill_embedding_service as svc
from app.services.skill_embedding_service import (
    build_skill_embed_source,
    skill_source_text_hash,
)


# ── mock supabase (recording fluent surface) + fixtures for the job/kick tests ─


def _new_log() -> dict:
    return {
        "selects": [],
        "eqs": [],
        "ins": [],
        "upserts": [],
        "updates": [],
        "deletes": [],
        "executes": [],
    }


class _MockQuery:
    """A recording stand-in for the supabase-py fluent query builder. Every filter/verb
    is logged so a test can assert the V4 hand-scope + non-destructive shape without a
    live DB. `.execute()` returns the preset read data for the skills table and an empty
    ok-response for the skill_embeddings write."""

    def __init__(self, table_name: str, log: dict, read_data: list[dict]):
        self.table_name = table_name
        self.log = log
        self.read_data = read_data

    def select(self, *a, **k):
        self.log["selects"].append((self.table_name, a))
        return self

    def eq(self, col, val):
        self.log["eqs"].append((self.table_name, col, val))
        return self

    def in_(self, col, vals):
        self.log["ins"].append((self.table_name, col, list(vals)))
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def upsert(self, payload, **k):
        self.log["upserts"].append(
            {"table": self.table_name, "payload": payload, "kwargs": k}
        )
        return self

    def update(self, payload, *a, **k):
        self.log["updates"].append({"table": self.table_name, "payload": payload})
        return self

    def delete(self, *a, **k):
        self.log["deletes"].append(self.table_name)
        return self

    def execute(self):
        self.log["executes"].append(self.table_name)
        if self.table_name == "skills":
            return SimpleNamespace(data=list(self.read_data))
        return SimpleNamespace(data=[])


class _MockSupabase:
    def __init__(self, skills_data: list[dict], log: dict):
        self.skills_data = skills_data
        self.log = log

    def table(self, name: str) -> _MockQuery:
        return _MockQuery(name, self.log, self.skills_data)


def _app_settings():
    return SimpleNamespace(
        embedding_model="text-embedding-3-small", embedding_dimensions=1536
    )


def _fake_embed(texts, model=None, user_settings=None):
    """Deterministic local embed stub — one small vector per text (no API key)."""
    return [[float(len(t)), 0.0, 1.0] for t in texts]


def _fresh_skill(sid: str, name: str, description: str, prompts: list[str]):
    """A skill whose stored vector row matches its current source (NOT stale)."""
    source = build_skill_embed_source(
        {"description": description, "name": name}, prompts
    )
    return {
        "id": sid,
        "name": name,
        "description": description,
        "skill_test_cases": [{"prompt": p} for p in prompts],
        "skill_embeddings": [
            {
                "source_text_hash": skill_source_text_hash(source),
                "embedding_model": "text-embedding-3-small",
            }
        ],
    }


def _stale_skill(sid: str, name: str, description: str, prompts: list[str], *, embedding=None):
    """A skill that needs (re)embedding — no vector row by default (absence == stale)."""
    return {
        "id": sid,
        "name": name,
        "description": description,
        "skill_test_cases": [{"prompt": p} for p in prompts],
        "skill_embeddings": embedding if embedding is not None else [],
    }


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


# ── Task 2: skill_reembed_job (staleness / hand-scope / non-destructive / IO) ──


@pytest.mark.asyncio
async def test_job_selects_only_stale(monkeypatch):
    """Absent-vector and model-mismatch skills are embedded; a skill with a matching
    hash + current model is SKIPPED (RESEARCH Pattern 2 staleness predicate)."""
    monkeypatch.setattr(svc, "embed_texts", _fake_embed)
    s_absent = _stale_skill("s1", "alpha", "alpha desc", ["do alpha"])
    s_fresh = _fresh_skill("s2", "beta", "beta desc", ["do beta"])
    # Matching hash but embedded under an OLD model → stale (D-10 cross-vector-space guard).
    src3 = build_skill_embed_source({"description": "g", "name": "gamma"}, ["do gamma"])
    s_model_mismatch = _stale_skill(
        "s3",
        "gamma",
        "g",
        ["do gamma"],
        embedding=[{"source_text_hash": skill_source_text_hash(src3), "embedding_model": "old-embedder"}],
    )
    log = _new_log()
    supa = _MockSupabase([s_absent, s_fresh, s_model_mismatch], log)

    res = await svc.skill_reembed_job(supa, "u1", _app_settings())

    assert res["stale"] == 2 and res["embedded"] == 2 and res["skipped"] == 1
    upserted_ids = {u["payload"]["skill_id"] for u in log["upserts"]}
    assert upserted_ids == {"s1", "s3"}  # s2 (fresh) was never re-embedded


@pytest.mark.asyncio
async def test_job_only_skill_ids_narrows(monkeypatch):
    """The self-heal kick passes NULL-sim ids; the read narrows to just those (.in_)."""
    monkeypatch.setattr(svc, "embed_texts", _fake_embed)
    log = _new_log()
    supa = _MockSupabase([_stale_skill("s1", "alpha", "d", ["p"])], log)

    await svc.skill_reembed_job(supa, "u1", _app_settings(), only_skill_ids=["s1"])

    assert ("skills", "id", ["s1"]) in log["ins"]


@pytest.mark.asyncio
async def test_job_hand_scopes_user_id(monkeypatch):
    """V4: every READ hand-scopes .eq(user_id) and every WRITE carries user_id in its
    payload — the service-role job bypasses RLS, so the app scope is the only gate."""
    monkeypatch.setattr(svc, "embed_texts", _fake_embed)
    log = _new_log()
    supa = _MockSupabase([_stale_skill("s1", "alpha", "d", ["p"])], log)

    await svc.skill_reembed_job(supa, "u1", _app_settings())

    # READ is owner-scoped.
    assert ("skills", "user_id", "u1") in log["eqs"]
    # Every WRITE is owner-scoped (user_id baked into the upserted row — V4).
    assert log["upserts"], "expected at least one upsert"
    assert all(u["payload"]["user_id"] == "u1" for u in log["upserts"])


@pytest.mark.asyncio
async def test_job_non_destructive_upsert(monkeypatch):
    """The job NEVER bulk-DELETEs valid vectors; it upserts one row per (skill_id,
    user_id), keyed on skill_id — an old vector is only ever overwritten by its
    replacement."""
    monkeypatch.setattr(svc, "embed_texts", _fake_embed)
    log = _new_log()
    supa = _MockSupabase([_stale_skill("s1", "alpha", "d", ["p"])], log)

    await svc.skill_reembed_job(supa, "u1", _app_settings())

    assert log["deletes"] == []  # non-destructive: no bulk delete of vectors
    assert log["upserts"], "expected an upsert write"
    for u in log["upserts"]:
        assert u["payload"]["skill_id"] == "s1"
        assert u["payload"]["user_id"] == "u1"
        assert u["kwargs"].get("on_conflict") == "skill_id"


@pytest.mark.asyncio
async def test_job_fail_open_on_embed_error(monkeypatch, caplog):
    """If embed_texts raises, the job logs a warning (exc_info) and returns an HONEST
    partial — it never crashes the caller (D-05 / Rule fail-open)."""

    def _boom_embed(texts, model=None, user_settings=None):
        raise RuntimeError("embedding provider unreachable")

    monkeypatch.setattr(svc, "embed_texts", _boom_embed)
    log = _new_log()
    supa = _MockSupabase([_stale_skill("s1", "alpha", "d", ["p"])], log)

    with caplog.at_level(logging.WARNING):
        res = await svc.skill_reembed_job(supa, "u1", _app_settings())

    assert res["status"] == "failed" and res["embedded"] == 0  # honest partial, no crash
    assert any(r.levelno == logging.WARNING for r in caplog.records)


@pytest.mark.asyncio
async def test_job_threadpool_wraps_io(monkeypatch):
    """Warning-1 / D-v2.5-01: every blocking call — embed_texts AND the supabase read AND
    each write — runs through run_in_threadpool, never directly on the event loop."""
    monkeypatch.setattr(svc, "embed_texts", _fake_embed)
    spy_calls: list = []

    async def _spy(func, *a, **k):
        spy_calls.append(func)
        return func(*a, **k)

    monkeypatch.setattr(svc, "run_in_threadpool", _spy)
    log = _new_log()
    supa = _MockSupabase([_stale_skill("s1", "alpha", "d", ["p"])], log)

    await svc.skill_reembed_job(supa, "u1", _app_settings())

    # read + embed + at least one write, ALL via the threadpool wrapper.
    assert len(spy_calls) >= 3
    # The DB read + write only ever run when routed through the spy (no direct .execute()).
    assert log["executes"], "expected supabase calls to have executed via the threadpool"


@pytest.mark.asyncio
async def test_kick_is_fire_and_forget(monkeypatch):
    """kick_skill_backfill returns IMMEDIATELY — the caller is not blocked on the embed/DB
    round-trip. The spawned job is still in flight (strong-ref'd against GC)."""
    started = asyncio.Event()
    completed = {"done": False}

    async def _slow_job(*a, **k):
        started.set()
        await asyncio.sleep(3600)  # never finishes within the test
        completed["done"] = True

    monkeypatch.setattr(svc, "skill_reembed_job", _slow_job)
    supa = _MockSupabase([], _new_log())

    ret = svc.kick_skill_backfill(supa, "u1", _app_settings(), only_skill_ids=["s1"])
    assert ret is None  # synchronous immediate return

    await asyncio.sleep(0)  # let the background task start
    assert started.is_set()  # it DID spawn
    assert completed["done"] is False  # but the caller did NOT wait for completion
    assert svc._BACKFILL_TASKS, "spawned task must be strong-ref'd against GC"

    # cleanup: cancel the long-running background task.
    tasks = list(svc._BACKFILL_TASKS)
    for t in tasks:
        t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


@pytest.mark.asyncio
async def test_kick_swallows_failure(monkeypatch, caplog):
    """Blocker-1 / D-05 double-wrap: kick swallows BOTH a spawned-job failure AND a spawn
    failure — neither ever propagates to the caller (the hot path is never crashed)."""
    supa = _MockSupabase([], _new_log())

    # (a) the spawned job raises → swallowed + logged, never surfaced.
    async def _boom_job(*a, **k):
        raise RuntimeError("job exploded")

    monkeypatch.setattr(svc, "skill_reembed_job", _boom_job)
    with caplog.at_level(logging.WARNING):
        ret = svc.kick_skill_backfill(supa, "u1", _app_settings())
        assert ret is None  # no raise to the caller
        await asyncio.gather(*list(svc._BACKFILL_TASKS), return_exceptions=True)
    assert any(r.levelno == logging.WARNING for r in caplog.records)

    # (b) the SPAWN itself fails (create_task raises) → also swallowed, never surfaced.
    def _boom_create_task(*a, **k):
        raise RuntimeError("cannot spawn")

    monkeypatch.setattr(asyncio, "create_task", _boom_create_task)
    ret = svc.kick_skill_backfill(supa, "u1", _app_settings())
    assert ret is None  # spawn failure swallowed, still no raise
    monkeypatch.undo()  # restore create_task immediately

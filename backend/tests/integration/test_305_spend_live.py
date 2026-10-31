"""Phase 305-03 (GUARD-02; D-29 / D-30 / D-31 / D-55; T-305-14 / T-305-30) — search usage in spend, live.

A real minted key, the real ``/mcp`` path in-process (``phase305_mcp_client``), the 304 two-org
world, and the REAL spend queries (``db/rates``) against the local Postgres. The query embedder is
the fixture's per-org stub; a variant of it also reports usage to ``usage_sink`` the way
``openai_service.embed_texts`` does, so the measured-token path is driven without a provider call.

* a search-only session (two searches) writes two ``mcp_usage`` rows — org, user, key, tool,
  model, provider and the stub's measured tokens;
* ``get_org_spend_summary``: root count and unrated count rise by two, the model breakdown carries
  the embedding model as unrated, Spend by Expert's "No Expert" line includes them, and the lines
  reconcile with the window totals;
* ``get_spend_runs``: both rows read ``source: mcp`` with the key label and
  ``mcp_tool: search_knowledge_base``, Unrated, never coverage-complete;
* a search whose sink stayed empty writes ONE row with ``input_tokens`` NULL (unmeasured, never 0).

Run with ``-rs``: a skip is NOT RUN, never a pass. Holds the local-DB lock.
⛔ No role-``anon`` statement (BUG-261031-01).
"""
from __future__ import annotations

from uuid import UUID

import pytest

from app.db.rates import get_org_spend_summary, get_spend_runs
from app.mcp import read_tools
from app.services import usage_sink
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import (  # noqa: F401 — `world` is a fixture
    patch_search,
    search_settings,
    world,
)
from tests.integration.phase305_mcp_client import mcp_session

pytestmark = requires_pg

TOKENS_PER_TEXT = 5
EMBED_MODEL = "text-embedding-3-small"


def _measured_search(monkeypatch, w) -> None:
    """``patch_search`` plus the usage report ``embed_texts`` makes after each provider call."""
    import app.services.retrieval_rpc as rpc

    patch_search(monkeypatch, w)
    inner = rpc.embed_texts

    def _embed(texts, *args, **kwargs):
        usage_sink.record(EMBED_MODEL, TOKENS_PER_TEXT * len(texts), provider="openai")
        return inner(texts, *args, **kwargs)

    monkeypatch.setattr(rpc, "embed_texts", _embed)


async def _key_id(pool, user_id: str) -> str:
    return str(await pool.fetchval(
        "SELECT id FROM public.api_keys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        UUID(user_id),
    ))


async def _usage(pool, key_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT id, org_id, user_id, api_key_id, tool, model, provider, input_tokens, output_tokens,"
        " status FROM public.mcp_usage WHERE api_key_id = $1::uuid ORDER BY started_at",
        key_id,
    )
    return [dict(r) for r in rows]


def _none_line(summary):
    return next((line for line in summary.expert_breakdown if line.get("key") == "none"
                 or line.get("line_key") == "none"), None)


async def test_a_search_only_session_lands_in_operator_spend(world, monkeypatch):
    w = world
    _measured_search(monkeypatch, w)
    monkeypatch.setattr(read_tools, "load_user_settings", lambda _uid: search_settings())
    org = UUID(w.x)
    rated = await w.pool.fetchval("SELECT count(*) FROM public.model_rates WHERE model_id = $1", EMBED_MODEL)
    before = await get_org_spend_summary(w.pool, org)

    secret = await w.mint(label="305-03 spend laptop")
    key_id = await _key_id(w.pool, w.u)
    async with mcp_session(monkeypatch, secret) as call:
        for _ in range(2):
            reply = await call.tool("search_knowledge_base", {"query": w.tok_x})
            assert not reply.is_error, reply.text

    usage = await _usage(w.pool, key_id)
    assert len(usage) == 2, usage
    for row in usage:
        assert str(row["org_id"]) == w.x and str(row["user_id"]) == w.u
        assert (row["tool"], row["model"], row["provider"], row["status"]) == (
            "search_knowledge_base", EMBED_MODEL, "openai", "completed")
        assert row["input_tokens"] == TOKENS_PER_TEXT and row["output_tokens"] == 0

    after = await get_org_spend_summary(w.pool, org)
    roots = lambda s: s.rated_runs_count + s.unrated_runs_count  # noqa: E731
    assert roots(after) - roots(before) == 2
    assert after.window_run_count - before.window_run_count == 2
    assert after.total_input_tokens - before.total_input_tokens == 2 * TOKENS_PER_TEXT
    if rated == 0:
        assert after.unrated_runs_count - before.unrated_runs_count == 2
        model = next(m for m in after.model_breakdown if m["model_name"] == EMBED_MODEL)
        assert model["is_rated"] is False and model["spend_usd"] is None   # Unrated, never $0.00
    none_after, none_before = _none_line(after), _none_line(before)
    assert none_after is not None
    assert none_after["run_count"] - (none_before["run_count"] if none_before else 0) == 2
    assert sum(line["run_count"] for line in after.expert_breakdown) == after.window_run_count

    items, total = await get_spend_runs(w.pool, org, limit=200, time_range="today")
    mine = [i for i in items if i["run_id"] in {str(r["id"]) for r in usage}]
    assert len(mine) == 2, items
    for item in mine:
        assert item["source"] == "mcp"
        assert item["api_key_id"] == key_id
        assert item["api_key_label"] == "305-03 spend laptop"
        assert item["mcp_tool"] == "search_knowledge_base"
        assert item["is_coverage_complete"] is False
        assert item["expert_attributed"] is True and item["expert_id"] is None
        if rated == 0:
            assert item["is_rated"] is False and item["cost_usd"] is None
    assert total >= 2


async def test_a_search_whose_sink_stayed_empty_writes_one_unmeasured_row(world, monkeypatch):
    w = world
    patch_search(monkeypatch, w)  # the plain stub reports no usage
    monkeypatch.setattr(read_tools, "load_user_settings", lambda _uid: search_settings())
    secret = await w.mint(label="305-03 unmeasured laptop")
    key_id = await _key_id(w.pool, w.u)
    async with mcp_session(monkeypatch, secret) as call:
        reply = await call.tool("search_knowledge_base", {"query": w.tok_x})
    assert not reply.is_error, reply.text

    (row,) = await _usage(w.pool, key_id)
    assert row["input_tokens"] is None, "unmeasured is NULL, never 0"
    assert row["model"] and row["provider"]
    items, _ = await get_spend_runs(w.pool, UUID(w.x), limit=200, time_range="today")
    (item,) = [i for i in items if i["run_id"] == str(row["id"])]
    assert item["input_tokens"] is None
    assert item["is_coverage_complete"] is False

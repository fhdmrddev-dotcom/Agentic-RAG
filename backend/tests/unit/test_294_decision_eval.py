"""Phase 294 Plan 02 (D-18 / D-19) — the decision-engine measurement harness tells the truth.

Fakes only: no database, no network, no engine. Each case pins one honesty property:

* the frozen held-out set is refused when its bytes no longer hash to the sidecar, when it is too
  small, or when a chunk item cannot be identified exactly;
* ``measure_arm`` scores a probe by document and a chunk item by the exact chunk, counts chunks
  and o200k_base tokens, and refuses an arm that fell back or has no key;
* ``compare_arms`` applies the D-19 gates (recall within 2 points, chunks down, cost per search),
  names every flip, and never calls a cost increase, an unpriced engine or an unrated main model
  a saving;
* the CLI refuses with exit 2 and writes nothing, or writes the report with unmeasured arms named.
"""

from __future__ import annotations

import asyncio
import hashlib
import importlib.util
import json
import re
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import BaseModel, ConfigDict

from app.services.pricing_service import ModelRate
from app.services.recall_eval import RecallUnmeasurable
from app.services.rerank_engines.tracing import EngineCall, record_engine_call
from tests.unit.decision_engine_fakes import PLANTED_OAI, PLANTED_OR, provider

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = _BACKEND_ROOT.parent
_DECISION_EVAL = _BACKEND_ROOT / "app" / "services" / "decision_eval.py"
_CLI = _REPO_ROOT / "scripts" / "measure-decision-engines.py"


# ─────────────────────────────────────────────────────────────────────────────
# Fakes
# ─────────────────────────────────────────────────────────────────────────────

class FakeSettings(BaseModel):
    """The handful of settings fields the harness reads, with a real ``model_copy``."""

    model_config = ConfigDict(arbitrary_types_allowed=True, extra="allow")

    rerank_enabled: bool = False
    rerank_provider: str = "cohere"
    rerank_model: str = "rerank-v3.5"
    rerank_top_n: int = 5
    retrieval_top_k: int = 5
    hybrid_search_enabled: bool = True
    hybrid_candidate_count: int = 20
    rerank_api_key: str | None = None
    llm_model: str = "main-model"
    embedding_model: str = "text-embedding-3-small"
    providers: list[Any] = []


def _settings(**kw) -> FakeSettings:
    base = {"providers": [provider("openrouter", PLANTED_OR), provider("openai", PLANTED_OAI)]}
    base.update(kw)
    return FakeSettings(**base)


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _row(document_id: str, chunk_index: int, content: str) -> dict:
    return {"document_id": document_id, "chunk_index": chunk_index, "content": content}


def _chunk_item(item_id: str, document_id: str, chunk_index: int, content: str) -> dict:
    return {
        "id": item_id,
        "kind": "chunk",
        "query": f"question {item_id}",
        "target": {"document_id": document_id, "chunk_index": chunk_index, "chunk_sha256": _sha(content)},
    }


def _probe_item(item_id: str, document_id: str) -> dict:
    return {"id": item_id, "kind": "probe", "query": f"probe {item_id}", "target": {"document_id": document_id}}


def _fake_search(results: dict[str, list[dict]], calls: dict[str, list[EngineCall]] | None = None, seen=None):
    async def search(query, user_id, supabase, metadata_filter=None, user_settings=None, **_kw):
        if seen is not None:
            seen.append({"query": query, "settings": user_settings})
        for call in (calls or {}).get(query, []):
            record_engine_call(call)
        return list(results.get(query, [])), 0.5

    return search


def _ok_call(engine="jev", cost="0.00001", latency=40.0) -> EngineCall:
    return EngineCall(engine=engine, model="m", purpose="rerank", latency_ms=latency, ok=True,
                      cost_usd=None if cost is None else Decimal(cost))


def _measure(arm, items, settings, search, **kw):
    from app.services.decision_eval import measure_arm

    return asyncio.run(
        measure_arm(arm, items, settings, pool=20, top_k=5, user_id="u1", vectors=None, search=search, **kw)
    )


# ─────────────────────────────────────────────────────────────────────────────
# load_heldout — the freeze is checked, not trusted
# ─────────────────────────────────────────────────────────────────────────────

def _write_fixture(tmp_path: Path, items: list[dict], *, sha: str | None = None) -> tuple[Path, Path]:
    data = (json.dumps({"version": 1, "items": items}, indent=2, sort_keys=True) + "\n").encode("utf-8")
    path = tmp_path / "heldout.json"
    path.write_bytes(data)
    sidecar = tmp_path / "heldout.sha256"
    sidecar.write_text(f"{sha or hashlib.sha256(data).hexdigest()}  heldout.json\n", encoding="ascii")
    return path, sidecar


def _fifty_items() -> list[dict]:
    items = [_chunk_item(f"c{i:02d}", f"d{i}", 0, f"content {i}") for i in range(45)]
    items += [_probe_item(f"p{i:02d}", f"pd{i}") for i in range(5)]
    return items


def test_load_heldout_accepts_a_matching_fixture(tmp_path):
    from app.services.decision_eval import load_heldout

    path, sidecar = _write_fixture(tmp_path, _fifty_items())
    payload = load_heldout(path, sidecar)
    assert len(payload["items"]) == 50
    assert payload["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()


def test_load_heldout_refuses_a_sha_mismatch(tmp_path):
    from app.services.decision_eval import load_heldout

    path, sidecar = _write_fixture(tmp_path, _fifty_items(), sha="0" * 64)
    with pytest.raises(RecallUnmeasurable, match="sha256"):
        load_heldout(path, sidecar)


def test_load_heldout_refuses_a_one_byte_edit(tmp_path):
    from app.services.decision_eval import load_heldout

    path, sidecar = _write_fixture(tmp_path, _fifty_items())
    data = bytearray(path.read_bytes())
    data[-2:-1] = b" "
    path.write_bytes(bytes(data))
    with pytest.raises(RecallUnmeasurable):
        load_heldout(path, sidecar)


def test_load_heldout_refuses_fewer_than_fifty_items(tmp_path):
    from app.services.decision_eval import load_heldout

    path, sidecar = _write_fixture(tmp_path, _fifty_items()[:49])
    with pytest.raises(RecallUnmeasurable, match="50"):
        load_heldout(path, sidecar)


def test_load_heldout_refuses_a_chunk_item_without_its_hash(tmp_path):
    from app.services.decision_eval import load_heldout

    items = _fifty_items()
    del items[3]["target"]["chunk_sha256"]
    path, sidecar = _write_fixture(tmp_path, items)
    with pytest.raises(RecallUnmeasurable, match="chunk_sha256"):
        load_heldout(path, sidecar)


# ─────────────────────────────────────────────────────────────────────────────
# measure_arm — found, chunks, tokens, and the two refusals
# ─────────────────────────────────────────────────────────────────────────────

def test_measure_arm_scores_probes_by_document_and_chunks_by_the_exact_chunk():
    import tiktoken

    target_text = "the exact target passage"
    items = [
        _probe_item("p01", "docA"),
        _chunk_item("c01", "docB", 3, target_text),
        _chunk_item("c02", "docC", 1, "the passage that is not returned"),
    ]
    results = {
        "probe p01": [_row("docX", 0, "noise one"), _row("docA", 7, "any chunk of docA")],
        "question c01": [_row("docB", 3, target_text), _row("docB", 4, "neighbour")],
        # same document and index, different bytes: (document_id, chunk_index) is not unique here
        "question c02": [_row("docC", 1, "a different chunk at the same index")],
    }
    report = _measure("off", items, _settings(), _fake_search(results))
    by_id = {s["id"]: s for s in report["searches"]}
    assert by_id["p01"]["found"] is True
    assert by_id["c01"]["found"] is True
    assert by_id["c02"]["found"] is False
    assert by_id["p01"]["chunks"] == 2
    enc = tiktoken.get_encoding("o200k_base")
    assert by_id["c01"]["tokens"] == len(enc.encode(target_text)) + len(enc.encode("neighbour"))
    assert report["status"] == "measured"
    assert report["recall"] == pytest.approx(2 / 3)


def test_measure_arm_applies_the_arm_settings_by_copy_only():
    seen: list = []
    base = _settings()
    items = [_probe_item("p01", "docA")]
    _measure("jev", items, base, _fake_search({"probe p01": [_row("docA", 0, "x")]},
                                               {"probe p01": [_ok_call()]}, seen))
    applied = seen[0]["settings"]
    assert applied.rerank_enabled is True
    assert applied.rerank_provider == "jev"
    assert applied.rerank_top_n == 20
    assert applied.retrieval_top_k == 5
    assert applied.hybrid_search_enabled is True
    assert applied.rerank_model == "typesafe/jev-1.14"
    # the operator's settings object is untouched
    assert base.rerank_enabled is False and base.rerank_provider == "cohere"


def test_measure_arm_refuses_an_arm_that_fell_back():
    from app.services.decision_eval import ArmUnmeasured

    items = [_probe_item("p01", "docA"), _probe_item("p02", "docA")]
    results = {"probe p01": [_row("docA", 0, "x")], "probe p02": [_row("docA", 0, "y")]}
    calls = {
        "probe p01": [_ok_call()],
        "probe p02": [EngineCall(engine="jev", model="m", purpose="rerank", latency_ms=5.0, ok=False,
                                 reason="HTTPStatusError:403")],
    }
    with pytest.raises(ArmUnmeasured) as caught:
        _measure("jev", items, _settings(), _fake_search(results, calls))
    assert caught.value.reason.startswith("engine fell back on 1 of 2 searches")
    assert "HTTPStatusError:403" in caught.value.reason


def test_measure_arm_refuses_a_hosted_arm_with_no_key_before_any_search():
    from app.services.decision_eval import ArmUnmeasured

    seen: list = []
    with pytest.raises(ArmUnmeasured) as caught:
        _measure("jev", [_probe_item("p01", "d")], _settings(providers=[]), _fake_search({}, None, seen))
    assert caught.value.reason == "key_missing"
    assert seen == []


def test_measure_arm_refuses_an_engine_that_was_never_called():
    # A path that never reaches the engine (e.g. vector-only) would silently measure rerank-off.
    from app.services.decision_eval import ArmUnmeasured

    items = [_probe_item("p01", "docA")]
    with pytest.raises(ArmUnmeasured, match="never called"):
        _measure("jev", items, _settings(), _fake_search({"probe p01": [_row("docA", 0, "x")]}))


# ─────────────────────────────────────────────────────────────────────────────
# compare_arms — the D-19 gates
# ─────────────────────────────────────────────────────────────────────────────

def _arm_report(arm: str, found: list[bool], *, chunks=5, tokens=100, cost="0.00001", latency=40.0) -> dict:
    searches = []
    for i, hit in enumerate(found):
        searches.append({
            "id": f"q{i:03d}", "query": f"query {i}", "found": hit,
            "chunks": chunks if not callable(chunks) else chunks(i),
            "tokens": tokens if not callable(tokens) else tokens(i),
            "engine_cost_usd": None if cost is None else (None if arm == "off" else str(Decimal(cost))),
            "engine_latency_ms": 0.0 if arm == "off" else latency,
            "search_ms": 10.0,
        })
    return {"arm": arm, "status": "measured", "searches": searches}


_RATE = ModelRate(model_id="main-model", input_cost_per_million=Decimal("0.30"),
                  output_cost_per_million=Decimal("1.20"), effective_from=None)


def _compare(off, arm, rate=_RATE):
    from app.services.decision_eval import compare_arms

    return compare_arms(off, arm, main_rate=rate)


def _found(n_total: int, n_found: int) -> list[bool]:
    return [i < n_found for i in range(n_total)]


def test_recall_gate_passes_within_two_points():
    result = _compare(_arm_report("off", _found(100, 80)), _arm_report("jev", _found(100, 79), chunks=3))
    assert result["recall_gate"] == "pass"
    assert result["recall_delta_pp"] == pytest.approx(-1.0)


def test_recall_gate_fails_beyond_two_points():
    result = _compare(_arm_report("off", _found(100, 80)), _arm_report("jev", _found(100, 77), chunks=3))
    assert result["recall_gate"] == "fail"


def test_every_flip_from_found_to_absent_is_named():
    off = _arm_report("off", _found(10, 8))
    arm_found = _found(10, 8)
    arm_found[2] = False
    arm_found[5] = False
    arm_found[9] = True  # a gain is not a flip
    result = _compare(off, _arm_report("jev", arm_found, chunks=3))
    assert [flip["id"] for flip in result["flips"]] == ["q002", "q005"]
    assert result["flips"][0]["query"] == "query 2"


def test_chunks_gate_passes_only_when_the_arm_sends_fewer():
    off = _arm_report("off", _found(10, 8), chunks=5)
    assert _compare(off, _arm_report("jev", _found(10, 8), chunks=3))["chunks_gate"] == "pass"
    assert _compare(off, _arm_report("jev", _found(10, 8), chunks=5))["chunks_gate"] == "fail"


def test_cost_gate_saving_is_per_search_and_priced_through_pricing_service():
    # 1,000 tokens saved per search at $0.30/M = $0.0003; engine $0.00001 → net $0.00029
    off = _arm_report("off", _found(10, 8), tokens=3000)
    arm = _arm_report("jev", _found(10, 8), chunks=3, tokens=2000, cost="0.00001")
    result = _compare(off, arm)
    assert result["cost_gate"] == "pass"
    assert Decimal(result["net_usd_per_search"]) == Decimal("0.00029")
    assert result["cost_sentence"].startswith("saves $")
    assert "per search" in result["cost_sentence"]


def test_cost_gate_reports_an_increase_and_its_break_even_resends():
    # 10 tokens saved at $0.30/M = $0.000003; engine $0.00001 → costs $0.000007 more; K = ceil(10/3) = 4
    off = _arm_report("off", _found(10, 8), tokens=110)
    arm = _arm_report("jev", _found(10, 8), chunks=3, tokens=100, cost="0.00001")
    result = _compare(off, arm)
    assert result["cost_gate"] == "fail"
    assert "costs $" in result["cost_sentence"]
    assert "more than it saves per search" in result["cost_sentence"]
    assert result["break_even_resends"] == 4
    assert "saves $" not in result["cost_sentence"]


def test_cost_gate_break_even_is_never_when_nothing_is_saved():
    off = _arm_report("off", _found(10, 8), tokens=100)
    arm = _arm_report("jev", _found(10, 8), chunks=3, tokens=100, cost="0.00001")
    result = _compare(off, arm)
    assert result["cost_gate"] == "fail"
    assert result["break_even_resends"] == "never"


def test_cost_gate_is_unpriced_when_any_engine_cost_is_unknown():
    off = _arm_report("off", _found(10, 8), tokens=3000)
    arm = _arm_report("jev", _found(10, 8), chunks=3, tokens=1000, cost=None)
    result = _compare(off, arm)
    assert result["cost_gate"] == "unpriced"
    assert "saves" not in result["cost_sentence"]


def test_cost_gate_is_unrated_without_a_main_model_rate():
    off = _arm_report("off", _found(10, 8), tokens=3000)
    arm = _arm_report("jev", _found(10, 8), chunks=3, tokens=1000)
    result = _compare(off, arm, rate=None)
    assert result["cost_gate"] == "unrated"
    assert "saves" not in result["cost_sentence"]


@pytest.mark.parametrize("arm_name", ["local", "cohere"])
def test_reorder_only_arms_report_chunks_and_cost_as_not_applicable(arm_name):
    off = _arm_report("off", _found(10, 8), tokens=3000)
    arm = _arm_report(arm_name, _found(10, 8), tokens=3000, cost="0")
    result = _compare(off, arm)
    assert result["chunks_gate"] == "N/A (reorders only, D-08)"
    assert result["cost_gate"] == "N/A (reorders only, D-08)"
    assert result["recall_gate"] == "pass"


def test_latency_percentiles_are_reported_per_arm():
    off = _arm_report("off", _found(20, 10))
    arm = _arm_report("jev", _found(20, 10), chunks=3)
    for i, search in enumerate(arm["searches"]):
        search["engine_latency_ms"] = float(i + 1)  # 1..20
    result = _compare(off, arm)
    assert result["latency_ms"]["p50"] == pytest.approx(10.0)
    assert result["latency_ms"]["p95"] == pytest.approx(19.0)


# ─────────────────────────────────────────────────────────────────────────────
# The CLI — refusal is exit 2 and nothing written
# ─────────────────────────────────────────────────────────────────────────────

def _load_cli():
    spec = importlib.util.spec_from_file_location("measure_decision_engines", _CLI)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_cli_refusal_exits_two_and_writes_nothing(tmp_path, monkeypatch, capsys):
    cli = _load_cli()

    async def refuse(**_kw):
        raise RecallUnmeasurable("could not measure: held-out sha256 differs")

    monkeypatch.setattr(cli, "run_decision_measurement", refuse)
    out = tmp_path / "report.json"
    code = cli.main(["--heldout", str(tmp_path / "h.json"), "--json-out", str(out)])
    assert code == 2
    assert not out.exists()
    assert "REFUSED" in capsys.readouterr().err


def test_cli_success_writes_the_report_with_unmeasured_arms_named(tmp_path, monkeypatch, capsys):
    cli = _load_cli()

    async def measured(**_kw):
        return {
            "heldout": {"sha256": "ab" * 32, "items": 50},
            "pool": 20, "top_k": 5, "main_model": "main-model",
            "arms": {
                "off": {"status": "measured", "recall": 0.8, "mean_chunks": 5.0},
                "jev": {"status": "unmeasured", "reason": "key_missing"},
            },
            "comparisons": {},
            "elapsed_seconds": 1.0,
        }

    monkeypatch.setattr(cli, "run_decision_measurement", measured)
    out = tmp_path / "report.json"
    code = cli.main(["--heldout", str(tmp_path / "h.json"), "--json-out", str(out), "--label", "t"])
    assert code == 0
    report = json.loads(out.read_text(encoding="utf-8"))
    assert report["arms"]["jev"] == {"status": "unmeasured", "reason": "key_missing"}
    assert report["label"] == "t"
    assert "UNMEASURED" in capsys.readouterr().out


# ─────────────────────────────────────────────────────────────────────────────
# Source fences
# ─────────────────────────────────────────────────────────────────────────────

def test_harness_imports_from_recall_eval_and_never_writes_settings():
    source = _DECISION_EVAL.read_text(encoding="utf-8")
    assert "from app.services.recall_eval import" in source
    assert "save_app_settings" not in source
    assert not re.search(r"\b(INSERT|UPDATE|DELETE)\b", source)
    assert "more than it saves per search" in source
    assert "search_documents(" in source
    assert "capture_engine_calls" in source

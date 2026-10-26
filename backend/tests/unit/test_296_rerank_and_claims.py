"""Phase 296-03 (W3a) — rerank traces stay clean, slow local inference cannot stall a search, and
citation-check claims read cleanly with the chat's own ordinals.

* 294-IN-01 — the ``rerank.local`` span records no CrossEncoder object (base recorded its repr,
  the whole model architecture, on every local search).
* 294-IN-02 — ``span_outputs`` omits a token count it does not know; it never reports 0.
* 294-LOCAL — ``LOCAL_INFERENCE_TIMEOUT_S = 30``: a local inference past it keeps today's order.
  The Settings copy (296-04's ``latencyNote``) says ``past 30 seconds``, pinned equal here.
* 294-IN-07 — a claim sentence never keeps a space before punctuation.
* 294-CR-02 residual — claim ordinals equal the chat's for HTML blocks and setext headings,
  MEASURED against marked into ``tests/fixtures/phase296/claim_ordinals_marked.json``.

Each RED at base 7f2636c4b.
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

from tests.unit.decision_engine_fakes import FakeLangSmithClient, tracing_into

REPO = Path(__file__).resolve().parents[3]
RERANK_ENGINES_TS = REPO / "frontend" / "src" / "components" / "settings" / "rerankEngines.ts"
ORDINALS = Path(__file__).resolve().parents[1] / "fixtures" / "phase296" / "claim_ordinals_marked.json"

ARCH_REPR = "FakeCrossEncoder(arch=XLMRobertaForSequenceClassification(layers=24))"


class _FakeModel:
    def __init__(self, delay: float = 0.0) -> None:
        self.delay = delay

    def __repr__(self) -> str:
        return ARCH_REPR

    def predict(self, pairs):
        if self.delay:
            time.sleep(self.delay)
        return [float(i) for i, _ in enumerate(pairs)]


def _docs(n: int = 4) -> list[dict]:
    return [{"id": f"c{i}", "document_id": f"d{i}", "content": f"passage {i}", "chunk_index": i}
            for i in range(n)]


@pytest.fixture
def local(monkeypatch):
    import app.services.rerank_engines.local as local_mod

    monkeypatch.setattr(local_mod, "_local", None)
    monkeypatch.setattr(local_mod, "_loader", None)
    monkeypatch.setattr(local_mod, "_failed_at", {})
    return local_mod


# ── 294-IN-01 ─────────────────────────────────────────────────────────────────


def test_the_local_span_never_records_the_model_object(local, monkeypatch):
    monkeypatch.setattr(local, "_local", ("m/a", _FakeModel()))
    with tracing_into(FakeLangSmithClient()) as client:
        rows = local.rerank("q", _docs(), 2, model="m/a")
    assert [r["id"] for r in rows] == ["c3", "c2"]  # the fake scores later passages higher
    assert "rerank.local" in client.names()  # non-vacuity: the span was recorded
    assert ARCH_REPR not in client.text()
    assert "XLMRoberta" not in client.text()


# ── 294-IN-02 ─────────────────────────────────────────────────────────────────


def test_unknown_token_counts_are_omitted_not_zero():
    from app.services.rerank_engines.tracing import span_outputs

    usage = span_outputs(latency_ms=5).get("usage_metadata", {})
    assert not {"input_tokens", "output_tokens", "total_tokens"} & set(usage)

    one = span_outputs(latency_ms=5, input_tokens=7)["usage_metadata"]
    assert one["input_tokens"] == 7
    assert "output_tokens" not in one and "total_tokens" not in one

    both = span_outputs(latency_ms=5, input_tokens=7, output_tokens=0)["usage_metadata"]
    assert both == {"input_tokens": 7, "output_tokens": 0, "total_tokens": 7}


# ── 294-LOCAL ─────────────────────────────────────────────────────────────────


def test_the_local_inference_timeout_is_30_seconds_on_the_engine_row():
    from app.services.rerank_engines import registry

    assert registry.LOCAL_INFERENCE_TIMEOUT_S == 30.0
    assert registry.ENGINES["local"].timeout_s == registry.LOCAL_INFERENCE_TIMEOUT_S
    assert registry.ENGINES["local"].connect_timeout_s == 0.0


def test_a_slow_local_inference_keeps_todays_order_and_never_raises(local, monkeypatch, caplog):
    from app.services.rerank_engines import registry
    from app.services.rerank_service import rerank

    monkeypatch.setattr(registry, "LOCAL_INFERENCE_TIMEOUT_S", 0.05)
    monkeypatch.setattr(local, "_local", ("m/a", _FakeModel(delay=0.6)))
    us = SimpleNamespace(rerank_enabled=True, rerank_provider="local", rerank_model="m/a",
                         rerank_top_n=2, providers=[])
    docs = _docs()
    started = time.perf_counter()
    with caplog.at_level(logging.WARNING):
        out = rerank("q", docs, 2, us)
    assert out == docs[:2]  # today's order: the rerank-off output
    assert time.perf_counter() - started < 0.5  # it did not wait for the inference
    assert any("local" in r.getMessage() for r in caplog.records if r.levelno >= logging.WARNING)
    # let the abandoned inference finish before the next test patches the module
    for t in threading.enumerate():
        if t.name.startswith("local-rerank-infer"):
            t.join(2)


def _latency_seconds(ts_source: str) -> int:
    """The number in the local row's ``latencyNote`` (``… past N seconds …``)."""
    row = re.search(r'id:\s*"local"(.*?)\n  \}', ts_source, re.DOTALL)
    assert row, "local row not found in rerankEngines.ts"
    note = re.search(r"latencyNote:\s*\"([^\"]*)\"", row.group(1))
    assert note, "local row has no latencyNote"
    m = re.search(r"past (\d+) seconds", note.group(1))
    assert m, note.group(1)
    return int(m.group(1))


def test_the_settings_copy_states_the_same_timeout_as_the_engine():
    """Parity pin: 296-04 wrote the copy, this plan wrote the constant. Changing either alone
    reds here (driven RED once with the copy at 31, recorded in 296-03-SUMMARY)."""
    from app.services.rerank_engines.registry import LOCAL_INFERENCE_TIMEOUT_S

    source = RERANK_ENGINES_TS.read_text(encoding="utf-8")
    assert _latency_seconds(source) == int(LOCAL_INFERENCE_TIMEOUT_S)
    # The comparison can fail: the same source with the copy moved to 31 does not match.
    planted = source.replace("past 30 seconds", "past 31 seconds")
    assert _latency_seconds(planted) != int(LOCAL_INFERENCE_TIMEOUT_S)


# ── 294-IN-07 ─────────────────────────────────────────────────────────────────


def test_a_claim_sentence_keeps_no_space_before_punctuation():
    from app.services.citation_claims import _clean, extract_claims

    assert _clean("Revenue grew **12%** .") == "Revenue grew 12%."
    assert _clean("Costs fell [2] , then rose [3] ; margins held [1] !") == (
        "Costs fell, then rose; margins held!"
    )
    # code spans stay verbatim
    assert _clean("Run `a .b` now .") == "Run `a .b` now."
    (claim,) = extract_claims("Costs fell [1].", [{"passage": "p"}])
    assert claim.sentence == "Costs fell."


# ── 294-CR-02 residual ────────────────────────────────────────────────────────

FIXTURE = json.loads(ORDINALS.read_text(encoding="utf-8"))


def test_the_measured_fixture_covers_html_blocks_and_both_setext_forms():
    ids = {c["id"] for c in FIXTURE["cases"]}
    assert len(FIXTURE["cases"]) >= 4
    assert any(i.startswith("html_") for i in ids)
    assert "setext_equals" in ids and "setext_dashes" in ids
    assert any(i.startswith("mixed") for i in ids)
    assert FIXTURE["measured_with"].startswith("marked 17")


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=[c["id"] for c in FIXTURE["cases"]])
def test_claim_ordinals_match_marked(case):
    from app.services.citation_claims import dedup_paragraphs, extract_claims

    assert dedup_paragraphs(case["content"]) == case["content"]
    refs = [{"passage": "A source passage."} for _ in range(case["n_sources"])]
    claims = extract_claims(case["content"], refs)
    assert [c.n for c in claims] == case["expected"]
    assert [c.ordinal for c in claims] == list(range(len(case["expected"])))
    for c in claims:
        assert "===" not in c.sentence and "---" not in c.sentence
        assert "<" not in c.sentence

"""Phase 294-01 — the Local engine's model cache and its non-blocking first use.

Defect fixed (CONTEXT): the base ``_get_local_model`` cached the FIRST model forever and ignored
``rerank_model``. Now one ``(model_name, CrossEncoder)`` is resident per worker, a name change
reloads exactly once, and two concurrent first calls construct it once.

First use (checker W6 / N6): a chat search never waits on a ~2.3 GB download. A non-resident model
loads ONCE on a background thread while ``rerank`` raises ``LocalModelWarming`` (the dispatcher
then returns the rerank-off output). A failed load waits ``LOAD_RETRY_COOLDOWN_S`` before the next
attempt.

``sentence_transformers`` is replaced in ``sys.modules`` by a fake whose ``CrossEncoder`` counts
constructions, so no real weights are ever loaded.
"""
from __future__ import annotations

import logging
import sys
import threading
import types

import pytest


class _Factory:
    def __init__(self, *, gate: threading.Event | None = None, fail: bool = False, delay_gate=None):
        self.constructed: list[str] = []
        self.gate = gate
        self.fail = fail
        self.lock = threading.Lock()
        factory = self

        class CrossEncoder:
            def __init__(self, name):
                with factory.lock:
                    factory.constructed.append(name)
                if factory.gate is not None:
                    assert factory.gate.wait(5), "test gate never released"
                if factory.fail:
                    raise RuntimeError("download failed: https://hf.example/secret")
                self.name = name

            def predict(self, pairs):
                # Higher score for later passages, so a reorder is observable.
                return [float(i) for i, _ in enumerate(pairs)]

        self.cls = CrossEncoder


@pytest.fixture
def local(monkeypatch):
    import app.services.rerank_engines.local as local_mod

    monkeypatch.setattr(local_mod, "_local", None)
    monkeypatch.setattr(local_mod, "_loader", None)
    monkeypatch.setattr(local_mod, "_failed_at", {})
    yield local_mod
    loader = local_mod._loader
    if loader is not None:
        loader[1].join(5)


def _install(monkeypatch, factory: _Factory):
    mod = types.ModuleType("sentence_transformers")
    mod.CrossEncoder = factory.cls
    monkeypatch.setitem(sys.modules, "sentence_transformers", mod)


def _docs(n=4):
    return [{"id": f"c{i}", "document_id": "d", "content": f"p{i}", "chunk_index": i,
             "low_similarity": i == 0} for i in range(n)]


def test_same_name_twice_constructs_once(monkeypatch, local):
    f = _Factory()
    _install(monkeypatch, f)
    assert local.warm("m/a", wait=True) is True
    assert local.warm("m/a", wait=True) is True
    assert local._get_local_model("m/a") is local._get_local_model("m/a")
    assert f.constructed == ["m/a"]


def test_a_different_name_reloads_once_and_releases_the_old(monkeypatch, local):
    f = _Factory()
    _install(monkeypatch, f)
    first = local._get_local_model("m/a")
    second = local._get_local_model("m/b")
    local._get_local_model("m/b")
    assert f.constructed == ["m/a", "m/b"]
    assert first is not second
    assert local._local[0] == "m/b", "only ONE model is resident"


def test_two_concurrent_first_calls_construct_once(monkeypatch, local):
    gate = threading.Event()
    f = _Factory(gate=gate)
    _install(monkeypatch, f)
    results = []
    threads = [threading.Thread(target=lambda: results.append(local._get_local_model("m/a")))
               for _ in range(2)]
    for t in threads:
        t.start()
    gate.set()
    for t in threads:
        t.join(5)
    assert f.constructed == ["m/a"]
    assert len(results) == 2 and results[0] is results[1]


def test_first_rerank_starts_one_background_load_and_raises_warming(monkeypatch, local):
    gate = threading.Event()
    f = _Factory(gate=gate)
    _install(monkeypatch, f)
    with pytest.raises(local.LocalModelWarming):
        local.rerank("q", _docs(), 2, model="m/a")
    with pytest.raises(local.LocalModelWarming):
        local.rerank("q", _docs(), 2, model="m/a")
    gate.set()
    assert local.warm("m/a", wait=True, timeout_s=5) is True
    assert f.constructed == ["m/a"], "a second call during the load must not start a second load"
    out = local.rerank("q", _docs(), 2, model="m/a")
    assert [d["id"] for d in out] == ["c3", "c2"], "reorder + [:top_n] only (D-08)"
    assert all("relevance_score" in d for d in out)


def test_local_rerank_keeps_every_key_and_never_prunes(monkeypatch, local):
    f = _Factory()
    _install(monkeypatch, f)
    local.warm("m/a", wait=True)
    out = local.rerank("q", _docs(4), 10, model="m/a")
    assert len(out) == 4
    assert [d["low_similarity"] for d in out] == [False, False, False, True]


def test_a_failed_load_cools_down_before_the_next_attempt(monkeypatch, local, caplog):
    f = _Factory(fail=True)
    _install(monkeypatch, f)
    now = [1000.0]
    monkeypatch.setattr(local, "_clock", lambda: now[0])
    with caplog.at_level(logging.INFO):
        with pytest.raises(local.LocalModelWarming):
            local.rerank("q", _docs(), 2, model="m/broken")
        local._loader[1].join(5)
    assert local._local is None, "a failed load leaves no half-set cache"
    assert "local rerank model m/broken load failed (RuntimeError)" in caplog.text
    assert "hf.example" not in caplog.text

    now[0] += local.LOAD_RETRY_COOLDOWN_S - 1
    with pytest.raises(local.LocalModelWarming):
        local.rerank("q", _docs(), 2, model="m/broken")
    if local._loader is not None:
        local._loader[1].join(5)
    assert f.constructed == ["m/broken"], "inside the cool-down nothing is loaded"

    now[0] += 2
    with pytest.raises(local.LocalModelWarming):
        local.rerank("q", _docs(), 2, model="m/broken")
    local._loader[1].join(5)
    assert f.constructed == ["m/broken", "m/broken"]


def test_a_successful_load_logs_its_duration_and_pid(monkeypatch, local, caplog):
    import os

    f = _Factory()
    _install(monkeypatch, f)
    with caplog.at_level(logging.INFO):
        local.warm("m/a", wait=True)
    msgs = [r.getMessage() for r in caplog.records if "loaded in" in r.getMessage()]
    assert msgs and msgs[0].startswith("local rerank model m/a loaded in ")
    assert f"pid {os.getpid()}" in msgs[0]


def test_cooldown_constant():
    from app.services.rerank_engines.local import LOAD_RETRY_COOLDOWN_S

    assert LOAD_RETRY_COOLDOWN_S == 300

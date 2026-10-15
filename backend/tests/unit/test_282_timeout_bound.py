"""Phase 282 Plan 01 (FIX-06; D-03, D-04, D-07, D-08, D-19, D-21, D-22) — the timeout ceiling,
the retry rule, the stored-value clamp, the refusal sentence and the run-failure sentence.

What was wrong before this plan:

  * ``_LLM_CALL_TIMEOUT_MAX_S`` was 3600, so the Model Registry ACCEPTED a timeout the platform
    could never honour: the run watchdog (``run_stale_sweep_timeout_seconds``, 2400 s) ends a run
    whose stream has been silent that long, and nothing writes while a model call is silent.
    An operator who typed 3000 got a run killed at 2400 with no word about why (D-21).
  * The resolver's DB tier returned the stored value UNCLAMPED — the env parser bounded its own
    door while the Registry's stored rows reached the per-call timer raw (D-08).
  * The 422 named a raw engine column (``'llm_call_timeout_seconds' must be between ...``) in an
    operator surface, and said nothing about why the ceiling is where it is (D-07, UI-SPEC).
  * A run ended by the per-call timer said ``timed_out: Ns per-call deadline exceeded ...`` and
    nothing about the setting that chose N or where to change it (D-04 as corrected by D-22).
  * No retry count was chosen on purpose anywhere: every client inherited the SDK's 2, including
    a local model on one GPU where a retry re-queues the same prompt (D-19).
"""
from __future__ import annotations

import inspect
import logging
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.config as config
import app.dependencies as deps
import app.models.user_settings as us
from app.api import admin
from app.api.admin import _MODEL_CAP_INT_BOUNDS, set_model_capability

_REPO = Path(__file__).resolve().parents[3]
_ADMIN_TS = _REPO / "frontend" / "src" / "lib" / "api" / "admin.ts"


# ── Behaviour 1: the ceiling is 1800, in exactly two homes ─────────────────────────────────


def test_ceiling_is_1800_in_config_and_admin():
    assert config._LLM_CALL_TIMEOUT_MAX_S == 1800
    assert _MODEL_CAP_INT_BOUNDS["llm_call_timeout_seconds"] == (1, 1800)


def test_frontend_mirror_reads_1800():
    src = _ADMIN_TS.read_text(encoding="utf-8")
    assert "llm_call_timeout_seconds: [1, 1800]" in src
    assert "llm_call_timeout_seconds: [1, 3600]" not in src


# ── Behaviour 2: one retry rule, read from the one self-hosted predicate ──────────────────


@pytest.mark.parametrize("provider", ["ollama", "lmstudio", "custom", "LMStudio"])
def test_self_hosted_providers_are_tried_once(provider):
    assert config.llm_max_retries_for(provider) == 0


@pytest.mark.parametrize(
    "provider", ["openai", "openrouter", "anthropic", "deepseek", "google", None]
)
def test_cloud_providers_keep_two_retries(provider):
    assert config.llm_max_retries_for(provider) == 2


def test_retry_rule_has_no_second_predicate():
    src = inspect.getsource(config.llm_max_retries_for)
    assert "_SELF_HOSTED_PROVIDERS" in src
    assert '"lmstudio"' not in src and "'lmstudio'" not in src


def test_no_budget_constants_are_named():
    assert config.NO_BUDGET_LLM_TIMEOUT_S == 600.0
    assert config.NO_BUDGET_LLM_MAX_RETRIES == 2
    assert config.LLM_CONNECT_TIMEOUT_S == 5.0
    assert config.LLM_MAX_RETRIES_SELF_HOSTED == 0
    assert config.LLM_MAX_RETRIES_CLOUD == 2


# ── Behaviour 3: the DB tier clamps (D-08) ────────────────────────────────────────────────


def _stub_overrides(monkeypatch, value):
    async def _rows():
        return {"m": {"llm_call_timeout_seconds": value}}

    monkeypatch.setattr(us, "_load_model_overrides", _rows)


@pytest.mark.parametrize("raw, expected", [(5000, 1800), (0, 1), (-5, 1)])
async def test_db_tier_clamps_out_of_range(monkeypatch, caplog, raw, expected):
    _stub_overrides(monkeypatch, raw)
    with caplog.at_level(logging.WARNING, logger="app.config"):
        got = await config.get_per_call_timeout_async("m")
    assert got == expected
    warned = [r.getMessage() for r in caplog.records if r.levelno >= logging.WARNING]
    assert any("m" in msg and str(raw) in msg for msg in warned), warned


async def test_db_tier_in_range_is_untouched(monkeypatch, caplog):
    _stub_overrides(monkeypatch, 900)
    with caplog.at_level(logging.WARNING, logger="app.config"):
        got = await config.get_per_call_timeout_async("m")
    assert got == 900
    assert not [r for r in caplog.records if r.levelno >= logging.WARNING]


# ── Behaviour 4: the boot check (D-21) ────────────────────────────────────────────────────


def test_boot_refuses_a_watchdog_at_or_below_the_ceiling():
    with pytest.raises(ValueError) as ei:
        config.Settings(run_stale_sweep_timeout_seconds=1900)
    text = str(ei.value)
    assert "run_stale_sweep_timeout_seconds" in text
    assert "LLM call timeout" in text


def test_default_settings_construct():
    s = config.Settings()
    assert s.run_stale_sweep_timeout_seconds > config._LLM_CALL_TIMEOUT_MAX_S


# ── Behaviour 5: the 422 sentence names the reason (D-07 / D-21) ──────────────────────────


class _RecordingPool:
    def __init__(self):
        self.calls = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "INSERT 0 1"


def _fake_request(model_id="glm-4.7-flash"):
    return SimpleNamespace(
        state=SimpleNamespace(),
        method="PATCH",
        url=SimpleNamespace(path=f"/admin/models/{model_id}"),
    )


def test_ceiling_reason_reads_the_watchdog_setting():
    reason = config.llm_call_timeout_ceiling_reason()
    assert str(config.settings.run_stale_sweep_timeout_seconds) in reason
    assert "run watchdog" in reason


async def test_timeout_above_ceiling_is_refused_with_the_reason(monkeypatch):
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    with pytest.raises(HTTPException) as ei:
        await set_model_capability(
            "glm-4.7-flash", {"llm_call_timeout_seconds": 1801}, _fake_request(), _floor=None
        )
    assert ei.value.status_code == 422
    assert ei.value.detail == (
        "Timeout must be between 1 and 1800 seconds, because "
        + config.llm_call_timeout_ceiling_reason()
        + ". 1801 was not saved."
    )
    assert "2400" in ei.value.detail
    assert not pool.calls


async def test_timeout_at_ceiling_is_accepted(monkeypatch):
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    res = await set_model_capability(
        "glm-4.7-flash", {"llm_call_timeout_seconds": 1800}, _fake_request(), _floor=None
    )
    assert res["ok"] is True
    assert pool.calls


async def test_other_int_columns_keep_their_sentence(monkeypatch):
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    with pytest.raises(HTTPException) as ei:
        await set_model_capability(
            "glm-4.7-flash", {"context_window_tokens": 0}, _fake_request(), _floor=None
        )
    assert ei.value.detail.startswith("'context_window_tokens' must be between")
    assert not pool.calls


def test_admin_imports_the_reason_not_a_copy():
    assert admin.llm_call_timeout_ceiling_reason is config.llm_call_timeout_ceiling_reason


# ── Behaviour 6: the run-failure sentence (D-04 / D-22) ───────────────────────────────────


def test_timed_out_error_keeps_prefix_and_names_the_setting():
    from app.services import run_producer

    assert run_producer._timed_out_error(900, 3, "qwen") == (
        "timed_out: 900s per-call deadline exceeded at iteration 3 (model=qwen). "
        "qwen did not answer within 900 s, its per-call timeout. "
        "You can change it in the Model Registry."
    )

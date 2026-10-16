"""Phase 282 Plan 04 (FIX-06 follow-up; D-27..D-29): local models default to 900 s, and Add model
by ID takes a Timeout.

What was wrong before this plan (measured live on 2026-10-15, G-4 row 4):

  * An LM Studio model the Registry had never heard of (``spark-x2.5-4b``) ran with the **300 s**
    cloud default. Local models are slower, and the only way to give one more time was to add it
    to the Registry and then edit the cell, with no hint that 300 s was being applied (D-27).
  * "Add model by ID" had no Timeout field, so a newly added local model started at the same 300 s
    (D-29).
"""
from __future__ import annotations

import re
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.config as config
import app.dependencies as deps
import app.models.user_settings as us
from app.api import admin as admin_mod
from app.api.admin import AddModelRequest, add_model_by_id

_BACKEND = Path(__file__).resolve().parents[2]
_UNKNOWN = "never-registered-282-04"


# ── D-27: the resolver's default follows the provider ─────────────────────────────────────


def test_self_hosted_default_is_900_and_cloud_default_is_unchanged():
    assert config.DEFAULT_LLM_CALL_TIMEOUT_SECONDS_SELF_HOSTED == 900
    assert config.DEFAULT_LLM_CALL_TIMEOUT_SECONDS == 300


@pytest.mark.parametrize("provider", ["lmstudio", "ollama", "custom", "LMStudio"])
def test_sync_unknown_self_hosted_model_gets_900(provider):
    assert config.get_per_call_timeout(_UNKNOWN, provider=provider) == 900


@pytest.mark.parametrize("provider", ["openai", "deepseek", None, ""])
def test_sync_unknown_cloud_or_unnamed_model_keeps_300(provider):
    assert config.get_per_call_timeout(_UNKNOWN, provider=provider) == 300


def test_sync_registered_and_env_values_still_win():
    # A registered cloud model keeps its registered value whatever provider string is passed.
    assert config.get_per_call_timeout("gpt-5.6-sol", provider="lmstudio") == 900
    assert config.get_per_call_timeout("gemini-3.5-flash", provider="lmstudio") == 300
    s = SimpleNamespace(llm_call_timeout_overrides=f"{_UNKNOWN}=42")
    assert config.get_per_call_timeout(_UNKNOWN, s, provider="lmstudio") == 42


def _stub_rows(monkeypatch, rows):
    async def _rows():
        return rows

    monkeypatch.setattr(us, "_load_model_overrides", _rows)


async def test_async_unknown_self_hosted_model_gets_900(monkeypatch):
    _stub_rows(monkeypatch, {})
    assert await config.get_per_call_timeout_async(_UNKNOWN, None, provider="lmstudio") == 900
    assert await config.get_per_call_timeout_async(_UNKNOWN, None, provider="openai") == 300
    assert await config.get_per_call_timeout_async(_UNKNOWN) == 300


async def test_async_db_row_provider_is_read_when_no_kwarg(monkeypatch):
    """A Registry row added for a local model with the Timeout left blank: the row's provider
    decides the default, so the model is not silently cut off at the cloud 300 s."""
    _stub_rows(monkeypatch, {_UNKNOWN: {"provider": "lmstudio", "llm_call_timeout_seconds": None}})
    assert await config.get_per_call_timeout_async(_UNKNOWN) == 900


async def test_async_stored_value_still_wins(monkeypatch):
    _stub_rows(monkeypatch, {_UNKNOWN: {"provider": "lmstudio", "llm_call_timeout_seconds": 120}})
    assert await config.get_per_call_timeout_async(_UNKNOWN, None, provider="lmstudio") == 120


def test_no_second_self_hosted_list():
    """D-27: the default reads mig 180's predicate. A new literal list of provider names in the
    resolver would drift the moment a fourth self-hosted provider is added."""
    src = (_BACKEND / "app" / "config.py").read_text(encoding="utf-8")
    start = src.index("def _default_llm_call_timeout(")
    end = src.index("async def get_model_capability_async(")
    body = src[start:end]
    assert "_SELF_HOSTED_PROVIDERS" in body
    assert not re.search(r"""["']lmstudio["']""", body)


# ── D-28: every budget lookup passes the provider it already routes on ────────────────────


@pytest.mark.parametrize(
    "rel, needle, count",
    [
        ("app/services/agent_loop.py", "get_per_call_timeout_async(_model_id, settings, provider=active_provider_name)", 2),
        ("app/services/forced_emit.py", "get_per_call_timeout_async(model, settings, provider=provider)", 1),
        ("app/services/task_service.py", "get_per_call_timeout_async(model, settings, provider=_provider)", 1),
    ],
)
def test_call_sites_pass_the_provider(rel, needle, count):
    src = (_BACKEND / rel).read_text(encoding="utf-8")
    assert src.count(needle) == count
    assert len(re.findall(r"get_per_call_timeout_async\(", src)) == count


# ── D-29: Add model by ID takes a Timeout, bound like the PATCH ───────────────────────────


class _RecordingPool:
    def __init__(self):
        self.calls = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "INSERT 0 1"

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return "row-id"

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return []


def _req():
    return SimpleNamespace(state=SimpleNamespace(), method="POST", url=SimpleNamespace(path="/admin/models"))


def _prep(monkeypatch):
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    monkeypatch.setattr(admin_mod, "invalidate_model_overrides_cache", lambda: None)

    async def _none():
        return {}

    monkeypatch.setattr("app.models.user_settings.load_all_model_overrides", _none)
    return pool


async def test_add_model_writes_a_legal_timeout(monkeypatch):
    pool = _prep(monkeypatch)
    body = AddModelRequest(model_id="spark-x2.5-4b", provider="lmstudio", llm_call_timeout_seconds=1200)
    out = await add_model_by_id(_req(), body, _floor=None)
    assert out["ok"] is True
    inserts = [(s, a) for s, a in pool.calls if "INSERT INTO model_capabilities_overrides" in s]
    assert len(inserts) == 1
    sql, args = inserts[0]
    assert "llm_call_timeout_seconds" in sql
    assert 1200 in args


async def test_add_model_without_timeout_writes_no_timeout(monkeypatch):
    pool = _prep(monkeypatch)
    body = AddModelRequest(model_id="spark-x2.5-4b", provider="lmstudio")
    await add_model_by_id(_req(), body, _floor=None)
    sql, _args = [(s, a) for s, a in pool.calls if "INSERT INTO model_capabilities_overrides" in s][0]
    assert "llm_call_timeout_seconds" not in sql


@pytest.mark.parametrize("bad", [1801, 0, -5])
async def test_add_model_refuses_out_of_range_with_the_patch_sentence(monkeypatch, bad):
    pool = _prep(monkeypatch)
    body = AddModelRequest(model_id="spark-x2.5-4b", provider="lmstudio", llm_call_timeout_seconds=bad)
    with pytest.raises(HTTPException) as exc:
        await add_model_by_id(_req(), body, _floor=None)
    assert exc.value.status_code == 422
    assert exc.value.detail == (
        "Timeout must be between 1 and 1800 seconds, because a longer call would outlast the run "
        "watchdog, which ends a run that has been silent for "
        f"{config.settings.run_stale_sweep_timeout_seconds} s. {bad} was not saved."
    )
    assert not [c for c in pool.calls if "INSERT" in c[0]], "refused before any DB write"


def test_one_helper_builds_the_refusal_for_both_doors():
    src = (_BACKEND / "app" / "api" / "admin.py").read_text(encoding="utf-8")
    assert src.count("Timeout must be between") == 1
    assert src.count("_timeout_out_of_range_detail(") >= 3  # def + PATCH + add


def test_frontend_default_mirror_matches_config():
    """D-29: the Add form's placeholder reads admin.ts; those two numbers must be config.py's."""
    src = (_BACKEND.parent / "frontend" / "src" / "lib" / "api" / "admin.ts").read_text(encoding="utf-8")
    assert f"export const MODEL_TIMEOUT_DEFAULT_S = {config.DEFAULT_LLM_CALL_TIMEOUT_SECONDS}" in src
    assert (
        "export const MODEL_TIMEOUT_DEFAULT_SELF_HOSTED_S = "
        f"{config.DEFAULT_LLM_CALL_TIMEOUT_SECONDS_SELF_HOSTED}"
    ) in src

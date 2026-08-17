"""Phase 196 Plan 01 (AUTH-04 / D-14) — ``emit_tier`` overlays from the DB and is
PATCH-writable only through the allowlisted enum guard.

TWO properties, and they fail in opposite directions:

  1. **The overlay (D-14).** A DB ``emit_tier`` must WIN over the code registry on the async
     capability path, otherwise the operator's correction is stored and ignored.
  2. **The guard (T-196-IV2 / T-196-IV2b).** A value outside the closed vocabulary — or an
     integer outside its sane range — must be refused 422 BEFORE any DB touch.

⚠ EVERY REFUSAL CASE ASSERTS ``pool.calls`` IS EMPTY, not merely that a 422 was raised. A
guard that raises AFTER the upsert is not a guard; it is a log line. That assertion shape is
borrowed from ``test_149_default_guard.py:86``, where the same distinction was load-bearing.

⚠ NO TEST IN THIS FILE INSERTS OR UPDATES A REAL ROW. Every case is patched/stubbed against
the recording pool. That is deliberate and structural: CLAUDE.md's parallel-execution rule 4
requires serialising any plan whose tests MUTATE the local database, because worktrees isolate
files but NOT Postgres. Keeping this file mutation-free is what lets the plan run in a wave.

⚠ THE MODEL IDS ARE CHOSEN, NOT INCIDENTAL. ``gpt-5.4`` is registry-known, enabled and
``force_strict`` — it passes every check this plan adds and would prove nothing. The cases
below use ``glm-4.7-flash`` (DB-only, local, ``coerce`` by construction) and
``gemini-3.6-flash`` (DB-only, absent from ``verified_models``) — the two shapes SEED-135
actually measured degrading.
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.dependencies as deps
import app.models.user_settings as us
from app.api.admin import (
    _MODEL_CAP_COLUMNS,
    _MODEL_CAP_ENUM_COLUMNS,
    _MODEL_CAP_INT_BOUNDS,
    set_model_capability,
)
from app.config import (
    _LLM_CALL_TIMEOUT_MAX_S,
    _LLM_CALL_TIMEOUT_MIN_S,
    get_model_capability,
    get_model_capability_async,
)

_DB_ONLY_LOCAL = "glm-4.7-flash"
_DB_ONLY_GEMINI = "gemini-3.6-flash"


class _RecordingPool:
    """asyncpg-pool stand-in recording every ``execute`` — a guard must leave ``.calls`` empty."""

    def __init__(self):
        self.calls = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "INSERT 0 1"


def _fake_request(model_id=_DB_ONLY_LOCAL, method="PATCH"):
    return SimpleNamespace(
        state=SimpleNamespace(),
        method=method,
        url=SimpleNamespace(path=f"/admin/models/{model_id}"),
    )


def _reset_override_caches():
    """The zero-DB-mutation seeding shape from test_149_registry_read.py."""
    us._model_overrides_cache = {}
    us._model_overrides_cache_time = 0.0
    us._all_model_overrides_cache = {}
    us._all_model_overrides_cache_time = 0.0


def _mock_overrides(monkeypatch, rows_by_id):
    """Patch the hot-cache read ``get_model_capability_async`` overlays from."""
    _reset_override_caches()

    async def _fake():
        return rows_by_id

    monkeypatch.setattr("app.models.user_settings._load_model_overrides", _fake)


# ── the overlay (D-14) ────────────────────────────────────────────────────────────


async def test_db_emit_tier_wins_over_the_code_registry(monkeypatch):
    """A stored tier overlays the registry value on the ASYNC path.

    This is the whole of D-14: before migration 120 + the overlay entry, this value had
    nowhere to live and nothing to read it.
    """
    _mock_overrides(monkeypatch, {
        _DB_ONLY_LOCAL: {
            "model_id": _DB_ONLY_LOCAL,
            "provider": "lmstudio",
            "emit_tier": "force_strict",
        },
    })

    cap = await get_model_capability_async(_DB_ONLY_LOCAL)

    assert cap["emit_tier"] == "force_strict"
    assert cap["capability_source"] == "db_override"


async def test_null_emit_tier_leaves_todays_behaviour_byte_identical(monkeypatch):
    """A row with NULL ``emit_tier`` — the state of all 37 rows migration 120 ships against.

    The overlay copies only non-None values, so NULL must not write the key at all. The
    consumer then falls through to ``cap.get("emit_tier", "coerce")`` at forced_emit.py:376,
    which is exactly today's behaviour. If the overlay ever wrote an explicit ``None`` here,
    ``.get`` would return ``None`` rather than the default and the ladder's boundary guard
    would silently take over — a different code path reaching the same answer by luck.
    """
    _mock_overrides(monkeypatch, {
        _DB_ONLY_GEMINI: {
            "model_id": _DB_ONLY_GEMINI,
            "provider": "google",
            "emit_tier": None,
        },
    })

    cap = await get_model_capability_async(_DB_ONLY_GEMINI)

    assert cap.get("emit_tier") is None
    assert cap.get("emit_tier", "coerce") == "coerce"


def test_sync_path_still_never_reads_the_db():
    """RESEARCH Pitfall 7, pinned as SURVIVING this plan rather than fixed by it.

    The sync ``get_model_capability`` has no DB tier, so a DB-only model still resolves
    ``inferred`` with no ``emit_tier``. Any surface needing a DB-only model's tier must use
    the async path or the registry union. Pinned so a later reader does not assume the
    overlay fixed both doors.
    """
    cap = get_model_capability(_DB_ONLY_LOCAL)
    assert cap.get("capability_source") == "inferred"
    assert "emit_tier" not in cap


# ── the enum guard (T-196-IV2) ────────────────────────────────────────────────────


def test_emit_tier_joined_the_patch_allowlist():
    assert "emit_tier" in _MODEL_CAP_COLUMNS
    assert len(_MODEL_CAP_COLUMNS) == 8
    assert _MODEL_CAP_ENUM_COLUMNS["emit_tier"] == {"force_strict", "force", "coerce"}


@pytest.mark.parametrize(
    "bad_value",
    ["FORCE_STRICT", "strict", "", "force_strict ", 1, True, ["force"]],
)
async def test_off_allowlist_emit_tier_is_422_before_any_write(monkeypatch, bad_value):
    """T-196-IV2 — the refusal fires BEFORE the upsert, so ``.calls`` stays empty.

    ``"FORCE_STRICT"`` and ``"force_strict "`` are included deliberately: the DB CHECK is
    case- and whitespace-sensitive, so a near-miss is exactly what an operator or a sloppy
    client produces, and it must be a clean 422 rather than a raw Postgres 23514.
    """
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)

    with pytest.raises(HTTPException) as ei:
        await set_model_capability(
            _DB_ONLY_LOCAL, {"emit_tier": bad_value}, _fake_request(), _floor=None
        )

    assert ei.value.status_code == 422
    assert "emit_tier" in ei.value.detail
    assert not pool.calls, "the enum guard must 422 BEFORE any capability write"


async def test_explicit_null_emit_tier_is_accepted_as_reset(monkeypatch):
    """An explicit ``null`` is a Reset for every column — the loop's shipped semantics.

    The new branch sits INSIDE the existing loop precisely so it inherits this; a guard
    written above the loop would have refused the Reset and left the operator unable to
    clear a tier they set by mistake.
    """
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)

    res = await set_model_capability(
        _DB_ONLY_LOCAL, {"emit_tier": None}, _fake_request(), _floor=None
    )

    assert res["ok"] is True
    assert "emit_tier" in res["changed"]
    assert pool.calls, "an accepted Reset must actually reach the upsert"


@pytest.mark.parametrize("good_value", ["force_strict", "force", "coerce"])
async def test_every_allowed_tier_is_accepted(monkeypatch, good_value):
    """Non-vacuity for the guard: all three legal values must pass, or the refusal tests
    above would be satisfied by a branch that simply rejects everything."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)

    res = await set_model_capability(
        _DB_ONLY_LOCAL, {"emit_tier": good_value}, _fake_request(), _floor=None
    )

    assert res["ok"] is True
    assert pool.calls


# ── the folded SEED-172 numeric bounds (T-196-IV2b) ───────────────────────────────


def test_timeout_bounds_are_imported_not_retyped():
    """The PATCH path and the env parser must be the SAME two numbers.

    Retyping them is how a clamp drifts: the env door would refuse 0 while the PATCH door
    accepted it, and both would look correct in isolation.
    """
    assert _MODEL_CAP_INT_BOUNDS["llm_call_timeout_seconds"] == (
        _LLM_CALL_TIMEOUT_MIN_S,
        _LLM_CALL_TIMEOUT_MAX_S,
    )


@pytest.mark.parametrize("col", sorted(_MODEL_CAP_INT_BOUNDS))
@pytest.mark.parametrize("factory", ["zero", "negative", "above_max"])
async def test_out_of_range_int_is_422_before_any_write(monkeypatch, col, factory):
    """SEED-172 finding 3: ``0``, a negative and an absurd value were each accepted
    end-to-end before this plan. Each is now a 422 with no write reached."""
    lo, hi = _MODEL_CAP_INT_BOUNDS[col]
    value = {"zero": 0, "negative": -1, "above_max": hi + 1}[factory]

    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)

    with pytest.raises(HTTPException) as ei:
        await set_model_capability(
            _DB_ONLY_LOCAL, {col: value}, _fake_request(), _floor=None
        )

    assert ei.value.status_code == 422
    assert col in ei.value.detail
    assert str(lo) in ei.value.detail and str(hi) in ei.value.detail
    assert not pool.calls, "the bounds guard must 422 BEFORE any capability write"


@pytest.mark.parametrize("col", sorted(_MODEL_CAP_INT_BOUNDS))
async def test_boundary_values_are_accepted(monkeypatch, col):
    """The bounds are INCLUSIVE. Pinned because an off-by-one here would refuse the
    smallest legitimate configuration while every out-of-range test still passed."""
    lo, hi = _MODEL_CAP_INT_BOUNDS[col]
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)

    for value in (lo, hi):
        pool.calls.clear()
        res = await set_model_capability(
            _DB_ONLY_LOCAL, {col: value}, _fake_request(), _floor=None
        )
        assert res["ok"] is True
        assert pool.calls, f"{col}={value} is in range and must reach the upsert"

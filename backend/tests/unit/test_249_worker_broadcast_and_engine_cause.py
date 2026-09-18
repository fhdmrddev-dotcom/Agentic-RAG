"""Phase 249 Plan 04 — MODEL-06 (already shipped: prove it) + MODEL-09 (does not reproduce: fence it).

── MODEL-06 WAS BUILT BEFORE THIS PHASE OPENED ──────────────────────────────────────

`BUG-260902-06`'s fix is present and wired: `broadcast_settings_change` re-warms the writing
worker then PUBLISHes on `SCOPE_APP_SETTINGS`; `broadcast_model_overrides_change` is its
model-registry twin; `main.py` constructs `SettingsCacheSubscriber` at lifespan. So this phase's
deliverable is a PROOF and a FENCE, not a feature — and the fence is the part that survives,
because nothing today would notice if a future edit dropped one of the three write seams.

⛔ THE FENCE HAS TWO DIRECTIONS, AND THE SECOND IS THE EASY ONE TO LOSE.
`broadcast_model_overrides_change`'s own docstring: the two `invalidate_model_overrides_cache()`
calls in `admin.py` that force a FRESH read before a guard (WR-03) **are reads, not writes, and
must NOT broadcast** — publishing there would make every worker re-read the database because one
worker wanted to check something. A fence that only checks "the writes broadcast" would pass
happily over a change that made the reads broadcast too.

── MODEL-09 DOES NOT REPRODUCE, AND THE CODE PROPERTY IS WHAT IS WORTH KEEPING ──────

`BUG-260809-01` (0/8 engines healthy, 6 of 8 hiding why) was measured on CLOUD PRODUCTION on
2026-08-09. Re-measured 2026-09-15 by running a real sweep through the live local app:

    stale board (2026-08-27)  7/8 healthy — the one failure carried
                              `RateLimitError: Error code: 429 - … insufficient balance …` VERBATIM
    fresh sweep (2026-09-14)  8/8 healthy · zero errors · zero `provider_error`

⛔ THE LIMIT, STATED HERE SO THE FENCE IS NOT READ AS MORE THAN IT IS: that measurement is LOCAL,
at `develop`. What is proven is that the application does not MANUFACTURE an opaque cause. What is
NOT proven is that cloud's eight engines are healthy today.

So the fence pins the code property: an unhealthy tile carries the VERBATIM provider string, and
the one engine-shaped sentence is the LAST resort, never the first.
"""
import inspect

import pytest


# ── MODEL-06: the broadcast contract, both directions ─────────────────────────

def test_every_registry_write_seam_broadcasts():
    """All THREE model-registry writes publish: add, patch, remove."""
    import app.api.admin as admin_mod

    src = inspect.getsource(admin_mod)
    assert src.count("await broadcast_model_overrides_change()") == 3, (
        "the registry has three write seams (add / patch / remove) and each must publish — "
        "a missed one means the change appears on roughly half the requests at WORKER_COUNT=2"
    )


def test_a_read_before_guard_does_not_broadcast():
    """⛔ THE NEGATIVE DIRECTION. WR-03's two fresh-read invalidations are READS.

    Publishing there would make every worker re-read the database because one worker wanted to
    check something — a correctness-neutral change that turns a guard into a stampede.
    """
    import app.api.admin as admin_mod

    src = inspect.getsource(admin_mod)
    # Two bare invalidations (the WR-03 fresh reads) and no more.
    bare = [
        ln for ln in src.splitlines()
        if ln.strip() == "invalidate_model_overrides_cache()"
    ]
    assert len(bare) == 2, (
        f"expected exactly 2 bare WR-03 invalidations, found {len(bare)} — a new one is either a "
        "write that forgot to broadcast, or a read that should not"
    )


def test_an_app_settings_write_broadcasts():
    """Every `app_settings` write funnels through ONE seam, so covering it covers them all."""
    from app.models.user_settings import save_app_settings

    src = inspect.getsource(save_app_settings)
    assert "await broadcast_settings_change()" in src


def test_the_broadcast_helpers_never_raise():
    """⭐ THE FAIL-SOFT ARM — the one whose absence turns a cache optimisation into an outage.

    Both helpers are documented `NEVER RAISES`: a dead Redis must degrade to the pre-existing
    30 s TTL, never turn a SUCCESSFUL WRITE into an error. The write is the contract.
    """
    from app.models import user_settings as us

    for fn in (us.broadcast_settings_change, us.broadcast_model_overrides_change):
        src = inspect.getsource(fn)
        assert "except Exception" in src, f"{fn.__name__} must swallow a publish failure"
        assert "NEVER RAISES" in src, (
            f"{fn.__name__}'s contract must be stated where the next editor will read it"
        )


async def test_a_dead_redis_does_not_fail_the_settings_write(monkeypatch):
    """Driven, not merely read: with the publisher raising, the write still succeeds."""
    import app.models.user_settings as us

    class _Pool:
        async def execute(self, sql, *args):
            return "UPDATE 1"

    async def _boom(_scope):
        raise RuntimeError("redis is down")

    monkeypatch.setattr("app.dependencies._pg_pool", _Pool())
    monkeypatch.setattr("app.services.settings_broadcast.publish_cache_invalidation", _boom)
    us._settings_cache = None
    us._settings_cache_time = 0.0

    assert await us.save_app_settings({"source_max_file_size_mb": 25}) is True


def test_the_subscriber_is_constructed_at_lifespan():
    """The publish half is useless without the listening half."""
    import app.main as main_mod

    src = inspect.getsource(main_mod)
    assert "SettingsCacheSubscriber" in src, (
        "nothing consumes the broadcast — every worker would fall back to its 30s TTL, which is "
        "exactly the pre-fix behaviour BUG-260902-06 described"
    )


# ── MODEL-09: the honest cause ────────────────────────────────────────────────

ENGINE_SHAPED = "The engine did not complete this arm."


def _tile_source() -> str:
    from app.api.evals import _tile_for_run

    return inspect.getsource(_tile_for_run)


def test_an_unhealthy_tile_carries_the_verbatim_provider_error():
    """The tile reads the arm's own stored error rather than composing one."""
    src = _tile_source()
    assert 'with_arm.get("error")' in src
    assert 'run.get("error")' in src


def test_the_engine_shaped_fallback_is_the_last_resort():
    """⛔ The synthetic sentence appears ONLY after both real errors are absent.

    Asserted structurally: the fallback must sit inside a `if not error` guard, so it can never
    become the first thing tried. A tile that says "the engine did not complete this arm" when
    the provider said "your account is suspended due to insufficient balance" has replaced a
    diagnosis with a shrug — which is `BUG-260809-01`'s second half in one sentence.
    """
    src = _tile_source()
    assert ENGINE_SHAPED in src, "the last-resort sentence moved or was reworded — re-pin it"

    lines = src.splitlines()
    idx = next(i for i, ln in enumerate(lines) if ENGINE_SHAPED in ln)
    preceding = "\n".join(lines[max(0, idx - 4):idx])
    assert "if not error" in preceding, (
        "the engine-shaped sentence is no longer guarded by 'no real error was available' — "
        "it must be the LAST resort, never the first"
    )


def test_a_still_running_arm_is_not_reported_as_an_error():
    """An in-flight arm carries `error: None` and renders as in-flight, not as a failure.

    Measured on the real board mid-sweep 2026-09-15: every tile read `healthy:false, error:null`
    for ~90 seconds before settling to 8/8 healthy. Reporting that as a failure would make every
    sweep look catastrophic for its first minute.
    """
    src = _tile_source()
    assert 'run.get("status") not in (None, "running")' in src, (
        "the terminal-vs-running distinction is what stops an in-flight arm reading as failed"
    )


def test_no_opaque_provider_error_constant_is_composed_by_the_board():
    """⛔ The literal `provider_error` must not be manufactured on this path.

    `BUG-260809-01`'s headline was six tiles reading `provider_error` with no message. Whatever
    produced that, the board itself must never author it — a cause the engine invented is not a
    cause.
    """
    src = _tile_source()
    assert "provider_error" not in src

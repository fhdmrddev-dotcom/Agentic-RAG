"""Phase 137.1 Plan 07 (EVAL-05) — deterministic per-config aggregation + analyst-note tests.

Two tiers, mirroring the two tasks:

  1. PURE-FUNCTION tests (``app.services.eval_aggregation``) — NO app deps, NO I/O. They pin the
     honesty locks the aggregation inherits from the shipped rollup denominator
     (``eval_runner_service.py`` :825-828): the mean/spread counts ONLY with-skill ``graded`` arms;
     a ``not_measured`` / ``judge_error`` arm is NEVER counted as a fail; ``with_stddev`` is None on
     a 1-run config and numeric at >= 2 runs (spread from HISTORY, D-07); and each of the three D-08
     analyst-note rules fires ONLY on its exact condition (deterministic, fixed phrasing).

  2. ENDPOINT tests (added in Task 2) — drive ``evals.get_eval_aggregate`` DIRECTLY over an
     in-memory filtering supabase fake: owner-gate FIRST (cross-user -> 404), reads ONLY the
     caller's completed history, delegates all math to the pure module.

The pure tier collects/runs with only stdlib + the pure module; app imports are DEFERRED into the
endpoint test bodies (post-merge pytest gate covers those in the full app env).
"""
from uuid import uuid4

import pytest

from app.services.eval_aggregation import (
    FIRST_RUN_MARKER,
    FLAKY_STDDEV_THRESHOLD,
    GRADED,
    TAG_FLAKY_VARIANCE,
    TAG_NON_DISCRIMINATING,
    TAG_TIME_SCORE,
    VARIANT_WITH,
    VARIANT_WITHOUT,
    aggregate_configs,
    analyst_notes,
    to_wire,
)


# ── builders ─────────────────────────────────────────────────────────────────────
def _res(
    variant,
    *,
    state=GRADED,
    score=None,
    passed=None,
    duration_ms=None,
    tc="c1",
    run="r1",
    provider="openai",
    model="gpt-5",
):
    """One eval_results-shaped row."""
    return {
        "variant": variant,
        "verdict_state": state,
        "verdict_score": score,
        "verdict_passed": passed,
        "duration_ms": duration_ms,
        "test_case_id": tc,
        "eval_run_id": run,
        "provider": provider,
        "model": model,
    }


def _run(run_id, provider, model, results):
    """One history run row with its results embedded (aggregate_configs input shape)."""
    for r in results:
        r["eval_run_id"] = run_id
        r["provider"] = provider
        r["model"] = model
    return {"id": run_id, "provider": provider, "model": model, "status": "completed", "results": results}


# ═══════════════════════════════════════════════════════════════════════════════════
# aggregate_configs — the honesty locks
# ═══════════════════════════════════════════════════════════════════════════════════
def test_stddev_none_at_one_run_numeric_at_two():
    """D-07 / Pitfall 4: spread comes from HISTORY — ``with_stddev`` is None on a config's FIRST
    run ("no spread yet") and a numeric sample-stddev once the config has >= 2 runs."""
    one = aggregate_configs(
        [_run("r1", "openai", "gpt-5", [_res(VARIANT_WITH, score=80, passed=True),
                                        _res(VARIANT_WITHOUT, score=50, passed=False)])]
    )
    assert len(one) == 1
    assert one[0]["run_count"] == 1
    assert one[0]["with_stddev"] is None, "a first run has no spread yet (D-07)"
    assert one[0]["with_mean"] == 80.0
    assert one[0]["without_mean"] == 50.0
    assert one[0]["delta"] == 30.0

    two = aggregate_configs(
        [
            _run("r1", "openai", "gpt-5", [_res(VARIANT_WITH, score=80, passed=True),
                                           _res(VARIANT_WITHOUT, score=50, passed=False)]),
            _run("r2", "openai", "gpt-5", [_res(VARIANT_WITH, score=90, passed=True),
                                           _res(VARIANT_WITHOUT, score=50, passed=False)]),
        ]
    )
    assert two[0]["run_count"] == 2
    assert two[0]["with_stddev"] is not None, "stddev appears once a config has >= 2 runs"
    assert two[0]["with_mean"] == 85.0
    assert two[0]["delta"] == 35.0


def test_not_measured_and_judge_error_excluded_from_mean():
    """The mean/denominator counts ONLY with-skill ``graded`` arms — a ``not_measured`` /
    ``judge_error`` arm is EXCLUDED, never dragged into the mean as a 0/fail (inherits the shipped
    rollup denominator, eval_runner_service.py:825-828)."""
    cfgs = aggregate_configs(
        [
            _run(
                "r1",
                "openai",
                "gpt-5",
                [
                    _res(VARIANT_WITH, state=GRADED, score=80, passed=True, tc="c1"),
                    _res(VARIANT_WITH, state="not_measured", score=None, passed=None, tc="c2"),
                    _res(VARIANT_WITH, state="judge_error", score=None, passed=None, tc="c3"),
                    _res(VARIANT_WITHOUT, state=GRADED, score=40, passed=False, tc="c1"),
                ],
            )
        ]
    )
    # ONLY the single graded with-skill arm (80) feeds the mean — never pulled toward 0 by the
    # not_measured / judge_error arms.
    assert cfgs[0]["with_mean"] == 80.0
    assert cfgs[0]["without_mean"] == 40.0
    assert cfgs[0]["delta"] == 40.0


def test_config_with_no_graded_with_arm_has_zero_samples():
    """A config whose with-skill arms are ALL not_measured contributes no with-sample (run_count 0,
    stddev None) — honest emptiness, never a fabricated score."""
    cfgs = aggregate_configs(
        [_run("r1", "google", "gem", [_res(VARIANT_WITH, state="not_measured"),
                                      _res(VARIANT_WITHOUT, state=GRADED, score=30, passed=False)])]
    )
    assert cfgs[0]["run_count"] == 0
    assert cfgs[0]["with_stddev"] is None


# ═══════════════════════════════════════════════════════════════════════════════════
# analyst_notes — each D-08 rule fires ONLY on its condition
# ═══════════════════════════════════════════════════════════════════════════════════
def _cfg(provider="p", model="m", *, run_count=2, with_mean=75.0, without_mean=50.0,
         with_stddev=5.0, delta=25.0, avg_with_duration_ms=None):
    return {
        "provider": provider, "model": model, "run_count": run_count, "with_mean": with_mean,
        "without_mean": without_mean, "with_stddev": with_stddev, "delta": delta,
        "avg_with_duration_ms": avg_with_duration_ms,
    }


def test_flaky_variance_fires_only_above_threshold():
    """D-08 flaky variance: fires when the with-skill score swings run-to-run
    (``with_stddev >= FLAKY_STDDEV_THRESHOLD``) — and NOT below the threshold, NOR on a first run."""
    high = analyst_notes([_cfg(with_stddev=FLAKY_STDDEV_THRESHOLD + 6)], [])
    assert any(n["tag"] == TAG_FLAKY_VARIANCE for n in high)

    low = analyst_notes([_cfg(with_stddev=FLAKY_STDDEV_THRESHOLD - 6)], [])
    assert not any(n["tag"] == TAG_FLAKY_VARIANCE for n in low)

    first_run = analyst_notes([_cfg(with_stddev=None, run_count=1)], [])
    assert not any(n["tag"] == TAG_FLAKY_VARIANCE for n in first_run), "no spread → never flaky"


def test_non_discriminating_fires_only_when_no_case_flips():
    """D-08 non-discriminating: fires when with-skill and without-skill reach the SAME verdict on
    every graded case (the skill flips nothing) — NOT when a case flips, NOR without a both-arms pair."""
    cfg = _cfg(with_mean=100.0, without_mean=100.0, with_stddev=0.0, delta=0.0)

    same = [
        _res(VARIANT_WITH, passed=True, tc="c1", run="r1", provider="p", model="m"),
        _res(VARIANT_WITHOUT, passed=True, tc="c1", run="r1", provider="p", model="m"),
        _res(VARIANT_WITH, passed=False, tc="c2", run="r1", provider="p", model="m"),
        _res(VARIANT_WITHOUT, passed=False, tc="c2", run="r1", provider="p", model="m"),
    ]
    assert any(n["tag"] == TAG_NON_DISCRIMINATING for n in analyst_notes([cfg], same))

    flip = [
        _res(VARIANT_WITH, passed=True, tc="c1", run="r1", provider="p", model="m"),
        _res(VARIANT_WITHOUT, passed=False, tc="c1", run="r1", provider="p", model="m"),
    ]
    assert not any(n["tag"] == TAG_NON_DISCRIMINATING for n in analyst_notes([cfg], flip)), \
        "a flipped case means the skill mattered → discriminating"

    one_arm = [_res(VARIANT_WITH, passed=True, tc="c1", run="r1", provider="p", model="m")]
    assert not any(n["tag"] == TAG_NON_DISCRIMINATING for n in analyst_notes([cfg], one_arm)), \
        "no both-arms-graded pair → nothing honest to say"


def test_time_score_tradeoff_fires_only_on_marked_gap_without_better_lift():
    """D-08 time-score: fires when a config runs markedly slower (>= SLOW_DURATION_RATIO×) than the
    fastest arm WITHOUT a higher skill lift — and never on the fastest arm, on a slower-but-better
    arm, or on a close-duration arm."""
    fast = _cfg(provider="openai", model="gpt-5", with_mean=80, delta=20.0, avg_with_duration_ms=1000.0)
    slow = _cfg(provider="google", model="gem", with_mean=78, delta=18.0, avg_with_duration_ms=3000.0)

    notes = analyst_notes([fast, slow], [])
    ts = [n for n in notes if n["tag"] == TAG_TIME_SCORE]
    assert len(ts) == 1 and ts[0]["provider"] == "google", "only the slow, no-better-lift arm fires"
    assert not any(n["tag"] == TAG_TIME_SCORE and n["provider"] == "openai" for n in notes), \
        "the fastest arm is never the tradeoff"

    slower_but_better = _cfg(provider="google", model="gem", delta=30.0, avg_with_duration_ms=3000.0)
    assert not any(
        n["tag"] == TAG_TIME_SCORE for n in analyst_notes([fast, slower_but_better], [])
    ), "extra time that bought a higher lift is not a tradeoff"

    barely_slower = _cfg(provider="google", model="gem", delta=18.0, avg_with_duration_ms=1400.0)
    assert not any(
        n["tag"] == TAG_TIME_SCORE for n in analyst_notes([fast, barely_slower], [])
    ), "< SLOW_DURATION_RATIO× is not markedly slower"


# ═══════════════════════════════════════════════════════════════════════════════════
# to_wire — shape + first-run marker
# ═══════════════════════════════════════════════════════════════════════════════════
def test_to_wire_shape_and_first_run_marker():
    """``to_wire`` emits the EvalAggregate wire shape; a config with no spread (stddev None) carries
    the server-authored FIRST_RUN_MARKER while its wire ``with_stddev`` stays null (never a fake 0.0);
    a >= 2-run config carries a numeric stddev and NO marker."""
    one = aggregate_configs(
        [_run("r1", "openai", "gpt-5", [_res(VARIANT_WITH, score=80, passed=True),
                                        _res(VARIANT_WITHOUT, score=50, passed=False)])]
    )
    wire = to_wire(one, analyst_notes(one, []))
    assert set(wire.keys()) == {"configs"}
    c0 = wire["configs"][0]
    assert set(c0.keys()) == {
        "provider", "model", "run_count", "with_mean", "without_mean", "with_stddev",
        "delta", "analyst_notes",
    }
    assert c0["with_stddev"] is None
    assert FIRST_RUN_MARKER in c0["analyst_notes"]

    two = aggregate_configs(
        [
            _run("r1", "openai", "gpt-5", [_res(VARIANT_WITH, score=80, passed=True),
                                           _res(VARIANT_WITHOUT, score=50, passed=False)]),
            _run("r2", "openai", "gpt-5", [_res(VARIANT_WITH, score=90, passed=True),
                                           _res(VARIANT_WITHOUT, score=50, passed=False)]),
        ]
    )
    wire2 = to_wire(two, analyst_notes(two, []))
    assert wire2["configs"][0]["with_stddev"] is not None
    assert FIRST_RUN_MARKER not in wire2["configs"][0]["analyst_notes"]


# ═══════════════════════════════════════════════════════════════════════════════════
# Task 2 — the aggregate ENDPOINT (owner-gated; reads only the caller's completed history)
# ═══════════════════════════════════════════════════════════════════════════════════
OWNER = {"id": "00000000-0000-0000-0000-000000000001", "email": "owner@example.com"}
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}


class _Result:
    def __init__(self, data):
        self.data = data


class _FilterTable:
    """A minimal filtering supabase table honoring .select().eq().in_().order().limit().execute()
    so the owner-gate (404) + owner-scoping (.eq user_id) + completed filter (.eq status) are
    MEANINGFUL — reads only (the aggregate endpoint never writes)."""

    def __init__(self, store, name):
        self.store, self.name = store, name
        self._filters, self._in_filters = [], []
        self._limit = None

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        self._filters.append((col, str(val)))
        return self

    def in_(self, col, values):
        self._in_filters.append((col, [str(v) for v in values]))
        return self

    def order(self, *a, **k):
        return self

    def limit(self, n, *a, **k):
        self._limit = n
        return self

    def execute(self, *a, **k):
        out = []
        for r in self.store.get(self.name, []):
            if not all(str(r.get(c)) == v for c, v in self._filters):
                continue
            if not all(str(r.get(c)) in vals for c, vals in self._in_filters):
                continue
            out.append(r)
        if self._limit is not None:
            out = out[: self._limit]
        return _Result(out)


class _FilterSupabase:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        return _FilterTable(self.store, name)


def _agg_row(run_id, user_id, variant, score, passed):
    return {
        "eval_run_id": run_id, "user_id": user_id, "provider": "openai", "model": "gpt-5",
        "test_case_id": "c1", "variant": variant, "verdict_state": GRADED,
        "verdict_passed": passed, "verdict_score": score, "duration_ms": 1000,
    }


def _aggregate_store(skill_id):
    """OWNER owns the skill + two COMPLETED (openai/gpt-5) runs (with 80/90, without 50/50). Decoys
    the owner-scoping + completed-filter must EXCLUDE: a RUNNING owner run (with 10) and a COMPLETED
    run owned by OTHER_USER (with 0). If either leaked in, with_mean would not be 85."""
    return {
        "skills": [{"id": skill_id, "name": "pdf-builder", "description": "d", "user_id": OWNER["id"]}],
        "eval_runs": [
            {"id": "run1", "skill_id": skill_id, "user_id": OWNER["id"], "provider": "openai",
             "model": "gpt-5", "status": "completed", "created_at": "2026-07-01T00:00:01Z"},
            {"id": "run2", "skill_id": skill_id, "user_id": OWNER["id"], "provider": "openai",
             "model": "gpt-5", "status": "completed", "created_at": "2026-07-01T00:00:02Z"},
            {"id": "run3", "skill_id": skill_id, "user_id": OWNER["id"], "provider": "openai",
             "model": "gpt-5", "status": "running", "created_at": "2026-07-01T00:00:03Z"},
            {"id": "run4", "skill_id": skill_id, "user_id": OTHER_USER["id"], "provider": "openai",
             "model": "gpt-5", "status": "completed", "created_at": "2026-07-01T00:00:04Z"},
        ],
        "eval_results": [
            _agg_row("run1", OWNER["id"], VARIANT_WITH, 80, True),
            _agg_row("run1", OWNER["id"], VARIANT_WITHOUT, 50, False),
            _agg_row("run2", OWNER["id"], VARIANT_WITH, 90, True),
            _agg_row("run2", OWNER["id"], VARIANT_WITHOUT, 50, False),
            _agg_row("run3", OWNER["id"], VARIANT_WITH, 10, False),      # running -> excluded
            _agg_row("run4", OTHER_USER["id"], VARIANT_WITH, 0, False),  # other user -> excluded
        ],
    }


@pytest.mark.asyncio
async def test_aggregate_endpoint_owned_reads_only_callers_completed_history():
    """The route owner-gates, reads ONLY the caller's COMPLETED runs, and delegates to the pure
    module: OWNER's two completed openai/gpt-5 runs aggregate to run_count 2 / with_mean 85 /
    delta 35 — the RUNNING owner run and the OTHER_USER run are excluded (with_mean stays 85)."""
    from app.api import evals

    skill_id = str(uuid4())
    sb = _FilterSupabase(_aggregate_store(skill_id))

    result = await evals.get_eval_aggregate(skill_id, current_user=OWNER, supabase=sb)

    assert set(result.keys()) == {"configs"}
    assert len(result["configs"]) == 1, "one (provider, model) config"
    cfg = result["configs"][0]
    assert (cfg["provider"], cfg["model"]) == ("openai", "gpt-5")
    assert cfg["run_count"] == 2, "only the two COMPLETED owner runs are samples"
    assert cfg["with_mean"] == 85.0, "running/other-user runs must NOT drag the mean"
    assert cfg["without_mean"] == 50.0
    assert cfg["delta"] == 35.0
    assert cfg["with_stddev"] is not None, "two runs → a numeric spread"


@pytest.mark.asyncio
async def test_aggregate_endpoint_cross_user_404():
    """T-133-01 (carried IDOR): a caller who does NOT own the skill gets 404 (never 403) — the
    owner gate fires FIRST, before any history is read."""
    from fastapi import HTTPException

    from app.api import evals

    skill_id = str(uuid4())
    sb = _FilterSupabase(_aggregate_store(skill_id))  # skill owned by OWNER

    with pytest.raises(HTTPException) as exc:
        await evals.get_eval_aggregate(skill_id, current_user=OTHER_USER, supabase=sb)
    assert exc.value.status_code == 404, "cross-user aggregate must 404, never 403"


@pytest.mark.asyncio
async def test_aggregate_endpoint_no_history_returns_empty():
    """A skill the caller owns but has never evaluated returns the honest EMPTY aggregate (200,
    ``{configs: []}``) — not a 404."""
    from app.api import evals

    skill_id = str(uuid4())
    sb = _FilterSupabase(
        {"skills": [{"id": skill_id, "name": "s", "description": "d", "user_id": OWNER["id"]}],
         "eval_runs": [], "eval_results": []}
    )

    result = await evals.get_eval_aggregate(skill_id, current_user=OWNER, supabase=sb)
    assert result == {"configs": []}

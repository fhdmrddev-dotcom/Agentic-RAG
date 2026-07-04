"""Phase 137.1 Plan 07 (EVAL-05) — deterministic per-config eval aggregation + fixed-phrasing
analyst notes (D-07 / D-08).

This is a PURE module: NO I/O, NO LLM, NO network, NO ``await``. The owner-scoped
``GET /skills/{skill_id}/evals/aggregate`` endpoint (``evals.py``) reads a skill's eval-run
HISTORY (owner-filtered, caller-scoped) and feeds the rows through ``aggregate_configs`` →
``analyst_notes`` → ``to_wire``. Keeping ALL the honesty math + phrasing in ONE testable place
is the RESEARCH-OQ4 decision (backend-computed keeps the honesty vocabulary server-authored and
unit-testable — the Studio renders the result verbatim, Plan 09).

HONESTY LOCKS — inherited VERBATIM from the shipped rollup denominator
(``eval_runner_service.py`` :825-828, the with-skill ``graded`` counting):

  * The mean / spread / delta count ONLY with-skill ``graded`` arms. A ``not_measured`` or
    ``judge_error`` arm is EXCLUDED from the numerator AND the denominator — it is NEVER
    counted as a fail (the same rule the rollup ``measured_count`` uses).
  * ``delta`` = with-skill mean judge score − without-skill mean judge score (the skill LIFT).
  * The spread SAMPLE UNIT is a RUN: each accumulated run of a config contributes ONE
    with-score (the mean of that run's with-skill graded verdict scores). ``with_stddev`` is
    therefore ``None`` until a config has ``>= 2`` such runs — a first run has no spread, so it
    carries the honest ``FIRST_RUN_MARKER`` ("first run — no spread yet") instead of a fake 0.0
    (D-07 / RESEARCH Pitfall 4 — never present one click as if it bought N repeats).

ANALYST NOTES (D-08) are DETERMINISTIC rules with FIXED plain-language phrasing and a stable
tag — NEVER an LLM-written paragraph. Each note is attributed to the exact ``(provider, model)``
config it concerns so it maps cleanly onto the shipped per-config ``EvalConfigAgg.analyst_notes``
wire array (Plan 01). The three rules:

  * ``non_discriminating``   — the skill flips NO case outcome for this config (with-arm and
                               without-arm reach the same verdict on every graded case): it adds
                               nothing measurable here.
  * ``flaky_variance``       — the config's with-skill score swings run-to-run
                               (``with_stddev >= FLAKY_STDDEV_THRESHOLD``): read a single run's
                               number with caution.
  * ``time_score_tradeoff``  — the config runs markedly slower than the fastest arm
                               (``>= SLOW_DURATION_RATIO`` × the fastest avg wall-clock) WITHOUT a
                               higher skill lift — a speed/score tradeoff worth surfacing.
"""
from __future__ import annotations

import statistics
from typing import Any

# ── Honesty vocabulary (the with-skill graded denominator + variant names, inherited from
#    eval_runner_service.py so aggregation counts EXACTLY what the rollup counts) ───────────
GRADED = "graded"
VARIANT_WITH = "with_skill"
VARIANT_WITHOUT = "without_skill"

# The honest first-run spread marker (D-07). Server-authored here (ONE place) so the Studio
# renders it verbatim instead of implying a single click bought repeated runs.
FIRST_RUN_MARKER = "first run — no spread yet"

# Deterministic rule thresholds — NAMED so a test pins the EXACT firing condition (T-137.1-A1:
# deterministic math only). The judge ``overall_score`` is an integer on a 0–100 scale.
FLAKY_STDDEV_THRESHOLD = 15.0   # >= 15 points of run-to-run swing on a 0–100 score = flaky
SLOW_DURATION_RATIO = 2.0       # >= 2× the fastest config's avg with-arm wall-clock = markedly slower

# Stable note tags (the wire carries only the message string; the tag is the deterministic id
# the tests assert on, and documents which rule fired).
TAG_NON_DISCRIMINATING = "non_discriminating"
TAG_FLAKY_VARIANCE = "flaky_variance"
TAG_TIME_SCORE = "time_score_tradeoff"


def _graded_with_scores(results: list[dict], variant: str) -> list[float]:
    """The ``verdict_score``s of the GRADED arms of one variant in one run — the honest
    denominator (a ``not_measured`` / ``judge_error`` arm, or a graded arm with a missing
    score, is excluded, NEVER counted as a 0/fail)."""
    return [
        r["verdict_score"]
        for r in results
        if r.get("variant") == variant
        and r.get("verdict_state") == GRADED
        and r.get("verdict_score") is not None
    ]


def _run_mean(results: list[dict], variant: str) -> float | None:
    """One run's mean judge score over its GRADED arms of a variant — ``None`` when the run
    produced no graded arm of that variant (so it contributes no sample, honestly)."""
    scores = _graded_with_scores(results, variant)
    return statistics.fmean(scores) if scores else None


def aggregate_configs(history: list[dict]) -> list[dict]:
    """Group the run HISTORY by ``(provider, model)`` and compute the honest per-config stats.

    ``history`` = a list of run rows, each ``{"provider", "model", "results": [<eval_results>]}``
    (the caller embeds each run's ``eval_results`` — Plan 04/07 interfaces). Each RUN contributes
    ONE with-score and ONE without-score (the mean of that run's with-/without-skill GRADED arms);
    a run with no graded with-skill arm contributes no with-sample.

    Returns one internal dict per config (sorted by provider, model for determinism):
      ``{provider, model, run_count, with_mean, without_mean, with_stddev, delta,
         avg_with_duration_ms}``
    where ``run_count`` = the number of runs that produced a with-skill graded sample (the samples
    backing the mean/stddev), ``with_stddev`` is ``None`` at ``run_count < 2`` (sample stddev over
    runs otherwise), ``delta`` = ``with_mean − without_mean``, and ``avg_with_duration_ms`` is the
    mean wall-clock of the with-skill graded arms (feeds the time-score note; not on the wire)."""
    groups: dict[tuple, list[dict]] = {}
    for run in history:
        key = (run.get("provider"), run.get("model"))
        groups.setdefault(key, []).append(run)

    configs: list[dict] = []
    for (provider, model), runs in groups.items():
        with_samples = [
            m for m in (_run_mean(r.get("results", []), VARIANT_WITH) for r in runs) if m is not None
        ]
        without_samples = [
            m for m in (_run_mean(r.get("results", []), VARIANT_WITHOUT) for r in runs) if m is not None
        ]

        with_mean = statistics.fmean(with_samples) if with_samples else 0.0
        without_mean = statistics.fmean(without_samples) if without_samples else 0.0
        # Spread only at >= 2 with-skill RUNS (D-07): sample stddev over the per-run with-scores.
        with_stddev = statistics.stdev(with_samples) if len(with_samples) >= 2 else None
        delta = with_mean - without_mean

        # Avg with-arm wall-clock (graded arms only) — the time-score note input (EVAL-05e).
        with_durations = [
            r["duration_ms"]
            for run in runs
            for r in run.get("results", [])
            if r.get("variant") == VARIANT_WITH
            and r.get("verdict_state") == GRADED
            and r.get("duration_ms") is not None
        ]
        avg_with_duration_ms = statistics.fmean(with_durations) if with_durations else None

        configs.append(
            {
                "provider": provider,
                "model": model,
                "run_count": len(with_samples),
                "with_mean": with_mean,
                "without_mean": without_mean,
                "with_stddev": with_stddev,
                "delta": delta,
                "avg_with_duration_ms": avg_with_duration_ms,
            }
        )

    configs.sort(key=lambda c: (str(c["provider"]), str(c["model"])))
    return configs


def analyst_notes(configs: list[dict], cases: list[dict]) -> list[dict]:
    """Deterministic D-08 analyst notes (fixed phrasing, stable tag, NEVER an LLM paragraph).

    ``configs`` = the ``aggregate_configs`` output. ``cases`` = the flat eval_results rows across
    the history (``{provider, model, test_case_id, eval_run_id, variant, verdict_state,
    verdict_passed}``) — the non-discriminating rule pairs the with/without arms WITHIN each run to
    detect whether the skill ever flipped a case outcome.

    Returns a flat list of ``{tag, provider, model, message}`` — each note attributed to its
    config so ``to_wire`` can attach it to that config's per-config wire array. Deterministic and
    side-effect-free."""
    notes: list[dict] = []

    # Index the GRADED per-case results by config (the non-discriminating input).
    graded = [
        c
        for c in cases
        if c.get("verdict_state") == GRADED and c.get("test_case_id") is not None
    ]
    by_config: dict[tuple, list[dict]] = {}
    for r in graded:
        by_config.setdefault((r.get("provider"), r.get("model")), []).append(r)

    # The group's fastest config (avg with-arm wall-clock) — the time-score baseline.
    timed = [c for c in configs if c.get("avg_with_duration_ms")]
    fastest_cfg = min(timed, key=lambda c: c["avg_with_duration_ms"]) if timed else None
    fastest_ms = fastest_cfg["avg_with_duration_ms"] if fastest_cfg is not None else None
    fastest_key = (fastest_cfg["provider"], fastest_cfg["model"]) if fastest_cfg is not None else None

    for cfg in configs:
        key = (cfg["provider"], cfg["model"])

        # (a) non_discriminating — the skill flipped NO case outcome: pair with/without arms within
        #     each run; fire when there is >= 1 both-arms-graded pair AND every such pair agrees.
        pairs: dict[tuple, dict] = {}
        for r in by_config.get(key, []):
            pk = (r.get("test_case_id"), r.get("eval_run_id"))
            slot = pairs.setdefault(pk, {})
            if r.get("variant") == VARIANT_WITH:
                slot["with"] = r.get("verdict_passed")
            elif r.get("variant") == VARIANT_WITHOUT:
                slot["without"] = r.get("verdict_passed")
        both = [p for p in pairs.values() if "with" in p and "without" in p]
        if both and all(p["with"] == p["without"] for p in both):
            notes.append(
                {
                    "tag": TAG_NON_DISCRIMINATING,
                    "provider": cfg["provider"],
                    "model": cfg["model"],
                    "message": (
                        "Non-discriminating: with-skill and without-skill reach the same verdict "
                        "on every graded case here — this config isn't exercising what the skill "
                        "changes."
                    ),
                }
            )

        # (b) flaky_variance — the with-skill score swings run-to-run (needs >= 2 runs).
        stddev = cfg.get("with_stddev")
        if stddev is not None and stddev >= FLAKY_STDDEV_THRESHOLD:
            notes.append(
                {
                    "tag": TAG_FLAKY_VARIANCE,
                    "provider": cfg["provider"],
                    "model": cfg["model"],
                    "message": (
                        f"Flaky variance: the with-skill judge score swings run-to-run "
                        f"(σ={round(stddev, 1)} ≥ {FLAKY_STDDEV_THRESHOLD:g}) — treat a single "
                        f"run's number with caution."
                    ),
                }
            )

        # (c) time_score_tradeoff — markedly slower than the fastest arm without a better lift.
        avg_ms = cfg.get("avg_with_duration_ms")
        if (
            fastest_ms is not None
            and avg_ms
            and key != fastest_key
            and avg_ms >= SLOW_DURATION_RATIO * fastest_ms
            and cfg["delta"] <= fastest_cfg["delta"]
        ):
            notes.append(
                {
                    "tag": TAG_TIME_SCORE,
                    "provider": cfg["provider"],
                    "model": cfg["model"],
                    "message": (
                        f"Time–score tradeoff: this config runs ~{round(avg_ms / fastest_ms, 1)}× "
                        f"slower than the fastest arm without a higher skill lift."
                    ),
                }
            )

    return notes


def to_wire(configs: list[dict], notes: list[dict]) -> dict[str, Any]:
    """Shape the internal configs + notes into the ``EvalAggregate`` wire dict (Plan 01 TS type):
    ``{"configs": [EvalConfigAgg...]}``.

    Per config: attach the messages of the notes attributed to it, then — for a config with no
    spread yet (``with_stddev is None``, i.e. ``run_count < 2``) — append the ``FIRST_RUN_MARKER``
    so the honest "first run — no spread yet" line is server-authored and travels on the wire
    (the wire ``with_stddev`` stays ``null``, never a fabricated 0.0). Means/stddev/delta are
    rounded to 2 dp for stable display. Pure shaping — no math, no re-derivation."""
    by_cfg: dict[tuple, list[str]] = {}
    for n in notes:
        by_cfg.setdefault((n["provider"], n["model"]), []).append(n["message"])

    wire_configs = []
    for c in configs:
        messages = list(by_cfg.get((c["provider"], c["model"]), []))
        if c["with_stddev"] is None:
            messages.append(FIRST_RUN_MARKER)
        wire_configs.append(
            {
                "provider": c["provider"],
                "model": c["model"],
                "run_count": c["run_count"],
                "with_mean": round(c["with_mean"], 2),
                "without_mean": round(c["without_mean"], 2),
                "with_stddev": round(c["with_stddev"], 2) if c["with_stddev"] is not None else None,
                "delta": round(c["delta"], 2),
                "analyst_notes": messages,
            }
        )
    return {"configs": wire_configs}

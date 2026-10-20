#!/usr/bin/env python3
"""Phase 294 Plan 02 — the decision-engine measurement CLI (SC#3, D-18, D-19).

Run it with the backend virtualenv, from the repository root, with local infra up::

    backend/venv/Scripts/python scripts/measure-decision-engines.py \\
        --heldout backend/tests/unit/fixtures/decision_heldout_v1.json \\
        --arms off,local,jev,openai_decisions --pool 20 --top-k 5 \\
        --json-out .planning/phases/294-decision-engine-rerank-and-citation-check/294-measurement.json \\
        --label 294-02

This file owns argument parsing, printing and the exit code, and **NO measurement logic** — every
number comes from ``app.services.decision_eval``.

⛔ **The exit code is the contract** (the ``measure-recall.py`` rule). A run either prints its
numbers with their configuration and returns 0, or prints a refusal to stderr, writes nothing and
returns 2. An arm that could not be measured (no key, an engine that fell back) is NOT a refusal
of the run: it is printed and written as UNMEASURED with its reason, and the other arms report.
No engine key is ever printed or written.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_ROOT = _REPO_ROOT / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.services.decision_eval import (  # noqa: E402  (path setup must precede the import)
    DEFAULT_ARMS,
    RecallUnmeasurable,
    run_decision_measurement,
)

_DEFAULT_HELDOUT = _BACKEND_ROOT / "tests" / "unit" / "fixtures" / "decision_heldout_v1.json"
# Query vectors are cached OUTSIDE the repository (they are derived data, and large).
_DEFAULT_VECTOR_CACHE = Path(tempfile.gettempdir()) / "agentic-rag-294-decision-vectors-v1.json"

_EXIT_OK = 0
_EXIT_UNMEASURABLE = 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="measure-decision-engines.py",
        description=(
            "Measure each rerank engine against rerank-off on the frozen held-out set, through the "
            "real search path. Refuses (exit 2, nothing written) rather than invent a number."
        ),
    )
    parser.add_argument("--heldout", type=Path, default=_DEFAULT_HELDOUT,
                        help="the frozen held-out set; its .sha256 sidecar must sit beside it")
    parser.add_argument("--arms", default=",".join(DEFAULT_ARMS),
                        help="comma-separated arms: off, local, jev, openai_decisions, cohere")
    parser.add_argument("--pool", type=int, default=20, help="candidate pool = rerank_top_n (default 20)")
    parser.add_argument("--top-k", type=int, default=5, help="retrieval_top_k (default 5)")
    parser.add_argument("--main-model", default=None, help="main model for the cost gate (default: llm_model)")
    parser.add_argument("--dsn", default=None,
                        help="optional: refuse unless it names the same database as POSTGRES_DSN")
    parser.add_argument("--vector-cache", type=Path, default=_DEFAULT_VECTOR_CACHE,
                        help="query-vector cache (outside the repository)")
    parser.add_argument("--local-warm-timeout", type=float, default=None,
                        help="seconds to wait for the local model to load (default: no limit)")
    parser.add_argument("--json-out", type=Path, default=None, help="where to write the JSON report")
    parser.add_argument("--label", default=None, help="a free-text label stored in the report")
    return parser


def _pct(value) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def _print_verdict(report: dict) -> None:
    held = report["heldout"]
    print("=" * 76)
    print("  decision-engine measurement (Phase 294, D-18 / D-19)")
    print(f"  held-out      {held.get('items')} items ({held.get('chunk_items')} chunk, "
          f"{held.get('probe_items')} probe)  sha256 {held.get('sha256')}")
    print(f"  pool / top_k  {report.get('pool')} / {report.get('top_k')}  (hybrid on)")
    print(f"  main model    {report.get('main_model')}  input ${report.get('main_rate_input_usd_per_million')} / 1M")
    print(f"  note          {report.get('cost_unit_note')}")
    print("-" * 76)
    off = report["arms"]["off"]
    print(f"  off           recall {_pct(off.get('recall'))}  mean chunks {off.get('mean_chunks')}")
    for arm, data in report["arms"].items():
        if arm == "off":
            continue
        if data.get("status") != "measured":
            print(f"  {arm:<13} UNMEASURED: {data.get('reason')}")
            continue
        cmp_ = report["comparisons"][arm]
        print(f"  {arm:<13} recall {_pct(cmp_['recall_arm'])} ({cmp_['recall_delta_pp']:+.1f} pp) "
              f"[{cmp_['recall_gate']}]  chunks {cmp_['mean_chunks_off']} -> {cmp_['mean_chunks_arm']} "
              f"[{cmp_['chunks_gate']}]")
        print(f"  {'':<13} cost [{cmp_['cost_gate']}]: {cmp_['cost_sentence']}")
        lat = cmp_["latency_ms"]
        print(f"  {'':<13} engine latency p50 {lat['p50']} ms  p95 {lat['p95']} ms")
        flips = cmp_["flips"]
        if flips:
            for flip in flips:
                print(f"  {'':<13} FLIP found -> absent: {flip['id']}  {flip['query']}")
        else:
            print(f"  {'':<13} flips: none")
    print("-" * 76)
    print(f"  wall time     {report['elapsed_seconds']}s")
    print("=" * 76)


def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:  # a captured stream in a test
        pass
    args = build_parser().parse_args(argv)
    arms = [arm.strip() for arm in args.arms.split(",") if arm.strip()]

    try:
        report = asyncio.run(
            run_decision_measurement(
                heldout=args.heldout,
                arms=arms,
                pool=args.pool,
                top_k=args.top_k,
                main_model=args.main_model,
                dsn=args.dsn,
                vector_cache=args.vector_cache,
                local_warm_timeout_s=args.local_warm_timeout,
            )
        )
    except RecallUnmeasurable as exc:
        # ⛔ THE REFUSAL BRANCH. Do not "simplify" this into the success path.
        #
        # The measure-recall.py rule, applied a fourth time: *could not measure* and *measured,
        # and it was fine* never share an exit code. So: stderr only, no metric line, no JSON
        # report, non-zero.
        print(f"[measure-decision-engines] REFUSED: {exc}", file=sys.stderr)
        print(
            "[measure-decision-engines] no number was produced and no report was written.",
            file=sys.stderr,
        )
        return _EXIT_UNMEASURABLE

    report["label"] = args.label
    report["measured_at"] = datetime.now(timezone.utc).isoformat()

    _print_verdict(report)

    if args.json_out is not None:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(report, indent=2, default=str) + "\n", encoding="utf-8")
        print(f"  report written to {args.json_out}")

    return _EXIT_OK


def _load_backend_env() -> None:
    """``app.config`` reads ``.env`` relative to the CWD, and this CLI runs from the repo root.

    Load ``backend/.env`` into the process environment (never overriding a variable already set)
    so the real search path sees the same configuration the backend does. Only when run as a
    script: importing this module in a test must not pull the operator's secrets into os.environ.
    """
    env_file = _BACKEND_ROOT / ".env"
    if env_file.is_file():
        from dotenv import load_dotenv

        load_dotenv(env_file, override=False)


if __name__ == "__main__":
    _load_backend_env()
    sys.exit(main())

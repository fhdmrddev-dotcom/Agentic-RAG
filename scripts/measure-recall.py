#!/usr/bin/env python3
"""Phase 241 Plan 01 — the recall measurement CLI. One script, one --dsn, local and cloud.

Run it with the backend virtualenv, from the repository root::

    backend/venv/Scripts/python scripts/measure-recall.py \\
        --dsn "$RECALL_DSN" --user-id <uuid> --label before --json-out reports/before.json

This file owns argument parsing, printing and the exit code, and **NO measurement logic** — every
number comes from ``app.services.recall_eval``, which is also the one home of ``EVAL_PROBES``.

What it replaces (241-CONTEXT F-1): a script that hardcoded a local DSN at module scope — making
SC#3 (a reproducible number on cloud) unsatisfiable by construction — that never touched the
vector path, that scored every un-found target as a top hit, and that on a connection failure
printed a synthetic benchmark and **returned 0**.

⛔ **The exit code is the contract.** A run either prints a number with its full configuration
attached and returns 0, or prints a refusal to stderr, writes nothing, and returns non-zero.
*Could not measure* and *measured, and it was fine* never share an exit code.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# scripts/<this file> -> parents[1] == repo root. Put backend/ on the path so the import below
# resolves when the script is invoked from the repository root.
_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_ROOT = _REPO_ROOT / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.services.recall_eval import (  # noqa: E402  (path setup must precede the import)
    DEFAULT_K,
    DEFAULT_QUERY_VECTOR_COUNT,
    EVAL_PROBES,
    ITERATIVE_SCAN_VALUES,
    RecallUnmeasurable,
    run_measurement,
)

# Where the probe query vectors live once embedded. Reusing them is what makes before/after and
# local/cloud comparable at all — a run that re-embedded would measure a different question.
_DEFAULT_PROBE_CACHE = (
    _REPO_ROOT / ".planning" / "phases" / "241-recall-at-corpus-scale" / "probe-vectors.json"
)

_EXIT_OK = 0
_EXIT_UNMEASURABLE = 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="measure-recall.py",
        description=(
            "Measure retrieval recall against a live database. Layer 1 compares the exact k-NN "
            "arm with the ANN arm under the SAME predicate; Layer 2 drives the evaluation probes "
            "and scores a miss as a miss."
        ),
    )
    parser.add_argument(
        "--dsn",
        required=True,
        help="Postgres connection string for the database to measure. REQUIRED, no default.",
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="The caller whose org and visibility the measurement runs under.",
    )
    parser.add_argument(
        "--layer",
        choices=("1", "2", "both"),
        default="both",
        help="1 = mechanical recall@k / underfill, 2 = the semantic probes, both = the default.",
    )
    parser.add_argument(
        "--k",
        type=int,
        default=DEFAULT_K,
        help=f"Candidates requested per query (default {DEFAULT_K}, matching hybrid_candidate_count).",
    )
    parser.add_argument(
        "--ef-search",
        type=int,
        default=None,
        help="hnsw.ef_search for the ANN arm. Omit to measure the server's own value.",
    )
    parser.add_argument(
        "--iterative-scan",
        choices=ITERATIVE_SCAN_VALUES,
        default=None,
        help="hnsw.iterative_scan for the ANN arm. Omit to measure the server's own value.",
    )
    parser.add_argument(
        "--query-vectors",
        type=int,
        default=DEFAULT_QUERY_VECTOR_COUNT,
        help=f"Layer 1 query-vector sample size (default {DEFAULT_QUERY_VECTOR_COUNT}).",
    )
    parser.add_argument(
        "--query-vector-seed",
        default="241",
        help="Seed for the Layer 1 sample, so two runs on one database draw the same vectors.",
    )
    parser.add_argument(
        "--probe-cache",
        type=Path,
        default=_DEFAULT_PROBE_CACHE,
        help="Layer 2 embedding cache. Built on first use, reused (and required) by every later run.",
    )
    parser.add_argument(
        "--label",
        default="unlabelled",
        help="Free-text tag written into the report so before/after runs are distinguishable.",
    )
    parser.add_argument(
        "--json-out",
        type=Path,
        default=None,
        help="Path for the machine-readable report. Written only on a successful measurement.",
    )
    return parser


def _layers(choice: str) -> tuple[str, ...]:
    return ("1", "2") if choice == "both" else (choice,)


def _print_verdict(report: dict) -> None:
    """The human half. The JSON report is the half you diff."""
    dsn = report["dsn"]
    server = report.get("server") or {}
    corpus = report.get("corpus") or {}

    print("=" * 72)
    print(f"Retrieval recall — label: {report['label']}")
    print("=" * 72)
    print(f"  measured at   {report['measured_at']}")
    print(f"  database      {dsn['host']}:{dsn['port']}/{dsn['database']}")
    print(f"  as user       {report['user_id']}")
    print(
        f"  server        PostgreSQL {server.get('postgresql_version')} · "
        f"pgvector {server.get('pgvector_version')}"
    )
    print(
        f"  live knobs    hnsw.ef_search={server.get('hnsw_ef_search')} · "
        f"hnsw.iterative_scan={server.get('hnsw_iterative_scan')}"
    )
    print(
        f"  requested     ef_search={report['requested']['ef_search']} · "
        f"iterative_scan={report['requested']['iterative_scan']}"
    )
    print(
        f"  corpus        {corpus.get('documents_visible')} documents "
        f"({corpus.get('documents_latest')} latest) · {corpus.get('chunks_visible')} chunks"
    )
    print(f"  k             {report['k']}  ·  threshold {report['match_threshold']}")

    layer1 = report.get("layer1")
    if layer1:
        print("-" * 72)
        print(
            f"Layer 1 — exact k-NN vs ANN under the SAME predicate "
            f"({layer1['query_vector_sample']} query vectors, seed {layer1['query_vector_seed']})"
        )
        for shape in layer1["shapes"]:
            if shape.get("skipped"):
                print(f"  {shape['shape']:<14} SKIPPED — {shape['skipped']}")
                continue
            recall = shape["recall_at_k"]
            underfill = shape["underfill"]
            recall_text = "UNMEASURED" if recall is None else f"{recall:.3f}"
            underfill_text = "n/a" if underfill is None else f"{underfill:.3f}"
            print(
                f"  {shape['shape']:<14} recall@{shape['k']} {recall_text}"
                f"   underfill {underfill_text}"
                f"   ({shape['scored_vectors']}/{shape['query_vectors']} vectors scored,"
                f" {shape['elapsed_seconds']}s)"
            )
            if shape.get("reason"):
                print(f"  {'':<14} {shape['reason']}")

    layer2 = report.get("layer2")
    if layer2:
        print("-" * 72)
        print(f"Layer 2 — the evaluation probes at k={layer2['k']}")
        for probe in layer2["probes"]:
            if probe.get("excluded"):
                position = "ABSENT"
            elif probe["rank"] is None:
                # ⭐ The token the old harness could never print. A miss is a miss.
                position = "MISS"
            else:
                position = f"#{probe['rank']}"
            print(f"  {position:<8} {probe['target_filename']}")
        if layer2["target_missing"]:
            print(
                f"  {len(layer2['target_missing'])} probe target(s) are not in this database and "
                "are EXCLUDED from the metric, not scored as misses:"
            )
            for filename in layer2["target_missing"]:
                print(f"    - {filename}")
        metrics = layer2["metrics"]
        print(
            f"  {layer2['scored_probes']} probes scored  ·  "
            f"Hit@1 {metrics['hit_at_1']:.2f}  ·  Hit@3 {metrics['hit_at_3']:.2f}  ·  "
            f"Hit@5 {metrics['hit_at_5']:.2f}  ·  MRR {metrics['mrr']:.3f}"
        )

    print("-" * 72)
    print(f"  wall time     {report['elapsed_seconds']}s")
    print("=" * 72)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    try:
        report = asyncio.run(
            run_measurement(
                dsn=args.dsn,
                user_id=args.user_id,
                layers=_layers(args.layer),
                k=args.k,
                ef_search=args.ef_search,
                iterative_scan=args.iterative_scan,
                query_vector_count=args.query_vectors,
                query_vector_seed=args.query_vector_seed,
                probes=tuple(EVAL_PROBES),
                probe_cache=args.probe_cache,
            )
        )
    except RecallUnmeasurable as exc:
        # ⛔ THE REFUSAL BRANCH. Do not "simplify" this into the success path.
        #
        # This is the THIRD application of a rule this codebase already holds twice:
        # ``retrieval_unavailable`` (backend/app/services/tool_dispatcher.py) and Phase 193.1's
        # ``resolve_template_placeholders``. In both, *could not read* and *nothing to read* are
        # deliberately different messages with different consequences. Here the same distinction
        # is carried by the EXIT CODE: a caller that cannot tell "the database was unreachable"
        # from "recall is perfect" will eventually quote the second when the first was true —
        # which is exactly what the Phase 230 harness did, for the whole of its life.
        #
        # So: stderr only, no metric line, no JSON report, non-zero.
        print(f"[measure-recall] REFUSED: {exc}", file=sys.stderr)
        print(
            "[measure-recall] no number was produced and no report was written.",
            file=sys.stderr,
        )
        return _EXIT_UNMEASURABLE

    report["label"] = args.label
    report["measured_at"] = datetime.now(timezone.utc).isoformat()

    _print_verdict(report)

    if args.json_out is not None:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
        print(f"  report written to {args.json_out}")

    return _EXIT_OK


if __name__ == "__main__":
    sys.exit(main())

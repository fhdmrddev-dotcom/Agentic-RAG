"""Phase 305-04 (GUARD-03; D-38; T-305-11 / T-305-34) — measure the PII redactor on the REAL local
corpus. READ-ONLY: SELECT statements only, nothing is written to the database.

Run with the backend venv from the repo root:

    backend/venv/Scripts/python scripts/measure-redaction.py
    backend/venv/Scripts/python scripts/measure-redaction.py --sample 30 --samples-out <file outside the repo>
    backend/venv/Scripts/python scripts/measure-redaction.py --labels <file outside the repo>

It runs ``DeterministicRedactor.spans`` over every ``document_chunks.content`` (what a search
passage carries) and over every latest ``documents.full_markdown`` cut into ``read_document``
chunks with their 128-character overlap window (what a read carries), and prints, per recognizer:
raw candidates (the candidate pattern alone), validated hits, chunks hit — and the per-chunk
latency p50 / p95 / p99 / max.

⛔ **AGGREGATES ONLY on stdout** — counts, rates and timings, never a matched value. Only stdout is
meant to be committed (``evidence/redaction-measurement.txt``).

``--sample N --samples-out PATH`` writes up to N hits per recognizer to a LOCAL JSON file that must
be OUTSIDE the repository (the script refuses a path inside it): it may describe real personal
data. Each sample shows the match as a SHAPE (letters -> a / A, digits -> 9, punctuation kept) and
±32 characters of context with digits turned to 9 and every other match masked, so a human can
label it TP or FP without the value itself being displayed. ``--labels PATH`` reads
``{sample_id: {"kind": ..., "label": "TP" | "FP"}}`` (also kept outside the repo) and prints the false-positive rate per
recognizer; the run exits 1 when any labelled recognizer is over 20 % (D-38).

Exit codes: 0 measured · 1 a labelled FP rate over 20 % · 2 harness error (database unreachable,
bad arguments).
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import pathlib
import statistics
import sys
import time
from collections import defaultdict

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

FP_CEILING = 0.20
CONTEXT = 32
KINDS = ("email", "phone", "card", "iban", "secret")


def _shape(value: str, limit: int = 60) -> str:
    out = []
    for ch in value[:limit]:
        if ch.isdigit():
            out.append("9")
        elif ch.isalpha():
            out.append("A" if ch.isupper() else "a")
        else:
            out.append(ch)
    return "".join(out) + ("…" if len(value) > limit else "")


def _raw_candidates(text: str, R) -> dict[str, int]:
    """How often each recognizer's CANDIDATE pattern fires, before any validator."""
    counts = {
        "email": sum(1 for _ in R._EMAIL.finditer(text)),
        "iban": sum(1 for _ in R._IBAN_START.finditer(text)),
        "card": sum(1 for m in R._DIGIT_RUN.finditer(text)
                    if sum(c.isdigit() for c in m.group(0)) >= 13),
        "phone": sum(1 for _ in R._PHONE_INTL.finditer(text))
        + sum(1 for rx in R._PHONE_NATIONAL for _ in rx.finditer(text)),
        "secret": sum(1 for rx in R._SECRET_PATTERNS for _ in rx.finditer(text))
        + sum(1 for _ in R._TOKEN.finditer(text)),
    }
    return counts


def _pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, int(round(q * (len(ordered) - 1)))))
    return ordered[idx]


async def _measure(args) -> int:
    import asyncpg

    os.chdir(REPO_ROOT / "backend")
    from app.config import settings
    from app.mcp import results
    from app.services import pii_redactor as R

    redactor = R.DeterministicRedactor()
    try:
        conn = await asyncpg.connect(settings.postgres_dsn, timeout=10)
    except Exception as exc:  # noqa: BLE001
        print(f"harness error: cannot reach the database ({type(exc).__name__})")
        return 2
    try:
        await conn.execute("SET default_transaction_read_only = on")
        chunk_rows = await conn.fetch("SELECT id, content FROM public.document_chunks WHERE content IS NOT NULL")
        doc_rows = await conn.fetch(
            "SELECT id, full_markdown FROM public.documents "
            "WHERE is_latest AND full_markdown IS NOT NULL AND full_markdown <> ''"
        )
    finally:
        await conn.close()

    units: list[tuple[str, str, str, tuple[str, str] | None]] = []  # (source, unit id, text, window)
    for r in chunk_rows:
        units.append(("search", str(r["id"]), r["content"], None))
    for r in doc_rows:
        text, start = r["full_markdown"], 0
        while start < len(text):
            piece, end = results.chunk(text, start)
            if end <= start:
                break
            units.append(("read", f"{r['id']}:{start}", piece, results.window_around(text, start, end)))
            start = end

    raw = defaultdict(int)
    hits = defaultdict(int)
    units_hit = {k: defaultdict(set) for k in ("search", "read")}
    latency = {"search": [], "read": []}
    samples: dict[str, list[dict]] = defaultdict(list)

    for source, unit_id, text, window in units:
        before, after = window if window else ("", "")
        full = before + text + after
        t0 = time.perf_counter()
        spans = redactor.spans(full)
        latency[source].append((time.perf_counter() - t0) * 1000.0)
        for kind, n in _raw_candidates(full, R).items():
            raw[(source, kind)] += n
        lo, hi = len(before), len(before) + len(text)
        labelled = [(k, s, e) for k, s, e in redactor.labelled_spans(full) if s < hi and e > lo]
        for kind, s, e in labelled:
            hits[(source, kind)] += 1
            units_hit[source][kind].add(unit_id)
            if args.sample and len(samples[kind]) < args.sample and source == "search":
                others = [sp for sp in spans if not (sp.start == s and sp.end == e)]
                ctx_lo, ctx_hi = max(0, s - CONTEXT), min(len(full), e + CONTEXT)
                left = _shape_digits(full[ctx_lo:s], others, ctx_lo, R)
                right = _shape_digits(full[e:ctx_hi], others, e, R)
                sid = hashlib.sha1(f"{unit_id}:{s}:{e}".encode()).hexdigest()[:12]
                samples[kind].append({"id": sid, "kind": kind, "shape": _shape(full[s:e]),
                                      "context": f"{left}⟦{_shape(full[s:e])}⟧{right}"})

    n_search, n_read = len(latency["search"]), len(latency["read"])
    chars = sum(len(u[2]) for u in units)
    print("Phase 305-04 — PII redactor measurement (deterministic-v1), local corpus, read-only")
    print(f"units: {n_search} search chunks (document_chunks.content) + {n_read} read chunks "
          f"(latest full_markdown, 8,000-char chunks + 128-char window); {chars:,} chars")
    print()
    print(f"{'source':<7} {'recognizer':<10} {'raw candidates':>15} {'validated hits':>15} {'units hit':>10}")
    for source in ("search", "read"):
        for kind in KINDS:
            print(f"{source:<7} {kind:<10} {raw[(source, kind)]:>15} {hits[(source, kind)]:>15} "
                  f"{len(units_hit[source][kind]):>10}")
    print()
    print("latency per unit (ms), spans() over the unit incl. its window:")
    for source in ("search", "read"):
        vals = latency[source]
        if vals:
            print(f"  {source:<7} p50 {_pct(vals, .50):.3f}  p95 {_pct(vals, .95):.3f}  "
                  f"p99 {_pct(vals, .99):.3f}  max {max(vals):.3f}  mean {statistics.fmean(vals):.3f}")

    if args.sample:
        out = pathlib.Path(args.samples_out).resolve()
        if REPO_ROOT.resolve() in out.parents or out == REPO_ROOT.resolve():
            print("harness error: --samples-out must be OUTSIDE the repository (it may describe real PII)")
            return 2
        out.write_text(json.dumps(samples, indent=1, ensure_ascii=False), encoding="utf-8")
        print()
        print(f"samples: {sum(len(v) for v in samples.values())} written outside the repo "
              f"({', '.join(f'{k} {len(v)}' for k, v in sorted(samples.items()))})")

    rc = 0
    if args.labels:
        path = pathlib.Path(args.labels).resolve()
        if REPO_ROOT.resolve() in path.parents:
            print("harness error: --labels must be OUTSIDE the repository")
            return 2
        labels = json.loads(path.read_text(encoding="utf-8"))
        by_kind: dict[str, list[str]] = defaultdict(list)
        for entry in labels.values():
            by_kind[entry["kind"]].append(entry["label"])
        print()
        print(f"labelled false-positive rate (ceiling {FP_CEILING:.0%}):")
        for kind in KINDS:
            vals = by_kind.get(kind, [])
            if not vals:
                print(f"  {kind:<7} no labelled samples")
                continue
            fp = sum(1 for v in vals if v == "FP")
            rate = fp / len(vals)
            flag = "OVER" if rate > FP_CEILING else "ok"
            print(f"  {kind:<7} {fp}/{len(vals)} FP = {rate:.1%}  [{flag}]")
            if rate > FP_CEILING:
                rc = 1
    return rc


def _shape_digits(text: str, spans, offset: int, R) -> str:
    """Context with every OTHER match masked — including one the context edge cuts in half — and
    the remaining digits turned to 9."""
    hi = offset + len(text)
    local = [R.Span(max(s.start, offset) - offset, min(s.end, hi) - offset, s.mask) for s in spans
             if s.start < hi and s.end > offset]
    masked = R.apply(text, local)
    return "".join("9" if c.isdigit() else c for c in masked).replace("\n", " ")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--sample", type=int, default=0, help="hits per recognizer to write as samples")
    ap.add_argument("--samples-out", default=None, help="sample file, OUTSIDE the repository")
    ap.add_argument("--labels", default=None, help="labels JSON, OUTSIDE the repository")
    args = ap.parse_args()
    if args.sample and not args.samples_out:
        print("harness error: --sample needs --samples-out")
        return 2
    return asyncio.run(_measure(args))


if __name__ == "__main__":
    sys.exit(main())

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

``--sample N --samples-out PATH`` writes up to N hits per recognizer — a RANDOM sample drawn with
``--seed`` from the search hits (rows read ``ORDER BY id``, so one seed draws one sample), not the
first N — to a LOCAL JSON file that must be OUTSIDE the repository (the script refuses a path
inside it): it may describe real personal data. Each sample shows the match as a SHAPE (letters ->
a / A, digits -> 9, punctuation kept) and ±32 characters of context with digits turned to 9 and
every other match masked, so a human can label it TP or FP without the value itself being
displayed. ⚠ The context keeps its LETTERS verbatim (a name or a street can sit there): delete the
file once it is labelled. ``--labels PATH`` reads ``{sample_id: {"kind": ..., "label": "TP" |
"FP"}}`` (also kept outside the repo) and prints the false-positive rate per recognizer; the run
exits 1 when any labelled recognizer is over 20 % (D-38).

**The recall arm** (``--recall K``, default 200; 305-REVIEW-04 WR-04-03). Precision alone cannot
see a miss, so K synthetic values per template — fabricated by this script, never read from the
corpus — are planted at a random word boundary of a random REAL search chunk, with the neighbours
that used to hide them (an expiry, a CVV, a quantity, a VAT id, slashes in a base64 key), and each
must come back covered by its own mask. It prints counts per template and per recognizer; a gated
template under ``RECALL_FLOOR`` (95 %) exits 1. Rows marked "residual, not gated" are known,
stated gaps (lowercase IBANs, IN-04-02), measured so they stay visible.

Exit codes: 0 measured · 1 a labelled FP rate over 20 % or a gated recall under 95 % · 2 harness
error (database unreachable, bad arguments).
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import pathlib
import random
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


# ── the recall arm (305-REVIEW-04 WR-04-03) ──────────────────────────────────────────────────
#
# Precision alone cannot see a miss: a value the recognizers never matched is in no sample. So
# synthetic values of every category — fabricated here, never read from the corpus — are planted
# at a random word boundary of a randomly chosen REAL search chunk, with the neighbours that hid
# them before (an expiry, a CVV, a quantity, a VAT id, slashes), and the planted value must come
# back covered by its own mask. Only counts are printed.

_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
_B62 = _B64[:62]
RECALL_FLOOR = 0.95


def _luhn_complete(body: str) -> str:
    for d in "0123456789":
        total = 0
        for i, ch in enumerate(reversed(body + d)):
            v = int(ch) * (2 if i % 2 else 1)
            total += v - 9 if v > 9 else v
        if total % 10 == 0:
            return body + d
    raise AssertionError("unreachable")


def _card(rng, prefix: str, length: int) -> str:
    body = prefix + "".join(rng.choice("0123456789") for _ in range(length - len(prefix) - 1))
    return _luhn_complete(body)


def _grouped(digits: str, sizes: tuple[int, ...], sep: str = " ") -> str:
    out, at = [], 0
    for n in sizes:
        out.append(digits[at:at + n])
        at += n
    return sep.join(out)


def _iban(rng, country: str, bban: str) -> str:
    numeric = "".join(str(int(c, 36)) for c in bban + country + "00")
    check = 98 - int(numeric) % 97
    return f"{country}{check:02d}{bban}"


def _digits(rng, n: int) -> str:
    return "".join(rng.choice("0123456789") for _ in range(n))


def _templates():
    """``(template, recognizer, gated, make(rng) -> (snippet, value))``; ``value`` sits in
    ``snippet`` exactly once. ``gated=False`` rows are known, stated residuals (never a gate)."""
    def visa(rng):
        return _card(rng, "4", 16)

    def g4(d):
        return _grouped(d, (4, 4, 4, 4))

    def amex(rng):
        return _grouped(_card(rng, rng.choice(("34", "37")), 15), (4, 6, 5))

    def de_iban(rng):
        return _iban(rng, "DE", _digits(rng, 18))

    def gb_iban(rng):
        bank = "".join(rng.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(4))
        return _iban(rng, "GB", bank + _digits(rng, 14))

    def spaced(iban):
        return " ".join(iban[i:i + 4] for i in range(0, len(iban), 4))

    def b64(rng, n=40, alphabet=_B64):
        return "".join(rng.choice(alphabet) for _ in range(n))

    def b64_slashed(rng):
        k = list(b64(rng, 40, _B62))
        for at in rng.sample(range(1, 39), 2):
            k[at] = "/"
        return "".join(k)

    def jwt(rng):
        return f"eyJ{b64(rng, 20, _B62)}.eyJ{b64(rng, 30, _B62)}.{b64(rng, 43, _B62)}"

    def same(v):
        return v, v

    def wrap(fmt):
        return lambda v: (fmt.format(v=v), v)

    rows = [
        ("email plain", "email", True, lambda r: same(f"{b64(r, 8, _B62[26:52])}.{b64(r, 5, _B62[26:52])}@example.com")),
        ("phone international +", "phone", True, lambda r: same(f"+44 20 {_digits(r, 4)} {_digits(r, 4)}")),
        ("phone international 00", "phone", True, lambda r: same(f"0049 30 {_digits(r, 7)}")),
        ("phone national + keyword", "phone", True, lambda r: wrap("tel: {v}")(f"020 {_digits(r, 4)} {_digits(r, 4)}")),
        ("card grouped", "card", True, lambda r: same(g4(visa(r)))),
        ("card + expiry", "card", True, lambda r: wrap("Card {v} 12/26")(g4(visa(r)))),
        ("card + CVV (dashed)", "card", True, lambda r: wrap("card: {v}-" + _digits(r, 3))(_grouped(visa(r), (4, 4, 4, 4), "-"))),
        ("card amex + expiry", "card", True, lambda r: wrap("Amex {v} 0425")(amex(r))),
        ("card after quantity", "card", True, lambda r: wrap("Qty 2 {v}")(g4(visa(r)))),
        ("card after year", "card", True, lambda r: wrap("Order 2024 {v} paid")(g4(visa(r)))),
        ("card ungrouped + keyword", "card", True, lambda r: wrap("credit card {v}")(_card(r, "51", 16))),
        ("iban grouped", "iban", True, lambda r: same(spaced(gb_iban(r)))),
        ("iban compact", "iban", True, lambda r: same(de_iban(r))),
        ("iban after VAT id", "iban", True, lambda r: wrap("VAT GB" + _digits(r, 9) + " IBAN {v}")(spaced(gb_iban(r)))),
        ("iban after unknown-country token", "iban", True, lambda r: wrap("Ref AB12 {v} thanks")(spaced(de_iban(r)))),
        ("secret key prefix (sk-proj-)", "secret", True, lambda r: same("sk-" + "proj-" + b64(r, 32, _B62))),
        ("secret JWT", "secret", True, lambda r: wrap("Bearer {v}")(jwt(r))),
        ("secret entropy token", "secret", True, lambda r: wrap("session {v} expires")(b64(r, 40, _B62))),
        ("secret base64 + keyword", "secret", True, lambda r: wrap("aws_secret_access_key = {v}")(b64(r))),
        ("secret base64 two slashes, bare", "secret", True, lambda r: same(b64_slashed(r))),
        ("iban lowercase (IN-04-02, residual)", "iban", False, lambda r: wrap("iban: {v}")(spaced(de_iban(r)).lower())),
    ]
    return rows


def _recall(units_text: list[str], R, redactor, per_template: int, seed: int):
    """Plant ``per_template`` values of each template into random real chunks; count misses."""
    import random

    rng = random.Random(seed)
    units_text = [t for t in units_text if len(t) < R.MAX_INPUT - 1000] or [""]
    results = []
    for name, kind, gated, make in _templates():
        caught = 0
        for _ in range(per_template):
            snippet, value = make(rng)
            host = rng.choice(units_text)
            cuts = [i for i, c in enumerate(host) if c.isspace()] or [0]
            at = rng.choice(cuts)
            text = f"{host[:at]} {snippet} {host[at:]}"
            vs = at + 1 + snippet.index(value)
            ve = vs + len(value)
            covered = [False] * (ve - vs)
            for s in redactor.spans(text):
                if s.mask != R.MASKS[kind]:
                    continue
                for i in range(max(s.start, vs), min(s.end, ve)):
                    covered[i - vs] = True
            caught += all(covered)
        results.append((name, kind, gated, per_template, caught))
    return results


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
        # ORDER BY id so a seed always draws the same sample from the same corpus.
        chunk_rows = await conn.fetch(
            "SELECT id, content FROM public.document_chunks WHERE content IS NOT NULL ORDER BY id"
        )
        doc_rows = await conn.fetch(
            "SELECT id, full_markdown FROM public.documents "
            "WHERE is_latest AND full_markdown IS NOT NULL AND full_markdown <> '' ORDER BY id"
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
    hit_refs: dict[str, list[tuple[int, int, int]]] = defaultdict(list)  # kind -> (unit, s, e)

    for u, (source, unit_id, text, window) in enumerate(units):
        before, after = window if window else ("", "")
        full = before + text + after
        t0 = time.perf_counter()
        redactor.spans(full)
        latency[source].append((time.perf_counter() - t0) * 1000.0)
        for kind, n in _raw_candidates(full, R).items():
            raw[(source, kind)] += n
        lo, hi = len(before), len(before) + len(text)
        labelled = [(k, s, e) for k, s, e in redactor.labelled_spans(full) if s < hi and e > lo]
        for kind, s, e in labelled:
            hits[(source, kind)] += 1
            units_hit[source][kind].add(unit_id)
            if source == "search":
                hit_refs[kind].append((u, s, e))

    if args.sample:
        # A seeded RANDOM sample of the search hits (305-REVIEW-04 WR-04-03), not the first N.
        rng = random.Random(args.seed)
        for kind in KINDS:
            refs = hit_refs.get(kind, [])
            for u, s, e in sorted(rng.sample(refs, min(args.sample, len(refs)))):
                _source, unit_id, text, _window = units[u]
                full = text  # search units carry no window
                others = [sp for sp in redactor.spans(full) if not (sp.start == s and sp.end == e)]
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

    rc = 0
    if args.recall:
        planted = _recall([u[2] for u in units if u[0] == "search"], R, redactor, args.recall, args.seed)
        print()
        print(f"recall on planted synthetic values ({args.recall} per template, seed {args.seed}; "
              f"floor {RECALL_FLOOR:.0%} per gated template):")
        recall_by_kind: dict[str, list[int]] = defaultdict(lambda: [0, 0])
        for name, kind, gated, n, caught in planted:
            rate = caught / n
            flag = ("ok" if rate >= RECALL_FLOOR else "BELOW") if gated else "residual, not gated"
            print(f"  {kind:<7} {name:<38} {caught:>5}/{n:<5} {rate:7.1%}  [{flag}]")
            if gated:
                recall_by_kind[kind][0] += caught
                recall_by_kind[kind][1] += n
                if rate < RECALL_FLOOR:
                    rc = 1
        print("  per recognizer (gated templates): " + " · ".join(
            f"{k} {c}/{n} = {c / n:.1%}" for k, (c, n) in recall_by_kind.items()))

    if args.sample:
        out = pathlib.Path(args.samples_out).resolve()
        if REPO_ROOT.resolve() in out.parents or out == REPO_ROOT.resolve():
            print("harness error: --samples-out must be OUTSIDE the repository (it may describe real PII)")
            return 2
        out.write_text(json.dumps(samples, indent=1, ensure_ascii=False), encoding="utf-8")
        print()
        print(f"samples: {sum(len(v) for v in samples.values())} written outside the repo "
              f"({', '.join(f'{k} {len(v)}' for k, v in sorted(samples.items()))}); the context keeps "
              f"its LETTERS verbatim — delete the file once it is labelled")

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
    ap.add_argument("--seed", type=int, default=305, help="seed for the sample and the recall arm")
    ap.add_argument("--recall", type=int, default=200,
                    help="synthetic values planted per recall template (0 = skip the recall arm)")
    args = ap.parse_args()
    if args.sample and not args.samples_out:
        print("harness error: --sample needs --samples-out")
        return 2
    return asyncio.run(_measure(args))


if __name__ == "__main__":
    sys.exit(main())

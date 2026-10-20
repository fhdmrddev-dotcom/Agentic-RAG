"""Option-order probe for the citation check (Phase 294-03, assumption A2, VALIDATION row C7).

One community post reports that OpenAI's ``choice`` probabilities move by up to 15 points with
option order while the selected option holds. The check does not trust that: every production
call offers the labels in the canonical ``CHOICE_LABELS`` order, and this probe measures whether
order can move a VERDICT on a real stored check.

For ``--message-id`` (an assistant message that already has a stored check), it rebuilds the
engine request for the first checked source and asks it FRESH, in ONE run, in canonical and in
reversed order, ``--repeats`` times each (default 2, minimum 2), INTERLEAVED (canonical,
reversed, canonical, reversed, …) so drift over time cannot masquerade as order bias. Per claim:

  * CONSISTENT-FLIP — every canonical answer agrees, every reversed answer agrees, and they differ.
  * UNSTABLE        — an order disagrees with itself. Reported; it is noise, not a flip.
  * STABLE          — every answer agrees.

The stored check row is NEVER used as the canonical answer and NEVER written.

Exit codes: 0 no claim is a consistent flip · 1 any claim is · 2 the probe cannot run (no stored
check, engine unavailable, an engine call failed, fewer than 2 repeats).

⛔ The DSN is hard-coded to 127.0.0.1 (the apply-script rule): this reads the LOCAL DB only.
⚠ It makes real engine calls with the configured key (2 × repeats requests, a fraction of a cent).

Run: backend/venv/Scripts/python scripts/citation-order-probe.py --message-id <uuid> [--repeats 2]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# scripts/<this file> -> parents[1] == repo root.
_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_ROOT = _REPO_ROOT / "backend"

CONSISTENT_FLIP = "CONSISTENT-FLIP"
UNSTABLE = "UNSTABLE"
STABLE = "STABLE"

_READ_SQL = """
    SELECT m.id::text AS id, m.role, m.content, m.source_refs, c.result
    FROM public.messages m
    JOIN public.message_citation_checks c ON c.message_id = m.id
    WHERE m.id = $1
"""


# ── pure classification (unit-tested) ─────────────────────────────────────────────────────────

def classify_claim(canonical: list, reversed_: list) -> str:
    """Classify one claim from its canonical-order and reversed-order answers (verdict strings)."""
    if len(set(canonical)) > 1 or len(set(reversed_)) > 1:
        return UNSTABLE
    if canonical and reversed_ and canonical[0] != reversed_[0]:
        return CONSISTENT_FLIP
    return STABLE


def exit_code_for(classes: list[str]) -> int:
    return 1 if CONSISTENT_FLIP in classes else 0


def ask_schedule(repeats: int) -> list[str]:
    """Interleaved order of asks: canonical, reversed, canonical, reversed, …"""
    return ["canonical", "reversed"] * repeats


# ── CLI ───────────────────────────────────────────────────────────────────────────────────────

def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--message-id", required=True, help="assistant message with a stored check (uuid)")
    ap.add_argument("--repeats", type=int, default=2,
                    help="asks per order, interleaved (default 2, minimum 2)")
    args = ap.parse_args(argv)
    if args.repeats < 2:
        ap.error("--repeats must be at least 2 (one answer per order cannot show self-disagreement)")
    try:
        uuid.UUID(args.message_id)
    except ValueError:
        ap.error("--message-id must be a uuid")
    return args


async def _read(message_id: str):
    import asyncpg

    conn = await asyncpg.connect(DSN)
    try:
        async with conn.transaction(readonly=True):
            return await conn.fetchrow(_READ_SQL, uuid.UUID(message_id))
    finally:
        await conn.close()


def _jsonish(v):
    return json.loads(v) if isinstance(v, str) else v


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    # The backend reads backend/.env relative to the working directory (pydantic-settings).
    if str(_BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(_BACKEND_ROOT))
    os.chdir(_BACKEND_ROOT)
    from app.models.citation_check import CHOICE_LABELS
    from app.models.user_settings import load_app_settings_async
    from app.services.citation_check_service import ask, build_check_request, claim_id
    from app.services.citation_claims import extract_claims
    from app.services.rerank_engines import (
        citation_check_availability,
        get_engine,
        resolve_credentials,
        resolve_model,
    )

    row = asyncio.run(_read(args.message_id))
    if row is None:
        print(f"CANNOT RUN: message {args.message_id} has no stored citation check in the local DB")
        return 2
    settings = asyncio.run(load_app_settings_async())
    availability = citation_check_availability(settings)
    if not availability.available:
        print(f"CANNOT RUN: the citation check is unavailable ({availability.reason})")
        return 2
    spec = get_engine(availability.engine)
    api_key = resolve_credentials(spec, settings)
    model = resolve_model(spec, getattr(settings, "rerank_model", None))

    claims = extract_claims(row["content"] or "", _jsonish(row["source_refs"]) or [])
    stored = {c["ordinal"]: c["verdict"] for c in (_jsonish(row["result"]) or {}).get("claims", [])}
    checkable = [c for c in claims if not c.no_passage and not c.over_cap]
    source_n = next((c.n for c in checkable if stored.get(c.ordinal) not in (None, "couldnt_check")),
                    checkable[0].n if checkable else None)
    if source_n is None:
        print("CANNOT RUN: no claim in this message has a source passage to check")
        return 2
    group = [c for c in checkable if c.n == source_n]
    by_id = {claim_id(c): c.sentence for c in group}
    requests = {
        "canonical": build_check_request(spec.id, group[0].passage or "", by_id),
        "reversed": build_check_request(spec.id, group[0].passage or "", by_id,
                                        choice_order=tuple(reversed(CHOICE_LABELS))),
    }

    print(f"engine {spec.id} · model {model} · source [{source_n}] · {len(group)} claim(s) · "
          f"repeats {args.repeats} per order, interleaved")
    answers: dict[str, dict[str, list]] = {"canonical": {}, "reversed": {}}
    failed = False
    for i, order in enumerate(ask_schedule(args.repeats), start=1):
        try:
            mapped = ask(spec.id, api_key, model, requests[order])
        except Exception as exc:  # noqa: BLE001 — reported by type only, never str(exc)
            print(f"  ask {i} ({order}) FAILED: {type(exc).__name__}")
            failed = True
            continue
        for cid, verdict in mapped.items():
            answers[order].setdefault(cid, []).append(verdict)

    classes = []
    for c in group:
        cid = claim_id(c)
        canon = answers["canonical"].get(cid, [])
        rev = answers["reversed"].get(cid, [])
        cls = classify_claim([v for v, _ in canon], [v for v, _ in rev])
        classes.append(cls)
        fmt = lambda xs: ", ".join(f"{v}@{'-' if p is None else round(p, 3)}" for v, p in xs)  # noqa: E731
        print(f"\n{cid} [{c.n}] {cls}  (stored, reference only: {stored.get(c.ordinal)})")
        print(f"  claim     : {c.sentence[:120]}")
        print(f"  canonical : {fmt(canon)}")
        print(f"  reversed  : {fmt(rev)}")
    if failed:
        print("\nCANNOT RUN: at least one engine call failed, so the comparison is incomplete")
        return 2
    code = exit_code_for(classes)
    print(f"\n{'FAIL — a verdict flips with option order (C7)' if code else 'PASS — no consistent flip'}: "
          f"{classes.count(CONSISTENT_FLIP)} flip · {classes.count(UNSTABLE)} unstable · "
          f"{classes.count(STABLE)} stable")
    return code


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())

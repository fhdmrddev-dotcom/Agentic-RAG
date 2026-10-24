"""Local apply script for Phase 292 Plan 01 -- migration 213 (message_artifacts: six components).

MODES (exactly one; the default is ``--apply``):

  --apply          Applies ``supabase/migrations/213_message_artifacts_more_components.sql`` to the live
                   LOCAL Supabase DB (:54322) UNMODIFIED, runs the file's own VERIFY block, then
                   applies it a SECOND time and asserts the VERIFY result and the CHECK definitions
                   are identical and that no row count moved (idempotency).
  --dry-run        The file's transaction body inside ONE outer transaction (its own BEGIN / COMMIT
                   stripped), then VERIFY, then ROLLBACK.
  --verify-only    Runs the VERIFY block twice and prints the live component / label CHECKs. Writes
                   nothing.

WHY A SCRIPT AND NOT THE SQL EDITOR: the 207 / 208 / 210 / 211 precedent. The SQL the operator pastes
into production is the file itself, unmodified.

⚠ THE MIGRATION OWNS ITS OWN TRANSACTION (``BEGIN;`` / ``COMMIT;``). asyncpg's ``execute`` of a
  multi-statement script runs it through the simple-query protocol, so the file's BEGIN/COMMIT are
  honoured as written. ⛔ Do NOT strip them for ``--apply`` (only ``--dry-run`` does, on purpose).

⛔ THE DSN IS HARD-CODED TO 127.0.0.1 AND NO ENVIRONMENT VARIABLE IS READ. Applying 213 to cloud is a
   production write and needs explicit per-action operator approval (CLAUDE.md → "Supabase MCP —
   reads are free, WRITES ARE APPROVAL-GATED"). This script cannot reach cloud even by accident.
⛔ NEVER ``supabase db push`` / ``db reset`` — both destroy the operator's dev data.
⛔ Run under the local-DB lock (``C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock``).

Run: backend/venv/Scripts/python scripts/apply_migration_213.py [--apply | --dry-run | --verify-only]
"""
from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import asyncpg

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "supabase" / "migrations" / "213_message_artifacts_more_components.sql"
)
_CHECKS_SQL = """
select conname, pg_get_constraintdef(oid) as def from pg_constraint
where conrelid = 'public.message_artifacts'::regclass and contype = 'c'
  and (pg_get_constraintdef(oid) like '%component%' or pg_get_constraintdef(oid) like '%label%')
order by conname
"""


def _refuse_non_local() -> None:
    host = urlparse(DSN).hostname
    if host not in ("127.0.0.1", "localhost", "::1"):
        raise SystemExit(f"REFUSED: {host} is not loopback — 213 is applied to cloud by the operator only")


# ── the file's own pieces ──────────────────────────────────────────────────────────────────────

def _verify_sql(sql: str) -> str:
    """The commented VERIFY block, uncommented — the exact SQL the operator runs."""
    lines = sql.splitlines()
    start = next(i for i, l in enumerate(lines) if l.strip().startswith("-- VERIFY"))
    body = []
    for line in lines[start + 1:]:
        s = line.strip()
        if s.startswith("-- ====="):
            if body:
                break
            continue
        if s.startswith("--   "):
            body.append(line.split("--", 1)[1][2:])
        elif s.startswith("--") and not body:
            continue
    text = "\n".join(body).strip()
    if not re.match(r"(?is)^with\b", text) or "checks(what, ok)" not in text:
        raise SystemExit(f"could not extract the VERIFY block (got {text[:80]!r})")
    return text


def _body_without_txn(sql: str) -> str:
    """The migration up to COMMIT, minus its own BEGIN (for --dry-run inside our txn)."""
    head = sql[: sql.index("\nCOMMIT;")]
    out = [l for l in head.splitlines() if l.strip() != "BEGIN;"]
    return "\n".join(out)


async def _verify(conn, query: str) -> list[tuple[str, str]]:
    return [(r["status"], r["what"]) for r in await conn.fetch(query)]


async def _checks(conn) -> list[tuple[str, str]]:
    return [(r["conname"], r["def"]) for r in await conn.fetch(_CHECKS_SQL)]


def _print_verify(label: str, res: list[tuple[str, str]]) -> bool:
    ok = sum(1 for s, _ in res if s == "PASS")
    print(f"\n{label}")
    for s, w in res:
        print(f"  {s:12} {w}")
    print(f"VERIFY: {ok}/{len(res)} PASS")
    return ok == len(res) and len(res) > 0


def _print_checks(checks: list[tuple[str, str]]) -> None:
    print("LIVE CHECKS (component / label):")
    for name, d in checks:
        print(f"  {name}: {d}")


async def _counts(conn) -> dict[str, int]:
    return {
        "message_artifacts": await conn.fetchval("SELECT count(*) FROM public.message_artifacts"),
        "messages": await conn.fetchval("SELECT count(*) FROM public.messages"),
    }


def _on_notice(_conn, msg) -> None:
    print(f"  NOTICE: {getattr(msg, 'message', msg)}")


# ── --apply ────────────────────────────────────────────────────────────────────────────────────

async def mode_apply(conn, sql: str) -> int:
    v = _verify_sql(sql)
    before = await _counts(conn)
    print(f"BEFORE  {before}")
    _print_checks(await _checks(conn))

    print("\nFIRST APPLY")
    await conn.execute(sql)
    first = await _verify(conn, v)
    ok1 = _print_verify("AFTER FIRST APPLY", first)
    checks1 = await _checks(conn)
    _print_checks(checks1)
    mid = await _counts(conn)
    print(f"AFTER FIRST  {mid}")

    print("\nSECOND APPLY")
    await conn.execute(sql)
    second = await _verify(conn, v)
    ok2 = _print_verify("AFTER SECOND APPLY (idempotency check)", second)
    checks2 = await _checks(conn)
    after = await _counts(conn)
    print(f"AFTER SECOND {after}")

    failures = []
    if not ok1:
        failures.append("the first apply did not VERIFY")
    if not ok2:
        failures.append("the second apply did not VERIFY")
    if first != second:
        failures.append("the SECOND apply changed the VERIFY result -- 213 is not re-runnable")
    if checks1 != checks2:
        failures.append("the SECOND apply changed the CHECK definitions")
    if len(checks2) != 2:
        failures.append(f"expected exactly 2 component/label CHECKs, found {len(checks2)}")
    if after != mid or before != after:
        failures.append(f"row counts moved {before} -> {mid} -> {after}")
    if failures:
        print("\n*** FAILED ***")
        for f in failures:
            print(f"  · {f}")
        return 1
    print("\nAPPLIED (local) -- VERIFY identical across two applies; no row count moved.")
    return 0


# ── --dry-run ──────────────────────────────────────────────────────────────────────────────────

async def mode_dry_run(conn, sql: str) -> int:
    v = _verify_sql(sql)
    body = _body_without_txn(sql)
    print(f"BEFORE  {await _counts(conn)}")
    tr = conn.transaction()
    await tr.start()
    try:
        await conn.execute(body)
        res = await _verify(conn, v)
        ok = _print_verify("DRY RUN (inside one transaction, rolled back)", res)
        _print_checks(await _checks(conn))
        print(f"INSIDE  {await _counts(conn)}")
    finally:
        await tr.rollback()
    print(f"rolled back; AFTER {await _counts(conn)}")
    return 0 if ok else 1


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group()
    for flag in ("--apply", "--dry-run", "--verify-only"):
        g.add_argument(flag, action="store_true")
    args = ap.parse_args()

    _refuse_non_local()
    if not MIGRATION.is_file():
        print(f"FATAL: migration not found at {MIGRATION}")
        return 2
    sql = MIGRATION.read_text(encoding="utf-8")
    conn = await asyncpg.connect(DSN)
    conn.add_log_listener(_on_notice)
    try:
        if args.dry_run:
            return await mode_dry_run(conn, sql)
        if args.verify_only:
            v = _verify_sql(sql)
            a = _print_verify("VERIFY (run 1)", await _verify(conn, v))
            b = _print_verify("VERIFY (run 2)", await _verify(conn, v))
            checks = await _checks(conn)
            _print_checks(checks)
            return 0 if a and b and len(checks) == 2 else 1
        return await mode_apply(conn, sql)
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(asyncio.run(main()))

"""Throwaway apply script for Phase 284 Plan 02 — migration 207 (public.library_documents).

Applies ``supabase/migrations/207_library_documents_view.sql`` to the live LOCAL Supabase DB
(:54322) with asyncpg, runs the file's own VERIFY block, then applies the file a SECOND time and
asserts the VERIFY result — and the view's definition — are identical (idempotency is PROVEN, not
claimed). It also proves nothing was lost: ``count(*)`` of ``public.documents`` is identical
before and after.

WHY A SCRIPT AND NOT THE SQL EDITOR: this plan runs as a worktree executor with no browser, and
the Phase 178 / 275 precedent is exactly this script path for that case. The SQL the operator
would paste is the file itself, unmodified; the script adds nothing to it.

⚠ THE MIGRATION OWNS ITS OWN TRANSACTION (``BEGIN;`` / ``COMMIT;``), as the SQL-editor paste path
  needs. asyncpg's ``execute`` of a multi-statement script runs it through the simple-query
  protocol, so the file's BEGIN/COMMIT are honoured as written. ⛔ Do NOT strip them.

⚠ IF 207 EVER CARRIES A ``CREATE INDEX CONCURRENTLY`` STEP 1 (migration 200's two-run pattern),
  this script runs that statement ON ITS OWN first (CONCURRENTLY refuses a transaction block and
  a multi-statement simple query is one implicit transaction), then the rest of the file.

⛔ THE DSN IS HARD-CODED TO 127.0.0.1 AND NO ENVIRONMENT VARIABLE IS READ. Applying 207 to cloud
   is a production write and needs explicit per-action operator approval (CLAUDE.md → "Supabase
   MCP — reads are free, WRITES ARE APPROVAL-GATED"). This script cannot reach cloud even by
   accident.
⛔ NEVER ``supabase db push`` / ``db reset`` — both destroy the operator's dev data.
⛔ Run under the local-DB lock (``C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock``).

Run: backend/venv/Scripts/python scripts/apply_migration_207.py
"""
from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path

import asyncpg

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
MIGRATION = (
    Path(__file__).resolve().parent.parent / "supabase" / "migrations"
    / "207_library_documents_view.sql"
)
_CONCURRENT = re.compile(r"(?ims)^\s*(CREATE\s+INDEX\s+CONCURRENTLY\b.*?;)")


def _split(sql: str) -> tuple[list[str], str]:
    """(the CONCURRENTLY statements to run alone, the rest of the file)."""
    conc = [m.group(1) for m in _CONCURRENT.finditer(sql)]
    rest = _CONCURRENT.sub("", sql)
    return conc, rest


def _verify_sql(sql: str) -> str:
    """The commented VERIFY block, uncommented — the exact SELECT the operator runs."""
    lines = sql.splitlines()
    start = next(i for i, l in enumerate(lines) if l.strip().startswith("-- VERIFY"))
    body = []
    for line in lines[start + 1 :]:
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
    if not text.lower().startswith("with checks"):
        raise SystemExit(f"could not extract the VERIFY block (got {text[:80]!r})")
    return text


async def _apply(conn, sql: str) -> None:
    conc, rest = _split(sql)
    for stmt in conc:
        await conn.execute(stmt)
    await conn.execute(rest)


async def _verify(conn, vsql: str) -> list[tuple[str, str]]:
    rows = await conn.fetch(vsql)
    return [(r["status"], r["what"]) for r in rows]


def _print_verify(label: str, res: list[tuple[str, str]]) -> bool:
    ok = sum(1 for s, _ in res if s == "PASS")
    print(f"\n{label}")
    for s, w in res:
        print(f"  {s:12} {w}")
    print(f"VERIFY: {ok}/{len(res)} PASS")
    return ok == len(res)


async def main() -> int:
    if not MIGRATION.is_file():
        print(f"FATAL: migration not found at {MIGRATION}")
        return 2
    sql = MIGRATION.read_text(encoding="utf-8")
    vsql = _verify_sql(sql)
    conn = await asyncpg.connect(DSN)
    try:
        docs_before = await conn.fetchval("SELECT count(*) FROM public.documents")
        print(f"BEFORE  documents rows: {docs_before}")

        await _apply(conn, sql)
        first = await _verify(conn, vsql)
        def1 = await conn.fetchval("SELECT pg_get_viewdef('public.library_documents'::regclass, true)")
        ok1 = _print_verify("AFTER FIRST APPLY", first)

        await _apply(conn, sql)
        second = await _verify(conn, vsql)
        def2 = await conn.fetchval("SELECT pg_get_viewdef('public.library_documents'::regclass, true)")
        ok2 = _print_verify("AFTER SECOND APPLY (idempotency check)", second)

        docs_after = await conn.fetchval("SELECT count(*) FROM public.documents")
        print(f"\nAFTER   documents rows: {docs_after}")

        failures = []
        if not ok1:
            failures.append("the first apply did not VERIFY")
        if first != second or def1 != def2:
            failures.append("the SECOND apply changed the result — 207 is not re-runnable")
        if docs_after != docs_before:
            failures.append(f"documents row count changed {docs_before} -> {docs_after}")
        if failures or not ok2:
            print("\n*** FAILED ***")
            for f in failures:
                print(f"  · {f}")
            return 1
        print("\nAPPLIED (local) — VERIFY identical across two applies; documents untouched.")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(asyncio.run(main()))

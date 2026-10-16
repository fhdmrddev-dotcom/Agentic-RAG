"""Throwaway apply script for Phase 284 Plan 06 — migration 208 (the Library first-page indexes,
the documents SELECT policy's auth.uid() wrapped once, and library_documents as an ordered
UNION ALL).

Applies ``supabase/migrations/208_library_page_index.sql`` to the live LOCAL Supabase DB (:54322)
with asyncpg, runs the file's own VERIFY block, then applies the file a SECOND time and asserts
the VERIFY result, the view definition and the policy expression are identical (idempotency is
PROVEN, not claimed). It also proves:

  * nothing was lost — ``count(*)`` of ``public.documents`` is identical before and after;
  * the VIEW IS ROW-FOR-ROW IDENTICAL to 207's for EVERY user in ``auth.users``, read as that
    user (``SET LOCAL ROLE authenticated`` + claims): the row count and an md5 over every
    column of every visible row, ordered by id, are captured BEFORE the first apply and compared
    after it. A rewrite that drops, adds or alters one row for one user fails here.

WHY A SCRIPT AND NOT THE SQL EDITOR: this plan runs as a worktree executor with no browser (the
207 / 178 / 275 precedent). The SQL the operator would paste is the file itself, unmodified.

⚠ THE MIGRATION OWNS ITS OWN TRANSACTION (``BEGIN;`` / ``COMMIT;``). asyncpg's ``execute`` of a
  multi-statement script runs it through the simple-query protocol, so the file's BEGIN/COMMIT are
  honoured as written. ⛔ Do NOT strip them.

⛔ THE DSN IS HARD-CODED TO 127.0.0.1 AND NO ENVIRONMENT VARIABLE IS READ. Applying 208 to cloud
   is a production write and needs explicit per-action operator approval (CLAUDE.md → "Supabase
   MCP — reads are free, WRITES ARE APPROVAL-GATED"). This script cannot reach cloud even by
   accident.
⛔ NEVER ``supabase db push`` / ``db reset`` — both destroy the operator's dev data.
⛔ Run under the local-DB lock (``C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock``).

Run: backend/venv/Scripts/python scripts/apply_migration_208.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

import asyncpg

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
MIGRATION = (
    Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "208_library_page_index.sql"
)
POLICY_Q = (
    "SELECT pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polrelid = 'public.documents'::regclass "
    "AND polname = 'Users can view own or global-folder documents'"
)
#: Every visible row, every column, in id order — as ONE md5 (and the row count beside it).
VIEW_FINGERPRINT = (
    "SELECT count(*) AS n, md5(coalesce(string_agg(v::text, '|' ORDER BY v.id), '')) AS h "
    "FROM public.library_documents v"
)


def _refuse_non_local() -> None:
    host = urlparse(DSN).hostname
    if host not in ("127.0.0.1", "localhost", "::1"):
        raise SystemExit(f"REFUSED: {host} is not loopback — 208 is applied to cloud by the operator only")


def _verify_sql(sql: str) -> str:
    """The commented VERIFY block, uncommented — the exact SELECT the operator runs."""
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
    if not text.lower().startswith("with checks"):
        raise SystemExit(f"could not extract the VERIFY block (got {text[:80]!r})")
    return text


async def _fingerprints(conn) -> dict[str, tuple[int, str]]:
    """{uid: (visible rows, md5 of every column of every row)} for every auth user, as that user."""
    out = {}
    for r in await conn.fetch("SELECT id FROM auth.users ORDER BY id"):
        uid = str(r["id"])
        tr = conn.transaction()
        await tr.start()
        try:
            await conn.execute("SET LOCAL ROLE authenticated")
            await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", uid)
            await conn.execute("SELECT set_config('request.jwt.claims', $1, true)",
                               json.dumps({"sub": uid, "role": "authenticated"}))
            row = await conn.fetchrow(VIEW_FINGERPRINT)
            out[uid] = (row["n"], row["h"])
        finally:
            await tr.rollback()
    # the service role / no-uid caller: fail-closed must stay zero rows
    tr = conn.transaction()
    await tr.start()
    try:
        await conn.execute("SET LOCAL ROLE service_role")
        out["<service_role>"] = tuple((await conn.fetchrow(VIEW_FINGERPRINT)).values())
    finally:
        await tr.rollback()
    return out


async def _verify(conn, vsql: str) -> list[tuple[str, str]]:
    return [(r["status"], r["what"]) for r in await conn.fetch(vsql)]


def _print_verify(label: str, res: list[tuple[str, str]]) -> bool:
    ok = sum(1 for s, _ in res if s == "PASS")
    print(f"\n{label}")
    for s, w in res:
        print(f"  {s:12} {w}")
    print(f"VERIFY: {ok}/{len(res)} PASS")
    return ok == len(res)


async def main() -> int:
    _refuse_non_local()
    if not MIGRATION.is_file():
        print(f"FATAL: migration not found at {MIGRATION}")
        return 2
    sql = MIGRATION.read_text(encoding="utf-8")
    vsql = _verify_sql(sql)
    conn = await asyncpg.connect(DSN)
    try:
        docs_before = await conn.fetchval("SELECT count(*) FROM public.documents")
        fp_before = await _fingerprints(conn)
        pol_before = await conn.fetchval(POLICY_Q)
        print(f"BEFORE  documents rows: {docs_before}; users fingerprinted: {len(fp_before) - 1}")
        print(f"BEFORE  policy: {pol_before}")

        await conn.execute(sql)
        first = await _verify(conn, vsql)
        def1 = await conn.fetchval("SELECT pg_get_viewdef('public.library_documents'::regclass, true)")
        pol1 = await conn.fetchval(POLICY_Q)
        ok1 = _print_verify("AFTER FIRST APPLY", first)
        fp_after = await _fingerprints(conn)

        await conn.execute(sql)
        second = await _verify(conn, vsql)
        def2 = await conn.fetchval("SELECT pg_get_viewdef('public.library_documents'::regclass, true)")
        pol2 = await conn.fetchval(POLICY_Q)
        ok2 = _print_verify("AFTER SECOND APPLY (idempotency check)", second)

        docs_after = await conn.fetchval("SELECT count(*) FROM public.documents")
        print(f"\nAFTER   documents rows: {docs_after}")
        print(f"AFTER   policy: {pol2}")

        failures = []
        if not ok1:
            failures.append("the first apply did not VERIFY")
        if first != second or def1 != def2 or pol1 != pol2:
            failures.append("the SECOND apply changed the result — 208 is not re-runnable")
        if docs_after != docs_before:
            failures.append(f"documents row count changed {docs_before} -> {docs_after}")
        diff = sorted(u for u in fp_before if fp_before[u] != fp_after.get(u))
        print("\nROW-FOR-ROW PARITY (207 view BEFORE vs 208 view AFTER, every user, as that user):")
        for u in sorted(fp_before, key=lambda k: -fp_before[k][0]):
            mark = "same" if fp_before[u] == fp_after.get(u) else "*** DIFFERENT ***"
            print(f"  {u:38} rows {fp_before[u][0]:>6} -> {fp_after.get(u, ('?',))[0]:>6}  {mark}")
        if diff:
            failures.append(f"the view's rows differ for {len(diff)} caller(s): {diff}")
        if fp_after.get("<service_role>", (None,))[0] != 0:
            failures.append("the service role reads rows through the view (fail-closed broken)")
        if failures or not ok2:
            print("\n*** FAILED ***")
            for f in failures:
                print(f"  · {f}")
            return 1
        print(f"\nAPPLIED (local) — VERIFY identical across two applies; documents untouched; "
              f"the view is row-for-row identical for all {len(fp_before) - 1} users and the "
              f"service role still reads 0 rows.")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(asyncio.run(main()))

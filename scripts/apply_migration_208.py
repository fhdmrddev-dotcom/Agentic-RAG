"""Throwaway apply script for Phase 284 Plan 06 — migration 208 (the Library first-page indexes,
the documents SELECT policy's auth.uid() wrapped once, and library_documents as an ordered
UNION ALL).

MODES (exactly one; the default is ``--apply``):

  --apply          Applies ``supabase/migrations/208_library_page_index.sql`` to the live LOCAL
                   Supabase DB (:54322), runs the file's own VERIFY block, then applies the file a
                   SECOND time and asserts the VERIFY result, the view definition and the policy
                   expression are identical (idempotency is PROVEN, not claimed). It also proves:
                     * nothing was lost — ``count(*)`` of ``public.documents`` is identical;
                     * the VIEW is row-for-row identical before and after for EVERY user in
                       ``auth.users``, read as that user the way PostgREST reads
                       (``SET LOCAL ROLE authenticated`` + ``request.jwt.claims`` ONLY): row count
                       + an md5 over every column of every visible row, ordered by id.
  --dry-run        The file's transaction body inside ONE outer transaction (its own BEGIN /
                   COMMIT / NOTIFY stripped), then VERIFY and a per-user read of the view, then
                   ROLLBACK. Proves a changed file applies cleanly BEFORE it touches the shared DB.
  --verify-only    Runs the VERIFY block (its SET prelude, then the query) twice. Writes nothing.
  --prove-verify   284-REVIEW WR-R2-01 / WR-R2-04: plants each defect VERIFY must catch, ONE per
                   rolled-back transaction, and asserts the named VERIFY row reads FAIL; then
                   asserts VERIFY reads all PASS on the real objects. With ``--old-verify FILE``
                   it also runs that file's VERIFY against the same plants (to show the old one
                   PASSED them). The invalid-index plant edits ``pg_index``, which needs the local
                   superuser (``supabase_admin``) — inside a rolled-back transaction.
  --parity-policy  284-REVIEW WR-R2-02: ONE rolled-back transaction that installs 154's policy,
                   then 208's, and for every local user — as ``authenticated`` with
                   ``request.jwt.claims`` only, like PostgREST — with ``app.agent_read`` off AND
                   on, fingerprints the documents TABLE (row count + md5 of the sorted ids) and the
                   view. Two data states: the data as it is, and the data with connection documents
                   flipped to ``ingest_visibility = 'org'`` and some documents ``source_state =
                   'missing_at_source'`` (``retrievable`` is GENERATED from it, so those turn false
                   and the connection arm and the restrictive policy both decide rows).
                   Asserts 154 == 208 for every (state, agent_read, user).

WHY A SCRIPT AND NOT THE SQL EDITOR: this plan runs as a worktree executor with no browser (the
207 / 178 / 275 precedent). The SQL the operator would paste is the file itself, unmodified.

⚠ THE MIGRATION OWNS ITS OWN TRANSACTION (``BEGIN;`` / ``COMMIT;``). asyncpg's ``execute`` of a
  multi-statement script runs it through the simple-query protocol, so the file's BEGIN/COMMIT are
  honoured as written. ⛔ Do NOT strip them for ``--apply`` (only ``--dry-run`` does, on purpose).

⛔ THE DSN IS HARD-CODED TO 127.0.0.1 AND NO ENVIRONMENT VARIABLE IS READ. Applying 208 to cloud
   is a production write and needs explicit per-action operator approval (CLAUDE.md → "Supabase
   MCP — reads are free, WRITES ARE APPROVAL-GATED"). This script cannot reach cloud even by
   accident.
⛔ NEVER ``supabase db push`` / ``db reset`` — both destroy the operator's dev data.
⛔ Run under the local-DB lock (``C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock``).

Run: backend/venv/Scripts/python scripts/apply_migration_208.py [--apply | --dry-run |
     --verify-only | --prove-verify [--old-verify FILE] | --parity-policy]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import asyncpg

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
#: the local superuser — used ONLY by --prove-verify's invalid-index plant, inside a rollback.
SUPER_DSN = "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres"
MIGRATION = (
    Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "208_library_page_index.sql"
)
POLICY_NAME = "Users can view own or global-folder documents"
POLICY_Q = (
    "SELECT pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polrelid = 'public.documents'::regclass "
    f"AND polname = '{POLICY_NAME}'"
)
#: Every visible row, every column, in id order — as ONE md5 (and the row count beside it).
VIEW_FINGERPRINT = (
    "SELECT count(*) AS n, md5(coalesce(string_agg(v::text, '|' ORDER BY v.id), '')) AS h "
    "FROM public.library_documents v"
)
#: The documents TABLE as the caller's RLS admits it: row count + md5 of the sorted ids.
TABLE_FINGERPRINT = (
    "SELECT count(*) AS n, md5(coalesce(string_agg(id::text, ',' ORDER BY id), '')) AS h "
    "FROM public.documents"
)

#: Migration 154's SELECT policy, verbatim (154_connection_scoped_visibility.sql §3).
POLICY_154_SQL = f"""
CREATE POLICY "{POLICY_NAME}" ON public.documents
  FOR SELECT TO authenticated
  USING (
    (org_id IN (SELECT public.current_user_org_ids()))
    AND (
      (auth.uid() = user_id)
      OR ((folder_id IS NOT NULL) AND public.folder_is_org_shared(folder_id))
      OR public.connection_doc_is_visible(source_connection_id, ingest_visibility)
    )
  )"""
V_154 = (
    "((org_id IN ( SELECT current_user_org_ids() AS current_user_org_ids)) AND ((auth.uid() = user_id) "
    "OR ((folder_id IS NOT NULL) AND folder_is_org_shared(folder_id)) "
    "OR connection_doc_is_visible(source_connection_id, ingest_visibility)))"
)
V_208 = (
    "((org_id IN ( SELECT current_user_org_ids() AS current_user_org_ids)) AND ((( SELECT auth.uid() AS uid) = user_id) "
    "OR ((folder_id IS NOT NULL) AND folder_is_org_shared(folder_id)) "
    "OR connection_doc_is_visible(source_connection_id, ingest_visibility)))"
)


def _refuse_non_local() -> None:
    for dsn in (DSN, SUPER_DSN):
        host = urlparse(dsn).hostname
        if host not in ("127.0.0.1", "localhost", "::1"):
            raise SystemExit(f"REFUSED: {host} is not loopback — 208 is applied to cloud by the operator only")


# ── the file's own pieces ──────────────────────────────────────────────────────────────────────

def _verify_sql(sql: str) -> tuple[str, str]:
    """The commented VERIFY block, uncommented — the exact SQL the operator runs — split into
    ``(prelude, query)``: the ``SET search_path`` statement(s) and the ``with checks`` SELECT."""
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
    m = re.search(r"(?im)^\s*with checks", text)
    if not m:
        raise SystemExit(f"could not extract the VERIFY block (got {text[:80]!r})")
    prelude, query = text[: m.start()].strip(), text[m.start():].strip()
    if prelude and not re.fullmatch(r"(?is)(\s*set\s+[^;]+;\s*)+", prelude):
        raise SystemExit(f"the VERIFY prelude may only SET (got {prelude!r})")
    return prelude, query


def _statement(sql: str, start: str, end: str) -> str:
    i = sql.index(start)
    j = sql.index(end, i) + len(end)
    return sql[i:j]


def _view_sql(sql: str) -> str:
    return _statement(sql, "CREATE OR REPLACE VIEW public.library_documents", "f.id)))));")


def _policy_208_sql(sql: str) -> str:
    return _statement(sql, f'CREATE POLICY "{POLICY_NAME}"', "  );")


def _body_without_txn(sql: str) -> str:
    """The migration up to COMMIT, minus its own BEGIN/COMMIT (for --dry-run inside our txn)."""
    head = sql[: sql.index("\nCOMMIT;")]
    out = [l for l in head.splitlines() if l.strip() != "BEGIN;"]
    return "\n".join(out)


async def _verify(conn, v: tuple[str, str]) -> list[tuple[str, str]]:
    prelude, query = v
    if prelude:
        await conn.execute(prelude)
    return [(r["status"], r["what"]) for r in await conn.fetch(query)]


def _print_verify(label: str, res: list[tuple[str, str]]) -> bool:
    ok = sum(1 for s, _ in res if s == "PASS")
    print(f"\n{label}")
    for s, w in res:
        print(f"  {s:12} {w}")
    print(f"VERIFY: {ok}/{len(res)} PASS")
    return ok == len(res)


# ── reading as a caller, the way PostgREST does ────────────────────────────────────────────────

async def _as_caller(conn, uid: str | None, agent_read: bool = False) -> None:
    """``SET LOCAL ROLE authenticated`` + ``request.jwt.claims`` ONLY (``request.jwt.claim.sub``
    is set EMPTY, so auth.uid() takes the claims branch, exactly as under PostgREST)."""
    await conn.execute("SET LOCAL ROLE authenticated")
    await conn.execute("SELECT set_config('request.jwt.claim.sub', '', true)")
    claims = {"role": "authenticated", "aud": "authenticated"}
    if uid is not None:
        claims["sub"] = uid
    await conn.execute("SELECT set_config('request.jwt.claims', $1, true)", json.dumps(claims))
    await conn.execute("SELECT set_config('app.agent_read', $1, true)", "on" if agent_read else "")


async def _back_to_owner(conn) -> None:
    await conn.execute("RESET ROLE")
    await conn.execute("SELECT set_config('request.jwt.claims', '', true)")
    await conn.execute("SELECT set_config('app.agent_read', '', true)")


async def _users(conn) -> list[str]:
    return [str(r["id"]) for r in await conn.fetch("SELECT id FROM auth.users ORDER BY id")]


async def _fingerprints(conn) -> dict[str, tuple[int, str]]:
    """{uid: (visible rows, md5 of every column of every row)} for every auth user, as that user."""
    out = {}
    for uid in await _users(conn):
        tr = conn.transaction()
        await tr.start()
        try:
            await _as_caller(conn, uid)
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


# ── --apply ────────────────────────────────────────────────────────────────────────────────────

async def mode_apply(conn, sql: str) -> int:
    v = _verify_sql(sql)
    docs_before = await conn.fetchval("SELECT count(*) FROM public.documents")
    fp_before = await _fingerprints(conn)
    pol_before = await conn.fetchval(POLICY_Q)
    print(f"BEFORE  documents rows: {docs_before}; users fingerprinted: {len(fp_before) - 1}")
    print(f"BEFORE  policy: {pol_before}")

    await conn.execute(sql)
    first = await _verify(conn, v)
    def1 = await conn.fetchval("SELECT pg_get_viewdef('public.library_documents'::regclass, true)")
    pol1 = await conn.fetchval(POLICY_Q)
    ok1 = _print_verify("AFTER FIRST APPLY", first)
    fp_after = await _fingerprints(conn)

    await conn.execute(sql)
    second = await _verify(conn, v)
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
    print("\nROW-FOR-ROW PARITY (view BEFORE vs view AFTER, every user, as that user via claims):")
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


# ── --dry-run ──────────────────────────────────────────────────────────────────────────────────

async def mode_dry_run(conn, sql: str) -> int:
    v = _verify_sql(sql)
    body = _body_without_txn(sql)
    fp_before = await _fingerprints(conn)
    tr = conn.transaction()
    await tr.start()
    try:
        await conn.execute(body)
        res = await _verify(conn, v)
        ok = _print_verify("DRY RUN (inside one transaction, rolled back)", res)
        diff = []
        for uid in await _users(conn):
            await conn.execute("SAVEPOINT r")
            await _as_caller(conn, uid)
            row = await conn.fetchrow(VIEW_FINGERPRINT)
            await conn.execute("ROLLBACK TO SAVEPOINT r")
            if (row["n"], row["h"]) != fp_before[uid]:
                diff.append(uid)
        print(f"view rows per user vs the live objects: {len(fp_before) - 1 - len(diff)} same, "
              f"{len(diff)} different")
    finally:
        await tr.rollback()
    after = await _verify(conn, v)
    live_ok = all(s == "PASS" for s, _ in after)
    print(f"rolled back; the live objects VERIFY {sum(s == 'PASS' for s, _ in after)}/{len(after)} PASS")
    return 0 if ok and not diff and live_ok else 1


# ── --prove-verify ─────────────────────────────────────────────────────────────────────────────

def _plants(sql: str) -> list[tuple[str, str, list[str], str]]:
    """(name, connection, the SQL that plants it, the VERIFY row that must FAIL)."""
    pol208 = _policy_208_sql(sql)
    view = _view_sql(sql)
    drop = f'DROP POLICY "{POLICY_NAME}" ON public.documents'
    or_true = pol208.replace(
        "OR public.connection_doc_is_visible(source_connection_id, ingest_visibility)\n",
        "OR public.connection_doc_is_visible(source_connection_id, ingest_visibility)\n      OR true\n")
    and_to_or = pol208.replace(
        "(org_id IN (SELECT public.current_user_org_ids()))\n    AND (",
        "(org_id IN (SELECT public.current_user_org_ids()))\n    OR (")
    no_distinct = view.replace("           AND u.user_id IS DISTINCT FROM (SELECT auth.uid())\n", "")
    no_not_own = view.replace(
        "                  WHERE f.user_id <> (SELECT auth.uid()) AND public.folder_is_org_shared(f.id)))));",
        "                  WHERE public.folder_is_org_shared(f.id)))));")
    for name, a, b in (("OR true", pol208, or_true), ("AND->OR", pol208, and_to_or),
                       ("IS DISTINCT FROM", view, no_distinct), ("f.user_id <>", view, no_not_own)):
        if a == b:
            raise SystemExit(f"plant {name!r} did not change the text — the file moved; update the plant")
    exact = "USING is EXACTLY 208's"
    fpr = "view definition is exactly 208's"
    return [
        ("policy: 208's USING with `OR true` appended inside the disjunction", "owner",
         [drop, or_true], exact),
        ("policy: the org gate's AND turned into OR", "owner", [drop, and_to_or], exact),
        ("policy: a SECOND permissive SELECT policy for authenticated (USING true)", "owner",
         ["CREATE POLICY zz_plant_284_extra ON public.documents FOR SELECT TO authenticated USING (true)"],
         "exactly ONE permissive policy"),
        ("policy: the restrictive documents_agent_read_retrievable dropped", "owner",
         ["DROP POLICY documents_agent_read_retrievable ON public.documents"],
         "exactly ONE restrictive policy"),
        ("view: leg 2 without `u.user_id IS DISTINCT FROM uid` (duplicates)", "owner",
         [no_distinct], fpr),
        ("view: leg 2 without `f.user_id <> uid` (other users' docs in the caller's own shared folder)",
         "owner", [no_not_own], fpr),
        ("index: documents_library_added_idx INVALID (a failed CONCURRENTLY build)", "super",
         ["UPDATE pg_catalog.pg_index SET indisvalid = false "
          "WHERE indexrelid = 'public.documents_library_added_idx'::regclass"],
         "documents_library_added_idx exists, is VALID"),
        ("index: documents_library_root_created_idx not READY", "super",
         ["UPDATE pg_catalog.pg_index SET indisready = false "
          "WHERE indexrelid = 'public.documents_library_root_created_idx'::regclass"],
         "documents_library_root_created_idx exists, is VALID"),
    ]


async def _run_plant(conn, stmts, verifies):
    """Plant inside ONE transaction, run each VERIFY, ROLLBACK. Returns {label: results}."""
    out = {}
    tr = conn.transaction()
    await tr.start()
    try:
        await conn.execute("SET LOCAL lock_timeout = '3s'")
        await conn.execute("SET LOCAL search_path TO public, extensions")
        for s in stmts:
            await conn.execute(s)
        for label, v in verifies.items():
            out[label] = await _verify(conn, v)
    finally:
        await tr.rollback()
    return out


async def mode_prove_verify(conn, sql: str, old_verify: Path | None) -> int:
    verifies = {"NEW": _verify_sql(sql)}
    if old_verify is not None:
        verifies["OLD"] = _verify_sql(old_verify.read_text(encoding="utf-8"))
    sconn = await asyncpg.connect(SUPER_DSN)
    failures = []
    try:
        for name, who, stmts, must_fail in _plants(sql):
            res = await _run_plant(conn if who == "owner" else sconn, stmts, verifies)
            print(f"\nPLANT: {name}  (rolled back)")
            for label, rows in res.items():
                failed = [w for s, w in rows if s != "PASS"]
                print(f"  {label} VERIFY: {len(rows) - len(failed)}/{len(rows)} PASS")
                for w in failed:
                    print(f"    *** FAIL *** {w}")
                if label == "NEW" and not any(must_fail in w for w in failed):
                    failures.append(f"{name}: NEW VERIFY did not FAIL the row {must_fail!r}")
        real = await _verify(conn, verifies["NEW"])
        ok = _print_verify("REAL OBJECTS (no plant)", real)
        if not ok:
            failures.append("VERIFY does not PASS on the real objects")
        pol = await conn.fetchval(POLICY_Q)
        md5 = await conn.fetchval(
            "SELECT md5(pg_get_viewdef('public.library_documents'::regclass, true))")
        print(f"live policy == 208's: {pol == V_208}; live view md5: {md5}")
    finally:
        await sconn.close()
    if failures:
        print("\n*** FAILED ***")
        for f in failures:
            print(f"  · {f}")
        return 1
    print("\nPROVED — every plant flips its VERIFY row to FAIL; the real objects read all PASS.")
    return 0


# ── --parity-policy ────────────────────────────────────────────────────────────────────────────

async def _install(conn, policy_sql: str, expect: str) -> None:
    await conn.execute(f'DROP POLICY "{POLICY_NAME}" ON public.documents')
    await conn.execute(policy_sql)
    got = await conn.fetchval(POLICY_Q)
    if expect is not None and got != expect:
        raise SystemExit(f"the installed policy deparses to {got!r}, expected {expect!r}")


async def _fp_all(conn, users, agent_read: bool) -> dict:
    out = {}
    for uid in users + [None]:
        await conn.execute("SAVEPOINT fp")
        await _as_caller(conn, uid, agent_read)
        t = await conn.fetchrow(TABLE_FINGERPRINT)
        vw = await conn.fetchrow(VIEW_FINGERPRINT)
        await conn.execute("ROLLBACK TO SAVEPOINT fp")
        await _back_to_owner(conn)
        out[uid or "<no uid>"] = ((t["n"], t["h"]), (vw["n"], vw["h"]))
    return out


async def _arm_counts(conn) -> dict:
    """Rows only the CONNECTION arm admits (not own, not in an org-shared folder), summed over
    every user and their orgs — so the record shows the arm actually decided rows."""
    return dict(await conn.fetchrow(
        """
        SELECT
          count(*) FILTER (WHERE d.user_id <> m.user_id
                             AND NOT (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
                             AND public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility))
            AS connection_arm_only,
          count(*) FILTER (WHERE d.user_id <> m.user_id
                             AND d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
            AS shared_folder_arm,
          count(*) FILTER (WHERE d.user_id = m.user_id) AS own_arm,
          count(*) FILTER (WHERE NOT d.retrievable) AS not_retrievable_member_rows
        FROM public.org_members m JOIN public.documents d ON d.org_id = m.org_id
        """))


async def mode_parity_policy(conn, sql: str, plant: bool = False) -> int:
    pol208 = _policy_208_sql(sql)
    expect_208: str | None = V_208
    if plant:
        # RED drive for the parity check itself: a "208" that LOST the connection arm must make
        # the parity FAIL in the widened state (that arm decides 696 rows there).
        planted = pol208.replace(
            "\n      OR public.connection_doc_is_visible(source_connection_id, ingest_visibility)", "")
        if planted == pol208:
            raise SystemExit("the parity plant did not change the policy text — update the plant")
        pol208, expect_208 = planted, None
        print("PLANTED: the '208' policy below has NO connection arm — this run MUST report FAILED")
    live = await conn.fetchval(POLICY_Q)
    if live != V_208:
        raise SystemExit(f"the live policy is not 208's — refusing (found {live!r})")
    users = await _users(conn)
    results: dict = {}
    tr = conn.transaction()
    await tr.start()
    try:
        await conn.execute("SET LOCAL lock_timeout = '3s'")
        await conn.execute("SET LOCAL search_path TO public, extensions")
        for state in ("as-is", "widened"):
            if state == "widened":
                n_org = await conn.fetchval(
                    "WITH c AS (UPDATE public.documents SET ingest_visibility = 'org' "
                    "WHERE source_connection_id IS NOT NULL RETURNING 1) SELECT count(*) FROM c")
                n_ret = await conn.fetchval(
                    "WITH c AS (UPDATE public.documents SET source_state = 'missing_at_source' WHERE id IN ("
                    "SELECT id FROM public.documents WHERE retrievable ORDER BY md5(id::text) LIMIT 60) "
                    "RETURNING 1) SELECT count(*) FROM c")
                print(f"\nWIDENED (inside the transaction): {n_org} connection documents -> "
                      f"ingest_visibility 'org'; {n_ret} documents -> source_state 'missing_at_source' "
                      f"(retrievable is GENERATED, so this makes it false)")
            print(f"\nSTATE {state}: arms over (member, document) pairs: {await _arm_counts(conn)}")
            for label, psql, expect in (("154", POLICY_154_SQL, V_154), ("208", pol208, expect_208)):
                await _install(conn, psql, expect)
                for agent_read in (False, True):
                    results[(state, label, agent_read)] = await _fp_all(conn, users, agent_read)
    finally:
        await tr.rollback()
    after = await conn.fetchval(POLICY_Q)

    failures = []
    print("\nPARITY — documents TABLE and library_documents VIEW, policy 154 vs policy 208:")
    for state in ("as-is", "widened"):
        for agent_read in (False, True):
            a = results[(state, "154", agent_read)]
            b = results[(state, "208", agent_read)]
            diff_t = [u for u in a if a[u][0] != b[u][0]]
            diff_v = [u for u in a if a[u][1] != b[u][1]]
            rows_t = sum(x[0][0] for x in a.values())
            rows_v = sum(x[1][0] for x in a.values())
            print(f"  state={state:8} agent_read={'on ' if agent_read else 'off'}  callers={len(a)} "
                  f"(incl. <no uid>)  table rows Σ={rows_t:>6}  view rows Σ={rows_v:>6}  "
                  f"table same={len(a) - len(diff_t)}/{len(a)}  view same={len(a) - len(diff_v)}/{len(a)}")
            if diff_t or diff_v:
                failures.append(f"{state} agent_read={agent_read}: table differs for {diff_t}, view for {diff_v}")
        off = results[(state, "208", False)]
        on = results[(state, "208", True)]
        changed = sum(1 for u in off if off[u][0] != on[u][0])
        print(f"  state={state:8} agent_read on vs off changes the table for {changed} caller(s)")
    no_uid = {k: v["<no uid>"] for k, v in results.items()}
    if any(v[0][0] or v[1][0] for v in no_uid.values()):
        failures.append(f"a no-uid caller read rows: {no_uid}")
    print(f"\nrolled back; live policy == 208's again: {after == V_208}")
    if after != V_208:
        failures.append("the rollback did not restore 208's policy")
    if failures:
        print("\n*** FAILED ***")
        for f in failures:
            print(f"  · {f}")
        return 1
    print(f"\nPARITY PROVED — for all {len(users)} users and a no-uid caller, in both data states, "
          f"with app.agent_read off and on, policy 154 and policy 208 admit the SAME documents rows "
          f"(count + md5 of sorted ids) and the SAME view rows.")
    return 0


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group()
    for flag in ("--apply", "--dry-run", "--verify-only", "--prove-verify", "--parity-policy"):
        g.add_argument(flag, action="store_true")
    ap.add_argument("--old-verify", type=Path, default=None)
    ap.add_argument("--plant-drop-connection-arm", action="store_true",
                    help="with --parity-policy: RED-drive the parity check (it must FAIL)")
    args = ap.parse_args()

    _refuse_non_local()
    if not MIGRATION.is_file():
        print(f"FATAL: migration not found at {MIGRATION}")
        return 2
    sql = MIGRATION.read_text(encoding="utf-8")
    conn = await asyncpg.connect(DSN)
    try:
        if args.dry_run:
            return await mode_dry_run(conn, sql)
        if args.verify_only:
            v = _verify_sql(sql)
            a = _print_verify("VERIFY (run 1)", await _verify(conn, v))
            b = _print_verify("VERIFY (run 2)", await _verify(conn, v))
            return 0 if a and b else 1
        if args.prove_verify:
            return await mode_prove_verify(conn, sql, args.old_verify)
        if args.parity_policy:
            return await mode_parity_policy(conn, sql, args.plant_drop_connection_arm)
        return await mode_apply(conn, sql)
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(asyncio.run(main()))

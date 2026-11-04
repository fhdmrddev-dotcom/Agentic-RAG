"""Phase 304-01 — D-15 gate 1 / D-39: does narrowing current_user_org_ids() change any plan?

Run with the backend venv from the repo root, AFTER migration 221 is applied:

    backend/venv/Scripts/python scripts/explain-acting-org.py

WHAT IT PROVES. Migration 221 re-declares ``public.current_user_org_ids()`` so it intersects
membership with the transaction-local GUC ``app.acting_org_id``. 145 RLS policies and the retrieval
RPCs call that function, so a plan regression there would slow every read in the app. For the 12
representative statements below it runs ``EXPLAIN (ANALYZE, VERBOSE, ...)`` as a non-owner member
(``SET LOCAL ROLE authenticated`` + both claim GUCs, exactly as ``_apply_rls_user_context``) in five
variants:

    A  the PRE-221 function body, re-created inside the transaction (today, before 304)
    B  the live 221 function, GUC unset                                (must equal A)
    C  GUC = an org the subject is a member of
    D  GUC = the subject's other org
    E  GUC = an org the subject is NOT in                              (must see no org)

and asserts:
    · plan text A == B for every statement, after stripping run-time numbers (rows, loops,
      memory, buffers) — unset is the plan of today;
    · every plan node that outputs ``current_user_org_ids()`` reports ``loops=1`` (or ``never
      executed`` — 0 — when its branch did not run, e.g. variant E) — the function is evaluated at
      most ONCE per statement, never per row (a hashed SubPlan / a HashAggregate, measured; the
      assertion keys on loops, never on a node-type name);
    · the function's org set is {both} for A and B, {member org} for C, {other org} for D, {} for E;
    · ``pg_get_functiondef`` of the function is byte-identical before and after the run.

EVERY variant runs inside a transaction that is ROLLED BACK — including A's CREATE OR REPLACE — so
nothing persists. The subject is RESOLVED by query (a user with role ``member`` in one org and a
membership in a second), never a hard-coded uuid.

Exit 0 = gate passed · 1 = a plan or an org set changed · 2 = the database could not be reached
(a harness error, never a pass). The full output is written to
``.planning/phases/304-personal-mcp-keys-that-act-as-you/evidence/explain-acting-org.txt``.
"""

from __future__ import annotations

import asyncio
import json
import pathlib
import re
import sys
from datetime import datetime, timezone

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))
EVIDENCE = (
    REPO_ROOT / ".planning" / "phases" / "304-personal-mcp-keys-that-act-as-you" / "evidence"
    / "explain-acting-org.txt"
)

OLD_BODY = """
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid();
$function$;
"""

# The DEFINER bodies run as their owner (postgres) with the caller's claims: EXPLAIN them in that
# context. Bodies copied from the live keyword_search_chunks / match_document_chunks (INDEX branch).
KEYWORD_INNER = """
SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
       ts_rank_cd(dc.search_vector, plainto_tsquery('english', 'contract'))::float AS rank
FROM public.document_chunks dc
JOIN public.documents d ON d.id = dc.document_id
WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())
  AND (dc.user_id = auth.uid()
       OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
       OR public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility))
  AND d.retrievable
  AND dc.search_vector @@ plainto_tsquery('english', 'contract')
  AND d.is_latest = true
ORDER BY rank DESC
LIMIT 10
"""

VECTOR_INNER = """
SELECT dc.id, dc.document_id, 1 - (dc.embedding OPERATOR(public.<=>) $1::public.vector) AS similarity
FROM public.document_chunks dc
JOIN public.documents d ON d.id = dc.document_id
WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())
  AND (dc.user_id = auth.uid()
       OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
       OR public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility))
  AND d.retrievable
  AND 1 - (dc.embedding OPERATOR(public.<=>) $1::public.vector) > 0.1
  AND d.is_latest = true
ORDER BY dc.embedding OPERATOR(public.<=>) $1::public.vector
LIMIT 10
"""

AS_AUTHENTICATED = (
    ("documents (policy + RESTRICTIVE agent-read)", "SELECT id FROM public.documents WHERE is_latest LIMIT 50"),
    ("library_documents (security_invoker view, list-route shape)",
     "SELECT id, filename FROM public.library_documents WHERE is_latest ORDER BY created_at DESC, id DESC LIMIT 50"),
    ("folders", "SELECT id, parent_id FROM public.folders"),
    ("document_chunks", "SELECT id FROM public.document_chunks LIMIT 50"),
    ("document_views", "SELECT id FROM public.document_views"),
    ("document_relationships", "SELECT id FROM public.document_relationships"),
    ("workflow_definitions (published)", "SELECT id FROM public.workflow_definitions WHERE status = 'published'"),
    ("workflow_runs (+ threads subplan)", "SELECT id FROM public.workflow_runs ORDER BY created_at DESC LIMIT 20"),
    ("api_keys", "SELECT id FROM public.api_keys"),
    ("keyword_search_chunks(...) outer RPC call",
     "SELECT * FROM public.keyword_search_chunks('contract', $1::uuid, 10, NULL, NULL, NULL)"),
)

FN_TOKEN = "current_user_org_ids()"
_NODE = re.compile(r"\(actual rows=\d+(?:\.\d+)? loops=(\d+)\)")
_RUNTIME = [
    (re.compile(r"\(actual rows=[\d.]+ loops=\d+\)"), "(actual)"),
    (re.compile(r"\(never executed\)"), "(actual)"),
    (re.compile(r"(Rows Removed by [A-Za-z ]+|Heap Fetches|Memory Usage|Peak Memory Usage|Memory|Disk Usage|"
                r"Buckets|Originally|Batches|Storage|Maximum Storage|Index Searches): ?[\w.]+"), r"\1: N"),
    (re.compile(r"Sort Method: [\w -]+"), "Sort Method: M"),
]


def _strip_runtime(plan: str) -> str:
    for rx, rep in _RUNTIME:
        plan = rx.sub(rep, plan)
    return plan


def _fn_nodes(plan: str) -> list[tuple[str, int]]:
    """Every plan node whose Output names current_user_org_ids(), with its loops count."""
    lines = plan.splitlines()
    out: list[tuple[str, int]] = []
    for i, line in enumerate(lines):
        if "Output:" in line and FN_TOKEN in line:
            for j in range(i - 1, -1, -1):
                m = _NODE.search(lines[j])
                if m:
                    out.append((lines[j].strip(), int(m.group(1))))
                    break
                if "(never executed)" in lines[j]:
                    out.append((lines[j].strip(), 0))
                    break
    return out


async def _claims(conn, uid: str, *, role_swap: bool) -> None:
    if role_swap:
        await conn.execute("SET LOCAL ROLE authenticated")
    await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", uid)
    await conn.execute(
        "SELECT set_config('request.jwt.claims', $1, true)",
        json.dumps({"sub": uid, "role": "authenticated"}),
    )


async def _explain(conn, sql: str, *args) -> str:
    rows = await conn.fetch(
        "EXPLAIN (ANALYZE, VERBOSE, COSTS OFF, TIMING OFF, SUMMARY OFF, BUFFERS OFF) " + sql, *args
    )
    return "\n".join(r[0] for r in rows)


async def _variant(pool, *, uid: str, old_body: bool, acting: str | None, vec: str | None) -> dict:
    out: dict = {}
    async with pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            if old_body:
                await conn.execute(OLD_BODY)
            await _claims(conn, uid, role_swap=False)
            if acting:
                await conn.execute("SELECT set_config('app.acting_org_id', $1, true)", acting)
            out["[definer body] keyword_search_chunks"] = await _explain(conn, KEYWORD_INNER)
            if vec is not None:
                out["[definer body] match_document_chunks INDEX branch"] = await _explain(conn, VECTOR_INNER, vec)
            out["__orgs"] = sorted(str(r[0]) for r in await conn.fetch("SELECT public.current_user_org_ids()"))
            await _claims(conn, uid, role_swap=True)
            for name, sql in AS_AUTHENTICATED:
                args = (uid,) if "$1" in sql else ()
                out[name] = await _explain(conn, sql, *args)
        finally:
            await tx.rollback()
    return out


async def _run(lines: list[str]) -> bool:
    import os

    import asyncpg

    os.chdir(REPO_ROOT / "backend")
    from app.config import settings

    async def _init(conn):
        await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")

    pool = await asyncpg.create_pool(settings.postgres_dsn, min_size=1, max_size=2, init=_init)
    ok = True
    try:
        async with pool.acquire() as c:
            before = await c.fetchval("SELECT pg_get_functiondef('public.current_user_org_ids()'::regprocedure)")
            if "app.acting_org_id" not in before:
                lines.append("FAIL: migration 221 is not applied (the live function does not read app.acting_org_id)")
                return False
            subject = await c.fetchrow(
                """
                SELECT m.user_id, m.org_id AS member_org, o.org_id AS other_org
                  FROM public.org_members m
                  JOIN public.org_members o ON o.user_id = m.user_id AND o.org_id <> m.org_id
                 WHERE m.role = 'member'
                 ORDER BY (SELECT count(*) FROM public.documents d WHERE d.user_id = m.user_id) DESC,
                          m.user_id, m.org_id, o.org_id
                 LIMIT 1
                """
            )
            if subject is None:
                lines.append("FAIL: no user is role 'member' in one org and a member of a second (no subject)")
                return False
            uid, member_org, other_org = (str(subject[k]) for k in ("user_id", "member_org", "other_org"))
            non_member = await c.fetchval(
                "SELECT id FROM public.organizations WHERE id NOT IN"
                " (SELECT org_id FROM public.org_members WHERE user_id = $1) ORDER BY id LIMIT 1",
                subject["user_id"],
            )
            non_member = str(non_member) if non_member else "00000000-0000-0000-0000-000000000001"
            vec = await c.fetchval(
                "SELECT embedding::text FROM public.document_chunks WHERE embedding IS NOT NULL LIMIT 1"
            )

        lines.append(f"subject (resolved by query): user {uid} — role 'member' in {member_org}, also in {other_org}")
        lines.append(f"non-member org (variant E): {non_member}")
        if vec is None:
            lines.append("note: no embedded chunk exists, so the match_document_chunks body is not explained")

        A = await _variant(pool, uid=uid, old_body=True, acting=None, vec=vec)
        B = await _variant(pool, uid=uid, old_body=False, acting=None, vec=vec)
        C = await _variant(pool, uid=uid, old_body=False, acting=member_org, vec=vec)
        D = await _variant(pool, uid=uid, old_body=False, acting=other_org, vec=vec)
        E = await _variant(pool, uid=uid, old_body=False, acting=non_member, vec=vec)

        async with pool.acquire() as c:
            after = await c.fetchval("SELECT pg_get_functiondef('public.current_user_org_ids()'::regprocedure)")
        same_fn = before == after
        lines.append(f"pg_get_functiondef unchanged after the run (every variant rolled back): {same_fn}")
        ok &= same_fn

        both = sorted({member_org, other_org})
        expected_orgs = {"A": None, "B": None, "C": [member_org], "D": [other_org], "E": []}
        for tag, v in (("A", A), ("B", B), ("C", C), ("D", D), ("E", E)):
            exp = expected_orgs[tag]
            if exp is None:
                good = set(both) <= set(v["__orgs"]) and v["__orgs"] == A["__orgs"]
            else:
                good = v["__orgs"] == exp
            lines.append(f"org set {tag}: {v['__orgs']}  {'OK' if good else 'FAIL'}")
            ok &= good

        statements = [k for k in A if not k.startswith("__")]
        lines.append(f"statements explained: {len(statements)}")
        all_equal = True
        all_once = True
        for k in statements:
            same = _strip_runtime(A[k]) == _strip_runtime(B[k])
            nodes = {tag: _fn_nodes(v[k]) for tag, v in (("A", A), ("B", B), ("C", C), ("D", D), ("E", E))}
            # Once per statement, never per row: loops=1, or 0 when the branch never ran ("never executed").
            once = all(loops <= 1 for ns in nodes.values() for _line, loops in ns)
            ran_b = sum(1 for _line, loops in nodes["B"] if loops == 1)
            shape_c = _strip_runtime(A[k]) == _strip_runtime(C[k])
            all_equal &= same
            all_once &= once
            lines.append("")
            lines.append(f"######## {k}")
            lines.append(
                f"A == B (plan unchanged, GUC unset): {same} | current_user_org_ids() nodes "
                f"{len(nodes['B'])} ({ran_b} executed, loops=1 each), all loops<=1 in A-E: {once} | A ~ C shape: {shape_c}"
            )
            for line, loops in nodes["B"]:
                lines.append(f"   fn node (B): {line}")
            lines.append("---- A (pre-221 body)")
            lines.append(A[k])
            if not same:
                lines.append("---- B (221, GUC unset) — DIFFERS")
                lines.append(B[k])
            lines.append("---- C (221, GUC = member org)")
            lines.append(C[k])
        ok &= all_equal and all_once
        lines.append("")
        lines.append(
            f"VERDICT: A == B for all {len(statements)} statements: {all_equal}; "
            f"every current_user_org_ids() node loops=1 (or never executed), never per row: {all_once}; "
            f"function unchanged: {same_fn}"
        )
    finally:
        await pool.close()
    return ok


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # pragma: no cover
        pass
    lines = [
        "Phase 304-01 — EXPLAIN evidence for app.acting_org_id narrowing (D-15 gate 1, D-39)",
        f"generated {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')} by scripts/explain-acting-org.py",
        "",
    ]
    try:
        ok = asyncio.run(_run(lines))
    except (OSError, ConnectionError) as exc:
        print(f"FATAL: could not reach the local database: {type(exc).__name__}: {exc}")
        return 2
    lines.append("GATE PASSED" if ok else "GATE FAILED")
    text = "\n".join(lines) + "\n"
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(text, encoding="utf-8")
    summary = [ln for ln in lines if ln.startswith(("subject", "org set", "pg_get", "statements", "VERDICT", "GATE"))]
    print("\n".join(summary))
    print(f"evidence: {EVIDENCE.relative_to(REPO_ROOT)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

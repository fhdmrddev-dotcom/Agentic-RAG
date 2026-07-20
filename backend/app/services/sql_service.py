from __future__ import annotations

import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client

from app.dependencies import get_user_pg_connection

import re


def _detect_alias(sql: str, table: str) -> str:
    """Detect if a table has an alias (e.g. 'documents d' or 'documents AS d')."""
    m = re.search(
        rf"\b{table}\b(?:\s+AS\s+|\s+)([a-zA-Z_]\w*)",
        sql, re.IGNORECASE,
    )
    if m:
        alias = m.group(1).lower()
        skip = {"where", "order", "group", "limit", "having", "on", "join",
                "left", "right", "inner", "outer", "cross", "full", "natural",
                "set", "and", "or", "not", "in", "is", "as", "select"}
        if alias not in skip:
            return m.group(1)
    return table


def _inject_folder_scope(sql: str, folder_ids: list[str]) -> str:
    """Inject folder_id IN (...) filter to restrict to a folder subtree."""
    if not folder_ids:
        return sql
    ids_list = ", ".join(f"'{fid}'" for fid in folder_ids)
    has_documents = bool(re.search(r"\bdocuments\b", sql, re.IGNORECASE))
    has_folders = bool(re.search(r"\bfolders\b", sql, re.IGNORECASE))
    if has_folders and not has_documents:
        folder_ref = _detect_alias(sql, "folders")
        condition = f"{folder_ref}.id IN ({ids_list})"
    else:
        doc_ref = _detect_alias(sql, "documents")
        condition = f"{doc_ref}.folder_id IN ({ids_list})"
    # Already has a WHERE clause — append AND
    if re.search(r"\bwhere\b", sql, re.IGNORECASE):
        return sql.rstrip() + f" AND {condition}"
    return sql + f" WHERE {condition}"


async def query_documents(sql_query: str, user_id: str, supabase: Client, folder_ids: list[str] | None = None) -> str:
    """
    Execute a SELECT query against the user's documents via the query_user_documents RPC,
    run over the Phase-163 asyncpg user-context (D-164-02/04).

    query_user_documents is INVOKER (no SECURITY clause) — its dynamic EXECUTE runs as the
    caller's role, so once the RPC is invoked on the user-context connection (SET LOCAL ROLE
    authenticated + uid-synthesized claims) RLS scopes every base-table read to the caller's
    org. That RLS gate is what replaced the deleted per-user WHERE-injection regex (RESEARCH
    Pitfall 4 — deleting the regex is safe ONLY because the connection is now user-context). The
    ``supabase`` param is retained for call-site signature stability but is no longer used.
    """
    clean = sql_query.strip()

    # Client-side validation — defence-in-depth before the DB call (query_user_documents
    # re-checks SELECT-only + single-statement server-side too). RETAINED per D-164-04.
    if not clean.lower().startswith("select"):
        raise ValueError("Only SELECT queries are permitted.")
    if ";" in clean:
        raise ValueError("Query must be a single statement (no semicolons).")

    # Feature-narrowing to a chosen folder subtree — relevance, NOT a cross-user gate (RLS
    # via the user-context owns cross-user/cross-org isolation now). KEPT per D-164-04 / A4.
    scoped = clean
    if folder_ids:
        scoped = _inject_folder_scope(scoped, folder_ids)

    # Route the INVOKER RPC over the asyncpg user-context so RLS scopes the arbitrary SELECT.
    try:
        async with get_user_pg_connection(None, {"id": user_id}) as conn:
            data = await conn.fetchval("SELECT public.query_user_documents($1)", scoped)
    except Exception as e:
        raise RuntimeError(f"Database query failed: {e}") from e

    rows: list[dict] = data or []

    if not rows:
        return "No results."

    # Format as markdown table for ≤10 rows, otherwise compact JSON (capped at 20)
    if len(rows) <= 10:
        return _to_markdown_table(rows)

    truncated = rows[:20]
    note = f"\n\n*(Showing 20 of {len(rows)} results)*" if len(rows) > 20 else ""
    return json.dumps(truncated, default=str, indent=2) + note


def _to_markdown_table(rows: list[dict]) -> str:
    if not rows:
        return "No results."
    headers = list(rows[0].keys())
    header_row = " | ".join(headers)
    separator = " | ".join("---" for _ in headers)
    data_rows = [
        " | ".join(str(row.get(h, "")) for h in headers)
        for row in rows
    ]
    return "\n".join([header_row, separator, *data_rows])

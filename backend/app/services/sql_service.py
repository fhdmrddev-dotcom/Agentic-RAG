from __future__ import annotations

import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client


import re


def _inject_user_id(sql: str, user_id: str) -> str:
    """
    Inject a user_id WHERE clause into the query.
    The service role client bypasses RLS, so we must scope manually.

    Rules:
    - documents-only query  → documents.user_id = '{user_id}'
    - folders-only query    → (folders.user_id = '{user_id}' OR folders.is_global = true)
    - JOIN (both tables)    → documents.user_id = '{user_id}'  (documents already scopes the user)
    """
    has_documents = bool(re.search(r"\bdocuments\b", sql, re.IGNORECASE))
    has_folders = bool(re.search(r"\bfolders\b", sql, re.IGNORECASE))

    if has_folders and not has_documents:
        condition = f"(folders.user_id = '{user_id}' OR folders.is_global = true)"
    else:
        # documents-only or JOIN — scope via documents table
        condition = f"documents.user_id = '{user_id}'"

    # Already has a WHERE clause — append AND
    if re.search(r"\bwhere\b", sql, re.IGNORECASE):
        return re.sub(
            r"\b(where)\b",
            f"WHERE {condition} AND",
            sql, count=1, flags=re.IGNORECASE,
        )
    # Has ORDER BY / GROUP BY / LIMIT / HAVING — insert WHERE before them
    match = re.search(r"\b(order\s+by|group\s+by|limit|having)\b", sql, re.IGNORECASE)
    if match:
        pos = match.start()
        return sql[:pos] + f"WHERE {condition} " + sql[pos:]
    # Plain query — append at end
    return sql + f" WHERE {condition}"


def query_documents(sql_query: str, user_id: str, supabase: Client) -> str:
    """
    Execute a SELECT query against the user's documents table via the
    query_user_documents RPC. Injects user_id filter since the service role
    client bypasses RLS.
    """
    clean = sql_query.strip()

    # Client-side validation — defence-in-depth before the DB call
    if not clean.lower().startswith("select"):
        raise ValueError("Only SELECT queries are permitted.")
    if ";" in clean:
        raise ValueError("Query must be a single statement (no semicolons).")

    # Scope to current user (service role bypasses RLS)
    scoped = _inject_user_id(clean, user_id)

    try:
        result = supabase.rpc("query_user_documents", {"sql_query": scoped}).execute()
    except Exception as e:
        raise RuntimeError(f"Database query failed: {e}") from e

    rows: list[dict] = result.data or []

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

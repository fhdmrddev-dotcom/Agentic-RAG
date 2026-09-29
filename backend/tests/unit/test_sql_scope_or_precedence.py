"""BUG-260929-01 — `_inject_folder_scope` must bind the folder filter to the WHOLE existing WHERE.

SQL binds AND tighter than OR, so appending ``AND d.folder_id IN (...)`` to
``WHERE a OR b OR c`` scoped ONLY ``c``: a restricted Expert's `query_documents` returned a sibling
Expert's document in the same org (269-03 evidence/06-security-compliance-refusal.txt). The
existing predicate must be parenthesised before the folder condition is ANDed on.
"""
from __future__ import annotations

import re

import pytest

from app.services.sql_service import _inject_folder_scope

IDS = ["11111111-1111-1111-1111-111111111111"]
COND = "d.folder_id IN ('11111111-1111-1111-1111-111111111111')"


def _where_body(sql: str) -> str:
    m = re.search(r"\bwhere\b(.*?)(?:\border\s+by\b|\bgroup\s+by\b|\bhaving\b|\blimit\b|\boffset\b|$)", sql, re.I | re.S)
    assert m, sql
    return m.group(1).strip()


def _top_level_ands(body: str) -> list[str]:
    """Split on AND at parenthesis depth 0 — what SQL precedence treats as the outermost conjunction."""
    parts, depth, cur, i = [], 0, "", 0
    while i < len(body):
        ch = body[i]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if depth == 0 and re.match(r"\s+and\s+", body[i:], re.I):
            parts.append(cur.strip())
            cur = ""
            i += re.match(r"\s+and\s+", body[i:], re.I).end()
            continue
        cur += ch
        i += 1
    parts.append(cur.strip())
    return parts


def _top_level_or_present(part: str) -> bool:
    depth = 0
    for m in re.finditer(r"[()]|\bor\b", part, re.I):
        t = m.group(0)
        if t == "(":
            depth += 1
        elif t == ")":
            depth -= 1
        elif depth == 0:
            return True
    return False


def test_or_where_is_parenthesised_so_the_folder_filter_covers_every_branch():
    sql = (
        "SELECT d.filename FROM documents d WHERE d.filename ILIKE '%revenue%' "
        "OR d.filename ILIKE '%financial%' OR d.metadata->>'title' ILIKE '%revenue%'"
    )
    out = _inject_folder_scope(sql, IDS)
    parts = _top_level_ands(_where_body(out))
    assert COND in parts, out
    others = [p for p in parts if p != COND]
    assert others, out
    # the whole original predicate sits in ONE parenthesised group: no bare top-level OR remains
    assert not any(_top_level_or_present(p) for p in parts), out


def test_or_where_with_trailing_order_by_and_limit():
    sql = "SELECT d.id FROM documents d WHERE d.a = 1 OR d.b = 2 ORDER BY d.id LIMIT 5"
    out = _inject_folder_scope(sql, IDS)
    parts = _top_level_ands(_where_body(out))
    assert COND in parts, out
    assert not any(_top_level_or_present(p) for p in parts), out
    assert out.rstrip().endswith("LIMIT 5") and "ORDER BY d.id LIMIT 5" in out


def test_no_where_still_opens_a_where():
    out = _inject_folder_scope("SELECT d.id FROM documents d", IDS)
    assert out.endswith(f"WHERE {COND}"), out


def test_plain_single_predicate_stays_scoped():
    out = _inject_folder_scope("SELECT d.id FROM documents d WHERE d.a = 1", IDS)
    parts = _top_level_ands(_where_body(out))
    assert COND in parts and "d.a = 1" in " ".join(parts), out


@pytest.mark.parametrize("sql", [
    "SELECT * FROM documents WHERE a = 1 OR b = 2",
    "SELECT * FROM documents AS docs WHERE a = 1 OR b = 2 GROUP BY a",
])
def test_unaliased_and_as_alias_shapes(sql):
    out = _inject_folder_scope(sql, IDS)
    assert re.search(r"\(\s*a = 1 OR b = 2\s*\)", out), out

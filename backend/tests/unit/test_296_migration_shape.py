"""Phase 296-01 — migration 216's SHAPE, plus the 215 backfill-regex narrowing, pinned against text.

SEED-364 / D-06: a personal org created at signup used to be named
``coalesce(new.email, new.id::text) || '''s Organization'`` — the founder's email, visible to every
colleague later invited into that org. Migration 216 replaces that ONE expression with the constant
``'My organization'``. A constant is the only expression that cannot carry an email. No existing
org row is renamed (D-06), so the migration must contain no UPDATE of ``public.organizations``.

The greenfield supplement (``scripts/full-schema-supplement.sql``) carries its own copy of
``handle_new_user`` that is appended LAST in ``full-schema.sql``; if it kept the email expression a
greenfield deploy would silently re-introduce the leak. So it is pinned here too (D-25).

293-IN-05: migration 215's backfill predicate ``~* '^[0-9a-f-]{36}$'`` admits 36 dashes. It is
narrowed in place to the canonical 8-4-4-4-12 pattern (D-17: it ran locally only; cloud holds 0
``_schedule_id`` rows).

⚠ Every assertion runs over the SQL text with ``--`` comments STRIPPED, so header prose cannot
satisfy or break an assertion. This reads TEXT, never a database; the applied state is measured by
``scripts/check-migration-216-live.py``.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
SUPPLEMENT = REPO_ROOT / "scripts" / "full-schema-supplement.sql"

CANONICAL_UUID_RE = "'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'"
LOOSE_UUID_RE = "'^[0-9a-f-]{36}$'"


def _migration(prefix: str) -> Path:
    matches = sorted(MIGRATIONS.glob(f"{prefix}_*.sql"))
    assert len(matches) == 1, matches
    return matches[0]


def _strip_comments(sql: str) -> str:
    out = []
    for line in sql.splitlines():
        idx = line.find("--")
        if idx != -1:
            line = line[:idx]
        if line.strip():
            out.append(line)
    return "\n".join(out)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _code216() -> str:
    return _strip_comments(_migration("216").read_text(encoding="utf-8"))


def _function_body216() -> str:
    """The comment-stripped handle_new_user body ($$ … $$), excluding the trailing VERIFY select,
    which legitimately names ``new.email`` inside a NOT LIKE pattern."""
    code = _code216()
    start = code.find("$$")
    end = code.find("$$", start + 2)
    assert start != -1 and end != -1, "216 has no $$-quoted function body"
    return code[start:end]


def _supplement_handle_new_user() -> str:
    code = _strip_comments(SUPPLEMENT.read_text(encoding="utf-8"))
    start = code.lower().find("create or replace function public.handle_new_user()")
    assert start != -1, "supplement lost its handle_new_user copy"
    end = code.find("$$;", start)
    assert end != -1
    return code[start:end]


def _create_org_call(body: str) -> str:
    lower = body.lower()
    start = lower.find("create_org_with_default_dept(")
    assert start != -1, "no create_org_with_default_dept( call"
    end = lower.find(";", start)
    return body[start:end]


# ── migration 216 ────────────────────────────────────────────────────────────


def test_exactly_one_216_migration() -> None:
    _migration("216")


def test_216_replaces_handle_new_user() -> None:
    assert "create or replace function public.handle_new_user()" in _norm(_code216()).lower()


def test_216_org_name_has_no_email() -> None:
    body = _function_body216()
    assert "new.email" not in body.lower()
    assert "email" not in _create_org_call(body).lower()


def test_216_verify_select_checks_the_name() -> None:
    code = _code216()
    tail = code[code.rfind("$$;"):]
    assert "pg_get_functiondef('public.handle_new_user()'::regprocedure)" in tail
    assert "My organization" in tail and "'PASS'" in tail


def test_216_uses_the_constant_name() -> None:
    assert "'My organization'" in _create_org_call(_code216())


def test_216_keeps_definer_search_path_and_swallow() -> None:
    code = _norm(_code216()).lower()
    assert "security definer" in code
    assert "set search_path" in code and "public" in code
    assert "exception when others then raise warning" in code
    assert "if not exists (select 1 from public.org_members" in code


def test_216_renames_no_existing_org() -> None:
    code = _norm(_code216()).lower()
    assert "update public.organizations" not in code
    assert "update organizations" not in code


# ── greenfield supplement copy (same commit, D-25) ───────────────────────────


def test_supplement_copy_uses_the_constant_name() -> None:
    call = _create_org_call(_supplement_handle_new_user())
    assert "'My organization'" in call
    assert "new.email" not in call.lower()


# ── migration 215 backfill regex (293-IN-05) ─────────────────────────────────


def test_215_backfill_regex_is_canonical() -> None:
    code = _strip_comments(_migration("215").read_text(encoding="utf-8"))
    assert CANONICAL_UUID_RE in code
    assert LOOSE_UUID_RE not in code

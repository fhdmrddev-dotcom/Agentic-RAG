"""Phase 275-01 — migration 205's SHAPE, pinned against its text (D-18, D-21, D-33, D-36; revisions
W-1, W-1b; T-275-06/09/11/39).

Migration 205 makes ``documents.retrievable`` (a STORED generated column) the ONE home of "may an
agent read this document": both search RPCs use ``AND d.retrievable``; ``query_user_documents`` —
the door for model-written SQL — switches a transaction-local GUC on, and four RESTRICTIVE policies
hide non-retrievable rows only while it is on.

⛔ The properties that matter, and the plant that turns each red (driven at 275-01):
  * ``ANALYZE public.documents`` AFTER the column add — PLANT: move it above. Measured without
    statistics the vector arm went 25 ms → 943 ms (RESEARCH M-1, Pitfall 1).
  * both ``SET`` clauses in both RPC headers — PLANT: drop ``plan_cache_mode``. CREATE OR REPLACE
    replaces the SET list, which would undo migration 201 (also guarded by test_272_review_fixes).
  * zero ``source_disconnected`` left in the code — PLANT: restore the mig-200 clause in one arm.
    Three copies of the predicate drifting is how BUG-261004-01 happened.
  * the ``set_config`` / ``current_setting`` / ``u&`` refusal BEFORE ``EXECUTE`` — PLANT: move it
    after. Model SQL could otherwise switch the GUC off and read archived chunks (W-1, W-1b).

⚠ Assertions run over comment-stripped text; the live behaviour is ``test_275_retrievable.py``.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"


def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("205_*.sql"))
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


def _code() -> str:
    return _norm(_strip_comments(_migration().read_text(encoding="utf-8")))


def _function(code: str, name: str) -> tuple[str, str]:
    m = re.search(
        rf"CREATE OR REPLACE FUNCTION public\.{name}\((.*?)\$(\w*)\$(.*?)\$\2\$", code, re.S,
    )
    assert m, f"no definition of {name}"
    return m.group(1), m.group(3)


def test_the_generated_column_is_the_positive_form():
    code = _code()
    assert (
        "ADD COLUMN IF NOT EXISTS retrievable boolean GENERATED ALWAYS AS "
        "(archived_at IS NULL AND (source_state IS NULL OR source_state = 'live')) STORED"
    ) in code


def test_analyze_follows_the_column_add():
    code = _code()
    add = code.find("ADD COLUMN IF NOT EXISTS retrievable")
    analyze = code.find("ANALYZE public.documents")
    assert add != -1 and analyze > add


def test_both_rpcs_use_the_column_in_every_branch():
    code = _code()
    assert code.count("AND d.retrievable") == 3, "exact + index branch + keyword"
    assert "source_disconnected" not in code, "the predicate must live in the column, never restated"
    for fn in ("match_document_chunks", "keyword_search_chunks"):
        header, body = _function(code, fn)
        assert "SET search_path TO ''" in header and "SET plan_cache_mode TO 'force_custom_plan'" in header, fn
        assert "SECURITY DEFINER" in header, fn
        assert "d.retrievable" in body, fn


def test_the_rpc_acl_is_reasserted():
    code = _code()
    for sig in (
        "public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer)",
        "public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[])",
    ):
        for role in ("PUBLIC", "anon"):
            assert f"REVOKE EXECUTE ON FUNCTION {sig} FROM {role}" in code, (sig, role)
        for role in ("authenticated", "service_role"):
            assert f"GRANT EXECUTE ON FUNCTION {sig} TO {role}" in code, (sig, role)


def test_query_user_documents_refuses_guc_text_before_it_executes():
    code = _code()
    header, body = _function(code, "query_user_documents")
    assert "SECURITY DEFINER" not in header, "model SQL must run as the caller (INVOKER)"
    refusal = re.search(r"IF clean_query ~\* '([^']|'')*' THEN RAISE EXCEPTION", body)
    assert refusal, "no case-insensitive refusal"
    pattern = refusal.group(0)
    for word in ("set_config", "current_setting", "u&"):
        assert word in pattern, word
    execute = body.find("EXECUTE format(")
    switch = body.find("set_config('app.agent_read', 'on', true)")
    assert -1 < refusal.start() < switch < execute, "refusal → GUC on → EXECUTE, in that order"
    assert "REVOKE EXECUTE ON FUNCTION public.query_user_documents(text) FROM PUBLIC" in code
    assert "REVOKE EXECUTE ON FUNCTION public.query_user_documents(text) FROM anon" in code
    assert "GRANT EXECUTE ON FUNCTION public.query_user_documents(text) TO authenticated" in code


def test_four_restrictive_policies_keyed_on_the_guc():
    code = _code()
    assert code.count("AS RESTRICTIVE") == 4
    for table in ("documents", "document_chunks", "document_tables", "document_images"):
        m = re.search(
            rf"CREATE POLICY {table}_agent_read_retrievable ON public\.{table} AS RESTRICTIVE FOR SELECT "
            rf"TO authenticated USING \((.*?)\);", code,
        )
        assert m, table
        assert "current_setting('app.agent_read', true) IS DISTINCT FROM 'on'" in m.group(1), table


def test_the_helper_is_not_public():
    code = _code()
    header, _ = _function(code, "document_is_retrievable")
    assert "SECURITY DEFINER" in header and "SET search_path TO ''" in header and "STABLE" in header
    assert "REVOKE EXECUTE ON FUNCTION public.document_is_retrievable(uuid) FROM PUBLIC" in code
    assert "REVOKE EXECUTE ON FUNCTION public.document_is_retrievable(uuid) FROM anon" in code

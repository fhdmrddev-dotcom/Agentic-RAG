"""Phase 294-03 — migration 211's SHAPE, pinned against its text (D-15, T-294-14 / T-294-16).

Migration 211 creates ``public.message_citation_checks``: one stored citation-check result per
assistant message. Owners may READ their own rows (the messages SELECT predicate, verbatim); no
client role may write, so a verdict can never be forged from the browser. The backend writes
through the asyncpg pool, and a re-check REPLACES the stored row (``ON CONFLICT DO UPDATE``), so
service_role holds UPDATE here (unlike 202, whose artifacts are immutable).

⚠ Every assertion runs over the migration text with ``--`` comments STRIPPED, so header prose
cannot satisfy or break an assertion. This checks TEXT, not a live database; the applied state is
measured by ``scripts/apply_migration_211.py`` (its VERIFY output is quoted in 294-03-SUMMARY.md).

⚠ The 211 table is deliberately NOT asserted in ``supabase/full-schema.sql``: that file is a
pg_dump artifact regenerated only with docker (owed operator step). The messages SELECT predicate
IS read from it, because that policy predates this phase.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
SUPPLEMENT = REPO_ROOT / "scripts" / "full-schema-supplement.sql"
FULL_SCHEMA = REPO_ROOT / "supabase" / "full-schema.sql"
TABLE = "public.message_citation_checks"


def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("211_*.sql"))
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


def _raw() -> str:
    return _migration().read_text(encoding="utf-8")


def _code() -> str:
    return _strip_comments(_raw())


def _statements() -> list[str]:
    return [_norm(s) for s in _code().split(";") if s.strip()]


def _pred(s: str) -> str:
    """Normalise a policy predicate: no whitespace, lower case, redundant outer parens removed."""
    s = re.sub(r"\s+", "", s).lower()
    while s.startswith("(") and s.endswith(")"):
        depth, balanced = 0, True
        for i, ch in enumerate(s):
            depth += ch == "("
            depth -= ch == ")"
            if depth == 0 and i < len(s) - 1:
                balanced = False
                break
        if not balanced:
            break
        s = s[1:-1]
    return s


def _messages_select_predicate() -> str:
    text = FULL_SCHEMA.read_text(encoding="utf-8")
    pols = re.findall(r"^CREATE POLICY .* ON public\.messages FOR SELECT TO authenticated USING \((.*)\);$",
                      text, re.M)
    assert len(pols) == 1, f"expected ONE messages SELECT policy in full-schema.sql, found {len(pols)}"
    return pols[0]


# ── file ────────────────────────────────────────────────────────────────────────────────────────


def test_exactly_one_211_migration_with_a_digits_only_prefix():
    p = _migration()
    assert re.fullmatch(r"211_[a-z0-9_]+\.sql", p.name), p.name


def test_211_is_unique_and_every_later_migration_is_numbered_after_it():
    # Was `test_211_is_the_latest_migration`, which pinned 211 as the newest file and so had to
    # fail on the next migration. Retired deliberately on 2026-10-23 when 212 (the drafting-model
    # setting) landed. What it was protecting still holds: 211 has one file, and nothing is
    # numbered into the gap before it.
    names = sorted(p.name for p in MIGRATIONS.glob("*.sql"))
    assert [n for n in names if n.startswith("211_")] == [_migration().name], names[-3:]
    later = [n for n in names if n > _migration().name]
    assert all(int(n.split("_", 1)[0]) > 211 for n in later), later


def test_the_migration_owns_its_transaction():
    stmts = _statements()
    assert stmts[0] == "BEGIN", stmts[0]
    assert "COMMIT" in stmts


# ── table ───────────────────────────────────────────────────────────────────────────────────────


def test_table_columns_and_keys():
    code = _norm(_code())
    assert f"CREATE TABLE IF NOT EXISTS {TABLE}" in code
    assert re.search(r"message_id uuid PRIMARY KEY REFERENCES public\.messages\(id\) ON DELETE CASCADE", code)
    assert re.search(r"thread_id uuid NOT NULL REFERENCES public\.threads\(id\) ON DELETE CASCADE", code)
    assert re.search(r"user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE", code)
    assert re.search(r"org_id uuid NOT NULL[,\s]", code)
    assert re.search(r"engine text NOT NULL CHECK \(engine IN \('jev', ?'openai_decisions'\)\)", code)
    assert re.search(r"model text NOT NULL[,\s]", code)
    assert re.search(r"result jsonb NOT NULL[,\s]", code)
    assert re.search(r"input_tokens integer[,\s]", code)
    assert re.search(r"cost_usd numeric[,\s]", code)
    assert re.search(r"created_at timestamptz NOT NULL DEFAULT now\(\)", code)
    assert re.search(r"updated_at timestamptz NOT NULL DEFAULT now\(\)", code)


def engine_check_labels() -> set[str]:
    """The engine CHECK's labels. test_294_citation_claims pins them to ``CheckEngineId``."""
    m = re.search(r"CHECK \(engine IN \(([^)]*)\)\)", _norm(_code()))
    assert m, "engine CHECK missing"
    return set(re.findall(r"'([^']*)'", m.group(1)))


def test_engine_check_is_the_two_check_engines():
    assert engine_check_labels() == {"jev", "openai_decisions"}


def test_user_id_index():
    assert re.search(rf"CREATE INDEX IF NOT EXISTS \w+ ON {re.escape(TABLE)} \(user_id\)", _norm(_code()))


def test_rls_enabled():
    assert f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY" in _norm(_code())


# ── triggers: reuse the shared functions, create none ──────────────────────────────────────────


def test_org_autofill_trigger_matches_messages():
    assert re.search(
        r"CREATE TRIGGER message_citation_checks_autofill_org_id BEFORE INSERT ON public\.message_citation_checks "
        r"FOR EACH ROW EXECUTE FUNCTION public\.autofill_org_id_by_owner\('user_id'\)",
        _norm(_code()),
    )


def test_updated_at_trigger_reuses_the_shared_function():
    assert re.search(
        r"CREATE TRIGGER message_citation_checks_set_updated_at BEFORE UPDATE ON public\.message_citation_checks "
        r"FOR EACH ROW EXECUTE FUNCTION public\.set_updated_at\(\)",
        _norm(_code()),
    )


def test_no_new_function_is_created():
    assert not re.search(r"CREATE (OR REPLACE )?FUNCTION", _code(), re.I)


# ── privileges ─────────────────────────────────────────────────────────────────────────────────


def _table_grants() -> list[tuple[set[str], set[str], str]]:
    out = []
    for stmt in _statements():
        if not stmt.upper().startswith("GRANT") or f"ON TABLE {TABLE}" not in stmt:
            continue
        m = re.match(rf"GRANT (.+?) ON TABLE {re.escape(TABLE)} TO (.+)$", stmt, re.I)
        assert m, f"unparseable grant: {stmt}"
        privs = {p.strip().upper() for p in m.group(1).split(",")}
        grantees = {g.strip().lower() for g in m.group(2).split(",")}
        out.append((privs, grantees, stmt))
    return out


def test_every_role_is_revoked_public_first_and_before_any_grant():
    stmts = _statements()

    def idx(role: str) -> int:
        target = f"REVOKE ALL ON TABLE {TABLE} FROM {role}"
        hits = [i for i, s in enumerate(stmts) if s == target]
        assert len(hits) == 1, target
        return hits[0]

    revokes = {r: idx(r) for r in ("PUBLIC", "anon", "authenticated", "service_role")}
    assert revokes["PUBLIC"] == min(revokes.values())
    first_grant = min(i for i, s in enumerate(stmts) if s.startswith("GRANT") and f"ON TABLE {TABLE}" in s)
    assert max(revokes.values()) < first_grant


def test_grants_are_select_to_authenticated_and_crud_to_service_role_only():
    grants = _table_grants()
    assert len(grants) == 2, grants  # non-vacuous
    by_role = {next(iter(g[1])): g[0] for g in grants}
    assert by_role == {
        "authenticated": {"SELECT"},
        "service_role": {"SELECT", "INSERT", "UPDATE", "DELETE"},
    }, by_role
    assert not any("anon" in g[1] or "public" in g[1] for g in grants)


def test_no_grant_to_anon_anywhere():
    assert not re.search(r"grant .* to anon", _code(), re.I)


def test_exactly_one_policy_select_with_the_messages_predicate():
    policies = [s for s in _statements() if s.upper().startswith("CREATE POLICY")]
    assert len(policies) == 1, policies
    pol = policies[0]
    assert f"ON {TABLE}" in pol
    assert "FOR SELECT TO authenticated" in pol, pol
    using = re.search(r"USING \((.*)\)$", pol)
    assert using, pol
    assert _pred(using.group(1)) == _pred(_messages_select_predicate())


def test_not_added_to_the_realtime_publication():
    assert not re.search(r"ALTER PUBLICATION", _code(), re.I)
    # The only mention of supabase_realtime is the VERIFY check (in the commented block).
    assert "supabase_realtime" not in _code()
    assert "supabase_realtime" in _raw()


def test_no_statement_writes_rows():
    for stmt in _statements():
        assert not re.match(rf"^(INSERT INTO|UPDATE|DELETE FROM)\s+{re.escape(TABLE)}", stmt, re.I), stmt


# ── VERIFY block ───────────────────────────────────────────────────────────────────────────────


def test_verify_block_covers_the_required_rows():
    raw = _raw()
    assert "-- VERIFY" in raw and "with checks(what, ok) as (values" in raw
    verify = raw[raw.index("-- VERIFY"):]
    for what in (
        "RLS enabled",
        "exactly one policy",
        "the one policy is SELECT",
        "anon cannot SELECT",
        "authenticated can SELECT",
        "authenticated cannot INSERT",
        "authenticated cannot UPDATE",
        "authenticated cannot DELETE",
        "service_role can UPDATE",
        "org autofill trigger present",
        "not in supabase_realtime",
    ):
        assert what in verify, what


# ── supplement mirror (pg_dump --no-privileges loses every grant) ───────────────────────────────


def test_every_acl_statement_is_mirrored_verbatim_in_the_supplement():
    supplement_raw = SUPPLEMENT.read_text(encoding="utf-8")
    assert "-- migration 211" in supplement_raw
    supplement_stmts = [_norm(s) for s in _strip_comments(supplement_raw).split(";") if s.strip()]
    acl = [s for s in _statements() if re.match(r"^(GRANT|REVOKE)\b", s, re.I)]
    assert len(acl) == 6, acl  # 4 REVOKE + 2 GRANT
    mirrored = [s for s in supplement_stmts if TABLE in s]
    assert mirrored == acl, (mirrored, acl)


def test_supplement_revokes_public_exactly_once():
    text = SUPPLEMENT.read_text(encoding="utf-8")
    assert text.count(f"REVOKE ALL ON TABLE {TABLE} FROM PUBLIC") == 1

"""Phase 273-01 — migration 202's SHAPE, pinned against its text (I-1, I-5, D-08, UI-D-03).

Migration 202 creates ``public.message_artifacts``: the store of agent-authored artifacts. Its
visibility must be EXACTLY its parent message's (I-5), clients may never write it, and a stored
artifact is immutable (D-08) — except for the one UPDATE Postgres itself issues when a parent run or
parent artifact is deleted (``ON DELETE SET NULL``), without which every thread delete would fail.

⚠ Every assertion runs over the migration text with ``--`` comments STRIPPED, so the header prose
cannot satisfy or break an assertion. This checks TEXT, not a live database; the applied state is
measured by SQL in 273-01 Task 3 and quoted in ``273-BASELINES.md`` §Migration 202.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.models.artifact import ARTIFACT_COMPONENTS, MAX_ROWS, MAX_SPEC_BYTES

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
SUPPLEMENT = REPO_ROOT / "scripts" / "full-schema-supplement.sql"
FULL_SCHEMA = REPO_ROOT / "supabase" / "full-schema.sql"
TABLE = "public.message_artifacts"


def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("202_*.sql"))
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
    return _strip_comments(_migration().read_text(encoding="utf-8"))


def _function_body() -> str:
    m = re.search(
        r"CREATE OR REPLACE FUNCTION public\.message_artifacts_immutable\(\).*?AS \$fn\$(.*?)\$fn\$",
        _code(),
        re.S,
    )
    assert m, "the immutability trigger function (dollar-quoted $fn$) is missing"
    return m.group(1)


def _statements() -> list[str]:
    """Top-level statements, with the dollar-quoted function body blanked so its `;` cannot split."""
    code = re.sub(r"\$fn\$.*?\$fn\$", "$fn$ $fn$", _code(), flags=re.S)
    return [_norm(s) for s in code.split(";") if s.strip()]


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


# ── file + table ────────────────────────────────────────────────────────────────────────────────


def test_exactly_one_202_migration_with_a_digits_only_prefix():
    p = _migration()
    assert re.fullmatch(r"202_[a-z0-9_]+\.sql", p.name), p.name


def test_table_and_rls():
    code = _norm(_code())
    assert f"CREATE TABLE IF NOT EXISTS {TABLE}" in code
    assert f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY" in code


def test_component_check_equals_the_models_literal():
    m = re.search(r"component text NOT NULL CHECK \(component IN \(([^)]*)\)\)", _norm(_code()))
    assert m, "component CHECK missing"
    assert set(re.findall(r"'([^']*)'", m.group(1))) == set(ARTIFACT_COMPONENTS)


def test_row_count_and_byte_caps_equal_the_model_constants():
    code = _norm(_code())
    m = re.search(r"CHECK \(row_count BETWEEN 1 AND (\d+)\)", code)
    assert m and int(m.group(1)) == MAX_ROWS
    m2 = re.search(r"CHECK \(octet_length\(spec::text\) <= (\d+)\)", code)
    assert m2 and int(m2.group(1)) == MAX_SPEC_BYTES


def test_id_and_label_checks_and_label_uniqueness():
    code = _norm(_code())
    assert "id ~ '^a_[0-9a-z]{10}$'" in code
    assert "label ~ '^(chart|table|metric) [1-9][0-9]*$'" in code
    assert re.search(r"UNIQUE \(thread_id, label\)", code)


def test_foreign_keys():
    code = _norm(_code())
    assert re.search(r"thread_id uuid NOT NULL REFERENCES public\.threads\(id\) ON DELETE CASCADE", code)
    assert re.search(r"user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE", code)
    assert re.search(r"run_id uuid REFERENCES public\.runs\(run_id\) ON DELETE SET NULL", code)
    assert re.search(r"parent_id text REFERENCES public\.message_artifacts\(id\) ON DELETE SET NULL", code)


def test_org_autofill_trigger_matches_messages():
    code = _norm(_code())
    assert re.search(
        r"CREATE TRIGGER message_artifacts_autofill_org_id BEFORE INSERT ON public\.message_artifacts "
        r"FOR EACH ROW EXECUTE FUNCTION public\.autofill_org_id_by_owner\('user_id'\)",
        code,
    )


# ── privileges (I-5, T-273-02) ──────────────────────────────────────────────────────────────────


def test_public_is_revoked_before_anon_and_authenticated():
    stmts = _statements()

    def idx(role: str) -> int:
        target = f"REVOKE ALL ON TABLE {TABLE} FROM {role}"
        hits = [i for i, s in enumerate(stmts) if s == target]
        assert hits, target
        return hits[0]

    assert idx("PUBLIC") < idx("anon")
    assert idx("PUBLIC") < idx("authenticated")


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


def test_authenticated_is_select_only_and_nobody_gets_update():
    grants = _table_grants()
    assert grants, "no grants found — a vacuous scan must not pass"
    auth = [g for g in grants if "authenticated" in g[1]]
    assert len(auth) == 1 and auth[0][0] == {"SELECT"}, auth
    assert not any("anon" in g[1] or "public" in g[1] for g in grants)
    svc = [g for g in grants if "service_role" in g[1]]
    assert svc and all("UPDATE" not in g[0] and "ALL" not in g[0] for g in svc), svc
    for privs, _, stmt in grants:
        assert "UPDATE" not in privs and "ALL" not in privs, stmt


def test_trigger_function_execute_is_revoked_from_clients():
    stmts = _statements()
    for role in ("PUBLIC", "anon", "authenticated"):
        assert f"REVOKE EXECUTE ON FUNCTION public.message_artifacts_immutable() FROM {role}" in stmts, role


# ── the one SELECT policy == messages' (I-5, T-273-03) ──────────────────────────────────────────


def test_exactly_one_policy_with_the_messages_select_predicate():
    policies = [s for s in _statements() if s.upper().startswith("CREATE POLICY") and f"ON {TABLE}" in s]
    assert len(policies) == 1, policies
    pol = policies[0]
    assert "FOR SELECT TO authenticated" in pol, pol
    using = re.search(r"USING \((.*)\)$", pol)
    assert using, pol
    assert _pred(using.group(1)) == _pred(_messages_select_predicate())


# ── immutability with the FK-upkeep exemption (D-08, T-273-05 / 05b) ────────────────────────────


def test_before_update_trigger_is_bound():
    code = _norm(_code())
    assert re.search(
        r"CREATE TRIGGER message_artifacts_immutable BEFORE UPDATE ON public\.message_artifacts "
        r"FOR EACH ROW EXECUTE FUNCTION public\.message_artifacts_immutable\(\)",
        code,
    )


def test_function_body_carries_the_fk_upkeep_exemption_and_raises_otherwise():
    body = _norm(_function_body())
    assert "(to_jsonb(NEW) - 'run_id' - 'parent_id') = (to_jsonb(OLD) - 'run_id' - 'parent_id')" in body
    assert "NEW.run_id IS NULL OR NEW.run_id IS NOT DISTINCT FROM OLD.run_id" in body
    assert "NEW.parent_id IS NULL OR NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id" in body
    # POSITIVE form: a NULL condition must fall through to the raise, never past it.
    assert re.search(r"IF .*? THEN RETURN NEW; END IF; RAISE EXCEPTION", body), body
    assert not re.search(r"IF NOT\b", body, re.I), "use the positive IF … THEN RETURN NEW form"
    assert "RAISE EXCEPTION" in body


def test_exemption_names_no_column_but_run_id_and_parent_id():
    subtracted = set(re.findall(r"-\s*'([a-z_]+)'", _function_body()))
    assert subtracted == {"run_id", "parent_id"}, subtracted


def test_no_statement_issues_an_update_on_the_table():
    for stmt in _statements():
        assert not re.match(r"^UPDATE\s+public\.message_artifacts", stmt, re.I), stmt


# ── supplement mirror (pg_dump --no-privileges loses every grant) ───────────────────────────────


def test_every_acl_statement_is_mirrored_verbatim_in_the_supplement():
    supplement_raw = SUPPLEMENT.read_text(encoding="utf-8")
    assert "-- migration 202" in supplement_raw
    supplement = _norm(_strip_comments(supplement_raw))
    acl = [s for s in _statements() if re.match(r"^(GRANT|REVOKE)\b", s, re.I)]
    assert len(acl) >= 9, acl  # 3 table REVOKE + 2 table GRANT + 3 fn REVOKE + 1 fn GRANT
    for stmt in acl:
        assert f"{stmt};" in supplement, f"not mirrored in full-schema-supplement.sql: {stmt};"


def test_supplement_grants_no_update_on_message_artifacts():
    for stmt in _strip_comments(SUPPLEMENT.read_text(encoding="utf-8")).split(";"):
        s = _norm(stmt)
        if s.upper().startswith("GRANT") and "message_artifacts" in s and "FUNCTION" not in s:
            assert "UPDATE" not in s.upper() and " ALL " not in f" {s.upper()} ", s

"""Phase 275-01 — migration 204's SHAPE, pinned against its text (D-08, D-13, D-14, D-17, D-20, D-22,
D-27, D-28; revisions B-1, W-2, W-2b, W-4, W-5b; T-275-01/04/05/07/08/10/40/42).

Migration 204 is the database half of Retention & Legal Hold: the policy / preview / hold / queue /
skip / receipt / sweep tables, the archive columns on ``documents``, the ONE hold predicate
(``retention_held_documents``) and its folder twin (``retention_held_folders``), the triggers that
refuse a held delete on EVERY path, and the audit CHECK rebuild.

⛔ The properties that matter, and the plant that turns each red (driven at 275-01):
  * ``ERRCODE = 'PT409'`` — PLANT: change it to ``P0001``. PostgREST maps ``PTxyz`` to HTTP xyz, so
    the API's 409 depends on it.
  * no ``RAISE`` interpolates a hold ``name`` — PLANT: add ``, h.name`` to a RAISE. A matter name in
    a trigger message reaches members through PostgREST error JSON (D-17).
  * a cycle guard in EVERY recursive walk — PLANT: delete one ``CYCLE`` clause. A corrupt
    ``parent_id`` loop would otherwise spin a delete forever (T-275-10).
  * ``REVOKE … FROM PUBLIC`` before every ``GRANT EXECUTE`` — PLANT: drop one. The PUBLIC-EXECUTE
    trap (CLAUDE.md, BUG-260911-01).
  * ``actor_id … ON DELETE SET NULL`` on receipts and NO foreign key on ``document_id`` — PLANT:
    ``ON DELETE CASCADE``. A receipt must outlive the approver and the document (D-13).
  * no automatic delete anywhere — PLANT: add an ``auto_delete boolean`` column (D-08).

⚠ Every assertion runs over the migration text with ``--`` comments STRIPPED, so header prose cannot
satisfy or break an assertion. The applied state is measured live by ``tests/integration/test_275_*``
and quoted in ``275-BASELINES.md``.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"

NEW_TABLES = (
    "retention_policies", "retention_previews", "legal_holds", "legal_hold_documents",
    "legal_hold_folders", "retention_queue", "retention_skips", "retention_receipts", "retention_sweeps",
)
NEW_AUDIT_TYPES = (
    "retention.policy.create", "retention.policy.update", "retention.policy.delete",
    "retention.hold.create", "retention.hold.update", "retention.hold.release",
    "retention.disposition.confirm", "retention.document.unarchive", "retention.document.keep",
    "folder.delete",
)
DISPOSITION_ACTIONS = (
    "archived", "queued_delete", "queued_review", "deleted", "did_not_delete", "kept", "unarchived",
)


def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("204_*.sql"))
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


def _balanced(code: str, start: int) -> str:
    """The text inside the parenthesis that opens at ``start`` (balanced)."""
    assert code[start] == "("
    depth, i = 1, start + 1
    while depth and i < len(code):
        depth += code[i] == "("
        depth -= code[i] == ")"
        i += 1
    return code[start + 1:i - 1]


def _create_table(code: str, table: str) -> str:
    m = re.search(rf"CREATE TABLE IF NOT EXISTS public\.{table} \(", code)
    assert m, f"no CREATE TABLE for {table}"
    return _balanced(code, m.end() - 1)


def _function_body(code: str, name: str) -> str:
    m = re.search(rf"CREATE OR REPLACE FUNCTION public\.{name}\(.*?\$\$(.*?)\$\$", code, re.S)
    assert m, f"no function body for {name}"
    return m.group(1)


def test_the_hold_refusal_maps_to_http_409():
    code = _code()
    assert "ERRCODE = 'PT409'" in code
    assert code.count("ERRCODE = 'PT409'") >= 3, "documents delete + folders delete + truncate guards"


def test_no_raise_interpolates_a_matter_name():
    code = _code()
    raises = re.findall(r"RAISE EXCEPTION '[^']*'(.*?)USING", code)
    assert raises, "non-vacuity: no RAISE found"
    for args in raises:
        assert not re.search(r"\bname\b|hold_name|reason", args), f"D-17: a RAISE interpolates a name: {args!r}"
    for msg in re.findall(r"RAISE EXCEPTION '([^']*)'", code):
        assert "matter" not in msg.lower()


def test_every_recursive_walk_is_cycle_bounded():
    code = _code()
    walks = len(re.findall(r"WITH RECURSIVE", code))
    guards = len(re.findall(r"\bCYCLE \w+ SET \w+ USING \w+", code))
    assert walks >= 1, "non-vacuity: the hold predicates walk the folder tree"
    assert guards == walks, f"{walks} recursive walks but {guards} CYCLE guards"
    # The one walk lives in retention_folder_ancestors; every folder-tree reader calls it rather than
    # carrying its own (an unbounded copy is exactly the folder_is_org_shared shape, T-275-10).
    assert "WITH RECURSIVE" in _function_body(code, "retention_folder_ancestors")
    for fn in ("retention_held_documents", "retention_held_folders",
               "documents_sticky_hold_on_move", "folders_sticky_hold_on_move"):
        body = _function_body(code, fn)
        assert "retention_folder_ancestors(" in body and "WITH RECURSIVE" not in body, fn


def test_truncate_is_guarded_and_revoked():
    code = _code()
    assert len(re.findall(r"BEFORE TRUNCATE ON public\.(documents|folders)", code)) == 2
    assert re.search(r"REVOKE TRUNCATE ON public\.documents, public\.folders FROM authenticated, anon", code)


def test_rls_is_enabled_on_every_new_table_and_all_privileges_are_revoked_first():
    code = _code()
    for t in NEW_TABLES:
        assert code.count(f"ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY") == 1, t
        for role in ("PUBLIC", "anon", "authenticated", "service_role"):
            assert f"REVOKE ALL ON TABLE public.{t} FROM {role}" in code, f"{t}: {role} not revoked"


def test_public_is_revoked_before_every_execute_grant():
    code = _code()
    grants = list(re.finditer(r"GRANT EXECUTE ON FUNCTION public\.(\w+)\(", code))
    assert grants, "non-vacuity"
    for g in grants:
        fn = g.group(1)
        before = code[: g.start()]
        assert re.search(rf"REVOKE EXECUTE ON FUNCTION public\.{fn}\([^)]*\) FROM PUBLIC", before), (
            f"{fn}: GRANT EXECUTE without a prior REVOKE … FROM PUBLIC"
        )


def test_the_two_predicates_are_the_service_roles_only():
    code = _code()
    for fn in ("retention_held_documents", "retention_held_folders"):
        assert f"GRANT EXECUTE ON FUNCTION public.{fn}(uuid[]) TO service_role" in code
        for role in ("PUBLIC", "anon", "authenticated"):
            assert f"REVOKE EXECUTE ON FUNCTION public.{fn}(uuid[]) FROM {role}" in code, (fn, role)
        assert not re.search(rf"GRANT EXECUTE ON FUNCTION public\.{fn}\(uuid\[\]\) TO (authenticated|anon)", code)
        head = re.search(rf"CREATE OR REPLACE FUNCTION public\.{fn}\(.*?AS \$\$", code, re.S).group(0)
        assert "SECURITY DEFINER" in head and "SET search_path TO ''" in head, fn


def test_receipts_outlive_their_actor_and_their_document():
    body = _create_table(_code(), "retention_receipts")
    assert re.search(r"actor_id uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL", body)
    assert "actor_name text" in body
    doc_col = re.search(r"document_id uuid[^,]*", body).group(0)
    assert "REFERENCES" not in doc_col, f"D-13: receipts.document_id must carry no FK: {doc_col!r}"


def test_a_disposition_receipt_must_name_its_policy():
    body = _create_table(_code(), "retention_receipts")
    m = re.search(r"CHECK \(\s*action NOT IN \(([^)]*)\) OR policy_name IS NOT NULL\s*\)", body)
    assert m, "W-4: the receipts CHECK naming policy_name IS NOT NULL is missing"
    listed = set(re.findall(r"'([^']+)'", m.group(1)))
    assert listed == set(DISPOSITION_ACTIONS), listed


def test_receipts_carry_no_update_or_delete_grant():
    code = _code()
    for grant in re.findall(r"GRANT ([A-Z, ]+) ON TABLE public\.retention_receipts TO (\w+)", code):
        privs, role = grant
        assert "UPDATE" not in privs and "DELETE" not in privs, f"{role} granted {privs} on receipts"


def test_no_automatic_delete_exists_anywhere():
    code = _code()
    assert not re.search(r"auto[_ ]?delete|autodelete|auto_dispose", code, re.I), "D-08"
    body = _create_table(code, "retention_policies")
    assert re.search(r"stage2_action text CHECK \(stage2_action IN \('delete'\)\)", body)
    assert re.search(r"stage1_action text NOT NULL CHECK \(stage1_action IN \('archive', 'delete', 'review'\)\)", body)


def test_the_policy_clock_and_period_shape():
    body = _create_table(_code(), "retention_policies")
    assert "clock text NOT NULL CHECK (clock IN ('document_date', 'date_added'))" in body, "D-22: two clocks"
    assert "stage1_unit text NOT NULL CHECK (stage1_unit IN ('days', 'months', 'years'))" in body
    assert "stage1_action = 'archive'" in body, "D-20: stage 2 only after an archive"
    code = _code()
    assert re.search(r"CREATE UNIQUE INDEX IF NOT EXISTS \w+ ON public\.retention_policies \(org_id, folder_id\) WHERE \(?scope_kind = 'folder'", code)
    assert re.search(r"CREATE UNIQUE INDEX IF NOT EXISTS \w+ ON public\.retention_policies \(org_id, document_type_norm\) WHERE \(?scope_kind = 'class'", code)


def test_the_protected_column_triggers_name_their_columns():
    code = _code()
    pol = _function_body(code, "retention_policies_protect_columns")
    hold = _function_body(code, "legal_holds_protect_columns")
    for col in ("revision", "previewed_revision"):
        assert col in pol
    for col in ("released_at", "released_by", "released_by_name", "release_note"):
        assert col in hold
    arch = _function_body(code, "documents_protect_archive_state")
    for col in ("archived_at", "archived_policy_id", "archived_policy_name"):
        assert col in arch


def test_policies_and_hold_updates_have_no_jwt_write_grant():
    code = _code()
    for privs, role in re.findall(r"GRANT ([A-Z, ]+) ON TABLE public\.retention_policies TO (\w+)", code):
        if role == "authenticated":
            assert privs.strip() == "SELECT", f"W-2b: authenticated granted {privs} on retention_policies"
    for privs, role in re.findall(r"GRANT ([A-Z, ]+) ON TABLE public\.legal_holds TO (\w+)", code):
        if role == "authenticated":
            assert "UPDATE" not in privs and "DELETE" not in privs, privs


def test_every_write_policy_is_org_manage_and_org_scoped():
    code = _code()
    policies = re.findall(r"CREATE POLICY \w+ ON public\.(\w+) FOR (INSERT|UPDATE) TO authenticated (.*?);", code)
    assert policies, "non-vacuity"
    for table, cmd, rest in policies:
        assert "WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()))" in rest, (
            table, cmd,
        )
    selects = re.findall(r"CREATE POLICY \w+ ON public\.(\w+) FOR SELECT TO authenticated USING \((.*?)\);", code)
    assert {t for t, _ in selects} >= set(NEW_TABLES) - {"retention_sweeps"}
    for table, using in selects:
        assert "current_user_has_permission(org_id, 'org:manage')" in using, table


def test_the_archive_columns_are_added_then_analyzed():
    code = _code()
    add = code.find("ADD COLUMN IF NOT EXISTS archived_policy_name text")
    assert add != -1
    assert "ADD COLUMN IF NOT EXISTS archived_at timestamptz" in code
    assert re.search(r"ADD COLUMN IF NOT EXISTS archived_policy_id uuid REFERENCES public\.retention_policies\(id\) ON DELETE SET NULL", code)
    analyze = code.find("ANALYZE public.documents")
    assert analyze > add, "Pitfall 1: ANALYZE must follow the column add"


def test_the_audit_check_keeps_every_literal_and_adds_the_retention_types():
    code = _code()
    m = re.search(r"ADD CONSTRAINT audit_log_action_type_check CHECK \(action_type = ANY \(ARRAY\[(.*?)\]", code)
    assert m, "the audit CHECK is not rebuilt"
    new = set(re.findall(r"'([^']+)'", m.group(1)))
    prior = _prior_audit_literals()
    assert prior, "non-vacuity: no earlier migration defines the audit CHECK"
    assert prior <= new, f"dropped literals: {sorted(prior - new)}"
    assert set(NEW_AUDIT_TYPES) <= new, sorted(set(NEW_AUDIT_TYPES) - new)


def _prior_audit_literals() -> set[str]:
    best: tuple[int, set[str]] | None = None
    for path in sorted(MIGRATIONS.glob("*.sql")):
        num = int(re.match(r"(\d+)", path.name).group(1))
        if num >= 204:
            continue
        text = _norm(_strip_comments(path.read_text(encoding="utf-8")))
        m = re.search(r"ADD CONSTRAINT audit_log_action_type_check CHECK \(\s*action_type = ANY \(\s*ARRAY\[(.*?)\]", text)
        if m and (best is None or num > best[0]):
            best = (num, set(re.findall(r"'([^']+)'", m.group(1))))
    return best[1] if best else set()


def test_coverage_is_held_to_the_holds_own_org():
    code = _code()
    body = _function_body(code, "legal_hold_coverage_same_org")
    assert "legal_holds" in body and "documents" in body and "folders" in body
    assert re.search(r"BEFORE INSERT OR UPDATE ON public\.legal_hold_documents", code)
    assert re.search(r"BEFORE INSERT OR UPDATE ON public\.legal_hold_folders", code)

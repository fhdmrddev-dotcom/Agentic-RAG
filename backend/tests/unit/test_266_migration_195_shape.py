"""Phase 266-01 — migration 195's SHAPE, pinned against its text (D-266-06, D-266-08, D-266-18).

Migration 195 creates ``public.expert_installs`` (the per-org home of a first-party Expert's
installed knowledge), org-scopes ``documents_completed_hash_unique_idx``, and deliberately retires
migration 188's orphaned seed knowledge (folder …0260, document …0261, chunks …0262/…0263) while
KEEPING skill …0264.

⚠ Every assertion here runs over the migration text with ``--`` comments STRIPPED first, so the
header prose (which names the retired ids, the kept skill and the words CONCURRENTLY / INSERT)
can neither satisfy nor break an assertion. A comment is not a statement.

⚠ This checks TEXT, not a live database. The applied state (RLS on, anon cannot SELECT,
authenticated cannot INSERT, one policy) is measured by SQL after the operator's paste — see
266-01-SUMMARY.md, Task 3.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATION = REPO_ROOT / "supabase" / "migrations" / "195_expert_installs_and_seed_retirement.sql"
SUPPLEMENT = REPO_ROOT / "scripts" / "full-schema-supplement.sql"

SEED_FOLDER = "00000000-0000-0000-0000-000000000260"
SEED_DOC = "00000000-0000-0000-0000-000000000261"
SEED_USER = "00000000-0000-0000-0000-000000000001"
KEPT_SKILL = "00000000-0000-0000-0000-000000000264"


def _strip_comments(sql: str) -> str:
    """Drop full-line and trailing ``--`` comments. 195 carries no ``--`` inside a literal."""
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
    return _strip_comments(MIGRATION.read_text(encoding="utf-8"))


def _statements() -> list[str]:
    return [_norm(s) for s in _code().split(";") if s.strip()]


def test_migration_file_exists_with_digits_only_prefix():
    matches = sorted(p.name for p in (REPO_ROOT / "supabase" / "migrations").glob("195_*.sql"))
    assert matches == ["195_expert_installs_and_seed_retirement.sql"], matches


def test_expert_installs_table_shape():
    code = _norm(_code())
    assert "CREATE TABLE IF NOT EXISTS public.expert_installs" in code
    assert "CONSTRAINT uq_expert_install UNIQUE (org_id, expert_bundle_id)" in code
    assert re.search(
        r"folder_id uuid REFERENCES public\.folders\(id\) ON DELETE SET NULL", code
    ), "folder_id must be ON DELETE SET NULL so a deleted install folder is recreated, not orphaned"
    check = re.search(r"CHECK \(status IN \(([^)]*)\)\)", code)
    assert check, "status CHECK missing"
    literals = sorted(re.findall(r"'([^']*)'", check.group(1)))
    assert literals == ["failed", "installed", "installing"], literals
    assert "ALTER TABLE public.expert_installs ENABLE ROW LEVEL SECURITY" in code


def test_expert_installs_privileges_are_member_read_only():
    code = _norm(_code())
    for role in ("PUBLIC", "anon", "authenticated"):
        assert f"REVOKE ALL ON TABLE public.expert_installs FROM {role}" in code, role
    assert "GRANT SELECT ON TABLE public.expert_installs TO authenticated" in code

    # No statement may grant a WRITE on expert_installs to a client role.
    for stmt in _statements():
        if not stmt.upper().startswith("GRANT") or "expert_installs" not in stmt:
            continue
        m = re.match(r"GRANT (.+?) ON TABLE public\.expert_installs TO (.+)$", stmt, re.I)
        assert m, f"unparseable grant: {stmt}"
        privs = {p.strip().upper() for p in m.group(1).split(",")}
        grantees = {g.strip().lower() for g in m.group(2).split(",")}
        if grantees & {"authenticated", "anon", "public"}:
            assert privs == {"SELECT"}, f"client write grant on expert_installs: {stmt}"


def test_exactly_one_policy_member_read_over_current_user_org_ids():
    policies = [
        s for s in _statements()
        if s.upper().startswith("CREATE POLICY") and "ON public.expert_installs" in s
    ]
    assert len(policies) == 1, policies
    pol = policies[0]
    assert "FOR SELECT TO authenticated" in pol, pol
    using = re.search(r"USING \((.*)\)$", pol)
    assert using and "current_user_org_ids()" in using.group(1), pol


def test_completed_hash_index_is_org_scoped_and_not_concurrent():
    code = _norm(_code())
    assert "DROP INDEX IF EXISTS public.documents_completed_hash_unique_idx" in code
    assert re.search(
        r"CREATE UNIQUE INDEX documents_completed_hash_unique_idx ON public\.documents"
        r" USING btree \(org_id, user_id, content_hash\)"
        r" WHERE \(\(content_hash IS NOT NULL\) AND \(status = 'completed'::text\)\)",
        code,
    ), "the completed-hash index must be (org_id, user_id, content_hash) with the same predicate"
    assert "CONCURRENTLY" not in code.upper()


def test_retires_188_knowledge_rows_by_fixed_id():
    stmts = _statements()

    def has(pattern: str) -> bool:
        return any(re.search(pattern, s) for s in stmts)

    assert has(rf"^DELETE FROM public\.document_chunks WHERE document_id = '{SEED_DOC}'")
    assert has(rf"^DELETE FROM public\.documents WHERE id = '{SEED_DOC}'")
    assert has(
        rf"^DELETE FROM public\.folders WHERE id = '{SEED_FOLDER}'::uuid"
        rf" AND user_id = '{SEED_USER}'::uuid"
    ), "the folder delete must also be predicated on the seed user"
    assert has(
        rf"^UPDATE public\.expert_bundles SET knowledge_folder_ids = array_remove\("
        rf"knowledge_folder_ids, '{SEED_FOLDER}'::uuid\).*WHERE slug = 'financial-analyzer'"
        rf" AND is_system = true$"
    )


def test_kept_skill_is_never_deleted_or_updated():
    code = _code()
    assert KEPT_SKILL not in code
    assert "0264" not in code
    for stmt in _statements():
        if re.match(r"^(DELETE|UPDATE)\b", stmt, re.I):
            assert "skills" not in stmt.lower().split(" where ")[0], stmt


def test_every_grant_and_revoke_is_mirrored_verbatim_in_the_supplement():
    supplement = _norm(SUPPLEMENT.read_text(encoding="utf-8"))
    acl = [s for s in _statements() if re.match(r"^(GRANT|REVOKE)\b", s, re.I)]
    assert len(acl) >= 5, acl  # 3 REVOKE + 2 GRANT at minimum — a vacuous scan must not pass
    for stmt in acl:
        assert f"{stmt};" in supplement, f"not mirrored in full-schema-supplement.sql: {stmt};"

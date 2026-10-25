"""Phase 293-01 — migration 215's SHAPE, pinned against its text (D-16, D-19, D-22, D-23, D-30).

Migration 215 lays the credential foundation for the inbound door:

* ``public.api_keys`` — one row per key. Owners may READ their own keys through a COLUMN-level
  grant that never names ``key_hash`` (T-293-02); no client role may write.
* ``workflow_runs.origin_kind / origin_label / origin_ref`` — who or what started a run, backfilled
  ONLY for rows whose inputs carry a UUID ``_schedule_id``, then frozen by a trigger (T-293-03).
* five ``api_key.*`` audit action types in ``audit_log_action_type_check``.
* two bounded ``app_settings`` limits (starts and status reads per key per minute).

⚠ Every assertion runs over the migration text with ``--`` comments STRIPPED (except the apply
instruction checks, which read the header on purpose), so header prose cannot satisfy or break a
structural assertion. This checks TEXT, not a live database; the applied state is measured by
``scripts/check-migration-215-live.py`` and the migration's own VERIFY block.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.services.audit_service import VALID_ACTION_TYPES

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
SUPPLEMENT = REPO_ROOT / "scripts" / "full-schema-supplement.sql"
GREENFIELD = REPO_ROOT / "scripts" / "check-greenfield-privileges.py"
LIVE_CHECK = REPO_ROOT / "scripts" / "check-migration-215-live.py"

API_KEY_ACTIONS = (
    "api_key.create",
    "api_key.revoke",
    "api_key.start",
    "api_key.read",
    "api_key.refused",
)
CLIENT_COLUMNS = (
    "id, org_id, user_id, label, key_prefix, workflows, expires_at, revoked_at, "
    "revoked_by, last_used_at, created_at"
)
TRIGGER_FN = "public.workflow_runs_origin_immutable()"


def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("215_*.sql"))
    assert len(matches) == 1, f"expected exactly one 215_*.sql migration, found {matches}"
    assert matches[0].name == "215_api_keys_and_run_origin.sql", matches[0].name
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


def _flat() -> str:
    return _norm(_code())


# ── 1. public.api_keys ─────────────────────────────────────────────────────────


def test_creates_api_keys_with_rls_on():
    flat = _flat()
    assert "CREATE TABLE IF NOT EXISTS public.api_keys" in flat
    assert "ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY" in flat


def test_revokes_all_from_every_role_before_granting():
    flat = _flat()
    for role in ("PUBLIC", "anon", "authenticated", "service_role"):
        assert f"REVOKE ALL ON TABLE public.api_keys FROM {role};" in flat, role


def test_authenticated_column_grant_never_names_key_hash():
    flat = _flat()
    grants = re.findall(r"GRANT SELECT \(([^)]*)\) ON (?:TABLE )?public\.api_keys TO authenticated", flat)
    assert len(grants) == 1, f"expected ONE column-level SELECT grant to authenticated, found {grants}"
    cols = [c.strip() for c in grants[0].split(",")]
    assert "key_hash" not in cols
    assert ", ".join(cols) == CLIENT_COLUMNS
    # And no TABLE-level SELECT to a client role, which would re-open key_hash.
    assert not re.search(r"GRANT [A-Z, ]*SELECT[A-Z, ]* ON (?:TABLE )?public\.api_keys TO (authenticated|anon)", flat)


def test_key_hash_appears_only_in_its_definition_and_unique_constraint():
    code_lines = [ln for ln in _code().splitlines() if "key_hash" in ln]
    assert len(code_lines) == 1, code_lines
    assert re.search(r"key_hash\s+text\s+NOT NULL\s+UNIQUE", code_lines[0], re.IGNORECASE), code_lines[0]


def test_the_only_policy_is_owner_select():
    flat = _flat()
    policies = re.findall(r"CREATE POLICY \"([^\"]+)\" ON public\.api_keys (.*?);", flat)
    assert len(policies) == 1, policies
    name, body = policies[0]
    assert name == "Users can view their own API keys"
    assert body.startswith("FOR SELECT TO authenticated")
    assert "public.current_user_org_ids()" in body
    assert "auth.uid() = user_id" in body


def test_workflows_snapshot_has_no_foreign_key_and_needs_one_entry():
    flat = _flat()
    m = re.search(r"workflows jsonb NOT NULL (.*?),\s*expires_at", flat)
    assert m, "workflows column not found"
    assert "REFERENCES" not in m.group(1)
    assert "jsonb_array_length(workflows) >= 1" in m.group(1)


def test_one_active_label_per_owner():
    flat = _flat()
    assert re.search(
        r"CREATE UNIQUE INDEX IF NOT EXISTS api_keys_owner_label_active_uq ON public\.api_keys "
        r"\(org_id, user_id, lower\(btrim\(label\)\)\) WHERE revoked_at IS NULL",
        flat,
    )


# ── 2-4. workflow_runs origin: columns, backfill, then the freeze ──────────────


def test_origin_columns_are_added_and_never_bare_origin():
    flat = _flat()
    for col, typ in (("origin_kind", "text"), ("origin_label", "text"), ("origin_ref", "uuid")):
        assert f"ADD COLUMN IF NOT EXISTS {col} {typ}" in flat, col
    assert not re.search(r"ADD COLUMN IF NOT EXISTS origin\s", flat)
    assert "origin_kind IS NULL OR origin_kind IN ('app', 'schedule', 'key')" in flat


def test_backfill_only_touches_uuid_schedule_rows():
    flat = _flat()
    m = re.search(r"UPDATE public\.workflow_runs wr SET (.*?);", flat)
    assert m, "backfill UPDATE not found"
    body = m.group(1)
    assert "origin_kind = 'schedule'" in body
    assert "(wr.inputs->>'_schedule_id')::uuid" in body
    assert "public.workflow_schedules" in body
    assert "wr.origin_kind IS NULL" in body
    assert "wr.inputs ? '_schedule_id'" in body
    assert "~* '^[0-9a-f-]{36}$'" in body
    # Exactly one UPDATE of workflow_runs: nothing else is backfilled.
    assert len(re.findall(r"UPDATE public\.workflow_runs\b", flat)) == 1


def test_backfill_runs_before_the_trigger_is_created():
    code = _code()
    backfill = code.find("UPDATE public.workflow_runs")
    trigger = code.find("CREATE TRIGGER workflow_runs_origin_immutable")
    assert backfill != -1 and trigger != -1
    assert backfill < trigger, "the backfill must run BEFORE the freeze trigger exists"


def test_trigger_assigns_old_values_rather_than_raising():
    flat = _flat()
    for col in ("origin_kind", "origin_label", "origin_ref"):
        assert f"NEW.{col} := OLD.{col};" in flat, col
    assert "SET search_path = ''" in flat
    assert re.search(
        r"CREATE TRIGGER workflow_runs_origin_immutable BEFORE UPDATE ON public\.workflow_runs "
        r"FOR EACH ROW EXECUTE FUNCTION public\.workflow_runs_origin_immutable\(\)",
        flat,
    )


def test_trigger_function_execute_is_revoked():
    flat = _flat()
    fn_at = flat.find("CREATE OR REPLACE FUNCTION public.workflow_runs_origin_immutable()")
    assert fn_at != -1
    tail = flat[fn_at:]
    for role in ("PUBLIC", "anon", "authenticated"):
        assert f"REVOKE EXECUTE ON FUNCTION {TRIGGER_FN} FROM {role};" in tail, role
    assert f"GRANT EXECUTE ON FUNCTION {TRIGGER_FN} TO service_role;" in tail


# ── 5. audit CHECK ─────────────────────────────────────────────────────────────


def _audit_check_literals() -> set[str]:
    flat = _flat()
    m = re.search(
        r"ADD CONSTRAINT audit_log_action_type_check CHECK \(action_type = ANY \(ARRAY\[(.*?)\]::text\[\]\)\)",
        flat,
    )
    assert m, "audit_log_action_type_check recreate not found"
    return set(re.findall(r"'([^']+)'", m.group(1)))


def test_audit_check_gains_the_five_api_key_types():
    literals = _audit_check_literals()
    for action in API_KEY_ACTIONS:
        assert action in literals, action


def test_audit_check_never_falls_behind_the_frozenset():
    literals = _audit_check_literals()
    missing = set(VALID_ACTION_TYPES) - literals
    assert not missing, f"the recreated CHECK drops live action types: {sorted(missing)}"


def test_audit_constraint_is_dropped_then_added():
    flat = _flat()
    assert "ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_type_check" in flat


def test_audit_activity_index_exists():
    flat = _flat()
    assert re.search(
        r"CREATE INDEX IF NOT EXISTS audit_log_api_key_id_idx ON public\.audit_log "
        r"\(\(metadata->>'api_key_id'\)\) WHERE action_type LIKE 'api_key\.%'",
        flat,
    )


# ── 6. app_settings limits ─────────────────────────────────────────────────────


def test_app_settings_limits_with_bounds():
    flat = _flat()
    assert "ADD COLUMN IF NOT EXISTS api_key_starts_per_minute integer NOT NULL DEFAULT 10" in flat
    assert "ADD COLUMN IF NOT EXISTS api_key_reads_per_minute integer NOT NULL DEFAULT 120" in flat
    assert (
        "ADD CONSTRAINT app_settings_api_key_starts_per_minute_bound "
        "CHECK (api_key_starts_per_minute >= 1 AND api_key_starts_per_minute <= 60)"
    ) in flat
    assert (
        "ADD CONSTRAINT app_settings_api_key_reads_per_minute_bound "
        "CHECK (api_key_reads_per_minute >= 10 AND api_key_reads_per_minute <= 600)"
    ) in flat
    for c in ("app_settings_api_key_starts_per_minute_bound", "app_settings_api_key_reads_per_minute_bound"):
        assert f"DROP CONSTRAINT IF EXISTS {c}" in flat, c


# ── apply discipline + VERIFY ──────────────────────────────────────────────────


def test_never_push_or_reset_except_the_never_line():
    hits = [ln for ln in _raw().splitlines() if re.search(r"db push|db reset", ln)]
    assert len(hits) == 1, hits
    assert "NEVER" in hits[0]


def test_header_names_the_apply_order():
    raw = _raw()
    assert "regenerate-full-schema.sh" in raw
    assert "get_advisors(security)" in raw
    assert "BEFORE the backend" in raw


def test_verify_block_covers_the_load_bearing_facts():
    raw = _raw()
    verify = raw[raw.find("VERIFY"):]
    for needle in (
        "has_column_privilege('authenticated', 'public.api_keys', 'key_hash', 'SELECT')",
        "has_table_privilege('anon', 'public.api_keys', 'SELECT')",
        "workflow_runs_origin_immutable",
        "'public', 'public.workflow_runs_origin_immutable()', 'EXECUTE'",
        "api_key_starts_per_minute",
        "api_key_reads_per_minute",
    ):
        assert needle in verify, needle
    for action in API_KEY_ACTIONS:
        assert action in verify, action


# ── the mirrors: pg_dump --no-privileges carries none of this ──────────────────


def test_supplement_mirrors_the_table_narrowing():
    flat = _norm(_strip_comments(SUPPLEMENT.read_text(encoding="utf-8")))
    raw = SUPPLEMENT.read_text(encoding="utf-8")
    assert "migration 215" in raw
    for role in ("PUBLIC", "anon", "authenticated", "service_role"):
        assert f"REVOKE ALL ON TABLE public.api_keys FROM {role};" in flat, role
    assert f"GRANT SELECT ({CLIENT_COLUMNS}) ON TABLE public.api_keys TO authenticated;" in flat
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_keys TO service_role;" in flat


def test_supplement_mirrors_the_trigger_function_execute():
    flat = _norm(_strip_comments(SUPPLEMENT.read_text(encoding="utf-8")))
    for role in ("PUBLIC", "anon", "authenticated"):
        assert f"REVOKE EXECUTE ON FUNCTION {TRIGGER_FN} FROM {role};" in flat, role
    assert f"GRANT EXECUTE ON FUNCTION {TRIGGER_FN} TO service_role;" in flat


def test_greenfield_checker_names_the_key_hash_case():
    text = GREENFIELD.read_text(encoding="utf-8")
    assert "SELECT key_hash FROM public.api_keys" in text
    assert "public.api_keys" in text


def test_live_checker_exists_and_is_select_only():
    text = LIVE_CHECK.read_text(encoding="utf-8")
    assert "215 live" in text
    assert "postgres_dsn" in text
    code = "\n".join(ln for ln in text.splitlines() if not ln.lstrip().startswith("#"))
    for verb in ("INSERT ", "UPDATE ", "DELETE ", "ALTER ", "DROP ", "CREATE ", "GRANT ", "REVOKE "):
        assert verb not in code.upper().replace("UPDATE OF", ""), verb

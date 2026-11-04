"""Phase 308-01 (D-05 / D-06 / D-07 / D-12 / D-20 / D-27 / D-31 / D-32 / D-42 / D-43 / D-47 / D-48)
— migration 225, read as text.

Pins the shape of ``supabase/migrations/225_webhooks.sql`` without a database:

* four deny-all tables (``webhook_endpoints``, ``webhook_events``, ``webhook_deliveries``,
  ``webhook_delivery_attempts``): RLS on, NO policy, REVOKE ALL (PUBLIC first), GRANT to service_role;
* a secret can only be stored encrypted (``LIKE 'enc:v1:%'``), and no delivery / attempt column holds a
  body, a response or headers (D-20);
* the two duplicate walls (D-07): one ``run.finished`` per run, one delivery per (endpoint, event);
* the two emit functions: SECURITY DEFINER, empty search_path, swallow-and-warn, EXECUTE revoked from
  PUBLIC before anon / authenticated; the runs trigger is UPDATE-only, documents carry two triggers on
  one function and the INSERT one never reads ``OLD`` (D-47);
* the run function skips golden runs and runs without an owner (D-42) and keeps ``cap_paused`` (D-43);
* the audit CHECK is the last earlier restatement (scanned, never retyped) plus the nine
  ``webhook.endpoint.*`` literals, and ``VALID_ACTION_TYPES`` stays a subset of it (D-31).

Every assertion runs over the SQL with ``--`` comments stripped, so header prose can neither satisfy
nor break one. The live proof is tests/integration/test_308_schema_privileges_live.py.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

MIGRATIONS = Path(__file__).resolve().parents[3] / "supabase" / "migrations"
MIGRATION = MIGRATIONS / "225_webhooks.sql"
TABLES = ("webhook_endpoints", "webhook_events", "webhook_deliveries", "webhook_delivery_attempts")
FUNCTIONS = ("webhook_emit_run_event", "webhook_emit_document_event")
CHECK = "audit_log_action_type_check"
NEW_AUDIT = {
    f"webhook.endpoint.{verb}"
    for verb in (
        "created", "updated", "deleted", "enabled", "disabled",
        "secret_rolled", "test_sent", "delivery_resent", "auto_disabled",
    )
}


def _raw() -> str:
    assert MIGRATION.exists(), f"{MIGRATION.name} does not exist yet"
    return MIGRATION.read_text(encoding="utf-8")


def _strip(sql: str) -> str:
    lines = []
    for ln in sql.splitlines():
        stripped = ln.split("--", 1)[0]
        if stripped.strip():
            lines.append(stripped)
    return re.sub(r"\s+", " ", " ".join(lines))


def _code() -> str:
    return _strip(_raw())


def _table_body(table: str) -> str:
    m = re.search(rf"CREATE TABLE IF NOT EXISTS public\.{table} \((.*?)\);", _code(), re.IGNORECASE)
    assert m, f"CREATE TABLE IF NOT EXISTS public.{table} (...) not found"
    return m.group(1)


def _function_body(name: str) -> str:
    m = re.search(
        rf"CREATE OR REPLACE FUNCTION public\.{name}\(\)(.*?)\$fn\$(.*?)\$fn\$;", _code(), re.IGNORECASE
    )
    assert m, f"CREATE OR REPLACE FUNCTION public.{name}() ... $fn$ ... $fn$; not found"
    return m.group(1) + " $fn$ " + m.group(2)


def _check_literals(code: str) -> set[str]:
    m = re.search(
        rf"ADD\s+CONSTRAINT\s+{CHECK}\s+CHECK\s*\(\s*action_type\s*=\s*ANY\s*\(\s*ARRAY\s*\[(.*?)\]",
        code, re.IGNORECASE | re.DOTALL,
    )
    assert m, "no ADD CONSTRAINT audit_log_action_type_check ... ARRAY[...] clause"
    return set(re.findall(r"'([^']+)'", m.group(1)))


def _number(path: Path) -> int:
    return int(path.name.split("_", 1)[0])


def _previous_check_literals() -> set[str]:
    """The literal set of the LAST migration before 225 that re-stated the CHECK (scanned)."""
    earlier = [
        p for p in MIGRATIONS.glob("*.sql")
        if re.match(r"^\d+_", p.name) and _number(p) < 225
        and re.search(rf"ADD\s+CONSTRAINT\s+{CHECK}", _strip(p.read_text(encoding="utf-8")), re.IGNORECASE)
    ]
    assert earlier, "no earlier migration re-states the audit CHECK"
    last = max(earlier, key=_number)
    return _check_literals(_strip(last.read_text(encoding="utf-8")))


# ── file + transaction ─────────────────────────────────────────────────────────────────────


def test_filename_is_digits_underscore_name_and_unique():
    assert re.fullmatch(r"\d+_[a-z0-9_]+\.sql", MIGRATION.name)
    assert len(list(MIGRATIONS.glob("225_*.sql"))) == 1


def test_transaction_wrapped():
    code = _code()
    assert re.search(r"\bBEGIN;", code) and re.search(r"\bCOMMIT;", code)
    assert code.index("BEGIN;") < code.index("COMMIT;")


def test_no_db_push_or_reset_outside_the_never_sentence():
    for line in _raw().splitlines():
        if "NEVER" in line:
            continue
        assert not re.search(r"db (push|reset)", line), line


# ── the four deny-all tables ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize("table", TABLES)
def test_each_table_is_deny_all(table):
    code = _code()
    assert re.search(rf"CREATE TABLE IF NOT EXISTS public\.{table} \(", code)
    assert f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;" in code
    order = []
    for role in ("PUBLIC", "anon", "authenticated", "service_role"):
        stmt = f"REVOKE ALL ON TABLE public.{table} FROM {role};"
        assert stmt in code, stmt
        order.append(code.index(stmt))
    assert order == sorted(order), f"{table}: REVOKE FROM PUBLIC must come first"
    grant = f"GRANT ALL ON TABLE public.{table} TO service_role;"
    assert grant in code
    assert code.index(grant) > order[-1]


def test_no_policy_anywhere():
    assert "CREATE POLICY" not in _code().upper()


def test_secret_is_ciphertext_only():
    body = _table_body("webhook_endpoints")
    assert re.search(r"secret_ciphertext text NOT NULL CHECK \(secret_ciphertext LIKE 'enc:v1:%'\)", body)
    assert re.search(
        r"previous_secret_ciphertext text NULL CHECK \(previous_secret_ciphertext IS NULL OR "
        r"previous_secret_ciphertext LIKE 'enc:v1:%'\)",
        body,
    )


def test_url_check_refuses_http_fragment_userinfo_and_length():
    body = _table_body("webhook_endpoints")
    m = re.search(r"CONSTRAINT webhook_endpoints_url_check CHECK \((.*?)\) ?,", body)
    assert m, "named url CHECK webhook_endpoints_url_check absent"
    check = m.group(1)
    assert "char_length(url) <= 2048" in check
    assert "url LIKE 'https://%'" in check
    assert "position('#' in url) = 0" in check
    assert "url !~ '^https://[^/?#]*@'" in check


def test_description_event_types_and_disabled_reason_checks():
    body = _table_body("webhook_endpoints")
    assert "char_length(description) <= 100" in body
    assert "cardinality(event_types) >= 1" in body
    assert "event_types <@ ARRAY['run.finished', 'run.waiting', 'document.ingested']::text[]" in body
    assert "disabled_reason IN ('failing', 'gone', 'admin', 'owner_removed')" in body
    assert "CHECK (NOT enabled OR disabled_reason IS NULL)" in body


def test_two_duplicate_walls():
    code = _code()
    assert re.search(
        r"CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_run_finished_once ON public\.webhook_events "
        r"\(item_id\) WHERE type = 'run\.finished'",
        code,
    )
    assert re.search(
        r"CONSTRAINT webhook_deliveries_endpoint_event_uq UNIQUE \(endpoint_id, event_id\)",
        _table_body("webhook_deliveries"),
    )


@pytest.mark.parametrize("table", ("webhook_deliveries", "webhook_delivery_attempts"))
def test_no_body_response_or_headers_column(table):
    body = _table_body(table)
    # column names are the first word of each top-level comma-separated item
    depth, item, items = 0, "", []
    for ch in body:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            items.append(item)
            item = ""
        else:
            item += ch
    items.append(item)
    names = [i.strip().split(" ", 1)[0] for i in items if i.strip()]
    assert names, body
    for name in names:
        assert not re.search(r"body|response|headers|request", name, re.IGNORECASE), (table, name)


def test_payload_lives_only_on_events_as_text():
    assert re.search(r"\bpayload text NULL\b", _table_body("webhook_events"))


# ── the emit functions + triggers ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("fn", FUNCTIONS)
def test_function_is_definer_rights_with_empty_search_path_and_swallows(fn):
    body = _function_body(fn)
    assert "SECURITY DEFINER" in body
    assert "SET search_path = ''" in body
    assert "EXCEPTION WHEN OTHERS THEN" in body
    assert "RAISE WARNING" in body
    assert "RETURN NULL;" in body


@pytest.mark.parametrize("fn", FUNCTIONS)
def test_execute_revoked_from_public_first(fn):
    code = _code()
    order = []
    for role in ("PUBLIC", "anon", "authenticated"):
        stmt = f"REVOKE EXECUTE ON FUNCTION public.{fn}() FROM {role};"
        assert stmt in code, stmt
        order.append(code.index(stmt))
    assert order == sorted(order), f"{fn}: REVOKE FROM PUBLIC must come first"
    assert f"GRANT EXECUTE ON FUNCTION public.{fn}() TO service_role;" in code


def test_exactly_two_security_definer_functions():
    assert len(re.findall(r"SECURITY DEFINER", _code())) == 2


def test_run_function_guards_golden_and_ownerless_runs_and_keeps_cap_paused():
    body = _function_body("webhook_emit_run_event")
    assert "NEW.user_id IS NULL" in body
    assert "is_golden_run" in body
    assert "'cap_paused'" in body
    assert "'run.finished'" in body and "'run.waiting'" in body
    assert "e.user_id = NEW.user_id" in body and "e.org_id = NEW.org_id" in body
    assert "ON CONFLICT DO NOTHING" in body


def test_runs_trigger_is_update_of_status_only():
    m = re.search(
        r"CREATE TRIGGER workflow_runs_webhook_emit (.*?) EXECUTE FUNCTION public\.webhook_emit_run_event\(\);",
        _code(),
    )
    assert m, "trigger workflow_runs_webhook_emit absent"
    head = m.group(1)
    assert head.startswith("AFTER UPDATE OF status ON public.workflow_runs")
    assert "INSERT" not in head
    assert "OLD.status IS DISTINCT FROM NEW.status" in head
    assert "'cap_paused'" in head


def test_documents_carry_two_triggers_and_the_insert_one_never_reads_old():
    code = _code()
    trig = re.findall(r"CREATE TRIGGER (\w+) (.*?) EXECUTE FUNCTION public\.(\w+)\(\);", code)
    on_docs = [t for t in trig if "ON public.documents" in t[1]]
    assert len(on_docs) == 2, on_docs
    assert {t[2] for t in on_docs} == {"webhook_emit_document_event"}
    by_name = {t[0]: t[1] for t in on_docs}
    ins = by_name["documents_webhook_emit_insert"]
    assert ins.startswith("AFTER INSERT ON public.documents")
    assert "OLD." not in ins and "NEW.status = 'completed'" in ins
    upd = by_name["documents_webhook_emit_update"]
    assert upd.startswith("AFTER UPDATE OF status ON public.documents")
    assert "OLD.status IS DISTINCT FROM NEW.status" in upd


def test_trigger_count():
    assert len(re.findall(r"CREATE TRIGGER", _code())) >= 5


# ── notifications widening (D-48) ──────────────────────────────────────────────────────────


def test_notifications_widening():
    code = _code()
    assert "ALTER TABLE public.notifications ALTER COLUMN run_id DROP NOT NULL;" in code
    assert re.search(
        r"ADD COLUMN IF NOT EXISTS endpoint_id uuid NULL REFERENCES public\.webhook_endpoints\(id\) "
        r"ON DELETE CASCADE",
        code,
    )
    assert "kind IN ('question', 'approval', 'webhook_disabled')" in code
    assert "'endpoint_enabled'" in code and "'answered'" in code and "'run_ended'" in code
    assert "notifications_kind_shape_check" in code
    assert re.search(
        r"CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_open_per_endpoint ON public\.notifications "
        r"\(endpoint_id\) WHERE closed_at IS NULL AND kind = 'webhook_disabled'",
        code,
    )


# ── audit lockstep (D-31) ──────────────────────────────────────────────────────────────────


def test_audit_check_is_previous_plus_the_nine():
    previous = _previous_check_literals()
    assert len(previous) >= 40, sorted(previous)  # non-vacuity: 217 carries 40
    now = _check_literals(_code())
    assert previous - now == set(), f"225 would DROP: {sorted(previous - now)}"
    assert now - previous == NEW_AUDIT, sorted(now - previous)


def test_valid_action_types_is_a_subset_and_names_the_nine():
    from app.services.audit_service import VALID_ACTION_TYPES

    now = _check_literals(_code())
    assert NEW_AUDIT <= VALID_ACTION_TYPES
    assert VALID_ACTION_TYPES <= now, sorted(VALID_ACTION_TYPES - now)

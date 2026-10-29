"""Phase 300-02 — migration 218's SHAPE, pinned against its text (D-18, D-19, D-20, D-26, D-27, D-29).

Migration 218 is the database half of run-waiting notices:

* ``public.notifications`` — one OPEN notice per recipient and run (a partial unique index), readable
  only by its recipient (one owner-only SELECT policy, D-29: a readable table, no route).
* ``public.notification_deliveries`` — the outbox. RLS on, NO policy: deny-all to every client role.
* ``public.notify_on_ask_row()`` / ``public.notify_on_run_status()`` — two fail-soft definer-rights
  trigger functions. Every body swallows its own errors, so a failing notice can never fail the
  engine's prompt insert (D-18). EXECUTE is revoked from PUBLIC first (the CLAUDE.md trap).
* the Settings columns (delay, from-address, from-name, dev redirect) and the invitation
  delivery columns (D-07 / D-08 / D-10 / D-11).

⚠ Structural assertions run over the migration text with ``--`` comments STRIPPED, and keyword
searches run with quoted literals removed too, so header prose (or a string) can neither satisfy nor
break a structural assertion. This checks TEXT; the applied behaviour is proven by
``tests/integration/test_300_notice_triggers_live.py`` and ``test_300_rls_anon_live.py``.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"

ASK_FN = "public.notify_on_ask_row()"
STATUS_FN = "public.notify_on_run_status()"
TABLES = ("public.notifications", "public.notification_deliveries")


def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("218_*.sql"))
    assert len(matches) == 1, f"expected exactly one 218_*.sql migration, found {matches}"
    assert matches[0].name == "218_run_waiting_notifications.sql", matches[0].name
    return matches[0]


def _raw() -> str:
    return _migration().read_text(encoding="utf-8")


def _strip_comments(sql: str) -> str:
    out = []
    for line in sql.splitlines():
        idx = line.find("--")
        if idx != -1:
            line = line[:idx]
        if line.strip():
            out.append(line)
    return "\n".join(out)


def _strip_literals(sql: str) -> str:
    """Remove single-quoted literals ('' escapes included) so a string cannot satisfy a keyword."""
    return re.sub(r"'(?:[^']|'')*'", "''", sql)


def _code() -> str:
    return _strip_comments(_raw())


def _bare() -> str:
    return _strip_literals(_code())


def _function_body(name: str) -> str:
    code = _code()
    m = re.search(
        r"CREATE OR REPLACE FUNCTION\s+" + re.escape(name) + r"(.*?)\$fn\$;",
        code,
        re.S | re.I,
    )
    assert m, f"{name} is not defined with a $fn$ body"
    return m.group(1)


# ── tables, RLS, grants ──────────────────────────────────────────────────────────


def test_both_tables_are_created_with_rls_on():
    code = _code()
    for table in TABLES:
        assert re.search(r"CREATE TABLE IF NOT EXISTS\s+" + re.escape(table) + r"\s*\(", code), table
        assert re.search(
            r"ALTER TABLE\s+" + re.escape(table) + r"\s+ENABLE ROW LEVEL SECURITY", code
        ), f"{table} must ENABLE ROW LEVEL SECURITY"


def test_table_revoke_from_public_precedes_every_grant():
    code = _code()
    for table in TABLES:
        revoke = re.search(r"REVOKE ALL ON TABLE\s+" + re.escape(table) + r"\s+FROM PUBLIC;", code)
        assert revoke, f"{table}: REVOKE ALL ... FROM PUBLIC missing (the PUBLIC trap)"
        for role in ("anon", "authenticated", "service_role"):
            assert re.search(
                r"REVOKE ALL ON TABLE\s+" + re.escape(table) + r"\s+FROM " + role + ";", code
            ), f"{table}: REVOKE ALL ... FROM {role} missing"
        grants = [m.start() for m in re.finditer(r"GRANT [^;]*ON TABLE\s+" + re.escape(table) + r"\b", code)]
        assert grants, f"{table}: no grant at all (service_role needs one)"
        assert all(g > revoke.start() for g in grants), f"{table}: a GRANT precedes the PUBLIC revoke"


def test_authenticated_may_only_select_notifications_and_nothing_on_the_outbox():
    code = _code()
    auth_grants = re.findall(r"GRANT ([^;]*?) ON TABLE\s+(public\.\w+)\s+TO authenticated;", code)
    assert ("SELECT", "public.notifications") in auth_grants, auth_grants
    for privs, table in auth_grants:
        assert table != "public.notification_deliveries", "the outbox is deny-all to clients (D-19)"
        if table == "public.notifications":
            assert privs.strip() == "SELECT", f"authenticated may only read notices, got {privs!r}"
    assert not re.search(r"TO anon\b", code), "anon is granted nothing by 218"


def test_one_recipient_only_select_policy_and_no_outbox_policy():
    code = _code()
    policies = re.findall(r"CREATE POLICY\s+\"[^\"]+\"\s+ON\s+(public\.\w+)([^;]*);", code)
    on_notices = [body for table, body in policies if table == "public.notifications"]
    assert len(on_notices) == 1, f"exactly one policy on notifications (D-29), found {len(on_notices)}"
    body = on_notices[0]
    assert re.search(r"FOR SELECT\s+TO authenticated", body), body
    assert re.search(r"recipient_id\s*=\s*\(\s*SELECT auth\.uid\(\)\s*\)", body), body
    assert not any(t == "public.notification_deliveries" for t, _ in policies), (
        "notification_deliveries must carry NO policy (deny-all to clients, D-19)"
    )


def test_the_partial_unique_index_predicate_matches_the_on_conflict_predicate():
    code = _code()
    idx = re.search(
        r"CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_open_per_recipient_run\s+"
        r"ON public\.notifications\s*\(recipient_id,\s*run_id\)\s+WHERE\s+(.+?);",
        code,
        re.S,
    )
    assert idx, "the one-open-notice-per-recipient-and-run partial unique index is missing"
    conflict = re.search(
        r"ON CONFLICT\s*\(recipient_id,\s*run_id\)\s+WHERE\s+(.+?)\s+DO UPDATE", _function_body(ASK_FN), re.S
    )
    assert conflict, "notify_on_ask_row must upsert ON CONFLICT (recipient_id, run_id) WHERE ..."
    norm = lambda s: re.sub(r"\s+", " ", s.strip().strip("()")).lower()  # noqa: E731
    assert norm(idx.group(1)) == norm(conflict.group(1)) == "closed_at is null"


def test_one_delivery_per_notice_is_a_unique_key():
    code = _code()
    m = re.search(r"CREATE TABLE IF NOT EXISTS public\.notification_deliveries\s*\((.*?)\n\);", code, re.S)
    assert m, "notification_deliveries table body not found"
    body = m.group(1)
    assert re.search(r"notification_id\s+uuid\s+NOT NULL\s+UNIQUE\s+REFERENCES public\.notifications", body)
    for status in ("pending", "retry", "sending", "sent", "failed", "suppressed",
                   "skipped_opted_out", "skipped_answered"):
        assert f"'{status}'" in body, f"outbox status {status!r} missing from the CHECK"
    for col in ("attempts", "due_at", "claimed_at", "subject", "text_body", "html_body",
                "waited_seconds", "provider", "provider_message_id", "reason", "sent_at"):
        assert re.search(r"\b" + col + r"\b", body), f"outbox column {col} missing"


def test_notifications_columns_are_the_names_later_plans_consume():
    code = _code()
    m = re.search(r"CREATE TABLE IF NOT EXISTS public\.notifications\s*\((.*?)\n\);", code, re.S)
    assert m
    body = m.group(1)
    for col in ("recipient_id", "org_id", "run_id", "kind", "tool_call_id", "created_at",
                "closed_at", "closed_reason"):
        assert re.search(r"^\s*" + col + r"\s", body, re.M), f"notifications.{col} missing"
    assert "'question'" in body and "'approval'" in body
    assert "'answered'" in body and "'run_ended'" in body


# ── the two definer-rights functions ─────────────────────────────────────────────


def test_each_function_is_definer_rights_with_an_empty_search_path_and_a_swallow():
    for fn in (ASK_FN, STATUS_FN):
        body = _function_body(fn)
        assert re.search(r"\bSECURITY DEFINER\b", body), f"{fn}: SECURITY DEFINER missing"
        assert re.search(r"SET search_path\s*=\s*''", body), f"{fn}: search_path must be pinned to ''"
        assert re.search(r"EXCEPTION WHEN OTHERS THEN\s+RAISE WARNING", body), f"{fn}: no swallow"
        assert re.search(r"RETURN NULL;", body), f"{fn}: an AFTER trigger returns NULL"


def test_function_execute_is_revoked_from_public_before_the_service_role_grant():
    code = _code()
    for fn in (ASK_FN, STATUS_FN):
        esc = re.escape(fn)
        revoke = re.search(r"REVOKE EXECUTE ON FUNCTION\s+" + esc + r"\s+FROM PUBLIC;", code)
        assert revoke, f"{fn}: EXECUTE not revoked FROM PUBLIC (revoking anon alone is a no-op)"
        for role in ("anon", "authenticated"):
            assert re.search(r"REVOKE EXECUTE ON FUNCTION\s+" + esc + r"\s+FROM " + role + ";", code)
        grant = re.search(r"GRANT EXECUTE ON FUNCTION\s+" + esc + r"\s+TO service_role;", code)
        assert grant and grant.start() > revoke.start(), f"{fn}: grant must follow the revoke"
        assert not re.search(r"GRANT EXECUTE ON FUNCTION\s+" + esc + r"\s+TO (anon|authenticated|PUBLIC)", code)


def test_neither_function_reads_the_message_org():
    for fn in (ASK_FN, STATUS_FN):
        body = _strip_literals(_function_body(fn)).lower()
        assert "new.org_id" not in body, f"{fn}: the notice org comes from workflow_runs, never NEW.org_id"
        assert "messages.org_id" not in body, f"{fn}: never read messages.org_id (the LIMIT-1 autofill)"


def test_the_ask_function_reads_the_run_and_guards_the_uuid_cast():
    body = _function_body(ASK_FN)
    assert re.search(r"FROM public\.workflow_runs", body), "the run row is the source of owner and org"
    assert "~*" in body and "[0-9a-f]{8}" in body, "a UUID regex guard must precede the run_id cast"
    guard = body.find("~*")
    cast = body.find("::uuid")
    assert -1 < guard < cast, "the regex guard must come BEFORE the ::uuid cast"
    for needle in ("'harness'", "'ask_user_prompt'", "'ask_user_response'", "'action_risk'",
                   "is_golden_run", "'active'", "'paused'", "notification_email_delay_seconds"):
        assert needle in body, f"notify_on_ask_row is missing {needle}"
    assert re.search(r"ON CONFLICT\s*\(notification_id\)\s*DO NOTHING", body)


def test_the_status_function_closes_and_follows_the_schedule_waiting_contract():
    body = _function_body(STATUS_FN)
    assert "'run_ended'" in body
    assert "_schedule_id" in body and "public.workflow_schedules" in body
    assert "last_status = 'waiting'" in body, "D-26: only a schedule recorded 'waiting' is followed up"
    assert re.search(r"NOT EXISTS", body), "D-26: a newer run of the same schedule wins"


# ── the triggers ─────────────────────────────────────────────────────────────────


def test_the_messages_trigger_is_narrowed_by_a_when_clause():
    code = _code()
    m = re.search(
        r"CREATE TRIGGER messages_notify_on_ask\s+AFTER INSERT ON public\.messages\s+FOR EACH ROW\s+"
        r"WHEN\s*\((.*?)\)\s*EXECUTE FUNCTION public\.notify_on_ask_row\(\);",
        code,
        re.S,
    )
    assert m, "messages_notify_on_ask must be AFTER INSERT ... WHEN (...) EXECUTE FUNCTION notify_on_ask_row()"
    when = m.group(1)
    assert "NEW.role = 'system'" in when, "both the prompt and the response rows carry role 'system'"
    assert "NEW.tool_calls IS NOT NULL" in when
    assert re.search(r"DROP TRIGGER IF EXISTS messages_notify_on_ask ON public\.messages;", code)


def test_the_run_status_trigger_fires_only_on_a_terminal_change():
    code = _code()
    m = re.search(
        r"CREATE TRIGGER workflow_runs_notify_on_status\s+AFTER UPDATE OF status ON public\.workflow_runs\s+"
        r"FOR EACH ROW\s+WHEN\s*\((.*?)\)\s*EXECUTE FUNCTION public\.notify_on_run_status\(\);",
        code,
        re.S,
    )
    assert m, "workflow_runs_notify_on_status must be AFTER UPDATE OF status ... WHEN (...)"
    when = m.group(1)
    assert "NEW.status IS DISTINCT FROM OLD.status" in when
    for s in ("'completed'", "'failed'", "'cancelled'"):
        assert s in when
    assert "'paused'" not in when and "'cap_paused'" not in when
    assert re.search(r"DROP TRIGGER IF EXISTS workflow_runs_notify_on_status ON public\.workflow_runs;", code)


# ── Settings + invitation columns (schema, never a seed) ─────────────────────────


def test_app_settings_columns_are_schema_never_a_seed():
    bare = _bare().lower()
    assert "insert into public.app_settings" not in bare, "D-27: a column default is schema, not a seed"
    assert "update public.app_settings" not in bare
    code = _code()
    for col in ("notification_email_delay_seconds", "email_from_address", "email_from_name",
                "email_dev_redirect_address"):
        assert re.search(r"ADD COLUMN IF NOT EXISTS " + col + r"\b", code), f"app_settings.{col} missing"
    assert re.search(r"notification_email_delay_seconds integer NOT NULL DEFAULT 120", code)
    assert re.search(r"email_from_name text NOT NULL DEFAULT 'Syrel'", code)


def test_the_delay_is_bounded_60_to_3600():
    code = _code()
    assert re.search(
        r"CHECK\s*\(\s*notification_email_delay_seconds\s*>=\s*60\s+AND\s+"
        r"notification_email_delay_seconds\s*<=\s*3600\s*\)",
        code,
    ), "D-07: the delay CHECK must bound 60..3600"
    assert re.search(r"DROP CONSTRAINT IF EXISTS app_settings_notification_email_delay_seconds_bound", code)


def test_invitation_delivery_columns_exist_with_their_check():
    code = _code()
    for col in ("email_delivery", "email_failed_at", "email_failure"):
        assert re.search(r"ALTER TABLE public\.org_invitations\s+ADD COLUMN IF NOT EXISTS " + col, code), col
    assert re.search(
        r"email_delivery IS NULL OR email_delivery IN \('sent',\s*'failed',\s*'not_configured'\)", code
    )


# ── header + VERIFY ──────────────────────────────────────────────────────────────


def test_the_header_records_the_apply_story_and_the_no_backfill_decision():
    raw = _raw()
    header = raw[: raw.find("CREATE")]
    for needle in ("SCHEMA, NOT A SEED", "NO BACKFILL", "regenerate-full-schema.sh", "NO --reset",
                   "NEVER `supabase db push`", "get_advisors(security)"):
        assert needle in header, f"header is missing {needle!r}"


def test_the_migration_ends_with_a_read_only_verify_select():
    code = _code().rstrip()
    statements = [s.strip() for s in code.split(";") if s.strip()]
    last = statements[-1]
    assert last.upper().startswith("SELECT"), f"the last statement must be the VERIFY select, got {last[:60]!r}"
    assert "'PASS'" in last and "'FAIL'" in last
    for needle in ("relrowsecurity", "messages_notify_on_ask", "workflow_runs_notify_on_status",
                   "has_function_privilege"):
        assert needle in last, f"VERIFY must check {needle}"
    assert "migration_218_verify" in last


def test_the_only_notice_and_delivery_writes_are_the_triggers_no_backfill():
    bare = _bare().lower()
    notice_writes = len(re.findall(r"insert into public\.notifications\s*\(", bare))
    delivery_writes = len(re.findall(r"insert into public\.notification_deliveries\s*\(", bare))
    assert notice_writes == 1, f"NO BACKFILL: the trigger is the only notice writer, found {notice_writes}"
    assert delivery_writes == 1, f"NO BACKFILL: the trigger is the only delivery writer, found {delivery_writes}"
    ask = _strip_literals(_function_body(ASK_FN)).lower()
    assert re.search(r"insert into public\.notifications\s*\(", ask)
    assert re.search(r"insert into public\.notification_deliveries\s*\(", ask)

"""Phase 308-03 (D-20 / T-308-13) — no body, response or headers is ever stored or logged.

Three scans, all static:

* every ``*_SQL`` constant in ``app.db.webhooks`` and ``app.db.webhook_outbox`` — none names a column
  ``response`` / ``request_body`` / ``headers`` / ``body``;
* migration 225's DDL (comments stripped) — ``webhook_deliveries`` and ``webhook_delivery_attempts``
  define no such column, and the ONE payload column in the four webhook tables is
  ``webhook_events.payload`` (D-58);
* every ``logger.*`` call in the outbox, the drainer, the sender and the route data layer — no
  argument names a URL, a secret, a body or the payload (a receiver token lives in a URL's path or
  query; AST, not a regex over source).
"""
from __future__ import annotations

import ast
import importlib
import re
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
MIGRATION_225 = REPO / "supabase" / "migrations" / "225_webhooks.sql"

_DB_MODULES = ("app.db.webhooks", "app.db.webhook_outbox")
_LOGGING_MODULES = (
    "app.db.webhooks",
    "app.db.webhook_outbox",
    "app.services.webhook_drainer",
    "app.services.webhook_sender",
)
_BODY_COLUMN = re.compile(r"\b(response|request_body|headers|body)\b", re.IGNORECASE)
_FORBIDDEN_IN_LOGS = ("url", "secret", "body", "payload", "headers", "signature")


def _sql_constants() -> list[tuple[str, str, str]]:
    found = []
    for mod_name in _DB_MODULES:
        mod = importlib.import_module(mod_name)
        for name in dir(mod):
            value = getattr(mod, name)
            if name.endswith("_SQL") and isinstance(value, str):
                found.append((mod_name, name, value))
    return found


_CONSTANTS = _sql_constants()


def test_both_data_modules_are_scanned_and_hold_constants():
    modules = {m for m, _, _ in _CONSTANTS}
    assert modules == set(_DB_MODULES), modules
    outbox = {n for m, n, _ in _CONSTANTS if m == "app.db.webhook_outbox"}
    # the exactly-once statements are among the scanned set (non-vacuity)
    assert {"CLAIM_DELIVERIES_SQL", "RECLAIM_SQL", "RENEW_LEASE_SQL", "RECORD_SQL"} <= outbox, outbox


@pytest.mark.parametrize("mod_name, name, sql", _CONSTANTS, ids=[f"{m.rsplit('.', 1)[-1]}.{n}" for m, n, _ in _CONSTANTS])
def test_no_sql_constant_names_a_body_response_or_headers_column(mod_name, name, sql):
    match = _BODY_COLUMN.search(sql)
    assert match is None, f"{mod_name}.{name} names {match.group(0)!r} (D-20: no body/response/headers)"


def _strip_comments(sql: str) -> str:
    return "\n".join(line.split("--", 1)[0] for line in sql.splitlines())


def _table_block(ddl: str, table: str) -> str:
    match = re.search(
        rf"CREATE TABLE IF NOT EXISTS public\.{table} \((.*?)\n\);", ddl, re.DOTALL
    )
    assert match, f"no CREATE TABLE for {table} in 225"
    return match.group(1)


def _columns(block: str) -> list[str]:
    cols = []
    for line in block.splitlines():
        line = line.strip()
        if not line or line.upper().startswith("CONSTRAINT"):
            continue
        cols.append(line.split()[0])
    return cols


@pytest.mark.parametrize("table", ["webhook_deliveries", "webhook_delivery_attempts"])
def test_225_defines_no_body_column_on_deliveries_or_attempts(table):
    ddl = _strip_comments(MIGRATION_225.read_text(encoding="utf-8"))
    cols = _columns(_table_block(ddl, table))
    assert cols, "non-vacuity: the table has columns"
    for col in cols:
        assert not _BODY_COLUMN.search(col), f"{table}.{col} would hold a body/response/headers"
        assert "payload" not in col, f"{table}.{col}: the only payload column is webhook_events.payload"


def test_the_only_payload_column_is_webhook_events_payload():
    ddl = _strip_comments(MIGRATION_225.read_text(encoding="utf-8"))
    owners = []
    for table in ("webhook_endpoints", "webhook_events", "webhook_deliveries", "webhook_delivery_attempts"):
        for col in _columns(_table_block(ddl, table)):
            if "payload" in col or _BODY_COLUMN.search(col):
                owners.append(f"{table}.{col}")
    assert owners == ["webhook_events.payload"], owners


def _logger_calls(tree: ast.AST):
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "logger"
        ):
            yield node


def _identifiers(node: ast.AST):
    for sub in ast.walk(node):
        if isinstance(sub, ast.Name):
            yield sub.id
        elif isinstance(sub, ast.Attribute):
            yield sub.attr
        elif isinstance(sub, ast.keyword) and sub.arg:
            yield sub.arg


@pytest.mark.parametrize("mod_name", _LOGGING_MODULES)
def test_no_log_line_carries_a_url_secret_or_body(mod_name):
    mod = importlib.import_module(mod_name)
    source = Path(mod.__file__).read_text(encoding="utf-8")
    calls = list(_logger_calls(ast.parse(source)))
    for call in calls:
        args = list(call.args[1:]) + list(call.keywords)
        for arg in args:
            for ident in _identifiers(arg):
                low = ident.lower()
                assert not any(word in low for word in _FORBIDDEN_IN_LOGS), (
                    f"{mod_name}:{call.lineno} logs {ident!r} (T-308-13: never a URL, secret or body)"
                )
        if call.args and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str):
            fmt = call.args[0].value.lower()
            assert "url=" not in fmt and "secret" not in fmt and "body=" not in fmt, (
                f"{mod_name}:{call.lineno} format names a URL/secret/body: {fmt!r}"
            )


def test_the_drainer_and_outbox_do_log_something_by_id():
    """Non-vacuity for the scan above: the two new modules carry logger calls."""
    for mod_name in ("app.db.webhook_outbox", "app.services.webhook_drainer"):
        mod = importlib.import_module(mod_name)
        tree = ast.parse(Path(mod.__file__).read_text(encoding="utf-8"))
        assert list(_logger_calls(tree)), f"{mod_name} has no logger call to scan"

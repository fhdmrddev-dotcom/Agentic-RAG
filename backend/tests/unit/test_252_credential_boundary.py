"""Phase 252 (CRED-01, SC#2 + SC#3) — the credential boundary, driven from both directions.

Phase 248 tightened `custom_client_id` so a pasted secret is refused rather than stored in an
org-readable column. Two seams defeated it, and this file is the drive for both.

**B-2 — OUT, to the application log.** `_to_response`'s degraded fallback logged the raw
pydantic `ValidationError` with `%s`. Pydantic v2's `ValidationError.__str__` renders
`input_value=...` for **every union arm it tried**, and `ConnectorConnectionResponse.config` is
a five-member union — so one refused credential was echoed several times into a log line whose
shipping, retention and operator access are governed by nothing the database's RLS says. ⛔ The
population that handler exists for is **precisely the legacy rows that already hold a secret
there** (its own SEED-239 comment says so), so the phase had moved the secret out of a readable
column and into the log.

⚠ THE ASSERTION MUST BE OVER THE FORMATTED MESSAGE (`caplog.text`), NEVER `record.args`. The
copies live inside the exception's `__str__`; a structured-args assertion passes straight over
the leak and reports green.

**B-3 — IN, past the validator.** `CustomClientId` guards three *request* models. The RFC 7591
dynamic-registration path takes a `client_id` from a **remote server's response** and writes it
through `store_oauth_client_credentials`, which validated nothing. A request model cannot guard
that door — the value never comes through one. The validation therefore belongs at the single
**write seam**, and the refusal must say which rule failed while never saying the value.
"""

from __future__ import annotations

import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services import connector_service

#: Trips the shipped `_validate_custom_client_id`'s Microsoft-Entra `~` arm, so the REAL
#: validator is what refuses it. ⛔ No stubbed model and no hand-built `ValidationError`: the
#: leak lives in pydantic's own rendering and only the real model can produce it.
#:
#: ⚠ **THE OBVIOUS PROBE — `"sk-live-" + "A"*40` — REPORTS A FALSE GREEN, AND THAT IS A FINDING
#: RATHER THAN A DETAIL.** `app/services/logging_sink.py:84` carries
#: `(re.compile(r"sk-[A-Za-z0-9_\-]{6,}"), "sk-***REDACTED***")`, and its `_RedactingFilter`
#: mutates `record.msg` in place, so every later handler — caplog's included — sees the masked
#: string. Measured here: an `sk-` value counts **0** in `caplog.text` while an Entra-shaped one
#: counts **5**. The redactor knows FOUR shapes; `_validate_custom_client_id` refuses at least
#: thirteen prefixes plus `~` plus `len > 128`, so the overlap is partial and the leak is real
#: for every shape outside it. ⛔ And the sink is **opt-in** (`LOG_FILE_PATH` / `BACKEND_LOG_FILE`
#: unset → no handler, no filter), so on a default deployment even the `sk-` shape leaks in full
#: — measured at 5 occurrences with no sink installed.
SECRET = "Zq8~" + "B" * 40

#: A second refused shape, outside the redactor's four patterns, so the drive is not
#: shape-specific: the `known_secret_prefixes` arm.
SECRET_PREFIXED = "secret_" + "C" * 40

LOGGER_NAME = "app.services.connector_service"

VALID_CLIENT_ID = "123456.apps.example.com"


def _row(client_id: str | None) -> dict:
    """A row shaped as `_to_response` receives it from `connector_connections`."""
    d: dict = {
        "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
        "org_id": "oooooooo-oooo-oooo-oooo-oooooooooooo",
        "service_id": "notion",
        "name": "Notion MCP",
        "auth_type": "mcp",
        "status": "active",
        "mcp_server_url": "https://mcp.notion.com/mcp",
        "config": {"headers": {}},
    }
    if client_id is not None:
        d["config"]["custom_client_id"] = client_id
    return d


# ── B-2 · the leak ───────────────────────────────────────────────────────────────────────


def test_the_degraded_fallback_does_not_leak_the_credential_to_the_log(caplog):
    """SC#2 — a connections-list read over a legacy secret-bearing row logs ZERO copies of it.

    ⛔ Driven through the REAL `ConnectorConnectionResponse` and the REAL
    `_validate_custom_client_id`. The assertion is over `caplog.text` — the rendered message.
    """
    for value in (SECRET, SECRET_PREFIXED):
        caplog.clear()
        caplog.set_level(logging.WARNING, logger=LOGGER_NAME)

        resp = connector_service._to_response(_row(value))

        # The fallback still works: ONE bad row may never 503 the whole org
        # (SEED-239 / TM-248-05).
        assert resp.status == "error"
        assert resp.error_message

        # ⭐ THE ASSERTION THIS FILE EXISTS FOR.
        assert caplog.text.count(value) == 0, (
            f"the refused credential is in the log {caplog.text.count(value)} time(s)"
        )

        # ⛔ And it still names WHICH field failed — a log that says only "validation failed"
        #   is a different defect (an unactionable log), not a fix.
        assert "custom_client_id" in caplog.text
        assert resp.id in caplog.text

        # ⛔ The value never reaches the rendered row either — a degraded `error_message` that
        #   echoed it would be this same leak one register over.
        assert value not in resp.error_message


def test_control_a_good_row_is_untouched_and_logs_nothing(caplog):
    """The control. Proves the fix does not silence the handler or degrade good rows."""
    caplog.set_level(logging.WARNING, logger=LOGGER_NAME)

    resp = connector_service._to_response(_row(VALID_CLIENT_ID))

    assert resp.status != "error"
    assert resp.config.custom_client_id == VALID_CLIENT_ID
    warnings = [r for r in caplog.records if r.name == LOGGER_NAME]
    assert warnings == [], f"a valid row emitted {len(warnings)} warning(s)"


# ── B-3 · the bypass at the write seam ───────────────────────────────────────────────────


class _FakeQuery:
    """Records the update payload and the predicates, and answers like postgrest does."""

    def __init__(self, sink: dict):
        self.sink = sink

    def table(self, name):
        self.sink["table"] = name
        return self

    def update(self, payload):
        self.sink["update"] = payload
        return self

    def eq(self, column, value):
        self.sink.setdefault("eq", {})[column] = value
        return self


def _wire_writer(monkeypatch) -> tuple[dict, AsyncMock]:
    sink: dict = {}
    writer = AsyncMock(return_value=SimpleNamespace(data=[]))
    monkeypatch.setattr(connector_service, "_client", lambda _s: _FakeQuery(sink))
    monkeypatch.setattr(connector_service, "aexec", writer)
    monkeypatch.setattr(
        connector_service,
        "_fetch_connection_row",
        AsyncMock(return_value={"id": "c1", "org_id": "o1", "config": {"headers": {}}}),
    )
    return sink, writer


@pytest.mark.asyncio
async def test_a_server_issued_client_id_that_smells_like_a_secret_is_never_stored(monkeypatch):
    """SC#3 — the single write seam applies the boundary the request models already carry.

    ⛔ "It raised" alone does not prove nothing was persisted. The writer is asserted
    un-invoked, because the consequence of a bad write is worse than the bypass: every later
    read fails `model_validate` and degrades to `status="error"` forever.
    """
    sink, writer = _wire_writer(monkeypatch)

    with pytest.raises(connector_service.ConnectorClientIdRefused) as excinfo:
        await connector_service.store_oauth_client_credentials(
            "c1", "o1", client_id=SECRET, client_secret=None
        )

    assert writer.await_count == 0, "a refused client_id reached the database"
    assert "update" not in sink

    # TM-252-09 — the refusal names the RULE, never the value. B-2 in a second register.
    assert SECRET not in str(excinfo.value)
    assert "custom_client_id" in str(excinfo.value)


@pytest.mark.asyncio
async def test_a_compliant_client_id_writes_exactly_as_it_did_before(monkeypatch):
    """The control — the happy path is not narrowed by the new validation.

    Written BEFORE the change, not after: this is what proves the boundary was added and not
    the door closed.
    """
    sink, writer = _wire_writer(monkeypatch)
    monkeypatch.setattr(
        "app.services.oauth_service.encrypt_token_value", lambda v: f"enc:v1:{v}"
    )

    await connector_service.store_oauth_client_credentials(
        "c1", "o1", client_id=VALID_CLIENT_ID, client_secret="the-app-secret"
    )

    update = sink["update"]
    assert update["config"]["custom_client_id"] == VALID_CLIENT_ID
    # The legacy plaintext sweep, still swept on every write.
    assert "custom_client_secret" not in update["config"]
    assert update["oauth_client_secret_ciphertext"] == "enc:v1:the-app-secret"
    # D-14 — the scope. Removing this term is the leak.
    assert sink["eq"]["org_id"] == "o1"
    assert sink["eq"]["id"] == "c1"

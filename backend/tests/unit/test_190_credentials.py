"""Phase 190 (CONN-03) — the credential layer's own falsification set.

VALIDATION rows **T5** (no secret in any log line), **T6/T7** (no secret in any response
shape) and decision **D-11** (the cipher is fail-CLOSED at BOTH ends), plus the permanent
guard for **D-14**'s id-only regression.

── EVERY CASE HERE WAS DRIVEN RED AGAINST A REAL PLANT IN PRODUCTION SOURCE ──────────────
Not against a mutated copy, not against a hypothetical. Each plant is named in the case it
proves, was observed failing, and was then reverted and the file re-hashed md5-identical.
The verbatim failure text for all six cycles is recorded in ``190-06-SUMMARY.md``. A test
that has never been observed RED proves nothing — which is the entire premise of this
phase's Wave 0, applied to Wave 2's own output.

⚠ The plant for case 5 is the one worth reading twice. A log-capture assertion of the form
*"the secret appears zero times"* is green when the capture is BROKEN, when the logger name
is wrong, when propagation is off, and when the code under test never ran at all. Case 5
therefore carries a POSITIVE CONTROL that pushes the same sentinel through the same capture
and asserts it IS found. Without it the row is decorative.
"""

from __future__ import annotations

import logging
from types import SimpleNamespace

import pytest

from app.models.connector import (
    ConnectorConnectionCreate,
    ConnectorConnectionResponse,
    PostMessageConfig,
)
from app.security.secret_cipher import is_encrypted
from app.services import connector_service
from app.services.connector_service import (
    ConnectorCipherUnavailable,
    ConnectorNotFound,
    ConnectorSecretNotEncrypted,
    ResolvedConnection,
    create_connection,
    resolve_connection,
)

# ── the fixtures ──────────────────────────────────────────────────────────────────────────
ORG_A = "aaaaaaaa-0000-4000-8000-000000000001"
ORG_B = "bbbbbbbb-0000-4000-8000-000000000002"
CONNECTION_ID = "cccccccc-0000-4000-8000-00000000000c"
CREATED_BY = "dddddddd-0000-4000-8000-00000000000d"

# The sentinel. Deliberately one long unmistakable token rather than a realistic-looking
# one: if it ever appears in captured output, `grep` finds it and nobody has to argue about
# whether a partial match counts.
SENTINEL_SECRET = "xoxb-SENTINEL-CREDENTIAL-MUST-NEVER-BE-LOGGED-190"


def _payload(secret: str = SENTINEL_SECRET) -> ConnectorConnectionCreate:
    return ConnectorConnectionCreate(
        capability="post_message",
        name="Ops — #alerts",
        config=PostMessageConfig(default_channel="C0ALERTS"),
        secret=secret,
    )


# ── the smallest supabase client that `create_connection` can be driven against ───────────
class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQueryParams(dict):
    """`httpx.QueryParams`' immutable `.set()` in four lines — the shape `_project` writes."""

    def set(self, key, value):  # noqa: A003 — mirrors httpx.QueryParams.set exactly
        merged = _FakeQueryParams(self)
        merged[key] = value
        return merged


class _FakeInsert:
    def __init__(self, store: list, row: dict):
        self._store = store
        self._row = row
        # CR-01 / migration 118 — `connector_service._project` pins PostgREST's returning
        # projection by writing `builder.request.params`. Modelled so the double stays
        # faithful to the real builder rather than failing with AttributeError.
        self.request = SimpleNamespace(params=_FakeQueryParams())

    def execute(self):
        stored = {"id": CONNECTION_ID, **self._row}
        self._store.append(stored)
        return _FakeResult([stored])


class _FakeTable:
    def __init__(self, store: list):
        self._store = store

    def insert(self, row: dict):
        return _FakeInsert(self._store, row)


class _FakeClient:
    """Records every row that reaches the storage layer. An EMPTY store is the assertion.

    "The write was refused" and "the write happened and then something raised" are the same
    exception to a caller and completely different facts about a credential at rest. This
    client is how the difference is measured rather than assumed.
    """

    def __init__(self):
        self.rows: list[dict] = []

    def table(self, _name: str):
        return _FakeTable(self.rows)


def _stored_row(secret_ciphertext, *, org_id: str = ORG_A, is_enabled: bool = True) -> dict:
    return {
        "id": CONNECTION_ID,
        "org_id": org_id,
        "capability": "post_message",
        "name": "Ops — #alerts",
        "config": {"default_channel": "C0ALERTS"},
        "secret_ciphertext": secret_ciphertext,
        "is_enabled": is_enabled,
    }


def _fetch_returning(row: dict | None):
    """A CORRECTLY SCOPED fetch seam: the row only comes back for its own org."""

    async def _fetch(connection_id, org_id):
        if row is None or connection_id != row["id"] or org_id != row["org_id"]:
            return None
        return dict(row)

    return _fetch


# ══════════════════════════════════════════════════════════════════════════════════════════
# 1 · D-11, THE WRITE INVERSION
# ══════════════════════════════════════════════════════════════════════════════════════════
async def test_the_store_is_REFUSED_when_no_cipher_is_configured(monkeypatch):
    """D-11 — no key configured means the connector secret is NOT WRITTEN. At all.

    ``app_settings`` tolerates a plaintext secret at rest when ``get_cipher()`` returns
    ``None`` — a deliberate fail-OPEN path (D-150-01). A per-org TENANT credential does not
    get that treatment, and this is the case that says so.

    PLANT (observed RED): let the write fall through to a plaintext store —
    ``row["secret_ciphertext"] = payload.secret`` with the cipher guard removed. The
    exception assertion below goes RED, and so does ``client.rows == []``.
    """
    monkeypatch.setattr(connector_service, "get_cipher", lambda: None)
    client = _FakeClient()

    with pytest.raises(ConnectorCipherUnavailable):
        await create_connection(
            org_id=ORG_A, created_by=CREATED_BY, payload=_payload(), supabase=client
        )

    assert client.rows == [], (
        "D-11: the store was REFUSED but a row still reached the storage layer. A refusal "
        f"that writes first is not a refusal. Rows: {[sorted(r) for r in client.rows]}"
    )


# ══════════════════════════════════════════════════════════════════════════════════════════
# 2 · D-11, THE READ INVERSION — HALF ONE (no envelope)
# ══════════════════════════════════════════════════════════════════════════════════════════
async def test_a_plaintext_stored_value_is_REFUSED_on_read():
    """D-11 — a stored value with no envelope is a REFUSAL, never a passthrough.

    ⚠ THE POLARITY DIFFERENCE FROM ``app_settings`` IS THE POINT, and the plant is a
    verbatim copy of the shipped code that has the OTHER polarity:
    ``sso_provider_service.get_management_token``'s last two lines read

        # No envelope: the value is plaintext at rest (fail-open D-150-01 — no master key).
        return raw

    That is correct THERE — a provider API key the operator pasted into their own instance.
    It is wrong HERE, for an org-scoped tenant credential that reached the column through a
    path this service does not own. Planting those two lines in ``resolve_connection`` in
    place of the ``is_encrypted`` guard turns this case RED (no exception raised).
    """
    plaintext_at_rest = "xoxb-A-TENANT-CREDENTIAL-SITTING-IN-THE-CLEAR"
    row = _stored_row(plaintext_at_rest)

    with pytest.raises(ConnectorSecretNotEncrypted) as excinfo:
        await resolve_connection(
            connection_id=CONNECTION_ID, org_id=ORG_A, fetch_row=_fetch_returning(row)
        )

    assert plaintext_at_rest not in str(excinfo.value), (
        f"D-08: the refusal put the credential in its own message: {str(excinfo.value)!r}"
    )


# ══════════════════════════════════════════════════════════════════════════════════════════
# 3 · D-11, THE READ INVERSION — HALF TWO (envelope, no key)
# ══════════════════════════════════════════════════════════════════════════════════════════
async def test_an_encrypted_value_with_no_key_is_REFUSED_on_read(monkeypatch):
    """D-11 — an encrypted value with no configured key is a refusal, not a degraded read.

    This half already exists in the tree with the right polarity
    (``sso_provider_service``'s encrypted-but-no-key branch) and is copied rather than
    invented. It is asserted anyway: "we copied the correct half" is a claim about a diff,
    not about behaviour.

    PLANT (observed RED): drop the ``if cipher is None`` guard, so the flow reaches the
    ``ResolvedConnection`` construction and the refusal never happens.
    """
    from app.security.secret_cipher import encrypt_secret, get_cipher

    cipher = get_cipher()
    if cipher is None:
        pytest.skip("this case needs a configured SECRETS_ENCRYPTION_KEY to build a fixture")
    row = _stored_row(encrypt_secret(SENTINEL_SECRET, cipher))

    # The key disappears between the write and the read — a rotation, a redeployed env, a
    # restored backup. Every one of those is a real Tuesday.
    monkeypatch.setattr(connector_service, "get_cipher", lambda: None)

    with pytest.raises(ConnectorCipherUnavailable):
        await resolve_connection(
            connection_id=CONNECTION_ID, org_id=ORG_A, fetch_row=_fetch_returning(row)
        )


# ══════════════════════════════════════════════════════════════════════════════════════════
# 4 · THE NON-VACUITY CONTROL — the round trip actually works
# ══════════════════════════════════════════════════════════════════════════════════════════
async def test_a_round_trip_stores_an_enc_v1_envelope_and_returns_the_original():
    """Without this, a service that refuses EVERYTHING passes cases 1-3 forever.

    Three separate assertions, because "it came back" is not enough: the stored form must
    carry the envelope (so it is genuinely encrypted at rest), must NOT be the plaintext
    (so a passthrough disguised as a store is caught), and the resolved value must be the
    original (so the encryption is reversible by the same code path the executor uses).
    """
    client = _FakeClient()
    response = await create_connection(
        org_id=ORG_A, created_by=CREATED_BY, payload=_payload(), supabase=client
    )
    assert isinstance(response, ConnectorConnectionResponse)

    assert len(client.rows) == 1, f"expected exactly one stored row, got {len(client.rows)}"
    stored = client.rows[0]["secret_ciphertext"]
    assert is_encrypted(stored), (
        "the stored value carries no encryption envelope — the credential is at rest in the "
        "clear and D-11's whole write half did nothing"
    )
    assert stored != SENTINEL_SECRET, "the 'ciphertext' is the plaintext verbatim"

    resolved = await resolve_connection(
        connection_id=CONNECTION_ID,
        org_id=ORG_A,
        fetch_row=_fetch_returning(_stored_row(stored)),
    )
    assert resolved.secret == SENTINEL_SECRET, (
        "the round trip did not return the original credential — the executor would send "
        "with the wrong bytes, and every case above would still be green"
    )
    # The org the row was resolved FOR is carried, so a caller cannot later mistake it.
    assert resolved.org_id == ORG_A


# ══════════════════════════════════════════════════════════════════════════════════════════
# 5 · T5 — NO SECRET SUBSTRING IN ANY LOG LINE (with a working-capture positive control)
# ══════════════════════════════════════════════════════════════════════════════════════════
def _all_captured_text(caplog) -> str:
    """Every angle a secret could reach a sink from: the formatted message, the raw
    template, and the *arguments*. The last one matters — ``logger.info("row=%s", row)``
    never formats until a handler asks, so a naive ``record.getMessage()``-only sweep can
    miss a credential that is sitting in ``record.args`` waiting for a handler to print it.
    """
    chunks: list[str] = []
    for record in caplog.records:
        chunks.append(str(record.msg))
        chunks.append(record.getMessage())
        chunks.append(repr(record.args))
    return "\n".join(chunks)


async def test_T5_no_secret_substring_appears_in_any_log_line(caplog, monkeypatch):
    """T5 / D-08 — a refusal and a success both log NAMES, ids and counts. Never a value.

    Three drives in one capture: a refused store, a refused read, and — the one that
    matters most — a SUCCESSFUL resolve, because the success path is where a well-meaning
    "log what we resolved" line gets added and nobody notices.

    PLANT (observed RED): change the resolve success log from ``row.get("capability")`` /
    ``sorted(config)`` to the whole ``row``. The ciphertext assertion goes RED immediately.

    ⚠ THE POSITIVE CONTROL BELOW IS NOT OPTIONAL. A capture that silently records nothing —
    wrong logger name, propagation disabled, level too high, or simply no code executed —
    makes every "appears zero times" assertion green forever. The control pushes the same
    sentinel through the same capture and asserts it IS found, so a broken capture fails
    this test instead of flattering it.
    """
    from app.security.secret_cipher import encrypt_secret, get_cipher

    cipher = get_cipher()
    if cipher is None:
        pytest.skip("this case needs a configured SECRETS_ENCRYPTION_KEY to build a fixture")
    ciphertext = encrypt_secret(SENTINEL_SECRET, cipher)

    caplog.set_level(logging.DEBUG, logger="app.services.connector_service")
    caplog.clear()

    # (a) a refused store — no cipher.
    monkeypatch.setattr(connector_service, "get_cipher", lambda: None)
    with pytest.raises(ConnectorCipherUnavailable):
        await create_connection(
            org_id=ORG_A, created_by=CREATED_BY, payload=_payload(), supabase=_FakeClient()
        )
    monkeypatch.undo()

    # (b) a refused read — plaintext at rest.
    with pytest.raises(ConnectorSecretNotEncrypted):
        await resolve_connection(
            connection_id=CONNECTION_ID,
            org_id=ORG_A,
            fetch_row=_fetch_returning(_stored_row(SENTINEL_SECRET)),
        )

    # (c) a SUCCESSFUL resolve, and the credential is then read.
    resolved = await resolve_connection(
        connection_id=CONNECTION_ID,
        org_id=ORG_A,
        fetch_row=_fetch_returning(_stored_row(ciphertext)),
    )
    assert resolved.secret == SENTINEL_SECRET  # the value is actually materialized

    captured = _all_captured_text(caplog)
    assert captured.count(SENTINEL_SECRET) == 0, (
        f"T5: the credential appears {captured.count(SENTINEL_SECRET)} time(s) in captured "
        "log output. Log lines carry column NAMES, ids and counts — never a value "
        f"(D-08). Captured:\n{captured}"
    )
    assert captured.count(ciphertext) == 0, (
        "T5: the stored CIPHERTEXT reached a log line. A ciphertext in a log is a "
        "credential in a log with an extra step — it outlives the key rotation that was "
        f"supposed to retire it. Captured:\n{captured}"
    )

    # ── the positive control: prove the capture above can actually see a secret ──
    captured_records_before = len(caplog.records)
    logging.getLogger("app.services.connector_service").info(
        "positive control — deliberately logging the sentinel: %s", SENTINEL_SECRET
    )
    control_text = _all_captured_text(caplog)
    assert len(caplog.records) == captured_records_before + 1, (
        "the positive control's own log record was not captured — this capture sees "
        "NOTHING, and every assertion above was vacuous"
    )
    assert control_text.count(SENTINEL_SECRET) >= 1, (
        "POSITIVE CONTROL FAILED: the sentinel was logged deliberately through the same "
        "logger and the same capture, and the sweep did not find it. The two assertions "
        "above therefore prove nothing about the service — they prove the capture is broken."
    )


# ══════════════════════════════════════════════════════════════════════════════════════════
# 6 · T7 — THE RESPONSE MODEL CANNOT CARRY CIPHERTEXT
# ══════════════════════════════════════════════════════════════════════════════════════════
def test_T7_the_response_model_cannot_carry_ciphertext():
    """T7 — the Pydantic model is the gate, not the TypeScript type.

    Two halves, and both are needed: the field is ABSENT (so the projection cannot pick it
    up), and ``extra='forbid'`` REJECTS it (so a hand-built response or a raw row cannot
    smuggle it past the projection either).

    PLANT (observed RED): add ``secret_ciphertext: str | None = None`` to
    ``ConnectorConnectionResponse``. Both halves go RED — and so does the module-scope
    assert in ``connector_service``, which fails the import outright.
    """
    fields = set(ConnectorConnectionResponse.model_fields)
    assert "secret_ciphertext" not in fields, (
        f"T7: the response model grew a `secret_ciphertext` field. Fields: {sorted(fields)}"
    )
    assert "secret" not in fields, (
        f"T7: the response model grew a `secret` field. Fields: {sorted(fields)}"
    )

    with pytest.raises(Exception):
        ConnectorConnectionResponse(
            id=CONNECTION_ID,
            org_id=ORG_A,
            capability="post_message",
            name="Ops — #alerts",
            config={"default_channel": "C0ALERTS"},
            secret_ciphertext="enc:v1:whatever",  # noqa: S106 — the point of the case
        )


# ══════════════════════════════════════════════════════════════════════════════════════════
# 7 · A TRACEBACK IS A LOG LINE NOBODY PLANNED
# ══════════════════════════════════════════════════════════════════════════════════════════
def test_the_repr_of_a_resolved_credential_redacts_the_secret():
    """The redacting ``__repr__`` — because ``dataclass`` would have generated a leaking one.

    An unhandled exception raised anywhere below a resolved credential in the call stack
    prints the locals of every frame under ``--showlocals``, and a plain dataclass repr puts
    the credential in the crash report. Asserting the ciphertext is absent too, not just the
    plaintext: the repr must not become the reason a stored envelope shows up in Sentry.

    PLANT (observed RED): delete the ``__repr__`` override (and ``repr=False``), letting
    ``dataclass`` generate the default. Both assertions go RED.
    """
    resolved = ResolvedConnection(
        connection_id=CONNECTION_ID,
        org_id=ORG_A,
        capability="post_message",
        name="Ops — #alerts",
        config={"default_channel": "C0ALERTS"},
        secret_ciphertext="enc:v1:" + SENTINEL_SECRET,
    )

    for rendering in (repr(resolved), str(resolved), f"{resolved}", "%s" % (resolved,)):
        assert SENTINEL_SECRET not in rendering, (
            f"the credential is printable from a resolved connection: {rendering!r}"
        )
    assert "<redacted>" in repr(resolved), (
        "the repr does not say the secret was withheld — a reader cannot tell the "
        f"difference between redacted and absent: {repr(resolved)!r}"
    )
    # The non-secret facts SURVIVE, so the repr is still useful for debugging. A repr that
    # hides everything gets replaced by a print statement the first time somebody debugs.
    assert CONNECTION_ID in repr(resolved) and "default_channel" in repr(resolved)


# ══════════════════════════════════════════════════════════════════════════════════════════
# 8 · D-14, PERMANENTLY — the id-only regression stays caught even if the SQL drops the scope
# ══════════════════════════════════════════════════════════════════════════════════════════
async def test_an_UNSCOPED_storage_layer_still_cannot_leak_across_orgs():
    """The belt to the resolver's braces, and it guards a real future regression.

    ``test_190_cross_org_credential.py`` stubs a CORRECTLY SCOPED storage layer, so it
    measures whether the resolver hands the run's org down. It cannot measure what happens
    when the SQL itself loses its ``AND org_id = $2`` — which is exactly the edit a future
    author makes while "simplifying" a query, and exactly the defect this phase observed
    leaking a decrypted bot token across two tenants.

    This case supplies the leaking storage layer directly (``WHERE id = $1``, verbatim) and
    asserts the resolver STILL refuses, because it re-checks the returned row's own org.

    PLANT (observed RED): remove the post-fetch ``row["org_id"] != org_id`` check. The
    resolver returns org B's connection to an org A caller and this case goes RED, while
    every other test in both files stays green — which is precisely the blind spot.
    """
    row_owned_by_b = _stored_row("enc:v1:irrelevant", org_id=ORG_B)

    async def unscoped_fetch(connection_id, org_id):
        """`SELECT * FROM connector_connections WHERE id = $1` — the id-only SELECT."""
        return dict(row_owned_by_b) if connection_id == CONNECTION_ID else None

    with pytest.raises(ConnectorNotFound) as excinfo:
        await resolve_connection(
            connection_id=CONNECTION_ID, org_id=ORG_A, fetch_row=unscoped_fetch
        )

    message = str(excinfo.value).lower()
    for oracle in ("forbidden", "not permitted", "403", "belongs to", ORG_B.lower()):
        assert oracle not in message, (
            f"the refusal reads as {oracle!r} rather than as ABSENT — it confirms the id "
            f"names a real row in some other org, which IS the leak: {message!r}"
        )

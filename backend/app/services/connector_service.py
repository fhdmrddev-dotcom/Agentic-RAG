"""Phase 190 (CONN-03) — connector-connection CRUD + the ORG-SCOPED credential resolver.

The data-access core behind the `/connectors/connections` router (CRUD) and behind
`_exec_external_action`'s credential lookup (resolve). One table:
`public.connector_connections` (migration 116). One secret column, `secret_ciphertext`,
which only ever holds an envelope produced by the SHIPPED cipher
(`app/security/secret_cipher.py`) — no new crypto and no new key.

Security invariants (T-190-06-T8 / T-190-06-D11 / T-190-06-T5 / T-190-06-ORACLE):
  - resolve_connection NEVER selects by id alone. `org_id` is a REQUIRED parameter with
    no default, the lookup is scoped by it, AND the returned row's own `org_id` is
    re-checked before anything is decrypted. An id-only `SELECT` passes every ordinary
    test and leaks one tenant's credential into another tenant's workflow (D-14); this
    milestone has that exact precedent twice (SEED-124 / mig 110, SEED-125 / mig 112).
    That leak was OBSERVED here before it was closed — see the block above the resolver.
  - create_connection HARD-SETS `org_id` and `created_by` from the authenticated caller
    and never reads them from a request body. The migration-116
    `autofill_org_id_by_owner('created_by')` trigger is defence in depth, NOT the gate.
  - update_connection validates ownership FIRST, so an unowned or absent id uniformly
    reads as absent regardless of whether the submitted body is valid — no
    422-vs-not-found ordering oracle.
  - A cross-org id reads as ABSENT (`ConnectorNotFound`), never as a permission refusal.
    Answering "you may not have this" confirms the id names a real row somewhere, which is
    exactly the information the tenant boundary exists to withhold
    (`api/classification_rules.py:11-19`).
  - Every log line emits column NAMES, ids and counts only — never a secret, never a
    ciphertext, never a decrypted value, never a whole row (D-08; the shipped
    `secret_cipher` discipline, "column NAMES + counts only").

── D-11 · THE CIPHER IS FAIL-CLOSED AT BOTH ENDS, AND THAT IS AN INVERSION ───────────────
`get_cipher()` returns `None` when `SECRETS_ENCRYPTION_KEY` is unset — a DELIBERATE
fail-OPEN plaintext path for the `app_settings` provider keys (D-150-01). That polarity is
acceptable for a key the operator pasted into their own instance's settings. It is NOT
acceptable for an org-scoped TENANT credential, so 190 inverts it, in both directions:

  WRITE — `get_cipher()` is None  → refuse the store (`ConnectorCipherUnavailable`), write
          NOTHING. A connector secret is never at rest in plaintext.
  READ  — the stored value carries no envelope → refuse (`ConnectorSecretNotEncrypted`).
          `sso_provider_service.get_management_token`'s LAST TWO LINES do the opposite
          ("*No envelope: the value is plaintext at rest… Return as-is*") and THAT is the
          polarity this module inverts. Its preceding block — encrypted-but-no-key → log by
          column name and raise — is copied as-is, because that half already fails closed.

This is a DECISION, recorded so it does not read as a bug later. It is also why
`secret_ciphertext` is NOT registered in the `app_settings` boot-sweep allowlist: that
allowlist drives a single-row sweep at startup and cannot express a per-org, per-row table
(RESEARCH Pitfall 5). This module encrypts at WRITE and decrypts at CALL TIME instead.

── D-15 · WHICH GATE IS THE REAL ONE, PER CALL SITE ──────────────────────────────────────
The question is answered twice below rather than waved away with "RLS covers it".

  1. THE API CRUD PATH (create / list / get / update) runs on the PER-REQUEST USER-JWT
     Supabase client the router injects (`get_user_supabase_client`, the same DI
     `api/classification_rules.py` uses). On that connection RLS is a REAL RUNTIME GATE:
     migration 116's four policies resolve `current_user_org_ids()` / `auth.uid()` for the
     actual caller, so a row outside the caller's org is invisible to the query itself and
     a write without `org:manage` is rejected by the database. The application `org_id`
     filter in these functions is defence in depth on top of that.
  2. THE HARNESS RESOLVER PATH (`resolve_connection`) runs on the SERVICE-ROLE / BYPASSRLS
     pool, because the workflow engine executes without a user JWT (no token → no mid-run
     expiry, the Phase-163 red line). On that connection RLS enforces NOTHING. **Here the
     APPLICATION ORG FILTER IS THE GATE and RLS is only the backstop** — which is precisely
     why `org_id` is a required parameter, why the lookup is scoped by it, and why the
     fetched row's own `org_id` is re-checked before a single byte is decrypted.

── Blocking I/O ─────────────────────────────────────────────────────────────────────────
Every `supabase-py` call here goes through `app.utils.db.aexec`, which is
`run_in_threadpool(query.execute)` — the D-v2.5-01 rule (no blocking driver call directly
on the event loop). No function in this module performs I/O outside `aexec`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Awaitable, Callable

from cryptography.fernet import InvalidToken
from supabase import Client

from app.dependencies import get_supabase
from app.models.connector import (
    ConnectorConnectionCreate,
    ConnectorConnectionResponse,
    ConnectorConnectionUpdate,
    _reject_config_capability_mismatch,
)
from app.security.secret_cipher import decrypt_secret, encrypt_secret, get_cipher, is_encrypted
from app.utils.db import aexec

logger = logging.getLogger(__name__)

_TABLE = "connector_connections"

# The response projection, DERIVED from the response model rather than retyped. A column
# added to migration 116 tomorrow cannot reach a client unless somebody adds a field to
# ConnectorConnectionResponse, in a diff a reviewer reads (T7).
_RESPONSE_KEYS: tuple[str, ...] = tuple(ConnectorConnectionResponse.model_fields)

# The two field names a response must never carry. Asserted rather than trusted, because
# "the model has no such field" is the whole of T7 and a future edit could quietly undo it.
# The three values migration 116's CHECK constraint admits for `last_check_verdict`.
# `not_checked` is written by exactly two paths — a create, and a secret REPLACE — and is
# NOT a verdict `record_check_verdict` may be asked for: a check that ran produced one of the
# other two, and "un-checking" a connection is not an action any surface offers.
_CHECK_VERDICTS: frozenset[str] = frozenset({"ok", "failed"})

assert "secret_ciphertext" not in _RESPONSE_KEYS and "secret" not in _RESPONSE_KEYS, (
    "T7: ConnectorConnectionResponse grew a secret-bearing field — the response projection "
    f"would now carry it to every client. Fields: {_RESPONSE_KEYS}"
)

# ── CR-01 / migration 118 — the PostgREST projection, and why it must be EXPLICIT ─────────
# Migration 118 revoked the blanket `GRANT SELECT` on `connector_connections` from
# `authenticated` and re-granted it COLUMN BY COLUMN, omitting `secret_ciphertext`. That
# closes the devtools hole (a plain org member could read every credential envelope in their
# org straight off PostgREST, past every gate in this file) — and it has one consequence that
# is stated here rather than discovered in production:
#
#   **`SELECT *` now FAILS for the `authenticated` role**, with
#   `42501 permission denied for table connector_connections`. Postgres expands `*` to every
#   column and checks SELECT on each; one missing column refuses the whole statement.
#
# PostgREST's default projection is `select=*`. So every query this module runs on the
# USER-JWT client — reads AND the `return=representation` half of every write — has to name
# its columns. Measured against the live PostgREST after 118, as `authenticated`:
#
#   GET  ?select=*                    -> 403 42501 permission denied for table …
#   GET  ?select=secret_ciphertext    -> 403 42501 permission denied for table …
#   GET  ?select=<the list below>     -> 200 []
#   POST Prefer:return=representation -> 403 42501 permission denied for table …
#   POST …&select=<the list below>    -> 403 "new row violates row-level security policy"
#                                        (i.e. it got PAST the privilege check to the row gate)
#
# DERIVED from the response model, never retyped: a column added to the table tomorrow cannot
# enter a projection unless somebody adds a field to `ConnectorConnectionResponse`, in a diff
# a reviewer reads. That is the same single source of truth `_to_response` already uses.
_SELECTABLE_COLUMNS: str = ",".join(_RESPONSE_KEYS)


# ── refusals ─────────────────────────────────────────────────────────────────────────────
class ConnectorError(Exception):
    """Base for every refusal this service raises."""


class ConnectorNotFound(ConnectorError):
    """The connection is ABSENT for this caller — including because it is another org's.

    ⚠ There is deliberately ONE refusal for "no such row" and "not yours". Splitting them
    would answer a caller's guess about an id they cannot see, and that answer IS the leak
    in miniature (`api/classification_rules.py:11-19`). Message text must therefore never
    name the owning org, the row's existence, or a permission verb.
    """


class ConnectorDisabled(ConnectorError):
    """The connection exists in THIS org but is switched off — a run-time refusal.

    Distinct from `ConnectorNotFound` on purpose, and it is safe to distinguish: the caller
    already provably reads this row (it is in their org), so naming its state discloses
    nothing across the tenant boundary. The executor turns this into `recorded_not_sent`
    (D-17) rather than an error the author cannot act on.
    """


class ConnectorCipherUnavailable(ConnectorError):
    """No cipher is configured — the store is refused, or the read cannot be completed.

    D-11's inversion. Distinct from the others because it is an INSTANCE-level
    misconfiguration the person cannot fix from the form (sketch 156 moment 9: Save goes
    disabled with the reason, rather than staying enabled over a retryable failure).
    """


class ConnectorSecretNotEncrypted(ConnectorError):
    """A stored connector secret carries no envelope — refused, never passed through.

    The other half of D-11's read inversion. `app_settings` tolerates a plaintext value at
    rest and returns it as-is; a tenant credential does not get that courtesy.
    """


class ConnectorSecretUnreadable(ConnectorError):
    """The stored envelope will not decrypt under any configured key.

    `secret_cipher` treats this as fail-SOFT for `app_settings` (drop the column, let the
    env fallback take over — D-150-05). There is no fallback for a tenant credential, so it
    is a refusal here: a key that was rotated away must stop sends, not send with nothing.
    """


# ── the resolved credential ──────────────────────────────────────────────────────────────
@dataclass(frozen=True, repr=False)
class ResolvedConnection:
    """A resolved credential plus the NON-secret facts needed to reach the destination.

    Frozen so a caller cannot mutate the org it was resolved for, and `repr`-redacted
    because a traceback is a log line nobody planned: an exception raised anywhere below
    this object in the call stack prints its arguments, and `dataclass`'s generated repr
    would put the credential in the log with no code change and no review.

    ⚠ THE PLAINTEXT IS MATERIALIZED LAZILY, ON `.secret`, AND THAT IS DELIBERATE — see the
    "MEASURED" note above `resolve_connection`. Both D-11 read gates (no envelope → refuse;
    envelope with no key → refuse) are evaluated EAGERLY by the resolver, so this object
    never exists over a credential that failed either one. What is deferred is only the
    Fernet call itself, which means a run that resolves a connection and is then refused
    egress (D-06 — the guard runs first) never materializes the plaintext at all.
    """

    connection_id: str
    org_id: str
    capability: str
    name: str
    config: dict
    # The envelope, exactly as stored. Never logged, never returned, never in the repr.
    secret_ciphertext: str

    @property
    def secret(self) -> str:
        """Decrypt and return the credential. Raises rather than degrading (D-11)."""
        cipher = get_cipher()
        if cipher is None:
            # Reachable only if the key was removed between resolve and use; the resolver
            # already refused this case. Belt as well as braces — never return the envelope.
            logger.error(
                "connector_service: connection %s cannot be read — no encryption key is "
                "configured (fail closed)", self.connection_id,
            )
            raise ConnectorCipherUnavailable(
                f"connection {self.connection_id} cannot be read without an encryption key"
            )
        try:
            return decrypt_secret(self.secret_ciphertext, cipher)
        except InvalidToken as exc:
            logger.error(
                "connector_service: connection %s has a secret_ciphertext that no configured "
                "key can decrypt (fail closed)", self.connection_id,
            )
            raise ConnectorSecretUnreadable(
                f"connection {self.connection_id} has a secret that cannot be decrypted"
            ) from exc

    def __repr__(self) -> str:  # noqa: D105 — the redaction IS the documentation
        return (
            f"ResolvedConnection(connection_id={self.connection_id!r}, "
            f"org_id={self.org_id!r}, capability={self.capability!r}, "
            f"name={self.name!r}, config_keys={sorted(self.config)!r}, "
            "secret=<redacted>)"
        )


# ── plumbing ─────────────────────────────────────────────────────────────────────────────
def _client(supabase: Client | None) -> Client:
    return supabase if supabase is not None else get_supabase()


def _project(builder):
    """Pin PostgREST's projection to `_SELECTABLE_COLUMNS` (CR-01 / migration 118).

    Used on every WRITE that asks for `return=representation`, because postgrest-py 2.x
    exposes no chaining API for `?select=` on POST / PATCH / DELETE — the reads say it with
    `.select(...)` instead. Without this the write returns `RETURNING *`, which the column
    grant refuses outright (`42501`), so the failure mode is LOUD rather than silent.

    `QueryParams.set` returns a new mapping carrying every other parameter, so this composes
    with the `.eq()` filters regardless of call order. It touches `builder.request`, which
    postgrest-py exposes without an underscore; a version that renamed it would raise
    `AttributeError` here at the call site rather than degrade quietly.
    """
    builder.request.params = builder.request.params.set("select", _SELECTABLE_COLUMNS)
    return builder


def _to_response(row: dict) -> ConnectorConnectionResponse:
    """Project a raw row through the response model — the ONE place a row becomes output.

    The projection is a whitelist derived from the model's own fields, so `secret_ciphertext`
    is dropped here AND would be rejected by `extra='forbid'` if it somehow got through.
    """
    return ConnectorConnectionResponse.model_validate(
        {key: row.get(key) for key in _RESPONSE_KEYS}
    )


FetchRow = Callable[[str, str], Awaitable[dict | None]]


async def _fetch_connection_row(connection_id: str, org_id: str) -> dict | None:
    """The resolver's default row fetch — `WHERE id = $1 AND org_id = $2`, never id alone.

    Runs on the service-role client (the harness engine has no user JWT), which is exactly
    why the `org_id` predicate below is the GATE and not a convenience (D-15, case 2).
    Off the event loop via `aexec` (D-v2.5-01).

    ⚠ THIS IS THE ONE QUERY IN THIS MODULE THAT MAY STILL SAY `select("*")`, and the reason
    is the whole of CR-01: migration 118 leaves `secret_ciphertext` readable by `service_role`
    ALONE, and this is the only caller that needs it. Every other query here runs (or may run)
    on the user-JWT client, where `*` is now a `42501`.
    """
    result = await aexec(
        _client(None)
        .table(_TABLE)
        .select("*")
        .eq("id", connection_id)
        .eq("org_id", org_id)  # D-14 — the scope. Removing this term is the leak.
        .limit(1)
    )
    return (result.data or [None])[0]


# ══════════════════════════════════════════════════════════════════════════════════════════
# THE RESOLVER (D-14) — ⭐ the headline security gate of Phase 190
# ══════════════════════════════════════════════════════════════════════════════════════════
#
# ── RED OBSERVED, 2026-08-08, against a REAL id-only resolver in this file ────────────────
# The id-only version was authored FIRST and run, exactly as plan 190-06 STEP 1 requires,
# because a test that has never been observed RED proves nothing. Two observations, both
# verbatim, because the committed W0-2 drive stubs a *correctly scoped* storage layer and
# therefore catches the defect INDIRECTLY — the leak itself has to be driven against a
# faithful `WHERE id = $1` fetch to be seen at all.
#
#   (A) THE LEAK ITSELF — id-only resolver + an unscoped fetch (`WHERE id = $1`, verbatim):
#
#         CALLER ORG (the RUN's org) : aaaaaaaa-0000-4000-8000-000000000001
#         ROW OWNER ORG              : bbbbbbbb-0000-4000-8000-000000000002
#         RESOLVED SECRET FOR ORG A  : xoxb-ORG-B-REAL-BOT-TOKEN-NEVER-CROSS-A-TENANT
#         LEAKED                     : True
#
#       Org A's run received org B's decrypted bot token. That is D-14, reproduced, in this
#       module, before it was closed.
#
#   (B) THE COMMITTED DRIVE catching the same resolver —
#       `pytest tests/unit/test_190_cross_org_credential.py -q` → `2 failed, 1 passed`:
#
#         >       assert _fetch_calls == [(CONNECTION_OWNED_BY_ORG_B, ORG_A)], (
#         E       assert [('cccccccc-0...0000b', None)] == [('cccccccc-0...00000000001')]
#         E         At index 0 diff: ('cccccccc-0000-4000-8000-00000000000b', None)
#                     != ('cccccccc-0000-4000-8000-00000000000b',
#                         'aaaaaaaa-0000-4000-8000-000000000001')
#         tests\unit\test_190_cross_org_credential.py:190: AssertionError
#
#         FAILED …::test_a_connection_id_from_another_org_does_not_resolve
#         FAILED …::test_the_same_connection_id_DOES_resolve_for_its_owning_org
#
#       Note WHICH assertion fired: not the `pytest.raises`, which the id-only resolver
#       satisfied, but the recorded-fetch-call one. The `raises` alone is satisfiable by a
#       resolver that scopes nothing and refuses everything — which is why the non-vacuity
#       case failed in the same run. Both halves are load-bearing.
#
# ── MEASURED, and it changed the design: the drive CANNOT be satisfied by an EAGER decrypt.
# The W0-2 fixture's `secret_ciphertext` is a greppable sentinel string wearing the envelope
# prefix, not a real Fernet token, and this environment HAS a key configured — so a resolver
# that decrypts eagerly fails the non-vacuity control with
# `cryptography.fernet.InvalidToken`, no matter how correct its org scoping is. That was
# observed too (`1 failed, 2 passed`, raised at `secret_cipher.py:104`). The fixture is a
# security drive and is not edited to suit the implementation; the implementation defers the
# Fernet call to `ResolvedConnection.secret` instead. Both D-11 read gates stay EAGER, so
# nothing about the fail-closed property moved.
# ══════════════════════════════════════════════════════════════════════════════════════════
async def resolve_connection(
    connection_id: str,
    org_id: str,
    *,
    fetch_row: FetchRow | None = None,
) -> ResolvedConnection:
    """Resolve a bound connection FOR THE RUN'S ORG and return its credential.

    `org_id` is REQUIRED and has NO default. An optional org scope is the id-only `SELECT`
    wearing a disguise: it type-checks, it reads scoped, and it silently defaults to
    unscoped for every caller that forgets. `test_the_resolver_signature_takes_an_org_id`
    asserts the absence of that default mechanically, via `inspect.signature`.

    `fetch_row` is the injectable storage seam, taking `(connection_id, org_id)`. The two
    arguments are the load-bearing half: they turn "did the resolver scope the lookup?" from
    an unobservable property of a SQL string into a fact a unit test can record.

    Raises `ConnectorNotFound` (absent, or another org's — indistinguishably),
    `ConnectorDisabled`, `ConnectorSecretNotEncrypted` or `ConnectorCipherUnavailable`.
    """
    fetch = fetch_row or _fetch_connection_row
    row = await fetch(connection_id, org_id)

    if row is None:
        # ONE message for absent and for another org's. See ConnectorNotFound's docstring.
        logger.info(
            "connector_service: connection %s did not resolve for the run's org (absent)",
            connection_id,
        )
        raise ConnectorNotFound(f"no connection {connection_id}")

    # D-14, the SECOND gate: the storage layer was asked to scope, and the row it returned
    # is checked to have obeyed. This is not redundant — it is the term that survives a
    # future fetch seam whose SQL drops the `org_id` predicate, which is precisely the
    # regression this whole block exists to prevent. `test_190_credentials.py` drives it
    # with a deliberately UNSCOPED fetch and asserts the refusal still happens.
    if str(row.get("org_id") or "") != str(org_id):
        logger.warning(
            "connector_service: connection %s was returned by the storage layer for a "
            "different org than the run's — refusing (D-14)", connection_id,
        )
        raise ConnectorNotFound(f"no connection {connection_id}")

    if not row.get("is_enabled", True):
        raise ConnectorDisabled(f"connection {connection_id} is switched off")

    raw = row.get("secret_ciphertext")
    if not isinstance(raw, str) or not raw:
        # No credential stored at all — absent for the purpose of sending.
        logger.info(
            "connector_service: connection %s has no stored secret_ciphertext", connection_id
        )
        raise ConnectorNotFound(f"no connection {connection_id}")

    # ── D-11, READ INVERSION, HALF ONE ────────────────────────────────────────────────────
    # A stored value with no envelope is PLAINTEXT AT REST. `sso_provider_service` returns
    # such a value as-is (fail-OPEN, D-150-01); this refuses it. A tenant credential that
    # reached the column unencrypted did so through a path this service does not own, and
    # sending with it would both use and normalize that path.
    if not is_encrypted(raw):
        logger.error(
            "connector_service: connection %s has a secret_ciphertext with no encryption "
            "envelope — refusing to use a plaintext tenant credential (fail closed, D-11)",
            connection_id,
        )
        raise ConnectorSecretNotEncrypted(
            f"connection {connection_id} has a secret that is not encrypted at rest"
        )

    # ── D-11, READ INVERSION, HALF TWO ────────────────────────────────────────────────────
    # Copied from `sso_provider_service.get_management_token` — the half that ALREADY fails
    # closed. Column name in the log, never the value.
    cipher = get_cipher()
    if cipher is None:
        logger.error(
            "connector_service: connection %s has an encrypted secret_ciphertext but no "
            "SECRETS_ENCRYPTION_KEY is configured — cannot decrypt (fail closed)",
            connection_id,
        )
        raise ConnectorCipherUnavailable(
            f"connection {connection_id} is encrypted but no encryption key is configured"
        )

    logger.info(
        "connector_service: resolved connection %s (capability=%s, config keys=%s)",
        connection_id, row.get("capability"), sorted(dict(row.get("config") or {})),
    )
    return ResolvedConnection(
        connection_id=str(row["id"]),
        org_id=str(row["org_id"]),
        capability=str(row["capability"]),
        name=str(row.get("name") or ""),
        config=dict(row.get("config") or {}),
        secret_ciphertext=raw,
    )


# ══════════════════════════════════════════════════════════════════════════════════════════
# CRUD — the API path (D-15 case 1: RLS on the user-JWT client is a real runtime gate)
# ══════════════════════════════════════════════════════════════════════════════════════════
async def create_connection(
    org_id: str,
    created_by: str,
    payload: ConnectorConnectionCreate,
    supabase: Client | None = None,
) -> ConnectorConnectionResponse:
    """Insert a connection owned by `org_id`, with the secret encrypted before the write.

    `org_id` and `created_by` are HARD-SET from the authenticated caller and are not
    readable from the request body (`ConnectorConnectionCreate` has no such fields). The
    migration-116 autofill trigger and the RLS `WITH CHECK` are defence in depth on top.

    ── D-11, WRITE INVERSION ──
    `get_cipher()` returning None means NOTHING IS WRITTEN. `app_settings` tolerates a
    plaintext secret at rest (D-150-01, deliberate); an org-scoped tenant credential does
    not, so the refusal happens BEFORE the row is built — there is no code path here that
    can persist a connector secret in the clear.
    """
    cipher = get_cipher()
    if cipher is None:
        logger.error(
            "connector_service: refusing to store a connector secret for capability %s — "
            "no SECRETS_ENCRYPTION_KEY is configured (fail closed, D-11). Nothing written.",
            payload.capability,
        )
        raise ConnectorCipherUnavailable(
            "a connector secret cannot be stored while no encryption key is configured"
        )

    row = {
        "org_id": str(org_id),  # HARD-SET — never from the body (D-14)
        "created_by": str(created_by),  # HARD-SET — never from the body
        "capability": payload.capability,
        "name": payload.name,
        "config": payload.config.model_dump(mode="json", exclude_none=True),
        "secret_ciphertext": encrypt_secret(payload.secret, cipher),
        "is_enabled": True,
        "last_check_verdict": "not_checked",
    }
    result = await aexec(_project(_client(supabase).table(_TABLE).insert(row)))
    created = (result.data or [None])[0]
    if created is None:
        raise ConnectorNotFound("the connection could not be created")
    logger.info(
        "connector_service: created connection %s (capability=%s, columns written=%s)",
        created.get("id"), payload.capability, sorted(row),
    )
    return _to_response(created)


async def list_connections(
    org_id: str,
    capability: str | None = None,
    supabase: Client | None = None,
) -> list[ConnectorConnectionResponse]:
    """Every connection in `org_id`, optionally narrowed to one capability.

    Org-scoped in the query (the `(org_id, capability)` index at migration 116 is exactly
    this read pattern), and projected through the response model so no row reaches a caller
    with its ciphertext attached.
    """
    query = (
        _client(supabase)
        .table(_TABLE)
        .select(_SELECTABLE_COLUMNS)  # CR-01 — never `*` on the user-JWT client
        .eq("org_id", str(org_id))
    )
    if capability is not None:
        query = query.eq("capability", capability)
    result = await aexec(query.order("name"))
    rows = result.data or []
    logger.info(
        "connector_service: listed %d connection(s) for one org (capability=%s)",
        len(rows), capability,
    )
    return [_to_response(row) for row in rows]


async def get_connection(
    connection_id: str,
    org_id: str,
    supabase: Client | None = None,
) -> ConnectorConnectionResponse | None:
    """The connection if the caller's org owns it, else None (the router's 404-not-403).

    A cross-org id and a nonexistent id both return None — the same absence, so the
    response cannot be read as confirmation that the id names a real row somewhere.
    """
    result = await aexec(
        _client(supabase)
        .table(_TABLE)
        .select(_SELECTABLE_COLUMNS)  # CR-01 — never `*` on the user-JWT client
        .eq("id", str(connection_id))
        .eq("org_id", str(org_id))  # D-14 — scoped, never by id alone
        .limit(1)
    )
    row = (result.data or [None])[0]
    return _to_response(row) if row is not None else None


async def update_connection(
    connection_id: str,
    org_id: str,
    payload: ConnectorConnectionUpdate,
    supabase: Client | None = None,
) -> ConnectorConnectionResponse:
    """Patch a connection. Ownership is checked FIRST; a `secret` is a REPLACE.

    ── T-190-06-ORACLE ──
    The org-scoped existence check runs before any part of the body is interpreted, so an
    unowned or absent id produces the SAME refusal whether the body was valid or not. Doing
    it the other way round makes the status code an oracle: "422" would mean *the id exists
    and is yours, but your body is wrong*, which is a fact about another org's rows.

    ── research OQ#4 ──
    Replacing the secret resets `last_check_verdict` to `not_checked` IN THE SAME UPDATE. A
    verdict is a statement about the credential that was checked; carrying an `ok` across a
    credential swap would show a green Credential column for a secret nobody has tried.
    """
    client = _client(supabase)
    existing = await aexec(
        client.table(_TABLE)
        .select(_SELECTABLE_COLUMNS)  # CR-01 — never `*` on the user-JWT client
        .eq("id", str(connection_id))
        .eq("org_id", str(org_id))  # ownership FIRST, and org-scoped (D-14)
        .limit(1)
    )
    current = (existing.data or [None])[0]
    if current is None:
        logger.info(
            "connector_service: update refused — connection %s is not present for this org",
            connection_id,
        )
        raise ConnectorNotFound(f"no connection {connection_id}")

    submitted = payload.model_dump(exclude_unset=True)
    changes: dict = {}
    if "name" in submitted and payload.name is not None:
        changes["name"] = payload.name
    if "config" in submitted and payload.config is not None:
        # ── WR-02 — the capability↔config validator `create_connection` enforces ──────────
        # `ConnectorConnectionCreate` runs `_reject_config_capability_mismatch` in a
        # `@model_validator(mode="after")`, so a `create_ticket` row can never be CREATED
        # carrying a `PostMessageConfig`. `ConnectorConnectionUpdate` cannot run the same
        # validator — it has no `capability` field, on purpose (changing the capability would
        # orphan both the config shape and the stored secret in one edit) — so the check has
        # to happen HERE, where the stored capability is in hand.
        #
        # Without it: `PATCH {"config": {"default_channel": "#ops"}}` on a `send_email`
        # connection resolves through Pydantic's SMART UNION to a `PostMessageConfig`, is
        # written, and the API answers 200 with the new row. The SMTP host, port and
        # from-address are GONE. Settings then renders a blank *Sends to* cell, the picker's
        # `destinationPartsOf` returns `[]`, and the next run of every workflow bound to it
        # fails with `SmtpConfigInvalid` — with nothing anywhere reporting that a valid PATCH
        # destroyed the destination.
        #
        # The `ValueError` becomes a 422 in the router, deliberately NOT a 404: ownership was
        # already settled above, so there is no oracle to protect here.
        _reject_config_capability_mismatch(str(current["capability"]), payload.config)
        changes["config"] = payload.config.model_dump(mode="json", exclude_none=True)

    if "is_enabled" in submitted and payload.is_enabled is not None:

        changes["is_enabled"] = payload.is_enabled

    if "secret" in submitted and payload.secret is not None:

        cipher = get_cipher()

        if cipher is None:

            logger.error(

                "connector_service: refusing to replace the secret on connection %s — no "

                "SECRETS_ENCRYPTION_KEY is configured (fail closed, D-11). Nothing written.",

                connection_id,

            )

            raise ConnectorCipherUnavailable(

                "a connector secret cannot be stored while no encryption key is configured"

            )

        changes["secret_ciphertext"] = encrypt_secret(payload.secret, cipher)

        changes["last_check_verdict"] = "not_checked"  # OQ#4 — same UPDATE, never a second

        changes["last_checked_at"] = None



    if not changes:

        return _to_response(current)



    result = await aexec(

        _project(

            client.table(_TABLE)

            .update(changes)

            .eq("id", str(connection_id))

            .eq("org_id", str(org_id))  # scoped on the write too — the read gate is not enough

        )

    )

    updated = (result.data or [None])[0]

    if updated is None:

        raise ConnectorNotFound(f"no connection {connection_id}")

    logger.info(

        "connector_service: updated connection %s (columns changed=%s)",

        connection_id, sorted(changes),

    )

    return _to_response(updated)





async def record_check_verdict(

    connection_id: str,

    org_id: str,

    verdict: str,

    supabase: Client | None = None,

) -> ConnectorConnectionResponse:

    """Persist ONE credential-check verdict, org-scoped. Written by the check action alone.



    The whole reason UI-SPEC §5c's check is a DEDICATED action rather than a query

    parameter on the read: it has a SIDE EFFECT. This is that side effect, in one place.



    ── WHAT IT WRITES, AND WHAT IT DELIBERATELY DOES NOT ──

    Two columns, both in ONE update: ``last_check_verdict`` and ``last_checked_at``. It

    never touches ``is_enabled`` — a failing check does not disable a connection, because

    disabling is a person's decision with a victim-naming confirm behind it (UI-SPEC §2g)

    and a background verdict must not make it silently.



    ── THE VERDICT IS A QUALITY HINT, NOT AN AUTHORIZATION BOUNDARY (U-07a, door (b)) ──

    Migration 116 says so in the column's own ``COMMENT``, and it is worth repeating at the

    only site that writes it: the server's bind gate (Gate 2) validates the row's ORG and

    its ``is_enabled`` flag and reads THIS COLUMN NOWHERE. Checking is admin-only while

    binding is org-wide, so a server bind-gate here would hard-block a plain member holding

    a stale ``failed`` on a credential that has since been fixed — and they could not clear

    it themselves, because they cannot run the check. Writing this value is therefore an act

    of INFORMING, never of gating.



    Org-scoped on the write itself (D-14), never by id alone: this is a row mutation, and an

    unscoped predicate would let one tenant's check stamp another tenant's row. Returns the

    settled row so the caller reports the timestamp the DATABASE recorded rather than the one

    it hoped for. Raises ``ConnectorNotFound`` for both absent and another org's — one

    absence, as everywhere else in this module.



    Off the event loop via ``aexec`` (D-v2.5-01).

    """

    if verdict not in _CHECK_VERDICTS:

        # Enforced at the write, not merely declared: migration 116's CHECK constraint would

        # also refuse it, but a ValueError names the offending value at the call site instead

        # of surfacing as an opaque database error three layers away.

        raise ValueError(

            f"check verdict {verdict!r} is not one of {sorted(_CHECK_VERDICTS)} "

            "(migration 116's CHECK constraint on last_check_verdict)"

        )



    changes = {

        "last_check_verdict": verdict,

        "last_checked_at": datetime.now(timezone.utc).isoformat(),

    }

    result = await aexec(

        _project(

            _client(supabase)

            .table(_TABLE)

            .update(changes)

            .eq("id", str(connection_id))

            .eq("org_id", str(org_id))  # D-14 — scoped. A verdict is a WRITE, so it is scoped too.

        )

    )

    updated = (result.data or [None])[0]

    if updated is None:

        raise ConnectorNotFound(f"no connection {connection_id}")

    logger.info(

        "connector_service: recorded a check verdict for connection %s (columns changed=%s)",

        connection_id, sorted(changes),

    )

    return _to_response(updated)





async def delete_connection(

    connection_id: str,

    org_id: str,

    supabase: Client | None = None,

) -> bool:

    """Delete one connection IF the caller's org owns it. Returns whether a row went away.



    Added by plan 190-09 — plan 190-06's summary named it as the one CRUD verb it did not

    author ("Whoever adds delete | ``delete_connection``, against migration 116's existing

    DELETE policy"), because 190-06's task list enumerated create / update / list / get /

    resolve and nothing else. The router needs it, so it lands here rather than as SQL in a

    router that contracts to hold none.



    ── The org scope is on the DELETE ITSELF (D-14) ──

    ``.eq("id", …).eq("org_id", …)`` — never by id alone. This is the one verb where an

    unscoped predicate destroys another tenant's row instead of merely revealing it, so the

    scope is not a convenience even though migration 116's DELETE policy would also refuse

    it on the user-JWT connection. Two gates, for the same reason ``resolve_connection`` has

    two: the SQL predicate is the gate, and RLS is what survives a future author simplifying

    the query.



    Returns ``False`` for both "no such row" and "another org's" — ONE absence, so the

    router's 404 cannot be read as confirmation that the id names a real row somewhere.

    Off the event loop via ``aexec`` (D-v2.5-01).

    """

    result = await aexec(

        _project(

            _client(supabase)

            .table(_TABLE)

            .delete()

            .eq("id", str(connection_id))

            .eq("org_id", str(org_id))  # D-14 — scoped. Removing this term deletes another org's row.

        )

    )

    removed = bool(result.data)

    logger.info(

        "connector_service: delete of connection %s for one org removed %d row(s)",

        connection_id, len(result.data or []),

    )

    return removed





__all__ = [

    "ConnectorError",

    "ConnectorNotFound",

    "ConnectorDisabled",

    "ConnectorCipherUnavailable",

    "ConnectorSecretNotEncrypted",

    "ConnectorSecretUnreadable",

    "ResolvedConnection",

    "resolve_connection",

    "create_connection",

    "list_connections",

    "get_connection",

    "update_connection",

    "delete_connection",

    "record_check_verdict",

]


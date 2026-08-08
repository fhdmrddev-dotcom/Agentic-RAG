"""Phase 190 (CONN-03) — **W0-2: THE CROSS-ORG CREDENTIAL-LEAK DRIVE (D-14).**

⭐ **This is the headline security gate of Phase 190, and the defect it hunts is NAMED IN
ADVANCE.** A workflow definition belonging to **org A** carries a ``connection_id`` whose
``connector_connections`` row belongs to **org B**. The resolver must scope the lookup by the
RUN's org — never by the id alone.

An ``id``-only ``SELECT … WHERE id = $1`` passes every ordinary test in the suite and leaks one
tenant's credential to another tenant's workflow. This milestone has the exact precedent
**twice**: SEED-124 (migration 110) and SEED-125 (migration 112). Both were found after the
fact. This drive exists so 190's version is found before.

── WHY THIS FILE IS AUTHORED BEFORE THE RESOLVER EXISTS ──────────────────────────────────
CONTEXT ``<specifics>`` is explicit: *"Both are latent defects that this phase's own commit
creates… Plan them into Wave 0, RED, before any adapter exists."* **A test that has never been
observed RED proves nothing.** So this file is written first, run first, and its failure text is
recorded below verbatim — not as a claim that it *would* fail.

── THE CONTRACT THIS DRIVE IMPOSES ON ``app.services.connector_service`` ─────────────────
The module does not exist yet. This drive is therefore the place its shape is fixed, and it
fixes exactly four things — no more, so a later plan keeps its freedom everywhere else:

  1. ``ConnectorNotFound`` — the refusal type. A cross-org id must read as **absent**, never as
     **forbidden** (``api/classification_rules.py:11-19``: *"every cross-user/unseeable miss
     collapses to a generic 404, NEVER the forbidden status — no existence leak"*). Answering
     403 for org B's id tells org A that the id is real, which is the leak in miniature.
  2. ``async def resolve_connection(...)`` — ``async``, because every sibling data-access
     service in this tree is (``classification_rule_service:57-144``,
     ``sso_provider_service.get_management_token:62``) and because the one production caller is
     the async ``_exec_external_action`` executor.
  3. ``org_id`` is a **REQUIRED** parameter. An optional ``org_id`` is the id-only ``SELECT``
     wearing a disguise: it type-checks, it reads scoped, and it defaults to unscoped for every
     caller that forgets. Asserted mechanically below via ``inspect.signature``.
  4. A row-fetch seam that is **injectable**, taking ``(connection_id, org_id)`` — the same
     dependency-by-argument shape ``classification_rule_service`` uses for ``supabase``. The
     TWO-ARGUMENT fetch is the load-bearing half: a resolver that ignores the run's org is then
     **structurally visible in the drive** (it either passes ``None`` down, which the stub
     records, or it calls with one argument, which is a ``TypeError``) rather than invisible
     behind a SQL string this unit test cannot see.

── NON-VACUITY ───────────────────────────────────────────────────────────────────────────
``test_the_same_connection_id_DOES_resolve_for_its_owning_org`` is not decoration. Without it a
resolver that refuses **everything** passes the leak test forever, and the suite would report a
green security gate over a connector feature that can never send anything at all.

── RED OBSERVED (Wave 0, plan 190-01) ────────────────────────────────────────────────────
**Observed 2026-08-08**, verbatim, exit code **2**:
``cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_190_cross_org_credential.py -q``

    =================================== ERRORS ====================================
    ________ ERROR collecting tests/unit/test_190_cross_org_credential.py _________
    ImportError while importing test module 'C:\\Vibe Apps\\Agentic RAG\\backend\\tests\\unit\\test_190_cross_org_credential.py'.
    Hint: make sure your test modules/packages have valid Python names.
    Traceback:
    C:\\Python312\\Lib\\importlib\\__init__.py:90: in import_module
        return _bootstrap._gcd_import(name[level:], package, level)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    tests\\unit\\test_190_cross_org_credential.py:81: in <module>
        from app.services.connector_service import ConnectorNotFound, resolve_connection
    E   ModuleNotFoundError: No module named 'app.services.connector_service'
    ============================== warnings summary ===============================
    venv\\Lib\\site-packages\\requests\\__init__.py:113

    =========================== short test summary info ===========================
    ERROR tests/unit/test_190_cross_org_credential.py
    !!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
    1 warning, 1 error in 0.67s

⚠ **THAT RED IS A WEAK RED, AND SAYING SO IS THE POINT.** ``ModuleNotFoundError`` proves the
module is absent — it does **not** prove the three assertions below can distinguish a scoped
resolver from an id-only one. **The MEANINGFUL RED is owed by the plan that lands
``connector_service``**: it must author the resolver **id-only first**
(``SELECT … WHERE id = $1``), run this file, and observe
``test_a_connection_id_from_another_org_does_not_resolve`` fail with a *leak* — the row for org
B resolving under org A — recording that failure text HERE beneath this block, before landing
``AND org_id = $2``. A file that only ever showed ``ModuleNotFoundError`` has measured the
import system, not the tenant boundary.
"""

from __future__ import annotations

import inspect

import pytest

from app.services.connector_service import ConnectorNotFound, resolve_connection

# ── the two tenants ───────────────────────────────────────────────────────────
# Fixed literals rather than uuid4(): a failure message that names the same id every run is
# greppable against a stored row, and nothing here reaches a database.
ORG_A = "aaaaaaaa-0000-4000-8000-000000000001"  # the org whose workflow is RUNNING
ORG_B = "bbbbbbbb-0000-4000-8000-000000000002"  # the org whose CREDENTIAL is at stake

CONNECTION_OWNED_BY_ORG_B = "cccccccc-0000-4000-8000-00000000000b"

# The thing that must never cross the boundary. It carries the shipped ``enc:v1:`` envelope
# (``secret_cipher.py:43``) so a leak into a refusal message looks exactly like the real one.
ORG_B_SECRET_CIPHERTEXT = "enc:v1:gAAAAABorgBxoxbNEVERLEAKTHISACROSSATENANTBOUNDARY"

# One row, owned by ORG_B. The definition that references it belongs to ORG_A — that mismatch
# IS the scenario, and it is a real shape: a workflow definition is copyable, exportable and
# hand-editable JSONB (D-13), so an id from another org reaching the resolver is not exotic.
_ROW_STORE: dict[str, dict] = {
    CONNECTION_OWNED_BY_ORG_B: {
        "id": CONNECTION_OWNED_BY_ORG_B,
        "org_id": ORG_B,
        "capability": "post_message",
        "name": "Org B — #alerts",
        "config": {"default_channel": "C0RGBALERTS"},
        "secret_ciphertext": ORG_B_SECRET_CIPHERTEXT,
        "is_enabled": True,
    }
}

# What the resolver actually asked the storage layer for. This list is the whole reason the
# fetch seam takes two arguments: it turns "did the resolver scope the lookup?" from an
# unobservable property of a SQL string into a recorded fact.
_fetch_calls: list[tuple] = []


async def _fake_fetch_row(connection_id, org_id):
    """The row fetch, stubbed at the service seam — no Postgres, so this lives in ``tests/unit``.

    It behaves as a **correctly scoped** storage layer: it returns the row only when the
    caller's ``org_id`` matches the row's own. That polarity is deliberate. It means the drive
    measures the **RESOLVER**, not the stub: if the resolver drops the run's org on the floor
    (passing ``None``, or a default, or the row's own org read back out of the row it has not
    fetched yet), the mismatch never happens, the row comes back, and
    ``test_a_connection_id_from_another_org_does_not_resolve`` fails — which is the leak, made
    visible at unit speed.

    ⚠ It deliberately does **not** decrypt. The resolver's decrypt half is a different
    property with its own drive (D-11's fail-CLOSED inversion); mixing them here would let a
    cipher failure masquerade as a tenant-boundary pass.
    """
    _fetch_calls.append((connection_id, org_id))
    row = _ROW_STORE.get(connection_id)
    if row is None:
        return None
    if row["org_id"] != org_id:
        return None
    return dict(row)


async def test_a_connection_id_from_another_org_does_not_resolve():
    """D-14 / T8 — org A's run may not resolve org B's connection, and the refusal says nothing.

    Two assertions beyond the raise itself, because the raise alone is satisfiable by a wrong
    fix:

      * the message carries **neither the ciphertext nor the word ``forbidden``**. A cross-org
        id must read as ABSENT. ``403`` (or "forbidden", or "not permitted") is an existence
        oracle: it confirms to org A that the id it guessed is a real row somewhere, which is
        precisely the information the tenant boundary exists to withhold.
      * the fetch was called **with ORG_A**. Without this, a resolver that never scoped
        anything but happened to raise for an unrelated reason (a disabled row, a shape check,
        an early return) would pass this test while leaking on the next call.
    """
    _fetch_calls.clear()

    with pytest.raises(ConnectorNotFound) as excinfo:
        await resolve_connection(
            connection_id=CONNECTION_OWNED_BY_ORG_B,
            org_id=ORG_A,
            fetch_row=_fake_fetch_row,
        )

    message = str(excinfo.value)
    assert ORG_B_SECRET_CIPHERTEXT not in message, (
        "D-08/T8: the cross-org refusal leaked org B's stored ciphertext into its own error "
        f"message. A refusal names the capability and the reason, never the secret: {message!r}"
    )
    assert "enc:v1:" not in message, (
        f"D-08/T8: the refusal carries the secret envelope prefix — some part of the stored "
        f"secret reached the message: {message!r}"
    )
    for oracle in ("forbidden", "not permitted", "403", "belongs to"):
        assert oracle not in message.lower(), (
            f"T8: the refusal reads as {oracle!r} rather than as ABSENT. "
            "`api/classification_rules.py:11-19` — every cross-org miss collapses to a generic "
            f"not-found, never the forbidden status; otherwise the error IS the leak: {message!r}"
        )

    assert _fetch_calls == [(CONNECTION_OWNED_BY_ORG_B, ORG_A)], (
        "T8: the resolver did not hand the RUN's org down to the storage layer — so the "
        "refusal above came from somewhere other than the tenant scope, and an id-only SELECT "
        f"would still leak. Recorded fetch calls: {_fetch_calls!r}"
    )


async def test_the_same_connection_id_DOES_resolve_for_its_owning_org():
    """NON-VACUITY — the identical id resolves for **org B**, so the refusal above is the SCOPE.

    Without this case a resolver that raises ``ConnectorNotFound`` unconditionally passes the
    leak test forever, and the phase would ship a green security gate over a connector that can
    never send anything. One id, two orgs, two outcomes: that is the whole property.
    """
    _fetch_calls.clear()

    resolved = await resolve_connection(
        connection_id=CONNECTION_OWNED_BY_ORG_B,
        org_id=ORG_B,
        fetch_row=_fake_fetch_row,
    )

    assert resolved is not None, (
        "the resolver refused the OWNING org's own connection — the tenant test above is then "
        "vacuous, and no connection could ever be used by anybody"
    )
    assert _fetch_calls == [(CONNECTION_OWNED_BY_ORG_B, ORG_B)], (
        f"the resolver did not pass org B down on the succeeding path either: {_fetch_calls!r}"
    )


def test_the_resolver_signature_takes_an_org_id():
    """D-14 — ``org_id`` is a REQUIRED parameter of the resolver, with NO default.

    A signature assertion rather than a behaviour one, because this is the failure mode the
    behaviour tests cannot see: ``org_id: str | None = None`` satisfies both cases above (every
    call in this file passes it explicitly) while defaulting the whole rest of the codebase to
    an unscoped lookup. **An optional ``org_id`` is the id-only SELECT wearing a disguise.**
    """
    signature = inspect.signature(resolve_connection)

    assert "org_id" in signature.parameters, (
        f"D-14: `resolve_connection` takes no `org_id` at all — the lookup cannot be scoped by "
        f"the run's org. Parameters: {list(signature.parameters)}"
    )
    parameter = signature.parameters["org_id"]
    assert parameter.default is inspect.Parameter.empty, (
        f"D-14: `org_id` carries the default {parameter.default!r}. An optional org scope is "
        "the id-only SELECT wearing a disguise: every caller that omits it silently resolves "
        "across the whole tenant boundary, and nothing fails."
    )
    assert parameter.kind is not inspect.Parameter.VAR_KEYWORD, (
        "D-14: `org_id` is absorbed by **kwargs rather than declared — the signature then "
        "promises nothing and the assertion above is vacuous"
    )

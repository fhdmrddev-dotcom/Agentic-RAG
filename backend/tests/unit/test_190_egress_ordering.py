"""Phase 190 (CONN-03) — **W0-3: THE n8n CVE CLASS, INVERTED INTO A TEST (D-06).**

The egress guard must refuse **before** credential resolution is even attempted, and it must do
so **unconditionally** — including when no credential is bound at all.

── THE CVE THIS FILE EXISTS TO NOT REPEAT ───────────────────────────────────────────────
n8n issue **#28218** (`.planning/research/deep-dive/N8N.md` Q5). SSRF protection via
``allowedDomains`` was enforced **only when credentials were attached** to the HTTP Request
node, because the allow-list was a property *of the credential* and the check lived *inside the
credential-validation path*. The exploit was a node with **no credential**:
``http://169.254.169.254/latest/meta-data/`` fetched unchallenged, from the server's network
position. The root cause, verbatim from the writeup:

    "protection activates conditionally based on credential presence, not request
     characteristics."

and the prescribed fix, verbatim:

    "decoupling SSRF protection from credential dependency"

**That is one ordering of two lines.** It is bypassable the day someone reorders them, and no
ordinary test can see the difference: every ordinary test binds a credential, so the guard fires
either way and the outcome is identical. That is why this file asserts the **identity of the
error** and the **recorded call order**, not merely that something failed.

── WHY IT IS AUTHORED BEFORE ``app.security.egress`` EXISTS ─────────────────────────────
**A test that has never been observed RED proves nothing.** CONTEXT ``<specifics>`` requires the
latent defects this phase's own commit creates to be driven RED in Wave 0, before any adapter
exists. This drive is therefore written first, run first, and its failure text recorded verbatim
below.

── THE CONTRACT THIS DRIVE IMPOSES ──────────────────────────────────────────────────────
  1. ``app.security.egress.EgressRefused`` — the refusal type. It is **not** credential-shaped
     and must not be reachable from, or subclassed under, any credential error.
  2. ``EgressRefused`` exposes ``reason_code`` and ``host``. D-08 says a refusal logs *"the
     capability, the refused host and the reason — never the resolved secret, never the request
     body"*; structured attributes are that sentence made assertable instead of grep-able.
  3. ``_exec_external_action`` calls **``validate_destination`` then ``resolve_connection``**,
     and imports BOTH callables into its own module namespace. That import shape is deliberate
     and load-bearing: it is what makes the ordering **patchable, and therefore directly
     assertable**. RESEARCH §R10 gives the same reason for choosing an explicit resolve-then-
     connect wrapper over an ``AsyncHTTPTransport`` subclass — *"a transport subclass makes the
     guard implicit, and D-06's whole point is that the ordering must be assertable directly."*

── AN IMPLEMENTATION CHOICE THAT MUST BE RE-CHECKED, STATED RATHER THAN BURIED ──────────
The phase config here is a duck-typed ``SimpleNamespace``, not a ``WorkflowDefinition``-
validated ``ExternalActionPhaseConfig``. The executor reads its config through ``getattr``
(``phase_types.py:1867``), so this drives the real function faithfully — but
``ExternalActionPhaseConfig`` is a ``_StrictBase`` (``extra='forbid'``) and does **not** carry a
``base_url`` field today. A duck-typed config therefore **cannot** catch a model that rejects
the destination field, and D-13's final field set is not settled until the plan that lands it.
Recorded here as a known limit of this drive, not as a property it proves.

── RED OBSERVED (Wave 0, plan 190-01) ───────────────────────────────────────────────────
**Observed 2026-08-08**, verbatim, exit code **2**:
``cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_190_egress_ordering.py -q``

    =================================== ERRORS ====================================
    ___________ ERROR collecting tests/unit/test_190_egress_ordering.py ___________
    ImportError while importing test module 'C:\\Vibe Apps\\Agentic RAG\\backend\\tests\\unit\\test_190_egress_ordering.py'.
    Hint: make sure your test modules/packages have valid Python names.
    Traceback:
    C:\\Python312\\Lib\\importlib\\__init__.py:90: in import_module
        return _bootstrap._gcd_import(name[level:], package, level)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    tests\\unit\\test_190_egress_ordering.py:105: in <module>
        from app.security.egress import EgressRefused
    E   ModuleNotFoundError: No module named 'app.security.egress'
    ============================== warnings summary ===============================
    venv\\Lib\\site-packages\\requests\\__init__.py:113

    =========================== short test summary info ===========================
    ERROR tests/unit/test_190_egress_ordering.py
    !!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
    1 warning, 1 error in 0.36s

── TO BE RE-OBSERVED AT PLAN 190-13 ─────────────────────────────────────────────────────
⚠ **The RED recorded above is a WEAK RED and the distinction is the whole point of Wave 0.**
``ModuleNotFoundError: No module named 'app.security.egress'`` proves the module is absent. It
proves **nothing** about whether these three functions can tell a guard-first executor from a
resolver-first one — which is the only thing this file is for.

**The MEANINGFUL RED is owed by plan 190-13**, and it is specific:

  * author ``_exec_external_action`` with the credential resolution **BEFORE** the guard call —
    the n8n ordering, deliberately;
  * run this file and observe
    ``test_a_send_with_NO_credential_bound_raises_the_egress_refusal_not_a_credential_error``
    fail because the raised error is the **missing-credential** error rather than
    ``EgressRefused``;
  * **record that failure text beneath this block, verbatim**, naming the credential-shaped
    exception it actually got;
  * only then reorder the two calls, and observe green.

A file whose only recorded RED is an import error has measured the import system. The tenant is
protected by the second observation, not the first.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.security.egress import EgressRefused
from app.services.harness import phase_types
from app.services.harness.phase_types import _exec_external_action

# ── the refused destination ───────────────────────────────────────────────────
# The cloud metadata endpoint — the exact address n8n #28218 was exploited against, and D-07
# step 3 names it explicitly. Used as a literal so a reader can see what is being refused.
METADATA_HOST = "169.254.169.254"
REFUSED_BASE_URL = f"https://{METADATA_HOST}/"

# A destination a correct guard would PERMIT. Only the ordering case uses it: to see the guard
# run BEFORE the resolver you need a run in which the resolver runs at all, which means the
# guard must pass. A refused host makes the order unobservable — the resolver never runs either
# way, and the recorded order is `["egress"]` for a correct executor and a broken one alike.
ALLOWED_HOST = "acme.atlassian.net"
ALLOWED_BASE_URL = f"https://{ALLOWED_HOST}"

# A bound connection's stored secret. It exists so the refusal can be checked for NOT carrying
# it (D-08), and so the resolver stub has something real-shaped to hand back.
STUBBED_SECRET = "xoxb-190-THIS-STRING-MAY-NEVER-APPEAR-IN-A-REFUSAL"

BOUND_CONNECTION_ID = "dddddddd-0000-4000-8000-00000000000c"


def _external_action_phase(*, connection_id: str | None, base_url: str = REFUSED_BASE_URL):
    """A ``create_ticket`` step aimed at ``base_url``.

    ⚠ Duck-typed on purpose — see the module docstring's stated limit. The executor reads
    ``phase.config`` through ``getattr``, so this exercises the real function rather than a
    re-implementation of it.
    """
    return SimpleNamespace(
        slug="file-the-ticket",
        phase_index=0,
        config=SimpleNamespace(
            phase_type="external_action",
            capability="create_ticket",
            available_tools=["create_ticket"],
            base_url=base_url,
            connection_id=connection_id,
        ),
    )


def _run_ctx():
    """A permissive duck-typed run ctx — every executor reads ctx via ``getattr``.

    ``is_golden_run=False`` because D-16's publish-time suppression is a DIFFERENT property with
    its own already-armed fence (``test_harness_engine.py::
    test_a_golden_run_of_an_external_action_performs_no_egress``). A golden run here would skip
    the send entirely and every assertion below would pass vacuously.
    """
    return SimpleNamespace(
        inputs={"summary": "Renewal follow-up"},
        user_settings=None,
        retry_feedback=None,
        run_id=None,
        thread_id=None,
        user_id=None,
        org_id="aaaaaaaa-0000-4000-8000-000000000001",
        is_golden_run=False,
    )


async def test_a_send_with_NO_credential_bound_raises_the_egress_refusal_not_a_credential_error():
    """D-06 — **the n8n inversion.** No credential at all, and the refusal is still the GUARD's.

    This is the case n8n did not have. With ``connection_id`` absent there is nothing for the
    credential path to validate, so a guard that lives inside that path never runs — and the
    request goes out. Here the guard must fire anyway, because the refusal is a property of the
    **request**, not of the credential (the CVE's own root-cause sentence, inverted).

    The assertions go beyond ``pytest.raises(EgressRefused)`` because a resolver-first executor
    also raises: it just raises the WRONG THING. So the error's IDENTITY is what is measured —
    both its type name and its wording — which is what survives a line reorder.
    """
    with pytest.raises(EgressRefused) as excinfo:
        await _exec_external_action(
            _external_action_phase(connection_id=None), {}, _run_ctx()
        )

    exception = excinfo.value
    type_name = type(exception).__name__
    assert "Credential" not in type_name, (
        f"D-06: the failure for an UNBOUND step is {type_name!r} — a credential-shaped error. "
        "That is n8n #28218 exactly: 'protection activates conditionally based on credential "
        "presence, not request characteristics'. The guard must refuse the DESTINATION before "
        "anything looks for a secret."
    )
    message = str(exception).lower()
    for credential_word in ("credential", "token", "password", "secret", "not configured"):
        assert credential_word not in message, (
            f"D-06: the refusal for an unbound step reads as {credential_word!r} — the person "
            f"is told to attach a credential for a destination that would be refused WITH one. "
            f"The reason must be the destination: {str(exception)!r}"
        )


async def test_the_refusal_names_the_host_and_the_reason_and_NOTHING_else(monkeypatch):
    """D-08 — the refusal is auditable and leaks nothing. Driven WITH a credential bound.

    A credential IS bound here, which does two things at once:

      * it proves the guard fires in the ordinary case too — D-06 is not a special path for
        unbound steps, it is the same guard reached earlier;
      * it gives the leak assertion something to be non-vacuous about. The stubbed resolver
        holds a real-shaped secret, so "the refusal does not name the secret" is a claim with a
        subject.

    ANTI-VACUITY, and it is the load-bearing half: the resolver stub records whether it ran, and
    this asserts it did **NOT**. Without that, "the refusal contains no secret" would be trivially
    satisfied by an executor that resolved the credential first, logged it, and then refused —
    the assertion would be measuring the message, not the ordering.
    """
    resolver_calls: list = []

    async def _recording_resolver(*args, **kwargs):
        resolver_calls.append((args, kwargs))
        return {"id": BOUND_CONNECTION_ID, "secret": STUBBED_SECRET}

    monkeypatch.setattr(
        phase_types, "resolve_connection", _recording_resolver, raising=True
    )

    with pytest.raises(EgressRefused) as excinfo:
        await _exec_external_action(
            _external_action_phase(connection_id=BOUND_CONNECTION_ID), {}, _run_ctx()
        )

    exception = excinfo.value

    assert resolver_calls == [], (
        "D-06: the credential was resolved BEFORE the destination was refused. Nothing has "
        "leaked yet, but the ordering is the defect — the secret is now in memory, in a "
        f"traceback frame and one log line away from disk. Resolver calls: {resolver_calls!r}"
    )

    assert hasattr(exception, "reason_code"), (
        "D-08: EgressRefused carries no `reason_code`. An audit entry that must be filtered, "
        "counted and alerted on cannot be a prose string parsed after the fact."
    )
    assert getattr(exception, "reason_code", None), (
        f"D-08: `reason_code` is empty ({exception.reason_code!r}) — an attribute that is "
        "always falsy is the same as no attribute, and passes `hasattr` forever."
    )
    assert hasattr(exception, "host"), (
        "D-08: EgressRefused carries no `host`. The refused host is the ONE piece of the "
        "request an operator needs, and the only one they may safely be given."
    )
    assert exception.host == METADATA_HOST, (
        f"D-08: `host` is {exception.host!r}, not the refused host {METADATA_HOST!r}"
    )
    assert METADATA_HOST in str(exception), (
        f"D-08: the rendered refusal does not name the refused host, so the log line an "
        f"operator actually reads says nothing actionable: {str(exception)!r}"
    )

    rendered = str(exception) + repr(getattr(exception, "__dict__", {}))
    assert STUBBED_SECRET not in rendered, (
        f"D-08: the refusal carries the stored secret. A refusal names the capability, the "
        f"host and the reason — never the resolved secret, never the request body: {rendered!r}"
    )
    assert "xoxb-" not in rendered, (
        f"D-08: a bare token prefix reached the refusal — a partial secret is still a secret: "
        f"{rendered!r}"
    )


async def test_the_guard_is_called_before_the_resolver(monkeypatch):
    """D-06 — the RECORDED CALL ORDER is exactly ``["egress", "resolve"]``.

    **This is the assertion that survives a line reorder**, and it is the only one here that
    can. The two cases above compare outcomes, and an outcome is invisible to ordering whenever
    both calls would fail — bind a working credential to a refused host and a resolver-first
    executor produces a byte-identical result. So the order itself is recorded and asserted.

    Both stubs are installed with ``raising=True`` on ``phase_types``' own namespace. That is
    not incidental: if the executor reaches its guard some other way (a module-qualified call, a
    transport subclass, a decorator), these ``setattr`` calls fail loudly rather than binding
    nothing and letting the test pass while measuring an executor it never touched.

    ⚠ **The destination is one a correct guard PERMITS**, and that is required rather than
    incidental. Point this case at the metadata host and the guard refuses, the resolver never
    runs, and the recorded order is ``["egress"]`` for a correct executor and ``["resolve"]``
    for the n8n one — two different orders, neither of them the one being asserted, and the
    case stops measuring the thing it is named after. The resolver then raises a sentinel so
    execution stops the instant both calls are on the record: no adapter runs, no socket is
    opened, and the case cannot be slowed or made flaky by anything downstream of it.
    """
    order: list[str] = []

    class _StopAfterResolve(RuntimeError):
        """Halt the drive the moment the ordering is fully recorded."""

    def _recording_guard(*args, **kwargs):
        order.append("egress")
        # A permitted destination returns the validated (ip, sni_hostname, port) triple
        # RESEARCH §R10 specifies; the shape is irrelevant here, the RECORD is the point.
        return ("203.0.113.10", ALLOWED_HOST, 443)

    async def _recording_resolver(*args, **kwargs):
        order.append("resolve")
        raise _StopAfterResolve("Wave-0 ordering drive: stop before any adapter runs")

    monkeypatch.setattr(
        phase_types, "validate_destination", _recording_guard, raising=True
    )
    monkeypatch.setattr(
        phase_types, "resolve_connection", _recording_resolver, raising=True
    )

    with pytest.raises(_StopAfterResolve):
        await _exec_external_action(
            _external_action_phase(
                connection_id=BOUND_CONNECTION_ID, base_url=ALLOWED_BASE_URL
            ),
            {},
            _run_ctx(),
        )

    assert order == ["egress", "resolve"], (
        f"D-06 / n8n #28218: the recorded call order is {order!r}, not ['egress', 'resolve']. "
        "'Decoupling SSRF protection from credential dependency' is an ordering of two lines, "
        "and this is the assertion that survives someone swapping them — every outcome-based "
        "test in this suite reads identically either way."
    )

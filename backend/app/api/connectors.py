"""Phase 190 (CONN-02 / CONN-03) — the connector-connection CRUD router.

The thin composition layer that turns plan 190-06's `connector_service` into a live,
leak-safe API surface at `/connectors/connections`. Cloned from
`api/classification_rules.py` (itself cloned from `api/document_views.py`) — the house
CRUD shape. **There is no SQL in this file**: every route delegates to
`connector_service`, which owns the table, the cipher and the org scope.

── D-25 · WHY THIS LIVES IN SETTINGS, NOT THE CONTROL ROOM ───────────────────────────────
The recorded settings↔control-room boundary: *the operator sets the allowed-set and the
lock; the user (here: an org admin) sets the preference.* Creating a connection is
org-tenant configuration, so its surface is Settings → Connections and its API is a
top-level `/connectors` router — NOT an `/admin` route. The operator's half is the
`live_connectors` kill-switch (D-26), which lives in `admin.py`'s `_VISIBILITY_FEATURES`.

── D-15 · WHICH GATE IS THE REAL ONE, FOR THIS FILE ──────────────────────────────────────
Answered here per call site rather than waved away with "RLS covers it".

  EVERY route in this module runs on the PER-REQUEST USER-JWT Supabase client
  (`get_user_supabase_client`, the same DI `api/classification_rules.py` uses). On that
  connection **RLS is a REAL RUNTIME GATE**: migration 116's four policies resolve
  `current_user_org_ids()` / `auth.uid()` for the actual caller, so a row outside the
  caller's org is invisible to the query itself and a write without `org:manage` is
  rejected by the database. The org filter `connector_service` applies is defence in depth
  ON TOP of that, not instead of it.

  This is the OPPOSITE posture from the harness resolver (`resolve_connection`), which runs
  on the service-role / **BYPASSRLS** pool because the workflow engine executes with no user
  JWT. There the application org filter IS the gate and RLS is only the backstop. Two call
  sites, two answers; see `connector_service.py`'s header for the second.

⚠ **AMENDED 2026-08-09 (plan 190-15) — the sentence above said "EVERY route", and from the
  commit that added the credential check that is no longer exactly true.** Stated rather
  than left to rot, because a stale invariant in a security header is how this project ships
  lies:

    SUPERSEDED 2026-08-09 (plan 190-15, the check action):
      "EVERY route in this module runs on the PER-REQUEST USER-JWT Supabase client"

  What is true instead, and it is narrower rather than weaker. `POST /connections/{id}/check`
  has TWO database touches and they use DIFFERENT clients, deliberately:

    * the READ goes through `connector_service.resolve_connection(id, org_id=<caller's active
      org>)` — the service-role resolver, i.e. D-15 case 2, where the APPLICATION ORG FILTER
      IS THE GATE. That is the whole point: the check must exercise the same resolver a RUN
      uses, so a green verdict is evidence about the row the engine will actually resolve.
      Using a second, RLS-shaped read path here would test a path no run takes.
    * the WRITE (`record_check_verdict`) goes through the injected USER-JWT client, so
      migration 116's UPDATE policy is a real runtime gate on the mutation, on top of the
      `org_id` predicate in the SQL itself.

  Both halves are scoped by `active_org`, which `get_active_org_id` has already validated the
  caller into. Neither is scoped by id alone.

── UI-SPEC U-02 · THE ORG-ADMIN WRITE GATE IS API-ENFORCED ───────────────────────────────
A member who creates a connection binds their colleagues' published workflows to a
destination they chose. So (UI-SPEC §2b):

  | read the table / bind a connection to a step | everyone in the org |
  | create / edit / delete a connection          | **org admins only** |

Enforced server-side by `require_org_manage`, which runs migration 104's
`current_user_has_permission(org_id, 'org:manage')` SECDEF helper AS THE CALLER on a
user-JWT connection (`dependencies.py:894-911`). `org:manage` is already granted to
`super-admin` + `org-admin` (`104_org_dept_role_schema.sql:416-426`) — no fifth permission
key was minted. **A hidden ＋ Add button is NOT the gate**; the API refuses a plain member
with no UI involved, and `test_190_connectors_api.py` drives exactly that.

── THE NO-EXISTENCE-LEAK RULE (inherited verbatim from classification_rules.py:11-19) ────
  * "Every cross-user/unseeable miss collapses to a generic 404, NEVER the forbidden
    status — no existence leak."
  * "UPDATE validates ownership FIRST … so an unowned/absent id uniformly 404s regardless
    of whether the submitted body is valid — no 422-vs-404 ordering oracle."

`connector_service` already collapses "absent" and "another org's" into one
`ConnectorNotFound`, and already checks org-scoped existence before interpreting any body
field. This router maps that ONE refusal to ONE 404 and never constructs the forbidden
status for a connection id. (The two forbidden-status refusals a caller can meet
here — the org-admin gate and the feature gate — are raised in `dependencies.py` and are
properties of the CALLER, never of a row; neither confirms that an id names anything.)

── T7 · THE CREDENTIAL NEVER LEAVES ──────────────────────────────────────────────────────
Every route's `response_model` is `ConnectorConnectionResponse`, which has no
`secret_ciphertext` and no `secret` field and is `extra='forbid'`. That model is the gate;
the TypeScript type in `lib/api.ts` is documentation. The refusal bodies below carry a
reason code and a sentence, never a value read from the row.

── THE `live_connectors` FEATURE GATE — WHERE IT IS ATTACHED, AND WHERE IT IS NOT ────────
`require_visible("live_connectors")` is attached **PER ENDPOINT on the three WRITE
endpoints**, never on the `APIRouter(...)` constructor — `dependencies.py:535-537` says so
in as many words (*"Attach PER-ENDPOINT on the governed authoring/management endpoints
ONLY — never at a router level that would gate a Run/chat carve-out"*), and a router-level
gate here would also take the read down with it.

**The READ endpoints are deliberately NOT gated, and that asymmetry is a DECISION:** the
Settings → Connections tab must be able to render UI-SPEC §2h's OFF banner
(*"Live sending is off for this platform…"*) over the real table. A gated read would refuse
the tab into a dead page and the banner — the one place a person learns the switch exists
and who can flip it — would never render. Binding an existing connection to a step is
org-wide (U-02) and rides the same read, so gating it would silently break authoring too.

⚠ **A CONFLICT WITH UI-SPEC §2h IS RECORDED HERE RATHER THAN SMOOTHED.** Plan 190-09's
Task 1 and Task 2 both direct the write endpoints to carry this gate, and Task 2 requires a
test exercising it in BOTH directions. But UI-SPEC §2h's banner copy says, verbatim,
*"Connections below **can be saved** and bound to a workflow, but no message, ticket or
email will leave"* — which is FALSE for a non-operator while the cold default `"off"`
stands, because the write gate refuses. Both documents govern this phase and they disagree;
the plan is the contract this router executes, so the gate is attached, and the
contradiction is stated here, in `190-09-SUMMARY.md`, and left for the Settings-UI plan to
resolve in ONE line — either drop the three `dependencies=[...]` entries below, or amend
§2h's second sentence. It must not be discovered as a bug in UAT.

── Blocking I/O ─────────────────────────────────────────────────────────────────────────
No `supabase-py` call is made in this module. Every DB touch happens inside
`connector_service`, where each one goes through `app.utils.db.aexec` =
`run_in_threadpool(query.execute)` (D-v2.5-01).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_user_supabase_client,
    require_org_manage,
    require_visible,
)
from app.models.connector import (
    ConnectorCheckResponse,
    ConnectorConnectionCreate,
    ConnectorConnectionResponse,
    ConnectorConnectionUpdate,
)
from app.security.egress import (
    EgressRefused,
    EgressResponseTooLarge,
    EgressResponseUndecodable,
)
from app.services import connector_service
from app.services.connectors.jira_adapter import JiraUnreachable
from app.services.connectors.protocol import AdapterError
from app.services.connectors.slack_adapter import SlackUnreachable

# Re-exported so the falsification suite can construct request bodies as
# `connectors.ConnectorConnectionCreate(...)` without importing two modules.
__all__ = [
    "router",
    "CIPHER_UNAVAILABLE_REASON",
    "CONNECTION_DISABLED_REASON",
    "CREDENTIAL_UNREADABLE_REASON",
    "ConnectorCheckResponse",
    "ConnectorConnectionCreate",
    "ConnectorConnectionUpdate",
    "ConnectorConnectionResponse",
]

router = APIRouter(prefix="/connectors", tags=["connectors"])

# The ONE machine-readable reason code this router emits. It is deliberately NOT a member of
# `egress.REFUSAL_REASONS` — that frozenset is a CLOSED six-row table about DESTINATIONS
# (UI-SPEC §4c) and carries its own `len(...) == 6` assert. This code is about the PLATFORM:
# it renders UI-SPEC §4b moment 9, the refusal a person cannot fix (Save goes DISABLED, with
# `aria-describedby` → "Disabled because no encryption key is configured."). Keeping the two
# code spaces separate is what stops a platform problem from being worded as a host problem.
CIPHER_UNAVAILABLE_REASON = "no_encryption_key"

# 503, not 500 and not 400: the request was well-formed and the caller did nothing wrong —
# the INSTANCE cannot store a tenant credential safely (D-11's fail-CLOSED inversion). The
# honest status for "correct request, service cannot currently perform it" is Service
# Unavailable, and it is the status UI-SPEC §4b moment 9's copy is written against.
_CIPHER_UNAVAILABLE = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail={
        "reason_code": CIPHER_UNAVAILABLE_REASON,
        "message": (
            "This platform cannot store a credential safely yet — no encryption key is "
            "configured. Nothing was written."
        ),
    },
)

# ONE refusal object for "absent" and for "another org's". Constructed at module scope so
# every miss in this file is byte-identical: a caller cannot tell the two apart by body,
# by wording or by length. See `ConnectorNotFound`'s docstring in the service.
_NOT_FOUND = HTTPException(status_code=404, detail="Connection not found")

# ── the check action's two ADDITIONAL platform reason codes ──────────────────────────────
# Same rule as `CIPHER_UNAVAILABLE_REASON` above and for the same reason: these are PLATFORM
# refusals, deliberately NOT members of `egress.REFUSAL_REASONS` (a CLOSED six-row table
# about DESTINATIONS, with its own `len(...) == 6` assert). Keeping the two code spaces apart
# is what stops a platform problem from being worded as a host problem — a person told
# "correct the host and try again" about a missing encryption key retries forever.
CONNECTION_DISABLED_REASON = "connection_disabled"
CREDENTIAL_UNREADABLE_REASON = "credential_unreadable"

# 409, not 404 and not 403: the row IS in the caller's org and they can already see it in
# the table, so naming its state discloses nothing across the tenant boundary (the same
# reasoning `ConnectorDisabled` carries in the service). It is a CONFLICT with the row's
# current state, and re-enabling it is a one-click fix the same person already has.
_CONNECTION_DISABLED = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail={
        "reason_code": CONNECTION_DISABLED_REASON,
        "message": (
            "This connection is switched off, so its credential was not checked. Turn it "
            "back on to check it."
        ),
    },
)

# 503 for the same reason `_CIPHER_UNAVAILABLE` is: the request was well-formed and the
# caller did nothing wrong — the stored credential cannot be READ (it is at rest without an
# envelope, or no configured key decrypts it). Distinct from `no_encryption_key` because a
# key IS configured in this case, and telling an admin to set one would send them to fix
# something that is not broken.
_CREDENTIAL_UNREADABLE = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail={
        "reason_code": CREDENTIAL_UNREADABLE_REASON,
        "message": (
            "The stored credential for this connection cannot be read, so nothing was "
            "checked. Replace it to store it again."
        ),
    },
)

# ── UI-SPEC §4d's *unreachable* bucket, as a CLOSED tuple ────────────────────────────────
# `unreachable` means the address was ALLOWED and nothing answered on it. Three families
# land here, and each is named rather than swept up by a bare `except Exception`:
#
#   * the two adapters that classify a transport miss themselves (`SlackUnreachable`,
#     `JiraUnreachable`) — the HTTP capabilities;
#   * `OSError`, which is the SMTP capability's whole transport family: `smtplib.SMTPException`
#     subclasses `OSError`, as do `ConnectionRefusedError`, `TimeoutError` and every socket
#     error, and the SMTP adapter's connect happens OUTSIDE its own try block so a connect
#     failure arrives here raw;
#   * `EgressResponseTooLarge` / `EgressResponseUndecodable` — a host that answered with
#     something the pinned transport would not read. The address is allowed and the next step
#     a person is offered is the same one (*"check the host and port, then check again"*),
#     which is what §4d's three buckets are actually about.
#
# `test_190_connector_check.py` asserts that EVERY class under `services/connectors/**` whose
# name ends in `Unreachable` is a member of this tuple, so a fourth adapter cannot ship a
# transport miss that silently reads as `rejected` — i.e. as "your password is wrong".
_UNREACHABLE_ERRORS: tuple[type[BaseException], ...] = (
    SlackUnreachable,
    JiraUnreachable,
    EgressResponseTooLarge,
    EgressResponseUndecodable,
    OSError,
)


def _check_destination(capability: str, config: dict) -> tuple[str, int | None]:
    """The host and port the check CONTACTED, derived from the STORED row.

    UI-SPEC §5c renders *"Authenticated as {identity} at {host}:{port}"*, so both halves come
    from the connection row and NEVER from a request body — the check accepts no body at all.

    `post_message`'s host is a CODE CONSTANT (D-02: Slack's destination is not author-supplied
    and there is no config field that could carry one), which is exactly why one of the three
    destinations is unforgeable by construction.
    """
    if capability == "post_message":
        return "slack.com", 443
    if capability == "send_email":
        port = config.get("port")
        return str(config.get("host") or ""), int(port) if isinstance(port, int) else None
    base = str(config.get("base_url") or "")
    # No URL-parser import: this router must not grow a reason to pull a transport module in.
    host = base.split("://", 1)[-1].split("/", 1)[0].split("@")[-1].split(":")[0]
    return host or base, 443


# ── reads: org-wide (U-02), and NOT feature-gated (see the header) ───────────────────────
@router.get("/connections", response_model=list[ConnectorConnectionResponse])
async def list_connections(
    capability: str | None = Query(
        None,
        description=(
            "Narrow to one capability — the picker's per-capability read (UI-SPEC §6d). "
            "Backed by migration 116's (org_id, capability) index."
        ),
    ),
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Every connection in the caller's active org, optionally narrowed to one capability.

    Available to EVERYONE in the org (U-02: read and bind are org-wide) — a workflow author
    who is not an org admin still has to see the candidate set to bind a step.

    Each row carries `last_check_verdict`, because the picker's Gate 1 renders it (a
    `failed` connection is still listed and still selectable — UI-SPEC §6d — since a binding
    that predates a failure is never silently unbound). It is a QUALITY HINT and never an
    authorization boundary; migration 116 says so in the column's own COMMENT.
    """
    return await connector_service.list_connections(
        org_id=active_org, capability=capability, supabase=supabase
    )


@router.get("/connections/{connection_id}", response_model=ConnectorConnectionResponse)
async def get_connection(
    connection_id: str,
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
    supabase: Client = Depends(get_user_supabase_client),
):
    """One connection, if the caller's org owns it — else the generic 404.

    A cross-org id and a nonexistent id produce the SAME response. Answering "you may not
    have this" would confirm the id names a real row in some other org, which is exactly the
    information the tenant boundary exists to withhold.
    """
    found = await connector_service.get_connection(
        connection_id, org_id=active_org, supabase=supabase
    )
    if found is None:
        raise _NOT_FOUND  # absent or another org's — indistinguishably. Never forbidden.
    return found


# ── writes: org-admin only (U-02), API-ENFORCED, and feature-gated ───────────────────────
@router.post(
    "/connections",
    response_model=ConnectorConnectionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_visible("live_connectors"))],  # D-26 — per endpoint, never on the router
)
async def create_connection(
    body: ConnectorConnectionCreate,
    current_user: dict = Depends(require_org_manage),  # UI-SPEC U-02 — 'org:manage', API-enforced
    active_org: str = Depends(get_active_org_id),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Create an org-shared connection. Org admins only, enforced by the API.

    `org_id` and `created_by` are hard-set by the service from the authenticated caller —
    `ConnectorConnectionCreate` has no field for either, so there is no request body that
    can choose a tenant (that would be the D-14 leak with a friendlier name).

    A `ConnectorCipherUnavailable` becomes **503 + a stable reason code**, which the panel
    renders as UI-SPEC §4b moment 9 (Save DISABLED — a refusal the person cannot fix). It is
    deliberately not a 400: nothing about the submitted body is wrong.
    """
    try:
        return await connector_service.create_connection(
            org_id=active_org,
            created_by=current_user["id"],
            payload=body,
            supabase=supabase,
        )
    except connector_service.ConnectorCipherUnavailable:
        raise _CIPHER_UNAVAILABLE
    except connector_service.ConnectorNotFound:
        # The insert returned no row (RLS refused it, or the write was rejected). Absent is
        # the honest answer and it is the same one a cross-org id gets.
        raise _NOT_FOUND


@router.patch(
    "/connections/{connection_id}",
    response_model=ConnectorConnectionResponse,
    dependencies=[Depends(require_visible("live_connectors"))],  # D-26 — per endpoint
)
async def update_connection(
    connection_id: str,
    body: ConnectorConnectionUpdate,
    current_user: dict = Depends(require_org_manage),  # UI-SPEC U-02 — 'org:manage', API-enforced
    active_org: str = Depends(get_active_org_id),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Patch a connection. Org admins only; a present `secret` REPLACES the stored one.

    Ownership is validated FIRST — inside `connector_service.update_connection`, before any
    part of the body is interpreted — so an unowned or absent id uniformly 404s regardless of
    whether the body was valid. The alternative makes the status code an oracle: a 422 would
    mean *the id exists and is yours, but your body is wrong*, which is a fact about another
    org's rows.
    """
    try:
        return await connector_service.update_connection(
            connection_id, org_id=active_org, payload=body, supabase=supabase
        )
    except connector_service.ConnectorCipherUnavailable:
        raise _CIPHER_UNAVAILABLE
    except connector_service.ConnectorNotFound:
        raise _NOT_FOUND


@router.delete(
    "/connections/{connection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_visible("live_connectors"))],  # D-26 — per endpoint
)
async def delete_connection(
    connection_id: str,
    current_user: dict = Depends(require_org_manage),  # UI-SPEC U-02 — 'org:manage', API-enforced
    active_org: str = Depends(get_active_org_id),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Delete a connection the caller's org owns. Org admins only.

    Org-scoped at the delete itself (never by id alone), against migration 116's existing
    DELETE policy. A miss is the same generic 404 every other route returns.
    """
    removed = await connector_service.delete_connection(
        connection_id, org_id=active_org, supabase=supabase
    )
    if not removed:
        raise _NOT_FOUND  # absent or another org's — never the forbidden status


# ── the credential check: a DEDICATED action, because it has a SIDE EFFECT ───────────────
@router.post(
    "/connections/{connection_id}/check",
    response_model=ConnectorCheckResponse,
    dependencies=[Depends(require_visible("live_connectors"))],  # D-26 — per endpoint
)
async def check_connection(
    connection_id: str,
    current_user: dict = Depends(require_org_manage),  # UI-SPEC U-02 — 'org:manage', API-enforced
    active_org: str = Depends(get_active_org_id),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Authenticate the STORED credential, disconnect, and SEND NOTHING (UI-SPEC §5c).

    ── WHY IT IS A POST ON ITS OWN PATH AND NOT A QUERY PARAM ON THE READ ──
    Because it has a side effect: it writes ``last_checked_at`` and ``last_check_verdict``.
    A read that mutates is a read nobody can cache, retry or reason about.

    ── ⚠ IT TAKES AN ID AND NOTHING ELSE — THE SIGNATURE *IS* THE SECURITY PROPERTY ──
    There is deliberately **no request body**. The check runs on the connection ALREADY
    STORED, resolved through the same org-scoped resolver D-14 protects, so:

      * no plaintext secret ever crosses the wire for a non-storage purpose — the only time
        a credential is transmitted at all is the create/update that stores it; and
      * the check exercises the real credential path, which means a green check is evidence
        about the row a RUN will use, not about something a person retyped into a form.

    A form-driven check would be easier to build and would prove the wrong thing.

    ── ⚠ THE ASYMMETRY BELOW IS LOAD-BEARING. DO NOT "FIX" GATE 2 LATER ──
    This action is **org-admin only** (U-02), while **binding a connection to a step is
    org-wide**. That asymmetry is precisely what decided UI-SPEC §5a's door (b): the server's
    bind gate validates a connection's ORG and its ``is_enabled`` flag and reads the stored
    check verdict NOWHERE. A server bind-gate on a failing verdict would hard-block a plain
    member holding a stale ``failed`` on a credential that has since been fixed — and they
    could not clear it themselves, because they cannot run this endpoint. A reader who does
    not know that will "tighten" the bind gate and manufacture a dead end for the majority
    audience; ``test_190_connector_check.py`` asserts door (b) as a POSITIVE test so that
    change fails loudly instead of silently contradicting §5b's shipped sentence.

    ── UI-SPEC §4d's THREE BUCKETS, KEPT APART HERE BECAUSE NOTHING BELOW CAN ──
    ``refused`` (we declined to open the socket) · ``unreachable`` (allowed, nothing
    answered) · ``rejected`` (we reached it and IT said no). Three states, three next steps.
    They arrive by three different doors on purpose — an ``EgressRefused``, a named transport
    miss, and the adapter's own ``ok=False`` — and flattening them is the single most likely
    copy defect on this surface.

    ⚠ ``EgressRefused`` IS caught here, and that is not the executor's rule being broken.
    ``_exec_external_action`` must never catch it (a caught refusal is one ``except`` clause
    away from being downgraded to a warning on a path that then SENDS). Here the refusal IS
    the product: it is reported to the admin in its own bucket with the guard's own reason
    code, and the verdict persisted is ``failed`` either way. Nothing is downgraded.

    ── FAIL CLOSED, IN THE DIRECTION THAT MATTERS ──
    A revoked Slack token answers ``200 {"ok": false}`` and a Jira/SMTP failure answers on
    its own terms; only the ADAPTER'S OWN verdict produces ``ok``. A green light is a light
    a person acts on later, so a check that cannot establish WHO it authenticated as is not
    a green check (each adapter enforces that itself).

    ── No user-facing sentence is authored here ──
    The panel composes §5c's headline and §4c's six refusal sentences from exported
    identifiers (plan 190-18). What this layer owes it is the vendor's words VERBATIM and
    the server's own ``reason_code``, unmodified.
    """
    try:
        connection = await connector_service.resolve_connection(
            str(connection_id), org_id=str(active_org)
        )
    except connector_service.ConnectorNotFound:
        raise _NOT_FOUND  # absent or another org's — indistinguishably. Never forbidden.
    except connector_service.ConnectorDisabled:
        raise _CONNECTION_DISABLED
    except connector_service.ConnectorCipherUnavailable:
        raise _CIPHER_UNAVAILABLE
    except connector_service.ConnectorSecretNotEncrypted:
        raise _CREDENTIAL_UNREADABLE

    capability = connection.capability
    config = dict(connection.config or {})
    host, port = _check_destination(capability, config)

    # Lazily imported INSIDE the handler, and that is a DECISION rather than an oversight.
    # `connectors.registry` imports `harness.grounding`, whose package `__init__` imports
    # `phase_types`, which imports the registry back — a real cycle that stays unreachable
    # only because `phase_types` is its sole MODULE-SCOPE importer
    # (`test_190_connector_source_fence.py` pins exactly that). A deferred import runs after
    # every module is loaded, so it joins no cycle; the fence was extended in this plan's
    # commit to check WHERE an import sits rather than merely how many there are.
    from app.services.connectors.registry import get_adapter

    adapter = get_adapter(capability)

    bucket: str | None = None
    reason_code: str | None = None
    identity: str | None = None
    provider_message = ""

    try:
        result = await adapter.check(credential=connection, config=config)
    except EgressRefused as exc:
        # WE declined. There is no vendor to quote — nothing was ever contacted — so
        # `provider_message` stays empty and the guard's own code carries the meaning.
        ok, bucket, reason_code = False, "refused", exc.reason_code
    except _UNREACHABLE_ERRORS as exc:
        # The address was ALLOWED and nothing answered on it. Distinct from `rejected`
        # because the next step is the network, not the token.
        ok, bucket, provider_message = False, "unreachable", str(exc)
    except connector_service.ConnectorSecretUnreadable:
        # Raised lazily on `.secret`, i.e. inside the adapter. Nothing was contacted.
        raise _CREDENTIAL_UNREADABLE
    except connector_service.ConnectorCipherUnavailable:
        raise _CIPHER_UNAVAILABLE
    except AdapterError as exc:
        # OUR refusal of the stored configuration (a config the `extra='forbid'` model will
        # not accept, an argument shape the adapter declines). We declined to open the
        # socket, so it belongs in `refused` — never in `rejected`, which would tell the
        # person their password is wrong about a problem that is ours.
        ok, bucket, provider_message = False, "refused", str(exc)
    else:
        ok = bool(getattr(result, "ok", False))
        identity = getattr(result, "identity", None)
        provider_message = getattr(result, "provider_message", "") or ""
        if not ok:
            # We reached it and IT said no. This is exactly and only the case UI-SPEC §5b's
            # *"The host rejected this credential"* is written for.
            bucket = "rejected"

    verdict = "ok" if ok else "failed"
    settled = await connector_service.record_check_verdict(
        str(connection_id), org_id=str(active_org), verdict=verdict, supabase=supabase
    )

    return ConnectorCheckResponse(
        ok=ok,
        verdict=verdict,
        identity=identity,
        host=host,
        port=port,
        checked_at=settled.last_checked_at,
        bucket=bucket,
        provider_message=provider_message,
        reason_code=reason_code,
    )

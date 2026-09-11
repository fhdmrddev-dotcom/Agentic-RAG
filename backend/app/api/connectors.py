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

import logging
from dataclasses import asdict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from supabase import Client

#: ⚠ THIS MODULE USED `logger` AT SIX SITES AND DEFINED IT AT NONE.
#:
#: `logger` was a plain undefined NAME, so every one of those lines raised `NameError` the
#: moment it was reached — and because the raise happens after the response has begun, the
#: browser gets no status and no CORS headers at all: `TypeError: Failed to fetch`, with
#: NOTHING in the server log. Import-time checks cannot see it; only executing the line can.
#:
#: Measured 2026-08-31: `POST /connectors/oauth/authorize` with ANY non-null
#: `connection_id` died this way, while the same call with `connection_id: null` returned a
#: clean 422 — the branch that reads the stored client id is the one that logs. The other
#: five sites are worse: two of them are the OAuth CALLBACK's error paths, so a provider
#: that answered with an error, or a token exchange that failed, would have crashed the
#: request instead of redirecting the person somewhere that says so.

from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_user_supabase_client,
    require_org_manage,
    require_visible,
)
from app.models.connector import (
    ApplicationAvailability,
    ConnectionFileImportRequest,
    ConnectorCheckResponse,
    ConnectorConnectionCreate,
    ConnectorConnectionResponse,
    ConnectorConnectionUpdate,
    McpDiscoverRequest,
    McpDiscoverResponse,
    McpProbeAuthRequest,
    McpProbeAuthResponse,
    McpOAuthStartRequest,
    McpOAuthStartResponse,
    OAuthAuthorizeRequest,
    OAuthAuthorizeResponse,
    OAuthProvider,
    OAuthTokenResponse,
    SourceConfirmOutcome,
    SourceConfirmResponse,
    SourcePreviewItem,
    SourcePreviewRequest,
    SourcePreviewResponse,
    ToolGrantPosture,
)
from app.services.audit_service import write_audit_entry
from app.security.egress import (
    EgressRefused,
    EgressResponseTooLarge,
    EgressResponseUndecodable,
)

logger = logging.getLogger(__name__)
# ⚠ UNDEFINED IN THIS MODULE UNTIL 2026-09-01, WITH THREE CALL SITES. `aexec` was used by
# `create_oauth_authorize_url` (Phase 215, the OAuth Connect path), `import_connection_file`
# (Phase 216) and this phase's `start_mcp_oauth`, and imported by NONE of them — so each
# raised `NameError` on reaching its line. Same class as the `logger` defect BUS-037 recorded
# in THIS FILE: a name the module docstring even mentions (`:115`) and that nothing bound.
# Fenced by `test_222_no_undefined_names.py`, which walks every module-level name rather
# than waiting for the next one.
from app.utils.db import aexec
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
    "McpDiscoverRequest",
    "McpDiscoverResponse",
]

from app.services.sources.base import SourceConnectionDisabled  # noqa: E402

router = APIRouter(prefix="/connectors", tags=["connectors"])

#: Fields of `preview_service.PreviewItem` that exist for the SERVER and never reach the wire.
#: ⛔ `source_path` is the only value that may be persisted into `metadata.source.path`, and it
#: is read from the server's own re-run of `build_preview` — never from a client (238 CR-01).
_PREVIEW_ITEM_SERVER_ONLY = frozenset({"source_path"})

# The ONE machine-readable reason code this router emits. It is deliberately NOT a member of
# `egress.REFUSAL_REASONS` — that frozenset is a CLOSED six-row table about DESTINATIONS
# (UI-SPEC §4c) and carries its own `len(...) == 6` assert. This code is about the PLATFORM:
# it renders UI-SPEC §4b moment 9, the refusal a person cannot fix (Save goes DISABLED, with
# `aria-describedby` → "Disabled because no encryption key is configured."). Keeping the two
# code spaces separate is what stops a platform problem from being worded as a host problem.
CIPHER_UNAVAILABLE_REASON = "no_encryption_key"

# ── BUG-260907-03 · a DISABLED connection reads nothing ──────────────────────────────────
# 409 CONFLICT, chosen and stated: the request is well-formed and the caller is entitled to it,
# but the resource is in a state that forbids it — and the person can fix that themselves by
# re-enabling. Not 404 (the connection exists and hiding it would be a lie), not 403 (this is
# not about permission), not 503 (nothing is broken).
#
# ⚠ It is raised by `SourceRegistry.get_adapter`, so this covers browse, preview, confirm and
# import through ONE handler rather than five try/excepts — the same reason the guard itself
# lives in the registry. A route added tomorrow inherits it.
CONNECTION_DISABLED_REASON = "connection_disabled"


def _disabled_connection_response(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "reason_code": CONNECTION_DISABLED_REASON,
            "message": str(exc),
        },
    )


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

# Phase 209 close / audit B-1 — an MCP connection has NO capability, so there is no adapter to
# check it with. This is a 409 stating a SHAPE fact, never a 500.
#
# ⚠ THE UI GUARD IS NOT THE FENCE. `ConnectionsTab.tsx:698` hid this control from the row menu
# with `!isMcp`, and `ConnectionFormPanel.tsx` — the SAME control, one file over — never took
# that decision, so the route was reachable from a shipped button. The route is reachable
# without any UI at all, so the refusal belongs HERE and the guard there is defence in depth.
_CHECK_NOT_AVAILABLE_FOR_MCP = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail={
        "reason_code": "check_not_available_for_mcp",
        "message": (
            "This is an MCP connection, so there is no credential check to run. Bind it to a "
            "step and use Discover tools to confirm the server answers."
        ),
    },
)

# ── Phase 211 (T-211-13 / T-211-13d) — the THIRD shape's two named refusals ──────────────
# A SERVICE-ONLY row names a service and no way to reach it: no adapter, no server URL, no
# credential (CONN-08 — the shape migration 127 makes storable). Both of the actions below
# reach code written for the other two shapes, and BOTH would otherwise report something
# untrue about it rather than merely declining.
#
# ⚠ THE PRECEDENT IS ONE FILE UP AND ONE SHAPE OVER. `_CHECK_NOT_AVAILABLE_FOR_MCP` exists
# because an MCP row's NULL `capability` reached `registry.get_adapter` and produced a BARE
# `KeyError` — an unhandled 500 on a control the shipped UI offered. A third shape reaches
# the same code by the same door. The lesson recorded there was *never a bare error, never a
# silent widening*, and these are that lesson applied before the 500 rather than after it.
_CHECK_NOTHING_TO_CHECK = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail={
        "reason_code": "nothing_to_check_yet",
        "message": (
            "This connection names a service but no way to reach it yet, so there is no "
            "credential to check."
        ),
    },
)

# ⚠ 409 AND NOT 502, AND THE DIFFERENCE IS THE WHOLE POINT. Without this the route's blanket
# `except Exception -> 502` renders the refusal as "MCP tool discovery failed: connection X is
# not configured with an mcp_server_url" — a BAD GATEWAY naming a shape the row never had,
# about a server that was never contacted. A person reading it goes looking for an outage that
# does not exist.
#
# ⚠ IT IS AN ERROR-MESSAGE CONTRACT, NOT A DEAD END TO BE DESIGNED AWAY. Nothing in Phase 211
# gives a service-only row a way to populate tools; OAuth (Phase 215) does. That is precisely
# why the sentence is "not yet" rather than a generic failure.
_NOTHING_TO_DISCOVER = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail={
        "reason_code": "nothing_to_discover_yet",
        "message": (
            "This connection names a service but no way to reach it yet, so there are no "
            "actions to list."
        ),
    },
)

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
def _provider_said(exc: Exception) -> str:
    """A remote-authored message, bounded and stripped, for a client-facing error (LO-05).

    ⚠ Control characters are removed rather than escaped: this lands in a JSON `detail` that
    a client renders as a sentence, and a raw `\r` or an ANSI escape in the middle of it is
    an untrusted string shaping a surface it does not own.
    """
    text = " ".join(str(exc).split())
    return (text[:300] + "…") if len(text) > 300 else (text or "nothing")


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

    ── WR-02 — the capability↔config mismatch is a 422, and it is deliberately NOT a 404 ──
    `ConnectorConnectionUpdate` carries no `capability` field (changing it would orphan the
    config shape and the stored secret in one edit), so the cross-field check runs in the
    service against the STORED capability and raises `ValueError`. It is mapped here rather
    than left to surface as a 500. A 422 leaks nothing: ownership has already been settled by
    the time the body is interpreted, so the caller already knows the row is theirs — the
    oracle the paragraph above protects against is created by ordering, not by this code.
    """
    try:
        return await connector_service.update_connection(
            connection_id, org_id=active_org, payload=body, supabase=supabase
        )
    except connector_service.ConnectorCipherUnavailable:
        raise _CIPHER_UNAVAILABLE
    except connector_service.ConnectorNotFound:
        raise _NOT_FOUND
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


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

    Phase 234 VIS-05 / D-4 Disconnect Freeze Policy:
    When a connection is disconnected / deleted:
    - All watches on the connection are deactivated (is_active = false).
    - All documents from this connection are marked source_state='source_disconnected',
      excluding them from match RPC queries while retaining them in the Library (VIS-03).
    """
    from uuid import UUID  # noqa: PLC0415
    from starlette.concurrency import run_in_threadpool  # noqa: PLC0415

    # 1. Org-scoped check: verify connection exists and belongs to caller's active org
    conn_res = await run_in_threadpool(
        lambda: supabase.table("connector_connections")
        .select("id")
        .eq("id", connection_id)
        .eq("org_id", active_org)
        .maybe_single()
        .execute()
    )
    if not conn_res or not conn_res.data:
        raise _NOT_FOUND

    # 2. VIS-05 / D-4: Disconnect freeze policy
    # Deactivate all watches on this connection
    try:
        from app.dependencies import get_pg_pool  # noqa: PLC0415
        pool = await get_pg_pool()
        if pool:
            async with pool.acquire() as con:
                await con.execute(
                    "UPDATE connector_watches SET is_active = false, updated_at = now() WHERE connection_id = $1::uuid",
                    UUID(str(connection_id)),
                )
    except Exception as pool_err:
        logger.warning("Failed to deactivate watches for connection %s: %s", connection_id, pool_err)

    # Freeze documents: source_state = 'source_disconnected' (retained in Library, VIS-03 / D-4)
    try:
        await run_in_threadpool(
            lambda: supabase.table("documents")
            .update({"source_state": "source_disconnected"})
            .eq("source_connection_id", connection_id)
            .execute()
        )
    except Exception as doc_err:
        logger.warning("Failed to mark documents source_disconnected for connection %s: %s", connection_id, doc_err)

    # 3. Delete connection record
    removed = await connector_service.delete_connection(
        connection_id, org_id=active_org, supabase=supabase
    )
    if not removed:
        raise _NOT_FOUND  # absent or another org's — never the forbidden status


# ── the OAuth arm of the credential check (Phase 221 plan 02) ────────────────────────────
#: Which service ids have per-application availability. A service absent from this map has
#: applications nobody can probe, and its check reports availability for none of them —
#: which is an EMPTY list, never six cheerful `ready`s.
_AVAILABILITY_PROBES_BY_SERVICE = frozenset({"google"})

#: The host a person is told we reached, per service. DATA, not a branch (D-238-09.3): this
#: line used to read `host="googleapis.com" if service_id == "google" else ""`, which put a
#: vendor literal in a comparison above `services/sources/adapters/` and gave every non-Google
#: OAuth connection a blank "reached ___" line. A dict answers "which hosts does a check name?"
#: with one grep; an if-ladder answers it with a reading.
#: ⚠ It is DISPLAY ONLY. The real destination fence is `egress.ALLOWED_HOST_SUFFIXES`, and a
#: service missing from here reaches exactly what it always did.
_CHECK_HOST_BY_SERVICE: dict[str, str] = {
    "google": "googleapis.com",
    "google_workspace": "googleapis.com",
    "microsoft": "graph.microsoft.com",
    "microsoft_graph": "graph.microsoft.com",
}


async def _check_oauth_connection(
    *,
    connection_id: str,
    active_org: str,
    service_id: str | None,
    token_status: dict,
    supabase: Client,
) -> ConnectorCheckResponse:
    """Check an OAuth connection, and say which of its applications will not work.

    ── WHAT "CHECKING" MEANS FOR THIS SHAPE ────────────────────────────────────────────
    Minting a fresh access token from the stored refresh token — the SAME call every tool
    makes. That is the property a green light has to be evidence for: not that a row exists,
    but that the credential a run will use still works. A check that proved anything less
    would be the *"green check on a credential somebody retyped"* the route's own docstring
    refuses.

    ── ⚠ THE PROVIDER'S RAW WORDS DO NOT TRAVEL HERE, AND THAT IS A NARROWING ──────────
    `provider_message` elsewhere on this route carries the vendor verbatim (071-A). This arm
    deliberately does not: `OAuthError` embeds the token endpoint's raw body, and the token
    endpoint is the one place a request body contains a refresh token. The revocation
    sentence is our own constant, the generic one is fixed, and the detail stays in the log.
    A verbatim rule written for a Slack error body should not be extended, unexamined, to a
    credential exchange.

    ── ⚠ AN UNAVAILABLE TOKEN IS `rejected`, NOT `unreachable` ─────────────────────────
    We reached Google and Google declined to renew. That is the same bucket a wrong password
    lands in, and the next step is the same one: reconnect. `unreachable` would point the
    person at their network.
    """
    from app.services.oauth_refresh_service import (  # deferred: keeps the import graph flat
        OAuthError,
        OAuthRevokedError,
        OAuthTokenUnavailable,
        get_fresh_access_token,
    )

    identity = token_status.get("account_email") or token_status.get("account_name")
    scopes = list(token_status.get("scopes") or [])

    ok = False
    bucket: str | None = None
    provider_message = ""

    try:
        token = await get_fresh_access_token(connection_id)
        ok = bool(token)
        if not ok:
            bucket = "rejected"
            provider_message = "The provider did not return an access token."
    except OAuthRevokedError:
        bucket = "rejected"
        provider_message = "This authorisation was revoked or has expired — reconnect it once."
    except (OAuthTokenUnavailable, OAuthError) as exc:
        logger.warning(
            "OAuth check failed for connection %s: %s", connection_id, type(exc).__name__
        )
        bucket = "rejected"
        provider_message = "The provider refused to renew this authorisation."
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "OAuth check could not reach the provider for %s: %s",
            connection_id, type(exc).__name__,
        )
        bucket = "unreachable"
        provider_message = "Could not reach the provider to renew this authorisation."

    # ⚠ THE PROBE RUNS ONLY ON A GOOD TOKEN. Six 401s tell nobody anything about six
    # applications — they restate the credential verdict six times in the wrong words. With
    # no token the list is EMPTY, and an empty list means "nothing was measured".
    availability: list[ApplicationAvailability] = []
    if ok and (service_id or "").strip().lower() in _AVAILABILITY_PROBES_BY_SERVICE:
        from app.services.google.availability import probe_google_applications

        availability = [
            ApplicationAvailability(**verdict)
            for verdict in await probe_google_applications(connection_id, scopes)
        ]

    verdict = "ok" if ok else "failed"
    settled = await connector_service.record_check_verdict(
        connection_id, org_id=active_org, verdict=verdict, supabase=supabase
    )

    return ConnectorCheckResponse(
        ok=ok,
        verdict=verdict,
        identity=identity,
        host=_CHECK_HOST_BY_SERVICE.get((service_id or "").strip().lower(), ""),
        port=None,
        checked_at=settled.last_checked_at,
        bucket=bucket,
        provider_message=provider_message,
        reason_code=None,
        application_availability=availability,
    )


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

    # Audit B-1 — refuse the MCP shape HERE, before `_check_destination` and `get_adapter` are
    # reached. `registry.get_adapter` raises a BARE `KeyError` for anything outside the closed
    # three-member capability set, and that `KeyError` is not in this route's `except` ladder
    # below — so an MCP row (whose `capability` is NULL by construction, mig 126) produced an
    # unhandled 500. Keyed on `mcp_server_url`, the same fact `connectionMark` resolves on, and
    # never on `capability is None` — a capability-less row that is ALSO not MCP is a different
    # defect and must not be silently absorbed by this arm.
    if connection.mcp_server_url:
        raise _CHECK_NOT_AVAILABLE_FOR_MCP

    # Phase 211 (T-211-13) — the THIRD shape, refused by name for the same reason and BEFORE
    # the same two calls. `_check_destination` would read an empty config and `get_adapter`
    # would raise its bare `KeyError` on a NULL capability — the identical 500 the arm above
    # exists to prevent, reached by a row that is neither of the two shapes it knows about.
    # ⚠ Keyed on the ABSENCE OF A CAPABILITY, after the MCP arm has already returned, so the
    # two refusals stay separately falsifiable and neither absorbs the other's shape.
    # ── Phase 221 plan 02 — THE THIRD SHAPE: an OAuth row, whose credential is a TOKEN ────
    #
    # ⚠ MEASURED 2026-09-01, AND IT IS WHY THIS ARM EXISTS. Every `oauth_byo` row in the
    # database carries `capability = NULL` and `mcp_server_url = NULL`, so a Google
    # connection with a live, refreshable token fell straight into the refusal below and
    # answered **409 "no way to reach it yet, so there is no credential to check"** — about a
    # connection that had just performed twenty-six tools. The refusal's own wording predates
    # OAuth: `connector_service`'s resolver still calls this a row with "no secret until OAuth
    # ships in Phase 215". OAuth shipped. The credential simply does not live in
    # `secret_ciphertext` — it lives in `connector_tokens`.
    #
    # ⚠ KEYED ON THE PRESENCE OF A TOKEN ROW, NOT ON `auth_type`. `ResolvedConnection` does
    # not carry `auth_type`, and more importantly the token row IS the credential: if one
    # exists there is something to check, and if none does the refusal below is still exactly
    # true. A genuinely service-only row (CONN-08 — named, never connected) is untouched.
    if not capability:
        # ⚠ IT RAISES, IT DOES NOT ONLY RETURN `None` — and an existing test caught this
        # arm getting that wrong. `get_oauth_token_status` performs its OWN org-scoped read
        # of the connection and raises `ConnectorNotFound` when that read comes back empty,
        # so an unguarded call turned `test_check_refuses_a_service_only_connection_by_name
        # _never_by_raising` from a clean 409 into an unhandled 500. That test's name is the
        # whole rule: this route refuses BY NAME, never by raising.
        #
        # ⚠ `ConnectorError` is the right WIDTH — the family this service raises to mean
        # "I cannot give you this row". A bare `except Exception` would swallow real faults;
        # anything narrower would let a sibling refusal through as a 500. Either way the
        # honest answer is the same: no OAuth token is visible here, so there is genuinely
        # nothing to check, which is exactly what the refusal below says.
        #
        # ⚠ THE SERVICE CLIENT, NOT THE USER'S — AND THIS IS A MEASURED NECESSITY, NOT A
        # SHORTCUT. `connector_tokens` has RLS **ENABLED WITH ZERO POLICIES** (verified
        # against the live schema 2026-09-01: `relrowsecurity = true`, `pg_policy` count
        # `0`). RLS with no policy denies everything, so the column-level SELECT grants
        # that `authenticated` holds on that table are decoration — a user-JWT read of it
        # returns EMPTY, always, for every row. That is why this arm answered 409 about a
        # connection holding a live token, and it is the same defect family migration 118
        # produced on `connector_connections`: a grant that looks right and a read that
        # cannot succeed.
        #
        # ⚠ IT WIDENS NOTHING, and each clause of that is checkable:
        #   · the route is `require_org_manage` — org admins only, API-enforced;
        #   · `resolve_connection` above has ALREADY proven this row belongs to `active_org`
        #     and raised `_NOT_FOUND` otherwise;
        #   · `get_oauth_token_status` re-applies `.eq("org_id", org_id)` ITSELF, so the org
        #     gate is inside the call as well as before it; and
        #   · the projection is non-secret metadata — `account_email`, `scopes`, `expires_at`.
        #     No ciphertext column is named, and `extra='forbid'` on the response model means
        #     none could travel if it were.
        # `oauth_refresh_service.get_valid_oauth_token` reads the same table the same way,
        # for the same reason, and says so in its own comment.
        #
        # ⚠ THE PROPER FIX IS AN RLS POLICY ON `connector_tokens`, AND IT IS NOT THIS PLAN'S
        # TO MAKE — this plan's fence forbids a migration, and a policy on a credential table
        # is an operator decision. Until it lands, `GET /connections/{id}/oauth/token` stays
        # broken for EVERY user (it 404s on rows that exist); see the seed.
        #
        # ⚠ THE CATCH IS BROAD ON PURPOSE, AND A NARROWER ONE WAS TRIED AND MEASURED WRONG.
        # The first cut caught only `ConnectorError`; the service client performs a REAL
        # HTTP call to Supabase, so an unresolvable host raises `httpx.ConnectError` right
        # through it and this route answered an unhandled **500** — on a control the shipped
        # UI offers, which is precisely the failure `test_check_refuses_a_service_only
        # _connection_by_name_never_by_raising` exists to prevent. That test caught it.
        #
        # ⚠ THE COST IS NAMED RATHER THAN HIDDEN: a transport failure here is
        # INDISTINGUISHABLE from "this row has no token", and both answer 409. That is a
        # real loss of resolution, and it is still the better trade — this route's contract
        # is *refuse by NAME, never by raising*, and a 500 tells the reader nothing at all.
        # The exception type is logged at WARNING so the cause is recoverable from the log,
        # which is where an infra fault belongs rather than in a user-facing sentence.
        try:
            token_status = await connector_service.get_oauth_token_status(
                str(connection_id), org_id=str(active_org)
            )
        except Exception as exc:  # noqa: BLE001 — see the note above
            logger.warning(
                "check: could not read OAuth token metadata for %s (%s) — refusing by name",
                connection_id, type(exc).__name__,
            )
            token_status = None
        if token_status is None:
            raise _CHECK_NOTHING_TO_CHECK
        return await _check_oauth_connection(
            connection_id=str(connection_id),
            active_org=str(active_org),
            service_id=connection.service_id,
            token_status=token_status,
            supabase=supabase,
        )

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


@router.post(
    "/connections/{connection_id}/discover",
    response_model=list[dict],
    dependencies=[Depends(require_org_manage)],
    summary="Refresh this connection's action list, whatever its shape",
)
async def discover_tools(
    connection_id: str,
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> list[dict]:
    """Refresh the connection's list of available actions and cache it on the row.

    Phase 206 (D-206-05) shipped this as *"discover tools from a remote MCP server"*, and that
    sentence stopped being true in Phase 211: a first-party CAPABILITY connection now refreshes
    here too, from the adapter's own declared input schema, **with no network call at all**.
    One control, one endpoint, both reachable shapes — which is what lets a stale action list
    self-heal in one click rather than needing a shape-specific button.

    ⚠ THE 502 IS NARROWED TO THE ARM THAT CAN ACTUALLY MEET A GATEWAY. A capability refresh
    contacts nothing, so reporting its failure as *bad gateway* would misname an internal fault
    as a remote one and send the reader hunting an outage. `ConnectorNothingToDiscover` and
    `ConnectorError` are therefore caught by name ahead of it.
    """
    try:
        return await connector_service.discover_connection_tools(
            str(connection_id), org_id=str(active_org), supabase=supabase
        )
    except connector_service.ConnectorNotFound:
        raise _NOT_FOUND
    except connector_service.ConnectorCipherUnavailable:
        raise _CIPHER_UNAVAILABLE
    except connector_service.ConnectorSecretNotEncrypted:
        raise _CREDENTIAL_UNREADABLE
    except connector_service.ConnectorDisabled:
        raise _CONNECTION_DISABLED
    # Phase 211 (T-211-13d) — the service-only shape, named. MUST stay above the two clauses
    # below, both of which would swallow it: `ConnectorNothingToDiscover` IS a `ConnectorError`.
    except connector_service.ConnectorNothingToDiscover:
        raise _NOTHING_TO_DISCOVER
    except connector_service.ConnectorError as exc:
        # A refusal this service raised about ITS OWN state. It is not a gateway failure and
        # must not wear a gateway's status: 409 is a conflict with the row as it stands.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"reason_code": "cannot_refresh_actions", "message": str(exc)},
        ) from exc
    except Exception as exc:
        # The REMOTE arm's failure, and only it: the MCP server was contacted and something
        # about that exchange went wrong.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MCP tool discovery failed: {exc}",
        ) from exc


@router.patch(
    "/connections/{connection_id}/grants",
    response_model=ConnectorConnectionResponse,
    dependencies=[Depends(require_org_manage)],
    summary="Update per-tool approval posture grants for a connection",
)
async def update_grants(
    connection_id: str,
    tool_grants: dict[str, ToolGrantPosture],
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> ConnectorConnectionResponse:
    """Phase 213 (GRANT-01) — Update per-tool approval posture grants.

    ⚠ S-1 (2026-08-27): `_sanitize_tool_grants` REFUSES a value it cannot express rather
    than coercing it onto the permissive one, so this path raises `ValueError` on any
    unrecognized value. It is mapped to a 422 here per the WR-02 convention used by
    `update_connection` above.
    """
    try:
        updated = await connector_service.update_connection_grants(
            str(connection_id),
            org_id=str(active_org),
            tool_grants=tool_grants,
            supabase=supabase,
        )
        # Phase 223 (GRANT-05 / SC#1a / D-223-01 / D-223-05): Permanent grant receipt via Settings
        try:
            actor_user_id = user.get("id") or user.get("sub")
            if actor_user_id:
                await write_audit_entry(
                    user_id=actor_user_id,
                    action_type="connector.grant",
                    metadata={
                        "connection_id": str(connection_id),
                        "source": "settings",
                        "tool_count": len(tool_grants),
                        "tool_grants": {k: str(v) for k, v in tool_grants.items()},
                    },
                    supabase=supabase,
                    org_id=str(active_org),
                )
        except Exception:  # noqa: BLE001 - audit write failure must not mask update success
            logger.warning("update_grants: failed to record connector.grant audit entry", exc_info=True)
        return updated
    except connector_service.ConnectorNotFound:
        raise _NOT_FOUND
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.post(
    "/discover-tools",
    response_model=McpDiscoverResponse,
    dependencies=[Depends(require_visible("live_connectors")), Depends(require_org_manage)],
    summary="Probe an arbitrary MCP server endpoint to discover tools before saving",
)
async def discover_tools_from_url(
    payload: McpDiscoverRequest,
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
) -> McpDiscoverResponse:
    """Pre-save interactive MCP tool discovery (CONN-06 / SEC-1).

    Opens a socket to the operator-supplied URL after egress validation and returns
    sanitized discovered tools (name, title, description, inputSchema, outputSchema).
    Protected by require_visible('live_connectors') and require_org_manage.
    """
    from app.services.mcp_client import list_tools, McpClientError

    try:
        tools = await list_tools(
            server_url=payload.mcp_server_url,
            secret=payload.secret,
            timeout=payload.timeout,
        )
        return McpDiscoverResponse(
            server_url=payload.mcp_server_url,
            tools=tools,
            count=len(tools),
        )
    except EgressRefused as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            # ⚠ `exc.detail` UNTIL 2026-09-01, AND IT DOES NOT EXIST. `EgressRefused.__init__`
            # assigns reason_code/host/capability/ip and nothing else — by design, so that no
            # body or secret can ride on it (its docstring: *"enforced by the signature, not
            # by discipline"*). Reading it raised `AttributeError` INSIDE this handler, so
            # every SSRF refusal on this route surfaced as a 500 instead of this 422. The
            # security sentence a person most needs was the only one that broke, and only on
            # the refusal path — which is why no test and no eye caught it. Found while
            # building Phase 222's sibling route; fenced by
            # `test_the_discover_tools_refusal_handler_reads_only_attributes_that_exist`.
            detail=f"Connection refused by security policy: {exc.reason_code}",
        ) from exc
    except McpClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MCP server probe failed: {exc}",
        ) from exc


@router.post(
    "/mcp/probe-auth",
    response_model=McpProbeAuthResponse,
    # ⚠ PER ENDPOINT, NEVER ROUTER-LEVEL — the invariant `main.py:782` records. This opens a
    # socket to an operator-supplied address, which is at least as write-shaped as the four
    # connector writes that carry the same pair; outside the kill switch it would be the one
    # egress path Phase 210's switch could not turn off.
    dependencies=[Depends(require_visible("live_connectors")), Depends(require_org_manage)],
    summary="Ask an MCP server how it wants to be authenticated, before anything is saved",
)
async def probe_mcp_server_auth(
    payload: McpProbeAuthRequest,
) -> McpProbeAuthResponse:
    """Phase 222 (SEED-237) — which door does this server need?

    The wire half of `services.mcp_auth_discovery`. Sends NO credential: the 401 it is
    reading is the expected answer, and a probe carrying a token would be handing it to a
    host nobody has yet decided to trust.
    """
    from app.services.mcp_auth_discovery import probe_mcp_auth

    try:
        probe = await probe_mcp_auth(payload.server_url)
    except EgressRefused as exc:
        # ⚠ A REFUSAL IS NOT A VERDICT ABOUT THE SERVER, and the two must not be flattened.
        # `422` here means *"we would not go there"*; a 200 with `kind="token"` means *"it
        # wants a credential"*. Collapsing them would tell somebody to find an API key for
        # an address we refused to contact.
        #
        # ⚠ `exc.reason_code` AND NOT `exc.detail`. Measured 2026-09-01: `EgressRefused`
        # defines `reason_code`/`host`/`capability`/`ip` and NO `detail`, so reading it
        # raises `AttributeError` INSIDE the handler and converts a clean 422 into a 500.
        # `discover_tools_from_url` above does exactly that at its own `except` and is
        # reported rather than patched here — it is Phase 212's route, not this one's.
        #
        # ⚠ AN OBJECT, NOT A SENTENCE (BUS-052) — and this was MY contract error, corrected
        # toward the promise rather than the promise toward it. `BUS-047` told the door it
        # would receive the `reason_code` from the CLOSED six-code set; this raised a plain
        # string, and `lib/api/connectors.ts:59` (`readConnectorReasonCode`) returns the code
        # ONLY for an object — `null` for a string. So the enumeration could not reach the
        # door AT ALL, and a door branching on it would have had to string-match English.
        # Each side green, the join dead: the Phase 204 shape §3.1 warns a split phase about.
        #
        # ⚠ THE STATUS STAYS 422 — `BUS-047`'s `400` was the wrong half of that sentence. The
        # sibling test pins 422 for a SEMANTIC reason: it means *"we would not go there"*,
        # while a 200 with `kind="token"` means *"it wants a credential"*.
        #
        # The shape is the one this module already uses at `update_grants` and
        # `_CHECK_NOTHING_TO_CHECK`; `probe-auth` was the only route spelling it differently.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "reason_code": exc.reason_code,
                "message": f"Connection refused by security policy: {exc.reason_code}",
            },
        ) from exc
    except EgressResponseTooLarge as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="That address returned more data than a metadata document should contain.",
        ) from exc

    return McpProbeAuthResponse(
        kind=probe.kind,
        authorization_host=probe.authorization_host,
        # ⚠ DERIVED HERE, so the endpoint URL itself never reaches the browser. `False` when
        # the server supports RFC 7591 dynamic registration (the operator supplies nothing);
        # `True` when they must bring a client id/secret to the shipped Phase 215 form.
        registration_required=(
            probe.kind == "oauth" and probe.registration_endpoint is None
        ),
        code_challenge_methods=probe.code_challenge_methods,
        detail=probe.detail,
        resource_status=probe.resource_status,
    )


@router.post(
    "/mcp/oauth/authorize",
    response_model=McpOAuthStartResponse,
    dependencies=[Depends(require_visible("live_connectors")), Depends(require_org_manage)],
    summary="Start OAuth against an MCP server's own discovered authorization server",
)
async def start_mcp_oauth(
    payload: McpOAuthStartRequest,
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> McpOAuthStartResponse:
    """Phase 222 (SEED-237) — the click that replaces pasting a token from a console.

    ⚠ THE ENDPOINTS ARE RE-DISCOVERED HERE, NOT ACCEPTED FROM THE CALLER. Anything the
    browser could name, the browser could redirect — and this request ends with our client
    secret being POSTed to whatever `token_endpoint` says.
    """
    from app.dependencies import get_redis
    from app.services.mcp_auth_discovery import probe_mcp_auth
    from app.services.mcp_oauth import begin_authorization
    from app.config import settings

    conn_res = await aexec(
        supabase.table("connector_connections")
        .select("id, mcp_server_url, config")
        .eq("id", str(payload.connection_id))
        .eq("org_id", str(active_org))
        .limit(1)
    )
    if not conn_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")

    row = conn_res.data[0]
    server_url = row.get("mcp_server_url")
    if not server_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This connection has no server address to sign in to.",
        )

    probe = await probe_mcp_auth(server_url)
    if probe.kind != "oauth" or not probe.authorization_endpoint or not probe.token_endpoint:
        # ⚠ NAMES WHICH DOOR IT IS, rather than reporting a generic failure. The three
        # non-oauth verdicts have different remedies and a person acts on the difference.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=probe.detail or "This server does not offer a sign-in we can use.",
        )

    cfg = row.get("config") or {}
    client_id = cfg.get("custom_client_id")
    # Read through the SERVICE role — the column is ungranted to `authenticated` (mig 150),
    # which is the entire point of it being a column rather than a config key.
    client_secret = await connector_service.read_oauth_client_secret(
        str(payload.connection_id), str(active_org)
    )
    # ⚠ REGISTER RATHER THAN REFUSE — the gap a LIVE DRIVE found, that none of this phase's
    # 47 tests could: every one of them supplies a client id, so the branch below was never
    # the interesting one. Driven against the real `mcp.notion.com` on 2026-09-01, which
    # advertises `registration_endpoint` and therefore needs NOTHING from a developer
    # console. Refusing here would have demanded a credential from the one service whose
    # whole appeal is that it does not need one — and Notion is the service this project has
    # been unable to connect since Phase 212.
    if not client_id and probe.registration_endpoint:
        from app.services.mcp_oauth import register_client

        registered = await register_client(
            probe.registration_endpoint,
            redirect_uri=f"{settings.backend_public_url.rstrip('/')}/connectors/mcp/oauth/callback",
            client_name="Agentic RAG",
        )
        client_id = registered.client_id
        client_secret = registered.client_secret
        # ⚠ PERSISTED, because re-registering on every Connect would mint a NEW application
        # at the vendor each time — litter in someone else's account, and a different
        # `client_id` on the token than on the consent that authorised it.
        #
        # ⚠ REUSES THE SHIPPED WRITER RATHER THAN A NEW ONE. `store_oauth_client_credentials`
        # already puts the id in `config` and the secret in its own ungranted column, sweeps
        # any legacy plaintext `custom_client_secret` out of `config` on every write, and
        # scopes the update by `org_id`. A second writer here would have had to re-earn all
        # four of those, and the first draft of this block called two helpers that DO NOT
        # EXIST — the Phase 212 D-2 defect, where a seam stub invented a parameter the real
        # function lacked. Checked against the real signature instead of assumed.
        await connector_service.store_oauth_client_credentials(
            str(payload.connection_id),
            str(active_org),
            client_id=client_id,
            client_secret=client_secret,
        )

    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "This server needs an application to sign in with, it does not offer to "
                "create one, and none is saved for this connection yet."
            ),
        )

    # ⚠ BYTE-IDENTICAL TO THE ONE THE CALLBACK REBUILDS. The provider compares the two and
    # answers `redirect_uri_mismatch`, which names neither setting — Phase 215 recorded that
    # exact trap, and `backend_public_url` exists because the frontend URL answered 200 with
    # Vite's SPA fallback and silently dropped the code.
    redirect_uri = f"{settings.backend_public_url.rstrip('/')}/connectors/mcp/oauth/callback"

    authorize_url, _handle = await begin_authorization(
        get_redis(),
        authorization_endpoint=probe.authorization_endpoint,
        token_endpoint=probe.token_endpoint,
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scopes=None,
        server_url=server_url,
        connection_id=str(payload.connection_id),
        user_id=str(user.get("id") or user.get("sub") or ""),
        org_id=str(active_org),
    )
    return McpOAuthStartResponse(
        authorize_url=authorize_url,
        authorization_host=probe.authorization_host,
    )


@router.get(
    "/mcp/oauth/callback",
    summary="Return leg of the MCP OAuth consent",
)
async def mcp_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None),
) -> RedirectResponse:
    """Phase 222 — the vendor sends the person back here.

    ⚠ NO AUTH DEPENDENCY, AND THAT IS CORRECT RATHER THAN AN OMISSION: this is a browser
    redirect arriving from a third party with no JWT. What replaces it is stronger than a
    header — the org and user were bound into the pending record at authorize time, under
    an authenticated `require_org_manage` request, and `state` is a single-use random handle
    that resolves to that record. Nothing here trusts a value the caller supplied.
    """
    from redis.exceptions import RedisError
    from app.dependencies import get_redis
    from app.services.mcp_oauth import McpOAuthError, complete_authorization
    from app.config import settings, primary_frontend_origin

    frontend_url = primary_frontend_origin()  # BUG-260904-04: FRONTEND_URL is a LIST

    # ⚠ `error_description` IS LOGGED AND NEVER PUT IN THE REDIRECT. It is attacker-supplied
    # text from an untrusted authorization server; reflecting it into a URL the browser then
    # renders is how a refusal becomes an injection.
    if error:
        logger.warning("mcp oauth: consent returned %s (%s)", error, error_description)
        return RedirectResponse(url=f"{frontend_url}/app?connections=1&oauth_error={error}")

    if not code or not state:
        return RedirectResponse(
            url=f"{frontend_url}/app?connections=1&oauth_error=missing_code_or_state"
        )

    try:
        redis_client = get_redis()
        tokens, pending = await complete_authorization(redis_client, handle=state, code=code)
    except (RedisError, ConnectionError, TimeoutError, OSError) as exc:
        logger.error("mcp oauth: redis outage during authorization: %s", exc)
        return RedirectResponse(
            url=f"{frontend_url}/app?connections=1&oauth_error=redis_unavailable",
            status_code=307,
        )
    except (McpOAuthError, EgressRefused) as exc:
        logger.warning("mcp oauth: could not complete the connection: %s", exc)
        return RedirectResponse(url=f"{frontend_url}/app?connections=1&oauth_error=exchange_failed")

    scope_str = tokens.get("scope", "")
    await connector_service.save_oauth_tokens(
        connection_id=pending.connection_id,
        org_id=pending.org_id,
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token"),
        token_type=tokens.get("token_type", "Bearer"),
        scopes=scope_str.split() if isinstance(scope_str, str) else [],
        expires_in=tokens.get("expires_in", 3600),
        # ⚠ NO PROFILE FETCH. The Phase 215 path calls `fetch_account_profile` against a
        # known vendor's identity endpoint; there is no such endpoint here, and inventing
        # one would mean sending the fresh token to a URL this server also chose. The
        # account name stays unknown rather than guessed.
        account_email=None,
        account_name=None,
    )
    return RedirectResponse(url=f"{frontend_url}/app?connections=1&oauth_connected=1")


# ── Phase 215 (OAUTH-01..03) · BYO OAuth Endpoints ──────────────────────────────
@router.post(
    "/oauth/authorize",
    response_model=OAuthAuthorizeResponse,
    dependencies=[Depends(require_visible("live_connectors")), Depends(require_org_manage)],
    summary="Generate OAuth authorization URL with PKCE and signed state",
)
async def create_oauth_authorize_url(
    payload: OAuthAuthorizeRequest,
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> OAuthAuthorizeResponse:
    """Phase 215 (OAUTH-01, OAUTH-02) — Generate PKCE authorization URL for Google / Microsoft."""
    from app.services.oauth_service import build_authorization_url
    from app.config import settings, primary_frontend_origin

    frontend_url = primary_frontend_origin()  # BUG-260904-04: FRONTEND_URL is a LIST
    # ⚠ THE BACKEND, NOT THE FRONTEND. This route is `GET /connectors/oauth/callback` on
    # THIS service; the frontend has no router and no dev proxy, so the old value pointed
    # Google at Vite's SPA fallback, which answered 200 and did nothing with the code.
    redirect_uri = f"{settings.backend_public_url.rstrip('/')}/connectors/oauth/callback"

    cid = payload.custom_client_id
    csec = payload.custom_client_secret

    # ⚠ BUG-260903-02 — THE OWNERSHIP GATE, AND IT IS UNCONDITIONAL ON PURPOSE. Until this
    # existed, `payload.connection_id` was taken on trust: the only org-scoped read in this
    # route was the OPTIONAL stored-config lookup below, whose miss is non-fatal and which
    # does not even run when the caller supplies both credentials inline. So a caller in
    # org X could name a connection belonging to org Y, complete consent with their own
    # account, and the callback would write THEIR tokens onto the victim's connector.
    # Pre-existing since Phase 215; found by the security review of the Phase 225 diff.
    #
    # This is the shape the MCP authorize route above already used (`.eq("org_id", …)` →
    # 404) — the provider pair is being brought to the same standard, not given a new rule.
    # 404 rather than 403: a connection the caller's org does not own is one they must not
    # learn the existence of.
    if payload.connection_id:
        owned = await aexec(
            supabase.table("connector_connections")
            .select("id")
            .eq("id", str(payload.connection_id))
            .eq("org_id", str(active_org))
            .limit(1)
        )
        if not owned.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
            )

    # ⚠ THE READ-BACK USED TO BE THE ONLY HALF OF THIS THAT EXISTED, AND NOTHING EVER
    # WROTE WHAT IT READ. The operator entered a Google client id and secret, pressed
    # Connect, and was asked for them again — because `configFromDraft` never persisted
    # them, so this lookup found `config = {"headers": {}}` and
    # `resolve_client_credentials` raised. Reproduced through the live API on 2026-08-31:
    # HTTP 422, "OAuth credentials not configured for provider 'google'". Silent refresh
    # (OAUTH-02) reads the same absent value, so it could not have worked either.
    #
    # ⚠ THE SECRET IS READ THROUGH THE SERVICE ROLE AND NEVER THROUGH `supabase`. Its
    # column is ungranted to `authenticated` (migration 150), which is the point of it
    # having a column at all — a user-JWT client must not be able to name it.
    if (not cid or not csec) and payload.connection_id:
        try:
            conn_res = await aexec(
                supabase.table("connector_connections")
                .select("config")
                .eq("id", str(payload.connection_id))
                .eq("org_id", str(active_org))
                .limit(1)
            )
            if conn_res.data:
                cfg = conn_res.data[0].get("config") or {}
                cid = cid or cfg.get("custom_client_id")
        except Exception:
            logger.warning(
                "oauth authorize: could not read the stored client id for connection %s",
                payload.connection_id, exc_info=True,
            )
        if not csec:
            csec = await connector_service.read_oauth_client_secret(
                str(payload.connection_id), str(active_org)
            )

    # Persist what the person just typed, so the NEXT Connect and every silent refresh
    # can find it. Only on the way in, and only when they supplied it: a blank field must
    # never overwrite a stored credential with nothing.
    if payload.connection_id and (payload.custom_client_id or payload.custom_client_secret):
        try:
            await connector_service.store_oauth_client_credentials(
                str(payload.connection_id),
                str(active_org),
                client_id=payload.custom_client_id,
                client_secret=payload.custom_client_secret,
            )
        except Exception:
            # The authorization can still proceed on the values in hand; what is lost is
            # only the ability to do it again without retyping. Saying so beats failing.
            logger.warning(
                "oauth authorize: could not persist client credentials for connection %s",
                payload.connection_id, exc_info=True,
            )

    from app.dependencies import get_redis

    try:
        auth_url, state = await build_authorization_url(
            provider=payload.provider,
            connection_id=payload.connection_id,
            user_id=user["id"],
            org_id=str(active_org),
            redirect_uri=redirect_uri,
            redis=get_redis(),
            custom_client_id=cid,
            custom_client_secret=csec,
            custom_scopes=payload.custom_scopes,
        )
        return OAuthAuthorizeResponse(authorization_url=auth_url, state=state)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:
        # A-3: fail-closed 503 if Redis / state store is unavailable
        logger.error("oauth authorize: failed to park authorization state: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication state store is currently unavailable. Please try again.",
        ) from exc


@router.get(
    "/oauth/callback",
    summary="OAuth authorization callback endpoint",
)
async def oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None),
) -> RedirectResponse:
    """Phase 215 (OAUTH-02) — Verify signed state, exchange code for tokens, encrypt, and redirect to settings."""
    from redis.exceptions import RedisError
    from app.dependencies import get_redis
    from app.services.oauth_state import OAuthStateError, take_pending_state
    # ⚠ `verify_oauth_state`, `resolve_client_credentials` and `OAuthSigningKeyUnavailable` were
    # imported here ONLY for the legacy HMAC fallback deleted below; they are dead on this path
    # now. They remain exported from `oauth_service` for the cutover tests.
    from app.services.oauth_service import (
        exchange_code_for_tokens,
        fetch_account_profile,
    )
    from app.config import settings, primary_frontend_origin

    frontend_url = primary_frontend_origin()  # BUG-260904-04: FRONTEND_URL is a LIST

    if error:
        logger.warning("OAuth authorization returned error: %s (%s)", error, error_description)
        return RedirectResponse(url=f"{frontend_url}/app?connections=1&oauth_error={error}")

    if not code or not state:
        return RedirectResponse(url=f"{frontend_url}/app?connections=1&oauth_error=missing_code_or_state")

    code_verifier = None
    client_id = None
    client_secret = None
    provider = None
    connection_id = None
    # BUG-260903-02 — the org bound at authorize time, under an authenticated request. It
    # stays `None` on the legacy HMAC path below, which carried no org and sunsets with it.
    pending_org_id: str | None = None

    try:
        redis_client = get_redis()
        pending = await take_pending_state(redis_client, state, expected_flow="provider")
        provider = pending.provider
        connection_id = pending.connection_id
        code_verifier = pending.code_verifier
        client_id = pending.client_id
        client_secret = pending.client_secret
        pending_org_id = pending.org_id
    except (RedisError, ConnectionError, TimeoutError, OSError) as exc:
        logger.error("oauth callback: redis outage during state lookup: %s", exc)
        return RedirectResponse(
            url=f"{frontend_url}/app?connections=1&oauth_error=redis_unavailable",
            status_code=307,
        )
    except OAuthStateError:
        # ⛔ THE LEGACY HMAC FALLBACK IS DELETED (operator, 2026-09-07 — past its own sunset).
        #
        # What stood here: an `if "." in state:` arm that called `verify_oauth_state(state)` and
        # accepted a Phase-224 HMAC-signed blob, carrying the comment *"delete after the first
        # prod deploy has been live 24 h"*. That deploy went live 2026-09-04; nothing deleted it.
        #
        # Why it went NOW rather than at the next tidy-up — it was an unauthenticated forgery
        # surface, and two independent defects had to line up for it to be safe:
        #   1. `_get_signing_key()` ended in `or "default-oauth-state-secret"`. `jwt_secret` is
        #      NOT a declared setting, and `secrets_encryption_key` defaults to `""` with a
        #      key-less install being supported (D-150-01) — so on such an install the HMAC key
        #      was A STRING PUBLISHED IN THIS REPOSITORY.
        #   2. This route takes no JWT and has no auth dependency.
        #   Together: any unauthenticated caller could forge state naming a victim's
        #   `connection_id` and have their own provider tokens written onto that connector —
        #   the exact attack `BUG-260903-02` was written to close.
        # A third, quieter one: this arm never set `pending_org_id`, so it also short-circuited
        # that very cross-org gate below (`if pending_org_id is not None and ...`).
        #
        # ⭐ Deleting the branch removes all three at once, which is why it beats patching them.
        # `_get_signing_key` was ALSO made fail-closed in the same change — belt and braces, since
        # `verify_oauth_state` remains importable for the cutover tests that still pin it.
        #
        # An in-flight legacy consent now lands here and is refused like any expired handle. That
        # is correct: those blobs carry a 600 s TTL and the cutover is days past.
        #
        # A-4: log length, not content.
        logger.warning("oauth callback: invalid or expired opaque handle (len=%d)", len(state))
        return RedirectResponse(url=f"{frontend_url}/app?connections=1&oauth_error=invalid_or_expired_state")

    try:
        # ⚠ MUST BE BYTE-IDENTICAL TO THE ONE SENT ON AUTHORIZE. The provider compares them
        # and answers `redirect_uri_mismatch`, which names neither setting.
        redirect_uri = f"{settings.backend_public_url.rstrip('/')}/connectors/oauth/callback"
        token_data = await exchange_code_for_tokens(
            provider=provider,
            code=code,
            code_verifier=code_verifier,
            redirect_uri=redirect_uri,
            client_id=client_id,
            client_secret=client_secret,
        )

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        token_type = token_data.get("token_type", "Bearer")
        scope_str = token_data.get("scope", "")
        scopes = scope_str.split() if isinstance(scope_str, str) else []

        profile = await fetch_account_profile(provider, access_token)

        # If a connection_id was supplied, update its tokens
        if connection_id:
            from app.services import connector_service
            from app.dependencies import get_supabase

            srv_client = get_supabase()
            # Fetch connection org_id
            conn_res = srv_client.table("connector_connections").select("org_id").eq("id", str(connection_id)).execute()
            if conn_res.data:
                org_id = conn_res.data[0]["org_id"]
                # ⚠ BUG-260903-02 — THE SECOND HALF, AND IT IS NOT REDUNDANT WITH THE
                # AUTHORIZE GATE. This route has no JWT at all: it is a browser redirect
                # from a third party, and its entire authority is the pending record. The
                # row above is read through the SERVICE ROLE, so RLS cannot speak here —
                # the only thing that can is the org bound at authorize time. If they
                # disagree, refuse rather than write: a mismatch means the row is not the
                # one this handshake was started for.
                #
                # `pending_org_id is None` is the in-flight legacy HMAC state, which never
                # carried an org; it is accepted for the announced 24 h and this check
                # sunsets with that branch.
                if pending_org_id is not None and str(org_id) != str(pending_org_id):
                    logger.error(
                        "[oauth-cross-org-refused] connection %s belongs to a different org "
                        "than the pending authorization; no tokens written",
                        connection_id,
                    )
                    return RedirectResponse(
                        url=f"{frontend_url}/app?connections=1&oauth_error=invalid_or_expired_state"
                    )
                await connector_service.save_oauth_tokens(
                    connection_id=connection_id,
                    org_id=org_id,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_type=token_type,
                    scopes=scopes,
                    expires_in=expires_in,
                    account_email=profile.get("email"),
                    account_name=profile.get("name"),
                    supabase=srv_client,
                )

        target_url = f"{frontend_url}/app?connections=1&oauth_connected=1"
        if connection_id:
            target_url += f"&id={connection_id}"
        return RedirectResponse(url=target_url)

    except Exception as exc:
        logger.exception("OAuth callback processing failed: %s", exc)
        return RedirectResponse(url=f"{frontend_url}/app?connections=1&oauth_error=token_exchange_failed")


@router.get(
    "/connections/{connection_id}/oauth/token",
    response_model=OAuthTokenResponse,
    dependencies=[Depends(require_org_manage)],
    summary="Get public OAuth token status and expiration for a connection",
)
async def get_connection_oauth_token_status(
    connection_id: str,
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> OAuthTokenResponse:
    """Phase 215 (OAUTH-01) — Safe public metadata about a connection's OAuth tokens (no secrets!)."""
    try:
        row = await connector_service.get_oauth_token_status(
            connection_id=str(connection_id),
            org_id=str(active_org),
            supabase=supabase,
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No OAuth tokens found for connection")
        return OAuthTokenResponse(**row)
    except connector_service.ConnectorNotFound:
        raise _NOT_FOUND


@router.get(
    "/connections/{connection_id}/files",
    summary="List browseable files in connected cloud storage (ATTACH-01)",
)
async def list_connection_files(
    connection_id: str,
    query: str | None = None,
    page_token: str | None = None,
    page_size: int = 30,
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Phase 216 / Phase 232 (ATTACH-01 / SRC-01): Browse files in cloud storage."""
    from app.services.sources.import_service import browse_connection_files

    conn = await connector_service.get_connection(
        connection_id=str(connection_id),
        org_id=str(active_org),
        supabase=supabase,
    )
    if not conn:
        raise _NOT_FOUND

    try:
        res = await browse_connection_files(conn, query=query, page_token=page_token, page_size=page_size)
        return res
    # ⚠ BEFORE the broad handler below — see the note on the preview route (BUG-260907-03).
    except SourceConnectionDisabled as exc:
        raise _disabled_connection_response(exc) from None
    except Exception as exc:
        logger.error("Failed to list files from connection %s: %s", connection_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cloud storage provider returned an error: {exc}",
        )


@router.post(
    "/connections/{connection_id}/files/{file_id}/import",
    summary="Import one named file from connected cloud storage (ATTACH-01)",
)
async def import_connection_file(
    connection_id: str,
    file_id: str,
    body: ConnectionFileImportRequest,
    background_tasks: BackgroundTasks,
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Phase 216 / Phase 232 (ATTACH-01 / SRC-01): User-initiated single file import.

    ⛔ **THE "NOBODY CHOSE A FOLDER" REFUSAL IS ENFORCED BY THE MODEL, NOT BY A BRANCH HERE**
    (Phase 244 / D-244-06). ``ConnectionFileImportRequest.folder_id`` is a REQUIRED ``str`` on a
    ``extra="forbid"`` base, so FastAPI answers 422 before this function runs. ⛔ Do NOT
    "helpfully" add a root fallback: landing a named file somewhere nobody asked for IS
    `BUG-260905-01`, and a fallback added here would pass every test in
    ``test_244_import_destination_required.py`` except the one that reads this source.
    """
    from app.services.sources.import_service import import_single_file

    conn = await connector_service.get_connection(
        connection_id=str(connection_id),
        org_id=str(active_org),
        supabase=supabase,
    )
    if not conn:
        raise _NOT_FOUND

    try:
        return await import_single_file(
            connection=conn,
            file_id=file_id,
            user_id=user["id"],
            active_org=str(active_org),
            background_tasks=background_tasks,
            supabase=supabase,
            folder_id=body.folder_id,
        )
    # ⚠ BEFORE the broad handler below, which turns anything it catches into a 502 "the
    # provider returned an error". A disabled connection is not a provider error, and wording
    # it that way is how a control that failed to stop something reads as Microsoft's fault
    # (BUG-260907-03).
    except SourceConnectionDisabled as exc:
        raise _disabled_connection_response(exc) from None
    except Exception as exc:
        logger.error("Failed to fetch file %s from connection %s: %s", file_id, connection_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to download cloud file: {exc}",
        )


@router.post(
    "/connections/{connection_id}/preview",
    response_model=SourcePreviewResponse,
    summary="See exactly what bringing a source folder in would do (PREV-01 / PREV-03)",
)
async def preview_source_folder(
    connection_id: str,
    body: SourcePreviewRequest,
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> SourcePreviewResponse:
    """Phase 233 (PREV-01 / PREV-03 / LIB-09): the read-only half of the diff pass.

    ⛔ **THIS ROUTE WRITES NOTHING** — no document row, no chunk, no ingestion job, no folder, and
    no audit entry that reads like an import. Its `wrote` field is four literal zeros and the
    surface prints that sentence in its footer, so *"nothing has been written yet"* is a receipt
    rather than a promise.

    ⚠ It is a `POST` because it takes a body, not because it changes anything. The writing door is
    `/preview/confirm`, and it is a different route on purpose.
    """
    from app.services.sources import preview_service

    conn = await connector_service.get_connection(
        connection_id=str(connection_id),
        org_id=str(active_org),
        supabase=supabase,
    )
    if not conn:
        raise _NOT_FOUND

    try:
        preview = await preview_service.build_preview(
            connection=conn,
            folder_id=body.folder_id,
            folder_name=body.folder_name,
            user_id=user["id"],
            supabase=supabase,
            destination_folder_name=body.destination_folder_name,
            recursive=body.recursive,
        )
    # ⚠ BEFORE the broad handler below, which turns anything it catches into a 502 "the
    # provider returned an error". A disabled connection is not a provider error, and wording
    # it that way is how a control that failed to stop something reads as Microsoft's fault
    # (BUG-260907-03).
    except SourceConnectionDisabled as exc:
        raise _disabled_connection_response(exc) from None
    except Exception as exc:
        logger.error("Failed to preview connection %s: %s", connection_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Source provider returned an error while listing: {exc}",
        )

    return SourcePreviewResponse(
        folder_id=preview.folder_id,
        folder_name=preview.folder_name,
        # ⛔ `source_path` IS SERVER-ONLY AND IS DROPPED HERE ON PURPOSE (238 CR-01).
        #
        # It is the value that may be persisted into `metadata.source.path`, where a
        # classification rule reads it. Putting it on the wire would invite the next confirm
        # door to accept it back from a client — which is the caller-controlled-provenance half
        # of CR-01 re-opened by a different route. The confirm endpoint re-runs `build_preview`
        # server-side and reads `item.source_path` from THAT, never from a request body.
        #
        # ⚠ `SourcePreviewItem` is `extra="forbid"`, so this filter is load-bearing rather than
        #   tidy: without it the whole preview endpoint 500s.
        items=[
            SourcePreviewItem(
                **{k: v for k, v in asdict(i).items() if k not in _PREVIEW_ITEM_SERVER_ONLY}
            )
            for i in preview.items
        ],
        counts=preview.counts,
        total=preview.total,
        truncated=preview.truncated,
        stopped_by=preview.stopped_by,
        folders_scanned=preview.folders_scanned,
        recursive=preview.recursive,
        wrote=preview.wrote,
    )


@router.post(
    "/connections/{connection_id}/preview/confirm",
    response_model=SourceConfirmResponse,
    summary="Bring in exactly what the preview said would be brought in (PREV-02 / LIB-09)",
)
async def confirm_source_preview(
    connection_id: str,
    body: SourcePreviewRequest,
    background_tasks: BackgroundTasks,
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> SourceConfirmResponse:
    """Phase 233 (PREV-02 / LIB-09 / SC#4 / SC#5): the only door in this pair that writes.

    ⭐ It re-runs the SAME classifier the preview ran, so the counts a person confirmed against and
    the counts that happen cannot come from two code paths that drift. Every file ends at exactly
    one of `added` / `here` / `refused`, and a refusal carries its **cause by name**.
    """
    from app.services.sources import preview_service

    conn = await connector_service.get_connection(
        connection_id=str(connection_id),
        org_id=str(active_org),
        supabase=supabase,
    )
    if not conn:
        raise _NOT_FOUND

    try:
        result = await preview_service.confirm_preview(
            connection=conn,
            folder_id=body.folder_id,
            folder_name=body.folder_name,
            user_id=user["id"],
            active_org=str(active_org),
            supabase=supabase,
            background_tasks=background_tasks,
            destination_folder_id=body.destination_folder_id,
            destination_folder_name=body.destination_folder_name,
            recursive=body.recursive,
            only_external_ids=body.only_external_ids,
        )
    # ⚠ BEFORE the broad handler below, which turns anything it catches into a 502 "the
    # provider returned an error". A disabled connection is not a provider error, and wording
    # it that way is how a control that failed to stop something reads as Microsoft's fault
    # (BUG-260907-03).
    except SourceConnectionDisabled as exc:
        raise _disabled_connection_response(exc) from None
    except Exception as exc:
        logger.error("Failed to confirm preview for connection %s: %s", connection_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Source provider returned an error while importing: {exc}",
        )

    return SourceConfirmResponse(
        outcomes=[SourceConfirmOutcome(**asdict(o)) for o in result.outcomes],
        accounted=result.accounted,
        unaccounted=result.unaccounted,
        preview_said_added=result.preview_said_added,
        actually_added=result.actually_added,
    )


#: Registered source families that must never be OFFERED to a person, whatever the registry
#: holds. `mock_source` exists so the conformance suite can prove a family is data; it serves
#: canned bytes and would be a live-looking option in a production dropdown.
#:
#: ⚠ MEASURED 2026-09-07: Phase 232's D-232-03 recorded a `VITE_ENABLE_MOCK_SOURCES` / dev-mode
#: gate for this, and `grep -rn "mock_source" frontend/src` finds it in TESTS ONLY — no such
#: gate shipped. It never mattered while the client's own predicate was `includes("google")`,
#: which excluded the mock by accident. Publishing the registry removes that accident, so the
#: exclusion is made explicit here, on the server, where it cannot be widened by a UI edit.
_NEVER_OFFERED_SOURCE_FAMILIES = frozenset({"mock_source"})


@router.get(
    "/source-families",
    summary="Which source families have a registered adapter (SRC-03 / D-238-08)",
)
async def list_source_families(
    user: dict = Depends(get_current_user),
):
    """Publish `SourceRegistry`'s keys so the client stops guessing which connections can browse.

    ⭐ WHY THIS ROUTE EXISTS, in `ConnectedSourceSection.tsx`'s own words before Phase 238:

        *"The server's SourceRegistry is the authority and there is no endpoint that publishes
        its list, so this filter is the client's honest approximation of it... When a second
        family lands (Microsoft Graph, Phase 238), this predicate is the thing to widen, and
        widening it by guess is how a dead option appears in a dropdown."*

    Two copies of `id.includes("google") || includes("workspace") || includes("drive")` decided
    which connections could be browsed and watched. Adding `|| includes("microsoft")` would have
    satisfied this phase and left Phase 239's MCP family needing the same edit again — the
    milestone's *"adding a source is rows, not code"* constraint, falsified on the frontend.

    ⛔ It is a CAPABILITY list, not a connection list: it says which families the server can
    read, never which connections a caller may see. Connection visibility stays with
    `/connections`, org-scoped, unchanged.
    """
    from app.services.sources.base import SourceRegistry

    return {
        "families": sorted(
            f for f in SourceRegistry.list_supported_services()
            if f not in _NEVER_OFFERED_SOURCE_FAMILIES
        )
    }


@router.get(
    "/connections/{connection_id}/browse",
    summary="Browse folder hierarchy in connected cloud source (SRC-02)",
)
async def browse_connection_hierarchy(
    connection_id: str,
    folder_id: str | None = None,
    page_token: str | None = None,
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Phase 232 (SRC-02): Hierarchical browse for connected source drives and folders."""
    from app.services.sources.base import SourceConnectionDisabled, SourceRegistry

    conn = await connector_service.get_connection(
        connection_id=str(connection_id),
        org_id=str(active_org),
        supabase=supabase,
    )
    if not conn:
        raise _NOT_FOUND

    # ⚠ OUTSIDE the try/except below ON PURPOSE. That block turns anything it catches into a
    # 502 "the provider returned an error", and a disabled connection is not a provider error —
    # wording it that way is how a control that failed to stop something reads as the provider's
    # fault (BUG-260907-03).
    try:
        adapter = SourceRegistry.get_adapter(conn)
    except SourceConnectionDisabled as exc:
        raise _disabled_connection_response(exc) from None
    if not adapter:
        return {"items": [], "next_page_token": None}

    try:
        page = await adapter.browse(conn, folder_id=folder_id, page_token=page_token)
        items = [
            {
                "id": node.id,
                "name": node.name,
                "kind": node.kind,
                "drive_id": node.drive_id,
                "parent_id": node.parent_id,
                "has_children": node.has_children,
            }
            for node in page.items
        ]
        return {
            "items": items,
            "next_page_token": page.next_page_token,
        }
    except Exception as exc:
        logger.error("Failed to browse hierarchy for connection %s: %s", connection_id, exc)
        # ⚠ LO-05 — THE TAIL OF THIS STRING IS AUTHORED BY THE REMOTE SERVER.
        # `mcp_source._error_text` truncates its own `isError` text to 300 chars, but every
        # OTHER exception reaching here interpolates unbounded, and control characters can
        # reach a client surface. Not XSS in React, but an untrusted string in a message a
        # person reads as ours — so the app's sentence is fixed, the server's is bounded and
        # explicitly attributed, and neither can be mistaken for the other.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Source provider browse returned an error. The provider said: "
                + _provider_said(exc)
            ),
        )


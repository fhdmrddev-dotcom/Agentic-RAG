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
    ConnectorConnectionCreate,
    ConnectorConnectionResponse,
    ConnectorConnectionUpdate,
)
from app.services import connector_service

# Re-exported so the falsification suite can construct request bodies as
# `connectors.ConnectorConnectionCreate(...)` without importing two modules.
__all__ = [
    "router",
    "CIPHER_UNAVAILABLE_REASON",
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

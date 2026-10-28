"""Phase 299 (LINK-04 / D-06..D-11 / D-33..D-35) — may the caller open this item, and where?

One read-only question for a link to a thread, a workflow, a run or an Expert: may the signed-in
caller open it in ANY org they belong to, and if so which org is it in, what is it called and who
else would a link to it open for. ``app.api.links`` is the thin route over this module.

**Security posture** (copied from ``app.api.org_items``, then narrowed to this question).

  * ONE constant statement per kind (``SQL_BY_KIND``). Within a kind, a nonexistent id and an id
    the caller may not open run the SAME statement with the SAME arguments and both read ``None``
    — so the route can answer both with one byte-identical 404 (D-08, no existence oracle).
  * The caller's membership is evaluated INSIDE the statement, through ``org_members`` (pool kinds)
    or through RLS's ``current_user_org_ids()`` (RLS kinds). The ``X-Org-Id`` header is never
    read: a link opens in whichever of the caller's orgs the item lives in (D-11). This module
    never imports the 400-ing active-org gate, the capability gate or the 403-ing visibility gate.
  * No INSERT, UPDATE, DELETE or audit event. No new SQL function, so no new PUBLIC grant.

**Which connection each kind runs on — and why two of them are POOL kinds** (planner corrections,
measured against ``supabase/full-schema.sql`` on 2026-10-28):

  * thread, workflow — ``get_user_pg_connection`` (``SET LOCAL ROLE authenticated`` + the caller's
    claims). Their RLS SELECT policies ARE their read rules (``"Users can view their own threads"``;
    ``"Users can view own and global workflow definitions"``), so the explicit predicates below say
    the same thing again and RLS still holds the line if they were ever wrong.
  * P1 — RUN. The ``workflow_runs`` SELECT policy is OWNER-ONLY (``workflow_runs_select_own``). On
    the user-JWT connection the D-34 org-member arm could NEVER return a row, so a finished org run
    the evidence report shows would read as "can't be opened". The shipped evidence access query
    already runs on the SERVICE POOL with the caller bound explicitly
    (``workflow_run_evidence._ACCESS_SQL``); the run kind copies that posture: ``$2`` = the caller.
  * P2 — EXPERT. ``expert_bundles_read_policy`` has NO granted arm, and ``api/experts.get_expert``
    reads through the pool. On the user-JWT connection a ``granted`` Expert would read as "can't be
    opened" to its grantee. The Expert kind runs on the pool with ``$2`` = the caller; the
    ``experts:manage`` arm is the inline body of ``current_user_has_permission``, because
    ``auth.uid()`` is NULL on the pool. A role grant matches the caller's role IN THE BUNDLE'S ORG
    (``m.role``), never the active org's role.

  On the pool, RLS does not protect these two statements: the ``$2`` predicates ARE the wall
  (T-299-05). They are copied in shape from the two shipped rules above, never invented.
"""
from __future__ import annotations

import re
from typing import Any, Literal, Mapping
from uuid import UUID

from pydantic import BaseModel

Kind = Literal["thread", "workflow", "run", "expert"]
Audience = Literal["only_you", "org_members", "granted", "everyone", "managers_only"]

KINDS: tuple[str, ...] = ("thread", "workflow", "run", "expert")

#: Kinds whose read rule is wider than their RLS SELECT policy (P1 / P2): run on the service pool
#: with the caller bound as ``$2``. Every other kind runs on ``get_user_pg_connection``.
POOL_KINDS = frozenset({"run", "expert"})

#: The DB's terminal run statuses (``workflow_runs_status_check``) — the evidence rule's literals.
TERMINAL_RUN_STATUSES = frozenset({"completed", "failed", "cancelled"})


class LinkTarget(BaseModel):
    """What a link opens: the item, its org (``None`` for a system-global / system item), its
    title, a workflow's draft/published state, and who a link to it opens for."""

    kind: Kind
    id: UUID
    org_id: UUID | None
    org_name: str | None
    title: str
    state: Literal["draft", "published"] | None
    audience: Audience


# ── ONE statement per kind. $1 = the item id; $2 = the caller (POOL_KINDS only). ────────────────

THREAD_SQL = """
SELECT t.id, t.title, t.org_id, o.name AS org_name
FROM public.threads t
LEFT JOIN public.organizations o ON o.id = t.org_id
WHERE t.id = $1 AND t.user_id = auth.uid()
"""

#: D-33: owner (draft or published) OR system-global published. No org-member arm: another member
#: cannot open your workflow today, so a link must not say they can.
WORKFLOW_SQL = """
SELECT d.id, d.name AS title, d.status, d.is_system_global, d.org_id, o.name AS org_name
FROM public.workflow_definitions d
LEFT JOIN public.organizations o ON o.id = d.org_id
WHERE d.id = $1
  AND (d.created_by = auth.uid() OR (d.is_system_global AND d.status = 'published'))
"""

#: D-34 / P1: owner at any status, OR any member of the run's org once it has finished — the
#: ``workflow_run_evidence._ACCESS_SQL`` rule, on the pool.
#: 299-REVIEW CR-02: the chat title joins ONLY for the chat's owner (``t.user_id = $2``) — thread
#: titles are owner-only (the threads SELECT policy), and the evidence report a member reads never
#: shows one. Everyone else reads the name the evidence report shows: the run's frozen definition
#: name, else the definition row's.
RUN_SQL = """
SELECT wr.id,
       COALESCE(NULLIF(t.title, ''), NULLIF(wr.definition_snapshot->>'name', ''), NULLIF(d.name, ''),
                'Workflow run') AS title,
       wr.status, wr.org_id, o.name AS org_name
FROM public.workflow_runs wr
LEFT JOIN public.threads t ON t.id = wr.thread_id AND t.user_id = $2
LEFT JOIN public.workflow_definitions d ON d.id = wr.definition_id
LEFT JOIN public.organizations o ON o.id = wr.org_id
WHERE wr.id = $1
  AND (wr.user_id = $2
       OR (wr.status IN ('completed', 'failed', 'cancelled')
           AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = wr.org_id AND m.user_id = $2)))
"""

#: D-07 / P2: system, or the caller is a member of the BUNDLE's org and the bundle is org/public,
#: theirs, or granted to them (user grant, or a role grant on their role in that org); a disabled
#: bundle only for an ``experts:manage`` holder in that org.
EXPERT_SQL = """
SELECT b.id, b.name AS title, b.is_system, b.visibility, b.is_enabled,
       CASE WHEN b.is_system THEN NULL ELSE b.org_id END AS org_id,
       CASE WHEN b.is_system THEN NULL ELSE o.name END AS org_name
FROM public.expert_bundles b
LEFT JOIN public.organizations o ON o.id = b.org_id
WHERE b.id = $1
  AND (
        b.is_system
     OR EXISTS (
          SELECT 1 FROM public.org_members m
          WHERE m.org_id = b.org_id AND m.user_id = $2
            AND ( b.visibility IN ('org','public')
               OR b.created_by = $2
               OR ( b.visibility = 'granted' AND EXISTS (
                      SELECT 1 FROM public.expert_grants g
                      WHERE g.expert_id = b.id
                        AND ( (g.grantee_type = 'user' AND g.grantee_id = $2::text)
                           OR (g.grantee_type = 'role' AND g.grantee_id = m.role) ))))
        )
      )
  AND ( b.is_enabled
     OR EXISTS (
          SELECT 1 FROM public.org_members m2
          JOIN public.role_permissions rp ON rp.role = m2.role
          WHERE m2.org_id = b.org_id AND m2.user_id = $2 AND rp.permission_key = 'experts:manage') )
"""

SQL_BY_KIND: dict[str, str] = {
    "thread": THREAD_SQL,
    "workflow": WORKFLOW_SQL,
    "run": RUN_SQL,
    "expert": EXPERT_SQL,
}

#: The source org of a Tweak and of a new schedule: the CALLER'S OWN non-global definition's org,
#: else NULL. Owner-scoped (``$2``) because it runs on the pool: an id of someone else's definition
#: must read exactly like an id that does not exist, or the guard naming the org becomes an
#: existence oracle (T-299-09). A global definition is never the caller's org to name.
#: 299-REVIEW CR-01: and only an org the caller is STILL a member of — on the pool RLS does not
#: apply, so membership is in the statement (the definitions SELECT policy's own arm). A definition
#: whose org the owner has left reads like a global one: the caller's active org, never the old one.
WORKFLOW_ORG_SQL = """
SELECT CASE WHEN d.is_system_global THEN NULL ELSE d.org_id END
FROM public.workflow_definitions d
WHERE d.id = $1 AND d.created_by = $2
  AND (d.is_system_global
       OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = d.org_id AND m.user_id = $2))
"""


_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def strict_uuid(raw: Any) -> UUID | None:
    """A canonical hyphenated UUID string -> ``UUID``; anything else (``None``, braces, no hyphens,
    a non-string) -> ``None``. ``UUID()`` alone accepts forms a path or query value never should."""
    return UUID(raw) if isinstance(raw, str) and _UUID_RE.match(raw) else None


async def lookup(conn: Any, kind: str, item_id: UUID, caller_id: UUID):
    """Issue the kind's ONE statement; the row, or ``None`` for missing and forbidden alike."""
    sql = SQL_BY_KIND[kind]
    if kind in POOL_KINDS:
        return await conn.fetchrow(sql, item_id, caller_id)
    return await conn.fetchrow(sql, item_id)


def audience_of(kind: str, facts: Mapping[str, Any]) -> Audience:
    """Who a link to this item opens for — never more than the read rule above.

    Mirrored by ``frontend/src/lib/linkAudience.ts``; both are pinned to
    ``backend/tests/unit/fixtures/link_audience_cases.json``.
    """
    if kind == "workflow":
        return "everyone" if facts.get("is_system_global") else "only_you"
    if kind == "run":
        finished = facts.get("status") in TERMINAL_RUN_STATUSES
        return "org_members" if finished and facts.get("has_org") else "only_you"
    if kind == "expert":
        if facts.get("is_system"):
            return "everyone"
        if not facts.get("is_enabled", True):
            return "managers_only"
        visibility = facts.get("visibility")
        if visibility in ("org", "public"):
            return "org_members"
        if visibility == "granted":
            return "granted"
        return "only_you"
    return "only_you"


_FALLBACK_TITLE = {
    "thread": "New Chat",
    "workflow": "Untitled workflow",
    "run": "Workflow run",
    "expert": "Expert",
}


def to_target(kind: str, row: Mapping[str, Any]) -> LinkTarget:
    """A resolver row -> the wire model. D-35: no org for a system-global workflow or a system
    Expert, so the client never prompts to switch for them."""
    global_item = bool(row.get("is_system_global")) if kind == "workflow" else (
        bool(row.get("is_system")) if kind == "expert" else False
    )
    org_id = None if global_item else row.get("org_id")
    org_name = None if global_item else row.get("org_name")
    facts = {
        "status": row.get("status"),
        "is_system_global": row.get("is_system_global"),
        "is_system": row.get("is_system"),
        "is_enabled": row.get("is_enabled", True),
        "visibility": row.get("visibility"),
        "has_org": org_id is not None,
    }
    state = row.get("status") if kind == "workflow" else None
    return LinkTarget(
        kind=kind,
        id=row["id"],
        org_id=org_id,
        org_name=org_name,
        title=row.get("title") or _FALLBACK_TITLE[kind],
        state=state if state in ("draft", "published") else None,
        audience=audience_of(kind, facts),
    )


async def workflow_org(pool: Any, workflow_id: UUID, *, owner_id: UUID) -> UUID | None:
    """The caller's own non-global definition's org, else ``None`` — for an unknown id, a global
    one and someone else's alike."""
    return await pool.fetchval(WORKFLOW_ORG_SQL, workflow_id, owner_id)

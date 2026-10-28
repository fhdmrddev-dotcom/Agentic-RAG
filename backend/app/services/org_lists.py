"""Phase 298 (ORG-01..04, D-02..D-07) — the ONE home of list narrowing by the active org.

Every list route Phase 298 names (folders, documents, the library summary, the workflow feeds,
threads, the run log) reads the caller's active org through THIS module and nothing else (D-06).
The routes add one expression each; the shared helpers they call (``fetch_visible_folders``
above all) are not edited.

⛔ THE POLARITY RULE (D-03) — load-bearing, and asymmetric on purpose:
  * an org RESOLVED   -> the list narrows to it: one ``org_id = <org>`` predicate, or the folder
    seam's ``restrict_org_ids={org}`` keyword;
  * NO org resolved   -> NOTHING is added and the answer is today's, status 200. No header, a
    malformed header and a header naming an org the caller is NOT a member of all land here.
    Never a 400, and never an empty set.
  The org is read ONLY through ``resolve_active_org_or_none`` (membership re-validated on the
  caller's own RLS connection; a foreign header is ignored, never trusted). ⛔ The 400-ing org
  GATE dependency (absent header + two memberships = 400) is never used on a list: a two-org
  account with no header would stop being able to see its own chats.

⛔ THE SEAM-CONTRACT RULE (``harness/scope.py`` WR-05): ``folder_kw`` returns ``{}`` when no org
  resolves — never ``restrict_org_ids`` bound to ``None`` and never bound to an EMPTY set.
  An empty set means OWNED-ONLY (the fail-closed AUTHORIZER polarity of
  ``threads._authorize_thread_folder``) and would silently hide every org-shared folder from a
  list; an explicit ``None`` would break the rule that an unrestricted call to a documented
  monkeypatch seam is byte-identical ON THE WIRE, not merely in outcome.

Every helper here can only SHRINK a set the caller can already read. None of them widens a scope
or writes, and the list helpers never raise. ⚠ ``root_upload_org`` is the one WRITE decision here,
so it refuses (503) rather than fall back when a header it was sent cannot be validated
(298-review WR-09).
"""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app import dependencies as _deps
from app.dependencies import resolve_active_org_or_none

#: 298-review WR-09: the Root upload's refusal when the org it was sent under cannot be confirmed.
ORG_UNCONFIRMED = (
    "We couldn't confirm your organization just now, so the file was not uploaded. Try again."
)


async def active_org(request, current_user: dict) -> str | None:
    """The caller's validated active org, or ``None`` (D-03). Never raises, never 400s."""
    return await resolve_active_org_or_none(request, current_user)


async def active_org_uuid(request, current_user: dict) -> UUID | None:
    """``active_org`` as a ``uuid.UUID`` for asyncpg binds, or ``None``."""
    org = await active_org(request, current_user)
    return UUID(org) if org else None


async def folder_kw(request, current_user: dict) -> dict:
    """Keyword arguments for ``fetch_visible_folders`` on a LIST route (D-04).

    ``{"restrict_org_ids": {org}}`` when an org resolved — the owned AND org-shared arms both
    narrow to it, so an org-shared folder of org A no longer lists under org B — else ``{}``.
    """
    org = await active_org(request, current_user)
    return {"restrict_org_ids": {org}} if org else {}


def by_org(query, org: str | None):
    """One ``org_id`` predicate on a supabase query when an org resolved; else the SAME object."""
    return query.eq("org_id", org) if org else query


async def root_upload_org(request, current_user: dict, folder_id) -> str | None:
    """The org a NEW upload is minted in (D-07), or ``None`` to leave the minter's own rule.

    A foldered upload returns ``None`` WITHOUT resolving anything: the minter derives the folder's
    own org (280-03), and passing an org there would make it compare and 404 a folder of another
    org. A Root upload (no folder) lands in the active org — the org it will be listed under.
    """
    if folder_id:
        return None
    org = await active_org(request, current_user)
    if org is not None:
        return org
    return await _confirm_header_or_refuse(request, current_user)


async def _confirm_header_or_refuse(request, current_user: dict) -> str | None:
    """298-review WR-09: ``resolve_active_org_or_none`` answers ``None`` both for "no / foreign
    header" and for "the membership read FAILED". For a list ``None`` is the safe polarity; for a
    Root upload it means the mig-106 ``LIMIT 1`` org (the SEED-313 mis-stamp, and the upload then
    vanishes from the Root list it was sent from). So when a well-formed header WAS sent, re-ask
    once: not a member -> ``None`` (fall back, as before); member -> the org; the read fails ->
    503, nothing minted. No header (API keys, unattended callers) never probes."""
    header_org = request.headers.get("X-Org-Id") if request is not None else None
    org_uuid = _deps._to_uuid(header_org) if header_org else None
    if org_uuid is None:
        return None
    try:
        async with _deps.get_user_pg_connection(request, current_user) as conn:
            row = await conn.fetchrow(
                "SELECT role FROM public.org_members WHERE org_id = $1 AND user_id = auth.uid()",
                org_uuid,
            )
    except Exception:  # noqa: BLE001 — a DB boundary; a WRITE must not guess the org
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=ORG_UNCONFIRMED
        ) from None
    return str(org_uuid) if row is not None else None

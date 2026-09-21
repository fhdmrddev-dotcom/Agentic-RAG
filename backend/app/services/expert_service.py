from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.db import experts as experts_db
from app.models.expert import ExpertBundle, ExpertBundleCreate, ExpertBundleUpdate

logger = logging.getLogger(__name__)
SYSTEM_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


class ResolvedExpertBundle(BaseModel):
    bundle_id: UUID
    name: str
    slug: str
    description: str
    scope_mode: str
    is_system: bool
    org_id: UUID | None
    tool_floor_enabled: bool = True
    effective_skills: list[str] = Field(default_factory=list)
    effective_folder_ids: list[UUID] = Field(default_factory=list)
    effective_connections: list[str] = Field(default_factory=list)
    prompt_suggestions: list[dict[str, Any]] = Field(default_factory=list)
    stripped_members_count: int = 0
    stripped_details: list[str] = Field(default_factory=list)


async def create_expert_service(
    pool: asyncpg.Pool,
    org_id: UUID,
    user_id: UUID,
    bundle_in: ExpertBundleCreate,
) -> dict[str, Any]:
    """Create a new tenant expert bundle via service layer."""
    created = await experts_db.create_expert_bundle(
        pool=pool,
        org_id=org_id,
        created_by=user_id,
        name=bundle_in.name,
        slug=bundle_in.slug,
        description=bundle_in.description,
        scope_mode=bundle_in.scope_mode,
        member_skills=bundle_in.member_skills,
        required_connections=bundle_in.required_connections,
        knowledge_folder_ids=bundle_in.knowledge_folder_ids,
        prompt_suggestions=[s.model_dump() for s in bundle_in.prompt_suggestions],
        visibility=bundle_in.visibility,
        is_enabled=bundle_in.is_enabled,
        icon=bundle_in.icon,
        category=bundle_in.category,
        when_to_use=bundle_in.when_to_use,
        example_output=bundle_in.example_output,
        tool_floor_enabled=bundle_in.tool_floor_enabled,
    )
    if created:
        # ⛔ 263-REVIEW.md WR-08 — `born_skills`, NOT `member_skills`. The stamp is a
        # privilege widening (D-263-06); claiming the whole selected set meant a
        # long-standing private skill became readable by the whole org because its author
        # ticked a checkbox. Only what this session CREATED is claimed.
        await _stamp_born_for(
            pool,
            bundle_id=created.get("id"),
            skill_names=bundle_in.born_skills,
            org_id=org_id,
            user_id=user_id,
        )
    return created


async def _stamp_born_for(
    pool: asyncpg.Pool,
    *,
    bundle_id: Any,
    skill_names: list[str] | None,
    org_id: UUID,
    user_id: UUID,
) -> None:
    """Best-effort D-263-08 provenance stamp on the Expert save path.

    ⛔ A stamp failure must NOT fail the save (T-263-07). The Expert row is the deliverable;
    the marker is an optimisation of resolution, and an unstamped skill degrades to exactly
    today's behaviour (resolvable by its author, stripped for everyone else). Swallowing is
    therefore correct here — but it is LOGGED at exception level, because a silently
    permanently-unstamped skill would look to its author like the Expert is hollow.
    """
    if not bundle_id or not skill_names:
        return
    try:
        stamped = await experts_db.stamp_skills_born_for_bundle(
            pool,
            bundle_id=bundle_id,
            skill_names=list(skill_names),
            org_id=org_id,
            user_id=user_id,
        )
        if stamped:
            logger.info(
                "EXPERT_SKILLS_BORN_FOR_STAMPED: bundle '%s' claimed %d skill(s): %s",
                bundle_id,
                len(stamped),
                ", ".join(stamped),
            )
    except Exception:
        logger.exception(
            "EXPERT_SKILLS_BORN_FOR_STAMP_FAILED: bundle '%s' saved but skills left unstamped",
            bundle_id,
        )


async def get_expert_service(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID | None,
    caller_user_id: UUID | None = None,
    caller_roles: list[str] | None = None,
) -> dict[str, Any] | None:
    """Fetch raw expert bundle by ID, verifying grant access if caller_user_id is provided."""
    bundle = await experts_db.get_expert_bundle_by_id(pool, bundle_id, caller_org_id)
    if not bundle:
        return None
    if caller_user_id is not None:
        has_grant = await experts_db.check_expert_grant_access(
            pool=pool,
            bundle=bundle,
            caller_user_id=caller_user_id,
            caller_roles=caller_roles,
        )
        if not has_grant:
            return None
    return bundle


async def get_expert_by_slug_service(
    pool: asyncpg.Pool,
    slug: str,
    caller_org_id: UUID | None,
    caller_user_id: UUID | None = None,
    caller_roles: list[str] | None = None,
) -> dict[str, Any] | None:
    """Fetch raw expert bundle by slug, verifying grant access if caller_user_id is provided."""
    bundle = await experts_db.get_expert_bundle_by_slug(pool, slug, caller_org_id)
    if not bundle:
        return None
    if caller_user_id is not None:
        has_grant = await experts_db.check_expert_grant_access(
            pool=pool,
            bundle=bundle,
            caller_user_id=caller_user_id,
            caller_roles=caller_roles,
        )
        if not has_grant:
            return None
    return bundle


async def list_experts_service(
    pool: asyncpg.Pool,
    caller_org_id: UUID | None,
    caller_user_id: UUID | None = None,
    caller_roles: list[str] | None = None,
    include_system: bool = True,
    enabled_only: bool = True,
) -> list[dict[str, Any]]:
    """List raw expert bundles accessible to caller."""
    if caller_user_id is not None:
        return await experts_db.list_expert_bundles_for_caller(
            pool=pool,
            caller_org_id=caller_org_id,
            caller_user_id=caller_user_id,
            caller_roles=caller_roles,
            include_system=include_system,
            enabled_only=enabled_only,
        )
    return await experts_db.list_expert_bundles(
        pool=pool,
        caller_org_id=caller_org_id,
        include_system=include_system,
        enabled_only=enabled_only,
    )


async def get_expert_grants_service(
    pool: asyncpg.Pool,
    expert_id: UUID,
) -> list[dict[str, Any]]:
    """Fetch all granular access grants for an expert bundle."""
    return await experts_db.get_expert_grants(pool, expert_id)


async def add_expert_grant_service(
    pool: asyncpg.Pool,
    expert_id: UUID,
    grantee_type: str,
    grantee_id: str,
) -> dict[str, Any]:
    """Add a granular access grant for an expert bundle."""
    return await experts_db.add_expert_grant(pool, expert_id, grantee_type, grantee_id)


async def remove_expert_grant_service(
    pool: asyncpg.Pool,
    grant_id: UUID,
    expert_id: UUID | None = None,
) -> bool:
    """Remove an access grant."""
    return await experts_db.remove_expert_grant(pool, grant_id, expert_id)


async def bulk_set_expert_grants_service(
    pool: asyncpg.Pool,
    expert_id: UUID,
    grants: list[tuple[str, str]],
) -> list[dict[str, Any]]:
    """Bulk set access grants for an expert bundle."""
    return await experts_db.bulk_set_expert_grants(pool, expert_id, grants)


async def update_expert_service(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID,
    bundle_update: ExpertBundleUpdate,
    caller_user_id: UUID | None = None,
) -> dict[str, Any] | None:
    """Update tenant expert bundle fields.

    ``caller_user_id`` is optional so that the pre-263 four-argument call shape keeps working.
    When supplied AND ``member_skills`` was explicitly set, the saver's own unstamped skills
    are claimed for this bundle (D-263-08). Absent it, the update behaves exactly as before —
    the stamp is an optimisation, never a precondition.
    """
    update_data = bundle_update.model_dump(exclude_unset=True)
    if "prompt_suggestions" in update_data and update_data["prompt_suggestions"] is not None:
        update_data["prompt_suggestions"] = [
            s if isinstance(s, dict) else s.model_dump()
            for s in update_data["prompt_suggestions"]
        ]
    # ⛔ 263-REVIEW.md WR-08 — `born_skills` is a REQUEST field, not a column. Popped here
    # rather than left for `update_expert_bundle`'s `allowed_fields` to skip: a request
    # field's safety must not depend on a list it is not named in.
    born_skills = update_data.pop("born_skills", None)
    updated = await experts_db.update_expert_bundle(
        pool=pool,
        bundle_id=bundle_id,
        caller_org_id=caller_org_id,
        **update_data,
    )
    if updated and caller_user_id is not None and born_skills:
        await _stamp_born_for(
            pool,
            bundle_id=bundle_id,
            skill_names=born_skills,
            org_id=caller_org_id,
            user_id=caller_user_id,
        )
    return updated


async def delete_expert_service(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID,
) -> bool:
    """Delete tenant expert bundle."""
    return await experts_db.delete_expert_bundle(
        pool=pool,
        bundle_id=bundle_id,
        caller_org_id=caller_org_id,
    )


async def filter_visible_skill_names(
    pool: asyncpg.Pool,
    skill_names: list[str],
    caller_org_id: UUID,
    caller_user_id: UUID,
    bundle_id: UUID | None = None,
) -> set[str]:
    """The ONE Expert-side skill-visibility predicate (PACK-16 / D-263-06).

    Returns the subset of ``skill_names`` the caller may resolve. Two consumers: phase 2 of
    ``resolve_expert_bundle`` (with a real ``bundle_id``) and the ``POST /experts`` save-time
    refusal (with ``bundle_id=None``, because no bundle exists yet).

    THE PREDICATE::

        visible iff is_system
                 OR (org_id == caller_org_id AND is_enabled
                     AND (user_id == caller OR is_org_shared OR born-for-THIS-bundle))

    The born-for disjunct is the Phase 263 addition and it lives INSIDE the inner
    parenthesis, structurally beneath ``org_id == caller_org_id and is_enabled``. That
    placement is what makes D-263-06's "the org fence is untouched" true BY CONSTRUCTION
    rather than by assertion: a fourth top-level branch would let a foreign-org row carrying
    the marker through, which is precisely the ``SEED-125`` shape PACK-17 exists to prevent.

    ⛔ ``bundle_id is not None`` is a MEASURED TRAP, not a style preference (T-263-02). At
    save time the caller passes ``bundle_id=None`` and every unstamped row carries
    ``born_for_expert_bundle_id = None``; a bare ``==`` evaluates ``None == None`` to True and
    admits every other user's private skill in the org.

    ⛔ WHY THIS IS NOT IN ``app/utils/skill_visibility.py``, deliberately. That module is the
    declared one home of the AGENT-side rule and is imported by ``tool_dispatcher`` (five call
    sites) and ``harness/grounding.py``. Adding the born-for arm there would widen skill
    resolution for the agent loop and for workflow grounding — two consumers this phase has no
    business touching, and the exact shape of ``SEED-125``. The Expert arm therefore stays in
    the Expert module. That is a decision, not an oversight.

    ⛔ This helper does NOT log and does NOT count. ``resolve_expert_bundle`` keeps ownership of
    the stripped counter, the ``skill:<name>`` details and the single
    ``EXPERT_MEMBER_CROSS_ORG_STRIPPED`` warning verb — six existing tests match that literal
    through ``caplog.text`` and a second verb would fragment the audit trail.
    """
    if not skill_names:
        return set()

    skill_query = """
        SELECT name, is_system, org_id, user_id, is_org_shared, is_enabled,
               born_for_expert_bundle_id
        FROM public.skills
        WHERE name = ANY($1::text[]);
    """
    skill_rows = await pool.fetch(skill_query, skill_names)

    valid_skills: set[str] = set()
    for row in skill_rows:
        s_name = row["name"]
        is_sys = bool(row.get("is_system"))
        s_org_id = row.get("org_id")
        s_user_id = row.get("user_id")
        s_shared = bool(row.get("is_org_shared"))
        s_enabled = bool(row.get("is_enabled", True))
        # .get(), never [...]: every pre-263 mock fixture is a plain dict without this key.
        s_born_for = row.get("born_for_expert_bundle_id")

        if is_sys:
            valid_skills.add(s_name)
        elif (
            s_org_id == caller_org_id
            and s_enabled
            and (
                s_user_id == caller_user_id
                or s_shared
                or (bundle_id is not None and s_born_for == bundle_id)
            )
        ):
            valid_skills.add(s_name)

    return valid_skills


async def resolve_expert_bundle(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID,
    caller_user_id: UUID,
    caller_roles: list[str] | None = None,
) -> ResolvedExpertBundle | None:
    """Two-phase member boundary evaluation (PACK-04, SEED-125).

    Phase 1:
      Verify bundle exists and is accessible to caller_org_id (is_system = true OR org_id == caller_org_id).
      Verify caller holds access grant if visibility is 'granted' or 'private' (PACK-10 / SC#5).
      If not found, cross-org, or grant denied, returns None.

    Phase 2:
      Independently evaluate each referenced member (skills, folders, connections):
      - skills: must be is_system = true OR (org_id == caller_org_id AND is_enabled = true AND (user_id == caller_user_id OR is_org_shared = true OR born_for_expert_bundle_id == bundle_id))
        The third disjunct is Phase 263 (D-263-06) and is evaluated by ``filter_visible_skill_names``.
      - folders: must belong to caller_org_id (org_id == caller_org_id)
      - connections: must be active and enabled in caller_org_id
      Foreign members are stripped and logged with an audit warning (EXPERT_MEMBER_CROSS_ORG_STRIPPED).
    """
    bundle = await experts_db.get_expert_bundle_by_id(pool, bundle_id, caller_org_id)
    if not bundle:
        return None

    # PACK-10 / SC#5: Verify caller holds grant access for granted/private bundles
    has_grant = await experts_db.check_expert_grant_access(
        pool=pool,
        bundle=bundle,
        caller_user_id=caller_user_id,
        caller_roles=caller_roles,
    )
    if not has_grant:
        logger.warning(
            "EXPERT_GRANT_ACCESS_DENIED: user '%s' lacks grant to resolve expert '%s' (visibility '%s')",
            caller_user_id,
            bundle_id,
            bundle.get("visibility"),
        )
        return None

    stripped_count = 0
    stripped_details: list[str] = []

    # 1. Evaluate member_skills independently
    raw_skills = bundle.get("member_skills") or []
    effective_skills: list[str] = []

    if raw_skills:
        valid_skills = await filter_visible_skill_names(
            pool,
            raw_skills,
            caller_org_id,
            caller_user_id,
            bundle_id=bundle_id,
        )

        for s in raw_skills:
            if s in valid_skills:
                effective_skills.append(s)
            else:
                stripped_count += 1
                detail = f"skill:{s}"
                stripped_details.append(detail)
                logger.warning(
                    "EXPERT_MEMBER_CROSS_ORG_STRIPPED: skill '%s' foreign or inaccessible to org '%s' (user '%s')",
                    s,
                    caller_org_id,
                    caller_user_id,
                )

    # 2. Evaluate knowledge_folder_ids independently
    raw_folder_ids = bundle.get("knowledge_folder_ids") or []
    effective_folder_ids: list[UUID] = []

    if raw_folder_ids:
        folder_query = """
            SELECT id, org_id, user_id, is_org_shared
            FROM public.folders
            WHERE id = ANY($1::uuid[]);
        """
        folder_rows = await pool.fetch(folder_query, raw_folder_ids)
        valid_folders: set[UUID] = set()

        for r in folder_rows:
            f_id = r["id"]
            f_org_id = r.get("org_id")
            f_user_id = r.get("user_id")
            f_shared = bool(r.get("is_org_shared"))
            is_system_folder = bool(f_user_id == SYSTEM_USER_ID and f_shared)
            is_tenant_folder = bool(f_org_id == caller_org_id and (f_user_id == caller_user_id or f_shared))
            if is_system_folder or is_tenant_folder:
                valid_folders.add(f_id)

        for f_id in raw_folder_ids:
            if f_id in valid_folders:
                effective_folder_ids.append(f_id)
            else:
                stripped_count += 1
                detail = f"folder:{f_id}"
                stripped_details.append(detail)
                logger.warning(
                    "EXPERT_MEMBER_CROSS_ORG_STRIPPED: folder '%s' foreign or inaccessible to org '%s' (user '%s')",
                    f_id,
                    caller_org_id,
                    caller_user_id,
                )

    # 3. Evaluate required_connections independently
    raw_connections = bundle.get("required_connections") or []
    effective_connections: list[str] = []

    if raw_connections:
        conn_query = """
            SELECT DISTINCT service_id, capability
            FROM public.connector_connections
            WHERE org_id = $1
              AND is_enabled = true
              AND status = 'active';
        """
        conn_rows = await pool.fetch(conn_query, caller_org_id)
        active_conn_keys: set[str] = set()
        for r in conn_rows:
            if r.get("service_id"):
                active_conn_keys.add(r["service_id"])
            if r.get("capability"):
                active_conn_keys.add(r["capability"])

        for c in raw_connections:
            if c in active_conn_keys:
                effective_connections.append(c)
            else:
                stripped_count += 1
                detail = f"connection:{c}"
                stripped_details.append(detail)
                logger.warning(
                    "EXPERT_MEMBER_CROSS_ORG_STRIPPED: connection '%s' unconfigured or foreign to org '%s'",
                    c,
                    caller_org_id,
                )

    return ResolvedExpertBundle(
        bundle_id=bundle["id"],
        name=bundle["name"],
        slug=bundle["slug"],
        description=bundle.get("description", ""),
        scope_mode=bundle.get("scope_mode", "restricted"),
        is_system=bundle.get("is_system", False),
        org_id=bundle.get("org_id"),
        tool_floor_enabled=bool(bundle.get("tool_floor_enabled", True)),
        effective_skills=effective_skills,
        effective_folder_ids=effective_folder_ids,
        effective_connections=effective_connections,
        prompt_suggestions=bundle.get("prompt_suggestions") or [],
        stripped_members_count=stripped_count,
        stripped_details=stripped_details,
    )

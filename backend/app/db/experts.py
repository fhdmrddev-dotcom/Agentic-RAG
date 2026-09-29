from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)


def _suggestions_to_jsonb(val: Any) -> str:
    """Serialise prompt_suggestions for a ``::jsonb`` bind — ALWAYS as a JSON ARRAY.

    BUG-260921-01b: the write path was a bare ``json.dumps(value or [])``. That is correct
    for a list and silently WRONG for a string: ``json.dumps('[{"title":...}]')`` yields a
    JSON *string scalar*, which Postgres stores happily and which reads back as
    ``jsonb_typeof = 'string'`` rather than ``'array'``. Measured on a live row
    (``phd-lr``) against a correct one (``financial-analyzer``) in the same column. Same
    class as the ``workflow_definition`` jsonb-string-scalar trap already in this project's
    record.

    ⛔ The invariant is THE RETURN VALUE PARSES TO A LIST. A str input is parsed rather than
    re-dumped; anything neither a list nor list-bearing JSON becomes an empty array,
    because a malformed tile set must not be persisted as a scalar that every later reader
    has to defend against.
    """
    if val is None:
        return "[]"
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
        except Exception:
            return "[]"
        return json.dumps(parsed) if isinstance(parsed, list) else "[]"
    if isinstance(val, (list, tuple)):
        return json.dumps([
            (v if isinstance(v, dict) else (v.model_dump() if hasattr(v, "model_dump") else v))
            for v in val
        ])
    if hasattr(val, "model_dump"):
        return json.dumps([val.model_dump()])
    return "[]"


def _parse_prompt_suggestions(val: Any) -> list[dict[str, Any]]:
    if val is None:
        return []
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    if isinstance(val, list):
        return val
    return []


def _row_to_dict(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    d = dict(row)
    if "prompt_suggestions" in d:
        d["prompt_suggestions"] = _parse_prompt_suggestions(d["prompt_suggestions"])
    return d


async def create_expert_bundle(
    pool: asyncpg.Pool,
    org_id: UUID,
    created_by: UUID,
    name: str,
    slug: str,
    description: str = "",
    scope_mode: str = "restricted",
    member_skills: list[str] | None = None,
    required_connections: list[str] | None = None,
    knowledge_folder_ids: list[UUID] | None = None,
    prompt_suggestions: list[dict[str, Any]] | None = None,
    visibility: str = "private",
    is_enabled: bool = True,
    icon: str = "chart",
    category: str = "General",
    when_to_use: str = "",
    example_output: str = "",
    tool_floor_enabled: bool = True,
) -> dict[str, Any]:
    """Create a new domain expert bundle for a tenant organization.

    System bundles cannot be created via this function (enforced is_system = false).
    Slug uniqueness within the org is enforced by partial unique index idx_expert_bundles_org_slug.
    """
    suggestions_json = _suggestions_to_jsonb(prompt_suggestions)
    query = """
        INSERT INTO public.expert_bundles (
            org_id,
            created_by,
            name,
            slug,
            description,
            scope_mode,
            member_skills,
            required_connections,
            knowledge_folder_ids,
            prompt_suggestions,
            visibility,
            is_system,
            is_enabled,
            icon,
            category,
            when_to_use,
            example_output,
            tool_floor_enabled
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, false, $12, $13, $14, $15, $16, $17
        )
        RETURNING *;
    """
    row = await pool.fetchrow(
        query,
        org_id,
        created_by,
        name,
        slug,
        description,
        scope_mode,
        member_skills or [],
        required_connections or [],
        knowledge_folder_ids or [],
        suggestions_json,
        visibility,
        is_enabled,
        icon,
        category,
        when_to_use,
        example_output,
        tool_floor_enabled,
    )
    result = _row_to_dict(row)
    if not result:
        raise RuntimeError("Failed to create expert bundle")
    return result


async def get_expert_bundle_by_id(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID | None,
) -> dict[str, Any] | None:
    """Fetch an expert bundle by its UUID.

    Returns the bundle if it is a system template (is_system = true)
    or if it belongs to the caller's organization (org_id = caller_org_id).
    Cross-org access returns None.
    """
    query = """
        SELECT *
        FROM public.expert_bundles
        WHERE id = $1
          AND (is_system = true OR org_id = $2);
    """
    row = await pool.fetchrow(query, bundle_id, caller_org_id)
    return _row_to_dict(row)


async def get_expert_bundle_by_slug(
    pool: asyncpg.Pool,
    slug: str,
    caller_org_id: UUID | None,
) -> dict[str, Any] | None:
    """Fetch an expert bundle by its slug.

    Prioritizes org-specific bundle over system bundle if both match the slug.
    """
    query = """
        SELECT *
        FROM public.expert_bundles
        WHERE slug = $1
          AND (is_system = true OR org_id = $2)
        ORDER BY is_system ASC
        LIMIT 1;
    """
    row = await pool.fetchrow(query, slug, caller_org_id)
    return _row_to_dict(row)


async def list_expert_bundles(
    pool: asyncpg.Pool,
    caller_org_id: UUID | None,
    include_system: bool = True,
    enabled_only: bool = True,
) -> list[dict[str, Any]]:
    """List all expert bundles in the org (plus system templates).

    Intended for administrative management surfaces (OrgAdminShell).
    Returns all tenant-owned bundles regardless of visibility.
    """
    clauses: list[str] = []
    args: list[Any] = []

    if include_system and caller_org_id is not None:
        args.append(caller_org_id)
        clauses.append(f"(is_system = true OR org_id = ${len(args)})")
    elif include_system:
        clauses.append("is_system = true")
    elif caller_org_id is not None:
        args.append(caller_org_id)
        clauses.append(f"(is_system = false AND org_id = ${len(args)})")
    else:
        return []

    if enabled_only:
        clauses.append("is_enabled = true")

    where_sql = " AND ".join(clauses)
    query = f"""
        SELECT *
        FROM public.expert_bundles
        WHERE {where_sql}
        ORDER BY is_system DESC, name ASC;
    """
    rows = await pool.fetch(query, *args)
    return [_row_to_dict(r) for r in rows if r is not None]  # type: ignore[misc]


async def list_expert_bundles_for_caller(
    pool: asyncpg.Pool,
    caller_org_id: UUID | None,
    caller_user_id: UUID | None = None,
    caller_roles: list[str] | None = None,
    include_system: bool = True,
    enabled_only: bool = True,
) -> list[dict[str, Any]]:
    """List expert bundles accessible to a specific caller based on visibility and grants.

    Enforces:
      - System bundles: public catalog assets, visible to all.
      - Org bundles with visibility 'public' or 'org': visible to any org member.
      - Org bundles with visibility 'private': visible ONLY to creator (created_by == caller_user_id).
      - Org bundles with visibility 'granted': visible if created_by == caller_user_id OR
        caller has an active grant in public.expert_grants matching caller_user_id or caller_roles.
    """
    clauses: list[str] = []
    args: list[Any] = []

    if caller_org_id is None and not include_system:
        return []

    if enabled_only:
        clauses.append("is_enabled = true")

    # Base org or system boundary
    if include_system and caller_org_id is not None:
        args.append(caller_org_id)
        org_filter = f"(is_system = true OR org_id = ${len(args)})"
    elif include_system:
        org_filter = "is_system = true"
    elif caller_org_id is not None:
        args.append(caller_org_id)
        org_filter = f"(is_system = false AND org_id = ${len(args)})"
    else:
        return []

    # Visibility & grant filtering clause for tenant bundles
    user_str = str(caller_user_id) if caller_user_id else ""
    roles = caller_roles or []

    args.append(caller_user_id)
    uid_param = f"${len(args)}"
    args.append(user_str)
    uid_str_param = f"${len(args)}"
    args.append(roles)
    roles_param = f"${len(args)}::text[]"

    visibility_clause = f"""(
        is_system = true
        OR visibility IN ('org', 'public')
        OR (visibility = 'private' AND created_by = {uid_param})
        OR (visibility = 'granted' AND (
            created_by = {uid_param}
            OR EXISTS (
                SELECT 1
                FROM public.expert_grants eg
                WHERE eg.expert_id = expert_bundles.id
                  AND (
                      (eg.grantee_type = 'user' AND eg.grantee_id = {uid_str_param})
                      OR (eg.grantee_type = 'role' AND eg.grantee_id = ANY({roles_param}))
                  )
            )
        ))
    )"""

    clauses.append(org_filter)
    clauses.append(visibility_clause)

    where_sql = " AND ".join(clauses)
    query = f"""
        SELECT *
        FROM public.expert_bundles
        WHERE {where_sql}
        ORDER BY is_system DESC, name ASC;
    """
    rows = await pool.fetch(query, *args)
    return [_row_to_dict(r) for r in rows if r is not None]  # type: ignore[misc]


async def check_expert_grant_access(
    pool: asyncpg.Pool,
    bundle: dict[str, Any],
    caller_user_id: UUID | None,
    caller_roles: list[str] | None = None,
) -> bool:
    """Check if caller has access to a specific expert bundle based on visibility and grants."""
    if bundle.get("is_system"):
        return True
    vis = bundle.get("visibility", "private")
    if vis in ("org", "public"):
        return True
    if caller_user_id is None:
        return False
    if bundle.get("created_by") == caller_user_id:
        return True
    if vis == "granted":
        user_str = str(caller_user_id)
        roles = caller_roles or []
        query = """
            SELECT 1
            FROM public.expert_grants
            WHERE expert_id = $1
              AND (
                  (grantee_type = 'user' AND grantee_id = $2)
                  OR (grantee_type = 'role' AND grantee_id = ANY($3::text[]))
              )
            LIMIT 1;
        """
        row = await pool.fetchrow(query, bundle["id"], user_str, roles)
        return row is not None
    return False


async def update_expert_bundle(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID,
    **updates: Any,
) -> dict[str, Any] | None:
    """Update fields on a tenant-owned expert bundle.

    Refuses to update system bundles (returns None).
    Refuses to update bundles belonging to other organizations (returns None).
    """
    # Verify existence and tenant ownership first
    existing = await get_expert_bundle_by_id(pool, bundle_id, caller_org_id)
    if not existing:
        return None
    if existing.get("is_system"):
        logger.warning("Attempted to update system expert bundle %s; refused.", bundle_id)
        return None

    allowed_fields = {
        "name",
        "description",
        "scope_mode",
        "member_skills",
        "required_connections",
        "knowledge_folder_ids",
        "prompt_suggestions",
        "visibility",
        "is_enabled",
        "icon",
        "category",
        "when_to_use",
        "example_output",
        "tool_floor_enabled",
    }

    set_clauses: list[str] = []
    args: list[Any] = [bundle_id, caller_org_id]

    for field, value in updates.items():
        if field not in allowed_fields:
            continue
        if field == "prompt_suggestions":
            args.append(_suggestions_to_jsonb(value))
            set_clauses.append(f"prompt_suggestions = ${len(args)}::jsonb")
        else:
            args.append(value)
            set_clauses.append(f"{field} = ${len(args)}")

    if not set_clauses:
        return existing

    set_clauses.append("updated_at = now()")
    set_sql = ", ".join(set_clauses)

    query = f"""
        UPDATE public.expert_bundles
        SET {set_sql}
        WHERE id = $1
          AND org_id = $2
          AND is_system = false
        RETURNING *;
    """
    row = await pool.fetchrow(query, *args)
    return _row_to_dict(row)


async def stamp_skills_born_for_bundle(
    pool: asyncpg.Pool,
    *,
    bundle_id: UUID,
    skill_names: list[str],
    org_id: UUID,
    user_id: UUID,
) -> list[str]:
    """Mark the saver's own unstamped skills as born for this Expert bundle (D-263-08).

    Returns the names actually stamped, which is a SUBSET of ``skill_names`` — a caller that
    needs to know what did NOT get stamped must diff, because silence here means "already
    claimed, foreign, or not yours" and those are different situations.

    Each of the three narrowing predicates is load-bearing:

      * ``org_id = $3`` — a foreign-org row cannot be stamped. The stamp IS a privilege
        widening under D-263-06 (it makes a private skill resolvable to every org member
        through this bundle), so it must never reach outside the caller's tenancy.
      * ``user_id = $4`` — another author's pre-existing row cannot be silently conscripted
        into somebody else's Expert.
      * ``born_for_expert_bundle_id IS NULL`` — D-263-07's rejection of re-stamping on reuse.
        Without it, adding a skill to a SECOND Expert would move the marker and the FIRST
        Expert would silently lose the skill.
    """
    if not skill_names:
        return []

    query = """
        UPDATE public.skills
        SET born_for_expert_bundle_id = $1,
            updated_at = now()
        WHERE name = ANY($2::text[])
          AND org_id = $3
          AND user_id = $4
          AND born_for_expert_bundle_id IS NULL
        RETURNING name;
    """
    rows = await pool.fetch(query, bundle_id, skill_names, org_id, user_id)
    return [r["name"] for r in rows]


async def delete_expert_bundle(
    pool: asyncpg.Pool,
    bundle_id: UUID,
    caller_org_id: UUID,
) -> bool:
    """Delete a tenant-owned expert bundle.

    Refuses to delete system bundles (returns False).
    Refuses to delete bundles belonging to other organizations (returns False).
    """
    existing = await get_expert_bundle_by_id(pool, bundle_id, caller_org_id)
    if not existing:
        return False
    if existing.get("is_system"):
        logger.warning("Attempted to delete system expert bundle %s; refused.", bundle_id)
        return False

    query = """
        DELETE FROM public.expert_bundles
        WHERE id = $1
          AND org_id = $2
          AND is_system = false;
    """
    result = await pool.execute(query, bundle_id, caller_org_id)
    return result == "DELETE 1"


# --- Expert Grants CRUD (PACK-10) ---

async def get_expert_grants(
    pool: asyncpg.Pool,
    expert_id: UUID,
) -> list[dict[str, Any]]:
    """Fetch all granular access grants for a given expert bundle."""
    query = """
        SELECT *
        FROM public.expert_grants
        WHERE expert_id = $1
        ORDER BY created_at ASC;
    """
    rows = await pool.fetch(query, expert_id)
    return [dict(r) for r in rows if r is not None]


async def add_expert_grant(
    pool: asyncpg.Pool,
    expert_id: UUID,
    grantee_type: str,
    grantee_id: str,
) -> dict[str, Any]:
    """Add a granular access grant (user or role) for an expert bundle.

    Idempotent: on conflict returns existing grant.
    """
    query = """
        INSERT INTO public.expert_grants (
            expert_id,
            grantee_type,
            grantee_id
        ) VALUES (
            $1, $2, $3
        )
        ON CONFLICT (expert_id, grantee_type, grantee_id) DO UPDATE
        SET expert_id = EXCLUDED.expert_id
        RETURNING *;
    """
    row = await pool.fetchrow(query, expert_id, grantee_type, grantee_id)
    if not row:
        raise RuntimeError("Failed to add expert grant")
    return dict(row)


async def remove_expert_grant(
    pool: asyncpg.Pool,
    grant_id: UUID,
    expert_id: UUID | None = None,
) -> bool:
    """Remove a granular access grant by its ID."""
    if expert_id is not None:
        query = """
            DELETE FROM public.expert_grants
            WHERE id = $1 AND expert_id = $2;
        """
        result = await pool.execute(query, grant_id, expert_id)
    else:
        query = """
            DELETE FROM public.expert_grants
            WHERE id = $1;
        """
        result = await pool.execute(query, grant_id)
    return result == "DELETE 1"


async def bulk_set_expert_grants(
    pool: asyncpg.Pool,
    expert_id: UUID,
    grants: list[tuple[str, str]],
) -> list[dict[str, Any]]:
    """Synchronize expert grants in a transaction, replacing existing grants."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM public.expert_grants WHERE expert_id = $1;", expert_id)
            if not grants:
                return []
            stmt = """
                INSERT INTO public.expert_grants (expert_id, grantee_type, grantee_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (expert_id, grantee_type, grantee_id) DO NOTHING
                RETURNING *;
            """
            out = []
            for g_type, g_id in grants:
                r = await conn.fetchrow(stmt, expert_id, g_type, g_id)
                if r:
                    out.append(dict(r))
            return out


# --- Expert Installs (PACK-18/19, Phase 266) ---
#
# ⛔ EVERY statement below is bound to the VALIDATED ACTIVE ORG as ``org_id = $1``. This pool
# BYPASSES RLS, so that predicate is not a filter — it IS the tenancy boundary. The
# ``expert_installs`` RLS policy (migration 195) only governs PostgREST reads by members; it
# never runs here. A query in this section without its org predicate would read or write
# another tenant's install.

_INSTALL_COLUMNS = """
            i.id, i.org_id, i.expert_bundle_id, i.folder_id, i.status, i.error,
            i.installed_by, i.corpus_version, i.created_at, i.updated_at,
            (f.id IS NOT NULL) AS folder_exists
"""


async def get_expert_install(
    pool: asyncpg.Pool,
    *,
    org_id: UUID,
    bundle_id: UUID,
) -> dict[str, Any] | None:
    """The caller org's install row for one Expert, or ``None`` (D-266-09).

    ``folder_exists`` comes from a LEFT JOIN that also requires ``f.org_id = i.org_id``: a
    folder id that was deleted (the FK sets it NULL) or that somehow names another org's
    folder reads ``False``, so a caller can tell "installed, folder gone" from "installed".
    ``org_id = $1`` is load-bearing — see the section header.
    """
    query = f"""
        SELECT {_INSTALL_COLUMNS}
        FROM public.expert_installs i
        LEFT JOIN public.folders f ON f.id = i.folder_id AND f.org_id = i.org_id
        WHERE i.org_id = $1
          AND i.expert_bundle_id = $2;
    """
    row = await pool.fetchrow(query, org_id, bundle_id)
    return dict(row) if row is not None else None


async def list_expert_installs_for_org(
    pool: asyncpg.Pool,
    *,
    org_id: UUID,
) -> list[dict[str, Any]]:
    """Every install in ONE org, with the Expert's name and slug.

    One query per list call, so surfaces that show many Experts never fan out per bundle.
    ``org_id = $1`` is load-bearing — see the section header.
    """
    query = f"""
        SELECT {_INSTALL_COLUMNS},
            b.name AS expert_name,
            b.slug AS expert_slug
        FROM public.expert_installs i
        JOIN public.expert_bundles b ON b.id = i.expert_bundle_id
        LEFT JOIN public.folders f ON f.id = i.folder_id AND f.org_id = i.org_id
        WHERE i.org_id = $1
        ORDER BY i.created_at ASC;
    """
    rows = await pool.fetch(query, org_id)
    return [dict(r) for r in rows if r is not None]


async def claim_expert_install(
    pool: asyncpg.Pool,
    *,
    org_id: UUID,
    bundle_id: UUID,
    installed_by: UUID,
    corpus_version: str,
) -> dict[str, Any] | None:
    """Race-safe claim of the install for (org, Expert) — returns the row, or ``None``.

    ``None`` means another install currently holds the claim. That is NOT an error: the
    caller reports the current state and mints nothing. The upsert only takes over a row
    that is not ``installing``, or one whose claim is stale (older than 10 minutes — a
    crashed worker), so two workers (``WORKER_COUNT=2``) cannot both copy.

    ``installed_by`` is deliberately NOT overwritten on conflict: it records who first
    installed; ``set_expert_install_folder`` records the repairer when a folder is recreated.
    ``org_id = $1`` is load-bearing — see the section header.
    """
    query = """
        INSERT INTO public.expert_installs (
            org_id, expert_bundle_id, installed_by, corpus_version, status
        ) VALUES (
            $1, $2, $3, $4, 'installing'
        )
        ON CONFLICT (org_id, expert_bundle_id) DO UPDATE
        SET status = 'installing',
            corpus_version = EXCLUDED.corpus_version,
            error = NULL,
            updated_at = now()
        WHERE public.expert_installs.status <> 'installing'
           OR public.expert_installs.updated_at < now() - interval '10 minutes'
        RETURNING *;
    """
    row = await pool.fetchrow(query, org_id, bundle_id, installed_by, corpus_version)
    return dict(row) if row is not None else None


async def set_expert_install_folder(
    pool: asyncpg.Pool,
    *,
    org_id: UUID,
    bundle_id: UUID,
    folder_id: UUID,
    installed_by: UUID,
) -> dict[str, Any] | None:
    """Point the org's install at its (new or recreated) knowledge folder.

    The org predicate means an install can only ever be pointed from inside its own org;
    the resolver still re-proves the folder's org on every read (defence in depth).
    ``org_id = $1`` is load-bearing — see the section header.
    """
    query = """
        UPDATE public.expert_installs
        SET folder_id = $3,
            installed_by = $4,
            updated_at = now()
        WHERE org_id = $1
          AND expert_bundle_id = $2
        RETURNING *;
    """
    row = await pool.fetchrow(query, org_id, bundle_id, folder_id, installed_by)
    return dict(row) if row is not None else None


async def set_expert_install_status(
    pool: asyncpg.Pool,
    *,
    org_id: UUID,
    bundle_id: UUID,
    status: str,
    error: str | None,
) -> dict[str, Any] | None:
    """Record what the installer knows about the COPY step (installing | installed | failed).

    Corpus readiness is derived at read time from the documents, never stored here twice.
    The status CHECK lives in migration 195. ``org_id = $1`` is load-bearing — see the
    section header.
    """
    query = """
        UPDATE public.expert_installs
        SET status = $3,
            error = $4,
            updated_at = now()
        WHERE org_id = $1
          AND expert_bundle_id = $2
        RETURNING *;
    """
    row = await pool.fetchrow(query, org_id, bundle_id, status, error)
    return dict(row) if row is not None else None


async def list_install_corpus_documents(
    pool: asyncpg.Pool,
    *,
    org_id: UUID,
    folder_ids: list[UUID],
    filenames: list[str],
) -> list[dict[str, Any]]:
    """The org's LATEST documents for a corpus, matched by folder and filename.

    Drives idempotent re-install (present and not failed → left untouched; failed → re-driven
    in place; absent → minted) and derived readiness. ``is_latest = true`` mirrors retrieval,
    which reads only latest versions. ``org_id = $1`` is load-bearing — a two-org admin's
    same-named document in ANOTHER org must never count as this org's copy.
    """
    query = """
        SELECT id, folder_id, filename, status, chunk_count, error_message,
               user_id, file_path, mime_type, content_hash
        FROM public.documents
        WHERE org_id = $1
          AND folder_id = ANY($2::uuid[])
          AND is_latest = true
          AND filename = ANY($3::text[]);
    """
    rows = await pool.fetch(query, org_id, folder_ids, filenames)
    return [dict(r) for r in rows if r is not None]

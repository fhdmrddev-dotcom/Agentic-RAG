"""Phase 284 (D-20 / P-1) — the synthetic scale account, and the PRE-284 visible-set rule kept as
a REFERENCE ORACLE.

Importable by ``scripts/seed-scale-284.py``, ``scripts/measure-library-284.py`` and the live
``test_284_*`` suites, so the e-mails, the password and the oracle have ONE home.

⛔ PRODUCT CODE MUST NEVER IMPORT THIS MODULE. ``legacy_visible_latest_ids`` holds the Library's
visible set exactly as ``GET /documents`` computed it BEFORE Phase 284 (own latest documents ∪
latest documents in org-shared folders the caller does not own, via the PURE
``app.utils.folder_utils.is_in_global_subtree``). Migration 207 moves that rule into SQL
(``public.library_documents``); this function exists only so parity P-1 can compare the two —
the new home against the old rule — for the synthetic owner, the empty peer and the operator's
dev account. It REUSES the rule; it never restates the subtree walk in SQL, because a parity
check whose oracle shares the new code's mistakes proves nothing.

Invariants:
  * Everything here reads; nothing writes.
  * ``legacy_visible_latest_ids`` runs under ``_apply_rls_user_context`` (``SET LOCAL ROLE
    authenticated`` + the caller's claims), so the folders it walks are the folders the caller's
    RLS admits — the same input the old user-JWT ``fetch_all_folders`` read received. asyncpg is
    not PostgREST: there is no 1,000-row cap here, and the document read pages by keyset anyway.
  * The connection handed in must NOT already be inside a transaction: ``SET LOCAL`` lives until
    the OUTERMOST commit, so running inside a caller's transaction would leave the role swapped
    for the caller's later statements. The function refuses that shape rather than risk it.
"""
from __future__ import annotations

from uuid import UUID

from supabase import Client, create_client

from tests.integration._271_gotrue_users import _local_env, user_client  # noqa: F401 (re-export)

SCALE_OWNER_EMAIL = "scale284@example.com"
SCALE_PEER_EMAIL = "scale284-b@example.com"
#: A fixed LOCAL-ONLY password. These two users exist only on the loopback dev stack (the seed
#: refuses any SUPABASE_URL that is not loopback), so a constant is the right trade: the G-4
#: drive and every live suite can sign in without a secrets file.
SCALE_PASSWORD = "Scale284-local-only-not-a-secret"
SCALE_ORG_NAME = "Scale 284"
SHARED_FOLDER_NAME = "Shared 284"
BIG_FOLDER_NAME = "Big"
CHUNKY_FILENAME = "scale284-2500-chunks.pdf"
DEV_ACCOUNT_EMAIL = "fhdmrd@gmail.com"

_KEYSET_PAGE = 5000


def sign_in(email: str, password: str = SCALE_PASSWORD) -> str:
    """GoTrue password grant through the ANON key. Returns the access token."""
    env = _local_env()
    anon: Client = create_client(env["SUPABASE_URL"], env["SUPABASE_ANON_KEY"])
    session = anon.auth.sign_in_with_password({"email": email, "password": password}).session
    if session is None or not session.access_token:
        raise RuntimeError(f"GoTrue sign-in for {email} returned no session")
    return session.access_token


async def uid_for_email(conn, email: str) -> str | None:
    row = await conn.fetchrow("SELECT id FROM auth.users WHERE lower(email) = lower($1)", email)
    return str(row["id"]) if row else None


async def legacy_visible_latest_ids(conn, uid: str) -> set[str]:
    """The PRE-284 Library visible set for ``uid`` (latest versions only), as a set of ids.

    Mirrors ``get_globally_visible_folder_ids`` + the two ``list_documents`` legs:
      1. the caller's org ids (``_resolve_caller_org_ids``: ``org_members`` WHERE user_id = uid);
      2. every RLS-visible folder (``fetch_all_folders`` over the user-JWT client);
      3. the global folder ids = folders NOT owned by the caller for which the PURE
         ``is_in_global_subtree`` is true;
      4. latest documents WHERE user_id = uid OR folder_id = ANY(global ids).
    """
    from app.dependencies import _apply_rls_user_context  # noqa: PLC0415
    from app.utils.folder_utils import is_in_global_subtree  # noqa: PLC0415

    if conn.is_in_transaction():
        raise RuntimeError(
            "legacy_visible_latest_ids needs a connection OUTSIDE a transaction "
            "(SET LOCAL would outlive this call inside the caller's transaction)"
        )
    async with conn.transaction():
        await _apply_rls_user_context(conn, uid)
        org_rows = await conn.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1", UUID(uid)
        )
        caller_org_ids = {str(r["org_id"]) for r in org_rows if r["org_id"] is not None}
        folder_rows = await conn.fetch(
            "SELECT id, user_id, parent_id, is_org_shared, org_id FROM public.folders"
        )
        folder_map = {
            str(r["id"]): {
                "id": str(r["id"]),
                "user_id": str(r["user_id"]),
                "parent_id": str(r["parent_id"]) if r["parent_id"] else None,
                "is_org_shared": r["is_org_shared"],
                "org_id": str(r["org_id"]) if r["org_id"] else None,
            }
            for r in folder_rows
        }
        cache: dict = {}
        global_ids = [
            UUID(fid) for fid, f in folder_map.items()
            if f["user_id"] != str(uid)
            and is_in_global_subtree(fid, folder_map, cache, caller_org_ids)
        ]
        out: set[str] = set()
        last: UUID | None = None
        while True:
            rows = await conn.fetch(
                "SELECT id FROM public.documents "
                "WHERE is_latest AND (user_id = $1 OR folder_id = ANY($2::uuid[])) "
                "AND ($3::uuid IS NULL OR id > $3) ORDER BY id LIMIT $4",
                UUID(uid), global_ids, last, _KEYSET_PAGE,
            )
            if not rows:
                break
            out.update(str(r["id"]) for r in rows)
            last = rows[-1]["id"]
            if len(rows) < _KEYSET_PAGE:
                break
        return out

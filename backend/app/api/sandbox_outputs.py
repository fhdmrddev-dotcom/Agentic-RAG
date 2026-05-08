"""
Sandbox-outputs re-sign endpoint (D-067.2-03).

Replaces the legacy harvest_output_files behavior of embedding a 1-hour
Supabase signed URL in assistant message content. Each click on a sandbox
output now hits this endpoint, which:

  1. Authenticates the user (existing get_current_user dependency).
  2. Performs an ownership fence:
     a. Path-segment match: storage_path[0] must equal current_user["id"].
     b. sandbox_files row exists for (storage_path, user_id).
     Either failing → 404 (per project invariant D-062-12 — 404 not 403,
     to avoid leaking file existence to other users; see Phase 067.2-03
     PLAN.md <deviation_note> for rationale).
  3. Generates a fresh 60s-TTL signed URL via Supabase Storage.
  4. Returns 302 redirect to the signed URL — browser follows the redirect
     and downloads from Supabase CDN directly (no proxy bytes through
     FastAPI; keeps workers free, bandwidth light).

D-v2.5-01: every supabase-py sync call is wrapped via aexec (Postgres) or
run_in_threadpool (Storage). No direct .execute() inside async handlers.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.utils.db import aexec

router = APIRouter(prefix="/sandbox-outputs", tags=["sandbox-outputs"])


@router.get("/{storage_path:path}")
async def get_sandbox_output(
    storage_path: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Step 1: ownership fence — path-segment match.
    # storage_path layout (sandbox_service.py:103): "{user_id}/{execution_id}/{filename}"
    # First path segment MUST equal current_user["id"]. Reject on mismatch
    # with 404 per project invariant D-062-12 (existence-leak prevention).
    # This also structurally blocks path-traversal: parts[0] is required to
    # equal a UUID, so "../" or absolute-path tricks cannot bypass user scoping.
    parts = storage_path.split("/", 2)
    if len(parts) < 3 or parts[0] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    # Step 2: defense-in-depth — verify a sandbox_files row exists for this
    # (storage_path, user_id) tuple. Mirrors runs.py:331-352 ownership-fence.
    file_resp = await aexec(
        supabase.table("sandbox_files")
        .select("id")
        .eq("storage_path", storage_path)
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = file_resp.data if file_resp is not None else None
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )

    # Step 3: short-TTL re-sign. 60s is enough for the 302 → CDN fetch hop.
    # supabase.storage.from_(...).create_signed_url is a sync HTTP call to
    # the Supabase Storage API; wrap in run_in_threadpool per D-v2.5-01.
    signed = await run_in_threadpool(
        supabase.storage.from_("sandbox-outputs").create_signed_url,
        storage_path,
        60,
    )
    if isinstance(signed, dict):
        url = (
            signed.get("signedURL")
            or signed.get("signedUrl")
            or signed.get("signed_url")
        )
    else:
        url = (
            getattr(signed, "signedURL", None)
            or getattr(signed, "signedUrl", None)
        )
    if not url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sign URL",
        )

    # Step 4: 302 redirect. HTTP 302 (not 307) — request is idempotent GET,
    # no method-preservation requirement. Browser follows to Supabase CDN.
    return RedirectResponse(url=url, status_code=302)

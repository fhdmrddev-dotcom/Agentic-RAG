"""Phase 063 Plan 05 — test-only fixture endpoints (e2e harness support).

These endpoints exist solely to support the Phase 063 e2e specs. They are
mounted ONLY when the ``ENABLE_TEST_FIXTURES`` environment variable is set
to ``"1"``; under any other value (including unset / ``"0"`` / ``"true"``
spelled differently) the router is NOT registered with the FastAPI app.

Production deployments MUST NOT set this env var. CI/staging/prod env
files should leave it unset; ``backend/.env.example`` does not include it.
The only legitimate caller is the local Playwright harness used for
063-resume-failed.spec.ts (see e2e/tests/063-resume-failed.spec.ts) which
needs a deterministic way to produce a ``runs.status='failed'`` row so
the Resume button can render.

Threat T-063-05-01 mitigation:
  - Mount-time gate in app/main.py (env var check; warning log when
    enabled).
  - Auth dependency preserved (Depends(get_current_user)).
  - Insert is scoped to the current user's id — no cross-user privilege
    escalation; T-063-05-03 disposition documents this.

Why a separate module rather than inlining in main.py:
  - Keeps test surface clearly identifiable in code review.
  - Lets the import + router-mount be conditional on the env var without
    polluting main.py with production-relevant code (single conditional
    block at the bottom of main.py, no test-only globals).
"""
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.utils.db import aexec

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/__test__/inject-failed-run/{thread_id}")
async def inject_failed_run(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Insert a ``runs`` row with ``status='failed'`` for e2e Resume-button testing.

    The Phase 063 Resume button (D-063-04, MessageItem.tsx) renders only
    when ``message.runStatus === 'failed'`` AND ``role === 'assistant'``.
    To test that affordance end-to-end, the e2e harness needs a
    deterministic way to produce a failed assistant message + linked
    failed run. This endpoint does both atomically:

      1. INSERT messages row (role='assistant', content=brief failure
         placeholder so MessageList renders something next to the Resume
         button — Plan 04 placed the button inside the
         ``message.content ?`` ternary branch).
      2. INSERT runs row (status='failed', error='test_injected',
         message_id linked to the assistant message).

    Returns ``{run_id, message_id}``. The harness uses these for stable
    selectors / cleanup.

    Auth: standard ``Depends(get_current_user)`` — same surface as any
    production endpoint. The runs row is scoped to ``current_user["id"]``
    so RLS protects against cross-user injection (T-063-05-03 disposition).

    Production safety: this route is NOT registered unless
    ``ENABLE_TEST_FIXTURES=1`` at process startup; see ``app.main``
    bottom-of-file conditional.
    """
    # Validate the caller actually owns the target thread before injecting
    # rows on it. Without this check, a user with valid auth could inject
    # failed runs on someone else's threads — though RLS would also block
    # the supabase write, the explicit ownership SELECT here matches the
    # production security pattern (D-062-12 "ownership SELECT runs first").
    thread_resp = await aexec(
        supabase.table("threads")
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    thread_row = thread_resp.data if thread_resp is not None else None
    if not thread_row:
        # 404 (NOT 403) per D-062-12 to avoid leaking thread existence.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # Step 1: insert assistant message with failure placeholder content.
    msg_id = uuid.uuid4()
    await aexec(
        supabase.table("messages").insert({
            "id": str(msg_id),
            "thread_id": thread_id,
            "user_id": current_user["id"],
            "role": "assistant",
            "content": "[test-injected failed run]",
        })
    )

    # Step 2: insert runs row with status='failed'.
    run_id = uuid.uuid4()
    await aexec(
        supabase.table("runs").insert({
            "run_id": str(run_id),
            "thread_id": thread_id,
            "user_id": current_user["id"],
            "message_id": str(msg_id),
            "status": "failed",
            "error": "test_injected",
            "model": "test",
            "provider": "test",
        })
    )

    logger.warning(
        "test_fixtures.inject_failed_run: injected failed run %s on thread %s "
        "(message %s) for user %s",
        run_id, thread_id, msg_id, current_user.get("id"),
    )

    return {"run_id": str(run_id), "message_id": str(msg_id)}

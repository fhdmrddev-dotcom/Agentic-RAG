"""Phase 181 (REVERT-01 / D-181-04) — TEMPORARY canary route for the require_canvas gate.

This module exists ONLY to prove ``require_canvas``'s 404-when-off posture end-to-end via a
TestClient NOW, before any real canvas route exists (the ``test_181_flip_on`` +
``test_revert_byte_identical`` integration asserts hit ``GET /canvas/ping``).

REMOVE / REPURPOSE when the first real canvas route lands (182/183): the real routes carry
the SAME ``dependencies=[Depends(require_canvas())]`` attach, so this throwaway probe is no
longer needed once a genuine ``/canvas`` route can exercise the gate. Until then it is the
ONLY thing under the ``/canvas`` prefix, so while the flag is off it is indistinguishable
from an unknown path (a byte-identical 404 — never a 403 that would leak its existence).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import require_canvas

router = APIRouter(tags=["canvas-canary"])


@router.get("/canvas/ping", dependencies=[Depends(require_canvas())])
async def canvas_ping() -> dict:
    """A throwaway liveness probe behind require_canvas() (D-181-04).

    Unreachable while the flag is off — the gate raises a 404 BEFORE this handler runs, so
    the route is byte-identical to a path that was never built. Returns ``{"ok": True}`` only
    once an operator flips the canvas on.
    """
    return {"ok": True}

"""Phase 304 (D-13, D-14) — the org a personal MCP key acts in, as a ContextVar. A LEAF.

This module imports nothing from ``app.``, on purpose: ``app.dependencies`` reads the value (inside
``_apply_rls_user_context``) and ``app.security.acting_member`` sets it while needing
``get_user_pg_connection`` from ``app.dependencies``. A leaf breaks that cycle.

THE RULES
  · The ONLY setter is ``app/security/acting_member.py`` (``acting_org_scope`` / ``acting_as``),
    which validates the value with ``uuid.UUID`` and resets the token on scope exit. A static fence
    (``tests/unit/test_304_acting_reads_fence.py``) fails if any other module names ``_acting_org``.
  · The value NEVER comes from a client header or a request value. It is the org recorded on the
    key row, chosen by the server when the key resolves.
  · When set, ``_apply_rls_user_context`` binds it as ``$1`` to
    ``set_config('app.acting_org_id', $1, true)``; ``current_user_org_ids()`` (mig 221) then
    intersects the caller's membership with it. It can only NARROW: an org the caller does not
    belong to yields no org at all.
  · A malformed value would make the ``::uuid`` cast in the function raise, so the statement errors
    — it fails closed. The setter validates first, so that path is a backstop, not a mechanism.
"""

from __future__ import annotations

from contextvars import ContextVar

_acting_org: ContextVar[str | None] = ContextVar("acting_org_id", default=None)


def current_acting_org() -> str | None:
    """The canonical org UUID string the current context acts in, or None (= every org, today)."""
    return _acting_org.get()

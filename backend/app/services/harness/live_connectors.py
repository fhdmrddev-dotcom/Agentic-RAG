"""302-02 (BE-IN-01 / D-06 / D-27) — the ONE reading of "are live connectors fully on?".

Both the external-action executor (``phase_types.py`` gate 2) and the judge's
``recording_by_design`` (``validator_kinds.py``) read it, so the two can never disagree inside the
settings cache TTL — before this, the judge read ``feature_audience`` raw and could call a recording
"by design" while the executor had just refreshed and sent (296-REVIEW BE-IN-01).

The reasoning lives beside the executor gate in ``phase_types.py`` and is not repeated here:
CR-02 (bound the staleness first — await ``ensure_settings_fresh``, which is TTL-checked and never
raises) and CR-03 (a POSITIVE ``== "everyone"`` test, fail-closed for ``role`` / ``operators`` /
``off`` / any audience added later).

``fresh`` / ``audience`` exist so the executor can pass the names from its OWN module namespace:
the kill-switch drives stub ``phase_types.ensure_settings_fresh`` / ``phase_types.feature_audience``
with ``monkeypatch.setattr`` (see the CR-02 note at its import block). Left as ``None`` they
resolve through ``app.models.user_settings`` at call time.
"""
from __future__ import annotations

from typing import Awaitable, Callable

LIVE_CONNECTORS_FEATURE = "live_connectors"


async def live_connectors_fully_on(
    *,
    fresh: Callable[[], Awaitable[None]] | None = None,
    audience: Callable[[str], str] | None = None,
) -> bool:
    """True only when the operator's ``live_connectors`` switch reads ``everyone`` AFTER a
    freshness check. Never raises (``ensure_settings_fresh`` never raises)."""
    if fresh is None or audience is None:
        from app.models import user_settings  # noqa: PLC0415 — call-time lookup (patchable)

        fresh = fresh or user_settings.ensure_settings_fresh
        audience = audience or user_settings.feature_audience
    await fresh()
    return audience(LIVE_CONNECTORS_FEATURE) == "everyone"

"""BUG-260907-03 — a DISABLED connection must not read the source.

⛔ THE DEFECT THIS CLOSES, driven live on 2026-09-07 against a real personal OneDrive:

    connector_connections:  is_enabled = False
    >>> adapter.browse(conn, folder_id="onedrive")
    returned 6 real folders: ['Apps','Attachments','Desktop','Dokument','Pictures','Videos']

Not a cache — `get_fresh_access_token` minted a token from the stored refresh token and a real
HTTPS call went to graph.microsoft.com, for a connection the operator had switched OFF.

`grep -rn is_enabled` found **one** check in the whole codebase — `watch_service.py:205`, which
pauses the scheduled loop — and **none** in `api/connectors.py` or anywhere under
`services/sources/`. So *Disable* stopped the background loop and left browse, preview and import
fully live.

⛔ NOT Graph-specific. The unguarded code is the SHARED source path; Google Drive has had the
same hole since Phase 232. Phase 238 only surfaced it because M-8 was driven for the first time.

⭐ THE FIX IS ONE CHOKE POINT, NOT FIVE ROUTE EDITS. Every source operation already funnels
through `SourceRegistry.get_adapter(connection)`, so that is where a disabled connection is
refused — which also covers the sixth caller nobody has written yet.
"""

from __future__ import annotations

import inspect
from pathlib import Path

import pytest

from app.services.sources.base import (
    SourceConnectionDisabled,
    SourceRegistry,
)

BACKEND = Path(__file__).resolve().parents[4]


def _conn(**over):
    base = {"id": "11111111-2222-3333-4444-555555555555", "service_id": "microsoft"}
    base.update(over)
    return base


# ── the refusal ──────────────────────────────────────────────────────────────────────────


def test_a_disabled_connection_is_refused_at_the_choke_point():
    with pytest.raises(SourceConnectionDisabled):
        SourceRegistry.get_adapter(_conn(is_enabled=False))


def test_the_refusal_carries_the_shared_machine_readable_cause():
    """`connection_disabled` already exists in `services/sources/failure_cause.py`. Reusing it
    rather than inventing a second vocabulary is what lets one surface word this one way."""
    with pytest.raises(SourceConnectionDisabled) as exc:
        SourceRegistry.get_adapter(_conn(is_enabled=False))
    assert exc.value.reason_code == "connection_disabled"


def test_an_object_shaped_connection_is_refused_too():
    """Routes hand this a `ConnectorConnectionResponse`, not a dict."""

    class _Row:
        id = "abc"
        service_id = "microsoft"
        is_enabled = False

    with pytest.raises(SourceConnectionDisabled):
        SourceRegistry.get_adapter(_Row())


# ── the non-regressions, which matter as much ────────────────────────────────────────────


def test_an_enabled_connection_still_resolves():
    assert SourceRegistry.get_adapter(_conn(is_enabled=True)) is not None


def test_a_connection_with_NO_is_enabled_key_still_resolves():
    """⚠ Load-bearing. Every existing caller and fixture omits the key, and defaulting to
    REFUSED would break every one of them — turning a security fix into an outage. Absent means
    'nobody said it was off', which is the same reading `watch_service.py:205` already uses."""
    assert SourceRegistry.get_adapter(_conn()) is not None


def test_a_bare_service_id_string_still_resolves():
    """A string carries no connection context, so there is nothing to judge. `watch_service`
    and several suites resolve this way."""
    assert SourceRegistry.get_adapter("mock_source") is not None


def test_an_unknown_service_still_returns_None_rather_than_raising():
    """The refusal must not swallow the ordinary 'no adapter' answer — they are different
    facts and callers branch on them differently."""
    assert SourceRegistry.get_adapter("unknown_provider") is None
    assert SourceRegistry.get_adapter(_conn(service_id="unknown_provider")) is None


# ── the loop's own behaviour is PRESERVED, not replaced ──────────────────────────────────


def test_the_watch_loop_still_pauses_rather_than_raising():
    """⚠ `watch_service` must keep PAUSING with a recorded cause — it is the surface that tells
    a person why a source stopped (Phase 235). It checks `is_enabled` BEFORE resolving an
    adapter, so it never reaches the new refusal; this pins that ordering, because reversing it
    would convert a legible pause into an exception."""
    src = (BACKEND / "app" / "services" / "watch_service.py").read_text(encoding="utf-8")
    guard = src.index('if not conn.get("is_enabled", True):')
    resolve = src.index("SourceRegistry.get_adapter(conn)")
    assert guard < resolve, (
        "watch_service must check is_enabled BEFORE resolving an adapter, or its pause becomes "
        "a raise and the source stops explaining itself"
    )


# ── the choke point is the ONLY thing that has to be right ───────────────────────────────


def test_every_production_caller_goes_through_the_choke_point():
    """⭐ The property that makes this a one-place fix: no source route resolves an adapter by
    any other route. If a caller ever reaches into `_adapters` directly, it bypasses the guard
    and this fails."""
    offenders: list[str] = []
    for rel in (
        "app/api/connectors.py",
        "app/services/sources/import_service.py",
        "app/services/sources/preview_service.py",
        "app/services/watch_service.py",
    ):
        src = (BACKEND / rel).read_text(encoding="utf-8")
        if "_adapters[" in src or "_adapters.get(" in src:
            offenders.append(rel)
    assert not offenders, f"these bypass SourceRegistry.get_adapter: {offenders}"


def test_the_guard_can_actually_fire():
    """THE POSITIVE CONTROL. Without it, every assertion above is 'we found nothing', which is
    indistinguishable from 'we looked for nothing' — the failure mode Phase 238's own boundary
    fence had."""
    sig = inspect.signature(SourceRegistry.get_adapter)
    assert "connection_or_service_id" in sig.parameters

    raised = False
    try:
        SourceRegistry.get_adapter(_conn(is_enabled=False))
    except SourceConnectionDisabled:
        raised = True
    assert raised, "the guard did not fire on the exact input it exists for"

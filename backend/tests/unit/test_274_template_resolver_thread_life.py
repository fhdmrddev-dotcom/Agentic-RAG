"""Phase 274 review WR-01 — a THREAD-LIFE chat attachment is never a WORKFLOW template.

Phase 274 split the two `kind='template_input'` doors by lifetime (D-06): a composer attachment is
written with `expires_at = NULL` and lives as long as its thread; a workflow template input (the
panel's `TemplateUpload`, D-21) keeps its 24 h TTL. `resolve_template_source`'s Branch 2 still
admitted `expires_at IS NULL`, so it took the newest attachment of ANY kind of file as the template.

Driven before this test was written (rollback-only, local DB, 2026-10-05): with a
`template_input` PDF at `expires_at NULL` in a thread, the Branch-2 SELECT bound to a workflow
run W1 returned that PDF, W1's conditional stamp claimed it (`run_claim = W1`), and a later run W2
could no longer see it — with no expiry left to ever clear the claim.

`render_template` is a workflow-FILL-only tool (`get_tools` carries none), so the claim that
resolves Branch 2 is a workflow run id. The `'deep'` sentinel and `own_claim=None` (legacy) keep
admitting thread-life rows, byte-for-byte as before.

Stubbed: the recorder pool captures `(sql, args)`; no row is created by this file.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.services.template_asset_service import DEEP_CLAIM, resolve_template_source

THREAD = "11111111-1111-4111-8111-111111111111"
USER = "33333333-3333-4333-8333-333333333333"
W1 = "a0ca6546-f557-4414-8f42-35001c7d65b1"

THREAD_LIFE_GATE = "(expires_at IS NOT NULL OR $3::text IS NULL OR $3::text = 'deep')"


def _branch2_selects(pool) -> list[tuple[str, tuple]]:
    return [
        (sql, args)
        for sql, args in pool.calls
        if "SELECT" in sql.upper() and "kind = 'template_input'" in sql
    ]


@pytest.mark.asyncio
async def test_a_workflow_run_never_resolves_a_thread_life_chat_attachment(mock_asyncpg_pool):
    """PLANT to drive RED: drop the gate from any one of the three Branch-2 reads. The main read
    then hands a weeks-old chat PDF to the renderer; the foreign probe reports a chat file as
    "belongs to a different run"; the expired probe reports a live chat file as "expired"."""
    out = await resolve_template_source(
        pool=mock_asyncpg_pool, supabase=MagicMock(), thread_id=THREAD, user_id=USER, own_claim=W1,
    )
    selects = _branch2_selects(mock_asyncpg_pool)
    assert len(selects) == 3, "main read + foreign probe + expired probe (non-vacuity)"
    for sql, args in selects:
        assert THREAD_LIFE_GATE in sql, sql
        assert len(args) >= 3 and args[2] == W1, "the gate is keyed on the resolving claim"
    assert out["bytes"] is None
    assert out["error"].startswith("No template uploaded")


@pytest.mark.asyncio
@pytest.mark.parametrize("claim", [DEEP_CLAIM, None], ids=["deep", "legacy-none"])
async def test_deep_and_legacy_resolves_still_admit_a_thread_life_row(mock_asyncpg_pool, claim):
    """The gate is a no-op for the `'deep'` sentinel and for `own_claim=None`: both bind a $3 the
    gate reads as "admit NULL expiry" — the pre-274 behaviour, unchanged."""
    await resolve_template_source(
        pool=mock_asyncpg_pool, supabase=MagicMock(), thread_id=THREAD, user_id=USER, own_claim=claim,
    )
    selects = _branch2_selects(mock_asyncpg_pool)
    assert selects, "non-vacuity"
    for sql, args in selects:
        assert THREAD_LIFE_GATE in sql
        assert args[2] == claim

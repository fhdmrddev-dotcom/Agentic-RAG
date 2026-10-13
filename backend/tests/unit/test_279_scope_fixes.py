"""Phase 279 (SEAM-01 / SEED-328) — the two scope fixes that land after the pure move.

* **D-07 — restricted → restricted no longer over-states.** ``build_expert_changed_event`` set
  ``excluded`` (the "won't be searched" sub-line inside the Dropped row) from the AFTER side alone.
  A swap between two restricted Experts on a folder-scoped thread therefore said the thread folder's
  documents were newly lost, although the previous Expert never read them either. ``excluded`` is
  now computed against the PREVIOUS side's effective scope: it is set only when the previous side
  read the thread folder (or everything). ``_dropped_line`` is untouched (268 shares it), and no
  existing 267/268 fixture line changes. The new fixture is the real builder's output.
"""
from __future__ import annotations

import json
import pathlib
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from tests.unit.test_267_scope_preview import (
    ACME_FOLDER,
    BUNDLES,
    FA_ID,
    FIN_FOLDER,
    HR_ID,
    FakeSupabase,
    describe,
    resolved,
)

AT = datetime(2026, 9, 25, 14, 32, tzinfo=timezone.utc)
FIXTURES_279 = pathlib.Path(__file__).resolve().parent.parent / "fixtures" / "phase279"

# A second RESTRICTED Expert (the existing roster has one: HR Advisor).
LEGAL_ID = "e4000000-0000-4000-8000-0000000000d4"
LEGAL = resolved(LEGAL_ID, "Legal Advisor", "restricted", [FIN_FOLDER])
R2R_BUNDLES = {**BUNDLES, LEGAL_ID: LEGAL}


async def _event(before_id, after_id, thread_folder=ACME_FOLDER):
    from app.services.expert_scope_events import build_expert_changed_event

    before = await describe(FakeSupabase(), before_id, thread_folder, bundles=R2R_BUNDLES)
    after = await describe(FakeSupabase(), after_id, thread_folder, bundles=R2R_BUNDLES)
    return build_expert_changed_event(before, after, at=AT), after


# ── D-07 ──────────────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_D07_restricted_to_restricted_states_no_exclusion():
    ev, after = await _event(LEGAL_ID, HR_ID)
    assert after.excluded_count > 0  # non-vacuity: the AFTER side alone WOULD have stated one
    assert ev.excluded is None


@pytest.mark.asyncio
async def test_D07_plain_to_restricted_keeps_the_exclusion():
    ev, after = await _event(None, HR_ID)
    assert ev.excluded is not None and ev.excluded.count == after.excluded_count


@pytest.mark.asyncio
async def test_D07_biased_with_a_thread_folder_to_restricted_keeps_the_exclusion():
    ev, after = await _event(FA_ID, HR_ID)
    assert ev.excluded is not None and ev.excluded.count == after.excluded_count == 4


@pytest.mark.asyncio
async def test_D07_the_restricted_to_restricted_fixture_is_the_real_builders_output():
    ev, _after = await _event(LEGAL_ID, HR_ID)
    fixture = json.loads(
        (FIXTURES_279 / "expert_changed_restricted_to_restricted.json").read_text(encoding="utf-8")
    )
    assert fixture == ev.model_dump(mode="json")
    assert fixture["excluded"] is None

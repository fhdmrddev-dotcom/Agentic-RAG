"""Integration tests for the TRIG-03 description lint across all three save surfaces.

The lint is warn-never-block (D-09/D-10/Pitfall 6):
- POST /skills with a weak description → 201 (save proceeded) AND lint_warnings non-empty
- PATCH /skills/{id} with a weak description → 200 (save proceeded) AND lint_warnings non-empty
- A healthy description → save proceeds with lint_warnings == []
- The agent save_skill tool path → returns warnings in the tool result WITHOUT raising

The lint NEVER changes the HTTP status or the agent flow — it only annotates.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

USER_ID = "00000000-0000-0000-0000-000000000001"
SKILL_ID = str(uuid4())
NOW = datetime.now(timezone.utc).isoformat()

# A weak description: short + no trigger verb + echoes name.
WEAK_DESC = "Helper helper"
# A healthy description: actionable + specific + long enough.
HEALTHY_DESC = "Use to generate a quarterly risk register from KB documents"


def _skill_row(name="Helper", description=WEAK_DESC, skill_id=None):
    return {
        "id": skill_id or SKILL_ID,
        "user_id": USER_ID,
        "name": name,
        "description": description,
        "instructions": "do the thing",
        "is_enabled": True,
        "is_global": False,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _result(data):
    r = MagicMock()
    r.data = data
    return r


# ── POST /skills ───────────────────────────────────────────────────────────────

class TestCreateLint:
    def test_weak_description_returns_201_and_warnings(self, client, auth_headers, mock_builder):
        """Save proceeds (201) and lint_warnings is non-empty for a weak description."""
        # create_skill does: sibling-fetch (.execute) then insert (.execute)
        mock_builder.execute.side_effect = [
            _result([]),                                  # siblings (none)
            _result([_skill_row(description=WEAK_DESC)]),  # insert
        ]
        resp = client.post("/skills", headers=auth_headers, json={
            "name": "Helper",
            "description": WEAK_DESC,
            "instructions": "do the thing",
        })
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["lint_warnings"], "expected non-empty lint_warnings for a weak description"
        assert all("code" in w and "message" in w for w in body["lint_warnings"])

    def test_healthy_description_returns_201_and_no_warnings(self, client, auth_headers, mock_builder):
        mock_builder.execute.side_effect = [
            _result([]),                                     # siblings
            _result([_skill_row(name="Risk Register", description=HEALTHY_DESC)]),  # insert
        ]
        resp = client.post("/skills", headers=auth_headers, json={
            "name": "Risk Register",
            "description": HEALTHY_DESC,
            "instructions": "do the thing",
        })
        assert resp.status_code == 201, resp.text
        assert resp.json()["lint_warnings"] == []


# ── PATCH /skills/{id} ──────────────────────────────────────────────────────────

class TestUpdateLint:
    def test_weak_description_patch_returns_200_and_warnings(self, client, auth_headers, mock_builder):
        """PATCH proceeds (200) and lint_warnings is non-empty for a weak description."""
        # update_skill does: update (.execute) then sibling-fetch (.execute)
        mock_builder.execute.side_effect = [
            _result([_skill_row(description=WEAK_DESC)]),  # update result
            _result([]),                                    # siblings (excludes self)
        ]
        resp = client.patch(f"/skills/{SKILL_ID}", headers=auth_headers, json={
            "description": WEAK_DESC,
        })
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["lint_warnings"], "expected non-empty lint_warnings on weak PATCH"

    def test_patch_save_proceeds_even_with_warnings(self, client, auth_headers, mock_builder):
        """The lint never blocks: the row is returned with the updated description."""
        mock_builder.execute.side_effect = [
            _result([_skill_row(description=WEAK_DESC)]),
            _result([]),
        ]
        resp = client.patch(f"/skills/{SKILL_ID}", headers=auth_headers, json={
            "description": WEAK_DESC,
        })
        assert resp.status_code == 200
        assert resp.json()["description"] == WEAK_DESC  # update was applied


# ── empty / whitespace name rejection (WR-07 — hard gate, not advisory) ──────────

class TestEmptyNameRejected:
    def test_post_whitespace_name_returns_400(self, client, auth_headers, mock_builder):
        """POST with a whitespace-only name → 400 (a blank name breaks the catalog note +
        makes the skill unaddressable). The reject fires BEFORE any DB write."""
        resp = client.post("/skills", headers=auth_headers, json={
            "name": "   ",
            "description": HEALTHY_DESC,
            "instructions": "do the thing",
        })
        assert resp.status_code == 400, resp.text
        assert "name cannot be empty" in resp.json()["detail"].lower()
        # No insert was attempted (the guard short-circuits before the DB).
        mock_builder.insert.assert_not_called()

    def test_patch_whitespace_name_returns_400(self, client, auth_headers, mock_builder):
        """PATCH with a whitespace-only name → 400. The ``if not update_data`` guard does
        NOT catch this (the dict still carries ``name: ""``)."""
        resp = client.patch(f"/skills/{SKILL_ID}", headers=auth_headers, json={
            "name": "   ",
        })
        assert resp.status_code == 400, resp.text
        assert "name cannot be empty" in resp.json()["detail"].lower()
        # No update was attempted (the guard short-circuits before the DB).
        mock_builder.update.assert_not_called()


# ── agent save_skill tool path ──────────────────────────────────────────────────

class _FakeQuery:
    """A chainable query builder whose execute() pops the next queued result."""

    def __init__(self, results: list):
        self._results = results

    def __getattr__(self, _name):
        # Any builder method (.table/.select/.insert/.update/.eq/.or_/.limit/…) chains.
        def _chain(*_a, **_k):
            return self
        return _chain

    def execute(self):
        return self._results.pop(0)


class _FakeSupabase:
    def __init__(self, results: list):
        self._q = _FakeQuery(results)

    def table(self, _name):
        return self._q


@pytest.mark.asyncio
async def test_agent_save_skill_returns_warnings_without_raising():
    """_handle_save_skill never raises on a weak description; warnings ride in the result."""
    from app.services.tool_dispatcher import ToolContext, _handle_save_skill

    # Order of execute() calls inside _handle_save_skill for the INSERT branch:
    #   1. existing-name check (.limit(1)) -> no match
    #   2. owner-scoped sibling fetch (.or_)
    #   3. insert
    results = [
        _result([]),   # existing-name check: none
        _result([]),   # siblings: none
        _result([]),   # insert
    ]
    ctx = ToolContext(
        redis=MagicMock(),
        run_id=uuid4(),
        thread_id="t1",
        supabase=_FakeSupabase(results),
        pool=MagicMock(),
        user_settings=MagicMock(),
        current_user={"id": USER_ID},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=MagicMock(),
        spawn=MagicMock(),
    )
    out = await _handle_save_skill(
        {"name": "Helper", "description": WEAK_DESC, "instructions": "do the thing"},
        ctx,
    )
    payload = json.loads(out.result)
    assert payload["status"] == "created"   # save proceeded — NOT blocked
    assert payload["name"] == "Helper"
    assert payload["lint_warnings"], "expected non-empty lint_warnings in the tool result"


@pytest.mark.asyncio
async def test_agent_save_skill_healthy_description_no_warnings():
    from app.services.tool_dispatcher import ToolContext, _handle_save_skill

    results = [
        _result([]),   # existing-name check
        _result([]),   # siblings
        _result([]),   # insert
    ]
    ctx = ToolContext(
        redis=MagicMock(),
        run_id=uuid4(),
        thread_id="t1",
        supabase=_FakeSupabase(results),
        pool=MagicMock(),
        user_settings=MagicMock(),
        current_user={"id": USER_ID},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=MagicMock(),
        spawn=MagicMock(),
    )
    out = await _handle_save_skill(
        {"name": "Risk Register", "description": HEALTHY_DESC, "instructions": "x"},
        ctx,
    )
    payload = json.loads(out.result)
    assert payload["status"] == "created"
    assert payload["lint_warnings"] == []

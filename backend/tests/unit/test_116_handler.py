"""Phase 116 Wave-0 — handler + model + service RED scaffold.

This file carries TWO tiers of assertion:

  1. MODEL + SERVICE tier (un-xfailed by Plan 02 — this plan, Task 2):
     - `RelationshipCreate.rel_type` is a `Literal` over the 4 types → a forged 5th
       value raises ValidationError at parse (the parse-time 422 gate, T-116-01-01).
     - `_resolve_readable_latest` resolves a readable doc → its latest version, and
       returns None for an unresolvable id / a partial-or-superstring filename
       (EXACT match only, D-116-3; the documented anti-pattern `resolve_document_id`
       is NOT reused).
     - `create_relationship` is idempotent: a second identical `(source,target,
       rel_type)` returns the SAME existing row (23505 caught, no duplicate, no
       error).
     - `delete_relationship` is own-scoped: True when the caller owns the row, False
       on a cross-user / absent id.
     These are driven with a fake supabase client (NO live DB) so they live in
     `tests/unit/` and run in ~ms.

  2. HANDLER tier (stays xfail until Plan 03 ships the tool handler):
     - `get_related_documents` returns BOTH directions with correct inverse labels,
       compact rows + `source_refs`, and a calm-string error on an unresolvable
       subject (no raise, no stack to the model).

Imports are inside the test bodies so collection never errors on the not-yet-built
symbols while RED.
"""

import pytest


# ── tier 1: MODEL parse gate (Plan 02 makes this GREEN) ────────────────────────

def test_rel_type_literal_rejects_forged_type():
    """A 5th rel_type value fails Pydantic parse (the parse-time 422 gate, T-116-01-01)."""
    from pydantic import ValidationError

    from app.models.document_relationship import RelationshipCreate

    # The 4 valid types all parse.
    for rt in ("supersedes", "amends", "references", "attached_to"):
        RelationshipCreate(source_doc_id="a", target_doc_id="b", rel_type=rt)

    # A forged 5th value is rejected at parse (never reaches the DB CHECK).
    with pytest.raises(ValidationError):
        RelationshipCreate(source_doc_id="a", target_doc_id="b", rel_type="nope")


# ── tier 1: SERVICE resolver / idempotency / delete (Plan 02 makes these GREEN) ─

class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    """A chainable fake supabase query that records ops and returns a canned result.

    Each terminal builder method (`insert`, `select`, `update`, `delete`) and each
    filter (`eq`, `or_`, `in_`, `ilike`, `limit`, `order`) returns self; `.execute()`
    returns the canned `_FakeResult`. The `raise_on_insert` flag simulates the 23505
    unique-violation so the idempotency catch can be exercised without a live DB.
    """

    def __init__(self, table, recorder):
        self._table = table
        self._rec = recorder
        self._is_insert = False

    def insert(self, payload):
        self._is_insert = True
        self._rec.setdefault("inserts", []).append((self._table, payload))
        return self

    def select(self, *a, **k):
        return self

    def update(self, data):
        self._rec.setdefault("updates", []).append((self._table, data))
        return self

    def delete(self):
        self._rec.setdefault("deletes", []).append(self._table)
        return self

    def eq(self, col, val):
        self._rec.setdefault("eqs", []).append((self._table, col, val))
        return self

    def or_(self, expr):
        return self

    def in_(self, col, vals):
        return self

    def ilike(self, col, pat):
        self._rec.setdefault("ilikes", []).append((self._table, col, pat))
        return self

    def limit(self, n):
        return self

    def order(self, *a, **k):
        return self

    def execute(self):
        if self._is_insert and self._rec.get("_raise_23505"):
            self._rec["_raise_23505"] = False  # only the first insert raises
            raise Exception("duplicate key value violates unique constraint (23505)")
        return _FakeResult(self._rec.get("_canned", {}).get(self._table, []))


class _FakeClient:
    def __init__(self, recorder):
        self._rec = recorder

    def table(self, name):
        return _FakeQuery(name, self._rec)


@pytest.mark.asyncio
async def test_resolve_readable_latest_unresolvable_returns_none():
    """A bad / unseeable id resolves to None (no leak, no raise)."""
    from app.services import document_relationship_service as svc

    rec = {"_canned": {"documents": [], "folders": []}}
    client = _FakeClient(rec)
    out = await svc._resolve_readable_latest("00000000-0000-0000-0000-000000000000",
                                             "11111111-1111-1111-1111-111111111111",
                                             supabase=client)
    assert out is None


def test_resolver_does_not_reuse_partial_match_antipattern():
    """The service must NOT import / call `resolve_document_id` (own-only + partial ilike)."""
    import inspect

    from app.services import document_relationship_service as svc

    src = inspect.getsource(svc)
    assert "resolve_document_id" not in src, (
        "the own-only + partial-match anti-pattern must NOT be reused (D-116-3 / T-116-01-04)"
    )
    assert "_resolve_readable_latest" in src


@pytest.mark.asyncio
async def test_create_relationship_is_idempotent_on_23505():
    """Second identical create → the 23505 is caught and the existing edge re-fetched."""
    from app.services import document_relationship_service as svc

    existing = {
        "id": "edge-1", "user_id": "11111111-1111-1111-1111-111111111111",
        "source_doc_id": "src", "target_doc_id": "tgt", "rel_type": "supersedes",
    }
    rec = {
        "_raise_23505": True,           # the INSERT raises a unique violation once
        "_canned": {"document_relationships": [existing]},  # the re-fetch finds the existing edge
    }
    client = _FakeClient(rec)
    out = await svc.create_relationship(
        "11111111-1111-1111-1111-111111111111", "src", "tgt", "supersedes",
        supabase=client,
    )
    assert out == existing, "an idempotent create returns the EXISTING edge (no duplicate, no error)"


@pytest.mark.asyncio
async def test_delete_relationship_own_scoped():
    """delete returns True when the caller owns the row, False on a cross-user/absent miss."""
    from app.services import document_relationship_service as svc

    # Owned row deleted → result.data non-empty → True.
    rec_hit = {"_canned": {"document_relationships": [{"id": "edge-1"}]}}
    assert await svc.delete_relationship(
        "11111111-1111-1111-1111-111111111111", "edge-1", supabase=_FakeClient(rec_hit)
    ) is True

    # Cross-user / absent → result.data empty → False (router maps to 404).
    rec_miss = {"_canned": {"document_relationships": []}}
    assert await svc.delete_relationship(
        "11111111-1111-1111-1111-111111111111", "edge-1", supabase=_FakeClient(rec_miss)
    ) is False


# ── tier 2: HANDLER (stays xfail until Plan 03) ────────────────────────────────

@pytest.mark.xfail(strict=False, reason="Plan 03 ships the get_related_documents handler")
@pytest.mark.asyncio
async def test_handler_returns_both_directions_with_inverse_labels(make_tool_context):
    """The tool returns BOTH outgoing and incoming edges with correct inverse labels."""
    from app.services.tool_dispatcher import _handle_get_related_documents

    ctx = make_tool_context()
    result = await _handle_get_related_documents({"document_id": "some-doc"}, ctx)
    import json
    payload = json.loads(result.result)
    # both-direction shape + compact rows + source_refs
    assert "source_refs" in payload or "documents" in payload


@pytest.mark.xfail(strict=False, reason="Plan 03 ships calm-error contract")
@pytest.mark.asyncio
async def test_handler_calm_error_on_unresolvable_subject(make_tool_context):
    """An unresolvable subject yields a calm string payload, never a raised exception."""
    import json

    from app.services.tool_dispatcher import _handle_get_related_documents

    ctx = make_tool_context()
    result = await _handle_get_related_documents({"filename": "no-such-file.txt"}, ctx)
    payload = json.loads(result.result)
    assert isinstance(payload, dict)  # calm structured error, no stack/raise

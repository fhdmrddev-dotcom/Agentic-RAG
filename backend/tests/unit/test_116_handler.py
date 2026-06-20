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


# ── tier 2: HANDLER (un-xfailed by Plan 03 — this plan, Task 1) ────────────────
#
# These drive the REAL `_handle_get_related_documents` with a controlled in-process
# stub of the shared resolver + the edge queries (NO live DB), so they assert the
# net-new behavior deterministically: both directions, inverse labels, the leak-safe
# mask, and the calm-string contract. The LIVE two-user non-vacuous proof lives in
# `tests/integration/test_116_tool_leak.py` (Task 2).


class _EdgeResult:
    """A stand-in for the supabase edge-query response: just a `.data` list."""

    def __init__(self, rows):
        self.data = rows


class _EdgeQuery:
    """Chainable stub that records the `(source|target)_doc_id` in_() and returns canned rows.

    The handler builds: table("document_relationships").select(...).eq("user_id", ...)
    .in_("source_doc_id"|"target_doc_id", version_ids). `aexec` calls `.execute()`. We key
    the canned rows off which directional column was filtered.
    """

    def __init__(self, edges_by_dir):
        self._edges = edges_by_dir
        self._dir = None

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        return self

    def in_(self, col, vals):
        if col == "source_doc_id":
            self._dir = "outgoing"
        elif col == "target_doc_id":
            self._dir = "incoming"
        return self

    def execute(self):
        if self._dir == "outgoing":
            return _EdgeResult(list(self._edges.get("outgoing", [])))
        if self._dir == "incoming":
            return _EdgeResult(list(self._edges.get("incoming", [])))
        return _EdgeResult([])


class _DocVersionQuery:
    """Stub for the CR-02 `_subject_version_ids` lookup: table("documents").select("id")
    .eq("user_id", owner).eq("filename", fname). Returns the canned version-id rows so the
    handler enumerates edges over the subject's lineage. A single-version subject yields
    just [subject_id]."""

    def __init__(self, version_id_rows):
        self._rows = version_id_rows

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        return self

    def execute(self):
        return _EdgeResult(list(self._rows))


class _EdgeClient:
    def __init__(self, edges_by_dir, *, version_ids=None):
        self._edges = edges_by_dir
        # Single-version subject by default: _subject_version_ids resolves to [subject.id]
        # via the [subject["id"]] fallback when this is empty (the unit tests model one version).
        self._version_id_rows = [{"id": vid} for vid in (version_ids or [])]

    def table(self, name):
        if name == "documents":
            return _DocVersionQuery(self._version_id_rows)
        assert name == "document_relationships"
        return _EdgeQuery(self._edges)


@pytest.mark.asyncio
async def test_handler_returns_both_directions_with_inverse_labels(make_tool_context, monkeypatch):
    """The tool returns BOTH outgoing and incoming edges with correct inverse labels + mask."""
    import json

    from app.services import document_relationship_service as svc
    from app.services.tool_dispatcher import _handle_get_related_documents

    subject = {"id": "subj", "filename": "subject.txt"}
    readable_target = {"id": "tgt-1", "filename": "outgoing-target.txt"}
    readable_source = {"id": "src-1", "filename": "incoming-source.txt"}

    # The shared resolver is stubbed: subject + the two SEEABLE endpoints resolve;
    # the "secret" id (an INCOMING edge's source the caller can't read) → None (masked).
    table = {
        "subj": subject,
        "tgt-1": readable_target,
        "src-1": readable_source,
        # "secret" intentionally absent → resolver returns None → mask.
    }

    async def _fake_resolve(handle, caller, *, by_filename=False, supabase=None):
        if by_filename:
            return next((v for v in table.values() if v["filename"] == handle), None)
        return table.get(handle)

    monkeypatch.setattr(svc, "_resolve_readable_latest", _fake_resolve)

    edges = {
        "outgoing": [
            {"id": "e1", "source_doc_id": "subj", "target_doc_id": "tgt-1", "rel_type": "supersedes"},
        ],
        "incoming": [
            {"id": "e2", "source_doc_id": "src-1", "target_doc_id": "subj", "rel_type": "references"},
            {"id": "e3", "source_doc_id": "secret", "target_doc_id": "subj", "rel_type": "amends"},
        ],
    }
    ctx = make_tool_context(supabase=_EdgeClient(edges))
    payload = json.loads((await _handle_get_related_documents({"document_id": "subj"}, ctx)).result)

    assert payload["total"] == 3
    rows = {(r["direction"], r["label"], r["filename"]) for r in payload["documents"]}
    # Outgoing keeps the verb; the subject SUPERSEDES tgt-1.
    assert ("outgoing", "supersedes", "outgoing-target.txt") in rows
    # Incoming flips to the inverse label: src-1 REFERENCES subj → subj is "referenced_by".
    assert ("incoming", "referenced_by", "incoming-source.txt") in rows
    # The unreadable incoming source is MASKED (existence shown, identity hidden).
    assert ("incoming", "amended_by", "linked document (no access)") in rows
    # source_refs only the SEEABLE endpoints (the masked row contributes none).
    ref_ids = {r["document_id"] for r in payload["source_refs"]}
    assert ref_ids == {"tgt-1", "src-1"}
    assert "secret" not in json.dumps(payload)


@pytest.mark.asyncio
async def test_handler_masked_row_never_leaks_filename(make_tool_context, monkeypatch):
    """A masked endpoint carries document_id=None and the mask string, never the real id."""
    import json

    from app.services import document_relationship_service as svc
    from app.services.tool_dispatcher import _handle_get_related_documents

    subject = {"id": "subj", "filename": "subject.txt"}

    async def _fake_resolve(handle, caller, *, by_filename=False, supabase=None):
        return subject if handle == "subj" else None  # the target is unseeable → masked

    monkeypatch.setattr(svc, "_resolve_readable_latest", _fake_resolve)

    edges = {"outgoing": [
        {"id": "e1", "source_doc_id": "subj", "target_doc_id": "secret-target", "rel_type": "attached_to"},
    ]}
    ctx = make_tool_context(supabase=_EdgeClient(edges))
    payload = json.loads((await _handle_get_related_documents({"document_id": "subj"}, ctx)).result)

    assert payload["total"] == 1
    row = payload["documents"][0]
    assert row["document_id"] is None
    assert row["filename"] == "linked document (no access)"
    assert "secret-target" not in json.dumps(payload)
    assert payload["source_refs"] == []  # nothing citable for an unseeable endpoint


@pytest.mark.asyncio
async def test_handler_calm_error_on_unresolvable_subject(make_tool_context, monkeypatch):
    """An unresolvable subject yields a calm string payload, never a raised exception."""
    import json

    from app.services import document_relationship_service as svc
    from app.services.tool_dispatcher import _handle_get_related_documents

    async def _none_resolve(handle, caller, *, by_filename=False, supabase=None):
        return None

    monkeypatch.setattr(svc, "_resolve_readable_latest", _none_resolve)

    ctx = make_tool_context()
    result = await _handle_get_related_documents({"filename": "no-such-file.txt"}, ctx)
    payload = json.loads(result.result)
    assert isinstance(payload, dict)  # calm structured error, no stack/raise
    assert payload["status"] == "not_found"


@pytest.mark.asyncio
async def test_handler_calm_error_on_no_subject(make_tool_context):
    """Neither document_id nor filename → a calm 'provide exactly one' string (no raise)."""
    import json

    from app.services.tool_dispatcher import _handle_get_related_documents

    ctx = make_tool_context()
    payload = json.loads((await _handle_get_related_documents({}, ctx)).result)
    assert payload["status"] == "no_subject"

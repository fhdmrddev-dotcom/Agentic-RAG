"""Phase 112 Wave-0 — PATCH /documents/{id}/metadata route validation (META-05).

PURE unit assertions (no live DB): they prove the route's input-validation +
normalization contract with a mocked supabase client + mocked field-def reader
+ mocked audit writer. The live persistence + audit round-trip lives in
test_112_patch_audit.py; the RLS-404 path in test_112_patch_rls.py.

Behaviors asserted (all map to META-05 / SPEC AC2-AC6 backend half):
  (a) field='title' accepted → 200, value persists, _source[title]='user'
  (b) field='_source' rejected (route blocks any leading-underscore field)
  (c) field='_confidence' rejected (same provenance-forgery block)
  (d) field='nonexistent_random' (not built-in, not enabled custom) rejected
  (e) field='document_type' value='Report' → stored lowercased 'report'
  (f) field='language' value='EN' → stored lowercased 'en'
  (g) server NEVER trusts a client-supplied source — it hard-stamps 'user'

These import the route + body model INSIDE each test body so creating this file
never errors collection before the route lands (Task 2). They are written GREEN
(no xfail): they assert the final contract and pass once update_document_metadata
exists. Until then the import raises ImportError → the test ERRORS, which is the
intended RED signal for THIS file's own behaviors; to keep the *suite* exit code
0 before Task 2, the import is guarded with an importorskip.
"""

import pytest


def _make_mock_supabase(stored_metadata):
    """A minimal chained mock mirroring the supabase-py fluent API the route uses.

    The route calls:
        supabase.table("documents").select("metadata").eq().eq().eq()
                .maybe_single().execute()                      → returns the doc
        supabase.table("documents").update({...}).eq().eq().execute()  → returns the row
    We capture the dict passed to .update() so the test can assert the merged
    metadata shape (value, lowercasing, _source hard-stamp).
    """
    from unittest.mock import MagicMock

    captured = {"update_payload": None}

    select_result = MagicMock()
    select_result.data = {"metadata": dict(stored_metadata)}

    update_result = MagicMock()

    def _update(payload):
        captured["update_payload"] = payload
        # The UPDATE result row echoes the merged metadata back as documents.data[0].
        merged_row = {
            "id": "doc-1",
            "user_id": "owner-1",
            "metadata": payload.get("metadata"),
        }
        update_result.data = [merged_row]
        update_chain = MagicMock()
        update_chain.eq.return_value.eq.return_value.execute.return_value = update_result
        return update_chain

    table = MagicMock()
    table.select.return_value.eq.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = select_result
    table.update.side_effect = _update

    supabase = MagicMock()
    supabase.table.return_value = table
    return supabase, captured


@pytest.mark.asyncio
async def test_valid_builtin_field_accepted_and_source_stamped(monkeypatch):
    documents = pytest.importorskip("app.api.documents")
    if not hasattr(documents, "update_document_metadata"):
        pytest.skip("update_document_metadata route not yet implemented (Task 2)")

    # No custom fields enabled for this user.
    monkeypatch.setattr(documents, "read_enabled_field_defs", lambda sb, uid: [])

    async def _noop_audit(**kwargs):
        return None

    monkeypatch.setattr(documents, "write_audit_entry", _noop_audit)

    supabase, captured = _make_mock_supabase({"title": "Old"})
    body = documents.MetadataUpdateRequest(field="title", value="New Title")
    result = await documents.update_document_metadata(
        document_id="doc-1", body=body,
        current_user={"id": "owner-1"}, supabase=supabase,
    )
    payload = captured["update_payload"]["metadata"]
    assert payload["title"] == "New Title", "value must persist into metadata"
    assert payload["_source"]["title"] == "user", "server must hard-stamp _source='user'"
    assert result["metadata"]["title"] == "New Title"


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_field", ["_source", "_confidence", "__proto__"])
async def test_leading_underscore_field_rejected(monkeypatch, bad_field):
    documents = pytest.importorskip("app.api.documents")
    if not hasattr(documents, "update_document_metadata"):
        pytest.skip("update_document_metadata route not yet implemented (Task 2)")
    from fastapi import HTTPException

    monkeypatch.setattr(documents, "read_enabled_field_defs", lambda sb, uid: [])

    async def _noop_audit(**kwargs):
        return None

    monkeypatch.setattr(documents, "write_audit_entry", _noop_audit)

    supabase, _ = _make_mock_supabase({"title": "Old"})
    body = documents.MetadataUpdateRequest(field=bad_field, value="x")
    with pytest.raises(HTTPException) as exc:
        await documents.update_document_metadata(
            document_id="doc-1", body=body,
            current_user={"id": "owner-1"}, supabase=supabase,
        )
    assert exc.value.status_code in (400, 422), "leading-underscore field must be rejected"


@pytest.mark.asyncio
async def test_unknown_field_rejected(monkeypatch):
    documents = pytest.importorskip("app.api.documents")
    if not hasattr(documents, "update_document_metadata"):
        pytest.skip("update_document_metadata route not yet implemented (Task 2)")
    from fastapi import HTTPException

    monkeypatch.setattr(documents, "read_enabled_field_defs", lambda sb, uid: [])

    async def _noop_audit(**kwargs):
        return None

    monkeypatch.setattr(documents, "write_audit_entry", _noop_audit)

    supabase, _ = _make_mock_supabase({"title": "Old"})
    body = documents.MetadataUpdateRequest(field="nonexistent_random", value="x")
    with pytest.raises(HTTPException) as exc:
        await documents.update_document_metadata(
            document_id="doc-1", body=body,
            current_user={"id": "owner-1"}, supabase=supabase,
        )
    assert exc.value.status_code in (400, 422), (
        "a field that is neither a built-in nor an enabled custom field_key must be rejected"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field,raw,expected",
    [("document_type", "Report", "report"), ("language", "EN", "en")],
)
async def test_document_type_and_language_lowercased(monkeypatch, field, raw, expected):
    documents = pytest.importorskip("app.api.documents")
    if not hasattr(documents, "update_document_metadata"):
        pytest.skip("update_document_metadata route not yet implemented (Task 2)")

    monkeypatch.setattr(documents, "read_enabled_field_defs", lambda sb, uid: [])

    async def _noop_audit(**kwargs):
        return None

    monkeypatch.setattr(documents, "write_audit_entry", _noop_audit)

    supabase, captured = _make_mock_supabase({})
    body = documents.MetadataUpdateRequest(field=field, value=raw)
    await documents.update_document_metadata(
        document_id="doc-1", body=body,
        current_user={"id": "owner-1"}, supabase=supabase,
    )
    payload = captured["update_payload"]["metadata"]
    assert payload[field] == expected, (
        f"{field} must be lowercased so @> filters keep matching"
    )


@pytest.mark.asyncio
async def test_enabled_custom_field_key_accepted(monkeypatch):
    documents = pytest.importorskip("app.api.documents")
    if not hasattr(documents, "update_document_metadata"):
        pytest.skip("update_document_metadata route not yet implemented (Task 2)")

    # An enabled custom field 'probe_k' is in scope for this user.
    monkeypatch.setattr(
        documents, "read_enabled_field_defs",
        lambda sb, uid: [{"field_key": "probe_k", "enabled": True}],
    )

    async def _noop_audit(**kwargs):
        return None

    monkeypatch.setattr(documents, "write_audit_entry", _noop_audit)

    supabase, captured = _make_mock_supabase({})
    body = documents.MetadataUpdateRequest(field="probe_k", value="hello")
    await documents.update_document_metadata(
        document_id="doc-1", body=body,
        current_user={"id": "owner-1"}, supabase=supabase,
    )
    payload = captured["update_payload"]["metadata"]
    assert payload["probe_k"] == "hello", "an enabled custom field_key must be accepted"
    assert payload["_source"]["probe_k"] == "user"


@pytest.mark.asyncio
async def test_read_enabled_field_defs_supports_dict_or_attr_field_key(monkeypatch):
    """The route must read .field_key whether the def is a dict (read_enabled_field_defs
    returns list[dict]) or an attr-style object. read_enabled_field_defs returns dicts
    (embedding_service.py:270), so the route must use dict access (d['field_key'])."""
    documents = pytest.importorskip("app.api.documents")
    if not hasattr(documents, "update_document_metadata"):
        pytest.skip("update_document_metadata route not yet implemented (Task 2)")

    monkeypatch.setattr(
        documents, "read_enabled_field_defs",
        lambda sb, uid: [{"field_key": "renewal_date", "enabled": True}],
    )

    async def _noop_audit(**kwargs):
        return None

    monkeypatch.setattr(documents, "write_audit_entry", _noop_audit)

    supabase, captured = _make_mock_supabase({})
    body = documents.MetadataUpdateRequest(field="renewal_date", value="2026-01-01")
    await documents.update_document_metadata(
        document_id="doc-1", body=body,
        current_user={"id": "owner-1"}, supabase=supabase,
    )
    assert captured["update_payload"]["metadata"]["renewal_date"] == "2026-01-01"

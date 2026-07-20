"""Phase 111 Plan 03 Task 1 — MetadataFieldCreate V5 validation (META-01, D-111-5).

The DB column `metadata_field_definitions.field_type` is `text NOT NULL DEFAULT
'string'` with NO CHECK (migration 071:94), so the closed vocabulary + field_key
hardening lives on the Pydantic Create model. These are PURE unit assertions (no
DB) — they prove the 5 behavior cases the threat register (T-111-03-02) relies on.
"""

import pytest
from pydantic import ValidationError

from app.models.metadata_field import (
    MetadataFieldCreate,
    MetadataFieldResponse,
    MetadataFieldUpdate,
)


# ── field_type closed Literal {string,date,number,boolean,enum} ─────────────


@pytest.mark.parametrize("ftype", ["string", "date", "number", "boolean"])
def test_field_type_accepts_closed_vocabulary(ftype):
    m = MetadataFieldCreate(field_key="contract_value", field_type=ftype)
    assert m.field_type == ftype


def test_field_type_rejects_unknown_value():
    with pytest.raises(ValidationError):
        MetadataFieldCreate(field_key="contract_value", field_type="object")


# ── field_key regex ^[a-z][a-z0-9_]*$ ───────────────────────────────────────


@pytest.mark.parametrize("key", ["contract_value", "renewal_date_2025", "x"])
def test_field_key_accepts_valid_keys(key):
    m = MetadataFieldCreate(field_key=key, field_type="string")
    assert m.field_key == key


@pytest.mark.parametrize("key", ["Title", "1x", "my-field", "", "has space", "UPPER"])
def test_field_key_rejects_malformed_keys(key):
    with pytest.raises(ValidationError):
        MetadataFieldCreate(field_key=key, field_type="string")


# ── built-in collision (the 7 immutable keys) ───────────────────────────────


@pytest.mark.parametrize(
    "key", ["title", "author", "date", "document_type", "topics", "language", "summary"]
)
def test_field_key_rejects_builtin_collision(key):
    with pytest.raises(ValidationError):
        MetadataFieldCreate(field_key=key, field_type="string")


# ── reserved leading-underscore prefixes (_confidence / _classification) ─────


@pytest.mark.parametrize("key", ["_confidence", "_classification", "_anything"])
def test_field_key_rejects_leading_underscore_reserved(key):
    # The ^[a-z] anchor already forbids a leading underscore; this proves the
    # reserved prefixes are rejected (belt-and-suspenders for secure-phase).
    with pytest.raises(ValidationError):
        MetadataFieldCreate(field_key=key, field_type="string")


# ── enum field_type requires a non-empty options list ───────────────────────


def test_enum_without_options_rejected():
    with pytest.raises(ValidationError):
        MetadataFieldCreate(field_key="region", field_type="enum")


def test_enum_with_empty_options_rejected():
    with pytest.raises(ValidationError):
        MetadataFieldCreate(field_key="region", field_type="enum", options=[])


def test_enum_with_options_valid():
    m = MetadataFieldCreate(
        field_key="region", field_type="enum", options=["emea", "amer"]
    )
    assert m.field_type == "enum"
    assert m.options == ["emea", "amer"]


# ── happy-path constructs for Update / Response models ───────────────────────


def test_update_model_partial_fields():
    upd = MetadataFieldUpdate(enabled=False)
    assert upd.model_dump(exclude_none=True) == {"enabled": False}


def test_response_model_constructs():
    resp = MetadataFieldResponse(
        id="00000000-0000-0000-0000-000000000001",
        user_id="00000000-0000-0000-0000-000000000002",
        field_key="contract_value",
        field_type="number",
    )
    assert resp.field_key == "contract_value"
    assert resp.is_system_global is False
    assert resp.enabled is True

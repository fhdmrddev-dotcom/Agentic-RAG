"""Pydantic models for custom metadata field definitions (Phase 111, META-01).

The `metadata_field_definitions.field_type` DB column is `text NOT NULL DEFAULT
'string'` with NO CHECK (migration 071:94), so the closed `field_type` vocabulary
+ `field_key` hardening (regex, built-in collision, reserved prefix) is validated
HERE on the Create model (D-111-5). The CRUD router additionally hard-sets
`user_id=caller` + `is_global=false` server-side (T-111-03-01) — never from the body.
"""

import re
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator

# The 7 immutable built-in metadata keys a custom field MUST NOT collide with
# (DocumentMetadata, models/document.py).
_BUILTINS = {"title", "author", "date", "document_type", "topics", "language", "summary"}

# lowercase, must start with a letter (so a leading underscore is already forbidden),
# then letters/digits/underscores.
_KEY_RE = re.compile(r"^[a-z][a-z0-9_]*$")


class MetadataFieldCreate(BaseModel):
    field_key: str
    field_type: Literal["string", "date", "number", "boolean", "enum"]
    description: str | None = None
    options: list[str] | None = None
    enabled: bool = True

    @field_validator("field_key")
    @classmethod
    def _validate_key(cls, v: str) -> str:
        if not _KEY_RE.match(v):
            raise ValueError(
                "field_key must match ^[a-z][a-z0-9_]*$ "
                "(lowercase, start with a letter, no leading underscore)"
            )
        if v in _BUILTINS:
            raise ValueError(f"field_key '{v}' collides with a built-in field")
        # Belt-and-suspenders: the ^[a-z] anchor already forbids a leading
        # underscore, but spell out the reserved prefixes for secure-phase intent.
        if v.startswith(("_confidence", "_classification")):
            raise ValueError("field_key uses a reserved prefix")
        return v

    @model_validator(mode="after")
    def _enum_needs_options(self):
        if self.field_type == "enum" and not self.options:
            raise ValueError("enum field_type requires a non-empty options list")
        return self


class MetadataFieldUpdate(BaseModel):
    description: str | None = None
    options: list[str] | None = None
    enabled: bool | None = None


class MetadataFieldResponse(BaseModel):
    id: str
    user_id: str | None = None
    field_key: str
    field_type: str
    description: str | None = None
    options: list[str] | None = None
    is_global: bool = False
    enabled: bool = True

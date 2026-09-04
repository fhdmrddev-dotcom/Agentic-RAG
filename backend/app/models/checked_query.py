"""Phase 217.1 (BE-6) — checked_query Pydantic models.

Mirrors the ``skill_test_case.py`` shape: Create/Response/Update. Each is defined HERE and
NOT in ``app/models/__init__.py``: the row exists only because of this phase's CRUD router,
and keeping it local makes the exception self-contained.
"""
from datetime import datetime
from pydantic import BaseModel


class CheckedQueryCreate(BaseModel):
    question: str
    expected_document_id: str


class CheckedQueryUpdate(BaseModel):
    question: str | None = None
    expected_document_id: str | None = None


class CheckedQueryResponse(BaseModel):
    id: str
    user_id: str
    question: str
    expected_document_id: str
    last_rank: int | None = None
    previous_rank: int | None = None
    checked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    org_id: str
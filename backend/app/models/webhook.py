"""Phase 308 — webhook models. This first half (308-02) is the PAYLOAD: what leaves Syrel.

THIN IS LITERAL: if a field could carry a person's words it is not here (D-14); every field is typed
so the guard can prove it (D-41).

A payload is the Standard Webhooks envelope ``{"type", "timestamp", "data"}`` with one ``data`` model
per event type, and each data model carries ids, a closed status, an origin kind and an "Open in
Syrel" link — never a name, title, filename, input, output or error text. No field is ``dict``,
``Any``, ``tuple`` or ``set``: ``outbound_guard`` cannot read inside those and withholds them. The
test event's message is a ``Literal``, so even it cannot carry free text.

``serialize_payload`` is the ONE serialiser: the drainer freezes its bytes at fan-out, and exactly
those bytes are signed and sent (D-11). ASCII JSON with sorted keys and no spaces, so two equal models
always give identical bytes and a receiver's UTF-8 decode can never change them.

The links come from ``app.mcp.results`` (``doc_link`` / ``run_link``) — imported inside the builders,
never copied (D-14: no third copy), and lazily because importing ``app.mcp.results`` loads the MCP
server graph.

308-04 appends the route DTOs below the payload half.
"""
from __future__ import annotations

import json
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict

TEST_MESSAGE = "This is a test event from Syrel."

RunEventType = Literal["run.finished", "run.waiting"]
RunStatus = Literal["completed", "failed", "cancelled", "paused", "cap_paused"]
OriginKind = Literal["app", "schedule", "key", "mcp"]

_PAYLOAD_CONFIG = ConfigDict(extra="forbid", frozen=True)


# ── data, one model per event type ─────────────────────────────────────────────────────────


class RunEventData(BaseModel):
    model_config = _PAYLOAD_CONFIG

    run_id: UUID
    workflow_id: UUID | None
    org_id: UUID
    status: RunStatus
    origin_kind: OriginKind | None
    link: str


class DocumentEventData(BaseModel):
    model_config = _PAYLOAD_CONFIG

    document_id: UUID
    folder_id: UUID | None
    org_id: UUID
    status: Literal["completed"]
    link: str


class TestEventData(BaseModel):
    __test__ = False  # not a pytest class
    model_config = _PAYLOAD_CONFIG

    endpoint_id: UUID
    message: Literal[TEST_MESSAGE]  # a constant: even the test event carries no free text


# ── envelopes ──────────────────────────────────────────────────────────────────────────────


class RunEvent(BaseModel):
    model_config = _PAYLOAD_CONFIG

    type: RunEventType
    timestamp: AwareDatetime
    data: RunEventData


class DocumentEvent(BaseModel):
    model_config = _PAYLOAD_CONFIG

    type: Literal["document.ingested"]
    timestamp: AwareDatetime
    data: DocumentEventData


class TestEvent(BaseModel):
    __test__ = False  # not a pytest class
    model_config = _PAYLOAD_CONFIG

    type: Literal["webhook.test"]
    timestamp: AwareDatetime
    data: TestEventData


WebhookPayload = RunEvent | DocumentEvent | TestEvent


def serialize_payload(model: WebhookPayload) -> bytes:
    """The exact bytes that are frozen, signed and sent: ASCII JSON, sorted keys, no spaces."""
    return json.dumps(
        model.model_dump(mode="json"), separators=(",", ":"), ensure_ascii=True, sort_keys=True,
    ).encode("ascii")


# ── builders ───────────────────────────────────────────────────────────────────────────────


def build_run_event(
    *,
    type: RunEventType,
    event_id_created_at: AwareDatetime,
    run_id: UUID,
    workflow_id: UUID | None,
    org_id: UUID,
    status: RunStatus,
    origin_kind: OriginKind | None,
) -> RunEvent:
    from app.mcp.results import run_link  # lazy: the MCP module graph is not a payload dependency

    return RunEvent(
        type=type,
        timestamp=event_id_created_at,
        data=RunEventData(
            run_id=run_id, workflow_id=workflow_id, org_id=org_id, status=status,
            origin_kind=origin_kind, link=run_link(str(run_id)),
        ),
    )


def build_document_event(
    *,
    event_id_created_at: AwareDatetime,
    document_id: UUID,
    folder_id: UUID | None,
    org_id: UUID,
) -> DocumentEvent:
    from app.mcp.results import doc_link  # lazy: the MCP module graph is not a payload dependency

    return DocumentEvent(
        type="document.ingested",
        timestamp=event_id_created_at,
        data=DocumentEventData(
            document_id=document_id, folder_id=folder_id, org_id=org_id, status="completed",
            link=doc_link(str(document_id)),
        ),
    )


def build_test_event(endpoint_id: UUID, now: AwareDatetime) -> TestEvent:
    return TestEvent(
        type="webhook.test",
        timestamp=now,
        data=TestEventData(endpoint_id=endpoint_id, message=TEST_MESSAGE),
    )

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


# ═══════════════════════════════════════════════════════════════════════════════════════════════
# 308-04 — the ROUTE DTOs (what the Webhooks tab and the org-admin section read and send).
#
# ⛔ NO READ MODEL HAS A SECRET OR A CIPHERTEXT FIELD. The secret appears in exactly two answers —
# ``WebhookEndpointCreated`` and ``WebhookSecretRolled`` — at their top level, once (D-12). The
# org-admin row (``OrgWebhookRead``) has no ``url`` at all: host, masked path and ``has_query``
# only (D-51), because a receiver's token lives in the path or the query.
# Imported here rather than at the top so the payload half above stays byte-unchanged.
# ═══════════════════════════════════════════════════════════════════════════════════════════════

from datetime import datetime  # noqa: E402

from pydantic import Field, field_validator  # noqa: E402

EventType = Literal["run.finished", "run.waiting", "document.ingested"]
DisabledReason = Literal["failing", "gone", "admin", "owner_removed"]
ItemKind = Literal["run", "document", "test"]

DESCRIPTION_MAX = 100


def _dedupe(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    seen: list[str] = []
    for v in values:
        if v not in seen:
            seen.append(v)
    return seen


def _clean_description(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


class WebhookEndpointCreate(BaseModel):
    """``POST /webhooks``. The URL rules (https, no userinfo, no fragment) and the reachability check
    run in the route, so a refusal can answer ``{code, message}`` (D-46 / D-24)."""

    url: str = Field(max_length=2048)
    event_types: list[EventType] = Field(min_length=1)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)

    @field_validator("event_types")
    @classmethod
    def _dedupe_events(cls, v):
        return _dedupe(v)

    @field_validator("description")
    @classmethod
    def _strip_description(cls, v):
        return _clean_description(v)


class WebhookEndpointUpdate(BaseModel):
    """``PATCH /webhooks/{id}``. A field left out is unchanged; ``description`` "" or null clears it
    (the route reads ``model_fields_set`` to tell the two apart)."""

    url: str | None = Field(default=None, max_length=2048)
    event_types: list[EventType] | None = Field(default=None, min_length=1)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)

    @field_validator("event_types")
    @classmethod
    def _dedupe_events(cls, v):
        return _dedupe(v)

    @field_validator("description")
    @classmethod
    def _strip_description(cls, v):
        return _clean_description(v)


class WebhookEndpointRead(BaseModel):
    """A member's own endpoint, with its full URL (D-51: the member's own card shows it)."""

    id: str
    url: str
    description: str | None
    event_types: list[str]
    enabled: bool
    disabled_reason: DisabledReason | None
    disabled_at: datetime | None
    last_success_at: datetime | None
    consecutive_failures: int
    previous_secret_expires_at: datetime | None
    created_at: datetime


class WebhookEndpointList(BaseModel):
    endpoints: list[WebhookEndpointRead]
    cap: int
    org_name: str


class WebhookEndpointOne(BaseModel):
    """Edit and turn on / off answer the endpoint as it now stands — never optimistic."""

    endpoint: WebhookEndpointRead


class WebhookEndpointCreated(BaseModel):
    endpoint: WebhookEndpointRead
    secret: str


class WebhookSecretRolled(BaseModel):
    endpoint: WebhookEndpointRead
    secret: str
    previous_secret_expires_at: datetime


class WebhookRefusal(BaseModel):
    """The ``detail`` of every worded refusal: ``message`` is the sentence the UI shows (P-6)."""

    code: str
    message: str


class WebhookTestResult(BaseModel):
    """``POST /webhooks/{id}/test`` (D-29). ``error`` is the sender's word, never a body."""

    delivered: bool
    status_code: int | None
    latency_ms: int | None
    error: str | None


class WebhookDeliveryRead(BaseModel):
    """One delivery log row (D-20): no body, no response, no headers. ``item_id`` is null when the
    owner can no longer see the item (``skipped_not_visible``, D-26)."""

    id: str
    event_type: str
    item_kind: ItemKind
    item_id: str | None
    status: str
    reason: str | None
    attempts: int
    last_status_code: int | None
    last_latency_ms: int | None
    last_error: str | None
    last_attempt_at: datetime | None
    next_attempt_at: datetime | None
    created_at: datetime


class WebhookDeliveryPage(BaseModel):
    deliveries: list[WebhookDeliveryRead]
    next_cursor: str | None


class WebhookDeliveryQueued(BaseModel):
    """A resent delivery, back in the queue (D-21). The log is re-read for the full row."""

    id: str
    status: Literal["pending"]
    attempts: int
    next_attempt_at: datetime | None


class WebhookResendResult(BaseModel):
    delivery: WebhookDeliveryQueued


class OrgWebhookRead(BaseModel):
    """An org admin's row (D-30 / D-51). ⛔ No ``url``: host, masked path and ``has_query`` only."""

    id: str
    owner_name: str | None
    owner_is_you: bool
    owner_is_member: bool
    host: str
    path: str
    has_query: bool
    event_types: list[str]
    enabled: bool
    disabled_reason: DisabledReason | None
    last_success_at: datetime | None
    consecutive_failures: int


class OrgWebhookList(BaseModel):
    endpoints: list[OrgWebhookRead]
    org_name: str


class OrgWebhookOne(BaseModel):
    endpoint: OrgWebhookRead

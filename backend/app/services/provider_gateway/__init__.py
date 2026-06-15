"""Provider Gateway package (Phase 092.5, GATEWAY-01 / D-01).

ONE home for provider logic. The gateway constructs each provider's stream and
normalizes its chunks into ONE canonical event vocabulary (the D-02 seam
contract) — it does NOT own accumulation or SSE emit (those stay in the
consumer, ``agent_loop``).

SC#3 — NO IMPORT CYCLE: this package MAY import the raw-SDK service modules
(``anthropic_service`` / ``google_service`` / ``openai_service`` / ``tool_parser``)
— they are BELOW it in the dependency graph today. It MUST NEVER import
``agent_loop`` or ``threads.py`` (the callable-injection seam exists precisely
to avoid that cycle; ``_emit`` / ``spawn`` stay passed-in callables consumer-side).
"""
from __future__ import annotations

from .dispatcher import CallingMode, GatewayRequest, open_stream
from .errors import ErrorKind, classify_provider_error, message_for_kind
from .events import (
    DeltaEvent,
    FinishEvent,
    GatewayEvent,
    ReasoningDeltaEvent,
    ToolArgsProgressEvent,
    ToolPreparingEvent,
    ToolStartEvent,
    UsageDeltaEvent,
    UsageEvent,
)

__all__ = [
    # Dispatcher entrypoint + request envelope + re-exported calling-mode carrier
    "open_stream",
    "GatewayRequest",
    "CallingMode",
    # Canonical event schema (D-02 seam contract)
    "GatewayEvent",
    "DeltaEvent",
    "ReasoningDeltaEvent",
    "ToolPreparingEvent",
    "ToolArgsProgressEvent",
    "ToolStartEvent",
    "FinishEvent",
    "UsageEvent",
    "UsageDeltaEvent",
    # Per-provider error classification (D-095.1-03 / PROVIDER-ERR)
    "ErrorKind",
    "classify_provider_error",
    "message_for_kind",
]

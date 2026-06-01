"""Canonical provider event schema (D-02 seam contract).

Lossless superset of the 3 producers' events — the contract Phase 093 consumes.
DO NOT re-shape Anthropic/Google events 'for consistency' — they are already
this template (RESEARCH anti-pattern).

Source of truth for the vocabulary: ``google_service.py:7-14`` docstring (the
canonical-event template) + ``anthropic_service.py:6-9`` (the same, older/narrower
shape). The fields below are copied VERBATIM from those docstrings, plus the
three the docstring schema omits but the consumer DOES consume (the
lossless-superset requirement, CONTEXT D-02 discretion note / PATTERNS lines 44-46):

  - ``code_so_far`` on ``tool_args_progress`` — added Phase 075.6; consumed at
    agent_loop.py:1508, :1621, :1923 (all 3 branches ``.get("code_so_far", "")``).
  - ``thought_signature`` (Google base64 sig) — carried on ``finish.tool_calls[]``
    and hydrated at agent_loop.py:1644-1647 (else Gemini-3 400s on round 2 —
    invariant I2 / D-07). Carried on ToolStartEvent + FinishEvent.tool_calls.
  - ``reasoning_delta`` — emitted only by the OpenAI path today (DeepSeek
    ``reasoning_content`` + ``<think>``-stripped Kimi/MiniMax/GLM). First-class
    in the schema (the harness / Phase 094 renders it).

NOTE: there is NO ``calling_mode`` event type. ``calling_mode`` rides ALONGSIDE
the stream (see dispatcher.open_stream's tuple return), NOT as an event — dropping
calling_mode is the exact bug that makes the harness OpenAI-only (Pitfall 3 / L-3).

SC#3 — this module imports ONLY from ``typing``; it imports nothing from
``agent_loop`` / ``threads.py`` (no import cycle).
"""
from __future__ import annotations

from typing import Literal, NotRequired, TypedDict, Union


class DeltaEvent(TypedDict):
    """Assistant text delta."""

    type: Literal["delta"]
    content: str


class ReasoningDeltaEvent(TypedDict):
    """Reasoning text delta — OpenAI-path only today.

    DeepSeek ``reasoning_content`` + ``<think>``-stripped Kimi/MiniMax/GLM.
    """

    type: Literal["reasoning_delta"]
    content: str


class ToolPreparingEvent(TypedDict):
    """Tool name known, args still streaming."""

    type: Literal["tool_preparing"]
    id: str
    name: str
    index: int


class ToolArgsProgressEvent(TypedDict):
    """5KB-boundary tool-args progress.

    ``code_so_far`` is 075.6-additive — MANDATORY for losslessness (the consumer
    does ``.get("code_so_far", "")`` in all 3 branches).
    """

    type: Literal["tool_args_progress"]
    tool_index: int
    name: str
    args_so_far: str
    total_args_bytes_so_far: int
    code_so_far: str


class ToolStartEvent(TypedDict):
    """Args complete (Anthropic/Google).

    ``thought_signature`` (Google base64 sig) is MANDATORY for I2/D-07 round-trip
    — carried optionally because only Google supplies it.
    """

    type: Literal["tool_start"]
    id: str
    name: str
    args: dict
    thought_signature: NotRequired[str]


class FinishEvent(TypedDict):
    """Turn finished. Each entry in ``tool_calls`` may carry ``thought_signature``."""

    type: Literal["finish"]
    finish_reason: str
    tool_calls: list[dict]


class UsageEvent(TypedDict):
    """Initial / OpenAI-final usage."""

    type: Literal["usage"]
    input_tokens: int
    output_tokens: int


class UsageDeltaEvent(TypedDict):
    """Incremental usage."""

    type: Literal["usage_delta"]
    output_tokens: int


GatewayEvent = Union[
    DeltaEvent,
    ReasoningDeltaEvent,
    ToolPreparingEvent,
    ToolArgsProgressEvent,
    ToolStartEvent,
    FinishEvent,
    UsageEvent,
    UsageDeltaEvent,
]


__all__ = [
    "DeltaEvent",
    "ReasoningDeltaEvent",
    "ToolPreparingEvent",
    "ToolArgsProgressEvent",
    "ToolStartEvent",
    "FinishEvent",
    "UsageEvent",
    "UsageDeltaEvent",
    "GatewayEvent",
]

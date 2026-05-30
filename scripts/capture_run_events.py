"""
capture_run_events.py — Phase 089 (FOUND-03 / SC#3) byte-identical-SSE proof helper.

The agent-loop extraction (threads.py → agent_loop.py, Phase 089) is a PURE
behavior-preserving lift. Its acceptance bar is NOT "tests pass" — the test suite
mocks the LLM and so only proves plumbing, not the per-provider round-trip
invariants (Anthropic end_turn, Google thought_signature, DeepSeek reasoning_content,
Moonshot <think>-filter, ...). The hard bar is: the per-provider SSE event sequence
captured BEFORE the lift must diff to EMPTY against the sequence captured AFTER
(D-089-08 a).

This module is the capture + normalize + diff utility for that proof. It is a PURE
utility module — no top-level execution — importable by scripts/SSE_DIFF_RUNBOOK.md's
operator driver and by the eval driver (scripts/eval_cross_provider.py already holds
the run_id from run_prompt and waits for terminal via wait_for_run; the capture runs
right AFTER wait_for_run).

Capture point rationale
-----------------------
The `run:{run_id}` Redis Stream IS the exact byte sequence the SSE consumer
(backend/app/api/runs.py XREAD) reads and forwards to the browser. Capturing here —
server-side, via XRANGE run:{run_id} - + — is deterministic, already ordered, and
needs ZERO new in-loop instrumentation (so it cannot itself change behavior). This
is the "don't hand-roll a custom in-loop recorder" rule from 089-RESEARCH §Don't
Hand-Roll: the stream is the wire payload; just read it back.

Security
--------
- Reads ONLY the Redis run-buffer stream for a run_id the operator already drove
  (their own local test-user thread). No secrets, no provider keys touched here.
- Pure transformation: normalize() masks volatile ids and drops wall-clock — it
  never emits or logs any payload value beyond what the operator already captured.
"""
from __future__ import annotations

import json
from typing import Any

# Volatile fields that legitimately vary run-to-run and so MUST be normalized away
# before the before/after diff (otherwise every diff is non-empty for trivial
# reasons). run_id changes per run; message_id is freshly minted; captured_at is a
# monotonic wall-clock stamp _emit adds. Everything else (event TYPE + structural
# shape + content deltas) is the behavior under test and is preserved verbatim.
_MASK_KEYS: tuple[str, ...] = ("message_id", "run_id")
_DROP_KEYS: tuple[str, ...] = ("captured_at",)
_MASK_VALUE = "<masked>"


async def capture_run_events(redis: Any, run_id: str) -> list[dict]:
    """Read the full ordered SSE event sequence for a finished run.

    Calls XRANGE run:{run_id} - + against the Redis run-buffer stream and decodes
    each entry's ``fields["data"]`` (which ``_emit`` stores as
    ``{"data": json.dumps({"type": ..., **fields})}``) back into the event dict.

    Run this AFTER the run reaches a terminal status (the eval's wait_for_run) so
    the stream is complete. Returns the events in wire order — the exact sequence
    runs.py forwards to the browser.

    redis    : an awaitable redis.asyncio client (the app's get_redis dependency).
    run_id   : the run whose stream to read (returned by the eval's run_prompt).
    """
    entries = await redis.xrange(f"run:{run_id}", "-", "+")
    events: list[dict] = []
    for _entry_id, fields in entries:
        # redis.asyncio may return field keys/values as bytes depending on the
        # client's decode_responses setting; coerce the "data" field robustly.
        data = fields.get("data") if isinstance(fields, dict) else None
        if data is None and isinstance(fields, dict):
            # bytes-keyed mapping (decode_responses=False)
            data = fields.get(b"data")
        if isinstance(data, (bytes, bytearray)):
            data = data.decode("utf-8")
        if data is None:
            continue
        events.append(json.loads(data))
    return events


def normalize(events: list[dict]) -> list[dict]:
    """Return a copy of the event list with volatile ids/timestamps removed.

    Drops ``captured_at`` (non-deterministic wall-clock) and masks ``message_id``
    and ``run_id`` to ``"<masked>"``. This makes the before/after comparison
    deterministic: only genuine behavior differences (event type, ordering,
    content shape) survive — id/timestamp churn normalizes away.
    """
    out: list[dict] = []
    for e in events:
        e = dict(e)
        for k in _DROP_KEYS:
            e.pop(k, None)
        for k in _MASK_KEYS:
            if k in e:
                e[k] = _MASK_VALUE
        out.append(e)
    return out


def diff_event_streams(before: list[dict], after: list[dict]) -> list:
    """Per-index differences of ``normalize(before)`` vs ``normalize(after)``.

    Returns a list of ``(index, before_event, after_event)`` tuples for every
    position where the normalized streams disagree (including length mismatch,
    where the shorter side reports ``None`` for the missing position). An EMPTY
    list == byte-identical SSE == SC#3 PASS for that provider. Any non-empty
    result means the lift changed observable behavior → BLOCK.
    """
    nb = normalize(before)
    na = normalize(after)
    diffs: list = []
    for i in range(max(len(nb), len(na))):
        b = nb[i] if i < len(nb) else None
        a = na[i] if i < len(na) else None
        if b != a:
            diffs.append((i, b, a))
    return diffs

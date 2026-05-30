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
    where the shorter side reports ``None`` for the missing position).

    NOTE (empirically established 2026-05-30): a RAW per-index diff is NOT a
    valid SC#3 gate against live providers. Repeating the SAME pre-move loop on
    Anthropic 3× produced 36 / 33 / 34 events — the LLM streams the same content
    in a varying number of ``delta`` / ``tool_args_progress`` chunks (and slightly
    different wording), so this raw diff is non-empty even with ZERO code change.
    Use ``diff_skeletons`` for the SC#3 pass/fail gate; this raw diff is retained
    for FORENSIC inspection (eyeballing exactly which content bytes moved).
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


# Event types whose *content* is non-deterministic streaming chunk-noise: the same
# assistant text / tool-call args arrive split into a different NUMBER of chunks
# run-to-run. Proven 2026-05-30 (Anthropic, identical code): delta 12/10/11,
# tool_args_progress 4/3/3 — while every structural event count was identical.
# The skeleton collapses each maximal run of these to a single content-masked marker.
_VOLATILE_STREAM_TYPES: tuple[str, ...] = ("delta", "tool_args_progress")


def skeleton(events: list[dict]) -> list[str]:
    """Deterministic STRUCTURAL skeleton of an SSE event stream (the SC#3 gate).

    Live LLMs make a raw per-index diff false-positive (see ``diff_event_streams``).
    The skeleton keeps only the layer that is deterministic across repeated runs of
    the SAME loop AND that genuinely changes when behavior changes:

    - event-type ordering (the grammar of the stream);
    - tool IDENTITY + order — ``tool_start``/``tool_preparing`` carry the tool
      ``name`` (which tools, in what sequence — the 075.x regressions dropped/reordered these);
    - the code-execution lifecycle (``code_execution_start`` → ``code_stdout`` →
      ``code_execution_complete``);
    - the terminal classification — ``done``/``stream_end`` carry whether an error
      was set (the I10 terminal-race / terminal-status invariant).

    Volatile streaming chunk-types (``delta``, ``tool_args_progress``) are collapsed
    to a single content-masked marker so their varying chunk COUNT is ignored.

    Empirically verified: identical across 3 repeated runs of the same pre-move loop
    (24-token skeleton, byte-stable) while raw event counts varied 36/33/34.
    """
    out: list[str] = []
    for e in events:
        t = e.get("type")
        if t in _VOLATILE_STREAM_TYPES:
            if out and out[-1] == t:          # collapse consecutive chunk-runs
                continue
            out.append(t)
        elif t in ("tool_start", "tool_preparing"):
            out.append(f"{t}:{e.get('name')}")          # tool identity is deterministic + meaningful
        elif t in ("done", "stream_end"):
            out.append(f"{t}:error={e.get('error') is not None}")  # terminal classification
        else:
            out.append(t)
    return out


def diff_skeletons(before: list[dict], after: list[dict]) -> list:
    """Per-index differences of ``skeleton(before)`` vs ``skeleton(after)``.

    Returns ``(index, before_token, after_token)`` tuples for every position where
    the structural skeletons disagree (length mismatch reports ``None`` for the
    missing side). An EMPTY list == structurally byte-identical SSE == SC#3 PASS
    for that provider. A non-empty result means the lift changed observable
    structure (a dropped/reordered event, a different tool sequence, a changed
    terminal classification) → investigate; on a native-7 provider that BLOCKS.
    """
    sb = skeleton(before)
    sa = skeleton(after)
    diffs: list = []
    for i in range(max(len(sb), len(sa))):
        b = sb[i] if i < len(sb) else None
        a = sa[i] if i < len(sa) else None
        if b != a:
            diffs.append((i, b, a))
    return diffs

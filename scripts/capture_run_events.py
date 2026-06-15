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

    **Consecutive-run collapse (generalized 2026-05-30 after the live after-diff).**
    EVERY streaming chunk-type emits a non-deterministic NUMBER of identical
    consecutive events run-to-run: ``delta`` (assistant text), ``reasoning_delta``
    (thinking-model reasoning tokens — deepseek/moonshot/glm-4.6), ``tool_args_progress``
    (streamed tool-call args), ``code_stdout`` (streamed stdout). Rather than maintain
    a hardcoded volatile-type list (the first cut missed ``reasoning_delta`` and
    produced 90-176 false diffs for reasoning models), the skeleton collapses ANY
    maximal run of the SAME token to one. Count is non-deterministic; the TRANSITION
    grammar is what's deterministic and behavior-bearing.

    Empirically: identical across 3 repeated runs of the same pre-move loop while raw
    event counts varied. NOTE the residual irreducible non-determinism this CANNOT
    remove — the agent's TOOL-PATH SELECTION (which tools, in what order) is LLM-decided
    and legitimately varies run-to-run; that surfaces as real insert/delete opcodes in
    ``diff_skeletons`` and must be judged (re-run / vocabulary check), not auto-failed.
    """
    raw: list[str] = []
    for e in events:
        t = e.get("type")
        if t in ("tool_start", "tool_preparing"):
            raw.append(f"{t}:{e.get('name')}")          # tool identity is deterministic + meaningful
        elif t in ("done", "stream_end"):
            raw.append(f"{t}:error={e.get('error') is not None}")  # terminal classification
        else:
            raw.append(t)
    # Collapse consecutive identical tokens — any streaming chunk-type (delta,
    # reasoning_delta, tool_args_progress, code_stdout, ...) folds to a single marker.
    out: list[str] = []
    for tok in raw:
        if not out or out[-1] != tok:
            out.append(tok)
    return out


def diff_skeletons(before: list[dict], after: list[dict]) -> list:
    """ALIGNMENT-based differences of ``skeleton(before)`` vs ``skeleton(after)``.

    Uses difflib edit opcodes (NOT a positional per-index compare — a single
    inserted/deleted token would otherwise cascade into a false diff at every
    later position). Returns a list of ``(op, before_block, after_block)`` tuples
    for each non-equal edit region, where ``op`` is ``replace`` / ``insert`` /
    ``delete``. An EMPTY list == structurally identical SSE == SC#3 PASS.

    A non-empty result is a REAL structural edit: a dropped/added event type, a
    different tool sequence, or a changed terminal classification. For an agentic
    loop that can still be LLM tool-path non-determinism (the agent chose different
    tools) rather than a code regression — re-run before+after to distinguish a
    persistent edit (regression) from a flaky one (LLM noise). Since a verbatim
    move is AST-identical, any persistent edit would indicate the move was NOT
    byte-identical; a flaky edit is expected agentic non-determinism.
    """
    import difflib

    sb = skeleton(before)
    sa = skeleton(after)
    sm = difflib.SequenceMatcher(a=sb, b=sa, autojunk=False)
    diffs: list = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag != "equal":
            diffs.append((tag, sb[i1:i2], sa[j1:j2]))
    return diffs

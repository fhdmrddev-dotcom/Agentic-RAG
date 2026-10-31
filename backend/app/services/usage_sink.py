"""Phase 305-03 (GUARD-02; D-29 / D-55; T-305-14) — a leaf collector for provider usage.

The MCP search path embeds the query deep inside retrieval (``retrieval_rpc._vector_search`` ->
``openai_service.embed_texts``), where nothing knows which MCP key asked. Rather than thread a key
through retrieval, the MCP dispatcher opens a collection around the tool call and the provider
call reports what it measured:

    with usage_sink.collecting() as entries:   # app/mcp/dispatch.py
        ...                                    # embed_texts -> usage_sink.record(model, tokens)
    # entries == [{"model": ..., "provider": ..., "prompt_tokens": ...}, ...]

* ``record()`` outside a ``collecting()`` block is a no-op, so the chat, ingestion and every other
  caller of ``embed_texts`` is unaffected.
* **Fail-safe.** ``record()`` swallows everything: a usage miss must never fail a call. A miss
  shows up downstream as an unmeasured (NULL-token) row, never as a failed search.
* ``prompt_tokens`` is an ``int`` or ``None`` — never a guess, and never a bool.

**A4 (305-RESEARCH).** The embedding runs in ``run_in_threadpool``, which runs the function in a
COPY of the caller's context. The copied ContextVar points at the SAME list object, so an entry
appended in the worker thread is visible to the caller afterwards. Proven by
``tests/unit/test_305_usage_sink.py::test_a_value_recorded_inside_run_in_threadpool_is_visible_after_it``.

A LEAF: it imports nothing from ``app`` (fenced by the same test file).
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator

_sink: ContextVar[list | None] = ContextVar("mcp_usage_sink", default=None)


@contextmanager
def collecting() -> Iterator[list]:
    """Collect every ``record()`` made in this context (and in threadpool copies of it)."""
    entries: list = []
    token = _sink.set(entries)
    try:
        yield entries
    finally:
        _sink.reset(token)


def _append(entry: dict) -> None:
    entries = _sink.get()
    if entries is not None:
        entries.append(entry)


def record(model: str | None, prompt_tokens: int | None, provider: str | None = None) -> None:
    """Report one provider call's measured usage. Never raises."""
    try:
        _append({
            "model": model if isinstance(model, str) and model else None,
            "provider": provider if isinstance(provider, str) and provider else None,
            "prompt_tokens": (
                prompt_tokens
                if isinstance(prompt_tokens, int) and not isinstance(prompt_tokens, bool)
                else None
            ),
        })
    except Exception:  # noqa: BLE001 — a usage miss must never fail the call that measured it
        pass

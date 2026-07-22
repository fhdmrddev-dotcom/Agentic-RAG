"""Phase 162.5 Plan 01 (D-A2 / D-A4 / D-A5) — the thread-title subsystem, extracted.

Behavior-preserving G-5 refactor: the auto-title subsystem (``generate_thread_title``
+ the three title helpers + ``_SINGLE_MODEL_PROVIDERS``) and the ``send_message``
inline auto-title emit block move VERBATIM out of the 2,444-LOC
``backend/app/api/threads.py`` into this leaf module. Zero "while-I'm-in-here" edits —
the bodies are copied unchanged (bugs included). This is the established
``run_lifecycle.py`` extraction discipline (D-A4): docstring-states-invariant,
additive-then-repoint, late imports to break the ``threads.py`` <-> service cycle.

PATCH SURFACE (D-A4 — the acceptance bar):

- ``generate_thread_title`` is re-imported at module scope back into ``threads.py`` so
  every existing ``patch("app.api.threads.generate_thread_title")`` (~30 test files)
  still intercepts.

- ``maybe_autotitle_thread`` takes ``title_fn`` and ``emit`` as PARAMETERS (dependency
  injection). ``send_message`` passes its own module-global ``generate_thread_title`` /
  ``_emit`` — so patches at ``app.api.threads.*`` still apply, and the byte-identical
  ordering invariant (``fallback_model`` emit BEFORE ``title`` emit) is preserved.

- ``generate_thread_title`` resolves ``get_llm_client`` LATE from ``app.api.threads``
  (not a module-scope import) because the title tests patch
  ``app.api.threads.get_llm_client`` and drive ``generate_thread_title`` directly — the
  moved body must still read the patched attribute. This mirrors ``run_lifecycle.py``'s
  ``from app.api.threads import ...`` late imports; in production ``threads.get_llm_client``
  IS ``openai_service.get_llm_client`` (re-exported), so the resolved client is identical.
"""
from __future__ import annotations

import logging

import openai
from starlette.concurrency import run_in_threadpool

from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS, get_model_capability
from app.services.openai_service import _uses_max_completion_tokens
from app.services.sub_agent_models import provider_safe_utility_model
from app.utils.db import aexec

logger = logging.getLogger(__name__)


# BUG-260527-01 (D-08): Single-model providers have one tier — no cheaper
# sub-agent model exists, so title generation uses the user's main model.
# Multi-model providers (openai, anthropic, google, openrouter) can route
# to a cheaper model via _SUB_AGENT_MODEL_DEFAULTS.
_SINGLE_MODEL_PROVIDERS = frozenset({"deepseek", "moonshot", "minimax", "zhipu", "ollama"})


def _strip_think_blocks(text: str) -> str:
    """Remove <think>...</think> reasoning blocks (closed) and any unclosed trailing
    <think> from text. Reasoning providers (minimax inline, GLM-4.6+) emit <think>
    in message.content rather than a separate reasoning_content field, which would
    otherwise bury or replace a generated title."""
    out = text or ""
    lower = out.lower()
    while "<think>" in lower and "</think>" in lower:
        start = lower.find("<think>")
        end = lower.find("</think>", start)
        if end == -1:
            break
        out = out[:start] + out[end + len("</think>"):]
        lower = out.lower()
    idx = out.lower().find("<think>")  # unclosed trailing think (ran out of budget mid-reasoning)
    if idx != -1:
        out = out[:idx]
    return out


def _derive_title_from_message(msg: str) -> str:
    """Deterministic fallback title from the first user message — used when the LLM
    returned reasoning-only / empty / a refusal. Returns a clean short title (first
    line, first ~8 words, <=50 chars) instead of the bare 'New Chat' sentinel."""
    text = (msg or "").strip()
    if not text:
        return "New Chat"
    first_line = text.splitlines()[0].strip()
    title = " ".join(first_line.split()[:8])[:50].strip()
    return title or "New Chat"


def _clean_llm_title(raw: str, first_user_message: str) -> str:
    """Extract a usable title from raw LLM output. Strips <think> blocks + markdown/
    quotes; falls back to a title derived from the user message (NOT bare 'New Chat')
    when the model returned reasoning-only / empty / a refusal. Closes the title-gen
    'stuck on New Chat' bug on reasoning providers (deepseek/moonshot/google/minimax)
    whose tiny token budget left content empty after hidden reasoning."""
    cleaned = _strip_think_blocks(raw or "")
    cleaned = cleaned.strip().strip('"').strip("'").strip("*").strip()
    if (
        not cleaned
        or len(cleaned) > 60
        or cleaned.startswith(("I ", "I'", "**", "Sorry", "As ", "<"))
    ):
        return _derive_title_from_message(first_user_message)
    return cleaned


def generate_thread_title(
    first_user_message: str,
    user_settings=None,
    chat_model: str = "",
) -> tuple[str, dict | None]:
    """Call LLM to produce a short thread title from the first user message.

    Returns (title, fallback_info). fallback_info is None unless a 404 retry occurred.
    """
    # D-A4 patch surface: resolve get_llm_client LATE off app.api.threads so the title
    # tests' patch("app.api.threads.get_llm_client") still intercepts this moved body
    # (production: threads.get_llm_client IS openai_service.get_llm_client — identical).
    from app.api.threads import get_llm_client  # noqa: PLC0415
    try:
        client = get_llm_client(user_settings)
        provider = user_settings.active_provider if user_settings else ""

        if provider in _SINGLE_MODEL_PROVIDERS:
            # Single-model providers: use the chat_model the frontend sent
            # (always correct for the active provider), then provider default,
            # then user_settings.llm_model as last resort.
            model = (
                chat_model
                or _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
                or (user_settings.llm_model if user_settings else settings.llm_model)
            )
        else:
            # Multi-model providers: try sub-agent override, then provider default, then fallback.
            # Phase 175 XPROV-03 (D-03): drop a stale cross-provider sub_agent_model
            # (its inferred provider != active) BEFORE the call via the shared guard.
            # When the guard returns None (cross-provider mismatch) we keep the existing
            # fall-through to _SUB_AGENT_MODEL_DEFAULTS[provider] — so no 404 is raised →
            # no fallback_model emit → no misleading banner (D-04 suppress-when-fine is
            # automatic). A same-provider override still passes through byte-identically.
            override = provider_safe_utility_model(
                user_settings,
                (user_settings.sub_agent_model if user_settings else "")
                or settings.sub_agent_model,
            )
            if override:
                model = override
            else:
                model = (
                    _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
                    or (user_settings.llm_model if user_settings else settings.llm_model)
                )

        # Google (Gemini) is verbose and truncates a title at 60 — give it room
        # for a full 4-6 word title. Other providers keep 30: non-reasoning models
        # emit a short title fine, and reasoning models (deepseek/moonshot/minimax/
        # zhipu) would burn any larger budget on hidden reasoning while BLOCKING the
        # producer spawn — so we keep their budget small (fast empty return) and let
        # _clean_llm_title fall back to a derived title. No added first-message latency.
        _title_max_tokens = 160 if provider == "google" else 30
        token_param = "max_completion_tokens" if _uses_max_completion_tokens(model) else "max_tokens"
        title_messages = [
            {
                "role": "system",
                "content": "You are a title generator. Output ONLY a 4-6 word title summarizing the user's message. No explanation, no refusal, no markdown, no quotes. Just the title words.",
            },
            {"role": "user", "content": f"Generate a title for this message: {first_user_message[:200]}"},
        ]
        response = client.chat.completions.create(
            model=model,
            messages=title_messages,
            stream=False,
            **{token_param: _title_max_tokens},
        )
        # _clean_llm_title strips <think> blocks, markdown/quotes, and refusals,
        # falling back to a derived title (never bare 'New Chat') on empty content.
        return _clean_llm_title(response.choices[0].message.content or "", first_user_message), None
    except openai.NotFoundError:
        provider = user_settings.active_provider if user_settings else ""
        if provider in _SINGLE_MODEL_PROVIDERS:
            # Single-model provider and the model 404'd -- no fallback available
            return _derive_title_from_message(first_user_message), None
        fallback = (
            _SUB_AGENT_MODEL_DEFAULTS.get(provider, "")
            or (user_settings.llm_model if user_settings else settings.llm_model)
        )
        if not fallback or fallback == model:
            return _derive_title_from_message(first_user_message), None
        fallback_info = {"original_model": model, "fallback_model": fallback}
        _title_max_tokens_fb = 160 if provider == "google" else 30
        token_param2 = "max_completion_tokens" if _uses_max_completion_tokens(fallback) else "max_tokens"
        title_messages = [
            {
                "role": "system",
                "content": "Generate a concise chat title (4-6 words max) for the following message. Respond with only the title, no punctuation, no quotes.",
            },
            {"role": "user", "content": first_user_message[:500]},
        ]
        response = client.chat.completions.create(
            model=fallback,
            messages=title_messages,
            stream=False,
            **{token_param2: _title_max_tokens_fb},
        )
        return _clean_llm_title(response.choices[0].message.content or "", first_user_message), fallback_info
    except Exception as e:
        logger.warning(
            "title_generation_failed: %s", e,
            exc_info=True,
        )
        return _derive_title_from_message(first_user_message), None


async def maybe_autotitle_thread(
    *,
    supabase,
    redis,
    thread_id,
    first_message,
    user_settings,
    chat_model,
    run_id,
    title_fn,
    emit,
) -> None:
    """Auto-title orchestration extracted VERBATIM from the ``send_message`` inline
    block (threads.py ~:1360-1408). Behavior byte-identical.

    ``title_fn`` (the title generator) and ``emit`` (the SSE XADD) are dependency-injected
    so ``send_message`` passes its module-global ``generate_thread_title`` / ``_emit`` —
    every ``patch("app.api.threads.generate_thread_title")`` / ``app.api.threads._emit``
    still intercepts (D-A4). The ordering invariant is preserved: the ``fallback_model``
    emit fires BEFORE the ``title`` emit; the nested try/except keep the identical
    ``logger.warning`` shapes so a title-gen failure never blocks the run.

    Phase 163 (D-03 — Warning #2, EXPLICIT client classification, NOT silent inheritance):
    this is REQUEST-SCOPED — its ONLY caller is ``send_message`` (threads.py), which awaits
    it INLINE (before the producer task is spawned) and passes its own request-injected
    ``supabase`` = the swapped ``get_user_supabase_client``. So the ``threads`` title
    read (:233) + write (:253) run under the caller's RLS (owner's own thread). It is NOT
    invoked from the producer, so it never needs ``get_service_role_supabase(org_id)``.
    """
    # D-067.2-05: Auto-title fires AFTER the first-user-message INSERT (line ~903)
    # but BEFORE the agent producer task starts (asyncio.create_task at the bottom
    # of this handler). Title is derived from the user message alone — independent
    # of run outcome — so the title persists regardless of success / failure /
    # timeout / cancellation / exception (closes D-067.2-05a + D-067.2-05b).
    #
    # Option B placeholder check (PATTERNS.md § 6 recommendation): only auto-title
    # when threads.title is the canonical "New Chat" default. Avoids re-titling an
    # existing thread whose user added a follow-up message AND avoids the
    # count-query race when the agent retries with the same thread_id.
    try:
        _title_check = await aexec(
            supabase.table("threads").select("title").eq("id", thread_id).single()
        )
        _existing_title = (_title_check.data or {}).get("title") if _title_check is not None else None
        if _existing_title == "New Chat":
            # generate_thread_title is sync (def at line ~660) and makes a blocking
            # provider SDK call (client.chat.completions.create) — wrap with
            # run_in_threadpool per CLAUDE.md D-v2.5-01.
            _title, _title_fallback = await run_in_threadpool(
                title_fn,
                first_message,
                user_settings,
                chat_model,
            )
            # Ordering invariant (preserved from the original :2398-2408 block):
            # fallback_model emit fires BEFORE title emit when title_fallback is
            # non-empty.
            if _title_fallback:
                await emit(redis, run_id, 'fallback_model', **_title_fallback)
            try:
                await aexec(
                    supabase.table("threads").update({"title": _title}).eq("id", thread_id)
                )
                await emit(redis, run_id, 'title', content=_title)
            except Exception as e:
                logger.warning(
                    "D-067.2-05 title persist/emit failed at run start: %s", e,
                    exc_info=True,
                )
    except Exception as e:
        # Outer try guards the title-check query AND the run_in_threadpool call —
        # never block the run on title-generation failure (matches the original
        # :2398-2408 block's exception-swallow stance, with a logger.warning
        # upgrade per CONTEXT.md D-067.2-05 fix shape).
        logger.warning(
            "D-067.2-05 title generation skipped due to setup error: %s", e,
            exc_info=True,
        )


__all__ = [
    "generate_thread_title",
    "maybe_autotitle_thread",
    "_SINGLE_MODEL_PROVIDERS",
    "_strip_think_blocks",
    "_derive_title_from_message",
    "_clean_llm_title",
]

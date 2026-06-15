"""Phase 085 — shared sub-agent model-routing safety helper.

REPLICATES the logic in sub_agent_service.py:62-89 (D-075.5-04 footgun mitigation)
so task_service.py can use the same safety net WITHOUT modifying sub_agent_service.py
(which is byte-frozen per D-085-16).

The rule: when a user switches active_provider but doesn't update sub_agent_model,
the stale picker would route (e.g.) a Google model name through an OpenAI client → 400.
This helper validates the resolved candidate against the active provider's
available_models list and falls back to a provider-safe default if it doesn't match.

Phase 085 Plan 05 (BUG-260528-01): hardened so the safety check fires on EVERY
resolution path — not just when override_model is truthy. The production call
site at task_service.py:229 passes override_model=None (D-085-11), so the
pre-fix safety check at line 58 never fired in production. Result: when the
user toggled Settings → active_provider="anthropic" but user_settings.llm_model
was still "gpt-4.1" (stale-cross-provider), the resolver leaked that name
through to the Anthropic client → 404.

Phase 093 Plan 03 (D-06): the safety net was STILL silently dead — it read a
``user_settings`` attribute that does NOT exist on ``UserEffectiveSettings``
(the real field is ``available_models: list[str]``).
``getattr`` always returned ``None`` → ``_active_models_list`` was always ``[]``
→ the validation branch never fired → ``_SUB_AGENT_MODEL_DEFAULTS`` never engaged.
This module now reads the real ``available_models`` list, so the cross-provider
mismatch fallback finally works.

Fix shape: ALWAYS validate the final candidate against _active_models_list.
If validation fails AND _SUB_AGENT_MODEL_DEFAULTS has a non-empty entry for
the active provider, return that provider default. If the provider's default
is intentionally empty (openrouter, ollama), keep the candidate as best-effort
with a WARNING log — those providers are flexible by design. When
``available_models`` is empty (fresh settings row) there is nothing to validate
against, so the candidate passes through unchanged — the fallback fires ONLY on
a genuine cross-provider mismatch (a known available_models list that excludes
the candidate), never on an unrecognised id with no list to check it against.

Phase 093 also adds ``resolve_workflow_ctx_model`` — the resolve-never-mutate
(D-05) wrapper that the Wave-2 ctx-build sites thread onto ``wf_ctx.model``.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS

logger = logging.getLogger(__name__)


def resolve_sub_agent_model_safely(
    user_settings: "UserEffectiveSettings | None",
    override_model: str | None = None,
    fallback_model: str | None = None,
) -> str:
    """Return a safe model name for sub-agent use.

    Validates the resolved candidate against the active provider's model
    family. Phase 085 Plan 05 (BUG-260528-01) extended the validation to
    fire on EVERY resolution path — not just when ``override_model`` is
    truthy — because the production call site at ``task_service.py:229``
    passes ``override_model=None`` and the pre-fix code leaked
    ``user_settings.llm_model`` (which may be stale-cross-provider) through
    the final return chain.

    Args:
        user_settings: per-user effective settings (carries active_provider +
            llm_model + available_models: list[str]).
        override_model: explicit sub-agent model the caller wants to use, if any.
            ``None`` is the production call path (D-085-11 — no LLM-controlled
            override in v1).
        fallback_model: caller-supplied last-resort default if everything else
            is empty.

    Returns:
        A model name string safe to send to the user's active provider's
        client. Guaranteed non-empty as long as at least one of
        ``override_model`` / ``user_settings.llm_model`` / ``fallback_model``
        / ``settings.llm_model`` is non-empty.
    """
    _active_provider = (user_settings.active_provider if user_settings else "") or ""
    # D-06: read the REAL field. ``available_models`` is already list[str] on
    # UserEffectiveSettings (models/user_settings.py:100) — no comma-split needed.
    # The old code read a ``user_settings`` attribute that does not exist on the
    # model, so this list was always empty and the validation below never fired.
    _active_models = (
        user_settings.available_models
        if (user_settings and getattr(user_settings, "available_models", None))
        else []
    )
    _active_models_list = list(_active_models)
    _provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(_active_provider, "")

    # 1. Build candidate via the existing precedence chain.
    #    Note: ``user_settings.llm_model`` may be stale-cross-provider here
    #    (e.g., still "gpt-4.1" after a provider toggle). The validation
    #    step below catches that case.
    candidate = (
        override_model
        or (user_settings.llm_model if user_settings else None)
        or fallback_model
        or settings.llm_model
    )

    # 2. Validate the candidate against the active provider's model list.
    #    This is the hardened safety net introduced by Plan 05 — it fires
    #    on ALL paths (override or not), closing BUG-260528-01.
    if _active_models_list and candidate not in _active_models_list:
        logger.warning(
            "sub_agent_model=%r is not in active provider=%r's model list "
            "(active_models=%r); falling back to provider default %r to "
            "avoid cross-provider call.",
            candidate, _active_provider, _active_models_list, _provider_default,
        )
        if _provider_default:
            return _provider_default
        # Flexible provider (openrouter, ollama) — no hard default exists.
        # Keep the candidate as best-effort. The downstream provider error
        # (if any) will surface clearly. This preserves the
        # flexible-provider contract: OpenRouter routes by model id, Ollama
        # serves whatever the user has pulled locally.
        logger.warning(
            "No _SUB_AGENT_MODEL_DEFAULTS entry for provider=%r; returning "
            "candidate=%r as best-effort.",
            _active_provider, candidate,
        )
        return candidate

    # 3. Candidate validates (or no available_models list is available to
    #    validate against — common for fresh user_settings rows). Return as-is.
    return candidate


def resolve_workflow_ctx_model(user_settings: "UserEffectiveSettings | None") -> str:
    """Effective model for a workflow ctx, resolved from the active provider (D-04).

    Resolve, NEVER mutate (D-05): does NOT touch saved ``llm_model`` /
    ``override_provider`` / ``available_models`` on the passed object. It only
    reads them and returns a safely-resolved model string.

    The Wave-2 plans (093-04 live kickoff, 093-05 resume + Continue) thread this
    return value onto ``wf_ctx.model`` at the 3 ctx-build sites. Phase-level
    precedence is unchanged downstream: ``phase.config.model or ctx.model``
    (phase_types._effective_model) — this resolves ``ctx.model`` itself.

    ``user_settings`` is ``None`` on resume / Continue today (Open Q2, deferred
    to the Wave-2 plans) → returns ``""`` → only ``phase.config.model`` applies
    on those paths until the owner's effective settings are loaded there.

    Args:
        user_settings: the run owner's effective settings, or ``None``.

    Returns:
        A safely-resolved model name string, or ``""`` when ``user_settings`` is
        ``None``. The returned string runs through
        ``resolve_sub_agent_model_safely`` so a stale cross-provider
        ``llm_model`` falls back to the active provider's default rather than
        leaking to the wrong client.
    """
    if user_settings is None:
        return ""
    return resolve_sub_agent_model_safely(
        user_settings,
        override_model=None,
        fallback_model=getattr(user_settings, "llm_model", None),
    )

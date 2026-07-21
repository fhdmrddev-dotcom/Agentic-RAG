"""Phase 162.5 Plan 01 (D-A2 / D-A4 / D-A5) — the run model/provider resolution transform.

Behavior-preserving G-5 refactor: the disabled-model fallback + provider-resolution helpers
(``_resolve_enabled_model`` / ``_reresolve_fallback_provider`` / ``_apply_fallback_to_request``)
and the ``send_message`` inline model/provider resolution block move VERBATIM out of the
2,444-LOC ``backend/app/api/threads.py`` into this leaf module. Zero "while-I'm-in-here"
edits — the bodies are copied unchanged (bugs included). This is the ``run_lifecycle.py``
extraction discipline (D-A4): docstring-states-invariant, additive-then-repoint, late imports
to break the ``threads.py`` <-> service cycle.

PATCH SURFACE (D-A4 — the acceptance bar):

- The three helpers are re-imported at module scope back into ``threads.py`` so
  ``test_149_fallback_notice.py``'s ``from app.api.threads import _resolve_enabled_model``
  + ``threads_mod._reresolve_fallback_provider`` / ``threads_mod._apply_fallback_to_request``
  still resolve.

- The moved bodies resolve their patched collaborators (``load_all_model_overrides`` /
  ``get_model_capability_async`` / ``override_provider``) LATE off ``app.api.threads`` because
  ``test_149`` patches them at ``threads_mod`` and drives the helpers directly — the moved
  bodies must read the patched attribute. Mirrors ``run_lifecycle.py``'s late imports; in
  production ``threads.X`` IS the re-exported real callable, so resolution is identical.

- ``resolve_run_model`` returns ``(resolved_model, resolved_provider, model_fallback_notice,
  body, user_settings)`` so ``send_message`` keeps the possibly-mutated ``body`` (effective
  model on the wire) and ``user_settings`` (fallback-aligned provider credentials).
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def _resolve_enabled_model(resolved_model: str, org_default: str) -> tuple[str, dict | None]:
    """Phase 149 (D-149-10) enabled-enforcement at the ONE shared model-resolution seam.

    If ``resolved_model`` was operator-DISABLED, fall back to the org default and return
    ``(org_default, notice)`` where ``notice`` names BOTH models for an honest inline SSE
    event; otherwise return ``(resolved_model, None)`` — byte-identical to before (the
    shared Deep/workflow path is untouched for the common enabled case; no per-provider
    fork, D-14 red line).

    The disabled check reads the CACHED all-rows override set (``load_all_model_overrides``
    — 30s TTL, no per-request DB read on a warm cache; the enabled-only hot cache is NOT
    touched). A model is disabled ONLY when its override row carries ``enabled=false``; an
    absent override defaults enabled. The org default is guaranteed ENABLED by the Plan-06
    Task-1 guards (the disable guard refuses disabling it; the lock guard refuses locking a
    disabled model), so the fallback target can never itself be disabled — no dead default.
    A settings-read blip is swallowed (returns the model unchanged) so this never breaks
    send_message.
    """
    from app.api.threads import load_all_model_overrides  # noqa: PLC0415 — D-A4 patch surface
    try:
        overrides = await load_all_model_overrides()
    except Exception:  # noqa: BLE001 — an override-read blip must never sink send_message
        return resolved_model, None
    is_disabled = (overrides.get(resolved_model) or {}).get("enabled") is False
    if is_disabled and org_default and org_default != resolved_model:
        notice = {
            "disabled_model": resolved_model,
            "fallback_model": org_default,
            "message": (
                f"{resolved_model} was disabled by your administrator — "
                f"this reply used {org_default}."
            ),
        }
        # WR-03/WR-04 defense-in-depth: re-verify the fallback target (the org default) is
        # itself ENABLED. The Plan-06 write-side guards keep the org default enabled, but a
        # multi-worker 30s-cache-staleness window could leave a DEAD default. If the org
        # default is ALSO disabled we KEEP the honest notice (never a silent route to a
        # disabled model) and log the anomaly — we do not pretend the fallback is a clean route.
        if (overrides.get(org_default) or {}).get("enabled") is False:
            logger.warning(
                "_resolve_enabled_model: org default %r is itself disabled — a dead default "
                "(WR-03 multi-worker window); surfacing the honest fallback notice, not a "
                "silent route to a disabled model.",
                org_default,
            )
        return org_default, notice
    return resolved_model, None


async def _reresolve_fallback_provider(effective_model: str, current_provider: str) -> str:
    """Phase 149 Plan 09 (D-149-10 bookkeeping honesty) — after a disabled-model fallback,
    re-resolve the RECORDED provider from the EFFECTIVE (fallback) model's capability so
    ``runs.provider`` matches the model that actually served the run.

    The send_message provider-resolution block leaves ``_resolved_provider`` as the
    PRE-fallback value on a fallback (the ``body.provider`` branch and the non-registry
    ``else`` branch both keep the original ``active_provider``) — a MiniMax-served fallback
    would otherwise record ``provider='anthropic'`` (the UAT Test-7 wart). This returns the
    effective model's provider ONLY when the capability is a VERIFIED entry
    (``capability_source`` in ``registry`` / ``db_override``), else the current provider
    UNCHANGED. WR-01 (review round 2): post-075.3, ``get_model_capability_async`` never
    returns ``provider="unknown"`` for a non-empty id — a registry/DB miss returns a
    pattern-INFERRED provider (slashed ids → ``openrouter``, garbage → the ``ollama``
    bucket) with ``capability_source="inferred"``, so a source check (the same D-075.3-08
    semantics the pre-existing provider-resolution block enforces 20 lines below the call
    site) is what actually delivers the "a garbage / absent capability never yanks the
    recorded provider" promise. Without it, an org default absent from the registry/DB
    (legacy env-CSV model, mis-cased id) would yank ``runs.provider`` AND live SDK routing
    to an inference bucket — e.g. a slashed local-model default routed to OpenRouter (the
    BUG-260616-01 data-egress class: a name cannot identify the endpoint).
    ``db_override`` is accepted alongside ``registry`` because a discovery-confirmed
    DB-only model is operator-verified. Reads through the same cached
    ``get_model_capability_async`` the handler already calls (no new per-request DB read
    on a warm cache); routing itself is unchanged.
    """
    from app.api.threads import get_model_capability_async  # noqa: PLC0415 — D-A4 patch surface
    capability = await get_model_capability_async(effective_model) or {}
    provider = capability.get("provider")
    source = capability.get("capability_source", "")
    if provider and provider != "unknown" and source in ("registry", "db_override"):
        return provider
    return current_provider


async def _apply_fallback_to_request(
    body, resolved_model: str, resolved_provider: str, user_settings
):
    """Phase 149 review round-2 CR-01 — apply a fired disabled-model fallback to the
    OUTBOUND request. Called ONLY when ``_model_fallback_notice`` is truthy (the enabled /
    no-fallback path never enters — byte-identical, D-14).

    Returns ``(body, resolved_provider, user_settings)``:

    - ``body`` is rebuilt with ``body.model`` = the EFFECTIVE (fallback) model. This is
      THE CR-01 fix: the model actually sent to the LLM is always ``body.model``
      (``agent_loop.py:1937`` native path, ``:2005``/``:2032`` compat path → the gateway's
      ``model=request.model``); ``ctx.resolved_model`` is a dead local there. Without the
      rewrite every fallback-fired run still sent the DISABLED model on the wire — the
      plan-09 provider flip then aimed that disabled model at the fallback model's
      provider (cross-provider fallback → provider 400/404 hard-fail, the exact UAT
      Test-7 shape), and a same-provider fallback silently served the disabled model
      while the inline notice claimed the fallback model replied. Post-seam
      ``body.model`` readers audited: the title-gen read (threads.py ~:1325), the
      RunContext/agent_loop request sites, and the suggestion-gen reads all correctly
      want the EFFECTIVE model.
    - ``resolved_provider`` / ``user_settings`` carry the plan-09 provider re-resolve
      (bookkeeping honesty — ``runs.provider`` names who actually serves the run) via
      the same canonical ``override_provider`` mutation path the registry branch uses.
      WR-02 (review round 2): the re-resolved provider is committed ONLY when the
      credentials switch actually applied — ``override_provider`` returns the settings
      UNCHANGED (same object) when the target provider has no configured API key, and
      recording the fallback provider in that case would make ``runs.provider`` name a
      provider that did not serve the run (the exact runs-row dishonesty plan 09 set out
      to fix, in the opposite direction).
    """
    from app.api.threads import override_provider  # noqa: PLC0415 — D-A4 patch surface
    fallback_provider = await _reresolve_fallback_provider(resolved_model, resolved_provider)
    if fallback_provider != resolved_provider:
        # Align user_settings so any downstream reader (agent_runner SDK selection)
        # stays consistent with the recorded provider — same canonical mutation path
        # the registry branch uses. Identity check: override_provider returns
        # `effective` unchanged on refusal (no key configured for the target).
        switched = override_provider(user_settings, fallback_provider)
        if switched is not user_settings:
            user_settings = switched
            resolved_provider = fallback_provider
    # CR-01: the producer's closure-captured body must carry the EFFECTIVE model —
    # this is the value the agent loop / provider gateway put on the wire.
    body = body.model_copy(update={"model": resolved_model})
    return body, resolved_provider, user_settings


async def apply_user_model_default(request, current_user, user_settings):
    """Phase 167 VIS-02 (D-167-04) — overlay the caller's per-user default model onto the
    effective settings at the ONE chat send seam, as a STRICT no-op when unset.

    D-14 RED LINE: when the user has NO preference (or it is locked / out of the enabled
    allowed-set / composes to the current default), returns the SAME ``user_settings`` object
    (identity) so the shared Deep / workflow send path is byte-identical to today. Only when a
    valid, unlocked, in-allowed-set preference DIFFERS from the current ``llm_model`` does it
    return a ``model_copy`` with the overlaid ``llm_model`` — ``resolve_run_model`` then
    re-derives the provider from the model id (cross-provider, D-167-09; no per-provider fork;
    an explicit in-composer ``body.model`` still wins because this only touches the FALLBACK
    ``user_settings.llm_model``).

    FAIL-OPEN: any error returns ``user_settings`` unchanged (T-167-16 — a preference blip must
    never break or block a send). D-v2.5-01: the per-user read + the allowed-set / lock reads all
    use async seams (asyncpg pool / the cached settings read) — no blocking supabase-py call.

    ``request`` is accepted for the send-seam call signature; the caller is identified solely by
    ``current_user["id"]`` (already validated by ``get_current_user``).
    """
    from app.models.user_settings import (  # noqa: PLC0415 — leaf-module seam, avoid import cycle
        compose_effective_model_default,
        enabled_model_allowed_set,
        load_user_model_default,
        operator_model_default_locked,
    )
    try:
        user_id = (current_user or {}).get("id")
        if not user_id:
            return user_settings
        user_pref = await load_user_model_default(user_id)
        if not user_pref:
            # Unset -> strict no-op BEFORE any further read: byte-identical (D-14).
            return user_settings
        enabled_models = await enabled_model_allowed_set()
        locked = await operator_model_default_locked()
        composed = compose_effective_model_default(
            user_pref, user_settings, enabled_models, locked
        )
        if composed and composed != user_settings.llm_model:
            return user_settings.model_copy(update={"llm_model": composed})
        # Composed == current default (locked / out-of-set / same pick) -> identity (D-14).
        return user_settings
    except Exception:  # noqa: BLE001 — fail-open: a preference blip never breaks a send
        logger.warning(
            "apply_user_model_default: overlay failed; using settings unchanged", exc_info=True
        )
        return user_settings


async def resolve_run_model(*, body, user_settings):
    """The send_message inline model/provider resolution transform, extracted VERBATIM
    (threads.py ~:1085-1143). Behavior byte-identical.

    Computes the resolved model (with the D-149-10 disabled-model fallback), resolves the
    provider (explicit ``body.provider`` > registry-verified capability > active-provider),
    and — when a disabled-model fallback fired — rewrites the outbound ``body.model`` +
    re-resolves the recorded provider/credentials. Returns the tuple the caller unpacks so
    the possibly-mutated ``body`` / ``user_settings`` flow into ``register_run_start`` and
    the producer closure unchanged.

    ``get_model_capability_async`` / ``override_provider`` are resolved LATE off
    ``app.api.threads`` so ``test_provider_router.py``'s ``patch("app.api.threads.
    override_provider")`` and the ``get_model_capability_async`` patches still intercept.
    """
    from app.api.threads import get_model_capability_async, override_provider  # noqa: PLC0415 — D-A4 patch surface
    resolved_model = body.model if getattr(body, "model", None) else user_settings.llm_model
    # Phase 149 (D-149-10) — enabled-enforcement at the ONE shared resolution seam: a user
    # whose selected model was just operator-DISABLED runs on the org default instead, with
    # an honest inline SSE notice naming BOTH models (emitted below, once the run stream
    # exists). Single-seam additive guard; for an enabled / no-override model this is a
    # no-op and the shared path stays byte-identical (no per-provider fork — D-14).
    resolved_model, model_fallback_notice = await _resolve_enabled_model(
        resolved_model, user_settings.llm_model
    )
    # D-067.3-N01-01: Resolution order — explicit body.provider (already
    # applied to user_settings.active_provider above via override_provider) >
    # MODEL_CAPABILITIES[model]["provider"] > active_provider fallback.
    # Repro: run 6eab949f-78da-4ea4-ac01-f04b16c9be7d (claude model + openai
    # default active_provider → routed to OpenAI SDK → 404). Fix uses the
    # existing get_model_capability helper which returns provider='unknown'
    # for unknown models so the fallback chain is naturally safe (D-067.3-N01-02).
    if body.provider:
        # Explicit override already applied to user_settings.active_provider above.
        resolved_provider = user_settings.active_provider
    else:
        capability = await get_model_capability_async(resolved_model) or {}
        capability_provider = capability.get("provider", "unknown")
        # Phase 075.3 D-075.3-08: only override the active provider when the
        # registry has a verified entry. After 075.3 get_model_capability no
        # longer returns provider="unknown" for unknown model_ids — it returns
        # a pattern-inferred provider (gpt-* → openai, gemini-* → google, etc.)
        # with capability_source="inferred". Falling through to active-provider
        # for inferred entries preserves D-067.3-N01-02 semantics: a totally
        # garbage model_id (which falls into the ollama fallback bucket)
        # shouldn't yank routing to Ollama when the user has an explicit
        # active_provider set.
        capability_source = capability.get("capability_source", "registry")
        if capability_provider != "unknown" and capability_source == "registry":
            resolved_provider = capability_provider
            # Align user_settings so downstream agent_runner reads see the
            # resolved provider for SDK selection (D-067.3-N01-04). The
            # inner-shadowed `user_settings = _user_settings` at the top of
            # agent_runner picks this mutation up for free. Use override_provider
            # to keep the canonical mutation path.
            user_settings = override_provider(user_settings, resolved_provider)
        else:
            resolved_provider = user_settings.active_provider

    # Phase 149 Plan 09 (D-149-10 bookkeeping honesty) + review round-2 CR-01 — when a
    # disabled-model fallback fired, resolved_model is now the org-default fallback but
    # BOTH the outbound request model (body.model — what the agent loop / gateway actually
    # send) and resolved_provider still hold PRE-fallback values. _apply_fallback_to_request
    # re-resolves the recorded provider from the EFFECTIVE fallback model (a MiniMax-served
    # fallback records "minimax", not the stale "anthropic") AND rewrites body.model to the
    # effective model so the fallback model is what actually goes on the wire (CR-01: without
    # the rewrite, a cross-provider fallback hard-failed and a same-provider fallback silently
    # served the disabled model under a false notice). Minimal additive guard at the existing
    # seam (threads.py is a G-5 hot file — no refactor, no per-provider fork); for the
    # no-fallback case model_fallback_notice is falsy → a no-op and the shared path stays
    # byte-identical (D-14).
    if model_fallback_notice:
        body, resolved_provider, user_settings = await _apply_fallback_to_request(
            body, resolved_model, resolved_provider, user_settings
        )
    return resolved_model, resolved_provider, model_fallback_notice, body, user_settings


__all__ = [
    "_resolve_enabled_model",
    "_reresolve_fallback_provider",
    "_apply_fallback_to_request",
    "apply_user_model_default",
    "resolve_run_model",
]

import logging
import re
from typing import Literal, TypedDict

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_PROVIDER_BASE_URLS: dict[str, str] = {
    "openai": "",
    "anthropic": "https://api.anthropic.com/v1",
    "google": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "openrouter": "https://openrouter.ai/api/v1",
    "ollama": "",  # resolved dynamically from ollama_base_url
    "lmstudio": "",  # resolved dynamically from lmstudio_base_url (Phase 111 D-111-7)
    "deepseek": "https://api.deepseek.com/v1",
    "moonshot": "https://api.moonshot.ai/v1",
    "minimax": "https://api.minimax.io/v1",        # INTERNATIONAL host — matches int'l key (D-089 docs curation 2026-05-30; api.minimax.chat is the China host, rejects int'l keys w/ 401)
    "zhipu": "https://api.z.ai/api/paas/v4",        # INTERNATIONAL z.ai host — matches docs.z.ai key (D-089 docs curation 2026-05-30; open.bigmodel.cn is the China host, separate key namespace)
}


# Plan 075.4-02 D-075.4-B1/B2/B3 — typed unknown-provider exception; FORWARD-REF #6
# retrofit hook for Phase 082.5 unified error sink. Keep .provider + .known_providers
# attribute names stable so the future sink can route via trace_id without breaking.
class UnknownProviderError(ValueError):
    """Phase 075.4 D-075.4-B3: typed unknown-provider exception with structured attrs.

    Subclass of ``ValueError`` so existing ``except ValueError`` callers keep
    working (back-compat). Raised by ``resolve_llm_provider`` at FastAPI
    lifespan startup when ``LLM_PROVIDER`` resolves to a name not registered
    in ``_PROVIDER_BASE_URLS`` (the single source of truth for known providers
    per D-075.4-B2). This replaces the silent-ollama-fallthrough failure mode
    documented in 075.4-RESEARCH §Plan 02 Site 1.

    Forward-ref hook: Phase 082.5 unified error sink will catch and route this
    via trace_id (FORWARD-REF #6 — keep .provider + .known_providers stable).
    """

    def __init__(self, provider: str, known_providers: list[str]):
        self.provider = provider
        self.known_providers = known_providers
        super().__init__(
            f"Unknown LLM_PROVIDER '{provider}'. "
            f"Known providers: {', '.join(known_providers)}. "
            f"Register a new provider in backend/app/config.py::_PROVIDER_BASE_URLS."
        )

# Main-agent context budget by provider. Used as fallback when no model-specific
# entry exists in MODEL_CONTEXT_DEFAULTS or MODEL_CONTEXT_LIMITS.
PROVIDER_CONTEXT_DEFAULTS: dict[str, int] = {
    "anthropic":  120_000,  # $3-5/1M — cap to control costs on long conversations
    "openai":     200_000,  # GPT-5.4 tiers at 272k — stay well below
    "google":     180_000,  # Gemini Pro tiers at 200k — stay just below
    "openrouter": 100_000,  # Unknown underlying model — stay conservative
    "ollama":      80_000,  # Local hardware — stay conservative
    "deepseek":  100_000,  # DeepSeek-V4 actual 64K-1M depending on model — conservative
    "moonshot":  200_000,  # Kimi K2.6 actual 262k
    "minimax":   160_000,  # MiniMax M2.7 actual 204k
    "zhipu":     100_000,  # GLM-4 actual 128k — conservative
}

# Per-model context budgets (practical input limits, not theoretical maximums).
# Leaves headroom for system prompt, tool results, and output tokens.
# Override any entry via MODEL_CONTEXT_LIMITS in .env (format: model-id=tokens,...)
MODEL_CONTEXT_DEFAULTS: dict[str, int] = {
    # ── OpenAI ──────────────────────────────────────────────────────────────
    "gpt-4o":                               100_000,  # actual 128k
    "gpt-4o-mini":                          100_000,  # actual 128k — deprecated, kept for compat
    "gpt-4.1":                              400_000,  # actual 1M — practical cap
    "gpt-4.1-mini":                         400_000,  # actual 1M — practical cap
    "gpt-4.1-nano":                         400_000,  # actual 1M — practical cap — deprecated
    "gpt-5":                                200_000,  # actual 200k — superseded by 5.4+
    "gpt-5.2":                              200_000,  # conservative cap pending published spec (live /models 2026-06-07, 096 D-05 curation)
    "gpt-5.4":                              400_000,  # actual 1M — 400K practical cap
    "gpt-5.4-pro":                          400_000,  # actual 1M — 400K practical cap (mirrors gpt-5.4; live /models 2026-06-07, 096 D-05 curation)
    "gpt-5.4-mini":                         200_000,  # actual 400K — 200K practical cap
    "gpt-5.4-nano":                         200_000,  # actual 400K — 200K practical cap
    "gpt-5.5":                              400_000,  # actual 1M — 400K practical cap
    "gpt-5.5-pro":                          400_000,  # actual 1M — 400K practical cap (mirrors gpt-5.5; live /models 2026-06-07, 096 D-05 curation)
    "gpt-5.6-sol":                          400_000,  # flagship — 400K practical cap (mirrors gpt-5.5; docs 2026-07-11, conservative pending GA spec)
    "gpt-5.6-terra":                        400_000,  # balanced everyday — 400K practical cap (mirrors gpt-5.5; docs 2026-07-11)
    "gpt-5.6-luna":                         200_000,  # lightweight/fast — 200K conservative cap pending published spec (docs 2026-07-11)
    # ── Anthropic ───────────────────────────────────────────────────────────
    "claude-opus-4-8":                      200_000,  # actual 1M — 200K practical cap (mirrors opus-4-7; live /models 2026-06-07, 096 D-05 curation)
    "claude-opus-4-7":                      200_000,  # actual 1M — 200K practical cap
    "claude-opus-4-6":                      200_000,  # actual 1M — superseded by 4.7
    "claude-sonnet-5":                      200_000,  # actual 1M — 200K practical cap (newest sonnet; live /models 2026-06-30)
    "claude-sonnet-4-6":                    200_000,  # actual 1M — 200K practical cap
    "claude-sonnet-4-5-20250929":           200_000,  # actual 1M — 200K practical cap (dated ID — undated alias not served live; 096 D-05 curation 2026-06-07)
    "claude-haiku-4-5-20251001":            200_000,  # actual 1M — 200K practical cap
    # ── Google ──────────────────────────────────────────────────────────────
    "gemini-2.5-pro":                       600_000,  # actual 1M — practical cap
    "gemini-2.5-flash":                     600_000,  # actual 1M — practical cap
    "gemini-2.5-flash-lite":                600_000,  # actual 1M — practical cap
    "gemini-3-flash-preview":               600_000,  # actual 1M — practical cap
    "gemini-3.1-pro-preview":               600_000,  # actual 1M — 600K practical cap
    "gemini-3.5-flash":                     600_000,  # actual 1M — practical cap (representative-class, mirrors 2.5-flash)
    "gemini-3.1-flash-lite":                600_000,  # actual 1M — practical cap (Gemini-3 budget production tier)
    # ── OpenRouter ──────────────────────────────────────────────────────────
    "meta-llama/llama-3.3-70b-instruct":    100_000,  # actual 128k
    "deepseek/deepseek-r1":                 100_000,  # actual 128k via OpenRouter
    "moonshotai/kimi-k2.5":                 200_000,  # actual 262k
    "minimax/minimax-m2.7":                 160_000,  # actual 204k
    "deepseek/deepseek-v4-pro":             200_000,  # actual 1M — stay conservative via OpenRouter
    # minimax/minimax-m2.5:free removed 2026-06-07 — no longer served by OpenRouter live /models (096 D-05 curation)
    "nvidia/nemotron-3-super-120b-a12b:free": 200_000,  # actual 262k
    "google/gemma-4-26b-a4b-it":             200_000,  # actual 262k
    "google/gemma-4-31b-it:free":            200_000,  # actual 262k — free tier
    # ── DeepSeek direct ────────────────────────────────────────────────────
    # deepseek-chat / deepseek-reasoner removed 2026-06-07 — the announced 2026-07-24
    # deprecation was effected early; live /models serves only the v4 tier (096 D-05 curation)
    "deepseek-v4-flash":                    200_000,  # actual 1M — conservative cap
    "deepseek-v4-pro":                      200_000,  # actual 1M — conservative cap
    # ── Moonshot/Kimi direct ──────────────────────────────────────────────
    "kimi-k2.6":                            200_000,  # actual 262k
    "kimi-k2.5":                            200_000,  # actual 262k (live /models 2026-06-07, 096 D-05 curation)
    "moonshot-v1-8k":                         7_000,  # actual 8k
    # ── MiniMax direct (int'l api.minimax.io; codes from /models, specs per platform.minimax.io/docs/guides/models-intro; D-089 curation 2026-05-30) ──
    "MiniMax-M2":                           200_000,  # docs: 200K ctx / 128K out / function calling
    "MiniMax-M2.1":                         200_000,
    "MiniMax-M2.1-highspeed":               200_000,
    "MiniMax-M2.5":                         200_000,
    "MiniMax-M2.5-highspeed":               200_000,  # fast rep (native-7 baseline)
    "MiniMax-M2.7":                         200_000,
    "MiniMax-M2.7-highspeed":               200_000,
    "MiniMax-M3":                           200_000,  # flagship — conservative cap pending published spec (live /models 2026-06-07, 096 D-05 curation)
    # ── GLM/Zhipu direct (int'l api.z.ai; all 7 from /models, D-089 curation 2026-05-30) ──
    "glm-4.5":                              128_000,
    "glm-4.5-air":                          128_000,  # lightweight fast tier
    "glm-4.6":                              180_000,  # actual 200k (native-7 baseline)
    "glm-4.7":                              180_000,
    "glm-5":                                180_000,  # newest flagship family
    "glm-5-turbo":                          128_000,  # fast GLM-5 tier
    "glm-5.1":                              180_000,  # latest flagship
    "glm-5.2":                              800_000,  # actual 1M — practical cap (newest flagship, 2026-06-13)
}


class ModelCapability(TypedDict, total=False):
    """Per-model capability registry entry.

    ``total=False`` so partial entries are allowed — only ``native_tools`` and
    ``provider`` were previously required; Phase 066 D-066-03 adds
    ``llm_call_timeout_seconds`` as optional, Phase 074 D-074-06 adds
    ``max_output_tokens`` as the hard API cap. Models without these fields
    fall back to runtime defaults at the lookup site.

    Phase 075.3 D-075.3-08 adds ``capability_source`` — ``"registry"`` for
    verified entries in ``MODEL_CAPABILITIES``, ``"inferred"`` for the
    pattern-based fallback emitted by ``get_model_capability`` for unknown
    model_ids. Used by ``backend/app/api/threads.py:1210`` to preserve the
    D-067.3-N01-02 active-provider fallback for inferred-provider models.
    """
    native_tools: bool
    provider: str  # documentation only; actual provider from user settings
    llm_call_timeout_seconds: int  # Phase 066 D-066-03 — per-LLM-call deadline
    max_output_tokens: int  # Phase 074 D-074-06 — hard API cap (vendor docs); clamp ceiling
    capability_source: Literal["registry", "inferred"]  # Phase 075.3 D-075.3-08
    # Plan 075.4-02 D-075.4-NN — registry-or-inference fields that subsume the
    # hardcoded startswith / frozenset heuristics in openai_service.py. Optional
    # by ``total=False``; lookup callers fall back to inferred defaults when
    # absent (preserves back-compat for inferred-provider models).
    uses_max_completion_tokens: bool  # Plan 075.4-02 — o-series + gpt-5+
    supports_parallel_tools: bool  # Plan 075.4-02 — currently False for google
    # Phase 091 TOOL-05 — per-provider tool-count soft ceiling. ABSENT = no cap
    # (the budget guard only fires for registered low-limit models). Google is
    # the SEED-035 priority target: its accuracy degrades past a modest tool
    # count, so the harness executor path caps the schema list at this value
    # (whitelist tools are always retained). Read at
    # openai_service.apply_tool_budget via MODEL_CAPABILITIES[model].get("max_tools").
    max_tools: int  # Phase 091 TOOL-05 — soft ceiling on get_tools schema count (SEED-035)
    # Phase 101.1 D-15 — capability-tiered FORCED EMISSION flags (default SAFE).
    # ``forced_emission`` True => this model can be FORCED to call a named tool
    # (TIER-FORCE per RESEARCH §2: openai/anthropic[non-thinking]/google/deepseek-v4/
    # glm/minimax/openrouter-with-require). ABSENT => TIER-COERCE (Kimi/Moonshot/Ollama —
    # genuinely unforceable). The lookup MUST read
    # ``get_model_capability(id).get("forced_emission", False)`` so a case-sensitivity
    # registry MISS (e.g. ``MiniMax-M3`` vs ``minimax-m3``) SAFELY degrades to coerce —
    # never wrongly assumes force works (Pitfall 7 / the zhipu/minimax tool-drop trap).
    forced_emission: bool  # Phase 101.1 D-15 — TIER-FORCE eligibility (default SAFE = absent)
    # ``strict_json_schema`` True => a token-level guaranteed schema is VERIFIED
    # (openai confirmed; deepseek strict confirmed). Left ABSENT where unverified
    # (MiniMax — A1, live-verify) so a strict response_format is only requested where it
    # genuinely holds.
    #
    # Phase 122 D-122-04 DEPRECATION NOTE: ``forced_emission`` + ``strict_json_schema``
    # are SUPERSEDED by the explicit ``emit_tier`` enum below. They are kept in place
    # but DEPRECATED-UNREAD for one phase (safer rollback per RESEARCH Open Q1) — Plan
    # 122-02's ladder reads ``emit_tier`` directly, never these two bools. Do NOT add a
    # derived view that re-reads ``strict_json_schema`` (that re-introduces the DeepSeek
    # strict guess — RESEARCH anti-pattern / Pitfall 3).
    strict_json_schema: bool  # Phase 101.1 D-15 — verified token-level schema guarantee (default SAFE = absent); DEPRECATED by emit_tier (Phase 122)
    # Phase 122 D-122-04 — the SINGLE SOURCE OF TRUTH for how a model is forced to
    # emit. Replaces the implicit two-bool guess (``forced_emission`` +
    # ``strict_json_schema``) with one explicit, doc-verified literal:
    #   "force_strict" => token-level guaranteed strict json_schema (OpenAI ONLY by
    #                     measurement — NOT by name; DeepSeek strict is inert without a
    #                     /beta base_url we never set, so DeepSeek is "force", Pitfall 3).
    #   "force"        => forceable named tool_choice, NO strict response_format
    #                     (anthropic/google/minimax/zhipu/deepseek + conditional openrouter).
    #   "coerce"       => genuinely unforceable (Kimi/Moonshot/Ollama) — directive +
    #                     hard-validate + retry, never a code-emission fallback.
    # The lookup MUST read ``get_model_capability(id).get("emit_tier", "coerce")`` so a
    # registry MISS (un-doc-verified / case-sensitivity) SAFELY degrades to coerce
    # (default-SAFE, D-122-05) — never wrongly assumes force/strict it hasn't verified.
    emit_tier: Literal["force_strict", "force", "coerce"]  # Phase 122 D-122-04 — single source of truth (default-SAFE "coerce")
    # Phase 149 D-149-04/D-149-05 — INFORMATIONAL sunset state. True => the provider is
    # deprecating the model / it vanished from live /models discovery (warn-and-steer).
    # The end-user effect is a BADGE ONLY — `enabled` alone controls availability; a
    # deprecated model can stay enabled. Overlaid from model_capabilities_overrides.deprecated
    # by get_model_capability_async so a discovery-confirmed DB-only row carries it with no code edit.
    deprecated: bool  # Phase 149 D-149-04 — informational deprecated badge (default absent = not deprecated)


# Capability registry: which models support native API tool calling.
# Unknown models default to native_tools=False (structured mode).
# User-extensible: add new models here after testing.
#
# Phase 066 D-066-03: per-model `llm_call_timeout_seconds` carries the
# per-LLM-call deadline (seconds). Revised 2026-05-24 to 3-tier model:
#   180s  — nano/lite budget models (fastest, smallest output)
#   300s  — standard capable models (mini, flash, haiku tiers)
#   600s  — flagship capable models (sonnet, pro, gpt-5 tiers)
#   900s  — reasoning / extended thinking (opus, o-series, deepseek-r1, kimi)
# The ceiling is generous because simple chats finish fast regardless;
# the timeout only guards against genuinely hung streams.
# Resolved by ``get_per_call_timeout(model_id, settings)`` below.
#
# Phase 074 D-074-06: per-model `max_output_tokens` carries the hard API
# cap (what the upstream provider's API refuses to exceed). Values
# verified live against each upstream provider's docs on 2026-05-18 —
# see .planning/phases/074-seed-009-seed-011-polish-bundle/074-RESEARCH.md
# §"Verified per-model max_output_tokens registry" for citation per row.
# Read at openai_service._resolve_max_tokens (clamp gate) via
# MODEL_CAPABILITIES.get(model_id, {}).get("max_output_tokens").
# Re-verify Anthropic table at every new snapshot release (Pitfall 5).
MODEL_CAPABILITIES: dict[str, ModelCapability] = {
    # OpenAI — proven native tool support
    # max_output_tokens verified against per-model OpenAI docs 2026-05-18
    # verified against live /models 2026-06-07 (096 D-05 curation) — o3/o4 removed (no longer
    # served); gpt-5.5-pro / gpt-5.4-pro / gpt-5.2 added; gpt-5.5 timeout 300s -> 600s
    # (flagship tier — Open Q4 resolved, operator-approved)
    # Phase 101.1 D-15: OpenAI is TIER-FORCE with a VERIFIED strict json_schema
    # (forced_emission + strict_json_schema both True, incl. reasoning models).
    "gpt-4o":       {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens":  16384, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},
    "gpt-4o-mini":  {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens":  16384, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},
    "gpt-4.1":      {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens":  32768, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},
    "gpt-4.1-mini": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens":  32768, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},
    "gpt-4.1-nano": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 180, "max_output_tokens":  16384, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},
    "gpt-5":        {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},
    "gpt-5.2":      {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},  # live /models 2026-06-07 (096 D-05 curation)
    "gpt-5.4":      {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},  # representative-class per memory feedback_model_names_representative.md
    "gpt-5.4-pro":  {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},  # pro/reasoning tier — live /models 2026-06-07 (096 D-05 curation)
    "gpt-5.4-mini": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},  # representative-class
    "gpt-5.4-nano": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 180, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},  # representative-class
    "gpt-5.5":      {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},  # 300s -> 600s flagship tier (Open Q4 resolved, operator-approved 2026-06-07)
    "gpt-5.5-pro":  {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},  # pro/reasoning tier — live /models 2026-06-07 (096 D-05 curation)
    # GPT-5.6 family (Sol/Terra/Luna) — durable capability tiers, previewed 2026-07-09
    # (openai.com/index/previewing-gpt-5-6-sol). Sol=flagship (only tier unlocking max
    # reasoning effort + ultra mode); Terra=balanced everyday; Luna=lightweight/fastest.
    # Same OpenAI TIER-FORCE + verified strict json_schema as the rest of the gpt-5 line.
    # Re-verify ids + caps against live /models (scripts/curate_models.py) once GA.
    "gpt-5.6-sol":   {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},  # flagship + max reasoning/ultra — reasoning tier
    "gpt-5.6-terra": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},  # balanced everyday — flagship tier (mirrors gpt-5.5)
    "gpt-5.6-luna":  {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},  # lightweight/fastest — standard tier
    "o1":           {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 900, "max_output_tokens": 100000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True, "emit_tier": "force_strict"},
    # o3 / o4 removed 2026-06-07 — no longer served by live /models (096 D-05 curation)
    # Anthropic direct — native tool_use
    # max_output_tokens verified against platform.claude.com/docs/en/about-claude/models/overview 2026-05-18
    # Rule-1 deviation from SEED-009: Opus 4.7 / Opus 4.6 = 128000 (live docs), NOT 32000 (seed older number)
    # verified against live /models 2026-06-07 (096 D-05 curation) — opus-4-8 added; undated
    # claude-sonnet-4-5 replaced by the dated claude-sonnet-4-5-20250929 (only the dated ID is served)
    # Phase 101.1 D-15: Anthropic is TIER-FORCE-NOTHINK — forced_emission True, but
    # forcing ERRORS under extended thinking, so the emit call runs thinking OFF
    # (already the resting state — no thinking param in anthropic_service.py). NO
    # strict_json_schema (forcing is built on forced tool use, not a token-level schema).
    # Phase 137.1-06 (BUG-260701-01 / D-14): "supports_assistant_prefill": False — the Claude
    # 4.6+/5 family REMOVED assistant-message prefill (a trailing assistant turn 400s). The
    # Anthropic adapter (open_anthropic_stream) strips a trailing assistant prefill for these
    # models ONLY; absent flag => True => byte-identical (older Claude + every other provider).
    "claude-sonnet-5":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "forced_emission": True, "supports_assistant_prefill": False, "emit_tier": "force"},  # newest sonnet — live /models 2026-06-30 (1M ctx, 128K out, vision+adaptive+effort+structured)
    "claude-opus-4-8":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "forced_emission": True, "supports_assistant_prefill": False, "emit_tier": "force"},  # newest flagship — live /models 2026-06-07 (096 D-05 curation)
    "claude-opus-4-7":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "forced_emission": True, "supports_assistant_prefill": False, "emit_tier": "force"},  # extended thinking — Issue #51568
    "claude-opus-4-6":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "forced_emission": True, "supports_assistant_prefill": False, "emit_tier": "force"},
    "claude-sonnet-4-6":         {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 600, "max_output_tokens":  64000, "capability_source": "registry", "forced_emission": True, "supports_assistant_prefill": False, "emit_tier": "force"},
    "claude-sonnet-4-5-20250929": {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 600, "max_output_tokens":  64000, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # dated ID — undated alias not served live (096 D-05 curation 2026-06-07)
    "claude-haiku-4-5-20251001": {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 300, "max_output_tokens":  64000, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    # Google direct — native function calling
    # max_output_tokens verified via Vertex AI + ai.google.dev docs 2026-05-18
    # Plan 075.4-02 D-075.4-NN — google rows carry supports_parallel_tools=False
    # because Google's OpenAI-compat layer rejects parallel_tool_calls. This is
    # the registry-driven replacement for the openai_service.py _NO_PARALLEL_TOOL_CALLS
    # frozenset({"google"}) heuristic (legacy fallback stays as defense-in-depth).
    # Phase 091 TOOL-05: max_tools=16 — Google's function-calling accuracy degrades
    # past a modest active-tool count (SEED-035). Conservative ceiling; the harness
    # executor caps the per-phase schema list here (whitelist tools always retained).
    # Only affects the harness path — Deep-Mode get_tools() is untouched (SC#2).
    # Phase 101.1 D-15: Google is TIER-FORCE — forced_emission True (tool_config
    # function_calling_config mode='ANY' + allowed_function_names forces a function call).
    "gemini-2.5-pro":         {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 600, "max_output_tokens": 65536, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True, "emit_tier": "force"},
    "gemini-2.5-flash":       {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True, "emit_tier": "force"},
    "gemini-2.5-flash-lite":  {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 180, "max_output_tokens": 65536, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True, "emit_tier": "force"},
    # Gemini 3.x preview — no published vendor cap as of 2026-05-18; OMITTED max_output_tokens
    # per RESEARCH.md Open Question 1 recommendation (pass-through is more honest than guessed value).
    # Add a value here once Google publishes the GA spec for these IDs.
    "gemini-3-flash-preview": {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 300, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True, "emit_tier": "force"},
    "gemini-3.1-pro-preview": {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 600, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True, "emit_tier": "force"},
    # gemini-3.5-flash — representative-class per memory feedback_model_names_representative.md.
    # Caps mirrored from gemini-2.5-flash; revisit when Google publishes the GA spec.
    # Added 2026-05-22 (the model surfaced quick-task 260522-gdg by virtue of being live-used).
    "gemini-3.5-flash":       {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True, "emit_tier": "force"},
    # gemini-3.1-flash-lite — production budget tier in the Gemini-3 family;
    # successor to gemini-2.5-flash-lite. Caps mirror 2.5-flash-lite pending GA spec.
    "gemini-3.1-flash-lite":  {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 180, "max_output_tokens": 65536, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True, "emit_tier": "force"},
    # DeepSeek direct — OpenAI-compatible API at api.deepseek.com
    # verified against live /models 2026-06-07 (096 D-05 curation) — deepseek-chat /
    # deepseek-reasoner removed: the announced 2026-07-24 deprecation was effected early;
    # live /models serves only the v4 tier
    # Phase 101.1 D-15: DeepSeek-v4 is TIER-FORCE with VERIFIED strict mode (BOTH
    # thinking + non-thinking; the server validates the json schema). Per-MODEL, not
    # per-provider — the served ids are v4-flash/v4-pro (deepseek-reasoner, which does
    # NOT support tool_choice, is no longer served — RESEARCH §2 caveat).
    "deepseek-v4-flash":  {"native_tools": True, "provider": "deepseek", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True, "emit_tier": "force"},  # DEMOTED — strict inert (no /beta base_url, Pitfall 3 / D-122-04)
    "deepseek-v4-pro":    {"native_tools": True, "provider": "deepseek", "llm_call_timeout_seconds": 900, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True, "emit_tier": "force"},  # DEMOTED — strict inert (no /beta base_url, Pitfall 3 / D-122-04)
    # Moonshot/Kimi direct — OpenAI-compatible API at api.moonshot.ai
    # verified against live /models 2026-06-07 (096 D-05 curation) — kimi-k2.5 added
    # Phase 101.1 D-15: TIER-COERCE — Kimi/Moonshot are genuinely UNFORCEABLE (no
    # required/named tool_choice; thinking further restricts to auto/none). LEAVE
    # forced_emission ABSENT (default SAFE → coerce: directive + hard-validate + retry,
    # never a code-emission fallback).
    "kimi-k2.6":          {"native_tools": True, "provider": "moonshot", "llm_call_timeout_seconds": 600, "max_output_tokens": 65536, "capability_source": "registry", "emit_tier": "coerce"},
    "kimi-k2.5":          {"native_tools": True, "provider": "moonshot", "llm_call_timeout_seconds": 600, "max_output_tokens": 65536, "capability_source": "registry", "emit_tier": "coerce"},  # live /models 2026-06-07 (096 D-05 curation)
    "moonshot-v1-8k":     {"native_tools": True, "provider": "moonshot", "llm_call_timeout_seconds": 120, "max_output_tokens": 8192, "capability_source": "registry", "emit_tier": "coerce"},
    # MiniMax direct — OpenAI-compatible API at api.minimax.io (INTERNATIONAL; all 8 verified
    # against live /models 2026-06-07, 096 D-05 curation — MiniMax-M3 added, exact PascalCase)
    # Phase 101.1 D-15: MiniMax is TIER-FORCE via OpenAI-compatible tool_choice
    # (forced_emission True). strict_json_schema LEFT ABSENT — whether a token-level
    # response_format guarantee exists is UNVERIFIED (A1, live-verify); PascalCase ids
    # are exact (the API is case-sensitive — a miss SAFELY degrades to coerce, Pitfall 7).
    "MiniMax-M2":             {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    "MiniMax-M2.1":           {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    "MiniMax-M2.1-highspeed": {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # fast
    "MiniMax-M2.5":           {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    "MiniMax-M2.5-highspeed": {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # fast rep (eval/native-7 baseline)
    "MiniMax-M2.7":           {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # (PascalCase — API is case-sensitive)
    "MiniMax-M2.7-highspeed": {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # fast flagship
    "MiniMax-M3":             {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 600, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # newest flagship — live /models 2026-06-07 (096 D-05 curation; exact PascalCase)
    # GLM/Zhipu direct — OpenAI-compatible API at api.z.ai/api/paas/v4 (INTERNATIONAL; codes from live /models, specs per docs.z.ai/guides/llm/*; D-089 docs curation 2026-05-30)
    # Phase 101.1 D-15: GLM/Zhipu is TIER-FORCE via OpenAI-compatible tool_choice
    # (forced_emission True). strict_json_schema LEFT ABSENT — verify strict
    # response_format live (RESEARCH §2 MEDIUM). PascalCase/exact ids matter (the
    # zhipu/minimax case-sensitivity tool-drop trap — a miss SAFELY coerces, Pitfall 7).
    "glm-4.5":            {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    "glm-4.5-air":        {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 180, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # lightweight fast tier
    "glm-4.6":            {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # 200K ctx (eval/native-7 baseline)
    "glm-4.7":            {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    "glm-5":              {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 600, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # GLM-5 family — 200K ctx / 128K out
    "glm-5-turbo":        {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 180, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # fast GLM-5 tier
    "glm-5.1":            {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 600, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # latest flagship — docs.z.ai: 200K ctx / 128K out / tools + thinking
    "glm-5.2":            {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 900, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},  # newest flagship — 1M ctx / 128K out / tools + thinking (2026-06-13)
    # OpenRouter — mixed; start safe with structured mode
    # max_output_tokens verified per upstream provider's model card 2026-05-18
    # verified against live /models 2026-06-07 (096 D-05 curation) — deepseek/deepseek-reasoner
    # + minimax/minimax-m2.5:free removed (no longer served by OpenRouter live /models)
    # Phase 101.1 D-15: OpenRouter is TIER-FORCE *conditional* — forced_emission True
    # ONLY where the routed upstream is itself forceable (deepseek / z-ai-glm / minimax).
    # The forcing adapter sends provider.require_parameters=true so OpenRouter does
    # NOT silently downgrade — WIRED in Phase 129 (D-02 / MP-04) into the
    # openrouter_tool_strategy=="quality" extra_body block at
    # openai_service.py (beside :exacto + plugins:[response-healing]); it was
    # documented here but unwired until then. A route to Kimi/Moonshot is STILL
    # unforceable even with require_parameters → those rows LEAVE forced_emission
    # ABSENT (default SAFE coerce).
    "deepseek/deepseek-chat":     {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600, "max_output_tokens":   8192, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    "deepseek/deepseek-r1":       {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 900, "max_output_tokens":  32768, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    "z-ai/glm-5.1":               {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    "z-ai/glm-5.2":               {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 900, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    # moonshotai/kimi-* route to Kimi (unforceable even with require_parameters) → coerce.
    "moonshotai/kimi-k2.5":       {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 900, "max_output_tokens":  65536, "capability_source": "registry", "emit_tier": "coerce"},
    "moonshotai/kimi-k2.6":       {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 900, "max_output_tokens":  65536, "capability_source": "registry", "emit_tier": "coerce"},
    # minimax-01 — legacy/discontinued ID; no clear vendor doc as of 2026-05-18; OMITTED
    # per RESEARCH.md A5 recommendation (pass-through preferred over guessed 16384).
    "minimax/minimax-01":         {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    "minimax/minimax-m2.7":       {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
    "deepseek/deepseek-v4-pro":   {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 900, "max_output_tokens":  65536, "capability_source": "registry", "forced_emission": True, "emit_tier": "force"},
}


# ── Phase 075.3 D-075.3-06/07/08/09: pattern-based inference for unknown model_ids ──
# Ordered list of (compiled-regex, provider) tuples — first match wins.
# Patterns chosen per ROADMAP SC#4 + RESEARCH.md §4 edge-case enumeration:
#   gpt-*       → openai
#   o1..o9 (-|$) → openai (explicit range; o10+ falls to ollama fallback — D-075.3-06)
#   claude-*    → anthropic
#   gemini-*    → google
#   */* (slash) → openrouter
#   else        → ollama (fallback per _INFERENCE_FALLBACK_PROVIDER)
#
# All patterns are anchored at ``^`` with bounded character classes to keep
# ``re.search`` linear in the input length — T-075.3-02-01 ReDoS mitigation.
#
# D-09 #1 / BUG-260616-01 (data-egress) — NAME-INFERENCE IS LAST-RESORT ONLY.
# The `^word/word → openrouter` rule below cannot disambiguate a slashed id that
# legitimately lives behind OpenRouter, a local LM Studio, OR a local Ollama
# (`google/gemma-3-4b` is valid on all three). A name therefore CANNOT identify
# the endpoint. Any caller that has an explicit stored `(provider, model)` pair
# (e.g. `app_settings.extraction_provider`) MUST prefer it and skip this inference
# entirely — see `backend/app/api/documents.py` extraction routing. Inference here
# stays purely as the legacy fallback for rows that never pinned a provider.
_INFERENCE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^gpt-", re.IGNORECASE), "openai"),
    (re.compile(r"^o[1-9](-|$)", re.IGNORECASE), "openai"),
    (re.compile(r"^claude-", re.IGNORECASE), "anthropic"),
    (re.compile(r"^gemini-", re.IGNORECASE), "google"),
    (re.compile(r"^deepseek-", re.IGNORECASE), "deepseek"),
    (re.compile(r"^kimi-", re.IGNORECASE), "moonshot"),
    (re.compile(r"^moonshot-", re.IGNORECASE), "moonshot"),
    (re.compile(r"^minimax-", re.IGNORECASE), "minimax"),
    (re.compile(r"^glm-", re.IGNORECASE), "zhipu"),
    (re.compile(r"^[^/\s]+/[^/\s]+"), "openrouter"),
]
_INFERENCE_FALLBACK_PROVIDER: str = "ollama"

# D-075.3-07: safe defaults per inferred provider. native_tools True for the
# native-tool providers (see _NATIVE_TOOL_PROVIDERS below: big-3 + deepseek/
# moonshot/minimax/zhipu); False for openrouter/ollama. max_output_tokens
# 8192 for big-3 + ollama; 4096 for openrouter (more heterogeneous backends,
# safer ceiling). Timeout 90s for all (matches the D-066-03 "fast / mini-tier").
_BIG_3_PROVIDERS: frozenset[str] = frozenset({"openai", "anthropic", "google"})
# Providers whose OpenAI-compatible endpoints support native function calling
# per their OWN official docs (verified 2026-05-30): openai/anthropic/google
# (big-3) PLUS the four OpenAI-compatible native providers deepseek / moonshot /
# minimax / zhipu. Used to set native_tools for INFERRED (registry-miss) models
# so a mis-cased or not-yet-registered model id (e.g. 'glm-4-plus',
# 'minimax-m2.7' lowercase) still gets NATIVE tool-calling instead of falling to
# structured mode (which never sends the tools param → the model narrates — and
# even fabricates — tool calls as text; live-confirmed on minimax-m2.7).
# Scoped on purpose: openrouter (heterogeneous backends) and ollama (local
# models with unreliable tool support) intentionally stay native_tools=False.
# See memory project-cross-provider-native-tools-registry-trap.
_NATIVE_TOOL_PROVIDERS: frozenset[str] = _BIG_3_PROVIDERS | frozenset(
    {"deepseek", "moonshot", "minimax", "zhipu"}
)
_INFERRED_DEFAULT_MAX_TOKENS: dict[str, int] = {
    "openai": 8192,
    "anthropic": 8192,
    "google": 8192,
    "openrouter": 4096,
    "ollama": 8192,
    "deepseek": 8192,
    "moonshot": 8192,
    "minimax": 8192,
    "zhipu": 8192,
}
_INFERRED_DEFAULT_TIMEOUT_S: int = 300

# D-075.3-09: module-level dedup. Safe under D-v2.5-02 single-uvicorn-worker
# (CLAUDE.md project rule). Each process starts empty; restart clears state.
# Multi-worker (D-PRD-12 / Phase 079) will need a different strategy (per-worker
# allowed; or move dedup to a Redis SET) — flag for revisit at that phase.
_WARNED_UNKNOWN_MODEL_IDS: set[str] = set()


def _infer_provider_for(model_id: str) -> str:
    """Pure helper: classify a model_id into an inferred provider bucket.

    Phase 075.3 D-075.3-06. Boundary cases (None / empty / whitespace) degrade
    to the fallback bucket (``ollama``). Exposed at module level so
    ``backend/app/api/settings.py`` can populate the ``inferred_provider_for``
    dict for the frontend "unverified" tooltip without mirroring the inference
    table client-side (RESEARCH.md §6 Approach b).
    """
    if not model_id or not str(model_id).strip():
        return _INFERENCE_FALLBACK_PROVIDER
    for pattern, provider in _INFERENCE_PATTERNS:
        if pattern.search(model_id):
            return provider
    return _INFERENCE_FALLBACK_PROVIDER


def _build_inferred_defaults(model_id: str, provider: str) -> ModelCapability:
    """Construct safe-default ``ModelCapability`` for an unknown model_id.

    Phase 075.3 D-075.3-07 + D-075.3-08 + D-075.3-09. Caps follow:
      max_output_tokens: 8192 (openai/anthropic/google/ollama), 4096 (openrouter)
      llm_call_timeout_seconds: 300 (all — revised 2026-05-24)
      native_tools: True (big-3 openai/anthropic/google), False (openrouter/ollama)

    Emits a once-per-process ``model_capability_unknown`` warning the first
    time each distinct ``model_id`` is observed. Logging is parameterized
    (``logger.warning("... %s ...", model_id, ...)``) so control chars in
    ``model_id`` are escaped by the formatter — T-075.3-02-02 mitigation.
    """
    cap: ModelCapability = {
        "native_tools": provider in _NATIVE_TOOL_PROVIDERS,
        "provider": provider,
        "llm_call_timeout_seconds": _INFERRED_DEFAULT_TIMEOUT_S,
        "max_output_tokens": _INFERRED_DEFAULT_MAX_TOKENS.get(provider, 8192),
        "capability_source": "inferred",
    }
    # Warn-once dedup (D-075.3-09). Skip for None/empty — those don't represent
    # meaningful operator triage signal.
    if model_id and model_id not in _WARNED_UNKNOWN_MODEL_IDS:
        _WARNED_UNKNOWN_MODEL_IDS.add(model_id)
        logger.warning(
            "model_capability_unknown model_id=%s inferred_provider=%s safe_defaults_applied=True",
            model_id,
            provider,
        )
    return cap


def get_model_capability(model_id: str) -> ModelCapability:
    """Return capability for a ``model_id``.

    Phase 075.3 D-075.3-08: registry hit returns verified caps with
    ``capability_source="registry"``; registry miss falls back to pattern-based
    provider inference + safe defaults (``capability_source="inferred"``), with
    once-per-process warning log per D-075.3-09.

    The pre-075.3 behavior was ``{"native_tools": False, "provider": "unknown"}``
    sentinel; the ``threads.py:1210`` D-067.3-N01-02 active-provider fallback
    now branches on ``capability_source == "registry"`` instead of
    ``provider != "unknown"`` to preserve the fallback semantics for inferred
    providers — a totally-garbage model_id (ollama bucket fallback) shouldn't
    yank routing to Ollama unexpectedly when the user has an explicit
    ``active_provider`` set.
    """
    if model_id in MODEL_CAPABILITIES:
        return MODEL_CAPABILITIES[model_id]
    # Boundary guard — None / empty / whitespace-only degrades to fallback
    # bucket without warning noise (caller likely passed a missing setting).
    if not model_id or not str(model_id).strip():
        return _build_inferred_defaults(model_id or "", _INFERENCE_FALLBACK_PROVIDER)
    return _build_inferred_defaults(model_id, _infer_provider_for(model_id))


# ── Phase 066 D-066-03: per-LLM-call timeout resolution ─────────────────
# Default per-LLM-call timeout for models not enumerated in
# MODEL_CAPABILITIES. 300s is generous enough to avoid false-positive
# timed_out on complex code-generation tasks while still bounding
# genuinely hung streams.
DEFAULT_LLM_CALL_TIMEOUT_SECONDS: int = 300

# T-066-05 mitigation: lower / upper bounds for the
# LLM_CALL_TIMEOUT_OVERRIDES env-var parser. Operator misconfiguration
# to 0 / negative integer would cause the per-call timer to fire
# instantly, making all runs `timed_out` (DoS). 3600s upper bound is a
# soft sanity cap.
_LLM_CALL_TIMEOUT_MIN_S: int = 1
_LLM_CALL_TIMEOUT_MAX_S: int = 3600

# WR-02 (Phase 145 review): the minimum periodic stale-sweep tick. A near-zero
# interval (an operator env typo like RUN_STALE_SWEEP_INTERVAL_SECONDS=0) would spin
# the sweep in a tight loop hammering Redis SET NX + Postgres — reject it at boot,
# mirroring the _LLM_CALL_TIMEOUT_MIN_S defense-in-depth.
_RUN_STALE_SWEEP_INTERVAL_MIN_S: int = 5


def get_per_call_timeout(model_id: str, settings_obj: "Settings | None" = None) -> int:
    """Resolve the per-LLM-call deadline (seconds) for a given model.

    Phase 066 D-066-03. Lookup precedence:
      1. ``settings_obj.llm_call_timeout_overrides`` (operator env override)
         — if ``settings_obj`` is provided AND the model_id has an override.
      2. ``MODEL_CAPABILITIES[model_id].llm_call_timeout_seconds`` —
         registered per-model default.
      3. ``DEFAULT_LLM_CALL_TIMEOUT_SECONDS`` (180s) — unknown-model fallback.

    Called inside ``agent_runner`` once per iteration just before each LLM
    stream block. The result is bounded to
    ``[_LLM_CALL_TIMEOUT_MIN_S, _LLM_CALL_TIMEOUT_MAX_S]`` as a
    defense-in-depth check on the env-var path.
    """
    # 1. Env override
    if settings_obj is not None:
        overrides = _parse_llm_call_timeout_overrides(
            settings_obj.llm_call_timeout_overrides
        )
        if model_id in overrides:
            return overrides[model_id]

    # 2. Per-model registered default
    cap = MODEL_CAPABILITIES.get(model_id, {})
    if "llm_call_timeout_seconds" in cap:
        return cap["llm_call_timeout_seconds"]  # type: ignore[typeddict-item]

    # 3. Unknown-model fallback
    return DEFAULT_LLM_CALL_TIMEOUT_SECONDS


def _parse_llm_call_timeout_overrides(raw: str) -> dict[str, int]:
    """Parse LLM_CALL_TIMEOUT_OVERRIDES env-var value.

    Phase 066 D-066-03. Syntax mirrors MODEL_CONTEXT_LIMITS /
    MODEL_OUTPUT_LIMITS: ``model-id=seconds,model-id=seconds`` (uses ``=``
    not ``:`` because some model ids contain colons, e.g.
    ``minimax/minimax-m2.5:free``).

    T-066-05 mitigation: every value is integer-coerced and bounded to
    ``[1, 3600]``. Out-of-range values are dropped with a logged warning.
    """
    out: dict[str, int] = {}
    if not raw or not raw.strip():
        return out
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry or "=" not in entry:
            continue
        # rsplit handles colon-in-model-id (e.g. minimax/minimax-m2.5:free)
        model_id, val_str = entry.rsplit("=", 1)
        model_id = model_id.strip()
        try:
            val = int(val_str.strip())
        except ValueError:
            logger.warning(
                "LLM_CALL_TIMEOUT_OVERRIDES: ignoring non-integer value for %r: %r",
                model_id, val_str,
            )
            continue
        if val < _LLM_CALL_TIMEOUT_MIN_S or val > _LLM_CALL_TIMEOUT_MAX_S:
            logger.warning(
                "LLM_CALL_TIMEOUT_OVERRIDES: ignoring out-of-range value for %r: %d "
                "(must be in [%d, %d])",
                model_id, val, _LLM_CALL_TIMEOUT_MIN_S, _LLM_CALL_TIMEOUT_MAX_S,
            )
            continue
        if val < 30:
            logger.warning(
                "LLM_CALL_TIMEOUT_OVERRIDES: tight per-call budget for %r: %ds "
                "(consider >=30s)",
                model_id, val,
            )
        out[model_id] = val
    return out


# ── Phase 081.1: Async 4-tier resolution (DB > env CSV > static > default) ──

async def get_per_call_timeout_async(
    model_id: str, settings_obj: "Settings | None" = None
) -> int:
    """Async counterpart of :func:`get_per_call_timeout` with DB tier (D-11/D-12).

    Resolution precedence:
      1. DB ``model_capabilities_overrides`` row ``llm_call_timeout_seconds``
      2. Env ``LLM_CALL_TIMEOUT_OVERRIDES`` CSV (same as sync tier 1)
      3. Static ``MODEL_CAPABILITIES`` dict (same as sync tier 2)
      4. ``DEFAULT_LLM_CALL_TIMEOUT_SECONDS`` (300s)
    """
    # Tier 1 — DB overrides
    from app.models.user_settings import _load_model_overrides  # lazy import
    try:
        db_overrides = await _load_model_overrides()
        db_cap = db_overrides.get(model_id)
        if db_cap is not None:
            db_timeout = db_cap.get("llm_call_timeout_seconds")
            if db_timeout is not None:
                return int(db_timeout)
    except Exception:
        logger.warning(
            "get_per_call_timeout_async: DB tier failed for model_id=%s; falling through",
            model_id,
            exc_info=True,
        )

    # Tier 2 — Env CSV override
    if settings_obj is not None:
        overrides = _parse_llm_call_timeout_overrides(
            settings_obj.llm_call_timeout_overrides
        )
        if model_id in overrides:
            return overrides[model_id]

    # Tier 3 — Static MODEL_CAPABILITIES dict
    cap = MODEL_CAPABILITIES.get(model_id, {})
    if "llm_call_timeout_seconds" in cap:
        return cap["llm_call_timeout_seconds"]  # type: ignore[typeddict-item]

    # Tier 4 — Default
    return DEFAULT_LLM_CALL_TIMEOUT_SECONDS


async def get_model_capability_async(model_id: str) -> "ModelCapability":
    """Async counterpart of :func:`get_model_capability` with DB tier.

    Checks ``model_capabilities_overrides`` first; if a row exists for
    ``model_id``, merges its fields onto the static-dict defaults. Falls
    through to the sync :func:`get_model_capability` for non-overridden models.
    """
    from app.models.user_settings import _load_model_overrides  # lazy import
    try:
        db_overrides = await _load_model_overrides()
        db_row = db_overrides.get(model_id)
        if db_row is not None:
            # Start from static defaults (if any), then overlay DB values
            base = dict(MODEL_CAPABILITIES.get(model_id, {}))
            if not base:
                base = dict(_build_inferred_defaults(model_id, db_row.get("provider", _INFERENCE_FALLBACK_PROVIDER)))
            # Overlay non-None DB fields
            for field in ("llm_call_timeout_seconds", "context_window_tokens",
                          "max_output_tokens", "native_tools", "deprecated"):
                db_val = db_row.get(field)
                if db_val is not None:
                    base[field] = db_val
            base["provider"] = db_row.get("provider", base.get("provider", "unknown"))
            base["capability_source"] = "db_override"
            return base  # type: ignore[return-value]
    except Exception:
        logger.warning(
            "get_model_capability_async: DB tier failed for model_id=%s; falling through",
            model_id,
            exc_info=True,
        )

    return get_model_capability(model_id)


# Sub-agent model defaults: cheapest stable model per provider.
# Intentionally lives here (not in sub_agent_service) to avoid circular imports
# when user_settings.py needs to resolve the model without importing sub_agent_service.
# NOTE (096 Pitfall 1): this table decides the harness eval's effective model per
# provider — workflow phases run via sub-agents, so the request's `model` field does
# NOT steer them. Assert effective model from sub-agent runs.model rows, and curate
# THIS table when bumping a provider's eval tier.
# verified against live /models 2026-06-07 (096 D-05 curation)
_SUB_AGENT_MODEL_DEFAULTS: dict[str, str] = {
    "anthropic":  "claude-haiku-4-5-20251001",
    "openai":     "gpt-5.4-mini",
    "google":     "gemini-3.5-flash",   # 093 Open Q1: confirmed served via live /models probe 2026-06-02 (both 2.5 & 3.5 serve; lock 3.x+ — 2.5 narrates tools w/o emitting, D-03; matches eval representative + newest-first)
    "openrouter": "",   # Unknown routing — fall back to user's selected model
    "ollama":     "",   # Local, user manages their own models
    "deepseek":  "deepseek-v4-flash",
    "moonshot":  "kimi-k2.6",
    "minimax":   "MiniMax-M2.7-highspeed",   # int'l api.minimax.io; fast flagship tier, PascalCase (096 D-05 curation 2026-06-07 — supersedes M2.5-highspeed)
    "zhipu":     "glm-5-turbo",              # int'l api.z.ai; fast GLM-5 tier from live /models (096 D-05 curation 2026-06-07 — supersedes glm-4.6)
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str
    # Phase 158 (CR-01): the remaining Supabase infra keys the install wizard collects and
    # persists to the setup-store. They MUST be declared here (default "") so the config
    # overlay can ``setattr`` them — Pydantic v2 raises ``ValueError`` on ``setattr`` of an
    # UNDECLARED field, which at import (``apply_setup_overlay`` below) would crash-loop the
    # backend on the first boot after finalize (bricking a wizard-configured box). Declaring
    # them also lets ``/public-config`` return the real ``supabase_anon_key`` so the browser's
    # Supabase client binds without a rebuild (the D-07 login path). Optional — a pre-158
    # env-configured box that never set them is unaffected (they stay "").
    supabase_anon_key: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""

    # Active provider — set this to switch between providers
    # Options: openai | anthropic | google | openrouter | ollama | deepseek | moonshot | minimax | zhipu
    # Leave blank to use the legacy LLM_API_KEY / LLM_BASE_URL directly.
    llm_provider: str = ""

    # Per-provider keys (add the ones you have; unused providers are ignored)
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    openrouter_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    # Phase 111 D-111-7 — LM Studio first-class provider (local OpenAI-compatible
    # server). Its URL ALREADY includes /v1, unlike ollama which appends it.
    lmstudio_base_url: str = "http://localhost:1234/v1"

    # Direct provider keys (Phase 076.1 — curated OpenAI-compatible providers)
    deepseek_api_key: str = ""
    moonshot_api_key: str = ""
    minimax_api_key: str = ""
    zhipu_api_key: str = ""

    # Resolved credentials — set directly only in legacy mode (no LLM_PROVIDER).
    # When LLM_PROVIDER is set these are overwritten by the validator below.
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = "gpt-4o"
    # Comma-separated list of models to expose in UI (defaults to llm_model if empty)
    available_models: str = ""

    # Per-provider model lists (comma-separated; empty = not configured)
    openai_models: str = ""
    anthropic_models: str = ""
    google_models: str = ""
    openrouter_models: str = ""
    ollama_models: str = ""

    # Direct provider model lists (Phase 076.1)
    deepseek_models: str = ""
    moonshot_models: str = ""
    minimax_models: str = ""
    zhipu_models: str = ""

    @model_validator(mode="after")
    def resolve_llm_provider(self) -> "Settings":
        provider = self.llm_provider.strip().lower()
        if not provider:
            return self  # legacy mode: LLM_API_KEY / LLM_BASE_URL used as-is

        # Plan 075.4-02 D-075.4-B1/B2: _PROVIDER_BASE_URLS is now the single
        # source of truth for known providers. The api-key resolution map
        # (a different concern) lives below; membership validation MUST go
        # through _PROVIDER_BASE_URLS.keys() so adding a new provider is a
        # one-edit operation (D-075.4-B2 — no second hardcoded list to drift).
        if provider not in _PROVIDER_BASE_URLS:
            raise UnknownProviderError(provider, list(_PROVIDER_BASE_URLS.keys()))

        key_map: dict[str, str] = {
            "openai": self.openai_api_key,
            "anthropic": self.anthropic_api_key,
            "google": self.google_api_key,
            "openrouter": self.openrouter_api_key,
            "ollama": "ollama",  # Ollama doesn't require a real key
            "lmstudio": "lm-studio",  # LM Studio doesn't require a real key (Phase 111 D-111-7)
            "deepseek": self.deepseek_api_key,
            "moonshot": self.moonshot_api_key,
            "minimax": self.minimax_api_key,
            "zhipu": self.zhipu_api_key,
        }

        resolved_key = key_map[provider]
        if resolved_key:
            self.llm_api_key = resolved_key

        if provider == "ollama":
            self.llm_base_url = f"{self.ollama_base_url.rstrip('/')}/v1"
        elif provider == "lmstudio":
            # LM Studio's URL ALREADY includes /v1 — NO append (unlike ollama).
            self.llm_base_url = self.lmstudio_base_url.rstrip("/")
        else:
            self.llm_base_url = _PROVIDER_BASE_URLS[provider]

        return self

    # Embedding provider (falls back to LLM key if not set)
    embedding_api_key: str = ""
    embedding_base_url: str = ""
    embedding_model: str = "text-embedding-3-small"
    # Must match the embedding model's output dimension.
    # 1536 = text-embedding-3-small, 768 = nomic-embed-text, 384 = all-MiniLM-L6-v2
    # Only change if switching models (requires resize_embedding_column + re-ingestion)
    embedding_dimensions: int = 1536

    # Phase 140 (TRIG-02 / D-04) — global token budget for the "## Available Skills"
    # catalog block. app_settings-only (env_attr=None readback in user_settings.py; a
    # budget is a VALUE, not a secret). 0 / negative => inject-all kill switch (today's
    # unbounded behavior). Default 1500 ≈ ~45-55 skills byte-identical — small catalogs
    # stay untouched (D-03 bypass). Resolved via resolve_skill_catalog_budget(), never a
    # hot-path magic number (CTX-03 discipline).
    skill_catalog_max_tokens: int = 1500

    # Retrieval settings
    retrieval_top_k: int = 5
    retrieval_match_threshold: float = 0.3

    # Hybrid search (vector + keyword with RRF fusion)
    hybrid_search_enabled: bool = True
    hybrid_candidate_count: int = 20  # candidates from each method before fusion
    vector_search_weight: float = 1.0
    keyword_search_weight: float = 1.0
    rrf_k: int = 60  # RRF constant (standard: 60)

    # Reranking (disabled by default — requires Cohere API key or local model)
    rerank_enabled: bool = False
    rerank_provider: str = "api"  # "api" (Cohere) or "local" (sentence-transformers)
    rerank_api_key: str = ""      # required when rerank_provider="api"
    rerank_model: str = "rerank-v3.5"  # API: "rerank-v3.5" | Local: "cross-encoder/ms-marco-MiniLM-L-6-v2"
    rerank_top_n: int = 5         # final results returned after reranking

    # Chunking settings
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Web search (Tavily) — tool is disabled when key is absent
    tavily_api_key: str = ""
    web_search_max_results: int = 5

    # Code execution sandbox
    sandbox_enabled: bool = False
    sandbox_ttl_minutes: int = 30
    # 096 / SEED-063 — wall-clock ceiling for a single execute_code call. A model
    # can write a non-terminating or O(n²)-on-huge-input computation; without a
    # cap it wedges the run forever (UAT Test 3: two runs stuck 40+ min, backend
    # could not even shut down). On expiry the handler kills+removes the sandbox
    # container (frees the blocked worker thread) and returns a tool-result error
    # so the agent loop continues. Generous default so legitimate heavy analysis
    # is unaffected; operator-tunable via env SANDBOX_EXEC_TIMEOUT_SECONDS.
    sandbox_exec_timeout_seconds: int = 180
    # Phase 151 (FILE-02 / D-02) — size cap for fetch_document_file. The tool streams a
    # KB document's ORIGINAL bytes to /sandbox/input/ (disk, never model context); a file
    # larger than this is refused PRE-download with an honest size error (refuse-never-
    # truncate — a half binary is corrupt). Chosen as an env-backed config.Settings field
    # (mirrors sandbox_exec_timeout_seconds above) rather than an app_settings column, to
    # avoid a second migration this phase. Operator-tunable via env FETCH_DOCUMENT_FILE_MAX_MB.
    fetch_document_file_max_mb: int = 50

    # Concurrency (Phase 058 — D-058-07)
    # Total AnyIO thread-pool tokens. FastAPI defaults to 40, which is the
    # ceiling for concurrent in-flight blocking .execute() calls when
    # wrapped in run_in_threadpool. SSE chat with parallel tool calls +
    # ingestion + audit writes can exceed 40 quickly; 200 gives headroom
    # until async client migration (CONCUR-03). Override in .env:
    # ANYIO_THREAD_TOKENS=<int>.
    anyio_thread_tokens: int = 200

    # Run-backed streaming (Phase 061 — D-v2.5-08, D-061-13)
    # URL of the Redis instance backing per-run SSE event streams.
    # Defaults to the local docker-compose.dev.yml service. Override in
    # .env: REDIS_URL=redis://… or rediss://… for TLS (Upstash). See
    # REDIS-SETUP.md for cloud setup.
    redis_url: str = "redis://localhost:6379"

    # asyncpg pool (Phase 073 — D-073-01/02/03)
    # Direct Postgres connection for the hot-path Postgres writes (runs INSERT
    # / runs UPDATE finalize / messages INSERT). Connects to :5432 direct
    # (local Supabase CLI: :54322), NOT the pgbouncer pooler on :6543 (D-073-01).
    # Pool sized 2/10 by default — leaves headroom for Phase 079 `--workers 2`
    # at an effective ceiling of 20 connections. Override in .env via
    # POSTGRES_DSN / POSTGRES_POOL_MIN / POSTGRES_POOL_MAX.
    postgres_dsn: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    postgres_pool_min: int = 2
    postgres_pool_max: int = 10

    # Operator role bootstrap (Phase 146 — ADMIN-01, D-01)
    # Comma-separated operator emails, idempotently seeded into operator_users on
    # startup (resolved against auth.users by lowercased email). Bootstrap-only —
    # the DB table is the runtime source of truth; removing an email does NOT
    # un-operator anyone (Phase 148 territory). Legitimately env/infra, not an
    # app_settings value (CLAUDE.md settings-vs-env rule). Replaces the deleted
    # BACKPRESSURE_ADMIN_USER_IDS allow-list + dev fail-open (D-02): /admin now
    # sits behind require_operator, non-operators get 404 even in dev.
    operator_emails: str = ""

    # Deployment environment marker (e.g. "production"). Consumed at the deploy/env
    # layer and by test guards; no longer gates /admin — Phase 146 replaced the
    # backpressure allow-list + dev fail-open with the require_operator gate (D-02).
    environment: str = ""

    # Phase 150 (SEC-01) — comma-separated MultiFernet key list; FIRST key encrypts,
    # the rest are decrypt-only (rotation). Secret/infra → env only per CLAUDE.md;
    # binds the env var SECRETS_ENCRYPTION_KEY via pydantic-settings. Empty =>
    # D-150-01 fail-open (secrets stay/save plaintext) + a loud boot warning. A
    # malformed key => D-150-04 fail-hard (refuse to start). Generate one with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    secrets_encryption_key: str = ""

    # Phase 066 D-066-01: the legacy 120s total-deadline asyncio.timeout
    # wrapper at threads.py:855 has been DELETED. The agent loop now has no
    # hard total cap (matches Claude/ChatGPT UX where complex tool-calling
    # workflows can run as long as needed within max_iterations). Per-LLM-call
    # budgets live on MODEL_CAPABILITIES.llm_call_timeout_seconds +
    # LLM_CALL_TIMEOUT_OVERRIDES env (resolved via get_per_call_timeout()).
    # The legacy `RUN_HARD_TIMEOUT_SECONDS` env-var symbol is silently
    # parsed-and-ignored (Pydantic Settings `extra="ignore"` at line 129) so
    # legacy deploys with the env set don't error at startup, but the value
    # has no effect.

    # Phase 066: consumer-side deadline for the replay-tail consumer at
    # runs.py. Independent from the producer's per-LLM-call budget — this
    # bounds how long a CONSUMER (frontend SSE client) will wait without an
    # event before emitting buffer_expired_during_tail. Worst-case agent
    # wall-time is max_iterations × per_call_budget; the consumer must
    # outlast that. Default 610s = 600s budget + 10s slack mirrors the
    # legacy `<run-hard-timeout> + 10` shape but with the new horizon.
    # Override in .env: CONSUMER_TIMEOUT_SECONDS=<int>.
    consumer_timeout_seconds: int = 610

    # Phase 066 D-066-03: optional per-model per-LLM-call timeout overrides.
    # Syntax: model-id=seconds,model-id=seconds (rsplit on '=' handles model
    # ids containing ':' like ``minimax/minimax-m2.5:free``). Bounded to
    # [1, 3600]. Mirrors MODEL_CONTEXT_LIMITS / MODEL_OUTPUT_LIMITS pattern.
    # Example: LLM_CALL_TIMEOUT_OVERRIDES=claude-opus-4-7=900,gpt-5.4=300
    llm_call_timeout_overrides: str = ""

    @property
    def web_search_enabled(self) -> bool:
        return bool(self.tavily_api_key)

    # Context window management
    context_window_max_tokens: int = 0
    # 0 = auto-select from MODEL_CONTEXT_DEFAULTS / PROVIDER_CONTEXT_DEFAULTS.
    # Set CONTEXT_WINDOW_MAX_TOKENS=<n> in .env to override for ALL models globally.
    context_window_reserve_recent: int = 10  # minimum recent messages to always preserve

    # Per-model context window overrides. Syntax: model-id=tokens,model-id=tokens
    # Use = not : as separator (model IDs like minimax-m2.5:free already contain colons).
    # Example: MODEL_CONTEXT_LIMITS=gpt-4o=128000,moonshotai/kimi-k2.5=250000
    # Overrides MODEL_CONTEXT_DEFAULTS for the listed models; others keep their defaults.
    model_context_limits: str = ""

    # Global max tokens override for LLM output.
    # When left at the default (8192), per-model/provider smart defaults apply instead
    # (see _MODEL_OUTPUT_DEFAULTS / _PROVIDER_DEFAULT_MAX_TOKENS in openai_service.py).
    # Set this explicitly in .env only when you need a universal cap (e.g. LLM_MAX_OUTPUT_TOKENS=32768).
    llm_max_output_tokens: int = 8192

    # Per-model output token overrides. Syntax: model-id=tokens,model-id=tokens
    # Example: MODEL_OUTPUT_LIMITS=claude-sonnet-4-6=32768,minimax/minimax-m2.7=32768
    # Overrides _MODEL_OUTPUT_DEFAULTS for the listed models.
    model_output_limits: str = ""

    # Vision model for image description during ingestion (must support vision)
    # Defaults to gpt-4o-mini — override with VISION_MODEL=<model-id> in .env
    vision_model: str = "gpt-4o-mini"

    # Sub-agent settings
    sub_agent_model: str = ""
    # Empty = auto-select cheapest model for active provider (see sub_agent_service.py).
    # Set SUB_AGENT_MODEL=<model-id> in .env to override for all providers.
    sub_agent_max_chars: int = 600_000
    # Sub-agents have their own independent context window — this cap is NOT protecting
    # the main agent's budget. 600k chars ≈ 150k tokens, which fits any 200k+ model
    # (Haiku 4.5: 200k, GPT-5.4-mini: 200k, Gemini Flash: 1M) with headroom for output.
    sub_agent_max_output_tokens: int = 8192
    # Default output ceiling for sub-agent analysis tasks (D-08).
    # Generation tasks (pptx, report, pdf, etc.) override this with max(32768, this value).
    # Range: 4096–65536. Set SUB_AGENT_MAX_OUTPUT_TOKENS=<n> in .env to override globally.
    # Overridable per-user via Settings UI slider.

    # Phase 085 — ask_user / task knobs (D-085-03, D-085-10, D-085-15)
    # ask_user_max_timeout_seconds: 30-min hard cap; default per-call is 300s.
    # task_max_steps: clamp for sub-agent iteration cap; default per-call is 5.
    # task_per_run_concurrency: asyncio.Semaphore size per top-level run (in-process).
    # task_global_concurrency: Redis tasks:global:active counter cap (cross-worker).
    ask_user_max_timeout_seconds: int = 1800
    task_max_steps: int = 10
    task_per_run_concurrency: int = 3
    task_global_concurrency: int = 20

    # Phase 145 (FND-01, D-145-06/07/08) — run staleness sweep (Direction B: a
    # dead-producer chat run whose Postgres runs.status still reads 'streaming' but
    # whose run:{id} Redis stream stopped growing). STALE_TIMEOUT KILLS such a run,
    # so it MUST EXCEED the longest legit SILENT gap of a LIVE producer: the ask_user
    # wait ceiling (ask_user_max_timeout_seconds=1800) > the silent-reasoning ceiling
    # (~900s). Operator-ratified generous default = 2400s (40 min) so a live-but-quiet
    # run (ask_user-waiting / long o-series) is NEVER false-killed (145-REPRO A2). A
    # SHORTER threshold (e.g. the pre-trace "2-5 min") would kill a waiting ask_user
    # run — do not lower without re-checking that ceiling. run_stale_sweep_interval is
    # the periodic tick; the guard TTL (90s) is set < this tick so exactly one
    # WORKER_COUNT=2 worker sweeps per tick. Config fields → tunable without a deploy
    # (project dynamic-settings direction); env override is free via pydantic-settings.
    run_stale_sweep_timeout_seconds: int = 2400
    run_stale_sweep_interval_seconds: int = 120
    # CR-02 (Phase 145 review) — start-grace floor for the periodic sweep. The
    # missing-stream ⇒ orphan branch must NOT fire on a just-started run that has not
    # written its first stream event yet: register_run_start (Postgres INSERT + mirror
    # ZADDs) lands BEFORE auto-title-generation (a blocking LLM call on the first
    # message of a new thread) and BEFORE agent_runner's first _emit/XADD creates the
    # run:{id} stream. A sweep tick inside that title-gen + provider-TTFT window would
    # false-kill a genuinely-live run. A run younger than this grace is SKIPPED by the
    # missing-stream branch; the stale-stream branch (2400s) still handles the aged
    # case. 60s covers the realistic title-gen round-trip + slow-provider TTFT budget.
    # Clamped in reconcile_orphaned_runs to [0, stale_timeout] (a run younger than the
    # stale window can never be stale). Config field → tunable without a deploy.
    run_start_grace_seconds: int = 60

    @model_validator(mode="after")
    def _validate_run_stale_sweep_bounds(self) -> "Settings":
        """WR-02 (Phase 145 review) — defense-in-depth bounds on the two stale-sweep
        knobs, mirroring the ``_LLM_CALL_TIMEOUT_MIN_S``/``_MAX_S`` discipline: an
        operator env typo must fail LOUD at boot, never silently DoS the sweep or
        false-kill live runs.

        - ``run_stale_sweep_interval_seconds`` < 5: a near-zero tick would spin the
          periodic sweep in a tight loop hammering Redis ``SET NX`` + Postgres.
        - ``run_stale_sweep_timeout_seconds`` < ``ask_user_max_timeout_seconds``: a
          threshold below the 1800s ask_user ceiling (D-145-07) would terminalize a
          legitimately-waiting ask_user run (or a long silent-reasoning turn) as
          ``failed`` — the exact false-kill this phase exists to prevent.
        """
        if self.run_stale_sweep_interval_seconds < _RUN_STALE_SWEEP_INTERVAL_MIN_S:
            raise ValueError(
                "run_stale_sweep_interval_seconds must be >= "
                f"{_RUN_STALE_SWEEP_INTERVAL_MIN_S} (got "
                f"{self.run_stale_sweep_interval_seconds}) — a near-zero tick would spin "
                "the periodic sweep in a tight loop."
            )
        if self.run_stale_sweep_timeout_seconds < self.ask_user_max_timeout_seconds:
            raise ValueError(
                f"run_stale_sweep_timeout_seconds ({self.run_stale_sweep_timeout_seconds}) "
                "must be >= ask_user_max_timeout_seconds "
                f"({self.ask_user_max_timeout_seconds}) — a lower threshold would "
                "false-kill a legitimately-waiting ask_user run (D-145-07)."
            )
        return self

    # Phase 091 — harness per-phase caps (D-12: derive from existing knobs, do
    # NOT invent arbitrary numbers). Both a STEP cap and a WALL-CLOCK cap are
    # enforced on every phase (a hanging phase fails cleanly at its timeout).
    #   - step cap: aligned to the existing agent-loop Explorer convention
    #     (max_iterations, agent_loop.py:846); llm_batch_agents reuses the same
    #     per-agent step cap.
    #   - wall-clock cap: a phase that makes up to N bounded LLM calls must allow
    #     >= N x the per-call timeout, so the default is
    #     DEFAULT_LLM_CALL_TIMEOUT_SECONDS (300) x harness_phase_max_steps.
    #     A per-phase config.wall_clock_seconds (harness.py) overrides this when set.
    # Both get the standard pydantic-settings env override for free — no new env
    # var beyond these two Settings fields.
    #
    # Phase 093 (D-19, 093-09): raised 8 → 12. The LIVE-UAT GLM literature_review
    # run showed a thorough 3-way batch sub-agent issuing 8 DISTINCT progressively-
    # refined search queries (LangSmith trace, project agentic-rag-module2) and
    # hitting the 8-step cap WHILE STILL RESEARCHING — genuine thorough research,
    # not a stuck loop (the other two GLM agents converged at step ~5 and EXACTLY
    # step 8, on the cap edge). 12 gives the headroom a thorough agent needs to
    # finish NATURALLY before the force-synthesis fallback (task_service.py
    # else-branch) fires. _MODEL_DEFAULT_MAX_STEPS (phase_types.py:71) +
    # LlmAgentPhaseConfig/LlmBatchAgentsPhaseConfig.max_steps (models/harness.py)
    # are raised to 12 IN LOCKSTEP so the sentinel-substitution
    # (`if config.max_steps == _MODEL_DEFAULT_MAX_STEPS: -> _EXPLORER_STEP_CAP`)
    # keeps firing and the EFFECTIVE per-phase cap is genuinely 12 (not 10). The
    # bounded `for step in range(max_steps)` + the graceful synthesis fallback keep
    # the run always-terminating (T-093-09-DOS); the wall-clock product stays
    # coupled at 300 x 12 = 3600.
    harness_phase_max_steps: int = 12
    harness_phase_wall_clock_seconds: int = DEFAULT_LLM_CALL_TIMEOUT_SECONDS * 12  # 300 x 12 = 3600

    # Phase 102 (D-03 / QUAL-01) — the LLM-judge model for the output-quality gate.
    # Settings-not-env (a model id is a VALUE, not a secret). None = a registry default
    # resolved at call time to a forced_emission:True model (claude-opus-4-8 / gpt-5.5,
    # both verified forced_emission:True at config.py MODEL_CAPABILITIES) so the judge
    # verdict is forceable. Independent of the run model (no self-judging). Per-workflow
    # override allowed (Plan 05).
    harness_judge_model: str | None = None

    # Phase 103 (D-103-2 / WFAUTH-02) — the LLM authoring model for NL workflow generation.
    # Settings-not-env (a model id is a VALUE, not a secret). None = a registry default resolved by resolve_authoring_model().
    harness_authoring_model: str | None = None

    # Phase 123 (D-08 / TRIG-01) — the skill-builder model (writes candidate skill
    # descriptions + auto-seeds the benchmark cases for the Trigger Tuner).
    # Settings-not-env (a model id is a VALUE, not a secret). None = a registry default
    # resolved by resolve_skill_builder_model(). Selectable across the FULL provider list
    # incl. local/self-hosted (Ollama / LM Studio / openai-compat / DeepSeek-on-own-infra),
    # so there is NO paid-provider single-point-of-failure (111.1 posture). DECOUPLED from
    # the benchmark targets — the builder WRITES candidates, the configured targets MEASURE
    # firing. Never hardcode a single paid provider as the only path (D-08 anti-pattern).
    skill_builder_model: str | None = None

    # Phase 102 (WR-04 / T-102-09-03 / QUAL-01) — the publish-level wall budget. The
    # synchronous publish endpoint drives a FULL golden run on the request thread; without
    # a deadline a wedged run holds the request indefinitely (a DoS / hours-long hold). The
    # golden-run drive is wrapped in ``asyncio.wait_for(harness_publish_max_seconds)`` and a
    # timeout maps to an honest ``golden_run_timeout`` block (never a hung request / 500).
    # Generous (publish is a rare deliberate event) but bounded (24 x 300s = 7200s = 2h).
    # The full background-job publish rework that would remove the synchronous hold entirely
    # stays deferred to Phase 103 — this is the minimum-viable hardening. Env-overridable.
    harness_publish_max_seconds: int = DEFAULT_LLM_CALL_TIMEOUT_SECONDS * 24  # 300 x 24 = 7200

    # Phase 091 (091-08 / CR-01) — resume-claim lease window. claim_run stamps
    # workflow_runs.claimed_at on the winning CAS; a racing WORKER_COUNT=2 sibling
    # sees the fresh stamp → 0 rows → skips (no double-execution). A crash mid-resume
    # leaves claimed_at stamped; the run becomes re-claimable once this lease expires
    # (so a dead worker's claim doesn't strand the run forever). Named knob, not a
    # magic literal; env-overridable via pydantic-settings.
    harness_resume_lease_seconds: int = 300  # 5 min

    # Phase 092 (092-03 / D-06) — Continue cap. At the iteration cap a run pauses
    # cap_paused and offers a Continue affordance; each Continue resumes the SAME
    # run with a fresh bounded budget and increments the DURABLE continues_used
    # column (migration 063). The (continues_used >= max_continues_per_run)-th
    # Continue is refused server-side. Durable, never an in-memory count — under
    # WORKER_COUNT=2 the Continue-handling worker may differ from the one that hit
    # the cap. Named knob, not a magic literal; env-overridable via pydantic-settings.
    max_continues_per_run: int = 3

    # Observability
    langsmith_api_key: str = ""
    langsmith_project: str = "agentic-rag-module2"
    langsmith_tracing: str = "true"

    frontend_url: str = "http://localhost:5173"


settings = Settings()


def apply_setup_overlay(target) -> None:
    """Overlay the first-run setup-store's infra tier onto ``target`` — STORE WINS (D-01/D-02).

    For each enumerated ``INFRA_KEYS`` entry, a truthy value in ``/data/setup.json``
    OVERRIDES the settings attribute. This polarity is deliberate and load-bearing: the
    onebox preset ships NON-EMPTY placeholders (``SUPABASE_URL=https://<project-ref>.supabase.co``),
    so a naive env-wins overlay would let the placeholder shadow the wizard's real value
    (RESEARCH Pattern 1). ONLY the infra tier is sourced from the store — app-level keys
    (provider API keys, ``operator_emails`` as an app read, retrieval knobs) live in
    ``app_settings`` and are NEVER overridden here.

    Mutates ``target`` in place (mirrors the ``resolve_llm_provider`` post-load mutator
    self-precedent). No-op on a fresh/unconfigured box (empty store). The infra keys do not
    feed the LLM resolver, so no resolver re-run is required for a store-driven change.
    """
    from app.services.setup_store import INFRA_KEYS, read_store

    store = read_store()
    if not store:
        return
    for k in INFRA_KEYS:
        v = store.get(k)
        # CR-01 defense-in-depth: only ``setattr`` a key the target actually HAS. Pydantic v2
        # raises ``ValueError`` on ``setattr`` of an undeclared field — at import that would
        # crash-loop boot. ``hasattr`` is True for a declared Settings field (all 8 INFRA_KEYS
        # now are) and False for an undeclared one, so a FUTURE INFRA_KEY added without a
        # matching field is SKIPPED, never a boot-bricking raise. (It also keeps the overlay
        # correct for the SimpleNamespace targets the unit tests drive.)
        if v and hasattr(target, k):  # STORE WINS for infra keys (placeholder-safe)
            setattr(target, k, v)


def needs_setup(target) -> bool:
    """Static, blip-proof first-run signal: is the box unconfigured (D-05 / Pattern 1)?

    ``needs_setup = (not setup_finalized()) AND (the infra config is still placeholder/blank)``
    — a pure string check on ``supabase_url``, NO live DB probe, so a DB blip can never
    re-trigger the wizard on a live box. A hand-filled 157-style box (a REAL ``supabase_url``
    but no marker file) reads False; only a genuinely unconfigured box (placeholder URL and
    no finalize marker) reads True.
    """
    from app.services.setup_store import _is_placeholder, setup_finalized

    if setup_finalized():
        return False
    return _is_placeholder(getattr(target, "supabase_url", ""))


# Phase 158 (DEPLOY-02, D-01/D-02): overlay the first-run setup-store's infra tier over env
# for the enumerated INFRA_KEYS (store-wins — placeholder-safe) so a wizard-configured
# one-box picks up its real infra values without a rebuild. No-op on a fresh box (no store).
apply_setup_overlay(settings)

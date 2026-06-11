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
    # ── Anthropic ───────────────────────────────────────────────────────────
    "claude-opus-4-8":                      200_000,  # actual 1M — 200K practical cap (mirrors opus-4-7; live /models 2026-06-07, 096 D-05 curation)
    "claude-opus-4-7":                      200_000,  # actual 1M — 200K practical cap
    "claude-opus-4-6":                      200_000,  # actual 1M — superseded by 4.7
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
    strict_json_schema: bool  # Phase 101.1 D-15 — verified token-level schema guarantee (default SAFE = absent)


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
    "gpt-4o":       {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens":  16384, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True},
    "gpt-4o-mini":  {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens":  16384, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True},
    "gpt-4.1":      {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens":  32768, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True},
    "gpt-4.1-mini": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens":  32768, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True},
    "gpt-4.1-nano": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 180, "max_output_tokens":  16384, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True},
    "gpt-5":        {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True},
    "gpt-5.2":      {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True},  # live /models 2026-06-07 (096 D-05 curation)
    "gpt-5.4":      {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True},  # representative-class per memory feedback_model_names_representative.md
    "gpt-5.4-pro":  {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True},  # pro/reasoning tier — live /models 2026-06-07 (096 D-05 curation)
    "gpt-5.4-mini": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True},  # representative-class
    "gpt-5.4-nano": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 180, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True},  # representative-class
    "gpt-5.5":      {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True},  # 300s -> 600s flagship tier (Open Q4 resolved, operator-approved 2026-06-07)
    "gpt-5.5-pro":  {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True},  # pro/reasoning tier — live /models 2026-06-07 (096 D-05 curation)
    "o1":           {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 900, "max_output_tokens": 100000, "capability_source": "registry", "uses_max_completion_tokens": True, "forced_emission": True, "strict_json_schema": True},
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
    "claude-opus-4-8":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "forced_emission": True},  # newest flagship — live /models 2026-06-07 (096 D-05 curation)
    "claude-opus-4-7":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "forced_emission": True},  # extended thinking — Issue #51568
    "claude-opus-4-6":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry", "forced_emission": True},
    "claude-sonnet-4-6":         {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 600, "max_output_tokens":  64000, "capability_source": "registry", "forced_emission": True},
    "claude-sonnet-4-5-20250929": {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 600, "max_output_tokens":  64000, "capability_source": "registry", "forced_emission": True},  # dated ID — undated alias not served live (096 D-05 curation 2026-06-07)
    "claude-haiku-4-5-20251001": {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 300, "max_output_tokens":  64000, "capability_source": "registry", "forced_emission": True},
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
    "gemini-2.5-pro":         {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 600, "max_output_tokens": 65536, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True},
    "gemini-2.5-flash":       {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True},
    "gemini-2.5-flash-lite":  {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 180, "max_output_tokens": 65536, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True},
    # Gemini 3.x preview — no published vendor cap as of 2026-05-18; OMITTED max_output_tokens
    # per RESEARCH.md Open Question 1 recommendation (pass-through is more honest than guessed value).
    # Add a value here once Google publishes the GA spec for these IDs.
    "gemini-3-flash-preview": {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 300, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True},
    "gemini-3.1-pro-preview": {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 600, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True},
    # gemini-3.5-flash — representative-class per memory feedback_model_names_representative.md.
    # Caps mirrored from gemini-2.5-flash; revisit when Google publishes the GA spec.
    # Added 2026-05-22 (the model surfaced quick-task 260522-gdg by virtue of being live-used).
    "gemini-3.5-flash":       {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True},
    # gemini-3.1-flash-lite — production budget tier in the Gemini-3 family;
    # successor to gemini-2.5-flash-lite. Caps mirror 2.5-flash-lite pending GA spec.
    "gemini-3.1-flash-lite":  {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 180, "max_output_tokens": 65536, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16, "forced_emission": True},
    # DeepSeek direct — OpenAI-compatible API at api.deepseek.com
    # verified against live /models 2026-06-07 (096 D-05 curation) — deepseek-chat /
    # deepseek-reasoner removed: the announced 2026-07-24 deprecation was effected early;
    # live /models serves only the v4 tier
    # Phase 101.1 D-15: DeepSeek-v4 is TIER-FORCE with VERIFIED strict mode (BOTH
    # thinking + non-thinking; the server validates the json schema). Per-MODEL, not
    # per-provider — the served ids are v4-flash/v4-pro (deepseek-reasoner, which does
    # NOT support tool_choice, is no longer served — RESEARCH §2 caveat).
    "deepseek-v4-flash":  {"native_tools": True, "provider": "deepseek", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True},
    "deepseek-v4-pro":    {"native_tools": True, "provider": "deepseek", "llm_call_timeout_seconds": 900, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True, "strict_json_schema": True},
    # Moonshot/Kimi direct — OpenAI-compatible API at api.moonshot.ai
    # verified against live /models 2026-06-07 (096 D-05 curation) — kimi-k2.5 added
    # Phase 101.1 D-15: TIER-COERCE — Kimi/Moonshot are genuinely UNFORCEABLE (no
    # required/named tool_choice; thinking further restricts to auto/none). LEAVE
    # forced_emission ABSENT (default SAFE → coerce: directive + hard-validate + retry,
    # never a code-emission fallback).
    "kimi-k2.6":          {"native_tools": True, "provider": "moonshot", "llm_call_timeout_seconds": 600, "max_output_tokens": 65536, "capability_source": "registry"},
    "kimi-k2.5":          {"native_tools": True, "provider": "moonshot", "llm_call_timeout_seconds": 600, "max_output_tokens": 65536, "capability_source": "registry"},  # live /models 2026-06-07 (096 D-05 curation)
    "moonshot-v1-8k":     {"native_tools": True, "provider": "moonshot", "llm_call_timeout_seconds": 120, "max_output_tokens": 8192, "capability_source": "registry"},
    # MiniMax direct — OpenAI-compatible API at api.minimax.io (INTERNATIONAL; all 8 verified
    # against live /models 2026-06-07, 096 D-05 curation — MiniMax-M3 added, exact PascalCase)
    # Phase 101.1 D-15: MiniMax is TIER-FORCE via OpenAI-compatible tool_choice
    # (forced_emission True). strict_json_schema LEFT ABSENT — whether a token-level
    # response_format guarantee exists is UNVERIFIED (A1, live-verify); PascalCase ids
    # are exact (the API is case-sensitive — a miss SAFELY degrades to coerce, Pitfall 7).
    "MiniMax-M2":             {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},
    "MiniMax-M2.1":           {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},
    "MiniMax-M2.1-highspeed": {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},  # fast
    "MiniMax-M2.5":           {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},
    "MiniMax-M2.5-highspeed": {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},  # fast rep (eval/native-7 baseline)
    "MiniMax-M2.7":           {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},  # (PascalCase — API is case-sensitive)
    "MiniMax-M2.7-highspeed": {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},  # fast flagship
    "MiniMax-M3":             {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 600, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},  # newest flagship — live /models 2026-06-07 (096 D-05 curation; exact PascalCase)
    # GLM/Zhipu direct — OpenAI-compatible API at api.z.ai/api/paas/v4 (INTERNATIONAL; codes from live /models, specs per docs.z.ai/guides/llm/*; D-089 docs curation 2026-05-30)
    # Phase 101.1 D-15: GLM/Zhipu is TIER-FORCE via OpenAI-compatible tool_choice
    # (forced_emission True). strict_json_schema LEFT ABSENT — verify strict
    # response_format live (RESEARCH §2 MEDIUM). PascalCase/exact ids matter (the
    # zhipu/minimax case-sensitivity tool-drop trap — a miss SAFELY coerces, Pitfall 7).
    "glm-4.5":            {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True},
    "glm-4.5-air":        {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 180, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True},  # lightweight fast tier
    "glm-4.6":            {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True},  # 200K ctx (eval/native-7 baseline)
    "glm-4.7":            {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True},
    "glm-5":              {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 600, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},  # GLM-5 family — 200K ctx / 128K out
    "glm-5-turbo":        {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 180, "max_output_tokens": 65536, "capability_source": "registry", "forced_emission": True},  # fast GLM-5 tier
    "glm-5.1":            {"native_tools": True, "provider": "zhipu", "llm_call_timeout_seconds": 600, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},  # latest flagship — docs.z.ai: 200K ctx / 128K out / tools + thinking
    # OpenRouter — mixed; start safe with structured mode
    # max_output_tokens verified per upstream provider's model card 2026-05-18
    # verified against live /models 2026-06-07 (096 D-05 curation) — deepseek/deepseek-reasoner
    # + minimax/minimax-m2.5:free removed (no longer served by OpenRouter live /models)
    # Phase 101.1 D-15: OpenRouter is TIER-FORCE *conditional* — forced_emission True
    # ONLY where the routed upstream is itself forceable (deepseek / z-ai-glm / minimax).
    # The forcing adapter MUST send provider.require_parameters=true so OpenRouter does
    # NOT silently downgrade. A route to Kimi/Moonshot is STILL unforceable even with
    # require_parameters → those rows LEAVE forced_emission ABSENT (default SAFE coerce).
    "deepseek/deepseek-chat":     {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600, "max_output_tokens":   8192, "capability_source": "registry", "forced_emission": True},
    "deepseek/deepseek-r1":       {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 900, "max_output_tokens":  32768, "capability_source": "registry", "forced_emission": True},
    "z-ai/glm-5.1":               {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},
    # moonshotai/kimi-* route to Kimi (unforceable even with require_parameters) → ABSENT.
    "moonshotai/kimi-k2.5":       {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 900, "max_output_tokens":  65536, "capability_source": "registry"},
    "moonshotai/kimi-k2.6":       {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 900, "max_output_tokens":  65536, "capability_source": "registry"},
    # minimax-01 — legacy/discontinued ID; no clear vendor doc as of 2026-05-18; OMITTED
    # per RESEARCH.md A5 recommendation (pass-through preferred over guessed 16384).
    "minimax/minimax-01":         {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600, "capability_source": "registry", "forced_emission": True},
    "minimax/minimax-m2.7":       {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600, "max_output_tokens": 131072, "capability_source": "registry", "forced_emission": True},
    "deepseek/deepseek-v4-pro":   {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 900, "max_output_tokens":  65536, "capability_source": "registry", "forced_emission": True},
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
                          "max_output_tokens", "native_tools"):
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

    # Backpressure admin endpoint (Phase 078 — D-078-07 WORKER-LIFT-04)
    # Comma-separated Supabase Auth user IDs allowed to call GET /admin/backpressure.
    # Fail-closed in production (ENVIRONMENT=production): 403 when unset/empty.
    # Fail-open in dev (default): no restriction so testing works without config.
    backpressure_admin_user_ids: str = ""

    # Deployment environment — used by backpressure auth gating and test guards.
    # Values: "production" | "prod" → fail-closed for admin endpoints.
    # Default: "" (dev/local) → fail-open.
    environment: str = ""

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

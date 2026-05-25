---
id: SEED-031
title: Direct Provider SDK Integrations (DeepSeek, Kimi, MiniMax, GLM)
status: folded
folded_into: "076.1"
planted: 2026-05-25
trigger_when: UX status fidelity phase ships and cross-provider testing resumes
surface: Agentic-RAG
source: Cross-provider monitoring session 2026-05-25
---

# SEED-031: Direct Provider SDK Integrations

## Observation

Cross-provider monitoring (2026-05-25) revealed that routing DeepSeek, Kimi, MiniMax, and GLM through OpenRouter adds significant reliability, latency, and cost penalties:

| Provider | Via OpenRouter | Issue |
|----------|---------------|-------|
| DeepSeek V4 Pro | 24min / 893K tokens | Sub-agent used main model (no default) — massive token waste |
| Kimi k2.6 | FAILED | OpenRouter compat layer couldn't parse Kimi's native tool format for large payloads |
| MiniMax M2.7 | FAILED | Likely output truncation via OpenRouter limits |
| GLM/Zhipu | Untested | Available via OpenRouter but not tested |

All 4 providers have OpenAI-compatible APIs with their own endpoints:
- DeepSeek: `api.deepseek.com`
- Kimi/Moonshot: `api.moonshot.cn`
- MiniMax: `api.minimax.chat`
- GLM/Zhipu: `open.bigmodel.cn`

## Implementation Shape

The existing `openai_service.py` already handles OpenAI + OpenRouter via `base_url` switching. Direct integrations would:

1. Add per-provider entries in `MODEL_CAPABILITIES` with `provider: "deepseek"` / `"moonshot"` / `"minimax"` / `"zhipu"`
2. Route to `openai_service.py` with per-provider `base_url` and `api_key` from env vars (`DEEPSEEK_API_KEY`, `MOONSHOT_API_KEY`, etc.)
3. Set per-provider sub-agent model defaults (e.g., `deepseek-chat` for DeepSeek sub-agents, `moonshot-v1-8k` for Kimi sub-agents)
4. Keep OpenRouter as generic fallback for any model not directly integrated
5. Optionally add per-provider system prompt sections for tool calling behavior (Kimi leaked raw tool markup, MiniMax narrates between calls)

## Open Questions

- Settings UI interaction: user picks "deepseek-v4-pro" → route to direct API or OpenRouter? Need a provider-preference hierarchy
- Per-provider timeout profiles from `MODEL_CAPABILITIES`
- Per-provider output token limits (MiniMax truncation was likely an OpenRouter limit, not MiniMax's own)
- Whether `model_id` patterns (`deepseek/*` vs bare `deepseek-v4-pro`) need normalization

## Re-open Trigger

Ship the UX status fidelity phase first (the "stuck" UX affects ALL providers equally). Then re-open this seed when cross-provider testing resumes and the direct API path can be A/B tested against OpenRouter for latency + reliability + cost.

## Evidence

- `.planning/reports/SESSION-20260525-ux-status-fidelity-findings.md` — master findings
- `.planning/reports/SESSION-20260525-deepseek-v4pro-monitoring.md` — 893K token run
- `.planning/reports/SESSION-20260525-kimi-openrouter-monitoring.md` — tool parse failure
- `.planning/reports/SESSION-20260525-minimax-m27-monitoring.md` — truncation failure

# LiteLLM Model Switching & Fallback Guide

This guide explains how to switch models and configure automatic fallbacks across providers (GLM-5.3, Kimi K3, Kimi K2.6, etc.) for Claude Code and GSD.

---

## 1. Automatic Fallback Architecture

```text
[Claude Code / GSD]
        │
        ▼
[LiteLLM Proxy Server]
        │
        ├──▶ 1. Try GLM-5.3 (Primary)
        │       │
        │       └── (If rate-limited, error, or down) ───┐
        │                                                ▼
        ├──▶ 2. Automatic Fallback 1: Kimi K3 ───────────┤
        │       │                                        │
        │       └── (If unavailable) ────────────────────┤
        │                                                ▼
        └──▶ 3. Automatic Fallback 2: Kimi K2.6 ─────────┘
```

---

## 2. Active Fallback Configuration

Your [litellm-config.yaml](file:///c:/Vibe%20Apps/Agentic%20RAG/litellm-config.yaml) is currently configured as follows:

```yaml
general_settings:
  master_key: sk-1234

litellm_settings:
  drop_params: true
  use_chat_completions_url_for_anthropic_messages: true

router_settings:
  num_retries: 1
  fallbacks:
    - "*": ["kimi-k3", "kimi-k2.6"]
    - "claude-*": ["kimi-k3", "kimi-k2.6"]

model_list:
  # Primary Target (GLM-5.3)
  - model_name: "*"
    litellm_params:
      model: custom_openai/glm-5.3
      api_base: https://open.bigmodel.cn/api/paas/v4
      api_key: 93c4627a1b614b93a3ecd9d7f0d44f57.YZL9cUMnVZGPvfxV
      custom_llm_provider: custom_openai

  - model_name: "claude-*"
    litellm_params:
      model: custom_openai/glm-5.3
      api_base: https://open.bigmodel.cn/api/paas/v4
      api_key: 93c4627a1b614b93a3ecd9d7f0d44f57.YZL9cUMnVZGPvfxV
      custom_llm_provider: custom_openai

  # Fallback Targets
  - model_name: "kimi-k3"
    litellm_params:
      model: custom_openai/kimi-k3
      api_base: https://api.moonshot.ai/v1
      api_key: sk-ork6n2eEtlLIvWMWyCePOP7lZj5zd15tfNciAkLWD06S9tsb
      custom_llm_provider: custom_openai

  - model_name: "kimi-k2.6"
    litellm_params:
      model: custom_openai/kimi-k2.6
      api_base: https://api.moonshot.ai/v1
      api_key: sk-ork6n2eEtlLIvWMWyCePOP7lZj5zd15tfNciAkLWD06S9tsb
      custom_llm_provider: custom_openai
```

---

## 3. Terminal Workflow

### Terminal 1: LiteLLM Proxy Server
Restart whenever you update the YAML file:
```powershell
litellm --config litellm-config.yaml --port 4000
```

### Terminal 2: Claude Code Client
```powershell
$env:ANTHROPIC_BASE_URL="http://localhost:4000"
$env:ANTHROPIC_API_KEY="sk-1234"
$env:ANTHROPIC_AUTH_TOKEN=$null
claude
```

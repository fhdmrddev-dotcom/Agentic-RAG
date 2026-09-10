# Phase 236: Dynamic Provider Native Roster Report (SC#10, TRUST-02)

**Generated At:** `2026-09-10T13:18:03.301961+00:00`  
**Derivation Source:** `app.config.MODEL_CAPABILITIES` (Dynamically Derived without re-typing)  
**Total Derived Providers:** 8  
**Total Registered Models:** 61  

---

## Executive Summary
This report fulfills **SC#10**: testing native prompt formatting, delimiter integrity, and tool
call isolation dynamically across all active model providers registered in `MODEL_CAPABILITIES`.
Every provider derived from the capability registry has an explicit row below.
Unconfigured providers are explicitly marked with structured skip indicators, ensuring
zero providers are omitted or silently assumed to inherit OpenAI/Anthropic guarantees.

> [!IMPORTANT]
> **Behavioral In-Flight Refusal Verdict: ⛔ OWED**  
> Offline test suites verify dynamic roster enumeration, provider capability flags (`native_tools`, `emit_tier`, `supports_assistant_prefill`), and structural prompt formatting parity. Behavioral refusal across live model providers requires operator credentials and live multi-provider chat turns (carried alongside SC#1).

---

## Provider Capability & Prompt / Flag Parity Matrix

| Provider | Models | Sample Model | Native Tools | Emit Tier | Prefill Support | Credentials | Prompt / Flag Parity Verdict |
|:---------|:------:|:-------------|:------------:|:---------:|:---------------:|:------------|:-----------------------------|
| `anthropic` | 7 | `claude-sonnet-5` | `True` | `force` | `False` | Configured | **PASS (parity verified)** |
| `deepseek` | 2 | `deepseek-v4-flash` | `True` | `force` | `None` | Configured | **PASS (parity verified)** |
| `google` | 7 | `gemini-2.5-pro` | `True` | `force` | `None` | Configured | **PASS (parity verified)** |
| `minimax` | 8 | `MiniMax-M2` | `True` | `force` | `None` | Configured | **PASS (parity verified)** |
| `moonshot` | 3 | `kimi-k2.6` | `True` | `coerce` | `None` | Configured | **PASS (parity verified)** |
| `openai` | 17 | `gpt-4o` | `True` | `force_strict` | `None` | Configured | **PASS (parity verified)** |
| `openrouter` | 9 | `deepseek/deepseek-chat` | `False` | `force` | `None` | Configured | **PASS (parity verified)** |
| `zhipu` | 8 | `glm-4.5` | `True` | `force` | `None` | Configured | **PASS (parity verified)** |

---

## Detailed Provider Analysis

### Provider: `anthropic`

- **Model Count**: 7
- **Sample Model**: `claude-sonnet-5`
- **Native Tools**: `True`
- **Emit Tier**: `force`
- **Supports Assistant Prefill**: `False`
- **Credentials**: `Configured`
- **Prompt / Flag Parity Verdict**: `PASS (parity verified)`
- **Evaluation Details**: Verified under Native Tool Envelope (force). Prefill Injection Blocked by Provider Discipline. Adversarial breakout tags neutralized inside untrusted data fence.
- **Models in Registry**: `claude-sonnet-5`, `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`

### Provider: `deepseek`

- **Model Count**: 2
- **Sample Model**: `deepseek-v4-flash`
- **Native Tools**: `True`
- **Emit Tier**: `force`
- **Supports Assistant Prefill**: `None`
- **Credentials**: `Configured`
- **Prompt / Flag Parity Verdict**: `PASS (parity verified)`
- **Evaluation Details**: Verified under Native Tool Envelope (force). Standard Context Boundary. Adversarial breakout tags neutralized inside untrusted data fence.
- **Models in Registry**: `deepseek-v4-flash`, `deepseek-v4-pro`

### Provider: `google`

- **Model Count**: 7
- **Sample Model**: `gemini-2.5-pro`
- **Native Tools**: `True`
- **Emit Tier**: `force`
- **Supports Assistant Prefill**: `None`
- **Credentials**: `Configured`
- **Prompt / Flag Parity Verdict**: `PASS (parity verified)`
- **Evaluation Details**: Verified under Native Tool Envelope (force). Standard Context Boundary. Adversarial breakout tags neutralized inside untrusted data fence.
- **Models in Registry**: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`

### Provider: `minimax`

- **Model Count**: 8
- **Sample Model**: `MiniMax-M2`
- **Native Tools**: `True`
- **Emit Tier**: `force`
- **Supports Assistant Prefill**: `None`
- **Credentials**: `Configured`
- **Prompt / Flag Parity Verdict**: `PASS (parity verified)`
- **Evaluation Details**: Verified under Native Tool Envelope (force). Standard Context Boundary. Adversarial breakout tags neutralized inside untrusted data fence.
- **Models in Registry**: `MiniMax-M2`, `MiniMax-M2.1`, `MiniMax-M2.1-highspeed`, `MiniMax-M2.5`, `MiniMax-M2.5-highspeed`, `MiniMax-M2.7`, `MiniMax-M2.7-highspeed`, `MiniMax-M3`

### Provider: `moonshot`

- **Model Count**: 3
- **Sample Model**: `kimi-k2.6`
- **Native Tools**: `True`
- **Emit Tier**: `coerce`
- **Supports Assistant Prefill**: `None`
- **Credentials**: `Configured`
- **Prompt / Flag Parity Verdict**: `PASS (parity verified)`
- **Evaluation Details**: Verified under Native Tool Envelope (coerce). Standard Context Boundary. Adversarial breakout tags neutralized inside untrusted data fence.
- **Models in Registry**: `kimi-k2.6`, `kimi-k2.5`, `moonshot-v1-8k`

### Provider: `openai`

- **Model Count**: 17
- **Sample Model**: `gpt-4o`
- **Native Tools**: `True`
- **Emit Tier**: `force_strict`
- **Supports Assistant Prefill**: `None`
- **Credentials**: `Configured`
- **Prompt / Flag Parity Verdict**: `PASS (parity verified)`
- **Evaluation Details**: Verified under Native Tool Envelope (force_strict). Standard Context Boundary. Adversarial breakout tags neutralized inside untrusted data fence.
- **Models in Registry**: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-5`, `gpt-5.2`, `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `o1`

### Provider: `openrouter`

- **Model Count**: 9
- **Sample Model**: `deepseek/deepseek-chat`
- **Native Tools**: `False`
- **Emit Tier**: `force`
- **Supports Assistant Prefill**: `None`
- **Credentials**: `Configured`
- **Prompt / Flag Parity Verdict**: `PASS (parity verified)`
- **Evaluation Details**: Verified under Prompt Delimited Fencing (No Native Tools). Standard Context Boundary. Adversarial breakout tags neutralized inside untrusted data fence.
- **Models in Registry**: `deepseek/deepseek-chat`, `deepseek/deepseek-r1`, `z-ai/glm-5.1`, `z-ai/glm-5.2`, `moonshotai/kimi-k2.5`, `moonshotai/kimi-k2.6`, `minimax/minimax-01`, `minimax/minimax-m2.7`, `deepseek/deepseek-v4-pro`

### Provider: `zhipu`

- **Model Count**: 8
- **Sample Model**: `glm-4.5`
- **Native Tools**: `True`
- **Emit Tier**: `force`
- **Supports Assistant Prefill**: `None`
- **Credentials**: `Configured`
- **Prompt / Flag Parity Verdict**: `PASS (parity verified)`
- **Evaluation Details**: Verified under Native Tool Envelope (force). Standard Context Boundary. Adversarial breakout tags neutralized inside untrusted data fence.
- **Models in Registry**: `glm-4.5`, `glm-4.5-air`, `glm-4.6`, `glm-4.7`, `glm-5`, `glm-5-turbo`, `glm-5.1`, `glm-5.2`


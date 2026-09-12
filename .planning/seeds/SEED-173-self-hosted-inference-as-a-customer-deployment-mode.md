---
seed_id: SEED-173
title: Self-hosted / local inference as a first-class CUSTOMER deployment mode — an open-source model on the customer's own hardware must behave identically whether it is served by Ollama, LM Studio, vLLM, or the vendor's own OpenAI-compatible API
created: 2026-08-17
planted_during: operator local-model testing, during Phase 195 execution
status: planted
priority: high
relates_to:
  - SEED-172 (local providers cannot be added through the Model Registry) — ⚠ **172 is ONE SYMPTOM
    OF THIS SEED, NOT THE REQUIREMENT.** Anyone planning from 172 alone will fix an admin form.
  - SEED-135 / SEED-040 — an id absent from `MODEL_CAPABILITIES` resolves `capability_source=inferred`
    and silently loses `emit_tier`. Local models are permanently in that state.
  - `project_target_scale` — org-scale, B2B-first. Enterprise buyers are exactly the population that
    runs its own inference.
  - `project_deployment_tiers_direction` + Phase 157/158 one-box deploy artifacts — the deployment
    surface a self-hosted inference tier would land in.
  - CLAUDE.md § "Provider-docs-first (evidence-based)" — conventions do NOT transfer 1:1 between
    providers; keep provider-specific handling at the service boundary.
trigger_when: >
  Any customer or prospect asks about running models on their own hardware, air-gapped operation, or
  data never leaving their network; OR a self-hosted / on-prem deployment tier is scoped; OR the
  provider roster, `_INFERENCE_FALLBACK_PROVIDER`, or the capability-inference patterns are touched.
---

# The requirement, in the operator's words

> *"Future customers wanted to run their local LLMs and have actually the hardware resources to load
> big models. So if for example Kimi K3 or other open-source providers are working on their own APIs,
> it should work the same in Ollama or LM Studio. This is the point."*

**The ask is provider-shape uniformity for OpenAI-compatible endpoints.** An open-source model should
behave the same whether it arrives via Ollama, LM Studio, vLLM, TGI, or the vendor's own hosted
OpenAI-compatible API. Today it does not, and the gap is structural rather than cosmetic.

**Why this is a product requirement and not a dev convenience:** the customers who run their own
inference are the ones who *cannot* send data to a cloud provider — regulated industries, sovereignty
requirements, air-gapped networks. That is the same org-scale B2B population this product targets.
For them, local inference is not a cost optimisation; it is the precondition for using the product at
all.

---

## Measured current state — five ways the local path is second-class

All measured 2026-08-17 against the live tree.

### ⚠ 1. THE LANDMINE — a locally-served Kimi K3 routes to Moonshot's CLOUD

`get_model_capability_async('kimi-k3-local')` resolves:

```json
{"provider": "moonshot", "native_tools": true, "capability_source": "inferred"}
```

The model-id pattern inference maps `kimi-*` → `moonshot`. **A customer running Kimi K3 on their own
hardware, with no explicit registry row, gets a capability profile pointing at `api.moonshot.ai`.**
For a customer whose entire reason for self-hosting is that data must not leave their network, that is
the worst failure this product could have.

⚠ **Scope this honestly before acting on it.** A prior measurement (recorded in the `runs` table)
established that **explicit provider selection WINS over model-name inference** for routing. So this
is not automatically an exfiltration bug — it bites when the provider is *not* explicitly pinned. But
**capability resolution is keyed on the model id regardless**, so even with the provider correctly
pinned to `lmstudio`, a locally-served Kimi inherits Moonshot's `native_tools: true` and Moonshot's
profile. **The exact blast radius needs measuring before this is written up as a defect** — that
measurement is the first task of any phase that picks this seed up.

### 2. Unknown local models resolve with NO context window at all

```
some-unregistered-local-model -> provider=ollama  context_window_tokens=NULL  max_output_tokens=8192
qwen3-72b-instruct            -> provider=ollama  context_window_tokens=NULL  max_output_tokens=8192
```

`_PROVIDER_CONTEXT_LIMITS` has `"ollama": 80_000` (*"Local hardware — stay conservative"*), but the
inferred path returns **`null`**, not 80 000. A customer who loads a 128k-context model gets no
context governance in either direction.

### 3. `lmstudio` is missing from THREE of the per-provider default maps

`ollama` is present in all of them; `lmstudio` — a first-class provider since Phase 111 (D-111-7) —
is in none:

| Map | `config.py` | `ollama` | `lmstudio` |
|---|---|---|---|
| context limits | `:57` | `80_000` | **absent** |
| max output tokens | `:465` | `8192` | **absent** |
| cheap/default model | `:748` | `""` | **absent** |
| `_INFERENCE_FALLBACK_PROVIDER` | `:438` | `"ollama"` | **never inferred** |

So `lmstudio` can be selected and routed to, but it inherits no local-tuned defaults, and **no model id
ever infers to it**.

### 4. Local models are pinned to the weakest tool-emission tier regardless of capability

`native_tools` is `False` for the local path and `emit_tier` resolves **`null`** — the TIER-COERCE
bucket (`config.py:177`, `:203`), the same treatment as the weakest cloud providers.

⚠ **This is empirically wrong for capable models.** A prior session confirmed a tool call (list
folders) working end-to-end through the OpenAI-compat path on `openai/gpt-oss-20b`. A customer running
a large Qwen/Kimi/DeepSeek locally — models with real native tool calling — gets silently downgraded
to the prompted path. `native_tools` IS per-model overridable in the registry, so the escape hatch
exists; **the default is what is wrong**, and it is wrong in the direction that degrades quality
invisibly.

### 5. Local models cannot be added through the UI at all

`POST /admin/models` validates the provider against the 8-cloud SSRF discovery allowlist. Full
analysis: **`SEED-172`**. Until that is fixed, every finding above must be worked around with hand-written
SQL — which no customer will ever do.

---

## ⚠ THE VALIDATION GAP — this cannot be tested on the development box, and that is the point

The operator's hardware **cannot load big models**; that is why local testing has been limited to
small ones. Everything above is therefore measured on *small* local models or by reading resolution
code.

**No claim about big-model local inference can currently be validated by this project.** That is not a
reason to avoid the work — it is a reason to state the limit plainly rather than let a
"works locally ✅" row imply a capability nobody exercised. Any phase taking this seed must decide, up
front, how it will get evidence:

- a machine that can actually hold a 70B-class model, or
- a hosted OpenAI-compatible endpoint standing in for "the customer's own API" (**closest cheap
  proxy** — it exercises the same code path without the hardware), or
- an explicitly recorded ⛔ with the blocking reason, per this project's scoreboard rule.

⚠ **The cheap proxy is genuinely good enough for most of it**, because the thing under test is
*provider-shape uniformity over an OpenAI-compatible API* — not the inference itself. Hardware is only
required for the context-and-throughput questions.

---

## What "done" would look like

1. **A model served over an OpenAI-compatible endpoint behaves identically** regardless of who serves
   it — same tool emission, same streaming, same structured output, same context governance.
2. **A self-hosted provider is configurable end to end from the UI** — added, enabled, tuned, and
   timed out, with no SQL. (`SEED-172`)
3. **No model id ever infers a CLOUD provider for a locally-served model.** Whatever the mechanism —
   an explicit local-provider pin that outranks pattern inference, or refusing to infer at all when a
   local provider is configured — the guarantee must be structural, not documentary.
4. **Capability defaults reflect what the model can do, not where it is served.** A big local model
   that supports native tools should not be coerced.
5. **Context comes from the server, not from a guess.** LM Studio's `/api/v0/models` reports
   `loaded_context_length`; Ollama exposes an equivalent. A "read the loaded context" action beats a
   hand-typed number that goes stale the moment the model is reloaded (`SEED-172` finding 4).
6. **The full cross-provider UAT roster gains a local row** — currently the roster is seven native
   cloud providers plus OpenRouter, and a self-hosted row is not in it. Under CLAUDE.md's own rule,
   a provider that ships untested is a provider tested by customers.

---

## Sequencing note

This is **a milestone-sized concern, not a phase.** It touches the provider registry, capability
inference, the admin surface, the deployment tiers, and the UAT roster. It should be sequenced with
the connections/platform work (`SEED-146`) and the deployment-tier direction rather than squeezed into
the v3.7 workflow milestone — but `SEED-172`'s add-model fix is small, independent, and unblocks the
operator's own testing today, so it can ship first and alone.

---

## 2026-09-12 — PARTIALLY DISCHARGED by migration 180. ⚠ STATUS STAYS `planted`, DELIBERATELY.

**What shipped:** the *reachability* half. Every self-hosted provider (`ollama`, `lmstudio`, and a
new generic `custom` slot) now carries a base URL **and** an API key that are settable from the
Settings UI, persisted in `app_settings`, and encrypted at rest. `_SELF_HOSTED_PROVIDERS` in
`config.py` is the one table; `normalize_/resolve_self_hosted_base_url` own the `/v1` rule. Fence:
`backend/tests/unit/test_180_self_hosted_provider_endpoints.py` (21 cases).

Three defects were measured and closed:
1. the Settings PUT gated the base_url write on `p.id == "ollama"`, so a URL typed for LM Studio was
   **dropped and answered 200 + "Saved"**;
2. `app_settings` had no `lmstudio_api_key`, so a key typed there took the **whole tab's save** down
   with an `UndefinedColumn` 500;
3. `config.py`'s `key_map` **hardcoded** the local-provider key, discarding an operator's real bearer
   token before the call — which is precisely what blocked a vLLM/Unsloth endpoint behind auth.

**⛔ WHY THIS IS NOT `shipped`.** This seed's requirement is *"behave IDENTICALLY whether served by
Ollama, LM Studio, vLLM, or the vendor's own OpenAI-compatible API"*, and the half that decides
BEHAVIOUR is untouched. A model id absent from `MODEL_CAPABILITIES` still resolves
`capability_source=inferred` and silently loses `emit_tier`; `native_tools` can land `False`, and
then **tool calls simply do not happen, with no error** (`project_local_models_structured_mode_trap`).
An operator can now point the app at their own hardware and get a *worse* agent than a cloud row,
with nothing saying why. **Reaching an endpoint is not parity.**

**Re-open trigger, unchanged and now sharper:** the next time anyone needs a local model to use
tools, or the capability-inference patterns / `_INFERENCE_FALLBACK_PROVIDER` are touched.

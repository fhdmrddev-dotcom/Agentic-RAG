---
seed_id: SEED-289
title: Tool calling is OFF by default for local/self-hosted models on a GUESS — and all three providers can be ASKED instead
created: 2026-09-16
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching model capability resolution, model discovery, or the Model Registry. ⛔ ALSO fires at the next milestone scoping — the operator directed this outcome on 2026-09-16 after seeing the measured 15.
trigger_paths: ["backend/app/config.py", "backend/app/services/model_discovery_service.py", "backend/app/api/admin.py", "backend/app/api/settings.py", "frontend/src/components/admin/ModelRegistryTab.tsx", "**/llm_service.py"]
trigger_surfaces: ["settings", "admin", "chat", "provider-routing"]
migration_note:
relates_to: ["SEED-172", "SEED-040", "SEED-135", "249", "BUS-246", "BUS-247", "BUG-260916-01"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-289: Tools are off by default on a guess, and the providers can be asked

## The finding

**15 of the operator's 94 configured models run with native tool calling OFF** (measured
2026-09-16 through the shipped `_tools_lost_model_ids`; full set and method on `BUS-246`).
**13 of the 15 are off for no reason other than that nothing has a registry row for them.**

The mechanism is one line — `backend/app/config.py:594`:

```python
"native_tools": provider in _NATIVE_TOOL_PROVIDERS,
```

`_NATIVE_TOOL_PROVIDERS` (`config.py:540`) is the big-3 plus deepseek / moonshot / minimax /
zhipu. **`ollama`, `lmstudio`, `custom` and `openrouter` are deliberately excluded**, with the
reason recorded at `config.py:537-539`:

> *"Scoped on purpose: openrouter (heterogeneous backends) and ollama (local models with
> unreliable tool support) intentionally stay native_tools=False."*

⚠ **That decision was reasonable in May 2026 and it is a GUESS, applied per PROVIDER to every
model under it.** `_INFERENCE_FALLBACK_PROVIDER` is `"ollama"` (`config.py:521`), so an
unrecognised id falls to the one bucket that guesses False.

⛔ **The cost is not a missing warning — the app INFLICTS the loss.** With `native_tools=False`
the `tools` param is never sent and the model runs in structured mode; `config.py`'s own warning
says the model then *"narrates — and even fabricates — tool calls as text"* and the agent loop
*"breaks after one iteration with no error anywhere."* Several of the 15 —
`meta-llama/llama-3.3-70b-instruct`, the `nvidia/nemotron-3-*` family on OpenRouter — support
tool calling upstream.

## Why it matters

⭐ **OPERATOR DIRECTION, 2026-09-16, verbatim:** *"we should have this tool call by default on
unless there is a way to know that this model does not support tool calls."*

⭐ **AND THERE IS A WAY TO KNOW, FOR ALL THREE PROVIDERS. The app does not have to guess at all.**
Verified against each vendor's own documentation (`provider-docs-first`), 2026-09-16:

| Provider | Can it report tool support? | How | Does the app ask? |
|---|---|---|---|
| **OpenRouter** | **YES** | `GET /api/v1/models` → `supported_parameters` contains `"tools"` | ⭐ **ALREADY PARSED** — `_extract_caps_openrouter` (`model_discovery_service.py:215-235`) |
| **Ollama** | **YES** | `POST /api/show` → `capabilities: ["completion","tools",…]` (ollama/ollama PR #10066) | ⛔ **NO** |
| **LM Studio** | **YES** | `GET /api/v0/models` → `capabilities.trained_for_tool_use` (boolean) | ⛔ **NO** |
| Custom / OpenAI-compatible | ⭐ **YES, by SHAPE** — see below | probe both shapes against the operator's URL | ⛔ **NO** |

⭐ **AND THE `custom` BUCKET IS NOT A TRUE UNKNOWN EITHER — OPERATOR, 2026-09-16.** The sentence
that stood here (*"this is the only true unknown"*) is **corrected rather than deleted, because the
correction changes the design.** The operator's `custom` endpoint is **Ollama or LM Studio behind a
tunnel** — their configured `custom_base_url` was a `trycloudflare.com` address — exposed that way
because the local box is not always reachable. ⛔ **So `custom` is not a fourth kind of server; it
is one of the two known servers at a different address.**

**Probe by SHAPE, not by provider name.** Against whatever base URL is configured, try
`/api/show` (Ollama) and `/api/v0/models` (LM Studio); whichever answers identifies **both** the
server and the model's tool support. ⭐ **This is the `sources/base.py` pattern this project already
proved at Phase 240 — *"mail is a SHAPE, not a fourth adapter"*** — and it means the capability
question is answerable for **every** provider the operator uses, with **no guessing tier left at
all**.

⚠ **NOT MEASURED, and recorded as unmeasured:** the tunnel was down when this was written
(`trycloudflare` URLs are ephemeral and the operator confirmed it is not currently set up), so all
three probes returned `ConnectError`. **The shape claim rests on the operator's statement and on the
two vendor docs above, not on a live probe of that endpoint.** Drive it before building on it.

⛔ **A TUNNELLED ENDPOINT LEAVES THE MACHINE, AND A LOCAL ONE DOES NOT.** A probe against
`localhost:11434` and a probe against a public `https://` host are not the same security event.
`app.security.egress.validate_mcp_destination` already exists for exactly this class of
operator-supplied outbound destination; the probe belongs behind it, and that is a plan-time
decision rather than an afterthought.

⛔ **AND OLLAMA'S REFUSAL IS LOUD, SPECIFIC AND CATCHABLE** — which is what makes ON-by-default
safe rather than reckless. Sending `tools` to a model that cannot use them returns **HTTP 400**:

```json
{"error":{"message":"registry.ollama.ai/library/<model> does not support tools",
          "type":"invalid_request_error","param":null,"code":null}}
```

⭐ **Compare the two failure modes.** Today: silent degradation, no error anywhere, the loop
breaks after one iteration and the operator cannot tell why. Proposed: a specific 400 the server
can catch, record and retry past. **A loud failure the system can learn from beats a silent one it
cannot.**

## The shape, in three parts — and part 3 is what makes part 2 safe

1. **ASK, DON'T GUESS.** Probe capabilities at the operator's own configured base URL —
   `/api/show` for Ollama, `/api/v0/models` for LM Studio — and make OpenRouter's
   already-parsed `supported_parameters` answer reach the resolver rather than stopping at
   discovery. ⭐ This alone settles roughly 14 of the 15.
2. **FLIP THE FALLBACK TO ON** for whatever the shape probe still cannot answer. This is the
   operator's direction. ⚠ **After the `custom` correction above, this tier may be EMPTY in
   practice** — every provider the operator actually uses is probe-answerable. Keep the tier
   anyway: it is the behaviour for a server nobody has met yet, and *"no fallback was needed"* is a
   measurement to report at the close, never an assumption to build on.
3. **LEARN FROM THE REFUSAL.** On a `does not support tools` 400, catch it, retry once without
   tools so the turn still completes, and **write `native_tools=false` onto that model's registry
   row** so it is asked once and never again. ⛔ **Without part 3, part 2 converts a silent
   degradation into a hard failure.** With it, the system self-corrects and the operator never
   has to know which models support tools.

## The constraint that shapes the design

⛔ **DISCOVERY CANNOT REACH SELF-HOSTED PROVIDERS, AND MUST NOT BE MADE TO.**
`PROVIDER_ENDPOINTS` (`model_discovery_service.py:50`) is a **hardcoded SSRF allowlist of 8
clouds**; ollama / lmstudio / custom are absent *on purpose* because their URLs come from
operator-set `app_settings` columns (`_SELF_HOSTED_PROVIDERS`, migration 180). `config.py:34-39`
states the rule outright: *"Widening THIS must never widen THAT."*

⭐ **So the capability probe is a NEW path, not a widened allowlist** — it reuses the same
operator-supplied base URL the chat traffic already routes to, and
`test_249_add_model_routing_roster.py` fences both directions. **A plan that adds ollama to
`PROVIDER_ENDPOINTS` has solved the wrong problem and opened an SSRF hole.**

## When to surface

Any phase touching `config.py`'s capability resolution, `model_discovery_service.py`, the Model
Registry admin surface, or the LLM client — **and at the next milestone scoping regardless**,
since the operator directed the outcome and can see the 15 in their own picker.

## The sibling finding — same phase, same model set

⛔ **`BUG-260916-01` IS THE OTHER HALF OF THIS AND SHOULD SHIP WITH IT.** Measured the same day:
`get_llm_client` (`openai_service.py:1251`) passes **no `timeout=` and no `max_retries=`**, so
`openai==2.28.0`'s own `DEFAULT_TIMEOUT` (**read=600**) and `DEFAULT_MAX_RETRIES` (**2**) bind —
while the admin surface accepts `llm_call_timeout_seconds` anywhere in **`[1, 3600]`**. **A value
above 600 is stored, displayed back, and cannot take effect.**

⭐ **The operator had already hit it and worked around it**: three of their six LM Studio rows are
set to **900**, and all three get 600. The other 13 local models have no row and run on the 300s
inferred default — *"it was timing out before it completes the task because it is slow on the GPU."*

⭐ **The two findings are ONE story: the app substituting a guess for the operator's own
configuration.** Tool support is guessed per provider; the timeout ceiling is imposed by an SDK
default nobody chose. **Same models, same cause, same phase.**

## Scope estimate

**Medium.** Two capability probes (three URLs, two shapes), one resolver change, one
retry-and-record path, a migration-free registry write, and the `timeout=` / `max_retries=` pass-
through from `BUG-260916-01`. ⛔ New capability → **a PHASE**, not a config tweak.

⚠ **Two things to settle before planning, not after:** (1) whether the probe runs at
add-model time, at discovery, or lazily on first use — a cold local server must not block a chat
turn; (2) what an operator-set value means once the probe disagrees with it —
`_tools_lost_model_ids` already honours *"the operator SAID so — believe them, either way"*, and a
probe that silently overrides that would break the rule the same function was fixed to obey.

## Breadcrumbs

- Operator direction, in session, 2026-09-16. Measurement recorded on `BUS-246`'s answer.
- `backend/app/config.py:519-554` — `_NATIVE_TOOL_PROVIDERS`, `_INFERENCE_FALLBACK_PROVIDER`,
  and the 2026-05-30 reasoning verbatim.
- `backend/app/services/model_discovery_service.py:74-76, 215-235` — `_CAPS_PROVIDERS` and the
  OpenRouter extractor that already answers this question.
- `backend/app/api/settings.py:217-270` — `_tools_lost_model_ids` and its overlay precedence.
- Ollama `/api/show` capabilities: https://docs.ollama.com/capabilities/tool-calling ·
  ollama/ollama PR #10066 · issue #9473 (*Detect if model has tools support*).
- Ollama's 400 shape: ollama/ollama issues #5793, #6704, #12344.
- LM Studio `capabilities.trained_for_tool_use`: https://lmstudio.ai/docs/developer/rest/list

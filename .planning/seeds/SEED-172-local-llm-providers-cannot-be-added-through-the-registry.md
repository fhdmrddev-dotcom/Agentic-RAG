---
seed_id: SEED-172
title: Local LLM providers (Ollama / LM Studio) cannot be added through the Model Registry — the add-model endpoint validates against the SSRF discovery allowlist instead of the routing roster
created: 2026-08-17
planted_during: operator local-model testing, during Phase 195 execution
status: partially-answered
priority: medium   # ⬆ operator fired arm 1 on 2026-09-13. Finding #1 SHIPPED in Phase 249 (MODEL-04). Findings #2/#3/#4 REMAIN OPEN — see the Phase 249 section at the end.
trigger_fired: >
  2026-09-13, at the v4.1 milestone close — the OPERATOR, unprompted: "I need to add manually from
  the model registry the models for Ollama or LM Studio and configure the timeout and everything,
  the context." That is arm 1 of `trigger_when`, verbatim, reported as lived friction rather than
  found by a sweep. ⚠ It fired ~4 weeks after planting, and nothing swept the register in between —
  the seed was reachable the whole time and it took a person hitting the wall to surface it.
relates_to:
  - Phase 149 (MODEL-01 / MODEL-02) — built the Model Registry tab and the add-model endpoint whose
    provider guard this seed is about. The guard is CORRECT for discovery and WRONG for add.
  - Phase 111 (D-111-7) — split `lmstudio` out of `ollama` as its own provider with its own base_url.
  - SEED-135 / SEED-040 — an id absent from `MODEL_CAPABILITIES` resolves `capability_source=inferred`
    and silently loses `emit_tier`. Local models are permanently in that state today.
  - CLAUDE.md § "Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are
    for secrets and infra only" — this is a case where the rule is *followed* for cloud models and
    *unreachable* for local ones.
trigger_when: >
  Anyone needs to register, tune or time-out a local model (Ollama / LM Studio) through the UI;
  OR the add-model endpoint or the Model Registry provider picker is touched for any reason;
  OR someone needs an LLM call to run longer than 600 seconds.
surface: Agentic-RAG
---

# Four findings, one workaround already applied

The operator was testing local models in LM Studio and asked where to change the per-model call
timeout. The timeout mechanism is fully built and dynamic — but **local models cannot reach it**,
because they cannot be added to the registry at all.

---

## 1. THE BLOCKER — an SSRF allowlist is being used as a provider-name roster

There are **two** provider rosters in the backend, and the add-model path validates against the wrong
one:

| Roster | Location | Contents | Actual purpose |
|---|---|---|---|
| `_PROVIDER_BASE_URLS` | `backend/app/config.py:10` | **11 providers — INCLUDING `ollama` and `lmstudio`** | routing — which providers the app can call |
| `PROVIDER_ENDPOINTS` | `backend/app/services/model_discovery_service.py:50` | **8 cloud only** | **SSRF allowlist** for outbound `/models` discovery |

`POST /admin/models` (`backend/app/api/admin.py:1218-1223`) does:

```python
if body.provider not in set(PROVIDER_ENDPOINTS):
    raise HTTPException(422, detail=f"Unknown provider: {body.provider}")
```

and the frontend picker hardcodes the same set — `ModelRegistryTab.tsx:764`:
*"The 8-cloud provider roster the operator picks from — the native-7 + OpenRouter."*

So local models are blocked at **both** layers.

### Why this is a conflation and not a security decision

`PROVIDER_ENDPOINTS` exists so that **no caller-supplied URL ever reaches the HTTP client**
(T-149-03). Local providers are *defined* by an operator-supplied base URL
(`ollama_base_url`, `lmstudio_base_url`), so they can never belong in an SSRF allowlist — correctly.

⚠ **But the add-model path makes no outbound request whatsoever.** It writes one row
(`INSERT INTO model_capabilities_overrides`). It borrowed the SSRF allowlist as a *"valid provider
names"* list, and those are two different concepts that happen to have overlapped for cloud
providers.

**Fixing it weakens nothing.** Discovery would still refuse local providers — which only means local
models are hand-added rather than auto-discovered, which is the correct outcome anyway.

### Shape of the fix
- Validate `body.provider` against the **routing** roster (`_PROVIDER_BASE_URLS`), not the discovery one.
- Add the local providers to the `ModelRegistryTab` picker.
- ⚠ **Assert, in a test, that `discover_all` STILL refuses `ollama`/`lmstudio`.** That assertion is
  what proves the SSRF guard survived the change — without it the fix looks identical to a regression.

Size: two files + tests + a picker change, on an endpoint carrying a live threat model. **Not
`/gsd:fast`.** A `/gsd:quick` or a small inserted phase.

---

## 2. A HIDDEN 600-SECOND CEILING THAT NO SETTING CAN REACH

`get_llm_client` (`backend/app/services/openai_service.py:1265`) constructs `OpenAI(**kwargs)` with
**no `timeout=`**, so the SDK default applies. Measured from the installed package (not from docs):

```
openai 2.28.0
DEFAULT_TIMEOUT     : Timeout(connect=5.0, read=600, write=600, pool=600)
DEFAULT_MAX_RETRIES : 2
```

The per-model `llm_call_timeout_seconds` (default **300 s**) is an `asyncio.timeout` wrapper, so at
defaults it fires first and the SDK ceiling is invisible.

⚠ **Raise a model's timeout above 600 and the SDK's read timeout becomes the binding limit** — and it
surfaces as an httpx `APITimeoutError` rather than the clean `asyncio.TimeoutError` the agent loop
classifies, so it will look like a different bug. **`max_retries=2` compounds it**: a slow local model
that times out can be attempted three times.

**Fix:** plumb `timeout=` (and probably `max_retries`) into `get_llm_client` from the resolved
per-model capability, so the SDK ceiling tracks the setting instead of silently capping it.

---

## 3. NO RANGE VALIDATION ON THE DB / UI WRITE PATH

Asymmetry, all three parts verified:

- **Env path clamps**: `_LLM_CALL_TIMEOUT_MIN_S=1`, `_LLM_CALL_TIMEOUT_MAX_S=3600` (`config.py:566-567`),
  with out-of-range values logged and ignored.
- **PATCH path does not**: `set_model_capability` validates the **column allowlist**
  (`_MODEL_CAP_COLUMNS`) and the **type** (int, explicitly rejecting bool) — and nothing else. No
  numeric bounds.
- **The table has ZERO `CHECK` constraints** (measured: `pg_constraint … contype='c'` → 0 rows).
- **Tier 1 of the resolver returns `int(db_timeout)` unclamped** (`config.py:675`).

So `0`, a negative, or a fat-fingered `6000` is accepted end-to-end from the UI. ~10 lines to fix,
and the natural home is beside the existing type guards.

---

## 4. `context_window_tokens` MUST MATCH THE **LOADED** CONTEXT, NOT THE ADVERTISED MAX

Measured live from LM Studio's REST API (`GET /api/v0/models`, distinct from the OpenAI-compat
`/v1/models`, which does NOT report this):

| Model | state | `loaded_context_length` | `max_context_length` |
|---|---|---|---|
| `glm-4.7-flash` | **loaded** | **16384** | **202752** |
| `nvidia_nvidia-nemotron-nano-9b-v2` | not-loaded | — | 1048576 |
| `openai/gpt-oss-20b` | not-loaded | — | 131072 |

⚠ **Registering 202752 for a model loaded at 16384 makes the app build a prompt LM Studio silently
truncates.** The failure presents as the model being stupid or forgetful — never as a config error.
This is the same family as the known JIT-load trap (a non-loaded id gets loaded as a SECOND copy at
LM Studio's small default while the panel still reports the large number).

**`/api/v0/models` is the honest source** and is worth remembering: it reports `state` and
`loaded_context_length`; the OpenAI-compatible `/v1/models` reports neither.

⚠ **Reloading a model at a different context length makes its registry row stale silently.** There is
no reconciliation anywhere. A "re-measure loaded context" action in the Model Registry tab would close
this properly.

---

## 5. WORKAROUND ALREADY APPLIED — three rows inserted BY HAND, 2026-08-17

The API refuses these, but the table does not. Written directly to the local dev DB so the operator
could edit timeouts today:

| model_id | provider | timeout | context | max_out | native_tools | enabled |
|---|---|---|---|---|---|---|
| `glm-4.7-flash` | `lmstudio` | 550 | **16384 (MEASURED)** | 4096 | false | true |
| `nvidia_nvidia-nemotron-nano-9b-v2` | `lmstudio` | 550 | ⚠ **16384 (ASSUMED)** | 4096 | false | true |
| `openai/gpt-oss-20b` | `lmstudio` | 550 | ⚠ **16384 (ASSUMED)** | 4096 | false | true |

All three verified resolving `capability_source=db_override` through
`get_model_capability_async` / `get_per_call_timeout_async` — not the `inferred` 300 s fallback.

⚠ **The two ASSUMED context values are the operator's estimate, taken because neither model was
loaded and the goal was timeout editing.** They are NOT measurements. **Re-measure both against
`/api/v0/models` once loaded** — and note they may not even be equal to each other.

Choices worth knowing: **550** is deliberately under the 600 s SDK ceiling from finding 2.
**`native_tools: false`** matches how the project treats local/OpenRouter providers (the prompted tool
path). **`enabled: true`** was set by hand — the API forces `enabled=false` on add (SC#3), which is
correct for the API and wrong for a manual unblock.

⚠ **These rows are LOCAL-DEV ONLY and do not exist in cloud.** They are also invisible to
`scripts/check-deploy-drift.sh`, which watches env vars and seed migrations, not settings rows. If
local-model support is ever wanted in a deployed environment, that is a separate decision.

**To reverse:** `DELETE FROM model_capabilities_overrides WHERE provider = 'lmstudio';`

---

## 6. A CORRECTED FACT — `ollama` and `lmstudio` are SEPARATE providers now

Older notes (including an assistant memory) record that *"the app's Ollama provider is wired to LM
Studio :1234."* **That is stale.** Since Phase 111 (D-111-7) they are distinct
(`backend/app/config.py:798-801`):

```python
ollama_base_url:   str = "http://localhost:11434"
lmstudio_base_url: str = "http://localhost:1234/v1"
```

**LM Studio models must be registered under `provider: "lmstudio"`.** Registering them under
`ollama` points them at `:11434`, which on this box is not running at all — the request would fail
with a connection error that looks nothing like a provider-mapping mistake.

---

## 2026-09-12 — NOT discharged by migration 180, and the distinction matters.

Mig 180 made local providers' **endpoint and key** settable from the Settings UI, which is the half
this seed's own `relates_to` points at (*"a case where the rule is followed for cloud models and
unreachable for local ones"*). **That specific complaint is now false.**

⛔ **The endpoint this seed is actually ABOUT is untouched.** `POST /admin/models` still validates
its provider argument against the 8-cloud SSRF **discovery** allowlist rather than the routing
roster, so a local model still cannot be registered, tuned or given a timeout through the UI, and a
`model_capabilities_overrides` row must still be inserted by hand with `enabled=true` set manually
(the API forces `false`). The hidden 600 s openai-SDK read timeout that no setting can reach is also
unchanged.

⚠ **Do not close this on the strength of 180.** The guard is CORRECT for discovery and WRONG for
add; that sentence is the whole seed and it is still true.


---

# ⭐ TRIGGER FIRED — 2026-09-13, by the operator, at the v4.1 close

**The friction is exactly what this seed predicted**, in the operator's own words: a local model has
to be added *by hand*, and its **timeout** and **context window** configured *by hand*, because the
registry door is shut to it. Nothing above is amended — it was right — and two further facts were
measured at the moment the trigger fired.

## ⚠ NEW FINDING A — the manual step is not one step, it is three, and one of them is invisible

Registering a local model by hand means inserting a `model_capabilities_overrides` row **and**
setting `enabled = true` yourself (the API forces `false`) **and** supplying
`context_window_tokens`, because an id absent from `MODEL_CAPABILITIES` resolves
`capability_source = inferred` and silently loses `emit_tier` *and* `native_tools`. ⛔ **A local
model left `inferred` runs with `native_tools=False`, which short-circuits above every tool gate** —
the failure recorded in `project_local_models_structured_mode_trap`. So the manual work is not
cosmetic tuning: **skip it and the model silently loses tool use.**

## ⚠ NEW FINDING B — `lmstudio` is missing from two more capability tables, and is safe only by luck

Measured in `backend/app/config.py` on 2026-09-13. `ollama` carries an explicit entry in both;
`lmstudio` carries none:

| Table | `ollama` | `lmstudio` | Fallback it lands on |
|---|---|---|---|
| `_INFERRED_DEFAULT_MAX_TOKENS` (line 515) | `8192` | ⛔ **absent** | `.get(provider, 8192)` → 8192 |
| `_SUB_AGENT_MODEL_DEFAULTS` (line 827) | `""` | ⛔ **absent** | `.get(provider, "")` → `""` |

**Both absences are currently HARMLESS — and that is the finding, not the reassurance.** The generic
fallback happens to equal what `ollama` declares explicitly, so the behaviour is correct *by
coincidence*. ⚠⚠ **This is the identical shape as the defect that DID fire**, recorded in this very
file's neighbour at `config.py:106-115`: `lmstudio` was absent from `PROVIDER_CONTEXT_DEFAULTS`, fell
through to the `100_000` unknown-provider fallback, and runs died with
`400: request (41206 tokens) exceeds the available context size (32768)`. **A provider missing from a
capability table is invisible until the day the fallback and the truth disagree** — and no gate can
see the difference, because a `.get(k, default)` never fails.

⛔ **Do not "fix" these two by adding entries alone.** Two rows would remove today's luck and leave
the class untouched: the real defect is that a provider can be absent from a capability table with
nothing saying so. The executable form is a test that enumerates `_PROVIDER_BASE_URLS` and asserts
every provider appears in every capability table, so the NEXT provider added cannot be silently
half-registered.

## Routing at the v4.1 close

**Not folded into v4.1** — it is a capability, not a defect in shipped v4.1 work, and folding a new
capability into a closing milestone is the G-7 failure mode this project has already paid for.
**Carried to the next milestone as a candidate requirement**, alongside `SEED-040`
(model-registry self-service) and `SEED-135`, which it is now the concrete, operator-reported
instance of.


---

## ⭐ ANSWERED IN PART — Phase 249 (MODEL-04), 2026-09-15. **Status is `partially-answered`, not `answered`.**

⛔ **The distinction is the point.** This seed carries **six findings**, and Phase 249 closed
**one** of them. Flipping it to `answered` would delete five live findings behind a word — which is
this project's own recorded failure mode (Phase 245 measured a seed whose status and whose
frontmatter disagreed, and the PROSE was what had rotted).

### ✅ Finding #1 — THE BLOCKER — is CLOSED

The diagnosis in this seed was exact, including both line numbers and both layers. What shipped:

- `backend/app/config.py` gains `ROUTING_PROVIDERS: frozenset[str] = frozenset(_PROVIDER_BASE_URLS)`
  — **derived**, so it cannot drift from the table it comes from.
- `POST /admin/models` validates against **that**, not `PROVIDER_ENDPOINTS`.
- `ModelRegistryTab.tsx`'s `ADD_PROVIDER_ROSTER` widens 8 → **11**, and is **pinned to the backend
  roster** by a `?raw` lockstep fence that reads `_PROVIDER_BASE_URLS` out of `config.py` at test
  time. ⛔ The seed named the third copy of the roster; a longer hand-typed array would have fixed
  today and guaranteed tomorrow's drift.
- ⛔ **`PROVIDER_ENDPOINTS` is BYTE-UNCHANGED**, and a fence fails if a self-hosted provider ever
  reaches it. The seed called the original *"a conflation and not a security decision"*, and the
  fix keeps the security decision intact while removing the conflation.

**Driven live 2026-09-15**, not merely tested: `POST /admin/models` with `provider: ollama` → **200
`enabled:false`**; the same for `lmstudio` and `custom`; an unknown provider still **422**. The
registry UI now renders 11 provider sections and the Add form offers 11 options.

### ⛔ Findings #2, #3 and #4 are UNTOUCHED and stay open

| # | Finding | Status |
|---|---|---|
| **2** | The **600-second SDK ceiling** `get_llm_client` never sets. Raise a model's timeout above 600 and httpx's read timeout binds instead, surfacing as `APITimeoutError` rather than the `asyncio.TimeoutError` the loop classifies — **and `max_retries=2` means a slow local model can be attempted three times.** | ⛔ **OPEN** |
| **3** | No range validation on the DB / UI write path for capability values. | ⛔ **OPEN** |
| **4** | `context_window_tokens` must match the **LOADED** context, not the advertised max — a guidance/affordance gap the Add form does not address. | ⛔ **OPEN** |

⚠ **Finding #2 is the one most likely to bite next**, and it bites exactly the users this phase just
unblocked: a local model is precisely the kind you would give a 900-second timeout. Phase 249 made
those models addable and did **nothing** about the ceiling their timeouts will hit.

### Second arm of `trigger_when`, partially answered

*"local models are permanently `capability_source=inferred`"* — a model added through the registry
now resolves **`db_override`** and counts as **verified** at pick time (Phase 249 / MODEL-05: the
verified set became the union of built-ins and operator-entered rows), and an unregistered model
now **says so in the composer** with the consequence spelled out. ⚠ A local model the operator has
**not** added is still inferred — which is correct, and now visible instead of silent.

**Re-open trigger for the remainder:** any work on `get_llm_client`, on per-model timeouts, or the
next time someone needs an LLM call to run longer than 600 seconds.

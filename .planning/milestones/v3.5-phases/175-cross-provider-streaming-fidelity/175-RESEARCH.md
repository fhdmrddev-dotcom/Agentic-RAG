# Phase 175: Cross-Provider Streaming Fidelity - Research

**Researched:** 2026-07-22
**Domain:** LLM provider-gateway adapters / streaming normalizer / model-capability registry (backend, Python + OpenAI SDK)
**Confidence:** HIGH

## Summary

This is a backend cleanup phase at the **gateway/adapter/sanitizer boundary only**. All four requirements are app-layer fixes to existing files — no migration, no new package, no new UI. The single most important research output is a **per-provider "reasoning-off" verdict table** (XPROV-04) built from each provider's OWN official docs, because the mechanism does NOT transfer 1:1 and even varies *within* a provider by model generation.

The headline finding: four of five reasoning providers converge on the **identical** OpenAI-SDK shape `extra_body={"thinking": {"type": "disabled"}}` (DeepSeek, Kimi k2.x, MiniMax **M3 only**, GLM-4.6+). Google is the outlier — it uses top-level `reasoning_effort="none"`, and **only Gemini 2.5** honors it (2.5-Pro and all Gemini-3.x *cannot* disable thinking at all). The app already writes the *enable* form of this exact `extra_body.thinking` shape for DeepSeek at `openai_service.py:1812-1817`, so the mechanism is proven in-codebase. Crucially, **every utility call (title/suggestion/sub-agent/task) runs through the OpenAI-compat `client.chat.completions.create`** — including Google via its compat base_url — so the reasoning-off param must be expressible through that interface. It is, for all safe providers.

For XPROV-01, the gpt-5.6 400 is a genuine OpenAI capability boundary (live-bisect-confirmed in BUG-260711-02, matching OpenAI's own docs). The sanctioned stopgap — flip reasoning-first models to STRUCTURED (XML tool-injection) routing so no `tools` param is sent → no 400, reasoning stays on — is a **one-line gate in an existing function** (`resolve_calling_mode`) plus a capability marker on the registry rows. The XML injection path (SEED-034) already exists and is the same path OpenRouter-xml and unknown models use. For XPROV-03, a shared **inferred-provider guard** at all 4 utility-model sites kills the misleading fallback banner AND the wasted 404; a sibling helper (`resolve_sub_agent_model_safely`) already lives at `sub_agent_models.py` and 2 of the 4 sites already partially guard — the fix unifies them.

**Primary recommendation:** Add ONE capability-keyed reasoning marker to `MODEL_CAPABILITIES` that encodes *how* to control reasoning per model (`reasoning_first` for OpenAI tool-routing; a `reasoning_off` mode for the title call), gate it at the two existing seams (`resolve_calling_mode`, the title request-build), harden the shipped DSML strip with a stream-end flush + honest-leak signal (reusing the existing `error` SSE event), and route all 4 utility sites through one inferred-provider guard. Every change is additive, provider/model-scoped, and leaves Deep Mode byte-identical.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (XPROV-01):** Capability-driven stopgap + honest error; full adapter deferred. Make gpt-5.6-class reasoning-first OpenAI models usable (no 400) via a **registry capability flag** (capability-keyed — e.g. `reasoning_first: True` — **NOT a hardcoded id list**; "by capability, not by name" per D-122-04). When set, use **`native_tools: False` semantics → reasoning stays ON, tools route via the existing XML system-prompt injection path** (SEED-034). Builds on Phase 149 D-149-16's operator-serviceable `native_tools` flip; 175 makes it capability-driven + default-correct.
- **D-01a:** The full `/v1/responses` adapter is **DEFERRED to SEED-114**. Do NOT plan it.
- **D-02 (XPROV-02):** Harden the no-leak floor + honest-incomplete signal; re-parse-to-execute deferred. (a) Verify/harden the shipped `_strip_deepseek_tool_markup` so it holds on long turns + partial-chunk boundaries — **guaranteed no dirty DSML render** (the SC#2 floor). (b) When a leak IS detected, surface an **honest signal** reusing the **existing honest-fail / run-event SSE vocabulary** — do NOT invent a new event type.
- **D-02a:** Re-parse-to-execute is **DEFERRED as a seed**. Do NOT plan it.
- **D-03 (XPROV-03):** Shared cross-provider utility-model guard at ALL 4 sites (`thread_title.py`, `suggestion_service.py`, `sub_agent_service.py`, `task_service.py`): *"never send a utility/sub-agent model to a provider it doesn't belong to"* — if the configured model's inferred provider ≠ active provider, fall through to `_SUB_AGENT_MODEL_DEFAULTS[provider]`. Additive, boundary-only, Deep byte-identical.
- **D-04 (Honesty UX):** Suppress-when-fine + honest real copy. No fallback banner when the primary utility model would succeed. When a genuine substitution happens, name it honestly. Replace the generic `bad_request` "model parameter error" copy (`errors.py:188`) with a clear, actionable hint for the gpt-5.6+tools 400. **NO picker-level capability tagging this phase** (overlaps Phase 178).
- **D-05 (XPROV-04):** Reasoning providers emit a real title via a reasoning-off title call — bounded, provider-docs-first. Apply reasoning-off **only** to providers whose OWN docs confirm it's safe. Providers where it isn't safe **keep today's honest `_derive_title_from_message` fallback** (no regression). Do **NOT** enlarge the title budget or make title-gen non-blocking. Keep the inline-await ordering byte-identical. The selector is deferred → SEED-126.
- **D-14 (RED LINE, load-bearing):** provider differences stay at the adapter/sanitizer boundary; the shared Deep/agent-loop/chunk/SSE path never forks; **Deep Mode byte-identical**.

### Claude's Discretion

- Exact registry marker name/shape (`reasoning_first` vs `tool_endpoint` vs other) — **must be capability-keyed, never an id list**.
- Exact wording of the honest hints/copy.
- The shape/signature/home-module of the shared utility-model guard helper (D-03).
- The exact per-provider reasoning-off mechanism for the title call (D-05) — resolved by provider-docs-first research; providers where it's unsafe keep the derived fallback.

### Deferred Ideas (OUT OF SCOPE — do not research or plan)

- Full OpenAI `/v1/responses` reasoning-first adapter → **SEED-114**.
- DeepSeek re-parse-to-execute (make the leaked tool actually run) → seed.
- BUG-260718-04 (chat model selection not remembered per thread) → Phase 178.
- OpenRouter-specific 400s (BUG-260714-02) → OUT (experimental external surface).
- Picker-level capability tagging → Phase 178.
- Per-provider title-generation-model selector in Settings → **SEED-126**.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **XPROV-01** | Reasoning-first OpenAI models (gpt-5.6 CLASS) send correct request params — no model-parameter 400 on chat or with tools | §XPROV-01 findings 1-3: capability marker `reasoning_first` + 1-line gate in `resolve_calling_mode` (openai_service.py:1660) routes to existing XML injection (SEED-034); errors.py:188 copy replacement |
| **XPROV-02** | DeepSeek tool-call markup never leaks into visible chat; strip guard holds on long turns + partial-chunk boundaries | §XPROV-02 findings 4-5: shipped `_strip_deepseek_tool_markup` audit (gaps: stream-end flush, single-opener coverage) + honest-incomplete signal reusing the `error` SSE event |
| **XPROV-03** | Title-gen cross-provider fallback is honest — no misleading banner naming a model the user didn't pick | §XPROV-03 finding 6: shared inferred-provider guard at 4 sites; `_infer_provider_for` (config.py:466) is the inference mechanism; suppress-when-fine is automatic once the 404 path is removed |
| **XPROV-04** *(FOLDED BUG-260722-01)* | Reasoning providers emit a REAL summary title, not the degenerate first-few-words fallback | §XPROV-04 findings 7-8: **per-provider reasoning-off verdict table** (provider-docs-first); reasoning-off param injected at `thread_title.py:154-159`, derived-fallback intact for UNSAFE providers |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reasoning-first tool routing (XPROV-01) | API / Backend — model registry + `resolve_calling_mode` | — | Request-shape decision belongs at the provider adapter; the registry is the single source of truth (D-122-04). Never a client concern. |
| DSML markup sanitization (XPROV-02a) | API / Backend — streaming normalizer (`openai_compat.py`) | — | Content sanitization must happen server-side before persistence + SSE emit; the browser must never receive raw markup. |
| Honest-incomplete signal (XPROV-02b) | API / Backend — agent-loop consumer (`error` SSE event) | Browser (renders existing error bubble) | Signal is authored server-side reusing existing vocabulary; the frontend already renders `error` events — no new UI. |
| Utility-model provider guard (XPROV-03) | API / Backend — utility services + shared helper | — | Model→provider matching is a server-side routing invariant; the banner (fallback_model event) simply stops being emitted. |
| Reasoning-off title call (XPROV-04) | API / Backend — `thread_title.py` request build | — | Per-provider request params are an adapter-boundary concern; the title call is a server-side sub-agent call. |

**Conclusion: this is a BACKEND-ONLY phase.** No frontend changes are required — the fallback banner disappears by *not being emitted*, and the honest-incomplete signal reuses the already-rendered `error` event. (The `sketch-findings` UI skill is correctly irrelevant here.)

## Standard Stack

No new libraries. Every fix uses infrastructure already in the repo.

### Core (already installed — verified in codebase)
| Component | Location | Purpose | Why standard |
|-----------|----------|---------|--------------|
| `openai` Python SDK | `client.chat.completions.create` everywhere | The single OpenAI-compat interface for ALL 9 providers (each via its own `base_url`) | The app's provider-uniform transport; `extra_body=` is the SDK's pass-through for provider-specific params |
| `MODEL_CAPABILITIES` registry | `backend/app/config.py:239` | Capability-keyed per-model flags (`native_tools`, `emit_tier`, `uses_max_completion_tokens`, …) | Established "by capability, not by name" single source of truth (D-122-04) |
| `resolve_calling_mode()` | `backend/app/services/openai_service.py:1660` | Decides NATIVE (tools param) vs STRUCTURED (XML injection) | The exact seam D-01's flag gates |
| `_strip_deepseek_tool_markup()` | `backend/app/services/provider_gateway/openai_compat.py:141` | Shipped DSML content sanitizer (commit 2f18f870) | The XPROV-02 floor to harden, not rebuild |
| `resolve_sub_agent_model_safely()` | `backend/app/services/sub_agent_models.py:54` | Shared cross-provider model-safety helper (list-membership) | The natural home + sibling for the D-03 guard |
| `_infer_provider_for()` | `backend/app/config.py:466` | Regex model-id → provider inference | The inference mechanism D-03's guard needs |
| `_emit(redis, run_id, 'error', message=…)` | `backend/app/api/threads.py:202` (used at `agent_loop.py:2291/2777`) | The existing honest-fail SSE run-event | The "existing vocabulary" D-02b must reuse — do NOT invent a new type |

**Installation:** none. `git diff` for this phase should show zero changes to `requirements.txt` / `Dockerfile.sandbox`.

## Package Legitimacy Audit

**No external packages are installed by this phase.** All work edits existing files and uses the already-vendored `openai` SDK's `extra_body=` pass-through. Package Legitimacy Gate: N/A (nothing to slopcheck).

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram — where each fix lands

```
                         ┌─────────────────────────────────────────────┐
  Deep chat request ───► │  create_adaptive_streaming_chat (openai_svc) │
                         │   ├─ resolve_calling_mode(model)  ◄── [XPROV-01: reasoning_first → STRUCTURED]
                         │   │      NATIVE → attach tools+tool_choice     │
                         │   │      STRUCTURED → NO tools param (XML)      │
                         │   └─ client.chat.completions.create(**kwargs)  │
                         └───────────────┬─────────────────────────────┘
                                         │ sync Stream
                         ┌───────────────▼─────────────────────────────┐
                         │  _ClosableEventStream._normalize (openai_compat)│  ◄── SHARED CHUNK PATH (D-14: byte-identical)
                         │   per delta.content:                          │
                         │     <think> state machine (moonshot/deepseek/…)│
                         │     if provider==deepseek:                     │
                         │       _strip_deepseek_tool_markup  ◄── [XPROV-02a: harden + set leak flag]
                         │   yields: delta / reasoning_delta /            │
                         │           tool_preparing / tool_args_progress /│
                         │           finish  ◄── [XPROV-02b: additive tool_markup_leaked flag, deepseek-only]
                         └───────────────┬─────────────────────────────┘
                                         │ canonical event dicts
                         ┌───────────────▼─────────────────────────────┐
                         │  shared _on_chunk consumer (agent_loop)       │  ◄── SHARED (D-14) — prefer post-drain hook
                         │   post-drain: if leak → _emit(...,'error',...) │  ◄── [XPROV-02b: reuse existing SSE event]
                         └─────────────────────────────────────────────┘

  New thread, first msg ─► maybe_autotitle_thread (thread_title.py:199, INLINE await before producer spawn)
                            └─ generate_thread_title (:99)
                                 ├─ [XPROV-03] provider-safe utility-model guard (drop cross-provider override)
                                 └─ client.chat.completions.create(:154)  ◄── [XPROV-04: inject reasoning-off param, safe providers only]

  Utility calls (suggestion / sub_agent / task) ─► SAME [XPROV-03] guard via shared helper
```

### Pattern 1: Capability-keyed request-shape control (the core pattern for XPROV-01 & XPROV-04)
**What:** Encode *how a model handles reasoning* as data in `MODEL_CAPABILITIES`, read it at the adapter seam, branch on it. Never branch on a model-id string in code.
**When to use:** Any per-model divergence in request params (D-122-04 precedent — `emit_tier`, `uses_max_completion_tokens`, `supports_parallel_tools` all follow this).
**Example (recommended shape, Claude's discretion on exact keys):**
```python
# config.py MODEL_CAPABILITIES rows (registry DATA, not a code id-list):
"gpt-5.6-sol":   {..., "reasoning_first": True},          # XPROV-01: route tools via XML
"deepseek-v4-flash": {..., "reasoning_off": "thinking_disabled"},   # XPROV-04
"kimi-k2.6":     {..., "reasoning_off": "thinking_disabled"},       # XPROV-04
"glm-5-turbo":   {..., "reasoning_off": "thinking_disabled"},       # XPROV-04
"MiniMax-M3":    {..., "reasoning_off": "thinking_disabled"},       # XPROV-04 (M3 only!)
"gemini-2.5-flash": {..., "reasoning_off": "effort_none"},          # XPROV-04 (2.5 only!)
# MiniMax-M2.x, gemini-3.x, kimi-k3: NO reasoning_off key → keep derived fallback (UNSAFE)
```
```python
# openai_service.py:1660 resolve_calling_mode — add near the top, after `cap` is resolved:
if cap.get("reasoning_first"):
    return CallingMode.STRUCTURED   # tools via XML, reasoning stays on, no tools param → no 400
```
```python
# thread_title.py:154 — additive kwarg on the existing title call (safe providers only):
_reasoning_off = get_model_capability(model).get("reasoning_off")
_extra = {}
if _reasoning_off == "thinking_disabled":
    _extra["extra_body"] = {"thinking": {"type": "disabled"}}
elif _reasoning_off == "effort_none":
    _extra["reasoning_effort"] = "none"
response = client.chat.completions.create(model=model, messages=title_messages,
                                          stream=False, **{token_param: _title_max_tokens}, **_extra)
```

### Pattern 2: Inferred-provider utility-model guard (XPROV-03)
**What:** Before sending a *configured* utility model to the active provider, check `_infer_provider_for(model) == active_provider`; if not, fall through to `_SUB_AGENT_MODEL_DEFAULTS[active_provider]`.
**When to use:** Any of the 4 utility-model resolution sites.
**Why it beats the existing list-membership check:** `resolve_sub_agent_model_safely` validates against `available_models` list membership, which is a no-op when that list is empty (fresh settings row) — the cross-provider model still leaks. The inferred-provider check fires regardless of `available_models` population, closing BUG-260623-01 at its root.

### Anti-Patterns to Avoid
- **Hardcoded model-id list in code** (`if model in ["gpt-5.6-sol", ...]`) — violates D-122-04; use registry data.
- **Enlarging the title-token budget** to force a real title — violates D-05; the tiny budget protects run-start latency. Reasoning-off makes the *small* budget yield a real title.
- **Forking the shared `_normalize` chunk path or the shared `_on_chunk` consumer per provider** — violates D-14. Keep all additions additive + default-inert.
- **Assuming a reasoning-off mechanism transfers across providers or across a provider's model generations** — it does not (see XPROV-04 table). MiniMax M2.x and Gemini 3.x silently ignore / reject disable.
- **Setting top-level `reasoning_effort` for OpenAI when tools are attached** — that is the exact 400 (BUG-260711-02). The D-01 fix REMOVES tools (STRUCTURED), it does NOT add `reasoning_effort`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Disable reasoning per provider | A custom prompt-injection "answer only, no thinking" hack | Each provider's official param (`extra_body.thinking` / `reasoning_effort`) — see XPROV-04 table | Prompt hacks are unreliable; the native param is doc-guaranteed for SAFE providers |
| Model → provider inference | New regex table | `_infer_provider_for()` (config.py:466) | Already the canonical inference; reuse keeps one source of truth |
| Cross-provider model safety | New resolver | Extend/sibling `resolve_sub_agent_model_safely` (sub_agent_models.py) | Established home; task_service already uses it |
| Honest-incomplete run signal | A new SSE event type | The existing `_emit(redis, run_id, 'error', message=…)` | D-02b mandate: reuse existing vocabulary; the frontend already renders it |
| DSML markup detection | A regex over full content post-hoc | The shipped streaming `_strip_deepseek_tool_markup` (harden it) | Already handles partial-chunk boundaries; post-hoc can't (strip already removed the evidence) |

**Key insight:** Every "hard part" of this phase already has a home in the codebase. The work is *wiring capability data + hardening one sanitizer + unifying one guard* — not building new subsystems.

## XPROV-01 — Reasoning-first OpenAI tools (D-01)

**Finding 1 — the OpenAI capability boundary (CONFIRMED, two independent sources).**
OpenAI's own error, reproduced by the app's live-API bisect (BUG-260711-02) with the operator's key:
> `400 — "Function tools with reasoning_effort are not supported for gpt-5.6-sol in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'."` (`param: reasoning_effort`)

Bisect: V0 minimal OK · V1 +stream OK · V3 **+tools+tool_choice=auto → 400** · V5 full app request → same 400. The ids are GA and correct; a bare `chat.completions.create(model="gpt-5.6-sol", ...)` returns `'pong'`. `[VERIFIED: live-API bisect in BUG-260711-02]`. The OpenAI community thread confirms the identical error text and that **`reasoning_effort="none"`** is the sanctioned escape value (no "minimal"/"low" alternative mentioned for this endpoint). `[CITED: community.openai.com/t/gpt-5-6-chat-completion-reasoning-effort-bug-behavior-change/1386454]`. The two sanctioned escapes are therefore: **(a) `/v1/responses`** (deferred → SEED-114/D-01a), or **(b) `reasoning_effort: 'none'`** (defeats reasoning — not chosen). D-01 chooses a THIRD path: **remove the tools param** (STRUCTURED routing) so neither `tools` nor `reasoning_effort` triggers the conflict, and reasoning stays on by default.

**Finding 2 — the D-01 seam + smallest capability shape.**
The XML system-prompt tool-injection path (SEED-034) EXISTS and is exercised today for OpenRouter-`xml` strategy, operator `native_tools=False`, and unknown/inferred models. `[VERIFIED: openai_service.py:1909-1912 (STRUCTURED "else: pass" — no tools param) + agent_loop.py:2123 (STRUCTURED → inject tool schemas)]`. The exact gate is in `resolve_calling_mode` (openai_service.py:1660): after `cap = get_model_capability(model_id)` is resolved (line 1662) and after the `db_native is False` short-circuit (1680), add:
```python
if cap.get("reasoning_first"):
    return CallingMode.STRUCTURED
```
When STRUCTURED, `create_adaptive_streaming_chat`'s `tool_choice=="auto"` branch hits `else: pass` (openai_service.py:1909) — **no `tools` param, no `reasoning_effort`** → no 400; reasoning is on by default. `[VERIFIED: openai_service.py:1865-1912]`.

**Smallest correct capability-marker shape (RECOMMENDED, Claude's discretion):** a dedicated boolean `reasoning_first: True` on the gpt-5.6 rows (config.py:265-267), NOT a bare `native_tools: False` flip. Rationale:
- `reasoning_first` is *self-documenting* and *forward-compatible* — it signals "this model wants /v1/responses for native tools" so the future SEED-114 adapter (and the deferred Phase-178 picker tag) can read the SAME marker.
- A bare `native_tools: False` flip works for routing but conflates "can't do native tools ever" with "can't do them *simultaneously with reasoning on chat.completions*" — losing the signal needed by D-04's error copy and the future adapter.
- It composes with the Phase-149 operator `native_tools` override. **Design question for the planner:** should an operator's explicit `db_native=True` override `reasoning_first`? Recommendation: **NO** — `reasoning_first` is a hard OpenAI API constraint, so the gate should sit ABOVE the `effective_native` resolution (i.e., `reasoning_first` wins). Flag this ordering in the plan.

**Known boundary (out of scope, note it):** `resolve_calling_mode` only governs the *auto* tool path. The `force_tool_name` (forced-emission) path in `create_adaptive_streaming_chat` (openai_service.py:1825) always attaches `tools` + a named `tool_choice` and does NOT consult `calling_mode` — so a *workflow/harness* forcing a tool on a reasoning-first model could still 400. Deep chat (the phase scope) uses `tool_choice="auto"` / `force_tool_name=None` → fixed. Workflows rarely run gpt-5.6 (they use `_SUB_AGENT_MODEL_DEFAULTS`). Forced-emission on reasoning-first models is SEED-114 territory. `[VERIFIED: openai_service.py:1819-1864]`.

**Finding 3 — the honest error copy (D-04).**
The generic `bad_request` copy lives at `errors.py:187-190`: *"Model parameter error — this model may not support the current configuration."* `[VERIFIED: errors.py:188]`. It is returned by `message_for_kind("bad_request")` for ANY 400 across all providers, so it CANNOT be blanket-rewritten to mention gpt-5.6. Two options:
- **(a) RECOMMENDED — dedicated detection + copy:** the 400 body carries the structured signature `"Function tools with reasoning_effort are not supported"` / `"use /v1/responses or set reasoning_effort to 'none'"`. Add a narrow branch in `classify_provider_error` (or a new `ErrorKind = "reasoning_tools_unsupported"`) that detects this signature and returns dedicated actionable copy (e.g. *"This reasoning-first model can't use tools on this endpoint yet. It's been switched to prompt-based tools automatically; if you still see this, pick a non-reasoning OpenAI model."*). Fixed copy, NO raw-detail interpolation (preserves the info-disclosure guard at `message_for_kind`). `[VERIFIED: errors.py:117-212]`.
- **(b) SMALLEST — generalize the generic copy** to be more actionable for all bad_requests. Less precise but zero detection logic.
Because the D-01 fix *prevents* this 400 for flagged models, the D-04 copy is defense-in-depth (fires only for a not-yet-flagged successor or an operator who force-flips `native_tools=True` on a `reasoning_first` model). Recommend (a) if the detection is a cheap substring check; else (b). Exact wording is Claude's discretion (D-04).

## XPROV-02 — DeepSeek DSML strip hardening + honest-incomplete (D-02)

**Finding 4 — audit of the shipped `_strip_deepseek_tool_markup` (openai_compat.py:141-174).**
The strip is deepseek-gated (called only when `active_provider_name == "deepseek"`, openai_compat.py:314) and runs AFTER the `<think>` state machine on the post-think `_visible` text. `[VERIFIED: openai_compat.py:285-321]`. Its logic:
- `leaking=True` → returns `("", "", True)` — drops everything once the opener is seen. **Holds.**
- opener found in `pending+text` → returns `(buf[:idx], "", True)` — prose before opener preserved, markup + all after suppressed. **Holds.**
- No full opener → holds back the longest tail that is a *prefix* of `_DSML_OPENER` (`buf[-k:]`) so a split-across-chunks opener is still caught. **Holds** (test `test_opener_split_across_chunks_is_caught`).

**Gaps identified (the hardening work):**
1. **Stream-end flush — REAL GAP (low severity, content-loss not leak).** `_dsml_pending` holds a trailing partial-opener fragment (e.g. a final chunk ending in `<` or `<｜`). `_normalize` never flushes `_dsml_pending` after the `for chunk in self._raw` loop ends (openai_compat.py:251-436), and the test harness `_feed` doesn't flush either. If a legitimate DeepSeek turn *ends* with text that is a prefix of the opener, that fragment is silently swallowed. This does NOT cause a dirty render (the D-02 floor holds), but a trailing `<` could be lost. **Harden:** on stream end, if `_dsml_pending` is non-empty AND `not _dsml_leaking`, emit it as a final `delta`. Add a unit test for stream-end flush.
2. **Single-opener coverage — POSSIBLE GAP (verify).** `_DSML_OPENER = "<｜｜DSML｜｜"` (U+FF5C fullwidth pipe) matches the ONE leaked format observed in thread 5a86a9fd. DeepSeek's tokenizer also has other tool-call delimiter special tokens (the `<｜tool▁calls▁begin｜>`-style family using U+2581). If deepseek-v4 can leak a *different* delimiter variant, the current strip would MISS it → dirty render. **This is unverified** — the bug only documents the `<｜｜DSML｜｜` variant. **Recommendation:** either (i) confirm via a live long-turn DeepSeek UAT that only the `<｜｜DSML｜｜` variant leaks, or (ii) broaden the strip to match a small family of DeepSeek tool-call opener tokens. Flag as an open question (see Open Questions). `[ASSUMED: alternate delimiter variants — not confirmed against DeepSeek docs or a live repro]`.
3. **`<think>`-strip + 5 KB tool_args interaction — HOLDS.** The strip operates on post-think `_visible` only; DSML inside a `<think>` block routes to reasoning and is never rendered. The 5 KB `tool_args_progress` boundary is on the *structured* `delta.tool_calls` path, disjoint from the visible-content DSML strip. No interaction bug found. `[VERIFIED: openai_compat.py:285-407]`.

**Finding 5 — the honest-incomplete signal (D-02b): reuse `error`, surface via a post-drain hook.**
The existing honest-fail vocabulary is `_emit(redis, run_id, 'error', message=<str>)` (threads.py:202), already used by the consumer for exactly this class of "graceful but incomplete" surfacing (e.g. `agent_loop.py:2291` emits `'error'` with `'finish_reason=length during tool streaming'`). `[VERIFIED: agent_loop.py:2291, 2777]`. There is **no** existing `tool_markup_leaked`/incomplete signal — one must be added, but it must map to the existing `error` event, not a new SSE type.

**The adapter→consumer signal path (D-14-sensitive — choose the lower-risk placement):**
- The leak is detected mid-stream inside `_normalize` (deepseek-gated). The per-stream `_dsml_leaking` flag is available at stream end.
- **Option A (minimal edit, touches shared per-chunk path):** add an additive `tool_markup_leaked: _dsml_leaking` field to the `finish` event dict (openai_compat.py:422), and a default-inert guard in the shared `_on_chunk` finish branch (agent_loop.py:1976) that emits the `error` event when the flag is truthy. The flag is only ever truthy on the deepseek leak path → byte-identical for every other case.
- **Option B (RECOMMENDED — keeps the hot per-chunk handler byte-identical):** expose the leak via a mutable attribute on the `_ClosableEventStream` instance (e.g. `stream.dsml_leaked`), set inside `_normalize` when leaking begins, and read it in the consumer's **post-drain** block (alongside the existing `parse_structured_tool_calls` / `calling_mode` post-processing at agent_loop.py:2159) to emit the `error` event. This avoids editing the per-chunk `_on_chunk` at all — strictly safer under D-14.

Recommend **Option B**. Honest copy (Claude's discretion): *"The model tried to call a tool but wrote it as text, so it didn't run. Please retry."* — surfaced once per leaked turn.

## XPROV-03 — Cross-provider utility-model guard (D-03)

**Finding 6 — the 4-site blind pattern + the smallest shared helper.**
Confirmed the four sites and their current guard state `[VERIFIED: codebase read]`:

| Site | Function | Current guard | Gap |
|------|----------|---------------|-----|
| `thread_title.py:126-137` | `generate_thread_title` (multi-model branch) | **NONE** — uses `sub_agent_model` override directly → 404 → `fallback_model` emit → banner | The root of BUG-260623-01 |
| `suggestion_service.py:74-87` | `generate_suggestions` | **NONE** — same blind override → 404 → fallback | Same pattern |
| `sub_agent_service.py:62-89` | `run_sub_agent` | List-membership check vs `user_settings.llm_models` (comma-split string) — but **byte-frozen per D-085-16** | Fires only when `llm_models` populated; misses empty-list case |
| `task_service.py:49-103` | `_resolve_sub_agent_effective_model` → `resolve_sub_agent_model_safely` | List-membership vs `available_models` (list) | Fires only when `available_models` populated; misses empty-list case |

**How a model's provider is inferred today:** `_infer_provider_for(model_id)` (config.py:466) — an ordered regex table (`^gpt-` → openai, `^claude-` → anthropic, `^gemini-` → google, `^deepseek-`, `^kimi-`/`^moonshot-`, `^minimax-`, `^glm-`, `^word/word` → openrouter, else ollama). `[VERIFIED: config.py:412-424]`. `get_model_capability(model_id)["provider"]` wraps it.

**Recommended shared guard (Claude's discretion on signature/home):** a new function in `sub_agent_models.py` (the established home) — e.g.:
```python
def provider_safe_utility_model(user_settings, override_candidate: str | None) -> str | None:
    """Return override_candidate only if it belongs to the active provider; else None
    (caller falls through to _SUB_AGENT_MODEL_DEFAULTS[provider])."""
    active = (user_settings.active_provider if user_settings else "") or ""
    if not override_candidate:
        return None
    inferred = _infer_provider_for(override_candidate)
    # flexible providers route by id — never block them
    if inferred == active or active in ("openrouter", "ollama"):
        return override_candidate
    return None   # cross-provider mismatch → drop the override
```
Apply at the point each site chooses whether to use the `sub_agent_model` override:
- `thread_title.py` + `suggestion_service.py`: replace the raw `override = ...sub_agent_model or settings.sub_agent_model` acceptance with `override = provider_safe_utility_model(user_settings, ...sub_agent_model or settings.sub_agent_model)`.
- `task_service.py`: already routes through `resolve_sub_agent_model_safely`; either add the inferred-provider check *inside* that helper (benefits task + any future caller) OR call the new guard first. **Recommendation:** fold the inferred-provider check INTO `resolve_sub_agent_model_safely` as an additional gate (before the list-membership gate) so all callers gain it and the empty-`available_models` blind spot closes everywhere. This is the single most leveraged edit.
- `sub_agent_service.py`: byte-frozen (D-085-16). The plan should either (i) get an explicit override to touch it, or (ii) note its inline guard already covers the populated-list case and its default sub-agent model is provider-correct in practice. Flag the D-085-16 tension for the planner — D-03 names all 4 sites, but one is frozen.

**Suppress-when-fine (D-04) is automatic.** Once the guard drops a cross-provider override *before* the call, no 404 is raised, no fallback retry runs, and no `fallback_model` event is emitted → the `fallbackNotices` map stays empty → **no banner**. `[VERIFIED: useMessages.ts:100 (useFallbackNoticeForThread) + thread_title.py:256-257 (emit only when _title_fallback truthy)]`. The `fallback_model` event still fires for GENUINE substitutions (e.g. a disabled model) — the honest case D-04 wants to keep. The local-dev workaround (`app_settings.sub_agent_model` cleared) becomes redundant but harmless; the code guard makes behavior correct *regardless* of that setting (the CONTEXT specific-idea).

## XPROV-04 — Reasoning-provider title quality (D-05) — the per-provider verdict table

**Finding 7 — provider-docs-first reasoning-off verdict (the core deliverable).**
Every utility call runs through `client.chat.completions.create` — the OpenAI-compat interface — including Google via its compat `base_url`. `[VERIFIED: thread_title.py:154 + openai_service.py:1251-1289 get_llm_client]`. So the reasoning-off param must be expressible through the OpenAI SDK (top-level or `extra_body`). Verified per provider from each vendor's OWN docs:

| Provider | Disable-thinking mechanism (OpenAI-compat) | Model-generation caveat | App default title model | **Verdict** |
|----------|--------------------------------------------|-------------------------|-------------------------|-------------|
| **DeepSeek** | `extra_body={"thinking": {"type": "disabled"}}` | v4-flash / v4-pro support it | `deepseek-v4-flash` (single-model → uses chat_model) | **SAFE** `[CITED: api-docs.deepseek.com/guides/thinking_mode]` |
| **Moonshot / Kimi** | `extra_body={"thinking": {"type": "disabled"}}` | k2.5 & k2.6 support it; **k3 and k2.7-code CANNOT** ("thinking always on; passing 'disabled' errors") | `kimi-k2.6` | **SAFE (k2.6)** — version-gated `[CITED: platform.kimi.ai/docs/guide/use-kimi-k2-thinking-model]` |
| **MiniMax** | `extra_body={"thinking": {"type": "disabled"}}` | **M3 only.** M2.x ACCEPTS `{type:disabled}` but **thinking stays ON** (silently ignored) | `MiniMax-M2.7-highspeed` (**M2.x!**) | **UNSAFE at current default** — keep derived fallback `[CITED: platform.minimax.io + github.com/MiniMax-AI/MiniMax-M2 issue #121]` |
| **Zhipu / GLM** | `extra_body={"thinking": {"type": "disabled"}}` | GLM-4.6/4.7/5/5.1/5.2 support it (thinking on by default) | `glm-5-turbo` | **SAFE** `[CITED: docs.z.ai/guides/capabilities/thinking-mode]` |
| **Google / Gemini** | top-level `reasoning_effort="none"` **OR** `extra_body={"google":{"thinking_config":{...}}}` | **Gemini 2.5 only.** 2.5-Pro + all Gemini-3.x **cannot** disable thinking (3.x uses `thinking_level` low/high — no "none"; rejects `reasoning_effort` outside its levels) | `gemini-3.5-flash` (**3.x-class!**) | **UNSAFE at current default** — keep derived fallback `[CITED: ai.google.dev/gemini-api/docs/openai]` |
| OpenAI | `reasoning_effort="none"` | GA reasoning models | `gpt-5.4-mini` (non-reasoning; already produces real titles) | **N/A** — non-reasoning; no change |
| Anthropic | — (non-reasoning title tier) | — | `claude-haiku-4-5` (already real titles) | **N/A** — no change |

**The striking convergence:** DeepSeek, Kimi (k2.x), MiniMax (M3), and GLM all use the **identical** `extra_body={"thinking": {"type": "disabled"}}`. The app ALREADY writes the *enable* form of this shape for DeepSeek (`openai_service.py:1812-1817` sets `extra_body["thinking"]={"type":"enabled","reasoning_effort":"high"}`) — so the mechanism is proven in-codebase. `[VERIFIED: openai_service.py:1812-1817]`. Google is the sole divergent case AND the sole "can't disable on current-gen" case alongside MiniMax M2.x.

**The version-gating is the whole point of provider-docs-first.** MiniMax M2.x and Gemini 3.x *accept-but-ignore* or *reject* the disable — so a naive provider-level "apply thinking-disabled to all reasoning providers" would silently REGRESS (M2.x/3.x would still burn the budget → derived fallback, no better than today, and worse if it 400s). This mandates the **capability-keyed `reasoning_off` marker per MODEL** (Pattern 1), not a per-provider assumption. Only models whose docs confirm safety get the key; the rest keep `_derive_title_from_message` (no regression — the CONTEXT no-regression bar).

**Finding 8 — the D-05 constraint mechanics (budget + ordering byte-identical).**
The tiny budget (`_title_max_tokens = 160 if provider=="google" else 30`, thread_title.py:145) and the inline-await ordering (`maybe_autotitle_thread` awaited before the producer `create_task`, thread_title.py:247) MUST stay byte-identical. `[VERIFIED: thread_title.py:145, 247]`. The reasoning-off fix injects an ADDITIVE kwarg into the EXISTING title call (thread_title.py:154-159) — it changes NEITHER the budget NOR the ordering. With thinking OFF, a 4-6 word title (~10-15 tokens) fits comfortably in the 30-token budget, so the *same fast call* now yields a real title instead of empty-after-hidden-thinking. `[reasoning: title tokens ≪ 30-token budget once reasoning is off — confirmed by the closed BUG-260527-01 which got real titles from gemini-2.5-flash at 160 budget]`.

**Derived-fallback intact (no regression to the closed fix).** The reasoning-off param is injected only for SAFE-marked models. For UNSAFE providers (MiniMax M2.x, Gemini 3.x, Kimi k3) and for empty/refusal/`<think>`-only responses on ANY provider, `_clean_llm_title` → `_derive_title_from_message` still fires exactly as today (thread_title.py:82-96). `[VERIFIED: thread_title.py:82-96, 162]`. This preserves the closed `title-generation-broken-deepseek-moonshot-google.md` fix (which introduced the derived fallback replacing bare "New Chat"). **Wave-0 test must assert: an empty response on a SAFE provider still derives, and an UNSAFE-provider model sends NO reasoning-off param.**

**Drift note on the research question:** CONTEXT/research-Q7 says "confirm the field is honored on the title call path in `google_service`." In fact the title call for Google goes through the **OpenAI-compat client** (`get_llm_client` → `client.chat.completions.create`), NOT the native `google_service` (genai SDK). So the Google reasoning-off param must work on Google's OpenAI-compat endpoint (`reasoning_effort` top-level), which — per the docs — only helps Gemini 2.5, reinforcing the UNSAFE verdict for the 3.x-class default. `[VERIFIED: thread_title.py uses get_llm_client, not google_service]`.

## Cross-cutting (D-14 / SC#10) — Finding 9

Every proposed change is additive, boundary-scoped, and default-inert:
| Change | File | Additive? | Deep byte-identical? |
|--------|------|-----------|----------------------|
| `reasoning_first` gate | openai_service.py:1660 `resolve_calling_mode` | Yes (new `if`, returns early only when key present) | Yes — no `reasoning_first` key on any existing non-5.6 row |
| DSML stream-end flush + leak flag | openai_compat.py `_normalize` (deepseek-gated) | Yes | Yes — deepseek-only branch; other providers never enter it |
| Honest-incomplete emit | agent_loop post-drain (Option B) | Yes (post-drain hook) | Yes — fires only when `stream.dsml_leaked` (deepseek leak only) |
| Utility-model guard | sub_agent_models.py + 3 call sites | Yes | Yes — no-op for single-model providers + same-provider overrides |
| Reasoning-off title param | thread_title.py:154 | Yes (extra kwarg, safe models only) | Yes — no key → no param → identical call |
| Error copy | errors.py | Yes | Yes — copy/classification only |

**Explicitly OUT (would violate D-14 — flag if a plan proposes them):**
- Editing the shared `_ClosableEventStream._normalize` per-chunk emit logic for non-deepseek providers.
- Editing the shared `_on_chunk` consumer's per-chunk branches (prefer the post-drain hook, Option B).
- Any change to the Anthropic / Google NATIVE SDK adapters (they don't leak DSML and don't hit the gpt-5.6 path).
- Enlarging the title budget or making title-gen non-blocking (run-lifecycle change).

## Code Examples

### Reading a capability marker at the adapter seam (the established pattern)
```python
# openai_service.py — resolve_calling_mode already reads cap via get_model_capability.
# Source: backend/app/services/openai_service.py:1662
cap = get_model_capability(model_id)
if cap.get("reasoning_first"):          # ADD — XPROV-01
    return CallingMode.STRUCTURED
```

### The existing enable-thinking extra_body (proof the disable form works in-repo)
```python
# Source: backend/app/services/openai_service.py:1812-1817  (DeepSeek, ENABLE form)
if (provider == "deepseek" or effective_model.startswith("deepseek-")) and force_tool_name is None:
    kwargs.setdefault("extra_body", {})
    kwargs["extra_body"]["thinking"] = {"type": "enabled", "reasoning_effort": "high"}
# XPROV-04 title call uses the DISABLE form: {"type": "disabled"}
```

### The shipped DSML strip (harden, don't rebuild)
```python
# Source: backend/app/services/provider_gateway/openai_compat.py:141-174
# Gap: _dsml_pending is never flushed at stream end. Harden in _normalize after the
# `for chunk in self._raw` loop:
if _dsml_pending and not _dsml_leaking:
    yield {"type": "delta", "content": _dsml_pending}   # ADD — XPROV-02a flush
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gpt-5.x reasoning models tolerated tools + reasoning on chat.completions | OpenAI hard-400s tools+reasoning on chat.completions; routes reasoning-first tool use to `/v1/responses` | gpt-5.6 line (2026) | The exact XPROV-01 bug; the app must not send tools+reasoning to chat.completions for these models |
| `reasoning_effort` only (OpenAI) | Every reasoning provider added a per-call disable switch; 4 of 5 converged on `extra_body.thinking.type` | 2026 provider releases | XPROV-04 is now feasible via a doc-guaranteed param on SAFE models |
| Global `sub_agent_model` applied to any active provider | Must be provider-scoped (inferred-provider or list-membership guard) | Recognized across BUG-260527-01 → 260528-01 → 260623-01 | XPROV-03 unifies the guard |

**Deprecated/outdated:**
- DeepSeek `deepseek-chat` / `deepseek-reasoner` model ids are being deprecated (2026/07/24) in favor of `deepseek-v4-flash`/`-pro` with `thinking.type` toggle. The app already uses `deepseek-v4-*`, so this is aligned. `[CITED: api-docs.deepseek.com]`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DeepSeek can leak tool-call markup variants OTHER than `<｜｜DSML｜｜` (e.g. `<｜tool▁calls▁begin｜>` token family) | XPROV-02 Finding 4 gap 2 | If true, the single-opener strip misses them → dirty render persists. Mitigate via live long-turn DeepSeek UAT or broaden the opener match. **Not confirmed against DeepSeek docs.** |
| A2 | The app's representative model names (gpt-5.6, kimi-k2.6, MiniMax-M2.7, glm-5-turbo, gemini-3.5-flash) map to the real provider generations whose docs were researched | XPROV-04 table | If a name maps to a different generation than assumed, its SAFE/UNSAFE verdict flips. The capability-keyed marker de-risks this: verdict is per-model-row, editable without code change. Confirm each row's real reasoning-off support at UAT. |
| A3 | Google's active-provider `llm_base_url` is its OpenAI-compat endpoint (so `reasoning_effort` is accepted on the title call) | XPROV-04 Finding 7 | If Google title-gen used the native SDK, the param shape differs. Verified indirectly (title-gen uses `get_llm_client`→OpenAI SDK for all providers), but confirm the Google compat base_url resolves at runtime. |
| A4 | Reasoning-off with the 30-token budget reliably yields a full 4-6 word title on SAFE providers | XPROV-04 Finding 8 | Low risk (titles are ~10-15 tokens; closed BUG-260527-01 got real titles at 160). Confirm per SAFE provider at UAT. |

**These A1-A4 need confirmation at UAT before their claims become locked.** A2 in particular is why the capability marker (not a code id-list) is mandatory — the verdict is data the operator can correct per row.

## Open Questions (RESOLVED)

1. **(DEFERRED -> live UAT, Plan 175-02) Does deepseek-v4 leak DSML delimiter variants beyond `<｜｜DSML｜｜`?**
   - What we know: the shipped strip covers exactly one opener; the bug documents only that variant.
   - What's unclear: whether other DeepSeek tool-call special tokens can leak into visible content.
   - Recommendation: run the long-turn (~26+ tool call) DeepSeek UAT and inspect the raw content channel; if only `<｜｜DSML｜｜` appears, keep the single opener + add the stream-end flush; else broaden the match. Do NOT over-engineer without a repro (D-02a re-parse is deferred). **STATUS: DEFERRED to live UAT** — the single-opener strip + stream-end flush ship in Plan 175-02; alternate-delimiter breadth is decided only if the long-turn DeepSeek UAT surfaces another variant.

2. **(RESOLVED, Plan 175-03) Does an operator's `native_tools=True` override outrank `reasoning_first`?**
   - What we know: both are read in `resolve_calling_mode`.
   - Recommendation: `reasoning_first` should WIN (hard API constraint). Place the gate above the `effective_native` resolution. **STATUS: RESOLVED** — locked in Plan 175-03: the `reasoning_first` gate sits ABOVE the `effective_native` resolution, so it outranks an operator `native_tools=True` override.

3. **(RESOLVED, Plan 175-01 Task 2) `sub_agent_service.py` is byte-frozen (D-085-16) but D-03 names it as one of the 4 sites.**
   - Recommendation: fold the inferred-provider check into `resolve_sub_agent_model_safely` (which `task_service` uses) so the leverage covers the shared helper; get an explicit operator nod before editing the frozen `sub_agent_service.py`, or document that its inline list-membership guard + provider-correct default already cover it in practice. **STATUS: RESOLVED** — Plan 175-01 Task 2 folds the inferred-provider gate into `resolve_sub_agent_model_safely` (covering thread_title / suggestion / task_service = 3/4 sites); the byte-frozen `sub_agent_service.py` is NOT edited and retains its populated-list-only inline guard (documented as 3/4-not-4/4 coverage, no operator edit sought).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `openai` Python SDK (`extra_body=`) | All fixes | ✓ (vendored) | openai 2.x (per errors.py comment) | — |
| Live OpenAI key with gpt-5.6-class access | XPROV-01 live UAT | Operator-provided at UAT | — | Unit test the routing (STRUCTURED) without a live call |
| Live DeepSeek key | XPROV-02 long-turn leak UAT | Operator-provided at UAT | — | Unit test the strip + flush (pure function) |
| Live keys: Google, DeepSeek, Moonshot, MiniMax, Zhipu | XPROV-04 per-provider title UAT | Operator-provided at UAT | — | Unit test the param-injection matrix (mock client) |

**Missing dependencies with no fallback:** none — all fixes are unit-testable in isolation; live keys are needed only to *prove* the cross-provider behavior at UAT (SC#10).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (+ pytest-asyncio) |
| Config file | `backend/` pytest layout; tests under `backend/tests/unit/` |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/unit/test_openai_compat_dsml_strip.py tests/unit/test_threads_title_gen.py -x -q` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest tests/unit -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XPROV-01 | `reasoning_first` cap → `resolve_calling_mode` returns STRUCTURED (no tools param) | unit | `pytest tests/unit/test_reasoning_first_routing.py -x` | ❌ Wave 0 |
| XPROV-01 | gpt-5.6 Deep chat sends no `tools`/`reasoning_effort` → no 400 | live-UAT | operator: gpt-5.6-sol + tool prompt → run completes | manual (SC#10 cross-provider axis) |
| XPROV-01 | errors.py reasoning-tools-unsupported copy for the specific 400 | unit | `pytest tests/unit/test_errors.py -x` (extend) | ⚠️ extend `provider_gateway/test_errors.py` |
| XPROV-02a | strip holds across chunk boundaries + **stream-end flush** | unit | `pytest tests/unit/test_openai_compat_dsml_strip.py -x` (add flush + long-input tests) | ⚠️ extend |
| XPROV-02b | detected leak → single `error` SSE event (existing vocabulary) | unit/behavior | `pytest tests/unit/test_dsml_leak_signal.py -x` | ❌ Wave 0 |
| XPROV-02 | 26+ tool-call DeepSeek turn → no dirty render + honest signal | live-UAT | operator: long DeepSeek tool-chain | manual (SC#10 long-message axis) |
| XPROV-03 | cross-provider override dropped → no `fallback_model` emit | unit | `pytest tests/unit/test_utility_model_guard.py -x` | ❌ Wave 0 |
| XPROV-03 | same-provider override + flexible-provider passthrough preserved | unit | same file | ❌ Wave 0 |
| XPROV-04 | SAFE model → reasoning-off param injected; UNSAFE → NOT injected | unit | `pytest tests/unit/test_title_reasoning_off.py -x` (mock client, assert kwargs) | ❌ Wave 0 |
| XPROV-04 | empty/refusal on SAFE provider still derives (no regression) | unit | same file | ⚠️ extend `test_threads_title_gen.py` |
| XPROV-04 | budget (30/160) + inline-await ordering unchanged | unit | assert `_title_max_tokens` + call order byte-identical | ⚠️ extend |
| XPROV-04 | real 4-6 word title per SAFE provider (DeepSeek/Kimi-k2.6/GLM) | live-UAT | operator: first message per provider | manual (SC#10 cross-provider axis) |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_openai_compat_dsml_strip.py tests/unit/test_threads_title_gen.py tests/unit/test_errors.py -x -q` (+ the new files as they land)
- **Per wave merge:** `pytest tests/unit -q`
- **Phase gate:** full unit suite green + the SC#10 live-UAT matrix (below) before `/gsd:verify-work`.

### SC#10 4-Axis Coverage (VALIDATION.md must exercise all four)
| Axis | Representative | Which fix it proves | Automated? |
|------|---------------|---------------------|-----------|
| **Cross-provider** | OpenAI **gpt-5.6-class** (XPROV-01) + one SAFE reasoning provider (DeepSeek/Kimi-k2.6/GLM) title (XPROV-04) + Anthropic (unchanged control) + Google (XPROV-04 UNSAFE control — must still derive, no regression) | XPROV-01, XPROV-04 | routing/param unit-covered; live per provider = manual |
| **Multi-tool** | gpt-5.6 with `search_documents` + `execute_code` in one prompt | XPROV-01 (STRUCTURED XML tool path drives multiple tools) | live-UAT |
| **Parallel-thread** | Thread A streaming (DeepSeek long turn) while Thread B accepts a new prompt (title-gen fires) | XPROV-02 + XPROV-03/04 isolation | live-UAT |
| **Long-message** | DeepSeek ~26+ tool-call turn (the natural DSML-leak trigger) | XPROV-02 (no dirty render + honest signal) | live-UAT (leak is timing-dependent) |

**Proof-of-correctness per fix:** XPROV-01 routing + XPROV-03 guard + XPROV-04 param-injection are **unit-testable** (mock client, assert request kwargs / calling_mode / no fallback emit). The DSML long-turn leak (XPROV-02) and gpt-5.6-with-tools (XPROV-01) need **live cross-provider UAT** — the leak is a timing/length-dependent DeepSeek phenomenon that a wire-format mock cannot reproduce, and the 400 is a real OpenAI endpoint constraint.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_reasoning_first_routing.py` — XPROV-01 `resolve_calling_mode` STRUCTURED gate + `native_tools` override ordering
- [ ] `backend/tests/unit/test_utility_model_guard.py` — XPROV-03 inferred-provider guard (drop cross-provider, keep same-provider, flexible passthrough, empty-available_models case)
- [ ] `backend/tests/unit/test_title_reasoning_off.py` — XPROV-04 param-injection matrix (SAFE injects, UNSAFE omits) + budget/ordering invariance + empty-response derive
- [ ] `backend/tests/unit/test_dsml_leak_signal.py` — XPROV-02b leak → single `error` event
- [ ] Extend `test_openai_compat_dsml_strip.py` — stream-end flush + (if A1 confirmed) alternate-opener coverage
- [ ] Extend `provider_gateway/test_errors.py` — XPROV-01 reasoning-tools-unsupported classification/copy

## Security Domain

Per the v3.5 ROADMAP, **no threat model is planned for this cleanup phase** (`security_enforcement`/threat-model deliberately NONE for the milestone — UI/bug-fix cleanup, not new authz). The two security-adjacent surfaces are noted for completeness only:

| ASVS Category | Applies | Standard Control (already in place) |
|---------------|---------|-------------------------------------|
| V5 Input Validation / Output Encoding | yes (light) | The DSML strip IS an output-sanitization control (untrusted model output → never rendered raw). Hardening it (stream-end flush) strengthens an existing control; no new trust boundary. |
| V6 Cryptography | no | — |
| V2/V3/V4 (auth/session/access) | no | Utility-model resolution runs under the caller's existing RLS context (`maybe_autotitle_thread` is request-scoped per Phase-163 D-03); the guard changes *which model id* is sent, never the auth context. |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Untrusted model output rendered as UI content (DSML markup) | Tampering / (info-integrity) | The shipped `_strip_deepseek_tool_markup` sanitizer (hardened this phase) |
| Error copy leaking internal detail | Information Disclosure | `message_for_kind` specific-kind copy already forbids raw-detail interpolation (errors.py:202-212); the new reasoning-tools copy must follow the same fixed-string rule |

No new secrets, no new endpoints, no schema change, no new external input surface. If a discuss/plan step surfaces a real trust boundary, flag it — none identified in this research.

## Line-Reference Drift Report (verify-at-plan)

CONTEXT.md line refs checked against live source (2026-07-22):
- `openai_compat.py` `_strip_deepseek_tool_markup` — CONTEXT says ~137-172; **actual 135-174**. ✓ accurate.
- `thread_title.py` — `_SINGLE_MODEL_PROVIDERS`:47 ✓; helpers 50-96 ✓; fallback emit 174/257 ✓; budget 145 ✓; title call 154-159 ✓; inline-await 247 ✓. All accurate.
- `openai_service.py` — native tool path 1706-1914 ✓; `client.chat.completions.create` at 1914 ✓. **DRIFT:** CONTEXT says "`reasoning_effort` handling at :1802-1816" — actually 1800-1817 is the DeepSeek **thinking `extra_body`** block (which sets `reasoning_effort:"high"` *inside* `thinking`). **There is NO top-level `reasoning_effort` handling anywhere** — confirming the bug's claim the app never sets it. Note for the plan.
- `config.py` `_SUB_AGENT_MODEL_DEFAULTS` — CONTEXT says :693; **actual :729** (drift; :693 is now inside `get_model_capability_async`). Report.
- `errors.py:188` bad_request copy — ✓ accurate (187-190).
- `_infer_provider_for` (D-03 inference) — config.py:466 ✓ (patterns 412-424).

## Sources

### Primary (HIGH confidence)
- Codebase (grep/read, 2026-07-22): `openai_compat.py`, `thread_title.py`, `openai_service.py`, `config.py`, `errors.py`, `sub_agent_models.py`, `suggestion_service.py`, `sub_agent_service.py`, `task_service.py`, `agent_loop.py`, `test_openai_compat_dsml_strip.py`, `test_threads_title_gen.py` — all seams + line refs verified.
- BUG-260711-02 (live-API bisect with operator's OpenAI key) — XPROV-01 400 confirmed empirically.
- `api-docs.deepseek.com/guides/thinking_mode` — DeepSeek `extra_body.thinking.type:disabled`.
- `docs.z.ai/guides/capabilities/thinking-mode` — GLM `extra_body.thinking.type:disabled` (4.6/4.7/5/5.1/5.2).
- `platform.kimi.ai/docs/guide/use-kimi-k2-thinking-model` — Kimi k2.5/k2.6 disable; k3/k2.7-code cannot.
- `platform.minimax.io/docs/api-reference/text-openai-api` + `github.com/MiniMax-AI/MiniMax-M2` issue #121 — MiniMax M3 disable; M2.x ignores.
- `ai.google.dev/gemini-api/docs/openai` — Gemini `reasoning_effort="none"` (2.5 only); 3.x cannot disable.

### Secondary (MEDIUM confidence)
- `community.openai.com/t/gpt-5-6-chat-completion-reasoning-effort-bug-behavior-change/1386454` — corroborates the exact gpt-5.6 error + `reasoning_effort="none"` escape.
- `github.com/crmne/ruby_llm` issue #785, RubyLLM docs — corroborate tools+reasoning → Responses API.

### Tertiary (LOW confidence — flagged as assumptions)
- Alternate DeepSeek delimiter-token variants (A1) — inferred from tokenizer knowledge, NOT confirmed against DeepSeek docs or a live repro.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every seam verified in-repo.
- XPROV-01 (routing + seam): HIGH — 400 live-confirmed; STRUCTURED/XML path verified; 1-line gate.
- XPROV-02 (strip audit): HIGH on the shipped logic + stream-end gap; MEDIUM on alternate-opener coverage (A1, needs live repro).
- XPROV-03 (guard): HIGH — 4 sites + inference mechanism verified; helper home identified.
- XPROV-04 (per-provider table): HIGH per provider docs; MEDIUM on representative-name→generation mapping (A2 — de-risked by the capability marker).
- Architecture / D-14 compliance: HIGH — all changes additive + default-inert.

**Research date:** 2026-07-22
**Valid until:** ~2026-08-21 for provider reasoning-off params (fast-moving — re-verify each provider's docs at plan time if >2 weeks); codebase seams valid until the files change.

## RESEARCH COMPLETE

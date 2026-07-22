# Phase 175: Cross-Provider Streaming Fidelity - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Newer reasoning models and non-OpenAI providers stream cleanly — **at the gateway/adapter/sanitizer boundary only**:

1. **XPROV-01** — reasoning-first OpenAI models (gpt-5.6 "class", not a pinned id) send correct request params → **no model-parameter 400** on chat or with tools.
2. **XPROV-02** — DeepSeek tool-call markup **never leaks into visible chat content**; the strip guard holds on long turns.
3. **XPROV-03** — title-generation cross-provider fallback is **honest** — no misleading banner naming a model the user didn't pick.
4. **XPROV-04** *(folded addition — BUG-260722-01, operator flag 2026-07-22)* — reasoning providers (DeepSeek/Kimi/MiniMax/GLM/Gemini) emit a **real summary title**, not the degenerate first-few-words-of-prompt fallback.

**Red line (D-14, load-bearing):** provider differences stay at the adapter/sanitizer boundary; the shared Deep/agent-loop/chunk/SSE path never forks; **Deep Mode byte-identical**. This is a **cleanup milestone** — app-layer fixes, **no migration, no large net-new build**.

**SC#10 mandate:** all three fixes proven across native providers × multi-tool × parallel-thread × long-message. Natural axis coverage: gpt-5.6 = cross-provider axis; the DeepSeek leak reproduces on **long tool-chain turns** (~26+ tool calls) = the long-message axis.

**G-5 audit (done at discuss):** the three boundary files — `openai_compat.py`, `openai_service.py`, `thread_title.py` — are **NOT on the CLAUDE.md hot-file ledger**, and `thread_title.py` was freshly extracted in Phase 162.5. **G-5 does not force a refactor-first phase here.** The roadmap "G-5" flag is a "keep provider handling at the boundary" reminder, satisfied by D-14.

</domain>

<decisions>
## Implementation Decisions

### XPROV-01 — reasoning-first OpenAI tool support
- **D-01:** **Capability-driven stopgap + honest error; full adapter deferred.** Make gpt-5.6-class reasoning-first OpenAI models usable (no 400) via a **registry capability flag** (capability-keyed — e.g. `reasoning_first: True` / a `tool_endpoint` marker — **NOT a hardcoded id list**; "by capability, not by name" per D-122-04). When the flag is set, use **`native_tools: False` semantics → reasoning stays ON, tools route via the existing XML system-prompt injection path.** This preserves the model's flagship value (reasoning) and accepts the known tradeoff that the prompt-injected tool path is *less reliable* than native tool_use. Builds on the Phase 149 D-149-16 operator-serviceable native_tools flip — 175 makes it **capability-driven + default-correct** for the reasoning-first line so there's no 400 out of the box (today the hand-added gpt-5.6 rows are `native_tools: True` → 100% unusable with tools).
- **D-01a:** The full **`/v1/responses` adapter** (keeps BOTH native tools AND reasoning) is **DEFERRED to SEED-114** / a dedicated future OpenAI-adapter phase — genuine net-new work (new request shape + streaming schema + tool-call surfacing), out of scope for this cleanup milestone.

### XPROV-02 — DeepSeek tool-markup leak
- **D-02:** **Harden the no-leak floor + honest-incomplete signal; re-parse-to-execute deferred.** (a) Verify/harden the already-shipped `_strip_deepseek_tool_markup` (openai_compat.py) so it holds on long turns + partial-chunk boundaries — **guaranteed no dirty DSML render** (the SC#2 floor). (b) When a DSML tool-markup leak IS detected, surface an **honest signal** ("the model emitted a tool call as text — it didn't run; retry") reusing the **existing honest-fail / run-event SSE vocabulary** — instead of ending silently-incomplete.
- **D-02a:** **Re-parse-to-execute** (buffer the DSML block → synthesize a structured `tool_call` → inject into the finish event so the tool actually RUNS) is **DEFERRED as a seed** — net-new buffering/parsing on a hot shared-path gateway; wants dedicated tests (partial chunks, malformed markup, `<think>`-strip + 5 KB tool_args interaction).

### XPROV-03 — title-gen cross-provider fallback
- **D-03:** **Shared cross-provider utility-model guard at ALL 4 sites.** One shared helper — *"never send a utility/sub-agent model to a provider it doesn't belong to"* (if the configured model's inferred provider ≠ active provider, fall through to `_SUB_AGENT_MODEL_DEFAULTS[provider]`) — applied at **title-gen (`thread_title.py`), suggestion (`suggestion_service.py`), sub-agent (`sub_agent_service.py`), task (`task_service.py`)**. Root-cause fix: kills the misleading fallback banner AND the wasted 404 round-trip **everywhere**, not just title-gen. Additive, boundary-only, Deep byte-identical.

### XPROV-04 — reasoning-provider title quality (FOLDED — BUG-260722-01)
- **D-05:** **Reasoning providers emit a real title via a reasoning-off title call — bounded, provider-docs-first.** Today the degenerate "first-few-words-of-prompt" title is `_derive_title_from_message` firing *by design*: reasoning providers get a deliberately tiny title-token budget (30; Google 160) — because title-gen is **awaited INLINE before the agent producer spawns** (`maybe_autotitle_thread`, thread_title.py:247) so a slow title call must not delay run-start — and the reasoning model burns that budget on hidden `<think>` → empty content → derived fallback. **Fix:** tell the reasoning model *"don't reason, just title"* on the title call (per-provider `reasoning_effort:'none'` or the provider's equivalent), so the small fast budget yields a real 4-6 word title. **A sibling of D-01 at the same adapter boundary** (per-provider reasoning-param control).
  - **Scoped / no-regression:** apply reasoning-off **only** to providers whose OWN docs confirm it's safe (provider-docs-first — do NOT assume it transfers 1:1; DeepSeek/moonshot/minimax/zhipu/google each verified independently). Providers where it isn't safe **keep today's honest `_derive_title_from_message` fallback** — no regression.
  - **Do NOT** solve this by enlarging the title budget (would delay run-start — the exact thing the tiny budget protects) or by making title-gen non-blocking (that's a run-lifecycle change, out of scope). Keep the inline-await ordering byte-identical.
  - The per-provider title-model **selector** (operator control) is **deferred → SEED-126** (net-new Settings surface).

### Honesty UX (cross-cutting, XPROV-01 + XPROV-03)
- **D-04:** **Suppress-when-fine + honest real copy.** No fallback banner when the primary utility model would succeed (the D-03 guard removes the 404 path, so there's nothing to announce). When a **genuine** substitution actually happens, name it honestly. For the gpt-5.6+tools case (D-01), replace the generic **"model parameter error"** (`provider_gateway/errors.py:188`) with a clear, actionable hint. Honesty surfaces stay at the adapter/sanitizer boundary — **NO picker-level capability tagging this phase** (bigger UI lift, overlaps Phase 178).

### Claude's Discretion
- Exact registry marker name/shape (`reasoning_first` vs `tool_endpoint` vs other) — planner/researcher's call, **must be capability-keyed, never an id list**.
- Exact wording of the honest hints/copy.
- The shape/signature/home-module of the shared utility-model guard helper (D-03).
- The exact per-provider reasoning-off mechanism for the title call (D-05) — `reasoning_effort:'none'` vs each provider's equivalent — resolved by provider-docs-first research; providers where it's unsafe keep the derived fallback.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.** The four folded bug reports are unusually thorough (live-API bisect, code+DB-confirmed root causes, exact line refs) — **treat them as primary research inputs**, not just tickets.

### Folded reported-bugs (root causes + line refs already pinned)
- `.planning/reported-bugs/BUG-260714-01-gpt56-model-parameter-error.md` — the user-visible symptom (default OpenAI model dead out of the box) → XPROV-01.
- `.planning/reported-bugs/BUG-260711-02-gpt56-reasoning-tools-chat-completions-400.md` — **live-API bisect**: the exact OpenAI 400 (`Function tools with reasoning_effort are not supported … in /v1/chat/completions`) + the three stopgap paths A/B/C → XPROV-01.
- `.planning/reported-bugs/BUG-260708-01-deepseek-tool-call-markup-leak-reparse.md` — the DSML leak + the already-shipped strip (commit `2f18f870`) + the deferred re-parse half → XPROV-02.
- `.planning/reported-bugs/BUG-260623-01-title-gen-cross-provider-fallback-banner.md` — code+DB-confirmed root cause + the 4-site blind pattern + the exact fix → XPROV-03.
- `.planning/reported-bugs/BUG-260722-01-reasoning-provider-title-quality-degenerate-fallback.md` — the degenerate reasoning-provider title (code-confirmed by-design fallback + the budget/inline-await tradeoff) → **XPROV-04** (folded).
- `.planning/reported-bugs/title-generation-broken-deepseek-moonshot-google.md` *(closed)* — the prior "stuck on New Chat" fix that INTRODUCED the derived-title fallback; read for XPROV-04 history so the fix doesn't regress it.

### Seeds / requirements / roadmap
- `.planning/seeds/SEED-114-openai-responses-api-reasoning-first-tool-adapter.md` — the **deferred** full `/v1/responses` adapter; suggested capability-flag shape (registry-driven, D-14 constraints). D-01a defers to this.
- `.planning/seeds/SEED-034-system-prompt-cross-provider-tool-use.md` — system-prompt cross-provider tool-use (the XML tool-injection path D-01 relies on; also CLAUDE.md's provider-docs-first anchor).
- `.planning/seeds/SEED-126-per-provider-title-generation-model-selector-settings.md` — the **deferred** per-provider title-model + fallback selector (D-05's operator-control layer).
- `.planning/REQUIREMENTS.md` (XPROV-01/02/03 + source-reports note, lines 27-31).
- `.planning/ROADMAP.md` (v3.5 → Phase 175 details) — goal, 4 success criteria, flags.

### Provider-docs-first (CLAUDE.md MANDATORY rule)
- Research each provider's **own** official docs first, then cross-check against live app behavior: OpenAI Responses-vs-chat.completions reasoning/tool rules (XPROV-01), DeepSeek DSML/text-mode-tool-call behavior (XPROV-02). Conventions do NOT transfer 1:1 between providers.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`_strip_deepseek_tool_markup` + `_DSML_OPENER`** (`backend/app/services/provider_gateway/openai_compat.py:137-172`) — the **shipped** strip with partial-tail buffering (`max_tail` logic). The XPROV-02 floor to harden, not rebuild.
- **`_SINGLE_MODEL_PROVIDERS` + `generate_thread_title` override + `fallback_model` emit** (`backend/app/services/thread_title.py:47, 116-135, 174, 257`) — the XPROV-03 title-gen seam (moved here from `threads.py` in the 162.5 extraction).
- **`_SUB_AGENT_MODEL_DEFAULTS`** (`backend/app/config.py:693`) — the per-provider default fall-through target for the D-03 guard.
- **Title-quality seam (XPROV-04 / D-05):** `_clean_llm_title` + `_derive_title_from_message` + `_strip_think_blocks` (`thread_title.py:50-96`), the per-provider title budget (`:145` — `160 if google else 30`) + the title call (`:154-159`), and the **inline-await-before-producer** ordering (`maybe_autotitle_thread:247`). The reasoning-off title call lands in `generate_thread_title`'s request build (`:146-159`); the derived-fallback path must remain intact for providers where reasoning-off isn't safe.
- **openai_service request builder** (`backend/app/services/openai_service.py:1706-1914`) — native tool path always attaches `tools` + `tool_choice="auto"`; `reasoning_effort` handling at `:1802-1816`; `client.chat.completions.create` at `:1914` (only endpoint that exists — no `/v1/responses`). The XPROV-01 seam.
- **`MODEL_CAPABILITIES` / `native_tools` flag** (`backend/app/config.py`) — where the D-01 capability marker lands.
- **Existing honest-fail / empty-response run-event SSE vocabulary** — reuse for the XPROV-02 honest-incomplete signal (do NOT invent a new event type).
- **`provider_gateway/errors.py:188`** — the generic `bad_request` "model parameter error" copy to replace for the gpt-5.6 case (D-04).

### Established Patterns
- **D-14 red line:** provider handling at the gateway/adapter/sanitizer boundary; shared chunk/SSE path (`_on_chunk_openai`) + every non-OpenAI provider stay byte-identical.
- **"By capability, not by name"** — registry-driven markers, never hardcoded id lists (D-122-04 precedent; SEED-114 #1).
- **Phase 149 D-149-16** already shipped the operator-serviceable `native_tools` flip — 175 makes it capability-driven + default-correct (not a new mechanism, a correct default).

### Integration Points
- `openai_service.py` request builder (XPROV-01 param/endpoint decision).
- `openai_compat.py` normalizer (XPROV-02 strip + honest-incomplete emit).
- `thread_title.py` + `suggestion_service.py` + `sub_agent_service.py` + `task_service.py` (XPROV-03 shared guard — all 4).
- `config.py` `MODEL_CAPABILITIES` (D-01 flag) + `_SUB_AGENT_MODEL_DEFAULTS` (D-03 fall-through).
- `provider_gateway/errors.py:188` (D-04 honest copy).

</code_context>

<specifics>
## Specific Ideas

- **The gpt-5.6 400 is a genuine OpenAI API capability boundary** (live-bisect-confirmed, BUG-260711-02): *"Function tools with reasoning_effort are not supported for gpt-5.6-sol in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'."* (`param: reasoning_effort`). It is **not** an id/config typo — the ids are GA and correct.
- **gpt-5.6 = a CLASS** (OpenAI's reasoning-first line), not a pinned id — the fix must generalize to successors (registry capability flag, never an id list).
- **XPROV-02 strip already shipped** (commit `2f18f870`); DeepSeek degrades to text-mode tool calls (native `<｜｜DSML｜｜…>` markup as content) after many tool calls in one turn (~26+) — a long-turn phenomenon, which is also the SC#10 long-message axis.
- **XPROV-03 local-dev workaround is already applied** (`app_settings.sub_agent_model` cleared) — the **code guard must make the behavior correct regardless of that setting**, so a stale/cross-provider global can't re-trigger the 404+banner.
- **XPROV-04 is a by-design tradeoff, not a plain bug:** the tiny title budget exists to protect run-start latency (title-gen is awaited inline before the producer spawns). The reasoning-off fix must keep that latency budget AND the inline-await ordering — it makes the *existing* fast call produce a real title, not enlarge/relocate it. The closed `title-generation-broken-deepseek-moonshot-google.md` fix introduced the derived fallback; XPROV-04 must not regress it (empty/refusal still falls back honestly).

</specifics>

<deferred>
## Deferred Ideas

- **Full OpenAI `/v1/responses` reasoning-first adapter** (keeps BOTH native tools + reasoning) → **SEED-114**. Re-open trigger: a dedicated OpenAI-adapter phase, or the operator asks to upgrade the D-01 stopgap to the real path.
- **DeepSeek re-parse-to-execute** (make the leaked tool actually run, not just not-leak) → seed. Re-open trigger: the D-02 honest-incomplete signal proves insufficient, or long DeepSeek tool-chain skills become common.
- **BUG-260718-04** (chat model selection not remembered per thread) — reviewed at this discuss-phase; **NOT folded** — it's a chat/model-selection UI concern outside the adapter/sanitizer boundary → Phase 178 (chat polish) or its own quick task.
- **OpenRouter-specific 400s** (`BUG-260714-02`, surface: OpenRouter) — stay **OUT** (experimental; external surface; fix only if native-safe + trivial).
- **Picker-level capability tagging** ("reasoning-first — limited tools" tag in the model picker) → Phase 178 chat-polish surface if wanted (bigger UI lift; overlaps that phase).
- **Per-provider title-generation-model + fallback SELECTOR in Settings** → **SEED-126** (operator-control layer on top of the XPROV-04 quality fix; net-new Settings surface; aligns with the "everything dynamic → Settings" direction). Re-open: a future Settings/config-consolidation phase (SEED-117) or if XPROV-04's reasoning-off fix proves insufficient for some provider.

### Reviewed Todos (not folded)
- **SPIKE — NL→workflow authoring** (`spike-nl-workflow-authoring.md`, score 0.4) — spurious keyword match (matched only on the word "run"); unrelated to cross-provider streaming. Reviewed, not folded.

</deferred>

---

*Phase: 175-Cross-Provider Streaming Fidelity*
*Context gathered: 2026-07-22*

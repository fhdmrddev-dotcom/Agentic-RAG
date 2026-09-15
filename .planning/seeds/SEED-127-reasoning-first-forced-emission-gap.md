---
id: SEED-127
status: dormant
planted: 2026-07-22
planted_during: v3.5 (UX Consolidation & Chat Polish — Phase 175 code review WR-03)
trigger_when: gpt-5.6 (or any `reasoning_first: True` model) goes GA AND becomes reachable on a FORCED/STRUCTURED-emission path (title-gen, suggestions, workflow field-map/generation, or any `force_tool_name` caller) — i.e. the moment a reasoning-first model is used as anything other than a plain chat model
scope: Small
---

# SEED-127: reasoning-first STRUCTURED routing doesn't cover the forced-emission path

## Why This Matters

Phase 175 (XPROV-01 / D-01) made reasoning-first OpenAI models (gpt-5.6-class) usable by routing them **STRUCTURED** in `resolve_calling_mode` (`openai_service.py:1662`) — so the `tools` / `reasoning_effort` params that trigger the hard 400 ("Function tools with reasoning_effort are not supported…") are never sent, and reasoning stays on.

But that gate **only guards the AUTO path**. The **forced-emission branch** (`openai_service.py:1839`, `if force_tool_name is not None:`) unconditionally sets `kwargs["tools"]` + a named `tool_choice` regardless of calling mode. So if a `reasoning_first` model is ever driven through a `force_tool_name` caller, it will hit the exact 400 the STRUCTURED gate was built to avoid. The registry data is even self-contradictory here: the gpt-5.6 rows carry BOTH `reasoning_first: True` AND `emit_tier: "force_strict"` / `forced_emission: True`.

## Why It's Deferred (not fixed in Phase 175)

- **Not currently reachable.** The forced-emission callers (title-gen, suggestions, workflow field-map/generation) resolve to cheap **sub-agent utility models** (`_SUB_AGENT_MODEL_DEFAULTS` — e.g. `gpt-5.4-mini` for OpenAI), never the user's premium reasoning-first chat model. gpt-5.6 is also **pre-GA**, so no real endpoint exercises this yet.
- **A proper fix is design work, not a cleanup patch.** You cannot force a *native* tool call on a structured-only reasoning model. Making forced emission work there means **structured forced emission** — inject the named tool via XML + strict prompting and parse it back — which is a real feature. Bolting a risky change onto the shared `force_tool_name` branch would violate the v3.5 byte-identical red line (D-14) for no present benefit.

## When to Surface

Re-open the moment a `reasoning_first` model becomes reachable on a forced/structured-emission path — practically, when **gpt-5.6 goes GA** and either (a) it can be selected as the active model on a single-model surface that forces emission, or (b) a new caller forces emission on the user's active chat model.

## Options When Re-opened

1. **Data fix (smallest):** if reasoning-first models genuinely can't do native forced emission, don't mark them `forced_emission`/`force_strict` in the registry — but confirm what their structured-output path then does (they're STRUCTURED in auto mode anyway).
2. **Structured forced emission (proper):** in the force branch, when `get_model_capability(model).get("reasoning_first")`, route the forced call through XML tool injection + strict prompt + structured parse instead of the native `tools`/`tool_choice` params.
3. **Fail loud (interim):** detect `reasoning_first` in the force branch and raise the honest `reasoning_tools_unsupported` hint (Phase 175 D-04) rather than letting the raw 400 surface.

## Breadcrumbs

- `backend/app/services/openai_service.py:1662` — `resolve_calling_mode` (the AUTO-path `reasoning_first` STRUCTURED gate, Phase 175 D-01)
- `backend/app/services/openai_service.py:1839` — the `force_tool_name` branch that always sends `tools` (the gap)
- `backend/app/config.py:253` — `MODEL_CAPABILITIES` gpt-5.6 rows (the `reasoning_first` + `forced_emission` co-marking)
- Phase 175 review: `.planning/phases/175-cross-provider-streaming-fidelity/175-REVIEW.md` (WR-03)
- Related: [[SEED-040]] (capabilities belong in the Registry, not code)

---

## ⚠ TOUCHED BUT NOT CLOSED BY PHASE 250 (2026-09-15)

Phase 250 shipped `HONEST-02`: the agent loop's empty-output fallback now names **which of four
things happened** instead of emitting one sentence for every cause, and says *"the reason was not
captured"* when it cannot tell.

⛔ **THAT MAKES THE FAILURE LEGIBLE. IT DOES NOT MAKE THE MODEL SUCCEED.** This seed's
capability — getting a weak or reasoning-first model to actually drive the tool loop (forced
emission, per-model budgets, early force-answer, dedup guards) — is **untouched**. `status` stays
as it was.

Recorded here explicitly so a later reader cannot mistake an honest error message for a fixed
loop, and so this seed is not closed by citing `BUG-260722-02`'s requirement being met.

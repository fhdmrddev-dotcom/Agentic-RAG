# Phase 122: Cross-Provider Trust & Honesty Parity - Research

**Researched:** 2026-06-23
**Domain:** Cross-provider forced structured emission + provider-feature-fit declaration + operator-run eval scoreboard + cross-provider task-label parity (backend/gateway)
**Confidence:** HIGH (live code grounded; provider docs cross-checked; quantified registry impact)

## Summary

Phase 122 has four requirements that all live at the **gateway/adapter boundary** and share one through-line: *honesty is measured, never silently mutated*. Three of them (MP-01/MP-02/MP-03) cluster on the `forced_emit` substrate + `MODEL_CAPABILITIES` registry + the operator-run eval; the fourth (TDP-01) is a one-line system-prompt nudge plus verification of an already-shipped frontend label floor. **None of this is new machinery** — every piece (tiered forcing, narration recovery, truncation guard, honest-fail floor, the `capability_source` doc-verified flag, the `inferLabel()` deterministic floor, the localhost-gated eval + `.planning/eval/` artifact ritual) already exists. The work is to **chain** the existing forcing modes into an ordered ladder, **replace** a two-bool guess + a hardcoded `provider=="openai"` gate with one doc-verified `emit_tier` enum, **add** a 4-axis forced-emit scoreboard to the existing eval driver, and **add** a prompt nudge + a UAT assertion.

The MP-01 defect is evidence-pinned, not speculative: `forced_emit` today has a **two-rung** structure (TIER-FORCE | TIER-COERCE) with an honest-fail floor. When a TIER-FORCE shot 400s on a schema-specific failure (the optional-heavy + `additionalProperties` confidence object trips the OpenAI-schema family OpenAI/DeepSeek/Z.ai), the `provider_error` honest-fail short-circuits the function and degrades straight to `None` **without ever trying the non-strict / coerce path the same provider would accept** (BUG-260615-01 §"Phase 111 live UAT extension"). The default-config `gpt-4o` metadata extraction silently emits nothing as a result. MP-01 inserts the proven-missing rung(s) so the typed emit recovers instead of going dark.

**Primary recommendation:** Implement the MP-01 ladder as a small in-`forced_emit` orchestration loop over an ordered list of rung specs (strict-force → non-strict-force → coerce → honest-fail), each rung being an already-known-good mode the function already builds; resolve the top rung from a new explicit `emit_tier` literal field on `ModelCapability` (`force_strict | force | coerce`), default `coerce`; drop the inert DeepSeek `strict_json_schema` (DeepSeek's strict needs the `/beta` base_url we never set → demote to `force`); keep OpenAI as the only `force_strict`; extend `eval_cross_provider.py` with a `--forced-emit` matrix that drives the real `forced_emit` per provider on an EASY and a HARD schema and writes a dated `forced-emit-scoreboard-<date>.{json,md}` with PASS/FAIL/DOCUMENTED cells; add one ungated `execute_code.description` sentence to `SYSTEM_PROMPT` and assert via SC#10 UAT that no provider shows a bare tool name.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Force→coerce retry ladder (MP-01) | API/Backend — `forced_emit` substrate | Gateway adapters | The defect is in the shared emit substrate every consumer calls; the fix belongs there (D-122-01). The ladder re-drives the gateway, not a shared-path fork. |
| `emit_tier` declaration (MP-02) | API/Backend — `config.py` registry | Gateway adapters (consume the resolved tier) | The registry is the single source of truth all forcing reads; removing the `provider=="openai"` gate is a backend forcing-translation change at `openai_service.py`. |
| Per-provider scoreboard (MP-03) | Operator tooling — `scripts/eval_cross_provider.py` | DB (durable truth) + `.planning/eval/` artifacts | Localhost-gated operator script; measurement only, never a runtime path (D-122-06). |
| `execute_code.description` nudge (TDP-01) | API/Backend — shared `SYSTEM_PROMPT` | Frontend label floor (`workspacePanel.ts`) | One ungated sentence in the shared prompt helps every provider; the deterministic floor backstops it client-side (no provider branch). |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**MP-01 — Force→coerce recovery ladder**
- **D-122-01:** The ladder lives in **`forced_emit` itself**, so EVERY consumer recovers — workflow `llm_emit`/`render_template`, the Phase-102 publish-gauntlet judge, Phase-103 NL workflow-authoring, AND Phase-111 document metadata extraction. Folds BUG-260615-01's real-world impact (default-config extraction unbroken as a side effect).
- **D-122-02:** **4-rung ladder, in order:** (1) forced with strict `json_schema` *if the model's tier declares it*, (2) **forced NON-strict** (the proven-missing rung — OpenAI/DeepSeek/Z.ai `400` on strict TIER-FORCE but accept the same schema non-strict per BUG-260615-01 / Phase-111 repro), (3) **TIER-COERCE** (`tool_choice="auto"` + directive + narration recovery — the existing path), (4) **honest fail** (the existing `_surface_failure_message` floor; never a silent empty or fabricated artifact). Each rung is an already-known-good mode, just chained.
- **D-122-03:** The ladder is **pure runtime recovery** — it **never mutates the registry**. A model's `emit_tier` changes ONLY through the MP-03 scoreboard gate. The ladder MAY **log which rung won** (telemetry that feeds the scoreboard) but never acts on it. Runtime auto-demotion was **rejected**.

**MP-02 — Explicit, doc-verified `emit_tier`**
- **D-122-04:** Add a **single explicit `emit_tier` enum per model** in `MODEL_CAPABILITIES` — `force_strict | force | coerce` — naming the **ladder's top rung**, single source of truth, paired with the existing `capability_source` (`registry` = doc-verified vs `inferred`). It **replaces** the implicit `forced_emission` + `strict_json_schema` two-bool combo **and** the hardcoded `provider == "openai"` strict gate (`openai_service.py:1555`). (Planner: confirm enum-vs-derived-view + migration cost against the live `config.py` shape; the *intent* — one explicit declared value, no provider-name special-casing — is locked.)
- **D-122-05:** An **un-doc-verified model defaults to `coerce`** (safe floor); promoted to `force` / `force_strict` ONLY when the scoreboard proves it. Matches today's default-SAFE behavior.
- **Locked from the requirement (no re-ask):** **drop** the inert DeepSeek function-level `strict` (set at `openai_service.py:1548`, never honored); **keep** GLM/Zhipu forcing (intentional, live-verified). Scout note: GLM resolves to non-strict **`force`** — verify live.

**MP-03 — Per-provider scoreboard + tier-change gate**
- **D-122-06:** **Extend the existing operator-run `scripts/eval_cross_provider.py`** to emit a **dated `.planning/eval/` scoreboard artifact** (`.json` + `.md`) with the 4 axes × the locked roster. The **tier-change gate is the existing OPERATOR ritual**: grep the latest scoreboard before flipping any `emit_tier`, attach to VALIDATION.md. Rejected: LangSmith experiments + an automated pytest gate (needs live cross-provider calls in CI).
- **D-122-07:** **"pass-OR-documented" semantics** — each provider × axis cell is **PASS / FAIL / DOCUMENTED**, where **DOCUMENTED = an explicit known-limitation row in the scoreboard artifact itself** (note + evidence link). DOCUMENTED clears the gate because the model's declared `emit_tier` already reflects that reality. The scoreboard IS the record.
- **Locked from the requirement / D-03 (no re-ask):** the **4 axes** are trigger / force / recovery / honest-fail; the roster is **native-7** (OpenAI, Anthropic, Google, DeepSeek, Moonshot, Zhipu, MiniMax) **gates**, **OpenRouter is best-effort and never gates**; one representative model per provider (SC#10 convention).

**TDP-01 — Concrete cross-provider task labels**
- **D-122-08:** **Targeted scope.** The real gap is a **single ungated system-prompt nudge** to fill `execute_code.description` (the schema field + cross-provider `tool_args_progress` + the deterministic `inferLabel()` floor ALREADY exist). So: add the ungated nudge (shared system prompt — helps every provider, can only improve well-behaved ones), **keep/verify** the existing `inferLabel` floor for code steps, and **prove via SC#10 UAT that NO provider shows a bare tool name**. **Extend** the deterministic floor to other tools (`search_documents`, `render_template`, …) ONLY if UAT surfaces a bare name. Rejected for now: building a comprehensive per-tool summarizer up front.

### Claude's Discretion
- Exact ladder implementation mechanics inside `forced_emit` (single function vs small rung-helpers); how the "which rung won" telemetry is emitted/stored for the scoreboard — constrained by D-122-01..03.
- `emit_tier` as a literal enum field vs a validated derived view + the migration shape — D-122-04 locks the intent, not the mechanism.
- Exact scoreboard artifact schema/columns and how axes are scored — extend the established `.planning/eval/` capability-table format.
- The exact wording/placement of the `execute_code.description` nudge in the shared system prompt.

### Deferred Ideas (OUT OF SCOPE)
- **"Setting up agent…" dispatch-latency banner + live `description` before `tool_start`** (BUG-260607-02) → TDP-02 / **STRETCH Phase 128**. TDP-01 only fixes labels *once a tool is running*, not the pre-tool dispatch window. Left OPEN; must not regress.
- **MiniMax malformed tool-args 400 + OpenRouter `require_parameters`** (BUG-260607-03) → MP-04 / **STRETCH Phase 129**.
- **Comprehensive per-tool frontend summarizer** → only if SC#10 UAT shows a bare tool name.
- **Runtime auto-demotion of a model's tier** → rejected (D-122-03).
- **Local-provider routing fixes** (BUG-260616-01) — already owned by Phase 111.1 (do NOT re-fold; flagged below as an adjacency).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MP-01 | Force→coerce retry ladder in `forced_emit` so a typed emit recovers instead of degrading to a silent empty result | The ladder home + the exact splice point are mapped (`forced_emit.py:245-249` tier-resolution → the single sealed `open_stream` call at `:339`); the missing non-strict rung is the difference between today's 2-rung shape and the 4-rung D-122-02 ladder; the strict-400→non-strict-recovery is reproducible via the existing `_patch_gateway` fixture (first `open_stream` raises, retry succeeds). See Architecture Pattern 1 + Code Examples. |
| MP-02 | Explicit doc-verified `emit_tier` per model replaces guesswork; drop inert DeepSeek strict; keep GLM forcing | The complete `emit_tier` mapping is derived from live registry + provider docs (55 rows: 14 OpenAI→`force_strict`, 34→`force`, 5 Kimi/Moonshot→`coerce`, **2 DeepSeek demoted `force_strict`→`force` because strict is inert**); the `provider=="openai"` gate (`openai_service.py:1555`) + the inert function-level strict (`:1548`) are the exact removal sites. See Standard Stack + Code Examples. |
| MP-03 | Eval treats provider as first-class axis with a per-provider scoreboard (trigger/force/recovery/honest-fail), pass-OR-documented, gating any tier change | `eval_cross_provider.py` shape + `PROVIDERS` roster (`:82-93`) + `NATIVE_7` gate (`:140`) + the `emit_capability_table` artifact writer (`:1142`) + the `.planning/eval/README.md` ritual are all mapped; the new matrix drives the real `forced_emit` per provider. See Architecture Pattern 3 + Validation Architecture. |
| TDP-01 | Task labels concrete on every provider; ungated `execute_code.description` nudge + deterministic floor backstop | The `SYSTEM_PROMPT` splice point (`agent_loop.py:461`, the `execute_code` guidance at `:497-501`) + the verified frontend floor (`workspacePanel.ts:178-186` `humanize()` — `execute_code.description > inferLabel(code) > "Run code"`; non-code tools fall back to `PRETTY_TOOL_NAMES[name] ?? name` = the bare-name risk surface) are pinned; `tool_args_progress` confirmed cross-provider. See Architecture Pattern 4 + Pitfall 4. |

## Standard Stack

This phase adds **zero new packages**. It edits four existing surfaces. The "stack" is the existing substrate.

### Core (existing — edited in place)
| Component | Location | Purpose | Why It's The Right Home |
|-----------|----------|---------|-------------------------|
| `forced_emit()` | `backend/app/services/forced_emit.py:205` | The SEALED single forced shot — drives the gateway ONCE, tiers FORCE/COERCE, recovers narration, guards truncation, honest-fails | Shared by all 4 emit consumers; the defect is here, so the fix is here (D-122-01) `[VERIFIED: live code]` |
| `ModelCapability` TypedDict + `MODEL_CAPABILITIES` | `backend/app/config.py:136-182` + `:207-337` | Per-model capability registry (`forced_emission`, `strict_json_schema`, `capability_source`) | The single source of truth all forcing reads; `emit_tier` lands beside `capability_source` (D-122-04) `[VERIFIED: live code]` |
| `create_adaptive_streaming_chat` forcing branch | `backend/app/services/openai_service.py:1534-1581` | OpenAI-compat forcing translation: function-level `strict` (`:1548`) + `provider=="openai"` json_schema gate (`:1555`) | The exact removal sites for the two-bool→`emit_tier` migration `[VERIFIED: live code]` |
| `eval_cross_provider.py` | `scripts/eval_cross_provider.py` | Operator-run, localhost-gated cross-provider eval driver + `.planning/eval/` artifact writer | The proven scoreboard substrate (Phases 088/096/120) MP-03 extends `[VERIFIED: live code]` |
| `SYSTEM_PROMPT` | `backend/app/services/agent_loop.py:461` | Shared agent system prompt (the ungated nudge site) | G-5 hot file — one additive sentence only `[VERIFIED: live code]` |
| `inferLabel()` / `humanize()` | `frontend/src/lib/workspacePanel.ts:109-129` / `:178-186` | Deterministic, reload-safe label floor for code steps + tool-name precedence | TDP-01's "deterministic frontend summarizer floor" — already exists `[VERIFIED: live code]` |

### Supporting (existing — read-only / consumed)
| Component | Location | Purpose | When Relevant |
|-----------|----------|---------|---------------|
| `GatewayRequest` (`force_tool_name`, `strict_schema`) | `provider_gateway/dispatcher.py:83-84` | The forcing envelope each adapter translates | The ladder re-drives `open_stream` with different `strict_schema` per rung `[VERIFIED: live code]` |
| Anthropic adapter forcing | `provider_gateway/anthropic.py:71-75` | `tool_choice={"type":"tool","name":<emitter>}` (thinking OFF) | Grounds Anthropic `emit_tier=force` (forced tool use, no token-level schema) `[VERIFIED: live code]` |
| Google adapter forcing | `provider_gateway/google.py:76-85` | `function_calling_config(mode="ANY", allowed_function_names=[<emitter>])` | Grounds Google `emit_tier=force` `[VERIFIED: live code]` |
| OpenAI-compat adapter forcing | `provider_gateway/openai_compat.py:392-405` | Passes `force_tool_name` + `strict_response_format` through to `create_adaptive_streaming_chat` | The seam the strict→non-strict rung toggles `[VERIFIED: live code]` |
| The 4 `forced_emit` consumers | `phase_types.py:1189` (llm_emit), `publish_service.py:710` + `validator_kinds.py:462` (judge), `workflow_authoring.py:434` (NL authoring), `embedding_service.py:335` (metadata extraction) | All recover automatically once the ladder is inside `forced_emit` (D-122-01) | Verify each still byte-identical on the happy path `[VERIFIED: live code]` |
| `_SUB_AGENT_MODEL_DEFAULTS` | `backend/app/config.py:672-682` | Effective model per provider for workflow/eval (representative roster) | The scoreboard reports the EFFECTIVE model, not the requested one (Pitfall 1) `[VERIFIED: live code]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `emit_tier` as a literal enum field on `ModelCapability` | A derived **read-only view** computed from the existing two bools at lookup time | A derived view avoids editing 55 rows but **keeps the guess** (it would re-derive DeepSeek as `force_strict` from `strict_json_schema:True`). D-122-04's intent is *one explicit declared value*; a derived view that still consults `strict_json_schema` does not satisfy "replaces the two-bool combo." **Recommendation: explicit literal field**, with the two old bools either removed or left as deprecated-unread for one phase. (Planner's mechanism call.) |
| Re-driving the whole gateway per rung | A single call with provider-side `tool_choice` negotiation | No provider exposes a "try strict, else non-strict" negotiation; the ladder must re-drive. The cost is bounded (≤3 provider calls only on the failure path; happy path is one call as today). `[ASSUMED]` |
| A new pytest cross-provider gate | The operator grep ritual (D-122-06) | A pytest gate needs live cross-provider keys in CI (secrets + cost + flakiness) — explicitly rejected. The operator ritual stays. |

**Installation:** None — no new packages.

**Version verification:** N/A — no dependencies added. (Existing stack: Python 3.x backend venv, `openai`/`anthropic`/`google-genai` SDKs already pinned.) `[VERIFIED: no new deps]`

## Package Legitimacy Audit

**Not applicable** — this phase installs no external packages. All work edits existing first-party modules (`forced_emit.py`, `config.py`, `openai_service.py`, `agent_loop.py`, `eval_cross_provider.py`, `workspacePanel.ts`). No `npm install` / `pip install` / `cargo add` occurs.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────────────────┐
   4 emit consumers      │  forced_emit(messages, model, provider, emitter, …)     │
   (all auto-recover,    │  ──────────────────────────────────────────────────    │
    D-122-01):           │  1. resolve emit_tier from registry (default coerce)    │  ← MP-02
   ┌──────────────┐      │  2. build the ORDERED rung list from the top tier:      │
   │ llm_emit     │─────▶│       force_strict → force(non-strict) → coerce → fail   │  ← MP-01 ladder
   │ judge        │─────▶│  3. for each rung until one succeeds:                    │
   │ NL authoring │─────▶│        ┌──────────────────────────────────────────┐     │
   │ metadata ext │─────▶│        │ GatewayRequest(force_tool_name OR auto,   │     │
   └──────────────┘      │        │   strict_schema=<rung>)                   │     │
                         │        │   → open_stream(provider, req)  ◀─ ONE shot│     │
                         │        └──────────────────────────────────────────┘     │
                         │        on provider_error/no-emit → NEXT rung             │
                         │        on success → log winning_rung (telemetry only) ───┼──▶ scoreboard
                         │  4. all rungs exhausted → honest _failure() (never silent)│     feed (MP-03)
                         └───────────────────────┬─────────────────────────────────┘
                                                 │
                  ┌──────────────────────────────┼──────────────────────────────┐
                  ▼                               ▼                              ▼
        provider_gateway/anthropic     provider_gateway/google      provider_gateway/openai_compat
        tool_choice={type:tool,name}   function_calling_config       force_tool_name + strict_response_format
        (thinking OFF) = FORCE          mode=ANY = FORCE              :1548 strict flag / :1555 json_schema gate
                                                                     ── REMOVE the provider=="openai" gate (MP-02)

   ── shared event-stream path below the gateway is NEVER branched by provider (D-14 RED LINE) ──

   OPERATOR PATH (MP-03, localhost-gated, measurement only — never a runtime path):
   scripts/eval_cross_provider.py --forced-emit
     → per provider × {EASY schema, HARD schema} → drive REAL forced_emit
     → assert 4 axes: trigger / force / recovery / honest-fail
     → write .planning/eval/forced-emit-scoreboard-<date>.{json,md}  (PASS/FAIL/DOCUMENTED cells)
     → operator greps latest before flipping any emit_tier  (the gate, D-122-06)

   TDP-01 PATH (orthogonal):
   SYSTEM_PROMPT (+1 ungated execute_code.description sentence) ──▶ model fills description
     ──▶ tool_args_progress (cross-provider) ──▶ frontend humanize(): description > inferLabel(code) > "Run code"
```

### Recommended Project Structure
No new files required for MP-01/MP-02/TDP-01 (in-place edits). MP-03 adds artifacts only:
```
backend/app/services/forced_emit.py        # MP-01 ladder loop (in place)
backend/app/config.py                       # MP-02 emit_tier field + 55-row migration
backend/app/services/openai_service.py      # MP-02 remove :1555 gate + :1548 inert strict; read emit_tier
backend/app/services/agent_loop.py          # TDP-01 +1 SYSTEM_PROMPT sentence
scripts/eval_cross_provider.py              # MP-03 --forced-emit matrix + artifact writer
.planning/eval/
  ├── forced-emit-scoreboard-<date>.json    # NEW artifact (MP-03)
  ├── forced-emit-scoreboard-<date>.md       # NEW artifact (MP-03)
  └── README.md                              # extend with the forced-emit ritual
frontend/src/lib/workspacePanel.ts          # TDP-01 verify-only (extend PRETTY_TOOL_NAMES only if UAT needs)
```

### Pattern 1: The recovery ladder as an ordered rung loop (MP-01)
**What:** Replace the current single-branch `if forced: … else: …` (the 2-rung shape at `forced_emit.py:294-330`) with a loop over an ordered list of rung descriptors, each describing one already-known-good mode. The first rung that returns a validated emission wins; on `provider_error` or no-emit, fall to the next rung; after the last, the honest `_failure()` floor.
**When to use:** Inside `forced_emit`, between tier-resolution (`:245-249`) and the validate loop. Every consumer inherits it for free (D-122-01).
**Rung order (D-122-02, by `emit_tier`):**
- `emit_tier=force_strict` → rungs: [strict-force, non-strict-force, coerce, fail]
- `emit_tier=force` → rungs: [non-strict-force, coerce, fail] (skip strict — provider doesn't support token-level schema)
- `emit_tier=coerce` → rungs: [coerce, fail] (genuinely unforceable — Kimi/Moonshot)
**Telemetry (D-122-03):** record the winning rung name on the success result dict (e.g. `"emit_rung": "non_strict_force"`) and `logger.info` it (identifier-only, never content — T-073-04). The scoreboard reads which rung each provider needed. The ladder NEVER writes the registry.
**Example:** see Code Examples → "MP-01 ladder loop".

### Pattern 2: One explicit declared value, no provider-name special-casing (MP-02)
**What:** Add `emit_tier: Literal["force_strict", "force", "coerce"]` to `ModelCapability` (`total=False`). `forced_emit` resolves the tier with `get_model_capability(model).get("emit_tier", "coerce")` (default-SAFE coerce per D-122-05). The `provider=="openai"` gate at `openai_service.py:1555` is **removed** — strict json_schema is requested whenever the resolved tier is `force_strict` (which, post-migration, is OpenAI-only because that's the only family with verified token-level schema). The inert function-level `strict:True` at `:1548` is **removed** (it does nothing without DeepSeek's `/beta` base_url, which the code never sets).
**When to use:** The registry migration + the forcing-translation cleanup.
**Migration cost (quantified live):** 55 registry rows. 50 carry `forced_emission:True`, 16 carry `strict_json_schema:True` (= 14 OpenAI + 2 DeepSeek). New mapping:

| Current flags | Rows | New `emit_tier` | Notes |
|---------------|------|-----------------|-------|
| `forced_emission:True` + `strict_json_schema:True`, provider=openai | 14 | `force_strict` | Genuinely supports json_schema strict `[CITED: developers.openai.com/api/docs/guides/structured-outputs]` |
| `forced_emission:True` + `strict_json_schema:True`, provider=deepseek | 2 | **`force`** (demoted) | **Strict is INERT today** — gated out at `:1555` for non-openai AND the `:1548` flag does nothing without `base_url=.../beta` which the code never sets `[CITED: api-docs.deepseek.com/guides/function_calling]` |
| `forced_emission:True`, no strict (anthropic/google/minimax/zhipu + conditional openrouter) | 34 | `force` | Forced tool use / mode=ANY / OpenAI-compat named tool_choice; no token-level schema |
| `forced_emission` absent (kimi/moonshot) | 5 | `coerce` | Genuinely unforceable — `tool_choice` auto/none only `[CITED: github.com/MoonshotAI/Kimi-K2 tool_call_guidance]` |

### Pattern 3: Extend the eval driver with a forced-emit matrix (MP-03)
**What:** Add a `--forced-emit` mode to `eval_cross_provider.py` parallel to the existing `--workflow` mode. Per `(provider, schema_difficulty)`, drive the **real** `forced_emit` (via a localhost backend route OR a direct-call harness — see Open Question 2) and score the 4 axes. Reuse the established patterns verbatim: `PROVIDERS` roster (`:82-93`), `NATIVE_7` gate (`:140`), `assert_localhost_only()` (`:423`), presence-only env reporting, the dated-artifact writer (`emit_capability_table`, `:1142`), and the README grep ritual.
**The 4 axes → what each measures:**
- **trigger** — did the model attempt the forced/coerced tool call at all (not answer from training)?
- **force** — did the model commit the tool call on the declared top rung (the `emit_tier` rung)?
- **recovery** — did a 400/no-emit recover via a lower rung (non-strict / coerce) rather than going dark?
- **honest-fail** — when nothing succeeds, is the result a clean `_failure()` (never a silent empty or fabricated artifact)?
**Schema difficulty:** exercise BOTH an EASY schema and a HARD schema (optional-heavy + `additionalProperties` confidence object — the live trip-wire that 400s OpenAI/DeepSeek/Z.ai, BUG-260615-01). The HARD schema is what makes the recovery axis non-vacuous.
**Cell semantics (D-122-07):** PASS / FAIL / DOCUMENTED. DOCUMENTED = a known-limitation row inside the artifact (e.g. "moonshot: coerce-only, genuinely unforceable per Kimi tool-call guidance") — clears the gate because the declared `emit_tier` already reflects it.

### Pattern 4: Ungated prompt nudge + verified floor (TDP-01)
**What:** Add ONE sentence to `SYSTEM_PROMPT` near the `execute_code` guidance (`agent_loop.py:497-501`) instructing the model to always pass a concrete, specific `description` (e.g. "Always set `description` to a short, specific label of what the code produces — e.g. 'Generating Q3 revenue chart', not 'Run code'."). It is **ungated** (shared prompt) — it can only improve providers that already label well, and lifts the ones that don't. The frontend floor (`humanize()`) already backstops a missing description for `execute_code` via `inferLabel(code)`. **Do not** build a per-tool summarizer up front (D-122-08).
**When to extend the floor:** ONLY if SC#10 UAT shows a bare tool name for a non-`execute_code` tool — then add that tool's pretty name to `PRETTY_TOOL_NAMES` (`workspacePanel.ts:157-167`).

### Anti-Patterns to Avoid
- **Forking the shared event-stream path by provider** (D-14 RED LINE): all forcing/strict differences stay in the 3 adapters + `forced_emit`'s rung loop; the `_ClosableEventStream._normalize` chunk handler is NEVER branched for the ladder. The 092.5 guard test asserts no `if provider ==` forcing branch leaks into the consumer.
- **Mutating the registry at runtime** (D-122-03): the ladder logs the winning rung but never writes `emit_tier`. Runtime auto-demotion is rejected.
- **Re-deriving `emit_tier` from the old two bools** (defeats MP-02): a derived view that still reads `strict_json_schema` would re-introduce the DeepSeek `force_strict` guess. The declared value must be authoritative.
- **Re-running the strict rung on a `coerce`-tier model**: would 400 every Kimi/Moonshot emit. The rung list is tier-scoped (Pattern 1).
- **Touching the working Anthropic label path** (BUG-260528-03 constraint): the nudge is provider-agnostic; do not add Anthropic-specific extraction.
- **Growing `agent_loop.py` beyond the single nudge sentence** (G-5 hot file): one additive string, no logic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Narration→schema recovery (a model that narrates the field-map instead of calling the tool) | A new JSON-from-prose parser | `recover_narrated_emission` (`forced_emit.py:98`) — the coerce rung already calls it | Handles tool-wrapped narration AND bare fenced objects; validated against the schema_model; honest-None on failure |
| Truncation detection | A `finish_reason` string check | `is_truncated` (`template_render_service.is_truncated`, called at `forced_emit.py:348`) | Already rejects `max_tokens`/`length` half-objects before acceptance |
| Cross-provider key/base_url resolution for a forced shot targeting a non-active provider | Per-call key plumbing | The existing injection block (`forced_emit.py:251-291`) | **ADJACENCY WARNING** — this is the SAME seam Phase 111.1's BUG-260616-01 fixes #2/#3 touch; see Common Pitfall 5 |
| Per-provider forcing translation | New `if provider==` branches in `forced_emit` | The 3 gateway adapters (`force_tool_name` / `strict_schema` translation) | D-14: forcing lives ONLY at the adapter boundary |
| Deterministic code-label inference | A new label heuristic | `inferLabel()` (`workspacePanel.ts:109`) — leading-comment → keyword rules → "Run code" | Reload-safe, provider-independent, already shipped (spike-007) |
| Localhost-gated cross-provider eval plumbing | A new eval script | Extend `eval_cross_provider.py` (`--forced-emit` mode) | Env load, localhost hard-gate, bearer mint, DB-truth assertions, dated-artifact writer all exist |
| The tier-change gate | A CI pytest gate (needs live keys) | The operator grep ritual (`.planning/eval/README.md`) | D-122-06: no CI secrets; the operator's live eval is the only thing that proves providers |

**Key insight:** `forced_emit` is a *recovery* substrate that already has every mode the ladder needs — it just never chains them. MP-01 is ~30 lines of orchestration, not new emission machinery. MP-02 is a registry migration + two deletions. MP-03 is a new mode on a proven driver. TDP-01 is one sentence + a UAT assertion.

## Runtime State Inventory

> This is a registry-curation + code-change phase, not a string-rename/migration. The closest analog is the `MODEL_CAPABILITIES` registry edit (MP-02). No stored data, OS state, or secrets are renamed. Included for the registry-migration dimension only.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — no DB rows store `emit_tier`/`forced_emission`/`strict_json_schema`; the registry is in-code (`config.py`), read at runtime. No migration SQL. Verified: no `emit_tier` column anywhere; `forced_emission` is a Python dict key only. | None — pure code edit |
| Live service config | **None** — no external service holds these flags. The eval reads `.planning/eval/` git artifacts, not a service. | None |
| OS-registered state | **None** — no Task Scheduler / pm2 / systemd registration references these flags. | None |
| Secrets/env vars | **None renamed.** The per-provider `<provider>_api_key` env vars are read unchanged by `forced_emit.py:278`; the eval reads them presence-only. The DeepSeek `/beta` base_url is NOT introduced (strict stays dropped). | None |
| Build artifacts | **None** — no compiled package carries the old flags; `config.py` is imported live. The 55-row registry edit takes effect on backend restart (no rebuild). The sandbox image is untouched (no new package). | Restart backend after edit (normal) |

**The canonical question:** After the registry is edited and the ladder added, what runtime systems still have an old tier cached? **Answer: none beyond the running uvicorn workers** — `MODEL_CAPABILITIES` is read per-call via `get_model_capability`, so a backend restart fully applies the change. (Multi-worker `WORKER_COUNT=2` is in-process; restart both.) `[VERIFIED: live code — config.py read at lookup time]`

## Common Pitfalls

### Pitfall 1: The failing set is SCHEMA-specific, not a fixed provider list
**What goes wrong:** Treating "DeepSeek/Gemini fail forcing" as a provider property and hard-coding a deny-list. The Phase-104 deliverable schema produced clean output on OpenAI/Anthropic/MiniMax/Z.ai, but the Phase-111 `emit_document_metadata` schema (optional-heavy + `additionalProperties` confidence object) made **OpenAI gpt-4o, DeepSeek, AND Z.ai glm-4.6** ALL `400` — three providers that succeeded on the easier schema.
**Why it happens:** The OpenAI-schema-validation family (OpenAI/DeepSeek/Z.ai) rejects certain optional-heavy / `additionalProperties` shapes in *forced/strict* mode that they accept in *non-strict* / *coerce* mode.
**How to avoid:** The ladder must be schema-blind — it recovers by *mode* (strict→non-strict→coerce), not by provider deny-list. The scoreboard's force/recovery axes MUST exercise a HARD schema, not only an easy one (D-122-02 specifics).
**Warning signs:** A test that only uses an easy schema will green a ladder that never exercises the recovery rung (the exact static-false-green trap from Phase 102/104). `[VERIFIED: BUG-260615-01 §"Phase 111 live UAT extension"]`

### Pitfall 2: `strict=False` is already passed but the shot STILL 400s and goes dark
**What goes wrong:** Assuming "the caller passes `strict=False`, so the non-strict path is already exercised." The metadata-extraction caller (`embedding_service.py:344`) DOES pass `strict=False` — yet the live TIER-FORCE shot still 400s on the HARD schema and degrades to `None` with no further retry.
**Why it happens:** Even non-strict *forced* tool-calling (`tool_choice={type:function,name}`) can 400 on the HARD schema; the recovery that actually works is dropping to **coerce** (`tool_choice="auto"` + directive). Today's `forced_emit` has no rung between non-strict-force and honest-fail for a `force`-tier model.
**How to avoid:** The ladder's coerce rung (rung 3) is the real safety net for the HARD schema, not just the non-strict-force rung. Build the ladder so a `force`-tier model that 400s on forced-non-strict still falls to coerce before failing.
**Warning signs:** The acceptance test should reproduce strict-400 → non-strict-400 → coerce-success on at least one OpenAI-schema-family provider, not just strict-400 → non-strict-success. `[VERIFIED: live code embedding_service.py:344 + BUG-260615-01]`

### Pitfall 3: DeepSeek strict is doc-supported but our code can't reach it
**What goes wrong:** Reading "DeepSeek supports strict json_schema" and keeping `strict_json_schema:True` (→ `force_strict`). DeepSeek's strict mode requires `base_url="https://api.deepseek.com/beta"` AND `additionalProperties:false` on every object AND function-level `strict:true`. Our code sets the function-level flag (`:1548`) but **never switches the base_url to `/beta`** and the json_schema response_format is gated to `provider=="openai"` only (`:1555`). So DeepSeek strict is unreachable today.
**Why it happens:** The registry flag was set from the doc capability, not from what our gateway actually sends.
**How to avoid:** Demote DeepSeek to `emit_tier=force` (D-122-04 "drop the inert DeepSeek strict"). The scoreboard can later promote it to `force_strict` ONLY if a future plan wires the `/beta` base_url AND the scoreboard proves it (D-122-05). Do NOT wire `/beta` in this phase (out of scope — keep strict dropped).
**Warning signs:** A `force_strict` DeepSeek row in the registry after this phase = the inert-strict bug re-introduced. `[CITED: api-docs.deepseek.com/guides/function_calling — "Use base_url=…/beta to enable Beta features … all functions need strict:true"]`

### Pitfall 4: A non-`execute_code` tool falls back to its BARE name in the panel
**What goes wrong:** Assuming the frontend floor covers every tool. `humanize()` (`workspacePanel.ts:185`) returns `PRETTY_TOOL_NAMES[tc.name] ?? tc.name` for non-`execute_code` tools — a tool NOT in the `PRETTY_TOOL_NAMES` map renders its **raw tool name** (the bare-name failure TDP-01 closes). Only `execute_code` gets the `inferLabel(code)` floor.
**Why it happens:** `inferLabel` is code-specific; the pretty-name map is a curated allow-list, not exhaustive.
**How to avoid:** The TDP-01 nudge targets `execute_code.description` (the most common bare-name surface). The SC#10 UAT MUST check non-`execute_code` tools too; if any shows a bare name, extend `PRETTY_TOOL_NAMES` for that tool (D-122-08 — only as needed, no up-front summarizer).
**Warning signs:** A panel row showing a raw snake_case tool name (e.g. `query_documents_by_view`) for any provider. `[VERIFIED: live code workspacePanel.ts:178-186]`

### Pitfall 5: The 111.1 gateway-seam adjacency — do not step on each other
**What goes wrong:** MP-02's forcing-translation cleanup touches `openai_service.py:1521-1581` and the `forced_emit.py:251-291` cross-provider key/base_url injection — the **same seam** Phase 111.1's BUG-260616-01 fixes #2/#3 occupy (local-provider routing: `forced_emit.py:251-275` lmstudio/ollama injection + `openai_service.py:1449-1456`). A careless edit could revert 111.1's local-routing fix or conflate it with the strict-gate removal.
**Why it happens:** Both phases live at the cross-provider gateway boundary.
**How to avoid:** MP-02 touches the **forcing/strict** lines (`:1534-1581` + the `provider=="openai"` gate); it must NOT touch the local-provider injection block (`forced_emit.py:270-291` lmstudio/ollama branch) — that is 111.1's and stays. Local-provider routing is explicitly out of scope (Deferred). Read `BUG-260616-01` before editing the injection block.
**Warning signs:** A diff that removes or alters the `if provider in ("ollama", "lmstudio")` branch. `[VERIFIED: live code forced_emit.py:270-291 + CONTEXT.md adjacency flag]`

### Pitfall 6: `body.model` does not steer the effective model in the eval
**What goes wrong:** The scoreboard reporting the requested model instead of the effective one. Workflow phases run via sub-agents whose model comes from `_SUB_AGENT_MODEL_DEFAULTS` (`config.py:672`), not the request's `model` field.
**Why it happens:** Harness phases resolve their own model.
**How to avoid:** For a `--forced-emit` matrix that drives `forced_emit` directly (not through the workflow), the requested model DOES steer the shot — but if any axis routes through a sub-agent/workflow, report the effective model from `runs.model` (the existing eval already does this via `sub_agent_models`). Pick the direct-`forced_emit` harness path to avoid the ambiguity (Open Question 2). `[VERIFIED: eval_cross_provider.py:266-279 + config.py:667-670 Pitfall 1 note]`

## Code Examples

### MP-01 ladder loop (the recommended shape — Claude's discretion on exact mechanics, D-122)
```python
# forced_emit.py — between tier-resolution (:245-249) and the validate loop.
# Each rung is an already-known-good mode; the loop re-drives the gateway ONCE per rung.
# Source: derived from live forced_emit.py:294-345 (the existing FORCE/COERCE branches)

# emit_tier resolved from the registry, default-SAFE coerce (D-122-04/05)
emit_tier = (get_model_capability(model) or {}).get("emit_tier", "coerce")

# Ordered rung list per tier (D-122-02). Each rung: (name, forced, strict_schema, tool_choice)
_RUNGS_BY_TIER = {
    "force_strict": [("strict_force", True,  True,  None),
                     ("non_strict_force", True, False, None),
                     ("coerce", False, False, "auto")],
    "force":        [("non_strict_force", True, False, None),
                     ("coerce", False, False, "auto")],
    "coerce":       [("coerce", False, False, "auto")],
}

last_failure = None
for rung_name, forced, strict_schema, _tc in _RUNGS_BY_TIER[emit_tier]:
    req = _build_request(  # the existing FORCE vs COERCE request assembly, parameterized
        messages=messages, model=model, provider=provider, emitter=emitter,
        tools=tools, user_settings=user_settings, system_prompt=system_prompt,
        max_tokens=max_tokens, forced=forced, strict_schema=strict_schema,
    )
    try:
        stream, calling_mode = await open_stream(provider, req)
        content, tool_calls, finish_reason = await run_in_threadpool(_drain, stream)
    except Exception:  # noqa: BLE001 — a provider raise (e.g. strict 400) → try the NEXT rung
        logger.info("forced_emit: rung=%s raised; descending tier=%s provider=%s",
                    rung_name, emit_tier, provider)
        last_failure = "provider_error"
        continue
    if is_truncated(finish_reason=finish_reason):
        last_failure = "truncated"; continue   # truncation: try next rung or fail honestly
    emitted = _extract_or_recover(tool_calls, content, calling_mode, emitter, schema_model)
    if emitted is not None:
        return {  # D-122-03 telemetry: which rung won (logged, NEVER written to the registry)
            "emitted": emitted, "tier": emit_tier, "emit_rung": rung_name,
            "provider": provider, "forced": forced,
            "recovered_from_narration": _recovered, "truncated": False, "failure": None,
        }
    last_failure = "model_failed_to_emit"

# All rungs exhausted → the existing honest-fail floor (never silent, never fabricated)
return _failure(emit_tier, provider, forced=False, failure_override=last_failure)
```

### MP-02 — remove the provider-name gate + inert DeepSeek strict (the deletions)
```python
# openai_service.py:1534-1581 — BEFORE (current):
if force_tool_name is not None:
    _forced_tools = ...
    if strict_response_format:
        # :1548 — function-level strict (INERT for DeepSeek: no /beta base_url)
        _fn["strict"] = True
    kwargs["tools"] = _forced_tools
    kwargs["tool_choice"] = {"type": "function", "function": {"name": force_tool_name}}
    if strict_response_format and provider == "openai":   # :1555 — the hardcoded gate (REMOVE)
        kwargs["response_format"] = {"type": "json_schema", "json_schema": {...}}

# AFTER (MP-02): strict_response_format is True ONLY when emit_tier=="force_strict"
# (post-migration, that's OpenAI-only — so the json_schema response_format is requested
# for exactly the family that supports it, WITHOUT a provider-name special-case).
# The function-level :1548 strict block is REMOVED (it never worked for DeepSeek and
# OpenAI uses the response_format json_schema, not the function-level flag).
if force_tool_name is not None:
    kwargs["tools"] = tools_override if tools_override is not None else get_tools(user_settings)
    kwargs["tool_choice"] = {"type": "function", "function": {"name": force_tool_name}}
    if strict_response_format:   # caller sets this only for force_strict-tier (OpenAI) shots
        kwargs["response_format"] = {"type": "json_schema", "json_schema": {
            "name": force_tool_name, "schema": _schema_of(force_tool_name, kwargs["tools"]),
            "strict": True,
        }}
# Source: live openai_service.py:1534-1581 + CITED OpenAI/DeepSeek strict docs
```

### MP-02 — the registry field (one row example)
```python
# config.py:136-182 — ModelCapability TypedDict: add
emit_tier: Literal["force_strict", "force", "coerce"]  # Phase 122 D-122-04 — single source of truth

# config.py:207-337 — example rows after migration:
"gpt-4o":            {..., "emit_tier": "force_strict"},   # OpenAI: verified json_schema strict
"deepseek-v4-pro":   {..., "emit_tier": "force"},          # demoted — strict inert (no /beta base_url)
"claude-opus-4-8":   {..., "emit_tier": "force"},          # forced tool use, thinking OFF
"gemini-2.5-flash":  {..., "emit_tier": "force"},          # mode=ANY
"MiniMax-M2.7":      {..., "emit_tier": "force"},          # named tool_choice, no response_format
"glm-4.6":           {..., "emit_tier": "force"},          # named tool_choice (scout note confirmed)
"kimi-k2.6":         {..., "emit_tier": "coerce"},         # genuinely unforceable
# Source: live config.py registry + CITED provider docs (see Sources)
```

### MP-03 — the scoreboard artifact shape (extends .planning/eval/ format)
```json
{
  "schema_difficulty": "hard",
  "provider": "deepseek",
  "model_effective": "deepseek-v4-flash",
  "declared_emit_tier": "force",
  "winning_rung": "coerce",
  "axes": {
    "trigger":     "PASS",
    "force":       "FAIL",
    "recovery":    "PASS",
    "honest_fail": "PASS"
  },
  "documented": [
    {"axis": "force", "note": "deepseek-v4 400s on the additionalProperties confidence schema in forced mode; recovers via coerce — declared tier 'force' reflects this", "evidence": "BUG-260615-01"}
  ],
  "gated": true
}
# A DOCUMENTED axis clears the gate (D-122-07) because declared tier == measured reality.
# Source: derived from .planning/eval/capability-table-2026-06-07.json shape + D-122-06/07
```

### TDP-01 — the ungated nudge (one sentence into SYSTEM_PROMPT)
```python
# agent_loop.py near :497-501 (the execute_code guidance) OR a Rules bullet near :537.
# Source: live SYSTEM_PROMPT agent_loop.py:461-548
"- **execute_code labels:** ALWAYS set `description` to a short, specific label of what "
"the code produces (e.g. 'Generating Q3 revenue chart', 'Creating the risk-register .docx'), "
"never a generic phrase like 'Run code' or 'Generating code'. The user sees this label live "
"in their workspace panel.\n"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Implicit forcing from `forced_emission` + `strict_json_schema` two bools + a `provider=="openai"` gate | One explicit `emit_tier` enum, doc-verified, no provider-name special-case (MP-02) | This phase (122) | Removes the guess; DeepSeek correctly `force` not `force_strict` |
| 2-rung emit (FORCE \| COERCE) → honest-fail; a strict-400 degrades straight to None | 4-rung ladder strict→non-strict→coerce→fail; a 400 recovers (MP-01) | This phase (122) | Default-config metadata extraction stops silently emitting nothing (folds BUG-260615-01) |
| Eval measures Deep-mode tool-use + workflow round-trips only | Eval adds a forced-emit axis (trigger/force/recovery/honest-fail) per provider (MP-03) | This phase (122) | Tier changes become measured, not assumed; "no silent tier flip" (SC#3) |
| Non-`execute_code`-description providers show generic/bare labels | Ungated `execute_code.description` nudge + verified floor (TDP-01) | This phase (122) | OpenAI-parity labels on every provider; closes BUG-260528-03 |

**Deprecated/outdated:**
- The `provider=="openai"` strict gate (`openai_service.py:1555`) — replaced by `emit_tier=="force_strict"` (OpenAI-only by measurement, not by name).
- The function-level `strict:True` on the forced tool def (`openai_service.py:1548`) — inert (DeepSeek needs `/beta`; OpenAI uses response_format json_schema). Removed.
- BUG-260528-03's stated cause (Anthropic-only `tool_args_progress`) — **wrong**: `tool_args_progress` is already cross-provider (confirmed live in all 3 adapters). The real gap is the missing ungated nudge.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The non-strict-force rung alone is insufficient for the HARD schema on some `force`-tier providers; the **coerce** rung is the real safety net (the 400 persists in forced-non-strict mode for the optional-heavy schema) | Pitfall 2, Pattern 1 | If non-strict-force already recovers everywhere, the coerce rung is rarely exercised (still correct, just belt-and-suspenders). The live scoreboard settles which rung each provider needs — this is exactly what MP-03 measures. LOW risk (the ladder is correct either way; only the *winning rung* differs). |
| A2 | Z.ai/GLM resolves to non-strict `force` (no `json_schema` response_format is built for it today) | MP-02 mapping | The z.ai docs page didn't expose tool_choice/response_format specifics via WebFetch; the live registry has GLM as `forced_emission:True` + no `strict_json_schema`, and the `:1555` gate is OpenAI-only, so GLM never gets json_schema today regardless. The scout note + live code agree → `force`. The scoreboard's HARD-schema force/recovery axis confirms it live (D-122-05 gate). MEDIUM→LOW. |
| A3 | Driving the real `forced_emit` per provider in the eval is best done via a direct-call harness (not the chat HTTP route), since `forced_emit` is a sealed substrate not exposed on a public route | Open Question 2 | If a direct-call harness is awkward to localhost-gate the same way, the metadata-extraction ingest path (which calls `forced_emit`) could be the driver instead. Resolved at plan time. LOW (both reach `forced_emit`). |
| A4 | Removing the function-level `strict:True` block (`:1548`) does not regress OpenAI (OpenAI gets its guarantee from the `response_format` json_schema, not the function-level flag) | MP-02 deletions, Code Examples | If OpenAI's forced-tool-arg guarantee actually depends on the function-level flag too, removing it could weaken OpenAI strictness. Mitigation: keep the response_format json_schema for `force_strict`; the OpenAI scoreboard force axis verifies live. MEDIUM — flag for the plan to test OpenAI force_strict explicitly. |
| A5 | A backend restart fully applies the registry edit (no cached tier) under `WORKER_COUNT=2` | Runtime State Inventory | If a worker caches `get_model_capability` results beyond per-call, a stale tier could persist. Live code reads per-call (no memoization seen) → restart suffices. LOW. |

**If this table is non-empty:** these claims need confirmation — A4 (OpenAI strict guarantee source) and A1 (which rung actually recovers) are the load-bearing ones the live scoreboard + an explicit OpenAI force_strict test settle.

## Open Questions (RESOLVED)

1. **`emit_tier` as a literal field vs a derived view, and the two old bools' fate.**
   - What we know: D-122-04 locks the *intent* (one explicit declared value, no provider-name special-case); 55 rows carry the old bools; 4 `forced_emit` consumers + `openai_service.py` read the tier.
   - What's unclear: whether to (a) add `emit_tier` and **delete** `forced_emission`/`strict_json_schema`, or (b) add `emit_tier` and leave the old bools deprecated-unread for one phase (safer rollback), or (c) keep the bools and add a derived `emit_tier` *view* (rejected — re-introduces the DeepSeek guess).
   - Recommendation: **(a) or (b)** — an explicit literal field. Prefer (a) if the migration test proves no other reader consults the old bools; (b) if any indirect reader is found. NOT (c). Planner's mechanism call.

2. **How the `--forced-emit` matrix drives the real `forced_emit`.**
   - What we know: `forced_emit` is a sealed substrate (not on a public HTTP route); the existing eval drives the chat/workflow HTTP routes; the metadata-extraction ingest path DOES call `forced_emit` end-to-end.
   - What's unclear: whether to add a thin localhost-only direct-call harness inside the eval script (import `forced_emit`, call it per provider with EASY/HARD schemas) or route through the ingest path.
   - Recommendation: a **direct-call harness** inside the eval (still localhost-gated, presence-only env, no new route) — cleanest, deterministic, and reports the requested model accurately (sidesteps Pitfall 6). Plan confirms.

3. **Whether to wire DeepSeek `/beta` strict in a future phase.**
   - What we know: DeepSeek strict is doc-supported but needs `base_url=…/beta`; this phase drops it (→ `force`).
   - What's unclear: nothing for 122 — it's explicitly out of scope. Noted so the scoreboard's "DOCUMENTED: deepseek coerce-fallback on hard schema" row carries a clear future-promotion path (D-122-05).
   - Recommendation: leave dropped; record the `/beta` promotion path as a DOCUMENTED note in the scoreboard, not a 122 task.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python backend venv | All backend edits + the eval driver | ✓ (project standard) | 3.x | — |
| Local Supabase (`:54322`) | MP-03 eval localhost gate + DB-truth assertions | ✓ (CLAUDE.md local infra) | — | — |
| Backend uvicorn (operator-started) | MP-03 live eval (if HTTP-route driven) + SC#10 UAT | ✓ (operator runs it) | — | Direct-call harness needs only the venv (Open Q2) |
| Provider API keys in `backend/.env` (native-7 + openrouter) | MP-03 live scoreboard; SC#10 cross-provider UAT | ✓/partial (operator-held; presence-only check; a missing key marks the row MISSING, never blocks others) | — | A missing provider key → that row is MISSING/skipped, matrix continues |
| `psycopg2` / `requests` / `python-dotenv` (eval deps) | MP-03 eval driver | ✓ (already in backend venv; eval imports them) | — | — |
| Frontend dev server + Chrome MCP | TDP-01 SC#10 G-4 UAT (panel label render) | ✓ (project standard) | — | — |

**Missing dependencies with no fallback:** none — all infra is project-standard local.
**Missing dependencies with fallback:** provider keys (a missing key marks that provider's scoreboard row MISSING and never blocks the gate — existing eval behavior, `eval_cross_provider.py:881-885`).

## Validation Architecture

> `workflow.nyquist_validation: true` (confirmed in `.planning/config.json`). This section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | `pytest` (+ `pytest-asyncio`) — backend venv |
| Framework (frontend) | `vitest` (the `inferLabel`/`humanize` floor lives in `frontend/src/lib/workspacePanel.ts`) |
| Config file | `backend/pytest.ini` (or `pyproject`); `frontend/vitest.config.*` |
| Quick run command (backend) | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_forced_emit.py -x -q` |
| Full suite command (backend) | `backend/venv/Scripts/python.exe -m pytest backend/tests/ -q` |
| Frontend label tests | `cd frontend && npx vitest run src/lib/workspacePanel.test.ts` |
| Operator-run eval (NOT pytest) | `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --forced-emit` (localhost-gated; the MP-03 scoreboard) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MP-01 | strict-400 → non-strict / coerce recovery (the ladder recovers instead of going dark) | unit (deterministic, gateway-patched) | `pytest backend/tests/unit/test_forced_emit.py -k ladder -x` | ❌ Wave 0 — extend `test_forced_emit.py` with a rung-descent test using `_patch_gateway` (first `open_stream` raises → retry succeeds) |
| MP-01 | each rung is tier-scoped (coerce-tier never runs the strict rung) | unit | `pytest backend/tests/unit/test_forced_emit.py -k tier_scoped -x` | ❌ Wave 0 |
| MP-01 | all consumers still byte-identical on the happy path (llm_emit/judge/NL/metadata) | unit (existing) | `pytest backend/tests/unit/test_llm_emit_executor.py test_validator_kinds.py test_103_nl_generate.py -q` | ✅ (extend assertions for `emit_rung` on success) |
| MP-02 | `emit_tier` resolves; default-SAFE `coerce` on registry miss | unit | `pytest backend/tests/unit/test_forced_emit.py -k emit_tier_default -x` | ❌ Wave 0 |
| MP-02 | the `provider=="openai"` gate is gone — json_schema response_format requested for `force_strict` tier without a name check | unit (gateway-request capture, mirror `test_103_forced_emit_strict.py`) | `pytest backend/tests/unit/test_gateway_forcing.py -k no_provider_gate -x` | ❌ Wave 0 — mirror the `request.strict_schema` capture pattern |
| MP-02 | inert DeepSeek function-level strict removed; DeepSeek tier == `force` | unit + registry assertion | `pytest backend/tests/unit/test_gateway_forcing.py -k deepseek_force -x` | ❌ Wave 0 |
| MP-02 | every registry row has a valid `emit_tier`; 14 force_strict (OpenAI-only), 0 force_strict non-OpenAI | unit (registry invariant) | `pytest backend/tests/unit/test_config_registry.py -k emit_tier -x` | ❌ Wave 0 |
| MP-03 | the scoreboard runs 4 axes per provider on EASY+HARD schemas, writes dated artifacts, PASS/FAIL/DOCUMENTED cells | **operator-run / localhost-gated** (NOT pytest) | `scripts/eval_cross_provider.py --forced-emit` → attach `.planning/eval/forced-emit-scoreboard-<date>.{json,md}` to VALIDATION.md | ❌ Wave 0 — extend the eval driver; CI proves *structure* with a fake gateway only |
| MP-03 | the artifact writer + axis scoring + localhost gate are correct (structure) | unit (fake gateway, no live keys) | `pytest backend/tests/unit/test_eval_forced_emit.py -x` | ❌ Wave 0 — structure-only test (the live proof is the operator run) |
| TDP-01 | `humanize()` precedence holds (`description > inferLabel(code) > "Run code"`); a non-`execute_code` tool not in the map shows… | unit (frontend) | `npx vitest run src/lib/workspacePanel.test.ts` | ✅ (verify; add a bare-name assertion) |
| TDP-01 | the SYSTEM_PROMPT carries the nudge sentence (string presence) | unit | `pytest backend/tests/unit/test_system_prompt.py -k execute_code_label -x` | ❌ Wave 0 — string-presence guard so the nudge can't be silently deleted |
| TDP-01 | NO provider shows a bare tool name (live panel) | **manual / Chrome MCP (G-4 + SC#10)** | UAT — drive `execute_code` per provider, screenshot the panel label | ❌ Wave 0 — authored in VALIDATION.md |
| SC#5 | Deep Mode byte-identical (no shared-path fork) across the native-7 | unit (092.5 guard) + UAT | `pytest backend/tests/unit/test_gateway_forcing.py -k no_provider_branch_leaks -q` + SC#10 | ✅ (re-run the 092.5 guard test) |

### Sampling Rate
- **Per task commit:** the relevant unit file (`pytest …/test_forced_emit.py -x` or the vitest label file).
- **Per wave merge:** the backend unit suite + the frontend label suite (deterministic, fast, no live keys).
- **Phase gate:** full backend suite green + **the operator-run `--forced-emit` scoreboard** attached to VALIDATION.md (the MP-03 gate, D-122-06) + the SC#10 4-axis cross-provider UAT (cross-provider × multi-tool × parallel-thread × long-message) proving no bare label and Deep byte-identical.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_forced_emit.py` — ADD ladder rung-descent + tier-scoping + `emit_tier` default tests (extend the existing `_patch_gateway` fixture; pattern: first `open_stream` raises → next rung succeeds)
- [ ] `backend/tests/unit/test_gateway_forcing.py` — ADD no-provider-gate + DeepSeek-force + Deep-no-branch-leak assertions
- [ ] `backend/tests/unit/test_config_registry.py` — NEW: registry invariant (every row has `emit_tier`; force_strict ⊆ OpenAI)
- [ ] `backend/tests/unit/test_eval_forced_emit.py` — NEW: structure-only test of the `--forced-emit` matrix + artifact writer (fake gateway, no live keys)
- [ ] `backend/tests/unit/test_system_prompt.py` — ADD a string-presence guard for the `execute_code.description` nudge
- [ ] `frontend/src/lib/workspacePanel.test.ts` — verify/extend with a bare-name assertion for a non-mapped tool
- [ ] `.planning/eval/README.md` — extend with the forced-emit scoreboard ritual (mirrors the capability-table grep ritual)
- [ ] VALIDATION.md — author the SC#10 4-axis forced-emit UAT rows + the no-bare-label panel UAT

*(Framework already present — no install needed; `pytest` + `pytest-asyncio` + `vitest` all configured.)*

## Security Domain

> `security_enforcement` is absent in `.planning/config.json` → treated as ENABLED. Section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (eval) | The eval mints a bearer token via the Supabase password grant for the documented LOCAL test user only; never prints token material (`eval_cross_provider.py:595-633`). No new auth surface. |
| V3 Session Management | no | No session changes; the ladder + registry are stateless per-call. |
| V4 Access Control | yes (eval) | The eval reads ONLY the test user's own threads (V4 RLS posture); DB access is a fixed allowlist `{todos, workspace_files}`; `thread_id` is always a parameterized `%s` (never f-string). The forced-emit matrix adds no cross-user read. `[VERIFIED: live code eval_cross_provider.py:44-46]` |
| V5 Input Validation | yes | The emitted field-map is validated against the Pydantic `schema_model` on every rung (`_validate_args`); a non-validating object is an honest fail, never accepted. The metadata-extraction system prompt already treats field descriptions as DATA, never instructions (prompt-injection guard, `embedding_service.py:331`). |
| V6 Cryptography | no | No crypto; no secrets introduced. Provider keys read presence-only by the eval (never printed). |
| V7 Error Handling & Logging | yes | The ladder logs identifier-only (rung name, tier, provider — NEVER message/args content, T-073-04). Honest-fail surfaces a structured failure, never a stack trace or env value. |

### Known Threat Patterns for {Python FastAPI backend + cross-provider gateway + localhost eval}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-provider key leakage (a forced shot targeting a non-active provider gets the wrong key) | Information Disclosure | The existing cross-provider key/base_url injection (`forced_emit.py:251-291`) resolves the TARGET provider's key on a settings copy; the ladder re-uses it unchanged. Do NOT alter the local-provider branch (Pitfall 5). |
| Eval script pointed at cloud → live writes against prod data | Tampering | `assert_localhost_only()` hard-gate before any DB/HTTP work; refuses non-localhost `SUPABASE_URL` (`eval_cross_provider.py:423-440`). |
| Secret value in eval output / logs | Information Disclosure | Presence-only env reporting; the ladder logs identifiers only (T-073-04); the scoreboard artifact contains model NAMES + verdicts only, never key material. |
| Prompt injection via document text steering metadata extraction | Tampering / Elevation | The extraction system prompt already isolates field descriptions as data (`embedding_service.py:331`); the ladder does not change the message assembly. |
| Fabricated artifact passed off as a real emission (the honesty guarantee) | Spoofing | Every rung validates against the schema; the honest-fail floor returns `emitted=None` (never prose-as-artifact); the executor surfaces an honest failure receipt. This is the load-bearing trust property the whole phase protects. |
| SQL injection via the new eval matrix | Tampering | The forced-emit matrix uses the fixed-allowlist constant-query pattern (`_COUNT_QUERIES`/`_WORKFLOW_QUERIES`) with parameterized `%s` only — extend, never interpolate a table/identifier. |

## Sources

### Primary (HIGH confidence — live code, this session)
- `backend/app/services/forced_emit.py` — the ladder home: tier-resolution `:245-249`, `_COERCE_DIRECTIVE` `:59`, `recover_narrated_emission` `:98`, single sealed `open_stream` `:339`, truncation guard `:348`, provider-error wrap `:341-345`, cross-provider key/base_url injection `:251-291`, `strict` plumbing `:248`
- `backend/app/config.py` — `ModelCapability` TypedDict `:136-182`, `MODEL_CAPABILITIES` `:207-337` (55 rows; 50 `forced_emission:True`; 16 `strict_json_schema:True` = 14 OpenAI + 2 DeepSeek), `get_model_capability` `:464-486`, `_SUB_AGENT_MODEL_DEFAULTS` `:672-682`
- `backend/app/services/openai_service.py` — forcing branch `:1534-1581` (function-level strict `:1548`, `provider=="openai"` gate `:1555`), DeepSeek thinking-off `:1521-1526`, `execute_code.description` field `:601-603`
- `backend/app/services/provider_gateway/{dispatcher,anthropic,google,openai_compat}.py` — `GatewayRequest.force_tool_name/strict_schema` `:83-84`; Anthropic forced tool_choice `:71-75`; Google mode=ANY `:76-85`; openai_compat passthrough `:392-405`; the D-14 shared-chunk-handler RED LINE
- `backend/app/services/agent_loop.py:461-548` — `SYSTEM_PROMPT` (the nudge site; `execute_code` guidance `:497-501`)
- `frontend/src/lib/workspacePanel.ts:90-186` — `inferLabel()` + `humanize()` precedence (`description > inferLabel(code) > "Run code"`; non-code tools → `PRETTY_TOOL_NAMES[name] ?? name`)
- `scripts/eval_cross_provider.py` — full driver: `PROVIDERS` `:82-93`, `NATIVE_7` `:140`, `assert_localhost_only` `:423`, `emit_capability_table` `:1142`, argparse `:1284`
- `.planning/eval/README.md` + `capability-table-2026-06-07.{json,md}` — the artifact format + grep ritual
- The 4 `forced_emit` consumers — `phase_types.py:1189`, `publish_service.py:710`, `validator_kinds.py:462`, `workflow_authoring.py:434`, `embedding_service.py:335` (the metadata caller already passes `strict=False` yet still goes dark — `:344`)
- `backend/tests/unit/test_forced_emit.py` + `test_103_forced_emit_strict.py` — the `_patch_gateway` fixture + `strict_schema` request-capture pattern the MP-01/MP-02 tests extend
- `.planning/reported-bugs/BUG-260615-01-*` (MP-01/MP-02 live evidence) + `non-anthropic-generic-code-task-descriptions.md` (TDP-01) + `BUG-260616-01-*` (111.1 adjacency)

### Secondary (MEDIUM-HIGH confidence — official provider docs, cross-checked with live code)
- OpenAI structured outputs / function calling strict mode (additionalProperties:false + all-required; not supported with parallel tools) — `[CITED: developers.openai.com/api/docs/guides/structured-outputs, /function-calling]`
- DeepSeek strict tool calling requires `base_url=https://api.deepseek.com/beta` + function-level `strict:true` + `additionalProperties:false`; plain JSON mode is `json_object` only (not schema enforcement) — `[CITED: api-docs.deepseek.com/guides/function_calling, /json_mode]`
- Moonshot/Kimi K2 tool-call guidance: `tool_choice` auto/none only (genuinely unforceable) — `[CITED: github.com/MoonshotAI/Kimi-K2 docs/tool_call_guidance.md; platform.kimi.ai]`
- MiniMax M2: named `tool_choice` forcing supported; `response_format` (json_object/json_schema) NOT supported via the OpenAI-compat endpoint — `[CITED: platform.minimax.io/docs/guides/text-m3-function-call; github.com/MiniMax-AI/MiniMax-M2.5 issue #4]`
- Google Gemini `function_calling_config(mode="ANY", allowed_function_names=[…])` = forced function call — `[CITED: ai.google.dev/gemini-api/docs/interactions/function-calling]`
- Anthropic: forced `tool_choice` (type=tool/any) is INCOMPATIBLE with extended thinking → forced emit must run thinking OFF (the adapter already does) — `[CITED: docs.claude.com/en/docs/build-with-claude/extended-thinking]`
- OpenRouter `require_parameters` (route only to providers supporting all params) + named `tool_choice` forcing — `[CITED: openrouter.ai/docs/api/reference/parameters, /guides/features/tool-calling]` (relevant to MP-04/Phase 129, noted for the conditional-forcing rows)

### Tertiary (LOW confidence — flagged for live validation)
- Z.ai/GLM exact `tool_choice`/`response_format` semantics (the docs page didn't expose specifics via WebFetch) — grounded instead by live registry (`forced_emission:True`, no strict) + the OpenAI-only `:1555` gate → `force`; the live HARD-schema scoreboard force/recovery axis confirms (A2).

## Metadata

**Confidence breakdown:**
- Standard stack (the edited surfaces): HIGH — every file/line read live this session
- Architecture (the ladder + registry migration + scoreboard extension + nudge): HIGH — grounded in live control flow; the 55-row migration is quantified exactly (14/2/34/5)
- Provider `emit_tier` declarations: HIGH for OpenAI/DeepSeek/Anthropic/Google/MiniMax/Moonshot (provider docs + live code agree); MEDIUM→LOW for Z.ai/GLM (docs opaque, but live code + scout note converge on `force`; scoreboard confirms)
- Pitfalls: HIGH — pinned to BUG-260615-01 live evidence + live code seams
- MP-03 driver mechanics: MEDIUM — the direct-call-vs-HTTP-route choice (Open Q2) is a plan-time decision; both reach `forced_emit`

**Research date:** 2026-06-23
**Valid until:** ~2026-07-23 (30 days — stable surfaces; provider strict/forcing semantics move slowly, but re-verify the `emit_tier` mapping against a fresh `--forced-emit` scoreboard run before any tier promotion, per D-122-05)

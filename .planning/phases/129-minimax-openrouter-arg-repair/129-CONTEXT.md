# Phase 129: MiniMax/OpenRouter Arg Repair - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Broader cross-provider tool-use robustness at the OpenAI-compatible adapter boundary, for two peripheral providers (MP-04):

1. **MiniMax** malformed tool-call arguments (the `minimax-m3-invalid-tool-args-400` class) are repaired/recovered at the adapter boundary so the run continues instead of dying with a 400.
2. **OpenRouter** requests carry `require_parameters` so a wider set of routed models honor the tool schema.

Backend-only. No frontend, no migration/schema change, no new API surface. STRETCH phase promoted to active 2026-06-26 after v3.1 CORE (120–124) shipped clean — selected as the highest-value STRETCH because it is the only one closing a live open bug.

**Out of scope:** mainstream providers (OpenAI/Anthropic/Google) get no behavior change; the `gpt4o-max-tokens-exceeds-completion-cap` bug (a token-cap mechanism, not arg-repair) is a separate future provider-polish item; real MiniMax model-side JSON quality is external (we harden our boundary, not the model).

</domain>

<decisions>
## Implementation Decisions

### MiniMax repair behavior
- **D-01 (repair fallback — retry-then-honest-fail):** When MiniMax sends tool-call args too garbled to repair at the boundary, **retry the model turn once** (re-ask it to re-emit the tool call); if it is still malformed, fail with the existing honest provider-error copy. This mirrors the Phase 122 force→coerce ladder and preserves run honesty — never a silent swallow, never a fabricated/partial dispatch. A **successful** repair surfaces a quiet "recovered" honesty signal consistent with the Phase 122 emit_tier / forced-emit scoreboard (recovery is visible, not hidden).
- **D-03 (repair breadth — MiniMax-scoped, reuse proven coercion):** The arg-repair guard is **provider-gated to MiniMax**, mirroring the existing `write_todos` stringified-args coercion (BUG-260529-01 precedent). No general OpenAI-compat-wide guard — other providers are unaffected and the shared request path is not forked (honors "provider fixes stay provider-scoped, never break shared paths").

### OpenRouter require_parameters
- **D-02 (scope — bundle into the existing 'quality' tool-strategy):** `require_parameters` is added **alongside the response-healing plugin already in the `openrouter_tool_strategy="quality"` path** (`openai_service.py` ~1611–1625). Additive, opt-in via the strategy the user already selects — no new Settings surface, no always-on behavior change for users on other strategies. This implements the already-documented-but-never-wired directive (config.py / D-15).

### Carried forward (NOT re-asked — locked by prior decisions / CLAUDE.md)
- **Provider-docs-first (evidence-based):** the researcher MUST pull MiniMax's OWN official function-calling docs (limits on arg size / JSON shape) AND a real LangSmith trace of an actual 400 BEFORE designing the repair. Hypothesis (M3 truncates/mis-escapes very large `execute_code.code` args) is unconfirmed — confirm with evidence first.
- **Provider-scoped, never break the shared path:** all handling stays at the `openai_service` adapter boundary; the shared chunk handler / SSE emitter / agent loop must stay byte-identical for other providers. SC#10 4-axis live UAT must prove no regression on OpenAI/Anthropic/Google.
- **OpenRouter is experimental / low priority:** only fix if native-safe + low-complexity (the 'quality'-strategy bundle satisfies this).

### Folded Todos
- **BUG-260607-03** (`minimax-m3-invalid-tool-args-400`, surface: Agentic-RAG, severity minor, status open) — MiniMax-M3 emits malformed tool-call args JSON on heavy `execute_code` prompts → API rejects round-trip with 400 → run fails. Its own `re_open_trigger` explicitly routes it to "a dedicated MiniMax service-boundary repair (args-JSON coercion/retry, provider-docs-first) when scoped" — i.e. THIS phase. SC#1 names the same bug class. Update its frontmatter to `status: folded`, `folded_into: 129` at plan-phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirement
- `.planning/ROADMAP.md` §"#### Phase 129: MiniMax/OpenRouter Arg Repair" — goal + 2 success criteria
- `.planning/REQUIREMENTS.md` — MP-04 (MiniMax malformed-args boundary repair + OpenRouter require_parameters)

### The folded bug + evidence
- `.planning/reported-bugs/minimax-m3-invalid-tool-args-400.md` (BUG-260607-03) — observed 400, run row `2c711ee4`, the write_todos-coercion precedent, the provider-docs-first requirement, the M2.5-highspeed workaround

### Code to read (the adapter boundary)
- `backend/app/services/openai_service.py` — the OpenAI-compat request-build path; the OpenRouter strategy block (~1419–1625, where `require_parameters` slots next to the `response-healing` plugin under `extra_body`); MiniMax routes through this same path
- `backend/app/config.py` — the curated registry (096-08 provenance) + the documented-but-unwired `require_parameters` / D-15 note
- The `write_todos` stringified-args coercion (BUG-260529-01) — the proven boundary-coercion pattern D-03 mirrors (grep `write_todos` arg coercion in the dispatch/adapter path)

### Project rules
- `CLAUDE.md` — "Provider-docs-first (evidence-based)" rule; "Multi-worker / shared-path" guidance; SC#10 UAT scoreboard recipe (cross-provider × multi-tool × parallel-thread × long-message)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`write_todos` stringified-args coercion** (BUG-260529-01) — the existing adapter-boundary guard that coerces a provider's stringified/escaped tool-args back into valid JSON; D-03 mirrors this pattern, MiniMax-gated.
- **OpenRouter `extra_body` strategy block** (`openai_service.py` ~1419–1625) — already injects `{"id": "response-healing"}` under `openrouter_tool_strategy="quality"`; `require_parameters` is added in the SAME block (D-02), so no new code path.
- **Phase 122 force→coerce ladder + emit_tier honesty signals** — the precedent for D-01's retry-then-honest-fail behavior and the quiet "recovered" signal on a successful repair.

### Established Patterns
- Provider-specific handling lives at the `openai_service` adapter boundary, never the shared chunk handler / SSE emitter / agent loop.
- Honesty over silence: recovered/coerced/failed states are surfaced (122 scoreboard), never swallowed.

### Integration Points
- MiniMax arg-repair: the OpenAI-compat request-build / tool-call round-trip in `openai_service.py` (provider-gated to MiniMax).
- OpenRouter `require_parameters`: the existing `openrouter_tool_strategy="quality"` `extra_body` assembly.

</code_context>

<specifics>
## Specific Ideas

- The "recovered" signal on a successful MiniMax repair should match the existing Phase 122 honesty vocabulary (emit_tier / forced-emit scoreboard), not invent a new one.
- Confirm the offending arg is the large `execute_code.code` payload via a real LangSmith trace before assuming truncation vs mis-escaping — the fix differs (re-encode vs re-request).

</specifics>

<deferred>
## Deferred Ideas

- **General (all-provider) adapter-boundary arg-repair guard** — considered for D-03; deferred to keep this phase provider-scoped and off the shared path. Re-open if a second OpenAI-compat provider exhibits the same malformed-args class.
- **`gpt4o-max-tokens-exceeds-completion-cap`** (open, surface: Agentic-RAG) — a token-cap mechanism in provider-routing/MODEL_CAPABILITIES, NOT arg-repair; reviewed and NOT folded — belongs in a separate provider-routing polish item.
- **Reviewed Todos (not folded):** `spike-nl-workflow-authoring.md` (todo.match score 0.4) — matched only on generic keywords ("2026, schema"); unrelated to provider arg-repair. Not folded.

</deferred>

---

*Phase: 129-minimax-openrouter-arg-repair*
*Context gathered: 2026-06-27*

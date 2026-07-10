# Phase 129: MiniMax/OpenRouter Arg Repair — Discussion Log

**Date:** 2026-06-27 (human-reference only; not consumed by downstream agents)

Promoted from STRETCH to active after v3.1 CORE (120–124) shipped clean. Selected via the v3.1 STRETCH assessment as the highest-value STRETCH (the only one closing a live open Agentic-RAG bug). ROADMAP heading reformatted `#### Phase 129 (STRETCH): …` → `#### Phase 129: …` so the GSD SDK could resolve the phase (the `(STRETCH)` qualifier broke the `Phase N:` parser).

## Reported-bugs cross-check (CLAUDE.md)
- **Folded:** `minimax-m3-invalid-tool-args-400` (BUG-260607-03) — its re_open_trigger names this exact phase.
- **Reviewed, not folded:** `gpt4o-max-tokens-exceeds-completion-cap` (different mechanism — token cap, not arg-repair).
- Other open Agentic-RAG reports are frontend/harness/title-gen — out of domain.

## Decisions

| # | Area | Options presented | Chosen |
|---|------|-------------------|--------|
| D-01 | MiniMax repair fallback | retry-once-then-honest-fail (rec) / fail-fast honest / best-effort partial | **Retry once, then fail honestly** (+ quiet "recovered" signal on success, consistent with 122) |
| D-02 | OpenRouter require_parameters scope | bundle into 'quality' strategy (rec) / always-on / new Settings toggle | **Bundle into the existing 'quality' tool-strategy** |
| D-03 | MiniMax repair breadth | MiniMax-scoped reuse coercion (rec) / general adapter guard | **MiniMax-scoped, reuse the write_todos coercion pattern** |

All three chosen as recommended — a tight, provider-scoped, additive phase that stays off the shared path.

## Carried forward (not re-asked)
Provider-docs-first (pull MiniMax official function-calling docs + a real LangSmith 400 trace before designing the repair); provider-scoped/never-break-shared-path; OpenRouter is experimental/low-priority.

## Deferred
General all-provider arg-repair guard (re-open if a 2nd provider shows the same class); `gpt4o-max-tokens` token-cap bug (separate item).

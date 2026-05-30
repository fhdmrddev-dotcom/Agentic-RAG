---
quick_id: 260530-wvt
description: Fix title-gen stuck on "New Chat" — strip <think>, derive title from message, bump Google budget
created: 2026-05-30
mode: quick
---

# Quick Task 260530-wvt: Fix thread-title generation across reasoning providers

## Problem (root cause confirmed in this session's diagnosis)

Thread titles were stuck on the literal `New Chat` for deepseek/moonshot/google and echoed the raw message for minimax. NOT a wrong-model-name bug (that fix shipped in 083 via `_SINGLE_MODEL_PROVIDERS`). Real causes in `generate_thread_title` (backend/app/api/threads.py):
1. **Tiny token budget** (`30`, `60` for Google) starves reasoning models — they spend the budget on hidden reasoning and return empty content → code stored bare `'New Chat'`.
2. **No `<think>` handling** — minimax (and GLM-4.6+) emit `<think>…</think>` inline in `content`; the len>60 guard rejected it → fell back to the raw user message.
3. **Bare `'New Chat'` fallback** on empty content instead of a useful derived title.

## Tasks

### Task 1 — Robust title extraction + derived fallback
- **files:** backend/app/api/threads.py
- **action:** Add `_strip_think_blocks` (closed + unclosed `<think>`), `_derive_title_from_message` (first line, first ~8 words, ≤50 chars — never bare 'New Chat'), and `_clean_llm_title` (strip think/markdown/quotes/refusals → derive on empty). Rewire both LLM paths (primary + 404-fallback) and the final `except` + NotFoundError no-fallback returns to use these.
- **verify:** reasoning models with empty content → derived title, not 'New Chat'; minimax `<think>` stripped → derived; cooperative models → cleaned LLM title.
- **done:** no provider returns bare 'New Chat' or a `<think>`-buried title.

### Task 2 — Google token budget
- **files:** backend/app/api/threads.py
- **action:** Bump `_title_max_tokens` (primary + 404-fallback) for Google `60 → 160` so Gemini emits a full 4-6 word title instead of truncating. Keep `30` for other providers (non-reasoning emit fine; reasoning return empty fast and fall back — no added first-message latency, since title-gen blocks the producer spawn).
- **verify:** google (gemini-2.5-flash) returns a full multi-word title.
- **done:** Google no longer truncates to one word.

## Verification (done — direct calls to generate_thread_title, real API, prompt "generate weekly report")

| model | result |
|---|---|
| deepseek-v4-flash | `generate weekly report` (derived) ✓ |
| kimi-k2.6 | `generate weekly report` (derived) ✓ |
| minimax-m2.7 | `generate weekly report` (think stripped → derived) ✓ |
| MiniMax-M2.7 | `generate weekly report` ✓ |
| glm-4.6 | `Generate a weekly report` (real LLM title) ✓ |
| google / gemini-2.5-flash | `Generate Weekly Report Summary` (real LLM title) ✓ |

`py_compile` passes. Backend `--reload` picked up the change live. This is the exact code path `POST /threads/{id}/messages` calls at run-start.

## Closes
- BUG-260527-01 / `title-generation-broken-deepseek-moonshot-google.md`
- CF-01 C1 (title-gen carry-forward, was deferred to Phase 093 — done here instead)

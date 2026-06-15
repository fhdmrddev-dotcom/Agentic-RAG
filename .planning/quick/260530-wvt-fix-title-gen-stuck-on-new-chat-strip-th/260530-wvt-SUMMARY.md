---
quick_id: 260530-wvt
status: complete
completed: 2026-05-30
commit: 80f255c6
---

# Summary: Title-gen fix (260530-wvt)

## What changed

`backend/app/api/threads.py` — `generate_thread_title`:
- Added `_strip_think_blocks` (removes closed `<think>…</think>` and unclosed trailing `<think>`), `_derive_title_from_message` (clean short title from the first user message — never bare 'New Chat'), and `_clean_llm_title` (strips think/markdown/quotes/refusals, derives on empty).
- Rewired both LLM paths (primary + 404-fallback), the NotFoundError no-fallback returns, and the final `except` to use these helpers.
- Bumped Google's title budget `60 → 160` (primary + fallback); other providers stay `30`.

## Why

Titles stuck on `New Chat` (deepseek/moonshot/google) or echoed the raw message (minimax). Root cause: a tiny token budget starved reasoning models into empty content, `<think>` was never stripped, and empty content fell back to the bare 'New Chat' sentinel. The "wrong model name" theory was disproven (that fix shipped in 083). Latency-safe: reasoning providers keep the small budget (fast empty → instant derived title), since title-gen blocks the producer spawn at run-start.

## Verification (direct generate_thread_title calls, real API)

All six cases return a sensible non-'New Chat' title (prompt "generate weekly report"):
- deepseek-v4-flash / kimi-k2.6 / minimax-m2.7 / MiniMax-M2.7 → `generate weekly report` (derived)
- glm-4.6 → `Generate a weekly report` (real LLM title)
- google gemini-2.5-flash → `Generate Weekly Report Summary` (real LLM title; 160-tok bump fixed the truncation)

`py_compile` passes; backend `--reload` applied it live. Same code path the `POST /threads/{id}/messages` endpoint runs.

## Commit

`80f255c6` — fix(title-gen): strip `<think>`, derive title from message instead of bare 'New Chat', bump Google budget to 160

## Closes
- BUG-260527-01 / `title-generation-broken-deepseek-moonshot-google.md` (folded here, verified)
- CF-01 C1 title-gen carry-forward (was earmarked Phase 093 — closed here instead)

## Note
`app_settings.title_drafting_config` remains unwired (would let the title model/budget be operator-configurable) — left to the model-registry self-service work (SEED-040).

---
status: complete
phase: 115-virtual-folders-agent-tool
source: [115-VERIFICATION.md, 115-VALIDATION.md]
started: 2026-06-20
updated: 2026-06-20
---

## Current Test

[testing complete]

## Tests

> Run Claude-driven against the live local stack (backend :8000 + Supabase :54322 + frontend :5173),
> driving the REAL Deep agent loop via the authenticated chat endpoint (`POST /threads/{id}/messages`,
> agent_mode=default). Seeded two grounded saved views on the real 36-doc corpus:
> **Reports** (document_type=report → 11 docs) and **Dana's Docs** (author="Dana Whitfield" → 10 docs).
> Emission verified deterministically via each run's `query_documents_by_view` tool_call + args + the
> model's answer + the `search.query` audit row tagged `via:view/filter`.

### 1. Cross-provider tool emission (SC#1 + SC#3 — the native-7 scoreboard)
expected: Each provider's live model emits a `query_documents_by_view` call and fills the polymorphic `view`-XOR-`filter` arg correctly (catalog / saved-view / inline-filter). Gemini must not 400 (the anyOf/oneOf-free schema proof); MiniMax is the watch-point.
result: pass
notes: |
  **8/8 providers PASS** (after an in-session fix — see Gaps). Each emitted `query_documents_by_view`
  with the correct arg and the model reported the correct leak-safe totals (Reports=11, Dana's Docs=10,
  financial-report inline-filter=4):
  - openai (gpt-5.4-mini): emit `{view:Reports}` → "11 documents" ✓  (gpt-4o separately 400s on a
    PRE-EXISTING max_tokens 32768>16384 model-config clamp gap — unrelated to 115; gpt-5.4-mini clean)
  - anthropic (claude-sonnet-4-6): catalog + `{view:Reports}` ✓
  - google/Gemini (gemini-2.5-flash): **initially FAILED** with a 400 ValidationError on the schema
    type-array → FIXED in-session (provider-boundary collapse) → re-verified: emit `{view:Reports}` →
    "exactly 11 documents" ✓
  - deepseek (deepseek-v4-pro): emit `{view:Reports}` → "exactly 11 documents" ✓
  - moonshot (kimi-k2.6): all 3 modes incl. inline `{filter:document_type=financial report}` ✓
  - zhipu (glm-5.1): emit `{view:Reports}` ✓
  - minimax (MiniMax-M2.7): emit `{view:Reports}`, **no 400** (watch-point clear) ✓
  - openrouter (deepseek/deepseek-v4-pro backstop): emit `{view:Reports}` ✓

### 2. Multi-tool prompt (SC#3 — two retrieval lanes coexist)
expected: One prompt routes to `query_documents_by_view` (the exhaustive list) AND `search_documents` (the semantic passage), not search for the list step.
result: pass
notes: |
  openai/gpt-5.4-mini emitted BOTH `query_documents_by_view` AND `search_documents` (plus `write_todos`
  for planning) in one turn — the two retrieval lanes coexisted and routed correctly (D-115-5 held).

### 3. Parallel-thread isolation (SC#3 — no cross-thread bleed)
expected: Thread A streaming a view-tool answer while Thread B sends a new prompt; no cross-thread bleed in tool rows / source_refs.
result: pass
notes: |
  Fired two threads ~concurrently: Thread A `{view:Reports}` → "Reports view contains 11 documents";
  Thread B `{view:Dana's Docs}` → "Dana's Docs view contains 10 documents". Each thread kept its OWN
  view arg + answer under concurrency — no swap, no bleed.

### 4. Long-message robustness (SC#3 — long-context tool emission)
expected: A ≥5 KB prompt ending in the view-tool call — tool still fires + arg fills correctly (no truncation-induced mis-fill).
result: pass
notes: |
  A 6.6 KB prompt (5 KB filler + the view request) → the model still emitted `{view:Reports, limit:50}`
  and answered "Reports view contains 11 documents" — no truncation mis-fill.

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The query_documents_by_view tool schema is cross-provider-safe — every native-7 provider (incl. Gemini) can construct the Tool and emit the call."
  status: resolved
  severity: blocker
  test: 1
  found: |
    The SC#10 Gemini row FAILED — every Google/Gemini Deep run 400'd with
    `ValidationError: filter.conditions.items.properties.value.type — Input should be 'TYPE_UNSPECIFIED','STRING',...`.
    Root cause: the schema's filter.conditions[].value/value2 use a JSON-Schema type-ARRAY
    ["string","number","boolean","null"]; `google_service._translate_nullable_type` only collapsed the
    2-element [X,"null"] case, so the multi-type array passed through and google-genai's Pydantic Tool
    validation rejected the whole Tool (taking down ALL Gemini Deep tool use, since Google validates the
    Tool as a unit). Avoiding anyOf/oneOf was necessary but NOT sufficient; the static schema test only
    checked anyOf/oneOf, so verify + secure + validate all passed while Gemini was broken — the live UAT
    caught it ("static would false-green").
  fix: |
    commit a5b0b917 — generalized `_translate_nullable_type` (Google provider boundary ONLY; shared
    OpenAI/Anthropic schema untouched per CLAUDE.md) to collapse ANY list-valued `type` to its first
    non-null member + nullable when "null" present. Live-re-verified Gemini: failed → completed, emit
    {view:Reports} → "11 documents". 3 regression tests added (test_075_5_google_native.py); 115 suite +
    google-native 46 passed / 1 intentional xfail. Cross-provider now 8/8.

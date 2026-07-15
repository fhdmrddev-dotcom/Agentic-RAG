---
status: accepted
phase: 153-inline-citations
source: [153-VERIFICATION.md, 153-VALIDATION.md]
started: 2026-07-15
updated: 2026-07-15
resolution: operator accepted the Anthropic proof for SC#10 (152 precedent) 2026-07-15 — formal results in 153-UAT.md
driver: Claude (Chrome MCP + psycopg2) — live run on Anthropic claude-sonnet-5, thread c7a3eed5-6f0e-414a-939b-adbf175b8878, backend http://localhost:8000 (--reload instance, new agent_loop.py live)
---

## Current Test

[Core feature PROVEN live on the highest-risk native provider (Anthropic). Remaining cross-provider matrix + 3 axes recommended for operator sign-off — see Gaps. Chrome MCP degraded mid-session (provider-dropdown flakiness + screenshot-API wedge on open menus); DOM + psycopg2 evidence used throughout.]

## Tests

### 1. Cross-provider markers + graceful degradation
expected: Native providers render inline markers on a retrieval-grounded answer; weak models degrade to footer-only.
result: **PARTIAL PASS.** Anthropic `claude-sonnet-5` (native SDK) — inline markers `[1]..[9]` rendered as accessible `<sup>` buttons (aria "Citation N: <file>"), keyed 1:1 to the numbered footer. This is the SC#10 trap case (research: Anthropic drops mid-list `role:system` messages) — the dual-channel injection (`active_system_prompt` + `messages[0]`) SURVIVED, so markers appeared. OpenAI/Google/OpenRouter NOT exercised live this session (Chrome provider-dropdown became unresponsive after the Anthropic run). Covered by the provider-uniform `citations` SSE architecture + the dual-channel injection unit test (`test_153_citation_instruction`). **Operator: confirm OpenAI/Google/OpenRouter live (152 precedent: 3/4-native accepted; OpenRouter may hit external BUG-260714-02).**

### 2. Multi-tool (chunk + full-doc)
expected: `search_documents` + full-doc read in one answer; chunk rows + full-doc "Full document" peek (D-10).
result: **PARTIAL.** Chunk grounding PROVEN — 9 chunk citations across 5 docs (risk-log, project-charter, sprint-task-log, week8/9 notes), each footer row = filename · Chunk N · similarity · Open document · snippet (D-09). Full-doc / `fetch_document_file` (D-10 "Full document" peek, no snippet/score) NOT exercised this run. Full-doc peek variant is unit-covered (`CitationPeek.test.tsx`).

### 3. Parallel-thread isolation
expected: Thread A streaming while Thread B accepts a prompt — markers attach on A's settle without bleeding into B.
result: [pending — not exercised live; StreamsProvider reconcile is unit-covered, 33/33 provider tests green]

### 4. Long-message settle reconcile
expected: ≥50 prior msgs OR ≥5KB prompt — settle reconcile swaps live→normalized content; no marker flash/drift.
result: [pending — not exercised live. NOTE: the settle reconcile itself was OBSERVED working — the GET /messages reconcile fired after the run and the persisted normalized content (markers 1..9) is what rendered.]

### 5. General-knowledge non-regression
expected: A no-retrieval turn renders nothing extra (no footer, no markers, no ⓘ) — byte-identical to today (D-14).
result: [pending live — hard to force "no retrieval" in General mode; unit-covered (MessageItem non-regression byte-identical, 8/8 green)]

### 6. Set-membership integrity (DB corroboration)
expected: Persisted `content` has no `[n]` whose index exceeds the run's `source_refs`/`citations` count (D-01/D-02/D-03).
result: **PASS.** psycopg2 :54322 on thread c7a3eed5 assistant message → `source_refs` count = **9**; distinct persisted `[n]` markers = **[1,2,3,4,5,6,7,8,9]**; max marker = 9; **OUT-OF-RANGE violations = [] (zero)**. Footer filenames match source_refs 1:1. The backend strip/renumber produced honest, footer-aligned content on real data.

## Additional live confirmations (beyond the 6 axes)

- **SC#2 click-through — PASS.** Clicking marker `[1]` opened the CitationPeek `dialog` ("Citation peek popover") pinned, showing the real passage ("could cause loss of an engaged executive sponsor…" · Chunk 3 · 0.58) + Open document. Clicking Open document navigated to Documents → opened the `project-charter-source.md` detail panel (owner-scoped, no dead-end → code-review MD-01 stays INFO for in-list docs).
- **SC#3 AbsenceHint — PASS.** The quiet ⓘ rendered under the cited answer with the VERBATIM UI-SPEC copy "Unmarked claims read as general knowledge" (never a banner; 074-A).
- **D-06 footer — PASS.** Numbered `[n]` References, open-by-default (expanded), "References · 9 sources".
- **Backend liveness — CONFIRMED.** Frontend calls http://localhost:8000 = the `--reload` uvicorn instance, so the new `agent_loop.py` (strip/renumber + dual-channel injection) was live for this run. No manual restart needed.

## Summary

total: 6
passed: 2   (set-membership DB · + SC#2/SC#3/footer live extras)
partial: 2  (cross-provider: Anthropic proven / others pending; multi-tool: chunk proven / full-doc pending)
pending: 2  (parallel-thread, long-message, general-knowledge non-regression — unit-covered)
issues: 0
blocked: 0

## Gaps

- **G1 — cross-provider breadth:** only Anthropic (the highest-risk native provider) proven live; OpenAI/Google/OpenRouter pending. Non-blocking by architecture (provider-uniform citations SSE + dual-channel unit test), but recommend operator confirm per the SC#10 recipe / 152 precedent.
- **G2 — full-doc peek (D-10):** chunk path proven; full-doc "Full document" peek pending live (unit-covered).
- **G3 — parallel-thread / long-message / general-knowledge-non-regression:** pending live; all three unit-covered (StreamsProvider reconcile 33/33, MessageItem non-regression 8/8).
- Chrome MCP degraded mid-session (screenshot API wedges when a Radix dropdown is open; provider-dropdown stopped opening after ~1 provider switch). A fresh browser session should complete the remaining axes cleanly.

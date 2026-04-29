# Requirements: Agentic RAG

**Defined:** 2026-04-22
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared

## v2.4 Requirements

Requirements for Stability, Polish & UX Fixes milestone. Each maps to roadmap phases.

### STREAM — SSE & Stop Reliability

- [x] **STREAM-01**: User can stop a streaming response and the backend SSE generator cancels immediately (no linger, no "saving response…" text stuck in UI) — *Phase 44 complete; KI-001: in-flight LLM call runs to current yield point before stopping (known, accepted)*
- [~] **STREAM-02**: Navigating away or refreshing during an active stream disconnects gracefully without server errors — *Phase 55 partial + Phase 57 deferred; code shipped (threadChannelRef, finally-block reload, visibilitychange); browser tests E/F unreliable. See 057-DEFERRAL.md for next-milestone approach.*
- [x] **STREAM-03**: Partial assistant responses are persisted when stop is triggered, so the user sees their partial answer after page reload — *Phase 44 stop indicator + Phase 55 asyncio.shield complete*

### SKILL — Smart Skill Dispatch

> **Deferred to Skills Studio milestone.** Removed from v2.4 scope to avoid fragmented schema migrations. Will ship as Phase 1 of the Skills Studio milestone alongside the full eval/iteration feature set.

- [ ] **SKILL-01**: Skill catalog injection uses relevance-based filtering — only skills whose descriptions match the user's message are included in the system prompt *(Skills Studio milestone)*
- [ ] **SKILL-02**: Skills that don't match the user's intent are never triggered, even if they exist in the catalog *(Skills Studio milestone)*

### DOC — Document Management

- [x] **DOC-01**: User can choose between "delete this version only" and "delete all versions" when deleting a document — *Phase 46 complete; human UAT pending (dialog rendering)*
- [x] **DOC-02**: Deleting a single version cleans up its chunks and storage file, and promotes the next-latest version as is_latest — *Phase 46 complete; human UAT pending (non-contiguous promotion)*
- [x] **DOC-03**: Deleting all versions removes all chunks, storage files, and version history for that filename — *Phase 46 complete; human UAT pending (CASCADE verify)*
- [x] **DOC-04**: Root-folder documents (folder_id=null) are clearly visible in the document list and folder tree — *Phase 47 complete*
- [x] **DOC-05**: Upload errors display specific reasons to the user (duplicate file, unsupported type, empty file, size limit exceeded) — *Phase 47 complete*
- [x] **DOC-06**: Uploading to root folder works correctly with clear UX or is explicitly gated with an informative message — *Phase 47 complete*

### CHAT — Chat UX

- [x] **CHAT-01**: Deleting a thread shows a confirmation dialog before the delete executes — *Phase 45 complete*
- [x] **CHAT-02**: After deleting a thread and creating a new one, no ghost content from the deleted thread appears — *Phase 45 complete*
- [x] **CHAT-03**: Creating a new chat presents a folder selector to scope the thread from the start — *Phase 45 complete*

### SETT — Web Search Toggle

- [x] **SETT-01**: Web search has an explicit on/off toggle in Settings (like code execution and reranking), separate from API key presence — *Phase 48 complete; human UAT pending (visual toggle)*
- [x] **SETT-02**: When web search is toggled off, the web_search tool is excluded from the agent's tool set regardless of API key — *Phase 48 complete; confirmed in openai_service.py gate*

### NAV — Navigation Polish

- [x] **NAV-01**: Icon labels appear directly adjacent to their icons in the expanded sidebar (no large gap between icon and text) — *Phase 48 complete; human UAT pending (visual check)*
- [x] **NAV-02**: When the sidebar is collapsed, the logo icon remains visible (icon-only, no text) — *Phase 48 complete; human UAT pending (visual check)*

### HLTH — Library Health at Scale

- [x] **HLTH-01**: Knowledge Health dashboard uses server-side pagination instead of fixed top-10 lists — *Phase 49 complete, verified*
- [x] **HLTH-02**: Low confidence panel explains that scores reflect query-document relevance, not document quality; includes context about score distribution — *Phase 49 complete, verified*
- [x] **HLTH-03**: Feedback empty states use actionable, corporate-appropriate messaging (not passive phrases like "No downvoted documents") — *Phase 49 complete, verified*
- [x] **HLTH-04**: Knowledge Health API accepts pagination parameters (offset/limit) and returns total counts — *Phase 49 complete, verified*

### CTX — Context Window Management

- [x] **CTX-01**: Sub-agent detects generation tasks (PPTX, reports, drafting) via keyword routing and escalates to the capable model tier (Sonnet / GPT-4o / Gemini Flash) with a 32k output ceiling instead of the cheap model with 8k — *Phase 51 complete, verified*
- [x] **CTX-02**: Simple analysis tasks (summarise, extract, list, compare) continue to use the cheap sub-agent model — escalation only fires for creation/generation verbs — *Phase 51 complete, verified*
- [x] **CTX-03**: Settings page exposes a context history depth slider (maps to `context_window_max_tokens`), a sub-agent output token slider (maps to `sub_agent_max_output_tokens`), and a sub-agent model override dropdown — *Phase 51 complete, verified*
- [x] **CTX-04**: Each model entry in the model selector shows an inline info card with: context window size, max output tokens, cost tier, and best-use-case label — populated from a static per-model lookup, no API call — *Phase 51 complete, verified*
- [x] **CTX-05**: Token estimation for OpenAI models uses `tiktoken` (cl100k_base) for accurate counts; other providers fall back to the existing char heuristic with a documented margin note — *Phase 51 complete, verified*

### MDL — Multi-Provider Model Routing

- [x] **MDL-01**: Sub-agent model override cannot be saved if the model ID is not in the active provider's configured model list — Settings blocks save with inline error: "Model [X] is not available for provider [Y]." — *Phase 52 complete; integration wiring confirmed*
- [x] **MDL-02**: Title-drafter and follow-up-suggester agents use the provider-default cheap model from `_SUB_AGENT_MODEL_DEFAULTS[active_provider]` (not hardcoded to a specific provider) — *Phase 52 complete; both sub-agent callers verified*
- [x] **MDL-03**: Message history is preserved when the user switches chat models mid-conversation — messages are stored in DB by thread_id only, no model-keyed lookup or clear occurs — *Phase 52 complete; confirmed no `.eq("model")` filter in threads.py*
- [x] **MDL-04**: When a sub-agent call returns HTTP 404 (model not found), the app retries with the provider's default cheap model and emits a `fallback_model` SSE event; frontend shows a brief toast "Model [X] unavailable — using [Y]." — *Phase 52 complete; fallback_model SSE → fallbackNotice banner wired*
- [x] **MDL-05**: Settings clearly exposes which model each agent role uses — the GET /api/settings response includes `resolved_sub_agent_model`, and the Settings UI shows read-only label rows for title drafting and follow-up suggestions — *Phase 52 complete; integration wiring confirmed*

### TOOL — Cross-Provider Tool Calling

- [x] **TOOL-01**: Tool calling works reliably across OpenAI, Anthropic, and OpenRouter — MODEL_CAPABILITIES registry routes to native or structured mode; deterministic JSON parser for non-native models; zero regression for OpenAI — *Phase 53 complete, verified (32+ tests pass)*

### GEN — Reliable Agentic Generation

- [x] **GEN-01**: No 20% token reduction applied to model context — `effective_tokens = resolved_tokens` — *Phase 54 complete, verified*
- [x] **GEN-02**: Anthropic models use the native Anthropic SDK with prompt caching — `anthropic_service.py` + dispatch in threads.py — *Phase 54 complete, verified*
- [x] **GEN-04**: Agent max iterations configurable (15 general / 8 explorer) — *Phase 54 complete, verified*
- [x] **GEN-05**: Native providers (Anthropic, Google) bypass the `_resolve_max_tokens` cap; Settings hides output token slider for those providers — *Phase 54 complete, verified*

## v3.0 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Skills System Overhaul

- **SKILL-03**: Full skills marketplace and discovery system
- **SKILL-04**: Skill versioning and dependency management
- **SKILL-05**: Skill sharing and collaboration features

## Out of Scope

| Feature | Reason |
|---------|--------|
| In-document PDF highlighting (F-01 v2) | Requires PDF renderer integration; citation cards sufficient for v2.2 |
| Citation export / cross-thread citation linking | Complexity vs. value; defer |
| Diff view between document versions | Nice-to-have; version history + restore covers core need |
| Per-claim confidence scoring | Too granular; response-level confidence sufficient |
| Organisation-level audit view / SIEM integration | Single-user audit sufficient; no multi-tenant yet |
| Suggestions in Explorer mode | Explorer is KB-focused tool mode; follow-ups add noise |
| Multi-tenancy / Org-level transform | Requires clarity on isolated vs co-tenant architecture and auth/billing model |
| Automatic local folder scanning/import | Phase II feature, adds complexity |
| Team-based folder sharing with access controls | Keep it simple: global or private only |
| Real-time collaboration on folders | Not needed for current use case |
| Folder-level permissions | Global folders visible to all, per-user folders private |
| Switching to Docling | Existing pypdf + python-docx pipeline is working |
| Nyquist VALIDATION.md compliance | Phase-level validation files in draft state; full compliance deferred |
| Comprehensive skills system overhaul | Planned for next milestone; this milestone only fixes dispatch relevance |
| Per-provider sub_agent_model storage (keyed dict) | Requires schema migration; deferred until Settings redesign |
| Separate title_model / followup_model dropdowns | Read-only labels sufficient for v2.4; deferred |
| Fallback for main chat model | Sub-agent only per D-08; user chose main model and should see failures |
| Hardcoded cheap model for OpenRouter | Varies by user subscription; left as "" |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STREAM-01 | Phase 44 | Complete |
| STREAM-02 | Phase 55 + 57 | Partial (deferred — see 057-DEFERRAL.md) |
| STREAM-03 | Phase 44 + 55 | Complete |
| SKILL-01 | Skills Studio milestone | Deferred |
| SKILL-02 | Skills Studio milestone | Deferred |
| DOC-01 | Phase 46 | Complete (human UAT pending) |
| DOC-02 | Phase 46 | Complete (human UAT pending) |
| DOC-03 | Phase 46 | Complete (human UAT pending) |
| DOC-04 | Phase 47 | Complete |
| DOC-05 | Phase 47 | Complete |
| DOC-06 | Phase 47 | Complete |
| CHAT-01 | Phase 45 | Complete |
| CHAT-02 | Phase 45 | Complete |
| CHAT-03 | Phase 45 | Complete |
| SETT-01 | Phase 48 | Complete (human UAT pending) |
| SETT-02 | Phase 48 | Complete |
| NAV-01 | Phase 48 | Complete (human UAT pending) |
| NAV-02 | Phase 48 | Complete (human UAT pending) |
| HLTH-01 | Phase 49 | Complete |
| HLTH-02 | Phase 49 | Complete |
| HLTH-03 | Phase 49 | Complete |
| HLTH-04 | Phase 49 | Complete |
| CTX-01 | Phase 51 | Complete |
| CTX-02 | Phase 51 | Complete |
| CTX-03 | Phase 51 | Complete |
| CTX-04 | Phase 51 | Complete |
| CTX-05 | Phase 51 | Complete |
| MDL-01 | Phase 52 | Complete |
| MDL-02 | Phase 52 | Complete |
| MDL-03 | Phase 52 | Complete |
| MDL-04 | Phase 52 | Complete |
| MDL-05 | Phase 52 | Complete |
| TOOL-01 | Phase 53 | Complete |
| GEN-01 | Phase 54 | Complete |
| GEN-02 | Phase 54 | Complete |
| GEN-04 | Phase 54 | Complete |
| GEN-05 | Phase 54 | Complete |

**Coverage:** 37 requirements tracked — 34 complete, 1 partial (STREAM-02), 2 deferred (SKILL-01/02)

---
*Requirements defined: 2026-04-22*
*Last updated: 2026-04-30 — Ticked completed requirements, removed duplicate MDL section, fixed stale SKILL/STREAM traceability, added TOOL/GEN requirements from Phases 53/54*

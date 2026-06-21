---
phase: 115-virtual-folders-agent-tool
verified: 2026-06-20T00:00:00Z
status: passed
score: 3/3 must-haves verified + 4/4 live cross-provider human-UAT (115-HUMAN-UAT.md complete; SC#10 8/8 providers after the Gemini schema fix a5b0b917)
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Cross-provider tool emission — for each of OpenAI, Anthropic, Google/Gemini, DeepSeek, Moonshot/Kimi, Z.ai-GLM, MiniMax (+ OpenRouter backstop): (1) ask 'what saved views and filterable fields do I have?' in a Deep-mode chat, (2) ask 'open my Invoices view', (3) ask 'how many contracts expire within 90 days?'"
    expected: "Model emits a query_documents_by_view tool call each time, fills the polymorphic view/filter arg correctly, and returns a catalog / saved-view result / inline-filter result respectively. Gemini MUST NOT return a 400 (anyOf/oneOf-free schema proof). MiniMax result PASS or documented as known D-115-13 limitation."
    why_human: "Live multi-provider tool-emission behavior. Only a live model call proves 'the model actually SEEs and calls the tool'. Automated tests verify registry + get_tools wiring, not that a real model responds to the schema."
  - test: "Multi-tool prompt — send: 'list all my contracts, then find the indemnity clause in them.' in a single chat turn."
    expected: "Model calls query_documents_by_view for the 'list all' step AND search_documents for the passage-retrieval step. Must NOT use search_documents for the list step — the description's routing contrast should route correctly."
    why_human: "The two retrieval lanes must coexist without confusion. Only a live model proves correct tool-selection routing (D-115-5)."
  - test: "Parallel-thread — start a view-tool answer in Thread A (e.g., 'open my Invoices view'); while it streams, send a new prompt in Thread B."
    expected: "No cross-thread bleed in tool result rows or source_refs. Each thread's answer is scoped to its own run."
    why_human: "Per-thread isolation under concurrency is only observable live with actual concurrent streaming runs."
  - test: "Long-message — in a thread with >= 50 prior messages (or paste a >= 5 KB prompt), end with '...now open my Invoices view'."
    expected: "Tool still fires and the polymorphic arg still fills correctly (no truncation-induced mis-fill under long-context). TRUE total and truncation note appear as designed."
    why_human: "Long-context tool-emission behavior is only verifiable with a live model receiving a long conversation."
---

# Phase 115: virtual-folders-agent-tool — Verification Report

**Phase Goal:** Make saved views and metadata queries answerable in chat — the agent can run a view (saved or ad-hoc metadata query) as a tool to answer questions in chat. Extends the folderless/virtual-folders story into the conversational surface.
**Verified:** 2026-06-20
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC#1 — `query_documents_by_view` is registered in `tool_dispatcher._TOOL_REGISTRY` AND advertised in `openai_service.get_tools()`. Schema is cross-provider-safe: flat `view` XOR `filter`+`limit`, NO `anyOf`/`oneOf`. | VERIFIED | Registry: `tool_dispatcher.py:2584` contains `"query_documents_by_view": _handle_query_documents_by_view`. Schema: `openai_service.py:970` contains `QUERY_DOCUMENTS_BY_VIEW_TOOL` in the `get_tools()` assembly list. Schema JSON string contains zero `anyOf`/`oneOf` (one mention in a code comment only, grep confirmed). `view` and `filter` absent from `parameters.required`. Op-enum matches `ViewCondition.op` Literal exactly (11 values, set-equality asserted in `test_115_tool_schema.py`). |
| 2 | SC#2 — Tool resolves over CALLER's visible set only (no cross-user leak). Respects `ctx.phase_whitelist` via the `dispatch_tool` guard with no special-casing. `resolve_filter` is a single extracted core (no fork). `ResolveError` maps to a calm ToolResult (never raised into the loop). | VERIFIED | `document_view_resolver.py` is the sole resolve core (no duplicate in `document_views.py` — grep confirms `async def _resolve_filter` is 0 occurrences in the route module). Every documents leg uses `.eq("user_id", caller)` / `get_globally_visible_folder_ids(supabase, caller)` — never `view["user_id"]`. The `dispatch_tool` phase_whitelist guard at line 2621-2638 is generic; `_handle_query_documents_by_view` is never branched around it. `ResolveError` is caught at `tool_dispatcher.py:405` and mapped to `ToolResult(result=json.dumps({...}))`. The live two-user leak test (`test_115_tool_global_leak.py`) ran against :54322 and PASSED — disjoint per-viewer id+filename sets, differing totals, unknown-view → catalog (never 403). `ctx.folder_subtree_ids` is never passed into `resolve_filter` (confirmed: docstring at line 329-330, no code path in the handler uses it). |
| 3 | SC#3/SC#10 — The 4-axis cross-provider UAT (native-7 cross-provider, multi-tool prompt, parallel-thread, long-message) is AUTHORED in 115-VALIDATION.md. | VERIFIED | `115-VALIDATION.md` contains all 4 mandatory UAT rows in the "Manual-Only Verifications" section: (a) Cross-provider × catalog+saved-view+inline-filter across all native-7 providers; (b) Multi-tool (`query_documents_by_view` + `search_documents` in one prompt); (c) Parallel-thread with cross-thread bleed check; (d) Long-message (>= 50 prior messages or >= 5 KB prompt). All 4 rows include explicit test instructions, expected behavior, and why-human rationale. Live execution is a human-UAT item (classified correctly per the phase goal). |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/document_view_resolver.py` | Extracted `resolve_filter` + `ResolveError` + helpers; no FastAPI import | VERIFIED | File exists (345 lines). Exports `resolve_filter`, `ResolveError`, `_relative_window`, `_build_field_meta`, `_build_whitelist`. Zero `import fastapi` / `from fastapi` statements. `ResolveError` has `.detail` and `.status` attributes. Both former `HTTPException` raise sites now raise `ResolveError`. |
| `backend/app/services/tool_dispatcher.py` | `_handle_query_documents_by_view` handler + `_TOOL_REGISTRY` entry | VERIFIED | Handler at line 302-454. Registry entry at line 2584: `"query_documents_by_view": _handle_query_documents_by_view`. Lazy resolver bind via `_ensure_resolver()` at lines 151-171 breaks the import cycle. Three modes (catalog / saved-view / inline-filter) all implemented. `ResolveError` + Pydantic `ValidationError` caught and mapped to calm ToolResult strings. `ctx.folder_subtree_ids` never passed to `resolve_filter` (Pitfall 4 honored). |
| `backend/app/services/openai_service.py` | `QUERY_DOCUMENTS_BY_VIEW_TOOL` schema constant + `get_tools()` entry | VERIFIED | `QUERY_DOCUMENTS_BY_VIEW_TOOL` defined at lines 107-189. Schema: flat `view` (string, optional), `filter` (object, optional), `limit` (integer, optional). No top-level `required`. Op enum at lines 153-158 matches `ViewCondition.op` exactly. `get_tools()` assembly at line 970 includes `QUERY_DOCUMENTS_BY_VIEW_TOOL`. |
| `backend/app/services/document_view_service.py` | `get_view_by_name` own-or-global saved-view lookup | VERIFIED | `get_view_by_name(name, user_id, supabase)` at lines 130-163. Filters `list_views` result in Python (no name interpolated into PostgREST grammar). Case-insensitive match. Own-first preference. Returns None on unknown name (existence-leak guard). |
| All 9 Wave-0 test files | Test scaffolds fully authored and un-xfailed | VERIFIED | All 9 files present. Unit: `test_115_resolver_extraction.py`, `test_115_tool_wiring.py`, `test_115_tool_schema.py`, `test_115_handler_modes.py`, `test_115_whitelist_guard.py`. Integration: `test_115_catalog.py`, `test_115_saved_view_run.py`, `test_115_result_shape.py`, `test_115_tool_global_leak.py`. Per orchestrator evidence: 23 passed, 1 xfailed (the intentional Plan-01 live-bad-field xfail that requires a real DB whitelist fetch). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tool_dispatcher._TOOL_REGISTRY` | `_handle_query_documents_by_view` | One-line registry mapping at `tool_dispatcher.py:2584` | WIRED | `grep -c '"query_documents_by_view": _handle_query_documents_by_view'` = 1 |
| `openai_service.get_tools()` | `QUERY_DOCUMENTS_BY_VIEW_TOOL` | Assembly list entry at `openai_service.py:970` | WIRED | `QUERY_DOCUMENTS_BY_VIEW_TOOL` appears in the `tools = [...]` list as the 3rd entry |
| `_handle_query_documents_by_view` | `document_view_resolver.resolve_filter` | Lazy bind via `_ensure_resolver()` + call at `tool_dispatcher.py:397-404` | WIRED | Handler calls `resolve_filter(caller=caller, flt=flt, ...)` twice — once count_only=True, once count_only=False. `ResolveError` caught at line 405. |
| `document_views.py` routes | `document_view_resolver.resolve_filter` | `from app.services.document_view_resolver import ... resolve_filter ...` at line 65 | WIRED | Routes are confirmed thin wrappers: `async def _resolve_filter` no longer defined in `document_views.py` (zero matches). |
| `_handle_query_documents_by_view` | `document_view_service.get_view_by_name` | Call at `tool_dispatcher.py:363-365` (saved-view mode) | WIRED | `view = await document_view_service.get_view_by_name(view_name, caller, supabase=ctx.supabase)` |
| `dispatch_tool` phase_whitelist guard | `_handle_query_documents_by_view` | No special-casing — generic guard at lines 2621-2638 applies | WIRED | `test_115_whitelist_guard.py` tests all 3 cases (excluded / included / None-Deep). Confirmed no branch around the guard for this tool. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `_handle_query_documents_by_view` | `total`, `compact` rows | `resolve_filter(count_only=True)` + `resolve_filter(count_only=False)` → PostgREST queries on `documents` table | Yes — live DB queries via `aexec`; no static fallbacks | FLOWING |
| `_handle_query_documents_by_view` (catalog mode) | `views`, `filterable_fields` | `document_view_service.list_views(caller, ...)` + `_build_field_meta(caller, ...)` → live DB queries | Yes | FLOWING |
| `document_view_resolver.resolve_filter` | `own_ids` / `glob_ids` (count) or `own_docs` / `global_docs` (listing) | PostgREST `.select("id"` / `.select("*")` on `documents` table, filtered by `eq("user_id", caller)` / `in_("folder_id", global_folder_ids)` | Yes | FLOWING |

Note on WR-02 (code-review finding, not a BLOCKER): The count path uses `.select("id")` without a server-side aggregate, which means PostgREST's `db-max-rows` ceiling (default 1000) applies silently for users with >1000 matching documents. This is inherited from 113/114 resolver behavior and is NOT net-new to Phase 115. The tool schema text "TRUE total is always reported" is technically inaccurate for this edge case. The code-review correctly flagged this as a Warning (not a blocker); it does not prevent VIEW-07 from working for realistic user datasets and will require a follow-up fix for large knowledge bases.

---

### Behavioral Spot-Checks

Formal spot-checks require a running backend on :54322. The orchestrator has confirmed 23 passed / 1 xfailed against live :54322. The following key behaviors have unit-test coverage and are substantive (non-stub):

| Behavior | Test File | Status |
|----------|-----------|--------|
| Registry + get_tools dual-wiring | `test_115_tool_wiring.py` (3 tests) | PASS (per orchestrator) |
| Schema no anyOf/oneOf; view/filter optional; op-enum parity | `test_115_tool_schema.py` (3 tests) | PASS |
| Phase whitelist guard (excluded/included/None) | `test_115_whitelist_guard.py` (3 tests) | PASS |
| Handler mode routing (catalog/save/inline) | `test_115_handler_modes.py` | PASS |
| Two-user live leak proof driving the handler | `test_115_tool_global_leak.py` (ran live, NOT skipped) | PASS (live :54322) |
| Resolver extraction (no FastAPI, ResolveError attrs) | `test_115_resolver_extraction.py` (3 of 4 un-xfailed) | PASS |
| Catalog filterable_fields == compiler whitelist | `test_115_catalog.py` | PASS |
| TRUE total via count-only + truncation note + source_refs | `test_115_result_shape.py` | PASS |
| Saved-view-by-name resolve + unknown-name → catalog | `test_115_saved_view_run.py` | PASS |

---

### Probe Execution

Step 7c: SKIPPED — no phase-declared `probe-*.sh` files exist. Phase 115 is a backend-Python phase with pytest as the verification surface. The orchestrator ran the full suite live against :54322 (23 passed / 1 xfailed). This substitutes for probe-style end-to-end checks.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VIEW-07 | Plans 01, 02, 03 (all three) | The agent can run a saved view / metadata query as a tool to answer questions in chat | SATISFIED | `query_documents_by_view` tool fully implemented: dual-wired (SC#1), leak-safe (SC#2), 4-axis UAT authored (SC#3). Manual live-model execution remains (human_verification items). REQUIREMENTS.md traceability table still shows "Pending" — this is a documentation artifact that should be flipped to "Complete" when the phase closes. |

---

### Anti-Patterns Found

The following are from the code-review report (115-REVIEW.md, 0 Critical / 3 Warning / 3 Info). None are TBD/FIXME/XXX debt markers. Evaluated against the BLOCKER definition (prevents goal or unresolved debt marker):

| File | Finding | Severity | Impact on Phase Goal |
|------|---------|----------|---------------------|
| `tool_dispatcher.py:394` | WR-01: `int(args.get("limit"))` can raise a bare `ValueError`/`TypeError` into the agent loop when a weak model emits a non-integer limit. Falls through to the agent-loop catch-all (does not crash), but degrades the "calm ToolResult" contract. | WARNING | Does not prevent VIEW-07 from functioning — the agent-loop catch-all catches it. Robustness gap, not a feature gap. |
| `document_view_resolver.py:296-312` + `openai_service.py:183` | WR-02: PostgREST `db-max-rows` ceiling (1000) means "TRUE total" claim is inaccurate for >1000-document views. Inherited from 113/114, NOT net-new. Schema text is aspirational. | WARNING | Edge case for large knowledge bases. Does not prevent the tool from working for realistic datasets (< 1000 matching docs). Inherited debt, not introduced here. |
| `tool_dispatcher.py:344-356` | WR-03: `_catalog()` has no guard around `list_views`/`_build_field_meta` — a transient DB error would escape the handler's documented "never raise" contract. Falls through to agent-loop catch-all. | WARNING | Does not prevent VIEW-07 from functioning in the normal (no-DB-error) case. Robustness gap only. |

**Debt-marker gate:** Zero TBD, FIXME, XXX markers found in Phase 115 files.

**Verdict on warnings:** All three are robustness/contract-honesty warnings documented in the code review. None prevents VIEW-07 goal achievement. No BLOCKER classification warranted.

---

### Human Verification Required

All 4 items are SC#10 cross-provider UAT rows explicitly authored in `115-VALIDATION.md` per the CLAUDE.md "UAT scoreboard recipe (MANDATORY)". Live model execution is required; automated tests cannot substitute.

#### 1. Cross-Provider Tool Emission (4 Native-7 providers + OpenRouter)

**Test:** For each of OpenAI, Anthropic, Google/Gemini, DeepSeek, Moonshot/Kimi, Z.ai-GLM, MiniMax (+ OpenRouter backstop), in a Deep-mode chat: (1) ask "what saved views and filterable fields do I have?", (2) ask "open my Invoices view", (3) ask "how many contracts expire within 90 days?"
**Expected:** Model emits `query_documents_by_view` call in all three steps. Catalog result for (1), saved-view result for (2), inline-filter result for (3). Gemini must NOT return 400 (anyOf/oneOf-free schema proof). MiniMax: PASS or document as known D-115-13 limitation.
**Why human:** Only a live model proves the model actually SEEs the schema and emits the call. Registry + get_tools wiring is automated-verified; actual invocation by a provider is not.

#### 2. Multi-Tool Routing (SC#3 multi-tool axis)

**Test:** One prompt: "list all my contracts, then find the indemnity clause in them."
**Expected:** Model calls `query_documents_by_view` for the list step AND `search_documents` for the passage step — NOT `search_documents` for both.
**Why human:** The description's routing contrast between the two tools is only testable with a live model responding to the schema.

#### 3. Parallel-Thread Isolation (SC#3 parallel-thread axis)

**Test:** Start a view-tool answer in Thread A ("open my Invoices view"); while it streams, send a new prompt in Thread B.
**Expected:** No cross-thread bleed in tool result rows or source_refs. Each thread's answer is scoped to its own run.
**Why human:** Concurrency under live streaming is only observable with actual concurrent browser sessions.

#### 4. Long-Message Robustness (SC#3 long-message axis)

**Test:** In a thread with >= 50 prior messages (or paste a >= 5 KB prompt) ending in "...now open my Invoices view".
**Expected:** Tool still fires and the polymorphic arg fills correctly under long-context. TRUE total and truncation note appear as designed.
**Why human:** Long-context tool-emission behavior requires a live model with a long conversation history.

---

### Gaps Summary

No automated blockers found. All three SC must-haves are verified in the codebase:

- SC#1: Dual-wiring confirmed at both registry and get_tools sites. Schema is Gemini-safe (no anyOf/oneOf in actual schema JSON). Op-enum parity with ViewCondition.op asserted by test. view/filter absent from required.
- SC#2: Resolve core is single-sourced (no fork). Caller-scoping is structurally enforced throughout the resolve chain. Live two-user leak proof passed against :54322 driving the actual handler. Phase whitelist guard is inherited generic — no special-casing. ResolveError maps to calm ToolResult strings.
- SC#3: All 4 UAT axis rows are authored in VALIDATION.md with test instructions, expected behavior, and why-human rationale. Live execution is explicitly a human-UAT item per the phase goal note.

Three code-review warnings (WR-01/02/03) are robustness/contract-honesty gaps, not feature blockers. The status is human_needed (not gaps_found) because all automated verifications pass and the only remaining items are live-model UAT rows that are correct-by-design to be human-only.

---

_Verified: 2026-06-20_
_Verifier: Claude (gsd-verifier)_

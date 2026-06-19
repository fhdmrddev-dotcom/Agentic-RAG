---
phase: 115
slug: virtual-folders-agent-tool
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 115 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x + pytest-asyncio (`asyncio_mode = auto`) |
| **Config file** | backend/pytest.ini (`testpaths = tests`) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_115_*.py -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_115_*.py tests/integration/test_115_*.py -q` |
| **Estimated runtime** | ~25 seconds (unit < 5s; live integration on :54322 ~20s, skips cleanly when unreachable) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (`tests/unit/test_115_*.py` — schema/wiring/handler-mode, fast, no DB)
- **After every plan wave:** Run full suite command (adds live integration on :54322)
- **Before `/gsd:verify-work`:** Full suite must be green (live integration on :54322) AND the two-user leak integration green
- **Max feedback latency:** ~25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 115-01-T1 | 01 | 1 | VIEW-07 | T-115-01-* | Wave-0 RED/xfail scaffolds for the whole phase (suite exits 0) | unit + integration | `pytest tests/unit/test_115_*.py tests/integration/test_115_*.py -q` | ❌ Wave 0 (this task creates them) | ⬜ pending |
| 115-01-T2 | 01 | 1 | VIEW-07 | T-115-01-01/02/03/04 | Extracted `resolve_filter` raises `ResolveError` (not HTTPException), imports no FastAPI, caller-scoping byte-identical | unit | `pytest tests/unit/test_115_resolver_extraction.py -x` | ❌ Wave 0 | ⬜ pending |
| 115-01-T3 | 01 | 1 | VIEW-07 | T-115-01-01/02 | 113/114 resolve routes byte-identical after rewrap (regression guard) | integration (LIVE :54322) | `pytest tests/integration/test_113_*.py tests/integration/test_114_*.py -q` | ✅ (exists; regression) | ⬜ pending |
| 115-02-T1 | 02 | 2 | VIEW-07 | T-115-02-02 | `get_view_by_name` own-or-global, own-first, None-on-unknown, no grammar-injection surface | integration (LIVE) | `pytest tests/integration/test_115_saved_view_run.py -x` | ❌ Wave 0 | ⬜ pending |
| 115-02-T2 | 02 | 2 | VIEW-07 | T-115-02-01/03/04/05/06 | Handler routes catalog/saved-view/inline modes; bad filter → calm string (no raise); TRUE total via count-only; source_refs; search.query audit `via:view/filter` | unit + integration (LIVE) | `pytest tests/unit/test_115_handler_modes.py tests/integration/test_115_catalog.py tests/integration/test_115_result_shape.py -q` | ❌ Wave 0 | ⬜ pending |
| 115-03-T1 | 03 | 3 | VIEW-07 | T-115-03-03/04 | Dual-wiring (registry + get_tools); schema NO anyOf/oneOf; op-enum parity; threads.py untouched | unit | `pytest tests/unit/test_115_tool_wiring.py tests/unit/test_115_tool_schema.py -x` | ❌ Wave 0 | ⬜ pending |
| 115-03-T2 | 03 | 3 | VIEW-07 | T-115-03-01/02 | SC#2 guard refuses excluded tool / dispatches otherwise; LIVE two-user leak proof drives the HANDLER (disjoint per-caller, 404-not-403) | unit + integration (LIVE, secure-phase) | `pytest tests/unit/test_115_whitelist_guard.py tests/integration/test_115_tool_global_leak.py -q` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Plan 115-01 Task 1 authors these RED/xfail scaffolds. Filenames match RESEARCH §"Wave 0 Gaps" exactly.

- [ ] `backend/tests/unit/test_115_tool_wiring.py` — SC#1 dual-registration (`_TOOL_REGISTRY` AND `get_tools()`) — Plan 03 target
- [ ] `backend/tests/unit/test_115_tool_schema.py` — SC#1 schema-shape (NO anyOf/oneOf; `view`/`filter` optional; `op.enum` ≡ `ViewCondition.op`) — Plan 03 target
- [ ] `backend/tests/unit/test_115_handler_modes.py` — mode routing (catalog/saved/inline) + calm-error-on-bad-filter — Plan 02 target
- [ ] `backend/tests/unit/test_115_whitelist_guard.py` — SC#2 guard (extends `test_tool_budget.py`) — Plan 03 target
- [ ] `backend/tests/unit/test_115_resolver_extraction.py` — `resolve_filter`/`ResolveError`, no-FastAPI, bad-field → ResolveError — Plan 01 target
- [ ] `backend/tests/integration/test_115_catalog.py` — catalog `filterable_fields` ≡ compiler whitelist (LIVE :54322) — Plan 02 target
- [ ] `backend/tests/integration/test_115_saved_view_run.py` — saved-view-by-name resolve + unknown-name → catalog (LIVE) — Plan 02 target
- [ ] `backend/tests/integration/test_115_result_shape.py` — TRUE total via count-only + truncation note + source_refs (LIVE) — Plan 02 target
- [ ] `backend/tests/integration/test_115_tool_global_leak.py` — the LIVE two-user leak proof, **driving `_handle_query_documents_by_view` (not the route)** (clone `test_113_view_global_leak.py`) — Plan 03 target, run live in secure-phase
- [ ] No framework install needed (pytest + pytest-asyncio present)

---

## Manual-Only Verifications

> SC#10 4-axis cross-provider UAT (D-115-13 / ROADMAP SC#3) — authored HERE, NOT in PLAN.md tasks
> (CLAUDE.md "UAT scoreboard recipe (MANDATORY)"). Run in/around secure-phase, Chrome MCP / live chat.
> Acceptance (SC#1): the model must ACTUALLY emit a `query_documents_by_view` call — observable only with a live model.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **Cross-provider × catalog + saved-view + inline-filter** — the model emits a `query_documents_by_view` call AND fills the polymorphic `view`-XOR-`filter` arg correctly on each native-7 provider | VIEW-07 / SC#1 + SC#3 | Live multi-provider tool-emission behavior; only a live model proves "the model actually calls it" | For EACH of OpenAI, Anthropic, Google/Gemini, DeepSeek, Moonshot/Kimi, Z.ai-GLM, MiniMax (+ OpenRouter backstop), in a Deep-mode chat with a seeded folder of typed docs: (1) ask "what saved views and filterable fields do I have?" → expect a CATALOG result; (2) ask "open my Invoices view" → expect a saved-view resolve with the TRUE total + a truncation note when capped; (3) ask "how many contracts expire within 90 days?" → expect an inline-filter resolve. Record per provider: did it emit the call (yes/no), did it fill the arg correctly (yes/no). **Gemini row = the anyOf/oneOf-free schema proof** (a 400 here = schema regression). **MiniMax row = the `minimax-m3-invalid-tool-args-400` watch point** — confirm the inline-`filter` object does not WORSEN it; PASS or document as a known provider limitation (NOT this phase's fix — D-115-13). |
| **Multi-tool** — `query_documents_by_view` + `search_documents` in one prompt, routed correctly | VIEW-07 / SC#3 | The two retrieval lanes must coexist; only a live model proves correct routing between them (D-115-5) | One prompt: "list all my contracts, then find the indemnity clause in them." Expect the model to call `query_documents_by_view` (the exhaustive list) THEN `search_documents` (the semantic passage). Verify it does NOT use `search_documents` for the "list all" step (the description's contrast did the routing work). |
| **Parallel-thread** — Thread A streaming a view-tool answer while Thread B accepts a new prompt; no cross-thread bleed | VIEW-07 / SC#3 | Concurrency / per-thread isolation only observable live | Start a view-tool answer in Thread A (e.g. "open my Invoices view"); while it streams, send a new prompt in Thread B. Verify no cross-thread bleed in the tool result rows or `source_refs`; each thread's answer is scoped to its own run. |
| **Long-message** — ≥ 50 prior messages OR a ≥ 5 KB prompt with the view-tool call at the end | VIEW-07 / SC#3 | Long-context tool-emission only observable live | In a thread with ≥ 50 prior messages (or paste a ≥ 5 KB prompt) ending in "...now open my Invoices view", verify the tool still fires and the polymorphic arg still fills correctly (no truncation-induced mis-fill). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (9 test files authored in 115-01-T1)
- [ ] No watch-mode flags
- [ ] Feedback latency < 25s
- [ ] `nyquist_compliant: true` set in frontmatter (set at verify/validate, after the live suite is green)

**Approval:** pending

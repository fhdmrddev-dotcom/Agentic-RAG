---
phase: 151
slug: agent-file-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 151 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 151-RESEARCH.md "Validation Architecture" + "Security Domain".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (`asyncio_mode = auto`) |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && python -m pytest tests/unit/test_151_*.py -x` |
| **Full suite command** | `cd backend && python -m pytest` |
| **Estimated runtime** | quick ~a few s (mocked supabase/session); full suite existing |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/unit/test_151_*.py -x`
- **After every plan wave:** Run `cd backend && python -m pytest tests/unit -x` (catches the 3 stale exact-count assertions early — see Wave 0)
- **Before `/gsd:verify-work`:** Full suite (`python -m pytest`) must be green
- **Max feedback latency:** < 30 seconds (unit tier is mocked — no live supabase/sandbox)

---

## Per-Task Verification Map

> Task IDs are filled once PLAN.md waves exist; rows below are the requirement/behavior → test anchors from RESEARCH.md. Every row is Wave 0 (test file created before the code it verifies).

| Behavior | Req | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|-----|------------|-----------------|-----------|-------------------|-------------|--------|
| Tool schema flat (no `anyOf`/`oneOf`), correct name/params | FILE-02 | — | — | unit (schema-shape) | `pytest tests/unit/test_151_tool_schema.py -x` | ❌ W0 | ⬜ pending |
| `fetch_document_file` dual-wired in `_TOOL_REGISTRY` + `get_tools()`, `sandbox_enabled`-gated | FILE-02 | — | tool absent when sandbox off | unit (registry) | `pytest tests/unit/test_151_registration.py -x` | ❌ W0 | ⬜ pending |
| No-original → honest error (D-01); over-cap → error w/ size (D-02); happy → `/sandbox/input/<f>` path returned (D-03) | FILE-02 | T-01 | refuse-never-truncate; no partial write | unit (handler, mocked supabase+session) | `pytest tests/unit/test_151_fetch_handler.py -x` | ❌ W0 | ⬜ pending |
| Path-traversal filename sanitized, cannot escape `/sandbox/input/` | FILE-02 | T-01 | `../../x` lands as scrubbed basename | unit | `pytest tests/unit/test_151_fetch_handler.py -x` | ❌ W0 | ⬜ pending |
| Size cap gate PRE-download (`documents.file_size`); bytes never in `ToolResult` | FILE-02 | T-01 | over-cap → error, no download attempted | unit | `pytest tests/unit/test_151_fetch_handler.py -x` | ❌ W0 | ⬜ pending |
| `attach_skill_file` dual-wired, `self_improve_enabled`-gated (D-11) | FILE-01 | — | tool absent when self-improve off | unit (registry) | `pytest tests/unit/test_151_registration.py -x` | ❌ W0 | ⬜ pending |
| All 4 sources resolve bytes; result reports `created` vs `updated` (D-07 upsert) | FILE-01 | — | overwrite-in-place, no orphan rows | unit (handler) | `pytest tests/unit/test_151_attach_handler.py -x` | ❌ W0 | ⬜ pending |
| Owner-only write gate: attach to global/`is_system` skill refused | FILE-01 | T-04 | `.eq(user_id)` gate, NOT `.or_(is_global.eq.true)` | unit | `pytest tests/unit/test_151_attach_handler.py -x` | ❌ W0 | ⬜ pending |
| Storage path built from ctx user id, never model args | FILE-01 | T-02 | `{user_id}/{skill_id}/{filename}` owner-prefixed | unit | `pytest tests/unit/test_151_attach_handler.py -x` | ❌ W0 | ⬜ pending |
| Widened allowlist accepts `.md/.json/.csv/.png`; rejects renamed binary; provenance stays `template_input` | FILE-01/SC#3 | T-02 | magic-byte + size gate survive widen | unit (validator) | `pytest tests/unit/test_151_upload_allowlist.py -x` | ❌ W0 | ⬜ pending |
| Cross-user: fetch/attach with non-owner user_id → not-found/refuse (owner-scope empty `.data`) | SC#4 | T-01/T-04 | never cross-user | unit (both handlers) | `pytest tests/unit/test_151_fetch_handler.py tests/unit/test_151_attach_handler.py -x` | ❌ W0 | ⬜ pending |
| Both tools survive Google/Anthropic translation (`_convert_tools_to_google(get_tools())` constructs OK) | SC#10 | — | flat schema, no provider fork | unit (translation) | `pytest tests/unit/test_151_cross_provider_schema.py -x` | ❌ W0 | ⬜ pending |
| Stale exact-count assertions updated for +2 tools | — | — | — | unit (regression) | `pytest tests/unit/test_085_tool_registration.py backend/tests/unit/test_tool_dispatcher.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/test_151_tool_schema.py` — schema-shape (model on `test_115_tool_schema.py`)
- [ ] `tests/unit/test_151_registration.py` — dual-wiring (registry + `get_tools()`) + capability-gate assertions
- [ ] `tests/unit/test_151_fetch_handler.py` — FILE-02 handler (D-01/D-02/D-03) + T-01 + SC#4
- [ ] `tests/unit/test_151_attach_handler.py` — FILE-01 handler (4 sources, D-07 upsert) + T-04 + SC#4
- [ ] `tests/unit/test_151_upload_allowlist.py` — D-09 widen (reuse `valid_docx_bytes`/`renamed_binary_bytes` conftest fixtures)
- [ ] `tests/unit/test_151_cross_provider_schema.py` — `_convert_tools_to_google` / `_convert_tools_to_anthropic` construct both new tools
- [ ] Update `test_085_tool_registration.py:272/280` + `test_tool_dispatcher.py:68` exact-count assertions (+2 tools)
- [ ] `conftest.py` `make_tool_context` fixture (`:679`) already exists — reuse for handler tests (no new fixture)

---

## Manual-Only Verifications

> SC#10 4-axis live UAT — MANDATORY, authored here (NOT in PLAN.md tasks). Chrome MCP / operator-driven at phase verification.

| Axis | Behavior | Req | Why Manual | Test Instructions |
|------|----------|-----|------------|-------------------|
| Cross-provider | `fetch_document_file` + `attach_skill_file` each fire successfully | SC#10 | Real LLM tool-call behavior varies per provider | Run each tool on OpenAI, Anthropic, Google, OpenRouter (one representative model each); record run IDs |
| Multi-tool | `fetch_document_file` → `execute_code` (open real `.docx` w/ python-docx) → `attach_skill_file` (sandbox output) in ONE turn | SC#1/#2/#3 | End-to-end file loop across 3 tools | Single prompt exercising all three; verify the attached file is the real generated asset |
| Parallel-thread | Thread A mid-fetch while Thread B accepts a new prompt | SC#4 | Session cached per `thread_id` — no cross-thread bleed | Start a fetch in Thread A; immediately prompt Thread B; verify no cross-thread file/session bleed |
| Long-message | Attach with ≥50-prior-message history OR ≥5 KB inline-content arg | FILE-01 | Weak-model (MiniMax/DeepSeek/GLM) arg-mangling check | Exercise the inline source with a large payload after a long conversation |
| Cross-user | fetch/attach another user's doc/skill → refused live | SC#4 | Service-role has no RLS backstop; app gate is load-bearing | With a second account's doc/skill id, confirm not-found/refuse |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

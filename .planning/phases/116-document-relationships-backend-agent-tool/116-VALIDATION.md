---
phase: 116
slug: document-relationships-backend-agent-tool
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 116 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `116-RESEARCH.md` §"Validation Architecture". Backend-only; zero net-new deps.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x + pytest-asyncio (`asyncio_mode = auto`) — same as 113/114/115 |
| **Config file** | `backend/pytest.ini` (`testpaths = tests`) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_116_*.py -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_116_*.py tests/integration/test_116_*.py -q` |
| **Estimated runtime** | ~5 seconds (113/114/115 actual) |
| **Live DB** | Local Postgres `:54322`; integration tests skip cleanly when unreachable (`_pg_reachable` guard, cloned from `test_115_tool_global_leak.py`) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && venv/Scripts/python -m pytest tests/unit/test_116_*.py -q` (schema/wiring/handler — fast, no DB)
- **After every plan wave:** Run the full suite (adds live integration on `:54322`, including the two-user leak proof)
- **Before `/gsd:verify-work`:** Full suite green **AND** the live leak proof green (non-vacuous) — the RLS label is not the proof
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

> Task IDs are filled in by the planner; rows below are keyed to success criteria. Each maps to a Wave-0 test file (see §Wave 0). `T-116-…` threat refs trace to RESEARCH.md §Security Domain.

| SC | Behavior | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----|----------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| SC#1 | `POST /document-relationships` creates a typed link; visible-both gate rejects an unseeable endpoint (422); self-link rejected (422) | REL-01 | T-116 probe-by-link | Visible-both gate BEFORE self-link/CHECK (no ordering oracle) | integration (LIVE) | `pytest tests/integration/test_116_relationship_crud.py -x` | ❌ W0 | ⬜ pending |
| SC#1 | Idempotency: same `(source,target,rel_type)` twice → one row, returns existing (no 409, no duplicate) | REL-01 | T-116 idempotency race | Additive partial unique index + 23505-catch upsert | integration (LIVE) | `pytest tests/integration/test_116_idempotency.py -x` | ❌ W0 | ⬜ pending |
| SC#1 | `DELETE /document-relationships/{id}` removes; 404-not-403 on a cross-user/absent miss | REL-03 | T-116 cross-user delete | Own-scoped delete (`.eq("user_id", caller)`) → 404-not-403 | integration (LIVE) | `pytest tests/integration/test_116_relationship_crud.py -x` | ❌ W0 | ⬜ pending |
| SC#1 | `relationship.create` audit row lands LIVE on create (the async round-trip is the proof) | REL-01 / DMF-01 | T-116 audit drop | Reuse live-enum action (no migration); boot drift-guard | integration (LIVE) | `pytest tests/integration/test_116_audit_live.py -x` | ❌ W0 | ⬜ pending |
| SC#1 | Version-stable: after a re-upload (new version) OR a restore, the link still resolves to the LATEST version (read-time resolution) | REL-01 | — | Read-time resolve over `(user_id, filename, is_latest)` | integration (LIVE) | `pytest tests/integration/test_116_version_stable.py -x` | ❌ W0 | ⬜ pending |
| SC#2 | `get_related_documents` dual-wired: in `_TOOL_REGISTRY` AND in `get_tools()` | REL-04 | T-116 visibility bug | Guard the Phase 101 harness-only-visibility trap | unit | `pytest tests/unit/test_116_tool_wiring.py -x` | ❌ W0 | ⬜ pending |
| SC#2 | Tool schema is Gemini-safe: NO anyOf/oneOf, NO multi-type `type` arrays; two scalar-string fields; either/or in prose | REL-04 | T-116 Gemini 400 | Flat scalar-string args (simpler than 115's polymorphic `value`) | unit | `pytest tests/unit/test_116_tool_schema.py -x` | ❌ W0 | ⬜ pending |
| SC#2 | Handler returns BOTH directions with correct inverse labels; compact rows + `source_refs`; calm-error on unresolvable subject (no raise) | REL-04 | T-116 error leak | Calm-string tool errors (no stack to model) | unit + integration (LIVE) | `pytest tests/unit/test_116_handler.py tests/integration/test_116_tool_read.py -q` | ❌ W0 | ⬜ pending |
| SC#2 | **Leak-safe masking (LIVE two-user proof):** a target the caller can't see renders as `"linked document (no access)"` — never title/metadata; drives the HANDLER, not the RLS label | REL-04 | T-116 cross-viewer leak | Per-viewer readability re-check at read; mask | integration (LIVE) | `pytest tests/integration/test_116_tool_leak.py -x` | ❌ W0 | ⬜ pending |
| SC#2 | `dispatch_tool` whitelist guard refuses the tool when excluded / dispatches when allowed (SC#2-free, byte-identical Deep) | REL-04 | T-116 whitelist bypass | `phase_whitelist`-None = byte-identical Deep dispatch | unit | `pytest tests/unit/test_116_whitelist_guard.py -x` | ❌ W0 | ⬜ pending |
| SC#3 | SC#10 4-axis cross-provider UAT (native-7 × multi-tool × parallel-thread × long-message) | REL-04 | — | Live-model emission (see §Manual-Only) | **manual-only** | — (tracked in `116-HUMAN-UAT.md`) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_116_tool_wiring.py` — SC#2 dual-registration (`_TOOL_REGISTRY` AND `get_tools()`)
- [ ] `backend/tests/unit/test_116_tool_schema.py` — SC#2 schema-shape (NO anyOf/oneOf, NO multi-type `type` arrays, two scalar-string fields)
- [ ] `backend/tests/unit/test_116_handler.py` — both-directions + inverse labels + compact rows + calm-error-on-unresolvable
- [ ] `backend/tests/unit/test_116_whitelist_guard.py` — SC#2 dispatch guard (extend `test_tool_budget.py` pattern)
- [ ] `backend/tests/integration/test_116_relationship_crud.py` — POST create + visible-both 422 + self-link 422 + DELETE 404-not-403 (LIVE)
- [ ] `backend/tests/integration/test_116_idempotency.py` — duplicate create → one row, returns existing (LIVE)
- [ ] `backend/tests/integration/test_116_audit_live.py` — `relationship.create` row lands live (LIVE)
- [ ] `backend/tests/integration/test_116_version_stable.py` — re-upload + restore → link follows latest (LIVE)
- [ ] `backend/tests/integration/test_116_tool_read.py` — handler returns both directions, source_refs (LIVE)
- [ ] `backend/tests/integration/test_116_tool_leak.py` — **the two-user leak proof, driving the HANDLER** (clone `test_115_tool_global_leak.py`); seed a target visible to A, link it, make it unseeable to B, assert B sees the mask (NON-vacuous)
- [ ] No framework install needed (pytest + pytest-asyncio present)

---

## Manual-Only Verifications

> SC#10 4-axis bandwidth per CLAUDE.md "UAT scoreboard recipe": native-7 cross-provider × multi-tool × parallel-thread × long-message. These do NOT block nyquist-compliance (Phase 104/111.1/115 precedent — live-model tool emission is inherently un-automatable). Tracked in `116-HUMAN-UAT.md` (status: partial).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-provider × `document_id`-vs-`filename` | REL-04 | Live-model tool emission | For each native-7 provider, in a Deep chat with seeded linked docs: (1) "what supersedes [doc]?" → expect incoming-edge `superseded_by`; (2) "show related documents for [filename]" → expect filename-fallback. Record per provider: emitted the call (y/n), filled `document_id` OR `filename` correctly (y/n). **Gemini row = the no-multi-type-array proof** (a 400 = schema regression). **MiniMax row = the `minimax-m3-invalid-tool-args-400` watch point** — confirm the two-string arg does NOT worsen it; PASS or document as a known provider limitation (NOT this phase's fix). |
| Multi-tool | REL-04 | Live-model orchestration | "find the indemnity clause, then show me what supersedes that contract" → expect `search_documents` THEN `get_related_documents`. |
| Parallel-thread | REL-04 | Concurrent live streams | Thread A streaming a relationships answer while Thread B accepts a new prompt; no cross-thread bleed in rows/`source_refs`. |
| Long-message | REL-04 | Long-context live emission | ≥ 50 prior messages OR ≥ 5 KB prompt ending in "...now show related docs for [doc]" → tool still fires, arg still fills. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

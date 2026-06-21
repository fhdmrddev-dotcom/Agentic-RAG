---
phase: 116
slug: document-relationships-backend-agent-tool
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-20
validated: 2026-06-20
---

# Phase 116 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `116-RESEARCH.md` §"Validation Architecture". Backend-only; zero net-new deps.
> **State A reconciliation (2026-06-20):** plan-time draft reconciled to executed reality — all 10 Wave-0 test files built and green (35 tests). No auditor spawn (zero automated gaps). Two rows now carry the gap-closure non-vacuous regressions (CR-01 → `test_116_tool_leak`, CR-02 → `test_116_version_stable`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x + pytest-asyncio (`asyncio_mode = auto`) — same as 113/114/115 |
| **Config file** | `backend/pytest.ini` (`testpaths = tests`) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_116_*.py -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_116_*.py tests/integration/test_116_*.py -q` |
| **Actual runtime** | ~8.5 seconds (35 tests, live `:54322`) |
| **Live DB** | Local Postgres `:54322`; integration tests skip cleanly when unreachable (`_pg_reachable` guard, cloned from `test_115_tool_global_leak.py`) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && venv/Scripts/python -m pytest tests/unit/test_116_*.py -q` (schema/wiring/handler — fast, no DB)
- **After every plan wave:** Run the full suite (adds live integration on `:54322`, including the two-user leak proof)
- **Before `/gsd:verify-work`:** Full suite green **AND** the live leak proof green (non-vacuous) — the RLS label is not the proof
- **Max feedback latency:** ~8.5 seconds (full live suite)

---

## Per-Task Verification Map

> Reconciled to executed reality. All automated rows COVERED + green (35 tests, live `:54322`). SC#3 is manual-only (does not block nyquist-compliance — see §Manual-Only).

| SC | Behavior | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----|----------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| SC#1 | `POST /document-relationships` creates a typed link; visible-both gate rejects an unseeable endpoint (422); self-link rejected (422) | REL-01 | T-116-02-01 probe-by-link | Visible-both gate BEFORE self-link/CHECK (no ordering oracle) | integration (LIVE) | `pytest tests/integration/test_116_relationship_crud.py -x` | ✅ | ✅ green |
| SC#1 | Idempotency: same `(source,target,rel_type)` twice → one row, returns existing (no 409, no duplicate); race-immune via live unique index | REL-01 | T-116-01-03 idempotency race | Additive partial unique index (075) + 23505-catch upsert | integration (LIVE) | `pytest tests/integration/test_116_idempotency.py -x` | ✅ | ✅ green |
| SC#1 | `DELETE /document-relationships/{id}` removes; 404-not-403 on a cross-user/absent miss | REL-03 | T-116-02-02 cross-user delete | Own-scoped delete (`.eq("user_id", caller)`) → 404-not-403 | integration (LIVE) | `pytest tests/integration/test_116_relationship_crud.py -x` | ✅ | ✅ green |
| SC#1 | `relationship.create` audit row lands LIVE on create (the async round-trip is the proof) | REL-01 / DMF-01 | T-116-02-04 audit drop | Reuse live-enum action (no migration); boot drift-guard | integration (LIVE) | `pytest tests/integration/test_116_audit_live.py -x` | ✅ | ✅ green |
| SC#1 | **Version-stable (CR-02 closed):** an edge created against a version-N id still surfaces in `get_related_documents` after re-upload to N+1 (read-time follow-to-latest, `.in_()` over the `(user_id,filename)` lineage) | REL-01 | T-116-05-04 orphan-on-reupload | `_subject_version_ids` lineage-scoped edge enumeration | integration (LIVE) | `pytest tests/integration/test_116_version_stable.py -x` | ✅ | ✅ green (non-vacuous) |
| SC#2 | `get_related_documents` dual-wired: in `_TOOL_REGISTRY` AND in `get_tools()` | REL-04 | T-116-03-04 visibility bug | Guard the Phase 101 harness-only-visibility trap | unit | `pytest tests/unit/test_116_tool_wiring.py -x` | ✅ | ✅ green |
| SC#2 | Tool schema is Gemini-safe: NO anyOf/oneOf, NO multi-type `type` arrays; two scalar-string fields; either/or in prose | REL-04 | T-116-03-02 Gemini 400 | Flat scalar-string args (simpler than 115's polymorphic `value`) | unit | `pytest tests/unit/test_116_tool_schema.py -x` | ✅ | ✅ green |
| SC#2 | Handler returns BOTH directions with correct inverse labels; compact rows + `source_refs`; calm-error on unresolvable subject (no raise) | REL-04 | T-116-03-03 error leak | Calm-string tool errors (no stack to model) | unit + integration (LIVE) | `pytest tests/unit/test_116_handler.py tests/integration/test_116_tool_read.py -q` | ✅ | ✅ green |
| SC#2 | **Leak-safe masking (CR-01 closed; LIVE two-user proof):** a target the caller can't see renders as `"linked document (no access)"` — never title/metadata; an old-global id whose latest moved private → `None`; drives the HANDLER, not the RLS label | REL-04 | T-116-03-01 / 05-01 / 05-02 cross-viewer leak | `is_latest`-gated global leg + post-follow folder re-check + per-viewer mask | integration (LIVE) | `pytest tests/integration/test_116_tool_leak.py -x` | ✅ | ✅ green (non-vacuous) |
| SC#2 | `dispatch_tool` whitelist guard refuses the tool when excluded / dispatches when allowed (SC#2-free, byte-identical Deep) | REL-04 | T-116-03-04 whitelist bypass | `phase_whitelist`-None = byte-identical Deep dispatch | unit | `pytest tests/unit/test_116_whitelist_guard.py -x` | ✅ | ✅ green |
| SC#3 | SC#10 4-axis cross-provider UAT (native-7 × multi-tool × parallel-thread × long-message) | REL-04 | — | Live-model emission (see §Manual-Only) | **manual-only** | — (tracked in `116-HUMAN-UAT.md`) | n/a | ⬜ pending (human) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/tests/unit/test_116_tool_wiring.py` — SC#2 dual-registration (`_TOOL_REGISTRY` AND `get_tools()`) — 3 tests
- [x] `backend/tests/unit/test_116_tool_schema.py` — SC#2 schema-shape (NO anyOf/oneOf, NO multi-type `type` arrays, two scalar-string fields) — 4 tests
- [x] `backend/tests/unit/test_116_handler.py` — both-directions + inverse labels + compact rows + calm-error-on-unresolvable — 9 tests
- [x] `backend/tests/unit/test_116_whitelist_guard.py` — SC#2 dispatch guard — 3 tests
- [x] `backend/tests/integration/test_116_relationship_crud.py` — POST create + visible-both 422 + self-link 422 + DELETE 404-not-403 (LIVE) — 4 tests
- [x] `backend/tests/integration/test_116_idempotency.py` — duplicate create → one row, returns existing; race-immune (LIVE) — 2 tests
- [x] `backend/tests/integration/test_116_audit_live.py` — `relationship.create` row lands live (LIVE) — 2 tests
- [x] `backend/tests/integration/test_116_version_stable.py` — CR-02: edge survives re-upload, link follows latest (LIVE, non-vacuous) — 3 tests
- [x] `backend/tests/integration/test_116_tool_read.py` — handler returns both directions, source_refs (LIVE) — 2 tests
- [x] `backend/tests/integration/test_116_tool_leak.py` — CR-01: the two-user leak proof driving the HANDLER (old-global/new-private → None; non-vacuity guard) — 3 tests
- [x] No framework install needed (pytest + pytest-asyncio present)

**Total: 35 tests, all green (live `:54322`).**

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

## Validation Audit 2026-06-20

| Metric | Count |
|--------|-------|
| Gaps found | 0 (automated) |
| Resolved | 0 (none needed — all 10 W0 files built + green during execution) |
| Escalated | 0 |
| Manual-only (non-blocking) | 1 (SC#3 SC#10 4-axis → 116-HUMAN-UAT.md) |

State A reconciliation: plan-time draft (everything ❌/pending) updated to executed reality (35 tests green, live `:54322`). No `gsd-nyquist-auditor` spawn — zero automated gaps. SC#1 version-stable + SC#2 leak-safe rows now carry the gap-closure (116-05) non-vacuous CR-02/CR-01 regressions.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 9s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-06-20

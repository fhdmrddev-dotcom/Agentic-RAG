---
phase: 117
slug: document-relationships-panel-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 117 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 117-RESEARCH.md §"Validation Architecture". Task IDs are filled/reconciled
> once PLAN.md files exist; rows below are keyed to SC#1–3 + Wave 0 files until then.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend framework** | pytest + pytest-asyncio + asyncpg (live :54322); config `backend/pytest.ini` |
| **Frontend framework** | vitest@^4.1.0 + @testing-library/react@^16.3.2 + vitest-axe@^0.1.0; config `frontend/vitest.config.ts` |
| **Backend quick run** | `cd backend && venv/Scripts/python -m pytest tests/integration/test_117_*.py tests/unit/test_117_*.py -x` |
| **Backend regression (116 preservation)** | `cd backend && venv/Scripts/python -m pytest tests/ -k "116 or 117"` |
| **Frontend quick run** | `cd frontend && npm run test -- RelationshipsSection CreateLinkDialog` |
| **Full backend suite** | `cd backend && venv/Scripts/python -m pytest tests/` |
| **Full frontend suite** | `cd frontend && npm run test` |
| **Estimated runtime** | backend ~30–60s (live), frontend ~10–20s |

---

## Sampling Rate

- **After every task commit:** Run the relevant `test_117_*` file(s) for the task, `-x`.
- **After every plan wave:** Full `test_117_*` set + the 116 regression set (`-k "116 or 117"`) + `npm run test` for touched frontend files.
- **Before `/gsd:verify-work`:** Full backend suite + full frontend suite green. The LIVE two-user route leak test + create/remove/re-fetch live tests MUST be confirmed non-vacuous (run against :54322, not mocked) — the D-102/D-110-5 "static would false-green" discipline (reaffirmed by 113/115/116).
- **Max feedback latency:** < 90 seconds (backend live suite).

---

## Per-Task Verification Map

> Task IDs are TBD until PLAN.md files exist (planner runs after this draft). Keyed to SC + Wave 0 file until reconciled at execute/validate time.

| Req / SC | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| SC#1 / D-117-8 | Two-user leak via the ROUTE: masked target shows "linked document (no access)", never id/title — LIVE | T-117 V4 | Per-viewer readability re-check is the sole gate; caller-scoped | integration (live) | `pytest tests/integration/test_117_route_leak.py -x` | ❌ W0 | ⬜ pending |
| SC#1 (regression) | The extraction preserves the agent tool's masking byte-identically | — | Agent tool behavior unchanged | integration (live) | `pytest tests/integration/test_116_tool_leak.py tests/integration/test_116_tool_read.py -x` | ✅ (116 — must stay green) | ⬜ pending |
| SC#1 | GET returns outgoing + incoming rows with `direction`+`label`+`relationship_id` over the subject's full version set (follow-to-latest) | T-117 V5 | Uniform 404 on unreadable/unknown subject | integration (live) | `pytest tests/integration/test_117_get_read.py -x` | ❌ W0 | ⬜ pending |
| SC#1 | Shared `get_related_documents` is called by BOTH route + agent handler (no fork) — grep guard | T-117 (no-fork) | Mask string + edge query live ONLY in the service | unit | `pytest tests/unit/test_117_no_fork.py -x` | ❌ W0 | ⬜ pending |
| SC#2 | Create via POST (visible-both gate) → 201 → re-fetch reflects the new link live | — | N/A | integration (live) | `pytest tests/integration/test_117_get_read.py::test_created_link_appears -x` | ❌ W0 | ⬜ pending |
| SC#2 | Remove via DELETE (either direction) → 204 → re-fetch reflects removal live | — | Own-scoped delete | integration (live) | `pytest tests/integration/test_117_get_read.py -x` (same file) | ❌ W0 | ⬜ pending |
| SC#2 | RelationshipsSection re-fetches after create/remove (not optimistic; no Undo) | — | N/A | frontend unit | `npm run test -- RelationshipsSection` | ❌ W0 | ⬜ pending |
| SC#2 | Typeahead excludes self + already-linked-with-chosen-type; re-derives on rel-type change | — | Client exclusion is clarity-only (not a trust boundary) | frontend unit | `npm run test -- CreateLinkDialog` | ❌ W0 | ⬜ pending |
| SC#3 | No aXe AA violations on the section (populated/empty/loading/error/masked states) | — | N/A | frontend a11y | `npm run test -- RelationshipsSection.a11y` | ❌ W0 | ⬜ pending |
| SC#3 | Combobox roles wired (combobox/listbox/option + activedescendant); remove ✕ keyboard + coarse-pointer reachable | — | N/A | frontend a11y | `npm run test -- RelationshipsSection.a11y` (same file) | ❌ W0 | ⬜ pending |
| SC#3 / D-117-10 | Honest-states matrix: empty ≠ error ≠ loading; masked row is not an error/empty | — | N/A | frontend unit | `npm run test -- RelationshipsSection` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Honest-states matrix (D-117-10 — each is a distinct render, assert all four+masked)

| State | Render | Assertion |
|-------|--------|-----------|
| populated | grouped Outgoing/Incoming rows + chips | rows present, correct direction labels |
| empty | "No relationships yet" + inline `+ Add link` | NOT an error; the create affordance is present |
| loading | skeleton / quiet `↻` (no layout jump) | `role="status"`; no error text |
| error | "couldn't load relationships" `role="alert"` | distinct from empty — never a silent empty reading as "no links" |
| no-access (masked) | "linked document (no access)", `document_id:null` | never id/title; still carries a remove ✕; not an error/empty |

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_117_route_leak.py` — LIVE two-user ROUTE leak proof (clone `test_116_tool_leak.py`'s asyncpg harness; drive the ROUTE/shared fn, not just the tool) — SC#1/D-117-8.
- [ ] `backend/tests/integration/test_117_get_read.py` — GET returns outgoing+incoming over the version set + follow-to-latest + create-appears/remove-reflects live — SC#1/SC#2.
- [ ] `backend/tests/unit/test_117_no_fork.py` — grep-guard that the mask string + edge query live ONLY in the service, not the route (the D-117-7 share-don't-fork invariant) — clone the 113/116 source-grep guard.
- [ ] `frontend/src/components/relationships/RelationshipsSection.test.tsx` — grouped render, honest-states matrix, re-fetch-after-mutation (no optimistic, no Undo).
- [ ] `frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx` — `vitest-axe` no AA violations across all states; combobox roles; remove reachability (clone `DocumentDetailPanel.a11y.test.tsx`).
- [ ] `frontend/src/components/relationships/CreateLinkDialog.test.tsx` — per-type candidate exclusion + re-derive on rel-type change + disabled-until-target confirm + error line.
- [ ] **Framework install:** none — pytest + vitest + vitest-axe all present.
- [ ] **Regression backstop:** confirm the 116 tool suite stays green after the extraction (`test_116_tool_leak`, `test_116_tool_read`, `test_116_handler`, `test_116_version_stable`).

---

## Manual-Only Verifications

> G-4 lived-experience UI UAT (NOT SC#10 4-axis — this phase touches no streaming/agent-loop/provider-routing, same reasoning as Phase 112 D-08). Operator-driven, Chrome MCP + DB-verified.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Grouped sections + chips/inverse labels + a masked row | SC#1 / REL-02 | Visual + cross-user seeding | Open a doc with both outgoing + incoming links (seed a two-user scenario so one target is unreadable) → see grouped Outgoing/Incoming, correct chips/inverse labels, a masked "no access" row |
| Create via typeahead | SC#2 | Lived interaction | Type-first chips → filter → confirm → list re-fetches, new outgoing row appears; switching rel-type changes candidates; self never offered |
| Remove (either direction + masked) | SC#2 | Lived interaction | Remove an incoming link → DELETE → re-fetch reflects removal; remove a masked row's ✕ (you own the edge) → reflects |
| Mobile bottom-sheet | SC#3 / UX-01 | Responsive layout | <768px: section + create dialog usable; remove ✕ visible (coarse-pointer always-on) |
| Two-user LIVE leak proof | SC#1 / D-117-8 | Cross-user, DB truth | User B viewing a shared subject sees the masked row for a target only A can read — verified in the browser AND in the DB (not via the RLS label) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter (set at validate-phase after reconciliation)

**Approval:** pending

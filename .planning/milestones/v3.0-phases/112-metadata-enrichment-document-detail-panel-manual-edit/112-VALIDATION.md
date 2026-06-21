---
phase: 112
slug: metadata-enrichment-document-detail-panel-manual-edit
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-18
validated: 2026-06-18
---

# Phase 112 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `112-RESEARCH.md` → `## Validation Architecture` (verified live against :54322).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest, `asyncio_mode=auto`, `testpaths=tests` (`backend/pytest.ini`) — present |
| **Framework (frontend)** | vitest 4.1 + @testing-library/react + vitest-axe 0.1.0 (`frontend/package.json`) — present |
| **Live DB** | local Supabase Postgres :54322 (psycopg2 / asyncpg — `backend/tests/integration/test_111_flat_filter_compat.py` is the template) |
| **Quick run (backend)** | `backend/venv/Scripts/python.exe -m pytest tests/unit/test_112_*.py -x` |
| **Quick run (frontend)** | `cd frontend && npx vitest run src/components/metadata` |
| **Full suite (backend)** | `backend/venv/Scripts/python.exe -m pytest tests -q` |
| **Full suite (frontend)** | `cd frontend && npm test` (`vitest run`) |
| **Estimated runtime** | backend unit ~10s; live-DB integration ~30–60s; frontend ~15s |

*No framework install needed — pytest + vitest + vitest-axe all present.*

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched layer (`pytest tests/unit/test_112_*.py -x` for backend, `vitest run src/components/metadata` for frontend).
- **After every plan wave:** Run the full backend suite + full frontend `npm test`.
- **Before `/gsd-verify-work`:** Full suite green **AND the 4 live-DB assertions GREEN** (see below).
- **Max feedback latency:** ~60 seconds (live-DB integration is the slowest path).

---

## Per-Task Verification Map

> Populated post-execution (2026-06-18 validation audit) against the 4 shipped plans + the CR-01 code-review fix. Every requirement maps to ≥1 automated test; all 43 tests ran GREEN (21 backend incl. live :54322, 22 frontend) at audit time.

| Plan | Wave | Requirement | AC | Test Type | Test File | Automated Command | File | Status |
|------|------|-------------|----|-----------|-----------|-------------------|------|--------|
| 01 | W0 | META-05 | — | unit | `test_112_patch_metadata.py` (9) | `pytest tests/unit/test_112_patch_metadata.py` | ✅ | ✅ green (9/9) |
| 01 | W0 | META-05 | AC5 | integration (live) | `test_112_patch_audit.py` (1) | `pytest tests/integration/test_112_patch_audit.py` | ✅ | ✅ green (live :54322) |
| 01 | W0 | META-05 | AC6 | integration (live) | `test_112_patch_rls.py` (2) | `pytest tests/integration/test_112_patch_rls.py` | ✅ | ✅ green (live :54322) |
| 01 | W0 | META-05 | AC8 | integration (live) | `test_112_flat_filter_with_source.py` (3) | `pytest tests/integration/test_112_flat_filter_with_source.py` | ✅ | ✅ green (live :54322) |
| 01 | W0 | META-02 | AC9 | integration (live) | `test_112_custom_field_patch.py` (1) | `pytest tests/integration/test_112_custom_field_patch.py` | ✅ | ✅ green (live :54322) |
| 02 | W1 | META-05 | AC7 | integration (live) | `test_112_reextract_merge.py` (3) | `pytest tests/integration/test_112_reextract_merge.py` | ✅ | ✅ green (live :54322; base-checkout-proven load-bearing) |
| 03 | W0 | META-02 | AC2/AC3 | component (vitest) | `ConfidenceChip.test.tsx` (8) | `vitest run src/components/metadata/ConfidenceChip.test.tsx` | ✅ | ✅ green (8/8) |
| 04 | W1 | META-05 | AC10 | component (vitest) | `InlineEdit.test.tsx` (7) | `vitest run src/components/metadata/InlineEdit.test.tsx` | ✅ | ✅ green (7/7) |
| 04 | W1 | META-02/05/UX-01 | AC1/AC3/AC11 | a11y (vitest-axe) | `DocumentDetailPanel.a11y.test.tsx` (7) | `vitest run src/components/metadata/DocumentDetailPanel.a11y.test.tsx` | ✅ | ✅ green (7/7, axe no-violations) |
| CR-01 | review-fix | META-02 | AC5/AC9 | unit (regression) | `test_112_response_model_preserves_metadata.py` (2) | `pytest tests/unit/test_112_response_model_preserves_metadata.py` | ✅ | ✅ green (2/2 — `_source`/`_confidence`/custom keys survive `response_model`) |

**Totals:** 10 test files · 43 automated tests · all GREEN at audit (2026-06-18). Live integration tests confirmed against local Supabase :54322 (reachable at audit time).

### SPEC Acceptance Criteria → Test Map (11 criteria)

| AC | Behavior | Test Type | Automated Command | Automatable? |
|----|----------|-----------|-------------------|--------------|
| AC1 | Panel opens (desktop split / mobile sheet); Metadata in `PanelSection`; close restores focus | component (vitest) + manual UI | `npx vitest run src/components/metadata/DocumentDetailPanel.test.tsx` | Partial |
| AC2 | Chip = glyph+word+raw score, tiers .75/.50, raw (not %) | unit (vitest) | `npx vitest run src/components/metadata/ConfidenceChip.test.tsx` | ✅ |
| AC3 | Edited → neutral (no score/green); unscored → "Extracted" (not "High"); absent → "Not extracted — add" | unit (vitest) | `npx vitest run src/components/metadata/ConfidenceChip.test.tsx` | ✅ |
| AC4 | Low value reads tentative + distinguishable in greyscale | unit (assert italic+dim+glyph) + manual greyscale screenshot | same file | Partial |
| AC5 | PATCH persists field + writes `audit_log metadata.update` — **live :54322** | integration (pytest live DB) | `pytest tests/integration/test_112_patch_audit.py -x` | ✅ (live) |
| AC6 | Non-owner PATCH → 404; "Saved" receipt only on success | integration (pytest) + component (error path) | `pytest tests/integration/test_112_patch_rls.py -x` | ✅ |
| AC7 | Edit field A → re-extract → A preserved, B refreshed | integration (pytest live DB) | `pytest tests/integration/test_112_reextract_merge.py -x` | ✅ (live) |
| AC8 | `@>` containment still matches with `_confidence`+`_source` present — **live** | integration (pytest live DB) | `pytest tests/integration/test_112_flat_filter_with_source.py -x` | ✅ (live) |
| AC9 | Custom field shows chip + editable + round-trips on reload | integration (pytest) + component | `pytest tests/integration/test_112_custom_field_patch.py -x` | ✅ |
| AC10 | click-to-edit, Enter save, Esc cancel; empty field add | component (vitest + user-event) | `npx vitest run src/components/metadata/InlineEdit.test.tsx` | ✅ |
| AC11 | aXe no AA failures; full keyboard; reduced-motion still shows receipt | a11y (vitest-axe) + manual keyboard sweep | `npx vitest run src/components/metadata/*.a11y.test.tsx` | ✅ (axe) / Partial (keyboard) |

### Live-DB assertion map (the non-negotiable Nyquist gate) — ✅ ALL 4 ENCODED + GREEN (2026-06-18, live :54322)

- ✅ **Audit row written:** `test_112_patch_audit.py::test_patch_writes_metadata_update_audit_row` — count 0→1 for `action_type='metadata.update'` keyed to the doc id; persisted row reflects the edit + `_source`. GREEN.
- ✅ **`@>` still matches:** `test_112_flat_filter_with_source.py` (3 tests) — containment matches with BOTH `_confidence` AND `_source` present (document_type + title) + negative control. GREEN.
- ✅ **Re-extract preserves source=user:** `test_112_reextract_merge.py` (3 tests) — drives the REAL `ingest_document`; preserve field A + refresh field B + no `_confidence` on the user field; degrade-doesn't-wipe; cleared-stays-cleared. Base-checkout-proven to FAIL without the merge guard (load-bearing). GREEN.
- ✅ **Edit round-trips on reload:** `test_112_custom_field_patch.py` + `test_112_response_model_preserves_metadata.py` — custom field PATCH round-trips on reload; `_source`/`_confidence`/custom keys survive `response_model` serialization (CR-01 regression). GREEN. *(Full browser UI→reconcile→chip-render round-trip remains the G-4 human gate #5.)*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test stubs to create before/with the first implementing wave (all map to SPEC ACs) — ✅ ALL SHIPPED + GREEN (2026-06-18):

- [x] `backend/tests/unit/test_112_patch_metadata.py` — route validation (field allow-list, `_`-prefix reject, lowercasing) — META-05 · 9/9 GREEN
- [x] `backend/tests/integration/test_112_patch_audit.py` — live PATCH writes the audit row (AC5) · GREEN live :54322
- [x] `backend/tests/integration/test_112_patch_rls.py` — non-owner → 404 (AC6) · GREEN live :54322
- [x] `backend/tests/integration/test_112_reextract_merge.py` — `_source='user'` preserved across re-extract; degrade-doesn't-wipe; cleared-stays-cleared (AC7) · GREEN live :54322 (landed in Plan 02, base-checkout-proven load-bearing)
- [x] `backend/tests/integration/test_112_flat_filter_with_source.py` — `@>` holds with `_source` present (AC8) · GREEN live :54322
- [x] `backend/tests/integration/test_112_custom_field_patch.py` — custom `field_key` PATCH round-trip (AC9) · GREEN live :54322
- [x] `frontend/src/components/metadata/ConfidenceChip.test.tsx` — tier mapping + honest states + never-"High"-unscored (AC2/AC3) · 8/8 GREEN
- [x] `frontend/src/components/metadata/InlineEdit.test.tsx` — Enter/Esc/blur/add-empty (AC10) · 7/7 GREEN
- [x] `frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx` — vitest-axe no-AA-failures (AC11) · 7/7 GREEN
- [x] **Added (CR-01 review-fix):** `backend/tests/unit/test_112_response_model_preserves_metadata.py` — `_source`/`_confidence`/custom keys survive `response_model` (AC5/AC9 regression) · 2/2 GREEN

*No framework install needed (pytest + vitest + vitest-axe all present).*

---

## Manual-Only Verifications

| Behavior | AC | Why Manual | Test Instructions |
|----------|----|-----------|-------------------|
| Panel "feels right" — desktop split push + mobile bottom-sheet open/close, list stays visible | AC1 | Lived-experience UX (G-4) not fully assertable by DOM shape | Chrome-MCP / operator: click a doc row → panel pushes in on desktop, bottom-sheet on mobile; list still visible; close restores focus to the trigger row |
| Low-confidence value distinguishable in **greyscale** | AC4 | Greyscale-triage survival is a visual judgment | Take a greyscale screenshot of a Low (`< 0.50`) field; confirm it reads tentative (italic + dim + leading ⚠) vs a High field |
| Full keyboard operability of panel + accordion + inline edit | AC11 | Keyboard reachability/order is a manual sweep beyond axe static checks | Tab to row → open panel by keyboard → toggle accordion → edit a field with Enter/Esc, all without a mouse |
| Re-extract preserves a human edit end-to-end via the UI | AC7 | The full UI→PATCH→reextract→UI round-trip is the lived-experience gate | Edit `title` in the panel, trigger re-extract, confirm `title` unchanged while another field refreshes; cross-check the `metadata.update` audit row live on :54322 |

*Remaining ACs (AC2, AC3, AC5, AC6, AC8, AC9, AC10) have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (10 stub files — all shipped + green)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (backend unit ~4.6s; full live integration ~5s; frontend ~4.4s)
- [x] The 4 live-DB assertions are encoded as integration tests against :54322 (all GREEN)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ validated 2026-06-18 — NYQUIST-COMPLIANT

---

## Validation Audit 2026-06-18

State A audit (existing pre-execution draft) reconciled against the 4 shipped plans + the CR-01 review-fix. Re-ran the full Phase 112 suite live: **21 backend tests GREEN** (11 unit + 10 integration against live Supabase :54322) + **22 frontend tests GREEN** (8 ConfidenceChip + 7 InlineEdit + 7 a11y) = **43/43 automated tests GREEN**.

| Metric | Count |
|--------|-------|
| Requirements (META-02, META-05, UX-01) | 3 |
| SPEC acceptance criteria (AC1–AC11) | 11 |
| Test files | 10 |
| Automated tests | 43 (all GREEN) |
| Gaps found | 0 |
| Resolved (auditor) | 0 (none needed) |
| Escalated to manual-only | 0 net-new (4 pre-declared G-4 gates retained) |

**Outcome:** No MISSING gaps. Every AC has automated verification except the 4 pre-declared G-4 lived-experience manual gates (AC1 panel feel, AC4 greyscale, AC11 keyboard sweep, AC7 end-to-end UI round-trip), already routed to `112-HUMAN-UAT.md`. No `gsd-nyquist-auditor` spawn required (zero gaps to fill). `nyquist_compliant: true`.

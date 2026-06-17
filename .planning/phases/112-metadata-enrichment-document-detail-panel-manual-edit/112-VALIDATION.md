---
phase: 112
slug: metadata-enrichment-document-detail-panel-manual-edit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
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

> Populated by the planner/Nyquist auditor against the final task IDs. Each task below maps to one or more SPEC acceptance criteria (AC1–AC11) and the Wave 0 test files. The planner MUST attach an `<automated>` verify (or a Wave 0 dependency) to every task per the sign-off rules.

| Task ID | Plan | Wave | Requirement | AC | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|----|-----------|-------------------|-------------|--------|
| {populated at plan time} | — | — | META-02/05 | AC1–11 | unit / integration / component / a11y | see SPEC→Test map below | ❌ W0 | ⬜ pending |

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

### Live-DB assertion map (the non-negotiable Nyquist gate)

- **Audit row written:** after PATCH, `SELECT count(*) FROM audit_log WHERE action_type='metadata.update' AND metadata->>'document_id'=$1` increments by 1 (baseline today = 0).
- **`@>` still matches:** `SELECT 1 WHERE metadata @> '{"document_type":"..."}'` still returns the row with `_source` present (proven live in research — encode as a test).
- **Re-extract preserves source=user:** edit field A via PATCH → trigger `/reextract` → poll `documents.metadata` until `status='completed'` → assert `metadata->'A' == edited` AND `metadata->'_source'->>'A' == 'user'` AND an un-edited field B changed.
- **Edit round-trips on reload:** PATCH → re-`GET /documents` (or re-fetch the row) → value + `_source='user'` persist (covers the Realtime best-effort reconcile path).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test stubs to create before/with the first implementing wave (all map to SPEC ACs):

- [ ] `backend/tests/unit/test_112_patch_metadata.py` — route validation (field allow-list, `_`-prefix reject, lowercasing) — META-05
- [ ] `backend/tests/integration/test_112_patch_audit.py` — live PATCH writes the audit row (AC5)
- [ ] `backend/tests/integration/test_112_patch_rls.py` — non-owner → 404 (AC6)
- [ ] `backend/tests/integration/test_112_reextract_merge.py` — `_source='user'` preserved across re-extract; degrade-doesn't-wipe (AC7)
- [ ] `backend/tests/integration/test_112_flat_filter_with_source.py` — `@>` holds with `_source` present (AC8; extend `test_111_flat_filter_compat.py`)
- [ ] `backend/tests/integration/test_112_custom_field_patch.py` — custom `field_key` PATCH round-trip (AC9)
- [ ] `frontend/src/components/metadata/ConfidenceChip.test.tsx` — tier mapping + honest states + never-"High"-unscored (AC2/AC3)
- [ ] `frontend/src/components/metadata/InlineEdit.test.tsx` — Enter/Esc/blur/add-empty (AC10)
- [ ] `frontend/src/components/metadata/*.a11y.test.tsx` — vitest-axe no-AA-failures (AC11)

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (9 stub files above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] The 4 live-DB assertions are encoded as integration tests against :54322
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

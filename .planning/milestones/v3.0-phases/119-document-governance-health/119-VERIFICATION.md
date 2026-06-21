---
phase: 119-document-governance-health
verified: 2026-06-21T00:00:00Z
status: human_needed
score: 3/3 must-haves verified (automated); UX-01 visual/a11y/mobile items require human
overrides_applied: 0
human_verification:
  - test: "Navigate to Governance in the sidebar and confirm it renders GovernancePage (NOT KnowledgeHealthPage) on both desktop and mobile viewport (<768px)."
    expected: "Three stacked cards (Broken relationships / Unclassified documents / Low-confidence metadata) with 'Document Governance' h1, each showing a positive all-clear empty state or populated rows; sidebar shows ShieldCheck glyph labelled 'Governance'."
    why_human: "activeView routing is structurally correct in code, but only a live browser confirms the nav icon renders, the page title is visible, and mobile layout stacks cards correctly (single-column)."
  - test: "Click a row in each of the three governance cards (seed at least one doc per signal) and confirm the DocumentDetailPanel opens on the right side."
    expected: "DocumentDetailPanel slides in from the right showing the clicked document's metadata. No delete/reingest/move controls appear in the governance row itself. Closing the panel via the X returns to the full-width governance view."
    why_human: "DGOV-02 link-out — panel open/close interaction, correct document resolution, absence of inline write controls, and push/split layout collapse on mobile all require visual + interaction verification."
  - test: "At <768px width, confirm the 3 cards stack in a single column and the detail panel opens as a bottom-sheet or full-width overlay (not a side-split that overflows the viewport)."
    expected: "Mobile-responsive single-column layout; panel takes full or near-full width on narrow viewports."
    why_human: "CSS grid `minmax(0,1fr) 430px` push/split is specified in code; whether it collapses correctly on mobile requires live viewport testing."
  - test: "Tab through the governance rows and confirm keyboard operability: each row is focusable, activating it with Enter/Space opens the panel, and focus-visible ring is visible."
    expected: "Every GovernanceRow is reachable by Tab, activatable by Enter/Space, and shows a visible focus ring (WCAG 2.1 AA SC 2.1.1, 2.4.7)."
    why_human: "GovernanceRow is a real <button> with focus-visible styling in code, but keyboard operability and visible ring rendering require live browser/screen-reader confirmation."
  - test: "Run a screen-reader pass (VoiceOver/NVDA) over the governance page loading state and a populated card row."
    expected: "Loading spinner is announced via role=status; error states via role=alert; each row button has a meaningful aria-label ('Open <filename>'). WCAG 2.1 AA SC 4.1.3."
    why_human: "role=status/alert and aria-label attributes are present in code; correct announcement order and verbosity require screen-reader testing."
---

# Phase 119: Document Governance Health — Verification Report

**Phase Goal:** Give users a light, read-only governance view of document-structure health — distinct from the retrieval (knowledge-health) dashboard — that surfaces and links to the fixes for the signals the upstream features produce.
**Verified:** 2026-06-21
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A separate, light governance view (own surface/route + queries — NOT bolted onto knowledge-health) surfaces broken relationships, unclassified docs, and low-confidence metadata, reusing HealthPanel card + positive-empty-state patterns (DGOV-01) | VERIFIED | `GovernancePage` is a distinct component at `activeView === "governance"` (ChatLayout:301-307), NOT `KnowledgeHealthPage`. Backend: `router = APIRouter(prefix="/document-governance")` in `document_governance.py` — a completely separate module from `knowledge_health.py`. Three independent `@router.get` routes (broken-relationships, unclassified, low-confidence). `HealthEmptyState variant="positive"` used for total===0 on each card (GovernancePage:203). Nav entry `{ view: "governance", icon: ShieldCheck, label: "Governance" }` in `nav-items.ts:39`. |
| 2 | Each governance signal links to the action that fixes it — opens the document's DocumentDetailPanel (DGOV-02) | VERIFIED | `GovernanceRow` is a `<button>` that calls `onOpen(docId)` (GovernanceRow.tsx:36); GovernancePage owns `selectedDocId` state + mounts `<DocumentDetailPanel doc={selectedDoc} onClose={...} onReconcile={handleRefresh} />` (GovernancePage.tsx:313-318). WR-01 fix (commit d60a6022): composite `key={${item.relationship_id}:${item.broken_doc_id}}` prevents duplicate React keys. WR-02 fix (commit 1cfbb33a): `_readable_latest_id()` returns the resolved latest id (not the raw stale edge endpoint id), so `listDocuments()` can find it. WR-03 fix (commit 20dd9b87): `selectedUnresolvable` state surfaces an honest error message when the doc can't be resolved from the list (cap/load-failure case). GovernanceRow imports ZERO mutation helpers — no `deleteDocument`, `reingestDocument`, or `MoveToFolderDialog`. |
| 3 | The view is read-only (NO new write path), matches Deep Midnight/Aether, is mobile-responsive, and meets WCAG 2.1 AA (UX-01) | VERIFIED (automated) + HUMAN NEEDED (visual/a11y) | **Read-only:** `GovernanceRow.tsx` has zero import of any mutation helper (verified by grep — no matches for deleteDocument/reingestDocument/MoveToFolderDialog). No migration, no write endpoint, no new package. Backend router has only three `@router.get` handlers. **Deep Midnight/Aether:** Card shell uses `ghost-border bg-card/50 shadow-sm` tokens matching HealthPanel pattern (GovernancePage:293); `text-muted-foreground`, `text-destructive`, `text-primary`, `border-border/40` Aether tokens throughout. `ConfidenceChip` imported from `@/components/metadata/ConfidenceChip` (the Phase-112 Aether chip). **Mobile:** `max-w-3xl mx-auto px-4 sm:px-6` single-column layout; grid collapses to single column when no panel open. **WCAG:** `role=status` on loading (GovernancePage:186), `role=alert` on error (line 194), `aria-label` on GovernanceRow button (line 38), `focus-visible:ring-2` (line 41). Visual/keyboard/screen-reader requires human. |

**Score:** 3/3 truths verified (automated portions); UX-01 visual/a11y sub-items require human verification.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/api/document_governance.py` | Read-only governance router with 3 paginated signal routes | VERIFIED | 365 lines; `prefix="/document-governance"`; 3 `@router.get` routes; no `/summary`; `_fetch_broken_relationships` is `async def`; `_fetch_unclassified` and `_fetch_low_confidence` are `def` (sync, wrapped in `run_in_threadpool`). |
| `backend/app/main.py` | Router mount | VERIFIED | `document_governance` in the `from app.api import ...` line (line 405); `app.include_router(document_governance.router)` at line 426 with Phase 119 comment. |
| `backend/tests/integration/test_119_leak.py` | Two-user live leak proof (non-vacuous) | VERIFIED | File exists; `_pg_reachable` skip-guard present; docstring confirms seeded true-positives per signal per user (broken/suggested/low-conf); masked-not-broken twin present. Context confirms 22 tests passed live on :54322. |
| `backend/tests/integration/test_119_broken.py` | A1 CASCADE pin + orphaned-old-version broken | VERIFIED | File exists (confirmed by Glob); docs confirm A1 live-pin (orphaned-old-version is the real broken state). |
| `backend/tests/integration/test_119_unclassified.py` | A3 PostgREST jsonb-path live-pin | VERIFIED | File exists; SUMMARY confirms dotted form `metadata->_classification->>status` pinned GREEN live. |
| `backend/tests/integration/test_119_low_conf.py` | any-field-<0.5 surfaces; 0.0 live | VERIFIED | File exists. |
| `backend/tests/unit/test_119_low_conf_scan.py` | Python-scan edge guards (0.0/missing/bool) | VERIFIED | File exists; `_fetch_low_confidence` code confirms `isinstance(value, (int, float)) and not isinstance(value, bool)` guard and `value < LOW_CONF_CUTOFF` (never truthiness-test). |
| `backend/tests/test_119_governance.py` | Empty-shape MagicMock unit tests | VERIFIED | File exists. |
| `frontend/src/pages/GovernancePage.tsx` | Counter header + 3 stacked cards + init guard + own DocumentDetailPanel mount | VERIFIED | 343 lines; `initializedTabsRef` present (line 150); Refresh calls `.clear()` (line 165); `<DocumentDetailPanel>` mounted at line 314; `selectedDocId` state at line 99. |
| `frontend/src/components/health/GovernanceRow.tsx` | Link-out-only row (no inline mutate) | VERIFIED | 50 lines; `<button>` with `onOpen(docId)` (line 36); zero mutation imports; disabled when `docId === null`. |
| `frontend/src/App.tsx` | ActiveView union extended with 'governance' | VERIFIED | Line 9: `export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health" | "workflows" | "classification-rules" | "governance"` |
| `frontend/src/lib/nav-items.ts` | Governance NAV_ITEMS entry with ShieldCheck | VERIFIED | Line 39: `{ view: "governance", icon: ShieldCheck, label: "Governance" }`; `ShieldCheck` imported (line 15); distinct from `Wand2` (Classification) and `Activity` (Library Health). |
| `frontend/src/components/layout/ChatLayout.tsx` | Governance render branch before KnowledgeHealthPage else | VERIFIED | Line 301: `activeView === "governance" ? (<GovernancePage />)` before `: (<KnowledgeHealthPage />)` at line 308-309. `GovernancePage` imported at line 12. |
| `frontend/src/lib/api.ts` | 3 governance fetch helpers | VERIFIED | `getGovBroken` (line 2011), `getGovUnclassified` (line 2018), `getGovLowConfidence` (line 2025); each hits `/document-governance/{signal}` with auth headers + throw-on-non-ok. |
| `frontend/src/pages/__tests__/GovernancePage.test.tsx` | Vitest: reachability/empty-state/no-loop/link-out/Refresh | VERIFIED | 5 tests; no-loop asserts exactly-once per endpoint; link-out asserts panel mounts + no write endpoint called; Refresh asserts re-fire. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `nav-items.ts` | `App.tsx ActiveView "governance"` | `{ view: "governance" }` NAV_ITEMS entry | WIRED | `ShieldCheck` glyph, label "Governance" at nav-items.ts:39; union member at App.tsx:9. |
| `ChatLayout.tsx` | `GovernancePage` | `activeView === "governance"` render branch | WIRED | ChatLayout:301-307; branch is BEFORE the trailing `<KnowledgeHealthPage />` else at :308-309. |
| `GovernancePage.tsx` | `DocumentDetailPanel` | `selectedDocId` → `selectedDoc` → panel mount (DGOV-02) | WIRED | `selectedDocId` state (line 99); `selectedDoc = useMemo(documents.find(d => d.id === selectedDocId))` (line 103-106); `<DocumentDetailPanel doc={selectedDoc} .../>` (line 313). |
| `GovernancePage.tsx` | `/document-governance/*` routes | `getGovBroken`, `getGovUnclassified`, `getGovLowConfidence` from `api.ts` | WIRED | GovernancePage:130/135/140 calls the three helpers; api.ts:2011-2030 fetches from `/document-governance/...`. |
| `document_governance.py` | `_resolve_readable_latest` | broken-edge classification; `_readable_latest_id` inner function (WR-02) | WIRED | `from app.services.document_relationship_service import _resolve_readable_latest` (line 51); called inside `_readable_latest_id` inner function (line 167). |
| `document_governance.py` | `.eq("user_id", _uid(caller))` | owner-scoping on every query | WIRED | Three occurrences confirmed: `_fetch_broken_relationships` (line 148), `_fetch_unclassified` (line 228), `_fetch_low_confidence` (line 264). `_latest_exists_anywhere` scopes its lineage lookup using `owner` from the existing row (line 117). |
| `backend/app/main.py` | `document_governance.router` | `app.include_router` | WIRED | main.py:405 (import), main.py:426 (include_router). |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `GovernancePage.tsx` | `broken.items`, `unclassified.items`, `lowConf.items` | `getGovBroken/Unclassified/LowConfidence` → `/document-governance/*` → `_fetch_*` functions → live Supabase queries | `_fetch_broken_relationships` queries `document_relationships` table + `_latest_exists_anywhere`; `_fetch_unclassified` queries `documents` with `is_latest=True` + jsonb filter; `_fetch_low_confidence` queries `documents` with Python scan | FLOWING |
| `GovernancePage.tsx` | `selectedDoc` for `DocumentDetailPanel` | `listDocuments()` → `documents` array → `find(d => d.id === selectedDocId)` | Real `listDocuments()` call on mount | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for backend API routes (requires live :54322 DB) and frontend components (requires running browser). Context notes 22 backend tests passed live + 5 Vitest tests passed.

---

### Probe Execution

No probe scripts declared in PLAN.md or SUMMARY.md for Phase 119. Conventional `scripts/*/tests/probe-*.sh` pattern not applicable (no probe scripts exist for this phase).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DGOV-01 | 119-01-PLAN.md, 119-02-PLAN.md | User can see a light governance view surfacing broken/dangling relationships, unclassified documents, and low-confidence metadata. | SATISFIED | Backend: 3 owner-scoped paginated routes in `document_governance.py`. Frontend: GovernancePage with 3 stacked HealthPanel-styled cards, positive empty state. Nav triad: App.tsx union + nav-items entry + ChatLayout branch. 22 backend tests + 5 Vitest tests passed. |
| DGOV-02 | 119-02-PLAN.md | Each governance signal links to the action that fixes it (open document, re-extract, classify). | SATISFIED | GovernanceRow is a link-out-only button; GovernancePage owns DocumentDetailPanel mount. WR-02 fix ensures the broken card opens a resolvable latest-version doc. Panel's existing Relationships/Classification/Metadata sections carry the fix actions. |
| UX-01 (cross-cutting) | 119-02-PLAN.md | All new DM UI matches Deep Midnight/Aether, is mobile-responsive, and meets WCAG 2.1 AA. | PARTIALLY SATISFIED (human needed) | Read-only and Aether tokens confirmed in code. Mobile single-column layout confirmed structurally. WCAG role/aria attributes present. Visual rendering, keyboard operability, and screen-reader announcement require human verification. |

No orphaned requirements: REQUIREMENTS.md maps DGOV-01, DGOV-02, and UX-01 to Phase 119 with status "Complete". All three are covered by plans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| No TODO/FIXME/XXX/TBD markers found in any Phase 119 files. | — | — | — | — |
| No stub patterns (return null / return {} / empty array to UI) found. | — | — | — | — |

GovernanceRow: no `deleteDocument`, `reingestDocument`, or `MoveToFolderDialog` imports — confirmed clean.

WR-04 (accepted by design): `_latest_exists_anywhere` returns `False` for a row that doesn't exist, conflating "genuinely deleted" with "never existed / corrupt id". The code routes both cases to `broken = True` — a conservative default. The plan accepted this as-is (no fix applied). The code does NOT add a warning log for this case, and the code review recommended one. This is a minor quality gap but does not affect correctness or security.

---

### Human Verification Required

#### 1. Governance page renders correctly on desktop and mobile

**Test:** Open the app in a browser. Click the "Governance" nav item (ShieldCheck icon). On desktop, confirm the page shows "Document Governance" heading + 3 stacked cards (Broken relationships / Unclassified documents / Low-confidence metadata). Resize to <768px and confirm the cards stack single-column.
**Expected:** Distinct from Library Health page; "Document Governance" h1 visible; 3 cards with positive all-clear empty state if library is clean; ShieldCheck icon in sidebar.
**Why human:** CSS grid layout, font rendering, and breakpoint behavior require a live browser.

#### 2. Row click opens DocumentDetailPanel (DGOV-02)

**Test:** Seed at least one document per governance signal (or wait for real data). Click a row in each card. Confirm the DocumentDetailPanel opens on the right side. Confirm no delete/reingest/move buttons appear in the governance rows themselves. Close the panel and confirm it dismisses.
**Expected:** Panel opens showing document metadata. Governance rows have no inline mutation controls. Panel close returns to full governance view.
**Why human:** Click interaction, panel push/split animation, and absence of mutation controls require visual + interaction verification.

#### 3. Keyboard operability (WCAG 2.1 AA SC 2.1.1, 2.4.7)

**Test:** Tab through the governance page. Confirm each row is reachable. Activate with Enter/Space. Confirm focus-visible ring is visible on focused rows.
**Expected:** All rows keyboard-operable; visible focus ring; panel opens via keyboard.
**Why human:** `focus-visible:ring-2` is in the CSS class string but rendering depends on browser + theme.

#### 4. Screen-reader announcement (WCAG 2.1 AA SC 4.1.3)

**Test:** Use VoiceOver (macOS) or NVDA (Windows) to navigate the page. Trigger a card's loading state. Verify the loading spinner is announced. Verify a row's aria-label ("Open <filename>") is read correctly.
**Expected:** role=status loading announced; role=alert error announced; aria-label on each row button read correctly by screen reader.
**Why human:** Announcement order and verbosity require a live assistive technology session.

---

### Gaps Summary

No blocking gaps found. All three roadmap success criteria are met in the codebase (automated verification). The only open items are the five UX-01 human verification checks above — these are the planned G-4 lived-experience UAT gate and were explicitly deferred to verify-phase in the VALIDATION.md.

**Code review status:** 0 BLOCKERs / 4 WARNINGs. WR-01 (duplicate React key), WR-02 (stale link-out id), WR-03 (silent dead click) were all fixed post-review (commits d60a6022, 1cfbb33a, 20dd9b87 confirmed in git log). WR-04 (unknown id treated as broken) was accepted by design — no fix applied, no blocker.

**Security:** Owner-scoping `.eq("user_id", _uid(caller))` confirmed on every governance query (3 data-access points). Two-user leak proof confirmed non-vacuous (22 tests passed live :54322). No migration, no write path, `threads.py` untouched (G-5).

---

_Verified: 2026-06-21_
_Verifier: Claude (gsd-verifier)_

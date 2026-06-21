---
status: complete
phase: 112-metadata-enrichment-document-detail-panel-manual-edit
source: [112-VERIFICATION.md]
started: "2026-06-18T02:30:00Z"
updated: "2026-06-18T18:00:00Z"
---

## Current Test

[testing complete — 5/5 resolved: 4 pass + 1 issue found→fixed→verified]

## Tests

### 1. Desktop push/split panel feel
expected: Click a document row on the live Documents page. The list column shrinks but stays fully visible; the 430px detail panel slides into place on the right; the list remains interactive; the panel closes cleanly and the list re-expands; focus returns to the clicked row.
result: pass
note: "User confirmed push/split feel works. Raised a design question (full-side overlay vs push/split) — captured as a design discussion, not a defect. See Gaps note D-1."

### 2. Mobile bottom-sheet
expected: At a viewport < 768px (or Chrome DevTools mobile emulation), clicking a document row opens the DocumentDetailPanel as a shadcn bottom-sheet (~80% viewport height); the list underneath is still visible; closing the sheet returns to the list without a hard refresh.
result: fixed
reported: "On mobile width I do not see documents."
severity: major
root_cause: "IngestionPage.tsx:89-103 was non-responsive — `flex flex-row` with a fixed 288px folder tree (`w-72 shrink-0`, no breakpoint). On a ~375px viewport the 288px tree + 24px gap left ~60px for the `minmax(0,1fr)` document-list column, crushing it to near-invisible. The DocumentDetailPanel bottom-sheet (DocumentDetailPanel.tsx:235-245) was itself correct — it just couldn't be reached because the list wasn't visible/tappable. The whole Documents page was never made responsive; only the panel was."
fix: "IngestionPage.tsx made responsive (mirrors WorkspacePanel/ChatLayout): local useIsMobile() (768px); folder tree column is now `hidden md:flex` and reachable on mobile via a `md:hidden` 'Folders' button that opens it as a bottom-sheet (reused folderTreeEl, selecting a folder dismisses the sheet); push/split grid forced to single `minmax(0,1fr)` column when isMobile (the panel portals out as its own bottom-sheet). Verified live @390px: Folders button shows current folder, list full-width + tappable, detail panel opens as bottom-sheet with full metadata. Desktop @1440px regression-checked: folder tree + list + 430px panel all render."

### 3. Greyscale triage — Low-confidence distinguishable without colour
expected: A field with confidence < 0.50 reads visually tentative in greyscale — the leading ⚠ glyph + italic + dim text together signal caution independently of hue; High and Low fields stay distinguishable in greyscale.
result: pass
verified_via: temporary-fixture
reason: "No live doc had a POPULATED field < 0.50 (lowest real = 0.70), so a temporary fixture was injected: analysis.txt TOPICS _confidence 0.84→0.30 (value untouched), verified, then restored byte-for-byte to 0.84 (backup captured + deleted). LIVE RESULT (screenshot): TOPICS rendered '⚠ LOW · 0.30' chip + the value 'performance, scaling, list processing' in italic + dimmed with a leading ⚠ glyph + red trust-gutter spine; section warn-count rose to 3 (1 low + 2 empty). The ⚠ glyph + italic + dim are all non-colour cues → low-confidence stays distinguishable in greyscale, independent of hue. Matches sketch 028-A. NOTE (data, not a defect): all current sub-0.50 scores sit on EMPTY fields (correctly shown as 'Not extracted — add'); a future re-extraction backfill would let real low-confidence values surface this styling without a fixture."

### 4. Full keyboard operability sweep
expected: Tab/Shift-Tab reaches every interactive element (close button, accordion header, field edit triggers, inputs, Enter/Esc commit/cancel); the accordion toggles on Space/Enter; focus lands on the input immediately when editing starts; Esc restores focus to the trigger button — all without a mouse.
result: pass
note: "Operator keyboard-swept the open panel — focus reached all interactive elements, accordion toggled, edit focus + Enter/Esc commit/cancel + focus-restore all worked without a mouse."

### 5. End-to-end inline edit → PATCH → audit row (live in browser)
expected: Edit a metadata field (e.g. Title) in the panel and press Enter; the "Saved · audit logged" receipt appears; the `:54322` audit table has a new row with `action_type='metadata.update'` and the correct `document_id`; the ConfidenceChip switches to neutral "Edited" after the panel reconciles via `loadDocuments()`. (This is the gate that confirms the CR-01 fix holds end-to-end — the "Edited" chip must survive the list re-fetch.)
result: pass
verified_via: claude-driven-browser+db
reason: "Claude drove the live edit on analysis.txt TITLE (backed up + restored after). UI: input focused immediately, Enter committed, chip flipped to neutral '✎ EDITED' (no score/green), green '🛡 Saved · audit logged' receipt shown. DB (:54322): documents.metadata.title persisted to the new value AND _source.title='user' stamped (the re-extract guard). audit_log gained exactly 1 row action_type='metadata.update' metadata={field:title, document_id:8dea5190…} (was 0). The 'EDITED' chip surviving the loadDocuments() re-fetch confirms the CR-01 extra='allow' fix holds end-to-end. All test mutations reverted: title restored, _source removed, test audit row deleted, backups removed — dev data pristine."

## Summary

total: 5
passed: 4
issues: 0
fixed: 1
pending: 0
skipped: 0
blocked: 0

## Design Notes (not defects — operator deliberations during UAT)

- **D-1 (Test 1, 2026-06-18): Panel width feels cramped on the Documents page.** Operator
  asked whether a full-side slide/overlay panel would be better than push/split.
  Root cause is NOT the push/split model — it's that the Documents page has 4 columns
  (nav rail · folder tree · list · 430px panel), which the 027-A decision (list+panel)
  didn't account for. Recommendation: KEEP push/split (preserves the scan→fix→next
  correction loop + it's the shared shell 117/118 plug into), but (a) collapse the
  folder tree to a thin rail when the detail panel opens [highest leverage], and
  (b) optionally widen panel 430→~480px ahead of 117/118 content.
  Full-overlay only wins if the real workflow is deep-read-one-doc, not triage-many.
  STATUS: awaiting operator decision — if pursued, route as a small follow-up
  (G-2 sketch is already satisfied by 027/028; this is a width/collapse tweak).

## Gaps

- truth: "At a viewport < 768px, the document list is visible and a document row can be tapped to open the DocumentDetailPanel as a bottom-sheet."
  status: fixed
  reason: "User reported: On mobile width I do not see documents."
  severity: major
  test: 2
  artifacts: ["frontend/src/pages/IngestionPage.tsx"]
  fix: "Made IngestionPage responsive — folder tree `hidden md:flex` + mobile 'Folders' bottom-sheet trigger + single-column grid on mobile. Verified live @390px and @1440px."

## Investigation Notes (operator concern, 2026-06-18 — NOT a defect)

- **Metadata coverage across folders — investigated with DB + live-browser evidence; working as designed.**
  Operator observed that root docs show metadata but folder docs appeared to have "no metadata extracted."
  EVIDENCE: (1) DB (`:54322`) — all 6 non-root folders are 100% populated (DBA 3/3, Hybrid Search 2/2,
  PM Demo 5/5, Meridian 3/3, Test Wasim 1/1, Weekly reports 5/5); only 6 of 14 ROOT docs are empty, and
  those 6 are all `uat111_axis*` Phase-111 test fixtures (incl. `axisd_garbage`, `axisc_longdoc`, and a few
  provider-null axisa rows) — expected-empty test artifacts, not real content. (2) Live panel — opened
  `kb_doc1_project_updates.md` (Weekly reports): all 7 fields render full VALUES (title/author/date/type/
  topics/language/summary). So extraction AND display are correct for folder docs.
  ROOT OF THE PERCEPTION: folder docs carry metadata VALUES but no `_confidence` map, so each field shows a
  neutral "✦ EXTRACTED" chip (no score/green) — by design (sketch 028-A honesty: never fabricate a "High").
  Recent root uploads (analysis.txt, the .docx/.xlsx from 2026-06-17) were extracted after Phase 111 added
  per-field confidence, so they show scored chips. The difference is confidence-score presence, not missing
  metadata. OPTIONAL follow-up if desired: a metadata re-extraction/backfill pass to add `_confidence` to the
  older folder docs so they gain the low-confidence triage signal.


---
phase: 270-the-document-as-an-object
plan: 04
subsystem: frontend
tags: [documents, download, file-facts, mounts, count-gate]
requires: [270-03]
provides: [panel Download row, File section, row Download, per-version Download, currentUserId prop]
affects: [270-05]
key-files:
  modified:
    - frontend/src/components/metadata/DocumentDetailPanel.tsx
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/components/ingestion/DocumentRow.tsx
    - frontend/src/lib/documentDownload.ts
    - frontend/src/lib/__tests__/documentDownload.test.ts
    - frontend/src/components/metadata/__tests__/DetailSections.lazy.test.tsx
    - frontend/src/components/metadata/__tests__/DetailSections.tables.test.tsx
    - scripts/vitest-count-gate.cjs
  created:
    - frontend/src/components/metadata/__tests__/DocumentDetailPanel.file270.test.tsx
    - frontend/src/components/ingestion/__tests__/DocumentRow.download270.test.tsx
requirements: [FIND-04, FIND-05]
completed: 2026-10-03
---

# Phase 270 Plan 04: Mounts Summary

The 270-03 units are mounted on the panel header (own row, keyed by `doc.id`), as the panel's first open "File" section, in the list row's Actions cell, and in every version-history row; hot files changed by mounts only.

## Commits

| Step | Commit |
|---|---|
| Task 1 RED | 5fa8bafb2 (6/6 failed: no Download button / File section yet) |
| Task 1 GREEN | 01f7c0aea |
| Task 2 RED | 96e306036 (4/4 failed: Actions cell button had no text) |
| Task 2 GREEN | acba25612 |

## Verification

- Targeted suites green: file270 (6), download270 (4), a11y, images, CR01.reset, DetailSections.lazy/tables, ChatLayout.scrollFrame, termMap, LibraryPage (17), DocumentList (+moveToFolder), HealthSignalChips, documentDownload, DocumentDownloadButton. One first-run LibraryPage red set (3 timeouts / a duplicate-subtitle query) occurred under 9-suite load and was green (17/17) when run alone; recorded as load flake, not this plan's change.
- Count gate (cap 2, run in worktree): `total 9147 · failed 0 · pinned total 8394` / `count gate OK — 351/351 pinned files present, no per-file decrease, 0 failing.`
- tsc `-p tsconfig.app.json`: 70 errors, same count as base; only LibraryPage ones are the pre-existing unused `TabsList`/`TabsTrigger` TS6133. No new member.
- Acceptance: no added `useState|useEffect|defaultOpen={false}` in the panel (0); LibraryPage numstat `1 0`; `DocumentList.tsx` unchanged; no new `<td>`.

## Deviations from Plan

1. **[Rule 1 - Bug] `downloadLabel` for an older v1.** Plan requires history row "Download v1 (viewed, not latest)" but the 270-03 unit returned bare "Download" for any v<=1, which is ambiguous beside "Download v3 (latest)". Changed to name an older row (`is_latest === false`) even at v1; added one assertion to the existing unit test. Files: `documentDownload.ts` (+test). Commit acba25612.
2. **[Rule 3] Order fences updated.** `DetailSections.lazy` and `DetailSections.tables` assert the panel section order from the DOM; "File" is now first by design, so both expect `File` before `Details`. Commit 01f7c0aea.
3. Worktree HEAD at start was not the expected base; reset to b46d50ac7 per protocol.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register (T-270-22 version button receives the version row, asserted; T-270-25 `key={doc.id}` reset, tested).

## Self-Check: PASSED
Created files exist; commits 5fa8bafb2, 01f7c0aea, 96e306036, acba25612 present.

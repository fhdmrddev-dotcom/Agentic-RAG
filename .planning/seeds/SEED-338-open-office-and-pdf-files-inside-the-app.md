---
seed_id: SEED-338
title: Open a Word, PDF, PowerPoint or Excel file inside the app — the in-panel viewer promised since v2.7 was never built; only download shipped
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Any phase whose files_modified names FilePreview.tsx, FilesSection.tsx, OutputFileCard.tsx or DocumentDetailPanel.tsx; OR the first customer demo or UAT row that opens a .docx/.pdf/.pptx/.xlsx deliverable; OR the milestone that scopes SEED-038 (one artifacts model) or SEED-148's remaining canvas/panel halves. Build it at that stage, not later."
trigger_paths: ["frontend/src/components/panel/FilePreview.tsx", "frontend/src/components/panel/FilesSection.tsx", "frontend/src/components/panel/CsvTablePreview.tsx", "frontend/src/components/chat/OutputFileCard.tsx", "frontend/src/components/metadata/DocumentDetailPanel.tsx", "backend/app/api/workspace.py"]
trigger_surfaces: ["panel", "library", "chat"]
migration_note:
relates_to: ["SEED-037 (the parent; its download half shipped)", "SEED-038", "SEED-148", "v2.9 STRETCH Phase 108 file_preview half (.planning/v2.9-STRETCH-CARRYFORWARD.md)", "docs/history/v2.7-agent-workspace-and-panel.md", "docs/history/v2.9-workflow-studio.md", "docs/history/v2.2-trust-and-compliance.md (in-PDF highlighting, deferred)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-338: open Office and PDF files inside the app

## The finding

The agent produces `.docx`, `.pptx`, `.xlsx` and `.pdf` files. The sandbox image has `python-docx`,
`python-pptx`, `openpyxl` and `reportlab` for exactly that purpose. The user can see these files but
cannot open one inside Syrel. Every one of them falls through to the same fallback:

- `frontend/src/components/panel/FilePreview.tsx:265`, `:287`, `:330` render
  `"No preview available · Download"`.
- `FilePreview.tsx` (407 lines) handles markdown, code, plain text, CSV (via `CsvTablePreview.tsx`) and
  images only. Measured 2026-10-04: no `pdfjs`, `react-pdf`, `mammoth` or `docx-preview` import
  anywhere in `frontend/src` or `frontend/package.json`.
- Knowledge-base documents can be downloaded (v4.5 Phase 270, `POST /documents/{id}/download-url`,
  `DocumentDownloadButton`), but not viewed in the detail panel either.

This was promised three times and dropped each time:

| Where | What was promised | What happened |
|---|---|---|
| v2.7 / Phase 087 (`SEED-037`) | in-panel viewing of Office/PDF/PPTX | only download shipped (Phase 101.1, `8b47e417`) |
| v2.9 STRETCH Phase 108 (`file_preview` half of PLUG-01) | an office/PPTX preview | never started |
| v2.2 deferred list | in-PDF highlighting of the cited passage | needs a PDF viewer first; never started |

**Why this is a new seed and not only an edit of SEED-037:** SEED-037 reads `status: shipped` with
`partial: true` (the D-16 encoding of "partially shipped"). That is accurate for its download half, but
every status-based scan reads `shipped` as done, so the viewer half was invisible to the sweep. This seed
holds the open half on its own, with structured `trigger_paths`, so it fires the next time any of those
files is planned. SEED-037 points here.

## Why it matters

The deliverable is the product. A workflow or chat that writes a report and then says "download it to
read it" breaks the flow at the moment the user is meant to be impressed, and it is the first thing a
demo audience tries. The operator raised it twice (2026-08-13: *"I remember somewhere we agreed to have a
viewer of PDF or Word files inside our application"*; and again at the 2026-10-04 history audit).

## When to surface

At the first of:
1. the next phase that edits `FilePreview.tsx`, `FilesSection.tsx`, `OutputFileCard.tsx` or
   `DocumentDetailPanel.tsx` (the gate's `trigger_paths` will print it);
2. the first customer demo or UAT row that opens a `.docx`/`.pdf`/`.pptx`/`.xlsx` deliverable;
3. the milestone that picks up `SEED-038` (one artifacts model) or the remaining halves of `SEED-148`.

The operator's direction is that this gets built at a defined stage. Do not defer it again without
writing down why.

## Scope estimate

Medium. Stage it:
1. **PDF** in the panel with a lazily loaded `pdf.js` viewer (largest share of deliverables and KB docs).
2. **DOCX / PPTX / XLSX**: either a client renderer (`docx-preview`, a sheet grid) or a server-side
   convert-to-PDF/HTML step in the sandbox, then reuse stage 1. Decide by measurement (bundle size and
   fidelity on the starter templates), not by preference.
3. **Knowledge-base documents** in `DocumentDetailPanel`, reusing the short-lived signed URL from Phase 270.
4. Later: jump to and highlight the cited passage (the v2.2 deferral).

Constraints: lazy-load the viewer so the chat bundle does not grow; render through the signed-URL path
only (no new public bucket); keep the existing Download button.

## Breadcrumbs

- `.planning/seeds/SEED-037-workspace-panel-file-viewing-and-download.md` (`open_half`)
- `.planning/v2.9-STRETCH-CARRYFORWARD.md` § 108
- `docs/history/v2.7-agent-workspace-and-panel.md` (status row "In-panel preview of Office/PDF files: still not built")
- `docs/history/v2.9-workflow-studio.md` (108 row)
- `docs/SANDBOX-PACKAGES.md` (the packages that produce these files)

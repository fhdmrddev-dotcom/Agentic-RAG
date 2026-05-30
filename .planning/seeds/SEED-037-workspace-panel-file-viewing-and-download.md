---
id: SEED-037
title: Workspace Panel — Full File-Type Viewing (Office/PDF) + Working File Download
status: planted
planted: 2026-05-29
planted_by: orchestrator (087 scenario-matrix round-3 testing)
trigger_when: A user needs to open or download a workspace file that is NOT markdown/code/csv/text/image — OR an operator notices the panel advertises "Download" but no button works — OR agents begin producing office/PDF artifacts users expect to view in-panel
priority: medium
tags: [frontend/panel, file-viewer, download, office, pdf, ux, phase-087]
---

# SEED-037: Workspace Panel — Full File-Type Viewing + Working Download

## Context

Phase 087 shipped the workspace panel's `FilePreview` with per-type routing for **markdown, code, plain text, CSV (table), and images** (image renders only when a bucket `signed_url` exists). Two gaps surfaced during 087 round-3 scenario testing (2026-05-29):

1. **Office/PDF/PPTX/DOCX have no in-panel viewer.** `application/pdf`, `application/vnd.*` (docx/xlsx/pptx) fall to the calm `"No preview available · Download"` fallback. There is also no path to view the user's **KB documents** (the `documents` table — e.g. the dissertation PDF/DOCX) in the panel at all: the panel is the agent's *scratch* (`workspace_files`), which is a separate store from the KB (`documents`, read by `search_documents`).

2. **There is NO working file download in the panel** (operator-reported + code-confirmed). `FilePreview`'s `Fallback` renders a Download button **only when an `onDownload` prop is passed** (`FilePreview.tsx:103`), but `FilesSection.tsx:158` mounts `<FilePreview>` without it, and `FilePreviewContent` never threads it down to `Fallback`/`CsvTablePreview`. So:
   - The `"· Download"` text in the fallback message is **dead text** — the button never mounts.
   - **Previewable** files (md/code/csv/text) have no download affordance at all.
   - The backend already CAN serve the bytes: `GET /threads/{tid}/workspace/files/{id}/content` returns inline `content` for inline files or a 60s `signed_url` for bucket files (`workspace.py:125`). It's purely an un-wired UI affordance.

## Why deferred

Phase 087's verified design contract covered the panel shell, the md/code/csv/diff/image-fallback preview routing, and the `ask_user` interrupt. Office/PDF rendering needs viewer libraries (pdf.js, a docx/xlsx/pptx renderer, or a server-side render-to-image/HTML step) — a meaningful feature, not in scope. The download wire-up is small but was outside the locked contract and untested, so it's captured rather than hot-patched at finalize.

## Re-open trigger

Promote to a phase when **any** of:
1. A user tries to open a non-text workspace file (pdf/docx/xlsx/pptx) and hits the fallback.
2. Operator confirms the dead "Download" affordance is a real friction (most likely — it's advertised but absent).
3. Agents start emitting office/PDF artifacts (e.g., python-pptx / openpyxl output) that users expect to view or download from the panel.
4. Demand to view KB documents (not just agent scratch) inside the panel.

## Likely shape if promoted

- **Quick win (could be a /gsd:quick):** wire `onDownload` from `FilesSection` → `FilePreview` → `Fallback`/`CsvTablePreview`. Inline files → download the decoded bytes as a Blob; bucket files → open/save the `signed_url`. Add a download button to the *previewable* paths too (not just the fallback). Fix the misleading "· Download" copy so it only appears when a real button is present.
- **Feature:** in-panel viewers — pdf.js for PDF; a client docx/xlsx/pptx viewer OR a backend render-to-preview (image/HTML) step. Weigh bundle size vs server cost.
- **Design question:** whether to surface KB `documents` in the panel (unified file view) or keep agent-scratch (`workspace_files`) and KB (`documents`) visibly separate. Ties to SEED-038.

## Related

- `.planning/phases/087-panel-ui/087-SCENARIO-MATRIX.md` — round-3 "Image preview" + "Gaps/design questions #1" rows
- SEED-038 — generated-files / artifacts model unification (overlapping "where do files live" concern)
- `project_087_panel_followups` memory — office/pdf + KB-docs-not-in-panel deferral
- Architecture: `workspace_files` (scratch, versioned) vs `documents` (KB) are separate stores; `workspace.py:125` content endpoint already supports download.

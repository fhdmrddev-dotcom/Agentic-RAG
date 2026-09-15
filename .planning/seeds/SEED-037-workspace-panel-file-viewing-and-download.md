---
seed_id: SEED-037
title: Workspace Panel — Full File-Type Viewing (Office/PDF) + Working File Download
status: shipped
partial: true
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: partially-shipped

  Mapped `partially-shipped` -> `shipped` + `partial: true`. Reason: D-16.
planted: 2026-05-29
planted_by: orchestrator (087 scenario-matrix round-3 testing)
updated: 2026-08-13
shipped_half: "Download wire-up — Phase 101.1 plan 09, commit 8b47e417, 2026-06-11"
open_half: "Office/PDF/DOCX/XLSX/PPTX in-panel viewer + KB-documents-in-panel — NOT built (zero pdfjs/react-pdf imports in frontend/src as of 2026-08-13)"
routed_to: "Phase 108 (file_preview half) — see REQUIREMENTS.md § Future Requirements"
trigger_when: RUN-02 makes produced files visible on the run surface (the REQUIREMENTS.md trigger) — OR a user needs to OPEN (not download) a workspace file that is NOT markdown/code/csv/text/image — OR demand appears to view KB documents in the panel
priority: medium
tags: [frontend/panel, file-viewer, download, office, pdf, ux, phase-087]
surface: Agentic-RAG
---

# SEED-037: Workspace Panel — Full File-Type Viewing + Working Download

## ⚠ Status — updated 2026-08-13 (this seed is HALF SHIPPED)

Raised by the operator (*"I remember somewhere we agreed to have a viewer of PDF or Word files inside
our application — I don't know where this was lost"*). It was not lost. It is here, and one of its
two halves has been closed for two months without this file saying so.

| Half | Status | Evidence — re-derivable, not asserted |
|---|---|---|
| **2 · Working download** | ✅ **CLOSED** | Shipped in **Phase 101.1 plan 09**, commit **`8b47e417`**, **2026-06-11** — *"downloadWorkspaceFile helper + raw-bytes route + wire Download button (gap 3)"*. Re-derive: `git log --oneline -G"onDownload" -- frontend/src/components/panel/FilePreview.tsx` |
| **1 · Office/PDF in-panel viewer** | ❌ **OPEN** | **Zero** `pdfjs` / `react-pdf` imports anywhere under `frontend/src` at 2026-08-13. PDF/DOCX/XLSX/PPTX still route to the calm `"No preview available · Download"` fallback (`FilePreview.tsx:265, :287, :319`). The **KB-documents-in-panel** question is untouched too. |

⚠ **The download half shipped in a DIFFERENT SHAPE than this seed proposed, and the difference
matters to whoever reads the "Likely shape" section below.** The seed's fix was *"thread `onDownload`
from `FilesSection` → `FilePreview`"*. What actually shipped is the opposite direction:
`FilesSection.tsx:192` still mounts `<FilePreview>` **without** an `onDownload` prop — `FilePreview`
now **owns** the download itself (`FilePreview.tsx:199`), computing the handler from
`resolved.status === "ready"` and calling `downloadWorkspaceFile(threadId, fileId, filename)`
(`api.ts:1628`) against a Bearer-authed raw-bytes route, with a local `downloadError` string rather
than a toast. So the affordance is no longer conditional on a caller remembering to pass a prop —
which is the stronger shape, and is why the prop-threading bullet below is now historical.

**Where the open half goes:** `REQUIREMENTS.md` § Future Requirements routes it to **Phase 108**
(`file_preview` half), and its trigger is **RUN-02** — *"produced files are visible on the run
surface"*. That sequencing is deliberate: there is no point building a viewer for files no surface
shows yet. **Not folded into Phase 193** (door copy + template placement — a different subsystem).

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

**Primary trigger (the one that governs — from `REQUIREMENTS.md` § Future Requirements):**
**RUN-02 makes produced files visible on the run surface.** Until then a viewer has nothing to open.

Promote the remaining half to a phase when **any** of:
1. A user tries to open a non-text workspace file (pdf/docx/xlsx/pptx) and hits the fallback.
2. ~~Operator confirms the dead "Download" affordance is a real friction~~ — **FIRED and CLOSED**
   (2026-06-11, `8b47e417`). Kept struck rather than deleted so the trigger's history stays legible.
3. Agents start emitting office/PDF artifacts (e.g., python-pptx / openpyxl output) that users expect to view or download from the panel.
4. Demand to view KB documents (not just agent scratch) inside the panel.

## Likely shape if promoted

- ~~**Quick win (could be a /gsd:quick):** wire `onDownload` from `FilesSection` → `FilePreview` →
  `Fallback`/`CsvTablePreview`…~~ — **DONE 2026-06-11, in a different and better shape:
  `FilePreview` owns the handler rather than receiving it as a prop.** See § Status above. Struck,
  not deleted, because the *shape difference* is the part a future reader needs.
- **Feature (the OPEN half):** in-panel viewers — pdf.js for PDF; a client docx/xlsx/pptx viewer OR a backend render-to-preview (image/HTML) step. Weigh bundle size vs server cost.
- ⚠ **Two decisions this seed does NOT yet make, and should not be planned without:** (a) client-side
  viewer libraries vs a server-side render step — a real bundle-size-vs-server-cost tradeoff, not a
  detail; (b) whether KB `documents` appear in the panel at all, or scratch and KB stay visibly
  separate (ties to SEED-038). Both belong in a discuss-phase, not in an executor's judgement.
- **Design question:** whether to surface KB `documents` in the panel (unified file view) or keep agent-scratch (`workspace_files`) and KB (`documents`) visibly separate. Ties to SEED-038.

## Related

- `.planning/phases/087-panel-ui/087-SCENARIO-MATRIX.md` — round-3 "Image preview" + "Gaps/design questions #1" rows
- SEED-038 — generated-files / artifacts model unification (overlapping "where do files live" concern)
- `project_087_panel_followups` memory — office/pdf + KB-docs-not-in-panel deferral
- Architecture: `workspace_files` (scratch, versioned) vs `documents` (KB) are separate stores; `workspace.py:125` content endpoint already supports download.

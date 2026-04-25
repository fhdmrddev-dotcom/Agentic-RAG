# Phase 47: Document List & Upload Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 47-document-list-upload-polish
**Areas discussed:** Root document visibility, File size limit, Duplicate file wording, Root upload UX

---

## Root document visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Add 'Root' section header | Show header + subtitle in right panel when Root selected | ✓ |
| Skip the header | Tree highlight is sufficient context | |

**Root node badge:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show count badge | Small doc count badge next to Root node in tree | ✓ |
| No badge needed | Plain label is sufficient | |

**Empty state copy:**

| Option | Description | Selected |
|--------|-------------|----------|
| Update both message and hint | "No root documents yet." + upload hint | ✓ |
| Keep current wording | "No documents uploaded yet." is fine | |

**User's choice:** Add count badge to Root node in FolderTree; add "Root" section header in right panel; update empty state copy and add upload hint for root.

---

## File size limit

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — 50MB per file | Backend 422 before storage upload | ✓ |
| Yes — 100MB per file | More generous, may exceed Supabase default | |
| Frontend-only validation | Instant feedback, no API protection | |
| Skip — out of scope | Existing fallback is sufficient | |

**User's choice:** 50MB backend check immediately after `raw = await file.read()`.

---

## Duplicate file wording

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 'already up to date' | Friendly, accurate, no change needed | ✓ |
| Change to 'Duplicate: already uploaded' | More literal | |
| Treat duplicate as error in red | Same visual weight as errors | |

**User's choice:** No change — "already up to date" satisfies DOC-05.

---

## Root upload UX

| Option | Description | Selected |
|--------|-------------|----------|
| Header fix covers it | DOC-04 root header provides the context | ✓ |
| Also add folder-context label in upload zone | Additional "Uploading to: Root" badge inside zone | |

**User's choice:** DOC-04 header is sufficient — no additional upload zone changes.

---

## Deferred Ideas

- Per-folder count badges on FolderNode items — out of scope for this phase
- Frontend pre-flight size validation — backend check sufficient for v2.4

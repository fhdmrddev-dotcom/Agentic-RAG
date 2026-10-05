---
seed_id: SEED-352
title: Library power features deferred since v1.0 — bulk move/copy/delete, folder-tree search and keyboard navigation, folder templates, drag-to-reorder, and import from a local folder
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Any phase whose files_modified names FolderTree.tsx, FolderNode.tsx, DocumentList.tsx, LibraryPage.tsx or backend/app/api/folders.py; OR a user or demo needs to move or delete more than a handful of documents at once; OR a library grows past ~50 folders."
trigger_paths: ["frontend/src/components/ingestion/FolderTree.tsx", "frontend/src/components/ingestion/FolderNode.tsx", "frontend/src/components/ingestion/DocumentList.tsx", "frontend/src/components/ingestion/DocumentRow.tsx", "frontend/src/pages/LibraryPage.tsx", "backend/app/api/folders.py", "backend/app/api/documents.py"]
trigger_surfaces: ["library"]
migration_note:
relates_to: ["SEED-005 (document management capabilities)", "SEED-243 (find the document)", "docs/history/v1.0-knowledge-base-explorer.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-352: Library bulk actions and folder-tree power features

## The finding

v1.0 deferred a list of Explorer features "to v2". Measured 2026-10-04, these are still not built:

| Deferred in v1.0 | Today |
|---|---|
| bulk move and copy (and, by extension, bulk delete) | no multi-select on document rows; move and delete are per document |
| folder-tree search | `FolderTree.tsx` has no search or filter |
| folder-tree keyboard navigation | `FolderTree.tsx` / `FolderNode.tsx` have no key handlers (`NavRow.tsx` has two, for its own row) |
| drag-and-drop folder ordering | no drag handlers in `components/ingestion` |
| folder templates | none |
| automatic import from a local folder | none (cloud folders sync since v4.0; a local/desktop folder does not) |

Already covered, not part of this seed: `head`/`tail` (the `read_document` tool takes `start_line` /
`end_line`), and cloud-folder watching (SEED-341 for its default).

## Why it matters

None of these block a demo. They block a real library: the first customer who uploads 300 files into the
wrong folder needs bulk move, and a tree with 80 folders needs search. Recording them stops the list being
lost a second time.

## When to surface

The next Library phase that touches the tree or the document list, or the first bulk-move request.

## Scope estimate

Medium if taken together; each item is Small alone. Bulk actions first (multi-select + one batched API with
per-item RLS checks and a single audit row), then tree search and keyboard navigation (an accessibility
gain too). Local-folder import is a separate desktop-agent question and should not ride along.

## Breadcrumbs

- `docs/history/v1.0-knowledge-base-explorer.md` (Gaps: "Deferred to v2")

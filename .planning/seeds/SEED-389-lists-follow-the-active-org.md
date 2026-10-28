---
seed_id: SEED-389
title: Library folders and the Workflows library list the user's own items from EVERY org, not the active one
created: 2026-10-27
surface: Agentic-RAG
status: folded
partial: false
status_note: "Folded into Phase 298 at discuss (2026-10-28). Decided PER-ORG (298 D-01); lists narrow at the list routes only (D-02..D-04). Original line: `status: planted`."
trigger_when: The next phase that touches fetch_visible_folders / the workflows library list, or the first customer who is a member of two orgs and reports seeing one org's folders in the other.
trigger_paths: ["backend/app/api/folders.py", "backend/app/utils/folder_utils.py", "backend/app/api/workflows.py"]
trigger_surfaces: ["library", "workflow"]
migration_note:
relates_to: ["296 G-4 scenario 1 observation", "BUG-261021-02 (create stamps the active org)"]
folded_into: "298"
renumbered_from: null
renumbered_because: null
---

# SEED-389: Library folders and the Workflows library list the user's own items from EVERY org, not the active one

## The finding

296 G-4 scenario 1 (2026-10-27): after switching to a second org, the Library listed the user's 32 first-org folders and 206 Root documents, and the Workflows page showed `Yours 148`. 296-01 made CREATE stamp the active org (verified), but `fetch_visible_folders` filters by owner (`user_id`) and global subtree, not by org; the workflows list behaves the same.

## Why it matters

With create org-stamped and list owner-scoped, a two-org user sees a mixed library and can pick one org's folder as a KB in the other's workflow. Not a cross-USER leak (all items are the user's own), so not urgent; it is a product decision whether a person's library is per-org.

## What to do

Decide per-org vs per-person; if per-org, filter lists by the validated active org (same `X-Org-Id` read create uses).

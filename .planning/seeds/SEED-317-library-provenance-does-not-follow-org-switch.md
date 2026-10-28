---
seed_id: SEED-317
title: The Library's "from <Expert>" provenance note is read once per mount and does not follow an org switch or a finished install
created: 2026-09-25
surface: Agentic-RAG
status: folded
partial: false
status_note: "Folded into Phase 298 at discuss (2026-10-28): the Library gains an active-org handle there (298 D-08), so the provenance effect re-reads on a switch. Previous note, verbatim: Reviewed at Phase 284 discuss (2026-10-16): fires on LibraryPage.tsx, but the Library still has no active-org handle; 284 D-24 data hook is the natural home for an org key once one exists. Re-open when the Library gains an org handle."
trigger_when: Any phase that gives LibraryPage an active-org handle, or touches org switching or Library refresh.
trigger_paths: ["frontend/src/pages/LibraryPage.tsx"]
trigger_surfaces: []
migration_note:
relates_to: ["266", "266-REVIEW IN-01"]
folded_into: "298"
renumbered_from: null
renumbered_because: null
---

# SEED-317: Library provenance does not follow an org switch

`LibraryPage.tsx:416-429` reads `listExpertInstalls()` in a `useEffect(..., [])`. If the Library stays
mounted across an org switch, or an install finishes while it is open, the caption stays missing until
the next remount. Folder ids differ between orgs, so it never shows a WRONG label, only a missing one.

Deferred at the 266 review triage because `LibraryPage` has no active-org handle to key the effect on,
so the fix is not a one-line dependency change. Fix: key the effect on the active org id (and
optionally on a Library refresh signal) once one is available there.

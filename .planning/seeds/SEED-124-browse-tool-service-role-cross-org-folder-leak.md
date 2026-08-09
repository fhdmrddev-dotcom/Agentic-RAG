---
seed_id: SEED-124
title: KB browse/read tools leak documents cross-org via org-blind service-role folder-visibility helpers
status: folded
planted: 2026-07-20
phase_origin: "Phase 164 deep code review (164-REVIEW.md CR-01 + WR-01) — verified live against the running DB + call graph"
folded_into: 165
category: security / tenancy-isolation — a service-role bypass of the membership org-scoping that RLS enforces everywhere else (the exact class the v3.4 milestone closes), on the KB browse/read tool surface that Phase 164's plans did not scope
related_seeds: [SEED-091]
related_decisions:
  - "D-164-01/02 (retrieval + text-to-SQL run on the asyncpg user-context) — 164 correctly closed the retrieval/hybrid-search/text-to-SQL paths; the KB browse/read tools are the un-swapped outlier."
  - "163 FIX-A / mig 109 — user is_global folders are org-scoped at the RLS level until orgs gain members (166/167); is_system stays platform-universal. The browse helpers must mirror this."
re_open_triggers:
  - "Phase 165 (`is_global` Retirement Cleanup) reaches plan — CR-01 MUST be closed there (Phase 165's scope already names `folder_utils.py`). If 165 ships without org-scoping the folder-visibility helpers, RE-OPEN as a standalone security phase."
  - "Any pen-test / security audit exercises the agent's ls/tree/read/fetch_document_file tools across two orgs and observes cross-org document content or filenames."
  - "The xfail marker `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` in test_v3_4_org_isolation.py flips to XPASS (strict) — the leak is closed; remove the marker and flip this seed to closed."
priority: high
suggested_phase: 165 (is_global Retirement Cleanup — the natural home; its scope already includes folder_utils.py)
---

# SEED-124 — KB browse/read tools leak documents cross-org (service-role, org-blind folder helpers)

## The gap (CR-01, verified live)

The agent's KB browse/read tools — `ls` / `tree` / `glob` / `read_document` / `fetch_document_file` (`backend/app/api/kb.py`, dispatched in `tool_dispatcher.py:223-255`) — run on the **service-role BYPASSRLS** client (`ctx.supabase = get_supabase()`, injected on the `send_message` producer seam, `threads.py`). They resolve folder visibility through `backend/app/utils/folder_utils.py`:

- `fetch_all_folders(supabase, ...)` — explicitly "using service role key (no RLS). Returns everything" (ALL orgs' folders).
- `is_in_global_subtree(folder_id, folder_map)` — returns `True` if the folder or **any ancestor** has `is_global=True`, with **no org predicate**.
- `get_globally_visible_folder_ids(supabase, user_id)` / `fetch_visible_folders(...)` — return any `is_global` folder in **any** org.

**Result:** once any user toggles a folder `is_global` (a live feature), a disjoint-org user's agent can enumerate that folder + its document filenames and read full document content cross-org via `read_document` / `fetch_document_file`. This bypasses the membership org-scoping that migration 108 (RLS) and migration 110 (the DEFINER bodies) enforce on every RLS-mediated path.

This is **pre-existing** (the helpers predate v3.4 — the legacy v1.0 "global folders shared across all users" semantics). Phase 163 org-scoped RLS; Phase 164 org-scoped retrieval/hybrid-search/text-to-SQL (correctly). The service-role browse-tool path was in neither phase's plans.

## Why it matters to the exit gate

`test_v3_4_org_isolation.py` (the milestone exit gate, TEN-05) had a **blind spot** — it never exercised the `folder_utils.py` browse-tool functions, so it falsely passed. Phase 164 added `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` (marked `xfail(strict=True)`, referencing this seed) so the gate now DOCUMENTS the known-open leak: the suite stays green while the leak is tracked, and when Phase 165 closes it the xfail flips to XPASS-strict → the marker fails → forcing its removal (the honest "tracked known-open" pattern).

## WR-01 (folded here too, lower severity)

`_null_foreign_global_owner` (SEED-091 / TEN-06) nulls the owner only when the row itself is `is_global`/`is_system`. Folders are visible via subtree **ancestry**, so a **non-global descendant** of a shared folder returns the seeder's real `user_id` through `list_folders` / `list_children` — an owner-UUID disclosure on the descendant path (SEED-091 class, "low"). Fix alongside CR-01 in Phase 165.

## The fix (when Phase 165 closes it)

Make the folder-visibility helpers **org-aware**, mirroring the mig-108/109 RLS predicate: a global folder is visible to a caller iff its `org_id` is in the caller's org set (folders have no `is_system` column, so no platform-universal branch for folders — that's skills-only). Concretely: `fetch_all_folders` selects `org_id`; resolve the caller's org_ids once (`SELECT org_id FROM org_members WHERE user_id = <caller>`); `is_in_global_subtree` / `fetch_visible_folders` / `get_globally_visible_folder_ids` treat a folder as globally-visible only when `org_id ∈ caller_org_ids`. This is belt-and-suspenders on the request path (user-JWT already RLS-scoped) and the load-bearing fix on the service-role producer path. Then flip the xfail marker → XPASS → remove it, and close this seed.

WR-02 (a Phase-164 regression — `_inject_folder_scope` mishandles trailing `ORDER BY`/`LIMIT`) was fixed in Phase 164 (gap-closure 164-05); it is NOT part of this fold.

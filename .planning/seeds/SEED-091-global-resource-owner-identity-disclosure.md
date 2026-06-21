---
seed_id: SEED-091
title: Global-resource owner-identity disclosure — non-owner callers see the seeding owner's auth UUID (+ scope UUID) on every globally-shared resource (folders, skills, views)
status: planted
planted: 2026-06-18
phase_origin: "Phase 113 execute-phase code review (113-REVIEW.md WR-03) + adversarial verification workflow wf_771026c7-211 (2026-06-18)"
category: privacy / security hardening — a cross-cutting serialization-surface decision (what owner-identity fields a global resource exposes to non-owner readers), NOT a new product feature
related_seeds: [SEED-080]
related_memories: [project_110_secured, project_111_secured, project_112_executed, feedback_cross_provider_always_top_of_mind, feedback_separate_per_feature_safe_by_construction]
related_decisions:
  - "D-113-3 / D-113-4 (globals are service-role/seed-only; own-OR-global readability gate) — establishes that global views are operator-seeded and readable by all; the leak is a property of that readability, shared with global folders + global skills."
re_open_triggers:
  - Any milestone that adds real multi-tenant / org isolation (v3.2 Multi-Tenancy) reaches spec — opaque owner auth UUIDs crossing tenant boundaries on shared resources is a tenancy-isolation question and the RLS rewrite is the cheapest moment to decide it.
  - A global resource ever carries an owner-identifying value that is NOT opaque (e.g. owner email/display-name surfaced on a shared folder/skill/view) — escalates this from "opaque UUID" to a real PII leak; fix immediately.
  - A privacy/security audit or pen-test flags cross-user identifier disclosure on `GET /folders`, `GET /skills`, or `GET /document-views`.
priority: low
suggested_phase: a future security-hardening or v3.2 Multi-Tenancy phase (decide once, app-wide). NOT folded into v3.0 Document Management — fixing only views while folders + skills leak identically would be inconsistent.
---

# SEED-091 — Global-resource owner-identity disclosure (folders / skills / views)

## The gap

Globally-shared resources expose the **seeding owner's opaque Supabase auth
`user_id` UUID** (and, for views, the `folder_scope` UUID) to **every** authenticated
caller via the list/serialize path — not just to the owner. Phase 113's saved
**views** inherit this exactly because they deliberately mirror the established
global-folder / global-skill sharing model (`document_view_service.py:14-16`:
"exactly like global folders and global skills").

| Property | State | Evidence |
|---|---|---|
| Who can create a global resource | Service-role / migration-seed only — **users cannot** | views: `is_global` hard-set False (`document_view_service.py:70`); same for folders/skills |
| What leaks to non-owner readers | The seeding owner's `auth.users.id` UUID + (views) the `folder_scope` UUID + the `filter_expr` AST | `ViewResponse` serializes `user_id` verbatim (`models/document_view.py:59-65`); `list_views` returns all `is_global=true` rows unmodified (`document_view_service.py:82-94`) |
| Pre-existing app-wide | **Yes — NOT a Phase 113 regression** | `GET /folders` returns `FolderResponse.user_id` as a **required** UUID for every globally-visible folder owned by another user (`models/folder.py:21-23`, `folder_utils.py:37-45`); global skills do the same |
| Severity | **Low** — opaque internal identifiers only; no email/name/credential/document content/rows; the owner UUID is not actionable (every documents query leg is caller-scoped, app predicates gate all data reads) | Verified: wf_771026c7-211 WR-03 verdict (exploitable but low; touches SC#3 = none — resolve path intact) |

## Why deferred (not fixed in Phase 113)

The adversarial verification (workflow `wf_771026c7-211`, 2026-06-18) confirmed
WR-03 is **real but low-severity and out of 113 scope**:

- It does **not** undercut Phase 113 SC#3 / VIEW-06 — that criterion is about
  per-viewer **document** leak-safety + 404-not-403, and the resolve path is intact
  (every documents leg scoped to the caller at `document_views.py:253/258-267`,
  readability-gate 404 at `:209`).
- The exposure is **identical and pre-existing** for global folders and global
  skills. Fixing only views would create an inconsistent serialization contract
  across the three global-resource surfaces.
- Whether to strip owner identity from shared resources is a **product/tenancy
  decision** best made once, app-wide — naturally co-designed with the v3.2
  Multi-Tenancy RLS rewrite.

## The minimal fix (when re-opened)

In each global-resource list/serialize path, null the owner-identifying fields on
global rows the caller does not own:

```python
# list_views / list_folders / list_skills — for each returned row:
if row.get("is_global") and str(row["user_id"]) != caller:
    row["user_id"] = None
    row["folder_scope"] = None  # views only
```

For views this is shape-compatible already (`ViewResponse.user_id: str | None`,
`folder_scope: UUID | None`); `FolderResponse.user_id` is a **required** UUID and
would need its model loosened to `UUID | None`. Apply uniformly to folders +
skills + views in the same change so the contract is consistent.

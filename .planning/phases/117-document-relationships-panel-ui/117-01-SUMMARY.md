---
phase: 117
plan: 01
subsystem: document-relationships
tags: [backend, extraction, leak-safe-read, share-dont-fork, REL-02, D-117-7]
requires:
  - "Phase 116: document_relationship_service (_resolve_readable_latest, _subject_version_ids, _uid, create/delete) + the _handle_get_related_documents agent tool"
  - "Phase 116 gap-closure 116-05: CR-01 is_latest-gate + post-follow folder re-check, CR-02 _subject_version_ids lineage"
provides:
  - "document_relationship_service.get_related_documents — the ONE shared, FastAPI-free leak-safe outgoing+incoming read traversal (consumed by the agent tool now + the Plan-02 GET route next)"
  - "Relocated _INVERSE_LABEL / _NO_ACCESS_MASK in the service (single source of truth for both callers + the frontend display mirror)"
  - "Per-row relationship_id additively carried through the read payload (the panel remove ✕ needs it)"
  - "Three Wave-0 backend test scaffolds: test_117_route_leak.py, test_117_get_read.py, test_117_no_fork.py"
affects:
  - "tool_dispatcher._handle_get_related_documents (now a thin caller; behavior-preserving + additive relationship_id)"
tech-stack:
  added: []
  patterns:
    - "Extract-don't-fork the leak-safe read (the 115 document_view_resolver precedent) — one traversal, two callers"
    - "FastAPI-free service core returning a plain dict; None on an unreadable/unknown subject (no raise)"
key-files:
  created:
    - backend/tests/integration/test_117_route_leak.py
    - backend/tests/integration/test_117_get_read.py
    - backend/tests/unit/test_117_no_fork.py
  modified:
    - backend/app/services/document_relationship_service.py
    - backend/app/services/tool_dispatcher.py
decisions:
  - "No-fork guard tokens reconciled to the two TRUE fork tokens (mask string + .in_() edge query); _resolve_readable_latest is a legitimately-shared call in the route (the 116 create gate), NOT a fork — Rule 1 faithful adjustment"
  - "The shared fn returns {subject, total, documents, source_refs}; the mode/note agent framing stays in the handler (so the handler owns the ToolResult packaging, the route returns the dict)"
  - "relationship_id is additive on the agent's rows too (the 116 strict-shape tests access keys, not exact-key sets — verified non-breaking)"
metrics:
  duration_min: 25
  tasks: 3
  commits: 3
  files_created: 3
  files_modified: 2
  completed: 2026-06-20
---

# Phase 117 Plan 01: Backend Read Seam — Extract the Leak-Safe Relationship Read (D-117-7) Summary

Extracted the leak-safe outgoing+incoming relationship read traversal — previously living
ONLY inside the agent-tool handler `tool_dispatcher._handle_get_related_documents` — into a
single shared, FastAPI-free `document_relationship_service.get_related_documents(...)`, and
refactored the agent handler into a thin caller of it. This is the D-117-7 "share, do NOT
fork" core: one implementation of the access-gating traversal, consumed by the agent tool
now and by the net-new GET route (Plan 02) next — mirroring the Phase 115
`resolve_filter` → `document_view_resolver.py` move.

## What Shipped

- **`get_related_documents(caller, *, document_id, filename, supabase)`** in
  `document_relationship_service.py` — FastAPI-free, returns a plain dict
  `{subject: {document_id, filename}, total, documents: [...rows...], source_refs: [...]}`,
  or `None` for an unreadable/unknown subject (calm — never a raise). Lifted verbatim from
  the agent handler: subject resolve via `_resolve_readable_latest` (the sole access gate),
  two own-scoped edge queries over the full `(user_id, filename)` version-id set via
  `.in_()` (CR-02 follow-to-latest), per-edge other-endpoint readability re-check → an
  unseeable endpoint masks as `_NO_ACCESS_MASK` + `document_id: None` (CR-01 / D-117-8).
- **The A6 shape change:** each row additively carries `relationship_id` (= the edge `id`)
  so the panel's remove ✕ can call `DELETE /{id}`. The agent handler previously selected
  the edge `id` but dropped it in `_append_edge`.
- **Relocated `_INVERSE_LABEL` + `_NO_ACCESS_MASK`** into the service module (the single
  source of truth for both backend callers + the frontend's display-casing mirror, D-117-6).
- **`_handle_get_related_documents` is now a thin caller:** parse the subject identifier →
  delegate to the shared fn → map `None` to the existing calm `not_found` string →
  re-package into the agent-facing `ToolResult` (the `mode`/`note` framing + `source_refs`).
  The agent output is byte-identical except the additive per-row `relationship_id`.
- **Three Wave-0 backend scaffolds** (RED→GREEN within this plan):
  - `test_117_route_leak.py` — the LIVE two-user leak proof driving the SHARED fn (the
    boundary the Plan-02 route inherits); masked far endpoint → `document_id` None + mask
    string, real filename for the owner. **Marked for secure-phase confirmation (D-117-8).**
  - `test_117_get_read.py` — GET-shape read over the version set (both directions + inverse
    label + `relationship_id`), follow-to-latest, and create-appears/remove-reflects live.
  - `test_117_no_fork.py` — the source-grep guard (mask + `.in_()` live ONLY in the service).

## Verification

- **117 set GREEN live on :54322:** `test_117_get_read.py` (3) + `test_117_route_leak.py`
  (2) + `test_117_no_fork.py` (3) all pass. The route-leak + get-read scaffolds were RED at
  Task 1 (xfail), GREEN after Task 2's extraction (xpass; un-marked at validate-phase).
- **116 regression backstop GREEN:** the full Phase-116 surface (`test_116_tool_leak`,
  `test_116_tool_read`, `test_116_version_stable`, `test_116_handler`, plus tool_schema,
  tool_wiring, whitelist_guard, audit_live, idempotency, crud) stays green — the full
  `116 or 117` set is **36 passed / 7 xpassed** live on :54322. The agent tool's masked
  rows / `source_refs` / direction+label are byte-identical; only `relationship_id` is added.
- **No-fork guard:** the mask string and `.in_()` edge query appear ONLY in
  `document_relationship_service.py` (route file = 0 of each).
- **`threads.py` byte-untouched** (G-5): `git diff ee30436b -- backend/app/api/threads.py`
  is empty.
- **Net-new test failures = 0 (base-checkout proven):** I changed shared code
  (`tool_dispatcher.py` + the service module), so per the project rule I ran the full unit
  suite at HEAD (60 failed / 963 passed) and at the base source (`ee30436b` checked out for
  the two changed files: 60 failed / 963 passed). The failure SETS are identical (the only
  diff was a cosmetic RuntimeWarning fragment appended to one captured line) — the same 60
  pre-existing failures (test_sql_service, test_streaming_reliability, etc., unrelated to
  relationship code) reproduce at base. **No new failure introduced.**
- **No new package, no new migration.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] No-fork guard token set reconciled — `_resolve_readable_latest` is a
legitimately-shared call in the route, not a fork**
- **Found during:** Task 1 (authoring `test_117_no_fork.py`).
- **Issue:** The plan's Task-1c acceptance specified asserting that the substring
  `_resolve_readable_latest` does NOT appear in `document_relationships.py`, on the stated
  assumption that "the route file does not exist yet (Plan 02)." But the route file DOES
  exist (Phase 116 shipped POST/DELETE), and its POST create handler **legitimately calls**
  `document_relationship_service._resolve_readable_latest(...)` for the visible-both gate —
  exactly the "share, don't fork" pattern (mirroring how `document_views.py` calls the
  shared `resolve_filter`). Asserting that token absent would falsely flag correct sharing
  as a fork.
- **Fix:** The guard asserts the two tokens that UNIQUELY identify a forked READ TRAVERSAL —
  the mask string `"linked document (no access)"` and the `.in_(` edge query — are absent
  from the route and present in the service. `_resolve_readable_latest` is explicitly
  documented (in the test + here) as a sanctioned shared call. Verified the route currently
  has 0 mask strings and 0 `.in_(` (the true fork tokens), so the guard is correct + GREEN.
- **Files modified:** `backend/tests/unit/test_117_no_fork.py`
- **Commit:** `f7def525`

**2. [Rule 3 - Blocking] Re-applied the Task-3 handler refactor after the base-checkout
net-new-failure proof reverted it**
- **Found during:** Task 3 verification (base-checkout comparison).
- **Issue:** The net-new-failure proof required checking out the base versions of the two
  changed source files. Task 3's `tool_dispatcher.py` refactor was working-tree-only (not
  yet committed) when I ran the proof; restoring files via `git checkout HEAD -- ...`
  reverted that uncommitted refactor.
- **Fix:** Re-applied the identical Task-3 edit, re-verified the grep acceptance + the full
  116+117 regression (36 passed / 7 xpassed), then committed. No behavior difference — the
  re-applied edit is byte-identical to the original.
- **Files modified:** `backend/app/services/tool_dispatcher.py`
- **Commit:** `ca91f564`

## Threat-Model Adherence

All three plan-register threats are satisfied by construction:
- **T-117-01-01 (Info Disclosure / far-endpoint masking):** the per-edge other-endpoint
  re-check via `_resolve_readable_latest` masks unreadable endpoints as `_NO_ACCESS_MASK` +
  `document_id: None`; proven by `test_117_route_leak.py` LIVE two-user (marked for
  secure-phase).
- **T-117-01-02 (Tampering / owner-scoping):** edge queries are `.eq("user_id", _uid(caller))`
  with the UUID-coercing `_uid` — reused verbatim from the hardened service.
- **T-117-01-03 (Info Disclosure / extraction drift):** exactly ONE traversal
  implementation; `test_117_no_fork.py` is the grep guard; the 116 suite is the
  behavior-preservation backstop.
- **T-117-01-SC (supply-chain):** vacuously clean — zero new packages.

## Known Stubs

None — this plan ships a complete, working, leak-safe read core consumed live by the agent
tool. The Plan-02 GET route + the Plan-04 frontend wire the same core to the panel.

## Self-Check: PASSED

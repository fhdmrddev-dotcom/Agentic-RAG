---
phase: 117
plan: 02
subsystem: document-relationships
tags: [backend, rest-read-seam, leak-safe-read, share-dont-fork, REL-02, D-117-7, D-117-8]
requires:
  - "Phase 117 Plan 01: document_relationship_service.get_related_documents — the ONE shared, FastAPI-free leak-safe outgoing+incoming read traversal (consumed in-process by this route)"
  - "Phase 116: api/document_relationships.py router (POST/DELETE) already mounted in main.py:424; _resolve_readable_latest shared create gate"
provides:
  - "GET /document-relationships?document_id={id} — the net-new authenticated REST read seam the Phase 117 panel (Plan 04) consumes; a THIN auth + threadpool wrapper over the shared read core"
  - "The LIVE two-user ROUTE leak proof (test_117_route_leak.py route tests) — the net-new caller boundary the secure-phase must confirm non-vacuous on :54322"
  - "Route-level direction/label/relationship_id read-shape proof (test_117_get_read.py route test) — the exact dict shape the panel renders, preserved by the no-response_model return"
affects:
  - "api/document_relationships.py (additive GET handler; POST/DELETE byte-untouched)"
tech-stack:
  added: []
  patterns:
    - "Thin REST wrapper over the shared leak-safe core (the document_views.py:resolve_view precedent) — auth → shared fn → plain dict; no fork, no re-implemented access logic"
    - "Uniform 404 on None (unreadable/unknown subject) — no existence-probe oracle; mirrors resolve_view 404-not-403"
    - "No response_model on a read route (the 112 CR-01 lesson — a tight model strips direction/label/relationship_id/masked rows)"
    - "No audit on a read (VALID_ACTION_TYPES has no relationship.read enum; mirrors resolve_view)"
    - "Drive the HTTP route via TestClient with auth+supabase deps overridden (inject A vs B + real service-role client) — exercises the WHOLE handler, not the in-process fn"
key-files:
  created: []
  modified:
    - backend/app/api/document_relationships.py
    - backend/tests/integration/test_117_route_leak.py
    - backend/tests/integration/test_117_get_read.py
decisions:
  - "Route-driving tests use a FastAPI TestClient with only the two boundary deps overridden (get_current_user → A|B, get_supabase → real service-role client) so the REAL route handler runs (auth boundary → threadpool-wrapped shared fn → 404 mapping) — the net-new HTTP caller surface the 116 TOOL-only suite never exercised"
  - "Two docstring literals removed from the route prose ('linked document (no access)' and 'relationship.read') because the no-fork grep guard + the plan's acceptance grep are literal-substring checks — explanatory prose mentioning the mask string would falsely trip them; reworded to describe-without-quoting (Rule 1 faithful adjustment)"
  - "Net-new-failure proof scoped to the ONE changed source file (the additive GET route); base-checkout of document_relationships.py → identical 60/963 unit failure set → zero net-new failures"
metrics:
  duration_min: 8
  tasks: 2
  commits: 2
  files_created: 0
  files_modified: 3
  completed: 2026-06-20
---

# Phase 117 Plan 02: REST Read Route — Thin GET over the Shared Leak-Safe Core (D-117-7) Summary

Added the net-new authenticated `GET /document-relationships?document_id={id}` route to the
existing Phase-116 `document_relationships.py` router. It is a THIN wrapper — auth (caller-scoped
JWT) → the shared `document_relationship_service.get_related_documents` (Plan 01) → the plain
dict; a `None` return (unreadable/unknown subject) maps to a UNIFORM 404; NO audit write; NO
fork of the leak-safe traversal. This is the REST read seam the relationship PANEL (Plan 04)
consumes — and the net-new caller of the shared leak-safe core, so this plan adds the LIVE
two-user ROUTE leak proof the secure-phase must confirm.

## What Shipped

- **`GET /document-relationships` route** (`get_relationships`) on the existing router —
  `document_id` query param, `Depends(get_current_user)` (caller-scoped JWT, never
  subject/edge-owner-scoped) + `Depends(get_supabase)`, mirroring the POST/DELETE auth shape.
  Body: `caller = current_user["id"]` → `await get_related_documents(caller, document_id=...,
  supabase=...)` → `None` ⟶ `HTTPException(404, "Document not found")` (uniform, no existence
  leak, mirrors `resolve_view`) → else `return result` (plain dict, **NO `response_model`** —
  the 112 CR-01 lesson, so `direction`/`label`/`relationship_id`/the masked rows survive).
  The shared fn already rides `aexec`/`run_in_threadpool` for every query (D-v2.5-01), so the
  route adds **no bare supabase call**. **No audit** — `VALID_ACTION_TYPES` has only
  `relationship.create`/`relationship.delete`, no read enum (confirmed in `audit_service.py`).
  POST/DELETE byte-untouched.

- **The LIVE two-user ROUTE leak proof** (`test_117_route_leak.py`, 3 net-new route tests):
  drives the REAL HTTP endpoint via a FastAPI `TestClient` with `get_current_user` overridden
  to inject A vs B and `get_supabase` overridden to the REAL service-role client — so the WHOLE
  route handler runs (the auth dependency boundary → the threadpool-wrapped shared fn → the
  uniform-404 mapping), not the in-process fn. This is the net-new caller surface the 116 suite
  (TOOL boundary only) never exercised.
  - **B masked:** B GETting the SAME subject A can also read sees the far endpoint MASKED
    (`document_id is None` + the mask string) and NEVER A's private id/filename/metadata.
  - **A real (non-vacuity twin):** A GETting the SAME subject sees the target's REAL filename —
    the mask is access-driven, not a blanket null (proves B's masked result is genuine).
  - **Uniform 404:** an unknown id AND a real-but-unreadable subject (B asking for A's private
    doc) both collapse to the SAME 404 — never 403, never a 200-with-partial-leak (no oracle).

- **Route-level read-shape proof** (`test_117_get_read.py`, 1 net-new route test):
  confirms the REAL route returns `subject`/`total`/`documents` with `direction` + `label`
  (inverse label on the incoming row) + `relationship_id` per row over the version set — the
  exact dict the panel renders, preserved by the no-`response_model` return.

## Verification

- **Task 1 acceptance (all GREEN):** `grep -c "@router.get"` = 1; the route's fork tokens are 0
  (`grep -c "linked document (no access)"` = 0, `grep -c "\.in_("` = 0, `grep -c "relationship.read"`
  = 0); the GET handler body calls no `write_audit_entry` (the two audit calls live in
  POST/DELETE, lines 191/229); `test_117_no_fork.py` passes (1 passed / 2 xpassed); the GET route
  is registered (`/document-relationships` methods = GET + POST).
- **Task 2 acceptance (all GREEN live :54322):** the 4 net-new route tests
  (`test_route_masks_unreadable_endpoint_for_other_viewer`, `test_route_shows_real_filename_for_owner`,
  `test_route_uniform_404_for_unreadable_or_unknown_subject`,
  `test_route_returns_direction_label_relationship_id`) all PASS (verified not skipped via `-v`).
  The route-leak file = 4 passed / 5 xpassed; the get-read file included.
- **Full `116 or 117` set GREEN live on :54322:** **40 passed / 7 xpassed / 0 failed** (up from
  Plan 01's 36 passed / 7 xpassed — the +4 are the new route tests; 116 regression fully preserved).
- **`threads.py` byte-untouched (G-5):** `git diff 0801317d -- backend/app/api/threads.py` empty.
- **Net-new test failures = 0 (base-checkout proven):** the only changed source file is the
  additive GET route. Base-checkout of `document_relationships.py` (GET reverted) ran the full
  unit suite at **60 failed / 963 passed**; HEAD (GET present) ran at **60 failed / 963 passed** —
  identical failure set (the same pre-existing rot: test_sql_service, test_streaming_reliability,
  etc., none relationship-related, documented at Plan 01). The route is byte-identical to the
  committed version after restore (`git diff --stat` empty).
- **No new package, no new migration.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed two literal substrings from the route docstring so the no-fork grep
guards stay honest and GREEN**
- **Found during:** Task 1 (after adding the GET route).
- **Issue:** My first-draft route docstring described the masking behavior by quoting the literal
  mask string `"linked document (no access)"` and naming `relationship.read` in prose. But BOTH
  `test_117_no_fork.py` (`_MASK not in route_src`) AND the plan's Task-1 acceptance
  (`grep -c "linked document (no access)" == 0`, `grep -c "relationship.read" == 0`) are
  literal-substring guards — explanatory prose that merely MENTIONS the mask string or the read
  enum would falsely trip them as a "fork" / "read audit", even though the route forks nothing
  and writes no audit.
- **Fix:** Reworded the docstring to describe the behavior WITHOUT quoting the two guarded
  literals ("an unreadable endpoint is masked (`document_id: None` + the no-access mask string the
  SERVICE owns)"; "there is no read action type"). Re-verified all four grep counts = 0 and the
  no-fork guard GREEN. The route's actual behavior is unchanged.
- **Files modified:** `backend/app/api/document_relationships.py`
- **Commit:** `11bd6f86`

### Out-of-scope (untouched)

- A pre-existing `D backend/README.md` deletion and several untracked working-tree files
  (`backend/RUN-BACKEND.md`, `backend/scripts/115_*_results.json`,
  `backend/settings_override.json.migrated`) appear in the working tree from prior phases
  (075.4-era / 115). They were already acknowledged and left untouched at Plan 116-03
  ("Pre-existing `D README.md` left untouched + logged to deferred-items"). They are NOT caused
  by this plan's changes (scope boundary) and were NOT staged in either of this plan's commits.

## Threat-Model Adherence

All five plan-register threats are satisfied by construction + the LIVE route proof:
- **T-117-02-01 (Info Disclosure / cross-user leak via the new GET):** the route scopes from the
  CALLER (`current_user["id"]`), never the subject/edge owner; all masking is in the shared core.
  Proven by the LIVE two-user ROUTE leak test (B masked, A real over the SAME subject) — **marked
  for secure-phase non-vacuity confirmation** (D-117-8 / D-102 "static would false-green").
- **T-117-02-02 (Info Disclosure / fork drift):** the route contains 0 mask strings, 0 `.in_(`
  edge queries, 0 forked traversal; `test_117_no_fork.py` GREEN. It only calls
  `get_related_documents`.
- **T-117-02-03 (Info Disclosure / existence-probe oracle):** uniform 404 on unreadable/unknown
  subject — the route test drives BOTH an unknown id and a real-but-unreadable subject to the
  SAME 404 (never 403, never 200).
- **T-117-02-04 (DoS / blocking I/O):** the route adds no bare supabase call; the shared fn rides
  `aexec`/`run_in_threadpool` for every query.
- **T-117-02-05 (Spoofing / unauthenticated read):** `Depends(get_current_user)` (JWT) — same as
  every other endpoint; no net-new auth.
- **T-117-02-SC (supply-chain):** vacuously clean — zero new packages.

## Known Stubs

None — this plan ships a complete, working, leak-safe REST read route consumed live by the
route-driving tests. The Plan-04 frontend wires the panel to this route.

## Self-Check: PASSED

- Files verified present: `117-02-SUMMARY.md`, `document_relationships.py`,
  `test_117_route_leak.py`, `test_117_get_read.py`.
- Commits verified in git log: `11bd6f86` (feat — GET route), `343016e8` (test — route-driving).
- The committed route file contains exactly 1 `@router.get` handler.

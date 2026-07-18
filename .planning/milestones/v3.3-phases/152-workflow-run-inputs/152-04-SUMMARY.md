---
phase: 152-workflow-run-inputs
plan: 04
subsystem: frontend
tags: [WFIN-03, delete-cascade, workflows, victim-naming-sheet, react, vite, dropdown-menu, radix]

# Dependency graph
requires:
  - phase: 152-workflow-run-inputs
    plan: 02
    provides: DELETE /{id}/cascade + GET /{id}/delete-preview (owner-gated, cancel-first) in api/workflows.py
  - phase: 152-workflow-run-inputs
    plan: 03
    provides: reworked WorkflowsPage/RunModal (23 WorkflowsPage + 7 RunModal green tests; api.ts touched this phase)
provides:
  - api.ts deleteWorkflowCascade(id) + getWorkflowDeletePreview(id) + WorkflowDeletePreview interface (distinct cascade + preview routes)
  - PublishedCard net-new ⋯-menu → "Delete workflow…" → victim-naming confirm Sheet (D-LOCK-03)
  - server-sourced Removed/Kept counts + amber cancel-first banner (D-LOCK-05) + in-place no-undo lifecycle (D-LOCK-04)
  - DeletePreview.in_flight — the honest live-run signal the amber banner gates on (backend Rule 2 deviation)
affects: [WFIN-03 SC#10 live UAT, 152-VALIDATION, verify-work, secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Net-new ⋯-menu on a card via the FolderNode DropdownMenu analog (Pitfall 8 — no menu existed)"
    - "Victim-naming delete adapts the 064-B/ActiveRunsSection KillPhase machine (idle→deleting→deleted|error) — in place, no optimistic vanish"
    - "Server-sourced counts BEFORE commit (never guessed) — the honesty contract from the operator receipt vocabulary"
    - "Amber-not-red graded action-guard for the cancel-first in-flight signal (D-LOCK-05)"

key-files:
  created:
    - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/pages/WorkflowsPage.tsx
    - backend/app/db/workflows.py
    - backend/app/api/workflows.py

key-decisions:
  - "The amber cancel-first banner is gated on a REAL server in_flight count (Rule 2 backend add) — never derived from total run RECORDS (that would falsely claim 'in progress')"
  - "The card is removed ONLY on the server-confirmed re-fetch (onDeleted → refetchPublished), never a local/optimistic filter (D-LOCK-04, no undo)"
  - "Delete forever is the sole --destructive element; the ⋯ trigger + menu item are neutral/destructive-tinted only (UI-SPEC Visual Hierarchy)"
  - "Native <button> for the ⋯ trigger (asChild) — no new Button import; matches the neutral 8px hit-target treatment"

patterns-established:
  - "PublishedCard owns its own delete state machine + Sheet (mirrors ActiveRunsSection's RunCard owning its Kill sheet)"
  - "In-flight banner text pluralizes honestly (1 run / N runs) while keeping the exact UI-SPEC singular string"

requirements-completed: [WFIN-03]

# Metrics
duration: ~25min
completed: 2026-07-14
---

# Phase 152 Plan 04: WFIN-03 Delete Cascade (frontend) Summary

**PublishedCard gains a net-new `⋯`-menu whose single "Delete workflow…" item opens a victim-naming confirm Sheet (the shipped 064-B primitive) that names EXACT server-sourced Removed vs Kept counts, shows an amber cancel-first banner only when a run is truly live, and transitions the card in place (Deleting… → Deleted · recorded) with no optimistic vanish and no undo — wired to the Plan-02 `DELETE /{id}/cascade` + `GET /{id}/delete-preview` routes via two new `api.ts` clients.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (all `type="auto"`) + 1 backend deviation
- **Files:** 1 created + 4 modified (2 frontend planned, 1 api.ts planned, 2 backend deviation)
- **Commits:** 4 (1 deviation + 3 task) + this docs commit

## Accomplishments

- **Task 1 (`195ce2d7`):** `getWorkflowDeletePreview(id)` → `GET /workflows/{id}/delete-preview` → `WorkflowDeletePreview {name, versions, runs, threads, in_flight}` and `deleteWorkflowCascade(id, signal?)` → `DELETE /workflows/{id}/cascade` (204) in `api.ts` — the DISTINCT cascade + preview routes (never the draft `DELETE /workflows/{id}`, Pitfall 7), reusing the `deleteWorkflowDraft` `getAuthHeaders` + status-mapped-error shape (404 → `WorkflowNotFoundError`, non-ok → thrown Error). Errors are not swallowed — the sheet renders its own load-error / delete-error state on a throw.
- **Task 2 (`78d0cc0d`):** the net-new `⋯` menu on `PublishedCard` (Pitfall 8 — none existed) — a neutral `MoreHorizontal` trigger left of the `published` pill → a single destructive-tinted `Delete workflow…` item → the victim-naming confirm `Sheet` (`side="bottom" mx-auto max-w-lg`, the SAME primitive as `ActiveRunsSection`'s Kill sheet). The sheet fetches the preview on open and renders EXACT counts (Removed group `{name} · N versions · N run records`; Kept group `{N} chat threads become normal chats…`, always-rendered incl. the 0-threads `No chat threads to keep.`), an amber in-flight banner gated on `preview.in_flight > 0` (D-LOCK-05), the in-place `Deleting… → Deleted · recorded` lifecycle (adapting the 064-B `KillPhase` machine) with the card removed only on the server-confirmed re-fetch, an error `Try again`, and the `✎ Recorded with your name in the audit log.` footer. The `⑂ Tweak` / `▶ Run` footer is UNCHANGED.
- **Task 3 (`e08f5516`):** `PublishedCardDelete.test.tsx` (7 cases) renders the LIVE `WorkflowsPage`, opens the ⋯-menu off a published card (with the ViewsGroup Radix pointer-capture shims), and locks: the preview fetch keyed by the definition id, the exact counts + Kept reassurance (incl. the 0-threads variant), the in-flight banner gating (0 hides / 1 shows), the `Delete forever` → cascade → in-place `Deleting…` → `Deleted · recorded` lifecycle with NO optimistic removal, and the rejected-cascade error + `Try again`. `api.ts` mocked, no network.

## Task Commits

1. **Backend deviation [Rule 2]: `in_flight` count on delete-preview** — `3225797a` (feat)
2. **Task 1: api.ts delete clients** — `195ce2d7` (feat)
3. **Task 2: PublishedCard ⋯-menu + victim-naming delete Sheet** — `78d0cc0d` (feat)
4. **Task 3: PublishedCard delete component test** — `e08f5516` (test)

## Files Created/Modified

- `frontend/src/lib/api.ts` (modified) — `WorkflowDeletePreview` interface + `getWorkflowDeletePreview` + `deleteWorkflowCascade` hitting the distinct `/delete-preview` + `/cascade` routes.
- `frontend/src/pages/WorkflowsPage.tsx` (modified) — `PublishedCard` ⋯-menu + victim-naming Sheet + `DeletePhase` state machine + `onDeleted` prop (parent re-fetches the shelf on server confirmation); lucide/DropdownMenu/Sheet imports added.
- `frontend/src/pages/__tests__/PublishedCardDelete.test.tsx` (created) — 7 cases: preview fetch, exact counts + Kept sentence (incl. 0-threads), in-flight banner gating, in-place no-undo lifecycle, error → Try again.
- `backend/app/db/workflows.py` (modified — deviation) — `delete_workflow_cascade_preview` returns an additive `in_flight` COUNT (status IN active/paused/cap_paused).
- `backend/app/api/workflows.py` (modified — deviation) — `DeletePreview` gains an additive `in_flight: int = 0` field, mapped from the helper.

## Decisions Made

- **The amber banner needs a REAL live-run signal (see Deviations).** The Plan-02 preview returned only total run `runs` (historical records); gating the amber D-LOCK-05 banner off that would falsely claim "1 run is still in progress" whenever any completed run existed — a dishonest stub. Rather than fake it, the preview now carries a true `in_flight` count.
- **No optimistic vanish, honestly.** The card is never removed by a local state filter; `onDeleted()` re-fetches the Published shelf, so the card leaves the list only when the server no longer returns it (D-LOCK-04). The in-place `Deleting… → Deleted · recorded` terminal renders on the card until that re-fetch.
- **Destructive weight lands once.** `Delete forever` is the sole `bg-destructive` element; the `⋯` trigger is neutral (`text-muted-foreground`), the menu item is destructive-TINTED text only, the in-flight banner is amber (never red) — the UI-SPEC Visual Hierarchy + the graded action-guards rule.
- **In-flight banner copy pluralizes honestly** — the exact UI-SPEC singular string for `in_flight === 1`, a truthful plural variant otherwise.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added an `in_flight` live-run count to the delete-preview so the amber cancel-first banner is honest**
- **Found during:** Task 2 (building the amber cancel-first banner).
- **Issue:** The plan's `must_haves` truth #3 + Task 3 case (3) require the amber banner to render "when the preview reports a live run" (D-LOCK-05, a locked requirement + a plan success criterion). But the Plan-02 `DeletePreview` returns only `{name, versions, runs, threads}` where `runs` = total historical run RECORDS, with NO live-run signal. Deriving the banner from `runs > 0` would falsely claim a run is "in progress" whenever any completed run exists — a dishonest stub that defeats D-LOCK-03/05 honesty, and a branch that would never fire correctly in production.
- **Fix:** Added an additive `in_flight` COUNT (`status IN ('active','paused','cap_paused')` — the SAME set the cascade route cancel-first heals, so the banner and the actual cancel agree) to `delete_workflow_cascade_preview` (`db/workflows.py`) and an additive `in_flight: int = 0` field to the `DeletePreview` model (`api/workflows.py`). The frontend `WorkflowDeletePreview` interface + the banner consume it.
- **Scope note:** touches two Plan-02 backend files (`db/workflows.py`, `api/workflows.py`) — additive only, mirrors the existing cancel-first query, and NEVER `threads.py` (D-08 / G-5 red line respected). This is the minimum honest wiring for a locked requirement, not scope creep.
- **Files modified:** backend/app/db/workflows.py, backend/app/api/workflows.py
- **Verification:** the 4 live-PG `test_152_delete_cascade.py` tests stay green (they assert individual keys, not exact dict equality, so the additive field is safe); backend modules parse + the preview test's `preview["runs"]/["versions"]/["threads"]` assertions are unaffected.
- **Committed in:** `3225797a` (its own commit, before Task 1, so the frontend builds on it).

---

**Total deviations:** 1 auto-fixed (1 missing-critical backend add).
**Impact on plan:** Necessary for the honest D-LOCK-05 banner (a locked requirement). Additive, regression-free, D-08-safe. `key-files.modified` gained the two backend files.

## Issues Encountered

- **Pre-existing baseline (not touched):** the frontend carries ~30 `tsc -b` errors + rotted vitest tests (SEED-056/049). Captured the 30-error `tsc -b` baseline before editing; after every task it stays **30 with 0 net-new errors on the touched files**, and `npx vite build` exits 0.
- **Radix in jsdom:** the ⋯-menu (Radix DropdownMenu) needs the `hasPointerCapture`/`setPointerCapture`/`releasePointerCapture`/`scrollIntoView` shims to open under user-event (the shipped ViewsGroup pattern) — added in the test's `beforeEach`. The Sheet (Radix Dialog) needs no shim (proven by `ActiveRunsSection.test.tsx`).

## Known Stubs

None. The ⋯-menu, the preview fetch, the amber banner, and the cascade delete are all wired to live routes; the counts are server-sourced (never placeholder), and the `in_flight` banner fires on a real backend signal (not a dead branch).

## Threat Flags

None beyond the plan's `<threat_model>` (T-152-04-01..SC). The two api clients call the owner-gated Plan-02 routes (404-collapse is the authorization wall); the sheet renders server-sourced counts before an irreversible action; the delete is in-place, no undo. The `in_flight` field is an owner-scoped count over the caller's own definitions — no new cross-user surface.

## User Setup Required

None — no new package, no env, no migration. **Operator: restart uvicorn** to load the additive `in_flight` field on `GET /workflows/{id}/delete-preview` before the live delete-cascade UAT (the same restart already noted for Plan 02's new routes).

## Next Phase Readiness

- WFIN-03's delete surface is fully wired end-to-end (frontend ⋯-menu + sheet ↔ Plan-02 owner-gated cascade + preview). **WFIN-03 NOT marked complete** at the requirement level (false-green avoidance, 148–151 convention) — it closes at verify-work/secure-phase after the live SC#10 4-axis destructive UAT in `152-VALIDATION.md` (real DB counts, cancel-first, no orphaned runs/threads) + the T-152-04-* / T-152-02-* threat close.
- Phase 152 all 4 plans executed (Wave 1: 152-01/02 backend; Wave 2: 152-03 Run-modal frontend; Wave 3: 152-04 delete frontend). Ready for `/gsd:verify-work 152`.

## Self-Check: PASSED

---
*Phase: 152-workflow-run-inputs*
*Completed: 2026-07-14*

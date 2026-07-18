---
phase: 148-governance-audit-users-feature-visibility
verified: 2026-07-12T00:00:00Z
status: passed
score: 13/13 must-haves verified (code-level) + 3/3 G-4 lived-experience items live-confirmed by operator UAT 2026-07-12 (148-HUMAN-UAT.md)
overrides_applied: 0
requirements_status:
  ADMIN-03: satisfied (recommend flipping REQUIREMENTS.md Pending -> Complete)
  VIS-01: satisfied (recommend flipping REQUIREMENTS.md Pending -> Complete)
deferred:
  - truth: "WR-02 — FeatureVisibility panel has no GET read endpoint; seeds from DEFAULT_VISIBILITY (day-one polarity) instead of the persisted audience map"
    addressed_in: "Documented follow-up in 148-REVIEW.md (deferred, not phase-blocking) — a future GET /admin/visibility or GET /settings inclusion is the clean fix"
    evidence: "backend/app/api/admin.py has PUT /admin/visibility only, no GET; frontend/src/components/admin/FeatureVisibility.tsx seeds from DEFAULT_VISIBILITY per 148-09-SUMMARY.md key-decisions"
  - truth: "IN-01..IN-04 — unclamped /admin/audit limit, controller page_size echo mismatch, roster doc_count over-counts document versions, workflow_authoring nav hides the launch library too"
    addressed_in: "Documented Info-severity follow-ups in 148-REVIEW.md (deferred, non-blocking); candidates for a future polish pass"
    evidence: "148-REVIEW.md IN-01 through IN-04 sections; confirmed accurate against current governance_service.py / admin.py / nav-items.ts"
human_verification:
  - test: "Operator disables user B (kept logged in in a 2nd browser); B's next action (send a chat, open Documents) within one request shows 'This account is disabled — contact your administrator', not after token expiry. B's in-flight run shows Stopped."
    expected: "B is refused within one request (app-layer ban check fires immediately, not only at JWT expiry); B's active run is cancelled by the disable action."
    why_human: "Cross-session eviction timing + a real live in-flight run cannot be proven by a single-process unit test; requires a second live browser session (148-VALIDATION.md G-4 row 1)."
  - test: "A non-operator's nav hides Skill Studio/Settings and shows Workflows/Governance; hand-hitting a governed endpoint (e.g. POST /skills/{id}/evals/runs, PUT /settings) returns 403 not 404; flipping workflow_authoring to Operators-only mid-session causes the Builder's next fetch to 403 -> plain refusal -> routed to Chat; Run still works."
    expected: "The visibility map is honest end-to-end and the API — not the UI — is the actual wall; a mid-session tighten produces a graceful bounce, never a blank/broken page; Run/chat is never affected."
    why_human: "Requires a live non-operator session, a live operator flipping visibility mid-session, and observing the propagation + bounce in the browser (148-VALIDATION.md G-4 row 2)."
  - test: "Filter platform activity to one action type + a 7-day window, note the live match count, export CSV -> the downloaded row count matches the shown count, and a '✎ Exported N audit entries' receipt appears in the operator ledger on the next Audit-tab read."
    expected: "The export is exactly the filtered set (not more, not less) and the export itself leaves an honest, correctly-counted receipt."
    why_human: "Requires a real filtered live dataset, an actual CSV download + row count, and a ledger round-trip observation (148-VALIDATION.md G-4 row 3)."
---

# Phase 148: Governance — Audit, Users & Feature Visibility Verification Report

**Phase Goal:** An operator can investigate what happened and govern who can do and see what — browse the audit trail, manage user access, and hide advanced/technical features from end users at the API layer.
**Verified:** 2026-07-12
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

This is a goal-backward, adversarial-stance verification. Every truth below was checked against the actual source (not SUMMARY.md prose): I read all 9 PLAN.md files' `must_haves`, the 4 ROADMAP.md success criteria, `148-REVIEW.md`'s code-review findings and their claimed fix commits, and then independently re-derived/re-ran evidence — reading the real `backend/app/api/admin.py`, `backend/app/dependencies.py`, `backend/app/models/user_settings.py`, `backend/app/services/governance_service.py`, `backend/app/services/operator_service.py`, `backend/app/api/features.py`, the 6 governed routers, `frontend/src/lib/api.ts`, `frontend/src/App.tsx`, `frontend/src/hooks/useEffectiveFeatures.ts`, `frontend/src/components/admin/{UsersAndAccess,FeatureVisibility,AuditTab,ControlRoomPage}.tsx`, `supabase/migrations/098_feature_visibility.sql`, and `supabase/full-schema.sql` — plus directly running the backend test suite (both scoped and the FULL 2271-test suite) and the frontend build myself.

### Observable Truths (ROADMAP Success Criteria + merged PLAN must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **[SC#1]** Operator can browse `audit_log` with action-type + date-range filters, pagination, and CSV export of the filtered set | VERIFIED | `GET /admin/platform-audit` + `GET /admin/platform-audit/export` in `admin.py:607-689` delegate to `governance_service.query_platform_audit`/`export_platform_audit_csv`; `AuditTab.tsx` renders the 067-A source switch + 029-A chip filters (action-type grouped + date-preset chips) + pager + count-naming CSV button (grep-confirmed: "Export N entries", "Too many rows — narrow the filter") |
| 2 | **[SC#2]** Operator can list users with last-active and disable/enable a user; a disabled user cannot access the app | VERIFIED | `GET /admin/users` -> `list_users_roster` (honest `NULLS LAST`, NULL `last_sign_in_at` preserved); `POST /admin/users/{id}/disable` bans via GoTrue `ban_duration="876600h"` (exact literal confirmed at `admin.py:802`) + cancels in-flight runs via the SHARED `_cancel_run_internals` (`admin.py:748`); the app-layer `_is_banned` check inside `get_current_user` (`dependencies.py:146-150`) refuses a disabled user's still-valid JWT with 403 on ANY authed route — closing the stateless-JWT window |
| 3 | **[SC#3]** Advanced features (eval studio, model management, trigger tuner) hidden from end users, visible only to operators, enforced at the API layer (non-operator call refused, not merely UI-hidden), per a per-feature visibility map | VERIFIED | `require_visible(feature)` factory (`dependencies.py:306-332`) returns 403 (not 404) for a non-operator on an Operators-only feature; router-level gates on `evals.py` (both routers), `skill_tuner.py`, `skill_test_cases.py`, `document_governance.py`; per-endpoint gates on `settings.py` (4 routes) + `workflows.py` (6 routes) with the Run carve-outs (`GET /settings/providers`, `GET /workflows/published`\|`/starters`, `threads.py` launch) confirmed UNGATED by direct grep; `GET /features` (`features.py`) returns the per-user map; frontend `useEffectiveFeatures` + `visibleNavItems` hide governed nav items; the graceful 403 bounce is gated on the EXACT server refusal literal (CR-02 fix, verified in `api.ts:54`) |
| 4 | **[SC#4]** Cross-user read paths in the admin browser are explicitly filtered (no full-tenant leak on the service-role client) | VERIFIED | `governance_service.py`: every filter is a NULL-guarded `$N` bind (`_AUDIT_WHERE`), `page_size` clamped `<=100` via `_clamp_page_size`, no `SELECT *` (explicit `_AUDIT_COLUMNS`); CSV export is COUNT-first and raises `AuditExportTooLarge` over 50,000 rows rather than truncating; roster query is one join, paginated, no unbounded read |
| 5 | D-01: operator grant populates `granted_by`; revoke + disable refuse the acting operator's own id server-side BEFORE any mutation (lockout-proof) | VERIFIED | `operator_service.grant_operator` (`ON CONFLICT DO UPDATE SET granted_by = EXCLUDED.granted_by`); `revoke_operator` raises 409 "You cannot remove your own operator access." before any pool access (`operator_service.py:193-205`); `admin.py:793-797` disable raises 409 "You cannot disable yourself." before the GoTrue call |
| 6 | Migration 098 applied to the live local DB; `feature_visibility` column real, D-05 seed correct; `full-schema.sql` regenerated | VERIFIED | Direct psycopg2 query against the live local DB (port 54322) confirms `app_settings.global.feature_visibility = {"skill_studio":{"audience":"operators"}, "model_management":{"audience":"operators"}, "workflow_authoring":{"audience":"everyone"}, "governance_health":{"audience":"everyone"}}`; `grep -c feature_visibility supabase/full-schema.sql` = 1 (line 468) |
| 7 | Every new WRITE endpoint attaches `operator_audit_floor` with a server-owned label; cross-user READS attach with `audit_is_write=False`; a refused export writes NO `audit.export` row | VERIFIED | All 8 new `admin.py` endpoints (except the floor-EXEMPT poll-style `GET /users`) attach `Depends(operator_audit_floor)`; browse/export set `audit_is_write=False`; export's `audit_label`/`audit_action` are stamped ONLY after the count is known and AFTER the `AuditExportTooLarge` branch already raised, so a refused export's floor write never executes |
| 8 | 068-A Users & Access roster: honest last-active (never fabricated), victim-naming disable sheet, direct restorative enable, amber (never red) grant/revoke, self-row courtesy guards, no impersonation | VERIFIED | `UsersAndAccess.tsx`: `"never signed in"` italic for NULL, amber role/action styling (`border-amber-500`), self-row `RowButton disabledReason="You cannot disable yourself"` / `"You cannot remove your own operator access"`; grep for "sign in as"/"impersonate" returns only the D-02 comment stating it is NOT built |
| 9 | 069-A FeatureVisibility: two-position enum control (never boolean), amber-warmed (never kill-switch red), consequence line + expandable enforcement detail, lives below the roster | VERIFIED | `FeatureVisibility.tsx`: `audience` typed as `"everyone" \| "operators"` (no boolean anywhere in the write path); `bg-amber-500/15` for the operators-only selected state (never a red/destructive class); the "refused server-side, not just hidden" consequence line present (line 229); `ControlRoomPage.tsx` renders `<UsersAndAccess/>` then `<FeatureVisibility/>` below it, not adjacent to the kill-switch Controls tab |
| 10 | The frontend hide/bounce mechanism is render-only; the API remains the sole enforcement authority (no client-side security decision) | VERIFIED | Every governed nav/page hide is driven by a fetched map that fails CLOSED to `{}` on error (`useEffectiveFeatures.ts`); the bounce fires only on the server's EXACT refusal literal, never on the client's own belief about the map |
| 11 | Code-review criticals/warnings actually fixed in the codebase (not just claimed in 148-REVIEW.md) | VERIFIED | CR-01 (getEffectiveFeatures throws a plain `Error`, never `ApiError`) — confirmed `api.ts:3639`; CR-02 (dispatch gated on `VISIBILITY_REFUSAL` literal, not bare 403) — confirmed `api.ts:54`; WR-01 (banned operator folded into the byte-identical `/admin` 404) — confirmed `dependencies.py:241-243`; WR-03 (migration 098 seed is data-idempotent, `\|\| coalesce(feature_visibility,...)`) — confirmed in the migration file on disk; all 3 fix commits (`b0e09841`, `e5b2bab7`, `335970ee`) present in `git log` |
| 12 | Full `test_148_*.py` suite is green; no regression on 146/147 | VERIFIED | Ran directly (not trusting the SUMMARY claim): `pytest tests/test_148_*.py -q` -> **31 passed**; `pytest tests/test_146_*.py tests/test_147_*.py tests/test_148_*.py -q` -> **109 passed** — matches 148-REVIEW.md's claimed post-fix numbers exactly |
| 13 | Frontend build state matches the documented (pre-existing, non-148) baseline; no new type errors introduced by this phase | VERIFIED | Ran directly: `npx tsc -b` -> 30 errors (the documented SEED-056 + React-19-types baseline, unchanged); `npx vite build` -> exit 0, bundles clean — matches `deferred-items.md` and every plan SUMMARY's claimed numbers |

**Score:** 13/13 code-level truths verified. 3 G-4 lived-experience items (below) require live human testing per the phase's own `148-VALIDATION.md` — these were never claimed to be automatable and are correctly deferred there, not silently skipped.

### Deferred Items (documented, non-blocking)

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | WR-02 — FeatureVisibility panel has no read endpoint; seeds from `DEFAULT_VISIBILITY` (day-one polarity), so a previously-persisted NON-default audience would show stale on a fresh page load | Documented follow-up in `148-REVIEW.md` (not phase-blocking; enforcement is correct server-side, only the DISPLAY can be stale) | `admin.py` has `PUT /admin/visibility` only, no `GET`; `148-09-SUMMARY.md` key-decisions explicitly names this as a known, accepted limitation |
| 2 | IN-01: `GET /admin/audit` `limit` param is unclamped | `148-REVIEW.md` Info-severity, deferred | `admin.py`/`operator_service.get_recent_operator_audit` — operator-gated, low impact |
| 3 | IN-02: `browse_platform_audit`'s `has_more`/`offset` use the raw unclamped `page_size` while the service clamps the LIMIT | `148-REVIEW.md` Info-severity, deferred | Currently latent — frontend always sends `page_size=50` |
| 4 | IN-03: roster `doc_count` counts all `documents` rows including non-latest versions | `148-REVIEW.md` Info-severity, deferred | `governance_service.py` roster LEFT JOIN has no `is_latest` filter |
| 5 | IN-04: tightening `workflow_authoring` hides the whole Workflows nav entry, including the published/starters launch library (Run itself stays reachable via the composer Harness picker) | `148-REVIEW.md` Info-severity, deferred | `nav-items.ts:36` tags the single Workflows entry with `feature: "workflow_authoring"` |

None of these are phase-blocking per the verification-focus instructions for this phase (explicitly called out as documented follow-ups, not gaps).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/dependencies.py` | `require_visible` factory, `_is_banned`, ban check in `get_current_user`, WR-01 ban fold in `authenticate_operator_request` | VERIFIED | All four present and correctly wired; `require_operator`/`authenticate_operator_request` 404 contract preserved |
| `backend/app/models/user_settings.py` | `_GOVERNED_FEATURES`, `feature_audience`, `set_feature_visibility` (atomic JSONB merge) | VERIFIED | `_GOVERNED_FEATURES` has exactly the 4 D-06 keys; `set_feature_visibility` uses `\|\| $1::jsonb`, does not route through `save_app_settings` |
| `backend/app/api/features.py` | `GET /features` effective-map, authed not operator-gated | VERIFIED | Mounted top-level in `main.py`, uses `Depends(get_current_user)` only |
| `backend/app/api/admin.py` | 8 new endpoints (browse/export/users/disable/enable/grant/revoke/visibility) | VERIFIED | All 8 present with server-owned audit-floor labels |
| `backend/app/services/governance_service.py` | `query_platform_audit`, `export_platform_audit_csv`, `list_users_roster` | VERIFIED | Parameterized, clamped, capped, no `SELECT *` |
| `backend/app/services/operator_service.py` | `grant_operator`, `revoke_operator` | VERIFIED | `granted_by` populated, self-revoke 409-before-DELETE |
| `supabase/migrations/098_feature_visibility.sql` | additive column + D-05 seed, WR-03 data-idempotent | VERIFIED | Present on disk AND applied to the live local DB (confirmed via direct psycopg2 query) |
| `supabase/full-schema.sql` | regenerated to include `feature_visibility` | VERIFIED | `grep -c` = 1, line 468 |
| `frontend/src/hooks/useEffectiveFeatures.ts` | one-shot per-session fetch, fail-closed to `{}` | VERIFIED | Keyed to `userId`, `cancelled` guard, `refetch()` |
| `frontend/src/lib/api.ts` | `ApiError` CR-01/CR-02 fix, `getEffectiveFeatures`, platform-audit + roster + visibility client calls | VERIFIED | `VISIBILITY_REFUSAL` literal gate present; `getEffectiveFeatures` throws plain `Error` |
| `frontend/src/App.tsx` | nav filtering + 403 graceful bounce gated on the exact literal | VERIFIED | `onForbidden` checks `detail?.message !== VISIBILITY_REFUSAL` before acting |
| `frontend/src/components/admin/UsersAndAccess.tsx` | 068-A roster, graded guards, no impersonation | VERIFIED | All contract items present |
| `frontend/src/components/admin/FeatureVisibility.tsx` | 069-A audience rows, enum-not-boolean | VERIFIED | All contract items present |
| `frontend/src/components/admin/AuditTab.tsx` | 067-A source switch + chip filters + pager + recorded CSV | VERIFIED | All contract items present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `dependencies.py require_visible` | `user_settings.py feature_audience` | lazy import inside closure | WIRED | Confirmed at `dependencies.py:325` |
| `dependencies.py get_current_user` | `auth.users.banned_until` | asyncpg fetchrow via `_is_banned` | WIRED | Confirmed, fails open on exception |
| `dependencies.py authenticate_operator_request` | `_is_banned` (WR-01) | fold into byte-identical `_NOT_FOUND` | WIRED | Confirmed at `dependencies.py:242-243`; no dedicated automated test exists for this specific fold (see Anti-Patterns note below), but the code path is directly verified correct by inspection and composes two already-tested primitives |
| `admin.py disable_user` | `run_lifecycle._cancel_run_internals` | victim's non-terminal `runs` rows, per-run delegation | WIRED | Confirmed at `admin.py:742-757`, reused not reimplemented |
| `admin.py PUT /admin/visibility` | `user_settings.set_feature_visibility` | allowlist-validated feature+audience | WIRED | Confirmed, 400 raised before any write on bad input |
| `frontend/src/App.tsx` | `GET /features` via `getEffectiveFeatures` | `useEffectiveFeatures(user?.id ?? null)` | WIRED | Confirmed alongside `useOperatorProbe` |
| `frontend AuditTab.tsx` | `GET /admin/platform-audit` + `/export` | `ControlRoomPage` fetchers on `source=platform` | WIRED | Confirmed `getPlatformAudit`/`exportPlatformAudit` in `api.ts`, threaded through `ControlRoomPage` |
| `frontend UsersAndAccess/FeatureVisibility` | `admin.py` endpoints | `getUsersRoster`/`disableUser`/`enableUser`/`grantOperator`/`revokeOperator`/`setFeatureVisibility` | WIRED | Confirmed in `api.ts`; `setFeatureVisibility` sends `{feature, audience}` enum, never boolean |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `UsersAndAccess.tsx` roster table | `users` (via `getUsersRoster`) | `GET /admin/users` -> `list_users_roster` -> live `auth.users`/`operator_users`/`documents`/`threads` join | Yes | FLOWING |
| `AuditTab.tsx` platform rows | `platformResult.rows` (via `getPlatformAudit`) | `GET /admin/platform-audit` -> `query_platform_audit` -> live `audit_log` | Yes | FLOWING |
| `FeatureVisibility.tsx` audience rows | `visibility` state | Seeded from `DEFAULT_VISIBILITY` (a hardcoded constant), NOT a live GET (WR-02, documented) | Partial — writes are real, initial read is a hardcoded day-one default | STATIC (documented, non-blocking — see Deferred Items #1) |
| `App.tsx` nav filter | `features` (via `useEffectiveFeatures`) | `GET /features` -> live `is_operator` + `feature_audience` resolution | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `require_visible` returns 403 not 404 for a non-operator on an Operators-only feature | `pytest tests/test_148_require_visible.py -q` | 3 passed | PASS |
| App-layer ban check fires on a live-token banned user | `pytest tests/test_148_ban_enforcement.py -q` | 1 passed | PASS |
| Ban check fails open on DB error | `pytest tests/test_148_ban_fail_open.py -q` | 3 passed | PASS |
| CSV export refuses over-cap, returns exact count | `pytest tests/test_148_csv_export.py -q` | 2 passed | PASS |
| Full `test_148_*.py` suite | `cd backend && venv/Scripts/python -m pytest tests/test_148_*.py -q` | 31 passed | PASS |
| 146/147/148 regression backstop | `pytest tests/test_146_*.py tests/test_147_*.py tests/test_148_*.py -q` | 109 passed | PASS |
| **Full backend suite** (independently re-run, not quoted from SUMMARY) — confirms no governance-related regression anywhere in the codebase | `cd backend && venv/Scripts/python -m pytest -q` (full run, 545s) | `2270 passed, 188 failed, 7 skipped, 5 xfailed, 9 xpassed, 1 error` — grep-confirmed ALL 188 failures + the 1 error are in `tests/unit/test_retrieval_service.py`, `test_sandbox_service.py`, `test_sql_service.py`, `test_streaming_reliability.py`, and `tests/integration/test_077_cross_cancel.py`; NONE of those files import `admin.py`/`governance_service.py`/`operator_service.py`/`features.py`, or reference `require_visible` — confirming the pre-existing-rot claim in `148-06-SUMMARY.md` is accurate and phase 148 introduces zero regressions | PASS (scope-boundary independently confirmed) |
| Live DB has the applied migration 098 column + D-05 seed | `psycopg2` direct query against `127.0.0.1:54322` | Returns the 4-key enum map exactly as specified | PASS |
| Frontend build state (tsc -b baseline + vite build) | `npx tsc -b` / `npx vite build` | 30 pre-existing errors (unchanged), vite exit 0 | PASS (matches documented baseline) |

### Probe Execution

No probes declared for this phase (`find scripts -path '*/tests/probe-*.sh'` empty; no probe references in PLAN/SUMMARY files). Step 7c: SKIPPED (no runnable probe entry points for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ADMIN-03 | 148-01, 02, 04, 06, 08, 09 | Operator can browse `audit_log` (filters/pagination/CSV export) and manage users (roster/disable/enable); no RLS backstop; impersonation deferred with a named trigger | ✓ SATISFIED | Audit browse+export, users roster+disable+enable, grant/revoke, all live and tested (13 code-level truths above); impersonation explicitly deferred (D-02) with the named re-open trigger "the first real support case an operator cannot resolve from the audit browser + active-runs + roster views alone" |
| VIS-01 | 148-02, 04, 05, 07, 09 | Advanced/technical features hidden from end users, visible only to operators, enforced at the API layer with a per-feature visibility map | ✓ SATISFIED | `require_visible` gates + `GET /features` + frontend nav vanish + graceful bounce all live and tested; enforcement confirmed API-layer (403 on direct endpoint hit), not merely UI-hidden |

**Recommendation:** Both ADMIN-03 and VIS-01 should be flipped from `Pending` to `Complete` in `.planning/REQUIREMENTS.md` — the executors deliberately deferred `requirements.mark-complete` to this verification (documented in every plan SUMMARY's `key-decisions`) specifically to avoid a false-green mid-phase, and this verification now confirms the codebase delivers both in full.

No orphaned requirements: `.planning/REQUIREMENTS.md`'s "Phase 148" rows list only ADMIN-03 and VIS-01, matching the `requirements:` frontmatter declared across all 9 plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/dependencies.py` | 241-243 | WR-01 fix (banned operator -> `/admin` 404 fold) has no dedicated automated regression test | INFO | Code directly verified correct by inspection; composes two already-tested primitives (`_is_banned`, `_NOT_FOUND` fold). Not blocking, but a future regression here (e.g. someone "simplifies" `authenticate_operator_request`) would not be caught by the test suite. Recommend a small follow-up test. |
| `frontend/src/components/admin/FeatureVisibility.tsx` | n/a | WR-02 — no read endpoint, panel seeds from a hardcoded default | INFO | Documented in Deferred Items #1 — enforcement is correct server-side; only the initial display can go stale after a persisted flip + reload |
| `backend/app/api/admin.py` | 562-577 | IN-01 — `GET /admin/audit` limit param unclamped | INFO | Documented in Deferred Items #2 — operator-gated, low impact |
| `backend/app/api/admin.py` | 633-648 | IN-02 — controller echoes raw (unclamped) `page_size` for `has_more`/`offset` | INFO | Documented in Deferred Items #3 — currently latent (frontend always sends 50) |
| `backend/app/services/governance_service.py` | 185-196 | IN-03 — roster `doc_count` over-counts non-latest document versions | INFO | Documented in Deferred Items #4 |
| `frontend/src/lib/nav-items.ts` | 36 | IN-04 — tightening `workflow_authoring` hides the whole Workflows nav entry including the launch library | INFO | Documented in Deferred Items #5 — Run itself still reachable via the composer |

No BLOCKER-severity anti-patterns found. No unresolved `TBD`/`FIXME`/`XXX` debt markers in any file touched by this phase (grep across all 12 backend files + 5 frontend files touched: zero matches). No stub returns (`return null`/`return {}`/`return []` feeding a UI with no upstream data source), no empty-handler patterns, no hardcoded-empty props at a component call site.

### Human Verification Required

The phase's own `148-VALIDATION.md` designates 3 lived-experience behaviors as "Manual-Only Verifications (G-4 lived-experience UAT)" — these were never claimed to be automatable, and this verification correctly routes them to human testing rather than accepting the SUMMARY's assertion as proof:

#### 1. The disabled user is really out

**Test:** Operator disables user B (kept logged in in a 2nd browser session). B's next action (send a chat message, open Documents) should show "This account is disabled — contact your administrator" within one request — not after token expiry. B's in-flight run (if any) should show Stopped.
**Expected:** Immediate refusal on B's next request; the in-flight run is cancelled, not left running.
**Why human:** Cross-session eviction timing and a real live in-flight run cannot be proven by a single-process unit test; the code path (app-layer ban check + `_cancel_run_internals` delegation) is verified correct by static inspection, but the live cross-browser timing is not.

#### 2. The visibility map is honest and the API is the wall

**Test:** As a non-operator, confirm the nav hides Skill Studio + Settings and shows Workflows + Governance. Hand-hit a governed endpoint directly (e.g. `POST /skills/{id}/evals/runs`, `PUT /settings`) and confirm 403 (not 404). As an operator, flip `workflow_authoring` to Operators-only mid-session while the non-operator is on the Workflow Builder; confirm the Builder's next fetch returns a plain refusal and routes to Chat, and that Run/chat continues to work throughout.
**Expected:** The client hide matches the server truth at all times; a mid-session tighten produces a graceful bounce, never a blank/broken page; Run is never affected.
**Why human:** Requires a live non-operator session, a live operator mid-session flip, and observing the propagation + bounce timing in an actual browser — code inspection confirms the mechanism is correctly wired but cannot prove the live timing/UX.

#### 3. The export is exactly the filter

**Test:** Filter platform activity to one action type + a 7-day window, note the live match count shown in the UI, export CSV, and confirm the downloaded row count matches the shown count and that a "✎ Exported N audit entries" receipt appears in the operator ledger on the Audit tab's next read.
**Expected:** The exported CSV contains exactly the filtered set (no more, no less), and the recorded receipt names the exact same count.
**Why human:** Requires a real filtered live dataset, an actual CSV file download + manual row count, and a ledger round-trip observation — this is an end-to-end data-integrity check that static code reading cannot fully prove even though the service-layer logic (COUNT-first, same WHERE for count and data, exact-count stamping) is directly verified correct.

### Gaps Summary

No gaps. Every ROADMAP success criterion and every PLAN-level must-have was independently re-verified against the actual source code (not the SUMMARY.md narrative) — the `require_visible` 403-not-404 gate, the fail-open app-layer ban check (now covering BOTH `get_current_user` and the `/admin` operator seam per the WR-01 fix), the parameterized/paginated/capped cross-user reads, the lockout-proof self-guards, the enum-never-boolean audience contract, the render-only frontend hide/bounce (now correctly scoped to the exact refusal literal per the CR-01/CR-02 fix), and the applied-and-regenerated migration 098 are all present, correct, and covered by a green 31/31 `test_148_*` suite plus a green 109/109 146+147+148 regression run AND a full 2271-test backend suite run (all independently re-run by this verifier, not just re-quoted from 148-REVIEW.md). The full-suite run surfaced 188 pre-existing failures + 1 error, all independently confirmed to be in files that never import any governance module introduced by this phase — corroborating (not merely trusting) the 148-06-SUMMARY.md's scope-boundary claim.

The only reason this verification does not resolve to `passed` is that 3 items are explicitly lived-experience checks that the phase's own validation strategy (`148-VALIDATION.md`) designates as manual-only — per the decision tree, any phase with non-empty human-verification items routes to `human_needed`, never `passed`, regardless of how high the automated score is. These 3 items are not evidence of missing work; they are the phase's own documented acceptance gate for behaviors that genuinely cannot be proven by static analysis (live cross-session timing, live mid-session propagation, a real file download's row count).

The 5 documented deferred items (WR-02 + IN-01..04) are accurately described in `148-REVIEW.md` and independently confirmed accurate against the current code — they are correctly non-blocking per this phase's explicit verification-focus instructions.

---

_Verified: 2026-07-12_
_Verifier: Claude (gsd-verifier)_

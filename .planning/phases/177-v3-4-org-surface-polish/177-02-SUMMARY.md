---
phase: 177-v3-4-org-surface-polish
plan: 02
subsystem: ui
tags: [react, org, auth, nav, badge, cohesion, vitest, D-04, D-05, D-06, D-07]

# Dependency graph
requires:
  - phase: 177-01
    provides: "RoleBadge + roleBadgeMeta (the shared org-identity primitive) from frontend/src/components/org/OrgIdentity.tsx"
  - phase: 166-org-admin-shell
    provides: "OrgBand + ProfileMenu (the two inline-badge sites being rewired) + NavPanel dual-shield zones"
provides:
  - "frontend/src/components/org/OrgBand.tsx — consumes RoleBadge (Shield + ORG ADMIN chip + recording marker + ⌥ preserved)"
  - "frontend/src/components/layout/ProfileMenu.tsx — identity anchor consumes RoleBadge; switcher honest-absent at >=2 orgs"
  - "frontend/src/components/layout/ProfileMenu.test.tsx — Phase-166 suite EXTENDED with a D-04/D-05 per-org-role display case (7→9 it())"
affects: [177-03, 177-04, 177-05]  # independent surfaces; no code dependency, shared cohesion thesis only

# Tech tracking
tech-stack:
  added: []  # RED LINE held — no new npm package (D-01); frontend/package.json unchanged
  patterns:
    - "consume the shared presentational primitive at the call site; the honest-absent gate stays at the call site (RoleBadge gates NOTHING)"
    - "audit-and-lock: grep-lock an invariant (honest-absent / zone-colour) instead of re-implementing it"

key-files:
  created: []
  modified:
    - frontend/src/components/org/OrgBand.tsx
    - frontend/src/components/layout/ProfileMenu.tsx
    - frontend/src/components/layout/ProfileMenu.test.tsx

key-decisions:
  - "D-05 collapses to a display-consistency AUDIT — the activeOrgId-keyed fail-closed probe already re-derives role per active org; no new switching behavior, no OrgProvider source change"
  - "roleBadgeMeta reconciliation is now LIVE in OrgBand + ProfileMenu — a dept-admin role, which the inline isOrgAdminRole copies rendered as 'Member', now correctly shows the ◆ Dept-admin admin pill (intended D-04/D-166-05 unification, not a regression)"
  - "Neutralised incidental ◆ in render-adjacent COMMENTS (not just the render span) so the glyph truly lives only inside RoleBadge — comment-only, behaviour byte-identical"
  - "D-07 measured by the amber COLOUR token (`amber-`) = 0, not the naive word 'amber' — the word survives only in invariant-DOCUMENTING comments (OrgMembersTab/SsoTab), which AFFIRM the rule; those files are not this plan's to touch"

requirements-completed: []  # ORGUX-01 spans the whole wave; orchestrator owns REQUIREMENTS.md marking

# Metrics
duration: 6min
completed: 2026-07-23
---

# Phase 177 Plan 02: Org Identity Cohesion + Honest-State Lock Summary

**Rewired OrgBand + ProfileMenu to render the ONE shared `RoleBadge` (177-01) instead of two inline `◆ Org-admin / Member` copies (D-04), and audited-and-locked the honest-state matrix — per-org role (D-05), honest-absent affordances (D-06), and indigo/amber zone separation (D-07) — with the existing Phase-166 ProfileMenu suite EXTENDED (7→9 it()), never re-authored.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-23T04:31:07Z
- **Completed:** 2026-07-23T04:37:27Z
- **Tasks:** 2 (auto)
- **Files modified:** 3 (2 source rewired + 1 test extended), 0 created

## Accomplishments

- **D-04 — one badge element, not three look-alikes.** `OrgBand.tsx` and `ProfileMenu.tsx` both deleted their local `isOrgAdminRole` helper + inline badge `<span>`s and now render `<RoleBadge role={role} />` from `@/components/org/OrgIdentity`. The `◆` glyph + tone tokens live in exactly one place. Everything else is verbatim: OrgBand keeps the `Shield`, the `ORG ADMIN` mono chip, the `TechnicalNamesToggle` (⌥), the "every action recorded" 062-A marker + `recordingPulse`, and "Back to app"; ProfileMenu keeps the identity header, the `orgs.length >= 2` switcher gate + the whole switcher, the theme item, and Sign out.
- **D-04 reconciliation now live.** The retired inline copies mapped only `org-admin`/`super-admin` → admin (everything else → Member). `roleBadgeMeta` also promotes `dept-admin` → the `◆ Dept-admin` admin pill — so a dept-admin now reads honestly in the band + menu (intended D-166-05 unification, per 177-01).
- **D-05 audit (recorded below) — display-consistency, no new wiring.** Verified the badge follows the ACTIVE org's role through the provider; added a per-org-role display case to the ProfileMenu suite.
- **D-06 / D-07 grep-locked.** NavPanel's honest-absent gates (`canManage &&`, `isOperator &&`) and its distinct shields (org `indigo-400`, operator `amber-400`) are intact; the amber colour token is absent from every org surface.
- **All RED LINES held** — StreamsProvider + OrgProvider untouched, no authz gate edited, no new package, no server/migration change, existing test coverage grew (never shrank).

## D-05 Audit Verdict (required by the plan output)

**Verdict: D-05 is a display-consistency audit — NO new switching behavior, NO source change.**

- `useOrgPermissionsProbe` is keyed on `[userId, activeOrgId, reprobeKey]` (`useOrgPermissionsProbe.ts:111`), starts + fails **CLOSED** (`CLOSED` default `:29-38`), and clears perms on every re-key before the fetch (`:93`) — so an org switch re-probes and re-derives `role` + `canManage` for the new active org with no extra code.
- `OrgProvider` surfaces that probe's `role` straight into its memoized value (`OrgProvider.tsx:114-117,182-193`). There is no second, stale role source.
- **Every badge site reads that ONE value:** `ProfileMenu` reads `org?.role` directly (`ProfileMenu.tsx:75`); `OrgBand` receives `role` as a prop threaded by `OrgAdminShell` from `useOrg().role` (`OrgAdminShell.tsx:116` → `:323,:342`). No site holds a local/stale role copy.
- Therefore no drift-fix was needed — D-05 collapsed to confirming display consistency and regression-locking it with the new test case.

## Task Commits

1. **Task 1: Swap inline badges → shared RoleBadge (D-04)** — `b15ab852` (feat) — OrgBand + ProfileMenu.
2. **Task 2: Extend ProfileMenu suite + audit-lock the matrix (D-05/D-06/D-07)** — `5ecdabf8` (test) — ProfileMenu.test.tsx (7→9 it()).

## Files Modified

- `frontend/src/components/org/OrgBand.tsx` — inline badge + `isOrgAdminRole` removed; renders `<RoleBadge role={role} />`; honesty beats verbatim.
- `frontend/src/components/layout/ProfileMenu.tsx` — inline header badge + `isOrgAdminRole` removed; renders `<RoleBadge role={role} />`; switcher gate + theme + sign-out verbatim.
- `frontend/src/components/layout/ProfileMenu.test.tsx` — new describe block: per-org-role display (member→Member, org-admin→◆ Org-admin) + shared-`role-badge`-testid assertion; all 7 Phase-166 it()s retained.

## Verification Results

- **Task 1 greps:** `isOrgAdminRole` → 0/0 · `◆` → 0/0 · `RoleBadge` present in both · OrgBand keeps "ORG ADMIN" + "every action recorded" · ProfileMenu keeps `orgs.length >= 2`.
- **Task 2 greps:** `it(` count **9 ≥ 8** (7 pre-existing + 2 new) · "Switch organization", theme-toggle (`/mode/i`), collapsed dual-render, and Sign out assertions all still present · new case asserts member→Member + org-admin→◆ Org-admin + the shared `role-badge` testid.
- **D-06 lock:** `NavPanel.tsx:190` `{canManage && ...}` (org shield honest-absent) + `:209` `{isOperator && ...}` (operator shield) intact.
- **D-07 lock:** amber COLOUR token `amber-` → **0** across OrgBand/OrgMembersTab/InvitationsTab/SsoTab; NavPanel org shield `indigo-400` + operator shield `amber-400` both present + distinct.
- **tsc -b:** zero errors reference OrgBand / ProfileMenu / OrgIdentity. (Pre-existing SEED-056 rot in unrelated files — IngestionPage, useMessages, ChatAreaMode, SettingsPage, skills, etc. — is out of scope.)
- **Suites:** `OrgAdminShell.test.tsx` 9/9 · `ProfileMenu.test.tsx` (extended) 9/9.
- **Differential (SEED-056):** `src/components/org src/components/layout` → **14 files / 133 tests PASS, 0 failures, 0 net-new** vs baseline `6d145860`.
- **RED LINES (git-verified):** `git diff HEAD~2..HEAD` touches only the 3 planned files — `StreamsProvider.tsx` + `OrgProvider.tsx` UNTOUCHED; no `canManage`/`canManageSso`/`canInvite`/`canAuditView` gate polarity or call-site edited; `frontend/package.json` unchanged.

## Decisions Made

- **D-05 → audit, not wiring** (recorded above). No OrgProvider change; the per-org role truth already exists and every site reads it.
- **dept-admin now shown honestly** in OrgBand + ProfileMenu — the intended `roleBadgeMeta` reconciliation, surfaced by consuming the shared primitive.

## Deviations from Plan

### Minor — comment-only, behaviour byte-identical

**1. [Rule 3 — plan-acceptance fidelity] Neutralised incidental `◆` in render-adjacent comments**
- **Found during:** Task 1. The plan's `grep -c "◆" → 0` acceptance is a literal-word grep; after removing the inline JSX spans, the glyph still lingered in 3 OrgBand comments (file header, `role` prop doc, the render comment) + 1 ProfileMenu header comment — describing the badge that now lives in RoleBadge.
- **Fix:** Rephrased those comments ("the shared RoleBadge — Org-admin / Member") so the glyph truly lives only inside RoleBadge; the `◆` grep is genuinely 0. Comment-only; no behaviour change.
- **Files:** OrgBand.tsx, ProfileMenu.tsx — **Commit:** `b15ab852`.

**2. [Note — measurement precision] D-07 measured by the amber COLOUR token, not the naive word**
- The plan's `grep -c "amber" ...OrgMembersTab.tsx...SsoTab.tsx → 0` returns **2**, not 0 — but both are invariant-DOCUMENTING comments (`OrgMembersTab.tsx:57` "amber stays reserved for the operator zone"; `SsoTab.tsx:69-70` "the operator amber stays reserved for /admin"). They AFFIRM D-07, do not violate it, and live in files this plan does not modify (177-03/177-04 own them). The precise D-07 lock — the amber COLOUR class `amber-` — is **0** across all four org surfaces. I deliberately did NOT gut the affirming comments (that would reduce clarity, not improve cohesion). Verdict: D-07 holds; measured by `amber-`.

## Known Stubs

None. This is a display-cohesion rewire + an invariant lock — no empty/placeholder data paths introduced.

## Threat Flags

None. D-01/D-03: polish over the already-secured 166 surfaces. No new endpoint, auth path, file access, or schema surface; the render-gates stay courtesy-only (the server gates remain the wall), and no authz condition was edited.

## Self-Check: PASSED

- All 3 modified files verified on disk (FOUND ×3): OrgBand.tsx, ProfileMenu.tsx, ProfileMenu.test.tsx.
- Both task commits verified in `git log` (FOUND ×2): `b15ab852`, `5ecdabf8`.
- RED LINES git-verified: only the 3 planned files changed; StreamsProvider/OrgProvider untouched; no authz gate edited.

---
*Phase: 177-v3-4-org-surface-polish*
*Completed: 2026-07-23*

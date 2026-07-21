---
phase: 166-org-admin-shell-org-switcher-profile-menu-anchor
verified: 2026-07-21T21:00:00Z
status: human_needed
score: 5/5 must-haves verified (code truths); live UAT pending
overrides_applied: 0
human_verification:
  - test: "SC#10 Axis 3 row #6 — org-switch-mid-stream (the D-166-08 hard acceptance bar)"
    expected: "Thread A mid-stream; switch org via ProfileMenu; the mid-stream predicate refuses to wipe A's active bucket, refetch reconciles to the new org, no cross-org data leak, no console error/orphaned subscription."
    why_human: "Requires a running uvicorn + browser + a live in-flight LLM stream; cannot be exercised via grep/unit test."
  - test: "SC#10 Axis 1 — cross-provider (OpenAI/Anthropic/Google/OpenRouter) org-chrome-during-stream rows 1-4"
    expected: "A chat stream on each provider is unaffected by ProfileMenu/switcher render; stream completes normally."
    why_human: "Requires live provider API keys + a running app; the org header injection is provider-agnostic by construction but the live behavior needs an operator-driven pass."
  - test: "SC#10 Axis 2 row #5 — multi-tool run + shell navigation mid-stream"
    expected: "Opening the org-admin shell (Members/Audit) while a multi-tool run streams does not tear down the run; the org fetches carry X-Org-Id; the run completes intact on return to chat."
    why_human: "Requires a live multi-tool agent run; cannot be simulated via static analysis."
  - test: "SC#10 Axis 3 rows #7-8 — parallel-thread cross-org isolation + member-only-org 403"
    expected: "Thread B streams cleanly under org 2 without org-1 event bleed; switching to a member-only org hides the indigo shield and any forced shell access 403s server-side."
    why_human: "Requires seeding a second org membership (per VALIDATION.md Setup) and live parallel-thread interaction."
  - test: "SC#10 Axis 4 row #9 — long-message (>=50 messages / >=5KB prompt) mid-stream org switch"
    expected: "The teardown + refetch handle a heavy thread without dropping the guard; audit list paginates without loading full history."
    why_human: "Requires a live long-running thread; not exercisable via unit tests."
  - test: "G-4 lived-experience L1-L6 (solo-user quiet button, ⌥ Technical-names shared-toggle, audit RLS banner, member Members-tab absence, locked-tab copy honesty, 58px-rail collapse)"
    expected: "Each L-row's failure condition (per 166-VALIDATION.md) does NOT occur when driven live in the browser, both themes, collapsed + expanded rail."
    why_human: "G-4 explicitly requires Chrome-MCP-driven or operator-clicked live verification — wire format + screenshot are insufficient per the guardrail."
---

# Phase 166: Org-Admin Shell + Org Switcher + Profile-Menu Anchor Verification Report

**Phase Goal:** A multi-org user gets a real identity anchor, an org switcher that safely swaps active-org context, and an org-admin shell with org-scoped audit + a resolved Settings IA — the human-facing surface of the now-real tenancy model, reusing the shipped v3.3 Control-Room shell as composition.
**Verified:** 2026-07-21
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All 5 truths below are derived directly from ROADMAP.md's Phase 166 Success Criteria (the authoritative contract), cross-checked against the actual shipped source files (not SUMMARY.md prose).

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | SC1/ADMIN-03: A profile-menu identity anchor shows name / email / role badge / sign-out | VERIFIED | `frontend/src/components/layout/ProfileMenu.tsx:63-204` renders `displayName`/`email` (from `useAuth`), the `◆ Org-admin`/`Member` badge (`isOrgAdminRole`, lines 56-60, 132-143), and a Sign-out `DropdownMenuItem` (194-200). `ProfileMenu.test.tsx` 7/7 green (ran live: `npx vitest run` confirms). |
| 2 | SC2/ADMIN-02: A multi-org user sees an org switcher; switching changes active-org context via the hybrid mechanism; `<OrgContext>` wraps OUTSIDE `StreamsProvider`; a switch tears down in-flight subscriptions + refetches | VERIFIED | `frontend/src/App.tsx:213-265` — `<OrgProvider>` opening tag precedes `<StreamsProvider>`. `frontend/src/lib/api.ts:76-115` injects `X-Org-Id` into `getAuthHeaders` on every authed call. Backend `get_active_org_id` (`backend/app/dependencies.py:525-577`) server-validates the header against `org_members` on a user-JWT connection (403 on non-member — confirmed live via `test_spoofed_x_org_id_is_rejected_403`, PASSED). `StreamsProvider.tsx:2884-2916` — a new `useEffect` keyed on `activeOrgId` (read via `useOrgOptional`) tears down subscriptions + loops the EXISTING guarded `clearThreadBucket` (line 2914); the `!sendingThreadsRef.current.has(tid)` predicate at line 1340 is byte-unchanged (confirmed by direct read) and `sendingThreadsRef` grep count = 13 (matches SUMMARY claim). `ChatLayout.tsx:130-135` refetches `loadThreads()` on a real `activeOrgId` change (ref-guarded, skips mount). |
| 3 | SC3/ADMIN-01: An org-admin (with `org:manage`) sees the 7-tab shell; a non-admin does not | VERIFIED (with a documented naming consolidation, see note below) | `backend/app/dependencies.py:580-597` (`require_org_manage`, 403 on missing `org:manage`, confirmed by live pytest `test_members_default_deny_without_org_manage` PASSED). `frontend/src/components/org/OrgAdminShell.tsx:73-101` — 7-entry `TABS` (3 `locked:false` — Members/Audit/Settings; 4 `locked:true` — Invitations & Roles/SSO/Subscription/Retention). `NavPanel.tsx:190-203` — the indigo Shield-mirror renders ONLY when `canManage` (render-only gate; backed by the server 403). `ChatLayout.tsx:631-639` mounts `OrgAdminShell` on the `org-admin` branch — reachability triad closed (ActiveView union + mount + rail entry, all in-phase; the Phase-118 built-but-unreachable lesson explicitly avoided). |
| 4 | SC4/ADMIN-04: An org-admin with `org:audit_view` sees all members' audit rows within their org; a member sees only their own | VERIFIED | `backend/app/api/org.py:177-228` (`GET /org/audit`) branches on `_has_org_permission(...,"org:audit_view")`: `scope="all"` (no user_id filter) vs `scope="own"` (`.eq("user_id", caller)`), always `.eq("org_id", active_org)`. Confirmed by LIVE pytest `test_audit_own_only_when_no_audit_view` (asserts both the `scope=="own"` value AND the `("user_id", CALLER_ID)` eq-call) and `test_audit_all_org_rows_when_audit_view` (scope="all", no user_id filter) — both PASSED. Frontend `OrgAuditTab.tsx:168-182` renders the explicit "you see only your own activity" banner + own-only rows when `scope==="own"` — never a silent empty list (read directly, matches T-166-08). |
| 5 | SC5/ADMIN-05: The Settings IA split resolves SEED-116 — personal prefs under the profile menu, org config behind `org:manage`, platform config stays in Control Room | VERIFIED | `ProfileMenu.tsx` holds the personal sliver (identity/role badge/theme/sign-out — theme toggle confirmed the ONLY rail-footer theme control; the standalone `RailItem` at old NavPanel:174-178 is removed, confirmed by reading the current NavPanel footer block, lines 180-234). `OrgSettingsTab.tsx` is the org-config home behind the `org:manage`-gated shell (genuine content: org name + three-homes seam sentence, no scope-reduction language found by grep). The bulk global-knob relocation is explicitly and correctly DEFERRED to v3.5 (SEED-117 §1) per 166-CONTEXT.md D-166-03 — this is a documented scope decision, not a gap. |

**Score:** 5/5 truths verified at the code level. Live-experience verification (SC#10 4-axis UAT + G-4) is outstanding — see Human Verification Required below.

**Note on SC3 tab-naming:** ROADMAP SC3 names the 7 tabs verbatim as "Members/Invitations · Departments/Roles · SSO · Audit · Subscription · Retention · Settings." The shipped shell instead ships "Members" (live) + "Invitations & Roles" (locked, folding invitations AND role/department editing into one placeholder) + SSO/Subscription/Retention (locked) + Audit + Settings (live) = 7 tabs total. This consolidation was explicitly decided and documented BEFORE planning in `166-CONTEXT.md` (D-166-01: "Invitations/Roles → Phase 167 ... 4 tabs render as locked 'coming soon' placeholders"), not an undocumented executor deviation. The goal's spirit — a 7-tab, `org:manage`-gated shell, honest live-vs-locked split, no phase numbers in locked copy — is fully met. Flagged here for visibility, not as a gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `backend/app/dependencies.py` | `get_active_org_id`, `require_org_manage`, `_has_org_permission` | VERIFIED | All three present (lines 491-597); parameterized `$1`/`$2` binds throughout; `_has_org_permission` runs on `get_user_pg_connection` (never BYPASSRLS) — read directly. |
| `backend/app/api/org.py` | `/org/me`, `/org/members`, `/org/audit` router | VERIFIED | Router-level `Depends(get_active_org_id)` default-deny (line 46); `require_org_manage` on members + audit; live route registration confirmed via `from app.main import app; ...` → `['/org/audit', '/org/me', '/org/members']`. |
| `backend/tests/test_166_org_gate.py` | 5-test authz regression suite | VERIFIED | Ran live: `pytest tests/test_166_org_gate.py -v` → 5/5 PASSED (spoof-403, default-deny, audit own/all degrade, /org/me shape). |
| `frontend/src/providers/OrgProvider.tsx` | Context + `switchOrg` teardown | VERIFIED | 140-line file; `useOrg`/`useOrgOptional` exported; `switchOrg` syncs the header synchronously then flips state (lines 104-111). |
| `frontend/src/hooks/useOrgPermissionsProbe.ts` | Fail-closed probe re-keyed on userId+activeOrgId | VERIFIED | `CLOSED` default (lines 21-27); effect dependency array `[userId, activeOrgId]` (line 94); catches resolve to `CLOSED`. |
| `frontend/src/lib/api.ts` | X-Org-Id injection + org API fns | VERIFIED | `getAuthHeaders` spreads `X-Org-Id` (line 115); `getOrgPermissions`/`getOrgMembers`/`getOrgAudit` all present. |
| `frontend/src/components/org/OrgBand.tsx` | Indigo identity band | VERIFIED | Zero amber tokens (grep confirms 0 `amber` matches in current file — only "operator zone's reserved warning tint" wording in comments); "every action recorded" marker present (line 108); role badge copy present. |
| `frontend/src/components/org/OrgMembersTab.tsx` | Read-only roster | VERIFIED | No write affordances (`onDisable`/`onGrant`/`onRevoke`/confirm sheets absent by direct read); banner names no phase number in rendered copy (line 85-86). |
| `frontend/src/components/org/OrgAuditTab.tsx` | Lighter audit + RLS-honest degrade | VERIFIED | `scope === "own"` banner (lines 170-182) renders above own-only rows; no CSV/export/source-switch code found. |
| `frontend/src/components/org/OrgSettingsTab.tsx` | Light org-config home | VERIFIED | Genuine content (org name + seam sentence); no "v1/placeholder/static for now" language. |
| `frontend/src/components/org/OrgAdminShell.tsx` | Band+7-tab shell, fetch owner | VERIFIED | `TABS` array: 4 `locked:true` + 3 `locked:false` (counts match SUMMARY); `alive.current` guard + lazy per-tab fetch (lines 134, 174-178); `scope` threaded straight through to `OrgAuditTab` (line 275, `result={auditResult}`). |
| `frontend/src/components/layout/ProfileMenu.tsx` | 079-C merged popover | VERIFIED | Identity + role badge + switcher-at-2+-orgs (`orgs.length >= 2`, line 79) + theme + Sign out, all present; `switchOrg` delegation only (no `clearThreadBucket` reference in the file). |
| `frontend/src/components/layout/NavPanel.tsx` | Indigo Shield-mirror + ProfileMenu anchor | VERIFIED | `canManage`-gated `RailItem` (lines 190-203), OUTSIDE the `NAV_ITEMS` shared array; indigo tokens only (`indigo-500/15`, `indigo-400`); standalone theme `RailItem` confirmed removed (footer comment + code read directly). |
| `frontend/src/components/layout/ChatLayout.tsx` | org-admin view branch | VERIFIED | `activeView === "org-admin"` branch mounts `<OrgAdminShell onBack={...}/>` (line 639); `activeOrgId`-keyed refetch effect present (lines 130-135). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `backend/app/api/org.py` | `public.current_user_has_permission` | user-JWT asyncpg connection | WIRED | `_has_org_permission` (dependencies.py:504-522) calls it via `get_user_pg_connection`; confirmed the function exists live in the local DB (`pg_proc` query returned `current_user_has_permission`) and the seeded catalog contains `org:manage`/`org:audit_view` rows. |
| `backend/app/api/org.py` | `public.audit_log` | service-role client, `.eq("org_id", ...)` | WIRED | `_get_org_audit_supabase` (org.py:80-84) + `_apply_org_audit_filters` (62-77) always apply the org predicate; own-only branch adds `.eq("user_id", ...)`. |
| `frontend/src/providers/OrgProvider.tsx` | `StreamsProvider` clearThreadBucket | `switchOrg` → `activeOrgId` effect → guarded action | WIRED | Confirmed by direct read of `StreamsProvider.tsx:2900-2916` — loops `actions.clearThreadBucket(surface)` for every active surface; the guard predicate is untouched. |
| `frontend/src/lib/api.ts` | backend `/org/me` | `getOrgPermissions` fetch with `X-Org-Id` | WIRED | `getOrgPermissions` (api.ts:4559+) hits `/org/me`; header injected module-wide via `getAuthHeaders`. |
| `frontend/src/components/layout/NavPanel.tsx` | `onNavigate('org-admin')` | indigo Shield-mirror click, gated on `canManage` | WIRED | `onClick={() => onNavigate("org-admin")}` (NavPanel.tsx:196). |
| `frontend/src/components/layout/ProfileMenu.tsx` | `OrgProvider.switchOrg` | org-switcher pick action | WIRED | `org?.switchOrg(o.org_id)` (ProfileMenu.tsx:161). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `OrgAdminShell` Members tab | `members` state | `getOrgMembers()` → `GET /org/members` → `org_members JOIN auth.users` (real asyncpg query, `org.py:126-174`) | Yes (live DB query, no static fallback) | FLOWING |
| `OrgAdminShell` Audit tab | `auditResult` state | `getOrgAudit()` → `GET /org/audit` → `supabase.table("audit_log").select(...)` with `run_in_threadpool`-wrapped `.execute()` | Yes (real Supabase query, service-role + app-code authz) | FLOWING |
| `OrgProvider` `orgs`/`role`/`canManage` | `useOrgPermissionsProbe` | `getOrgPermissions()` → `GET /org/me` → live asyncpg `org_members JOIN organizations` fetch | Yes | FLOWING |
| `ProfileMenu` switcher rows | `org.orgs` | Same `/org/me` `memberships[]` | Yes | FLOWING |

No hollow props or disconnected data sources found on any wired artifact.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| `/org/*` routes registered | `python -c "from app.main import app; ..."` | `['/org/audit', '/org/me', '/org/members']` | PASS |
| `current_user_has_permission` exists live + permission catalog seeded | psycopg2 query against local Supabase (`:54322`) | `current_user_has_permission` found in `pg_proc`; `org:manage`/`org:audit_view` rows present in `role_permissions` | PASS |
| Backend authz regression suite | `pytest tests/test_166_org_gate.py -v` | 5/5 PASSED | PASS |
| Org isolation exit-gate (no regression) | `pytest tests/integration/test_v3_4_org_isolation.py -q` | 23 passed | PASS |
| Full-project frontend typecheck | `npx tsc --noEmit` | exit 0 | PASS |
| Touched-surface frontend tests | `npx vitest run src/components/org/ src/providers/OrgProvider.test.tsx src/components/layout/ProfileMenu.test.tsx src/components/layout/NavPanel.test.tsx src/components/layout/ChatLayout.orgRefetch.test.tsx` | 7 files / 40 passed | PASS |
| Regression suites (pre-existing NavPanel/ChatLayoutLaunch) | `npx vitest run src/components/layout/__tests__/NavPanel.test.tsx src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` | 2 files / 16 passed | PASS |
| Full frontend suite — confirm pre-existing rot is NOT a phase-166 regression | `npx vitest run` | 10 files / 24 tests failed, ALL in `streamsProvider*`, `useMessages`, `IngestionPage`, `MessageItem`, `Plan04.frontend`, `PublishGauntlet`, `soulData`, `model-info` — none import NavPanel/ChatLayout/ProfileMenu/OrgProvider/org/* | PASS (rot confirmed pre-existing, not a regression — matches SEED-056) |
| No new migration authored in the 166 commit range | `git log --name-only <163..166 commits> -- supabase/migrations/` | Migration commits found only for phases 163-165; none in the 166-0x commit range | PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` declared in the PLAN/SUMMARY files, and it is not a migration/tooling phase in the probe-harness sense. Skipped.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| ADMIN-01 | 166-01, 166-03, 166-04, 166-05 | Org-admin shell gated on `org:manage`, reusing Control-Room composition | SATISFIED | Backend default-deny + `require_org_manage` (403 confirmed live); 7-tab shell; rail reachability triad closed. |
| ADMIN-02 | 166-01, 166-02, 166-05 | Org switcher + hybrid JWT/X-Org-Id mechanism; `<OrgContext>` outside `StreamsProvider`; switch tears down + refetches | SATISFIED | `OrgProvider` mounts outside `StreamsProvider` (App.tsx); switch teardown reuses the guarded `clearThreadBucket`; `ChatLayout` refetches `loadThreads()` on org change. |
| ADMIN-03 | 166-02, 166-05 | Profile-menu identity anchor (name/email/role badge/sign-out) | SATISFIED | `ProfileMenu.tsx` full implementation confirmed by direct read. |
| ADMIN-04 | 166-01, 166-03, 166-04 | Org-scoped audit — `org:audit_view` sees all, member sees own | SATISFIED | Backend branch + frontend RLS-honest banner both confirmed by direct read + live pytest. |
| ADMIN-05 | 166-03, 166-04, 166-05 | Settings IA split (SEED-116) | SATISFIED | Personal sliver in `ProfileMenu`; org-config home in `OrgSettingsTab`; bulk relocation correctly deferred to v3.5 per documented D-166-03. |

No orphaned requirements — REQUIREMENTS.md lists exactly ADMIN-01..05 mapped to Phase 166 (lines 43-47, 127-131), and every ID is claimed by at least one plan's `requirements:` frontmatter (union across the 5 plans covers all 5 IDs).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | No `TODO`/`FIXME`/`XXX`/`TBD`/`HACK` debt markers found in any of the 15 phase-166 touched files | — | None — clean |
| `OrgAdminShell.tsx` / `OrgMembersTab.tsx` | 78-99 / 85-86 | "coming soon" copy on the 4 genuinely-locked tabs + the read-only banner | INFO | Intentional, honest "not yet built" language for features that ARE deferred (Phase 167/168/170) — not a lie about what's live. No roadmap phase number leaks into rendered copy (confirmed by grep — only code comments reference "Phase 167" etc., never user-visible strings). |

No blocker or warning-level anti-patterns found.

### Human Verification Required

The code-level truths (all 5 ROADMAP success criteria + the D-166-06/07/08/09 locked decisions) are fully verified against the shipped source and pass automated tests (backend pytest, org-isolation exit gate, frontend vitest, tsc). What remains is the **live-experience verification** that 166-VALIDATION.md itself defines as the acceptance bar and that CLAUDE.md's UAT-scoreboard-recipe + the G-4 workflow guardrail make mandatory for any UI/streaming-touching phase. These cannot be exercised via grep/static analysis — they require a running `uvicorn` backend, a browser (Chrome MCP or operator-driven), and live provider API keys.

1. **Org-switch mid-stream (SC#10 Axis 3, row #6 — the hard acceptance bar for D-166-08)**

**Test:** Start a long generation in Thread A; while it is mid-stream, switch org via the ProfileMenu.
**Expected:** The mid-stream predicate refuses to wipe A's active bucket; the refetch reconciles to the new org; no cross-org data leak; no console error or orphaned subscription.
**Why human:** Requires a live in-flight LLM stream and a real org switch interaction — the code path is verified (predicate byte-unchanged, teardown wired), but the end-to-end lived behavior needs live exercise.

2. **Cross-provider org-chrome-during-stream (SC#10 Axis 1, rows 1-4)**

**Test:** Start a stream on each of OpenAI/Anthropic/Google/OpenRouter; open the ProfileMenu mid-stream.
**Expected:** Stream completes normally; org chrome is additive, no stall.
**Why human:** Requires live provider keys + a running app.

3. **Multi-tool run + shell navigation (SC#10 Axis 2, row #5)**

**Test:** One prompt exercising 2+ tools; navigate to the org-admin shell mid-run; return to chat.
**Expected:** The in-flight run is not torn down; shell fetches carry `X-Org-Id`; the completed run is intact on return.
**Why human:** Requires a live multi-tool agent run.

4. **Parallel-thread isolation + member-only-org absence (SC#10 Axis 3, rows 7-8)**

**Test:** Seed a second org membership (per 166-VALIDATION.md Setup); switch orgs while Thread A streams, start Thread B in the new org; then switch to a member-only org.
**Expected:** No event bleed between threads/orgs; the indigo shield is absent for the member-only org; a forced shell access 403s server-side.
**Why human:** Requires seeded test data + live parallel-thread interaction.

5. **Long-message org switch (SC#10 Axis 4, row #9)**

**Test:** In a thread with ≥50 messages (or a ≥5KB prompt), mid-stream, open the shell + Audit tab, then switch org.
**Expected:** Teardown + refetch handle the heavy thread without dropping the guard; audit paginates without loading full history.
**Why human:** Requires a live long-running thread.

6. **G-4 lived-experience rows L1-L6**

**Test:** Drive each of the 6 lived-experience scenarios from 166-VALIDATION.md live (solo-user quiet button; `⌥ Technical-names` shared toggle; audit RLS banner for a non-audit-view org-admin; Members-tab affordance absence for a member; locked-tab copy honesty; 58px-rail collapse).
**Expected:** None of the failure conditions defined in VALIDATION.md occur.
**Why human:** G-4 explicitly mandates Chrome-MCP-driven or operator-clicked live verification — wire format and screenshots are declared insufficient by the guardrail itself.

### Gaps Summary

No code-level gaps found. All 5 ROADMAP success criteria, all locked D-166-01..09 decisions, and all ADMIN-01..05 requirements are verified against the actual shipped source (not SUMMARY.md prose) — confirmed via direct file reads, live pytest runs (5/5 org-gate + 23/23 isolation exit-gate), live psycopg2 queries against the local DB (the mig-104 substrate exists and is called for the first time, as claimed), a full `tsc --noEmit` pass, and a full `vitest run` that isolates the 24 pre-existing SEED-056 rot failures to domains this phase never touched.

The phase is code-complete and passes every automated gate. It is held at `human_needed` rather than `passed` for one reason only: 166-VALIDATION.md defines a mandatory 4-axis + lived-experience UAT (the org-switch-mid-stream row is explicitly "the hard acceptance bar for D-166-08"), and CLAUDE.md's UAT-scoreboard-recipe + G-4 guardrail make this mandatory for any phase touching streaming/UI state — this phase touches both. Per the verification decision tree, any non-empty human-verification list forces `human_needed` regardless of how clean the code-level score is. This is a process gate, not a code defect.

---

*Verified: 2026-07-21*
*Verifier: Claude (gsd-verifier)*

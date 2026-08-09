---
phase: 167-invitations-roles-greenlists-jit-per-user-prefs
verified: 2026-07-22T00:00:00Z
status: human_needed
score: 4/4 code must-haves verified (all 4 roadmap Success Criteria have live-UAT items outstanding)
overrides_applied: 0
human_verification:
  - test: "SC#10 Axis 1 — VIS-02 cross-provider model-default routing (OpenAI/Anthropic/Google/OpenRouter)"
    expected: "A per-user default model set to a Claude/GPT/Gemini/OpenRouter model routes a new chat (no in-composer pick) to that provider; with NO preference set the send path is byte-identical to pre-167 (D-14)"
    why_human: "Requires a running app, live provider API keys, and LangSmith/log inspection per provider — cannot be proven by static analysis; 167-04's unit tests prove the overlay logic (identity-preserving/lock-honoring) but not live cross-provider wire routing"
  - test: "Invite -> Accept -> Join E2E (167-VALIDATION.md E1-E7)"
    expected: "Org-admin sends an invite; a fresh signup and an existing-account sign-in both join the org additively (2-org switcher); adoption chips flip pending->active; expired/revoked invites are honestly rejected; a member without org:invite gets 403 on a hand-crafted send"
    why_human: "Requires a live browser session (or two), a second test identity, and the none-log invite link copied from backend logs/response — the JIT race convergence (E5's advisory-lock proof) IS covered by the automated live integration test (test_167_jit_race.py, passing), but the full sign-up/sign-in UX round-trip is not"
  - test: "Greenlist fail-closed lived-experience (167-VALIDATION.md G1-G5)"
    expected: "An operator sets a feature's audience to role+roles=['org-admin']; a member-role user sees the feature HIDDEN in GET /features AND gets 403 on the endpoint; an org-admin sees it VISIBLE and allowed; a malformed audience record safe-denies"
    why_human: "Requires seeding a second real user with a 'member' role in a live org and observing both the UI hide and the API 403 agree — the resolver's fail-closed/precedence-merge logic IS unit-tested (test_167_greenlist.py, 15/15 passing) but the live two-user hide==refuse agreement is a UAT item"
  - test: "VIS-02 lock lived-experience (167-VALIDATION.md V1-V3) + L1-L8 lived-experience sweep"
    expected: "Toggling the operator lock disables the user's picker + names the governed default; Dept-admin stays visibly greyed; the Invitations tab no longer shows the LockedTab placeholder; a member never sees the Send-invite affordance"
    why_human: "Visual/interaction verification (G-4 'I'd recognize failure here' scenarios) — requires Chrome MCP or operator click-through per CLAUDE.md UAT recipe; not verifiable via grep/test alone"
---

# Phase 167: Invitations + Roles + Greenlists + JIT + Per-User Prefs — Verification Report

**Phase Goal:** An org-admin can invite and onboard members with role/group-based feature greenlists, concurrent first-logins converge to one membership idempotently, and users pick their own defaults within the org-allowed set — the governance + onboarding projection of the tenancy model.

**Verified:** 2026-07-22
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | SC1/INV-01 — org-admin sends email+link invitations (`org_invitations`, hashed token, expiry, env-switched provider); recipient accepts via sign-in/sign-up; adoption states render on the roster | VERIFIED (code) — live E2E is human_needed | `invitation_service.py` mints via `secrets.token_urlsafe(32)`+sha256, stores only `token_hash`; `org.py` 5 endpoints (send/list/resend/revoke/accept) all live, `require_org_invite`-gated except token-gated accept; `email_provider.py` env-switched (`none` default, `resend` opt-in lazy-imported); roster returns server-derived `state` + `pending_invitations` via `derive_adoption_state`. 52 backend unit tests pass (test_167_invitation_service.py + test_167_invitations.py + test_166_org_gate.py). Frontend: InviteMemberDialog (Member/Org-admin picker, Dept-admin greyed), InvitationsTab (pure leaf), OrgAdminShell (locked:true count 4→3, invitations tab live), OrgMembersTab (adoption chips) — 209/209 frontend vitest pass, tsc clean. |
| 2 | SC2/INV-02 — concurrent first-login creates `org_members` idempotently (`INSERT...ON CONFLICT DO NOTHING` + advisory lock), converges to exactly one membership | VERIFIED | `invitation_service.accept_invitation`: `pg_advisory_xact_lock(hashtext(org_id\|\|user_id))` inside one transaction, re-validates `status='pending' AND expires_at>now()` INSIDE the lock, `INSERT...ON CONFLICT (org_id,user_id) DO NOTHING`, guarded `WHERE status='pending'` single-use flip. **Live integration test `tests/integration/test_167_jit_race.py` RAN during this verification and PASSED** — the actual concurrency proof, not just a unit mock. |
| 3 | SC3/VIS-01 — feature visibility resolves per-feature role/group greenlists through the SAME one swappable `require_visible`, Glean precedence-merge (highest role wins primary, union secondary) | VERIFIED (code) — live two-user hide==refuse is human_needed | `require_visible` extended in place (`grep -c "def require_visible"` == 1); role branch added after operator/everyone no-ops; `resolve_feature_access` in `user_settings.py` implements exact-membership-on-roles[] OR union-on-groups[], fail-closed on anything else; `GET /features` derives its bool through the identical `resolve_feature_access` call so hide==refuse by construction; `PUT /admin/visibility` accepts `audience='role'`+`roles[]` validated against the 4-tier allowlist (400 on bad role) before any write. 15/15 test_167_greenlist.py + 21/21 no-regression on test_148_require_visible/test_148_visibility_cold_default. ControlRoomPage/FeatureVisibility.tsx ship the minimal role-chip admin surface wired to `setFeatureAudience`. |
| 4 | SC4/VIS-02 — a user picks a default (model) WITHIN the operator/org-allowed set; the revived `user_settings.preferences` layer honors the operator lock under SEED-116 two-layer | VERIFIED (code) — live cross-provider routing UAT is human_needed | `load_user_model_default` (per-user async read, fail-open None), `enabled_model_allowed_set` (registry `enabled` flag), `operator_model_default_locked` (fail-closed True on error), `compose_effective_model_default` (pure two-layer decision) all present in `user_settings.py`; `apply_user_model_default` in `run_model_resolution.py` is IDENTITY-PRESERVING when unset/locked/out-of-set (`model_copy` only on a real diff) — the D-14 red line; wired into `threads.py` as exactly ONE additive line (`grep -c` == 1). `GET/PUT /me/preferences` writes on the per-user RLS connection (`auth.uid()`), NOT the service-role writer. `ModelDefaultPreference.tsx` clones JudgeModelPicker (registry-only select, always-on 🔒 footer, disables + names governed default when locked, unknown-persisted-value kept as "(current)"). No migration (latest is 111, unchanged). |

**Score:** 4/4 roadmap Success Criteria have their CODE-LEVEL truths verified in the actual codebase (not SUMMARY claims). All 4 also carry at least one live-application/browser UAT item that cannot be settled by static/unit verification — routed to `human_verification` below per GSD convention (Step 9: any non-empty human-verification list forces `human_needed` even when every code truth passes).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `backend/app/services/invitation_service.py` | token mint/hash/verify + idempotent accept + adoption-state | VERIFIED | `mint_invite_token`, `verify_token` (hmac.compare_digest), `accept_invitation` (advisory lock + ON CONFLICT), `derive_adoption_state` all present and exercised by 12+ unit tests + 1 live integration test |
| `backend/app/services/email_provider.py` | EmailProvider protocol + NoneLog/Resend + compose_invite_link | VERIFIED | `NoneLogProvider` (default), `ResendProvider` (lazy `import resend` inside method body only), `compose_invite_link` reuses `settings.frontend_url` |
| `backend/app/dependencies.py::require_org_invite` | org:invite gate mirroring require_org_manage | VERIFIED | Verbatim mirror confirmed by direct read; strict `get_active_org_id` dependency; 403 on deny |
| `backend/app/api/org.py` | 5 invitation endpoints + roster adoption state | VERIFIED | send/list/resend/revoke (`require_org_invite`) + accept (`get_current_user` only); token_hash never in any SELECT/response; explicit `org_id=` on every invitation audit write (T-167-23) |
| `backend/app/services/audit_service.py::write_audit_entry` | optional org_id, byte-identical when omitted | VERIFIED | `org_id: str \| None = None`; inserted into dict ONLY when not None; existing-caller regression suites (32 tests per SUMMARY, spot-checked test_148/149 here) pass |
| `backend/app/models/user_settings.py` | feature_audience role enum + resolve_feature_access + set_feature_visibility + per-user prefs helpers | VERIFIED | All functions read directly; `_feature_record` is the single shared parse path (no fork) |
| `backend/app/dependencies.py::require_visible` | extended in place with role branch | VERIFIED | `grep -c "def require_visible"` == 1; `resolve_caller_role` + `_ROLE_RANK`/`_highest_role` present |
| `backend/app/api/features.py` | GET /features resolves same greenlist as the gate | VERIFIED | Identical `resolve_feature_access` call site as `require_visible` |
| `backend/app/api/admin.py::set_visibility` | PUT /admin/visibility accepts role audience + roles[] | VERIFIED | `_VISIBILITY_AUDIENCES = {"everyone","operators","role"}`, `_VISIBILITY_ROLES` 4-tier allowlist, 400 on bad role |
| `backend/app/api/me_preferences.py` | GET/PUT /me/preferences | VERIFIED | Registered in `main.py`; per-user RLS JSONB upsert keyed on `auth.uid()`; validates ∈ allowed-set (400) |
| `backend/app/services/run_model_resolution.py::apply_user_model_default` | identity-preserving chat-send overlay | VERIFIED | `model_copy` ONLY on a genuine diff; fail-open on any exception |
| `backend/app/api/threads.py` | one-line G-5 guard | VERIFIED | `grep -c "apply_user_model_default"` == 1 |
| `backend/tests/test_167_invitation_service.py`, `test_167_invitations.py`, `test_167_greenlist.py`, `test_167_prefs.py`, `tests/integration/test_167_jit_race.py` | full unit + live-race coverage | VERIFIED | All RAN during this verification: 52 passed (unit) + 1 passed (live race) |
| `frontend/src/lib/api.ts` | invitation + prefs + greenlist client fns | VERIFIED | `sendInvitation/listInvitations/resendInvitation/revokeInvitation/acceptInvitation`, `getModelDefault/setModelDefault`, `setFeatureAudience` all present, each carrying `getAuthHeaders()` |
| `frontend/src/components/org/InviteMemberDialog.tsx` | invite modal (Member/Org-admin, Dept-admin greyed) + link-first copy | VERIFIED | `ROLE_OPTIONS` includes `dept-admin: enabled:false` with "(soon)" hint; no super-admin option; copy-link affordance on send |
| `frontend/src/components/org/InvitationsTab.tsx` | pure-leaf invitations home | VERIFIED | Exists, referenced from OrgAdminShell body switch |
| `frontend/src/components/org/OrgAdminShell.tsx` | Invitations & Roles locked->live | VERIFIED | `locked: false` for invitations; `grep -c "locked: true"` == 3 (SSO/Subscription/Retention remain locked) |
| `frontend/src/components/org/OrgMembersTab.tsx` | adoption chips | VERIFIED | `adoptionChip()` maps server `state` to Pending(indigo)/Active(muted); stale "coming soon" banner text removed (confirmed by comment + code read) |
| `frontend/src/pages/AcceptInvitePage.tsx` | invite landing (auth toggle + idempotent accept) | VERIFIED | `firedRef` guards a single `acceptInvitation(token)` call; sessionStorage token survival; honest 404/409/missing states |
| `frontend/src/App.tsx` | /invite routing branch | VERIFIED | `atInvitePath` check placed BEFORE the `!user` AuthPage return, mirrors `/setup` precedent |
| `frontend/src/components/settings/ModelDefaultPreference.tsx` | VIS-02 registry-only picker + 🔒 footer | VERIFIED | Options from `allowed_models` only; unknown persisted value kept as "(current)"; disabled + amber footer copy when `locked` |
| `frontend/src/components/admin/ControlRoomPage.tsx` + `FeatureVisibility.tsx` | minimal role-greenlist admin surface | VERIFIED | `setFeatureAudience` wired; role selection constrained to the 4-tier set in `FeatureVisibility.tsx` |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `invitation_service.py` | `public.org_members` | `ON CONFLICT (org_id,user_id) DO NOTHING` inside `pg_advisory_xact_lock` | WIRED | Confirmed by direct code read AND a passing live integration test |
| `dependencies.py::require_org_invite` | `public.current_user_has_permission` | `_has_org_permission(..., "org:invite")` | WIRED | Verbatim mirror of `require_org_manage`; 403 confirmed by unit test |
| `org.py::send` | `public.org_invitations` | user-JWT INSERT under `org_invitations_insert WITH CHECK` | WIRED | Runs on `get_user_pg_connection`, not service-role |
| `org.py::accept` | `invitation_service.accept_invitation` | token-authorized pool path (`get_current_user` only) | WIRED | Confirmed; no `require_org_invite`/`get_active_org_id` on the accept route |
| `org.py` | `audit_service.write_audit_entry` | explicit `org_id=` (send/resend/revoke=active_org, accept=invitation org_id) | WIRED | All 4 call sites confirmed passing explicit `org_id=` |
| `dependencies.py::require_visible` | `user_settings.py::resolve_feature_access` | role branch inside the SAME closure | WIRED | Single `require_visible` definition; role branch confirmed |
| `admin.py::set_visibility` | `user_settings.py::set_feature_visibility` | allowlist-validated role record → atomic `\|\|` merge | WIRED | 400 before any write on a bad feature/audience/role |
| `frontend api.ts` | `POST /org/invitations` | `getAuthHeaders()` auto-injects `X-Org-Id` | WIRED | Confirmed in `sendInvitation` |
| `OrgAdminShell.tsx` | `InvitationsTab.tsx` | `activeTab === 'invitations'` body branch | WIRED | Live mount confirmed; `locked:false` |
| `AcceptInvitePage.tsx` | `acceptInvitation` (api.ts) | post-auth call with URL token | WIRED | `firedRef`-guarded single call |
| `App.tsx` | `AcceptInvitePage.tsx` | `window.location.pathname === '/invite'` branch | WIRED | Placed before `!user` return |
| `threads.py` | `run_model_resolution.py::apply_user_model_default` | one-line async overlay after `load_user_settings` | WIRED | Exactly one call site |
| `me_preferences.py` | `public.user_settings.preferences` | RLS `\|\|` merge keyed on `auth.uid()` | WIRED | Confirmed in PUT handler |
| `ModelDefaultPreference.tsx` | `GET/PUT /me/preferences` | `getModelDefault`/`setModelDefault` | WIRED | Save-on-select + re-read confirmed |
| `ControlRoomPage.tsx` | `PUT /admin/visibility` | `setFeatureAudience` with role audience + roles[] | WIRED | Confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| InvitationsTab / OrgMembersTab | `invitations`, `state`/`pending_invitations` | `GET /org/invitations`, `GET /org/members` (real asyncpg queries against `org_invitations`/`org_members`) | Yes — live DB reads, not static | FLOWING |
| ModelDefaultPreference | `pref.default_model/effective_model/locked/allowed_models` | `GET /me/preferences` → `user_settings.preferences` + `model_capabilities_overrides` + `app_settings.llm_model_locked` (all live reads) | Yes | FLOWING |
| AcceptInvitePage | `acceptInvitation(token)` result | `POST /org/invitations/accept` → `invitation_service.accept_invitation` (live transaction against `org_invitations`/`org_members`) | Yes | FLOWING |
| FeatureVisibility greenlist chips | `greenlist` map | `PUT /admin/visibility` → `set_feature_visibility` → `app_settings.feature_visibility` JSONB | Yes (write path); read side re-derives via `feature_audience`/`_feature_record` | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Backend phase-167 unit suites all pass | `pytest tests/test_167_invitation_service.py tests/test_167_invitations.py tests/test_167_greenlist.py tests/test_167_prefs.py tests/test_166_org_gate.py -q` | 52 passed | PASS |
| Live JIT-race convergence | `pytest tests/integration/test_167_jit_race.py -q` | 1 passed | PASS |
| Milestone exit-gate regression | `pytest tests/integration/test_v3_4_org_isolation.py -q` | 23 passed | PASS |
| VIS-01 no-regression | `pytest tests/test_148_require_visible.py tests/test_148_visibility_cold_default.py tests/test_149_fallback_notice.py -q` | 21 passed | PASS |
| Frontend TypeScript compile | `npx tsc --noEmit` | exit 0 | PASS |
| Frontend component suites (org/invite/prefs/admin) | `npx vitest run src/components/org src/pages/AcceptInvitePage.test.tsx src/components/settings/ModelDefaultPreference.test.tsx src/components/admin` | 209 passed (24 files) | PASS |
| No new migration authored | `ls supabase/migrations/` (latest = 111) | 111 unchanged | PASS |
| Deploy-artifact drift (D-16, new email env vars) | `bash scripts/check-deploy-drift.sh` | RESULT: PASS (2 pre-existing non-blocking WARNs unrelated to 167) | PASS |
| Pre-existing test rot re-confirmed NOT a 167 regression | `pytest tests/test_dual_mode_wiring.py tests/test_provider_router.py -q` + `git log` on those files | 19 failed / 38 passed; git history shows last touch = Phase 165/163/162.5, never 167 | PASS (confirmed pre-existing, logged in `deferred-items.md`) |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes declared or referenced by this phase's PLAN/SUMMARY/VALIDATION files. Step 7c: SKIPPED (no probe-based verification declared for this phase — it uses pytest/vitest suites + a live integration test instead, all executed above).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| INV-01 | 01, 02, 05, 06 | Org-admin invitations + adoption states | SATISFIED (code) | endpoints + UI + tests as above; live E2E UAT outstanding (human_needed) |
| INV-02 | 01, 02, 06 | Idempotent JIT membership creation | SATISFIED | advisory lock + ON CONFLICT + guarded flip; live race test passing |
| VIS-01 | 03, 07 | Role/group feature greenlists via require_visible | SATISFIED (code) | extended-not-forked resolver; fail-closed; hide==refuse; live two-user UAT outstanding (human_needed) |
| VIS-02 | 03 (shared groundwork), 04, 07 | Per-user preference layer (model default) honoring operator lock | SATISFIED (code) | two-layer compose + identity-preserving overlay; live cross-provider routing UAT outstanding (human_needed) |

No orphaned requirements — `REQUIREMENTS.md` maps exactly INV-01/INV-02/VIS-01/VIS-02 to Phase 167 and all four are claimed across the 7 plans' frontmatter `requirements:` fields.

**Housekeeping note (non-blocking, info only):** `REQUIREMENTS.md` still shows `- [ ]` unchecked boxes and "Pending" in the traceability table (lines 51/52/60/61/132-135) for these four requirements, and `ROADMAP.md`'s Progress table (line 302) still shows "167. ... | 0/? | Not started". These are documentation bookkeeping fields the orchestrator normally updates at phase-completion; they do not reflect the actual (verified) code state and are not a code-truth gap.

### Anti-Patterns Found

None found in the phase-167 shipped/modified files. Scanned all 20 backend+frontend files named in the 7 plans' `files_modified` for `TBD|FIXME|XXX|not yet implemented|coming soon|placeholder` (case-insensitive). All hits were either: (a) pre-existing unrelated code (`KEY_PLACEHOLDER` secret-masking sentinel, SQL `$n` placeholder-list variables, HTML `placeholder=` attributes, Phase-149 model-discovery comment), or (b) legitimate "coming soon" copy for the OTHER 3 tabs (SSO/Subscription/Retention) that remain intentionally locked per this phase's own scope boundary (Phase 168/170/other future phases) — not a stub in the INV/VIS deliverables themselves. No debt markers requiring a follow-up reference were found.

### Human Verification Required

See the `human_verification` frontmatter block above. Summary:

1. **SC#10 Axis 1 — VIS-02 cross-provider model-default routing.** Set a per-user default across OpenAI/Anthropic/Google/OpenRouter and confirm each new chat (no in-composer pick) routes to the correct provider, plus the D-14 byte-identical-when-unset row. `167-VALIDATION.md` names this the hard pass bar for the phase.
2. **Invite → Accept → Join E2E (E1-E7).** Full browser round-trip: send → copy link → accept as new signup → accept as existing account (2-org switcher) → adoption chip flips → idempotent re-accept / concurrent-tab race → expired/revoked rejection → org:invite 403 for a non-inviter.
3. **Greenlist fail-closed lived-experience (G1-G5).** A live member-role user vs an org-admin-role user against a role-greenlisted feature, confirming `GET /features` hide and the endpoint 403 always agree.
4. **VIS-02 lock + L1-L8 lived-experience sweep.** Visual/interaction confirmation (operator lock toggle, Dept-admin greyed, LockedTab→live, Send-invite affordance absence for a non-inviter) per the G-4 "I'd recognize failure here" scenarios in `167-VALIDATION.md`.

All four items are pre-authored in `167-VALIDATION.md` with explicit pass conditions and evidence-capture instructions (psycopg2 queries, uvicorn logs, LangSmith) — they were deliberately deferred to phase-verification time (the file's own header: "rows are executed at `/gsd:verify-work 167`"), not overlooked by planning.

### Gaps Summary

No code-level gaps. Every must-have truth, artifact, and key link declared across the 7 plans' frontmatter was independently verified against the actual shipped source (not the SUMMARY narrative) — token crypto is genuinely one-way and stdlib-only, the JIT accept genuinely runs a live-tested advisory-lock + ON CONFLICT transaction, `require_visible`/`feature_audience`/`set_feature_visibility` are genuinely extended in place (not forked, confirmed by literal `def` grep counts), the VIS-02 overlay is genuinely identity-preserving when unset (D-14), and every claimed test suite was independently re-run during this verification (not just trusted from the SUMMARY) — 52 backend unit + 1 live integration + 21 regression + 209 frontend vitest + tsc, all green. Zero new migration (confirmed: latest is 111). Deploy-drift check independently re-run: PASS.

The reason this phase is `human_needed` rather than `passed` is structural, not a defect: `167-VALIDATION.md` was authored at plan-time specifically to carry the SC#10 cross-provider routing proof, the invite/accept browser round-trip, and the greenlist two-user hide==refuse proof — none of which a static/unit verifier can settle. This is the correct GSD posture (Step 9: any non-empty human-verification list forces `human_needed`), not a sign of incomplete work.

---

*Verified: 2026-07-22*
*Verifier: Claude (gsd-verifier)*

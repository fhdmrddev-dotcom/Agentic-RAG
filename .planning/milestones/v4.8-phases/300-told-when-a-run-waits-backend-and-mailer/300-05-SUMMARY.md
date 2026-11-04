---
phase: 300-told-when-a-run-waits-backend-and-mailer
plan: 05
subsystem: settings-and-invites
tags: [frontend, settings, preferences, invite, words-first, backend-api]
requires:
  - "UserEffectiveSettings.notification_email_delay_seconds / email_from_address / email_from_name / email_dev_redirect_address (300-03)"
  - "email_provider.configured_provider(); run_waiting_email.duration_words (300-03)"
  - "invite wire: POST /org/invitations + /resend carry email_delivery; GET /org/invitations rows carry email_delivery | null (300-03)"
  - "the drainer's opt-out rule coalesce(preferences->>'notification_email_enabled','true') <> 'false' (300-04)"
provides:
  - "GET /settings: notification_email_delay_seconds, email_from_address, email_from_name, email_dev_redirect_address, read-only email_provider"
  - "PUT /settings: the four knobs (delay 60..3600 via _range_refusal_detail; addresses '' or one local@domain; name 1-60, no control chars)"
  - "GET /me/preferences: notification_email_enabled, notification_email_delay_words, email_configured"
  - "PUT /me/preferences/notification-email {enabled} -> the full GET view (one auth.uid() merge)"
  - "lib/api/settings.ts: getNotificationEmailPreference / setNotificationEmailPreference"
  - "EmailSettings (EmailSettingsHandle) on Integrations; EmailNotificationPreference on Preferences"
  - "inviteDeliveryCopy.ts; the invite dialog's three arms; the 'Email not sent' list chip"
affects: [301]
tech-stack:
  added: []
  patterns:
    - "a per-user preference that must not disturb its siblings gets its own one-key merge route"
    - "a client twin of a server formatter is pinned by ONE case list both languages read"
    - "a list marker after a mutation reads the re-fetched row, never the mutation's result"
key-files:
  created:
    - frontend/src/components/settings/EmailSettings.tsx
    - frontend/src/components/settings/EmailNotificationPreference.tsx
    - frontend/src/components/org/inviteDeliveryCopy.ts
    - backend/tests/unit/test_300_settings_email_knobs.py
    - backend/tests/unit/test_300_me_preferences_email.py
    - frontend/src/components/settings/__tests__/EmailSettings.test.tsx
    - frontend/src/components/settings/EmailNotificationPreference.test.tsx
    - frontend/src/components/org/InviteMemberDialog.test.tsx
    - frontend/src/components/org/inviteDeliveryCopy.test.ts
  modified:
    - backend/app/api/settings.py
    - backend/app/api/me_preferences.py
    - backend/tests/unit/test_settings.py
    - backend/tests/unit/test_242_settings_bounds_have_schema_constraints.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - frontend/src/lib/api/skills.ts
    - frontend/src/lib/api/settings.ts
    - frontend/src/lib/api/org.ts
    - frontend/src/components/settings/PreferencesSection.tsx
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/components/org/InviteMemberDialog.tsx
    - frontend/src/components/org/InvitationsTab.tsx
    - frontend/src/components/org/InvitationsTab.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "An emptied sender or test address is stored as '' rather than NULL: save_app_settings skips None by design, so None would never clear the column, and every reader treats '' exactly as NULL (getattr(...) or fallback)."
  - "The member's switch imports @/lib/api/settings directly instead of widening the lib/api.ts barrel (215 commits)."
  - "The list's resend-failure line reads the re-fetched row's email_delivery, so OrgAdminShell.tsx and InvitationsTab's onResend prop are unchanged."
  - "An unsigned call to the new PUT is refused by the shared HTTPBearer with the same status as GET /me/preferences (403 on FastAPI 0.115.6, not 401)."
metrics:
  duration: ~2 h 10 min
  completed: 2026-10-29
  tasks: 3
  files: 26
---

# Phase 300 Plan 05: The member's email switch, the operator's Email card, and the invite dialog's delivery arms — Summary

**A member can now turn off run-waiting email from their own Preferences tab. The switch saves through its own one-key route, so it can never clear their default chat model. Operators set the sender address and name, the delay (60 to 3600 seconds, 2 minutes by default) and the test address in Settings → Integrations, and see which provider sends. Inviters are told in plain words when the invitation email did not go out, in the dialog and on the pending row.**

## What was built

### Task 1: the Settings API and the member's own write (D-07, D-08, D-09, D-10, D-29)
- `api/settings.py` was honoured by construction: only the allow-list, read model, update body, response mapping and the bounded and string writes changed.
  - `GET /settings` returns the four knobs plus a read-only `email_provider` from `configured_provider()`. It returns the provider's name only, never a secret.
  - `SettingsUpdate` has no `email_provider` field, so a PUT that sends one is ignored.
  - The delay is bounded 60..3600 through `_range_refusal_detail` (label "Wait before emailing (seconds)") and joins `_BOUNDED_SETTINGS_FIELDS`. Migration 218's CHECK is the backstop, and `test_242`'s `EXPECTED_BOUNDED_FIELDS` now includes the field.
  - Both addresses go through one helper, `_is_single_email_address`, which copies smtp_adapter's single-address rule. Anything else gets 400 "That isn't an email address."
  - The sender name is refused, never trimmed, if it is outside 1-60 characters or contains a control character.
- `me_preferences.py`:
  - `GET` gains three keys: `notification_email_enabled`, where only a stored `false` counts as off (the drainer's rule); `notification_email_delay_words`, built by `duration_words`; and `email_configured`.
  - New route `PUT /me/preferences/notification-email` with body `{enabled}`. It runs one RLS-scoped `||` merge on `get_user_pg_connection` and has no `require_visible`.
  - `put_my_preferences` is unchanged. Its source sha256 is pinned to the plan base.
- No `/notifications` route was added (D-29). A test lists `app.routes` to check.
- OpenAPI was regenerated with `scripts/export-openapi.py` and `scripts/build-public-openapi.cjs`; `--check` passes.

### Task 2: the member's switch and the operator's Email card (S2, S3)
- `EmailNotificationPreference.tsx` is a new leaf, a `<button role="switch">` that saves on each flip and always shows the server's value:
  - It has no On/Off word, is disabled and has `aria-busy` until the read answers.
  - A failed save keeps the last server value and says "Couldn't save this. Try again."
  - A failed load says "Couldn't load this setting." with a "Retry loading" button.
  - When email is not set up, it adds the line "Email isn't set up on this server yet, so nothing is sent for now." The switch still saves.
  - Its track look is copied from SettingsPage's `Toggle` (UI-D1).
  - It is mounted once in `PreferencesSection` after the default chat model.
- `EmailSettings.tsx` is a new leaf copied file-for-file from `ApiKeyLimits`:
  - A handle with `changes()` and `adopt()` rides Save Integrations. The card has no Save button of its own.
  - "Sent through" is read-only.
  - The addresses are `type="email"` fields. An invalid address shows its line after blur and is not sent.
  - The delay is clamped on blur, and a cleared delay is never sent.
  - The live delay hint uses `durationWords`, a copy of `duration_words`. One `DURATION_CASES` list is read by both the vitest suite and the backend test.
- `SettingsPage.tsx` gained exactly one import, one ref, one spread, one adopt and one mount (`grep -c emailSettingsRef` = 4). `useState(` stays at 49.
- `skills.ts` gained the optional types. `settings.ts` gained `get/setNotificationEmailPreference`, with defensive `?? true` defaults.

### Task 3: the inviter sees a failed send (S4; D-11, UI-D12)
- `inviteDeliveryCopy.ts` is a new leaf with zero imports. It holds the three titles, the sent-body halves, the D-11 sentence verbatim, the chip word and the resend line.
- `org.ts`:
  - Adds `InviteEmailDelivery`.
  - `Invitation.email_delivery` is optional (`| null`).
  - `SendInvitationResult.email_delivery` and the resend result's `email_delivery` are both unwrapped by one `deliveryFrom`. A missing value reads as `not_configured`.
- `InviteMemberDialog.tsx` has three result arms:
  - **Invitation sent**: "We emailed an invitation to **{email}**…".
  - **Invitation created**: a neutral `role="status"` box with `MailX` and the D-11 sentence. Copy link takes focus.
  - **Invitation ready**: the shipped panel, unchanged.
  - The expiry line stays on all three.
- `InvitationsTab.tsx`:
  - A pending row whose last send failed shows a second muted `StatusChip` ("Email not sent", testId `invitation-email-status`).
  - A fresh resend link shows the resend line while the re-fetched row still reads `failed`.

## Verification

| Gate | Verdict (verbatim) |
|---|---|
| Task 1 suites | `test_300_settings_email_knobs.py` + `test_300_me_preferences_email.py` + `test_242_*` + `test_283_settings_two_role_fence.py` + `test_293_rate_limit.py` + `test_settings.py` → `145 passed`; `test_276_openapi_snapshot_fresh.py` → `2 passed`; `build-public-openapi --check OK — docs/public/api/openapi.public.json is current (227/269 paths, 312 schemas, version 4.5).` |
| Task 2 suites | `EmailSettings` + `EmailNotificationPreference` + `ApiKeyLimits` + `ModelDefaultPreference` + `SettingsPage.member283` → `Test Files 5 passed (5) · Tests 81 passed (81)`; wider `src/pages/__tests__ src/pages/SettingsPage src/components/settings` → `Test Files 67 passed (67) · Tests 1239 passed (1239)` |
| Task 3 suites | `inviteDeliveryCopy` + `InviteMemberDialog` + `InvitationsTab` + `StatusChip` + `OrgAdminShell` → `Test Files 5 passed (5) · Tests 60 passed (60)` |
| Backend baseline (lock held) | `[GATE PASSED] Backend unit baseline satisfied (failed: 69 <= 71, errors: 0).` — `69 failed, 10686 passed, 1 skipped, 2 xfailed, 2 xpassed` |
| Frontend typecheck | `npx tsc -p tsconfig.app.json --noEmit` → **61** `error TS` lines (base 61). Compared by file and message, not by count: none of the 61 is in a file this plan created, none is in `lib/api/org.ts` or the org components, and the three in `SettingsPage.tsx` / `SettingsPage.test.tsx` are pre-existing (`web_search_enabled` not in `SettingsUpdate`, the InfoTooltip `tooltip` prop, the fixture's `self_improve_enabled`). No new line. |
| Vitest count gate | `count gate OK — 573/573 pinned files present, no per-file decrease, 0 failing.` (`total 13292 · failed 0 · pinned total 12139`). Includes the five new pins: EmailSettings 28, EmailNotificationPreference 17, InvitationsTab 17, InviteMemberDialog 7, inviteDeliveryCopy 6. |
| Hot-file ledger | `ledger gate OK — every watched file has a row.` (scan list: 753 rows · subject: 72 files · watched: 32). No 0/0/0 row is left for a 300-05 file. |
| CLAUDE.md size | `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` (104,791 chars after Task 1) |
| Deploy drift | `RESULT: PASS — the one-box deploy artifacts are in sync.` Two non-blocking WARNs: seed-like statements in migrations 215 / 216 / 218 (inherited from 300-02, not this plan), and docker compose not available locally. |
| graphify | **Not run**: the orchestrator's worktree rules forbid `graphify update .` in this worktree. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] An emptied address is stored as `""`, not NULL**
- **Found during:** Task 1
- **Issue:** The plan said "empty → stored NULL". But `save_app_settings` skips `None` values by design, so sending `None` would silently never clear the column.
- **Fix:** Store `""`. Every reader (the mailer's sender and dev-redirect reads in `email_provider.py`, and `health_probe.py`) uses `getattr(...) or fallback`, so `""` and NULL behave the same. The GET returns `""` either way.
- **Files:** `backend/app/api/settings.py`. **Commit:** 05c2679f7

**2. [Rule 3 - Blocking] Two existing backend fences needed the new field**
- **Found during:** Task 1
- **Issue:** `test_242_settings_bounds_have_schema_constraints.py` checks the bounded fields by equality, so a new bound fails it. `test_settings.py`'s `SimpleNamespace` stub, by its own rule, carries every field the response requires.
- **Fix:** Added `notification_email_delay_seconds` to `EXPECTED_BOUNDED_FIELDS` (migration 218's CHECK exists). Added the four knobs to the stub.
- **Commits:** 9e6fb8aef, 05c2679f7

**3. [Rule 1 - Test correctness] "401 without a token" is 403 on this FastAPI**
- **Found during:** Task 1
- **Issue:** FastAPI 0.115.6's `HTTPBearer()` answers a missing header with 403 "Not authenticated", not 401.
- **Fix:** The test asserts the status is 401 or 403 and equal to `GET /me/preferences`'s. The new route uses the same `get_current_user` dependency as its sibling.
- **Commit:** 9e6fb8aef

**4. [Rule 1 - Test correctness] The "no gated route" source check could not tell a route from a module path**
- **Found during:** Task 2
- **Issue:** The acceptance grep `/settings"|/admin` also matches the import `from "@/lib/api/settings"`.
- **Fix:** The leaf keeps that direct import, so the 215-commit barrel is not widened. The test now looks for a route literal (`"/settings"` and similar) and for `/admin`. The proof that counts is the recorded-URL test, which runs a full load and flip through the real `lib/api/settings.ts` with `fetch` stubbed and asserts every URL path starts with `/me/preferences`.
- **Result:** The plan's literal `grep -cE "/settings\"|/admin"` reads **1** (the import line), not 0.
- **Commit:** 4f5b681fa

**5. [Rule 3] InvitationsTab had no count-gate pin to raise**
- **Found during:** Task 3
- **Issue:** The plan said "raise InvitationsTab's pin". There was no pin.
- **Fix:** Adopted it at its measured 17 (8 shipped cases + 9 new), with a FILE-LEVEL target.
- **Commit:** 0ef2d304b

**6. [Plan scope] The resend-failure line reads the re-fetched row, not the resend result**
- **Found during:** Task 3
- **Issue:** `OrgAdminShell.handleResend` is not in `files_modified`. It already awaits `fetchInvitations()` before it returns the link.
- **Fix:** The tab reads `inv.email_delivery` from the re-fetched list: server truth, with no prop change and no optimistic state. `resendInvitation` still returns `email_delivery`, per the contract.
- **Commit:** 0ef2d304b

### Notes against acceptance greps
- `grep -ciE "resend|smtp" InviteMemberDialog.tsx` also counts the docblock and the shipped expiry line ("You can resend or revoke it…"). The dialog test's word check asserts the rendered arms never contain "Resend", "SMTP", "500", "error code" or "try again".

## TDD Gate Compliance
Each task has a `test(300-05)` RED commit before its `feat(300-05)` GREEN commit: 9e6fb8aef → 05c2679f7, a9a562bf3 → 4f5b681fa, e4483c277 → 0ef2d304b. The RED runs failed as expected: 47 backend failures; the frontend suites failed at import; Task 3 had 8 failures.

## Threat surface
Every new surface is in the plan's register:
- T-300-35: the new PUT is RLS-scoped, has no user id in its body, and has no gate dependency.
- T-300-36: a separate route, with the hash pin on the default_model PUT.
- T-300-37: the provider name only; a source grep checks that neither secret's name appears.
- T-300-38: control characters and anything other than one address are refused.
- T-300-39: the delay is bounded on the API and clamped on the client.
- T-300-40: all copy comes from one leaf, with a word check.
- T-300-41: React text only.

No new threat flags.

## Known Stubs
None.

## Left in the working tree (not committed, by instruction)
`.claude/settings.local.json` and `.omc/` were already there at spawn. The count-gate run rewrote line endings only in `WorkflowBuilderPage.seam286.pin.test.tsx.snap` and `WorkflowRunPage.seam286.pin.test.tsx.snap`; `git diff --ignore-cr-at-eol --stat` is empty for both.

## Self-Check: PASSED
- All 9 created files exist on disk: EmailSettings.tsx, EmailNotificationPreference.tsx, inviteDeliveryCopy.ts, the 2 backend suites and the 4 frontend suites.
- All 6 commits are in `git log` (9e6fb8aef, 05c2679f7, a9a562bf3, 4f5b681fa, e4483c277, 0ef2d304b).
- No commit since 250b79d78 deletes a file (`git diff --diff-filter=D` is empty).

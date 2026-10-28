---
phase: 293-start-from-outside-and-close-out
plan: 04
subsystem: api-keys UI (Settings, org admin, workflow card menu)
tags: [api-keys, settings, org-admin, audit, start-02, sketch-293-c]
base: 8a5f577d5f86c686fcabf9b26fdf1374f6238a79
requires:
  - "293-01: /api-keys + /org/api-keys routes, api_keys_contract.json, launch_fields_cases.json"
provides:
  - "lib/api/apiKeys.ts: listApiKeys, listStartableWorkflows, createApiKey, revokeApiKey, listOrgApiKeys, revokeOrgApiKey + wire types"
  - "Settings → API keys (tab 7, everyone): draft card, show-once secret with curl, key cards, call strip, activity, revoke sheet"
  - "Org admin → API keys: every member's keys with owners and revoke (orgAdminTabs.ts extracted first)"
  - "api_key.* rows worded in OrgAuditTab and the Control Room AuditTab, with an API keys filter group"
  - "workflow card ⋯ New API key… → Settings tab 7 with the workflow pre-picked"
affects: [293-03, 293-05]
tech-stack:
  added: []
  patterns:
    - "secret held only in the owning component's useState; dropped on save/unmount"
    - "sessionStorage read-once hand-off between views (no URL, no router)"
    - "?raw lockstep test fencing two copies of one vocabulary"
key-files:
  created:
    - frontend/src/lib/api/apiKeys.ts
    - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
    - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
    - frontend/src/components/settings/apiKeys/curlExamples.ts
    - frontend/src/components/settings/apiKeys/apiKeyPrepick.ts
    - frontend/src/components/settings/apiKeys/ApiKeysTab.tsx
    - frontend/src/components/settings/apiKeys/ApiKeyCard.tsx
    - frontend/src/components/settings/apiKeys/ApiKeyDraftCard.tsx
    - frontend/src/components/settings/apiKeys/ApiKeySecretOnce.tsx
    - frontend/src/components/settings/apiKeys/ApiKeyCallStrip.tsx
    - frontend/src/components/settings/apiKeys/ApiKeyActivity.tsx
    - frontend/src/components/settings/apiKeys/RevokeApiKeySheet.tsx
    - frontend/src/components/org/orgAdminTabs.ts
    - frontend/src/components/org/OrgApiKeysTab.tsx
    - docs/public/administer/settings/api-keys.md
  modified:
    - frontend/src/components/settings/settingsTabs.ts
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/components/org/OrgAdminShell.tsx
    - frontend/src/components/org/OrgAuditTab.tsx
    - frontend/src/components/admin/AuditTab.tsx
    - frontend/src/components/workflows/library/WorkflowCardMenu.tsx
    - frontend/src/components/workflows/library/WorkflowCard.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/landing/facts.ts
    - docs/public/sections.json
    - scripts/vitest-count-gate.cjs
    - scripts/check-landing-drift.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
key-decisions:
  - "293-04: the ⋯ New API key… item shows only on OWNED, published, runnable rows — the server's key form lists only the caller's own published workflows"
  - "293-04: the Settings trigger uses its siblings' isSettingsTabVisible + SETTINGS_TAB_CLASS form, so the plan's bare-literal grep reads value=\"7\">API keys</TabsTrigger> instead"
  - "293-04: the secret lives only in ApiKeysTab useState; the show-once card gets it as a prop and keeps no copy"
requirements-completed: [START-02]
duration: ~2 h
completed: 2026-10-25
---

# Phase 293 Plan 04: API keys UI Summary

**Settings → API keys built to sketch 293 C: make a key for your published workflows, copy its secret and ready `curl` once, watch each key's calls, and revoke it. Org admins get the whole organisation's keys, the audit browsers word every key call, and a workflow's ⋯ menu opens the tab with that workflow already ticked.**

BASE: `8a5f577d5f86c686fcabf9b26fdf1374f6238a79`

## What was built

- **`lib/api/apiKeys.ts`**: six calls on the `schedules.ts` shape, plus the wire types. They are declared here, not in `types/index.ts`, and the module is not on the `lib/api.ts` barrel (grep count 0). Path segments use `encodeURIComponent`. A private `readApiKeyFailure` returns the server's sentence. The created secret is returned to the caller and never cached.
- **Pure leaves.**
  - `apiKeysCopy.ts` holds every string and imports nothing.
  - `apiKeyFacts.ts` turns the wire into card facts: tag, refused chips and lines, meta, order, call words for every reason code, bars and en-GB local dates. It has no React and spells no copy.
  - `curlExamples.ts` builds the commands from the real base (a relative `API_BASE` is resolved against the origin), the bearer secret, the encoded workflow id and the declared fields in order, with JSON and shell escaping.
  - `apiKeyPrepick.ts` is a sessionStorage read-once that stores only `{workflowId, name}`.
- **Settings → API keys, tab `7`, everyone, last.** Built to sketch C:
  - States: header card with a limits line, loading, failure with Retry, empty with `KeyRound`.
  - Draft card: label, the server's published workflows (file-upload rows disabled with their reason), an Expires radiogroup with 90 days preselected, the runs-as note, Create key disabled with an `aria-describedby` reason, and Discard draft.
  - Show-once card: warning, secret, start and status `curl`, a closed sample `<details>`, and Copy states with a live region.
  - Key cards: state tag, dashed amber refused chips, meta, call strip (roving tabindex) and the activity table.
  - Revoke sheet: names the victim, focuses Keep it, and re-fetches after the server answers. It never updates optimistically.
- **Org admin → API keys.**
  - The tab registry was extracted to `orgAdminTabs.ts` in a move-only commit `7ba4c461d` (`git show --stat`: `orgAdminTabs.ts`, `OrgAdminShell.tsx`, `check-landing-drift.cjs` only). The §7b scrape was retargeted with the required comment.
  - Then one union member, one TABS entry (last, after Retention) and one render branch. The branch is keyed on the org, so a switch re-reads (the F-WR-10 reason).
  - `OrgApiKeysTab` shows every member's key with its owner, has no New key button, links run ids only on the admin's own keys, names the owner in the revoke sheet, and re-fetches and then calls `onRecorded` (band pulse).
- **Audit rows worded (D-17).** In both `OrgAuditTab.tsx` `ACTION_META` and the Control Room `AuditTab.tsx` `PLATFORM_ACTION_META`: an `"API keys"` group and five entries. This is data only (`"api_key.` count 5 in each). A `?raw` lockstep test fences the two as identical.
- **⋯ menu.** "New API key…" (`KeyRound`, `data-testid="workflow-api-key"`) sits directly under Schedules. `WorkflowCard` passes `onApiKey` through; `WorkflowsPage` threads `onOpenApiKeys`. `ChatLayout` writes the pre-pick, sets `settings_active_tab = "7"` and navigates to `settings`. `<SettingsPage onOpenRun={canvasEnabled ? openRunSurface : undefined} />`.
- **Docs/landing.** `"API keys"` was added to `SURFACE_TABS.settings` and `.orgAdmin`. The stub `docs/public/administer/settings/api-keys.md` is listed in `sections.json`. `check-landing-drift.cjs` reports zero drift and `check-docs-coverage.cjs` is OK.

## Task commits

| Step | Commit | Message |
|---|---|---|
| T1 RED | `b753bd34c` | test(293-04): failing tests for client, facts, curl text, pre-pick |
| T1 GREEN | `4418c6c7e` | feat(293-04): api key client, one string home, pure leaves |
| T2 RED | `1df5ef906` | test(293-04): failing tests for tab, card, call strip, revoke sheet |
| T2 GREEN | `73305b834` | feat(293-04): Settings → API keys tab to sketch C |
| T3 A (move-only) | `7ba4c461d` | refactor(293-04): move the org-admin tab registry to orgAdminTabs.ts |
| T3 RED | `402254be6` | test(293-04): failing tests for org tab, audit rows, ⋯ entry |
| T3 B | `bb03a9615` | feat(293-04): Org admin → API keys |
| T3 D | `1a71bb34b` | feat(293-04): word the api_key.* audit rows in both audit browsers |
| T3 C | `0373b985a` | feat(293-04): workflow card ⋯ New API key… |
| ledger | `6f13bed43` | docs(293-04): hot-file ledger rows + section |
| gate fix | `0bcd83c94` | fix(293-04): re-pin landing tab counts; review the Expires radiogroup |

## RED drives

- **T1:** `apiKeyFacts`, `curlExamples` and `apiKeyPrepick` failed to resolve their modules. Two suites passed at first run, and both are honest:
  - `launchFieldsTwin293` pins the pre-existing `soulData.launchInputFields` to the shared case file. It is a characterization pin; all 8 cases matched at once, so the two halves agreed already.
  - `apiKeysContract` fails at the tsc layer: the `@/lib/api/apiKeys` type import did not exist. Its runtime layer compares a literal sample with the fixture.
- **T2:** 4 component suites failed to resolve. `settingsTabs.test.ts` had 3 red cases and `SettingsPage.member283.test.tsx` had 4 red strip expectations.
- **T3:** 10 red. All of them were OrgApiKeysTab (module missing), the 2 shell cases, the 7 OrgAuditTab api_key cases, and the menu "owned published" case. The negative "absent" cases passed, as they should.

## Measurements

- `useState(` in `SettingsPage.tsx`: base **49**, after **49**. In `WorkflowCard.tsx`: base **0**, after **0**.
- `grep -c 'value="7">API keys</TabsTrigger>' SettingsPage.tsx` = 1. `RETIRED_SETTINGS_TABS` is untouched.
- tsc (`tsconfig.app.json`) error set equals the base set: 63 errors, all in files this plan did not touch. Re-checked after each task.
- `WorkflowCard.seam286.pin.test.tsx` and its `.snap` have empty numstat against base. Running the suites rewrote three `.snap` files with line-ending-only churn (`git diff --stat` empty). They were restored per file and never staged.

## Vitest pins (count gate)

- **Added, FILE-LEVEL in TARGETS and in BASELINE:**
  - apiKeyFacts 32, curlExamples 8, apiKeyPrepick 6, apiKeysContract 3
  - ApiKeysTab 17, ApiKeyCard 8, ApiKeyCallStrip 5, RevokeApiKeySheet 7
  - OrgApiKeysTab 7
  - OrgAuditTab 16. It was in neither knob since 166 (SEED-287) and ran nowhere the gate could see.
- **Added, BASELINE only** (under the `src/components/workflows` directory entry): launchFieldsTwin293 9, WorkflowCardMenu.apiKey293 4.
- **Raised:** OrgAdminShell 12 → 14. None lowered.
- **Count-gate run (once):** no per-file decrease, total 12060 vs pinned 11019, but **2 failing**. The filenames were captured from the gate's JSON report before anything was re-run:
  - `landing/__tests__/facts.test.ts`: the settings tab length pin was 6, now 7 (orgAdmin was 8, now 9).
  - `settings/__tests__/connectionVerbFence.test.ts`: its "no selectable ARIA role" sweep found the new Expires radiogroup.
  - Both were caused by this plan (they are absent from `git diff --numstat` only because the changed source is elsewhere), so neither is inherited. Fixed in `0bcd83c94`. The Expires control is a durations radiogroup, which UI-SPEC mandates, so it was exempted by path on the RerankEngineBlock terms.
  - Both suites are green targeted (28/28). Per the one-run rule the full gate was not re-run, so the orchestrator's wave-end gate is the confirming run.
- **Flaky under load:** `pages/WorkflowsPage.test.tsx` (1 case) and `pages/__tests__/LibraryPage.initialTab.test.tsx` (2) were red once during a broad targeted run while 293-02 ran in parallel. They were green alone (74/74), and both were green in the gate run. `LibraryPage` is untouched by this plan.

## Deviations from Plan

1. **[Rule 3] The trigger form.** The plan's literal `<TabsTrigger value="7">API keys</TabsTrigger>` would render unlike its six siblings, without `SETTINGS_TAB_CLASS` or the `isSettingsTabVisible` gate. It uses the siblings' form, so the acceptance grep is `value="7">API keys</TabsTrigger>` (count 1). The docs and landing scrapers and the settingsTabs order fence all parse it: OK.
2. **[Rule 2] `onOpenAudit`.** "All in the audit log →" must switch tabs, and the tab cannot do that without a handler.
   - SettingsPage passes `onOpenAudit={() => handleTabChange("4")}`. This is a closure over the existing handler and adds no state.
   - The shell passes `onOpenAudit={() => setActiveTab("audit")}`.
   - Both sit beyond the strict "one prop" budget, and both are recorded in the ledger section.
3. **[Rule 2] The org render branch.** It also carries `key={activeOrgId}` and `orgName`. Without the key, an org switch would show the previous org's keys over revokes sent as the new org (the Retention F-WR-10 reason).
4. **[Rule 1] ⋯ item scope.** The item shows on `published && owned && runnable` rows, stricter than the plan's `published`. 293-01's `list_startable_candidates` lists only the caller's own published workflows, so a shared row would land on a draft card that cannot tick it.
5. **[Rule 1] Docs stub audience.** It uses `user`, not the plan's `member`. `docs/public/README.md` allows `user · admin · operator · developer`, and `member` is a `[bad-frontmatter]`.
6. **[Rule 3] Test files touched beyond `files_modified`.** Each case carries a dated note.
   - `SettingsPage.member283.test.tsx`: its 4 exact-strip expectations gain "API keys".
   - `landing/__tests__/facts.test.ts` and `connectionVerbFence.test.ts`: see the gate notes above.
7. **The `ApiKeyCard` prop is `apiKey`, not `key`.** React reserves `key`.
8. **Copy that UI-SPEC did not write**, authored in house voice and marked `293-04 authored` in `apiKeysCopy.ts`:
   - chips and lines for the `cannot_run` and `file_upload` key-workflow states
   - an admin reading an owner-revoked key's receipt
   - call words for `banned`, `invalid_body` and `no_template_bound`
   - "read" for a read with no recorded status
   - the picker's loading and failure lines
9. **Detail fields are read defensively.** 293-02 audits reads with `outcome` = status. The call words read `detail.step_index/step_total/who/files/names/limit` where present, and fall back to the bare word otherwise. An unknown reason shows its raw code.
10. **No ChatLayout test.** None is listed in `files_modified`. The payload is proved through the card suite (`{id, name}` = row id), and the `ChatLayout` handler is three lines checked by grep and tsc. The G-4 drive should exercise the full hop.

## Known Stubs

None. Every surface reads the real `/api-keys`, `/api-keys/startable-workflows` and `/org/api-keys`. `statusSampleJson()` is the intentional sample under the closed "What a status read returns" toggle.

## Threat Flags

None beyond the plan's model. The UI calls only the routes 293-01 shipped. T-293-21 is mitigated: the secret lives in `ApiKeysTab` `useState`, and the suite spies on `Storage.prototype.setItem`, checks both stores and `location.href` across the flow, and asserts the secret is gone from the DOM after "I've saved the secret" and after an unmount. T-293-22 is mitigated: the pre-pick copies only two fields, and a test plants a `secret` field and asserts it is dropped.

## Self-Check: PASSED

- Every created file listed in key-files exists.
- All 11 commits listed above are present in `git log 8a5f577d5..HEAD`.

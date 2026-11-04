---
phase: 308-told-by-webhook
plan: 05
subsystem: ui
tags: [webhooks, frontend, settings, react, vitest]
requires:
  - phase: 308-04
    provides: "/webhooks member routes and /org/webhooks admin routes; {code, message} refusals; resend answers {delivery: {id, status, attempts, next_attempt_at}}"
  - phase: 308-01
    provides: "planted ledger rows + sections for every new 308-05 file"
provides:
  - "frontend/src/lib/api/webhooks.ts: member + admin client, wire types, WebhookError(code, status, message)"
  - "Settings -> Webhooks tab (id 8, everyone, last): endpoint cards that open in place, add/edit form, secret shown once, Send test, Roll, Turn off/on, Delete, per-card delivery log with Resend"
  - "DeleteWebhookSheet with an `admin` variant and injected `remove()` for 308-06's Org admin section"
  - "webhookFocus.ts one-shot {endpointId, orgId} hint for the Waiting-on-you row (308-06 writes it)"
affects: [308-06]
tech-stack:
  added: []
  patterns:
    - "load keyed on activeOrgId with an orgRef guard: an answer for the old org is dropped, and the focus hint only acts on a list read for the org it names"
    - "15 s poll started only while a shown row is in flight; interval cleared when none remain and on unmount"
    - "focusAfterDelete on the delete sheet: Radix onCloseAutoFocus is overridden only after a successful delete, so focus never drops to <body>"
key-files:
  created:
    - frontend/src/lib/api/webhooks.ts
    - frontend/src/components/settings/webhooks/webhooksCopy.ts
    - frontend/src/components/settings/webhooks/webhookFacts.ts
    - frontend/src/components/settings/webhooks/webhookSnippets.ts
    - frontend/src/components/settings/webhooks/webhookFocus.ts
    - frontend/src/components/settings/webhooks/WebhookEndpointForm.tsx
    - frontend/src/components/settings/webhooks/WebhookSecretOnce.tsx
    - frontend/src/components/settings/webhooks/RollWebhookSecretSheet.tsx
    - frontend/src/components/settings/webhooks/DeleteWebhookSheet.tsx
    - frontend/src/components/settings/webhooks/WebhookDeliveryLog.tsx
    - frontend/src/components/settings/webhooks/WebhookEndpointCard.tsx
    - frontend/src/components/settings/webhooks/WebhooksTab.tsx
    - frontend/src/components/settings/webhooks/__tests__/ (10 suites)
  modified:
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/components/settings/settingsTabs.ts
    - frontend/src/components/settings/__tests__/settingsTabs.test.ts
    - frontend/src/landing/facts.ts
    - frontend/src/landing/__tests__/facts.test.ts
    - frontend/src/pages/__tests__/SettingsPage.member283.test.tsx
    - docs/public/administer/settings/webhooks.md
    - scripts/vitest-count-gate.cjs
key-decisions:
  - "About-cell ids show the first 8 characters (the plan's behaviour line), not the UI-SPEC table's 'first 4 hex'; the copy template 'run {id}…' is unchanged"
  - "Document links in the log open through the shipped CitationNavProvider.openDocument (App-level, wraps Settings); no new prop on SettingsPage"
  - "A test answered {delivered:false, status_code:null, error:null} (nothing sent: redaction or unreadable key) reads 'Couldn't send the test.'; the log row reads 'Not sent — the redaction check failed' or 'Not sent' (secret_unreadable)"
  - "tls test errors read the 'couldn't connect' verdict; invalid_url at send reads the D-24 sentence"
  - "An org switch clears the list (not kept as last-known), the open card, the form and any secret; 'last-known list on failure' applies to same-org re-reads"
requirements-completed: [HOOK-01, HOOK-02, HOOK-04, HOOK-05]
duration: ~1h45m
completed: 2026-11-04
---

# Phase 308 Plan 05: Settings → Webhooks Summary

**A member's Settings → Webhooks tab (id "8", last): endpoint cards that open in place to their actions and their own words-only delivery log, an add/edit form whose only reachability word is the server's D-24 sentence, a signing secret shown once from props, and every write changing the screen only from the server's answer.**

## Performance

- **Started:** 2026-11-04T~09:30Z · **Completed:** 2026-11-04T~11:15Z
- **Tasks:** 3 (TDD: RED then GREEN each) · **Files:** 22 created, 8 modified

## Task Commits

1. **Task 1: client, leaves, form, secret-once, sheets** — RED `e8b72e15b`, GREEN `4cca61e74`
2. **Task 2: delivery log, endpoint card, tab** — RED `a0bbc741b`, GREEN `131f968d0`
3. **Task 3: the one Settings mount, landing fact, docs key, pins** — RED `8e429698a`, GREEN `1b6401c32`

## New suites and their pins (gate's own JSON report, first pins)

| Suite | Pin |
|---|---|
| webhooksContract.test.ts | 12 |
| webhookFacts.test.ts | 21 |
| webhookSnippets.test.ts | 3 |
| webhookFocus.test.ts | 4 |
| WebhookEndpointForm.test.tsx | 8 |
| WebhookSecretOnce.test.tsx | 6 |
| WebhookSheets.test.tsx | 9 |
| WebhookDeliveryLog.test.tsx | 12 |
| WebhookEndpointCard.test.tsx | 12 |
| WebhooksTab.test.tsx | 11 |
| settingsTabs.test.ts | 11 → 15 (raised to the measured count; never lowered) |

All ten are FILE-LEVEL TARGETS entries added in the same commit as their pins.

## Verification

- `npx vitest run src/components/settings` — 61 files, 1082 tests, all green (before Task 3's fence edits); webhooks folder 10 files / 98 tests green.
- **tsc set diff:** `npx tsc -p tsconfig.app.json --noEmit` at HEAD reports 61 errors in 27 files, **none in any file this plan created**. The only touched file with errors is `SettingsPage.tsx` (2): line 836 `web_search_enabled` and line 1183 the OpenRouter `tooltip` prop — base lines 835 and 1181, byte-identical at base `f2ec17f29`, i.e. inherited. Every other erroring file has no diff against base. **No new error.**
- `node scripts/check-docs-coverage.cjs` exit 0 (123 code keys; `settings-tab:webhooks` now covered by the stub); `node scripts/check-landing-drift.cjs` zero drift; `node scripts/check-hot-file-ledger.cjs .planning/phases/308-told-by-webhook` OK.
- Acceptance greps: `webhooksCopy.ts` 0 imports; 0 `function fillCopy` in the folder; 0 `href={` in non-test folder files; 0 `localStorage|sessionStorage` in `WebhookSecretOnce.tsx` and `lib/api/webhooks.ts`; `lib/api.ts` untouched; `SettingsPage.tsx` diff 3 added / 0 removed, `value="8"` ×2, `>Webhooks</TabsTrigger>` ×1; `facts.ts` diff 1/1; `<table` ×1, `scope="col"` ×8, `clearInterval` ×1, `dangerouslySetInnerHTML` 0 in the folder.
- **Count gate, first pass (before pins and fence fixes):** `total 14006 · failed 6`. Failing files captured from the gate's persisted JSON report before any re-run: `SettingsPage.member283.test.tsx` (4) and `landing/__tests__/facts.test.ts` (1) — both pin the Settings strip and were red BECAUSE of the new tab (fixed in `1b6401c32`, Deviation 1); `WorkflowBuilderPage.canvas.test.tsx` (1, "POSITIVE CONTROL — with the flag ON …") — **provably unmodified** (no diff against base for the suite or any workflows file) and green when re-run alone (164 tests); one red sample under a full parallel run is an observation, not proof of innocence.
- **Count gate, second pass (HEAD `1b6401c32`, `GSD_VITEST_MAX_WORKERS=2`, from the repo root):** `total 14006 · failed 0 · pinned total 12947` — **`count gate OK — 620/620 pinned files present, no per-file decrease, 0 failing.`** (`WorkflowBuilderPage.canvas.test.tsx` green in this run.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two strip fences outside the plan's file list pinned the old seven-tab strip**
- **Found during:** Task 3 (count gate first pass)
- **Issue:** `SettingsPage.member283.test.tsx` (4 cases) and `landing/__tests__/facts.test.ts` (`SURFACE_TABS.settings` length 7) assert the exact strip, so adding the D-28 tab turned them red.
- **Fix:** each expectation gains `"Webhooks"` / length 8; no case added or removed (pins unchanged).
- **Commit:** `1b6401c32`

**2. [Rule 2 - Correctness] Focus after Delete**
- **Issue:** Radix restores focus to the opener on close, but after a delete the opener left with its card, so the UI-SPEC's "focus moves to the header title" raced Radix's restore.
- **Fix:** `DeleteWebhookSheet` gained optional `focusAfterDelete`, used by `onCloseAutoFocus` only after a successful delete (Keep it / Esc keep Radix's restore). 308-06's admin table can reuse it.
- **Commit:** `131f968d0`

**3. [Rule 1 - Bug] Org-switch race in the tab**
- **Issue:** on a switch, the focus-hint effect saw the OLD org's list in the same render and consumed the hint as "deleted meanwhile".
- **Fix:** an `orgRef` + `listOrg` guard: answers for an old org are dropped, and the hint acts only on a list read for the org it names.
- **Commit:** `131f968d0`

**4. [Rule 3 - Blocking] Worktree base**
- The worktree started on master (`f20414f55`); reset to `f2ec17f29` per the spawn instruction and re-bootstrapped before any work.

### Lint note (not a gate here)
`npx eslint` on the folder reports 3 `react-hooks/set-state-in-effect` errors in `WebhooksTab.tsx` (mount focus-hint read, org-switch reset, hint consumption). The shipped analog `ApiKeyCard.tsx` carries the same rule error at base; eslint is not one of this plan's gates. Recorded rather than restructured.

## Known Stubs

None. `docs/public/administer/settings/webhooks.md` stays an intentional `status: stub` (D-49; the full page is Phase 309's) and now covers both `settings-tab:webhooks` and `router:webhooks`.

## Threat Flags

None beyond the plan's register. T-308-06 (secret only in props, no storage — grep + storage-spy tests, dropped on done / card close / org switch), T-308-22 (no `href={`, no `dangerouslySetInnerHTML`), T-308-15 (query values masked on the card and in the sheet), T-308-13 (log renders code, latency and words only; footnote), T-308-23 (address refusal is the one D-24 sentence; no code or IP rendered — form test) are all mitigated and tested.

## Handoffs to 308-06

- The full gate run rewrites `apiKeys/__tests__/__snapshots__/McpKeyFields.test.tsx.snap` with LF endings only (no content diff); it was restored and not committed.
- `writeWebhookFocus({endpointId, orgId})` from `components/settings/webhooks/webhookFocus.ts` is the Waiting row's half of the door; the tab already reads it once and handles same-org / other-org / deleted.
- `DeleteWebhookSheet` takes `admin={{ownerName, orgName}}`, `remove={() => adminDeleteWebhook(id)}` and optionally `focusAfterDelete`.
- `WEBHOOKS_COPY.admin.*` and `statusTag(e, orgName)` (owner_removed words) are ready for `OrgWebhooks.tsx`; `listOrgWebhooks` / `adminSetWebhookEnabled` / `adminDeleteWebhook` are in the client.

## Self-Check: PASSED

All 12 created source files and 10 suites exist; all 6 task commits (e8b72e15b, 4cca61e74, a0bbc741b, 131f968d0, 8e429698a, 1b6401c32) are on the branch, RED before GREEN for each task. STATE.md and ROADMAP.md untouched (orchestrator-owned).

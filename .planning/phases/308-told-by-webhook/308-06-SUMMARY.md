---
phase: 308-told-by-webhook
plan: 06
subsystem: ui
tags: [webhooks, frontend, org-admin, waiting-on-you, audit, interop, bookkeeping]
requires:
  - phase: 308-05
    provides: "lib/api/webhooks.ts admin calls, DeleteWebhookSheet admin variant, WEBHOOKS_COPY.admin, statusTag(e, org), writeWebhookFocus"
  - phase: 308-01
    provides: "GET /notifications webhook_disabled rows (run_id null, endpoint_id, reason, title, title_is_address)"
  - phase: 308-02
    provides: "webhook_signer.build_headers / new_secret / message_id"
provides:
  - "Org admin → API keys → 'Webhooks in {org}' (OrgWebhooks.tsx), one mount after OrgConnectedApps, no feature gate"
  - "Nine webhook.endpoint.* audit labels in a Webhooks group in AuditTab + OrgAuditTab, with the host shown as text"
  - "'Waiting on you' webhook_disabled row: WaitingNotice union, the openWebhooks door, the words, the list row"
  - "standardwebhooks==1.1.0 test-only dependency (requirements-dev.txt + CI) and test_308_signer_interop.py"
  - "308-VALIDATION.md: five G-4 rows (owed), the row-3 method, the D-40 decision, the OWED cloud list"
  - "Ledger re-derived for every 308 file (CLAUDE.md FIRING + docs/HOT-FILE-LEDGER.md, one commit)"
affects: [308-verification, 309]
tech-stack:
  added: ["standardwebhooks==1.1.0 (test-only, backend/requirements-dev.txt)"]
  patterns:
    - "WaitingNotice as a discriminated union so the 301 run arm narrows to run_id: string with its lines byte-unchanged"
    - "countSentence(total, { anyNonRun }) — an optional second argument keeps every one-argument caller's words"
    - "A door on the memoised attention context (openWebhooks) rather than a branch in a renderer"
key-files:
  created:
    - frontend/src/components/org/OrgWebhooks.tsx
    - frontend/src/components/org/__tests__/OrgWebhooks.test.tsx
    - frontend/src/components/admin/__tests__/AuditTab.webhookWords.test.tsx
    - frontend/src/components/org/__tests__/OrgAuditTab.webhookWords.test.tsx
    - frontend/src/components/layout/__tests__/webhookWaitingRow.test.tsx
    - backend/requirements-dev.txt
    - backend/tests/unit/test_308_signer_interop.py
    - .planning/phases/308-told-by-webhook/308-VALIDATION.md
  modified:
    - frontend/src/components/org/OrgApiKeysTab.tsx
    - frontend/src/components/org/OrgApiKeysTab.test.tsx
    - frontend/src/components/admin/AuditTab.tsx
    - frontend/src/components/org/OrgAuditTab.tsx
    - frontend/src/lib/api/notifications.ts
    - frontend/src/components/layout/attentionConditions.ts
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/WaitingOnYouList.tsx
    - frontend/src/components/layout/WaitingOnYouControl.tsx
    - frontend/src/components/layout/waitingVocabulary.ts
    - frontend/src/hooks/__tests__/useWaitingNotices.test.tsx
    - .github/workflows/backend-tests.yml
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "Admin address cell shows host + path and a muted 'query hidden' marker, with no '?' anywhere in the DOM (the plan's behaviour line wins over UI-SPEC §2b's muted '?…')"
  - "WaitingNotice became RunWaitingNotice | WebhookWaitingNotice (a union) rather than one flat interface, so the run arm keeps `openRun(notice.run_id)` byte-unchanged and type-correct"
  - "countSentence's caller is WaitingOnYouControl, not WaitingOnYouList; the neutral 'things' arm is wired there (one line)"
  - "The audit 'detail column' is a mono host span after the label (neither browser had a detail column); the webhook check reads the label map's group, so each file still holds exactly nine 'webhook.endpoint.' literals"
  - "Package-legitimacy checkpoint resolved in advance by the orchestrator; this plan's own evidence agreed with it"
requirements-completed: [HOOK-02, HOOK-04, HOOK-06]
duration: ~2h30m
completed: 2026-11-04
---

# Phase 308 Plan 06: Org admin Webhooks, the Waiting row, reference interop, and phase close

**An org admin now lists, turns off, turns back on (admin-off only) and deletes every member's webhook endpoint, and never sees a query string. An owner whose endpoint Syrel turned off sees it in "Waiting on you" with the reason and the time, and one click opens Settings → Webhooks on that endpoint. Both audit browsers name the nine webhook events in plain words. The signer is proven against the reference `standardwebhooks` 1.1.0 library.**

## Performance

- **Duration:** about 2 h 30 min
- **Completed:** 2026-11-04
- **Tasks:** 4 (3 auto + 1 checkpoint, resolved in advance by the orchestrator)
- **Commits:** 7 task commits plus this SUMMARY

## Accomplishments

- **`OrgWebhooks.tsx`** (HOOK-06, D-30, D-51, P-1). It follows the `OrgConnectedApps` shape without the `oauthAvailable` gate, so it always reads and always renders. It has a real `<table>` with `scope="col"` headers, sorts owners A–Z and keeps the server's order within each owner. The owner shows as "(you)" for the admin, or "A former member" when the name is empty. The address shows host + path in mono, plus "query hidden". The status comes from `statusTag(e, org)`, which includes "Off — the owner left {org}". The table also shows last delivered and failures in a row.
  - Turn off is direct. Turn on appears only for `disabled_reason == "admin"`. Delete goes through `DeleteWebhookSheet admin`.
  - After each server-confirmed write: a receipt, one `onRecorded()` and a re-read. Nothing is optimistic.
  - It is mounted once in `OrgApiKeysTab` (+2 −0).
- **Audit words** (D-31). There are nine `{ label, group: "Webhooks" }` entries in each browser, a new `Webhooks` filter group, and `metadata.host` shown as text (capped at 253).
- **"Waiting on you" row** (D-19, D-48, D-56):
  - The `WaitingNotice` union changed together with its one consumer.
  - `AttentionContext.openWebhooks?` is added, with one `webhook_disabled` arm. The run arm's property lines are unchanged.
  - ChatLayout gets one memoised `openWebhooksForAttention`: it writes the focus hint, sets the Settings tab to "8" and calls `onNavigate("settings")`. It never switches org (+10 −2).
  - Words: "webhook turned off", "kept failing" / "the receiver said it is gone", "turned off {N} min ago", and the neutral "{N} things are waiting on you". `waitingVocabulary` still has zero imports.
  - The row uses the `Webhook` glyph and a mono title when the title is an address.
- **Interop** (D-11, D-57). `test_308_signer_interop.py` hard-imports `standardwebhooks` and has 5 cases:
  - a plain verify that returns the parsed JSON
  - during a roll's overlap, each of the two secrets verifies on its own (a third secret is refused)
  - a body changed by one byte is refused
  - a signature from 10 minutes ago is refused, while a fresh resend with the same `webhook-id` verifies
  - the `whsec_` round trip

  A planted defect (HMAC keyed by the undecoded secret) is refused by the library, so the test does catch a real signing bug.
- **`308-VALIDATION.md`** carries:
  - the five G-4 rows, verbatim and owed
  - the "I'd recognise failure here" list
  - the method for row 3 (`WebhookDrainer.tick(now=…)` or SQL `next_attempt_at`, LOCAL only)
  - the D-40 cross-provider decision
  - the D-53 cipher probe
  - the OWED cloud list
- **Ledger** (D-37), in one commit:
  - 44 scan-list rows re-derived with the CLAUDE.md recipe.
  - 14 CLAUDE.md FIRING rows updated.
  - 6 files that now fire got FIRING rows: `backend-tests.yml`, `api/notifications.py`, `db/notifications.py`, `waitingVocabulary.ts`, `settingsTabs.ts`, `lib/api/notifications.ts`.
  - One "Phase 308 refresh" section with a subsection per file, and the old cells moved verbatim.

## Task Commits

1. **Task 1: org-admin Webhooks section + audit words**: `524d77994` (test, RED) → `6045eaaa6` (feat, GREEN)
2. **Task 2: Waiting on you webhook row**: `c329d2309` (test, RED) → `68606a39b` (feat, GREEN)
3. **Task 3: package legitimacy**: no commit. Checkpoint resolved in advance (see below).
4. **Task 4: interop + VALIDATION + pins + ledger**: `fb6985b20` (interop + requirements-dev + CI), `788b89a63` (pins, VALIDATION, fixture type), `7b4ec964d` (ledger, one commit)

## Checkpoint (Task 3): orchestrator-resolved

Resolution recorded verbatim from the orchestrator's brief: *"RESOLVED IN ADVANCE by the orchestrator under the operator's end-to-end delegation"*, evidence in `308-standardwebhooks-evidence.md`. I re-gathered the evidence myself **before installing anything**:

| Check | Observed (2026-11-04) | Evidence file says | Match |
|---|---|---|---|
| PyPI name / version | `standardwebhooks` / `1.1.0` | same | yes |
| PyPI author | `Standard Webhooks Team` | same | yes |
| `requires_dist` | `None` (zero runtime deps); `pip show` → `Requires:` empty | none | yes |
| Wheel sha256 prefix | `9a88d48a1f198be6` (`standardwebhooks-1.1.0-py3-none-any.whl`) | `9a88d48a1f198be6…` | yes |
| Upstream `libraries/python/pyproject.toml` | `name = "standardwebhooks"`, author `Standard Webhooks Team`, `dependencies = []` | same | yes |
| PyPI description | the upstream README (`from standardwebhooks.webhooks import Webhook`) | same import | yes |

Nothing contradicted the evidence file, so the response was treated as **"approved"**. ⚠ One gap, not a contradiction: the PyPI JSON for 1.1.0 carries **no `project_urls` and no home page**, so the plan's "PyPI JSON links github.com/standard-webhooks/standard-webhooks" check cannot be met from PyPI itself. The link rests on the matching name, author, zero dependencies and README, which is what the evidence file claimed. Only `standardwebhooks==1.1.0` was installed (into the shared venv through the junction, as intended by D-54).

## Gate verdicts

- **Backend unit baseline** (`node scripts/check-backend-unit-baseline.cjs`, under the local-DB lock): **`71 failed, 12795 passed, 1 skipped, 2 xfailed, 2 xpassed` · `[GATE PASSED] (failed: 71 <= 71, errors: 0)`.**
  - **Failing-set diff:** earlier waves recorded 70 ids in 23 files. This run has 71 ids in 24 files.
  - This plan's backend diff (`git diff --name-only f7408c923 HEAD -- backend`) is only `requirements-dev.txt` and the new, passing `test_308_signer_interop.py`. **Every failing file is byte-unchanged by this plan.**
  - The known order-dependent / live ids (`test_email_ingestion::test_ingest_email_populates_metadata_and_attachments` plus the `test_cross_worker_cancellation` pair, named by 306-01..05) were re-run in isolation: **29 passed**. So the one-id swing sits in the documented flaky set, not in anything 308-06 touched.
  - No stored id list from the earlier waves exists, so this diff is by file and by isolation re-run, not by an exact id set.
- **308 live suites** (`pytest tests/integration -q -rs -k 308`): **`150 passed, 1596 deselected`, 0 `SKIPPED` lines**. Seven files: db, drainer_once, emission_matrix, notice_list, notice, schema_privileges, visibility.
- **Interop**: `pytest tests/unit/test_308_signer_interop.py -q` → **5 passed**.
- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2`, repo root), first sample: **`total 14030 · failed 2 · pinned total 12971` → `COUNT GATE VIOLATED (1 reason) [failing-tests]`**.
  - There was **no per-file decrease**, and the four new pins measured exactly: OrgWebhooks 9, webhookWaitingRow 9, AuditTab.webhookWords 3, OrgAuditTab.webhookWords 3.
  - The failing tests were captured from the gate's JSON report before any re-run:
    - `WorkflowBuilderPage.canvas.test.tsx`: "POSITIVE CONTROL — with the flag ON …" (`expected 0 to be greater than 0`)
    - `routing/navigationKeepsStreams.test.tsx`: "D-02 — a live stream survives …" (`STACK_TRACE_ERROR`)
  - Both are **provably unmodified** by this plan (`git diff --numstat f7408c923` is empty for both).
  - Both pass in isolation (2 files, 169 passed). 308-05 recorded the canvas suite as green-in-one-run / flaky.
  - "Provably unmodified" is an observation, not a claim that these suites are fine: one green isolated sample is not proof.
  - Second sample: see the addendum below.
- **Targeted suites:**
  - `src/components/org` + `src/components/admin`: 52 files / 536 tests passed.
  - `src/components/layout`: 31 files / 408 tests passed. Every pre-existing layout suite passed unedited.
- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`): 61 errors, none in a file or line this plan changed. The one error this plan introduced (TS2322 in `useWaitingNotices.test.tsx`, `Partial<union>`) was fixed by typing the fixture `Partial<RunWaitingNotice>`. I checked the SettingsPage errors by blame: they come from 48-03, 054-04 and 123-06. **Set diff vs phase base: no 308-06 error.**
- `node scripts/check-hot-file-ledger.cjs .planning/phases/308-told-by-webhook` → **`ledger gate OK — every watched file has a row.`** (858 rows · 91 subject · 39 watched)
- `node scripts/check-claude-md-size.cjs` → **`claude-md size gate OK`** (CLAUDE.md 110.8k chars). The first patch run caught a `[malformed-row]` (a literal `|` inside a cell); I fixed it before the commit.
- `node scripts/check-docs-coverage.cjs` → **`docs coverage OK`** (exit 0)
- `node scripts/check-landing-drift.cjs` → **`Landing facts match application code (zero drift)`** (exit 0)
- `bash scripts/check-deploy-drift.sh` → **`RESULT: PASS — the one-box deploy artifacts are in sync.`** Its advisory names `225_webhooks.sql` for seed-like INSERTs. These are the two trigger bodies (lines 250, 286), not seeds.
- `node scripts/check-seeds-register.cjs --phase 308` → **`seeds register gate OK — 404/404 parsed`** (exit 0). Its trigger-fires lines name SEED-370 and SEED-374 (SettingsPage.tsx) and SEED-397 (rate_limit.py). These are informational; 308's routing happened at discuss.
- `git diff --stat d874e7c81 HEAD -- backend/app/services/ingestion_queue_service.py` → **empty** (D-37).
- **Local-DB lock:** taken as `308-06 4272` and released. The file no longer exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `OrgApiKeysTab.test.tsx` stubs the new section**
- **Found during:** Task 1 GREEN
- **Issue:** with the new mount, three 293-04 cases found two `status` roles, two `alert` roles and a Retry button: the unmocked `/org/webhooks` read failed in jsdom.
- **Fix:** one `vi.mock("./OrgWebhooks", () => ({ OrgWebhooks: () => null }))` with a comment. The section has its own suite. No assertion changed.
- **Commit:** `6045eaaa6`

**2. [Rule 3 - Blocking] `countSentence`'s caller is `WaitingOnYouControl.tsx`, which the plan did not name**
- **Found during:** Task 2
- **Issue:** the plan says to pass `anyNonRun` from `WaitingOnYouList`, but the list never calls `countSentence`. The control is its only caller.
- **Fix:** one line in `WaitingOnYouControl.tsx`: `{ anyNonRun: conditions.some((c) => c.kind === "webhook_disabled") }`. Its ledger row was re-derived in the bookkeeping commit. It is not in any PLAN `files_modified`, so the ledger gate does not watch it.
- **Commit:** `68606a39b`

**3. [Rule 1 - Bug] The `WaitingNotice` union broke a 301 test fixture's type**
- **Found during:** Task 4 (tsc)
- **Issue:** `notice(over: Partial<WaitingNotice>)` became `Partial<union>`, which caused TS2322.
- **Fix:** typed `Partial<RunWaitingNotice>`, one import token. Types only; the runtime is unchanged.
- **Commit:** `788b89a63`

**4. [Spec reconciliation] Admin address marker**
- UI-SPEC §2b draws a muted `?…`. The plan's behaviour line and T-308-15 require that no `?` appears in the DOM. The cell renders a visible muted "query hidden" (the `admin.queryHidden` copy) with no `?`.

## ESLint (not a plan gate)

`OrgWebhooks.tsx` and the other files this plan touched lint clean, except one pre-existing `react-hooks/immutability` error in `ChatLayout.tsx:241` (`setMobileFolderId`, not a line this plan changed). 308-05's three `set-state-in-effect` errors in `WebhooksTab.tsx` are left as they were (the 308-05 handoff).

## Threat Flags

None. No new endpoint, auth path or schema. The admin section reads the 308-04 wire, which carries host and path only.

## Known Stubs

None. Every new surface reads real data. The "webhooks kill switch" in the OrgWebhooks docblock is a deferred capability that P-1 names, not a stub.

## OWED — never done by this plan

- **G-4 rows 1-5** (`308-VALIDATION.md`), driven by Claude through Chrome MCP at verification, **row 1 first**.
- **Cloud migration 225** (D-33): after 220 → 221 → 222 → 223 → 224, **before** the 308 backend deploys, each paste with its own operator approval.
- **`get_advisors(security)`** on cloud right after 225.
- `graphify update .` was not run in this worktree: the graph is regenerated on the merged tree, so it is not churned per worktree.
- Public docs that still say webhooks don't exist: routed to Phase 309 (`deferred-items.md` #1; not touched here).

## Self-Check: PASSED

All created files exist on disk, and the seven task commits (`524d77994`, `6045eaaa6`, `c329d2309`, `68606a39b`, `fb6985b20`, `788b89a63`, `7b4ec964d`) are in `git log`. STATE.md and ROADMAP.md were not touched.

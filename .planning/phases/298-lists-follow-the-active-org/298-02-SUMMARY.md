---
phase: 298-lists-follow-the-active-org
plan: 02
subsystem: org-scope / workflows refusal
tags: [backend, workflows, org-scope, refusal, security, frontend]
requires:
  - 298-01 (org_lists, the active-org header on uploads, the two-org live fixture shape)
provides:
  - backend/app/services/foreign_folder_refusal.py (FOLDER_IN_OTHER_ORG, bound_folder_ids, definition_org_id, foreign_binding_refusal, raise_if_foreign, changed_binding_refusal, raise_if_foreign_change)
  - frontend WorkflowFolderRefusedError + listDraftWorkflows(signal?, { allOrgs })
  - StartFailure kind "folder"
affects:
  - POST /workflows, PATCH /workflows/{id} (coded 422 on a new or changed foreign binding)
  - send_message kickoff preflight (coded 422), scheduled runs (recorded outcome), POST /inbound/workflows/{id}/runs (plain-string 422)
  - Builder save line, Run modal, chat launch form, chat in-thread picker (server sentence shown verbatim)
  - API-key activity row (words for the new foreign_folder reason)
tech-stack:
  added: []
  patterns:
    - "one refusal helper, five callers; the definition org always read from the row"
    - "publish-parity confirm through harness.scope.folder_scope_violations when a client is held"
    - "client branches on detail.code, never on prose (the stale_token precedent)"
key-files:
  created:
    - backend/app/services/foreign_folder_refusal.py
    - backend/tests/unit/test_298_foreign_binding.py
    - backend/tests/unit/test_298_org_matrix.py
    - backend/tests/integration/test_298_org_matrix_live.py
    - frontend/src/lib/api/__tests__/threads.folderRefusal.test.ts
  modified:
    - backend/app/api/workflows.py
    - backend/app/services/workflow_kickoff.py
    - backend/app/services/scheduler_service.py
    - backend/app/api/inbound.py
    - frontend/src/lib/api/workflows.ts
    - frontend/src/lib/api/threads.ts
    - frontend/src/hooks/useDraftPersistence.ts
    - frontend/src/components/chat/useStartWorkflowInThread.ts
    - frontend/src/components/chat/ThreadWorkflowPicker.tsx
    - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
    - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
    - frontend/src/lib/api.workflows.test.ts
    - frontend/src/hooks/useDraftPersistence.test.tsx
    - frontend/src/components/chat/__tests__/useStartWorkflowInThread.test.tsx
    - frontend/src/components/chat/__tests__/ThreadWorkflowPicker.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "The scheduler, API-key and both save doors hold no supabase client, so they pass None and rest on the pool read alone; only the attended preflight runs the publish-parity confirm (W5, see the door table)"
  - "One pinned edge where a no-client door is stricter than publish: a folder stamped in another org under an org-shared ancestor in the definition's org (legacy data only)"
  - "The definition org is read lazily (definition_id=) at the scheduler and API-key doors, only when the definition binds a folder, so unbound launches issue no new query"
  - "WorkflowFolderRefusedError is not added to the lib/api.ts barrel: refusalOf matches by name and the tests import the domain module (keeps a FIRING barrel untouched)"
  - "No Retry for a folder refusal in the in-thread picker: published definitions are immutable, so a re-send is refused again"
requirements-completed: [ORG-05]
duration: ~2 h 20 min
completed: 2026-10-28
---

# Phase 298 Plan 02: A workflow cannot point at another org's folder Summary

A workflow that binds a folder outside its own organization is now refused, in words, at every
door. Saving is refused only when the request adds or changes such a binding. Launching is
refused at the attended preflight, the scheduler and the API-key start. All of them call one new
helper (`foreign_folder_refusal.py`). In-org workflows behave exactly as before, with or without
an org header; the D-25 matrix test shows this door by door. The Builder save line, the Run modal,
the chat launch form and the in-thread picker now show the server's sentence as it was sent.

## Performance

- Started: 2026-10-28T~07:00Z · Completed: 2026-10-28T~09:20Z (~2 h 20 min, including one backend
  baseline of 8.5 min and two vitest gate runs of about 10 min each)
- Tasks: 3/3 (TDD: a RED commit before each GREEN)
- Files: 5 created, 18 modified

## Task Commits

| Task | Gate | Commit | Message |
|---|---|---|---|
| 1 | RED | `7910aa115` | test(298-02): foreign-folder refusal contract (save) |
| 1 | GREEN | `9e5416d7a` | feat(298-02): refuse saving a workflow bound to another org's folder (D-13, D-14, D-34, D-36) |
| 2 | RED | `d5e930a45` | test(298-02): launch-door refusals + D-25 before/after matrix |
| 2 | GREEN | `6ff68241a` | feat(298-02): refuse launching a workflow bound to another org's folder at every door (D-13, D-30, D-25) |
| 3 | RED | `63fe2b53a` | test(298-02): refusal surfacing + header-less draft reload |
| 3 | GREEN | `e129f4bec` | feat(298-02): show the folder refusal verbatim; header-less draft reload (D-12, D-36) |

## What was built

- **`foreign_folder_refusal.py`** (293 lines)
  - `bound_folder_ids` returns the D-34 set in definition order: project, phase scopes, kb_auto inputs, output folder. It accepts a model, a dict or a JSON string.
  - `foreign_binding_refusal` makes one pool read for the candidate folders and one for org names. A missing folder is not an offender. A row with no org, or a system-global row, is never checked.
  - The sentences match UI-SPEC §3 exactly: the visible-folder sentence, the "can't open" sentence (the folder's org is never named), and the "N other folders … too" tail.
  - `raise_if_foreign` and `raise_if_foreign_change` raise `422 detail={code: "folder_in_other_org", message}`.
  - It never imports or edits `publish_service.py`. The definition-org SQL was copied, plus `AND NOT is_system_global`.
- **Save routes** (`workflows.py`, one awaited call each)
  - `create_draft` checks against the active org it stamps. A request with no org header skips the check.
  - `update_draft` checks only the ids that are new or changed compared with the stored row. A stored foreign binding that is left unchanged saves through untouched. A row the caller doesn't own falls through to the existing 404, byte-identical.
- **Launch doors**
  - Preflight: `org_id` was added to the select string, and one `raise_if_foreign` call now runs after the unrestricted subset 400, which still fires first.
  - Scheduler: a recorded schedule outcome, then `ScheduledLaunchRefused`.
  - Inbound: `_refused(reason="foreign_folder")` returns a plain-string 422 and writes the existing `api_key.refused` audit row.
  - Neither unattended door calls `get_active_org_id` (grep count 0 in both files).
- **Frontend**
  - `WorkflowFolderRefusedError` is thrown in both 422 arms when the body carries the code. Every other 422 behaves as before; the `HOLD_UNREADABLE` branch is unchanged.
  - `postMessage` picks up `detail.message` and `code` when `detail` is an object.
  - `refusalOf` maps the new error to `{kind: "error", sentence}`. It isn't terminal, so the next in-org save clears it (UI-D13).
  - `reload()` uses `listDraftWorkflows(undefined, { allOrgs: true })` (D-12).
  - The in-thread starter gets `kind: "folder"`. That is the recorded exception to "never server text", and the docblock says why. The picker hides Retry for it.

## Which doors pass a supabase client (plan-check W5)

| Door | Client passed? | Guarantee the door carries |
|---|---|---|
| Attended preflight (`workflow_kickoff.py`), also used by chat-started runs | **Yes**, send_message's user-JWT client | **Exact publish parity** for the project/phase arms. An offender there stands only if `folder_scope_violations(..., restrict_org_ids={row org})` also reports one. kb_auto/output arms use the pool read. Visibility for the wording is the unrestricted visible set. |
| Scheduler (`scheduler_service.py`) | **No** (none exists on this path) | Pool read alone. It refuses when any bound folder's own `org_id` differs from the definition's. Visibility for the wording = the owner owns the folder. |
| API key (`inbound.py`) | **No** (none exists on this path) | Same as the scheduler. |
| Save, create + update (`workflows.py`) | **No** (neither route takes a supabase dependency, and adding one would change the route signature) | Same as the scheduler. |

**Proof (the matrix, `test_298_org_matrix.py`):**
- `test_what_publish_accepts_every_door_admits`: a definition that publish 2.6 accepts is admitted at all four doors.
- `test_what_publish_refuses_for_org_reasons_every_door_refuses`: the reverse holds.

**The one shape where a no-client door is stricter than publish is pinned rather than hidden**
(`test_the_one_shape_where_a_door_without_a_client_is_stricter_than_publish`):
- The shape: a folder stamped in org B that sits under an org-shared ancestor in org A.
- Publish 2.6 accepts it and the attended door admits it. The scheduler, the API-key door and the save routes refuse it.
- Only legacy data can produce this shape. Since 296-01 a child folder is created in its parent's org, and the 298 audit measured 0 cross-org bindings.
- I decided not to build a service-role client at those doors. `get_service_role_supabase` is reserved for the four async writers.

## Verification (gate lines verbatim)

- **Backend baseline** (committed backend tree after Task 2 GREEN): `[GATE PASSED] Backend unit baseline satisfied (failed: 69 <= 71, errors: 0).` Summary: `69 failed, 10265 passed, 1 skipped, 2 xfailed, 2 xpassed, 51 warnings in 506.30s (0:08:26)`. The failure count is unchanged from 298-01 (69), and 67 more tests pass.
- **Vitest count gate, first run:** `RESULT: COUNT GATE VIOLATED (1 reason(s))` / `total 12589  ·  failed 1  ·  pinned total 11435`.
  - The failing name was read from the gate's own JSON report (`vitest-count-gate-120632-1793170668754.json`) before anything was re-run: `apiKeyFacts.test.ts :: every refusal reason the backend audits has words, never the raw code`, which failed with `foreign_folder: expected '✕ refused: foreign_folder' not to be …`.
  - **Caused by this plan.** The test reads every `reason="…"` literal in `inbound.py`, and the new reason had no words yet. Fixed with words for it (Deviation 2).
- **Vitest count gate, final:** `count gate OK — 535/535 pinned files present, no per-file decrease, 0 failing.` / `total 12589  ·  failed 0  ·  pinned total 11435`.
  - Per-file: `useDraftPersistence.test.tsx 63 63 0` · `api.workflows.test.ts 30 30 0` · `useStartWorkflowInThread.test.tsx 24 24 0` · `ThreadWorkflowPicker.test.tsx 17 17 0` · `threads.folderRefusal.test.ts 3 3 0` · `apiKeyFacts.test.ts 32 35 +3`.
- **tsc set-diff** (`npx tsc -p tsconfig.app.json --noEmit`). The base was measured by swapping in the base copies of the 9 touched frontend files and removing the new test: base 53 unique errors, now 53. **New: 0, gone: 0.** It was re-checked after the api-key fix and is still identical.
- **Ledger gate:** `node scripts/check-hot-file-ledger.cjs --files <13 non-test files>` → `ledger gate OK — every watched file has a row.`
- **CLAUDE.md size gate:** `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` (final: CLAUDE.md `102374 chars   68.2% of limit  headroom   47626  [OK]`).
- **Targeted backend:**
  - `test_298_foreign_binding.py` 41 passed. `test_298_org_matrix.py` 26 passed.
  - Plan verify set: 136 passed (with `test_296_kickoff_and_keys`, `test_296_schedule_trigger_words`, `test_182_publish_org_scope`, `test_165_folder_utils_org_scope`).
  - Every create/update-draft suite: 167 passed, 1 skipped.
  - Every suite importing workflow_kickoff, scheduler_service or inbound: 521 passed.
- **Live row:** `tests/integration/test_298_org_matrix_live.py` → **3 passed, 0 skipped** under `-rs`, run under the local-DB lock. The lock file was removed afterwards.
- **Inherited reds:** `tests/test_dual_mode_wiring.py` (outside `tests/unit`) shows `21 failed, 32 passed` both at base `3e8b873f4` (the 4 touched backend files swapped back) and now. It was not caused by this plan.
- `git diff 3e8b873f4 -- backend/app/services/harness/publish_service.py backend/app/utils/folder_utils.py` is empty.
- Acceptance greps:
  - `get_active_org_id` appears 0 times in both unattended doors. `reason="foreign_folder"` appears exactly once.
  - The `org_id` select token is present. `^+@router` in the workflows.py diff: 0.
  - `"folder_in_other_org"` appears 2 or more times in workflows.ts. `allOrgs: true` appears once in useDraftPersistence.ts.

## Deviations from Plan

**1. [Rule 1 - Bug avoided] The scheduler and API-key doors read the definition org lazily (`definition_id=`), not eagerly via `definition_org=await definition_org_id(...)`.**
- An eager read runs on every launch. Existing suites drive `launch_scheduled_run(pool=MagicMock())`, so it would have broken them (`await` on a MagicMock), and it would cost an unbound launch one query.
- The helper now reads the row's org only when the definition binds a folder. The result is the same; it is just cheaper. (`6ff68241a`)

**2. [Rule 3 - Blocking, found by the gate] Words for the new `foreign_folder` API-key refusal reason.**
- `apiKeyFacts.test.ts` derives every audited reason from `inbound.py` and failed while the raw code rendered.
- Added one case in `apiKeyFacts.ts` and one string in `apiKeysCopy.ts`. Both files crossed into G-5, and their ledger rows were added in the same commit. (`e129f4bec`)

**3. [Plan-sanctioned extra file] `ThreadWorkflowPicker.tsx` gained one case in its Retry condition, and its test gained one case.**
- The plan said: "read only unless it switches on kind; if it does, this is one added case". It does switch on kind.
- Its pin was raised from 9 to 17, the printed actual. The file also had a scan-list row but no ledger section; that section was added. (`63fe2b53a`, `e129f4bec`)

**4. [Rule 2] `api.workflows.test.ts` was in neither count-gate knob, so it was ADOPTED at 30 (24 existing + 6 new) as a FILE-LEVEL target.** Before this it ran in no gate. (`63fe2b53a`)

**5. `WorkflowFolderRefusedError` was not added to the `lib/api.ts` barrel.** `refusalOf` classifies by name, and the tests import `@/lib/api/workflows`, so the barrel (a FIRING file) stays untouched. The barrel fence covers only connectors and documents.

**6. Ledger: five files crossed into G-5 with this plan.** They are `inbound.py`, `useStartWorkflowInThread.ts`, `ThreadWorkflowPicker.tsx`, `apiKeyFacts.ts` and `apiKeysCopy.ts`. Each now has a CLAUDE.md FIRING row (verdict 80 characters or fewer) and a section in `docs/HOT-FILE-LEDGER.md`. The cells they replaced were moved into those sections word for word.

**Fence amendments:** none. No existing assertion was changed, so the D-298-04 and later ids were not used. Only count-gate pins were raised, and none was lowered.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register.
- T-298-08..14 are mitigated as planned and tested per door.
- T-298-12 (no `restrict_org_ids=set()` from any 298 path) is asserted by the matrix's recording seam over the real `fetch_visible_folders`.
- T-298-11 (no 400 on header-less unattended doors): `get_active_org_id` is patched to raise in the matrix and is never reached.

## Notes for later plans

- **298-04 (D-15 picker marker):** the Builder will now refuse saving a new or changed foreign binding. The amber "lives in <org>" marker is what tells the author before they save.
- `useDraftPersistence.reload` now reads with `allOrgs`. This settles RESEARCH B7 for the reload, so 298-04 does not need to re-decide it.
- `scheduler_service.py`'s `org_id = schedule.get("org_id") or row.get("org_id")` is untouched. `row` has no `org_id`, so this line is dead code; it is out of scope and recorded here.
- STATE.md and ROADMAP.md are untouched (the orchestrator owns them).

## Self-Check: PASSED

- The 5 created files exist on disk.
- Task commits `7910aa115`, `9e5416d7a`, `d5e930a45`, `6ff68241a`, `63fe2b53a` and `e129f4bec` are in `git log`.
- The local-DB lock file is absent.

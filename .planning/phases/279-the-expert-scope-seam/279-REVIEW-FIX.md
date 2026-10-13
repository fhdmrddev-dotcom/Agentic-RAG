---
phase: 279-the-expert-scope-seam
fixed_at: 2026-10-13T20:33:18Z
review_path: .planning/phases/279-the-expert-scope-seam/279-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
base: 331312ce4
independent_review: self
---

# Phase 279: Code Review Fix Report

**Fixed at:** 2026-10-13T20:33:18Z (2026-10-14 local)
**Source review:** `.planning/phases/279-the-expert-scope-seam/279-REVIEW.md`
**Iteration:** 1
**Base:** `331312ce4` (asserted before the first edit). All work was done in the main working tree on `develop`, with no worktree, as the caller directed.

**Summary:**
- Findings in scope: 6 (WR-01..WR-06). The 6 INFO items are recorded below and were not fixed.
- Fixed: 6, one atomic commit each, committed by explicit path and checked with `git show --stat HEAD`.
- Skipped: 0.
- Every new test was run RED against the base source and then GREEN. Method: swap in the `HEAD~` version of the source file, run the tests, then restore the file.
- No Supabase MCP call was made. Nothing was pushed.

## Fixed Issues

### WR-01: The folder-PATCH arm and `GET /scope-effect` stated a thread's Expert in the ACTIVE org

**Commit:** `c24ef68e6`
**Files modified:**
- `backend/app/api/threads.py`
- `backend/app/models/thread.py` (docstring only)
- `backend/tests/unit/test_268_scope_patch.py`
- `docs/public/api/openapi.snapshot.json` (regenerated)

**Applied fix:**
- `_describe_thread_scope_change` takes `thread_org_id`. It resolves the Expert in the thread's org, with the caller's role in that org (`_caller_role_in_org`, the IN-05 pattern).
- Both callers pass `row["org_id"]`: `_apply_folder_change`, which persists the `scope_changed` row, and `get_scope_effect`.
- A plain thread makes no membership read, because org and roles are unused without an Expert.

**Which option, and why:** I chose the `_caller_role_in_org` statement over a `_require_thread_org` call.
- `GET /scope-effect` is read-only, and the composer chip and the picker ledger read it at rest. A 409 there would blank them.
- A folder change binds no Expert, and its folder is already authorised in the thread's org.
- The change is one helper body plus one keyword argument at each of the two call sites. No new branch: the role read is a single conditional expression.
- Pitfall 9 ("the statement and the run cannot disagree") still holds for every run that can happen. An Expert-thread run is refused unless the active org is the thread's org: the send door does this today, and after WR-02 so does the scoping re-read.

**Corrected beside the originals:**
- The `_describe_thread_scope_change` docstring.
- `test_the_route_resolves_with_the_producers_inputs_active_org_and_caller_role`. It pinned the defect (`kw["org_id"] == ORG_ID`) and now asserts `THREAD_ORG`.
- The test module's docstring bullet.
- The `ScopeEffect` model docstring. That edit staled `test_276_openapi_snapshot_fresh`, so the snapshot was regenerated in the same commit. The diff is one description string; `openapi.public.json` is unchanged because this route is not public.

**Tests** (`backend/tests/unit/test_268_scope_patch.py`):
- `test_WR01_scope_effect_states_an_expert_thread_in_the_threads_org_not_the_active_one`: cross-org. The resolver names the Expert only in the thread's org. Asserts `held is True`, the Expert is "HR Advisor", and exactly one membership read, made against `THREAD_ORG`.
- `test_WR01_a_folder_patch_on_an_expert_thread_in_another_active_org_persists_the_threads_statement`: cross-org. The persisted event names HR Advisor with `held` true, in `THREAD_ORG`.
- `test_WR01_a_plain_thread_makes_no_membership_read`.

**How verified:**
- 3 tests RED at base (the two cross-org cases and the corrected pin).
- Green after the fix: `test_268_scope_patch` / `test_268_scope_effect` / `test_267_expert_changed_event` / `test_279_org_helper` 82 passed; `test_276_openapi_snapshot_fresh` + `test_276_api_docs_gate` 65 passed.

### WR-02: TOCTOU on send. `_resolve_thread_scoping` resolved under the caller's org without re-checking the thread's org

**Commit:** `e4f6ea7b4`
**Files modified:**
- `backend/app/services/run_producer.py`
- `backend/tests/unit/test_279_org_helper.py`
- `backend/tests/unit/test_267_cr03_server_side_expert_clear.py`

**Applied fix:**
- Right after the `active_expert_id` check, `_resolve_thread_scoping` raises a new `ExpertThreadOrgMismatch(ValueError)` when the thread's org differs from the caller's.
- The message is the send door's sentence: "Switch to this chat's organization to keep chatting with its Expert."
- The raise comes before any role read, resolve or clear, so the Expert is never silently cleared.
- Like every scoping error, it is carried to the producer and re-raised there, so `runs.error` reads `failed: ExpertThreadOrgMismatch: Switch to this chat's organization…`.
- In this race the refused message stays unanswered. The operator accepted this, and it is consistent with D-19: the user message INSERT precedes the scoping resolve by design (`test_268_send_path_stamp`).

**⚠ Deviation, recorded so it is never silent:** the compare runs only when the re-read thread has an `org_id`.
- **What I measured:** a strictly literal compare (`str(thread_org or "")`) broke 35 existing unit tests across 10 files. Their mock thread rows simply omit `org_id`.
- **Why the race cannot reach a null-org thread:**
  - A bind on such a thread is refused at the PATCH door (`_require_thread_org` against a null org gives 409).
  - `create_thread` stamps the org.
  - A legacy null-org Expert thread is refused by the send door's strict helper.
  - `test_WR02_the_send_door_still_refuses_a_null_org_expert_thread` pins that last point.
- **One residual path:** a continuation (`/runs/{id}/continue`) on a legacy null-org Expert thread still resolves in the run's org, as it did before 279.
- **If the operator wants it strict:** add `org_id` to roughly 12 mock helpers (mock completeness only).

**Corrected beside the originals:** the three `test_267_cr03` (a) cases (`test_a_the_clear_writes_the_expert_changed_removal_row_in_the_threads_org`, `test_a_the_clear_is_conditional_on_the_expert_it_read`, `test_a_a_failed_statement_never_masks_the_refusal`). They drove the stale clear with the active org ≠ the thread org, which is exactly the path WR-02 now refuses first. They now drive it in the thread's own org, and the original line is kept as a comment.

**Tests** (`backend/tests/unit/test_279_org_helper.py`):
- `test_WR02_an_expert_bound_in_the_race_window_is_refused_not_resolved_or_cleared`: exact sentence; one `aexec` (no clear UPDATE); the resolver and the role read never awaited.
- `test_WR02_no_caller_org_on_an_expert_thread_fails_closed`.
- `test_WR02_a_plain_thread_in_another_org_is_not_refused_here`.
- `test_WR02_the_send_door_still_refuses_a_null_org_expert_thread`.

**How verified:** 2 tests RED at base. 17 scoping / send / org suites green: 199 passed.

### WR-03: D-07 was implemented as a boolean suppression

**Commit:** `a2a0b55d5`
**Files modified:**
- `backend/app/services/expert_scope_events.py`
- `backend/tests/unit/test_279_scope_fixes.py`
- `backend/tests/fixtures/phase279/expert_changed_restricted_overlap_to_restricted.json` (new)

**Applied fix:**
- `build_expert_changed_event` keeps the exclusion when the previous side read the thread folder or everything, as before. It now also keeps it when `before.scope.effective_folder_ids` overlaps `after.scope.excluded_folder_ids`.
- The change is pure set arithmetic on the two statements, with no I/O.
- `expert_scope.py` is untouched and stays pure. `_dropped_line` is untouched: it already computes Dropped against the previous side's folders, and 268's `stops` shares it.
- A restricted Expert that was not readable has an empty scope, so it cannot overlap.

**Fixtures:**
- 0 existing 267/268 fixture lines changed (`git status` over `backend/tests/fixtures` showed only the new file).
- The 279 `restricted_to_restricted` fixture (Legal → HR, no overlap) is unchanged and still reads `excluded: null`.
- The new fixture was generated by the real builder.

**Tests** (`backend/tests/unit/test_279_scope_fixes.py`), using the reviewer's probe: a restricted "ACME Specialist" bound to Client ACME, swapped to HR Advisor on an ACME thread.
- `test_WR03_restricted_to_restricted_keeps_the_exclusion_when_the_previous_expert_read_it` asserts:
  - `excluded.count == 4`;
  - the four names;
  - the sentence "ACME Specialist → HR Advisor. Now: HR Policies. Dropped: Client ACME."
- `test_WR03_the_overlap_fixture_is_the_real_builders_output`.
- `test_WR03_no_overlap_still_states_no_exclusion`.

**How verified:** 2 tests RED at base. After the fix the 279/267/268 scope suites and `test_279_pure_move` all passed (155 passed).

### WR-04: The WR-05 handoff fence could be inverted through the source title

**Commit:** `9f9d65a7d`
**Files modified:**
- `backend/app/services/thread_handoff.py`
- `backend/tests/unit/test_267_handoff.py`

**Applied fix:**
- `handoff_content` builds `safe_title = " ".join(source_title.split()).replace("```", "′′′")`. This collapses all whitespace, including CR, LF, CRLF and tabs, to single spaces, and neutralises a triple backtick the same way the items already are.
- A fence can open only at the start of a line, so a one-line title cannot open one.
- Single and double backtick runs cannot close a triple-backtick fence, so they are left alone.
- The docstring's false claim ("the title stays outside it") is corrected beside the original.

**Tests** (`backend/tests/unit/test_267_handoff.py`):
- `test_WR04_a_hostile_title_keeps_every_item_inside_the_fence`, over 5 titles: `"Plan\n```"`, `"Plan\r\n```"`, `"Plan\r```"`, a multi-line injection, and a padded title with backticks. Each must give exactly two fence lines (at line 1 and the last line) under both `split("\n")` and `splitlines()`, every item inside the fence, and no `\r`.
- `test_WR04_an_ordinary_title_is_unchanged`.

**How verified:** all 5 hostile-title cases RED at base. `test_267_handoff` 34 passed.

### WR-05: Managers saw disabled Experts as ordinary cards with a Start Chat that always failed

**Commit:** `415a4c5b7`
**Files modified:**
- `frontend/src/components/experts/catalog/expertCatalog.ts`
- `frontend/src/components/experts/catalog/ExpertCard.tsx` (docblock only)
- `frontend/src/components/experts/catalog/__tests__/expertCatalog.test.ts`
- `frontend/src/components/experts/catalog/__tests__/ExpertCatalogPage.test.tsx`

**Applied fix:**
- The copy lives in the existing copy module, `expertCatalog.ts`: a new `DISABLED_COPY` with `tag: "Disabled"` and `line: "Disabled for this organization — enable it in Organization admin → Experts to chat with it."`. The path wording matches the real nav label ("Organization admin") and the `OrgExpertsTab` Enable control.
- `installView` returns its existing `status` arm for `is_enabled === false`, before any install or connection fact. A row without the key reads as enabled, the same default the server uses.
- `installCardLine` returns the "Disabled" tag for that arm.

**Result:**
- The card footer renders the "Disabled" pill, with the full line as its title, and no Start Chat.
- `ExpertDetailModal` already renders a `status` view as its footer line, so it shows the sentence and no "Start Scoped Chat with Expert". No modal code change was needed.
- `ExpertCard`'s D-262-02 docblock is corrected beside its original, so "never a dead one" stays true.

**Tests:**
- `expertCatalog.test.ts` › "279-REVIEW WR-05 — a disabled Expert is a status, not a Start Chat" (3 cases): pins the words; `is_enabled:false` wins over ready / not_installed; an enabled row and a row without the key are unchanged.
- `ExpertCatalogPage.test.tsx` › "ExpertCatalogPage — a disabled Expert (279-REVIEW WR-05)" (2 cases). These assert the rendered words:
  - the card's text "Disabled", with the exact title;
  - no "Start Chat" in the card text;
  - Details is the only button;
  - the modal's exact sentence;
  - no "Start Scoped Chat with Expert".

**How verified:**
- 4 tests RED at base. `vitest run src/components/experts/catalog`: 119 passed.
- Count-gate deltas: `expertCatalog.test.ts` 53 → 60, `ExpertCatalogPage.test.tsx` 19 → 24.

### WR-06: Two 409 tests named for the workflow-lock arm exercised the generic arm

**Commit:** `16e355582`
**Files modified:**
- `frontend/src/__tests__/providers/StreamsProvider.stopping.test.ts`
- `frontend/src/__tests__/providers/streamsProvider_state01b_403.test.tsx`

**Applied fix:**
- Both tests now reject with the server's real literal: `"Thread is workflow-locked — cancel the active workflow to switch back to Deep mode."` (`workflow_kickoff.py`; it starts with `WORKFLOW_LOCK_DETAIL_PREFIX`). The original `"locked"` line is kept as a comment beside it.
- Both now assert what only the lock arm does: the stored message is the fixed lock copy, and `failedSendDrafts` has no entry.
- A separately titled test covers a non-lock 409 on the generic arm: `279-REVIEW WR-06 — a NON-lock 409 takes the generic arm: the server's words, the draft stashed`. It uses the org-mismatch sentence and asserts the server's words plus the stashed draft.

**How verified:**
- Both files: 37 passed.
- Counterfactuals, each driven by editing `StreamsProvider.tsx` temporarily and restoring it after:
  - The lock condition replaced with `false` (arm never matches): the two lock tests fail.
  - The condition replaced with `true` (any 409 is a lock): the new generic test fails.
- So each test now discriminates its arm.
- These two files are outside the count gate's run list, so they were run explicitly.

## Skipped Issues

None.

## INFO findings: recorded, not fixed (by instruction)

| ID | Finding (one line) | Status |
|---|---|---|
| IN-01 | `data-testid="workflow-lock-error-banner"` now labels every send 409, including the org refusal | recorded, not fixed |
| IN-02 | The folder-arm 409 says "The folder changed…" when it was the Expert that moved | recorded, not fixed |
| IN-03 | `check-test-retarget-only.py --exclude-prefix ""` excludes every file and reports CLEAR (vacuous pass) | recorded, not fixed |
| IN-04 | The WR-06 "could not be loaded" alert outlives a later successful load on the same thread | recorded, not fixed |
| IN-05 | A transient org-validation failure refuses an Expert-thread send with "Switch to this chat's organization…" | recorded, not fixed |
| IN-06 | WR-08's multi-folder note can list the Expert's folders while defaulting `ls` to the excluded thread folder | recorded, not fixed |

## Final gates (run once, after all six fixes, at `16e355582`)

**Backend unit gate.**
- The local DB lock was taken with noclobber; no prior lock existed. It was removed after the run.
- Run in `backend/` with the venv: `pytest tests/unit -q --continue-on-collection-errors -p no:cacheprovider`.
- Result: **71 failed, 7293 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 collection errors** (390.97 s).
- The failing set (test ids only, deduplicated) is **set-equal** to `279-base-failed.txt` (71 = 71, empty diff).

**Frontend typecheck:** `npx tsc -p tsconfig.app.json --noEmit` reports **66 errors / 40 (file, code) groups**.
- This is **set-equal to base**: an empty diff of `file + code + message`, with positions normalised.
- I derived the base set by swapping the 6 touched frontend files back to `331312ce4`, running tsc, and restoring them. The tree was verified clean afterwards.

**Vitest count gate:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, from the repo root, printed **"count gate OK — 434/434 pinned files present, no per-file decrease, 0 failing"** (total 10215, pinned total 9400).

**Other gates:**
- `node scripts/check-hot-file-ledger.cjs 279` exited **0** ("ledger gate OK").
- `node scripts/check-claude-md-size.cjs` exited **0** (CLAUDE.md 90,755 chars).

**Control bytes:** every written file was checked; none contain C0 control bytes (other than tab, LF, CR).

---

_Fixed: 2026-10-13T20:33:18Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Orchestrator follow-up (2026-10-14)

**WR-05 live (Chrome, G-4).** Backend restarted on `6a2afdaf0` (PID 70308, started 00:35:26 local,
after the last fix commit; `/health` 200). Signed in as `fhdmrd@gmail.com`, org admin header
"fhdmrd@gmail.com's Organization · ORG ADMIN". Org admin → Experts → Disable "PhD Literature review"
(`is_enabled=false` 20:36:07Z). Expert catalog, rendered DOM text of that card: "PhD Literature
review · BIASED · General · Org Custom · 1 folder · … · Details · **Disabled**" — no "Start Chat"
(the next card, UAT-265 Billing SOP Advisor, still shows "Start Chat"). Details modal: "**Disabled
for this organization — enable it in Organization admin → Experts to chat with it.**"; its only
buttons are "Close". **Restored:** Enable → `is_enabled=true` 20:36:44Z; disabled Experts locally = 0.
Verdict: ✅ pass.

Observation (not fixed, recorded): the catalog subtitle still reads "Every Expert shown here is one
you can actually use." — no longer literally true for a manager, who now also sees disabled Experts
(marked "Disabled"). Copy follow-up, no behaviour impact.

**WR-02 ruling.** Offered strict (add `org_id` to ~12 test mock helpers) vs the shipped narrowing
(compare only when the thread row carries an `org_id`). The operator replied `ready` without
`strict`, so the narrowing stands. Residual gap, recorded: continuing a paused run on a legacy
NULL-org Expert thread resolves in the run's org as before 279; local NULL-org Expert threads = 0,
and the cloud count is the D-18 read-only check owed before promotion.

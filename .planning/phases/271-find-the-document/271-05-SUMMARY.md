---
phase: 271-find-the-document
plan: 05
subsystem: verification (live DB, browser) + registers
tags: [find, rls, gotrue, two-org-fence, g4-drive, playwright, hot-file-ledger, seeds]
requires:
  - 271-01 (POST /document-search core + route)
  - 271-02 / 271-03 / 271-04 (Filing rules, Find client contracts, Find + Ask on Documents)
provides:
  - backend/tests/integration/_271_gotrue_users.py (real GoTrue users + the get_user_supabase client shape)
  - backend/tests/integration/test_271_two_org_fence.py (SC#5 on the real RLS path, with an RLS-only case)
  - backend/tests/integration/test_271_search_live.py (exact id sets for every Find condition)
  - .planning/phases/271-find-the-document/271-UAT-LOG.md + evidence/ (gates, live proofs, G4-1..G4-6)
  - the Phase 271 close re-derivation in docs/HOT-FILE-LEDGER.md
affects: [272, the next phase touching ConditionPopover / DocumentRow / FilterBar]
tech-stack:
  added: []
  patterns:
    - "fence on GoTrue-issued JWTs against PostgREST, calling the route coroutine (P-04)"
    - "two-wall fence proof: widen the app leg, keep the real JWT, show RLS alone refuses; drive the same widening through the service role to prove non-vacuity"
    - "inherited-vs-new settled at the phase base in a bootstrapped throwaway worktree, never by checking base files out in the main tree"
key-files:
  created:
    - backend/tests/integration/_271_gotrue_users.py
    - backend/tests/integration/test_271_two_org_fence.py
    - backend/tests/integration/test_271_search_live.py
    - .planning/phases/271-find-the-document/271-UAT-LOG.md
    - .planning/phases/271-find-the-document/evidence/ (27 files)
  modified:
    - frontend/src/components/library/find/StructurePopovers.tsx
    - frontend/src/components/library/find/__tests__/FindQuickAdd.test.tsx
    - frontend/src/components/library/__tests__/sketchComposition.test.tsx
    - frontend/src/pages/__tests__/LibraryPage.test.tsx
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/seeds/SEED-243-find-the-document-not-just-the-answer.md
    - .planning/seeds/SEED-005-document-management-capabilities.md
    - .planning/reported-bugs/BUG-260923-01-settings-surfaces-crowd-the-nav-rail.md
decisions:
  - "The SC#5 fence has TWO walls (the core's caller-scoped legs AND RLS); the request alone cannot prove RLS, so an RLS-only case widens the app leg and keeps the real JWT"
  - "G-4 was driven in real Chromium via Playwright because no Chrome MCP tool was available to this executor; the substitution is named in the UAT log"
  - "F-3 (focus never entered the Find editors) fixed under G-3 in this plan; F-1 / F-2 / F-4 routed, not fixed"
  - "The sketchComposition / LibraryPage.test first-case timeouts are INHERITED (reproduced at 20050816d on 2 of 2 runs); a module-level warm-up beforeAll is the fast fix"
  - "P-12: CLAUDE.md took the 14 refreshed rows (119,524 chars) but not the 5 newly-firing files; they live in the ledger and the CLAUDE.md split is scheduled"
  - "SEED-243 -> answered (folded_into 271); SEED-005 note only; BUG-260923-01 stays open"
metrics:
  duration: "~4h10m"
  completed: 2026-10-03
  tasks: 3
  commits: 6
  files: 45
---

# Phase 271 Plan 05: Live proofs, merged-tree gates, the G-4 drive and the registers — Summary

Find is now proven on the running stack: exact id sets for every condition, both relationship directions and all three version states, and a two-org fence on GoTrue-issued JWTs. The fence includes a case that shows RLS alone holds when the app leg is widened. The six G-4 rows were driven in a real Chromium and all pass their failure clauses. Operator sign-off is owed. The drive found four issues: one was fixed here, three are routed.

## What was done

**Task 1: live proofs and the fence** (`f6de8a245`). `_271_gotrue_users.py` creates users through the GoTrue admin API and removes the signup trigger's personal org, so each user has one membership. It then signs in and builds the `get_user_supabase` client shape (anon key plus Bearer token). It reads the local URL and keys from `backend/.env`, because `tests/conftest.py` puts placeholder `SUPABASE_URL` / service-key values in the environment, and those outrank `.env`. The test_114 precedent does the same. Every case calls the route coroutine.

- **Fence (5 cases):**
  - S ∈ {A} and T ∈ {B} (a `member`, not the owner) are asserted from `org_members` before any search.
  - The same request gives S exactly A's row and never B's, and gives T exactly B's row.
  - Picking B's document as the relationship target gives S a response equal to an ordinary empty answer, so there is no existence oracle.
  - With `older`, S never gets B's v1, while B's owner does (the control).
- **The finding behind the RLS-only case.** Swapping the fence's client for the service-role client still showed S nothing of B. The core's own legs exclude B before RLS is reached, so the request alone proves nothing about RLS. `test_rls_alone_fences_when_the_app_leg_is_widened` therefore forces the global-folder leg to name B's folder and keeps S's real JWT. It passes. The same widened request through the service role FAILED with `LEAK: RLS did not stop a widened app leg` (driven, then restored).
- **Content (10 cases), every assertion an exact id set:**
  - SC#1: the target is the only match among four decoys that each differ in one dimension.
  - Added by: me, connection and others.
  - The 2019-12-31T15:00Z boundary row.
  - Folders: subtree on and off, root rows, and a colleague's private folder (0 rows, with an owner control).
  - Relationships: the asymmetric edge in both directions, an edge recorded on an old version, an edge inside one lineage, and P-02 (`older_matches` equals the number of rows Show them returns).
  - Versions, driven through the **real restore route**: Latest/Older/has_earlier after a restore and after a delete, recording P-05's divergence.
- **RED drive:** making the incoming verbs outgoing-only turned 2 live cases red. The service was restored and md5-checked: `9c62992a…`, identical.
- **Verify command:** `19 passed`, with no SKIPPED line. The rule-application suites passed 4/4 and the resolver suites 28/28 (271-01 also had 28 before and after).

**Task 2: gates and G-4** (`a54d39ab0`, plus the fix commits below).
- **Backend:** `71 failed, 6234 passed, 1 skipped, 2 xfailed, 2 xpassed`, 0 collection errors. The failed SET is identical to 271-BASELINES.md, node id by node id.
- **tsc:** 70 errors, the base count. The differences are line shifts only; there is no new error.
- **Ledger, size, seeds and drift gates:** all exit 0.
- **Extension contract:** 18 passed.
- **Vitest:** RED. See below.

G4-1..G4-6 were driven in Chromium, with rendered text read at rest. Each row has screenshots and a DOM text file under `evidence/`. Every row passed:

| Row | Result |
|---|---|
| G4-1 | The count went 4 → 3 → 2 → 1. One row was left; its visible Type, Added by and Date (14 Mar 2019) agree with the chips. |
| G4-2 | The two verbs return different sets. The hint read `1 more match in older (superseded) versions.`, and Show them flipped the Version chip visibly. Contrast: 9.39:1 for the hint and 10.81:1 for the zero count. |
| G4-3 | No Classification entry on the rail. Filing rules lists the seeded rule, and Back lands on Ingestion. |
| G4-4 | One `POST /threads` and zero message sends. The new thread has 0 messages, and the prefill held at 5.5 s. Back in Find, the name input is empty. |
| G4-5 | An older row opens read-only with 0 edit controls; the same selector finds 8 on a latest row. The folder/version line survives the column shed. |
| G4-6 | The date header follows the sort, and undated rows come last. |

**Task 3: registers** (`8bcb10240`).
- **Ledger:** 37 phase-touched scan-list rows were re-derived after the last source edit (`565b05c41`), with the old triple kept as `(was …)`. One close section has an entry per file.
- **CLAUDE.md:** its 14 FIRING rows were refreshed in the same commit, as its sync rule requires. Five newly-firing files are carried only in the ledger, and the CLAUDE.md split is flagged as scheduled. Details are under Deviations.
- **Seeds and bug:** SEED-243 is `answered`, SEED-005 got a note, and BUG-260923-01 stays open with a partial-effect note.

## Seed routing (`check-seeds-register.cjs --phase 271`, re-run at close: the same 12 as at planning, no new match)

| Seed | Routing | Reason |
|---|---|---|
| SEED-243 | **answered**, `folded_into: "271"` | §decide 1-3 delivered (Filing rules inside the Library, document search beside RAG, structure as filters); the operator addition (download + file facts) shipped in 270. Open: operator G-4 sign-off, P-01/P-03 review, F-1/F-2 |
| SEED-005 | note only, stays `open` | 271 shipped Tier-A document SEARCH; Tier B (retention, check-in/out, approvals) undelivered |
| SEED-177 | LEAVE | matched by the broad `backend/app/**` glob; Find makes no model call and adds no egress |
| SEED-185 | LEAVE | no router: Filing rules is Library-local state and is not linkable (accepted at planning) |
| SEED-188 | LEAVE | `backend/app/**` glob; Find reads structured fields only, no untrusted-content channel to the agent |
| SEED-198 | LEAVE | `backend/app/**` glob; Experts untouched |
| SEED-280 | LEAVE (honoured, not closed) | 271-03/04 adopted `CreateLinkDialog.test.tsx`, both `RelationshipsSection` suites and `ConditionPopover.test.tsx` into BOTH knobs and named each new suite explicitly |
| SEED-284 | LEAVE | matched only on the ledger path |
| SEED-287 | LEAVE (honoured, not closed) | the same explicit adoption as SEED-280; the directory-vs-file asymmetry itself is not fixed |
| SEED-296 | LEAVE | the rail LOST an entry (Classification); Evaluation still has no front door |
| SEED-297 | LEAVE | `main.py` matched for one router line; the reconciler is untouched |
| SEED-309 | LEAVE | ChatLayout touched only for the Ask handoff |
| SEED-312 | LEAVE | App.tsx touched only to remove a union member |
| SEED-317 | LEAVE | adjacent Library provenance, not folded |
| SEED-211, SEED-224 | not edited (out of scope by CONTEXT) | `git diff 20050816d` over both files is empty |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1: bug in phase code] Focus never entered the Find editors (G-4 finding F-3)**
- **Found during:** Task 2, the G-4 drive.
- **Issue:** after a chip opened its editor, focus stayed on the chip, so Esc did nothing. With the keyboard, Tab moved to the next chip, which made 5 of 6 editors unreachable. The shipped tests dispatched Escape directly on the dialog element, which a keyboard cannot do.
- **Fix:** `EditorShell` now focuses its first enabled control on mount (+8/−2, G-3).
- **Verification:** a 6-case RED test failed first (`e8752ae92`) and passed after (`565b05c41`). The targeted suites gave 130/130. Re-driven in Chromium, all six editors close on Esc and return focus to the chip. tsc is still 70.
- **Files:** `StructurePopovers.tsx`, `FindQuickAdd.test.tsx`.

**2. [Rule 3: blocking] Inherited first-case timeouts in two LibraryPage suites**
- **Found during:** Task 2, while settling the carry-forward question about whether these reds are inherited.
- **Evidence:** at the phase base `20050816d`, in a bootstrapped throwaway worktree (torn down with the script; the source venv and node_modules are intact), the suites failed on 2 of 2 runs (4 and 5 failures). HEAD failed 1 of 2 runs.
- **Fix:** a module-level `beforeAll` warms `@/pages/LibraryPage` once, with a 30 s budget. The case bodies are unchanged. After the fix, 3 of 3 runs were green.
- **Files:** `sketchComposition.test.tsx`, `LibraryPage.test.tsx` (+5 lines each). **Commit:** `84a958e32`.

**3. The restore premise.** The plan says "after a restore that creates v3 latest". The shipped `POST /documents/{id}/restore` creates no row; it promotes an existing version. The live case drives the real route on a three-version lineage and asserts what the stored rows say.

**4. The `grep -c "set("` proxy reads 6, not ≥ 10.** The file has 34 exact set-equality assertions (`== w.ids(…)` / `== set()`), but they compare through `World.ids()` / `_ids()`, which return sets, and those helpers check for duplicate ids. I did not pad the file to satisfy the literal count.

**5. The relationship direction** follows 271-01's executed implementation and the plan's Pattern 3 table: `references`+B = {p2} and `referenced_by`+B = {}. This agrees with 271-01's recorded resolution of the plan's contradictory line.

**6. G-4 was driven in Chromium through Playwright, not the Chrome MCP.** No MCP browser tool was available to this executor. The drive used a dedicated user in its own org, with rows seeded by SQL into the local DB (not through the UI or the API). All of this is named in the UAT log.

**7. P-12.** CLAUDE.md's 14 existing rows for 271 files were refreshed (119,306 → 119,524 chars). The five newly-firing files were NOT added: they would need about 1,300 chars and only 476 were left under the 120,000 warn band. They are recorded in the ledger section. **The CLAUDE.md split is scheduled.** No other row was shortened.

## Findings routed (not fixed here)

- **F-1:** Find's metadata chips read raw keys (`document_type is Contract`, ISO dates), and `＋ Document type` / `＋ Date` stay offered after those are set. No G4-1 failure clause fires. The fix needs a Find-only label path, because the Views DOM is snapshot-pinned. Routing: `/gsd:quick` (`FilterBar.tsx` + `FindQuickAdd.tsx`), operator to confirm.
- **F-2:** Re-ingest on an older-version Find row is a silent no-op: the backend refuses, and `DocumentList.handleReingest` sends the error only to `console.error`. Move and Delete are also offered on older rows; they were not pressed. Routing: `/gsd:fast` in `DocumentRow.tsx` (hide or disable Re-ingest when `is_latest === false`), with the ledger note.
- **F-4 (inherited):** the shipped `＋ condition` popover ignores Esc after a mouse open. Routing: the next phase touching `ConditionPopover.tsx` (it now FIRES), or `/gsd:fast`.

## Red stays red

**Vitest count gate:**
- **Run 2** (quiet box, after the inherited-timeout fix): **`total 9420 · failed 4 · pinned total 8659` → COUNT GATE VIOLATED.** The four failures are `src/pages/WorkflowsPage.test.tsx` 2 (SEED-171) and `src/components/workflows/PublishGauntlet.test.tsx` 2. Both are provably unmodified (0 diff lines in the files or their source areas) and both were red at the phase base.
- **Run 1** (not quiet, because my worktree checkout overlapped it) read `failed 30` across 7 files; the full list is in the UAT log.
- Neither run reached `count gate OK`. `LibraryPage.find271.test.tsx`, the phase's own suite, failed 2 cases under run 1's load and passed 13/13 twice on its own. That is recorded as an observation, not as innocence.

**Backend:** 71 failed, exactly at the ceiling (zero headroom), with the set identical to the base.

## OWED

- **Operator sign-off on G4-1..G4-6.** The operator was away; every row's Operator column reads OWED.
- **Operator review of P-01** (default sort `added_desc`) **and P-03** (Older versions = the caller's own rows only).
- **Deploy (operator-gated):** no migration, no env var, no seed. Deploy the backend and frontend together. Afterwards, probe `POST /document-search` on production with an operator JWT and run `get_advisors(security)`, both as reads.
- **CLAUDE.md split (scheduled):** 119,524 chars, 476 under the warn band.
- **Vitest under-pin:** `FindQuickAdd.test.tsx` is pinned at 12 and runs 18 (`vitest-count-gate.cjs` is not this plan's file under P-11).
- **F-1, F-2 and F-4** as routed above.
- **`graphify update .`** was run (34,933 nodes). Its tracked output churn (`graphify-out/GRAPH_REPORT.md`, already dirty before this plan) is left uncommitted.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema. T-271-18 to T-271-21 are mitigated:
- **T-271-18:** single membership is asserted first, and a positive control runs through the same request.
- **T-271-19:** the fence client is anon key plus a GoTrue token only; the service role is used solely for the GoTrue admin API.
- **T-271-20:** every seeded row, user and org is deleted, and this was verified at 0 after each suite and after the G-4 teardown. Two orphan probe orgs from my first GoTrue test were found and deleted.
- **T-271-21:** no Supabase MCP call was made at all.

## Self-Check: PASSED

- FOUND: `backend/tests/integration/_271_gotrue_users.py`, `test_271_two_org_fence.py`, `test_271_search_live.py`, `271-UAT-LOG.md`, 27 evidence files.
- FOUND commits: `f6de8a245`, `e8752ae92`, `565b05c41`, `84a958e32`, `a54d39ab0`, `8bcb10240` (all in `git log 18c4a30ae..HEAD`). No file deletions in the range.
- `grep -c "G4-6" 271-UAT-LOG.md` ≥ 1, and `grep -c "Phase 271 — close re-derivation" docs/HOT-FILE-LEDGER.md` = 1.

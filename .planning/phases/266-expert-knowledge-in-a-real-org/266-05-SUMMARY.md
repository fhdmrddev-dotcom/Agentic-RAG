---
phase: 266-expert-knowledge-in-a-real-org
plan: 05
subsystem: experts / live proof + closeout
tags: [experts, rls, tenancy, uat, PACK-18, PACK-19, PACK-20, SEED-304]
status: COMPLETE — 5 of 5 tasks
requires:
  - "266-01..04 merged; migration 195 applied locally; full-schema.sql regenerated (d517606ba)"
provides:
  - "backend/tests/integration/test_266_two_org_fence.py: real-RLS two-org fence (single-org subject, non-owner positive control, two resolver plants)"
  - "266-UAT-LOG.md rows SC#1, SC#2, SC#3a/b/c + control, SC#4 revenue/refusal/flip, UI-1..UI-4, F-1..F-4, each with its own evidence"
  - "fix: expert install Retry hands the ingest path a string document id (re-proved through the restarted server)"
  - "fix: the Library provenance note is a visible caption, no longer tooltip-only (NavRow `caption`)"
  - "266-PROD-PARITY.md: an ordered, approval-gated production checklist (nothing applied)"
  - "SEED-314 (chat rows stamped with the oldest org) and SEED-315 (Retry bypasses the ingest queue)"
affects: [266-VERIFICATION, SEED-304, docs/HOT-FILE-LEDGER.md, CLAUDE.md, STATE.md]
key-files:
  created:
    - backend/tests/integration/test_266_two_org_fence.py
    - .planning/phases/266-expert-knowledge-in-a-real-org/266-UAT-LOG.md
    - .planning/phases/266-expert-knowledge-in-a-real-org/266-PROD-PARITY.md
    - .planning/phases/266-expert-knowledge-in-a-real-org/evidence/00..10 (11 files)
    - .planning/seeds/SEED-314-chat-rows-stamped-with-the-oldest-org-not-the-active-one.md
    - .planning/seeds/SEED-315-expert-install-retry-bypasses-the-ingest-queue.md
  modified:
    - backend/tests/unit/test_260_financial_analyzer_conversation.py (docstring only)
    - backend/tests/unit/test_266_install_idempotency.py (+1 case)
    - backend/app/services/expert_install_service.py (F-1, 1 line + comment)
    - frontend/src/components/ingestion/NavRow.tsx (UI-3, one optional prop)
    - frontend/src/components/ingestion/FolderNode.tsx (UI-3, passes the caption; stale comment corrected)
    - frontend/src/__tests__/components/FolderNode.test.tsx (+2 cases)
    - scripts/vitest-count-gate.cjs (FolderNode pin 18 -> 20)
    - .planning/seeds/SEED-304-financial-analyzer-knowledge-unreachable-cross-org.md (status -> answered)
    - .planning/STATE.md (OV-266-01, Current Position)
    - docs/HOT-FILE-LEDGER.md (19 rows + sections re-derived; NavRow row + section added)
    - CLAUDE.md (13 firing rows updated, 4 added)
decisions:
  - "The phase base is PHASE_BASE = 522e7b4fc, the parent of the first 266 code commit and the base 266-01 used"
  - "Fresh users were created through the public GoTrue signup (anon key from GET /public-config). backend/.env is deny-listed, so no service-role key was used"
  - "SC#3a was driven on /documents/{id}/content and /chunks plus the list GET, because GET /documents/{id} does not exist (405)"
  - "F-1 was fixed under Rule 1 (the shipped Retry path failed live). F-2 and F-3 were recorded as seeds and not fixed, because import_service and run_producer are out of scope by plan"
  - "UI-3 was fixed as operator-directed: 'a small grey line under the folder name', a new optional NavRow prop with the omitted path unchanged"
  - "UI-2 and UI-4's not-installed non-manager line are recorded as OWED, never as passed. The operator's simplified steps did not include them"
  - "D-266-16 (no G-2 sketch) is recorded in STATE.md as OV-266-01, a DECISION and not a skip"
metrics:
  duration: "~70 min (Tasks 1-3, 2026-09-24) + ~35 min (UI-3 fix and Task 5, 2026-09-25)"
  completed: 2026-09-25
  tasks: "5 of 5 (Task 2 satisfied by the orchestrator's measurement; Task 4 answered by the operator)"
---

# Phase 266 Plan 05: live proof + closeout — Summary

The Financial Analyzer's knowledge is proven reachable in a real org and contained there. Two freshly signed-up
users in two fresh orgs installed it, and each copy landed in its own org, completed, with 3/3 chunks embedded. A
second install changed nothing. A user whose only org is A can neither read nor retrieve B's copy, while B's
member can. The Expert's answer ("$124.5 million, +18.2%") is backed by `search.query` document ids that join to
the active org. When a two-org user switches to B, the cited document's org flips to B.

The drive found two shipped defects, and both are fixed and re-proved:
- **F-1:** the install **Retry** crashed live. It now completes through the restarted server.
- **UI-3:** the Library's "from Financial Analyzer" note was invisible because it lived only in a tooltip. It is
  now a visible caption, and the operator confirmed "shows now".

Two defects were deferred as seeds (SEED-314, SEED-315). One operator decision is owed: new orgs get a NULL tier
(F-4). Production is untouched.

## Tasks

| # | Task | Commit(s) | Status |
|---|------|-----------|--------|
| 1 | Two-org RLS fence + test_260 relabel | `ce9fead99` | done |
| 2 | Stack up | — (orchestrator measurement, re-probed) | satisfied |
| 3 | Live drives SC#1-SC#4 | `30ea8fc8a` (RED, F-1) · `a0c1b0ea6` (fix, F-1) · `8c5ee6c71` (log/evidence/seeds) | done |
| 4 | Operator browser check | UI-3 fix: `c5b5fdaa9` (RED) · `2c2c09540` (GREEN) · recorded in `78915d681` | done: UI-1 PASS, UI-2 OWED, UI-3 FAIL→fixed→PASS, UI-4 PASS/OWED |
| 5 | Closeout | `78915d681` (UI rows + F-1 server re-drive) · `805a467ff` (stale comment) · `333451179` (registers, OV-266-01, SEED-304) · `27739939f` (PROD-PARITY) · `f19a0494b` (FolderNode pin) | done |

## Task 1: evidence

`./venv/Scripts/python.exe -m pytest tests/integration/test_266_two_org_fence.py tests/unit/test_260_financial_analyzer_conversation.py -q -rs`
→ **`13 passed`**, no skip line (6 fence cases + 7 relabelled test_260 cases). Re-run at the close together with the
four `test_266_install_*` suites: **`70 passed`**, no skip. Cleanup was verified after the run: `266-fence-%`
folders 0, documents 0, `expert_installs` 0, `phase-163-%` users 0.

What the fence asserts, per the plan:
- S's `org_members` set equals exactly `{org_A}`, and T's equals exactly `{org_B}`, before every leg.
- Every RLS leg runs under `open_user_conn` with an `assert_auth_uid` preflight.
- The embedding dimension is read from `pg_attribute`/`format_type` (`vector(1536)`), never hard-coded.
- The positive control is T, a NON-OWNER org-B member, so B's copy is visible through the shared folder rather than
  through ownership.

**Base-resolver RED** (an explicit-path restore, not a blanket reset):

| step | `expert_service.py` md5 | result |
|---|---|---|
| phase version (HEAD) | `9353193402f264cc930fa821d24c53f4` | — |
| `git show 522e7b4fc:backend/app/services/expert_service.py > …` | `5d0a89736fed2bfde71fa3d28efe4145` | **`3 failed, 3 passed`** |
| `git checkout HEAD -- backend/app/services/expert_service.py` | `9353193402f264cc930fa821d24c53f4` (identical) | `6 passed` |

The three failures:
- leg 3 read `assert [] == [UUID('c9cf4a…')]`;
- the install-row plant was not stripped;
- in the SYSTEM_USER_ID-folder plant, the base resolver ADMITTED org B's system-owned folder into an org-A caller's
  scope.

**test_260 relabel:** the module docstring now opens with "DISPATCHER WIRING ONLY", and the original docstring is
kept verbatim below it. No assertion line was removed: the plan's grep prints nothing.

## Task 2: evidence (satisfied)

`GET /health` → `200` and unauthenticated `GET /experts/installs` → `403`, with exactly one `:8000` owner (pid `83984`
at the drives). ⚠ `uvicorn --reload` did not reload on this box, so the Task 3 drives ran on the code as merged at
19:43Z. For the close the operator restarted the backend: pid **`89432`**, started `2026-09-24T21:21:59Z`, which is
after the F-1 fix (`2026-09-24T20:03:56Z`). Both times were measured.

## Task 3: evidence

All rows and their SQL are in `266-UAT-LOG.md`, and the raw transcripts are in `evidence/00`–`10`.
Model/provider: `deepseek` / `deepseek-v4-flash`, the app default and registry-backed, sent per request.

| Row | Verdict | Key evidence |
|---|---|---|
| SC#1 | PASS | doc `731bfa9a-…`: org A, `completed`, `chunk_count 3`, embedded 3/3; folder org A, `is_org_shared`; `expert_installs` org A, `installed_by` U1; job `0bcf94ea-…` completed |
| SC#2 | PASS | `(documents, chunks, folders, installs) = (1, 3, 1, 1)` before and after the second install; `max(updated_at)` unchanged |
| SC#3a | PASS | U1 → B's copy: `/content` 404, `/chunks` 404, list excludes it; U1's own copy 200 |
| SC#3-control | PASS | U2 → B's copy: `/content` 200, `/chunks` 200 (3 chunks) |
| SC#3b | PASS | no Expert: every `search.query` id joins to org A; B's id is absent |
| SC#3c | PASS | Expert active: same; 0 non-A ids across U1's whole pre-flip history |
| SC#4-revenue | PASS | regexes match `'$124.5 million'` / `'+18.2%'`; the audited doc is org A; chunk 0 carries `$124.5` and `+18.2%` under `($M)` |
| SC#4-refusal | PASS | declines, names what the scope holds, invents no policy; two `search.query` rows with 0 ids |
| SC#4-flip | PASS | U1 added to B, `X-Org-Id: B`: cited doc `06f16045-…` is org B; membership removed and re-read |

## Task 4: the operator's browser check (recorded as UI-1..UI-4 in `266-UAT-LOG.md`)

The operator's words, verbatim: first *"all passed except for I did not see from Financial Analyzer if i am not
mistaken"*, then after the fix *"shows now"*. ⚠ The orchestrator had simplified the plan's four steps into three
action-based tests, so only what actually ran is recorded as run.

| Row | Verdict | What was seen |
|---|---|---|
| **UI-1** Install → Installing… → Start Scoped Chat with Expert, no reload | **PASS** | "all passed" |
| **UI-2** invite blocked while installing | **OWED — NOT RUN** | Left out of the simplified steps; unit-tested only (ComposerExpert / inviteGate) |
| **UI-3** the Library folder shows "from Financial Analyzer" | **FAIL → FIXED → PASS** | Tooltip-only on the `G` pill. RED `c5b5fdaa9` (1 failed / 19 passed) → GREEN `2c2c09540` (NavRow `caption`; 195/195 across FolderNode + ingestion + LibraryPage suites) → "shows now" |
| **UI-4** non-manager member | **PASS (ready-org case) · OWED (not-installed case)** | Saw Start Scoped Chat with Expert and no Install button (UI-1 had installed the org). The not-installed line for a non-manager, "An org admin needs to install…", was never checked live |

No disabled button, blank, "undefined" or raw error string was reported.

**Finding: hover and presence assertions stayed green over a note nobody could see.** The four 266-04 FolderNode
tests reached the text only after a simulated hover. **Lesson: where the words are the deliverable, assert what is
visible at rest.** The two new cases do exactly that.

## Task 5: closeout

1. **UI-1..UI-4** were appended to `266-UAT-LOG.md` (`78915d681`).
2. **STATE.md:** added `## Guardrail overrides — Phase 266 (2026-09-25)` with **OV-266-01**: G-2, decision
   D-266-16, recorded as a DECISION and not a skip. It notes that the live check then found the tooltip-only note,
   which a sketch would have put on the page at rest. Current Position now reads "Phase 266 executed — verification
   next", and the owed rows are listed.
3. **SEED-304 → `answered`.** SC#3 and SC#4 are all PASS. The `status_note` names the `266-UAT-LOG.md` rows and the
   fence test, and the earlier note is kept inside it. Every other key is unchanged. `check-seeds-register.cjs`: OK.
4. **Registers** (`333451179`, row + section in the same commit):
   - Re-derived with the CLAUDE.md recipe. `LibraryPage.tsx` uses `--follow`, because it was renamed from
     `IngestionPage.tsx` at `dbd9b8c0b`; without it the recipe reads `22 / 7`.
   - Scan-list rows now read:

     | File | Triple | Note |
     |---|---|---|
     | `api/experts.py` | 13/5/764 | |
     | `db/experts.py` | 5/4/749 | |
     | `expert_service.py` | 9/6/575 | |
     | `ingest_splice.py` | 15/6/877 | |
     | `expert_install_service.py` | 3/1/648 | |
     | `expert_corpus.py` | 1/1/174 | |
     | `run_producer.py` | 12/6/943 | **byte-unchanged across 266**; last touch `cdf3a308a`; the old row was pre-266 rot |
     | `InviteExpertDialog.tsx` | 3/3/231 | **now fires** |
     | `ExpertCard.tsx` | 2/2/213 | |
     | `ExpertCatalogPage.tsx` | 5/3/330 | **now fires** |
     | `ExpertDetailModal.tsx` | 3/2/438 | |
     | `expertCatalog.ts` | 4/2/224 | |
     | `FolderTree.tsx` | 12/7/207 | |
     | `FolderNode.tsx` | 12/6/272 | |
     | `lib/api/experts.ts` | 7/4/367 | |
     | `LibraryPage.tsx` | 48/16/993 | |
     | `types/index.ts` | 91/71/1436 | |
     | `full-schema-supplement.sql` | 15/10/690 | |

   - Every stale figure is kept beside the new one, and every edited cell is ≤ 200 chars (asserted by the script).
   - **NavRow.tsx:** added a row and a section. It measures **6 / 4 / 269** and FIRES. It had been absent from both
     registers for its entire life, and the UI-3 fix is the commit that took it from `5 / 3 / 250` over the
     threshold. The section records why no gate could have asked for the row: the ledger gate reads
     `files_modified`, and a UAT deviation is in no plan.
   - **The FolderNode "⛔ Zero `NavRow.tsx` edits" claim** is struck through, with a dated correction written beside
     it rather than over it. The component's own stale "NavRow is not changed" comment was corrected the same way
     (`805a467ff`).
   - **Two measured refutations** are recorded beside their originals:
     - 244-06's LibraryPage "the page gained no effect": `useEffect(` sites went 6 → 7.
     - 262-04's ExpertCatalogPage "still exactly ONE `listExperts()`": there are now 3 call sites on one endpoint.
   - **CLAUDE.md:** 13 firing rows updated. 4 added, one each for `ingest_splice.py`, `FolderTree.tsx`,
     `FolderNode.tsx` and `NavRow.tsx`. Every cell is ≤ 120 chars. The file measures **118,746 chars**, DOWN from
     119,168 because the cells were shortened, so it is not in the warn band and no split is scheduled.
     `STATE.md` notes that the next phase adding rows will likely cross it.
5. **`266-PROD-PARITY.md`** (`27739939f`) is a checklist only.
   - Reads first: `expert_installs` existence, 188's rows, both orgs' tiers plus a NULL-tier count, the index
     definition, and a duplicate check.
   - Then **migration 195 BEFORE the backend deploy**, on explicit per-action operator approval, because the
     widened index is needed or a second org's completion write fails with 23505.
   - Then the 266-01 verify SQL set, `get_advisors(security)`, and a proposal to restore `read_only`.
   - **F-4** is an operator decision: how a new org gets a tier, with options.
   - **SEED-314 / SEED-315** are listed as ship-as-is residuals.
   - Post-deploy probes: the corpus is in the image, an embedding key is set, and `/experts/installs` returns
     401/403. Never push without "deploy".
   - `check-deploy-drift.sh`: `RESULT: PASS`.
6. **Final gates:** see below.

## Final gates (verdict lines verbatim)

| Gate | Verdict line |
|---|---|
| Backend baseline `node scripts/check-backend-unit-baseline.cjs` | `Failed tests:   71 (allowed ceiling: <= 71)` · `Passed tests:   5650` · `Errors:         0 (allowed: 0)` · **`[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).`** |
| Vitest `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root), run 1 | `FolderNode.test.tsx  18  20  +2` · `total 8827  ·  failed 0  ·  pinned total 8073` · `count gate OK — 327/327 pinned files present, no per-file decrease, 0 failing.` |
| Vitest, run 2 (after raising the pin 18 → 20 by the printed `+2`, `f19a0494b`) | `FolderNode.test.tsx  20  20  0` · `total 8827  ·  failed 0  ·  pinned total 8075` · **`count gate OK — 327/327 pinned files present, no per-file decrease, 0 failing.`** |
| Typecheck `npx tsc -p tsconfig.app.json --noEmit` | exit 2 as at base. **70 error lines at base and at HEAD; 62 distinct (file, message) pairs; set diff EMPTY (0 new, 0 gone).** The base was measured at `e2468e6ce`, where `frontend/` is byte-identical to `522e7b4fc` (`git diff --quiet` confirmed) |
| `node scripts/check-schema-acl-parity.cjs` | `schema ACL parity OK — every function AND table/column ACL in supabase/migrations/ is mirrored in the supplement.` (mirrored 191/191) |
| `node scripts/check-seeds-register.cjs` | `seeds register gate OK — 322/322 parsed, 0 duplicate ids, 322/322 carry all 5 required keys.` |
| `node scripts/check-hot-file-ledger.cjs .planning/phases/266-expert-knowledge-in-a-real-org` | `ledger gate OK — every watched file has a row.` (333 rows) |
| `node scripts/check-claude-md-size.cjs` | `CLAUDE.md  118746 chars  79.2% of limit  headroom 31254 [OK]` · `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` |
| D-266-11 | `git diff --quiet 522e7b4fc HEAD -- backend/app/services/run_producer.py` → exit 0 (`run_producer-unchanged`) |

**Backend failing SET, diffed by NAME against the wave-1 set** (`wave1_failed.txt`, 71 names). Normalised by cutting
each line at ` - ` and at the stderr warning text that pytest glued onto two lines: **71 = 71, 0 new, 0 gone.** A
naive `sort | comm` had shown two phantom diffs, which were exactly those glued warnings. The known intermittent
inherited flake `test_261_expert_authoring.py::test_expert_draft_without_files` did **not** fire in this run.

## Deviations from Plan

**1. [Rule 1 - Bug] The install Retry path failed live (`Object of type UUID is not JSON serializable`). F-1.**
- **Found during:** Task 3.
- **Cause:** `_redrive_failed` handed the asyncpg row (whose `id` is a `UUID`) to the direct-splice fallback. The
  unit fixture used string ids, so the suite could not see it.
- **Fix:** `doc={**row, "id": doc_id}`. RED `30ea8fc8a` → GREEN `a0c1b0ea6`.
- **Re-proved twice:**
  - in-process (`evidence/08`);
  - then **through the restarted server** (`evidence/10`): planted `failed` → `POST …/install` as U2 with
    `X-Org-Id` B → `202` → `ready`, doc `completed`, 3 chunks, 3 embedded, all org B. The chunks show
    `created_at 21:33:15Z`, 5 s after the POST, so they were rebuilt rather than left over. `documents.updated_at`
    did not move, because neither the plant nor the splice writes it.
- **Files:** `expert_install_service.py`, `test_266_install_idempotency.py`.

**2. [Rule 1 - Bug, operator-directed] The Library provenance note was invisible (UI-3).**
- **Cause:** it was rendered only as the tooltip of the small `G` pill.
- **Fix:** NavRow gains one optional `caption` prop (omit it and the row is unchanged). FolderNode passes the caption
  on org-shared folders.
- **Commits:** RED `c5b5fdaa9` → GREEN `2c2c09540`. `805a467ff` corrected the component's stale comment, and
  `f19a0494b` raised the gate pin.
- **Files:** `NavRow.tsx`, `FolderNode.tsx`, `FolderNode.test.tsx`, `scripts/vitest-count-gate.cjs`.
- ⚠ **`NavRow.tsx` is in no 266 PLAN's `files_modified`**, so the ledger gate could not demand its row. The row was
  added by hand.

**3. [Rule 3 - Blocking] There is no `GET /documents/{id}` route** (405). SC#3a was driven on `/content`, `/chunks`
and the list endpoint.

**4. [Rule 3 - Blocking] `backend/.env` is deny-listed.** Users were created through the public signup, not the admin
API.

**5. Scope additions (records, not code):**
- SEED-314 and SEED-315 were planted.
- `266-PROD-PARITY.md` gained items beyond the plan's (a)-(g): F-4, SEED-314/315, a duplicate-hash precheck, and a
  NULL-tier count.
- `scripts/vitest-count-gate.cjs` is not in this plan's `files_modified`. It is a hot file (`scripts/` is exempt
  from the ledger gate), and its row was not re-derived here. The only edit was one pin raised by the gate's own
  printed delta.

## Findings (see `266-UAT-LOG.md` § Findings)

- **F-1:** the install Retry failed live. **Fixed** and re-proved through the server.
- **F-2 → SEED-315:** a Retry never reaches the ingest queue (storage 409 → direct splice). This was confirmed again
  on the restarted server: the job list was unchanged.
- **F-3 → SEED-314:** thread, message and run rows are stamped with the oldest org, while retrieval honours
  `X-Org-Id`.
- **F-4:** a freshly signed-up org has `subscription_tier = NULL` and cannot install. **Operator decision owed**,
  recorded in `266-PROD-PARITY.md` § F.
- **UI-3:** hover and presence assertions stayed green over an invisible note. Fixed.

## Owed (not done, stated as such)

- **UI-2** (the invite is blocked while installing) and **UI-4's not-installed non-manager line** were never checked
  live. They are unit-tested only.
- **Independent review:** the phase review must be done by an agent that did **not** build 266 (AGENTS.md; Gemini is
  available per the bus). `independent_review` is **owed, not done**.
- **Production:** nothing applied. The approval-gated path is `266-PROD-PARITY.md`.

## Local DB state left on purpose

- Users U1-U4 and their orgs. Their tiers were set to `enterprise` by SQL; the prior value was NULL.
- Two installs (A, B) and U1's 4 test threads.
- U1's temporary B membership was removed and re-read.
- Org B's copy was re-driven by the server Retry. It reads `completed`, 3/3 embedded.

## Known Stubs

None.

## Threat Flags

None. There is no new network surface. F-1 changes the type of one argument on an existing internal call. UI-3 adds
one optional, presentational prop. No production write was made: no Supabase MCP call of any kind in this plan.

## Self-Check: PASSED

- The created files exist: `test_266_two_org_fence.py`, `266-UAT-LOG.md`, `266-PROD-PARITY.md`,
  `evidence/00`–`10`, SEED-314, SEED-315.
- All commits in `git log --oneline c8308cecd..HEAD` are present on `develop`: `ce9fead99`, `30ea8fc8a`,
  `a0c1b0ea6`, `8c5ee6c71`, `07ab1b3cb`, `c5b5fdaa9`, `2c2c09540`, `78915d681`, `805a467ff`, `333451179`,
  `27739939f` and `f19a0494b`.
- The JWT-prefix scan over the phase directory matches only `266-05-PLAN.md`'s own acceptance text.

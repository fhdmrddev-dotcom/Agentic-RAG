---
phase: 280-in-once-out-clean
plan: 04
subsystem: live evidence / docs / ledger / OneDrive re-drive (close plan)
tags: [live-evidence, storage, retention, artifacts, onedrive, ledger, gates, close]
requires:
  - 280-01 document_purge.remove_document_bytes on both watch purge doors; delete_document 404 via maybe_row
  - 280-02 _item_segment + 238 pins re-driven; Team Docs 105-file folder + manifest.json
  - 280-03 same-bytes minter + CR-01 folder-org check
provides:
  - "backend/tests/integration/test_280_purge_bytes_live.py: per-path storage.objects evidence for both doors, held 409, a planted no-op control, live DELETE 404 parity"
  - "DEBT-08 KEEP decision recorded in docs/public/administer/org/retention.md and docs/RETENTION-AND-ARTIFACTS.md (one commit)"
  - "ArtifactBlock caption test: a disposed source renders as plain text with no anchor (content assertion, driven RED)"
  - "hot-file ledger + CLAUDE.md FIRING rows re-derived for every file 280 touched"
  - "280-LIVE-EVIDENCE.md: SC#1, SC#3 (4 arms), SC#4 PASS; SC#2 PARTIAL/OWED with measured figures"
  - "BUG-261014-02 filed (a watched file whose download fails once is never retried)"
affects:
  - ".planning/reported-bugs: BUG-261012-01, BUG-261012-02, BUG-261005-01, BUG-261014-01 closed; BUG-260910-04 stays folded; BUG-261014-02 opened"
  - "238-VERIFICATION M-9: dated Phase 280 note, verdict unchanged"
  - "SEED-313 partially-answered; SEED-318 dated note"
tech-stack:
  added: []
  patterns: [per-path storage.objects assertion with a planted no-op control, driver scripts kept outside the repo, lease-on-create so a live scheduler cannot double-sync a driven watch]
key-files:
  created:
    - backend/tests/integration/test_280_purge_bytes_live.py
    - docs/RETENTION-AND-ARTIFACTS.md
    - .planning/phases/280-in-once-out-clean/280-LIVE-EVIDENCE.md
    - .planning/reported-bugs/BUG-261014-02-watch-item-that-fails-once-is-never-retried.md
  modified:
    - frontend/src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx
    - docs/public/administer/org/retention.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/reported-bugs/BUG-261005-01-minter-retires-pending-same-bytes-copy.md
    - .planning/reported-bugs/BUG-261012-01-watch-purge-never-removes-storage-bytes.md
    - .planning/reported-bugs/BUG-261012-02-delete-document-500-on-a-row-the-caller-does-not-own.md
    - .planning/reported-bugs/BUG-261014-01-upload-files-a-document-into-another-orgs-folder.md
    - .planning/reported-bugs/onedrive-adapter-silently-truncates-and-mismatches-folder-paths.md
    - .planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-VERIFICATION.md
    - .planning/seeds/SEED-313-upload-never-stamps-the-active-org.md
    - .planning/seeds/SEED-318-upload-versioning-retires-an-expert-install-copy.md
decisions:
  - "DEBT-08: KEEP. Retention disposal does not remove message_artifacts; no code change, no migration; SC#5's enforcement arm is not applicable (D-06/D-07)"
  - "SC#2 is recorded PARTIAL/OWED at 104/105, not PASS: D-15 requires all 105 by count. Every other D-15/D-27 criterion passed live"
  - "BUG-260910-04 is NOT closed and 238 M-9 keeps its verdict (D-16 flips only on a full pass), though this report's three defects did not reproduce live"
  - "The missing file is a separate defect (failed watch items are never retried), filed as BUG-261014-02 and not fixed here (retry policy, outside 280's scope)"
  - "The drive was not repeated to reach 105: re-running until green is not evidence, and a fresh watch would dedup-link 94 files"
metrics:
  duration: "~75 min across two executor runs (Tasks 1-2 18:57-19:10 +04, Task 4 19:40-19:55 +04)"
  completed: 2026-10-14
  tasks: 4
  commits: 5
---

# Phase 280 Plan 04: Live evidence, DEBT-08, ledger, gates and the OneDrive re-drive Summary

Plan 04 proved SC#3 and SC#4 on the real local stack, checking storage per path. A planted no-op
proves the purge check can fail. DEBT-08 is recorded as KEEP in both its homes, and a caption test
asserts the rendered content. The ledger was re-derived and every gate was run. The OneDrive
re-drive ran on the real `/Team Docs` folder: paging, decoded paths, the path rule and run status
all passed, but **104 of 105 files** were imported. One download hit a transient TLS error, and the
watch never retries such a failure (BUG-261014-02). So SC#2 is recorded **PARTIAL / OWED**.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 | `200dc3b0f` | test(280-04): live per-path purge + delete 404 evidence; close verified bugs |
| 2a | `c387b0a85` | docs(280-04): record DEBT-08 — retention keeps chat artifacts (D-06, D-07) |
| 2b | `470e91db1` | docs(280-04): re-derive the hot-file ledger for 280 (D-19) |
| 2c | `8f7a02d30` | docs(280-04): route the 280 seeds sweep (SEED-313 partially-answered, SEED-318 note) |
| 3 | — | checkpoint: operator replied **"approved + delete the 95"** |
| 4 | `adf4fecfe` | docs(280-04): OneDrive live re-drive — partial, owed: 104/105 (BUG-261014-02) |

## Task 1: SC#3 and SC#4 live

- **Purge suite:** `test_280_purge_bytes_live.py` → **6 passed, 0 skipped**, 48.63 s, run under
  the local-DB lock.
  - Door 1 and door 2: 2/2 paths each went `1 → 0`, and the rows are gone.
  - Held: both doors answer 409 `legal_hold`, and the paths stay `1 → 1`.
  - Control (a planted no-op bytes step): the path stayed `1 → 1`, so the check saw the orphan.
  - Residue SQL afterwards: all 0.
- **SC#4:** a foreign id and a random id both return `404 'Document not found'`, with the same
  status, detail and headers.
- **SC#1:** plan 03's live suites were re-run at `b794a40c5`: 24 passed, 0 skipped.
- **Bugs closed on that evidence:**
  - BUG-261012-01 (`d1d9747b7`);
  - BUG-261012-02 (`51a9e7962`);
  - BUG-261005-01 (`89d41fd79`);
  - BUG-261014-01 (`8f83c307e`).

## Task 2: DEBT-08, ledger, gates

- **DEBT-08:** the retention page's new `## What retention does not remove` section and
  `docs/RETENTION-AND-ARTIFACTS.md` (D-06's four reasons, KEEP, SEED-072 trigger) landed in one
  commit, `c387b0a85`.
- **Caption test:** `ArtifactBlock.test.tsx` went 8 → 9 passing.
  - RED drive: a planted `<a href="#">` around the caption source made it fail 1 / pass 8, with
    `expected <a href="#"></a> to be null`.
  - `ArtifactFrame.tsx` was restored from the `.orig` copy. Its sha256 was
    `892beb26653402fd4bbebb273402427c63568c8b42b381513841c43bea6b6e47` before and after, and
    `git diff --stat` is empty.

### Gate verdicts

| Gate | Verdict line |
|---|---|
| backend unit baseline (lock held) | `71 failed, 7370 passed, 1 skipped, 2 xfailed, 2 xpassed … [GATE PASSED] (failed: 71 <= 71, errors: 0)` in 403.4 s. `comm -3` against `base_failed_2dd80abbe.norm.txt`: only-in-after = **none**; only-in-base = `test_230_ingestion_jobs_db.py::test_live_reclaim_stale_ingestion_claims_exhausted_fails_document` (the known live-DB flake) |
| closed core (D-20) | `test_259_closed_core_inventory.py`: 7 passed (7 phase types / 1 emitter / 30 tools) |
| vitest count gate (`GSD_VITEST_MAX_WORKERS=2`) | ⛔ `COUNT GATE VIOLATED (1 reason) [failing-tests]`: total 10216 (pinned 9400, +816), **no per-file decrease**, 1 failing test (see below) |
| `tsc -p tsconfig.app.json --noEmit` | exit 2: 66 `error TS` in 30 files, **0** in ArtifactBlock.test.tsx. `git diff --name-only 2dd80abbe HEAD -- frontend/` lists only ArtifactBlock.test.tsx, so every error is inherited |
| `check-docs-coverage` | `docs coverage OK — every code key and inventory ID has a page (excluded by decision: I20).` |
| `check-claude-md-size` | `claude-md size gate OK` — 91,113 chars (60.7%), no `[disposition-too-long]`, `[duplicate-row]` or `[malformed-row]` |
| `check-hot-file-ledger 280` | `ledger gate OK — every watched file has a row.` (533 rows, 38 subject files, 12 watched) |
| `check-seeds-register --phase 280` | `seeds register gate OK — 361/361 parsed`. It fired exactly the 21 planned seeds. SEED-313 → `partially-answered`; SEED-318 stays `planted` with a dated note. The other 19 were left unmodified (SEED-027, 115, 177, 185, 186, 188, 198, 249, 262, 284, 297, 316, 329, 331, 337, 341, 343, 352, 354): v4.6 is repair-only, and 280 touched their trigger paths without changing their subject |
| D-22 | `ls supabase/migrations \| tail -1` = `206_retention_hold_hardening.sql`. `WATCH_PROCESS_ENABLED` and `RETENTION_SWEEP_ENABLED` untouched |
| D-23 | 4 PLAN files |

**The vitest red is inherited or unproven. It is not "fine".**

- The failing test is `src/pages/WorkflowBuilderPage.canvas.test.tsx` › "WorkflowBuilderPage canvas
  door — flag ON (D-183-01) clicking Canvas flips aria-selected and mounts the canvas; clicking
  Spine returns". It died with `Error: STACK_TRACE_ERROR` at 5010 ms, which is the 5 s timeout.
- It was captured from the gate's own JSON report BEFORE any re-run; a copy is in
  `vitest_gate_280-04.report.json`.
- **Provably unmodified by this phase:**
  - `git diff --numstat 2dd80abbe HEAD -- frontend/src/pages/ frontend/src/components/workflows/` is
    empty;
  - `git status --short -- frontend/` shows only the operator's untracked poster jpgs.
- One isolated re-run passed 154/154. One green sample is not proof of innocence.

### Ledger triples (old → new, re-derived at `c387b0a85`)

| File | Old | New |
|---|---|---|
| api/documents.py | 92/36/2532 | 95/37/2534 |
| api/folders.py | 12/8/277 | 14/9/277 |
| api/skills.py | 19/10/858 | 20/10/859 |
| api/takeoff.py | 1/1/221 | 2/1/222 |
| api/sources.py | 9/3/706 | 10/4/698 (G-5 extraction FIRST discharged by 280-01) |
| main.py | 89/64/1002 | 90/65/977 |
| utils/db.py | 2/2/59 | 4/2/76 (below threshold, no FIRING row) |
| services/document_purge.py | 0/0/0 | 2/1/87 |
| services/ingest_splice.py | 19/7/930 | 22/8/1043 |
| services/retention/disposition.py | 1/1/722 (stale) | 4/2/835 (below threshold) |
| models/document.py | 12/9/216 | 13/10/221 |
| sources/adapters/microsoft_graph.py | 3/2/376 (stale) | 8/5/507 (now FIRES; CLAUDE.md FIRING row added) |

## Task 4: SC#2 OneDrive re-drive (PARTIAL / OWED)

The full record is in `280-LIVE-EVIDENCE.md` § SC#2.

**How the folder got there.** The operator's first upload put only `Q3 Plans` at the drive root.
The orchestrator then copied `Team Docs` into the local OneDrive sync folder. The read-only listing
check returned **MATCH**: 95 files over 4 pages at page_size 30, `Q3 Plans` 10, nothing
missing/extra/mis-sized. When the drive browsed the root, the stray root `Q3 Plans` was no longer
listed, and it was never watched.

**Step 1: the 95 Library copies, deleted (operator-approved).**

- Assertions before deleting: exactly 95 rows, the filename set equal to the manifest's top-level
  set, every hash a manifest hash, and 0 other same-hash documents (for this user and for any user).
- Order: rows first (`DELETE 95` in one transaction), then 95 Storage objects.
- After: rows `0`, `storage.objects` `0`, chunks `0`.

**Backend.** The operator restarted it at 15:44:17Z: PID 568 on :8000, under parent 71556. That is
after plans 01-03 merged. `watch_process_enabled = True`.

- The driver leased each watch the moment it was created and set it inactive straight after its
  sync.
- `connector_sync_runs` holds only the driver's 3 runs: **no scheduler-started run**.

**Drive.** The shipped config was untouched. The rule `path contains '/Team Docs/'`
(`ca3d0c66-…`, `rule_scope: watch`) was created before either sync, through the route's own
validator.

| Criterion | Measured | |
|---|---|---|
| all 105 imported | **104** — A 94 + B 10; `team-note-058.txt` is an A item in `state='failed'` with no document | ⛔ |
| A pages ≥ 4 | 4 `list_files` calls, 29/30/30/6 | ✅ |
| paths decoded under `/Team Docs/` | `bool_and` true, 0 NULL, 0 still-encoded; `/Team Docs` 94, `/Team Docs/Q3 Plans` 10; `/Team Docs/Q3 report draft.txt` present | ✅ |
| rule matched | `_classification` naming the rule on **104/104**, written by the restarted ingest worker (104 jobs completed, 104 documents completed) | ✅ |
| run success + listing complete | A `success`, `true`, new 94, **errors 1**; B `success`, `true`, new 10, errors 0 | ✅ / ⛔ errors 1 |

**The missing file.**

- Its download raised an empty-message `httpx.ConnectError` from `start_tls`: a transient TLS
  failure. The file WAS listed, so this is not the BUG-260910-04 paging or path defect.
- A deliberate, recorded **second sync** of watch A (already inactive) called `list_files` 4 times
  and `read_file` 0 times. It reported `success`, new 0, errors 0, and the file was still missing.
- So a failed watch item is never retried, and later runs read clean. Filed as **BUG-261014-02**
  (open, major).

**Outcome.**

- BUG-260910-04 stays `folded`, with a dated note that its three defects did not reproduce live.
- 238-VERIFICATION M-9 keeps its ⛔ verdict, with a dated note that the M-9 property itself (a path
  rule firing on OneDrive) was observed on 104/104 documents. The `ORIGINAL, 2026-09-07` count is
  unchanged at 4.
- Both watches are `is_active = false`. The 104 imported documents and the rule remain for the
  operator.

**What closes SC#2:** a re-drive that imports all 105, or an operator ruling that the shortfall
belongs to BUG-261014-02.

## Deviations from Plan

1. **[Scope: operator-approved] The 95 Library copies were deleted before the drive.** They were
   not part of the plan. The operator approved it ("delete the 95") because the watch's
   `on_conflict="link"` dedup could have linked to them. It was scoped and asserted before deleting,
   and verified 0 afterwards.
2. **[Rule 2: drive safety] Each watch was leased on creation and deactivated right after its
   sync.** The plan deactivated them at the end. With `watch_process_enabled = True` and
   `create_watch` setting `next_run_at = now()`, the restarted scheduler could otherwise have
   double-synced. Verified: no scheduler-started run.
3. **[Measurement] A second sync of watch A was run** to measure whether the failed item is retried.
   The plan specified one sync per watch. It is recorded as a separate run row and changed no
   counts.
4. **STATE.md / ROADMAP.md were not edited.** The orchestrator's instruction overrides the plan's
   Task 4 STATE.md edit. The owed SC#2 row is carried in this SUMMARY, `280-LIVE-EVIDENCE.md`, the
   OneDrive report and 238 M-9.
5. **The SC#2 upload was done by the orchestrator** (copy into the OneDrive sync folder), not by the
   operator's drag-and-drop as D-14 had it.

## Known Stubs

None.

## Threat Flags

None. The driver and evidence scripts live outside the repo, and no token or header was printed
(T-280-22). The watches are inactive and the imported docs are left for the operator (T-280-23).
SC#2 is not recorded as a pass (T-280-24).

## Not done

- `graphify update .` was not run. `graphify-out/GRAPH_REPORT.md` carries the operator's
  uncommitted change, and 280-04 changed tests and docs only.

## Self-Check: PASSED

- Files: test_280_purge_bytes_live.py, RETENTION-AND-ARTIFACTS.md, 280-LIVE-EVIDENCE.md and
  BUG-261014-02 all exist.
- Commits: 200dc3b0f, c387b0a85, 470e91db1, 8f7a02d30 and adf4fecfe are all in `git log`.

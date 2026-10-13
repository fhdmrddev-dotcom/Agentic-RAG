---
phase: 275-retention-legal-hold
plan: 04
subsystem: retention-ui
tags: [retention, legal-hold, org-admin, library, react, preview-gate, type-the-count, copy-fence]

requires:
  - phase: 275-02
    provides: "ApiRefusal/refusalOf, HoldRefusalNotice, retentionCopy.ts + fence, Find include_archived + SET_INCLUDE_ARCHIVED, src/components/retention TARGETS dir"
  - phase: 275-03
    provides: "the 18-route /retention API (route table in 275-03-SUMMARY.md), DocumentResponse archived_*/retrievable"
provides:
  - "frontend/src/lib/api/retention.ts — typed client for every /retention route"
  - "useRetentionStates — the ONE batched document-states read the Library owns"
  - "Library surfaces: row chips, folder line, detail-panel Retention section, archived-hidden line, pre-open hold refusal"
  - "Org admin → Retention (unlocked): posture + sub-tabs Policies · Legal holds · Waiting for you · History"
  - "Policy editor with the D-02 Preview gate; hold dialogs; type-the-count delete batches; review decisions; receipts"
affects: [275-05, Library, Org admin shell, Find, count gate]

tech-stack:
  added: []
  patterns:
    - "Copy groups fenced against their OWN sources: sketch, UI-SPEC, CONTEXT, hold_guard.py, models/retention.py; templates fenced by literal segment"
    - "One batched server read owned by the page, passed down; leaves are pure functions of props"
    - "Save gate: aria-disabled + an on-screen reason + stale re-lock, with the server as the wall"

key-files:
  created:
    - frontend/src/lib/api/retention.ts
    - frontend/src/components/retention/useRetentionStates.ts
    - frontend/src/components/retention/RetentionChip.tsx
    - frontend/src/components/retention/RetentionFolderLine.tsx
    - frontend/src/components/retention/RetentionSection.tsx
    - frontend/src/components/retention/ArchivedHiddenLine.tsx
    - frontend/src/components/retention/LegalHoldsList.tsx
    - frontend/src/components/retention/LegalHoldDialog.tsx
    - frontend/src/components/retention/ReleaseHoldDialog.tsx
    - frontend/src/components/retention/WaitingForYou.tsx
    - frontend/src/components/retention/DeleteBatchCard.tsx
    - frontend/src/components/retention/ReviewBatchCard.tsx
    - frontend/src/components/retention/RetentionTab.tsx
    - frontend/src/components/retention/RetentionPolicies.tsx
    - frontend/src/components/retention/RetentionPolicyEditor.tsx
    - frontend/src/components/retention/RetentionPreview.tsx
    - frontend/src/components/retention/RetentionHistory.tsx
    - frontend/src/components/retention/__tests__/libraryRetention.test.tsx
    - frontend/src/components/retention/__tests__/RetentionSection.test.tsx
    - frontend/src/components/retention/__tests__/LegalHolds.test.tsx
    - frontend/src/components/retention/__tests__/WaitingForYou.test.tsx
    - frontend/src/components/retention/__tests__/RetentionTab.test.tsx
    - frontend/src/components/retention/__tests__/RetentionPolicyEditor.test.tsx
    - frontend/src/components/retention/__tests__/RetentionHistory.test.tsx
  modified:
    - frontend/src/components/retention/retentionCopy.ts
    - frontend/src/components/retention/__tests__/retentionCopy.test.ts
    - frontend/src/types/index.ts
    - frontend/src/components/ingestion/DocumentRow.tsx
    - frontend/src/components/ingestion/DocumentList.tsx
    - frontend/src/components/metadata/DocumentDetailPanel.tsx
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/components/library/find/DocumentsFindBody.tsx
    - frontend/src/components/org/OrgAdminShell.tsx
    - frontend/src/components/org/OrgAdminShell.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md

key-decisions:
  - "275-04: the pre-open refusal sentence is built client-side from hold_guard.py's own constants (fenced against that source), because document-states carries no refusal sentence; a member branch ignores hold_names entirely"
  - "275-04: the editor offers a folder OR a document type — picking one disables the other with the server's own SCOPE_ONE_ONLY sentence (275-03 deviation 4)"
  - "275-04: native <select> controls in the policy editor instead of Radix Select (same labels and options; testable; recorded deviation)"
  - "275-04: OrgAdminShell.test.tsx adopted into the count gate by FILE path (11), because it carries the retired locked-Retention fence"
  - "275-04: the release dialog names the hold's COVERAGE (folder paths + direct-document count) — HoldOut carries no document names"

# Repaired 2026-10-12 (Phase 277, REG-05): requirements-completed was [] and is replaced with the list copied verbatim from 275-04-PLAN.md frontmatter requirements (D-15)
requirements-completed: [RET-01, RET-02, RET-03, RET-04]

duration: ~38min
completed: 2026-10-12
---

# Phase 275 Plan 04: The retention surfaces Summary

**Org admin → Retention is live: a posture line, Policies with a Preview-gated editor, Legal holds, Waiting for you with type-the-count batches and review decisions, and a receipts History. In the Library, every reader now sees what will happen to a document: a row chip, a folder line, a Retention section in the detail panel, archived rows hidden behind one shared Show/Include-archived state, and a held document's Delete that opens straight into the refusal. A member never sees a matter name.**

## Performance

- **Duration:** about 38 min (base `ec15f2ac9` at 10:58; first commit 11:12, last 11:34, then the summary)
- **Completed:** 2026-10-12
- **Tasks:** 3 of 3, each with its own RED `test(275-04)` and GREEN `feat(275-04)` commit, plus a `docs(275-04)` ledger commit in Task 3
- **Files:** 24 created, 13 modified

## Accomplishments

### Task 1: the Library (S6-S9, S10 pre-open, D-04, D-17, D-19, D-21)

- **`lib/api/retention.ts`** has one typed function per 275-03 route. Every call uses `getAuthHeaders()` (`X-Org-Id`), and every non-2xx throws `ApiRefusal` with the server's sentence. A pydantic 422 list is unwrapped to its `msg`. It is not re-exported from `lib/api.ts`.
- **`useRetentionStates`** is the one owner of `POST /retention/document-states`.
  - It sends one request per change of the order-independent id set plus folder.
  - On error it keeps the last-known states.
  - `LibraryPage` passes the result down. The chips, the folder line and the section make no fetch.
- **Row chips:** at most one retention chip and one source chip, using the server's `chip` / `source_chip` values. Nothing renders when the document is calm.
- **Folder line:** an admin sees the matter. A member sees exactly `Everything in this folder is on legal hold.`
- **Retention section** sits directly after File:
  - One sentence per server kind.
  - The source sentence renders below it.
  - The member hold reads exactly the two D-17 lines.
  - The Archived sentence uses the B-NEW-1 snapshot name.
  - Un-archive appears only when the server sends `can_unarchive`. It shows a `✎ Un-archived · recorded` receipt, or `Couldn't un-archive. Nothing changed.`
- **Browse** hides archived rows behind `{N} archived document(s) hidden · Show`. Show dispatches Find's `SET_INCLUDE_ARCHIVED`, so Find's chip flips with it: one state.
- **DocumentList:** a HELD row's Delete opens the dialog straight into `HoldRefusalNotice` with one Close.
- **Host edits are one mount each.** DocumentRow, DocumentDetailPanel and DocumentList each gain ONE optional prop.

### Task 2: Legal holds and Waiting for you (S3, S4, D-03, D-05, D-10, D-11, D-35)

- **Hold cards** follow the sketch anatomy. Released holds sit under `<details>`, dimmed, with no buttons. A `held_today` of null reads `Couldn't count the documents yet.`
- **LegalHoldDialog:**
  - Placing a hold is direct, with no confirm (066).
  - Folders are an indented checkbox tree. Documents use a typeahead and appear as chips, each ✕ labelled `Remove {doc} from the hold`.
  - The live count comes from the server. A failed count never shows 0.
  - Place hold stays held back, with a visible reason, until something is picked.
  - A failure keeps every field.
- **ReleaseHoldDialog** names the victims, focuses Keep hold, and draws Release as outline amber, not red. A failure keeps it open.
- **DeleteBatchCard:**
  - Every row starts ticked. Unticking strikes the row through, shows the D-11 note, and clears the typed count.
  - The button needs typed == N > 0, and Enter submits only when the button is enabled.
  - With every row unticked it becomes `Keep N documents` and needs no count.
  - The result banner (`role=status`, focused) names any late-hold drop.
  - Confirm and keep failures each have their own honest sentence plus Reload.
- **ReviewBatchCard:** nothing is pre-selected. With no deletes chosen the button is `Apply N decision(s)`; with deletes, a typed count over the deletes only.

### Task 3: Org admin → Retention (S1, S2, S5, D-01, D-02, D-20, D-22)

- **OrgAdminShell** changes in three places only:
  - `locked: false` for Retention.
  - ONE `activeTab === "retention"` branch.
  - ONE `recordingPulse` state (1.6 s) passed to `OrgBand`.
- **RetentionTab:**
  - Posture states: healthy, sweeps off (amber, replacing both sweep items), never run, and did not finish.
  - A load error keeps the last-known values and offers Try again.
  - The sub-tabs are a `role=tablist` with roving arrow keys.
  - The Waiting tab's accessible name is `Waiting for you, N waiting`. Its pill turns red only when N > 0.
- **Policies** shows the server's text in every column. The sub line's time is `sweep_hour_utc` (`03:00 UTC` in the test). No `02:00` literal appears in any `.tsx`.
- **The editor** opens in place, with Name focused:
  - Counted from offers exactly two clocks (D-22).
  - The second stage appears only for archive (D-20).
  - A policy covers a folder OR a type, never both.
  - Save is `aria-disabled` with an on-screen reason until a fresh Preview. Any edit marks the preview stale and re-locks Save.
  - A server 409 is rendered and re-locks Save.
  - A save failure keeps the preview and leaves Save unlocked.
  - Remove is a plain confirm with Keep policy focused.
- **Preview** shows the server's buckets with their `why` text as-is, the undecidable notes, and D-34's `{N} private documents are not covered`.
- **History** shows a 062-A sentence per action:
  - ✎ appears only when `written`.
  - Stored names are never links.
  - The pager loads 50 more with `Show older`.

## Task Commits

1. **Task 1:** RED `e7c37389f`, GREEN `d00ec5fc4`
2. **Task 2:** RED `1ed0c4f02`, GREEN `26de37adc`
3. **Task 3:** RED `b1d553105`, GREEN `9fe5c4244`, ledger `90d80167d`

## Verification (measured)

- **Task 1:**
  - Verify command (`retention + ingestion + DocumentDetailPanel.file270 + pages/__tests__ + apiBarrel`): **35 files, 559 passed.** Base for the same set plus OrgAdminShell was 34 / 532.
- **Task 2:** retention suites → **6 files, 82 passed.**
- **Task 3:**
  - `src/components/retention` + `OrgAdminShell.test.tsx` → **10 files, 139 passed.**
  - `check-claude-md-size` → exit 0.
- **Final neighbour sweep:** `retention + org + ingestion + metadata + library + pages/__tests__ + apiBarrel` → **83 files, 1135 passed, 1 skipped, 0 failed.**
- **RED runs** (implementation moved aside, then restored):
  - Task 1: 2 files failed at import, and 7 copy-fence cases failed.
  - Task 2: 3 files failed, 6 cases.
  - Task 3: 5 files failed, 9 cases.
- **Per-suite pins** (measured from the JSON reporter, 0 failing):

  | Suite | Pin |
  |---|---|
  | libraryRetention | 12 |
  | RetentionSection | 18 |
  | LegalHolds | 16 |
  | WaitingForYou | 13 |
  | RetentionTab | 11 |
  | RetentionPolicyEditor | 16 |
  | RetentionHistory | 16 |
  | retentionCopy | 16 (was 5) |
  | holdRefusals | 10 (unchanged) |
  | OrgAdminShell | 11 (was 9 cases, ungated) |

- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`):
  - **66 errors = base count.** The only hits in files this plan touched are the two base `LibraryPage.tsx TS6133` (`TabsList`, `TabsTrigger`). They moved from line 58 to line 62 because of 4 new import lines.
  - That is the same errors at a shifted line, so there are no new errors.
- **Acceptance greps** (all hold):

  | Check | Result |
  |---|---|
  | `RetentionRowChips` in DocumentRow | 2 |
  | `title="Retention"` in DocumentDetailPanel | 1 |
  | `fetch(` / `getDocumentStates` in Section, Chip and FolderLine | none |
  | `StatusChip.tsx` diff vs base | empty |
  | member line in retentionCopy | 1 |
  | `inputMode="numeric"` and `aria-describedby` in DeleteBatchCard | present |
  | D-11 and count-failed strings | present |
  | `locked: false` for retention | yes |
  | `RetentionTab` in OrgAdminShell | 2 |
  | retention + "coming soon" in the shell test | none |
  | `02:00` in retention `.tsx` | none |

- **Ledger gate:**
  ```
  hot-file ledger — .planning/phases/275-retention-legal-hold
    scan list: 504 rows · subject: 110 files · watched: 58
  ledger gate OK — every watched file has a row.
  ```
- **CLAUDE.md size:** `120248 chars` on disk, exit 0 with WARN.
  - The warn band was already crossed at base: `120401` on disk (CRLF).
  - This plan lowered the size by 153 characters.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `DocumentsFindBody.tsx` edited (not in `files_modified`)**
- **Issue:** `FindListProps` is a `Pick<>` of DocumentList's props. Without `"retention"` in it, Find rows could not carry the chips or the pre-open refusal.
- **Fix:** one token added to the Pick. The ledger row and section were updated in the same plan.
- **Commit:** `d00ec5fc4`.

**2. [Rule 2 - Correctness] The pre-open refusal sentence is composed client-side**
- **Issue:** `document-states` carries `held` and `hold_names` (admins only), but no refusal sentence. Without one, the S10 pre-open mode had nothing to show.
- **Fix:** `holdRefusalFor()` uses the `server` copy group, which is fenced verbatim against `hold_guard.py`'s `DOCUMENT_ADMIN`, `DOCUMENT_ADMIN_NO_MATTER` and `DOCUMENT_MEMBER`. The member branch ignores `hold_names` even when it is present (tested).
- **Commit:** `d00ec5fc4`.

**3. [Rule 2 - Correctness] The editor offers a folder OR a type, never both**
- **Issue:** 275-03 deviation 4: the server returns 422 for a draft with both.
- **Fix:** picking one disables the other and shows the server's own `SCOPE_ONE_ONLY` sentence. A new `serverModels` copy group is fenced against `backend/app/models/retention.py`.
- **Commit:** `9fe5c4244`.

### Design decisions recorded as deviations

**4. The copy fence grew five new groups**
- **Fences:**
  - `sketchTemplates`: literal segments are checked against the sketch.
  - `specTemplates`: checked against the UI-SPEC.
  - `decisionTemplates`: D-34's `{N} private documents are not covered`, checked against CONTEXT, because the UI-SPEC has no such line.
  - `server` and `serverModels`: checked verbatim against the backend sources.
- **Counts:** every group asserts an exact `checked` count: 71, 78, 42, 35, 1, 3, 1.

**5. Native `<select>` in the policy editor**
- The UI-SPEC inventory names `ui/select` (Radix). The editor uses native `<select>` with the input styling instead.
- Labels, options and validation are identical, and jsdom drives native selects reliably.

**6. The release dialog names the coverage, not documents**
- `HoldOut` carries `folder_paths`, `document_count` and `held_today`, but no document names.
- The victim list therefore names the covered folders plus `covers N document(s)`, capped at 8 with `and N more`.
- The body's N is `held_today`, falling back to `document_count`.

**7. Copy wording choices**
- **Small grammar choices:**
  - `Apply {N} decision(s)` instead of `Apply {N} decisions`, so a single decision is not "1 decisions".
  - Result banners add `Archived N document(s).` and `Kept N document(s).` (both segment-fenced against the UI-SPEC), so a keep-only or review-only result does not read "Deleted 0 documents."
- **Readings of the server's enums:**
  - The section kind `unarchived` (a server value with no UI-SPEC row) reads `Un-archived by {name} on {date}. “{policy}” skips it until …`.
  - A `queued_review` receipt reads `Queued **doc** for review under “…”`.

**8. `OrgAdminShell.test.tsx` adopted into the count gate**
- The plan asked to re-pin it "only upward", but it was never pinned or gated.
- It is now in TARGETS by file path and pinned at 11. That is 9 base cases: the two retired locked-Retention assertions were replaced, and two new cases were added.

**9. Ledger triple for `LibraryPage.tsx` measured with `--follow`**
- `57 / 21 / 1297`. The prior row (`53 / 18`) used the follow measure. Without it the count reads `31 / 10`.

**10. `OrgAdminShell.tsx` now FIRES G-5**
- It is at 5 phases, and its ledger row read `no`: present and wrong.
- The row is corrected, a CLAUDE.md G-5 row is added, and the cell says the next touch proposes an extraction FIRST.

---

**Total deviations:** 10 (1 blocking, 2 correctness, 7 recorded design choices). **Impact:** no scope added and no backend change.

## Issues Encountered

- **Vitest rewrote a snapshot's line endings.** It rewrote `frontend/src/components/ingestion/__snapshots__/FilterBar.find271.test.tsx.snap` with no content change. That file was restored with `git checkout -- <that file>` both times and never staged.
- **Not run in this plan (revision W-5):**
  - The full vitest count gate and the full tsc set diff. Both are owed by 275-05 Task 1 on the merged tree.
  - `graphify update .`, because `graphify-out/` carries the operator's uncommitted changes (the 275-01/02/03 precedent).
- **The operator's unrelated working-tree changes were never staged.** These are `.claude/settings.local.json`, `.mcp.json`, `graphify-out/`, `scratch/`, `screenshots/`, the docs posters, `.planning/ui-reviews/` and the 276 `.gitkeep`. Every commit was by explicit path and checked with `git show --stat HEAD`.

## Known Stubs

None. Every surface reads the real API through `lib/api/retention.ts`. The Retention section shows `not recorded` only when the state has not arrived and the row itself records no archive. That is the honest-absence rule, not a stub.

## Threat Flags

None beyond the plan's register:
- T-275-30: the member DOM is asserted to contain no matter name, and the member branch ignores `hold_names`.
- T-275-31: the batch starts fully ticked, an untick clears the typed count, and the server re-checks.
- T-275-32: Save is aria-disabled until a fresh preview, and a 409 is rendered.
- T-275-33: every write calls `onRecorded`, which pulses the band.

No new endpoint, auth path or schema surface.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|---|---|---|
| 1 | `test(275-04)` `e7c37389f` | `feat(275-04)` `d00ec5fc4` |
| 2 | `1ed0c4f02` | `26de37adc` |
| 3 | `b1d553105` | `9fe5c4244` |

- Each RED was run with that task's implementation moved out of the tree (`mv` to the scratchpad, `retentionCopy.ts` / `OrgAdminShell.tsx` from `HEAD`), seen red, and then restored before the GREEN run.
- No refactor commit was needed.

## For 275-05

- The merged-tree count gate should show the totals rise by the pins above (+102 pinned cases, +1 adopted file). Nothing should decrease.
- Run the tsc set diff. Expect the two LibraryPage TS6133 errors at line 62, not 58.
- **The G-4 scenarios are reachable by clicks alone:**
  - Org admin → Retention: the tab, the Policies editor and Preview, Waiting for you.
  - The Library: the folder line under a held folder, the row chip, and a held row's Delete opening into the refusal.
- The ledger rows for 275-02/03-touched backend files are 275-05's to re-derive, as planned. The ledger gate is already OK for the phase.

## Self-Check: PASSED

- All 24 created files exist on disk.
- Commits `e7c37389f`, `d00ec5fc4`, `1ed0c4f02`, `26de37adc`, `b1d553105`, `9fe5c4244` and `90d80167d` are in `git log`.

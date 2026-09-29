---
phase: 266-expert-knowledge-in-a-real-org
plan: 04
subsystem: experts / frontend
tags: [experts, install, catalog, composer, library, PACK-18, PACK-19, D-266-01, D-266-03, D-266-13]
requires:
  - "266-03's frozen wire contract: POST /experts/{id}/install → 202 ExpertInstallResult, GET /experts/installs → ExpertInstallSummary[], `install` on first-party list/get rows"
provides:
  - "ExpertInstallState / ExpertInstallResult / ExpertInstallSummary wire types + installExpert + listExpertInstalls (lib/api/experts.ts)"
  - "INSTALL_COPY + pure installView / inviteGate / installCardLine / provenanceByFolder (expertCatalog.ts) — the one home of install wording"
  - "state-swapped primary control on ExpertDetailModal + ExpertCard; fetch-reconciled install flow on ExpertCatalogPage"
  - "invite gate in InviteExpertDialog; 'Shared with org · from <Expert>' on the installed Library folder"
affects: [266-05]
tech-stack:
  added: []
  patterns:
    - "state → control mapping as a pure selector; components branch on view.kind, never on install.state"
    - "poll keyed on a BOOLEAN (anyInstalling) so the interval exists only while something is installing"
    - "a 403 tier refusal becomes [] at the call site, before handleResponse (draftSkillBody precedent)"
key-files:
  created: []
  modified:
    - frontend/src/lib/api/experts.ts
    - frontend/src/types/index.ts
    - frontend/src/components/experts/catalog/expertCatalog.ts
    - frontend/src/components/experts/catalog/ExpertDetailModal.tsx
    - frontend/src/components/experts/catalog/ExpertCard.tsx
    - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
    - frontend/src/components/chat/InviteExpertDialog.tsx
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/components/ingestion/FolderTree.tsx
    - frontend/src/components/ingestion/FolderNode.tsx
    - frontend/src/components/experts/catalog/__tests__/expertCatalog.test.ts
    - frontend/src/components/experts/catalog/__tests__/ExpertDetailModal.test.tsx
    - frontend/src/components/experts/catalog/__tests__/ExpertCatalogPage.test.tsx
    - frontend/src/components/chat/__tests__/ComposerExpert.test.tsx
    - frontend/src/__tests__/components/FolderNode.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "ExpertInstallState is declared in lib/api/experts.ts and imported into types/index.ts with `import type` — no cycle at runtime, one declaration"
  - "The card shows SHORT status words (INSTALL_COPY.card*) with the full sentence as the pill's title; the modal shows the full sentence. Both come from INSTALL_COPY"
  - "An install-sourced cause (cause_source 'install') is the server's own sentence and passes through; every other cause goes through classifyIngestionError"
  - "The Library provenance map is built by provenanceByFolder in expertCatalog.ts, not on the page — LibraryPage's `.folder_id` occurrence fence (pinned at 7) stays byte-true"
  - "The install result's `install` state is applied to the row immediately, THEN the list is re-read — so the poll starts even if the re-read fails"
metrics:
  duration: ~75 min
  completed: 2026-09-24
  tasks: "3 of 3"
---

# Phase 266 Plan 04: The install on the Expert surfaces and the Library — Summary

A manager can install a first-party Expert from its detail modal or its catalog card and watch
**Installing…** turn into **Start Chat**, or into **Install failed — retry** with a readable cause.
A non-manager sees why they cannot act, and no state renders a button that does nothing. The
composer's invite dialog refuses an Expert whose knowledge is not installed, and says why, so no
run starts against an empty scope. The installed Library folder reads
**Shared with org · from Financial Analyzer**.

All wording and every state → control decision live in one place, `expertCatalog.ts`. The
components only draw what `installView` / `inviteGate` return.

## Tasks

| Task | Name | Commits | Status |
|------|------|---------|--------|
| 1 | Wire types, client functions, the one home of install wording | `61d56c243` (RED) · `255930c95` (GREEN) | done |
| 2 | Modal + card state swap, fetch-reconciled install on the catalog | `90aed839a` (RED) · `119690741` (GREEN) | done |
| 3 | Invite gate, Library provenance, gate knobs, typecheck set-diff | `7a3df8aa8` (RED) · a90fd5e68 (GREEN) | done |

## Evidence

### Task 1

- **RED:** `expertCatalog.test.ts`: `16 failed | 10 passed (26)`. The failures were the absent exports (`installView is not a function`, `listExpertInstalls is not a function`, …).
- **GREEN:** `26 passed (26)`, later `27` with `provenanceByFolder`'s case added in Task 3.
- `grep -c "export const INSTALL_COPY" expertCatalog.ts` → `1`. No `.tsx` outside `__tests__` contains the literal `Install failed — retry`.
- `grep -n "org_id" lib/api/experts.ts` → no match. `installExpert` sends **no body** (case 23 asserts `init.body` is `undefined`).
- `git diff e2468e6ce -- frontend/src/types/index.ts` adds exactly two lines: `import type { ExpertInstallState } from "@/lib/api/experts"` and `install?: ExpertInstallState | null`.
- `git diff --quiet e2468e6ce -- frontend/src/lib/api.ts` → unchanged (the barrel is not widened).

### Task 2

- **RED:** catalog dir `10 failed | 53 passed (63)`. Modal case (9) (ready → Start Scoped Chat) passed on base, as a regression control should.
- **GREEN:** `4 passed (4)` files, `63 passed (63)`.
- **Poll-stop plant:** with `clearInterval(timer)` replaced by `void timer`, case (11) failed with `expected "vi.fn()" to be called 2 times, but got 5 times`. The file was restored from a scratch copy (`grep -c clearInterval` back to `1`) and the suite went green again.
- `grep -c "disabled"` on `ExpertDetailModal.tsx` / `ExpertCard.tsx` → `1` / `2`, the same as base. Every occurrence is in a pre-existing comment. No `disabled` attribute exists.
- `grep -c "setInterval" ExpertCatalogPage.tsx` → `1`, and one matching `clearInterval`.
- `grep -n "classifyIngestionError\|error_message" ExpertDetailModal.tsx` → no match. The classified sentence arrives through `installView`.
- `git diff e2468e6ce` on both suites shows **additions only**. The original 8 modal cases and page case (8) (`listExperts` called exactly once) are byte-unchanged and green.

### Task 3

- **RED:** `ComposerExpert` + `FolderNode`: `4 failed | 26 passed (30)`. The four controls (ready invites, org-authored invites, the exact base label, no label on a non-shared folder) held on base.
- **GREEN:** the targeted set of 10 files (catalog ×4, ComposerExpert, FolderNode, LibraryPage ×4): `149 passed (149)`.
- **The only invite call site sits behind the gate:**
  ```
  124:              const gateReason = inviteGate(expert)
  191:                    {gateReason !== null ? (
  200:                        onSelectExpert(expert)      ← the `: (` arm of :191
  ```
  The invite button itself is byte-unchanged, including its indentation.
- `grep -c "fetch\|useEffect\|useState" FolderTree.tsx` → `5`, the same as base.
- `git diff --quiet e2468e6ce -- frontend/src/components/ingestion/NavRow.tsx frontend/src/lib/api.ts` → unchanged.
- **LibraryPage suites:** all four are **byte-unchanged**. None needed a `vi.mock("@/lib/api/experts")` block. In those suites `listExpertInstalls` rejects (no auth session), the effect's `catch` swallows it silently, and a rerun of `LibraryPage.test.tsx` alone shows no stderr at all.
- **Typecheck set-diff** (`npx tsc -p tsconfig.app.json --noEmit`):
  - base `107` lines, after `107` lines.
  - `comm` shows exactly two "new" and two "gone" lines. They are the same two pre-existing `TS6133` errors (`TabsList`, `TabsTrigger` unused in `LibraryPage.tsx`) moved from line 48 to line 50 by the two added import lines. **Zero new errors.**
- `node scripts/check-hot-file-ledger.cjs .planning/phases/266-expert-knowledge-in-a-real-org` → `ledger gate OK — every watched file has a row.` (exit 0).
- **Gate knobs (same commit):** `FolderNode.test.tsx` was in neither knob (grep). It is now named in TARGETS and pinned at `18`. Pins raised: `ComposerExpert` 8 → 12, `expertCatalog` 10 → 27, `ExpertCatalogPage` 8 → 13 (the file already carried 9 at base), `ExpertDetailModal` 8 → 15. Each pin was taken from a JSON-reporter count of the suite and then checked against the gate's own per-file column (below).

### The full vitest count gate (`GSD_VITEST_MAX_WORKERS=2`, run from the worktree root)

**Run 1: RED, `failed 2`.** The failing filenames were captured from the gate's persisted JSON
(`vitest-count-gate-81348-1790278027360.json`) **before** anything was re-run:

| File | Case | Signature | `git diff --numstat e2468e6ce` |
|---|---|---|---|
| `src/pages/WorkflowBuilderPage.canvas.test.tsx` | canvas door, flag ON: clicking Canvas flips aria-selected… | `STACK_TRACE_ERROR` | empty (**provably unmodified**) |
| `src/pages/WorkflowsPage.test.tsx` | D-17: the project filter holds STARTERS out… | `STACK_TRACE_ERROR` | empty (**provably unmodified**) |

Both are named in SEED-171's set of five cap-independent flaky suites. Neither imports any file this
plan touched (import scan: no match). The cap was **not** changed. On the same run, all five of
this plan's suites read exactly their pins with a delta of `0` (27 / 18 / 15 / 13 / 12).

**Run 2 (same tree, cap unchanged). Verdict line, verbatim:**

```
  total 8825  ·  failed 0  ·  pinned total 8073
count gate OK — 327/327 pinned files present, no per-file decrease, 0 failing.
```

**Pinned files `326 → 327`**, one higher than base: `FolderNode.test.tsx` was adopted. The pinned
total goes `8022 → 8073`, and the `+51` breaks down with nothing left over: 18 (FolderNode adopted),
+4 ComposerExpert, +17 expertCatalog, +5 ExpertCatalogPage, +7 ExpertDetailModal.
⚠ The two SEED-171 suites were green on run 2. That is one sample, recorded as "provably
unmodified", never as "fine".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Library page tripped its own wire-shape fence**
- **Found during:** Task 3 (the first LibraryPage run)
- **Issue:** Building the provenance map inline on `LibraryPage.tsx` added two `r.folder_id` reads. `LibraryPage.cloudImport.test.tsx`'s source fence pins `.folder_id` occurrences at exactly 7 (`expected 9 to be 7`).
- **Fix:** Moved the map-building into a pure `provenanceByFolder(installs)` in `expertCatalog.ts`, which is the install home anyway, and pinned it with case (27). The page reads no install field. The fence is untouched and green.
- **Files modified:** `expertCatalog.ts`, `LibraryPage.tsx`, `expertCatalog.test.ts`
- **Commit:** a90fd5e68

**2. [Rule 2 - Missing critical functionality] A card-initiated install refusal had nowhere to render**
- **Found during:** Task 2
- **Issue:** The plan routes `installError` into the modal. A refusal from an Install pressed on a **card** (no modal open) would have been silent.
- **Fix:** `installError` is tracked with the Expert's id. The modal shows it when that Expert is inspected. Otherwise a page-level `role="alert"` line shows it beside the grid, in the `startError` idiom.
- **Commit:** `119690741`

**3. [Plan wording] Card status uses short words, not the full sentence**
- **Found during:** Task 2
- **Issue:** The card face carries no paragraph (sketch 261-262 §1). The `installing` sentence is about 140 characters.
- **Fix:** Added `INSTALL_COPY.cardInstalling` / `cardNeedsAdmin` / `cardFailedNeedsAdmin` and a pure `installCardLine(expert)`. The pill's `title` carries the full sentence, and the modal shows the full sentence. All wording is still only in `INSTALL_COPY`.
- **Commit:** `119690741`

### Observations (not deviations)

- On the **first** targeted Task 3 run, which covered 6 files including four heavy LibraryPage suites, two `LibraryPage.test.tsx` heading cases timed out at 19.9 s. The failing filenames were captured before any rerun: `renders heading 'Library'` and `does NOT still render the replaced heading 'Documents'`. They passed on the next two runs, including one of that file alone. My change adds one mount-time effect to that page, and that effect resolves silently. This reads as a cold-transform timeout, not a defect. It is recorded as **not proven innocent**: one green sample of a flaky case is not proof.

## Known Stubs

None. Every new control is wired to a real client function, and every state comes from server data.
Until 266-03 merges, the backend routes do not exist in this worktree, which is expected under the
frozen contract. The client functions are exercised against a stubbed `fetch`.

## Threat Flags

None beyond the plan's register. T-266-24 (no body), T-266-25 (classified cause), T-266-26
(control from server `can_install`), T-266-28 (poll only while installing, 4 s, cleared) and
T-266-29 (provenance is a React text child through NavRow's string prop) are each implemented and
pinned by a case.

## TDD Gate Compliance

For each task, a `test(266-04)` RED commit comes before its `feat(266-04)` GREEN commit:
`61d56c243 → 255930c95`, `90aed839a → 119690741`, `7a3df8aa8 → a90fd5e68`.

## Self-Check: PASSED

- All six task commits are on the branch: `61d56c243`, `255930c95`, `90aed839a`, `119690741`, `7a3df8aa8`, `a90fd5e68`.
- All 16 modified files exist. The working tree held only this SUMMARY when it was written.
- STATE.md and ROADMAP.md were not touched. The orchestrator owns those writes.

---
phase: 298-lists-follow-the-active-org
fixed_at: 2026-10-28T16:30:00Z
review_path: .planning/phases/298-lists-follow-the-active-org/298-REVIEW.md
iteration: 1
base: e6efd9da2
findings_in_scope: 10
fixed: 9
refuted: 0
refuted_arms: 1
deferred: 1
status: partial
outcomes:
  CR-01: fixed
  WR-01: fixed
  WR-02: fixed
  WR-03: fixed
  WR-04: fixed (watch arm refuted)
  WR-05: fixed (docstring corrected; lock not feasible)
  WR-06: fixed (requires human verification)
  WR-07: fixed
  WR-08: deferred
  WR-09: fixed
  IN-05: fixed
---

# Phase 298: Code Review Fix Report

**Fixed at:** 2026-10-28
**Source review:** `.planning/phases/298-lists-follow-the-active-org/298-REVIEW.md`
**Base:** `e6efd9da2` · **Iteration:** 1

**Summary:** 10 findings in scope (CR-01, WR-01..WR-09).
- Fixed: 9 (CR-01, WR-01..WR-07, WR-09). WR-04's watch arm was refuted and not built; the rest of WR-04 is fixed.
- Deferred: WR-08.
- One Info item fixed under the ≤3-line rule: IN-05.

Each finding was driven before it was fixed. A RED test was committed and seen failing, then the GREEN fix was committed separately.

## Per-finding outcomes

| ID | Outcome | RED | GREEN | Notes |
|---|---|---|---|---|
| CR-01 | fixed | `b9d505327` | `2ef0db96c` | See CR-01 below. |
| WR-04 | fixed (watch arm refuted) | `fcbf386bc` | `4c47fffd6` | See WR-04 below. |
| WR-05 | fixed: docstring corrected | `2c6fae271` | `0be38fb85`, `03357909e` | See WR-05 below. |
| WR-06 | fixed: requires human verification | `e76865585` | `eadeb90ac` | See WR-06 below. |
| WR-09 | fixed | `e3e3000d8` | `52e996932` | See WR-09 below. |
| WR-03 | fixed | `2bd00861e` | `4b6117bdf` (+ `ea4c95efd`, cell trim) | See WR-03 below. |
| WR-07 | fixed | `85d9623db` | `734052b93` | See WR-07 below. |
| WR-01 + IN-05 | fixed | `503a99ad2` | `e7bf3d141` | See WR-01 and IN-05 below. |
| WR-02 | fixed | `06f9a3c27` | `547366c22` | See WR-02 below. |
| WR-08 | deferred | — | — | See WR-08 below. |

### CR-01 — subfolders and documents stamped in another org

**What the RED showed.** The preview returned no refusal for a document or subfolder stamped in org C inside an org-A folder. The repair move into the stray row's own org self-collided.

**The fix.**
- A new `mixed_orgs` refusal fires when any moving folder or document carries an org other than the source org. It names the other org only when the caller is a member of it.
- The collision and same-name joins now exclude the moving set (`NOT (t.id = ANY($1))`).
- With every moving row in the source org, the audit row's org is the true source org.

### WR-04 — blockers inherited from an ancestor

**What the RED showed.** An org-shared ancestor, and an ancestor bound by a chat, a workflow (two levels up) or an Expert, did not refuse the move.

**The fix.** `_ancestor_refusals` walks `retention_folder_ancestors` once. It names the nearest ancestor for each blocker, under the existing refusal codes.

**Refuted: the watch arm.** `WatchService` writes into `library_folder_id` itself and never into a descendant. `watch_service.py` has no `parent_id` or subfolder use. The subtree's own watch items are already refused. That RED case was turned into a does-not-refuse case, with the reason in its docstring.

### WR-05 — the TOCTOU claim

**The window was reproduced** in a sequenced live test:
- a draft save checked before the move binds the moved folder after it;
- a chat bound after the move is not refused by the database.

**Why no advisory lock.** The chat bind is a supabase-py write on `PATCH /threads`, not on the pool. The draft save is two pool calls in FIRING files. A lock would need both writers inside one pool transaction.

**The fix.** The docstring now names the RESIDUAL WINDOW and its bound. A unit fence (RED → GREEN) pins that text.

### WR-06 — header-less draft create

**What the RED showed.** A header-less create bound to a foreign folder saved. Fence **D-298-09** amended the old "header-less = skipped" assertion.

**The fix.** `foreign_folder_refusal` gains an `owner_default` keyword. It reads the owner's `LIMIT 1` membership with the mig-106 trigger's own statement, and only when the definition binds anything. `create_draft` gains one keyword. The INSERT is unchanged, so test_296's byte-identical `None` path still holds.

**Needs human verification.** The trigger's `LIMIT 1` has no `ORDER BY`, so the check and the stamp agree by using the same statement, not by construction. For a two-org header-less caller this is "the same row under the same plan".

### WR-09 — Root upload with an unvalidated header

**What the RED showed.** A DB error during the membership probe returned `None`, so the upload would have been stamped with the mig-106 `LIMIT 1` org.

**The fix.** When a well-formed header was sent and the lenient resolver said `None`, `root_upload_org` re-asks once:
- not a member → falls back, as before;
- a member → that org;
- the read fails → a 503 with a sentence, and nothing is minted.

A request with no header never probes. The list helpers are unchanged. This logic lives in `org_lists.py`, so `dependencies.py` (FIRING) is untouched.

### WR-03 — a failed thread refetch after a switch

**What the RED showed.** `switching` stayed true forever.

**The fix.** `loadThreads` gains one catch arm in `useThreads.ts` (FIRING). The latest failed request settles its org with no rows and rethrows, as `useFolders` does.

### WR-07 — the org move's audit receipt

**What the RED showed (3 cases).** The row rendered as the raw code, it sat in no filter group, and neither audit map had an entry for it.

**The fix.** One identical entry in `OrgAuditTab.tsx` and `AuditTab.tsx` (both FIRING): "Moved an item to another organization", group Organizing.

### WR-01 — a saved view surviving an org switch

**What the RED showed.** A saved view open in org A kept the list on that view after a switch to B.

**The fix.** `useLibraryOrgSwitch` takes an optional `listReset` (`findDispatch`, `setListTarget`). The switch reset now also clears the Find search and the list target. LibraryPage (FIRING) gains one property. This closes **deferred-items #2**.

### IN-05 — a late `refreshViews` answer

**What the RED showed.** A `refreshViews` answer arriving after a switch repainted the old org's views.

**The fix.** `refreshViews` is tagged with `getActiveOrgId()` at send time and drops a mismatched answer. This is a 2-line change.

### WR-02 — two move sheets on mobile

**What the RED showed.** Two mounted hosts rendered two portalled sheets.

**The fix.** `MoveToOrgSheetHost` claims in mount order on a module-level list (`useSyncExternalStore`). Only the earliest still-mounted claimant renders the sheet, and a survivor takes over on unmount. No FIRING file was touched.

### WR-08 — deferred

**Reproduced by reading.**
- `chipLabel(id, {label, activeOrgId})` and `optionLabel` at `WorkflowBuilderPage.tsx:2403` mark folders relative to the viewer's active org.
- `folderOptions` is the active-org narrowed list.

**Why deferred.** The definition's org is not on the wire: `list_draft_workflows` does not select `org_id`, and `WorkflowDraftRow` has no `org_id` field. A correct fix needs a projection change in `db/workflows.py` (FIRING), the client type, `useDraftPersistence`, and `WorkflowBuilderPage.tsx` (FIRING). That is more than one expression in two FIRING files.

**Bounded harm.** It is a wrong hint only; the ORG-05 server refusal is keyed on the row's org.

Recorded as **deferred-items #5**, with re-open trigger Phase 299 or the next phase naming `useBuilderNameMaps.ts` / `db/workflows.py`.

## Info items not touched (each >3 lines or not obviously safe)

| ID | Why it was left |
|---|---|
| IN-01 | Two catch sites in `useWorkflowFork.ts`. |
| IN-02 | Needs an extra `org_members` read on the pool path. |
| IN-03 | Retry and refresh semantics in the sheet. |
| IN-04 | Moving a module across layers. |

## Count-gate pins and ledger

**Count-gate pins** (commit `5953451f4`): four raised, none lowered.

| Suite | Pin |
|---|---|
| `OrgAuditTab.test.tsx` | 16 → 19 |
| `LibraryPage.orgSwitch.test.tsx` | 5 → 7 |
| `useThreads.orgSwitch.test.ts` | 4 → 5 |
| `MoveToOrgSheet.test.tsx` | 22 → 23 |

**Ledger.** Every FIRING file touched had its CLAUDE.md row (≤80 chars) and its `docs/HOT-FILE-LEDGER.md` scan cell (≤200 chars) re-derived in the same commit, with the old cells moved verbatim into a new section:
- `workflows.py`
- `useThreads.ts`
- `OrgAuditTab.tsx`
- `AuditTab.tsx`
- `LibraryPage.tsx`
- `vitest-count-gate.cjs`

Non-FIRING scan rows were re-derived too: `useLibraryOrgSwitch.ts`, `MoveToOrgSheet.tsx`, `org_move.py`, `foreign_folder_refusal.py`, `org_lists.py` (the last three in `3920d7263`).

## Gates (verdict lines verbatim)

| Gate | Verdict |
|---|---|
| Backend baseline | `[GATE PASSED] Backend unit baseline satisfied (failed: 69 <= 71, errors: 0).` (10325 passed) |
| Live suites under the local-DB lock: `test_298_org_move_live.py` + `test_298_org_matrix_live.py` | `65 passed in 163.39s` |
| Vitest count gate | `count gate OK — 548/548 pinned files present, no per-file decrease, 0 failing.` · `total 12771 · failed 0 · pinned total 11622` |
| `npx tsc -p tsconfig.app.json --noEmit` | 61 errors, 53 unique, which equals the base. New: 0. The only errors in changed files are `LibraryPage.tsx(59)` TS6133 ×2, on an import line unchanged since the base. |
| `check-hot-file-ledger.cjs` | `ledger gate OK — every watched file has a row.` |
| `check-claude-md-size.cjs` | `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` |

**Process note.** `4b6117bdf` was committed while the size gate read `[disposition-too-long]` (204 chars). The next commit, `ea4c95efd`, trimmed the cell. Every commit after that ran the gate green.

---

_Fixed: 2026-10-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

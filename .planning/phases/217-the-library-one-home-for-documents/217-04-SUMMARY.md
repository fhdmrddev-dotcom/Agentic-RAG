---
phase: 217-the-library-one-home-for-documents
plan: 04
subsystem: frontend-library-surface
tags: [rename, library, hot-file-ledger, source-fence, sketch-contract]
requires:
  - "the sketch contract at .planning/sketches/218-the-library-and-its-tabs (COPY.PAGE_TITLE / COPY.PAGE_SUB)"
  - "docs/HOT-FILE-LEDGER.md § frontend/src/pages/IngestionPage.tsx (the same-commit sync obligation it states about its own rename)"
provides:
  - "frontend/src/pages/LibraryPage.tsx — the renamed page, exporting LibraryPage, h1 `Library`"
  - "frontend/src/__tests__/library/renameFence.test.ts — source fences over ActiveView, the positional fallback, the nav label/key split, SIDEBAR_PIN_KEY and ingestion_step's terminal-write residue"
  - "docs/HOT-FILE-LEDGER.md § frontend/src/pages/LibraryPage.tsx + its CLAUDE.md row and anchor"
  - "a regenerated BUILD-CONTRACT.generated.md at 195 assertions"
affects:
  - "frontend/src/components/layout/ChatLayout.tsx (one import, one element)"
  - "frontend/src/lib/nav-items.ts (one label)"
  - ".planning/sketches/218-the-library-and-its-tabs/drive.cjs (5 fences re-pointed or rewritten)"
tech-stack:
  added: []
  patterns:
    - "the RENAME MAP fence (A9c precedent): assert the old word is GONE and the new word is PRESENT and COPY still records what was replaced — a verbatim shipped-state check cannot tell a rename from a loss"
    - "STATUS-scoped extraction over a backend .py via ?raw, so the one legitimate null is excluded BY CONSTRUCTION rather than by an allow-list"
    - "a LIVE positive control (the reingest reset's real null) rather than a synthetic-only one"
key-files:
  created:
    - "frontend/src/__tests__/library/renameFence.test.ts"
  modified:
    - "frontend/src/pages/LibraryPage.tsx (renamed from IngestionPage.tsx)"
    - "frontend/src/pages/__tests__/LibraryPage.test.tsx (renamed from src/__tests__/components/IngestionPage.test.tsx)"
    - "frontend/src/components/layout/ChatLayout.tsx"
    - "frontend/src/lib/nav-items.ts"
    - "docs/HOT-FILE-LEDGER.md"
    - "CLAUDE.md"
    - ".planning/sketches/218-the-library-and-its-tabs/drive.cjs"
    - ".planning/sketches/218-the-library-and-its-tabs/BUILD-CONTRACT.generated.md"
decisions: [D-217-01, D-217-02, D-217-03, D-217-11]
metrics:
  duration: "~35 min"
  completed: "2026-08-29"
  tasks: 3
  commits: 2
---

# Phase 217 Plan 04: The Library rename Summary

The document space is now called `Library` in the nav and on the page, `IngestionPage.tsx` is
`LibraryPage.tsx` with its git history intact, and the two registers that carried the old path
moved in the same commit — with a source fence replacing the prose that used to hold the four
things the rename must NOT touch.

## What shipped

| | |
|---|---|
| Commits | `dbd9b8c0b` (tasks 1+2, one commit by the same-commit sync rule) · `08dcbb6fa` (task 3) |
| Suites | `LibraryPage.test.tsx` **6/6** · `renameFence.test.ts` **15 cases / 54 assertions** |
| Sketch drive | **195 passed · 0 failed · 195 assertions** |
| `check-claude-md-size.cjs` | exit **0** — `102,379` chars, 68.3% of limit |
| `tsc -p tsconfig.app.json` | **33** errors vs a re-derived baseline of **34** — no new errors, one fewer |

## The re-derived ledger triple

`frontend/src/pages/LibraryPage.tsx` — **`27 / 10 / 603`**, G-5 ⚠ **FIRES**.

⚠ **`git log --oneline` at the new path reports `1`, not `27`.** A `git mv` carries the history,
but only `--follow` reveals it — so a future re-derive that reads `1 / 1 / 603` has measured the
RENAME, not the file, and must not read the small number as a reset. That warning is written into
the ledger section itself, not just here. The triple was derived by adding this commit to the old
path's measured **26 commits / 9 phases** (`03, 08, 29, 47, 111.1, 112, 114, 153, 165`; the
six-digit buckets `260328` and `260405` are dated quick tasks and were subtracted), then confirmed:
`git log --follow --oneline -- frontend/src/pages/LibraryPage.tsx | wc -l` reads **27**.

**G-5 / D-217-01 statement, as the plan required.** The named seam — *"the sidebar, the filter bar
and the grid are three independent concerns in one component; with a tab shell arriving, extract the
shell first and let each tab own its body, otherwise the tab bar becomes the tenth conditional
branch"* — **was NOT taken by this plan, and it says so in the ledger rather than reading
`satisfied`.** This plan is a pure rename: zero behaviour change, zero new branch, no new
conditional. **Plan `217-09` takes the seam**, because it is the plan that adds the shell.

**The gate side:** this file is in **NEITHER count-gate knob** today, and its suite has **never been
executed by the gate**. Plan `217-12` adopts it. That is not a footnote — see the deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] The moved suite was RED at HEAD, and its redness was structurally invisible**

- **Found during:** Task 1, on the first run of the renamed suite.
- **Issue:** `src/__tests__/components/IngestionPage.test.tsx`'s `vi.mock("@/lib/supabase", …)`
  factory declares only `supabase`. `useAuth.ts:3` imports `SUPABASE_CLIENT_REHYDRATED` as a named
  export and `:51` passes it to `addEventListener`, so vitest threw
  *"No `SUPABASE_CLIENT_REHYDRATED` export is defined on the `@/lib/supabase` mock"* **at mount** —
  all four cases failed before asserting anything.
- **Proof it predates this plan:** the file was restored from base (`9a3808697`) into a scratch
  copy, re-pointed at the renamed module only, and run: **4 failed, same error.** So the rename did
  not cause it.
- **Fix:** one line — `SUPABASE_CLIENT_REHYDRATED: "supabase:client-rehydrated"` added to the mock
  factory, with a comment naming why it is not optional.
- ⚠ **The finding is not the missing line, it is why nobody saw it.** This suite is in neither
  count-gate knob, so the gate has **never executed it**. A suite that is red and unwatched reads
  exactly like a suite that is green. This is the same shape as Phase 214-15's
  `WorkflowScheduleModal.test.tsx` discovery (TARGETS decides what RUNS; BASELINE decides what is
  GUARDED) — except here the file sat on the wrong side of **both**. Recorded in the ledger section.
- **Files modified:** `frontend/src/pages/__tests__/LibraryPage.test.tsx`
- **Commit:** `dbd9b8c0b`

**2. [Rule 3 — Blocking] A fifth sketch fence broke on the rename, and the plan enumerated four**

- **Found during:** Task 3. The plan named the control, `PAGE`, `A2` and `A7b`/`A7c`. The drive
  reported **5 failed**, not 4.
- **Issue:** `H2b` (`drive.cjs:761`) asserted
  `/\{ view: "documents", icon: FileText, label: "Documents" \}/` — it read the **LABEL** to prove a
  property about the **GATE** (that the Documents entry carries no `feature:` key).
- **Fix:** rewritten to assert the **STRUCTURE** — `label: "[^"]+"` — which is the property the
  fence actually guards and which the 218 merge must not silently change. Same treatment as
  `A7b`/`A7c`, and for the same reason.
- ⚠ **This is the plan's own lesson landing one fence over:** a shipped-state fence written as a
  verbatim string breaks on a rename that changes nothing it cares about. Three such fences existed;
  the plan predicted two.
- **Files modified:** `.planning/sketches/218-the-library-and-its-tabs/drive.cjs`
- **Commit:** `08dcbb6fa`

**3. [Rule 3 — Drift the rename itself created] Two cross-references named a path that no longer exists**

- **Found during:** Task 2, checking the `nth-child` invariant.
- **Issue:** `docs/HOT-FILE-LEDGER.md`'s `DocumentList.tsx` section and CLAUDE.md's matching row
  both said *"`IngestionPage.tsx` sheds columns 3–5 positionally"*. After the `git mv` that names a
  file that does not exist.
- **Fix:** both updated to `LibraryPage.tsx` (the ledger one keeps *"renamed from `IngestionPage.tsx`
  at Phase 217"* so the history is not erased). The column-shedding selector
  `[&_table_th:nth-child(n+3):nth-child(-n+5)]:hidden` was also written **into** the LibraryPage
  section, because that rule lives in this file and is enforced on a file this one does not import.
- **Files modified:** `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md`
- **Commit:** `dbd9b8c0b`

## The `ingestion_step` fence — what was measured, not asserted

This is the plan's ⭐ arm, and it exists because the invariant was carried by **prose in three plans
and by nothing executable** — no plan's `files_modified` contains `documents.py`'s write blocks,
which is an accident rather than a guard.

**The extraction, re-derived at run time** (the plan's planning-time figures reproduced exactly):
**seven** status-bearing `documents` UPDATE payloads — **1 `completed`** (no null), **3 `failed`**
(no null), **2 `pending`** (exactly one of which nulls), **1 `processing`**.

| Control | Result |
|---|---|
| **LIVE positive control** — the same extractor over `pending` payloads reports ≥1 null write (the reingest reset at `documents.py:~1308`) | ✅ **passes** — the detector provably fires on real source, so the absence assertions are not vacuous |
| **SYNTHETIC RED** — `"ingestion_step": None,` spliced into a **copy of the extracted** `completed` payload | ✅ **rejected by the same predicate** |

Both were observed, and the live one is the stronger evidence: a regex that matches nothing can
never prove itself.

⚠ **The `\s*` between `.table("documents")` and `.update({` is load-bearing and is not cosmetic.**
The reingest reset is formatted with `.update({` on its own line; a pattern without it silently
misses **the one block the live control depends on**, and the control would then pass vacuously —
which is the precise failure mode the control exists to rule out.

**Scoping is by STATUS, never by line and never by an allow-list.** An unscoped file-wide assertion
is RED at HEAD (the reingest reset is a legitimate null) and the obvious "fix" is deleting the guard.

## RED-driven: five defects planted, five reds observed, all reverted md5-identical

A guard nobody has seen fire is not a guard. Each plant was reverted with `git checkout --` on the
single file and confirmed byte-identical with `md5sum -c`.

| Planted defect | Arm that went RED |
|---|---|
| `ActiveView`'s `"documents"` → `"library"` in `App.tsx` | `(a) ActiveView still carries "documents"` |
| `<KnowledgeHealthPage />` trailing else → `<div />` | `(b) ChatLayout's trailing else …` |
| `SIDEBAR_PIN_KEY` → `"library.sidebar.pinnedExpanded"` | `(d) SIDEBAR_PIN_KEY's literal …` |
| `"ingestion_step": None,` added to the real `completed` write | `no terminal write nulls ingestion_step` **and** `SYNTHETIC RED` |
| the reingest reset's real null REMOVED | `⭐ LIVE POSITIVE CONTROL` |

**`git diff backend/` is EMPTY at HEAD** — this plan READS `documents.py` and modifies nothing under
`backend/`.

## Known residue — comment-only `IngestionPage` references left for a later sweep

Twelve, all comments, none load-bearing, none in this plan's `files_modified` (later plans in this
phase own several of these files and a same-wave edit would collide):

`App.tsx:288,290` · `ClassificationRulesPage.tsx:29` · `FilterBar.test.tsx:127` ·
`DocumentDetailPanel.tsx:307` · `RelationshipsSection.tsx:9` · `citationNav.tsx:11,56,129` ·
`GovernancePage.tsx:95` · `types/index.ts:328`

Plus one deliberate mention in the renamed suite's own docblock recording where it moved from.
`grep -rn "IngestionPage" frontend/src` returns **only** these — no import, no JSX element, no export.

## Verification

| Check | Result |
|---|---|
| `git log --follow --oneline -1 -- frontend/src/pages/LibraryPage.tsx` | history survived — a `git mv`, not a delete+add (27 commits reachable) |
| `grep -rn "IngestionPage" frontend/src` | comment lines only |
| `grep -n "export function LibraryPage" …/LibraryPage.tsx` | 1 |
| `grep -n ">Library</h1>"` / `">Documents</h1>"` | 1 / **0** |
| `grep -n 'label: "Library"'` / `'view: "documents"'` in `nav-items.ts` | 1 / 1 |
| `grep -n "documents.sidebar.pinnedExpanded"` | unchanged literal |
| `git diff -U0 ChatLayout.tsx \| grep '^@@'` | hunks at `:8` and `:758` **only** — nothing near `:879` |
| `grep -c "frontendsrcpagesingestionpagetsx" CLAUDE.md docs/HOT-FILE-LEDGER.md` | **0 / 0** |
| `grep -c "frontendsrcpageslibrarypagetsx" CLAUDE.md` | **1** |
| ledger section retains `430px` / `nth-child` | 1 / 3 occurrences |
| `git diff drive.cjs` touches `A3b`, `A5b`, `A5e`, `COPY.STAGES` | **no** — hunks at `77`, `83`, `109`, `195`, `759` only |
| `grep -nF '\n\n'` in the fence | one docblock mention **warning against it**; no pattern uses it |

## Threat Flags

None. This plan adds no route, no input parsing and no data path.
`T-217-15` (the positional fallback), `T-217-16` (`SIDEBAR_PIN_KEY`) and `T-217-17` (ledger drift)
were all dispositioned `mitigate` and are now mitigated **by source fences and a mechanical gate**
rather than by care — `T-217-15` and `T-217-16` each driven RED against a planted defect.

## Known Stubs

None.

## Self-Check: PASSED

- `frontend/src/pages/LibraryPage.tsx` — FOUND
- `frontend/src/pages/__tests__/LibraryPage.test.tsx` — FOUND
- `frontend/src/__tests__/library/renameFence.test.ts` — FOUND
- `docs/HOT-FILE-LEDGER.md` § `frontend/src/pages/LibraryPage.tsx` — FOUND
- `.planning/sketches/218-the-library-and-its-tabs/BUILD-CONTRACT.generated.md` header reads
  `195 assertions, 0 failing`, matching the drive's printed count — FOUND
- commit `dbd9b8c0b` — FOUND
- commit `08dcbb6fa` — FOUND

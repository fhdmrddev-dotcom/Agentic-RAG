---
phase: 217-the-library-one-home-for-documents
plan: 11
subsystem: frontend-panel
tags: [library, documents, detail-panel, tables, images, retrieval, xss, dos, LIB-04]

# Dependency graph
requires:
  - phase: 217-02
    provides: "`GET /{id}/tables` and `GET /{id}/images` — owner-only by migration 108"
  - phase: 217-03
    provides: "`GET /{id}/queries` — service-role by classified exception, 100 rows / 30 days"
  - phase: 217-08
    provides: "`DocumentTableRow` / `DocumentImageRow` / `DocumentQueryRow` in `types/index.ts`"
  - phase: 217-10
    provides: "the three client fns on the `@/lib/api` barrel, and the `defaultOpen={false}` lazy-section shape these three copy exactly"
  - "frontend/src/components/panel/CsvTablePreview.tsx (Phase 087 Plan 03) — the scroll container, the two size caps and the Fallback arm this plan extracted"
provides:
  - "`DataTableView` — THE one table renderer in the panel: `overflow-x-auto` container, `MAX_BYTES`/`MAX_ROWS` applied before DOM construction, worded fallback arm. Shared by `CsvTablePreview` and `DocumentTablesSection`"
  - "`DocumentTablesSection` — extracted tables AS TABLES, three distinct empty claims"
  - "`DocumentImagesSection` — image descriptions, and provably no picture element"
  - "`DocumentQueriesSection` — the questions that found the document, grouped with counts, 30-day window labelled, honest arm for a view-sourced search"
  - "the CLOSED eight-section order (D-217-25a), asserted from the rendered DOM"
  - "`DetailSections.tables.test.tsx` — 15 cases"
  - "sketch 218 fence `D5c` INVERTED — it now defends 'tables and images are RENDERED' instead of auditing 'only counts today'"
affects:
  - "217-12 — owns the count-gate pins; this plan adds ONE suite that runs in NEITHER knob"
  - "⚠ THE CHAT SURFACE — `DocumentDetailPanel` reuses `WorkspacePanel`'s sheet, which `ChatLayout` mounts. See the section below."

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "one renderer, two callers: the CSV path keeps its parser and its own caps DECISION (on the raw string, before parsing) and delegates only the rendering — so the shipped suite passing unchanged is the proof the extraction was faithful"
    - "scroll, never shed: a positional column rule is correct for redundant metadata and wrong for the user's own data"
    - "three empty situations, three sentences — the applies-flag predicate mirrors `isStageSkipped`, including its rule that an ABSENT flag is UNKNOWN and never `false`"
    - "a forbidden token asserted by BUILDING it (`['un','defined'].join('')`), so the assertion cannot be satisfied by the literal appearing in the test's own source"

key-files:
  created:
    - frontend/src/components/panel/DataTableView.tsx
    - frontend/src/components/metadata/DocumentTablesSection.tsx
    - frontend/src/components/metadata/DocumentImagesSection.tsx
    - frontend/src/components/metadata/DocumentQueriesSection.tsx
    - frontend/src/components/metadata/__tests__/DetailSections.tables.test.tsx
  modified:
    - frontend/src/components/panel/CsvTablePreview.tsx
    - frontend/src/components/metadata/DocumentDetailPanel.tsx
    - .planning/sketches/218-the-library-and-its-tabs/drive.cjs
    - .planning/sketches/218-the-library-and-its-tabs/BUILD-CONTRACT.generated.md

key-decisions:
  - "The scroll container, NOT the Library list's positional column rule. Shedding a column of a user's own extracted table deletes exactly what they opened the panel to see; the list's hidden columns are redundant metadata reachable elsewhere."
  - "`CsvTablePreview` keeps its caps DECISION (raw string, pre-parse) and imports the NUMBERS. A delegate cap on the parsed cells is strictly weaker, because parsing discards separators and quotes."
  - "The images section draws no picture element AND no placeholder box. `document_images` stores no bytes; a box implying one is coming is a promise about a thing that does not exist."
  - "`Found by`, never `Queries` and never `Retrieval` (D-217-25b) — sketch 218's `SIGNAL_RENAMES` already renames `Most Retrieved` to `Most found`, and a third word for one concept is how a vocabulary stops being one."
  - "Queries are GROUPED with a repeat count. A list without frequency decides nothing: four rows of the same question hide that it IS the question."
  - "An ABSENT `tables_stage_applies` gets the plain sentence, not the pipeline claim. It is server-derived, does not ride Realtime, and unknown must not be rendered as known."

patterns-established:
  - "A fence broken BY SUCCEEDING is INVERTED, never deleted, with the original claim preserved verbatim above it — now three times in one phase (D2 at 217-07, D4 at 217-10, D5c here)."
  - "A control that does not provably remove the needle proves nothing: renaming with a SUFFIX leaves the substring and the control passes silently."

requirements-completed: [LIB-04]

# Metrics
metrics:
  duration: "~50 min"
  completed: "2026-08-29"
  tasks: 3
  commits: 4
  files_created: 5
  files_modified: 4
---

# Phase 217 Plan 11: Tables as tables, image descriptions, and the questions that found the document — Summary

**`document_tables`' real `headers` and `rows` jsonb and `document_images`' written descriptions are readable in the browser for the first time — through ONE table renderer extracted from the shipped CSV preview so the caps, the scroll container and the empty arm are not forked, with the last 30 days of searches grouped beside them, and the eight-section panel order closed and asserted from the rendered DOM.**

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Extract the shared table renderer | `e0e8ab774` | `panel/DataTableView.tsx`, `panel/CsvTablePreview.tsx` |
| 2 | Tables, Images and Found by — three lazy mounts | `a7733dea9` | `metadata/Document{Tables,Images,Queries}Section.tsx`, `metadata/DocumentDetailPanel.tsx` |
| 3 | The wide-table, hostile-content and shared-folder suite | `d0e2cd6dc` | `metadata/__tests__/DetailSections.tables.test.tsx` |
| — | The `D5c` fence inversion (authorised exception) | `8af7b8635` | `sketches/218/drive.cjs`, `sketches/218/BUILD-CONTRACT.generated.md` |

## The extraction, measured

| | before | after |
|---|---|---|
| `CsvTablePreview.test.tsx` cases | **8** | **8** |
| `overflow-x-auto` in `CsvTablePreview.tsx` | 1 | **0** (it delegates) |
| `overflow-x-auto` in `DataTableView.tsx` | — | **1** |
| `CsvTablePreview.tsx` lines | 176 | **134** |

**The 8 → 8 is the whole proof.** The shipped suite covers the header/body counts, the quoted-comma parse, the plain-text rendering, both fallback sentences, the `onDownload` affordance and two axe states — and it passes unmodified. Its public props (`{ content, onDownload }`) are untouched.

⚠ **`CsvTablePreview` keeps its caps DECISION and imports only the numbers.** Its cap is taken on the RAW STRING before parsing; `DataTableView`'s is taken on the parsed cells. The first is strictly stronger (parsing discards separators and quotes, so the cell total is always ≤ the string length), so the delegate cap can never fire for the CSV path and no behaviour moved. Getting this backwards — deleting the pre-parse check and relying on the delegate — would have weakened a DoS guard while every test stayed green.

## What the sections say when there is nothing

Recorded verbatim so manual row **M-5** can be driven against them.

| Section | situation | sentence |
|---|---|---|
| Tables | flag `false` + count `0` — the stage never runs for this file type | `This file type has no tables` |
| Tables | flag `true` — the stage ran and produced nothing | `No tables were extracted` |
| Tables | flag ABSENT — unknown | `No tables` |
| Images | flag `false` + count `0` | `This file type has no images` |
| Images | flag `true` | `No images were described` |
| Images | flag ABSENT | `No images` |
| Found by | no search in the window | `No searches have returned this document in the last 30 days` |
| Found by | a row with no `query_text`, `via: "view"` | `A saved view returned it` |
| Found by | a row with no `query_text`, `via: "filter"` | `A filter returned it` |
| Found by | a row with no `query_text` and no `via` | `Returned without a recorded question` |

The three tables sentences are asserted to be **three distinct strings** by a case that renders all three documents and checks `new Set(seen).size === 3` — so a future edit collapsing two of them reds rather than quietly printing one claim for three facts (T-217-45).

## ⚠ Which gate knob the new suite is missing from: BOTH — again

`grep -n '"src/components/metadata'` over `scripts/vitest-count-gate.cjs` returns **one line** (`:4001`) — the file-level `DocumentDetailPanel.images.test.tsx` entry SEED-227 added. `grep -c "DetailSections"` returns **0**.

So `DetailSections.tables.test.tsx` (15 cases) **runs in neither knob**: TARGETS will not execute it, and BASELINE would not notice if its 15 cases became 0. That is the same blind spot `DetailSections.lazy.test.tsx` landed in at 217-10, now two suites deep. **Plan 12 owns the pins** and this plan deliberately did not edit `vitest-count-gate.cjs`.

⚠ **`src/components/panel/__tests__/CsvTablePreview.test.tsx` is ALSO in neither knob**, and that matters more than usual here: it is the suite whose unchanged pass is this plan's proof that the extraction was faithful, and the gate has never executed it. Two comments inside the gate (`:3387`, `:3716`) explicitly RESERVE it BY NAME for "a later phase that wants CsvTablePreview". This plan is that phase in every sense except the pin. Plan 12's decision list:

| suite | cases | TARGETS | BASELINE |
|---|---|---|---|
| `src/components/metadata/__tests__/DetailSections.tables.test.tsx` | **15** | ⛔ absent | ⛔ absent |
| `src/components/metadata/__tests__/DetailSections.lazy.test.tsx` | 14 | ⛔ absent | ⛔ absent |
| `src/components/panel/__tests__/CsvTablePreview.test.tsx` | **8** | ⛔ absent (reserved by name) | ⛔ absent |
| `src/components/metadata/DocumentDetailPanel.images.test.tsx` | 3 | ✅ `:4001` | ✅ pinned `3` |

## The driven REDs — both required, both observed, both with a control proven to fire

### 1. The eight-section order (the plan's explicit non-vacuity clause)

Built the wrong variant programmatically — the three new mounts moved from directly-after-Chunks to APPENDED after Classification, the exact build the plan names:

```
× ⭐ reads the FULL order from the rendered DOM, not from source order
AssertionError: expected [ 'Details', 'Text', 'Chunks', …(5) ] to deeply equal [ 'Details', 'Text', 'Chunks', …(5) ]
Tests  1 failed | 14 passed (15)
```

**Exactly one case red** — the fence is targeted at the order and nothing else incidentally depends on it. The panel was restored and verified **content-identical** (`d806f2b2…` both sides; see the line-ending note below).

### 2. The inverted `D5c` — and the control I nearly got wrong

The orchestrator predicted this fence would break by succeeding, and it was right in substance but not in mechanism: **`D5c` as written would NOT have gone red.** It asserted `/table_count/.test(DocumentList.tsx)`, which is still true — the document list still shows counts. What went false was its **CLAIM** (*"the frontend renders only COUNTS of them today"*), which is now a sentence in a passing assertion's title describing a world that no longer exists. **That is worse than a red fence, not better:** a green assertion whose title is false is a lie the driver reports 200 times a run.

So the inversion was not a repair, it was a correction of a fence that measured the **symptom** (a count exists in the list) rather than the **property** (the content is buried). It now asserts four things and names which one broke:

```js
/<DocumentTablesSection/.test(D5C_PANEL)   // the panel mounts the tables section
/<DocumentImagesSection/.test(D5C_PANEL)   // …and the images section
/<DataTableView/.test(D5C_TABLES)          // …through the SHARED renderer, not a fork
/row\.description/.test(D5C_IMAGES)        // …and a written description is rendered
```

`D5c-b` was split off to keep the original's *true* half (the list still shows the count) — a number in the list and the content in the panel are different jobs and are not in tension.

**The control, and the trap the orchestrator named.** `feMentions` and these regexes use substring matching, so renaming `<DocumentTablesSection` → `<DocumentTablesSectionXX` would leave the needle present and the control would silently fail to fire. Renamed to `<TblSecZZ` instead and **measured the needle count before and after: 1 → 0.** Only then:

```
199 passed · 1 failed · 200 assertions
✗ D5c · ⭐ the frontend RENDERS the tables and the image descriptions — not merely their counts
    the panel does not mount the tables section
```

One assertion red, naming the exact cause. Restored content-identical; drive back to **200 passed · 0 failed**. `BUILD-CONTRACT.generated.md` regenerated with `node drive.cjs --emit` (199 → 200 assertions), never hand-edited. **No other fence reded at any point** — `grep` over `drive.cjs` confirms nothing else reads `DocumentDetailPanel.tsx` or either new section, so the exception stayed scoped to `D5c` and its comment.

⚠ **A line-ending caveat worth not rediscovering.** `md5sum -c` FAILED on both restores and both files were nevertheless correct: `git checkout --` restores through `core.autocrlf` (CRLF), while the file I wrote was LF. `git status --short` was empty and `tr -d '\r' | md5sum` matched exactly. **On Windows, verify a restore with `git status` or a normalised hash — a raw `md5sum -c` reports a false difference and would send the next executor hunting a phantom.**

## ⚠ What the CHAT surface inherits — the panel is now EIGHT sections tall

`DocumentDetailPanel` is a **cross-surface shell**: it reuses `WorkspacePanel`'s `Sheet`, which `ChatLayout` mounts, so anything altering the shell's shape lands on chat too. What this plan actually did to it:

- **Three additional `PanelSection` children** inside the existing `overflow-y-auto` sections column, and **three lines of `useState`**. The header, the `Sheet`/mobile bottom-sheet branch, the 430px track (fixed by the HOST grid, not this file), the focus management and the metadata section are untouched.
- **`git diff -U0` over the file shows NOT ONE `-` line.** Additions only — so the three shipped mounts moved down without any prop of theirs changing, which is the D-217-25a fence exactly (*a relocation alters no prop*).
- **Nothing new fetches on mount.** The chat surface's cost of opening this panel is unchanged at one request; a case asserts `listDocumentTables` / `listDocumentImages` / `listDocumentQueries` are each called **0** times before their accordion is clicked, with the metadata fetch as the non-vacuity control.
- **First-paint height grows by three 44px accordion heads and nothing else** (all three are collapsed by default).

**What is owed:** 217-10 already owes a **G-4 chat-surface row** on a panel that had gone from three sections to five. It is now **EIGHT**, and this plan adds to that same row rather than opening a second one. Scroll behaviour inside the chat sheet on a small viewport, with eight collapsed heads plus an opened section containing a horizontally-scrolling table, is a lived-experience question jsdom cannot answer — and **a nested horizontal scroller inside a vertical sheet on touch is exactly the composition that misbehaves.**

## Ledger triples, re-derived rather than copied

| file | commits / phases / lines | G-5 |
|---|---|---|
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` | **9 / 6 / 496** | ⚠ **FIRES** |
| `frontend/src/components/panel/CsvTablePreview.tsx` | **3 / 3 / 134** | ⚠ **FIRES — EXACTLY AT THRESHOLD** |
| `frontend/src/components/panel/DataTableView.tsx` | 1 / 1 / 148 | no (1 phase) |
| `frontend/src/components/metadata/DocumentTablesSection.tsx` | 1 / 1 / 155 | no (1 phase) |
| `frontend/src/components/metadata/DocumentImagesSection.tsx` | 1 / 1 / 136 | no (1 phase) |
| `frontend/src/components/metadata/DocumentQueriesSection.tsx` | 1 / 1 / 182 | no (1 phase) |

**`DocumentDetailPanel.tsx` G-5 fires and is honoured by construction** — three additive children, three lines of state, zero branches touched, zero shipped props changed. The CLAUDE.md row reads `6 / 5 / 405`, measured at the phase start and now stale by three commits and one phase (217-10 re-derived it to `8 / 6 / 453`; it is `9 / 6 / 496` at my HEAD).

⚠ **`frontend/src/components/panel/CsvTablePreview.tsx` crossed the G-5 threshold IN THIS COMMIT and has never had a ledger row** — 087, 088 and now 217. It is invisible to its own guardrail, exactly like the eleven files Phase 196 found. **The good news is that the seam it was owed is the one this plan TOOK**: the extraction of `DataTableView` is precisely the refactor G-5 would have demanded, and it happened to be the plan's Task 1. Both rows (and their `docs/HOT-FILE-LEDGER.md` sections, same-commit sync rule) are the **phase close's** to add — this plan does not edit CLAUDE.md.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 — Missing critical functionality] `DataTableView` needed a byte cap of its own, not just the row cap**
- **Found during:** Task 1, writing the caps
- **Issue:** The plan names both caps. `MAX_ROWS` transfers directly, but `MAX_BYTES` was measured on the CSV *string*, and `DataTableView` never sees a string — a 500-row table of 100 KB cells would pass `MAX_ROWS` and mount half a megabyte of DOM.
- **Fix:** a single-pass byte estimate over the cells about to be mounted, applied before DOM construction, with the same worded arm. `CsvTablePreview` keeps its own stronger pre-parse check.
- **Files:** `DataTableView.tsx` · **Commit:** `e0e8ab774`

### ⚠ THE MENTION-VS-USE TRAP FIRED TWICE MORE — the 217-10 finding is not a one-off, it is the default

217-10 recorded that *"a fence that reads a file-wide literal cannot distinguish a use from a mention"*, in both directions, and warned the next plan. **I then hit it twice in the same plan, having read the warning:**

1. **`grep -n "nth-child" DataTableView.tsx` returned a line** — my own docblock sentence explaining that the positional column rule is deliberately NOT used here. The code was already correct.
2. **The task-2 source gate failed with `the images section drew a thing that does not exist`** — on my docblock's *"no thumbnail and no placeholder box"*. The code draws no picture element at all.

Both were de-spelled; **neither fence was weakened.** The general shape is now measured four times across two plans, so it is worth stating as a rule rather than an anecdote: **prose inside a fenced file must avoid the fenced literal, or the fence must be scoped to the code region — and for a leaf component the second is more work than it is worth.** The test suite applies the same discipline in the one place it could not avoid the token: the "never renders the absent-value word" case BUILDS the string (`["un","defined"].join("")`) so the assertion cannot be satisfied by the literal appearing in the test's own source.

## Verification

| Check | Result |
|---|---|
| `vitest run DetailSections.tables.test.tsx` | **15 passed** (plan asks ≥ 10) |
| `vitest run CsvTablePreview.test.tsx` | **8 passed** — before AND after the extraction |
| `vitest run DetailSections.lazy.test.tsx` + `DocumentDetailPanel.images.test.tsx` | **17 passed** — unchanged by three more mounts |
| all three plan-named suites, `--maxWorkers=2` | **3 files / 37 passed** |
| `tsc --noEmit -p tsconfig.app.json` | **33** errors — exactly the inherited baseline, 0 from any file this plan touched |
| Task 2 automated source gate (plan's, verbatim) | `task 2 source gate OK` |
| `grep -c "<PanelSection"` on the panel | **8** |
| `grep -c "defaultOpen={false}"` on the panel | **5** (five mounts; no prose inflation) |
| `grep -nE 'title="(Details\|Queries\|Retrieval)"'` on the panel | **nothing** — D-217-25b holds |
| `git diff -U0` on the panel | **no `-` line** — additions only |
| `grep -nE "<img\|thumbnail\|image_url"` on the images section | **nothing** |
| `grep -n "undefined"` on the queries section | **nothing** |
| `grep -n "nth-child"` on `DataTableView.tsx` | **nothing** |
| sketch drive `node drive.cjs` | **200 passed · 0 failed** (was 199; `D5c` split into `D5c` + `D5c-b`) |
| `git status --short` | **clean** — no untracked files |

**Not run, deliberately:** the full `vitest-count-gate.cjs`. Its pins are plan 12's to move, and the inherited baseline records the gate as nondeterministic (`failed 4` then `failed 0` minutes apart on a byte-identical tree). The four in-scope suites above were run explicitly and are deterministic — the pairing CLAUDE.md's cap correction (b) asks for. **The cap was neither adjusted nor needed:** `GSD_VITEST_MAX_WORKERS=2` on every invocation, nothing red that I did not plant.

## Known stubs

None. All three sections call real shipped routes and render real data through four honest arms each. No placeholder, no mock data, no "coming soon".

## Threat flags

None. No new network endpoint, no auth path, no schema change — this plan is a read-only consumer of three routes that shipped in 217-02/03.

| Threat | Disposition | Where it is asserted |
|---|---|---|
| T-217-42 (XSS in cells / descriptions / query text) | mitigated | two render cases proving an `<img src=x onerror=…>` payload appears as literal text with `container.querySelector("img") === null`, plus a grep fence over all three sections |
| T-217-43 (DoS on unbounded `rows` jsonb) | mitigated | caps before DOM construction; a case renders 2001 rows and asserts the worded arm **and** `querySelectorAll("tr").length === 0` — so a render-then-truncate implementation would fail |
| T-217-44 (the shared-folder empty arm) | accepted, and PINNED | a case asserts the calm sentence, asserts no permission language, and names migrations `110:215-223` / `108:180-189` in its comment so a future reader does not file it as a defect |
| T-217-45 (one sentence for three situations) | mitigated | the three-distinct-strings case |
| T-217-46 (prompt-injection-style vision text) | accepted | rendered inert, to its owner only; nothing on this surface feeds it back to a model |

## Owed

- **Manual row M-5** — the empty arms read against a real document of each kind. Ten sentences are tabulated above so the row can be driven rather than improvised.
- **Manual row M-6** — the RLS asymmetry as EXPERIENCED (two accounts, one shared folder). A test asserts the empty result; only a person can say whether the screen is confusing.
- **G-4 row G4-5** — read a real extracted table in the real 430px panel. **This is the ONLY thing that proves the scroll**: jsdom's `getBoundingClientRect` is always zero and no stylesheet is applied, so no test in this repo can assert horizontal scrollability. The suite asserts the container class (the mechanism) and says so in a comment.
- **The G-4 chat-surface row** on the now-eight-section panel (see above) — 217-10 opened it, this plan enlarges it.
- **Plan 12** — the pin table above.
- **The phase close** — two ledger rows: `DocumentDetailPanel.tsx` re-derived to `9 / 6 / 496`, and a NEW row for `CsvTablePreview.tsx` at `3 / 3 / 134`, which crossed the G-5 threshold in this commit having never been listed.

## Self-Check: PASSED

All 9 files asserted present on disk (5 created, 4 modified, plus this SUMMARY). All 4 commits
resolve in `git log --all`: `e0e8ab774`, `a7733dea9`, `d0e2cd6dc`, `8af7b8635`. No file claimed in
`key-files` is missing; no commit hash quoted in this document is unresolvable.

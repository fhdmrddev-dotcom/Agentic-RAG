---
phase: 217-the-library-one-home-for-documents
plan: 12
subsystem: verification-infrastructure
tags: [count-gate, two-knob, seam-audit, hot-file-ledger, uat, phase-close]
requires:
  - "217-01..217-11 — all eleven plans merged; the base carries 11 SUMMARY files"
provides:
  - "every suite Phase 217 wrote or converted is in BOTH count-gate knobs"
  - "four pre-existing doc-space orphan suites adopted; a bare-name collision resolved"
  - "the mechanical seam audit — 19 symbols, producer + every consumer, owner-checked"
  - "217-VALIDATION.md signed off with an honest OWED section"
  - "217-UAT.md — 16 rows, every one recorded"
  - "four owed hot-file ledger rows, synced same-commit"
affects:
  - "scripts/vitest-count-gate.cjs — 14 BASELINE pins + 14 TARGETS paths + 1 re-baseline"
  - "CLAUDE.md + docs/HOT-FILE-LEDGER.md — 2 rows added, 2 corrected"
tech-stack:
  added: []
  patterns:
    - "TARGETS decides what RUNS; BASELINE decides what is GUARDED — checked per file, never inferred from a sibling"
    - "every pin read from the gate's own printed `— N new` column, never hand-derived"
    - "the adoption list derived from `git diff --diff-filter=A`, never from memory"
key-files:
  created:
    - ".planning/phases/217-the-library-one-home-for-documents/217-UAT.md"
  modified:
    - "scripts/vitest-count-gate.cjs"
    - "frontend/src/__tests__/components/DocumentList.moveToFolder.test.tsx (renamed)"
    - ".planning/phases/217-the-library-one-home-for-documents/217-VALIDATION.md"
    - ".planning/phases/217-the-library-one-home-for-documents/deferred-items.md"
    - "CLAUDE.md"
    - "docs/HOT-FILE-LEDGER.md"
decisions:
  - "D-217-01 — the gate knobs land in ONE closing plan, not in fourteen creating commits; a BASELINE key naming a nonexistent file makes the gate ERROR (exit 2), and per-plan pinning would have forced the phase serial. The cost — every suite unguarded for the phase's length — is STATED, not hidden"
  - "the DocumentList.test.tsx bare-name collision is resolved by rename, not by excluding one; the two suites are COMPLEMENTS (Phase 114 move-to-folder / Phase 118 classification chip)"
  - "CsvTablePreview.test.tsx claims the panel-directory reservation on the ground Phase 195 used: 217 CONVERTS the file it guards"
  - "the phase closes with 16 G-4 / manual rows OWED, as a stated DECISION — G4-4 named first"
metrics:
  duration: "~75 min"
  completed: 2026-08-29
  tasks_completed: 2
  tasks_blocked: 1
---

# Phase 217 Plan 12: Closing the Library — Both Gate Knobs, the Seam Audit, the Owed Rows

**One-liner:** The document space entered the count gate — fourteen suites adopted into both knobs
with a `+182` that decomposes to zero residual, a mechanical seam audit that found one real unowned
consumer and five false positives, and a UAT scoreboard that says plainly what did not run.

---

## The count gate: before, after, and every `+n` attributed

Three runs, in order, `GSD_VITEST_MAX_WORKERS=2` from the repo root:

| # | State | verdict line |
|---|---|---|
| 1 | **BEFORE** any edit | `total 6482 · failed 0 · pinned total 5746` — `139/139` |
| 2 | after the **TARGETS** block (RUNS half only) | `total 6664 · failed 0 · pinned total 5746` — `139/139` |
| 3 | after the **BASELINE** pins (GUARDED half) | `total 6664 · failed 0 · pinned total 5930` — **`153/153`** |

```
  total                                      5930    6664    +734
  total 6664  ·  failed 0  ·  pinned total 5930
count gate OK — 153/153 pinned files present, no per-file decrease, 0 failing.
```

⭐ **Run 3's grand total did not move.** That is the cleanest available demonstration that TARGETS and
BASELINE are different knobs: adopting a path made 182 cases *execute*; pinning made them *guarded*
and added nothing.

**The `+182` decomposes with ZERO residual** across the fourteen newly-executed suites — every figure
read from the gate's own printed `— N new` column, none hand-derived:

| suite | new | why it exists |
|---|---|---|
| `IngestionStrip.test.tsx` | 25 | 217-08 — six segments in backend write order |
| `librarySelection.test.ts` | 25 | 217-05 — the reducer, exhaustively |
| `acceptFormats.test.ts` | 19 | 217-07 — one constant drives `accept` and the list |
| `renameFence.test.ts` | 15 | 217-04 — `ActiveView` / `ChatLayout:879` source fences |
| `DetailSections.tables.test.tsx` | 15 | 217-11 |
| `DetailSections.lazy.test.tsx` | 14 | 217-10 — zero calls before expand |
| `tabsContrast.test.ts` | 14 | 217-06 — token fence, both themes |
| `LibraryPage.test.tsx` | 12 | 217-04 / 217-09 |
| `ViewsGroup.test.tsx` | 10 | **orphan adopted** |
| `CsvTablePreview.test.tsx` | 8 | **reservation claimed** — 217-11 converts the file |
| `DocumentList.test.tsx` | 7 | **orphan adopted** (Phase 118 chip) |
| `DocumentDetailPanel.a11y.test.tsx` | 7 | **orphan adopted** |
| `useDocuments.test.ts` | 7 | **orphan adopted** |
| `DocumentList.moveToFolder.test.tsx` | 4 | **orphan adopted** (Phase 114 move-to-folder) |
| | **182** | = `6664 − 6482` exactly |

Pinned total `5746 → 5930` = `+182` **+ 2** for the `apiBarrel.test.ts` re-baseline `3 → 5`
(217-10's two new `it` blocks — edited at its ORIGINAL line, because a second entry for the same key
is a silent LAST-WINS override that reads as two facts and behaves as one).

⚠ **Seven other pinned files also grew on the BEFORE run and NONE was re-pinned** (`apiRunFields`
+13, `WorkflowSoul` +10, `CanvasToolbar` +4, `BuilderSaveRegion` +3, `McpToolPicker.reachability`
+2, `WorkflowBuilderPage` +1, `ConnectionGrantsList` +1). They arrived with other work merged into
this window. Re-baselining another phase's file inside this commit would make 217 the owner of a
delta it did not cause.

### The scripted two-knob completeness check

The acceptance criterion required the comparison be **scripted, not eyeballed**. The script derives
the created-suite list from `git diff --name-only --diff-filter=A 9a3808697..HEAD` rather than from
memory (Phase 214 left six suites unpinned by doing this from memory), parses the BASELINE object
literal and the TARGETS array out of the source, and resolves each suite against **both** a file
entry and a recursing directory entry. Output verbatim:

```
OK    RUNS=dir   GUARDED=yes  src/components/workflows/cronPlain.test.ts
OK    RUNS=file  GUARDED=yes  src/__tests__/components/DocumentList.moveToFolder.test.tsx
OK    RUNS=file  GUARDED=yes  src/__tests__/hooks/useDocuments.test.ts
OK    RUNS=file  GUARDED=yes  src/__tests__/library/renameFence.test.ts
OK    RUNS=file  GUARDED=yes  src/components/ingestion/DocumentList.test.tsx
OK    RUNS=file  GUARDED=yes  src/components/ingestion/ViewsGroup.test.tsx
OK    RUNS=file  GUARDED=yes  src/components/ingestion/__tests__/IngestionStrip.test.tsx
OK    RUNS=file  GUARDED=yes  src/components/ingestion/__tests__/acceptFormats.test.ts
OK    RUNS=file  GUARDED=yes  src/components/metadata/DocumentDetailPanel.a11y.test.tsx
OK    RUNS=file  GUARDED=yes  src/components/metadata/__tests__/DetailSections.lazy.test.tsx
OK    RUNS=file  GUARDED=yes  src/components/metadata/__tests__/DetailSections.tables.test.tsx
OK    RUNS=file  GUARDED=yes  src/components/panel/__tests__/CsvTablePreview.test.tsx
OK    RUNS=file  GUARDED=yes  src/components/ui/__tests__/tabsContrast.test.ts
OK    RUNS=file  GUARDED=yes  src/pages/__tests__/LibraryPage.test.tsx
OK    RUNS=file  GUARDED=yes  src/pages/__tests__/librarySelection.test.ts

suites checked: 15  (created 9 + adopted 6)
duplicate BASELINE bare names: none
BASELINE keys: 153

TWO-KNOB CHECK OK — every suite RUNS and is GUARDED; no duplicate bare name.
```

⚠ **`cronPlain.test.ts` is in the created-file diff but is NOT Phase 217's** — it arrived with
`BUG-260829-01` (`f2240eaec`), lives under the `src/components/workflows` **directory** entry, and was
already pinned at 15. The script reports it `RUNS=dir` rather than dropping it, which is how a
mechanically-derived list is supposed to behave: it surfaces the thing you did not expect instead of
filtering it away.

### The bare-name collision — resolved, not worked around

`bareName()` makes the BASELINE key space **global**, and `DocumentList.test.tsx` existed at two
paths. **Both were read before either was touched**, and they are complements, not duplicates:

| path | subject |
|---|---|
| `src/components/ingestion/DocumentList.test.tsx` | Phase 118 Plan 05 — the classification chip (`→ folder ✓ ✕`) |
| `src/__tests__/components/DocumentList.test.tsx` | Phase 114 Plan 04 — the **Move-to-folder** row action |

So neither is excluded. The latter was `git mv`d to **`DocumentList.moveToFolder.test.tsx`** (git
records it `R … (100%)`, history follows) and both are adopted. No code, config or JSON referenced
either filename — verified by grep before the rename.

---

## The mechanical seam audit

Phase 214 shipped **five blockers** whose planted tests all PASSED, because each side's suite supplied
the other side's half. This ran the instrument `STATE.md` names: grep every introduced symbol for its
producer and every consumer, and check each resulting file against the union of the eleven plans'
`files_modified` (**57 paths**, `217-12`'s own four excluded — this plan ships no product code).

**19 symbols audited.** Full table in `217-VALIDATION.md` § *The mechanical seam audit*.

### ⭐ The one real finding

**`frontend/src/components/ingestion/DocumentList.tsx:422` consumes `doc.ingestion_step` and belongs
to no plan's `files_modified`.**

```tsx
<DocumentStatusBadge status={doc.status} ingestionStep={doc.ingestion_step} />
```

It is a **deliberate no-change, and both halves of that are measured**: the file is byte-unchanged by
this phase (`git diff --stat 9a3808697..HEAD` is empty; it last moved at Phase 155), and
`ingestion_step` was already on the frontend `Document` type before 217 — the phase *edited its
docblock*, it did not add the field.

⭐ **But the seam is real, and it is the more interesting half.** `217-01` (D-217-10) made the backend
**serialize** `ingestion_step` on `DocumentResponse`. So this pre-existing consumer had been receiving
`undefined` from `GET /documents` and now receives a value. **A consumer whose input changed while its
own bytes did not is exactly the Phase 214 shape** — and here the audit caught it rather than a user.

⛔ **Its render path is guarded by a suite the gate still does not execute.**
`DocumentStatusBadge.test.tsx` is in neither knob, and `217-12` deliberately declined it (217 modifies
neither `DocumentStatusBadge.tsx` nor `FilterBar.tsx`; adopting them would make this phase the owner
of rot it did not cause — the decline is written into the gate script, never left silent). **This is
independently why `M-1` and `G4-4` are the first owed rows.**

### ⚠ The mention-vs-use trap fired a FIFTH time — inside the audit's own first pass

The inherited findings warned that a file-wide grep cannot distinguish a use from a mention, and that
it had already fired four times in this phase. It fired again, on me:

| reported as an unowned `extractor` **USE** | actually |
|---|---|
| `backend/app/services/extraction_service.py` | `extractor_name`, `get_extractor`, and prose |
| `backend/app/api/document_governance.py:288` | a docstring bullet: *"the extractor left them blank"* |
| `scripts/calibrate_confidence.py:411` | a comment: *"Verifies per-extractor lineage"* |

The real producer of the column is `documents.py:2507` + `multimodal_service.py:553` — both owned.
**Recorded rather than quietly dropped**, because an audit that silently discards its own false
positives has no way to show it was discriminating.

### Two more false positives, each a real trap worth naming

- ⚠ **A genuine NAME COLLISION.** `frontend/src/components/workflows/library/libraryFilter.ts:49`
  exports its **own** `LibrarySelection` interface (the workflow-library filter, Phase 192.x),
  entirely unrelated to `pages/librarySelection.ts:105`'s tab/folder union. Neither imports the
  other. Named so the next grep does not treat them as one symbol.
- `frontend/src/lib/api/threads.ts:1063` matches `/content` — it is
  `GET /threads/{tid}/workspace/files/{id}/content`, a different route.

---

## The VALIDATION.md defect `217-03` could not fix

`217-VALIDATION.md:95` pointed the `/queries` owner-gate row at
`tests/test_217_document_detail_routes.py`. The assertion actually lives in
**`tests/test_217_document_queries.py:82`** (`test_user_id_filter_is_applied_in_the_sql`). The row was
**satisfied by a different filename than it named** — the most dangerous shape of documentation
defect, because the row reads green and the auditor stops. `217-03` could not correct it (a sibling
plan owned the adjacent rows). Corrected here, marked `⚠ CORRECTED` rather than silently rewritten.

The whole per-task map was rebuilt with **Plan** and **Verdict** columns (the original had five
columns and no way to record either), every verdict from an executed command.

---

## Four owed hot-file ledger rows — two ABSENT, two STALE

Authorised scope extension: plan 04 was the only plan owning these files, and these are real G-5
obligations with no other home. All four triples re-derived with the CLAUDE.md recipe (six-digit
dated-quick-task buckets subtracted). **Rows and detail sections in the SAME commit** (the sync rule).

| file | measured | state before | verdict |
|---|---|---|---|
| `frontend/src/components/ui/tabs.tsx` | **3 / 3 / 78** | **NO ROW AT ALL** | crossed the threshold in `217-06`'s own commit (was `2 / 2 / 53`) |
| `frontend/src/components/panel/CsvTablePreview.tsx` | **3 / 3 / 134** | **NO ROW AT ALL** | crossed in `217-11`'s own commit; invisible across phases 087, 088, 217 |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` | **9 / 6 / 496** | row read `6 / 5 / 405` | **STALE** — `+3` commits, `+1` phase, `+91 L` in ONE DAY |
| `frontend/src/pages/LibraryPage.tsx` | **28 / 10 / 724** | row read `27 / 10 / 603` | the named seam is now **TAKEN** (217-09) |

⭐ **`DocumentDetailPanel.tsx` has now drifted THREE times and all three figures are kept** — `393`
(BUS-026) → `405` (2026-08-28) → `496` (this close). *A row that is present and WRONG answers the
auditor with a number and stops the audit, which is worse than an absent row.* That instruction has
now been vindicated three times on this one file.

⭐ **`ui/tabs.tsx` has THREE mounts and only one was in scope** — the Library's tab bar is what 217
built; **Settings** and **Library Health** are the other two and neither was touched. That is why
`G4-8` exists as its own row, and why it is owed rather than assumed.

⭐ **`CsvTablePreview.test.tsx`'s count is UNCHANGED at 8 across the extraction** — `217-11` cut
`DataTableView.tsx` (148 L) out of it, net `−67 L` here. **An unmoved number is the extraction's own
faithfulness proof:** behaviour preserved, ownership moved.

⚠ **`LibraryPage.tsx` needs `git log --follow`.** Without it the re-derive reads `1`, having measured
the *rename* rather than the file.

`node scripts/check-claude-md-size.cjs` → exit 0, **102,252** chars (68.2%). The file got *smaller*:
the two corrected disposition cells are shorter than the originals, more than offsetting two new rows.

---

## Verification — every command executed at this commit

| Gate | Result |
|---|---|
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | ✅ `count gate OK` — **153/153**, total **6664**, pinned **5930**, **0 failing**, no per-file decrease |
| `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` | ✅ **200 passed · 0 failed · 200 assertions** |
| `pytest tests/test_217_*.py -q` (3 files) | ✅ **40 passed** |
| `pytest tests/unit -q` | ✅ **68 failed / 3110 passed / 2 xfailed / 2 xpassed** — **exactly** the inherited baseline, zero new |
| `npx tsc -p tsconfig.app.json --noEmit` | ✅ **33** errors — **exactly** the re-derived baseline, zero new |
| `node scripts/check-claude-md-size.cjs` | ✅ exit 0 |
| `bash scripts/check-deploy-drift.sh` | ✅ `RESULT: PASS` (2 pre-existing non-blocking WARNs, neither introduced here) |

⚠ **The gate went green on the FIRST run of all three invocations**, and SEED-171's triage procedure
was never entered. **Recorded as an observation, never as proof of innocence** — one green sample of a
flaky suite proves nothing, and the cap was neither adjusted nor needed at `2`.

⚠ **The count-gate figures in `217-VALIDATION.md`'s header (`6438 / 5710 / 136`, 2026-08-28) are ONE
DAY OLD and already stale** — the seventh rot. Re-derived here rather than quoted. **A growing number
is the gate WORKING**; its contract is *no per-file DECREASE* and *zero failing*, never a fixed total.

---

## Deviations from Plan

**1. [Rule 2 — missing critical work] The four owed hot-file ledger rows**

Named in the dispatch as an AUTHORISED scope extension outside `files_modified`; taken because they
are real G-5 obligations with no other home. Committed `e9edc7324`.

**2. [Rule 2] `deferred-items.md` extended with four close-time deferrals, each carrying a re-open
trigger**

Not in `files_modified`. Taken because *a deferral with no re-open trigger is a deletion that looks
like a decision*, and three of the four (the twelve comment-only `IngestionPage` references, the
`.xls` backend defect, the three still-unadopted doc-space suites) would otherwise have had no home
at all once this worktree was removed.

**3. [scope decision — DECLINED, with a specific reason] The twelve comment-only references were NOT
swept**

The dispatch offered "sweep if cheap; otherwise record with a re-open trigger". Declined, and the
reason is specific rather than caution: two of the twelve sit in files where a **comment is
load-bearing to a fence** — `types/index.ts` carries a docblock `217-08` deliberately wrote to avoid
spelling `full_markdown`, because sketch fence `D4` uses a **substring `includes()`** and a mention in
a comment reds it. This phase has watched that trap fire five times. A cosmetic sweep across eleven
files is exactly the shape of edit that trips it, and it would land in the closing commit with no wave
left to catch it. Recorded with a re-open trigger instead.

---

## ⛔ Owed at close — a DECISION, not a claim that everything ran

Every automated layer is green. **`217-UAT.md` was created with 16 rows, every one `⛔ OWED` with a
named reason** — never omitted, never reported as passing. Driving them needs a running app, a real
browser and a human eye; this executor has none of the three.

⭐ **`G4-4` is named to be driven FIRST** — upload a large PDF and press F5 while it is still
processing. It is the **only** live catch for the D-217-10 defect, because a component test supplies
whatever shape its author chose and therefore passes before AND after the fix. The seam audit landed
independently on the same row.

Two rows were **ADDED** at close that were not in the original G-4 list:

- **a CHAT-SURFACE row** — `DocumentDetailPanel` is a cross-surface shell reusing `WorkspacePanel`'s
  sheet, so this phase's five new sections land on **chat**, and chat UAT was never run.
- **a strip-labels row** — `217-08` recorded a real divergence from the drawn sketch: the segment
  labels are `title` / `aria-label` / `sr-only`, **not visible text** (the sketch's short words would
  have been a forbidden seventh vocabulary). jsdom cannot say whether a wordless six-segment strip
  reads as informative or decorative.

The SC#10 4-axis rule stays **RULED NOT APPLICABLE** with its recorded reasoning — no provider call,
no model routing, nothing in the agent loop or the SSE path, no new reader of `MODEL_CAPABILITIES`.
⛔ Not a provider roster manufactured, and not the ruling quietly dropped.

---

## Task 3 — the blocking G-4 checkpoint was NOT auto-approved

`217-12-PLAN.md` is `autonomous: false` and task 3 is `type="checkpoint:human-verify"
gate="blocking"`. It was **not** auto-approved. Every one of its ten rows requires observing a running
application; auto-approving would have meant inventing operator observations, which the dispatch
forbids explicitly. The task's own acceptance criteria provide the honest path — *"an undriven row
appears as `⛔ OWED` with its reason, never omitted and never reported as passing"* — and that is what
`217-UAT.md` records. **The checkpoint is returned to the operator.**

---

## Known Stubs

None. This plan ships no product code — its artifacts are a gate registry, a validation document, a
UAT scoreboard and two ledger files.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema change. `T-217-SC` holds: no
package installed by this plan or by any plan in Phase 217 — no `requirements.txt`, `package.json` or
sandbox-image change anywhere in the phase.

---

## Commits

| Hash | Message |
|---|---|
| `0b3baaa78` | `test(217-12): the document space enters the gate — 14 suites, both knobs` |
| `ffaa96131` | `docs(217-12): the seam audit, and the wrong filename VALIDATION named` |
| `e9edc7324` | `docs(217-12): four owed ledger rows — two absent, two stale` |

---

## Self-Check: PASSED

- Files claimed created/modified — all present: `217-UAT.md` · `217-12-SUMMARY.md` ·
  `DocumentList.moveToFolder.test.tsx` · `CLAUDE.md` · `docs/HOT-FILE-LEDGER.md` ·
  `scripts/vitest-count-gate.cjs` · `217-VALIDATION.md` · `deferred-items.md`
- The collided old path `frontend/src/__tests__/components/DocumentList.test.tsx` is **gone**
  (`ls` exit 2), and git recorded the move as `R … (100%)` — history follows.
- Commits claimed — all three resolve in `git log`: `0b3baaa78` · `ffaa96131` · `e9edc7324`
- No modification to `STATE.md` or `ROADMAP.md` — the orchestrator owns those writes.

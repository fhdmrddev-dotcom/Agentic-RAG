---
phase: 195-show-the-deliverable
plan: 06
wave: 3
subsystem: frontend/workflow-run-surface
tags: [RUN-02, RUN-03, D-02, D-12, D-15, asChild, fence-inversion, count-gate, tenancy]
requires:
  - "195-01 (the phase's fence baseline)"
  - "195-02 (the two absence fences this plan INVERTS, and their measured plant-B prediction)"
  - "195-03 (FileRow.tsx, fileRowUtils.ts incl. byNewestFirst, the widened fileIcon.tsx)"
provides:
  - "frontend/src/pages/WorkflowRunPage.tsx — the SECOND shipped surface converted onto the shared row; the run adapter keeps the region, the heading, the three-way empty state, the ul/li, the download call and the section-level error"
  - "the run page's copied byte formatter, its basename, its ext/mime->glyph map and the three office-mime consts DELETED"
  - "D-02: the region's heading no longer claims authorship — 'Files in this run's workspace'"
  - "D-12: newest-first ordering on the run surface, in BOTH created_at regimes"
  - "the id-less row's shipped 'Download unavailable' affordance (BUG-260523-03's cue, finally on this surface)"
  - "WorkflowRunPage.test.tsx 105 -> 108, pin raised in the same commit"
affects:
  - "195-07 (the source sweep — this page now declares neither helper; its docblock names all four fenced identifiers in WORDS), 195-08 (doc sweep + hot-file ledger: this file is now 14 commits / 4 phases)"
tech-stack:
  added: []
  patterns:
    - "SUPERSEDED-IN-PLACE fence inversion (194.1-07 banner shape) — originals quoted verbatim, the it() never deleted, so the count cannot fall"
    - "a word-level copy fence scoped to the <h2>, ordered BEFORE its equality so each arm can be observed firing on its own plant"
    - "an inverted absence arm paired with a mirrored ?raw presence arm — 'it moved' told apart from 'it vanished'"
key-files:
  created: []
  modified:
    - frontend/src/pages/WorkflowRunPage.tsx
    - frontend/src/pages/WorkflowRunPage.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "D-195-06-A: the heading is 'Files in this run's workspace' — it names WHERE the files are (the only thing the thread-scoped read can prove) and leaves WHO WROTE THEM unclaimed"
  - "D-195-06-B: the word-level overclaim sweep runs BEFORE the equality, because an expect that fails aborts the case — an equality above it would swallow every observation of the sweep firing"
  - "D-195-06-C: the pin was raised 105 -> 108 in the SAME commit as the tests, against this plan's own task-3 instruction — the orchestrator's wave-3 correction wins (see Deviations 2)"
  - "D-195-06-D: the ordering is scoped to the RUN PAGE only; the panel keeps its shipped path ordering and no decision authorises changing it"
  - "D-195-06-E: the two empty-state strings are byte-unchanged (D-15) — 'This run produced no files.' is NOT the same overclaim, and the reason is written into the page beside the new heading"
metrics:
  tasks: 3
  commits: 3
  plants_fired: 15
  duration_minutes: 78
  completed: 2026-08-17
---

# Phase 195 Plan 06: The run deliverable region on the shared row — Summary

The run surface's deliverable region is now the shared row, ordered so the file the run just
wrote sits at the top, under a heading that no longer claims the run wrote everything below
it — and **the two shipped fences that asserted the duplication this phase removed were
inverted in place with their originals quoted, not deleted**.

**Measured base SHA: `337a1227`** — asserted, and the assertion FIRED for the **19th
consecutive time**. See Deviations 1.

---

## What shipped

| Commit | Task | What |
|---|---|---|
| `9c065ecd` | 1 | The region converted onto `<FileRow asChild density="run">` (both arms); `formatBytes`, `baseName`, `iconFor`, the three `OOXML_*` consts and **eight lucide file-glyph imports** deleted; `[...files].sort(byNewestFirst)` in a `useMemo`; the region docblock corrected BESIDE its original |
| `3cec37c2` | 2 | `COPY_DELIVERABLE_HEADING` relabelled (D-02) at all three locations; the P5 label-honesty case added; the two empty strings provably untouched |
| `c10593c6` | 3 | F1 and 195-02's F8 capture **inverted in place**; two D-12 ordering cases; pin `105 → 108` in the same commit |

---

## The heading — the literal, and why the old one overclaimed

| | |
|---|---|
| **was** | `What this run produced` |
| **now** | `Files in this run's workspace` |

`What this run produced` is an **authorship claim**, and this region structurally cannot
support one. D-01 keeps the read **thread-scoped** — there is no run-attribution column on
`workspace_files` and none was added (the field that *looks* like one is null on every row
and belongs to a different feature). A thread legitimately holds files this run did not
write: the template a user uploaded before launching, and anything an earlier run or a chat
turn on the same thread left behind. Measured at planning time, thread-scope is **exact for
60 of the 61 file-bearing runs and visibly wrong for one** — which is what makes the old
label the dangerous kind of lie: rare enough to survive review, common enough to be seen.

The new label names **where** the files are, which is the one thing the read can prove, and
leaves **who wrote them** unclaimed. The old string is quoted verbatim beside the constant
rather than erased.

⚠ **`COPY_NO_FILES_TERMINAL = "This run produced no files."` was NOT touched, and that is a
decision rather than an oversight.** It reads like the same overclaim and is not: a run is a
subset of its thread, so an **empty** thread-scoped list *entails* the run produced nothing.
The overclaim only bites in the non-empty direction. D-15 ships both empty strings
byte-identical and a source fence pins each at exactly one occurrence in page source — a plan
that "fixed" this copy in D-02's name would break D-15. The reasoning is written into the page
so the next reader does not correct it.

---

## ⚠ THE INVERSION: THE OBSERVED RED-SHAPE, AGAINST 195-02'S PREDICTION

195-02 planted this exact change and predicted the shape. **It matched, and the important
half matched exactly.**

| | 195-02 predicted | Observed here |
|---|---|---|
| **Fence 1** — the id-less row leaves ZERO `<button>` in the region | stays **GREEN** | ✅ **GREEN**, never once red across 15 plants and 6 suite runs |
| **Fence 2** — the row carries no `"Download unavailable"` | **REDS** | ✅ **RED**, first run after the conversion |
| totals | `1 failed \| 104 passed` | `2 failed \| 103 passed` |

**The one-case difference is fully accounted for and is not a surprise:** 195-02's plant only
*inserted* the affordance, while this plan also *deleted* the two duplicated helpers — so
**F1** (`function formatBytes` / `function iconFor` must be present) reds too. F1 is the
**other** fence this plan inverts by design, named in the plan's own `<interfaces>`. Nothing
unexpected fired, and nothing expected failed to.

The verbatim first red, captured before any edit to the suite:

```
× the ROW carries no "Download unavailable" — the absence plan 195-06 inverts
  AssertionError: expected 'orphan-deliverable.docx2.0 KBDownload…' not to contain 'Download unavailable'
× neither mounts the panel's file list nor names it — it reads the viewed thread
  AssertionError: expected '\r\r\r…' to match /function formatBytes/
Tests  2 failed | 103 passed (105)
```

⚠ **The `<span aria-disabled>` element choice is the ONLY reason fence 1 survived**, and that
is now written in words on **both** sides of the seam — in the page (beside `trailing="dead"`)
and in the inverted test case — because a reader meeting `toHaveLength(0)` next to a visible
download affordance will otherwise read it as a bug.

**The delta, in one sentence:** *the run page's id-less row went from a silent fact to a
legible unavailable one, and gained nothing else.* Same element, same tag (`DIV`), same
basename, same size, same full path in `title`; the `run` density's dead overrides are empty,
so even the name and icon colours are unchanged.

---

## The measured run surface — every shipped property, and what pins it

The bar was `195-BASELINE.md`'s live measurement (run `833e8e85`, 2026-08-17).

| Measured property | Survives? | Pinned by |
|---|---|---|
| **basename** `renewal-letter.docx` (never the full path — the panel deliberately differs) | ✅ | shipped `lists the file the run produced…`; `name={baseName(file.path)}` |
| `title` = **full path**, on the control | ✅ | shipped `row.getAttribute("title")` case |
| `38.7 KB` KiB formatting | ✅ | the `aria-label` equality (`18.4 KB` for the shipped fixture) via the shared `formatBytes` |
| **one `<button>` per row**, `aria-label` `Download renewal-letter.docx (18.4 KB)` verbatim | ✅ | shipped `:950-953`; the label is assembled from the same `baseName`/`formatBytes` output the row displays, so the two cannot drift |
| `px-2 py-2` / **33 px** (the panel's 38 px is a different density on purpose) | ✅ | the classes stayed on the caller's button; `DENSITY.run` carries LAYOUT ONLY |
| activation = **download** (the panel previews) | ✅ | shipped download case + `downloadWorkspaceFile(runThreadId` grep |
| icon 16 px, **no `.EXT` ribbon**, `text-muted-foreground` | ✅ | `DENSITY.run` (`ribbon: false`, `tone: "inherit"`, the token as a CLASS) |
| `<ul role="list">` / `<li>` | ✅ | shipped `:968-971` |
| **the three-way empty state**, all three strings byte-identical | ✅ | three shipped cases, **each with its own plant** (P1 a/b/c) |
| no `iframe`/`embed`/`object`/`preview` in the region | ✅ | shipped `:945-949`, untouched |
| empty→populated with **no reload** | ⚠ **not re-measured here** — see "What I did not do" |

**One glyph consequence, inherited from plan 03's one-icon-path rule and already recorded
there:** the run page's local map resolved *unknown* extensions to `File` and tables/code/
images to `FileSpreadsheet`/`FileCode`/`FileImage`; the shared module resolves them to
`FileText`/`Table`/`Code`/`Image`. **`docx` is unchanged** (`FileText` both before and after),
so the flagship deliverable — the only file type the baseline measured on this surface — looks
identical. This is the same delta 195-05 recorded for the panel; it is not new here.

---

## D-12 — the ordering, pinned in the regime the deliverable actually arrives in

The sort key is **absent on exactly the file D-12 exists to surface**. The reconciled GET
supplies `created_at` on every row; the live SSE payload carries `id/path/version/size/mime`
only, and the store **appends** it. So a naive `created_at DESC` puts the just-produced
deliverable **LAST**, under the template it filled.

Two cases, one per regime, and **both fixtures are their own positive control** — a one-row
list, or a list already in the right order, passes forever whether the page sorts or not
(`PendingAskCard.test.tsx:205-222` is the shipped shape of that mistake):

1. two rows with **differing** `created_at`, supplied **oldest-first** → rendered newest-first;
2. two rows where the newest has **`created_at: undefined`** → it renders at `li` index 0.

Plant **P4(c)** — swapping the comparator's two missing-key arms so `undefined` sorts LAST,
i.e. the `PendingAskCard` resolution copied wholesale — reds case 2 and **leaves case 1
green**. That is the precise failure F7 exists for, and it is now a measurement.

⚠ **The sort is `[...files].sort(...)`, never `files.sort(...)`** — the provider hands out a
stable array reference and an in-place sort mutates store state (`canvasModel.ts:368`). The
empty/loading branches still read the original `files`, so the three-way empty state does not
depend on the memo.

⚠ **Scope:** the ordering applies to the **run page only**. The panel's shipped `path`
ordering is unchanged and no decision authorises changing it — stated so a reviewer can tell
"scoped" from "forgotten".

---

## Fifteen plants — every one verified to APPLY, observed RED with case names, restored md5-identical

⚠ **The harness ABORTS with `FATAL: plant did not apply` on an empty diff.** Source here is
**CRLF**, and 195-03 measured two plants that matched nothing, applied nothing and **reported
GREEN**. Every plant below printed a non-zero `diff-lines` and a *different* planted md5
before its run, and the restore was verified by **reading both sums** (195-04's md5 helper
false-passed on two empty strings — `[ "" = "" ]` is a successful restore).

| # | Plant | File | Reds | Case(s) named in the red |
|---|---|---|---|---|
| P5a | revert the heading to the historical overclaim | page | 3 | `renders the deliverable region under its own heading` · `labels the region by WHERE the files are…` (**at the sweep arm**) · `claims NEITHER while the first read is still in flight` |
| P5b1 | heading → `Files this run made` | page | 3 | same three — sweep arm: `expected 'Files this run made' not to match /this run (produced\|made\|created)/i` |
| P5b2 | heading → `Everything this run created` | page | 3 | sweep arm, on the third verb |
| P5c | heading → `Workspace files for this run` (**honest but wrong**) | page | 3 | ⚠ the sweep **PASSES**; only the **equality** catches it — which is what proves the two arms are independent |
| P1a | force the empty ternary ALWAYS-TERMINAL | page | 1 | `a LIVE run with no files says nothing has been written YET` |
| P1b | force it ALWAYS-LIVE | page | 1 | `a TERMINAL run with no files says it produced none — the tense is the fact` |
| P1c | delete the in-flight `filesLoading ? null :` guard | page | 1 | `claims NEITHER while the first read is still in flight` |
| P8a | `import { FilesSection } …` | page | 1 | `neither mounts the panel's file list nor names it` — *not to match /FilesSection/* |
| P8b | `import { useViewingThread } …` | page | 1 | same case, **different assertion** — *not to match /useViewingThread/* |
| P8c | `import { FilePreview } …` | page | 1 | `promises no preview: the previewer is neither imported nor named` |
| P4a | remove `.sort(byNewestFirst)` | page | 2 | **both** ordering cases |
| P4b | comparator → ASC (both keys present) | `fileRowUtils.ts` | 1 | the differing-`created_at` case **only** |
| P4c | missing key sorts **LAST** (the `PendingAskCard` trap) | `fileRowUtils.ts` | 1 | the `created_at: undefined` case **only** |
| F8 | take `trailing="dead"` back off the id-less row | page | 1 | the **inverted** `the ROW now CARRIES "Download unavailable"` |
| F1 | re-declare `function formatBytes` in the page | page | 1 | the **inverted** absence arm — *not to match /function formatBytes/* |

md5s restored and verified: `WorkflowRunPage.tsx` `f6df326482d98bcbeef2ec981fad57aa` ·
`fileRowUtils.ts` `b90841d8ced416a23532d35329168676`.

**Three results worth naming:**

- **P5c is the one that mattered.** An equality alone passes on any wrong copy someone also
  typed into the test; a word sweep alone passes on any honest-but-wrong copy. P5c proves the
  equality arm fires **on its own**, and P5a/b prove the sweep does.
- **The sweep is ordered BEFORE the equality, and that ordering is load-bearing.** A failing
  `expect` aborts the case, so an equality placed first would swallow every observation of the
  sweep firing — every overclaiming plant reds the equality too. A fence nobody can *observe*
  firing is indistinguishable from one that cannot fire.
- **P8a and P8b red the same `it()` at different assertions**, which is why they were run
  separately rather than together: one plant cannot exercise three distinct `expect`s.

---

## ⚠ P1(c) WAS NOT INERT — CHECKED BEFORE IT WAS TRUSTED

The plan flagged P1(c) as the plant most likely to be inert: its assertion is a
`not.toContain`, which passes trivially if the fixture never sets the loading flag. **The
fixture does set it** — `setFiles(data = [], isLoading = false)` (`:283-285`) and the case
calls `setFiles([], true)` (`:1147`), so `isLoading` is genuinely `true` in that render.
Verified by reading the fixture **and** by the plant reding with the right message
(`expected 'Files in this run's workspace…' not to contain 'This run produced no files.'`).
**No fixture repair was needed.**

---

## Counts — every fence, before and after

Read from the count gate's own printed `actual` column on the final green run, never
hand-counted from `it(` literals.

| Suite | before | after | note |
|---|---|---|---|
| `pages/WorkflowRunPage.test.tsx` | 105 | **108** | +3 (the D-02 sweep + two D-12 ordering cases). **Two `it()`s were INVERTED, not deleted — an inversion moves no number**, which is exactly why the plan forbade deletion |
| `panel/__tests__/WorkspacePanel.test.tsx` | 58 | 58 | unedited |
| `lib/__tests__/fileIcon.test.tsx` | 41 | 41 | unedited |
| `files/__tests__/FileRow.test.tsx` | 40 | 40 | unedited |
| `files/__tests__/fileRowUtils.test.ts` | 22 | 22 | unedited |
| `panel/__tests__/FilesSection.test.tsx` | 22 | 22 | unedited |
| `chat/__tests__/OutputFileCard.baseline.test.tsx` | 21 | 21 | unedited |
| `chat/__tests__/StopControl.baseline.test.tsx` | 15 | 15 | unedited, **green after every single page edit** (P9) |
| `__tests__/components/MessageItem.finalOutputs.test.tsx` | 11 | 11 | unedited |

**No file DECREASED.** Final gate verdict, verbatim:

```
  total 4150  ·  failed 0  ·  pinned total 4076
count gate OK — 82/82 pinned files present, no per-file decrease, 0 failing.
```

`npx tsc --noEmit -p tsconfig.app.json` = **33**, unmoved, with **zero** errors in either file
I touched. ⚠ The three pre-existing `TS2304`s in `FilesSection.test.tsx` were **left alone** —
fixing them takes tsc to 30 and would red every sibling's "equals 33" criterion (195-08 owns
them).

---

## ⚠ THE GATE WENT RED ONCE, AND THE FAILING FILE WAS CAPTURED BEFORE ANY RE-RUN

Three gate runs: **run 1 `failed 0` · run 2 `failed 2` · run 3 `failed 0`.** Per the 193.2-02
rule the failing cases were extracted from the gate's **own persisted JSON report**, not by
re-running anything:

| File | failing | signature | byte-identical to base? |
|---|---|---|---|
| `src/pages/WorkflowsPage.test.tsx` | 2 | `Error: STACK_TRACE_ERROR` (both) | ✅ **yes** — `git diff --numstat 337a1227 HEAD` empty **and** `git status --short` empty |

Cases: *"D-17: the project filter holds STARTERS out…"* and its companion *"a PENDING project
re-query never zeroes a count…"*. This is **SEED-171's first named suite**, with SEED-171's
dominant signature, in a file this plan never opened — and it is **the same file and the same
first case 195-05 recorded going red on its own run 1**, which is itself evidence about the
suite rather than about either plan.

⚠ **Recorded as an observation, not a clean bill of health.** One green sample of a flaky
suite is not proof of innocence. What *is* solid: the file is provably unmodified against the
recorded base SHA, and my nine fence suites were green on all three runs.

---

## Deviations from Plan

### ⚠ 1. [Rule 3 — blocking] The worktree forked from the WRONG BASE. **19th consecutive instance.**

`git rev-parse HEAD` read **`fda792141b0129de7b15dd40ddc1082e76f95a2a`** — the same `master`
merge commit every dispatch this phase has landed on — and `git merge-base HEAD 337a1227`
returned `3781a3fe`, not `337a1227`. Exactly as the briefing predicted. `git reset --hard
337a1227` applied; **HEAD after the reset is
`337a1227bbd09ded35712d15b05ec00c55cd4e04`** (`chore: merge executor worktree (195-05 panel
list on shared row)`). The assertion is the only reason this was caught.

### ⚠ 2. [stated deviation] I EDITED `scripts/vitest-count-gate.cjs`, which this plan's task 3 forbids

The plan says, verbatim: *"`scripts/vitest-count-gate.cjs` is NOT in this plan's
`files_modified` … Do not edit `scripts/vitest-count-gate.cjs` here."* **I edited it anyway**,
raising `WorkflowRunPage.test.tsx` from 105 to 108 in the same commit as the tests.

The orchestrator's wave-3 briefing overrides it explicitly and puts it in this plan's success
criteria: *"`WorkflowRunPage.test.tsx` grew; its pin raised in the SAME commit from the gate's
`actual` column."* The reason is already committed **inside the gate file itself** at the
`fileIcon.test.tsx` entry — a pin of 11 against an actual of 41 lets thirty cases be deleted
while the gate stays green — so deferring to wave 4 would have re-created, in the same file,
the exact defect the file documents. 195-05 made the same call for the same reason.

**The cost is stated rather than glossed:** the prohibition existed to reduce merge surface
with the concurrent siblings, whose pin entries sit in the same block. Mitigation: the edit is
**one number plus a comment block**, no logic touched, `git diff --numstat` = `11 1`. If it
conflicts on merge, the resolution is to keep every pin.

### 3. [stated deviation] The heading literal appears THREE times in the suite, not two

The plan's acceptance criterion says *"exactly twice in the suite"*. It is **three**: the two
shipped assertions the plan named, **plus the equality arm inside the new P5 case** — which
the criterion predates, since it was written before P5's own shape was decided. The
alternative (a shared const) would have made it **one**, which the criterion also forbids.
`grep -c` in the page source is **1**, as specified.

### 4. [recorded] `grep -c "toMatch(/function formatBytes/)"` reads 3, not 0 — and the criterion cannot be met literally

The criterion asks for **0** outside the quoted historical block. The literal grep is
substring-based and cannot distinguish `not.toMatch(` from `toMatch(`. The exact breakdown:

| Line | What it is |
|---|---|
| `1751-1752` | the **quoted originals**, inside the SUPERSEDED banner (the criterion requires these) |
| `1784-1785` | the **inverted** arms — `expect(codeOf(pageSource)).not.toMatch(…)` |
| `1813-1814` | **positive controls** over literal strings, not over `pageSource`, proving the inverted arms would catch the duplication coming back |

There is **no surviving assertion that `pageSource` contains either helper**, which is what
the criterion is actually about.

### 5. [scope, stated not acted on] `WorkflowRunPage.tsx` crossed further into G-5

The file was **12 commits / 3 phases / 1101 lines** (`at threshold — honoured by
construction (194.1)`); it is now **14 / 4 / 1156**. I kept every change inside the deliverable
region and its imports and touched no unrelated concern — the diff is `137 82` and every
hunk is the region, its docblock, the copy constant or the import list. **The ledger row and
its `docs/HOT-FILE-LEDGER.md` section are 195-08's, per the same-commit sync rule**; recorded
here rather than edited, because this plan may not touch `CLAUDE.md`.

---

## What I did NOT do

- **No browser, no live run, no visual diff, in either theme.** Every property above is
  markup-level. In particular the baseline's **empty→populated-with-no-reload** transition
  (measured live at 35.7 ms before terminal) is **structurally preserved** — the memo is a
  pure derivation of the same `files` array the region already rendered, and the
  empty/loading branches still read `files` directly — but it was **not re-measured**. That
  is owed to the phase's UAT (D-20), not claimed here.
- **No package installed.** `git diff --numstat 337a1227 HEAD -- frontend/package.json
  frontend/package-lock.json` is **EMPTY**. No `slopcheck` owed.
- **No change to the panel's ordering**, to `StreamsProvider.tsx` (D-12 explicitly forbids
  "fix it by teaching the SSE to stamp `created_at`"), or to any empty-state string.

---

## Threat model — dispositions discharged

| Threat ID | Disposition | How |
|---|---|---|
| T-195-06-01 Info disclosure — which thread's files are listed and downloaded | ✅ mitigated | `grep -c "useWorkspaceFiles("` → **1** · `grep -c "downloadWorkspaceFile(runThreadId"` → **1**. The download was NOT routed through a shared dispatcher, precisely because that drops both needles to zero and forces inverting a fence guarding a **tenancy** property. The shipped `:1450-1455` case is green, unedited |
| T-195-06-02 Info disclosure — the shared row acquiring a thread resolver | ✅ mitigated | `grep -cE "FilesSection\|FilePreview\|useViewingThread"` on the page → **0**; plan 03's row reads no hook. Pinned twice (at the row, and over this page's raw source) and **both P8a and P8b were observed reding their own arms** |
| T-195-06-03 Spoofing/EoP — the id-less row's new affordance | ✅ mitigated | the affordance is a `<span aria-disabled="true">` — asserted by tag in the inverted case; the region's zero-button count is asserted twice (region-wide and row-scoped); the gate is still the code-level `if (!runThreadId \|\| !fileId) return` |
| T-195-06-04 Tampering (XSS) via `file.path` | ✅ mitigated | `grep -c dangerouslySetInnerHTML` on the page → **0**; label, `title` and `aria-label` are React text/attribute values; the `aria-label` is interpolated from `baseName`/`formatBytes` output only |
| T-195-06-05 Repudiation — the region's honesty | ✅ mitigated | D-02 shipped, with a word-level fence **scoped to the `<h2>`** so it cannot red on the legitimately-worded empty state — and the mis-scoping is *demonstrated* in the case (the terminal empty copy matches the needle), not merely asserted |
| T-195-06-SC package installs | ✅ n/a | `git diff --numstat` on both manifests is EMPTY |

---

## Known Stubs

**None.** Every prop handed to the shared row is rendered; every prop deliberately omitted
(`metaSuffix`, `supersedes`, `errorText` — the run page's error is section-level with
`data-testid="run-download-error"` and no auto-clear, deliberately unlike chat's 3 s in-row
one) has a shipped assertion covering its placement.

## Threat Flags

None. No new endpoint, route, hook, persistence or dependency; no file outside
`src/pages/WorkflowRunPage.*` and the gate pin was touched.

---

## Owed onward

- **195-07** — this page now declares neither helper (both greps → 0), so its arms will pass
  and its plants will red as designed. ⚠ **Its `codeOf(...)` stripper must survive this page's
  new docblock**, which discusses the extraction at length; every fenced identifier in it is
  written in **WORDS**, never as a token, and the four raw-source predicates were re-verified
  green after every edit. Its own docblock addition must do the same.
- **195-08** — the hot-file ledger row for `WorkflowRunPage.tsx` (**14 / 4 / 1156**,
  re-derived at close with `CLAUDE.md`'s recipe) and its `docs/HOT-FILE-LEDGER.md` section,
  same commit; plus `195-CONTEXT.md`'s Claude's-Discretion note now has its answer
  (`Files in this run's workspace`).
- **SEED-171** — no new suite to add; run 2's two failures were both in
  `WorkflowsPage.test.tsx`, already the seed's first named file, with the dominant signature —
  and the **same first case** 195-05 recorded.
- **Phase UAT (D-20)** — the live re-measure of the converted region, the empty→populated
  transition, and a side-by-side confirming chat, panel and run page render the same row.

---

## Verification checklist

- [x] `bash scripts/bootstrap-worktree.sh "$(pwd)"` ran **FIRST** — `BOOTSTRAP OK`
- [x] Base asserted, drift caught (`fda79214`), reset to **`337a1227`**, corrected HEAD echoed
- [x] Every task committed individually (`9c065ecd`, `3cec37c2`, `c10593c6`)
- [x] The region renders via `FileRow`: basename · `title` full path · `px-2 py-2` · download
      activation · the empty-state copy byte-identical
- [x] Heading relabelled per D-02 at all three locations; ordering applied newest-first
- [x] Both absence fences INVERTED with originals quoted in place; observed red-shape matches
      195-02's plant-B prediction (fence 2 red, fence 1 green)
- [x] `WorkflowRunPage.test.tsx` grew 105 → 108; pin raised in the SAME commit from `actual`
- [x] All other fences at their exact counts; `tsc` still **33**
- [x] Fifteen plants applied (CRLF-verified, non-zero diff), red with case names, restored
      md5-identical (both sums READ, never inferred from an exit code)
- [x] `.planning/STATE.md` / `.planning/ROADMAP.md` untouched — empty `git diff --numstat`
      against `337a1227` **and** empty `git status --short`

## Self-Check: PASSED

Both modified source files present on disk plus this SUMMARY; all three task commits present
in `git log --oneline --all` (`9c065ecd`, `3cec37c2`, `c10593c6`); `git diff --numstat
337a1227 HEAD` lists **exactly three** paths (`WorkflowRunPage.tsx`,
`WorkflowRunPage.test.tsx`, `vitest-count-gate.cjs`) and nothing else; `.planning/STATE.md`
and `.planning/ROADMAP.md` show an empty diff **and** an empty status, i.e. untouched both
committed and uncommitted. The `WorkflowRunPage.tsx` hot-file triple quoted above (**14 / 4 /
1156**) was re-derived with `CLAUDE.md`'s recipe at close, not copied from `195-BASELINE.md`.

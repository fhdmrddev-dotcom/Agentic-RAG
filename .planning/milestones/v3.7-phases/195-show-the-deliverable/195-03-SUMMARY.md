---
phase: 195-show-the-deliverable
plan: 03
wave: 2
subsystem: frontend/shared-file-presentation
tags: [RUN-03, extraction, shared-component, asChild, count-gate]
requires:
  - "195-01 (BASE_SHA artifact + the tsc/gate/five-suite floor)"
  - "195-02 (the six fence files, and the measured eight-extension icon regression)"
provides:
  - "frontend/src/components/files/FileRow.tsx — the ONE row markup, three shipped densities, caller-supplied wrapper element"
  - "frontend/src/components/files/fileRowUtils.ts — formatBytes (byte-identical hoist), baseName, FileSource, byNewestFirst"
  - "frontend/src/lib/fileIcon.tsx — widened into the ONE icon path (ribbon/tone/className/mimeType), nine extensions added, own-property guard"
  - "two new suites inside the count gate, FILE-LEVEL (fileRowUtils.test.ts 22, FileRow.test.tsx 40)"
affects:
  - "195-05 (panel adoption), 195-06 (run-page adoption), 195-07 (the source sweep + its own gate entry)"
tech-stack:
  added: []
  patterns:
    - "second first-party asChild component in the tree (Slot + Slottable), after ui/button.tsx"
    - "first shared non-primitive component directory (components/files/)"
    - "own-property guard on an object-literal lookup (the phaseGlyph.tsx:107-122 scar)"
key-files:
  created:
    - frontend/src/components/files/FileRow.tsx
    - frontend/src/components/files/fileRowUtils.ts
    - frontend/src/components/files/__tests__/FileRow.test.tsx
    - frontend/src/components/files/__tests__/fileRowUtils.test.ts
  modified:
    - frontend/src/lib/fileIcon.tsx
    - frontend/src/lib/__tests__/fileIcon.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "D-195-03-A: the eight-extension question ANSWERED by EXTENDING EXT_MAP (nine rows), not by recording a regression"
  - "D-195-03-B: mime-first for every SPECIFIC branch, but the bare text/ FALLTHROUGH stays AFTER the extension lookup — a literally-mime-first order regresses script.py+text/plain from Code to FileText"
  - "D-195-03-C: no shared downloadFrom() dispatcher — routing through a util would drop a tenancy fence's grep to zero"
  - "D-195-03-D: fileIcon.test.tsx's gate pin left at 11 while actual is 41 — a pin is a floor, never a census"
metrics:
  tasks: 3
  commits: 3
  plants_fired: 19
  duration_minutes: 78
  completed: 2026-08-17
---

# Phase 195 Plan 03: The shared file row and its pure helpers — Summary

One row markup, one byte formatter, one basename, one icon path — all four now exist exactly once
in the tree, each with RED-driven coverage inside the count gate, and **not one surface converted**,
so wave 3's three adoption plans are pure adoption and a failure here was contained.

**Measured base SHA: `3e43f24b`** — asserted, and the assertion FIRED. See "Deviations" below.

---

## What shipped

| Commit | Task | What |
|---|---|---|
| `41b3eaa5` | 1 | `fileIcon()` widened into the ONE icon path — options object, mime-first resolution, nine missing extensions, own-property guard; 11 → 41 cases |
| `757103ce` | 2 | `fileRowUtils.ts` — `formatBytes` (proved byte-identical to its origin), `baseName`, `FileSource`, `byNewestFirst`; 22 cases |
| `42f87d4b` | 3 | `FileRow.tsx` — `asChild` + three shipped densities; 40 cases; both suites adopted into the count gate FILE-LEVEL |

---

## ⚠ THE EIGHT-EXTENSION DECISION — ANSWERED BY EXTENDING `EXT_MAP`, AND THE FENCE FIRES

The briefing required either an `EXT_MAP` extension or a knowingly-recorded regression, and said
silence was the one unacceptable outcome. **`EXT_MAP` was extended.** Nine rows, not eight — the
briefing named `sh`, `bash`, `sql`, `yml`, `yaml`, `css`, `jsx`, `mjs`; the panel's `codeExts`
(`FilesSection.tsx:62-65`) also carries **`tsx`**, which `EXT_MAP` likewise omitted, so it is in.

All nine map to the existing code category (`Code` glyph, `#0c8599`) — the same category the sketch's
canonical map assigns to `js`/`ts`/`json`/`py`/`html`/`xml`
(`chat-tool-card-unification.md:176-190`), so this adds no new colour and no new glyph.

**The evidence it is a live fence, not a decoration** — plant P1(c) deleted all nine rows:

```
================ PLANT: P1(c) drop the nine EXT_MAP code-extension additions ================
PLANT APPLIED? diff-lines=10
     × .sh resolves to the Code glyph, not the FileText default
     × .bash / .sql / .yml / .yaml / .css / .jsx / .mjs / .tsx  — all nine
      Tests  9 failed | 32 passed (41)
RESTORED md5 OK: e2622f626e4d9b41d72325ad2a809add
```

A **negative control** ships beside them: `archive.zzz` (an extension still absent from the map) is
asserted to resolve to `lucide-file-text`. Without it, the nine cases could not distinguish "the map
has these rows" from "the default happens to be Code", and dropping the rows could still read green
if the fallback ever changed.

---

## ⚠ THE THEME-CONDITIONAL TOKEN TRAP — HONOURED, AND WHAT I DID *NOT* RELY ON

Every colour-adjacent assertion in both new suites is on a **class / token name or the PRESENCE of an
inline `style`**, never on a resolved `rgb()`. The reason is written into both test-file headers so a
future editor cannot re-introduce the trap by "improving" an assertion:

> jsdom renders the DARK theme, where `--muted-foreground` and `--panel-muted-foreground` are
> IDENTICAL (`index.css:105`/`:151`, both `220 16% 65%`) and diverge ONLY in light (`:30` `220 9% 46%`
> vs `:59` `220 12% 40%`). A resolved-colour fence passes green here while a light-theme AA
> regression ships.

Concretely:
- `tone: "inherit"` is asserted as **"no inline colour at all"** on the wrapper AND on the ribbon — a
  property of the markup, theme-independent — each with a `tone: "category"` positive control.
- `FileRow`'s `panel` density is asserted to contain the string `text-panel-muted-foreground`; the
  `run` density is asserted to contain `text-muted-foreground` **and NOT** `text-panel-muted-foreground`.
  Those two cases are the mechanism keeping the panel's Phase 088-05 AA choice intact while the run
  page never names a panel-scoped token (`WorkflowRunPage.test.tsx:1428-1429`).
- The `tone` option exists **because** a row that hardcoded one tone could not serve both surfaces.
  It is not a nicety.

**⚠ I relied on NO visual diff of any kind, dark or light.** Nothing in this plan renders a browser,
and the briefing's warning stands unaltered: a dark-theme visual diff showing "no change" would not
have been evidence this was safe. What IS evidence: `FileRow` never converts a surface, so nothing
rendered to a user moved in this plan at all. The visual question lands in 195-05/06.

---

## ⚠ A CORRECTION TO THIS PLAN'S OWN INSTRUCTION, RECORDED BESIDE IT

The plan's Task 1 said the mime branches are *"checked BEFORE the extension lookup"*. **Taken
literally that regresses the very class of defect Task 1 exists to prevent**, and this is measured,
not reasoned:

`FilesSection.tsx:62-69` checks `codeExts.includes(ext)` **before** its bare `text/` arm. So a python
file served as `text/plain` — a real combination — is a **Code** glyph in the panel today. Hoisting a
bare `text/` fallthrough above the extension lookup would resolve it to **document**. Same for
`data.csv` served as `text/plain`.

**What shipped instead:** every *specific* mime branch is mime-first (the three OOXML constants,
`text/markdown`, `text/csv`, `image/*`, `text/x-*`, `application/json`), and only the deliberately-last
`text/` **fallthrough** sits after the extension lookup — which is what "fallthrough" means and what
the panel already does. The three OOXML arms keep the panel's `ext === "docx" || mime === …` shape
verbatim so extension and mime cannot disagree about an office file.

Pinned by its own case, which would be green under either reading were it not written explicitly:

> `⚠ the bare "text/" fallthrough must NOT outrank the extension map — script.py + text/plain is CODE`

The original instruction is quoted in `fileIcon.tsx`'s `resolveSpec` docblock, with this reason
beside it — never over it.

---

## Per-file count deltas, tsc, gate verdict

| File | before | after | delta |
|---|---|---|---|
| `src/lib/__tests__/fileIcon.test.tsx` | 11 | **41** | **+30** (additions only — `git diff` shows **0** removed lines; all 11 original titles intact) |
| `src/components/files/__tests__/fileRowUtils.test.ts` | — | **22** | new |
| `src/components/files/__tests__/FileRow.test.tsx` | — | **40** | new |
| **grand total** | 4044 | **4136** | **+92** |
| **`tsc --noEmit -p tsconfig.app.json`** | 33 | **33** | **unmoved** — and **0** errors in any file this plan touched |

**No file DECREASED.** The six fence files are byte-identical to base (`git diff --numstat` empty for
all of them) and green: `OutputFileCard.baseline` 21 · `StopControl.baseline` 15 ·
**`WorkflowRunPage.test.tsx` 105** · `FilesSection` 11 · `MessageItem.finalOutputs` 11 ·
`fileIcon` 41. The ungated VALIDATION set: **5 files / 125 passed**.

**Gate verdict, quoted verbatim, from the last of five runs:**

```
  total 4136  ·  failed 0  ·  pinned total 4032
count gate OK — 82/82 pinned files present, no per-file decrease, 0 failing.
```

Both new pins were read from the gate's **own `actual` column** on two agreeing runs
(`total 4136 · failed 0` both times), never hand-counted from `it(` literals. Both paths were
`ls`-confirmed before being written (a nonexistent `TARGETS` path makes the gate **ERROR at exit 2**,
not fail) and both bare filenames confirmed unique tree-wide. **`grep -n '"src/components/files"'`
returns nothing** — file-level entries only; `FileRow.sweep.test.ts` belongs to plan 195-07.

---

## ⚠ THE GATE WENT RED ONCE, AND THE THIRD FAILING FILE IS A **NEW** FINDING FOR SEED-171

Five gate runs: **runs 1, 2, 3, 5 green; run 4 red with `failed 9`.** Failing filenames were captured
**before any re-run** (the 193.2-02 rule) by parsing the gate's own persisted JSON report rather than
by re-running anything:

| File | failing | signature | byte-identical to base? |
|---|---|---|---|
| `src/pages/WorkflowsPage.test.tsx` | 6 | `STACK_TRACE_ERROR` | ✅ yes |
| `src/components/workflows/library/WorkflowCard.test.tsx` | 2 | `STACK_TRACE_ERROR` | ✅ yes |
| **`src/pages/WorkflowBuilderPage.session.test.tsx`** | **1** | **`AssertionError: expected 1 to be +0`** | ✅ yes |

The first two are SEED-171's named pair, exactly as the briefing predicted. **The third is not in that
pair, and its signature is an AssertionError rather than a timeout** — so it was NOT waved through:

1. It failed once in **isolation** too.
2. Restoring the **base** `fileIcon.tsx` and re-running: **23/23 passed.** ⚠ **That looked like
   causation and is NOT evidence of it** — it is one green sample of a flaky suite, which is the same
   trap in a new costume.
3. Re-running in isolation with **my** `fileIcon.tsx`, four consecutive times: **23/23, 23/23, 23/23,
   23/23.**

So **7 of 8 samples with my changes are green**, the file is byte-identical to base, nothing outside
`components/files/` imports any new code, and the failing assertion is a PATCH-**count** in a suite
that itself imports `WorkflowsPage` — SEED-171's own subject.

**Finding, owed onward:** `WorkflowBuilderPage.session.test.tsx` belongs in SEED-171's flaky set, which
currently names only two files. I did **not** edit the seed — this plan does not own it, sibling wave-2
executors may be touching shared planning artifacts, and `195-08` owns the documentation sweep. It is
recorded here and in my return so it cannot be lost. **Note the shape of the flake is broader than
SEED-171 records: not every failure is a `STACK_TRACE_ERROR` timeout.**

---

## New fences, and the evidence each can FIRE

**19 plants across the three tasks, every one verified to APPLY, observed RED with failing case
NAMES, then restored with md5 before == after.**

| Plant | Reds | Named cases |
|---|---|---|
| P1(a) remove the `ribbon` branch | 1 | `ribbon:false omits the .EXT label span entirely` |
| P1(b) remove the `tone:"inherit"` branch | 2 | both `tone:"inherit" paints NO inline colour…` cases (wrapper + ribbon) |
| P1(c) drop the nine `EXT_MAP` rows | **9** | one per added extension |
| P1(d) drop the mime-first block | 5 | `text/csv` · `image/png` · OOXML pptx · OOXML xlsx · `text/x-python` |
| P1(e) remove the own-property guard | 2 | `x.constructor renders without throwing` · `x.toString and x.__proto__ are likewise inert` |
| P4(a) delete the missing-key guards (`return 0`) | 4 | incl. **`⚠ THE DELIVERABLE CASE: the APPENDED row with NO created_at ends up at index 0`** |
| P4(b) invert to ASC | 4 | incl. the two-row positive control |
| **P4(c) sort a missing key LAST** | **4** | the same deliverable case — **the arm F7 exists for** |
| P2(d) `< 1024` → `<= 1024` | 2 | the boundary case **AND the byte-identity case** |
| P2(e) `< 1024*1024` → `<=` | 2 | ditto |
| P2(f) `toFixed(1)` → `toFixed(2)` | 4 | ditto |
| P2(g) `baseName` `\|\|` → `??` | 2 | both fallback cases |
| P3(a) dead affordance `<span>` → `<button>` | 2 | both ZERO-`<button>` cases |
| P3(b) drop `aria-disabled` | 3 | |
| P3(c) change the dead title/copy | 1 | `carries the exact shipped title and copy` |
| P3(d) drop `forwardRef` | 2 | **both ref cases — so the ref case is NOT inert** |
| P3(e) reorder `trailingSlot` after the size cell | 1 | `trailingSlot renders BEFORE the size cell in DOM order` |
| P3(f) drop `<Slottable>` | **7** | all four `asChild` root cases + the merge case + the ref case + the className-join case |
| P3(g) populate `deadOverrides` for `run` | 1 | `⚠ density="run" + trailing="dead" does NOT dim` |

Three results worth naming rather than burying:

- **P2(d/e/f) each red the `?raw` byte-identity case as well as a boundary case.** That is the
  identity fence proving it is live rather than decorative — and it carries BOTH a `.length` guard and
  a `toContain("export function byNewestFirst")` identity guard, because 192.1 measured a renamed
  module swept against the empty string and passing green.
- **P3(d) reds both ref cases**, so the roving-focus contract (`FilesSection.tsx:109`/`:221-223`) is
  actually measured. The plan flagged an inert ref case as a FINDING to fix; it is not inert.
- **P1(e) reds the prototype case**, so the own-property guard is measured too — the plan flagged an
  inert guard case as a FINDING; it is not inert.

---

## Deviations from Plan

### ⚠ 1. [Rule 3 — blocking] The worktree forked from the WRONG BASE. **17th recorded instance.**

`git merge-base HEAD 3e43f24b` returned `3781a3fe`, not `3e43f24b`. HEAD was `fda79214` — the same
`master` merge commit 195-02 landed on, exactly as the briefing predicted. `git reset --hard 3e43f24b`
applied; the measured base is now `3e43f24b`. **The assertion is the only reason this was caught**, and
it has now fired 7/7 in Phase 194, 8/8 in 194.1, and again here.

### ⚠ 2. [Rule 1 — bug in my own work] Two Task-1 plants were NO-OPS and reported GREEN

P1(c) and P1(d) initially came back **`41 passed`** — which I read as "the fence is inert", the exact
finding the plan told me to escalate. **It was not the fence. The plant had not applied**: the source
files are **CRLF**, and my `perl -0p` patterns used bare `\n`, so the multi-line substitutions matched
nothing. The single-line plants (P1(a)/(b)/(e)) applied fine, which is what made the failure look
selective and credible.

**Fixed, and then hardened so it cannot recur:** every subsequent plant harness `diff`s the file
before and after the edit and **aborts with `FATAL: plant did not apply`** if the diff is empty. With
`\r?\n`, P1(c) red 9 cases and P1(d) red 5.

*The lesson is the plan's own rule turned on the plants themselves: a plant that cannot apply proves
exactly as little as a fence that cannot fire, and it fails in the reassuring direction.*

### ⚠ 3. [Rule 2 — correctness] My first `FileRow` docblock tripped a fence by QUOTING it

The acceptance greps `useViewingThread|FilePreview` → 0 and `cva|buttonVariants` → 0 and
`fileIcon(` → 1 all **failed on the first draft** — because the docblock explained the constraints by
naming the forbidden identifiers in prose, and `fileIcon()` in a comment matches `fileIcon(`.

This is not pedantry: **plan 195-07 adds a source sweep over this very file**, and those page-source
fences grep RAW SOURCE. A comment is not exempt. All three are now paraphrased (the viewed-thread
selector hook · the previewer component · class-variance-authority · "one call to the shared icon
module"), and a paragraph recording *why the prose is worded that way* sits in the file so a future
editor does not "clarify" it back into a red gate.

### 4. [formatting] The Task-1 acceptance grep is satisfied in substance, not literally

`grep -c "export function fileIcon(filename: string, sizePx: number = 24"` returns **0**, because the
signature is now split across lines to hold the third parameter. The property it was checking —
**"the first two parameters are unchanged"** — holds exactly: `filename: string,` then
`sizePx: number = 24,` in that order, and all 11 shipped cases plus `OutputFileCard.tsx:83` are
byte-unchanged and green. `grep -c "export function fileIcon("` returns 1.

### 5. [test correctness] One `FileRow` case failed first time for a reason unrelated to the component

`chat renders the .EXT ribbon; panel and run do NOT` failed on its first run: RTL's `queryByText` from
a render result is bound to `baseElement` (**`document.body`**, shared across the three renders in one
case), so the panel arm was reading the chat arm's ribbon. Rewritten container-scoped, with the reason
in the case's comment. *A fence that measures the wrong tree is worse than no fence.*

### 6. [recorded, not fixed] `fileIcon.test.tsx`'s gate pin stays at 11 while `actual` is 41

Deliberate, with the reason in the script: the gate's contract is **no per-file DECREASE**, not
equality, so an 11 floor is exactly as strong while the growth stays visible in the `actual` column
instead of hiding behind a number someone re-typed. `WorkspacePanel.test.tsx`'s own note records a pin
that sat **twelve cases stale** while the gate stayed satisfied — *a pin is a floor, never a census.*

---

## Threat model — dispositions discharged

| Threat ID | Disposition | How |
|---|---|---|
| T-195-03-01 XSS via `name`/`supersedes`/`metaSuffix` | ✅ mitigated | `grep -c dangerouslySetInnerHTML` → **0** in both new source files; two cases render `<img src=x onerror=alert(1)>` as `name`, `supersedes`, `metaSuffix` and `errorText` and assert literal text with **no `img` element** |
| T-195-03-02 XSS via the ribbon label | ✅ mitigated | a case renders `<b>x</b>.docx` and asserts the ribbon reads `.DOCX` with **no `b` element**; plus a hostile-`className` case proving `className` is a class attribute, never markup |
| T-195-03-03 render crash on `EXT_MAP["constructor"]` | ✅ mitigated | own-property guard shipped; `x.constructor`, `x.toString`, `x.__proto__`, `x.hasOwnProperty` all pinned; **P1(e) reds them**, so the guard is measured |
| T-195-03-04 EoP via the dead affordance | ✅ mitigated | `grep -c 'useViewingThread\|FilePreview\|useWorkspaceFiles'` → **0**; the component performs no download and receives no thread id or file id |
| T-195-03-SC package installs | ✅ n/a | **`git diff --numstat 3e43f24b HEAD -- frontend/package.json frontend/package-lock.json` is EMPTY.** `@radix-ui/react-slot@^1.2.4` was already a dependency (`package.json:27`) and both `Slot` and `Slottable` were verified present in the installed dist before use. No install attempted, no `slopcheck` owed |

---

## Known Stubs

**None.** Every prop on `FileRow` is rendered or deliberately omitted, and each omission has a case
asserting the absence (`sizeBytes` omitted → no size cell; `supersedes` absent → no "Replaces:";
`errorText: null` → nothing; `trailing:"none"` → neither affordance). `FileSource` is a type with no
runtime surface yet — by design, per deviation D-195-03-C — and plans 05/06 consume it.

## Threat Flags

None. No new network endpoint, no route, no hook, no persistence, no dependency.

---

## Verification checklist

- [x] `bash scripts/bootstrap-worktree.sh` ran FIRST, `BOOTSTRAP OK`
- [x] Base asserted, drift caught, reset to `3e43f24b`
- [x] Every task committed individually (`41b3eaa5`, `757103ce`, `42f87d4b`)
- [x] `FileRow`, `fileRowUtils`, widened `fileIcon` shipped; **NO surface converted** (`git diff --numstat` empty for `chat/`, `panel/`, `pages/`)
- [x] The eight-extension question ANSWERED — `EXT_MAP` extended by nine, with a firing fence and a negative control
- [x] Colour-adjacent assertions on class/token names and inline-style presence, never resolved `rgb()`
- [x] All six fence files green and unchanged; `WorkflowRunPage.test.tsx` still **105**
- [x] `tsc` still **33**; no per-file count decrease; both new suites pinned FILE-LEVEL
- [x] 19 plants demonstrated to FIRE, each verified to have APPLIED, each restored md5-identical
- [x] `.planning/STATE.md` / `ROADMAP.md` untouched

## Self-Check: PASSED

All four created source/test files present on disk; all three task commits present in
`git log --oneline --all` (`41b3eaa5`, `757103ce`, `42f87d4b`); `.planning/STATE.md` and
`.planning/ROADMAP.md` show an EMPTY `git diff --numstat` against `3e43f24b` **and** an empty
`git status --short`, i.e. untouched both committed and uncommitted.

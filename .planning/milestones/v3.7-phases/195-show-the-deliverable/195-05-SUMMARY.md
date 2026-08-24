---
phase: 195-show-the-deliverable
plan: 05
wave: 3
subsystem: frontend/panel-file-list
tags: [RUN-03, adoption, asChild, a11y, count-gate, AA-contrast]
requires:
  - "195-02 (the six fence files, and the measured code-extension icon regression)"
  - "195-03 (FileRow.tsx, fileRowUtils.ts, the widened fileIcon.tsx)"
provides:
  - "frontend/src/components/panel/FilesSection.tsx — the FIRST shipped surface converted onto the shared row; the panel adapter keeps the listbox, the roving focus, the preview activation, the flash and the Template badge"
  - "the panel's copied byte formatter and its inline ext/mime->glyph map DELETED, with the comment that confessed the copy"
  - "FilesSection.test.tsx 11 -> 22, and its count-gate pin raised to 22 in the same commit"
affects:
  - "195-06 (run-page adoption — the second surface), 195-07 (the source sweep, which asserts this file no longer declares either helper), 195-08 (the doc sweep + hot-file ledger)"
tech-stack:
  added: []
  patterns:
    - "first CONSUMER of the tree's second first-party asChild component — the caller supplies the a11y root, the shared row supplies the presentation"
    - "theme-conditional token asserted by CLASS NAME, never by resolved rgb() (jsdom renders dark, where the two tokens are identical)"
    - "CRLF-safe plant harness that ABORTS on an empty diff (the 195-03 inert-plant scar, hardened)"
key-files:
  created: []
  modified:
    - frontend/src/components/panel/FilesSection.tsx
    - frontend/src/components/panel/__tests__/FilesSection.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "D-195-05-A: the pin was raised to 22 in the SAME commit as the tests, against this plan's own instruction not to touch the gate file — the orchestrator's wave-3 correction wins, and the reason is that a lagging pin is the gate going blind"
  - "D-195-05-B: the panel keeps text-panel-muted-foreground via FileRow's tone/density, and the suite asserts the CLASS NAME — a resolved-colour assertion cannot see the light-theme AA regression it would ship"
  - "D-195-05-C: the four-category glyph delta is recorded as a PASSING CASE naming the pre-195 value, the reason and the phase, not as prose — a future reader must be able to tell a deliberate change from a regression"
  - "D-195-05-D: the label stays the FULL PATH and the activation stays PREVIEW; both have cases asserting the run page's basename/download did NOT come along with the shared markup"
metrics:
  tasks: 2
  commits: 2
  plants_fired: 10
  duration_minutes: 46
  completed: 2026-08-17
---

# Phase 195 Plan 05: The panel file list on the shared row — Summary

The panel's file list is now the shared row and **a user cannot tell, except for one deliberate,
recorded glyph change** — while three properties nothing in the tree covered before this phase
(roving focus *through* the row, the mime-first branches, the code-extension coverage) now have cases
that have been **proved able to fail**.

**Measured base SHA: `57601b6f`** — asserted, and the assertion FIRED. See "Deviations" below.

---

## What shipped

| Commit | Task | What |
|---|---|---|
| `e167d380` | 1 | `FilesSection` converted onto `<FileRow asChild density="panel">`; the copied byte formatter, the inline ext/mime→glyph map, the three office-mime consts, six lucide imports and **the tombstone comment** deleted |
| `ad4771df` | 2 | Eleven new cases (11 → **22**), ten plants fired, and the count-gate pin raised **11 → 22 in the same commit** |

---

## ⚠ THE TOMBSTONE IS GONE

`FilesSection.tsx:36-37` read, verbatim:

> `// Copied verbatim from OutputFileCard.tsx:24-28 (the plan instructs copy, not`
> `// re-derive — the source fn is not exported). Keep byte-for-byte identical.`

That comment is this phase's reason for existing, and it was deleted **with the function it
described**, not before or after it. `grep -c "Copied verbatim from OutputFileCard"` → **0**;
`grep -c "function formatBytes\|function iconFor\|OOXML_DOCX"` → **0**.

---

## ⚠ THE NINE-EXTENSION VERIFICATION — DERIVED, NOT TRUSTED

The briefing said the nine extensions *"should now be closed"* and told me to **verify that against the
panel's actual list rather than trusting it**. I did, mechanically: a script parses the panel's
pre-conversion list out of `git show 57601b6f:…/FilesSection.tsx` and the glyph map out of the live
`fileIcon.tsx`, and cross-references them. Neither list was re-typed by hand.

```
panel code-extension list (14): py ts tsx js jsx mjs json sh bash sql yml yaml html css
EXT_MAP keys (32): pptx ppt pdf docx doc md txt rtf csv xls xlsx png jpg jpeg gif svg webp
                   json js ts html py xml tsx jsx mjs sh bash sql yml yaml css
MISSING from EXT_MAP: (none)
PRESENT but NOT the Code glyph: (none)
VERDICT: every extension the panel handled resolves to Code — regression CLOSED
```

**The panel's list is FOURTEEN entries, not nine** — `py ts js json html` were already in the map, and
the nine plan 03 added are the remainder. **Zero missing, zero mis-categorised.** The regression is
closed *on this surface*, which is the only place that claim can be made now that the panel actually
consumes the shared module.

⚠ **It is closed by plan 03's map, not by anything this plan did — so it is only as durable as the
fence under it.** Plant **P5(c)** deletes the nine rows and reds the `.sql` case from *this* suite, so
the panel now defends the fix independently of `fileIcon.test.tsx`.

---

## ⚠ HOW I PROVED THE PANEL'S MEASURED BEHAVIOURS SURVIVED

The bar was `195-BASELINE.md`'s live panel row (thread `1189a1a3`, 2026-08-17). Each property is
asserted by a case, and **each case has a plant proving it can fail** — a fence nobody has seen fire is
a decoration.

| Measured property | How it is now pinned | Plant that reds it |
|---|---|---|
| **`text-panel-muted-foreground`** on icon **and** meta | class/token NAME on every icon-wrapping span + on the meta element, plus an explicit assertion that `text-muted-foreground` appears on **neither** | **P5(e)** — converges `DENSITY.panel.iconClass` onto the global token |
| **FULL PATH**, `font-mono` (not the basename) | `getByText("/reports/Q3/Northwind-QBR-Template.docx")` carries `font-mono`, **and `queryByText` for the basename alone is `null`** | **P5(f)** — swaps the label for `path.split("/").pop()` |
| **preview**, never download | row contains zero `<a>`, zero `<button>`, no `lucide-download`, no `aria-disabled`; activation renders the previewer | **P5(h)** — `trailing="none"` → `"download"` |
| `px-2.5 py-2` + `cursor-pointer` (38 px, not the run page's 33) | classList on the `role="option"` element, **plus `px-2` asserted ABSENT** | **P5(g)** — converges onto the run page's `px-2` |
| `role="option"` + roving `tabIndex` | the two shipped axe cases, unedited and green, + the new focus case | **P5(a)** |
| `38.7 KB` KiB formatting, `376 B · v2` in ONE element | exact-string `getByText` (which joins only DIRECT text children, so a split across two spans reds it) | **P5(d)** |

⚠ **THE TOKEN ONE IS THE IMPORTANT ROW, AND IT IS THE ONE A NORMAL TEST CANNOT MAKE.** In the shipped
dark theme `--muted-foreground` and `--panel-muted-foreground` are **byte-identical** (`index.css:105`
/`:151`, both `220 16% 65%`), so **P5(e) — a real light-theme AA regression — passes every
`toHaveStyle`, every `getComputedStyle` and every dark-theme screenshot.** The only assertion that sees
it is one on the token NAME. That is written into the suite's header so a future editor cannot
"improve" it back into a resolved-colour check, and the reason (`PanelSection.tsx:85`: light
`--muted-foreground` measured **4.01:1**, below the 4.5:1 AA floor) is named there.

⚠ **What I did NOT do: I ran no browser and no visual diff, in either theme.** A dark-theme visual
diff of this conversion would show **only** the glyph change and would look like a clean landing while
P5(e)-shaped regressions passed through it. The evidence here is entirely markup-level and is stated as
such. The live re-measure of the converted panel is owed to the phase's UAT, not claimed here.

---

## The glyph delta — a passing case, not a paragraph

The one thing a user CAN see. `fileIcon`'s map differs from the deleted local one on four categories:

| Category | Pre-195 | Now |
|---|---|---|
| tables | `lucide-file-spreadsheet` | **`lucide-table`** |
| code | `lucide-file-code` | **`lucide-code`** |
| images | `lucide-file-image` | **`lucide-image`** |
| unknown | `lucide-file` | **`lucide-file-text`** |

docx/pptx are **unchanged**, which is why all four shipped template cases stayed green untouched.

It is recorded three ways so it cannot read as a regression later: in `FilesSection.tsx`'s docblock
(beside the original sentence, never over it), in the `fileIcon.tsx` docblock plan 03 wrote, and as a
**passing case** whose comment names the pre-195 class, the new class, the reason (SC#2 — one icon
path) and the phase number. **P5(i)** reverts the tables glyph and reds that case plus the `text/csv`
mime case, so the record is a live fence rather than a note.

---

## Counts — every fence, before and after

Read from the count gate's **own persisted JSON report** on the final green run, never hand-counted.

| Suite | before | after | note |
|---|---|---|---|
| `panel/__tests__/FilesSection.test.tsx` | 11 | **22** | **+11, ADDITIONS ONLY** — `git diff --numstat` = `272  0`, i.e. **zero removed lines**; no title renamed, no `expect` weakened |
| `panel/__tests__/WorkspacePanel.test.tsx` | 58 | 58 | unedited (mounts `FilesSection` at `:464`) |
| `chat/__tests__/OutputFileCard.baseline.test.tsx` | 21 | 21 | unedited |
| `chat/__tests__/StopControl.baseline.test.tsx` | 15 | 15 | unedited |
| `pages/WorkflowRunPage.test.tsx` | 105 | 105 | unedited |
| `lib/__tests__/fileIcon.test.tsx` | 41 | 41 | unedited |
| `__tests__/components/MessageItem.finalOutputs.test.tsx` | 11 | 11 | unedited |
| `files/__tests__/FileRow.test.tsx` | 40 | 40 | unedited |
| `files/__tests__/fileRowUtils.test.ts` | 22 | 22 | unedited |

**No file DECREASED.** `tsc --noEmit -p tsconfig.app.json` = **33**, unmoved, with **zero** errors in
`FilesSection.tsx` or `FileRow.tsx` (the three that mention `FilesSection.test.tsx` are the
pre-existing `TS2304: Cannot find name 'WorkspaceFile'` at `:149/:159/:168`, present at base and part
of the 33 — see deviation 3).

**Gate verdict, quoted verbatim, from the second run:**

```
  total 4147  ·  failed 0  ·  pinned total 4073
count gate OK — 82/82 pinned files present, no per-file decrease, 0 failing.
```

**Pin raised `11 → 22`, in the same commit as the tests, read from the gate's own printed `actual`
column** (`FilesSection.test.tsx  11  22  +11`).

---

## ⚠ THE GATE WENT RED ONCE, AND THE FAILING FILE WAS CAPTURED BEFORE ANY RE-RUN

Two gate runs: **run 1 red with `failed 1`; run 2 green.** Per the 193.2-02 rule the failing filename
was extracted from the gate's **own persisted JSON**, not by re-running anything:

| File | failing | signature | byte-identical to base? |
|---|---|---|---|
| `src/pages/WorkflowsPage.test.tsx` | 1 | `Error: STACK_TRACE_ERROR` | ✅ **yes** — `git diff --numstat 57601b6f HEAD` empty **and** `git status --short` empty for it |

Case: *"D-17: the project filter holds STARTERS out, and says so …"*. This is **SEED-171's first named
suite**, with SEED-171's dominant signature, in a file this plan never opened, on a run where the
`FilesSection` suite itself passed 22/22. Nothing was waved through on "it's probably the flake": the
byte-identity was checked against the recorded base SHA before the second run, and the second run of
the **same tree** read `failed 0`.

⚠ **Recorded as an observation, not as a clean bill of health.** One green sample of a flaky suite is
not proof of innocence — that is exactly the trap 195-03 named. What *is* solid: the file is provably
unmodified, and my own eight fence suites were green on both runs.

---

## Plants — ten, every one verified to APPLY, observed RED with case NAMES, restored md5-identical

⚠ **The harness aborts with `FATAL: plant did not apply` on an empty diff.** Source here is **CRLF**,
and 195-03 measured two plants matching nothing and **reporting GREEN** — an inert plant fails in the
reassuring direction, exactly like an inert fence. Every plant below printed a non-zero `diff-lines`
before its run.

| Plant | File | Reds | Named cases |
|---|---|---|---|
| **P5(a)** drop the `ref` callback on the row child | `FilesSection.tsx` | 1 | `ArrowDown moves focus to the next option row and ArrowUp returns` |
| **P5(b)** drop `mimeType={file.mime_type}` | `FilesSection.tsx` | 2 | both mime-first cases (`text/csv`, `image/png`) |
| **P5(c)** drop the nine `EXT_MAP` code rows | `fileIcon.tsx` | 1 | `a .sql file renders the CODE glyph…` |
| **P5(d)** drop `metaSuffix` | `FilesSection.tsx` | **4** | incl. the **SHIPPED** `shows formatBytes · v{version} meta per row` |
| **P5(e)** converge the panel density onto the global muted token | `FileRow.tsx` | 1 | `the row keeps the PANEL-scoped muted token…` |
| **P5(f)** converge the label onto the basename | `FilesSection.tsx` | 1 | `the label is the FULL PATH in font-mono…` |
| **P5(g)** converge the padding onto the run page's `px-2` | `FilesSection.tsx` | 1 | `the option row keeps its shipped px-2.5 py-2 padding…` |
| **P5(h)** give the panel row a download affordance | `FilesSection.tsx` | 1 | `activating a row opens the PREVIEW and renders no download affordance` |
| **P5(i)** revert the tables category glyph | `fileIcon.tsx` | 2 | the glyph-delta case **and** the `text/csv` mime case |
| **P5(j)** change the unknown-extension default | `fileIcon.tsx` | 1 | `NEGATIVE CONTROL: an extension in NO map…` |

md5s restored: `FilesSection.tsx` `1440032f5e7116324c11c531f84c1b8c` · `fileIcon.tsx`
`e2622f626e4d9b41d72325ad2a809add` (identical to the sum 195-03 recorded) · `FileRow.tsx`
`d87b7995f8f7a794f8ef4b5cd440c5bb`.

**All eleven new cases have a plant that reds them.** Two results worth naming:

- **P5(a) is the whole reason task 2 exists.** `FileRow.test.tsx` unit-tests a ref passed **to** the
  row; nothing tested a ref passed to the row's **caller-supplied child**, which is the one `rowRefs`
  actually uses. Had Radix's `Slot` swallowed the child ref, arrow-key navigation would have died
  **silently, for keyboard users only**, with all 11 shipped cases and all 40 `FileRow` cases green.
  It does not swallow it — but that is now a measurement, not a hope.
- **P5(d) reds a SHIPPED case**, which is the shipped contract proving it still guards the meta string
  after the string moved into a different component.

---

## Deviations from Plan

### ⚠ 1. [Rule 3 — blocking] The worktree forked from the WRONG BASE. **18th recorded instance.**

`git rev-parse HEAD` read **`fda792141b0129de7b15dd40ddc1082e76f95a2a`** — the same `master` merge
commit 195-02 and 195-03 landed on — and `git merge-base HEAD 57601b6f` returned `3781a3fe`, not
`57601b6f`. Exactly as the briefing predicted. `git reset --hard 57601b6f` applied; **HEAD after the
reset is `57601b6fd0e3c969aacd57cc5b1e497a7b8b6990`** (`fix(195): raise the fileIcon pin 11 -> 41`).
The assertion is the only reason this was caught, and it has now fired 7/7 in Phase 194, 8/8 in 194.1,
and 3/3 in Phase 195's wave-2/3 executors.

### ⚠ 2. [stated deviation] I EDITED `scripts/vitest-count-gate.cjs`, which this plan forbids

The plan's task 2 says, verbatim: *"`scripts/vitest-count-gate.cjs` is NOT in this plan's
`files_modified` and must not be edited here … hand the pin raise to plan 195-07."* **I edited it
anyway, raising `FilesSection.test.tsx` from 11 to 22 in the same commit as the tests.**

The reason is that the orchestrator's wave-3 briefing overrides it explicitly, names the incident that
caused the override, and puts it in this plan's success criteria: *"If you grow `FilesSection.test.tsx`,
**raise its pin in `scripts/vitest-count-gate.cjs` IN THE SAME COMMIT** … The orchestrator had to
correct 195-03 for leaving a grown file's pin stale: a pin of 11 against an actual of 41 lets thirty
cases be deleted while the gate stays green."* That correction is itself already **committed inside the
gate file** at the `fileIcon.test.tsx` entry, so deferring my pin to wave 4 would have re-created, in
the same file, the exact defect the file now documents.

**The cost is real and is stated rather than glossed:** the plan's reason for the prohibition was
merge surface with the concurrent sibling (195-04), whose own pin entry sits a few lines above mine.
Mitigation: the edit is **one number plus a comment block**, no logic touched, and
`git diff --numstat` reads `25  1` on that file. If it conflicts on merge, the resolution is to keep
both pins.

### 3. [recorded, not fixed] Three pre-existing `tsc` errors in the suite I grew — deliberately LEFT

`FilesSection.test.tsx:149/:159/:168` each read `TS2304: Cannot find name 'WorkspaceFile'` — the file
casts its template fixtures `as unknown as WorkspaceFile` and **never imports the type**. Those three
are part of the baseline **33** and predate this phase.

I did **not** fix them, and the reason is that fixing them would take `tsc` to **30**, while every
plan in this phase (including mine) has an acceptance criterion reading *"equals the `195-BASELINE.md`
figure"*, i.e. **33**. A silent improvement would red every sibling's gate for a reason none of them
could diagnose. Consequently my eleven new fixtures are **plain object literals with no cast**, so
they add zero new errors — `tsc` is 33 before and after. Out of scope per the scope-boundary rule;
logged here for 195-08 rather than acted on.

### 4. [Rule 1 — bug in my own work] One new case failed first time for a reason unrelated to its subject

`activating a row opens the PREVIEW…` used a bare `row.click()`, which fires **outside `act(...)`**, so
React's state update had not flushed when the assertion ran (`expected null not to be null`, plus the
act warning). Rewritten to `await userEvent.setup().click(row)` like the shipped cases, with the reason
in the case's comment. *A case that reds for a reason other than its subject is noise a future reader
will spend an hour on.*

---

## Threat model — dispositions discharged

| Threat ID | Disposition | How |
|---|---|---|
| T-195-05-01 Info disclosure — which thread's files are listed | ✅ mitigated | `grep -c useViewingThread` on `FilesSection.tsx` → **3** (it stayed at SECTION level); on `FileRow.tsx` → **0**. The shared row reads no hook and cannot resolve a thread |
| T-195-05-02 Tampering (XSS) via `file.path` as the label | ✅ mitigated | `grep -c dangerouslySetInnerHTML` on `FilesSection.tsx` → **0**; the path is a React text child of the shared row, whose markup-as-text case (plan 03) covers the sink. The full-path case asserts the literal string renders as text |
| T-195-05-03 DoS — render crash on a hostile extension | ✅ mitigated | inherited unchanged: the local map is GONE, so `fileIcon`'s own-property guard is the only lookup, and no local map was reintroduced (`grep -c "function iconFor\|OOXML_DOCX"` → 0) |
| T-195-05-04 EoP via the preview activation | ✅ mitigated | `openFile` → `setSelected` → `<FilePreview threadId={threadId} …>` all stay in the section, gated on `selected && threadId`; `grep -c FilePreview` on `FileRow.tsx` → **0**. The new activation case asserts the row itself exposes no download path |
| T-195-05-SC package installs | ✅ n/a | **`git diff --numstat 57601b6f HEAD -- frontend/package.json frontend/package-lock.json` is EMPTY.** No install attempted; `@radix-ui/react-slot` was already a dependency |

---

## Known Stubs

**None.** Every prop the panel hands the shared row is rendered, and every prop it deliberately omits
(`trailing` is `"none"`, `supersedes`/`errorText` are unused) has an assertion covering the absence.

## Threat Flags

None. No new network endpoint, route, hook, persistence or dependency; no file outside
`components/panel/` and the gate pin was touched.

---

## Owed onward

- **195-07** — its arm 2 (`FilesSection.tsx` declares neither helper) is satisfied **now**; both greps
  return 0. Its plant (b)/(c) will therefore red as designed. Its `codeOf(...)` stripper must handle
  this file's docblock, which legitimately discusses both helper names in prose (the plan anticipates
  exactly this).
- **195-08** — the three pre-existing `TS2304` errors in `FilesSection.test.tsx` (deviation 3), and
  `FilesSection.tsx` is now **7 commits / 4 phases / 298 lines**: it crosses G-5 and is **absent from
  the hot-file ledger**, as `195-BASELINE.md` already flagged.
- **SEED-171** — no new suite to add; run 1's single failure was `WorkflowsPage.test.tsx`, already the
  seed's first named file, with the dominant `STACK_TRACE_ERROR` signature.

---

## Verification checklist

- [x] `bash scripts/bootstrap-worktree.sh "$(pwd)"` ran **FIRST** — `BOOTSTRAP OK`
- [x] Base asserted, drift caught (`fda79214`), reset to **`57601b6f`**, corrected HEAD echoed
- [x] Every task committed individually (`e167d380`, `ad4771df`)
- [x] `FilesSection.test.tsx` **11/11 green with ZERO edits at the task-1 commit**, then 22/22
- [x] `WorkspacePanel.test.tsx` 58/58, unedited
- [x] Both duplications **and their confession comment** deleted; the shared ones consumed
- [x] Nine-extension question VERIFIED mechanically against the panel's real 14-entry list — zero missing
- [x] Pin raised 11 → 22 from the gate's own `actual` column, **same commit** as the tests
- [x] Every other fence at its exact count; `tsc` still **33**
- [x] Ten plants applied (CRLF-verified), red with case names, restored md5-identical
- [x] `.planning/STATE.md` / `.planning/ROADMAP.md` untouched (`git diff --numstat` empty)

## Self-Check: PASSED

All three modified files present on disk plus this SUMMARY; both task commits present in
`git log --oneline --all` (`e167d380`, `ad4771df`); `git diff --numstat 57601b6f HEAD` lists **exactly
three** paths (`FilesSection.tsx`, `FilesSection.test.tsx`, `vitest-count-gate.cjs`) and nothing else;
`.planning/STATE.md` and `.planning/ROADMAP.md` show an empty `git diff --numstat` against `57601b6f`
**and** an empty `git status --short`, i.e. untouched both committed and uncommitted. The
`FilesSection.tsx` hot-file triple quoted above (**7 / 4 / 298**) was re-derived with `CLAUDE.md`'s
recipe at close, not copied from `195-BASELINE.md`.

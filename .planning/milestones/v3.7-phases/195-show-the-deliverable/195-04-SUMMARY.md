---
phase: 195-show-the-deliverable
plan: 04
wave: 3
subsystem: frontend/chat-file-presentation
tags: [RUN-03, adoption, asChild, byte-identity, D-07, D-08, D-13, D-14, P7, plants]
requires:
  - "195-03 (FileRow.tsx, fileRowUtils.ts, the widened fileIcon.tsx)"
  - "195-02 (OutputFileCard.baseline.test.tsx — the fence authored BEFORE this change)"
  - "195-BASELINE.md (BASE_SHA f2eef045, the two call-site md5s, tsc 33)"
provides:
  - "OutputFileCard re-implemented on the shared row with ZERO rendered-output change"
  - "The FIRST of the three surfaces converted — D-07's consolidation begins with the surface that had no coverage at all six days ago"
  - "A 23-state before/after DOM capture proving the conversion byte-for-byte, not by test-passing"
  - "Seven D-08 plants re-driven against the converted code, with the three that MOVED named"
affects:
  - "195-05 / 195-06 (the other two adoptions — this plan is the worked example)"
  - "195-07 (the source sweep + P7(a)/P7(c); ⚠ read the P7(a) finding below BEFORE writing that assertion)"
  - "195-08 (the hot-file ledger sync — OutputFileCard.tsx's re-derived triple is below)"
tech-stack:
  added: []
  patterns:
    - "asChild adoption where the CALLER keeps the wrapper element, the download call and the error state"
    - "before/after outerHTML capture as the refactor proof, with a normalizer that separates class-token ORDER from class-token SET"
key-files:
  created: []
  modified:
    - frontend/src/components/chat/OutputFileCard.tsx
decisions:
  - "D-195-04-A: the caller's classes stay on the ANCHOR, not on FileRow's className prop — measured to reproduce the pre-change class attribute byte-for-byte"
  - "D-195-04-B: the dead branch does NOT pass sizeBytes — today's dead row renders no size cell even when the payload carries one, and that absence is part of D-08"
  - "D-195-04-C (ACCEPTED DELTA): the dead branch's name span emits its class TOKENS in a different ORDER. Same token set, same rendering. Not fixable from this file, and FileRow.tsx is a wave-2 file this plan must not touch"
  - "D-195-04-D (FINDING, owed to 195-07): `git diff --numstat <BASE> HEAD` is BLIND to an uncommitted call-site edit — driven, not reasoned"
metrics:
  tasks: 2
  commits: 2
  plants_driven_red: 7
  states_captured: 23
  duration_minutes: 41
  completed: 2026-08-17
---

# Phase 195 Plan 04: Chat's output card renders the shared row — Summary

**The chat output-file card's interior now comes from `components/files/FileRow`, and 18 of 23
rendered states are RAW BYTE-IDENTICAL to what shipped before the edit — 23 of 23 once class-token
ORDER is normalised away. The public prop shape's md5 is unchanged, so neither call site was opened.**

**Measured base SHA: `57601b6fd0e3c969aacd57cc5b1e497a7b8b6990`** — asserted, and **the assertion
FIRED**. See Deviations.

---

## Commits

| # | Hash | Subject |
|---|---|---|
| 1 | `50b4d8b2` | `refactor(195-04): chat's output card renders the shared row — zero behaviour change` |
| 2 | *(this file)* | `docs(195-04): the byte-identity proof and the seven re-driven plants` |

**Task 2 modified no source.** It is a pair of PROOFS about task 1's output, so its artifact is this
record rather than a diff. Stated plainly instead of manufacturing a commit to look symmetrical.

**`git diff --numstat 57601b6f HEAD` for the whole plan is exactly one line:**
`109  77  frontend/src/components/chat/OutputFileCard.tsx` — `files_modified`'s single entry, honoured.

---

## ⚠ HOW ZERO BEHAVIOUR CHANGE WAS PROVED — NOT "the tests pass"

The wave-1 fence is 21 cases. A conversion can satisfy 21 assertions and still move the DOM in ways
none of them read. So the proof is a **before/after capture of the rendered `outerHTML` itself**,
driven through a throwaway harness that was written BEFORE the edit, run against the UNMOVED
component, then re-run against the converted one and deleted (never committed).

**23 states captured, per state, in both trees:**

| Group | States |
|---|---|
| Live | plain · with size · **size 0** · with `supersedes` · `variant="hero"` · `variant="working"` · absolute (non-`/`) url · extension-less name · **`x.constructor`** · path-shaped name · markup-shaped name **and** markup-shaped `supersedes` · `.csv` · `.sh` |
| Dead | plain · with a size in the payload · with `supersedes` · `variant="hero"` · markup-shaped name |
| Interactive | **downloading** (helper never settles) · **`DownloadError` copy** · **network-error copy** |
| Behavioural | the **arguments** `downloadSandboxOutput` was called with · the **re-entrancy** guard's call count |

**Result:**

```
cases: 23
RAW outerHTML identical:                              18 / 23
RAW differing keys: ["dead-plain","dead-size","dead-supersedes","dead-hero","dead-xss"]
NORMALIZED (tag + attribute SET + class-token SET):   23 / 23
NORMALIZED differing keys: []
```

Everything the live branch renders — **including the anchor's full attribute list in its original
order, the 30 px `fileIcon` glyph with its `.DOCX` ribbon and its inline category hex, the size cell,
the `Download`/`Loader2` trailing glyph, the error line and the class attribute** — is byte-for-byte
unchanged. So are the two behavioural captures:

| Behaviour | Before | After |
|---|---|---|
| `downloadSandboxOutput` call args | `[["/sandbox-outputs/renewal-letter.docx","renewal-letter.docx"]]` | **identical** |
| calls after a second click while downloading | `1` | **identical** |

### The ONE delta, stated rather than glossed (D-195-04-C)

All five differing states are dead-branch rows, and the difference is entirely this:

```
BEFORE  <span class="font-mono text-foreground/60 truncate">
AFTER   <span class="font-mono truncate text-foreground/60">
```

Same three tokens, different order. It arises inside `FileRow` — the chat density composes the dead
skin as `cn(nameClass, deadOverrides.nameClass)`, and `twMerge` drops the superseded
`text-foreground/80` and appends the survivor. **It is not addressable from `OutputFileCard.tsx`, and
`FileRow.tsx` is a wave-2 file this plan is forbidden to touch** (two sibling agents are in this
wave). CSS class order in the attribute has no effect on cascade resolution — specificity and source
order in the stylesheet decide, not attribute order — so the rendering is identical. Recorded here
and in the file's docblock rather than left for a reviewer to discover in a diff.

### What this proof does NOT claim

- **No browser was rendered.** This is jsdom `outerHTML` plus computed call arguments — it proves the
  MARKUP and the CALLS are unchanged, not that a human looked at the row. The visual arm belongs to
  D-20's post-change acceptance, which is not this plan's.
- **The 3 s auto-clear timing is not captured**, only the error line it produces. `setTimeout` is
  still present (`grep -c` → 1) and untouched, and D-195-02-C deliberately left the timer uncovered.

---

## The seven plants, re-driven against the CONVERTED body — and the three that MOVED

⚠ **A fence goes inert when the code it guards moves** (5 inert fences shipped in 193.2, 4 in 193.1).
Every plant below was applied to the code **in its new home**, observed RED with **failing case
NAMES**, then restored with **md5 before == after**.

⚠ **Both source files are CRLF** (measured: 219/219 and 275/275 line terminators), so every payload
uses `\r\n` and the harness **aborts on an empty diff** — the 195-03 trap, honoured by construction
rather than by care.

| # | Plant | **File planted** | Failing case NAMES | Verdict | vs plan 02 |
|---|---|---|---|---|---|
| **P3(a′)** | remove `supersedes={file.supersedes}` from the LIVE `FileRow` | `OutputFileCard.tsx` | *LIVE branch: a url-bearing file with `supersedes` renders the Replaces subline* · *the LITERAL is `Replaces: ` …* · *a markup-shaped `supersedes` renders as LITERAL TEXT…* | `3 failed \| 18 passed (21)` | **IDENTICAL** — same 3 names, same count; **dead case stayed GREEN** |
| **P3(b′)** | remove `supersedes={file.supersedes}` from the DEAD `FileRow` | `OutputFileCard.tsx` | *DEAD branch: a file with NO url and `supersedes` renders the SAME subline* — and nothing else | `1 failed \| 20 passed (21)` | **IDENTICAL**; **live case stayed GREEN** |
| **P2(a′)** | remove `data-dead="true"` | `OutputFileCard.tsx` | *(a) the ATTRIBUTE clause: the row carries data-dead="true"* · *DEAD branch: …* | `2 failed \| 19 passed (21)` | **IDENTICAL**; **the COPY case (b) stayed GREEN** |
| **VARIANT′** | add `variant === "hero" ? "shadow-lg" : ""` to the anchor's class merge | `OutputFileCard.tsx` | *hero and working render the SAME tag, the SAME class list and the SAME children* — only | `1 failed \| 20 passed (21)` | **IDENTICAL** |
| **P3(c′)** | `Replaces: {supersedes}` → `Replaces:{supersedes}` — **ONE character** | ⚠ **MOVED → `FileRow.tsx`** | the same 3 as P3(a′) **plus** *DEAD branch: …* | `4 failed \| 17 passed (21)` | **3 → 4** — see below |
| **P2(b′)** | `DEAD_LABEL` `"Download unavailable"` → `"No link"` | ⚠ **MOVED → `FileRow.tsx`** | *(b) the COPY clause: the row says `Download unavailable`* — and nothing else | `1 failed \| 20 passed (21)` | **IDENTICAL** |
| **UNIFICATION′** *(extra, beyond the six)* | delete the whole `{supersedes && …}` block | ⚠ **MOVED → `FileRow.tsx`** | all four `supersedes` cases | `4 failed \| 17 passed (21)` | new — see below |

**Which plants MOVED, stated as the plan requires:** `P3(c′)` (the `Replaces: ` literal), `P2(b′)`
(the dead copy) and the new `UNIFICATION′` now live in `FileRow.tsx`. `P3(a′)`, `P3(b′)`, `P2(a′)`
and `VARIANT′` stayed in `OutputFileCard.tsx` — the first two as a PROP rather than as a JSX block,
which is exactly the migration, and the last two unchanged in form.

### ⚠ THE `3 → 4` IS THE EXTRACTION BECOMING VISIBLE, AND IT IS THE FENCE GETTING STRONGER

Plan 02's P3(c) red **3** cases because the `Replaces: ` literal was written **twice** and the plant
could only reach the live copy. It is now written **once**, so the same one-character edit reds the
dead case too. **A larger blast radius here is the whole point of the phase** — the two arms are no
longer able to drift apart. The independence that D-08 asks to survive did not disappear with it:
`P3(a′)` and `P3(b′)` still red their own branch **and leave the other GREEN**, because the seam moved
from "two blocks" to "two props" rather than vanishing.

**A plant that produced a SKIP would have proven nothing** (194-12) — none did; every run reported
`N failed | M passed (21)`. **WHICH cases failed was read, never just how many** (194-06).

---

## ⚠ FINDING D-195-04-D — `git diff --numstat <BASE> HEAD` CANNOT SEE AN UNCOMMITTED CALL-SITE EDIT

**Owed to plan 195-07, which writes this assertion for real.** Driven, not reasoned.

The plan asked for a P7(a) plant: *"plant a one-character edit into `MessageItem.tsx` and prove the
numstat check FAILS."* It was driven — **one space byte inserted at offset 5378, size 48235 → 48236,
verified to be exactly +1 byte** — and the result was:

| Check, with the plant applied | Output | Fires? |
|---|---|---|
| `git diff --numstat f2eef045 HEAD -- MessageItem.tsx ExecuteCodeBody.tsx` | **EMPTY** | ❌ **NO** |
| `git diff --numstat f2eef045 -- MessageItem.tsx ExecuteCodeBody.tsx` (working-tree form) | `1  1  frontend/src/components/chat/MessageItem.tsx` | ✅ yes |
| `md5sum MessageItem.tsx` | `aa0d89a716739acde9fd616044809172` ≠ baseline | ✅ yes |

**`<BASE> HEAD` compares two COMMITS. A working-tree edit is invisible to it by construction.** So the
acceptance criterion as worded is a *commit-history* assertion, not a *byte-identity* one — and the
baseline's own warning (*"a numstat-empty check passes trivially when the base SHA is wrong"*) has a
second, un-recorded arm: **it also passes trivially when the edit is not yet committed.**

**The complete assertion is all three**, and all three are recorded below as PASSING here. The
command shape itself was given a **positive control** so its emptiness is not vacuous:
`git diff --numstat 7e5d1fb8~1 7e5d1fb8 -- <the two files>` → `94  3  MessageItem.tsx`. The shape
fires when the trees genuinely differ.

**Restored md5-identical**, and the working-tree numstat is empty again.

---

## The call sites, proved unopened three independent ways

| Check | Result |
|---|---|
| `git merge-base --is-ancestor f2eef045… HEAD` | **exit 0** — the named base really is behind HEAD |
| Base subject at that SHA | `docs(195): plans verified — 8 plans / 4 waves, checker PASSED first iteration` — matches `195-BASELINE.md` verbatim |
| `git diff --numstat f2eef045… HEAD -- MessageItem.tsx ExecuteCodeBody.tsx` | **EMPTY** |
| `git diff --numstat f2eef045… -- <same>` (working-tree form) | **EMPTY** |
| `md5sum MessageItem.tsx` | `4a83da8b27f91e70ff3e18d2ce181242` — **exactly the baseline's** |
| `md5sum ExecuteCodeBody.tsx` | `386ed875acf6938f3fbcd0bac38777ab` — **exactly the baseline's** |

⚠ **The BASE_SHA was NAMED (`f2eef045096efabdf7f05a1175271272b55617b9`), never `HEAD~N`** — and it is
NOT this worktree's dispatched base (`57601b6f`), which is a descendant. Both are quoted so a reader
can tell the phase's anchor from this plan's fork point.

**And it is structural, not disciplinary.** The props interface block is byte-identical:

```
sed -n '/^interface OutputFileCardProps/,/^}/p'  →  md5 545b317289222e38b09139e8dcc41e55  (both trees)
grep -c "export interface OutputFileCardProps\|export type OutputFileCardProps"  →  0
export function OutputFileCard({ file, variant = "working" }: OutputFileCardProps)   ← unchanged
```

Neither call site *could* have needed touching. D-14's decline is honoured by construction, which
matters because `MessageItem.tsx` measures **29 phases with an UNDISCHARGED G-5 extraction
obligation** — opening it would have been the expensive half of this plan.

---

## P7(c) — chat gained NO new interactive element (D-13)

Read off the **post-conversion capture**, across all 21 rendered rows:

| Property | Before | After |
|---|---|---|
| `<button>` count in every chat row | **0** | **0** |
| `<input>` / `<select>` / `<textarea>` | 0 | **0** |
| `tabindex` anywhere in the row | 0 | **0** |
| `role` on the root | absent | **absent** |
| Live root element | `A` | **`A`** |
| Dead root element | `DIV` | **`DIV`** |

**Violations: 0.** Positive control: the same probe returns `1` on `<div><button>x</button></div>`, so
the six zeros are not vacuous.

**D-07 and D-13 are both satisfied and were not conflated:** the presentation converted (one row
markup now serves chat), the capability did not (no new control, prop, fetch, state or import).

---

## Verification

| Check | Result |
|---|---|
| `bash scripts/bootstrap-worktree.sh` ran FIRST | ✅ `BOOTSTRAP OK` |
| Base asserted == `57601b6f` | ✅ after correcting a wrong-base fork (see Deviations) |
| `tsc --noEmit -p tsconfig.app.json` | ✅ **33** — the `195-BASELINE.md` floor, unmoved; **0** errors in the changed file |
| Count gate verdict, quoted verbatim | ✅ `count gate OK — 82/82 pinned files present, no per-file decrease, 0 failing.` · `total 4136 · failed 0 · pinned total 4062` — **first run, no re-run needed** |
| Ungated run of all eight fence suites | ✅ **8 files / 266 passed / 0 failed** = 105+11+11+41+15+21+40+22, the eight pins summed |
| `grep -c formatBytes` in the changed file | ✅ **0** |
| `grep -c FileRow` | ✅ **6** (≥ 2 required) |
| `downloadSandboxOutput` · `resolveOutputUrl` · `VITE_API_BASE_URL` · `data-dead` · `aria-disabled` all still present | ✅ 2 · 2 · 1 · 1 · 2 |
| `grep -c setTimeout` (the 3 s auto-clear) | ✅ **1** |
| `grep -c dangerouslySetInnerHTML` (T-195-04-01) | ✅ **0** |
| `OutputFileCardProps` still UNEXPORTED | ✅ **0** |
| Props interface md5 identical | ✅ `545b317289222e38b09139e8dcc41e55` |
| Every fence file byte-unchanged vs base | ✅ **EMPTY** numstat for all 8 + `vitest-count-gate.cjs` |
| `package.json` / `package-lock.json` untouched | ✅ **EMPTY** — no package installed, no `slopcheck` owed |
| `FileRow.tsx` / `fileRowUtils.ts` / `fileIcon.tsx` byte-unchanged | ✅ **EMPTY** — no wave-2 file touched |
| `git diff --diff-filter=D` on this plan | ✅ **EMPTY** — nothing deleted |
| `.planning/STATE.md` / `ROADMAP.md` | ✅ **UNTOUCHED**, committed and uncommitted |
| Working tree clean after every plant | ✅ `git status --short` empty |

### Per-file fence counts, before → after

| Fence | Before | After | Δ |
|---|---|---|---|
| `OutputFileCard.baseline.test.tsx` | 21 | **21** | 0 |
| `MessageItem.finalOutputs.test.tsx` | 11 | **11** | 0 |
| `WorkflowRunPage.test.tsx` | 105 | **105** | 0 |
| `FilesSection.test.tsx` | 11 | **11** | 0 |
| `fileIcon.test.tsx` | 41 | **41** | 0 |
| `StopControl.baseline.test.tsx` | 15 | **15** | 0 |
| `FileRow.test.tsx` | 40 | **40** | 0 |
| `fileRowUtils.test.ts` | 22 | **22** | 0 |
| **gate grand total** | 4136 | **4136** | 0 |
| **gate pinned total** | 4062 | **4062** | 0 |

⚠ **`195-03-SUMMARY.md` records `pinned total 4032`. It is not stale and it is not wrong** — the base
commit `57601b6f` (*"raise the fileIcon pin 11 → 41"*) added the missing **+30**. Recorded beside the
earlier figure so a later reader does not chase a phantom drift.

⚠ **This plan adds NO test cases, so a flat grand total is the correct reading here** — the usual
"a growing number is the gate WORKING" note does not apply to a pure adoption plan, and a *changed*
total would have been the thing to explain.

**SEED-171 did not fire.** The gate came back clean on its **first** run with a sibling agent active,
so there were no failing filenames to capture and the capture-before-re-run rule had nothing to
record. Stated as a measured fact rather than left to silence.

---

## Threat model — dispositions discharged

| Threat ID | Disposition | How |
|---|---|---|
| **T-195-04-01** Tampering (XSS) on `filename` / `supersedes` | ✅ **mitigated** | `grep -c dangerouslySetInnerHTML` → **0**. Both strings remain React TEXT children through the shared row — proved on the rendered bytes, not asserted: four capture states drive `<img src=x onerror="alert(1)">` through `filename` and `supersedes` in **both** branches, and the captured `outerHTML` contains the escaped `&lt;img …&gt;` and **no `img` element**, byte-identically before and after |
| **T-195-04-02** XSS via URL scheme in `resolveOutputUrl` | ⚠ **ACCEPTED, unchanged, with its trigger restated** | `resolveOutputUrl` passes through any `url` not starting with `/`, so a `javascript:` value would be a real sink. Pre-existing, **byte-unchanged by this plan** (the function and its `API_BASE` read are untouched), and out of scope by D-08. `file.url` is emitted by the backend's `harvest_output_files`. **Re-open trigger, unchanged: any change that lets a user or a connector supply `OutputFile.url`, or any phase that opens `resolveOutputUrl` for another reason, adds a scheme allow-list in the same commit.** The seed is plan 195-08's to file — flagged again here so it cannot be lost between the two |
| **T-195-04-03** EoP via the `dead` affordance | ✅ **mitigated** | The gate is the `if (!file.url)` branch itself — a url-less file renders the dead root and **no anchor exists to click**. Structurally preserved: the dead root is still a `DIV`, still carries `data-dead="true"`, and the affordance is a `<span aria-disabled>` with **zero `<button>`** in the row, measured across all 5 dead capture states. `aria-disabled` remains presentational, never authorization |
| **T-195-04-04** Info disclosure via the shared row acquiring data access | ✅ **mitigated** | `FileRow` receives `name`, `sizeBytes`, `supersedes`, `errorText`, `trailing`, `density` — **no thread id, no file id, no URL**. The download call, the resolved href and the error state all stay in `OutputFileCard.tsx`. There is no path by which chat's row could resolve or fetch another thread's file |
| **T-195-04-SC** package installs | ✅ **n/a** | `git diff --numstat 57601b6f HEAD -- frontend/package.json frontend/package-lock.json` **EMPTY**. `@radix-ui/react-slot` was already a dependency and is not even imported here — the `asChild` mechanics live entirely in `FileRow`. **No install attempted; no `slopcheck` owed** |

---

## Known Stubs

**None.** Every prop passed to the shared row is rendered, and every deliberate omission is asserted
by an existing case: the dead branch passes no `sizeBytes` and renders no size cell (5 capture
states); `errorText` is `null` until a download fails and renders nothing (proved by the 18
raw-identical live states, none of which carries an error line); `is_hero` remains
written-but-unread, as D-095.1-06 left it.

## Threat Flags

**None.** No new endpoint, fetch, route, hook, persistence, auth path or dependency. The only
security-relevant surface — model-derived strings reaching JSX — moved between two files that both
render them as text, and the capture proves the escaped bytes are identical.

---

## Deviations from Plan

### ⚠ 1. [Rule 3 — blocking] The worktree forked from the WRONG base. **18th recorded instance.**

`git rev-parse HEAD` read **`fda792141b0129de7b15dd40ddc1082e76f95a2a`** — the same `master` merge
commit that caught 195-02 and 195-03 — and `git merge-base HEAD 57601b6f` returned **`3781a3fe`**,
not the expected SHA. `git reset --hard 57601b6f` applied per the dispatch's own assertion block;
the corrected HEAD was re-verified before the plan was read.

7/7 in Phase 194, 8/8 in 194.1, and now 3/3 in this phase's dispatches. **The assertion is the only
reason it was caught**, and its value compounds here: every byte-identity claim above is measured
against a base, and a wrong base would have made most of them trivially true.

### ⚠ 2. [Rule 1 — bug in my own harness] The plant harness's md5 check was a FALSE PASS

The first driven plant printed `md5 RESTORE OK:` with **an empty value on both sides**. The helper
crashed on an absent argument in `md5` mode, so the shell captured `""` for both readings and
`[ "" = "" ]` reported success — **a restore check that could not fail, reporting that the restore
was fine.**

Caught by reading the output rather than the exit code, fixed (the helper now exits non-zero on an
empty digest and the driver refuses to run a plant whose restore check cannot fire), and **every
plant including the first was re-driven under the fixed harness.** The restore was independently
corroborated against `git status --short` and against the committed md5.

*This is the 195-03 lesson landing one level up: the harness that verifies the fences needs its own
verification, and it too failed in the reassuring direction.*

### 3. [Rule 3] One plant's restore anchor was the EMPTY STRING

`P2(a′)` deletes `data-dead="true"` with no replacement, so the reverse substitution matched at
**12,053 positions** and the harness **aborted** — correctly, rather than corrupting the file. The
plant itself had already fired and been read. Restored with
`git checkout -- frontend/src/components/chat/OutputFileCard.tsx` (the sanctioned single-file form —
never a blanket reset, never `git clean`) and md5-verified. The remaining empty-replacement plant
(`UNIFICATION′`) was re-authored to substitute a unique marker instead.

### 4. [Scope +1] A seventh plant, beyond the six the plan named

`UNIFICATION′` deletes the shared `supersedes` block outright. The six named plants prove the fences
still fire; this one measures **what the extraction actually changed** — one deletion now reds all
four `supersedes` cases where before it took two separate edits. Without it, the `3 → 4` delta on
`P3(c′)` would have looked like a fence behaving oddly instead of the two copies having become one.

### 5. [D-195-04-C] One accepted rendered-byte delta

Fully documented above. Class-token ORDER on the dead branch's name span. Same set, same rendering,
not addressable without editing a wave-2 file that two sibling agents are working beside.

### 6. [D-195-04-D] The P7(a) plant did NOT red the check the plan named

Fully documented above, with all three command forms driven and a positive control on the shape.
**Not smoothed over: the criterion as worded is incomplete, and plan 195-07 needs all three arms.**

---

## What this plan does NOT claim

1. **No browser rendered this.** The proof is jsdom markup plus call arguments. A human has not
   looked at the converted row, and D-20's visual acceptance is not discharged here.
2. **The two other surfaces are NOT converted.** Plans 195-05 (panel) and 195-06 (run page) own
   those, and SC#2 is not satisfiable until all three land. This plan converted the surface that had
   **zero** direct coverage six days ago — which is why it went first among the three.
3. **The dead-branch class-token order IS different.** Recorded as a delta, not claimed as identity.
   "18/23 raw-identical" is written that way on purpose; "the conversion is byte-identical" would
   have been false.
4. **`FilesSection`'s and the run page's glyph deltas are untouched by this plan.** `fileIcon`'s
   measured four-category glyph change (`FileSpreadsheet → Table` etc.) lands when 05/06 convert
   those surfaces. Chat already used `fileIcon`, so chat sees none of it — which is precisely why
   chat's conversion could be byte-identical and the other two cannot be.
5. **The 3 s auto-clear timer is still uncovered** (D-195-02-C). Its presence is asserted; its timing
   is not.

---

## For plan 195-08 — the re-derived hot-file triple

Recipe applied verbatim from `CLAUDE.md`, six-digit dated quick-task buckets subtracted (there are
none on this file):

| File | commits / phases / lines | Buckets | vs `195-BASELINE.md` |
|---|---|---|---|
| `frontend/src/components/chat/OutputFileCard.tsx` | **8 / 7 / 219** | `075.2 075.4 075.7 095 095.1 155 195` | was **7 / 6 / 187** — **+1 commit, +1 phase (195), +32 lines**, exactly this plan |

⚠ **It FIRES G-5 at 7 phases and is still ABSENT from the ledger**, as the baseline flagged. The
`docs/HOT-FILE-LEDGER.md` section and the `CLAUDE.md` row must be added in the **same commit**
(the same-commit sync rule) — that is 195-08's, not this plan's.

---

## Self-Check: PASSED

- `frontend/src/components/chat/OutputFileCard.tsx` — **FOUND**, 219 lines
- `.planning/phases/195-show-the-deliverable/195-04-SUMMARY.md` — **FOUND**
- commit `50b4d8b2` — **FOUND** in `git log --oneline --all`
- The temporary capture harness — **DELETED**, never committed (`git status --short` empty; no
  `ZZtmp` path in `git log --stat`)
- `.planning/STATE.md`, `.planning/ROADMAP.md` — **UNTOUCHED**, both committed and uncommitted

---

*Phase 195 Plan 04 — chat's card renders the shared row, and 23 captured states say a user cannot tell.*

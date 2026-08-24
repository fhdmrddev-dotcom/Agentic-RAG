---
phase: 195
slug: show-the-deliverable
status: signed-off-conditional   # ⚠ 2026-08-17, plan 195-08 task 2. Every AUTOMATED contract is
                                 # discharged and measured. ONE manual row is OWED: D-20, the G-4
                                 # lived-experience checkpoint (195-08 task 3). Conditional, not
                                 # complete — see § "Why nyquist_compliant stays false".
nyquist_compliant: false         # ⚠ DELIBERATELY false, with the reason named rather than left to
                                 # silence. Flips to true only when 195-UAT.md carries U1-U6 and
                                 # every row is a PASS; a ⛔ row leaves it false with the row named.
                                 # ⚠ AMENDED 2026-08-17 (195-08 task 3, AFTER the drive) — the two
                                 # comment lines above are PRESERVED, never rewritten. D-20 HAS now
                                 # been driven (`195-UAT.md`): 4 PASS · 0 FAIL · 2 ⛔. The flag STAYS
                                 # false, and the two uncovered rows are NAMED: U1b (download+open on
                                 # the POST-change surface — owed, no blocker) and U4 (multi-file
                                 # newest-first — undrivable; no workflow run has ever produced 2+
                                 # files). See § "Why nyquist_compliant stays false" → the amendment.
wave_0_complete: true            # ⚠ set 2026-08-17 by plan 195-08. All five ❌ MISSING references
                                 # were authored, and the D-16 live baseline landed in a commit that
                                 # PREDATES every source change (the 188.1 rule, honoured in the only
                                 # order that makes it worth anything).
plants_estimated: 27             # 26 + the adopted stripper non-vacuity plant
plants_driven: 75                # ⚠ MEASURED, ~2.9x the estimate. `expect` short-circuits, so a case
                                 # with N substantive clauses needs N plants, not one.
created: 2026-08-17
source: 195-RESEARCH.md § "Validation Architecture" (committed f373aa28)
---

# Phase 195 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> ⚠ **This file is DERIVED from `195-RESEARCH.md` § "Validation Architecture" and is not an
> independent authority.** Where the two disagree, RESEARCH.md's measured evidence wins and this
> file is corrected BESIDE the original, never over it.
>
> ⚠ **26 PLANTS ACROSS 10 CLAIMS — a naive reading of the claims would name 10.** This project
> shipped **5 inert fences in 193.2, 4 in 193.1, 3 in 192.1 and 5 in 190. Every one was caught by
> PLANTING, none by reading.** Every fence below must be observed RED against a real edit to
> **production source**, with the file restored md5-identical afterwards. A fence that fails to red
> is a FINDING, not a formality. ⚠ **A plant that produces a SKIP rather than a RED has proven
> nothing** (194-12).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **vitest 4.1.0** + `@testing-library/react` + `jsdom` (+ `vitest-axe` for the panel a11y cases) |
| **Config file** | `frontend/vitest.config.ts` (+ `frontend/vite.config.ts` aliases). `?raw` is a **Vite loader** — `node:fs` is never used, and `tsconfig.app.json` carries no node types on purpose |
| **Quick run command** | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run --maxWorkers=2 <files>` |
| **Full suite command** | `cd frontend && GSD_VITEST_MAX_WORKERS=2 node ../scripts/vitest-count-gate.cjs` **PLUS the explicit ungated command below** |
| **Typecheck** | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — **baseline 33, measured unmoved 2026-08-17** |
| **Estimated runtime** | ~35 s for the five in-scope suites; gate ~4 min |

⚠ **`GSD_VITEST_MAX_WORKERS=2` IS MANDATORY and matters on a SINGLE run, not only parallel ones**
(`CLAUDE.md` § Parallel execution, re-measured at 193.2 where cap 4 read `failed 17 → 4 → 3` and cap
2 read `0 → 0` on one identical commit). ⚠ **CAPTURE FAILING FILENAMES BEFORE RE-RUNNING ANYTHING**
— 193.2-02 recorded itself breaking this rule and could not afterwards prove its three cases innocent.

### ⚠ THE COUNT GATE DOES NOT COVER THIS PHASE

Measured this session: `TARGETS` has **no entry for `src/components/chat` at all**, and none for
`src/lib` or `src/components/panel`. Of this phase's five suites **only
`src/pages/WorkflowRunPage.test.tsx` is gated.** A green gate therefore says nothing about four
fifths of this phase, and the grand total reads **identically before and after** work that adds
dozens of cases (the Phase 194 lesson, hit twice).

**The ungated set must be run explicitly, every wave:**

```bash
cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run --maxWorkers=2 \
  src/components/panel/__tests__/FilesSection.test.tsx \
  src/__tests__/components/MessageItem.finalOutputs.test.tsx \
  src/lib/__tests__/fileIcon.test.tsx \
  src/components/files/__tests__/
```

**Fresh baselines measured 2026-08-17** (quiet tree, no sibling agent) — treat as stale on sight and
re-derive:

| Measurement | Value | Note |
|---|---|---|
| Count gate | `OK · total 3972 · failed 0 · pinned 3898 · 75/75` | ⚠ **CLAUDE.md's `3918 / 3868` is STALE** — a growing number is the gate WORKING |
| `tsc -p tsconfig.app.json` | **33** | unmoved |
| `WorkflowRunPage.test.tsx` | **102 EXACT, zero slack** | gated + pinned |
| `FilesSection.test.tsx` | 11 | ungated |
| `MessageItem.finalOutputs.test.tsx` | 11 | ungated |
| `fileIcon.test.tsx` | 11 | ungated |
| `StopControl.baseline.test.tsx` | 15 | ⚠ **ungated AND greps `WorkflowRunPage.tsx?raw`** |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit -p tsconfig.app.json` (must stay **33**) + the
  touched suite(s) at `--maxWorkers=2`.
- **After every plan wave:** the count gate **AND** the explicit ungated command above. ⚠ **Both** —
  the gate alone covers one of five suites.
- **Before `/gsd:verify-work`:** gate green (no per-file DECREASE, 0 failing) + ungated set green +
  `tsc` at 33 + **D-20's operator UAT driven with the downloaded file OPENED**.
- **Max feedback latency:** ~35 s (quick) / ~4 min (wave).

⚠ **The gate is NON-DETERMINISTIC at cap 2 and can present as `[missing-file]` WITH `failed 0`,
which reads like a pass at a glance** (194). Read the VERDICT line, never a summary.

---

## Per-Task Verification Map

Requirement → behaviour → proof. `⬜ pending` until execution stamps it.

⚠ **STAMPED 2026-08-17 by plan `195-08` task 2, from the plan SUMMARYs.** The `File exists` column is
preserved **as written at planning time** and a second column records what shipped — so a reader can
see which rows were authored during the phase rather than inherited. **Ten of eleven rows are ✅; the
eleventh is D-20, which is a blocking human checkpoint and is stated as OWED rather than passed.**

| Req | Behaviour | Test type | Automated command | File exists (planning-time) | **Shipped** | Status |
|---|---|---|---|---|---|---|
| RUN-02 | A terminal run's produced file is listed, named, sized, downloadable from the run surface | unit (RTL) | `npx vitest run src/pages/WorkflowRunPage.test.tsx` | ✅ 102 cases | **108** (`195-02` +3, `195-06` +3; two `it()`s INVERTED not deleted) | ✅ **PASS** |
| RUN-02 | The region label makes no run-scope claim it cannot deliver (**D-02**) | unit | same file, heading cases `:897` + `:1023` | ✅ **both must be updated** | both updated + a **third** arm (the word-level sweep, ordered BEFORE the equality) | ✅ **PASS** |
| RUN-02 | The three-way empty state survives the conversion (**D-15**) | unit | same file, `describe("… two empty states say different true things")` | ✅ 3 cases | 3 cases, both strings **byte-unchanged**; P1a/P1b/P1c red one arm each | ✅ **PASS** |
| RUN-02 | Newest-first ordering, **BOTH regimes** (**D-12**) | unit | `npx vitest run src/components/files/__tests__/` | ❌ **Wave 0** | ✅ **AUTHORED** — `fileRowUtils.test.ts` 22 + `FileRow.test.tsx` 40 + 2 run-page cases; **each fixture its own positive control** | ✅ **PASS** |
| RUN-02 | Live run: launch → watch → download → **OPEN THE FILE** (**D-20**) | **manual, operator-driven** | see § "The D-16 live baseline" | ❌ Wave 0 + close | ⚠ **WAVE-0 HALF DRIVEN** (`195-BASELINE.md` arms 0-3, PRE-change: launch, watch, download, byte-exact + CRC-clean OOXML). **The POST-change half is plan `195-08` task 3** | ⚠ **OWED — blocking checkpoint** |
| RUN-03 | Exactly ONE `formatBytes`, ONE icon path, ONE row markup, ONE download dispatcher | unit + **source sweep** | `npx vitest run src/components/files/__tests__/FileRow.sweep.test.ts` | ❌ **Wave 0** | ✅ **AUTHORED** — 20 cases, driven RED **once per swept file**, 4 guarded `?raw` arms. ⚠ **No shared download dispatcher** (D-195-03-C — routing through a util drops a tenancy fence's grep to zero); the two seams stay at their callers **deliberately** | ✅ **PASS** |
| RUN-03 | `OutputFileCard`'s dead-link state survives byte-identical (**D-08**) | unit | `npx vitest run src/__tests__/components/MessageItem.finalOutputs.test.tsx -t "dead-link"` | ✅ `:111-124` | ✅ + **split into four independent cases** in `OutputFileCard.baseline.test.tsx`, because the shipped pair asserts both clauses in one `it()` and **the first short-circuits the second** | ✅ **PASS** |
| RUN-03 | `OutputFileCard`'s `supersedes` subline survives byte-identical (**D-08**) | unit | — | ❌ **ZERO COVERAGE — Wave 0** | ✅ **AUTHORED** — pinned in **BOTH** branches **independently** (deleting one leaves the other GREEN, measured both directions) | ✅ **PASS** |
| RUN-03 | Panel keeps listbox/option + roving tabindex + preview activation + Template badge | unit | `npx vitest run src/components/panel/__tests__/FilesSection.test.tsx` | ✅ 11 (**ungated**) | **22** (+11, additions only, zero removed lines); **now GATED** (adopted `195-02`, pin raised `195-05`) | ✅ **PASS** |
| RUN-03 | Chat gains NO new file affordance (**D-13**) while its presentation converts (**D-07**) | **source sweep + git** | `FileRow.sweep.test.ts -t "chat capability"` + `git diff --numstat` | ❌ **Wave 0** | ✅ **AUTHORED** — 4 selectable cases + **all THREE git/md5 forms** (see FINDING F-b). Prop-set exactness, the interface still unexported, byte-identity to a NAMED base | ✅ **PASS** |
| RUN-03 | Run page still names neither `FilesSection`, `FilePreview` nor `useViewingThread` | source fence | `WorkflowRunPage.test.tsx -t "neither mounts the panel"` | ✅ **two arms INVERT** | ✅ inverted **IN PLACE** with originals quoted; P8a/P8b/P8c each red their own arm **separately** | ✅ **PASS** |

**Zero pending markers remain IN THE MAP.** Ten ✅ PASS, one ⚠ OWED — and the OWED row is a **decision**
(a blocking human checkpoint that has not yet been driven), never a claim that it ran.

> ⚠ **A FOURTH INSTANCE OF FINDING F-d, IN THE ACT OF STAMPING THIS TABLE — recorded rather than
> quietly worked around.** Plan `195-08`'s own acceptance criterion is *"zero `⬜` remaining in the
> Per-Task Verification Map"*. A bare `grep -c "⬜"` reads **2**, and **both hits are prose ABOUT the
> marker** — the legend at the top of this section, and this sentence's own earlier wording. **The map
> itself contains none.** The criterion is unsatisfiable the moment the convention is explained, which
> is exactly F-d's shape at instances 1-3 (`195-03`'s docblock, `195-06`'s `not.toMatch` grep,
> `195-07`'s self-matching path regex). **Four instances in one phase; the pattern is now recorded in
> two places rather than rediscovered a fifth time.** The discriminating check is a **column-anchored**
> one — a pending marker inside a table cell, i.e. `grep -cE '^\|.*⬜'` → **0** — which prose
> structurally cannot satisfy, because prose does not start a markdown table row.

---

## The Plants — 26 across 10 claims

Each plant is a **real edit to production source**, restored **md5-identical** afterwards. Where
`assert` short-circuiting means one plant cannot exercise every clause, the count is stated
(194-10 needed six where two were named; 194-12 needed eleven).

| # | Claim | Plants | The plant most likely to be INERT |
|---|---|---|---|
| **P1** | D-15's three-way empty state survives | **3** — (a) force always-terminal at `:1035` → reds LIVE; (b) force always-live → reds TERMINAL; (c) delete the `filesLoading ? null :` guard `:1032` → reds *"claims NEITHER while in flight"* | ⚠ **(c)** — its assertion is a `not.toContain`, which passes trivially if the fixture's loading flag is unset. **Verify the fixture actually calls `setFiles([], true)` (`:1025`).** |
| **P2** | D-08 dead-link state byte-identical | **2** — (a) remove `data-dead="true"` (`OutputFileCard.tsx:96`) → reds the attribute clause; (b) keep the attribute, change copy to *"No link"* (`:116`) → reds the text clause | ⚠ **(b)** — the existing case asserts both with two `expect`s and **the first short-circuits the second**. |
| **P3** | D-08 `supersedes` subline byte-identical | **3** — ⚠ **NO FENCE EXISTS; Wave 0 authors it, then plants.** (a) delete the live-branch block (`:168-172`); (b) delete the **dead-branch** block (`:101-105`) → must red **independently**; (c) change the literal `"Replaces: "` | ⚠ **(b)** — the subline is written **TWICE**; a fence rendering only a `url`-bearing fixture structurally cannot see the dead branch. |
| **P4** | D-12 client-side newest-first sort | **3** — (a) remove `.sort()` → reds; (b) invert comparator to ASC → reds; (c) ⚠ **fixture whose NEWEST row has `created_at: undefined`** (the live-SSE regime) + a comparator sorting `undefined` LAST → **must red** | ⚠ **(c) — this is what F7 exists for.** Without it the fence proves only the reconciled regime, which is **not** the one the deliverable arrives in. **Positive control required:** a two-row fixture where both orders differ, else the fence passes on a one-row list forever. |
| **P5** | D-02's label makes no run-scope claim | **2 + a word-level sweep** — (a) revert the const to `"What this run produced"` → reds; (b) add `not.toMatch(/this run (produced\|made\|created)/i)` and plant **three** different overclaiming strings | ⚠ **Do NOT sweep the whole region's `textContent`** — `COPY_NO_FILES_TERMINAL` legitimately contains *"This run produced no files."* (F4). A region-wide sweep **reds on correct code**. |
| **P6** | SC#2 — exactly ONE of each | **4 + guards** — (a) re-add `function formatBytes` to `WorkflowRunPage.tsx`; (b) re-add it to `FilesSection.tsx`; (c) re-add an inline `iconFor` to either; (d) add a second row `<a>` in `OutputFileCard.tsx`. Each must red **separately** | ⚠ **Sweep `codeOf(source)`, NOT raw** — these files carry docblocks that legitimately name `formatBytes`/`iconFor` (187-24), and a raw sweep **reds on its own explanation**. ⚠ **Length + identity guard on EVERY `?raw` import** — 192.1 measured a renamed module swept against the **empty string** and passing green. |
| **P7** | D-13/D-07 — presentation converts, capability does not | **3** — (a) `git diff --numstat <base> HEAD -- MessageItem.tsx ExecuteCodeBody.tsx` must be **EMPTY**; plant a one-char edit and prove the check fails; (b) add a 4th optional prop to `OutputFileCardProps` → a prop-set source fence reds; (c) add a second `<button>` in a chat row → a DOM control count reds | ⚠ **(a) is a `git` assertion, not vitest** — it belongs in the plan's verification steps, and a `numstat`-empty check **passes trivially when the base SHA is wrong**. **ASSERT THE BASE, never assume it** — 7/7 worktrees forked from the wrong base in 194 and 8/8 in 194.1. |
| **P8** | The run page's shipped absences hold | **3, each shown to red SEPARATELY** — plant (a) `import { FilesSection }`, (b) `const t = useViewingThread()`, (c) `import { FilePreview }` into `WorkflowRunPage.tsx`, one at a time | The needles are assembled from parts (`["Files","Section"].join("")`) so the test file's own source cannot satisfy them. **Keep the existing positive controls at `:1470-1471` / `:1482`.** |
| **P9** | `<StopControl` still appears **exactly once** in `WorkflowRunPage.tsx` | **0 (assert green)** — 194.1's fence, positive control already at `:602-605` | ⚠ **The fence most likely to break for a reason unrelated to its subject.** `StopControl.baseline.test.tsx` is **UNGATED** — the gate will never tell anyone. **Assert it green after EVERY `WorkflowRunPage.tsx` edit.** |
| **P10** | The count-gate delta is real | **0 (procedure)** | ⚠ **A `TARGETS` entry pointing at a path that does not exist yet makes the gate ERROR (exit 2), not fail** — new-suite entries land in the **SAME COMMIT** that creates the file. ⚠ **Read the BASELINE from the gate's own printed `actual` column across two agreeing runs** — never hand-count `it(` literals. |

**Plant total: 26.** Every one observed RED against production source, file restored md5-identical.

### The fence that INVERTS (F1) — rewrite in place, never delete

`WorkflowRunPage.test.tsx:1467-1468` currently asserts **the exact duplication this phase removes**:

```
expect(codeOf(pageSource)).toMatch(/function formatBytes/)
expect(codeOf(pageSource)).toMatch(/function iconFor/)
```

⚠ **The suite is pinned at 102 EXACT with zero slack.** Deleting the case forces a pin LOWERING,
which needs plan authorisation. **Invert both arms inside the same `it()`** — the count stays 102 and
no pin edit is owed. Quote the original verbatim in the rewritten case (the `194.1-07` /
`StopControl.baseline.test.tsx:513-573` precedent). **Drive the inverted arms RED against the
pre-change source.**

### ⚠ The architecture is MECHANICALLY CONSTRAINED (F2)

Two RAW-source absence arms bind the design, not just the diff:
`not.toMatch(/useViewingThread/)` (`:1464`) and `not.toMatch(/FilePreview/)` (`:1478`).

⇒ **The shared row MUST be purely presentational.** It may not call `useViewingThread()` and may not
import or name `FilePreview`. **D-09's "parameterise the activation" is therefore a CALLBACK PROP,
never a preview import.** This is the strongest architectural constraint in the phase and it is
enforced today. ⚠ **A docblock in `WorkflowRunPage.tsx` explaining the extraction must not write the
tokens `FilesSection`, `FilePreview`, `useViewingThread` or `<StopControl` — name them in WORDS.**

---

## Wave 0 Requirements

- [ ] ⚠ **The live SC#1 baseline, in a commit that PREDATES any source change** — RUN-02 / **D-16**.
      **The one item whose value is destroyed by doing it later** (188.1: *a baseline only proves
      something if it PREDATES the change*).
- [ ] `src/components/files/__tests__/FileRow.test.tsx` — the shared row's behaviour. **Needs
      `TARGETS` + `BASELINE` entries in the SAME commit that creates the file** (P10).
- [ ] `src/components/files/__tests__/FileRow.sweep.test.ts` — the SC#2 "one of each" source sweep
      (P6), with **length + identity guards on every `?raw` import**.
- [ ] **`supersedes` characterization against the PRE-change `OutputFileCard`** (P3) — the only D-08
      state with zero coverage. **Authored and driven RED before the conversion.**
- [ ] **The run page's silent-dead-row characterization** (F8) — capture today's behaviour (a row
      with no control and no copy) before it changes, so the improvement is a **measured delta**
      rather than an unrecorded one.
- [ ] **The D-12 two-regime ordering fence** (P4) including the `created_at: undefined` arm.
- [ ] **Probe `list_connected_browsers` at Wave 0, NOT at phase close** (risk A8) — Phase 194's eight
      UAT rows went entirely undriven for exactly this reason. Confirm a `.docx` reader exists before
      committing to a driven-UAT close.
- [ ] Gate adoption decision for `FilesSection.test.tsx` / `MessageItem.finalOutputs.test.tsx` /
      `fileIcon.test.tsx` (11/11/11, all green ⇒ **zero rot imported**) — **or a recorded decline
      with its reason. A decline with no recorded reason is indistinguishable from an oversight.**

---

## Manual-Only Verifications

| Behaviour | Req | Why manual | Test instructions |
|---|---|---|---|
| **D-20 — the canvas is a place work can be FINISHED** | RUN-02 | Wire format + screenshot are **explicitly insufficient** (192, 193.1, 194 each recorded that lesson). Opening a `.docx` cannot be asserted in jsdom | Launch `northwind-qbr-fa65a43c` v1 → watch it on the run surface → click the produced `.docx` → **OPEN THE DOWNLOADED FILE**. ⚠ **Do NOT locate the row by `getElementById`** (192.1 D-27) — a machine check that bypasses the human's task does not verify it |
| **Three-surface side-by-side** | RUN-03 | "Reads the same" is a human judgement | Chat row, panel row and run-page row on the same fixture, rendered together. Doubles as F10's rendered-DOM delta capture |
| **The D-16 pre-change baseline** | RUN-02 | Proves SC#1 was already satisfied *before* the refactor | Same run, driven **before** Wave 1 lands. ⚠ Chrome must use `http://localhost:5173` — **vite binds `[::1]` only here**, so an IPv4 probe reports it down while it is running |

⚠ **Use `northwind-qbr-fa65a43c` v1** (published, 6 file-producing completed runs, 38-40 KB `.docx`
through 2026-08-16). **AVOID the three bare-slug definitions** (`compliance-gap-report`,
`pm-risk-register`, `risk-register`) — **zero** of their runs has ever produced a file.

---

## Explicitly OUT of scope (recorded so SC#2 cannot be disputed later)

| Thing | Why it is not swept |
|---|---|
| `frontend/src/lib/fileIcons.tsx` (`getFileIcon`) | Documents/health side. Named by D-05 so no accidental sweep. **Re-open trigger:** a documents-surface phase touching file presentation |
| ⚠ **`frontend/src/components/panel/SeamCard.tsx:72-80`** — **the FIFTH presentation, which CONTEXT does not name** (F9) | A `workspace_write` **chip in a run receipt**, not a file row: no size, no download, no icon map. Its own docblock (`:10`) **falsely** claims it *"reuses OutputFileCard's chip shape"* — it imports neither `fileIcon` nor `formatBytes`. Declaring it here converts a future SC#2 dispute (*"you left a fifth one"*) into a **recorded boundary** |
| `RunCard`'s blind file badge / `ThreadRunLine`'s absent one | **D-14** — a MEASURED LIE this phase declines. Fixing it opens `RunCard` (9 phases) and `MessageItem` (29, extraction due) |
| `tool_dispatcher.py:3570`'s stale comment (*"so OutputFileCard renders it"* — it does not; `FilesSection` does) | The phase **writes no Python**. Seed-worthy observation, not a task |

---

## ⚠ THE DRIVEN PLANT TOTAL — **75**, against an estimate of **26 + 1**

*(Recorded 2026-08-17 by plan `195-08` task 2, from the seven plan SUMMARYs. The estimate is preserved
beside the measurement, never replaced.)*

| | Plants |
|---|---|
| **Estimated** in § "The Plants" above | **26** |
| The adopted 27th (the stripper non-vacuity plant) | **+1 = 27** |
| ⚠ **ACTUALLY DRIVEN RED against production source** | **75** |

| Plan | Driven | What the extras bought |
|---|---|---|
| `195-01` | 0 | a baseline, not a fence |
| `195-02` | **9** | +3 over its named six: the four dead-link clauses were split into their own `it()`s (appending them would have re-created the short-circuit P2 exists to defeat), plus a 7th proving **D-20's third-surface record can fire** |
| `195-03` | **19** | one plant per added extension (9), per mime branch (5), per `asChild` mechanism |
| `195-04` | **7** | the six named + `UNIFICATION′`, which measured *what the extraction changed* rather than that the fences still fire |
| `195-05` | **10** | every one of eleven new cases has a plant that reds it |
| `195-06` | **15** | P5a/b1/b2/**c** separately, because a copy sweep and an equality must each be observed firing **alone** |
| `195-07` | **15** | +9 over its named six — `expect` short-circuits, so a 3-clause arm needs 3 plants (the 194-10 / 194-12 lesson) |
| **Total** | **75** | **≈ 2.9× the estimate** |

⚠ **This project's history said the estimate would run low, and it did — by more than any prior phase.**
194-10 needed six where two were named; 194-12 needed eleven. **The dominant cause is the same in every
case and is worth carrying to the next VALIDATION author: `expect` short-circuits, so a case with N
substantive clauses needs N plants, not one.** An estimate that counts *claims* will always undercount
*plants*. **Counting clauses rather than claims is the cheap fix.**

---

## ⚠ FENCES THAT FAILED TO RED — every one a FINDING, with its resolution

*"A fence that fails to red is a FINDING, not a formality"* — this file's own rule, applied to itself.
**Four fired. None was waved through.**

### F-a — ⚠ TWO PLANTS REPORTED **GREEN** AND THE FENCES WERE INNOCENT: the plant had not applied (`195-03`)

P1(c) and P1(d) came back `41 passed`, which reads exactly like *"the fence is inert"* — the finding the
plan asks to escalate. **It was not the fence.** The source files are **CRLF**, and the multi-line
substitutions used bare `\n`, so they matched nothing. The single-line plants applied fine, which is
what made the failure look **selective and credible**.

**Resolution:** every subsequent plant harness `diff`s the file before and after and **aborts with
`FATAL: plant did not apply` on an empty diff.** With `\r?\n`, P1(c) red 9 cases and P1(d) red 5.
**Adopted by every later plan in the phase.**

> ⚠ **THE GENERALISABLE LESSON: a plant that cannot apply proves exactly as little as a fence that
> cannot fire — and it fails in the REASSURING direction.** The verification apparatus needs its own
> verification.

### F-b — ⚠ AN ACCEPTANCE CRITERION THAT COULD NOT FAIL: `git diff --numstat <BASE> HEAD` is BLIND to an uncommitted edit (`195-04`, re-driven `195-07`)

The P7(a) plant — **one space byte** into `MessageItem.tsx`, verified `48,235 → 48,236` — was driven, and
the criterion **did not fire**:

| Form, with the plant applied | Output | Fires? |
|---|---|---|
| `git diff --numstat <BASE> HEAD -- <files>` | **EMPTY** | ❌ **NO** |
| `git diff --numstat <BASE> -- <files>` (working-tree) | `1 1 …MessageItem.tsx` | ✅ yes |
| `md5sum` | digest ≠ baseline | ✅ yes |

`<BASE> HEAD` compares two **commits**; a working-tree edit is invisible to it by construction. ⚠ **The
baseline's warning that *"a `numstat`-empty check passes trivially when the base SHA is wrong"* has a
SECOND, previously unrecorded arm: it also passes trivially when the edit is not yet committed.**

**Resolution:** the complete assertion is **all three forms**, plus a **positive control on the shape**
(`git diff --numstat 7e5d1fb8~1 7e5d1fb8` → `94 3`) so its emptiness is not vacuous. Re-driven from a
different worktree two waves later, which **reproduced the identical planted digest** — independent
corroboration rather than an inherited claim.

### F-c — ⚠ THREE ARMS OF THE SC#2 SWEEP PASSED VACUOUSLY ON THE EMPTY STRING (`195-07`)

The adopted 27th plant broke the comment stripper to return `""`. Result: **`15 failed | 5 passed`.**
The four non-vacuity guards red **as designed** — and **three arms passed while measuring nothing**:

```
✓ the KiB arithmetic itself lives in NONE of the four swept files
✓ ARM 4b — no OTHER in-scope file declares an extension-to-glyph map
✓ chat capability — no swept file renders raw markup
```

**They are the only three whose every substantive clause is an ABSENCE assertion.** This is the 192.1
failure — a renamed module swept against `""`, passing green — **reproduced on purpose inside the very
suite built to prevent it.**

**Resolution:** the four length + identity + stripper-pair guards are what make them unshippable, and
this plant is the **measured justification for their existence** rather than an argument for it.
⚠ **The plan predicted only the four guards would red; ten further cases also red, because every other
absence clause in the suite is PAIRED with a presence clause. Both the prediction and the measurement
are published, and the measurement is the stronger result.**

### F-d — ⚠ AN ACCEPTANCE GREP THAT TRIPS ON ITS OWN DOCUMENTATION — **THREE INSTANCES IN ONE PHASE, WHICH IS A PATTERN**

**This is the finding with the widest reach, and it is recorded here because it is not about any one fence.**

| # | Where | What happened |
|---|---|---|
| 1 | `195-03` | The first `FileRow` docblock **red its own acceptance greps** by explaining the constraints in prose that named the forbidden identifiers — and `fileIcon()` in a comment matches `fileIcon(` |
| 2 | `195-06` | `grep -c "toMatch(/function formatBytes/)"` reads **3, not 0** — a substring grep cannot distinguish `not.toMatch(` from `toMatch(`. The property the criterion was *about* (no surviving assertion that the page contains either helper) held exactly |
| 3 | `195-07` (**D-195-07-D**) | The criterion `grep -n '"src/components/files"'` matched **its own explanation** — then the stricter regex written to replace it **matched that too** |

⚠ **THE CRITERION IS UNSATISFIABLE ONCE ANYTHING DOCUMENTS IT.** Three independent instances in one
phase is a pattern, not bad luck — and it is the 187-24 trap (*prose is never exempt*) on its seventh
recorded appearance in this repository.

**Resolution, and the shape to reuse:** an **anchored ARRAY-ELEMENT regex** — `^\s*"<path>",\s*$` —
which prose **structurally cannot satisfy**, because prose is preceded by `//`. And the deeper fix,
which the whole SC#2 sweep is built on: **read STRIPPED code, never raw bytes.** Measured on this
phase's own corpus, a raw sweep reds on `@/lib/fileIcon` / `FileSpreadsheet` / `codeExts` / `1024`
tokens that exist **only in explanations** — *"the only way to make it green would be to delete the
explanations."*

> ⚠ **THE RULE FOR THE NEXT VALIDATION AUTHOR: a bare `grep -c` over a file that documents itself is
> not an acceptance criterion.** Anchor it to a syntactic position prose cannot occupy, or assert the
> property over stripped code.

### Fences flagged as *likely inert* and CHECKED — none was

Recorded because "checked and fine" is a different state from "not checked":
**P1(c)** (the in-flight empty-state guard, a `not.toContain` that passes trivially on an unset loading
flag) — **the fixture genuinely calls `setFiles([], true)`; verified by reading the fixture AND by the
plant reding with the right message. No repair needed.** · **P3(d)** (the `forwardRef` case) — reds both
ref cases. · **P1(e)** (the own-property guard case) — reds the prototype cases.

### A gap that was NOT an inert fence but an ABSENT one (`195-05`)

⚠ **Nothing in the tree tested a ref passed to the shared row's CALLER-SUPPLIED CHILD** — only one
passed *to* the row. That is the one the panel's roving focus actually uses. **Had Radix's `Slot`
swallowed it, arrow-key navigation would have died silently, for keyboard users only, with all 11
shipped panel cases and all 40 shared-row cases green.** It does not — but that is now a measurement
(plant P5(a)), not a hope.

---

## ⚠ THE `tsc` FLOOR — 33 vs 30, DECIDED EXPLICITLY

*(Recorded 2026-08-17 by plan `195-08`. `195-05` and `195-06` each logged this item forward rather than
acting on it; silence was named as the one unacceptable outcome, so here is the decision.)*

**Measured at `945b8b61`: `npx tsc --noEmit -p tsconfig.app.json` → 33 errors, unmoved across the entire
phase.** (A bare `tsc --noEmit` checks **zero** files here; the `-p tsconfig.app.json` is load-bearing.)

⚠ **That 33 INCLUDES three PRE-EXISTING errors that are trivially fixable:**
`src/components/panel/__tests__/FilesSection.test.tsx` `(149,19)`, `(159,19)`, `(168,19)` — each
`TS2304: Cannot find name 'WorkspaceFile'`. The file casts fixtures `as unknown as WorkspaceFile` and
**never imports the type**. `195-05` measured that fixing them yields **30**.

**DECISION: LEAVE THEM. The floor stays 33.** Three reasons, in order of weight:

1. ⚠ **This plan writes NO source code, and that is a structural property rather than a preference.**
   `195-07` proved SC#2 with a **source sweep over a tree**. Editing a frontend file after that sweep
   ran would mean the sweep had measured a tree that no longer exists — **the phase deliberately closed
   with its source frozen**, and `files_modified` contains no path under `frontend/` or `backend/`.
2. **A silent improvement is a hostile act on a parallel phase.** Every plan in Phase 195 carries an
   acceptance criterion reading *"equals the `195-BASELINE.md` figure"*, i.e. **33**. `195-05` avoided
   the trap deliberately — its eleven new fixtures are plain object literals with **no cast**, so they
   add zero new errors. A drop to 30 would red a sibling's gate for a reason none of them could
   diagnose.
3. **It is out of scope by the scope-boundary rule** — a pre-existing error in a file this phase grew
   but did not cause.

⚠ **THE COST IS REAL AND IS STATED RATHER THAN GLOSSED:** the floor is now a number **three of whose
errors are known, named, located and one import away from gone.** A floor that includes known-fixable
errors trains readers to accept the floor rather than to shrink it.

**Named condition for taking it (not a date):** **the next phase that opens
`frontend/src/components/panel/__tests__/FilesSection.test.tsx` for any reason adds the missing
`WorkspaceFile` import in the same commit and records the new floor of 30 BESIDE the 33** — beside,
because every Phase-195 document quotes 33 and a reader meeting 30 must be able to tell a fix from a
regression. ⚠ **`tsc` going DOWN is the only direction that is unambiguously good and the only one no
gate watches.**

---

## Validation Sign-Off

*(Stamped 2026-08-17 by plan `195-08` task 2.)*

- [x] All tasks have automated verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ MISSING references above — **all five authored** (`FileRow.test.tsx` 40, `fileRowUtils.test.ts` 22, `FileRow.sweep.test.ts` 20, the `supersedes` characterization, the run page's silent-dead-row capture); the D-16 live baseline landed in a commit that **PREDATES every source change**
- [x] No watch-mode flags anywhere
- [x] **All plants observed RED against production source, each file restored md5-identical** — ⚠ **75 driven, not 26+1**; see the table above. **Every restore verified by READING both digests**, after `195-04` measured an md5 helper false-passing on `[ "" = "" ]`
- [x] **The F1 fence INVERTED in place** — ⚠ **the suite is 108, not 102.** The pin moved twice by ADDITION (`102 → 105` at `195-02`, `105 → 108` at `195-06`); **an inversion moves no number**, which is exactly why deletion was forbidden. The "still 102 EXACT" wording is preserved above and is **stale, not violated**
- [x] **`StopControl.baseline.test.tsx` asserted green after every `WorkflowRunPage.tsx` edit** (P9) — 15/15 throughout; ⚠ **it was UNGATED when this file was written and is now GATED** (adopted `195-02`), closing the *"a pin in an ungated suite is a pin nothing checks"* gap
- [x] **Both gate knobs run every wave — gated AND ungated** — ⚠ **the gate covered 1 of 5 suites at wave 1 and covers 9 of 9 now**; final verdict `count gate OK — 83/83 pinned files present, no per-file decrease, 0 failing.` · `total 4170 · failed 0 · pinned total 4096`
- [x] Feedback latency < 40 s (quick)
- [ ] ⚠ **`nyquist_compliant: true` — NOT SET. Deliberately left `false`, with the reason named.**

### Why `nyquist_compliant` stays `false`

**Exactly ONE row of the Per-Task Verification Map is not covered: D-20 —** *launch a real workflow →
watch the run surface → download the produced `.docx` → **OPEN IT** → compare chat, panel and run page
side by side.* It is the phase's **G-4 lived-experience** row, it is **manual by necessity** (opening a
`.docx` cannot be asserted in jsdom, and wire format + screenshots are explicitly insufficient — 192,
193.1 and 194 each recorded that lesson), and it is a **blocking human checkpoint** — plan `195-08`
task 3, which had not been driven when this sign-off was written.

⚠ **The PRE-change half IS driven and is not owed** (`195-BASELINE.md` arms 0-3): a workflow was
launched, its empty state captured **before the file existed**, the populated row observed as a
**transition** rather than a state found, and the deliverable downloaded to disk **byte-exact with
`workspace_files.size_bytes`**, CRC-clean, carrying 5,843 characters of filled prose. **Zero arms
blocked; zero ⛔.** What is owed is the **POST-change** half — the same journey on the converted
surfaces.

**Who flips this flag, and when:** whoever writes
`.planning/phases/195-show-the-deliverable/195-UAT.md` with U1-U6 verdicts. ⚠ **It flips to `true` only
if every row carries a PASS; a ⛔ row leaves it `false` with the blocked row named.** **A scoreboard
that lists only what passed is not a scoreboard**, and a compliance flag set on an undriven row is the
same failure with a boolean on it.

**Approval:** ⚠ **CONDITIONAL — every automated contract in this file is discharged and measured; the
single manual G-4 row is OWED and is stated as a DECISION, never as a claim that everything ran.**

---

## ⚠ AMENDMENT, 2026-08-17 — D-20 WAS DRIVEN AFTER THIS SIGN-OFF WAS WRITTEN

> **Everything above this line is PRESERVED VERBATIM, never rewritten.** It was written by plan
> `195-08` **task 2**, at which point the D-20 checkpoint had not been driven — the sentence
> *"which had not been driven when this sign-off was written"* was true then and is kept so the record
> shows what was and was not known at each step. This amendment is task **3**'s.

**`195-UAT.md` now exists and carries U1-U6.** The result:

| | |
|---|---|
| **Tally** | **4 PASS · 0 FAIL · 2 ⛔** (one owed, one undrivable) |
| **`nyquist_compliant`** | ⚠ **STAYS `false`** — the condition this file set was *"flips to `true` only if EVERY row carries a PASS"*, and two do not |
| **Uncovered row 1** | **U1b — download the deliverable and OPEN it, on the POST-change surface.** ⛔ **OWED with NO blocking condition** — the reader is present, the control is live, the row was simply not run. **The FIRST row to run when UAT resumes** |
| **Uncovered row 2** | **U4 — multi-file newest-first, including the mid-run no-`created_at` regime.** ⛔ **UNDRIVABLE, and the row's PREMISE is refuted:** no workflow run in the live DB has ever produced 2+ files. **Blocking condition:** a run that produces two or more |

⚠ **What the drive found that this entire validation apparatus could not: a VISUAL REGRESSION on both
live surfaces while every fence was green.** `FileRow`'s icon wrapper inherited the row's
`line-height: 24px`, growing the run-page row **33 → 40 px** and the panel row **38 → 42 px** — breaking
`195-03`'s own `must_have` (*"without any of them changing visually"*). **75 plants, a 20-case source
sweep, `tsc` 33 and `failed 0` were all green throughout.** Class names, design tokens, glyph sizes and
padding were all still correct; **only the computed line box was wrong, and that is geometry jsdom does
not resolve.** Fixed inline as a G-3 fast-fix (commit `9c985537`) and re-measured live at **33 px /
38 px — byte-exact with `195-BASELINE.md`**.

> ⚠ **THE LESSON FOR THE NEXT VALIDATION AUTHOR, and it is this phase's strongest single finding:**
> **a plant proves a fence can fire; it cannot prove the fence is watching the right property.** Every
> geometric property of these three surfaces was asserted by class name — which is correct, deliberate
> (`D-195-05-B`) and **blind to layout**. G-4 is not a ceremony on top of the fences; here it was the
> only instrument that could see.

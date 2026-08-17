---
phase: 195
slug: show-the-deliverable
status: draft
nyquist_compliant: false
wave_0_complete: false
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

| Req | Behaviour | Test type | Automated command | File exists | Status |
|---|---|---|---|---|---|
| RUN-02 | A terminal run's produced file is listed, named, sized, downloadable from the run surface | unit (RTL) | `npx vitest run src/pages/WorkflowRunPage.test.tsx` | ✅ 102 cases | ⬜ |
| RUN-02 | The region label makes no run-scope claim it cannot deliver (**D-02**) | unit | same file, heading cases `:897` + `:1023` | ✅ **both must be updated** | ⬜ |
| RUN-02 | The three-way empty state survives the conversion (**D-15**) | unit | same file, `describe("… two empty states say different true things")` | ✅ 3 cases | ⬜ |
| RUN-02 | Newest-first ordering, **BOTH regimes** (**D-12**) | unit | `npx vitest run src/components/files/__tests__/` | ❌ **Wave 0** | ⬜ |
| RUN-02 | Live run: launch → watch → download → **OPEN THE FILE** (**D-20**) | **manual, operator-driven** | see § "The D-16 live baseline" | ❌ Wave 0 + close | ⬜ |
| RUN-03 | Exactly ONE `formatBytes`, ONE icon path, ONE row markup, ONE download dispatcher | unit + **source sweep** | `npx vitest run src/components/files/__tests__/FileRow.sweep.test.ts` | ❌ **Wave 0** | ⬜ |
| RUN-03 | `OutputFileCard`'s dead-link state survives byte-identical (**D-08**) | unit | `npx vitest run src/__tests__/components/MessageItem.finalOutputs.test.tsx -t "dead-link"` | ✅ `:111-124` | ⬜ |
| RUN-03 | `OutputFileCard`'s `supersedes` subline survives byte-identical (**D-08**) | unit | — | ❌ **ZERO COVERAGE — Wave 0** | ⬜ |
| RUN-03 | Panel keeps listbox/option + roving tabindex + preview activation + Template badge | unit | `npx vitest run src/components/panel/__tests__/FilesSection.test.tsx` | ✅ 11 (**ungated**) | ⬜ |
| RUN-03 | Chat gains NO new file affordance (**D-13**) while its presentation converts (**D-07**) | **source sweep + git** | `FileRow.sweep.test.ts -t "chat capability"` + `git diff --numstat` | ❌ **Wave 0** | ⬜ |
| RUN-03 | Run page still names neither `FilesSection`, `FilePreview` nor `useViewingThread` | source fence | `WorkflowRunPage.test.tsx -t "neither mounts the panel"` | ✅ **two arms INVERT** | ⬜ |

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

## Validation Sign-Off

- [ ] All tasks have automated verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ MISSING references above
- [ ] No watch-mode flags anywhere
- [ ] **All 26 plants observed RED against production source, each file restored md5-identical**
- [ ] **The F1 fence INVERTED in place, suite still 102 EXACT**
- [ ] **`StopControl.baseline.test.tsx` asserted green after every `WorkflowRunPage.tsx` edit** (P9)
- [ ] **Both gate knobs run every wave — gated AND ungated** (the gate covers 1 of 5 suites)
- [ ] Feedback latency < 40 s (quick)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

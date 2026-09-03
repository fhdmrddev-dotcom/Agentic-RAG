---
phase: 227
from: claude (reviewer)
to: gemini (builder)
posted: 2026-09-04
head: 3e4b52aec
reviews: [227-01-PLAN.md, 227-02-PLAN.md, 227-03-PLAN.md, 227-CONTEXT.md, 227-SEAM-AUDIT.md]
verdict: "EXECUTE AFTER B-1 … B-4 are answered in the plans. Every finding below was measured on the tree at HEAD, not reasoned about; the command that produced each is quoted."
---

# Phase 227 — Pre-flight review of the plan set

**AGENTS.md §3.1 holds and is satisfied**: 224-01..03 and 224-04/05 shared this blast radius; 227 is
built by Gemini and reviewed by Claude, and this reviewer wrote none of 227's plans.

**What is right, said first so the blocking list is not read as a rejection.** The wave order is
correct and it is the phase's whole safety argument: SC#5 (pin before refactor) is Wave 1, and the two
red suites it fixes are genuinely red *today* — I ran them. The extraction targets are the right ones.
The seam audit names real files rather than restating the plan. D-01 (evolve `RunCard` in place rather
than mint `RunFrame.tsx`) is the right call and for the right reason.

---

## BLOCKING

### B-1 · The BASELINE key space is GLOBAL and two of the fifteen suites collide

`scripts/vitest-count-gate.cjs:4460` — `bareName()` strips every directory, and `BASELINE` is
*"keyed by BARE filename"* (`:121`). Two of the fifteen suites plan 227-01 adopts have the **same
basename**:

- `frontend/src/components/chat/__tests__/MessageItem.test.tsx`
- `frontend/src/__tests__/components/MessageItem.test.tsx`

Measured, not assumed — `find src -name "*.test.ts*" | sed 's@.*/@@' | sort | uniq -d` returns seven
duplicated basenames tree-wide, and **`MessageItem.test.tsx` is the only one inside this phase's
fifteen** (the other six — `api.test.ts`, `CaseEditor`, `FilePreview`, `NavPanel`, `toolNames`,
`workspacePanel` — are out of scope here).

Plan 227-01 Task 2 step 4 says *"Add each of the 15 bare filenames and its measured count to the
`BASELINE` object."* Written literally that emits **a duplicate key in a JS object literal**: the
second silently wins, and the first suite's pin vanishes without any error. Worse, the gate **sums**
repeated names when it reads the report (`:4487-4492`, *"if a name ever repeats, sum it rather than
silently losing one"*), so the surviving key would be pinned at one suite's count while `actual` is
the sum of both — a permanently positive delta, under which **an entire suite can be deleted and the
gate still passes**. That is the precise failure this phase exists to stop.

**The remedy is already in the repo, with precedent.** Phase 217 hit this exact wall and recorded it
in the gate: `DocumentList.test.tsx` existed at two paths, the two were read, found to be
*complements*, and one was **`git mv`d to a distinct name (history follows) so both could be adopted**.
Do the same here: read both `MessageItem.test.tsx` files, `git mv` one to a name that says what it
covers, then pin both. **Do not** pin the sum under one key, and do not drop either file — this phase's
own SC#5 is about ending exactly that kind of invisibility.

### B-2 · `MessageItem.tsx` does not lose a responsibility, so SC#4's discharge is not earned

ROADMAP SC#4, verbatim: *"both files leave `extraction due` by having **lost the responsibility**, not
by a row being re-worded."*

- `ToolCallPanel.tsx` genuinely loses ~333 lines and three real jobs. Its discharge is earned.
- `MessageItem.tsx`'s entire shed in plan 227-03 is the terminal-status block at `:752-761` — **ten
  lines out of 822, and it gains an import.** That is a row being re-worded with extra steps, which is
  the thing SC#4 names.

Take one of two honest routes, and say which in the plan:

1. **Shed a real responsibility.** Measured candidates inside the file, all live (each still
   referenced; none is dead code): `dedupParagraphs` (`:198-304`, **107 lines** of pure text transform
   → a unit-testable `messageText.ts`), `UserBubble` (`:93-151`, an entire role's rendering),
   `FinalOutputsPanel` (`:152-168`). Those three are ~180 lines and are *responsibilities*, not helper
   shuffling.
2. **Do not claim the discharge.** Leave the row `extraction due`, update the triple, and record in
   `docs/HOT-FILE-LEDGER.md` what 227 did take and why the rest was left. A ledger that says
   *"honoured"* and is wrong answers the next auditor and stops the audit — the failure mode CLAUDE.md
   already records five rows suffering.

### B-3 · The "1019 → ~250 lines" target is arithmetically unreachable, and the two documents disagree

Plan 227-02's objective says *"~250 lines"*; its own `must_haves` says *"under ~350 lines"*. A
must_have stated two ways cannot fail honestly. Neither number is reachable from the named extractions
— measured from the file's top-level map:

| Moving out | Lines |
|---|---|
| `ToolArgsBlock` + `ToolResultBlock` (`:112-249`) | 138 |
| `SubAgentBlock` (`:250-290`) | 41 |
| `ToolEssenceLine` + `StepRow` (`:348-501`) | 154 |
| **total shed** | **333** |

1019 − 333 = **~686 lines**, before the new imports. The reason is that `ToolCallPanel()` **itself** is
`:502-1019` — **518 lines**, of which ~150 are comment lines carrying dated decisions that must not be
deleted to hit a number. The extraction list never touches it.

Either restate the target as a **measured outcome** rather than a round number, or name the third
extraction that gets you there: the pure step derivation in the body — `displayItems`,
`toolStepNumber`, `stepKeyOf`, `nodeStateOf`, `lastPreparingIndex` — is a genuine seam, it is
side-effect-free, and unlike the render blocks it becomes **directly unit-testable** once it leaves
the component.

### B-4 · `scripts/check-hot-file-sizes.sh` does not exist

Plan 227-03 Task 3 step 4 and Seam 4 both name it as a verification mechanism. `ls scripts/*.sh`
returns nine scripts and none is it. A verification that cannot run is not one.

The real same-commit guard on this edit is **`node scripts/check-claude-md-size.cjs`** — it enforces
the 150k char limit, the **200-char cap on a ledger disposition cell**, `[duplicate-row]` and
`[malformed-row]`, and it runs in the PostToolUse hook in the turn the prose is authored. Run that
instead, and keep the CLAUDE.md row ↔ `docs/HOT-FILE-LEDGER.md` section edits **in the same commit**.

---

## ADVISORY

**A-1 · SC#2 has no mechanical proof — this is the one addition I would argue for.** *"Nothing changes
on screen"* is currently backed by fifteen suites (which, per the measurement pack, this gate has
**never executed**) plus the operator's eyes. Precedent for the fix is in `TARGETS` already:
`src/components/admin/revertByteIdentical.test.tsx` (Phase 181) is a byte-identical acceptance fence.
Author a characterization suite in **Wave 1, before any refactor**, that renders the eight run states
and asserts the rendered DOM; it must come out **unchanged** in Wave 3. ROADMAP's own flag says it:
*"a refactor with no visual contract is a rewrite with extra steps."*

**A-2 · The two test edits in 227-01 Task 1 are legitimate — I verified both rather than take them on
the plan's word.** `npx vitest run src/__tests__/components/ToolCallPanel.test.tsx
src/__tests__/components/MessageItem.test.tsx` → **2 failed / 38 passed**, exactly the two the plan
names. Both are stale tests against deliberate shipped contracts: `ToolCallPanel.tsx:414-437` carries
the operator's 2026-08-31 noise audit in the source, and `Setting up agent…` is the shipped copy from
`src/lib/toolMeta.ts:197`. Two conditions on the edit:
- **Keep a positive control.** The ToolCallPanel test builds *only* done tools, so deleting the pill
  assertion removes coverage rather than correcting it. Add a `failed` or `interrupted` step and assert
  its `status-pill` **is** present — that is what the audit actually decided.
- **Assert the literal.** For MessageItem use the shipped string from `toolMeta.ts:197`, not a loosened
  regex.

**A-3 · The list is fifteen, and all fifteen exist.** The measurement pack §4 said *"Fourteen"*; the
plan's list of 15 is the correct one (the pack counted rows, two of which held five and three suites).
Every one of the fifteen paths was `ls`-confirmed at HEAD.

**A-4 · `--reporter=basic` is dead in vitest 4** — it fails at startup (`Failed to load custom Reporter
from basic`). Use the default reporter or `--reporter=json`; the gate script's own header says the same.

**A-5 · The ROADMAP's quoted `MessageItem.tsx:841` "ADDITIVE ONLY" comment no longer exists.**
`grep -rn "ADDITIVE ONLY" src/components/chat/` returns nothing — 224 deleted it with the seam card.
Do not plan around a comment that is gone; the file is 822 lines.

**A-6 · All three ledger triples are stale, in the direction that matters.** Re-derived today:
`MessageItem.tsx` **62 / 33 / 822** (row says 58 / 29 / 863) · `ToolCallPanel.tsx` **50 / 22 / 1019**
(row says 50 / 19) · `RunCard.tsx` **25 / 11 / 693** (row says 24 / 10 / 688). 227-03 Task 3 already
re-derives — good; use the recipe in CLAUDE.md and subtract the six-digit dated-quick-task buckets.

**A-7 · The `RunTerminalStatus` code block is faithful, and the direction of the import is safe.**
`MessageItem.tsx:752-761` matches the plan's quoted block, and `RunCard.tsx` already imports `cn`
(`:3`) and `Message` (`:5`). `MessageItem → RunCard` is the existing direction, so no cycle. The added
`className` prop renders identically as long as no caller passes one.

**A-8 · SC#3 is asserted, not proven.** *"…becomes a one-file edit"* is a claim about a future diff.
Cheap proof for `227-VALIDATION.md`: write out the exact future edit (the few lines that move the
status line inside the frame) and show `git diff --name-only` names one file. Same for the
right-aligned column in `StepRow.tsx`.

**A-9 · The waves are strictly serial** (01 → 02 → 03), so there is no worktree parallelism to gain,
and only 227-01 touches `scripts/vitest-count-gate.cjs` — no shared-artifact conflict. If a worktree is
used anyway, `bash scripts/bootstrap-worktree.sh "$(pwd)"` is the first action, and teardown is
`scripts/teardown-worktree.sh`, never `rm -rf`.

**A-10 · The phase cannot close on green gates alone.** ROADMAP flags G-2 "in an unusual direction" and
this project has closed a phase on green gates with the feature absent (213) and shipped green against
a contract that asserted only text (217 → 217.1). State plainly at the close which of the eight states
the operator actually drove and which are owed, rather than closing on the suites.

---

*Reviewed by Claude, 2026-09-04, at `3e4b52aec`. Findings B-1 … B-4 were each reproduced with a command
before being written; the commands are quoted inline so the builder can re-derive rather than trust.*

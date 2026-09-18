---
phase: 251
plan: "04"
subsystem: planning-tooling
tags: [seeds-register, REG-02, REG-03, D-03, D-12, D-13, D-14, D-15, D-19, gsd-wiring, agent-bus, vendored-framework]
requires:
  - "251-01 — scripts/check-seeds-register.cjs (the gate, its --phase surface, its --self-test harness)"
  - "251-02 — the migrated frontmatter that makes the sweep readable, and plant-seed.md's max(id)+1 allocator"
  - "251-03 — a register with 0 duplicate ids, plus ONE carried defect this plan was told to fix"
provides:
  - ".claude/get-shit-done/workflows/discuss-phase.md — <step name=\"cross_reference_seeds\">, the sweep CALLED at the phase touchpoint"
  - ".claude/get-shit-done/workflows/new-milestone.md — §2.5 rebuilt on the script; the by-hand read of every seed DELETED"
  - "scripts/lib/bus-age.sh — the single home of age_days, sourced by both consumers"
  - ".claude/hooks/agent-bus-check.sh — a three-queue summary with the oldest to:operator age, at every session start"
  - ".planning/phases/251-register-integrity/251-BUS-TRIAGE.md — the 5-item operator decision list, zero bus writes"
  - ".planning/seeds/SEED-286 — the one BUS-040 finding no durable register held"
  - "scripts/check-seeds-register.cjs — the carve-out SHAPE fix + [id-in-heading], self-test 6/6 -> 8/8"
affects:
  - ".claude/get-shit-done/workflows/ (VENDORED at v1.42.3 — two more files now carry project edits)"
  - ".planning/REQUIREMENTS.md (14 boxes ticked, 6 traceability rows, DEBT-06 left unticked WITH its reason)"
  - ".planning/ROADMAP.md (Progress table re-derived — three rows read `0/? Not started` for CLOSED phases)"
  - ".planning/STATE.md (the progress frontmatter Wave 1 flagged, reconciled at last)"
  - "⛔ .agent-bus/ — BYTE-UNCHANGED, asserted at every commit (D-13)"
  - "⛔ backend/, frontend/, .planning/milestones/ — BYTE-UNCHANGED, asserted"
tech_stack:
  added: []
  patterns:
    - "prove the CALL, never the STRING: extract the fenced command from the workflow file and EXECUTE it — a step that merely names the script passes grep and fires nothing"
    - "one home, extracted rather than guarded: age_days lifted into a function-only file with no `set` line and nothing executable at load"
    - "a check fires on a DISAGREEMENT, never on an absence — [id-in-heading] leaves 70 innocent files alone and that half is asserted as an absence"
    - "a counterfactual arm written expecting a PASS is how both of this plan's gate defects were found"
key_files:
  created:
    - scripts/lib/bus-age.sh
    - .planning/phases/251-register-integrity/251-BUS-TRIAGE.md
    - .planning/seeds/SEED-286-a-thread-s-folder-scope-cannot-be-changed-once-it-starts.md
    - .planning/phases/251-register-integrity/251-04-SUMMARY.md
  modified:
    - scripts/check-seeds-register.cjs
    - .claude/get-shit-done/workflows/discuss-phase.md
    - .claude/get-shit-done/workflows/new-milestone.md
    - .claude/hooks/agent-bus-check.sh
    - scripts/agent-bus.sh
    - CLAUDE.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/seeds/SEED-068-public-benchmark-scoreboard.md
decisions:
  - "the carried carve-out defect was fixed here as a DOCUMENTED DEVIATION — this plan's files_modified did not name scripts/, and Plan 03 was forbidden it by D-17, so the edit is recorded rather than slipped in"
  - "[id-in-heading] was ADDED rather than deferred to a seed, because the measurement made it cheap: exactly ONE live file disagreed, and 70 files that name no id are correctly left alone"
  - "the acceptance criterion `grep for the by-hand instruction returns nothing` was satisfied LITERALLY — the explanatory quotation was reworded, because a presence check cannot tell a quotation from an instruction"
  - "the hook's silence contract was KEPT, not traded: the summary prints only when to:operator is non-zero, so with both queues empty the hook emits ZERO bytes"
  - "REQUIREMENTS.md: 14 boxes ticked each citing an artifact path; DEBT-06 left UNTICKED with the reason, because no independent review has run and ROADMAP:271 forbids the claim"
  - "STATE.md's progress frontmatter reconciled — all FIVE values were wrong, in different ways, and the originals are recorded in a comment rather than overwritten"
  - "⛔ zero bus writes. Six pre-filled commands ship for the operator, including BUS-171's, which claude does not close for itself"
metrics:
  duration: ~120 min
  tasks: 3 (+1 deviation commit)
  commits: 5
  completed: 2026-09-16
---

# Phase 251 Plan 04: The Wiring, the Queue and the Decision List Summary

**One-liner:** The instrument built in Plan 01 over the register repaired in Plans 02-03 is now
**called** at both GSD touchpoints — proven by extracting the fenced command and running it, because
the same file defanged to a prose mention still passes `grep` with zero runnable calls — while the
operator's queue became a number they see at every session start, five open items became a decision
list with named evidence and zero bus writes, and the gate itself gained the SHAPE check Plan 03 drove
RED and was forbidden to fix.

## What shipped

| # | Task | Commit | Files |
|---|---|---|---|
| 0 | ⛔ **Deviation** — the carve-out SHAPE fix + `[id-in-heading]` | `8458be004` | `scripts/check-seeds-register.cjs`, `SEED-068-…md` |
| 1 | Both GSD touchpoints CALL the sweep; the contradiction resolved in writing | `f49b9d51b` | `discuss-phase.md`, `new-milestone.md`, `CLAUDE.md` |
| 2 | The hook ages the queue; `age_days` becomes ONE home | `e7cfc5a4e` | `agent-bus-check.sh`, `scripts/lib/bus-age.sh`, `agent-bus.sh` |
| 3 | The operator decision list; 14 boxes ticked against a named artifact | `134cb4ffa` | `251-BUS-TRIAGE.md`, `REQUIREMENTS.md`, `SEED-286` |

---

## The gate readings, verbatim

```
  register: 293 files · parsed: 293 · skipped: 0 · duplicate ids: 0
  unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger

seeds register gate OK — 293/293 parsed, 0 duplicate ids, 293/293 carry all 5 required keys.
```

```
self-test 8/8 arms PASS — duplicate id, stub carve-out, the carve-out's SHAPE check, bad status,
a heading that claims the wrong id, match, counterfactual, empty-register floor.
```

| figure | after 251-03 | **after this plan** | why it moved |
|---|---|---|---|
| `register:` / `parsed:` | 292 / 292 | **293 / 293** | ⭐ exactly one file: `SEED-286`, planted by the triage's third arm. Nothing else entered or left |
| `duplicate ids` | 0 | **0** | — |
| `unswept` | 134 · 114 | **134 · 114** | unmoved. `SEED-286` carries a real `trigger_when` **and** `trigger_paths`, so it is swept and counts toward neither |
| `--self-test` arms | 6/6 | **8/8** | two added, and ⛔ **both had been SEEN to fail first** |
| gate exit | 0 | **0** | — |
| `check-claude-md-size.cjs` | 100,572 chars · 67% | **102,442 chars · 68.3%** · headroom 47,558 | exit **0** |
| `check-hot-file-ledger.cjs 251` | exit 0 | **exit 0**, `scan list: 281 rows · subject: 17 files · watched: 0` | ⚠ `watched: 0` still means *nothing was checked* — this plan touches no `backend/app/` or `frontend/src/` file, by design |

⚠ **`134 · 114` unmoved is the correct result and was checked rather than assumed.** A new seed that
carried `trigger_when: unset` would have pushed the first figure to 135; one carrying prose but no
structured trigger would have pushed the second to 115. `SEED-286` carries both a prose trigger and
`trigger_paths`, so it is genuinely swept — and the figures say so.

---

## ⛔ The carried defect — fixed, and driven RED before it was

Plan 03's arm D found this expecting a pass and could not fix it: **D-17 forbade that plan
`scripts/`.** `duplicateGroups()` read:

```js
if (stubs.length === 1) continue;    // resolved by a D-05 redirect stub
```

That is a **count on the stubs with no constraint on the group.** A **keeper + live squatter + stub**
trio is `members 3, stubs 1` and was waved through as *resolved* while carrying an entirely unresolved
collision — the exact blindness this gate exists to remove, one level down.

**RED first, on a fixture register through the gate's own `analyse()`:**

```
  [duplicate-id] ids found: NONE
  911 (keeper + LIVE squatter + stub) flagged?  false   <-- WANT true
  912 (keeper + stub, the shipped shape) flagged? false   <-- WANT false
RED drive exit=1  (1 == the defect is live, as Wave 3 measured)
```

**After `members.length === 2 && stubs.length === 1`, the identical script:**

```
  [duplicate-id] ids found: 911
  911 (keeper + LIVE squatter + stub) flagged?  true   <-- WANT true
  912 (keeper + stub, the shipped shape) flagged? false   <-- WANT false
trio drive exit=0 (0 == fixed)
```

⭐ **The control arm is what makes this honest.** `912` — the shipped shape, keeper plus one stub — is
asserted **not** flagged in the same run. A fix that simply deleted the carve-out would have passed the
`911` arm and turned Plan 03's eight legitimate stubs into eight regressions.

The drive is now **self-test arm `1c`**, so it is re-runnable forever rather than surviving as prose in
this file. ⚠ **This was a deviation:** the plan's `files_modified` did not name `scripts/`. It is
recorded here rather than slipped in, because the orchestrator's carried finding asked for exactly that.

---

## ⛔ `[id-in-heading]` — added, and it caught a real file on its first run

Plan 03 renumbered eight seeds and then found that **four of the eight still titled themselves with the
OLD id in their `# H1`.** Its own words: *the gate greps `seed_id`, never headings, so it read
`duplicate ids: 0` throughout and was structurally incapable of catching it.* Plan 03 corrected the four
by hand and routed the choice here: **add the cheap code, or plant a seed — but do not leave it
unrecorded.**

**The measurement decided it, and it is the reason the check is cheap rather than disruptive:**

| across the live register | count |
|---|---|
| headings carrying a **matching** id | 221 |
| headings carrying **no** `SEED-NNN` at all | **42** |
| files with **no `# ` heading** at all | **28** |
| headings that **DISAGREE** with the filename | ⛔ **1** |

⭐ **Failing the 70 would have bought zero integrity** — a title that names no id is not lying about
anything. So the code fires **only on a disagreement**, and the self-test asserts that half as an
**absence**, not as a smaller count.

**The one disagreement, found by the new code going RED on the real register before anything was
changed:**

```
exit=1
  [id-in-heading] .planning/seeds/SEED-068-public-benchmark-scoreboard.md
      the first `# ` heading claims `SEED-063` while the filename claims `SEED-068` — a reader who
      trusts the title is reading about a different seed. The FILENAME is the authority (D-09);
      correct the heading.
```

`SEED-068`'s own `migration_note` explains it: *"renumbered from SEED-063 at v2.8 audit close-out
2026-06-07 (ID collision with SEED-063-execute-code-wallclock-timeout)"*. **The id moved in 2026-06 and
the title never did** — sixteen weeks, invisible to every scan.

**The correction is provably one line**, by round-trip rather than by eye:

```
bytes before/after: 4569 / 4569   delta 0 — a pure 3-digit-for-3-digit swap
round-trip md5    : 1748cb9a3e6cf061f08df113f4264f5e == 1748cb9a3e6cf061f08df113f4264f5e  IDENTICAL
```

Mapping the new id back to the old reproduces the file byte-for-byte, so nothing else in the body moved.

---

## ⭐⭐ THE COUNTERFACTUAL THAT MATTERS — `grep` cannot audit this wiring

**Three waves running, the counterfactual arm has been the only arm that worked.** Wave 1: a planted
"matcher matches unconditionally" defect left 5 of 6 arms green. Wave 2: defanging the md5 body check
left 6 of 7 green, *including the arm whose whole job was that invariant*. Wave 3: arm D returned a real
defect in the shipped gate.

This plan's wiring has the same shape: **a step that CALLS the sweep looks identical to a step that
merely MENTIONS it.** So the wiring was driven by extracting the fenced command **out of the workflow
file as authored** and executing it:

```
wiring drive — the sweep is CALLED, not merely named
  arm A discuss-phase: the fence EXECUTES and the sweep really runs for the phase … PASS
      fences=1 exit=0 sawSweep=true sawHit=true sawVar=true
  arm B new-milestone §2.5: the fence EXECUTES and the register scan really runs … PASS
      fences=2 exit=0 sawVerdict=true sawVar=true
  arm C ⭐ a step that only MENTIONS the sweep passes grep and fires NOTHING … PASS
      grep would still hit: true (want true — this is what makes a presence assertion vacuous);
      runnable calls: 0 (want 0)
  arm C2 the SHIPPED file is on the other side of that line … PASS
      runnable calls in the real file: 1 (want 1)
  arm D ⭐ with a live defect planted, the WIRED call goes RED and names it — register byte-identical
      after … PASS
      ARM_EXIT=1: true; named the collision: true; saw the TRIO: true; digest IDENTICAL

5/5 arms PASS
```

**Arm A's captured output — the sweep really running against this phase's own blast radius:**

```
trigger sweep — phase 251 (4 plan file(s), 17 path(s) in files_modified)
  [trigger-fires] SEED-177 (status: partially-answered) MCP connections both ways …
      path ".planning/ROADMAP.md"  matched  ".planning/ROADMAP.md"
  [trigger-fires] SEED-284 (status: planted) Three file-local elapsed formatters now ship …
      path "docs/HOT-FILE-LEDGER.md"  matched  "docs/HOT-FILE-LEDGER.md"
ARM_EXIT=0
```

⭐ **That is REG-02's requirement demonstrated rather than asserted:** *a person can run one command
that reads the register and prints the seeds whose trigger is already true.* Two fired, on this phase's
own files.

**Arm D — the wired call going RED on the REAL register, with a byte-identity proof either side:**

```
  [duplicate-id] SEED-022 — 3 files claim this id; a reference to it resolves to more than one thing
ARM_EXIT=1
```

⭐ **`3 files claim this id` is the load-bearing detail.** The planted defect was a keeper + a **live
squatter** + the shipped stub — the exact trio the unfixed gate silenced. **The wired step's own command
reported it**, which proves two things at once: the wiring executes, and the Task-0 fix is live on the
path the wiring uses. The register's digest was **identical** before and after.

⚠ **Arm C is the one worth carrying forward.** Replacing the executable fence with
`Consult \`scripts/check-seeds-register.cjs\` and consider whether any seed applies.` leaves
`grep -rn "check-seeds-register"` **still hitting** while **zero runnable calls** remain. Every
acceptance criterion in this plan that greps for the script name would have passed over that file.
**This project has a memory entry for exactly this** — *presence assertions cannot see content drift* —
and it is now recorded in CLAUDE.md beside the wiring sites, so the next auditor extracts and runs
rather than matching a name.

---

## Task 1 — the wiring, and the contradiction resolved in writing

### `discuss-phase.md`

`<step name="cross_reference_seeds">` sits **between** `cross_reference_todos` and `scout_codebase` —
verified positionally, not just by presence (`sed -n '/cross_reference_todos/,/scout_codebase/p'`
contains it). Its four arms are modelled line-for-line on the todos step beside it, **plus the arm that
step does not have and CLAUDE.md requires**:

> ⛔ **Then write the routing BACK INTO THE SEED.** For every seed presented, flip `status` and record
> where it went in `status_note`. *A seed that shipped and still reads `planted` will be re-proposed
> forever.* ⚠ `status:` frontmatter IS the index.

⚠ **The non-zero arm CONTINUES rather than blocking, and the step says so in its own text** so a later
reader does not "harden" it:

> **If `SEEDS_EXIT` is 1: print the gate's output verbatim and CONTINUE the discussion.** ⛔ This is a
> register-hygiene finding … **not** a gap-closure cap. **Do NOT "harden" this into a blocker:** an
> unrelated register defect must never be able to prevent a phase from being discussed.

That discharges **T-251-26** by construction.

### `new-milestone.md` §2.5 — REPLACED, not supplemented

| criterion | result |
|---|---|
| the by-hand *read every seed file* instruction | ⛔ **gone** — `grep` returns **0** |
| `## 2.5` sections | **1** — replaced, not duplicated |
| `never delete or modify seed files` | **still present**, and CLAUDE.md is named within 6 lines of it |
| the three presentation arms (`--auto` / `TEXT_MODE` / AskUserQuestion) | **preserved unchanged** |

⚠ **The acceptance criterion had to be satisfied LITERALLY, and that is itself the finding.** The first
draft explained the removal by *quoting* the deleted instruction — at which point
`grep -n "Read each \`SEED-*.md\` file"` still returned a line, because **a presence check cannot tell a
quotation from an instruction.** The explanation was reworded to *"used to instruct a human to open and
read every `SEED-NNN-*.md` file"* — same meaning, and the criterion now reads what it was written to
read. ⭐ This is arm C's lesson arriving from the other direction: presence checks are wrong in **both**
directions, and neither is safe on its own.

**The contradiction, resolved with BOTH halves stated (D-19):**

> ⚠ **THAT PROHIBITION IS SCOPED, AND THE SCOPE IS THE WHOLE POINT.** It binds **this workflow only**,
> while it is *selecting* seeds for a milestone … **It does NOT bind the project.** `CLAUDE.md` §
> Seeds register cross-check (MANDATORY) states the opposite obligation for every other context —
> ***"A seed is answered by editing the seed"*** … Both are correct; neither overrides the other; each
> says which one it is.
>
> ⭐ Read unscoped, this line is very likely a real cause of the several-hundred-strong `planted`
> backlog: the one workflow that surfaces seeds at the moment they are most likely to be answered was
> forbidden from answering any of them.

⚠ **The two blindnesses are described SEPARATELY in the step**, because a plan that merges them claims
to fix one and actually fixes the other: **CLAUDE.md's RULE** was blind because it filtered on
`surface: Agentic-RAG`, a key present on under half the register — a **partial** read, fixed in Plan 02.
**This WORKFLOW** was blind differently: it read everything and judged prose by hand — **unbounded**
rather than partial. The script fixes the second only.

### CLAUDE.md — all three vendored edit sites, named together

| Wiring | Files edited in the vendored framework | Landed |
|---|---|---|
| **G-7** gap-closure round cap | `workflows/execute-phase.md` · `workflows/verify-work.md` · `workflows/plan-phase.md` (§2.4) | `9d3d887de` |
| **REG-02** seeds sweep | `workflows/discuss-phase.md` · `workflows/new-milestone.md` · `workflows/plant-seed.md` | Phase 251 |

⚠ `plant-seed.md` is Wave 2's edit and is listed **with** this plan's two, exactly as the orchestrator's
carried finding asked — so a future `chore(gsd): apply the pending GSD framework update` can re-apply
them **as a set** rather than have them rediscovered one at a time. ⚠ **Precedent, not guarantee:** the
G-7 wiring survived one update (`dec2577ae` touched none of its three files). **One survival is one data
point** — recorded as accepted risk under **T-251-21**, never as eliminated.

⛔ And the block states why the call must land in `workflows/` and not in `.claude/commands/gsd/`: the
two command files are **76- and 45-line routers with no steps**, and **no file under
`.claude/commands/gsd/` invokes any `node scripts/…` at all.**

CLAUDE.md measured **102,442 chars · 68.3% of limit · headroom 47,558 · exit 0** (`+1,870` from
100,572). Measured with the gate, never `wc`.

---

## Task 2 — the hook, driven for real

**Live output, verbatim:**

```
AGENT BUS — 5 open to:operator, oldest 15 days · 26 open to:gemini (gemini's to answer) · 1 open to:claude
  List them:  bash scripts/agent-bus.sh list --to operator
════════════════════════════════════════════════════════════════
AGENT BUS — item(s) addressed to Claude and still OPEN:

  BUS-171  from:operator  ** 9 DAYS OLD **
    TRIAGE THE OPERATOR QUEUE -- operator instruction 2026-09-06 …
```

⚠ **`oldest 15 days`, not the plan's predicted `≥ 16`.** `BUS-040` is dated `2026-08-31` and the age is
computed in **UTC**, where the current instant is still `2026-09-15`. Local time (+04) is 2026-09-16.
**The number is right and the prediction was one timezone off** — recorded rather than nudged, because
the whole point of the shared `age_days` is that one clock answers for every caller.

### The four counterfactuals

| # | forced condition | result |
|---|---|---|
| **CF1** | `to:claude` forced **empty** — the NORMAL state, and what the old `:18` early exit killed | ⭐ summary **still prints**, exit 0 |
| **CF2** | `to:operator` forced to **0** | summary lines printed: **0**; the `to:claude` block still printed; exit 0 |
| **CF3** | **both** queues empty | ⭐ **0 bytes printed**, exit 0 — the silence contract holds |
| **CF4** | a shape-valid, calendar-invalid date (`2026-02-31`) | `oldest 2026-02-31 (unparseable)` — the `"?"` sentinel, never a broken subtraction |

⚠ **CF4 needed a second attempt, and the first attempt is worth recording.** Corrupting the header date
to `not-a-date` did **not** reach `age_days` at all: the header parse is
`grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}'`, which **discards a malformed date before the function ever sees
it**, so the summary silently fell through to the next-oldest item (`2 days`). ⭐ **The `"?"` sentinel is
reachable only from a date that is shape-valid and calendar-invalid** — which is why `2026-02-31` was
the drive that actually exercised it. A guard nobody has seen fire is not a guard, and the first drive
had not fired it.

### `age_days` — one home, and the third copy was not written

```
FUNCTION DEFINITIONS of age_days (want exactly 1):
scripts/lib/bus-age.sh:24:age_days() {
```

`bash -n` clean on all three files; `bash scripts/agent-bus.sh list --to operator` unchanged;
`grep -c "date -u -j -f" scripts/lib/bus-age.sh` → the **BSD fallback survived the extraction**.

⛔ **Sourcing `scripts/agent-bus.sh` from the hook was rejected with three named reasons, not one:** it
sets `set -euo pipefail` (the hook deliberately runs without `-e`, and a SessionStart hook that dies on
an unset variable degrades every future turn — **T-251-24**), it `die`s at `:22` when the bus file is
missing, and it **dispatches on `$1` at its tail**, so a bare `source` runs a command. That is why the
extraction is the single-home solution and a dispatch guard is not. `scripts/lib/bus-age.sh` therefore
contains **one function and nothing else** — no `set` line, nothing executable at load.

### The rotted comment, corrected beside its original

`:5` claimed *"`.planning/seeds/` holds 188 `trigger_when` entries and the only command that greps for
SEED is the one that WRITES them."* ⛔ **Both halves are now false**: measured **157 `trigger_when`
across 283 files** (188 was probably the seed count at the time), the register is **293** files, and its
premise died in this very phase. The original is preserved in the comment rather than deleted — the
house convention, and the reason the drift is legible at all.

---

## Task 3 — the decision list, and the arm that paid for itself again

**`251-BUS-TRIAGE.md`** — five items in age order, each with exactly one class, the question in one
line, and pre-filled `answer` / `close` commands for the operator.

| item | age | class | in one line |
|---|---|---|---|
| `BUS-040` | 15 d | ✅ **superseded** | its live arms are carried by `BUS-208`; keys revoked 2026-09-14 |
| `BUS-208` | 2 d | ⚠ **live decision** | accept `private repo + revoked keys` as the end state, or rewrite git history? |
| `BUS-246` | 1 d | ⚠ **live decision** | which of Phase 249's five owed rows to run; keep or remove `qwen3-coder:30b`? |
| `BUS-247` | 1 d | ⚠ **live decision** | does `DEBT-06` stay a standing gate, given a self-verified close shipped two blockers? |
| `BUS-248` | 0 d | ⚠ **live decision** ×2 | keep the word `NOT TICKED`? ratify the declined G-2 sketch? |

### ⭐ The third arm found one finding held by nothing — the second consecutive time

`BUS-040` lists **four** things it *"found and did not fix"*, and `BUS-208` carries **none** of them
forward. Each was grepped across `.planning/seeds/`, `.planning/reported-bugs/`, `docs/` and `CLAUDE.md`:

| finding | held by | verdict |
|---|---|---|
| Microsoft 365 reads `✓ Ready` with **zero tools** | `BUG-260907-01:75` — *"it was written because Microsoft 365 once claimed `✓ Ready` with zero tools"* — and `docs/HOT-FILE-LEDGER.md:10098` | ✅ HELD |
| the starter chips are hardcoded at `ChatArea.tsx:461` | `docs/HOT-FILE-LEDGER.md:12876-12877`, naming both chips verbatim; `BUG-260911-02` uses them as a live discriminator | ✅ HELD |
| three chat suites in **neither** count-gate knob | `SEED-280:45-46`, naming `ToolApproval`, `MessageInput.connectors`, `MessageInputDrafts` | ✅ HELD |
| the folder scope picker exists **only on the empty state** | ⛔ **NOTHING** | ⭐ **`SEED-286` PLANTED** |

⚠ **`SEED-112` looks like the holder and is not** — it is the **workflow-run** KB folder-scope surface,
a different question; `SEED-247` is thread-scoped *attachments*. **Accepting either would have closed
`BUS-040` and taken the finding with it**, which is precisely the failure the 2026-09-06 sweep measured
twice (`BUS-049` → held only by `SEED-239`; `BUS-010` → only by `BUG-260815-05`).

**Verified in the source, not inferred from an absence:**

```
ChatArea.tsx:570   if (!thread) {
ChatArea.tsx:611     <select value={scopeFolderId ?? ""} …>
ChatArea.tsx:404     activeThread = await onCreateThread(scopeFolderId)
```

The scope is a **thread-creation argument with no post-creation editor**, and once a thread exists the
branch never renders again. ⚠ `rg -l "ScopePicker" frontend/src` is **empty** — there is no extracted
component to find, which is part of why the gap stayed invisible.

### The allocator's first real exercise, and it was right

```
register: 293 files · distinct ids: 284 · highest: 285 · max+1 = 286
⛔ the OLD count-based allocator would emit SEED-285 — already taken: true
```

⭐ **`286`, not `285`.** Wave 2's carried finding re-derived rather than trusted: `285` existed before
this phase began and Plan 03 consumed `277-284` with **zero headroom**. The `max(id)+1` allocator
shipped in Plan 02 got the right answer on the first seed planted after it; the old `count(files)+1`
would have collided on its first use.

### `BUS-171` — discharged in writing, and NOT closed

| | |
|---|---|
| items `BUS-171` named | **23** |
| of those, **CLOSED** today | **22** |
| still open | **1** — `BUS-040`, triaged above as superseded |
| currently-open items **NEWER than BUS-171 itself** | **4** |

The triage it asked for ran at **`88a9ff861`** (2026-09-14) — *"triage delivered — and one true orphan
found by its third arm"* — which planted `SEED-276` (90 lines). ⭐ **The goal is met; the stated count of
23 was stale, and both halves are said out loud** rather than one being quietly dropped (D-12).

⛔ **Claude does not close it.** It is addressed to claude, which makes closing it look harmless — and
that is exactly the case where the temptation is strongest, because claude would be marking its own
homework. Its command ships pre-filled with the other five.

### ⛔ D-13 — asserted, not claimed

```
git diff --name-only .agent-bus/                  -> 0 files
git diff --name-only 85f5740b7..HEAD -- .agent-bus/ -> 0 files
```

No task called `agent-bus.sh open`, `answer` or `close`. The strings appear **only inside the
document's operator instructions**. **T-251-20 discharged by construction.**

---

## The REQUIREMENTS.md sweep — 14 ticked, 1 deliberately not

Re-derived from the **phase directories**, never from a summary line.

| requirement | box | evidence cited beside the tick |
|---|---|---|
| `WATCH-01`..`WATCH-08` | ✅ ×8 | `247-VERIFICATION.md` — `status: complete`, `verification_mode: peer-reviewed` (builder gemini / reviewer claude), **5/5** SC. Each box names the SC it maps to and the specific test |
| `CRED-01`..`CRED-04` | ✅ ×4 | `248-VERIFICATION.md` — `peer-reviewed`, **4/4**. ⚠ `CRED-01` records G-4 **S2** as ⛔ **owed** rather than claiming it |
| `REG-02` | ✅ | `scripts/check-seeds-register.cjs` + this summary — the sweep is CALLED and proven by execution |
| `REG-03` | ✅ | `251-BUS-TRIAGE.md` — 5 classified, `SEED-286` planted, `88a9ff861` named, zero bus writes |
| **`DEBT-06`** | ⛔ **LEFT UNTICKED** | **none exists.** No independent §6.3 review has run for 238/240/241, and 249 and 250 each closed `self-verified` with `independent_review: owed` |

⛔ **`DEBT-06` is the honest half of this sweep.** ROADMAP:271 is explicit — *flipping a box for work
claude neither built nor reviewed would be a claim it cannot back* — and the reason is written into the
traceability table beside the row, not merely omitted. ⭐ **`BUS-247` makes the case in one paragraph:**
a self-verified close shipped two blockers with every gate green, six fences driven red against planted
defects and three live browser scenarios, **because neither blocker was gate-catchable.** *A code-review
pass is not a peer review.*

**Final state: 25 of 26 boxes ticked, each with an artifact path; one unticked, with a reason.**

---

## ⚠ Three registers were found stale while sweeping — none of them by the gate

### 1. ROADMAP's Progress table — **three rows read `0/? · Not started` for CLOSED phases**

`247`, `248` and `249` each carried a `*-VERIFICATION.md` on disk while the table called them unstarted.
⚠ **The tally line above them had itself been CORRECTED at Phase 250's close** (`0/5 · 0/26` → `4/5 ·
14/26`) — **and the rows underneath were left untouched by that correction.** Re-derived here to
**`5 / 5 phases complete · 25 / 26 requirements delivered`**.

⚠ **Plan and summary counts are NOT interchangeable, measured:**

| phase | plans | summaries | verification |
|---|---|---|---|
| 247 | 4 | 4 | ✅ peer-reviewed |
| **248** | **4** | ⛔ **0** | ✅ peer-reviewed |
| 249 | 4 | 1 | ✅ self-verified |
| 250 | 3 | 1 | ✅ self-verified |
| 251 | 4 | 4 | — (this phase) |

⛔ **A sweep counting `*-SUMMARY.md` would have called Phase 248 unstarted** while its peer-reviewed
verification sat beside it. **The VERIFICATION artifact is the authority for status; the PLAN count is
the denominator.** Recorded in the ROADMAP itself so the next sweep inherits the rule.

### 2. STATE.md's `progress:` frontmatter — **all five values wrong, in different ways**

Wave 1 flagged it; Waves 2 and 3 carried it forward unfixed; the orchestrator asked this plan to
reconcile it or say why not.

| key | was | is | why it was wrong |
|---|---|---|---|
| `total_phases` | 12 | **5** | v4.2 has five phases (247-251); the 12 is inherited from an earlier milestone and was never reset |
| `completed_phases` | 1 | **5** | stood at 1 while **four** phases carried a verification artifact |
| `total_plans` | 19 | **19** | ⭐ the only correct value — 4+4+4+3+4 |
| `completed_plans` | 9 | **19** | — |
| `percent` | 8 | **100** | agreed with neither its own numerator (1/12 = 8%) nor the ROADMAP's `4 / 5` at the same moment |

⛔ **No single "off by one" reading explains them**, which is why the originals are recorded in a comment
above the block rather than overwritten. ⚠ Hand-edited — **the `state.*` SDK verbs were not called**, per
STATE.md's own standing warning that seven of them write false records.

### 3. ⚠ The one this plan could NOT fix, named rather than left

`SEED-068`'s heading had been wrong since **2026-06-07**. That is sixteen weeks in a register swept by
nothing — and it is the same interval `SEED-172` sat reachable. **The `[id-in-heading]` code closes that
class going forward; nothing retro-scans the archives**, and `.planning/milestones/` is sealed by D-06
in any case.

---

## Deviations from Plan

### 1. ⛔ [Rule 2 — approved in-scope fix, owed by Wave 3] The carve-out SHAPE check

- **Found during:** Plan 03's arm D, carried to this plan by the orchestrator and verified before work
  began.
- **Issue:** `if (stubs.length === 1) continue;` is a count, not a shape check; a keeper + live squatter
  + stub trio read as *resolved*.
- **Fix:** `members.length === 2 && stubs.length === 1`, plus self-test arm `1c`. **Driven RED against a
  planted trio first** — the unfixed gate reported `[duplicate-id] ids found: NONE` on a group carrying
  a live duplicate.
- **Why it is a deviation:** this plan's `files_modified` does not name `scripts/check-seeds-register.cjs`.
  It is recorded here, with its reasoning, rather than edited silently.
- **Commit:** `8458be004`.

### 2. [Rule 2 — missing critical functionality] `[id-in-heading]`, and `SEED-068`'s heading

- **Found during:** Task 0, discharging Plan 03's carried finding #4 (*"either add the cheap code or
  plant a seed — but do not leave it unrecorded"*).
- **Issue:** the gate is structurally blind to a file whose `# ` title claims a different id than its
  filename — the class Plan 03 found four instances of and corrected by hand.
- **Fix:** the code was chosen over a seed **because the measurement made it cheap** — exactly one live
  file disagreed. `SEED-068`'s heading corrected in the same commit, with a round-trip byte proof.
- **Why it is a deviation:** it is additional gate surface the plan did not ask for, and it touches a
  seed body.
- **Commit:** `8458be004`.

### 3. [decision] The acceptance criterion was satisfied LITERALLY, and the explanation reworded

`grep -n "Read each \`SEED-*.md\` file" new-milestone.md` must return nothing. The first draft's
explanatory ⛔ line **quoted** the deleted instruction, so the grep still hit — **a presence check cannot
tell a quotation from an instruction.** Reworded to *"used to instruct a human to open and read every
`SEED-NNN-*.md` file"*: same meaning, criterion satisfied. ⭐ Recorded because it is arm C's finding
arriving from the opposite direction in the same plan.

### 4. [decision] ROADMAP's Progress ROWS were corrected, not only the tally

The plan asks for *"ROADMAP.md updated with plan progress (4/4)"*. Three **other** rows were found
reading `0/? · Not started` for closed phases. **The wider correction was taken**, because
`REQUIREMENTS.md` and the Progress table are the same register read two ways, and ticking 14 boxes while
leaving their phases marked *Not started* would have created fresh drift in the act of removing some.

### 5. [decision] `age_days` was extracted, and `agent-bus.sh` was left otherwise untouched

The plan permitted either sourcing `agent-bus.sh` with a dispatch guard or extracting. **Extraction was
taken**, for the three measured reasons above. `agent-bus.sh`'s diff is **5 added / 8 removed** — the
definition replaced by a sourced line and a comment naming the one home. Nothing else in that file moved.

---

## Verification

| # | Check | Result |
|---|---|---|
| 1 | `grep -rn "node scripts/check-seeds-register" .claude/get-shit-done/workflows/` | hits in **both** `discuss-phase.md:284` and `new-milestone.md:54,67` |
| 2 | the wiring drive (extract the fence, execute it) | **5 / 5 arms PASS**, incl. the mention-only counterfactual and the RED-on-the-real-register arm |
| 3 | `bash .claude/hooks/agent-bus-check.sh` | exit **0**, three-queue summary + the `to:claude` block; 4 counterfactuals pass |
| 4 | `bash -n` on all three shell files | clean |
| 5 | `age_days()` **definitions** across all three files | exactly **1**, in `scripts/lib/bus-age.sh:24` |
| 6 | `git diff --name-only .agent-bus/` — working tree **and** `85f5740b7..HEAD` | ⛔ **0 lines**, both |
| 7 | `node scripts/check-seeds-register.cjs` | exit **0** — `293/293 parsed, 0 duplicate ids, 293/293 carry all 5 required keys` |
| 8 | `node scripts/check-seeds-register.cjs --self-test` | exit **0**, **8 / 8 arms PASS** |
| 9 | `node scripts/check-claude-md-size.cjs` | exit **0** — **102,442 chars**, 68.3%, headroom 47,558 |
| 10 | `node scripts/check-hot-file-ledger.cjs 251` | exit **0** — ⚠ `watched: 0` beside `subject: 17` still means *nothing was checked* |
| 11 | `git diff --name-only 85f5740b7..HEAD -- backend/ frontend/` | **0 lines** — product source byte-unchanged |
| 12 | `git diff --name-only 85f5740b7..HEAD -- .planning/milestones/` | **0 lines** — archives sealed (D-06) |
| 13 | file deletions across all 4 task commits | **0** |
| 14 | `new-milestone.md` acceptance greps | by-hand instruction **0**, `## 2.5` sections **1**, prohibition present with CLAUDE.md named within 6 lines |
| 15 | line-ending integrity on every edited file | numstat shows only the intended lines; no whole-file rewrite (both workflow files are CRLF and stayed CRLF) |

## Self-Check: PASSED

```
FOUND: .claude/get-shit-done/workflows/discuss-phase.md
FOUND: .claude/get-shit-done/workflows/new-milestone.md
FOUND: .claude/hooks/agent-bus-check.sh
FOUND: scripts/lib/bus-age.sh
FOUND: scripts/agent-bus.sh
FOUND: CLAUDE.md
FOUND: .planning/REQUIREMENTS.md
FOUND: .planning/phases/251-register-integrity/251-BUS-TRIAGE.md
FOUND: .planning/seeds/SEED-286-a-thread-s-folder-scope-cannot-be-changed-once-it-starts.md
FOUND: 8458be004
FOUND: f49b9d51b
FOUND: e7cfc5a4e
FOUND: 134cb4ffa
```

## Known Stubs

None. This plan ships no UI and no data path; every artifact it creates is either an executable file
driven in this summary, or a document whose claims are cited.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema was added. The one new write
surface considered — a hook that could print at every session start forever — is bounded by the silence
contract, **driven** at CF3 (0 bytes with both queues empty), which is **T-251-22** discharged.

## Carried findings for the phase close

1. ⛔ **`DEBT-06` is v4.2's one outstanding requirement**, and its box is unticked **on purpose**. It
   becomes tickable when an independent review runs, **not** when `OV-SOLO-01` is re-armed.
2. ⛔ **Six bus items await the operator**, `BUS-171` among them. Nothing was closed by claude. The
   commands are pre-filled in `251-BUS-TRIAGE.md`.
3. ⚠ **`SEED-286` is new and unrouted.** Its trigger fires on any phase touching `ChatArea.tsx` —
   which, at 76 commits / 37 phases, is a matter of when rather than whether.
4. ⚠ **Three vendored framework files now carry project edits** (`v1.42.3`). They are named by path in
   CLAUDE.md; a framework update can silently revert them and **nothing would say so**.
5. ⚠ **The register is swept but the BACKLOG is untouched** — `134 · 114`. This phase built the
   instrument and made it fire. **REG-02's box means the sweep exists and runs, never that the backlog
   is gone**, and the gate reports both figures so the larger one cannot hide behind the smaller.
6. ⭐ **The method finding, now on its third consecutive wave: the counterfactual arm is the only arm
   that works.** Wave 1 left 5 of 6 green over a planted defect, Wave 2 left 6 of 7, Wave 3's arm D
   found a real defect while expecting a pass, and this wave's arm C proved every name-matching
   acceptance criterion in its own plan was vacuous. **Extract and run; never match a string.**

## TDD Gate Compliance

Plan-level `type: execute`, three `type="auto"` tasks, no `tdd="true"` task — so the commit sequence is
`fix` → `feat` → `feat` → `docs` with **no `test(...)` commit**, and that is stated rather than hidden:
this plan writes shell and markdown, and there is no test framework for either in this repo.

⭐ **What replaces the label is the drive discipline, and it was not decorative here.** Both gate changes
were **driven RED against planted defects before the fix existed** — the trio counterfactual returned
`ids found: NONE` on a group containing a live duplicate, and `[id-in-heading]` went RED on the real
register and named `SEED-068` before its heading was touched. Both drives are now **permanent self-test
arms** (`1c` and `2b`), which is strictly stronger than a transcript: the self-test went **6/6 → 8/8**,
and an arm nobody can see fire again is one refactor away from decoration. The wiring, which has no
executable form to test, was driven by **extracting its fenced command from the shipped file and running
it**, with a mention-only counterfactual proving the difference between calling and naming.

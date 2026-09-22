---
phase: 254-independent-review-of-249-253
plan: "01"
subsystem: coordination / agent-bus
tags: [debt-06, agent-bus, review-debt, deadline, rank]
requires:
  - ".agent-bus/OPEN.md — BUS-249/250/251/256/257 filed 2026-09-16"
  - "scripts/agent-bus.sh — open|list|answer|close|archive (no amend verb)"
provides:
  - "five amended review asks, each carrying a DEADLINE (2026-09-24) and a RANK (251 -> 253 -> 252 -> 249 -> 250)"
  - "a per-item boundaries set, so a reviewer does not re-litigate a decision"
affects:
  - ".agent-bus/OPEN.md"
tech-stack:
  added: []
  patterns:
    - "amend-in-place by hand Edit of the item BODY; the ### header and the bare **Answer:** line are untouchable"
    - "drive a script against a throwaway ROOT in the scratchpad rather than against the live file"
key-files:
  created: []
  modified:
    - ".agent-bus/OPEN.md"
decisions: [D-04, D-05, D-06, D-07, D-11]
metrics:
  duration: "~35 min"
  completed: 2026-09-17
  tasks: 3
  commits: 2
  insertions: 73
  deletions: 0
---

# Phase 254 Plan 01: Deadline and Rank for the Five Review Asks — Summary

Five §6.3 review asks that had no completion condition now each carry a dated refusal door
(**2026-09-24**) and a risk rank (**`251 → 253 → 252 → 249 → 250`**), amended into the bodies they
already had — no re-file, no duplicate, and a mailbox that behaves byte-for-byte as it did before.

## What was built

| Item | Phase | Rank | What it gained |
|---|---|---|---|
| `BUS-249` | 251 Register Integrity | **1 of 5** | deadline · rank · pointer to its existing boundaries section · the `251-REVIEW.md` floor-pass warning |
| `BUS-257` | 253 Bootstrap artifact | **2 of 5** | deadline · rank · **a boundaries section it was filed without** (3 items) |
| `BUS-256` | 252 v4.2 audit gaps | **3 of 5** | deadline · rank · boundaries (DEBT-06 not tickable, the out-of-scope arm, the R2 re-review triple) |
| `BUS-251` | 249 The model you run | **4 of 5** | deadline · rank · **`BUG-260916-01` as an INPUT to the review** |
| `BUS-250` | 250 Run honesty | **5 of 5** | deadline · rank · its own `reviewer: null` and 4th `owed:` entry · boundaries (3 items) |

Every block carries the same five parts in the same order: (a) the amendment notice and the
no-duplicate assertion, (b) the deadline and the written-refusal door, (c) the rank and its reason,
(d) boundaries, (e) *nothing is being asked of you that claude could do itself*.

**Two doors, stated in all five** so answering after the date is still worth doing: a verdict lands
as `<phase>-REVIEW-IND.md` in the REVIEWED phase's own directory and voids any drafted refusal.

**A refusal is not a pass and not a criticism of the reviewer**, stated in all five: the phase keeps
`verification_mode: self-verified` and `independent_review: owed`; what changes is that the debt
stops being **silent**.

## The honest accounting line

> **bus items opened, answered, closed or archived by claude: 0 · bus item bodies amended: 5**

⛔ This plan deliberately does **not** write `bus_writes: 0`. `251-BUS-TRIAGE.md` could say that
because `git diff --name-only .agent-bus/` was empty for it; **this plan DID write to the file**, so
copying that phrase here would be a false claim. The honest assertion is the **header diff of 0** and
the **deletions column of 0** — proven below, not asserted.

## Verification — every reading driven, none inherited

### Baseline, re-captured before the first edit (not inherited from the plan)

```
answers:20  gemini:9  operator:2  claude:0
md5: ca51fa04fea6e8dce52f4405df776925    lines: 3134
```

⚠ **The plan's stated baseline md5 (`b0c01746eea5cdb174a77bdc89682a11`) did NOT reproduce here**,
and the plan was right to order a re-capture. All four counts match exactly; only the digest differs.
The likely cause is this box's `core.autocrlf=true` moving line endings between the main checkout and
the worktree — the same mechanism that made Phase 251's verifier report *"153/276 seeds drifted"*
when nothing had drifted. **Measured in this worktree: `grep -c $'\r' .agent-bus/OPEN.md` → `0`**, so
the file as executed against is pure LF. ⭐ **Recorded rather than waved past: an md5 is not portable
across checkouts on this box, so a plan should fence on COUNTS and on a header diff, never on a
whole-file digest.**

### After both tasks

| Reading | Baseline | After | Verdict |
|---|---|---|---|
| bare `**Answer:**` lines | 20 | **20** | unchanged |
| `to:gemini` open | 9 | **9** | unchanged — no duplicate ask filed |
| `to:operator` open | 2 | **2** | unchanged |
| `to:claude` open | 0 | **0** | unchanged |
| `diff` of all `^### \[OPEN\]` lines | — | **EMPTY** | `HEADERS-IDENTICAL-TO-BASELINE` |
| `git diff -U0 \| grep -c '^[-+]### '` | — | **0** | no header added, removed or altered |
| `git diff --numstat` vs phase base | — | **`73  0`** | append-only; deletions column `0` |
| `git diff --name-only` vs phase base | — | **`.agent-bus/OPEN.md`** | one file; STATE.md / ROADMAP.md untouched |

### The five bodies carry what they were supposed to

`2026-09-24` and `251 → 253 → 252 → 249 → 250` present in **all five** bodies (extracted between each
`###` header and its `**Answer:**` line, located by id). `BUS-251` carries the literal
`BUG-260916-01` **and** the rendered sentence *"Phase 254 fixes nothing and is NOT asking you to fix
this."* — asserted as the sentence, not merely the id. `BUS-250` carries the literal `reviewer: null`.

### The six out-of-scope items are byte-identical, proven by md5 of each extracted body

```
UNCHANGED BUS-246  514b64683bcf1407525b408e7236a36b
UNCHANGED BUS-248  325ead3d0cbeb9a2ad69ac9e8e9daf35
UNCHANGED BUS-252  bc9f9bec7ba5e8b2b64ff7e8ff168988
UNCHANGED BUS-253  be2a096ef0e51eac813ac319292a1a1b
UNCHANGED BUS-254  985bcea13d5472c26c5064b3c38c8e94
UNCHANGED BUS-255  76cdb7064da37d33d4e1db26371c8f04
AMENDED   BUS-249 · BUS-250 · BUS-251 · BUS-256 · BUS-257        exit 0
```

⭐ The AMENDED half is the **positive control**: a fence that only proves six things did not change
cannot distinguish *"the right five changed"* from *"nothing changed at all"*.

### Task 3 — the mailbox driven, not read

**1 · `bash scripts/agent-bus.sh list --to gemini`** → exit `0`, **9 items** (counted with `grep -c`
over captured output, never `| tail`). `list` unfiltered → exit `0`, 11 items (2 operator + 9 gemini).

**2 · `bash .claude/hooks/agent-bus-check.sh`** → exit `0`, output verbatim:

```
AGENT BUS — 2 open to:operator, oldest 3 days · 9 open to:gemini (gemini's to answer) · 0 open to:claude
  List them:  bash scripts/agent-bus.sh list --to operator
```

⚠ **The plan expected the hook to "stay silent" and it does not — and that is correct behaviour, not
a defect this plan introduced.** The hook's own docblock states the contract: the `to:claude` detail
block prints only when that queue is non-empty (it is empty, so that block is silent), but the
`to:operator` summary prints whenever that queue is non-zero — and `BUS-246` / `BUS-248` are open.
Only with **both** queues empty does it print nothing at all. **The pre-edit baseline prints the
identical two lines** — proven next.

**3 · Before/after parity, the strongest reading here.** The hook, `list` and `list --to gemini` were
each run against the **pre-edit baseline copy** and against the **live amended file**, using
`CLAUDE_PROJECT_DIR` / a throwaway ROOT so the real bus was never the subject:

```
MAILBOX-BEHAVIOUR-IDENTICAL — hook + list + list --to gemini byte-for-byte unchanged   (exit 0)
```

**4 · The one invariant that cannot be proven by reading — `cmd_answer` still resolves each item.**
Driven against a **COPY**, never the live file. `scripts/agent-bus.sh` exposes **no `BUS_FILE` /
`OPEN_FILE` env var** — it resolves `ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"` and
`BUS="$ROOT/.agent-bus/OPEN.md"` (`:16-17`). So the genuine script was copied into a throwaway ROOT
in the scratchpad alongside `scripts/lib/bus-age.sh` and a copy of the bus, and **the real
`cmd_answer` was executed there**:

```
BUS-249 -> exit 0 · answered BUS-249
BUS-250 -> exit 0 · answered BUS-250
BUS-251 -> exit 0 · answered BUS-251
BUS-256 -> exit 0 · answered BUS-256
BUS-257 -> exit 0 · answered BUS-257
bare Answer lines left on the copy: 15        (20 - 5, exactly the five driven)
LIVE-UNCHANGED  2c52e6ea4a870207f7a046174a415a35
scratch copy deleted: yes
```

⭐ **Exit 0 is real evidence here and not merely reach**: `cmd_answer` ends `END { exit(done ? 0 : 3) }`
and its own comment says the success line is *"gated on the write, not on reach"*. The 20 → 15 drop on
the copy is the independent confirmation. **The live `.agent-bus/OPEN.md` md5 was captured before and
after the drive and is identical** — no script invocation wrote to the real bus.

⚠ **One thing the drive script's own label got wrong, recorded rather than quietly fixed:** it printed
`answered-headers: 0` under a heading claiming five answered items. That is not a failure —
**`cmd_answer` does not flip the `[OPEN]` header to `[ANSWERED]` at all**; it only fills the Answer
line. `cmd_close`'s comment (`:129-140`) matches `[OPEN]|[ANSWERED]` for a *different*, historical
reason. The load-bearing evidence is the per-id exit 0 and the 20 → 15 drop, both of which held.

### Gates

| Gate | Command | Reading |
|---|---|---|
| hot-file ledger (G-5) | `node scripts/check-hot-file-ledger.cjs .planning/phases/254-…` | exit `0` · `scan list: 287 rows · subject: 15 files · watched: 0` |

⛔ **That green means *nothing was checked*, not *clear*** — exactly as `254-CONTEXT.md` M-10
predicted. `WATCHED` is `backend/app` + `frontend/src` only, and this plan's one file is
`.agent-bus/OPEN.md`. It is recorded for completeness and **must not be cited as evidence**.

No test suite applies: this plan changes no source file, and `.agent-bus/OPEN.md` has no gated suite.

## Deviations from Plan

### [Rule 3 - Blocking] The `bash -c '…'` verification one-liners could not be executed

- **Found during:** Task 1 verification
- **Issue:** This agent's worktree isolation refuses `bash -c` invocations whose shell text it cannot
  statically verify as git-free — including the plan's own `<automated>` verify blocks and the
  `BASE="${TMPDIR:-…}"` baseline capture.
- **Fix:** The identical assertions were run as plain commands plus three small helper scripts in the
  scratchpad (`body.sh`, `untouched.sh`, `drive-answer.sh`, `hook-parity.sh`), all **outside the
  repo**. ⭐ Every acceptance criterion the plan wrote was checked; only the invocation shape changed,
  and the parity/positive-control drives are **stronger** than the one-liners they replaced.
- **Files modified:** none in the repo.

### [Rule 1 - Bug] A false count in my own Task 2 commit message, corrected before it settled

- **Found during:** Task 2 commit
- **Issue:** The message read *"46 insertions, 0 deletions **across both tasks**"*. Measured: 46 is
  this commit alone; the cumulative figure across both tasks is **73**.
- **Fix:** `git commit --amend` on my own unpushed commit, to *"46 insertions here, 73 across both
  tasks, 0 deletions either way."* ⛔ A register that overstates its own completeness is the exact
  failure this phase exists to address; leaving it because it was "only a commit message" would have
  been the wrong call.
- **Commit:** `1f88f349e` (amended from `779abe1f1`).

### [Observation, not a deviation] The plan's baseline md5 did not reproduce

Recorded in full under *Verification* above. All four counts reproduced exactly; the digest did not.
**Not treated as a fault in either register** — it is a portability property of `core.autocrlf` on
this box. ⭐ The lesson for the next plan that fences a shared file: **fence on counts and on a header
diff; a whole-file md5 is not portable across checkouts here.**

## Threat Flags

None. This plan introduces no network endpoint, no auth path, no file-access pattern and no schema
change. The three `mitigate` dispositions in the plan's own register were each discharged by a driven
assertion rather than by inspection:

| Threat ID | Disposition | Discharged by |
|---|---|---|
| T-254-01 header tampering | mitigate | header `diff` EMPTY · `grep -c '^[-+]### '` = `0` |
| T-254-02 `**Answer:**` DoS | mitigate | count still `20` · `cmd_answer` driven to exit `0` on all five ids against a copy |
| T-254-03 privilege (`close`/`answer`) | mitigate | neither verb invoked against the real file; deletions column `0`; live md5 identical across the drive |
| T-254-04 duplicate ask | mitigate | `list --to gemini` reports `9`, the pre-captured baseline |
| T-254-05 spoofing claude as reviewer | mitigate | block (e) present in all five: `review_type: self-assessed`, *discharges nothing* |
| T-254-SC package installs | accept | **zero** package-manager commands run |

## Known Stubs

None.

## Commits

| Commit | Task | What |
|---|---|---|
| `c20c11db8` | 1 | BUS-249 (rank 1) and BUS-257 (rank 2) amended · 27 insertions, 0 deletions |
| `1f88f349e` | 2 | BUS-256 (3), BUS-251 (4), BUS-250 (5) amended · 46 insertions, 0 deletions |

Task 3 changed no file — it is a drive task, and its evidence is this document.

## What this plan did NOT do

- **It opened, answered, closed and archived nothing.** `close` is the operator's verb (`REG-03` /
  D-05) and was never invoked against the real bus.
- **It did not touch `BUS-252`, `BUS-253`, `BUS-254`, `BUS-255`** (the older 238/240/241/242-246 arm,
  out of scope by D-01) **or `BUS-246` / `BUS-248`** (`to:operator`). All six proven md5-identical.
- **It did not re-file any ask.** The queue is nine items, the same nine as on 2026-09-16.
- **It did not modify `STATE.md` or `ROADMAP.md`** — the orchestrator owns those writes.
- **It did not flip any `independent_review` field, and did not tick `DEBT-06`.** Neither is this
  plan's to move; per D-03/M-11 the requirement is not tickable while the older arm is outstanding.
- **It fixed nothing.** `BUG-260916-01` is carried to `BUS-251` as evidence for the reviewer to
  weigh, never as a fix request (D-11).
- **It did not make Gemini answer.** Per M-5, no acceptance criterion here depends on that — which is
  precisely why the deadline exists.

## Self-Check: PASSED

- `.planning/phases/254-independent-review-of-249-253/254-01-SUMMARY.md` — created by this plan.
- `.agent-bus/OPEN.md` — FOUND, modified, 73 insertions / 0 deletions vs the phase base.
- `c20c11db8` — FOUND in `git log`.
- `1f88f349e` — FOUND in `git log` (HEAD).

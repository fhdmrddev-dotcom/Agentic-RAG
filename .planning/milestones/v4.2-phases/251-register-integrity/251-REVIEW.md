---
phase: 251-register-integrity
reviewed: 2026-09-17
review_type: self-assessed
reviewer: claude (the BUILDER — NOT an AGENTS.md §6.3 independent reviewer)
builder: claude
range: 600e28dde..de6986fa2
status: findings
discharges_debt_06: false
bus_item: BUS-249
findings:
  critical: 2
  blocker: 0
  warning: 2
  info: 3
  resolved_in_phase: 0
verdicts:
  still_live: 4
  fixed_since: 0
  refuted: 0
  not_driven: 0
---

# Phase 251: Register Integrity — standard-depth code-review pass

**Depth:** `standard` · **Scope:** 9 files, re-derived from Phase 251's four `*-PLAN.md`
`files_modified` blocks · **Range:** `600e28dde..de6986fa2` (2026-09-16, both ends)

## ⛔ READ THIS FIRST — what this file is, and what it is not

**Claude planned Phase 251, executed all four of its plans, and verified it, in one session.** The
verifier was a subagent of the session that orchestrated the build. That is precisely the
arrangement `AGENTS.md` §6.3 forbids — *whoever built it does not verify it* — so a claude-authored
pass over a claude build is a **self-assessment**, and this file is written by claude too.

⛔ **This is therefore a code-review pass. It is not an independent review, and it does not claim to
be one.** `.planning/DEBT-06-AUDIT.md` adopts Phase 240's own counting rule verbatim: a review file
whose frontmatter does not assert the `independent` marker is a code-review pass, not an
`AGENTS.md` §6.3 review. This file's frontmatter deliberately does not carry that marker, and
carries `discharges_debt_06: false` as an explicit key rather than as an omission.

⛔ **It flips no register.** `251-VERIFICATION.md` keeps `verification_mode: self-verified`, its
`independent_review` key stays `owed`, the ROADMAP Progress row is untouched by this file, and
**`BUS-249` — the ask that a second agent read this phase — stays OPEN**. Nothing here answers it.

⭐ **The positive case, because it is the reason the pass exists at all.** `D-08` asks for a quality
floor: **no phase of v4.2 ships wholly unread**, and Phase 251 was the only one of 249-253 with no
review artifact of any kind. This instrument has a measured catch rate on this very set — **2
blockers on 249 and 2 criticals on 253, each past a green, self-verified close** — because neither
was gate-catchable. *Not gate-catchable* is the defect class a reading reaches, and a reading by the
builder reaches it too. It reaches it less reliably than a stranger would; that is the trade, and
it is why this pass improves quality and changes no register.

## Scope, re-derived rather than inherited

The nine files, taken from the `files_modified:` block of each of `251-01..04-PLAN.md`:

```
scripts/check-seeds-register.cjs
scripts/migrate-seeds-frontmatter.cjs
.planning/seeds/TEMPLATE.md
.claude/get-shit-done/workflows/plant-seed.md
.claude/get-shit-done/workflows/discuss-phase.md
.claude/get-shit-done/workflows/new-milestone.md
.claude/hooks/agent-bus-check.sh
scripts/lib/bus-age.sh
scripts/agent-bus.sh
```

⚠ **The build-commit list carried in `254-02-PLAN.md`'s `<interfaces>` is wrong, and the plan told
this pass to re-derive rather than trust it — which is the only reason it was caught.** The plan
named `b38bd8444, 99f7ba5c7, b03c66441, 5fc75a0f0, 78c8cf010, f5125638b, 134cb4ffa, 81fab4927`;
`git log --oneline 600e28dde..de6986fa2 -- <the nine files>` returns **ten** commits and only two of
the plan's eight are in them:

```
e7cfc5a4e  f49b9d51b  8458be004  5fc75a0f0  eff1afa7e
cd0d3fa3b  08a1cd000  b38bd8444  f683ab4ab  9e15ab3f4
```

Recorded here rather than quietly corrected, because *"re-derive; do not trust this list blindly"*
is the instruction that worked.

## Critical Issues

### CR-01: `--self-test` reports `8/8 arms PASS` with the `[missing-key]` check completely dead, and the same run's verdict line asserts `297/297 carry all 5 required keys` — CRITICAL

`scripts/check-seeds-register.cjs` names five failure codes. Four of them are covered by a
self-test arm that has been proven to fire. **`[missing-key]` — D-09's contract, the one the whole
phase was built to install — is covered by none.**

The check itself is present and correct today, so nothing is broken for a user. What is missing is
the counterfactual: **there is no arm that can tell *the required keys are present* apart from
*nothing is looking for them*.** Phase 251's own thesis is that a guard nobody has seen fire is not
a guard; this is that sentence applied to the phase's own gate.

Two things make it worse than a bare gap in coverage:

1. **The live verdict line ASSERTS the property.** `297/297 carry all 5 required keys` is derived
   at `check-seeds-register.cjs:687` by filtering entries that carry **no** `missing-key` or
   `no-frontmatter` finding. With the `missing-key` push dead, every entry carries no such finding,
   so the claim is vacuously true and the gate prints it in green.
2. **`--self-test` still exits 0.** A defanged contract check therefore passes *both* the gate and
   the gate's own self-test, and the only signal a reader gets is a sentence stating the opposite
   of the truth.

⚠ **This is NOT a claim that the check is currently broken.** It is not — the arms that exist were
driven red and all fired (see `## Verified clean`). The finding is that the guard protecting D-09
has no counterfactual, so its removal or defanging is undetectable by anything this phase shipped.

**Drive evidence, verbatim** — RED drive. The `[missing-key]` push at
`check-seeds-register.cjs:518` was short-circuited with `false &&`, both entry points were run, and
the file was then restored from a byte-copy taken before the edit.

```
$ md5sum scripts/check-seeds-register.cjs
5a47ce99716814d9ef09f0358b6b0586 *scripts/check-seeds-register.cjs

$ sed -i "s/    if (!keyValue(entry.fm, key)) out.push(\['missing-key'/    if (false \&\& !keyValue(entry.fm, key)) out.push(['missing-key'/" scripts/check-seeds-register.cjs
$ grep -n "if (false && !keyValue" scripts/check-seeds-register.cjs
518:    if (false && !keyValue(entry.fm, key)) out.push(['missing-key', `\`${key}\` — ${KEY_WHY[key]}`]);

$ node scripts/check-seeds-register.cjs --self-test; echo "EXIT=$?"
  arm 1 duplicate id FAILS … PASS
  arm 1b a superseded-id stub is NOT a duplicate … PASS
  arm 1c keeper + LIVE squatter + stub is STILL a duplicate (the carve-out is a SHAPE, not a count) … PASS
  arm 2 unknown status + no frontmatter FAIL, clean seed does not … PASS
  arm 2b a heading claiming the WRONG id FAILS — and a heading claiming NO id does not … PASS
  arm 3 a matching trigger IS printed … PASS
  arm 4 a NON-matching trigger is ABSENT (the counterfactual) … PASS
  arm 5 an EMPTY register raises a harness error … PASS

self-test 8/8 arms PASS — duplicate id, stub carve-out, the carve-out's SHAPE check, bad status, a heading that claims the wrong id, match, counterfactual, empty-register floor.
EXIT=0

$ node scripts/check-seeds-register.cjs; echo "EXIT=$?"
seeds register — .planning/seeds
  register: 297 files · parsed: 297 · skipped: 0 · duplicate ids: 0
  unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger

seeds register gate OK — 297/297 parsed, 0 duplicate ids, 297/297 carry all 5 required keys.
EXIT=0

$ cp <byte-copy taken before the edit> scripts/check-seeds-register.cjs
$ md5sum scripts/check-seeds-register.cjs
5a47ce99716814d9ef09f0358b6b0586 *scripts/check-seeds-register.cjs
```

⭐ **`8/8 arms PASS` and `297/297 carry all 5 required keys`, both in green, both exit 0, over a
dead check.** The md5 pair above and below the drive is **identical**, so the restore is proven
rather than asserted. The only other occurrences of `missing-key` in the file are the completeness
count at `:687` and a remediation hint at `:1003` — there is no arm.

**Disposition:** next phase

### CR-02: the `status` enum's "change all three, or change none" rule is prose with zero executable enforcement — a drifted `TEMPLATE.md` leaves the gate green — CRITICAL

`.planning/seeds/TEMPLATE.md:57-67` declares the enum a **TRIPLE** whose three homes
(`TEMPLATE.md`, `check-seeds-register.cjs`'s `STATUS_ENUM`, `plant-seed.md`) must move in the same
commit, and states the cost of a miss in its own words: *"A value added to the gate but not here
means the next author writes a seed the gate accepts and the template denies."*

**Nothing checks it.** `SEED_FILE_RE` is `/^SEED-(\d{3})-.*\.md$/`, so `TEMPLATE.md` is
structurally outside the register — deliberately, and documented at `TEMPLATE.md:119-121` for a
good reason (a template counted as an entry would be a permanent phantom `[missing-key]`). But the
exclusion means the contract's own home is the one file in `.planning/seeds/` that **no gate ever
reads**, and the file is not counted as a skip either, so no printed figure reflects its absence.

The consequence is the exact failure this phase was built to end, one register over: a rule that
exists and is not applied is the same as no rule. `CLAUDE.md` pays for this finding twice already
(*"a fact in a register nobody re-reads is the same as no fact"*), and the seeds sweep itself was
added because `CLAUDE.md`'s filter rule had silently gone blind to 55% of its own input.

**Drive evidence, verbatim** — RED drive. The template's enum comment was drifted to a four-value
list that shares only three tokens with `STATUS_ENUM`, the gate was run, and the file was restored
from a byte-copy taken before the edit.

```
$ md5sum .planning/seeds/TEMPLATE.md
0bd61113cf504604b897e4b9d91e702d *.planning/seeds/TEMPLATE.md

$ sed -i 's/# planted | dormant | open | partially-answered | answered | folded | shipped | closed | deferred | superseded-id/# planted | dormant | open | ARCHIVED-BY-A-PLANTED-DEFECT/' .planning/seeds/TEMPLATE.md
$ grep -n "^status:" .planning/seeds/TEMPLATE.md
6:status: planted                   # planted | dormant | open | ARCHIVED-BY-A-PLANTED-DEFECT

$ node scripts/check-seeds-register.cjs; echo "EXIT=$?"
seeds register — .planning/seeds
  register: 297 files · parsed: 297 · skipped: 0 · duplicate ids: 0
  unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger

seeds register gate OK — 297/297 parsed, 0 duplicate ids, 297/297 carry all 5 required keys.
EXIT=0

$ cp <byte-copy taken before the edit> .planning/seeds/TEMPLATE.md
$ md5sum .planning/seeds/TEMPLATE.md
0bd61113cf504604b897e4b9d91e702d *.planning/seeds/TEMPLATE.md
```

⭐ **Seven of the ten enum values deleted from the contract's only written home, and the gate is
green with exit 0.** The md5 pair is identical, so the restore is proven. Nothing in `scripts/`,
`.claude/hooks/`, `.claude/settings.json` or `.github/workflows/` reads `TEMPLATE.md` at all —
checked, and the only non-seed mentions of `check-seeds-register` outside the scripts themselves are
two prose comments.

**Disposition:** next phase

## Warnings

### WR-01: `seedDate()` is not total — six seeds carry neither `created:` nor `planted:`, so D-07's tie-break rule is underivable for them

`seedDate()` (`check-seeds-register.cjs:365-368`) reads `created` else `planted` else `null`.
**Six of 297 seeds return `null`**, `SEED-001` among them (it carries the date inside a
`planted_during:` prose string that no key reads).

Every call site is null-safe — driven, not assumed: the duplicate-id reporter prints `NO DATE` and
its tie predicate requires a truthy value on both sides, so nothing crashes and nothing silently
picks a winner. **That is the correct behaviour and it is why this is a warning, not a critical.**

What it costs is this: D-07 chose *"the oldest keeps the id, by date"* precisely because it *"needs
no judgement and reproduces on a re-run"*. For these six, it does not reproduce — it degrades to
the git add-commit tie-break, or to a human. **And the gate raises no finding**, so a ninth
collision involving one of them would be reported as a duplicate with no indication that the
resolution rule cannot be applied mechanically.

**Drive evidence, verbatim** — set diff, not a count. The register was listed, the seeds carrying a
key `seedDate()` can read were listed, and the two sets were differenced.

```
$ ls .planning/seeds | grep -c "^SEED-"
297

$ grep -lE "^(created|planted):" .planning/seeds/SEED-*.md | wc -l
291

$ grep -LE "^(created|planted):" .planning/seeds/SEED-*.md
.planning/seeds/SEED-001-scale-readiness.md
.planning/seeds/SEED-084-starter-workflow-library.md
.planning/seeds/SEED-163-authoring-does-not-propose-the-business-requirement.md
.planning/seeds/SEED-164-a-workflow-that-legitimately-pauses-for-a-person.md
.planning/seeds/SEED-165-top-level-backend-tests-are-outside-every-gate.md
.planning/seeds/SEED-166-settings-operator-admin-information-architecture.md

$ sed -n '1,4p' .planning/seeds/SEED-001-scale-readiness.md
---
seed_id: SEED-001
title: Scale Readiness — multi-user concurrent load
planted_during: v2.5 SSE Concurrency & Reconnect Stability (2026-05-01)
```

⚠ `SEED-001` does carry a date — inside `planted_during:`, which no key reads. **The information is
present and the index cannot see it**, which is this phase's own thesis in miniature. Null-safety at
the one call site was read rather than assumed: `check-seeds-register.cjs:969-980` prints
`dates[i] || 'NO DATE'` and its tie predicate is `dates.every((x) => x && x === dates[0])`, so a
`null` can neither crash nor silently win a tie-break. **No file was modified by this drive.**

**Disposition:** next phase

### WR-02: both GSD wirings live in a vendored framework directory that a framework update can revert, and nothing executable would notice

The deliverable of `251-04` is the **wiring**, not the script — `D-03` says so in its own words.
Both fenced calls are correctly placed in `.claude/get-shit-done/workflows/` rather than in the
`.claude/commands/gsd/` routers, and both were extracted and run for this review (see
`## Verified clean`). **The placement is right.**

The exposure is that `.claude/get-shit-done/` is a **vendored, git-tracked copy at v1.42.3 with a
SessionStart update checker**, so a future `chore(gsd): apply the pending GSD framework update` can
revert both fences and no gate, hook or CI workflow would fire. `CLAUDE.md` names this risk and
mitigates it with a table of paths *"so they can be RE-APPLIED as a set"* — **a human reading a
table**, which is the mechanism `CLAUDE.md` itself measured to fail for the 214-row hot-file ledger
(*"a table nobody reads end-to-end is not a scan list; it is a hope"*), and which motivated
replacing that table with `check-hot-file-ledger.cjs`.

⚠ The analogous gate does not exist here, and `grep` cannot be it: Phase 251 drove that
counterfactual itself, proving a prose mention still satisfies `grep -rn "check-seeds-register"`
while zero runnable calls remain. The check would have to **extract the fence and run it**.

**Drive evidence, verbatim** — the positive half (the fences are real and run) and the negative half
(nothing executable guards them) were both driven. No file was modified.

```
$ awk 'NR>=284 && NR<=285' .claude/get-shit-done/workflows/discuss-phase.md > <scratch>/fence-discuss.sh
$ cat <scratch>/fence-discuss.sh
node scripts/check-seeds-register.cjs --phase "${PHASE_NUMBER}"
SEEDS_EXIT=$?

$ PHASE_NUMBER=251 bash <scratch>/fence-discuss.sh; echo "EXIT=$?"
trigger sweep — phase 251 (4 plan file(s), 17 path(s) in files_modified)
  2 seed(s) matched:
  [trigger-fires] SEED-177 (status: partially-answered) …
      path ".planning/ROADMAP.md"  matched  ".planning/ROADMAP.md"
  [trigger-fires] SEED-284 (status: planted) …
      path "docs/HOT-FILE-LEDGER.md"  matched  "docs/HOT-FILE-LEDGER.md"
seeds register gate OK — 297/297 parsed, 0 duplicate ids, 297/297 carry all 5 required keys.
EXIT=0

$ awk 'NR>=54 && NR<=55' .claude/get-shit-done/workflows/new-milestone.md > <scratch>/fence-newmilestone.sh
$ bash <scratch>/fence-newmilestone.sh; echo "EXIT=$?"
seeds register gate OK — 297/297 parsed, 0 duplicate ids, 297/297 carry all 5 required keys.
EXIT=0

$ grep -rn "check-seeds-register" .claude/commands/gsd/ ; echo "EXIT=$?"
EXIT=1

$ grep -rln "check-seeds-register" scripts/ .github/ .claude/hooks/ .claude/settings.json
scripts/check-schema-acl-parity.cjs        <- a prose comment (:85)
scripts/check-seeds-register.cjs           <- itself
scripts/migrate-seeds-frontmatter.cjs      <- the importer
.claude/hooks/agent-bus-check.sh           <- a prose comment (:16)

$ ls .github/workflows/
backend-tests.yml  claude-md-size.yml  deploy-artifacts.yml
frontend-tests.yml landing-drift.yml   schema-acl-parity.yml
```

⭐ **Both fences are genuine, executable ` ```bash ` blocks and both ran to exit 0 — the wiring is
real.** And there is **no hook, no CI workflow and no gate** whose failure would follow from their
removal: the four `grep -rln` hits are the two scripts themselves plus two prose comments, and
`.claude/settings.json` contains no `seeds` entry at all.

**Disposition:** next phase

## Info

### IN-01: the `STATUS_ENUM` docstring was falsified by its own phase, two plans later

`check-seeds-register.cjs:348` reads *"`superseded-id` exists for D-05's redirect stubs and today
matches zero files."* True when Plan 01 wrote it; **false from Plan 03 onward** — there are eight
stubs, and `grep -c "status: superseded-id"` names eight files. A comment that is wrong is the class
of defect this phase exists to remove, and this one is inside the gate that removes it.

A one-line comment edit — no behaviour, no schema, no API surface. G-3's `/gsd:fast` shape exactly.

**Disposition:** fast-fix

### IN-02: `251-VERIFICATION.md`'s "independently re-counted as 90" is the figure that is off — the ledger's 91 is correct, and the gap is an instrument mismatch, not rounding

The verification hedges the renumber ledger's product-source count as *"91 (independently
re-counted as 90, within rounding of the ledger's own count/scope)"*. Driven at the phase's own
close commit: the ledger's published recipe returns **91 occurrences across 35 files**, exactly as
the ledger states. `90` is what `git grep -c` returns — **matching LINES, not occurrences** — so the
two numbers are measuring different things and *"within rounding"* mischaracterises a one-line,
two-match file as noise. The ledger needs no correction; the verification's parenthetical does.

```
$ git grep -cE "SEED-(022|092|228|229|231|253|259|269)" de6986fa2 -- backend/ frontend/ scripts/ | awk -F: '{s+=$NF} END {print "lines:", s, "files:", NR}'
lines: 90 files: 35

$ git grep -oE "SEED-(022|092|228|229|231|253|259|269)" de6986fa2 -- backend/ frontend/ scripts/ | wc -l
91
```

⛔ **This is an accept, not a fix.** `251-VERIFICATION.md` is a closed record of what was believed at
the close, and this project's house style is that a correction sits beside its original rather than
over it. The correction is here; editing the verification would be rewriting the transcript. (Plan
`254-04` owns that file's frontmatter and must not touch its body either.)

**Disposition:** accept

### IN-03: the four real body diffs the verification counted were never named — they are recorded here so the next reader does not re-derive them

`251-VERIFICATION.md` publishes `{ exactMatch: 272, lineEndingOnly: 0, realContentDiff: 4,
skipped: 8 }` and describes the four as *"the documented D-06/D-17 live-citation updates
(SEED-022→277, SEED-228→279, SEED-253→282 references) plus the one documented `[id-in-heading]` fix
(SEED-068)"*. That names the **citation pairs**, not the files. The files that actually changed are:

| file | what moved |
|---|---|
| `SEED-040-model-registry-self-service.md` | a `SEED-022` citation → `SEED-277` |
| `SEED-234-the-sheets-gap-is-discoverability-not-capability.md` | two `SEED-228` citations → `SEED-279` |
| `SEED-270-the-fences-assert-presence-and-cannot-see-value-drift.md` | a `SEED-253` citation → `SEED-282` |
| `SEED-068-public-benchmark-scoreboard.md` | the `[id-in-heading]` fix |

⚠ Note that `SEED-022-…`, `SEED-228-…` and `SEED-253-…` are in the **`skipped`** bucket (renamed
away at head), so a reader who took the verification's phrasing as a file list would be looking for
diffs in three files that could not, by construction, be in the diff set. The claim is defensible as
written; the file identities were simply never published. They are now.

⭐ **Nothing needs doing.** This entry exists so the next reader inherits the four filenames instead
of spending a drive re-deriving them — which is the whole point of a `## Verified clean` section,
applied to a figure rather than to a check.

**Disposition:** accept

## Verified clean (recorded so a later reader does not re-derive it)

Everything below was **executed**, not read. Nothing in this section needs a second pass.

| Claim under review | How it was driven | Result |
|---|---|---|
| `--self-test 8/8 arms PASS` | run live | `8/8`, exit 0 |
| arm `1c` (the stub carve-out is a SHAPE) is not vacuous | the shipped `members.length === 2 && stubs.length === 1` reverted to the bare count | **arm 1c went RED alone**, 7/8, exit 1 |
| arm `2b` (`[id-in-heading]`) is not vacuous | the `hid !== entry.id` push short-circuited to `false &&` | **arm 2b went RED alone**, 7/8, exit 1 |
| arm `4` (the counterfactual) is not vacuous | `if (hits.length)` forced to `if (true)` | **arm 4 went RED alone**, 7/8, exit 1 |
| the migration's body invariant is not vacuous | `writeAndVerify` forced to `ok: true` | **arm 5 went RED alone**, 6/7, exit 1 |
| `migrate-seeds-frontmatter.cjs --self-test` | run live | `7/7`, exit 0 |
| **D-11, the body invariant itself** (blob-vs-blob via `git ls-tree` + `git show`, never the working tree) | `08a1cd000^ → cd0d3fa3b`, the migration commit | **`exactMatch 284 / 284`, `lineEndingOnly 0`, `realContentDiff 0`** |
| the verification's own D-11 figure | same instrument, `97bb24e4d → de6986fa2` | **`{272, 0, 4, 8}` — reproduced exactly** |
| `discuss-phase.md` CALLS the sweep | fence extracted by line range and executed with `PHASE_NUMBER=251` | real `` ```bash `` block; 2 `[trigger-fires]`, exit 0 |
| `new-milestone.md` §2.5 CALLS the sweep | fence extracted and executed | register census printed, exit 0 |
| the call is in `workflows/`, not the routers | `grep -rn "check-seeds-register" .claude/commands/gsd/` | **0 hits** — correct placement |
| the `max(id)+1` allocator | snippet extracted from `plant-seed.md` and executed | `MAX=290 NEXT=291 PADDED=291` |
| eight renumbers each have exactly one redirect stub | `ls .planning/seeds \| grep superseded-id` | 8 stubs: `022 092 228 229 231 253 259 269` |
| a stub names BOTH resolutions | `SEED-022-superseded-id.md` read in full | names the KEEPER, the MOVER, the date rule, and a disambiguation rule |
| `age_days` has ONE home | `grep -n` over both consumers | both `source` `scripts/lib/bus-age.sh`; no third inline copy |
| the SessionStart bus hook runs | `bash .claude/hooks/agent-bus-check.sh` | `2 to:operator · 9 to:gemini · 0 to:claude`, exit 0 |
| `--files` per-file mode | run against a real seed | works, and **prints that the count assertion does not apply** |
| `--phase` on an unknown phase | `--phase 999` | `FATAL`, exit 2 — refuses rather than sweeping nothing |
| the sweep reports an absent axis honestly | `--phase 254` | *"the phase declares NO surfaces … reported, never passed off as a clean sweep"* |
| `SEED-286` matches the finding the verification claims for it | frontmatter read | `ChatArea.tsx:570 / 609-624 / 103,404` and `BUS-040` — **the verification is correct** |
| the migration is dry-run by default | `--self-test` arm 1 + the CLI banner | `DRY RUN (nothing is written)` unless `--apply` |
| the migration refuses a write outside the register | `--self-test` arm 7 | containment held |

⚠ **One near-miss is recorded because the instrument, not the code, was wrong.** The first
blob-vs-blob run reported **242 real body diffs** and looked like a large undisclosed D-11
violation. The cause was this reviewer reading `gate.frontmatter(text).end`; `frontmatter()` returns
a **regex match array**, so `.end` is `undefined` and `slice(undefined)` returns the whole file.
Corrected to `m[0].length` — which is exactly what `readRegister()` stores as `fmEnd` — the same
comparison reads `284/284 identical`. **Phase 251's verification records falling into a
structurally identical trap from the other direction** (`core.autocrlf` on a working-tree read,
153/276 false drift). Two different wrong instruments, one correct answer; the method note in
`251-VERIFICATION.md` earned its place.

## What this pass did NOT do

1. **It fixed nothing.** Not one line of Phase 251's code, workflows, hooks or seeds was changed.
   Five defects were PLANTED to drive arms red and every one was restored from a byte-copy taken
   before the edit, each proven by an `md5sum` pair that is identical before and after.
   `git status --short` is empty for `scripts/`, `.claude/` and `.planning/seeds/` — asserted at
   every commit of this plan. This is `D-11`: findings are TRIAGED, never fixed here, because a
   reviewer that fixes what it found stops being an independent verifier of that fix
   (`AGENTS.md` §6.3), and fixing inside a review phase is the G-7 runaway that took Phase 187 from
   15 plans to 29.
2. **It did not re-litigate Phase 251's deliberate boundaries** — `D-06`'s sealed milestone
   references, `D-17`'s 35 product-source files left pointing at stubs, the untouched
   `251-register-integrity/` directory, and `D-18`'s mechanical-only backfill. They are listed
   under `## Boundaries not re-litigated` as decisions, not defects.
3. ⛔ **It is not an independent review, and it flips no register.** See the disclaimer at the top
   of this file. `251-VERIFICATION.md` is byte-unchanged by this plan.

**Also out of scope, named rather than left silent:**

- The register has grown from **293** files at the phase's close to **297** today. Every figure in
  this file is measured at today's tree unless a commit is named beside it; a figure here that
  disagrees with `251-VERIFICATION.md` by a few files is growth, not drift.
- `scripts/agent-bus.sh`'s verb set, the bus queue's contents, and the operator decisions listed in
  `251-BUS-TRIAGE.md` were **not** re-audited. The only bus artifact touched was
  `.claude/hooks/agent-bus-check.sh`, which was run read-only.
- No product source file under `backend/` or `frontend/` was read or run. Phase 251 touched none,
  and neither did this pass.

## Boundaries not re-litigated

These were deliberate decisions of Phase 251 and are **not** reported as defects:

- **D-06** — the 378+ references inside sealed `.planning/milestones/` were not rewritten; the
  redirect stubs are what keep them followable.
- **D-17** — 35 files in `backend/` / `frontend/` / `scripts/` deliberately still point at stubs,
  listed by file in `251-RENUMBER-LEDGER.md`.
- **The `251-register-integrity/` directory is not rewritten** — it is the transcript OF the
  collision.
- **D-18** — the backfill was mechanical only, and the two unswept figures are printed honestly and
  never summed. `134 / 114` today.

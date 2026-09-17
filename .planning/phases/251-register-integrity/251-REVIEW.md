---
phase: 251-register-integrity
reviewed: 2026-09-17
review_type: self-assessed
reviewer: claude (the BUILDER — NOT an AGENTS.md §6.3 independent reviewer)
builder: claude
range: 600e28dde..de6986fa2
status: findings
findings:
  critical: 2
  blocker: 0
  warning: 2
  info: 3
  resolved_in_phase: 0
---

# Phase 251: Register Integrity — standard-depth code-review pass

**Depth:** `standard` · **Scope:** 9 files, re-derived from Phase 251's four `*-PLAN.md`
`files_modified` blocks · **Range:** `600e28dde..de6986fa2` (2026-09-16, both ends)

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

## Info

### IN-01: the `STATUS_ENUM` docstring was falsified by its own phase, two plans later

`check-seeds-register.cjs:348` reads *"`superseded-id` exists for D-05's redirect stubs and today
matches zero files."* True when Plan 01 wrote it; **false from Plan 03 onward** — there are eight
stubs, and `grep -c "status: superseded-id"` names eight files. A comment that is wrong is the class
of defect this phase exists to remove, and this one is inside the gate that removes it.

### IN-02: `251-VERIFICATION.md`'s "independently re-counted as 90" is the figure that is off — the ledger's 91 is correct, and the gap is an instrument mismatch, not rounding

The verification hedges the renumber ledger's product-source count as *"91 (independently
re-counted as 90, within rounding of the ledger's own count/scope)"*. Driven at the phase's own
close commit: the ledger's published recipe returns **91 occurrences across 35 files**, exactly as
the ledger states. `90` is what `git grep -c` returns — **matching LINES, not occurrences** — so the
two numbers are measuring different things and *"within rounding"* mischaracterises a one-line,
two-match file as noise. The ledger needs no correction; the verification's parenthetical does.

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

# Phase 251: Register Integrity — Pattern Map

**Mapped:** 2026-09-16
**Files analyzed:** 14 create/modify targets (one of which is a 283-file bulk rewrite)
**Analogs found:** 13 / 14 with a real in-repo analog · 1 with none (stated plainly in § No Analog Found)

⚠ **This phase touches no product source file.** The analogs here are gate scripts, shell hooks,
register templates and vendored GSD workflow files — not React components or FastAPI routes. Every
excerpt below is quoted verbatim from the working tree at `139c967b6` with `file:line`.

⚠ **Method note carried from RESEARCH §8.11:** every scan below that touched `.planning/`,
`.agent-bus/` or `.claude/` used `--hidden` (or `ls`/`sed`/`grep` directly, which are unaffected).
`rg` without `--hidden` produced a confidently wrong zero during research.

---

## File Classification

| New/Modified file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `scripts/check-seeds-register.cjs` **(CREATE)** | gate script | batch / read-only scan | `scripts/check-verification-honesty.cjs` ⭐ **primary** · `check-hot-file-ledger.cjs` (parser + subject shape) · `check-gap-closure-rounds.cjs` (derivation print + worded hatch) · `check-claude-md-size.cjs` (failure-code vocabulary) | **exact** (four siblings, one uniform shape) |
| `scripts/migrate-seeds-frontmatter.cjs` **(CREATE)** | one-shot migration | file-I/O, bulk transform | ⛔ **no `.cjs` in `scripts/` writes files** — nearest is `scripts/repair_dirty_workflow_phases.py` (dry-run/`--apply`/idempotent/read-back) + `scripts/agent-bus.sh:150-155` (md5 before/after gating a write claim) | **partial — role-match only, different language** |
| `.planning/seeds/TEMPLATE.md` **(CREATE)** | register template | — (document) | `.planning/reported-bugs/TEMPLATE.md` ⭐ **stated model** | **exact** |
| 8 × redirect-stub seed files **(CREATE)** | register entry | — (document) | `.planning/seeds/SEED-224-…md:8-14` (`renumbered_from` / `renumbered_because`) + `SEED-275`/`SEED-276` frontmatter shape | **exact** (the key vocabulary already exists in-register) |
| `.claude/hooks/agent-bus-check.sh` **(MODIFY)** | SessionStart hook | event-driven, read-only | itself (41 lines, quoted in full) + `scripts/agent-bus.sh:37-44` `age_days()` | **exact** |
| `.claude/get-shit-done/workflows/discuss-phase.md` **(MODIFY)** | vendored workflow step | orchestration | `<step name="cross_reference_todos">` at `:264-278` (the sibling register step) + the G-7 gate block at `plan-phase.md:175-201` | **exact** |
| `.claude/get-shit-done/workflows/new-milestone.md` **(MODIFY)** | vendored workflow step | orchestration | `## 2.5. Scan Planted Seeds` at `:49-97` — **the block being REPLACED, not added beside** | **exact** |
| `.claude/get-shit-done/workflows/plant-seed.md` **(MODIFY)** | vendored workflow step | id allocation | `scripts/agent-bus.sh:26-33` `next_id()` ⭐ **a correct `max(id)+1` allocator already in this repo** | **exact** |
| `CLAUDE.md` § Seeds register cross-check **(MODIFY)** | project rule | — (document) | `CLAUDE.md` § Reported bugs cross-check (the 4-touchpoint table, same file) | **exact** |
| ~275 seed files **(MODIFY, frontmatter only)** | register data | bulk transform | `SEED-275` / `SEED-276` / `SEED-231` frontmatter (the best-formed rows in the register) | **exact** |
| `.planning/phases/251-…/251-BUS-TRIAGE.md` or equivalent **(CREATE)** | document | — | `.agent-bus/OPEN.md` header shape; commit `88a9ff861` | **role-match** |
| `.claude/hooks/*-guard.js` **(NOT modified — D-19)** | PostToolUse hook | event-driven | `.claude/hooks/hot-file-ledger-guard.js` (93 lines) | **reference only** — see § 7 |

---

## Pattern Assignments

### 1. `scripts/check-seeds-register.cjs` (gate script, batch read-only scan)

**Primary analog: `scripts/check-verification-honesty.cjs`.** ⭐ **Say so plainly in the plan: where
the four siblings disagree, this one wins.** It is the most recently hardened (2026-09-14, SEED-275),
it is the only one that floors its *subject* set, and its scan set was deliberately converted from
*enumerated* to *derived* — which is D-04's count assertion and D-09's "the sweep can never again be
blind to half its own input" in one file. `check-hot-file-ledger.cjs` is the **cautionary** analog:
copy its frontmatter regex, do **not** copy its subject handling.

#### 1a. Shebang, header contract, usage, exit codes

`scripts/check-verification-honesty.cjs:1-33`
```js
#!/usr/bin/env node
'use strict';
/**
 * check-verification-honesty.cjs — DEBT-03's teeth (Phase 245, D-02).
 *
 * WHY THIS EXISTS
 * ---------------
 * `OV-SOLO-01` (operator, 2026-09-11) rules that solo running continues and that **every phase
 * closed under it must read "self-verified" in its own VERIFICATION.md — never "reviewed"**.
 * That guarantee was carried by memory: 243 and 244 wrote the fact down because those phases
 * happened to remember, and 238, 240 and 241 did not. Nothing checked.
 *
 * ⛔ This project's own repeated finding is that *a fact in a register nobody re-reads is the same
 *    as no fact* …
 *
 * So: the marker is a TOKEN a scan can see, and this is the scan.
 *
 * USAGE
 *   node scripts/check-verification-honesty.cjs                       # the pinned scan set
 *   node scripts/check-verification-honesty.cjs --files a.md b.md     # the hook's call path
 *   node scripts/check-verification-honesty.cjs --review-by "<who reviewed it, and why they did
 *                                                             not shape the build>"
 *
 * EXIT  0 = clear · 1 = violation · 2 = harness error
 *
 * ZERO DEPENDENCIES, and that is a RULE rather than a preference: `fs`, `path` only. ⚠ Measured
 * 2026-09-13 (DEF-245-01): `244-VERIFICATION.md`'s frontmatter does NOT parse as YAML — it has an
 * unquoted value carrying a bare `: ` at line 26 col 505, and it was broken at HEAD, before this
 * gate existed. A YAML-parsing gate would have exited `2` on its first run against a file that
 * carries the marker perfectly. The refused dependency is why this gate can read that file at all.
 */
```

⛔ **The zero-dependency paragraph is not decoration — copy it, with this phase's own second reason
beside it** (RESEARCH §2.4: a real YAML parser silently discards the `#`-comment prose on 21 seeds
that D-10 requires be preserved). `path.matchesGlob` is a Node built-in and satisfies the rule
absolutely (RESEARCH §4.6, Node v24.19.0).

The one-line variant, for comparison — `scripts/check-hot-file-ledger.cjs:32`:
```js
 * EXIT  0 = clear · 1 = missing rows (G-5 fires) · 2 = harness error
```

#### 1b. Requires, root resolution, `fail()`, colour constants

`scripts/check-verification-honesty.cjs:178-183, 227-235`
```js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const STATE = path.join(root, '.planning', 'STATE.md');
const ACTIVE_DIR = path.join(root, '.planning', 'phases');
…
const RED = '\x1b[31m';
const YEL = '\x1b[33m';
const GRN = '\x1b[32m';
const RST = '\x1b[0m';

function fail(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(2);
}
```

Identical in `check-hot-file-ledger.cjs:38-41, 69-72`; `check-gap-closure-rounds.cjs:79-82` spells it
`fatal()` — ⭐ **use `fail`**, it is the majority and the newest.

#### 1c. ⭐ `MIN_SUBJECT_FILES` — the pattern D-04's count assertion copies, VERBATIM

`scripts/check-verification-honesty.cjs:219-225`
```js
/**
 * Floor on the DERIVED set. A gate that passes over nothing is worse than absent —
 * `check-hot-file-ledger.cjs` was measured exiting 0 over `subject: 0 files` at Phase 242.
 * Nine files resolved when this floor was written (238-246); 6 leaves room for archival
 * reorganisation without leaving room for the set silently collapsing.
 */
const MIN_SUBJECT_FILES = 6;
```

…and the two-mode application — `scripts/check-verification-honesty.cjs:418-440`
```js
  let subject;
  let label;
  const filesIdx = argv.indexOf('--files');
  if (filesIdx !== -1) {
    const given = argv.slice(filesIdx + 1).filter((a) => !a.startsWith('--'));
    if (!given.length) {
      fail('--files was given ZERO arguments. A gate that passes over nothing is worse than absent: '
        + 'check-hot-file-ledger.cjs was measured exiting 0 over `subject: 0 files` at Phase 242.');
    }
    subject = given.map(toRepoRel);
    label = `${subject.length} path(s) from the command line`;
  } else {
    subject = discoverSubjects();
    if (subject.length < MIN_SUBJECT_FILES) {
      fail(`the derived scan set resolved only ${subject.length} file(s) (floor ${MIN_SUBJECT_FILES}) `
        + `— refusing to pass over a set this small. A gate that passes over nothing is worse than `
        + `absent. Likely causes: .planning/milestones/*-phases/ was renamed or moved, or a phase `
        + `directory stopped matching NNN-name. Found:\n`
        + (subject.length ? subject.map((p) => `    ${p}`).join('\n') : '    (nothing)'));
    }
    label = `derived scan set — phases >= ${DEBT_FLOOR_PHASE}, live + archived, `
      + `VERIFICATION.md and VERDICT.md`;
  }
```

⚠ **What D-04 asks for is STRICTLY STRONGER than this floor, and the plan must say so:** the seeds
register has a *knowable exact size*, so the assertion is equality, not a floor. Derive it the way
RESEARCH §4.4 spells out and compare:
```js
fs.readdirSync(SEEDS_DIR).filter((f) => /^SEED-\d{3}-.*\.md$/.test(f)).length
```
⛔ **Keep the `--files` carve-out anyway.** The floor/equality must apply to **scan mode only** — one
file is a legitimate resolution in a per-file mode, and an equality check there would make every
single-file invocation a harness error.

**The cautionary half — `scripts/check-hot-file-ledger.cjs:105-109`, quoted so the plan can name what
it is NOT copying:**
```js
    const text = fs.readFileSync(path.join(dir, p), 'utf8').replace(/\r\n/g, '\n');
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (!fm) continue;                       // ← silent skip, no counter
    const block = /files_modified:\s*\n((?:\s*-\s*.+\n)+)/.exec(fm[1] + '\n');
    if (!block) continue;                    // ← silent skip, no counter
```
⛔ **Two `continue`s with no counter.** This is exactly how the gate printed `subject: 0 files ·
ledger gate OK` at Phase 242. **Every skip in `check-seeds-register.cjs` must increment a counter and
that counter must be printed** — 283 files in, 283 accounted for, or the run is a harness error.

#### 1d. The hand-rolled frontmatter parser — the piece to copy, with two mandatory amendments

Three implementations exist and they differ. ⭐ **`check-gap-closure-rounds.cjs:91-95` is the better
model** — it is the only one whose regex is already CRLF-tolerant (`\r?\n`) rather than normalising
the whole file first, which matters here because D-11 forbids normalisation:

`scripts/check-gap-closure-rounds.cjs:90-117`
```js
/** Frontmatter only — the first `---` block. Never the body, which quotes fields in prose. */
function frontmatter(file) {
  const text = fs.readFileSync(file, "utf8")
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return m ? m[1] : ""
}

function scalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.+)$`, "m"))
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null
}

/** A top-level YAML list: `files_modified:` followed by `  - path` lines. */
function list(fm, key) {
  const lines = fm.split(/\r?\n/)
  const start = lines.findIndex((l) => new RegExp(`^${key}:[ \\t]*$`).test(l))
  if (start < 0) return []
  const out = []
  for (let i = start + 1; i < lines.length; i++) {
    const item = lines[i].match(/^[ \t]+-[ \t]+(.+)$/)
    if (item) {
      out.push(item[1].trim().replace(/^["']|["']$/g, ""))
      continue
    }
    if (/^\S/.test(lines[i])) break
  }
  return out
}
```

The sibling for comparison — `scripts/check-verification-honesty.cjs:292-297`:
```js
/** The `---` fenced block starting at line 1, CRLF-normalised. `null` when there is none. */
function frontmatter(text) {
  const t = text.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---(\n|$)/.exec(t);
  return m ? m[1] : null;
}
```
⭐ **Note the `(\n|$)` tail and the `null`-vs-`""` return.** `null` is better here — the gate must
distinguish *"no frontmatter block"* (`[no-frontmatter]`, the 5 seeds at RESEARCH §1.10) from
*"empty frontmatter"*, and `""` collapses them.

**Two amendments this phase must make, neither of which exists in any sibling:**

1. ⛔ **`trigger_when` is a folded scalar or a YAML list on 112 of 157 files (RESEARCH §3.1).**
   `scalar()` above returns `null` for every one of them. The continuation reader is NEW code —
   `list()` is the closest starting point (it already walks continuation lines and stops at the next
   top-level key with `if (/^\S/.test(lines[i])) break`). **Build it first and assert it reads 157,
   before anything else is written** (RESEARCH §8.1).
2. ⛔ **Non-greedy, always.** 102 bare `---` lines live inside seed BODIES (RESEARCH §7.1). All three
   quoted regexes are already non-greedy (`[\s\S]*?`) — **do not "simplify" to a `split('---')`**,
   which destroys body content on ~40% of the register.

**Comment stripping — needed here for the same reason it was needed there.** 21 of the 26
prose-carrying `status:` lines put their prose after a `#` (RESEARCH §2.4), and D-10 requires that
prose be preserved in `status_note`, not discarded:

`scripts/check-verification-honesty.cjs:271-290`
```js
/**
 * Cut a frontmatter line at the first `#` that is NOT inside a quoted string, and return the part
 * to the LEFT. Quote-aware on purpose: `score: "4.5 / 5 — SC#2, SC#3"` legitimately carries `#`
 * inside a quoted value, and cutting there would truncate a value the predicate should see whole.
 * ⛔ This is a split, not a YAML parser — see the zero-dependency note in the header.
 */
function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") {
      q = ch;
    } else if (ch === '#') {
      return line.slice(0, i);
    }
  }
  return line;
}
```
⚠ **Use it to FIND the note, not to throw it away.** Here the right-hand side is the deliverable
(`status_note`), which is the opposite of how the analog uses it.

#### 1e. argv handling, usage line, and the worded escape hatch

`scripts/check-gap-closure-rounds.cjs:132-141`
```js
const argv = process.argv.slice(2)
const phaseArg = argv.find((a) => !a.startsWith("--"))
if (!phaseArg) fatal("usage: node scripts/check-gap-closure-rounds.cjs <phase> [--unmet-criterion \"…\"] [--capability-approved \"…\"]")

function flagValue(name) {
  const i = argv.indexOf(`--${name}`)
  if (i >= 0) return (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "").trim()
  const inline = argv.find((a) => a.startsWith(`--${name}=`))
  return inline ? inline.slice(`--${name}=`.length).replace(/^["']|["']$/g, "").trim() : null
}
```

The stricter sibling — `scripts/check-verification-honesty.cjs:310-317`:
```js
function flagValue(name) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) fail(`--${name} takes a STRING reason, never a bare flag`);
  return v;
}
```
⭐ **Prefer this second one** — it refuses a bare flag with an explicit `fail`, which is what makes
"worded, never boolean" mechanical rather than aspirational. The gap-closure version silently
degrades `--unmet-criterion` with no value into `""`.

**And the header paragraph that explains WHY the hatch takes a reason —
`scripts/check-gap-closure-rounds.cjs:47-51`:**
```
 * The two escape hatches are deliberately WORDED, not boolean. A flag that
 * takes a reason makes the override land in the shell history and in whatever
 * transcript records the command, which is what "never silently skipped" means
 * in CLAUDE.md's guardrail protocol. Record it under
 * STATE.md -> Guardrail overrides as well.
```

#### 1f. ⭐ Printing the DERIVATION — the real console shape, not a paraphrase

`scripts/check-gap-closure-rounds.cjs:174-201` — the fullest example in the repo:
```js
console.log(`\nG-7 gap-closure round cap — ${phaseDirName}`)
console.log(`  plans: ${plans.length} total · ${gapPlans.length} gap-closure\n`)
…
console.log("  rounds derived from:")
console.log(`    highest explicit gap_closure_round : ${explicitMax || "— (field absent on every gap plan)"}`)
console.log(`    distinct commits adding gap plans  : ${addCommits.size}`)
for (const [commit, ids] of addCommits) console.log(`      ${commit}  ${ids.join(", ")}`)
console.log(`    => rounds completed: ${roundsCompleted} (cap is ${ROUND_CAP})\n`)
```

The one-line form — `scripts/check-hot-file-ledger.cjs:159-160`:
```js
  console.log(`hot-file ledger — ${label}`);
  console.log(`  scan list: ${known.size} rows · subject: ${subject.size} files · watched: ${watched.length}`);
```

And the per-subject form — `scripts/check-verification-honesty.cjs:466-482`:
```js
    console.log(`  ${rel}`);
    console.log(
      `      frontmatter=${r.fm ? 'yes' : 'NO '}  verification_mode=`
        + `${r.mode === null ? RED + 'ABSENT' + RST : JSON.stringify(r.mode)}`
        + `  findings=${r.findings.length}`
    );
  …
  const parts = [`${archivedCount} archived + ${liveCount} live`];
  if (outsideCount) parts.push(`${outsideCount} outside boundary — skipped`);
  console.log(`subject: ${archivedCount + liveCount} files (${parts.join(' + ')})`);
```

⭐ **D-18's two-number requirement maps directly onto the `  scan list: … · subject: … · watched: …`
line.** Write it as its own line so neither figure can hide behind the other, e.g.:
```
  register: 283 files · parsed: 283 · duplicate ids: 0
  unswept:  N carry no trigger_when at all · M carry prose but no structured trigger
```
⛔ **`N` and `M` are separate fields on the same line — never summed.** D-18: *"a gate reporting 126
while 238 are unswept is the comfortable lie REG-02 exists to end."*

#### 1g. The `[bracketed-failure-code]` emission — exact string formats

Two shapes exist. **Both are correct; pick by whether the finding has a per-file detail line.**

`scripts/check-hot-file-ledger.cjs:167-170` — code inline with the subject:
```js
  console.log(`\nG-5 CANNOT FIRE ON ${missing.length} FILE(S) — they have no ledger row:`);
  for (const f of missing) {
    console.log(`  [no-row] ${f}   (named by ${subject.get(f).join(', ')})`);
  }
```

`scripts/check-verification-honesty.cjs:524-530` — code + indented reason (⭐ **prefer this one**;
D-04/D-09/D-10 each need a *why* beside the *what*):
```js
  console.log(`\n${RED}HONESTY GATE FAILS${RST} — ${total} finding(s) across ${violations.length} file(s):`);
  for (const r of violations) {
    for (const [code, why] of r.findings) {
      console.log(`  [${code}] ${r.rel}`);
      console.log(`      ${why}`);
    }
  }
```
…with findings accumulated as `[code, why]` tuples — `scripts/check-verification-honesty.cjs:364-390`:
```js
  if (fm === null) {
    return {
      rel,
      fm: false,
      mode: null,
      findings: [['no-frontmatter', 'no `---` fenced block starts at line 1, so no scan can read a verdict claim here']],
    };
  }
  …
  if (mode === null) {
    findings.push([
      'no-verification-mode',
      'the frontmatter carries no `verification_mode` key — a self-verification here is invisible to every scan',
    ]);
  }
```

`scripts/check-claude-md-size.cjs:267-281` — the printf form, for structural (line-numbered) findings:
```js
    console.log('\nHOT-FILE LEDGER — %d structural problem(s) in %s', n, s.rel);
      console.log('  [disposition-too-long] line %d  %d chars (cap %d)  %s', …);
      console.log('  [duplicate-row] lines %s  %s — one file, one row; merge them', …);
      console.log('  [malformed-row] line %d  %d cells, expected 6  %s', m.line, m.cells, m.path);
```

**The existing code vocabulary, from `check-verification-honesty.cjs:104-107` and
`check-claude-md-size.cjs:269-277`:**
```
[no-frontmatter] · [no-verification-mode] · [frontmatter-claims-review]
[round-cap] · [new-capability-in-closure] · [stale-pin] · [no-row]
[malformed-row] · [duplicate-row] · [disposition-too-long]
```
⭐ **Reuse `[no-frontmatter]` VERBATIM for the 5 seeds with no block at all** (`SEED-084`, `163`,
`164`, `165`, `166`) — do not mint a synonym. New codes for this phase: **`[duplicate-id]`**,
**`[missing-key]`**, **`[unknown-status]`**. The existing `[duplicate-row]` is the naming precedent
for `[duplicate-id]`.

#### 1h. Green verdict vs `passed WITH OVERRIDES` — printed differently, on purpose

`scripts/check-gap-closure-rounds.cjs:261-278` — the fullest treatment, with the reason comment:
```js
// The closing line must not launder an override into a clean bill of health — a summary
// that says "nothing was found" when something was found and waved through is the same
// defect class as a comment that lies about its code (D-ITEM-183-02).
const overrides = []
if (roundsCompleted >= ROUND_CAP && unmetCriterion) overrides.push("[round-cap]")
if (newCapabilities.length > 0 && capabilityApproved) overrides.push("[new-capability-in-closure]")

if (overrides.length > 0) {
  console.log(
    `${YEL}G-7 passed WITH OVERRIDES${RST} — ${overrides.join(" + ")} waved through by an explicit reason, not by absence of a finding.\n` +
      `  Record each under STATE.md -> Guardrail overrides.\n`,
  )
} else {
  console.log(
    `${GRN}G-7 clear${RST} — ${roundsCompleted} round(s) completed, no new capability built inside a closure round.\n`,
  )
}
process.exit(0)
```

`scripts/check-verification-honesty.cjs:503-521` — same contract, plus the **N/A** arm that this phase
should copy if the sweep can ever legitimately check nothing:
```js
  if (!violations.length) {
    // ⚠ `0/0 OK` is the exact shape of the vacuous pass this project has already been bitten by
    //   (check-hot-file-ledger.cjs printing `subject: 0 files · ledger gate OK` over a CRLF plan it
    //   could not read). Here it is CORRECT — the boundary genuinely excludes those paths — but it
    //   must SAY so rather than read as a pass over something.
    if (!results.length && outsideCount) {
      console.log(
        `${YEL}honesty gate N/A${RST} — all ${outsideCount} given path(s) are OUTSIDE the boundary; `
          + `nothing was checked. This is not a pass.`
      );
      return 0;
    }
    const verdict = reviewBy
      ? `${YEL}honesty gate passed WITH OVERRIDES${RST} — --review-by waved the claims-review arm `
        + `through by an explicit reason, not by absence of a finding.`
      : `${GRN}honesty gate OK${RST} — ${withMode}/${results.length} subject files carry `
        + `verification_mode, 0 frontmatter review claims.`;
    console.log(verdict);
    return 0;
  }
```
⭐ **Note the green line states WHAT IS TRUE with a ratio (`${withMode}/${results.length}`), never a
bare "OK".** Copy that: `seeds register gate OK — 283/283 parsed, 0 duplicate ids, 283 carry all 5
required keys.`

#### 1i. The remedy block — failure output ends with the exact commands to fix it

`scripts/check-hot-file-ledger.cjs:171-184`
```js
  console.log(`
⛔ A missing row does NOT mean the guardrail is weak on that file — it means G-5 is ABSENT there,
   at any commit count, forever, silently. App.tsx went 23 phases like this.

   Add a row to docs/HOT-FILE-LEDGER.md § "Scan list", re-deriving the triple rather than guessing:

     git log --oneline -- <file> | wc -l                                     # commits
     …
   …and add that file's own section in the SAME COMMIT (same-commit sync rule). Disposition cell
   is capped at 200 chars — verdict in the cell, reasons in the section.`);
  return 1;
```

`scripts/check-verification-honesty.cjs:531-547` — same shape, ending with the escape-hatch command
and an explicit **do-not-satisfy-this-by-editing-prose** clause:
```js
  console.log(`
⛔ A VERIFICATION.md without \`verification_mode\` is not "slightly under-documented" — it is a
   self-verification that a future reader, and every scan, will take for a review. …

     verification_mode: self-verified   # ⛔ OV-SOLO-01 — NEVER "reviewed". …

   If an INDEPENDENT reviewer genuinely looked at it …:

     node scripts/check-verification-honesty.cjs --review-by "<who, and why they did not shape it>"

   ⛔ Do NOT satisfy this gate by editing body prose. Every honest sentence naming an owed review
      must stay — deleting them destroys the record the marker exists to index (D-01).`);
  return 1;
```
⭐ **The final clause is the one to imitate for `[unknown-status]`:** *do not satisfy this gate by
deleting the prose — move it to `status_note`.* Without that sentence the cheapest way to green the
gate is to destroy exactly what D-10 exists to preserve.

#### 1j. Entry point

`scripts/check-hot-file-ledger.cjs:187-191` (identical at `check-verification-honesty.cjs:550-554`):
```js
try {
  process.exit(main());
} catch (e) {
  fail(e && e.stack ? e.stack : String(e));
}
```
⚠ `check-gap-closure-rounds.cjs` is **top-level script style** (no `main()`, bare `process.exit(0)` at
`:278`). ⭐ **Use the `main()` + try/catch form** — it is the majority, it is what both hooks invoke,
and an uncaught throw becomes exit `2` rather than Node's default `1` (which would read as a
legitimate violation).

#### 1k. Glob matching for `trigger_paths` (D-01)

Settled locally at RESEARCH §4.6 — `path.matchesGlob` is a Node built-in on v24.19.0, zero deps.
**The normalisation the comparison needs already exists in two siblings:**

`scripts/check-hot-file-ledger.cjs:113` — `files_modified` side:
```js
      const f = m[1].replace(/^["']|["']$/g, '').split(path.sep).join('/');
```
`scripts/check-verification-honesty.cjs:237-245`:
```js
function norm(p) {
  return String(p).split(path.sep).join('/').replace(/^\.\//, '');
}

/** Repo-relative, `/`-separated, for an argument that may be absolute or relative to cwd. */
function toRepoRel(arg) {
  const abs = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg);
  return norm(path.relative(root, abs));
}
```
⛔ **Normalise BOTH sides.** On Windows the pattern read out of a seed and the path read out of a
PLAN.md can differ only in separator, and a silent non-match is D-04 arm 3 failing invisibly.

---

### 2. `scripts/migrate-seeds-frontmatter.cjs` (one-shot migration, bulk file-I/O)

#### 2a. ⛔ State plainly what has no analog

**There is no in-repo precedent for a bulk-edit script that proves a no-touch invariant by hash**
(RESEARCH §7.3 — confirmed independently here). Two sharper facts the planner should carry:

- ⛔ **No `.cjs` in `scripts/` writes a file at all.** Measured: `grep -ln "writeFileSync"
  scripts/*.cjs` → **zero matches**. Every `check-*.cjs` is read-only by construction, and the
  `check-` prefix means exactly that. **`migrate-seeds-frontmatter.cjs` would be the first
  file-writing `.cjs` in `scripts/`** — which is itself the reason RESEARCH §7.4 is right that it
  must NOT be named `check-*`.
- The house's file-writing one-shots are **Python**: `apply_migration_072/073/074/075/178.py`,
  `repair_dirty_workflow_phases.py`, `seed-constructor-slug-workflow.py`. They are committed and
  kept, named for what they did.

#### 2b. ⭐ The bulk-mutation posture to copy — `scripts/repair_dirty_workflow_phases.py:1-28`

Different language, different substrate (Postgres, not files), **same contract** — and it is the only
script in the repo that states that contract explicitly:
```python
"""One-off idempotent repair of the 3 dirty workflow_phases rows (Plan 101.1-10 Task 1).

WHY: …

This script flips exactly those stuck `active` fill rows to 'failed'. It is:
  - SCOPED to exactly the 3 named run_ids (resolved by prefix from workflow_runs).
  - GATED on the predicate `wp.status='active' AND parent wr.status='failed'` — it will
    NEVER touch a gather/completed row, a non-failed run, or any other run's rows.
  - DRY-RUN by default: prints the rows it WOULD change. Requires an explicit `--apply`
    flag to mutate (refuses without it — the seed-fixture safety convention).
  - IDEMPOTENT: a second --apply run finds 0 rows to change (already 'failed') and exits 0.
  - read-back asserted: after --apply, no 'active' fill row remains for those runs.

Usage:
    python scripts/repair_dirty_workflow_phases.py            # dry-run preview
    python scripts/repair_dirty_workflow_phases.py --apply    # mutate (idempotent)
"""
```
and its main — `scripts/repair_dirty_workflow_phases.py:87-149` (abridged to the load-bearing lines):
```python
def main():
    apply = "--apply" in sys.argv[1:]
    conn.autocommit = False  # explicit commit only after the read-back assertion passes
        print(f"\n=== {len(dirty)} stuck-active fill row(s) to repair (active -> failed) ===")
        if not apply:
            print("\nDRY-RUN (no changes made). Re-run with --apply to flip the row(s) above "…)
        changed = cur.rowcount
        print(f"\n--apply: UPDATEd {changed} row(s) active -> failed.")
        # Read-back assertion (within the same uncommitted txn): no active fill row remains.
        print("Read-back assertion passed: 0 'active' fill rows remain for the 3 failed runs. "…)
```
⭐ **Five properties to carry over verbatim into the plan's acceptance criteria:** dry-run default ·
explicit `--apply` · scoped predicate · **idempotent (a second run reports `0 files changed`)** ·
**read-back assertion before the commit.** RESEARCH §7.4 already recommends the idempotency
re-run as a post-condition; this is where the shape comes from.

#### 2c. ⭐ The hash mechanism DOES have an in-repo precedent — `scripts/agent-bus.sh:150-155`

⚠ **This corrects RESEARCH §7.3's table, which listed `agent-bus.sh` in its grep output but not in
its precedent table.** It is the *inverse* direction of D-11 (it proves a write DID happen, where
D-11 proves a body did NOT change), but the mechanism — md5 before, md5 after, refuse on the wrong
answer — is exactly the one D-11 needs:
```bash
  local before after
  before=$(md5sum < "$BUS")
  sed -i.bak -E "s/^### \[(OPEN|ANSWERED)\] $id /### [CLOSED] $id /" "$BUS" && rm -f "$BUS.bak"
  after=$(md5sum < "$BUS")
  [ "$before" != "$after" ] || die "$id was NOT closed — it is already [CLOSED], or its header is malformed. Nothing was written."
  echo "closed $id"
```
…with the comment four lines above it, `scripts/agent-bus.sh:145-147`, that is the whole argument:
```bash
  # ⭐ `cmd_answer` directly above carries the comment this function ignored — *"A verb that
  # writes a false record is the defect this project keeps paying for, so the success line
  # is gated on the write, not on reach."* Same file, four lines apart.
```
⭐ **`gate the success line on the write, not on reach` is the sentence the migration's report must
obey**: `N files changed` is only printable if N writes actually landed and N body hashes matched.

#### 2d. ⛔ The raw-Buffer requirement — and why `git diff` cannot verify D-11

No analog exists; this is new code. The contract, restated from RESEARCH §7.2 with the measurements
that force it:

- **159 of 283 seeds contain CR** (153 pure CRLF, **6 mixed**); `core.autocrlf=true`; **no
  `.gitattributes`**. Git stores LF, the working tree carries CRLF.
- ⛔ **A normalising rewrite therefore produces NO `git diff` for 153 files while changing every line
  in the working tree.** `git diff` is not a valid verification of D-11.
- ⛔ **Hashing normalised text defeats the invariant** — "a body that moved by one byte fails the run"
  cannot be true if bytes are normalised before hashing.
- ⭐ **Correct shape:** `fs.readFileSync(p)` as a **Buffer** · locate the two `---` delimiter lines by
  byte scan tolerating `\r\n` and `\n` · slice the body as a **Buffer** ·
  `crypto.createHash('md5').update(bodyBuf).digest('hex')` before and after · write
  `newFrontmatterBuf + bodyBuf`, the body Buffer **passed through untouched, never re-serialised**.
- ⚠ The 6 mixed files to name in the plan: `SEED-013`, `SEED-144`, `SEED-145`, `SEED-171`,
  `SEED-193`, `SEED-194`.
- ⚠ The 5 no-frontmatter files need a **different code path** (prepend a block; body md5 = md5 of the
  entire current file): `SEED-084`, `SEED-163`, `SEED-164`, `SEED-165`, `SEED-166`.

⚠ `crypto` is a Node built-in, so the zero-dependency rule (§1a) still holds.

---

### 3. `.planning/seeds/TEMPLATE.md` (register template — CREATE)

⛔ **It does not exist.** `ls .planning/seeds/ | grep -i templ` → no output. ⭐ **Stated model:
`.planning/reported-bugs/TEMPLATE.md`** — *"copy the shape rather than inventing one"* (CONTEXT
`<code_context>`). Quoted in full, because it is short and every structural choice matters:

`.planning/reported-bugs/TEMPLATE.md:1-54`
```markdown
---
id: BUG-YYYYMMDD-NN              # date + sequence (e.g., BUG-260512-01)
title: One-line summary
reported: YYYY-MM-DD              # absolute date — never relative
surface: Agentic-RAG              # Agentic-RAG | Claude.ai | Anthropic-API | OpenAI | OpenRouter | Other
severity: minor                   # blocking | major | minor | info
status: open                      # open | folded | deferred | external-noted | closed
affected_areas: []                # e.g., [frontend/streaming, backend/ingestion, RAG/multimodal, skills, sandbox]
folded_into: null                 # phase number when folded (e.g., "068") — set when status flips to folded
verified_closed_by: null          # phase number (e.g., "075.6") that verified the bug no longer reproduces — set alongside status=closed
related_seeds: []                 # SEED-NNN ids if this bug correlates with a planted seed
re_open_trigger: null             # required when status=deferred — concrete condition that re-surfaces it
reproduces_on:                    # commit/version where the bug was observed
  branch:
  commit:
  date:
---

# [BUG-ID]: [Title]

## What we observed

[Repro steps, expected vs actual, screenshots/network/log evidence. Stay factual — interpretation goes below.]

## Why it matters

[Severity rationale. Who notices it, what's broken from the user's perspective, what downstream effects.]

## Hypothesized cause

[Best guess at root cause. Mark as hypothesis, not finding, until verified.]

## Surface classification

> **Why this matters for routing:**
> - `Agentic-RAG` → this app; cross-checked at `/gsd:discuss-phase`, `/gsd:new-milestone`, `/gsd:complete-milestone`.
> - External (`Claude.ai`, `Anthropic-API`, etc.) → observability/feedback notes; surfaced to user only, NOT folded into app phases.

[State which surface this is and why.]

## Suggested routing

- **Fold into in-flight phase:** [phase number if relevant, else "n/a"]
- **Defer to future phase / milestone:** [target if relevant, else "n/a"]
- **Plant as seed:** [SEED-NNN candidate if this is a cross-milestone concern]
- **External — note only:** [yes/no]

## Workarounds (prompt-side, code-side, or UI-side)

[Anything the user can do today to dodge this until it's properly fixed.]

## Reference / evidence links

- [Links to commits, network requests, screenshots, related issues]
```

**Three structural conventions to carry, and they are the reason this file is the model:**
1. **The enum lives in a trailing `#` comment on the key's own line** (`status: open  # open | folded
   | deferred | external-noted | closed`). That is where D-10's 10-value enum and D-16's `partial:`
   boolean belong — visible to the author at the moment of writing, which is the thing the seeds
   register has never had.
2. **A key whose value is conditional says so in its comment** (`re_open_trigger: null  # required
   when status=deferred`). D-16's `partial:` and D-10's `status_note:` take the same treatment.
3. **Body headings are prompts in square brackets**, not prose — so a half-filled template is
   visibly half-filled.

#### Key-by-key mapping onto D-09 / D-10 / D-16

| `reported-bugs/TEMPLATE.md` key | seeds equivalent | Source of truth |
|---|---|---|
| `id: BUG-YYYYMMDD-NN` | **`seed_id: SEED-NNN`** | D-09 (⚠ derive from the FILENAME) |
| `title: One-line summary` | **`title:`** | D-09 (derive from the H1) |
| `reported: YYYY-MM-DD` | `created:` **else** `planted:` | **D-20** — the fallback is mandatory; `created` is present in only 99 of 283 |
| `surface: Agentic-RAG  # …` | **`surface: Agentic-RAG`** | D-09; default is provably safe (RESEARCH §1.4 — only two values exist, both begin `Agentic-RAG`) |
| `status: open  # open \| folded \| …` | **`status:`** + the 10-value enum in the comment | D-10 / D-16 |
| *(no equivalent)* | **`partial: false  # true when the status is settled on one axis only`** | **D-16** — NEW key, no precedent in either register |
| *(no equivalent)* | **`status_note:`** | D-10 — ⭐ **precedent EXISTS in-register**, see below |
| `re_open_trigger: null  # required when …` | **`trigger_when:`** (prose, human) | D-09 · ⚠ `re_open_trigger:` also already exists in seeds (`SEED-231:26`) — **do not create a synonym; say which is which** |
| *(no equivalent)* | **`trigger_paths: []`** (globs, `path.matchesGlob`) | D-01 / D-18 — the LOAD-BEARING field |
| *(no equivalent)* | **`trigger_surfaces: []`** (small controlled enum) | D-18 — ⛔ NOT free extraction |
| `affected_areas: []` | `relates_to:` / `affected_areas:` | already in-register, 144 files |
| `folded_into: null` | `folded_into:` | same semantics |
| *(D-05 stubs only)* | **`renumbered_from:` / `renumbered_because:`** | ⭐ already in-register — see §4 |

⛔ **`trigger_phase_touches` is NOT in this table, by D-18.** Do not put it in the template.

#### Body-shape exemplars — the three best-formed seeds in the register

**(a) `SEED-275` — `seed_id` + `created` + a folded multi-arm `trigger_when`.** The closest thing to
a correct seed that exists today. `.planning/seeds/SEED-275-the-honesty-gate-reads-green-over-a-hardcoded-three.md:1-30`
```yaml
---
seed_id: SEED-275
title: The verification-honesty gate reads GREEN over a hardcoded three-path scan set while 20 VERIFICATION.md files exist — and the phase whose whole job was verification debt produced no VERIFICATION.md at all
created: 2026-09-14
planted_during: v4.2 / DEBT-06 groundwork, while measuring which phases actually owe an independent review
status: closed   # ⭐ ANSWERED SAME DAY (2026-09-14) by operator ruling: "fix the gate, VERDICT.md counts as equivalent". …
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-274 — the backend ceiling pinned to an integer over a value that moves. ⚠ SAME FAMILY,
    DIFFERENT AXIS: 274 is a gate whose THRESHOLD is wrong; this is a gate whose SCAN SET is wrong. …
relates_to_registers:
  - "scripts/check-verification-honesty.cjs — `const PINNED = [...]`, three literal paths, plus
    `MIN_PINNED_FILES = 3`."
trigger_when: >
  ANY of: (1) DEBT-06 is worked — this seed is its precondition, because the debt cannot be counted
  before the scan set is right; (2) a new phase closes and someone asks whether its verification is
  visible to any scan; (3) `check-verification-honesty.cjs` is edited for any reason; (4) a
  milestone is archived — archiving is precisely what removes a phase from the "active milestone"
  half of the subject set and drops it out of the gate.
---
```
⚠ **This file is ALSO a live example of the D-10 defect**: line 6's `status: closed   # ⭐ ANSWERED
SAME DAY…` carries ~380 characters of prose after the value. Under D-10 the token stays and
everything after it moves byte-for-byte into `status_note:`. **Use this exact file as the worked
example in the plan** — it is the `#`-comment class (21 of the 26 prose-carrying lines), and a real
YAML parser would have silently thrown it away.

**(b) `SEED-276` — the same shape, clean `status: planted`.**
`.planning/seeds/SEED-276-localhost-resolves-ipv6-first-while-uvicorn-binds-ipv4-only.md:1-20`
```yaml
---
seed_id: SEED-276
title: Every local Python script pays ~2 s per call because `localhost` resolves `::1` first while uvicorn binds IPv4 only — …
created: 2026-09-14
planted_during: BUS-171 triage of BUS-040 — found as an ORPHAN, named in a handover 14 days ago and held by no register
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - SEED-275 — a gate blind because of its SCAN SET. ⚠ SAME FAMILY, LOWER LAYER: …
relates_to_registers:
  - "memory reference_vite_binds_ipv6_only — the FRONTEND half of the same asymmetry, already
    recorded: probe `localhost`, never `127.0.0.1`. …"
trigger_when: >
  ANY of: (1) a local drive script, UAT harness or probe is written against the backend — this seed
  decides whether it uses `127.0.0.1` or `localhost`; (2) anyone reports local scripts being "slow"
  without a profiler; (3) a timing-sensitive or race-shaped bug is investigated with a Python client
```

**(c) ⭐ `SEED-231` — the ONE existing `status_note:` in the register. Reuse the key, do not invent
one.** `.planning/seeds/SEED-231-nobody-is-told-an-approval-is-waiting.md:1-35` (abridged)
```yaml
---
id: SEED-231
title: Nobody is told an approval is waiting — …
status: planted
planted: 2026-08-29
surface: Agentic-RAG
…
re_open_trigger: >
  Immediately for the DOCUMENTATION half (this file). For the BUILD: the first milestone that
  schedules anything customer-facing, or the second recorded instance of a pause nobody saw.
status_note: >
  ⚠ STILL `planted`, DELIBERATELY. Phase 235 shipped the SURFACE this seed needs and registered
  exactly ONE producer (a broken source) — nothing about this seed's own notification need shipped,
  so flipping to `folded` or `closed` would be a lie the register would then carry forever. …
last_reviewed: 2026-09-06
reviewed_at_phase: 235 (plan 235-12, the phase close)
```
⚠ **Note `id:` here vs `seed_id:` in 275/276.** Both spellings are live (177 `seed_id`, 101 `id`).
D-09 names `seed_id` — the migration must normalise, and the plan must say which direction and what
happens to the loser.

---

### 4. The 8 redirect stubs (D-05 / D-17)

**Analog: `SEED-224`, the one prior renumber done well.** ⭐ **The key vocabulary already exists —
adopt it verbatim rather than minting `superseded_by` / `moved_to`.**
`.planning/seeds/SEED-224-document-space-redesign-five-tab-rag-honesty.md:1-15`
```yaml
---
id: SEED-224
title: Document space redesign — …
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, operator direction after reviewing Stitch project …
enriched: 2026-08-28 — …
renumbered_from: SEED-217
renumbered_because: >
  This seed was planted uncommitted on 2026-08-28. Phase 214's close plan (214-15) independently
  committed a DIFFERENT SEED-217 (`an-upstream-argument-source-is-inert-on-native-capability-rows`)
  and could not see this file. Two files claimed id 217; `status:` frontmatter IS the register
  index, so a duplicate id breaks the sweep. This side was renumbered because it had no inbound
  references, while the committed SEED-217 is already cited in `214-UAT.md` and its SUMMARY.
surface: Agentic-RAG
```
⚠ **Note what `renumbered_because` did that D-07 forbids:** it chose the mover by *reference weight*.
D-07 rejects that rule by name. **Copy the KEYS, not the reasoning** — the new `renumbered_because`
values must cite the `created`-else-`planted` date, and for `SEED-231` / `SEED-253` the git add-commit
tie-break (D-20).

**The bad precedent, quoted so the plan can say what it is not doing** —
`.planning/seeds/SEED-068-public-benchmark-scoreboard.md:1-3`:
```yaml
seed_id: SEED-068  # renumbered from SEED-063 at v2.8 audit close-out 2026-06-07
                   # (ID collision with SEED-063-execute-code-wallclock-timeout)
```
⛔ An inline `#` comment inside the value. It is why `seed_id` disagrees with the filename in that
file, and it is invisible to any scan. **Neither precedent left a redirect stub — D-05's stub is
genuinely new.**

⚠ **D-17's wording obligation, restated where the executor will see it:** the `SEED-253` stub is read
by developers inside `backend/app/services/sources/adapters/microsoft_graph.py`,
`mcp_source.py`, `preview_service.py`, `watch_service.py`, `base.py`, `import_service.py`,
`ingest_enrich.py`, `mock_source.py`, `mailbox.py` and five backend test files — **33 files
deliberately left pointing at it.** The stub must name **both** resolutions and say plainly which one
concerns source paths.

---

### 5. `.claude/hooks/agent-bus-check.sh` (D-14)

**The file in full — `.claude/hooks/agent-bus-check.sh:1-41`:**
```bash
#!/usr/bin/env bash
# SessionStart — surface anything the other agent is waiting on Claude for.
#
# ⚠ THIS IS THE TRIGGER, and it is the whole reason the bus is not another register nobody
# reads. `.planning/seeds/` holds 188 `trigger_when` entries and the only command that greps
# for SEED is the one that WRITES them; a mailbox checked by good intentions decays the same
# way. This hook makes the check unskippable at every session start, including subagents.
#
# SILENT when there is nothing addressed to Claude — a hook that prints on every start is
# noise, and noise is how a real item gets scrolled past.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BUS="$ROOT/.agent-bus/OPEN.md"
[ -f "$BUS" ] || exit 0

items=$(grep -E '^### \[OPEN\].*to:claude' "$BUS" 2>/dev/null || true)
[ -z "$items" ] && exit 0

echo "════════════════════════════════════════════════════════════════"
echo "AGENT BUS — item(s) addressed to Claude and still OPEN:"
echo
while IFS= read -r line; do
  id=$(printf '%s' "$line" | grep -oE 'BUS-[0-9]{3}')
  from=$(printf '%s' "$line" | sed -nE 's/.*from:([a-z]+).*/\1/p')
  date=$(printf '%s' "$line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
  body=$(awk -v id="$id" 'index($0,"### [")==1{p=(index($0,id)>0);next} p && NF && $0 !~ /^\*\*Answer:/{print;exit}' "$BUS")
  age=""
  then_s=$(date -u -d "$date" +%s 2>/dev/null || echo "")
  if [ -n "$then_s" ]; then
    d=$(( ( $(date -u +%s) - then_s ) / 86400 ))
    [ "$d" -ge 3 ] && age="  ** $d DAYS OLD **" || age="  (${d}d)"
  fi
  echo "  $id  from:$from$age"
  echo "    $body"
done <<< "$items"
echo
echo "  Answer:  bash scripts/agent-bus.sh answer <BUS-NNN> \"<answer>\""
echo "  Then:    bash scripts/agent-bus.sh close <BUS-NNN>"
echo "════════════════════════════════════════════════════════════════"
exit 0
```

**Three things to note for the edit, with the line numbers:**
- ⛔ **`:18` `[ -z "$items" ] && exit 0` must move.** It fires whenever there are no `to:claude`
  items — **the normal state** (exactly 1 open today, `BUS-171` itself, and it will close). D-14's
  `to:operator` line must print even when the `to:claude` block is empty.
- ⚠ **`:9-10` states a SILENCE CONTRACT in the file's own header.** D-14 trades it away. Name the
  trade in the plan rather than sliding past it; RESEARCH §6.3 suggests preserving it by printing the
  summary only when the `to:operator` count is non-zero.
- ⚠ **`:5` is already rotted** — *"`.planning/seeds/` holds 188 `trigger_when` entries"*. Measured:
  **157 `trigger_when` across 283 files**. Since D-14 edits this file anyway, correct it in the same
  commit, with the original beside it per house convention.

#### ⚠ The two copies of the parse, side by side — so the plan specifies ONE home, not a third

| | `scripts/agent-bus.sh` `cmd_list` **(:86-91)** | `.claude/hooks/agent-bus-check.sh` **(:24-33)** |
|---|---|---|
| id | `grep -oE 'BUS-[0-9]{3}'` | `grep -oE 'BUS-[0-9]{3}'` — **identical** |
| to | `sed -nE 's/.*to:([a-z]+).*/\1/p'` | *(not extracted — hardcoded into the grep pattern)* |
| from | `sed -nE 's/.*from:([a-z]+).*/\1/p'` | **identical** |
| date | `grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}'` | **identical** |
| **age** | **`age_days()` helper — GNU `date -u -d` WITH a BSD `date -u -j -f` fallback and a `"?"` sentinel** | ⛔ **inline, GNU-only, no fallback, no sentinel** |

`scripts/agent-bus.sh:37-44` — the better implementation:
```bash
# Age in days of a YYYY-MM-DD date, portable across GNU/BSD date.
age_days() {
  local d="$1" then now
  then=$(date -u -d "$d" +%s 2>/dev/null || date -u -j -f %Y-%m-%d "$d" +%s 2>/dev/null || echo "")
  [ -n "$then" ] || { echo "?"; return; }
  now=$(date -u +%s)
  echo $(( (now - then) / 86400 ))
}
```
`.claude/hooks/agent-bus-check.sh:28-33` — the divergent copy:
```bash
  age=""
  then_s=$(date -u -d "$date" +%s 2>/dev/null || echo "")
  if [ -n "$then_s" ]; then
    d=$(( ( $(date -u +%s) - then_s ) / 86400 ))
    [ "$d" -ge 3 ] && age="  ** $d DAYS OLD **" || age="  (${d}d)"
  fi
```
⭐ **Verdict: `agent-bus.sh`'s `age_days()` is the better model and must become the single home.** It
handles BSD `date` and returns a `"?"` sentinel the caller can test (`cmd_list:93` does:
`if [ "$age" != "?" ] && [ "$age" -ge 3 ]`). ⛔ **Do not write the age a third time.** Either `source`
`scripts/agent-bus.sh` (⚠ it dispatches on `$1` at `:170-175`, so a bare source runs a command — guard
it, or extract) or lift `age_days` into a tiny shared file both read. RESEARCH §6.2: *"a second
parser that disagrees with the first is this project's recurring defect"* — here there are already
two and they have already diverged.

⚠ **`·` is safe.** Neither parser ever matches on the middot; both key on `BUS-\d{3}`,
`to:([a-z]+)`, `from:([a-z]+)` and the ISO date. No encoding work needed.

---

### 6. The two workflow wiring points (D-19)

⛔ **D-03's two named files are 76- and 45-line ROUTERS with no steps.** Measured: no file in
`.claude/commands/gsd/` (68 files) invokes any `node scripts/…`. The only three `node scripts/` calls
in the whole framework are the G-7 gate, in the **workflows** directory:
```
.claude/get-shit-done/workflows/execute-phase.md: node scripts/check-gap-closure-rounds.cjs "${PHASE_NUMBER}"
.claude/get-shit-done/workflows/plan-phase.md:    node scripts/check-gap-closure-rounds.cjs "${PHASE_NUMBER}"
.claude/get-shit-done/workflows/verify-work.md:   node scripts/check-gap-closure-rounds.cjs "${PHASE_NUMBER}"
```

#### 6a. ⭐ The precedent diff — `git show 9d3d887de`, the template for this edit

Commit message (the shape a 251 wiring commit should mirror — checks named, derivation explained,
escape hatches justified, **and a verified-against line**):
```
feat: mechanical enforcement for G-7 (gap-closure round cap)

    G-7 as prose binds the orchestrator's routing, which is exactly the kind of
    rule a tired reader talks themselves past. scripts/check-gap-closure-rounds.cjs
    counts the rounds from the repository itself and exits non-zero when another
    one is being started.
    …
    Both escape hatches take a REASON, never a boolean, so an override lands in
    the shell history: --unmet-criterion and --capability-approved. An override
    prints a WITH OVERRIDES verdict rather than a clear one, so a waved-through
    finding can never read as an absent one.

    Wired into the three places that route to a new round: execute-phase's
    gaps_found branch, verify-work's plan_gap_closure planner spawn, and
    plan-phase's --gaps entry (new section 2.4, before any research or file
    write). Each gates on exit 1 and requires success-criteria status plus dating
    the offending code before triage.

    Verified: 187 -> 1 (both reasons), 186 -> 1 (3 rounds via the fallback),
    181 -> 0, unknown phase and no-arg -> 2, overrides -> 0.
```

The actual insertion, from `git show 9d3d887de -- .claude/get-shit-done/workflows/verify-work.md`
— ⭐ **note the shape: the gate is inserted ABOVE the existing step body, and the original body is
re-titled into the `exit 0` arm rather than left unconditional:**
```diff
 <step name="plan_gap_closure">
-**Auto-plan fixes from diagnosed gaps:**
+**PROJECT GATE — G-7 gap-closure round cap. Run this BEFORE spawning any planner:**
+
+```bash
+node scripts/check-gap-closure-rounds.cjs "${PHASE_NUMBER}"
+G7_EXIT=$?
+```
+
+**If `G7_EXIT` is 1: do NOT spawn the gap-closure planner.** …
+Print the check's output verbatim, then:
+
+1. Report ROADMAP **success-criteria** status — …
+2. **Date the offending code** (`git log --diff-filter=A -- <file>`). …
+3. Triage each diagnosed gap: **fast-fix** (G-3 …), **defer-to-next-phase** …, or **accept**.
+4. Spawn the planner ONLY if a ROADMAP success criterion is genuinely unmet, after re-running the
+   check with `--unmet-criterion "SC#N: <what is not true>"` and recording the override under
+   `STATE.md → Guardrail overrides`.
+
+See `CLAUDE.md` § Workflow guardrails, rule **G-7**.
+
+**If `G7_EXIT` is 0, auto-plan fixes from diagnosed gaps:**
```

And the numbered-section form it minted — `.claude/get-shit-done/workflows/plan-phase.md:175-201`:
```markdown
## 2.4. PROJECT GATE — G-7 gap-closure round cap

**Skip if:** no `--gaps` flag.

**If `--gaps` is present, run the mechanical check BEFORE any research, planner spawn, or file write:**

```bash
node scripts/check-gap-closure-rounds.cjs "${PHASE_NUMBER}"
G7_EXIT=$?
```

**If `G7_EXIT` is 1: STOP. Do not plan another round.** Print the check's own output verbatim — it
names the derivation and the reasons — then:

1. Report ROADMAP **success-criteria** status. If every criterion is verified, say so plainly and
   present *stopping* as a real option rather than routing onward.
…
4. Proceed ONLY if a ROADMAP success criterion is genuinely unmet, by re-running the check with
   `--unmet-criterion "SC#N: <what is not true>"` … and recording the override under
   `STATE.md → Guardrail overrides`.

Rationale and the three mechanisms that make this structural rather than a discipline problem:
`CLAUDE.md` § Workflow guardrails, rule **G-7** (ratified 2026-08-04 at Phase 187's close, where a
15-plan phase had become 29 across five rounds).
```
⭐ **Section-naming convention: `## X.Y. PROJECT GATE — <rule>`, closing with a `Rationale:` line that
points back at CLAUDE.md.** Mint `## X.Y. PROJECT GATE — REG-02 seeds sweep` in exactly this style.

#### 6b. `discuss-phase.md` — the landing point and its ready-made sibling

⭐ **Insert immediately after `<step name="cross_reference_todos">` (`:264-278`) and before
`<step name="scout_codebase">` (`:280`).** It is the register cross-reference step; a seeds sweep is
its exact sibling. Surrounding lines, verbatim —
`.claude/get-shit-done/workflows/discuss-phase.md:262-283`:
```markdown
</step>

<step name="cross_reference_todos">
Check pending todos for matches with this phase's scope.

```bash
TODO_MATCHES=$(gsd-sdk query todo.match-phase "${PHASE_NUMBER}")
```

Parse JSON for: `todo_count`, `matches[]` (each with `file`, `title`, `area`, `score`, `reasons`).

**If `todo_count` is 0 or `matches` is empty:** Skip silently.

**If matches found:** Present each match (title, area, why it matched). AskUserQuestion (multiSelect) asking which to fold. Folded → `<folded_todos>` for CONTEXT.md `<decisions>`. Reviewed but not folded → `<reviewed_todos>` for CONTEXT.md `<deferred>`.

**Auto mode (`--auto`):** Fold all todos with score >= 0.4 automatically. Log the selection.
</step>

<step name="scout_codebase">
Lightweight scan of existing code to inform gray area identification (~10% context).

Read `@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/references/scout-codebase.md` — …
```
⭐ **Copy this step's four arms wholesale**: the bash call · the *skip silently* arm · the
present/AskUserQuestion fold arm routing into CONTEXT.md `<decisions>` / `<deferred>` · the `--auto`
arm with a threshold. A `<step name="cross_reference_seeds">` built on it reads as native.

⚠ **One thing this step does NOT do that the seeds step MUST:** it writes routing into CONTEXT.md but
never writes back to the todo file. CLAUDE.md requires *"A seed is answered by editing the seed"* —
see §6c, where that obligation is currently forbidden.

#### 6c. `new-milestone.md` — the block D-19 REPLACES, in full

`.claude/get-shit-done/workflows/new-milestone.md:49-96`
```markdown
## 2.5. Scan Planted Seeds

Check `.planning/seeds/` for seed files that match the milestone goals gathered in step 2.

```bash
ls .planning/seeds/SEED-*.md 2>/dev/null
```

**If no seed files exist:** Skip this step silently — do not print any message or prompt.

**If seed files exist:** Read each `SEED-*.md` file and extract from its frontmatter and body:
- **Idea** — the seed title (heading after frontmatter, e.g. `# SEED-001: <idea>`)
- **Trigger conditions** — the `trigger_when` frontmatter field and the "When to Surface" section's bullet list
- **Planted during** — the `planted_during` frontmatter field (for context)

Compare each seed's trigger conditions against the milestone goals from step 2. A seed matches when its trigger conditions are relevant to any of the milestone's target features or goals.

**If no seeds match:** Skip silently — do not prompt the user.

**If matching seeds found:**

**`--auto` mode:** Auto-select ALL matching seeds. Log: `[auto] Selected N matching seed(s): [list seed names]`

**Text mode (`TEXT_MODE=true`):** Present matching seeds as a plain-text numbered list:
```
Seeds that match your milestone goals:
1. SEED-001: <idea> (trigger: <trigger_when>)
2. SEED-003: <idea> (trigger: <trigger_when>)

Enter numbers to include (comma-separated), or "none" to skip:
```

**Normal mode:** Present via AskUserQuestion:
```
AskUserQuestion(
  header: "Seeds",
  question: "These planted seeds match your milestone goals. Include any in this milestone's scope?",
  multiSelect: true,
  options: [
    { label: "SEED-001: <idea>", description: "Trigger: <trigger_when> | Planted during: <planted_during>" },
    ...
  ]
)
```

**After selection:**
- Selected seeds become additional context for requirement definition in step 9. Store them in an accumulator (e.g. `$SELECTED_SEEDS`) so step 9 can reference the ideas and their "Why This Matters" sections when defining requirements.
- Unselected seeds remain untouched in `.planning/seeds/` — never delete or modify seed files during this workflow.
```

**Four things the plan must handle here, all visible in the quote above:**
1. ⛔ **`:59` `Read each SEED-*.md file`** — all 283, by hand. That is REG-02's burden written into the
   workflow verbatim. **D-19 replaces the MECHANISM inside this section; it does not add a section.**
2. ⛔ **`:96` `never delete or modify seed files during this workflow`** directly contradicts
   CLAUDE.md's *"A seed is answered by editing the seed."* D-19 scopes the prohibition in writing —
   the workflow does not edit seeds; answering a seed by editing it stays correct outside it.
   ⭐ This is very likely a real cause of the 161-planted backlog.
3. ⚠ **It filters on NEITHER `status` NOR `surface`** — it reads everything. So the "45% blind" defect
   is CLAUDE.md's *rule*, not this workflow's *behaviour*. **Describe them separately** or the plan
   will claim to fix one and actually fix the other.
4. ⭐ **Preserve the three presentation arms** (`--auto` / `TEXT_MODE` / AskUserQuestion) — they are
   the GSD house convention and the gate's output feeds them unchanged.

⚠ **Vendored-framework risk (RESEARCH §8.7):** `.claude/get-shit-done/` is at **VERSION 1.42.3**,
tracked in git, with a SessionStart update checker. The G-7 wiring survived one update
(`dec2577ae` touched none of the three files). **Record the new wiring sites in CLAUDE.md beside the
G-7 entry** so a future `chore(gsd): apply the pending GSD framework update` can re-apply them.

---

### 7. `/gsd:capture`'s id allocator (D-08)

**The live bug, verbatim — `.claude/get-shit-done/workflows/plant-seed.md:53-62`:**
```markdown
<step name="generate-seed-id">
```bash
# Find next seed number
EXISTING=$( (ls .planning/seeds/SEED-*.md 2>/dev/null || true) | wc -l )
NEXT=$((EXISTING + 1))
PADDED=$(printf "%03d" $NEXT)
```

Generate slug from idea summary.
</step>
```
⛔ **`count(files) + 1`, not `max(id) + 1`.** 283 files, highest id 276 → it emits **`SEED-284`** today,
not D-08's `277`. ⚠ **The allocator lives here, not in `.claude/commands/gsd/capture.md`** (which
carries one line: a routing-table row mapping `--seed` to `plant-seed`), and **no
`.claude/skills/gsd-capture*` directory exists** — CONTEXT's Integration Points names two files that
are not the one to edit.

⭐ **THE REPLACEMENT HAS A CORRECT, IN-REPO ANALOG — `scripts/agent-bus.sh:26-33`:**
```bash
# Highest existing BUS-NNN across BOTH files, +1. Reading both is load-bearing: ids must never
# be reused after an archive sweep, or an answer can land on the wrong question.
next_id() {
  local max
  max=$( { cat "$BUS" "$ARCHIVE" 2>/dev/null || true; } \
    | grep -oE 'BUS-[0-9]{3}' | grep -oE '[0-9]{3}' | sort -n | tail -1 )
  printf 'BUS-%03d' $(( 10#${max:-0} + 1 ))
}
```
**Three properties to carry across, each already justified in that comment:**
- **`max` over the id space, never a count.**
- **Reads EVERY source that can hold an id** — for the bus that is OPEN.md *and* the archive; for
  seeds it is the filename set (and, if stubs ever move, the stubs too). ⭐ The comment's reason
  transfers exactly: *"ids must never be reused … or an answer can land on the wrong question."*
- **`10#${max:-0}`** — base-10 forcing. ⛔ **Load-bearing here:** seed ids are zero-padded, and bash
  treats `022` and `092` as **invalid octal**. Without `10#`, `$(( 092 + 1 ))` is a hard error. The
  existing `printf "%03d"` in `plant-seed.md` stays.

⚠ **D-08's stated cause is incomplete and the plan should say so:** the allocator has been wrong on
its own, single-threaded, the whole time. The gate arm (`[duplicate-id]`) and the allocator fix are
complementary — the allocator prevents the ordinary case, the gate catches the parallel-agent case
the allocator structurally cannot.

⚠ **Same-commit obligation nobody has named yet:** `plant-seed.md:64-104` also carries the *de facto*
seed template — and it writes `id:` (not `seed_id:`), `status: dormant`, `trigger_when: when
relevant`, `scope: unknown`, and **no `surface:`, no `title:`, no `trigger_paths:`**:
```markdown
---
id: SEED-{PADDED}
status: dormant
planted: {ISO date}
planted_during: {current milestone/phase from STATE.md, or "unknown" if not in a GSD project}
trigger_when: when relevant
scope: unknown
---
```
⛔ **This block is the mechanism that re-introduces D-09's defect on the very next seed.** It must be
updated in the same commit as `.planning/seeds/TEMPLATE.md`, or the backfill is undone by the next
`/gsd:capture --seed`.

---

### 8. ⛔ PostToolUse guard pattern — REFERENCE ONLY, NOT WHAT THIS PHASE BUILDS

**D-19 ruled the wiring goes in the workflows, NOT a hook.** This section exists so the plan can say
what it considered and rejected, and so a future re-open has the shape ready.

`.claude/hooks/hot-file-ledger-guard.js` — the load-bearing 40 lines of 93:
```js
#!/usr/bin/env node
/**
 * hot-file-ledger-guard.js — PostToolUse hook: G-5's teeth, fired where plans are authored.
 *
 * Fires ONLY when the write touched a `*-PLAN.md` under `.planning/phases/`, so every other
 * edit in the repo costs one string comparison and nothing else.
 * …
 * Deliberately NOT a PreToolUse blocker, matching claude-md-size-guard.js: a plan that names a
 * new hot file is usually correct and simply owes a row, and a hook must never deny that write.
 * It reports loudly, in-turn, while the author still holds the reason.
 *
 * Not prefixed `gsd-` on purpose — it is not GSD-managed and must survive `/gsd:update`.
 */
…
  const norm = String(filePath).split(path.sep).join('/');
  if (!/\.planning\/phases\/[^/]+\/.*-PLAN\.md$/.test(norm)) process.exit(0);
…
  try {
    out = execFileSync(process.execPath, [gate, phaseDir], { cwd: root, encoding: 'utf8', timeout: 15000 });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
    code = typeof e.status === 'number' ? e.status : 2;
  }

  if (code === 0) process.exit(0); // clear — say nothing, cost nothing
…
  process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext,
        ledger_gate_exit: code,
        file_path: norm,
      },
  }));
  process.exit(0);
```
⚠ **Why D-19 is right to reject it, in the hook's own terms:** it fires on a **file write**, and
REG-02's touchpoints are `/gsd:discuss-phase` and `/gsd:new-milestone` — moments, not writes. A hook
cannot see either. **If a future phase does want one**, the newest sibling
`.claude/hooks/verification-honesty-guard.js:81-92` shows the `--files` invocation form
(`execFileSync(process.execPath, [gate, '--files', norm], …)`) and — at `:36-37` — the trap to avoid:
an over-broad path regex hands the gate files its own header declares out of bounds.

---

## Shared Patterns

### S-1. Exit codes `0 / 1 / 2`, with `fail()` owning `2`
**Source:** `scripts/check-verification-honesty.cjs:26, 232-235` · `check-hot-file-ledger.cjs:32,
69-72` · `check-gap-closure-rounds.cjs:59, 79-82`
**Apply to:** `check-seeds-register.cjs`, and the migration script's harness errors.
```js
 * EXIT  0 = clear · 1 = violation · 2 = harness error
function fail(msg) { console.error(`FATAL: ${msg}`); process.exit(2); }
```

### S-2. Every number is DERIVED and its derivation is PRINTED
**Source:** `check-gap-closure-rounds.cjs:35-40` (header) and `:197-201` (the print) ·
`check-hot-file-ledger.cjs:159-160`
**Apply to:** the gate's register census, the duplicate-id list, D-18's two unswept figures, and the
migration's "files changed / keys added per file" report.
```
 * HOW ROUNDS ARE DERIVED (printed on every run, so the number is auditable):
```
⭐ CLAUDE.md's own rule, one register over: **"Derive, never transcribe."** D-08's allocator is the
same rule applied to seed ids.

### S-3. An override prints `passed WITH OVERRIDES`, never `clear`
**Source:** `check-gap-closure-rounds.cjs:261-276` · `check-verification-honesty.cjs:515-519`
**Apply to:** any escape hatch `check-seeds-register.cjs` ships (and the plan should say plainly
whether it ships one at all — none of D-04's four arms obviously warrants one).

### S-4. Zero dependencies, hand-rolled frontmatter
**Source:** `check-verification-honesty.cjs:28-32`
**Apply to:** the gate AND the migration script. `path.matchesGlob` and `crypto` are Node built-ins
and are therefore in-bounds; `js-yaml` / `gray-matter` are out, with two independent measured reasons.

### S-5. Same-commit sync rule
**Source:** CLAUDE.md (`Dockerfile.sandbox` ↔ `docs/SANDBOX-PACKAGES.md`; ledger row ↔ detail
section) · `check-hot-file-ledger.cjs:182`
**Apply to:** **three** pairs this phase creates —
`.planning/seeds/TEMPLATE.md` ↔ `plant-seed.md`'s inline template (§7) ·
`TEMPLATE.md` ↔ CLAUDE.md's seeds cross-check rule ·
`check-seeds-register.cjs`'s enum ↔ `TEMPLATE.md`'s enum comment.
⛔ A template that disagrees with the gate is the register's next 40-spelling `status` field.

### S-6. Corrections sit BESIDE originals, never over them
**Source:** CLAUDE.md throughout · `check-verification-honesty.cjs:42-57, 74-86` (a header that
preserves the argument it is overturning, and says why it was right when written)
**Apply to:** the CLAUDE.md seeds-rule correction, the `agent-bus-check.sh:5` rotted comment, and the
migration's `status_note` — which IS this convention mechanised.

### S-7. A guard nobody has seen fire is not a guard
**Source:** CLAUDE.md § context budget · `check-hot-file-ledger.cjs:78-81` (*"Found by driving this
gate RED, not by reading it"*)
**Apply to:** D-04's four arms. ⛔ **There is no test file, no test directory and no self-test mode
for any `check-*.cjs` in this repository** (`grep -n -i 'self-test\|selftest\|--test' scripts/check-*.cjs`
→ no matches). The house method is: plant a defect → run the gate → confirm it fires and names the
right thing → restore the file and **prove it md5-identical** → record the drive in the PLAN/SUMMARY.
⚠ This is what makes the plan decomposition load-bearing: the RED arms plant corrupt seeds into the
same directory the migration rewrites.

---

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| `scripts/migrate-seeds-frontmatter.cjs` | one-shot migration | bulk file-I/O with a hash invariant | **No `.cjs` in `scripts/` writes files at all** (measured: zero `writeFileSync` matches). No in-repo script proves a *no-touch* invariant by hash over a bulk edit. The nearest relatives are named in §2 — `repair_dirty_workflow_phases.py` for the posture, `agent-bus.sh:150-155` for the hash mechanism (inverse direction), `check-181-scope-freeze.sh` for the header/exit style, `check-hot-file-ledger.cjs:106` for the non-greedy delimiter. **The Buffer pass-through in §2d is genuinely new code and the plan must treat it as such.** |
| *(partial)* the folded-scalar / YAML-list `trigger_when` reader | parser | transform | `list()` at `check-gap-closure-rounds.cjs:103-117` walks continuation lines, but no sibling reads a **folded block scalar** (`key: >`). 112 of 157 values need it. Build it first, assert it reads **157**, then build everything else on it. |
| *(partial)* the `[duplicate-id]` arm's date rule | predicate | transform | D-20's `created`-else-`planted` fallback with a git add-commit tie-break has no analog. `check-gap-closure-rounds.cjs:189` shows the git shape to borrow: `git(["log", "--diff-filter=A", "--format=%h %ad", "--date=short", "-1", "--", p.rel])` — and `git()` at `:84-88` is the `spawnSync` wrapper. ⚠ Use `--date=iso`, not `--date=short`: two pairs tie on the DAY. |

---

## Metadata

**Analog search scope:** `scripts/` (7 `check-*.cjs`, 3 `check-*.sh`, 5 `apply_migration_*.py`,
`agent-bus.sh`, `repair_dirty_workflow_phases.py`) · `.claude/hooks/` (18 files) ·
`.claude/get-shit-done/workflows/` (`discuss-phase`, `new-milestone`, `plan-phase`, `verify-work`,
`plant-seed`) · `.claude/commands/gsd/` · `.planning/reported-bugs/TEMPLATE.md` ·
`.planning/seeds/` (283 files; 5 read in full for frontmatter shape) · `git show 9d3d887de`
**Files read in full:** `check-hot-file-ledger.cjs` (191) · `agent-bus-check.sh` (41) ·
`hot-file-ledger-guard.js` (93) · `reported-bugs/TEMPLATE.md` (54)
**Files read by targeted, non-overlapping range:** `check-verification-honesty.cjs` (554) ·
`check-gap-closure-rounds.cjs` (278) · `check-claude-md-size.cjs` (333) · `agent-bus.sh` (~180)
**Pattern extraction date:** 2026-09-16, tree at `139c967b6`
**Read-only:** no source file, seed, hook, workflow or CLAUDE.md was modified by this pass.

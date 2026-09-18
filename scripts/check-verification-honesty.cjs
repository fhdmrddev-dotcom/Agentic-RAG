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
 *    as no fact* — paid for twice on the `tsc --noEmit` gate alone, and measured on the hot-file
 *    ledger where a 214-row table sitting in CLAUDE.md for every agent to read still left
 *    `App.tsx` with no row for 23 phases. A sentence in a planning doc is not a mechanism.
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
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE BOUNDARY — DERIVED, NEVER LISTED (rewritten 2026-09-14, SEED-275, operator ruling)
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 *   SUBJECT SET = every `*-VERIFICATION.md` **and** `*-VERDICT.md` one directory below
 *                 `.planning/phases/<phase>/` (the LIVE milestone)
 *               + the same under every `.planning/milestones/<vX.Y>-phases/<phase>/` (ARCHIVED),
 *                 filtered to phase number >= DEBT_FLOOR_PHASE (238).
 *
 * ⚠ WHAT THIS REPLACED, AND WHY — the original is not preserved because it was WRONG, it is
 *   summarised because its REASONING was right and its MECHANISM rotted. It read:
 *   `SUBJECT SET = the active milestone + three PINNED archived paths`, and it was correct on the
 *   day it was written. Measured 2026-09-14: the gate printed `subject: 3 files` and
 *   `honesty gate OK` while **twenty** verdict files existed.
 *
 *   ⛔ THE MECHANISM WAS MILESTONE ARCHIVAL, NOT NEGLECT. The old header said archival was safe —
 *   *"when a milestone is archived its phases leave the boundary CARRYING the marker — the
 *   direction that costs nothing and loses nothing."* **That is true of the FILES and false of the
 *   GATE.** The moment v4.1 closed, 242/243/244/246 left the active half and nothing put them in
 *   the pinned half, so every milestone close silently shrank the scan set. Two phases were then
 *   found unmarked (239) or unscannable (245) with the gate reading green.
 *
 *   ⭐ A longer hardcoded list is the same defect with a later expiry date. This project cured this
 *   exact disease once already: the hot-file ledger was a COMPLETE 214-row table and `App.tsx`
 *   still went 23 phases without a row. The cure was to make the gate DERIVE its scan set.
 *
 * ⭐ `VERDICT.md` COUNTS (operator ruling, 2026-09-14). Phase 245 — *"the verification debt
 *   discharged or retired in writing"* — produced `245-VERDICT.md` and no `245-VERIFICATION.md`,
 *   so the phase that invented this marker and wrote this gate was invisible to both. Keying on
 *   one filename made the instrument blind to its own author.
 *
 * ⚠ THE `DEBT_FLOOR_PHASE = 238` FLOOR IS WHAT KEEPS THE ORIGINAL WARNING SATISFIED. The old
 *   header's objection to a repo-wide scan stands and is honoured: there are ~218
 *   `*-VERIFICATION.md` under `.planning/`, and exactly ONE carried the marker before Phase 245.
 *   **A gate that reds 217 files on day one is a gate everyone learns to ignore, which is a gate.**
 *   The floor is 238 because DEBT-06 names *"238, 240, 241 and 242-246"* — 238 is where the
 *   obligation starts. Phases below it predate the entire verification-debt conversation and are
 *   deliberately OUT of scope; a sweep that "fixed" them would be inventing records, not indexing
 *   existing ones.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * NON-VACUITY — THE FLOOR IS NOW LEGITIMATE, AND THE OLD PROHIBITION IS OBSOLETE
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ⚠ THE PREVIOUS HEADER FORBADE EXACTLY THIS, IN CAPITALS: *"DO NOT ADD A FLOOR ON THE TOTAL
 *   SUBJECT COUNT … a `MIN_SUBJECT_FILES = 6` floor would exit 2 FOREVER."* **That argument was
 *   correct for the OLD design and is void for this one, and the difference is the whole point.**
 *   It rested on `.planning/phases/` being *"a directory designed to empty"* — true, and the reason
 *   the old subject set collapsed at every milestone close. This set includes the ARCHIVED
 *   milestones, so it never empties: it grows monotonically and can only shrink if the archive
 *   layout itself changes, which is precisely the condition worth exiting `2` over.
 *
 * `MIN_SUBJECT_FILES = 6` against 9 resolved at the time of writing (238-246). It floors the whole
 * derived set, which is now the invariant part rather than the transient part.
 *
 * `subject: N files (A archived + L live)` prints on every run.
 *
 * Modes, and the floor applies to exactly one of them:
 *   · scan mode    — fail `2` if the derived set resolves fewer than MIN_SUBJECT_FILES.
 *   · `--files`    — fail `2` only on ZERO arguments. ⛔ ONE file is a legitimate resolution: this
 *                    is the mode the hook uses, and a floor here would make the hook report a
 *                    harness error on every single VERIFICATION.md write.
 *
 * Modes, and the floor applies to exactly one of them:
 *   · scan mode    — fail `2` if fewer than MIN_PINNED_FILES pinned paths resolve.
 *   · `--files`    — fail `2` only on ZERO arguments. ⛔ ONE file is a legitimate resolution: this
 *                    is the mode the hook uses, and a floor here would make the hook report a
 *                    harness error on every single VERIFICATION.md write.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE PREDICATE — three findings, and ONE DELIBERATE NON-CHECK
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 *   [no-frontmatter]            — no `---` fenced block starting at line 1.
 *   [no-verification-mode]      — the frontmatter has no `verification_mode` key.
 *   [frontmatter-claims-review] — a frontmatter key's VALUE, taken left of the first UNQUOTED `#`,
 *                                 matches /\breviewed\b/i while OV-SOLO-01 is live.
 *
 * ⛔⛔ THE COMMENT MUST BE STRIPPED, AND IT IS NOT AN OPTIMISATION — WITHOUT IT THIS GATE REDS
 *     EVERY FILE IT WAS BUILT TO BLESS. The mandated marker is, verbatim:
 *
 *       verification_mode: self-verified   # ⛔ OV-SOLO-01 / D-245-01 — NEVER "reviewed". …
 *
 *     **The word `reviewed` sits inside the comment on the very line the predicate reads.** Measured
 *     2026-09-13 across all six subject files: raw hits `1, 1, 1, 1, 1, 1` → after stripping
 *     `0, 0, 0, 0, 0, 0`. A naive value-match fires on all six, every one correct.
 *
 *     ⚠ The second-order consequence is why this is load-bearing rather than cosmetic: if the gate
 *     were already firing on every file, then a **planted** `reviewed` would be UNATTRIBUTABLE — the
 *     gate would fire for a reason other than the plant, on the same code path, which is
 *     *half-driven*, not driven RED. Arm B-0 in `245-01-PLAN.md` exists to prove the strip works
 *     BEFORE the planted-defect arm is believed.
 *
 *     ⚠ Stripping can only ever make this predicate MORE permissive, never make it fire falsely: the
 *     text it discards is a comment. A `reviewed` hiding to the right of a `#` in an UNQUOTED value
 *     is a knowing false negative, accepted for the above reason.
 *
 * ⛔ THE NON-CHECK, AND IT IS THE MOST LOAD-BEARING LINE IN THIS FILE: **BODY PROSE IS NEVER
 *    INSPECTED.** Not one line below the closing `---`. Measured at HEAD, before Phase 245 touched
 *    anything:
 *
 *      | file | \breviewed\b | substring `review` (-i) | `code-review` |
 *      |------|--------------|-------------------------|---------------|
 *      | 238  |            1 |                      13 |             0 |
 *      | 240  |            0 |                      11 |             3 |
 *      | 241  |            2 |                      11 |             1 |
 *
 *    **Every one of those 35 occurrences is an honest sentence naming the §6.3 review that is
 *    OWED.** A predicate that read the body would fire on all three CORRECT files, and would then
 *    pressure a future agent into deleting the very honesty this gate exists to protect. SC#3's
 *    literal wording — *"does not find 'reviewed'"* — is unsatisfiable for exactly this reason
 *    (D-01), and what *"cannot lapse unnoticed"* actually needs is machine-checkability, which
 *    prose cannot give.
 *
 *    ⛔ A future maintainer who wants to "improve" this gate by scanning the body must find this
 *       paragraph first. It was refused, on measurement, not overlooked.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * OV-SOLO-01 LIVENESS — KEYED ON AN INDEXED MARKER, NEVER ON PROSE
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Read from `.planning/STATE.md`: `^OV-SOLO-01-status:\s*(live|retired-<date>)`.
 *   live            → the [frontmatter-claims-review] arm RUNS.
 *   retired-<date>  → that arm is SKIPPED, and the skip is PRINTED.
 *   marker absent   → that arm is SKIPPED, printed as a finding in its own right.
 * ⛔ A skip is ALWAYS printed. A silent skip is a gate that stopped guarding without saying so.
 *
 * ⛔ A PROSE-SCANNING LIVENESS TEST WAS CONSIDERED AND REFUSED. Keying on *"no line containing
 *    OV-SOLO-01 also contains RETIRED"* is disabled by this project's own house style: D-08 requires
 *    corrections to sit BESIDE their originals, so the eventual retirement line will contain both
 *    tokens forever — and so would any note quoting it. One sentence of the form *"OV-SOLO-01 is not
 *    RETIRED"* would silently disable the arm TODAY. The indexed marker mirrors the rule this
 *    project already paid to learn: **`status:` frontmatter IS the index; body prose is invisible to
 *    every scan.**
 *
 * `--review-by "<string>"` is the worded escape hatch, a STRING and never a boolean, exactly as
 * `check-gap-closure-rounds.cjs` does it. It suppresses [frontmatter-claims-review] for that run and
 * changes the verdict to `honesty gate passed WITH OVERRIDES`, never `OK`, so a waved-through claim
 * can never read as an absent one. ⛔ It does NOT suppress [no-frontmatter] or
 * [no-verification-mode].
 *
 * ⚠ CRLF IS NORMALISED BEFORE PARSING. Four of the six subject files are CRLF. A CRLF planning doc
 *   is exactly how `check-hot-file-ledger.cjs` was measured printing `subject: 0 files` and
 *   `ledger gate OK` over a phase it could not read at all (Phase 242).
 *
 * Not prefixed `gsd-` on purpose — it is not GSD-managed and must survive `/gsd:update`.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const STATE = path.join(root, '.planning', 'STATE.md');
const ACTIVE_DIR = path.join(root, '.planning', 'phases');

/**
 * ⚠ THE SCAN SET IS DERIVED, NEVER LISTED — SEED-275, operator ruling 2026-09-14.
 *
 * What stood here: `const PINNED = [...]`, three literal paths (238 / 240 / 241 VERIFICATION.md),
 * unioned with the ACTIVE milestone's `.planning/phases/`. Measured 2026-09-14: the gate printed
 * `subject: 3 files` and `honesty gate OK` while **twenty** verdict files existed.
 *
 * ⛔ The mechanism was not neglect, it was MILESTONE ARCHIVAL. The moment v4.1 closed, 242/243/244/246
 * left the "active" half and were never added to the "pinned" half — so every milestone close
 * silently shrank the gate. A longer hardcoded list is the same defect with a later expiry date.
 *
 * ⭐ This project already cured this disease once: the hot-file ledger was a COMPLETE 214-row table
 * and `App.tsx` still went 23 phases without a row, `config.py` its entire life. The cure was to make
 * the gate DERIVE what it must check. This is that cure, applied to the instrument that checks
 * whether a self-verification is visible.
 *
 * Scope floor is `DEBT_FLOOR_PHASE`, not the phase that introduced the marker: DEBT-06 names
 * "238, 240, 241 and 242-246", so 238 is where the obligation starts. Phases below it predate the
 * whole verification-debt conversation and are deliberately out of scope — a sweep that "fixed"
 * them would be inventing records, not indexing them.
 */
const DEBT_FLOOR_PHASE = 238;

/**
 * ⭐ `VERDICT.md` COUNTS AS A VERIFICATION FILE — operator ruling, 2026-09-14.
 * Phase 245 — *"the verification debt discharged or retired in writing"* — produced `245-VERDICT.md`
 * and no `245-VERIFICATION.md`, so the phase that invented this marker and wrote this gate was
 * invisible to both. Keying on one filename made the instrument blind to its own author.
 */
const VERDICT_FILE_RE = /-(?:VERIFICATION|VERDICT)\.md$/;

/** A phase directory: `NNN-name` or `NNN.N-name`. Capture group 1 is the integer phase. */
const PHASE_DIR_RE = /^(\d+)(?:\.\d+)?-/;

/**
 * Floor on the DERIVED set. A gate that passes over nothing is worse than absent —
 * `check-hot-file-ledger.cjs` was measured exiting 0 over `subject: 0 files` at Phase 242.
 * Nine files resolved when this floor was written (238-246); 6 leaves room for archival
 * reorganisation without leaving room for the set silently collapsing.
 */
const MIN_SUBJECT_FILES = 6;

const RED = '\x1b[31m';
const YEL = '\x1b[33m';
const GRN = '\x1b[32m';
const RST = '\x1b[0m';

function fail(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(2);
}

function norm(p) {
  return String(p).split(path.sep).join('/').replace(/^\.\//, '');
}

/** Repo-relative, `/`-separated, for an argument that may be absolute or relative to cwd. */
function toRepoRel(arg) {
  const abs = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg);
  return norm(path.relative(root, abs));
}

/**
 * The phase number a repo-relative verdict path belongs to, or `null` when the path is not a
 * verdict file inside a phase directory. Shape-based on purpose: `--files` must accept any path the
 * derived scan would have found, without the caller having to be in a list.
 */
function phaseOf(rel) {
  if (!VERDICT_FILE_RE.test(rel)) return null;
  const parts = rel.split('/');
  const dir = parts[parts.length - 2];
  if (!dir) return null;
  const m = PHASE_DIR_RE.exec(dir);
  return m ? Number(m[1]) : null;
}

function inBoundary(rel) {
  const n = phaseOf(rel);
  return n !== null && n >= DEBT_FLOOR_PHASE;
}

/** Archived (a closed milestone) vs live (`.planning/phases/`) — reporting only, not a gate. */
function isArchived(rel) {
  return rel.startsWith('.planning/milestones/');
}

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

/** The `---` fenced block starting at line 1, CRLF-normalised. `null` when there is none. */
function frontmatter(text) {
  const t = text.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---(\n|$)/.exec(t);
  return m ? m[1] : null;
}

/** OV-SOLO-01 liveness, read from an INDEXED marker and never from prose. */
function ovSoloStatus() {
  if (!fs.existsSync(STATE)) {
    return { state: 'missing', line: 'OV-SOLO-01-status: NOT FOUND — .planning/STATE.md does not exist' };
  }
  const text = fs.readFileSync(STATE, 'utf8').replace(/\r\n/g, '\n');
  const m = /^OV-SOLO-01-status:[ \t]*(live|retired-[^\s#]+).*$/m.exec(text);
  if (!m) return { state: 'missing', line: null };
  return { state: m[1] === 'live' ? 'live' : 'retired', value: m[1], line: m[0].trim() };
}

function flagValue(name) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) fail(`--${name} takes a STRING reason, never a bare flag`);
  return v;
}

/** Every verdict file one directory below `container`, phase-floored. */
function subjectsUnder(container) {
  if (!fs.existsSync(container)) return [];
  const out = [];
  for (const d of fs.readdirSync(container)) {
    const dir = path.join(container, d);
    let st;
    try {
      st = fs.statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!VERDICT_FILE_RE.test(f)) continue;
      const rel = norm(path.relative(root, path.join(dir, f)));
      if (inBoundary(rel)) out.push(rel);
    }
  }
  return out;
}

/**
 * ⭐ THE DERIVED SUBJECT SET — the live milestone AND every archived one.
 * Walking `.planning/milestones/&ast;-phases/` is the half the old `PINNED` list stood in for, and it is
 * the half that went stale: archival moved phases OUT of `.planning/phases/` and nothing put them back.
 */
function discoverSubjects() {
  const out = [...subjectsUnder(ACTIVE_DIR)];
  const milestones = path.join(root, '.planning', 'milestones');
  if (fs.existsSync(milestones)) {
    for (const d of fs.readdirSync(milestones)) {
      if (!/-phases$/.test(d)) continue;
      out.push(...subjectsUnder(path.join(milestones, d)));
    }
  }
  return [...new Set(out)].sort();
}

function inspect(rel, claimsArmLive) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return { rel, missing: true, findings: [] };

  const text = fs.readFileSync(abs, 'utf8');
  const fm = frontmatter(text);
  if (fm === null) {
    return {
      rel,
      fm: false,
      mode: null,
      findings: [['no-frontmatter', 'no `---` fenced block starts at line 1, so no scan can read a verdict claim here']],
    };
  }

  const lines = fm.split('\n');
  const findings = [];

  // `verification_mode` — presence, then its comment-stripped value.
  let mode = null;
  for (const l of lines) {
    const m = /^verification_mode:[ \t]*(.*)$/.exec(l);
    if (m) {
      mode = stripComment(m[1]).trim();
      break;
    }
  }
  if (mode === null) {
    findings.push([
      'no-verification-mode',
      'the frontmatter carries no `verification_mode` key — a self-verification here is invisible to every scan',
    ]);
  }

  // Any frontmatter VALUE claiming a review, comment stripped. Body prose is NEVER inspected.
  if (claimsArmLive) {
    for (const l of lines) {
      const m = /^[ \t]*-?[ \t]*([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(l);
      if (!m) continue;
      const value = stripComment(m[2]);
      if (/\breviewed\b/i.test(value)) {
        findings.push([
          'frontmatter-claims-review',
          `\`${m[1]}\` claims a review while OV-SOLO-01 is live: ${JSON.stringify(value.trim().slice(0, 120))}`,
        ]);
      }
    }
  }

  return { rel, fm: true, mode, findings };
}

function main() {
  const argv = process.argv.slice(2);
  const reviewBy = flagValue('review-by');
  const ov = ovSoloStatus();

  // The claims-review arm runs only while OV-SOLO-01 is live AND no worded override was given.
  const claimsArmLive = ov.state === 'live' && !reviewBy;

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

  console.log(`verification honesty — ${label}`);

  const results = [];
  let archivedCount = 0;
  let liveCount = 0;
  let outsideCount = 0;

  for (const rel of subject) {
    if (!inBoundary(rel)) {
      outsideCount++;
      console.log(`  ${rel}`);
      console.log(`      outside boundary — skipped (see the BOUNDARY note in this script's header)`);
      continue;
    }
    if (isArchived(rel)) archivedCount++;
    else liveCount++;

    const r = inspect(rel, claimsArmLive);
    results.push(r);
    if (r.missing) {
      console.log(`  ${rel}`);
      console.log(`      ${RED}does not exist on disk${RST}`);
      continue;
    }
    console.log(`  ${rel}`);
    console.log(
      `      frontmatter=${r.fm ? 'yes' : 'NO '}  verification_mode=`
        + `${r.mode === null ? RED + 'ABSENT' + RST : JSON.stringify(r.mode)}`
        + `  findings=${r.findings.length}`
    );
  }

  const missingOnDisk = results.filter((r) => r.missing);
  if (missingOnDisk.length) {
    fail(`${missingOnDisk.length} subject path(s) do not exist on disk: `
      + missingOnDisk.map((r) => r.rel).join(', '));
  }

  const parts = [`${archivedCount} archived + ${liveCount} live`];
  if (outsideCount) parts.push(`${outsideCount} outside boundary — skipped`);
  console.log(`subject: ${archivedCount + liveCount} files (${parts.join(' + ')})`);

  // ⛔ A skip is ALWAYS printed.
  if (ov.state === 'live') {
    console.log(ov.line);
  } else if (ov.state === 'retired') {
    console.log(`OV-SOLO-01-status: ${ov.value} — claims-review arm SKIPPED`);
  } else {
    console.log(
      `${YEL}OV-SOLO-01-status: NOT FOUND — claims-review arm SKIPPED (this is itself a finding: `
        + `the index line is missing from .planning/STATE.md)${RST}`
    );
  }
  if (reviewBy) {
    console.log(`--review-by: ${JSON.stringify(reviewBy)} — claims-review arm SUPPRESSED for this run`);
  }

  const violations = results.filter((r) => r.findings.length);
  const total = results.reduce((n, r) => n + r.findings.length, 0);
  const withMode = results.filter((r) => r.mode !== null).length;

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

  console.log(`\n${RED}HONESTY GATE FAILS${RST} — ${total} finding(s) across ${violations.length} file(s):`);
  for (const r of violations) {
    for (const [code, why] of r.findings) {
      console.log(`  [${code}] ${r.rel}`);
      console.log(`      ${why}`);
    }
  }
  console.log(`
⛔ A VERIFICATION.md without \`verification_mode\` is not "slightly under-documented" — it is a
   self-verification that a future reader, and every scan, will take for a review. OV-SOLO-01 rules
   that solo running continues ONLY on the condition that each phase says so in its own record.

   Add this line to the file's frontmatter, immediately after \`verified:\`:

     verification_mode: self-verified   # ⛔ OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.

   If an INDEPENDENT reviewer genuinely looked at it (someone who did not shape the build, per
   AGENTS.md §6.3), say who and why they were independent:

     node scripts/check-verification-honesty.cjs --review-by "<who, and why they did not shape it>"

   ⛔ Do NOT satisfy this gate by editing body prose. Every honest sentence naming an owed review
      must stay — deleting them destroys the record the marker exists to index (D-01).`);
  return 1;
}

try {
  process.exit(main());
} catch (e) {
  fail(e && e.stack ? e.stack : String(e));
}

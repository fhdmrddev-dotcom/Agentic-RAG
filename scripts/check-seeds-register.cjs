#!/usr/bin/env node
'use strict';
/**
 * check-seeds-register.cjs — REG-02's teeth (Phase 251, D-03/D-04).
 *
 * WHY THIS EXISTS
 * ---------------
 * `.planning/seeds/` is this project's deferral index: every entry carries a `trigger_when`
 * written precisely so the idea could be revived at the right moment. Measured 2026-08-19 and
 * again at this phase's discuss: **the register is swept by NOTHING**. `grep -rln "SEED"
 * .claude/commands/gsd/` returns `capture.md` only — the command that *writes* seeds.
 *
 * ⛔ The cost is measured, not hypothetical. `SEED-172` sat reachable for **four weeks** — its
 *    trigger had fired and nobody was looking. A `trigger_when` nobody reads is a deferral with
 *    no re-open, which is a deletion that looks like a decision.
 *
 * ⛔ And a sweep is only worth what its SCAN SET is worth. Phase 242 measured
 *    `check-hot-file-ledger.cjs` printing `subject: 0 files` and `ledger gate OK` in the same
 *    breath, over a CRLF plan it could not parse. So this gate asserts its own arithmetic:
 *    **every file the register contains is either parsed or counted as skipped, and scan mode
 *    refuses to pass unless `parsed === registerSize`.** A gate that passes over nothing is worse
 *    than absent.
 *
 * USAGE
 *   node scripts/check-seeds-register.cjs                       # full register scan
 *   node scripts/check-seeds-register.cjs --files a.md b.md     # per-file mode (no count floor)
 *   node scripts/check-seeds-register.cjs --phase <NNN>         # trigger sweep vs files_modified
 *   node scripts/check-seeds-register.cjs --self-test           # D-04's arms, temp fixture register
 *
 * EXIT  0 = clear · 1 = violation · 2 = harness error
 *
 * ZERO DEPENDENCIES, and that is a RULE rather than a preference. Permitted requires are Node
 * built-ins only: `fs`, `path`, `crypto`, `os`, `child_process` (the last for D-20's git tie-break).
 * Two independent measured reasons, either of which is sufficient:
 *   ⚠ (inherited, DEF-245-01) `244-VERIFICATION.md`'s frontmatter does not parse as YAML — a
 *     YAML-parsing gate exits 2 on a file that carries its marker perfectly.
 *   ⚠ (this phase, RESEARCH §2.4) **21 seeds carry their `status` prose after a `#`**, which a real
 *     YAML parser silently DISCARDS. D-10 requires that prose be preserved byte-for-byte in
 *     `status_note`. A dependency that throws away the deliverable is not a convenience.
 *
 * ⚠ THIS FILE IS BOTH A CLI AND A LIBRARY, and the entry-point guard at the bottom of this file is
 *   load-bearing. Plan 02's migration `require()`s it so that ONE frontmatter boundary regex and ONE
 *   continuation reader exist in the repo rather than two that will diverge (the `age_days()`
 *   precedent: two copies of the bus header parse already exist and have ALREADY diverged). Without
 *   the guard, a `require()` would run this gate's CLI and kill the importing process.
 *   No sibling `check-*.cjs` exports anything today — `grep -l "module.exports" scripts/*.cjs` is
 *   empty — so the departure is deliberate and this is its reason.
 *
 * ⚠ NEVER NORMALISE ON DISK. This gate only reads. 159 of 284 seeds contain CR and 6 are mixed
 *   inside one file; `core.autocrlf=true` with no `.gitattributes` means a normalising rewrite
 *   changes every working-tree line while producing NO `git diff`. Regexes here are `\r?\n`-tolerant
 *   instead, so the bytes on disk are never the thing that has to change.
 *
 * Not prefixed `gsd-` on purpose — it is not GSD-managed and must survive `/gsd:update`.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SEEDS_DIR = path.join(root, '.planning', 'seeds');

/** A register entry. The filename is the authority for the id — frontmatter disagrees on 1+ file. */
const SEED_FILE_RE = /^SEED-(\d{3})-.*\.md$/;

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

function unquote(s) {
  return String(s).trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * The `---` fenced block starting at line 1. Returns the WHOLE match object, or `null`.
 *
 * ⭐ THE RETURN SHAPE IS PART OF THE CONTRACT, because Plan 02's migration consumes it:
 *   - `m[1]` is the captured frontmatter block;
 *   - `m[0].length` is the exact STRING offset of the block's end, valid because the regex is
 *     anchored at index 0.
 * ⛔ Do NOT "simplify" this to return the bare captured string. Recovering the offset would need
 *    `text.indexOf(block)`, which returns `0` for an EMPTY frontmatter block and silently mis-slices
 *    the body — one such seed is enough to void D-11's md5 body proof on that file.
 *
 * ⛔ NON-GREEDY, ALWAYS. 102 bare `---` horizontal rules live inside seed BODIES; a greedy
 *    delimiter, or a naive split on every `---` line, destroys body content on ~40% of the register.
 * ⚠ `\r?` is mandatory and is not decoration: 159 of 284 seeds contain CR.
 * ⭐ `null` rather than `''` on a miss — the gate must distinguish "no block at all" (the 5
 *    `[no-frontmatter]` seeds) from "an empty block", and `''` collapses them.
 */
function frontmatter(text) {
  return /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
}

/**
 * Cut a frontmatter line at the first `#` that is NOT inside a quoted string, and return the part
 * to the LEFT. Quote-aware on purpose: a value may legitimately carry `#` inside quotes, and
 * cutting there would truncate a value the predicate should see whole.
 * ⛔ This is a split, not a YAML parser — see the zero-dependency note in the header.
 * ⚠ Lifted verbatim from `check-verification-honesty.cjs:277-290`, but used for the OPPOSITE
 *   purpose: there the right-hand side is noise; here it is the deliverable (D-10's `status_note`).
 *   This gate REPORTS the split; Plan 02's migration PERFORMS it.
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

/**
 * Read a frontmatter key across ALL THREE shapes the register actually uses, returning
 * `{ value, shape, line, head, raw }` or `null` when the key is absent.
 *
 * ⛔ THIS IS THE PIECE WITH NO SIBLING, AND IT WAS DRIVEN RED BEFORE IT WAS WRITTEN.
 *    Measured 2026-09-16 over the live register: a plain `^trigger_when:[ \t]*(.+)$` reader — which
 *    is what every sibling gate's `scalar()` does — resolves **45 of 158** files. The other 113 put
 *    their content on continuation lines as a folded block scalar (`key: >`) or a YAML list.
 *    A sweep built on `scalar()` would silently report "no trigger" for 71% of the corpus, which is
 *    REG-02's own failure mode rebuilt inside the instrument meant to end it.
 *
 * Shapes: `plain` (value on the key's line) · `folded` (`>`/`>-`/`|`, continuation lines joined with
 * a space) · `list` (`  - ` bullets, joined with `; `) · `other` (indented continuation that is
 * neither) · `empty` (key present, nothing after it).
 *
 * Starting point: `check-gap-closure-rounds.cjs:103-117` `list()` — it already walks continuation
 * lines and already stops at the next top-level key with `if (/^\S/.test(lines[i])) break`.
 */
function readKey(fm, key) {
  if (fm == null) return null;
  const lines = String(fm).split(/\r?\n/);
  const head = new RegExp(`^${key}:[ \\t]*(.*)$`);
  let idx = -1;
  let rest = '';
  for (let i = 0; i < lines.length; i++) {
    const m = head.exec(lines[i]);
    if (m) {
      idx = i;
      rest = m[1];
      break;
    }
  }
  if (idx === -1) return null;

  const headVal = rest.trim();
  const isBlock = /^[>|][-+]?$/.test(headVal);

  if (headVal && !isBlock) {
    return { value: unquote(headVal), shape: 'plain', line: idx, head: rest, raw: [] };
  }

  const cont = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*$/.test(l)) continue;      // blank lines belong to the block, they do not end it
    if (/^\S/.test(l)) break;           // the next top-level key ends every continuation shape
    cont.push(l);
  }

  if (isBlock) {
    return {
      value: cont.map((l) => l.trim()).join(' ').trim(),
      shape: 'folded',
      line: idx,
      head: rest,
      raw: cont,
    };
  }
  if (!cont.length) {
    return { value: '', shape: 'empty', line: idx, head: rest, raw: [] };
  }
  const bullets = [];
  let allBullets = true;
  for (const l of cont) {
    const b = l.match(/^[ \t]+-[ \t]+(.*)$/);
    if (b) {
      bullets.push(unquote(b[1]));
    } else if (bullets.length) {
      bullets[bullets.length - 1] += ` ${l.trim()}`;   // a wrapped bullet
    } else {
      allBullets = false;
    }
  }
  if (allBullets && bullets.length) {
    return { value: bullets.join('; ').trim(), shape: 'list', line: idx, head: rest, raw: cont };
  }
  return {
    value: cont.map((l) => l.trim()).join(' ').trim(),
    shape: 'other',
    line: idx,
    head: rest,
    raw: cont,
  };
}

/** The joined value of a key, or `''`. Convenience over `readKey` for presence tests. */
function keyValue(fm, key) {
  const r = readKey(fm, key);
  return r && r.value ? r.value : '';
}

/**
 * Read the register from `dir` — a PARAMETER, never a module constant, so `--self-test` can point
 * exactly this code at a temp fixture directory rather than at a second implementation of it.
 *
 * `registerSize` is the filtered `readdirSync` length and is THE ONLY AUTHORITY for how many files
 * must be accounted for. Files are read as Buffers and decoded for parsing only — this gate never
 * writes, and never normalises line endings on disk.
 */
function readRegister(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    return { dir, registerSize: 0, entries: [], skipped: new Map(), readError: String(e && e.message) };
  }
  const files = names.filter((f) => SEED_FILE_RE.test(f)).sort();
  const entries = [];
  const skipped = new Map();
  const skip = (reason, file) => {
    if (!skipped.has(reason)) skipped.set(reason, []);
    skipped.get(reason).push(file);
  };

  for (const f of files) {
    const p = path.join(dir, f);
    let buf;
    try {
      buf = fs.readFileSync(p);
    } catch (e) {
      // ⛔ EVERY early exit increments a counter. `check-hot-file-ledger.cjs:108,110` has two
      //    uncounted `continue`s, and that is exactly how it printed `subject: 0 files · gate OK`.
      skip('unreadable', f);
      continue;
    }
    const text = buf.toString('utf8');
    const m = frontmatter(text);
    entries.push({
      file: f,
      rel: norm(path.relative(root, p)),
      id: SEED_FILE_RE.exec(f)[1],
      buf,
      text,
      fm: m ? m[1] : null,
      fmEnd: m ? m[0].length : 0,
    });
  }
  return { dir, registerSize: files.length, entries, skipped, readError: null };
}

/** Total of every counted skip. */
function skippedTotal(skipped) {
  let n = 0;
  for (const v of skipped.values()) n += v.length;
  return n;
}

/**
 * The count assertion (D-04), and it is STRICTLY STRONGER than the `MIN_SUBJECT_FILES` floor it is
 * modelled on: the register has a knowable exact size, so this is equality, not a floor.
 * ⛔ Scan mode only. In `--files` mode one file is a legitimate resolution and an equality check
 *    would make every single-file invocation a harness error.
 */
function assertAccounting(reg, mode) {
  const skippedN = skippedTotal(reg.skipped);
  if (reg.entries.length + skippedN !== reg.registerSize) {
    fail(
      `accounting does not balance: readdir found ${reg.registerSize} register file(s) but `
      + `${reg.entries.length} were parsed and ${skippedN} counted as skipped. `
      + 'Every skip must increment a printed counter — an uncounted `continue` is how a gate '
      + 'reports OK over a set it never read.'
    );
  }
  if (mode !== 'scan') return;
  if (reg.registerSize === 0) {
    fail(
      `the register at ${norm(path.relative(root, reg.dir))} resolved ZERO files`
      + (reg.readError ? ` (${reg.readError})` : '')
      + '. A gate that passes over nothing is worse than absent — check-hot-file-ledger.cjs was '
      + 'measured exiting 0 over `subject: 0 files` at Phase 242. Refusing to report a verdict.'
    );
  }
  if (reg.entries.length !== reg.registerSize) {
    fail(
      `parsed ${reg.entries.length} of ${reg.registerSize} register file(s) — the scan set collapsed `
      + `by ${reg.registerSize - reg.entries.length}. A gate that passes over nothing is worse than `
      + `absent. Skips counted: ${[...reg.skipped.entries()].map(([k, v]) => `${k}=${v.length}`).join(', ') || '(none)'}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);

  let dir = SEEDS_DIR;
  let mode = 'scan';
  let given = null;
  const filesIdx = argv.indexOf('--files');
  if (filesIdx !== -1) {
    given = argv.slice(filesIdx + 1).filter((a) => !a.startsWith('--'));
    if (!given.length) {
      fail(
        '--files was given ZERO arguments. A gate that passes over nothing is worse than absent: '
        + 'check-hot-file-ledger.cjs was measured exiting 0 over `subject: 0 files` at Phase 242, '
        + 'in the same run that printed `ledger gate OK`.'
      );
    }
    mode = 'files';
  }

  const reg = readRegister(dir);
  // ⚠ Accounting is asserted on the WHOLE register, BEFORE any per-file filtering — otherwise the
  //   balance equation would be checked against a set the caller deliberately narrowed.
  assertAccounting(reg, mode);
  if (mode === 'files') {
    const want = new Set(given.map((g) => path.basename(toRepoRel(g))));
    reg.entries = reg.entries.filter((e) => want.has(e.file));
    if (!reg.entries.length) {
      fail(`none of the ${given.length} given path(s) resolved to a register entry under ${norm(path.relative(root, dir))}`);
    }
  }

  const noFm = reg.entries.filter((e) => e.fm === null);
  const skippedN = skippedTotal(reg.skipped);

  console.log(`\nseeds register — ${norm(path.relative(root, dir))}`);
  if (mode === 'files') {
    console.log(
      `  register: ${reg.registerSize} files · selected by --files: ${reg.entries.length} · `
      + `skipped: ${skippedN} · no frontmatter: ${noFm.length}`
    );
    console.log('    ⚠ per-file mode: the count assertion does NOT apply here — one file is a legitimate resolution.');
  } else {
    console.log(
      `  register: ${reg.registerSize} files · parsed: ${reg.entries.length} · `
      + `skipped: ${skippedN} · no frontmatter: ${noFm.length}`
    );
  }
  if (skippedN) {
    for (const [reason, files] of reg.skipped) {
      console.log(`    skipped[${reason}]: ${files.length} — ${files.join(', ')}`);
    }
  }

  if (noFm.length) {
    console.log(`\n${RED}SEEDS REGISTER GATE FAILS${RST} — ${noFm.length} file(s) with no frontmatter block:`);
    for (const e of noFm) {
      console.log(`  [no-frontmatter] ${e.rel}`);
      console.log('      no `---` fenced block starts at line 1, so `status:` — which IS the index — is invisible to every scan');
    }
    return 1;
  }

  console.log(`${GRN}seeds register gate OK${RST} — ${reg.entries.length}/${reg.registerSize} parsed, 0 unaccounted.`);
  return 0;
}

// ⚠ The guard is the reason this file can be both a CLI and a library. See the header.
if (require.main === module) {
  try {
    process.exit(main());
  } catch (e) {
    fail(e && e.stack ? e.stack : String(e));
  }
}

module.exports = {
  frontmatter, readKey, keyValue, stripComment,
  readRegister, assertAccounting, skippedTotal,
  norm, unquote,
};

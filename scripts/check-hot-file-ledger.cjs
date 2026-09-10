#!/usr/bin/env node
'use strict';
/**
 * check-hot-file-ledger.cjs — G-5's teeth.
 *
 * WHY THIS EXISTS
 * ---------------
 * For the project's whole life the hot-file ledger's completeness was guaranteed by a sentence:
 * "a hot file missing from this table is permanently invisible to its own guardrail", plus a
 * 214-row table sitting in CLAUDE.md for every agent to read.
 *
 * ⛔ THAT MECHANISM WAS MEASURED TO FAIL, REPEATEDLY, WHILE THE TABLE WAS RIGHT THERE:
 *   · frontend/src/App.tsx          — no row for 23 phases (the application's ROOT component)
 *   · components/layout/NavPanel.tsx — no row for 11 phases
 *   · backend/app/config.py         — no row for the project's ENTIRE life
 *   · lib/api.ts                    — the actual hottest file in the repo, absent, which made a
 *                                     SUPERLATIVE in CLAUDE.md wrong for a structural reason
 *
 * A 214-row table nobody reads end-to-end is not a scan list; it is a hope. This gate cannot
 * not-notice. It fails when a phase's `files_modified` names a source file with no ledger row.
 *
 * It is deliberately STRICTLY STRONGER than the rule it replaces: the old rule asked an agent to
 * compare a plan against a long table by eye; this compares them mechanically and prints the exact
 * rows to add.
 *
 * USAGE
 *   node scripts/check-hot-file-ledger.cjs <phase-dir | phase-number>
 *   node scripts/check-hot-file-ledger.cjs 235
 *   node scripts/check-hot-file-ledger.cjs .planning/phases/235-the-source-says-what-it-did
 *   node scripts/check-hot-file-ledger.cjs --files backend/app/x.py frontend/src/y.tsx
 *
 * EXIT  0 = clear · 1 = missing rows (G-5 fires) · 2 = harness error
 *
 * ⚠ A missing row is not a style nit. It means G-5 could never have fired on that file at any
 * commit count — the guardrail is not weak there, it is ABSENT.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const LEDGER = path.join(root, 'docs', 'HOT-FILE-LEDGER.md');
const SCAN_HEADER = '| File | commits / phases / lines | G-5 | Disposition |';
/** Non-vacuity floor: the scan list has been 200+ rows for months. A parse that yields fewer
 *  than this has bound to the wrong table, and a gate passing over nothing is worse than absent. */
const MIN_SCAN_ROWS = 150;

/** Files that carry no ledger obligation. Kept narrow ON PURPOSE — an over-broad skip list is how
 *  a guard quietly stops guarding. Tests, planning docs, generated artifacts and migrations are
 *  excluded; everything under backend/app and frontend/src is IN. */
const EXEMPT = [
  /(^|\/)__tests__\//,
  /(^|\/)tests?\//,
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /_test\.py$/,
  /^backend\/tests\//,
  /(^|\/)__generated__\//,
  /^\.planning\//,
  /^docs\//,
  /^supabase\/migrations\//,
  /^scripts\//,
  /^deploy\//,
  /\.(md|sql|json|ya?ml|txt|css|svg|png|jpg|webp)$/,
];

const WATCHED = [/^backend\/app\//, /^frontend\/src\//];

function fail(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(2);
}

/** The authoritative row set. Reads the scan list wherever its header sits in the ledger file. */
function ledgerPaths() {
  if (!fs.existsSync(LEDGER)) fail(`ledger not found at ${LEDGER}`);
  const lines = fs.readFileSync(LEDGER, 'utf8').split('\n');
  // ⚠ EXACT header, never a prefix. This file carries THREE tables whose headers begin
  // "| File | commits" -- a 2-row superlative table at ~:222 and a buckets table at ~:5853.
  // A prefix match silently binds to the FIRST, which is how a gate passes over 2 rows while
  // believing it checked 214. Found by driving this gate RED, not by reading it.
  const start = lines.findIndex((l) => l.trim() === SCAN_HEADER);
  if (start === -1) fail(`no scan-list table in docs/HOT-FILE-LEDGER.md (exact header: ${SCAN_HEADER})`);
  const paths = new Set();
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const m = /`([^`]+)`/.exec(lines[i]);
    if (m) paths.add(m[1].trim());
  }
  return paths;
}

/** files_modified out of every PLAN.md in the phase directory. */
function planFiles(dir) {
  const plans = fs.readdirSync(dir).filter((f) => /-PLAN\.md$/.test(f));
  if (!plans.length) fail(`no *-PLAN.md in ${dir}`);
  const out = new Map();
  for (const p of plans) {
    const text = fs.readFileSync(path.join(dir, p), 'utf8');
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (!fm) continue;
    const block = /files_modified:\s*\n((?:\s*-\s*.+\n)+)/.exec(fm[1] + '\n');
    if (!block) continue;
    for (const line of block[1].split('\n')) {
      const m = /^\s*-\s*(.+?)\s*$/.exec(line);
      if (!m) continue;
      const f = m[1].replace(/^["']|["']$/g, '').split(path.sep).join('/');
      if (!out.has(f)) out.set(f, []);
      out.get(f).push(p);
    }
  }
  return out;
}

function resolvePhaseDir(arg) {
  if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) return arg;
  const base = path.join(root, '.planning', 'phases');
  if (!fs.existsSync(base)) fail(`no .planning/phases and "${arg}" is not a directory`);
  const hit = fs.readdirSync(base).find((d) => d === arg || d.startsWith(`${arg}-`));
  if (!hit) fail(`no phase directory matching "${arg}"`);
  return path.join(base, hit);
}

function needsRow(f) {
  if (!WATCHED.some((re) => re.test(f))) return false;
  return !EXEMPT.some((re) => re.test(f));
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) fail('usage: check-hot-file-ledger.cjs <phase-dir | phase-number> [--files a b c]');

  const known = ledgerPaths();
  if (known.size < MIN_SCAN_ROWS) {
    fail(`the scan list parsed to only ${known.size} rows (floor ${MIN_SCAN_ROWS}) — refusing to `
      + 'pass over a table this small; the parser has almost certainly bound to the wrong one.');
  }

  let subject;
  let label;
  if (argv[0] === '--files') {
    subject = new Map(argv.slice(1).map((f) => [f.split(path.sep).join('/'), ['--files']]));
    label = `${subject.size} file(s) from the command line`;
  } else {
    const dir = resolvePhaseDir(argv[0]);
    subject = planFiles(dir);
    label = path.relative(root, dir).split(path.sep).join('/');
  }

  const watched = [...subject.keys()].filter(needsRow).sort();
  const missing = watched.filter((f) => !known.has(f));

  console.log(`hot-file ledger — ${label}`);
  console.log(`  scan list: ${known.size} rows · subject: ${subject.size} files · watched: ${watched.length}`);

  if (!missing.length) {
    console.log(`\x1b[32mledger gate OK\x1b[0m — every watched file has a row.`);
    return 0;
  }

  console.log(`\nG-5 CANNOT FIRE ON ${missing.length} FILE(S) — they have no ledger row:`);
  for (const f of missing) {
    console.log(`  [no-row] ${f}   (named by ${subject.get(f).join(', ')})`);
  }
  console.log(`
⛔ A missing row does NOT mean the guardrail is weak on that file — it means G-5 is ABSENT there,
   at any commit count, forever, silently. App.tsx went 23 phases like this.

   Add a row to docs/HOT-FILE-LEDGER.md § "Scan list", re-deriving the triple rather than guessing:

     git log --oneline -- <file> | wc -l                                     # commits
     git log --format=%s -- <file> | sed -E 's/^[a-z]+\\(([^)]+)\\).*/\\1/' \\
       | sed -E 's/-.*//' | grep -E '^[0-9]+(\\.[0-9]+)?$' | sort -u | wc -l  # phases (drop 6-digit quick tasks)
     wc -l <file>                                                            # lines

   …and add that file's own section in the SAME COMMIT (same-commit sync rule). Disposition cell
   is capped at 200 chars — verdict in the cell, reasons in the section.`);
  return 1;
}

try {
  process.exit(main());
} catch (e) {
  fail(e && e.stack ? e.stack : String(e));
}

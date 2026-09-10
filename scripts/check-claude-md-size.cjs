#!/usr/bin/env node
/**
 * check-claude-md-size.cjs — guard the CLAUDE.md context budget.
 *
 * WHY THIS EXISTS
 * ---------------
 * Claude Code loads CLAUDE.md verbatim into the system prompt of EVERY session
 * AND every subagent it spawns, and refuses to load a file over 150,000 chars.
 * On 2026-08-16 this repo's CLAUDE.md reached 194,908 chars and tripped that
 * limit; it was split on 2026-08-17 (a882777b, 194.9k -> 51.2k) and by the very
 * next day was already back to 56.8k. The split bought headroom, it did not
 * change the growth mechanism, so the trip WILL recur unmeasured.
 *
 * Measured growth, re-derivable with `--history`:
 *   43,269 chars (d08a492d) -> 194,908 chars (7b39dd5f) in 19 commits / ~5 days.
 *
 * WHAT IT MEASURES
 * ----------------
 * CHARACTERS, not bytes. `wc -c` reports 197,197 for the file the harness called
 * "194.9k" — the 2,289 difference is multi-byte UTF-8 (— ⚠ ✅ …). This script
 * uses `fs.readFileSync(p, 'utf8').length`, which reproduces the harness figure
 * exactly. A byte-based check would fire late and read as a false alarm.
 *
 * EXIT CODES
 *   0  clear (may still print a WARN band advisory)
 *   1  over the hard limit — CLAUDE.md will not load
 *   2  harness error (file unreadable, bad args)
 *
 * USAGE
 *   node scripts/check-claude-md-size.cjs            # check every CLAUDE.md in the repo
 *   node scripts/check-claude-md-size.cjs --json     # machine-readable
 *   node scripts/check-claude-md-size.cjs --history  # re-derive the growth curve from git
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/** The harness's own ceiling. A file at or over this does not load. */
const HARD_LIMIT = 150000;
/** 80% of the ceiling — the band where a split is scheduled, not scrambled. */
const WARN_LIMIT = 120000;

// -- the STRUCTURAL guard (Phase 208) -------------------------------------------
// Size alone is a LAGGING indicator. Twice now the fix has been a split, and both
// times the file grew straight back: 194,908 -> 51,171 chars (2026-08-17) and then
// back to 135,662 by 2026-08-25. The mechanism both times was the hot-file
// ledger's DISPOSITION column becoming the place phases wrote their narrative --
// at the Phase 208 split that ONE column measured 60,558 chars, 45% of the file.
//
// The table is the AUDIT SCAN LIST and must stay COMPLETE: a hot file missing from
// it is permanently invisible to its own guardrail. What may not stay is the
// prose. So the cell carries the VERDICT, and the narrative lives in that file's
// own section in docs/HOT-FILE-LEDGER.md under the same-commit sync rule.
//
// This cap fires in the turn the prose is authored (PostToolUse on Write|Edit),
// which is the half both previous splits skipped -- they bought headroom and
// changed nothing structural, so the trip recurred unmeasured.
//
// 200 is deliberately generous: the longest LEGITIMATE verdict measured at the
// Phase 208 split was 115 chars (`frontend/src/lib/api.ts`).
const LEDGER_CELL_LIMIT = 200;


const SKIP_DIRS = new Set(['node_modules', 'venv', '.venv', '.git', 'worktrees', 'dist', 'build', '__pycache__']);

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
}

/** Every CLAUDE.md the harness could load, excluding vendored + worktree copies. */
function findClaudeMd(root) {
  const found = [];
  (function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(path.join(dir, e.name));
      } else if (e.name === 'CLAUDE.md') {
        found.push(path.join(dir, e.name));
      }
    }
  })(root);
  return found.sort();
}

/** Per-`## ` section char counts, biggest first — names the split target. */
function sections(text) {
  const lines = text.split('\n');
  const out = [];
  let name = '(preamble)';
  let chars = 0;
  for (const line of lines) {
    if (/^## /.test(line)) {
      out.push({ name, chars });
      name = line.replace(/^##\s*/, '').trim();
      chars = line.length + 1;
    } else {
      chars += line.length + 1;
    }
  }
  out.push({ name, chars });
  return out.filter((s) => s.chars > 0).sort((a, b) => b.chars - a.chars);
}

function history(root) {
  const hashes = execFileSync('git', ['log', '--format=%h', '-40', '--', 'CLAUDE.md'], {
    cwd: root,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean)
    .reverse();
  console.log('CLAUDE.md size over the last %d commits that touched it:\n', hashes.length);
  let prev = null;
  for (const h of hashes) {
    let n;
    try {
      n = execFileSync('git', ['show', `${h}:CLAUDE.md`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).length;
    } catch {
      continue;
    }
    const subject = execFileSync('git', ['log', '-1', '--format=%s', h], { cwd: root, encoding: 'utf8' }).trim();
    const delta = prev === null ? '' : (n - prev >= 0 ? '+' : '') + (n - prev);
    const flag = n >= HARD_LIMIT ? ' OVER' : n >= WARN_LIMIT ? ' warn' : '';
    console.log(
      '  %s  %s  %s%s  %s',
      h,
      String(n).padStart(7),
      String(delta).padStart(8),
      flag.padEnd(5),
      subject.slice(0, 62)
    );
    prev = n;
  }
  return 0;
}


/**
 * Parse the hot-file ledger table and return its rows. Returns [] when the file
 * carries no such table, so this is a no-op for every other CLAUDE.md.
 */
function ledgerRows(text) {
  const lines = text.split('\n');
  // ⚠ EXACT match. docs/HOT-FILE-LEDGER.md carries three tables starting "| File | commits";
  // a prefix match binds to a 2-row one and reports a clean check it never performed.
  const start = lines.findIndex((l) => l.trim() === '| File | commits / phases / lines | G-5 | Disposition |');
  if (start === -1) return [];
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    // Split on UNESCAPED pipes -- cells legitimately contain an escaped one.
    const cells = lines[i].replace(/\\\|/g, '\u0000').split('|').map((c) => c.trim());
    const m = /`([^`]+)`/.exec(cells[1] || '');
    if (!m) continue;
    rows.push({ line: i + 1, path: m[1], cells: cells.length, disposition: cells[4] || '' });
  }
  return rows;
}

/** Over-long dispositions, duplicate rows, malformed rows. */
function ledgerFindings(text) {
  const rows = ledgerRows(text);
  const long = rows
    .filter((r) => r.disposition.length > LEDGER_CELL_LIMIT)
    .map((r) => Object.assign({}, r, { len: r.disposition.length }));
  const seen = new Map();
  const dupes = [];
  for (const r of rows) {
    if (seen.has(r.path)) dupes.push({ path: r.path, lines: [seen.get(r.path), r.line] });
    else seen.set(r.path, r.line);
  }
  const malformed = rows.filter((r) => r.cells !== 6);
  return { rows: rows.length, long, dupes, malformed };
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const root = repoRoot();

  if (args.includes('--history')) return history(root);

  const files = findClaudeMd(root);
  if (files.length === 0) {
    console.error('claude-md size gate ERROR — no CLAUDE.md found under %s', root);
    return 2;
  }

  const results = [];
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (err) {
      console.error('claude-md size gate ERROR — cannot read %s: %s', file, err.message);
      return 2;
    }
    const chars = text.length;
    results.push({
      file: path.relative(root, file).split(path.sep).join('/'),
      chars,
      headroom: HARD_LIMIT - chars,
      pct: Math.round((chars / HARD_LIMIT) * 1000) / 10,
      status: chars >= HARD_LIMIT ? 'OVER' : chars >= WARN_LIMIT ? 'WARN' : 'OK',
      sections: sections(text).slice(0, 5),
    });
  }

  const over = results.filter((r) => r.status === 'OVER');
  const warn = results.filter((r) => r.status === 'WARN');

  // The structural guard follows the TABLE, not the filename.
  //
  // 2026-09-06: the 214-row scan list MOVED out of CLAUDE.md (it was 52,325 chars --
  // 44% of that file) into docs/HOT-FILE-LEDGER.md, and the completeness guarantee moved
  // with it from "an agent reads a long table" to scripts/check-hot-file-ledger.cjs, which
  // fails when a phase's files_modified names a source file with no row. CLAUDE.md keeps a
  // FIRING-ONLY shortlist under a DIFFERENT header ("| Hot file (FIRING) |") precisely so it
  // is not parsed as the scan list. These per-cell rules -- 200-char cap, no duplicate row,
  // 6 cells -- still bind, they simply bind where the table actually lives now.
  const LEDGER_FILES = [path.join(root, 'docs', 'HOT-FILE-LEDGER.md')];
  const structural = [];
  for (const file of files.concat(LEDGER_FILES)) {
    if (!fs.existsSync(file)) continue;
    const rel = path.relative(root, file).split(path.sep).join('/');
    const f = ledgerFindings(fs.readFileSync(file, 'utf8'));
    if (f.rows === 0) continue;
    if (f.long.length || f.dupes.length || f.malformed.length) {
      structural.push(Object.assign({ rel }, f));
    }
  }


  if (asJson) {
    console.log(JSON.stringify({ hard_limit: HARD_LIMIT, warn_limit: WARN_LIMIT, results }, null, 2));
    return over.length ? 1 : 0;
  }

  for (const r of results) {
    console.log(
      '  %s  %s chars  %s%% of limit  headroom %s  [%s]',
      r.file.padEnd(40),
      String(r.chars).padStart(7),
      String(r.pct).padStart(5),
      String(r.headroom).padStart(7),
      r.status
    );
  }


  for (const s of structural) {
    const n = s.long.length + s.dupes.length + s.malformed.length;
    console.log('\nHOT-FILE LEDGER — %d structural problem(s) in %s', n, s.rel);
    for (const r of s.long) {
      console.log('  [disposition-too-long] line %d  %d chars (cap %d)  %s',
        r.line, r.len, LEDGER_CELL_LIMIT, r.path);
    }
    for (const d of s.dupes) {
      console.log('  [duplicate-row] lines %s  %s — one file, one row; merge them',
        d.lines.join(' + '), d.path);
    }
    for (const m of s.malformed) {
      console.log('  [malformed-row] line %d  %d cells, expected 6  %s', m.line, m.cells, m.path);
    }
    console.log('  The table is the AUDIT SCAN LIST: it keeps the VERDICT, nothing more.');
    console.log('  The narrative belongs in that file\'s own section in docs/HOT-FILE-LEDGER.md,');
    console.log('  written in the SAME COMMIT. A row without a section is drift — so is a paragraph here.');
  }

  if (structural.length && over.length === 0) {
    console.log('\nclaude-md size gate FAILED — the ledger table is accumulating prose again.');
    console.log('That is the mechanism behind BOTH previous 150k trips, caught early this time.');
    return 1;
  }

  if (over.length === 0 && warn.length === 0 && structural.length === 0) {
    console.log('\nclaude-md size gate OK — every CLAUDE.md loads, all under %d chars.', WARN_LIMIT);
    return 0;
  }

  for (const r of [...over, ...warn]) {
    console.log('\n%s — %s (%d chars, %s%% of the %d limit)', r.status, r.file, r.chars, r.pct, HARD_LIMIT);
    console.log('  biggest sections:');
    for (const s of r.sections) {
      console.log('    %s  %s', String(s.chars).padStart(7), s.name);
    }
    console.log(
      '  Split by FUNCTION, never by deletion: keep the verdict/index/scan-list here,'
    );
    console.log(
      '  move the narrative to docs/<TOPIC>.md under a same-commit sync rule.'
    );
    console.log('  Precedents: docs/HOT-FILE-LEDGER.md, docs/SANDBOX-PACKAGES.md.');
  }

  if (over.length) {
    console.log(
      '\nclaude-md size gate FAILED — %d file(s) at or over %d chars WILL NOT LOAD.',
      over.length,
      HARD_LIMIT
    );
    console.log('Every session and every subagent silently loses these instructions.');
    return 1;
  }

  console.log(
    '\nclaude-md size gate OK WITH WARNINGS — %d file(s) past %d chars. Schedule the split now, not at 150k.',
    warn.length,
    WARN_LIMIT
  );
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error('claude-md size gate ERROR — %s', err && err.stack ? err.stack : err);
  process.exit(2);
}

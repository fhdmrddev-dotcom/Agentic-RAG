#!/usr/bin/env node
/**
 * claude-md-size-guard.js — PostToolUse hook: keep CLAUDE.md inside its budget.
 *
 * Fires only when the write touched a CLAUDE.md, so it costs one `fs.stat`-class
 * read on every other edit and nothing else.
 *
 * WHY A HOOK AND NOT ONLY CI: this repo's `develop` ran 30 commits without a
 * push while CLAUDE.md grew 43k -> 195k chars. A CI gate that runs `on: push`
 * could not have fired once in that window. The trip has to be caught where the
 * content is authored, in the same turn that authors it.
 *
 * PHASE 208 — IT ALSO WATCHES THE MECHANISM, NOT ONLY THE TOTAL. Size is a
 * LAGGING indicator: by the time the file is at 120k the prose has already been
 * written, reviewed and committed. Both 150k trips were driven by ONE column —
 * the hot-file ledger's disposition cell — which reached 60,558 chars, 45% of the
 * whole file. So this hook now reports an over-long cell, a duplicate row or a
 * malformed row IMMEDIATELY, at ANY file size, which is the only moment the
 * author is still holding the reason they wrote it.
 *
 * Deliberately NOT a PreToolUse blocker: an edit that crosses the line is
 * usually the same edit that would be split, and a shrink must never be denied.
 * It warns loudly in-turn; scripts/check-claude-md-size.cjs is the hard gate.
 *
 * Not prefixed `gsd-` on purpose — it is not GSD-managed and must survive
 * `/gsd:update`.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const HARD_LIMIT = 150000;
const WARN_LIMIT = 120000;
// Phase 208 — the hot-file ledger's disposition cell carries the VERDICT only.
// 200 is generous: the longest legitimate verdict at the split measured 115.
const LEDGER_CELL_LIMIT = 200;

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    filePath = JSON.parse(raw).tool_input?.file_path || '';
  } catch {
    process.exit(0);
  }
  if (!filePath || path.basename(filePath) !== 'CLAUDE.md') process.exit(0);

  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    process.exit(0);
  }

  // -- the STRUCTURAL check (Phase 208) ---------------------------------------
  // Runs FIRST and at ANY size. The size early-return below is exactly why the
  // previous guard could not have caught either trip in the turn that caused it:
  // at 51k it said nothing at all, while the column that would grow to 60k was
  // being written a paragraph at a time.
  const ledger = (() => {
    const rowLines = text.split('\n');
    const start = rowLines.findIndex((l) => l.startsWith('| File | commits'));
    if (start === -1) return null;
    const rows = [];
    for (let i = start + 2; i < rowLines.length && rowLines[i].startsWith('|'); i++) {
      // Split on UNESCAPED pipes -- cells legitimately contain an escaped one.
      const cells = rowLines[i].replace(/\\\|/g, '\u0000').split('|').map((c) => c.trim());
      const m = /`([^`]+)`/.exec(cells[1] || '');
      if (m) rows.push({ line: i + 1, path: m[1], cells: cells.length, d: cells[4] || '' });
    }
    const seen = new Map();
    const dupes = [];
    for (const r of rows) {
      if (seen.has(r.path)) dupes.push(`${r.path} (lines ${seen.get(r.path)} + ${r.line})`);
      else seen.set(r.path, r.line);
    }
    return {
      long: rows
        .filter((r) => r.d.length > LEDGER_CELL_LIMIT)
        .map((r) => `line ${r.line}  ${r.d.length} chars (cap ${LEDGER_CELL_LIMIT})  ${r.path}`),
      dupes,
      malformed: rows
        .filter((r) => r.cells !== 6)
        .map((r) => `line ${r.line}  ${r.cells} cells, expected 6  ${r.path}`),
    };
  })();

  const structural = ledger
    ? [
        ...ledger.long.map((x) => `  [disposition-too-long] ${x}`),
        ...ledger.dupes.map((x) => `  [duplicate-row] ${x}`),
        ...ledger.malformed.map((x) => `  [malformed-row] ${x}`),
      ]
    : [];

  // Characters, not bytes — this reproduces the harness's own figure exactly.
  const chars = text.length;
  if (chars < WARN_LIMIT && structural.length === 0) process.exit(0);

  if (structural.length) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: [
            `HOT-FILE LEDGER — ${structural.length} structural problem(s) in ${filePath}:`,
            ...structural,
            '',
            'The table is the AUDIT SCAN LIST: it keeps the VERDICT, nothing more. Every',
            "reason, invariant, correction and named seam goes in that file's own section",
            'in docs/HOT-FILE-LEDGER.md, in the SAME COMMIT. A row without a section is',
            'drift -- and so is a paragraph in a cell. This one column reaching 45% of',
            'CLAUDE.md is what caused BOTH 150k trips.',
            'Verify with: node scripts/check-claude-md-size.cjs',
          ].join('\n'),
          claude_md_chars: chars,
          ledger_structural_problems: structural.length,
          file_path: filePath,
        },
      })
    );
    process.exit(0);
  }

  const over = chars >= HARD_LIMIT;
  const pct = Math.round((chars / HARD_LIMIT) * 1000) / 10;

  const biggest = (() => {
    const out = [];
    let name = '(preamble)';
    let n = 0;
    for (const line of text.split('\n')) {
      if (/^## /.test(line)) {
        out.push({ name, n });
        name = line.replace(/^##\s*/, '').trim();
        n = line.length + 1;
      } else {
        n += line.length + 1;
      }
    }
    out.push({ name, n });
    return out
      .sort((a, b) => b.n - a.n)
      .slice(0, 3)
      .map((s) => `    ${String(s.n).padStart(7)}  ${s.name}`)
      .join('\n');
  })();

  const additionalContext = [
    over
      ? `STOP — ${filePath} is ${chars} chars, at or over the ${HARD_LIMIT} limit. It WILL NOT LOAD.`
      : `WARNING — ${filePath} is ${chars} chars (${pct}% of the ${HARD_LIMIT} limit, headroom ${HARD_LIMIT - chars}).`,
    over
      ? 'Every session and every subagent is silently losing these instructions. Split it before doing anything else.'
      : 'Split it now, on schedule, rather than at the ceiling.',
    'Biggest sections:',
    biggest,
    'Split by FUNCTION, never by deletion: CLAUDE.md keeps the verdict / index /',
    'audit-scan-list; the narrative moves to docs/<TOPIC>.md under a same-commit',
    'sync rule. Precedents: docs/HOT-FILE-LEDGER.md, docs/SANDBOX-PACKAGES.md.',
    'Verify with: node scripts/check-claude-md-size.cjs',
  ].join('\n');

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext,
        claude_md_chars: chars,
        claude_md_over_limit: over,
        file_path: filePath,
      },
    })
  );
  process.exit(0);
});

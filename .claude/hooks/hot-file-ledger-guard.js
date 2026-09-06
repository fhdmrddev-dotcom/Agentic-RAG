#!/usr/bin/env node
/**
 * hot-file-ledger-guard.js — PostToolUse hook: G-5's teeth, fired where plans are authored.
 *
 * Fires ONLY when the write touched a `*-PLAN.md` under `.planning/phases/`, so every other
 * edit in the repo costs one string comparison and nothing else.
 *
 * WHY THIS EXISTS
 * ---------------
 * G-5's completeness was guaranteed by a sentence in CLAUDE.md — "a hot file missing from this
 * table is permanently invisible to its own guardrail" — plus a 214-row table sitting right there
 * for every agent to read. ⛔ THAT WAS MEASURED TO FAIL WHILE THE TABLE WAS PRESENT AND COMPLETE:
 *   · frontend/src/App.tsx           no row for 23 phases (the app's ROOT component)
 *   · components/layout/NavPanel.tsx no row for 11 phases
 *   · backend/app/config.py          no row for the project's ENTIRE life
 * A 214-row table nobody reads end-to-end is not a scan list; it is a hope.
 *
 * On 2026-09-06 the table moved to docs/HOT-FILE-LEDGER.md (it was 52,325 chars — 44% of
 * CLAUDE.md) and the guarantee moved from reading to CHECKING. This hook is the "in the turn that
 * authors it" half; scripts/check-hot-file-ledger.cjs is the hard gate.
 *
 * Deliberately NOT a PreToolUse blocker, matching claude-md-size-guard.js: a plan that names a
 * new hot file is usually correct and simply owes a row, and a hook must never deny that write.
 * It reports loudly, in-turn, while the author still holds the reason.
 *
 * Not prefixed `gsd-` on purpose — it is not GSD-managed and must survive `/gsd:update`.
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    const input = JSON.parse(raw || '{}');
    filePath = (input.tool_input && (input.tool_input.file_path || input.tool_input.filePath)) || '';
  } catch {
    process.exit(0); // never break the turn on a parse failure
  }

  const norm = String(filePath).split(path.sep).join('/');
  if (!/\.planning\/phases\/[^/]+\/.*-PLAN\.md$/.test(norm)) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const phaseDir = path.dirname(norm);
  const gate = path.join(root, 'scripts', 'check-hot-file-ledger.cjs');
  if (!fs.existsSync(gate)) process.exit(0);

  let out = '';
  let code = 0;
  try {
    out = execFileSync(process.execPath, [gate, phaseDir], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
    });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
    code = typeof e.status === 'number' ? e.status : 2;
  }

  if (code === 0) process.exit(0); // clear — say nothing, cost nothing

  const additionalContext = [
    code === 1
      ? 'G-5 HOT-FILE LEDGER — this phase names source files with NO ledger row.'
      : 'G-5 HOT-FILE LEDGER — the gate could not run (harness error).',
    '',
    out.trim(),
    '',
    'A missing row does NOT mean the guardrail is weak on that file — it means G-5 is ABSENT',
    'there, at any commit count, forever, silently. Add the row to docs/HOT-FILE-LEDGER.md',
    'and that file\'s own section in the SAME COMMIT. Re-derive the triple; never copy it forward.',
    'Verify with: node scripts/check-hot-file-ledger.cjs ' + phaseDir,
  ].join('\n');

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext,
        ledger_gate_exit: code,
        file_path: norm,
      },
    })
  );
  process.exit(0);
});

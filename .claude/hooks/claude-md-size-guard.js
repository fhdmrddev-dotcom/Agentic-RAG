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

  // Characters, not bytes — this reproduces the harness's own figure exactly.
  const chars = text.length;
  if (chars < WARN_LIMIT) process.exit(0);

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

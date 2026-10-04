#!/usr/bin/env node
/**
 * docs-coverage-guard.js — PostToolUse hook (Phase 276-05, DOCS-02): every shipped capability keeps
 * a docs page.
 *
 * Runs scripts/check-docs-coverage.cjs whenever a file the gate derives its scan set from, or a
 * docs page, is written. Silent when clean; when red it hands the findings back to the agent as
 * additionalContext in the SAME turn the edit was made (the primary guard — the CI workflow
 * .github/workflows/docs-coverage.yml is the backstop). Always exits 0: it informs, never blocks.
 *
 * ⚠ REGISTRATION IS OPERATOR-GATED. .claude/settings.json is the operator's configuration (see
 * docs/HOT-FILE-LEDGER.md § .claude/settings.json, invariant 4), so 276-05 did NOT register this
 * hook. Until the operator approves it, the CI workflow is the only automatic run. The entry to add
 * to hooks.PostToolUse, beside the landing-drift-guard entry:
 *
 *   { "matcher": "Write|Edit", "hooks": [ { "type": "command",
 *     "command": "\"C:/Program Files/nodejs/node.exe\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/docs-coverage-guard.js",
 *     "timeout": 10 } ] }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TRIGGER_BASENAMES = new Set([
  'tool_dispatcher.py',
  'phase_types.py',
  'validator_kinds.py',
  'validators.py',
  'main.py',
  'nav-items.ts',
  'App.tsx',
  'SettingsPage.tsx',
  'check-docs-coverage.cjs',
  'docs-content.cjs',
  'docs-coverage-inventory.md',
]);

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    filePath = JSON.parse(raw).tool_input?.file_path || '';
  } catch {
    // not JSON — fall through and run the gate
  }

  if (filePath) {
    // Windows paths arrive with backslashes; every check below is on forward slashes.
    const p = filePath.replace(/\\/g, '/');
    const base = p.slice(p.lastIndexOf('/') + 1);
    const triggers =
      TRIGGER_BASENAMES.has(base) || p.includes('docs/public/') || p.includes('backend/app/services/harness/');
    if (!triggers) process.exit(0);
  }

  const repoRoot = path.resolve(__dirname, '..', '..');
  const scriptPath = path.join(repoRoot, 'scripts', 'check-docs-coverage.cjs');
  if (!fs.existsSync(scriptPath)) process.exit(0);

  const res = spawnSync(process.execPath, [scriptPath], { cwd: repoRoot, encoding: 'utf8' });
  if (res.status !== 0) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: [
            '❌ DOCS COVERAGE GUARD TRIPPED (DOCS-02):',
            (res.stdout || '') + (res.stderr || '') || 'A shipped capability has no docs page.',
            'Fix it in the owning docs/public page (its covers: list) — never by adding an exclusion.',
            'Run: node scripts/check-docs-coverage.cjs',
          ].join('\n'),
          exit_code: res.status,
        },
      }),
    );
  }
  process.exit(0);
});

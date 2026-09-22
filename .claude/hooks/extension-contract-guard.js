#!/usr/bin/env node
/**
 * extension-contract-guard.js — PostToolUse hook for the Extension Contract (EXT-02).
 *
 * Fires when an edit touches any of the six closed-core trigger files from SEED-291:
 *   - backend/app/services/harness/phase_types.py
 *   - backend/app/services/harness/validator_kinds.py
 *   - backend/app/services/harness/emitters.py
 *   - backend/app/services/harness/programmatic.py
 *   - backend/app/services/tool_dispatcher.py
 *   - backend/app/services/agent_loop.py
 *
 * Runs scripts/check-extension-contract.cjs --files <edited-file> and alerts immediately
 * if a dynamic dispatch, eval, importlib, or registry mutation was introduced.
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const WATCHED_FILES = new Set([
  'backend/app/services/harness/phase_types.py',
  'backend/app/services/harness/validator_kinds.py',
  'backend/app/services/harness/emitters.py',
  'backend/app/services/harness/programmatic.py',
  'backend/app/services/tool_dispatcher.py',
  'backend/app/services/agent_loop.py',
]);

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    const input = JSON.parse(raw || '{}');
    filePath = (input.tool_input && (input.tool_input.file_path || input.tool_input.filePath)) || '';
  } catch {
    process.exit(0);
  }

  const norm = String(filePath).split(path.sep).join('/');
  const matched = Array.from(WATCHED_FILES).find((wf) => norm.endsWith(wf));
  if (!matched) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const gate = path.join(root, 'scripts', 'check-extension-contract.cjs');
  if (!fs.existsSync(gate)) process.exit(0);

  try {
    const out = execFileSync(process.execPath, [gate, '--files', matched], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (out) process.stdout.write(out);
    process.exit(0);
  } catch (err) {
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    process.exit(1);
  }
});

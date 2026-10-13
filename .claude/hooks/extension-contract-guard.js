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
 * and (Phase 278, SEAM-03 / D-05) the eleven tool-handler modules split out of tool_dispatcher.py:
 *   - backend/app/services/tools/__init__.py
 *   - backend/app/services/tools/base.py
 *   - backend/app/services/tools/documents.py
 *   - backend/app/services/tools/skills.py
 *   - backend/app/services/tools/sandbox.py
 *   - backend/app/services/tools/runtime_gap.py
 *   - backend/app/services/tools/render_template.py
 *   - backend/app/services/tools/workspace.py
 *   - backend/app/services/tools/memory.py
 *   - backend/app/services/tools/agent_control.py
 *   - backend/app/services/tools/connector.py
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
  // Phase 278 (D-05): the tool handler families — closed list, kept in step with the scanner.
  'backend/app/services/tools/__init__.py',
  'backend/app/services/tools/base.py',
  'backend/app/services/tools/documents.py',
  'backend/app/services/tools/skills.py',
  'backend/app/services/tools/sandbox.py',
  'backend/app/services/tools/runtime_gap.py',
  'backend/app/services/tools/render_template.py',
  'backend/app/services/tools/workspace.py',
  'backend/app/services/tools/memory.py',
  'backend/app/services/tools/agent_control.py',
  'backend/app/services/tools/connector.py',
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
    // PostToolUse: exit 1 is not shown to the model — report via additionalContext + exit 0.
    const additionalContext = `EXTENSION CONTRACT (docs/EXTENSION-CONTRACT.md) — violation in ${matched}:\n\n${`${err.stdout || ''}${err.stderr || ''}`.trim()}`;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext, file_path: norm } }));
    process.exit(0);
  }
});

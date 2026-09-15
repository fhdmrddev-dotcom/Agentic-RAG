#!/usr/bin/env node
/**
 * react-hooks-rules-guard.js — PostToolUse hook: catch a conditional React hook in
 * the turn it is authored.
 *
 * ⚠ WHY A HOOK AND NOT ONLY A GATE (Phase 250 WR-03). The defect this exists for —
 *
 *     const isRunLive = useStreamingForThread(threadId) || useLoadingForThread(threadId)
 *
 * — shipped, blanked the whole page, and was found by DRIVING THE APP. It survived the
 * full unit suite because a `vi.fn()` standing in for a hook consumes no hook slot, so a
 * hook-order violation is structurally invisible to those tests. It would also have
 * survived a CI lint gate long enough to matter: this repo's `develop` has run hundreds
 * of commits between pushes. The only moment that reliably catches it is the turn that
 * writes it.
 *
 * ⭐ The rule was ALREADY CONFIGURED (`frontend/eslint.config.js` extends
 * `reactHooks.configs.flat.recommended`) and nothing ran it. This hook runs it, scoped to
 * the file just written, via `scripts/check-react-hooks-rules.cjs`.
 *
 * Deliberately NOT a PreToolUse blocker and deliberately non-fatal: it WARNS in-turn and
 * the script is the hard gate. An edit mid-refactor may legitimately be transiently
 * wrong; being told immediately is the value, not being stopped.
 *
 * Fires only on a frontend .tsx/.ts write, so every other edit costs one path test.
 *
 * Not prefixed `gsd-` on purpose — it is not GSD-managed and must survive `/gsd:update`.
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    filePath = JSON.parse(raw).tool_input?.file_path || '';
  } catch {
    process.exit(0);
  }
  if (!filePath) process.exit(0);

  const norm = filePath.split(path.sep).join('/');
  if (!/\/frontend\/src\/.+\.(tsx|ts)$/.test(norm)) process.exit(0);
  // A hook can only be called from a component or another hook; the rule never fires in
  // a test file, and linting them here would only add noise to every fence edit.
  if (/\.(test|spec)\.(tsx|ts)$/.test(norm) || /\/__tests__\//.test(norm)) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const rel = norm.slice(norm.indexOf('/frontend/') + 1);

  try {
    execFileSync(
      process.execPath,
      [path.join(root, 'scripts', 'check-react-hooks-rules.cjs'), `--files=${rel}`],
      { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 120000 },
    );
  } catch (e) {
    // exit 1 = a NEW violation. exit 2 / spawn failure = harness trouble; stay silent
    // rather than crying wolf about the author's code.
    if (e.status === 1) {
      const out = `${e.stdout || ''}${e.stderr || ''}`.trim();
      console.error(
        `\n⛔ react-hooks/rules-of-hooks — CONDITIONAL HOOK in ${rel}\n\n${out}\n`,
      );
    }
  }
  process.exit(0);
});

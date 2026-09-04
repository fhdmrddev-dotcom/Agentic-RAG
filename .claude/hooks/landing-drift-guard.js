#!/usr/bin/env node
/**
 * landing-drift-guard.js — PostToolUse hook: keep landing facts synchronized.
 *
 * Runs scripts/check-landing-drift.cjs whenever tracked source files or
 * facts.ts are modified, remaining completely silent when clean.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    filePath = JSON.parse(raw).tool_input?.file_path || '';
  } catch {
    // If not JSON, continue to check
  }

  const TRACKED_TRIGGERS = [
    'facts.ts',
    'config.py',
    'tool_dispatcher.py',
    'acceptedFormats.ts',
    'PublishGauntlet.tsx',
    'servicesCatalog.ts',
    'LibraryPage.tsx',
    'SettingsPage.tsx',
    'ControlRoomPage.tsx',
    'OrgAdminShell.tsx',
    'stepIdentityVocabulary.ts',
    'doorVocabulary.ts',
    'check-landing-drift.cjs',
  ];

  if (filePath) {
    const base = path.basename(filePath);
    const touchesTracked = TRACKED_TRIGGERS.includes(base) || filePath.includes('src/landing');
    if (!touchesTracked) {
      process.exit(0);
    }
  }

  const repoRoot = path.resolve(__dirname, '..', '..');
  const scriptPath = path.join(repoRoot, 'scripts', 'check-landing-drift.cjs');

  if (!fs.existsSync(scriptPath)) {
    process.exit(0);
  }

  const res = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (res.status !== 0) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: [
            '❌ LANDING DRIFT GUARD TRIPPED:',
            res.stderr || res.stdout || 'Discrepancy detected in frontend/src/landing/facts.ts vs application code.',
            'Run: node scripts/check-landing-drift.cjs',
          ].join('\n'),
          exit_code: res.status,
        },
      })
    );
    process.exit(0);
  }

  process.exit(0);
});

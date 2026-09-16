#!/usr/bin/env node
/**
 * schema-acl-parity-guard.js — PostToolUse hook: the ACL-mirror gate, fired where the
 * mirror is owed.
 *
 * Fires ONLY when the write touched a numbered migration under `supabase/migrations/`,
 * `scripts/full-schema-supplement.sql` or `supabase/full-schema.sql`, so every other edit in
 * the repo costs one regex test and nothing else.
 *
 * WHY THIS EXISTS
 * ---------------
 * `scripts/regenerate-full-schema.sh` dumps with `pg_dump --no-privileges`, so
 * `supabase/full-schema.sql` can NEVER carry a grant of its own. A migration that narrows a
 * privilege is therefore ABSENT from every greenfield bootstrap — silently, and in the
 * permissive direction — unless a human mirrors it into the supplement. That hand-mirror has
 * failed three times with the instruction in plain sight, most recently migration 181 (CRED-03).
 *
 * ⛔ AND THE GATE THAT CHECKS IT WAS INVOKED BY NOTHING FOR ITS ENTIRE LIFE. Measured at
 *    Phase 253 plan time: `grep -rln "check-schema-acl-parity" .claude .github package.json`
 *    returned ZERO. Phase 252's review had already proved (CR-02) that the gate could not FAIL
 *    on the one deletion it exists to catch — and a gate nobody runs cannot fail either way.
 *    CLAUDE.md's own two-guards rule says the LOCAL hook is primary and CI is the backstop,
 *    because `develop` ran 634 commits over 8 days without a push. This is that primary half;
 *    `.github/workflows/schema-acl-parity.yml` is the backstop.
 *
 * Deliberately NOT a PreToolUse blocker, matching hot-file-ledger-guard.js and
 * claude-md-size-guard.js: a migration that narrows a privilege is a CORRECT edit that simply
 * owes a mirror, and a hook must never deny that write. It reports loudly, in-turn, while the
 * author still holds the reason.
 *
 * ⚠ The gate is a sibling of the GSD-vendored guardrails but is NOT one of them. Both this hook
 *   and its `.claude/settings.json` registration live outside `.claude/get-shit-done/`, and
 *   CLAUDE.md's "the mechanical guardrails live in a vendored framework and a framework update
 *   can clobber them silently" warning applies by analogy: if a future `/gsd:update` or a
 *   settings rewrite drops the PostToolUse entry, this file keeps working and fires NEVER, with
 *   nothing to say so. Re-check the registration whenever the framework is updated.
 *
 * Not prefixed `gsd-` on purpose — it is not GSD-managed and must survive `/gsd:update`.
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/** The three surfaces that can put the bootstrap artifact out of step with the migrations. */
const SUBJECTS = [
  /supabase\/migrations\/\d+_[^/]*\.sql$/,
  /scripts\/full-schema-supplement\.sql$/,
  /supabase\/full-schema\.sql$/,
];

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
  if (!SUBJECTS.some((re) => re.test(norm))) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const gate = path.join(root, 'scripts', 'check-schema-acl-parity.cjs');
  if (!fs.existsSync(gate)) process.exit(0);

  let out = '';
  let code = 0;
  try {
    out = execFileSync(process.execPath, [gate], {
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
      ? 'SCHEMA ACL PARITY — a migration ACL is NOT mirrored into the bootstrap artifact.'
      : 'SCHEMA ACL PARITY — the gate could not run (harness error).',
    '',
    out.trim(),
    '',
    'pg_dump runs with --no-privileges, so supabase/full-schema.sql carries NO ACL of its own.',
    'An unmirrored REVOKE is not a weaker guard on that privilege — it is NO guard, on every',
    'greenfield bootstrap, silently, and in the permissive direction. Copy the statements from',
    'the migration into scripts/full-schema-supplement.sql (never retype them: an argument list',
    'is part of a function\'s identity and a column list is part of a column grant\'s), and apply',
    'the SAME text to supabase/full-schema.sql\'s tail in the SAME COMMIT.',
    'Verify with: node scripts/check-schema-acl-parity.cjs',
  ].join('\n');

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext,
        acl_parity_gate_exit: code,
        file_path: norm,
      },
    })
  );
  process.exit(0);
});

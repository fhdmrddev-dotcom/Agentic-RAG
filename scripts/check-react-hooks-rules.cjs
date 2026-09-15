#!/usr/bin/env node
/**
 * check-react-hooks-rules.cjs — gate `react-hooks/rules-of-hooks` at ZERO NEW.
 *
 * ⚠ WHY THIS EXISTS, measured rather than asserted (Phase 250 code review, WR-03).
 *
 * Phase 250 shipped, for one commit, a line that blanked the entire page:
 *
 *     const isRunLive = useStreamingForThread(threadId) || useLoadingForThread(threadId)
 *
 * `||` short-circuits, so the moment the first selector returned true the second hook
 * was never called, React counted fewer hooks than the previous render, and the app went
 * white. It was found by DRIVING the app. Every unit fence passed — a `vi.fn()` standing
 * in for a hook consumes no hook slot, so the violation is structurally invisible to them.
 *
 * ⭐ AND IT WAS ALREADY CATCHABLE. `frontend/eslint.config.js` extends
 * `reactHooks.configs.flat.recommended`, which sets this rule to error. Driven against a
 * reconstruction of the shipped bug:
 *
 *     236:56  error  React Hook "useLoadingForThread" is called conditionally.
 *                    React Hooks must be called in the exact same order in every
 *                    component render   react-hooks/rules-of-hooks
 *
 * The tool was configured, the rule was on, and nothing ran it. The phase's response was
 * a 20-line comment plus a regex in one test file — and that regex cannot see a ternary
 * hook, a block-guarded hook, or a hook added below the early `return null` that already
 * exists in that same component. This script runs the real rule instead.
 *
 * ⛔ WHY NOT `eslint src` OUTRIGHT: measured 2026-09-15, the frontend carries **406**
 * eslint errors (120 `react-refresh/only-export-components`, 84 `no-explicit-any`, 67
 * `no-unused-vars`, …). A gate on all of them is unreachable, and an unreachable gate is
 * never turned on. `rules-of-hooks` carries **2**, both in one file, both pre-existing —
 * so this rule ALONE is gateable today, with those two pinned by location.
 *
 * ⛔ ZERO NEW, not zero. The pin is a SET of `file:rule` keys, never a count: a count of
 * 2 cannot tell a fixed violation plus a new one from no change at all — the same lesson
 * `250-backend-baseline-set.txt` records for pytest and `vitest-count-gate.cjs` records
 * per file.
 *
 * Usage:
 *   node scripts/check-react-hooks-rules.cjs            # gate the frontend
 *   node scripts/check-react-hooks-rules.cjs --files a.tsx,b.tsx
 *
 * Exit: 0 clear · 1 a NEW violation · 2 harness error.
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(REPO_ROOT, 'frontend');
const RULE = 'react-hooks/rules-of-hooks';

/**
 * The KNOWN violations, pinned by file. Both predate this gate.
 *
 * ⛔ Adding an entry here is a DECISION and needs a reason on the line. Removing one
 * because it was fixed is always correct and needs nothing.
 */
const BASELINE = {
  // Two `useState` calls below an early return. Pre-existing at the gate's introduction
  // (2026-09-15); ToolCallPanel.tsx is a G-5 DISCHARGED file (51 commits / 23 phases) and
  // untangling them is a change to live chat rendering, not a lint cleanup.
  'src/components/chat/ToolCallPanel.tsx': 2,
};

function fail(msg) {
  console.error(`check-react-hooks-rules: ${msg}`);
  process.exit(2);
}

function run(args) {
  try {
    return execFileSync('npx', args, {
      cwd: FRONTEND,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === 'win32',
    });
  } catch (e) {
    // eslint exits non-zero when it reports problems — that is the normal path.
    if (typeof e.stdout === 'string' && e.stdout.trim()) return e.stdout;
    fail(`eslint could not be run: ${e.message}`);
  }
}

function main() {
  if (!fs.existsSync(path.join(FRONTEND, 'eslint.config.js'))) {
    fail('frontend/eslint.config.js not found');
  }

  const argv = process.argv.slice(2);
  let targets = ['src'];
  const filesArg = argv.find((a) => a.startsWith('--files='));
  if (filesArg) {
    targets = filesArg
      .slice('--files='.length)
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)
      // accept repo-relative paths as well as frontend-relative ones
      .map((f) => f.replace(/^frontend[\/]/, ''))
      .filter((f) => /\.(ts|tsx|js|jsx)$/.test(f))
      .filter((f) => fs.existsSync(path.join(FRONTEND, f)));
    if (targets.length === 0) {
      console.log('check-react-hooks-rules: no lintable files in --files — nothing to do.');
      process.exit(0);
    }
  }

  const out = run([
    'eslint',
    ...targets,
    '--format=json',
    // Only this rule decides the exit code. Everything else in the config still
    // PARSES the file (the rule needs the same AST), it just cannot fail the gate.
    '--rule',
    `{"${RULE}":"error"}`,
  ]);

  let report;
  try {
    report = JSON.parse(out.slice(out.indexOf('[')));
  } catch {
    fail('could not parse the eslint JSON report');
  }

  const found = {};
  const detail = [];
  for (const file of report) {
    for (const m of file.messages || []) {
      if (m.ruleId !== RULE) continue;
      const rel = path
        .relative(FRONTEND, file.filePath)
        .split(path.sep)
        .join('/');
      found[rel] = (found[rel] || 0) + 1;
      detail.push(`  ${rel}:${m.line}:${m.column}  ${m.message}`);
    }
  }

  const scoped = filesArg ? new Set(targets.map((t) => t.split(path.sep).join('/'))) : null;
  const offenders = [];
  for (const [file, count] of Object.entries(found)) {
    const allowed = BASELINE[file] || 0;
    if (count > allowed) offenders.push({ file, count, allowed });
  }

  // A full-tree run can also see a pin that is no longer needed. Report it — a stale
  // allowance is how a gate quietly stops gating — but never fail on it.
  const stale = [];
  if (!filesArg) {
    for (const [file, allowed] of Object.entries(BASELINE)) {
      const count = found[file] || 0;
      if (count < allowed) stale.push({ file, count, allowed });
    }
  }

  if (detail.length) {
    console.log(`${RULE} — ${detail.length} reported:`);
    for (const d of detail) console.log(d);
    console.log('');
  }

  for (const s of stale) {
    console.log(
      `NOTE  [stale-pin] ${s.file} is pinned at ${s.allowed} but reports ${s.count} — ` +
        'lower the BASELINE entry so the gate keeps its teeth.',
    );
  }

  if (offenders.length === 0) {
    console.log(
      `check-react-hooks-rules OK — no NEW ${RULE} violation` +
        (scoped ? ` in ${targets.length} file(s).` : '.'),
    );
    process.exit(0);
  }

  console.error('');
  console.error(`RESULT: ${RULE} VIOLATED`);
  for (const o of offenders) {
    console.error(
      `  FAIL  ${o.file} — ${o.count} violation(s), ${o.allowed} pinned.`,
    );
  }
  console.error('');
  console.error('  A conditional hook is not a style problem: React counts hooks per');
  console.error('  render, so one short-circuited call blanks the page. Unit tests cannot');
  console.error('  see it — a vi.fn() mock consumes no hook slot.');
  console.error('');
  console.error('  Call every hook unconditionally on its own line, then combine the');
  console.error('  VALUES:  const a = useA(id); const b = useB(id); const c = a || b');
  process.exit(1);
}

main();

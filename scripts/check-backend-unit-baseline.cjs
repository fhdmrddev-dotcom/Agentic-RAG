#!/usr/bin/env node
/**
 * check-backend-unit-baseline.cjs — backend unit test baseline gate (DEBT-05).
 *
 * WHY THIS EXISTS
 * ---------------
 * Milestone v4.0 (Phase 228) locks the backend unit testing gate against the
 * measured baseline. Historically, backend failures drifted unmeasured between
 * 62 and 95. The verified clean baseline at Milestone v4.0 entrance is:
 *   71 failed, 3497 passed, 2 xfailed, 2 xpassed (0 collection errors)
 *
 * This script runs the canonical backend unit test command:
 *   pytest tests/unit -q --continue-on-collection-errors
 * inside the backend virtual environment, parses the summary line, and enforces
 * that failures do not exceed the baseline of 71 (zero headroom).
 *
 * EXIT CODES
 *   0  baseline satisfied (failed <= 71 and 0 collection errors)
 *   1  baseline exceeded (failed > 71 or unexpected collection errors)
 *   2  harness error (pytest missing, cannot run)
 *
 * USAGE
 *   node scripts/check-backend-unit-baseline.cjs
 *   node scripts/check-backend-unit-baseline.cjs --json
 *   node scripts/check-backend-unit-baseline.cjs --quiet
 *   node scripts/check-backend-unit-baseline.cjs --max-failed 71
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');

const DEFAULT_BASELINE_FAILED = 71;

function parseArgs(args) {
  const options = {
    json: false,
    quiet: false,
    maxFailed: DEFAULT_BASELINE_FAILED,
    pytestArgs: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg === '--max-failed') {
      const val = parseInt(args[++i], 10);
      if (isNaN(val)) {
        console.error('Error: --max-failed requires an integer argument');
        process.exit(2);
      }
      options.maxFailed = val;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/check-backend-unit-baseline.cjs [options] [-- <pytest-args>]
Options:
  --json          Output results as JSON
  --quiet, -q     Quiet mode (do not stream test runner output)
  --max-failed N  Maximum allowed failing tests (default: ${DEFAULT_BASELINE_FAILED})
  --help, -h      Show this help message
`);
      process.exit(0);
    } else if (arg === '--') {
      options.pytestArgs.push(...args.slice(i + 1));
      break;
    } else {
      options.pytestArgs.push(arg);
    }
  }

  return options;
}

function resolvePytestBinary() {
  const isWin = process.platform === 'win32';
  const candidates = [
    path.join(BACKEND_DIR, 'venv', isWin ? 'Scripts/pytest.exe' : 'bin/pytest'),
    path.join(REPO_ROOT, 'venv', isWin ? 'Scripts/pytest.exe' : 'bin/pytest'),
    isWin ? 'pytest.exe' : 'pytest'
  ];

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return isWin ? 'pytest.exe' : 'pytest';
}

function parsePytestSummary(fullOutput) {
  const lines = fullOutput.split(/\r?\n/);
  let summaryLine = '';
  let collectionErrors = 0;

  for (const line of lines) {
    if (/ERROR collecting\b/.test(line)) {
      collectionErrors++;
    }
    // Pytest summary line example:
    // "71 failed, 3497 passed, 2 xfailed, 2 xpassed, 17 warnings in 77.75s"
    // or "= 71 failed, 3497 passed, ... ="
    if (/(?:failed|passed)/.test(line) && /in\s+[\d.]+s/.test(line)) {
      summaryLine = line.replace(/^=+\s*|\s*=+\s*$/g, '').trim();
    }
  }

  // If not matched with timing, search backwards for summary with passed/failed
  if (!summaryLine) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].replace(/^=+\s*|\s*=+\s*$/g, '').trim();
      if (/\b(?:\d+\s+failed|\d+\s+passed)\b/.test(line)) {
        summaryLine = line;
        break;
      }
    }
  }

  const failedMatch = summaryLine.match(/(\d+)\s+failed/);
  const passedMatch = summaryLine.match(/(\d+)\s+passed/);
  const errorMatch = summaryLine.match(/(\d+)\s+error(?:s)?\b/);
  const xfailedMatch = summaryLine.match(/(\d+)\s+xfailed/);
  const xpassedMatch = summaryLine.match(/(\d+)\s+xpassed/);
  const warningsMatch = summaryLine.match(/(\d+)\s+warning(?:s)?/);
  const durationMatch = summaryLine.match(/in\s+([\d.]+)s/);

  const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
  const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
  const errors = (errorMatch ? parseInt(errorMatch[1], 10) : 0) + collectionErrors;
  const xfailed = xfailedMatch ? parseInt(xfailedMatch[1], 10) : 0;
  const xpassed = xpassedMatch ? parseInt(xpassedMatch[1], 10) : 0;
  const warnings = warningsMatch ? parseInt(warningsMatch[1], 10) : 0;
  const duration = durationMatch ? parseFloat(durationMatch[1]) : null;

  return {
    summaryLine,
    failed,
    passed,
    errors,
    xfailed,
    xpassed,
    warnings,
    duration
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pytestBin = resolvePytestBinary();

  const pytestArgs = options.pytestArgs.length > 0
    ? options.pytestArgs
    : ['tests/unit', '-q', '--continue-on-collection-errors'];

  if (!options.quiet && !options.json) {
    console.log(`[check-backend-unit-baseline] Running: ${pytestBin} ${pytestArgs.join(' ')}`);
    console.log(`[check-backend-unit-baseline] Working directory: ${BACKEND_DIR}`);
    console.log(`[check-backend-unit-baseline] Baseline limit: failed <= ${options.maxFailed}, errors == 0\n`);
  }

  let fullOutput = '';

  const child = spawn(pytestBin, pytestArgs, {
    cwd: BACKEND_DIR,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false
  });

  child.stdout.on('data', (chunk) => {
    const str = chunk.toString();
    fullOutput += str;
    if (!options.quiet && !options.json) {
      process.stdout.write(str);
    }
  });

  child.stderr.on('data', (chunk) => {
    const str = chunk.toString();
    fullOutput += str;
    if (!options.quiet && !options.json) {
      process.stderr.write(str);
    }
  });

  child.on('error', (err) => {
    console.error(`[check-backend-unit-baseline] Failed to execute ${pytestBin}: ${err.message}`);
    process.exit(2);
  });

  child.on('close', (exitCode) => {
    const parsed = parsePytestSummary(fullOutput);

    const passedBaseline = parsed.failed <= options.maxFailed && parsed.errors === 0;

    const result = {
      ok: passedBaseline,
      exitCode,
      baselineLimit: options.maxFailed,
      failed: parsed.failed,
      passed: parsed.passed,
      errors: parsed.errors,
      xfailed: parsed.xfailed,
      xpassed: parsed.xpassed,
      warnings: parsed.warnings,
      duration: parsed.duration,
      summary: parsed.summaryLine
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(passedBaseline ? 0 : 1);
    }

    console.log('\n============================================================');
    console.log('Backend Unit Test Baseline Verdict');
    console.log('============================================================');
    console.log(`Summary:        ${parsed.summaryLine || 'No summary line detected'}`);
    console.log(`Failed tests:   ${parsed.failed} (allowed ceiling: <= ${options.maxFailed})`);
    console.log(`Passed tests:   ${parsed.passed}`);
    console.log(`Errors:         ${parsed.errors} (allowed: 0)`);
    if (parsed.duration) {
      console.log(`Duration:       ${parsed.duration}s`);
    }

    if (!passedBaseline) {
      if (parsed.failed > options.maxFailed) {
        console.error(`\n[GATE FAILED] Failed test count (${parsed.failed}) exceeds baseline ceiling (${options.maxFailed}).`);
        console.error(`Milestone v4.0 baseline strictly forbids new backend test regressions (zero headroom).`);
      }
      if (parsed.errors > 0) {
        console.error(`\n[GATE FAILED] Collection or execution errors detected: ${parsed.errors}. Must be 0.`);
      }
      process.exit(1);
    }

    console.log(`\n[GATE PASSED] Backend unit baseline satisfied (failed: ${parsed.failed} <= ${options.maxFailed}, errors: 0).`);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[check-backend-unit-baseline] Uncaught error:', err);
  process.exit(2);
});

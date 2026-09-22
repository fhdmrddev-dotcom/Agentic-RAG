#!/usr/bin/env node
'use strict';
/**
 * check-extension-contract.cjs — EXT-02 Mechanical Guard.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Extension Contract (Phase 255 / SEED-291) establishes that:
 *   "A plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE. Never engine code."
 *
 * The closed core (workflow executors, emitters, validators, programmatic functions, agent tools)
 * IS the graded-governance product claim. A claim about what is structurally impossible survives
 * zero exceptions.
 *
 * This mechanical guard inspects the six trigger files named in SEED-291 and asserts that:
 *   1. No dynamic code execution primitives exist (importlib, eval, exec, __import__).
 *   2. Registries remain closed dictionaries and are never populated from dynamic data/DB/inputs.
 *   3. No dynamic callable dispatch (e.g. getattr callable invocation) exists.
 *   4. No unauthorized registry mutations or dynamic plugin registrars exist.
 *
 * TRIGGER PATHS AUDITED (SEED-291)
 * --------------------------------
 *   1. backend/app/services/harness/phase_types.py
 *   2. backend/app/services/harness/validator_kinds.py
 *   3. backend/app/services/harness/emitters.py
 *   4. backend/app/services/harness/programmatic.py
 *   5. backend/app/services/tool_dispatcher.py
 *   6. backend/app/services/agent_loop.py
 *
 * EXIT
 *   0 = clean (closed core intact)
 *   1 = extension contract violation detected
 *   2 = harness error (missing file / unreadable)
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const TRIGGER_PATHS = [
  'backend/app/services/harness/phase_types.py',
  'backend/app/services/harness/validator_kinds.py',
  'backend/app/services/harness/emitters.py',
  'backend/app/services/harness/programmatic.py',
  'backend/app/services/tool_dispatcher.py',
  'backend/app/services/agent_loop.py',
];

// Explicitly approved registry assignment sites (file-relative canonical lines):
const APPROVED_REGISTRY_ASSIGNMENTS = [
  'PROGRAMMATIC_PHASE_REGISTRY[name] = fn',
  'EMITTER_REGISTRY[name] = entry',
  'PROGRAMMATIC_VALIDATOR_REGISTRY[name] = fn',
  'VALIDATOR_REGISTRY[name] = fn',
];

// Patterns that indicate forbidden dynamic execution primitives:
const FORBIDDEN_PRIMITIVES = [
  { re: /\bimportlib\b/, reason: 'importlib dynamic module loading is forbidden in closed core' },
  { re: /\beval\s*\(/, reason: 'eval() dynamic code execution is forbidden in closed core' },
  { re: /(?<!a)exec\s*\(/, reason: 'exec() dynamic code execution is forbidden in closed core' },
  { re: /\b__import__\s*\(/, reason: '__import__() dynamic module loading is forbidden in closed core' },
];

// Patterns indicating dynamic callable dispatch or dynamic plugin registration:
const FORBIDDEN_DYNAMIC_PATTERNS = [
  {
    re: /getattr\s*\([^)]+\)\s*\(/,
    reason: 'Dynamic getattr() callable invocation is forbidden in closed core dispatch',
  },
  {
    re: /def\s+register_(?:custom_|external_|dynamic_|plugin_|executor|tool|validator)/i,
    reason: 'Dynamic plugin/tool/executor registration functions are forbidden in closed core',
  },
  {
    re: /_TOOL_REGISTRY\[[^\]]+\]\s*=/,
    reason: 'Direct modification of _TOOL_REGISTRY outside static manifest is forbidden',
  },
  {
    re: /PHASE_TYPE_REGISTRY(?:_ENTRIES)?\[[^\]]+\]\s*=/,
    reason: 'Direct modification of PHASE_TYPE_REGISTRY outside static manifest is forbidden',
  },
  {
    re: /PROGRAMMATIC_PHASE_REGISTRY\[[^\]]+\]\s*=/,
    reason: 'Direct modification of PROGRAMMATIC_PHASE_REGISTRY is forbidden',
  },
  {
    re: /EMITTER_REGISTRY\[[^\]]+\]\s*=/,
    reason: 'Direct modification of EMITTER_REGISTRY is forbidden',
  },
  {
    re: /VALIDATOR_REGISTRY\[[^\]]+\]\s*=/,
    reason: 'Direct modification of VALIDATOR_REGISTRY is forbidden',
  },
];

function checkFile(relPath) {
  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) {
    return [{ file: relPath, line: 0, reason: `File not found: ${relPath}` }];
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const line = lines[idx];

    // Strip comments and normalize whitespace
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    const codePart = line.split('#')[0].trim();
    if (!codePart) continue;

    // Check dynamic code execution primitives
    for (const rule of FORBIDDEN_PRIMITIVES) {
      if (rule.re.test(codePart)) {
        violations.push({
          file: relPath,
          line: lineNum,
          code: trimmed,
          reason: rule.reason,
        });
      }
    }

    // Check dynamic patterns
    for (const rule of FORBIDDEN_DYNAMIC_PATTERNS) {
      if (rule.re.test(codePart)) {
        // Allow approved canonical internal decorator assignments
        const isApproved = APPROVED_REGISTRY_ASSIGNMENTS.some((approved) => codePart.includes(approved));
        if (!isApproved) {
          violations.push({
            file: relPath,
            line: lineNum,
            code: trimmed,
            reason: rule.reason,
          });
        }
      }
    }
  }

  return violations;
}

function main() {
  const args = process.argv.slice(2);
  let filesToCheck = TRIGGER_PATHS;

  if (args.includes('--files')) {
    const fileIdx = args.indexOf('--files');
    const specificFiles = args.slice(fileIdx + 1);
    if (specificFiles.length > 0) {
      filesToCheck = specificFiles.map((f) => f.replace(/\\/g, '/')).filter((f) => TRIGGER_PATHS.includes(f));
    }
  }

  if (filesToCheck.length === 0) {
    console.log('check-extension-contract: no watched closed-core files in scope.');
    process.exit(0);
  }

  console.log(`check-extension-contract: auditing ${filesToCheck.length} closed-core trigger file(s)...`);
  let totalViolations = [];

  for (const file of filesToCheck) {
    const fileViolations = checkFile(file);
    if (fileViolations.length > 0) {
      totalViolations = totalViolations.concat(fileViolations);
    }
  }

  if (totalViolations.length > 0) {
    console.error('\n⛔ EXTENSION CONTRACT VIOLATION: The closed core has been compromised!\n');
    for (const v of totalViolations) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    Violation: ${v.reason}`);
      if (v.code) console.error(`    Code:      ${v.code}`);
      console.error('');
    }
    console.error('Contract Rule: A plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE. Never engine code.');
    console.error('See docs/EXTENSION-CONTRACT.md for details.');
    process.exit(1);
  }

  console.log(`extension contract gate OK — all ${filesToCheck.length} files conform to closed-core contract (0 violations).`);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, TRIGGER_PATHS, main };

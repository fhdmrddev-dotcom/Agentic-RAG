#!/usr/bin/env node
'use strict';
/**
 * check-schema-acl-parity.cjs — the ACL-mirror class, given teeth.
 *
 * WHY THIS EXISTS
 * ---------------
 * `scripts/regenerate-full-schema.sh` dumps the schema with `pg_dump --no-privileges`
 * (line 104). A dump therefore CAN NEVER CARRY A GRANT. Every migration that narrows a
 * privilege is invisible to `supabase/full-schema.sql` unless a human mirrors it by hand
 * into `scripts/full-schema-supplement.sql`, which is the one artifact appended to the dump.
 *
 * ⛔ THAT HAND-MIRROR HAS FAILED THREE TIMES, WITH THE INSTRUCTION IN PLAIN SIGHT:
 *   · migration 118 (a column grant) shipped the class first;
 *   · `supabase/full-schema.sql` §5 writes the failure down VERBATIM, in the artifact itself;
 *   · the supplement's own MAINTENANCE header tells maintainers to mirror ACLs;
 *   · migration 181 (EXECUTE on 13 SECURITY DEFINER functions, CRED-03) reproduced it anyway —
 *     a greenfield project bootstrapped from full-schema.sql alone shipped all 13 with the
 *     default PUBLIC EXECUTE grant, anon-executable over PostgREST, which is exactly the
 *     advisor finding 181 exists to close.
 *
 * A prose instruction is what did not work twice. This gate cannot not-notice: it FAILS when
 * any migration grants or revokes EXECUTE on a function the supplement does not mirror.
 *
 * ⚠ WHAT IT DOES NOT DO. It compares TEXT, not a live database. It cannot tell you that a
 *   mirrored statement is semantically right — only that the function is not MISSING from the
 *   bootstrap artifact. Ordering (PUBLIC before anon) is asserted by the plan's own checks and
 *   stated in the supplement's §6 header, not here.
 *
 * USAGE
 *   node scripts/check-schema-acl-parity.cjs              # scan mode
 *   node scripts/check-schema-acl-parity.cjs --self-test  # drive BOTH RED arms + the count assertion
 *
 * EXIT  0 = clear · 1 = violation (a function ACL is not mirrored) · 2 = harness error
 *
 * Zero dependencies — `fs`, `path`, `os` are Node built-ins, exactly as the sibling gates
 * (`check-hot-file-ledger.cjs`, `check-seeds-register.cjs`) are.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(root, 'supabase', 'migrations');
const SUPPLEMENT = path.join(root, 'scripts', 'full-schema-supplement.sql');

const RED = '\x1b[31m';
const YEL = '\x1b[33m';
const GRN = '\x1b[32m';
const RST = '\x1b[0m';

/**
 * Non-vacuity floor. A FLOOR, never an exact figure — the gate must survive new migrations but
 * not a collapsed scan.
 *
 * ⚠ MEASURED, NOT ASSUMED: `ls supabase/migrations | grep -cE '^[0-9]+_.*\.sql$'` = **148** at
 *   2026-09-16. The plan that commissioned this gate proposed 150, which is ABOVE the real count
 *   and would have made the gate exit 2 on every run — a gate that can only fail is as useless as
 *   one that can only pass. 120 leaves headroom under the true count and still catches a
 *   directory that has collapsed to a handful of files.
 */
const MIN_MIGRATION_FILES = 120;

/** Phase 242 measured a sibling gate exiting 0 over ZERO parsed files, twice. */
class VacuousScanError extends Error {}

function fail(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(2);
}

/**
 * Canonical key for a function identity.
 *
 * ⛔ IT MUST NOT DROP THE ARGUMENT LIST. `REVOKE … ON FUNCTION f(uuid, text)` does not affect
 *    `f(uuid)` — an argument list is part of a function's identity in Postgres. A normaliser that
 *    collapsed the two would make this gate pass over a real gap, which is the failure mode it
 *    exists to prevent.
 *
 * Unqualified names are read as `public.` — migration 012 writes
 * `GRANT EXECUTE ON FUNCTION query_user_documents(text) …` with no schema, relying on search_path.
 */
function normaliseSignature(raw) {
  let s = String(raw).trim();
  s = s.replace(/\s+(?:FROM|TO)\s+[\s\S]*$/i, '');   // drop a trailing grantee clause
  s = s.replace(/;\s*$/, '').trim();

  const open = s.indexOf('(');
  const close = s.lastIndexOf(')');
  if (open === -1 || close === -1 || close < open) {
    const bare = s.toLowerCase();
    return bare.includes('.') ? bare : `public.${bare}`;
  }
  let name = s.slice(0, open).trim().toLowerCase().replace(/\s+/g, '');
  if (!name.includes('.')) name = `public.${name}`;
  const args = s
    .slice(open + 1, close)
    .split(',')
    .map((a) => a.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter((a) => a.length > 0);
  return `${name}(${args.join(', ')})`;
}

/**
 * Strip SQL line comments, then split into statements.
 *
 * ⛔ COMMENTS MUST GO FIRST. Migration 181's tail carries an entirely-commented VERIFY block that
 *    quotes function names; counting those would inflate the expected set and make this gate fail
 *    against a CORRECT supplement — a false red is how a guard gets switched off.
 */
function statements(sql) {
  const stripped = sql
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
  return stripped.split(';');
}

const ACL_RE = /^\s*(REVOKE|GRANT)\s+EXECUTE\s+ON\s+FUNCTION\s+([\s\S]+?)\s+(?:FROM|TO)\s+([\s\S]+)$/i;

/** Every `{ signature, file }` a chunk of SQL grants or revokes EXECUTE on. */
function aclsIn(sql, file) {
  const out = [];
  for (const chunk of statements(sql)) {
    const m = ACL_RE.exec(chunk);
    if (!m) continue;
    out.push({ signature: normaliseSignature(m[2]), file });
  }
  return out;
}

/**
 * Scan the migrations directory.
 *
 * `migrationCount` is the FILTERED `readdirSync` length and is the ONLY authority for how many
 * files were read. ⛔ A hardcoded expected total anywhere outside a comment is a defect.
 */
function scanMigrations(dir, minFiles) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    throw new VacuousScanError(`cannot read the migrations directory ${dir} (${e.code || e.message})`);
  }
  const files = names.filter((n) => /^\d+_.*\.sql$/.test(n)).sort();
  const migrationCount = files.length;
  if (migrationCount < minFiles) {
    throw new VacuousScanError(
      `only ${migrationCount} migration file(s) matched in ${dir}, below the floor of ${minFiles} — `
      + 'refusing to report a verdict over a collapsed scan set. '
      + 'A gate that passes over nothing is worse than absent.',
    );
  }
  const acls = [];
  for (const f of files) {
    acls.push(...aclsIn(fs.readFileSync(path.join(dir, f), 'utf8'), `migrations/${f}`));
  }
  return { migrationCount, acls };
}

/** The supplement's mirrored signature set. */
function scanSupplement(file) {
  let sql;
  try {
    sql = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new VacuousScanError(`cannot read the supplement ${file} (${e.code || e.message})`);
  }
  return new Set(aclsIn(sql, file).map((a) => a.signature));
}

/** The pure analysis — one implementation, driven by BOTH the CLI and `--self-test`. */
function analyse({ migrationsDir, supplementPath, minFiles = MIN_MIGRATION_FILES }) {
  const { migrationCount, acls } = scanMigrations(migrationsDir, minFiles);
  const mirroredSet = scanSupplement(supplementPath);

  const expected = new Map();          // signature -> Set<file>
  for (const { signature, file } of acls) {
    if (!expected.has(signature)) expected.set(signature, new Set());
    expected.get(signature).add(file);
  }
  const missing = [...expected.keys()].filter((s) => !mirroredSet.has(s)).sort();
  const mirrored = [...expected.keys()].filter((s) => mirroredSet.has(s)).sort();

  return { migrationCount, expected, missing, mirrored, statementCount: acls.length };
}

/** Print the verdict and return the exit code. `log` is injectable so --self-test can read it. */
function report(result, log = console.log) {
  const { migrationCount, expected, missing, mirrored, statementCount } = result;
  log(
    `schema ACL parity — migrations scanned: ${migrationCount}`
    + ` · function ACLs found: ${expected.size}`
    + ` · mirrored: ${mirrored.length}`
    + ` (${statementCount} GRANT/REVOKE statements)`,
  );

  if (!missing.length) {
    log(`${GRN}schema ACL parity OK${RST} — every function ACL in supabase/migrations/ is mirrored in the supplement.`);
    return 0;
  }

  log(`\n${RED}${missing.length} FUNCTION ACL(S) ARE NOT MIRRORED${RST} — a greenfield bootstrap does not carry them:`);
  for (const sig of missing) {
    const where = [...expected.get(sig)].sort().join(', ');
    log(`  [not-mirrored]  ${sig}  ${YEL}—${RST} ${where} grants/revokes it; the supplement does not`);
  }
  log(`
⛔ pg_dump runs with --no-privileges, so supabase/full-schema.sql carries NO function ACL of its
   own. A privilege these migrations narrow is therefore ABSENT from every greenfield bootstrap —
   silently, and in the permissive direction.

   Mirror each signature above into scripts/full-schema-supplement.sql § 6, copying the statements
   from the migration rather than retyping them (an argument list is part of a function's
   identity), and apply the SAME text to supabase/full-schema.sql's tail in the SAME COMMIT.
   ⚠ REVOKE … FROM PUBLIC must precede REVOKE … FROM anon: anon inherits from PUBLIC, so the
     role-level revoke changes nothing while the PUBLIC grant stands (measured in migration 177).`);
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// --self-test — both RED arms, the counterfactual, the count assertion, and the normaliser
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Reject a fixture path inside a reload-watched tree (the repo's no-scratch rule). */
function assertOutsideWatchedTree(resolved) {
  for (const [label, dir] of [['frontend/', path.join(root, 'frontend')], ['backend/', path.join(root, 'backend')], ['the repo', root]]) {
    if (resolved === dir || resolved.startsWith(dir + path.sep)) {
      fail(`refusing to build the self-test fixture inside ${label} (${resolved}).`);
    }
  }
}

const FIXTURE_MIGRATION = `-- 999: fixture
BEGIN;
REVOKE EXECUTE ON FUNCTION public.alpha() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.alpha() FROM anon;
GRANT  EXECUTE ON FUNCTION public.alpha() TO service_role;

REVOKE EXECUTE ON FUNCTION public.beta(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.beta(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.gamma(uuid) FROM PUBLIC;
COMMIT;

-- VERIFY (entirely commented — must NOT be counted):
--   REVOKE EXECUTE ON FUNCTION public.never_real() FROM PUBLIC;
`;

const FIXTURE_SUPPLEMENT_COMPLETE = `-- fixture supplement
REVOKE EXECUTE ON FUNCTION public.alpha() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.alpha() FROM anon;
GRANT  EXECUTE ON FUNCTION public.alpha() TO service_role;
REVOKE EXECUTE ON FUNCTION public.beta( uuid ,text ) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION PUBLIC.BETA(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.gamma(uuid) FROM PUBLIC;
`;

/** Same file with every `alpha` line removed — the planted omission. */
const FIXTURE_SUPPLEMENT_MISSING_ONE = FIXTURE_SUPPLEMENT_COMPLETE
  .split('\n')
  .filter((l) => !l.includes('public.alpha'))
  .join('\n');

function runSelfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acl-parity-selftest-'));
  assertOutsideWatchedTree(path.resolve(tmp));

  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`  ${ok ? `${GRN}PASS${RST}` : `${RED}FAIL${RST}`}  ${name}${detail ? `  — ${detail}` : ''}`);
  };

  try {
    const migDir = path.join(tmp, 'migrations');
    fs.mkdirSync(migDir);
    // Pad to the REAL floor so the fixture exercises the shipped constant, not a stand-in.
    for (let i = 1; i <= MIN_MIGRATION_FILES; i += 1) {
      fs.writeFileSync(path.join(migDir, `${String(i).padStart(3, '0')}_pad.sql`), '-- pad\n');
    }
    fs.writeFileSync(path.join(migDir, '999_fixture_acl.sql'), FIXTURE_MIGRATION);

    const supComplete = path.join(tmp, 'supplement-complete.sql');
    const supMissing = path.join(tmp, 'supplement-missing-alpha.sql');
    fs.writeFileSync(supComplete, FIXTURE_SUPPLEMENT_COMPLETE);
    fs.writeFileSync(supMissing, FIXTURE_SUPPLEMENT_MISSING_ONE);

    console.log('self-test — driving the gate against a temp fixture:\n');

    // ── normaliser unit arm ─────────────────────────────────────────────────────────────────
    const a = normaliseSignature('public.f( uuid ,text )');
    const b = normaliseSignature('PUBLIC.F(uuid, text)');
    const c = normaliseSignature('public.f(uuid)');
    check('normaliser: whitespace and case collapse', a === 'public.f(uuid, text)' && b === a, `${a} / ${b}`);
    check('normaliser: the ARGUMENT LIST is identity', c === 'public.f(uuid)' && c !== a, `${c} !== ${a}`);
    check('normaliser: an unqualified name reads as public.', normaliseSignature('query_user_documents(text)') === 'public.query_user_documents(text)');

    // ── GREEN arm ───────────────────────────────────────────────────────────────────────────
    const greenLines = [];
    const greenRes = analyse({ migrationsDir: migDir, supplementPath: supComplete });
    const greenCode = report(greenRes, (l) => greenLines.push(l));
    check('GREEN: a complete supplement exits 0', greenCode === 0, `exit=${greenCode}, found=${greenRes.expected.size}`);
    check('GREEN: the commented VERIFY block is NOT counted',
      !greenRes.expected.has('public.never_real()'),
      `found ${[...greenRes.expected.keys()].join(', ')}`);

    // ── RED arm 1 + the counterfactual ──────────────────────────────────────────────────────
    const redLines = [];
    const redRes = analyse({ migrationsDir: migDir, supplementPath: supMissing });
    const redCode = report(redRes, (l) => redLines.push(l));
    const redOut = redLines.join('\n');
    check('RED arm 1: a planted omission exits 1', redCode === 1, `exit=${redCode}`);
    check('RED arm 1: the failure NAMES the missing signature', redOut.includes('public.alpha()'));
    check('RED arm 1: the failure names the migration file', redOut.includes('999_fixture_acl.sql'));
    check('RED arm 2 (COUNTERFACTUAL): a MIRRORED signature is ABSENT from the failure output',
      !redOut.includes('public.beta(uuid, text)') && !redOut.includes('public.gamma(uuid)'),
      'the gate does not print everything it knows');

    // ── count assertion ─────────────────────────────────────────────────────────────────────
    const emptyDir = path.join(tmp, 'empty-migrations');
    fs.mkdirSync(emptyDir);
    let threw = null;
    try {
      analyse({ migrationsDir: emptyDir, supplementPath: supComplete });
    } catch (e) {
      threw = e;
    }
    check('COUNT: a collapsed scan set is a harness error, never a pass',
      threw instanceof VacuousScanError && threw.message.includes(String(MIN_MIGRATION_FILES)),
      threw ? threw.message.split('—')[0].trim() : 'nothing was thrown');

    const failed = results.filter((r) => !r.ok);
    console.log('');
    if (failed.length) {
      console.log(`${RED}self-test FAILED${RST} — ${failed.length}/${results.length} assertion(s) did not hold.`);
      return 1;
    }
    console.log(`${GRN}self-test OK${RST} — ${results.length}/${results.length} assertions: both RED arms fired, the counterfactual held, the count assertion refused a collapsed set.`);
    return 0;
  } finally {
    // Non-recursive-safe cleanup of a directory this process created, outside the watched tree.
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch { /* a leftover temp dir is harmless; a failed self-test is not */ }
  }
}

function main() {
  const argv = process.argv.slice(2);
  const unknown = argv.filter((a) => a !== '--self-test');
  if (unknown.length) fail(`unknown argument(s): ${unknown.join(' ')}. usage: check-schema-acl-parity.cjs [--self-test]`);

  if (argv.includes('--self-test')) return runSelfTest();

  return report(analyse({ migrationsDir: MIGRATIONS_DIR, supplementPath: SUPPLEMENT }));
}

module.exports = { normaliseSignature, aclsIn, analyse, report, MIN_MIGRATION_FILES };

if (require.main === module) {
  try {
    process.exit(main());
  } catch (e) {
    // ⛔ An uncaught throw becomes exit 2 (harness error), never Node's default 1 (violation).
    fail(e && e.stack ? e.stack : String(e));
  }
}

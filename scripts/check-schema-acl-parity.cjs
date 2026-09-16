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
 * A prose instruction is what did not work twice. This gate cannot not-notice.
 *
 * ⛔ AND THEN THE GATE ITSELF WAS DRIVEN, AND COULD NOT FAIL. Phase 252's review
 *    (`252-REVIEW.md`) found three structural defects, each REPRODUCED on this repo at
 *    plan 253-02's base before any of it was rewritten:
 *
 *   · CR-02 — `analyse()` keyed `expected` on the SIGNATURE ALONE and `aclsIn` threw the
 *     verb and the grantee away. Deleting the single line
 *     `REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;`
 *     from a copy of the supplement printed `missing: 0` and exited 0 — because the three
 *     SIBLING statements on the same function kept the signature in the mirrored set.
 *     `resize_embedding_column` is the RPC `BUG-260911-01` found callable UNAUTHENTICATED in
 *     production; it NULLs every vector in `document_chunks` and `skill_embeddings`.
 *     FIX: the key is now `verb | signature | grantee`, one entry per grantee.
 *
 *   · CR-03 — `statements()` truncated every line at the first `--`, including a `--` INSIDE
 *     a string literal, which ate the literal's closing quote and semicolon and misaligned
 *     every boundary after it. Live, not hypothetical: migration 180's three
 *     `COMMENT ON COLUMN` statements collapse into ONE chunk under the old splitter.
 *     FIX: a single-pass lexer that tracks single-quoted literals (with the doubled-quote
 *     escape), double-quoted identifiers, dollar-quoted bodies and block comments.
 *
 *   · CR-01 — the gate saw EXECUTE-ON-FUNCTION and nothing else, so the supplement's own
 *     §6 header claim of "table OR function" was aspirational. Measured: the shipped
 *     `aclsIn` returned ZERO table/column entries across the twelve ACL-bearing migrations,
 *     which carry 32 such statements between them.
 *     FIX: a second regex and a `(table, grantee, verb, column)` tuple compared BESIDE the
 *     function tuples in the same maps.
 *
 * ⚠ WHAT THIS GATE CHECKS, AND WHAT IT DOES NOT. Stated here, in the failure text and in the
 *   supplement's §6 header — all three — because a guard whose prose claims more than its
 *   code is precisely the defect CR-01 is.
 *
 *   CHECKS   · it compares TEXT, not a live database: that every
 *              `verb | signature | grantee` function tuple and every
 *              `verb | table | privilege | column | grantee` table tuple appearing in
 *              `supabase/migrations/` ALSO appears in the supplement.
 *   DOES NOT · ORDERING. That `REVOKE … FROM PUBLIC` precedes `REVOKE … FROM anon` is NOT
 *              asserted here — out of scope BY DECISION (D-13), not by oversight.
 *              Re-open trigger: the next migration that revokes a role privilege without
 *              revoking PUBLIC first (the migration 181 Group B class).
 *   DOES NOT · REVERSE DRIFT. A supplement that GRANTS something the migrations REVOKE — a
 *              bootstrap MORE permissive than the migration history — is NOT detected.
 *              Out of scope BY DECISION (D-13). Re-open trigger: any phase that edits the
 *              supplement's grants by hand.
 *   DOES NOT · semantics. It cannot tell you a mirrored statement is RIGHT, only that the
 *              tuple is not MISSING from the bootstrap artifact.
 *
 * USAGE
 *   node scripts/check-schema-acl-parity.cjs              # scan mode
 *   node scripts/check-schema-acl-parity.cjs --self-test  # drive every RED arm + the counterfactual
 *
 * EXIT  0 = clear · 1 = violation (an ACL tuple is not mirrored) · 2 = harness error
 *
 * Zero dependencies — `fs`, `path`, `os` are Node built-ins, exactly as the sibling gates
 * (`check-hot-file-ledger.cjs`, `check-seeds-register.cjs`) are.
 *
 * INVOKED BY (MC-4 — for its entire life before Phase 253 this gate was invoked by NOTHING:
 * no hook, no CI job, no npm script. A gate nobody runs cannot fail either way.)
 *   · `.claude/hooks/schema-acl-parity-guard.js`  — PostToolUse, the PRIMARY half
 *   · `.github/workflows/schema-acl-parity.yml`   — CI, the backstop
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
 * Split SQL into statements, stripping comments — with a lexer that knows what a string is.
 *
 * ⛔ COMMENTS MUST GO FIRST. Migration 181's tail carries an entirely-commented VERIFY block that
 *    quotes function names; counting those would inflate the expected set and make this gate fail
 *    against a CORRECT supplement — a false red is how a guard gets switched off.
 *
 * ⛔ AND A `--` INSIDE A STRING LITERAL IS NOT A COMMENT (CR-03). The previous implementation
 *    truncated each line at `line.indexOf('--')`, which on migration 180 line 30 ate the closing
 *    quote AND the semicolon of a live `COMMENT ON COLUMN … IS '… -- …';` statement. Measured
 *    consequence: the file's THREE `COMMENT ON COLUMN` statements collapsed into ONE chunk, so
 *    every boundary after that line was wrong and any ACL following such a comment was invisible.
 *    The cheaper "drop the ^\s* anchor and scan globally" patch was REJECTED as the sole remedy:
 *    it leaves a stripper that is still wrong about SQL, and the tuple comparison below depends on
 *    semicolon-splitting being meaningful.
 *
 * Tracks: single-quoted literals (doubled `''` is an escape, not a terminator), double-quoted
 * identifiers (`""` likewise), dollar-quoted bodies (`$$…$$` / `$tag$…$tag$`), line comments and
 * nested block comments. A `--` opens a comment, and a `;` ends a statement, ONLY at depth zero.
 *
 * ⛔ A carriage return is ordinary whitespace here and the input is NEVER rewritten — this gate
 *    only reads. `\r\n` and `\n` inputs therefore produce the same ACL tuples (pinned in
 *    --self-test), even though the raw chunk strings differ by the `\r` characters themselves.
 */
function statements(sql) {
  const src = String(sql);
  const n = src.length;
  const out = [];
  let buf = '';
  let i = 0;

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    // ── line comment ────────────────────────────────────────────────────────────────────────
    if (c === '-' && c2 === '-') {
      i += 2;
      while (i < n && src[i] !== '\n') i += 1;
      continue;                                  // the newline itself survives, as a separator
    }

    // ── block comment (Postgres nests them) ─────────────────────────────────────────────────
    if (c === '/' && c2 === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (src[i] === '/' && src[i + 1] === '*') { depth += 1; i += 2; continue; }
        if (src[i] === '*' && src[i + 1] === '/') { depth -= 1; i += 2; continue; }
        i += 1;
      }
      buf += ' ';                                // a comment separates tokens, it never glues them
      continue;
    }

    // ── single-quoted literal ───────────────────────────────────────────────────────────────
    if (c === "'") {
      buf += c;
      i += 1;
      while (i < n) {
        if (src[i] === "'" && src[i + 1] === "'") { buf += "''"; i += 2; continue; }
        if (src[i] === "'") { buf += "'"; i += 1; break; }
        buf += src[i];
        i += 1;
      }
      continue;
    }

    // ── double-quoted identifier ────────────────────────────────────────────────────────────
    if (c === '"') {
      buf += c;
      i += 1;
      while (i < n) {
        if (src[i] === '"' && src[i + 1] === '"') { buf += '""'; i += 2; continue; }
        if (src[i] === '"') { buf += '"'; i += 1; break; }
        buf += src[i];
        i += 1;
      }
      continue;
    }

    // ── dollar-quoted body; the tag may be empty ($$ … $$) ──────────────────────────────────
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(src.slice(i));
      if (m) {
        const tag = m[0];
        const end = src.indexOf(tag, i + tag.length);
        if (end === -1) { buf += src.slice(i); i = n; continue; }   // unterminated: keep it whole
        buf += src.slice(i, end + tag.length);
        i = end + tag.length;
        continue;
      }
      // a bare `$` (a `$1` placeholder, say) is an ordinary character — fall through
    }

    if (c === ';') { out.push(buf); buf = ''; i += 1; continue; }

    buf += c;
    i += 1;
  }

  out.push(buf);
  return out;
}

/**
 * The FUNCTION half. Unchanged in shape from the gate's first version except that the verb and
 * the grantee list are now KEPT rather than discarded (CR-02).
 */
const FUNC_ACL_RE = /^\s*(REVOKE|GRANT)\s+EXECUTE\s+ON\s+FUNCTION\s+([\s\S]+?)\s+(?:FROM|TO)\s+([\s\S]+)$/i;

/**
 * The TABLE / COLUMN half (CR-01).
 *
 * ⚠ IT MUST MATCH ACROSS NEWLINES — every real `GRANT SELECT ( … )` block in the migrations is
 *   multi-line (129:88-100, 156:28-40, 118:112-124 …), so a line-oriented regex would see none
 *   of them.
 *
 * The privilege section is required to START with a table privilege keyword. That single
 * constraint is what keeps `GRANT EXECUTE ON FUNCTION …` out of this half without a second
 * exclusion rule, and it also declines schema-wide forms (`GRANT USAGE ON SCHEMA …`,
 * `GRANT ALL ON ALL TABLES IN SCHEMA …`), which no migration in this repo uses. ⚠ If one ever
 * does, this regex will silently skip it — that limitation is written down rather than assumed
 * away, and the per-file statement counts printed by the verdict line are how it would be noticed.
 */
const TABLE_PRIV_WORDS = 'ALL|SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|MAINTAIN';
const IDENT = '(?:[A-Za-z_][A-Za-z0-9_$]*|"[^"]+")';
const TABLE_ACL_RE = new RegExp(
  `^\\s*(REVOKE|GRANT)\\s+((?:${TABLE_PRIV_WORDS})[\\s\\S]*?)\\s+ON\\s+(?:TABLE\\s+)?`
  + `(${IDENT}(?:\\s*\\.\\s*${IDENT})?)\\s+(?:FROM|TO)\\s+([\\s\\S]+)$`,
  'i',
);

/** `anon, authenticated ;` → `['anon', 'authenticated']`. One ENTRY is emitted per grantee. */
function granteeList(raw) {
  return String(raw)
    .replace(/;\s*$/, '')
    .replace(/\bWITH\s+GRANT\s+OPTION\b/gi, ' ')
    .replace(/\bGRANTED\s+BY\b[\s\S]*$/i, ' ')
    .replace(/\b(CASCADE|RESTRICT)\b/gi, ' ')
    .split(',')
    .map((g) => g.trim().replace(/^"(.*)"$/, '$1').toLowerCase())
    .filter((g) => g.length > 0);
}

/**
 * `SELECT ( a, b ), UPDATE (c)` → `[{priv:'SELECT',cols:['a','b']}, {priv:'UPDATE',cols:['c']}]`.
 * `ALL PRIVILEGES` collapses to `ALL` and stays ONE privilege — it is deliberately NOT expanded
 * into SELECT/INSERT/…, because `REVOKE ALL` and `REVOKE SELECT` are different statements and a
 * gate that expanded one into the other could not tell a reader which was written.
 */
function privilegeList(raw) {
  const out = [];
  const re = new RegExp(`(${TABLE_PRIV_WORDS})(?:\\s+PRIVILEGES)?\\s*(?:\\(([^)]*)\\))?`, 'gi');
  let m;
  while ((m = re.exec(String(raw))) !== null) {
    const priv = m[1].toUpperCase();
    const cols = m[2] === undefined
      ? []
      : m[2].split(',').map((c) => c.trim().replace(/^"(.*)"$/, '$1').toLowerCase()).filter(Boolean);
    out.push({ priv, cols });
  }
  return out;
}

/**
 * `  public . connector_connections ` → `public.connector_connections`.
 * ⚠ Only UNQUOTED parts are lower-cased: a quoted identifier is case-sensitive in Postgres, so
 *   folding `"MyTable"` would invent an identity the database does not have.
 */
function normaliseTable(raw) {
  const parts = String(raw).trim().split('.').map((p) => {
    const t = p.trim();
    return /^".*"$/.test(t) ? t.slice(1, -1) : t.toLowerCase();
  });
  return parts.length > 1 ? parts.join('.') : `public.${parts[0]}`;
}

/** The marker for a TABLE-LEVEL statement's empty column set. */
const TABLE_LEVEL = '<table-level>';

/**
 * Every ACL tuple a chunk of SQL grants or revokes.
 *
 * ⛔ ONE ENTRY PER GRANTEE, AND ONE PER COLUMN. `REVOKE … FROM anon, authenticated` is TWO facts
 *    and a partial mirror of it is exactly the gap CR-02 proved this gate could not see.
 *
 * ⚠ COLUMN GRANTS ARE KEYED PER COLUMN, NOT PER COLUMN-SET, and that is a measured decision
 *   rather than a convenience. The migrations grew `public.connector_connections`'s readable
 *   column set across SIX migrations (118, 126, 127, 128, 150, 156), each granting a DIFFERENT
 *   subset; the supplement mirrors the FINAL STATE as one 20-column block. Keying on the whole
 *   column-set therefore compares a history against a final state and reds against a CORRECT
 *   supplement. ⚠ MEASURED, not argued: the whole-set model was implemented over this very tree
 *   and produced **7 false "missing" tuples** — one per contributing migration — and for every
 *   one of them a per-column check found ZERO genuinely absent columns.
 *   Per-column keying is also strictly MORE sensitive: a supplement granting `(a)` where the
 *   migration granted `(a, b)` fails, and the failure NAMES `b`.
 *
 * ⛔ A table-level statement carries the distinguished empty column set `<table-level>`, so a
 *    table-level `REVOKE ALL` can never collapse into a column-level `REVOKE ALL (c)`.
 */
function aclsIn(sql, file) {
  const out = [];
  const chunks = statements(sql);
  for (let s = 0; s < chunks.length; s += 1) {
    const chunk = chunks[s];
    const stmtId = `${file}#${s}`;

    const fn = FUNC_ACL_RE.exec(chunk);
    if (fn) {
      const verb = fn[1].toUpperCase();
      const signature = normaliseSignature(fn[2]);
      for (const grantee of granteeList(fn[3])) {
        out.push({
          kind: 'function',
          key: `fn|${verb}|${signature}|${grantee}`,
          label: `${verb} EXECUTE ON FUNCTION ${signature} ${verb === 'GRANT' ? 'TO' : 'FROM'} ${grantee}`,
          verb,
          signature,
          grantee,
          file,
          stmtId,
        });
      }
      continue;                                  // a chunk is one statement; it is one or the other
    }

    const tb = TABLE_ACL_RE.exec(chunk);
    if (!tb) continue;
    const verb = tb[1].toUpperCase();
    const privs = privilegeList(tb[2]);
    if (!privs.length) continue;
    const table = normaliseTable(tb[3]);
    const grants = granteeList(tb[4]);
    for (const { priv, cols } of privs) {
      const columns = cols.length ? cols : [TABLE_LEVEL];
      for (const col of columns) {
        for (const grantee of grants) {
          const shown = col === TABLE_LEVEL ? '' : ` (${col})`;
          out.push({
            kind: 'table',
            key: `tbl|${verb}|${table}|${priv}|${col}|${grantee}`,
            label: `${verb} ${priv}${shown} ON ${table} ${verb === 'GRANT' ? 'TO' : 'FROM'} ${grantee}`,
            verb,
            table,
            priv,
            column: col,
            grantee,
            file,
            stmtId,
          });
        }
      }
    }
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

/** The supplement's mirrored tuple set. */
function scanSupplement(file) {
  let sql;
  try {
    sql = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new VacuousScanError(`cannot read the supplement ${file} (${e.code || e.message})`);
  }
  return new Set(aclsIn(sql, file).map((a) => a.key));
}

/** Distinct STATEMENTS (not tuples) of one kind, and the files they came from. */
function statementStats(acls, kind) {
  const stmts = new Set();
  const perFile = new Map();
  for (const a of acls) {
    if (a.kind !== kind) continue;
    if (stmts.has(a.stmtId)) continue;
    stmts.add(a.stmtId);
    const short = a.file.replace(/^migrations\//, '').replace(/_.*$/, '');
    perFile.set(short, (perFile.get(short) || 0) + 1);
  }
  return { statements: stmts.size, files: perFile.size, perFile };
}

/** The pure analysis — one implementation, driven by BOTH the CLI and `--self-test`. */
function analyse({ migrationsDir, supplementPath, minFiles = MIN_MIGRATION_FILES }) {
  const { migrationCount, acls } = scanMigrations(migrationsDir, minFiles);
  const mirroredSet = scanSupplement(supplementPath);

  const expected = new Map();          // key -> { label, kind, files: Set<file> }
  for (const a of acls) {
    if (!expected.has(a.key)) expected.set(a.key, { label: a.label, kind: a.kind, files: new Set() });
    expected.get(a.key).files.add(a.file);
  }
  const keys = [...expected.keys()].sort();
  const missing = keys.filter((k) => !mirroredSet.has(k));
  const mirrored = keys.filter((k) => mirroredSet.has(k));

  return {
    migrationCount,
    expected,
    missing,
    mirrored,
    fn: statementStats(acls, 'function'),
    tbl: statementStats(acls, 'table'),
  };
}

/** Print the verdict and return the exit code. `log` is injectable so --self-test can read it. */
function report(result, log = console.log) {
  const { migrationCount, expected, missing, mirrored, fn, tbl } = result;
  const fnTuples = [...expected.values()].filter((v) => v.kind === 'function').length;
  const tblTuples = [...expected.values()].filter((v) => v.kind === 'table').length;

  log(
    `schema ACL parity — migrations scanned: ${migrationCount}`
    + ` · FUNCTION: ${fn.statements} statement(s) in ${fn.files} file(s) → ${fnTuples} tuple(s)`
    + ` · TABLE/COLUMN: ${tbl.statements} statement(s) in ${tbl.files} file(s) → ${tblTuples} tuple(s)`
    + ` · mirrored: ${mirrored.length}/${expected.size}`,
  );
  if (tbl.perFile.size) {
    log(`  table/column statements per migration: ${[...tbl.perFile.entries()].sort().map(([f, c]) => `${f} (${c})`).join(' · ')}`);
  }

  if (!missing.length) {
    log(`${GRN}schema ACL parity OK${RST} — every function AND table/column ACL in supabase/migrations/ is mirrored in the supplement.`);
    return 0;
  }

  log(`\n${RED}${missing.length} ACL TUPLE(S) ARE NOT MIRRORED${RST} — a greenfield bootstrap does not carry them:`);
  for (const key of missing) {
    const { label, files } = expected.get(key);
    const where = [...files].sort().join(', ');
    log(`  [not-mirrored]  ${label}  ${YEL}—${RST} ${where} writes it; the supplement does not`);
  }
  log(`
⛔ pg_dump runs with --no-privileges, so supabase/full-schema.sql carries NO ACL of its own. A
   privilege these migrations narrow is therefore ABSENT from every greenfield bootstrap —
   silently, and in the permissive direction.

   Mirror each tuple above into scripts/full-schema-supplement.sql, copying the statements from
   the migration rather than retyping them (an argument list is part of a function's identity,
   and a column list is part of a column grant's), and apply the SAME text to
   supabase/full-schema.sql's tail in the SAME COMMIT.

⚠ WHAT THIS GATE DOES NOT CHECK — said here so this failure is not read as a clean bill of
   health on anything else:
     · ORDERING. That REVOKE … FROM PUBLIC precedes REVOKE … FROM anon is NOT asserted (D-13,
       a decision, not an oversight). It still MATTERS — anon inherits from PUBLIC, so the
       role-level revoke changes nothing while the PUBLIC grant stands (measured in migration
       177) — it is simply not checked here.
     · REVERSE DRIFT. A supplement MORE permissive than the migration history is NOT detected
       (D-13).`);
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// --self-test — every RED arm, the counterfactual, the count assertion, and the normaliser
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

/** Same file with every `alpha` line removed — the WHOLE-FUNCTION omission (the original arm). */
const FIXTURE_SUPPLEMENT_MISSING_ONE = FIXTURE_SUPPLEMENT_COMPLETE
  .split('\n')
  .filter((l) => !l.includes('public.alpha'))
  .join('\n');

/**
 * ⭐ ARM 1 — THE PARTIAL REVOKE. The single `FROM PUBLIC` line is deleted; the `FROM anon` revoke
 * and the `TO service_role` grant REMAIN. This is CR-02's proven defect in fixture form, and the
 * real-world instance it stands for is
 *   `REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;`
 * — deleting exactly that line from a copy of the real supplement printed `missing: 0` and exited
 * 0 on the gate as it shipped. `resize_embedding_column` NULLs every vector in the corpus and was
 * found callable unauthenticated in production (BUG-260911-01).
 */
const FIXTURE_SUPPLEMENT_PARTIAL_REVOKE = FIXTURE_SUPPLEMENT_COMPLETE
  .split('\n')
  .filter((l) => l.trim() !== 'REVOKE EXECUTE ON FUNCTION public.alpha() FROM PUBLIC;')
  .join('\n');

/** ⭐ ARM 2 — the comment-swallow, plus the dollar-quote and doubled-quote variants (CR-03). */
const FIXTURE_MIGRATION_COMMENTS = `-- 998: literal-aware lexing
COMMENT ON COLUMN public.t.c IS 'a value -- with a double dash inside the literal';
REVOKE EXECUTE ON FUNCTION public.danger(integer) FROM PUBLIC;

CREATE FUNCTION public.dollar_fn() RETURNS void AS $$
BEGIN
  -- this comment is INSIDE a dollar-quoted body
  RAISE NOTICE 'not -- a comment either';
END;
$$ LANGUAGE plpgsql;
REVOKE EXECUTE ON FUNCTION public.dollar_fn() FROM PUBLIC;

COMMENT ON COLUMN public.t.d IS 'it''s got a doubled quote -- and a dash';
REVOKE EXECUTE ON FUNCTION public.escaped(text) FROM PUBLIC;

-- VERIFY (entirely commented — must NOT be counted):
--   REVOKE EXECUTE ON FUNCTION public.never_real() FROM PUBLIC;
`;

/** ⭐ ARM 3 — table-level and column-level privileges (CR-01). */
const FIXTURE_MIGRATION_TABLES = `-- 997: table and column ACLs
REVOKE ALL ON TABLE public.widgets FROM anon, authenticated;
GRANT SELECT (
  a,
  b
) ON public.widgets TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.widgets TO service_role;
REVOKE ALL (secret) ON public.widgets FROM authenticated;
`;

/** Mirrors the GRANT but NOT the REVOKE — the planted table omission. */
const FIXTURE_SUPPLEMENT_TABLE_MISSING_REVOKE = `-- fixture supplement
GRANT SELECT ( a, b ) ON public.widgets TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.widgets TO service_role;
REVOKE ALL (secret) ON public.widgets FROM authenticated;
`;

/** Mirrors `(a)` where the migration granted `(a, b)` — the planted column-set omission. */
const FIXTURE_SUPPLEMENT_TABLE_NARROW_COLUMNS = `-- fixture supplement
REVOKE ALL ON TABLE public.widgets FROM anon, authenticated;
GRANT SELECT ( a ) ON public.widgets TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.widgets TO service_role;
REVOKE ALL (secret) ON public.widgets FROM authenticated;
`;

/** A correct mirror of FIXTURE_MIGRATION_TABLES — the table half's counterfactual. */
const FIXTURE_SUPPLEMENT_TABLE_COMPLETE = `-- fixture supplement
REVOKE ALL ON TABLE public.widgets FROM anon, authenticated;
GRANT SELECT ( b, a ) ON public.widgets TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.widgets TO service_role;
REVOKE ALL (secret) ON public.widgets FROM authenticated;
`;

function padToFloor(migDir) {
  // Pad to the REAL floor so the fixture exercises the shipped constant, not a stand-in.
  for (let i = 1; i <= MIN_MIGRATION_FILES; i += 1) {
    fs.writeFileSync(path.join(migDir, `${String(i).padStart(3, '0')}_pad.sql`), '-- pad\n');
  }
}

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
    padToFloor(migDir);
    fs.writeFileSync(path.join(migDir, '999_fixture_acl.sql'), FIXTURE_MIGRATION);

    const supComplete = path.join(tmp, 'supplement-complete.sql');
    const supMissing = path.join(tmp, 'supplement-missing-alpha.sql');
    const supPartial = path.join(tmp, 'supplement-partial-revoke.sql');
    fs.writeFileSync(supComplete, FIXTURE_SUPPLEMENT_COMPLETE);
    fs.writeFileSync(supMissing, FIXTURE_SUPPLEMENT_MISSING_ONE);
    fs.writeFileSync(supPartial, FIXTURE_SUPPLEMENT_PARTIAL_REVOKE);

    console.log('self-test — driving the gate against a temp fixture:\n');

    // ── normaliser unit arms (PRESERVED byte-unchanged) ──────────────────────────────────────
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
    check('GREEN: a complete supplement exits 0', greenCode === 0, `exit=${greenCode}, tuples=${greenRes.expected.size}`);
    check('GREEN: the commented VERIFY block is NOT counted',
      ![...greenRes.expected.values()].some((v) => v.label.includes('public.never_real()')),
      `found ${[...greenRes.expected.values()].map((v) => v.label).join(' · ')}`);

    // ── RED arm: the WHOLE-FUNCTION omission (the gate's original arm, preserved) ────────────
    const redLines = [];
    const redRes = analyse({ migrationsDir: migDir, supplementPath: supMissing });
    const redCode = report(redRes, (l) => redLines.push(l));
    const redOut = redLines.join('\n');
    check('RED arm 1: a planted WHOLE-FUNCTION omission exits 1', redCode === 1, `exit=${redCode}`);
    check('RED arm 1: the failure NAMES the missing signature', redOut.includes('public.alpha()'));
    check('RED arm 1: the failure names the migration file', redOut.includes('999_fixture_acl.sql'));

    // ── NEW RED arm 1 — THE PARTIAL REVOKE (CR-02; stands for resize_embedding_column) ───────
    const parLines = [];
    const parRes = analyse({ migrationsDir: migDir, supplementPath: supPartial });
    const parCode = report(parRes, (l) => parLines.push(l));
    const parOut = parLines.join('\n');
    check('NEW RED arm 1 (PARTIAL REVOKE — stands for `resize_embedding_column … FROM PUBLIC`): exits 1',
      parCode === 1, `exit=${parCode}, missing=${parRes.missing.length}`);
    check('NEW RED arm 1: the failure names the REVOKE / public.alpha() / public TUPLE',
      parOut.includes('REVOKE EXECUTE ON FUNCTION public.alpha() FROM public'),
      parRes.missing.join(' · '));
    check('NEW RED arm 1: the SIBLING tuples on the SAME function are still mirrored',
      parRes.missing.length === 1
      && !parOut.includes('public.alpha() FROM anon')
      && !parOut.includes('public.alpha() TO service_role'),
      'a signature-keyed gate could not see this at all — it printed missing: 0');

    // ── NEW RED arm 2 — the COMMENT-SWALLOW, the dollar quote, the doubled quote (CR-03) ─────
    const swallowed = aclsIn(
      "COMMENT ON COLUMN public.t.c IS 'a value -- with a double dash inside the literal';\n"
      + 'REVOKE EXECUTE ON FUNCTION public.danger(integer) FROM PUBLIC;',
      'fixture',
    );
    check('NEW RED arm 2 (COMMENT-SWALLOW): a `--` INSIDE a literal does not hide the next ACL',
      swallowed.length === 1 && swallowed[0].signature === 'public.danger(integer)',
      `${swallowed.length} entr(y|ies): ${swallowed.map((e) => e.signature).join(', ') || 'none'}`);

    const commentMigDir = path.join(tmp, 'migrations-comments');
    fs.mkdirSync(commentMigDir);
    padToFloor(commentMigDir);
    fs.writeFileSync(path.join(commentMigDir, '998_fixture_comments.sql'), FIXTURE_MIGRATION_COMMENTS);
    const cRes = analyse({
      migrationsDir: commentMigDir,
      supplementPath: supComplete,        // mirrors none of them — every one must show up as missing
    });
    const cLabels = [...cRes.expected.values()].map((v) => v.label);
    check('NEW RED arm 2: the dollar-quoted body keeps its statement boundary',
      cLabels.some((l) => l.includes('public.dollar_fn()')), cLabels.join(' · '));
    check('NEW RED arm 2: a doubled single-quote escape does not end the literal',
      cLabels.some((l) => l.includes('public.escaped(text)')), cLabels.join(' · '));
    check('NEW RED arm 2 (CONTROL): the entirely-commented line is STILL not counted',
      !cLabels.some((l) => l.includes('public.never_real()')), cLabels.join(' · '));

    // ── the `^\s*` anchor decision, pinned rather than asserted in prose ─────────────────────
    const anchored = aclsIn('\n-- a leading comment\nREVOKE EXECUTE ON FUNCTION public.zeta() FROM PUBLIC;', 'fixture');
    check('ANCHOR: `^\\s*` is safe now the lexer yields whole statements (leading newline + comment)',
      anchored.length === 1 && anchored[0].signature === 'public.zeta()',
      `${anchored.length} entr(y|ies)`);

    // ── CRLF parity ─────────────────────────────────────────────────────────────────────────
    const lfSql = "COMMENT ON COLUMN public.t.c IS 'x -- y';\nREVOKE EXECUTE ON FUNCTION public.crlf(uuid) FROM anon, authenticated;\n";
    const lfKeys = aclsIn(lfSql, 'f').map((e) => e.key).join('|');
    const crlfKeys = aclsIn(lfSql.replace(/\n/g, '\r\n'), 'f').map((e) => e.key).join('|');
    check('CRLF: a \\r\\n file yields the SAME tuples as the \\n file', lfKeys === crlfKeys && lfKeys.length > 0, lfKeys);

    // ── NEW RED arm 3 — TABLE and COLUMN privileges (CR-01) ─────────────────────────────────
    const tableMigDir = path.join(tmp, 'migrations-tables');
    fs.mkdirSync(tableMigDir);
    padToFloor(tableMigDir);
    fs.writeFileSync(path.join(tableMigDir, '997_fixture_tables.sql'), FIXTURE_MIGRATION_TABLES);

    const supTblComplete = path.join(tmp, 'supplement-tables-complete.sql');
    const supTblMissing = path.join(tmp, 'supplement-tables-missing-revoke.sql');
    const supTblNarrow = path.join(tmp, 'supplement-tables-narrow-columns.sql');
    fs.writeFileSync(supTblComplete, FIXTURE_SUPPLEMENT_TABLE_COMPLETE);
    fs.writeFileSync(supTblMissing, FIXTURE_SUPPLEMENT_TABLE_MISSING_REVOKE);
    fs.writeFileSync(supTblNarrow, FIXTURE_SUPPLEMENT_TABLE_NARROW_COLUMNS);

    const tGreenLines = [];
    const tGreenRes = analyse({ migrationsDir: tableMigDir, supplementPath: supTblComplete });
    const tGreenCode = report(tGreenRes, (l) => tGreenLines.push(l));
    check('NEW RED arm 3 (TABLE): the gate SEES table and column privileges at all',
      tGreenRes.tbl.statements === 4 && tGreenRes.expected.size > 0,
      `${tGreenRes.tbl.statements} table statement(s) → ${tGreenRes.expected.size} tuple(s)`);
    check('NEW RED arm 3 (TABLE, GREEN): a correct mirror exits 0 even with the columns re-ordered',
      tGreenCode === 0, `exit=${tGreenCode}`);

    const tRedLines = [];
    const tRedRes = analyse({ migrationsDir: tableMigDir, supplementPath: supTblMissing });
    const tRedCode = report(tRedRes, (l) => tRedLines.push(l));
    const tRedOut = tRedLines.join('\n');
    check('NEW RED arm 3 (TABLE): a missing table-level REVOKE exits 1', tRedCode === 1, `exit=${tRedCode}`);
    check('NEW RED arm 3 (TABLE): the failure NAMES the missing table tuple, both grantees',
      tRedOut.includes('REVOKE ALL ON public.widgets FROM anon')
      && tRedOut.includes('REVOKE ALL ON public.widgets FROM authenticated'),
      tRedRes.missing.join(' · '));
    check('NEW RED arm 3 (TABLE): a table-level REVOKE ALL never collapses into the column-level REVOKE ALL (secret)',
      !tRedOut.includes('REVOKE ALL (secret)'),
      'the column-level statement IS mirrored and must not be reported');

    const tNarrowLines = [];
    const tNarrowRes = analyse({ migrationsDir: tableMigDir, supplementPath: supTblNarrow });
    const tNarrowCode = report(tNarrowRes, (l) => tNarrowLines.push(l));
    const tNarrowOut = tNarrowLines.join('\n');
    check('NEW RED arm 3 (COLUMN-SET): mirroring (a) where the migration granted (a, b) exits 1',
      tNarrowCode === 1, `exit=${tNarrowCode}`);
    check('NEW RED arm 3 (COLUMN-SET): the failure names the MISSING COLUMN b, and not a',
      tNarrowOut.includes('GRANT SELECT (b) ON public.widgets TO authenticated')
      && !tNarrowOut.includes('GRANT SELECT (a) ON public.widgets TO authenticated'),
      tNarrowRes.missing.join(' · '));

    // ── NEW RED arm 4 — THE COUNTERFACTUAL, extended to the table tuples ─────────────────────
    check('NEW RED arm 4 (COUNTERFACTUAL, functions): a MIRRORED signature is ABSENT from the failure output',
      !redOut.includes('public.beta(uuid, text)') && !redOut.includes('public.gamma(uuid)'),
      'the gate does not print everything it knows');
    check('NEW RED arm 4 (COUNTERFACTUAL, tables): the MIRRORED table tuples are ABSENT from the failure output',
      !tRedOut.includes('GRANT SELECT (a) ON public.widgets')
      && !tRedOut.includes('GRANT INSERT ON public.widgets')
      && !tRedOut.includes('GRANT UPDATE ON public.widgets'),
      'the table half does not print everything it knows either');
    check('NEW RED arm 4 (COUNTERFACTUAL, partial revoke): a correct supplement over the SAME migration stays GREEN',
      greenCode === 0 && greenRes.missing.length === 0,
      'the arm fails for the planted defect, not for the fixture');

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
    console.log(`${GRN}self-test OK${RST} — ${results.length}/${results.length} assertions: the partial-revoke, comment-swallow and table/column arms all fired, the counterfactual held for both halves, and the count assertion refused a collapsed set.`);
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

module.exports = { normaliseSignature, statements, aclsIn, analyse, report, MIN_MIGRATION_FILES };

if (require.main === module) {
  try {
    process.exit(main());
  } catch (e) {
    // ⛔ An uncaught throw becomes exit 2 (harness error), never Node's default 1 (violation).
    fail(e && e.stack ? e.stack : String(e));
  }
}

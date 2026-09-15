#!/usr/bin/env node
'use strict';
/**
 * check-seeds-register.cjs — REG-02's teeth (Phase 251, D-03/D-04).
 *
 * WHY THIS EXISTS
 * ---------------
 * `.planning/seeds/` is this project's deferral index: every entry carries a `trigger_when`
 * written precisely so the idea could be revived at the right moment. Measured 2026-08-19 and
 * again at this phase's discuss: **the register is swept by NOTHING**. `grep -rln "SEED"
 * .claude/commands/gsd/` returns `capture.md` only — the command that *writes* seeds.
 *
 * ⛔ The cost is measured, not hypothetical. `SEED-172` sat reachable for **four weeks** — its
 *    trigger had fired and nobody was looking. A `trigger_when` nobody reads is a deferral with
 *    no re-open, which is a deletion that looks like a decision.
 *
 * ⛔ And a sweep is only worth what its SCAN SET is worth. Phase 242 measured
 *    `check-hot-file-ledger.cjs` printing `subject: 0 files` and `ledger gate OK` in the same
 *    breath, over a CRLF plan it could not parse. So this gate asserts its own arithmetic:
 *    **every file the register contains is either parsed or counted as skipped, and scan mode
 *    refuses to pass unless `parsed === registerSize`.** A gate that passes over nothing is worse
 *    than absent.
 *
 * USAGE
 *   node scripts/check-seeds-register.cjs                       # full register scan
 *   node scripts/check-seeds-register.cjs --files a.md b.md     # per-file mode (no count floor)
 *   node scripts/check-seeds-register.cjs --phase <NNN>         # trigger sweep vs files_modified
 *   node scripts/check-seeds-register.cjs --self-test           # D-04's arms, temp fixture register
 *
 * EXIT  0 = clear · 1 = violation · 2 = harness error
 *
 * ZERO DEPENDENCIES, and that is a RULE rather than a preference. Permitted requires are Node
 * built-ins only: `fs`, `path`, `crypto`, `os`, `child_process` (the last for D-20's git tie-break).
 * Two independent measured reasons, either of which is sufficient:
 *   ⚠ (inherited, DEF-245-01) `244-VERIFICATION.md`'s frontmatter does not parse as YAML — a
 *     YAML-parsing gate exits 2 on a file that carries its marker perfectly.
 *   ⚠ (this phase, RESEARCH §2.4) **21 seeds carry their `status` prose after a `#`**, which a real
 *     YAML parser silently DISCARDS. D-10 requires that prose be preserved byte-for-byte in
 *     `status_note`. A dependency that throws away the deliverable is not a convenience.
 *
 * ⚠ THIS FILE IS BOTH A CLI AND A LIBRARY, and the entry-point guard at the bottom of this file is
 *   load-bearing. Plan 02's migration `require()`s it so that ONE frontmatter boundary regex and ONE
 *   continuation reader exist in the repo rather than two that will diverge (the `age_days()`
 *   precedent: two copies of the bus header parse already exist and have ALREADY diverged). Without
 *   the guard, a `require()` would run this gate's CLI and kill the importing process.
 *   No sibling `check-*.cjs` exports anything today — `grep -l "module.exports" scripts/*.cjs` is
 *   empty — so the departure is deliberate and this is its reason.
 *
 * ⚠ NEVER NORMALISE ON DISK. This gate only reads. 159 of 284 seeds contain CR and 6 are mixed
 *   inside one file; `core.autocrlf=true` with no `.gitattributes` means a normalising rewrite
 *   changes every working-tree line while producing NO `git diff`. Regexes here are `\r?\n`-tolerant
 *   instead, so the bytes on disk are never the thing that has to change.
 *
 * Not prefixed `gsd-` on purpose — it is not GSD-managed and must survive `/gsd:update`.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SEEDS_DIR = path.join(root, '.planning', 'seeds');

/** A register entry. The filename is the authority for the id — frontmatter disagrees on 1+ file. */
const SEED_FILE_RE = /^SEED-(\d{3})-.*\.md$/;

const RED = '\x1b[31m';
const YEL = '\x1b[33m';
const GRN = '\x1b[32m';
const RST = '\x1b[0m';

function fail(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(2);
}

/**
 * A harness error raised from INSIDE the analysis, so it is CATCHABLE.
 * ⛔ `fail()` calls `process.exit(2)` and cannot be caught by anything — which would make D-04's
 *    count assertion undrivable: `--self-test` arm 5 has to OBSERVE the harness condition, and a
 *    guard nobody has seen fire is not a guard. The CLI's try/catch converts this back into `fail()`,
 *    so the exit code contract (2 = harness error) is unchanged.
 */
class HarnessError extends Error {}

function harness(msg) {
  throw new HarnessError(msg);
}

function norm(p) {
  return String(p).split(path.sep).join('/').replace(/^\.\//, '');
}

/** Repo-relative, `/`-separated, for an argument that may be absolute or relative to cwd. */
function toRepoRel(arg) {
  const abs = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg);
  return norm(path.relative(root, abs));
}

function unquote(s) {
  return String(s).trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * The `---` fenced block starting at line 1. Returns the WHOLE match object, or `null`.
 *
 * ⭐ THE RETURN SHAPE IS PART OF THE CONTRACT, because Plan 02's migration consumes it:
 *   - `m[1]` is the captured frontmatter block;
 *   - `m[0].length` is the exact STRING offset of the block's end, valid because the regex is
 *     anchored at index 0.
 * ⛔ Do NOT "simplify" this to return the bare captured string. Recovering the offset would need
 *    `text.indexOf(block)`, which returns `0` for an EMPTY frontmatter block and silently mis-slices
 *    the body — one such seed is enough to void D-11's md5 body proof on that file.
 *
 * ⛔ NON-GREEDY, ALWAYS. 102 bare `---` horizontal rules live inside seed BODIES; a greedy
 *    delimiter, or a naive split on every `---` line, destroys body content on ~40% of the register.
 * ⚠ `\r?` is mandatory and is not decoration: 159 of 284 seeds contain CR.
 * ⭐ `null` rather than `''` on a miss — the gate must distinguish "no block at all" (the 5
 *    `[no-frontmatter]` seeds) from "an empty block", and `''` collapses them.
 */
function frontmatter(text) {
  return /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
}

/**
 * Cut a frontmatter line at the first `#` that is NOT inside a quoted string, and return the part
 * to the LEFT. Quote-aware on purpose: a value may legitimately carry `#` inside quotes, and
 * cutting there would truncate a value the predicate should see whole.
 * ⛔ This is a split, not a YAML parser — see the zero-dependency note in the header.
 * ⚠ Lifted verbatim from `check-verification-honesty.cjs:277-290`, but used for the OPPOSITE
 *   purpose: there the right-hand side is noise; here it is the deliverable (D-10's `status_note`).
 *   This gate REPORTS the split; Plan 02's migration PERFORMS it.
 */
function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") {
      q = ch;
    } else if (ch === '#') {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Read a frontmatter key across ALL THREE shapes the register actually uses, returning
 * `{ value, shape, line, head, raw }` or `null` when the key is absent.
 *
 * ⛔ THIS IS THE PIECE WITH NO SIBLING, AND IT WAS DRIVEN RED BEFORE IT WAS WRITTEN.
 *    Measured 2026-09-16 over the live register: a plain `^trigger_when:[ \t]*(.+)$` reader — which
 *    is what every sibling gate's `scalar()` does — resolves **45 of 158** files. The other 113 put
 *    their content on continuation lines as a folded block scalar (`key: >`) or a YAML list.
 *    A sweep built on `scalar()` would silently report "no trigger" for 71% of the corpus, which is
 *    REG-02's own failure mode rebuilt inside the instrument meant to end it.
 *
 * Shapes: `plain` (value on the key's line) · `folded` (`>`/`>-`/`|`, continuation lines joined with
 * a space) · `list` (`  - ` bullets, joined with `; `) · `other` (indented continuation that is
 * neither) · `empty` (key present, nothing after it).
 *
 * Starting point: `check-gap-closure-rounds.cjs:103-117` `list()` — it already walks continuation
 * lines and already stops at the next top-level key with `if (/^\S/.test(lines[i])) break`.
 */
function readKey(fm, key) {
  if (fm == null) return null;
  const lines = String(fm).split(/\r?\n/);
  const head = new RegExp(`^${key}:[ \\t]*(.*)$`);
  let idx = -1;
  let rest = '';
  for (let i = 0; i < lines.length; i++) {
    const m = head.exec(lines[i]);
    if (m) {
      idx = i;
      rest = m[1];
      break;
    }
  }
  if (idx === -1) return null;

  const headVal = rest.trim();
  const isBlock = /^[>|][-+]?$/.test(headVal);

  if (headVal && !isBlock) {
    return { value: unquote(headVal), shape: 'plain', line: idx, head: rest, raw: [] };
  }

  const cont = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*$/.test(l)) continue;      // blank lines belong to the block, they do not end it
    if (/^\S/.test(l)) break;           // the next top-level key ends every continuation shape
    cont.push(l);
  }

  if (isBlock) {
    return {
      value: cont.map((l) => l.trim()).join(' ').trim(),
      shape: 'folded',
      line: idx,
      head: rest,
      raw: cont,
    };
  }
  if (!cont.length) {
    return { value: '', shape: 'empty', line: idx, head: rest, raw: [] };
  }
  const bullets = [];
  let allBullets = true;
  for (const l of cont) {
    const b = l.match(/^[ \t]+-[ \t]+(.*)$/);
    if (b) {
      bullets.push(unquote(b[1]));
    } else if (bullets.length) {
      bullets[bullets.length - 1] += ` ${l.trim()}`;   // a wrapped bullet
    } else {
      allBullets = false;
    }
  }
  if (allBullets && bullets.length) {
    return { value: bullets.join('; ').trim(), shape: 'list', line: idx, head: rest, raw: cont };
  }
  return {
    value: cont.map((l) => l.trim()).join(' ').trim(),
    shape: 'other',
    line: idx,
    head: rest,
    raw: cont,
  };
}

/** The joined value of a key, or `''`. Convenience over `readKey` for presence tests. */
function keyValue(fm, key) {
  const r = readKey(fm, key);
  return r && r.value ? r.value : '';
}

/**
 * Read the register from `dir` — a PARAMETER, never a module constant, so `--self-test` can point
 * exactly this code at a temp fixture directory rather than at a second implementation of it.
 *
 * `registerSize` is the filtered `readdirSync` length and is THE ONLY AUTHORITY for how many files
 * must be accounted for. Files are read as Buffers and decoded for parsing only — this gate never
 * writes, and never normalises line endings on disk.
 */
function readRegister(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    return { dir, registerSize: 0, entries: [], skipped: new Map(), readError: String(e && e.message) };
  }
  const files = names.filter((f) => SEED_FILE_RE.test(f)).sort();
  const entries = [];
  const skipped = new Map();
  const skip = (reason, file) => {
    if (!skipped.has(reason)) skipped.set(reason, []);
    skipped.get(reason).push(file);
  };

  for (const f of files) {
    const p = path.join(dir, f);
    let buf;
    try {
      buf = fs.readFileSync(p);
    } catch (e) {
      // ⛔ EVERY early exit increments a counter. `check-hot-file-ledger.cjs:108,110` has two
      //    uncounted `continue`s, and that is exactly how it printed `subject: 0 files · gate OK`.
      skip('unreadable', f);
      continue;
    }
    const text = buf.toString('utf8');
    const m = frontmatter(text);
    entries.push({
      file: f,
      rel: norm(path.relative(root, p)),
      id: SEED_FILE_RE.exec(f)[1],
      buf,
      text,
      fm: m ? m[1] : null,
      fmEnd: m ? m[0].length : 0,
    });
  }
  return { dir, registerSize: files.length, entries, skipped, readError: null };
}

/** Total of every counted skip. */
function skippedTotal(skipped) {
  let n = 0;
  for (const v of skipped.values()) n += v.length;
  return n;
}

/**
 * The count assertion (D-04), and it is STRICTLY STRONGER than the `MIN_SUBJECT_FILES` floor it is
 * modelled on: the register has a knowable exact size, so this is equality, not a floor.
 * ⛔ Scan mode only. In `--files` mode one file is a legitimate resolution and an equality check
 *    would make every single-file invocation a harness error.
 */
function assertAccounting(reg, mode) {
  const skippedN = skippedTotal(reg.skipped);
  if (reg.entries.length + skippedN !== reg.registerSize) {
    harness(
      `accounting does not balance: readdir found ${reg.registerSize} register file(s) but `
      + `${reg.entries.length} were parsed and ${skippedN} counted as skipped. `
      + 'Every skip must increment a printed counter — an uncounted `continue` is how a gate '
      + 'reports OK over a set it never read.'
    );
  }
  if (mode !== 'scan') return;
  if (reg.registerSize === 0) {
    harness(
      `the register at ${norm(path.relative(root, reg.dir))} resolved ZERO files`
      + (reg.readError ? ` (${reg.readError})` : '')
      + '. A gate that passes over nothing is worse than absent — check-hot-file-ledger.cjs was '
      + 'measured exiting 0 over `subject: 0 files` at Phase 242. Refusing to report a verdict.'
    );
  }
  if (reg.entries.length !== reg.registerSize) {
    harness(
      `parsed ${reg.entries.length} of ${reg.registerSize} register file(s) — the scan set collapsed `
      + `by ${reg.registerSize - reg.entries.length}. A gate that passes over nothing is worse than `
      + `absent. Skips counted: ${[...reg.skipped.entries()].map(([k, v]) => `${k}=${v.length}`).join(', ') || '(none)'}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE CONTRACT — D-09's required keys and D-10/D-16's status enum
//
// ⚠ S-5 SAME-COMMIT SYNC RULE: these two lists and the enum comment in `.planning/seeds/TEMPLATE.md`
//   are ONE PAIR. A value added here and not there means the next seed authored re-introduces the
//   defect the backfill removed; a value added there and not here means the gate reds on a legal
//   seed. Change both in the same commit, or change neither.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** D-09. Ordered, because the remedy text reads in this order. */
const REQUIRED_KEYS = ['seed_id', 'title', 'status', 'surface', 'trigger_when'];

/**
 * D-10 as amended by D-16. Ten values, closed.
 * ⚠ The `partially-*` family is NOT here on purpose — D-16 rules that the qualifier rides on the
 *   sibling boolean `partial:`, so `partially-folded` becomes `status: folded` + `partial: true`.
 *   Widening the enum by four axes was the rejected alternative; mapping down onto `status_note`
 *   alone was rejected because it makes `status: folded` silently include half-open seeds, which is
 *   REG-02's own failure mode in a new costume.
 * ⚠ `superseded-id` exists for D-05's redirect stubs and today matches zero files.
 */
const STATUS_ENUM = [
  'planted', 'dormant', 'open', 'partially-answered', 'answered',
  'folded', 'shipped', 'closed', 'deferred', 'superseded-id',
];

/** What a scan LOSES without each key — printed beside the code, never as a bare "missing". */
const KEY_WHY = {
  seed_id: 'no id in the frontmatter, so the file answers no id lookup and only its FILENAME indexes it',
  title: 'no title, so a sweep can print the seed but cannot say what it is — the operator gets an id and nothing else',
  status: '`status:` frontmatter IS the index. Without it this seed is invisible to EVERY status scan, at any count, forever',
  surface: 'CLAUDE.md\'s documented sweep filters `surface: Agentic-RAG`; a seed without it is unreachable by the rule that is supposed to find it',
  trigger_when: 'no trigger, so nothing says when to revive this idea — a deferral with no re-open is a deletion that looks like a decision',
};

/** `created` if present, ELSE `planted` (D-20) — `created` is absent on 185 of 284 files. */
function seedDate(entry) {
  if (entry.fm === null) return null;
  return keyValue(entry.fm, 'created') || keyValue(entry.fm, 'planted') || null;
}

/**
 * The git ADD-COMMIT timestamp — D-20's TIE-BREAK ONLY.
 * ⚠ The frontmatter date is AUTHORITATIVE. Measured: git and frontmatter disagree on two pairs
 *   (`SEED-022-timeout-settings-ui` reads 2026-05-25 and was added 2026-05-24; both 228/229 movers
 *   read 2026-08-31 and were added 2026-09-01) without flipping any verdict. The script must not
 *   pick silently, so this is consulted only when two members of a duplicate group carry the SAME
 *   date, and the fact that it was consulted is printed.
 * `--date=iso`, never `--date=short`: the two ties are 63 minutes and 13h 24m apart, and a
 *   day-resolution date cannot separate either.
 */
function gitAddedAt(rel) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(
    'git',
    ['log', '--diff-filter=A', '--format=%ad', '--date=iso', '-1', '--', rel],
    { cwd: root, encoding: 'utf8' }
  );
  if (r.error || r.status !== 0) return null;
  return String(r.stdout || '').trim().split('\n')[0] || null;
}

/** A YAML list key as an ARRAY (bullets), a plain scalar as a one-element array, `[]` when absent. */
function readList(fm, key) {
  const r = readKey(fm, key);
  if (!r) return [];
  if (r.shape === 'list') {
    return r.value.split(';').map((s) => unquote(s)).filter(Boolean);
  }
  if (r.shape === 'plain') {
    // `key: [a, b]` inline-flow, or a bare single value.
    const inline = r.value.match(/^\[(.*)\]$/);
    if (inline) return inline[1].split(',').map((s) => unquote(s)).filter(Boolean);
    return r.value ? [r.value] : [];
  }
  return r.value ? [r.value] : [];
}

/**
 * [duplicate-id] — D-08's gate half. Grouped by the id in the FILENAME, never by frontmatter:
 * `SEED-068` carries `seed_id: SEED-068  # renumbered from SEED-063…` inside its own value, and at
 * least one file's frontmatter id disagrees with its name. The filename is what a reference resolves
 * against, so the filename is the authority.
 *
 * ⭐ A group is NOT a finding when it is EXACTLY a keeper plus ONE `status: superseded-id` member —
 *    D-05's redirect stub is a legitimate resolution, and without this carve-out Plan 03's output
 *    would read as eight new regressions.
 *
 * ⛔ THE SHAPE CHECK IS `members.length === 2`, AND THAT HALF WAS MISSING UNTIL PLAN 04.
 *    The carve-out shipped in Plan 01 read `if (stubs.length === 1) continue;` — a COUNT on the
 *    stubs with NO constraint on the group. A **keeper + live squatter + stub** trio therefore
 *    satisfied it (`members 3, stubs 1`) and was waved through as "resolved" while carrying an
 *    entirely unresolved collision between the first two — the exact blindness this gate exists to
 *    remove, one level down. Found by Plan 03's arm D, which was written expecting a pass;
 *    fixed here because Plan 03 was forbidden to touch `scripts/` (D-17). Driven RED against a
 *    planted trio before the fix (self-test arm `1c`): WITHOUT the `members.length === 2` half the
 *    arm reports 0 findings on a group that contains a live duplicate.
 */
function duplicateGroups(entries) {
  const byId = new Map();
  for (const e of entries) {
    if (!byId.has(e.id)) byId.set(e.id, []);
    byId.get(e.id).push(e);
  }
  const dups = [];
  for (const [id, members] of [...byId.entries()].sort()) {
    if (members.length < 2) continue;
    const stubs = members.filter((m) => m.fm !== null && statusToken(m) === 'superseded-id');
    // D-05's resolution is a PAIR — one live seed and one redirect stub — never "a group that
    // happens to contain a stub". A third member means a reference to this id still resolves to
    // more than one live thing, which is the finding, stub or no stub.
    if (members.length === 2 && stubs.length === 1) continue;
    dups.push({ id, members, stubs: stubs.length });
  }
  return dups;
}

/** The status VALUE: the first whitespace-delimited token. `null` when the key is absent. */
function statusToken(entry) {
  if (entry.fm === null) return null;
  const raw = keyValue(entry.fm, 'status');
  if (!raw) return null;
  const tok = raw.split(/\s+/)[0];
  return tok || null;
}

/** Everything AFTER the status token — D-10's `status_note` payload. `''` when there is none. */
function statusNote(entry) {
  if (entry.fm === null) return '';
  const r = readKey(entry.fm, 'status');
  if (!r) return '';
  const line = r.shape === 'plain' ? r.head : r.value;
  const m = String(line).trim().match(/^\S+\s+([\s\S]*)$/);
  return m ? m[1].trim() : '';
}

/**
 * [id-in-heading] — the id a seed's own `# ` TITLE claims, or `null` when the title names none.
 *
 * ⛔ WHY THIS EXISTS, and it is a measured hole rather than a hypothetical one. Plan 03 renumbered
 *    eight seeds and then found that FOUR of the eight movers still titled themselves with the OLD
 *    id in their `# H1`. This gate greps `seed_id:` and never headings, so it read
 *    `duplicate ids: 0` throughout and was STRUCTURALLY INCAPABLE of catching it — Plan 03 had to
 *    correct all four by hand, and recorded that a gate is not a proof-reader. This closes that.
 *
 * ⚠ IT FIRES ONLY ON A DISAGREEMENT, never on an absence. Measured across the live register:
 *    221 headings carry a matching id, **42 carry no `SEED-NNN` at all** and **28 files have no
 *    `# ` heading at all** — none of those 70 is lying about anything, and failing them would be
 *    70 findings bought for zero integrity. Exactly ONE file disagreed: `SEED-068`, whose title
 *    read `# SEED-063 — …`, stale from a v2.8 renumber. Corrected in the same commit as this code.
 *
 * ⚠ The scan is limited to the first `# ` line AFTER the frontmatter block, so a `# ` inside the
 *   frontmatter's own comments or migration notes can never be read as a title.
 */
function headingId(entry) {
  const body = entry.text.slice(entry.fmEnd);
  const m = body.match(/^#[ \t]+(.*)$/m);
  if (!m) return null;
  const h = m[1].match(/SEED-(\d{3})/);
  return h ? h[1] : null;
}

/**
 * Every finding for one seed, as `[code, why]` tuples (the
 * `check-verification-honesty.cjs:364-397` shape — a code is never printed without a reason).
 */
function findingsFor(entry) {
  const out = [];
  // [id-in-heading] runs BEFORE the no-frontmatter early return on purpose: a heading that claims
  // the wrong id lies to a reader whether or not the file has a `---` block.
  const hid = headingId(entry);
  if (hid !== null && hid !== entry.id) {
    out.push([
      'id-in-heading',
      `the first \`# \` heading claims \`SEED-${hid}\` while the filename claims \`SEED-${entry.id}\` — `
      + 'a reader who trusts the title is reading about a different seed. The FILENAME is the '
      + 'authority (D-09); correct the heading.',
    ]);
  }
  if (entry.fm === null) {
    // ⛔ ONE code, not six. A file with no block at all is a different STATE from a file missing
    //    keys, and burying it under five `[missing-key]` lines hides which state it is in.
    out.push([
      'no-frontmatter',
      'no `---` fenced block starts at line 1, so `status:` — which IS the index — is invisible to every scan',
    ]);
    return out;
  }
  for (const key of REQUIRED_KEYS) {
    if (!keyValue(entry.fm, key)) out.push(['missing-key', `\`${key}\` — ${KEY_WHY[key]}`]);
  }
  const tok = statusToken(entry);
  if (tok !== null && !STATUS_ENUM.includes(tok)) {
    // ⚠ CASE-SENSITIVE, and that is an EXPLICIT NON-RULE rather than an oversight: `DONE` and
    //   `done` are BOTH findings. Case-folding would quietly bless two spellings of a token that is
    //   not in the enum under either casing.
    out.push([
      'unknown-status',
      `\`${tok}\` is outside the ${STATUS_ENUM.length}-value enum (${STATUS_ENUM.join(' | ')})`
      + (statusNote(entry) ? ` — and it carries ${statusNote(entry).length} chars of prose after the token` : ''),
    ]);
  }
  // D-16: `partial` is validated INDEPENDENTLY of `status`. An illegal status beside an illegal
  // `partial` produces TWO findings — merging them would let one hide behind the other.
  const partial = keyValue(entry.fm, 'partial');
  if (partial && partial !== 'true' && partial !== 'false') {
    out.push(['unknown-status', `\`partial: ${partial}\` — the D-16 qualifier is a boolean, and only the literals \`true\`/\`false\` are legal`]);
  }
  return out;
}

/**
 * D-18's TWO figures. ⛔ They are never summed.
 * `noTrigger` — seeds with no `trigger_when` at all.
 * `proseOnly` — seeds that HAVE a `trigger_when` but no structured `trigger_paths` /
 *               `trigger_surfaces` a sweep can match on.
 * A gate reporting 126 while ~238 are unswept is the comfortable lie REG-02 exists to end.
 */
function unsweptCounts(entries) {
  let noTrigger = 0;
  let proseOnly = 0;
  for (const e of entries) {
    const prose = e.fm === null ? '' : keyValue(e.fm, 'trigger_when');
    if (!prose || prose === 'unset') {
      noTrigger++;
      continue;
    }
    const paths = e.fm === null ? [] : readList(e.fm, 'trigger_paths');
    const surfaces = e.fm === null ? [] : readList(e.fm, 'trigger_surfaces');
    if (!paths.length && !surfaces.length) proseOnly++;
  }
  return { noTrigger, proseOnly };
}

// ⚠ `trigger_phase_touches` is NOT implemented, and this comment is the reason a later reader must
//    not "restore" it: D-18 rules it out by measurement — the 31 seeds naming a phase number name it
//    as HISTORY ("Phase 238 landed a Graph adapter"), not as a future trigger, and nothing declares
//    phase touches for it to match against.

/** A phase's blast radius: every `files_modified` entry of every `*-PLAN.md`, `/`-normalised. */
function phaseBlastRadius(phaseArg) {
  const candidates = [];
  const live = path.join(root, '.planning', 'phases');
  const archiveRoot = path.join(root, '.planning', 'milestones');
  const dirMatches = (d) => new RegExp(`^${phaseArg.replace('.', '\\.')}(?:\\.\\d+)?-`).test(d);

  if (fs.existsSync(live)) {
    for (const d of fs.readdirSync(live)) if (dirMatches(d)) candidates.push(path.join(live, d));
  }
  if (!candidates.length && fs.existsSync(archiveRoot)) {
    for (const m of fs.readdirSync(archiveRoot)) {
      const sub = path.join(archiveRoot, m);
      if (!fs.statSync(sub).isDirectory()) continue;
      for (const d of fs.readdirSync(sub)) if (dirMatches(d)) candidates.push(path.join(sub, d));
    }
  }
  if (!candidates.length) fail(`no phase directory matches "${phaseArg}" under .planning/phases/ or .planning/milestones/*/`);

  const files = new Set();
  const surfaces = new Set();
  const plans = [];
  for (const dir of candidates) {
    for (const f of fs.readdirSync(dir)) {
      if (!/-PLAN\.md$/.test(f)) continue;
      plans.push(norm(path.relative(root, path.join(dir, f))));
      const m = frontmatter(fs.readFileSync(path.join(dir, f)).toString('utf8'));
      if (!m) continue;
      for (const v of readList(m[1], 'files_modified')) files.add(norm(v));
      for (const v of readList(m[1], 'surfaces')) surfaces.add(v);
    }
  }
  return { dirs: candidates.map((d) => norm(path.relative(root, d))), plans, files: [...files], surfaces: [...surfaces] };
}

/**
 * D-01's match. ⛔ BOTH SIDES NORMALISED to forward slashes: on Windows the glob read out of a seed
 * and the path read out of a PLAN.md can differ only in separator, and a silent non-match is D-04
 * arm 3 failing invisibly — which looks exactly like arm 4 passing.
 * `path.matchesGlob` is a Node built-in (v24.19.0), so D-01 costs zero dependencies.
 */
function matchTriggers(entries, blast) {
  const matched = [];
  for (const e of entries) {
    if (e.fm === null) continue;
    const hits = [];
    for (const glob of readList(e.fm, 'trigger_paths')) {
      const g = norm(glob);
      for (const f of blast.files) {
        if (path.matchesGlob(norm(f), g)) hits.push({ kind: 'path', glob: g, target: norm(f) });
      }
    }
    for (const s of readList(e.fm, 'trigger_surfaces')) {
      if (blast.surfaces.includes(s)) hits.push({ kind: 'surface', glob: s, target: s });
    }
    if (hits.length) {
      matched.push({ entry: e, hits, title: keyValue(e.fm, 'title'), status: statusToken(e) });
    }
  }
  return matched;
}

/**
 * ⭐ THE PURE ANALYSIS — one implementation, driven by BOTH the CLI and `--self-test`.
 *
 * ⛔ This refactor is what makes D-04 ARM 4 ASSERTABLE AT ALL. Arm 4 is a COUNTERFACTUAL — a seed
 *    whose trigger does not match must be ABSENT from the matched set — and an absence cannot be
 *    asserted against scraped stdout without also asserting the exact shape of every other line.
 *    Returning the matched set as DATA makes "not in it" a one-line assertion.
 *
 * `dir` is a parameter, never the module constant, so the self-test points EXACTLY this code at a
 * temp fixture register rather than at a second implementation of it that would drift.
 *
 * Throws `HarnessError` (catchable) rather than exiting, so the count assertion can be OBSERVED.
 */
function analyse({ dir, filesModified = [], surfaces = [], selectFiles = null, mode = 'scan' }) {
  const reg = readRegister(dir);
  assertAccounting(reg, mode === 'files' ? 'files' : 'scan');

  let entries = reg.entries;
  if (selectFiles) {
    const want = new Set(selectFiles.map((g) => path.basename(String(g))));
    entries = entries.filter((e) => want.has(e.file));
  }

  const dups = duplicateGroups(entries);
  const unswept = unsweptCounts(entries);
  const results = entries.map((e) => ({ entry: e, findings: findingsFor(e) }));

  const findings = [];
  for (const d of dups) {
    findings.push({
      code: 'duplicate-id',
      id: d.id,
      rel: `SEED-${d.id}`,
      members: d.members,
      why: `${d.members.length} files claim this id; a reference to it resolves to more than one thing`,
    });
  }
  for (const r of results) {
    for (const [code, why] of r.findings) findings.push({ code, rel: r.entry.rel, file: r.entry.file, why });
  }

  const blast = { files: filesModified.map(norm), surfaces: surfaces.slice() };
  const matched = matchTriggers(entries, blast);

  return {
    dir,
    registerSize: reg.registerSize,
    parsed: entries.length,
    skipped: reg.skipped,
    skippedCount: skippedTotal(reg.skipped),
    entries,
    results,
    dups,
    findings,
    matched,
    noTrigger: unswept.noTrigger,
    proseOnly: unswept.proseOnly,
    complete: results.filter((r) => !r.findings.some(([c]) => c === 'missing-key' || c === 'no-frontmatter')).length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// --self-test — D-04's four arms and the count assertion, made RE-RUNNABLE FOREVER
//
// ⚠ Measured at this phase's research: NO `check-*.cjs` in this repo has any test, runner or
//   self-test mode. Every RED drive any of them ever had was executed once, by hand, and survives
//   only as prose in a SUMMARY. A guard nobody has seen fire is not a guard — and a guard nobody
//   can SEE fire AGAIN is one plausible refactor away from being decoration.
//
// ⛔ T-251-03: every write below goes under `fs.mkdtempSync(os.tmpdir())` and is asserted to be
//    inside that root before it happens. `SEEDS_DIR` is unreachable from any write path in this
//    file — a script that can write to the register by accident is this phase's own threat.
// ─────────────────────────────────────────────────────────────────────────────────────────────

function runSelfTest() {
  const os = require('os');
  const rootTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seeds-selftest-'));
  const arms = [];
  const record = (n, name, pass, detail) => arms.push({ n, name, pass, detail });

  /** ⛔ The containment guard. Boundary-safe (`root + sep`), never a bare prefix match. */
  const writeFixture = (dir, file, body) => {
    const target = path.resolve(dir, file);
    if (target !== rootTmp && !target.startsWith(rootTmp + path.sep)) {
      harness(`refusing to write ${target} — it is outside the self-test temp root ${rootTmp}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  };

  const mkdir = (name) => {
    const d = path.join(rootTmp, name);
    fs.mkdirSync(d, { recursive: true });
    return d;
  };

  const seed = (o) => {
    const lines = ['---'];
    for (const [k, v] of Object.entries(o)) lines.push(`${k}: ${v}`);
    lines.push('---', '', `# ${o.title || 'fixture'}`, '', 'body prose', '');
    return lines.join('\n');
  };

  try {
    // ── ARM 1 — a planted duplicate id must FAIL ────────────────────────────────────────────
    {
      const d = mkdir('arm1');
      writeFixture(d, 'SEED-901-first-claimant.md', seed({ seed_id: 'SEED-901', title: 'first claimant', status: 'planted', surface: 'Agentic-RAG', trigger_when: 'never', created: '2026-01-01' }));
      writeFixture(d, 'SEED-901-second-claimant.md', seed({ seed_id: 'SEED-901', title: 'second claimant', status: 'planted', surface: 'Agentic-RAG', trigger_when: 'never', created: '2026-02-02' }));
      writeFixture(d, 'SEED-902-innocent.md', seed({ seed_id: 'SEED-902', title: 'innocent', status: 'planted', surface: 'Agentic-RAG', trigger_when: 'never', created: '2026-01-01' }));
      const a = analyse({ dir: d });
      const hit = a.findings.filter((f) => f.code === 'duplicate-id');
      record(1, 'duplicate id FAILS', hit.length === 1 && hit[0].id === '901',
        `expected 1 [duplicate-id] on 901, got ${hit.length} (${hit.map((h) => h.id).join(',') || 'none'})`);

      // …and the D-05 carve-out, driven rather than asserted in a comment.
      const d2 = mkdir('arm1b');
      writeFixture(d2, 'SEED-901-first-claimant.md', seed({ seed_id: 'SEED-901', title: 'first claimant', status: 'planted', surface: 'Agentic-RAG', trigger_when: 'never', created: '2026-01-01' }));
      writeFixture(d2, 'SEED-901-redirect-stub.md', seed({ seed_id: 'SEED-901', title: 'redirect stub', status: 'superseded-id', surface: 'Agentic-RAG', trigger_when: 'never', created: '2026-02-02' }));
      const a2 = analyse({ dir: d2 });
      const hit2 = a2.findings.filter((f) => f.code === 'duplicate-id');
      record('1b', 'a superseded-id stub is NOT a duplicate', hit2.length === 0,
        `expected 0 [duplicate-id], got ${hit2.length} — without this carve-out Plan 03's 8 stubs read as 8 regressions`);

      // ⭐ ARM 1c — THE CARVE-OUT'S OWN COUNTERFACTUAL, and the arm that caught a real defect.
      //    The carve-out must resolve a PAIR, not "any group containing a stub". A keeper + a LIVE
      //    squatter + a stub is `members 3, stubs 1`; the shipped `stubs.length === 1` test passed
      //    it and silenced a real collision. Driven RED before the `members.length === 2` half was
      //    added: this arm reported `got 0` on a group with an unresolved duplicate in it.
      const d3 = mkdir('arm1c');
      writeFixture(d3, 'SEED-911-keeper.md', seed({ seed_id: 'SEED-911', title: 'keeper', status: 'planted', surface: 'Agentic-RAG', trigger_when: 'never', created: '2026-01-01' }));
      writeFixture(d3, 'SEED-911-live-squatter.md', seed({ seed_id: 'SEED-911', title: 'live squatter', status: 'planted', surface: 'Agentic-RAG', trigger_when: 'never', created: '2026-02-02' }));
      writeFixture(d3, 'SEED-911-superseded-id.md', seed({ seed_id: 'SEED-911', title: 'redirect stub', status: 'superseded-id', surface: 'Agentic-RAG', trigger_when: 'never', created: '2026-03-03' }));
      const a3 = analyse({ dir: d3 });
      const hit3 = a3.findings.filter((f) => f.code === 'duplicate-id');
      record('1c', 'keeper + LIVE squatter + stub is STILL a duplicate (the carve-out is a SHAPE, not a count)',
        hit3.length === 1 && hit3[0].id === '911',
        `expected 1 [duplicate-id] on 911, got ${hit3.length} — a group of 3 with one stub still contains an unresolved collision`);
    }

    // ── ARM 2 — missing or unknown status must FAIL ─────────────────────────────────────────
    {
      const d = mkdir('arm2');
      writeFixture(d, 'SEED-903-bad-status.md', seed({ seed_id: 'SEED-903', title: 'bad status', status: 'DONE', surface: 'Agentic-RAG', trigger_when: 'never', created: '2026-01-01' }));
      writeFixture(d, 'SEED-904-no-block.md', '# SEED-904: no frontmatter at all\n\nbody prose\n');
      writeFixture(d, 'SEED-905-clean.md', seed({ seed_id: 'SEED-905', title: 'clean', status: 'planted', surface: 'Agentic-RAG', trigger_when: 'never', created: '2026-01-01' }));
      const a = analyse({ dir: d });
      const unknown = a.findings.filter((f) => f.code === 'unknown-status');
      const noFm = a.findings.filter((f) => f.code === 'no-frontmatter');
      const onClean = a.findings.filter((f) => f.file === 'SEED-905-clean.md');
      record(2, 'unknown status + no frontmatter FAIL, clean seed does not',
        unknown.length === 1 && noFm.length === 1 && onClean.length === 0,
        `expected 1/1/0, got unknown=${unknown.length} noFm=${noFm.length} onClean=${onClean.length}`);
    }

    // ── ARM 2b — [id-in-heading], WITH the absence counterfactual ───────────────────────────
    //    ⚠ The second half of this arm is the load-bearing one. A check that fires on any heading
    //      without a matching id would red 70 live files (42 titles name no id; 28 files have no
    //      `# ` line), so "it caught the bad one" is not enough — it must LEAVE the innocent ones
    //      alone, and that is asserted as an ABSENCE, not as a smaller count.
    {
      const d = mkdir('arm2b');
      const withH1 = (o, h1) => {
        const lines = ['---'];
        for (const [k, v] of Object.entries(o)) lines.push(`${k}: ${v}`);
        lines.push('---', '', h1, '', 'body prose', '');
        return lines.join('\n');
      };
      const fmk = { status: 'planted', surface: 'Agentic-RAG', trigger_when: 'never', created: '2026-01-01' };
      writeFixture(d, 'SEED-921-stale-title.md', withH1({ seed_id: 'SEED-921', title: 'stale title', ...fmk }, '# SEED-063 — renamed long ago and the title never moved'));
      writeFixture(d, 'SEED-922-matching-title.md', withH1({ seed_id: 'SEED-922', title: 'matching title', ...fmk }, '# SEED-922 — the title agrees'));
      writeFixture(d, 'SEED-923-title-names-no-id.md', withH1({ seed_id: 'SEED-923', title: 'no id in title', ...fmk }, '# a title that names no id at all'));
      writeFixture(d, 'SEED-924-no-heading-at-all.md', withH1({ seed_id: 'SEED-924', title: 'no heading', ...fmk }, 'not a heading, just prose'));
      const a = analyse({ dir: d });
      const hits = a.findings.filter((f) => f.code === 'id-in-heading').map((f) => f.file);
      record('2b', 'a heading claiming the WRONG id FAILS — and a heading claiming NO id does not',
        hits.length === 1 && hits[0] === 'SEED-921-stale-title.md',
        `expected exactly [SEED-921-stale-title.md], got [${hits.join(',') || 'none'}] — `
        + 'firing on 923/924 would red 70 live files for zero integrity; missing 921 is the hole '
        + 'that let four of Plan 03\'s eight movers keep the id they no longer claim');
    }

    // ── ARMS 3 + 4 — the match, and THE COUNTERFACTUAL ──────────────────────────────────────
    {
      const d = mkdir('arm34');
      writeFixture(d, 'SEED-906-should-match.md', seed({ seed_id: 'SEED-906', title: 'should match', status: 'planted', surface: 'Agentic-RAG', trigger_when: 'when services change', trigger_paths: '["backend/app/services/**"]' }));
      writeFixture(d, 'SEED-907-should-not-match.md', seed({ seed_id: 'SEED-907', title: 'should NOT match', status: 'planted', surface: 'Agentic-RAG', trigger_when: 'when pages change', trigger_paths: '["frontend/src/pages/**"]' }));
      const a = analyse({ dir: d, filesModified: ['backend/app/services/agent_loop.py'] });
      const ids = a.matched.map((m) => m.entry.id);
      record(3, 'a matching trigger IS printed', ids.includes('906'),
        `expected 906 in the matched set, got [${ids.join(',') || 'empty'}]`);
      // ⭐ ARM 4 IS ASSERTED AS ABSENCE, NOT AS A SMALLER COUNT. A gate that prints everything
      //    passes arms 1-3 and is useless; this is the only arm that can catch that.
      record(4, 'a NON-matching trigger is ABSENT (the counterfactual)', !ids.includes('907'),
        `907 must NOT appear in the matched set, got [${ids.join(',') || 'empty'}]`);
    }

    // ── ARM 5 — the count assertion over a collapsed scan set ───────────────────────────────
    {
      const d = mkdir('arm5-empty');
      let raised = null;
      try {
        analyse({ dir: d });
      } catch (e) {
        raised = e;
      }
      // ⛔ Asserted by CATCHING the harness condition, never by reading an exit code — an exit 0
      //    over zero files is the precise defect this arm exists to make impossible.
      record(5, 'an EMPTY register raises a harness error', raised instanceof HarnessError,
        raised ? `raised ${raised.constructor.name}` : 'NOTHING was raised — the gate would have reported a clean result over zero files');
    }
  } finally {
    fs.rmSync(rootTmp, { recursive: true, force: true });
  }

  console.log(`\nseeds register — self-test (fixture register under ${norm(path.dirname(rootTmp))}, real register untouched)`);
  for (const a of arms) {
    console.log(`  arm ${a.n} ${a.name} … ${a.pass ? `${GRN}PASS${RST}` : `${RED}FAIL${RST}`}`);
    if (!a.pass) console.log(`      ${a.detail}`);
  }
  const passed = arms.filter((a) => a.pass).length;
  if (passed !== arms.length) {
    console.log(`\n${RED}self-test ${passed}/${arms.length} arms PASS${RST} — the gate cannot be trusted until every arm is green.`);
    return 1;
  }
  console.log(`\n${GRN}self-test ${passed}/${arms.length} arms PASS${RST} — duplicate id, stub carve-out, the carve-out's SHAPE check, bad status, a heading that claims the wrong id, match, counterfactual, empty-register floor.`);
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--self-test')) return runSelfTest();

  let dir = SEEDS_DIR;
  let mode = 'scan';
  let given = null;
  const filesIdx = argv.indexOf('--files');
  if (filesIdx !== -1) {
    given = argv.slice(filesIdx + 1).filter((a) => !a.startsWith('--'));
    if (!given.length) {
      fail(
        '--files was given ZERO arguments. A gate that passes over nothing is worse than absent: '
        + 'check-hot-file-ledger.cjs was measured exiting 0 over `subject: 0 files` at Phase 242, '
        + 'in the same run that printed `ledger gate OK`.'
      );
    }
    mode = 'files';
  }

  let phaseArg = null;
  const phaseIdx = argv.indexOf('--phase');
  if (phaseIdx !== -1) {
    phaseArg = argv[phaseIdx + 1];
    if (!phaseArg || phaseArg.startsWith('--')) fail('--phase takes a phase number, e.g. --phase 251');
    if (mode === 'files') fail('--files and --phase are different modes; give one or the other');
    mode = 'phase';
  }

  // ⚠ The blast radius is resolved BEFORE the analysis, so the CLI is a printer over ONE pure call
  //   and `--self-test` drives that same call with a fixture radius.
  const blast = mode === 'phase' ? phaseBlastRadius(phaseArg) : { plans: [], files: [], surfaces: [] };

  const a = analyse({
    dir,
    mode,
    filesModified: blast.files,
    surfaces: blast.surfaces,
    selectFiles: mode === 'files' ? given.map((g) => toRepoRel(g)) : null,
  });
  if (mode === 'files' && !a.parsed) {
    fail(`none of the ${given.length} given path(s) resolved to a register entry under ${norm(path.relative(root, dir))}`);
  }

  const reg = { registerSize: a.registerSize, entries: a.entries, skipped: a.skipped };
  const skippedN = a.skippedCount;
  const dups = a.dups;
  const unswept = { noTrigger: a.noTrigger, proseOnly: a.proseOnly };
  const results = a.results;
  const violations = results.filter((r) => r.findings.length);
  const fileFindings = violations.reduce((n, r) => n + r.findings.length, 0);
  const complete = a.complete;

  console.log(`\nseeds register — ${norm(path.relative(root, dir))}`);
  if (mode === 'files') {
    console.log(
      `  register: ${reg.registerSize} files · selected by --files: ${reg.entries.length} · `
      + `skipped: ${skippedN} · duplicate ids: ${dups.length}`
    );
    console.log('    ⚠ per-file mode: the count assertion does NOT apply here — one file is a legitimate resolution.');
  } else {
    console.log(
      `  register: ${reg.registerSize} files · parsed: ${reg.entries.length} · `
      + `skipped: ${skippedN} · duplicate ids: ${dups.length}`
    );
  }
  // ⛔ D-18: TWO FIGURES, ON ONE LINE, NEVER SUMMED. A gate reporting only the first while the
  //    second is larger is the comfortable lie REG-02 exists to end.
  console.log(
    `  unswept:  ${unswept.noTrigger} carry no trigger_when at all · `
    + `${unswept.proseOnly} carry prose but no structured trigger`
  );
  if (skippedN) {
    for (const [reason, files] of reg.skipped) {
      console.log(`    skipped[${reason}]: ${files.length} — ${files.join(', ')}`);
    }
  }

  if (mode === 'phase') {
    const matched = a.matched;
    console.log(
      `\ntrigger sweep — phase ${phaseArg} (${blast.plans.length} plan file(s), `
      + `${blast.files.length} path(s) in files_modified)`
    );
    if (!blast.surfaces.length) {
      console.log('  ⚠ the phase declares NO surfaces, so `trigger_surfaces` matched nothing here.');
      console.log('    That is a fact about the PHASE, not about the register — reported, never passed off as a clean sweep.');
    }
    if (!matched.length) {
      console.log(
        `  0 seeds matched — of ${reg.entries.length} parsed, none carries a structured trigger `
        + 'this blast radius satisfies.'
      );
    } else {
      console.log(`  ${matched.length} seed(s) matched:`);
      for (const m of matched) {
        console.log(`  [trigger-fires] SEED-${m.entry.id} (status: ${m.status || '—'}) ${m.title || '(no title)'}`);
        for (const h of m.hits) console.log(`      ${h.kind} "${h.glob}"  matched  "${h.target}"`);
      }
    }
  }

  if (dups.length) {
    console.log(`\n${RED}SEEDS REGISTER GATE FAILS${RST} — ${dups.length} colliding id(s):`);
    for (const d of dups) {
      const dates = d.members.map((m) => seedDate(m));
      const tie = dates.every((x) => x && x === dates[0]);
      console.log(
        `  [duplicate-id] SEED-${d.id} — ${d.members.length} files claim this id; `
        + 'a reference to it resolves to more than one thing'
      );
      d.members.forEach((m, i) => console.log(`      ${m.rel}   (${dates[i] || 'NO DATE'})`));
      if (tie) {
        // D-20: git is consulted ONLY on a tie, and the fact that it was consulted is PRINTED —
        // the script must not pick silently between two seeds whose frontmatter dates agree.
        console.log('      ⚠ both carry the SAME date — D-20 tie-break, git add-commit timestamps:');
        for (const m of d.members) console.log(`        ${m.file}  added ${gitAddedAt(m.rel) || '(unknown)'}`);
      }
    }
  }

  if (violations.length) {
    console.log(`\n${RED}SEEDS REGISTER GATE FAILS${RST} — ${fileFindings} finding(s) across ${violations.length} file(s):`);
    for (const r of violations) {
      for (const [code, why] of r.findings) {
        console.log(`  [${code}] ${r.entry.rel}`);
        console.log(`      ${why}`);
      }
    }
  }

  if (dups.length || violations.length) {
    console.log(`
⛔ A register that answers an id lookup with two files, or a status scan with a token no scan knows,
   is not "slightly untidy" — it is an INDEX THAT LIES, and every agent downstream believes it.
   \`SEED-172\` sat reachable for four weeks because nothing swept this folder at all.

   [duplicate-id]    renumber the YOUNGER seed (D-07: \`created\` else \`planted\`, git add-commit on
                     a tie) to a fresh id and leave a \`status: superseded-id\` redirect stub behind.
   [missing-key]     backfill the key. \`seed_id\` derives from the filename, \`title\` from the H1,
                     \`surface\` defaults to Agentic-RAG — derive what is derivable, MARK what is not.
   [unknown-status]  map the token onto the ${STATUS_ENUM.length}-value enum, with \`partial: true\` carrying a
                     "partially-*" qualifier on any axis (D-16).
   [no-frontmatter]  the file needs a \`---\` block, not a new value — it is a different STATE.
   [id-in-heading]   correct the \`# \` TITLE to the id in the FILENAME. Plan 03 measured four of its
                     eight renumbered seeds still titling themselves with the id they had given up —
                     invisible to a gate that greps \`seed_id:\` and never headings.

   ⛔ Do NOT satisfy [unknown-status] by DELETING the prose after the token. That prose IS the
      deliverable: move it byte-for-byte into \`status_note:\`. The cheapest way to green this code is
      to destroy exactly what D-10 exists to preserve, and a register that greened by forgetting is
      worse than one that reds honestly.

   ⚠ THIS GATE SHIPS NO ESCAPE HATCH, deliberately: none of D-04's arms names a condition a worded
     human reason could make acceptable. If a future phase adds one it must add the
     \`passed WITH OVERRIDES\` verdict line WITH it — a waved-through finding must never read as an
     absent one (S-3).`);
    return 1;
  }

  console.log(
    `\n${GRN}seeds register gate OK${RST} — ${reg.entries.length}/${reg.registerSize} parsed, `
    + `0 duplicate ids, ${complete}/${reg.entries.length} carry all ${REQUIRED_KEYS.length} required keys.`
  );
  return 0;
}

// ⚠ The guard is the reason this file can be both a CLI and a library. See the header.
if (require.main === module) {
  try {
    process.exit(main());
  } catch (e) {
    fail(e && e.stack ? e.stack : String(e));
  }
}

module.exports = {
  frontmatter, readKey, keyValue, readList, stripComment,
  readRegister, assertAccounting, skippedTotal, analyse,
  STATUS_ENUM, REQUIRED_KEYS, HarnessError,
  norm, unquote, seedDate, statusToken, statusNote,
};

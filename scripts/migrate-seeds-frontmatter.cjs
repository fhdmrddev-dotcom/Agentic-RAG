#!/usr/bin/env node
'use strict';
/**
 * migrate-seeds-frontmatter.cjs — D-09/D-10/D-11/D-16/D-18's one-shot (Phase 251, plan 02).
 *
 * WHY THIS EXISTS
 * ---------------
 * `.planning/seeds/` has never had a written contract. Measured at this phase's research:
 * **`.planning/seeds/TEMPLATE.md` does not exist and never has**, 91 distinct frontmatter keys are
 * in use, `status` is spelled 25 different ways across 278 files, 101 seeds say `id:` while 177 say
 * `seed_id:`, and 5 files carry no frontmatter block at all. That absence is a sufficient
 * explanation on its own — nobody was careless; there was nothing to be careful ABOUT.
 *
 * So this is not a tightening of a loose rule. It is the first one, applied once, to every file.
 *
 * ⛔ THE INVARIANT THIS SCRIPT EXISTS TO PROVE (D-11): only the frontmatter block changes. Every
 *    seed's BODY is md5-identical before and after, hashed over the RAW Buffer, in the same process
 *    run, and one mismatch aborts before any further write.
 *
 * ⛔ AND THE CHECK THAT CANNOT BE USED TO PROVE IT: a git-side content comparison. Measured
 *    2026-09-16 on `SEED-171` — a whole-file line-ending rewrite destroyed **553 bytes** and git's
 *    content comparison reported **zero lines of change**, because `core.autocrlf=true` with no
 *    `.gitattributes` means git already stores LF. The damage is real and git cannot see it. The
 *    md5 must be taken on working-tree bytes, in-process, before and after.
 *
 * USAGE
 *   node scripts/migrate-seeds-frontmatter.cjs              # DRY RUN — changes nothing, prints the plan
 *   node scripts/migrate-seeds-frontmatter.cjs --apply      # write (idempotent: a 2nd run changes 0)
 *   node scripts/migrate-seeds-frontmatter.cjs --self-test  # the arms, on a temp fixture register
 *   node scripts/migrate-seeds-frontmatter.cjs --quiet      # totals only, no per-file plan
 *
 * EXIT  0 = clear · 1 = refused (a body moved, or a status token nobody ruled on) · 2 = harness error
 *
 * ⛔ NOT NAMED `check-*`, DELIBERATELY. Measured: `grep -ln "writeFileSync" scripts/*.cjs` returns
 *    ZERO — every `check-*.cjs` in this repo is read-only by construction and the prefix means
 *    exactly that. This is the first file-writing `.cjs` in `scripts/`, and a phase about register
 *    honesty is the last place to blur a namespace.
 *
 * ZERO DEPENDENCIES, and that is a RULE. Node built-ins only (`fs`, `path`, `crypto`, plus `os`
 * lazily in the self-test), and EXACTLY ONE local require: the Plan 01 gate. Two measured reasons a
 * YAML library is refused: (1) a real parser DISCARDS the `#`-comment prose on 21 seeds that D-10
 * requires be preserved byte-for-byte — the comment is the deliverable here, not noise; (2) at least
 * one register file in this repo does not parse as YAML at all, so a parsing tool would exit before
 * it read anything (DEF-245-01).
 *
 * ⚠ ONE PARSER, IMPORTED, ON THE CALL PATH. The frontmatter boundary and every multi-line value are
 *   read through `scripts/check-seeds-register.cjs` — never re-implemented here. This repo has
 *   already paid for the alternative: `agent-bus.sh`'s `age_days()` and the SessionStart hook's
 *   inline copy of it have diverged (one is portable, one is GNU-only). The import is bound as a
 *   NAMESPACE rather than destructured, so every use is greppable as a call on the imported module
 *   AND so a stub assigned onto the cached exports object actually takes effect — which is how the
 *   dependency is proven live rather than assumed.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const gate = require(path.join(__dirname, 'check-seeds-register.cjs'));

const root = path.resolve(__dirname, '..');
const SEEDS_DIR = path.join(root, '.planning', 'seeds');

/** The same shape `check-seeds-register.cjs` uses. `TEMPLATE.md` deliberately does not match it. */
const SEED_FILE_RE = /^SEED-(\d{3})-.*\.md$/;

const RED = '\x1b[31m';
const YEL = '\x1b[33m';
const GRN = '\x1b[32m';
const DIM = '\x1b[2m';
const RST = '\x1b[0m';

/** Exit 2 — the harness itself is wrong. */
function fail(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(2);
}

/** Thrown by the body-invariant and by an unruled status token. Catchable, so an arm can OBSERVE it. */
class Refusal extends Error {}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE STATUS MAPPING TABLE — all 25 raw tokens, every one with a listed destination
//
// ⛔ D-10 and D-16 forbid a silent coercion, so this table is EXHAUSTIVE rather than a set of
//    special cases over a default. A token that is not here REFUSES the run and names the file;
//    there is no fall-through, and `status` is never guessed.
// ⚠ CASE-FOLDING IS AN EXPLICIT NON-RULE. `DONE` and `done` have SEPARATE rows and were each
//   decided by READING the seed, because neither casing is in the enum and blessing one silently
//   would be a mapping nobody ruled on.
// ⚠ S-5 SAME-COMMIT SYNC RULE: the `to:` values here are `check-seeds-register.cjs`'s `STATUS_ENUM`
//   and `.planning/seeds/TEMPLATE.md`'s enum comment. The three are ONE triple.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const STATUS_MAP = {
  // ── clean 1:1, 9 tokens / 251 files (90.3%). No judgement needed and none applied. ──
  planted:              { to: 'planted',            partial: false, why: 'clean 1:1' },
  open:                 { to: 'open',               partial: false, why: 'clean 1:1' },
  closed:               { to: 'closed',             partial: false, why: 'clean 1:1' },
  folded:               { to: 'folded',             partial: false, why: 'clean 1:1' },
  dormant:              { to: 'dormant',            partial: false, why: 'clean 1:1' },
  'partially-answered': { to: 'partially-answered', partial: false, why: 'clean 1:1 — a first-class enum member, NOT the partially-* family' },
  answered:             { to: 'answered',           partial: false, why: 'clean 1:1' },
  shipped:              { to: 'shipped',            partial: false, why: 'clean 1:1' },
  deferred:             { to: 'deferred',           partial: false, why: 'clean 1:1' },

  // ── already legal, zero files today: D-05's redirect stubs (Plan 03 writes them). ──
  'superseded-id':      { to: 'superseded-id',      partial: false, why: 'D-05 redirect stub' },

  // ── the partially-* family (15 files): base token + `partial: true` (D-16). ──
  'partially-folded':   { to: 'folded',   partial: true, why: 'D-16 — folded on one axis, pending on another' },
  'partially-shipped':  { to: 'shipped',  partial: true, why: 'D-16' },
  'shipped-in-part':    { to: 'shipped',  partial: true, why: 'D-16 — same class as partially-shipped, different spelling' },
  'partially-resolved': { to: 'answered', partial: true, why: 'D-16 — "resolved" here means a question was settled' },

  // `partial` — SEED-253. READ 2026-09-16: its own inline comment says "Phase 238 took OPTION 1
  // for Graph. Drive is STILL unpopulated." Graph was folded into a phase; Drive was not.
  partial:              { to: 'folded',   partial: true, why: 'READ SEED-253 — Graph half folded into Phase 238, Drive half still open' },

  // `partial-consumed` — SEED-001. READ 2026-09-16: `consumed_by: [Phase 073, Phase 079]` and a
  // `partial_note` saying load testing and the AnyIO ceiling audit remain. Consumed by phases is
  // folding; the remainder is what `partial: true` exists to say.
  'partial-consumed':   { to: 'folded',   partial: true, why: 'READ SEED-001 — consumed_by Phase 073 + 079, load testing still owed' },

  // ── the 12 orphans, individually. D-16 names this obligation explicitly. ──

  // `promoted` ×2 — SEED-100, SEED-101. READ BOTH 2026-09-16. Each carries a `promoted_to:` key
  // naming a real phase ("Phase 137.1 (EVAL-05)", "Phase 137.2 (CREATE-01)"), i.e. it means
  // BECAME A REQUIREMENT — which is `folded`, with the destination recorded in status_note.
  promoted:             { to: 'folded',   partial: false, why: 'READ SEED-100/101 — both carry promoted_to naming a real phase; became a requirement' },

  // `DONE` ×2 — SEED-063, SEED-064. READ BOTH. Both say code shipped and was live-verified
  // ("backend implemented + unit-tested + LIVE-VERIFIED"; "Sketch 017 option C shipped").
  DONE:                 { to: 'shipped',  partial: false, why: 'READ SEED-063/064 — both prose lines say code shipped and was live-verified' },

  // `done` ×1 — SEED-098. READ. Carries `shipped: 2026-06-30 (quick task 260630-226; commits
  // e3ff8623 + 37bd6d5c)`. Same reading as DONE, reached by READING, not by case-folding.
  done:                 { to: 'shipped',  partial: false, why: 'READ SEED-098 — carries a shipped: date and two commit hashes' },

  // `routed` ×1 — SEED-096. Routed to a destination is folding.
  routed:               { to: 'folded',   partial: false, why: 'routed to a destination is folding' },

  // `scheduled` ×1 — SEED-024. Named for a later slot, not being worked.
  scheduled:            { to: 'deferred', partial: false, why: 'named for a later slot' },

  // `queued` ×1 — SEED-002. Same shape as scheduled.
  queued:               { to: 'deferred', partial: false, why: 'named for a later slot' },

  // `in_progress` ×1 — SEED-188. Being worked now.
  in_progress:          { to: 'open',     partial: false, why: 'being worked now' },

  // `active` ×1 — SEED-005. Same shape as in_progress.
  active:               { to: 'open',     partial: false, why: 'being worked now' },

  // `resolved` ×1 — SEED-116. READ. `resolved_by: ".planning/notes/settings-control-room-boundary.md
  // (/gsd:explore session, operator-affirmed)"` — a QUESTION was settled by a document. No code
  // shipped, so `answered`, not `closed`.
  resolved:             { to: 'answered', partial: false, why: 'READ SEED-116 — settled by a note + operator ruling, no code' },

  // `fixed` ×1 — SEED-238. A defect stopped reproducing.
  fixed:                { to: 'closed',   partial: false, why: 'a defect that stopped reproducing is closed' },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-18 — the MECHANICAL backfill vocabulary. Two constants, and neither is free extraction.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * `trigger_paths` roots. A token counts as a path only if it contains `/` and starts at one of
 * these known top-level segments — everything else is left out rather than guessed at.
 */
const PATH_ROOTS = ['backend', 'frontend', 'scripts', 'docs', 'supabase', '.planning', '.claude'];

/** A bare filename counts only with one of these. ⛔ `.md` is deliberately absent — seed prose is
 *  full of `SEED-NNN-….md` cross-references and `**\/SEED-259-….md` is not a code trigger. */
const CODE_EXT = ['py', 'ts', 'tsx', 'js', 'jsx', 'cjs', 'mjs', 'sql', 'sh', 'css'];

/**
 * ⛔ `trigger_surfaces` IS A CONTROLLED ENUM, NOT FREE EXTRACTION, and the measurement is the
 *    reason: across all quoted terms in all 158 `trigger_when` values, the MOST FREQUENT term
 *    appears TWICE. Free extraction yields ~53 seeds each tagged with strings no other seed shares
 *    and no phase will ever declare — a matching axis with nothing on the other side.
 *
 * ⚠ THIS LIST IS ONE HALF OF A PAIR, NOT A TRIPLE: this literal and `.planning/seeds/TEMPLATE.md`'s
 *   inline enum comment. `check-seeds-register.cjs` holds NO copy on purpose — it matches a seed's
 *   values against the surfaces a PHASE declares (D-01/D-18), never against an enum of its own.
 *   One member per line, so the two can be compared as sorted sets mechanically.
 */
const SURFACE_VOCAB = [
  'admin',
  'auth',
  'chat',
  'connectors',
  'deployment',
  'harness',
  'ingestion',
  'library',
  'panel',
  'provider',
  'retrieval',
  'sandbox',
  'settings',
  'skills',
  'workflow',
];

/** Documented aliases only — plurals and two named synonyms. An unmapped term is LEFT OUT. */
const SURFACE_ALIASES = {
  workflows: 'workflow',
  connections: 'connectors',
  connector: 'connectors',
  connection: 'connectors',
  integrations: 'connectors',
  skill: 'skills',
  'skill studio': 'skills',
  providers: 'provider',
  chats: 'chat',
  panels: 'panel',
  libraries: 'library',
  sandboxes: 'sandbox',
  harnesses: 'harness',
  deploy: 'deployment',
  deployments: 'deployment',
  ingest: 'ingestion',
  authentication: 'auth',
  rbac: 'auth',
  setting: 'settings',
};

/** The keys this migration OWNS. Everything else passes through untouched, in its original order. */
const OWNED = new Set([
  'id', 'seed_id', 'title', 'status', 'surface', 'trigger_when',
]);

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Frontmatter REWRITING (not parsing — the parse is imported)
// ─────────────────────────────────────────────────────────────────────────────────────────────

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

/**
 * Split a frontmatter BLOCK into top-level key groups, preserving each group's lines verbatim.
 *
 * ⚠ This is a REWRITER, not a second boundary parser — it never decides where the block starts or
 *   ends, and it never reads a value. The continuation rule is the same one the imported reader
 *   uses (`/^\S/` ends a group), stated once so the two cannot answer differently.
 */
function keyGroups(block) {
  const lines = String(block).split(/\r?\n/);
  const groups = [];
  let cur = null;
  for (const l of lines) {
    if (/^\S/.test(l)) {
      const km = /^([A-Za-z_][A-Za-z0-9_-]*):/.exec(l);
      cur = { key: km ? km[1] : null, lines: [l] };
      groups.push(cur);
    } else if (cur) {
      cur.lines.push(l);
    } else {
      cur = { key: null, lines: [l] };
      groups.push(cur);
    }
  }
  return groups;
}

/** The line ending that dominates a stretch of text. Frontmatter only — the body is never touched. */
function dominantEol(text) {
  const crlf = (String(text).match(/\r\n/g) || []).length;
  const lf = (String(text).match(/\n/g) || []).length - crlf;
  return crlf >= lf ? '\r\n' : '\n';
}

/** A plain scalar when that is unambiguous; a `>` folded block when the text would break the shape. */
function scalarOrFolded(key, text) {
  const t = String(text).trim();
  if (t && !/:\s/.test(t) && !/\s#/.test(t) && !/^[[\]{}>|*&!%@`"'-]/.test(t) && !t.endsWith(':')) {
    return [`${key}: ${t}`];
  }
  return [`${key}: >`, ...t.split(/\r?\n/).map((l) => `  ${l}`)];
}

/** A `|` literal block — used where the claim is "verbatim", so folding must not join anything. */
function literalBlock(key, lines) {
  // An empty line stays empty — a `|` block preserves it either way, and two stray spaces read as
  // sloppiness in 51 files.
  return [`${key}: |`, ...lines.map((l) => (l === '' ? '' : `  ${l}`))];
}

/** A YAML bullet list. Emitted only when non-empty; an empty key is omitted, never written as `[]`. */
function bulletList(key, items) {
  return [`${key}:`, ...items.map((v) => `  - ${v}`)];
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// D-18's two mechanical extractors
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Trim the punctuation a path picks up from prose: backticks, quotes, brackets, trailing stops. */
function trimToken(t) {
  return String(t).replace(/^[`'"([]+/, '').replace(/[`'"),.;:\]]+$/, '');
}

/**
 * `trigger_paths` — MECHANICAL ONLY (D-18). Repo-relative paths under a known root, plus bare
 * filenames with a code extension. ⛔ Everything else is LEFT OUT; nothing is inferred from prose.
 */
function extractPaths(prose) {
  const text = String(prose);
  const out = new Set();
  const rootAlt = PATH_ROOTS.map((r) => r.replace('.', '\\.')).join('|');
  const full = new RegExp(`(?:^|[^A-Za-z0-9_/.-])((?:${rootAlt})/[A-Za-z0-9_./*-]+)`, 'g');
  let m;
  while ((m = full.exec(text)) !== null) {
    let p = trimToken(m[1]);
    if (!p || !p.includes('/')) continue;
    if (p.endsWith('/')) p = `${p}**`;
    else if (!/\*/.test(p) && !/\.[A-Za-z0-9]+$/.test(p.split('/').pop())) p = `${p}/**`;
    out.add(p);
  }
  const bare = new RegExp(`(?:^|[^A-Za-z0-9_/.-])([A-Za-z0-9_-]+\\.(?:${CODE_EXT.join('|')}))(?![A-Za-z0-9_./-])`, 'g');
  while ((m = bare.exec(text)) !== null) {
    const name = trimToken(m[1]);
    if (!name) continue;
    let already = false;
    for (const p of out) if (p.endsWith(`/${name}`)) already = true;
    if (!already) out.add(`**/${name}`);
  }
  return [...out].sort();
}

/**
 * `trigger_surfaces` — CONTROLLED ENUM (D-18). Only quoted or backticked terms are considered, and
 * only an exact vocabulary member or a documented alias survives. ⛔ Unmapped terms are LEFT OUT.
 */
function extractSurfaces(prose) {
  const text = String(prose);
  const out = new Set();
  const terms = [];
  for (const re of [/"([^"]{2,40})"/g, /`([^`]{2,40})`/g, /'([^']{2,40})'/g]) {
    let m;
    while ((m = re.exec(text)) !== null) terms.push(m[1]);
  }
  for (const raw of terms) {
    const t = raw.trim().toLowerCase().replace(/[.,;:!?]+$/, '');
    if (SURFACE_VOCAB.includes(t)) out.add(t);
    else if (SURFACE_ALIASES[t]) out.add(SURFACE_ALIASES[t]);
  }
  return [...out].sort();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The per-file plan
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** The H1, with a redundant `SEED-NNN —` / `SEED-NNN:` prefix dropped. `null` when there is none. */
function titleFromBody(bodyText) {
  const m = /^#[ \t]+(.+?)[ \t]*$/m.exec(String(bodyText));
  if (!m) return null;
  return m[1].replace(/^SEED-\d{3}\s*[—:–-]\s*/, '').trim() || null;
}

/**
 * Everything that happens to one seed, decided but NOT written.
 * `entry` = { file, id, buf, fm, fmEndBytes } — `fm` is `null` for the no-frontmatter path.
 */
function planFile(entry) {
  const canonical = `SEED-${entry.id}`;
  const bodyBuf = entry.buf.slice(entry.fmEndBytes);
  const bodyText = bodyBuf.toString('utf8');
  const plan = {
    file: entry.file,
    bodyBuf,
    bodyMd5: md5(bodyBuf),
    adds: [],
    rewrites: [],
    statusFrom: null,
    statusTo: null,
    partial: false,
    paths: [],
    surfaces: [],
    noFrontmatter: entry.fm === null,
  };

  // ── path 2 of 2: no `---` block at all (5 files). PREPEND a complete one; the body is the
  //    ENTIRE current file, so its md5 is the md5 of every byte the file has today.
  if (entry.fm === null) {
    const eol = dominantEol(bodyText);
    const title = titleFromBody(bodyText);
    const lines = [`seed_id: ${canonical}`];
    plan.adds.push('seed_id');
    if (title) {
      lines.push(...scalarOrFolded('title', title));
      plan.adds.push('title');
    }
    lines.push('status: planted');
    lines.push(...literalBlock('status_note', [
      'Phase 251 frontmatter migration: this file had NO frontmatter block at all, so no status was',
      'ever recorded for it. `planted` here is a MIGRATION DEFAULT — it is a statement about the',
      'absence, never a claim about the seed. Read the body and set it deliberately.',
    ]));
    lines.push('surface: Agentic-RAG');
    lines.push('trigger_when: unset');
    plan.adds.push('status', 'status_note', 'surface', 'trigger_when');
    plan.statusFrom = '(none)';
    plan.statusTo = 'planted';
    plan.newFm = Buffer.from(`---${eol}${lines.join(eol)}${eol}---${eol}`, 'utf8');
    plan.changed = true;
    return plan;
  }

  // ── path 1 of 2: a block exists. Rewrite the keys we own, pass everything else through. ──
  const fm = entry.fm;
  const eol = dominantEol(entry.buf.slice(0, entry.fmEndBytes).toString('utf8'));
  const groups = keyGroups(fm);
  const present = new Set(groups.map((g) => g.key).filter(Boolean));

  const migrationNotes = [];

  // `seed_id` — from the FILENAME, always. The filename is what a reference resolves against.
  const idRead = gate.readKey(fm, 'id');
  const seedIdRead = gate.readKey(fm, 'seed_id');

  // `title` — existing value wins; else the H1; else left out for the gate to name.
  const titleRead = gate.readKey(fm, 'title');
  const needTitle = !titleRead || !titleRead.value;
  const derivedTitle = needTitle ? titleFromBody(bodyText) : null;

  // `surface` — default `Agentic-RAG`; provably safe (only two values exist and both begin with it).
  const surfaceRead = gate.readKey(fm, 'surface');
  const needSurface = !surfaceRead || !surfaceRead.value;
  const surfaceOdd = !needSurface && surfaceRead.value !== 'Agentic-RAG';

  // `trigger_when` — the PROSE SURVIVES (D-01). The structured keys land beside it, never over it.
  const triggerRead = gate.readKey(fm, 'trigger_when');
  const prose = triggerRead && triggerRead.value ? triggerRead.value : '';
  const needTrigger = !prose;
  if (prose && prose !== 'unset') {
    if (!present.has('trigger_paths')) plan.paths = extractPaths(prose);
    if (!present.has('trigger_surfaces')) plan.surfaces = extractSurfaces(prose);
  }

  // `status` + `status_note` + `partial` (D-10 / D-16).
  const statusRead = gate.readKey(fm, 'status');
  let statusLines = null;
  if (statusRead) {
    const statusGroup = groups.find((g) => g.key === 'status');
    const rawValue = statusRead.shape === 'plain' ? String(statusRead.head) : String(statusRead.value);
    // ⛔ QUOTE-AWARE split, imported. A second comment-splitter written here would re-open exactly
    //    the quoted-`#` case the imported one already solves.
    const beforeHash = gate.stripComment(rawValue);
    const tok = beforeHash.trim().split(/\s+/)[0] || '';
    const mapping = STATUS_MAP[tok];
    if (!mapping) {
      throw new Refusal(
        `${entry.file}: \`status: ${tok}\` is not in the mapping table. ⛔ REFUSING to guess — `
        + 'D-10/D-16 require every token to have a LISTED destination. Add a row to STATUS_MAP with '
        + 'the reading that decided it, then re-run.'
      );
    }
    plan.statusFrom = tok;
    plan.statusTo = mapping.to;
    // Everything after the token, leading whitespace stripped, byte-for-byte (D-10).
    const afterToken = rawValue.slice(rawValue.indexOf(tok) + tok.length).replace(/^[ \t]+/, '');
    const tokenChanged = mapping.to !== tok;
    const wantNote = Boolean(afterToken) || tokenChanged || mapping.partial;
    const noteAlready = present.has('status_note');

    statusLines = [`status: ${mapping.to}`];
    if (mapping.partial && !present.has('partial')) {
      statusLines.push('partial: true');
      plan.adds.push('partial');
      plan.partial = true;
    } else if (mapping.partial) {
      plan.partial = true;
    }
    if (wantNote && !noteAlready) {
      const body = [
        'ORIGINAL `status:` line, verbatim — displaced by Phase 251\'s frontmatter migration (D-10):',
        ...statusGroup.lines,
      ];
      if (afterToken) {
        body.push('', 'The prose that followed the token, byte-for-byte:', afterToken);
      }
      body.push('', `Mapped \`${tok}\` -> \`${mapping.to}\`${mapping.partial ? ' + `partial: true`' : ''}. Reason: ${mapping.why}.`);
      statusLines.push(...literalBlock('status_note', body));
      plan.adds.push('status_note');
    } else if (wantNote && noteAlready) {
      // ⛔ NEVER double-wrap. One seed (SEED-231) already carries a status_note; its content is
      //    someone's deliberate prose and this migration does not own it.
      migrationNotes.push(
        `a \`status_note:\` already existed, so this migration did NOT touch it. The displaced status line was:`,
        ...statusGroup.lines
      );
    }
    if (statusLines.length > 1 || statusLines[0] !== statusGroup.lines.join('')) plan.rewrites.push('status');
  }

  // Displaced keys -> `migration_note`. ⛔ Nothing is dropped, in either register.
  //
  // ⚠ THIS APPLIES TO `seed_id:` AS WELL AS `id:`, and that is not symmetry for its own sake — it
  //   was a REAL defect caught in the dry run before any write. Two files would have lost content:
  //   `SEED-068` carries `seed_id: SEED-068  # renumbered from SEED-063 …`, which is this project's
  //   own renumbering precedent, and `SEED-092-remainder.md` carries `seed_id: SEED-092-remainder`,
  //   a value that DISAGREES with its filename and is one half of a live duplicate-id pair. A rule
  //   that only watched the legacy spelling would have deleted both.
  for (const key of ['id', 'seed_id']) {
    const g = groups.find((gr) => gr.key === key);
    if (!g) continue;
    const bare = `${key}: ${canonical}`;
    if (g.lines.length > 1 || g.lines[0].trim() !== bare) {
      migrationNotes.push(
        `the \`${key}:\` key was normalised to \`seed_id: ${canonical}\` (D-09 — the FILENAME is what a`,
        `reference resolves against). Its original line(s), verbatim:`,
        ...g.lines
      );
    }
  }
  if (surfaceOdd) {
    const sgroup = groups.find((g) => g.key === 'surface');
    migrationNotes.push(
      `\`surface:\` was normalised to \`Agentic-RAG\`. Its original line(s), verbatim:`,
      ...sgroup.lines
    );
  }

  // ── assemble ──
  const head = [];
  if (!seedIdRead && !idRead) {
    head.push(`seed_id: ${canonical}`);
    plan.adds.push('seed_id');
  }
  if (needTitle && derivedTitle) {
    head.push(...scalarOrFolded('title', derivedTitle));
    plan.adds.push('title');
  }

  const out = [];
  for (const g of groups) {
    if (g.key === 'id' || g.key === 'seed_id') {
      const line = `seed_id: ${canonical}`;
      if (g.lines.length > 1 || g.lines[0] !== line) plan.rewrites.push(g.key);
      out.push(line);
      continue;
    }
    if (g.key === 'status' && statusLines) {
      out.push(...statusLines);
      continue;
    }
    if (g.key === 'surface' && surfaceOdd) {
      out.push('surface: Agentic-RAG');
      plan.rewrites.push('surface');
      continue;
    }
    out.push(...g.lines);
    if (g.key === 'trigger_when') {
      if (plan.paths.length) {
        out.push(...bulletList('trigger_paths', plan.paths));
        plan.adds.push('trigger_paths');
      }
      if (plan.surfaces.length) {
        out.push(...bulletList('trigger_surfaces', plan.surfaces));
        plan.adds.push('trigger_surfaces');
      }
    }
  }

  const tail = [];
  if (needSurface) {
    tail.push('surface: Agentic-RAG');
    plan.adds.push('surface');
  }
  if (needTrigger) {
    // D-02: VISIBLE as unswept, never silently absent. ⛔ Never invent a trigger.
    tail.push('trigger_when: unset');
    plan.adds.push('trigger_when');
  }
  if (migrationNotes.length && !present.has('migration_note')) {
    tail.push(...literalBlock('migration_note', migrationNotes));
    plan.adds.push('migration_note');
  }

  const block = [...head, ...out, ...tail].join(eol);
  const closingNewline = entry.fmRaw.endsWith('\n') ? eol : '';
  plan.newFm = Buffer.from(`---${eol}${block}${eol}---${closingNewline}`, 'utf8');
  plan.changed = !plan.newFm.equals(entry.buf.slice(0, entry.fmEndBytes));
  return plan;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The write, and the read-back that gates the success line
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Write `newFm + bodyBuf`, then RE-READ from disk, re-locate the boundary through the SAME imported
 * reader, re-slice the raw body and re-hash it. Returns `{ ok, actual }`.
 *
 * ⭐ `gate the success line on the write, not on reach` (`agent-bus.sh:145-147`). A caller may print
 *    `N files changed` only when N writes landed AND N hashes matched.
 * ⛔ T-251-11: the resolved target must sit inside `dir`, checked boundary-safely rather than by a
 *    bare prefix match. This script takes no path argument from the CLI at all.
 */
function writeAndVerify(dir, file, newFm, bodyBuf, expectedBodyMd5) {
  const target = path.resolve(dir, file);
  const base = path.resolve(dir);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Refusal(`refusing to write outside the register: ${target}`);
  }
  fs.writeFileSync(target, Buffer.concat([newFm, bodyBuf]));

  const after = fs.readFileSync(target);
  const afterText = after.toString('utf8');
  const m = gate.frontmatter(afterText);
  if (!m) return { ok: false, actual: '(no frontmatter block after the write)' };
  const offset = Buffer.byteLength(afterText.slice(0, m[0].length), 'utf8');
  const actual = md5(after.slice(offset));
  return { ok: actual === expectedBodyMd5, actual };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The run
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Read the register from `dir` — a PARAMETER, never taken from argv, so the self-test can point
 * exactly this code at a temp fixture without the CLI ever growing a path flag (T-251-11).
 */
function readSeeds(dir) {
  const names = fs.readdirSync(dir).filter((f) => SEED_FILE_RE.test(f)).sort();
  return names.map((f) => {
    const buf = fs.readFileSync(path.join(dir, f));
    const text = buf.toString('utf8');
    // ⭐ CALL SITE 1 of 2 — the ONLY boundary authority in this phase. The decode exists solely to
    //    locate the boundary; it never produces the bytes that are hashed or written.
    const m = gate.frontmatter(text);
    const fmEndBytes = m ? Buffer.byteLength(text.slice(0, m[0].length), 'utf8') : 0;
    return {
      file: f,
      id: SEED_FILE_RE.exec(f)[1],
      buf,
      fm: m ? m[1] : null,
      fmRaw: m ? m[0] : '',
      fmEndBytes,
    };
  });
}

function migrate({ dir, apply = false, quiet = false, log = console.log }) {
  const entries = readSeeds(dir);
  if (!entries.length) {
    throw new Refusal(
      `the register at ${dir} resolved ZERO files. A migration that passes over nothing is worse `
      + 'than absent — refusing to report a verdict.'
    );
  }

  const plans = entries.map((e) => ({ entry: e, plan: planFile(e) }));
  const changed = plans.filter((p) => p.plan.changed);

  const tally = new Map();
  const addTally = new Map();
  let pathsSeeds = 0;
  let surfSeeds = 0;
  let pathsTotal = 0;
  let partialCount = 0;
  for (const { plan } of plans) {
    if (plan.statusFrom) {
      const k = `${plan.statusFrom} -> ${plan.statusTo}`;
      tally.set(k, (tally.get(k) || 0) + 1);
    }
    for (const a of plan.adds) addTally.set(a, (addTally.get(a) || 0) + 1);
    if (plan.paths.length) { pathsSeeds++; pathsTotal += plan.paths.length; }
    if (plan.surfaces.length) surfSeeds++;
    if (plan.partial) partialCount++;
  }

  if (!quiet) {
    for (const { entry, plan } of plans) {
      if (!plan.changed) continue;
      const bits = [];
      if (plan.adds.length) bits.push(`+${plan.adds.join(' +')}`);
      if (plan.rewrites.length) bits.push(`~${[...new Set(plan.rewrites)].join(' ~')}`);
      if (plan.statusFrom && plan.statusFrom !== plan.statusTo) {
        bits.push(`status ${plan.statusFrom} -> ${plan.statusTo}${plan.partial ? ' +partial' : ''}`);
      }
      if (plan.noFrontmatter) bits.push(`${YEL}NO BLOCK — prepending${RST}`);
      log(`  ${entry.file}`);
      log(`      ${DIM}${bits.join('  ·  ')}${RST}`);
    }
  }

  let wrote = 0;
  let verified = 0;
  if (apply) {
    for (const { entry, plan } of changed) {
      const r = writeAndVerify(dir, entry.file, plan.newFm, plan.bodyBuf, plan.bodyMd5);
      wrote++;
      if (!r.ok) {
        throw new Refusal(
          `${entry.file}: BODY md5 CHANGED across the write — expected ${plan.bodyMd5}, got ${r.actual}. `
          + 'D-11 is the whole point of this script; aborting the run before any further write. '
          + `${wrote - 1} file(s) were already written and are intact.`
        );
      }
      verified++;
    }
  }

  return {
    dir,
    scanned: entries.length,
    changed: changed.length,
    wrote,
    verified,
    tally,
    addTally,
    pathsSeeds,
    pathsTotal,
    surfSeeds,
    partialCount,
    noFrontmatter: plans.filter((p) => p.plan.noFrontmatter).length,
    digests: plans.map((p) => `${p.entry.file}:${p.plan.bodyMd5}`),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// --self-test — the arms, re-runnable forever (S-7: a guard nobody has seen fire is not a guard)
//
// ⛔ Every write below goes under `fs.mkdtempSync(os.tmpdir())`. `SEEDS_DIR` is unreachable from
//    any self-test path — a migration that can touch the real register by accident is this phase's
//    own threat (T-251-11).
// ─────────────────────────────────────────────────────────────────────────────────────────────

function runSelfTest() {
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seeds-migrate-'));
  const arms = [];
  const record = (n, name, pass, detail) => arms.push({ n, name, pass, detail });

  const fixtureDir = path.join(tmp, 'reg');
  fs.mkdirSync(fixtureDir);
  const write = (name, text) => {
    const p = path.resolve(fixtureDir, name);
    if (!p.startsWith(path.resolve(fixtureDir) + path.sep)) throw new Error('containment guard');
    fs.writeFileSync(p, Buffer.from(text, 'utf8'));
    return p;
  };

  // A CRLF seed with a legacy `id:`, an orphan status carrying prose, and a folded trigger naming
  // a real path — i.e. every transform at once.
  const F1 = 'SEED-901-crlf-orphan-status.md';
  const f1Body = '\r\n# SEED-901 — the CRLF one\r\n\r\n---\r\n\r\nA bare `---` rule lives in this body.\r\n';
  write(F1,
    '---\r\nid: SEED-901\r\nstatus: DONE ✅ — shipped and verified\r\n'
    + 'trigger_when: >\r\n  Any phase touching `backend/app/config.py` or the "workflow" surface.\r\n'
    + 'priority: high\r\n---' + f1Body);

  // An LF seed with nothing but a status.
  const F2 = 'SEED-902-bare.md';
  const f2Body = '\n# SEED-902: nothing but a status\n\nbody text\n';
  write(F2, '---\nstatus: planted\n---' + f2Body);

  // A seed with NO frontmatter block at all — the second code path.
  const F3 = 'SEED-903-no-block.md';
  const f3Whole = '# SEED-903 — no block at all\r\n\r\nthe whole file is the body\r\n';
  write(F3, f3Whole);

  const digest = () => fs.readdirSync(fixtureDir).sort()
    .map((f) => `${f}:${md5(fs.readFileSync(path.join(fixtureDir, f)))}`).join('\n');
  const bodyOf = (f) => fs.readFileSync(path.join(fixtureDir, f));

  // ── arm 1 — DRY RUN CHANGES NOTHING ──
  const before = digest();
  migrate({ dir: fixtureDir, apply: false, quiet: true, log: () => {} });
  record(1, 'a dry run writes NOTHING', digest() === before,
    digest() === before ? '' : 'the fixture digest moved during a dry run');

  // Body digests taken the D-11 way, before anything is written.
  const f1BodyMd5 = md5(Buffer.from(f1Body, 'utf8'));
  const f2BodyMd5 = md5(Buffer.from(f2Body, 'utf8'));
  const f3WholeMd5 = md5(Buffer.from(f3Whole, 'utf8'));

  // ── arm 2 — --apply backfills the contract and the gate stops finding gaps ──
  const r2 = migrate({ dir: fixtureDir, apply: true, quiet: true, log: () => {} });
  const a2 = gate.analyse({ dir: fixtureDir });
  const missing = a2.findings.filter((f) => f.code === 'missing-key' || f.code === 'no-frontmatter' || f.code === 'unknown-status');
  record(2, '--apply leaves 0 missing-key / unknown-status / no-frontmatter', missing.length === 0,
    missing.length ? missing.map((f) => `${f.code} ${f.file || f.rel}`).join(', ') : `${r2.wrote} written`);

  // ── arm 3 — ⭐ THE BODY INVARIANT: every body byte-identical, hashed over RAW Buffers ──
  const b1 = bodyOf(F1);
  const b2 = bodyOf(F2);
  const b3 = bodyOf(F3);
  const keptF1 = md5(b1.slice(b1.length - Buffer.byteLength(f1Body, 'utf8'))) === f1BodyMd5;
  const keptF2 = md5(b2.slice(b2.length - Buffer.byteLength(f2Body, 'utf8'))) === f2BodyMd5;
  const keptF3 = md5(b3.slice(b3.length - Buffer.byteLength(f3Whole, 'utf8'))) === f3WholeMd5;
  record(3, 'every BODY is md5-identical over raw Buffers (CRLF, LF and no-block)',
    keptF1 && keptF2 && keptF3 && r2.verified === r2.wrote,
    `F1=${keptF1} F2=${keptF2} F3=${keptF3} verified=${r2.verified}/${r2.wrote}`);

  // ── arm 4 — idempotent: a second --apply changes 0 ──
  const r4 = migrate({ dir: fixtureDir, apply: true, quiet: true, log: () => {} });
  record(4, 'a second --apply reports 0 files changed', r4.changed === 0, `changed=${r4.changed}`);

  // ── arm 5 — ⭐ THE COUNTERFACTUAL: the refusal FIRES when a body does NOT match ──
  // Driven against the real write path with a deliberately wrong expected digest. An arm that only
  // watches the happy path proves the code RAN, never that it would REFUSE.
  let fired = false;
  let detail5 = '';
  try {
    const probe = bodyOf(F2);
    const res = writeAndVerify(fixtureDir, F2, Buffer.from('---\nstatus: planted\n---\n', 'utf8'),
      probe.slice(probe.length - Buffer.byteLength(f2Body, 'utf8')), 'deadbeefdeadbeefdeadbeefdeadbeef');
    fired = res.ok === false;
    detail5 = `ok=${res.ok} actual=${res.actual}`;
  } catch (e) {
    detail5 = String(e && e.message);
  }
  record(5, 'the body-invariant REFUSES when the digest disagrees', fired, detail5);

  // ── arm 6 — an unruled status token REFUSES rather than coercing ──
  write('SEED-904-unruled.md', '---\nstatus: teleported\n---\n\n# SEED-904 — unruled\n');
  let refused = false;
  let detail6 = '';
  try {
    migrate({ dir: fixtureDir, apply: false, quiet: true, log: () => {} });
    detail6 = 'the run completed — an unlisted token was silently coerced';
  } catch (e) {
    refused = e instanceof Refusal && /teleported/.test(String(e.message));
    detail6 = String(e && e.message).split('\n')[0];
  }
  record(6, 'an unlisted status token REFUSES, never coerces', refused, detail6);

  // ── arm 7 — ⛔ the write path cannot escape its directory ──
  let contained = false;
  try {
    writeAndVerify(fixtureDir, path.join('..', 'escape.md'), Buffer.from('---\n---\n'), Buffer.alloc(0), md5(Buffer.alloc(0)));
  } catch (e) {
    contained = e instanceof Refusal;
  }
  record(7, 'a write outside the register is REFUSED', contained, '');

  console.log(`\nseeds frontmatter migration — self-test (fixture register under ${os.tmpdir()}, real register untouched)`);
  let pass = 0;
  for (const a of arms) {
    if (a.pass) pass++;
    console.log(`  arm ${a.n} ${a.name} … ${a.pass ? `${GRN}PASS${RST}` : `${RED}FAIL${RST}`}`);
    if (!a.pass && a.detail) console.log(`      ${a.detail}`);
  }
  const ok = pass === arms.length;
  console.log(
    `\nself-test ${pass}/${arms.length} arms ${ok ? 'PASS' : 'PASS — the migration cannot be trusted until every arm is green'}`
    + (ok ? ' — dry-run inertness, the contract, the RAW-Buffer body invariant, idempotency, the refusal, the mapping floor, containment.' : '.')
  );
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* temp dir */ }
  return ok ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('usage: node scripts/migrate-seeds-frontmatter.cjs [--apply] [--quiet] [--self-test]');
    return 0;
  }
  if (argv.includes('--self-test')) return runSelfTest();

  const apply = argv.includes('--apply');
  const quiet = argv.includes('--quiet');

  console.log(`\nseeds frontmatter migration — ${path.relative(root, SEEDS_DIR).split(path.sep).join('/')}`);
  console.log(`  mode: ${apply ? `${YEL}--apply (writing)${RST}` : `${GRN}DRY RUN (nothing is written)${RST}`}`);

  const r = migrate({ dir: SEEDS_DIR, apply, quiet });

  console.log(`\n  scanned              : ${r.scanned} file(s)`);
  console.log(`  no frontmatter block : ${r.noFrontmatter} (block PREPENDED; body = the whole current file)`);
  console.log(`  ${apply ? 'files changed        ' : 'files that WOULD change'}: ${r.changed}`);

  const addRows = [...r.addTally.entries()].sort((a, b) => b[1] - a[1]);
  if (addRows.length) {
    console.log('\n  keys added:');
    for (const [k, n] of addRows) console.log(`    ${String(n).padStart(4)}  ${k}`);
  }

  const mapRows = [...r.tally.entries()].sort((a, b) => b[1] - a[1]);
  console.log('\n  status mapping, token by token:');
  for (const [k, n] of mapRows) {
    const moved = !/^(\S+) -> \1$/.test(k);
    console.log(`    ${String(n).padStart(4)}  ${k}${moved ? `  ${YEL}<- mapped${RST}` : ''}`);
  }
  console.log(`    ${String(r.partialCount).padStart(4)}  carry \`partial: true\` (D-16)`);

  // ⛔ D-18's TWO figures, and neither is a claim. A backfill that reports only the first number is
  //    the comfortable lie REG-02 exists to end.
  console.log('\n  D-18 — the mechanical backfill, measured rather than claimed:');
  console.log(`    ${String(r.pathsSeeds).padStart(4)}  seed(s) yielded a \`trigger_paths\` (${r.pathsTotal} glob(s) total)`);
  console.log(`    ${String(r.surfSeeds).padStart(4)}  seed(s) yielded a \`trigger_surfaces\` from the controlled enum`);
  console.log(`          ⚠ every other seed stays unswept. Run \`node scripts/check-seeds-register.cjs\``);
  console.log('            for the two figures that must BOTH shrink.');

  if (apply) {
    // The success line is gated on the WRITE, not on reach (`agent-bus.sh:145-147`).
    console.log(`\n  ${GRN}${r.wrote} files changed${RST}`);
    console.log(`  ${GRN}bodies verified md5-identical: ${r.verified}/${r.wrote}${RST}`);
    console.log(`  ${DIM}(digests taken over RAW Buffers, before and after, in this same process run)${RST}`);
  } else {
    console.log(`\n  ${DIM}DRY RUN — nothing was written. Re-run with --apply.${RST}`);
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (e) {
    if (e instanceof Refusal) {
      console.error(`\n${RED}REFUSED${RST}: ${e.message}`);
      process.exit(1);
    }
    fail(e && e.stack ? e.stack : String(e));
  }
}

module.exports = {
  migrate, planFile, writeAndVerify, readSeeds, keyGroups, dominantEol,
  extractPaths, extractSurfaces, titleFromBody,
  STATUS_MAP, SURFACE_VOCAB, SURFACE_ALIASES, PATH_ROOTS, CODE_EXT, Refusal, md5,
};

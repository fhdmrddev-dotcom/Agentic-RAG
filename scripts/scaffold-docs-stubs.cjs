#!/usr/bin/env node
/**
 * scripts/scaffold-docs-stubs.cjs — Phase 276 (276-04 Task 1, D-07).
 *
 * Writes a tracked STUB page for every docs/public/sections.json slug that has no file yet and
 * is not one of the hand-written pages (WRITTEN below). Mechanical on purpose, so judgement goes
 * to the written pages.
 *
 *   node scripts/scaffold-docs-stubs.cjs             write the missing stubs
 *   node scripts/scaffold-docs-stubs.cjs --dry-run   print the plan, write nothing
 *
 * ⛔ Idempotent and NEVER overwrites an existing file — a stub that has been hand-edited (or
 *    promoted to a written page) is left alone. Re-running after the first run reports 0 files.
 *
 * Inputs (all read, never written):
 *   .planning/research/docs-coverage-inventory.md      ID, Surface, Status, Audience, doc page
 *   .planning/research/docs-information-architecture.md slug, Title, Audience, Purpose, Covers, Video
 *   docs/public/sections.json                           the IA tree (D-02)
 *   docs/public/api/openapi.public.json                 which routers are in the public reference
 *   backend/app/api/*.py                                each router module's tags
 * Code keys come from extractCodeKeys() in scripts/lib/docs-content.cjs — there is no second
 * extractor here. Ownership of each key is the declared prefix → slug table below.
 *
 * The keys owned by a WRITTEN page are PRINTED (that page's covers are hand-maintained), never
 * written into a file.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const docs = require('./lib/docs-content.cjs');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

const INVENTORY = '.planning/research/docs-coverage-inventory.md';
const IA = '.planning/research/docs-information-architecture.md';
const SECTIONS = 'docs/public/sections.json';
const PUBLIC_SPEC = 'docs/public/api/openapi.public.json';
const DOCS_ROOT = 'docs/public';

/** The hand-written pages (D-06, as amended by 276-04: 31). Everything else is a stub. */
const WRITTEN = [
  'get-started/overview',
  'get-started/quickstart',
  'get-started/sign-in',
  'get-started/workspaces-and-orgs',
  'get-started/navigating-syrel',
  'get-started/key-concepts',
  'use/chat',
  'use/chat-modes',
  'use/library/documents',
  'use/library/ingestion',
  'use/library/find',
  'use/library/document-detail',
  'automate/workflows/overview',
  'automate/workflows/builder',
  'automate/workflows/publish',
  'experts/what-are-experts',
  'experts/catalog',
  'experts/using-experts',
  'experts/authoring',
  'security/data-isolation',
  'security/secrets',
  'security/egress-controls',
  'security/sandbox-isolation',
  'security/audit-trails',
  'security/prompt-injection',
  'api/concepts/authentication',
  'api/concepts/orgs-and-rls',
  'api/concepts/streaming',
  'api/concepts/errors',
  'api/reference/operator',
  'api/internal-endpoints',
];

/** IA rows whose slug is a pattern rather than a page; their covers move to a real page. */
const IA_SLUG_REDIRECT = {
  'api/reference/<tag>': 'api/overview', // the generated reference lives behind api/overview
};

/** The six Remotion clips that exist (UI-SPEC slot map). Other IA `clip` cells get a
 *  clip.<slug> key, which resolves to nothing until a clip is made (V0, D-13). */
const CLIP_KEYS = {
  'use/chat': 'clip.chat',
  'use/library/documents': 'clip.library',
  'automate/workflows/builder': 'clip.workflows',
  'connect/overview': 'clip.connections',
  'experts/catalog': 'clip.experts',
  'administer/control-room/control-plane': 'clip.admin',
};

/** Code-key ownership — the declared prefix → slug table (276-04 Task 1). */
const VIEW_PAGE = {
  chat: 'use/chat',
  documents: 'use/library/documents',
  skills: 'automate/skills/overview',
  settings: 'administer/settings/ai-model',
  workflows: 'automate/workflows/library',
  connections: 'connect/overview',
  'skill-studio': 'automate/skills/evals',
  'control-room': 'administer/control-room/control-plane',
  'org-admin': 'administer/org/members',
  'workflow-run': 'automate/workflows/runs',
  'admin-spend': 'administer/control-room/spend',
  experts: 'experts/catalog',
};
const SETTINGS_TAB_PAGE = {
  'ai-model': 'administer/settings/ai-model',
  search: 'administer/settings/search',
  integrations: 'administer/settings/integrations',
  memory: 'use/memory',
  'audit-log': 'security/audit-trails',
};
const NAV_HOME = 'get-started/navigating-syrel';
const TOOL_HOME = 'use/agent-tools';
const STEP_HOME = 'automate/workflows/step-types';
const CHECK_HOME = 'automate/workflows/checks';
const ROUTER_PUBLIC_HOME = 'api/overview';
const ROUTER_INTERNAL_HOME = 'api/internal-endpoints';
/** main.py imports two modules under an alias. */
const ROUTER_MODULE_FILE = { settings_api: 'settings', setup_api: 'setup' };

/**
 * Pages where the mechanical "every covered row is v4.5 → release: v4.5" rule would be false.
 * Filing rules: classification rules ship today (prod: the Classification rail entry); only
 * the move into the Library as "Filing rules" is v4.5 (Phase 271). Saying "Nothing on this page
 * is in Syrel today" would deny a shipped feature, so the page is shipped with A17 unreleased.
 */
const RELEASE_OVERRIDE = {
  'use/library/filing-rules': { release: 'shipped', unreleased: ['A17'] },
};

/** Covers for IA rows whose Covers cell names no inventory row ("(h.2)"). */
const COVERS_OVERRIDE = {
  'api/roadmap-open-platform': ['H41', 'H45', 'H47'],
};

/** Third-party API access pages — the summary must say "Not available today." (SEED-013). */
const SUMMARY_OVERRIDE = {
  'api/concepts/webhooks':
    'Syrel receives no webhooks today: the only inbound callbacks are the two OAuth sign-in redirects, and outbound calls happen only through workflow external-action steps. Not available today. Inbound webhooks are part of the Open Platform plan (SEED-013); see Authentication for how a script talks to the API now.',
  'api/concepts/limits-and-spend':
    'Syrel has no HTTP rate limits today; what exists is per-run token caps (a run pauses when it reaches its cap), tier entitlements and an operator spend ledger. Rate limits are not available today; per-organisation limits are planned (SEED-345) and API access beyond a signed-in user is the Open Platform plan (SEED-013). See Errors for the responses a refusal returns.',
  'api/roadmap-open-platform':
    'API keys, personal access tokens, service accounts, webhooks and a Syrel MCP server are not available today. The planned answer is the Open Platform work tracked as SEED-013, with no release date set. Until then a script signs in as a user; see Authentication.',
};

// ── parsing ─────────────────────────────────────────────────────────────────────────────

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
}

function splitRow(line) {
  // "| a | b | c |" → ["a","b","c"]; a `|` inside backticks does not appear in these tables.
  return line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

/** Every Markdown table in `text` → [{ header: [...], rows: [[...]] }]. */
function tables(text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\|/.test(lines[i]) && /^\|[\s|:-]+\|\s*$/.test(lines[i + 1])) {
      const t = { header: splitRow(lines[i]), rows: [] };
      let j = i + 2;
      while (j < lines.length && /^\|/.test(lines[j])) {
        t.rows.push(splitRow(lines[j]));
        j++;
      }
      out.push(t);
      i = j - 1;
    }
  }
  return out;
}

/** "B1-B11" → [B1..B11]; "A5" → [A5]; anything else → []. */
function expandIds(token) {
  const t = token.replace(/[()`*]/g, '').trim();
  const range = /^([A-I])(\d+)\s*[-–]\s*([A-I])?(\d+)$/.exec(t);
  if (range) {
    const [, p, a, , b] = range;
    const out = [];
    for (let n = Number(a); n <= Number(b); n++) out.push(p + n);
    return out;
  }
  return /^[A-I]\d+$/.test(t) ? [t] : [];
}

function slugsIn(cell) {
  return Array.from(cell.matchAll(/`([a-z0-9-]+(?:\/[a-z0-9-]+)+)(?:#[a-z0-9-]+)?`/g), (m) => m[1]);
}

function parseInventory() {
  // Phase 276-05: the inventory reader moved to scripts/lib/docs-content.cjs (one home, shared with
  // scripts/check-docs-coverage.cjs).
  return docs.parseInventory(read(INVENTORY));
}

function parseIA() {
  const rows = [];
  for (const t of tables(read(IA))) {
    if (t.header[0] !== 'Slug') continue;
    for (const r of t.rows) {
      const m = /^`([^`]+)`$/.exec(r[0]);
      if (!m) continue;
      const covers = r[4].split(',').flatMap((tok) => expandIds(tok));
      rows.push({ slug: m[1], title: r[1], audience: r[2], purpose: r[3], covers, video: r[5] });
    }
  }
  return rows;
}

/** Router module → its APIRouter tags, read from backend/app/api/<module>.py. */
function routerTags(module) {
  const file = `backend/app/api/${ROUTER_MODULE_FILE[module] || module}.py`;
  const src = read(file);
  const tags = [];
  for (const m of src.matchAll(/APIRouter\(([\s\S]*?)\)/g)) {
    const t = /tags\s*=\s*\[([^\]]*)\]/.exec(m[1]);
    if (t) for (const q of t[1].matchAll(/"([^"]+)"/g)) tags.push(q[1]);
  }
  return tags;
}

function publicTags() {
  const spec = JSON.parse(read(PUBLIC_SPEC));
  const tags = new Set();
  for (const ops of Object.values(spec.paths)) {
    for (const op of Object.values(ops)) if (op && Array.isArray(op.tags)) op.tags.forEach((x) => tags.add(x));
  }
  return tags;
}

// ── planning ────────────────────────────────────────────────────────────────────────────

function statusKind(status) {
  return docs.inventoryStatusKind(status);
}

const AUDIENCE_WORD = { user: 'any member', admin: 'organisation admins', operator: 'platform operators', developer: 'developers' };

function statusSentence(kinds, audience) {
  if (kinds.length && kinds.every((k) => k === 'v4.5')) return 'This is part of v4.5, which has not shipped yet.';
  if (kinds.includes('locked')) return 'Syrel shows it as a "coming soon" tab today, with no capability behind it yet.';
  if (kinds.includes('not-built')) return 'Not available today.';
  if (kinds.includes('gated')) return `It is visible only to ${AUDIENCE_WORD[audience] || audience}.`;
  if (kinds.includes('flag')) return 'It has shipped, and an operator controls whether it is switched on.';
  return 'It is available today.';
}

function lowerFirst(s) {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

function plan() {
  const sections = docs.readSections(path.join(ROOT, SECTIONS));
  const inventory = parseInventory();
  const ia = parseIA();
  const keys = docs.extractCodeKeys(ROOT);
  const pubTags = publicTags();
  const writtenSet = new Set(WRITTEN);
  const allSlugs = sections.flatMap((s) => s.slugs);
  const known = new Set(allSlugs);

  const covers = new Map(allSlugs.map((s) => [s, new Set()]));
  const add = (slug, key) => {
    if (!covers.has(slug)) throw new Error(`[scaffold] ${slug} is not a sections.json slug (key ${key})`);
    covers.get(slug).add(key);
  };
  const warnings = [];

  // Inventory "Proposed doc page" column.
  for (const row of inventory) {
    for (const slug of row.pages) {
      if (known.has(slug)) add(slug, row.id);
      else warnings.push(`inventory ${row.id} names ${slug}, which is not a sections.json slug`);
    }
  }
  // IA Covers column (expands ranges; the generated-reference row moves to api/overview).
  const iaBySlug = new Map();
  for (const r of ia) {
    const slug = IA_SLUG_REDIRECT[r.slug] || r.slug;
    if (!IA_SLUG_REDIRECT[r.slug]) iaBySlug.set(slug, r);
    if (!known.has(slug)) {
      if (!/^changelog\//.test(slug)) warnings.push(`IA row ${r.slug} is not a sections.json slug`);
      continue;
    }
    for (const id of r.covers) add(slug, id);
  }
  for (const [slug, ids] of Object.entries(COVERS_OVERRIDE)) ids.forEach((id) => add(slug, id));

  // Code keys.
  for (const v of keys.nav) add(NAV_HOME, `nav:${v}`);
  for (const v of keys.view) {
    add(NAV_HOME, `view:${v}`);
    if (VIEW_PAGE[v]) add(VIEW_PAGE[v], `view:${v}`);
    else warnings.push(`view:${v} has no owning page in VIEW_PAGE`);
  }
  for (const t of keys.tool) add(TOOL_HOME, `tool:${t}`);
  for (const s of keys.step) add(STEP_HOME, `step:${s}`);
  for (const c of keys.check) add(CHECK_HOME, `check:${c}`);
  for (const m of keys.router) {
    const isPublic = routerTags(m).some((t) => pubTags.has(t));
    add(isPublic ? ROUTER_PUBLIC_HOME : ROUTER_INTERNAL_HOME, `router:${m}`);
  }
  for (const t of keys.settingsTab) {
    if (SETTINGS_TAB_PAGE[t]) add(SETTINGS_TAB_PAGE[t], `settings-tab:${t}`);
    else warnings.push(`settings-tab:${t} has no owning page`);
  }

  const invById = new Map(inventory.map((r) => [r.id, r]));
  const titleOf = (slug) => (iaBySlug.get(slug) || {}).title || slug;

  const nearestFor = (slug) => {
    const section = sections.find((s) => s.slugs.includes(slug));
    const group = (section.groups || []).find((g) => g.slugs.includes(slug));
    const pick = (list) => list.find((s) => writtenSet.has(s) && s !== slug);
    return (group && pick(group.slugs)) || pick(section.slugs) || 'get-started/overview';
  };

  const stubs = [];
  const writtenKeys = {};
  for (const section of sections) {
    for (const slug of section.slugs) {
      const cov = Array.from(covers.get(slug));
      if (writtenSet.has(slug)) {
        writtenKeys[slug] = cov;
        continue;
      }
      const iaRow = iaBySlug.get(slug);
      if (!iaRow) throw new Error(`[scaffold] no IA row for ${slug}`);
      const invIds = cov.filter((c) => /^[A-I]\d+$/.test(c));
      if (cov.length === 0) throw new Error(`[scaffold] ${slug} would have an empty covers list`);
      const kinds = invIds.map((id) => statusKind((invById.get(id) || {}).status || ''));
      let release = invIds.length && kinds.every((k) => k === 'v4.5') ? 'v4.5' : 'shipped';
      let unreleased = release === 'shipped' ? invIds.filter((id, i) => kinds[i] === 'v4.5') : [];
      if (RELEASE_OVERRIDE[slug]) ({ release, unreleased } = RELEASE_OVERRIDE[slug]);

      const nearest = nearestFor(slug);
      let video = null;
      if (/^clip$/i.test(iaRow.video)) video = CLIP_KEYS[slug] || `clip.${slug.replace(/\//g, '-')}`;
      else if (/^explainer$/i.test(iaRow.video)) video = `explainer.${slug.replace(/\/overview$/, '').replace(/\//g, '-')}`;

      const audience = iaRow.audience.split('/')[0];
      const summary =
        SUMMARY_OVERRIDE[slug] ||
        [
          `This page covers ${lowerFirst(iaRow.purpose.replace(/`/g, '').replace(/\.$/, ''))}.`,
          statusSentence(kinds, audience),
          `Until the full guide is written, start with ${titleOf(nearest)}.`,
        ].join(' ');

      stubs.push({ slug, section: section.id, title: iaRow.title, audience, release, unreleased, covers: cov, nearest, video, summary });
    }
  }
  return { stubs, writtenKeys, warnings };
}

function render(s) {
  const lines = [
    '---',
    `title: ${needsQuote(s.title) ? JSON.stringify(s.title) : s.title}`,
    `slug: ${s.slug}`,
    `section: ${s.section}`,
    `audience: ${s.audience}`,
    'status: stub',
    `release: ${s.release}`,
    `covers: [${s.covers.join(', ')}]`,
  ];
  if (s.unreleased.length) lines.push(`unreleased: [${s.unreleased.join(', ')}]`);
  lines.push('summary: >-');
  for (const l of wrap(s.summary, 96)) lines.push(`  ${l}`);
  lines.push(`nearest: ${s.nearest}`);
  if (s.video) lines.push(`video: ${s.video}`);
  lines.push('---', '');
  return lines.join('\n');
}

function needsQuote(v) {
  return /: | #|^[&*!|>%@`{[\]#-]/.test(v);
}

function wrap(text, width) {
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > width) {
      out.push(line);
      line = word;
    } else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  return out;
}

function main() {
  const { stubs, writtenKeys, warnings } = plan();
  let toWrite = 0;
  let existing = 0;
  for (const s of stubs) {
    const abs = path.join(ROOT, DOCS_ROOT, `${s.slug}.md`);
    if (fs.existsSync(abs)) {
      existing++;
      continue;
    }
    toWrite++;
    if (DRY) {
      console.log(`would write ${DOCS_ROOT}/${s.slug}.md  (release ${s.release}, covers ${s.covers.length}, nearest ${s.nearest})`);
    } else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, render(s));
      console.log(`wrote ${DOCS_ROOT}/${s.slug}.md`);
    }
  }
  console.log('\nKeys owned by WRITTEN pages (hand-maintained covers — put these in the page):');
  for (const [slug, cov] of Object.entries(writtenKeys)) {
    console.log(`  ${slug}: [${cov.join(', ')}]`);
  }
  for (const w of warnings) console.log(`WARN ${w}`);
  console.log(`\n${stubs.length} stub slugs · ${existing} already exist · ${toWrite} ${DRY ? 'to write (dry run)' : 'written'}`);
}

main();

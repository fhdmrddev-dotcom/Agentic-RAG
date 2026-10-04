'use strict';
/**
 * scripts/lib/docs-content.cjs — Phase 276 (DOCS-01 / DOCS-02 / DOCS-05).
 *
 * The ONE home of the public-docs content model. Two consumers, never two implementations:
 *   - frontend/plugins/docsContent.ts (the Vite plugin: manifest, page chunks, search index)
 *   - scripts/check-docs-coverage.cjs   (276-05's coverage gate) and 276-04's stub scaffolder
 *
 * ⛔ DEPENDENCY-FREE BY CONTRACT: `fs` and `path` only. scripts/ has no node_modules on its
 *    resolution path (the root node_modules is empty), and the coverage gate must run in CI and
 *    in the PostToolUse hook with plain `node`. So the frontmatter parser below is a strict,
 *    hand-written SUBSET of YAML — and anything outside the subset is reported as
 *    `[bad-frontmatter]`, never guessed at (T-276-09).
 *
 * ⛔ SAME-COMMIT SYNC RULE: docs/public/README.md (the human contract) ↔ this file ↔
 *    scripts/check-docs-coverage.cjs change in the SAME commit.
 *
 * Every directory is a PARAMETER (the check-seeds-register.cjs readRegister precedent), so tests
 * and the gate's --root point exactly this code at fixtures or temp copies.
 */

const fs = require('fs');
const path = require('path');

// ── The frontmatter contract ────────────────────────────────────────────────────────────────
const AUDIENCES = ['user', 'admin', 'operator', 'developer'];
const STATUSES = ['written', 'stub'];
const RELEASES = ['shipped', 'v4.5'];
const CODE_KEY_PREFIXES = ['nav', 'view', 'tool', 'step', 'check', 'router', 'settings-tab'];

/** key -> kind ('scalar' | 'list' | 'text'), plus whether it is always required. */
const FRONTMATTER_KEYS = {
  title: { kind: 'scalar', required: true },
  slug: { kind: 'scalar', required: true },
  section: { kind: 'scalar', required: true },
  audience: { kind: 'scalar', required: true },
  status: { kind: 'scalar', required: true },
  release: { kind: 'scalar', required: true },
  covers: { kind: 'list', required: true },
  unreleased: { kind: 'list', required: false },
  summary: { kind: 'text', required: false }, // required for stubs (D-07)
  nearest: { kind: 'scalar', required: false }, // required for stubs
  video: { kind: 'scalar', required: false },
  reviewed: { kind: 'scalar', required: false }, // required for written pages
  updated: { kind: 'scalar', required: false },
};

const INVENTORY_ID = /^[A-I]\d+$/;
const CODE_KEY = new RegExp('^(' + CODE_KEY_PREFIXES.join('|') + '):[A-Za-z0-9_.-]+$');
const SLUG = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const VIDEO_KEY = /^[a-z0-9-]+\.[a-z0-9.-]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VERSION = /^v\d+\.\d+$/;

function normalizeNewlines(text) {
  return String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function finding(code, file, key, message) {
  return { code, file, key, message };
}

/** `[bad-frontmatter] use/chat.md: nearest — points at a stub page (use/chat-modes)` */
function formatFinding(f) {
  const where = f.key ? `${f.file}: ${f.key}` : f.file;
  return `[${f.code}] ${where} — ${f.message}`;
}

/** Heading ids — the anchor every H2 gets. 276-03's renderer must produce the same ids. */
function headingId(text) {
  return String(text)
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function unquote(raw) {
  const v = raw.trim();
  if (v.length >= 2 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) {
    return { ok: true, value: v.slice(1, -1) };
  }
  // An opening quote that never closes is not a value we will guess at.
  if (/^["']/.test(v)) return { ok: false };
  // A plain scalar may not contain ": " or " #" (YAML would read a mapping / a comment), nor
  // start with a YAML indicator this subset does not support.
  if (/: /.test(v) || / #/.test(v) || /^[&*!|>%@`{[\]#-]/.test(v)) return { ok: false };
  return { ok: true, value: v };
}

/**
 * Parse the frontmatter block of `lines` (already newline-normalised, without the --- fences).
 * Returns { data, findings }. Supported forms ONLY:
 *   key: plain scalar          key: "double quoted"       key: 'single quoted'
 *   key: [a, b, c]             (flow list of plain items)
 *   key: >-                    (folded block; following lines indented by ≥ 1 space)
 * Blank lines are allowed. Anything else is a [bad-frontmatter] finding naming the key.
 */
function parseFrontmatterBlock(lines, file) {
  const data = {};
  const findings = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    const m = /^([a-z][a-z0-9_-]*):(?:[ \t]+(.*))?$/.exec(line);
    if (!m) {
      findings.push(finding('bad-frontmatter', file, 'frontmatter', `unsupported line ${JSON.stringify(line)} (only key: value, key: [a, b] and key: >- are allowed)`));
      i++;
      continue;
    }
    const key = m[1];
    const raw = m[2] === undefined ? '' : m[2].trim();
    i++;
    const spec = FRONTMATTER_KEYS[key];
    if (!spec) {
      findings.push(finding('bad-frontmatter', file, key, 'unknown key'));
      // Skip any indented continuation so it is not reported twice.
      while (i < lines.length && /^[ \t]+\S/.test(lines[i])) i++;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      findings.push(finding('bad-frontmatter', file, key, 'duplicate key'));
    }
    if (raw === '>-') {
      const parts = [];
      while (i < lines.length && (/^[ \t]+\S/.test(lines[i]) || (lines[i].trim() === '' && i + 1 < lines.length && /^[ \t]+\S/.test(lines[i + 1])))) {
        if (lines[i].trim() !== '') parts.push(lines[i].trim());
        i++;
      }
      if (spec.kind !== 'text') {
        findings.push(finding('bad-frontmatter', file, key, 'a folded block (>-) is only allowed for summary'));
        continue;
      }
      if (parts.length === 0) {
        findings.push(finding('bad-frontmatter', file, key, 'empty folded block'));
        continue;
      }
      data[key] = parts.join(' ');
      continue;
    }
    if (raw === '') {
      findings.push(finding('bad-frontmatter', file, key, 'empty value (nested YAML is not supported)'));
      while (i < lines.length && /^[ \t]+\S/.test(lines[i])) i++;
      continue;
    }
    if (raw.startsWith('[')) {
      if (!raw.endsWith(']')) {
        findings.push(finding('bad-frontmatter', file, key, 'a flow list must open and close on one line: [a, b]'));
        continue;
      }
      if (spec.kind !== 'list') {
        findings.push(finding('bad-frontmatter', file, key, 'a list is not allowed for this key'));
        continue;
      }
      const inner = raw.slice(1, -1).trim();
      const items = inner === '' ? [] : inner.split(',').map((s) => s.trim());
      if (items.some((s) => s === '' || /[\[\]{}"':]/.test(s.replace(/^[a-z-]+:/, '')))) {
        findings.push(finding('bad-frontmatter', file, key, 'list items must be plain values: [A5, nav:chat]'));
        continue;
      }
      data[key] = items;
      continue;
    }
    if (spec.kind === 'list') {
      findings.push(finding('bad-frontmatter', file, key, 'must be a flow list: [a, b]'));
      continue;
    }
    const u = unquote(raw);
    if (!u.ok) {
      findings.push(finding('bad-frontmatter', file, key, `unsupported value ${JSON.stringify(raw)} (quote it if it contains ": ")`));
      continue;
    }
    data[key] = u.value;
  }
  return { data, findings };
}

function extractHeadings(body) {
  const out = [];
  let inFence = false;
  for (const line of body.split('\n')) {
    if (/^(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = /^## +(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push({ id: headingId(m[1]), text: m[1].replace(/[`*_]/g, '') });
  }
  return out;
}

/** Markdown → plain text, good enough for a search index and a word count. */
function markdownToText(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_`~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * parsePage(text, relPath) → { page: PageMeta | null, body, findings }
 * relPath is POSIX, relative to docs/public, e.g. "use/chat.md".
 */
function parsePage(text, relPath) {
  const file = toPosix(relPath);
  const src = normalizeNewlines(text);
  const findings = [];
  const lines = src.split('\n');
  if (lines[0] !== '---') {
    findings.push(finding('bad-frontmatter', file, 'frontmatter', 'the file must start with a --- frontmatter block'));
    return { page: null, body: src, findings };
  }
  const end = lines.indexOf('---', 1);
  if (end === -1) {
    findings.push(finding('bad-frontmatter', file, 'frontmatter', 'the frontmatter block is never closed with ---'));
    return { page: null, body: src, findings };
  }
  const parsed = parseFrontmatterBlock(lines.slice(1, end), file);
  findings.push(...parsed.findings);
  const d = parsed.data;
  const body = lines.slice(end + 1).join('\n').replace(/^\n+/, '');

  for (const [key, spec] of Object.entries(FRONTMATTER_KEYS)) {
    if (spec.required && d[key] === undefined && !findings.some((f) => f.key === key)) {
      findings.push(finding('bad-frontmatter', file, key, 'required key is missing'));
    }
  }

  const expectedSlug = file.replace(/\.md$/, '');
  if (d.slug !== undefined && d.slug !== expectedSlug) {
    findings.push(finding('bad-frontmatter', file, 'slug', `must equal the path under docs/public without .md ("${expectedSlug}"), got "${d.slug}"`));
  }
  if (d.audience !== undefined && !AUDIENCES.includes(d.audience)) {
    findings.push(finding('bad-frontmatter', file, 'audience', `must be one of ${AUDIENCES.join(' | ')}, got "${d.audience}"`));
  }
  if (d.status !== undefined && !STATUSES.includes(d.status)) {
    findings.push(finding('bad-frontmatter', file, 'status', `must be one of ${STATUSES.join(' | ')}, got "${d.status}"`));
  }
  if (d.release !== undefined && !RELEASES.includes(d.release)) {
    findings.push(finding('bad-frontmatter', file, 'release', `must be one of ${RELEASES.join(' | ')}, got "${d.release}"`));
  }
  if (Array.isArray(d.covers)) {
    if (d.covers.length === 0) findings.push(finding('bad-frontmatter', file, 'covers', 'must list at least one inventory ID or code key'));
    for (const c of d.covers) {
      if (!INVENTORY_ID.test(c) && !CODE_KEY.test(c)) {
        findings.push(finding('bad-frontmatter', file, 'covers', `"${c}" is neither an inventory ID (A5) nor a code key (${CODE_KEY_PREFIXES.join(':, ')}:)`));
      }
    }
  }
  if (d.unreleased !== undefined) {
    for (const c of d.unreleased) {
      if (!INVENTORY_ID.test(c)) findings.push(finding('bad-frontmatter', file, 'unreleased', `"${c}" is not an inventory ID`));
    }
    if (d.release === 'v4.5') {
      findings.push(finding('bad-frontmatter', file, 'unreleased', 'only meaningful on a release: shipped page (the whole page is already unreleased)'));
    }
  }
  if (d.status === 'stub') {
    if (d.summary === undefined && !findings.some((f) => f.key === 'summary')) {
      findings.push(finding('bad-frontmatter', file, 'summary', 'a stub needs a 2-3 sentence summary (D-07)'));
    }
    if (d.nearest === undefined && !findings.some((f) => f.key === 'nearest')) {
      findings.push(finding('bad-frontmatter', file, 'nearest', 'a stub needs the slug of the nearest WRITTEN page'));
    }
  }
  if (d.status === 'written' && d.reviewed === undefined && !findings.some((f) => f.key === 'reviewed')) {
    findings.push(finding('bad-frontmatter', file, 'reviewed', 'a written page needs reviewed: YYYY-MM-DD'));
  }
  if (d.nearest !== undefined) {
    if (!SLUG.test(d.nearest)) findings.push(finding('bad-frontmatter', file, 'nearest', `"${d.nearest}" is not a slug`));
    else if (d.nearest === expectedSlug) findings.push(finding('bad-frontmatter', file, 'nearest', 'points at itself'));
  }
  if (d.reviewed !== undefined && !ISO_DATE.test(d.reviewed)) {
    findings.push(finding('bad-frontmatter', file, 'reviewed', `must be YYYY-MM-DD, got "${d.reviewed}"`));
  }
  if (d.updated !== undefined && !VERSION.test(d.updated)) {
    findings.push(finding('bad-frontmatter', file, 'updated', `must be vX.Y, got "${d.updated}"`));
  }
  if (d.video !== undefined && !VIDEO_KEY.test(d.video)) {
    findings.push(finding('bad-frontmatter', file, 'video', `must be a slot key like clip.chat, got "${d.video}"`));
  }

  // Without a title and a status there is nothing a page component could render; the findings
  // above already name what is wrong.
  if (d.title === undefined || d.status === undefined) {
    return { page: null, body, findings };
  }

  const plain = markdownToText(body);
  const words = plain ? plain.split(' ').length : 0;
  const page = {
    slug: d.slug === undefined ? expectedSlug : d.slug,
    title: d.title,
    section: d.section,
    audience: d.audience,
    status: d.status,
    release: d.release,
    covers: Array.isArray(d.covers) ? d.covers : [],
    unreleased: Array.isArray(d.unreleased) ? d.unreleased : [],
    summary: d.summary === undefined ? null : d.summary,
    nearest: d.nearest === undefined ? null : d.nearest,
    video: d.video === undefined ? null : d.video,
    reviewed: d.reviewed === undefined ? null : d.reviewed,
    updated: d.updated === undefined ? null : d.updated,
    headings: extractHeadings(body),
    readMinutes: Math.max(1, Math.ceil(words / 200)),
    file,
    body,
  };
  return { page, body, findings };
}

/**
 * loadAllPages(root) — every docs/public/**.md file, parsed. root is a PARAMETER; never writes.
 * ⛔ EVERY skipped file increments a counter (the seeds-gate lesson: an uncounted `continue` is
 *    how a gate prints "0 files · OK").
 * → { root, scanned, pages, findings, skipped: { reason: count }, readError? }
 */
function loadAllPages(root) {
  const res = { root, scanned: 0, pages: [], findings: [], skipped: {} };
  const skip = (reason) => {
    res.skipped[reason] = (res.skipped[reason] || 0) + 1;
  };
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    res.readError = `docs root not found: ${root}`;
    return res;
  }
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      res.findings.push(finding('unreadable', toPosix(path.relative(root, dir)) || '.', null, String(e && e.message)));
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      res.scanned++;
      const rel = toPosix(path.relative(root, abs));
      if (!ent.name.endsWith('.md')) {
        skip('not-markdown');
        continue;
      }
      if (rel === 'README.md') {
        skip('contract-readme');
        continue;
      }
      let text;
      try {
        text = fs.readFileSync(abs, 'utf8');
      } catch (e) {
        skip('unreadable');
        res.findings.push(finding('unreadable', rel, null, String(e && e.message)));
        continue;
      }
      const parsed = parsePage(text, rel);
      res.findings.push(...parsed.findings);
      if (parsed.page) res.pages.push(parsed.page);
      else skip('unparseable');
    }
  };
  walk(root);
  return res;
}

/** Read and shape-check docs/public/sections.json (the IA tree as data, D-02). */
function readSections(sectionsPath) {
  const raw = JSON.parse(normalizeNewlines(fs.readFileSync(sectionsPath, 'utf8')));
  if (!Array.isArray(raw)) throw new Error(`${sectionsPath}: must be a JSON array of sections`);
  for (const s of raw) {
    if (!s || typeof s.id !== 'string' || typeof s.title !== 'string' || typeof s.purpose !== 'string' || !Array.isArray(s.slugs)) {
      throw new Error(`${sectionsPath}: every section needs id, title, purpose and slugs[] (got ${JSON.stringify(s && s.id)})`);
    }
    for (const g of s.groups || []) {
      for (const slug of g.slugs) {
        if (!s.slugs.includes(slug)) throw new Error(`${sectionsPath}: group "${g.title}" lists ${slug}, which is not in section ${s.id}'s slugs`);
      }
    }
  }
  return raw;
}

/**
 * validatePages(pages, sections) — the cross-page rules. Emits:
 *   [bad-frontmatter] section not in sections.json / slug outside its section / nearest missing or a stub
 *   [unlisted-page]   a page file that sections.json does not list
 *   [missing-page]    a sections.json slug with no page file
 * The Vite plugin treats ONLY [bad-frontmatter] as fatal; the coverage gate treats all as findings.
 */
function validatePages(pages, sections) {
  const out = [];
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const sectionIds = new Set(sections.map((s) => s.id));
  const listed = new Set(sections.flatMap((s) => s.slugs));
  for (const p of pages) {
    const file = p.file || `${p.slug}.md`;
    if (p.section !== undefined && !sectionIds.has(p.section)) {
      out.push(finding('bad-frontmatter', file, 'section', `"${p.section}" is not a section id in sections.json`));
    } else if (p.section !== undefined && !p.slug.startsWith(p.section + '/')) {
      out.push(finding('bad-frontmatter', file, 'section', `slug ${p.slug} does not live under section ${p.section}/`));
    }
    if (p.nearest) {
      const target = bySlug.get(p.nearest);
      if (!target) out.push(finding('bad-frontmatter', file, 'nearest', `points at ${p.nearest}, which has no page`));
      else if (target.status !== 'written') out.push(finding('bad-frontmatter', file, 'nearest', `points at a stub page (${p.nearest}); it must be a written page`));
    }
    if (!listed.has(p.slug)) out.push(finding('unlisted-page', p.slug, null, 'the page exists but docs/public/sections.json does not list it'));
  }
  for (const s of sections) {
    for (const slug of s.slugs) {
      if (!bySlug.has(slug)) out.push(finding('missing-page', slug, null, `sections.json lists it under ${s.id} but docs/public/${slug}.md does not exist`));
    }
  }
  return out;
}

// ── Changelog (DOCS-05) ─────────────────────────────────────────────────────────────────────
const MIN_HISTORY_FILES = 20;

function compareVersions(a, b) {
  const [am, an] = a.slice(1).split('.').map(Number);
  const [bm, bn] = b.slice(1).split('.').map(Number);
  return am !== bm ? am - bm : an - bn;
}

function listHistoryFiles(historyDir) {
  return fs
    .readdirSync(historyDir)
    .filter((f) => /^v\d+\.\d+.*\.md$/.test(f))
    .sort();
}

function sectionBody(text, name) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${name}`);
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

function parseBullets(block) {
  const bullets = [];
  for (const line of block.split('\n')) {
    if (/^- /.test(line)) bullets.push(line.slice(2).trim());
    else if (/^\s+\S/.test(line) && bullets.length) bullets[bullets.length - 1] += ' ' + line.trim().replace(/^[-*] /, '');
    // Any other line (the "(So far on the development branch …)" parenthetical, prose) is not a
    // shipped item — the release badge carries that fact.
  }
  return bullets;
}

/** The README's "arc in five chapters" table → [{ n, title, range }]. README wording wins. */
function parseChapters(historyDir) {
  const readmePath = path.join(historyDir, 'README.md');
  const text = normalizeNewlines(fs.readFileSync(readmePath, 'utf8'));
  const block = sectionBody(text, 'The arc in five chapters');
  if (!block) throw new Error(`${readmePath}: no "## The arc in five chapters" table`);
  const chapters = [];
  for (const line of block.split('\n')) {
    const m = /^\|\s*(\d+)\.\s*([^|]+?)\s*\|\s*(v\d+\.\d+)\s*[–-]\s*(v\d+\.\d+)\s*\|/.exec(line);
    if (m) chapters.push({ n: Number(m[1]), title: m[2], range: `${m[3]} – ${m[4]}`, from: m[3], to: m[4] });
  }
  if (chapters.length < 5) throw new Error(`${readmePath}: parsed ${chapters.length} chapters from the arc table, expected 5`);
  return chapters.map(({ n, title, range }) => ({ n, title, range }));
}

function chapterFor(version, chapters) {
  for (const c of chapters) {
    const [from, to] = c.range.split(' – ');
    if (compareVersions(version, from) >= 0 && compareVersions(version, to) <= 0) return c;
  }
  return null;
}

/**
 * parseHistory(historyDir, overridesPath?) → Release[] newest first.
 *   Release = { version, name, date|null, released, chapter, oneLiner, shipped[], note|null }
 * Public fields only — "How it works", "Video beats", "Sources" never leave the history file.
 * Throws when fewer than MIN_HISTORY_FILES parse, when a release has no chapter, and when an
 * override names a version that does not exist.
 */
function parseHistory(historyDir, overridesPath) {
  const files = listHistoryFiles(historyDir);
  const releases = [];
  const failures = [];
  for (const f of files) {
    const text = normalizeNewlines(fs.readFileSync(path.join(historyDir, f), 'utf8'));
    const head = /^# (v\d+\.\d+) — (.+)$/m.exec(text);
    const shippedLine = /^> \*\*Shipped:\*\* ([^·]+)/m.exec(text);
    const oneLiner = sectionBody(text, 'In one sentence');
    const shippedBlock = sectionBody(text, 'What shipped');
    if (!head || !shippedLine || !oneLiner || shippedBlock === null) {
      failures.push(f);
      continue;
    }
    const shippedValue = shippedLine[1].trim();
    const released = /^\d{4}-\d{2}-\d{2}/.test(shippedValue);
    releases.push({
      version: head[1],
      name: head[2].trim(),
      date: released ? shippedValue.slice(0, 10) : null,
      released,
      chapter: null,
      oneLiner: oneLiner.replace(/\s*\n\s*/g, ' '),
      shipped: parseBullets(shippedBlock),
      note: null,
    });
  }
  if (releases.length < MIN_HISTORY_FILES) {
    throw new Error(
      `${historyDir}: parsed ${releases.length} history files — fewer than ${MIN_HISTORY_FILES} (MIN_HISTORY_FILES); refusing to build a changelog from a collapsed scan set` +
        (failures.length ? ` (unparseable: ${failures.join(', ')})` : ''),
    );
  }
  if (failures.length) throw new Error(`${historyDir}: unparseable history files: ${failures.join(', ')}`);

  const chapters = parseChapters(historyDir);
  for (const r of releases) {
    r.chapter = chapterFor(r.version, chapters);
    if (!r.chapter) throw new Error(`${historyDir}: ${r.version} falls in no chapter of the README arc table`);
  }

  if (overridesPath && fs.existsSync(overridesPath)) {
    const overrides = JSON.parse(normalizeNewlines(fs.readFileSync(overridesPath, 'utf8')));
    for (const [version, o] of Object.entries(overrides)) {
      const r = releases.find((x) => x.version === version);
      if (!r) throw new Error(`${overridesPath}: override for ${version}, which is not a release in docs/history`);
      if (!o || typeof o.note !== 'string') throw new Error(`${overridesPath}: ${version} needs { "note": "..." }`);
      r.note = o.note;
    }
  }

  releases.sort((a, b) => compareVersions(b.version, a.version));
  return releases;
}

// ── Search documents (D-08) ─────────────────────────────────────────────────────────────────
const SEARCH_BODY_CHARS = 2048;

function clip(text, n) {
  return text.length <= n ? text : text.slice(0, n);
}

/**
 * buildSearchDocs(pages, changelog, sections, bodies?) → the MiniSearch documents. Covers every
 * page (written AND stub), every section index and every changelog version. bodies (optional)
 * maps slug → Markdown and overrides page.body.
 */
function buildSearchDocs(pages, changelog, sections, bodies) {
  const sectionTitle = new Map(sections.map((s) => [s.id, s.title]));
  const docs = [];
  for (const p of pages) {
    const md = (bodies && bodies[p.slug]) || p.body || '';
    docs.push({
      id: `page:${p.slug}`,
      title: p.title,
      headings: p.headings.map((h) => h.text).join(' · '),
      summary: p.summary || '',
      body: clip(markdownToText(md), SEARCH_BODY_CHARS),
      slug: p.slug,
      section: sectionTitle.get(p.section) || p.section,
      status: p.status,
      release: p.release,
      url: `/docs/${p.slug}`,
    });
  }
  for (const s of sections) {
    docs.push({
      id: `section:${s.id}`,
      title: s.title,
      headings: (s.groups || []).map((g) => g.title).join(' · '),
      summary: s.purpose,
      body: '',
      slug: s.id,
      section: s.title,
      status: 'written',
      release: 'shipped',
      url: `/docs/${s.id}`,
    });
  }
  for (const r of changelog) {
    docs.push({
      id: `changelog:${r.version}`,
      title: `${r.version} — ${r.name}`,
      headings: '',
      summary: r.oneLiner,
      body: clip(markdownToText(r.shipped.join(' ')), SEARCH_BODY_CHARS),
      slug: `changelog/${r.version}`,
      section: sectionTitle.get('changelog') || 'Changelog',
      status: 'written',
      release: r.released ? 'shipped' : r.version,
      url: `/docs/changelog/${r.version}`,
    });
  }
  return docs;
}

// ── Code keys (DOCS-02) — the ONE home of the extractors ────────────────────────────────────
// Each source has a named floor; a parse below it THROWS naming the file, because a regex that
// silently matches nothing turns a coverage gate into one that cannot fail.
const MIN_NAV = 5;
const MIN_VIEW = 8;
const MIN_TOOL = 25;
const MIN_STEP = 7;
const MIN_CHECK = 8;
const MIN_ROUTER = 30;
const MIN_SETTINGS_TAB = 3;

const SOURCES = {
  nav: 'frontend/src/lib/nav-items.ts',
  view: 'frontend/src/App.tsx',
  tool: 'backend/app/services/tool_dispatcher.py',
  step: 'backend/app/services/harness/phase_types.py',
  checkDir: 'backend/app/services/harness',
  router: 'backend/app/main.py',
  settingsTab: 'frontend/src/pages/SettingsPage.tsx',
};

function readRepoFile(repoRoot, rel) {
  return normalizeNewlines(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
}

function listRepoDir(repoRoot, rel) {
  return fs.readdirSync(path.join(repoRoot, rel)).sort();
}

function uniq(list) {
  return Array.from(new Set(list));
}

function floor(name, list, min, file) {
  if (list.length < min) {
    throw new Error(`[floor] ${file}: extracted ${list.length} ${name} key(s), below the floor of ${min} (MIN_${name.toUpperCase().replace(/-/g, '_')}) — the source moved or the regex rotted`);
  }
  return list;
}

function slugifyLabel(label) {
  return label.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * extractCodeKeys(repoRoot, io?) → { nav, view, tool, step, check, router, settingsTab }
 * io.readFile(rel) / io.listDir(rel) default to the real filesystem under repoRoot; tests inject
 * a reader to plant a defect without mutating the tree.
 */
function extractCodeKeys(repoRoot, io) {
  const readFile = (io && io.readFile) || ((rel) => readRepoFile(repoRoot, rel));
  const listDir = (io && io.listDir) || ((rel) => listRepoDir(repoRoot, rel));

  const navSrc = readFile(SOURCES.nav);
  const navBlock = /export const NAV_ITEMS[^=]*=\s*\[([\s\S]*?)\n\]/.exec(navSrc);
  const nav = floor('nav', navBlock ? uniq(Array.from(navBlock[1].matchAll(/view:\s*"([^"]+)"/g), (m) => m[1])) : [], MIN_NAV, SOURCES.nav);

  const viewSrc = readFile(SOURCES.view);
  const viewLine = /export type ActiveView\s*=\s*([^\n]+)/.exec(viewSrc);
  const view = floor('view', viewLine ? uniq(Array.from(viewLine[1].matchAll(/"([^"]+)"/g), (m) => m[1])) : [], MIN_VIEW, SOURCES.view);

  // Same regex as check-landing-drift.cjs §5 (the landing's BUILTIN_TOOL_COUNT fact).
  const toolSrc = readFile(SOURCES.tool);
  const toolBlock = /_TOOL_REGISTRY:\s*dict\[str,\s*Callable\]\s*=\s*\{([\s\S]*?)\n\}/.exec(toolSrc);
  const tool = floor('tool', toolBlock ? uniq(Array.from(toolBlock[1].matchAll(/"([^"]+)":/g), (m) => m[1])) : [], MIN_TOOL, SOURCES.tool);

  const stepSrc = readFile(SOURCES.step);
  const stepBlock = /PHASE_TYPE_REGISTRY_ENTRIES:\s*dict\s*=\s*\{([\s\S]*?)\n\}/.exec(stepSrc);
  const step = floor('step', stepBlock ? uniq(Array.from(stepBlock[1].matchAll(/"([a-z_]+)":/g), (m) => m[1])) : [], MIN_STEP, SOURCES.step);

  const checks = [];
  for (const f of listDir(SOURCES.checkDir).filter((n) => n.endsWith('.py'))) {
    const src = readFile(`${SOURCES.checkDir}/${f}`);
    for (const m of src.matchAll(/@register_validator\(\s*"([a-z_]+)"\s*\)/g)) checks.push(m[1]);
  }
  const check = floor('check', uniq(checks), MIN_CHECK, `${SOURCES.checkDir}/*.py`);

  // Module names, deduped: `evals.router` + `evals.router_evals` are one module. A bare
  // `app.include_router(test_fixtures_router)` (never mounted in prod) has no dot and is skipped.
  const routerSrc = readFile(SOURCES.router);
  const router = floor('router', uniq(Array.from(routerSrc.matchAll(/app\.include_router\((\w+)\.(\w+)/g), (m) => m[1])), MIN_ROUTER, SOURCES.router);

  // Same block as check-landing-drift.cjs §7c; the admin-only dynamic label maps to "search".
  const tabsSrc = readFile(SOURCES.settingsTab);
  const tabsBlock = /<TabsList[^>]*>([\s\S]*?)<\/TabsList>/.exec(tabsSrc);
  const tabs = [];
  if (tabsBlock) {
    for (const m of tabsBlock[1].matchAll(/<TabsTrigger[^>]*>([\s\S]*?)<\/TabsTrigger>/g)) {
      const label = m[1].trim();
      tabs.push(label.includes('retrievalTabLabel') ? 'search' : slugifyLabel(label));
    }
  }
  const settingsTab = floor('settings-tab', uniq(tabs), MIN_SETTINGS_TAB, SOURCES.settingsTab);

  return { nav, view, tool, step, check, router, settingsTab };
}

// ── Coverage inventory (.planning/research/docs-coverage-inventory.md) ─────────────────────────
// Phase 276-05: the ONE reader of the inventory tables, shared by scripts/scaffold-docs-stubs.cjs
// (which used to carry its own copy) and scripts/check-docs-coverage.cjs.
const INVENTORY_PATH = '.planning/research/docs-coverage-inventory.md';

function splitTableRow(line) {
  // "| a | b | c |" → ["a","b","c"]; a `|` inside backticks does not appear in these tables.
  return line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

/** Every Markdown table in `text` → [{ header: [...], rows: [[...]] }]. */
function markdownTables(text) {
  const out = [];
  const lines = normalizeNewlines(text).split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\|/.test(lines[i]) && /^\|[\s|:-]+\|\s*$/.test(lines[i + 1])) {
      const t = { header: splitTableRow(lines[i]), rows: [] };
      let j = i + 2;
      while (j < lines.length && /^\|/.test(lines[j])) {
        t.rows.push(splitTableRow(lines[j]));
        j++;
      }
      out.push(t);
      i = j - 1;
    }
  }
  return out;
}

/**
 * parseInventory(text) → [{ id, surface, status, audience, pages }] for every row of every table
 * whose first header cell is "ID". The HTTP API table (h.3) has no Status column; its "API ref"
 * cell marks v4.5 routers as "public (v4.5)" (H8 /document-search).
 */
function parseInventory(text) {
  const rows = [];
  for (const t of markdownTables(text)) {
    if (t.header[0] !== 'ID') continue;
    const col = (name) => t.header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const iStatus = col('Status');
    const iAudience = col('Audience');
    const iApiRef = col('API ref');
    let iPage = col('Proposed doc page');
    if (iPage === -1) iPage = col('Doc page');
    for (const r of t.rows) {
      if (!INVENTORY_ID.test(r[0])) continue;
      let status = iStatus >= 0 ? r[iStatus] || '' : '';
      if (iStatus < 0 && iApiRef >= 0) status = /\(v4\.5\)/.test(r[iApiRef] || '') ? 'v4.5' : 'shipped';
      rows.push({
        id: r[0],
        surface: r[1] || '',
        status,
        audience: iAudience >= 0 ? r[iAudience] || '' : '',
        pages: iPage >= 0 ? Array.from((r[iPage] || '').matchAll(/`([a-z0-9-]+(?:\/[a-z0-9-]+)+)(?:#[a-z0-9-]+)?`/g), (m) => m[1]) : [],
      });
    }
  }
  return rows;
}

/** An inventory Status cell → 'v4.5' | 'locked' | 'not-built' | 'gated' | 'flag' | 'internal' | 'shipped'. */
function inventoryStatusKind(status) {
  const s = String(status).toLowerCase();
  if (s.startsWith('v4.5')) return 'v4.5';
  if (s.startsWith('locked')) return 'locked';
  if (s.startsWith('not built')) return 'not-built';
  if (s.startsWith('gated')) return 'gated';
  if (s.startsWith('flag')) return 'flag';
  if (s.startsWith('internal') || s.startsWith('policy')) return 'internal';
  return 'shipped';
}

/** Walk up from `start` (default: cwd) to the directory holding docs/history. */
function findRepoRoot(start) {
  let dir = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(dir, 'docs', 'history')) && fs.existsSync(path.join(dir, 'scripts', 'lib'))) return toPosix(dir);
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`findRepoRoot: no repo root above ${start || process.cwd()}`);
    dir = parent;
  }
}

module.exports = {
  AUDIENCES,
  STATUSES,
  RELEASES,
  CODE_KEY_PREFIXES,
  FRONTMATTER_KEYS,
  MIN_HISTORY_FILES,
  MIN_NAV,
  MIN_VIEW,
  MIN_TOOL,
  MIN_STEP,
  MIN_CHECK,
  MIN_ROUTER,
  MIN_SETTINGS_TAB,
  SEARCH_BODY_CHARS,
  SOURCES,
  parsePage,
  loadAllPages,
  readSections,
  validatePages,
  formatFinding,
  headingId,
  markdownToText,
  listHistoryFiles,
  parseChapters,
  parseHistory,
  buildSearchDocs,
  extractCodeKeys,
  readRepoFile,
  findRepoRoot,
  INVENTORY_PATH,
  markdownTables,
  parseInventory,
  inventoryStatusKind,
};

# docs/public — the Syrel public docs content

Content for the public docs at `/docs` (Phase 276). Each page is one Markdown file at
`docs/public/<section>/<slug>.md`; the information architecture (the 11 sections, their order,
groups and page order) is data in [`sections.json`](sections.json). The build turns both into the
docs entry (`frontend/docs.html` → `frontend/src/docs/`) through `frontend/plugins/docsContent.ts`,
which delegates all parsing to [`scripts/lib/docs-content.cjs`](../../scripts/lib/docs-content.cjs).

This README is not a page — the parser skips it (and counts the skip).

> ⛔ **Same-commit sync rule.** `docs/public/README.md` ↔ `scripts/lib/docs-content.cjs` ↔
> `scripts/check-docs-coverage.cjs` change in the **same commit**. A key, enum or rule added to one
> and not the others is drift.

## Frontmatter contract

Every page starts with a `---` block. The parser accepts a strict, dependency-free **subset** of
YAML and reports anything else as `[bad-frontmatter]` — it never guesses.

**Allowed forms (and nothing else):**

| Form | Example |
|---|---|
| plain scalar | `title: Chatting with Syrel` |
| quoted scalar (needed when the value contains `: ` or ` #`) | `title: "Coming: API keys, webhooks, MCP server"` |
| flow list of plain items, on one line | `covers: [A5, A9, nav:chat]` |
| folded block, `summary` only, lines indented by at least one space | `summary: >-` then indented lines |

Nested maps, block lists (`- item`), anchors, `|` blocks, comments after values, duplicate keys
and unknown keys are all `[bad-frontmatter]`.

**Keys:**

| Key | Required | Values |
|---|---|---|
| `title` | always | Page title (also the H1). |
| `slug` | always | Must equal the path under `docs/public` without `.md` (`use/chat` for `use/chat.md`). |
| `section` | always | A section `id` from `sections.json`; the slug must live under `<section>/`. |
| `audience` | always | `user` · `admin` · `operator` · `developer` |
| `status` | always | `written` · `stub` |
| `release` | always | `shipped` · `v4.5` (`v4.5` renders **Not yet released** everywhere the page appears) |
| `covers` | always, non-empty | Inventory IDs (`A5`, `H41` — rows of `.planning/research/docs-coverage-inventory.md`) and/or code keys (below). A stub counts as coverage (D-07). |
| `unreleased` | optional | Inventory IDs on a `release: shipped` page that are part of v4.5 — renders the partial-unreleased callout. Not allowed on a `release: v4.5` page. |
| `summary` | **stubs** (2-3 sentences, D-07); optional lead for written pages | Folded block (`>-`) or a single-line scalar. Also the search snippet. |
| `nearest` | **stubs** | Slug of the nearest **written** page (checked across pages; a stub or a missing page is `[bad-frontmatter]`). |
| `video` | optional | A video slot key, e.g. `clip.chat`, `home.overview`, `explainer.automate-workflows`. |
| `reviewed` | **written pages** | `YYYY-MM-DD` — the date the page was last fact-checked against the shipped product. |
| `updated` | optional | `vX.Y` — renders **Updated in vX.Y**. |

### Code keys (`covers:` prefixes)

Code keys are **derived from the code**, never typed from memory. `extractCodeKeys(repoRoot)` in
`scripts/lib/docs-content.cjs` is the one home of every extractor, and each source has a floor —
a parse that falls below it throws naming the file.

| Prefix | Derived from | Floor |
|---|---|---|
| `nav:<view>` | `frontend/src/lib/nav-items.ts` — `view: "…"` inside `NAV_ITEMS` | 5 |
| `view:<member>` | `frontend/src/App.tsx` — the `export type ActiveView = "…" \| …` union | 8 |
| `tool:<name>` | `backend/app/services/tool_dispatcher.py` — keys of `_TOOL_REGISTRY` | 25 |
| `step:<type>` | `backend/app/services/harness/phase_types.py` — keys of `PHASE_TYPE_REGISTRY_ENTRIES` | 7 |
| `check:<kind>` | `@register_validator("…")` across `backend/app/services/harness/*.py` | 8 |
| `router:<module>` | `backend/app/main.py` — `app.include_router(<module>.<attr>)`, module deduped | 30 |
| `settings-tab:<slug>` | `frontend/src/pages/SettingsPage.tsx` — `<TabsTrigger>` labels, slugified (the admin-only retrieval label is `search`) | 3 |

To list today's keys: `node -e "console.log(require('./scripts/lib/docs-content.cjs').extractCodeKeys('.'))"`.

### Findings

| Finding | Meaning | Build | Coverage gate |
|---|---|---|---|
| `[bad-frontmatter]` | A page breaks this contract | **fails the build** | finding |
| `[unlisted-page]` | A page file `sections.json` does not list | warning | finding |
| `[missing-page]` | A `sections.json` slug with no file | warning | finding |

## Honesty rules (exact wording)

Describe only shipped, still-true behaviour. These sentences are used verbatim wherever the fact
appears (UI-SPEC § Honesty badges):

- Every `release: v4.5` page, first thing after the meta row: **"Not yet released. This is part of v4.5, which has not shipped. Nothing on this page is in Syrel today."**
- Every page that mentions document outputs: **"Word and PDF files are downloaded, not previewed inside Syrel."** — no "(yet)".
- Third-party API access (API keys, webhooks, rate limits), any page: **"Not available today."** + a link "See what's planned" → `/docs/api/roadmap-open-platform`.
- Never "three deployment presets".

Badge words: **Not yet released** (v4.5) · **Full guide coming** (stub) · **UI-internal: may change** · **Updated in v{X.Y}** · **For admins** / **For operators** / **For developers**.

## Changelog

The changelog has no Markdown pages here. It is generated from `docs/history/v*.md` (one release
per file, counted with `readdirSync`) and the "arc in five chapters" table in
`docs/history/README.md`. Only public fields leave a history file: version, name, date, the one
sentence, the "What shipped" bullets and the chapter. A release whose Shipped line does not start
with a date is **Not yet released**.

Each chapter is `{ n, title, range, summary }`: the arc table's first column gives the number and
title, the second the release range, and the third ("What changed for the user") the one-line
`summary`. A chapter row without a summary fails the build, naming the README (276-07).

**The Build Story page** (`/docs/changelog/build-story`, "Syrel: The Build Story", 276-07 / D-26)
lists the five chapters in order, each with its summary, its range, its releases oldest first and
its YouTube slot `changelog.chapter-N` in `frontend/src/docs/video/videos.ts`. A slot whose
`youtubeId` is null renders nothing, so the page shows no video and promises none until an episode
is uploaded and its id filled in. The page is linked from the docs home chapter strip and from the
changelog hero, and it is one search document (`story:build-story`) built from the chapters the
releases carry. It adds no `covers` keys, so the coverage gate is unchanged.

Corrections to a history file's claims go in `docs/public/changelog/overrides.json`
(`{ "<version>": { "note": "..." } }`) rather than editing the history source; an override for a
version that does not exist fails the build.

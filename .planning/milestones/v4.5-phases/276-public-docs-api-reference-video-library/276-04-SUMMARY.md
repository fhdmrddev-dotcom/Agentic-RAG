---
phase: 276-public-docs-api-reference-video-library
plan: 04
subsystem: docs-content
tags: [docs, content, fact-check, honesty, coverage, screenshots, stubs]

requires:
  - phase: 276-02
    provides: "docs/public/README.md frontmatter contract, sections.json (119 slugs), scripts/lib/docs-content.cjs (loadAllPages, validatePages, extractCodeKeys, parseHistory)"
  - phase: 276-01
    provides: "docs/public/api/openapi.public.json (router public/internal split, flagged x-badges)"
provides:
  - "119 docs pages: 31 written (fact-checked) + 88 tracked stubs, 0 validatePages findings"
  - "Every inventory ID (except I20, by decision) and all 110 derived code keys appear in some page's covers"
  - "scripts/scaffold-docs-stubs.cjs (idempotent, --dry-run, code keys via extractCodeKeys)"
  - "docs/public/changelog/overrides.json (8 corrections for reversed What-shipped claims)"
  - "3 screenshots at 1280x800 under frontend/public/docs-assets/shots/"
  - "276-FACT-CHECK.md: claim -> source -> verdict rows for all 31 written pages"
affects: [276-03 (renders these pages), 276-05 (coverage gate consumes covers + I20 exclusion)]

tech-stack:
  added: []
  patterns:
    - "Stub generation is mechanical and never overwrites; hand edits to a stub survive re-runs"
    - "Release flag derived from inventory Status (and the HTTP table's 'API ref' cell), with a named override where the mechanical rule would be false"

key-files:
  created:
    - scripts/scaffold-docs-stubs.cjs
    - docs/public/**/*.md (119 pages)
    - docs/public/changelog/overrides.json
    - frontend/public/docs-assets/shots/chat.png
    - frontend/public/docs-assets/shots/workflow-builder.png
    - frontend/public/docs-assets/shots/experts-catalog.png
    - .planning/phases/276-public-docs-api-reference-video-library/276-FACT-CHECK.md
  modified: []

key-decisions:
  - "Workflows are documented as personal (creator + system-global starters only), per db/workflows.py and RLS — not as shareable after publishing"
  - "Experts: 'adds, never removes a tool' kept; the restricted folder rule is stated as a knowledge limit, shown before invite (v4.4 expert_scope.py), instead of the plan's blanket 'never restricts'"
  - "Streaming page follows the code: POST /threads/{id}/messages returns 201 JSON with run_id; the answer streams from GET /runs/{run_id}/stream?since=0 (inventory H43 described the pre-Phase-063 shape)"
  - "use/library/filing-rules is release: shipped with unreleased [A17]: rules ship today; only the move into the Library is v4.5"
  - "library-documents and document-detail screenshots NOT captured: the local frontend runs develop, which shows v4.5 UI; references removed rather than showing unreleased UI on shipped pages"
  - "NotebookLM workflows explainer slot removed from automate/workflows/overview (coordinator note: its narration says 8-stage)"

requirements-completed: [DOCS-02, DOCS-01, DOCS-03, DOCS-05]

duration: ~2h40m
completed: 2026-10-04
---

# Phase 276 Plan 04: Docs content Summary

**119 docs pages (31 written and fact-checked against docs/history and code, 88 scripted stubs). They cover every inventory item except I20 and all 110 code keys, with v4.5 kept as "Not yet released", Word/PDF described as downloads only, a 10-stage gauntlet and no API keys today.**

## Performance

- **Duration:** about 2h40m
- **Started:** 2026-10-04 (worktree reset to base `8d0d2a5b6`)
- **Completed:** 2026-10-04
- **Tasks:** 3/3
- **Files:** 125 created (119 pages, overrides.json, scaffolder, 3 PNGs, fact-check log)

## Accomplishments

- **Task 1:** `scripts/scaffold-docs-stubs.cjs` merges the inventory "Proposed doc page" column with the IA "Covers" column (ranges expanded). Code keys come from `extractCodeKeys` through a declared prefix-to-slug table. Each `router:*` key goes to `api/overview` when its module's tags appear in `openapi.public.json`, and to `api/internal-endpoints` otherwise (admin, setup_api, api_docs). The script wrote 88 stubs. Their summaries were then rewritten by hand: the generated ones were fragments, as the plan expected.
- **Task 2:** 15 written pages (Get started ×6, chat, chat modes, the 4 Library pages, workflows overview, builder and publish), `overrides.json` (v1.0, v2.0, v2.3, v2.9, v3.0, v3.6, v4.0, v4.3), and the fact-check log.
- **Task 3:** 16 written pages (Experts ×4, Security ×6, API authentication, orgs-and-rls, streaming, errors, the operator page and internal endpoints), plus 3 screenshots.

## Task Commits

1. **Task 1: scripted stubs**: `f32f3222f` (feat)
2. **Task 2: Get started, core Use, Workflows**: `b4d0e0d0e` (docs)
3. **Task 3: Experts, Security, API, operator, internal + screenshots**: `85c3160ff` (docs)

## Verification (measured)

- The plan's Task 3 verify command, run verbatim, prints `119 0 []` and exits 0: zero validatePages findings, and every inventory ID except I20 is covered.
- The Task 2 verify (with `parseHistory` over the overrides) exits 0: 27 releases, notes on 8. `loadAllPages` findings: 0. Skipped: `contract-readme` 1 and `not-markdown` 4 (the JSON files).
- All 110 code keys (nav 7, view 12, tool 30, step 7, check 10, router 39, settings-tab 5) appear in some page's covers.
- `node scripts/scaffold-docs-stubs.cjs --dry-run` after the commit: `88 stub slugs · 88 already exist · 0 to write`. `extractCodeKeys` count in the scaffolder: 3.
- Written pages: 31. Stubs: 88. `release: v4.5` in `use/artifacts.md` and `use/library/find.md`: 1 each. `A19` in document-detail: yes.
- Required Word/PDF sentence: 3/3 on workflows overview, publish and document-detail. It is also on every other page that mentions document outputs, on one line so a line grep finds it.
- Honesty greps:
  - `8[- ]stage` and in-app Word/PDF preview: no output.
  - Expert-restriction grep over `experts/`: 0 hits.
  - Operator page: `404` 1, `only after you sign in` 1. Authentication page: `no API keys` 2, roadmap link 1. Internal endpoints: `knowledge-health` 3, `UI-internal: may change` 3.
- `three deployment presets`: the only hit is `docs/public/README.md`, the 276-02 contract's own prohibition line ("Never three deployment presets"). Pages: 0. The 276-05 gate should skip README, as `loadAllPages` already does.
- `npx vitest run src/docs --maxWorkers=2`: 7 files, 60 tests passed. These are targeted only; 276-03 runs the full count gate this wave.
- `node scripts/check-hot-file-ledger.cjs <phase>`: `ledger gate OK`.
- Screenshots, measured by reading the PNG header: chat 1280×800, workflow-builder 1280×800, experts-catalog 1280×800.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] The plan's verify filter for Tasks 1 and 2 checked nothing**
- **Issue:** the plan filters `x.kind==='bad-frontmatter'`, but `docs-content.cjs` findings carry `code`, not `kind`, so that filter always counts 0.
- **Fix:** every self-check here filtered on `x.code`. The Task 3 verify counts all findings, so it is not affected.

**2. [Rule 3 - Blocking] Task 1 cannot reach zero bad-frontmatter on its own commit**
- **Issue:** `validatePages` requires `nearest` to point at an existing *written* page. At the Task 1 commit none of the 31 existed yet.
- **What the Task 1 commit holds:** 88 findings, every one "nearest points at … which has no page", all aimed at the five future written targets, and 0 of any other kind.
- **Resolution:** Tasks 2 and 3 cleared them. The final tree has 0.

**3. [Rule 1 - Bug] Claims corrected against code (detail in `276-FACT-CHECK.md`)**
- Publishing does not share a workflow: workflows are creator-only (`db/workflows.py`, RLS).
- The v3.6 "two people edit the same shared workflow" is rewritten as "a stale copy (another tab)".
- POST /messages does not stream.
- Some service-role paths scope their queries in code.
- Connection secrets fail closed without `SECRETS_ENCRYPTION_KEY`.
- The Settings rail entry is gated, so the page now says so.
- Toggle-global is PATCH.
- The gauntlet has 10 stages, not 8 (as the inventory and IA said).

**4. [Rule 2 - Honesty] Release override for `use/library/filing-rules`**
- The mechanical rule ("every covered row is v4.5") would have marked the page v4.5 and said "Nothing on this page is in Syrel today".
- Classification rules ship in v4.4. The page is `shipped` with `unreleased: [A17]`, and the override is declared in the scaffolder.

**5. [Rule 2 - Honesty] H8 (`/document-search`) marked unreleased on `api/overview` and `api/guides/upload-and-search`**
- The HTTP table has no Status column. The scaffolder now reads its "API ref" cell (`public (v4.5)`).

**6. Coordinator notes (mid-execution)**
- The 10-stage gauntlet was already correct.
- The `explainer.automate-workflows` slot is removed from the workflows overview, so no page embeds the NotebookLM workflows explainer.

### Screenshots: 3 of 5, by decision

- **Captured:** chat, workflow-builder and experts-catalog.
  - Source: the operator's already-running `develop` frontend on :5173, with the backend healthy on :8000. No server was started.
  - Method: Playwright headless Chromium at 1280×800, signed in with the documented local dev login from `tests/e2e/fixtures/auth.fixture.ts`.
  - Privacy: the profile footer was hidden. Every image was inspected: synthetic Acme and test data only, no email, key or token. The only actions taken were selecting a thread, opening a draft and selecting a step; nothing was dragged or saved.
- **Not captured:** library-documents and document-detail. On `develop`, the Library shows v4.5 UI (the Find documents | Ask switch, Filing rules, Download, the File section). Their references were removed from `use/library/documents.md` and `use/library/document-detail.md`. They can be recaptured from a v4.4 build, or once v4.5 ships.

## Findings for the operator (product, out of scope, not fixed)

1. **Settings is unreachable for ordinary users.** The Settings rail entry needs `model_management` (operators by default), but the Memory and Audit Log tabs, and the "Show technical names" switch, are user features. The profile menu has no Settings item. The docs state the gating honestly; whether to reopen the gating is a product decision.
2. **HTML entity shown literally in the Experts catalog.** A category chip renders `Research &amp; Academic Methods` because the entity is not decoded. It comes from org-custom test data, and it is visible in `experts-catalog.png`.
3. **The live production explorer has a browser gap.** P7's "sign in … and open its explorer" is verbatim UI-SPEC copy, but a plain browser cannot send a bearer token (D-20, accepted). An operator needs a header-injecting client.

## Known Stubs

- The 88 `status: stub` pages are intentional (D-07). Each carries a 2-3 sentence summary, `nearest` and covers, and renders the "Full guide coming" badge.
- Video slots: these keys resolve to nothing until a clip or explainer exists (V0, D-13):
  - `clip.get-started-quickstart`, `clip.get-started-navigating-syrel`, `clip.use-chat-modes`, `clip.use-library-ingestion`, `clip.use-library-find`, `clip.automate-workflows-publish`, `clip.experts-authoring`
  - the scaffolded `clip.*` and `explainer.*` keys
  - `explainer.get-started`, `explainer.experts`, `explainer.security`

## Threat Flags

None beyond the register. T-276-16 is mitigated: 3 images, test data only, each inspected, profile footer hidden. T-276-17 is mitigated: placeholders only (`<your-api-host>`, `<supabase_url>`), and no per-endpoint operator reference. T-276-18 is mitigated: release and unreleased flags, the fact-check log, and the grep gates. The authentication page names `GET /public-config`, an unauthenticated route that returns only the two public Supabase values (D-07, Phase 158); it is not a new surface.

## Notes for downstream

- **276-03:**
  - Screenshots exist only for `chat`, `workflow-builder` and `experts-catalog`.
  - The Word/PDF sentence sits inside some stubs' `summary` text.
  - `automate/workflows/overview` has no `video` key.
- **276-05:**
  - Filter findings on `code`, not `kind`.
  - Exclude `docs/public/README.md` from the presets grep.
  - I20 stays uncovered by decision.
  - `api/overview` carries the `router:*` keys for public routers. The internal ones (`admin`, `setup_api`, `api_docs`) are on `api/internal-endpoints`, and `router:admin` is also on `api/reference/operator`.

## Self-Check: PASSED

- Files: `scripts/scaffold-docs-stubs.cjs`, `docs/public/changelog/overrides.json`, the 3 PNGs and `276-FACT-CHECK.md` exist. 119 pages load with 0 findings.
- Commits: `f32f3222f`, `b4d0e0d0e` and `85c3160ff` are present in `git log`.
- STATE.md and ROADMAP.md were not modified.

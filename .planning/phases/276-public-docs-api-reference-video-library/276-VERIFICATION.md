---
phase: 276-public-docs-api-reference-video-library
verified: 2026-10-05T00:00:00Z
status: human_needed
score: 6/6 roadmap success criteria verified (automated); G-4 lived-experience checks and operator deploy items outstanding
re_verification: false
gaps: []
human_verification:
  - test: "G4-1..G4-4 lived-experience scenarios (docs desktop + 390px, search, guide, changelog, video slots)"
    expected: "As defined in 276-CONTEXT G4-1..G4-4; Chrome MCP drives them, operator signs off"
    why_human: "Needs a real browser; wire format and unit tests are insufficient under G-4"
  - test: "Iris avatar: exactly one moving avatar, it settles, no loop stutter, static under prefers-reduced-motion"
    expected: "One live avatar in MessageItem; RunCard logo static; reduced motion shows steady lit core"
    why_human: "Animation feel and reduced-motion rendering are visual"
  - test: "Scalar API reference styling on a production preview build"
    expected: "Scalar matches the docs/landing look and renders every non-internal operation"
    why_human: "Visual; production-bundle CSS behaviour"
  - test: "Build Story page and video slots read honestly on a real page"
    expected: "No copy promises videos that do not exist; empty slots read as empty"
    why_human: "Copy and tone judgement"
---

# Phase 276 Verification

**Goal:** a buyer, a user and a developer can each learn everything Syrel does from `/docs` on the landing domain, which looks like the landing page, says only what shipped, and cannot quietly fall behind the product.
**Status:** human_needed. Every automated check passed; no gaps found.

## Success criteria

| SC | Verdict | Evidence (commands run on develop HEAD) |
|---|---|---|
| 1 third Vite entry, bundle fence | VERIFIED (visual parts human) | `frontend/vite.config.ts:93` has `docs: docs.html` as an input; `vercel.json` has `/docs` and `/docs/(.*)` → `/docs.html`. `docs.html` and `src/docs/` exist. Docs header imports the landing `Navigation` (`DocsHeader.tsx:6`) and `LandingFooter` (`DocsApp.tsx:18`). After `npx vite build` (built OK), `node scripts/check-landing-first-paint.cjs` printed "landing first paint OK — 14 first-paint files, none carries @remotion / acknowledgeRemotionLicense / remotion.media / scalar / minisearch". Vitest on `src/docs`, `src/landing` and IrisAvatar: 28 files, 211 tests, all pass, including `docsBundleFence`, `docsVercelRouting` and `devRouting`. |
| 2 coverage gate | VERIFIED | `node scripts/check-docs-coverage.cjs` exit 0: "110 code keys · 261 inventory IDs · 119 pages (31 written / 88 stubs) … coverage OK". The scan set is parsed from code (nav-items, `App.tsx`, `SettingsPage.tsx`, `tool_dispatcher.py`, `main.py`); these are the files the test copies as inputs. `docsCoverageGate.test.ts` (14 cases, passing) plants defects into a tmp `--root`, and the header states the floors apply under `--root` and cannot be lowered. Hook registered at `.claude/settings.json:130`; CI `.github/workflows/docs-coverage.yml` exists. |
| 3 public API spec | VERIFIED | `node scripts/build-public-openapi.cjs --check` exit 0: "current (189/231 paths, 204 schemas, version 4.4)". Read from the JSON: title "Syrel API", 0 paths containing `admin`, description states no API keys or tokens today, a signed-in user's `Authorization: Bearer <token>` is used, and links SEED-013. The only "Agentic RAG" hit is a mutated title in `publicOpenapi.test.ts:270` used as a negative control. |
| 4 prod docs gate | VERIFIED | `pytest tests/unit -k 276_api_docs`: 63 passed. `main.py:769` sets `docs_url/redoc_url/openapi_url=None`; `api_docs.py` serves them behind `get_current_user` when `ENVIRONMENT` is `production` or `prod` (401 with `WWW-Authenticate: Bearer`). The tests include `test_local_unset_environment_serves_docs_without_a_token` for `/docs`. Boot log states GATED or OPEN (`main.py:320-330`). REVIEW A reports the 401, bad-token 401, GoTrue-down 503 and banned-user 403 semantics traced, and the fix pass is recorded all_fixed. |
| 5 changelog v1.0 → v4.4 | VERIFIED | `docs/history/` holds v1.0 … v4.4 plus `v4.5-find-it-show-it.md`. The "not yet released" string is in `pages/copy.ts` and `DocBadge`, covered by `ChangelogPage.test.tsx` and `changelog.test.ts` (passing). I did not render the page in a browser. |
| 6 Remotion lazy, guides embed clips, Syrel rename | VERIFIED | `video/RemotionSlot.tsx:41` is `lazy(loadPlayer)` and `VideoSlot.tsx:61` is `lazy(loadRemotionSlot)`. The first-paint fence confirms nothing Remotion loads with the landing. `grep -rn "Agentic RAG" frontend/src/landing` returns no hits. A repo-wide search of `frontend/src`, `public` and `*.html` finds the string only in the one test negative control. |

## Decisions D-24 / D-26 / D-27

- **D-24 avatar:** `IrisAvatar.tsx` and `irisMotion.ts` exist, with a unit test. `MessageItem.tsx` uses it (2 references). `RunCard.tsx` has 0 references, so there is one live avatar. `IrisAvatar.tsx:42,77,247` reads `prefers-reduced-motion` and shows a steady lit core. Behaviour is human-verified below.
- **D-26 Build Story:** `pages/BuildStory.tsx` renders five chapters from the README arc table, with `BuildStory.test.tsx` passing. The page has no "coming soon" copy promising videos. A `VideoSlot` empty state exists.
- **D-27 logo pass:** No "Agentic RAG" remains in `frontend/src` (other than the test control), `frontend/public` or the `*.html` entries. I did not re-audit rasters, manifest, OAuth client name or invite email beyond the REVIEW A trace, which found the invite email escaped.

## "How we'd know this failed" scan

- Unbuilt claims: `get-started/overview.md:28` says "Word and PDF files are downloaded, not previewed inside Syrel", which is honest. v4.5 is badged "not yet released".
- Gate reads a hand-typed list or passes on zero items: no. It derives from code and has floors.
- Docs pull app dependencies into landing: no, per the first-paint fence.
- `/docs` falls through to `app.html`: no, per `vercel.json` and the routing tests.
- Public spec lists internal operations: no, 0 `admin` paths.
- Prod Swagger open: gated when `ENVIRONMENT=production`. The gate depends on the env var being set, which is an operator-owed item below.
- Remotion on first paint: no.

## Gate results

- Orchestrator-measured: vitest count gate 9911 total, 0 failed, 419/419 pinned. Backend baseline 71 failed, within the 71 ceiling. tsc app config 70 errors (66 base + 4 transitional from Phase 274 in ChatAttachmentChip/FilesSection, none in 276 files). I did not re-run these.
- I re-ran: docs coverage, public OpenAPI check, `vite build` plus first-paint check, the 63 backend 276 tests, and the 28 frontend docs/landing/avatar suites. All passed.
- I did not re-run the full count gate or the full backend baseline. I saw no Phase 274 file breaking a 276 gate.
- Working tree: no 276 files are uncommitted.

## Human verification required

1. G4-1 to G4-4 in a real browser (docs home, guide, changelog, search, desktop and 390px).
2. Iris avatar: one moving avatar that settles, no loop stutter, static under reduced motion.
3. Scalar styling on a production preview build.
4. Build Story and empty video slots read honestly.

## Operator-owed deploy items (not code gaps)

- Vercel: enable "include files outside root" (docs content is read from `../docs`, see `vite.config.ts:80`).
- Coolify: set `ENVIRONMENT=production`, then after deploy run an unauthenticated `curl` against `/docs`, `/redoc` and `/openapi.json`. Each must return 401. Until then DOCS-04 is satisfied in code only.
- `VITE_APP_URL` must be set in the Vercel build env.
- YouTube uploads for the video library (slots render empty until then).
- Supabase auth email templates: the cloud templates need the Syrel/Iris rename applied.

## Gaps summary

None. The roadmap contract holds at the code level, and the status is `human_needed` only because G-4 lived-experience checks and deploy-time items cannot be verified programmatically.

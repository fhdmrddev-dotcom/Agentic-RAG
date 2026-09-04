# Phase 226 — The Public Landing Page

**Proposed:** 2026-09-03, operator-directed at the end of a two-day design session. **Build after 224 / 225 close.**
**Pipeline:** Gemini plans + executes; Claude writes `226-PREFLIGHT.md` against the plans before wave 1 and reviews after (see `feedback_gemini_plans_claude_reviews_pipeline` — cross-plan SEAMS are where the last two escapes came from).
**Approved design (the acceptance bar, G-2 SATISFIED):** Claude Design canvas **Agentic RAG Landing** — https://claude.ai/code/artifact/d33a1829-8e5c-498a-8f65-dcbda8cbc448. Source saved in-repo: `.planning/design/landing-canvas/` (`Main.dc.html`, `icons.json`, `canvas.json`, `README.md`). Folds **`SEED-241`** (the living-page mechanism) — it is not optional and it ships in this phase.

## Goal

A public marketing page at the product's root that shows the whole product — every rail surface, the file formats, the business cases, two category-level comparisons, the model roster and the connector catalog — **rendered from facts derived from code**, so it cannot drift from what ships. It is a **B2B** page: the primary action is *Book a demo*; *Sign in* is a quiet link to the app for existing customers.

## Decisions already taken (do not re-open at plan time)

| # | Decision | Why |
|---|---|---|
| D-226-01 | **Separate Vite entry**, `frontend/landing.html` + `frontend/src/landing/`, NOT a route inside the app SPA | The landing must ship zero app bundle and mount no auth/API provider. Same `index.css` tokens, same `@iconify-json/logos` (`~icons/logos/*`) and `@lobehub/icons` the app already renders. |
| D-226-02 | Root routing: **`/` → landing**, app unchanged on its current paths; Vercel `rewrites` maps only the bare root to `landing.html`. ⚠ **Verify first** how `ChatLayout` handles the bare root URL for a logged-in user; if it depends on `/`, the app moves under `/app` and this becomes a two-line decision in the plan, not a surprise in UAT | Deep links, accept-invite, admin must keep working |
| D-226-03 | CTAs: **Book a demo** primary everywhere → `VITE_DEMO_URL` (a scheduling link; a Google Calendar appointment page is the cheapest honest v1 — it is the Calendar the connectors already talk to). **Sign in** → `VITE_APP_URL` + `/login`. **No lead-capture backend, no form** in v1 | B2B, not self-serve |
| D-226-04 | Every number and list on the page reads **`src/landing/facts.ts`**; nothing literal in JSX | The "eight checks" claim was wrong for a day during design — the gauntlet has TEN |
| D-226-05 | **`scripts/check-landing-drift.cjs`** derives the same facts from source and FAILS on disagreement — in the PostToolUse hook (like `check-claude-md-size.cjs`) and in CI | Same-commit sync rule; the ledger's lesson: silence reads as "unchanged" and means "unwatched" |
| D-226-06 | Comparisons stay **category-level** (no vendor names). A named-vendor table needs a dated per-cell source and is a different phase | Honest by construction |
| D-226-07 | The eight tour scenes are **storyboards** of real component anatomy, built as components under `src/landing/scenes/`; in the built page they run as **continuous loops** (reduced-motion respected). The canvas's hover-to-play was a preview limitation only | |
| D-226-08 | Brand icons come from the icon packages, never redrawn | IP + parity with the app's ICON CONVENTION |

## What `facts.ts` must carry, and where each fact is derived from

| Fact | Source of truth |
|---|---|
| `providers[]` (9 incl. `lmstudio`) | `backend/app/config.py` `MODEL_CAPABILITIES`, grouped by `provider` |
| `ingestFormats[]` (8 dropzone + 3 server-side: `.msg .eml .dxf`) | `frontend/src/components/ingestion/acceptedFormats.ts` + `backend/app/api/documents.py` override table |
| `gauntletStages[]` (10) | `frontend/src/components/workflows/PublishGauntlet.tsx` `STAGES` |
| `toolCount` + groups (30) | `backend/app/services/tool_dispatcher.py` `_TOOL_REGISTRY` |
| `connectorCatalog[]` (15 incl. Custom MCP) | `frontend/src/components/settings/servicesCatalog.ts` |
| `libraryTabs` / `settingsTabs` / `controlRoomTabs` / `orgTabs` | `LibraryPage.tsx` · `SettingsPage.tsx` · `ControlRoomPage.tsx` · org admin page |
| Verbatim quotes | `stepIdentityVocabulary.ts`, `doorVocabulary.ts`, `PublishGauntlet.tsx` `what:` strings |

The drift script reads these with the same regex/AST approach `check-deploy-drift.sh` and `check-claude-md-size.cjs` use — no new tooling.

## Success criteria (what must be TRUE)

1. `http://localhost:5173/landing.html` renders the page **with the app's auth provider and API client absent from the bundle** — proven by a negative import fence test (`landing` chunk must not contain `supabase`, `@/lib/api`, `StreamsProvider`).
2. The page matches the canvas section for section: hero (3D tilted frame, mouse tilt) · facts strip · how it works · 12-tile features · **Tour** (8 tabs, 8 scenes) · Files · Business cases (6 illustrated strips) · quotes · Workflow Studio + gauntlet · Compare (2 tables) · Models ring · Works with (15 logos) · Security · CTA · footer.
3. Every number on the page comes from `facts.ts`; `node scripts/check-landing-drift.cjs` exits 0 on HEAD and **exits 1 when driven RED** by editing any one source (plant → observe red → restore md5-identical; a guard nobody has seen fire is not a guard).
4. `Book a demo` and `Sign in` resolve to `VITE_DEMO_URL` / `VITE_APP_URL`; both vars are in `deploy/onebox.env.example`, `docs/OPERATOR.md`, and `check-deploy-drift.sh` passes — same commit.
5. Reduced-motion: no loop runs; every scene shows its rich end state.
6. Lighthouse-class sanity: the landing bundle < 400 KB gz, first paint under 2 s on the dev box.
7. G-4 lived-experience UAT (Chrome MCP, operator-defined): (a) open `/`, hover each of the eight scenes, confirm each plays its scenario; (b) click every nav link and both CTAs; (c) phone width 390 — no horizontal scroll, tables scroll inside their own container.

## How we'd know this failed (G-6)

- The page imports anything from `src/lib/api*`, `src/providers/*`, or `@supabase/*` — the fence test is the tell.
- A literal number appears in landing JSX (`grep -E "\b(9|10|30|15)\b" src/landing/**/*.tsx` should find none outside `facts.ts` tests).
- The drift guard is green on HEAD but was never driven red.
- Vercel serves the landing at `/` and a logged-in user's bookmark to `/` now lands on marketing with no way in — D-226-02 was not verified.
- Scenes are screenshots (PNG) instead of components — they will rot silently on the next visual change.

## Out of scope

Named-vendor comparison · lead capture / CRM · pricing · testimonials or logos of customers (none exist yet; do not invent) · a blog · the phone artboard beyond responsive CSS (no separate mobile design).

## Deploy (after the milestone closes — operator-triggered, never by an agent)

No migrations. Cloud half = two Vercel env vars + the root rewrite. Promote with the surgical push in `docs/DEPLOYMENT-WORKFLOW.md`; Claude proposes, operator says go.

## Hot files touched (re-derive triples at plan time)

`frontend/vite.config.ts` (new entry) · `frontend/index.html` (unchanged, but its Google Fonts link is duplicated in `landing.html`) · `scripts/` (new guard) · `.claude/hooks/` (hook registration) · `deploy/onebox.env.example` · `.github/workflows/` (drift CI). No G-5 row fires — all new files — but `vite.config.ts` and the hook registry get rows when they cross three phases.

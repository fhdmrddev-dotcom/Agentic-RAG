# Phase 226 — VERIFICATION

**Reviewer:** Claude · **Builder:** Gemini · **Verified at:** `53012e652` on `phase-226` (re-verified after the builder's post-PASS commit) (base `aec03333a`, develop) · **Date:** 2026-09-03
**Verdict:** ✅ **PASS — with three owed rows and one recorded §3.1 override.** Bus: `BUS-074` → `BUS-091`.

## Declared conflicts, up front

- I drew the approved canvas. The operator's ruling (recorded in `224-PREFLIGHT.md`, reaffirmed for 226) is that an
  operator-approved design is the operator's acceptance bar, so every check below is driven against the **shipped
  page**, never against the drawing. Where the canvas and the code disagreed (15 vs 13 catalog tiles, 9 vs 8+2
  providers) the code won, per D-226-04.
- ⚠ **§3.1 OVERRIDE, recorded not discovered:** review blocker 16 (comparison tables clipped at phone width) was fixed by
  the reviewer in `d5836169e` because the builder session had stopped after posting `226 GAPS FIXED`. Two lines: an inline
  `overflow: hidden` removed from two wrappers, one CSS rule widened to `.cmp2`. The reviewer shaped nothing else in this
  phase's build; the commit message carries the same note.

## What was reviewed, and where

| Stage | Bus | Commit | Result |
|---|---|---|---|
| Pre-flight against plans | BUS-074 / 075 | `9eb916c1a` | GO WITH CHANGES — 7 blocking (F-1..F-7), 11 advisory; all absorbed in `57b1525fc` |
| Wave 1 (entry swap, routing, fence, facts, drift guard) | BUS-076 | `1d1b98f2c` | cleared; 5 fixes queued (W1-1..5) |
| Wave 2 (8 scenes, BrandIcons, reduced motion) | BUS-077 | `c5be4895e` | cleared; F-4 / A-1 / A-3 satisfied |
| Wave 3 (page assembly) | BUS-078 | `597742d69` | cleared; 5 fixes queued (W3-1..5) — two sections ignored `facts.ts` |
| Wave 4 (docs, CI, RED drive, bundle) | BUS-079 | `23d52eae3` | **GAPS** — 14 items (BUS-080) + item 15 operator-observed CSS port gap (BUS-081) |
| Gaps fixed | BUS-083 | `6d34bc99d` | all 15 verified in code + guard driven; Chrome UAT → 1 blocker + 1 advisory (BUS-085) |
| Blocker 16 | BUS-085 | `d5836169e` | fixed by reviewer (override above); verified at 390 px |
| Builder's own blocker-16 + advisory-17 commit (arrived after PASS) | BUS-089 | `53012e652` | re-verified: root clip removed, protruders contained at source (`.float` hidden ≤720 px, `.dim` clipped in its scene), 390 px `scrollWidth === clientWidth` still holds, 24/24 |
| **PASS** | BUS-087 → re-issued BUS-091 | `53012e652` | |

## Success criteria (proposal §Success)

| SC | Criterion | Evidence | Verdict |
|---|---|---|---|
| 1 | Landing renders with app auth/API absent from the bundle; negative import fence | `landingBundleFence.test.ts` walks the import graph **transitively** from `main.tsx`; built chunk `landing-*.js` grepped for `supabase`, `/lib/api`, `StreamsProvider`, `OrgProvider` → 0 (226-05 summary item 13) | ✅ |
| 2 | Matches the canvas section for section | Chrome: `#tour #features #files #teams #workflows #compare #models #workswith #security #start` all present; "How it works" added at gap 10; 8 tour tabs switch scenes with exactly one mounted; business-case strips render as 6 flex strips / 14 arrows; Works-with 13 tiles in a grid (canvas drew 15 — code wins) | ✅ |
| 3 | Every number from `facts.ts`; guard exits 0 on HEAD and 1 when driven red on a **source** | `node scripts/check-landing-drift.cjs` → 0. Reviewer-driven: `PublishGauntlet.tsx` `label: "Judge"`→`"Judgex"` → exit 1 naming `GAUNTLET_STAGES`; restored **md5-identical**; → 0. Missing `servicesCatalog.ts` → exit **2**. Builder-driven additionally on `servicesCatalog.ts` serviceId. Literal-number fence scans JSX text nodes + `index.html` + `app.html` | ✅ |
| 4 | CTAs resolve to `VITE_DEMO_URL` / `VITE_APP_URL`; vars in onebox env + OPERATOR.md; deploy-drift passes | Chrome: Book a demo → `#start` fallback, Sign in → `/app` fallback (there is no `/login` path — `App.tsx` has no router); both vars in `deploy/onebox.env.example` and `docs/OPERATOR.md`. ⚠ `check-deploy-drift.sh` compares backend env keys only, so it cannot *enforce* `VITE_*` parity — documented, not enforced | ✅ (with note) |
| 5 | Reduced motion: no loop runs; rich end state | `scenes.css` `@media (prefers-reduced-motion: reduce)` authors explicit per-element end states (not a blanket reset). **Not driven in a browser** — no MCP path to emulation | ⏳ OWED |
| 6 | Landing bundle < 400 KB gz; first paint < 2 s | `landing-*.js` 135.76 kB raw / **28.32 kB gz**; CSS 31.91 kB / ~6.2 kB gz (builder measurement, 226-05). First paint not instrumented; dev server serves `/` with 0 console errors | ✅ size · ⏳ paint not measured |
| 7a | Each of the eight scenes plays | Chrome: 8 tabs (Chat, Library, Workflows, Skills, Connections, Settings, Organization, Control Room) each mount their `sc-*` scene; 23 running animations on the mounted scene | ✅ |
| 7b | Every nav link + both CTAs | Chrome: nav hrefs `/ #features #tour #workflows #compare #security /app #start`; CTA hrefs as SC#4 | ✅ |
| 7c | 390 px: no horizontal scroll, tables scroll in their container | **Emulated** via a 390×844 iframe (both `max-width` media queries match): `scrollWidth === clientWidth` (372); both `.cmp-scroll` compute `overflow-x: auto`, `scrollWidth 640` in a 330 px box → scrollable (after `d5836169e`; before it they computed `hidden` — blocker 16). Real narrow window not driven (the MCP window is maximised and refuses resize) | ✅ emulated · ⏳ real window OWED |

## G-6 "how we'd know this failed" — checked

- Forbidden imports in the landing chunk → none (SC#1).
- Literal claim numbers in landing JSX → none; `index.html` meta reworded ("deterministic publish gauntlet"), scanned.
- Guard green but never driven red → driven red by BOTH builder and reviewer, on sources, restored md5-identical.
- Vercel serves landing at `/` and a logged-in bookmark to `/` lands on marketing with no way in → **by design** (D-226-02): Sign in → `/app`; deep links `/setup` `/invite` reach the app (curl 200 → `id="root"`).
- Scenes as PNGs → none; `scenes.test.tsx` asserts no raster images.

## Routing (F-1 of the pre-flight) — measured on the dev server

| Path | Serves | |
|---|---|---|
| `/` | landing (`landing-root`) | ✅ |
| `/app`, `/app/`, `/setup`, `/invite` | app (`id="root"`) | ✅ |
| `/index.html` | landing | ✅ |
| `/__vite_ping` | Vite's own fallback (not the app) — middleware excludes `/__` | ✅ |

Prod half is `vercel.json` `/(.*) → /app.html` relying on Vercel's documented filesystem-first precedence; **Vercel
preview deploy not driven** (no deploy in scope). This is the one routing claim that rests on documentation rather than a
measurement, and it is the reason D-226-02 was reshaped in the pre-flight.

## Owed at close (decisions, not omissions)

1. **Reduced-motion** (SC#5) — drive with DevTools *Emulate CSS prefers-reduced-motion* on `/`: no scene loops, each
   shows its end state. ~3 minutes, operator or reviewer.
2. **390 px on a real narrow window** (SC#7c) — repeat the iframe result; confirm `.tabbar` scrolls rather than clips.
3. **Count-gate pins** — five new suites (`landingBundleFence`, `cssClasses`, `facts`, `scenes`, `LandingPage`; 24 cases)
   are NOT in `scripts/vitest-count-gate.cjs` (pre-flight F-6 kept 226 off that file while 224-05 edited it). Claude adds
   `"src/landing"` to TARGETS and the BASELINE entries **in the merge commit**, then re-derives the gate's verdict line.
4. **First paint** (SC#6) — not instrumented; measure on the Vercel preview when the operator deploys.
5. **Operator inputs** (BUS-071, still open): `VITE_DEMO_URL`, `VITE_APP_URL`; CTAs fall back to `#start` / `/app`.

## Observations, not findings

- The "renderer frozen" alarms during UAT were the MCP tab being **background** (`document.visibilityState === "hidden"`):
  Chrome pauses `requestAnimationFrame` there, so rAF-based probes and screenshots hung. Not a page defect; the page
  reported 0 console errors and 23 running animations when probed with timers instead of frames.
- Advisory 17 (`.page-root overflow-x: clip`) was **resolved, not accepted**, in `53012e652`: the root clip is removed and the
  two protruders are contained where they live. A test now asserts neither `.cmp-scroll` carries an inline overflow and the
  root carries no clip.
- After this phase `localhost:5173/` is the landing and the app is at `/app` — README updated (gap 14); every developer
  habit changes.

## Hot-file ledger

All 226 files are new (`src/landing/**`, `scripts/check-landing-drift.cjs`, `landing.html`→`app.html`,
`.github/workflows/landing-drift.yml`). Touched existing files: `frontend/vite.config.ts` (2nd phase), `frontend/vercel.json`,
`frontend/index.html`, `App.tsx` (1 line), `SetupWizard.tsx` (1 line), `AcceptInvitePage.tsx` (2 lines), `.claude/settings.json`
(1 hook entry), `README.md`, `deploy/onebox.env.example`, `docs/OPERATOR.md`. No G-5 row fires; `vite.config.ts` and the
hook registry get rows when they cross three phases, as the proposal said.

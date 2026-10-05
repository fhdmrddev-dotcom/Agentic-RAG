# Syrel brand assets

**Chosen logo: #1 "Iris agent"** (operator, 2026-10-04). Source: the "Syrel Agent Logo" artifact (https://claude.ai/artifact/EPq9Yi4BcPnf1SP2jhECEm), option 1 of 3 (Iris agent · Starburst orchestrator · Layers traversal).

~~**Status: chosen, NOT yet inserted.** The app, landing page, docs and videos still show a placeholder. Insert it in one pass later (see "Where it goes").~~
**CORRECTED 2026-10-05 — inserted in Phase 276:** 276-01 one-pass insert (landing, docs, videos, favicon), 276-06 animated chat avatar, 276-07 app-wide pass (user-visible strings, SetupWizard mark, raster set, manifest, head tags, invite email, MCP OAuth client name). The original line is struck through rather than deleted.

| File | What it is | Use |
|---|---|---|
| `syrel-logo-iris-animated.svg` | Original animated lockup, 8 s loop: the iris opens, its core lights, it contracts beside the name, the name draws itself. Respects `prefers-reduced-motion`. | Landing hero, video intros/outros, splash |
| `syrel-lockup-iris.svg` | Static lockup (mark + lowercase "syrel" wordmark), settled final frame | Nav bars, docs header, email, decks |
| `syrel-mark-iris.svg` | Static mark only, 64×64 viewBox | Favicon, app icon, avatar, small sizes |
| `syrel-lockup-email.png` | 480×240 PNG: the lockup on a `#06090F` rounded card (generated) | Invite email header (shown at 160×80) |
| `og-image.png` | 1200×630 PNG: the lockup on `#06090F` with a soft glow (generated) | `og:image` / `twitter:image` link previews |

## The mark

Six petals (ellipses rx 6.5 / ry 13) at 60° steps around a centre core, alternating two gradients, 85% opacity, white core (r 4.5).

| Token | Value |
|---|---|
| Petal gradient A | `#D6D8FF` → `#A3A5FF` → `#6467F2` (top-left → bottom-right) |
| Petal gradient B | `#A3A5FF` → `#3B3FD0` (top-right → bottom-left) |
| Core + wordmark | `#F2F4FE` |
| Background (dark) | `#06090F` (matches the app's Deep Midnight `hsl(216 45% 4%)`) |

The wordmark is lowercase **syrel**. Design for dark backgrounds first; a light-background variant has not been made yet. **The light-theme answer is the dark chip, not a variant:** on a light surface the mark sits on a `#0A0E18` circle (`bg-[#0A0E18] ring-1 ring-inset ring-black/10 dark:ring-white/10`), as in the chat avatar (276-06) and the SetupWizard header (276-07).

## Where it goes (one pass, later)

~~(one pass, later)~~ — done in Phase 276; the list below is where it went, plus the generated raster set.

- **Raster set (276-07), generated, never hand-edited:** `frontend/public/favicon-16.png`, `favicon-32.png` (mark on a rounded `#06090F` square), `apple-touch-icon.png` (180), `icon-192.png` / `icon-512.png` (full-bleed `#06090F`, mark inside the maskable safe zone), `frontend/public/brand/og-image.png` (1200×630) and `brand/syrel-lockup-email.png` (480×240). Regenerate after any SVG change with `node scripts/generate-brand-rasters.cjs` (Playwright's already-downloaded Chromium; no install), and verify with `--check`. `frontend/src/landing/__tests__/brandAssets.test.ts` reads the script's `RASTERS` spec and fences every size.
- **Manifest and head tags (276-07):** `frontend/public/site.webmanifest`; `index.html`, `app.html`, `docs.html` declare the PNG icons, manifest, `theme-color #06090F` and `og:*` / `twitter:*`. Paths are same-origin; `frontend/plugins/brandMeta.ts` makes `og:image` absolute at build from `VITE_APP_URL` (unset → relative, so link previews show no image until it is set).
- **Invite email (276-07):** `backend/app/services/email_provider.py` shows `syrel-lockup-email.png` from the primary `FRONTEND_URL` origin. PNG, never SVG.
- **Operator-owed: Supabase auth emails.** Sign-up / magic-link / reset emails come from Supabase, not our code. Dashboard → Authentication → Email Templates: logo `https://<app host>/brand/syrel-lockup-email.png`, product name Syrel.

- `frontend/src/landing/components/Navigation.tsx` + `LandingFooter.tsx` (currently a layered-stack icon + "Agentic RAG")
- App nav/header and `frontend/public/favicon.svg`
- Docs site (Phase 276) — `logo-ph` placeholder in sketch 276
- Videos — `video/src/components/ui.tsx` `LogoPlaceholder` (one component; every video uses it)

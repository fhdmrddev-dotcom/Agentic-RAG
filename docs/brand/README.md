# Syrel brand assets

**Chosen logo: #1 "Iris agent"** (operator, 2026-10-04). Source: the "Syrel Agent Logo" artifact (https://claude.ai/artifact/EPq9Yi4BcPnf1SP2jhECEm), option 1 of 3 (Iris agent · Starburst orchestrator · Layers traversal).

**Status: chosen, NOT yet inserted.** The app, landing page, docs and videos still show a placeholder. Insert it in one pass later (see "Where it goes").

| File | What it is | Use |
|---|---|---|
| `syrel-logo-iris-animated.svg` | Original animated lockup, 8 s loop: the iris opens, its core lights, it contracts beside the name, the name draws itself. Respects `prefers-reduced-motion`. | Landing hero, video intros/outros, splash |
| `syrel-lockup-iris.svg` | Static lockup (mark + lowercase "syrel" wordmark), settled final frame | Nav bars, docs header, email, decks |
| `syrel-mark-iris.svg` | Static mark only, 64×64 viewBox | Favicon, app icon, avatar, small sizes |

## The mark

Six petals (ellipses rx 6.5 / ry 13) at 60° steps around a centre core, alternating two gradients, 85% opacity, white core (r 4.5).

| Token | Value |
|---|---|
| Petal gradient A | `#D6D8FF` → `#A3A5FF` → `#6467F2` (top-left → bottom-right) |
| Petal gradient B | `#A3A5FF` → `#3B3FD0` (top-right → bottom-left) |
| Core + wordmark | `#F2F4FE` |
| Background (dark) | `#06090F` (matches the app's Deep Midnight `hsl(216 45% 4%)`) |

The wordmark is lowercase **syrel**. Design for dark backgrounds first; a light-background variant has not been made yet.

## Where it goes (one pass, later)

- `frontend/src/landing/components/Navigation.tsx` + `LandingFooter.tsx` (currently a layered-stack icon + "Agentic RAG")
- App nav/header and `frontend/public/favicon.svg`
- Docs site (Phase 276) — `logo-ph` placeholder in sketch 276
- Videos — `video/src/components/ui.tsx` `LogoPlaceholder` (one component; every video uses it)

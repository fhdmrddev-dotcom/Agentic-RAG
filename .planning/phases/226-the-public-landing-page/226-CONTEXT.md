# Phase 226: The Public Landing Page - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning
**Source:** Operator-directed design session (2026-09-02/03), 226-PROPOSAL.md, SEED-241

<domain>
## Phase Boundary

Delivers a high-performance public marketing page at the product's root URL (`/`) that showcases the entire product: every rail surface, supported file formats, business cases, category-level comparisons, model roster, and connector catalog.
The page is rendered from facts derived directly from application code (`facts.ts`), defended by a drift guard (`scripts/check-landing-drift.cjs`).
This is a B2B marketing surface: "Book a demo" is the primary CTA (`VITE_DEMO_URL`), and "Sign in" is a quiet link to the application (`VITE_APP_URL/login`). No auth provider or API client is bundled with the landing page.
</domain>

<decisions>
## Implementation Decisions

### Architecture & Bundling
- **D-226-01: Separate Vite Multi-Page Entry.** `frontend/landing.html` and `frontend/src/landing/main.tsx`. The landing page is completely isolated from the application SPA. Zero app bundle: no Supabase client, no API client (`@/lib/api`), no auth provider (`useAuth`, `StreamsProvider`). Uses existing design tokens from `frontend/src/index.css`.
- **D-226-02: Root Routing.** Vercel rewrites map bare root `/` to `landing.html`, and `/(.*)` to `index.html`. In `App.tsx`, `SetupWizard.tsx`, and `AcceptInvitePage.tsx`, post-auth and completion redirects navigate to `/app` (or `/login`), ensuring that authenticated sessions never bounce back to marketing.
- **D-226-03: B2B Routing & Placeholders.** Primary CTA is "Book a demo" (`VITE_DEMO_URL`), linking to a scheduling calendar (Google Calendar appointment page). Secondary CTA is "Sign in" (`VITE_APP_URL + "/login"`). Both environment variables are left blank by default for the operator. No lead capture form or database backend in v1.

### Living Claims & Anti-Drift Mechanism (SEED-241)
- **D-226-04: Single Fact Manifest (`facts.ts`).** Every count, list, tab set, quote, and capability on the page is exported from `frontend/src/landing/facts.ts`. No bare literal numbers or lists in landing JSX.
- **D-226-05: Drift Guard Script (`scripts/check-landing-drift.cjs`).** Derives ground truth directly from backend and frontend source files:
  - `MODEL_CAPABILITIES` in `backend/app/config.py` (providers)
  - `ACCEPTED_FORMATS` in `frontend/src/components/ingestion/acceptedFormats.ts` + `backend/app/api/documents.py` (formats)
  - `STAGES` in `frontend/src/components/workflows/PublishGauntlet.tsx` (gauntlet stages)
  - `_TOOL_REGISTRY` in `backend/app/services/tool_dispatcher.py` (tool count and groups)
  - `CATALOG_SERVICES` in `frontend/src/components/settings/servicesCatalog.ts` (connector catalog)
  - Tabs in `LibraryPage.tsx`, `SettingsPage.tsx`, `ControlRoomPage.tsx`, and `OrgAdminShell.tsx`
  - Quotes in `stepIdentityVocabulary.ts`, `doorVocabulary.ts`, `PublishGauntlet.tsx`
  Fails with exit code 1 on disagreement. Tested red-first before completion.

### Content & Visual Design (G-2 Satisfied)
- **D-226-06: Category-Level Comparisons.** Both comparison tables compare Agentic RAG against product categories (General chat assistant, Enterprise search, Workflow automation platform, In-house build), never named competitor brands.
- **D-226-07: Storyboards as Components.** The eight tour scenes are built as React components under `src/landing/scenes/`. They run continuous CSS/SVG animation loops in production, with full `prefers-reduced-motion: reduce` fallback showing the rich completed state.
- **D-226-08: Icon Conventions.** Brand icons use `@iconify-json/logos` (`~icons/logos/*`) and `@lobehub/icons`, mirroring the main app convention. No redrawn or external uncurated logos.

### Claude's Discretion
- Organization and naming of subcomponents under `src/landing/components/`.
- CSS structure for landing page specific animations while reusing `index.css` tokens.
- Implementation details of the negative bundle import fence test.
</decisions>

<canonical_refs>
## Canonical References
- `.planning/phases/226-the-public-landing-page/226-PROPOSAL.md` — The core proposal, locked decisions, and acceptance bar.
- `.planning/seeds/SEED-241-living-landing-page.md` — Living landing page mechanism and drift guard specification.
- `.planning/design/landing-canvas/README.md` and `Main.dc.html` — Approved Claude Design canvas source.
- `frontend/src/index.css` — Deep Midnight color tokens, base utilities, and theme classes.
- `frontend/src/components/ingestion/acceptedFormats.ts` — Source of truth for dropzone formats.
- `frontend/src/components/workflows/PublishGauntlet.tsx` — Source of truth for gauntlet stages (10 checks).
- `backend/app/services/tool_dispatcher.py` — Source of truth for `_TOOL_REGISTRY`.
- `backend/app/config.py` — Source of truth for `MODEL_CAPABILITIES`.
- `frontend/src/components/settings/servicesCatalog.ts` — Source of truth for service catalog.
</canonical_refs>

<specifics>
## Specific Ideas
- 3D perspective hero with mouse-driven subtle tilt (`rotateX`, `rotateY`).
- Interactive 3D orbiting provider ring with real SVG logos.
- Interactive tour tabs matching 8 primary app surfaces.
- Fully responsive at 390px mobile viewport without horizontal page overflow.
</specifics>

<deferred>
## Deferred Ideas
- Named-vendor comparison tables (requires dated per-cell citation phase).
- In-app lead capture form and CRM webhook integration.
- Pricing page and self-serve checkout.
- Customer testimonial section (until customer approvals exist).
</deferred>

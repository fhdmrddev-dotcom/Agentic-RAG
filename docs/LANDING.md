# The Living Public Landing Page (`/`)

**Phase 226 / SEED-241 Architectural Specification**

The public landing page for Agentic RAG is a **living marketing and educational surface** that resides at the domain root (`/`), separate from the authenticated single-page application (`/app`).

Every technical claim, list of providers, tool count, format chip, and workflow check displayed on the landing page is **derived directly from product source code**. If the product moves, automated drift guards prevent the landing page from displaying stale or rotting claims.

---

## 1. Multi-Page Architecture & Bundle Isolation

To ensure blazing-fast load times, optimal SEO, and strict security isolation, the repository uses a multi-entry Vite build:

| Entry Point | HTML Template | Entry Script | Output Chunk | Purpose |
|-------------|---------------|--------------|--------------|---------|
| **Landing** | `frontend/index.html` | `frontend/src/landing/main.tsx` | `dist/index.html`, `dist/assets/landing-*.js` | Public landing page, product tour, 3D animations, zero auth overhead |
| **App** | `frontend/app.html` | `frontend/src/main.tsx` | `dist/app.html`, `dist/assets/app-*.js` | Authenticated SPA (chat, workflows, library, settings, control room) |

### Routing Guarantees

- **Production (Vercel)**: Configured in `frontend/vercel.json`. The root (`/`) serves `index.html`. All other extensionless routes (`/app`, `/login`, `/setup`, `/invite/*`) rewrite to `/app.html`.
- **Development & Preview**: Implemented via `appRoutingPlugin` in `frontend/vite.config.ts`. Intercepts incoming HTTP requests in the Vite dev server and rewrites non-root routes to `/app.html`.
- **Negative Bundle Fence**: `frontend/src/landing/__tests__/landingBundleFence.test.ts` statically inspects the dependency graph of `src/landing/`. It asserts that heavy app dependencies (such as `@supabase/supabase-js`, `zustand`, `react-router-dom`, `monaco-editor`, `pdfjs-dist`) are **never transitively imported** into the landing bundle.

---

## 2. The Living Facts Manifest & Drift Guards

Marketing pages typically rot within weeks as product code advances. SEED-241 solves this by converting product claims into an enforceable contract.

### Single Source of Truth (`facts.ts`)

All quantitative claims and verbatim copy are frozen and typed in `frontend/src/landing/facts.ts`:

- **Model Providers**: Cloud providers (`MODEL_PROVIDERS`) and local runtimes (`LOCAL_RUNTIMES`).
- **Ingest Formats**: Dropzone extensions (`INGEST_FORMATS`) combining client MIME mappings and server-side parsers.
- **Workflow Gauntlet**: Exact stages (`GAUNTLET_STAGES`) required before automation can publish.
- **Tool Count**: Built-in capabilities (`BUILTIN_TOOL_COUNT`) registered in the backend dispatcher.
- **Connectors**: Verified third-party integrations (`CONNECTOR_CATALOG`).
- **Verbatim Quotes**: Exact strings (`VERBATIM_QUOTES`) copied verbatim from UI components.

### Automated Drift Guard (`scripts/check-landing-drift.cjs`)

A static verification script that runs in **< 100ms** by inspecting source code directly:
- Validates providers against `MODEL_CAPABILITIES` in `backend/app/config.py`.
- Validates ingest formats against `ACCEPTED_FORMATS` in `frontend/src/components/ingestion/acceptedFormats.ts` and `backend/app/api/documents.py`.
- Validates gauntlet stages against `STAGES` in `frontend/src/components/workflows/PublishGauntlet.tsx`.
- Validates tool counts against `_TOOL_REGISTRY` in `backend/app/services/tool_dispatcher.py`.
- Validates connector services against `CATALOG_SERVICES` in `frontend/src/components/settings/servicesCatalog.ts`.
- Validates surface tabs against respective page components.

### Enforcement Layers

1. **Claude Agent PostToolUse Hook**: `.claude/hooks/landing-drift-guard.js` triggers silently after any tool edits files in `backend/` or `frontend/`. If source code is modified without updating `facts.ts`, the hook immediately alerts the agent.
2. **JSX Text-Node Fence**: `frontend/src/landing/__tests__/facts.test.ts` scans all `.tsx` files under `src/landing/` and fails if any claim numeral (`8`, `10`, `11`, `13`, `29`) is hardcoded directly as a JSX text node instead of imported from `facts.ts`.
3. **Continuous Integration**: `.github/workflows/landing-drift.yml` runs `node scripts/check-landing-drift.cjs` and the vitest landing suite on every pull request.

---

## 3. Commercial & Routing Conventions (B2B)

Per operator directive, Agentic RAG is an enterprise B2B platform:

- **Primary Call to Action**: "Book a demo" routes to `VITE_DEMO_URL` (or jumps to `#start` if left blank).
- **Customer Sign-in**: "Sign in" links point to `VITE_APP_URL` (default `/app`, **never** `/login`). Existing customers sign into their workspace via Supabase auth handled inside the app.
- **Comparison Philosophy**: Comparison tables are **category-level** (comparing against "General AI chat assistant", "Enterprise search", "Automation / RPA tool", and "In-house build"). No competitor trademarks are used without dated, third-party verified source citations.

---

## 4. Tour Scenes & Visual Storyboards

The 8 product tour tabs (`Chat`, `Library`, `Workflows`, `Skills`, `Connections`, `Settings`, `Organization`, `Control Room`) render rich, live CSS-animated storyboards:

- Hand-crafted under `frontend/src/landing/scenes/`.
- Run continuous keyframe loops (5s floor slide, 10s-12s feature loops) rather than requiring user interaction.
- **Accessibility & Reduced Motion**: Fully compliant with `prefers-reduced-motion: reduce`. All continuous transforms and keyframe loops stop, settling on clear, readable static states.

---

## 5. Maintenance Playbook: When Product Code Moves

When shipping a new feature in subsequent phases:

1. **Ask**: *"Is this change landing-worthy?"* (e.g. adding a new model provider, new file format, new tool, or new gauntlet check).
2. If yes:
   - Update `facts.ts` in the **same commit** as the source code change.
   - Run `node scripts/check-landing-drift.cjs` to confirm zero drift.
   - Run `npx vitest run src/landing/` to verify tests and JSX text fences.
3. If `check-landing-drift.cjs` fails in CI or locally, it will print exact line diffs showing what changed in the product versus what was declared in `facts.ts`.

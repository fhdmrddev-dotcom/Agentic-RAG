---
seed_id: SEED-241
title: "The landing page is a LIVING artefact — its claims must be derived from code and re-checked when the product moves, and it must route B2B visitors to a demo, not a sign-up"
created: 2026-09-03
planted_during: Operator-directed landing-page design session, 2026-09-02/03 — *"this is a live landing page so you should find some way to trigger something to update it when we introduce a new feature"* and *"this application is business to business … it should show a demo instead of sign in but we should have it linked to the application somewhere"*
status: shipped
shipped_in: 226
shipped_date: 2026-09-03
surface: Agentic-RAG
severity: medium
category: marketing-surface / routing / drift-guard
priority: medium
relates_to:
  - frontend/src/index.css                              # Deep Midnight tokens the landing was matched to
  - frontend/src/components/ingestion/acceptedFormats.ts # "Ingest" chips
  - frontend/src/components/workflows/PublishGauntlet.tsx # STAGES — the "10 checks" claim
  - backend/app/services/tool_dispatcher.py            # _TOOL_REGISTRY — the "thirty tools" claim
  - backend/app/config.py                              # MODEL_CAPABILITIES — the provider roster
  - frontend/src/components/settings/servicesCatalog.ts # the connector catalog grid
  - frontend/src/lib/connectionMark.tsx                # the ~icons/logos set the landing reuses
trigger_when: >
  (a) the landing page is ported from the design canvas into a real route — build the drift guard IN THE SAME PHASE, never after;
  (b) any commit changes acceptedFormats.ts, PublishGauntlet STAGES, _TOOL_REGISTRY, the MODEL_CAPABILITIES provider set, or servicesCatalog.ts — the guard must go red until the landing manifest is updated;
  (c) /gsd:complete-milestone — the close checklist gains a "landing-worthy?" line per shipped phase.
trigger_paths:
  - "**/acceptedFormats.ts"
  - "**/servicesCatalog.ts"
---

# SEED-241 — the living landing page

## What was decided at the design session (2026-09-03)

The approved design lives at the Claude Design canvas **"Agentic RAG Landing"**
(https://claude.ai/code/artifact/d33a1829-8e5c-498a-8f65-dcbda8cbc448). Working files are saved
at `.planning/design/landing-canvas/` (`Main.dc.html`, `icons.json`, `canvas.json`); the design is the acceptance bar for the build, per the
Stitch+sketch rule — the build renders the shipped tokens, it does not re-invent them.

**Structure that was approved:** hero (3D tilted product frame, mouse tilt) → facts strip →
how it works → 12-tile feature grid → **Tour** (eight tabs mirroring the rail, each with a
hover-to-play scenario scene) → Files (ingest / extract / produce) → Business cases (six teams,
illustrated flow strips) → verbatim product quotes → Workflow Studio + gauntlet → two
comparisons (category-level, no vendor names; the second is the 30-row "full picture") →
Models (provider ring, real logos) → Works with (15 apps, real logos) → Security → CTA.

**B2B routing decision (operator):** this is not a self-serve product. The landing's primary
CTA is **Book a demo**; **Sign in** is a quiet link for existing customers. The canvas carries
placeholders `[APP_URL]/login` (as `data-href`) and `#start` for the demo. At build time:

- Landing at the marketing root (`/`, Vercel), app at `app.<domain>` (or `/app`) — the
  landing bundle must NOT load the app bundle; separate route tree, no auth provider mounted.
- **Book a demo** → a scheduling link or a short form (`[DEMO_LINK]`). Cheapest honest option
  that reuses what we ship: a Google Calendar appointment page — the same Calendar the
  connectors already talk to. Do not add a lead-capture backend for v1.
- **Sign in** → `[APP_URL]/login`. One link, in the nav and the CTA band, never a form on
  the landing.
- The compare tables stay **category-level**; a named-vendor table is only allowed with a
  per-cell source, dated.

## Why it needs a guard (the whole point of the seed)

Every number and list on the page is a **claim derived from code**, and each one has already
rotted once during the design session: the gauntlet was written as "eight checks" until
`PublishGauntlet.tsx` was read (it is ten); the tool count came from `_TOOL_REGISTRY` (30);
the format chips from `acceptedFormats.ts` (8 in the dropzone + 3 server-side); the catalog
from `servicesCatalog.ts` (15 incl. MCP); the provider ring from `MODEL_CAPABILITIES` (9 incl.
LM Studio). A landing page that is hand-edited will drift within a week — that is the same
mechanism as the hot-file ledger and `docs/SANDBOX-PACKAGES.md`, and it gets the same fix.

## The mechanism (build this when trigger (a) fires)

1. **`frontend/src/landing/facts.ts`** — ONE typed manifest the landing renders from:
   `providers[]`, `ingestFormats[]`, `gauntletStages[]`, `toolCount`, `toolGroups`,
   `connectorCatalog[]`, `libraryTabs[]`, `settingsTabs[]`, `controlRoomTabs[]`. No literal
   number or list in the landing JSX — everything reads the manifest.
2. **`scripts/check-landing-drift.cjs`** — derives the same facts from source
   (`MODEL_CAPABILITIES` providers, `ACCEPTED_FORMATS.extensions`, `STAGES.length` and labels,
   `_TOOL_REGISTRY` keys, `servicesCatalog` names, the three tab lists) and FAILS when the
   manifest disagrees. Runs in the PostToolUse hook like `check-claude-md-size.cjs` so it
   fires in the turn that changes the source, and in CI as the backstop. Same-commit sync
   rule: a source change and its manifest change land together or the gate is red.
3. **`docs/LANDING.md`** — the narrative half (which sections exist, which claim maps to which
   source, the B2B routing decision above, the "hover-to-play" caveat that applied only to
   the design canvas and NOT to the built route where loops run continuously).
4. **GSD touchpoint** — `/gsd:complete-milestone` and each phase close ask one question per
   shipped phase: *"landing-worthy?"* If yes, the phase's close commit also updates
   `facts.ts` / the relevant section, and `docs/LANDING.md` gets a dated line. If no, say so
   — silence reads as "unchanged" and means "unwatched" (the ledger's own lesson).
5. **Scenes are storyboards, not screenshots.** The eight tour scenes are hand-built
   compositions of the real components' anatomy. When a surface they depict changes (run
   card, approval card, gauntlet strip, Skill Studio tabs, Control Plane tiles) the scene
   is part of that phase's blast radius — add `frontend/src/landing/scenes/*` to the hot-file
   scan when they exist.

## Re-open

- Fires on (a), (b) or (c) above.
- Also re-open if a named-vendor comparison is requested — it needs the sourcing rule first.

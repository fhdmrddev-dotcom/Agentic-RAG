---
seed_id: SEED-330                 # SEED-329 is reserved by plan 270-05 (document-download-audit-trail); 330 taken to avoid a collision
title: Brand and assistant avatar — rename to Syrel and apply the animated Iris logo everywhere
created: 2026-10-03
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The operator confirms the name AND trademark/domain clearance is done (USPTO SYREL and SYRE checked, syrel.ai bought), OR any phase edits the product name, favicon, nav brand, auth card, landing header or the assistant avatar.
trigger_paths: ["frontend/index.html", "frontend/app.html", "frontend/src/components/ui/avatar.tsx", "frontend/src/components/layout/NavPanel.tsx", "frontend/src/components/auth/AuthCardShell.tsx", "frontend/src/landing/components/Navigation.tsx", "frontend/src/landing/components/LandingFooter.tsx", "frontend/src/components/chat/MessageItem.tsx", "frontend/src/components/chat/RunCard.tsx"]
trigger_surfaces: [auth, chat, panel]
migration_note:
relates_to: ["SEED-242", "docs/HOT-FILE-LEDGER.md", "G-2", "G-5"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-330: Brand and assistant avatar — rename to Syrel and apply the animated Iris logo everywhere

## The finding

The product is called "Agentic RAG", which the operator calls generic. On 2026-10-03 a naming and logo session picked **Syrel** (provisional) and the logo concept **1, "Iris agent"**: six petals open to perceive, a core lights, the iris contracts to the left and the name `syrel` draws itself stroke by stroke. Prototype SVGs live outside the repo (session scratchpad, `syrel-agent-iris.svg`, Inter SemiBold outlined for the wordmark, 8 s loop); they are not committed.

"Agentic RAG" currently appears in `frontend/index.html`, `frontend/app.html`, the landing page (`Navigation`, `LandingFooter`, `CompareSection`), `AuthCardShell`, `NavPanel`, and the avatar primitive is `frontend/src/components/ui/avatar.tsx`. A first count found about 58 frontend files mentioning brand, logo or avatar terms; that is a rough grep, not an audit.

## Why it matters

The operator wants the brand to be consistent and alive everywhere the logo appears, and wants the assistant to have an animated avatar (idle, thinking, streaming, done) in chat. A generic name is also a sales and trademark liability for the B2B direction.

## When to surface

Two conditions, either fires it:
1. The operator confirms the name after clearance (see Blockers).
2. A phase edits any file in `trigger_paths`, since a brand change must land in one shared component rather than per-surface copies.

## Scope estimate

**Large**, a phase or two. Several of these files are G-5 hot files (`NavPanel.tsx`, `MessageItem.tsx`, `RunCard.tsx`, `App.tsx`), so the phase must read their sections in `docs/HOT-FILE-LEDGER.md` first and propose any extraction before editing.

## Blockers (not code)

- **Name not confirmed.** Domain check on 2026-10-03: `syrel.ai`, `.io`, `.app`, `.dev`, `.cloud` and `.org` are free; `.com`, `.co`, `.so` and `.net` are taken. Nothing has been bought.
- **Trademark not checked.** Web search found only an unrelated hair brand called "Syrel" and a company called Syre LLC. The real USPTO search (classes 9 and 42, "SYREL" and "SYRE") is still owed. Rejected names and why: Lodestar and Quorum (live software companies, no free domains), Cairn (five-plus agent/knowledge products already named Cairn).

## Required shape (for the future plan)

- `/gsd:sketch` first (G-2): the operator-approved mockup is the acceptance bar, covering the avatar states and where the full animation plays versus a static mark.
- One shared logo component, one home. No per-surface copies.
- Static fallback for `prefers-reduced-motion` and for sizes of 16 px and below (favicon is the static mark only).
- The wordmark is outlined paths, not live text, so it renders without the font.
- The operator ranked 1 (Iris) best; 2 (Starburst) and 4 (Layers) were also liked, and the "agent" framing (it acts, then writes its own name) is the brief.
- Includes a PNG export set for places SVG animation does not run (email, social cards).
- Update deploy artifacts if the name appears in env vars or docs (`deploy/onebox.env.example`, `docs/OPERATOR.md`), same-commit rule.

## Breadcrumbs

- Palette source: `frontend/src/index.css` (`.dark`: background `216 45% 4%` ≈ `#06090F`, card `220 30% 7%` ≈ `#0C1017`, primary `239 100% 82%` ≈ `#A3A5FF`; light primary `239 84% 67%` ≈ `#6467F2`).
- Not part of phase 270 (document download and file facts); operator agreed it is a separate phase.

---
sketch: 276
name: public-docs
question: "What shape should Syrel's public /docs take on the landing domain — docs app, landing-native, or a video-first learning path?"
winner: "B"
tags: [landing, docs, changelog, video, marketing, responsive]
---

# Sketch 276: Syrel public docs (/docs)

## Design Question
Syrel's docs live on the landing domain as a third Vite entry (`docs.html` → `src/docs/`), reusing the landing's Navigation, footer and Deep Midnight tokens. Which overall shape fits a B2B buyer *and* a new user — and where does video sit?

## How to View
open .planning/sketches/276-public-docs/index.html
(Top bar = direction A/B/C · second bar = page: Docs home / Guide article / Changelog · bottom-right = Desktop / Phone 390. The video slot plays the local render `video/out/syrel-overview.mp4`; on the real site it is a lazy-loaded Remotion `<Player>`.)

## Variants
- **A: Docs app (3-column)** — Stripe/Vercel-style: left nav tree, article, right "On this page". Home = video + 3 start cards + guides grid + "What's new". Path of least resistance; best for depth and search.
- **B: Landing-native** — the docs feel like a continuation of the landing page: big hero + search + large video, bento guide grid, chapter strip; articles are a single centred column with a floating TOC pill. Best for marketing pull, weaker for long reference reading.
- **C: Learning path (video-first)** — six numbered lessons, each a 15-s clip + 5-min read, with progress checks; lesson sidebar on guide pages; changelog as a chaptered vertical timeline. Best for onboarding; needs a clip per lesson.

## What to Look For
- Does the page still feel like *the landing* (nav, colour, type), or like a different product?
- Where does the video earn its place — hero (B), beside start cards (A), or per lesson (C)?
- Guide page: is a left nav + right TOC (A) or a calm single column (B) better for 8-minute reads?
- Changelog: table rows (A/B) vs chaptered timeline (C) — which tells "shipped, not promised" best?
- Phone 390: menu drawer, single column, nothing cut off.
- Mixing is allowed: e.g. B's home + A's guide page + C's changelog.

## Content honesty (all variants)
Guides only describe shipped, still-true behaviour from `docs/history/`. v4.5 shows "not yet released". Word/PDF files are described as downloaded, not previewed in-app (SEED-338).

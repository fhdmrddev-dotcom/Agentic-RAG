# Phase 276: Public Docs, API Reference & Video Library - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-04
**Phase:** 276-public-docs-api-reference-video-library
**Areas discussed:** First 30 pages + search, Video slots + hosting, Logo pass in 276?, Developer section edges, G-4 scenarios

Sweeps before discussion: seeds register 0 matched (phase declares no surfaces yet); 0 open `Agentic-RAG` reported bugs overlap; 1 todo keyword match (NL→workflow spike) reviewed, not folded.

---

## First 30 pages + search

| Question | Options | Selected |
|---|---|---|
| Who are the first ~30 pages for? | Buyer + new user · Developer first · One per section | Buyer + new user ✓ |
| What does a stub show? | Summary + links · Title + badge only · Hidden from nav | Summary + links ✓ |
| Does hero search work now? | Yes, local search · Not yet | Yes, local search ✓ |
| Guide visuals? | Clips + few screenshots · Clips only · Many screenshots | Clips + few screenshots ✓ |

## Video slots + hosting

| Question | Options | Selected |
|---|---|---|
| Which style in which slot? | Split by job · Docs only, landing untouched · Narrated everywhere | Split by job ✓ |
| Remotion delivery? | Live Player · Pre-rendered MP4 | Live Player ✓ |
| NotebookLM MP4 hosting? | YouTube click-to-load · Free object storage (R2) · In the repo on Vercel | YouTube click-to-load ✓ |
| How much new video? | Wrappers + promo · All 18 clips too · Embed only | Wrappers + promo ✓ |

## Logo pass in 276?

| Question | Options | Selected |
|---|---|---|
| Insert the Iris logo? | Full one pass · Public surfaces only · Not in 276 | Full one pass ✓ |
| Animated logo placement? | Video intros/outros only · Landing hero too · Nowhere yet | Video intros/outros only ✓ |

## Developer section edges

| Question | Options | Selected |
|---|---|---|
| Operator API reference public? | Inside each deployment · Public, with a badge | Inside each deployment ✓ |

`/knowledge-health/*` not asked: measured still called by `frontend/src/lib/api/knowledge.ts` (5 calls) → documented as UI-internal.

## G-4 scenarios

Selected all four: Phone 390 read-through · Landing stays fast · Honesty spot-check · Deep link + refresh.

## Claude's Discretion

API renderer (Scalar recommended, Redoc fallback), search library, `/docs/*` routing mechanics, coverage-gate wiring, OpenAPI snapshot drift check, DOCS-04 implementation shape, plan split within G-8's 4.

## Deferred Ideas

12 missing guide clips · documentary eps. 2-5 (beside the phase) · retiring `/knowledge-health/*` · public operator reference · AI docs search · third-party API access (SEED-013/345) · light-background logo.

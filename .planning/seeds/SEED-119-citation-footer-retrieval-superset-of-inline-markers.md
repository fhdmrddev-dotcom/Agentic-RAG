---
seed_id: SEED-119
title: Citation footer lists the full RETRIEVAL set; inline markers show only the model's ATTRIBUTION subset — make the gap legible (dim/badge uncited rows or split "Cited" vs "Also retrieved")
status: open
planted: 2026-07-15
phase_origin: "Operator observation 2026-07-15 (out-of-band during Phase 153 close): footer lists e.g. 23 numbered sources but only a handful appear as inline [n] markers in the answer ('I have 5 sources but I see in the text only 4'). Confirmed across Google + OpenAI + DeepSeek threads. Verified NOT a data/render bug — every inline marker maps to a real footer source (0 out-of-range). It's the intended D-06/D-07/D-04 design surfacing as UX confusion. Operator asked to capture as a seed before secure-phase."
category: chat UX — CitationList/CitationCard footer; cited-vs-retrieved legibility (design contract change)
related_bugs: []
related_seeds:
  - SEED-118 (weak-model tool-loop harness) — shares root cause: weak models retrieve many chunks but attribute few, which WIDENS this footer/marker gap
related_phases:
  - Phase 153 (inline-citations) — origin; D-06 (footer = full retrieval set), D-07 (markers = model's chosen subset), D-04 (no false-negative repair) are the exact decisions this seed proposes to make legible
related_memories: [seamless-scroll-chat, feedback_uat_lived_experience_gap, feedback_business_value_framing, feedback_preserve_all_deferred_ideas]
priority: medium
surface: Agentic-RAG
trigger_when: unset
---

# SEED-119 — Make the "footer ⊋ inline markers" gap legible

## The observation (confirmed 2026-07-15, real data)

The numbered References footer lists **more** sources than ever appear as inline `[n]` markers in the answer.
psycopg2 :54322 across recent threads:

| Thread | Footer sources | Distinct inline markers | Footer #s never cited inline | Out-of-range markers |
|---|---|---|---|---|
| `b1674171` (13:57) | 23 | [1,9,11,13,15,22] (6) | [2,3,4,5,6,7,8,10,12,14,16,17,18,19,20,21,23] | **[] none** |
| `713b3f2e` (13:55) | 5 | [1,2,5] (3) | [3,4] | **[] none** |
| `df282a55` (13:54, DeepSeek) | 21 | [] (0) | all 21 | **[] none** |
| `c7a3eed5` (09:16, Anthropic UAT) | 9 | [1..9] (9) | none | **[] none** |

This is the operator's "23 sources below but only some are linked / 5 sources but I see 4."

## This is NOT a bug — and that matters

- **`out-of-range = []` everywhere** → set-membership (D-01/D-02/D-03) holds. Every inline marker points at a
  REAL footer source; nothing is fabricated, nothing is mis-numbered. The strip/renumber is honest.
- The gap is **by design**:
  - **D-06** — the footer shows the **full retrieval set** (everything the agent pulled this run) so the user
    can browse all evidence the answer was grounded on.
  - **D-07** — inline markers show only the **subset the model chose to attribute** to specific claims.
  - **D-04** — we deliberately do **no false-negative repair**: if the model used a source but didn't mark it,
    we don't invent a marker.
- So footer ⊋ inline markers is the *correct* mechanical outcome. Stronger models (Anthropic: 9/9) attribute
  most of what they retrieve; weaker models (DeepSeek: 0/21) retrieve broadly and attribute little
  ([[SEED-118]] — same root cause).

## Why a seed: the design is honest but the UX reads as broken

The operator — a careful user — read "23 sources, 6 linked" as a defect. If they do, real users will. The
footer conflates two different things under one numbered list: *what was searched* vs *what was cited*. That's
a legibility gap, not a data gap. Fixing it is a **design-contract change** to the footer (CitationList /
CitationCard — a sketched surface, [[seamless-scroll-chat]]), so it needs sketch-before-plan (G-2), not an
inline patch.

## Suggested shape (advice, not decided)

1. **Distinguish cited vs uncited footer rows in place.** Dim / de-emphasize (or badge "cited") the rows that
   have at least one inline marker, so the eye maps "linked in the text" ↔ "footer row" without counting.
   Lowest-risk; keeps full transparency.
2. **Split the footer into two groups** — "Cited in this answer" (rows with markers) and "Also retrieved"
   (rows without) — with the second group collapsed by default. Clearest mental model; bigger visual change.
3. **A tiny "N of M cited" summary** on the References header ("References · 6 of 23 cited") so the mismatch is
   *expected* instead of surprising.
4. **Do NOT footer-only-the-cited.** Rejected direction — it would (a) destroy the "here's everything I looked
   at" transparency D-06 was chosen for, and (b) make weak-model runs that cite nothing (df282a55) show an
   EMPTY footer despite retrieving 21 sources. The retrieval set must stay visible.
5. **Consider retrieval noise separately.** A 23-source footer may also reflect low-relevance / near-duplicate
   chunks the search returned — a retrieval-ranking concern, not a citation-render one. Worth a glance but out
   of this seed's scope.

## Re-open triggers

- Operator or a user again reports "the footer has sources that aren't in the text" / "the numbers don't line
  up", OR
- `/gsd:sketch` or `/gsd:discuss-phase` on any citation / CitationList / References-footer surface — surface
  this seed as the first design question, OR
- v3.4 milestone sweep — decide whether cited-vs-retrieved legibility is in-scope, OR
- SEED-118 (weak-model harness) ships and changes attribution density — re-evaluate whether the gap still
  reads as broken.

## Evidence

- psycopg2 :54322 table above (2026-07-15) — footer `source_refs` count vs distinct persisted `[n]` markers,
  0 out-of-range across all threads.
- Decisions D-04 / D-06 / D-07 in `.planning/phases/153-inline-citations/` (CONTEXT.md / UI-SPEC / RESEARCH).
- Frontend: `frontend/src/components/chat/CitationList.tsx`, `CitationCard.tsx` (the footer surface to change).
- Related: SEED-118 (weak models under-attribute → widen this gap).

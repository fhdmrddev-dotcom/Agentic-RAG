---
seed_id: SEED-206
title: "A step that calls Slack wears SLACK'S mark — on the SPINE and the run surfaces too, not only the canvas. And 'any official application logo' has a measured hole: the operator's own example, ClickUp, is absent from the installed collection."
created: 2026-08-26
planted_during: conversation with the operator, 2026-08-26, while Gemini executed Phase 209
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - Phase 209 — "a step says what it actually does". Ships the CANVAS mark. This seed is every OTHER step surface.
  - SEED-205 — the connection journey, generic across any supported service
  - SEED-204 — the three paths in; a catalog implies arbitrary marks
  - SEED-199 — the xyOps canvas grammar; connectors as glyph nodes
  - references/icon-convention.md §1 §3 — one source, byte-identical everywhere; the blank-slug trap
  - frontend/src/components/settings/connectionMark.tsx — the ONE shared map
  - .planning/sketches/200-journey-interactive/screens/node-identity.html — already draws the contract
trigger_when: >
  The moment ANY step surface other than the builder canvas renders an external step — or when the
  Connections milestone adds a service beyond the three currently mapped. Whichever comes first.
  ⚠ Do NOT wait for a catalog: the spine gap is live TODAY on shipped surfaces.
---

# SEED-206 — the service mark belongs on every step surface

## Recorded verbatim, 2026-08-26

> *"The icons for the external should even appear in the workflow — either the spine or the canvas.
> So for example if the AI decides to call Slack then the logo should be Slack. If it decides to
> call other application then the logo should be the official application logo."*

## ⚠ THE SKETCH ALREADY SAID THIS, AND IT WAS BUILT ON ONE SURFACE OUT OF FIVE

`screens/node-identity.html` states the contract in its own words, beneath the node grid:

> *"A step that touches another application wears that application's own mark. Everything else
> wears ours."*

**It does not say "on the canvas."** Phase 209 is delivering it for the builder canvas
(`nodePresentation.ts` → `ConnectionMarkGlyph size="canvas"`, reusing the ONE map — correctly). Every
other surface still renders the PHASE-TYPE glyph and no service mark at all. Measured at HEAD:

| Surface | phase-type glyph | service mark |
|---|---|---|
| `components/workflows/PhaseSpineGraph.tsx` — the read-only builder spine | 5 refs | **0** |
| `components/panel/PhaseCard.tsx` — the run-time panel spine | 4 refs | **0** |
| `components/panel/PhaseTimeline.tsx` | 0 | **0** |
| `components/workflows/RunSpine.tsx` | 0 | **0** |
| `components/workflows/RunStepList.tsx` | 0 | **0** |

⭐ **A bridge already exists and is the cheap seam:** `components/panel/phaseStatusMeta.ts` is
ALREADY a consumer of `nodePresentation.ts`. The panel surfaces can reach the resolver without a new
dependency edge — this is a wiring job, not an architecture job.

## ⚠ "ANY OFFICIAL APPLICATION LOGO" HAS A MEASURED HOLE, AND IT IS THE OPERATOR'S OWN EXAMPLE

`@iconify-json/logos@1.2.13` is installed locally: **2110 icons**. Probed 2026-08-26:

```
slack-icon PRESENT · jira PRESENT · xero PRESENT · notion PRESENT
asana PRESENT · hubspot PRESENT · salesforce PRESENT · zendesk PRESENT
clickup —  ABSENT        clickup-icon —  ABSENT
```

**ClickUp — named twice by the operator as the example — has no mark in the collection.** So the
fallback is not a theoretical edge: it is hit by the first service anyone asked for. The icon
convention forbids drawing or approximating a trademark, so the answer is the NAMED neutral
(`connectionMark.tsx`'s `Plug`), never a hand-drawn ClickUp logo and never a lookalike.

## The resolution problem this creates — stated, not solved

`connectionMark.tsx` resolves marks by **build-time bundled import** (`~icons/logos/slack-icon`).
That is deliberate and load-bearing: a missing slug is a **transform-time HARD ERROR**, which is the
whole verify-or-bundle discipline, and it is why the module can promise every slug resolves.

⚠ **But a build-time import cannot be dynamic**, so today's design requires knowing every service in
advance — exactly what SEED-205's "generic, any supported connection" forbids. The three candidate
answers, with the trade already measured:

| Approach | Miss behaviour | Verdict |
|---|---|---|
| Bundled imports, hand-listed (today) | hard build error | safe, does not scale past a hand-list |
| **A GENERATED static map over the installed 2110** | still build-time; miss ⇒ named neutral | ⭐ the likely answer — dynamic in effect, no network, keeps the fence |
| Runtime Iconify API (`<Icon icon=…/>`) | **renders EMPTY, silently** | ⛔ reject — icon-convention §3's measured trap, plus a network dependency |

And the unanswered half: **how a connection's service NAME becomes a slug.** "ClickUp" → `clickup`
is a guess; `logos` carries 9 aliases that are typo-redirects for unrelated names, so a normalise-
and-hope lookup can resolve to the WRONG VENDOR'S MARK. That failure is worse than a neutral one,
and it is the `destinationFactsOf` defect again — a positional resemblance standing in for a fact.

## Scope note

This is NOT Phase 209. 209's SC#4 is satisfied by the canvas reusing the one map, and widening it
mid-flight would be scope creep on a phase already executing. This seed is the follow-on: **one
resolver, every step surface, and an honest answer for the 2110th service.**

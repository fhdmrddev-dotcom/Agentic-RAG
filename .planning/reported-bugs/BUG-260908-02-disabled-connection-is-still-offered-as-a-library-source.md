---
id: BUG-260908-02
title: A DISABLED connection is still offered in the Library's "From a connected source" picker — the disabled state is enforced on the Connections page and not on the surface that starts an ingest
reported: 2026-09-08
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/library, frontend/ingestion, ConnectedSourceSection, CreateWatchModal, connections, sources, UX/honesty]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 5356bcaf3
  date: 2026-09-08
---

# BUG-260908-02: a disabled connection is still offered as a Library source

## What we observed

Observed during the Phase 239 G-4 UAT, driven in Chrome against the local app.

At the time of observation the **Microsoft 365** connection was `⏻ Disabled` — read verbatim from
Settings → Connections, where the State column showed:

```
Microsoft 365
OneDrive, SharePoint, and Graph via OAuth.
OAuth connected
⏻ Disabled
```

With that connection in that state, **Library → Ingestion → "From a connected source" listed it as a
choice**, verbatim:

```
From a connected source
Choose a connection…
Google Workspace
Microsoft 365
```

So the surface that **starts an ingest** offered a connection the Connections page had already
declared unusable.

⚠ **HONEST LIMIT ON THIS REPORT — the state has since changed and the observation cannot currently be
re-run.** The operator enabled Microsoft 365 immediately afterwards (it now reads `✓ Ready as source`),
and it is the only connection that was in a disabled state. **The observation above is recorded
verbatim from the moment it was seen; it has NOT been re-verified since.** Reproducing it needs a
connection deliberately disabled — see below.

## Repro (needs one deliberately disabled connection)

1. Settings → Connections → pick any connected, source-capable connection → **Disable**.
2. Confirm the row's State column reads `⏻ Disabled`.
3. Library → Ingestion → open **"From a connected source"**.
4. **Expected:** the disabled connection is absent, or present and visibly unselectable with a reason.
   **Actual (observed 2026-09-08):** it is listed as an ordinary choice.

⚠ Not driven past step 4 — selecting a source begins a watch-creation flow that writes, and the UAT
was read-only by instruction. **Whether the ingest would actually succeed, fail loudly, or fail
silently is UNKNOWN and is the first thing to establish.** That unknown is what separates "a cosmetic
listing bug" from "a disabled connection can still read your files", and they are very different
severities.

## Why it matters

**Disable is a control a person uses to stop something.** A surface that still offers the connection
undermines the only mechanism the product gives them for that. Whichever way step 4 resolves, one of
two bad outcomes follows: either the disable is not enforced at the ingest path, or it is enforced
somewhere deeper and the person gets an inexplicable failure after choosing a thing they were offered.

This is the **same shape as `HI-01`** from the Phase 239 code review — a surface offering a source it
cannot honestly promise — but it is **not the same defect**. HI-01 was a family-list short-circuit in
`sourceCapability.ts` (fixed in `239-05`); this is a missing **status** gate on a different surface.
HI-01's fix is verified working on the *Connections* page and in this same picker for MCP rows, which
is exactly why this one stands out as separate.

## Hypothesized cause

**Hypothesis, not finding.** The picker filters on source *capability* and never consults connection
*status*. The Connections row verdict does consult status — `TM-239-07` requires a row not claim
readiness when revoked / error / disabled, and it demonstrably honours that — so the two surfaces
disagree about the same connection.

⚠ **Why nothing caught it:** the Phase 239 frontend round reported, verbatim, that
**`CreateWatchModal` and `ConnectedSourceSection` have no test suite at all.** That is also why the
HI-01 half living on this surface could not have been caught by tests. **A surface with no suite
cannot regress, because it was never held.**

## Surface classification

`Agentic-RAG` — this app's own Library ingestion surface. A routing candidate at the GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** **n/a, deliberately.** Phase 239 is in gap-closure round 1. Adding a
  status gate plus the first-ever test harness for two components is not a gap, and **G-7** forbids a
  closure round taking on new surface.
- **Defer to future phase / milestone:** a Library / watched-sources phase. It should carry the
  **test harness for `ConnectedSourceSection` and `CreateWatchModal`** as a first-class deliverable,
  not as a side effect — the absence of any suite is the reason two separate defects reached this
  surface unseen.
- **Plant as seed:** n/a — observed defect with a concrete repro, not a deferred idea.

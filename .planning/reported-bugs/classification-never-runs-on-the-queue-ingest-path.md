---
id: BUG-260906-01
title: Classification rules never run on the queue ingest path, so no synced or watched file can ever be filed
reported: 2026-09-06
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/ingestion, classification, connectors/watches]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-252]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: da34aa8f7
  date: 2026-09-06
---

# BUG-260906-01: Classification rules never run on the queue ingest path

## What we observed

A file arriving through a **connector watch** (Phase 234) is minted, chunked, embedded and marked
`completed` — and carries **`metadata._classification = None`** regardless of whether a
classification rule matches it.

Measured on the operator's live database, 2026-09-06:

```
docs ingested by the watch (1):
  Dubai DoF_Document Management and Archival System Proje… | folder=None | _classification=None
classification_rules rows: 1
```

**Where the rule evaluation actually lives** — `backend/app/api/documents.py:2385-2396`, inside
`ingest_document` (`documents.py:2058`), which is the **legacy synchronous upload path**:

```python
for rule in rules:  # first-match-wins (D-118-3): ONE object, never an array
    if classification_matcher.match_metadata(rule["match_expr"], metadata_dict, whitelist):
        metadata_dict["_classification"] = classification_matcher.build_suggestion(...)
        break
```

**Where it does not live** — the durable queue path (Phase 230), which is the path every watched
file takes:

```
grep -n "classification" app/services/ingest_enrich.py app/services/ingestion_queue_service.py
  app/services/ingest_enrich.py:376:  # ⚠ UNDERSCORE KEYS ARE EXCLUDED. `_vision`, `_classification`, …
```

One comment. **Nothing executable.**

## Why it matters

Automated folder watching is the differentiator of milestone v4.0. Classification is the mechanism
that decides where an arriving document belongs. **The two features cannot currently interact at
all**: a document that arrives by itself is exactly the document a person is least able to file by
hand, and it is the only kind of document the filing engine never sees.

It also silently degrades the *manual* story. A user who writes a rule, tests it with a drag-and-drop
upload (works), then points a watch at a folder (silently never fires) has been given a feature that
works only on the path they were trying to stop using.

⚠ **This is the FIFTH instance of one shape.** All four defects repaired on 2026-09-05
(`BUG-260905-06/07/08/12`) were *two code paths serving one user-visible outcome, and only one of
them doing the work*. `backend/app/services/ingest_enrich.py` was created that day precisely to be
the single home for the post-extraction enrichment step. **Classification was never moved into it**,
so the split it was built to close is still open one step further down.

## Hypothesized cause

Not a hypothesis — **located**. Phase 230 introduced the durable queue with its own chunk/embed loop
and did not carry the metadata step across; that was `BUG-260905-06`, fixed by extracting
`ingest_enrich.py` and calling it from both paths. The classification block sits ~330 lines *after*
the metadata block in `ingest_document` and was not part of that extraction, so it stayed behind on
the legacy path only.

## Surface classification

`Agentic-RAG` — this app, backend ingestion. Routes normally.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 234 is closing; folding this in would be a G-7
  closure round adding capability.
- **Defer to future phase / milestone:** fix **before** Phase 235. 235's SC#1 is a per-source run
  history reporting what each sync *did*; a history that cannot report "filed into X" because filing
  never ran would be built around the hole.
- **Plant as seed:** `SEED-252` covers the *design* half (many rules contributing, and actually
  moving the file). This bug is the *plumbing* half and is true regardless of how that seed is
  decided.
- **External — note only:** no

## The fix shape

Move the rule-evaluation block out of `ingest_document` into `ingest_enrich.py` beside the metadata
step, and call it from both paths — the same extraction that closed `BUG-260905-06`.

⚠ **The test that must come with it is an AGREEMENT test, not a per-path test.**
`backend/tests/unit/test_ingest_enrich_shared.py` already exists for exactly this and is the
established home: assert that an identical document through the legacy path and through the queue
path produces the **same** `_classification`. Five bugs of this shape have now been shipped past
suites where *both paths had tests and none asserted they agree*.

## Workarounds

None on the synced path. A watched file can be filed only by hand, from the Library, after it
arrives — and nothing tells the person a rule would have matched it.

## Reference / evidence links

- `backend/app/api/documents.py:2385-2396` — the rule loop, on the legacy path
- `backend/app/services/ingest_enrich.py` — the single home it belongs in (created `876c049be`)
- `backend/tests/unit/test_ingest_enrich_shared.py` — the agreement test to extend
- `.planning/phases/234-the-watch-loop-the-library-reads-by-itself/234-VERIFICATION.md` §finding 1
- Prior instances: `BUG-260905-06`, `-07`, `-08`, `-12`

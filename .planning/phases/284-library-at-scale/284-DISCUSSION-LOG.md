# Phase 284: Library at Scale - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-16
**Phase:** 284-library-at-scale
**Mode:** `--auto` — every area auto-selected, recommended option chosen, no questions asked.
**Areas discussed:** List response shape, Visible-set union, Aggregates home, Picker search, Per-document lists, Measurement account, Guard design, Sketch (G-2), G-4 scenarios

---

## List response shape (`GET /documents`)

| Option | Description | Selected |
|--------|-------------|----------|
| Envelope `{documents,total,offset,limit}` | Same shape as Find; loud breaking change, documented | ✓ |
| Keep array + `X-Total-Count` header | Back-compat, but an API consumer silently gets one page | |
| New path `/documents/page`, old path untouched | Leaves the unbounded route alive — fails SC#6 | |

[auto] Q: "What does the paged list return?" → Selected: envelope (recommended). Public OpenAPI, API reference and changelog change in the same commit.

## Visible-set union (own ∪ global folders)

| Option | Description | Selected |
|--------|-------------|----------|
| Express in SQL, reuse `folder_is_globally_visible` | No id list on the URL; one home for the predicate | ✓ |
| `or=` with the folder-id list | Bounded by folders, but still a growing list on the URL | |
| Widen to every RLS-visible row | Changes what the Library shows — rejected | |

## Aggregates home

| Option | Description | Selected |
|--------|-------------|----------|
| One `summary` read, GROUP BY in SQL | One request, bounded by folders/statuses | ✓ |
| Count endpoints per widget | Many round-trips; numbers can disagree | |

## Picker search

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `POST /document-search` (limit 20, debounced) | No new endpoint; one search home | ✓ |
| New lightweight `/documents/lookup` | A second search path | |

## Per-document lists (chunks / tables / images / versions)

| Option | Description | Selected |
|--------|-------------|----------|
| Page them, exact total, chunks load on scroll-to-end | Honours 283's "no Show all button" | ✓ |
| Leave them (out of scope) | SC#6's guard would fail on them | |

## Measurement account

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated synthetic local account + teardown | Operator's dev Library untouched | ✓ |
| Seed into the operator's dev account | Would bury 286 real docs under 50k rows | |

## Guard design (SC#6)

| Option | Description | Selected |
|--------|-------------|----------|
| Static route inventory + runtime request recording + FE fence | Catches new routes and re-planted loops | ✓ |
| Static grep only | Cannot see a growing list at runtime | |

## Sketch (G-2)

| Option | Description | Selected |
|--------|-------------|----------|
| Skip, recorded as a decision | Layouts are shipped; only loading/failed states are new and reuse shipped treatments | ✓ |
| Run `/gsd:sketch` | No open layout decision to settle | |

## G-4 scenarios

[auto] Defined A-E in CONTEXT D-27 (open Library, last page of a 10k folder, picker by name, upload on page 1, operator account regression). The operator may amend before the drive.

---

## Claude's Discretion

Endpoint / function names, summary field names, per-document page defaults, `or=` vs SQL function for the union, index choice by EXPLAIN, the wave-2 plan cut.

## Deferred Ideas

SEED-352 (bulk actions etc. — new capability), SEED-317 (org handle), SEED-248 thread half, list virtualisation. Todo `spike-nl-workflow-authoring.md` reviewed, not folded (keyword noise).

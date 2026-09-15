---
seed_id: SEED-259
title: "id SEED-259 was claimed by TWO seeds — this is the disambiguation, not a seed"
status: superseded-id
surface: Agentic-RAG
created: 2026-09-16
trigger_when: unset
renumbered_from: SEED-259
renumbered_because: >
  Phase 251 (REG-01) resolved this id under D-07 as amended by D-20 — the OLDEST seed keeps the id, by its
  `created`-else-`planted` date. `SEED-259-tool-names-are-rows-but-argument-shapes-are-not.md` kept SEED-259;
  `SEED-283-assistant-narration-repeats-verbatim-across-tool-turns.md` moved to SEED-283. This file is the redirect stub
  left behind so that references written before the resolution still land somewhere that says which of the two
  was meant. ⛔ It is NOT a seed and carries no finding of its own.
---

# SEED-259: this id named TWO different seeds — read this before following the citation

## What happened

Two unrelated seeds each claimed `SEED-259`. Nobody was careless: the register had no written contract and
`/gsd:capture`'s allocator derived the next id from a FILE COUNT rather than from `max(id) + 1`, so two authors
could read the same listing and write the same number. **Phase 251 resolved all eight such collisions at once.**

## The two resolutions

⭐ **KEPT `SEED-259`** — `.planning/seeds/SEED-259-tool-names-are-rows-but-argument-shapes-are-not.md`

> Tool NAMES are rows but tool ARGUMENT SHAPES are not — an MCP server whose reader needs three arguments returns an empty listing with HTTP 200. (`status: answered`.)

➡ **MOVED to `SEED-283`** — `.planning/seeds/SEED-283-assistant-narration-repeats-verbatim-across-tool-turns.md`

> A model's inter-tool narration repeated VERBATIM across turns — observed during BUG-260912-01, never diagnosed, and now hidden by the reasoning fold rather than explained.

## Which one does your citation mean?

A citation about MCP tools, argument mapping or connector tool listings means the KEEPER; one about repeated assistant narration or the reasoning fold means `SEED-283`.

## ⛔ If you got here from source code

⭐ **This is the harmless one of the eight, and it is worth saying so rather than leaving a reader to check.**
Every product-source reference to `SEED-259` means the seed that KEPT the id — including the ~11 in
`backend/app/services/sources/adapters/mcp_source.py`, the ~8 in `frontend/src/components/settings/connectionFormCopy.ts`, and
the test FILENAME `backend/tests/unit/services/sources/test_259_argument_shapes_are_rows_too.py`, which encodes the id in its
own name. **All of them stay correct with no edit**, because the date rule happened to keep the id on the side the code meant.

## How it was decided

`created: 2026-09-08` (argument shapes) against `created: 2026-09-13` (narration) — five days apart, no tie-break needed.

⛔ **The side that moved was NOT chosen by reference weight.** D-07 rejects "most-referenced keeps it" by name:
it optimises one outcome over the principle, it can hand an id to a seed that never owned it, and it leaves no
precedent for the ninth collision. The date rule needs no judgement and reproduces on a re-run.

## Why this file exists at all

⛔ **The archives are NOT rewritten (D-06).** 403 of the ~559 references to these eight ids sit inside sealed
`.planning/milestones/`, and they are historical records of what was said at the time — editing them would edit
history. **This stub is what keeps every one of them followable.** It is also what carries the product-source
references that D-17 deliberately left unedited.

⚠ `status: superseded-id` is a real member of the register's ten-value enum and the gate treats a group with
**exactly one** such member as a RESOLUTION rather than a duplicate. Two stubs on one id, or a stub whose status
drifts off this value, both make the id read as a live collision again — driven against planted defects at this
phase, not assumed.

## Breadcrumbs

- `.planning/phases/251-register-integrity/251-RENUMBER-LEDGER.md` — all eight verdicts with both dates, the
  supplying key, the two git tie-breaks, and the list of files deliberately left pointing at a stub.
- `.planning/phases/251-register-integrity/251-CONTEXT.md` — D-05, D-06, D-07, D-17 and D-20 verbatim.
- `scripts/check-seeds-register.cjs` — the gate whose `[duplicate-id]` arm made this resolution provable.

---
seed_id: SEED-022
title: "id SEED-022 was claimed by TWO seeds — this is the disambiguation, not a seed"
status: superseded-id
surface: Agentic-RAG
created: 2026-09-16
trigger_when: unset
renumbered_from: SEED-022
renumbered_because: >
  Phase 251 (REG-01) resolved this id under D-07 as amended by D-20 — the OLDEST seed keeps the id, by its
  `created`-else-`planted` date. `SEED-022-camelot-pdf-table-precision-audit.md` kept SEED-022;
  `SEED-277-timeout-settings-ui.md` moved to SEED-277. This file is the redirect stub
  left behind so that references written before the resolution still land somewhere that says which of the two
  was meant. ⛔ It is NOT a seed and carries no finding of its own.
---

# SEED-022: this id named TWO different seeds — read this before following the citation

## What happened

Two unrelated seeds each claimed `SEED-022`. Nobody was careless: the register had no written contract and
`/gsd:capture`'s allocator derived the next id from a FILE COUNT rather than from `max(id) + 1`, so two authors
could read the same listing and write the same number. **Phase 251 resolved all eight such collisions at once.**

## The two resolutions

⭐ **KEPT `SEED-022`** — `.planning/seeds/SEED-022-camelot-pdf-table-precision-audit.md`

> Camelot's PDF table extractor overcounts tables on academic PDFs — a false-positive precision audit.

➡ **MOVED to `SEED-277`** — `.planning/seeds/SEED-277-timeout-settings-ui.md`

> A Settings UI for per-LLM-call / consumer timeouts with tier presets, so tuning them does not mean editing `backend/.env` and restarting uvicorn.

## Which one does your citation mean?

Both are quiet seeds with no product-code references. A citation arriving from an ingestion or PDF-extraction context means the KEEPER; one arriving from a settings, timeout or `.env` context means `SEED-277`.

## How it was decided

`planted: 2026-05-16` (Camelot) against `planted: 2026-05-25` (timeouts) — nine days apart, no tie-break needed.

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

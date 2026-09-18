---
seed_id: SEED-229
title: "id SEED-229 was claimed by TWO seeds — this is the disambiguation, not a seed"
status: superseded-id
surface: Agentic-RAG
created: 2026-09-16
trigger_when: unset
renumbered_from: SEED-229
renumbered_because: >
  Phase 251 (REG-01) resolved this id under D-07 as amended by D-20 — the OLDEST seed keeps the id, by its
  `created`-else-`planted` date. `SEED-229-does-the-golden-run-hang-on-an-armed-approval-checkpoint.md` kept SEED-229;
  `SEED-280-five-suites-in-neither-count-gate-knob.md` moved to SEED-280. This file is the redirect stub
  left behind so that references written before the resolution still land somewhere that says which of the two
  was meant. ⛔ It is NOT a seed and carries no finding of its own.
---

# SEED-229: this id named TWO different seeds — read this before following the citation

## What happened

Two unrelated seeds each claimed `SEED-229`. Nobody was careless: the register had no written contract and
`/gsd:capture`'s allocator derived the next id from a FILE COUNT rather than from `max(id) + 1`, so two authors
could read the same listing and write the same number. **Phase 251 resolved all eight such collisions at once.**

## The two resolutions

⭐ **KEPT `SEED-229`** — `.planning/seeds/SEED-229-does-the-golden-run-hang-on-an-armed-approval-checkpoint.md`

> Does the golden run hang on an armed approval checkpoint? Two pause kinds are handled and a third is unaccounted for.

➡ **MOVED to `SEED-280`** — `.planning/seeds/SEED-280-five-suites-in-neither-count-gate-knob.md`

> Five frontend suites are RUN by the count gate and GUARDED by nothing — they sit in the TARGETS knob but not in BASELINE.

## Which one does your citation mean?

A citation about harness runs, approval checkpoints or pause handling means the KEEPER; one about the vitest count gate, its two knobs, or an unguarded suite means `SEED-280`.

## ⛔ If you got here from source code

⛔ **If you arrived here from a comment in `scripts/vitest-count-gate.cjs`, you want `SEED-280-five-suites-in-neither-count-gate-knob.md`.**
All three references in that file (around lines 2917, 3100 and 4937) mean the seed that MOVED, not the one that kept this id.

They were deliberately left pointing here under **D-17**: the phase that renumbered these seeds touched no file under `scripts/`,
`backend/` or `frontend/`, because every such reference is a comment or a test docstring and not one is an executing identifier.

⚠ This extends D-17's class beyond the single id (`SEED-253`) that the decision names. It was found at PLANNING, not at
discuss-phase, which is why the decision text itself does not mention it.

## How it was decided

`planted: 2026-08-28` (golden run) against `planted: 2026-08-31` (five suites) — three days apart, no tie-break needed.

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

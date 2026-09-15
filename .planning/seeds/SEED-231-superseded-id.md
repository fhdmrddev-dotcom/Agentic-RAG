---
seed_id: SEED-231
title: "id SEED-231 was claimed by TWO seeds — this is the disambiguation, not a seed"
status: superseded-id
surface: Agentic-RAG
created: 2026-09-16
trigger_when: unset
renumbered_from: SEED-231
renumbered_because: >
  Phase 251 (REG-01) resolved this id under D-07 as amended by D-20 — the OLDEST seed keeps the id, by its
  `created`-else-`planted` date. `SEED-231-decision-coverage-gate-is-blind-to-this-repo-decision-ids.md` kept SEED-231;
  `SEED-281-nobody-is-told-an-approval-is-waiting.md` moved to SEED-281. This file is the redirect stub
  left behind so that references written before the resolution still land somewhere that says which of the two
  was meant. ⛔ It is NOT a seed and carries no finding of its own.
---

# SEED-231: this id named TWO different seeds — read this before following the citation

## What happened

Two unrelated seeds each claimed `SEED-231`. Nobody was careless: the register had no written contract and
`/gsd:capture`'s allocator derived the next id from a FILE COUNT rather than from `max(id) + 1`, so two authors
could read the same listing and write the same number. **Phase 251 resolved all eight such collisions at once.**

## The two resolutions

⭐ **KEPT `SEED-231`** — `.planning/seeds/SEED-231-decision-coverage-gate-is-blind-to-this-repo-decision-ids.md`

> The BLOCKING decision-coverage gate is structurally blind to every decision id this repo has ever written.

➡ **MOVED to `SEED-281`** — `.planning/seeds/SEED-281-nobody-is-told-an-approval-is-waiting.md`

> Nobody is told an approval is waiting — an unattended run pauses for a person who is never notified. ⭐ It is also the standing COLLECTION POINT for every future "the user should be told X" need.

## Which one does your citation mean?

A citation about the decision-coverage gate, `D-NN` parsing or a phase's DECISIONS.md means the KEEPER; one about notifications, an unattended pause, or the nav attention badge means `SEED-281`.

## ⛔ If you got here from source code

⛔ **If you arrived here from `frontend/src/components/layout/attentionConditions.ts`, you want
`SEED-281-nobody-is-told-an-approval-is-waiting.md`.** All three references in that file (around lines 11, 104 and 145) name the
seed that MOVED, by its own title — and that file's `ATTENTION_PRODUCERS` array is the registration seam that seed describes.

They were deliberately left pointing here under **D-17**: the phase that renumbered these seeds touched no file under
`frontend/`, `backend/` or `scripts/`.

⚠ This extends D-17's class beyond the single id (`SEED-253`) that the decision names. It was found at PLANNING, not at
discuss-phase.

## How it was decided

Both read `planted: 2026-08-29`, so this is one of the two pairs that TIED on the date. D-20's tie-break was consulted and PRINTED rather than applied silently: `git log --diff-filter=A --format=%ad --date=iso` gives **2026-08-29 04:00:08 +0400** for the decision-coverage seed and **2026-08-29 05:03:04 +0400** for the notification seed — **62m 56s** apart. The older add-commit keeps the id. (⛔ `--date=short` cannot separate them; that is why the tie-break is specified at ISO resolution.)

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

---
seed_id: SEED-253
title: "id SEED-253 was claimed by TWO seeds — this is the disambiguation, not a seed"
status: superseded-id
surface: Agentic-RAG
created: 2026-09-16
trigger_when: unset
renumbered_from: SEED-253
renumbered_because: >
  Phase 251 (REG-01) resolved this id under D-07 as amended by D-20 — the OLDEST seed keeps the id, by its
  `created`-else-`planted` date. `SEED-253-mobile-has-no-drawer-trigger-outside-the-chat-view.md` kept SEED-253;
  `SEED-282-source-file-path-is-synthetic-no-adapter-populates-it.md` moved to SEED-282. This file is the redirect stub
  left behind so that references written before the resolution still land somewhere that says which of the two
  was meant. ⛔ It is NOT a seed and carries no finding of its own.
---

# SEED-253: this id named TWO different seeds — read this before following the citation

## What happened

Two unrelated seeds each claimed `SEED-253`. Nobody was careless: the register had no written contract and
`/gsd:capture`'s allocator derived the next id from a FILE COUNT rather than from `max(id) + 1`, so two authors
could read the same listing and write the same number. **Phase 251 resolved all eight such collisions at once.**

## The two resolutions

⭐ **KEPT `SEED-253`** — `.planning/seeds/SEED-253-mobile-has-no-drawer-trigger-outside-the-chat-view.md`

> At mobile width there is no way to open the nav drawer from any view except chat — `onOpenDrawer` is threaded ONLY to `ChatArea`.

➡ **MOVED to `SEED-282`** — `.planning/seeds/SEED-282-source-file-path-is-synthetic-no-adapter-populates-it.md`

> A watch rule can filter on `path`, but no adapter populates it — production substitutes `/<filename>`, so folder-shaped path rules silently never match. Folded for Microsoft Graph at Phase 238; **still open for Google Drive**.

## Which one does your citation mean?

A citation about mobile layout, the nav drawer or `onOpenDrawer` means the KEEPER. **Anything else almost certainly means `SEED-282`** — this is the heaviest of the eight ids at ~53 referencing files, and essentially every live reference outside the sealed archives means the seed that MOVED.

## ⛔ If you got here from source code

⛔ **If you arrived here from backend source or a backend test, you want
`SEED-282-source-file-path-is-synthetic-no-adapter-populates-it.md`.** Every one of the 25+ references in the source adapters
and their tests — `backend/app/services/sources/adapters/microsoft_graph.py`, `mcp_source.py`, `mock_source.py`,
`backend/app/services/sources/base.py`, `preview_service.py`, `watch_service.py`, `import_service.py`, `ingest_enrich.py`,
`mailbox.py`, and five `backend/tests/unit/services/sources/test_*.py` files — concerns the SYNTHETIC SOURCE PATH, which is the
seed that moved. **Not one of them means the mobile nav drawer.**

They were deliberately left pointing here under **D-17**: the phase that renumbered these seeds touched no file under
`backend/`, `frontend/` or `scripts/`, because all 84 such references are comments or test docstrings and **not one is an
executing identifier**. Correcting them would have put product files in the blast radius of a planning-register phase for zero
executable change.

⚠ **This is also the one pair where the date rule hands the id to the markedly LESS-referenced seed**, and that was recorded as
an observation rather than acted on: D-07 rejects "most-referenced keeps it" **by name**, because optimising one outcome leaves
no precedent for the ninth collision.

## How it was decided

Both read `created: 2026-09-06`, so this is the second of the two pairs that TIED on the date. D-20's tie-break was consulted and PRINTED: `git log --diff-filter=A --format=%ad --date=iso` gives **2026-09-06 08:36:22 +0400** for the mobile-drawer seed and **2026-09-06 22:00:28 +0400** for the source-path seed — **13h 24m 06s** apart. The older add-commit keeps the id.

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

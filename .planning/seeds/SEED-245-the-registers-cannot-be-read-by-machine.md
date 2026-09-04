---
seed_id: SEED-245
title: "The two registers cannot be read by machine — 28 different `status:` spellings, 14 files a strict grep silently skips, and no CATEGORY field at all"
created: 2026-09-04
planted_during: "v3.9 close intake — operator asked how to categorise bugs/seeds for the next roadmap without mixing in the closed ones"
status: planted
surface: Agentic-RAG
severity: major
category: process / planning-infrastructure
priority: high
relates_to:
  - .planning/seeds/            # 246 files
  - .planning/reported-bugs/    # 158 files
  - CLAUDE.md                   # the two MANDATORY cross-check sections that scan these registers
  - scripts/                    # no register linter exists
trigger_when: >
  Fires NOW — at the next `/gsd:new-milestone`, which is the exact touchpoint CLAUDE.md tells the
  orchestrator to sweep both registers. The sweep it prescribes cannot currently be run correctly.
---

## What the operator asked

> *"for the next milestones … we have bugs, we have seeds, we have something related to features,
> something related to new functionality, something related to enhancement, something related to
> the UI itself. We should analyse all of those to see how we will build the roadmap … we should
> categorise them to see if we did not miss anything. Also the closed bugs or the closed seeds —
> I don't know how we will handle them so we will not mix with them if it is already done."*

That is a reasonable ask that **cannot be satisfied today**, and the reason is mechanical.

## Measured 2026-09-04, at `e09663a5a`

| | |
|---|---|
| Seed files | **246** |
| Bug files | **158** |
| Distinct `status:` spellings across the seeds | **~28** |
| Files whose `status:` line carries a trailing `#` comment | **14** (9 bugs, 5 seeds) |

⚠ **The `status:` values are not a vocabulary, they are prose.** Among the seed statuses actually
present: `planted` (140), `open` (40), `closed` (13), `dormant` (9), `partially-folded` (7),
`folded` (4), `answered` (3), `shipped` (3), `promoted` (2), `partially-shipped` (2), plus singletons
including `partial-consumed`, `partially-resolved`, `shipped-in-part`, `routed`, `queued`,
`scheduled`, `active`, `done`, `resolved`, `fixed`, `fixed_local_only`, **five files with no
`status:` at all**, and two whose status field is an entire sentence:

> `status: DONE ✅ — backend implemented + unit-tested + LIVE-VERIFIED 2026-06-07`

⚠ **AND THE COMMENTS ARE THE DANGEROUS PART.** Fourteen files write things like
`status: open   # PARTIALLY CLOSED -- the RUN-SURFACE half shipped in Phase 195` or
`status: folded   # ⚠ RE-OPENED 2026-08-16`. A strict `grep "^status: open$"` — the obvious way to
run CLAUDE.md's own MANDATORY sweep — **silently skips every one of them**. They are not
mis-triaged; they are *invisible*, which is worse, because an absent row reads as "nothing to do".

⭐ **CLAUDE.md already records this exact failure mode one register over**: *"`status:` frontmatter
IS the index — prose inside the body saying 'still open' is invisible to the scan."* The lesson was
written down and the field then fragmented anyway. That is what makes this a defect in the
PROCESS rather than in anyone's discipline.

## The second half: there is no category field

Nothing in either register says whether an item is a **bug**, an **enhancement**, **new
functionality**, **UI/UX**, **security**, **infrastructure** or **process**. The operator's question
— *"categorise them so we can see what we missed"* — currently requires reading 404 files.

`category:` exists on SOME newer seeds (this one has it) and on none of the old ones.

## What to build when this is planned

1. **A closed vocabulary for `status:`**, and nothing else accepted. Proposed minimum:
   `open` · `planted` · `folded` (with `folded_into`) · `deferred` (with `re_open_trigger`) ·
   `closed` (with `verified_closed_by`) · `external-noted`. **Partial states go in a separate
   `partial:` field or in the body — never inside `status:`**, because that is what produced the
   fourteen invisible files.
2. **A `category:` field on every file**, backfilled. The operator's own list is a good starting
   taxonomy: *defect · enhancement · new-capability · UI/UX · security · infrastructure · process*.
3. **A linter — `scripts/check-registers.cjs`** — that fails on an unknown status, a `#` comment
   inside a status value, a missing `category:`, a `folded` without `folded_into`, a `deferred`
   without `re_open_trigger`, and a `closed` without `verified_closed_by`. ⚠ It must run in a
   PostToolUse hook the way the CLAUDE.md size gate does, so it fires in the turn the file is
   written — a CI-only check would not have caught eight days of drift here either.
4. **A generated view** — `/gsd:new-milestone` reads the registers and prints candidates grouped by
   category with the closed ones excluded by construction, instead of asking a human to skim 404 files.

## How we would know it worked

`/gsd:new-milestone` can list every open candidate, grouped, in one command — and the count it
prints can be reconciled against the file count with no residual. Today it cannot, and the
difference is 14 files nobody would know were missing.

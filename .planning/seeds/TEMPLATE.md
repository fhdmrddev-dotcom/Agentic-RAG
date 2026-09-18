---
seed_id: SEED-NNN                 # ⚠ MUST match the filename. The filename is what a reference resolves against.
title: One-line summary           # what this seed IS — a sweep can print an id without it, and say nothing
created: YYYY-MM-DD               # absolute date, never relative. `planted:` is the legacy spelling; D-20 reads `created` FIRST, then falls back
surface: Agentic-RAG              # Agentic-RAG | Claude.ai | Anthropic-API | OpenAI | OpenRouter | Other
status: planted                   # planted | dormant | open | partially-answered | answered | folded | shipped | closed | deferred | superseded-id
partial: false                    # true when the status is settled on ONE AXIS ONLY (e.g. folded for Graph, still open for Drive)
status_note:                      # required when the status line carried prose — the displaced bytes live here, verbatim
trigger_when: unset               # PROSE, for a human. `unset` when there is none — visible as unswept, never silently absent
trigger_paths: []                 # globs matched against a phase's `files_modified` with `path.matchesGlob`, e.g. ["backend/app/config.py", "frontend/src/components/chat/**", "**/agent_loop.py"]
trigger_surfaces: []              # controlled enum, see the vocabulary below. ⛔ NOT free text — an unmapped word matches nothing, forever
migration_note:                   # the verbatim original line of any key a migration DISPLACED — a pre-existing `id:`, or a `surface:` that was not `Agentic-RAG`
relates_to: []                    # files, phases or other seeds this touches
folded_into: null                 # phase number when the seed is claimed by one (e.g. "251")
renumbered_from: null             # D-05 — on a RENUMBERED seed: the id this file used to claim. On its REDIRECT STUB: the id something was renumbered away from, i.e. this file's own
renumbered_because: null          # D-05 — why it moved. ⛔ Cite the `created`-else-`planted` DATE (D-07/D-20), never reference weight — D-07 rejects "most-referenced keeps it" by name
---

# SEED-NNN: [Title]

## The finding

[What is true today that should not be. Stay factual — the reading goes below. Name files with
`file:line` where you can; those are what `trigger_paths` is derived from.]

## Why it matters

[Who pays for this, and when. If the answer is "nobody yet", say so — a seed is allowed to be
speculative, but it must say that it is.]

## When to surface

[The human version of `trigger_when`. ⛔ Write a CONDITION, not a mood: "any phase touching
`backend/app/config.py`" can fire; "when relevant" cannot, and this register measured 126 seeds
whose trigger was effectively that.]

## Scope estimate

[Small / Medium / Large, and what makes it that size.]

## Breadcrumbs

[Commits, phases, measurements, screenshots, bus items. The evidence a future reader needs to
believe the finding without re-deriving it.]

---

## ⚠ The contract above is SYNCED, not decorative

**This file did not exist until Phase 251.** Measured at that phase's research, with nothing to
author against: **91 distinct frontmatter keys** across the register, **25 spellings of `status`**,
**101 seeds saying `id:` while 177 said `seed_id:`**, and **5 files with no frontmatter block at
all**. Nobody was careless — there was nothing to be careful ABOUT. So the point of this file is
not tidiness; it is that the next seed authored does not re-introduce the defect a 284-file
migration just removed.

### The `status` enum is a TRIPLE — change all three, or change none

| Home | What it holds |
|---|---|
| `.planning/seeds/TEMPLATE.md` | the enum comment on the `status:` line above |
| `scripts/check-seeds-register.cjs` | `STATUS_ENUM` and `REQUIRED_KEYS` — the gate that FAILS `[unknown-status]` and `[missing-key]` |
| `.claude/get-shit-done/workflows/plant-seed.md` | the block `/gsd:capture --seed` actually emits |

A value added to the gate but not here means the next author writes a seed the gate accepts and the
template denies. A value added here but not to the gate means the gate reds on a legal seed. **Same
commit, all three.**

### `trigger_surfaces` is a PAIR, and the asymmetry is structural — not an oversight

| Home | What it holds |
|---|---|
| `.planning/seeds/TEMPLATE.md` | the vocabulary, inline, below |
| `scripts/migrate-seeds-frontmatter.cjs` | `SURFACE_VOCAB` — the literal list, one member per line |

⛔ **The gate holds NO copy, on purpose.** It matches a seed's `trigger_surfaces` against **the
surfaces a PHASE declares** (D-01/D-18), never against an enum of its own, so it needs none.
`plant-seed.md` likewise carries only a POINTER at this file rather than a third copy of the words —
that block is stamped into every seed authored from here on, and a third copy is a third thing to
drift.

⚠ **If a later phase adds an `[unknown-surface]` code to the gate, that makes a THIRD copy and this
pair becomes a triple.** Say so here when it happens, so the next author inherits the rule instead
of rediscovering it.

**The vocabulary (15, alphabetical):**

`admin` · `auth` · `chat` · `connectors` · `deployment` · `harness` · `ingestion` · `library` ·
`panel` · `provider` · `retrieval` · `sandbox` · `settings` · `skills` · `workflow`

⛔ **A word outside that list matches nothing and will never match anything.** Measured across the
whole register: the most frequent quoted term in any `trigger_when` appears **TWICE**. Free-text
surfaces produce ~53 seeds each tagged with strings no other seed shares and no phase will ever
declare — a matching axis with nothing on the other side. Leave the term out and write it in
`trigger_when` prose instead.

### `trigger_paths` is the LOAD-BEARING field

It is deterministic, it matches `files_modified` directly, and it is the only trigger key the gate's
counterfactual arm can be driven against. `trigger_when` prose explains the trigger to a human;
`trigger_paths` is what actually fires. **A seed with prose and no paths is still unswept**, and the
gate prints that as its own separate figure precisely so the larger number cannot hide behind the
smaller one.

⛔ **A third matching axis keyed on PHASE NUMBERS is deliberately absent** (D-18), and the key's
name is written out only in the gate — `scripts/check-seeds-register.cjs`, in the comment beside
`unsweptCounts` — so that a `grep` of this template can never suggest it is a key you may write.
The measurement: 31 seeds name a phase number, and every one names it as HISTORY (*"Phase 238
landed a Graph adapter"*), not as a future trigger. Nothing declares phase touches for it to match
against.

### Check a seed before you commit it

```bash
node scripts/check-seeds-register.cjs --files .planning/seeds/SEED-NNN-your-slug.md
node scripts/check-seeds-register.cjs              # the whole register
```

⚠ **This file is deliberately named so that `SEED-\d{3}-.*\.md` does NOT match it**, so creating or
editing it can never change the register's census. That is load-bearing: a template counted as a
register entry would be a permanent phantom `[missing-key]`.

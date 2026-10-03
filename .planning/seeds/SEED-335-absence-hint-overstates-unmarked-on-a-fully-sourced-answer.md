---
seed_id: SEED-335
title: The citation footer says "Unmarked claims read as general knowledge" on an answer that cites its sources in a table column instead of [n] markers
created: 2026-10-03
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Any phase whose files_modified names AbsenceHint.tsx, MessageItem.tsx's citation footer, or the citation-marker parser; or SEED-033 being picked up; or a second observation of a sourced answer that renders zero inline markers."
trigger_paths: ["frontend/src/components/chat/AbsenceHint.tsx", "frontend/src/components/chat/MessageItem.tsx"]
trigger_surfaces: ["chat"]
migration_note:
relates_to: ["SEED-033", "272-VALIDATION.md §4 G4-3 re-run 2 (observation O-1)", "Phase 153 CITE-01"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-335: the absence hint overstates "unmarked"

## The finding

`AbsenceHint.tsx:55` renders *"Unmarked claims read as general knowledge"* under every answer that
has a non-empty citation set (Phase 153, CITE-01). That copy assumes the answer marks its sourced
claims with inline `[n]` markers.

Phase 272's G4-3 re-drive 2 (2026-10-03; thread `ec595218`, run `2839d9dd`, deepseek /
deepseek-v4-flash) produced a fully sourced answer. It gave all three Acme GmbH figures in a table
whose *Source* column named each report by filename. That makes **0 inline citation markers**,
while `References · 3 sources` listed all three. The footer still read *"Unmarked claims read as
general knowledge"*, which tells the reader the whole table is general knowledge. The first G4-3
drive and probe 2 both used `[n]` markers, so the trigger is model formatting variance. The copy
is wrong whenever the variance happens.

## Why it matters

The hint exists to make "no marker" a trustworthy signal. On this answer it inverts that: every
figure was retrieved, and the UI says none was. A reader who trusts the hint discounts a correct,
sourced answer. Nobody has lost data. It is a credibility gap on the exact surface Phase 272 was
making legible.

## When to surface

Any phase touching `AbsenceHint.tsx` or the cited-assistant branch of `MessageItem.tsx`, when
SEED-033 is picked up, or on a second observation.

## Scope estimate

Small to medium. Options: (1) render the hint only when the answer body carries at least one
inline marker; (2) recognise a filename/source column as attribution; (3) prompt the model to use
`[n]` markers inside tables too, which is provider-dependent and needs the provider-docs-first
cross-check. `MessageItem.tsx` is G-5-firing, so a change there needs its hot-file ledger section
read first.

## Breadcrumbs

- `.planning/phases/272-close-means-wrong/272-VALIDATION.md` §4, the G4-3 re-run row (O-1).
- `272-UAT-LOG.md` → "G4-3 re-drive 2", observation O-1.
- Evidence: `evidence/g4-3-at-rest-rerun2.png`, `g4-3-references-open-rerun2.png`,
  `g4-3-dom-rerun2.txt`.
- Operator ruling on O-1, 2026-10-03: *"Plant a seed"*. Commit `617d45754` recorded the observation.

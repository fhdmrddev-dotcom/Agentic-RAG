# Auto-Classification: Suggestion Surface & Rule Builder (Phase 118)

## Design Decisions

**036 — Classification suggestion = "on the doc" (winner: A).**
An upload-time suggestion reads + accepts/dismisses in BOTH homes: the detail-panel
`Classification` accordion section (the slot the shared 027/028 shell reserves) AND
inline on the document row. Load-bearing honesty:

- **"Suggested" ≠ "moved"** — never a silent auto-move (CLASS-02). The suggestion is
  a proposal chip; the document stays where it is until an explicit Accept.
- A rule match is **deterministic** → show the matched rule + its condition, **never a
  fake confidence %** (no invented scores on rule hits).
- Accept → move + `classification.apply` audit receipt, **reversible** (CLASS-03).
- Dismiss is quiet and durable (no re-nag on reload).

**037 — Rules live on a dedicated "Classification rules" surface (winner: A —
list + side-panel builder).**
Reached from the Documents sidebar's "Automation" group (peer to Folders + Views,
built from the shared NavRow). The rules LIST shows status/scope/condition→action at
a glance; the BUILDER opens in a side panel reusing the locked vocabulary: the 029-A
chip-strip condition builder + a suggested folder/tag target + an owner/global scope
control (the 031 `G`-pill language) + a **live "would match N" preview** (the 029
count-resolve pattern). Enable/disable per rule without deleting.

## Key Patterns

- Reuse, don't invent: the condition UI IS the 029 chip strip; the scope pill IS the
  031 `G` pill; the panel section IS the 027/028 accordion shell.
- Suggestion chip anatomy: quiet primary-dim chip `suggested → [folder]` + matched-rule
  provenance line + Accept / Dismiss pair; accept beat = audit receipt ("🛡 moved ·
  audit logged").

## What to Avoid

- Auto-moving documents on rule match (the hard CLASS-02 line — suggestion is a state,
  move is a user action).
- A fabricated "92% match" on a deterministic rule — provenance is the rule text, not
  a score.
- Burying rules inside Settings — they're a Documents-surface concern, reached from
  the Documents rail.
- A second condition-builder dialect (the chip strip is the ONE grammar for
  conditions everywhere).

## Origin

Synthesized from sketches: 036, 037 (Phase 118, 2026-06-21).
Source files: sources/036-classification-suggestion/, sources/037-rule-builder-and-list/

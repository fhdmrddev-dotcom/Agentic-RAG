---
sketch: 263
name: the-skills-an-expert-needs
question: "How does the authoring studio name the skills an Expert needs but doesn't have, get each one approved through the existing skill-creator, and refuse to let an author save blind?"
winner: "A"
tags: [experts, skills, authoring, approval, honesty, phase-263]
requirements: [PACK-14, PACK-15, PACK-16]
grounded_in: [BUG-260921-01, SEED-303, ExpertAuthoringStudio.tsx, SkillFormDialog.tsx, save_skill]
---

# Sketch 263: The Skills an Expert Needs

## Design Question

**How does the studio show that an Expert's blueprint claims capabilities that do not exist —
and turn that into something a human can act on, one skill at a time?**

Three sub-questions, all three carried end-to-end by each variant:

| # | Requirement | The visual question |
|---|---|---|
| 1 | **PACK-14** | How do proposed (non-existent) skills sit beside real library skills without reading as an error? |
| 2 | **PACK-15** | What does approving *one* skill feel like, when it routes to the existing `skill-creator` and never auto-creates? |
| 3 | **PACK-16** | Save with a phantom skill — blocked, structural, or stated? |

**PACK-17** (cross-org isolation) has no UI surface — it is a driven backend test, not a sketch.

## Why this sketch exists

`BUG-260921-01`, driven live in Chrome on 2026-09-21. A doctoral-literature-review Expert came back
with a **2163-char PRISMA blueprint** and these capabilities:

```
docx    SELECTED
xlsx    SELECTED
pptx    SELECTED
```

`SELECT count(*) FROM public.skills` = **10**. For an academic domain the only lexical matches in
the library are three output file formats. **The prompt is not at fault — the library is the
ceiling.** And the prompt's own `"or include 3-5 recommended domain skill names"` hatch makes it
worse silently: invented names are **stripped at run time** by `expert_service.py`'s phase-2 member
check, so the author sees capabilities the Expert will never have and nothing says so.

## How to View

```
python -m http.server 8777 --bind 127.0.0.1   # run from .planning/sketches/
# then open http://127.0.0.1:8777/263-the-skills-an-expert-needs/index.html
```

(`file://` is blocked by the Chrome extension; the theme link is relative, so serve from
`.planning/sketches/`.)

## Variants

- **A: Inline Shelf Gap ★ WINNER** — the existing `Bound Knowledge & Capabilities` card splits into
  *In your library* (solid pills) and *Proposed for this Expert* (dashed `⬡` cards, one line of
  description each). `Create this skill →` opens the **existing** `SkillFormDialog`, pre-filled.
  Save is **disabled** with an inline banner naming the count. *Smallest diff to the shipped
  studio — path of least resistance.*
- **B: Provisioning Step** — a third studio step between drafting and saving
  (`① Draft · ② Provision capabilities · ③ Save & grant`). A per-row approval list on the left, and
  on the right **exactly what `skill-creator` will write** — name, description, full instructions,
  triggers — readable before approval. `Approve & create` / `Edit first` / `Skip`. Step 3 is
  **locked** until no row is pending, so the save guard is structural rather than advisory.
  A skipped row is recorded as skipped, not lost.
- **C: Capability Ledger** — the live Expert preview card becomes an account:
  *Will have* (solid green) vs *Blueprint claims · not real* (dashed ghost chips). Clicking a ghost
  chip opens the approve panel **on the card**. `Save Expert` is **never blocked** — it prints one
  plain sentence: *"PhD Literature Review Expert will be saved without 5 of the 7 capabilities its
  blueprint describes,"* and lists them. PACK-16 is the organizing idea, not a footnote.

## What to Look For

1. **Does "proposed" read as opportunity or as failure?** All three use a dashed `⬡` border and the
   violet accent, never red. Is that enough signal, or does the gap need more weight?
2. **Where does the approval belong?** In a modal (A), in a dedicated pane with the full payload
   visible (B), or inline on the preview card (C)?
3. **Should Save ever be blocked?** A blocks it. B makes blocking unnecessary. C refuses to block
   and states the consequence instead. *This is the real decision in the sketch* — B and C are
   opposite answers to PACK-16 and both are defensible.
4. **Is "Skip" honest enough?** B lets an author knowingly ship an Expert without a claimed
   capability, recorded. A and C reach the same place via `Remove` / `Drop the claim` — but the
   blueprint text still describes it. Nothing here rewrites the blueprint; that may be a gap.
5. **Does the payload preview earn its space?** B shows ~650 chars of instructions before approval.
   Too much to read per skill × 5 skills, or exactly the point of "approve, don't auto-create"?

## Real data used

Every name, count and string is measured, not invented:

- **The library** (10 rows, 2 system): `docx` · `xlsx` · `pptx` · `skill-creator` ·
  `financial_ratio_calculator` · `project-brief-summarizer` · `weekly-report-writer` ·
  `meridian-executive-report` · `arabic-tender-document` · `risk-lens_099uat`
- **The Expert**: `PhD Literature Review Expert` / `phd-literature-review-expert`, 3 knowledge
  folders, 3 connections, `+ Union Scope`, `👥 Org-Wide` — the shape from Migration 187/189.
- **The five proposals** are what the drafter *should* return alongside `member_skills`, each with
  a real description and real instructions: `systematic-search-strategy` · `prisma-screening` ·
  `methodology-appraisal` · `thematic-synthesis` · `citation-integrity-check`.

## Verified before handoff

Driven in Chrome at `127.0.0.1:8777` (not just written):

- JS parses clean; **zero console errors**; every `getElementById` target exists in markup.
- **A** — 5 proposals render, Save disabled, dialog opens pre-filled (646-char instructions),
  `Create skill` moves the row into the library rail and the counters go `2 → 3` / `5 → 4` /
  `2 of 7 → 3 of 7`.
- **B** — `Approve & create` and `Skip` both advance to the next pending row; counters read
  `1 approved · 3 pending · 1 skipped`; `Continue` stays disabled while any row is pending.
- **C** — ghost chip opens the inline approve panel; `Save Expert` prints
  *"…without 5 of the 7 capabilities its blueprint describes"* with all 5 named.
- `reset` in the sketch toolbar restores all three variants.

## Out of scope

A skill marketplace, cross-org skill sharing, editing the blueprint text to match what was
actually created, and any change to what an Expert *does* at run time.

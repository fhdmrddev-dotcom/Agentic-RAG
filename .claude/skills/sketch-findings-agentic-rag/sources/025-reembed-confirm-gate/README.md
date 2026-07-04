---
sketch: 025
name: reembed-confirm-gate
question: "When you change the embedding model and hit Save, how does the confirmation command attention about the consequences (chunks, target model, recall dip, ETA, irreversibility) without being a casual toast?"
winner: "Synthesis (C's weight-frame + A's 4-fact grid)"
tags: [phase-111.1, settings, re-embed, confirm-gate, d-03, destructive, must-decide-modal, embed-05]
---

# Sketch 025: Re-embed Confirm Gate (D-03 — the load-bearing contract)

## Design Question
Operator verbatim: changing the embedding model is *"a serious step that should be handled
carefully to get the attention of the user about the consequences."* This sketch is the
hard-contract centerpiece. The gate (fired by confirm-on-save, D-02) MUST name in plain
language: **how many chunks** re-embed, the **target model**, that **search quality dips until
done**, a **rough ETA**, and that it's **reversible only by switching back + re-embedding**.
The open question — settled with the operator to explore all three — is **how much friction**
the gate imposes. This is the one place the project's "modals reserved for must-decide moments"
rule (Running Decision #13) is genuinely earned.

## How to View
open .planning/sketches/025-reembed-confirm-gate/index.html
(Change the model dropdown, press **Save changes** to fire the gate.)

## Variants
- **A: Type-to-confirm** — hardest stop. Full consequence list + fact grid (chunks/ETA/model),
  then the confirm button stays disabled until you **type the model name**. GitHub-repo-delete
  energy. Impossible to fat-finger; highest friction for a 6-minute, reversible job.
- **B: Acknowledge-checklist** — each consequence is a checkbox you must tick before Confirm
  enables. Forces a deliberate read of every line without typing. Loud but not punishing.
- **C: Review-then-confirm** — attention via **design weight, not friction**: danger rail, alert
  icon, big chunk count, forceful consequence copy, and a single deliberate two-step Confirm.
  No typing, no checkboxes. Lowest friction of the three, still unmistakably serious.
- **★ Synthesis (winner): C frame + A's 4-fact grid** — C's weight-not-friction frame, with A's
  full fact grid (chunks · ETA · target model · runs-in-background) restored so all five required
  D-03 facts are unmissable. Serious without irreversibility-theatre.

## Decision (2026-06-16)
**Winner = Synthesis (C's weight-frame + A's 4-fact grid).** Rationale: the re-embed is rare,
deliberate, **reversible, resumable, and non-destructive** — so friction must be *proportional*.
Type-to-confirm (A) is the pattern for genuinely irreversible destruction (GitHub repo-delete);
applying it here is severity-theatre that trains the gate as a chore. The D-03 contract asks the
gate to *command attention about the consequences* — that's **weight, not friction**. C delivers
the weight (danger rail, forceful copy, deliberate two-step) and honors the "modals reserved for
must-decide moments" rule (Running Decision #13); A's 4-fact grid was grafted back so all five
facts (chunks · model · recall dip · ETA · irreversibility) are concrete. B (checklist) is the
documented fallback if, in build, C reads as too easy to click through.

## What to Look For
- Does the gate read as **serious** the instant it opens (the D-03 bar) — or casual/dismissable?
- Is the friction **proportional**? The act is rare, deliberate, reversible, and resumable —
  is type-to-confirm right, or theatre? Is review-then-confirm enough, or too soft?
- Are all five required facts present and legible (chunks · target model · recall dip · ETA ·
  irreversibility)?
- Does the danger styling stay on-brand (Deep Midnight danger/warning tokens) rather than
  generic-alert-red?

---
seed_id: SEED-196
title: Configuration is scattered across four surfaces with no stated boundary — Settings, the Control Room, Knowledge Health and the classification rules page — and the operator's note is the fifth attempt to draw the line
created: 2026-08-23
planted_during: 'Operator note review, 2026-08-23 — "Categorize customization and settings: information display like dashboard and library health, classifications and rules, user and access, configurations and fine tuning, settings"'
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-151 — projects as a configuration container. ⚠ A FIFTH HOME, and it is already planted.
    Whatever boundary gets drawn must have a place for it or it will land wherever is convenient.
  - SEED-012 — admin / operator UI completeness. The Control Room's own backlog; it will keep
    absorbing configuration by default until something says it should not.
  - SEED-046 — library health dashboard enrichment. The "information display" arm of the
    operator's note, already planted separately.
  - SEED-185 — no URL router. ⚠ HARD DEPENDENCY IN PRACTICE - an IA is a map, and today no
    destination on that map has an address. Reorganising navigation before anything is
    addressable means nobody can link to the result, including us in documentation.
  - project_settings_control_room_boundary (memory) — this boundary has been discussed before and
    never written down as a rule.
  - Phases 146-148 — the Operator Control Room, and the audience map that already exists there.
trigger_when: >
  Re-open at whichever comes FIRST, and treat it as a G-2 fire rather than a feature:
  (a) the next phase that ADDS a configuration surface or moves one — including SEED-151
      (projects) and SEED-194 (image-model settings), both of which will need a home;
  (b) the next /gsd:new-milestone, as a candidate REQ.

  ⚠ G-2 APPLIES BY CONSTRUCTION — this is navigation, layout and IA, so it is /gsd:sketch BEFORE
  /gsd:spec-phase, and per the ratified method (feedback_stitch_plus_sketch_is_the_design_method)
  it is Stitch first for the language, then a sketch that RENDERS real components. An IA proposal
  in prose is not an acceptance bar.
---

# Four surfaces already claim configuration, and none of them says what it is for

## The state today

| Surface | What it holds | Who it is for |
|---|---|---|
| Settings (SettingsPage) | providers, models, retrieval knobs, re-embed, connections | the user |
| Operator Control Room (/admin, Phases 146-148) | dependency health, active runs, kill switches, audit ledger, users, feature visibility | the operator |
| Knowledge Health (Phase 119) | governance signals with inline fix-rows | the user, sort of |
| Classification rules (Phase 118) | suggestion rules | the user |

Plus user_settings / app_settings underneath all of it, and SEED-151 proposing projects as a
*fifth* configuration container.

There is no written rule for which surface a new knob belongs to. The Control Room has an
audience map — that is a *permissions* model, not an information architecture. So each new
setting has landed wherever the phase that created it happened to be working, which is how four
surfaces came to exist without anyone deciding there should be four.

## Why the operator's note is worth acting on rather than filing

The note proposes five categories — information display, classifications and rules, users and
access, configurations and fine-tuning, settings. That cut is *better than what exists*, and
more importantly it is the **fifth independent attempt** to draw this line (Settings, the
Control Room, Knowledge Health, SEED-151, and now this). A boundary that keeps getting
re-proposed and never recorded is a boundary that will keep costing a decision on every phase.

The cost is already visible and it is not cosmetic:

- **The user cannot find things.** Retrieval tuning is in Settings, retrieval *health* is in
  Knowledge Health, and retrieval *failures* are in the audit ledger — three places for one
  concern.
- **Every new phase pays a routing tax.** SEED-194 will need somewhere to put an image-model
  setting; there is no rule, so it becomes a discussion.
- **Two audiences are interleaved.** Some Control Room surfaces are operator-only, some Settings
  surfaces are effectively administrative, and the ⌥ Technical-names reveal already exists as a
  partial admission that two audiences share one screen.

## What "taking this" should actually produce

Not a reorganisation first. **A written rule first**, then whatever moves follow from it:

1. **A stated boundary** — for each surface, one sentence on what belongs there and what does
   not, including where a *new* knob goes by default. This is the artifact; everything else is
   downstream. It belongs in docs/ with a same-commit sync rule, alongside the other
   architecture verdicts.
2. **Audience as a first-class axis**, since it already exists in the Control Room's map — user
   / operator, stated per surface rather than inferred per control.
3. **Then** the moves, sketched and approved before built.

⚠ Resist the appealing version of this — a single unified settings shell with tabs. It is the
obvious drawing and it hides the actual problem, which is that *nobody has said what the
categories mean.* Four surfaces with a written rule is a better product than one surface with
five tabs and the same ambiguity inside it.

---

## ⚠ CONFIRMED FROM THE NAV, AND THE CAUSE IS NAMED ELSEWHERE — added 2026-09-18

This seed already names **classification rules** as one of its four homes. Measured 2026-09-18,
that home is **top-level in the primary rail**, sitting beside Chat as a peer
(`nav-items.ts` — `{ view: "classification-rules", label: "Classification" }`).

**Operator framing:** *"Classification sits top-level beside Chat, but it's a setting for how
ingestion behaves, not a place you go to work."* ⭐ **That is this seed's boundary problem with a
visual tell** — a configuration surface had nowhere to live except as a destination, because the
app has exactly one navigation axis and every axis member is a destination.

⛔ **The cause is recorded in `SEED-151`, not here.** This seed says configuration has no boundary;
`SEED-151` says there is no container for a boundary to be drawn inside. **Sequence 151 first** —
reorganising configuration before a second axis exists just renames the four homes.

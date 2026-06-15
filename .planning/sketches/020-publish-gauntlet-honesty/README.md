---
sketch: 020
name: publish-gauntlet-honesty
question: >
  How does the publish moment render the REAL 8-stage gauntlet (lint → real golden
  test-run on the project KB → independent judge verdict) as a first-class honesty
  surface — where a judge fail is a HARD wall, the verdict is rendered (never
  re-derived), and the long synchronous golden run is legible?
winner: "B"
tags: [publish, gauntlet, judge, honesty, PublishVerdict, golden-run, QUAL-01, net-new, workflow-studio, phase-103]
---

# Sketch 020 — Publish Gauntlet Honesty

This is the **publish stage** that follows the 018 (describe) → 019 (refine) builder.
It **upgrades sketch 012's binary "publish succeeded" toast** into the real staged
gauntlet. The publish form is the real `PublishRequest`: **ONE `golden_input`
textarea + a Publish button** (not a multi-field form). The screen then renders the
real `PublishVerdict` — **exactly 5 server-authored fields, rendered verbatim, never
re-derived in the client.**

NET-NEW honesty flag: there is no publish UI in `frontend/src` today — the only live
route is `POST /workflows/{id}/publish`. This proposes the first one.

## Design Question

When a user publishes a workflow, the system runs a real 8-stage gauntlet that can
**honestly block** — including a real golden run of the workflow against the project
KB and an independent judge of the result. How do we make that legible: the 8 ordered
stages (not the stale 4), the long synchronous golden-run wait, the rendered verdict,
and — the centerpiece — a judge block that is a **hard wall with no override**, shown
as per-criterion `{criterion, score, evidence}` rows + a one-paragraph summary?

## How to View

Open `index.html` in a browser (it links `../themes/default.css`). Switch the three
variants with the top tabs. Use the **bottom-right state cycler** to walk the publish
lifecycle:

1. **resting** — the `golden_input` box + Publish (the real single-field request)
2. **golden-run wait** — the gauntlet running, paused on the prominent long synchronous
   "running the golden run on your KB…" state
3. **published v1** — a SUCCESS verdict with a real `golden_run_id` and a "view the
   golden run" link; immutable-on-publish (tweak forks v2)
4. **judge BLOCK ★** — the centerpiece: golden run succeeded, judge failed, per-criterion
   rows + summary, "fix & re-publish" (no override)
5a. **early block (business_requirement)** — a pre-run block at stage 1 → no run link
5b. **early block (lint)** — a pre-run block at stage 2 → no run link
4b. **judge — no verdict** — the un-producible-verdict honest-failure line

Every interactive element responds: the textarea enables/disables Publish, the run-link
shows an "opening…" terminus, the C banner expands/collapses, "Fix & re-publish" and
"Tweak → new version" cycle back to resting.

## Variants

- **A · Staged checklist** — a vertical ladder that fills top-to-bottom as the gauntlet
  runs; the blocked stage **expands in place** (the judge card / lint list opens under
  the blocked row).
- **B · Progress-spine + long wait ★** — a focused progress spine with a prominent
  long-wait "running the golden run on your KB…" panel, then a separate verdict card
  below (block or success).
- **C · Verdict-first banner** — a compact pass/block banner up top that **expands on
  demand** to the staged breakdown + judge critique; verdict-led for fast scanning.

## What to Look For

- **8 real ordered stages, not 4** — owner-check (0), definition valid (0b),
  business_requirement (1), structural lint (2), interactive-phase (2.5), the real
  golden run (3), structural gate (3b), the judge (4), the flip (5). The roll-up reads
  "passed / running / BLOCKED / not reached."
- **The 5-field PublishVerdict grid** — `published`, `version`, `golden_run_id`,
  `blocked_stage`, `named_failures` — labeled and rendered verbatim, with a "rendered,
  not re-derived" caption proving the client doesn't recompute the verdict.
- **The 10 real `blocked_stage` strings only** — shown as `code-chip`s (`judge`, `lint`,
  `business_requirement`, …). No invented stage names or codes.
- **The judge block (QUAL-01 centerpiece)** — per-criterion `{criterion, score, evidence}`
  rows (`grounded_in_evidence`: fail 0.42, "3 of 12 figures uncited"; the passed criteria
  shown for the full picture) + a one-paragraph server summary. **No raw JudgeVerdict
  booleans** — those live in the governance receipt. Judged by an independent model.
- **A judge fail is a HARD WALL** — there is **no "publish anyway" / override** anywhere;
  the only affordance is "Fix & re-publish" (a fresh golden run + judge each attempt). The
  intentional absence is even rendered as a struck-through `publish anyway`.
- **The golden-run link gates on `golden_run_id`** — it appears only when non-null (stage
  3+ reached). On a pre-run block (lint / business_requirement) the UI explicitly says
  `golden_run_id` is null and there is **no run to open**.
- **The long synchronous wait is honest** — the running panel says publishing blocks the
  request up to `harness_publish_max_seconds`, notes background-job publish isn't built,
  and tells you not to close the tab.
- **HTTP mapping is distinguished** — the 200-with-block ("read blocked_stage") vs the
  400 (business_requirement, verdict in `detail`); 404 not_found / 409 already_published
  noted in the field captions.
- **The un-producible verdict** — renders the single line "the judge produced no verdict
  (<reason>) — honest failure, not a silent pass." It fails closed.

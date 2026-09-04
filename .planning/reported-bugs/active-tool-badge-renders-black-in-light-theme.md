---
id: BUG-260904-03
title: "The active-tool badge and its rail light render black in light theme"
reported: 2026-09-04
surface: Agentic-RAG
severity: medium
status: closed
affected_areas: [frontend/chat, theming, light-theme, StepRow.tsx, StatusPill.tsx, ToolCallPanel]
not_caused_by: 227
folded_into: null
verified_closed_by: "quick task 260904 — computed styles read in BOTH themes on the live page; operator visual confirmation still owed"
related_seeds: [SEED-092]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 57274c7e0
  date: 2026-09-04
---

# BUG-260904-03: the active-step mark is black in light theme

Reported by the operator, 2026-09-04, during Phase 227 review.

## What they observe

> *"the badge colour and the light for active tool is in black which is something not good
> in light theme."*

The mark that says *this step is running* — the rail node and its status badge — reads black
on the light theme, where it should carry the same accent it has on dark.

## Cause NOT yet established — do not fix on the reading below

The obvious suspect is ruled out: `--primary` in the light block is **indigo, not black**
(`frontend/src/index.css:25` → `239 84% 67%`; the dark block at `:123` is `239 100% 82%`).
The active node's classes (`StepRow.tsx:227-239`) are token-based —
`bg-card border-primary animate-pulseGlow shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]` — and
the running pill is `bg-primary/15 text-primary` (`StatusPill.tsx:8`). None of those resolves
to black by itself.

So the black is coming from somewhere the tokens do not reach. Candidates, in the order worth
checking **with the element inspected in a live light-theme page**:

1. A hardcoded colour on the tool icon or its wrapper (`toolIconColor`, moved to `StepRow.tsx`
   in Phase 227) rather than a token.
2. A `dark:`-only rule whose light counterpart was never written, leaving an inherited
   `text-foreground` (`222 47% 11%` — near-black) as the effective colour.
3. The `animate-pulseGlow` keyframes referencing a colour literal.

⚠ **Phase 227 moved this markup between files in the same week this was noticed.** Check the
pre-227 build side by side before assuming the refactor caused it — the phase's whole claim is
that nothing changed on screen, and this is exactly the kind of observation that either proves
or refutes it. If it reproduces identically on `7334f8d84`, it is pre-existing and 227 is clear.

## Acceptance

Switch to light theme, start a run with a tool, and inspect the active step: the rail node,
its glow and the running pill all carry the accent, and text on them meets contrast (SEED-092
is the standing WCAG AA seed for this app).

## Cleared of Phase 227 — 2026-09-04

The before/after drive (`227-VALIDATION.md`) compared the normalized rendered DOM of the active
rail node and the step rows between `7334f8d84` (pre-227) and `57274c7e0`. **They are byte-identical.**
Whatever produces the black mark is present in the pre-227 build too, so the refactor neither caused
nor hid it. Diagnose it on its own, on the three candidates listed above.

## Fixed — 2026-09-04

**The cause was none of the three candidates above, and the rail node was never the problem.**
Measured on the live page in light theme with an active tool step, the node, the status pill and
the step number all render indigo correctly (`rgb(100, 103, 242)`). What is black is the
**run status strip**:

`RunStatusStrip.tsx:77` carried the dark theme's surface as a FROZEN LITERAL —
`bg-[hsl(220_30%_11%/0.8)]`. Not a token, so it never changed with the theme.

| Theme | before | after |
|---|---|---|
| light | `rgba(20, 25, 36, 0.8)` — near-black pill on a white page | **`rgba(238, 239, 242, 0.8)`** |
| dark | `rgba(20, 25, 36, 0.8)` | **`rgba(20, 25, 36, 0.8)`** — byte-identical |

⭐ **The swap is exact, not approximate:** `220 30% 11%` IS the dark block's `--muted`, so
`bg-muted/80` resolves to the identical colour in dark and to the light grey in light. The
floating variant one line below already used a token (`bg-popover/92`) — only this branch was
hardcoded, which is how it drifted unnoticed through every phase that touched the strip.

## Still owed

⚠ **Operator visual confirmation.** Computed styles say the pill is now light-grey-on-light, but
this report exists because a person LOOKED at it, and twice today a UI fix measured clean and was
still wrong to the eye. Confirm in light theme with a live run before treating this as settled.

## Two more dark-frozen literals found in the same sweep, deliberately NOT changed

- `ExecuteCodeBody.tsx:47` `bg-[hsl(220_30%_7%)]` and `:125` `bg-[hsl(220_30%_9%)]` — the code
  viewer's gutter and header. Also theme-blind, but a dark code block on a light page is a
  defensible convention; changing it is a DESIGN call, not a defect fix.
- `BatchResultList.tsx:64` `text-[hsl(0_80%_80%)]` — a pale red that will read weakly on white.

Both are named rather than left silent: an unnamed literal is how this one survived.

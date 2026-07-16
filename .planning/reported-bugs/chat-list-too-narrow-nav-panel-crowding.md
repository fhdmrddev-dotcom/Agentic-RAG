---
id: BUG-260711-01
title: Chat list / chat area squeezed too narrow — nav panel growth crowds out chat selection
reported: 2026-07-11
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/navigation, frontend/layout, frontend/chat-list]
folded_into: 156
verified_closed_by: null
related_seeds: [SEED-113]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 96e3eb19
  date: 2026-07-11
---

# BUG-260711-01: Chat list / chat area squeezed too narrow — nav panel growth crowds out chat selection

## What we observed

Operator report (2026-07-11, immediately after Phase 146 UAT): "the chat area became very narrow — the navigation panel is growing and it leaves just small space where even scrolling with the mouse wheel will not enable you to select the correct chat because it's very very narrow."

The left navigation panel has accumulated entries across milestones (Folders + Views [v3.0/114], Workflows [v2.9], Governance [119], Skills/Skill Studio [v3.1-3.2], and now the operator shield slot [146]). The remaining width/height budget for the chat (thread) list is now so tight that scanning and picking the right chat by mouse wheel is unreliable in daily use.

## Why it matters

Chat is the app's default interface (CLAUDE.md first line). If selecting the right conversation is physically awkward, every session starts with friction — this is a daily-driver ergonomics regression, not a cosmetic nit. Severity `major` because it degrades the core surface for all users, though nothing is functionally broken.

## Hypothesized cause

Not yet investigated (hypothesis only): nav panel sections are all always-expanded with no density management; the thread list shares the rail with a growing set of nav groups instead of having a protected minimum height; possibly also fixed panel width does not scale with content. Needs a structural look at `NavPanel.tsx` / `ChatLayout.tsx` composition rather than a one-off CSS tweak.

## Surface classification

`Agentic-RAG` — our frontend layout. Routing candidate at GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** n/a (147 is the operator control plane — different surface)
- **Defer to future phase / milestone:** strong candidate for a small dedicated nav/IA density pass inside v3.3 (fits the milestone's "everyday UX aligned to Glean/Beam — simple, accurate" goal; consider alongside SEED-113 profile menu since both reshape the nav rail). G-2 applies: sketch before any redesign; the Phase 103 three-homes IA contract (sketch-findings skill) is the governing design context.
- **FOLDED → Phase 156 (2026-07-16, discuss-phase):** Sketch 078-D is the "sketch before redesign" this report asked for. Its permanent thin icon rail + dedicated full-height chat-history column decouples nav growth from the thread list — the structural fix for this crowding. `status: open → folded`, `folded_into: 156`. Flips to `closed` when the shipped rail verifiably relieves the crowding.
- **Plant as seed:** covered by this report + sibling [SEED-113] (profile/user menu — same rail real estate)
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

- Collapse nav groups (Folders/Views/Workflows) where collapse affordances exist to give the thread list more room.
- Browser zoom-out slightly increases visible rows.

## Reference / evidence links

- Operator verbatim report in session 2026-07-11 (Phase 146 close-out conversation)
- Nav growth history: Phases 103 (three-homes IA), 114 (Folders+Views NavRow), 119 (Governance), 123 (Skill Tuner), 146 (operator shield slot)

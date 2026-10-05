---
id: BUG-261004-02
title: Settings is unreachable for ordinary users, yet it holds user features (Memory, Audit Log, Show technical names)
reported: 2026-10-04
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/navigation, frontend/settings, auth/permissions]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 9b7dd251d
  date: 2026-10-04
---

# BUG-261004-02: Settings is unreachable for ordinary users, yet it holds user features

## What we observed

Found while writing the public docs in Phase 276 (276-04 SUMMARY, "Issues" item 1); recorded by 276-07.

- The Settings rail entry is gated on the `model_management` feature
  (`frontend/src/lib/nav-items.ts:115` — `{ view: "settings", …, feature: "model_management" }`).
  `model_management`'s day-one audience is Operators, so an ordinary org member does not see
  the entry at all.
- The Settings page is not only about models. Its **Memory** and **Audit Log** tabs and the
  **"Show technical names"** switch are features for every user.
- The profile menu has no Settings item, so there is no second door.

Expected: an ordinary member can reach their own user-level settings (memory, their audit log,
the technical-names preference). Actual: they cannot reach any of them through the UI.

## Why it matters

An ordinary member cannot manage their memory, review their own audit log or switch the
technical-names reveal, all of which the product presents as theirs. Operators do not notice,
because the entry is visible to them, so this stays invisible during operator-driven testing.

## Hypothesized cause

Hypothesis, not a finding: one permission (`model_management`) gates a page that mixes
operator tabs (models, providers) with user tabs (Memory, Audit Log, preferences). The gate was
right for the page's original model-only scope and was not revisited when user tabs were added.
`PUT /settings` itself also carries `require_visible("model_management")` (see the comment at
`nav-items.ts:50`), so a fix is likely to touch both the rail gate and the per-tab API gating,
not just the nav entry.

## Surface classification

`Agentic-RAG`: this is the app's own navigation and permission model.

## Suggested routing

- **Fold into in-flight phase:** n/a. Phase 276 is a docs phase; this is a product decision
  about who reaches which settings, and it is not trivial.
- **Defer to future phase / milestone:** candidate for the next phase touching
  `frontend/src/lib/nav-items.ts`, `frontend/src/pages/SettingsPage.tsx` or settings permissions.
- **Plant as seed:** not yet.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

An operator can widen `model_management`'s audience in the Control Room feature-visibility map,
at the cost of also showing model management to those users. The public docs (276-04) state the
gating honestly, so nobody is told a door exists that they cannot open.

## Reference / evidence links

- `.planning/phases/276-public-docs-api-reference-video-library/276-04-SUMMARY.md`, Issues item 1
- `frontend/src/lib/nav-items.ts:43-57, :112-115`

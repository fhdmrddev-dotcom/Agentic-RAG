---
id: BUG-260813-01
title: The workflow canvas stays DARK in light mode — `colorMode` is hardcoded, so the plane ignores the app theme
reported: 2026-08-13
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/workflow-canvas, frontend/theming, WorkflowCanvas.tsx, useTheme]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 031396dc
  date: 2026-08-13
---

# BUG-260813-01: the canvas is the only dark island in a light page

## What we observed

Operator, 2026-08-13, during manual use:

> the canvas area is it still dark in the light mode only the canvas area while the rest of
> publication is light in the light mode

**Expected:** in light mode the whole app is light, canvas included.
**Actual:** every surface follows the theme except the workflow canvas plane, which stays dark.

## Root cause — found, not guessed

**`frontend/src/components/workflows/WorkflowCanvas.tsx:1250`**

```tsx
colorMode="dark"
```

React Flow's `colorMode` prop accepts `"light" | "dark" | "system"` and drives the library's own
`--xy-*` custom properties (plane background, `<Background />` dots, `<Controls />` chrome, edge and
handle defaults). It is **pinned to the string `"dark"`**, so the canvas renders its dark palette
regardless of what the rest of the app is doing.

Everything else is fine, which is why only the canvas is wrong. The app has a complete light token
set (`index.css` `@layer base :root` — *"Light Mode (Aether Intelligence – Light Variant)"*), and
`tailwind.config.js` is `darkMode: ["class"]`, so every Tailwind-styled surface follows the `dark`
class on `<html>`. The canvas plane is the one surface **not** painted by those tokens.

## ⚠ Why this is NOT the one-line fix it looks like

The obvious patch — `colorMode={theme}` with `useTheme()` — **introduces a second bug.**

`frontend/src/hooks/useTheme.ts` is a plain hook holding **its own `useState`**, plus an effect that
**writes `localStorage` and toggles `document.documentElement.classList`**. It has **exactly one
consumer today**: `ChatLayout.tsx:111`. There is **no `ThemeProvider`** in `providers/`.

So calling `useTheme()` a second time inside `WorkflowCanvas` **forks the state**:

- two independent `useState`s, each initialised from `localStorage` at *its own* mount time;
- **both** effects writing `localStorage` and toggling the root class;
- **no shared store and no `storage` event listener**, so toggling the theme in `ChatLayout` would
  **not** re-render the canvas — the canvas would keep whatever value it read at mount.

That is the *"one home per concern"* red line: the fix would make the canvas *look* right on first
load and go stale on the very toggle that exposed the bug.

`colorMode="system"` is also wrong — it reads the OS preference, while this app's theme is a manual
class toggle persisted to `localStorage`. A user who picked light on a dark-preferring OS would still
get a dark canvas.

## The correct fix

Promote theme to a context — the shape every other cross-cutting concern in this app already uses
(`OrgProvider`, `EffectiveFeaturesProvider`, `TechnicalNamesProvider`, `StreamsProvider`):

1. Add `providers/ThemeProvider.tsx` holding the single `useState` + the class/`localStorage` effect.
2. `useTheme()` becomes a context read that **throws outside the provider** (the house pattern), so a
   second fork is a runtime error rather than a silent stale value.
3. `ChatLayout.tsx:111` keeps its `{ theme, toggleTheme }` call unchanged — the seam is identical.
4. `WorkflowCanvas.tsx:1250` → `colorMode={theme}`.

**Size:** ~3 files, small. It is `/gsd:quick` rather than `/gsd:fast` under **G-3**, because it
crosses a provider boundary and touches an API surface (the hook's contract), which G-3 excludes.

**Guard it, or it comes back:** assert `colorMode` is **not** a string literal in
`WorkflowCanvas.tsx` — a source fence in the shape the library subtree already uses. A hardcoded
theme value is invisible to `tsc`, `eslint` and every rendering test, which is exactly why it
survived Phases 183–188.1 on the repo's hottest canvas file.

## Why it matters

Small, but it is the *most visible* surface of the v3.6 differentiator — the visual workflow canvas —
and a dark island in a light page reads as unfinished. It also sits next to `SEED-155` (the card does
not match its approved sketch): both are visual-parity defects on the workflow surface, and a single
visual pass could reasonably carry both.

## Notes

- Not caught by UAT because **every G-4 row in Phases 183–192.1 was driven in the default theme.**
  Standing lesson `feedback_uat_lived_experience_gap` already says *exercise toggles BOTH ways*; the
  theme toggle was never one of the toggles anyone exercised.
- `WorkflowCanvas.tsx` is on the hot-file ledger (13 plans / 6 phases) with G-5 recorded **satisfied**
  at 188.1. This fix adds no concern to it — it replaces a literal with a prop — so it does not
  disturb that status.

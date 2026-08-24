---
id: BUG-260813-01
title: The workflow canvas stays DARK in light mode — `colorMode` is hardcoded, so the plane ignores the app theme
reported: 2026-08-13
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/workflow-canvas, frontend/theming, WorkflowCanvas.tsx, useTheme]
folded_into: 200
verified_closed_by: null
related_seeds: []
re_open_trigger: >
  Folded at /gsd:discuss-phase 200 (2026-08-19). The canvas is one of Phase 200 four in-scope screens (plan 200-06 rebuilds it to sketch 200 — corrected from 200-05, the plan numbers shifted by one when the backend slice split in two). Re-open if 200 ships without exercising light mode on the rebuilt canvas, OR if the plane follows the theme while a node card does not (see the 2026-08-19 addendum — those two are coupled by coincidence, not by design).
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


---

## 2026-08-16 — MEASURED, and the "≈3 lines, one file" estimate is WRONG

Picked up in the Phase 194.1 close-out fast batch and **put back down**, because the fix is not the
shape the estimate assumed.

**What is true:** `colorMode="dark"` is a single hardcoded occurrence
(`WorkflowCanvas.tsx:1250`), and `frontend/src/hooks/useTheme.ts` does exist. That is where the
"one line, swap in the hook" reading came from.

⚠ **What that misses: `useTheme` is a PER-CONSUMER hook, not shared state.** It holds its own
`useState` and there is exactly **one** consumer today (`ChatLayout.tsx:111`). The repo already
records the consequence, in `TechnicalNamesProvider.tsx:15-16`: *"This is NOT a bare per-consumer
hook — copying `useTheme.ts` verbatim would give each consumer its OWN useState and the toggles
would drift."*

⇒ **`const { theme } = useTheme()` inside the canvas would ship a canvas that IGNORES the theme
toggle** — it would read the right value on mount and never hear the user flip it. It would also
make the canvas a second *writer* of the theme (the hook's effect writes localStorage and toggles
the root class).

**The honest fix is one of:**
1. a small read-only observer of `document.documentElement`'s `dark` class (a new shared primitive
   — correct, but a primitive, and a fast batch is the wrong place to introduce one); or
2. lift `useTheme` into a context provider the way `TechnicalNamesProvider` already models — which
   changes a shipped hook's shape and touches its existing consumer.

**Routed to phase 196 (AUTH-04, the registry-backed model picker on the canvas)** — that phase opens
canvas files anyway, and either option above is a considered change rather than a polish sweep.
⚠ **Do NOT re-estimate this as a one-liner.** The one-liner is available and it is wrong.

---

## ⚠ ADDENDUM 2026-08-19 — measured during Phase 200 execution, from an operator screenshot

The operator re-reported this from the Builder canvas (`Customer Quarterly Business Review v1`,
Canvas tab). The capture shows the sidebar, header, tab strip and editing toolbar all correctly
**light**, and the canvas region below them a single black rectangle — plane, dot grid, zoom
controls, the React Flow attribution, **and the five step cards**, whose titles render in white.

**The step cards are the part this report did not explain, and the explanation matters.**

`PhaseNodeCard.tsx` does NOT hardcode anything. Measured — it uses theme tokens throughout:
`bg-card/30` (`:183`), `text-foreground` (`:239`), `text-muted-foreground` (`:244`, `:280`),
`border-border/50` (`:235`). On its own it would follow the theme correctly.

**Why it renders dark anyway — the mechanism, verified in the installed library:**

`@xyflow/react/dist/esm/index.js:3736` builds the wrapper's class list as

```js
className: cc(['react-flow', className, colorModeClassName])
```

where `colorModeClassName` comes from `useColorModeClass(colorMode)` (`:334-349`) and is the
**literal string `"dark"` or `"light"`**. Meanwhile `tailwind.config.js` is `darkMode: ["class"]`,
and Tailwind's class strategy is **scoped by the nearest ancestor carrying the class** — not by
`<html>` alone.

⇒ `colorMode="dark"` wraps the whole canvas subtree in a `.dark` ancestor, so **every `dark:`
variant inside it activates**, including our own components'. One prop explains the plane, the
dots, the `<Controls />` chrome, the attribution and the cards simultaneously.

**Consequence for the fix — GOOD:** the one-prop change is genuinely complete. No per-component
work is owed on the cards, and no card needs a token audit.

⚠ **Consequence for the FENCE — and this is the part worth guarding.** That completeness is a
**coincidence of two independent mechanisms happening to agree on the spelling `dark`**. React
Flow's color-mode class and Tailwind's dark-mode class are unrelated systems; nothing in this
repository documents, tests or enforces their agreement. If `darkMode` ever moves to a
`[data-theme]` selector, or React Flow renames the class, the canvas **half-fixes**: the plane
follows the theme and the cards stay dark. That reads as a fresh bug rather than a regression of
this one.

**So `200-06`'s acceptance criterion must assert BOTH halves in light mode — the plane AND at
least one node card's computed background — never the plane alone.** A fence that checks only
`colorMode={theme}` in source passes green in exactly the scenario above.

**Line-number drift corrected:** this report cites `WorkflowCanvas.tsx:1250`; at HEAD the prop is
at **`:1317`** (67 lines of drift). Re-derive rather than trust either number.

**Scope note — one further hardcoded-dark site found while measuring, deliberately NOT folded
here:** `frontend/src/components/chat/tool-bodies/ExecuteCodeBody.tsx:42` and `:119` carry
`bg-[#0d1117]` with no `dark:` variant, so code-output blocks in chat stay GitHub-dark in light
mode. That may well be intentional (a code block reading as a terminal), but nothing records the
intent — no comment, no token, no report. It is a **chat** surface, not the canvas, and Phase
200's scope is the four workflow screens, so it is reported rather than absorbed. Re-open
trigger: the next phase touching chat tool bodies, or an operator confirming it should follow the
theme.

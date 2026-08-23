---
id: BUG-260823-02
title: Opening a tool call's history blinks and washes top-to-bottom — an index React key plus a staggered entrance animation replays the whole list on every remount
reported: 2026-08-23
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/chat, UX/motion, a11y]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-008]
re_open_trigger: null
reproduces_on:
  branch — develop
  commit — f17f9581
  date — 2026-08-23
---

# BUG-260823-02: The tool history replays its entrance animation as a top-to-bottom wave

## What we observed

> Operator, 2026-08-23: *"when opening the history of tool calls, it is blinking and making
> something like a wave from top to bottom, screenshots are available."*

Every row of the tool list fades in from transparent, one after another, in a visible cascade —
not only on first render but again whenever the list remounts (expanding history, a status
change on any row, a reconcile). On a long run the effect reads as a flicker.

## Why it matters

Minor in consequence, constant in exposure: the tool panel is the primary evidence surface for
everything the agent does, and it draws attention to itself every time it is consulted. The
cascade also makes the panel *feel* like it is reloading when nothing has changed, which
undermines the "quiet-idle / alive-active" contract the Phase 127 re-skin set. It is an
accessibility defect too — the animation has no `prefers-reduced-motion` escape.

## Hypothesized cause

**Read directly from the source; three lines, all in one file.**

`frontend/src/components/chat/ToolCallPanel.tsx:683-691`:

```
<div
  key={i}                                        // :684  index key
  className={cn("pt-2.5 animate-toolSlideIn", …) // :686  entrance animation on EVERY row
  style={{ animationDelay: `${i * 80}ms` }}      // :691  80ms stagger — the wave
>
```

- `animate-toolSlideIn` (`frontend/src/index.css:422-431`, `:480-482`) starts at `opacity: 0`
  and runs `0.25s … forwards`. Starting from zero opacity is the **blink**.
- `animationDelay: i * 80ms` fires the rows in sequence. At 80ms per row that is the
  **top-to-bottom wave**, and it gets longer the more tools a run has used.
- `key={i}` is an **index** key, so React re-identifies rows whenever the list changes shape.
  A remounted element restarts its CSS animation from the beginning — which is why the cascade
  replays instead of running once.

There is no reduced-motion guard: `index.css:500` covers `.animate-fileFlash` only.

## Suggested fix shape

A **stable key already exists eight lines above the bug.** `stepKey` is computed at
`ToolCallPanel.tsx:650` via `stepKeyOf` (`:534-535`, `clientKey ?? id ?? name-startedAt-idx`)
and is already used for the expand/collapse set — it is simply not passed to `key`. So:

1. `key={stepKey}` instead of `key={i}` — stops the remount, which alone stops the replay.
2. Apply `animate-toolSlideIn` only to rows **not seen before** (a ref-held `Set` of stepKeys
   rendered at least once), so a genuinely new tool still slides in and the existing history
   does not.
3. Add `.animate-toolSlideIn { animation: none }` to the `prefers-reduced-motion: reduce` block
   at `index.css:500` — the same treatment `fileFlash` already gets.

Whether the 80ms stagger survives is a design call, not a bug fix: once (1) and (2) land it only
ever runs on genuinely-new rows, where a small cascade is defensible. Removing it is also fine.

⚠ Note for whoever takes this: changing `key` on a mapped list is exactly the shape that caused
`BUG-260626-01-duplicate-file-cards-multi-run-react-key`. `stepKeyOf` falls back to
`${name}-${startedAt}-${idx}` when neither `clientKey` nor `id` is present (DB-loaded historical
rows), so uniqueness holds — but assert it rather than assume it.

## Surface classification

`Agentic-RAG`. Frontend-only, one component plus three lines of CSS.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** n/a — G-3 candidate (`/gsd:fast`). ⚠ `ToolCallPanel.tsx`
  FIRES G-5 (47 commits / 19 phases / 995 lines, extraction due) — a `/gsd:fast` touch is
  honouring-by-construction and must not grow the file; anything larger owes the extraction.
- **Plant as seed:** no
- **External — note only:** no

## Workarounds

None. `prefers-reduced-motion: reduce` at the OS level does **not** suppress it today — that is
part of the defect.

## Reference / evidence links

- `frontend/src/components/chat/ToolCallPanel.tsx:683-691` — key, class and stagger
- `frontend/src/components/chat/ToolCallPanel.tsx:534-535`, `:650` — the stable key that already exists
- `frontend/src/index.css:422-431`, `:480-482`, `:500-504` — the keyframes and the reduced-motion block that omits them
- Operator screenshots (held by the operator; attach on fix)

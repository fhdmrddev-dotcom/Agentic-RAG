---
seed_id: SEED-359
title: One branded loader (the Syrel Iris mark) wherever the app waits for data
created: 2026-10-16
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching a frontend surface that waits for data (a list, panel, page or dialog that fetches), or any phase that inserts the Syrel logo into the app. Also at the next /gsd:new-milestone as a UI-polish candidate.
trigger_paths: ["frontend/src/components/**", "frontend/src/pages/**", "frontend/src/components/chat/IrisAvatar.tsx", "frontend/src/index.css"]
trigger_surfaces: []
migration_note:
relates_to: ["frontend/src/components/chat/IrisAvatar.tsx", "docs/brand/", "SEED-058", ".planning/sketches/276-iris-avatar/"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-359: One branded loader (the Syrel Iris mark) wherever the app waits for data

## The finding

Operator request, 2026-10-16 (verbatim intent): *"wherever we have something waiting we should add
a loader. We already have loaders all over the app but not all of them are using the official logo.
Replace every loader with the application logo, and wherever something is waiting, show a loader
until the data is retrieved and reflected."*

Two separate gaps:

1. **Inconsistent loaders.** The branded, animated logo loader already exists:
   `frontend/src/components/chat/IrisAvatar.tsx` (Phase 276-06, sketch `276-iris-avatar` variant D,
   shared `PhaseClock` in `irisMotion.ts`, reduced-motion aware). It is used only in chat
   (`ChatArea.tsx`, `MessageItem.tsx`) and `App.tsx`. Measured 2026-10-16 in `frontend/src`
   (`*.tsx`): **`Loader2` 161 uses, `animate-spin` 138, `animate-pulse` 83, `Skeleton` 11**, with
   generic spinners in about 67 non-test files. Largest clusters: chat (11), skills (10),
   settings (9), workflows (6), sources (6), setup (6), admin (5), ingestion (4), experts (4).
2. **Missing loaders.** Some surfaces show nothing (or an empty state such as "0" or "No items")
   while their fetch is still in flight. Phase 284 already fixed one instance (counts never shown
   as 0 before an answer: `LibraryHeaderBar`, `FolderNode`, `FolderTree`). Nobody has done a
   general sweep.

## Why it matters

The Syrel mark is the product's identity. Seeing a generic spinner on one page and the Iris on
another reads as unfinished. An empty state shown before the data arrives is worse, because it
tells the person something false ("you have no documents").

## When to surface

- Any phase whose `files_modified` names a fetching frontend surface (see `trigger_paths`).
- The Syrel logo insertion pass (memory: "insert later", one pass across landing, app, favicon,
  docs and video). This seed belongs in that same pass.
- The next `/gsd:new-milestone`, as a UI-polish candidate.

## Scope estimate

**Medium.** About 67 files to migrate, plus a sweep for surfaces that have no loading state.

It is G-2 work (live UI, "feels like"), so `/gsd:sketch` comes first. These have to be decided:
- the sizes: an inline button spinner, a panel loader and a full-page loader;
- whether **button-level** spinners also become the Iris, or stay a small neutral spinner, because
  a 12 px logo may not read;
- skeleton vs. logo for lists;
- the minimum display time, so a fast fetch does not flash.

Expected shape: one `<SyrelLoader size=… />` wrapping IrisAvatar's motion, plus a lint rule or
fence that bans a new raw `Loader2` / `animate-spin`. It is G-4: the operator names the "I'd
recognise failure here" scenarios.

## Breadcrumbs

- Branded loader: `frontend/src/components/chat/IrisAvatar.tsx`, `irisMotion.ts`, `.iris` block in
  `frontend/src/index.css`, sketch `.planning/sketches/276-iris-avatar/`.
- Brand assets: `docs/brand/syrel-logo-iris-animated.svg`, `syrel-mark-iris.svg`,
  `syrel-lockup-iris.svg`, README tokens.
- Related: SEED-058 (chat-surface polish: provider logos, nav presence); Phase 284's
  "never 0 before an answer" fixes.
- Counts re-derive with: `grep -rhoE "Loader2|animate-spin|Skeleton|animate-pulse" frontend/src --include=*.tsx | sort | uniq -c`.

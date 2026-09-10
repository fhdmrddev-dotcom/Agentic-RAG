---
id: BUG-260910-01
title: "Change model on the Indexing page opens Settings without selecting the tab that holds the embedding picker, so the configuration appears to have disappeared"
reported: 2026-09-10
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [frontend/library, frontend/settings]
folded_into: "240"
verified_closed_by: "240"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 36cb1276b
  date: 2026-09-10
---

# BUG-260910-01: "Change model" lands on Settings, but not on the embedding configuration

## What we observed

Operator, 2026-09-10: *"I noticed something in the indexing page when I click embedding model it
is taking me to the settings but I do not see in the settings the embedding model configuration.
It used to be there I don't know it disappeared."*

Nothing had disappeared. Both the embedding picker (`SettingsPage.tsx:1366`) and the re-embed
card (`:1418`) live inside `TabsContent value="1"`. The button did:

    onNavigate?.("settings")
    setTimeout(() => document.getElementById("reembed-status-card")?.scrollIntoView(...), 100)

It never selected tab `"1"`. Settings opens on `localStorage.settings_active_tab` — whichever tab
the person last used — and Radix unmounts inactive tab content, so `getElementById` returned
`null`, the `?.` swallowed it, and the person arrived on an unrelated tab with no embedding
configuration anywhere on screen and no error.

## Why it matters

**It reads as data loss of a feature.** The operator's own words were "it used to be there… it
disappeared" — the natural conclusion is that the product removed something. The setting was
always present and one click away, which makes this a navigation defect that costs confidence out
of proportion to its size.

## Root cause

`EmbeddingModelCard` copied half of `LibraryPage`'s deep-link. That one selects its tab and THEN
scrolls (`dispatch({ type: "SELECT_TAB", tab: "indexing" })`, `LibraryPage.tsx:775-781`). This one
kept the scroll and dropped the select — while its own comment claimed it used *"the exact
`onNavigate("settings")` + scroll-into-view shape `LibraryPage.tsx:585-597`"*. **The comment
asserted the equivalence that was missing.**

⚠ **Three tests covered this button and none could fail on it.** `IndexingTab.gate.test.tsx`
asserts `change-model` is PRESENT with `model_management` true and ABSENT when false — presence
and absence, never behaviour. The same presence-vs-behaviour gap that this project has now paid
for on the run-history block, the connection mark, and the nav badge.

## The fix

`localStorage.setItem("settings_active_tab", "1")` before `onNavigate("settings")` —
`SettingsPage` reads that key in a lazy `useState` initialiser, so it is the seam that works on
mount. Driven RED first: the test asserted the key was `"1"` and measured `"3"`.

## Surface classification

`Agentic-RAG` — this app's Library → Indexing and Settings surfaces.

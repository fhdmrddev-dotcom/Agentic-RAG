---
id: BUG-260521-02
title: Pinned "Final outputs" panel renders filenames as plain text, no download link
reported: 2026-05-21
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/components/chat/MessageItem]
folded_into: "075.2"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 0cd7990
  date: 2026-05-21
---

# BUG-260521-02: Pinned "Final outputs" panel renders filenames as plain text, no download link

## What we observed

Verified via Chrome MCP during Phase 075.1 UAT (2026-05-21, Anthropic claude-sonnet-4-6, primes-matplotlib test):

- The per-cell **"Output files"** section (inside the matplotlib install + plot tool card) rendered `primes.png 34.0 KB` as a clickable link with `url="http://localhost:8000/sandbox-outputs/d8a54002-.../primes.png"` — clicking downloads successfully.
- The pinned **"Final outputs"** panel at the bottom of the assistant message rendered just `primes.png` as plain `StaticText` (no anchor, no clickable affordance, no file size). User can SEE the file was produced but has no way to download it from the pinned panel.

Also surfaced as IN-03 in `075.1-REVIEW.md`:
> The pinned "Final outputs" panel in `MessageItem.tsx` renders filenames as text only, never exposes the `url` field as a download affordance — the panel's stated purpose is undermined.

## Why it matters

The "Final outputs" panel is the explicit UX feature shipped by Phase 075.1 Plan 04 (B-260519-11 + BUG-260514-01) to solve the "12 download links for 1 desired file" cognitive-load problem. It surfaces the cumulative final file set at the end of an agentic loop. If the filenames aren't clickable, the panel functions as a label, not a download surface, and the user still has to scroll back through per-cell cards to find the working link.

Severity = minor: workaround exists (use the per-cell link). But the panel's stated purpose is download access, so by that measure it's a partial failure of the Plan 04 feature.

## Hypothesized cause

`MessageItem.tsx` at `finalOutputFiles` rendering (per code review at ~line 255) likely uses a `<span>` or `<div>` for the filename instead of an `<a href={file.url}>`. The `url` field on `finalOutputFiles[*]` is populated by the backend (same source as per-cell delta), so the data is there — just not surfaced to the DOM.

Quick fix shape: wrap the filename in `<a href={file.url} target="_blank" rel="noopener">` with the same styling as the per-cell link (file-size badge, download icon, etc.), or render the same component used by `ExecuteCodeBlock.tsx` for per-cell links.

## Surface classification

`Agentic-RAG` — frontend rendering of the pinned final-outputs panel in chat.

## Suggested routing

Fold into **Phase 075.2** (cross-provider stability follow-up): wire download link into pinned 'Final outputs' panel + reuse the per-cell link component for visual consistency.

## Related

- 075.1-REVIEW.md IN-03 (origin of this finding)
- Phase 075.1 Plan 04 — `finalOutputFiles` feature
- D-067.2-03 — relative re-sign URL format used by the working per-cell link

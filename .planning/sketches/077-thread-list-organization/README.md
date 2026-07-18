---
sketch: 077
name: thread-list-organization
question: "How do 280+ threads get searched and grouped in the expanded panel?"
winner: null
status: reframed-by-078
tags: [phase-156, nav, thread-list, search, grouping, date-sections, folders, polish-01, seed-045]
phase: 156
---

# Sketch 077: Thread-List Organization

> ⚠ **Framing reframed by Sketch 078 (operator, 2026-07-16).** Organizing the list *inside* the sidebar
> doesn't fix the root problem — a growing nav and the chat history compete for one column's vertical space,
> and group headers add chrome to an already-starved region (you'd still see only 2–3 chats). **078** moves
> nav into a permanent icon rail + adds ⌘K so history gets real room. **This sketch is not discarded:** its
> search + date/folder grouping is the *content* that lives inside 078's winning history column. No winner
> was marked here.

## Design Question
Today the recent-chats list is a flat `threads.map` inside a `flex-1 overflow-y-auto` — no search, no
grouping, no sections (SEED-045 Anchor 2). With the operator's **280+ threads** it's an unwieldy scroll.
`Thread` already carries `title`, `folder_id`, and `updated_at`, and `Folder { id, name }` exists — so
**search + date/folder grouping is pure-frontend**. How should the expanded list be organized so any chat
is findable in seconds? (Carries Sketch 076 winner **B** forward — the search box is the same one that's
reachable from the collapsed rail.)

## How to View
open .planning/sketches/077-thread-list-organization/index.html

Type in the **Search** box on any variant — matches highlight, empty groups fold away, and an empty-state
appears when nothing matches. In B, click a folder header to collapse it. In C, flip the **Date ⇄ Folder** toggle.

## Variants
- **A: Date sections** — grouped under sticky **Today / Yesterday / Last 7 days / Last 30 days / Older**
  headers with counts; each row shows its folder chip. Time-first — matches how you actually reach for a recent chat.
- **B: Folder groups** — **collapsible** folder headers (folder icon + name + count) + an "Unfiled" group;
  each row shows a relative-date meta. Container-first — leans on the folders that already exist.
- **C: Search-first + Date⇄Folder toggle** — the synthesis: prominent search, plus a segmented toggle that
  switches the grouping model live. Most flexible; slightly more chrome + one more control to learn.

## What to Look For
- **Default mental model** — for 280+ threads, is *recency* (A) or *container* (B) the better resting default? Is C's toggle worth the extra control, or is picking one grouping cleaner?
- **Search behavior** — live-filter + highlight + empty-state + fold-empty-groups: does it feel instant and honest?
- **Section weight** — do the sticky uppercase headers read as calm structure, or as noise at this density?
- **Row content** — folder chip (A) vs relative-date meta (B): which secondary cue earns the space?
- **On-system feel** — same Deep Midnight tokens, same active/hover states as the real panel; search box continuity with Sketch 076-B.

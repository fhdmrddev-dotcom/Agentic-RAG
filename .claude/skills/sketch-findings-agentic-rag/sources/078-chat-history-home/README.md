---
sketch: 078
name: chat-history-home
question: "Where should chat history live so a GROWING nav never starves it — and 280+ chats stay findable?"
winner: "D — Synthesis (A's icon rail + C's ⌘K)"
tags: [phase-156, nav, thread-list, chat-history, ia, two-tier-rail, history-page, command-palette, space-competition, polish-01, seed-045]
phase: 156
supersedes_framing: 077
---

# Sketch 078: Chat History Home

## Design Question
Operator course-correction (2026-07-16): organizing the thread list *inside* the sidebar (Sketch 077)
doesn't fix the real problem — **app navigation and chat history are crammed into one vertical column and
compete for space, and the nav keeps growing** as we ship surfaces (Documents, Skills, Workflows,
Governance, Control Room, Analytics…). Each new nav row steals height from history; date/folder group
headers add *more* chrome to the already-starved region. Net: you see 2–3 chats before scrolling, and it
gets worse over time. **So: where should chat history live so nav growth can't starve it?** (077's search +
date/folder grouping isn't thrown away — it's the *contents* of whichever container wins here.)

## How to View
open .planning/sketches/078-chat-history-home/index.html

Each variant renders the **whole app frame** so you can judge how much vertical room history actually gets.
Search is live in all three (type → filter + highlight + empty-state). Variant C: press **⌘K / Ctrl-K** (or
the button) to open the finder; **Esc** closes.

## Variants
- **A: Two-tier rail + history column** — nav becomes a permanent **58px icon rail** (8 surfaces shown;
  add more, it never touches history) and the entire next column is dedicated chat history with search +
  date grouping. Nav growth is decoupled from history forever. *(VS Code / Slack / Linear pattern.)*
- **B: History as its own page** — the sidebar keeps only **Recent 5 + “See all →”**; the full 280+ live on
  a roomy, searchable **Chats page** (card grid, date/folder toggle) exactly like the Documents page already
  works. History gets a whole page, not a 300px slot.
- **C: Command palette (⌘K)** — sidebar stays tiny (recent 4); a prominent **Search all chats / ⌘K** opens a
  full-screen finder over everything, grouped, keyboard-forward. The backlog never has to live in the sidebar.

## Winner
**D — Synthesis: A's permanent icon rail + C's ⌘K** (operator, 2026-07-16). Nav lives in a 58px icon rail so
its growth never touches history; the history column owns the full height with an inline "filter this list"
box (077's search/grouping mechanics); and **⌘K** opens a global finder over the whole backlog. Two distinct
jobs — *the column filters what you're looking at; ⌘K jumps anywhere.* A, B, C preserved for reference; B's
full "Chats page" stays on the table as a future deep-history destination if the rail column ever feels tight.

## What to Look For
- **Does it actually solve the fear?** In each, how many chats are visible at rest vs. today's 2–3 — and does
  adding a 9th/10th nav surface change that? (A and C: no. B: no.)
- **Everyday cost** — A permanently trades nav *labels* for icons+tooltips (is that OK?). B adds a page you
  navigate *to* (one more click for deep history). C is keyboard-forward (great for power users; is it
  discoverable enough for everyone?).
- **Where do New Chat + Search belong** now that Sketch 076-B put them in reach? (A folds them into the
  history column header; B/C keep a New Chat in the sidebar.)
- **Combos are on the table** — e.g. **A + C** (icon rail *and* ⌘K), or **B + C** (recent sidebar + full page + ⌘K). Cherry-pick.
- **On-system feel** — same Deep Midnight tokens, active/hover states, motion as the real app.

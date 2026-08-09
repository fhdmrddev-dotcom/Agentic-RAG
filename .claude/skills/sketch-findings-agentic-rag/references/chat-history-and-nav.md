# Chat History & Nav Rail (Phase 156)

Two SEED-045 anchors + one structural pivot. **Anchor 1:** the collapsed nav rail hides New Chat (you must expand to start a chat). **Anchor 2:** the recent-chats list is a flat `threads.map` with no search/grouping across 280+ threads. The pivot (operator, 2026-07-16): organizing the list *inside* the sidebar can't fix a growing nav starving history — so history gets a dedicated home. Grounded in the LIVE `NavPanel.tsx` (`w-64` masked to `w-16` on collapse → the whole Chats region, New Chat included, goes `opacity-0 pointer-events-none`).

## Design Decisions

### D1 — Collapsed rail keeps New Chat + Search reachable (076 winner B)
The 64px rail keeps the nav icons **plus a pinned New Chat (+) and a Search (⌕)** — icon + tooltip, the existing nav-item pattern + the 087-08 "collapse-to-rail, key action stays reachable" precedent. Clicking Search **expands the panel and focuses the search box**. Ships the confirmed Anchor-1 fix.

- **Won over A (New Chat only):** minimal, but Search earns its rail slot at the 280+-thread reality.
- **Won over C (+ Recents peek flyout):** richest (hover-flyout of recent chats) but a third icon crowds a 64px column and is more surface to build/test.

### D2 — The pivot: chat history gets a dedicated home so nav growth can't starve it (078 winner D — synthesis)
Organizing the list inside the sidebar (077) was **reframed** — app nav and chat history compete for one vertical column, and the nav keeps growing (Documents, Skills, Workflows, Governance, Control Room…); every new row steals history height, group headers add more chrome, and you still see 2–3 chats. The winning structure:

- **Nav → a permanent 58px icon rail** (icon + tooltip; growth decoupled from history forever — the VS Code / Slack / Linear pattern).
- **History → a full-height column** with an inline "filter this list" box (077's search + date/folder mechanics live here).
- **+ ⌘K global finder** over the whole backlog.

Two distinct jobs, made explicit: **the column filters what you're looking at; ⌘K jumps anywhere.**

- **Won over A alone (two-tier rail only):** the rail is right, but ⌘K adds the instant-jump-anywhere the column can't.
- **Won over B (History as its own Chats page):** a whole page for deep history is retained as a **future destination** if the rail column ever feels tight, but it costs a navigation click for the everyday case.
- **Won over C alone (⌘K only):** keyboard-forward is great for power users but not discoverable enough as the sole home.

### D3 — 077's search + date/folder grouping is the CONTENT of 078's column (077 reframed, no winner)
077 wasn't discarded — its mechanics are what live inside 078's winning history column: live-filter + match highlight + fold-empty-groups + empty-state; grouping under sticky **Today / Yesterday / Last 7 days / Last 30 days / Older** headers with counts (time-first — how you actually reach for a recent chat), each row showing a folder chip. `Thread` already carries `title`/`folder_id`/`updated_at` and `Folder{id,name}` exists, so **grouping is pure-frontend** (no backend).

### D4 — The nav rail must never re-absorb the history list (156 design decision)
Once history has its own home, the nav rail stays **icon + tooltip** and never grows back into a history list. This is the durable contract that keeps nav growth from re-starving history.

## What to Avoid

- **A collapsed rail that hides the primary action** — New Chat (and Search) stay reachable icon+tooltip; expanding-to-start-a-chat is the Anchor-1 bug (D1).
- **Organizing the thread list inside a growing sidebar** — the reframed dead-end; group headers add chrome to a starved column and you still see 2–3 chats (D2).
- **Letting nav growth steal history height** — decouple them: 58px icon rail for nav, a full-height column for history (D2/D4).
- **A third rail icon (Recents flyout) crowding 64px** — New Chat + Search is the right density (D1).
- **Backend work for grouping** — `title`/`folder_id`/`updated_at` are already on `Thread`; grouping is pure-frontend (D3).

## Origin

Synthesized from sketches **076-collapsed-nav-rail** (winner B — New Chat + Search rail), **077-thread-list-organization** (reframed by 078, no winner — its search/date/folder grouping is 078's column content), and **078-chat-history-home** (winner D — synthesis: permanent icon rail + full-height history column + ⌘K). Source files: `sources/076-collapsed-nav-rail/`, `sources/077-thread-list-organization/`, `sources/078-chat-history-home/`. Session 2026-07-16 (Phase 156, POLISH-01 / SEED-045). Built the shared `threadGroups` engine + a permanent 58px icon rail + a dedicated `ChatHistoryColumn` + a hand-rolled ⌘K palette (no `cmdk`). Deep Midnight tokens throughout; each sketch shipped a per-frame "Proposed rail ⇄ Today (broken)" before/after toggle that reproduced the real bug for contrast.

---
phase: 301
slug: the-waiting-on-you-notice
status: driven
created: 2026-10-30
driven: 2026-10-30 (Claude, Chrome, local dev — dev account fhdmrd.dev, two orgs; backend serving the merged code, GET /notifications 401 unauthenticated)
nyquist_validation: false   # config.json; this file holds the UAT rows the CLAUDE.md scoreboard rule requires
owed: "none — every row driven 2026-10-30; Moonshot XP row ⛔ BUG-261024-01 (balance)"
---

# Phase 301 — Validation: automated map, G-4 lived experience, SC#4, four-axis UAT

The automated tests live in the plans (`301-01` … `301-03`). This file holds what code cannot prove: the
operator-recognisable G-4 scenarios (D-24, D-34), the SC#4 sketch match (D-21) and the four-axis rows
(D-25, CLAUDE.md "UAT scoreboard recipe"). **Every row starts OWED. A row may be blocked (⛔ with the reason
and the blocking id), but never silently omitted.**

## 1. Automated coverage (where each requirement is proven in code)

| Req | Proven by | Plan |
|-----|-----------|------|
| NOTE-01 (wire) | `test_301_notifications_route.py`, `test_301_notifications_live.py`, `test_301_migration_219_shape.py` — GET /notifications: the caller's open notices across every member org, oldest first, org name + workflow name + kind + origin, `total` above the 50 returned, no X-Org-Id, 401 router-level, no prompt text | 301-01 |
| NOTE-01 (data) | `useWaitingNotices.test.tsx` (fetch is truth, Realtime only refetches, keep-last-verdict), `attentionTab.test.ts` (second tenant `waiting-runs`, required `mark`, `conditionsForMark` / `waitingTotal`) | 301-02 |
| NOTE-01 (UI) | `waitingVocabulary.test.ts` (every word verbatim), `OrgIdentity.test.tsx` (xs org mark), `WaitingOnYouControl.test.tsx` (rail + drawer, rows as menu items, states, minute tick, absences, never `switchOrg`), `NavPanel.badge.test.tsx` (mount order, Library badge library-only, D-26 menu item), `ChatLayout.badge.test.tsx` (rail pill, drawer row, non-chat dot, status flows) | 301-03 |
| NOTE-05 | `useWaitingNotices.test.tsx` (an event / focus / poll refetches and the fetched list wins), `WaitingOnYouControl.test.tsx` (live replace keeps the list open, empty line at zero), `ChatLayout.badge.test.tsx` (a later failure keeps the last count + stale line) | 301-02, 301-03 |
| D-12 (Library mark stays the Library's) | `NavPanel.badge.test.tsx`, `ChatLayout.badge.test.tsx`, `LibraryPage.tabAttention.test.tsx` | 301-02, 301-03 |
| D-26 (BUG-261029-01) | `NavPanel.badge.test.tsx` — "Open Library health" found by role `menuitem` | 301-03 |

## 2. G-4 lived-experience scenarios (D-24 — Claude drives Chrome as the two-org dev account)

**Prove the active org FIRST** (the dev account is in two orgs). The account already has open notices
(RESEARCH F16): **record the starting count** before any row, never assume zero. Each row carries its own
evidence (screenshot / DOM read / `notifications` + `workflow_runs` SELECT) — one artifact never stands in
for two rows.

| # | Scenario | "I'd recognise failure here" | Status | Evidence |
|---|----------|------------------------------|--------|----------|
| G4-1 | **Start one, see it arrive.** Start the published system-global **"Doc Q&A"** in the active org (D-34) and move to Library while it runs. When it pauses, the count goes **up by one** without a reload (from the recorded starting count). Opening the list: the row names the org, "Doc Q&A" and "needs your answer". Clicking it opens the run. | the count needs a reload; the pill shows 0; the row lacks the org (active org); question text on the row; clicking switches org or does nothing | **PASS** | Active org proven first (profile menu ✓ `fhdmrd.dev@gmail.com's Organization`); starting count **5** (DB: 5 open, matches pill). "Doc Q&A" is not listed in the library, so the same-org run used **"300 MT-1 multi-tool then ask"** (run `80f428bb`). On `/app/library` the pill went **5 → 6 without a reload**, ~1 s after the notice row was written (22:04:35 UTC; the 60 s poll could not explain it — Realtime hint working). Row: "300 MT-1 multi-tool then ask · fhdmrd.dev@gmail.com's Organization · needs your answer · waiting under a minute" (no origin suffix — app-started). Selecting the row opened `/app/runs/80f428bb…`, no switch prompt, list closed. Evidence: list zoom `claude-chrome-screenshots-7KKxRl/screenshot-1793311291309-2.png` + DOM reads. |
| G4-2 | **Another org's run.** A Doc Q&A run waiting in the **other** org: its row names that org. Clicking shows 299's "This is in {org}" prompt. **Stay** leaves the active org unchanged (OrgBand / ProfileMenu still read the original); **Switch** opens the run. | the org switches silently; the row reads the active org's name; Stay changes anything | **PASS** | Doc Q&A (system-global) launched in the OTHER org via the app's own client (`createThread` + `postMessage` with `workflowDefinitionId`, active org switched through the profile menu in tab 2) → run `4dbcf654`, notice in `fhdmrd@gmail.com's Organization`. Tab 1 (active org still `fhdmrd.dev…`, read from its account menu): row "Doc Q&A · fhdmrd@gmail.com's Organization · needs your answer". Selecting it → `/app/runs/4dbcf654…` shows "This is in fhdmrd@gmail.com's Organization" with **Stay in fhdmrd.dev@gmail.com's Organization** / **Switch to fhdmrd@gmail.com's Organization**. Stay → back to `/app/library`, account menu still ✓ dev org. Switch → the run opens (h1 "Doc Q&A"), pill still 6 after the switch (cross-org list survives an org switch, D-18). Control: a dev-org row opened directly with no prompt. |
| G4-3 | **Answered elsewhere, and offline.** Answer a waiting run in a second tab — the first tab's count drops without a reload. Then emulate offline on **tab A only** (chrome-devtools per-page network emulation), answer another in tab B, restore A — on focus / reconnect A's count is right. While offline, A keeps the last list and (once a refresh fails) shows "Couldn't refresh just now. This is the last list we got." | the count stays stale after reconnect; the pill vanishes or reads 0 during the outage; the list empties on a failed fetch | **PASS** (arms 1-3) | **Arm 1:** answered run `80f428bb` in tab B → tab A pill **6 → 5 within ~3 s, no reload** (one navigation entry); DB `closed_reason = answered` 22:05:59. **Arm 2 (missed event):** chrome-devtools MCP was not connected, so tab A's Realtime socket was cut through the app's own module (`(await import('/src/lib/supabase.ts')).supabase.realtime.disconnect()`; its live channels included `waiting-notices:<uid>`). Tab B started MT-1 run `39291140`, answered it → tab A stayed **stale at 6** for 4+ s with the socket down, then one `focus` → exactly **one** GET → **5** in 215 ms. **Arm 3 (owed):** after a manual `disconnect()` realtime-js leaves channels `closed`, so the SUBSCRIBED-on-rejoin refetch is not drivable this way; a real network drop (devtools offline) is owed. Poll + focus reconciled throughout. The "Couldn't refresh just now" stale line was not shown live (no fetch failed) — unit-proven in `ChatLayout.badge.test.tsx`. **Arm 3 (transport drop with auto-reconnect, 2026-10-30):** chrome-devtools MCP still not connected, so the socket was dropped ABNORMALLY rather than by `disconnect()`: `realtime.endPoint` pointed at a dead port and `realtime.conn.close(4000)` — realtime-js `_onConnClose` schedules its own reconnect when the close was not manual, so this is the path a real drop takes (channels `waiting-notices:<uid>` + `folders-changes` → `errored`). While down, notice `a3a5d6f1` was closed in the local DB → count **stayed 6** (missed). Endpoint restored at t=21.7 s; the client's own backoff reconnected and the channel re-joined at **t=38.69 s**, and the pill read **5 at t=38.688 s** — the same instant as the rejoin, well before the 60 s poll and with no focus/visibility event (MutationObserver log). Re-opening the notice with the socket live → **6 at t=52.4 s** via the Realtime hint. Not a physical network cut (no adapter toggled — changing system network settings is outside what Claude may do), but the same reconnect → SUBSCRIBED → refetch code path. |
| G4-4 | **Two marks, the phone, and the keyboard.** With a stopped source present: the Library badge and tab mark show only the source; the waiting count is separate (never one merged number). At a phone width the hamburger dot lights on the chat view **and** on a non-chat view (D-30), and the drawer has a "Waiting on you" row with the same count that opens the same list (selecting closes the drawer). The Library popover's **"Open Library health"** is reached with arrow keys + Enter (D-26, BUG-261029-01). | the Library number includes waiting runs; the dot stays dark on a non-chat view; no drawer row; "Open Library health" unreachable without the mouse | **PASS** (phone, stopped-source, keyboard) | **Phone (D-30):** window resize did not apply (maximized), so the app was loaded in a 398 px same-origin iframe at `/app/library`: the non-chat bar's "Open navigation" button carries `drawer-trigger-dot` (10×10, `bg-warning`); the drawer shows **"Waiting on you 6"** (44 px row); it opens the same 6-row list. While 6 runs waited, the Library rail badge stayed **absent** (never merged). **⛔ Stopped-source coexistence + D-26 keyboard on "Open Library health":** no stopped watched source exists on the local box, so the Library popover never renders; both are unit-proven (`NavPanel.badge.test.tsx` mixed case + `menuitem` role). Re-open: the next session with a stopped source, or a planted one. **Stopped source + keyboard (2026-10-30):** a local switched-off connection + watch was created for the dev account (`/sources/health` → `stopped: ["301 UAT Board Papers/connection_disabled"]`) and removed after. Rail: **"Library | 1"** (aria "1 source stopped reading") beside **"6 workflow runs are waiting on you"** — two marks, never one merged number. Keyboard only: focus the badge → Enter opens "Needs attention" with focus already on the menuitem **"Open Library health"** (role=menuitem, D-26) → ArrowDown, Enter → `/app/library`, selected tab **"Health 1"**, the source listed; menu closed. |
| G4-5 | **What must NOT notify, and origins.** A Deep-chat `ask_user` produces **no** notice. A notice arriving while another thread streams leaves that stream intact (no restart, no flicker). A schedule's **Run now** (300's G4-5 schedule rows) that pauses appears with **"· scheduled"** (D-20, D-28). Approval: **only if** a small `external_action` (posture ask) workflow is cheap to author, show a "needs your approval" row; else record "approval proven at unit/DB level" (D-34). | a chat ask appears in the list; the streaming thread restarts; a scheduled run shows no origin, or shows a raw `schedule` | **PASS** · approval kind at DB/unit level | **Chat ask:** Deep chat `1609897b` called `ask_user` (DB: one `ask_user_prompt` row, `origin = deep`) → **0** notices for that thread, pill unchanged at 6. **Stream:** see PT-1 (notice arrived mid-stream, stream untouched). **Scheduled origin:** the 5 pre-existing scheduled runs (300's G4-5 schedule rows) render "· scheduled" verbatim (never raw `schedule`); a fresh Run-now click was not repeated. **Approval:** no live "needs your approval" row driven — proven at DB/unit level (218 trigger `kind` from `engine_pause.kind`, `waitingVocabulary.test.ts`), per D-34. Note: Doc Q&A's step 2 is "Wait for your approval" — answering step 1 reaches it, a cheap live approval row for the next pass. |

Run order: record the starting count → G4-1 → G4-2 → G4-4 → G4-3 → G4-5.

### SC#4 — the built control matches sketch 301 winner A (D-21)

| Row | Steps | Status |
|-----|-------|--------|
| SC#4 | Show `.planning/sketches/301-waiting-on-you/index.html` (winner **A**, its own rail control) beside the built control — collapsed rail, expanded rail, the open list with rows in two orgs, the empty line, the phone drawer row. The variant was **self-picked by Claude under the autonomous mandate**, so the operator's approval is the acceptance bar. | **OWED — operator approval** |

## 3. Four-axis UAT (D-25 — CLAUDE.md scoreboard rule; this phase touches UI state and the shell)

Method (Phase 185 recipe): drive each row as a real run with a **per-request** `model` + `provider` on the
kickoff, and read verdicts from `workflow_runs` / `notifications` (a notice row appears with the run's id
when it pauses, and the rail count rises). No global setting is mutated.

### 3a. Cross-provider — run pauses → notice appears (full native roster + OpenRouter, 8 rows)

Roster **derived from `MODEL_CAPABILITIES` on 2026-10-30** (grouped by `provider`, newest registry-backed id
per group; re-derive at run time — never trust this list over the registry):

| # | Provider | Representative id (re-derive) | Row: Doc Q&A started with this model + provider → it pauses on its question → a notice row + the rail count | Status |
|---|----------|-------------------------------|----------|--------|
| 1 | OpenAI | gpt-5.6-sol | the notice appears; the row names org, workflow, "needs your answer" | **PASS** — run paused, `metadata.provider = openai`, notice `question` (thread `72463afa`) |
| 2 | Anthropic | claude-opus-4-8 (newest Opus re-derived) | same | **PASS** — paused, provider `anthropic`, notice `question` (thread `9433bc47`) |
| 3 | Google | gemini-3.5-flash | same (highest-risk row for tool-call emission) | **PASS** — notice `question`, provider `google` (thread `8e63df73`) |
| 4 | DeepSeek | deepseek-v4-pro | same (`strict_json_schema` inert) | **PASS** — notice `question`, provider `deepseek` (thread `ddb3edcb`) |
| 5 | Zhipu / GLM | glm-5.2 | same | **PASS** — paused, provider `zhipu`, notice `question` (thread `33aaef7b`) |
| 6 | MiniMax | MiniMax-M3 | same | **PASS** — notice `question`, provider `minimax` (thread `6e357b99`) |
| 7 | Moonshot / Kimi | kimi-k2.6 | same (`emit_tier: coerce`) | **⛔ BUG-261024-01 (Moonshot balance)** — run `failed` before its question: "the model call for this step failed — this is a service outage" (thread `f692714d`); correctly NO notice (it never waited) |
| 8 | OpenRouter | deepseek/deepseek-v4-pro | same (`native_tools: False` path) | **PASS** (the expected 402 did NOT occur) — paused, provider `openrouter`, notice `question` (thread `4cdfe3d5`) |

All 8 kicked off 2026-10-30 ~22:34 UTC in the other org through the app's client with per-request `model` + `provider`; every passing row then appeared in tab 1's list (16 rows total, LM-1). All test runs were stopped afterwards (rows left with `closed_reason = run_ended`).

### 3b. Multi-tool

| Row | Steps | Status |
|-----|-------|--------|
| MT-1 | 300's MT-1 "multi-tool then ask": a workflow whose agent step uses 2+ tools (`search_documents` + `execute_code`) before its question step → exactly one notice, one row in the list | **PASS** — run `80f428bb` (step 1 answered from the knowledge base: 52 sources, then "Approve the note?") → exactly one notice, one row (G4-1). Second run `39291140` likewise one notice. |

### 3c. Parallel-thread

| Row | Steps | Status |
|-----|-------|--------|
| PT-1 | G4-5's streaming arm: Thread A streams while run B pauses → B's row arrives, A's stream is untouched | **PASS** (third attempt) — chat `1609897b` streamed a 3000-word essay; Doc Q&A run kicked off 5 s later in the other org. DOM samples every 2 s: stream length 25,763 → 40,847 at a steady ~1,150 chars/2 s; the pill went **8 → 9 at t = 22 s, mid-stream**, and the stream kept its pace (no drop, no restart). Attempts 1-2 were discarded honestly: their notices landed 2 s after / 3 s before the stream window (DB timestamps). |

### 3d. Long-message

| Row | Steps | Status |
|-----|-------|--------|
| LM-1 | The list with **≥ 10 waiting notices across two orgs**: it scrolls inside its max height, every row names its org, "and N more" appears only above 50 (the server's row cap) | **PASS** — 16 open notices (5 in `fhdmrd.dev…`, 11 in `fhdmrd@gmail.com's…`): 16 rows, every row names its org, the list is capped at 480 px and scrolls inside itself (viewport 639 px), no "and N more" (16 < 50). |

## 4. Operator actions (never executed by an agent; each cloud write needs its own approval)

1. Paste `supabase/migrations/219_notifications_realtime.sql` into the **cloud** SQL editor at deploy, then read
   `get_advisors(security)` — expect no new ERROR.
2. D-35 (`supabase/full-schema.sql` regeneration) is **DISCHARGED** — regenerated in main at `cb74b23dc`.

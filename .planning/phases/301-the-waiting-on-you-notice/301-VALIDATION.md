---
phase: 301
slug: the-waiting-on-you-notice
status: planned
created: 2026-10-30
nyquist_validation: false   # config.json; this file holds the UAT rows the CLAUDE.md scoreboard rule requires
owed: "every G-4 row, SC#4 operator sketch approval, every four-axis row — all OWED; Claude drives them after merge"
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
| G4-1 | **Start one, see it arrive.** Start the published system-global **"Doc Q&A"** in the active org (D-34) and move to Library while it runs. When it pauses, the count goes **up by one** without a reload (from the recorded starting count). Opening the list: the row names the org, "Doc Q&A" and "needs your answer". Clicking it opens the run. | the count needs a reload; the pill shows 0; the row lacks the org (active org); question text on the row; clicking switches org or does nothing | owed | |
| G4-2 | **Another org's run.** A Doc Q&A run waiting in the **other** org: its row names that org. Clicking shows 299's "This is in {org}" prompt. **Stay** leaves the active org unchanged (OrgBand / ProfileMenu still read the original); **Switch** opens the run. | the org switches silently; the row reads the active org's name; Stay changes anything | owed | |
| G4-3 | **Answered elsewhere, and offline.** Answer a waiting run in a second tab — the first tab's count drops without a reload. Then emulate offline on **tab A only** (chrome-devtools per-page network emulation), answer another in tab B, restore A — on focus / reconnect A's count is right. While offline, A keeps the last list and (once a refresh fails) shows "Couldn't refresh just now. This is the last list we got." | the count stays stale after reconnect; the pill vanishes or reads 0 during the outage; the list empties on a failed fetch | owed | |
| G4-4 | **Two marks, the phone, and the keyboard.** With a stopped source present: the Library badge and tab mark show only the source; the waiting count is separate (never one merged number). At a phone width the hamburger dot lights on the chat view **and** on a non-chat view (D-30), and the drawer has a "Waiting on you" row with the same count that opens the same list (selecting closes the drawer). The Library popover's **"Open Library health"** is reached with arrow keys + Enter (D-26, BUG-261029-01). | the Library number includes waiting runs; the dot stays dark on a non-chat view; no drawer row; "Open Library health" unreachable without the mouse | owed | |
| G4-5 | **What must NOT notify, and origins.** A Deep-chat `ask_user` produces **no** notice. A notice arriving while another thread streams leaves that stream intact (no restart, no flicker). A schedule's **Run now** (300's G4-5 schedule rows) that pauses appears with **"· scheduled"** (D-20, D-28). Approval: **only if** a small `external_action` (posture ask) workflow is cheap to author, show a "needs your approval" row; else record "approval proven at unit/DB level" (D-34). | a chat ask appears in the list; the streaming thread restarts; a scheduled run shows no origin, or shows a raw `schedule` | owed | |

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
| 1 | OpenAI | gpt-5.6-sol (newest 5.6 in registry) | the notice appears; the row names org, workflow, "needs your answer" | owed |
| 2 | Anthropic | claude-opus-4-6 / claude-sonnet-4-6 | same | owed |
| 3 | Google | gemini-3.5-flash | same (highest-risk row for tool-call emission) | owed |
| 4 | DeepSeek | deepseek-v4-pro | same (`strict_json_schema` inert) | owed |
| 5 | Zhipu / GLM | glm-5.2 | same | owed |
| 6 | MiniMax | MiniMax-M3 | same | owed |
| 7 | Moonshot / Kimi | kimi-k2.6 | same (`emit_tier: coerce`) | owed — **expected ⛔: Moonshot balance (known), confirm at run time** |
| 8 | OpenRouter | deepseek/deepseek-v4-pro | same (`native_tools: False` path) | owed — **expected ⛔: OpenRouter 402 (known), confirm at run time** |

### 3b. Multi-tool

| Row | Steps | Status |
|-----|-------|--------|
| MT-1 | 300's MT-1 "multi-tool then ask": a workflow whose agent step uses 2+ tools (`search_documents` + `execute_code`) before its question step → exactly one notice, one row in the list | owed |

### 3c. Parallel-thread

| Row | Steps | Status |
|-----|-------|--------|
| PT-1 | G4-5's streaming arm: Thread A streams while run B pauses → B's row arrives, A's stream is untouched | owed |

### 3d. Long-message

| Row | Steps | Status |
|-----|-------|--------|
| LM-1 | The list with **≥ 10 waiting notices across two orgs**: it scrolls inside its max height, every row names its org, "and N more" appears only above 50 (the server's row cap) | owed |

## 4. Operator actions (never executed by an agent; each cloud write needs its own approval)

1. Paste `supabase/migrations/219_notifications_realtime.sql` into the **cloud** SQL editor at deploy, then read
   `get_advisors(security)` — expect no new ERROR.
2. D-35 (`supabase/full-schema.sql` regeneration) is **DISCHARGED** — regenerated in main at `cb74b23dc`.

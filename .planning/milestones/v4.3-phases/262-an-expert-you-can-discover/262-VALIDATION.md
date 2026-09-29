---
phase: 262-an-expert-you-can-discover
type: validation
requirements: [PACK-11, PACK-12, PACK-13]
ui_hint: yes
g4_lived_experience: required
sc10_cross_provider_board: NOT REQUIRED — reason recorded below
authored: 2026-09-22 (planner, at plan time — never post-hoc)
driver: operator (browser), with the agent reading DB/log evidence
---

# Phase 262 — UAT / VALIDATION

⛔ **These rows are authored HERE, never as PLAN.md tasks**, and they were written at plan time
rather than after the build — G-4's rule is that "I'd recognise failure here" scenarios are defined
at scope time, because a scenario invented after the code exists tends to describe the code.

⛔ **EVERY ROW OWES ITS OWN EVIDENCE.** A row is PASS only with something quoted: a screenshot, a
DB query output, a network response, or a verbatim rendered string. *"It looked right"* is not a
result. A row that could not be driven is recorded ⛔ BLOCKED with the reason and the blocking id —
never dropped, because a scoreboard that lists only what passed is not a scoreboard.

---

## 0 · PRECONDITIONS — resolve these BEFORE row 1, or a correct build reads as broken

### P-A ⛔ The org's subscription tier must grant `experts`

`supabase/migrations/186_tier_capabilities.sql:72` is the ONLY row granting the `experts`
capability, and it grants it to **`enterprise` alone** — no `standard`, no `pro`, no `free`. And
`backend/app/db/entitlements.py:152-156` **fails CLOSED on a NULL tier**. Memory from Phase 258
records *"2 of 2 prod orgs had a NULL tier."*

⚠ **If this is unresolved, `GET /experts` returns 403 and the catalog renders its refusal — which is
CORRECT BEHAVIOUR that will be reported as a build defect.** Plan 01 task 3 measures it and writes
`262-TIER-PRECONDITION.md`, including the exact one-statement remedy SQL if needed.

- [ ] Read `262-TIER-PRECONDITION.md`. If its verdict is REFUSED, the OPERATOR pastes the recorded
      SQL into the **local** Supabase SQL editor (dev data; never `supabase db push`, never the
      production MCP).
- [ ] Re-check: `GET /experts` as `fhdmrd@gmail.com` returns 200.

### P-B ⛔ The honesty fixture must be authored at `visibility = 'granted'`

RESEARCH §6 traced the predicate in `db/experts.list_expert_bundles_for_caller:277-293`: **the grant
check bites ONLY for `visibility = 'granted'`.** An Expert at `'org'` or `'public'` is visible to
every org member no matter what grants exist.

⛔ **A PACK-11 row that grants nothing and leaves `visibility = 'org'` will show the card and read as
a failure of the criterion when it is a correct read of the data.** Author the fixture Expert with
`visibility: 'granted'` in the Authoring Studio, then grant it to the author only.

### P-C · The two real accounts

Phase 264's UAT proved a genuine two-member org exists. ⛔ Use real accounts, not fixtures.

| Role | Account | Org |
|---|---|---|
| author / grant holder | `fhdmrd@gmail.com` | `22f9c615…` |
| plain member, holds nothing | `fhdmrd.dev@gmail.com` | `22f9c615…` |

### P-D · Local infra up

- [ ] `powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1` — Postgres 54322,
      Redis 6379 and the API 54321 each accept a real TCP connection. ⚠ If a port refuses, read
      CLAUDE.md's Windows port-reservation trap before suspecting Docker or Supabase.
- [ ] Backend and frontend running; the operator starts the backend.

---

## 1 · The G-4 lived-experience bar (defined at scope time)

The three things a person would *recognise* as failure on this surface:

1. **"It shows me Experts I can't actually use."** A card that is visible and then refuses, or a
   card dressed as locked with an upgrade nudge. Either is the brochure-for-a-locked-door failure.
2. **"I still don't know what this thing does."** A detail view of empty sections, counts instead of
   names, or `undefined` on screen.
3. **"I clicked Start Chat and the Expert wasn't there."** A thread that opens without the spotlight,
   or one that loses it when the person clicks back into it from the history column.

---

## 2 · The scoreboard

### SC#1 / PACK-11 — every Expert they may use, and none they may not

| # | Row | Drive it | Expected | Evidence owed | Result |
|---|---|---|---|---|---|
| 1.1 | The catalog opens from the rail | As `fhdmrd@gmail.com`, click the ✨ Experts entry | The catalog renders with cards; no URL was typed | Screenshot of the rail + the catalog | |
| 1.2 | The catalog opens from the mobile drawer | Narrow the window to mobile width, open the drawer, click Experts | Same surface — the entry is in `NAV_ITEMS` so the drawer gets it from the same array | Screenshot at mobile width | |
| 1.3 | The catalog opens from the composer | In a chat, open the `+` menu, choose `Browse Expert Catalog…` | The catalog view opens | Screenshot of the open `+` menu showing BOTH expert items | |
| 1.4 | ⛔ **THE VANISH** | Author an Expert at `visibility: 'granted'` (P-B), grant it to `fhdmrd@gmail.com` only. Sign in as `fhdmrd.dev@gmail.com` and open the catalog | **The card is ABSENT.** ⛔ Not greyed, not disabled, not badged, no "request access", no upgrade nudge | Two screenshots side by side (author sees it / member does not) **plus** the `GET /experts` response body for the member, showing the bundle absent from the JSON | |
| 1.5 | The positive control for 1.4 | Grant the same Expert to `fhdmrd.dev@gmail.com`, reload the catalog | The card APPEARS | Screenshot + the member's `GET /experts` body now containing it. ⚠ Without this arm, 1.4 passes against a catalog that renders nothing | |
| 1.6 | No consolation prize | On the member's catalog in 1.4, search the rendered page for "locked", "upgrade", "unlock", "request access" | None present | Browser find-in-page count, or the page text | |
| 1.7 | The honest refusal | Temporarily set the org tier to one WITHOUT `experts` (dev data, operator, reversible), reload the catalog | An honest refusal sentence and **ZERO** cards | Screenshot + the 403 body. ⚠ Restore the tier afterwards and say so | |
| 1.8 | Search and category | Type part of one Expert's name; then pick a category pill | The grid narrows both times; the pills are the categories the org's rows actually carry | Screenshot before/after | |

### SC#2 / PACK-12 — the detail view carries what it does, when to use it, what it reads, what it needs, and its prompts

⛔ **Every row here is asserted on RENDERED TEXT.** D-262-05 and the ROADMAP are explicit: *"the
rendered content is asserted, never the presence of a block."*

| # | Row | Drive it | Expected | Evidence owed | Result |
|---|---|---|---|---|---|
| 2.1 | It opens | Click `Details` on a card | The modal opens over the catalog; Escape and the backdrop both close it | Screenshot | |
| 2.2 | `when_to_use` | Author a distinctive when-to-use sentence in the Studio, then open the modal | That exact sentence is on screen | Screenshot with the sentence legible, plus the authored value from the DB row | |
| 2.3 | ⭐ `example_output` — **the field that renders in ZERO components today, admin included** | Author a distinctive multi-line example output, open the modal, expand the Sample Deliverable disclosure | The exact string is revealed | Screenshot collapsed AND expanded | |
| 2.4 | Knowledge folders by NAME | Bind two folders the caller can see | Both folder NAMES are on screen. ⛔ Not "2 folders" | Screenshot + the `knowledge_folder_ids` from the DB row | |
| 2.5 | ⛔ The folder that legitimately has no name | Open the modal for the seeded system Expert from an org that is NOT `430bffc6…` (its folder is seeded into that org alone, `mig 188:29-37`) | The words **"a knowledge folder you cannot see"**. ⛔ Never a blank row, never a silently shorter list | Screenshot | |
| 2.6 | Skills and connections by name | Bind a skill and a required connection | Both strings on screen, verbatim | Screenshot | |
| 2.7 | Prompt suggestions | Author two prompt suggestions | Both titles and both prompts on screen | Screenshot | |
| 2.8 | Icon and category | Author `icon: scale`, `category: Legal & Compliance` | The Scale glyph and that category, on the card AND in the modal. ⛔ Not 📊, and not derived from the name | Screenshot of an Expert whose NAME contains "financial" but whose `icon` is `scale` — it must show Scale | |
| 2.9 | Honest empties | Open the modal for an Expert with no `when_to_use` and no `example_output` | Each section carries an honest line; the word "undefined" appears nowhere | Screenshot | |
| 2.10 | No clone door | Inspect the modal footer | Two controls: Close and Start Scoped Chat. ⛔ No `Clone & Customise`, not even disabled | Screenshot | |

### SC#3 / PACK-13 — one action starts a scoped conversation

| # | Row | Drive it | Expected | Evidence owed | Result |
|---|---|---|---|---|---|
| 3.1 | ⛔ **ONE ACTION** | From the open modal, click `Start Scoped Chat with Expert` | A new chat thread opens with the Expert's spotlight card already showing — **one click, no intermediate dialog, no second confirmation** | Screencast or two screenshots (modal → thread) | |
| 3.2 | The server agrees | Immediately query `threads` for that row | `active_expert_id` equals the Expert's id | The query output | |
| 3.3 | ⛔ **It survives leaving and coming back** | Navigate to another view, then click that thread in the history column | The spotlight is STILL there. ⚠ This is the `refreshThreads`-before-`selectThread` ordering; without it the list row holds `active_expert_id: null` and the spotlight clears while the server still holds the Expert | Screenshot after the round trip | |
| 3.4 | It is the SAME mechanism | Compare against the shipped path: invite the same Expert from the composer's `Invite Expert...` | Both produce the same `active_expert_id` on the thread and the same spotlight — ⛔ not a second mechanism | The two thread rows | |
| 3.5 | A prompt tile runs | Click one of the Expert's action tiles in the new thread | The prompt executes and the answer is scoped as expected | Screenshot of the answer | |
| 3.6 | Failure is honest | With the backend stopped, click `Start Scoped Chat` | It does NOT land in an unscoped chat pretending to be scoped; an error is visible | Screenshot | |

### 3 · Regression rows — the surfaces this phase edited but does not own

| # | Row | Expected | Result |
|---|---|---|---|
| R.1 | `Invite Expert...` from the composer still works end to end | Unchanged behaviour, new glyph (the icon now comes from the `icon` column) | |
| R.2 | The spotlight card for an Expert WITH prompt suggestions | Its own tiles, unchanged | |
| R.3 | ⛔ The spotlight card for an Expert with NO prompt suggestions whose name contains "financial" | **No** "Q3 Revenue Growth YoY" / "Gross Margin Comparison" / "Operating Cash Flow"; **no** "SEC Filings & Reports"; **no** "ratio_calculator" unless it is that Expert's own first skill | |
| R.4 | The org admin's Experts tab | Byte-identical behaviour after the icon extraction (a pure move) | |
| R.5 | Every other nav entry | Chat, Workflows, Library, Classification, Connections, Skills, Settings all still land where they did | |
| R.6 | An unknown view | Nothing regressed the trailing fallback: the app still renders "This view has no screen: …" rather than a wrong product page | |

---

## 4 · SC#10 — the cross-provider 4-axis board

**DECISION: NOT REQUIRED for Phase 262, and here is the reason rather than a silence.**

ROADMAP SC#10 requires the 4-axis board for *"any phase touching streaming, agent loop, provider
routing, or UI state."* Measured against this phase's plan set:

- **Streaming** — untouched. No plan modifies `StreamsProvider.tsx`, `streamsStore.ts`, SSE parsing
  or any run buffer.
- **Agent loop** — untouched. `agent_loop.py`, `tool_dispatcher.py` and `run_producer.py` appear in
  no `files_modified`. ⭐ PACK-01's *"an Expert is a manifest, not a runtime"* is preserved by
  construction: this phase adds zero backend source files.
- **Provider routing** — untouched. No `MODEL_CAPABILITIES`, no `provider_gateway`, no dispatcher.
- **UI state** — ⚠ this is the one axis worth arguing, and the argument is stated rather than
  assumed. The phase adds an `ActiveView` member and one optional prop to `ChatArea`/`MessageInput`.
  It writes no streaming state, no per-thread lock, no run anchor. The thread-scoping write it does
  make (`active_expert_id`) is the seam Phase 260 already shipped and already UAT'd, reached from a
  different door.

⚠ **So the board is skipped BY DECISION, not by omission** — and rows 3.4 and 3.5 above are the
substitute: they prove the new door produces the same thread state as the shipped one, and that a
real prompt runs through it. ⛔ If execution ends up touching any backend file or any streaming
surface, this decision is void and the full eight-row native roster is owed.

---

## 5 · Closing this file honestly

- [ ] Every row above carries a result and its evidence, or ⛔ BLOCKED with a reason and an id.
- [ ] Rows 1.4 and 1.5 were driven with **two real sign-ins**, not one session with a toggled fixture.
- [ ] Row 1.7's temporary tier change was REVERSED, and the reversal is stated.
- [ ] D-262-10's flagged edge is raised with the operator: the catalog's refusal state renders the
      server's own `upgrade_hint` sentence, matching the shipped `InviteExpertDialog.tsx:102-106`.
      This was the PLANNER's call, not the operator's, and it is the one place this phase touches
      the no-upsell ruling's edge. Cheap to reverse; get a yes or a no.
- [ ] Any row closed as owed-but-not-driven is recorded in `STATE.md` and the ROADMAP progress row,
      naming which row to run first.

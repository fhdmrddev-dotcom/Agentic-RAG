---
phase: 297-every-view-has-an-address
artifact: VALIDATION
seeded_by: 297-04 (Task 3, 2026-10-27)
status: passed
rows_total: 16
rows_run: 15
rows_blocked: 1
run_on: 2026-10-28 (develop 1e5a54680 + 3e73d3730, local stack, Chrome MCP)
---

# Phase 297 — Every View Has an Address: VALIDATION (owed UAT)

✅ **RUN 2026-10-28 — 15 PASS, 1 ⛔ (P7 Moonshot, live 429).** The seeding note below is kept as written.

⛔ ~~**EVERY ROW BELOW IS OWED AND UNCHECKED.**~~ This file was seeded by plan 297-04 as scaffolding. No
row has been run: the seeding executor started no backend, drove no browser, and wrote nothing to
Supabase. A Verdict cell is filled only by the session that drives the row, with that row's own
evidence. Rows run at `/gsd:verify-work 297`.

What the automated suites already cover (not a substitute for the rows below):
`appRouteParity.test.ts` (LINK-08, three routing layers, planted-RED in `evidence/297-04-planted-red.txt`),
`navigationKeepsStreams.test.tsx` (six navigations, one subscription, in jsdom),
`appRoutes.test.ts`, `useAppNavigation.test.tsx`, `AppViewSwitch.addressStates.test.tsx`.

## Four-axis UAT (D-27)

Phase 297 touches UI state and the streaming surface (the router sits above `StreamsProvider`), so
the CLAUDE.md four-axis bandwidth applies.

**Roster — derived, not re-typed.** `backend/app/config.py` `MODEL_CAPABILITIES` grouped by
`provider`, newest id per group by `scripts/sc10_188_run_board.py` `_version_key` (the rule
`run-273-board.py` `derive_roster` uses), deprecated ids skipped. Derived 2026-10-27 from the SEED
only:

| provider | seed pick | tied at the top | group size | native_tools | emit_tier |
|---|---|---|---|---|---|
| openai | `gpt-5.6-luna` | gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna | 17 | True | force_strict |
| anthropic | `claude-sonnet-5` | — | 7 | True | force |
| google | `gemini-3.5-flash` | — | 7 | True | force |
| deepseek | `deepseek-v4-pro` | deepseek-v4-flash, deepseek-v4-pro | 2 | True | force |
| zhipu | `glm-5.2` | — | 8 | True | force |
| minimax | `MiniMax-M3` | — | 8 | True | force |
| moonshot | `kimi-k2.6` | — | 3 | True | coerce (the weakest emission guarantee) |
| openrouter | `z-ai/glm-5.2` | — | 9 | False (the non-native tool path) | force |

⚠ **Re-derive at run time, with the DB overlay.** Capabilities are data (Phase 262): the Model
Registry overlay can carry newer ids than the seed. 293's run-time derivation (seed ∪ overlay) picked
different ids for five of the eight providers (anthropic `claude-opus-5-5`, google
`gemini-3.8-flash`, zhipu `glm-5.3-flash`, moonshot `kimi-k3.1-pro-highspeed`, openrouter
`deepseek/deepseek-v4.1-flash`; `293-VALIDATION.md` §2). The session that runs this board re-derives with `derive_roster` and
records the id it actually drove. A registry-backed id is required: an id absent from the registry
resolves `capability_source=inferred` and loses `emit_tier`.

**Scenario (every provider row):** a chat answer from this provider keeps streaming across six
navigations (Library → Workflows → Back → Forward → Settings → Back). Pass = the answer is intact
and still streaming or complete when chat is back on screen, with no gap, no duplicate and no
restarted run.

**Method (every provider row):** per-request `model` + `provider` on `POST /threads/{id}/messages`;
no global setting mutated. Navigate with the rail and the browser's own Back/Forward while the answer
streams. Read the verdict from the rendered message and from the run's events, not from the wire
alone.

**Rows may be blocked, but never silently omitted.** A provider with no key or a known defect is
recorded as ⛔ with the reason and the blocking issue id. The "last known" notes below were NOT
re-probed by the seeding executor; they are what earlier phases recorded, so the runner checks them
first.

| # | Provider | Model (seed pick; re-derive) | Scenario | Method | Last known (not re-probed) | Verdict | Evidence |
|---|---|---|---|---|---|---|---|
| [x] P1 | OpenAI | `gpt-5.6-luna` (driven) | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | local `openai_api_key` set (294, presence only) | ✅ PASS | thread `54f8ac14`; samples `0:S30 1:S30 2:S1 3:S16 NAV-DONE 4:S20 5:-20…` (streaming before and after the six navigations, then complete); DB: 2 user / 2 runs completed / 2 answers, items [30, 20] |
| [x] P2 | Anthropic | `claude-opus-5-5` (re-derived) | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | billing block recorded at 288/289 | ✅ PASS | thread `3025be0f`; samples `0:S30… NAV-DONE 4:S20 … 27:S20 28:-20` (streaming across the navigations, complete at 20); DB: 2 runs completed, items [30, 20]. First drive's nav log was lost to a 45 s CDP timeout, so it was re-driven |
| [x] P3 | Google | `gemini-3.8-flash` (re-derived) | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | historically the highest-risk row for tool-call emission | ✅ PASS | thread `6eedd30e`; re-drive samples `NAV-DONE 4:-2 5:S20 6:-20…`; no-nav control `4:S30 5:S20 … 26:-20`; DB: 3 runs completed, items [30, 20, 20]. ⚠ first drive's sampler counted 0 items 1.5 s after return; the answer was complete on screen afterwards (sampler artifact suspected, see note O-1) |
| [x] P4 | DeepSeek | `deepseek-v4-pro` (driven) | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | `strict_json_schema` inert (D-122-04) | ✅ PASS | thread `f3a07750`; samples `2:S0 3:S0 NAV-DONE 4:-0 5:S20 6:S20 7:S20 8:-20…`; DB: 1 run completed, items [20] |
| [x] P5 | Zhipu / GLM | `glm-5.3-flash` (re-derived) | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | — | ✅ PASS | thread `39d16564`; samples `2:S0 3:S0 NAV-DONE 4:S20 … 32:S20 33:-20`; DB: 1 run completed, items [20] |
| [x] P6 | MiniMax | `MiniMax-M3` (driven) | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | — | ✅ PASS | thread `83fd0e35`; samples `0:S0…3:S0 NAV-DONE 4:-2 5:S20 … 10:S20 11:-20`; DB: 1 run completed, items [20] |
| [⛔] P7 | Moonshot / Kimi | `kimi-k3.1-pro-highspeed` (re-derived) | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | account suspended for insufficient balance at 292.1 | ⛔ BLOCKED — BUG-261024-01 | live `--probe` 2026-10-28: `RateLimitError 429` account suspended for insufficient balance (evidence/roster/) |
| [x] P8 | OpenRouter | `deepseek/deepseek-v4-pro` (re-derived; registry-backed `deepseek/*`) | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | 402 out of credits at 292.1 | ✅ PASS | live `--probe` 2026-10-28 completed (the 402 is gone); thread `6a49e1c8`; samples `0:S0…3:S2 NAV-DONE 4:-2 5:S20 6:-20…`; DB: 1 run completed, items [20] |

| # | Axis | Scenario | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| [x] A1 | Multi-tool | One prompt that needs 2+ tools (e.g. `search_documents` + `execute_code`), and the answer keeps streaming across the same six navigations (Library → Workflows → Back → Forward → Settings → Back); every tool card is present once, in order, when chat is back | per-request `model` + `provider` on POST /threads/{id}/messages (the OpenAI row's model unless that row is ⛔); no global setting mutated | ✅ PASS | thread `297UAT A1 openai` (gpt-5.6-luna); tool cards 1→2 across `NAV-DONE`, then folded into the collapsed run card; expanded: "Searching documents", "Executing code", once each in order; DB: 1 run completed, tool_calls `[search_documents, execute_code]`, answer cites the revenue rows and 391 |
| [x] A2 | Parallel-thread (**LOAD-BEARING**) | Thread A streams an answer while thread B is opened by its `/app` address (pasted into the bar, then by Back/Forward between the two); A's answer is intact when A is reopened, B accepts a new prompt, and neither run is restarted or cross-wired | two threads, per-request `model` + `provider` on each POST /threads/{id}/messages; no global setting mutated | ✅ PASS (deviation: B opened from the history list — thread addresses are Phase 299) | A `556e9508` 40-item maps answer streaming; B opened and sent from the real composer while A streamed; Library/Back/Workflows/Back/Forward/Back; A reopened with 40 items, B shows its own milestone sentence, no maps list; DB: A 1 run (40 items), B 1 run (milestone), no cross-wiring. The "Stop run" seen in B is A's own history-row control (`ChatHistoryColumn.tsx:260`) |
| [x] A3 | Long-message | A thread with ≥ 50 prior messages, OR a ≥ 5 KB prompt, streams across the six navigations; the history renders complete and the new answer lands at the end | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated; manual per CLAUDE.md (long-message stays manual per provider) | ✅ PASS | 5,963-byte prompt on deepseek-v4-pro across the six navigations; screen: prompt rendered in full, 10-point answer; DB: 1 run completed, user 5963 bytes, assistant 10 items |

## G-4 lived-experience rows (D-28, D-44)

Set at scope time (D-28), plus the fifth row from UI-SPEC (D-44). Verbatim.

| # | Scenario | Verdict | Evidence |
|---|---|---|---|
| [x] G1 | Paste `/app/workflows` into a fresh tab → Workflows opens; refresh stays on Workflows. | ✅ PASS | fresh tab → `/app/workflows`, h1 "Workflows"; `location.reload()` → navigation type `reload`, still `/app/workflows` / "Workflows" (run before and after the review fixes) |
| [x] G2 | Start a chat answer, then Library → Workflows → Back → Back → Forward → Back → the answer is intact and still streaming or complete, no gap. | ✅ PASS | thread `12b1ffd5` (UI composer): Library → Workflows → Back → Back → Forward → Back read `/app/library, /app/workflows, /app/library, /app, /app/library, /app`; Stop visible at the end; 40 items, 0 duplicates; DB: 1 run completed, 1 answer (4,768 chars) |
| [x] G3 | Edit a workflow draft, press browser Back → asked; Cancel keeps the edit; OK leaves. | ✅ PASS | Builder draft, requirement field edited, Back within the 1 s autosave window, `window.confirm` stubbed: dirty+Cancel → 1 call, stayed `/app/workflows`, edit kept; dirty+OK → 1 call, left to `/app/library`; clean → 0 calls. Draft text restored afterwards |
| [x] G4 | An old `/app?run=<id>` link → the run opens and the bar reads `/app/runs/<id>`. | ✅ PASS | `/app?run=e98457c0-…` → bar reads `/app/runs/e98457c0-6033-48c4-b4ca-b37646fbb7dd`, no query; heading "293 board: deepseek" matches the run's `definition_snapshot.name`; sampled every 100 ms after the WR-03 fix: no S1 / no-screen flash |
| [x] G5 | Paste `/app/nonsense` → S1 shows inside the layout; "Go to Chat" opens chat; Back returns to S1. | ✅ PASS | `/app/nonsense` → "This address doesn't open anything", rail present, path not echoed; "Go to Chat" → `/app` with composer; Back → `/app/nonsense` S1 again (before and after fixes) |

**Note on G3:** Chrome MCP stubs window.confirm (counts calls, returns false then true) instead of
raising a native dialog, which would wedge the extension; the operator may run the native dialog by
hand.

**Note on G5:** S1 is the "This address doesn't open anything" state (UI-SPEC S1, `AddressNotFound`).
The requested path is never echoed on screen. While S1 shows, the rail highlights Chat; that is
accepted under D-43 (`NavPanel.tsx` is not edited in 297; Phase 299 corrects it).

---

Chrome MCP drives rows G1-G5. A wire format or a screenshot alone is not a pass (G-4): each row
needs the rendered outcome it names, read from the DOM or the run's own record, with its own
evidence.

## Run notes (2026-10-28)

- **Method.** Provider rows: thread created and kickoff `POST /threads/{id}/messages` sent from the page with a per-request
  `model` + `provider` (no global setting touched), then the thread opened in the UI and the six navigations driven with the rail
  and `history.back/forward`; the screen sampled once a second (`S` = a Stop control visible, number = items in the newest list).
  Verdicts read from the rendered list and from `runs` / `messages` in the local DB. Roster re-derived with the DB overlay
  (`run-296-board.py --roster`, output in `evidence/roster/`).
- **O-1 (observation, not a fail).** The `S` marker counts ANY Stop control, including a running thread's own row in the history
  column, so it over-reads "streaming". And P3's first drive read 0 items 1.5 s after returning to chat although the answer
  completed intact; the no-nav control and the re-drive both rendered progressively. Watch for it, don't treat it as a pass reason.
- **Test data.** Threads titled `297UAT …` (11) and two `297 P1 openai` threads from a first attempt are local dev rows; deletable.

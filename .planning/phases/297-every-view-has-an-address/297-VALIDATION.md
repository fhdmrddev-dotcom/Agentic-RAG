---
phase: 297-every-view-has-an-address
artifact: VALIDATION
seeded_by: 297-04 (Task 3, 2026-10-27)
status: owed
rows_total: 16
rows_run: 0
---

# Phase 297 — Every View Has an Address: VALIDATION (owed UAT)

⛔ **EVERY ROW BELOW IS OWED AND UNCHECKED.** This file was seeded by plan 297-04 as scaffolding. No
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
| [ ] P1 | OpenAI | `gpt-5.6-luna` | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | local `openai_api_key` set (294, presence only) | | |
| [ ] P2 | Anthropic | `claude-sonnet-5` | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | billing block recorded at 288/289 | | |
| [ ] P3 | Google | `gemini-3.5-flash` | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | historically the highest-risk row for tool-call emission | | |
| [ ] P4 | DeepSeek | `deepseek-v4-pro` | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | `strict_json_schema` inert (D-122-04) | | |
| [ ] P5 | Zhipu / GLM | `glm-5.2` | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | — | | |
| [ ] P6 | MiniMax | `MiniMax-M3` | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | — | | |
| [ ] P7 | Moonshot / Kimi | `kimi-k2.6` | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | account suspended for insufficient balance at 292.1 | | |
| [ ] P8 | OpenRouter | `z-ai/glm-5.2` | a chat answer from this provider keeps streaming across six navigations (Library → Workflows → Back → Forward → Settings → Back) | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated | 402 out of credits at 292.1 | | |

| # | Axis | Scenario | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| [ ] A1 | Multi-tool | One prompt that needs 2+ tools (e.g. `search_documents` + `execute_code`), and the answer keeps streaming across the same six navigations (Library → Workflows → Back → Forward → Settings → Back); every tool card is present once, in order, when chat is back | per-request `model` + `provider` on POST /threads/{id}/messages (the OpenAI row's model unless that row is ⛔); no global setting mutated | | |
| [ ] A2 | Parallel-thread (**LOAD-BEARING**) | Thread A streams an answer while thread B is opened by its `/app` address (pasted into the bar, then by Back/Forward between the two); A's answer is intact when A is reopened, B accepts a new prompt, and neither run is restarted or cross-wired | two threads, per-request `model` + `provider` on each POST /threads/{id}/messages; no global setting mutated | | |
| [ ] A3 | Long-message | A thread with ≥ 50 prior messages, OR a ≥ 5 KB prompt, streams across the six navigations; the history renders complete and the new answer lands at the end | per-request `model` + `provider` on POST /threads/{id}/messages; no global setting mutated; manual per CLAUDE.md (long-message stays manual per provider) | | |

## G-4 lived-experience rows (D-28, D-44)

Set at scope time (D-28), plus the fifth row from UI-SPEC (D-44). Verbatim.

| # | Scenario | Verdict | Evidence |
|---|---|---|---|
| [ ] G1 | Paste `/app/workflows` into a fresh tab → Workflows opens; refresh stays on Workflows. | | |
| [ ] G2 | Start a chat answer, then Library → Workflows → Back → Back → Forward → Back → the answer is intact and still streaming or complete, no gap. | | |
| [ ] G3 | Edit a workflow draft, press browser Back → asked; Cancel keeps the edit; OK leaves. | | |
| [ ] G4 | An old `/app?run=<id>` link → the run opens and the bar reads `/app/runs/<id>`. | | |
| [ ] G5 | Paste `/app/nonsense` → S1 shows inside the layout; "Go to Chat" opens chat; Back returns to S1. | | |

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

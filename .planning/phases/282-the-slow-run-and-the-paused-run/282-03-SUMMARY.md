---
phase: 282-the-slow-run-and-the-paused-run
plan: 03
subsystem: uat
tags: [uat, sc10, g4, chrome-mcp, cross-provider, live-evidence, ledger, gates, close]

requires:
  - phase: 282-01
    provides: "FIX-06: timeout reaches every client family; 1800 ceiling + refusal sentence"
  - phase: 282-02
    provides: "FIX-07: one answer input, one draft (askDraftStore, AskPointer)"
provides:
  - "Merged-tree gates recorded (backend 71 = base set, vitest count gate OK 0 failing, tsc multiset == base)"
  - "Hot-file ledger + CLAUDE.md rows re-derived for 20 files; 3 rows added"
  - "SC#10 8-row board: 6 PASS, 2 blocked on billing, 0 FAIL; all three extra axes covered"
  - "G-4 rows 1, 2, 3, 5 PASS on DOM state; rows 4 and 6 OWED by decision"
  - "BUG-260918-01 and BUG-261015-02 closed on evidence; BUG-261015-03 / -04 filed"
affects: [282-04, ROADMAP 282, STATE, reported-bugs, SEED-172]

requirements-completed: [FIX-06, FIX-07]

duration: ~3h (incl. one blocked resume)
completed: 2026-10-15
---

# Phase 282 Plan 03: Gates, the SC#10 board and the G-4 rows

**Both fixes were driven live on the merged tree. Six of eight providers paused, took an answer and finished; the two that did not were out of credit. Each of the four lived-experience rows the UI fix owns passed when read from the DOM. The operator approved sketch A and the interaction details.**

## Commits

| Commit | What |
|---|---|
| `f3846d354` | Task 1: ledger re-derive for 20 files, CLAUDE.md rows (3 added: `google_service.py`, `provider_gateway/anthropic.py`, `provider_gateway/google.py`), count-gate pin 29 → 33 |
| `22c409c2c` | Board + G-4 rows authored in VALIDATION / LIVE-EVIDENCE before any drive |
| `78f4e03cf` | The executor had no Chrome tools; blocker recorded and the drive taken over by the orchestrator |
| `369d3ea1a` | Board and G-4 drives, bug/seed flips, VALIDATION amendment |

## Gates (merged tree `3c9bb11ab`)

- **Backend:** 71 failed / 7508 passed / 0 errors. The failing set equals base.
- **Vitest count gate:** OK, 436/436 pinned files, 0 failing, total 10300.
- **tsc:** 103 lines, identical to base when compared as a multiset.
- **Ledger gates and seeds sweep:** green. 37 path matches, none folded.

## SC#10 board (pass 2 is the verdict)

| # | Model | Result |
|---|---|---|
| 1 | gpt-5.6-sol | PASS, multi-tool (search + Python + ask) |
| 2 | claude-sonnet-5 | ⛔ out of Anthropic credit (BUG-261015-04 filed for the chat label) |
| 3 | gemini-3.5-flash | PASS, parallel-thread B |
| 4 | deepseek-v4-pro | PASS, long message (5,685 B) |
| 5 | glm-5.2 | PASS, parallel-thread A |
| 6 | MiniMax-M3 | PASS |
| 7 | kimi-k2.6 | PASS |
| 8 | z-ai/glm-5.2 (OpenRouter) | ⛔ OpenRouter 402 |

Pass 1 found **BUG-261015-03**: ask_user's `timeout_seconds` is required but described as optional, so models picked about 60 s. Pass 2 asked for 1200 s explicitly.

## G-4 rows

- **G4-1 (panel open):** PASS. 1 Send Answer, pointer button 32 px, focus moves into the panel, and the pointer shows the draft.
- **G4-2 (workflow pause, panel on rail):** PASS. One input in every state, and the draft survives each toggle.
- **G4-3 (two threads paused):** PASS. Each thread keeps its own draft.
- **G4-4 (> 600 s local call):** ⛔ OWED. The measured maximum is 356 s, from the nemotron re-drive in 282-04.
- **G4-5 (Registry refusal on screen):** PASS. The exact sentence is shown and nothing is stored.
- **G4-6 (run-failure sentence, live):** OWED, because the test write was not approved.

## Deviations

- **The drive moved to the orchestrator.** The executor lacked Chrome MCP. The same per-request method was used, and no global setting changed.
- **The pause prompt was amended for pass 2** (BUG-261015-03). Pass-1 run ids are kept in the evidence file.
- **The parallel-thread axis moved from row 2 to row 5,** because row 2 was blocked on billing.

## Owed (decided at sign-off)

G4-4, G4-6, A1 (LangSmith nesting).

## Operator sign-off

`approved`, 2026-10-15. Recorded in `282-LIVE-EVIDENCE.md`.

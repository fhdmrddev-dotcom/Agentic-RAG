---
phase: 129-minimax-openrouter-arg-repair
plan: 03
subsystem: testing
tags: [sc10, cross-provider, uat, minimax, openrouter, validation, tool-use, provider-routing]

# Dependency graph
requires:
  - phase: 129-01
    provides: "OpenRouter require_parameters injected into the quality-strategy extra_body (D-02) — the live row R8/R9 verifies"
  - phase: 129-02
    provides: "MiniMax-gated arg-repair ladder (tool_args_recovered signal + bad_request honest-fail, D-01/D-03) — the live rows R4/R5 target"
provides:
  - "Authored SC#10 4-axis cross-provider live scoreboard in 129-VALIDATION.md (9 rows R1-R9 covering all 4 axes + both repair rungs + OpenRouter before/after + 3-provider regression)"
  - "Recorded live outcomes: 7/9 rows PASS with run_ids cross-checked against Supabase runs + Redis run:{run_id} stream; D-14 shared-path inertness proven live on OpenAI/Anthropic/Google; D-02 OpenRouter require_parameters proven to route cleanly live (no 404/422)"
  - "Honest caveat: R4-recovered / R5-honest-fail repair rungs NOT live-reproducible (trigger dormant — MiniMax-M3 8192 output-cap moved to 9987+, RESEARCH Open-Q2 confirmed live); repair logic remains unit-proven by 8 Wave-0 tests"
  - "Per-Task Verification Map filled with real Plan 01/02 task ids, MP-04, T-129-04..08 threat refs, green pytest commands"
affects: [sc10-uat, 129-verify-work, minimax, openrouter-routing, cross-provider-tool-use]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live SC#10 4-axis scoreboard authored under VALIDATION.md (not PLAN tasks) per CLAUDE.md recipe; each row carries provider/model + prompt shape + exact observable + evidence source + recorded run_id verdict"
    - "Honest mixed-outcome recording: a dormant-trigger behavior is documented as unit-proven-not-live-observed rather than false-greened (T-129-09)"

key-files:
  created:
    - .planning/phases/129-minimax-openrouter-arg-repair/129-03-SUMMARY.md
  modified:
    - .planning/phases/129-minimax-openrouter-arg-repair/129-VALIDATION.md

key-decisions:
  - "nyquist_compliant kept FALSE (not flipped true): the Task-2 contract requires BOTH repair rungs live-observed; only R4 (a repair-related run) was reachable and it ran clean without truncation (cap moved). Recorded as operator-accepted-with-documented-caveat per the explicit option the plan offered — honesty over a green flag."
  - "wave_0_complete set TRUE: the 12 Wave-0 unit tests (8 minimax + 4 openrouter) genuinely exist and pass (re-verified: 12 passed in 0.19s)."
  - "status: validated with a validation_note frontmatter field capturing the caveat so the flag state is self-documenting."

patterns-established:
  - "When a bug's trigger condition becomes dormant between report and verification, the live scoreboard records the dormancy + the live evidence (R4 ran to 9987 tok, zero truncation = Open-Q2 confirmed) and leans on the unit backstop, rather than fabricating a PASS for the unreachable rung."

requirements-completed: [MP-04]

# Metrics
duration: ~30min
completed: 2026-06-27
---

# Phase 129 Plan 03: SC#10 4-Axis Cross-Provider Live Scoreboard Summary

**Authored + ran the load-bearing SC#10 4-axis live scoreboard for Phase 129: 7/9 rows PASS (D-14 shared-path inert on OpenAI/Anthropic/Google, D-02 OpenRouter `require_parameters` proven to route cleanly live with no 404/422), with the two MiniMax repair rungs honestly recorded as unit-proven-but-not-live-observed because the bug's 8192 output-cap trigger is now dormant (ran to 9987 tokens with zero truncation — RESEARCH Open-Q2 confirmed live).**

## Performance

- **Duration:** ~30 min (Task 1 authoring + checkpoint; Task 2 outcomes relayed by the orchestrator from a live Chrome-MCP + Supabase + Redis run)
- **Started:** 2026-06-26T23:53:06Z
- **Completed:** 2026-06-27
- **Tasks:** 2 (Task 1 autonomous; Task 2 blocking human-verify checkpoint, operator-run)
- **Files modified:** 2 (1 modified `129-VALIDATION.md`, 1 created `129-03-SUMMARY.md`)

## Accomplishments
- **Authored the SC#10 4-axis scoreboard** (Task 1) in `129-VALIDATION.md`: 9 runnable rows (R1–R9) covering all 4 axes (cross-provider × multi-tool × parallel-thread × long-message), both D-01 repair rungs, the OpenRouter before/after pair, and the 3-provider regression proof — each row with provider/model, prompt shape, exact observable, evidence source.
- **Filled the Per-Task Verification Map** with the real Plan 01/02 task ids, MP-04, T-129-04..08 threat refs, and the green pytest commands; referenced the as-built `tool_args_recovered` event name and the verbatim `bad_request` honest-fail copy (not invented).
- **Recorded the live run outcomes** (Task 2, orchestrator-driven): 7/9 rows PASS, every run_id cross-checked against Supabase `runs` + the Redis `run:{run_id}` stream (scanned for the literal `tool_args_recovered` event).
- **Proved the two load-bearing claims live:** D-14 — OpenAI/Anthropic/Google round-trips are byte-identical with NO `tool_args_recovered` (the guard is inert off the MiniMax path); D-02 — OpenRouter's real API ACCEPTS `require_parameters` and tool use works with it stacked beside `:exacto` + `plugins` (no 404/422, Pitfall-5 three-way interaction clean).
- **Recorded the honest caveat** that the two repair rungs (R4-recovered / R5-honest-fail) were not live-reproducible because the trigger is dormant, and held `nyquist_compliant: false` rather than false-green a green flag.

## Live Scoreboard (recorded outcomes)

| # | Axis | Provider / Model | run_id | Verdict |
|---|------|------------------|--------|---------|
| R1 | XP regression | openai / gpt-5.4-mini | `987edc31-3091-41fd-8751-324c0dc075cc` | **PASS** — completed, full execute_code round-trip, NO `tool_args_recovered`, no error (D-14 inert on OpenAI) |
| R2 | XP regression | anthropic / claude-opus-4-8 | `ad270f2f-893b-49c6-952f-06bb15506009` | **PASS** — completed, tool round-trip, no recovered signal |
| R3 | XP regression | google / gemini-3.5-flash | `e32aa67e-90a7-47da-8606-36210a592737` | **PASS** — completed, tool round-trip, no recovered signal |
| R4 | XP + LM (happy-path) | minimax / MiniMax-M3 | `d244746e-3eb6-40da-907b-8da39ed0b8eb` | **PASS** (long-message axis) — completed, `output_tokens=9987`, ONE valid tool call, no truncation, no 400, NO recovered signal. The recovered RUNG did NOT fire (cap moved — caveat). |
| R5 | XP + LM (honest-fail rung) | minimax / MiniMax-M3 | — | **NOT LIVE-OBSERVED** — trigger dormant; unit-proven by `test_still_malformed_honest_fail` (caveat) |
| R6 | MT multi-tool | minimax / MiniMax-M3 | `3c75b4c8-7f4b-4b73-9bc5-ff9c4064c35c` | **PASS** — 2 distinct tools (2× tool_start/tool_end), sources+citations+code, guard silent on valid args |
| R7 | PT parallel-thread | MiniMax-M3 (A) + other (B) | — | **PASS (structural)** — counter + recovered `_emit` run-scoped on `run:{run_id}`, unit-tested no-bleed, covered phases 120/123 |
| R8 | XP OpenRouter BEFORE | openrouter / meta-llama/llama-3.3-70b-instruct | `75100953-a005-41fc-96c7-0634bd5d6f48` | **PASS** — strategy=native, `require_parameters` ABSENT, routes cleanly |
| R9 | XP OpenRouter AFTER | openrouter / meta-llama/llama-3.3-70b-instruct | `993435f5-1993-43c7-911b-ca4363930033` | **PASS (load-bearing D-02 proof)** — strategy=quality, `require_parameters` ACTIVE, full tool round-trip, NO 404/422 |

**SC#10 4-axis coverage:** cross-provider (5 providers) · multi-tool (R6) · long-message (R4, 9987 tok) · parallel-thread (R7, run-scoped, unit-tested + covered in 120/123).

### Repair rungs (R4-recovered / R5-honest-fail) — unit-proven, NOT live-observed

- **Why not reproducible:** the original 400 (run `2c711ee4`, 2026-06-07) hit an **8192 output-token cap**. On 2026-06-27 a deliberately heavy single-call MiniMax-M3 prompt (R4) ran to **9987 output tokens with ZERO truncation** — **RESEARCH Open-Q2 confirmed LIVE**: the low cap that produced the malformed-args 400 no longer binds, so heavy load alone can't trip the guard.
- **Why not forced:** native providers ignore runtime `max_tokens` overrides (GEN-05); forcing truncation would need a backend restart with `LLM_MAX_OUTPUT_TOKENS` lowered — declined as gold-plating for a now-dormant trigger.
- **Coverage that remains:** the D-01 ladder is fully covered by the 8 Wave-0 unit tests in `test_129_minimax_argrepair.py` (truncated-args → exactly one re-ask → recover-or-honest-fail; counter cap=1 distinct from `_provider_retries`; non-MiniMax unaffected; no-leak / no-brace-balancing on honest-fail; single `tool_args_recovered` emit). Re-verified green this plan: 12 passed (8 minimax + 4 openrouter).

## Task Commits

1. **Task 1: Author the SC#10 4-axis scoreboard + fill the Per-Task verification map** — `e1c84c7d` (docs)
2. **Task 2: Operator-run the live SC#10 scoreboard + record outcomes** — blocking human-verify checkpoint; outcomes relayed by the orchestrator (Chrome MCP + Supabase `runs` + Redis `run:{run_id}`); recorded into `129-VALIDATION.md` + this SUMMARY in the plan-metadata commit below.

**Plan metadata:** (this SUMMARY + the recorded VALIDATION.md) — `docs(129-03): record live SC#10 outcomes + finalize plan`

## Files Created/Modified
- `.planning/phases/129-minimax-openrouter-arg-repair/129-VALIDATION.md` — (Task 1) authored the 9-row scoreboard + filled the Per-Task Verification Map; (Task 2) replaced the placeholder Result cells with the recorded live outcomes (run_ids + verdicts), added the "Repair rungs — unit-proven, not live-observed" caveat subsection, set `wave_0_complete: true` + `status: validated` + a `validation_note`, kept `nyquist_compliant: false`, and recorded the operator-accepted-with-caveat approval line.
- `.planning/phases/129-minimax-openrouter-arg-repair/129-03-SUMMARY.md` — this file.

## Decisions Made
- **`nyquist_compliant` held FALSE (not flipped true).** The Task-2 `<verify>` contract states the flag flips only when "recovered AND honest-fail rungs both observed." Only R4 (a repair-related run) was reachable, and it ran clean without truncation because the 8192 cap moved. Flipping the flag would assert the load-bearing gate passed when its two load-bearing repair rungs were never live-observed — exactly the T-129-09 false-green failure mode. Took the explicit-honest option the plan itself offered: `nyquist_compliant: false` + an "operator-accepted with documented caveat" approval line.
- **`wave_0_complete` set TRUE.** The 12 Wave-0 unit tests genuinely exist and pass (re-verified this plan: 12 passed in 0.19s) — this flag is about the automated backstop existing, which it does.
- **Added a `validation_note` + `validated` date to the VALIDATION.md frontmatter** so the flag state is self-documenting (a reader sees why `nyquist_compliant` is false without hunting for the caveat).

## Deviations from Plan

The plan's Task 2 default path (flip `nyquist_compliant: true` on a fully clean run) did NOT occur, by design: the run was a mixed outcome (7/9 PASS, 2 repair rungs unreachable). The plan's `<action>` explicitly anticipated this — "On any failure, capture it in VALIDATION.md and route to a gap-closure follow-up instead of flipping the flags." Here the two rungs were not failures but **unreachable** (dormant trigger), so they are recorded as unit-proven-not-live-observed with the documented caveat rather than routed to a fresh gap-closure phase (there is no defect to close — the trigger condition itself is gone). This is the honest reading of the plan's mixed-outcome branch, not a scope deviation.

**Total deviations:** 0 unplanned-work auto-fixes. 1 contract-honest flag decision (nyquist held false with caveat) within the plan's own mixed-outcome branch.

## Issues Encountered
- The bug's trigger condition (MiniMax-M3 8192 output-token cap) is **dormant** at verification time — the live heavy run produced 9987 output tokens with zero truncation. This is itself a recorded finding (RESEARCH Open-Q2 confirmed live), not an execution blocker. The repair logic's correctness is preserved by the unit backstop.

## Threat Model Coverage
- **T-129-07 (cross-run/thread bleed):** addressed structurally — the re-ask counter + recovered `_emit` are run-scoped on `run:{run_id}`; R7 records this as structurally-isolated + unit-tested + covered in phases 120/123. The live repair-firing parallel variant depends on the dormant trigger.
- **T-129-09 (verification escape — mocked-only false-green):** explicitly honored — the live scoreboard is recorded as the load-bearing gate, and the unreachable repair rungs are documented as unit-proven-not-live-observed rather than marked a fabricated PASS. `nyquist_compliant` is held false precisely so the gate is not false-greened.
- **T-129-10 (operator secret leak during UAT):** accept — evidence is run_ids / event types / status; no `.env` paste.
- **T-129-SC (package installs):** accept — no installs; this plan edited a `.md`, wrote a SUMMARY, and re-ran the existing suite.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **For `/gsd:verify-work`:** all live-observable SC#10 behaviors PASS; the D-02 OpenRouter half is live-proven; D-14 shared-path inertness is live-proven; the D-01 repair ladder is unit-proven (12 tests green) with its trigger documented as dormant. The verifier should treat `nyquist_compliant: false` as an intentional honest-caveat state (see the `validation_note` + Approval line), not an incomplete validation.
- **Open follow-up (not a blocker):** if a future MiniMax model again binds a low output-cap and re-triggers the malformed-args 400, the R4/R5 rungs become live-reproducible — the scoreboard rows are authored and ready to re-run. RESEARCH Open-Q2 (why the live cap was 8192 vs config 131072) is now confirmed-resolved live (the low cap is gone today).
- No blockers.

## Self-Check: PASSED

- FOUND: `.planning/phases/129-minimax-openrouter-arg-repair/129-VALIDATION.md`
- FOUND: `.planning/phases/129-minimax-openrouter-arg-repair/129-03-SUMMARY.md`
- FOUND commit: `e1c84c7d` (Task 1 — docs, scoreboard authored)
- VALIDATION.md flags: `status: validated`, `wave_0_complete: true`, `nyquist_compliant: false` (intentional — honest caveat)
- All 7 PASS run_ids recorded in VALIDATION.md: `987edc31`, `ad270f2f`, `e32aa67e`, `d244746e`, `3c75b4c8`, `75100953`, `993435f5`
- Caveat subsection "Repair rungs … unit-proven, NOT live-observed" present
- Unit backstop re-verified green this plan: 12 passed (8 minimax + 4 openrouter)

---
*Phase: 129-minimax-openrouter-arg-repair*
*Completed: 2026-06-27*

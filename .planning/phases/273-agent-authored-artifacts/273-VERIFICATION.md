---
phase: 273-agent-authored-artifacts
verified: 2026-10-04T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (code + tests); 2 live re-checks owed
overrides_applied: 0
human_verification:
  - test: "Live STRUCTURED-path drive (OpenRouter, openrouter_tool_strategy=quality): ask for a chart; also a turn with a malformed/truncated show_artifact block; also an ordinary non-tool ```json reply"
    expected: "No tool-call text/JSON in the streamed or persisted answer (SC#2); an ordinary json block in prose is released intact (WR-06); a failed parse yields the refusal notice, not prose"
    why_human: "The original UAT recorded this OWED (unit-proven only). The post-UAT fixes CR-02 (4e7876c35, 51f41d873) and WR-06 (18ee689e1) rewrote exactly this holdback after the live board ran, so the live board does NOT cover them."
  - test: "Visual re-check of WR-04 (numbers below 1 keep significant digits) and WR-05 (stacked bar/area stack by sign) on a live chart/metric/table, then reload the thread"
    expected: "Values render sensibly and reload identically to live"
    why_human: "Both changed rendering after the operator-approved G4 drives (c863af46b, 317bf667c); unit tests pass but no live/visual pass covers them."
  - test: "Short live re-run of one chart emit on a native provider after CR-01 (backend validator now superset of frontend guard)"
    expected: "A scatter-with-text-x or x-also-in-y spec is refused to the model (retry) rather than reported 'Shown'"
    why_human: "Optional confidence check; CR-01 is covered by 281 backend unit tests, so this is low risk."
---

# Phase 273: Agent-Authored Artifacts Verification Report

**Goal:** Agent answers with a live chart/table/metric from a closed component set; data kept for follow-ups; reloads identically; works on every provider.
**Status:** human_needed (no failed truths; no blockers)
**Re-verification:** No (initial)

## Observable Truths (ROADMAP SC#1-5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (ART-01) | Interactive chart in chat, not PNG | VERIFIED | `ChartArtifact.tsx` (lazy recharts, legend toggles) mounted via `ArtifactBlock` in `MessageItem`; frontend suites in `chat/artifacts` pass (7 files, 100 tests, re-run). UAT G4 drives operator-approved; board V1 8/8. |
| 2 (ART-02) | Unknown component / bad props -> notice only, no raw spec | VERIFIED (live STRUCTURED leak owed) | Closed registry + guard (`artifactRegistry.ts`, `artifactSpec.ts`), `ArtifactNotice`, error boundary; backend `models/artifact.py` Pydantic closed vocabulary; STRUCTURED holdback `structured_text_holdback.py` + CR-02/WR-06 fixes; 281 backend tests pass. Live G4 showed 0 notices/no JSON. Live STRUCTURED check is OWED. |
| 3 (ART-03) | Follow-up re-encodes from attached rows, no new retrieval/code call | VERIFIED | `message_artifacts` (migration 202, rows kept), by-reference transform in `show_artifact_tool.py`, id-first result in history (redaction keeps id). Board V3 7/8: the follow-up made no retrieval/code call on all rows; deepseek failed only on the by-reference mechanism (F-1), not on the no-new-call property. |
| 4 (ART-04) | Table + metric are registry entries 2 and 3; registry holds exactly three | VERIFIED | Registry has chart/table/metric; backend vocabulary closed; parity fences. Tests pass. |
| 5 (ART-05) | Reload identical; 8-row board with blocked rows named | VERIFIED | `artifact_history.attach_artifacts` on GET /messages + /snapshot via user-JWT client with thread+user filter; reload mapper shares the live guard. Board: 8/8 emitted + rendered; leak `none` 8/8; F-1 and STRUCTURED OWED named, none silently omitted. |

Score: 5/5.

## Closed-core (counted, not grepped)
`len(_TOOL_REGISTRY)` = 30 (29 + show_artifact), executed in this run. get_tools max 29 / 26 / 24 recorded in UAT log as executed against BASE vs HEAD; the 273 count-pin tests pass. SYSTEM_PROMPT byte-identical to base.

## Requirements Coverage

| Req | Plans | Status |
|-----|-------|--------|
| ART-01 | 01,02,03,05,06 | SATISFIED |
| ART-02 | 01,02,03,04,05,06 | SATISFIED (live STRUCTURED owed) |
| ART-03 | 01,03,04,05,06 | SATISFIED |
| ART-04 | 01,02,03,06 | SATISFIED |
| ART-05 | 01,02,04,05,06 | SATISFIED |

All five IDs appear in PLAN frontmatter and in REQUIREMENTS.md; none orphaned. REQUIREMENTS.md traceability still reads "Pending" for all five and ROADMAP plan checkboxes should be flipped by the orchestrator at phase close (bookkeeping, not a gap).

## Behavioral Spot-Checks (run here)
- `pytest tests/unit/test_273_*.py` -> 281 passed
- `vitest run src/components/chat/artifacts` -> 7 files / 100 tests passed
- `_TOOL_REGISTRY` -> 30
- Gates per UAT log / caller: backend 71 failed (set identical to baseline), count gate OK 389/389, tsc set diff unchanged (70). Not re-run in full here.

## Post-UAT fix pass assessment
The review fixes (CR-01, CR-02, WR-01..07) landed AFTER the operator-approved live UAT. Unit-covered, but need live re-check:
- CR-02 / WR-06: touch the STRUCTURED holdback, the one path whose live leak check was already OWED. Required live check.
- WR-04 / WR-05: change rendered output; the G4 drives predate them. Quick visual + reload check recommended.
- CR-01, WR-01..03, WR-07: backend validation/robustness; unit-covered; live re-check optional.

## Anti-Patterns
None blocking found in the checked artifacts; no TBD/FIXME debt-marker scan was exhaustively re-run beyond the review's coverage (review reported none). IN-01..IN-06 info findings were not addressed (non-blocking).

## Known non-blocking items
- F-1: deepseek by-reference refusal detail should name where `chart` belongs (V3 7/8). Not an SC failure; track as a fast-fix/seed.
- CLAUDE.md split still owed (since 271).

## Gaps Summary
No failed truths. Status is human_needed solely because the STRUCTURED-path live leak check was never executed and the fixes touching it, plus two rendering fixes, post-date the live UAT.

_Verifier: Claude (gsd-verifier)_

---
phase: 292-more-ways-to-show-it
verified: 2026-10-24T00:00:00Z
status: human_needed
score: 4/4 success criteria verified in code; live browser items owed
overrides_applied: 0
re_verification: false
gaps: []
human_verification:
  - test: "G4-1 diagrams (anthropic 937db3b1, openai 4f2e3c27) at 375 / default / wide; hover lights edges; no sideways scroll"
    expected: "Top-down diagram, labels match document, 1 dashed back edge, no horizontal scroll"
    why_human: "Backend hung after fixer edits; Claude may not restart it. Visual and hover behaviour."
  - test: "F-1 live re-check: plain 'Compare A and B on X, Y, Z' now yields a comparison matrix"
    expected: "show_artifact component=comparison instead of a markdown table, on 2 providers"
    why_human: "Tool-description steering (a127c2462) is model behaviour; needs a live run after backend restart"
  - test: "G4-5 reload of the two diagram threads, plus browser parallel-thread row"
    expected: "Card textContent identical before and after reload; each artifact lands in its own thread"
    why_human: "Needs running backend and Chrome"
  - test: "375px viewport and America/Los_Angeles timezone for the timeline"
    expected: "No overflow; Today row and 'in N days' correct"
    why_human: "Chrome MCP cannot resize the window or emulate TZ; container emulation at 343px passed, TZ covered only by unit tests"
  - test: "Operator sign-off on the G4 rows (G-4)"
    expected: "Operator signs G4-1..G4-5"
    why_human: "G-4 requires the operator's own recognition of failure"
---

# Phase 292: More Ways to Show It - Verification Report

**Phase Goal:** The agent can answer with more kinds of interactive artifact than chart, table and metric, each from a closed, reviewed registry.
**Status:** human_needed (no code gaps; live items owed)
**Re-verification:** No, initial verification

## Success criteria

| # | Criterion | Status | Evidence (checked in code, not from SUMMARY) |
|---|---|---|---|
| 1 | New set chosen at sketch time, recorded in CONTEXT with reasons, closed list | VERIFIED | `292-CONTEXT.md` D-01 (diagram, comparison, timeline, with reasons), D-02 (rejected list with reasons). `ComponentName` in `backend/app/models/artifact.py:59` is a 6-member `Literal`. Frontend `artifactRegistry.ts` maps exactly the three new components. |
| 2 | Each new type renders; a name outside the registry is refused and shown as text | VERIFIED in code / live half PASSED in Chrome for comparison, timeline and the refusal | Backend refusal path (`show_artifact_tool.py`) returns worded `refused` with the six names (validated by `test_292_show_artifact_new_types.py`, in the 271 passing). Frontend guard reads the component table via `own()` (`artifactSpec.ts`). G4-4 Chrome PASS: crafted bad row shows only the notice, no leak tokens, answer text kept; live amber refusal rail lines seen. G4-2 and G4-3 PASS on two providers. Diagram render in the browser is owed (see below). |
| 3 | Reload shows the same artifacts, at least two native providers | VERIFIED for comparison and timeline; diagrams owed in browser | Browser reload IDENTICAL on 4 threads (timeline and comparison, anthropic and openai). API reload identical on 9 board files and 6 G-4 files across 8 providers. Diagram browser reload owed. Live and reload share one persisted spec and renderer (I-2). |
| 4 | Tool count stays 30; show_artifact extended by registry entries only | VERIFIED | `test_259_closed_core_inventory.py` asserts `len(_TOOL_REGISTRY) == 30`; I ran it and the 292 and 273_tool_wiring suites: 271 passed. No new tool; only the `component` enum and optional fields changed. |

## Artifacts and wiring

| Artifact | Status | Details |
|---|---|---|
| `supabase/migrations/213_message_artifacts_more_components.sql` | VERIFIED | Both CHECKs name the six components (lines 42, 46); no new table. Numbering follows 212. Applied locally per orchestrator (`VERIFY: 8/8`); cloud apply is a deploy step. |
| Backend models, sources, history, tool | VERIFIED | `artifact.py`, `artifact_sources.py`, `artifact_history.py`, `show_artifact_tool.py`; `test_292_*` x7 files pass. |
| Frontend `Diagram/Comparison/TimelineArtifact.tsx`, `artifactRegistry.ts`, `artifactSpec.ts` | VERIFIED | Mounted via `ArtifactBlock`; no `dangerouslySetInnerHTML`/`innerHTML` in `artifacts/` (I-3). Parity fences `artifactParity.fence` and `artifactParity292.fence` pass (34 tests across 3 files, run by me). |
| Data flow | FLOWING | Board: 24/24 emitted and persisted rows from real runs across 8 providers; reload returns the persisted records. |

## Requirements coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| VIS-02 | 292-01, 292-02, 292-03 (all declare `requirements: [VIS-02]`) | SATISFIED in code; browser sign-off owed | REQUIREMENTS.md line 27 / traceability line 84 (still "Pending", to be flipped by the orchestrator after close). No orphaned requirement IDs for Phase 292. |

## Gates (orchestrator-measured, spot-checked)

Backend unit 70 failed (ceiling 71, 0 artifact tests among them); vitest count gate OK; tsc 63 == base. I re-ran only targeted suites (above). Schema-drift false positive is the project-forbidden `db push` complaint, not a defect.

## Anti-patterns / review

Review `status: fixed` (CR-01, WR-01..05, IN-02, IN-04, F-1 fixed). IN-01 (tooltip detaches on scroll/resize) and IN-03 (long node labels clamped at narrow width, full text only in aria-label) are consciously deferred with re-open triggers; both are Info-level, neither blocks a success criterion. No TBD/FIXME debt markers examined as blockers.

## Human verification required

1. G4-1 diagrams at three widths, hover-lights-edges, no sideways scroll (both diagram threads).
2. F-1 live re-check: plain "compare" prompt yields a comparison matrix (the fix is prompt steering, `a127c2462`; the effect is model behaviour and unproven until a live run). Note the criterion (the agent shows each new type) is already met by the board prompt on all 8 rows and by "side by side" prompts; F-1 concerns discoverability, not capability.
3. Diagram thread reloads in the browser, and the browser parallel-thread row.
4. 375px real viewport and America/Los_Angeles timezone (both unemulable in Chrome MCP).
5. Operator sign-off on G4 rows (G-4).

## Gaps Summary

No success criterion is unmet by code. Remaining work is live observation that was blocked by a hung operator backend, plus operator sign-off. The IN-01/IN-03 deferrals are minor. Phase should not be marked fully closed until items 1, 3 and 5 are done.

---

_Verified: 2026-10-24_
_Verifier: Claude (gsd-verifier)_

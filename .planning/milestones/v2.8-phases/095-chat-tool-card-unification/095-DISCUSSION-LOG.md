# Phase 095: Chat Tool-Card Unification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 095-chat-tool-card-unification
**Areas discussed:** Resting frame, Live-run focus, Auto-scroll, Step semantic, Duplicates, Timer strip, Output files (download + hero), Lived-experience UAT

---

## Resting tool-card state

| Option | Description | Selected |
|--------|-------------|----------|
| One-line summary | Finished card folds to a single essence line; expand on click (Claude.ai/Cursor feel) | ✓ |
| Short preview | Card folds to name + first line or two, "show more" to expand | |
| Keep expanded | Full output always (today's behavior) | |

**User's choice:** One-line summary
**Notes:** Drives D-01; reuses sketch-findings Focus Mode direction.

---

## Live-run focus

| Option | Description | Selected |
|--------|-------------|----------|
| Focus on the active step | Only the running step is expanded/live; finished steps auto-fold as the next opens | ✓ |
| I control what's open | Everything folds; user opens what they want to watch | |
| Keep recent steps open | Active + last 1–2 finished stay expanded | |

**User's choice:** Focus on the active step → D-02.

---

## Auto-scroll

| Option | Description | Selected |
|--------|-------------|----------|
| Follow, but get out of my way | Stick to bottom while there; release on scroll-up; re-arm at bottom; "Jump to live" button | ✓ |
| Always snap to newest | Always jump to newest on every update | |
| Never auto-scroll | Manual scrolling (today's behavior / the complaint) | |

**User's choice:** Follow-but-release → D-03 (BUG-260529-02 #1).

---

## Step semantic

| Option | Description | Selected |
|--------|-------------|----------|
| One action = one step | Step count = visible tool cards; same number in timer + panel | ✓ |
| One thinking-turn = one step | Count agent loop iterations (a turn may hold several tools) | |
| Skip the number | Show activity, no precise count | |

**User's choice:** One action = one step → D-04 (closes BUG-260528-02).

---

## Duplicates

| Option | Description | Selected |
|--------|-------------|----------|
| Never double, even briefly | Root fix: one stable identity from first frame; cross-provider; no self-heal | ✓ |
| A brief flicker is acceptable | Lighter; duplicate may flash then collapse | |

**User's choice:** Never double → D-05 (matches the standing "zero duplicates ever" bar, 075.2).

---

## Timer strip

| Option | Description | Selected |
|--------|-------------|----------|
| Time + step + activity | `⏱ 3m12s · Step 5 · Running code…`, never disappears until terminal | ✓ |
| Time + activity only | Drops the step number | |
| Just elapsed time | Minimal | |

**User's choice:** Time + step + activity → D-06 (closes BUG-260528-01).

---

## Output files (download + hero)

| Option | Description | Selected |
|--------|-------------|----------|
| Always works, even old chats | Reliable downloads incl. old chats; allow small backend tweak if link expiry is server-side | (basis) |
| Recent runs only, frontend-only | UI-only; very old links may still expire | |
| Investigate, then you decide | Find the dead-link root before committing | |
| **Other (user's own framing)** | **Show ALL generated files + always work, but hero the final intended output the user asked for; intermediates secondary** | ✓ |

**User's choice (free text):** *"why we should show all files that all agents generated, if the user
asked for docx, we should show clearly the final completed output that the user asked for, if he said
multiple files, we show those files. there's nothing wrong with showing all the files generated and
make them always work, but the focus should be on the final intended output to make it easier for the
user."*
**Notes:** Reframed the download question into a re-rank/hero-output design → D-07. Accepts the
implied backend touch.

### Follow-up — how to identify the hero file

| Option | Description | Selected |
|--------|-------------|----------|
| The agent marks it | Agent flags the final deliverable (knows intent); needs a small backend signal | ✓ |
| Smart guess by type + recency | Heuristic, no backend change; can mispick | |
| Show all, newest first | No formal hero | |

**User's choice:** The agent marks it → D-07/D-08 (confirms a contained backend touch; narrows SC#4).

---

## Lived-experience UAT (G-4 / SC#10)

| Scenario | Selected |
|----------|----------|
| Long run stays honest (timer + step + no-dup) | ✓ |
| Multi-tool stays calm (one frame + Focus + scroll) | ✓ |
| Hero file downloads (incl. old chats) | ✓ |
| Two threads at once + 6-provider parity | ✓ |

**User's choice:** All four → the binding lived-experience gate.

## Claude's Discretion
- Component/hook layout, exact stable-key scheme (D-05), elapsed-time derivation (D-06), hero/working
  file render, per-tool essence-line copy/icons.

## Deferred Ideas
- Orphaned ask_user 404 (BUG-260605-01) — routed OUT of 095 (HITL/panel/backend), left open.
- Per-phase count chips → SEED-053. Generated-files-in-panel → SEED-037/038. Composer/Workflows page → v2.9/SEED-051.

## Process
- G-2 fires → next step is `/gsd:sketch 095` (lock the unified frame), THEN plan. (No auto-advance —
  plain invocation.)
- G-5 hot files (ToolCallPanel/MessageItem/StreamsProvider) satisfied at 075.7; 094 didn't touch
  them → G-5 does not fire.

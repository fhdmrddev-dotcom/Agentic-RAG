# Phase 094: Workflow Legibility + Mode Clarity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 094-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 094-workflow-legibility-mode-clarity
**Areas discussed:** ① Deep relocation / 094↔095 split · ② Workflow-launch location · ③ Legibility honesty ceiling · ④ RC-4 failure source · ⑤ Composer/mode · (+ folded into ②/⑤) · plus operator-raised todo-interactivity gap
**Grounding:** every claim verified against live code via background workflow `wf_11628da0-038` (6 read-only agents, all CONFIRMED) + a live DB pull of thread `4cad6241` for the todo-interactivity finding.

---

## ① Deep tool-card relocation + the 094↔095 collision

| Option | Description | Selected |
|--------|-------------|----------|
| (a) 094 fully relocates Deep → panel; 095 shrinks/absorbed | Single execution surface; heaviest G-5 hot-file touch | |
| (b) 094 = Harness timeline only; Deep relocation + 3 bugs → 095 | Contained 094; defers unify | |
| (c) Split by concern: 094 owns unify + relocation; 095 = card-quality cleanup | Middle path | |
| **(d) NARROW — drop relocation entirely; Deep stays in chat; panel = mode-appropriate** | **Operator-introduced; lightest, zero G-5 risk** | ✓ |

**User's choice:** (d) — *"why do we need to move the tool card out of the chat area? it should be only unification and cleaning."* Confirmed: panel shows Harness timeline (Deep keeps existing workspace sections); Deep tool-cards stay in chat; all 3 card-quality bugs stay in Phase 095.
**Notes:** Evidence showed the timer/step/dedup bugs are rooted in `RunCard` (travel with relocation, not fixed by it) and the "ghost avatar" is Harness-only (solved by the timeline + seam). Dropping relocation dissolves the collision and removes all G-5 hot-file risk. Supersedes the 2026-06-02 D-094-UNIFY sign-off. → CONTEXT D-01.

---

## ②+⑤ Workflow-launch location + composer/mode (coupled — same surface)

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Full Workflows page + GET /workflows/{id} + 2-pill composer in 094 | Honors both locked UI-SPEC decisions; ~600 LOC | |
| (b) Lightweight launch dialog/button; defer page to v2.9 | Honors "launch leaves composer" without full page | |
| **(c) Defer the whole redesign to v2.9; in 094 only fix mode label → server truth** | **Keeps 092 picker; kills finding #5; zero-risk** | ✓ |

**User's choice:** (c) — *"go with your recommendation, defer redesign to v2.9."*
**Notes:** Evidence — mode label is a stale `ChatArea useState`; the real fix (finding #5) is deriving it from `active_workflow_run_id`, independent of the composer redesign. Removing the launch picker from the composer would REQUIRE a launch home in the same change (coupling trap), so the 2-pill composer + Workflows page + `GET /workflows/{id}` defer together to v2.9 with SEED-051. → CONTEXT D-02.

---

## ③ Legibility honesty ceiling ("real steps" vs honest data)

| Option | Description | Selected |
|--------|-------------|----------|
| **(a) Ship producer-honest subset; suppress per-phase tool/search counts; defer Build-Prereq B** | agents + transitions + summaries + merge + draft + failure; "16 tool calls" deferred | ✓ |
| (b) Pull Build-Prereq B into 094 | Hits the literal "6 searches / 16 tool calls" bar; biggest backend add, hot sub-agent path | |

**User's choice:** (a) — *"ship honest subset, defer B."*
**Notes:** tool/search counts fire only on `run:{sub_run_id}`, invisible to the producer → faking forbidden. Honest subset meets the spirit; B → SEED-053. → CONTEXT D-03.

---

## ④ RC-4 failure source (empty "done" on a failed run)

| Option | Description | Selected |
|--------|-------------|----------|
| UI-only (key off run_failed/gate_failed) | Insufficient — reconcile has nothing to key off if nothing persists | |
| **Backend RC-4 source fix IN 094 (+ UI render)** | ~30 LOC, harness-only, Deep byte-identical | ✓ |

**User's choice:** *"confirm RC-4 fix in 094."*
**Notes:** Traced — failure path emits `run_failed` and returns without `_surface_final_answer`; success path persists. Fix persists a real failure message before return, inside `run_workflow` (not shared `_shielded_finalize`). → CONTEXT D-04.

---

## (Operator-raised) Todo / ask_user interactivity gap

**Not a gray area of 094 — an operator observation raised mid-discussion.** Grounded via a live DB
pull of thread `4cad6241` (Deep, deepseek-v4-flash, 18 msgs): agent creates 13 todos, then resists
an explicit "ask me per step" request (only uses `ask_user` after being told twice), and once
interactive never advances past "Step 1 of 13" or marks any todo complete. Root cause: `agent_loop.py`
~545–572 biases toward autonomous end-to-end execution + no ask→mark→advance loop primitive.

**Routing decision:** NOT 094/095/096 (agent behavior, not rendering). → captured as **SEED-052**
(v2.9 capability) + **BUG-260604-01** (`agent-ignores-step-by-step-request-no-todo-loop.md`,
deferred). Near-term **prompt nudge** noted as an optional partial. **User confirmed:** *"capture it
that way and note the prompt nudge as an option."* Recorded in CONTEXT `<deferred>`.

## Claude's Discretion

None — the UI-SPEC + locked sketches define the visual/interaction contract; these were
scope/sequencing decisions.

## Deferred Ideas

SEED-051 (composer-2-pill + Workflows page → v2.9) · SEED-052 + BUG-260604-01 (interactive todo
execution) · SEED-053 (Build-Prereq B sub-stream counts) · SEED-037/038 (generated-files-in-panel)
· Deep relocation (dropped) · chat-card bugs (→ Phase 095).

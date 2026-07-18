# Phase 121: One Front Door for Workflows (IA) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 121-one-front-door-for-workflows-ia
**Areas discussed:** G-2 routing, Mode legibility, Removal depth, Launch-in-context semantics, Front-door discoverability, Open-bug routing

---

## G-2 routing (guardrail gate)

| Option | Description | Selected |
|--------|-------------|----------|
| Proceed — sketch is locked | Treat adopted sketches 011-A/021-A/022-A (in sketch-findings) as the G-2 acceptance-bar mockup and continue. Phase 121 implements that approved design. | ✓ |
| Run a fresh /gsd:sketch first | Stop discuss and run a new sketch session to confirm/extend for any 121-specific gaps. | |

**User's choice:** Proceed — sketch is locked.
**Notes:** G-2 honored by reference; no unresolved visual decisions for the composer.

---

## Mode legibility after pill removal

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing run receipt | Mode signal = shipped chat run receipt/status strip (015-C/022-A) + disabled composer + placeholder + 409 banner. No new composer chrome; verify Cancel reachable. | ✓ |
| Dedicated composer chip | Add a slim amber 'Workflow running' + Cancel chip directly above the composer (literal 011-A), even if it overlaps the run receipt. | |

**User's choice:** Reuse existing run receipt.
**Notes:** Minimal blast radius; matches 022-A "chat = thin run receipt". Research verifies the receipt's Cancel renders for a locked thread.

---

## Removal depth

| Option | Description | Selected |
|--------|-------------|----------|
| UI-only removal | Remove the Deep/Harness toggle + in-chat picker + their props/handlers (frontend only). Keep the server send-with-workflow_definition_id path as harmless dead code. No threads.py growth (G-5). | ✓ |
| UI + server retirement | Also remove/deprecate the server-side in-chat launch path + kickoff seam. Larger blast radius; touches G-5-firing threads.py. | |

**User's choice:** UI-only removal.
**Notes:** Fully reversible; reconcile/409 untouched; honors G-5.

---

## Launch-in-context semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Always a new thread | Workflows-page launch always creates a NEW thread + toggles to Harness (locked 021/022). No 'launch into current thread'. | ✓ |
| Allow current-thread launch | Also allow launching into the currently-open Deep thread (turns it Harness in place). New behavior, not in the locked design. | |

**User's choice:** Always a new thread.
**Notes:** Keeps the Phase 120 run↔chat context-isolation guarantee clean.

---

## Front-door discoverability

| Option | Description | Selected |
|--------|-------------|----------|
| Workflows nav entry only | Existing "Workflows" nav entry is the single front door; no chat-side pointer. Empty-state nudge stays deferred. | ✓ |
| Add a chat-side pointer | Add a lightweight chat affordance (empty-state nudge/hint) deep-linking to the Workflows page. | |

**User's choice:** Workflows nav entry only.
**Notes:** Consistent with the locked three-homes IA; nudge revisited only if UAT shows discoverability pain.

---

## Open-bug routing

| Option | Description | Selected |
|--------|-------------|----------|
| Leave both open — SC#10 blast radius | Neither shares IA-01's root cause; keep both open, don't regress the composer send path; BUG-260610-01 → Phase 124. | ✓ |
| Fold composer send-drop into 121 | Treat general-chat-intermittent-silent-send-drop as in-scope and fix it here. | |

**User's choice:** Leave both open — SC#10 blast radius.
**Notes:** `general-chat-intermittent-silent-send-drop` (SEED-055 residual) and `BUG-260610-01` (Phase 124 run-surface) both stay open.

## Claude's Discretion

- Exact removal mechanics (delete props vs. stop passing them), test refactors for
  `ChatAreaMode.test.tsx` / `RunCard.timer.test.tsx`, internal `workflowMode`/`setWorkflowMode`
  state cleanup in `ChatArea`.

## Deferred Ideas

- Chat-side workflows discoverability nudge (only if UAT shows pain).
- Server-side in-chat launch path retirement (would touch G-5 threads.py).
- BUG-260610-01 → Phase 124 run-surface work.

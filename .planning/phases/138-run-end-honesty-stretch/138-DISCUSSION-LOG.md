# Phase 138: Run-End Honesty (STRETCH) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 138-run-end-honesty-stretch
**Areas discussed:** Open-todos honesty signal, Backfill already-stuck threads, Redundant sandbox re-upload (new finding)

---

## Open-todos honesty signal

### Q1 — Surfacing mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Text marker on content | Append a short note to each still-open todo's own text, e.g. "Update docs" → "Update docs (run ended — not completed)". Zero frontend/schema changes. | ✓ |
| New frontend affordance | Add a small visible treatment in TodosSection.tsx — a banner or distinct 4th visual state. Clearer signal, but a real UI change; triggers G-2 sketch-first. | |
| Backend-only, no visible change yet | Record the honest state in the backend/DB without changing what the panel shows. Keeps the phase minimal but doesn't resolve the user-facing complaint. | |

**User's choice:** Text marker on content (Recommended).

### Q2 — Wording granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Same note for both | Every non-completed item gets the same suffix. Simple, one code path. | ✓ |
| Distinguish in-progress vs pending | Different wording for "was in progress" vs "never started." More precise, two variants to maintain. | |

**User's choice:** Same note for both (Recommended).

### Q3 — Marker placement/style

| Option | Description | Selected |
|--------|-------------|----------|
| Plain suffix | Parenthetical at the end: "Update docs (run ended — not completed)." Reads naturally. | ✓ |
| Symbol-prefixed | Prefix with a plain-text unicode marker (⚠/•). Scans faster but less natural. | |

**User's choice:** Plain suffix (Recommended).

### Q4 — Stacking behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Stays as one note, never stacks | Reconciler recognizes an already-marked item and leaves it alone. | ✓ |
| Not a concern | Leave dedup behavior to the implementer. | |

**User's choice:** Stays as one note, never stacks (Recommended).

**Notes:** All four answers took the recommended option. Exact wording locked: `"(run ended — not completed)"`.

---

## Backfill already-stuck threads

### Q1 — Forward-only vs backfill

| Option | Description | Selected |
|--------|-------------|----------|
| Forward-only, no backfill | Reconciler only fires for runs completing after this phase ships. No migration/script, no risk to historical data. | ✓ |
| One-time backfill script | Sweep existing threads whose latest run is completed but todos are non-terminal. Closes the gap immediately but is extra scope. | |

**User's choice:** Forward-only, no backfill (Recommended). Evidence presented: a live query against the local dev DB found 14 of 51 threads with todos currently have a non-completed item on an already-`completed` run, including the exact repro thread `13ae9bfe-318d-41ea-b99e-b56bb3699650` from BUG-260626-03.

### Q2 — Track as backlog item?

| Option | Description | Selected |
|--------|-------------|----------|
| Log a lightweight backlog note | Plant as a deferred idea/seed so it's not forgotten, no obligation to act. | ✓ |
| Leave it untracked | Don't plant anything. | |

**User's choice:** Log a lightweight backlog note (Recommended).

**Notes:** None additional.

---

## Redundant sandbox re-upload (new finding)

### Q1 — Fix scope

| Option | Description | Selected |
|--------|-------------|----------|
| Display fix only | Filter the final_output_files emit; leave harvest_output_files's upload/DB-insert behavior untouched. Keeps the phase in its roadmapped small/backend-only lane. | ✓ |
| Also stop the redundant re-upload | Change harvest_output_files to skip re-uploading/re-inserting unchanged files. Removes real waste but touches shared harvest code used by every sandbox call. | |

**User's choice:** Display fix only (Recommended).

### Q2 — Track as a seed?

| Option | Description | Selected |
|--------|-------------|----------|
| Log as a new seed | Plant a seed for a future efficiency pass if storage/DB growth ever becomes noticeable. | ✓ |
| Not worth tracking | Skip it entirely. | |

**User's choice:** Log as a new seed (Recommended).

### Free-text clarification (mid-area, before wrap-up)

User asked (paraphrased): does this phase make todos honest in general — including cases where todo content is generic/vague (e.g. "search document") — and confirmed the in-progress/pending-after-completion symptom is what they've observed and want fixed.

**Claude's response:** Clarified that Phase 138 (RUN-01b) only fixes run-END honesty — whether leftover pending/in_progress items get an honest "not completed" note once a run cleanly ends. It does NOT touch todo WRITING quality (how descriptive the model's todo content is), which is a separate concern. Confirmed the in_progress/pending-after-completion-run symptom the user described IS exactly what this phase targets.

Follow-up question — track the generic-todo-wording observation separately?

| Option | Description | Selected |
|--------|-------------|----------|
| Log as a deferred idea | Note it for a future phase/prompt-tuning pass — distinct from run-end honesty. | ✓ |
| Not worth tracking | Skip it. | |

**User's choice:** Log as a deferred idea (Recommended).

---

## Claude's Discretion

- Exact mechanism for "already-marked, don't stack" detection on the todo-honesty marker (D-04).
- Exact mechanism for tracking "this run's genuinely new files" for the RUN-01a emit filter (D-07's implementation) — code_context in CONTEXT.md documents the root-cause finding this must be checked against.
- Where the new todo-reconciler function should live (avoiding further growth of the G-5-flagged `threads.py`).

## Deferred Ideas

- One-time backfill for pre-Phase-138 stuck todos (14 threads observed live 2026-07-05, incl. repro thread `13ae9bfe-318d-41ea-b99e-b56bb3699650`).
- `harvest_output_files` redundant re-upload/re-insert efficiency on reused sandbox sessions — candidate for a future SEED.
- Todo content writing quality (generic/vague todo text) — distinct from run-end honesty; candidate for a future prompt-tuning investigation.
- Reviewed but not folded: `spike-nl-workflow-authoring` todo (low-relevance keyword-only match, no real thematic overlap with this phase).

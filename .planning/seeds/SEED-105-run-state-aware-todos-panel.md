---
seed_id: SEED-105
title: Run-state-aware TODOS panel — stop the in-progress spinner at run-end + visual "ended" treatment (cleaner alternative to the text-append honesty marker)
status: answered
planted: 2026-07-06
phase_origin: "Phase 138 live UAT (138-05). Operator questioned whether appending '(run ended — not completed)' to a todo's content is the best UX vs. a run-state-aware panel treatment."
category: frontend UX — Workspace TODOS panel run-state awareness; additive polish on the shipped RUN-01b honesty signal (does NOT replace the backend marker, complements/could supersede it)
related_seeds: [SEED-094]
related_memories: [feedback_uat_lived_experience_gap, feedback_vibe_coder_communication, feedback_seamless_scroll_no_boxed_chat]
related_decisions:
  - "Phase 138 D-01: the RUN-01b honesty signal rides on each open todo's `content` text field (no new frontend component, no status enum value) — deliberately the minimal, backend-only path to stay inside the phase's 'backend-only, small' lane."
  - "Phase 138 D-02/D-03: marker text is a plain parenthetical suffix, same wording for pending + in_progress."
re_open_triggers:
  - Any phase that re-touches `frontend/src/components/panel/TodosSection.tsx` or the Workspace panel run-state rendering — land the run-state-aware treatment then, while the panel render path is already open.
  - Operator asks for the todos panel to look cleaner at run-end / dislikes the inline text marker in practice.
  - A user reports the in-progress spinner keeps animating after a run has ended (the perception the text-append only partially addresses).
priority: low
answered_by: "Phase 250 (HONEST-03 / HONEST-04), 2026-09-15 — items 1-3 SHIPPED; item 4 DECLINED with a reason"
suggested_phase: A small dedicated frontend polish phase (or fold into the next phase that opens TodosSection.tsx / the Workspace panel). NOT a blocker — Phase 138 already meets the RUN-01b honesty requirement.
surface: Agentic-RAG
trigger_when: unset
---

# SEED-105 — Run-state-aware TODOS panel

## Why this exists

Phase 138 shipped the RUN-01b honesty signal as a **text suffix** appended to each open todo's
`content` — `"Draft report (run ended — not completed)"` — chosen (D-01) because the `todos.status`
enum has only `pending | in_progress | completed` (no "abandoned" value) and the text-append needs
zero schema/frontend change. It is honest and now verified live (138-04/138-05), but during the
live UAT the operator flagged that mutating the content string is the *hacky* version of the idea:

> "What is the added value of changing the labels? We should maintain consistency anyway."

## The cleaner design (deferred)

Make the panel **run-state-aware** instead of mutating text:

1. When the owning run reaches a terminal state, **stop the `in_progress` spinner animation** on
   open rows — the biggest source of the "still working / stuck" perception is the spinner
   continuing to bounce after nothing is running.
2. **Dim / restyle open rows** once the run is terminal to read as "unfinished, not active."
3. Optionally show a small non-interactive **"ended" pill** on open rows (reuse the DerivedRow /
   status-label vocabulary already in `TodosSection.tsx`) *instead of* the inline text-append.
4. If (3) lands, the backend text-append (138-02) could be **removed** so the honesty signal is
   purely presentational — but that is a backend change and a separate decision (keep the marker
   until the visual treatment is proven).

## Scope notes

- This is ADDITIVE frontend polish; it does not regress the shipped honesty guarantee. The backend
  marker (138-02) and fetch-on-terminal (138-04) stay until/unless a visual treatment supersedes them.
- Touches `frontend/src/components/panel/TodosSection.tsx` (a sketch-findings-covered surface) and
  needs the panel to know the owning run's terminal state (already available via runStatus in the
  streams store). G-2 sketch-gate likely applies (visual change) — propose `/gsd:sketch` first.
- Distinct from todo-content *writing quality* (how descriptive the model's todo text is) — that
  remains a separate deferred concern (see Phase 138 CONTEXT `<deferred>`).

---

## ⭐ ANSWERED BY PHASE 250 (2026-09-15) — and all three triggers had fired

**Items 1, 2 and 3 shipped**, in `frontend/src/components/panel/todoRunHonesty.ts` (new) and
`TodosSection.tsx`:

1. **The spinner stops.** An open todo on a thread with no live run renders `CircleDashed` with
   **no `animate-` class** — the bouncing dot on a dead run was the loudest lie on the surface.
2. **The row dims.** `not_ticked` takes `--panel-muted-foreground-dim`, the DIM tier of
   `run-state-honesty.md` D1 (*loudness earned by severity*) — an abandoned todo is the quiet
   case, and must not borrow the amber the active state uses.
3. **A fourth DISPLAY status, `NOT TICKED`**, extends the existing `STATUS_LABEL` /
   `STATUS_TEXT_COLOR` / `StatusIndicator` vocabulary exactly as this seed proposed. The stored
   marker is stripped out of the task text and becomes the row's `title`, so the honesty now
   lives in the STATUS slot instead of inside the user's own sentence. The word is the
   operator's own: *"the to dos is not up to date and ticked as completed"*.

⛔ **Item 4 is DECLINED, not deferred.** The backend text-append STAYS. It is the only record of
*why* a specific row stopped, 25 stored rows already carry it, and deleting a shipped honesty
signal to tidy a surface is the trade Phase 138 explicitly refused. The panel simply stops
showing it.

⭐ **THE DESIGN SAT PLANTED FOR TEN WEEKS WHILE TWO BUGS WERE FILED AGAINST ITS ABSENCE**, and
all three `re_open_triggers` above had fired by the time it shipped: this phase re-touched
`TodosSection.tsx` (#1); the operator disliked the inline marker in practice — `BUG-260913-02`,
2026-09-13 (#2); and a user reported the spinner still animating after a run ended —
`BUG-260902-01`, 2026-09-02 (#3). **That is the cost of a register nobody sweeps**, and it is
`REG-02`'s case in one seed.

⚠ **One thing this seed got WRONG, recorded rather than quietly fixed:** it says the panel
*"needs the panel to know the owning run's terminal state"*. The shipped fix needs only whether a
run is **live** — `useStreamingForThread || useLoadingForThread`. That is a weaker requirement,
and it matters: the terminal state is not reliably knowable for an old thread, while liveness is,
so the weaker signal is what makes all **53 unmarked legacy rows** honest without a backfill.

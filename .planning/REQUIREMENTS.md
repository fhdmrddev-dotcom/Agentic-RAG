# Requirements: Agentic RAG — v3.2 Skill Eval Studio + Self-Improving

**Defined:** 2026-06-28
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Scope:** Eval persistence + self-improvement loop + skill publish gate — the net-new eval+versioning backend that turns the Skill Trigger Tuner into a full iterative improvement cycle.

> **Red line (applies to every requirement):** never fork the shared Deep/agent-loop/provider path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime. **SEED-002 pre-work note:** catalog-injection-cost decision (full vs target-only inject during eval) is resolved in EVAL-02 planning; skills tab redesign scope is confirmed as PANEL-01 (Evals panel addition, not full redesign). **SC#10 mandate applies to every phase touching streaming, agent loop, provider routing, or UI state.**

## v1 Requirements (CORE — committed to this milestone)

Each maps to exactly one roadmap phase.

### Skill Eval Persistence

- [x] **EVAL-01**: User can define a set of test cases (prompt + expected-behavior description) for a skill and save them persistently — test cases survive session and are editable before any run.
- [ ] **EVAL-02**: An eval run executes each test case with-skill vs without-skill (two completions per case), streams per-case progress over SSE, and persists the full result set (per-case outputs per provider) so results are readable after reload.
- [ ] **EVAL-03**: Eval results include a per-provider pass/fail verdict and side-by-side output comparison the user can read in the UI — the comparison is honest (no fabricated scores when a provider errored).
- [ ] **EVAL-04**: User can rate individual eval outputs (thumbs up/down) to create a human preference signal that informs the self-improvement loop.

### Skill Versions

- [x] **VER-01**: When a skill's instructions are saved (create or update), an immutable version snapshot is created — so eval run history is traceable to the exact instruction state that produced it and prior versions are viewable.

### Self-Improvement Loop

- [ ] **SI-01**: The system proposes instruction-body edits based on eval results + Tuner signal → user reviews the diff and approves → a new immutable skill version is created and auto-re-evaled before promotion — the human is always in the loop, the system never auto-applies.

### Skill Publish Gate

- [ ] **GATE-01**: A skill can only be published (made global / shareable) after at least one eval has run and passed — the publish flow surfaces this gate with a clear status, and blocks (or warns with evidence) if the eval requirement is unmet.

### Skill Evals UI

- [ ] **PANEL-01**: The Skills UI has a Skill Evals panel that surfaces: test case editor (add/edit/delete cases), eval run history list, run detail view (per-case side-by-side outputs + pass/fail), inline rating controls, and version history (diff-viewable). (G-2 sketch-gated.)

## v1 Requirements (STRETCH — gated behind CORE)

Ship only if CORE lands clean and budget remains (v2.9 / v3.1 precedent).

- [ ] **SI-02**: A description-only self-improve proposer drafts a description diff → human approves → a new immutable version is created. No instruction-body edits (description only). (v3.1 STRETCH carry-forward; depends on SI-01 eval substrate.)
- [ ] **TRIG-02**: Only plausibly-relevant skills are surfaced to the model for a given query, keeping the active catalog within a configurable token budget. (v3.1 STRETCH carry-forward; depends on Phase 123 CTX-03 pin substrate; G-5 catalog injection path; SC#10.)
- [ ] **COLL-02**: The `template_input` resolver is scoped to the current run — a template uploaded in one run is not visible or accessible in another. (v3.1 STRETCH carry-forward; depends on Phase 120 COLL-01 run-scope seam.)
- [ ] **SRH-01**: When a skill's script is non-Python (JS, shell, etc.), the agent surfaces an honest "cannot execute this skill type" signal rather than silently failing or narrating the code as if it ran. (v3.1 STRETCH carry-forward; DISC-01 Layer 1; SEED-044.)
- [ ] **RUN-01**: Run-end honesty — (a) baseline files seeded at run start no longer appear as dead "Download unavailable" cards in the final_output_files emit; (b) a run-end reconciler marks open todos as "ended with open todos" (never silently auto-completes). (SEED-094; backend agent_loop.py finalizer pair; additive, shared-path-safe.)
- [ ] **WF-01**: A curated set of fork-able starter workflows is available on the Workflows page as an is_global published shelf — users fork a starter into a personal draft instead of starting from a blank description. (SEED-084; no new runtime, one shelf section + content authoring.)

## Future Requirements (deferred beyond v3.2)

- DM Tier B (retention / check-in-out / approvals) → v3.5
- v2.9 STRETCH 105–109 (SCHED-01/GRID-01/GOV-02/PLUG-01/ROLE-01) → backlog
- Full Node.js / multi-language skill execution (DISC-01 full) → v3.3+
- Scheduled/automated skill eval runs (cron-triggered) → v3.3+
- Operator/admin role tier (ROLE-01) → v3.3+
- Public benchmark scoreboard (SEED-068) → TBD
- Conversation compaction (CTX-02 / SEED-041) → TBD
- SEED-093 tuner scoring honesty residuals (WR-04/05/06) → fold into TRIG-02 or dedicated tuner-polish phase

## Out of Scope (explicit exclusions)

- **No automatic skill improvement without human approval** — SI-01 is always human-in-the-loop; the system proposes, never applies
- **No eval enforced on existing published skills** — the publish gate applies to future publish actions only
- **No full skills tab redesign** — PANEL-01 adds the Evals panel; the existing Skills tab layout is otherwise unchanged (full redesign deferred)
- **No new eval runtime / eval provider** — evals re-use the existing agent loop + provider gateway (CORE eval pattern: with-skill vs without-skill on the same provider)
- **No public/team-shared eval cases** — test cases are per-user-scoped (same RLS model as skills)
- **No connectors or automated ingestion** (SEED-013/014) → v3.3/v3.4

## Requirement Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| EVAL-01 | Phase 132 | Complete |
| EVAL-02 | Phase 133 | Pending |
| EVAL-03 | Phase 134 | Pending |
| EVAL-04 | Phase 134 | Pending |
| VER-01 | Phase 132 | Complete |
| SI-01 | Phase 135 | Pending |
| GATE-01 | Phase 136 | Pending |
| PANEL-01 | Phase 137 | Pending |
| SI-02 (STRETCH) | Phase 139 | Pending (gated) |
| TRIG-02 (STRETCH) | Phase 140 | Pending (gated) |
| COLL-02 (STRETCH) | Phase 141 | Pending (gated) |
| SRH-01 (STRETCH) | Phase 142 | Pending (gated) |
| RUN-01 (STRETCH) | Phase 138 | Pending (gated) |
| WF-01 (STRETCH) | Phase 143 | Pending (gated) |

# Requirements: Agentic RAG — v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers

**Defined:** 2026-06-21
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Scope source:** `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md` (Option A — LOCKED + operator-approved 2026-06-21 via 2 research waves + a live DB forensic). Operator pressures: `.planning/research/v3.1-skills-eval/OPERATOR-INPUTS.md`.

> **Red line (applies to every requirement):** never fork the shared Deep/agent-loop/provider path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime. **Guardrails:** G-2 sketch-first on IA-01 + all WUX-* (live UI); G-5 hot files (`threads.py` firing, `context_window.py`/`agent_loop.py` trim path, `PhaseTimeline.tsx`/`PhaseCard.tsx`).

## v1 Requirements (CORE — committed to this milestone)

Each maps to exactly one roadmap phase.

### Collision & Context Isolation

- [ ] **COLL-01**: A skill that saves one file in a thread that previously ran a workflow emits exactly that one file — the sandbox-output harvest is run-scoped to its own run's baseline, so a prior workflow's leftover `/sandbox/output/` artifacts are never re-emitted (the confirmed live 2-files bug, Mechanism A).
- [ ] **CTX-01**: When Deep chat and a workflow share a thread, each mode's history reconstruction replays only its own messages — `messages.origin` (`deep` | `harness`) is recorded and filtered in `_reconstruct_history`, so workflow context never bleeds into a subsequent Deep turn.
- [ ] **IA-01**: A user launches workflows from one front door (the Workflows page) — the chat composer's Harness pill + in-chat workflow selector are removed, leaving a 2-pill General/Explorer composer, while the Harness↔Deep lock / 409 / reconcile behavior is preserved. (G-2 sketch-gated.)

### Cross-Provider Trust & Honesty

- [ ] **MP-01**: A model that silently fails a forced structured emit (e.g. the default model's no-metadata 400) is recovered by a force→coerce retry ladder in `forced_emit`, so a typed-artifact phase produces its emission instead of a silent empty result.
- [ ] **MP-02**: Provider forcing/strict behavior is doc-verified and honest per provider — an explicit `emit_tier` field replaces guesswork, the inert DeepSeek function-level `strict` is dropped, and GLM forcing is kept (intentional, live-verified) so each provider uses the emission path it actually supports.
- [ ] **MP-03**: Cross-provider reliability is measured, not assumed — the eval treats provider as a first-class axis with a per-provider scoreboard (trigger / force / recovery / honest-fail), pass-OR-documented, which gates any MP-02 tier change.
- [ ] **TDP-01**: Task/todo/workflow-step labels are concrete and honest on every provider (OpenAI-parity), not the bare tool name — an ungated prompt nudge fills `execute_code.description` and a deterministic frontend summarizer floor backstops providers that don't, without regressing providers that already do.

### Skill Triggering Quality

- [ ] **TRIG-01**: A skill author can tune a skill's description against a held-out should-trigger / should-not-trigger benchmark (Skill Trigger Tuner) and pick the winning description by held-out score, measured cross-provider on production model-ids.
- [ ] **TRIG-03**: At `save_skill` (and in the skill-creator loop) a description-quality lint flags weak/ambiguous trigger descriptions before the skill is saved, so new skills start with descriptions that actually fire.
- [ ] **CTX-03**: A loaded skill's instructions stay available for the rest of the session — they are pinned out of the rolling trim window so a skill doesn't silently fall out of context mid-conversation.

### Workflow Studio UX

- [ ] **WUX-01**: A user sees the "soul" of a workflow at a glance in three sizes (library card / run header / publish summary): its purpose (`business_requirement`), what it needs, a glyph-dot phase spine (no type ribbons/index noise), one tier chip, and its output line. (G-2 sketch-gated.)
- [ ] **WUX-02**: Authoring and running expose a strict↔loose disclosure keyed off `deriveTier` — two clear doors ("Describe & run" vs "Author & govern") — where nothing is removed, advanced controls are demoted one click, and accuracy + control are preserved. (G-2 sketch-gated.)

## Stretch Requirements (this milestone — ship only if CORE lands clean and budget remains)

Tracked in the roadmap as STRETCH phases, gated behind CORE completion (v2.9 105–109 precedent). Not part of the CORE acceptance bar.

- [ ] **SI-02**: A bounded, human-in-the-loop, **description-only** self-improvement proposer — eval → propose a description diff → DRAFT → human approves → new immutable version; never auto-publishes, uses held-out selection and the Phase-102 judge as a gate. (Anthropic stance: direction yes, autonomy no.)
- [ ] **TRIG-02**: A smart-dispatch relevance pre-filter + catalog token budget, so only plausibly-relevant skills are surfaced to the model and the catalog stays within budget.
- [ ] **WUX-03**: The publish gauntlet renders as a pip-strip + worded verdict with raw-on-demand, and idle PhaseCards stay quiet.
- [ ] **TDP-02**: A tool's `description` streams live before `tool_start` (the preparing-window honesty improvement).
- [ ] **MP-04**: MiniMax malformed-args boundary repair + OpenRouter `require_parameters` for broader provider robustness.
- [ ] **COLL-02**: The `template_input` resolver is run-scoped too — defense-in-depth for the `render_template` path alongside COLL-01.

## Deferred (not in this milestone)

### → v3.2 "Skill Eval Studio (full) + Self-Improving"

- **SI-01**: `skill_versions` table + immutability trigger + eval tables (`eval_cases`/`runs`/`run_outputs`/`feedback`) + `run_skill_eval` + grader/comparator/analyzer roles + with-skill-vs-snapshot baseline + review viewer + skill publish gate. The PRD's net-new eval+versioning spine — large enough to be most of a milestone on its own.
- **STD-01**: agentskills.io frontmatter enforcement (name rules, description ≤1024, optional `metadata.version`).
- **DISC-01**: executable skill bundle / "run skill script" primitive (sequence AFTER COLL-01).

### Own-slot / backlog

- **CTX-02**: SEED-041 rolling conversation compaction (summarize the trim-head instead of deleting). Engine work — own slot.
- **CTX-04 / CTX-05**: `read_document` cap + per-provider token estimation; relevance-ranked recall.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Fully autonomous skill self-improvement (auto-publish, no human gate) | Anthropic's stance is direction-yes/autonomy-no; the v3.1 PRD already marks auto-improvement via meta-eval out of scope. Only the bounded human-in-the-loop **description-only** proposer (SI-02) is even a STRETCH. |
| Full instruction-body self-improvement loop | Depends on the v3.2 eval+versioning spine (SI-01); description-only is the v3.1 ceiling. |
| Provider-native skill loaders (per-provider activation mechanisms) | Routing activation through a normal `load_skill` tool call is the only mechanism that works identically across all providers; chasing provider-native loaders forks the shared path. |
| Drag-to-build visual workflow node editor | Anti-feature for the domain-expert buyer (confirmed v2.9 / Phase 103); WUX-01/02 stay describe + form + read-only graph. |
| Raw end-user filter/query DSL | Injection + UX hazard (D-v3.0-COMPILER); not reopened. |
| The eval+versioning backend (SI-01) | Deferred → v3.2; v3.1's TRIG-01 Trigger Tuner delivers skill-quality value without it. |
| Removing "launch-in-context" entirely | IA-01 keeps launch-in-context as an explicit action; the requirement is run↔chat **context isolation**, not removing the capability. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COLL-01 | Phase 120 | Pending |
| CTX-01 | Phase 120 | Pending |
| IA-01 | Phase 121 | Pending |
| MP-01 | Phase 122 | Pending |
| MP-02 | Phase 122 | Pending |
| MP-03 | Phase 122 | Pending |
| TDP-01 | Phase 122 | Pending |
| TRIG-01 | Phase 123 | Pending |
| TRIG-03 | Phase 123 | Pending |
| CTX-03 | Phase 123 | Pending |
| WUX-01 | Phase 124 | Pending |
| WUX-02 | Phase 124 | Pending |
| SI-02 (STRETCH) | Phase 125 | Pending (gated) |
| TRIG-02 (STRETCH) | Phase 126 | Pending (gated) |
| WUX-03 (STRETCH) | Phase 127 | Pending (gated) |
| TDP-02 (STRETCH) | Phase 128 | Pending (gated) |
| MP-04 (STRETCH) | Phase 129 | Pending (gated) |
| COLL-02 (STRETCH) | Phase 130 | Pending (gated) |

**Coverage:**
- v1 (CORE) requirements: 12 total — **12 mapped** (Phases 120-124)
- STRETCH requirements: 6 (gated, in-roadmap) — **6 mapped** (Phases 125-130)
- Mapped to phases: **18 / 18** ✓
- Unmapped: **0** ✓

**Phase map (CORE 120-124 · STRETCH 125-130):**
- Phase 120 — Collision Fix + Context Isolation: COLL-01, CTX-01
- Phase 121 — One Front Door for Workflows (IA): IA-01
- Phase 122 — Cross-Provider Trust & Honesty Parity: MP-01, MP-02, MP-03, TDP-01
- Phase 123 — Skill Triggering Quality: TRIG-01, TRIG-03, CTX-03
- Phase 124 — Workflow Studio UX — Soul + Strict↔Loose: WUX-01, WUX-02
- Phase 125 (STRETCH) — Self-Improve Proposer (description-only): SI-02
- Phase 126 (STRETCH) — Smart-Dispatch Relevance Pre-Filter: TRIG-02
- Phase 127 (STRETCH) — Gauntlet Pip-Strip + Quiet Idle Cards: WUX-03
- Phase 128 (STRETCH) — Live Description Before tool_start: TDP-02
- Phase 129 (STRETCH) — MiniMax/OpenRouter Arg Repair: MP-04
- Phase 130 (STRETCH) — template_input Resolver Run-Scope: COLL-02

---
*Requirements defined: 2026-06-21*
*Last updated: 2026-06-21 after roadmap creation (18/18 requirements mapped — CORE 120-124, STRETCH 125-130)*

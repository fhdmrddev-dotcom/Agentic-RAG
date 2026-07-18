# Phase 123: Skill Triggering Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 123-skill-triggering-quality
**Areas discussed:** Triggering semantics, Benchmark + tuner UX, Save-time lint, Skill pinning, Skill-builder model (operator-raised)

---

## Triggering semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Descriptions drive firing | Relax `agent_loop.py:1106` explicit-name-only instruction → load_skill on description match; should-not cases = false-fire rail; SC#10 UAT mandatory | ✓ |
| Keep prod conservative; tuner offline-only | Runtime unchanged; tuner scores in a harness that simulates triggering | |
| Per-skill auto-trigger opt-in | A flag makes only opted-in skills fire by description | |

**User's choice:** Descriptions drive firing.
**Notes:** This is the load-bearing decision — makes TRIG-01 real rather than decorative. Per-skill opt-in retained as a UAT-fallback contingency.

| Option | Description | Selected |
|--------|-------------|----------|
| Score + suggest candidates | Score current description + generate ≤N LLM rewrites, author picks winner by held-out score | ✓ |
| Score-only (manual rewrite) | Tuner only measures; author rewrites by hand | |

**User's choice:** Score + suggest candidates. Human drives every iteration (clear of Phase 125 SI-02).

| Option | Description | Selected |
|--------|-------------|----------|
| Author confirms, then save | Show winner + scores, explicit confirm → PATCH /skills | ✓ |
| Auto-apply the winner | Picking winner immediately writes skills.description | |

**User's choice:** Author confirms, then save.

---

## Benchmark + tuner UX

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: auto-seed + author edits | Tuner seeds should/should-not cases; author edits/approves | ✓ |
| Author writes all cases | Maximum control, high friction | |
| Fully auto-generated | Lowest friction, can drift from real phrasing | |

| Option | Description | Selected |
|--------|-------------|----------|
| 4 SC#10 axes, 1 model each | OpenAI/Anthropic/Google/OpenRouter representative model-ids; reuse eval_cross_provider.py | ✓ |
| Single model (active) | Cheapest, under-delivers "cross-provider" | |
| Full native-7 sweep | Most thorough, too slow for interactive loop | |

| Option | Description | Selected |
|--------|-------------|----------|
| Background job + live progress | Async, reuse run-buffer/SSE | ✓ |
| Synchronous (author waits) | Simpler, timeout-prone at this fan-out | |

| Option | Description | Selected |
|--------|-------------|----------|
| Panel in Skills page + sketch it | Hung off SkillDetailPanel/SkillsPage; G-2 sketch first | ✓ |
| Panel in Skills page, SKIP sketch | Same placement, waive G-2 | |
| Dedicated /skills/:id/tuner page | Standalone page, heavier IA | |

**User's choice:** Hybrid cases · 4 SC#10 axes · background job · panel + sketch.

---

## Skill-builder model (operator-raised via "Other")

**User's question:** Which model actually *builds* the skill — strongest models only, or any provider the user/admin selects, including companies that run local models (DeepSeek/own-infra) rather than pay for OpenAI/Anthropic?

**Resolution:** The skill-builder model is a configurable app/user setting (reusing the `harness_authoring_model` knob pattern), strong default, selectable across the FULL provider list — paid cloud **and** local/self-hosted, treated equally. No paid-provider hardcoding / no SPOF (mirrors 111.1). Decoupled from the benchmark target set: builder *writes* candidates, targets *measure* firing. → CONTEXT D-08.

**Notes:** Required a terminology clarification round ("local providers" = self-hosted via Ollama/LM Studio/OpenAI-compatible; "SPOF" = a single mandatory paid dependency like the old OpenAI embedding requirement). User confirmed: any provider — paid or self-hosted — can build skills; nothing locked to a paid provider.

---

## Save-time lint

| Option | Description | Selected |
|--------|-------------|----------|
| Warn, never block | Never-silent flag + reason, save proceeds | ✓ |
| Block on hard failures, warn on soft | 400 on truly broken descriptions | |

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic heuristic | Cheap instant checks, no LLM in save path | ✓ |
| LLM-judge call | More accurate, adds latency/cost to every save | |
| Heuristic + optional deep check | Best of both, more surface to build | |

| Option | Description | Selected |
|--------|-------------|----------|
| Warning offers "Tune this" | One-click into Trigger Tuner | ✓ |
| Keep them independent | Less coupling, more friction | |

**User's choice:** Warn-never-block · deterministic heuristic · "Tune this" handoff.

---

## Skill pinning (CTX-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Tag the load_skill result as protected | Flag tool-result, trim treats as non-trimmable; de-dupe on reload | ✓ |
| Hoist instructions into system block | Always-preserved, but restructures system prompt + dup risk | |

| Option | Description | Selected |
|--------|-------------|----------|
| Pin all, with a safety valve | Pin all loaded skills; cap at a budget fraction, evict LRU + honest marker | ✓ |
| Hard cap: last K skills only | Simple bound; early skill can still fall out | |
| Unbounded — pin everything | Simplest; pathological session can starve recent budget | |

**User's choice:** Tag-protect mechanism · pin-all-with-safety-valve.

---

## Claude's Discretion

- D-11 heuristic thresholds (min length, generic-phrase list, name-echo ratio).
- `≤N` candidate count (D-02) and the pinned-budget fraction (D-14).
- Concrete service/route names (`skill_tuner_service.py`, `skill_lint`, tuner-run endpoints).

## Deferred Ideas

- Per-skill auto-trigger opt-in / kill-switch — UAT-fallback contingency for D-01, not a separate phase.
- Smart-dispatch relevance pre-filter + catalog token budget — TRIG-02 / Phase 126 (STRETCH).
- Autonomous description proposer — SI-02 / Phase 125 (STRETCH).
- agentskills.io frontmatter enforcement (description ≤1024) — STD-01 / v3.2.

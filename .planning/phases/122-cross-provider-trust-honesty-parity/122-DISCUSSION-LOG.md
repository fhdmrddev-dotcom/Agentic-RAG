# Phase 122: Cross-Provider Trust & Honesty Parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 122-cross-provider-trust-honesty-parity
**Areas discussed:** Recovery ladder scope (MP-01), emit_tier model (MP-02), Scoreboard + gate (MP-03), Task-label breadth (TDP-01)

---

## Recovery ladder scope (MP-01)

### Q1 — How wide should the force→coerce recovery ladder reach?
| Option | Description | Selected |
|--------|-------------|----------|
| All consumers (fix once) | Ladder in forced_emit → every caller recovers (workflow emit, judge, NL-authoring, default metadata extraction). Closes BUG-260615-01. | ✓ |
| Workflow typed-emit only | Scope to llm_emit/render_template; leave extraction/judge/NL-auth on today's behavior. | |

**User's choice:** All consumers (fix once) → **D-122-01**
**Notes:** The defect is in the shared path, so the fix belongs there; closes the silently-broken default-config metadata extraction as a side effect.

### Q2 — What recovery rungs before honest fail?
| Option | Description | Selected |
|--------|-------------|----------|
| Strict→non-strict→coerce→fail | 4 rungs; the non-strict-force rung is the proven-missing one (OpenAI/DeepSeek/Z.ai 400 strict, accept non-strict). | ✓ |
| Force→coerce→fail | 3 rungs; skips the proven non-strict retry. | |
| You decide (researcher) | Lock the contract, let researcher pin rung order against provider docs. | |

**User's choice:** Strict→non-strict→coerce→fail → **D-122-02**
**Notes:** Each rung is an existing known-good mode, just chained.

### Q3 — Feed a chronic coerce-recoverer back into emit_tier automatically?
| Option | Description | Selected |
|--------|-------------|----------|
| Runtime recovers, scoreboard decides tier | Ladder never mutates the registry; tier changes go through the MP-03 gate. Ladder logs the winning rung. | ✓ |
| Runtime auto-demote | Self-healing demotion at runtime; mutates declared capability invisibly. | |

**User's choice:** Runtime recovers, scoreboard decides tier → **D-122-03**
**Notes:** Honesty is measured, never silently mutated; matches "no silent tier flip" (SC#3).

---

## emit_tier model (MP-02)

### Q1 — How should emission capability be declared?
| Option | Description | Selected |
|--------|-------------|----------|
| Single emit_tier enum | force_strict \| force \| coerce per model; replaces two-bool combo + the hardcoded provider=='openai' gate; doc-verified via capability_source. | ✓ |
| Keep two bools, de-guess | Keep bools, delete the provider gate, add verification notes. | |
| You decide (researcher) | Lock intent, let researcher pick enum-vs-bools + migration cost. | |

**User's choice:** Single emit_tier enum → **D-122-04**
**Notes:** This is literally the "explicit emit_tier replaces guesswork" the requirement asks for; reads cleanly into the ladder's top rung.

### Q2 — What does an un-doc-verified model default to?
| Option | Description | Selected |
|--------|-------------|----------|
| Default to coerce (safe) | Never assumes forcing/strict; promoted only when the scoreboard proves it. Matches today's default-SAFE. | ✓ |
| Default to force, let ladder catch | Optimistic; asserts unverified capability, leans on recovery. | |

**User's choice:** Default to coerce (safe) → **D-122-05**
**Notes:** Locked from requirement (not asked): drop the inert DeepSeek function-level strict; keep GLM forcing (scout: non-strict `force`, no json_schema response_format built — verify live).

---

## Scoreboard + gate (MP-03)

### Q1 — Where does the scoreboard live and how does the gate work?
| Option | Description | Selected |
|--------|-------------|----------|
| Extend eval script, manual gate | Extend eval_cross_provider.py → dated .planning/eval/ artifact; operator gate ritual (grep before tier flip). Reuses D-01/D-04. | ✓ |
| LangSmith experiments | Richer history/UI, but not load-bearing; pulls state out of git-diffable artifacts. | |
| Automated pytest gate | Strongest enforcement; needs live cross-provider calls in CI (secrets + flakiness + cost). | |

**User's choice:** Extend eval script, manual gate → **D-122-06**

### Q2 — What does "pass-OR-documented" mean operationally?
| Option | Description | Selected |
|--------|-------------|----------|
| Known-limitation row in the artifact | PASS / FAIL / DOCUMENTED cells; DOCUMENTED = explicit note+evidence in the scoreboard; valid because declared emit_tier already reflects reality. | ✓ |
| Cross-referenced SEED/bug entry | A failing axis must point to a separate SEED/bug file. | |

**User's choice:** Known-limitation row in the artifact → **D-122-07**
**Notes:** The scoreboard IS the record (declared tier == measured reality). 4 axes (trigger/force/recovery/honest-fail) + native-7-gate / OpenRouter-best-effort roster carry from the requirement + D-03.

---

## Task-label breadth (TDP-01)

### Q1 — How broad should the label work be?
| Option | Description | Selected |
|--------|-------------|----------|
| Targeted: execute_code + verify floor | Ungated execute_code.description nudge + verify existing inferLabel floor + SC#10 UAT proves no bare tool names; widen only if UAT surfaces a gap. | ✓ |
| Comprehensive per-tool summarizer | Build a deterministic summarizer for every tool now. | |
| You decide (researcher) | Lock the contract, let researcher size the floor against humanize()/inferLabel. | |

**User's choice:** Targeted: execute_code + verify floor → **D-122-08**
**Notes:** Scout shrank this — tool_args_progress is already cross-provider, inferLabel floor already exists; the only real gap is the ungated prompt nudge.

---

## Claude's Discretion

- Exact ladder implementation mechanics inside forced_emit + the "which rung won" telemetry shape.
- emit_tier as a literal enum field vs a validated derived view + the migration shape.
- Exact scoreboard artifact schema/columns and axis scoring.
- Exact wording/placement of the execute_code.description nudge in the shared system prompt.

## Deferred Ideas

- "Setting up agent…" dispatch-latency banner + live description before tool_start (BUG-260607-02) → TDP-02 / STRETCH Phase 128.
- MiniMax malformed tool-args 400 + OpenRouter require_parameters (BUG-260607-03) → MP-04 / STRETCH Phase 129.
- Comprehensive per-tool frontend summarizer → only if SC#10 UAT shows a bare tool name.
- Runtime auto-demotion of a model's tier → rejected (D-122-03).

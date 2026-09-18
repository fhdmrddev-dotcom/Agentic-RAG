---
seed_id: SEED-070
title: Dynamic execute-backend selector — monty (lightweight, no-deps) vs Docker (library-heavy), to cut sandbox warm-up latency
status: planted
planted: 2026-06-10
phase_origin: Phase 101 discuss-phase 2026-06-10 (operator note — "investigate pydantic/monty; keep it as an option to dynamically choose between it and Docker")
category: composition / engine-optionality — a backend-selector seam, NOT a new runtime
related_seeds: [SEED-051, SEED-069]
relates_to:
  - "https://github.com/pydantic/monty — experimental Rust restricted-Python interpreter; ~0.06ms startup vs Docker ~195ms; NO third-party library support; subset of Python (no class defs yet, limited stdlib: sys/os/typing/asyncio/re/datetime/json); explicitly 'not ready for prime time'"
  - "backend/app/services/sandbox_service.py — the Docker execute_code substrate + per-thread cached sessions + SANDBOX_IMAGE; the seam a selector would route through"
  - ".planning/reported-bugs/setting-up-agent-hides-model-activity.md (BUG-260607-02) — the 'Setting up agent…' warm-up latency (Docker spin-up + pip installs) monty could relieve for no-deps code"
  - "Phase 101 D-13 — keep the render-execution backend a swappable seam so this selector stays possible (the render path itself MUST stay on Docker — it needs docxtpl/python-docx/python-pptx/openpyxl, which monty cannot run)"
  - "CLAUDE.md — sandbox setup (Dockerfile.sandbox + SANDBOX_IMAGE); feedback_preserve_engine_optionality (per-aspect swappable engines)"
re_open_triggers:
  - A sandbox warm-up / execute_code performance phase is scoped (the "Setting up agent…" latency, BUG-260607-02, becomes a priority)
  - pydantic/monty leaves experimental (gains class defs + a stable embedding API) and proves a real perf win on representative agent code
  - A lightweight deterministic-compute path (e.g. worded→ordinal mappings, simple data transforms) needs to run without paying the Docker spin-up tax
priority: low — high potential perf upside (microsecond vs ~195ms startup) but blocked on monty maturity + a no-deps use-case; render path is permanently Docker-only (library dependency)
suggested_phase: a future sandbox/perf phase (v3.x); NOT v2.9 — Phase 101 only preserves the swappable seam (D-13)
surface: Agentic-RAG
trigger_when: unset
---

# SEED-070 — Dynamic execute-backend selector (monty vs Docker)

## The idea

The agent's code execution currently always pays Docker's spin-up cost (~195ms +
per-chat `pip install` warm-up — the observable lag behind `BUG-260607-02`'s
"Setting up agent…" banner). **pydantic/monty** is an experimental Rust-written
restricted-Python interpreter with **microsecond startup** (~0.06ms) and
language-level (not OS-level) sandboxing. The forward idea: a **dynamic
execute-backend selector** —

- **monty** for *lightweight, no-dependency* Python (deterministic computes, simple
  data transforms, quick agent snippets that touch only the allowed stdlib),
- **Docker** for *library-heavy* work (the template render — docxtpl / python-docx /
  python-pptx / openpyxl — matplotlib / pandas / etc.).

— so the common lightweight case skips the container tax while heavy work keeps the
full, mature isolation.

## Why it is NOT a Phase-101 option (the hard constraint)

monty has **no third-party library support**. The Phase-101 render path *is*
third-party libraries (docxtpl writes the OOXML). So **the render path stays
Docker-only, permanently.** Phase 101's only obligation to this seed is **D-13** —
route render execution through the existing `sandbox_service` seam so the backend
stays swappable, painting nothing into a corner.

## Why it is worth keeping (durable value)

- **Latency.** Microsecond vs ~195ms startup directly attacks the warm-up lag in
  `BUG-260607-02` for the no-deps case.
- **Engine optionality** (operator ethos, `feedback_preserve_engine_optionality`) —
  one home per concern with a swappable backend, chosen per workload.
- **Security shape** — monty's language-level restriction (explicit fs/env/network
  gating, memory/stack/time limits) is a clean fit for "run this tiny computed
  field" without a whole container.

## Deliberately NOT in scope (when it lands)

A new runtime (it's a backend behind the existing seam); replacing Docker (the
render + library-heavy paths stay on Docker); adopting monty before it leaves
experimental.

## Links

`.planning/reported-bugs/setting-up-agent-hides-model-activity.md` (BUG-260607-02) ·
`backend/app/services/sandbox_service.py` · Phase 101 D-13 (swappable render-backend seam) ·
SEED-051 (workflow authoring) · `https://github.com/pydantic/monty`

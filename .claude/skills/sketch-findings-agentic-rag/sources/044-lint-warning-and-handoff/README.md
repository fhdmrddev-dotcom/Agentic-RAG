---
sketch: 044
name: lint-warning-and-handoff
question: "How does the never-block weak-description warning read in the Skills form (D-09), how does the one-click 'Tune this' handoff feel (D-12), and where does the builder-model knob (D-08) sit?"
winner: "A"
tags: [phase-123, skill-triggering, trig-03, lint, weak-description, tune-this-handoff, builder-model, d-08, honesty]
---

# Sketch 044: Lint Warning, "Tune this" Handoff & Builder Model

## Design Question

TRIG-03 is a **save-time, deterministic, never-block** lint (D-09/D-11) that flags a weak trigger description
with a **specific reason**, on BOTH the human Skills form AND the agent's `save_skill` path (D-10). When it
fires, it offers a one-click **"Tune this"** into the Trigger Tuner (D-12). Alongside it: the **builder-model
knob** (D-08) — the configurable, provider-agnostic model that *writes* candidates + seeds cases. How loud is
the warning, and where does each piece sit?

## How to View

`open .planning/sketches/044-lint-warning-and-handoff/index.html`

## Variants

- **A: Inline under Description ★** — the warning sits directly under the Description textarea, with the specific
  reasons (echoes name / no trigger verb / too short) and a "Tune this →" button. Closest to the thing it's
  about; hardest to miss. Right column shows the **agent `save_skill` path** + the **builder-model knob**.
- **B: Dismissible banner** — an orientation-level banner at the top of the form. Cleaner field, but farther from
  the Description and dismissing loses the cue. Shows the silent-when-healthy state.
- **C: Label chip + popover** — the quietest: a ⚠ chip beside the Description label, click for reasons + Tune this.
  Lowest noise — but "never silent" leans entirely on the chip being noticed (flag for UAT).

## What to Look For

- **Never block, never silent:** the save always proceeds; the reason is always specific. Which placement keeps
  the warning *honest* (noticed) without nagging?
- **The "Tune this" seam:** one click → the Trigger Tuner (041) for this skill. Does the handoff feel like one
  authoring flow (TRIG-03 → TRIG-01)?
- **The agent path matters:** the same lint must surface on `save_skill` (D-10) without hard-failing the tool
  mid-task — variant A shows the chat-surface treatment.
- **Builder model (D-08):** strong default (`claude-haiku-4-5`), selectable across the **full provider list incl.
  local** (Ollama / LM Studio / OpenAI-compat / DeepSeek-on-own-infra), an always-on cloud/local tag, and an
  explicit "decoupled from the benchmark targets" note (builder *writes*, targets *measure*).

## Build Notes (reuse vs net-new)

- **Reuse:** the real `SkillForm` / `SkillDetailPanel` fields (Name / Description / Instructions); the
  `harness_authoring_model` + `resolve_authoring_model()` knob pattern (`config.py:1004`) for D-08, and the
  Phase-111.1 provider-picker (sketch 024) local/cloud footer language; `PATCH /skills` + `POST /skills`
  (`skills.py:127/260`) + the `save_skill` handler as the three lint hook points (D-10).
- **Net-new:** the `skill_lint` deterministic heuristic (non-empty · not name-echo · has verb · length-bound ·
  not duplicated — also covers STD-01's ≤1024 hint for free), the warning render in all three surfaces, and the
  "Tune this" → Tuner navigation.
- **Honesty (load-bearing):** warn-never-block on every path including the agent's; the reason is always named;
  the builder knob never hardcodes a paid provider (mirrors the 111.1 embedding-SPOF removal).

---
seed_id: SEED-189
title: The agent iteration cap is a hardcoded source constant — not a setting, not an env var, not operator-configurable
created: 2026-08-19
planted_during: Local-model session (operator asked whether the iteration cycle is UI-configurable)
status: planted
priority: medium
relates_to:
  - SEED-180 — continue PAST the cap (compaction / indefinite continuation). Adjacent but different:
    180 is about escaping the cap, this is about CHOOSING it.
  - SEED-022 — timeout settings UI with tier presets. Same "operator should not edit source/.env"
    complaint, different knob (timeouts, not iteration count).
  - BUG-260818-03 — the Continue affordance did not surface at the iteration cap.
trigger_when: >
  Plan it with the chat run-lifecycle phase, or with the Settings-overhaul milestone that
  carries SEED-022 — whichever lands first. Raise to a requirement if an operator running a
  local model reports a task that cannot finish because the cap fires before the work does.

  Discharged when an operator can change the iteration cap from the Settings UI (or the Model
  Registry, per-model) without editing source and restarting.
surface: Agentic-RAG
---

# SEED-189 — The iteration cap is hardcoded

## The finding

`backend/app/services/agent_loop.py`:

```
:1283    max_iterations = 8    # GEN-04: was 6
:1287    max_iterations = 15   # GEN-04: was 8
```

Two **literal constants in source**. The cap is:

- not in `Settings` / `app_settings` / `user_settings`
- not an environment variable
- not a `model_capabilities_overrides` column
- not exposed in any UI surface

Changing it requires editing Python and restarting uvicorn. That contradicts the
project rule that *"settings live in `user_settings` / `app_settings` and the
Settings UI; env vars are for secrets and infra only"* — this one isn't even an
env var.

## Why it matters more for local models

The cap interacts badly with slow local inference. Measured 2026-08-19 on a
20B local model: a weekly-report run consumed **7 iterations** for a task a
hosted model finished in 4. A local model that reasons more per round, or
re-searches after a trim, burns iterations faster — so the same cap is
effectively tighter on the hardware least able to afford it.

An operator on constrained hardware may want a *higher* cap (long task, slow
model, willing to wait). An operator on a server serving many users may want a
*lower* one (bound worst-case wall-time = `max_iterations × per_call_budget`,
per the comment at `config.py:1034`). Neither can express that today.

## Shape of the fix (not a design, just the seam)

Per-model is probably the right scope rather than global, since the right cap
tracks the model's reasoning verbosity — which would make it a
`model_capabilities_overrides` column beside `llm_call_timeout_seconds` and
`max_output_tokens`, and therefore already operator-editable in the Model
Registry UI with no new surface.

⚠ Whatever the scope, the bound must stay **enforced server-side** — the cap is
also the guard on worst-case wall-time and cost, so it cannot become a
client-supplied value.

## What this seed is NOT

It is not SEED-180. That seed is about carrying one task to completion *past* the
cap via continuation and compaction. This one is about letting the operator
choose where the cap sits in the first place. They are complementary: 180 makes
the dead end survivable, 189 makes it avoidable.

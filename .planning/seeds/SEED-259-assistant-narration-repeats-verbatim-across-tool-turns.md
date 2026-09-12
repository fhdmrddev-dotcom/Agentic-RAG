---
seed_id: SEED-259
title: A model's inter-tool narration repeated VERBATIM across turns — observed, never diagnosed, and now hidden by the fold rather than explained
created: 2026-09-13
planted_during: BUG-260912-01, at its close
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - BUG-260912-01 — the fold that now HIDES this. ⚠ That is precisely why a seed is needed: the
    symptom left the screen and the cause did not leave the system.
  - SEED-173 / SEED-172 — the observation is on a self-hosted 4B GGUF over a tunnel, the
    configuration whose behaviour parity is already known to be unmeasured.
  - `project_local_models_structured_mode_trap` — a local model behaving differently in ways that
    are silent rather than erroring.
trigger_when: >
  Anyone sees an assistant message repeat the same sentence across tool turns; OR the agent loop's
  message-assembly for tool-calling turns is touched; OR someone measures a self-hosted model's
  multi-turn coherence for SEED-173.
---

# The observation

Operator screenshot, 2026-09-12, provider `custom`, model `XHToken/Spark-X2.5-4B-GGUF` over a
Cloudflare tunnel. Across a five-tool run the assistant body carried the same three sentences
**about three times each** — *"I'll start by searching for RPA research by Fahed Mrad…"*,
*"I found several relevant documents…"*, *"Excellent analysis! Now let me also analyze the
dissertation…"* — with no separator between them (`…in parallel.I found several…`).

# What was RULED OUT, by reading the code rather than guessing

- **The backend does not re-send text.** `agent_loop.py:2203-2207` emits only the NEW delta and the
  accumulator is reset per tool-calling turn.
- **The frontend does not double-apply.** `StreamsProvider`'s delta path appends each delta once.
- **The one genuine exact-duplicate path is MiniMax-gated.** `:2732`'s arg-repair *"drops the bad
  turn and re-asks once"* after its deltas already reached the browser — a real duplicate generator,
  but guarded on the resolved provider being MiniMax, and this run was `custom`.

# What remains

**The most likely cause is the 4B model restating its plan each turn** — plausible, unproven, and
**not diagnosable from a screenshot**. Confirming it needs the run's actual delta sequence.

⛔ **THE REASON THIS IS A SEED AND NOT A CLOSED ITEM:** BUG-260912-01 moved narration into a fold, so
this symptom is no longer VISIBLE. Nothing about it was fixed. A later reader seeing clean bodies
must not conclude the repetition was addressed — it was hidden, and that is a different thing.

# How to measure it when the trigger fires

Capture the raw SSE `delta` sequence for one run (the run buffer is `run:{run_id}` in Redis) and
check whether the repeated sentences arrive as separate deltas from the provider. If they do, it is
the model and the answer is a capability/registry question (SEED-172/173). If they do not, the
duplication is ours and this becomes a bug with a known home.

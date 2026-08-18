---
seed_id: SEED-175
title: The judge/authoring/builder fallback ladders still gate on the DEPRECATED-UNREAD `forced_emission` bool while the emission ladder reads `emit_tier` — measured 0 of 61 rows disagree, so the drift is LATENT, and it is now a GATE rather than a note
created: 2026-08-18
planted_during: Phase 196 close (plan 196-09); the drift itself was measured and deliberately left alone by plan 196-02
status: planted
priority: low
relates_to:
  - D-122-04 — the decision that DEMOTED `forced_emission` / `strict_json_schema` in favour of the
    `emit_tier` ladder. `strict_json_schema` is separately recorded as inert on DeepSeek (no `/beta`
    base_url).
  - Phase 196 D-14 / migration 120 — `emit_tier` became a real, operator-correctable column, which is
    what makes this drift able to go live at all.
  - BUG-260731-01 / Phase 196 D-17 — the judge-consumer rewiring. This drift sits in the SAME function
    and was deliberately NOT touched by that plan.
  - SEED-174 — the same three resolvers, a different defect in them.
  - CLAUDE.md § UAT roster — the `emit_tier` vocabulary and why an unregistered id measures a weaker
    configuration than the one that ships.
trigger_when: >
  `backend/tests/unit/test_196_forced_emission_drift_trigger.py` goes RED. That is the whole trigger —
  it is a gate, not a reminder, and it fires the day the drift stops being latent.
---

# The drift

Two ladders in this codebase answer *"can this model be forced to emit?"* and **they read different
columns.**

| Ladder | Reads | Where |
|---|---|---|
| The **emission** ladder — what actually happens at the provider call | **`emit_tier`** (`force_strict` / `force` / `coerce`) | `forced_emit._RUNGS_BY_TIER`, via `cap.get("emit_tier", "coerce")` |
| The **fallback-candidate** ladders — which default model a resolver picks when its knob is unset | ⚠ **`forced_emission`**, the DEPRECATED-UNREAD bool | `validator_kinds.py:83-86` · `workflow_authoring.py:202-205` · `skill_tuner_service.py:~100` |

D-122-04 demoted `forced_emission`. The emission path stopped reading it. **The three fallback
ladders did not**, and each says `get_model_capability(candidate).get("forced_emission")` in its own
docstring, so the drift is documented into three places as if it were the design.

# It is LATENT, and that is a measurement rather than a hope

**Measured 2026-08-18 against the live registry, and re-derived at this close rather than inherited
from `196-02`:**

```
$ cd backend && ./venv/Scripts/python.exe -c "
from app.config import MODEL_CAPABILITIES as M
bad=[m for m,c in M.items() if bool(c.get('forced_emission')) != (c.get('emit_tier') in ('force','force_strict'))]
print('total', len(M), 'bad', len(bad), bad[:5])"
total 61 bad 0 []
```

**0 of 61 rows disagree.** `emit_tier` distribution: `force` 39 · `force_strict` 17 · `coerce` 5.
And both fallback candidates the judge ladder walks — `claude-opus-4-8`, `gpt-5.5` — resolve
identically under either flag, so **even a partial drift would have to land on one of those two ids
to change any resolver's answer.**

# Why it was deliberately NOT fixed inside plan 196-02, and the reason generalises

`196-02` was a **critical-bug plan** with one binding test: *set `app_settings.harness_judge_model`,
assert the resolved model changes, on all four consumers.* The drift lives in **a different function**
of the same file, it is **measurably inert**, and fixing it would have put an unrelated change inside
the diff a red test would have to be attributed to.

⚠ **That is the *"bug-fix plans smuggle in cleanups"* generalisation of G-7**, and it is the reason
this is a seed rather than a line edit: *a change with zero observable benefit still costs the plan
its ability to attribute a failure.*

# ⚠ What was done INSTEAD, and why it is strictly better than editing the line

**The drift is now a GATE.** `backend/tests/unit/test_196_forced_emission_drift_trigger.py` asserts
that for every row in `MODEL_CAPABILITIES`,

```
bool(forced_emission) == (emit_tier in {"force", "force_strict"})
```

It is a **NEW file**, deliberately not an addition to any judge test, so **a red result names this
drift and nothing else.** It carries a **non-vacuity floor** (the registry is non-empty and every row
has been examined) and a **POSITIVE CONTROL** running the same predicate over an inline fixture known
to disagree — *a guard whose control was never observed red is not evidence.* Its failure message
names this seed and tells the reader what to do.

**This converts a latent inconsistency into something that fires the day it stops being latent**,
which one line edit today could not have done: editing `validator_kinds.py:83-86` fixes one of three
ladders and leaves nothing watching the other two, or the registry.

> **RE-OPEN TRIGGER — MECHANICAL:** the trigger test goes RED.
>
> ```
> cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_196_forced_emission_drift_trigger.py -q
> ```

# The fix, when the trigger fires

**Point all three fallback ladders at `emit_tier`**, in one commit, with the trigger test as the
witness:

```python
cap.get("emit_tier") in ("force", "force_strict")   # not cap.get("forced_emission")
```

⚠ **The three ladders must move TOGETHER.** They were written by copying each other verbatim
(`resolve_skill_builder_model`'s docstring says *"mirrors `resolve_authoring_model`"*, which says
*"mirrors `resolve_judge_model`"*), so fixing one and leaving two is how the next reader concludes the
inconsistency is intentional. ⚠ **Update the docstrings in the same commit** — all three currently
state the `forced_emission` rule as the design, and a stale docstring is this project's recorded way
of stopping an audit with a number that was true once.

⚠ **Do NOT delete `forced_emission` from `MODEL_CAPABILITIES` as part of that fix.** That is a
separate, larger change with its own blast radius (`config.py` is a 42-phase file — see the hot-file
ledger), and bundling it would destroy the trigger test's ability to say *which* thing broke.

# What this seed does NOT claim

- It does **not** claim any model resolves incorrectly today. **0 of 61.** Both readings are published
  above so the next reader re-derives rather than trusts.
- It does **not** claim `strict_json_schema` is in the same state. That flag's demotion has its own
  measured story (inert on DeepSeek for want of a `/beta` base_url) and is not this drift.

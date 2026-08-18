---
seed_id: SEED-174
title: Two more model-resolver knobs read the env singleton — `resolve_authoring_model` is inert by ABSENCE (no column, no UI), and `skill_proposer_service.py:366` is inert by WIRING, a genuine FIFTH instance of the BUG-260731-01 defect class that is latent only because the operator's row is empty
created: 2026-08-18
planted_during: Phase 196 close (plan 196-09), while discharging D-17's four judge consumers
status: planted
priority: medium
relates_to:
  - BUG-260731-01 / Phase 196 D-17 — the four JUDGE consumers, now closed. This seed is what the
    same audit found beside them and deliberately did not fix.
  - Phase 103 (D-103-2) — shipped `resolve_authoring_model`, mirroring `resolve_judge_model` "verbatim",
    which is exactly how the defect travelled.
  - Phase 137 / D-08 — shipped `resolve_skill_builder_model`, mirroring `resolve_authoring_model`
    "verbatim". Three resolvers, one shape, one defect class.
  - SEED-116 / SEED-117 — config consolidation, and the settings-vs-control-room boundary.
  - CLAUDE.md § "Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are
    for secrets and infra only" — a model id is a VALUE, and all three resolvers say so in their own
    docstrings while reading the env tier anyway.
trigger_when: >
  ANY of: (1) an authoring-model knob is added to the Settings UI or to `app_settings`;
  (2) `app_settings.skill_builder_model` becomes non-empty on any environment — THIS IS THE URGENT
  ARM and it is one SQL query to check;
  (3) `resolve_authoring_model`, `resolve_skill_builder_model` or any of their call sites is edited
  for any reason;
  (4) a fourth resolver of this shape is added.
---

# The finding

`BUG-260731-01` was a **class** defect, not an instance. A resolver of the form

```python
def resolve_X_model(settings) -> str | None:
    model = getattr(settings, "X_model", None)
    ...
```

is **duck-typed**, so it accepts the env-backed `app.config.Settings` singleton and the DB-backed
`UserEffectiveSettings` **without complaint**. Passing the wrong one is therefore silent by
construction. Phase 196 (D-17) fixed the four **judge** consumers. **Three resolvers ship this
shape**, and the audit that fixed the judge found two more sites while it was there.

⚠ **They are NOT the same sub-species, and the distinction is what decides how urgent each is.**

## 1. `resolve_authoring_model` — inert by ABSENCE. Nothing lies to anybody.

**Measured 2026-08-18, this tree:**

| Fact | Value |
|---|---|
| `workflow_authoring.py:197` reads | `getattr(settings, "harness_authoring_model", None)` |
| `workflow_authoring.py:349`'s caller passes | `settings` — **the env singleton** |
| `settings.harness_authoring_model` | **`None`** |
| `resolve_authoring_model(settings)` | `claude-opus-4-8` (the fallback ladder) |
| `app_settings.harness_authoring_model` column | ⚠ **DOES NOT EXIST** — `information_schema.columns` returns nothing |
| A Settings UI knob for it | **none** |

**So it is inert by ABSENCE, not by wiring — and that is why it was out of Phase 196's scope.**
There is no column and no control, so **no operator has ever been told this value would be obeyed.**
The whole harm of `BUG-260731-01` was an honest-looking screen over an unread value; here there is no
screen. Nothing is currently wrong.

⚠ **What IS true is that the trap is pre-built.** The moment somebody adds the knob — a column and a
Settings field, the obvious next step — it will be inert on day one, for the identical reason the
judge knob was inert for a year, **unless the call site is changed in the same commit.**

**The fix, when the trigger fires, is mechanically identical to D-17's:** pass
`await load_app_settings_async()` instead of `app.config.settings` at `workflow_authoring.py:349`.
`resolve_authoring_model`'s body, signature and resolution order do **not** change — the defect is in
the argument, never in the resolver. **And ship the test D-17's own binding condition demanded: set
the row, assert the RESOLVED model changes.** The absence of that test is why the judge instance
survived from 2026-07-31 to 2026-08-17.

## 2. ⚠ `skill_proposer_service.py:366` — inert by WIRING. This one is a REAL instance of the defect, and it is latent only by luck.

**This is the finding worth acting on, and it was not in any plan's scope — it surfaced from reading
the neighbourhood.**

`skill_builder_model` is **not** like the authoring knob. It **has** an `app_settings` column
(migration `078_app_settings_skill_builder_model.sql`), it **has** a loader
(`user_settings.py:905`), and the Settings API **resolves it from the EFFECTIVE settings for
display** (`api/settings.py:263` — `resolved_skill_builder_model=resolve_skill_builder_model(s)`).
**That is the complete `BUG-260731-01` asymmetry: an honest screen over a value one consumer does not
read.**

**Measured 2026-08-18, this tree:**

| Consumer | What it passes | Verdict |
|---|---|---|
| `api/skill_tuner.py:435` | `user_settings` — the DB-backed object | ✅ **correct** |
| ⚠ `skill_proposer_service.py:366` | `from app.config import settings` — **the ENV singleton** | ❌ **the defect** |

```
env singleton skill_builder_model         = None
resolve_skill_builder_model(env)          = claude-haiku-4-5-20251001
app_settings.skill_builder_model (live)   = ''      <- EMPTY
```

⚠ **The drift is LATENT ONLY BECAUSE THE OPERATOR'S ROW IS EMPTY.** With `''` in the column, the
DB-backed object and the env singleton both fall through to the same fallback ladder and resolve
**identically**, so the two consumers agree today and nothing is observably wrong. **The moment an
operator sets that field in the Settings UI, the skill PROPOSER silently ignores it while the skill
TUNER obeys it — and the Settings screen shows the operator's pick resolved correctly the whole
time.**

⚠ **This is exactly the state `BUG-260731-01` was in before somebody turned the knob**, which is the
strongest argument for fixing it before it is observable rather than after.

> **RE-OPEN TRIGGER — MECHANICAL, one query, cheap enough to run at any milestone gate:**
>
> ```sql
> SELECT skill_builder_model FROM app_settings WHERE skill_builder_model <> '';
> ```
>
> **Any row returned means the drift is LIVE**, on every environment where it returns one. Re-run it
> against cloud as well as local — cloud config drifts from local and is this project's recorded #1
> gotcha.

**The fix is one line** — `skill_proposer_service.py:366` takes the DB-backed settings the way
`skill_tuner.py:435` already does — **plus the binding test.** It was not taken inside Phase 196
because that phase's scope fence was the judge consumers and the canvas picker, and because changing
a fourth service inside a critical-bug plan is precisely the *"bug-fix plans smuggle in cleanups"*
generalisation of G-7 that `SEED-175` records about its own sibling drift.

# Why one seed and not two

Because it is **one defect class with two exposures**, and splitting it would let the cheap half
(a missing column) hide the expensive half (a wired knob one consumer ignores). ⚠ **The generalisable
shape is the thing to remember, not either instance:** *a duck-typed resolver that accepts two
different settings objects carrying the same field name makes passing the wrong one silent, and the
same shape has now been copied verbatim into a third resolver because each author was told to mirror
the last one.* **A fourth copy is likelier than a fix unless the shape itself changes** — e.g. by
typing the parameter, or by making the resolvers take the resolved VALUE rather than a settings
object.

# What this seed does NOT claim

- **It does not claim any user-visible defect exists today.** Both exposures are measured latent, and
  the measurements are above rather than summarised.
- **It does not claim the judge fix was incomplete.** D-17's four consumers are closed, with a
  per-consumer test and a live three-row measurement; `BUG-260731-01` flipped to `closed` on that
  evidence.
- **It says nothing about judge FITNESS.** That is SEED-135's, it rates its own cause hypothesis
  MEDIUM, and it has never been live-verified.

---
id: BUG-260731-01
title: OPEN QUESTION — the Settings judge-model knob may be inert, because every judge consumer resolves it from the env-backed config.Settings singleton, not the DB app_settings row
reported: 2026-07-31
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/harness, workflows/publish-gauntlet, settings, eval/judge, observability]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-116, SEED-117]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: a724f275
  date: 2026-07-31
---

# BUG-260731-01: Is the `harness_judge_model` Settings knob actually wired to the judge shot?

> **Read this as an open question, not a finding.** Two lines of evidence point in opposite
> directions and neither has been closed out. A named decisive test is in
> [The decisive test](#the-decisive-test) below. Until that test runs, **both readings are live**
> and this report must not be cited as a confirmed defect.

## What we observed

During Phase 185 operator UAT (2026-07-30 evening) the publish judge failed once and passed once,
18 seconds apart, across an operator change to `app_settings.harness_judge_model`. Reading the code
afterwards to explain the pass raised the suspicion that the knob the operator turned is not the
value the judge shot reads.

### Evidence FOR the defect — the code shape

All judge consumers resolve the model from `app.config.settings`, the **env-backed pydantic
singleton**, never from the DB-backed `UserEffectiveSettings`:

| Consumer | Import | Resolve call |
|---|---|---|
| Publish gauntlet judge | `publish_service.py:882` — `from app.config import get_model_capability, settings` | `publish_service.py:894` — `model = resolve_judge_model(settings)` |
| In-run `llm_judge_rubric` validator | `validator_kinds.py:534` — `from app.config import settings` (function-local) | `validator_kinds.py:536` — `model = resolve_judge_model(settings)` |
| Eval judge (shot) | `eval_runner_service.py:305` — `from app.config import get_model_capability, settings` | `eval_runner_service.py:312` — `model = resolve_judge_model(settings)` |
| Eval judge (recorded model) | `eval_runner_service.py:639` — `from app.config import settings` | `eval_runner_service.py:645` — `judge_model = resolve_judge_model(settings)` |

`resolve_judge_model` (`validator_kinds.py:65-87`) reads `getattr(settings, "harness_judge_model", None)`
and, when falsy, returns the first forceable registry default from `("claude-opus-4-8", "gpt-5.5")`.

The two `harness_judge_model` fields are **different fields on different classes**:

- `config.py:1160` — `harness_judge_model: str | None = None` on the env-backed `Settings`. No
  `HARNESS_JUDGE_MODEL` key exists in `backend/.env` or `backend/.env.example` (checked by key name
  only, no value read), so it stays `None`.
- `user_settings.py:231` + `:910` — `harness_judge_model=str(_val(row, "harness_judge_model", None, ""))`
  on `UserEffectiveSettings`, with the in-code comment *"app_settings-only (env_attr=None readback
  below…)"*. **The DB value lands here** — on the object the judge consumers do not pass.

**Measured, this repo, HEAD `a724f275`, cold `backend/venv` process:**

```
raw settings.harness_judge_model            = None
resolve_judge_model(config.settings)        = 'claude-opus-4-8'
UserEffectiveSettings has the field         = True
```

Two further code facts sharpen it:

1. **The DB-backed object is in scope at the judge call and is not used for the model.**
   `publish_service.py:317-321` loads `owner_settings = load_user_settings(str(user_id))` (which is
   `load_app_settings()` — `user_settings.py:970-971` — i.e. the cached `app_settings` row), passes it
   into `_judge_golden_output(..., owner_settings=owner_settings)` (`:326-330`), and `_judge_golden_output`
   forwards it to `forced_emit(user_settings=owner_settings)` for **gateway key/config resolution only**
   (`:944`). The model still comes from the env singleton at `:894`.
2. **The Settings UI reads the other field.** `api/settings.py:271` computes
   `resolved_harness_judge_model=resolve_judge_model(s)` where `s` is the `UserEffectiveSettings`. So
   the UI would show the operator's DB pick resolved correctly **while the judge shoots the registry
   default** — an honest-looking screen over an unread value. That asymmetry is what makes this worth
   settling rather than shrugging at.
3. **The `ctx.judge_model` escape hatch has no producer.** `validator_kinds.py:532` reads
   `getattr(ctx, "judge_model", None)`, but a repo-wide grep for `judge_model` across `backend/app/`
   returns **no site that ever sets it**. So the in-run validator also falls through to the singleton.

### Evidence AGAINST the defect — the live A/B

This is the part that must not be buried, because it is the stronger evidence:

| Time (UTC, 2026-07-30) | Event |
|---|---|
| 20:13:20 | Operator changes `app_settings.harness_judge_model` `gemini-3.5-flash` → `gpt-5.5` |
| 20:13:38 | Golden run `ced8005d` starts — **18 seconds later** |
| — | Judge **passes**: `overall_score 82`, `publish_succeeded` |
| (immediately prior) | Publish with `harness_judge_model='gemini-3.5-flash'` — judge **failed**, `"provider_error"`, `overall_score` null, no verdict (run `da5541c0`) |

A clean A/B 18 seconds apart is hard to reconcile with an inert knob.

It gets harder still when the retry loop is accounted for: `_judge_golden_output` retries the judge
shot **up to 3 times on a non-verdict** (`publish_service.py:935-948`), breaking on the first real
verdict. So the failing publish was a `provider_error` that reproduced **three times in a row**. That
is the signature of a *deterministic* rejection (which the Google-schema hypothesis in the sibling
Phase-185 UAT notes would predict: `JudgeVerdict.model_json_schema()` carries `$defs` + a `$ref` that
`google_service.py::_GOOGLE_UNSUPPORTED_SCHEMA_KEYS` strips — **hypothesis, never live-verified**), not
of a transient. If the knob were inert, both publishes shot `claude-opus-4-8` on Anthropic and we would
be claiming an Anthropic transient that failed 3/3 and then vanished — a worse fit for the data.

### Why neither artifact settles it

Nothing recorded on either run names the model the judge shot actually sent:

- The `judge_verdict` audit row (`publish_service.py:333-345`) records `definition_id`,
  `overall_passed`, `overall_score`, `summary`, `failure` — **no model, no provider**.
- On failure `_judge_golden_output` returns `{"failure": last_failure}` (`publish_service.py:955-956`),
  discarding the `provider` that `forced_emit` puts in its result dict (`forced_emit.py:352`).
- `"provider_error"` is `forced_emit`'s **generic** label (`forced_emit.py:357`, set at `:471`) — it
  does not identify which provider raised.

So the DB and the API response are both silent on the one fact that decides this.

## Why it matters

`major`, and deliberately not `blocking` — the observed outcome was a *pass*, and no user-visible
result is currently known to be wrong.

- **If the defect is real:** every judge in the system (publish gauntlet, in-run `llm_judge_rubric`,
  Skill-Studio evals) silently ignores the operator's choice and runs `claude-opus-4-8`. That is a
  hard-coded paid-provider single point of failure behind a knob that *appears* to work, it violates
  the project's "settings live in `app_settings` / the Settings UI" rule for the one knob whose whole
  job is engine choice, and it means the 2026-07-30 20:13 "fix" was luck rather than a lever.
- **If the defect is not real:** the report still names a genuine observability hole — no artifact
  records the judge's model or provider, which is exactly why this question is open at all.
- Either way the ambiguity is expensive: the operator changed a setting, the symptom cleared, and we
  cannot say whether the setting did it.

## Hypothesized cause

**Hypothesis, not a finding.** A two-tier settings model (`env → config.Settings`, `DB → UserEffectiveSettings`)
where one knob is declared on *both* classes with the same name. `resolve_judge_model(settings)` is
duck-typed (`getattr(settings, "harness_judge_model", None)`) and therefore accepts **either** object
without complaint — so passing the wrong one is silent by construction. Every consumer happens to pass
the env-backed one; the DB-backed one is passed to the *same functions* for key resolution, which makes
the mistake easy to make and impossible to see.

Confidence: **HIGH** that the four call sites read the env singleton and that the singleton is `None`
on this box (both directly measured above). **UNRESOLVED** whether that translates into the judge
actually shooting `claude-opus-4-8` in the 2026-07-30 runs — the A/B says otherwise and no log or row
adjudicates.

## Runtime-overlay investigation (asked for explicitly) — NEGATIVE RESULT

Searched for any path that refreshes or overlays `app.config.settings` from the DB at runtime:

- **`apply_setup_overlay` (`config.py:1224-1253`, called once at import on `:1275`)** — the only
  function in production code that mutates the `settings` singleton after construction. It reads
  `/data/setup.json` via `setup_store.read_store()` and `setattr`s **only the enumerated `INFRA_KEYS`**.
  Its own docstring is explicit: *"ONLY the infra tier is sourced from the store — app-level keys
  (provider API keys, `operator_emails` as an app read, retrieval knobs) live in `app_settings` and are
  NEVER overridden here."* It is a file-store overlay, not a DB overlay, and it runs once at import.
- **`Settings.resolve_llm_provider` (`config.py:831`)** — a pydantic `@model_validator(mode="after")`.
  Runs at construction, from env only.
- **`setattr(settings, ...)`** — grep across `backend/` returns hits **only under `backend/tests/`**
  (monkeypatch in `test_146_operator_seed.py`, `test_147_health_probe.py`, `test_150_*.py`). No
  production site.
- **`backend/app/main.py`** — contains no `load_app_settings_async`, no `refresh_settings_cache`, no
  startup overlay.

**Conclusion: there is no code path that refreshes `app.config.settings` from `app_settings`.** This
makes the "inert" reading architecturally coherent — but it does not make it true, because the live
A/B still has to be explained.

## The decisive test

Two tests, cheapest first. Either one closes this report.

**Test A — zero code change, uses an existing recorded column.**
`eval_runner_service.py:465` persists `judge_model` into `eval_results` on the graded path, computed by
`resolve_judge_model(config.settings)` at `:645` — **the identical resolver on the identical object the
publish judge uses**. With `app_settings.harness_judge_model = 'gpt-5.5'`, run one Skill-Studio eval
case, then:

```sql
SELECT judge_model, created_at FROM eval_results ORDER BY created_at DESC LIMIT 1;
```

- Returns `claude-opus-4-8` → the singleton is what gets read; **the knob is inert** and the publish
  judge is inert too (same resolver, same input). The 20:13 A/B was coincidence and needs its own
  explanation.
- Returns `gpt-5.5` → the singleton somehow carries the DB value on a live worker; **the knob works**
  and this report closes as a false alarm.

Caveat, stated honestly: Test A measures the *eval* path directly and the *publish* path by
identical-code-shape inference, not by direct measurement.

**Test B — one added field, measures the publish judge directly.**
`forced_emit.py:467-470` already logs the raising rung at INFO — `forced_emit: rung=%s raised;
descending emit_tier=%s provider=%s` — and `:487-489` logs the winning rung the same way. **Both name
the provider but not the model.** Add `model=%s` to those two lines (or log the resolution at
`publish_service.py:894` immediately after `model = resolve_judge_model(settings)`), then:

1. Set `app_settings.harness_judge_model` to a model on provider X. Publish. Record the logged model.
2. Set it to a model on provider Y. Publish. Record the logged model.
3. Compare each logged model against the `app_settings.harness_judge_model` value read at the same
   moment.

- Logged model tracks `app_settings` → knob works, close this report.
- Logged model is `claude-opus-4-8` regardless → knob inert, promote to a confirmed defect.

**Free partial answer, if the log still exists:** the uvicorn log from 2026-07-30 ~20:12–20:14 already
carries `forced_emit: rung=… provider=…` lines for the failing publish. `provider=google` → the knob
was live. `provider=anthropic` → the knob was inert. Worth grepping before doing anything else.

**Durable fix regardless of outcome:** put `judge_model` + `judge_provider` into the `judge_verdict`
audit metadata (`publish_service.py:333-345`) on **both** the pass and fail paths, and surface the
provider in `_judge_golden_output`'s failure return instead of collapsing to bare `"provider_error"`.
This exact question then never needs a code change to answer again.

## Surface classification

`Agentic-RAG` — this app's settings-resolution seam and its harness/eval judge consumers.

## Suggested routing

- **Fold into in-flight phase:** **no.** Phase 185 is graded governance; this is the settings→judge
  wiring seam and the publish/eval judge path. Folding it would repeat the scope error the one-home
  rule exists to prevent.
- **Defer to future phase / milestone:** run **Test A** first (minutes, no code). Route only on the
  result. If inert → a small dedicated fix phase covering all four call sites plus the audit-record
  gap. If not inert → close, but keep the audit-record gap as its own small item.
- **Plant as seed:** only if Test A is not run soon. The generalisable shape — *"a duck-typed resolver
  accepts two different settings objects with the same field name, so passing the wrong one is silent"* —
  is a class defect worth a seed independent of this instance, and it sits next to [[SEED-116]] /
  [[SEED-117]] (config consolidation / the settings↔control-room boundary).
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

- **If the knob turns out to be inert**, the judge model is still changeable without a fix: the
  registry-default ladder in `resolve_judge_model` is `("claude-opus-4-8", "gpt-5.5")`, gated on
  `get_model_capability(candidate).get("forced_emission")`. Disabling / de-forcing the first candidate
  in the model registry moves the judge to the second. Crude, global, and not a substitute for the fix.
- **A per-workflow judge override already exists for the in-run validator only:** `config.get("model")`
  on the `llm_judge_rubric` ValidatorSpec (`validator_kinds.py:532`) wins over the singleton. The
  publish-gauntlet judge (`publish_service.py:894`) has **no** such override — it reads
  `_author_judge_criteria(definition)` for criteria but never a model.
- **Do not** work around it by setting an env var. `harness_judge_model` is deliberately app_settings-only
  (`user_settings.py:227-231`, D-11 / EVAL-05f); adding `HARNESS_JUDGE_MODEL` to `.env` would "fix" the
  symptom by entrenching the split-brain and would violate CLAUDE.md's env-is-for-secrets-and-infra rule.

## Reference / evidence links

- `backend/app/services/harness/publish_service.py:882`, `:894`, `:317-330`, `:333-345`, `:935-956`
- `backend/app/services/harness/validator_kinds.py:65-87` (`resolve_judge_model`), `:532-542`
- `backend/app/services/eval_runner_service.py:305-317`, `:639-645`, `:449-473` (`eval_results.judge_model`)
- `backend/app/config.py:1160` (env-backed field), `:831` (`resolve_llm_provider` model_validator),
  `:1224-1253` + `:1275` (`apply_setup_overlay` — INFRA_KEYS only, file store, import-time)
- `backend/app/models/user_settings.py:227-231`, `:908-910`, `:937-944` (`load_app_settings`),
  `:970-971` (`load_user_settings` → `load_app_settings`), `:301-313` (`invalidate_settings_cache`)
- `backend/app/api/settings.py:265-271` (`resolved_harness_judge_model` computed from the *effective*
  settings — the UI/runtime asymmetry)
- `backend/app/services/forced_emit.py:352-357` (result carries `provider`), `:463-473` (the
  `provider_error` site + the INFO log that names provider but not model), `:487-489`
- Runs: `da5541c0` (judge `provider_error`, `overall_score` null, `harness_judge_model='gemini-3.5-flash'`);
  `ced8005d` (2026-07-30 20:13:38 UTC, `overall_score 82`, `publish_succeeded`,
  `harness_judge_model='gpt-5.5'` set at 20:13:20 UTC)
- Related open reports from the same UAT session: [[BUG-260730-01]] (grounded-agent citation gate —
  fixed by plan 185-12), [[BUG-260730-02]] (emit gate reports a citation failure that was not one)

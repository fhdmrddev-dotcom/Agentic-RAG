---
id: BUG-260909-01
title: save_app_settings() swallows a database CheckViolationError and returns as if it succeeded — a rejected settings write reports success to its caller
reported: 2026-09-09
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [backend/settings, app_settings, user_settings.py, error-honesty]
folded_into: 249
verified_closed_by: Phase 249 (MODEL-08, 2026-09-15)
related_seeds: [SEED-258]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: dc457b38a
  date: 2026-09-09
---

# BUG-260909-01: a refused settings write reports success

## What we observed

Driven live at `dc457b38a` while UAT-ing `SEED-258`'s new ceiling, calling
`save_app_settings({"source_max_file_size_mb": v})` **directly**, bypassing the API:

```
  set      0 -> ACCEPTED, accessor reads 25 MB
  set     51 -> ACCEPTED, accessor reads 25 MB
  set    999 -> ACCEPTED, accessor reads 25 MB
```

**The database did its job.** Each write raised
`asyncpg.exceptions.CheckViolationError: new row for relation "app_settings" violates check
constraint "app_settings_source_max_file_size_mb_bounds"`. But `save_app_settings`
(`user_settings.py:585`) catches it, logs *"DB write failed; settings not persisted"*, and
**returns normally** — so the caller cannot tell a refused write from an applied one.

⚠ **Nothing was corrupted and the value stayed correct** (25 → 10 → 25). The defect is the
*reporting*, not the data.

## ⚠ NOT reachable by a user today — scoped honestly

`api/settings.py:489` validates the field **before** the write and raises `HTTPException(400)`
with a worded reason. So the user-facing path is correct and this cannot be hit through the UI or
the API. **This report is about a latent hazard, and its severity is `minor` for that reason.**

## Why it is still worth fixing

⭐ **The DB CHECK is described in migration 174's own header as *"the backstop for a hand-edit in
this very SQL editor"*.** A backstop that fails **silently** is a backstop that will be trusted and
will not report. The next caller that writes settings without re-implementing the API's validation
— a script, a migration helper, a future admin path — gets `None` back and believes it worked.

This is the same shape as the class `SEED-258` is about: **a control whose effect is invisible.**
Here the effect is *"your write did not happen"*.

## Suggested fix direction — NOT a decision

Distinguish *"the DB was unreachable"* (the case the broad `except` was written for — a settings
read must never crash a request) from *"the DB refused this value"* (a caller error that should
surface). Re-raising a constraint violation while still swallowing connection failures preserves
the original intent and removes the silence.

⚠ Check the other `save_*` paths in the same module for the same shape before fixing just this one
— the pattern, not the instance, is what to look for.

## Surface classification

`Agentic-RAG` — this app's own settings layer.

## Suggested routing

- **Fold into in-flight phase:** n/a.
- **Defer to future phase:** the `SEED-258` configuration-surface work, where settings-write honesty
  is already the theme.
- **Plant as seed:** n/a — observed, with a live repro.


---

## CLOSED 2026-09-15 — Phase 249 (MODEL-08). Reproduced first, against the same constraint.

### Reproduced, verbatim, before anything was changed

```
BEFORE source_max_file_size_mb = 25
  set      0 -> returned False
  set     51 -> returned False
  set    999 -> returned False
AFTER  source_max_file_size_mb = 25
```

Identical to this report's own three lines. Every one raised
`asyncpg.exceptions.CheckViolationError` on `app_settings_source_max_file_size_mb_bounds` — **the
database did its job** — and the caller could not tell that from a connection reset.

### After

```
  set      0 -> REFUSED: columns=['source_max_file_size_mb']
                constraint=app_settings_source_max_file_size_mb_bounds
  set     51 -> REFUSED: …
  set    999 -> REFUSED: …
AFTER  source_max_file_size_mb = 25
```

`save_app_settings` raises `SettingsWriteRefused` on the refusal family
(`CheckViolation` / `NotNullViolation` / `UndefinedColumn`) and still returns `False` for
everything else. `PUT /settings` and the three admin write seams answer **400** with the column and
the rule; an unreachable database is still a **500**, byte-identical.

### ⚠ The honest scoping in this report is PRESERVED, not inflated

This was and remains **`severity: minor` and NOT user-reachable** — `api/settings.py:489` validates
before the write, so the UI and API paths were always correct. **Getting fixed does not make it
retroactively a user-visible bug.** Its value is the next caller: a script, a migration helper, a
future admin path that does not re-implement the API's validation.

### ⭐ A SECOND FINDING THIS REPORT DOES NOT MENTION, surfaced by reproducing it

The old arm logged with `exc_info=True`. asyncpg's `CheckViolationError` arrives carrying a
`DETAIL:` line containing **the entire failing row** — every `enc:v1:` secret envelope and the
operator's self-hosted tunnel URL among them. `T-081.1-04` says these rows must never be logged.

**So the silent failure had a quiet disclosure sitting beside it.** The refusal arm now logs
**without** a traceback and raises `from None`, so a 500 handler rendering `__cause__` cannot print
the row either. Both are pinned by a case that greps the exception, its cause **and** the log
records for the value, for `enc:v1:` and for the URL.

### ⭐ And the arm this report's "suggested fix direction" got right

`UndefinedColumnError` is deliberately in the refusal family. It is the *knob shipped in CODE
without its migration* signature this report names — mig 078's `skill_builder_model` hid ~10 days,
`lmstudio_api_key` until mig 180. Naming that column in the response is the difference between ten
days and ten seconds.

---
id: BUG-260902-06
title: A model added via discovery or Settings appears only if the next request happens to land on the SAME worker that wrote it — the cache invalidator is per-process and WORKER_COUNT is 2
reported: 2026-09-02
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/settings, model-registry, caching, multi-worker]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 34d442402
  date: 2026-09-02
---

# BUG-260902-06: the invalidation reaches one worker of two

**Operator, 2026-09-02:** *"when I run the discover new models and I add new models from the
model discovery — even from the settings itself — it is not added to the list, and also sometimes
it is added but not directly."*

⭐ **"Sometimes, but not directly" is the tell, and it names the mechanism exactly.** A
deterministic bug would fail every time. This one is a coin flip, and the coin is which worker
serves the read.

## The mechanism

**1 · The cache is a module global — therefore per PROCESS.**
`backend/app/models/user_settings.py:526`:

```python
_all_model_overrides_cache: dict[str, dict] = {}
_all_model_overrides_cache_time: float = 0.0
```

read at `:583` behind a **30-second TTL** (`_SETTINGS_CACHE_TTL = 30.0`, `:269`).

**2 · There IS a write-side invalidator, and its docstring states the intent plainly** (`:560`):

> *"Called on EVERY model-capability write (Phase 149 MODEL-01) so an edit is visible on the next
> request (SC#1)…"*

```python
global _model_overrides_cache_time, _all_model_overrides_cache_time
_model_overrides_cache_time = 0.0
_all_model_overrides_cache_time = 0.0
```

⚠ **It resets two module globals. It cannot reach another process.** The file says so itself
elsewhere (`:366`): *"Bound the SYNC reader's staleness to `_SETTINGS_CACHE_TTL` **on THIS
worker**."*

**3 · There are two workers.** `WORKER_COUNT=2` is the documented default (CLAUDE.md, D-PRD-12),
and this box confirms it — `scripts/restart-backend.ps1` prints *"Backend relaunched headless
(workers=2)"*.

## What the operator actually experiences

1. `POST` the new model → load balancer picks **worker A** → row written, **A's cache cleared**.
2. `GET` the model list → picks **A or B**.
   - **worker A** → the model is there. *"It worked."*
   - **worker B** → serving a cache up to 30 s old → **the model is absent**. *"It didn't add."*
3. Refresh again a few seconds later → different worker, or B's TTL has lapsed → it appears.
   *"Sometimes it is added but not directly."*

**Both reported symptoms are the same defect**, and the "not directly" delay is bounded by the
30 s TTL rather than by anything the person did.

## Why it matters beyond this one list

⚠ **This is not a model-registry bug; it is a settings-cache bug that the model registry
happens to expose.** `_SETTINGS_CACHE_TTL` guards the general settings cache too, and
`invalidate_settings_cache()` has the same single-process reach. **Any setting written on one
worker and read on the other has the same window.** The model list is simply where it is most
visible, because a person adds a model and looks straight at the list.

⚠ **It contradicts a shipped success criterion.** The invalidator exists specifically so *"an
edit is visible on the next request (SC#1)"*. With two workers it is visible on **roughly half**
of next requests.

⚠ **And it is invisible to tests.** A single-process test client has one cache, so the
invalidator always works there. **The defect only exists in the configuration that ships.** That
is the same shape as several findings this repo already records: green everywhere except in the
arrangement customers actually run.

## Not determined

- Whether the operator's *"it is not added to the list"* case is ever permanent, or always
  resolves within 30 s. **Worth establishing** — a permanent case would mean a second defect
  behind this one, and this diagnosis would then be incomplete rather than wrong.
- Whether the frontend also caches the model list, which would extend the window.
- Whether model **discovery** (the probe that finds new models) and the **Settings** add path
  share the write path, or only share the read.

## For whoever fixes it

- ⚠ **Do not "just lower the TTL".** It narrows the window and keeps the bug, while adding DB
  reads to a hot path.
- The shapes that actually work: invalidate **across processes** (a Redis pub/sub message — the
  infrastructure already exists and `tool_dispatcher` uses pub/sub for approvals), or make the
  read authoritative for this surface (the registry editor is not a hot path and could skip the
  cache entirely).
- ⚠ **Check every other consumer of `_SETTINGS_CACHE_TTL` before choosing** — the fix should be
  made once at the cache, not once per screen that notices.

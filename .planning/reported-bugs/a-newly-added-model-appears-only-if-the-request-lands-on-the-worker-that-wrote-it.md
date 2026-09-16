---
id: BUG-260902-06
title: A model added via discovery or Settings appears only if the next request happens to land on the SAME worker that wrote it — the cache invalidator is per-process and WORKER_COUNT is 2
reported: 2026-09-02
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/settings, model-registry, caching, multi-worker, app_settings, control-room, SEED-258]
folded_into: 249
verified_closed_by: null
related_seeds: [SEED-258]
re_open_trigger: "The first run under a real WORKER_COUNT=2 (not two --reload servers): add a model on one worker, then read the registry until a request is served by the other. Until that is observed, the cross-worker half rests on a fence, not on a measurement."
reproduces_on:
  branch: develop
  commit: 34d442402
  date: 2026-09-02
---

# BUG-260902-06: the invalidation reaches one worker of two

> ⚠ **FOLDED INTO PHASE 249 — DELIBERATELY NOT `closed`, AND PHASE 249'S OWN VERIFIER IS WHY.**
> `.planning/phases/249-the-model-you-actually-run/249-VERIFICATION.md` § SC#3 reads, verbatim:
> *"MET BY CONSTRUCTION AND BY FENCE. ⛔ NOT MET BY MULTI-WORKER OBSERVATION, and that is stated
> rather than glossed."* `REQUIREMENTS.md` `MODEL-06` is ticked on that basis and says the same in
> its traceability row.
>
> **What IS discharged:** the broadcast mechanism was measured present at all three registry write
> seams plus the one `app_settings` write seam, with `SettingsCacheSubscriber` constructed at
> lifespan; it is pinned in **both** directions — including the negative one, that the two WR-03
> read-before-guard sites must *not* broadcast — **driven RED against a planted broadcast**. The
> cross-**request** half was driven live: one write, ten consecutive reads, 10/10 unanimous.
>
> ⛔ **What is NOT discharged is the thing this report is named after.** `WORKER_COUNT=2` does not
> exist in the environment that verified it: two independent `uvicorn --reload` servers were running
> on port 8000, and `--reload` implies a single worker. A fence proves the code broadcasts; only a
> second worker proves a second worker hears it. Flipping this to `closed` would claim an
> observation nobody made — **a wrong `closed` is worse than a stale `open`, because it stops the
> next reader looking.** See `re_open_trigger`.

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

---

## ⚠ WIDENED 2026-09-09 — this is not the model registry, it is EVERY app setting

Measured while shipping `SEED-258`'s first knob. The report above names
`_all_model_overrides_cache` (`user_settings.py:526`). **The same shape sits one screen up and
governs the whole settings surface:**

```
user_settings.py:297   _settings_cache: dict[str, Any] | None = None      # module global -> PER PROCESS
user_settings.py:298   _settings_cache_time: float = 0.0
user_settings.py:299   _SETTINGS_CACHE_TTL: float = 30.0
```

`load_app_settings()` returns that cache whenever it is under 30 s old. So **every value in
`app_settings` has the same coin-flip**, not just model overrides — with `WORKER_COUNT=2`, whether a
change is visible depends on which worker serves the next read.

⭐ **Demonstrated on brand-new code the same day.** `SEED-258` shipped
`app_settings.source_max_file_size_mb` — the largest file any connected source may import — read
through `source_max_file_bytes()` → `load_app_settings()`. **An operator who lowers that ceiling and
watches a sync still admit a large file has hit this bug, not a broken ceiling**, and nothing on
screen will say so.

⚠ **This raises the severity in EFFECT without changing the field.** The original report is about a
model appearing late, which is annoying. The same mechanism now sits under a **safety-shaped** knob —
a memory bound on untrusted remote input — where "the setting did not take" reads as "the guard does
not work". ⛔ It also silently degrades `BUG-260908-03`: an operator disabling a model in the registry
sees it linger in the picker for the same reason.

**Consequence for the fix:** a repair scoped to the model-override cache **closes one of two module
globals with the identical defect** and leaves the wider one live. Whatever invalidation mechanism is
chosen — pub/sub, a version column, a shorter TTL, a shared store — it must cover `_settings_cache`
too, or `SEED-258`'s entire class ships onto a cache that lies for thirty seconds at a time.

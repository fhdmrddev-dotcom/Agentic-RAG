---
seed_id: SEED-227
title: The extraction knobs are not operator-controllable — one is a DB row with no UI, and the vision model is an env var
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, operator direction — "everything that is controllable we should not hard code, it should be dynamic, stored somewhere in the database and controlled through the UI"
surface: Agentic-RAG
severity: major
category: settings / operator control
priority: high
scope: >
  Bring the extraction + multimodal knobs onto the standing settings contract: stored in
  `user_settings` / `app_settings`, edited in the Settings UI, env vars reserved for secrets
  and infra. Three tiers exist today and only one of them is correct — the audit below
  distinguishes them, because "add a settings row" and "surface an existing row" are different
  jobs and only one of them needs a migration.
affected_areas: [backend/config, backend/settings, frontend/settings, ingestion-pipeline, schema]
relates_to:
  - SEED-226 (engineering-drawing ingestion — every knob it adds must land on THIS contract, not in .env)
  - SEED-224 (document space redesign — its Ingestion tab is the natural host surface)
  - backend/app/config.py
  - backend/app/models/user_settings.py
  - frontend/src/pages/SettingsPage.tsx
  - CLAUDE.md → Rules → "Settings live in user_settings / app_settings and the Settings UI; env vars are for secrets and infra only"
re_open_trigger: >
  ANY of: (a) a phase adds a new extraction, OCR, vision or chunking tunable — it must not
  reach `config.py`; (b) an operator asks to change a cap, model or threshold and the answer
  involves editing `.env` and restarting; (c) SEED-226 is picked up (it adds several such
  knobs and would otherwise widen this gap); (d) the Settings UI is next opened for edit.
trigger_when: unset
---

# The extraction knobs are not operator-controllable

## Why this is planted separately from SEED-226

The operator gave two directions in one breath on 2026-08-28: *support the drawing business
case*, **and** *stop hard-coding what an operator should be able to control*. They are
separable — the second is true and actionable **even if the first is never built** — and a
seed that bundles them would be picked up as one feature and half-done. SEED-226 is the
capability; this is the contract every knob it adds must land on.

The trigger was concrete: the vision-call ceiling. But the ceiling turned out to be the
*better* of the two failure modes found, which is why this seed is about the contract rather
than about one number.

## Measured 2026-08-28 (HEAD on `develop`) — three tiers, and only one is correct

Derived by cross-referencing `backend/app/config.py`, `backend/app/models/user_settings.py`
and `frontend/src`. `config.py` declares **95** typed settings.

### ✅ Tier A — the contract, working as designed

DB-backed **and** surfaced. These are the shape everything else should copy.

| Setting | `user_settings` | frontend files |
|---|---|---|
| `retrieval_top_k` | ✅ | 4 |
| `rerank_enabled` | ✅ | 4 |
| `embedding_model` | ✅ | 4 |
| `hybrid_search_enabled` | ✅ | 4 |

### ⚠ Tier B — the orphan: a DB row nobody can reach

| Setting | `user_settings` | frontend files |
|---|---|---|
| `multimodal_max_vision_calls` (default **100**) | ✅ `user_settings.py:197` | **0** |

**The hard half is already done.** The column exists, it is read at ingest
(`multimodal_service.extract_and_store_images` → `image_dicts[:app_settings.multimodal_max_vision_calls]`),
it has a default and a loader. It has **no control anywhere in `frontend/src`**.
⚠ **A settings row with no surface is indistinguishable from a hard-coded constant to the only
person who needs it** — and it is worse than one, because it reads as *configurable* to every
future reader of the model file. This is the cheapest fix in the seed: a UI control, no
migration.

### ⛔ Tier C — the actual violation: env var only, no DB row, no UI

| Setting | `config.py` | `user_settings` | frontend |
|---|---|---|---|
| `vision_model` (default `"gpt-4o-mini"`) | `:1076` | **0** | **0** |
| `chunk_size` (default `1000`) | `:943` | **0** | **0** |
| `chunk_overlap` (default `200`) | `:944` | **0** | **0** |
| `sandbox_exec_timeout_seconds` (default `180`) | `:960` | **0** | **0** |

`vision_model` is the sharpest case and the reason this seed exists at this severity. The app
routes **eight providers** through `MODEL_CAPABILITIES` and lets the operator pick a chat model
and an embedding model **in the UI** — while the model that reads every image in the knowledge
base is pinned by `VISION_MODEL=` in `.env`, with a comment saying so. Changing it requires a
file edit and a restart, it is invisible in the product, and **in cloud it is a Coolify
env-var change — i.e. a deploy-parity chore** (CLAUDE.md: *"Code deploying ≠ cloud
configured"*). It is a model choice, not a secret and not infra. It is on the wrong side of the
project's own rule.

`chunk_size` / `chunk_overlap` are the same class and arguably higher-stakes: they change what
gets embedded, so changing them implies re-embedding — which is precisely why the operator
should see them next to the re-embed lifecycle the Settings UI already ships, rather than
discovering them in a config file.

⚠ **The list above is what a targeted check found, not an exhaustive audit.** The 95-line
sweep of `config.py` is in this seed's planting session; a phase picking this up should
re-derive it rather than trust this table, because it is a snapshot and this project's own
repeated finding is that snapshots rot.

## The rule to apply, stated so it can be checked

> A setting is an **env var** only if it is a secret (key, token, password, DSN) or infra
> (URL, host, port, pool size, worker count). **Everything else — model ids, caps, thresholds,
> timeouts, toggles, engine choices — is a DB row with a UI control.**

Note the honest boundary: `sandbox_exec_timeout_seconds` and `postgres_pool_*` sit near the
line. The test that resolves it: *would an operator ever reasonably want to change this without
a deploy?* For a sandbox timeout the answer is yes; for a connection-pool floor, no.

## Suggested shape for whoever picks this up

1. **Tier B first — it is one UI control and zero migrations.** Surface
   `multimodal_max_vision_calls` with its cost consequence stated in words, not a bare number:
   this is a *per-document ceiling on paid vision calls*, and the operator is entitled to know
   that raising it raises spend and lowering it silently truncates long documents.
   ⚠ **The truncation is currently silent** — a document past the cap is indexed with only its
   first N images described, and nothing says so. Surfacing the knob without surfacing that
   consequence would make the setting legible and its effect still invisible.
2. **Tier C next** — one numbered migration adding the columns, loader entries in
   `user_settings.py`, `config.py` values demoted to *defaults* (never read directly once a
   row exists), and controls grouped on the Settings surface. `vision_model` should reuse the
   existing provider/model picker rather than growing a second one.
3. **A guard, because a rule nobody executes is a rule that rots.** This project's own history
   says so twice over (the CLAUDE.md size gate; the ledger's disposition cap). A check that
   fails when a NEW non-secret, non-infra typed setting is added to `config.py` without a
   `user_settings` counterpart would fire in the turn the drift is authored, not eight days
   later. ⚠ **Drive it RED against a planted violation before trusting it** — a guard nobody
   has seen fire is not a guard.
4. **Deployment-artifact parity**: removing a var from `.env` obligations still touches
   `deploy/onebox.env.example` and `scripts/check-deploy-drift.sh`'s `OMITTED_FROM_ONEBOX`
   list, **in the same commit** (D-16).

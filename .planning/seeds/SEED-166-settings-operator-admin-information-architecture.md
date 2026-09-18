---
seed_id: SEED-166
title: three configuration homes, many tabs each, and no rule for what lives where
status: planted
status_note: |
  Phase 251 frontmatter migration: this file had NO frontmatter block at all, so no status was
  ever recorded for it. `planted` here is a MIGRATION DEFAULT — it is a statement about the
  absence, never a claim about the seed. Read the body and set it deliberately.
surface: Agentic-RAG
trigger_when: unset
---
# SEED-166 — three configuration homes, many tabs each, and no rule for what lives where

**Planted:** 2026-08-15, at the operator's direction, during Phase 193.2's UAT
**Surface:** Agentic-RAG — Settings · Operator menu · Admin/Control Room
**Status:** open
**Priority:** medium — nothing is broken; the cost is that operators cannot find or trust a setting

---

## The operator's framing, verbatim

> *"I don't know what judge model I am using so this should be clearer, I'm not sure if this judge
> model is in the settings now. This is something to document because even later we should work on
> organising the settings, categorising them, grouping them together and seeing where to put each
> setting — because now we have the Settings, we have the operator menu and we have the admin menu
> and all of them include a lot of tabs."*

**This seed exists because the question "where is this setting, and is it the one that's actually
used?" could not be answered from the product.** It was answered by reading
`backend/app/api/settings.py`, `app_settings`, and `resolve_judge_model()`.

---

## The concrete instance that planted it — and it is not a hypothetical

The operator asked which judge model was in use. The measured answer:

- **It IS in Settings.** `app_settings.harness_judge_model` = **`gpt-5.5`**, and `settings.py:116-117`
  returns **both** the raw knob and `resolved_harness_judge_model`.
- `resolve_judge_model()` (`validator_kinds.py:65`) is the ONE source of truth for **both** the eval
  judge and the publish judge, with a documented order: the knob → first of
  `("claude-opus-4-8", "gpt-5.5")` with truthy `forced_emission` → `None` (honest failure).

**So the setting exists, is exposed, and is documented — and the operator still could not tell.**
That is the finding. The information architecture, not the data, is what failed.

⚠ **And their doubt is independently justified: `BUG-260731-01` is still `status: open`** — an
unresolved question about whether that knob is truly wired to the judge shot, or whether every
consumer reads the env-backed `config.Settings` singleton instead. It carries a *named decisive
test that has never been run*. **A user cannot be expected to trust a knob the repository itself has
an open question about.** Running that test is a prerequisite for any IA work here, because
regrouping a control that may be inert would make things worse, not better.

⚠ **A second instance from the same session:** the judge model is `gpt-5.5` (OpenAI) and the
embedding model is `text-embedding-3-small` (OpenAI). **Both** single-provider dependencies on one
key, discoverable only by reading two different config surfaces — and when that key's balance hit
zero (`BUG-260815-05`) nothing anywhere said so. **A grouping that put "what this deployment depends
on externally" in one place would have made a blocking outage self-evident.**

---

## The three homes today

| Home | Roughly what it owns | Audience |
|---|---|---|
| **Settings** | providers + keys, models, retrieval/hybrid knobs, embedding, extraction, sandbox, skills, judge model, engine health | the account owner |
| **Operator menu** | the operator band + its tabs (Phase 146-148) | operator |
| **Admin / Control Room** | dependency health, active runs + Kill, kill-switch grid, maintenance, audit ledger, users roster, feature-visibility audience map | admin/operator |

**There is no written rule for which home a new setting joins.** `app_settings` alone carries **75+
columns** (measured: `information_schema.columns` on `app_settings`), spanning provider keys,
retrieval tuning, extraction engines, feature flags, maintenance mode and the feature-visibility
map — several of which are conceptually Control-Room concerns sitting in the Settings table.

⚠ **Note this is an IA problem and NOT a storage problem.** The project rule *"settings live in
`user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only"* is
correct and is not in question. The question is **which surface presents which row, to whom, under
what grouping** — one table can legitimately back three surfaces.

---

## What a future phase should decide (not decided here)

1. **A placement rule**, written down, so the next setting has an obvious home. A candidate axis
   that fits the existing split: *account-scoped configuration* (Settings) · *deployment health and
   live control* (Control Room) · *who-can-see-what* (operator/audience). ⚠ Do not invent a taxonomy
   before auditing the 75+ existing rows against it — several will not fit, and those are the
   interesting ones.
2. **Grouping and naming within each home**, since "a lot of tabs" is the symptom the operator
   actually reported.
3. **Resolved-value visibility.** The judge case shows the pattern worth generalising: Settings
   already returns raw **and** `resolved_*` for the judge knob. **An operator should be able to see
   the effective value and where it came from — knob, registry default, or env — for every setting
   that has a fallback chain.** That single affordance would have answered the question that planted
   this seed.
4. **A dependency view.** One place that names every external provider this deployment depends on,
   which feature each backs, and whether it is currently answering. See `BUG-260815-05` — this is
   the Control Room's pinned-vitals surface, extended.

⚠ **G-2 fires on any of this.** These are live UI surfaces and a layout/grouping question is exactly
what `/gsd:sketch` exists for; an operator-approved mockup is the acceptance bar. Do **not** open an
IA phase straight into `plan-phase`.

⚠ **`SEED-155` binds any sketch**: if a mockup depicts a surface that consumes an existing
component, it must RENDER that component, not redraw it — a sketch that hand-writes its own CSS is a
drawing, not an acceptance bar.

---

## Re-open trigger

**Any of the following fires this seed:**

- A phase that adds a **new setting** and has to decide which of the three homes it belongs in —
  that phase inherits this seed instead of deciding ad hoc.
- Any phase touching the Settings page, the operator band, or the Control Room tabs.
- `BUG-260731-01`'s decisive test being run — its outcome changes whether the judge knob can be
  presented as authoritative.
- A second operator report of "I can't find / can't trust a setting."
- The next milestone's planning sweep, whichever comes first.

## Related

- `BUG-260731-01` — the open question about whether the judge knob is wired; **a prerequisite**
- `BUG-260815-05` — the OpenAI outage nothing surfaced; the dependency-view argument
- `SEED-165` — the sibling observability gap on the test-gate side
- Phase 146-148 — the Control Room's existing band/tabs shell, the audit-receipt vocabulary and the
  feature-visibility audience map, all of which any IA work must consume rather than replace
- Phase 137.1 — the Settings engine-health tile board + judge-model knob, the surface this touches
- `docs/` memory *settings ↔ control-room boundary* — the boundary question this seed formalises

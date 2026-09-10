---
id: BUG-260908-03
title: An operator wanting a model gone from the chat picker reaches for "deprecated" — which deliberately keeps it selectable — while "Enabled", the control that actually hides it, goes unnoticed on the same row
reported: 2026-09-08
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/admin, ModelRegistryTab, model-registry, control-room, UX/legibility, chat/model-picker]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-258]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: ad54d4f89
  date: 2026-09-08
---

# BUG-260908-03: the wrong toggle is the discoverable one

## What we observed

**Operator, 2026-09-08**, asked for a way to remove a model from the chat/thread selector and
reported, verbatim:

> *"It is actually called deprecated and when toggled, it is still showing in the selector but with
> a deprecated tag."*

**The behaviour is CORRECT and the product is doing exactly what it was designed to do.**
`ModelRegistryTab.tsx:20` states the rule: *"deprecated ≠ disabled (D-149-04): a deprecated row stays
enabled/selectable"*. Deprecated means **still usable, marked old**. The control that removes a model
from the picker is the separate **`Enabled`** toggle on the same row (`:423-431`), which the picker
honours by reading an enabled-only cache (`api/settings.py:217-219`).

⭐ **So the capability the operator asked for ALREADY EXISTS, and they could not find it.** That is
the defect. Nothing is broken in the backend; the row cannot be read.

## Why it matters more than a label tweak

⚠ **The design ALREADY CARRIES A MECHANISM FOR EXACTLY THIS, AND THE MECHANISM DID NOT WORK.** The
table renders a dedicated **"Users see"** column holding a `CouplingChip` (`:434-437`) — the
*"enabled→picker coupling made visible"*, per the file's own docblock — and each row carries
`data-coupling="shown"|"hidden"` (`:342`). **A legibility affordance was designed, built, and still
lost to the neighbouring toggle in real use.** That is worth more than the fix: it says the row is
answering *"what is this model's state?"* when the operator arrived asking *"how do I get rid of
this?"*, and the two are not the same question.

⚠ Consequence beyond confusion: an operator who believes *deprecated* hides a model will think the
model is gone from their users' picker. **It is not.** They have marked it old and left it
selectable — a silent gap between intent and effect, on a surface whose whole job is operator control.

## Hypothesized cause

**Hypothesis, not finding.** Two adjacent per-row toggles whose names both plausibly mean *"take this
out of circulation"*, where the one with the more final-sounding word is deliberately the one that
does not. `Enabled` is a state; the operator's intent was an **action** (*remove this*), and no
control on the row is worded as that action.

## Suggested fix direction — NOT a decision

- Word the coupling as the **consequence**, not the state — the row already knows it
  (`data-coupling`), so this is presentation, not new data.
- Make `deprecated` say what it does **and does not** do at the point of toggling, since its whole
  contract is *"stays selectable"* and that is the surprising half.
- ⛔ **Do NOT make `deprecated` hide the model.** `D-149-04` is a deliberate decision and other
  behaviour depends on it (the picker's deprecated badge, `api/settings.py:217`). **The fix is
  legibility, never a behaviour change.**
- ⚠ **G-2 applies** — this is live UI; sketch before plan.

## Separately, and genuinely missing: there is no way to DELETE a model row

The admin API exposes `POST /models`, `PATCH /models/{id}`, `PUT /models/{id}/lock` and
`POST /models/discover` — **no `DELETE`**. So a model switched off still occupies the registry table
forever. That is a real missing capability, **distinct from this report**: hiding from the picker
works today via `Enabled`; removing the ROW does not exist. It needs its own decision (what happens to
a locked row, an in-use row, and whether a re-discovery silently resurrects it) and is a small phase,
not a fix.

## NOT a duplicate of `BUG-260902-06`

That report is the **per-worker cache** — a model added or changed appears only if the next request
lands on the worker that wrote it (`user_settings.py:526`, module-global cache, 30 s TTL,
`WORKER_COUNT=2`). ⚠ **The two INTERACT and that is worth knowing:** even after this report's
legibility fix, toggling `Enabled` may appear not to work for up to 30 seconds, or intermittently,
for that unrelated reason — so **fixing this one alone could still leave the operator's original
complaint half-standing.**

## Surface classification

`Agentic-RAG` — this app's own Control Room / Model Registry.

## Suggested routing

- **Fold into in-flight phase:** n/a — nothing in flight touches this surface.
- **Defer to future phase / milestone:** a Control-Room or model-registry phase. ⭐ It belongs with
  **`SEED-258`**, whose thesis is exactly this: *a configuration control must carry its effect, not
  just its value*. This is that seed's first instance found in the wild rather than by inventory.
- **Plant as seed:** n/a — observed, with a live repro.

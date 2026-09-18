---
seed_id: SEED-179
title: There is no way to turn follow-up suggestion generation OFF — Settings exposes only which model does it
created: 2026-08-18
planted_during: Operator live testing during the Phase 197 sketch session
status: planted
priority: medium
relates_to:
  - SEED-034 — cross-provider sub-agent behaviour; follow-up generation runs on the sub-agent model.
  - The standing project rule that settings live in `user_settings` / `app_settings` and the Settings
    UI, never in env vars.
  - `frontend/src/components/chat/SuggestionPills.tsx` — the surface that renders them.
trigger_when: >
  The condition is ALREADY TRUE and needs no signal: Settings shows a READ-ONLY "Follow-up
  suggestions" model label and no on/off control anywhere. Plan it when someone next touches the
  Settings model section, the chat sub-agent path, or the composer/suggestion surface.

  The mechanical check:

    grep -rn "Follow-up suggestions" frontend/src/pages/SettingsPage.tsx
    grep -rn "suggestions" frontend/src/components/chat/MessageItem.tsx

  As measured 2026-08-18 the first returns a `FieldRow` whose body is a `<span>` (a label, not a
  control) and the second returns `questions={message.suggestions}`. **The seed is discharged when a
  user-scoped setting exists that suppresses generation — not merely hides the pills.**
trigger_paths:
  - "frontend/src/components/chat/MessageItem.tsx"
  - "frontend/src/pages/SettingsPage.tsx"
surface: Agentic-RAG
---

# SEED-179 — no way to turn follow-up suggestions off

## The operator's words

> *"we should have an option settings to disable pull up questions generation"*

(*"pull up questions"* = the follow-up suggestion pills under an assistant message.)

## What is true today, measured

- The pills render from `message.suggestions`, via `SuggestionPills.tsx`, mounted at
  `frontend/src/components/chat/MessageItem.tsx:619`.
- Settings has a **"Follow-up suggestions"** row — but it is **read-only**. It reports which model
  resolves for the job (`subAgentModel`, or `<resolved> (auto)`), rendered as a `<span>` inside a
  `FieldRow`. `frontend/src/pages/SettingsPage.tsx:1097-1103`, under the comment
  *"D-09: Read-only resolved model labels for title & follow-up"*.
- **There is no toggle.** You can see which model writes them; you cannot stop it writing them.

## Why it is worth doing

1. **It costs money and latency on every single assistant turn.** Follow-up generation is an extra
   provider call per message. A user who never clicks a pill is paying for all of them, forever,
   with no opt-out.
2. **It is a per-user taste, not a product truth.** Some people find suggestions helpful; others
   find them noise that clutters a transcript they are reading carefully. That is exactly the class
   of thing this project puts in Settings.
3. **The precedent already exists next door.** Title drafting sits in the same Settings block with
   the same read-only treatment — so whatever is decided here likely applies to both, and the pair
   should be considered together rather than one being toggled and the other not.

## What a fix must decide

- ⚠ **Suppress GENERATION, not just rendering.** A checkbox that hides the pills while the provider
  call still fires would satisfy the letter of the request and none of the reason for it (point 1
  above is the main one). The setting must reach the backend path that produces `suggestions`.
- **Scope:** `user_settings` (per user) is the obvious home. Whether an operator-level
  `app_settings` default is also wanted is open.
- **Does it apply to title drafting too?** Same block, same shape, same cost argument. Probably yes;
  not decided here.
- **Default:** ON (today's behaviour) unless someone argues otherwise — this is an opt-out, not a
  new capability.

## Where it would land

- `frontend/src/pages/SettingsPage.tsx` — ⚠ a **G-5 hot file**; read
  `docs/HOT-FILE-LEDGER.md` first. It was named-but-not-modified at Phase 196 by decision (the SC#3
  scope fence), and its re-open trigger is *the next phase whose `files_modified` names it* — **this
  seed would be that phase.**
- `backend/app/api/settings.py` — also G-5-firing (30 / 16 / 616).
- The backend suggestion-generation call site, and `SuggestionPills.tsx` at the render end.

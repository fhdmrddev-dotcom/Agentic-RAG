---
id: BUG-260818-02
title: Resume drops the thread's selected model and silently falls back to the system default
reported: 2026-08-18
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [frontend/chat, frontend/streaming, provider-routing, model-selection]
folded_into: "228"
verified_closed_by: "228"
related_seeds: [SEED-135, SEED-178]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 8bfa4b65
  date: 2026-08-18
---

# BUG-260818-02: Resume drops the thread's selected model

## What we observed

Operator report, from live testing on 2026-08-18:

> *"when there is a resume button and if I click it overrides the selected original model and [uses]
> the default model by the system. This is something also a bug — in any chat it should maintain the
> same model that was selected in that chat, because if we navigated away or refreshed it goes back
> to that default."*

**CONFIRMED IN SOURCE, and it is a one-line omission.** `sendMessage` forwards the per-request model
and provider to the dispatch call:

`frontend/src/providers/StreamsProvider.tsx` → `sendMessage`:

```ts
await postMessage(threadId, content, {
  model: opts?.model,
  provider: opts?.provider,
  agentMode: opts?.agentMode,
  …
})
```

…and `resumeFromFailed` calls it with **neither**:

```ts
await useStreamsStore.getState().actions.sendMessage(threadId, userMsg.content, { surfaceId })
```

`opts.model` and `opts.provider` are therefore `undefined` on every Resume, so the backend resolves
its own default. **A user on a deliberately chosen model gets a different model without being told**
— and, because Resume also replays the original prompt (`BUG-260818-01`), the transcript shows the
same question answered twice by two different models with nothing saying so.

## Why it matters

**Major.** This project's standing position is that provider behaviour does **not** transfer 1:1 —
tool-call emission, structured output and streaming all differ by provider, and `MODEL_CAPABILITIES`
exists precisely because the differences are load-bearing. So a silent model swap is not a cosmetic
downgrade:

- The retry can **succeed or fail for reasons that have nothing to do with the original failure**,
  which makes the failure impossible to diagnose — the user is now debugging a different model.
- It can silently drop `emit_tier` guarantees. A run deliberately placed on a strong-emission model
  may be retried on one whose emission is `coerce`.
- It spends the user's budget on a model they did not choose.
- It is invisible: no copy, no mark, no confirmation.

## Hypothesized cause

Not a hypothesis — the omission is visible in the call above. `resumeFromFailed` was written
(Phase 068) as a thin re-send and predates the per-request `model`/`provider` options; nothing since
has revisited it.

**The fix is small but the SOURCE of truth is the real decision**, and a fixer must choose
deliberately:

1. the model **stamped on the failed assistant message** (what actually ran — right for a retry),
2. the model the **composer currently shows** (what the user would pick now), or
3. the thread's own persisted selection — which **does not exist**; see below.

⚠ **Option 3 is unavailable today, and that is the operator's second sentence.** There is no
per-thread persisted model. `SEED-178` measured that the open thread does not survive F5 at all (no
thread id in the URL, nothing in storage), which is why *"restore the model across refresh"* was
unreachable and `BUG-260718-04` had to be split. **So the refresh half of this report is already
carried by `SEED-178` and must not be duplicated here** — what is new and separate is the **Resume**
path, which loses the model with no reload involved.

## Surface classification

`Agentic-RAG` — our own frontend. A routing candidate at `/gsd:discuss-phase`.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 197 is the authoring surface.
- **Defer to future phase / milestone:** the same chat run-lifecycle phase as `BUG-260818-01` and
  `BUG-260818-03`. ⚠ **Triage the three together** — they are one control in one moment.
- **Plant as seed:** no new seed. `SEED-178` (thread does not survive reload) and `SEED-135`
  (registry-backed model resolution) already hold the wider family.
- **External — note only:** no

## Workarounds

Re-select the model in the composer **before** pressing Resume — but note this does not help, since
Resume ignores the composer selection too. The reliable workaround is to **not use Resume**: retype
or paste the prompt as a new message with the intended model selected, which sends
`model`/`provider` on the normal path.

## Reference / evidence links

- `frontend/src/providers/StreamsProvider.tsx` — `sendMessage` (forwards `opts.model`/`opts.provider`)
  and `resumeFromFailed` (passes neither)
- `SEED-178-thread-selection-does-not-survive-reload.md` — the refresh half, already measured
- `BUG-260718-04` — closed by split at Phase 196; its navigate half was verified fixed
- Sibling reports: `BUG-260818-01`, `BUG-260818-03`

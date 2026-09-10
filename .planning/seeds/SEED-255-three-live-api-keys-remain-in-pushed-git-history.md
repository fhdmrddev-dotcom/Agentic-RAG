---
seed_id: SEED-255
title: Three plaintext API keys are still in PUSHED git history on origin/develop, origin/master AND origin/production — the file was untracked but the keys were never evidenced as rotated
created: 2026-09-06
planted_during: BUS-171 operator-queue triage (claude, REVIEWER)
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - BUS-034 — the original finding (2026-08-31), never answered
  - f1da19506 — the partial fix (untracked + gitignored + example shipped)
  - e5977a244 — the commit that introduced the keys
trigger_when: >
  IMMEDIATELY — this is an operator action, not a deferred idea. It also fires on ANY of:
  (a) the repository being made public or a collaborator/CI integration being added;
  (b) any milestone close or security review;
  (c) any decision to scrub history (which is optional — rotation is not).
---

## What was fixed, and what was not

`BUS-034` (2026-08-31) reported `litellm-config.yaml` git-tracked with three live plaintext API
keys and asked for three things. **Two of the three are DONE** — verified on the live tree:

- ✅ The file is **no longer tracked** (`f1da19506 chore(secrets): litellm-config.yaml stops carrying keys, and stops being tracked`).
- ✅ It is **gitignored** (`.gitignore:96`) and a `litellm-config.example.yaml` ships in its place.
- ⛔ **Rotation — the only step that actually kills the keys — has NO evidence of having happened.**

## Why untracking did not fix it

The keys were committed at `e5977a244` and **that commit is on the remote**, measured rather than
assumed:

```
$ git branch -r --contains e5977a244
  origin/HEAD -> origin/master
  origin/develop
  origin/master
  origin/production
```

`git show e5977a244:litellm-config.yaml` still resolves and still contains the key-bearing lines.
**Removing a file from HEAD does not remove it from history.** The keys are retrievable from all
three pushed branches by anyone who can clone the repository, permanently, and `production` is the
live branch.

## What caps the severity — and what does not

✅ **The repository is PRIVATE** (`gh repo view` → `"isPrivate":true, "visibility":"PRIVATE"`), so
this is not a public leak and there is no evidence of compromise. That is a real mitigation and the
reason this is `high` rather than `critical`.

⚠ **It is not a fix.** The exposure surface is every present and future collaborator, every CI or
bot integration granted repo access, every fork or clone already taken, and any future change of
visibility. BUS-034's own words: *"History scrubbing is optional given the keys will be dead once
rotated, but rotation is not."*

## The action (operator's — no agent can do this)

1. **Revoke/rotate all three at the provider consoles** — Zhipu (`93c4627a…`), OpenRouter
   (`sk-ork6n2e…`), and the third OpenRouter key (`sk-or-v1-f9dd28…86145`) that was an uncommitted
   edit at the time BUS-034 was written.
2. Confirm the local `litellm-config.yaml` uses env-var interpolation rather than literals.
3. History scrubbing is **optional** once the keys are dead.

⛔ **Do not close this on the strength of `f1da19506`.** That commit is exactly the change that
makes the problem *look* fixed while leaving every key live in three pushed branches.

---

## ⚠ THIS ASK WAS RAISED FIVE TIMES AND ANSWERED ZERO TIMES

Measured during the BUS-171 triage: **five separate open operator items carry the same request** —
`BUS-034` (2026-08-31), `BUS-044`, `BUS-046`, `BUS-050` and `BUS-055` (2026-09-01). Three of them
say, verbatim, **"YOURS AND UNCHANGED SINCE 2026-08-31."** They name the keys in `e5977a244` and
they escalate the pushed-commit count as they go (*"515 commits now sit…"*, *"~520 commits unpushed
behind them"*).

⭐ **That repetition is the finding, not the noise.** Each item was written by a different session
that re-discovered the same live secret and had nowhere durable to put it, so it re-raised it in a
handover that then went stale. **A mailbox is not a register.** This seed exists so the ask stops
being rediscovered and starts being tracked — and so the five carrying items can be closed without
the request dying with them.

⛔ **The five items are being CLOSED with a pointer to this seed.** If this seed is ever closed
without evidence of rotation at the provider consoles, the finding is gone for good — there is
nothing else holding it.

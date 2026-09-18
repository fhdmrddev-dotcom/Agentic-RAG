---
seed_id: SEED-255
title: Three plaintext API keys are still in PUSHED git history on origin/develop, origin/master AND origin/production — the file was untracked but the keys were never evidenced as rotated
created: 2026-09-06
planted_during: BUS-171 operator-queue triage (claude, REVIEWER)
status: answered
status_note: "ANSWERED 2026-09-16 by operator ruling on BUS-208 — both keys revoked 2026-09-14, history rewrite DECLINED (private repo + dead keys). ⚠ This seed's OWN provider attribution was measured WRONG at the same time: it says THREE keys incl. two OpenRouter; the pushed commit contains exactly TWO, Zhipu and MOONSHOT. See the 2026-09-16 correction in the body. The unpushed third key is the one residual and it is NOT a history exposure."
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

---

## ⚠ CORRECTED 2026-09-16 — THIS SEED MISATTRIBUTED A PROVIDER, AND THE ORIGINAL IS KEPT ABOVE

The operator ruled on `BUS-208` today: **history rewrite DECLINED** (private repo, keys dead),
**revocation DONE 2026-09-14**. Before recording that as an answer, the premise was driven against the
commit rather than read from this seed — and **this seed was wrong.**

### What is actually in `e5977a244`, measured (values never printed)

| | |
|---|---|
| distinct key values in `litellm-config.yaml` | **TWO**, each used twice — md5-prefix `69f7dfd7…` and `c8965fef…` |
| `api_base` hosts, which is what identifies a provider | `open.bigmodel.cn/api/paas/v4` ×2 · **`api.moonshot.ai/v1` ×2** |
| `sk-or-v1-` (OpenRouter's real prefix) occurrences | **ZERO** |

⛔ **`sk-ork6n2e…` IS A MOONSHOT KEY, NOT AN OPENROUTER KEY.** This seed calls it OpenRouter, misled
by a prefix that *looks* like OpenRouter's — but its `api_base` is `api.moonshot.ai` and it is the
`api_key` for the `kimi-k3` / `kimi-k2.6` model entries. **OpenRouter's real prefix is `sk-or-v1-`,
which appears zero times in this commit.**

### Why the misattribution mattered, and it was not cosmetic

`BUS-040` and `BUS-208` both name **"Zhipu/GLM and Moonshot/Kimi"**. This seed named **"Zhipu and two
OpenRouter"**. Read side by side, the overlap looks like *Zhipu only* — so a reader checking whether
the operator's ruling was safe would conclude **two OpenRouter keys are still live in three pushed
branches and nobody revoked them.** ⭐ **That alarm is FALSE, and it was raised by this register
rather than by the world.** The two keys in the commit are exactly the two the operator revoked.

### The one genuine residual — and it is NOT a history exposure

`sk-or-v1-f9dd28…86145`. This seed's own text says it *"was an uncommitted edit at the time BUS-034
was written"*, yet lists it under **"Revoke/rotate all three"**, which reads as though all three sit
in history. **It is not in `e5977a244` and it is not in any pushed branch.** It is a real OpenRouter
key that existed locally, so rotating it is ordinary hygiene — **not** the emergency this seed is
about, and not covered by the operator's ruling, which was scoped to pushed history.

### Disposition

- ✅ **The pushed-history exposure is CLOSED.** Two keys, both revoked 2026-09-14. The operator's
  *"private repo + revoked keys, no rewrite"* is sound **on the measured evidence**, not merely
  accepted.
- ⚠ **`status: answered`, not `closed`** — the unpushed OpenRouter key is unrotated as far as any
  register records, and this seed is the only place that fact now lives.
- **Re-open trigger (replaces the original):** the repository being made public, a collaborator or CI
  integration being added, **or** any evidence that `sk-or-v1-f9dd28…86145` is still accepted by
  OpenRouter. ⛔ The original `trigger_when` arm *"any decision to scrub history"* is **spent** — that
  decision was made and was NO.

⭐ **The method note, because it is the transferable part.** This seed was written during the
`BUS-171` triage by an agent reading two other bus items, and it inherited their framing without
opening the commit. Three registers agreed with each other and **all three were downstream of the
same unread artifact.** The commit is the bottom; every register above it only knows the one below.

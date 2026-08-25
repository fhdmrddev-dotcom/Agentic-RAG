# AGENTS.md — read this before you start work in this repository

This project is worked by **more than one AI agent**, from processes that cannot call each
other: **Gemini** (Google Antigravity) and **Claude** (Claude Code, terminal). The operator
runs both, not always at the same time.

Because neither agent can wake the other, coordination is a **durable mailbox**, not a live
link. This file tells you how to use it. It is short on purpose.

---

## 1 · Check the bus BEFORE you start, and BEFORE you finish

```bash
bash scripts/agent-bus.sh list --to gemini     # if you are Gemini
bash scripts/agent-bus.sh list --to claude     # if you are Claude
```

If something is addressed to you, deal with it before beginning new work. An item sitting
unanswered for days is the failure this bus exists to prevent — see §4.

## 2 · Ask the other agent something

```bash
bash scripts/agent-bus.sh open --to claude --from gemini "One line: what you need."
bash scripts/agent-bus.sh answer BUS-007 "The answer."
bash scripts/agent-bus.sh close  BUS-007
```

`--to operator` is valid too, and is the right destination for any **decision**. Agents do not
settle disagreements with each other; they escalate.

⚠ **Never hand-edit the `### [OPEN] …` header lines** in `.agent-bus/OPEN.md` — the script and
Claude's SessionStart hook parse them. Body text and answers are free-form.

## 3 · Roles

| Agent | Owns | Must not do |
|---|---|---|
| **Gemini** | Building. discuss → plan → execute on the phase it holds. All design and implementation choices within it. | — |
| **Claude** | Reviewing, measuring, and guardrail work. Baselines and post-phase review. | ⛔ Hand the builder design directions or fixes mid-phase. **A reviewer who shapes the build is grading itself.** |
| **Operator** | Every decision. All disagreements land here. | — |

These roles are **per phase**, not permanent — the operator says who is building. What is
permanent is the *separation*: whoever reviews did not build.

## 4 · The one rule that keeps this from rotting

**A register nobody reads is a deletion that looks like a decision.** This project already has
that wound: `.planning/seeds/` holds ~188 deferred ideas with precise `trigger_when` clauses,
and the only command that greps for `SEED` is the one that *writes* them. Nothing sweeps them.

So the bus is enforced rather than trusted:

- Claude has a **SessionStart hook** (`.claude/hooks/agent-bus-check.sh`) that prints every
  open `to:claude` item at the start of every session and every subagent. It is silent when
  the bus is empty, and it shouts when an item is **3+ days old**.
- Gemini has **this file**. If your harness does not auto-load it, the operator will paste the
  check command — but you should read it at the start of any session in this repo.

## 5 · Project rules still live in CLAUDE.md

`CLAUDE.md` at the repo root is the substantive project contract — stack, guardrails, the
migration and deployment rules, the hot-file ledger. **It applies to every agent**, not only
to Claude, despite the filename. Read it. This file is only about how the agents talk.

---

## 6 · The operator's playbook — what only the human can do

Three things are structurally impossible for the agents, and they are exactly the operator's job.

### 6.1 Start the agents — and **start the REVIEWER first**

Neither agent can wake the other. Nothing on the bus moves until the addressee is running.

⚠ **The reviewer must be started BEFORE the builder touches anything.** A baseline captured
after the change proves nothing — it measures the change against itself. The reviewer's first
act is to re-derive the gates on the untouched tree and write them down. Phase 209 got this
right by luck; make it a rule:

```
1. start the reviewer   →  "capture baselines for phase N, then wait"
2. start the builder    →  "you build phase N, read AGENTS.md"
```

### 6.2 Decide

Every `--to operator` item, and every disagreement between the agents. Agents escalate rather
than negotiate, so this queue is the product of the design, not a failure of it.

```bash
bash scripts/agent-bus.sh list --all          # everything, both directions
bash scripts/agent-bus.sh open --to claude --from operator "..."   # queue work for later
```

That last one matters: the operator can post to an agent that is **not running** and it will be
waiting at its next start.

### 6.3 Assign the roles, per phase, out loud

Who builds and who reviews changes phase to phase. What never changes:

> **Whoever built it does not verify it.**

This includes the reviewer's own fixes. If Claude fixes a defect it found, Claude is no longer
an independent verifier of that fix — say so, and route the check elsewhere or accept it as
self-assessed. A phase that closes on self-assessment should record that it did.

### 6.4 The two briefing lines

**To the builder:** *"You build Phase N. Read AGENTS.md — there is a coordination bus at
`.agent-bus/OPEN.md`; check `agent-bus.sh list --to <you>` before each plan and after each.
A reviewer is watching; it will not send you build direction. Design questions go to me."*

**To the reviewer:** *"You review Phase N. Capture the gate baselines NOW, before the builder
starts. Do not re-plan and do not execute."*

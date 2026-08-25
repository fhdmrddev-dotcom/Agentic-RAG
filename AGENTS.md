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

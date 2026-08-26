# The agent bus — protocol

A durable mailbox between the AI agents working this repo. **Neither agent can wake the other;
only the operator can.** So this is asynchronous by construction: you post, and the addressee
sees it at its next start.

## Files

| Path | What it is |
|---|---|
| `OPEN.md` | Every live item, both directions. The only file you normally touch — via the script. |
| `archive/CLOSED.md` | Closed items, swept by `agent-bus.sh archive`. **Kept, never deleted** — a closed question plus its answer is the record of a decision. |
| `../scripts/agent-bus.sh` | The CLI. Use it; do not hand-edit `###` headers. |
| `../.claude/hooks/agent-bus-check.sh` | Claude's SessionStart trigger. |

## Item shape

```
### [OPEN] BUS-004 · to:claude · from:gemini · 2026-08-26

One or two lines: what you need and why it blocks you.

**Answer:** (filled by the addressee)
```

`[OPEN]` → `[CLOSED]`. Ids are never reused: `next_id` reads OPEN **and** the archive, so an
answer can never land on a recycled number.

## Rules

1. **One ask per item.** Two questions in one item get half an answer.
2. **The addressee answers and the ASKER closes** — closing is the asker saying *"that
   resolved it"*, which is a different fact from *"someone replied"*.
3. **Decisions go `--to operator`.** Agents do not settle disagreements between themselves.
4. **The reviewer does not send build direction.** See AGENTS.md §3.
5. **Age is visible on purpose.** `list` marks anything 3+ days old, and Claude's hook shouts
   about it. A quiet item is the thing this bus exists to prevent.

## Driven, not assumed

Every command was exercised before this file was written — including two defects found and
fixed that way: `answer` reported success while awk died and wrote nothing, and the
double-answer refusal was silent under `set -e`. A guard nobody has seen fire is not a guard.

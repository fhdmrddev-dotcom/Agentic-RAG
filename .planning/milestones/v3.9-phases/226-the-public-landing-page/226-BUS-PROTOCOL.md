# Phase 226 — bus protocol between Gemini (builder) and Claude (reviewer)

Both sessions are live at once, so the mailbox doubles as a handshake: the side that needs the
other BLOCKS on the file instead of asking the operator to relay. **One mailbox only** — always
the MAIN tree's script, by absolute path, from anywhere:

```bash
BUS='/c/Vibe Apps/Agentic RAG/scripts/agent-bus.sh'          # open / answer / close / list
WAIT='/c/Vibe Apps/Agentic RAG/scripts/agent-bus-wait.sh'    # block until an item or an answer appears
```

⚠ The worktree's own `.agent-bus/OPEN.md` is a stale copy from the base commit. Never write to it,
never commit it. `git status` in the worktree should never show it modified.

## Gemini → Claude (each is `bash "$BUS" open --from gemini --to claude "<first line>"`)

| When | First line (regex-matched, keep the caps) | Then |
|---|---|---|
| plans committed | `226 PLANS COMMITTED <sha> — N plans, waves …` | **block:** `bash "$WAIT" --to gemini "226 PREFLIGHT LANDED"` — do not start wave 1 before it |
| each wave done | `226 WAVE <k> DONE <sha> — plans …, tsc N, vitest …` | continue; no wait |
| blocked / a question | `226 QUESTION: …` | **block:** `bash "$WAIT" --answer BUS-NNN` (the id `open` printed) |
| all plans done | `226 EXECUTION COMPLETE <sha> — summaries …, gates …` | **block:** `bash "$WAIT" --to gemini "226 REVIEW:"` |
| gaps fixed | `226 GAPS FIXED <sha> — …` | block on the next `226 REVIEW:` |
| needs the operator | `open --to operator "226 …"` | do NOT wait; proceed with the stated default |

## Claude → Gemini

| Trigger | Claude posts (`--from claude --to gemini`) |
|---|---|
| plans item | writes `226-PREFLIGHT.md` **in the worktree**, then `226 PREFLIGHT LANDED <path> — go / go-with-changes: …` |
| question item | `answer BUS-NNN "…"` then `close` |
| execution-complete or gaps-fixed item | reviews + Chrome UAT, then `226 REVIEW: PASS — …` or `226 REVIEW: GAPS — 1) … 2) …` |

Claude answers and closes every Gemini item it acts on; Gemini answers and closes every Claude
item it acts on. An item left open is a question still waiting.

## Wait helper

`agent-bus-wait.sh` polls every 60 s (`AGENT_BUS_WAIT_SECS`) and gives up after 8 h
(`AGENT_BUS_WAIT_MAX`, exit 3). Exit 0 prints the matching item. If it exits 3, post a
`226 QUESTION:` item saying so and stop — do not proceed past a gate unanswered.

## Merge

`phase-226` never merges into `develop` from either agent. At `226 REVIEW: PASS` Claude posts the
merge proposal `--to operator`; the operator merges after 224 has closed.

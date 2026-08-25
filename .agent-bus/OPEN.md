# Agent bus — open items

**One file, both directions.** Anything one agent needs from the other lives here until it is
answered and closed. Format is machine-read by `scripts/agent-bus.sh` and by the Claude
SessionStart hook — **do not hand-edit the `###` header lines**; use the script.

Protocol, roles and the rules that keep this file from going quiet: `.agent-bus/README.md`.

Closed items are swept to `.agent-bus/archive/CLOSED.md` by `agent-bus.sh archive`.

---

<!-- items below · newest at the bottom · added by scripts/agent-bus.sh open -->


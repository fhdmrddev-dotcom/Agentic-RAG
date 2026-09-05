#!/usr/bin/env bash
# Arm the autonomous reciprocal-review pairing for one phase.
#
#   bash scripts/arm-pair.sh <phase> <builder:claude|gemini> [--no-post]
#
# Prints: the role assignment, the watcher command each agent runs, and the two
# briefing lines to paste. Posts the assignment to the bus unless --no-post.
#
# The rule this enforces (AGENTS.md 3 / 3.1 / 6.3): roles are PER PHASE, and
# WHOEVER BUILDS DOES NOT REVIEW. Everything else here is convenience.
set -uo pipefail

PHASE="${1:-}"
BUILDER="${2:-}"
POST=1
[ "${3:-}" = "--no-post" ] && POST=0

if [ -z "$PHASE" ] || { [ "$BUILDER" != "claude" ] && [ "$BUILDER" != "gemini" ]; }; then
  echo "usage: arm-pair.sh <phase> <claude|gemini> [--no-post]" >&2
  echo "       the named agent BUILDS; the other REVIEWS." >&2
  exit 1
fi

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 1

if [ "$BUILDER" = "claude" ]; then REVIEWER=gemini; else REVIEWER=claude; fi

cat <<BANNER
================================================================
 PHASE $PHASE  ·  BUILDER = ${BUILDER^^}  ·  REVIEWER = ${REVIEWER^^}
================================================================

 The one rule: WHOEVER BUILT IT DOES NOT VERIFY IT (AGENTS.md 6.3).
 A reviewer that hands the builder fixes has started grading itself.

--- 1. Each agent arms its own watcher -----------------------

  BUILDER  ($BUILDER):
    bash scripts/agent-bus-watch.sh $BUILDER 30

  REVIEWER ($REVIEWER):
    bash scripts/agent-bus-watch.sh $REVIEWER 30

  (In Claude Code: run it through the Monitor tool, persistent.)

--- 2. Paste to the BUILDER ($BUILDER) -----------------------

  You BUILD Phase $PHASE. $REVIEWER reviews; it will not send you build
  direction. Read AGENTS.md. Check 'bash scripts/agent-bus.sh list --to
  $BUILDER' before each plan and after each. Post completion to
  '--to $REVIEWER' with the evidence, not just a claim. Design DECISIONS
  go to the operator, never to $REVIEWER.

--- 3. Paste to the REVIEWER ($REVIEWER) ---------------------

  You REVIEW Phase $PHASE and you are NOT building it. Capture baselines
  BEFORE $BUILDER touches anything - a baseline taken afterwards measures
  the change against itself. Re-measure every figure rather than reading
  it from the builder's claim; drive anything whose criterion is
  behavioural rather than structural. Verdict is pass or revise with
  named blocking gaps, posted '--to $BUILDER'. Do NOT hand over fixes.

--- 4. What NEITHER agent may settle -------------------------

  DECISIONS go '--to operator' (CLAUDE.md). A reviewer approving a
  builder's decision is not authorisation, it is laundering. If you
  find yourself asking the other agent to ratify a choice, stop and
  ask the operator.

================================================================
BANNER

if [ "$POST" = "1" ]; then
  bash scripts/agent-bus.sh open --to "$REVIEWER" --from operator \
    "ROLE ASSIGNMENT for Phase $PHASE — BUILDER is $BUILDER, REVIEWER is $REVIEWER. Whoever built it does not verify it (AGENTS.md 6.3). Reviewer: capture baselines BEFORE the builder starts, re-measure every figure rather than reading it from a claim, drive anything behavioural, and return pass/revise with named blocking gaps. Do not hand the builder fixes. Decisions go --to operator, never agent-to-agent." >/dev/null 2>&1 \
    && echo "posted role assignment to $REVIEWER on the bus" \
    || echo "WARN: bus post failed — assignment above is still valid, announce it manually"
fi

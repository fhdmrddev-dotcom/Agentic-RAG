<purpose>
Capture a forward-looking idea as a structured seed file with trigger conditions.
Seeds auto-surface during /gsd:new-milestone when trigger conditions match the
new milestone's scope.

Seeds beat deferred items because they:
- Preserve WHY the idea matters (not just WHAT)
- Define WHEN to surface (trigger conditions, not manual scanning)
- Track breadcrumbs (code references, related decisions)
- Auto-present at the right time via new-milestone scan

**One-shot capture**: the seed file is written immediately from the idea text alone.
Trigger / Why / Scope are optional enrichment — they can be provided now or added
later. The file is never gated behind questions.
</purpose>

<process>

<step name="parse-idea">
Parse `$ARGUMENTS` for the idea summary.

First, check for an enrich flag:

```bash
if echo "$ARGUMENTS" | grep -qE '\-\-enrich[[:space:]]+SEED-[0-9]+'; then
  ENRICH_TARGET=$(echo "$ARGUMENTS" | grep -oE 'SEED-[0-9]+')
  SEED_FILE=$(ls .planning/seeds/${ENRICH_TARGET}-*.md 2>/dev/null | head -1)
  # Skip to enrich-seed step — do not prompt for $IDEA
else
  if [ -n "$ARGUMENTS" ]; then
    IDEA="$ARGUMENTS"
  else
    # Ask only when no arguments at all
    # What's the idea? (one sentence)
    IDEA="<user response>"
  fi
fi
```

If `$ENRICH_TARGET` is set, skip straight to the `enrich-seed` step. Do not set `$IDEA` and do not run `create-seed-dir`, `generate-seed-id`, `write-seed`, `collect-breadcrumbs`, `commit-seed`, or `confirm`.

If `$ARGUMENTS` is non-empty and contains no `--enrich` flag, treat the full value as `$IDEA` (no prompt).

Only prompt for the idea when `$ARGUMENTS` is empty and no enrich target is present. Store the response as `$IDEA`.
</step>

<step name="create-seed-dir">
```bash
mkdir -p .planning/seeds
```
</step>

<step name="generate-seed-id">
```bash
# Highest existing SEED-NNN in the register, +1. ⛔ max(id), NEVER count(files).
#
# THE DEFECT THIS REPLACES WAS MEASURED, not suspected. The old form COUNTED THE
# FILES and added one. Measured 2026-09-16: 284 files, 276 distinct ids, highest
# id 285 — so it would have emitted SEED-285, WHICH ALREADY EXISTS. The old
# allocator produces the ninth collision on its very next use, today. Ids stop
# lining up with a count the moment ANY id is renumbered, and this register
# carries eight collisions and two prior renumbers on record.
#
# `10#` is load-bearing and must not be tidied away: seed ids are zero-padded and
# bash reads `022` / `092` as INVALID OCTAL, so `$(( 092 + 1 ))` is a hard error
# without it. Same allocator as `scripts/agent-bus.sh:26-33` next_id().
MAX=$( (ls .planning/seeds/SEED-*.md 2>/dev/null || true) \
  | grep -oE 'SEED-[0-9]{3}' | grep -oE '[0-9]{3}' | sort -n | tail -1 )
NEXT=$(( 10#${MAX:-0} + 1 ))
PADDED=$(printf "%03d" $NEXT)
```

⚠ A gate arm and an allocator are COMPLEMENTARY, not redundant. This prevents the ordinary
single-agent case; `scripts/check-seeds-register.cjs`'s `[duplicate-id]` catches the parallel-agent
case an allocator structurally cannot — two agents can each read the same max and both write max+1.

Generate slug from idea summary.
</step>

<step name="write-seed">
Write `.planning/seeds/SEED-{PADDED}-{slug}.md` immediately with sensible defaults:

- `trigger_when`: default is `unset` — ⛔ **NOT `"when relevant"`, which was the old default and is
  a mood rather than a condition.** `unset` makes the seed count as UNSWEPT in
  `scripts/check-seeds-register.cjs`'s output, which is a number someone can shrink; `"when
  relevant"` reads like a trigger and fires on nothing. Narrow it via `--enrich`.
- `trigger_paths`: default is `[]` — the LOAD-BEARING trigger. A glob here is what actually fires
  when a phase's `files_modified` touches it.
- `scope`: default is `"unknown"` — the user can update it via `--enrich`

⛔ **The block below is the D-09 contract and it is SYNCED with two other files.** It used to write
`id:` (not `seed_id:`), no `surface:`, no `title:`, and `trigger_when: when relevant` — which is the
mechanism that re-introduces the defect Phase 251's 284-file migration removed, one seed at a time,
with nothing saying so. Its keys and comments match `.planning/seeds/TEMPLATE.md` exactly, with ONE
deliberate exception: `trigger_surfaces` carries a POINTER rather than the vocabulary inline,
because this block is stamped into every seed authored from here on and a third copy of those
fifteen words is a third thing to drift.

```markdown
---
seed_id: SEED-{PADDED}            # ⚠ MUST match the filename
title: {one-line summary of $IDEA}
created: {ISO date}               # absolute date, never relative
surface: Agentic-RAG              # Agentic-RAG | Claude.ai | Anthropic-API | OpenAI | OpenRouter | Other
status: planted                   # planted | dormant | open | partially-answered | answered | folded | shipped | closed | deferred | superseded-id
partial: false                    # true when the status is settled on ONE AXIS ONLY
trigger_when: unset               # PROSE, for a human. `unset` until it says a CONDITION, not a mood
trigger_paths: []                 # globs matched against a phase's files_modified — the LOAD-BEARING trigger
trigger_surfaces: []              # controlled enum — see .planning/seeds/TEMPLATE.md
scope: unknown
---

# SEED-{PADDED}: {$IDEA}

## Why This Matters

_To be filled in. Run `/gsd:capture --seed --enrich SEED-{PADDED}` to add context._

## When to Surface

**Trigger:** _unset — run `/gsd:capture --seed --enrich SEED-{PADDED}` and write a CONDITION here,
then mirror it into `trigger_paths` so a sweep can actually fire on it._

This seed is surfaced by `node scripts/check-seeds-register.cjs --phase NNN` at
`/gsd:discuss-phase` and by the register sweep at `/gsd:new-milestone`. ⚠ Until `trigger_paths` or
`trigger_surfaces` is filled in, it matches NOTHING and is counted as unswept.

## Scope Estimate

**Unknown** — run `/gsd:capture --seed --enrich SEED-{PADDED}` to estimate effort.

## Breadcrumbs

_No breadcrumbs collected yet._

## Notes

_Captured via one-shot seed capture. Enrich with trigger, why, and scope at your convenience._
```
</step>

<step name="collect-breadcrumbs">
After writing the file, search the codebase for relevant references:

Extract one or two key terms from `$IDEA` (the most distinctive noun or phrase) and store as `$KEYWORD`.

```bash
# Derive a single keyword for breadcrumb search.
# Lower-case, strip punctuation, take the first token longer than 2 chars.
KEYWORD=$(printf '%s' "$IDEA" \
  | tr '[:upper:]' '[:lower:]' \
  | tr -cs 'a-z0-9' '\n' \
  | awk 'length > 2 {print; exit}')
KEYWORD="${KEYWORD:-seed}"  # fallback to literal "seed" if extraction yields nothing
```

```bash
# Find files related to the idea keywords ($KEYWORD derived from $IDEA)
grep -rl "$KEYWORD" --include="*.ts" --include="*.js" --include="*.md" . 2>/dev/null | head -10
```

Also check:
- Current STATE.md for related decisions
- ROADMAP.md for related phases
- todos/ for related captured ideas

If any breadcrumbs are found, update the Breadcrumbs section of the seed file.
Store relevant file paths as `$BREADCRUMBS`.
</step>

<step name="commit-seed">
```bash
gsd-sdk query commit "docs: plant seed — {$IDEA}" --files .planning/seeds/SEED-{PADDED}-{slug}.md
```
</step>

<step name="confirm">
```text
✅ Seed planted: SEED-{PADDED}

"{$IDEA}"
File: .planning/seeds/SEED-{PADDED}-{slug}.md

Trigger and scope are set to defaults. Run `/gsd:capture --seed --enrich SEED-{PADDED}`
to add trigger conditions, rationale, and scope estimate at your convenience.

This seed will surface automatically when you run /gsd:new-milestone.
```
</step>

<step name="enrich-seed">
**Optional enrichment — only run this step when `--enrich` flag is present.**

If `--enrich` flag is in `$ARGUMENTS`:
- `$ENRICH_TARGET` and `$SEED_FILE` are already set by `parse-idea`. Derive `$SEED_ID` from `$ENRICH_TARGET` (e.g. `SEED_ID="$ENRICH_TARGET"`). If `$SEED_FILE` is empty, fall back to the most-recently modified file in `.planning/seeds/` and set `$SEED_ID` from its filename.
- Ask focused questions to build a complete seed:


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.

```text
AskUserQuestion(
  header: "Trigger",
  question: "When should this idea surface? (e.g., 'when we add user accounts', 'next major version', 'when performance becomes a priority')",
  options: []  // freeform
)
```

Store as `$TRIGGER`.

```text
AskUserQuestion(
  header: "Why",
  question: "Why does this matter? What problem does it solve or what opportunity does it create?",
  options: []
)
```

Store as `$WHY`.

```text
AskUserQuestion(
  header: "Scope",
  question: "How big is this? (rough estimate)",
  options: [
    { label: "Small", description: "A few hours — could be a quick task" },
    { label: "Medium", description: "A phase or two — needs planning" },
    { label: "Large", description: "A full milestone — significant effort" }
  ]
)
```

Store as `$SCOPE`.

Update the seed file's frontmatter and sections with the gathered values:
- Set `trigger_when: {$TRIGGER}`
- Set `scope: {$SCOPE}`
- Fill in `## Why This Matters` with `{$WHY}`
- Fill in `## When to Surface` trigger detail
- Fill in `## Scope Estimate` elaboration

Commit the update:
```bash
gsd-sdk query commit "docs: enrich seed ${SEED_ID} — trigger + why + scope" --files "$SEED_FILE"
```

Confirm:
```text
✅ Seed enriched: ${SEED_ID}
Trigger: {$TRIGGER}
Scope: {$SCOPE}
```
</step>

</process>

<success_criteria>
- [ ] Seed file created in .planning/seeds/ in one step, no questions required
- [ ] Frontmatter includes status, trigger_when (default: "when relevant"), scope (default: "unknown")
- [ ] File is written BEFORE any optional enrichment questions are asked
- [ ] Committed to git
- [ ] User shown confirmation with file path
- [ ] Optional --enrich path available for adding trigger, why, scope post-capture
</success_criteria>

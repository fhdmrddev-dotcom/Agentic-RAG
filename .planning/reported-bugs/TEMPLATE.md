---
id: BUG-YYYYMMDD-NN              # date + sequence (e.g., BUG-260512-01)
title: One-line summary
reported: YYYY-MM-DD              # absolute date — never relative
surface: Agentic-RAG              # Agentic-RAG | Claude.ai | Anthropic-API | OpenAI | OpenRouter | Other
severity: minor                   # blocking | major | minor | info
status: open                      # open | folded | deferred | external-noted | closed
affected_areas: []                # e.g., [frontend/streaming, backend/ingestion, RAG/multimodal, skills, sandbox]
folded_into: null                 # phase number when folded (e.g., "068") — set when status flips to folded
related_seeds: []                 # SEED-NNN ids if this bug correlates with a planted seed
re_open_trigger: null             # required when status=deferred — concrete condition that re-surfaces it
reproduces_on:                    # commit/version where the bug was observed
  branch: 
  commit: 
  date: 
---

# [BUG-ID]: [Title]

## What we observed

[Repro steps, expected vs actual, screenshots/network/log evidence. Stay factual — interpretation goes below.]

## Why it matters

[Severity rationale. Who notices it, what's broken from the user's perspective, what downstream effects.]

## Hypothesized cause

[Best guess at root cause. Mark as hypothesis, not finding, until verified.]

## Surface classification

> **Why this matters for routing:**
> - `Agentic-RAG` → this app; cross-checked at `/gsd:discuss-phase`, `/gsd:new-milestone`, `/gsd:complete-milestone`.
> - External (`Claude.ai`, `Anthropic-API`, etc.) → observability/feedback notes; surfaced to user only, NOT folded into app phases.

[State which surface this is and why.]

## Suggested routing

- **Fold into in-flight phase:** [phase number if relevant, else "n/a"]
- **Defer to future phase / milestone:** [target if relevant, else "n/a"]
- **Plant as seed:** [SEED-NNN candidate if this is a cross-milestone concern]
- **External — note only:** [yes/no]

## Workarounds (prompt-side, code-side, or UI-side)

[Anything the user can do today to dodge this until it's properly fixed.]

## Reference / evidence links

- [Links to commits, network requests, screenshots, related issues]

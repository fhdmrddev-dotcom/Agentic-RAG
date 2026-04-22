---
phase: 23-system-prompt-quality
plan: 01
subsystem: api
tags: [system-prompt, rag, llm, similarity, citation, openai]

# Dependency graph
requires:
  - phase: 18-context-window-hardening
    provides: Stable SYSTEM_PROMPT base after Phase 18 refactor that reduced unnecessary tool loops

provides:
  - SYSTEM_PROMPT similarity confidence hedging (PROMPT-01): agent hedges when all search chunks have similarity < 0.4
  - SYSTEM_PROMPT citation format guidance (PROMPT-02): structured [Document Name] — [section] citation format

affects: [threads, openai_service, any phase that reads or extends SYSTEM_PROMPT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Similarity threshold hedging: agent explicitly acknowledges weak retrieval rather than fabricating from low-confidence chunks"
    - "Structured citation format: bold document name followed by em-dash and section, matching document filename exactly"

key-files:
  created: []
  modified:
    - backend/app/api/threads.py

key-decisions:
  - "Both new sections inserted immediately before the Output file rule paragraph to preserve existing section order and not break the running concatenation"
  - "Citation format uses document filename exactly as stored (e.g., Fahed Mrad Chapters 1-4.docx) to prevent hallucinated or paraphrased document names"
  - "Similarity threshold of 0.4 chosen per PROMPT-01 requirement — scores below this indicate the knowledge base likely does not contain the answer"

patterns-established:
  - "Hedging pattern: when all results.similarity < 0.4, respond with explicit low-confidence message rather than guessing"
  - "Citation pattern: **[Document Name]** — [section] inline in prose, never URL or markdown link"

requirements-completed: [PROMPT-01, PROMPT-02]

# Metrics
duration: 5min
completed: 2026-04-09
---

# Phase 23 Plan 01: System Prompt Quality Summary

**Added similarity confidence hedging (< 0.4 threshold) and structured citation format guidance to SYSTEM_PROMPT, preventing fabricated answers from weak matches and standardizing document reference format**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-09T00:00:00Z
- **Completed:** 2026-04-09T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `## Confidence & hedging` section: instructs the agent to explicitly acknowledge when all retrieved chunks have similarity below 0.4, rather than fabricating from weak matches
- Added `## Citation format` section: defines `**[Document Name]** — [section]` citation style with a concrete example, and prohibits citing documents not retrieved in the current response
- Preserved all existing SYSTEM_PROMPT content exactly — no removals or reordering

## Task Commits

Each task was committed atomically:

1. **Task 1: Add similarity hedging and citation guidance to SYSTEM_PROMPT** - `(pending)` (feat)

**Plan metadata:** `(pending)` (docs: complete plan)

## Files Created/Modified

- `backend/app/api/threads.py` - Added two new sections to SYSTEM_PROMPT: Confidence & hedging and Citation format, inserted before the Output file rule paragraph

## Decisions Made

- Sections inserted immediately before `Output file rule` paragraph to maintain logical flow: tool usage rules → confidence rules → citation rules → output formatting rules
- The 0.4 similarity threshold is the value specified in PROMPT-01 requirements
- Citation example uses an actual project document name (`Fahed Mrad Chapters 1-4.docx`) to make the format concrete and unambiguous

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SYSTEM_PROMPT now instructs the agent to hedge on low-confidence results (PROMPT-01) and cite documents in structured format (PROMPT-02)
- Both requirements are fully satisfied; v2.1 milestone can proceed to remaining items (keyword search scope, read_document context cap, metadata filter normalization)

---
*Phase: 23-system-prompt-quality*
*Completed: 2026-04-09*

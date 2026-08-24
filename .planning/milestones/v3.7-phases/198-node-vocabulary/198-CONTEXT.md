# Phase 198: Node Vocabulary — Context & Decisions

## Context & Overview
Phase 198 was scoped as a research-first phase to evaluate the necessity of new deterministic workflow node primitives (`NODE-01`) and ensure structured mid-run human input is functional (`NODE-02`).

---

## Decisions & Verification

### 1. NODE-01: Deterministic Reshape Primitives
- **Decision:** **Ships nothing.**
- **Rationale:** An exhaustive query of the live database across 291 workflow definitions (119 with phases, 264 total phases) showed **0 of 264 phases** exist solely to reshape data between steps. Authors utilize `execute_code` when deterministic computation or transformations are needed. No demand exists for an intermediary reshape primitive.
- **Re-open Trigger:** Re-open only if a real population of workflow definitions emerges that requires dedicated non-prompt data reshaping.

### 2. NODE-02: Structured Mid-Run Human Input
- **Decision:** **Satisfied by existing platform capabilities.**
- **Rationale:**
  - `llm_human_input` executor was cleanly extracted into `backend/app/services/harness/human_input.py`.
  - Fixed `BUG-260816-06`: Unanswered steps transition to `paused` state rather than silently timing out into an approval.
  - Implemented and verified in `RunSpine.tsx` with dynamic step-authored choice buttons.

---

## Phase Status
- **Status:** Complete (Research-Answered, Ships Nothing)
- **Requirements Covered:** `NODE-01`, `NODE-02`

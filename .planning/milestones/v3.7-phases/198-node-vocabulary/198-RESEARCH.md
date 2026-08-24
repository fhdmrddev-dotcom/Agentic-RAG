# Phase 198 Research: Node Vocabulary (Research-First)

## Executive Summary
Phase 198 evaluates whether dedicated deterministic data-reshaping node primitives are needed (`NODE-01`) and confirms that mid-run human input is properly handled across the backend harness and frontend canvas (`NODE-02`).

---

## 1. NODE-01: Deterministic Reshape Primitives
- **Objective:** Prove whether authors write LLM prompts to reshape data between workflow steps (e.g. JSON to CSV, format conversion).
- **Incumbent:** `execute_code` (Python/JS execution sandbox) is the established, flexible primitive in the platform for programmatic data manipulation.
- **Corpus Analysis:**
  - Database: 291 `workflow_definitions` rows in local DB.
  - 119 workflows contain $\ge 1$ phase, totaling 264 phases across the corpus.
  - 38 phases sit strictly between two other steps (25 after excluding `external_action` and `llm_human_input`).
  - **Result:** 0 of 264 phases match data-reshaping verbs or exist solely to reformat data.
  - **Positive Control:** Control verbs (`search`, `summarize`, `extract`, `generate`) matched 147 of 264 phases.
  - **Verdict:** Ships nothing for `NODE-01`.

---

## 2. NODE-02: Structured Mid-Run Human Input
- **Objective:** Verify mid-run human interaction works reliably without silent auto-approvals or UI stalls.
- **Root Cause & Fix (`BUG-260816-06`):**
  - Previously, unanswered `llm_human_input` steps timed out at 300 seconds and auto-completed with `answer: ""`.
  - In Phase 200, `human_input.py` was extracted from `phase_types.py`. Unanswered steps now transition to `status: "paused"` on timeout, requiring explicit operator action.
- **Canvas Integration:**
  - `RunSpine.tsx` renders the approval card directly at the corresponding step, showing the step's authored choices (e.g., custom buttons, Approve / Reject).
  - Answering the prompt sends `POST /workflow-runs/{id}/ask_user_response` and resumes execution.

---

## 3. Plan Architecture
- **Plan 198-01:** Implement automated regression tests (`test_198_node_vocabulary.py`) enforcing:
  1. Corpus invariant query check (ensuring unwrap logic handles string/object JSONB).
  2. `human_input.py` timeout and pause mechanics (`BUG-260816-06` regression guard).
  3. Frontend `RunSpine.test.tsx` integration verification.

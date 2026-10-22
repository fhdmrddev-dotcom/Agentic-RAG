# Phase 291 — deferred items (out of scope for the plan that found them)

## Found during 291-04

- **`backend/tests/integration/test_214_argument_seams.py::test_S7_the_generate_refusal_returns_the_new_code_from_the_real_service` is RED, inherited from 291-02.**
  It counts `"reason_code":` occurrences in `backend/app/services/workflow_authoring.py` and expects exactly 3 (the three `connection_not_allowed` returns); 291-02 added a fourth (`grounding_unavailable` / `removed_powers_broke_draft` refusals). Measured RED at the 291-04 base `73107e648` in a throwaway worktree, so 291-04 did not cause it (291-04 changed no backend source). It lives in `tests/integration`, outside the unit gate. Owner: whoever closes 291-02's review — re-derive the pinned count with a written reason, as 288-04 / 291-01 did for their pins.

## Found during 291-05

- **`could_not_generate:removed_powers_broke_draft` reads the GENERIC refusal on the describe door.** 291-02 returns this reason code (`describe_draft_guards.py:395`, detail `_BROKE_DRAFT_DETAIL`: "Your attached files asked for actions only your description can add. Removing them left a workflow that cannot run, so no draft was made. Describe the steps you want and try again."). `describeRefusalVocabulary.ts` has no row for it, so `describeRefusal` falls back to the bare `could_not_generate` words ("The model couldn't produce a usable draft.") and the server's own sentence shows only under the technical-names reveal. That blames the model for what the powers guard did. UI-SPEC says this refusal renders the server's sentence. 291-05's plan scoped only `grounding_unavailable`, and Task 3 may not edit source, so it is recorded here. Size: one table row or one key routed like `ENTITLEMENT_REFUSED_KEY` (G-3 `/gsd:fast`). Owner: verify-work / code review for 291.

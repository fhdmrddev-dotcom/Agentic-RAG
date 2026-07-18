# Phase 143 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are NOT caused by the current task's changes
(SCOPE BOUNDARY rule). Not fixed here — recorded for a later cleanup pass.

## Pre-existing test rot (not introduced by Plan 02)

### `tests/test_dual_mode_wiring.py::test_published_workflows_list_endpoint`
- **Found during:** Plan 02, Task 2 wave-merge regression check (`pytest backend/tests -k workflows`).
- **Failure:** the test asserts the `/workflows/published` response body equals
  `[{"id", "slug", "name"}]` (no `definition` key), but the endpoint returns
  `{"id", "slug", "name", "definition": None}`.
- **Root cause:** the additive `definition` field was added to `PublishedWorkflow`
  (and to the `get_published_workflows` return) in **Phase 103-06** (REQ-7 D9/D10).
  This older dual-mode-wiring test was never updated to include the additive key.
- **Proof it predates Plan 02:** at HEAD (before this plan's edits),
  `git show HEAD:backend/app/api/workflows.py` already contains
  `definition=_coerce_definition(r.get("definition"))` (line 136) and
  `definition: dict | None = None` (line 79). Plan 02 touched only the `scope`
  param, the `Query(None)`→`None` defaults, and the new `/starters` route — none of
  which alter the `get_published_workflows` response shape.
- **Fix (deferred):** update the test's expected body to include `"definition": None`
  (one-line assertion update). A `/gsd:quick`-scale test-rot fix, unrelated to WF-01.

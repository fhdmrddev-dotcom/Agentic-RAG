# Phase 115 — Deferred Items

Out-of-scope discoveries logged during execution (NOT fixed — they are not caused by this phase's changes).

## Pre-existing test failures (discovered Plan 02, 2026-06-20)

These 4 unit tests fail on the **Plan-01 base commit** (before any Plan 02 change) — verified by stashing the Plan 02 working tree and re-running them against the committed base. They assert EXACT tool counts / tool-name sets returned by `get_tools`, and are unrelated to `_handle_query_documents_by_view` (which does not touch the registry or `get_tools` — that is Plan 03's SC#1 dual-wiring job).

- `tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_explorer_mode_uses_explorer_tools`
- `tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::test_send_message_default_mode_uses_default_tools`
- `tests/unit/test_module7_tools.py::TestGetTools::test_returns_base_tools_without_tavily_or_sandbox`
- `tests/unit/test_module7_tools.py::TestGetTools::test_returns_one_more_tool_with_tavily`

**Disposition:** Out of scope per the executor SCOPE BOUNDARY (pre-existing, not caused by the current task's changes). Likely fallout from earlier phases adding tools to `get_tools` without updating these count assertions. Plan 03 wires the new tool into `get_tools` and may want to refresh these brittle count assertions at that time, or a future polish bundle should re-baseline them.

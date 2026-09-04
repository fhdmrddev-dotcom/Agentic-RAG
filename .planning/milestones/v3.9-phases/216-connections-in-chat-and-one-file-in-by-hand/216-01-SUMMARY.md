# Plan 216-01 Summary: Backend Chat Connector Tools & Prompt Injection Boundary

## Accomplishments
- Implemented `app/services/connectors/chat_tools.py` providing:
  - `build_chat_tools_for_connectors`: dynamic generation of standard LLM tool schemas from active connector discovered tools, filtering out denied actions.
  - `parse_chat_tool_call_name`: namespaced tool name decomposition (`service_id__tool_name`).
  - `wrap_untrusted_tool_result`: prompt injection security envelope (`<external_tool_result>`) tagging external third-party output.
- Extended `MessageCreate` model in `app/models/message.py` with `active_connector_ids: list[UUID] | None`.
- Updated `backend/tests/unit/test_190_connector_source_fence.py` pinning `chat_tools.py` in `_EXPECTED_MODULES`.
- Created comprehensive unit tests in `backend/tests/unit/test_chat_connector_tools.py`.

## Verification
- Unit test suite: 11 / 11 tests passed in 3.19s (`pytest tests/unit/test_chat_connector_tools.py tests/unit/test_190_connector_source_fence.py`).

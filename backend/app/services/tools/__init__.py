"""Phase 278 (SEAM-03) — the tool HANDLER families, split out of ``tool_dispatcher.py``.

``app.services.tool_dispatcher`` stays the registry module (re-exports, the static
``_TOOL_REGISTRY`` literal, the capability gate and ``dispatch_tool``); each handler lives in
the family module below and is imported BY NAME into that literal:

* ``base``            — ``ToolContext`` / ``ToolResult`` (leaf)
* ``documents``       — KB browse, read / fetch / query / view / related, web search, analyze
* ``skills``          — load / save / read_skill_file / attach_skill_file
* ``sandbox``         — execute_code, hydration, bounded commands, autoheal
* ``runtime_gap``     — the Phase 142 runtime-gap classifier + allowlists (pure)
* ``render_template`` — the template-fill driver + handler
* ``workspace``       — the five workspace handlers
* ``memory``          — remember / recall / query_tables
* ``agent_control``   — task / write_todos / ask_user
* ``connector``       — namespaced connector chat tools + the approval timeout

⛔ This file is a docstring ONLY — no imports, no re-exports, no side effects, so importing one
family never imports another by accident (pinned by test_278_pure_move::test_tools_init_is_docstring_only).
"""

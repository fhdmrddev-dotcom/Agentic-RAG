# 278-03 Task 1 → Task 2 handoff

- Worktree: `C:/Vibe Apps/Agentic RAG/.claude/worktrees/agent-a2ed70a6a5b42b208`, HEAD `b8e46ef57` (base reset fired from `8764137fe`). Nothing committed; no stash.
- `git status --short` after Task 1 (this file aside):
  - ` M backend/app/services/tool_dispatcher.py`
  - ` M backend/tests/unit/test_278_pure_move.py` (xfail markers removed; `grep -c xfail` = 0)
  - `?? backend/app/services/tools/` (11 files below)
- Cut by a throwaway AST-span slicer in the scratchpad (`s278/slice.py`, MOVE_MAP imported from the pin, base copy md5 `639e441628fd868f365774189fbf49a0`). Per-family imports derived by the pin's own symtable check, so every module resolves every global it reads.

| module | lines | cross-family imports (by name) |
|---|---|---|
| `tool_dispatcher.py` | 274 | handlers from 7 families; `_handle_connector_chat_tool` from connector |
| `tools/__init__.py` | 20 | none (docstring only) |
| `tools/base.py` | 149 | none (stdlib + TYPE_CHECKING block) |
| `tools/documents.py` | 762 | base; workspace `_normalize_optional_int` |
| `tools/skills.py` | 759 | base; documents `_fetch_owned_document_bytes`; runtime_gap `SCRIPT_EXTS` |
| `tools/sandbox.py` | 1218 | base; skills `_resolve_skill_visibility_or`; runtime_gap `KNOWN_MISSING_MODULES, _NO_MODULE_RE, _classify_runtime_gap, _code_references_dead_token, _repeat_blocked_result` |
| `tools/runtime_gap.py` | 310 | none (`json`, `re as _re_filename`) |
| `tools/render_template.py` | 787 | base |
| `tools/workspace.py` | 223 | base |
| `tools/memory.py` | 121 | base |
| `tools/agent_control.py` | 478 | base |
| `tools/connector.py` | 380 | base |

- Re-exports in `tool_dispatcher.py` (D-04): `ToolContext`, `ToolResult` (tools.base), `SCRIPT_EXTS` (tools.runtime_gap), `_attachment_container_path` (tools.sandbox). The registry module imports nothing else it does not use: `search_documents`, `aexec`, `write_audit_entry`, `ws_*` etc. are gone.
- Pins: `pytest tests/unit/test_278_pure_move.py tests/unit/test_278_registry_pin.py tests/unit/test_259_closed_core_inventory.py tests/unit/test_272_search_tool_move.py -q` → `2 failed, 57 passed`. Both 278 pins are fully green. The 2 reds are Task 2 retargets: test_259 `_HANDLER_FILES` (planned) and **test_272 `test_patch_where_used_old_target_alone_is_missed`** (NOT in the plan: it patches `td.search_documents`, which the registry module no longer binds).
- `check-test-retarget-only.py --no-loss HEAD WORKTREE` → EXIT 0 (4332 removed lines all re-appear).
- Extra runtime_gap names: none beyond the plan's list. The symtable check did NOT need `_message_for_dead_token` in sandbox.
- Task 2: tables A-E plus test_272 (patch-target retarget, comment line explains). Logger record names are now `app.services.tools.<family>`; no test filters on the old name (grep, 0 hits).

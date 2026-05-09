---
phase: 065-skills-test-infrastructure-repair
reviewed: 2026-05-09T17:05:00Z
depth: quick
files_reviewed: 1
files_reviewed_list:
  - backend/tests/integration/test_threads_skills.py
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
  blocker: 0
status: clean
---

## CODE REVIEW PASSED

Quick post-execution review of Plan 065-03's single-file rewrite. Plan 03's implementation faithfully delivers what the prior REVIEW.md (BL-01 / WR-01 / WR-02 / IN-01) demanded, and the three Rule-3 auto-fixes plus the Rule-1 helper consolidation introduce no new defects.

### Prior findings — all closed

| ID    | Demand                                                                       | Verified at        | Status |
| ----- | ---------------------------------------------------------------------------- | ------------------ | ------ |
| BL-01 | INSERT mock returns row with `id` field                                      | line 180           | CLOSED — `_messages_execute` first-call returns `[{"id": str(uuid4())}]`; subsequent calls return `[]` |
| WR-01 | No `client.stream("POST", ...)` for SSE; POST→GET-stream pattern             | counter-greps      | CLOSED — `client.stream("POST"` count = 0; `_collect_sse_events` count = 0; canonical POST (line 293) → JSON unwrap → GET stream (line 319) → drain to `TERMINAL_TYPES` |
| WR-02 | `THREAD_ID` per-test, not module-level singleton                             | lines 23-41, 125-130 | CLOSED — `^THREAD_ID *=` count = 0; replaced with `thread_id` fixture (line 126) generating fresh `uuid4()` per test; SKILL_ID retained as module-level (justified: never participates in cross-test Redis state, comment line 41) |
| IN-01 | Assertion message strings reference `create_adaptive_streaming_chat`         | counter-grep       | CLOSED — `"create_streaming_chat was not called"` count = 0; new strings at lines 364, 398, 435 reference the renamed symbol |

### Auto-fixes — verified non-defective

**Generator wrapper `_gen_chunks` (lines 45-54):**
- Generator function — `.close()` is built into Python's generator protocol, satisfying production's `close_fn=stream.close` binding at `app/api/threads.py:1566`. Confirmed by reading production: `_drain_stream_with_close_on_cancel` uses `(close_fn or stream.close)()` (line 237).
- `iter([` count = 0 across the file; all 21 `_gen_chunks([...])` call sites use the helper.
- The generator is single-use (each `_gen_chunks(stream_chunks)` call creates a fresh iterator); test bodies that need a second LLM round build new chunk lists per call (e.g., line 464). No iterator-exhaustion latent bug.
- Resource hygiene: production calls `stream.close()` on cancel/timeout; Python's generator `.close()` raises `GeneratorExit` at the suspended `yield`. The simple `for c in chunks: yield c` loop has no resources to leak — closure is a no-op other than letting the generator return.

**`_reset_sse_starlette_app_status` import (line 38):**
- Verbatim mirror of `test_063_post_then_subscribe.py:40` (canonical analog).
- Source fixture in `test_059_disconnect.py:64-94` is `autouse=True` — importing the symbol auto-registers it in this module's pytest scope (the `# noqa: F401, E402` comment correctly suppresses the "unused import" lint).
- The 059 fixture asserts `sse_starlette.__version__.startswith("2.4.")`; this guard fires identically here. Acceptable coupling.

**Cached `skills` + `skill_files` builders (lines 213-245):**
- The `_skills_state["calls"]` counter is initialized **inside** `_build_mock_supabase_for_skill_test`, so each test invocation gets a fresh counter (each test calls the helper once, before `_post_and_drain`). Verified by tracing every test — none reuse a pre-built mock_supabase across multiple `_post_and_drain` calls.
- `skills_builder` and `skill_files_builder` are built once per helper invocation and returned by `_table_dispatch` for every `mock_supabase.table("skills")` call within that test — closes the original "fresh MagicMock per call" defect (Rule 3 auto-fix #3).
- The 2-call routing assumption (catalog SELECT → save_skill existing-check → fall through to lookup_rows) is documented in the docstring (lines 152-166); the comment correctly identifies the 3rd-call edge cases (save_skill INSERT after empty existing, read_skill_file normalized-name retry) as benign.
- Defensive `assert callable(original_table_dispatch)` at lines 197-202 fails fast if `_run_helpers._build_mock_supabase` evolves shape — good Phase-063-style anchor pattern.

### Rule 1 refactor — semantics preserved

`_post_and_drain` helper (lines 263-333):
- Each of 11 tests calls it exactly once; the helper handles dependency override, all 3 patches, ASGI client, POST→JSON→sleep(0.2)→runs SELECT mock→GET stream→drain-to-`TERMINAL_TYPES`→cleanup in `finally`.
- Mirrors `test_063_post_then_subscribe.py:83-170` step-for-step including the 200ms producer-priming sleep and the runs-table side_effect override (Pitfall 4 documented at lines 305-307).
- The helper returns the SSE event list; tests that need to assert on captured-by-fake-LLM messages use closure-captured lists (e.g., `captured_messages` at line 345, `captured_kwargs` at line 416, `captured_tool_messages` at line 749) — observable test semantics fully preserved.
- AC #7-#9 deviation (literal counts of 11 → 1) is justified per the SUMMARY.md decision rationale; the spirit (every test follows the canonical pattern) is preserved.

### Production contract anchors — honored

- `TERMINAL_TYPES` import at line 26 with comment `# frozenset({"done", "error", "cancelled", "timed_out"})` matches production at `app/api/threads.py:88`. No `stream_end` leakage into the test side.
- INSERT-id mock shape `[{"id": str(uuid4())}]` matches production unwrap at `app/api/threads.py:921` (`_user_msg_data[0].get("id")`).

### Test silencing — none

- `@pytest.mark.skip` count = 0
- `@pytest.mark.xfail` count = 0
- `pytest.skip(` count = 0

No tests faked-green via skip/xfail.

### Counter-grep summary (re-verified live)

| Anti-pattern                                      | Expected | Actual |
| ------------------------------------------------- | -------- | ------ |
| `client.stream("POST"`                            | 0        | 0      |
| `_collect_sse_events`                             | 0        | 0      |
| `^THREAD_ID *=`                                   | 0        | 0      |
| `create_streaming_chat was not called`            | 0        | 0      |
| `mock_builder` (flat-queue legacy)                | 0        | 0      |
| `iter([` (non-generator stream)                   | 0        | 0      |
| `@pytest.mark.skip` / `@pytest.mark.xfail` / `pytest.skip(` | 0 | 0 |
| `app.api.threads.create_adaptive_streaming_chat`  | ≥1       | 1 (in shared helper) |
| `def _reset_redis_singleton`                      | 1        | 1      |
| `def _build_mock_supabase_for_skill_test`         | 1        | 1      |
| `_gen_chunks`                                     | ≥11      | 21     |

### Notes (non-findings)

- The closure variable name `fake_create_streaming_chat` (24 occurrences) intentionally drops the `adaptive_` prefix for terseness; this is a local identifier, not a patch target. Pure stylistic; not worth a finding.
- `SKILL_ID = str(uuid4())` retained as module-level singleton at line 41. The inline comment justifies the carve-out ("never participates in cross-test Redis state"). Verified: tests that need a stable `id` for `skill_lookup_rows` reuse `SKILL_ID` deliberately; no Redis or thread-keyed state derives from it. Acceptable.

### Verdict

Plan 065-03's implementation closes BL-01 / WR-01 / WR-02 / IN-01 cleanly. The three Rule-3 auto-fixes (`_gen_chunks` generator, AppStatus reset import, cached skills/skill_files builders) introduce no new defects. The Rule-1 `_post_and_drain` helper preserves all test semantics. No tests silenced. Production contract anchors honored. Phase 065 is eligible to ship from a code-quality standpoint.

---

_Reviewed: 2026-05-09T17:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

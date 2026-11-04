---
phase: 306-ask-the-agent-and-run-workflows
reviewed: 2026-11-01T00:00:00Z
depth: standard
files_reviewed: 50
files_reviewed_list:
  - backend/app/api/inbound.py
  - backend/app/api/notifications.py
  - backend/app/api/settings.py
  - backend/app/db/rates.py
  - backend/app/db/workflows.py
  - backend/app/mcp/ask_tools.py
  - backend/app/mcp/audit.py
  - backend/app/mcp/dispatch.py
  - backend/app/mcp/limits.py
  - backend/app/mcp/results.py
  - backend/app/mcp/run_tools.py
  - backend/app/mcp/server.py
  - backend/app/mcp/tools.py
  - backend/app/models/thread.py
  - backend/app/models/user_settings.py
  - backend/app/services/harness/run_read_wire.py
  - backend/app/services/inbound_inputs.py
  - backend/app/services/key_run_read.py
  - backend/app/services/key_run_start.py
  - backend/app/services/outside_admission.py
  - backend/app/services/outside_ask.py
  - backend/app/services/outside_run_scope.py
  - backend/app/services/rate_limit.py
  - backend/app/services/search_documents_tool.py
  - backend/app/services/search_vocabulary.py
  - backend/app/services/tool_dispatcher.py
  - backend/app/services/unattended_launch.py
  - frontend/src/components/chat/UserMessageBubble.tsx
  - frontend/src/components/chat/outsideAskEnvelope.ts
  - frontend/src/components/layout/ChatHistoryColumn.tsx
  - frontend/src/components/layout/attentionConditions.ts
  - frontend/src/components/layout/waitingVocabulary.ts
  - frontend/src/components/settings/ApiKeyLimits.tsx
  - frontend/src/components/settings/apiKeys/ApiKeyCallStrip.tsx
  - frontend/src/components/settings/apiKeys/McpKeyFields.tsx
  - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
  - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
  - frontend/src/components/settings/apiKeys/mcpCallWords.ts
  - frontend/src/components/settings/apiKeys/mcpKeyCopy.ts
  - frontend/src/components/settings/apiKeys/mcpKeyFacts.ts
  - frontend/src/components/workflows/RunOriginLine.tsx
  - frontend/src/components/workflows/runOriginVocabulary.ts
  - frontend/src/lib/api/notifications.ts
  - frontend/src/lib/api/skills.ts
  - frontend/src/types/index.ts
  - scripts/burst-306-outside-starts.py
  - scripts/check-migration-223-live.py
  - scripts/full-schema-supplement.sql
  - scripts/uat-306-ask-roster.py
  - supabase/migrations/223_mcp_ask_run_and_admission.sql
findings:
  critical: 2
  warning: 6
  info: 6
  total: 14
status: issues_found
---

# Phase 306: Code Review Report

**Reviewed:** 2026-11-01
**Depth:** standard (phase diff `c3a5ea888..HEAD` plus the call paths it reaches)
**Files Reviewed:** 50
**Status:** issues_found

## Summary

I reviewed the phase's changes against CONTEXT D-01..D-39, starting with the areas the brief marked highest risk. Each finding below was checked by reading the code path it describes.

**What holds up:**
- **Seam B (`dispatch_tool`)** is the first branch. It refuses before any handler or registry lookup. Every dispatch site goes through it: the main loop, the cap-pause resume path and sub-agents. The resume ctx carries `pool`, so the durable D-28 read binds on an in-app Continue too.
- **The STRUCTURED (non-native) path** is covered by Seam B.
- **The fresh-context spawn** (`create_task(..., context=Context())`) is correct.
- **The Lua admission script** has correct KEYS/ARGV indexing and its expiry only ever extends.
- **Idempotency claim/bind/drop** is correct on the non-cancelled paths.
- **Migration 223** revokes from PUBLIC before GRANT. Its CHECK bounds match `settings.py` and the `ApiKeyLimits` clamps (5..45, 1..50).
- **The spend CTE's LEFT JOIN** is on a primary key with a filter, so no root is multiplied.
- **`AskArgs` / `RunWorkflowArgs`** forbid extra fields, so no MCP input can reach the model override (D-37).
- **Blocking I/O:** every new supabase-py call is wrapped in `asyncio.to_thread` / `run_in_threadpool`.

**The two blockers:**
1. **A narrowed key loses its folder wall** once a cap-paused ask is continued in the app. This is the flow D-06/D-33 designed. The continuation keeps the same run id, and `get_answer(handle)` hands its answer back to the key.
2. **`get_workflow_run`'s `end_reason` skips the outbound guard and defanging.** It is free text, often written by an LLM, and it reaches the AI tool unredacted even when the org's redaction switch is on.

## Critical Issues

### CR-01: A Continue on a cap-paused ask drops the key's folder wall, and `get_answer` returns the result to the key

**File:** `backend/app/services/outside_ask.py:291,379-411` (with `backend/app/services/run_producer.py:1126-1131` and `backend/app/api/runs.py` Deep continue arm)

**Issue:**
1. The ask binds its folder wall only in memory: `ThreadScoping(list(scope_folder_ids), None, None, None, None)` is handed to the first `run_producer` call (D-30). Nothing durable records that scope on the thread.
2. When the ask hits the tool-round cap, `read_ask` returns `needs_input` with the chat link (D-33). The member presses Continue in the app, which is the flow D-06 designed.
3. `continue_run` calls `spawn_continuation_run`. That **keeps the same `run_id`** ("the Deep consume path keeps the same run_id") and re-resolves scope through `_resolve_thread_scoping`.
4. For a thread with no `active_expert_id`, `_resolve_thread_scoping` returns `ThreadScoping(None, None, None, None, None)` (run_producer.py:534-535). So `folder_subtree_ids` is `None`: no folder filter at all. The replayed tool calls (agent_loop.py:2255 `_resume_ctx`) and every later round read the member's whole org knowledge base. That includes root documents, which D-30 says fall outside an ask.
5. The continuation finalizes the **same** run as `completed` with a new `message_id`, and `continues_used = 1`. Now `run_is_cap_paused` is false.
6. `get_answer(handle)` from the narrowed key passes `_ACCESS_SQL` (same run, same key, same org) and returns `msg["content"]` plus `source_refs` citations. Those are drawn from folders the key was never allowed to read.

Result: a folder-narrowed key reads answers and document titles/ids from outside its folders. D-10/D-30 require that a narrowed key never sees past its folders. Seam B still holds the tool allow-list here; the folder wall is what breaks.

**Fix:** The minimal, fail-closed fix is in the read. Never return content produced by an in-app continuation to the key:
```python
_ACCESS_SQL = (
    "SELECT r.run_id, r.status, r.message_id, r.thread_id, COALESCE(r.continues_used, 0) AS continues_used "
    "FROM public.runs r JOIN public.threads t ON t.id = r.thread_id "
    "WHERE r.run_id = $1 AND r.user_id = $2 AND t.origin_kind = 'mcp' AND t.origin_ref = $3 "
    "AND t.org_id = $4 AND r.parent_run_id IS NULL"
)
...
if row["continues_used"] > 0 and status == "completed":
    # Finished in the app, outside the key's folder scope: point at the chat, never relay it.
    return AskRead(status="answered_in_app", **base)   # + a sentence in results._ASK_END
```
A longer-term option is to persist the ask's folder scope (for example a `threads.origin_scope` jsonb frozen by the 223 trigger). `_resolve_thread_scoping` would then rebind it for every later run on an `origin_kind='mcp'` thread. Add a two-org / narrowed-key test that drives cap pause → Continue → `get_answer`.

### CR-02: `RunRead.end_reason` skips the outbound guard (PII redaction) and defanging

**File:** `backend/app/mcp/results.py` (`class RunRead`, `end_reason: str | None`), `backend/app/mcp/run_tools.py:278-281`, `results._render_run`

**Issue:**
- `get_workflow_run` copies `read.end_reason` into `RunRead.end_reason` as a plain `str`. It does not go through `R.defang`, and the field is not typed `RedactableText`.
- `outbound_guard.guard` rewrites **only** fields annotated `RedactableText` (outbound_guard.py:10, 156-163). So this field leaves unredacted even when the org's PII switch is on (GUARD-03 / D-07's "every shape goes through the outbound guard").
- `end_reason` comes from `resolve_end_reason`, which reads the failed phase's `_failure_reason`:
  - `harness_engine.py:1966` stores `fail_phase(pool, phase_id, outcome.reason)`, a validator or judge reason that is often LLM-written about the document content;
  - `compose_emit_failure` stores emit causes;
  - `harness_audit` `run_failed` / `policy_applied` metadata reasons also feed it.
- `_render_run` then puts it into the text verbatim (`RUN_FAILED_REASON.format(reason=reason)`), and it also appears in `structuredContent`.

This is a fail-open hole in a fail-closed control, and an unframed injection channel back into the calling model.

**Fix:**
```python
class RunRead(BaseModel):
    ...
    end_reason: RedactableText | None = None
```
and in `run_tools._shape`: `end_reason=R.defang(read.end_reason) if read.end_reason else None` for both the failed and stopped arms. Add a test in the 305-04 guard suite that a `RunRead` with an email in `end_reason` comes out redacted when the switch is on.

## Warnings

### WR-01: Seam A is not durable. On an MCP-origin thread the model is still offered the full tool set and connector tools (D-28 deviation)

**File:** `backend/app/services/outside_run_scope.py:103-121`, `backend/app/services/search_vocabulary.py:180-181`, `backend/app/services/agent_loop.py:1746,1828-1831`

**Issue:**
- D-28 says the durable thread-origin check "is read at the **same young seams**". `narrow_schemas` (Seam A) reads only the ContextVar, which is unset on a member's in-app Continue or typed follow-up on an MCP thread.
- So those runs are **offered** `web_search`, `execute_code`, `save_skill`, `remember`, the task tool and so on. Then they are refused at Seam B on every call.
- Even inside an ask, Seam A runs at agent_loop.py:1746, and the connector block appends connector schemas afterwards (`active_tools = base_tools + connector_tools`, line 1831). On a Continue with lit composer chips, connector tools are offered too.
- Seam B keeps this from being a security hole. But it wastes rounds on refusals, which pushes the run toward the very cap pause CR-01 starts from. It also contradicts the frontend promise in `OUTSIDE_ASK_NOTE`.

**Fix:** Give `narrow_schemas` the same durable branch as Seam B. Pass the thread id and pool, or have the agent loop resolve `outside_allowlist_for`-style once per run and narrow by it. Then re-apply the narrowing after the connector block. A single additive line after line 1831 (`active_tools = narrow_schemas(active_tools, user_settings) or active_tools`) would also cover connectors, though it means an edit to `agent_loop.py` that D-26 avoided, so it needs an explicit decision.

### WR-02: Cleanup on cancellation is not shielded. Leases leak, idempotency claims stick at `starting` for 24 h, and `run_workflow` can orphan a run

**File:** `backend/app/mcp/ask_tools.py:123-155`, `backend/app/mcp/run_tools.py:206-254`, `backend/app/api/inbound.py` (admission `try/except BaseException`)

**Issue:**
- **ask_agent, model resolution:** `resolve_ask_model` is wrapped in `except Exception`, so a `CancelledError` (client disconnect, stateless-transport termination) skips `_drop()`. The claim stays `{"state":"starting"}` for `IDEM_TTL_S` = 24 h. Every retry with that key then gets "already being started. Send again in a few seconds" for a day.
- **Admission:** `_adm.acquire` catches only `Exception`. A cancel that lands after the Lua script admitted the lease leaks it until its TTL: 900 s for an ask, 1860 s for a run. At the default 2 per key, two cancelled starts lock a key out for up to 31 minutes.
- **The `except BaseException` branches:** these do `await _release()` / `await _drop()` unshielded. The MCP SDK runs handlers under anyio cancel scopes, where cancellation is level-triggered. Every further `await` inside a cancelled scope raises again, so `release()` dies on its first `zrem` (`CancelledError` passes its `except Exception`). This is the same mechanism as BUG-261031-04, which 305 fixed for audit writes with `move_on_after(..., shield=True)`.
- **run_workflow launch:** `await asyncio.create_task(launch, ...)` cancels the launch task when the handler is cancelled. If that happens after `create_workflow_run` and before the `_drive_run` task is created, it leaves an `active` `workflow_runs` row with no drive and no `on_finish`.

**Fix:** Wrap every give-back in a shield, for example:
```python
async def _cleanup():
    with anyio.CancelScope(shield=True):
        await _release(); await _drop()
```
Catch `BaseException` (not `Exception`) around `resolve_ask_model` and `acquire`, and run the shielded cleanup there. Await the launch through `asyncio.shield(task)` so a cancelled handler cannot cancel the launch. Release the lease from the task's own completion instead.

### WR-03: Seam B's durable read adds a DB dependency to every in-app chat dispatch, and a failed read refuses in-app tools with a false sentence

**File:** `backend/app/services/outside_run_scope.py:149-180`, `backend/app/services/tool_dispatcher.py:242-246`

**Issue:** With the ContextVar unset, any in-app chat dispatch of a non-allow-listed tool (`web_search`, `execute_code`, `task`, connector tools...) on a thread not yet cached now runs `SELECT origin_kind FROM threads`. On **any** read error it returns `ASK_TOOL_ALLOWLIST`, so a pool blip refuses tools on ordinary in-app threads. The refusal tells the model "This chat was started from an AI tool, so the agent can only search and read documents here", which is untrue for an in-app thread.

That contradicts D-16 ("the in-app path gets no new check ... cannot be slowed by construction") and D-17 ("in-app use continues"). The cache is also cleared wholesale at 4096 entries, which re-arms the read for every active thread on that worker.

**Fix:** Do the origin read once per run, where the run is set up, and carry the result on the run's context. On a failed read during an in-app run, refuse with a neutral sentence ("This tool isn't available right now"), never the AI-tool sentence. Record the D-16 trade-off explicitly in CONTEXT if fail-closed on every in-app thread is intended.

### WR-04: The key's "leave out mail and synced sources" exclusion does not apply to `list_workflows` / `run_workflow`

**File:** `backend/app/mcp/run_tools.py:93-104`

**Issue:**
- `_runnable` narrows only by `principal.folder_ids`. For a key that is not folder-narrowed but has `include_external = False`, every published workflow is listed and runnable. That includes workflows bound to no folder (they read the whole knowledge base, mail and synced roots included) and workflows bound to synced-source folders.
- Their output comes back through `get_workflow_run.output`.
- D-29 refuses `ask_agent` for such a key because "the chat KB tools cannot honour that exclusion". The workflow path has the same property, but no decision covers it.

**Fix:** Apply the same fail-closed rule. When `not principal.include_external`, list and run only workflows whose `bound_folder_ids` are non-empty and contain no external or synced root. Alternatively, refuse with the D-29-style sentence. Record the choice as a decision.

### WR-05: Spend by key bills a member's own in-app turns on an MCP thread to the key

**File:** `backend/app/db/rates.py:143-151,953-954`

**Issue:** The root's `api_key_id` / `tool` come from the **thread's** origin. Every later root run on that thread is therefore shown as `source: "mcp"`, labelled with the key and tool `ask_agent` or `run_workflow`. That covers the member's in-app typed follow-ups and the in-app Continue continuation segment, both of which are in-app usage. The per-key ledger (D-18/D-34) over-reports the key's spend.

**Fix:** Attribute only runs the key started. Either record the starting key on the run (`runs` metadata at `register_run_start` in `start_ask`), or restrict the CASE to the thread's first root run (`r.started_at = (SELECT min(started_at) FROM runs WHERE thread_id = r.thread_id AND parent_run_id IS NULL)`). Note that the SQL text is pinned by `test_305_spend_cte.py`, so the pin must change deliberately.

### WR-06: A failure partway through `start_ask` leaves an orphan MCP-marked thread in the member's history

**File:** `backend/app/services/outside_ask.py:222-270`

**Issue:** The thread INSERT (stamped `origin_kind='mcp'`) and the message INSERT are separate statements, followed by `register_run_start`. If the message insert or `register_run_start` raises:
- `ask_agent` releases and drops, and the exception propagates (generic failure to the AI tool);
- the thread row stays, titled "New Chat", with the AI-tool origin mark, no run and possibly no message.

The UAT row "the MCP ask appears in thread history" would then show phantom asks after transient failures.

**Fix:** On failure, delete the thread row inside the same `try` (service role, `WHERE id = $1 AND origin_kind = 'mcp'`). Or insert the thread and message through one asyncpg transaction.

## Info

### IN-01: A paused workflow run releases its admission lease, so its resume runs unadmitted

**File:** `backend/app/services/unattended_launch.py` (`_drive_run` finally → `on_finish`), `backend/app/mcp/run_tools.py:219-220`
**Issue:** `run_workflow` returns when the run pauses, so `on_finish` releases the lease while the run is still alive. After the person answers, the resumed drive holds no slot. D-17 says "released when the run ends". This may be fine, since a paused run uses nothing, but it should be stated.
**Fix:** Record it as a decision, or release only when the status read back is terminal.

### IN-02: The envelope's closing-tag escape misses variants, and a question can carry a fake `[SYSTEM NOTICE: ...]`

**File:** `backend/app/services/inbound_inputs.py:271` (`_CLOSING_TAG = r"</\s*external_input"`)
**Issue:** `< /external_input>` (a space after `<`) and full-width or HTML-entity look-alikes are not neutralised. This is now applied to an arbitrary 16 000-character free-text field. Structure (the allow-list and the folder wall) is the real control, so this is a mitigation gap only.
**Fix:** Widen the pattern to `<\s*/\s*external_input`. Optionally escape a leading `[SYSTEM NOTICE` inside the value.

### IN-03: The thread title is generated from the raw, un-enveloped outside question

**File:** `backend/app/services/outside_ask.py:276-289`
**Issue:** `maybe_autotitle_thread(first_message=question)` sends untrusted outside text to a title LLM call with no TRUST-03 framing. A crafted question can set an arbitrary thread title in the member's history. The impact is low (display only).
**Fix:** Pass the envelope, or clamp and sanitise the returned title.

### IN-04: A definition republished between listing and validation can widen a narrowed key's run

**File:** `backend/app/mcp/run_tools.py:162-194`
**Issue:** The folder narrowing (`bound_folder_ids ⊆ allowed`) checks the definition from `list_workflows`. `validate_key_start` re-reads the definition and launches that one. A republish in between, adding a folder outside the key, is launched without the folder re-check. The window is narrow.
**Fix:** Re-check `bound_folder_ids(checked.raw) ⊆ allowed` on `checked` before `acquire` when the key is narrowed.

### IN-05: Work after the deadline still runs inside the tool call

**File:** `backend/app/mcp/ask_tools.py:160-164`, `backend/app/mcp/dispatch.py:144-159`
**Issue:** D-36 says bookkeeping runs "in the background, never inside the budget". After `wait_for_ask` returns at `t0 + budget`, the call still runs:
- `read_ask` (two queries);
- the outbound guard (up to 2 s);
- the shielded audit write (up to 5 s).

At the 45 s maximum that is about 52 s plus transport, which leaves little room before the ~60 s client cut-off.
**Fix:** Cap the budget's effective deadline at `t0 + budget - 8`, or lower the ceiling to 40.

### IN-06: The ask lease can expire while the ask is still running

**File:** `backend/app/services/outside_admission.py:54`
**Issue:** `ASK_LEASE_TTL_S = 900`, but no maximum duration is enforced on an ask's run. A slow provider plus many tool rounds can run past 15 minutes, and then the slot frees while the run is in flight, so admission over-admits.
**Fix:** Tie the TTL to the run's actual bound, or refresh the lease score from the producer's heartbeat.

---

_Reviewed: 2026-11-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

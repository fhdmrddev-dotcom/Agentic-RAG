# 267 VALIDATION — the 4-axis UAT scoreboard (authored BEFORE the drive)

Authored by plan 267-05 Task 3 step (1), before any live request was sent. CLAUDE.md "UAT scoreboard
recipe (MANDATORY)": the phase touches the agent loop (tool floor), provider routing (the handoff
summary goes through `forced_emit` on the composer's model) and UI state, so all four axes are owed.
Verdicts are filled into `267-UAT-LOG.md`; this file fixes the rows and the pass bar so the drive cannot
choose them afterwards.

## Roster derivation (re-derived, never re-typed)

Command (backend venv, repo HEAD `33eabd99f` + the 267-05 test commit):

```python
from collections import defaultdict
from app.config import MODEL_CAPABILITIES
g = defaultdict(list)
for mid, cap in MODEL_CAPABILITIES.items():
    g[cap.get("provider")].append((mid, cap.get("emit_tier"), cap.get("native_tools"),
                                   cap.get("api_surface"), cap.get("capability_source")))
```

Output (abridged to the provider set and each group's candidates):

```
providers: ['anthropic', 'deepseek', 'google', 'minimax', 'moonshot', 'openai', 'openrouter', 'zhipu']
## anthropic  claude-sonnet-5 ('force', True, None, 'registry') … claude-haiku-4-5-20251001
## deepseek   deepseek-v4-flash, deepseek-v4-pro ('force', True, None, 'registry')
## google     … gemini-3.1-pro-preview, gemini-3.5-flash ('force', True, None, 'registry'), gemini-3.1-flash-lite
## minimax    MiniMax-M2 … MiniMax-M3 ('force', True, None, 'registry')
## moonshot   kimi-k2.6 ('coerce', True, None, 'registry'), kimi-k2.5, moonshot-v1-8k
## openai     gpt-4o … gpt-5.6-sol / -terra / -luna ('force_strict', True, 'responses', 'registry'), o1
## openrouter … z-ai/glm-5.2 ('force', False), moonshotai/kimi-k2.6 ('coerce', False), deepseek/deepseek-v4-pro ('force', False)
## zhipu      glm-4.5 … glm-5.2 ('force', True, None, 'registry')
```

Eight provider groups, exactly the CLAUDE.md native roster + OpenRouter. No group is missing.

**Model Registry DB cross-check** (Phase 262: capabilities are data) — local
`model_capabilities_overrides` (51 rows), filtered to the chosen ids:

```sql
SELECT * FROM model_capabilities_overrides
WHERE model_id IN ('gpt-5.6-sol','claude-sonnet-5','gemini-3.5-flash','deepseek-v4-pro','glm-5.2',
                   'MiniMax-M3','kimi-k2.6','deepseek/deepseek-v4-pro');
```
```
deepseek-v4-pro           provider deepseek   enabled true  removed false  deprecated false  emit_tier null  native_tools null
gemini-3.5-flash          provider google     enabled true  removed false  deprecated false  emit_tier null  native_tools null
kimi-k2.6                 provider moonshot   enabled true  removed false  deprecated false  emit_tier null  native_tools null
deepseek/deepseek-v4-pro  provider openrouter enabled true  removed false  deprecated false  emit_tier null  native_tools TRUE
(gpt-5.6-sol, claude-sonnet-5, glm-5.2, MiniMax-M3: no override row — the seed stands)
```

⚠ **Recorded, not smoothed:** the local DB sets `native_tools = true` for the OpenRouter row
`deepseek/deepseek-v4-pro` (and for `z-ai/glm-5.2`), overriding the seed's `False`. So on THIS box the
OpenRouter row does NOT exercise the non-native tool path CLAUDE.md describes; it exercises OpenRouter's
native tool calling. The row is still the OpenRouter transport row; the distinction is stated in the log.

## SC#10 — cross-provider board (8 rows, one newest registry-backed id per provider)

Method (Phase 185): per-request `model` + `provider` on `POST /threads/{id}/messages`; no global setting
touched. Each row is its own brand-new thread created with
`POST /threads {folder_id: null, active_expert_id: <Financial Analyzer>}` (also exercises D-267-21's server
path). Prompt, identical on every row:

> Search the web for today's euro area deposit facility rate and save a one-line note with the figure and
> its source to a file named rate.md.

Then `POST /threads/{id}/handoff {expert_id: <Contract Reviewer>, model, provider}` on the same thread.

| # | Provider | Model id | emit_tier | Tool prompt verdict (web_search AND workspace write, both succeed) | runs row id (model/provider match) | Handoff summary (201 + items / 502) | Status |
|---|---|---|---|---|---|---|---|
| 1 | openai | `gpt-5.6-sol` (Responses surface) | force_strict | | | | |
| 2 | anthropic | `claude-sonnet-5` | force | | | | |
| 3 | google | `gemini-3.5-flash` | force | | | | |
| 4 | deepseek | `deepseek-v4-pro` | force | | | | |
| 5 | zhipu | `glm-5.2` | force | | | | |
| 6 | minimax | `MiniMax-M3` | force | | | | |
| 7 | moonshot | `kimi-k2.6` | **coerce** (weakest emission; the handoff column matters most here) | | | | |
| 8 | openrouter | `deepseek/deepseek-v4-pro` | force (DB `native_tools=true`, see above) | | | | |

**Pass bar per row:** (a) the `runs` row for the send has `model` and `provider` equal to the row's;
(b) the assistant turn's persisted `tool_calls` contain `web_search` AND `workspace_write` (a
`workspace_*` write), neither with an error result; (c) a `workspace_files` row `rate.md` exists for the
thread; (d) the handoff returns 201 with ≥ 1 summary item, or 502 → FAIL for that column only.
A provider with no key or a known blocker is ⛔ with the verbatim error and an issue id — never dropped.
One retry per failed row at most, and the retry is recorded as such.

## The other three axes

| Axis | Row | What is driven | Pass bar |
|---|---|---|---|
| **Multi-tool** | MT-1 | The SC#10 prompt itself (web_search + workspace_write in one prompt), on every board row | ≥ 1 board row PASSes (b); the row is scored per provider on the board |
| **Parallel-thread** | PT-1 | Expert thread A (Financial Analyzer) streams the SC#10 prompt while thread B (Financial Analyzer) accepts a new prompt: B's `POST …/messages` is sent while A's `runs` row is still `running` | both sends 200/202; both `runs` rows reach a terminal status with their own `thread_id`; A's `running` window overlaps B's send time (timestamps quoted) |
| **Long-message** | LM-1 | A ≥ 5 KB user prompt on an Expert thread (Financial Analyzer active) | 200/202, run terminal `completed`, an assistant answer persisted; prompt byte length quoted. May be recorded **OWED-manual** with the reason, never silently dropped |

## Phase success criteria (live rows)

| Row | Requirement | Pass bar |
|---|---|---|
| SC#1 (per board row) | PACK-21 | the board above |
| SC#2 | PACK-22 | `GET /experts` as an org admin shows `connection_state` `connected=false` for an Expert whose required `google` connection is absent/revoked, with `can_connect` quoted; a member account's view quoted or "no member account" stated |
| SC#3-swap | PACK-23 | PATCH `active_expert_id` Financial Analyzer → HR Advisor on a Client ACME thread with ≥ 1 exchanged message writes exactly ONE `expert_changed` row; its `org_id` = the thread's `org_id` = the X-Org-Id sent |
| SC#3-reload | PACK-23 | the event row is present in two consecutive `GET /snapshot` reads |
| SC#3-remove | PACK-23 | PATCH clear → a second `expert_changed` row with `after = null` ("left") |
| SC#4 | PACK-24 | `POST /threads/{id}/handoff {Contract Reviewer}` → 201; new thread row (org, inherited `folder_id`, `active_expert_id`, title) quoted; its first message is `role='user'` with `tool_calls->0->>'kind' = 'handoff'` and ≥ 1 summary item; the source thread keeps its Expert and carries one `expert_handoff` row |
| SC#5-count | PACK-25 | preview `excluded_count` == a direct DB count with the identical predicate (latest, not source-disconnected, folder in the thread subtree minus HR Advisor's folders); two equal numbers quoted, else FAIL |
| SC#5-retrieval | PACK-25 | the next run's `search.query` audit `document_ids` → `documents.folder_id` contain NO folder of the excluded set; zero retrieved rows is recorded as its own outcome with the answer text, never as a silent PASS |

## G-4 (Chrome, Task 4 — driven by the orchestrator)

G4-1 / G4-2 / G4-3 (D-267-28, verbatim in 267-CONTEXT.md), UI-catalog, UI-doubleclick. Fixtures for them
are prepared by Task 3 and handed over in the checkpoint.

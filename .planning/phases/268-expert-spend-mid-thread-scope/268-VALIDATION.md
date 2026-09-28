# 268 VALIDATION — the 4-axis UAT scoreboard + SC rows + G-4 rows (authored AT PLANNING, before any drive)

Authored by the planner on 2026-09-28, before any 268 code exists. CLAUDE.md "UAT scoreboard recipe
(MANDATORY)": 268 touches the agent loop (org stamps, D-268-22), the send path (D-268-19), per-turn
retrieval scope (CHAT-08) and UI state (chip, picker, card, cockpit), so all four axes are owed
(D-268-17). Verdicts go into `268-UAT-LOG.md` (plan 268-04). This file fixes the rows and the pass bars so
the drive cannot choose them afterwards. Plan 268-04 Task 3 re-derives the roster before driving and
records any drift **beside** the table below, never over it.

## Roster derivation (re-derived at planning, never re-typed)

Command (backend venv, repo HEAD `5240711b1`):

```python
from collections import defaultdict
from app.config import MODEL_CAPABILITIES
g = defaultdict(list)
for mid, cap in MODEL_CAPABILITIES.items():
    g[cap.get('provider')].append((mid, cap.get('emit_tier'), cap.get('native_tools'), cap.get('api_surface')))
```

Output (provider set + the candidates each row picks from):

```
['anthropic', 'deepseek', 'google', 'minimax', 'moonshot', 'openai', 'openrouter', 'zhipu']
anthropic  ['claude-sonnet-5', 'claude-opus-4-8', 'claude-opus-4-7', … 'claude-haiku-4-5-20251001']
deepseek   deepseek-v4-flash, deepseek-v4-pro ('force', True)
google     … gemini-3.1-pro-preview, gemini-3.5-flash ('force', True), gemini-3.1-flash-lite
minimax    … MiniMax-M2.7-highspeed, MiniMax-M3 ('force', True)
moonshot   kimi-k2.6 ('coerce', True), kimi-k2.5, moonshot-v1-8k
openai     gpt-5.6-sol / -terra / -luna ('force_strict', True, 'responses'), o1
openrouter moonshotai/kimi-k2.6 ('coerce', False) … deepseek/deepseek-v4-pro ('force', False)
zhipu      glm-5, glm-5-turbo, glm-5.1, glm-5.2 ('force', True)
```

Eight provider groups: the CLAUDE.md native roster + OpenRouter. No group is missing.

⚠ **Carried from 267-VALIDATION (re-check at drive time, do not assume):** the local Model Registry DB
(`model_capabilities_overrides`) set `native_tools = true` for `deepseek/deepseek-v4-pro` on OpenRouter,
so on this box the OpenRouter row may exercise OpenRouter's native tool calling rather than the
non-native path. 268-04 re-queries the override rows for the eight chosen ids and records what it finds.

## SC#10 — cross-provider board: per-turn retrieval scope (CHAT-08, D-268-17)

Method (Phase 185): per-request `model` + `provider` on `POST /threads/{id}/messages`; no global setting
touched; `X-Org-Id` sent on every request; every written row's `org_id` quoted. **No Expert** on board
threads (the board isolates the scope change; the Expert interplay is SC#4 / G4-3).

Row recipe (identical on every row, research Q12):

1. `POST /threads {"folder_id": "<Client ACME>"}`.
2. Turn 1 with the row's `model` + `provider`: *"Search my documents for the payment terms in the Client
   ACME contracts and save a one-line note with the figure and the document name to a file named
   terms.md."* (MT-1: `search_documents` + a workspace write in one prompt.)
3. `PATCH /threads/{id} {"folder_id": "<Client ACME/Q3 Contracts>"}` → a `scope_changed` row.
4. Turn 2, the same prompt, same `model` + `provider`.
5. Proof query per turn (verbatim, `<run>` = that turn's `runs.run_id`):

```sql
SELECT a.metadata->>'run_id' AS run_id, a.metadata->'folder_ids' AS scope, d.id, d.folder_id
FROM audit_log a
CROSS JOIN LATERAL jsonb_array_elements_text(a.metadata->'document_ids') did(id)
JOIN documents d ON d.id = did.id::uuid
WHERE a.action_type = 'search.query' AND a.metadata->>'run_id' = '<run>';
```

| # | Provider | Model id | emit_tier | scope_changed row (org_id = thread org) | turn-1 runs row (model/provider match) | turn-2 runs row (model/provider match, `expert_attributed=true`) | turn-2 audit: every `d.folder_id` ∈ new subtree AND `scope` = new subtree | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | openai | `gpt-5.6-sol` (Responses surface) | force_strict | | | | | |
| 2 | anthropic | `claude-sonnet-5` | force | | | | | |
| 3 | google | `gemini-3.5-flash` | force | | | | | |
| 4 | deepseek | `deepseek-v4-pro` | force | | | | | |
| 5 | zhipu | `glm-5.2` | force | | | | | |
| 6 | minimax | `MiniMax-M3` | force | | | | | |
| 7 | moonshot | `kimi-k2.6` | **coerce** (weakest emission) | | | | | |
| 8 | openrouter | `deepseek/deepseek-v4-pro` | force (DB override: see above) | | | | | |

**Pass bar per row:** (a) exactly one `scope_changed` system row for the PATCH, its `org_id` = the
thread's `org_id`; (b) both `runs` rows carry the row's `model` and `provider`; (c) turn 2's `search.query`
audit row carries `run_id` = turn 2's run and `folder_ids` = the new subtree, and every retrieved document's
`folder_id` is inside the new subtree; (d) turn 1's audit `folder_ids` = the old subtree (the change did
not apply backwards). **A turn 2 that does not call `search_documents` is NOT a pass** — one retry with the
same prompt, recorded as a retry; then ⛔ with the verbatim reason. **Zero retrieved rows is recorded as
its own outcome with the answer text, never as a silent PASS (T-267-55 precedent).** A provider with no key
or a known blocker is ⛔ with the verbatim error and an issue id — never dropped.

## The other three axes

| Axis | Row | What is driven | Pass bar |
|---|---|---|---|
| **Multi-tool** | MT-1 | The board prompt itself (`search_documents` + a workspace write in one prompt), on every board row | ≥ 1 board row PASSes (b)+(c) with both tool calls in its persisted `tool_calls`; scored per provider on the board |
| **Parallel-thread** | PT-1 | Thread A streams turn 2 of a board row while the operator's second thread B receives a scope PATCH **and** a new prompt | both sends 200/202; A's audit `folder_ids` = A's scope at A's run start; B's next run's audit `folder_ids` = B's new scope; A's `streaming` window overlaps B's PATCH time (timestamps quoted). This is the D-268-12a isolation proof |
| **Long-message** | LM-1 | A ≥ 5 KB user prompt on a thread whose scope was changed once | 200/202, run terminal `completed`, the next-turn audit `folder_ids` = the new subtree; prompt byte length quoted. May be recorded **OWED-manual** with the reason, never silently dropped |

## Phase success criteria (live rows)

| Row | Requirement | Pass bar |
|---|---|---|
| SC#1-attribution | METER-08 | Runs with Expert E1 (Financial Analyzer, Biased), Expert E2 (HR Advisor, Restricted) and no Expert, driven live in one org: each `runs` row reads `expert_attributed = true` and the `expert_id` of the Expert active **when the run started** (SQL quoted) |
| SC#1-reconcile | METER-08 | `GET /admin/spend/summary` `expert_breakdown`: each Expert line's `input_tokens`/`output_tokens`/`spend_usd` equals an independent SQL sum over that Expert's root runs + their sub-agents, priced with the same `model_rates` rows (both numbers quoted, compared in integer ten-thousandths) |
| SC#1-subagent | METER-08 | ≥ 1 driven run spawns a sub-agent (`task` tool); the sub-agent `runs` row reads its parent's `expert_id` and `org_id` (SQL quoted); its tokens appear inside its root's line and the ledger row reads `incl. 1 sub-agent` |
| SC#1-continued | METER-08 | a `cap_paused` → Continue run: the row's tokens after Continue = paused segment + continuation (both segments' figures quoted from the drive or the SSE usage), not the continuation alone (D-268-20). May be recorded OWED-manual if a cap cannot be reached live, with the reason; the RED-first unit test and the real-PG test are then the evidence named |
| SC#1-filter | METER-08 | selecting each Expert pill moves KPI 1, the 14-day chart, the donut and the ledger together (four values quoted per selection) and the statement line names the Expert (D-268-08) |
| SC#1-recon-footer | METER-08 | the Spend by Expert footer reads `✓ … = org total · {R} runs, 0 unattributed` and its figures equal `window_total_usd` / `window_run_count` from the summary JSON |
| SC#2 | METER-08 | the `No Expert` line is present in `expert_breakdown` and in the table (also at `$0.0000` when filtered to an empty window); pre-268 rows appear as `Not recorded (before 268)`, never merged into `No Expert` (D-268-06) |
| SC#3-event | CHAT-08 | a folder PATCH on a thread with ≥ 1 message writes exactly ONE `scope_changed` row (`role='system'`, `tool_calls->0->>'kind'='scope_changed'`, `org_id` = the thread's) in the same transaction as the UPDATE; on an empty thread the PATCH writes NO row (D-268-12b) |
| SC#3-reload | CHAT-08 | the event row is present in two consecutive `GET /threads/{id}/snapshot` reads (the reload) and never in the model's history (the next run's provider request carries no `scope_changed` text — LangSmith or backend log quoted) |
| SC#3-retrieval | CHAT-08 | the next run's `search.query` audit (`run_id` joined) `document_ids` → `documents.folder_id` ⊆ the new subtree; the previous run's audit `folder_ids` = the old subtree |
| SC#4-biased | CHAT-08 | with Financial Analyzer (Biased) active, change scope: the picker ledger and the card both state `Now` = new subtree + the Expert's folders; the next run's audit documents ⊆ `ScopeEffect.next` folders (Pitfall 10) |
| SC#4-restricted | CHAT-08 | = G4-3 below, plus the audit join: the next run's documents are all in HR Policies |
| SC#4-authz | CHAT-08 | PATCH with a folder id the caller cannot see (another org's folder) → refused (404/403, literal detail), thread `folder_id` unchanged, no event row (D-268-25 / Pitfall 12) |

## G-4 — lived-experience scenarios (D-268-16, fixed at scope time; Chrome, both themes)

Acceptance bar: `.planning/sketches/268-expert-spend-and-mid-thread-scope/index.html` — Chat A · Save &
say · Spend A (D-268-01).

| Row | Scenario (verbatim from D-268-16) | What the screen must say at rest |
|---|---|---|
| G4-1 | Swap Expert mid-thread. The thread's cost splits correctly across two Expert lines on `/admin/spend`, and each line equals the sum of its runs' persisted tokens. | Two Expert lines in Spend by Expert, each clickable; the ledger shows two rows from one thread with different Expert pills; the recon footer reads ✓; selecting each line moves KPIs, chart, donut and ledger together |
| G4-2 | Change scope mid-thread. The next answer cites only the new folder, the audit join proves it, and the card survives a reload. | `Scope /Client ACME → /Client ACME/Q3 Contracts` card with `Now` / `Dropped` / `From your next message.`, present after reload; the chip reads `/Client ACME/Q3 Contracts` |
| G4-3 | With HR Advisor (Restricted) active, change scope. The chip reads "not searched", the card reads "Takes effect when HR Advisor leaves", and the answer still comes from HR Policies. | the dashed chip `/Client ACME/Q3 Contracts · NOT SEARCHED` beside a legible `HR Advisor · Restricted` chip; the card `Saved` / `Searching: HR Policies only · HR Advisor is Restricted` / `Takes effect when HR Advisor leaves.`; checked on BOTH themes |

Report any state that shows a disabled control with no reason, a blank, `undefined`, a raw error string, or
words visible only on hover — each is a FAIL for its row.

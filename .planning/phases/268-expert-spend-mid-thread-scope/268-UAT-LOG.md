# 268 UAT Log — live proof of METER-08 and CHAT-08 (plan 268-04, Task 3)

Driven by Claude against the LOCAL stack only: backend `http://localhost:8000`, Postgres `127.0.0.1:54322`, local
GoTrue `127.0.0.1:54321`, Vite `http://localhost:5173`. No production access; the Supabase MCP was not used. Rows and
pass bars were fixed in `268-VALIDATION.md` at planning; the roster re-derivation was committed (`395d330d1`) **before** the first drive
request. Raw outputs are under `evidence/`
(`00`–`07`). Helper scripts and the session token lived only in the session scratchpad. Headers are quoted without
`Authorization`.

## Preflight (Task 2 — the operator answered the checkpoint)

- Operator reply, verbatim: **"stack up, org = fhdmrd@gmail.com"**.
- Orchestrator probes, then re-measured here: `GET /health` → `200`; unauthenticated
  `GET /threads/00000000-0000-0000-0000-000000000000/scope-effect` → `403 {"detail":"Not authenticated"}` (the 268
  route is served; a 404 would have meant pre-268 code); Vite `/` → `200`.
- `Get-NetTCPConnection -LocalPort 8000 -State Listen` → **one** listener, `0.0.0.0`, PID `23176`.
- Migration 197 on the local DB: both columns present (268-01 Task 3 verify, re-read here by every SC#1 query below).
- ⚠ Provider keys could NOT be listed by name: reading `backend/.env` is denied to this agent. Availability is instead
  proven per row by a `completed` run on that provider (all 8 did).
- **Drive org, proven, not assumed:** `fhdmrd@gmail.com` = user `d8a54002-6a29-4b88-b918-cff2aa4a06d5`, measured in
  **ONE** org today — `22f9c615-0eec-440a-8804-ed4784d6f57f` ("fhdmrd@gmail.com's Organization", role `org-admin`).
  ⚠ Memory said "two orgs"; that is stale — `SELECT … FROM org_members WHERE user_id=…` returns one row. Every request
  below sent `X-Org-Id: 22f9c615-0eec-440a-8804-ed4784d6f57f`, and every written row quoted below carries that org.
- Tier: `organizations.subscription_tier = 'enterprise'`; `tier_capabilities (enterprise, experts, enabled=true)`.
- Operator: `operator_users` row for the user (`note env-bootstrap`); `GET /admin/me` → `200`; `GET /admin/spend/summary`
  → `200` with `org_id 22f9c615-…`.
- **Session:** a local GoTrue session for the dev account, minted with the LOCAL service key from `supabase status`
  via `POST /auth/v1/admin/generate_link` (magiclink) + `POST /auth/v1/verify`. No password was changed or read. The
  token stayed in the scratchpad.

## Fixtures — every local write (T-268-34)

All through the API as the dev account, `X-Org-Id` = the dev org (`evidence/00-setup.json`):

| Write | Result |
|---|---|
| `POST /folders {"name":"Client ACME","is_org_shared":true}` | `201` `1a2d0273-b14d-487f-86ee-4d146e89d082`, org `22f9c615-…` |
| `POST /folders {"name":"Q3 Contracts","parent_id":<Client ACME>,"is_org_shared":true}` | `201` `b33bd4cb-ba40-4e9e-b804-857dd4b6ad75` (parent Client ACME) |
| `POST /folders {"name":"HR Policies","is_org_shared":true}` | `201` `4ff33372-772d-45b4-9c0d-9d676d314c4d` |
| `POST /documents/upload` ×3 | `ACME_MSA_2026.md` `1417fc12-…` → Client ACME (**NET 60**); `ACME_Q3_SOW_Contract.md` `95b41fa9-…` → Q3 Contracts (**NET 15**); `HR_Leave_Policy.md` `5ee944a5-…` → HR Policies. All `completed`, `is_latest`, 1 chunk each, org `22f9c615-…` |
| `POST /experts` HR Advisor | `201` `587c3f87-a001-4db2-a37f-27bafa25ae87`, `restricted`, folders `[HR Policies]`, `visibility org` |
| `POST /experts/…0259/install` (Financial Analyzer) | `202` → `expert_installs.status = installed`, folder `07abbbbf-…` |

The two figures differ ON PURPOSE (MSA NET 60 in the parent, SOW NET 15 in the child) so an answer's source folder is
readable from its words. ⚠ **Financial Analyzer's bundle is `scope_mode = restricted`** (system row `…0259`, the
same finding 267 recorded) — not the "Biased" the VALIDATION text calls it. SC#4-biased therefore uses the org's
existing Biased Expert **UAT-265 Billing SOP Advisor** `253ba288-7483-4af7-9979-e88f8c54cc98` (folder SOPs
`1fce5dee-…`, 1 doc). Substitution named, not hidden.

## Integration fence (Task 1) — `backend/tests/integration/test_268_spend_rollup_pg.py`

`pytest tests/integration/test_268_spend_rollup_pg.py tests/integration/test_268_two_org_rows.py -rs` → **`14 passed`**,
0 skipped. Plant (placeholder-shell token `FILTER` removed from `per_root`): **`3 failed, 6 passed`** —
`AssertionError: shell line double-counted: 160 (want 100)`. Restored; `git diff --quiet HEAD -- backend/app/db/rates.py`
exit 0. Commit `6fd38f39a`.

268-02's request (an ask_user-resumed harness root) was answered on the LIVE DB instead of a synthetic row: of the
**196** real-model roots on harness threads that have sub-agents, **196 have `input_tokens IS NULL`** — no real-model
root carries a box that already sums its sub-agents, so the placeholder rule covers every double-count case present.

---

## SC#10 — cross-provider board (CHAT-08) — fixed recipe: **1 PASS · 7 ⛔** · variant turn: **8 / 8**

Method exactly as `268-VALIDATION.md`: `POST /threads {"folder_id": Client ACME}` → turn 1 → `PATCH {"folder_id":
Q3 Contracts}` → turn 2 (same prompt), per-request `model` + `provider`, `X-Org-Id` on every call, No Expert.
Evidence `evidence/01-board-<provider>.json`. Rows ran two at a time.

Common to all 8 rows (quoted per row in the evidence): the PATCH → `200`; **exactly one** `scope_changed` row
(`role system`, `tool_calls->0->>'kind' = scope_changed`) whose `org_id` = `threads.org_id` = `22f9c615-…`; every runs
row `completed`, `org_id 22f9c615-…`, `expert_attributed true`, `expert_id NULL`, model/provider = the row's.

| # | Provider | Model | thread | event row | turn-1 run · audit `folder_ids` | turn-2 run (first attempt → retry) · tools | Status |
|---|---|---|---|---|---|---|---|
| 1 | openai | `gpt-5.6-sol` | `aa56a842-…` | `e1637140-…` | `5bde21e2-…` · **no `search_documents`** (grep + read_document) | `ef5dcc62-…` → `52b0e276-…` · grep + read_document on `/Client ACME/Q3 Contracts`, no search | ⛔ SEED-319 |
| 2 | anthropic | `claude-sonnet-5` | `8ada158a-…` | `d3b9388a-…` | `7d74fe28-…` · `[Client ACME, Q3]` ✓ | `2a1c50a0-…` → `e29cb3e9-…` · no tool call | ⛔ SEED-319 |
| 3 | google | `gemini-3.5-flash` | `acbe21b7-…` | `f74a5c77-…` | `a55e5d91-…` · `[Client ACME, Q3]` ✓ | `f62fbc51-…` → `37fc4680-…` · query_documents / workspace_*, no search | ⛔ SEED-319 |
| 4 | deepseek | `deepseek-v4-pro` | `1e845e4e-…` | `ee5c378c-…` | `7f40bc85-…` · `[Client ACME, Q3]` ✓ | `6bfcf1a0-…` → `9a0e6c5f-…` · workspace_write only | ⛔ SEED-319 |
| 5 | zhipu | `glm-5.2` | `be9afa39-…` | `c26b70d0-…` | `f9c4d9c7-…` · `[Client ACME, Q3]` ✓ | `49bf4984-…` → `c8b29742-…` · workspace_read only | ⛔ SEED-319 |
| 6 | minimax | `MiniMax-M3` | `672402db-…` | `083cb392-…` | `09c554f3-…` · `[Client ACME, Q3]` ✓ | `1e6fc54e-…` → `733b6f9d-…` · no tool call | ⛔ SEED-319 |
| 7 | moonshot | `kimi-k2.6` (coerce) | `fbe5fea8-…` | `edee3eda-…` | `8c677a82-…` · `[Client ACME, Q3]` ✓ | `bdac861f-…` (no retry needed) · **search_documents + workspace_write**; audit `folder_ids = [Q3]`, doc `95b41fa9-…` folder `b33bd4cb-…` (Q3) | **PASS** |
| 8 | openrouter | `deepseek/deepseek-v4-pro` (native tools, DB override) | `d045728c-…` | `faa7aea1-…` | `693656ec-…` · `[Client ACME, Q3]` ✓ | `199640da-…` → `10ed8c6a-…` · no tool call | ⛔ SEED-319 |

`[Client ACME, Q3]` = `["1a2d0273-…","b33bd4cb-…"]`, the old subtree — pass bar (d), the change did not apply
backwards, holds on every row that searched in turn 1 (7 of 8; openai's turn 1 used grep/read_document, so (d) is
unmeasured for openai).

**Why 7 rows are ⛔, verbatim reason:** *"turn 2 did not call `search_documents` on the first attempt or on the one
retry with the same prompt — the model answered from the conversation history."* That is the pass bar written at
planning, applied unchanged. Issue id: **SEED-319** (planted by this plan).

### ⚠ F-1 — the finding behind the ⛔ rows (lived-experience failure of G4-2's promise)

After the scope change, **6 of 8 providers' turn-2 answers cite `ACME_MSA_2026.md` / NET 60 — a document in the
DROPPED folder** — on both attempts (`evidence/02-board-turn2-answers.json`): anthropic, google, deepseek, zhipu,
minimax, openrouter. openai (grep on the new path) and moonshot (a new search) cited only the Q3 SOW. Deepseek's turn 2,
verbatim: *"Source: **ACME_MSA_2026.md** and **ACME_Q3_SOW_Contract.md** (both under `/Client ACME/Q3 Contracts`)"* —
a **false** location claim. Mechanism, measured: the `scope_changed` row is skipped for the model by design
(D-267-10 / D-268-12, proven below in SC#3-reload), while `agent_loop.py`'s folder-scope note in the system prompt
names the CURRENT folder (`agent_loop.py:1463-1471`). So the model sees earlier results from the old folder in its
history plus a system prompt saying the scope is the new folder, and it re-labels the old results. **Retrieval is
correct whenever a search runs** (every row's variant turn below, and moonshot's turn 2); what fails is the ANSWER on a
follow-up that does not search. Not fixed here: the fix (tell the model the scope changed, or drop stale tool results
from history) is a design decision against D-268-12's "never sent to a model" — routed to the operator at the Task 4
checkpoint and planted as SEED-319.

### Variant turn (NOT the pass bar — recorded separately so the fixed rows stay honest)

One extra turn per row, same model/provider: *"Run a NEW search_documents call now (do not reuse earlier results - my
folder scope just changed) for the payment terms in the Client ACME contracts, and tell me which document each figure
came from."* **8 / 8** called `search_documents`; every audit row reads `folder_ids = ["b33bd4cb-…"]` (Q3 only) and
every retrieved document is `95b41fa9-…` with `folder_id b33bd4cb-…` (runs `c6a9abf7`, `9634761f`, `531c8244`,
`2b405f42`, `a1bed585`, `b0399874`, `77299a55`, `cc8017f1`). This is CHAT-08's retrieval property proven on every
provider; it does not convert any ⛔ above.

SQL behind each column (verbatim, the VALIDATION join):
```sql
SELECT a.metadata->>'run_id' AS run_id, a.metadata->'folder_ids' AS scope, d.id, d.folder_id
FROM audit_log a
CROSS JOIN LATERAL jsonb_array_elements_text(a.metadata->'document_ids') did(id)
JOIN documents d ON d.id = did.id::uuid
WHERE a.action_type = 'search.query' AND a.metadata->>'run_id' = '<run>';
```
Every `search.query` audit row quoted carries `org_id 22f9c615-…`.

### SC#10 RE-DRIVE after D-268-26 (2026-09-29) — **6 PASS · 2 ⛔** (run 1 above is kept, not overwritten)

**The fix.** Operator ruling D-268-26 ("tell the model"): `agent_loop._reconstruct_history` prepends ONE provider-
neutral note to the NEXT user message after a `scope_changed` row (`backend/app/services/scope_note.py`, commit
`1ec11a842`; RED `29e64548d`). The live backend served it: uvicorn `--reload` respawned its worker at 00:27:42, after
the last edit (00:27:28). **Proof the note reaches the provider history** (`evidence/09-g4-2-api-followup.json`): the
real `_reconstruct_history` over the new thread's DB rows yields, as the second user message,
*"[Search scope changed from /Client ACME to /Client ACME/Q3 Contracts. Earlier search results in this conversation may
come from outside the new scope; run a new search before citing documents.]

Search my documents for the ACME payment
terms and name the document."* — 0 system-role entries in the history.

Method identical to run 1: new threads (`268 SC#10 re-drive <provider>`), Client ACME → turn 1 → PATCH Q3 Contracts →
turn 2, same prompt, same `model` + `provider`, `X-Org-Id` dev org, one retry at most. Evidence
`evidence/08-board-redrive-<provider>.json`. Every row: PATCH `200`, **exactly one** `scope_changed` row with
`org_id` = thread org = `22f9c615-…`; every runs row `completed`, org `22f9c615-…`, `expert_attributed true`, model /
provider = the row's.

| # | Provider | thread | event | turn-1 run · audit | turn-2 run (→ retry) · tools | turn-2 audit `folder_ids` · docs | answer cites a DROPPED-folder doc as a source? | Run 1 | **Run 2** |
|---|---|---|---|---|---|---|---|---|---|
| 1 | openai `gpt-5.6-sol` | `c45c4e69-…` | `e08eaea3-…` | `159be407-…` · grep/read_document (no search) | `10d76c84-…` → `cb9b688e-…` · grep + read_document on `/Client ACME/Q3 Contracts` | none (no `search_documents`) — grep matched only `95b41fa9` (Q3) | **no** (SOW only) | ⛔ | ⛔ reason below |
| 2 | anthropic `claude-sonnet-5` | `9f111ac6-…` | `51040e50-…` | `f379f944-…` · `[Client ACME, Q3]` | `6a0cb31d-…` · **search_documents** + workspace_write | `[Q3]` · `95b41fa9` (Q3) | **no** — names the MSA only to say it "lives outside the current scope, so I removed it" | ⛔ | **PASS** |
| 3 | google `gemini-3.5-flash` | `f86e6038-…` | `8a41a9c5-…` | `811e3d4d-…` · `[Client ACME, Q3]` | `f7888024-…` → `386cbc48-…` · ls/grep/read_document, then tree/workspace_read, on the new path | none (no `search_documents`) | **no** (SOW only) | ⛔ | ⛔ reason below |
| 4 | deepseek `deepseek-v4-pro` | `58eb7c0b-…` | `875290be-…` | `1855d931-…` · `[Client ACME, Q3]` | `5c0c3f2c-…` · **search_documents** + workspace_write | `[Q3]` · `95b41fa9` | **no** | ⛔ | **PASS** |
| 5 | zhipu `glm-5.2` | `be03bea9-…` | `82146d76-…` | `f52ff9ba-…` · `[Client ACME, Q3]` | `39387904-…` · ls + **search_documents** + workspace_write | `[Q3]` · `95b41fa9` | **no** — flags the MSA as outside the folder | ⛔ | **PASS** |
| 6 | minimax `MiniMax-M3` | `965723e9-…` | `35f6cec4-…` | `09b31b17-…` · `[Client ACME, Q3]` | `d44013a3-…` · **search_documents** + workspace_write | `[Q3]` · `95b41fa9` | **no** — "outside the Q3 Contracts folder scope, so it isn't cited" | ⛔ | **PASS** |
| 7 | moonshot `kimi-k2.6` | `c7426757-…` | `bc29b0b6-…` | `8ba92092-…` · `[Client ACME, Q3]` | `3692a329-…` · **search_documents** + workspace_write | `[Q3]` · `95b41fa9` | **no** | PASS | **PASS** |
| 8 | openrouter `deepseek/deepseek-v4-pro` | `6f6326b3-…` | `138e07ce-…` | `5e193607-…` · `[Client ACME, Q3]` | `2c241762-…` · ls + **search_documents** + workspace_write | `[Q3]` · `95b41fa9` | **no** | ⛔ | **PASS** |

Pass bar (d) (turn 1 read the OLD subtree) holds on 7 / 8 (openai's turn 1 used grep/read_document, unmeasured).
**No retry was needed on any PASS row.**

**The 2 ⛔, verbatim reason:** *"turn 2 re-retrieved with `grep` / `read_document` / `tree` scoped to
`/Client ACME/Q3 Contracts` on both attempts and never called `search_documents`, so no `search.query` audit row
exists to satisfy pass bar (c)."* Issue id: **SEED-319** (residual). Recorded, not smoothed: in both rows every tool
call was on the new path, no tool result contained the MSA (`1417fc12` absent from every result), and the answer cited
only `ACME_Q3_SOW_Contract.md` — the **defect SEED-319 names (citing the dropped folder) did not reproduce on any of the
8 providers**. What remains is a pass-bar gap: the explorer tools (`grep`, `read_document`) leave no `search.query`
audit row, so the fixed bar cannot score them. One sample per provider; one green sample proves nothing about a flaky
provider.

**MT-1 (run 2):** 6 PASS rows each persisted `search_documents` + `workspace_write` in turn 2 → PASS.

### G4-2 API-level follow-up (2026-09-29, after the fix) — **PASS**

A NEW thread `268 G4-2 API follow-up (re-drive)` mirroring G4-2 (the Chrome fixture thread `dc4e87e4-…` was left
untouched for the operator's drive), `deepseek-v4-flash` / `deepseek`, X-Org-Id dev org
(`evidence/09-g4-2-api-followup.json`):
- Turn 1 → `search_documents`, audit `folder_ids = [Client ACME, Q3]`, docs from both folders; the answer cites the MSA
  (NET 60) and the SOW — correct for that scope.
- `PATCH {"folder_id": Q3}` → `200`; one event row `142f4105-…`, org `22f9c615-…`.
- Turn 2, **same prompt** → `search_documents` (+ `query_documents`), audit `folder_ids = [Q3]`, the one retrieved doc
  in Q3. Answer, verbatim excerpt: *"Re-searched within the new scope (**/Client ACME/Q3 Contracts**). Only one document
  matches here: **ACME_Q3_SOW_Contract.md** … I should also flag: the MSA (NET 60 terms) I mentioned in my previous
  answer sits **outside** this folder scope … so it doesn't count here."* The same model in run 1's SC#4-biased / LM-1
  attempts answered from history.

### MT-1 — multi-tool — **PASS**
Row 7 (moonshot) turn 2 `bdac861f-…` persisted `search_documents` AND `workspace_write` in one run and passes (b)+(c).
Turn 1 of rows 2-8 also called both (`search_documents` + `workspace_write`).

### PT-1 — parallel-thread — **PASS** (`evidence/06-pt1-lm1.json`)
Thread A `268 PT-1 thread A` (Client ACME), thread B `268 PT-1 thread B` (Client ACME, one prior exchange), both
`deepseek-v4-flash`:
- A's send `201`; A's run `b21b99da-72e7-4f03-a1c5-760482fbe9a9` started **19:52:10.987**, completed **19:52:22.722**;
  status read `streaming` at the moment B's PATCH was sent.
- B's `PATCH {"folder_id": Q3}` sent **19:52:11.124** → `200`; event row `3a19f842-…` committed **19:52:14.367**, org
  `22f9c615-…`. B's send → `201`, run `c12e1182-a445-4b77-b8f1-6d6f50b4f6d4` (19:52:17.656 → 19:52:28.570).
- A's `search.query` at **19:52:14.682** — AFTER B's event committed — reads `folder_ids = [Client ACME, Q3]` (A's own
  scope at its start); B's at 19:52:21.472 reads `[Q3]`. The D-268-12a isolation proof.

### LM-1 — long message — **PASS on the one retry**
- Attempt 1 (thread B above, after its scope change): **7,759**-byte prompt → `201`, run `completed`, but **no
  `search_documents`** — the same history reuse as F-1. Recorded.
- Retry (fresh thread `39ac2793-b38a-448a-a56b-eb5d182f4bbd`: one exchange, PATCH → Q3 → event `d86e3091-…` org
  `22f9c615-…`, then the long prompt): `SELECT octet_length(content) … role='user'` → **7,751**; send `201`; run
  `b8503405-47d0-48c1-84af-8b291c713104` `completed`, `deepseek-v4-flash`/`deepseek`, org `22f9c615-…`; audit
  `folder_ids = ["b33bd4cb-…"]`; retrieved doc `95b41fa9-…` in Q3.

---

## SC#1 — METER-08 (`evidence/03-*.json`, `04-sc1-reconcile-filter-sc2.json`)

### SC#1-attribution — **PASS**
Thread `268 SC#1 / G4-1 Expert swap` (`POST /threads {"folder_id": Client ACME, "active_expert_id": "…0259"}` → `201`),
then `PATCH {"active_expert_id": "587c3f87-…"}` → `200`; plus thread `268 SC#1 no Expert`. All `deepseek-v4-flash`:

| run | when | `expert_id` | `expert_attributed` | `org_id` |
|---|---|---|---|---|
| `15052e5f-634b-448b-8406-d5ccdfb15472` (root, 21,701 / 466) | Financial Analyzer active | `00000000-0000-0000-0000-000000000259` | true | `22f9c615-…` |
| `e5f751da-9677-4c8b-8b30-153b556c5f2f` (sub-agent, `parent_run_id 15052e5f-…`, 8,437 / 852) | spawned by `task` | `…0259` (copied from parent) | true | `22f9c615-…` |
| `109eac5e-7886-4c2f-9d52-1c7bd320a4e7` (same thread, 23,376 / 194) | after the swap | `587c3f87-a001-4db2-a37f-27bafa25ae87` | true | `22f9c615-…` |
| `d0785e80-c697-4d6b-bacd-29945999c991` (no-Expert thread, 21,937 / 132) | — | `NULL` | true | `22f9c615-…` |

Each row carries the Expert active **when it started**.

### SC#1-reconcile — **PASS** (API = independent sum, in integer ten-thousandths)
`GET /admin/spend/summary` (X-Org-Id dev org) against an independent sum computed in Python: every root in the org
plus its direct sub-agents, each priced by `compute_token_cost_usd` at a rate picked in Python from `model_rates`
(org > global, provider match, latest `effective_from ≤ started_at`), the shell token rule applied — **not** the
`rates.py` SQL.

| line | API USD (×1e-4) | independent | API in / out tokens | independent | runs API / indep. |
|---|---|---|---|---|---|
| UAT-265 Billing SOP Advisor (Biased) | 280 | 280 | 77,014 / 4,145 | 77,014 / 4,145 | 3 / 3 |
| **Financial Analyzer** | **229** | **229** | 65,190 / 2,782 | 65,190 / 2,782 | 3 / 3 |
| **HR Advisor** | **218** | **218** | 67,990 / 1,176 | 67,990 / 1,176 | 3 / 3 |
| No Expert | 17,696 | 17,696 | 1,058,592 / 18,465 | same | 38 / 38 |
| Not recorded (before 268) | 390,255 | 390,255 | 52,955,306 / 2,171,338 | same | 1,191 / 1,191 |

Σ lines **408,678** = `window_total_usd` `40.8678` = independent total **408,678**; Σ runs **1,238** =
`window_run_count` **1,238** = independent **1,238**.

### SC#1-subagent — **PASS**
Sub-agent `e5f751da-…` reads its parent's `expert_id …0259` and `org_id 22f9c615-…`; its tokens are inside the
Financial Analyzer line (reconciled above); `GET /admin/spend/runs?expert=…0259` row `15052e5f-…` →
`subagent_count 1`, `expert_name "Financial Analyzer"`, `cost_usd "0.0107"` (the UI's `incl. 1 sub-agent` tag reads
this field — confirmed in Chrome under G4-1).

### SC#1-continued — **OWED-manual**
Two explorer-mode attempts (`agent_mode explorer`, 8-iteration cap) finished `completed` without reaching
`cap_paused` (17,362 / 861 and 17,690 / 603 tokens; the model batched its tool calls). Per the pass bar, the evidence
named instead: `backend/tests/unit/test_268_continuation_tokens.py` (RED at base `(30, 10) == (130, 50)`, 268-01) and
the real-PG continued root in `test_268_spend_rollup_pg.py` (the line reads the persisted 130 / 50). **Run first when
owed rows are driven:** a Deep run reaching the cap (e.g. a 16-step dependent tool chain in explorer mode).
⚠ **Research Q9 is REFUTED by data, not confirmed** — so no Q9 seed was planted: the sole writer of
`runs.continues_used` is `runs.py:1107` (the user-JWT client), and two Deep (non-harness) runs on this DB read
`continues_used = 3` (`05fea6e9-…`, `e8f1bcc0-…`, 2026-09-12).

### SC#1-filter — **PASS (API half)**; the statement line is G4-1 (Chrome)
Per selection, the four regions via the API, integer ten-thousandths:

| filter | line | KPI 1 | Σ daily | Σ donut | Σ ledger (all pages) | ledger count |
|---|---|---|---|---|---|---|
| `…0259` Financial Analyzer | 229 | 229 | 229 | 229 | 229 | 3 = line 3 |
| `587c3f87-…` HR Advisor | 218 | 218 | 218 | 218 | 218 | 3 = line 3 |
| `none` | 17,696 | 17,696 | 17,696 | 17,696 | 17,696 | 38 = line 38 |
| `unrecorded` | 390,255 | 390,255 | 390,255 | 390,255 | 390,255 | 1,191 = line 1,191 |

### SC#1-recon-footer — **PASS (figures)**; the rendered `✓` sentence is G4-1
The footer's inputs are `window_total_usd 40.8678` / `window_run_count 1,238`, and Σ lines equal them exactly (above),
with 0 unattributed (every root falls in one of the five lines).

### SC#2 — **PASS**
`none` line present (38 runs); `unrecorded` line present (1,191 pre-268 runs) and never merged into `none`.
`GET /admin/spend/summary?start_time=2020-01-01T00:00:00Z&end_time=2020-01-02T00:00:00Z` →
`expert_breakdown: [{"key":"none","run_count":0,"input_tokens":0,"output_tokens":0,"spend_usd":"0.0000"}]`,
`window_total_usd "0.0000"`, `window_run_count 0`.

---

## SC#3 / SC#4 — CHAT-08 (`evidence/05-sc3-sc4.json`)

### SC#3-event — **PASS**
On a thread with messages: exactly one `scope_changed` row per PATCH on all 8 board threads (table above), `org_id` =
the thread's. Sample (deepseek board thread): `ee5c378c-a1e8-4cac-8893-375900fad7d1`, `role system`, kind
`scope_changed`, org `22f9c615-…`, content *"Scope /Client ACME → /Client ACME/Q3 Contracts. Now: /Client ACME/Q3
Contracts (1). Dropped: /Client ACME (2)."* On an **empty** thread (`58ef37d7-…`): PATCH → `200`, `threads.folder_id`
→ Q3, `SELECT count(*) … role='system'` → **0**.

### SC#3-reload — **PASS** (with a named substitution for the provider-request half)
`GET /threads/1e845e4e-…/snapshot` twice → `200`, 9 messages each, `scope_changed` id `ee5c378c-…` in **both**.
Provider-request half: the backend console is the operator's terminal (the `uvicorn.*.log` files date from 2026-09-03)
and the LangSmith key sits in the unreadable `.env`, so neither was quoted. **Substitute, named:** the real
`agent_loop._reconstruct_history` run over the thread's DB rows (the exact columns the agent loop selects) → 9 DB rows
(1 system) → 19 history entries, roles `{assistant, tool, user}`, and **no** `Scope /Client ACME` / `scope_changed`
text. ⚠ The system prompt's folder note DOES name the current folder — that is F-1's mechanism, not the event leaking.

### SC#3-retrieval — **PASS** where a search ran; see F-1 where it did not
Previous run's audit `folder_ids` = old subtree on 7 / 8 board rows; the next SEARCHING run's documents ⊆ new subtree
on 8 / 8 (moonshot turn 2 + every variant turn), plus PT-1 B and LM-1.

### SC#4-biased — **PASS** (UAT-265 Billing SOP Advisor, substituted — see Fixtures)
Thread `268 SC#4 Biased` (Client ACME, Biased Expert). `GET /threads/{id}/scope-effect?folder_id=<Q3>` → `200`,
`held false`, `next` folders `{SOPs 1fce5dee-…, Q3 b33bd4cb-…}`, `stops {Client ACME}`; the event reads *"Scope
/Client ACME → /Client ACME/Q3 Contracts. Now: SOPs, /Client ACME/Q3 Contracts (1). Dropped: /Client ACME (2)."*
(`c3633f80-…`, org `22f9c615-…`). Turn 1 (before): audit `folder_ids` = `{Client ACME, SOPs, Q3}`. Turn 2 (same
prompt) did not search (F-1); the fresh-search turn `249652fb-9ec6-445e-bb0f-15aac594c16d` (Biased Expert
`253ba288-…` on the row) → audit `folder_ids = [SOPs, Q3]`, documents `ac8e1abd-…` (SOPs) and `95b41fa9-…` (Q3) — ⊆
`ScopeEffect.next` (Pitfall 10).

### SC#4-restricted — **PASS (data)**; the chip/card rendering is G4-3
Thread `268 SC#4 Restricted (HR Advisor)`. Preview → `held true`, `next [HR Policies]`, `saved Q3 Contracts`. Event
content, verbatim: *"Scope /Client ACME → /Client ACME/Q3 Contracts. Saved: /Client ACME/Q3 Contracts. Searching: HR
Policies only · HR Advisor is Restricted. Takes effect when HR Advisor leaves."* (payload `held true`). Turn 1 and turn
2: every audit row `folder_ids = [4ff33372-…]` (HR Policies), every document in HR Policies.

### SC#4-authz — **PASS**
`PATCH /threads/<restricted thread> {"folder_id": "68d30bd2-2221-4646-bfaf-32c2153f358a"}` (267's Client ACME, org
`e8c567c2-…` — another org) → **`404 {"detail": "Folder not found"}`**; `threads.folder_id` unchanged (`b33bd4cb-…`
before and after); system rows 1 → 1 (no event).

---

## G-4 — lived-experience scenarios (Chrome, both themes) — AWAITING THE OPERATOR (Task 4 checkpoint)

This session has no Chrome DevTools MCP tools, so per the plan the operator drives and Claude records. Fixtures are
ready in the dev org (`evidence/07-g4-fixtures.json`):

| Row | Thread to open | What is already true in the data |
|---|---|---|
| G4-1 | `268 SC#1 / G4-1 Expert swap` + `/admin/spend` | two Expert lines (Financial Analyzer 229, HR Advisor 218 ×1e-4) reconciling to the window (above) |
| G4-2 | `G4-2 — change scope here (Client ACME)` `dc4e87e4-00f3-4ec8-81a5-9007a4009070` (one exchange) | the PATCH, event and retrieval behave as above; ⚠ a same-prompt follow-up may cite the MSA (F-1) |
| G4-3 | `G4-3 — HR Advisor, change scope here` `6c1eb62f-9eb7-456d-8bde-d9cc6c13d9ea` (HR Advisor active, one exchange) | the held payload and event wording above |

Rows G4-1 / G4-2 / G4-3 are recorded here verbatim from the operator's reply at Task 5.

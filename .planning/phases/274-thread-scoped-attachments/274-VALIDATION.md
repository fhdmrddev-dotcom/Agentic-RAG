# Phase 274 — Validation (plan 274-05)

Rows are filled from PERSISTED data (`workspace_files`, `documents`, `document_chunks`, `storage.objects`, `messages`, `runs`)
and, for the G-4 rows, from a real browser — never from a transcript. Raw evidence: `evidence/board/` (one JSON per row +
`board-summary.json` + `board-run.log`), `evidence/g4-api/` (the API half of G-4 #1/#3/#4), `evidence/axes/`. Method, gate
lines and the D-18 audit: `274-UAT-LOG.md`.

Status (2026-10-05): **partial.** Board, API halves, 4-axis API rows and the D-18 static + API halves are measured by
274-05's executor. **The Chrome halves of G-4 #1-#4 and the D-18 live network-log / flyout click are PENDING-ORCHESTRATOR**
(the executor has no browser), and the operator sign-off (Task 4) is owed. Verdict words are literal: PASS = measured and met;
⛔ = not driven, with the reason; PENDING-ORCHESTRATOR = the browser half, not yet measured; OWED = not measured.

## 1. The planted-fact board (D-03 / D-04 / D-05 / SC#1) — 8 required rows, derived at run time

Roster: derived by `scripts/run-274-board.py --roster`, which imports `derive_roster` from `run-273-board.py` (seed overlaid
by `model_capabilities_overrides`; enabled, not deprecated, not removed; newest id per provider). Quoted verbatim in
`274-UAT-LOG.md` §Roster.

Command: `backend/venv/Scripts/python.exe scripts/run-274-board.py --run` → exit 0 (2026-10-05, ~14:27-14:41 UTC).
Per row: a fresh thread; a `.md` file `meridian-clearance-<provider>.md` stating `The Meridian freight-cap clearance code is
<token>.` (token `ATT274-<provider>-<8 hex>`, generated per row, written nowhere else) uploaded with
`POST /threads/{id}/workspace/files?lifetime=thread`; the question `What is the Meridian freight-cap clearance code in the file
I attached?` with a per-request `model` + `provider` (no global setting mutated); then the SAME question in a SECOND fresh
thread with no attachment.

Verdicts (all from persisted data):
- **D-05 row** — the `workspace_files` row reads `expires_at IS NULL` and `kind = 'template_input'`.
- **Answered** — thread A's persisted assistant message contains the token.
- **2nd-thread negative** — thread B's run completed and its persisted answer does NOT contain the token.
- **document-search negative** — `POST /document-search {"name": <token>}` → HTTP 200, `total == 0`.
- **DB negative** (D-01) — `SELECT count(*) FROM documents WHERE filename ILIKE '%<token>%' OR id IN (SELECT document_id FROM
  document_chunks WHERE content ILIKE '%<token>%')` → 0.

| # | Provider | Model (derived) | Token | D-05 row | Answered | 2nd-thread negative | doc-search negative | DB negative | Tools, thread A | Tools, thread B (negative) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | openai | gpt-5.6-luna | `ATT274-openai-05082d88` | PASS | PASS | PASS | PASS (0) | PASS (0) | execute_code | search_documents |
| 2 | anthropic | claude-opus-5-5 | `ATT274-anthropic-979f0716` | PASS | PASS | PASS | PASS (0) | PASS (0) | workspace_read, execute_code | search_documents, grep ×2 |
| 3 | google | gemini-3.8-flash | `ATT274-google-a73b1a24` | PASS | PASS | PASS | PASS (0) | PASS (0) | workspace_list, workspace_read | glob, grep ×8, read_document, workspace_list, query_documents, search_documents |
| 4 | deepseek | deepseek-v4-pro | `ATT274-deepseek-d590df23` | PASS | PASS | PASS | PASS (0) | PASS (0) | workspace_read, execute_code | search_documents ×2, grep ×6 |
| 5 | zhipu | glm-5.3-flash | `ATT274-zhipu-0095f412` | PASS | PASS | PASS | PASS (0) | PASS (0) | workspace_read, execute_code | search_documents, grep ×3 |
| 6 | minimax | MiniMax-M3 | `ATT274-minimax-9184da44` | PASS | PASS | PASS | PASS (0) | PASS (0) | execute_code | search_documents ×3 |
| 7 | moonshot | kimi-k3 | `ATT274-moonshot-863e2ef7` | PASS | PASS | PASS | PASS (0) | PASS (0) | workspace_read, workspace_list ×2, workspace_read | search_documents, grep ×4, query_documents |
| 8 | openrouter | z-ai/glm-5.3-flash | `ATT274-openrouter-b3079276` | PASS | PASS | PASS | PASS (0) | PASS (0) | workspace_read, execute_code ×2 | search_documents, grep ×5, query_documents |
| — | lmstudio (extra) | qwen-agentworld-35b-a3b | — | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ extra (self-hosted) group — not one of the required 8; not driven unless named in `--providers` (the 273 board rule) | — |

**8 / 8 required rows PASS on all five verdicts. None omitted, none ⛔.** Across the whole run
`documents(user)` read **185 before and 185 after (delta 0)** and `connector_watches(user)` **3 → 3 (delta 0)**.

⭐ **The second-thread negative is stronger than the plan asked for.** In every B thread the model went LOOKING — 8/8 called
`search_documents`, most also `grep` / `query_documents` / `read_document` over the Library — and none found the token. That is
the knowledge base's own retrieval tools confirming D-01 (never chunked, never embedded) from the agent's side, not just a
SQL count. Several B answers also said plainly *"I don't see an attachment in this chat"* (anthropic, google, zhipu).

Per-row evidence: `evidence/board/<provider>-<run_a>.json` (file body, both turns' persisted messages and tool calls, the
`workspace_files` row, upload response); `board-summary.json`; `board-run.log`.

**Observation (not a criterion; for G-4 #2 to judge):** in thread A, four models named the file WITH its stored upload prefix
(e.g. anthropic: *"from … the file you attached (**55ab08ff-meridian-…**)"*; deepseek, google, moonshot likewise). The agent's
attachment note (`agent_loop._build_attachment_note`) derives the name from the container path, which carries the
`<8 hex>-` prefix; D-27's strip is applied on the chip, the dialog and the Library name, not in the agent prompt. Harmless to
the answer; visible in the transcript.

## 2. G-4 lived scenarios (D-16) — API half measured; Chrome half PENDING-ORCHESTRATOR

API half: `scripts/run-274-board.py --promote-probe` → exit 0, 2026-10-05. One fixture: `274-g4-api-keeper.pdf`, **335,731
bytes** (> 256 KB, so bucket-stored — Pitfall 6), sha256 `2415e706…fc74e8`, planted token `ATT274-probe-ffc1770b`. Folder X =
`Client ACME / Q3 Contracts` (`b33bd4cb-ba40-4e9e-b804-857dd4b6ad75`, nested), Y = `Engineering`
(`41c78005-1139-4829-89ea-e11e56294828`). Full log: `evidence/g4-api/promote-probe.log`; JSON:
`evidence/g4-api/promote-probe-ATT274-probe-ffc1770b.json`. Chrome fixtures (distinct bytes, fresh tokens):
`evidence/chrome-fixtures.txt`.

| Row | Named failure it refutes | API half (Claude, measured) | Chrome half | Operator |
|---|---|---|---|---|
| **G-4 #1** Library pollution | *"ATT-02 is met by hiding a button while an API path still writes Library rows"* | **PASS.** Attach (`POST …/workspace/files?lifetime=thread`, HTTP 200) → `documents(user)` **185 → 185**; the row reads `kind=template_input`, `expires_at=null`, `content_storage_path=d8a54002…/55bc9783…/4269d27a…/v1`; `POST /document-search {"name": token}` → 200, **total 0**; documents/chunks holding the token → **0**. The board adds 16 more attaches with `documents(user)` 185 → 185 across all of them. | PENDING-ORCHESTRATOR — attach a PDF in Chrome, network log shows only `/workspace/files*`, the file is absent from the Library and from Find, `documents` count unchanged | owed |
| **G-4 #2** Agent can't see it | *"ATT-01 passes only because the agent could never read the attachment"* | **PASS via the board:** 8/8 providers answered the planted fact from the attachment (§1). | PENDING-ORCHESTRATOR — the same in the UI with a PDF; the chip reads `this chat only`, no `24h`, no hex prefix | owed |
| **G-4 #3** Promote lands wrong | *"promotion lands at the Library root"* | **PASS.** preview X → `{promotable: true, duplicate_of: null, next_version: 1}`; promote X → **HTTP 201** `outcome: saved`, `folder_id = X`; `documents.folder_id` **= X** (`folder_matches_X = true`), `version_number 1`; `library-links` carries the mark (`saved`, `pending` → `completed` after the wait); the attachment row stamped `library_document_id=3cd6dddd…`, `library_link=saved`. **D-14:** a same-named, different-bytes PDF → preview X `{duplicate_of: null, next_version: 2}`; promote → 201, **version 2**, and version 1 stays with `is_latest=false`. **D-13:** the ORIGINAL bytes from a second thread → preview Y names **X** in `duplicate_of`; promote Y → **HTTP 200 `already`**, `folder_id` = **X**; `documents` in Y with that name → **0** (nothing copied, nothing moved). | PENDING-ORCHESTRATOR — the dialog (no Root, disabled until a pick), the chip's `In Library · <leaf>` + `indexing…` clearing, the panel's full path, the version warning and the already screen as rendered, Shift+F10 on the panel row | owed |
| **G-4 #4** Delete eats the keeper | *"a promoted document still cascades when the thread is deleted"* | **PASS.** Thread T1 (`55bc9783…`): `storage.objects` under `<uid>/<T1>/` **1 → 0** across `DELETE /threads/T1` (HTTP 204); `workspace_files` for T1 → 0. Thread T2 (`1a719896…`, the `already` link): **1 → 0**. The Library copy `3cd6dddd…` is still in X, `completed`; `POST /documents/{id}/download-url` → 200, GET → 200, **335,731 bytes, sha256 equal to the original (`equals_original: true`)**. Version 2 (`74783d70…`, minted from T1) also survives, `completed`. **D-11:** the document has no FK to the thread — proven by the survival, not assumed. | PENDING-ORCHESTRATOR — the same with the UI's delete-chat, then open + download in the Library | owed |

## 3. The 4-axis UAT bandwidth (CLAUDE.md UAT scoreboard recipe)

API half: `scripts/run-274-board.py --axes --providers anthropic` (claude-opus-5-5, the derived anthropic row) → exit 0,
2026-10-05. Evidence: `evidence/axes/axes-run.log`, `evidence/axes/axes-anthropic.json`.

| Axis | What was driven | Result (persisted data) | Chrome half |
|---|---|---|---|
| Cross-provider | The full 8-row board (§1) | **PASS** — 8/8 required rows on all five verdicts | — |
| Multi-tool | Thread `94109e86…`: a PDF attachment (`ATT274-multitool-9a03c354`) + ONE prompt asking for `execute_code` on the PDF AND `search_documents` over the Library | **PASS** — run `completed`; tool calls **`execute_code`, `search_documents`**; the answer carries the token AND a one-line summary of the Library's laptop/VPN setup document | PENDING-ORCHESTRATOR (optional — the API half is the measurement) |
| Parallel-thread | Thread A `f6063d5f…` streams a ~900-word essay; 6 s in (A's run read `streaming`), thread B `98bc5bab…` attaches a `.md` (`ATT274-parallel-9db69948`) and asks | **PASS** — the runs overlap (A 14:46:48 → 14:47:19, B 14:46:54 → 14:47:27); B's answer has the token; **A's 7,318-char answer does not** — each landed in its own thread | PENDING-ORCHESTRATOR — the same in two tabs |
| Long-message | Thread `0ad11b98…`: a **6,692-byte** prompt about an attachment (`ATT274-long-1dd3f7c1`) | **PASS** — `completed`, tools `workspace_read`, `execute_code`; answer carries the token | — |

The same observation as §1: the multi-tool and long-message answers name the file with its upload prefix
(`8286c543-meridian-brief.pdf`, `ee06bdf0-meridian-note.md`).

## 4. D-18 — the negative ATT-02 audit (SC#2: the composer has no Library door)

### Static half — measured on the merged tree (2026-10-05)

| Check | Evidence | Result |
|---|---|---|
| Every `documents` minter in the backend, enumerated and PINNED | `backend/tests/unit/test_274_minter_inventory.py` (274-02) scans `backend/app` for callers of the minter and asserts the set equals exactly: `api/documents.py` (Library upload) · `services/sources/import_service.py` (connector import) · `services/watch_service.py` (watched cloud folders) · `services/email_attachments.py` (mail attachments) · `services/expert_install_service.py` (Expert install) · `api/workspace_promote.py` (274's explicit Save to Library — the ONLY chat-side door). `services/ingest_splice.py` is excluded by name (the defining module). A second case asserts `api/workspace.py` (both attach doors) is NOT a minter. Its RED drive (a planted `_plant_274_minter.py`) is recorded in 274-02-SUMMARY. | PASS — `pytest test_274_minter_inventory.py test_244_cloud_attach_is_thread_scoped.py` → **13 passed** on the merged tree |
| Reachability of each minter from the composer | Library upload: the Library page only. Connector import / watches: the Library + Connections surfaces only. Mail: the mail watch only. Expert install: the Expert catalog only. Promote: the chip/panel `⋯` → `Save to Library…` only, never the composer (no `⋯` on a pending chip — 274-04 Task 2). | PASS (by the composer fence below) |
| The composer fence | `frontend/src/components/attachments/__tests__/composerNoLibraryDoor.test.ts` (274-04): comment-stripped `?raw` read of `MessageInput`, `useComposerAttachments`, `ConnectedFilePickerModal`, `ConnectorsFlyout`, `InviteExpertDialog`, `ConnectionsPage` and `ConnectionsTab`; none contains any of the 8 minting tokens; a planted call proves the fence fires; `ConnectorsFlyout`'s `@/lib/api` import list is exactly `listConnectorConnections`. | PASS — **4/4** (run together with the contract fence: 2 files, 10 tests passed) |
| `ConnectorsFlyout`'s links | All three buttons (`Manage`, `Add connector`, the empty-state `Add your first connector`) call ONE handler, `handleOpenSettings` → `onOpenConnections?.()`. The product caller (`ChatLayout.tsx:872` and `:1064`) passes `() => onNavigate("connections")` — a view switch in the `ActiveView` state (the app has no router). Its only API import is `listConnectorConnections` (a read). Nothing in the flyout can create a watch or an import. | PASS (static) |

### API half — measured through the running backend

| Check | Result |
|---|---|
| `documents(user)` across the whole board (16 attaches, 16 runs) | 185 → 185 (delta 0) |
| `documents(user)` across the probe's attach | 185 → 185 |
| `connector_watches(user)` across the board | 3 → 3 |
| `connector_watches(user)` across the probe (attach, 3 promotes, 2 thread deletes) | 3 → 3 |
| The only way a chat file reached the Library | the explicit `POST …/files/{id}/promote` (201 `saved` / 200 `already`) |

**Static + API halves: PASS.** The live half (network log, flyout click) is the orchestrator's.

### Live half — PENDING-ORCHESTRATOR (Chrome)

During G-4 #1 the network log must show only `/threads/{id}/workspace/files?lifetime=thread` (and
`/workspace/files/from-connection` for a cloud attach) — no `POST /documents/upload`, `/connectors/…/import`,
`/sources/watches` or `/install`. Then `+` → `Tools and connectors` → the flyout's `Manage` → the Connections page opens, and
`SELECT count(*) FROM connector_watches WHERE user_id = 'd8a54002-6a29-4b88-b918-cff2aa4a06d5'` reads the same before and
after (3 at 274-05's start). Click-path in 274-05-SUMMARY.md.

## 5. Sign-off (Task 4) — OWED

| Row | Claude (274-05 executor) | Chrome (orchestrator) | Operator verdict |
|---|---|---|---|
| Board (§1) | PASS 8/8 | — | owed |
| G-4 #1 | API PASS | PENDING-ORCHESTRATOR | owed |
| G-4 #2 | PASS via the board | PENDING-ORCHESTRATOR | owed |
| G-4 #3 | API PASS (saved / version 2 / already) | PENDING-ORCHESTRATOR | owed |
| G-4 #4 | API PASS (1 → 0, byte-identical download) | PENDING-ORCHESTRATOR | owed |
| 4-axis (§3) | PASS ×4 | optional | owed |
| D-18 (§4) | static + API PASS | PENDING-ORCHESTRATOR (network log, flyout click) | owed |

`BUG-260905-01` and `SEED-247` are NOT yet re-routed: D-17 closes the bug only on driven G-4 #1 / #3 rows and the D-18 live
half, which are the orchestrator's.

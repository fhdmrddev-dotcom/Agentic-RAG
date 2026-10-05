# Phase 274 — Validation (plan 274-05)

Rows are filled from PERSISTED data (`workspace_files`, `documents`, `document_chunks`, `storage.objects`, `messages`, `runs`)
and, for the G-4 rows, from a real browser — never from a transcript. Raw evidence: `evidence/board/` (one JSON per row +
`board-summary.json` + `board-run.txt`), `evidence/g4-api/` (the API half of G-4 #1/#3/#4), `evidence/axes/`. Method, gate
lines and the D-18 audit: `274-UAT-LOG.md`.

Status (2026-10-05): **partial.** Board, API halves, 4-axis API rows and the D-18 static + API halves are measured by
274-05's executor. **The Chrome halves of G-4 #1-#4 and the D-18 live network-log / flyout click were measured by the orchestrator in Chrome — §6**
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
`workspace_files` row, upload response); `board-summary.json`; `board-run.txt`.

**Observation (not a criterion; for G-4 #2 to judge):** in thread A, four models named the file WITH its stored upload prefix
(e.g. anthropic: *"from … the file you attached (**55ab08ff-meridian-…**)"*; deepseek, google, moonshot likewise). The agent's
attachment note (`agent_loop._build_attachment_note`) derives the name from the container path, which carries the
`<8 hex>-` prefix; D-27's strip is applied on the chip, the dialog and the Library name, not in the agent prompt. Harmless to
the answer; visible in the transcript.

## 2. G-4 lived scenarios (D-16) — API half measured here; Chrome half in §6

API half: `scripts/run-274-board.py --promote-probe` → exit 0, 2026-10-05. One fixture: `274-g4-api-keeper.pdf`, **335,731
bytes** (> 256 KB, so bucket-stored — Pitfall 6), sha256 `2415e706…fc74e8`, planted token `ATT274-probe-ffc1770b`. Folder X =
`Client ACME / Q3 Contracts` (`b33bd4cb-ba40-4e9e-b804-857dd4b6ad75`, nested), Y = `Engineering`
(`41c78005-1139-4829-89ea-e11e56294828`). Full log: `evidence/g4-api/promote-probe.txt`; JSON:
`evidence/g4-api/promote-probe-ATT274-probe-ffc1770b.json`. Chrome fixtures (distinct bytes, fresh tokens):
`evidence/chrome-fixtures.txt`.

| Row | Named failure it refutes | API half (Claude, measured) | Chrome half | Operator |
|---|---|---|---|---|
| **G-4 #1** Library pollution | *"ATT-02 is met by hiding a button while an API path still writes Library rows"* | **PASS.** Attach (`POST …/workspace/files?lifetime=thread`, HTTP 200) → `documents(user)` **185 → 185**; the row reads `kind=template_input`, `expires_at=null`, `content_storage_path=d8a54002…/55bc9783…/4269d27a…/v1`; `POST /document-search {"name": token}` → 200, **total 0**; documents/chunks holding the token → **0**. The board adds 16 more attaches with `documents(user)` 185 → 185 across all of them. | driven in Chrome (§6) — — attach a PDF in Chrome, network log shows only `/workspace/files*`, the file is absent from the Library and from Find, `documents` count unchanged | owed |
| **G-4 #2** Agent can't see it | *"ATT-01 passes only because the agent could never read the attachment"* | **PASS via the board:** 8/8 providers answered the planted fact from the attachment (§1). | driven in Chrome (§6) — — the same in the UI with a PDF; the chip reads `this chat only`, no `24h`, no hex prefix | owed |
| **G-4 #3** Promote lands wrong | *"promotion lands at the Library root"* | **PASS.** preview X → `{promotable: true, duplicate_of: null, next_version: 1}`; promote X → **HTTP 201** `outcome: saved`, `folder_id = X`; `documents.folder_id` **= X** (`folder_matches_X = true`), `version_number 1`; `library-links` carries the mark (`saved`, `pending` → `completed` after the wait); the attachment row stamped `library_document_id=3cd6dddd…`, `library_link=saved`. **D-14:** a same-named, different-bytes PDF → preview X `{duplicate_of: null, next_version: 2}`; promote → 201, **version 2**, and version 1 stays with `is_latest=false`. **D-13:** the ORIGINAL bytes from a second thread → preview Y names **X** in `duplicate_of`; promote Y → **HTTP 200 `already`**, `folder_id` = **X**; `documents` in Y with that name → **0** (nothing copied, nothing moved). | driven in Chrome (§6) — — the dialog (no Root, disabled until a pick), the chip's `In Library · <leaf>` + `indexing…` clearing, the panel's full path, the version warning and the already screen as rendered, Shift+F10 on the panel row | owed |
| **G-4 #4** Delete eats the keeper | *"a promoted document still cascades when the thread is deleted"* | **PASS.** Thread T1 (`55bc9783…`): `storage.objects` under `<uid>/<T1>/` **1 → 0** across `DELETE /threads/T1` (HTTP 204); `workspace_files` for T1 → 0. Thread T2 (`1a719896…`, the `already` link): **1 → 0**. The Library copy `3cd6dddd…` is still in X, `completed`; `POST /documents/{id}/download-url` → 200, GET → 200, **335,731 bytes, sha256 equal to the original (`equals_original: true`)**. Version 2 (`74783d70…`, minted from T1) also survives, `completed`. **D-11:** the document has no FK to the thread — proven by the survival, not assumed. | driven in Chrome (§6) — — the same with the UI's delete-chat, then open + download in the Library | owed |

## 3. The 4-axis UAT bandwidth (CLAUDE.md UAT scoreboard recipe)

API half: `scripts/run-274-board.py --axes --providers anthropic` (claude-opus-5-5, the derived anthropic row) → exit 0,
2026-10-05. Evidence: `evidence/axes/axes-run.txt`, `evidence/axes/axes-anthropic.json`.

| Axis | What was driven | Result (persisted data) | Chrome half |
|---|---|---|---|
| Cross-provider | The full 8-row board (§1) | **PASS** — 8/8 required rows on all five verdicts | — |
| Multi-tool | Thread `94109e86…`: a PDF attachment (`ATT274-multitool-9a03c354`) + ONE prompt asking for `execute_code` on the PDF AND `search_documents` over the Library | **PASS** — run `completed`; tool calls **`execute_code`, `search_documents`**; the answer carries the token AND a one-line summary of the Library's laptop/VPN setup document | not driven in Chrome (optional; the API half is the measurement) (optional — the API half is the measurement) |
| Parallel-thread | Thread A `f6063d5f…` streams a ~900-word essay; 6 s in (A's run read `streaming`), thread B `98bc5bab…` attaches a `.md` (`ATT274-parallel-9db69948`) and asks | **PASS** — the runs overlap (A 14:46:48 → 14:47:19, B 14:46:54 → 14:47:27); B's answer has the token; **A's 7,318-char answer does not** — each landed in its own thread | not driven in Chrome (optional; the API half is the measurement) — the same in two tabs |
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

### Live half — measured by the orchestrator in Chrome (§6.5)

During G-4 #1 the network log must show only `/threads/{id}/workspace/files?lifetime=thread` (and
`/workspace/files/from-connection` for a cloud attach) — no `POST /documents/upload`, `/connectors/…/import`,
`/sources/watches` or `/install`. Then `+` → `Tools and connectors` → the flyout's `Manage` → the Connections page opens, and
`SELECT count(*) FROM connector_watches WHERE user_id = 'd8a54002-6a29-4b88-b918-cff2aa4a06d5'` reads the same before and
after (3 at 274-05's start). Click-path in 274-05-SUMMARY.md.

## 5. Sign-off (Task 4) — APPROVED by the operator, 2026-10-05

| Row | Claude (274-05 executor) | Chrome (orchestrator) | Operator verdict |
|---|---|---|---|
| Board (§1) | PASS 8/8 | — | **approved** (operator, 2026-10-05) |
| G-4 #1 | API PASS | **PASS** (§6.1, local + cloud) | **approved** (operator, 2026-10-05) |
| G-4 #2 | PASS via the board | **PASS** (§6.2) | **approved** (operator, 2026-10-05) |
| G-4 #3 | API PASS (saved / version 2 / already) | **PASS** (§6.3) — F-1 found + fixed; residual gap named | **approved** (operator, 2026-10-05) |
| G-4 #4 | API PASS (1 → 0, byte-identical download) | **PASS** (§6.4) | **approved** (operator, 2026-10-05) |
| 4-axis (§3) | PASS ×4 | optional | **approved** (operator, 2026-10-05) |
| D-18 (§4) | static + API PASS | **PASS** (§6.5, network log + Manage click) | **approved** (operator, 2026-10-05) |

`BUG-260905-01` and `SEED-247` are NOT yet re-routed: D-17 closes the bug only on driven G-4 #1 / #3 rows and the D-18 live
half, which are the orchestrator's.

## 6. Chrome halves — driven by the orchestrator, 2026-10-05 (Claude in Chrome, the live app on :5173/:8000)

Driven in the operator's Chrome against develop at 7b66f608d+ (waves 1-2 merged). Counts read from local Postgres with a
read-only asyncpg query. ⚠ The tab reported `document.visibilityState: hidden` for the whole drive: screenshots often timed out,
timers were throttled and dialog exit animations did not finish (see §6.6). Every verdict below is from the DOM, the network log
or the database, never from "it looked right".

### 6.1 G-4 #1 — Library pollution: **PASS** (local AND cloud)
- New chat → send → attach `274-g4-meridian-brief.pdf` (1,612 B) from the composer. Network log for the attach: **only**
  `POST /threads/79b2bb0c…/workspace/files?lifetime=thread` → 200 (+ list/library-links GETs). No `/documents/upload`,
  `/connectors/…/import`, `/sources/watches`, `/install`.
- `documents(user)` **187 → 187**; `connector_watches` **3 → 3**; Library rows named `*meridian-brief*` **0**. The row is
  `kind=template_input`, `expires_at=null`.
- Cloud half: `+` → **From cloud storage** → Google Drive (Google Workspace connection) → `245-UAT-readme.txt` (a test fixture;
  the operator's personal Drive files were deliberately NOT attached) → Attach. Network: **only**
  `POST …/workspace/files/from-connection` → 200. `documents(user)` **190 → 190**, watches **3 → 3**, row `template_input`,
  `expires_at=null`.
- An empty new chat refuses an attach with *"Send a message first — a file belongs to a conversation."* (the shipped 244 rule).

### 6.2 G-4 #2 — Agent can't see it: **PASS**
- Pending chip: `274-g4-meridian-brief.pdf · 1.6 KB` (no prefix). Sent chip: `274-g4-meridian-brief.pdf · 1.6 KB · this chat only`
  — **no `24h`, no hex prefix**.
- Asked *"What is the Meridian freight-cap clearance code in the file I attached?"* (deepseek-v4-flash) → *"…is
  ATT274-chrome-dee8d311."*
- **F-3 (observation, not fixed):** the answer cites `Source: e8d656d5-274-g4-meridian-brief.pdf` — the agent is handed the stored
  name, so it repeats the prefix (the board saw it in 7/11 answers). Cosmetic; the fix is the agent note using the display name.

### 6.3 G-4 #3 — Promote lands wrong: **PASS** (one defect found and fixed in-phase)
- Sent chip `⋯` (`aria-label="More actions for this file"`) visible without hover → menu **Save to Library… / Open in panel**.
- Dialog: title, sub, file chip (no prefix), searchable listbox (`role=listbox`), **30 options, none Root**, confirm **disabled**
  until a pick. Search `ddfd` → `SOPs › dddd › ddfd` → confirm enabled → **POST …/promote → 201**.
- `documents`: `274-g4-meridian-brief.pdf`, `folder_id = 7ea141e8…` (**X**), `completed`, v1, `library_link=saved`.
  Chip: `✓ In Library · ddfd` (`indexing…` while `processing`, cleared on `completed`).
- **D-14:** attach the v2 bytes (same name) → `⋯` → Save to Library → pick X **by keyboard (ArrowDown + Enter)** → the dialog says,
  BEFORE confirm: *"SOPs › dddd › ddfd already has a file called 274-g4-meridian-brief.pdf. Saving makes this version 2; version 1
  stays in its history."* → saved → DB: v1 `is_latest=false`, v2 `is_latest=true`, both in X.
- **D-13:** new chat, original bytes, the **panel row's** `⋯` (menu offers ONLY *Save to Library…*) → pick **Y** (`Client ACME › Q3
  Contracts`) → result: *"Already in your Library — The same file is already in SOPs › dddd › ddfd, so nothing new was saved. You
  picked Client ACME › Q3 Contracts. The existing copy was not moved."* → documents in Y with that name **0**; chip
  `Already in Library · ddfd`.
- **F-1 (DEFECT, found here, FIXED):** the panel Files row's after-mark was a full-path pill in a `max-w-[65%] flex-wrap` slot at the
  row's inherited 13px type — the **file name measured 0 px wide**. Fixed TDD, committed by path: `26089e0c1` (test) → `6a7db8b79`
  (segment `text-[11px]`, panel shows the LEAF with the full path in `title`, as sketch 274-A draws it); `c82b7b237` + `e486ab8af`
  (tests) → fix (slot stacks scope over action; a chat attachment's row uses the chip's display-name rule, no `<8hex>-` prefix;
  agent rows keep their path). Re-measured live: name **0 → 64 px**, reads `274-g4-…`; segment 11px,
  `title="SOPs › dddd › ddfd"`. 463/463 targeted tests, tsc 66 (= base).
  ⚠ **Residual gap vs sketch A (named, not fixed):** the sketch gives the name its own full line with `size · this chat only` and the
  mark on a meta line under it. The shared `FileRow` panel density is one line (icon · name · size · age · trailing), so at the
  panel's 345 px the name is still truncated (`274-g4-…`). Closing it needs a sub-line slot on `FileRow` — an operator call.
- Not driven in Chrome (hidden-tab focus is unreliable): Shift+F10 on the panel row — covered by `FilesSection.test.tsx`
  (Shift+F10 and ContextMenu cases, green).

### 6.4 G-4 #4 — Delete eats the keeper: **PASS**
- New chat → attach `274-g4-keeper.pdf` (335,738 B, bucket-stored) → `storage.objects` under `<uid>/002075a1…/` = **1**.
- `⋯` → Save to Library → **Engineering** → chip `In Library · Engineering · indexing…` → document `processing` → `completed` →
  chip `In Library · Engineering` (polling then stopped — no further `library-links` requests).
- Delete the chat from the history list (*Thread options → Delete → "Delete thread?" → Delete*) → thread rows **0**,
  `workspace_files` **0**, **`storage.objects` 1 → 0**.
- Library: `Engineering › 274-g4-keeper.pdf` **Ready** with Download; its `documents`-bucket object is present, **335,738 B,
  application/pdf**. (The byte-identical download was proven by the executor's API probe, §2 — clicking Download in Chrome would
  save a file to the operator's machine and was not done without asking.)

### 6.5 D-18 live half: **PASS**
- §6.1's network logs (local + cloud attach) carry no Library-writing call.
- Composer `+` menu: *Attach a file · From cloud storage · Invite Expert… · Browse Expert Catalog… · Manage · (tool toggles) · Add
  connector* — no Library door.
- `+` → **Manage** → the Connections page; requests: `GET /connectors/connections`, `/connectors/source-families`, `/features`,
  `/workflows/published` only. `connector_watches` **3 → 3**.

### 6.6 Other findings
- **F-2 (pre-existing, low):** the upload response carries no `created_at` (`ws_write_file`'s result), so a freshly-sent chip depends
  on the follow-up list refetch for its timestamp; when that refetch failed (a 401 from the hidden tab's stale token) the second
  attachment's chip vanished until reload (`attachmentsForMessage` drops a row with no `created_at`). After reload it rendered
  correctly. Fix is one line (return `created_at` from the upload). Not introduced by 274.
- **Environment, not app:** in the hidden tab, Radix dialogs (cloud picker, delete confirm) stayed in the DOM after their action had
  completed — exit animations do not run in a hidden tab. Every action they triggered was verified in the DB.

### Deferred at sign-off (operator approved without ruling on these; routed as follow-ups, not built in 274)
- **F-1 residual:** the panel Files row's name still truncates at the panel's 345 px; sketch 274-A gives it a full line with a meta
  line under it. Needs a sub-line slot on the shared `FileRow`. Re-open: the operator asks for it, or the next phase touching
  `FileRow`/`FilesSection`.
- **F-2:** return `created_at` from the upload (`POST /workspace/files`) so a sent chip never depends on the follow-up refetch.
  Pre-existing (244). Re-open: a chip reported vanishing after send.
- **F-3:** the agent's attachment note hands the model the stored `<8hex>-` name, so answers cite it. Use the display name.
  Re-open: the next touch of `agent_loop._build_attachment_note`.

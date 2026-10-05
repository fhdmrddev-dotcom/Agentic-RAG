---
phase: 274-thread-scoped-attachments
plan: 05
status: complete — Chrome halves driven by the orchestrator; operator approved 2026-10-05
subsystem: verification (live stack) + registers
tags: [attachments, uat, board, cross-provider, g-4, d-18, ledger, docs, att-01, att-02, att-03]
requires:
  - "274-01..04 merged on develop (327c7aae2); local stack up; migration 203 applied locally"
provides:
  - "scripts/run-274-board.py: --roster / --run / --promote-probe / --axes / --fixtures"
  - "frontend/src/components/attachments/__tests__/promoteContract.fence.test.ts (pinned 6)"
  - "274-VALIDATION.md (board, G-4 API halves, 4-axis, D-18 static + API) and 274-UAT-LOG.md"
  - "docs/public/use/attachments.md written; hot-file ledger close"
affects:
  - "BUG-260905-01 / SEED-247 routing — deliberately NOT done; needs the Chrome rows"
tech-stack:
  added: []
  patterns:
    - "board script imports run-273-board.py helpers via importlib.util.spec_from_file_location"
    - "per-request model + provider; planted token per row; second-thread negative"
key-files:
  created:
    - scripts/run-274-board.py
    - frontend/src/components/attachments/__tests__/promoteContract.fence.test.ts
    - .planning/phases/274-thread-scoped-attachments/274-VALIDATION.md
    - .planning/phases/274-thread-scoped-attachments/274-UAT-LOG.md
    - .planning/phases/274-thread-scoped-attachments/evidence/
  modified:
    - scripts/vitest-count-gate.cjs
    - docs/public/use/attachments.md
    - .planning/research/docs-coverage-inventory.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "Merged-tree full gates taken verbatim from the orchestrator's run (directive), not re-run; only targeted suites and the cheap gates were re-run after this plan's edits"
  - "The 4-axis rows were measured through the API on the anthropic row (no browser); the Chrome half is optional for them"
  - "Run logs are copied to .txt evidence because *.log is gitignored"
  - "folderDisplay.ts got its first ledger row here (it was in no plan's files_modified)"
metrics:
  completed: 2026-10-05
  tasks: "Task 1 done; Task 2 probed (operator had it up); Task 3 non-browser parts done; Task 4 owed"
---

# Phase 274 Plan 05: Live proof of thread-scoped attachments, partial (Chrome and sign-off owed)

The 8-row planted-fact board passed on every row. All 8 providers answered from the chat
attachment. All 8 failed to find it from a second chat, even though every one of them searched
the Library for it. Document search, `documents` and `document_chunks` never held the token. The
API half of G-4 #1, #3 and #4 also passed:
- an attach writes no Library row;
- a save lands in the picked nested folder, makes version 2 on a same-named file, and returns
  `already` (naming the original folder) for the same bytes;
- deleting the thread takes `storage.objects` from 1 to 0, while the Library copy still downloads
  byte-identical.

The browser halves are still owed, and they are written out below as exact click-paths.

## FOR THE ORCHESTRATOR — the exact Chrome click-paths (G-4 #1-#4 + the D-18 live half)

Shared facts:
- App: `http://localhost:5173`. It listens on IPv6 only, so use `localhost`, not `127.0.0.1`.
- Dev user `d8a54002-6a29-4b88-b918-cff2aa4a06d5` (fhdmrd@gmail.com) is in a single org,
  `22f9c615-0eec-440a-8804-ed4784d6f57f`.
- Use Chrome MCP `type_text`, never `fill`.
- The fixtures are in `C:\Users\fhdmr\AppData\Local\Temp\agentic-rag-274-g4-fixtures\`. The bytes
  differ from everything the API probe used, so no Chrome promote collides with probe data.
  Regenerate them with `backend/venv/Scripts/python.exe scripts/run-274-board.py --fixtures <dir>`,
  but that issues NEW tokens.

| Fixture file | Bytes | Planted content |
|---|---|---|
| `274-g4-meridian-brief.pdf` | 1,612 | `The Meridian freight-cap clearance code is ATT274-chrome-dee8d311.` and the unique word `quillfeatherdee8d311` |
| `v2\274-g4-meridian-brief.pdf` (same name, different bytes) | 1,472 | `Revision marker …` |
| `274-g4-keeper.pdf` (bucket-stored) | 335,738 | `ATT274-keeper-5dd2b0ac` |

The folders to use are new and untouched by the probe:

| Role | Folder (display path) | Folder id |
|---|---|---|
| X | `SOPs › dddd › ddfd` (nested, 0 docs before) | `7ea141e8-f6ac-43fc-af72-7088ff2522c5` |
| Y | `Client ACME › Q3 Contracts` | `b33bd4cb-ba40-4e9e-b804-857dd4b6ad75` |
| Z (keeper) | `Engineering` | `41c78005-1139-4829-89ea-e11e56294828` |

### G-4 #1: Library pollution, with the D-18 live half

1. Read `SELECT count(*) FROM documents WHERE user_id='d8a54002-6a29-4b88-b918-cff2aa4a06d5'`
   (it was 185 at this plan's end) and `SELECT count(*) FROM connector_watches WHERE user_id='d8a54002-6a29-4b88-b918-cff2aa4a06d5'`
   (it was 3).
2. Choose **New chat**. Clear the network log.
3. Click the composer `+` (`data-testid="composer-plus-btn"`), then **Attach a file**, and upload
   `274-g4-meridian-brief.pdf`.
4. Check the network log. It must hold only `POST /threads/<id>/workspace/files?lifetime=thread`
   plus GETs. There must be NO `/documents/upload`, `/connectors/…/import`, `/sources/watches` or
   `/install`. Screenshot it to `evidence/g4-1/`.
5. Read the `documents` count again. It must be unchanged.
6. Open the Library and use Find with the name `274-g4-meridian-brief`. It must return 0 results.
7. The cloud half is optional and needs a Google Drive connection: click `+`, then
   **From cloud storage**, pick a file, then **Attach**. The network log must show only
   `/workspace/files/from-connection`.
8. D-18 flyout: click `+`, then **Tools and connectors**, then **Manage**. The Connections page must
   open. Read the `connector_watches` count again. It must be unchanged.

### G-4 #2: the agent can see it (same chat as #1)

1. Check the chip before sending. It must read `274-g4-meridian-brief.pdf` with no `xxxxxxxx-`
   prefix, say `this chat only`, and show no `24h`.
2. Use `type_text` to enter `What is the Meridian freight-cap clearance code in the file I attached?`
   and send it.
3. The reply must contain `ATT274-chrome-dee8d311`. Screenshot it, then read the persisted message
   with `SELECT content FROM messages WHERE thread_id='<id>' AND role='assistant' ORDER BY created_at DESC LIMIT 1`.
4. Judge the board's observation here: the agent may name the file with its upload prefix.

### G-4 #3: the save lands in the right place (same chat)

1. On the SENT chip, check that `⋯` (aria-label `More actions for this file`) is visible without
   hovering. Click it, then **Save to Library…**.
2. In the dialog:
   - there is no Root option;
   - **Save to Library** is disabled until a folder is picked;
   - type `ddfd` into **Find a folder** and pick `SOPs › dddd › ddfd`;
   - click **Save to Library**.
3. The chip must read `In Library · ddfd · indexing…`, and the `indexing…` must clear once
   `SELECT folder_id, status FROM documents WHERE user_id='d8a54002-6a29-4b88-b918-cff2aa4a06d5' AND filename='274-g4-meridian-brief.pdf'`
   reads `7ea141e8-…`, `completed`.
4. Open the workspace panel. The Files row must show the full path `SOPs › dddd › ddfd`. Click the
   segment: the Library must open that document.
5. Keyboard path: focus the panel Files row and press `Shift+F10`. The `⋯` menu must open.
6. **D-14:** in the same chat, attach `v2\274-g4-meridian-brief.pdf` and send any message. Then
   click its chip `⋯`, **Save to Library…**, and pick `SOPs › dddd › ddfd`. Before confirming, the
   dialog must say: `SOPs › dddd › ddfd already has a file called 274-g4-meridian-brief.pdf. Saving makes this version 2; version 1 stays in its history.`
   Confirming is optional.
7. **D-13:** wait until the original is `completed`. Choose **New chat**, attach the ORIGINAL
   `274-g4-meridian-brief.pdf`, and send. Then `⋯`, **Save to Library…**, pick
   `Client ACME › Q3 Contracts`, and confirm. The **Already in your Library** screen must say
   `The same file is already in SOPs › dddd › ddfd, so nothing new was saved.` and
   `You picked Client ACME › Q3 Contracts. The existing copy was not moved.`
8. Screenshots go to `evidence/g4-3/`.

### G-4 #4: deleting the chat keeps the saved copy

1. Choose **New chat**, attach `274-g4-keeper.pdf`, and send `Summarise this file in one line.`
2. Read `SELECT count(*) FROM storage.objects WHERE bucket_id='workspace-files' AND name LIKE 'd8a54002-6a29-4b88-b918-cff2aa4a06d5/<thread_id>/%'`.
   It must be greater than 0. The probe measured 1.
3. Click `⋯`, **Save to Library…**, pick `Engineering`, and confirm. Wait for `completed`.
4. Delete the chat from the chat history (the row's menu, then **Delete**). The same count must
   read 0.
5. In the Library, open Engineering, then `274-g4-keeper.pdf`. It must open, and its download must
   be 335,738 bytes.
6. Screenshots and query output go to `evidence/g4-4/`.

After the drives, do Task 3 step 8. Close `BUG-260905-01` (`verified_closed_by`: 274-VALIDATION G-4
#1, G-4 #3, §4 D-18) only if all three pass, and the cloud half only if a real Drive connection was
driven; otherwise keep it `folded` and state the reason. Set `SEED-247` to `answered` with Q4 going
to Phase 274.

## Board (Task 3 step 1), 8/8 PASS

| Provider | Model (derived) | D-05 row | Answered | 2nd-thread neg. | doc-search neg. | DB neg. |
|---|---|---|---|---|---|---|
| openai | gpt-5.6-luna | PASS | PASS | PASS | PASS (0) | PASS (0) |
| anthropic | claude-opus-5-5 | PASS | PASS | PASS | PASS (0) | PASS (0) |
| google | gemini-3.8-flash | PASS | PASS | PASS | PASS (0) | PASS (0) |
| deepseek | deepseek-v4-pro | PASS | PASS | PASS | PASS (0) | PASS (0) |
| zhipu | glm-5.3-flash | PASS | PASS | PASS | PASS (0) | PASS (0) |
| minimax | MiniMax-M3 | PASS | PASS | PASS | PASS (0) | PASS (0) |
| moonshot | kimi-k3 | PASS | PASS | PASS | PASS (0) | PASS (0) |
| openrouter | z-ai/glm-5.3-flash | PASS | PASS | PASS | PASS (0) | PASS (0) |
| lmstudio (extra) | qwen-agentworld-35b-a3b | ⛔ extra self-hosted group, not one of the required 8 | | | | |

- `documents(user)` read 185 before and 185 after; `connector_watches` read 3 before and 3 after.
- Every second-thread run called `search_documents` and found nothing.

## What was done

**Task 1** (registers, contract, docs, script):
- `e6d145897`: the contract fence. It has 6 cases, including a negative case that plants a renamed
  field. It is pinned in `BASELINE`.
- `89d235849`: the attachments docs page moved from stub to written, and inventory row A7 was
  updated. Docs coverage is OK.
- `9d5e6019b`: the ledger close.
  - All 23 phase-touched triples were re-derived, with the `(was …)` values kept.
  - The 8 FIRING rows in CLAUDE.md were updated in the same commit. The size gate is OK at 118,456
    characters.
  - `folderDisplay.ts` had no row, so one was added.
  - The board script was committed here too.
- `bec2e04f9`: the fixture-sizing fix and the `--axes` mode.

**Task 2:** I probed the stack and did not start it. All four ports are open. The 274 routes are
served (403, not 404). Migration 203's columns are present.

**Task 3** (everything that does not need a browser):
- the board;
- the G-4 API probe;
- the 4-axis API rows: multi-tool, parallel-thread and long-message all PASS;
- the D-18 static and API halves, both PASS.

## Deviations from Plan

1. **[Directive] I did not re-run the full gates.** The vitest count gate, the backend baseline
   and tsc are recorded verbatim from the orchestrator's merged-tree run. The backend failed-SET
   diff was not re-captured. The count is 71 = base, and this plan touched no backend source.
2. **[Rule 1 - Bug] The fixture size loop.** reportlab buffers its output until `save()`, so the
   first `--fixtures` run produced a 3.8 MB PDF from 400 pages. The page count is now derived from
   `min_bytes`, and the floor is asserted. The probe ran on the fixed version and produced a
   335 KB file.
3. **[Scope, by orchestrator] The browser halves were not driven.** The 4-axis rows were measured
   through the API instead of in Chrome. Bug and seed routing (step 8) were not done.
4. **[Rule 3] Run logs are committed as `.txt`.** The repo ignores `*.log`.
5. **`--axes` and `--fixtures` modes** were added to the board script beyond the plan's
   `--roster` and `--run`.

## Known Stubs

None.

## Threat Flags

None. The board, probe and axes runs are local-only: `_assert_local_db` and `assert_localhost_only`
run first. They use per-request model and provider. The evidence carries no bearer tokens and no
signed URLs; only the download's byte count and sha256 are recorded. No production write was made.

## OWED

1. The Chrome halves of G-4 #1-#4 and the D-18 live half (orchestrator).
2. Bug and seed routing.
3. Operator sign-off.
4. In production, apply migration 202 and then 203 before the backend deploys.
5. Run `get_advisors(security)` after the apply. The MCP was not available to this executor.
6. The pre-274 orphaned bucket bytes (an observation).
7. A full count-gate re-run to read the new pin. Expected: pinned total 9196 across 424 files.
8. `graphify update .`, left to the orchestrator because `graphify-out/` is shared and already
   dirty.

## Commits

| Commit | Message |
|---|---|
| e6d145897 | test(274-05): promote contract fence — backend models vs attachment client, saved/already literal, prefix regex lockstep |
| 89d235849 | docs(274-05): attachments page written — chat-only files, Save to Library, delete keeps the saved copy |
| 9d5e6019b | docs(274-05): hot-file ledger close — 23 phase-touched triples re-derived, folderDisplay.ts row added; board script |
| bec2e04f9 | feat(274-05): board script — size the >256 KB fixture by page count; --axes mode for the 4-axis API rows |
| 21a8b9dd7 | test(274-05): planted-fact board 8/8, G-4 API halves, 4-axis rows, D-18 static + API audit |
| d1356cd71 | test(274-05): run logs as committable text (the .log originals are gitignored) |

## Self-Check: PASSED

- FOUND: the board script, the contract fence, 274-VALIDATION.md, 274-UAT-LOG.md, `board-summary.json`, the probe JSON and the
  axes JSON.
- FOUND: all six commits listed above.
- STATE.md and ROADMAP.md were not modified (the orchestrator owns them).

## Orchestrator close-out (2026-10-05)

- **Chrome halves driven** (G-4 #1 local + cloud, #2, #3 incl. D-13/D-14, #4, D-18 live): all PASS — `274-VALIDATION.md` §6.
- **Defect F-1 found in G-4 #3 and fixed in-phase (TDD, by path):** the panel Files row's file name measured 0 px wide behind a
  full-path pill. Commits `26089e0c1` (test) → `6a7db8b79` (fix), `c82b7b237` + `e486ab8af` (tests) → the stacked-slot +
  display-name fix. Name 0 → 64 px live; 463/463 targeted tests; tsc 66 (= base).
- **Routing:** `BUG-260905-01` → `closed` (verified_closed_by names §6.1/§6.3/§6.5); `SEED-247` → `answered`.
- **Operator sign-off:** "approved" (2026-10-05). Deferred with re-open triggers (not built here): F-1 residual (FileRow sub-line),
  F-2 (upload response lacks `created_at`, pre-existing), F-3 (agent note hands the model the prefixed name).
- **Schema-drift gate:** bypassed with `GSD_SKIP_SCHEMA_CHECK=true` — migration 203 was applied to local Postgres by direct SQL
  (CLAUDE.md forbids `supabase db push`), verified twice, `full-schema.sql` regenerated (`cca177109`). **Production apply of 202 →
  203 is OWED and operator-gated.**

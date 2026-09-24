---
phase: 266-expert-knowledge-in-a-real-org
plan: 05
subsystem: experts / live proof + closeout
tags: [experts, rls, tenancy, uat, PACK-18, PACK-19, PACK-20, SEED-304]
status: PARTIAL — Tasks 1-3 done; Task 4 (operator browser check) at checkpoint; Task 5 (closeout) pending
requires:
  - "266-01..04 merged; migration 195 applied locally; full-schema.sql regenerated (d517606ba)"
provides:
  - "backend/tests/integration/test_266_two_org_fence.py — real-RLS two-org fence (single-org subject, non-owner positive control, two resolver plants)"
  - "266-UAT-LOG.md rows SC#1, SC#2, SC#3a/b/c + control, SC#4 revenue/refusal/flip, each with its own SQL"
  - "fix: expert install Retry hands the ingest path a string document id"
  - "SEED-314 (chat rows stamped with the oldest org), SEED-315 (Retry bypasses the ingest queue)"
affects: [266-VERIFICATION, SEED-304]
key-files:
  created:
    - backend/tests/integration/test_266_two_org_fence.py
    - .planning/phases/266-expert-knowledge-in-a-real-org/266-UAT-LOG.md
    - .planning/phases/266-expert-knowledge-in-a-real-org/evidence/00..09 (10 files)
    - .planning/seeds/SEED-314-chat-rows-stamped-with-the-oldest-org-not-the-active-one.md
    - .planning/seeds/SEED-315-expert-install-retry-bypasses-the-ingest-queue.md
  modified:
    - backend/tests/unit/test_260_financial_analyzer_conversation.py (docstring only)
    - backend/tests/unit/test_266_install_idempotency.py (+1 case, +import json)
    - backend/app/services/expert_install_service.py (Rule 1 fix, 1 line + comment)
decisions:
  - "Phase base PHASE_BASE = 522e7b4fc (parent of the first 266 code commit; the base 266-01 used)"
  - "Fresh users created via the public GoTrue signup (anon key from GET /public-config); backend/.env is deny-listed, so no service-role key was used"
  - "SC#3a driven on /documents/{id}/content and /chunks + the list GET, because GET /documents/{id} does not exist (405)"
  - "F-1 fixed under Rule 1 (the shipped Retry path failed live); F-2/F-3 recorded as seeds, not fixed (import_service / run_producer out of scope by plan)"
metrics:
  duration: "~70 min so far"
  completed: "partial, 2026-09-24"
  tasks: "3 of 5 (Task 2 satisfied by the orchestrator's measurement)"
---

# Phase 266 Plan 05: live proof + closeout — PARTIAL Summary (checkpoint at Task 4)

The Financial Analyzer's knowledge is now proven reachable in a real org and contained there. Two freshly
signed-up users in two fresh orgs installed it. Each copy landed in its own org, completed, with 3/3 chunks
embedded. A second install changed nothing. A user whose only org is A cannot read or retrieve B's copy,
while B's member can. The Expert's answer ("$124.5 million, +18.2%") is backed by `search.query` document ids
that join to the active org. When a two-org user switches to B, the cited document's org flips to B. The drive
also found that the install **Retry** path failed live. That is fixed and re-proved in-process, but the running
server still has the old code until a restart. It also found two deferred defects, planted as SEED-314/315.

## Tasks

| # | Task | Commit(s) | Status |
|---|------|-----------|--------|
| 1 | Two-org RLS fence + test_260 relabel | `ce9fead99` | done |
| 2 | Stack up | — (orchestrator measurement, re-probed) | satisfied |
| 3 | Live drives SC#1-SC#4 | `30ea8fc8a` (RED, F-1) · `a0c1b0ea6` (fix, F-1) · `8c5ee6c71` (log/evidence/seeds) | done |
| 4 | Operator browser check | — | **CHECKPOINT** |
| 5 | Closeout (override, SEED-304, registers, PROD-PARITY, final gates) | — | **pending — continuation agent** |

## Task 1: evidence

`./venv/Scripts/python.exe -m pytest tests/integration/test_266_two_org_fence.py tests/unit/test_260_financial_analyzer_conversation.py -q -rs`
→ **`13 passed`**, no skip line (6 fence cases + 7 relabelled test_260 cases). The fence file alone gave `6 passed`.
Cleanup was verified after the run: `266-fence-%` folders 0, documents 0, `expert_installs` 0, `phase-163-%`
users 0.

What the fence asserts, per the plan:
- S's `org_members` set equals exactly `{org_A}`, and T's equals exactly `{org_B}`, before every leg
  (`grep '== {fence\["org_a"\]}'` shows 3 sites plus the dedicated precondition test).
- Every RLS leg runs under `open_user_conn` with an `assert_auth_uid` preflight.
- The embedding dimension is read from `pg_attribute`/`format_type` (`vector(1536)`), never hard-coded.
- The positive control is T, a non-owner org-B member, so B's copy is visible to T through the shared folder,
  not through ownership. This is stronger than the plan's "org B's user".

**Base-resolver RED** (explicit-path restore, no blanket reset):

| step | `expert_service.py` md5 | result |
|---|---|---|
| phase version (HEAD) | `9353193402f264cc930fa821d24c53f4` | — |
| `git show 522e7b4fc:backend/app/services/expert_service.py > …` | `5d0a89736fed2bfde71fa3d28efe4145` | **`3 failed, 3 passed`** |
| `git checkout HEAD -- backend/app/services/expert_service.py` | `9353193402f264cc930fa821d24c53f4` (identical) | `6 passed` |

The three failures were:
- leg 3: `assert [] == [UUID('c9cf4a…')]`, because the base resolver ignores installs;
- the install-row plant: `the cross-org folder was not stripped by the strict loop`;
- the SYSTEM_USER_ID-folder plant: `assert UUID('4f74cc1d-…') not in [UUID('4f74cc1d-…')]`, so the base resolver ADMITTED org B's system-owned folder into an org-A caller's scope.

The base md5 differs from 266-01's recorded `fa4bbc42…` only because `git show` writes the LF blob, while
`git checkout` (autocrlf) writes CRLF.

**test_260 relabel:** the module docstring now opens with "DISPATCHER WIRING ONLY", explains why the file
proves nothing about PACK-05, and points to the fence and the UAT log. The original docstring is kept verbatim
below it. `git diff 522e7b4fc -- …test_260… | grep "^-" | grep -v "^---" | grep -v '"""\|^-\s*#'` prints
nothing. The one removed line is the old opening `"""` line, which is re-quoted inside the new docstring.

## Task 2: evidence (satisfied)

Measured by the orchestrator and re-probed here:
- `GET /health` → `200`, and unauthenticated `GET /experts/installs` → `403`.
- `Get-NetTCPConnection -LocalPort 8000 -State Listen` shows exactly one owner, pid `83984`, started
  `2026-09-24T19:43:05Z`.
- ⚠ The server was started with `uvicorn --reload`, yet pid 83984 kept that start time across later edits to
  `expert_service.py` (the Task 1 plant/restore) and `expert_install_service.py` (the F-1 fix). Reload does not
  fire on this box. Every drive therefore ran on the code as merged at 19:43Z.

## Task 3: evidence

All rows and their SQL are in `266-UAT-LOG.md`, and the raw transcripts are in `evidence/00`–`09`.
Model/provider: `deepseek` / `deepseek-v4-flash`, the app default (`app_settings`), registry-backed, sent per
request.

| Row | Verdict | Key evidence |
|---|---|---|
| SC#1 | PASS | doc `731bfa9a-…`: org A, `completed`, `chunk_count 3`, embedded 3/3; folder org A, `is_org_shared`; `expert_installs` org A, `installed_by` U1; ingestion via the queue (job `0bcf94ea-…` completed) |
| SC#2 | PASS | `(documents, chunks, folders, installs) = (1, 3, 1, 1)` before and after the second install; `max(updated_at)` unchanged |
| SC#3a | PASS | U1 → B's copy `/content` 404, `/chunks` 404, list excludes it; U1's own copy 200 |
| SC#3-control | PASS | U2 → B's copy `/content` 200, `/chunks` 200 (3 chunks) |
| SC#3b | PASS | no Expert: every `search.query` id joins to org A; B's id is absent |
| SC#3c | PASS | Expert active: same result; 0 non-A ids across U1's whole pre-flip history |
| SC#4-revenue | PASS | regexes match `'$124.5 million'` / `'+18.2%'`; the audited doc is org A; chunk 0 carries `$124.5` and `+18.2%` under `($M)` |
| SC#4-refusal | PASS | declines, names what the scope holds, invents no policy; two `search.query` rows with 0 ids |
| SC#4-flip | PASS | U1 added to B, `X-Org-Id: B`: cited doc `06f16045-…`, org B; membership removed and re-read |

U1 and U2 each had exactly one `org_members` row at SC#3 time (quoted in the log). A scan of the phase
directory for the JWT header prefix matches only `266-05-PLAN.md`'s own acceptance text. No evidence file
contains a token or password.

**266-03's retry question, answered by measurement:** a real Retry's storage PUT to the existing key returns
`409 Duplicate`, so the re-drive always takes the **no-job direct-splice fallback**. No `ingestion_jobs` row is
created, which is planted as SEED-315. Before the fix, that branch also crashed (F-1).

## Deviations from Plan

**1. [Rule 1 - Bug] The install Retry path failed live (`Object of type UUID is not JSON serializable`).**
- **Found during:** Task 3, while probing 266-03's flagged retry route on org B's copy (planted
  `status='failed'`).
- **Issue:** `_redrive_failed` passed the asyncpg row, whose `id` is a `UUID`, to `_enqueue_or_splice`. After the
  409, the fallback hands `doc["id"]` to `splice_document`, and a JSON payload refused the UUID. The document was
  left `failed` with its chunks already deleted. The unit fixture `_doc()` used string ids, so the suite was blind
  to this.
- **Fix:** `doc={**row, "id": doc_id}` (a string), plus a comment naming the measurement. RED
  `test_iv_b_a_real_asyncpg_row_with_uuid_ids_is_handed_on_with_a_string_id` failed with
  `re-drive handed a UUID id to the ingest path`, then went GREEN. The four `test_266_install_*` suites gave
  `57 passed`.
- **Live re-proof:** in-process, because the server does not reload. The fixed `install_expert` ran against the
  same local DB, storage and embeddings, with `BackgroundTasks` executed: 409 → direct splice → `completed`,
  chunks 3, embedded 3. Org B's copy is restored (`evidence/08`).
- **Files modified:** `backend/app/services/expert_install_service.py`, `backend/tests/unit/test_266_install_idempotency.py`.
- **Not done:** the re-drive through the running server. That needs an operator backend restart. See the
  checkpoint.

**2. [Rule 3 - Blocking] There is no `GET /documents/{id}` route** (405, measured). SC#3a was driven on
`GET /documents/{id}/content` and `/chunks` (both 404 for U1, 200 for U2) plus the list endpoint.

**3. [Rule 3 - Blocking] `backend/.env` is deny-listed.** Users were created through the public GoTrue signup
with the anon key served by `GET /public-config`, not through the admin API with the service-role key. This
matches "freshly signed-up user" more closely.

**4. Scope additions (records, not code):** SEED-314 and SEED-315 were planted for findings F-3 and F-2. Neither
file is in the plan's `files_modified`. `check-seeds-register.cjs` passes (`322/322 parsed, 0 duplicate ids`).

## Findings recorded (see 266-UAT-LOG.md § Findings)

- **F-1:** the install Retry failed live. **Fixed** (deviation 1).
- **F-2 → SEED-315:** a Retry never reaches the ingest queue (storage 409 leads to the direct splice).
- **F-3 → SEED-314:** in the flip, retrieval honoured `X-Org-Id: B`, but `threads`, `messages` and `runs.org_id`
  were stamped **A** by `autofill_org_id_by_owner`. Metering and org history attribute a two-org user's work to
  the wrong org.
- **F-4:** a freshly signed-up org has `subscription_tier = NULL`, so a new org cannot install until an operator
  sets a tier.

## Pending — for the continuation agent (Task 5)

- Record the operator's Task 4 reply verbatim as UI-1..UI-4 in `266-UAT-LOG.md`.
- After the operator restarts the backend, re-drive the Retry **through the server**. Plant `status='failed'` on
  U2's doc `06f16045-…` via local SQL, `POST …/install` as U2 with `X-Org-Id` B, then expect `completed` with 3/3
  embedded. Append the result to F-1. U2's credentials are in the session scratchpad `drive_state.json`. If that
  file is gone, sign up a fresh user the same way.
- Add `backend/app/services/expert_install_service.py` to the register re-derivation. It is already in Task 5's
  list, and it now carries the F-1 fix.
- STATE.md OV-266-01 (D-266-16). SEED-304: SC#3 and SC#4 are all PASS, so it becomes `answered`. Registers,
  266-PROD-PARITY.md, and the five final gates. The backend baseline gate MUST run, because a backend source file
  changed in this plan.
- Local DB state left behind on purpose: U1/U2/U3/U4 and their orgs (enterprise tier, set by SQL; prior tier
  NULL), two installs (A, B), and U1's 4 test threads. U1's temporary B membership was removed and re-read.

## Known Stubs

None.

## Threat Flags

None. No new network surface. The fix changes the type of one argument on an existing internal call.

## Self-Check: PASSED (partial scope)

- `backend/tests/integration/test_266_two_org_fence.py`, `266-UAT-LOG.md`, `evidence/00`–`09`, SEED-314 and
  SEED-315 are present.
- Commits `ce9fead99`, `30ea8fc8a`, `a0c1b0ea6` and `8c5ee6c71` are present on `develop` (`git log --oneline c8308cecd..HEAD`).
- Nothing was written to production: no Supabase MCP call was made.

# 266 UAT Log — live proof of PACK-18 / PACK-19 / PACK-20

Drives by Claude (plan 266-05, Task 3) against the LOCAL stack: backend `http://localhost:8000` (one
listener, pid 83984, started 2026-09-24 19:43:05Z, after every 266 backend merge), vite
`http://localhost:5173`, Postgres `127.0.0.1:54322`, local GoTrue `127.0.0.1:54321`. Every row carries
its own request and its own SQL. Raw transcripts are under `evidence/` (`00`–`09`). Helper scripts, tokens
and passwords lived only in the session scratchpad, never in the repo. Headers below are quoted without
`Authorization`.

**Model / provider for every chat row:** `deepseek` / `deepseek-v4-flash`, the app's configured default
(`app_settings.llm_provider` / `llm_model`), registry-backed (`MODEL_CAPABILITIES`, `capability_source:
registry`). Sent per request in the `POST /threads/{id}/messages` body. No global setting was changed.

**Evidence rule (D-266-17):** retrieval is proven by joining `audit_log` `search.query`
`metadata->'document_ids'` to `documents.org_id`. `audit_log.org_id` is never cited (it is autofilled by an
unordered trigger).

## Preflight (Task 2 — stack up, measured by the orchestrator and re-probed)

- `curl http://localhost:8000/health` → `200`; `curl http://localhost:8000/experts/installs` (no auth) →
  `403`, so the new route exists (not 404).
- `Get-NetTCPConnection -LocalPort 8000 -State Listen` → exactly one owner, pid `83984`.
- ⚠ The backend runs `uvicorn --reload`, but the worker was NOT restarted by file changes on this box
  (pid 83984 kept its 19:43:05Z start time across two later edits to `expert_service.py` /
  `expert_install_service.py`). So every row below ran on the code as merged at 19:43Z, and the
  `fix(266-05)` in finding F-1 is NOT in the running server until the operator restarts it.

## Fixtures (all LOCAL)

| who | user_id | org (only membership at SC#3 time) | how |
|---|---|---|---|
| U1 `uat266-u1-25ada3@example.test` | `7b43cd2c-21e7-4a66-8a36-2fa3793551b0` | A `0eb0cb6d-2858-46fa-ac92-1a2a99b9bfcf` (org-admin) | public `POST /auth/v1/signup` with the anon key from `GET /public-config`; `handle_new_user` created the personal org |
| U2 `uat266-u2-25ada3@example.test` | `3dce4e6b-e31b-4fe6-8b06-511781e08837` | B `1fd7000d-adc2-477a-89d8-877d0e367376` (org-admin) | same |

- Both orgs were created with `subscription_tier = NULL` (recorded prior value). Set on the LOCAL DB:
  `UPDATE organizations SET subscription_tier='enterprise' WHERE id IN (A, B)` (finding F-4).
- `backend/.env` is blocked by a deny rule, so no service-role key was used for user creation. Users were
  created through the public signup endpoint, which is also the more faithful "freshly signed-up user".

## Integration fence (Task 1) — `backend/tests/integration/test_266_two_org_fence.py`

`pytest tests/integration/test_266_two_org_fence.py tests/unit/test_260_financial_analyzer_conversation.py -q -rs`
→ **`13 passed`, 0 skipped** (6 fence + 7 relabelled test_260). Against the base resolver
(`git show 522e7b4fc:backend/app/services/expert_service.py`): **`3 failed, 3 passed`**: leg 3
(`assert [] == [A folder]`), the install-row plant (no `EXPERT_MEMBER_CROSS_ORG_STRIPPED`), and the
SYSTEM_USER_ID-folder plant (`UUID('4f74cc1d-…') not in [UUID('4f74cc1d-…')]`, admitted). Details in
266-05-SUMMARY.md.

## Rows

### SC#1 — fresh org install lands in THAT org, completed, embedded — **PASS**

Request: `POST /experts/00000000-0000-0000-0000-000000000259/install` headers
`{'X-Org-Id': '0eb0cb6d-2858-46fa-ac92-1a2a99b9bfcf'}` → `202`
`{"install":{"state":"installing","folder_id":"1e441bd0-e82e-4eb0-b5de-b69f9d0f983c",…}}`. Polled
`GET /experts/…0259` every 5 s → `ready` at the 2nd poll (~15 s).

```sql
SELECT d.id AS doc_id, d.filename, d.org_id, d.status, d.chunk_count, count(c.*) AS chunks,
       count(c.*) FILTER (WHERE c.embedding IS NOT NULL) AS embedded,
       count(c.*) FILTER (WHERE c.org_id = d.org_id) AS chunks_in_doc_org,
       f.id AS folder_id, f.org_id AS folder_org, f.is_org_shared, f.name AS folder_name
FROM documents d JOIN folders f ON f.id=d.folder_id LEFT JOIN document_chunks c ON c.document_id=d.id
WHERE d.folder_id = (SELECT folder_id FROM expert_installs
                     WHERE org_id='0eb0cb6d-2858-46fa-ac92-1a2a99b9bfcf'
                       AND expert_bundle_id='00000000-0000-0000-0000-000000000259')
GROUP BY d.id, d.filename, d.org_id, d.status, d.chunk_count, f.id, f.org_id, f.is_org_shared, f.name;
```
```
{"doc_id": "731bfa9a-74bb-4f6f-9d15-891f94fabb48", "filename": "acme_q3_2026_financial_report.md",
 "org_id": "0eb0cb6d-2858-46fa-ac92-1a2a99b9bfcf", "status": "completed", "chunk_count": 3, "chunks": 3,
 "embedded": 3, "chunks_in_doc_org": 3, "folder_id": "1e441bd0-e82e-4eb0-b5de-b69f9d0f983c",
 "folder_org": "0eb0cb6d-2858-46fa-ac92-1a2a99b9bfcf", "is_org_shared": true,
 "folder_name": "Financial Reports & Filings"}
```
```sql
SELECT org_id, installed_by, status, folder_id, corpus_version, error FROM expert_installs
WHERE org_id='0eb0cb6d-2858-46fa-ac92-1a2a99b9bfcf';
```
```
{"org_id": "0eb0cb6d-…", "installed_by": "7b43cd2c-21e7-4a66-8a36-2fa3793551b0", "status": "installed",
 "folder_id": "1e441bd0-…", "corpus_version": "9bbb510c6038217f57deb84ea9265559a3e4180fe40a00fcb73619ece4c8e757", "error": null}
```
Every org column = A (the X-Org-Id sent); `status completed`; `chunk_count 3 > 0`; `embedded 3 = chunks 3`.
The document is owned by the installer (`user_id = U1`), not by a system user. **Ingest route: the worker
queue** — `ingestion_jobs` row `0bcf94ea-…` `status completed`, `org_id` A. Evidence:
`evidence/01-sc1-install-u1.txt`, `evidence/02-sc2-reinstall-u1.txt` (head).

### SC#2 — second install into the same org changes nothing — **PASS**

```sql
SELECT (SELECT count(*) FROM documents WHERE org_id=A) AS documents,
       (SELECT count(*) FROM document_chunks WHERE org_id=A) AS chunks,
       (SELECT count(*) FROM folders WHERE org_id=A) AS folders,
       (SELECT count(*) FROM expert_installs WHERE org_id=A) AS installs,
       (SELECT max(updated_at) FROM documents WHERE org_id=A) AS docs_max_updated_at;
```
```
BEFORE: {"documents": 1, "chunks": 3, "folders": 1, "installs": 1, "docs_max_updated_at": "2026-09-24 19:53:10.168732+00:00"}
POST /experts/…0259/install {'X-Org-Id': A} -> 202 {"install":{"state":"ready",…}}
AFTER:  {"documents": 1, "chunks": 3, "folders": 1, "installs": 1, "docs_max_updated_at": "2026-09-24 19:53:10.168732+00:00"}
identical: True
```
Evidence: `evidence/02-sc2-reinstall-u1.txt`.

### SC#3 memberships (recorded at SC#3 time)

```sql
SELECT m.user_id, u.email, m.org_id, m.role FROM org_members m JOIN auth.users u ON u.id=m.user_id
WHERE m.user_id = ANY(ARRAY['7b43cd2c-…','3dce4e6b-…']::uuid[]);
```
```
{"user_id": "7b43cd2c-…", "email": "uat266-u1-25ada3@example.test", "org_id": "0eb0cb6d-…" (A), "role": "org-admin"}
{"user_id": "3dce4e6b-…", "email": "uat266-u2-25ada3@example.test", "org_id": "1fd7000d-…" (B), "role": "org-admin"}
```
One row each: U1 is org A only, U2 is org B only. U2 installed into B first (`ready`; B's copy
`06f16045-f301-4ca4-826d-4e9c86a6cf1d`, completed, 3/3 embedded, every org column = B, job
`103c04c8-…` completed): `evidence/03-sc3-install-u2.txt`.

### SC#3a — U1 cannot read B's copy directly — **PASS**

⚠ Deviation: there is no `GET /documents/{id}` route (`405 Method Not Allowed`, measured,
`evidence/04-sc3-fence-live.txt`). The single-document reads that exist were driven instead:

| request (U1, `X-Org-Id: A`) | status |
|---|---|
| `GET /documents/06f16045-…/content` (B's copy) | **404** `{"detail":"Document not found"}` |
| `GET /documents/06f16045-…/chunks` (B's copy) | **404** `{"detail":"Document not found"}` |
| `GET /documents` (list) | 200, n=1, contains B's doc **False**, contains A's doc True |
| `GET /documents/731bfa9a-…/content` (A's own copy, non-vacuity) | 200, contains `$124.5` |

Evidence: `evidence/05-sc3a-direct-read.txt`.

### SC#3-control — U2 (org B member) DOES read B's copy — **PASS**

`GET /documents/06f16045-…/content` `{'X-Org-Id': B}` → **200** (contains `$124.5`); `/chunks` → **200**,
3 chunks; `GET /documents` → contains B's doc True, A's doc False. Evidence: `evidence/05-sc3a-direct-read.txt`.

### SC#3b — U1 chat with NO Expert retrieves only org A — **PASS**

Thread `08edf31a-a525-49ce-98d4-aa571e34359f`; `POST /threads/08edf31a-…/messages` `{'X-Org-Id': A}`
body `{"content": "What was ACME Corp's Q3 2026 revenue and its year-over-year growth?", "model":
"deepseek-v4-flash", "provider": "deepseek"}` → `201`; run `5f65042f-…` `completed`.

```sql
SELECT a.created_at, a.metadata->>'query_text' AS query_text, d.id AS doc_id, d.org_id AS doc_org, d.filename
FROM audit_log a CROSS JOIN LATERAL jsonb_array_elements_text(a.metadata->'document_ids') x(doc)
JOIN documents d ON d.id = x.doc::uuid
WHERE a.action_type='search.query' AND a.user_id = '7b43cd2c-…' AND a.created_at > '2026-09-24T19:56:14.299379+00:00'
ORDER BY a.created_at;
```
```
{"created_at": "2026-09-24 19:56:20.126097+00:00", "query_text": "ACME Corp Q3 2026 revenue year-over-year growth",
 "doc_id": "731bfa9a-…" (A's copy), "doc_org": "0eb0cb6d-…" (A)}
```
One `search.query` row in the window, with 1 id. Every `doc_org` = A; B's doc id `06f16045-…` never appears.

### SC#3c — U1 chat WITH the Financial Analyzer retrieves only org A — **PASS**

Thread `6ee8750b-d0c7-49ab-839b-4ee86e0ad520`; `PATCH /threads/6ee8750b-…` `{"active_expert_id":
"00000000-0000-0000-0000-000000000259"}` → 200; same question, same model → run `6e3628bb-…` `completed`.
Same SQL with window `> '2026-09-24T19:56:36.145729+00:00'` →
`{"created_at": "2026-09-24 19:56:42.030827+00:00", "doc_id": "731bfa9a-…", "doc_org": "0eb0cb6d-…" (A)}`.
Every `doc_org` = A; B's doc never appears.

Across U1's whole history before the flip (including one aborted first attempt of SC#3b, thread
`c7b6db85-…`, whose driver crashed on its own evidence query, not on the product):
`SELECT count(*) FILTER (WHERE d.org_id <> A) … AND a.created_at < '2026-09-24T19:58:57Z'` → **0**.
Evidence: `evidence/04-sc3-fence-live.txt`.

### SC#4-revenue — the answer cites the org's own copy — **PASS**

Thread `6ee8750b-…` (org A, Financial Analyzer active), run `6e3628bb-…`. Full assistant text:

> ACME Corp reported **Q3 2026 total revenue of $124.5 million**, up **+18.2% year-over-year** from
> $105.3 million in Q3 2025 [2].
>
> A few related highlights from the same statement of operations [2]:
> - **Gross Profit:** $79.9M, +21.4% YoY (gross margin expanded to 64.2%)
> - **Operating Income (EBIT):** $31.7M, +40.9% YoY
> - **Net Income:** $24.8M, +40.9% YoY
> - **Operating Cash Flow:** $29.1M, +36.6% YoY
>
> Source: **acme_q3_2026_financial_report.md** — Condensed Consolidated Statement of Operations (Unaudited)

- `re.search(r"\$124\.5\s*(M\b|million)", text)` → `'$124.5 million'`
- `re.search(r"\+?18\.2\s*%", text)` → `'+18.2%'`
- `search.query` join (window `19:56:36Z .. 19:58:22Z`): one id, `731bfa9a-…`, `doc_org` = A = the X-Org-Id sent.
- Retrieved chunk (`SELECT … FROM document_chunks c WHERE c.document_id = ANY(ARRAY['731bfa9a-…']) AND
  c.content LIKE '%$124.5%' AND c.content LIKE '%+18.2%%'`): `document_id=731bfa9a-… org_id=A chunk_index=0`,
  lines `| Financial Metric | Q3 2026 ($M) | Q3 2025 ($M) | YoY Change (%) |` and
  `| **Total Revenue** | **$124.5** | $105.3 | **+18.2%** |`. The literal `$124.5M` is not in the corpus
  (C-7); the model composed "$124.5 million" from `$124.5` under the `($M)` header.

Evidence: `evidence/06-sc4-answer-refusal-flip.txt`.

### SC#4-refusal — out-of-scope question declined, nothing invented — **PASS**

Same thread, `POST /threads/6ee8750b-…/messages` `{'X-Org-Id': A}` body `{"content": "What is the employee
vacation policy?", "model": "deepseek-v4-flash", "provider": "deepseek"}` → run `e2f85a41-…` `completed`:

> I couldn't find any information about an employee vacation policy in your documents. The only document in
> this folder and its subfolders is:
>
> - **acme_q3_2026_financial_report.md** — ACME Corporation's Q3 2026 financial results and Form 10-K report
>
> That document covers financial statements (statement of operations, balance sheet, cash flow) and risk
> factors — it does not contain HR or employee-benefit content. Searches for "vacation," "paid time off,"
> "PTO," and "annual leave" returned no matches in this scope.
>
> If you have an HR policy document elsewhere, you'd need to add it to this folder or ask about it in a scope
> that includes it.

`search.query` rows in the window: two, `n_ids = 0` each (`"employee vacation policy paid time off"`,
`"human resources employee benefits vacation days annual leave"`); the document_ids join returns no rows. No
policy was fabricated and nothing from the corpus was cited as an answer.

### SC#4-flip — a two-org user switched to org B cites org B's copy — **PASS** (with finding F-3)

1. `INSERT INTO org_members (org_id, user_id, role) VALUES ('1fd7000d-…' (B), '7b43cd2c-…' (U1), 'member')`
   (LOCAL). `SELECT user_id, org_id, role FROM org_members WHERE user_id='7b43cd2c-…'` → A `org-admin`, B `member`.
2. `POST /threads` `{'X-Org-Id': B}` → thread `3bbde354-4940-4888-811d-4d416f98dd68`; PATCH
   `active_expert_id = …0259` → 200; same revenue question → run `c350e0aa-…` `completed`. Answer: "total
   revenue of $124.5 million, up +18.2% year-over-year"; regexes → `'$124.5 million'`, `'+18.2%'`.
3. `search.query` join (window `> 19:58:57.167838Z`): one row, `doc_id 06f16045-…` (B's copy),
   **`doc_org` = `1fd7000d-…` (B)** = the X-Org-Id sent. U1's earlier rows all joined to A (SC#3b/c), so the
   cited org flips with the active org, and neither the retired seed org nor the other org can pass.
4. `DELETE FROM org_members WHERE org_id=B AND user_id=U1` (LOCAL) → re-read: A `org-admin` only.

Evidence: `evidence/06-sc4-answer-refusal-flip.txt`.

## Findings

- **F-1 (FIXED in this plan, `fix(266-05)`) — the install Retry path was broken live.** Planted a failed
  corpus doc in org B (`UPDATE documents SET status='failed', error_message='266-05 planted failure
  (retry-route probe)'`); `GET /experts/…0259` then showed `state failed`, cause = that message, as
  designed. Pressing Retry (`POST …/install`) deleted the chunks and then failed:
  `error_message = "Object of type UUID is not JSON serializable"`, chunks 0, no new job
  (`evidence/07-retry-route-probe.txt`). Cause: `_redrive_failed` handed the asyncpg row, whose `id` is a
  `UUID`, to `_enqueue_or_splice`; its direct-splice fallback passed that to `splice_document`. The unit
  fixture used string ids, so it could not see it. RED `test_iv_b_…` → fix (`doc={**row, "id": doc_id}`)
  → re-driven IN-PROCESS with the fixed installer against the same local DB/storage/embeddings (the live
  server does not reload, see Preflight): storage PUT `409 Duplicate` → direct splice → `completed`,
  chunks 3, embedded 3, one chunk org (`evidence/08-retry-fixed-inprocess.txt`). Org B's copy is restored.
  ~~⚠ The running server still has the pre-fix installer until the operator restarts it.~~
  **UPDATE 2026-09-25 — re-driven THROUGH THE SERVER: PASS.** The operator restarted the backend. The single
  `:8000` listener is pid `89432`, started `2026-09-24T21:21:59Z`, which is after the fix commit `a0c1b0ea6`
  (`2026-09-24T20:03:56Z`). Both times were measured with `Get-Process` and `git log`. Planted
  `UPDATE documents SET status='failed', error_message='266-05 planted failure (server re-drive)' WHERE
  id='06f16045-f301-4ca4-826d-4e9c86a6cf1d'` (LOCAL). `GET /experts/…0259` then read `state failed`, with the cause
  equal to the planted message. As U2, `POST /experts/…0259/install` `{'X-Org-Id': '1fd7000d-…' (B)}` returned
  `202 {"install":{"state":"installing",…}}`, and the poll then read `state ready`. The doc AFTER was `status
  completed`, `chunk_count 3`, `error_message null`, chunks 3, embedded 3. All three chunks have `org_id` B and
  `created_at 2026-09-24 21:33:15Z`, 5 s after the POST at 21:33:10Z, so they were rebuilt rather than left
  over. ⚠ `documents.updated_at` did not move (19:54:14Z), because neither the plant nor the splice touches it.
  That is why the chunk `created_at` is the proof and `updated_at` is not. The job list is unchanged: only the
  first install's `103c04c8-…` exists. The server Retry, too, took the direct-splice fallback (F-2 / SEED-315,
  now confirmed on the live server). Evidence: `evidence/10-retry-through-server.txt`.
- **F-2 → SEED-315 — a Retry never reaches the ingest queue.** Measured in both probes: the re-drive's
  storage PUT to the existing key returns `409 Duplicate`, so it takes the no-job direct-splice fallback
  (no queue retries, no lease recovery, nothing in the Ingestion tab). The first install uses the queue
  (job rows `0bcf94ea-…`, `103c04c8-…`). `import_service.py` not edited, by plan.
- **F-3 → SEED-314 — chat rows are stamped with the oldest org.** In SC#4-flip, retrieval honoured
  `X-Org-Id: B`, but `threads.org_id`, both `messages.org_id` and `runs.org_id` for thread `3bbde354-…`
  read **A**: the `autofill_org_id_by_owner` triggers guessed. The plan's "chat stamps the validated
  X-Org-Id onto the run" holds for the run's retrieval context, not for the run row. `run_producer.py` is
  byte-unchanged (D-266-11).
- **F-4 — a freshly signed-up org has `subscription_tier = NULL`** (U1, U2, U3 all measured `None`), so a
  new org cannot install an Expert until an operator sets its tier. Set by SQL here, as the plan allows.
  Same fact as the recorded "2 of 2 prod orgs had a NULL tier" (Phase 258).

## `run_producer.py` (D-266-11)

`git diff --quiet 522e7b4fc HEAD -- backend/app/services/run_producer.py` → exit 0 (`run_producer-unchanged`).

## JWT scan

`grep -rn` for the JWT header prefix over this phase directory matches only `266-05-PLAN.md` itself (the
acceptance criterion's own text, lines 180 and 259). No evidence file and no line of this log contains a
token.

## UI rows (Task 4 — operator)

~~Pending the operator's browser check (Task 4). Recorded verbatim here by Task 5 as UI-1..UI-4.~~

The operator ran the check on 2026-09-25, at `http://localhost:5173`. ⚠ **The orchestrator simplified the plan's four
steps into three action-based tests before handing them to the operator.** So this section records exactly what
was run and what was not. A step that was not run is marked **OWED**, never PASS.

Operator's words, verbatim: first reply *"all passed except for I did not see from Financial Analyzer if i am
not mistaken"*; after the fix, *"shows now"*.

| Row | Plan step | Verdict | What was seen |
|---|---|---|---|
| **UI-1** | 1. As an org-admin whose org had not installed: Install → Installing… → Start Scoped Chat with Expert, without reloading | **PASS** | Operator: "all passed". The footer moved through the states with no reload. |
| **UI-2** | 2. The invite is blocked while installing (the reason line shows and the Expert does not activate) | **OWED — NOT RUN** | This step was left out of the simplified steps. The behaviour is covered only by unit tests (the ComposerExpert / inviteGate suites). It was never checked live, so it is recorded as owed, not passed. |
| **UI-3** | 3. The Library folder shows "from Financial Analyzer" | **FAIL → FIXED → PASS** | First check: the operator did not see the note. The orchestrator measured the cause: the note lived ONLY in the tooltip of the small "G" pill in `NavRow.tsx`. The operator chose "a small grey line under the folder name". RED `c5b5fdaa9` (`FolderNode.test.tsx`: the note is visible without hover): 1 failed / 19 passed. GREEN `2c2c09540`: `NavRow` gains one optional `caption` prop, and omitting it leaves the row unchanged; `FolderNode` passes the caption on shared folders. FolderNode + ingestion + LibraryPage suites: 195/195. Operator re-check: **"shows now"**. |
| **UI-4** | 4. Non-manager member | **PASS (ready-org case) · OWED (not-installed case)** | A regular member saw **Start Scoped Chat with Expert** and no Install button, because the org had already been installed by UI-1. The not-installed line for a non-manager ("An org admin needs to install…") was **not checked live**. It is unit-tested only, so it is owed. |

No disabled button, blank, "undefined" or raw error string was reported in any state.

**Finding (UI-3): hover and presence assertions stayed green over a note nobody could see.** The four `FolderNode`
tests that 266-04 shipped found the provenance text only after a simulated hover. So they passed while the words
were invisible at rest, which is exactly what the operator reported. **Lesson: where the words are the
deliverable, assert what is visible at rest, not what a tooltip can reveal.** The RED test in `c5b5fdaa9`
asserts the caption without any hover. It is the same class of defect as "presence assertions cannot see content
drift", one register over.

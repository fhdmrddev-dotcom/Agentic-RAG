# Stack Research

**Domain:** Scheduled, permission-aware, multi-source document ingestion at scale — added to a shipped FastAPI + Supabase + connector platform
**Milestone:** v4.0 Connected Knowledge
**Researched:** 2026-09-04
**Confidence:** HIGH on the recommendations (every one is grounded in a file in this repo plus a live version check); MEDIUM on two clearly-marked provider details.

---

## ⭐ The headline: v4.0 needs **ZERO new Python packages**

Every one of the six axes in the question resolves to something this repo **already ships**. That is not a
convenient coincidence — it is what the v3.9 connector architecture was built for, and the binding v4.0
constraint (*"a watched source must be DATA, not code"*) is only achievable if the answer stays inside the
existing transport, parser and claim primitives.

| Axis | The temptation | What actually applies | New package? |
|---|---|---|---|
| Microsoft Graph (OneDrive/SharePoint) | `msgraph-sdk` 1.62.0 | raw REST through `security/egress.send_pinned_http` — the pattern `cloud_storage.py` already uses for Drive | **No** |
| Google Drive | `google-api-python-client` 2.200.0 | `cloud_storage._list_google_drive_files` already exists and already talks Drive v3 through the binder | **No** |
| MCP file surface | an MCP SDK | `services/mcp_client.py` (480 L, `list_tools` / `call_tool`, egress-validated) | **No** |
| Email / mailbox | `talon`, `email-reply-parser`, `mail-parser`, `O365` | `services/email_extraction_service.py` (Phase 203) — RFC822 parse, **quoted-reply stripping**, attachments-as-children with caps, threading headers | **No** |
| Durable job queue | `arq` / `dramatiq` / `celery` / `pgmq` | the shipped `db/schedules.claim_due_schedules` pattern: `FOR UPDATE SKIP LOCKED` + in-transaction advance, on `asyncpg` | **No** |
| Embedding batch + fallback | LangChain (**banned**), `tenacity` | `tiktoken` (installed) for the token budget, `services/circuit_breaker.py` for the trip | **No** |
| Content hashing | `xxhash` / `blake3` | `hashlib.sha256` — it is already the dedup key, enforced by a UNIQUE INDEX | **No** |

**What v4.0 *does* need is not packages.** It needs (a) new rows in existing registries, (b) ~4 new
`ALLOWED_HOST_SUFFIXES` egress keys, (c) 2–3 SQL migrations, and (d) ~5 env knobs registered in the
Phase-157 deploy artifacts under the same-commit parity rule. That list is in
[§ What v4.0 actually adds](#what-v40-actually-adds) below.

---

## Recommended Stack

### Core Technologies — all already installed

| Technology | Version (in `backend/requirements.txt`) | Purpose in v4.0 | Why it is the right answer here |
|---|---|---|---|
| `httpx` | `>=0.28.0` (installed) | The ONE transport for Drive, Graph, Gmail and Graph-mail | Every outbound connector byte in this app goes through `security/egress.send_pinned_http`, which wraps httpx with **DNS pinning, an allow-list, explicit redirect refusal (`follow_redirects=False`) and a decompression-safe `max_bytes` cap**. A vendor SDK owns its own transport and would bypass all five. This is not a preference — `cloud_storage.py:252` records that a raw `httpx.AsyncClient` on the Drive path *was* the CR finding that created the `drive_read` key. |
| `asyncpg` | `>=0.29` (installed) | The durable ingestion job queue | `db/schedules.py:264-340` already implements exactly the claim semantics a job queue needs, on this driver, and `scheduler_service.py`'s header records **why it needs no leader election and no Redis coordination**. Copying a proven in-repo pattern beats importing an unproven external one. |
| `tiktoken` | `>=0.12.0` (installed) | Token budgeting for embedding batches | OpenAI's embeddings endpoint caps a request at **300,000 tokens summed across all inputs** — a batcher that counts only *array length* will still 400. `tiktoken` is the encoder the app already uses for the context window. |
| `hashlib` (stdlib) | — | `content_hash` for the preview's *already here* split | `documents.py:620` computes `sha256(raw)` and migration `043` puts a **partial unique index on `(user_id, content_hash, folder_id)`**. The v4.0 preview MUST look up this exact column with this exact value, or the *already here* arm is a different question from the one the DB answers. |
| `redis` | `>=5.2,<6` (installed) | Rate-limit tokens + per-connection poll leases — **not** the job queue | Redis stays what `CLAUDE.md` says it is: a best-effort buffer. Durable job state belongs in Postgres, where RLS and the audit ledger live. |
| `croniter` | `>=3.0.0` (installed) | Watch cadence | The shipped scheduler already parses cadence with it (`models/schedule.py`). SC#1 demands the **shipped** scheduler, so the cadence vocabulary is already chosen. |
| `openai` | `>=2.0.0` (installed) | Embeddings, incl. every OpenAI-compatible endpoint | `openai_service.resolve_embedding_endpoint` already routes OpenAI / Ollama / LM Studio / any OpenAI-compatible base URL through **one** SDK. The "provider fallback" is an *endpoint list*, not a new client. |

### Supporting: what already ships that v4.0 must call, not re-write

| Module | What it already does | v4.0 integration point |
|---|---|---|
| `backend/app/security/egress.py` | `send_pinned_http(capability, method, url, …, allowed_host=, max_bytes=)`; `ALLOWED_HOST_SUFFIXES` keyed by capability; refuses 30x with `EgressRefused("redirected")` | **Every** adapter's `list` and `read` call. New capability keys (below) are the only change. |
| `backend/app/services/cloud_storage.py` | `_list_google_drive_files` (Drive v3 `files.list`, `q`, `pageToken`, `fields`) + `_fetch_google_drive_file` (metadata → export-or-`alt=media`, 25 MB cap) | The Drive adapter is a **generalisation** of these two functions, not a new file. `fetch_cloud_file`'s `NotImplementedError` branch is literally where the Graph adapter plugs in. |
| `backend/app/services/mcp_client.py` | `list_tools` / `call_tool` over JSON-RPC 2.0, `validate_mcp_destination`, 2 MB response cap, explicit `auth_scheme` | The MCP-file adapter: `list` → a `list_*`-shaped tool, `read` → a `read_*`-shaped tool. |
| `backend/app/services/email_extraction_service.py` | `parse_eml_bytes` / `parse_msg_bytes` → `ParsedEmail{message_id, in_reply_to, references, attachments}`, `strip_quoted_replies`, `format_email_text_for_retrieval`, `MAX_ATTACHMENTS_PER_EMAIL=50` | **The whole email shape answer.** Both mailbox adapters fetch RFC822 bytes and hand them here. |
| `backend/app/services/oauth_service.py` | `_PROVIDER_META` — and **`"microsoft"` already exists at `:104`** with `Files.Read.All` + `offline_access` + PKCE on the `/common` tenant | The Graph adapter's auth is already declared. It needs scopes *added*, not invented. |
| `backend/app/db/schedules.py` | `claim_due_schedules` — `FOR UPDATE SKIP LOCKED` + in-transaction advance | The template for `claim_due_ingestion_jobs`. Copy the *transaction shape*, including the un-advanceable-row deactivation. |
| `backend/app/services/circuit_breaker.py` | trip/reset on a failing dependency | The embedding-provider fallback's trip condition. |
| `backend/app/services/connectors/grants.py` | 92 L, the grant-time gate; denies on a MISSING key by design (T-211-05) | A watch is a **read grant**. It must arrive ungranted and be allowed per-tool like everything else. |

---

## 1 · Microsoft Graph (OneDrive / SharePoint)

### Verdict: **raw REST through `send_pinned_http`. Do NOT add `msgraph-sdk`.**

**Versions checked live on PyPI 2026-09-04:** `msgraph-sdk` **1.62.0** (2026-09-02) · `msgraph-core` **1.5.1** ·
`azure-identity` **1.25.3** · `msal` **1.38.0**. All current and healthy — the rejection is architectural, not
a maintenance judgement.

**Why raw REST, in this repo specifically:**

1. **`msgraph-sdk` owns its own HTTP stack (Kiota + `httpx` + a middleware pipeline) and its own auth
   (`azure-identity` credential objects).** Calls made through it would not pass `validate_destination`,
   would not be DNS-pinned, would not refuse redirects, and would not be capped by `max_bytes`. The
   `cloud_storage.py:252` comment records what happened the *last* time a Google path used a raw client:
   *"no scheme check, no allow-list, no DNS pin, no redirect refusal, no size cap — on a path that
   downloads a file a person names."* Adopting the SDK re-creates that hole with a nicer API on top.
2. **`azure-identity` + `msal` model auth as a credential object that mints and caches its own tokens.**
   This app's tokens live encrypted in `connector_tokens` and are minted by
   `oauth_refresh_service.get_fresh_access_token(connection_id)`. Two token caches that disagree is exactly
   the failure class `mcp_client.py`'s `auth_scheme` docstring was written about.
3. **The surface actually needed is four endpoints.** Listing children, listing a site's drives, reading
   an item's metadata, and downloading one file. Against that, `msgraph-sdk` pulls ~10 packages
   (`microsoft-kiota-*` × 5, `azure-core`, `azure-identity`, `msal`, `msal-extensions`, `std-uritemplate`)
   into a Coolify image that must also build PyMuPDF, camelot, and sentence-transformers.

### ⚠ The load-bearing finding: `/content` is a **302**, and this app refuses redirects

`GET /drives/{id}/items/{id}/content` returns **`302 Found`** with a `Location` pointing at a
**pre-authenticated URL on a different host** — Microsoft's own example is
`https://b0mpua-by3301.files.1drv.com/…`, and for SharePoint it is a `*.sharepoint.com` host.
([driveItem: get content](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content))

`egress.py:746/769` sets `follow_redirects=False` **twice, explicitly**, and raises
`EgressRefused("redirected")` on a 30x. **So the obvious call fails by design.** The adapter must instead:

```
GET /v1.0/drives/{drive-id}/items/{item-id}?$select=id,name,size,file,@microsoft.graph.downloadUrl
→ then a SECOND send_pinned_http to the returned URL under a SEPARATE egress key
```

This is not a workaround; it is the documented path Microsoft recommends for exactly this reason (CORS
preflight prohibits the 302). It costs **one extra round trip per file** and it means the download host is
`*.1drv.com` / `*.sharepoint.com`, **not `graph.microsoft.com`** — which is why it needs its own key.

### Auth: what is different about Graph

| Concern | Fact | Consequence for us |
|---|---|---|
| Provider entry | **Already shipped** — `oauth_service.py:104`, `/common` tenant, PKCE on, `prompt=consent`, scopes `openid offline_access User.Read Files.Read.All` | Auth is a **scope edit**, not a new provider. This is the v3.9 architecture paying off. |
| Tenant | `/common` accepts work/school **and** personal Microsoft accounts | Keep `/common`. A tenant-specific authority (`/{tenant-id}`) is a BYO-OAuth field, not a code branch. Note: personal accounts have **no SharePoint**, so `Sites.Read.All` is silently useless there — the availability probe (`google/availability.py` pattern) should say so rather than returning a bare 403. |
| `Files.Read.All`, delegated | **Admin consent NOT required** (verified: [graphpermissions.merill.net](https://graphpermissions.merill.net/permission/Files.Read.All)) | A user *can* self-consent — but most enterprise tenants disable user consent tenant-wide. **Plan the UX for "your admin must approve this", and make the refusal say so.** Confidence: HIGH on the metadata, MEDIUM on "your tenant will actually allow it". |
| `Files.Read.All`, **application** | **Admin consent required** | Do not go here. Application permissions read *every* file in the tenant with no signed-in user — that is precisely the ACL flattening `SEED-210` fenced, and it is incompatible with the operator's chosen Option 3. |
| SharePoint document libraries | Need `Sites.Read.All` (delegated, admin consent not required) | **Add it.** Without it the adapter sees OneDrive only and a SharePoint folder map fails at list time. |
| Mailbox (§4) | `Mail.Read` (delegated) or least-privileged `Mail.ReadBasic` | **Add `Mail.Read`** — `Mail.ReadBasic` cannot read the body, which is the whole point. |
| Refresh | `offline_access` already present; Microsoft requires `scope` on the refresh POST | `oauth_refresh_service.py` already POSTs `scope`; verify against the Microsoft arm at implementation. |
| ⚠ Scope widening | `oauth_service.py:50` already records the rule: *"a wider scope here would grant more than any code can use"*, and a row authorised before a scope was added does **not** have it | Adding `Sites.Read.All` / `Mail.Read` **requires a re-consent** for every existing Microsoft connection, and `availability.py`'s `scope_missing` state is how the UI must say so. That is a designed-for case, not a bug. |

### Delta queries — a **FUTURE fact**, deliberately not a dependency

`driveItem: delta` and `message: delta` both exist in Graph v1.0
([delta query overview](https://learn.microsoft.com/en-us/graph/delta-query-overview)). Their real cost,
recorded so a future phase does not discover it:

- **Token expiry is not a fixed number for Outlook entities** — it depends on the size of an internal
  server-side delta-token cache, so a token can die at any time.
- **`410 Gone` + an empty `$deltatoken` means "restart with a full sync"** — the adapter must retain a full
  crawl path anyway, so delta is *additive*, never a replacement.
- **Replays are explicitly documented as possible**, so the consumer must be idempotent on
  `content_hash` regardless.
- OneDrive/SharePoint use `token=latest`, not the `$deltatoken=latest` that Entra resources use.

**Net:** every property delta needs (idempotent consume, full-crawl fallback, a cursor column) is a
property polling needs anyway. Ship polling; leave a nullable `delta_cursor TEXT` column in the
watched-source table and nothing else. ⚠ And the screen still says **"checked every N minutes"** — the
binding constraint holds.

### Cheapest polling shape today

```
list:  GET /v1.0/drives/{drive-id}/items/{item-id}/children
       ?$select=id,name,size,lastModifiedDateTime,file,folder,parentReference,eTag
       &$top=200&$orderby=lastModifiedDateTime desc
read:  GET /v1.0/drives/{drive-id}/items/{item-id}?$select=@microsoft.graph.downloadUrl,name,size,file
       then GET <that url>  (separate egress key)
```

`$select` is doing real work: the default `driveItem` payload is large and the binder's `max_bytes` is a
hard cap, so an unselected list of 200 items is a *refusal*, not a slow request.

---

## 2 · Google Drive

### Verdict: **extend `cloud_storage.py`. Do NOT add `google-api-python-client`.**

**Versions checked live 2026-09-04:** `google-api-python-client` **2.200.0** (2026-09-01) ·
`google-auth` **2.57.1** (2026-09-04) · `google-auth-oauthlib` **1.4.1**. Current — again, the rejection is
architectural.

Same three reasons as Graph, plus a fourth that is specific and decisive: **the code already exists and
already goes through the binder.** `_list_google_drive_files` and `_fetch_google_drive_file` were
*hardened onto* `send_pinned_http` on 2026-08-31 as a CR finding. Introducing `googleapiclient.discovery`
would build a second, unpinned Drive client beside the pinned one — the "two parsers that disagree"
anti-pattern `google/availability.py` opens by refusing.

### Scopes: **nothing new is needed for reading**

`oauth_service.py:43` already grants **`https://www.googleapis.com/auth/drive.readonly`**, which covers
`files.list`, `files.get`, `files.export`, `files.get?alt=media` **and** `changes.list`/`getStartPageToken`.
No re-consent, no new scope, no admin approval. Drive is the **cheapest** of the four families for exactly
this reason — which is a good argument for it being the first adapter shipped.

⚠ One nuance: `drive.readonly` sees files the user can access, including **shared-with-me** items. A folder
map onto a shared drive additionally needs the shared-drive parameters below; it does **not** need a wider
scope.

### Cheapest polling shape today

```
GET https://www.googleapis.com/drive/v3/files
  q      = "'<FOLDER_ID>' in parents and trashed = false
            and mimeType != 'application/vnd.google-apps.folder'
            and modifiedTime > '<RFC3339 last_seen>'"
  fields = "nextPageToken, files(id,name,mimeType,size,modifiedTime,md5Checksum,version,parents)"
  orderBy= "modifiedTime desc"
  pageSize = 100                       # the API max; the shipped code caps at 100 already
  supportsAllDrives = true             # shared drives
  includeItemsFromAllDrives = true
  corpora = "drive" & driveId = "<id>" # only when the map targets a shared drive
```

Three things this shape buys that the shipped `_list_google_drive_files` does not yet do:

1. **`modifiedTime > '<cursor>'` is the whole poll optimisation.** It is a supported `q` term with
   `<, <=, =, !=, >, >=` ([Search for files](https://developers.google.com/workspace/drive/api/guides/search-files)),
   so a poll over an unchanged folder returns an empty page for one request. That is the honest
   "checked every N minutes" cost.
2. **`md5Checksum` is returned in the LIST response** for binary files — so the preview's *already here*
   split can often be answered **without downloading a single byte**. See §5 for exactly how far that goes
   (it is not the whole answer).
3. **`incompleteSearch`** must be read from the response. On a large shared-drive corpus Drive may return
   partial results; a watcher that ignores it silently under-reports, which is the worst possible failure
   for a preview screen that claims completeness.

The shipped list function currently **excludes folders unconditionally** and filters by `name contains`.
Both are attach-flow choices. Generalise the `q` construction into the adapter; keep the response-shaping
(`{id, name, mime_type, size, modified_at, …}`) exactly as it is, because that dict is already the shape
the generic contract wants.

### Google-native files: the export trap, already solved

`_fetch_google_drive_file` already handles `application/vnd.google-apps.document|spreadsheet` by exporting
to PDF. Two gaps to close in v4.0, both known:

- **`presentation` is missing** from the export branch (Slides), and so is `drawing`. Today they fall to
  `alt=media`, which returns a 403 for any Google-native type.
- **A Google-native file has no `md5Checksum` and no stable byte identity.** Its exported PDF bytes are
  **not** guaranteed reproducible across exports, so `sha256(exported_bytes)` can churn. Use
  `modifiedTime` + `version` as the change detector for native types and hash the export only to fill the
  column. This is a real, findable source of "the same Doc re-ingests every night".

### `changes.list` / `startPageToken` — FUTURE

Drive's delta is `changes.getStartPageToken` → `changes.list(pageToken)`, and it is **account-wide, not
folder-scoped** — you get every change the token can see and filter client-side to your mapped folders.
Page tokens do expire (Drive returns `410` and you re-acquire). Same verdict as Graph: leave the
`delta_cursor` column, ship polling.

---

## 3 · Durable ingestion job queue

### ⭐ Verdict: **a plain Postgres table with `FOR UPDATE SKIP LOCKED`, drained by a lifespan task in the existing uvicorn workers. This is unambiguously the fewest moving parts, and it is the option this repo has already debugged in production.**

Everything else on the menu adds either **a process** or **an extension**, and both are deployment-artifact
changes on a single-box Coolify target.

### The comparison, weighed against the real constraints

| Option | Version (live 2026-09-04) | New always-on process? | New infra dependency? | Verdict |
|---|---|---|---|---|
| **Plain PG table + `SKIP LOCKED`** | — (uses `asyncpg>=0.29`, installed) | **No** — lifespan task, same as `SchedulerService` | **No** | ✅ **RECOMMENDED** |
| `pgmq` (Supabase Queues) | ext `1.4.4` on Supabase; `tembo-pgmq-python` **0.10.0** (last release **2025-03-31**) | No | **Yes** — a Postgres extension that must exist in local CLI Postgres *and* cloud Supabase | ⛔ Reject |
| `arq` | **0.28.0** (2026-04-16) | **Yes** | Redis (have it) | ⛔ Reject |
| `dramatiq` | **2.2.1** (2026-09-02) | **Yes** | Redis or RabbitMQ | ⛔ Reject |
| `rq` | **2.12.0** (2026-08-30) | **Yes** (and it forks per job — poor fit for asyncio) | Redis | ⛔ Reject |
| `celery` | **5.6.3** (2026-03-26) | **Yes** (+ beat if scheduling) | Redis/AMQP | ⛔ Reject — heaviest option on the board |
| `procrastinate` | **3.9.0** (2026-06-20) | Yes (a worker; can be embedded, but it is a framework) | Postgres (have it) | ⚠ Closest runner-up |
| `pgqueuer` | **1.3.2** (2026-07-27) | Yes | Postgres (have it) | ⚠ Second runner-up |

### Why the plain table wins here, concretely

1. **The pattern already ships and its correctness argument is already written down.**
   `db/schedules.py:264-340` implements it, and `scheduler_service.py`'s module header states the property
   that matters: *"This loop can therefore run in **every** uvicorn worker with no leader election, no
   advisory lock of its own and no Redis coordination — which is the point: a leader-election scheme has a
   failure mode where the leader dies and nothing fires, and that failure is silent."*
   With `WORKER_COUNT=2` (and any future N) the claim is safe **by construction**.
   ⚠ Copy the *whole* transaction shape, including `db/schedules.py`'s un-advanceable-row rule: a job that
   cannot be advanced is **terminalised**, never left claimable, or it re-fires every tick forever.
2. **A separate worker process is a deploy-artifact change with teeth.** `docker-compose.prod.yml` would
   gain a fourth service; `deploy/onebox.env.example` would gain its knobs; `docs/OPERATOR.md` would gain a
   step; and `scripts/check-deploy-drift.sh` **hard-fails** on any unclassified new key. The compose file's
   own Phase-204 comment already made this call once, verbatim: *"NOT a separate compose service ON
   PURPOSE: it is a lifespan task inside the backend, so it scales with `WORKER_COUNT` and needs no leader
   — the claim is a database transaction."* v4.0 should not reverse a decision this repo made deliberately
   nine phases ago without a new reason, and there is none.
3. **RLS.** `CLAUDE.md`: *"All tables need Row-Level Security."* An `ingestion_jobs` table gets an owner
   policy like every other table. `pgmq` creates its queue tables in a `pgmq` schema outside that regime —
   which means the milestone whose entire premise is *the permission model just got harder* would put its
   job bodies (containing external file ids and folder paths) in the one place RLS does not reach.
4. **Local↔cloud parity is this project's #1 documented gotcha.** `pgmq` must be enabled on the cloud
   Supabase project *and* be present in the local Supabase CLI Postgres image. `CLAUDE.md`'s migration rule
   is *paste into the SQL editor* — an extension that is not installable that way, or whose version differs
   between local and cloud, is exactly the class of drift `docs/DEPLOYMENT-LESSONS.md` exists for.
   ([Supabase pgmq docs](https://supabase.com/docs/guides/queues/pgmq))
5. **Redis is declared best-effort here.** `CLAUDE.md`: *"Supabase Realtime is a best-effort hint, not a
   source of truth."* The same posture governs Redis in this codebase (run buffers, streams). Putting the
   only durable record of *"we owe this customer an ingest"* in Redis inverts that.

**The honest counter-argument, stated rather than hidden:** ingestion is **CPU-heavy** (PyMuPDF, camelot,
pdfplumber, sentence-transformers). Draining it inside the uvicorn workers means extraction competes with
request serving. Two things make this acceptable *today*: (a) it is already true — the shipped path is a
`BackgroundTask` in the same process, so v4.0 changes durability, not placement; (b) the mitigation is the
shipped one, `run_in_threadpool` per D-v2.5-01, plus a **concurrency cap** (`INGEST_MAX_CONCURRENT`)
which is the "cap" half of the milestone requirement anyway.

⭐ **Plant the re-open trigger rather than pretending the risk is absent:** *when p95 chat TTFB regresses
measurably while an ingest batch is draining, extract the drainer into a second process.* The table-based
queue makes that a **deployment** change with no code change — the same `claim → work → terminalise` loop
runs in a `python -m app.workers.ingest` entrypoint against the same table. That optionality is a further
argument for the table over any broker: **you can leave without a rewrite.**

### Shape (for the roadmapper — this is the migration, not the plan)

```sql
-- <NNN>_ingestion_jobs.sql
create table public.ingestion_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  org_id        uuid not null,
  source_id     uuid not null references public.watched_sources(id) on delete cascade,
  external_id   text not null,              -- Drive fileId / Graph itemId / message id
  status        text not null default 'queued',   -- queued|claimed|done|failed|cancelled
  attempts      int  not null default 0,
  max_attempts  int  not null default 3,
  claimed_at    timestamptz,
  claimed_by    text,                        -- worker/pid, for observability only
  run_after     timestamptz not null default now(),   -- retry backoff lives here
  last_error    text,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.ingestion_jobs (status, run_after) where status in ('queued','claimed');
create unique index on public.ingestion_jobs (source_id, external_id) where status <> 'done';
alter table public.ingestion_jobs enable row level security;   -- owner policy, per CLAUDE.md
```

Claim, mirroring `claim_due_schedules` exactly:

```sql
SELECT ... FROM ingestion_jobs
 WHERE status = 'queued' AND run_after <= now()
 ORDER BY run_after
 LIMIT $1
 FOR UPDATE SKIP LOCKED;
-- …and in the SAME transaction: UPDATE ... SET status='claimed', attempts=attempts+1, claimed_at=now()
```

⚠ **The in-transaction status flip is the load-bearing half**, exactly as `db/schedules.py:279` says of
`next_run_at`. `SKIP LOCKED` alone only prevents *simultaneous* claims. **Resume** is then free: a
`claimed` row older than a lease window is swept back to `queued` by the same loop — which is precisely how
`resume_stranded_workflows` already works in this repo.

---

## 4 · Email / mailbox

### ⭐ Verdict: **add no email library. Fetch RFC822 bytes and hand them to the shipped `email_extraction_service`. The mailbox is then a byte-shaped source like the other three.**

**Versions checked live 2026-09-04, all rejected:** `talon` **1.4.4** (last release **2017-08-24**) ·
`email-reply-parser` **0.5.12** (last release **2020-10-07**) · `mail-parser` **4.6.4** · `O365` **2.1.9**.
The first two are the canonical quoted-reply strippers and both are effectively abandoned; the second two
duplicate stdlib + shipped code.

### The fetch, per provider — both return the same bytes

| Provider | Call | Auth | New scope? |
|---|---|---|---|
| Gmail | `GET /gmail/v1/users/me/messages?q=…` → `GET /gmail/v1/users/me/messages/{id}?format=raw` (`raw` = base64url RFC822) | existing Google token | **No** — `gmail.readonly` already granted (`oauth_service.py:58`) |
| Graph mail | `GET /v1.0/me/mailFolders/{id}/messages?$select=id,receivedDateTime,internetMessageId` → `GET /v1.0/me/messages/{id}/$value` (**MIME**, verified: *"The MIME content begins with the `MIME-Version` header"*) | existing Microsoft token | **Yes** — add `Mail.Read` |

Both land on `parse_eml_bytes(raw)`. **One parser, two adapters, zero new code paths** — which is the
milestone's binding constraint satisfied on the axis most likely to break it.

### The SHAPE problem — flagged explicitly, as asked, and it is *mostly already solved*

`PROJECT.md` and `STATE.md` both warn that *"email is a second SHAPE smuggled in as a fourth provider."*
That warning is correct about the **product** decision and **over-stated about the code**. Measured:

| Shape problem | Status in this repo | What v4.0 still owes |
|---|---|---|
| **Quoted-reply duplication** | ✅ `strip_quoted_replies()` ships (`email_extraction_service.py:201`) and runs before chunking | Nothing. Do **not** add `talon`. |
| **Attachments-as-children** | ✅ ships, with `MAX_ATTACHMENTS_PER_EMAIL = 50` and `MAX_ATTACHMENT_BYTES = 25 MB`, and the caps live in the service *because `documents.py` parses the bytes a second time* | Make the watcher respect the **same** caps — a mailbox watch can amplify far harder than a manual upload. |
| **Threads** | ⚠ `ParsedEmail` carries `message_id`, `in_reply_to`, `references` — **and the v3.8 audit records that email thread dedup is "stored and read by nothing"** | ⭐ **This is the one real net-new decision.** |
| **No stable document boundary** | ⛔ open | ⭐ **A scope decision, not a library.** |

### The one decision the roadmapper must force

**What is one document — a message, or a thread?**

- **A message.** `internetMessageId` / `Message-ID` is globally unique and immutable; `content_hash` over
  the RFC822 bytes works unchanged; the shipped dedup index works unchanged; `strip_quoted_replies` already
  removes the duplication that makes per-message ingestion noisy. **Cost:** a 40-message thread is 40
  documents, and retrieval over it feels shredded.
- **A thread.** Matches how people think and how `SEED-212` frames transcripts. **Cost:** a thread has **no
  stable identity and no stable bytes** — it grows. Every new reply changes the document, so
  `content_hash` churns on every poll, `documents_dedup_idx` fires against the *previous* version, and the
  "already here / will be added" preview becomes a lie. It requires a supersede-and-re-embed lifecycle that
  does not exist today.

**Recommendation, one sentence:** ship **one message = one document**, store `thread_key` (normalised
`references[0] or in_reply_to or message_id`, plus Gmail's `threadId` / Graph's `conversationId` as an
adapter-supplied hint) as a **retrieval grouping column that finally gets READ** — which closes the v3.8
`stored and read by nothing` finding — and plant thread-as-document behind a trigger (*re-open when a real
tenant reports shredded thread recall*).

⚠ **And flag the size honestly at scoping:** a mailbox watch is the family most likely to be the one that
overruns. Drive/Graph/MCP-file are ~1 adapter each over shipped code; mail is 2 adapters plus a
document-boundary decision plus an amplification cap plus a PII surface that no other family has. **If the
milestone has to cut one family, this is the one** — and unlike the others, cutting it costs no
architecture, because the byte contract is identical when it returns.

---

## 5 · Content hashing / dedup

### Verdict: **`hashlib.sha256` over the exact bytes that get ingested. Change nothing. Add nothing.**

**What to hash — settled by the database, not by preference:**

`documents.py:620` computes `content_hash = hashlib.sha256(raw).hexdigest()` and migration
`043_documents_dedup_unique_index.sql` creates
`UNIQUE INDEX documents_dedup_idx ON documents (user_id, content_hash, folder_id) WHERE status != 'failed'`.

**The v4.0 preview's *"already here"* arm is a lookup against that column.** If the watcher hashes anything
other than what the upload path hashes — normalised text, extracted text, a provider-supplied checksum —
then a file uploaded by hand and the same file seen by the watcher produce **different** hashes, the
preview says *will be added*, the insert hits the unique index, and the job fails on a constraint that was
supposed to be the answer. **Byte-identical hashing is the interoperability contract with the shipped
upload path**, and it is why "bytes vs normalized text" is not actually an open question here.

`xxhash` **4.0.1** and `blake3` **1.0.9** are both current and both faster. **Do not add either.** SHA-256 at
~1–2 GB/s is nowhere near the bottleneck when the same 25 MB file just crossed the internet and is about to
be parsed by PyMuPDF; and swapping the algorithm invalidates every existing `content_hash` in the corpus.

### Streaming vs buffered — the API-not-filesystem interaction

⚠ **This app cannot stream-hash today, and that is a deliberate security property, not an oversight.**
`send_pinned_http` reads with `stream=True` internally but returns a `PinnedResponse` whose `body` is
`bytes`, capped by `max_bytes` and decompression-safe (`_decode_bounded`). The cap **is** the defence: the
`cloud_storage.py` comment records that an unbounded read was *"a memory exhaustion any Drive account could
trigger."*

So the shape is: **cap first, buffer, hash the buffer.** With `max_bytes = 25 MB` (matching the app's own
upload ceiling — *"a file this cannot fetch is a file it could not have ingested anyway"*) and a concurrency
cap on the drainer, peak memory is bounded at `INGEST_MAX_CONCURRENT × 25 MB`. **Set both knobs together**
— a queue cap without a byte cap is not a cap.

⛔ **Do not "fix" this by adding a streaming download path that bypasses the binder.** That is precisely the
regression the 2026-08-31 hardening closed. If ingesting >25 MB files ever becomes a requirement, the change
is a `max_bytes` raise plus a chunked-hash *inside* `egress.py` where the cap and the decompression guard
already live — one place, not per adapter.

### Provider-supplied checksums: a **pre-filter**, never the key

| Source | Cheap pre-download signal | Trustworthy as `content_hash`? |
|---|---|---|
| Google Drive | `md5Checksum` (in the `files.list` response), `version`, `modifiedTime` | **No** — wrong algorithm. ✅ Excellent as a "did this change since last poll" filter, and it is free in the list call. Absent on Google-native types. |
| Microsoft Graph | `file.hashes` — `quickXorHash` (OneDrive for Business / SharePoint) or `sha1Hash`/`sha256Hash` (personal OneDrive); plus `eTag` / `cTag` | **No** — inconsistent across tenants; `quickXorHash` is a Microsoft-proprietary algorithm with no Python stdlib support. Use `eTag`/`cTag` as the change signal. **Confidence: MEDIUM** — verify the hash facet against a live tenant before relying on any specific member. |
| MCP file surface | whatever the server chooses to expose — usually nothing | **No.** Assume no pre-filter exists; this adapter must download to know. |
| Mail | `internetMessageId` is immutable | Use it as the **identity**; still hash the RFC822 bytes for the column. |

**The rule to write into the contract:** provider metadata answers *"should I download this?"*;
`sha256(bytes)` answers *"have I already got this?"* Two different questions, and conflating them is how a
preview ends up lying in both directions.

---

## 6 · Embedding batching + provider fallback

### Verdict: **hand-rolled, ~60 lines, inside `openai_service.embed_texts`. No library. LangChain is banned and would be the wrong answer even if it were not.**

### Today's defect, measured

```python
# backend/app/services/openai_service.py:2129
def embed_texts(texts, model=None, user_settings=None):
    client = get_embedding_client(user_settings)
    response = client.embeddings.create(model=..., input=texts)   # ← every chunk, one request
    return [item.embedding for item in response.data]
```

One request, no batching, no retry, no fallback, **and it is synchronous** — called from
`embedding_service.py:123`, `multimodal_service.py:413` and `:888`. Three call sites, one function: the fix
lands in exactly one place and all three inherit it. That is the strongest possible integration point.

### The limits to batch against (verified)

| Provider | Max inputs/request | Max tokens/input | Max tokens/request |
|---|---|---|---|
| **OpenAI** `text-embedding-3-*` | **2048** | **8192** | **300,000 summed across all inputs** ([API reference](https://developers.openai.com/api/reference/resources/embeddings/methods/create)) |
| **Google** `gemini-embedding-*` | not published on the guide page — **treat as unknown** | **8192** ([Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings)) | not published |
| Ollama / LM Studio / OpenAI-compatible | server-dependent; typically far lower | model-dependent | server-dependent |

⚠ **The 300,000-token ceiling is the one that actually bites** and it is the one a naive batcher misses:
2048 chunks × 800 tokens = 1.6 M tokens, a `400` on a request whose array length was legal. **Batch on
BOTH axes** — and default conservatively (e.g. 96 inputs / 100k tokens) because the same code path serves
Ollama and LM Studio, whose real limits are much smaller and undiscoverable.

```python
MAX_INPUTS_PER_BATCH  = 96       # settings knob; ≤ 2048 for OpenAI, far lower for local servers
MAX_TOKENS_PER_BATCH  = 100_000  # settings knob; < 300_000 OpenAI hard ceiling
# count with tiktoken (installed); flush on whichever bound trips first;
# a single chunk over MAX_TOKENS_PER_INPUT is a NAMED refusal, never a silent truncation.
```

⭐ **Put these in `user_settings` / `app_settings`, not env** — `CLAUDE.md`: *"Settings live in
`user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only."*
`SettingsPage.tsx` already has the Retrieval section these belong beside.

### ⚠ The fallback constraint nobody states until it breaks: **dimension is global and immutable**

`document_chunks.embedding` is `vector(N)` for a **single** N (mig `002` created it at 1536; mig `008`
`ALTER`s the type and **sets the column to NULL**; `config.py:914` `embedding_dimensions: int = 1536`).
Two consequences that must be written into the fallback design:

1. **A fallback provider MUST emit the same dimension** or the INSERT fails. OpenAI's `dimensions` parameter
   and Gemini's `output_dimensionality` make matching *possible*.
2. ⛔ **Matching the dimension does not make the vectors compatible.** Different providers produce different
   vector spaces. A corpus half-embedded by OpenAI and half by Gemini has silently degraded recall with a
   green status everywhere — the worst failure mode this milestone could ship, on the milestone whose
   requirement is *filtered-vector recall at corpus scale*.

**So "embedding-provider fallback" must mean, in priority order:**

1. **Retry the same endpoint** with exponential backoff + jitter on `429` / `5xx` / timeout. This alone
   closes `BUG-260815-05` (*an embedding-provider 429 surfaces as "your documents returned nothing"*).
2. **Fail over to a different credential/endpoint for the SAME model** — a second OpenAI key, an Azure
   OpenAI deployment of the same model, an OpenAI-compatible mirror. Same vector space, safe.
3. **Trip `circuit_breaker.py` and PAUSE the queue with a named, user-visible refusal** — the ingestion
   jobs go back to `queued` with `run_after = now() + backoff`, which the durable queue from §3 makes free.
   ⭐ **This is the correct third arm, and a cross-provider vector swap is not.**

⛔ **Never** silently switch embedding *provider* mid-corpus. A deliberate provider change is the shipped
**re-embed job** (Phase 111.1), which exists precisely because this is a corpus-wide operation.

### Why not a library

LangChain is banned by `CLAUDE.md` and would in any case bring its own retry, its own batcher, its own
provider abstraction and its own opinion about dimensions — four things this app already decides for itself
in `resolve_embedding_endpoint`. `tenacity` **9.1.4** is the only credible small addition and it is still a
**no**: the app already owns `circuit_breaker.py`, and a second retry vocabulary beside it is the
"two parsers that disagree" pattern `google/availability.py` opens by refusing.

---

## Keeping the adapters thin — what would leak, and where the fence goes

The binding constraint is *one generic `list → read → hash → splice` contract, four thin adapters*. Here is
the precise inventory of what tries to leak, per family.

### The generic contract (the shared path — must contain NO vendor vocabulary)

```python
class SourceItem(BaseModel):        # Pydantic — CLAUDE.md rule
    external_id: str                # opaque to the shared path
    name: str
    mime_type: str | None
    size: int | None
    modified_at: datetime | None
    change_token: str | None        # md5Checksum | eTag | cTag | version — OPAQUE, compared for equality only
    parent_path: str | None

class SourceAdapter(Protocol):      # mirrors services/connectors/protocol.py
    async def list_items(self, source, cursor: str | None) -> tuple[list[SourceItem], str | None]: ...
    async def read_item(self, source, external_id: str) -> tuple[str, bytes, str]:  # (filename, bytes, mime)
        ...
```

`read_item`'s return triple is **deliberately identical to the shipped `fetch_cloud_file` signature** —
`tuple[str, bytes, str]`. The generic path then does `sha256(bytes) → dedup lookup → splice`, which is
byte-for-byte what `documents.py` already does for an upload.

### The leak table

| Family | What WILL leak into the shared path if unguarded | Where the fence goes |
|---|---|---|
| **Google Drive** | The `q` DSL (`'<id>' in parents and trashed = false`); `pageToken`; the **export-vs-`alt=media`** branch for `vnd.google-apps.*`; `md5Checksum`; `incompleteSearch`; `supportsAllDrives`/`corpora` | All of it inside `adapters/drive.py`. The shared path sees `SourceItem` + bytes. **The export decision is the sharpest leak risk** — the generic path must never learn what a Google-native MIME type is. |
| **Microsoft Graph** | `$select` / `$top` / `$orderby` OData; the **two-step `@microsoft.graph.downloadUrl` dance forced by the 302**; `driveId` vs `siteId` addressing; `file.hashes` variance; `eTag`/`cTag` | `adapters/graph.py`. ⚠ **The two-step download is the single biggest leak risk in the milestone** — if `read_item` returns a *URL* instead of *bytes*, the redirect problem is now the shared path's problem and every other adapter has to care. **`read_item` returns bytes. Always.** |
| **MCP file surface** | Tool *names* (`list_files`? `search`? `read_document`?) — an MCP server chooses its own; JSON-RPC envelopes; `list_tools` discovery | `adapters/mcp_file.py` + **a stored per-connection tool mapping** (`{list_tool, read_tool, arg names}`) which is **DATA on the connection row**, exactly as v3.9's `discovered_tools` + `tool_grants` already are. ⭐ **This is the family that proves the constraint** — if the MCP adapter needs code per server, the design has failed. |
| **Email** | `q=` (Gmail) vs `$filter` (Graph); `format=raw` base64url vs `$value` raw MIME; `threadId` vs `conversationId`; the message-vs-thread boundary | `adapters/gmail.py` + `adapters/graph_mail.py`, each returning **RFC822 bytes**. `parse_eml_bytes` is shared and already exists. `thread_key` is normalised **in the adapter**; the shared path stores an opaque string. |
| **All four** | Provider error bodies | ⭐ Already fenced by precedent: `google/_http.error_reason` returns only `error.status` + `details[].reason` because *"a Google error body echoes the request, which for Drive and Gmail is the person's own search query."* **Every new adapter needs the same discipline, and it must be one parser per provider — never a second one.** |

**The one-line test for the roadmapper:** *grep the shared ingest path for `google`, `drive`, `graph`,
`microsoft`, `gmail`, `mcp`, `mime`, `$select`, `alt=media`.* Any hit is a leak. That grep is cheap enough
to be an acceptance criterion.

---

## What v4.0 actually adds

### New egress capability keys (`security/egress.py → ALLOWED_HOST_SUFFIXES`)

| Key | Allowed host suffixes | Why a separate key |
|---|---|---|
| `graph_read` | `graph.microsoft.com` | Same reasoning the file records for `drive_read` vs `gmail_read`: a spec declares exactly one key, so the separation is greppable. |
| `graph_download` | `1drv.com`, `sharepoint.com` | ⭐ **Mandatory** — the pre-authenticated download URL is on a *different host*. Without this key the Graph adapter cannot read a single file. |
| `graph_mail_read` | `graph.microsoft.com` | Buys no host separation; buys `grep -c "graph_mail_read"` = *"what can read a mailbox?"* |
| *(reuse)* `drive_read`, `gmail_read` | `googleapis.com` | Already exist. **Nothing widens.** |

⚠ `graph_download`'s hosts are **supplied by a remote response**. Do not pass the returned URL's host as
`allowed_host=` — that would let the response choose its own destination. Pin it with the suffix list, so a
tampered `@microsoft.graph.downloadUrl` is refused.

### OAuth scope additions (`oauth_service.py → _PROVIDER_META["microsoft"]`)

Add `Sites.Read.All` (SharePoint document libraries) and `Mail.Read` (mailbox). Both are delegated,
neither requires admin consent in Entra's metadata — **but expect tenants to require it anyway.**
⚠ Existing Microsoft connections do not have these; `availability.py`'s `scope_missing` state is the
UI answer, and re-consent is the remedy.

**Google needs no scope change at all.** `drive.readonly` and `gmail.readonly` already ship.

### Migrations (numbered, `<digits>_name.sql`, pasted into the SQL editor per `CLAUDE.md`)

1. `watched_sources` — connection ref, external folder id, target `folder_id`, cadence, `last_polled_at`,
   `last_status`, **nullable `delta_cursor`** (reserved, unused), `is_active`. RLS on.
2. `ingestion_jobs` — the §3 shape. RLS on.
3. `watched_source_items` — `(source_id, external_id) → content_hash, change_token, document_id,
   last_seen_at`. This is what makes the three-way preview a **lookup** rather than a guess, and what makes
   *"a file removed at the source is NOT removed from the Library"* observable rather than silent.

### Env knobs (⚠ **same-commit** into `deploy/onebox.env.example` + `docker-compose.prod.yml` + `docs/OPERATOR.md`, or `scripts/check-deploy-drift.sh` hard-fails)

```
WATCHER_PROCESS_ENABLED=false          # OFF by default — mirrors SCHEDULER_PROCESS_ENABLED exactly
WATCHER_POLL_INTERVAL_SECONDS=300
INGEST_MAX_CONCURRENT=2                # the cap; pair it with the byte cap or it is not a cap
INGEST_MAX_ATTEMPTS=3
INGEST_CLAIM_LEASE_SECONDS=900         # older `claimed` rows sweep back to `queued` — this IS resume
```

Batch sizes are **settings rows**, not env — see §6.

---

## Alternatives Considered

| Recommended | Alternative | When the alternative would win |
|---|---|---|
| raw REST + `send_pinned_http` | `msgraph-sdk` 1.62.0 / `google-api-python-client` 2.200.0 | If this app had **no** egress binder and no OAuth token store. It has both, and they are security-bearing. |
| PG table + `SKIP LOCKED` | `procrastinate` 3.9.0 | If jobs needed cron, chaining, priorities, and a real admin UI. v4.0 needs claim/retry/resume — the 5% of a job framework this repo has already written. |
| PG table + `SKIP LOCKED` | `arq` 0.28.0 | If ingestion moved to a genuinely separate autoscaled fleet. On a **single Coolify box** the broker buys nothing and costs a service. |
| PG table + `SKIP LOCKED` | `pgmq` / Supabase Queues | If the queue were multi-consumer across services with visibility-timeout semantics. Here it costs an extension in the local↔cloud parity path and puts job bodies outside RLS. |
| stdlib `email` + shipped parser | `talon` 1.4.4 | Never, at those release dates — and `strip_quoted_replies` already ships. |
| `hashlib.sha256` | `blake3` 1.0.9 / `xxhash` 4.0.1 | If hashing were the bottleneck. It is not, and swapping invalidates every existing `content_hash`. |
| hand-rolled batcher | LangChain text splitters/embeddings | **Banned by `CLAUDE.md`.** Also wrong: it would own retry, batching and provider choice, all of which `resolve_embedding_endpoint` already decides. |
| `circuit_breaker.py` | `tenacity` 9.1.4 | If there were no in-repo breaker. There is. |

---

## What NOT to Use

| Avoid | Why, specifically | Use instead |
|---|---|---|
| `msgraph-sdk` / `azure-identity` / `msal` | Bypasses `send_pinned_http` (DNS pin, allow-list, redirect refusal, size cap) and duplicates the encrypted token store. ~10 transitive packages onto a Coolify image that already builds PyMuPDF + camelot + sentence-transformers. | `send_pinned_http` + `get_fresh_access_token` |
| `google-api-python-client` / `google-auth-oauthlib` | Same, **plus** it would be the *second* Drive client in a file whose comment records the first raw one as a CR finding. | Extend `cloud_storage.py` |
| `O365` 2.1.9 | A whole opinionated Microsoft object model for four endpoints; its own auth backend. | Four `send_pinned_http` calls |
| `talon` (2017) / `email-reply-parser` (2020) | Unmaintained **and** redundant — `strip_quoted_replies` ships and runs before chunking. | `email_extraction_service.strip_quoted_replies` |
| `mail-parser` 4.6.4 | Wraps stdlib `email`, which `parse_eml_bytes` already uses directly. | `parse_eml_bytes` |
| `celery` / `rq` / `dramatiq` / `arq` | Each needs an always-on worker process → a fourth compose service → `check-deploy-drift.sh` → `OPERATOR.md` → a Coolify service. `rq` forks per job, which fits an asyncio codebase badly. | `ingestion_jobs` + `SKIP LOCKED` |
| `pgmq` / `tembo-pgmq-python` 0.10.0 | A Postgres extension in the local↔cloud parity path (#1 documented gotcha); queue tables outside the RLS regime; the Python wrapper's last release is **2025-03-31**. | `ingestion_jobs` + `SKIP LOCKED` |
| Redis as the durable job store | Redis is declared best-effort infra here. The one durable record of *"we owe a customer an ingest"* must survive a flush. | Postgres |
| LangChain / LangGraph / `llama-index` | **Hard project rule.** | raw SDK + Pydantic |
| `blake3` / `xxhash` | Not the bottleneck; changing the algorithm invalidates `documents_dedup_idx`. | `hashlib.sha256` |
| `tenacity` | Second retry vocabulary beside `circuit_breaker.py`. | `circuit_breaker.py` + a backoff helper |
| **A webhook / push-notification receiver** | Drive `changes.watch` and Graph `subscriptions` both require a **public inbound HTTPS endpoint** — that is `SEED-013`/`SEED-195` Open Platform, explicitly a **separate milestone**. And the screen must say *"checked every N minutes."* | Polling |
| **Graph *application* permissions** (`Files.Read.All` app-only) | Reads every file in the tenant with no signed-in user. That is the ACL flattening `SEED-210` fenced, and it contradicts the operator's chosen Option 3. | Delegated only |
| **Following the Graph `/content` 302** | `egress.py` refuses 30x by design (`EgressRefused("redirected")`). "Just set `follow_redirects=True`" removes a security property to save one round trip. | `$select=@microsoft.graph.downloadUrl` + a second pinned call |
| **A streaming download that bypasses the binder** | Re-creates the exact unbounded-read hole the 2026-08-31 hardening closed. | Raise `max_bytes` *inside* `egress.py` if ever needed |
| **Cross-provider embedding fallback** | Same dimension ≠ same vector space. Silently degrades recall corpus-wide with a green status. | Retry → same-model alternate endpoint → **trip the breaker and pause** |

---

## Stack Patterns by Variant

**If the milestone must ship one adapter first:**
- **Google Drive.** Zero new scopes, zero new egress keys, and two-thirds of the code already exists in
  `cloud_storage.py`. It proves the generic contract at the lowest cost.

**If the milestone must cut a source family:**
- **Cut email.** It is 2 adapters + a document-boundary decision + an amplification cap + a PII surface no
  other family has. Drive/Graph/MCP-file are one shape; mail is a second. **And the byte contract is
  identical when it comes back**, so cutting it costs no architecture.

**If ingestion measurably degrades chat latency:**
- Run the same drain loop as a **second process** against the same `ingestion_jobs` table
  (`python -m app.workers.ingest`). Deployment change, zero code change. That optionality is itself an
  argument for the table over any broker.

**If a customer needs >25 MB source files:**
- Raise `max_bytes` **in `egress.py`**, where the cap and the decompression guard already live — never per
  adapter, and never by adding a bypass path.

**If a real tenant reports shredded thread recall:**
- That is the trigger to revisit message-as-document. `thread_key` will already be stored and read.

---

## Version Compatibility

| Package | Constraint | Note |
|---|---|---|
| `httpx>=0.28.0` | installed, unpinned upper | `supabase-py` + `openai` + `anthropic` + `langsmith` all support 0.28+. The Docling-era `<0.29` cap is gone (D-071.3-10). **Adding a vendor SDK would very likely reintroduce an httpx upper bound** — a further argument against `msgraph-sdk`. |
| `asyncpg>=0.29` | installed | Supports `FOR UPDATE SKIP LOCKED` and explicit transactions; already used by `db/schedules.py`. |
| `croniter>=3.0.0` | installed | Already the scheduler's cadence parser. |
| `tiktoken>=0.12.0` | installed | Encoder for the token-budget half of the batcher. |
| `openai>=2.0.0` | installed | `embeddings.create(dimensions=…)` available on `text-embedding-3-*`. |
| `redis>=5.2,<6` | installed | Unchanged role. |
| `supabase>=2.29.0` | installed | ⚠ `CLAUDE.md`: a major bump must re-verify `backend/tests/integration/test_supabase_*.py`. Nothing in v4.0 requires a bump. |
| pgvector column | `vector(N)`, N global (`config.embedding_dimensions=1536`) | ⭐ **The binding constraint on any embedding fallback.** |

**Installation:**

```bash
# backend/requirements.txt — NO CHANGES REQUIRED FOR v4.0.
# If a future phase disproves this, the burden is on that phase to state which
# security property of send_pinned_http the new package preserves.
```

---

## Sources

**In-repo (HIGH — read directly at HEAD on 2026-09-04):**
- `backend/app/security/egress.py` — `send_pinned_http` signature, `ALLOWED_HOST_SUFFIXES`, `follow_redirects=False` (`:746`, `:769`), `EgressRefused("redirected")`
- `backend/app/services/cloud_storage.py` — Drive v3 list + fetch through the binder; the 25 MB cap and its rationale
- `backend/app/services/oauth_service.py:104` — **the `microsoft` provider entry already exists** with `Files.Read.All` + `offline_access` + PKCE
- `backend/app/services/connectors/service_tools.py:39-97` — the granted Google scope set (`drive.readonly`, `gmail.readonly`, …)
- `backend/app/services/email_extraction_service.py` — `parse_eml_bytes`, `strip_quoted_replies`, attachment caps, `message_id`/`in_reply_to`/`references`
- `backend/app/db/schedules.py:264-340` — `claim_due_schedules`, the `SKIP LOCKED` + in-transaction-advance pattern
- `backend/app/services/scheduler_service.py` — "no leader election, no Redis coordination" rationale
- `backend/app/services/openai_service.py:2129` — `embed_texts` sending every chunk in one request; `resolve_embedding_endpoint`
- `backend/app/api/documents.py:620` + `supabase/migrations/043_documents_dedup_unique_index.sql` — `sha256(raw)` and `documents_dedup_idx`
- `supabase/migrations/002`, `008`, `034` + `backend/app/config.py:914` — the global `vector(N)` dimension
- `docker-compose.prod.yml`, `deploy/onebox.env.example`, `scripts/check-deploy-drift.sh` — the deploy-artifact parity surface
- `backend/app/services/mcp_client.py`, `docs/CONNECTOR-ARCHITECTURE.md` — the MCP-first verdict and the shipped client

**External (versions pulled live from the PyPI JSON API, 2026-09-04):**
`msgraph-sdk` 1.62.0 · `msgraph-core` 1.5.1 · `azure-identity` 1.25.3 · `msal` 1.38.0 ·
`google-api-python-client` 2.200.0 · `google-auth` 2.57.1 · `google-auth-oauthlib` 1.4.1 ·
`arq` 0.28.0 · `dramatiq` 2.2.1 · `rq` 2.12.0 · `celery` 5.6.3 · `procrastinate` 3.9.0 ·
`pgqueuer` 1.3.2 · `tembo-pgmq-python` 0.10.0 · `talon` 1.4.4 · `email-reply-parser` 0.5.12 ·
`mail-parser` 4.6.4 · `O365` 2.1.9 · `tenacity` 9.1.4 · `xxhash` 4.0.1 · `blake3` 1.0.9 — **HIGH**

**Official documentation (HIGH):**
- [driveItem: get content](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content) — the 302, the `@microsoft.graph.downloadUrl` workaround, the delegated/application permission table
- [Get message](https://learn.microsoft.com/en-us/graph/api/message-get) — `$value` returns MIME; `Mail.ReadBasic`/`Mail.Read`
- [Delta query overview](https://learn.microsoft.com/en-us/graph/delta-query-overview) — `driveItem`/`message` delta support, token expiry, `410 Gone` resync, documented replays
- [Search for files (Drive v3)](https://developers.google.com/workspace/drive/api/guides/search-files) — `q` terms, `modifiedTime` operators, shared-drive params, `incompleteSearch`
- [OpenAI embeddings API reference](https://developers.openai.com/api/reference/resources/embeddings/methods/create) — 2048 inputs / 8192 tokens per input / **300,000 tokens per request**
- [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings) — 8192-token input limit; **batch size not published**
- [Supabase pgmq](https://supabase.com/docs/guides/queues/pgmq) — requires enablement; Supabase's pinned extension version trails upstream

**MEDIUM confidence, flagged as such:**
- Graph `driveItem.file.hashes` membership (`quickXorHash` for OneDrive for Business/SharePoint vs `sha1Hash`/`sha256Hash` for personal) — **verify against a live tenant** before any code depends on a specific member.
- `Files.Read.All` delegated "admin consent: No" is Entra permission *metadata*; most enterprise tenants disable user consent, so **plan for admin approval as the default lived experience.**

---
*Stack research for: scheduled, permission-aware, multi-source ingestion at scale*
*Researched: 2026-09-04*

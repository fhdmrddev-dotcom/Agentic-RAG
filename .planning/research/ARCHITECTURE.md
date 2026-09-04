# Architecture Research

**Domain:** Scheduled, permission-aware, multi-source ingestion into an existing mature RAG platform (v4.0 Connected Knowledge)
**Researched:** 2026-09-04
**Confidence:** HIGH on everything read from source (file + line cited). Anything not read is marked **UNVERIFIED** inline.

> **Method note.** Every integration point below was read in the repository at HEAD (`develop`),
> not inferred from the milestone brief. Line numbers are from the working tree on 2026-09-04 and
> will drift; the *function names* are the stable handle. Where the hot-file ledger and my own
> re-derivation disagree on a line number, both are printed.

---

## Standard Architecture

### System Overview — what exists, and where the new work lands

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React)                                                             │
│  ┌────────────────┐ ┌──────────────────┐ ┌─────────────────────────────────┐ │
│  │ LibraryPage    │ │ ConnectionsTab   │ │ AutomationGroup                 │ │
│  │ 5 tabs, one    │ │ (settings/)      │ │ (ingestion/) — classification   │ │
│  │ reducer :100   │ │                  │ │ rules today                     │ │
│  │ ⊕ Sources tab  │ │ ⊕ visibility +   │ │ ⊕ watch-routing rules           │ │
│  │   (NEW)        │ │   watch door     │ │   (SAME engine)                 │ │
│  └────────────────┘ └──────────────────┘ └─────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│  API (FastAPI)                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────────────────┐ │
│  │ documents.py │ │ connectors.py│ │ library.py │ │ ⊕ api/sources.py  NEW  │ │
│  │ 11 routes    │ │ 1727 L       │ │ index facts│ │ watches · preview ·    │ │
│  │ ingest funnel│ │ ATTACH-01    │ │            │ │ jobs · lifecycle       │ │
│  └──────┬───────┘ └──────┬───────┘ └────────────┘ └───────────┬────────────┘ │
├─────────┼────────────────┼─────────────────────────────────────┼─────────────┤
│  SERVICES                                                                     │
│         ▼                ▼                                     ▼             │
│  ┌──────────────────────────────┐   ┌────────────────────────────────────┐  │
│  │ ⊕ services/ingest_splice.py  │   │ ⊕ services/sources/         NEW    │  │
│  │   NEW — the ONE splice        │◄──│   protocol · registry · cursor     │  │
│  │   mint_document_row()         │   │   drive · graph · mcp_file · mail  │  │
│  │   splice_document()           │   └──────────────┬─────────────────────┘  │
│  └───────────┬──────────────────┘                   │                        │
│              │ calls, unchanged                     │ uses                   │
│              ▼                                      ▼                        │
│  ┌────────────────────────────┐   ┌────────────────────────────────────────┐│
│  │ documents.ingest_document  │   │ connector_service.resolve_connection    ││
│  │   :2030 — THE FUNNEL       │   │ oauth_refresh_service.get_fresh_...     ││
│  │   (NOT moved this cycle)   │   │ mcp_client.list_tools / call_tool       ││
│  └────────────────────────────┘   │ security/egress.send_pinned_http        ││
│                                    └────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  POLL LOOPS — in-process, every uvicorn worker, DB-arbitrated          │  │
│  │  SchedulerService (SHIPPED, 204)   ⊕ WatchService   ⊕ IngestQueueSvc   │  │
│  │  claim_due_schedules()             claim_due_watches()  claim_jobs()   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│  POSTGRES (Supabase) — RLS on every table                                    │
│  documents · document_chunks · folders · classification_rules ·              │
│  connector_connections · workflow_schedules                                  │
│  ⊕ connector_watches · ⊕ connector_watch_items · ⊕ ingestion_jobs            │
│  DEFINER retrieval: match_document_chunks · keyword_search_chunks            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (verified, with the file that owns each)

| Component | Responsibility | Where it is today |
|---|---|---|
| The ingest funnel | text → scrub → chunk → embed → chunk INSERT → multimodal → metadata → classification → `status='completed'` | `backend/app/api/documents.py:2030` `ingest_document()` |
| The ingest wrapper | storage upload · 130 s wall-clocked extract · failure marking | `backend/app/api/documents.py:239` `_upload_pipeline()` |
| Document-row minting | mime normalisation · allow-list · size cap · `content_hash` · dedup · version cascade · 23505 catch | **inline in the `/upload` route**, `documents.py:568-705` — this is the thing that must be extracted |
| Retrieval | embed query → two DEFINER RPCs → RRF → dedup → rerank → enrich | `backend/app/services/retrieval_service.py` `search_documents()` |
| Visibility decision | ownership ∨ org-shared-folder, in FOUR SQL sites | `full-schema.sql:5452`, `:5501`, `:325`, `:296` |
| Outbound connector credential | resolve org-scoped, decrypt lazily, redacted repr | `connector_service.py:639` `resolve_connection()` → `ResolvedConnection` (`:211`) |
| Outbound adapter seam | `CAPABILITY` / `INPUT_SCHEMA` / `send` / `check`, closed registry with an import-time assert | `connectors/protocol.py` + `connectors/registry.py` |
| Egress binder | scheme · allow-list · DNS pin · redirect refusal · size cap, keyed per surface | `backend/app/security/egress.py` — `ALLOWED_HOST_SUFFIXES:242` |
| The proven claim loop | `FOR UPDATE SKIP LOCKED` + in-transaction claim-key advance | `backend/app/db/schedules.py` `claim_due_schedules()` |
| The proven poll loop | one instance per uvicorn worker, no leader election, no Redis | `backend/app/services/scheduler_service.py` `SchedulerService` |
| Rule matching | `ViewFilter` AST → bool, pure, no eval, no DB | `backend/app/services/classification_matcher.py` `match_metadata()` |

---

## 1. The One Contract

### Module paths (all NEW)

```
backend/app/services/sources/
├── __init__.py
├── protocol.py         # SourceAdapter Protocol + SourceRef/SourceFile/SourceListing/SourceBytes + errors
├── registry.py         # kind -> module path, lazy import, import-time KIND assert
├── hashing.py          # the ONE content_hash function, shared with the upload path
├── cursor.py           # opaque cursor encode/decode — provider tokens never reach the DB raw
├── drive_adapter.py    # Google Drive          (Phase 232)
├── graph_adapter.py    # OneDrive / SharePoint (Phase 236)
├── mcp_file_adapter.py # any MCP file surface  (Phase 237)
└── mail_adapter.py     # email / mailbox       (Phase 238 — a SHAPE phase, see §Anti-Patterns)
```

This deliberately mirrors `backend/app/services/connectors/` (`protocol.py` + `registry.py` + one
module per family). That precedent is not aesthetic — `registry.py:59` carries a module-scope
`assert` that fires at **import** if the registry key set and the capability set disagree, and
`_load_adapter()` (`:73`) re-checks that the adapter's own `KIND` equals the key it was registered
under. Both properties are wanted here for the same reason: *"a mis-wired registry would otherwise
send a ticket through the mail adapter and report success."*

### The descriptor shape

```python
# sources/protocol.py
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Mapping, Protocol

@dataclass(frozen=True)
class SourceRef:
    """WHERE inside a connected source we watch. OPAQUE above the adapter boundary."""
    kind: str                      # registry key: "drive" | "graph" | "mcp_file" | "mail"
    container_id: str              # Drive folderId · Graph itemId · MCP root · mailbox+label
    label: str                     # what a person reads. NEVER parsed by anything.
    params: Mapping[str, Any] = field(default_factory=dict)
    # ⚠ `params` IS THE FENCE. Every provider-private coordinate lives here and NOTHING
    #   above the adapter may read a key out of it. See the leakage table below.

@dataclass(frozen=True)
class SourceFile:
    """ONE candidate. The shape the preview, the diff and the queue all speak."""
    external_id: str               # stable within (connection, kind). THE identity key.
    name: str
    mime_type: str                 # normalised into documents.ALLOWED_MIME_TYPES vocabulary, or ""
    size_bytes: int | None
    modified_at: datetime | None
    source_version: str | None     # Drive md5Checksum/version · Graph cTag · mail internaldate
    path_hint: str                 # display breadcrumb. NEVER a path we act on.
    web_url: str | None
    is_folder: bool = False

@dataclass(frozen=True)
class SourceListing:
    files: tuple[SourceFile, ...]
    next_cursor: str | None        # OPAQUE (cursor.py). Never a raw provider token.
    complete: bool
    # ⚠ `complete` IS LOAD-BEARING AND IS NOT DECORATION. A `missing` verdict may ONLY be
    #   written from a listing whose final page returned complete=True. Without it, a rate
    #   limit mid-pagination makes every unseen file look deleted — i.e. a 429 becomes a
    #   corpus-wide "everything is gone". See §5.

@dataclass(frozen=True)
class SourceBytes:
    filename: str
    raw: bytes
    mime_type: str                 # the mime of the BYTES RETURNED, not of the source item
    content_hash: str              # sha256 hex, from sources/hashing.py — never computed by the caller
```

### The interface

```python
class SourceAdapter(Protocol):
    KIND: str                        # registry key; asserted == the key it is registered under
    EGRESS_KEY: str                  # the security/egress.py key every outbound call must name
    SUPPORTS_DELETE_DETECTION: bool  # HONEST capability flag — drives which lifecycle verdicts are legal
    MAX_READ_BYTES: int              # the adapter's own ceiling; the queue never guesses one

    async def browse(self, *, credential, ref: SourceRef | None,
                     cursor: str | None = None, page_size: int = 50) -> SourceListing:
        """Pick-a-place, for the connect wizard. `ref=None` means the root."""

    async def list(self, *, credential, ref: SourceRef,
                   cursor: str | None = None, page_size: int = 200) -> SourceListing:
        """Everything watchable under `ref`, one page. The WATCH read — cheap, no bytes."""

    async def read(self, *, credential, file: SourceFile) -> SourceBytes:
        """The bytes, plus their hash. The QUEUE read — expensive, one file."""

    async def check(self, *, credential, ref: SourceRef | None = None) -> SourceCheckResult:
        """Can we still see it? Reads nothing. Mirrors ConnectorAdapter.check's contract."""
```

`credential` is structurally typed exactly as `connectors/protocol.py:CredentialLike` is, so the
adapters stay ABOVE the credential layer in the import graph and can be exercised with no database.
In practice callers pass the `ResolvedConnection` that `connector_service.resolve_connection()`
already returns (`connector_service.py:639`) — it already carries `service_id`, `auth_scheme`,
`mcp_server_url`, `tool_grants` and the lazy `.secret`.

### Error / typing model

Mirror `connectors/protocol.py:AdapterError` — named refusals, because the QUEUE must be able to tell
a retryable fault from a permanent one, and a bare `Exception` reaching a job row means every fault
retries forever:

```python
class SourceError(Exception): ...                       # base — str() is user-visible
class SourceUnauthorized(SourceError): ...              # token dead      -> park watch, ask to reconnect
class SourceForbidden(SourceError): ...                 # unshared        -> item state 'unauthorized'
class SourceNotFound(SourceError): ...                  # gone            -> candidate 'missing'
class SourceRateLimited(SourceError):
    retry_after_seconds: int | None                     # THE one error carrying a machine hint
class SourceTooLarge(SourceError): ...                  # skip, never retry
class SourceUnsupported(SourceError): ...               # type-not-supported, never retry
```

⚠ **Two properties of the outbound protocol MUST NOT be copied inbound, and a planner reading
`connectors/protocol.py` will copy them by default:**

1. `ConnectorAdapter.send`'s docstring says *"At MOST once (D-18). No retry, no backoff, no
   idempotency key, no queue — anywhere in any implementation."* That rule exists because a
   duplicated **send** is worse than a missing one. Inbound is idempotent by `content_hash`, so
   **retry belongs to the queue and the adapter must not implement one.** State this in
   `sources/protocol.py`'s own docblock or the rule will be inherited wrongly.
2. `connectors/protocol.py`'s closing note refuses a shared response-interpretation helper because
   Slack returns `200 {"ok": false}` while Jira uses status codes. Inbound there is no `ok`: a
   listing either yields files or raises a named error. A shared `_check_response` is fine here —
   what must stay per-adapter is *error classification*, which is what the exception hierarchy is.

### Provider leakage — named, and where each is fenced

| Provider concern | Where it lives TODAY (verified) | Where it must live | The fence |
|---|---|---|---|
| Drive `q=` syntax, `pageToken` / `nextPageToken`, `orderBy`, `fields` | `services/cloud_storage.py:_list_google_drive_files` — built inline, returned raw as `next_page_token` | `drive_adapter.list()` only | `SourceListing.next_cursor` is `cursor.encode({"kind":"drive", ...})`; a fence test asserts no persisted cursor is a bare provider token |
| Google-native export (a Doc/Sheet has no bytes) | `cloud_storage.py:_fetch_google_drive_file` — branches on `application/vnd.google-apps.*` and exports to PDF | `drive_adapter.read()` | contract: `SourceBytes.mime_type` is the mime of the bytes RETURNED; `content_hash` is over the EXPORT. This is why hashing belongs in `read()` and not in the caller |
| Shared-drive vs My Drive (`driveId`, `corpora`, `includeItemsFromAllDrives`, `supportsAllDrives`) | **nowhere — none of these params appear in `cloud_storage.py`.** Shared drives are therefore invisible to ATTACH-01 today | `SourceRef.params` | ⚠ **UNVERIFIED against live Drive** — I verified only that the parameters are ABSENT from the request built at `cloud_storage.py:107-120`, not that shared-drive items are consequently missing. A phase must drive this |
| Graph `driveId` / `siteId` / `listId`, `@odata.nextLink`, delta tokens | does not exist in the tree (zero Graph code) | `graph_adapter.py` + `SourceRef.params` | ⚠ `@odata.nextLink` is a **fully-qualified URL**. It must be re-validated through `security/egress.send_pinned_http` under a new `graph_read` key, never followed as given — that is the exact class of hole `cloud_storage.py` was found to have (the `drive_read` key comment at `egress.py:247-258` records it) |
| MCP tool-name variance (`list_files` vs `search` vs `readFile`) | `mcp_client.list_tools()` returns whatever the server advertises; `call_tool()` takes a name | `mcp_file_adapter.py`, reading a per-connection **tool binding stored as DATA** | the binding lives in `SourceRef.params["tools"] = {"list": "...", "read": "..."}`, chosen once in the connect wizard from `connector_connections.discovered_tools`. **Adding an MCP file server adds a ROW, not code** — the milestone's binding constraint, made mechanical |
| Mail thread / quoting / attachments-as-children | `services/email_extraction_service.py` + the attachment cascade inside `ingest_document` at `documents.py:2380-2444` (inserts a child `documents` row + an `attached_to` `document_relationships` row, then recurses into `ingest_document`) | `mail_adapter.py` — **and this is a shape decision, not an adapter** | see §Anti-Patterns |

**The one thing all four families share and must NOT re-implement:** the egress binder. Every
`read`/`list` goes through `send_pinned_http(EGRESS_KEY, ...)`. `egress.py:242` already carries
`drive_read`, `gmail_read`, `sheets_read`, `docs_read`, `calendar_read`, `contacts_read` and six
`*_write` twins. v4.0 adds `graph_read` (`graph.microsoft.com`, `_SUFFIX`, `https` only). MCP keeps
its own door — `mcp_client.py:260` calls `validate_mcp_destination` rather than
`send_pinned_http`, and that difference is deliberate and should not be flattened.

---

## 2. The Ingest Splice

### The splice point, read not guessed

**`ingest_document()` at `backend/app/api/documents.py:2030` IS the funnel, and it says so itself.**
Its BUG-260825-01 comment block at `:2049-2062` reads:

> *"THIS IS THE FUNNEL, WHICH IS WHY IT IS THE ONLY SITE. `/upload`, `/reingest`, `/reextract` and
> the email-attachment cascade ALL call `ingest_document`."*

Verified callers (`grep ingest_document backend/app`): `documents.py:344` (from `_upload_pipeline`),
`documents.py:1628` (`/reextract` background task), `documents.py:2431` (the attachment cascade).
`_upload_pipeline()` at `:239` has three callers: `documents.py:716` (`/upload`), `documents.py:1185`
(`/reingest`), and — already — **`backend/app/api/connectors.py:1707` (Phase 216 `ATTACH-01`)**.

### The FOUR chunk-write sites

| # | Site | What it writes |
|---|---|---|
| 1 | `documents.py:2338` `document_chunks.insert(chunk_rows)` | text chunks; `embedded_at` at `:2334` |
| 2 | `multimodal_service.py:435` `document_chunks.insert(chunk_rows)` | table chunks; `embedded_at` at `:429` |
| 3 | `multimodal_service.py:913` `document_chunks.insert(chunk_rows)` | image-description chunks; `embedded_at` at `:909` |
| 4 | `reembed_service.py:234` (UPDATE, inside the re-embed batch loop) | rewrites `embedding` + `embedded_at` |

⚠ The hot-file ledger (`docs/HOT-FILE-LEDGER.md:2431`) names these as `documents.py:2296`,
`multimodal_service.py:423` / `:896`, `reembed_service.py:187`. **My re-derivation on 2026-09-04
reads `:2338 / :435 / :913 / :234`** — the files have moved since the ledger row was written. The
*set* is identical; only the line numbers drifted. The ledger's binding sentence still holds:
*"a future change to the chunk-row shape must touch all four or the sites silently diverge."*

**None of the four needs to change for connector ingestion.** A connector-sourced document produces
identical chunk rows. If v4.0 adds a per-chunk provenance column, all four change together.

### Must the splice be EXTRACTED first?

**Correctness: no — a connector can already call it. Honesty: YES, and there is a shipped defect
proving why.**

⚠ **VERIFIED DEFECT in `import_connection_file` (`connectors.py:1650-1712`).** That route builds its
own `documents` row instead of sharing `/upload`'s:

```python
doc_row = {
    "id": doc_id, "user_id": user["id"], "filename": filename,
    "mime_type": mime_type, "file_size": len(raw_bytes),
    "status": "processing",
    "storage_path": storage_path,        # ← connectors.py:1693
    "created_at": ..., "updated_at": ...,
}
```

The `documents` table (`supabase/full-schema.sql:1123-1146`) has **no `storage_path` column**, and
its `file_path` is `NOT NULL`. The row also omits `content_hash`, `folder_id`, `version_number` and
`is_latest` — all four of which `/upload` sets at `documents.py:669-681`. Consequences, in order of
confidence:

- **HIGH (schema-read):** the key `storage_path` does not exist on `documents`, and `file_path` is
  `NOT NULL` and unsupplied.
- **UNVERIFIED (runtime):** whether PostgREST rejects with `PGRST204` (unknown column) or `23502`
  (not-null violation) — I did not execute this route. Either way the INSERT cannot succeed as
  written, which means **ATTACH-01's import has probably never written a row**. This should be
  driven before it is planned around.
- **Structural, and the reason extraction is owed:** even if it succeeded, a row with no
  `content_hash` is invisible to the preview's *"already here"* lookup, and a row with no
  `is_latest` is invisible to `match_document_chunks`, whose body filters `AND d.is_latest = true`
  (`full-schema.sql:326`).

That is the whole argument. A second producer that re-implements the row mint gets it wrong; a third
and fourth (Graph, MCP, mail) will get it wrong differently.

### Where the extraction should live

**NEW: `backend/app/services/ingest_splice.py`**

```python
async def mint_document_row(*, supabase, user_id, org_id, filename, mime_type,
                            raw, folder_id, source: DocumentSource | None) -> MintResult:
    """The ONE place a documents row is born. Owns the six facts /upload owns inline today:
      1. mime normalisation      — documents.py:_UNRELIABLE_MIME_TYPES:147 / _EXT_MIME_OVERRIDES:122
      2. allow-list refusal      — documents.py:ALLOWED_MIME_TYPES:101
      3. size ceiling            — documents.py:588 (50 MB)
      4. content_hash            — documents.py:620  hashlib.sha256(raw).hexdigest()
      5. folder-scoped dedup     — documents.py:625-641   (RETURNS 'already_here', never a new row)
      6. version cascade + 23505 — documents.py:645-705
    Plus, NEW: source_connection_id / source_external_id / source_state.
    """

def splice_document(document_id, raw, mime_type, filename, user_id,
                    storage_path, supabase, engines_dict=None) -> None:
    """Today's documents._upload_pipeline, MOVED verbatim. Calls ingest_document unchanged."""
```

`MintResult` carries the three-way verdict the preview also needs: `created` / `already_here`
(dedup hit) / `refused(reason)`. **That is not a coincidence — it is why the preview is cheap in
§7's build order.** The preview is `mint_document_row`'s classification run without the write.

### Seam recommendation — G-5 FIRES on `documents.py` (30 phases / 72 commits / 2535 L)

The ledger records: *"No seam is named yet in the source material… The 11-route surface and the
`_upload_pipeline` are the obvious candidates for that future phase."* **This milestone should take
exactly that seam and stop there:**

- **MOVE OUT:** `_upload_pipeline` (`:239-357`) and the `/upload` route's row-minting preamble
  (`:568-705`) → `services/ingest_splice.py`.
- **LEAVE IN PLACE, BYTE-IDENTICAL:** `ingest_document` (`:2030`). It is the one funnel; moving it in
  the same phase that adds a second producer makes a red test unattributable. Its extraction is a
  later phase's obligation and should be recorded as still owed.
- **RE-POINT three call sites:** `documents.py:716`, `documents.py:1185`, `connectors.py:1707`.
- **FIX** `import_connection_file` to call `mint_document_row` — which closes the `storage_path`
  defect as a side effect of the refactor rather than as a separate patch.

⚠ Two invariants the ledger flags that a refactor must not "tidy away":
`ingestion_step` is deliberately **never cleared on completion** (D-217-23 — `text_sanitize.py:9`
diagnoses BUG-260825-01 by reading `status=failed / ingestion_step=embedding`); and the classification
pass at `:2469-2512` runs *immediately before* the single persist UPDATE at `:2532` and must stay
there, because `metadata_dict` is final only at that point.

---

## 3. The Queue

### Where it sits: exactly where the shipped scheduler sits

`SchedulerService` (`scheduler_service.py:306`) runs **in-process, one instance per uvicorn worker,
with no leader election, no advisory lock and no Redis coordination.** Its module docblock states the
reason verbatim: the duplicate-firing guarantee lives in `db/schedules.claim_due_schedules()`, not in
the loop — *"a leader-election scheme has a failure mode where the leader dies and nothing fires, and
that failure is silent."*

The claim contract (`db/schedules.py:claim_due_schedules`, whose docstring spells out why step 2 is
the load-bearing one):

```
async with pool.acquire() as con:
    async with con.transaction():
        SELECT ... WHERE is_active AND next_run_at <= now()
                   ORDER BY next_run_at LIMIT $1
                   FOR UPDATE SKIP LOCKED        -- (1) siblings SKIP, never block
        UPDATE ... SET next_run_at = <advanced>  -- (2) INSIDE the same transaction
```

**This is the entire durable-queue primitive, already shipped and already running under
`WORKER_COUNT=2`.** The ingestion queue is the same query with a different claim key.

### Scheduler enqueues, queue executes — and here is the precise sense in which the shipped scheduler is reused

The milestone says *"the shipped scheduler, never a new one."* The honest reading:

- **Reused:** the poll-loop shape (`SchedulerService`'s `tick`/`_loop`/`start`/`stop`), the
  `FOR UPDATE SKIP LOCKED` + in-transaction-advance claim contract, the "no leader, DB is the
  arbiter" decision, the lifespan wiring block in `main.py:501-537`, and the operator dials
  (`*_POLL_INTERVAL_SECONDS`, `*_MAX_CLAIMS_PER_TICK`).
- **NOT reused:** `workflow_schedules` rows and `launch_scheduled_run`. That function mints a
  `threads` row **and** a `workflow_runs` row per firing (`scheduler_service.py:120-160`), arms a
  token/duration circuit breaker, and drives `run_workflow`. A folder sync is not a workflow run,
  and forcing it to be one buys a thread per tick and a breaker that measures the wrong thing.

**A second claim query on a second table is not a second scheduler.** No new scheduling semantics, no
new process, no new coordination primitive. If a planner wants the stronger form — a watch expressed
as a `workflow_schedules` row driving an ingest workflow — that is available and should be recorded
as the rejected alternative with its cost, not silently skipped.

### Two loops, one shape

```
WatchService.tick()                      # cheap. no bytes leave the provider except a listing.
  claim_due_watches(pool, limit)         #   claim key: connector_watches.next_run_at
  for watch:
     adapter.list(...)  → SourceListing  #   paginate to complete=True or park
     diff vs connector_watch_items
     INSERT ingestion_jobs (queued)      #   fan-out: 1 watch tick → N file jobs

IngestQueueService.tick()                # expensive. downloads + extracts.
  claim_ingest_jobs(pool, limit=CAP)     #   claim key: ingestion_jobs.next_attempt_at
  for job:
     adapter.read(...)  → SourceBytes
     ingest_splice.mint_document_row(...)
     ingest_splice.splice_document(...)
     record disposition
```

### Cap / retry / resume — the smallest change

| Property | Mechanism | Precedent |
|---|---|---|
| **cap** | `LIMIT` on the claim + `INGEST_MAX_CLAIMS_PER_TICK` + an optional per-org in-flight predicate | `scheduler_max_claims_per_tick` (`config.py`, default 10) |
| **retry** | `attempt_count`, `max_attempts`, `next_attempt_at = now() + backoff(attempt_count)`. A `SourceRateLimited` sets it from `retry_after_seconds` instead of the curve | new, but the column shape is `workflow_schedules.next_run_at`'s |
| **resume** | **free, and this is the strongest argument for a DB queue.** A job whose worker died is a row with `status='running'` and a stale `claimed_at`. A sweeper predicate `status='running' AND claimed_at < now() - interval '15 minutes'` returns it to `queued` | `main.py:426` already runs a restart sweep of this class, *"guarded by a single-shot SET NX so WORKER_COUNT=2 never double-sweeps"*; `resume_stranded_workflows` is the workflow analogue |

### Is a separate always-on process required? **No.**

Stated plainly, because the question deserves a plain answer: **a separate worker process is NOT
required, and the evidence is that an equivalent loop already runs in production inside the uvicorn
workers.** `docker-compose.prod.yml` declares four services (`frontend`, `backend`, `redis`,
`agentic-rag`) and adds **no** process for `SCHEDULER_PROCESS_ENABLED` (`:69-72`).

⚠ **The honest caveat, stated at scoping rather than discovered later.** Ingestion is CPU- and
memory-heavy in a way workflow *launching* is not: `_upload_pipeline` wraps `extract_composable` in a
**130-second** wall clock (`documents.py:295`) and holds up to 25–50 MB of `raw` per job. Running N
of those inside the API workers competes with request serving. The no-new-process mitigations, in
order: a small `LIMIT` (2 per worker, not 10); the existing `run_in_threadpool` discipline (D-v2.5-01);
and the adapter's own `MAX_READ_BYTES`.

**If a separate process later IS wanted**, the correct shape is a `WORKER_ROLE=ingest` env var that
starts *only* the queue loop, in a second `docker-compose.prod.yml` service running the **same
image** — the "scale is a dial turned inside this home" model `deploy/onebox.env.example:66` already
states for `WORKER_COUNT`. That commit must touch, per the D-16 same-commit rule enforced by
`scripts/check-deploy-drift.sh`:

- `docker-compose.prod.yml` — the new service block
- `deploy/onebox.env.example` — `WORKER_ROLE` + every `INGEST_*` var
- `docs/OPERATOR.md` — the Step-3 seed list

⚠ **Even the no-new-process version owes those three files in the same commit**, because it
introduces `INGEST_QUEUE_ENABLED` / `INGEST_POLL_INTERVAL_SECONDS` / `INGEST_MAX_CLAIMS_PER_TICK`,
and a var the app reads that is absent from `onebox.env.example` is exactly what the drift script
fails on. Register any deliberately-omitted var in the script's `OMITTED_FROM_ONEBOX` list.

---

## 4. Connection-Scoped Visibility, in the RLS Model

### The current predicate, and the FOUR places it is written

```sql
org_id IN (SELECT public.current_user_org_ids())
AND ( auth.uid() = user_id
      OR (folder_id IS NOT NULL AND public.folder_is_org_shared(folder_id)) )
```

| # | Site | Kind |
|---|---|---|
| 1 | `full-schema.sql:5452` — `"Users can view own or global-folder documents"` on `documents` | RLS policy |
| 2 | `full-schema.sql:5501-5503` — `"Users can view their own chunks"` on `document_chunks` (reaches `documents` via `EXISTS`) | RLS policy |
| 3 | `full-schema.sql:325-329` — `match_document_chunks` body | `SECURITY DEFINER` |
| 4 | `full-schema.sql:296-300` — `keyword_search_chunks` body | `SECURITY DEFINER` |

`folder_is_org_shared` (`full-schema.sql:224`) is a `STABLE SECURITY DEFINER` recursive ancestor walk
over `folders.parent_id` returning `bool_or(is_org_shared)`.

### Minimal change: one nullable FK + one connection column + one predicate function

```sql
-- 154_connection_scoped_visibility.sql   (indicative number — see §Migration numbering)

-- (a) The visibility lives on the CONNECTION. "Change who sees everything from Drive"
--     must be ONE update, not a corpus-wide rewrite. That is the requirement, literally.
ALTER TABLE public.connector_connections
  ADD COLUMN IF NOT EXISTS ingest_visibility text NOT NULL DEFAULT 'private';
ALTER TABLE public.connector_connections
  ADD CONSTRAINT connector_connections_ingest_visibility_check
  CHECK (ingest_visibility IN ('private','org'));
-- ⚠ TWO VALUES, CLOSED, ON PURPOSE. This is SEED-210 Option 3 made structural. A third
--   value is SEED-211's metadata-derived model, which is a MIGRATION and a phase, never a
--   config knob somebody flips. The CHECK is the recorded migration path.

-- (b) The DOCUMENT carries only the pointer.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_connection_id uuid
    REFERENCES public.connector_connections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_source_connection
  ON public.documents (source_connection_id) WHERE source_connection_id IS NOT NULL;

-- (c) ONE predicate, org-gated INSIDE itself so it can never widen past the org fence.
CREATE OR REPLACE FUNCTION public.connection_grants_org_visibility(p_connection_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.connector_connections c
    WHERE c.id = p_connection_id
      AND c.ingest_visibility = 'org'
      AND c.org_id = ANY (SELECT public.current_user_org_ids())
  );
$$;
```

Then **all four sites** gain exactly one disjunct:

```sql
OR (d.source_connection_id IS NOT NULL
    AND public.connection_grants_org_visibility(d.source_connection_id))
```

### Why a column and not a join table

The requirement is *"ONE visibility per connection."* A join table permits a document to inherit two
connections' visibilities, which turns the RLS predicate from one indexed `OR` term into an `EXISTS`
over an aggregation — the shape whose plan is least predictable inside
`match_document_chunks`'s ANN scan at corpus scale, which is the very thing `SEED-076`/`SEED-077`
warn about. One nullable FK, one partial index, one extra term.

### Why the disjunct is safe

- `ON DELETE SET NULL` on the FK: deleting a connection makes its documents fall back to
  **owner-only**. That is the fail-closed direction, and it agrees with the milestone's "a source-side
  delete does not delete the Library document" — the knowledge survives, the *sharing* does not.
- The `current_user_org_ids()` term is *inside* `connection_grants_org_visibility`, so no call site
  can accidentally omit the org fence.
- `document_chunks` needs **no** new column: its policy already reaches `documents` through an
  `EXISTS`, and the new term goes inside that same `EXISTS`.

⚠ **The four-site lockstep is the whole risk, and the ORDER of widening matters.** A migration that
updates three of four leaves one of two states:

| Widened | Not widened | Result |
|---|---|---|
| policies only | DEFINER bodies | Library shows the doc; the agent cannot retrieve it. Annoying, **not a leak.** |
| **DEFINER bodies** | **policies** | **The agent retrieves and cites chunks the Library will not show.** This is the dangerous direction. |

**So: widen the two RLS policies FIRST and the two DEFINER bodies LAST, in that order, inside one
transaction — and drive the negative case (a second user in the same org, connection still
`private`) RED against all four before the widening.**

### Interaction with `retrieval_service.py`

**Zero changes required.** `search_documents()` never filters by visibility itself — `_vector_search`
(`:60`) and `_keyword_search` (`:103`) call the two DEFINER functions through `_call_as_user()`
(`:37`), which opens `get_user_pg_connection(None, {"id": user_id})` so `auth.uid()` resolves to the
caller and the DEFINER bodies do the deciding. The whole visibility decision is in SQL.

`_enrich_with_filenames()` (`:157`) reads `documents` for the ids the DEFINER already returned — it
can never *add* a row, only decorate one, so it cannot widen the set. **UNVERIFIED:** I did not trace
every caller's `supabase` client to confirm which are user-scoped vs service-role; a planner should
confirm the enrich read cannot leak a filename for a row that the DEFINER already narrowed away
(structurally it cannot, since it only looks up ids it was handed).

### Interaction with the folder model

The two mechanisms are **independent and disjunctive**. A connector document in a private folder
under an `org`-visibility connection is org-visible; a connector document in an org-shared folder is
org-visible regardless of the connection. ⚠ **That means the folder's privacy and the connection's
sharing can disagree, and the milestone requires the UI to say so plainly.** The plain sentence must
be attached to the *connection* (*"everyone in your organisation can see everything from this
connection"*) **and** repeated as a mark on the document row in `DocumentRow.tsx`, or a user will
read folder privacy and get connection sharing.

### Migration numbering

Highest existing file: **`152_audit_log_connector_action_types_and_message_active_connectors.sql`**
(128 files total; gaps exist at 130–139 and 142–149). ⚠ **Do not backfill the gaps** — the Supabase
CLI applies in filename order, so a lower number added later is out of sequence. New work is
monotonic from **153**, `<digits>_name.sql`, **no letter suffixes** (`007b` is silently skipped).

Indicative allocation, aligned to §7's build order:

| # | File | Phase |
|---|---|---|
| 153 | `153_ingestion_jobs.sql` | the durable queue |
| 154 | `154_connection_scoped_visibility.sql` | the FOUR-site widening + `ingest_visibility` + `source_connection_id` |
| 155 | `155_connector_watches.sql` | watch rows + `next_run_at` claim index + RLS |
| 156 | `156_connector_watch_items.sql` | the per-file mirror the diff runs against |
| 157 | `157_documents_source_state.sql` | the lifecycle label column + audit action types |
| 158 | `158_classification_rules_watch_scope.sql` | one rule engine, widened |

Every new table follows `124_workflow_schedules.sql`'s shape: `org_id uuid NOT NULL REFERENCES
public.organizations(id) ON DELETE CASCADE`, an `autofill_org_id_by_owner('user_id')` trigger
(`124:173`), `ENABLE ROW LEVEL SECURITY`, and four migration-108 Shape-A policies (membership AND
owner). Bind `jsonb` as a plain dict, never `json.dumps` — the asyncpg pool registers a jsonb codec
and a pre-encoded string becomes a jsonb **string scalar** (the defect migration 123 had to repair).

---

## 5. Lifecycle Propagation

### Where detection happens

**Exactly one place: `WatchService.tick()`**, diffing an adapter's `list()` result against
`connector_watch_items` for that watch. The adapter reports; it never decides. There is no delta
cursor and no webhook this milestone — which is why the screen says *"checked every N minutes"*.

### The mirror table that makes a diff possible

```sql
-- 156_connector_watch_items.sql
CREATE TABLE public.connector_watch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  watch_id uuid NOT NULL REFERENCES public.connector_watches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text NOT NULL,                 -- the identity key from SourceFile
  name text NOT NULL,
  path_hint text NOT NULL DEFAULT '',
  source_version text,                       -- Drive md5Checksum · Graph cTag · mail internaldate
  source_modified_at timestamptz,
  content_hash text,                         -- what we LAST ingested. The truth.
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'present',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  missing_since timestamptz,
  last_error text,
  CONSTRAINT watch_item_state_check CHECK (state IN
    ('present','missing','unauthorized','skipped_type','skipped_size','failed')),
  CONSTRAINT watch_item_identity UNIQUE (watch_id, external_id)
);
```

### Event → concrete writes

| Source event | Detection in a POLLING model | Writes |
|---|---|---|
| **New file** | `external_id` in the listing, absent from `connector_watch_items` | INSERT item `state='present'` · INSERT `ingestion_jobs` row `op='ingest'` |
| **Modified** | item present, `source_version` differs from stored | UPDATE item `source_version`, `last_seen_at` · INSERT job `op='reingest'`. ⚠ The job re-reads bytes and compares `content_hash`; if unchanged it closes `disposition='unchanged'` and **writes nothing**. `source_version` is a hint, `content_hash` is the truth |
| **Deleted at source** | `external_id` absent from a listing with `complete=True` | item `state='missing'`, `missing_since=now()`. `documents.source_state='missing_at_source'`. ⭐ **The `documents` row is otherwise UNTOUCHED — no delete, no `is_latest=false`, no chunk delete.** The decided rule |
| **Unshared / permission lost** | adapter raises `SourceForbidden` on `read()`, or the container listing 403s | item `state='unauthorized'`, `documents.source_state='unauthorized_at_source'`. ⚠ **NEVER collapsed into `missing`** — *"you can't see it any more"* and *"it is gone"* have different remedies and the UI offers different actions |
| **Moved within the watch** | same `external_id`, different `path_hint` / parent | UPDATE item `path_hint`. **No job, no `documents.folder_id` change** unless a routing rule (§below) says otherwise |
| **Moved OUT of the watch** | ⚠ **indistinguishable from deleted** in a plain listing | `state='missing'`. This ambiguity is REAL and must be said in the UI, not papered over. An adapter with `SUPPORTS_DELETE_DETECTION = True` (Drive `changes.list` / `trashed`, Graph delta) may distinguish them — the base contract may not |
| **Connection disconnected / revoked** | `connector_connections.status='revoked'` (migration 129 shipped the column and its CHECK) or an OAuth refresh failure | `connector_watches.is_active=false` + `last_error` · `documents.source_state='source_disconnected'` · **documents RETAINED**. ⚠ `SEED-072` records retain/freeze/purge as *undecided*; **retain is the proposal here**, and purge-on-disconnect is an explicit operator action behind a victim-naming confirm sheet (the Phase 146–148 graded-action-guard pattern), never a side effect |
| **Explicit "yes, remove it"** | a person acts in the Library | the existing `DELETE /documents/{id}` at `documents.py:1644`. **Nothing new is built for this** |

### The one dangerous inference, and the flag that prevents it

⚠ **`state='missing'` may ONLY be written from a listing whose final page returned `complete=True`.**
If pagination halted — a 429, a token expiry, a network fault — every unseen file looks deleted, and
a rate limit becomes a corpus-wide *"everything is gone"* banner. `SourceListing.complete` exists for
exactly this and the diff must assert it before it may write a single `missing`. This is the highest-
value single assertion in the whole lifecycle path.

### `documents.source_state`

New nullable `text`, `CHECK (source_state IN ('live','missing_at_source','unauthorized_at_source',
'source_disconnected'))`, NULL for every uploaded document. **It never affects RLS and never affects
retrieval** — it is what the Library row and the citation footer *say*. Keeping it out of the
retrieval predicate is deliberate: an unshared document the agent has already grounded on must not
silently vanish from an answer mid-conversation; it must be *labelled*.

---

## 6. New vs Modified

### NEW files

| Path | What it is |
|---|---|
| `backend/app/services/sources/protocol.py` | the adapter Protocol + `SourceRef`/`SourceFile`/`SourceListing`/`SourceBytes` + the error hierarchy |
| `backend/app/services/sources/registry.py` | `kind → module path`, lazy import, import-time `KIND` assert (mirrors `connectors/registry.py`) |
| `backend/app/services/sources/hashing.py` | the ONE `content_hash` function, shared with the upload path |
| `backend/app/services/sources/cursor.py` | opaque cursor encode/decode |
| `backend/app/services/sources/drive_adapter.py` | Google Drive |
| `backend/app/services/sources/graph_adapter.py` | OneDrive / SharePoint |
| `backend/app/services/sources/mcp_file_adapter.py` | any MCP file surface |
| `backend/app/services/sources/mail_adapter.py` | email / mailbox (a shape phase) |
| `backend/app/services/ingest_splice.py` | `mint_document_row()` + `splice_document()` — the extracted splice |
| `backend/app/services/watch_service.py` | `WatchService` poll loop + the diff |
| `backend/app/services/ingest_queue.py` | `IngestQueueService` poll loop |
| `backend/app/db/watches.py` | `claim_due_watches()` + every read/write of `connector_watches` |
| `backend/app/db/ingest_jobs.py` | `claim_ingest_jobs()` + the resume sweeper |
| `backend/app/api/sources.py` | watches CRUD · browse · preview · job status · lifecycle actions |
| `backend/app/models/source.py` | wire models for the above |
| `frontend/src/lib/api/sources.ts` | the client half (a new module beside `connectors.ts`) |
| `frontend/src/components/sources/*` | connect wizard · watch list · preview three-way split · a "stopped reading" card |
| `supabase/migrations/153…158_*.sql` | see §4 |

### MODIFIED files (named)

| Path | Change | Ledger status |
|---|---|---|
| `backend/app/api/documents.py` | **remove** `_upload_pipeline` (`:239`) and the `/upload` row-mint preamble (`:568-705`) → `ingest_splice.py`; re-point `:716` and `:1185`. `ingest_document` (`:2030`) **byte-identical** | **G-5 FIRES — 30 phases.** The ledger names no seam; this milestone takes the one it flagged |
| `backend/app/api/connectors.py` | re-point `list_connection_files` (`:1616`) and `import_connection_file` (`:1650`) at `sources/` + `ingest_splice`; **fix the `storage_path` defect at `:1693`** | ⚠ FIRES — 11 phases |
| `backend/app/services/cloud_storage.py` | **retired into `drive_adapter.py`.** Its `if "google" in service_id` dispatch (`:32`, `:165`) is the exact "each family grows its own path" shape the constraint forbids | ⚠ no ledger row — add one |
| `backend/app/services/connector_service.py` | `ingest_visibility` on the response/update models; nothing else | ⚠ FIRES — 7 phases; row was found STALE once already |
| `backend/app/models/connector.py` | `ingest_visibility` field | ⚠ FIRES — 6 phases |
| `backend/app/main.py` | two more lifespan blocks in the `main.py:501-537` shape (`WatchService`, `IngestQueueService`), both OFF by default | ⚠ FIRES — 54 phases; honoured by construction |
| `backend/app/config.py` | `INGEST_*` and `WATCH_*` settings beside `scheduler_*` | ⚠ FIRES — 43 phases |
| `backend/app/security/egress.py` | add `graph_read` to `ALLOWED_HOST_SUFFIXES:242`, `_HOST_MATCH:291`, `_TLS_SCHEMES:311` — **all three, or the key is half-declared** | no row — add one |
| `backend/app/services/classification_rule_service.py` + `classification_matcher.py` | a scope discriminator, **no second expression language** | no rows — add them |
| `backend/app/services/retrieval_service.py` | ⭐ **NO CHANGE.** Visibility is entirely in SQL | ⚠ FIRES — 9 phases, absent for its entire life |
| `backend/app/services/multimodal_service.py`, `reembed_service.py` | ⭐ **NO CHANGE** unless the chunk-row shape gains provenance — in which case **all four sites together** | multimodal ⚠ FIRES — 7 phases |
| `frontend/src/pages/LibraryPage.tsx` | a sixth tab (**Sources**) as a CHILD component, in the existing five-tab pattern (`:125`). No branch enters the page | ⚠ FIRES — 11 phases; seam already taken at 217-09 |
| `frontend/src/components/ingestion/DocumentRow.tsx` | a `source_state` mark + a connection-visibility mark | young (217.1-05) |
| `frontend/src/components/ingestion/AutomationGroup.tsx` | watch-routing rules render as PEERS of classification rules | no row — add one |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` / `ConnectionsTab.tsx` | the visibility control + its plain sentence | both ⚠ FIRE — 7 / 8 phases; both rows were found STALE |
| `frontend/src/types/index.ts`, `frontend/src/lib/api.ts` | wire types + barrel re-export | both ⚠ FIRE |
| `CLAUDE.md` | ⭐ **retire "Ingestion is manual file upload only" IN THE SAME COMMIT as the first sync connector** (`SEED-142`) | binding |
| `docker-compose.prod.yml`, `deploy/onebox.env.example`, `docs/OPERATOR.md` | D-16 same-commit parity for every new env var | enforced by `scripts/check-deploy-drift.sh` |
| `scripts/vitest-count-gate.cjs` | `TARGETS` + `BASELINE` pins for every new frontend suite | ⚠ FIRES |

### End-to-end data flow: scheduler tick → retrievable chunk

```
 1  WatchService._loop wakes (WATCH_POLL_INTERVAL_SECONDS, default 300)
 2  db/watches.claim_due_watches(pool, limit)
       SELECT ... WHERE is_active AND next_run_at <= now()
       ORDER BY next_run_at LIMIT $1 FOR UPDATE SKIP LOCKED
       UPDATE next_run_at = now() + interval        ← SAME transaction (the 204 contract)
 3  for each watch:
       conn = connector_service.resolve_connection(connection_id, org_id)   # connector_service.py:639
       adapter = sources.registry.get_adapter(watch.source_ref.kind)
 4     adapter.list(credential=conn, ref=watch.source_ref, cursor=...)
          → send_pinned_http(adapter.EGRESS_KEY, ...)                       # security/egress.py
          → SourceListing(files=..., next_cursor=..., complete=...)
 5     diff vs connector_watch_items:
          new / modified  → INSERT ingestion_jobs (status='queued')
          absent + complete=True → item state='missing', documents.source_state='missing_at_source'
          403             → item state='unauthorized'                        ← NEVER 'missing'
 ─────────────────────────────────────────────────────────────────────────────────
 6  IngestQueueService._loop wakes (INGEST_POLL_INTERVAL_SECONDS, default 30)
 7  db/ingest_jobs.claim_ingest_jobs(pool, limit=INGEST_MAX_CLAIMS_PER_TICK)
       ... WHERE status='queued' AND next_attempt_at <= now()
       FOR UPDATE SKIP LOCKED  →  SET status='running', claimed_at=now()
 8  adapter.read(credential=conn, file=...)  → SourceBytes(raw, mime, content_hash)
 9  ingest_splice.mint_document_row(...)
       mime normalise → ALLOWED_MIME_TYPES → size cap → content_hash dedup
       → 'already_here'  ⇒ close the job, link the item, WRITE NO ROW
       → 'created'       ⇒ documents row with source_connection_id + source_external_id
10  ingest_splice.splice_document(...)          [today's _upload_pipeline, moved]
       storage upload → extract_composable (130 s wall clock)
11  documents.ingest_document(...)              [documents.py:2030 — UNCHANGED]
       scrub_text → metadata extract → chunk_text
       → embed_chunks → document_chunks.insert(chunk_rows)      # site 1 of 4, :2338
       → multimodal tables/images                               # sites 2 & 3
       → classification rule-eval (:2469)                       # the ONE rule engine
       → documents.status='completed'
12  job row → status='done', disposition='ingested'
       (failure ⇒ attempt_count++, next_attempt_at = now()+backoff, back to 'queued')
 ─────────────────────────────────────────────────────────────────────────────────
13  A user asks a question.
14  retrieval_service.search_documents()  →  _vector_search / _keyword_search
15  _call_as_user() opens get_user_pg_connection(None, {"id": user_id})
16  match_document_chunks / keyword_search_chunks (SECURITY DEFINER) decide visibility:
       org gate
       AND ( owner
             OR folder_is_org_shared(d.folder_id)
             OR connection_grants_org_visibility(d.source_connection_id) )   ← the ONE new term
       AND d.is_latest = true
17  RRF fuse → dedup → optional rerank → _enrich_with_filenames → cited answer
```

---

## Architectural Patterns

### Pattern 1: Registry + Protocol, with an import-time agreement assert

**What:** a `dict[key, dotted_module_path]`, lazy `importlib` on first resolve, and a check that the
adapter's self-declared key equals the key it was registered under.
**When:** any time a closed family of implementations must be selectable by data.
**Trade-off:** a typo in a module path is an `ImportError` at first use rather than at boot — mitigated
by a fence test that resolves every key.

```python
# sources/registry.py — the connectors/registry.py:59 shape, for source families
_ADAPTERS: dict[str, str] = {
    "drive":    "app.services.sources.drive_adapter",
    "graph":    "app.services.sources.graph_adapter",
    "mcp_file": "app.services.sources.mcp_file_adapter",
    "mail":     "app.services.sources.mail_adapter",
}
assert set(_ADAPTERS) == set(SOURCE_KINDS), (
    "the source registry disagrees with the closed kind set: "
    f"{sorted(set(_ADAPTERS) ^ set(SOURCE_KINDS))}"
)
```

⚠ **The closed set is FOUR FAMILIES; the open set is ROWS.** Adding a Notion MCP file server, a
second SharePoint site or a third mailbox adds `connector_watches` rows and touches no Python. That
is the v3.9 win applied inbound, and it is the property the phase must be able to demonstrate.

### Pattern 2: DB-arbitrated claim, no leader

**What:** `SELECT ... FOR UPDATE SKIP LOCKED` inside an explicit transaction, with the claim key
advanced *before commit*.
**When:** any recurring background work under multi-worker uvicorn.
**Trade-off:** one extra transaction per tick, in exchange for eliminating split-brain.

⚠ **Step 2 is the load-bearing one and is easy to "simplify" away.** `db/schedules.py`'s docstring
says it verbatim: *"`SKIP LOCKED` alone only guarantees the two workers do not claim a row
simultaneously; without the in-transaction advance, worker B running a millisecond after worker A
commits would find the same row still due and fire it again. Do not 'simplify' this into a select
followed by a separate update."*

### Pattern 3: One rule engine — a scope discriminator, never a second AST

**What:** folder-watch routing rules are `classification_rules` rows with a scope column, evaluated by
the shipped `classification_matcher.match_metadata()`.
**When:** now — `SEED-243`'s deferred text says these two surfaces *"should be designed together
rather than growing two rule engines."*

The existing engine is already the right one and is already dual-headed: `classification_rules.match_expr`
is a `ViewFilter` AST that is **compiled to SQL** by `view_filter_compiler.compile_filter()` for saved
views, and **evaluated in Python** by `classification_matcher.match_metadata()` at ingest — and
`classification_matcher.py`'s docblock records exactly why both exist (*"at the ingest call site the
doc is NOT YET PERSISTED, so the compiler cannot be reused"*). The `Literal` op-discriminator rejects an
unknown op at parse; there is no eval and no op-ladder.

```sql
-- 158_classification_rules_watch_scope.sql
ALTER TABLE public.classification_rules
  ADD COLUMN IF NOT EXISTS rule_scope text NOT NULL DEFAULT 'metadata',
  ADD COLUMN IF NOT EXISTS watch_id uuid REFERENCES public.connector_watches(id) ON DELETE CASCADE;
ALTER TABLE public.classification_rules
  ADD CONSTRAINT classification_rules_scope_check
  CHECK (rule_scope IN ('metadata','source'));
```

⚠ **The real design tension, named rather than glossed.** `match_metadata` matches *extracted
metadata*, which exists only **after** extraction. A watch-routing rule at **preview** time has only
the `SourceFile` descriptor: `name`, `mime_type`, `size_bytes`, `path_hint`, `modified_at`. Those are
**two different match dimensions on one AST**. The resolution that keeps one engine:

- `rule_scope='source'` rules validate their field list against a `SOURCE_FIELDS` whitelist
  (`name`/`mime_type`/`path_hint`/`size_bytes`/`modified_at`) instead of the metadata whitelist, and
  are evaluated by the **same** `match_metadata()` against a dict built from `SourceFile`.
- `rule_scope='metadata'` rules are untouched and run exactly where they run now (`documents.py:2469`).
- The `_`-prefix guard in `view_filter_compiler.validate_fields` stays in force on both — a
  `_confidence`/`_source`/`_classification` provenance key can never become a match dimension
  (T-118-01-02).

**One AST, one matcher, two whitelists. Not two engines.**

### Pattern 4: The preview is the mint, minus the write

`mint_document_row`'s three-way verdict (`created` / `already_here` / `refused(reason)`) is
*definitionally* the preview's three-way split (*will be added* / *already here* / *type not
supported*). Implement the preview as `mint_document_row(dry_run=True)` over the `SourceListing` —
then the preview and the ingest can never disagree, which is the failure mode a separately-written
preview always eventually has.

⚠ The `already_here` arm needs the bytes to compute `content_hash`, and the preview's whole point is
to be cheap. Resolution: the preview checks **two** cheap keys first —
`connector_watch_items.external_id` (have we seen this file?) and `documents.content_hash` for any
hash the watch already recorded — and only falls back to a byte read when a person asks for an exact
answer on one file. **State the preview's honesty limit in the UI** (*"n files look new"*), rather
than claiming certainty a listing cannot provide.

---

## Data Flow

### State management (frontend)

`LibraryPage.tsx` uses a single reducer (`pageReducer` at `:118`, delegating to the leaf
`libraryReducer`) and mounts each tab body as a **child with its own data fetching** — its own comment
at `:125-127` states *"each tab body is a CHILD component with its own data fetching and state, so no
conditional branch enters this component."* A Sources tab must follow that: a `SourcesTab` child, its
own hook, zero new `useState` in `LibraryPage`.

`useDocuments.ts` reconciles by fetch on (re)connect (D-v2.5-03 — Realtime is a hint, never truth). A
watch tick writing many `documents` rows will fan out many Realtime events; the existing reconcile
absorbs that, but the ingest **progress** surface should read the `ingestion_jobs` table on an
interval rather than adding a second Realtime subscription.

---

## Scaling Considerations

| Scale | Adjustment |
|---|---|
| 1 connection, ~10² files | Everything above, in-process, `INGEST_MAX_CLAIMS_PER_TICK=2`. No new process. |
| ~10³–10⁴ files / org | First bottleneck is **embedding**, not the queue: `embed_chunks` sends every chunk of a document in **one** request (`SEED-077`), and embeddings have **no provider fallback** (`SEED-048`). Batch + fallback before adding workers. |
| ~10⁵+ chunks | Second bottleneck is **filtered-vector recall**: `match_document_chunks` applies `is_latest`, `metadata @> filter`, `p_folder_ids`, `p_embedding_model` **and now the visibility disjunct** around an ANN scan. The new `connection_grants_org_visibility` term is why the partial index on `documents(source_connection_id)` is not optional. `SEED-076` owns this. |
| Multi-tenant, many orgs | Third: the claim query is global. Add a per-org fairness term to `claim_ingest_jobs`' `ORDER BY` (e.g. `ORDER BY org_inflight ASC, created_at`) so one tenant's 50k-file backfill cannot starve every other tenant. **Design the ORDER BY at build time; retrofitting fairness onto a running queue means a backlog nobody can drain.** |

**Scaling priority order:** embed batching → embedding fallback → the visibility index →
queue fairness → a separate `WORKER_ROLE=ingest` process.

---

## Anti-Patterns

### Anti-Pattern 1: A second ingest path per family

**What people do:** `if service_id == "graph": ...` beside the Drive branch.
**Why it's wrong:** it is already happening — `cloud_storage.py:32` and `:165` both branch on
`if "google" in service_id.lower()` with a silent empty-list / `NotImplementedError` fallback. Four
families on that shape is four milestones wearing one name.
**Do this instead:** `sources/registry.get_adapter(kind)`, and retire `cloud_storage.py` into
`drive_adapter.py` in the phase that introduces the contract.

### Anti-Pattern 2: A second document-row INSERT

**What people do:** build a `documents` dict at the new call site.
**Why it's wrong:** measured — `connectors.py:1687-1697` did exactly this and produced a row with a
column that does not exist, no `content_hash`, no `is_latest` and no `version_number`.
**Do this instead:** `ingest_splice.mint_document_row()`, always.

### Anti-Pattern 3: Widening the DEFINER retrieval functions before the RLS policies

**Why it's wrong:** the agent retrieves and cites chunks the Library refuses to display. The reverse
order is merely annoying; this order is a leak that looks like a feature.
**Do this instead:** policies first, DEFINER bodies last, one transaction, negative case driven RED
against all four sites before the widening.

### Anti-Pattern 4: `missing` from an incomplete listing

**Why it's wrong:** a 429 mid-pagination marks the whole corpus deleted.
**Do this instead:** assert `SourceListing.complete` before writing any `missing`.

### Anti-Pattern 5: Treating email as a fourth adapter

**Why it's wrong:** PROJECT.md flags it at scoping and the code agrees. Drive/Graph/MCP-file are one
shape — *a file with a path and a hash*. A mailbox is threads, quoting and attachments-as-children
with **no stable document boundary**, and the tree already carries that complexity as a special case:
`ingest_document` at `documents.py:2380-2444` inserts a **child** `documents` row per attachment plus
an `attached_to` `document_relationships` row and then **recurses into itself**. `external_id`,
`content_hash` and *"one file, one document"* are all ill-defined for a thread.
**Do this instead:** give email its own phase, its own discuss-phase and its own shape decision,
sequenced **last**, so that if it is cut three families still ship. If it forces a change to
`SourceFile`, that change is the finding.

### Anti-Pattern 6: Inheriting `send`'s "no retry, ever" rule inbound

**Why it's wrong:** `connectors/protocol.py` forbids retry because a duplicated *send* is worse than a
missing one. Inbound is idempotent by `content_hash`; refusing to retry there just loses files to
transient 429s.
**Do this instead:** the queue owns retry; the adapter owns *classification* (`SourceRateLimited`
carries the hint, the queue decides the curve).

---

## Integration Points

### External services

| Service | Integration pattern | Gotchas |
|---|---|---|
| Google Drive | `drive_adapter` → `send_pinned_http("drive_read", ...)`; token from `oauth_refresh_service.get_fresh_access_token(connection_id)` | Google-native Docs/Sheets **export** (no bytes of their own) — `cloud_storage.py:_fetch_google_drive_file` already handles this and the logic must move, not be rewritten. Error bodies echo the user's query and **must not be logged** — `_google_error_reason()` extracts only the closed enum vocabulary (`status`, `errors[].reason`, `details[].reason`) |
| Microsoft Graph | `graph_adapter` → new `graph_read` egress key | ⚠ `@odata.nextLink` is a full URL — re-validate, never follow raw. `driveId`/`siteId` live in `SourceRef.params`. **Zero Graph code exists today** |
| MCP file servers | `mcp_client.list_tools()` / `call_tool()`; destination validated by `validate_mcp_destination` (`mcp_client.py:260`) | Tool names vary per server → store the binding as DATA on the watch. `ResolvedConnection.auth_scheme` must be honoured — `_build_auth_headers` infers Basic from a colon in the token, which was measured wrong for Notion's OAuth token |
| Email / mailbox | `mail_adapter` + the existing `email_extraction_service` | see Anti-Pattern 5 |

### Internal boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `sources/*` ↔ `connector_service` | `ResolvedConnection` passed in | adapters stay ABOVE the credential layer and never read the DB |
| `sources/*` ↔ `ingest_splice` | `SourceBytes` → `mint_document_row` → `splice_document` | the ONE splice; adapters know nothing about `documents` |
| `ingest_splice` ↔ `documents.ingest_document` | direct call, signature unchanged | `ingest_document` stays in `documents.py` this milestone |
| `watch_service` ↔ `ingest_queue` | **a table, not a call** — `ingestion_jobs` rows | the boundary that makes cap/retry/resume possible at all |
| `retrieval_service` ↔ visibility | **SQL only** | `retrieval_service.py` needs no change; four SQL sites do |
| `classification_matcher` ↔ watch routing | one AST, one matcher, two field whitelists | not a second engine |

---

## Sources

All primary, all read at HEAD on 2026-09-04:

- `backend/app/api/documents.py` — `_upload_pipeline:239`, `upload_document:547`, `reingest_document:1095`, `_assert_document_visible:850`, `ingest_document:2030`, chunk INSERT `:2338`, classification splice `:2469`, attachment cascade `:2380`
- `backend/app/api/connectors.py` — `list_connection_files:1616`, `import_connection_file:1650`
- `backend/app/services/cloud_storage.py` — `list_cloud_files`, `fetch_cloud_file`, `_list_google_drive_files`, `_fetch_google_drive_file`, `_google_error_reason`
- `backend/app/services/retrieval_service.py` — `_call_as_user:37`, `_vector_search:60`, `_keyword_search:103`, `_enrich_with_filenames:157`, `search_documents`
- `backend/app/services/scheduler_service.py` — module docblock, `launch_scheduled_run:54`, `_drive_run:216`, `SchedulerService:306`
- `backend/app/db/schedules.py` — `claim_due_schedules`, `record_schedule_outcome`, the three-place-lockstep docblock
- `backend/app/services/connectors/protocol.py`, `registry.py`, `grants.py`, `service_tools.py` (`SERVICE_TOOL_SPECS:86`)
- `backend/app/services/connector_service.py` — `ResolvedConnection:211`, `resolve_connection:639`
- `backend/app/services/mcp_client.py` — `list_tools:448`, `call_tool:471`
- `backend/app/security/egress.py` — `ALLOWED_HOST_SUFFIXES:242`, `_HOST_MATCH:291`, `_TLS_SCHEMES:311`
- `backend/app/services/classification_matcher.py`, `classification_rule_service.py`
- `backend/app/services/multimodal_service.py:435,:913` · `reembed_service.py:234`
- `backend/app/api/library.py` — the RLS-not-service-role precedent
- `supabase/full-schema.sql` — `documents:1123`, `folders`, `classification_rules`, `connector_connections`, `workflow_schedules`, `folder_is_org_shared:224`, `keyword_search_chunks:283`, `match_document_chunks:315`, policies `:5452`, `:5501`
- `supabase/migrations/` — 128 files, highest `152_*`; `124_workflow_schedules.sql` read as the new-table shape template
- `deploy/onebox.env.example:66-76` · `docker-compose.prod.yml:69-72`
- `docs/HOT-FILE-LEDGER.md` — `documents.py:2431`, `LibraryPage.tsx:6574`, `DocumentList.tsx:6560`
- `.planning/PROJECT.md` (v4.0 section) · `.planning/STATE.md` · `CLAUDE.md`

**Marked UNVERIFIED and needing a driven check before being planned around:**
1. Which failure mode `import_connection_file`'s `storage_path` INSERT produces at runtime (schema mismatch is verified; the runtime error is not).
2. Whether Drive shared-drive items are actually invisible today (the absence of `supportsAllDrives`/`corpora`/`includeItemsFromAllDrives` from `cloud_storage.py:107-120` is verified; the consequence is inferred).
3. Which callers of `search_documents` pass a user-scoped vs service-role `supabase` into `_enrich_with_filenames`.
4. Whether any Graph, delta-cursor or webhook code exists anywhere in the tree — I found none, but I searched `backend/app` only.

---

## 7. Build Order

Phase numbering continues at **228**, which `PROJECT.md` reserves for **v3.9 closeout**. The
dependency chain below is the load-bearing part; the numbers are indicative.

```
228  v3.9 closeout                                    (already decided — owed UAT, resume-path
                                                       bug cluster, code-review, app.<domain>)
        │
229  THE SPLICE EXTRACTION            ── REFACTOR ONLY, no user-facing capability
        │   services/ingest_splice.py · mint_document_row + splice_document
        │   re-point documents.py:716, :1185, connectors.py:1707
        │   FIX the ATTACH-01 storage_path / content_hash / is_latest defect
        │   discharges the G-5 obligation the ledger records as owed on documents.py
        │
230  THE DURABLE QUEUE                mig 153_ingestion_jobs.sql
        │   db/ingest_jobs.py · services/ingest_queue.py · main.py lifespan · INGEST_* vars
        │   + docker-compose.prod.yml / onebox.env.example / OPERATOR.md, SAME COMMIT
        │   ⭐ PROVE IT ON /upload FIRST — re-point the shipped upload route at the queue,
        │      so cap/retry/resume are proven by the path with 30 phases of coverage,
        │      BEFORE any connector uses it. A queue whose first customer is a new adapter
        │      makes every red run ambiguous between the two.
        │
        ├──────────────────────────────┬───────────────────────────────────────────────
        ▼                              ▼
231  VISIBILITY MODEL             232  ADAPTER CONTRACT + GOOGLE DRIVE
     mig 154 · the 4-site widening     services/sources/{protocol,registry,hashing,cursor}
     policies FIRST, DEFINER LAST      + drive_adapter.py; retire cloud_storage.py
     ⚠ THREAT MODEL MANDATORY          re-point connectors.py:1616 / :1650
     the UI's plain sentence           ONE family, proving the seam
        │                              │
        └──────────────┬───────────────┘
                       ▼
                 233  THE PREVIEW / DRY RUN      (no migration)
                       │  cheap ONLY now: list() exists, mint_document_row's three-way
                       │  verdict exists, ALLOWED_MIME_TYPES refusal exists.
                       │  preview == mint_document_row(dry_run=True) over a SourceListing.
                       ▼
                 234  THE WATCH LOOP + FIRST REAL SYNC
                       │  migs 155 connector_watches · 156 connector_watch_items
                       │       · 157 documents_source_state
                       │  services/watch_service.py · db/watches.py · api/sources.py
                       │  the lifecycle diff + the complete=True assertion
                       │  ⭐ THIS COMMIT RETIRES THE CLAUDE.md RULE (SEED-142)
                       │  ⚠ THREAT MODEL: untrusted content enters the answered corpus
                       │     (SEED-188 anti-injection actually attacked; SEED-079/072)
                       ▼
                 235  ONE RULE ENGINE                 mig 158
                       │  classification_rules gains rule_scope + a SOURCE_FIELDS whitelist
                       │  ⚠ after 234, because a routing rule needs a real corpus to tune
                       │     against and SourceFile's fields must be real first
                       ▼
        ┌──────────────┴──────────────┐
        ▼                             ▼
236  MICROSOFT GRAPH             237  MCP FILE SURFACE
     + graph_read egress key          tool binding stored as DATA on the watch
     ⭐ if it is not SMALL,            ⭐ the "adding a source adds ROWS" proof
        232's contract was wrong
     — and THAT is the finding
                       │
                       ▼
                 238  EMAIL / MAILBOX     ⚠ A SHAPE PHASE, NOT AN ADAPTER PHASE
                       own discuss-phase · sequenced LAST so three families ship if it is cut
```

### Why this order, dependency by dependency

| Edge | Reason |
|---|---|
| 229 before everything | Every producer calls the splice. Extracting it while four producers exist means a red test cannot be attributed to one. It is also the only phase in the milestone with **no new capability**, which is exactly what G-5 asks for on a 30-phase file. |
| 230 before 234 | *"Nothing is ingested until a person says so"* and *"cap, retry and resume"* are queue properties. A watch that fans out to an in-process `BackgroundTask` has neither, and retrofitting a queue under a running watch means a backlog with no drain. |
| 230 proven on `/upload` | The queue's correctness must be measurable against a path that already has coverage. This is the single highest-leverage ordering decision here. |
| 231 before 234 | The moment the first connector document lands, ownership-based RLS stops being sound — `STATE.md` records this as *the* reason the milestone is v4.0. The visibility term must exist **before** there is a row that needs it, not after. |
| 232 before 233 | The preview is a pure function over `SourceListing`. Without the contract it is a Drive-shaped preview that has to be rewritten three times. |
| 229 + 232 before 233 | The three-way split *is* `mint_document_row`'s verdict. Building it separately guarantees the preview and the ingest eventually disagree. |
| 229+230+231+232 before 234 | Stated in the brief and confirmed by the code: the first real sync needs the splice (one document shape), the queue (cap/retry/resume), the visibility model (a permission envelope for rows nobody placed by hand), and the adapter (something to list). |
| 234 before 235 | A source-scoped routing rule needs `SourceFile`'s fields to be real and a corpus to tune against. |
| 236/237 after 232 | Their entire value as a test of the contract is that they should be *small*. Building them alongside 232 destroys that measurement. |
| 238 last | It is a shape decision that may change `SourceFile`. Last means three families still ship if it is cut. |

### Guardrail notes for the roadmapper

- **G-5** fires on `documents.py` (30 phases), `connectors.py` (11), `connector_service.py` (7),
  `main.py` (54), `config.py` (43), `LibraryPage.tsx` (11), `ConnectionsTab.tsx` (8),
  `ConnectionFormPanel.tsx` (7), `retrieval_service.py` (9), `multimodal_service.py` (7).
  **Phase 229 IS the refactor G-5 asks for** on the hottest of them; the rest are honoured by
  construction (new children, new modules, one added term). ⚠ Three of those rows were found STALE
  in the ledger the last time they were re-derived — **re-derive with the recipe, do not trust a cell.**
- **G-2** fires on the connect wizard, the preview's three-way split, the "stopped reading" card and
  the visibility sentence — all are *live UI* and *"feels like"*. Propose `/gsd:sketch` before
  `/gsd:plan-phase` on 231's UI half, 233 and 234's surface.
- **G-6** — `## How we'd know this failed` for 234 must include: *a 429 mid-pagination marked files
  missing*, *a document became visible to someone the connection owner did not choose*, *a source
  delete removed a Library document*, and *the same file was ingested twice*.
- **SC#10 cross-provider** does **not** fire on most of this milestone — ingestion is not a streaming
  or agent-loop surface. It DOES fire on anything touching the metadata-extraction model or
  `embed_chunks`' provider resolution.
- `scripts/check-deploy-drift.sh` gates 230 and 234. `scripts/vitest-count-gate.cjs` needs `TARGETS`
  and `BASELINE` entries for every new frontend suite, in the phase that creates it.

---
*Architecture research for: v4.0 Connected Knowledge — scheduled multi-source ingestion into an existing RLS-scoped RAG platform*
*Researched: 2026-09-04*

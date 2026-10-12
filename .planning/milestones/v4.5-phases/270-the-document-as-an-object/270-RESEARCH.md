# Phase 270: The Document as an Object - Research

**Researched:** 2026-09-30
**Domain:** Supabase Storage signed URLs behind a user-JWT/RLS gate · file-property extraction (pypdf / python-docx) · detail-panel fact rendering
**Confidence:** HIGH for code/DB facts (all measured this session); MEDIUM for Supabase Storage edge behaviour (official docs + issue tracker, one known defect)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Old-document backfill (FIND-05)
- **D-01:** NO backfill. Documents ingested before this phase show **"not recorded"** for any fact they lack. Never `0`, never a wrong date. New uploads fill the facts at ingest.
- **D-02:** Migration **199** adds **typed nullable columns** on `documents`: `page_count int`, `source_created_at timestamptz`, `source_modified_at timestamptz`, `source_author text`. Typed (not one jsonb) so Phase 271 filters them directly, per the `date_typed` precedent. Re-derive the migration number with `ls supabase/migrations` at plan time.
- **D-03:** Page count is one line at `extraction_service.py`'s page loop (SEED-243). Source dates/author come from PDF/DOCX document properties. Apply via SQL editor, regenerate `full-schema.sql` (no reset), run `get_advisors(security)`.

#### Download mechanism (FIND-04)
- **D-04:** **Signed storage URL, org-checked first.** The endpoint proves access through the **user-JWT / RLS path** (row must be readable by the caller) BEFORE minting. No URL is minted on refusal. Precedent shape: `workspace.py:588` `create_signed_url` wrapped in `run_in_threadpool` (D-v2.5-01). Never the service role before the check (the BUG-260903-02 shape).
- **D-05:** URL lifetime is an **`app_settings` setting, default 60 seconds**, not hardcoded. Deploy parity: seed row + `docs/OPERATOR.md` seed list + `deploy/onebox.env.example` if any env var is added.
- **D-06:** A document with **no stored file** (connector-ingested, empty `file_path`) shows the download control **disabled with visible words** ("File lives in <source>, not stored here"). No dead button, no 404. Fetch-from-source-on-demand is a new capability: deferred.

#### Version wording + control (FIND-04)
- **D-07:** **One button that names its target**: "Download v3 (latest)" or "Download v2 (viewed, not latest)"; single-version docs say "Download". It fetches exactly the version it names (SC#2, prove with hash vs `content_hash`).
- **D-08:** Placement: **visible labelled button in the panel header AND a list-row action** on `DocumentList.tsx`. Wording is never tooltip-only (OV-266-01). The list row always fetches its own row's version.

#### File-facts layout + dates (FIND-05)
- **D-09:** Two **separate labelled rows**: "Created in the file" (`source_created_at`) and "Added to Agentic RAG" (`documents.created_at`), plus "Last modified in the file". Never merged, never falling back to the upload date under the source label.
- **D-10:** **Every fact row is always present** with its honest value; a fact a file type lacks (CSV/email/image pages) reads "not recorded". Hiding rows cannot tell "does not apply" from "failed to read".
- **D-11:** **G-2 sketch SKIPPED, recorded decision.** Small addition on shipped surfaces reusing the panel's section pattern; visual contract goes into UI-SPEC/G-4 scenarios instead. Assert rendered CONTENT (labels + values), not testid presence.

### Claude's Discretion
- Exact endpoint path/name and response shape; where in the panel the facts block sits; uploader display (name vs email); size formatting; how the hash-equality check is scripted in the live drive.

### Deferred Ideas (OUT OF SCOPE)
- Backfill of old documents' file facts (script or lazy fill): consciously not done; revisit if "not recorded" proves noisy. Re-ingest fills a doc.
- Fetch original from the source connector on demand for docs with no stored file: new egress capability, own phase.
- Two-button (this version / latest) download layout: rejected for clutter.
- `BUG-260908-01` (chunks section unbounded) — stays open; plan may note the overlap.
- Seeds sweep could not run at discuss time; re-run at plan time.

### Approved UI contract (270-UI-SPEC.md, status: approved) + Operator ratification 2026-09-30
- **Q1 RATIFIED: option A.** A labelled per-version Download on each row of the version-history table inside `DocumentRow.tsx`. The detail panel does NOT open older versions; `LibraryPage` selection stays latest-only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIND-04 | User can download the original file of any document they can access; the UI states latest vs viewed version; the URL is short-lived and minted only after an org authorization check. | §Pattern 1 (RLS row read under user JWT → **service-role** storage sign; the storage bucket's own policy is owner-folder-only, so a user-JWT sign breaks for colleagues). §Pattern 3 (one label/request derivation). `content_hash = sha256(raw).hexdigest()` verified at the single mint site (`ingest_splice.py:173`). TTL setting pattern verified (`app_settings` is a wide single-row table; `template_ttl_hours` precedent). |
| FIND-05 | Document detail shows rich file facts: created, modified, pages, size, type, uploader. | §Pattern 2 (a new pure `file_facts` reader called once in `splice_document`, independent of which text engine ran — the "one line in the page loop" claim is measured FALSE). `DocumentResponse` must declare the new fields or they never reach the wire. Uploader-name source measured: `profiles` RLS is self-only and 0/41 profiles have a `display_name`. |
</phase_requirements>

## Summary

The phase is small on the surface and has **three measured traps underneath** that the CONTEXT decisions did not see.

**Trap 1 — the precedent signer is the wrong client.** Both `create_signed_url` precedents (`workspace.py:588`, `sandbox_outputs.py:76`) sign with the **user-JWT** client. They work only because the signer is always the file's owner. The `documents` storage bucket's SELECT policy is `(storage.foldername(name))[1] = auth.uid()` (`full-schema.sql:8254`), and Supabase requires `select` on `storage.objects` to create a signed URL. So a user-JWT mint returns "Object not found" for **every org colleague** who can see a shared-folder document (44 such documents exist locally), which is exactly the ROADMAP failure *"the download works for the uploader and 403s for an org colleague."* It also fails for 2 local rows whose `file_path` owner segment differs from `user_id`. The correct shape is: **authorize with an RLS row read on the user-JWT client, then mint with the service-role client, using `file_path` read from that authorized row.** D-04 forbids the service role *before* the check, and this shape honours it.

**Trap 2 — "one line at the page loop" is false.** `extraction_service.py:172` is `LegacyExtractor._extract_text`, which is not on the primary ingest path. `splice_document` calls `extract_composable`, whose text engine comes from `aspects.TEXT_ENGINES` (`legacy` or `pymupdf`), has an ordered fallback, and returns a `(text, markdown)` tuple contract. The page loop exists in three places. The robust approach is a new pure `read_file_facts(raw, mime)` function (pypdf + python-docx metadata, never raises) called once in `splice_document`, after the raw bytes are resolved. Re-ingest flows through the same function with `raw`, so re-ingest **does** fill old documents, which answers UI-SPEC Q2 "yes" and lets the footnote's "Re-ingest it to read them." ship.

**Trap 3 — D-06's premise does not hold on real data.** Locally, **0 of 208** documents have an empty `file_path`. The column is `NOT NULL`, and the single insert site (`ingest_splice.py:271-277`) always writes the canonical storage key. **73 of 75** connector-placed documents have a stored object and are downloadable. The only rows without an object are failed ingests and test fixtures. So the D-06 "disabled, lives in <source>" state cannot be reached today, and G4-4 ("Open a Google Drive connector-placed document with empty `file_path`") cannot be driven as written. The real "no bytes" case is a missing storage object, which surfaces at click time.

**Primary recommendation:** `POST /documents/{id}/download-url`. Gate with `_assert_document_visible` plus a narrow user-JWT row read. Sign with `get_supabase()` storage, with `options={"download": <filename>}`, inside `run_in_threadpool`. Return `{url, expires_in, version_number, filename}` with `Cache-Control: no-store`. Write file facts from a new `backend/app/services/file_facts.py` in a separate best-effort update inside `splice_document`. On the frontend, create three new units (`documentDownload.ts`, `DocumentDownloadButton.tsx`, `DocumentFileFacts.tsx`) and give the hot files mounts only.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Authorize a download (can this caller see this row?) | Database (RLS `documents` SELECT policy via user-JWT PostgREST) | API (`_assert_document_visible` mirror) | RLS is the single truth: org membership + owner / org-shared folder / connection visibility (`full-schema.sql:7022`) |
| Mint the signed URL | API (service-role storage call, after authorization) | Storage (JWT-signed URL, expiry enforced server-side) | The storage bucket policy is owner-only, so the API must sign on the caller's behalf once RLS has said yes |
| URL lifetime | Database (`app_settings` column) | API (clamp + default) | Rule: settings in `app_settings`, env vars for secrets/infra only |
| Read file facts (pages, dates, author) | API / worker (`splice_document`, threadpool) | Database (typed nullable columns, mig 199) | Bytes are only in hand at ingest; D-01 forbids backfill |
| Serialize facts to the client | API (`DocumentResponse` fields) | Realtime (`payload.new` carries real columns) | `response_model` filters undeclared fields |
| Label the version and trigger download | Browser (`documentDownload.ts`) | — | One derivation for both label and request (UI-SPEC) |
| Render facts + "not recorded" | Browser (`DocumentFileFacts`) | — | Pure function of the `doc` the panel already holds; no fetch |

## Standard Stack

No new packages. Everything is already installed and verified in the backend venv this session.

### Core
| Library | Version (measured) | Purpose | Why |
|---------|---------|---------|--------------|
| supabase / storage3 | 2.29.0 / 2.29.0 | `create_signed_url(path, expires_in, options={"download": str\|bool})` | Returns `{"signedURL","signedUrl"}`; raises `StorageApiError(message, code, status)` on failure. Signature read from the installed source [VERIFIED: venv `inspect.getsource`] |
| pypdf | 5.9.0 | `len(reader.pages)`, `reader.metadata.creation_date / modification_date / author` | Already the legacy text engine; `DocumentInformation` exposes all three [VERIFIED: venv introspection] |
| python-docx | 1.2.0 | `Document(io.BytesIO(raw)).core_properties.created / modified / author` | Already used for DOCX text [VERIFIED: venv introspection] |
| FastAPI `run_in_threadpool` | shipped | Wrap every sync supabase-py / storage / pypdf call | D-v2.5-01 |
| React + shadcn `Button`, lucide `Download`/`Loader2` | shipped | UI | UI-SPEC: no new shadcn component |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Service-role sign after RLS read | User-JWT sign (the precedent) | **Breaks for every non-owner** (storage policy is owner-folder-only). Rejected: this is the failure the ROADMAP names |
| Service-role sign after RLS read | Widen the `documents` storage SELECT policy to mirror table RLS | A storage-policy migration plus a `full-schema-supplement.sql` change for no gain. The API already has the authorized row. Rejected |
| New `file_facts.py` called in `splice_document` | Add page count inside each `TEXT_ENGINES` adapter | Changes the `(text, markdown)` adapter contract across 2+ adapters and the ordered fallback. Rejected |
| JSON response `{url,…}` | 302 redirect (the `sandbox_outputs` shape) | A 302 cannot carry `version_number`, so the client could not run the UI-SPEC version assert. Rejected |

**Installation:** none.

## Package Legitimacy Audit

This phase installs **no external packages**. Every library above is already pinned in the backend venv and was introspected directly.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none new) | — | — | — | — | not run (nothing to install) | n/a |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
DOWNLOAD (FIND-04)
 Browser click ─► documentDownload.startDocumentDownload(doc)   (label + request from the SAME doc)
      │  POST /documents/{doc.id}/download-url   (Bearer JWT; no URL exists before this)
      ▼
 FastAPI route
      ├─► [1] user-JWT client: _assert_document_visible(id)  ── not visible ──► 404, NOTHING minted
      ├─► [2] user-JWT client: select id,file_path,filename,version_number,org_id where id=…  (RLS again)
      │        └─ file_path empty ──► 409 reason_code=not_stored (reachable only in theory, see Trap 3)
      ├─► [3] load_app_settings_async().document_download_url_ttl_seconds  (clamp; default 60)
      ├─► [4] SERVICE-ROLE storage.from_("documents").create_signed_url(file_path, ttl,
      │                         {"download": filename})   in run_in_threadpool
      │        └─ StorageApiError (object missing) ──► 410 reason_code=file_missing
      └─► [5] 200 {url, expires_in, version_number, filename}  + Cache-Control: no-store
      ▼
 Browser: assert response.version_number == labelled version ─ mismatch ─► error, no navigation
      └─► transient <a href=url> click → Supabase Storage (JWT-signed, expires server-side)
              → Content-Disposition: attachment → original bytes (sha256 == content_hash)

FILE FACTS (FIND-05)
 /upload · watch · import · email · reingest ─► splice_document(raw)
      ├─ raw resolved (BUG-260905-08 guard passed)
      ├─► run_in_threadpool(read_file_facts, raw, mime)  ─ never raises; None per unreadable fact
      ├─► SEPARATE best-effort UPDATE documents SET page_count, source_created_at,
      │        source_modified_at, source_author          (never merged into a status write)
      └─► extraction / chunking / embedding (unchanged)
 GET /documents ─► DocumentResponse (+4 optional fields) ─► DocumentFileFacts (8 rows, "not recorded")
 Realtime UPDATE payload.new carries the 4 real columns ─► spread-merge (useDocuments)
```

### Recommended Project Structure
```
backend/app/
├── services/file_facts.py          # NEW: read_file_facts(raw, mime) -> FileFacts (pure, never raises)
├── services/ingest_splice.py       # +1 threadpool call +1 best-effort update (FIRES: mounts only)
├── api/documents.py                # +1 route (DISCHARGED at 229)
├── models/document.py              # +4 optional fields on DocumentResponse, +response model  ⚠ NO LEDGER ROW
└── models/user_settings.py         # +1 field, +1 _val line (FIRES)
supabase/migrations/199_document_file_facts.sql    # DDL only (no UPDATE/INSERT, see Pitfall 9)
frontend/src/
├── lib/documentDownload.ts                         # NEW: downloadLabel + startDocumentDownload
├── lib/api/documents.ts  (+ re-export in lib/api.ts) # getDocumentDownloadUrl, BOTH knobs of D-207-06
├── components/metadata/DocumentDownloadButton.tsx  # NEW
├── components/metadata/DocumentFileFacts.tsx       # NEW
├── components/metadata/DocumentDetailPanel.tsx     # 1 import + 2 mounts (FIRES)
├── components/ingestion/DocumentRow.tsx            # row action + version-history action  ⚠ NO LEDGER ROW
└── types/index.ts                                  # optional fields on Document (seam OWED)
```

### Pattern 1: RLS read under the user JWT, then service-role sign (the load-bearing security pattern)
**What:** Authorization is a row read that RLS must allow. The signing credential is used only after that, only for the `file_path` from that row, and never on a path the client supplied.
**When:** Always, for this endpoint.
**Why not the precedent:** `documents` bucket policy `"Users can read own documents"` = `bucket_id='documents' AND (storage.foldername(name))[1] = auth.uid()::text` [VERIFIED: full-schema.sql:8254]. Supabase states that creating a signed URL needs `select` on `storage.objects` [CITED: supabase.com/docs/reference/python/storage-from-createsignedurl]. A denied RLS check on the signer comes back as "Object not found" [CITED: github.com/supabase/supabase-flutter/issues/1051]. That error looks identical to a missing file.

```python
# Source: shape of documents.py:850 (_assert_document_visible) + workspace.py:586-606 (sign) + upload's D-05 carve-out comment
@router.post("/{document_id}/download-url", response_model=DocumentDownloadUrl)
async def create_document_download_url(
    document_id: str,
    response: Response,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),        # authorization
    # D-04 carve-out: STORAGE SIGN ONLY, and only AFTER the RLS read below. The documents
    # bucket's SELECT policy is owner-folder-only, so a user-JWT sign refuses every colleague.
    service_supabase: Client = Depends(get_supabase),
):
    await _assert_document_visible(document_id, current_user["id"], supabase)   # 404 → nothing minted
    row_res = await aexec(
        supabase.table("documents")
        .select("id, file_path, filename, version_number, org_id")
        .eq("id", document_id).maybe_single()
    )
    row = row_res.data if row_res is not None else None
    if not row:
        raise HTTPException(404, "Document not found")
    if not row.get("file_path"):
        raise HTTPException(409, {"reason_code": "not_stored", "message": "..."})
    ttl = _clamp_ttl((await load_app_settings_async()).document_download_url_ttl_seconds)
    try:
        signed = await run_in_threadpool(
            service_supabase.storage.from_("documents").create_signed_url,
            row["file_path"], ttl, {"download": row["filename"]},
        )
    except StorageApiError:
        raise HTTPException(410, {"reason_code": "file_missing", "message": "..."})
    url = signed.get("signedURL") or signed.get("signedUrl")
    if not url:
        raise HTTPException(500, "Failed to generate download URL")
    response.headers["Cache-Control"] = "no-store"
    return {"url": url, "expires_in": ttl, "version_number": row["version_number"], "filename": row["filename"]}
```
Notes: `_assert_document_visible` alone is narrower than RLS. It checks owner or global folder, not the `connection_doc_is_visible` arm. That keeps download visibility equal to what the Library list and the panel's other reads show (`list_documents` uses the same owner/global-folder rule). **Never log `url`.** Never put it in audit metadata.

### Pattern 2: File facts are read once, from bytes, beside extraction and not inside it
```python
# backend/app/services/file_facts.py  (NEW, pure, no I/O besides parsing `raw`)
@dataclass(frozen=True)
class FileFacts:
    page_count: int | None = None
    source_created_at: datetime | None = None
    source_modified_at: datetime | None = None
    source_author: str | None = None

def read_file_facts(raw: bytes, mime: str) -> FileFacts:
    """Never raises. Each fact is independently best-effort; an unreadable fact is None
    ("not recorded"), never 0 and never a substituted date (D-01/D-09)."""
    if mime == PDF_MIME:   # pypdf: each property in its OWN try — parse_iso8824_date raises on malformed dates
        ...  # page_count = len(reader.pages) if > 0 else None ; reader.metadata.creation_date / modification_date / author
    elif mime == DOCX_MIME:  # python-docx core_properties.created / modified / author
        ...  # pages: docProps/app.xml <Pages>N</Pages> via zipfile + a bytes regex (no XML parser → no XXE); None when absent/0
    return FileFacts()
```
In `splice_document`, after the BUG-260905-08 empty-bytes guard (`ingest_splice.py:483-502`), run the reader and issue a separate, swallowed update:
```python
facts = await asyncio.wait_for(run_in_threadpool(read_file_facts, raw, mime_type), timeout=10)
try:
    await _db(lambda: supabase.table("documents").update(facts.as_row()).eq("id", document_id).execute())
except Exception:
    log.warning(...)   # a facts failure NEVER fails an ingest
```
All five minting doors reach `splice_document` with bytes: `/upload` (via queue worker or `_upload_pipeline`), `watch_service`, `import_service`, `email_attachments`, and `/reingest` (`documents.py:1255` passes `raw`) [VERIFIED: grep of `splice_document(` / `_upload_pipeline` call sites].

### Pattern 3: One derivation for label and request (frontend)
```ts
// frontend/src/lib/documentDownload.ts: the ONLY place the label is derived and the request made
export function downloadLabel(doc: Pick<Document,"version_number"|"is_latest">, o: { viewing: boolean }): string {
  const n = doc.version_number ?? 1
  if (n <= 1) return "Download"
  return doc.is_latest !== false ? `Download v${n} (latest)` : `Download v${n} (viewed, not latest)`
}
export async function startDocumentDownload(doc: Document): Promise<void> {
  const res = await getDocumentDownloadUrl(doc.id)           // same doc.id the label read
  if ((doc.version_number ?? 1) !== res.version_number) throw new VersionMismatchError(doc.version_number)
  const a = document.createElement("a"); a.href = res.url; a.rel = "noopener"
  document.body.appendChild(a); a.click(); a.remove()        // used once, never stored in state
}
```
The API function lives in `lib/api/documents.ts` **and must be re-exported from `lib/api.ts`**. `apiBarrel.test.ts` fails if the re-export is missing (D-207-06). UI-SPEC's "never the barrel" means "define it in the module". It does not mean "skip the re-export".

### Anti-Patterns to Avoid
- **User-JWT `create_signed_url` for documents.** It works in every owner-only test and fails for every colleague.
- **Accepting a path, bucket or version from the client.** The route takes `document_id` only, and `file_path` comes from the authorized row.
- **Merging fact columns into a status UPDATE.** If migration 199 is missing (cloud before migration, a stale local DB), PostgREST rejects the unknown column and the status write dies with it.
- **Computing facts inside a text-engine adapter.** The fallback loop means the engine that ran is not the engine you edited.
- **`{doc.page_count || "not recorded"}`-style falsy checks written as `?? 0`**, or rendering `formatBytes(0)` ("0 B"). Guard `null` **and** `<= 0` explicitly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Signed expiring URLs | HMAC tokens / a byte-streaming proxy | `storage3.create_signed_url` | Expiry is enforced by Storage, and revocation is not self-service anyway [CITED: supabase.com/docs/guides/storage/serving/downloads] |
| PDF dates | A regex over `D:YYYYMMDD…` | `pypdf` `DocumentInformation.creation_date` (`parse_iso8824_date`) | Offsets, partial dates; wrap in try, because it raises on malformed input |
| DOCX core props | Parsing `docProps/core.xml` | `python-docx` `core_properties` | Already a dependency |
| Visibility rule | A new owner/folder check | `_assert_document_visible` (`documents.py:850`) + RLS | One gate for all detail reads; the panel cannot 404 what the list shows |
| Byte-size wording | New formatter | `lib/formatBytes.ts` (the one home) | Guard ≤ 0 before calling it |
| File extension | New parser | `extensionOf()` in `lib/fileTypeMark.tsx:189` | One home |
| Blob-save download (fallback only) | New helper | `downloadSandboxOutput` blob pattern (`lib/api/documents.ts:137-196`) | Proven Firefox-safe append/click/remove |

## Runtime State Inventory

Not a rename/refactor phase. Omitted, apart from one migration-ordering fact that behaves like runtime state: **the cloud DB must have migration 199 before the backend deploys.** Reads are fail-soft (`select("*")`, `_val` default). The separate facts write fails soft by design. If the plan adds a `document.download` audit type (see Open Q3), `assert_action_types_synced` (`audit_service.py:31`) makes the backend **refuse to boot** without the widened CHECK. That enforces the order, and it is also a deploy-availability risk.

## Common Pitfalls

### Pitfall 1: Signing with the user-JWT client
**What goes wrong:** Owner downloads work. Colleagues get "Object not found".
**Why:** The storage bucket policy is owner-folder-only (`full-schema.sql:8254`), unlike table RLS (`full-schema.sql:7022`).
**Avoid:** Pattern 1. **Test:** override `get_user_supabase_client` and `get_supabase` with **distinct** doubles (see Pitfall 2) and assert that storage is called on the service double only.
**Warning sign:** a test suite where every fixture's `user_id == mock_user_data["id"]`.

### Pitfall 2: The test harness hides which client did what
**What goes wrong:** `tests/conftest.py:116-135` mirrors the `get_supabase` override onto `get_user_supabase_client`, so by default both are the same mock. A test cannot tell an RLS read from a service-role read, and "service role before check" passes silently.
**Avoid:** In the route tests, set `app.dependency_overrides[get_user_supabase_client]` and `[get_supabase]` to two separate recorders that write into **one shared ordered call log**. Assert (a) the invisible-doc case makes **zero** storage calls on either double, and (b) the visible case logs the user-client `documents` read **before** `create_signed_url`. Restore overrides after the test (the conftest fixture at :153 does this for `get_supabase` only).

### Pitfall 3: D-06's trigger never fires
**What goes wrong:** A plan builds and live-drives the "File lives in <source>, not stored here" state against a Drive document and finds a working download instead.
**Measured:** 0/208 empty `file_path`. The column is `NOT NULL` and the single insert writes it. 73/75 connector docs have objects. The 7 docs without an object are 3 failed ingests + 4 test fixtures.
**Avoid:** Keep the disabled branch (keyed on falsy `file_path`, unit-tested, zero live instances), and surface the real no-bytes case as the click-time `410 file_missing` error ("The original file is missing from storage…"). Re-scope G4-4 before execution (Open Q1).

### Pitfall 4: "Page loop" edit on the wrong path
`extraction_service.py:172` is `LegacyExtractor`. The primary path is `extract_composable` → `aspects.TEXT_ENGINES` (`legacy_text` at `aspects/text.py:32`, `pymupdf_text` at `:59`) with an ordered fallback (`extraction_service.py:333-355`). Non-PDF/DOCX MIME types use `documents.extract_text` and never reach it. Use Pattern 2.

### Pitfall 5: New columns silently never reach the browser
`list_documents` does `select("*")`, but `response_model=DocumentResponse` (`models/document.py:30`) drops undeclared keys. Add the 4 fields as **optional with `None` default** (five routes build responses from narrow selects, and a required field 500s them, as the `extractor` comment at :50-53 records). Also add them to the frontend `Document` type as optional (the Realtime INSERT arm casts `payload.new` with no merge).

### Pitfall 6: Filename mangling in `Content-Disposition`
**What:** `?download=<name>` historically produced `filename=my%20file.pdf` and broke apostrophes, spaces and parentheses. Fixed by storage PR #1386 (Sep 2026) [CITED: github.com/supabase/storage/issues/1385]. The local storage-api reports **1.54.1** [VERIFIED: `GET :54321/storage/v1/version`]. Whether that includes the fix is **not verified**.
**Avoid:** A Wave-0 spike: mint one URL for a filename with a space, an apostrophe and an en-dash, run `curl -sI "$URL"`, and read the header, locally and on cloud. If it mangles, switch the save step to the shipped blob pattern (`a.download = doc.filename` on a same-origin `blob:` URL, which browsers honour) and keep `download` on the mint so direct opens still attach.

### Pitfall 7: `?raw` source fences over `documents.py`
Four frontend suites import `backend/app/api/documents.py?raw`: `IngestionStrip.test.tsx` (ORDERED `"ingestion_step": "<x>"` count), `ingestionFailureCopy.test.ts`, `acceptFormats.test.ts`, `renameFence.test.ts`. A backend test region-fences `.execute()` between `# ── Phase 217 · LIB-04` and `@router.post("/{document_id}/restore"` (`tests/test_217_document_detail_routes.py:425-452`).
**Avoid:** The new route writes no `"ingestion_step"` literal and uses `aexec` / `run_in_threadpool`, with no bare `.execute()`. Establish any red as NEW vs INHERITED by checking out the base commit (project rule).

### Pitfall 8: The barrel mock blast radius
About 20 suites mock `@/lib/api` with factories that do not declare new exports (DocumentList, DetailSections, LibraryPage×4, IngestionTab×3, etc.). vitest throws only when a missing export is **accessed**. The mint must therefore run **only on click**, never in render or an effect. New suites must declare `getDocumentDownloadUrl` in their factory.

### Pitfall 9: The migration accidentally reads as a seed
`scripts/check-deploy-drift.sh:181` warns on any `INSERT INTO` / `UPDATE` in migrations above the highest listed seed. Mig 199 should be **DDL only**. `ADD COLUMN … DEFAULT 60` fills the single `app_settings` row with no UPDATE. So no OPERATOR.md Step-3 entry and no env var (hence no `onebox.env.example` change). Update the prose line "Migrations currently run to **198**" in `docs/OPERATOR.md:299` **without spelling `199_<name>.sql`**, because the drift script greps the whole doc for that pattern.

### Pitfall 10: pypdf / python-docx data quality
- `parse_iso8824_date` raises on malformed dates, so wrap each property separately.
- PDF dates without an offset come back naive. Pick one rule (store as UTC) and document it. The displayed hour may shift [ASSUMED].
- Files generated by python-docx/docxtpl (the sandbox's own DOCX output) carry the library template's core props (author `python-docx`, a 2013 created date) [ASSUMED]. Show them as-is ("the file's own claim", per UI-SPEC row 6), but **do not use a generated DOCX as the G4-1 fixture**.
- Encrypted PDFs can raise on `metadata`/`pages`: every fact goes to None.
- DOCX `<Pages>` in `app.xml` is Word's last-saved count and can be absent or stale [ASSUMED].
- Cap `source_author` length in code (for example 512 chars).

### Pitfall 11: `page_count = 0` reaching the UI
Enforce it twice: the reader returns None for ≤ 0, and mig 199 adds `CHECK (page_count IS NULL OR page_count > 0)`, so "never `0 pages`" is a DB invariant rather than a UI hope.

### Pitfall 12: Cross-org proof is vacuous for a two-org account
RLS uses `current_user_org_ids()` (all memberships), not the active `X-Org-Id`. A user in both orgs **can** download org A's document by design (the list shows it too). Measured locally: 4 users are in 2 orgs and 37 are in 1. G4-5 must use a single-org user of org B, and must prove the active org first (MEMORY: the dev account is in two orgs).

### Pitfall 13: Frontend typecheck vacuity
`npx tsc --noEmit` checks zero files here. Use `npx tsc -p tsconfig.app.json --noEmit` and compare error **sets** against base (67 errors at base per CLAUDE.md).

## Code Examples

### TTL setting (one field, one read, fail-soft)
```python
# models/user_settings.py (FIRES: one field + one _val line; env_attr=None = app_settings-only)
document_download_url_ttl_seconds: int = 60
...
document_download_url_ttl_seconds=int(_val(row, "document_download_url_ttl_seconds", None, 60)),
```
```sql
-- supabase/migrations/199_document_file_facts.sql  (DDL only; paste in SQL editor)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS page_count integer,
  ADD COLUMN IF NOT EXISTS source_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_modified_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_author text;
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_page_count_positive;
ALTER TABLE public.documents ADD CONSTRAINT documents_page_count_positive
  CHECK (page_count IS NULL OR page_count > 0);
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS document_download_url_ttl_seconds integer NOT NULL DEFAULT 60;
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_download_ttl_bounds;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_download_ttl_bounds
  CHECK (document_download_url_ttl_seconds BETWEEN 10 AND 900);
COMMENT ON COLUMN public.documents.source_created_at IS 'Phase 270 (FIND-05): the date the FILE claims it was created (PDF/DOCX properties). NULL = not recorded. Never the upload date — that is created_at.';
-- … one COMMENT per new column (the house style)
```
The upper bound 900 s is discretion: it must stay well under the ROADMAP's "still works an hour later" failure. Clamp to the same bounds in code, so a hand-edited row cannot exceed them.

### Live proof scripts (SC#1, SC#3)
```bash
# SC#1: bytes == content_hash (Git Bash has sha256sum)
URL=$(curl -s -X POST -H "Authorization: Bearer $JWT" -H "X-Org-Id: $ORG" \
      http://localhost:8000/documents/$DOC/download-url | python -c "import sys,json;print(json.load(sys.stdin)['url'])")
curl -s "$URL" | sha256sum        # compare with: select content_hash from documents where id='$DOC'
# SC#3: expiry. Re-request the SAME URL after ttl+5 s (foreground sleep is blocked in this
# harness; use a background wait / Monitor). Expect non-200 from Storage.
curl -s -o /dev/null -w "%{http_code}\n" "$URL"
# SC#3: refusal. Org-B single-org user → 404 and a body with no "url" key
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 302 → signed URL (`sandbox_outputs.py`) | JSON `{url, version_number, …}` | this phase | The client can assert the version before navigating |
| `?download=name` header percent-encoded | RFC 6266/8187-correct header | storage PR #1386, Sep 2026 | Local 1.54.1 may predate it, so spike first |
| `created_at` shown as "created" | `source_created_at` vs "Added to Agentic RAG" | this phase | D-09 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Storage returns an error (not a URL) when signing a path with no object, so `StorageApiError` → 410 | Pattern 1 | The UI would show a generic failure instead of "missing from storage". Covered by a double + the live drive against a failed-ingest row |
| A2 | The `download` query param is not covered by the URL signature (a holder could strip it and render inline) | Security | Inline render happens on the storage origin, not the app origin. Low risk |
| A3 | A signed URL past `expiresIn` is refused by Storage (JWT `exp`) | SC#3 | SC#3 fails. The live drive proves it |
| A4 | Naive PDF dates stored as UTC | Pitfall 10 | The displayed hour shifts. Cosmetic |
| A5 | python-docx template core props appear in generated DOCX | Pitfall 10 | A misleading "2013" date on generated files, shown as the file's own claim |
| A6 | DOCX `app.xml` `<Pages>` is a usable page count | Pattern 2 | If treated as untrustworthy, DOCX shows "not recorded" |
| A7 | Local storage-api 1.54.1 filename behaviour | Pitfall 6 | A mangled saved filename; the spike decides |

## Open Questions (for the planner / operator before locking plans)

1. **D-06 is measured unreachable. How is G4-4 re-scoped?**
   - Known: 0/208 empty `file_path`; connector docs are stored and downloadable.
   - Recommendation: keep the disabled branch as defensive and unit-tested code. Re-word G4-4 to *"a Drive connector-placed document downloads its stored copy and its hash matches"*. Drive the missing-object error on a failed-ingest row. Record this as a decision, not a silent substitution.
2. **"Added by" for another member.** `profiles` RLS is self-only (`full-schema.sql:7087`), **0/41 profiles have `display_name`**, and member email is exposed only on the manager-only roster (`api/org.py:211-228`).
   - Recommendation: `You` (via an optional `currentUserId` prop threaded from `LibraryPage`, which already holds `user?.id`, rather than `useAuth()` inside the panel, which would add a supabase-auth side effect to about 20 suites). For connector docs, `<connection name> (connected source)` from a batched user-JWT `connector_connections.select("id, name")` in `list_documents` (`name` is column-granted to `authenticated`, `full-schema.sql:8468-8489`, and org-RLS'd). For other members, `name not available`. **Do not fall back to email** without an operator decision, even though UI-SPEC row 8 suggests it, because it widens email exposure beyond managers.
3. **Audit the mint?** Recommended: `document.download` in `VALID_ACTION_TYPES` + mig 199 widening `audit_log_action_type_check` (copy the **live** 24-value set via `pg_get_constraintdef`, not mig 170's list). Cost: the backend refuses to boot until the migration is applied (see Runtime State). It is not required by FIND-04. It is a security-logging nicety (ASVS V7).
4. **Version-row label wording.** The UI-SPEC Q1 body says `Download v{N} (not latest)`, and the ratification says `(viewed, not latest)` becomes reachable. Recommendation: use the single `downloadLabel(v, {viewing:true})`, giving `(viewed, not latest)`, so no second vocabulary appears. Note that `GET /versions` filters `user_id = caller` (`documents.py:812,822`), so per-version download is owner-only in practice. Colleagues get the latest from the list row.
5. **Navigation vs blob save.** Settled by the Pitfall 6 spike.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Postgres (54322) | migration apply, facts, fixtures | ✓ | reachable | — |
| Local Storage API (54321) | signing + expiry drive | ✓ | 1.54.1 | — |
| Backend (8000) | live drive | ✓ (200 on /health) | — | the operator starts it |
| Node | vitest / gates | ✓ | v24.19.0 | — |
| pypdf / python-docx / storage3 | facts + sign | ✓ | 5.9.0 / 1.2.0 / 2.29.0 | — |
| Single-org org-B user + shared-folder colleague docs | G4-5 | ✓ | 37 single-org users; 44 shared-folder docs with a colleague | — |
| Multi-version PDF/DOCX | G4-3 / SC#2 | ✓ | 3 locally | upload v2/v3 of a fixture |
| Supabase MCP (prod) | cloud mig 199 + `get_advisors(security)` | ✓ reads free | — | **writes need per-action operator approval** |
| Chrome MCP | G-4 drive | assumed | — | the operator drives |

**Missing, no fallback:** none.

## Security Domain

`security_enforcement: true`. The signed URL is a bearer token.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `get_current_user` (GoTrue validation + ban check) |
| V3 Session Management | no | stateless JWT |
| V4 Access Control | **yes, core** | RLS row read on the user-JWT client before any service-role use; 404 (not 403) for invisible, per the existence-leak invariant D-062-12 |
| V5 Input Validation | yes | only `document_id` accepted; `file_path` from the authorized row; Pydantic response model |
| V6 Cryptography | no hand-rolling | Storage-signed JWT URL |
| V7 Logging | yes | never log the URL; optional `document.download` audit without the URL |
| V8 Data Protection | yes | `Cache-Control: no-store`; no URL in DOM/state/console; TTL setting clamped 10–900 s |
| V12 Files | yes | always mint with the `download` option (`Content-Disposition: attachment`) so uploaded HTML/SVG never renders inline |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on `document_id` | Elevation / Info disclosure | RLS read first; 404 on invisible; zero storage calls on refusal (ordered-log test) |
| Service-role reach before authorization (BUG-260903-02 shape) | Elevation | Service client used for exactly one call, after the read; source fence + ordered-log test |
| Cross-org read | Info disclosure | RLS `org_id IN current_user_org_ids()`; driven with a single-org user |
| Token replay / leakage | Info disclosure | Short TTL; no-store; minted per click; never persisted or logged |
| Path traversal | Tampering | No path parameter exists |
| Stored XSS via inline render | Tampering | `download` option → attachment |
| TTL tampering | Tampering | DB CHECK + code clamp; no UI knob this phase |

Run `get_advisors(security)` after mig 199, locally (and in the cloud parity step). No new table means no new RLS, and the new columns inherit table-level grants (no column-level grants exist on `documents`, measured).

## Test Map (tdd_mode: on; nyquist_validation: off, so no VALIDATION.md)

| Req | Behaviour | Type | Where |
|-----|-----------|------|-------|
| FIND-04 SC#3 | invisible doc → 404 and zero storage calls on both doubles | unit | `backend/tests/unit/test_270_download_url.py` (**tests/unit**, the gated dir, not `tests/`) |
| FIND-04 SC#3 | visible doc: user-client read precedes service sign; TTL = setting; `no-store` | unit | same |
| FIND-04 SC#3 | TTL clamp + default when column absent (`_val`) | unit | same |
| FIND-04 | missing object → 410 `file_missing`; empty path → 409 `not_stored` | unit | same |
| FIND-05 | `read_file_facts`: PDF with dates/author/pages; malformed date → None; encrypted → all None; non-PDF → all None; ≤0 pages → None | unit | `test_270_file_facts.py` (build fixtures in-memory with pypdf `PdfWriter.add_metadata` / python-docx) |
| FIND-05 | `splice_document` writes facts in a separate update; failing update does not fail ingest | unit | `test_270_splice_writes_facts.py` |
| FIND-05 | `DocumentResponse` serializes the 4 fields; absent → null | unit | extend the `test_217_document_response_fields` pattern |
| FIND-04 SC#2 | label/request from the same doc; mismatch → no navigation; no `href` before click | vitest | `src/lib/__tests__/documentDownload.test.ts` |
| FIND-05 SC#4 | 8 labels verbatim; "not recorded" for null/0; never `0 pages`/`0 B`; no fallback of source dates to created/updated_at; footnote conditional | vitest (content, not testid) | `src/components/metadata/__tests__/DocumentFileFacts.test.tsx` |
| FIND-04 | button states; disabled uses dashed + `disabled:opacity-100`; row keeps 7 `<td>` | vitest | `DocumentDownloadButton.test.tsx` + a `DocumentRow` case |

Gates: backend `node scripts/check-backend-unit-baseline.cjs` (ceiling **71 failed**, zero headroom). Frontend `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root. **Adopt every new suite into BOTH knobs** (TARGETS + BASELINE; `src/components/metadata` is file-level adopted, never the directory). Use unique basenames, because `bareName()` makes BASELINE keys global. Typecheck: `npx tsc -p tsconfig.app.json --noEmit` as a set diff.

## Hot-File (G-5) Audit, re-derived 2026-09-30

| File | commits / phases / lines | Ledger row? | Plan posture |
|---|---|---|---|
| `backend/app/api/documents.py` | 89 / 34 / 2423 | yes (DISCHARGED 229) | +1 route; no `ingestion_step` literal |
| `backend/app/models/document.py` | 10 / **7** / 183 | **NO**: FIRES, gate will `[no-row]` | add the row in the first editing commit; additive optional fields |
| `backend/app/models/user_settings.py` | 56 / 34 / 1738 | yes (FIRES) | 1 field + 1 `_val` |
| `backend/app/services/ingest_splice.py` | 18 / 6 / 903 | yes (FIRES; row stale at 15/6/877) | 1 call + 1 swallowed update; logic lives in the new `file_facts.py` |
| `backend/app/services/extraction_service.py` | 8 / 5 / 405 | **NO** | **not modified** under this recommendation |
| `backend/app/services/audit_service.py` | 7 / **7** / 89 | **NO** (FIRES) | only if Open Q3 = yes; add the row |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` | 13 / 8 / 596 | yes (FIRES) | 1 import + 2 mounts (+1 optional prop if Q2 is taken) |
| `frontend/src/components/ingestion/DocumentRow.tsx` | 5 / 2 / 469 | **NO** | row action + version-history action; add the row at first edit |
| `frontend/src/components/ingestion/DocumentList.tsx` | 27 / — / 296 | yes (seam taken) | expected byte-unchanged |
| `frontend/src/types/index.ts` | 93 / 72 / 1443 | yes (seam OWED) | optional fields only |
| `frontend/src/lib/api/documents.ts` · `lib/api.ts` | 4/4/428 · 206/—/517 | yes | 1 fn + 1 re-export |
| `frontend/src/pages/LibraryPage.tsx` | FIRES per CLAUDE.md | yes | only if the `currentUserId` prop is threaded (1 line) |
| New files (`file_facts.py`, `documentDownload.ts`, `DocumentDownloadButton.tsx`, `DocumentFileFacts.tsx`) | — | — | rows at creation (the `settingsSearchPayload.ts` precedent) |

Run `node scripts/check-hot-file-ledger.cjs <phase-dir>` once the plans exist. **Seeds:** `check-seeds-register.cjs --phase 270` matched 0 with no plans. By `trigger_paths`, **SEED-313** and **SEED-318** will match (`documents.py` / `ingest_splice.py`). Both concern `/upload` org-stamping and versioning, which this phase does not change. Recommend **leave**, and record the routing. G-8: this is 3–4 plans (backend migration+facts · backend download route · frontend units + mounts · live drive/close), under the cap.

## Project Constraints (from CLAUDE.md)

- venv for the backend; raw SDK calls only (no LangChain/LangGraph); Pydantic for structured outputs.
- Every table has RLS. This phase adds columns only, and the new columns inherit `documents`' policies.
- **No blocking I/O in async handlers**: `run_in_threadpool` / `aexec` for supabase-py, storage and pypdf (D-v2.5-01).
- Migrations: `supabase/migrations/199_<name>.sql` (digits + underscore). **Paste into the SQL editor; never `db push` / `db reset`.** Then `bash scripts/regenerate-full-schema.sh` (no `--reset`). Never hand-edit `full-schema.sql`.
- Settings in `app_settings`; env vars for secrets/infra only. Deploy-artifact parity rule (same commit) applies if any env var is added (none is recommended).
- **Supabase MCP targets production.** Reads are free; **every write (including `apply_migration`) needs explicit per-action operator approval.** Run `get_advisors(security)` in the parity checklist.
- Deploys are operator-triggered only; migration before backend.
- Worktrees: bootstrap first (`scripts/bootstrap-worktree.sh`), tear down with `scripts/teardown-worktree.sh`, never `rm -rf`. Serialize any plan whose tests mutate the local DB.
- Backend baseline ceiling **71 failed**, zero headroom. Vitest cap `GSD_VITEST_MAX_WORKERS=2`; capture failing filenames from the gate's JSON before any re-run.
- G-4 lived-experience UAT via Chrome MCP (UI-SPEC G4-1..G4-5); assert rendered content.
- Hot-file ledger same-commit sync rule; the disposition cell is ≤ 200 chars (`check-claude-md-size.cjs`).
- The closed core (7 phase types / 1 emitter / 29 tools) is unchanged; this phase adds no agent tool.
- After code changes run `graphify update .`.
- Project skill `sketch-findings-agentic-rag` → `references/document-detail-panel.md` governs the panel shell and honesty-first states (already folded into UI-SPEC).

## Sources

### Primary (HIGH)
- Codebase, measured this session: `backend/app/api/documents.py` (:553-891, :1165-1265), `workspace.py:537-615`, `sandbox_outputs.py`, `dependencies.py:26-30,196-216,300-400`, `services/ingest_splice.py` (:76-347, :383-642, :855-903), `services/extraction_service.py`, `services/extractors/aspects/__init__.py`, `models/document.py:30-90`, `models/user_settings.py` (:355, :877-889, :1228, :1247), `supabase/full-schema.sql` (:1505-1535, :7022, :7087, :8254-8261, :8468-8489), `tests/conftest.py:116-135`, `frontend/src/lib/api/documents.ts`, `lib/api.ts:80-112`, `lib/__tests__/apiBarrel.test.ts`, `components/ingestion/DocumentRow.tsx`, `components/metadata/DocumentDetailPanel.tsx`, `scripts/check-deploy-drift.sh:160-189`, `scripts/check-hot-file-ledger.cjs:44-67`, `scripts/vitest-count-gate.cjs`
- Local DB queries (read-only, asyncpg): document/object/owner-path counts, audit CHECK (24 values), profile display names (0/41), org memberships
- Installed library source: storage3 2.29.0 `create_signed_url` / `_make_signed_url` / `StorageApiError`; pypdf 5.9.0 `DocumentInformation`; python-docx 1.2.0 `CoreProperties`
- [Supabase Python create_signed_url](https://supabase.com/docs/reference/python/storage-from-createsignedurl): `expires_in` seconds, `select` on `objects` required, `download` option
- [Supabase Storage: serving downloads](https://supabase.com/docs/guides/storage/serving/downloads): signed URLs valid until expiry; revocation only via support

### Secondary (MEDIUM)
- [supabase/storage#1385](https://github.com/supabase/storage/issues/1385): `?download=` Content-Disposition filename corruption, closed via PR #1386 (Sep 2026)
- [supabase/storage PR #195](https://github.com/supabase/storage/pull/195): download-with-filename feature
- [supabase-flutter#1051](https://github.com/supabase/supabase-flutter/issues/1051): createSignedUrl "Object not found" when the RLS select policy denies

### Tertiary (LOW)
- The assumptions in the Assumptions Log (A1–A7)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (installed versions introspected; no new packages)
- Architecture: HIGH (every load-bearing claim measured in code or the local DB)
- Pitfalls: HIGH for code/DB traps; MEDIUM for the Storage filename and expiry edge behaviour (spike + live drive settle them)

**Research date:** 2026-09-30
**Valid until:** 2026-10-14 (a fast-moving repo; re-derive the hot-file triples and the migration number at plan time)

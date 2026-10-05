---
phase: 270
slug: the-document-as-an-object
status: planned
nyquist_validation: false
created: 2026-09-30
---

# Phase 270 — Validation notes (success criteria → proof, failure mapping, G-4 scenarios)

> `nyquist_validation` is off, so this is not an auditor-generated VALIDATION.md. It exists because
> CLAUDE.md requires UAT rows to live in VALIDATION.md, never in PLAN.md tasks. Plan `270-05` drives
> every row below and records the evidence in `270-UAT-LOG.md`.

## Planning decisions (orchestrator defaults; operator may override each)

| ID | Decision | Why |
|---|---|---|
| **P-01** | **G4-4 re-scoped.** The D-06 disabled branch (keyed on a falsy `file_path`) is kept as unit-tested defensive code. It is NOT live-driven, because it has zero live instances (research Trap 3: 0/208 rows have an empty `file_path`; the column is `NOT NULL`; 73/75 connector docs have a stored object). The live drive instead proves (a) a Google Drive connector-placed document downloads its stored copy and its SHA-256 equals `content_hash`, and (b) a failed-ingest row with no storage object surfaces `410 file_missing` and the copy "The original file is missing from storage…". | A scenario that cannot be reached would pass by substitution. Recorded as a decision, not a silent swap. |
| **P-02** | **"Added by".** `You` when `doc.user_id === currentUserId` (optional prop threaded from `LibraryPage`, which already holds `user?.id`). Connector-placed docs: `<connection name> (connected source)` from a batched user-JWT `connector_connections.select("id, name")` in `list_documents` (`source_connection_name`), or `a connected source` when unresolved. Any other member: `name not available`. **No email fallback.** | `profiles` RLS is self-only and 0/41 profiles have a `display_name`; email is exposed only on the manager roster. UI-SPEC row 8's email fallback widens email exposure and needs an operator decision. |
| **P-03** | **No `document.download` audit type this phase.** Deferred as a seed (`270-05` plants it). | Adding it widens `audit_log_action_type_check` and makes the backend refuse to boot until the migration is applied (`assert_action_types_synced`). Not required by FIND-04. |
| **P-04** | **Version-history row label** uses the single `downloadLabel(doc)`: latest row `Download vN (latest)`, older rows `Download vN (viewed, not latest)`. No second vocabulary (`(not latest)`) ships. | One derivation for every label (UI-SPEC Pattern 3). |
| **P-05** | **Navigation vs blob save** is decided by the Wave-0 spike in `270-03` Task 1 (`curl -sI` on a signed URL for a filename with a space, an apostrophe and an en-dash, plus a CORS probe). Result recorded in `270-SPIKE.md`. | Local storage-api 1.54.1 may predate the `Content-Disposition` fix (storage PR #1386). |
| **P-06** | **Architecture (research).** Authorize with `_assert_document_visible` + a narrow user-JWT RLS row read; only then sign with the service-role client, using `file_path` from that authorized row. New pure `backend/app/services/file_facts.py`, called once in `splice_document` with a separate best-effort update. `DocumentResponse` declares the new fields. The API fn is defined in `lib/api/documents.ts` AND re-exported from `lib/api.ts`. TTL is an `app_settings` column `DEFAULT 60` with a `CHECK (10..900)` and a matching code clamp. Route tests use two distinct doubles writing into one ordered call log. | D-03's "one line in the page loop" is measured FALSE (the loop is `LegacyExtractor`, off the primary path); the user-JWT signer breaks for every org colleague (storage policy is owner-folder-only). D-04 is honoured: the service role is used only after the RLS check. |
| **P-07** | **Ledger rows are added by `270-01` for every file the phase touches** (before any other plan's first edit), and **triples are re-derived once by `270-05`**. | One owner of `docs/HOT-FILE-LEDGER.md` and `CLAUDE.md` per wave, so parallel worktrees never collide on them. |
| **P-08** | The empty-facts footnote **ships** `Re-ingest it to read them.` | `/reingest` passes `raw` to `splice_document` (`documents.py:~1255`), so re-ingest runs `read_file_facts`. `270-01` proves it; if the proof fails, the sentence is removed (UI-SPEC rule). |
| **P-09** | D-08's list-row action lands in `DocumentRow.tsx`; `DocumentList.tsx` stays byte-unchanged. | Since 217.1-05 the row body lives in `DocumentRow.tsx`. |

## Success criteria → proof

| SC | Truth | Automated proof | Live proof (270-05) |
|---|---|---|---|
| SC#1 | Download from list row and panel; bytes hash equals `content_hash` | `test_270_download_url.py` (route returns the authorized row's `file_path` signed with `download=<filename>`); `documentDownload.test.ts`; `DocumentRow` + panel mount tests | `curl` the minted URL, `sha256sum` == `select content_hash`; Chrome drive G4-3 |
| SC#2 | Control names latest vs viewed, fetches what it names | `documentDownload.test.ts` (label + request from the same doc; mismatch → nothing navigates); version-history row test | G4-3: a 3-version doc, v3 from panel + row, v2 from the version-history row, each hash-checked |
| SC#3 | Org-B refusal mints nothing; URL dies after TTL | `test_270_download_url.py` ordered call log: invisible doc → 404, zero storage calls on either double; TTL = setting, clamped; `Cache-Control: no-store` | single-org org-B user → 404 with no `url` key (active org proven first); same URL re-requested after TTL+5 s → non-200 |
| SC#4 | Created / modified / pages / size / type / uploader; source-created vs added labelled apart; old docs "not recorded" | `test_270_file_facts.py`, `test_270_splice_writes_facts.py`, `test_270_document_response_facts.py`, `DocumentFileFacts.test.tsx` (content, not testid) | G4-1 (2019 PDF), G4-2 (pre-270 doc) |

## How we'd know this failed (ROADMAP G-6) → the check that catches it

| Failure shape | Caught by |
|---|---|
| URL minted with the service role before any org check (BUG-260903-02 shape) | `test_270_download_url.py` ordered call log (zero storage calls on refusal; user-client read precedes `create_signed_url`) + the AST order fence in the same file |
| Link still works an hour later | TTL clamp test (upper bound 900 s) + mig 199 `CHECK (10..900)` + live expiry probe after TTL+5 s |
| A 2019 contract reads "created 2026" | `DocumentFileFacts.test.tsx`: `Created in the file` never renders `created_at`; G4-1 live |
| Old documents show `0 pages` | `read_file_facts` returns None for ≤ 0; mig 199 `CHECK (page_count IS NULL OR page_count > 0)`; component guard `null` and `<= 0`; G4-2 live |
| Panel shows v1 but the download returns latest | client version assert (`VersionMismatchError`, no navigation) + route returns the requested row's own `version_number`; G4-3 hash per version |
| Download works for the uploader and 403s for an org colleague | service-role signer after RLS (P-06) + a colleague (non-owner) case in `test_270_download_url.py`; G4-5 live with a shared-folder colleague |
| A deliverable word lives only in a tooltip / `title` | component tests assert visible text; G4-1..G4-5 read text at rest |
| A signed URL in the DOM, state or console | `DocumentDownloadButton.test.tsx`: no `href` before or after click; `documentDownload.test.ts`: the url is not returned or stored |
| Row `<td>` count changes from seven | `DocumentList.test.tsx` `toHaveLength(7)` (existing) + the new `DocumentRow` case |
| Weight 500 on a new element | `DocumentDownloadButton.test.tsx` asserts `font-semibold` / `font-normal` and no `font-medium` in the rendered class list |

## G-4 lived-experience scenarios (driven by Chrome MCP in 270-05, text asserted at rest)

| # | Scenario | Pass | Failure |
|---|---|---|---|
| G4-1 | Upload a PDF whose own properties say created in 2019 (build it with `pypdf` `PdfWriter.add_metadata({"/CreationDate": "D:20190312140300Z", "/Author": "…"})`; NOT a sandbox-generated DOCX). Open it in the panel | `Created in the file` reads a 2019 date; `Added to Agentic RAG` reads today; both visible at rest in the `File` section, above Details | "Created" reads 2026; one date row only; the facts are collapsed |
| G4-2 | Open a document ingested before this phase | `Pages`, `Created in the file`, `Last modified in the file`, `Author in the file` each read italic `not recorded`; the footnote (with `Re-ingest it to read them.`) is visible; size, type, added-to, added-by show real values | `0 pages`; a date equal to the upload date; missing rows; an empty value cell |
| G4-3 | On a 3-version document: panel `Download v3 (latest)`, the list row's `Download v3 (latest)`, and the version-history row `Download v2 (viewed, not latest)` | Each saves a file named with the original filename; each SHA-256 equals that version row's `content_hash` | label names one version and another arrives; file saved as a storage key; nothing happens on click |
| G4-4 (re-scoped, P-01) | (a) Open a Google Drive connector-placed document and download it. (b) Click Download on a failed-ingest row with no storage object | (a) Download succeeds, hash matches, `Added by` reads `<connection name> (connected source)`. (b) `The original file is missing from storage. Upload it again to make it downloadable.` visible without hovering | (a) a dead button or 404. (b) a generic error or a silent click |
| G4-5 | As an org colleague who can see a shared-folder document (not its uploader), download it. Then as a **single-org** member of a different org (active org proven first), request it | Colleague's download succeeds; the other-org member sees `You don't have access to this file, so no download link was created.` and no response body contains a URL | Works for the uploader only; refusal body carries a URL |

## Cross-provider UAT scoreboard (CLAUDE.md SC#10)

**Not applicable, recorded as a decision.** This phase touches no streaming path, agent loop, provider
routing or chat UI state; the closed core (7 phase types / 1 emitter / 29 tools) is unchanged and no
agent tool is added (`docs/EXTENSION-CONTRACT.md`). The Library UI state is covered by G4-1..G4-5.

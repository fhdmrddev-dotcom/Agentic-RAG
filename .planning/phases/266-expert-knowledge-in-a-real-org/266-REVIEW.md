---
phase: 266-expert-knowledge-in-a-real-org
reviewed: 2026-09-24T22:12:09Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - .gitattributes
  - backend/app/api/experts.py
  - backend/app/db/experts.py
  - backend/app/experts/corpora/financial-analyzer/acme_q3_2026_financial_report.md
  - backend/app/experts/corpora/financial-analyzer/manifest.json
  - backend/app/services/expert_corpus.py
  - backend/app/services/expert_install_service.py
  - backend/app/services/expert_service.py
  - backend/app/services/ingest_splice.py
  - backend/tests/integration/test_266_two_org_fence.py
  - backend/tests/unit/test_259_expert_entitlement_gate.py
  - backend/tests/unit/test_260_financial_analyzer_conversation.py
  - backend/tests/unit/test_266_corpus_verbatim.py
  - backend/tests/unit/test_266_install_idempotency.py
  - backend/tests/unit/test_266_install_queries.py
  - backend/tests/unit/test_266_install_route_gates.py
  - backend/tests/unit/test_266_install_service.py
  - backend/tests/unit/test_266_install_state.py
  - backend/tests/unit/test_266_migration_195_shape.py
  - backend/tests/unit/test_266_mint_org_scope.py
  - backend/tests/unit/test_266_resolver_reads_installs.py
  - backend/tests/unit/test_266_system_folder_bypass_fence.py
  - frontend/src/__tests__/components/FolderNode.test.tsx
  - frontend/src/components/chat/InviteExpertDialog.tsx
  - frontend/src/components/chat/__tests__/ComposerExpert.test.tsx
  - frontend/src/components/experts/catalog/ExpertCard.tsx
  - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
  - frontend/src/components/experts/catalog/ExpertDetailModal.tsx
  - frontend/src/components/experts/catalog/__tests__/ExpertCatalogPage.test.tsx
  - frontend/src/components/experts/catalog/__tests__/ExpertDetailModal.test.tsx
  - frontend/src/components/experts/catalog/__tests__/expertCatalog.test.ts
  - frontend/src/components/experts/catalog/expertCatalog.ts
  - frontend/src/components/ingestion/FolderNode.tsx
  - frontend/src/components/ingestion/FolderTree.tsx
  - frontend/src/components/ingestion/NavRow.tsx
  - frontend/src/lib/api/experts.ts
  - frontend/src/pages/LibraryPage.tsx
  - frontend/src/types/index.ts
  - scripts/full-schema-supplement.sql
  - scripts/vitest-count-gate.cjs
  - supabase/migrations/195_expert_installs_and_seed_retirement.sql
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
status: issues_found
---

# Phase 266: Code Review Report

**Reviewed:** 2026-09-24T22:12:09Z
**Depth:** standard (diff `522e7b4fc..HEAD`, with call chains traced into `run_producer`, `agent_loop`, `tool_dispatcher`, `retrieval_service`, `import_service._enqueue_or_splice`, `folders.py` and `match_document_chunks`)
**Files Reviewed:** 41
**Status:** issues_found

## Summary

Most of the tenancy work holds up under tracing:
- Every `expert_installs` statement binds `org_id = $1` from `get_active_org_id`.
- The install route has no body.
- `require_expert_manage` and `require_capability('experts')` both run before the service.
- The claim is a guarded `ON CONFLICT … WHERE` upsert with a 10-minute takeover.
- The `is_system_folder` bypass is gone, and its fence was driven RED.
- Migration 195 revokes from `PUBLIC` before it grants, and gives the client no write grant or write policy.
- Corpus paths are contained: `fullmatch`, a `..` refusal, and `resolve()` plus `is_relative_to` plus a parent-equality check.
- The four `mint_document_row` sites are org-scoped only when `org_id` is passed, and `/upload` still sends byte-identical queries.

The one blocker is downstream of the resolver, so no phase test looks at it. **A first-party Expert with no install now resolves to an EMPTY folder list, and the retrieval layer reads an empty list as "no filter".** Every uninstalled org, and every existing thread that already has the Financial Analyzer active, therefore gets *unscoped* search, including in `restricted` mode. Before 266 the scope was a non-empty (dead) folder list, which returned nothing. The only guard is the UI invite gate, which D-266-01's research default made UI-only. That gate does not cover threads that already have the Expert active, the catalog's `legacy` Start Chat arm, or a direct `PATCH /threads`.

The warnings are mostly about states the install can reach but never leave:
- a document stuck in flight;
- a completed document with zero chunks;
- an installer who left the org.

The rest are a second unique index that D-266-18 did not widen, filename versioning that crosses folders, and binary-corpus corruption.

## Critical Issues

### CR-01: An uninstalled first-party Expert runs UNSCOPED retrieval (the empty-scope run D-266-01 forbids, reached from the backend)

**Files:**
- `backend/app/services/expert_service.py:472-484` (the change)
- `backend/app/services/run_producer.py:488-502`
- `backend/app/services/agent_loop.py:1397-1398`
- `backend/app/services/retrieval_service.py:121,153`
- `supabase/full-schema.sql:386` (`match_document_chunks`)

**Issue:** For an `is_system` bundle with no `expert_installs` row (or a row whose `folder_id` was nulled by the FK), `raw_folder_ids = []`, so `resolved.effective_folder_ids == []`. `run_producer` turns that into `effective_folder_ids = ()` (in both `restricted` and `biased` mode, when the thread has no folder). `agent_loop` sets `folder_subtree_ids = []`. Then `_handle_search_documents` passes `folder_ids=[]`, and `retrieval_service` sends `folder_ids if folder_ids else None`, which is **NULL**. `match_document_chunks` evaluates `(p_folder_ids IS NULL OR …)`, so the folder filter is off. The Expert then searches the caller's whole knowledge base across **every org in `current_user_org_ids()`**. That makes the "Restricted" pill and the Expert's refusal contract (D-260-09, SC#4's "refused out-of-scope question") false.

Where it comes from:
- Before 266, the Financial Analyzer's scope was `[…0260]`, a non-empty list that returned zero rows. Phase 266 changed that to `[]`, so the regression is new.
- The other tools see the same scope differently. `_scope_set([])` is `set()`, so ls/tree/grep/glob return nothing, while `search_documents` returns everything. The tools disagree about the same scope.

Reachable today without any forged request:
1. Any thread whose `active_expert_id` was set to the Financial Analyzer before migration 195. `ChatArea.tsx:242-258` re-hydrates it, and `run_producer` resolves it without error.
2. Any org, right after deploy. No org has an install row yet.
3. The catalog's `legacy` arm: a first-party bundle with `install: null` (no corpus) shows Start Chat, and its `knowledge_folder_ids` has been overlaid to `[]`.
4. A direct `PATCH /threads/{id}` with `active_expert_id` (`threads.py` was deliberately left untouched).

`test_266_resolver_reads_installs.py::test_b` asserts `effective_folder_ids == []` and treats that as correct. Nothing asserts what retrieval does with it.

**Fix:** Fail closed at the seam the phase owns. In `resolve_expert_bundle`, keep an explicit "no knowledge" signal. For example, add `knowledge_unavailable: bool` on `ResolvedExpertBundle` when a first-party bundle has no install folder. Then either:
- refuse the run in `run_producer` the same way the F-1 fail-closed arm does (clear `active_expert_id`, raise a named refusal), or
- carry a sentinel scope that matches nothing.

```python
# expert_service.resolve_expert_bundle, system arm
raw_folder_ids = [install["folder_id"]] if install and install.get("folder_id") else []
knowledge_unavailable = bool(bundle.get("is_system")) and not raw_folder_ids
...
# after the strict caller-org loop:
if bundle.get("is_system") and not effective_folder_ids:
    knowledge_unavailable = True   # also covers a stripped install folder
```

Also add an end-to-end test from resolver to retrieval: an uninstalled system Expert, `search_documents`, and the assertion that the RPC receives a non-NULL scope or that the run is refused. (Separately, `retrieval_service` treating `[]` as `None` is itself a hazard for org-authored Experts with no folders. At minimum, record it as a seed.)

## Warnings

### WR-01: "Installing…" has no upper bound once the install row reads `installed`, and the UI then offers no way out

**File:** `backend/app/services/expert_install_service.py:200-208` (`derive_install_state`), `frontend/src/components/experts/catalog/expertCatalog.ts:171-172`
**Issue:** The staleness guard (`STALE_CLAIM_AFTER`) applies only while `status == "installing"`. After the copy step writes `installed`, arm 7 returns `installing` for as long as any corpus document is not `completed`/`failed`, with no time limit. A document can stay stranded:
- the queue worker dies;
- the job insert fails and the BackgroundTask fallback is lost when the process restarts;
- any re-drive, which (WR-06) always takes the non-durable path.

In that case the card and modal show a status line forever, `inviteGate` blocks invite forever, and there is no Install/Retry control, because `installing` maps to `status`. The catalog page also polls every 4 s for as long as it is open. RESEARCH Pitfall 4 ("never Installing… forever") is only half-closed.
**Fix:** Bound the in-flight arm by document age. Select `updated_at`/`created_at` in `list_install_corpus_documents`. If an in-flight corpus document is older than N minutes, derive `failed` with `STALE_INSTALL` (`cause_source="install"`), so a manager gets Retry. The retry path should also treat a stale `pending`/`processing` document like a `failed` one and re-drive it.

### WR-02: "Install failed — retry" for a zero-chunk document is a Retry button that can never change anything

**File:** `backend/app/services/expert_install_service.py:211-212` and `:574-577`
**Issue:** Arm 9 derives `failed` / `NO_SEARCHABLE_TEXT` when a present corpus document is `completed` with `chunk_count == 0`. Pressing Retry re-claims and walks the corpus. That document's `status != "failed"`, so the loop hits `continue  # present — never overwritten`. Nothing is minted or re-driven, the row is set back to `installed`, and the next read derives the same `failed`. The modal presents a control that does nothing. This is the "control that lies about itself" that the modal's own header warns against.
**Fix:** Either treat `completed && chunk_count == 0` as re-drivable in step 6 (it is the installer's own unedited copy only when `content_hash` equals the corpus sha, so check that before re-driving), or map this arm to a `status` view with no Retry and name the manual fix (delete the document, then Install).

### WR-03: Filename versioning crosses folders, so the install copy and a person's own same-named file knock each other out of retrieval

**File:** `backend/app/services/ingest_splice.py:229-243` (called from `expert_install_service.py:594`)
**Issue:** Version lookup and `is_latest` retirement are keyed on `(user_id, filename[, org_id])` and ignore the folder. If the installing admin already has a document named `acme_q3_2026_financial_report.md` anywhere in the org, installing retires its `is_latest`. `match_document_chunks` requires `d.is_latest = true`, so the admin's own document silently disappears from search.

It also works the other way. If the admin later uploads a same-named file anywhere in the org (`/upload` scopes by user only, so any of their orgs), the install copy loses `is_latest`. `list_install_corpus_documents` filters on `is_latest = true`, so the state drops to `not_installed` and the Expert's corpus leaves retrieval. The next Install then mints a new version and retires the person's file. The two keep displacing each other, and each switch deletes someone's knowledge from search without a message. D-266-14 says existing documents stay "untouched", but that holds only inside the install folder.
**Fix:** For the install path, scope versioning to the target folder. For example, add an opt-in `version_scope="folder"` on `mint_document_row` that adds `.eq("folder_id", folder_id)` to the version lookup and retirement, and pass it from `install_expert`. `/upload` stays unchanged. Alternatively, refuse the install with a named conflict when a same-named latest document exists outside the install folder.

### WR-04: D-266-18 widened only ONE of the two user-scoped unique indexes; root-folder imports into a second org now fail with a 409

**File:** `supabase/migrations/195_expert_installs_and_seed_retirement.sql:93-96`, `backend/app/services/ingest_splice.py:293-321`
**Issue:** `documents_dedup_idx` is still `(user_id, content_hash, COALESCE(folder_id, 0…0)) WHERE status <> 'failed'`, which is per user and not per org. For an org-scoped caller (`import_service`, `watch_service`, `email_attachments`) minting into the **root** (`folder_id` NULL, which is also what a watch gets after its folder is deleted, because the FK is `SET NULL`), when the same user already has those bytes at root in another org:
1. the org-scoped dedup check misses;
2. the insert hits a 23505 on `documents_dedup_idx`;
3. the link re-query, now org-scoped, finds nothing;
4. the call raises `409 "File already exists in this folder"`.

Before 266 this linked to the other org's row, which was wrong in a different way. After 266 it is a hard failure with a false message, and a watch will keep failing on it every cycle. The ingest_splice comment claims the check "is again exactly the constraint's predicate", and that is only true for the completed-hash index.
**Fix:** Widen `documents_dedup_idx` to `(org_id, user_id, content_hash, COALESCE(folder_id, …))` in the same migration (or a follow-up 196), mirrored into `full-schema-supplement.sql`/`full-schema.sql`. Add a `test_266_mint_org_scope` case for `folder_id=None` with a cross-org collision.

### WR-05: The install is unrecoverable once the installing admin leaves the org, or un-shares the folder

**File:** `backend/app/services/expert_install_service.py:415-427, 578-592, 633-636`; `backend/app/api/folders.py:169`
**Issue:** The folder and documents belong to the installer (D-266-12), and every repair path needs ownership:
- `mint_document_row` returns 403 for a non-owner folder, which becomes `FOLDER_NOT_OWNED`;
- a failed document returns `REDRIVE_NOT_OWNER`;
- the folder delete policy is `auth.uid() = user_id`.

If the installer is removed from the org, no remaining admin can restore a missing file, retry a failed one, or delete the folder so it can be recreated. The install is permanently `failed`, with a sentence telling people to "ask them", and "them" is no longer in the org.

Separately, if the installer toggles `is_org_shared` off, the `_ensure_folder` probe run by a *different* admin through RLS sees nothing. It then creates a second folder, repoints the install, and copies the corpus again. There is no log beyond `FOLDER_RECREATED`, and the original folder is left orphaned but still readable by its owner.
**Fix:** Give managers a supported recovery path. For example, when the folder owner is no longer an org member, let the install service (with `experts:manage` already proven) repoint to a new caller-owned folder. And on re-install, distinguish "folder deleted" (`get_expert_install(...).folder_exists is False` / `folder_id IS NULL`) from "folder invisible to me", using the pool-side `folder_exists` read rather than the RLS-filtered probe, and refuse the second case with a named sentence.

### WR-06: Every Retry of a failed document takes the non-durable legacy splice path (no retries, no lease, degraded metadata)

**File:** `backend/app/services/expert_install_service.py:489-501` → `backend/app/services/sources/import_service.py:121-166`
**Issue:** `_redrive_failed` hands `storage_path=row["file_path"]`, a key that already exists from the first attempt. The storage `upload` without upsert fails, `worker_enabled` is flipped to False, and the document goes to the `background_tasks.add_task(splice_document, …)` fallback. `_enqueue_or_splice`'s own docstring lists that path's defects: no `ingestion_jobs` row (so no retries or lease recovery), unbounded parallelism, and `extract_metadata_enriched` degrading to `None` inside a running loop. The in-code comment acknowledges this ("falls back to a direct splice") but treats it as acceptable. It means the Retry the UI offers is exactly the path that can strand a document (see WR-01), and a retried copy gets different metadata from a first install.
**Fix:** Before `_enqueue_or_splice` in the re-drive, either delete the old storage object or upload with `upsert=True`, so the durable queue path is taken. Or add an explicit re-enqueue helper that inserts the ingestion job without re-uploading (the bytes are already in storage).

### WR-07: A binary file added to a corpus would be silently corrupted, twice

**File:** `backend/app/services/expert_corpus.py:70-72, 159`; `.gitattributes:2`
**Issue:** `normalise_bytes` replaces every `\r\n` in **every** corpus file, whatever its `mime_type`. `.gitattributes` also declares `backend/app/experts/corpora/** text eol=lf`, which makes git convert line endings in any file under the corpora tree. Under the Extension Contract, adding a PDF, DOCX or XLSX sample to a corpus is a data-only change. Its compressed streams would be byte-mangled on checkout and again on load, then hashed into `corpus_version`, and would fail extraction at ingest. The failure would show up as a generic "Install failed". Nothing in the loader restricts corpora to text.
**Fix:** Normalise only text MIME types (`text/*`, `application/json`, markdown), and scope `.gitattributes` to text extensions (`*.md text eol=lf`, `*.json text eol=lf`, plus `* -text` for everything else in that tree). Or have `load_corpus` refuse non-text MIME types until binary corpora are designed for.

### WR-08: The "visible at rest" provenance test cannot see CSS hiding, which is the same class of false green this phase already shipped once

**File:** `frontend/src/__tests__/components/FolderNode.test.tsx:264-276` (and the stale header comment at `:216-217`)
**Issue:** The UAT fix case asserts `caption.toBeVisible()`. jsdom loads no Tailwind stylesheet, so `className="hidden"`, `sr-only`, `invisible` or `opacity-0` on the caption, or on NavRow's `flex-col` wrapper, would all still pass. The test name claims "visible WITHOUT hovering", but what it proves is "present in the DOM with no inline `display:none`". That is the presence-versus-content gap CLAUDE.md records. The block header still says "NavRow itself is not edited", which 266-05 made false.
**Fix:** Also assert the rendered class list carries none of the hiding utilities, for example `expect(caption.className).not.toMatch(/\b(hidden|sr-only|invisible|opacity-0)\b/)`, and do the same for its ancestors up to the row. Or cover it in the Chrome-MCP UAT row. Update the header comment beside the original rather than over it.

## Info

### IN-01: Library provenance is fetched once per mount and never follows an org switch or a new install

**File:** `frontend/src/pages/LibraryPage.tsx:416-429`
**Issue:** `useEffect(..., [])` reads `listExpertInstalls()` once. If the Library stays mounted across an org switch, or an install completes while it is open, the caption goes missing until the next remount. Folder ids differ between orgs, so it never shows a *wrong* label.
**Fix:** Key the effect on the active org id (and optionally on a Library refresh signal).

### IN-02: A failed re-read after a successful install is reported as an install failure

**File:** `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx:136-160`
**Issue:** If `installExpert` succeeds and the following `listExperts()` throws, the `catch` sets `installError` to "Failed to list experts". The install actually started, and the poll is already running from the applied 202 state.
**Fix:** Wrap only `installExpert` in the error arm, and let a failed re-read fall through silently (the poll reconciles it).

### IN-03: `SYSTEM_USER_ID` is kept as a dead constant

**File:** `backend/app/services/expert_service.py:15-17`
**Issue:** No reader remains in `app/`. It was kept only so a comment stays greppable, and a live constant invites someone to reintroduce the bypass.
**Fix:** Delete it. The retirement comment already quotes the UUID's role verbatim.

### IN-04: The BUG-260905-02 comment block in `mint_document_row` still quotes the pre-195 index

**File:** `backend/app/services/ingest_splice.py:176-190`
**Issue:** It says the index is `(user_id, content_hash)` and that the check is "the index's predicate, verbatim". After migration 195, `/upload`'s org-less check is *broader* than the constraint: a completed copy in another org is reported as a duplicate of the current upload, and org B receives nothing. D-266-18 accepted this, but the comment now contradicts both the schema and the D-266-18 note directly below it.
**Fix:** Mark the quoted index as superseded by 195 beside the original, and say what `/upload` now does for a two-org user.

### IN-05: A document's raw `error_message` travels in every Expert list response as `install.cause`

**File:** `backend/app/services/expert_install_service.py:205-206`
**Issue:** The UI classifies `cause_source == "document"` causes through `classifyIngestionError`, so nothing raw is rendered. The raw driver string is still in the JSON returned to every member on `GET /experts`. Those members can already read the document row itself, so this is not new exposure, but the API contract now carries an unclassified string that other consumers may render.
**Fix:** Classify on the server (or send only a cause code) so `install.cause` is a fixed sentence at the wire, as it already is for `cause_source == "install"`.

---

_Reviewed: 2026-09-24T22:12:09Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Resolution log (orchestrator, 2026-09-25)

| Finding | Outcome | Evidence |
|---|---|---|
| CR-01 | **FIXED** — confirmed by code trace first (`run_producer.py` restricted branch → `()`; `retrieval_service.py:121,153` sends `None` = no folder filter; Financial Analyzer is `scope_mode='restricted'` locally). Operator chose "refuse the run" (OV-266-02, overrides D-266-11). | RED `73cb9726a` (3 × DID NOT RAISE) · GREEN `2c4102070` · 608 passed across Expert/run_producer/scoping suites |
| WR-01..WR-08, IN-01..IN-05 | **OPEN — triage pending with the operator** after phase verification. | — |

### Triage (operator, 2026-09-25, after `266-SECURITY.md` closed 35/35)

Every finding was re-checked against the code before routing; all 8 warnings reproduce as written.
The superseded row above is kept, not overwritten.

| Finding | Routing | Evidence |
|---|---|---|
| WR-02 | **FIXED** — an unedited (`content_hash` == corpus sha), zero-chunk, caller-owned copy is re-driven by Retry; edited docs stay untouched | RED `582928777` · GREEN `cddf1f56b` · idempotency (viii)/(ix)/(x) |
| WR-07 | **FIXED** — `load_corpus` refuses non-text mime types; `.gitattributes` eol=lf scoped to `*.md`/`*.json` | RED `7c1470dda` · GREEN `299d93e94` |
| WR-08 | **FIXED** — caption test asserts no hiding utility on the caption or any ancestor; driven RED by planting `sr-only` on NavRow's wrapper, restored | `8aa3821fc` |
| IN-02 | **FIXED** — only `installExpert`'s rejection sets the error; a failed re-read is left to the poll | RED `487662c32` · GREEN `a733484ec` · catalog case (13) |
| IN-03 / IN-04 | **FIXED** — `SYSTEM_USER_ID` deleted; pre-195 index comment marked superseded beside the original | `79e756e88` |
| WR-04 | ~~FIX NEXT~~ **FIXED** — migration 196 widens `documents_dedup_idx` to `(org_id, user_id, content_hash, COALESCE(folder_id, …))`; added to `266-PROD-PARITY.md` step B. ⚠ Applied locally only after the operator's SQL-editor paste | RED `6be140fb9` · GREEN `45e045d92` |
| WR-03 | ~~FIX NEXT~~ **FIXED (install direction)** — `mint_document_row(version_scope="folder")`, passed only by the installer; `/upload` unchanged. The reverse direction (the admin's own later `/upload` retires the install copy) → **SEED-318** | GREEN `12587efaa` · mint (3 cases) + idempotency (xi) |
| WR-01 + WR-06 | **DEFERRED → SEED-315** (WR-06 was already SEED-315; WR-01 folded in). Fix before the first customer install | `SEED-315` |
| WR-05 + IN-05 (+ SECURITY W-1) | **DEFERRED → SEED-316** — an ownership decision (D-266-12), not a bug fix | `SEED-316` |
| IN-01 | **DEFERRED → SEED-317** — `LibraryPage` has no active-org handle to key on | `SEED-317` |

Gates after the fixes: backend `71 failed / 5665 passed / 0 errors` (at the 71 ceiling; the 39 unit
suites importing any changed module: **448 passed, 0 failed**) · vitest count gate
`total 8828 · failed 0 · pinned 8075 · 327/327`.

Gates after WR-03/WR-04: backend `71 failed / 5673 passed / 0 errors` (at the ceiling; the 40 unit suites
importing any changed module + the 196 shape test: **456 passed, 0 failed**). No frontend change.

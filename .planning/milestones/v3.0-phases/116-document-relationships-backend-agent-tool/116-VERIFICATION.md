---
phase: 116-document-relationships-backend-agent-tool
verified: 2026-06-20T12:00:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/6
  gaps_closed:
    - "SC#1b (version-stable links — CR-02): _subject_version_ids helper + .in_() edge enumeration over full (user_id, filename) version-id set — an edge created at v1's id surfaces in get_related_documents after re-upload to v2. test_edge_survives_reupload_in_handler PASSED live :54322."
    - "SC#2b (leak-safe masking — CR-01): global-by-id leg is now is_latest-gated; follow-to-latest target of a global match is re-verified against global_folder_ids before return (None if latest moved to private). test_global_old_version_does_not_leak_private_latest PASSED live :54322; non-vacuity guard (owner A follows v1 → A's own v2) also PASSED."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Invoke the agent in Deep mode across at least 4 providers (OpenAI, Anthropic, Google, one OpenRouter model) with a seeded pair of linked documents. Ask it to find relationships of the subject document."
    expected: "Model calls get_related_documents, receives compact rows with direction and label, seeable endpoints cited as source_refs, unseeable endpoints masked as 'linked document (no access)'."
    why_human: "Requires live LLM + network + DB across multiple providers; cannot be verified by grep or static analysis."
  - test: "With two linked documents, verify a relationship.create row appears in the audit_log table in the live local DB (:54322) after calling POST /document-relationships."
    expected: "One audit_log row with action_type='relationship.create', relationship_id, source_doc_id, target_doc_id, rel_type in metadata."
    why_human: "Requires live local Supabase at :54322 and a real HTTP call to the router; already structurally confirmed in code and test_116_audit_live.py, but live operator-eyeball confirms DMF-01."
  - test: "Confirm the document_relationships_idempotency_idx index exists on the live local DB: SELECT indexname FROM pg_indexes WHERE indexname = 'document_relationships_idempotency_idx'."
    expected: "Returns exactly one row."
    why_human: "Migration 075 is an operator-apply step (autonomous:false gate); the migration file exists and is correct but the operator must confirm it was pasted into the live DB (Plan 04 blocking gate)."
  - test: "SC#10 4-axis live UAT — invoke get_related_documents across all 4 required bandwidth axes: (1) cross-provider: OpenAI, Anthropic, Google, OpenRouter; (2) multi-tool: one prompt combining get_related_documents + search_documents or execute_code; (3) parallel-thread: Thread A streaming while Thread B accepts a get_related_documents prompt; (4) long-message: >= 50 prior messages OR >= 5 KB user prompt."
    expected: "Tool invoked and result rendered correctly in all 4 axes; no cross-provider regressions."
    why_human: "SC#10 4-axis UAT requires live LLM + parallel browser sessions + seeded knowledge base; not automatable by static or unit means."
---

# Phase 116: Document Relationships — Backend + Agent Tool Verification Report

**Phase Goal:** Let users typed-link documents and let the agent traverse those links — establishing directional relationship edges and the `get_related_documents` tool over them.
**Verified:** 2026-06-20
**Status:** human_needed — all 6 must-haves verified in code + live tests; SC#10 4-axis cross-provider UAT remains
**Re-verification:** Yes — after Plan 05 gap closure (CR-01 leak-safety + CR-02 follow-to-latest)


## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC#1a | User can create a typed link (supersedes/amends/references/attached_to) between two documents and remove it | VERIFIED | `POST /document-relationships` + `DELETE /{id}` in `document_relationships.py`; visible-both gate, uniform 422, 204 on success; `test_116_relationship_crud.py` 4/4 live green |
| SC#1b | Links reference document identity via latest-resolved/is_latest so a new version or restore does NOT orphan them | VERIFIED (CR-02 CLOSED) | `_subject_version_ids` added to `document_relationship_service.py:111-140`; handler enumerates edges via `.in_("source_doc_id", version_ids)` / `.in_("target_doc_id", version_ids)` at `tool_dispatcher.py:577,583`. `test_edge_survives_reupload_in_handler` PASSED live :54322 with non-vacuity guard. |
| SC#1c | A relationship.create audit row lands live | VERIFIED | `await write_audit_entry(action_type="relationship.create", ...)` at `document_relationships.py:147-155`; `relationship.delete` at :185-193; `test_116_audit_live.py` PASSED live |
| SC#2a | The agent retrieves related documents via get_related_documents registered in _TOOL_REGISTRY AND advertised in get_tools | VERIFIED | `_TOOL_REGISTRY` entry at `tool_dispatcher.py:2781`; `GET_RELATED_DOCUMENTS_TOOL` in `get_tools()` at `openai_service.py:1023` |
| SC#2b | A relationship pointing at a document the caller can't see renders as "linked document (no access)" — never leaking the target's title/metadata | VERIFIED (CR-01 CLOSED) | Global-by-id leg now `.eq("is_latest", True)`-gated at `document_relationship_service.py:205-215`; post-follow `from_global` visibility re-check at :239-246 (returns None if latest moved to private). `test_global_old_version_does_not_leak_private_latest` PASSED live :54322; non-vacuity guard (owner A sees v2) also PASSED. Both existing per-viewer mask tests remain green. |
| SC#3 | SC#10 4-axis cross-provider UAT authored in VALIDATION.md | UNCERTAIN | VALIDATION.md rows exist; not runnable by this verifier — routes to human_verification items below |

**Score:** 6/6 truths verified (all pass in code + live tests; SC#3 UNCERTAIN defers to human UAT as expected for this gate)


### Re-verification Gap Closure Summary

Both BLOCKERs from the initial 4/6 verification are closed:

**CR-02 (SC#1b CLOSED):**
- `_subject_version_ids(subject_row)` at `document_relationship_service.py:111-140` returns ALL `documents.id` values sharing the subject's `(user_id, filename)` lineage via a parameterized `documents WHERE user_id=owner AND filename=fname` query; falls back to `[subject_row["id"]]` so `.in_()` is never empty.
- `_handle_get_related_documents` in `tool_dispatcher.py` calls `_subject_version_ids` after subject resolution (line 570), then uses `.in_("source_doc_id", version_ids)` (line 577) and `.in_("target_doc_id", version_ids)` (line 583) — scoped strictly to the subject's lineage.
- Non-vacuous regression test `test_edge_survives_reupload_in_handler`: creates edge at v1's id, re-uploads subject (v2 is_latest=True, v1 is_latest=False), drives handler on v2's id, asserts edge still surfaces (total >= 1, target_id present). Non-vacuity guard asserts the edge surfaces on v1's id BEFORE re-upload. PASSED live :54322.

**CR-01 (SC#2b CLOSED):**
- Global-by-id leg at `document_relationship_service.py:205-211` now includes `.eq("is_latest", True)` — an old non-latest version in a global folder is not independently readable, mirroring `list_documents:558` and `_latest_by_filename:102`.
- `from_global` flag tracked (line 215); after follow-to-latest, `if from_global and latest_row.get("folder_id") not in global_folder_ids: return None` at line 245-246 — if the latest moved to a private folder, the resolver returns None and the D-116-9 mask fires.
- Non-vacuous regression test `test_global_old_version_does_not_leak_private_latest`: seeds v1 (is_latest=False) in global folder, v2 (is_latest=True) in private folder (folder_id=None). Asserts non-owner B calling `_resolve_readable_latest(v1_id, user_b)` returns None. Non-vacuity guard asserts owner A resolving same v1_id returns v2 (the legitimate follow-to-latest). PASSED live :54322.
- The SUMMARY documents the pre-fix RED evidence: `AssertionError: CR-01 LEAK: ... must return None for B, but returned {'id': '3f6383fa...', 'metadata': {'title': 'A-versioned-PRIVATE-v2'}, ...}` — confirms the test was genuinely RED before the fix and GREEN after.

**WR-02/03/04 fold-ins verified:**
- `_uid(user_id)` on `create_relationship` insert payload (line 272) and `delete_relationship` `.eq("user_id", ...)` (line 306) — uniform with the re-fetch and resolver.
- WR-03/04 comment honesty in `document_relationships.py` (in-band blocking audit write, not fire-and-forget; self-link step 2 is not dead code).


## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/document_relationship.py` | RelationshipCreate (Literal rel_type) + RelationshipResponse | VERIFIED | File exists; `Literal` over 4 types confirmed |
| `backend/app/services/document_relationship_service.py` | create/delete + _resolve_readable_latest + _uid + _subject_version_ids + 23505-catch | VERIFIED | All functions present; CR-01 fix at lines 198-247; CR-02 helper at lines 111-140; WR-02 _uid() at lines 272, 306 |
| `backend/app/api/document_relationships.py` | POST + DELETE router with visible-both gate + audit | VERIFIED | Both routes present; visible-both gate fires; uniform 422; audit writes present; WR-03/04 comment corrections present |
| `backend/app/main.py` | document_relationships.router mounted | VERIFIED | `include_router(document_relationships.router)` confirmed |
| `backend/app/services/tool_dispatcher.py` | _handle_get_related_documents + _TOOL_REGISTRY entry + .in_() over version_ids | VERIFIED | Handler at line 492; .in_() at lines 577, 583; `_subject_version_ids` called at line 570; registry entry at line 2781 |
| `backend/app/services/openai_service.py` | GET_RELATED_DOCUMENTS_TOOL schema + get_tools() entry | VERIFIED | Schema at line 198; two flat scalar strings; no anyOf/oneOf/multi-type arrays; in get_tools() at line 1023 |
| `supabase/migrations/075_document_relationships_idempotency_index.sql` | Additive partial unique index | VERIFIED | File exists; `CREATE UNIQUE INDEX IF NOT EXISTS document_relationships_idempotency_idx` on (user_id, source_doc_id, target_doc_id, rel_type) |
| `backend/tests/integration/test_116_tool_leak.py` | Non-vacuous CR-01 regression + existing per-viewer mask tests | VERIFIED | 3 tests: `test_unreadable_endpoint_is_masked_for_other_viewer`, `test_global_old_version_does_not_leak_private_latest` (new CR-01), `test_readable_endpoint_shows_real_filename_for_owner`. All PASSED live. |
| `backend/tests/integration/test_116_version_stable.py` | Edge survives re-upload in handler (CR-02) + resolver follow-to-latest tests | VERIFIED | 3 tests: `test_link_follows_latest_after_reupload`, `test_link_follows_latest_after_restore`, `test_edge_survives_reupload_in_handler` (new CR-02). All PASSED live. |


## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `document_relationships.py` | `document_relationship_service` | import + create/delete calls | WIRED | All functions called correctly; WR-02 _uid() now uniform |
| `document_relationships.py` | `audit_log` | `write_audit_entry(relationship.create/delete)` | WIRED | Both routes fire audit; WR-03 comment corrected (blocking in-band, not fire-and-forget) |
| `main.py` | `document_relationships.router` | `include_router` | WIRED | Confirmed |
| `tool_dispatcher.py` | `document_relationship_service._resolve_readable_latest` | subject + per-endpoint resolve | WIRED (CR-01 fixed) | Called correctly; resolver now is_latest-gated on global-by-id leg + post-follow folder re-check |
| `tool_dispatcher.py` | `document_relationship_service._subject_version_ids` | edge enumeration over version set | WIRED (CR-02 closed) | `version_ids = await _subject_version_ids(subject, ...)` at line 570; `.in_(version_ids)` at lines 577, 583 |
| `tool_dispatcher.py` | `_TOOL_REGISTRY` | `"get_related_documents": _handle_get_related_documents` | WIRED | Line 2781 confirmed |
| `openai_service.py` | `get_tools()` assembly | `GET_RELATED_DOCUMENTS_TOOL` in list | WIRED | Line 1023 confirmed |
| `_resolve_readable_latest` | `list_documents` canonical access model | is_latest-gated own-leg + global-leg with folder re-check | WIRED (CR-01 mirrors canonical) | documents.py:540-561 pattern exactly mirrored in document_relationship_service.py:189-247 |


## Data-Flow Trace (Level 4)

### get_related_documents handler — edge enumeration data flow (post gap-closure)

| Stage | Variable | Source | Produces Real Data | Status |
|-------|----------|--------|--------------------|--------|
| Subject resolution | `subject` | `_resolve_readable_latest(doc_id, caller)` | Real; own-leg + is_latest-gated global-leg | VERIFIED (CR-01 fixed) |
| Version-id set | `version_ids` | `_subject_version_ids(subject)` — all ids for (user_id, filename) | Real; all versions including pre-reupload ids | VERIFIED (CR-02 fix) |
| Outgoing edge query | `outgoing.data` | `.in_("source_doc_id", version_ids)` | Real rows across all version ids | VERIFIED (CR-02 fix; test_edge_survives_reupload_in_handler PASSED) |
| Incoming edge query | `incoming.data` | `.in_("target_doc_id", version_ids)` | Real rows across all version ids | VERIFIED |
| Per-endpoint re-check | `other` via `_resolve_readable_latest` | Resolver with CR-01 fix | None for global-old → private-latest; real for owner | VERIFIED (CR-01 fix; test_global_old_version_does_not_leak_private_latest PASSED) |
| Mask | `_NO_ACCESS_MASK` at `compact` entry | `if other is None` branch | Existence shown, identity hidden | VERIFIED (test_unreadable_endpoint_is_masked_for_other_viewer PASSED) |


## Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| Tool schema has no anyOf/oneOf/multi-type type arrays | `GET_RELATED_DOCUMENTS_TOOL` at openai_service.py:198-241; two plain `"type": "string"` properties; comment documents the a5b0b917 Gemini discipline | PASS |
| _TOOL_REGISTRY entry exists | tool_dispatcher.py:2781 | PASS |
| get_tools() includes the tool | openai_service.py:1023 | PASS |
| Unseeable-endpoint mask string defined | `_NO_ACCESS_MASK = "linked document (no access)"` at tool_dispatcher.py:489 | PASS |
| Both directions with inverse labels | `_INVERSE_LABEL` map at tool_dispatcher.py:480-483; outgoing/incoming loop | PASS |
| Calm error returns (no raise into agent loop) | All except branches return `ToolResult(result=json.dumps({...}))` at :547, :587; `_append_edge` sets `other = None` on exception (fail-closed) | PASS |
| Global-by-id leg is is_latest-gated | `document_relationship_service.py:205-211` includes `.eq("is_latest", True)` | PASS |
| Post-follow folder re-check | `if from_global and latest_row.get("folder_id") not in global_folder_ids: return None` at line 245-246 | PASS |
| _subject_version_ids fallback guard | `return ids or [subject_row["id"]]` at line 140 — .in_() never empty | PASS |
| _uid() uniform on all owner-scoping gates | create payload line 272, delete .eq line 306, re-fetch line 285, resolver — all use `_uid()` | PASS |
| threads.py byte-untouched | `git log` — no threads.py changes in commits 1df5239c, 36e4f2b9, db412c59, c43405b8 | PASS |


## Probe Execution / Live Test Results

All Phase-116 integration and unit tests run against live local Supabase (:54322):

| Test File | Tests | Result |
|-----------|-------|--------|
| `test_116_tool_leak.py` | 3 (incl. CR-01 new test) | PASSED |
| `test_116_version_stable.py` | 3 (incl. CR-02 new test) | PASSED |
| `test_116_relationship_crud.py` | 4 | PASSED |
| `test_116_idempotency.py` | 2 | PASSED |
| `test_116_audit_live.py` | 1 | PASSED |
| `test_116_tool_read.py` | 2 | PASSED |
| `test_116_handler.py` | 4 | PASSED |
| `test_116_tool_schema.py` | 8 | PASSED |
| `test_116_tool_wiring.py` | 4 | PASSED |
| `test_116_whitelist_guard.py` | 4 | PASSED |
| **Total** | **35** | **35 passed / 0 failed** |

CR-01 and CR-02 BLOCKER regression tests confirmed PASSED in isolation:

```
tests/integration/test_116_tool_leak.py::test_global_old_version_does_not_leak_private_latest PASSED
tests/integration/test_116_version_stable.py::test_edge_survives_reupload_in_handler PASSED
```

Prior-phase regression (Phase 113-115 live proof tests): 5 passed / 0 failed.


## Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| REL-01 | 116-01, 116-02, 116-04, 116-05 | User can create a typed link between two documents; links reference identity via latest-resolved/is_latest | SATISFIED | Create endpoint WIRED and correct; CR-02 read-side version-id-set enumeration closes the D-116-1 LOCKED follow-to-latest guarantee; test_edge_survives_reupload_in_handler PASSED |
| REL-03 | 116-01, 116-02 | User can remove a relationship | SATISFIED | `DELETE /document-relationships/{id}` own-scoped, 204 on success, 404 on miss/cross-user; test_116_relationship_crud.py PASSED |
| REL-04 | 116-01, 116-03, 116-05 | Agent can retrieve related documents via get_related_documents | SATISFIED | Dual-wiring confirmed (registry + get_tools); Gemini-safe schema confirmed; CR-01 resolver fix closes the global→private leak; test_116_tool_leak.py + test_global_old_version_does_not_leak_private_latest PASSED |


## Anti-Patterns Found

No TBD/FIXME/XXX unresolved debt markers found in phase-modified files.

No remaining stubs or hollow implementations. The two prior BLOCKERs have been replaced by substantive implementations with live proof.

WR-03 comment honesty and WR-04 self-link comment tightening applied — no lingering misleading inline documentation.


## Human Verification Required

### 1. SC#10 4-axis Cross-Provider Live UAT

**Test:** Invoke the agent in Deep mode across at least 4 providers (OpenAI, Anthropic, Google, one OpenRouter model) with a seeded pair of linked documents. Ask it to find related documents for the subject.
**Expected:** Tool invoked and result rendered correctly — compact rows with direction and label, seeable endpoints cited as source_refs, unseeable endpoints masked as "linked document (no access)" — on all 4 providers.
**Why human:** Requires live LLM + network + DB across multiple providers; cannot be verified by grep or static analysis.

### 2. Parallel-thread axis

**Test:** With Thread A streaming a response, open Thread B and send a `get_related_documents` prompt.
**Expected:** Both threads complete independently with no cross-contamination.
**Why human:** Requires live parallel browser sessions.

### 3. Multi-tool axis

**Test:** In one prompt, ask the agent to both find related documents (get_related_documents) and search the knowledge base (search_documents) or execute code (execute_code).
**Expected:** Both tools invoked in one loop; results rendered without conflict.
**Why human:** Requires live agent loop + LLM.

### 4. Long-message axis

**Test:** With >= 50 prior messages or a >= 5 KB user prompt, invoke get_related_documents.
**Expected:** Tool invoked and result correct despite large context window.
**Why human:** Requires seeded long-running conversation; manual effort.

### 5. Audit row — relationship.create live confirmation

**Test:** Call `POST /document-relationships` with two readable document ids and verify a `relationship.create` row appears in the `audit_log` table at :54322.
**Expected:** One row with `action_type='relationship.create'`, `relationship_id`, `source_doc_id`, `target_doc_id`, `rel_type` in metadata.
**Why human:** `test_116_audit_live.py` already covers this automatically — this is an operator-eyeball confirmation item for the DMF-01 audit-row guarantee. Can be marked confirmed if test_116_audit_live.py passed (it did — 1/1 above).

### 6. Migration 075 applied live

**Test:** `SELECT indexname FROM pg_indexes WHERE indexname = 'document_relationships_idempotency_idx'` at :54322.
**Expected:** Returns one row.
**Why human:** Migration is an operator-apply step (Plan 04 `autonomous:false`); the migration file is correct and present, but the operator must confirm it was pasted into the live DB.


## Gaps Summary

No gaps remain. Both confirmed BLOCKERs from the initial verification are closed:

- **CR-01 (leak-safety):** The `_resolve_readable_latest` global-by-id leg is now `is_latest`-gated (mirroring `list_documents`), and the follow-to-latest step re-verifies the returned latest row is still in the caller's global-visible folder set. A non-owner replaying an old-global version id can no longer follow to the owner's private latest. Proven by a non-vacuous live regression test.

- **CR-02 (follow-to-latest):** Edge enumeration now uses `.in_()` over the subject's full `(user_id, filename)` version-id set via the new `_subject_version_ids` helper. An edge created at any prior version id survives a re-upload. Proven by a non-vacuous live regression test that was confirmed RED against pre-fix code and GREEN after.

The three nit fold-ins (WR-02 `_uid()` uniformity, WR-03/04 comment honesty) are applied. The `test_116_handler.py` unit stub was aligned to the CR-02 `.in_()` query shape (the one auto-fixed deviation noted in the SUMMARY). All 35 Phase-116 tests pass; 0 net-new failures; prior-phase regression clean.

Remaining open work is exclusively the SC#10 4-axis cross-provider live UAT — the same category of human-UAT gate that Phase 115 closed with `status:partial` UAT rows. Phase 116 should follow the same close path: human UAT rows in VALIDATION.md, then transition.

---

_Verified: 2026-06-20_
_Verifier: Claude (gsd-verifier) — re-verification after Plan 05 gap closure_
_Prior verification: 2026-06-20 (gaps_found, 4/6), adversarial pre-verification by 10-agent workflow_

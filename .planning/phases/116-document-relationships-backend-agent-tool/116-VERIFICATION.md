---
phase: 116-document-relationships-backend-agent-tool
verified: 2026-06-20T00:00:00Z
status: gaps_found
score: 4/6 must-haves verified
overrides_applied: 0
gaps:
  - truth: "links reference document identity via latest-resolved/is_latest so a new version or restore does NOT orphan them (SC#1 / REL-01)"
    status: failed
    reason: "CR-02: edges store creation-time ids verbatim (service.py:207-212); the handler queries by the resolved-latest subject_id (tool_dispatcher.py:567,573). After a re-upload, latest id is version N+1; the stored edge keyed on version N is never found. The link silently vanishes from get_related_documents. The 'follow-to-latest' only resolves the SUBJECT, not the EDGE LOOKUP, which is fundamentally the wrong join. The two test_116_version_stable.py rows false-green because they assert the resolver follows forward, never that a stored edge survives across a re-upload."
    artifacts:
      - path: "backend/app/services/document_relationship_service.py"
        issue: "create_relationship stores submitted source_doc_id/target_doc_id verbatim (lines 207-212) with no normalization to a stable handle"
      - path: "backend/app/services/tool_dispatcher.py"
        issue: "_handle_get_related_documents queries edges by resolved-latest subject_id (lines 567, 573); an edge created at v1's id is missed once latest is v2's id"
      - path: "backend/tests/integration/test_116_version_stable.py"
        issue: "Tests assert resolver follows forward on the SUBJECT (lines 202-205, 244-247); no test creates an edge then re-uploads the subject and asserts the edge still appears"
    missing:
      - "Read-side fix: resolve subject to its full version-id set via (user_id, filename) and query edges with .in_() over ALL version ids — no migration needed"
      - "Add a regression test that creates an edge, re-uploads the subject (new row, new uuid, old is_latest=False), and asserts the edge still surfaces in get_related_documents — this test WILL FAIL against the current implementation"

  - truth: "a relationship pointing at a document the caller can't see renders as 'linked document (no access)' — never leaking the target's title/metadata (SC#2 / REL-04)"
    status: failed
    reason: "CR-01: _resolve_readable_latest global-by-id leg (lines 158-164) lacks .eq('is_latest', True), unlike the filename leg (line 102) and the canonical list_documents (documents.py:558). When a doc's v1 is in a global folder and v2 (latest) is in a private folder, a non-owner resolving v1's id passes Step 1 (global leg matches the non-latest v1 row), then Step 2 follow-to-latest (lines 178-185) returns v2's row with no folder re-check. The private latest's real id/filename/metadata is returned to a caller who list_documents would never surface it to. The D-116-9 mask in tool_dispatcher.py:600 never fires because the resolver returns non-None. The test_116_tool_leak.py never exercises this vector (target is single-version private at all times — the global-to-private follow-to-latest path is never driven)."
    artifacts:
      - path: "backend/app/services/document_relationship_service.py"
        issue: "Global-leg by-id query (lines 158-164) has no .eq('is_latest', True); follow-to-latest step (lines 178-185) has no folder re-check after following from global"
      - path: "backend/tests/integration/test_116_tool_leak.py"
        issue: "Target is always single-version private (lines 228); the global-folder-old-version / private-latest scenario is never seeded — test is vacuous for CR-01's vector"
    missing:
      - "Add .eq('is_latest', True) to the global-by-id leg (lines 158-164) — an old version in a global folder is not independently readable (mirrors list_documents:558)"
      - "After follow-to-latest from a global-leg source row, re-verify the returned latest row's folder_id is still in global_folder_ids before returning it; if the latest moved to a private folder, return None"
      - "Add a live regression test seeding an old-global / new-private version pair and asserting the resolver returns None for a non-owner (this test WILL FAIL against the current implementation)"
---

# Phase 116: Document Relationships — Backend + Agent Tool Verification Report

**Phase Goal:** Let users typed-link documents and let the agent traverse those links — establishing directional relationship edges and the `get_related_documents` tool over them.
**Verified:** 2026-06-20
**Status:** gaps_found — 2 BLOCKERS (CR-01, CR-02) confirmed by 10-agent adversarial verification and orchestrator code corroboration
**Re-verification:** No — initial verification


## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC#1a | User can create a typed link (supersedes/amends/references/attached_to) between two documents and remove it | VERIFIED | `POST /document-relationships` + `DELETE /{id}` present in `document_relationships.py`; visible-both gate, uniform 422, 204 on success |
| SC#1b | links reference document identity via latest-resolved/is_latest so a new version or restore does NOT orphan them | FAILED (CR-02) | Edges stored by creation-time id; handler queries by resolved-latest subject_id; after re-upload the stored edge is never found — link silently vanishes |
| SC#1c | a relationship.create audit row lands live | VERIFIED | `await write_audit_entry(action_type="relationship.create", ...)` at `document_relationships.py:137-147`; `relationship.delete` at :173-178 |
| SC#2a | The agent retrieves related documents via get_related_documents registered in _TOOL_REGISTRY AND advertised in get_tools | VERIFIED | `_TOOL_REGISTRY` entry at `tool_dispatcher.py:2771`; `GET_RELATED_DOCUMENTS_TOOL` in `get_tools()` at `openai_service.py:1023` |
| SC#2b | A relationship pointing at a document the caller can't see renders as "linked document (no access)" — never leaking the target's title/metadata | FAILED (CR-01) | `_resolve_readable_latest` global-by-id leg (lines 158-164) lacks `is_latest` filter; follow-to-latest step (lines 178-185) has no folder re-check; resolver returns private latest version to non-owner; the D-116-9 mask at `tool_dispatcher.py:600` never fires; `test_116_tool_leak.py` vacuous for this vector |
| SC#3 | SC#10 4-axis cross-provider UAT authored in VALIDATION.md | UNCERTAIN | VALIDATION.md exists; human-UAT rows present; not runnable by this verifier — deferred to secure/validate gate |

**Score:** 4/6 truths verified (SC#1a, SC#1c, SC#2a pass; SC#1b and SC#2b are BLOCKERS)


## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/document_relationship.py` | RelationshipCreate (Literal rel_type) + RelationshipResponse | VERIFIED | File exists and substantive; `Literal` over 4 types confirmed |
| `backend/app/services/document_relationship_service.py` | create/delete + _resolve_readable_latest + _uid + 23505-catch | VERIFIED (with defects) | All functions present; `_resolve_readable_latest` has CR-01 leak; `create_relationship` 23505-catch present but edge stored verbatim (CR-02) |
| `backend/app/api/document_relationships.py` | POST + DELETE router with visible-both gate + audit | VERIFIED | Both routes present; visible-both gate fires before self-link check; uniform 422; audit writes present |
| `backend/app/main.py` | document_relationships.router mounted | VERIFIED | `include_router(document_relationships.router)` at line 424 |
| `backend/app/services/tool_dispatcher.py` | _handle_get_related_documents + _TOOL_REGISTRY entry | VERIFIED (with defect) | Handler at line 492; registry entry at line 2771; defect: edge query uses single latest id, misses version-set |
| `backend/app/services/openai_service.py` | GET_RELATED_DOCUMENTS_TOOL schema + get_tools() entry | VERIFIED | Schema at line 198; two flat scalar strings; no anyOf/oneOf/multi-type arrays; in get_tools() at line 1023 |
| `supabase/migrations/075_document_relationships_idempotency_index.sql` | Additive partial unique index | VERIFIED | File exists; `CREATE UNIQUE INDEX IF NOT EXISTS document_relationships_idempotency_idx` on (user_id, source_doc_id, target_doc_id, rel_type) |
| `backend/tests/integration/test_116_tool_leak.py` | Live two-user non-vacuous leak proof | VERIFIED (partially) | Test exists and exercises per-viewer masking; VACUOUS for the global-to-private follow-to-latest vector (CR-01); the scenario seeded never exercises Step 2 follow across a folder boundary |
| `backend/tests/integration/test_116_version_stable.py` | Edge survives re-upload | FAILED | Tests assert subject resolver follows forward — never asserts an EDGE created at v1's id still appears after re-upload to v2's id; false-greens against the current broken implementation |


## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `document_relationships.py` | `document_relationship_service` | import + calls | WIRED | `_resolve_readable_latest`, `create_relationship`, `delete_relationship` all called |
| `document_relationships.py` | `audit_log` | `write_audit_entry(relationship.create/delete)` | WIRED | Both routes fire audit after mutating work |
| `main.py` | `document_relationships.router` | `include_router` | WIRED | Line 424 confirmed |
| `tool_dispatcher.py` | `_resolve_readable_latest` | subject + per-endpoint resolve | WIRED (defective) | Called correctly; resolver itself has CR-01 leak |
| `tool_dispatcher.py` | `_TOOL_REGISTRY` | `"get_related_documents": _handle_get_related_documents` | WIRED | Line 2771 confirmed |
| `openai_service.py` | `get_tools()` assembly | `GET_RELATED_DOCUMENTS_TOOL` in list | WIRED | Line 1023 confirmed |
| Edge query | `document_relationships` table | `.eq("source_doc_id", subject_id)` / `.eq("target_doc_id", subject_id)` | WIRED (defective) | Query runs against correct table; uses single subject_id instead of full version-id set (CR-02) |


## Data-Flow Trace (Level 4)

### get_related_documents handler — edge enumeration data flow

| Stage | Variable | Source | Produces Real Data | Status |
|-------|----------|--------|--------------------|--------|
| Subject resolution | `subject` | `_resolve_readable_latest(doc_id, caller)` | Real (own-leg works) | WIRED but CR-01 on global leg |
| Outgoing edge query | `outgoing.data` | `.eq("source_doc_id", subject_id)` | Real rows for current version only | HOLLOW after re-upload (CR-02) |
| Incoming edge query | `incoming.data` | `.eq("target_doc_id", subject_id)` | Real rows for current version only | HOLLOW after re-upload (CR-02) |
| Per-endpoint mask | `other` via `_resolve_readable_latest` | Same shared resolver | Leaks across global→private boundary | CR-01 |

### Conclusion: data flows through the wiring but the edge-query predicate is wrong (single id vs version-set), and the resolver leaks across the global→private boundary. Structured data reaches the surface, but with incorrect identity constraints on both the enumeration join and the readability re-check.


## Behavioral Spot-Checks

Step 7b: SKIPPED for the defective paths — running the handler against a versioned document would exercise exactly the broken paths described by CR-01 and CR-02. The defects are in read-side query predicates that are not observable without live DB seeding. Manual behavioral verification is deferred to secure-phase/UAT once the fixes land.

The following structural spot-checks (non-DB) are PASS:

| Behavior | Evidence | Status |
|----------|----------|--------|
| Tool schema has no anyOf/oneOf/multi-type type arrays | `GET_RELATED_DOCUMENTS_TOOL` at openai_service.py:198-241; two plain `"type": "string"` properties, no `required` | PASS |
| _TOOL_REGISTRY entry exists | tool_dispatcher.py:2771 | PASS |
| get_tools() includes the tool | openai_service.py:1023 | PASS |
| Unseeable-endpoint mask string defined | `_NO_ACCESS_MASK = "linked document (no access)"` at tool_dispatcher.py:489 | PASS |
| Both directions with inverse labels | `_INVERSE_LABEL` map at tool_dispatcher.py:480-483; outgoing/incoming loop at :619-622 | PASS |
| Calm error returns (no raise into agent loop) | All except branches return `ToolResult(result=json.dumps({...}))` at :545, :577 | PASS |


## Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| REL-01 | 116-01, 116-02, 116-04 | User can create a typed link between two documents | PARTIAL | Create endpoint WIRED and correct; but version-stability guarantee (D-116-1 LOCKED policy) is violated — edge silently vanishes after re-upload (CR-02) |
| REL-03 | 116-01, 116-02 | User can remove a relationship | SATISFIED | `DELETE /document-relationships/{id}` own-scoped, 204 on success, 404 on miss/cross-user |
| REL-04 | 116-01, 116-03 | Agent can retrieve related documents via get_related_documents | PARTIAL | Dual-wiring confirmed, Gemini-safe schema confirmed; but masking is leaky (CR-01 — resolver returns private latest to non-owner; mask never fires) |


## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `document_relationship_service.py` | 158-164 | Missing `.eq("is_latest", True)` on global by-id leg | BLOCKER | Enables cross-user leak of private latest version via old global-folder id — CR-01 |
| `document_relationship_service.py` | 178-185 | Follow-to-latest has no folder re-check after global-leg match | BLOCKER | Extends CR-01: latest version returned with no visibility re-verification |
| `tool_dispatcher.py` | 567, 573 | Edge queries use single `subject_id` (latest id only) | BLOCKER | Edges created at any prior version id are never found after re-upload — CR-02 |
| `document_relationship_service.py` | 208, 241 | `str(user_id)` instead of `_uid(user_id)` on write paths | WARNING | Defense-in-depth inconsistency; not a live injection (`.eq()` parameterized) — WR-02 |
| `document_relationships.py` | 135, 172 | `await write_audit_entry(...)` mislabeled as "fire-and-forget" | WARNING | Audit write blocks the HTTP response on slow audit DB; not a regression (inherited pattern) — WR-03 |
| `document_relationships.py` | 89-107 | Self-link ordering comment overstates that step 2 is dead code | INFO | Doc-only; the response (status+detail) IS uniform; no live oracle — WR-04 |

No TBD/FIXME/XXX unresolved debt markers found in phase-modified files.


## Human Verification Required

### 1. SC#10 4-axis UAT — cross-provider live invocation of get_related_documents

**Test:** With a seeded pair of linked documents, invoke the agent in Deep mode across at least 4 providers (OpenAI, Anthropic, Google, one OpenRouter model) and verify the model actually calls `get_related_documents` and renders the result correctly.
**Expected:** Tool invoked, compact rows returned with direction and label, seeable endpoints cited as source_refs, unseeable endpoints masked.
**Why human:** Requires live LLM + network + DB; cannot be verified by grep or static analysis.

### 2. Audit row lands live — relationship.create

**Test:** Call `POST /document-relationships` with two readable document ids and verify a `relationship.create` row appears in the `audit_log` table with the correct metadata.
**Expected:** One row with `action_type='relationship.create'`, `relationship_id`, `source_doc_id`, `target_doc_id`, `rel_type` in metadata.
**Why human:** Requires live DB at :54322; cannot run without the local Supabase stack.

### 3. Migration 075 applied live

**Test:** Confirm `document_relationships_idempotency_idx` exists on the live local DB (`:54322`).
**Expected:** `SELECT indexname FROM pg_indexes WHERE indexname = 'document_relationships_idempotency_idx'` returns one row.
**Why human:** Requires live DB access; Plan 04 is `autonomous:false` (BLOCKING operator gate).


## Gaps Summary

Phase 116 ships a structurally complete backend — the REST create/delete surface is correct, the dual-wiring (registry + `get_tools`) is confirmed, the Gemini-safe schema is confirmed (no anyOf/oneOf/multi-type arrays), the audit write structure is correct, `threads.py` is untouched, and the per-viewer mask STRUCTURE (the `_NO_ACCESS_MASK` + `if other is None` branch) is present and wired.

However, two confirmed defects directly violate the phase's headline promises:

**CR-02 (SC#1 / D-116-1 LOCKED policy broken):** The follow-to-latest mechanism is applied only to the subject resolver, not to the edge lookup. Edges are stored by creation-time id; the handler queries by the resolved-latest id; after any re-upload the creation-time id is no longer the latest and the edge is permanently missed. The "a re-upload does not orphan a link" guarantee is the reason D-116-1 was declared LOCKED in CONTEXT.md — it is the phase's headline REL requirement, and it does not hold. Fix: query edges against the full version-id set of the subject via `(user_id, filename)` with `.in_()`.

**CR-01 (SC#2 / REL-04 leak-safety broken):** The `_resolve_readable_latest` global-by-id leg allows a non-owner to resolve an old version's id (still in a global folder) and follow to the owner's private latest version, bypassing the access model that `list_documents` enforces. The mask in `tool_dispatcher.py` never fires because the resolver itself returns non-None. The live test `test_116_tool_leak.py` proves masking in a single-version private scenario but is vacuous for the global→private follow-to-latest vector. Fix: add `.eq("is_latest", True)` to the global-by-id leg; after follow-to-latest, re-verify the returned row's folder is still in the global-visible set before returning it.

Both are read-side fixes with no migration needed. The gap closure plan should also add two non-vacuous live regression tests (IN-03): one for the global→private leak vector (assert resolver returns None), one for the re-upload-orphan vector (assert edge still appears after re-upload).

---

_Verified: 2026-06-20_
_Verifier: Claude (gsd-verifier)_
_Adversarial pre-verification: 10-agent workflow (3 lenses/blocker), orchestrator-corroborated_

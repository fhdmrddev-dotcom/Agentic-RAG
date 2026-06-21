---
phase: 117
phase_name: Document Relationships Panel UI
asvs_level: L1
threats_total: 18
threats_closed: 18
threats_open: 0
accepted_risks: [AR-117-01, AR-117-02, AR-117-03, AR-117-04, AR-117-05, AR-117-06]
status: SECURED
register_authored_at_plan_time: true
block_on: high
verified_by: gsd-security-auditor
verified_at: 2026-06-21
---

# Phase 117 — Document Relationships Panel UI — Security Audit

**State B audit** (no prior SECURITY.md; register authored at plan-time across 4 PLANs).
Each plan-time threat was verified against the SHIPPED code by file:line, not by label or
intent. The defining invariant — leak-safety (D-117-8): a relationship row whose other
endpoint the caller cannot read must be MASKED (`document_id=None` + the constant
`"linked document (no access)"`), never a leaked id/title/metadata — was confirmed in the
actual code path AND re-proven live by the two-user route-leak suite (the "static label
would false-green" lesson, D-102/D-110-5, honored).

ASVS L1 / `block_on: high`. **No HIGH or BLOCKER findings. threats_open: 0.**

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence (file:line) |
|-----------|----------|-------------|--------|----------------------|
| T-117-01-01 | Information Disclosure | mitigate | CLOSED | `document_relationship_service.py:413-445` `_append_edge` re-checks EACH other endpoint via `_resolve_readable_latest` (FROM the caller, not the link owner — line 421); `None` → `_NO_ACCESS_MASK` + `document_id: None` (428-435), no `source_refs` entry. Resolver itself is `is_latest`-gated (228-229) + post-follow folder re-check (264-265). |
| T-117-01-02 | Tampering/Elevation | mitigate | CLOSED | Edge queries own-scoped `.eq("user_id", _uid(caller))` (`:399`, `:405`); `_uid` UUID-coerces (`:75-87`). `get_supabase()` is service-role (RLS bypassed) → these app predicates are the SOLE gate, exactly as documented. |
| T-117-01-03 | Tampering | mitigate | CLOSED | ONE traversal impl in `get_related_documents` (`:330-457`); agent handler `tool_dispatcher._handle_get_related_documents` CALLS it (`tool_dispatcher.py:526`), does not fork. Guard `test_117_no_fork.py::test_route_does_not_fork_the_read_traversal` GREEN (mask + `.in_(` absent from route). |
| T-117-01-SC | Tampering | accept | CLOSED | AR-117-01 — `git diff master` on `backend/requirements*` is empty (zero new deps). |
| T-117-02-01 | Information Disclosure | mitigate | CLOSED | Route scopes from CALLER `current_user["id"]` (`document_relationships.py:102`), delegates to shared core; masking in the core. LIVE two-user proof: `test_117_route_leak.py::test_route_masks_unreadable_endpoint_for_other_viewer` GREEN on :54322 (B sees mask, `document_id is None`, no private id/filename; non-vacuity twin `test_route_shows_real_filename_for_owner` GREEN — A sees the real row). |
| T-117-02-02 | Information Disclosure | mitigate | CLOSED | `test_117_no_fork.py:76-93` asserts mask string + `.in_(` ABSENT from `document_relationships.py`; route only calls `get_related_documents` (`:104`). GREEN live. |
| T-117-02-03 | Information Disclosure | mitigate | CLOSED | Uniform 404 on unreadable/unknown subject (`document_relationships.py:118`, `:122`); resolver is EXACT-match (no partial `ilike` superstring — `service:108`). LIVE: `test_route_uniform_404_for_unreadable_or_unknown_subject` + `test_route_uniform_404_for_malformed_subject` GREEN (malformed→404 == unknown→404, no oracle; WR-01 fix). |
| T-117-02-04 | DoS | mitigate | CLOSED | Route has NO bare supabase call — delegates to the shared fn which rides `aexec` (`run_in_threadpool`) on every query (`service.py:103,152,208,224,248,396,402`, module docstring `:36-38`). |
| T-117-02-05 | Spoofing | mitigate | CLOSED | `Depends(get_current_user)` JWT on the GET route (`document_relationships.py:72`). |
| T-117-02-SC | Tampering | accept | CLOSED | AR-117-02 — zero new deps (see AR-117-01 evidence). |
| T-117-03-01 | Information Disclosure | mitigate | CLOSED | `RelationshipRow.document_id: string \| null` (`types/index.ts:330`); masked row carries `null` (doc comment `:326-329`). Type makes a leaked-id a compile error; real gate is server-side. |
| T-117-03-02 | Spoofing | accept | CLOSED | AR-117-03 — `listRelationships`/`createRelationship`/`deleteRelationship` all call `getAuthHeaders()` (`api.ts:2173,2201,2216`); the client is not the trust boundary, auth enforced server-side (verified at T-117-02-05). |
| T-117-03-SC | Tampering | accept | CLOSED | AR-117-04 — `git diff master -- frontend/package.json` empty. |
| T-117-04-01 | Tampering (client XSS) | mitigate | CLOSED | Filenames render as React text children: `{row.filename}` (`RelationshipsSection.tsx:289`), `{d.filename}`/`{targetDoc.filename}` (`CreateLinkDialog.tsx:270,292`). `grep dangerouslySetInnerHTML` across `components/relationships/` → no matches. |
| T-117-04-02 | Information Disclosure | mitigate | CLOSED | Masked row `document_id === null` (`RelationshipsSection.tsx:265`) renders only `row.filename` (the mask string, `:289`), never id/title; the remove ✕ is `relationship_id`-keyed, not endpoint-id. |
| T-117-04-03 | Elevation (client trust) | accept | CLOSED | AR-117-05 — exclusion is clarity-only (`CreateLinkDialog.tsx:86-105`); confirm disabled until a target is chosen (`:307`); create POSTs to the server visible-both gate → uniform 422 (`document_relationships.py:172-176`), idempotent persist (D-116-6). A bypassed stale candidate is a no-op or uniform 422, never a leak. |
| T-117-04-04 | a11y | mitigate | CLOSED | `:focus-visible` + always-on touch reveal `.rel-x-touch` under `@media (pointer: coarse)` (`index.css:217-221`; applied `RelationshipsSection.tsx:308`); APG combobox roles wired by hand (`CreateLinkDialog.tsx:217,223,244,257`); `aria-controls` only when listbox present (WR-04, `:223`). vitest-axe test `RelationshipsSection.a11y.test.tsx:105,116,123,133` + combobox-role assertions `:163-174`. |
| T-117-04-SC | Tampering | accept | CLOSED | AR-117-06 — bespoke typeahead, no `cmdk` (only mention is a comment "there is no cmdk dep", `CreateLinkDialog.tsx:21`); `package.json` diff empty. |

**Plan-time `mitigate` threats:** 13 — all CLOSED, control present and doing what the disposition claims.
**Plan-time `accept` threats:** 7 — all CLOSED, rationale verified and logged below.

## Accepted Risks Log

| ID | Threat | Rationale | Verification |
|----|--------|-----------|--------------|
| AR-117-01 | T-117-01-SC — backend package installs | No new backend dependencies introduced by the shared read core / route. | `git diff master -- backend/requirements.txt backend/requirements.in` returns empty. |
| AR-117-02 | T-117-02-SC — backend package installs (route) | The GET route is a thin wrapper over existing deps (FastAPI, supabase). | Same empty backend-requirements diff. |
| AR-117-03 | T-117-03-02 — unauthenticated client call | The frontend api client is NOT a trust boundary; every call attaches a Bearer JWT via `getAuthHeaders()` and auth is enforced server-side (`Depends(get_current_user)`). A forged client request without a valid token is rejected at the route. | `api.ts:2173,2201,2216` + route `Depends(get_current_user)` (`document_relationships.py:72,128,233`). |
| AR-117-04 | T-117-03-SC — frontend package installs (types/api) | No new frontend dependencies for the types + api client. | `git diff master -- frontend/package.json` empty. |
| AR-117-05 | T-117-04-03 — client candidate-exclusion bypass | The per-type candidate exclusion is a clarity/UX affordance only. The authoritative access + correctness boundary is the server-side visible-both gate (uniform 422) plus the idempotent create. A user who bypasses the client filter (e.g. via the API directly) gets either a no-op (idempotent duplicate) or a uniform 422 (unseeable endpoint / self-link) — never a leak or an unauthorized link. | `CreateLinkDialog.tsx:86-105,307`; server gate `document_relationships.py:160-209`. |
| AR-117-06 | T-117-04-SC — frontend package installs (panel) | The typeahead is bespoke (hand-wired APG roles), so no `cmdk` or other new UI dependency was added. | `package.json` diff empty; no `cmdk` import in `components/relationships/`. |

## Unregistered Flags

None. The plan-time register is complete (4 PLANs); no net-new attack surface appeared during
implementation that maps to no threat ID. The WR-01..04 code-review warnings fixed pre-secure
(commits e7032acf / 1741c41d / b1a4188c / 3ef7c509) all STRENGTHEN existing declared threats
(WR-01 → uniform-404 no-oracle for T-117-02-03; WR-02 → honest remove-error beat; WR-03 →
`ApiError.status` permanent-vs-retry messaging; WR-04 → `aria-controls`-only-when-present for
T-117-04-04) rather than opening new surface.

## Audit Trail

1. **Loaded** the auditor role spec and all 10 cited implementation/test files.
2. **Backend core** (`document_relationship_service.py`) — confirmed per-endpoint
   caller-readability re-check (T-117-01-01), own-scoped `_uid`-coerced edge queries
   (T-117-01-02), single traversal impl (T-117-01-03), `is_latest`-gate + post-follow
   global-folder re-check in `_resolve_readable_latest` (the leak-safety invariant).
3. **GET route** (`document_relationships.py`) — confirmed caller-scoping from
   `current_user["id"]`, JWT dependency, uniform 404 mapping (incl. malformed-id WR-01),
   no bare supabase call, delegation-only to the shared fn.
4. **Dispatcher** (`tool_dispatcher.py:526`) — confirmed the agent handler is a thin caller
   of the shared fn, no fork.
5. **Ran live tests** against :54322: `test_117_no_fork.py` + `test_117_route_leak.py` →
   `5 passed, 4 xpassed` (the two-user route mask proof, its non-vacuity twin, the
   uniform-404 oracle tests, the malformed-id 404 regression, and the no-fork source guard
   all GREEN). Behavior proven live; the code path proven by reading the source.
6. **Frontend** — confirmed `document_id: string | null` typing (T-117-03-01),
   `getAuthHeaders()` on all three client fns (T-117-03-02), filenames as escaped React
   text children with zero `dangerouslySetInnerHTML` (T-117-04-01), masked-row renders only
   the mask string (T-117-04-02), client exclusion is clarity-only with confirm-disabled and
   the server 422 as the real gate (T-117-04-03), APG combobox roles + `.rel-x-touch`
   coarse-pointer always-on + vitest-axe (T-117-04-04).
7. **Accept rationales** — verified zero-dep claims via empty `git diff master` on both
   `frontend/package.json` and `backend/requirements*`; confirmed no `cmdk` import.
8. **No implementation file modified.** Result: **SECURED — threats_open: 0.**

---
phase: 116-document-relationships-backend-agent-tool
reviewed: 2026-06-20T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - backend/app/api/document_relationships.py
  - backend/app/main.py
  - backend/app/models/document_relationship.py
  - backend/app/services/document_relationship_service.py
  - backend/app/services/openai_service.py
  - backend/app/services/tool_dispatcher.py
  - scripts/apply_migration_075.py
  - supabase/migrations/075_document_relationships_idempotency_index.sql
  - backend/tests/integration/test_116_tool_leak.py
  - backend/tests/integration/test_116_idempotency.py
  - backend/tests/integration/test_116_relationship_crud.py
  - backend/tests/unit/test_116_tool_schema.py
  - backend/tests/unit/test_116_handler.py
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
gap_closure_116_05:
  reviewed: 2026-06-20T12:00:00Z
  depth: standard
  files_reviewed: 5
  files_reviewed_list:
    - backend/app/services/document_relationship_service.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/api/document_relationships.py
    - backend/tests/integration/test_116_tool_leak.py
    - backend/tests/integration/test_116_version_stable.py
  findings:
    critical: 0
    warning: 0
    info: 1
    total: 1
  status: clean
---

# Phase 116: Code Review Report

**Reviewed:** 2026-06-20
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 116 ships document-relationship CRUD (REST) plus a leak-safe read-only agent
tool (`get_related_documents`). The cross-provider tool-schema discipline is correct
(no `anyOf`/`oneOf`, no multi-type `type` arrays, two flat scalar strings — CR-free on
the Gemini axis), the dual-wiring contract (registry + `get_tools`) is honored, the
registry-count gate is updated to 27, `threads.py` is untouched, and every Supabase
call routes through `aexec` (no bare `.execute()` in the async service/handler). The
per-viewer mask, the uniform 422 visible-both gate, and the 404-not-403 own-scoped
delete are all structurally present and well-tested at the unit + masking level.

However, two genuine defects undermine the phase's core promises:

1. **CR-01 (BLOCKER):** the read-time follow-to-latest in `_resolve_readable_latest`
   leaks a private latest-version id/filename across users via the global-folder
   leg — the resolver returns documents the canonical `list_documents` access model
   would never surface. The masking layer cannot catch this because the leak is in
   the resolver the mask itself trusts.
2. **CR-02 (BLOCKER):** the same follow-to-latest mechanism breaks the documented
   "a re-upload / restore does not orphan a link" guarantee (D-116-1a). Edges are
   stored against creation-time ids; the handler queries edges by the *resolved
   latest* id, so any edge created before a re-upload silently vanishes from the
   tool's output.

The live two-user leak test (`test_116_tool_leak.py`) does NOT cover CR-01's vector
(it never moves the latest version into a private folder while keeping an old version
global), so it will pass while the leak ships. See findings below.

## Critical Issues

### CR-01: Global-folder follow-to-latest leaks a private latest version across users

**File:** `backend/app/services/document_relationship_service.py:141-186`
**Issue:**
`_resolve_readable_latest` (by-id mode) does this in two steps:

- **Step 1 (global leg, lines 156-165):** `documents WHERE id=X AND folder_id IN
  global_folder_ids` — note this fetches **ANY version row** (there is NO
  `.eq("is_latest", True)` on the global leg, unlike `_latest_by_filename:98-104`
  and unlike the canonical `documents.py:554-559` access model).
- **Step 2 (lines 172-186):** if the matched row is not `is_latest`, it follows
  forward via `documents WHERE user_id=owner AND filename=fname AND is_latest=True`
  — **with no folder constraint**.

Combined with `move_document` (`documents.py:1304-1347`), which updates `folder_id`
on a **single version row** (`.eq("id", document_id)`), the following sequence leaks:

1. Owner has doc "secret.txt" v1 in a GLOBAL folder, v2 (latest) MOVED to a PRIVATE
   folder (or simply re-uploaded so the new latest lands in a private/non-global
   folder).
2. A second user (not the owner) calls the resolver with v1's id.
3. Step 1 global leg matches v1 (it is still in the global folder, and there is no
   `is_latest` filter to exclude it).
4. Step 2 follows to latest → returns v2's row: the PRIVATE latest version's real
   `id`, `filename`, and metadata — to a user who has no access to v2.

`list_documents` (`documents.py:540-561`) would never return v2 to this caller (v2 is
neither own nor in a global folder), so the resolver is strictly more permissive than
the app's own access model. Because both the create visible-both gate AND the tool's
per-endpoint mask delegate readability entirely to this resolver, the leak propagates
to both surfaces: the agent tool renders the unseeable private filename instead of the
`_NO_ACCESS_MASK`, and the create gate would accept a link to an endpoint the caller
cannot legitimately see. The `get_supabase()` client is service-role (RLS bypassed),
so this app predicate is the SOLE owner-scoping gate — there is no RLS backstop.

The live test `test_116_tool_leak.py` does not exercise this: its target is in A's
private folder at all times with a single version, so the follow-to-latest path is
never driven across the global→private boundary. The masking it proves is real but
narrower than the threat.

**Fix:** Constrain BOTH the global-leg fetch and the follow-to-latest step to the
caller's actual access set, mirroring `list_documents`:

```python
# Step 1 global leg — only the LATEST version in a globally-visible folder is readable
# (match list_documents:554-559; an old version in a global folder is NOT readable on its own).
glob = await aexec(
    client.table("documents")
    .select("*")
    .eq("id", doc_id_or_filename)
    .in_("folder_id", global_folder_ids)
    .eq("is_latest", True)        # <-- ADD: an old version is not independently readable
    .limit(1)
)

# Step 2 — when the source row came from the GLOBAL leg, the followed-to-latest row
# must ALSO be in a globally-visible folder (or owned by the caller). Re-verify the
# latest row's folder_id is still in global_folder_ids before returning it; otherwise
# return None (the latest moved out of the caller's visibility → no leak).
```

Re-check the resolved `latest` row's `folder_id` against `global_folder_ids` (for the
global path) or `user_id == caller` (for the own path) before returning it. The own
leg is safe (caller always owns its follow-to-latest target); only the global leg
needs the post-follow visibility re-check.

### CR-02: Read-time follow-to-latest orphans every edge after a re-upload (REL guarantee broken)

**File:** `backend/app/services/tool_dispatcher.py:559-574` (+ `document_relationship_service.py:189-229`)
**Issue:**
The model docstring (`document_relationship.py:27-30`) and the service docstring
(`document_relationship_service.py:128-129`) both promise: *"a re-upload / restore
does not orphan a link"* (D-116-1a). The implementation does the opposite.

- Each document **version is a distinct row with a distinct `id`** (the upload flow
  inserts a fresh `gen_random_uuid()` row per version — `documents.py:446-486`).
- `create_relationship` stores the **submitted** ids verbatim:
  `payload = {"source_doc_id": source_doc_id, ...}` (`service.py:207-212`) — i.e. the
  creation-time id, never normalized to a stable handle.
- The handler resolves the subject to its LATEST id (`subject_id = subject["id"]`,
  `tool_dispatcher.py:559`) and then queries edges by **that latest id**:
  `.eq("source_doc_id", subject_id)` / `.eq("target_doc_id", subject_id)`
  (`tool_dispatcher.py:567,572`).

So an edge created while the doc was at version N stores version-N's id. After a
re-upload, the doc's latest id is version-(N+1)'s id. The handler follows the subject
to version N+1 and queries by N+1's id — which **does not match the stored N-keyed
edge**. The relationship silently disappears from `get_related_documents`. The
follow-to-latest mechanism makes this strictly worse: even if the agent passes
version-N's id (which still has a matching edge), the resolver follows it forward to
N+1 and queries by N+1 → still a miss.

The "other endpoint" re-resolution (`tool_dispatcher.py:594-596`) has the same flaw
in the reverse direction: a stored target id that is now an old version will
follow-to-latest fine for *display*, but the *join* that found the edge already used
the stale subject id, so the edge was never enumerated in the first place.

This is a correctness defect against the phase's headline REL requirement, not a
cosmetic one — links vanish exactly when versioning (the feature this guarantee
exists to protect) is used.

**Fix:** Edges must be matched against ALL version-ids of the subject document, or
stored against a stable handle. Two viable approaches:

```python
# Option A (read-side fix, no migration): expand the subject to its full version set
# (same user_id + filename) and query edges with .in_(...) over every version id.
versions = await aexec(
    ctx.supabase.table("documents").select("id")
    .eq("user_id", subject["user_id"]).eq("filename", subject["filename"])
)
subject_ids = [v["id"] for v in (versions.data or [])]
outgoing = await aexec(
    ctx.supabase.table("document_relationships")
    .select("id, source_doc_id, target_doc_id, rel_type")
    .eq("user_id", svc._uid(caller))
    .in_("source_doc_id", subject_ids)
)
# (mirror for incoming with target_doc_id .in_(subject_ids))
```

Option B (write-side): normalize stored `source_doc_id`/`target_doc_id` to the
document's stable/earliest version id at create time, and resolve queries to that
same stable handle. Whichever path is chosen, add a regression test that creates an
edge, re-uploads the subject (new version), and asserts the edge still appears in
`get_related_documents` — the current suite has no such test.

## Warnings

### WR-01: Idempotency 23505 re-fetch is not user-scoped against `source_doc_id`/`target_doc_id` collisions across the new index

**File:** `backend/app/services/document_relationship_service.py:213-229`
**Issue:**
The 23505-catch re-fetch (lines 218-226) filters on
`(user_id, source_doc_id, target_doc_id, rel_type)` — which matches the migration-075
unique index exactly, so the re-fetch is correct *for the constraint that fired*. The
concern is the blanket `if "23505" in str(exc)` string match (line 217): `document_
relationships` will, after CR-01/CR-02 fixes or future schema work, potentially carry
OTHER unique constraints; any 23505 from a *different* constraint would be caught here,
the re-fetch would return empty `existing.data`, and the code would fall through to
`raise` (line 229) — acceptable today, but the string-sniff couples this branch to the
assumption that 23505 can only ever mean the idempotency index. It also matches `23505`
appearing anywhere in a wrapped/nested message (e.g. a column value containing the
literal "23505"), which is brittle.
**Fix:** Prefer matching the index name in the error
(`"document_relationships_idempotency_idx" in str(exc)`) rather than the bare SQLSTATE,
so a different future unique violation is not silently swallowed into an empty re-fetch.
This mirrors the more specific check the router already does for `no_self_rel`
(`document_relationships.py:128`).

### WR-02: Inconsistent `_uid()` guarding between create/delete write paths

**File:** `backend/app/services/document_relationship_service.py:208-209, 241`
**Issue:**
The module documents `_uid()` as the UUID-coercion guard for "any runtime value
interpolated into a PostgREST `.eq()`/`.or_()` filter grammar" and the SOLE
owner-scoping gate under the service-role client. But the two write paths apply it
inconsistently:

- `create_relationship` payload: `"user_id": str(user_id)` (line 208) — raw `str()`,
  no `_uid()`.
- `delete_relationship`: `.eq("user_id", str(user_id))` (line 241) — raw `str()`,
  no `_uid()`.
- The idempotency re-fetch DOES use `_uid(user_id)` (line 221), and the resolver uses
  `_uid()` throughout.

In `.eq()` value position the supabase-py client parameterizes the value, so a raw
`str()` is not an injection vector today (the `_uid()` doc itself notes `.or_()` is the
risky grammar, and neither write path uses `.or_()`). This is therefore a consistency /
defense-in-depth gap, not a live injection. Still, `user_id` flows from
`get_current_user` and the module's own stated contract is "wrap the one
unparameterized runtime-value-into-DSL spot" — applying `_uid()` uniformly on every
`user_id` predicate makes the invariant auditable instead of "safe only because this
particular call site happens not to use `.or_()`."
**Fix:** Use `_uid(user_id)` on the `user_id` value in both the insert payload and the
delete `.eq("user_id", ...)`, matching the re-fetch and resolver. Also adds a free
malformed-uuid guard (`ValueError`) on the write path.

### WR-03: Audit write awaited in-band can stall the 201 response under a slow audit DB

**File:** `backend/app/api/document_relationships.py:137-147, 173-178`
**Issue:**
Both router handlers `await write_audit_entry(...)` in-band after the mutating work
(lines 137 and 173). The docstring calls this "fire-and-forget" (line 135), but it is
NOT fire-and-forget — it is `await`-ed, so the HTTP response blocks on the audit write
completing. `write_audit_entry` swallows errors, so a *failure* won't 500, but a *slow*
audit round-trip directly adds to the create/delete latency, and a hung audit DB would
hang the request. The tool-dispatcher handlers correctly use `ctx.spawn(write_audit_
entry(...))` for true fire-and-forget (`tool_dispatcher.py:284, 447`); the router does
not have a `spawn` analog, but `asyncio.create_task` or a background-task injection
would decouple it.
**Fix:** Either rename the comment to reflect that this is a blocking (if
error-swallowing) write, or genuinely decouple it (e.g. FastAPI `BackgroundTasks`, or
`asyncio.create_task` with a logged-exception done-callback) so the receipt never sits
on the response critical path.

### WR-04: Self-link guard ordering claim is contradicted by the actual code

**File:** `backend/app/api/document_relationships.py:86-112` (vs docstring 77-83 / 104-107)
**Issue:**
The handler docstring and inline comments assert the visible-both gate runs BEFORE the
self-link check so "an unseeable id and a self-link are indistinguishable by error
shape" (lines 89-91, 104-107). The code does run the readability resolve first
(lines 92-97) — but for a self-link where the (single) document IS readable, the
resolve SUCCEEDS, then the self-link check at line 108 fires the 422. For a self-link
where the document is NOT readable, the visible-both gate fires first (line 98). So the
error *detail* is uniform (`_INVALID_LINK_DETAIL` in both), which is the stated goal —
but the claim "the readability check runs BEFORE the self-link consideration so they
collapse to the SAME 422" is only half-true: a *readable* self-link is rejected by the
self-link branch (step 2), not the visible-both branch. This is harmless for the oracle
property (same status + same detail), but the comment overstates the mechanism and
could mislead a future maintainer into thinking step 2 is dead code (it is not — it is
the sole rejector for readable self-links).
**Fix:** Tighten the comment to: "both branches return the identical status+detail, so
the *response* carries no ordering oracle; step 2 specifically handles the
readable-self-link case." No code change required — this is a correctness-of-documentation
fix to prevent a future maintainer from deleting the live step-2 guard.

## Info

### IN-01: Global-leg by-id resolution missing `is_latest` filter is inconsistent with the filename path

**File:** `backend/app/services/document_relationship_service.py:158-164`
**Issue:** `_latest_by_filename` global leg filters `.eq("is_latest", True)` (line 102),
but the by-id global leg (lines 158-164) does not. Even after CR-01 is fixed, keeping
the two legs symmetric (both `is_latest`-gated on the global path) makes the "readable =
own-latest ∪ global-latest" invariant obvious at every call site rather than relying on
the follow-to-latest step to launder an old-version match.
**Fix:** Add `.eq("is_latest", True)` to the by-id global leg (folded into the CR-01
fix).

### IN-02: `apply_migration_075.py` hardcodes local DSN with embedded credentials

**File:** `scripts/apply_migration_075.py:22`
**Issue:** `DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"` hardcodes
the local dev credential. This is an intentional throwaway local-only apply script
(per the module docstring and the 100/099/111 precedent), and the credential is the
well-known default local Supabase password — not a production secret. Flagged only for
completeness; no action needed beyond confirming the file is never run against a remote
DSN. Consider reading `POSTGRES_DSN` from the environment (as the test files do) so the
script can never silently target the wrong DB if copy-pasted.
**Fix:** `DSN = os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")`.

### IN-03: No read-side regression test for the version-orphan and global-leak vectors

**File:** `backend/tests/integration/test_116_tool_leak.py` (scope gap)
**Issue:** The integration suite proves per-viewer masking for a target in a *private*
folder, but has no test for (a) a target whose latest version moved from a global to a
private folder (CR-01's vector) or (b) an edge created against an old version id whose
subject was subsequently re-uploaded (CR-02's vector). Both are the exact "static would
false-green" cases the phase's own threat model warns about.
**Fix:** Add two live rows: one that seeds an old-global / latest-private version pair
and asserts the resolver returns None (mask), and one that creates an edge, re-uploads
the subject, and asserts the edge still surfaces. These tests will fail against the
current implementation and pass once CR-01/CR-02 are fixed.

---

## Adversarial Verification (orchestrator, 2026-06-20)

Before acting on the review, the orchestrator ran a 10-agent adversarial-verification
workflow — 3 distinct-lens refuters per BLOCKER (each instructed to REFUTE by tracing the
real code) + 1 verifier per warning. Verdicts (all high-confidence):

| Finding | Verdict | Reproducible | Disposition |
|---|---|---|---|
| **CR-01** (cross-user leak via global-leg follow-to-latest) | **3/3 confirmed_real** | 3/3 yes | **REAL — must fix** |
| **CR-02** (edges orphaned after re-upload; LOCKED D-116-1 violated) | **3/3 confirmed_real** | correctness | **REAL — must fix** |
| WR-01 (bare `"23505"` sniff) | 1/1 **uncertain** | n/a | **Downgrade → nit.** The literal observation is true, but the harmful consequence does NOT occur today: a different-constraint 23505 → empty re-fetch → falls through to `raise` (original error re-raised, not swallowed), and the idempotency index is the ONLY unique constraint on the table (grep 071-075). Matches the uniform codebase convention (`documents.py:500`). Optional hardening, not a defect. |
| WR-02 (`_uid()` inconsistency on write paths) | 1/1 confirmed | no | Real but **defense-in-depth/consistency only** — `.eq()` value position is parameterized; not a live injection. Low. |
| WR-03 (in-band audit `await`, mislabeled "fire-and-forget") | 1/1 confirmed | no | Real latency/robustness gap, but **inherited pattern** — `document_views.py:129` shares it; not a 116 regression. Low. |
| WR-04 (overstated self-link ordering comment) | 1/1 confirmed | no | Doc-only; the response (status+detail) IS uniform, so no live oracle. Trivial. |

**Independent corroboration (orchestrator read of the real code):**
- CR-01 premise — `folder_utils.py:48-56` returns global folders **cross-user** (`user_id != caller`); `folders` RLS is `auth.uid()=user_id OR is_global` (migration 014:26). The by-id global leg (`service.py:158-164`) lacks `.eq("is_latest", True)` (unlike the filename leg `:102` and `documents.py:558`); follow-to-latest (`service.py:178-185`) has **no folder re-check**. Re-upload keeps the old version's `folder_id` while inserting a new latest in a different folder (`documents.py:457-487`), so v1-global-stale / v2-private-latest is reachable WITHOUT even `move_document`. A non-owner replaying v1's id gets v2's private id+filename — which `list_documents` would never surface (strictly more permissive). The D-116-9 mask never fires (resolver returns non-None). `test_116_tool_leak.py` is vacuous on this vector (single-version private target).
- CR-02 — each version is a NEW `uuid4()` row (`documents.py:472`); `create_relationship` stores submitted ids verbatim (`service.py:207-214`); the handler queries edges by the resolved-**latest** `subject_id` (`tool_dispatcher.py:559,567,573`). Edge created at v1 (`source_doc_id=A`) is missed once latest is v2 (`B`). No DB trigger re-points edges (grep 071-075 clean). The two `test_116_version_stable.py` rows false-green because they assert the SUBJECT follows forward, never that an EDGE survives a re-upload.

**Routing:** CR-01 + CR-02 are confirmed phase-goal defects (REL-04 leak-safety; REL-01/SC#1 follow-to-latest). They are NOT advisory — phase verification cannot honestly pass with a live cross-user leak. → gap closure (`/gsd:plan-phase 116 --gaps`): fix the resolver visibility re-check (CR-01), the edge-version-set query (CR-02, read-side, no migration), add the two missing non-vacuous regression tests (IN-03), and fold the WR-02/03/04 nits.

---

_Reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Adversarial verification: 10-agent workflow (3 lenses/blocker), orchestrator-corroborated_
_Depth: standard_


---

## Gap-Closure Review — Plan 116-05 (CR-01 + CR-02 Fixes)

**Reviewed:** 2026-06-20
**Depth:** standard
**Commits:** 1df5239c, 36e4f2b9, db412c59, c43405b8
**Files Reviewed:** 5
**Status:** clean

### Summary

The 116-05 gap-closure diff correctly closes both confirmed BLOCKERs and all three
folded nits (WR-02/03/04) from the Plans 01–04 review. The two new regression tests
are non-vacuous: each has a concrete cross-check that proves the test cannot trivially
pass against a no-op fix. The shared-path constraint (threads.py, SSE, dispatch_tool)
is respected — no line outside `_handle_get_related_documents` is touched in
`tool_dispatcher.py`. No tool-schema change was introduced, preserving the Gemini-safe
guarantee. One INFO item is noted (unbounded version-lineage query) and is explicitly
out of v1 scope.

**CR-01 fix verdict: CORRECT.** The two-part guard (is_latest gate on the global leg
+ post-follow folder re-check) precisely mirrors `list_documents`'s access model and
closes the private-latest leak without false-negatives on the own-leg or the
legitimate global-latest case. All traced paths produce the expected outcome.

**CR-02 fix verdict: CORRECT.** The `_subject_version_ids` helper is correctly scoped
to the subject's `(user_id, filename)` lineage with `_uid()` applied, never widened
across documents, with a safe fallback for missing fields. The `.in_(version_ids)` edge
enumeration is owner-scoped by the `user_id=caller` predicate, so the widening
introduces no cross-user edge enumeration risk.

**WR-02/03/04 fold-ins verdict: CORRECT.** `_uid()` is now applied uniformly on all
write paths (insert payload and delete `.eq()`), matching the re-fetch and the
resolver. The audit-write comments in `document_relationships.py` now accurately
describe the in-band blocking pattern. The self-link comment now names the step-2
guard as the sole rejector for readable self-links.

**Unit test stub update verdict: CORRECT.** `_EdgeQuery.in_()` now correctly routes
directional discrimination, `_EdgeClient` correctly dispatches the documents table to
`_DocVersionQuery`, and the empty-version-id-rows default triggers the fallback to
`[subject["id"]]` — so existing unit tests run against the new `.in_()` handler
behavior without change.

### Critical Issues

None.

### Warnings

None.

### Info

#### IN-116-05-01: `_subject_version_ids` has no `.limit()` — unbounded lineage query

**File:** `backend/app/services/document_relationship_service.py:133-139`
**Issue:** The version-lineage lookup `client.table("documents").select("id").eq("user_id",
_uid(owner)).eq("filename", fname)` has no `.limit()`. For a document with a large
number of versions (e.g. a frequently re-uploaded report), this returns all version
rows without a cap. In practice the number of versions per `(user_id, filename)` is
small (typically < 10), and the plan notes rename does not exist so the lineage is
strictly bounded by upload frequency. This is a quality note, not a correctness defect,
and performance is out of v1 review scope.
**Fix (optional):** Add `.limit(500)` or similar defensive cap so an edge case (e.g. a
scripted re-upload loop) cannot produce a very large `version_ids` list that inflates
the subsequent `.in_()` PostgREST query. Not required before shipping.

### Detailed Logic Trace (adversarial — each path verified)

**CR-01 fix paths:**

| Caller | Doc state | Own-leg | Global-leg | from_global | Step 2 | Step 2b | Result |
|--------|-----------|---------|------------|-------------|--------|---------|--------|
| non-owner B | v1 in global folder (is_latest=False), v2 private (is_latest=True) | miss (B != A) | miss (is_latest=False gate) | False | — | skipped | **None** (CORRECT: no leak) |
| owner A | v1 in global folder (is_latest=False), v2 private (is_latest=True) | HIT (A owns v1) | not reached | False | follow to v2 | skipped | **v2** (CORRECT: owner follows own latest) |
| non-owner B | v1 in global folder (is_latest=True, is the current latest) | miss | HIT (is_latest=True, folder in global_ids) | True | row is already latest | v1.folder_id in global_ids → PASS | **v1** (CORRECT: B reads global latest) |
| non-owner B | v1 in global folder (is_latest=True), then re-uploaded v2 to same global folder | miss | HIT for v1 (is_latest=False now) → miss | False | — | — | **None** (CORRECT: v1 no longer latest) |
| non-owner B | subject v2 (another user's global doc, is_latest=True) passed directly | miss | HIT (is_latest=True, in global folder) | True | row is latest | v2.folder_id in global_ids → PASS | **v2** (CORRECT) |

Key invariant confirmed: `from_global=True` is only set inside `if global_folder_ids:`,
so `global_folder_ids` is guaranteed non-empty whenever Step 2b runs. The
`folder_id not in global_folder_ids` check correctly treats `folder_id=None` (private)
as not-in-set → returns None.

**CR-02 fix path:**

`_subject_version_ids(subject)` queries `documents WHERE user_id=subject["user_id"] AND
filename=subject["filename"]` — returns ALL version UUIDs for the lineage. The edge
queries then use `.in_("source_doc_id", version_ids)` / `.in_("target_doc_id",
version_ids)` with `.eq("user_id", _uid(caller))` still constraining to caller-owned
edges. An edge created against v1's UUID is found when the in-list includes v1's UUID,
even if the subject resolved to v2 (the latest). The output `subject` field in the
ToolResult still reports the resolved-latest `subject_id`, which is correct per D-116-4.

**Cross-user subject safety:** When the subject belongs to a DIFFERENT user (a globally
accessible doc owned by A, resolved by caller B), `_subject_version_ids` queries
A's lineage (all versions of A's doc). The edge queries are constrained by
`.eq("user_id", B)` — so only B's own edges are returned, even when the in-list
contains all of A's version UUIDs. No cross-user edge enumeration is possible.

**Shared-path safety confirmed:** The only change to `tool_dispatcher.py` is inside
`_handle_get_related_documents` (lines 560–590 in the post-fix file). `dispatch_tool`,
`_TOOL_REGISTRY`, and every other handler are byte-identical. `threads.py` is untouched.
No tool schema changes — `openai_service.py` is not in the diff.

---

_Gap-closure reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

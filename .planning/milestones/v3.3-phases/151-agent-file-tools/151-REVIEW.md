---
phase: 151-agent-file-tools
reviewed: 2026-07-14T03:34:30Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - backend/app/services/tool_dispatcher.py
  - backend/app/services/openai_service.py
  - backend/app/config.py
  - backend/app/api/workspace.py
  - frontend/src/components/panel/TemplateUpload.tsx
  - supabase/migrations/101_skill_files_unique_index.sql
  - backend/tests/unit/test_151_fetch_handler.py
  - backend/tests/unit/test_151_attach_handler.py
  - backend/tests/unit/test_151_upload_allowlist.py
  - backend/tests/unit/test_151_tool_schema.py
  - backend/tests/unit/test_151_registration.py
  - backend/tests/unit/test_151_cross_provider_schema.py
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 151: Code Review Report

**Reviewed:** 2026-07-14T03:34:30Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 151 adds two agent tools — `fetch_document_file` (KB doc original bytes →
sandbox) and `attach_skill_file` (write a file onto an owned skill from 4 sources)
— plus a widened upload allowlist and migration 101's `(skill_id, filename)` unique
index. I reviewed the focus areas the orchestrator called out and verified each
claim against the code rather than the docstrings.

What holds up under adversarial scrutiny:

- **Path traversal** is correctly defended on both write paths. `fetch` scrubs
  `documents.filename` to a `basename` + charset scrub before landing under
  `/sandbox/input/`; `attach` never puts a model-supplied segment into the Storage
  path (`{uid}/{skill_id}/{filename}`, filename sanitized). The traversal unit tests
  pass for real.
- **Owner-scope reads/writes** are enforced app-side (service-role has no RLS
  backstop): the skill write gate is `.eq("user_id", uid)` (not the `.or_(is_global)`
  read filter), and the doc resolver runs `.eq("user_id")` first then an explicit
  global-folder fallback that mirrors `read_document`.
- **Race safety** is real: migration 101's unique index matches the
  `on_conflict="skill_id,filename"` upsert, and the storage write path
  (`{uid}/{skill_id}/{filename}`) matches how `read_skill_file` and the execute_code
  skill-file injection reconstruct it — I traced both, they agree.
- **Cross-provider** shapes are anyOf/oneOf-free; the new `["string","null"]` fields
  are collapsed by `google_service._translate_nullable_type`, consistent with the
  existing workspace/task/ask_user tools.
- **Blocking I/O** — every Storage/container call is `run_in_threadpool`-wrapped; DB
  calls go through `aexec` (which is itself a threadpool wrapper).

The defects below are all robustness / DoS-cap / accuracy gaps, not correctness or
cross-user breaches. No blockers, but WR-01 and WR-02 should be fixed before ship.

## Warnings

### WR-01: `fetch_document_file` drops the honest-failure `try/except` that `read_path` deliberately has

**File:** `backend/app/services/tool_dispatcher.py:285-303` (and the unguarded call site at `:352`)
**Issue:** `_fetch_owned_document_bytes` docstring claims it "Mirrors `read_path`'s
owner→global two-step (kb.py:395-416)", but it drops the surrounding resilience
wrapper. Compare `kb.py:395-418` — `read_path` wraps **both** SELECTs in
`try/except Exception:` and returns the calm `{"error": "…not found or access
denied."}` on **any** failure. `_fetch_owned_document_bytes` runs the two
`aexec(... .maybe_single())` calls bare (lines 288-300). `document_id` is
model-supplied and the tool description invites a UUID, but models routinely pass a
filename or free text. A non-UUID `document_id` makes PostgREST reject the
`id = eq.<garbage>` cast (invalid input syntax for type uuid → 400), which
`.maybe_single()` re-raises as an `APIError` (only the PGRST116 "0 rows" case is
swallowed). That exception propagates out of `_fetch_owned_document_bytes` →
`_handle_fetch_document_file` (no `try/except` around line 352) → into
`agent_loop.py:2535`, where it becomes `"Tool execution failed: {raw APIError}"`
instead of the intended honest `"Document '<id>' not found or access denied."` This
(a) violates the calm-ToolResult contract the sibling handlers `get_related_documents`
(:919-932) and `query_documents_by_view` (:751-759) explicitly adopted after "the 115
WR-01/WR-03 lesson", and (b) leaks raw PostgREST/DB error text into model context. The
same bare-SELECT gap exists for `attach_skill_file`'s skills SELECT
(`tool_dispatcher.py:545-548`) and its `kb_document` source
(`_resolve_attach_source_bytes` :499 → unguarded call at :558). A transient DB blip on
any of these — not just a bad UUID — would surface the same raw failure.
**Fix:** Wrap the resolver's owner + global SELECTs (and the attach skills SELECT) in
`try/except Exception:` returning the honest `{"error": …}` dict, exactly as
`read_path` does:
```python
try:
    res = await aexec(
        ctx.supabase.table("documents").select(_cols)
        .eq("id", document_id).eq("user_id", uid).maybe_single()
    )
    row = res.data if res else None
    if not row:
        gfids = await get_globally_visible_folder_ids(ctx.supabase, uid)
        if gfids:
            res = await aexec(
                ctx.supabase.table("documents").select(_cols)
                .eq("id", document_id).in_("folder_id", gfids).maybe_single()
            )
            row = res.data if res else None
except Exception:
    return {"error": f"Document '{document_id}' not found or access denied."}
if not row:
    return {"error": f"Document '{document_id}' not found or access denied."}
```

### WR-02: `attach_skill_file` `sandbox_output` source has no size cap — unbounded Storage write

**File:** `backend/app/services/tool_dispatcher.py:446-474`
**Issue:** The four `attach` sources have inconsistent DoS protection. `inline` is
capped at 5 MB (`_ATTACH_INLINE_MAX_BYTES`, :484), `kb_document` at 50 MB (via
`_fetch_owned_document_bytes`'s `fetch_document_file_max_mb` gate), and `workspace`
is bounded by the workspace's own 10 MB write ceiling. But `sandbox_output`
(`_harvest`, :452-466) reads whatever file the agent produced in `/sandbox/output`
with **no size check** and hands the full bytes straight to `.upload(...)`. A model
that generates a large artifact in the sandbox (trivial: `open('/sandbox/output/x','wb').write(b'0'*N)`)
can attach an arbitrarily large blob to a skill — the whole file is read into backend
RAM in the threadpool, then uploaded to the `skill-files` bucket with no ceiling. This
is exactly the "Size/DoS caps" axis the phase flags. It also means the largest,
least-trustworthy source (agent-generated bytes) is the only one with zero cap.
**Fix:** Apply a byte ceiling to the harvested bytes before upload, mirroring the
inline/kb caps (reuse `settings.fetch_document_file_max_mb`, or add an attach cap):
```python
data = await run_in_threadpool(_harvest)
if data is None:
    return {"error": f"No sandbox output file named '{want}' in /sandbox/output."}
cap = settings.fetch_document_file_max_mb * 1024 * 1024
if len(data) > cap:
    return {"error": f"Sandbox file '{want}' is {len(data)//1024//1024} MB, over the {cap//1024//1024} MB attach limit."}
return (data, guess_mime_type(filename))
```

### WR-03: `fetch` size cap trusts DB `file_size` and defaults to 0 (unlimited) when NULL

**File:** `backend/app/services/tool_dispatcher.py:317-329`
**Issue:** The pre-download cap is the *only* DoS guard on `fetch_document_file`, and
it is enforced against `row.get("file_size") or 0`. If a document's stored
`file_size` is `NULL` or `0` (older text-only ingests, or any row that never recorded
a byte count), `0 > cap_bytes` is False and the guard is skipped — the full file is
then `storage.download`ed into backend RAM regardless of its true size. The cap is
also never re-checked against the *actual* downloaded `len(doc_bytes)`, so stale/low
metadata under-counts the real payload. Under `WORKER_COUNT=2` this is a memory-
exhaustion vector for any doc whose `file_size` is absent or wrong. The docstring
sells this gate as "computed PRE-download so a too-large file is NEVER partially
fetched" — true for the *partial-binary* concern, but the null-size bypass defeats the
DoS purpose.
**Fix:** Treat a missing/zero `file_size` as "unknown → refuse or verify", not
"unlimited", and validate the real byte length after download:
```python
file_size = row.get("file_size")
if not file_size:  # None or 0 → cannot trust; refuse rather than fetch unbounded
    return {"error": "This document has no recorded size; cannot safely fetch its original bytes."}
if file_size > cap_bytes:
    return {"error": ...}
file_bytes = await run_in_threadpool(...)
if len(file_bytes) > cap_bytes:  # metadata drift backstop
    return {"error": f"File is {len(file_bytes)//1024//1024} MB, over the {cap_bytes//1024//1024} MB fetch limit."}
```

### WR-04: `attach_skill_file` owner gate rejects only `is_system`, not `is_global` — misleading refusal copy

**File:** `backend/app/services/tool_dispatcher.py:545-554`
**Issue:** The write gate selects `.eq("name", …).eq("user_id", uid)` and refuses when
`not skill_row or skill_row.get("is_system")`. The user-facing refusal explicitly
claims "you can only attach files to a skill you own **(not a global or built-in
skill)**" — but the code never checks `is_global`. A skill that is
`user_id == uid AND is_global == true` passes the gate, so a user *can* attach files
to a global skill they own; those files then become readable/injectable by every user
who loads that global skill (`read_skill_file` / execute_code injection resolve on the
`.or_(is_global.eq.true)` read scope). Owner-scope (`user_id`) still holds, so this is
**not** a cross-user write — but the refusal message overstates the enforcement, and
the `is_global` defense-in-depth a reader would expect from that copy is absent. An
auditor trusting the message would draw a wrong conclusion about the blast radius of a
poisoned global-skill file.
**Fix:** Either enforce what the message claims, or correct the message. To enforce:
```python
skill_res = await aexec(
    ctx.supabase.table("skills").select("id, is_system, is_global")
    .eq("name", target_skill_name).eq("user_id", uid).maybe_single()
)
skill_row = skill_res.data if skill_res else None
if not skill_row or skill_row.get("is_system") or skill_row.get("is_global"):
    return ToolResult(result=json.dumps({"error": "…not a global or built-in skill…"}))
```
If writing to an owned global skill is intentional, drop "(not a global … skill)" from
the copy so it matches behavior.

## Info

### IN-01: `attach_skill_file` uploads to Storage before the DB upsert — no cleanup on partial failure

**File:** `backend/app/services/tool_dispatcher.py:580-598`
**Issue:** The write does Storage `.upload(...)` first, then the `skill_files` DB
upsert, both inside one `try`. If the Storage upload succeeds but the DB upsert raises
(e.g. migration 101's unique index not yet applied → `ON CONFLICT` has no matching
constraint → error 42P10, or any transient DB failure), the function returns the honest
"Failed to attach" error but leaves an **orphaned object** in the `skill-files` bucket
with no `skill_files` row pointing at it. The state is eventually self-healing (a retry
overwrites the object and creates the row), so this is not data loss — just untracked
storage. Worth noting because the whole tool hard-depends on migration 101 being
applied (documented as a pending cloud apply); until it lands, every `attach` will hit
this partial-failure path and accrete orphans.
**Fix:** On the DB-upsert failure branch, best-effort `remove` the just-uploaded object
before returning the error, or reorder so the DB write's success is confirmed before
committing the object (harder with Storage). At minimum, add a comment noting the
orphan-on-DB-failure window so it isn't mistaken for clean rollback.

---

_Reviewed: 2026-07-14T03:34:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 104-pm-flagship-content-pack
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/validator_kinds.py
  - scripts/seed-pm-pack.py
  - scripts/pm-pack/scoreboard_smoke.py
  - scripts/pm-pack/make_pm_corpus.py
  - scripts/pm-pack/make_pm_templates.py
  - backend/tests/unit/test_pm_pack_templates.py
  - backend/tests/integration/test_seed_pm_pack.py
  - backend/tests/unit/test_llm_emit_executor.py
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 104: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 104 is a content-and-seed phase (zero new engine routes or migrations) that ships three
deliverables: two engine fixes (`phase_types.py`, `validator_kinds.py`), a service-role seed
script (`scripts/seed-pm-pack.py`), a cross-provider test harness
(`scripts/pm-pack/scoreboard_smoke.py`), two content builders (`make_pm_corpus.py`,
`make_pm_templates.py`), and three test modules.

The two engine fixes are **additive-correct**: they expose data that was already present inside
the executor to downstream post-phase validators, without changing any existing code path. The
security-sensitive seed script correctly handles secrets (name-only env lookups), traversal (slug
regex guard before Storage-path construction), parameterized SQL throughout, and has a strong
RLS-owner pre-flight. No critical findings.

Three warnings require attention: a latent false-positive risk in the `output_file_valid`
symmetric short-circuit when `residual_clean` is absent from the verdict dict; a mutable default
in the `upsert_definition` comparison that can silently fail to refresh a stale def; and a
`_upload_pipeline` invocation that runs synchronous blocking I/O on the caller's thread without
`run_in_threadpool` (project rule violation — but the seed runs out-of-process, so no event-loop
blocking occurs today). Four info items cover minor defensive-coding gaps.

---

## Warnings

### WR-01: `output_file_valid` symmetric gate defaults `residual_clean` to `True` when key is absent — can promote a partial render to a PASS

**File:** `backend/app/services/harness/validator_kinds.py:272`

**Issue:** The 104-03 fix added:

```python
if of.get("opened") is True and of.get("residual_clean", True):
    return GateResult(True, None)
```

The default `True` for the missing `residual_clean` key is the same default used on the
matching `opened is False` path (line 340) and mirrors the `status == "ok"` executor guarantee.
However, the executor's enrichment block (phase_types.py:1410-1416) only fires when
`"opened" not in output_file`. If a future emitter (or a deserialized persisted-output row)
produces `output_file = {"opened": True}` without `residual_clean`, the gate returns `True`
unconditionally — even if the render left residual tokens.

The executor currently sets `residual_clean: bool(_v.get("residual_clean", True))`, so for any
render path that reaches `status == "ok"` the key is present. But the defensive default means
the gate silently passes an output that never had its residual tokens verified. A future emitter
that sets `opened=True` without `residual_clean` (e.g. a PPTX/XLSX emitter added in Phase 106)
would slip through.

**Fix:** Make the early-return conditional on `residual_clean` being *explicitly* `True`, not
just truthy-by-default:

```python
# 104-03: symmetric seam
if of.get("opened") is True and of.get("residual_clean") is True:
    return GateResult(True, None)
```

This makes the gate fall through to the physical re-open for any output that does not carry an
explicit `residual_clean=True` signal, preserving the intended "trust only what the engine
explicitly asserted" contract.

---

### WR-02: `upsert_definition` compares serialized JSON with `!=` — dict key ordering may silently skip a needed DELETE-then-INSERT

**File:** `scripts/seed-pm-pack.py:2131`

**Issue:**

```python
existing = cur.fetchone()
if existing is not None and existing[0] != target_def:
    cur.execute("DELETE FROM public.workflow_definitions WHERE id = %s", ...)
```

`target_def = json.dumps(def_dict)` produces a string with Python's default key ordering.
`existing[0]` is the Postgres `definition::text` cast of the stored JSONB — Postgres normalizes
JSONB key ordering (alphabetic, depth-first), which differs from Python's insertion order. If
the two dicts have the same logical content but different key orderings, the string comparison
always evaluates as `!=` and the script DELETEs and re-INSERTs the def on every run, even when
nothing changed. The def rows are published, so the re-INSERT is safe (the immutability
trigger only blocks UPDATE), but:

1. The idempotency semantic stated in the docstring is violated — every run re-seeds even when
   the content is identical, wasting a round-trip and re-triggering any downstream watchers.
2. More importantly: if the Postgres JSONB representation of a previously-seeded def were
   somehow identical to `target_def` after normalization, the DELETE would be skipped and the
   INSERT's `ON CONFLICT (id) DO NOTHING` would silently leave a stale def in place.

**Fix:** Compare the parsed JSONB rather than the serialized string, or normalize both sides
before comparing:

```python
import json as _json
existing_parsed = _json.loads(existing[0]) if existing else None
target_parsed = def_dict  # already a dict

if existing_parsed is not None and existing_parsed != target_parsed:
    cur.execute("DELETE FROM public.workflow_definitions WHERE id = %s", (def_id,))
```

This compares logical content, not serialization order.

---

### WR-03: `_upload_pipeline` called synchronously in `ingest_corpus` — violates the project's async-blocking-I/O rule, and passes `storage_path` that triggers a second Storage upload inside a service-role context where the first upload already happened

**File:** `scripts/seed-pm-pack.py:1918-1932`

**Issue:** Two sub-issues on the `run_ingest` branch:

**Sub-issue A (blocking I/O convention):** The project rule states "Do not run blocking I/O
(e.g. `supabase-py` calls) directly inside async handlers — wrap with `run_in_threadpool`."
`_upload_pipeline` is a synchronous function that makes supabase-py network calls. The seed
script is not an async handler (it runs as a standalone script), so this does not block an event
loop today. However, if `ingest_corpus` is ever called from an async context (e.g. a future
admin route), the pipeline's synchronous supabase calls would block the event loop. This is a
latent violation.

**Sub-issue B (double Storage upload):** The seed script first inserts the document row with
`file_path = storage_path` and then calls `_upload_pipeline(... storage_path=storage_path ...)`.
`_upload_pipeline`'s docstring (line 150) says "Skipped if `storage_path` is empty / None
(reingest path — file already in storage)." Because `storage_path` is non-empty here, the
pipeline performs a second Storage upload of the same bytes — a redundant write on top of the
document-row INSERT that already set `file_path`. For markdown files processed in-process this
is harmless (the file is overwritten with identical bytes), but it is an accidental
double-write that could cause a transient Storage conflict.

**Fix:** For the in-process embed path, pass `storage_path=""` or `storage_path=None` to skip
the internal Storage re-upload (the document row already carries the `file_path`), OR upload the
file to Storage first (before the document row INSERT) and pass `storage_path` only to
`_upload_pipeline` to let it handle Storage + extract + embed atomically (the `upload_document`
route pattern):

```python
if run_ingest:
    from app.api.documents import _upload_pipeline
    _upload_pipeline(
        document_id=document_id,
        raw=raw,
        mime_type=md_mime,
        filename=filename,
        user_id=DEMO_USER_ID,
        storage_path="",   # already uploaded above; skip the second Storage write
        supabase=supabase,
        engines_dict=None,
    )
```

---

## Info

### IN-01: `_SLUG_RE` is compiled at module level but `_assert_slug` is only called in `upload_template` — slug in the document `file_path` is not slug-guarded

**File:** `scripts/seed-pm-pack.py:1901`

**Issue:** The `storage_path` for corpus documents is built as
`f"{DEMO_USER_ID}/{document_id}/{filename}"` where `filename = path.name` comes from
`Path.glob("*.md")`. The glob is constrained to `*.md` files under a committed local directory,
so `filename` cannot contain `../`. However the `_assert_slug` guard is never applied to the
document storage paths. If the corpus directory were populated with files whose names contained
`/` or `.` sequences (possible on some filesystems or if the corpus builder is extended), the
Storage path could be mis-shaped. This is low-risk given the controlled source directory but is
a defensive-coding gap.

**Fix:** Add a filename-safety check in `ingest_corpus`:

```python
if "/" in filename or filename.startswith("."):
    raise SystemExit(f"Unsafe corpus filename {filename!r}: must not contain path separators")
```

---

### IN-02: `emit_ids` writes `demo_user_id` to the manifest file — a committed artifact would leak a dev UID

**File:** `scripts/seed-pm-pack.py:2188`

**Issue:** `pm_pack_ids.json` includes `"demo_user_id": DEMO_USER_ID`. This file is written to
`scripts/pm-pack/pm_pack_ids.json`. If this file is committed to the repository (as the
scoreboard harness reads it by path), it would commit a real auth UID to source control. The UID
is already present as a constant in the seed script itself (`DEMO_USER_ID`), so the marginal
exposure is limited. However the pattern of writing PII-adjacent data to a committed artifact
conflicts with the project's "env vars are for secrets and infra only" rule.

**Fix:** Add `scripts/pm-pack/pm_pack_ids.json` to `.gitignore`, or remove `demo_user_id` from
the manifest (the scoreboard harness uses the slug/def_id fields; the test module hardcodes the
constant separately).

---

### IN-03: `test_def_shape_is_two_phase_fill` asserts `render_template` absent by `json.dumps` string search — can produce a false-negative if a future validator config key contains the substring

**File:** `backend/tests/integration/test_seed_pm_pack.py:246-249`

**Issue:**

```python
all_tools = json.dumps([p["config"].get("available_tools", []) for p in phases])
assert "render_template" not in all_tools, ...
```

This serializes the list of `available_tools` lists and does a substring search on the result.
`json.dumps` will include surrounding quotes, so `"render_template"` in the JSON string means
the substring search also matches a key named e.g. `"not_render_template"` or `"render_template_v2"`.
In the current JSONB this is benign (no such keys exist), but the assertion is fragile.

**Fix:** Assert directly on the list contents:

```python
for p in phases:
    assert "render_template" not in (p["config"].get("available_tools") or []), (
        f"{slug}: render_template must NOT appear in any available_tools"
    )
```

---

### IN-04: `scoreboard_smoke.py` — `honest_failure` and `narrated_text` can both be `True` simultaneously, producing a contradictory row

**File:** `scripts/pm-pack/scoreboard_smoke.py:1356-1359`

**Issue:**

```python
narrated_text = completed and produced_file is None and not truncated
honest_failure = (not completed) or (truncated and produced_file is None)
```

When `completed=False` (e.g. the run failed a gate), `honest_failure=True`. `narrated_text`
requires `completed=True`, so the two are mutually exclusive when `completed` is the discriminator.
However when `completed=True, produced_file=None, truncated=True`: `narrated_text=False` (blocked
by `not truncated`), `honest_failure=True` (truncated and no file) — correct.

The only potentially confusing case is `completed=True, produced_file=None, truncated=False`:
`narrated_text=True`, `honest_failure=False`. The `print_rows` logic correctly treats
`narrated_text=True` as a FAIL for all tiers. No actual logic bug, but the comment "a timeout
is an honest non-completion" at line 1435 sets `honest_failure=True` while `terminal_state`
remains `"unknown"` (not `"completed"`), so `narrated_text` stays `False` — consistent.

This is an info-level note: the flag semantics are correct but the interaction is subtle enough
to warrant a comment clarifying that `honest_failure` and `narrated_text` are mutually exclusive
by construction (since `narrated_text` requires `completed=True` and `honest_failure` on the
completed path requires `truncated=True`).

**Fix:** Add a brief inline comment after the two assignments:

```python
# narrated_text and honest_failure are mutually exclusive on the completed path:
# narrated_text requires completed=True and not truncated;
# honest_failure on the completed path requires truncated=True.
```

---

## Engine Fix Assessment

### `phase_types.py` — additive correctness verdict: CONFIRMED ADDITIVE, NO REGRESSION

The change at lines 1410-1416 and 1436-1444:

1. **Scope of added keys:** `retrieved_ids` and `placeholder_keys` are both in-scope at the
   return site. `retrieved_ids` is the same `frozenset`/`set` built at line ~1383 and passed
   to `forced_emit`; `placeholder_keys` is the oracle's key list. Both are present on every
   `status == "ok"` path. `sorted(retrieved_ids)` converts the set to a deterministic list —
   no mutation of the set.

2. **Existing paths unaffected:** The `status != "ok"` paths (integrity failure, render error,
   surfaced failure) return different dicts that do not include these keys. The pre-existing
   `field_map`, `path`, `source_refs`, `citations` keys are unchanged. The added keys are
   strictly additive.

3. **`output_file` enrichment:** The `if isinstance(output_file, dict) and "opened" not in
   output_file` guard ensures the enrichment only fires when the render path did not already
   populate `opened`. This prevents a double-overwrite if a future render path returns `opened`
   directly. The `bool(_v.get(..., True))` defaults (`True`) are consistent with the
   `status == "ok"` executor guarantee (the executor only reaches this branch when
   `assert_integrity` passed). WR-01 above flags the symmetric default in the validator; the
   executor default here is safe because it is always coupled with `status == "ok"`.

4. **The internal citation gate path** (pre-existing, not changed) already passed `retrieved_ids`
   to `check_coverage` before the return — the fix surfaces the same value to post-phase
   validators that the internal gate already consumed. No double-validation risk.

**Verdict: additive, no shared-path regression.**

### `validator_kinds.py` — symmetric short-circuit correctness verdict: CORRECT but see WR-01

The new lines 267-273:

```python
if of.get("opened") is True and of.get("residual_clean", True):
    return GateResult(True, None)
```

The guard is symmetric with the existing `opened is False` short-circuit on line 265. It
correctly short-circuits before the physical file re-open attempt — which is the right thing
to do for workspace-INLINE files whose `path` is a virtual path that cannot be resolved from
the filesystem at validator time.

The `opened is False` path (line 265) is byte-identical to before — unchanged. The existing
assert_integrity and WR-07 workspace-resolution paths below are only reached when neither
`opened is False` nor `opened is True` fired, which is the case for any output that did not
go through the 104-03 executor enrichment (i.e., pre-104 defs, author-supplied `config.path`
validators). Those paths are unchanged.

**Verdict: correct and non-regressive for existing defs; WR-01 identifies a latent
defensive gap for future emitters.**

---

## Seed Script Security Assessment

| Control | Implementation | Verdict |
|---|---|---|
| Secret handling | `os.environ.get(...)` name-only; `load_dotenv` from `backend/.env`; no print of key values | PASS |
| Path traversal guard | `_SLUG_RE = re.compile(r"^[a-z0-9-]+$")` checked in `_assert_slug` before Storage path construction | PASS |
| SQL parameterization | All `cur.execute` calls use `%s` placeholders with tuple args; no f-string interpolation | PASS |
| RLS-owner pre-flight | `assert_demo_uid` looks up the live `auth.users` row and aborts if UID mismatches | PASS |
| `is_global=false` enforcement | Folder INSERT hardcodes `false`; def INSERT hardcodes `false`; integration test asserts both | PASS |
| DELETE-then-INSERT (no UPDATE) | `upsert_definition` DELETEs before re-INSERTs; `ON CONFLICT DO NOTHING` handles concurrency | PASS (see WR-02 for idempotency gap) |
| No secrets in manifest | `emit_ids` writes UUIDs and Storage paths only; no keys or DSN (see IN-02 for UID note) | PASS |
| Demo-folder corpus isolation | `is_global=false` folder + `user_id = DEMO_USER_ID` on all document rows | PASS |

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 240-mail-is-a-shape-not-a-fourth-adapter
reviewed: 2026-09-09T00:00:00Z
depth: standard
scope: 962dfdfce^..HEAD (develop)
files_reviewed: 9
files_reviewed_list:
  - backend/app/services/email_attachments.py
  - backend/app/services/transient_errors.py
  - backend/app/services/ingestion_queue_service.py
  - backend/tests/unit/test_240_attachments_both_paths.py
  - frontend/src/components/sources/WatchedFoldersSection.tsx
  - frontend/src/components/sources/RunHistoryList.tsx
  - frontend/src/components/sources/sourceHealthVocabulary.ts
  - frontend/src/components/sources/WatchedFoldersSection.test.tsx
  - frontend/src/components/sources/RunHistoryList.test.tsx
findings:
  critical: 2
  warning: 8
  info: 6
  total: 16
status: issues_found
---

# Phase 240: Code Review Report

**Reviewed:** 2026-09-09
**Depth:** standard (per-file, with the two named call chains traced across modules)
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Four backend changes and two frontend changes, all driven off a real Gmail watch. The
*shapes* are right — inheritance resolved in ONE place rather than in two callers, the
transient vocabulary hoisted rather than copied, the PDF branch spelled after
`splice_document`. The defects are in the seams, and two of them are load-bearing:

1. **The nesting guard this module introduced cannot fire.** `MAX_MAIL_NESTING_DEPTH` is
   checked against a `depth` that no caller ever increments, because the recursion runs
   through `api/documents.ingest_document`, which has no `depth` parameter and calls the
   loop back with the default `0`. The exposure TM-240-09 names — *"a watched mailbox where
   an attacker chooses the attachment"* — is open, and the test that claims to close it
   passes `depth=1` by hand.
2. **The retry added to rescue the measured stall is not idempotent**, in a codebase that
   already knows this (`watch_service.py` passes `"upsert": "true"` at both of its upload
   sites and this one does not). In the half of the measured scenario where the PUT landed
   and only the response read timed out, attempt 2 gets a duplicate refusal, which is
   correctly classified non-transient, and the attachment is lost anyway — with a *new*
   misleading reason.

Two smaller structural points recur below and are worth stating once: the shared
classifier decides on **message text only**, so a bare `TimeoutError()` (empty `str`) is
still terminal on both paths; and `_inherited_placement` degrades to `{}` on *any*
failure, which silently reinstates the exact bug this phase fixed and does so with no
retry, in a file that now owns a retry helper.

**On the specific question asked about change 3 (widening the queue classifier): it is
safe from runaway.** `record_job_failure` gates on `retry_count + 1 < max_retries`
(default 3) and increments on every branch, `reclaim_stale_ingestion_claims` increments
too, and `splice_document` resumes from `initial_progress`, so a widened tell costs at
most two extra checkpoint-resumed passes before the document is marked failed. The real
weakness in that change is not the widening — it is that the widening is still text-only
(WR-01) and that the fence written for it can be satisfied without the behaviour (WR-06).

---

## Critical Issues

### CR-01: The mail-nesting depth guard is unreachable — recursive attachment ingestion is unbounded from a watched mailbox

**File:** `backend/app/services/email_attachments.py:188` (`depth: int = 0`),
`:200-207` (the guard), `:348-357` (the recursive child ingest);
`backend/app/api/documents.py:2131-2142` (`ingest_document` has no `depth`),
`:2295-2301` (calls the loop back with the default `depth=0`)

**Issue:** The only recursive re-entry into `ingest_email_attachments` is:

```
ingest_email_attachments(depth=d)
  └─ ingest_document(document_id=att_doc_id, raw=att.raw, mime_type=att_mime, …)   # :348
       └─ ingest_email_attachments(raw=…, mime_type=…, …)                          # documents.py:2295
            ↑ depth omitted ⇒ 0, every level, forever
```

`ingest_document` takes no `depth` parameter, so `depth` is `0` at every level and
`if depth >= MAX_MAIL_NESTING_DEPTH` never becomes true outside a test that passes the
argument by hand. Traced against the real gates rather than assumed:

- `application/vnd.ms-outlook` and `application/x-msg` are in `MAIL_MIME_TYPES`
  (`email_attachments.py:48`) **and** in `ALLOWED_MIME_TYPES` (`documents.py:130-132`), and
  `EmailMessage.get_content()` returns real **bytes** for an `application/*` part — so a
  `.msg` attached to a `.eml` mints, ingests, and re-enters the loop.
- A `.eml` attached with `Content-Type: application/octet-stream` (what mail clients
  actually send when you attach a saved message) also arrives as bytes and is re-typed to
  `message/rfc822` by `_UNRELIABLE_MIME_TYPES` + `_EXT_MIME_OVERRIDES[".eml"]`
  (`documents.py:184-190`, `:155`) — the same re-entry.
- Breadth per level is capped at `MAX_ATTACHMENTS_PER_EMAIL = 50`
  (`email_extraction_service.py:34`). Depth is capped by nothing but Python's recursion
  limit and base64 growth.

**Concrete failure scenario:** anyone who knows the watched address (no authentication, no
account) emails a message carrying nested `.msg`/`.eml` attachments, `k` per level, `n`
levels deep. The watch mints and *fully ingests* up to `k**n` documents — each one a
`documents` row, a storage object, an extraction pass and a paid embedding round — inside
one ingestion job, until the 300 s lease expires; the job is then reclaimed as stale and
the whole cascade runs again, up to `max_retries`. A modest 5×5×5×5 tree is 780 documents
from one inbound email. This is the exposure the module's own docstring says it guarded
("New exposure, new guard, same commit") — the guard is inert.

**Fix:** thread the depth through the one caller that recurses.

```python
# api/documents.py
def ingest_document(
    document_id: str,
    text: str,
    user_id: str,
    supabase: Client,
    …,
    depth: int = 0,          # ← nesting level of THIS document
) -> None:
    …
    attachment_manifest = ingest_email_attachments(
        raw=raw, mime_type=mime_type, document_id=document_id,
        user_id=user_id, supabase=supabase,
        depth=depth,          # ← was omitted ⇒ always 0
    )

# services/email_attachments.py :348
ingest_document(
    document_id=att_doc_id, text=att_text, user_id=user_id, supabase=supabase,
    raw=att.raw, mime_type=att_mime, filename=att.filename,
    engine_override="legacy",
    depth=depth + 1,          # ← the child sits one level down
)
```

Belt-and-braces (cheap, and independent of the signature change): refuse to *mint* a child
whose resolved `att_mime` is in `MAIL_MIME_TYPES` when `depth + 1 >= MAX_MAIL_NESTING_DEPTH`,
recording it in the manifest as `skipped` with a stated reason, so the refusal is visible
rather than silent. See also WR-07: the existing test cannot detect any of this.

---

### CR-02: The retried upload is not idempotent — the retry turns the measured stall into a permanent failure with a wrong reason

**File:** `backend/app/services/email_attachments.py:321-328`
(compare `backend/app/services/watch_service.py:368` and `:429`)

**Issue:** `_with_transient_retry("upload", …)` re-issues

```python
supabase.storage.from_("documents").upload(
    path=mint_result.storage_path,
    file=att.raw,
    file_options={"content-type": att_mime},   # ← no "upsert"
)
```

Supabase Storage refuses a second PUT to an existing object key unless `x-upsert` is set;
the client surfaces that as a duplicate/"already exists" error. That string carries none of
`TRANSIENT_TELLS`, so `is_transient` correctly says *terminal*, `_with_transient_retry`
breaks out and raises `AttachmentStepError("upload", <duplicate error>)`.

**Concrete failure scenario:** this is the measured incident, not a hypothetical one. The
root cause recorded in the docstring is **GIL contention on our side** — a 20.010 s
`storage3` deadline that expired while our thread was starved. If the starvation happened
*after* the request was written (the common case for a client-side read timeout), the
object is already in the bucket. Attempt 2 then fails with `already exists`, the attachment
is recorded FAILED, the child `documents` row is flipped to `failed` — and the recorded
reason now says `upload: ... already exists`, which points a future reader at a collision
that never happened. Net effect: the attachment is still lost, plus an orphan storage
object, plus a misleading receipt.

The project already solved this one file over — `watch_service.py` passes
`"upsert": "true"` at both of its upload sites for exactly this reason. This is the same
"two paths disagree" shape the phase is written against.

**Fix:**

```python
_with_transient_retry(
    "upload",
    lambda: supabase.storage.from_("documents").upload(
        path=mint_result.storage_path,
        file=att.raw,
        # ⛔ RETRYING A NON-IDEMPOTENT PUT IS NOT A RETRY. A client-side deadline can expire
        #    after the object landed; without upsert, attempt 2 is refused as a duplicate and
        #    the attachment is lost anyway. `watch_service.py:368` already does this.
        file_options={"content-type": att_mime, "upsert": "true"},
    ),
)
```

A test that would have caught it: make `flaky_upload` raise `TimeoutError("timed out")` on
call 1 **and** `Exception("Duplicate: The resource already exists")` on call 2, then assert
`status == "completed"` — or, with the fix above, assert the `file_options` dict passed to
`upload` carries `upsert`.

---

## Warnings

### WR-01: `is_transient` reads only the message text, so a bare `TimeoutError()` is still terminal — on both paths

**File:** `backend/app/services/transient_errors.py:33-50`; consumers at
`email_attachments.py:88` and `ingestion_queue_service.py:276`

**Issue:** The module's headline claim is that the queue *"has never fired on the commonest
transient failure there is"*, and the repair is one more substring. But the classifier still
ignores the exception **type**, and several of the commonest transient failures stringify to
nothing useful: `str(asyncio.TimeoutError())` is `""`, `str(TimeoutError())` is `""`,
`str(socket.timeout())` is `""`, and several `httpx` timeout subclasses carry an empty
message. Empty text matches no tell, so those are classified terminal — the exact class the
change claims to have fixed.

Note the shape of the evidence: `test_a_transient_upload_stall_is_retried_rather_than_losing_the_attachment`
raises `TimeoutError("timed out")`. Delete the argument and the test goes red with no
production change — the fix is only as wide as the string the fixture happens to carry.

**Fix:** classify on type first, text second.

```python
_TRANSIENT_TYPES: tuple[type[BaseException], ...] = (TimeoutError, ConnectionError)
# (asyncio.TimeoutError is TimeoutError on 3.11+; add httpx.TimeoutException /
#  httpx.TransportError where httpx is already a dependency.)

def is_transient(exc: BaseException | str) -> bool:
    if isinstance(exc, _TRANSIENT_TYPES):
        return True
    return any(term in str(exc).lower() for term in TRANSIENT_TELLS)
```

`ingestion_queue_service` currently passes `err_str` (a `str`) — pass `exc` itself so the
queue gets the type check too; the signature already accepts both.

### WR-02: `_inherited_placement` swallows every failure into `{}` — a one-second DB stall silently reinstates the bug this phase just fixed

**File:** `backend/app/services/email_attachments.py:143-155`

**Issue:** Three different outcomes collapse into the same empty dict:

- the parent genuinely has no placement (`data is None`) — correct, and the only one the
  docstring reasons about;
- the read **failed** (network, RLS, PostgREST 5xx) — logged at `warning` and then treated
  as "no placement";
- the client returned a shape that is not a `dict` (a one-element list, which is what
  PostgREST returns without `maybe_single`) — `isinstance(row, dict)` is False and **nothing
  at all is logged**.

In the second and third cases every attachment on that message is minted with
`folder_id = NULL` and `source_connection_id = NULL` — precisely the M-2 defect, permanently
(nothing re-runs the placement), with either one easily-missed warning or complete silence.
The irony is measurable: the stall that motivated this phase was *our own scheduling*, and a
starved thread times out a PostgREST select just as readily as a storage PUT — yet this read
is the one call in the file that is **not** wrapped in the retry the file now owns.

**Fix:**

```python
try:
    resp = (… .maybe_single().execute())
except Exception as exc:
    log.error(  # not warning: this SILENTLY places every attachment outside the folder tree
        "Placement read FAILED for message %s (%s) — attachments will be minted with no "
        "folder and no connection", document_id, exc,
    )
    return {}
row = getattr(resp, "data", None)
if row is None:
    return {}                      # a hand-uploaded .eml: nothing to inherit, nothing invented
if not isinstance(row, dict):
    log.error("Unexpected placement shape for %s: %r", document_id, type(row))
    return {}
return row
```

and wrap the call in `_with_transient_retry("placement", …)` inside a `try/except
AttachmentStepError` so a stall costs a retry rather than the placement.

### WR-03: An explicit `ingest_visibility` can ride an *inherited* connection — the one path that widens a child beyond its parent

**File:** `backend/app/services/email_attachments.py:234-237`

**Issue:** The pairing rule is enforced in one direction only:

```python
if source_connection_id is None:
    source_connection_id = inherited.get("source_connection_id")
    if ingest_visibility is None:
        ingest_visibility = inherited.get("ingest_visibility")
```

A caller passing `ingest_visibility="org"` **without** a `source_connection_id` gets the
parent's connection paired with the caller's visibility. `mint_document_row:256-258` then
writes `source_connection_id = <parent's>` and `ingest_visibility = "org"` — the child is
org-visible on a connection whose parent row may be `private`. That is the only construction
in this change that can make a child MORE visible than the message it came from, and it
contradicts the comment sitting directly above it (*"THE PAIR TRAVELS TOGETHER OR NOT AT
ALL"*). No caller does this today; the function is module-public and its next caller will.

Everything else about the widening is correctly bounded and worth recording as verified:
values are copied verbatim from the parent row, `mint_document_row` writes
`ingest_visibility or "private"` (so a parent with a connection but a NULL visibility
narrows, never widens), and folder ownership is still re-validated against `user_id`.

**Fix:** make the pair atomic in both directions.

```python
if source_connection_id is None and ingest_visibility is None:
    source_connection_id = inherited.get("source_connection_id")
    ingest_visibility = inherited.get("ingest_visibility")
elif source_connection_id is None:
    # An explicit visibility with no explicit connection cannot be honoured: pairing it with
    # the PARENT's connection would claim a scope the caller never asked the parent for.
    ingest_visibility = None
```

### WR-04: `_extract_attachment_text` drops `splice_document`'s wall-clock bound — the branch is not "spelled the same way"

**File:** `backend/app/services/email_attachments.py:159-174`, against
`backend/app/services/ingest_splice.py:498-508`

**Issue:** The docstring says this is `splice_document`'s branch *"spelled the same way on
purpose"*, and *"a DIFFERENT rule here would be a seventh disagreement"*. It is not the same
rule. `splice_document` runs the composer as
`asyncio.wait_for(run_in_threadpool(extract_composable, raw, mime_type, engines_dict), timeout=wall_clock_s)`.
This call has no timeout at all, and passes no `engines` (so it silently resolves a
different engine set via `extraction_service.load_app_settings()`, which is itself a DB read
inside the attachment loop).

**Concrete failure scenario:** a PDF bomb attached to a message in a watched mailbox
extracts for as long as the engine wants. The blocking call holds one threadpool worker (the
loop is invoked via `run_in_threadpool` at `ingest_splice.py:749`), the ingestion job blows
its 300 s lease, `reclaim_stale_ingestion_claims` returns it to `pending`, and the same
unbounded extraction runs again — up to `max_retries`. The parent message never completes.
The same attacker controls this input as in CR-01.

**Fix:** bound it with the same wall clock the sibling path uses (read
`app_settings` once, above the attachment loop, and pass it down):

```python
def _extract_attachment_text(raw: bytes, mime_type: str, wall_clock_s: float) -> str:
    …
    if mime_type not in (PDF_MIME, DOCX_MIME):
        return extract_text(raw, mime_type)
    with ThreadPoolExecutor(max_workers=1) as ex:          # sync context — no event loop here
        fut = ex.submit(extract_composable, raw, mime_type)
        return (fut.result(timeout=wall_clock_s).text) or ""
```

(or hoist the shared "extract text for this mime, bounded" helper into one function that
both `splice_document` and this loop call — which is the fix the docstring says it wants).

### WR-05: The placement read is not owner-scoped, and the values it copies are never validated against `user_id`

**File:** `backend/app/services/email_attachments.py:143-150`

**Issue:** `select(_PLACEMENT_COLUMNS).eq("id", document_id)` scopes on the row id alone.
On the queue path `supabase` is the service-role client, so RLS does not backstop it. Of the
four columns copied onto the child, `mint_document_row` re-validates exactly one:
`folder_id` (ownership check at `ingest_splice.py:152-166`). `org_id`,
`source_connection_id` and `ingest_visibility` are written unvalidated
(`ingest_splice.py:245-258`).

Not currently exploitable — both call sites pass the id of the document they are ingesting
(`ingest_splice.py:753` from the claimed job, `documents.py:2298` from the parent being
ingested), and both are ownership-checked upstream. But it is one parameter away from being
a cross-tenant tagging primitive (a child tagged with another org's `org_id` +
`source_connection_id` + `ingest_visibility='org'`), and the fix is free — `user_id` is in
scope at the call site.

**Fix:**

```python
def _inherited_placement(supabase, document_id: str, user_id: str) -> dict[str, Any]:
    resp = (
        supabase.table("documents")
        .select(_PLACEMENT_COLUMNS)
        .eq("id", document_id)
        .eq("user_id", user_id)      # a child never inherits a row its owner does not own
        .maybe_single()
        .execute()
    )
```

(No injection concern: PostgREST parameterises `.eq()`, and `document_id` never reaches SQL
as text.)

### WR-06: `test_both_paths_agree_on_what_transient_MEANS` is satisfiable without the behaviour it names

**File:** `backend/tests/unit/test_240_attachments_both_paths.py:608-619`;
`backend/app/services/ingestion_queue_service.py:38`

**Issue:** The test asserts `queue_mod.TRANSIENT_TELLS is TRANSIENT_TELLS`. Production never
reads `queue_mod.TRANSIENT_TELLS` — it is imported solely to make this assertion possible
and carries `# noqa: F401` to keep the linter quiet. So the fence proves a **re-export**, not
a shared decision: re-inline the tuple inside `_handle_job_error` while leaving the import
line alone and the test stays green, which is precisely the drift it claims to prevent. It
also means the `# noqa: F401` now covers `_is_transient` as well, so removing the *real*
usage would not be flagged either.

Separately: **nothing in the suite exercises the widened classification on the queue at
all.** The behaviour change of item 3 — a job failing with `timed out` now goes
`retry_queued` instead of `failed` — has no test.

**Fix:** drop the unused re-export and assert the decision instead.

```python
def test_the_queue_classifies_a_read_timeout_as_transient():
    from app.services import ingestion_queue_service as queue_mod
    assert queue_mod._is_transient("Read timed out") is True     # the term that never matched
    assert queue_mod._is_transient("Bucket not found") is False

def test_the_queue_keeps_no_private_copy_of_the_terms():
    src = Path(queue_mod.__file__).read_text(encoding="utf-8")
    assert '"timeout"' not in src, "the queue re-inlined the transient tuple"
```

### WR-07: `test_a_message_attached_to_a_message_does_not_recurse` proves a parameter, not a behaviour

**File:** `backend/tests/unit/test_240_attachments_both_paths.py:223-271`

**Issue:** The test hand-passes `depth=1` on its second call — a value no production caller
ever produces (CR-01). It also patches `app.api.documents.ingest_document`, which is the
*only* thing that recurses, and then never asserts on the mock (`child_ingest` is bound and
unused). So the suite is green on a guard that cannot fire, which is exactly the class of
finding this project keeps recording: a fence that cannot see the thing it names.

**Fix:** drive the real chain instead of the parameter.

```python
def test_a_nested_message_does_not_open_its_own_attachments():
    """The guard must hold through the REAL recursion: loop → ingest_document → loop."""
    seen_depths: list[int] = []
    real_loop = mod.ingest_email_attachments

    def spy_ingest_document(**kw):
        # what documents.py:2295 actually does today
        real_loop(raw=kw["raw"], mime_type=kw["mime_type"], document_id=kw["document_id"],
                  user_id=kw["user_id"], supabase=kw["supabase"])

    with patch("app.api.documents.ingest_document", side_effect=spy_ingest_document):
        real_loop(raw=outer_with_nested_msg, mime_type="message/rfc822", …, depth=0)

    assert grandchild_mints == 0, "the nesting cap never fired — depth is not threaded"
```

Add a companion negative control for the `.eml`-as-`application/octet-stream` vector, which
is how a mail client actually attaches a saved message.

### WR-08: A proximity fence was weakened 800 → 2600 in the same commit whose prose says nothing was weakened

**File:** `frontend/src/components/sources/WatchedFoldersSection.test.tsx:722-727`, against
the docstring added at `:444-452`

**Issue:** The new docstring states the rule and the standard: *"Every assertion below is
UNCHANGED; the only thing added is the click … If any of them had had to be WEAKENED, that
would have been the failure."* The same diff changes

```diff
- /sources-file-failures[\s\S]{0,800}?FILE_FAILURE_SCOPE_NOTE/
+ /sources-file-failures[\s\S]{0,2600}?FILE_FAILURE_SCOPE_NOTE/
```

That is a 3.25× relaxation of the only structural guarantee that the scope note lives inside
the failures block, and most of the new window is *comment prose*, which the fence does not
strip. At 2600 characters the pattern would still pass if a later edit moved the scope note
out of the block entirely and into a sibling.

**Fix:** keep the window tight by moving the ~900-character explanatory comment above the
`{failingItems.length > 0 && (` line (or into the vocabulary module, where the operator
quote already lives), and restore a bound near the original. If the window must grow, strip
comments before matching, the way `RunHistoryList.test.tsx:263` already does:

```ts
const code = watchedFoldersSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
expect(code).toMatch(/sources-file-failures[\s\S]{0,900}?FILE_FAILURE_SCOPE_NOTE/)
```

---

## Info

### IN-01: Dead import left behind by the extraction-routing change

**File:** `backend/app/services/email_attachments.py:217-223`

`extract_text` is still imported inside `ingest_email_attachments`, but after change 4 the
only call site is `_extract_attachment_text:173`, which imports it itself. Ruff's F401
covers function-scope imports. Drop it from the inner import list.

### IN-02: `_with_transient_retry` can raise without ever calling `fn`, and sleeps on a shared worker

**File:** `backend/app/services/email_attachments.py:82-95`

If `_UPLOAD_ATTEMPTS` were ever set to `0` (or negative), the loop body never executes and
the function raises `AttachmentStepError(step, None) from None` for an operation that was
never attempted. Guard with `for attempt in range(1, max(1, _UPLOAD_ATTEMPTS) + 1)` or
assert the constant at import.

Also: `time.sleep(_RETRY_SLEEP)` runs inside a `run_in_threadpool` worker on the queue path,
so a message with ten failing attachments parks a worker for ~20 s. Acceptable at the
current constants; worth a comment so it is not scaled up carelessly. The module-level
`_RETRY_SLEEP` patched by tests is fine for production (it is read fresh each call, never
cached), though a keyword argument with a module default would be patch-free.

### IN-03: The queue's widened classifier delays a terminal verdict by up to two extra passes

**File:** `backend/app/services/ingestion_queue_service.py:276-287`

Answering the question directly, and recording it so nobody re-derives it: this cannot loop
forever. `record_job_failure` gates on `retry_count + 1 < max_retries` (default `3` at
`db/ingestion_jobs.py:37`) and increments `retry_count` on both branches;
`reclaim_stale_ingestion_claims` increments as well; backoff is `min(60.0, 2**n + 1.0)`; and
`splice_document` resumes from `initial_progress`, so a retried job does not repeat completed
stages. The cost of the widening is that a *deterministic* failure whose message contains
`timed out` (or, already, `connection`) now takes up to three passes and up to ~65 s of
backoff before the document is marked `failed` and the user is told. That is the intended
trade; it is worth one line in the docstring so the next reader does not mistake the delay
for a hang.

### IN-04: The partial-run marker is an aria-hidden glyph inside an empty span

**File:** `frontend/src/components/sources/RunHistoryList.tsx:239-246`

`sources-run-partial` renders `<AlertTriangle aria-hidden="true" />` and no text, inside a
span with no accessible name and no `title`. Assistive tech gets nothing from the element;
sighted users get an unlabelled triangle. It is not a *loss* of information — `partial`
implies `count_errors > 0`, which implies the `errors` count bit renders (`quiet` is false
whenever any count is non-zero, `runHistoryFold.ts:77-81`), and that bit is already in the
warning register — but the file's own contract at `:20-22` says a state *"reads as glyph +
label + colour, never colour alone"*, and its sibling `sources-listing-incomplete` at
`:229-237` renders glyph **+ label**. Either add an `sr-only`/`title` label
(`"some files could not be read"`) or drop the glyph and let the warning-coloured count
carry it.

### IN-05: The disclosed block is not re-indented, hiding the new fragment boundary

**File:** `frontend/src/components/sources/WatchedFoldersSection.tsx:1015-1051`

`{failuresOpen && (<>` wraps lines 1017-1049, which stayed at their old indentation. The
result reads as though the heading, scope note and list are siblings of the button rather
than children of the conditional fragment. Cosmetic, but this is exactly the region a future
edit will get wrong.

### IN-06: `sources-file-failures` is no longer a meaningful gate in the untouched tests

**File:** `frontend/src/components/sources/WatchedFoldersSection.test.tsx:594, 548`

The outer `sources-file-failures` container now renders whenever `failingItems.length > 0`,
disclosed or not, so `waitFor(getByTestId("sources-file-failures"))` no longer proves
anything about the content. The tests that matter still assert on `sources-file-failure`
(singular) after the click, so nothing is currently vacuous — but the leak fence at
`:577-604` now depends on a UI interaction succeeding before its `not.toContain("ya29")`
assertions mean anything. Worth an explicit `expect(screen.getAllByTestId("sources-file-failure").length).toBeGreaterThan(0)`
*before* the negative assertions in that test, so a broken disclosure reds the fence rather
than silently satisfying it.

---

## Verified — checked and found sound (recorded so it is not re-litigated)

- **No infinite/runaway retry** from change 3 (see IN-03 for the derivation).
- **Visibility cannot exceed the parent** through the inheritance path itself — values are
  copied verbatim, and a parent with a connection but NULL visibility narrows to `"private"`
  via `mint_document_row:258`. The one widening construction is WR-03.
- **The lambda capture at `:321-328` is correct** — `_with_transient_retry` invokes `fn`
  synchronously inside the same loop iteration, so late binding of `att` / `mint_result`
  cannot misfire.
- **`_with_transient_retry` re-raises rather than swallowing**, and `AttachmentStepError`
  chains with `from last`, preserving the original traceback.
- **`ingest_email_attachments` still never raises** — `_inherited_placement` catches
  internally even though it sits outside the function's own `try`.
- **The relationship insert stays above the `is_duplicate` early return**, and the
  cross-folder collision worry does not materialise: `documents_dedup_idx` is folder-scoped
  (`migrations/051`), and the step-3 dedup at `ingest_splice.py:192-208` is *not*
  folder-scoped, so a completed duplicate is linked rather than re-minted.
- **`isQuiet` includes `count_errors`** (`runHistoryFold.ts:64-81`), so a success-with-errors
  run is never folded away and the new marker is reachable.
- **`text-warning` resolves** in both themes (`tailwind.config.js:92`, `index.css:47`), and
  all four new lucide icons are already imported in their files.
- **Non-vacuous new tests:** the folder-inheritance test, the connection/visibility pair
  test, both retry tests, the terminal-error test and the PDF-extractor test all go red if
  their fix is reverted. The vacuous ones are named in WR-06 and WR-07.

---

_Reviewed: 2026-09-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

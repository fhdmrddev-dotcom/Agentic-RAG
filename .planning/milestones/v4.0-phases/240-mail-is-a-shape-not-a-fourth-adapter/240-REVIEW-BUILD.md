---
phase: 240-mail-is-a-shape-not-a-fourth-adapter
reviewed: 2026-09-10T00:00:00Z
depth: standard
scope: the ORIGINAL BUILD (`50f66ec39..962dfdfce^`) — the four plans plus the two in-phase fix commits
review_type: independent (OV-240-01 — AGENTS.md §6.3; the author of this range did not write this review)
files_reviewed: 21
files_reviewed_list:
  - backend/app/services/sources/mail/gmail.py
  - backend/app/services/sources/mail/mailbox.py
  - backend/app/services/sources/mail/__init__.py
  - backend/app/services/sources/adapters/google_drive.py
  - backend/app/services/email_extraction_service.py
  - backend/app/services/ingest_enrich.py
  - backend/app/services/ingest_splice.py
  - backend/app/api/documents.py
  - backend/app/models/document.py
  - backend/app/services/document_view_resolver.py
  - backend/app/services/view_filter_compiler.py
  - supabase/migrations/175_documents_thread_key.sql
  - backend/tests/unit/services/sources/test_boundary_fence.py
  - backend/tests/unit/services/sources/test_240_mail_shape.py
  - backend/tests/unit/test_240_conversation_endpoint.py
  - backend/tests/unit/test_240_thread_key_is_read.py
  - backend/tests/unit/test_240_quoted_paragraph_appears_once.py
  - frontend/src/components/metadata/DocumentConversationSection.tsx
  - frontend/src/components/metadata/DocumentDetailPanel.tsx
  - frontend/src/components/sources/watchProductMark.ts
  - frontend/src/components/sources/sourceCapability.ts
findings:
  critical: 1
  warning: 9
  info: 6
  total: 16
status: issues_found
---

# Phase 240 (original build): Independent Code Review

**Reviewed:** 2026-09-10
**Depth:** standard
**Range:** `50f66ec39..962dfdfce^` (`563ad15f5` · `d16c99df3` · `5f8a54702` · `3e13eec74` · `f88c2277d` · `c07c5dc93` · `173700576` · `5fdb897c5` · `da95d3658`)
**Status:** issues_found

## Summary

The phase's headline claim survives adversarial checking. `backend/app/services/sources/base.py`
is **byte-identical across the range** (`git diff --stat 50f66ec39 962dfdfce^ -- base.py` is
empty), no registry key was added for mail, and `test_240_contract_unchanged.py` /
`test_240_quoted_paragraph_appears_once.py` are the two best tests in the phase — both carry
real positive controls and both would fail if their subject were reverted. The
`thread_key` cross-user isolation claim also holds: `documents` RLS is
`auth.uid() = user_id OR org-shared folder OR connection_doc_is_visible`
(`supabase/full-schema.sql:6175`), the route is served by `get_user_supabase_client`, and the
`.eq("user_id", owner_id)` filter narrows further. A planted `Message-ID` cannot reach another
person's mail.

What did not survive is more interesting than what did.

**One Critical.** `strip_quoted_replies` — the function SC#1 rests on, and which the phase
verified for *correctness* — carries a quadratic-backtracking regex that Phase 240 has just
made **remotely triggerable by anyone who can send mail to a watched mailbox**, and it runs on
the **event loop**, not in a threadpool. Measured on this box: 8k chars → 0.68 s, 16k → 4.2 s,
32k → **36.8 s**. This is inherited code (Phase 203), and that is precisely the point — the
phase changed its threat model without re-examining it.

**The two claims worth challenging came out split.** The `mailbox.py` / `gmail.py` seam is
*real* — no Gmail import, no Gmail literal, and the anchor/prefix/filename logic genuinely
transfers. But the fence that is supposed to prove it is weaker than advertised: it checks
**string literals only**, and its completeness half (`test_the_fenced_module_list_covers_the_sources_package`)
uses a **non-recursive glob**, so every future module under `sources/mail/` is silently exempt
(WR-07). And the batch parser (claim 5) correlates sub-responses **by position** while emitting
a `Content-ID` it never reads (WR-01).

The `SourceListing.complete` contract is **honoured on every path I could construct** — a
non-multipart envelope, a short parse, a non-200 member and an exhausted 429 retry all raise,
and `watch_service` turns that into `complete=False`. The listing cannot report a completeness
it did not achieve. What it *can* do is report `complete=False` **forever** once the anchored
set passes ~5,000 messages, silently disabling H-5 deletion detection for the life of the watch
(WR-02).

The new `/documents/{id}/conversation` route is the phase's only new HTTP surface and **every
one of its seven tests is a source-text grep** (WR-05). Its security design is sound; its
behaviour is unverified.

---

## Critical Issues

### CR-01: A single email can stall a backend worker for minutes — quadratic regex on the event loop, now reachable from any sender

**File:** `backend/app/services/email_extraction_service.py:213` (and `:214`, `:215`), reached via
`backend/app/services/ingest_splice.py:528` and `backend/app/services/sources/mail/gmail.py:524`

**Issue:**

`strip_quoted_replies` matches each body line against

```python
re.compile(r"^\s*On\s+.+?wrote:\s*$", re.IGNORECASE)     # line 213
re.compile(r"^\s*From:\s*.+?\n\s*Sent:\s*.+?", re.IGNORECASE)  # line 214
re.compile(r"^\s*From:\s*.+?\n\s*To:\s*.+?", re.IGNORECASE)    # line 215
```

`\s+` (variable-width) followed by lazy `.+?` and a literal that is not present gives the engine
O(n) restart positions each costing O(n). Measured here, verbatim:

```
line length 8000  -> 0.681 s
line length 16000 -> 4.181 s
line length 32000 -> 36.778 s
```

Extrapolating: a **64 KB line ≈ 5 minutes**; a 1 MB line ≈ hours. The Gmail read ceiling is
`source_max_file_bytes()` — **25 MB by default** (`models/user_settings.py:1232`), so a payload
of this shape is three orders of magnitude inside the limit.

Two things make this Critical rather than a nit:

1. **It is now attacker-reachable without any credential.** Before this phase, `.eml` bytes
   reached the parser only when a human uploaded one. After Phase 240 a watched Gmail label
   ingests whatever arrives, so *anyone who knows the mailbox address* supplies the input.
   TM-240-02 already recognised that a Subject is "text a stranger chose"; the body is the same
   fact at 25 MB of scale, and the threat model does not mention it.
2. **It executes on the event loop.** `ingest_splice.py:528` is
   `text = extract_text(raw, mime_type)` — a bare synchronous call inside `async def
   splice_document`, taken for every non-PDF/non-DOCX MIME, which includes `message/rfc822`.
   That is a D-v2.5-01 violation on the exact path this phase opened. So the stall is not
   confined to one ingest job: it blocks **every SSE stream, every request and every other
   watch** on that uvicorn worker (`WORKER_COUNT=2`, so two such messages block the whole
   backend). `gmail.read_message` (line 524) calls `parse_eml_bytes` a second time, on the
   event loop again, just to recover a Subject.

**Downstream:** the 300 s ingestion lease expires while the loop is blocked,
`reclaim_stale_ingestion_claims` returns the job to `pending`, and the same message is parsed
again — up to `max_retries`. This is the identical harm shape the phase itself filed as CR-01
for PDF bombs in `email_attachments.py:205-216`, one file over, unmitigated.

**Fix** (three independent parts; 1 and 2 are each sufficient to stop the outage, 3 is the
correctness fix):

```python
# 1. Bound the input before any regex touches it. A reply banner is never 4 KB.
_MAX_SCANNED_LINE = 4096

for idx, line in enumerate(lines):
    probe = line.strip()[:_MAX_SCANNED_LINE]
    if any(pat.match(probe) for pat in REPLY_HEADER_PATTERNS[:3]):
        break

# 2. Remove the ambiguity that causes the backtracking. `\s+` -> a single bounded run,
#    and `.+?` -> a negated class that cannot re-scan.
re.compile(r"^[ \t]{0,8}On[ \t]{1,8}[^\n]{1,512}?wrote:[ \t]*$", re.IGNORECASE)

# 3. ingest_splice.py:528 — this is blocking CPU work in an async function.
text = await run_in_threadpool(extract_text, raw, mime_type)
```

Add a regression test that asserts a 256 KB single-line body is stripped in under a second —
the phase's existing quoted-reply suite has an excellent positive control for *content* and
none at all for *cost*.

---

## Warnings

### WR-01: Gmail batch sub-responses are matched by POSITION, while the code emits a `Content-ID` it never reads

**File:** `backend/app/services/sources/mail/gmail.py:197-211` (writes `Content-ID: <item-N>`),
`:214-244` (parses, discarding it), `:310` (`zip(chunk, subs)`)

**Issue:** `_build_batch_body` writes a correlation header for every sub-request and
`_parse_batch_response` throws it away, returning a bare positional list. `zip(chunk, subs)` then
assumes Google returns sub-responses in request order. Google's batch documentation does not
guarantee that ordering — it directs clients to correlate on `Content-ID` — and the code
literally emits the correlation handle and drops it. Writing a key and not reading it is the
tell.

**Concrete failure:** a permutation is mostly self-correcting (the file's id, subject, date and
size all come from the *same* `meta` dict, `:418-421`), **except at the 429 arm**. If `subs[i]`
is a 429 for message X but `chunk[i]` is message Y, then Y is queued for the slow re-read and
**X's successful 200 is discarded** (`:311-316`). X is then absent from `metas`, and `:418-421`
falls back to `message_id=mid, subject=None, internal_date=None` — so the Library row is named
**`(no subject).eml`** and stored with `source_version = ""`.

It never self-heals: `watch_service.py:408` is
`if item_mod and existing_ver and item_mod != existing_ver`, and an empty `existing_ver` makes
that condition permanently false. The message keeps a wrong name forever, and messages are
immutable so nothing else will ever re-read it.

**Fix:** parse and honour the header the request already carries.

```python
for part in outer.iter_parts():
    cid = (part.get("Content-ID") or "").strip("<>")          # "response-item-3" or "item-3"
    idx = int(cid.rsplit("-", 1)[-1]) if cid.rsplit("-", 1)[-1].isdigit() else None
    results.append((idx, status, parsed))
# ...then build `out` from idx -> ids[idx], and raise if any index is missing or duplicated.
```

Keep the existing `len(subs) != len(chunk)` raise as the fail-closed backstop.

### WR-02: The anchor bounds where a watch STARTS and nothing bounds how far it GROWS — H-5 silently switches off at ~5,000 messages

**File:** `backend/app/services/sources/mail/mailbox.py:61-65` ("the set only ever GROWS"),
`backend/app/services/watch_service.py:251, 263-266`

**Issue:** `mailbox.py` argues correctly that an anchor is safer than a rolling window because
nothing can age out. The consequence it does not follow through on is that the anchored set is
**monotonically increasing and unbounded**, while the listing loop is capped at
`max_pages = 200` and `MAIL_PAGE_SIZE = 25` — a hard ceiling of **5,000 messages**.

At 30 messages/day an INBOX watch crosses that in about six months. From that moment:

* every pass reads 200 pages × 2 requests = **400 requests** and still never finishes;
* `listing.complete` is `False` on **every** run, permanently;
* the H-5 block (`watch_service.py:523`) therefore suppresses missing-state transitions
  **forever** — the deletion guard is silently disabled for the life of the watch, and the only
  evidence is a `logger.warning` nobody reads;
* new mail is still ingested (Gmail lists newest first, so page 1 carries it), which is exactly
  why this degrades invisibly rather than visibly.

This is a slow-motion re-run of the treadmill the anchor was built to escape, and nothing in the
phase measures or alerts on it.

**Fix:** make the ceiling observable and the growth bounded. Either

* record the page-cap hit as a first-class watch state (`counts["listing_truncated"] = True`)
  and surface it on the watch row rather than only in a log line; and/or
* advance the anchor to the `internalDate` of the newest **successfully ingested** message after
  a run that reached the cap, and pair it with `listing.complete = False` for that pass so no
  deletion signal is ever derived from a moved window. That keeps the "nothing ages out of a
  complete listing" invariant while bounding the work.

Write the ceiling into `mailbox.py`'s anchor docstring — it currently argues for unbounded
growth without naming its cost.

### WR-03: Archiving an email in Gmail marks its document `missing_at_source`

**File:** `backend/app/services/sources/mail/gmail.py:371-379`, consumed at
`backend/app/services/watch_service.py:529-539`

**Issue:** the watch's unit of identity is *the message inside a label*. Removing the `INBOX`
label — which is exactly what Gmail's **Archive** button does, the single most common action in
a mailbox — makes the message vanish from a listing that is otherwise complete, and
`watch_service` writes `documents.source_state = "missing_at_source"` on it. Same for a message
moved to Trash or reclassified as Spam, which `q=after:` additionally excludes by default.

For Drive, "the file left the folder" genuinely is "it left the folder". For mail it is
day-to-day triage, and the user is told their Library document is missing at source. No test,
UAT row or seed covers it, and the mail modules never mention it.

**Fix:** decide and document the semantic. Either (a) treat mail as **append-only** — messages
are immutable, so a mail-shaped listing should never contribute deletion candidates at all
(cheapest, and consistent with `message_to_file`'s own "a message is immutable" argument), or
(b) keep deletion detection and say so in the watch UI copy. Implementation for (a) is a flag on
the listing rather than a branch in `watch_service`; do not add a provider branch above
`adapters/`.

### WR-04: A watched user label writes `/Label_9` as the document's folder breadcrumb, and classification rules read it

**File:** `backend/app/services/sources/adapters/google_drive.py:239` (`label_name=label_id`),
`backend/app/services/sources/mail/mailbox.py:184-185, 193`,
consumed at `backend/app/services/ingest_enrich.py:568-570`

**Issue:** `mailbox.message_to_file` documents `path` as *"a REAL breadcrumb, not the fabricated
`/<filename>` SEED-253 recorded … a message's folder is exactly its label."* The adapter then
passes the **label id** as the label name, because `list_files` only has the id after
`strip_folder_prefix`. Gmail system labels have id == name (`INBOX`, `SENT`), so the operator's
UAT on INBOX could never have revealed this. **User-created labels have ids of the form
`Label_9`.**

Consequence: a message from a label the user named "Receipts" is stored with
`metadata.source.path = "/Label_9"`, and `ingest_enrich.py:568` promotes that into
`eval_facts["path"]` — the fact classification rules match on. A rule
`path contains "Receipts"` cannot fire, and there is no signal that it did not.

**Fix:** carry the display name through the address, or resolve it. The cheapest correct move is
to include the name in the anchored id the browse step already mints (it has both), e.g.
`mailbox:<id>:name:<urlsafe>:after:<epoch>`, parsed by a `folder_label_name()` beside
`folder_anchor()`; the alternative is one `users.labels.get` per listing pass, cached. Either
way, `label_name=label_id` at `google_drive.py:239` is a stand-in that reads as a fact.

### WR-05: Every test of the phase's only new HTTP route is a source-text grep — the route's behaviour is unverified

**File:** `backend/tests/unit/test_240_conversation_endpoint.py` (all 7 tests), against
`backend/app/api/documents.py:997-1056`

**Issue:** not one test calls `get_document_conversation`. All seven read `documents.py` as text
and assert substrings. Specifically:

* `test_the_cap_is_declared_and_the_truncation_is_reported` (:88) asserts the **word**
  `"truncated"` appears within 2,500 characters of the route. Change
  `truncated=total > len(messages)` to `truncated=False` and it stays green — the exact
  "silent slice" the test's own docstring says it exists to prevent.
* `test_a_document_with_no_thread_key_is_a_normal_empty_answer` (:116) asserts the string
  `"404"` is absent. It says nothing about the 200 or the empty list.
* `test_the_response_model_carries_what_the_panel_needs` (:107) checks Pydantic field names.
  `is_open` could be hard-wired to `False` and every row would still pass.
* `test_the_sibling_query_is_user_scoped` (:70) is the best of them — it was driven red and now
  matches `.eq("user_id", owner_id)` literally. But it is still a grep: swap
  `get_user_supabase_client` for a service-role client and the fence stays green while
  cross-user isolation (which, as noted in the Summary, is actually carried by **RLS**, not by
  that filter) disappears.

Nothing asserts `created_at` ordering, `is_open` marking the right row, `total` vs `len(messages)`,
or that an unauthorised caller gets a 404.

**Fix:** add one behavioural test with a stubbed Supabase client — the phase already has that
fixture shape in `test_240_mail_shape.py`. Assert: (a) a 3-sibling thread returns 3 rows oldest
first with `is_open` true on exactly one; (b) 250 siblings returns 200 rows, `total == 250`,
`truncated is True`; (c) a document with no `thread_key` returns `200` with `messages == []`;
(d) `_assert_document_visible` raising 404 propagates. Keep the greps — they are cheap — but
they are not the coverage the phase's SC#3 claims.

### WR-06: The attachment step rewrites the whole `metadata` blob from a stale in-memory snapshot

**File:** `backend/app/services/ingest_splice.py:786-791`

**Issue:**

```python
merged = dict(enriched.metadata or {})
merged["attachments"] = manifest
await _db(lambda: supabase.table("documents").update({"metadata": merged})...)
```

`enriched.metadata` was captured before step 4a and written at `:669`. Between that write and
this one, step **4c** runs `extract_and_store_images`, which does a read-modify-write of the same
column to add `metadata._images` (`multimodal_service.py:751-763`). This update overwrites it
with a snapshot that predates it — classic last-write-wins on a JSONB blob.

It does not bite **today** only because `extract_and_store_images` no-ops for `message/rfc822`
(it branches on PDF/DOCX/`extracted_doc.images`, `multimodal_service.py:796-812`) and this block
is gated on mail MIME. That is a coincidence of two unrelated conditions, not a design.

Also note the narrower case: if enrichment degrades to `enriched.metadata is None` but a manifest
exists, this writes `{"attachments": [...]}` over the row's existing metadata, dropping
`metadata.source` provenance that `ingest_enrich.py:456-460` works to preserve.

**Fix:** read-modify-write, the same shape `multimodal_service` uses, or patch only the key:

```python
current = (await _db(lambda: supabase.table("documents")
    .select("metadata").eq("id", document_id).maybe_single().execute())).data or {}
merged = dict(current.get("metadata") or {})
merged["attachments"] = manifest
```

### WR-07: The boundary fence's completeness check does not recurse, so `sources/mail/` is exempt from the half that cannot be forgotten

**File:** `backend/tests/unit/services/sources/test_boundary_fence.py:366-379`

**Issue:** `test_the_fenced_module_list_covers_the_sources_package` exists precisely so a module
added to the source path and forgotten cannot be silently unfenced — its own docstring calls it
"the same class of gap as a hot file with no ledger row". It globs `package.glob("*.py")`, which
is **non-recursive**. `sources/mail/mailbox.py` is in `FENCED_MODULES` only because a human typed
it there; `sources/mail/gmail.py` is correctly exempt; and **every future module under
`sources/mail/`** — including the `SEED-260` Microsoft Graph mail module, which will be the next
provider-independent half — is invisible to this check.

Second, weaker point: `_scan` only sees **string literals in decisions**. `mailbox.py` passes
because it contains no Google literal, which is true and worth having, but it is a vocabulary
check, not a coupling check. A Gmail-shaped *structural* assumption (a flat label model, an
`internal_date` parameter name, a `:after:<epoch>` address that mirrors Gmail's `q=after:`
operator) is entirely invisible to it. The phase's claim that the fence makes provider-independence
"mechanical" is stronger than what the fence does.

**Fix:**

```python
on_disk = {
    "app/services/sources/" + str(p.relative_to(package)).replace("\\", "/")
    for p in package.rglob("*.py")
    if p.name != "__init__.py" and "adapters/" not in str(p.relative_to(package)).replace("\\", "/")
    and p.name not in ("failure_cause.py", "health_verdict.py")
}
```

and name `sources/mail/gmail.py` in an explicit `PROVIDER_HALF_MODULES` exemption tuple, so the
exemption is a stated decision rather than a glob's blind spot.

### WR-08: A caller-supplied id is interpolated straight into the Gmail request URL

**File:** `backend/app/services/sources/mail/gmail.py:495`
(`f"{GMAIL_API_BASE}/messages/{message_id}"`), reachable from
`backend/app/api/connectors.py:1778-1810` → `import_service.py:202, 292` →
`google_drive.py:312-313`

**Issue:** `POST /connectors/connections/{connection_id}/files/{file_id}/import` takes `file_id`
as a path parameter and passes it, unvalidated, to `adapter.read_file`. With
`mail.is_mail_file(file_id)` true, `strip_file_prefix` hands the remainder to `read_message`,
where it is f-string-interpolated into the URL path. The same value also reaches
`_build_batch_body` for ids on the listing path (`:208`), where a CRLF would open sub-request
smuggling into the multipart body.

I could not construct an exploit: uvicorn percent-decodes `scope["path"]` before routing, so a
`%2F` prevents the route matching at all, and the egress pin confines the host. So this is
**defence in depth, not a live hole** — but it is the only unvalidated interpolation into a
protocol string in the new code, and it is one ASGI-server behaviour away from being an
endpoint-shifting primitive. Note also that `gmail_read`'s pin is
`("googleapis.com",)` with suffix matching (`security/egress.py:266, 336`), so it does **not**
constrain the path or distinguish Gmail from Drive — the module docstring says so honestly, which
means the URL string is the only boundary left.

**Fix:** validate at the namespace boundary, where the shape is known.

```python
_GMAIL_ID = re.compile(r"\A[A-Za-z0-9_-]{1,128}\Z")

def strip_file_prefix(file_id: str) -> str:
    raw = file_id[len(FILE_PREFIX):] if file_id.startswith(FILE_PREFIX) else file_id
    if not _MESSAGE_ID_RE.match(raw):
        raise ValueError("Not a message id")
    return raw
```

(Keep the pattern provider-neutral in `mailbox.py` — a conservative `[A-Za-z0-9_.:-]` class is
enough and does not encode a Gmail assumption.)

### WR-09: `watchProductMarkKey` hardcodes one vendor, so a shipped Microsoft Graph watch draws no mark at all

**File:** `frontend/src/components/sources/watchProductMark.ts:29-37`

**Issue:** the module's own docblock states the rule — *"a vendor shows its OWN mark"* — and then
implements it for `google` and nothing else. `MicrosoftGraphSourceAdapter` is a registered,
shipped family (`test_boundary_fence.py:338, 342-348`) and `connectionMark.tsx:246` already has a
`microsoft` mark. A OneDrive/SharePoint watched folder therefore renders **no glyph**, beside a
Google row that renders one — an inconsistency a person reads as a broken row, not as a decision.

`watchProductMark.test.ts:33` pins `("folder-123", "dropbox") → null`, so this is deliberate; that
makes it a design gap rather than a slip, but it still contradicts the milestone's *"adding a
source family is rows, not code"* constraint: the next family requires editing this file.

Secondary: `service.startsWith("google")` is a **prefix match on an identity string**, the same
category of move this file's own docblock condemns two paragraphs earlier (`import_service`
matching `"google"` inside a display name). It is much safer here — `service_id`, not display
name — but it will also match any future `google*` id.

**Fix:** make it a table, mirroring `SERVICE_MARKS`, so a family is a row:

```ts
const MAIL_MARKS: Record<string, string> = { google: "google-gmail", microsoft: "google-outlook" }
const FILE_MARKS: Record<string, string> = { google: "google-drive", microsoft: "microsoft" }
```

and key on the exact `service_id` (with `google_workspace` as an explicit alias row) rather than
on a prefix. If no Outlook mark exists in the installed pack, fall back to the vendor mark
(`microsoft`) — which is `connectionMark.tsx:265-270`'s already-recorded rule for Sheets/Docs —
rather than to nothing.

---

## Info

### IN-01: `folder_anchor` accepts a string `int()` will refuse

**File:** `backend/app/services/sources/mail/mailbox.py:115`

`return int(raw) if raw.isdigit() else None` — `str.isdigit()` is true for characters `int()`
rejects. `"²".isdigit()` is `True` and `int("²")` raises `ValueError`. A folder id of
`mailbox:INBOX:after:²` (user-supplied at watch creation / preview) produces an uncaught
`ValueError` out of `list_files`. Harm is bounded — the watch loop catches it and marks the run
failed — but the failure names nothing useful.

**Fix:** `if raw.isascii() and raw.isdigit()`, and reject values outside a sane epoch range
(`0 < value < 4102444800`) so a far-future anchor cannot produce a permanently empty listing.

### IN-02: the per-message fallback is unreachable for the case its comment names, and is untested

**File:** `backend/app/services/sources/mail/gmail.py:408-434`

The comment says the fallback exists *"if Google ever answers the batch endpoint with something
this parser cannot read"*. Every such case raises `ValueError` — a non-multipart envelope and a
short parse both land on `len(subs) != len(chunk)` (`:301-304`) — and `except ValueError: raise`
(`:428-429`) re-raises it. So the fallback is reachable only for unexpected exception types, i.e.
transport errors, where re-issuing 25 requests through the egress that just failed is a
questionable remedy. No test exercises it; `_listing_handler`'s per-message arm is kept alive by
comment only.

**Fix:** either delete the fallback and say the batch path is the path (fail-closed is already
the right answer), or make the envelope-shape failures raise a distinct exception the fallback
catches, and pin it with a test.

### IN-03: `truncated` is a false negative when PostgREST returns no count

**File:** `backend/app/api/documents.py:1041-1042, 1055`

`total = res.count if getattr(res, "count", None) is not None else len(rows)` — when `count` is
absent, `total == len(rows)` and `truncated` is `False` even when exactly `CONVERSATION_SIBLING_CAP`
rows came back, which is the one case that most likely *is* truncated.

**Fix:** `truncated = total > len(messages) or len(rows) >= CONVERSATION_SIBLING_CAP`.

### IN-04: the conversation fetch has no cancellation

**File:** `frontend/src/components/metadata/DocumentConversationSection.tsx:60-76`

`load` has no abort or generation guard. Clicking two sibling rows quickly can let an older
response resolve last and render document A's conversation while document B is open. The
`onTotalChange={setConvoTotal}` wiring is correct (a stable setter, so no effect loop), and
`DocumentDetailPanel.tsx:208` resets the total on `docId` change — but the in-flight response
is not cancelled.

**Fix:** the `let alive = true` / cleanup pattern already used at `DocumentDetailPanel.tsx:184`.

### IN-05: a re-ingest never clears a stale `thread_key`

**File:** `backend/app/services/ingest_splice.py:634-648`, `backend/app/api/documents.py:2388`

Both paths splice the column only when non-`None`, which is correct for BUG-260905-07 (a degraded
enrichment must not erase a good key). The uncovered case is a *successful* enrichment that
derives `None` over a row that already has a key — e.g. a document re-ingested after its
`References` header changed. The old key survives and silently groups the message into the wrong
conversation. Rare, and the failure direction (a stale grouping) is the one `thread_key_for`'s
docstring says it wants to avoid.

**Fix:** distinguish "not mail" from "mail with no key" in `EnrichedIngest` — e.g. a
`thread_key_derived: bool` — and write `None` only when the derivation ran and produced nothing.

### IN-06: `visibleNavItems` admits any non-boolean value

**File:** `frontend/src/lib/nav-items.ts:118`

`features[item.feature] !== false` is the right *direction* (the BUG-260909-02 argument is sound
and the API is the wall). It also means a malformed payload — `"false"`, `0`, `null` — renders the
door. Given the fail-open design that is acceptable; noted only so the next reader does not
mistake it for a boolean check.

**Fix:** `features[item.feature] !== false` → keep, but narrow the `EffectiveFeatures` type to
`Record<string, boolean | undefined>` and parse at the API boundary.

---

## Claim-by-claim verdict

| Phase claim | Verdict |
|---|---|
| 1. Mail is a shape, not a fourth adapter | **Holds.** `base.py` byte-identical; no registry key; three delegation lines. The seam in `mailbox.py` is genuinely provider-blind — but the fence proving it is weaker than claimed (WR-07). |
| 2. One message = one document; `thread_key` groups them; reads stay user-scoped | **Holds.** RLS + `.eq("user_id", owner_id)` + a document-id-only route. Index leads with `user_id`, partial on NOT NULL. Behaviour untested (WR-05); stale-key edge open (IN-05). |
| 3. `strip_quoted_replies` — a paragraph appears once | **Correctness holds** (3 dialects, real positive control, neutralisation drives it red). **Cost does not** — CR-01. |
| 4. Option A anchoring inside the folder id | **Encoding is sound** — two prefixes, `:after:` separator, round-trip pinned, unanchored refused rather than defaulted. Input validation is thin (IN-01) and growth is unbounded (WR-02). |
| 5. Batched metadata, 2 requests per page, request count pinned | **The count pin is real and non-vacuous.** Parsing fails closed on every malformed shape I could construct. Correlation is positional despite emitting `Content-ID` (WR-01), and the documented fallback is near-unreachable (IN-02). |
| `SourceListing.complete` never over-reports | **Holds** on every constructed path. It can under-report permanently (WR-02). |
| TRUST-03 on mail bodies | **Covered by construction** — watched mail carries `source_connection_id`, which is what `tool_dispatcher.py:838, 4464-4470` keys the trifecta fence on. Hand-uploaded `.eml` is not marked external; pre-existing, not this phase's. |

---

_Reviewed: 2026-09-10_
_Reviewer: Claude (gsd-code-reviewer) — independent of the build, per AGENTS.md §6.3 / OV-240-01_
_Depth: standard_

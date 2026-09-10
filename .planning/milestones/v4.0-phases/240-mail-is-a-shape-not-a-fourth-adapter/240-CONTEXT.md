# Phase 240: Mail Is a Shape, Not a Fourth Adapter - Context

**Gathered:** 2026-09-09
**Status:** Ready for planning
**Mode:** `--auto` equivalent — the operator directed an unattended end-to-end run
(discuss → plan → execute → verify) on 2026-09-09 and **Gemini is unavailable**, so every
gray area below was resolved by Claude and every decision carries its reason inline so the
operator can overturn it at the close. ⛔ **This phase therefore has NO independent reviewer**
(`OV-240-01`); AGENTS.md §6.3 is unmet by construction and VERIFICATION.md must say so.

<domain>
## Phase Boundary

A person watches a **mailbox** the way they watch a folder, and the Library shows a
**conversation instead of a pile**.

**In scope:**
- Mail becomes a *shape* the existing source path already carries: a mail folder is a
  `SourceNode`, a message is a `SourceFile` whose bytes are `message/rfc822`.
- `thread_key` — computed, stored, and **read by something**.
- Attachments arrive as documents of their own **on the watch path**, not only on the legacy
  upload path.
- Phase 234's four promises (deletion does not delete, disconnect freezes, visibility is the
  connection's, honest failure outcomes) proven to hold for mail.

**Out of scope (named, not silently dropped):**
- ⛔ **A fourth `SourceAdapter` class.** The phase's title is its acceptance bar: if mail needs
  a new adapter, a new registry key, or a new contract parameter, the shape claim is FALSE and
  **that is the finding**, exactly as Phase 238's SC#4 was answered with a finding.
- ⛔ **Meeting transcripts** (`SEED-212`) — event-shaped, its trigger stays intact.
- ⛔ **Sending, drafting, labelling, archiving.** `gmail.readonly` only; `gmail.compose` exists
  on the token and is not touched here.
- ⛔ **Microsoft Graph mail** — see `D-240-04`. Deferred with a precise trigger, not forgotten.

</domain>

<decisions>
## Implementation Decisions

### The shape — how mail reaches the Library without a new adapter

- **D-240-01 — Mail is a THIRD VIRTUAL ROOT on the connection that already owns the mailbox,
  not a new registry key.**
  `GoogleDriveSourceAdapter.browse()` already returns two virtual roots (`my_drive`,
  `shared_drives`) before it touches the network. Mail becomes a third, `mailbox_root`.
  **Why this and not a `GmailSourceAdapter`:** `SourceRegistry` is keyed on `service_id`, and
  the Gmail mailbox IS the Google connection — one row, one token, one consent, one place to
  revoke (`oauth_service.py:44-58`, BUS-037 §B, verbatim: *"one connection, not two"*). A second
  registered adapter would need a second `service_id`, therefore a second `connector_connections`
  row, therefore a second consent — undoing a decision the operator already made. It would also
  break the product surface: a person picking "Google" in the Library's source picker must see
  their Drive folders **and** their mail labels under one connection.
  ⚠ **This is a claim that gets MEASURED, not asserted:** the delegation added to
  `google_drive.py` is counted in lines at the close and published. Phase 238 published
  `352 L vs Drive's 399`; this phase publishes the delegation cost the same way.

- **D-240-02 — Namespaced ids, two distinct prefixes, no contract change.**
  Folder ids `mailbox:<labelId>` · file ids `mailmsg:<messageId>`. Two prefixes rather than one,
  so a delegation test can never confuse a folder for a message. Drive ids are base64-ish and
  contain no `:`, so the namespaces cannot collide.
  ⛔ **No new field on `SourceNode`, `SourceFile`, `FilePage`, `BrowsePage` or `SourceListing`.**
  `backend/app/services/sources/base.py` must close this phase **byte-identical**, asserted by
  md5 in VERIFICATION.md. That single assertion is the phase's headline evidence.

- **D-240-03 — The mail logic lives in `backend/app/services/sources/mail/`, and the adapter
  only DELEGATES.**
  `mail/mailbox.py` (namespacing, message→`SourceFile`, label→`SourceNode`) and
  `mail/gmail.py` (the three Gmail calls). `google_drive.py` gains a prefix test and a
  hand-off. **Why a module and not inline:** a second mailbox family (Graph) must cost the
  adapter the same three lines, and the only way to know that is to have somewhere for the
  shared half to live before the second one arrives.
  ⚠ **`PROTOCOL_ADAPTERS` / `CONFIG_PROTOCOL_MARKERS` in `base.py` are NOT touched.** Mail is
  not a transport and not a family; it is a shape *inside* a family. Adding a row there would
  repeat the mistake that module's own comments record twice.

- **D-240-04 — Gmail ONLY. Microsoft Graph mail is deferred with a named prerequisite.**
  Graph mail needs the `Mail.Read` scope (absent from `oauth_service.py:108-114`, which carries
  only `Files.Read.All`) **and** an Azure app registration that does not exist on this machine —
  Phase 238 closed with **all nine of its live UAT rows owed on exactly that prerequisite**.
  Building a Graph mail arm now would be code asserted against a fake I also wrote, which is the
  weakness Phase 238's own verification named in its first paragraph.
  ⭐ **The shape is still proven by construction:** `mail/mailbox.py` holds everything
  provider-independent, so the Graph arm is a second `mail/<provider>.py` plus the same three
  delegation lines. **Plant `SEED-260`** with the trigger *"`MICROSOFT_OAUTH_CLIENT_ID` is
  configured and Phase 238's row M-1 has been driven"*.

### `thread_key` — the column the ROADMAP predicts will be stored and read by nothing

- **D-240-05 — Derived from RFC 5322 headers, computed in `ingest_enrich`, NOT supplied by the
  adapter.** Rule, in order: the **first entry of `References`** → else `In-Reply-To` → else the
  message's own `Message-ID` → else `NULL`. Normalised: angle brackets stripped, whitespace
  removed, lower-cased.
  ⭐ **Why header-derived beats Gmail's native `threadId`, and this is the load-bearing reason:**
  a provider thread id is meaningless outside that provider and outside that account, while D-3
  calls this a **retrieval-grouping** column, not a provider id. Header derivation is the only
  rule under which a **manually uploaded `.eml`, a Gmail-synced message and (later) a Graph-synced
  message of the same conversation land in the same group** — and manual upload is where
  essentially all mail in this Library is today. It also keeps the adapter contract untouched
  (`D-240-02`), because no thread id has to travel through `SourceFile`.
  ⚠ **Google's own documentation supports the choice**: the `threadId` field description states
  that threading requires *"the `References` and `In-Reply-To` headers must be set in compliance
  with RFC 2822"* and that Subject must match — i.e. Gmail derives its thread from the same
  headers this rule reads.
  ⚠ **The known weakness, recorded rather than hidden:** a client that omits `References` breaks
  the chain and the message becomes a thread of one. That is a *visible* degradation (a singleton
  conversation), never a wrong grouping — the failure direction we want. Measured against a real
  mailbox at UAT; if it bites, the native `threadId` becomes a documented fallback in a later
  phase, not a silent one here.
  ⛔ **`thread_key` is NEVER derived from Subject.** "Re: Budget" collides across unrelated
  conversations and across people; a wrong grouping is worse than no grouping.

- **D-240-06 — Migration 175 · `documents.thread_key text` + a plain btree index on
  `(user_id, thread_key)`.** Nullable — most documents are not mail, and a sentinel would make
  "not mail" and "mail with no headers" indistinguishable, which is the same mistake
  `metadata.source.path` already paid for at `D-238-07.4`. No backfill in the migration; a
  separate opt-in re-derive is out of scope and named in `<deferred>`.
  ⚠ Applied by pasting into the Supabase SQL editor, then `bash scripts/regenerate-full-schema.sh`
  **without** `--reset`.

- **D-240-07 — `thread_key` is READ in two places in this phase, because a column read by
  nothing is the ROADMAP's own named failure mode.**
  1. **A view filter** — promoted into `view_filter_compiler.py` beside the source facts Phase
     237 promoted (`source_system`, `source_connection_id`, …). That seam is proven and its
     whitelist-bypass leg is already closed at `document_view_resolver.py:197`.
  2. **A Conversation section in the document detail panel** — sibling messages of the same
     `thread_key`, in date order, in the Phase 117 relationships accordion shell.
  ⚠ Both are reads a test can pin. "Stored and displayed nowhere" is the outcome this decision
  exists to prevent.

### Attachments — the fourth two-paths disagreement, found by scouting

- **D-240-08 — The email-attachment child loop is EXTRACTED from `api/documents.py` into a
  shared function that both ingest paths call.**
  ⛔ **Measured 2026-09-09, and this is the phase's most consequential finding:** the loop that
  mints attachments as child documents and writes the `attached_to` relationship lives **only**
  in `api/documents.py:2217-2325` (the legacy `ingest_document`). `grep -n "rfc822\|attachment"
  backend/app/services/ingest_splice.py` returns **one docstring line and no code**. Watches and
  `/upload` both run the **queue** path. **So a watched mailbox would ingest fourteen messages
  and zero attachments**, and SC#2 would be false while every unit test stayed green — because
  the tests exercise the legacy path.
  ⚠ This is the **fourth** recorded disagreement between these two paths; `ingest_splice.py`'s
  own comments narrate the first three (BUG-260905-06 metadata, the empty-chunk refusal, the
  Phase 234 provenance carry). The fix is the same shape as those: **one function, both callers**,
  never a copy.
  ⭐ It doubles as a real **G-5 discharge** on `api/documents.py` (85/33/2437) rather than
  "honoured by construction".

- **D-240-09 — The same attachment on two messages LINKS to both parents; it is not swallowed.**
  Already true by construction (`mint_document_row(on_conflict="link")`, and the
  `document_relationships` insert sits **above** the `is_duplicate` early-return at
  `documents.py:2256-2270`), but the ROADMAP names it as a failure mode, so it gets a test that
  is driven RED by moving the relationship insert below the return. **A guard nobody has seen
  fire is one person's word.**

### SC#1 — proving the answer cites the paragraph once

- **D-240-10 — SC#1 is a MEASUREMENT first and a fix only if the measurement demands one.**
  `strip_quoted_replies()` already runs **before** chunking and already breaks on
  `On … wrote:`, `-----Original Message-----`, the Outlook underscore divider and the
  `From:/Sent:` block, and drops `>` lines. So the poisoning SC#1 describes may already be
  mitigated — and this project's rule is to drive it, not to assume it.
  **The test:** a fixture 14-message thread where message 1's paragraph is quoted by all
  thirteen replies; assert the paragraph's text appears in the chunks of **exactly one**
  document. **Driven RED by disabling `strip_quoted_replies` for one run**, so the assertion is
  proven able to fail — Phase 235's lesson (*presence assertions cannot see content drift*) and
  Phase 236's requirement (*removing a defence must turn it RED*) applied to this phase.
  ⛔ **`retrieval_service.py` is NOT modified.** It fires G-5 at 10 phases with an extraction
  **owed since Phase 231**, and ROADMAP row 241 states plainly that *"a third must propose the
  extraction first"*. Phase 240 will not be that third landing. If the measurement shows
  duplication survives chunking, the finding is **recorded and routed to 241**, which already
  owns the extraction and the recall harness — not patched here.

### Phase 234 parity (SC#4) — proven by NOT touching the loop

- **D-240-11 — `watch_service.py` closes this phase BYTE-UNCHANGED**, asserted by md5.
  It fires G-5 at 3 phases, and the strongest possible answer to both G-5 and SC#4 is the same
  one: mail rides the generic loop, so deletion-does-not-delete, `SourceListing.complete`'s
  fail-closed H-5 guard, `VIS-04` unauthorized handling and connection-scoped visibility are
  inherited **by construction and by evidence**, not re-implemented.
  ⚠ **Inherited is not the same as proven.** SC#4 still needs the four behaviours driven on a
  real mail watch — those rows are in the owed list, not claimed.

### Cost decisions forced by the Gmail API (researched against Google's own docs)

- **D-240-12 — `messages.list` returns only `{id, threadId}`, so listing costs N+1 requests.**
  Google's reference is explicit: *"each message resource contains only an `id` and a `threadId`.
  Additional message details can be fetched using the messages.get method."* A `SourceFile`
  needs a name, a size and a version. **Decision: one `messages.get?format=metadata` per message
  with `metadataHeaders=Subject,Date,Message-Id`**, and a mail-specific page size of **25**
  (the same cap `service_tools.py` already applies to `search_email`, for the same stated
  reason).
  ⛔ **Rejected: naming the file by its message id.** Phase 233's preview — *"the four honest
  labels ARE the feature"* — is worthless if it lists eighteen rows of `18c3f9a…`.
  ⚠ Small responses, bounded page, `max_bytes` on every call. The cost is stated here so nobody
  later discovers it as a surprise.

- **D-240-13 — Field mapping, fixed:** `name` = sanitised Subject + `.eml` (empty subject →
  `(no subject).eml`) · `mime_type` = `message/rfc822` · `size` = `sizeEstimate` ·
  `modified_at` = `internalDate` (epoch ms, as a string) · `path` = `/<label name>`.
  ⭐ `internalDate` is the right version key because Google's doc calls it *"more reliable than
  the `Date` header"*, and a message is immutable — so a watch pass never re-reads a message it
  has seen, and `SEED-253`'s fabricated-`/<filename>` path is closed for mail on arrival.
  ⚠ Filenames go through the existing `sanitize_attachment_filename()`; a Subject is
  attacker-controlled text and this Library already learned that lesson at `22P05` (v3.7 UAT,
  a NUL byte in a `.msg` subject).

- **D-240-14 — `format=RAW` is the read.** Google: *"The entire email message in an RFC 2822
  formatted and base64url encoded string."* Decoded with `base64.urlsafe_b64decode` (padding
  restored) and handed to the pipeline as `message/rfc822` — landing on the **same
  `parse_eml_bytes()`** that manual `.eml` upload uses. **One parser, and now two doors.**
  Egress key **`gmail_read`** (never `drive_read` — `egress.py:266` and `service_tools.py:409`
  both state why: the key is what an audit can grep). `max_bytes=source_max_file_bytes()`, the
  single operator ceiling Phase 239 established.

### Guardrails — audited, with verdicts

- **D-240-15 — G-5 audit over the expected blast radius, triples RE-DERIVED 2026-09-09:**

  | File | commits/phases/lines | Fires? | Verdict |
  |---|---|---|---|
  | `backend/app/services/watch_service.py` | 5 / 3 / 616 | **YES** | **byte-unchanged** (`D-240-11`) |
  | `backend/app/services/ingest_splice.py` | 11 / 4 / 776 | **YES** | **seam TAKEN** — gains the shared attachment call (`D-240-08`) |
  | `backend/app/api/documents.py` | 85 / 33 / 2437 | **YES** (discharged 229) | **further discharge** — loses ~110 lines to the shared module |
  | `backend/app/services/sources/base.py` | 9 / 5 / 336 | **YES** | **byte-unchanged, asserted by md5** — the phase's headline evidence |
  | `backend/app/services/sources/adapters/google_drive.py` | 3 / 2 / 407 | no (crosses to 3 here) | delegation only; row exists |
  | `backend/app/services/ingest_enrich.py` | 7 / 2 / 600 | no | `thread_key` write; row exists |
  | `frontend/src/components/sources/CreateWatchModal.tsx` | 4 / 1 / 283 | no | row exists |
  | `backend/app/services/email_extraction_service.py` | 4 / 1 / 440 | no | ⛔ **NO LEDGER ROW — one is OWED in this phase's commit** |

  ⚠ `email_extraction_service.py` has been absent from the ledger for its whole life. It is
  below the G-5 threshold, but `scripts/check-hot-file-ledger.cjs` fails a phase whose
  `files_modified` names a source file with no row, so the row lands in the same commit —
  **with its section in `docs/HOT-FILE-LEDGER.md`, per the same-commit sync rule.**

- **D-240-16 — G-8: FOUR plans across three waves.** Above 6 requires a justification in
  CONTEXT; four does not, and Phase 235's 17-plan stop is the reason this is stated up front.
  Executors run **targeted suites per task; FULL gates once per wave**.

- **D-240-17 — G-2 not triggered.** ROADMAP marks 240 *"UI hint (minimal)"* and, unlike 233 /
  234 / 235, does **not** mark a sketch mandatory. The UI reuses two shipped shells (the Phase
  117 relationships accordion and the existing Library list), so there is no new visual
  language to sketch. ⚠ `Skill("sketch-findings-agentic-rag")` is still loaded before the
  detail-panel work — CLAUDE.md requires it for that surface.

- **D-240-18 — G-4 lived-experience UAT rows, defined NOW (not post-hoc):**
  1. Watch a real Gmail label; a message arrives by itself and reads as a document.
  2. Open a message with an attachment ingested **through the watch**; the attachment is its own
     document and is findable from both ends.
  3. Search the Library for a phrase from message 1 of a long thread; the result is **one**
     message, not fourteen.
  4. Disable the Google connection; the mail watch stops **and** browse/preview refuse.
  5. Delete a message at the source; the document is **not** deleted, and the source state says
     what happened.

### Folded reported bug

- **D-240-19 — `BUG-260908-02` is FOLDED.** A **disabled** connection is still offered in the
  Library's "From a connected source" picker. It sits on the exact surface Phase 240 adds a mail
  node to, and its root cause is named in the report: **`ConnectedSourceSection` and
  `CreateWatchModal` have NO test suite at all** — the hole a new source shape would fall
  straight through. Fix = filter on `is_enabled` at the picker **and** the first test suite for
  both components, adopted into `vitest-count-gate.cjs` **`TARGETS` and `BASELINE`** (Phase 214
  measured that a suite can sit on the wrong side of exactly one knob and be run-but-unguarded).
  ⚠ `backend`-side refusal already exists (`SourceConnectionDisabled` in the registry, Phase
  239); this is the surface half.

### Claude's Discretion

The operator delegated every implementation choice for this run. Anything genuinely requiring a
person — live credentials, a destructive drive, a scope change, a production push — is **batched
into one owed list at the phase close** rather than blocking mid-phase, per the operator's
instruction. Nothing here silently spends an operator decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The contract this phase must not change
- `backend/app/services/sources/base.py` — the `SourceAdapter` contract, `SourceRegistry`,
  `SourceConnectionDisabled`, and the two comment blocks recording why provider branching was
  removed from this module twice. **Closes byte-identical.**
- `.planning/phases/232-the-source-contract-google-drive/` — the contract's origin (SRC-01).
- `.planning/phases/238-microsoft-graph-onedrive/238-VERIFICATION.md` — how a "was the contract
  real?" question is answered with a measurement and a finding.

### The paths mail rides
- `backend/app/services/watch_service.py` — the generic sync loop; `SourceListing.complete` /
  H-5 at lines 521-558.
- `backend/app/services/ingest_splice.py` — the **queue** path; its comments narrate the three
  prior two-paths disagreements.
- `backend/app/api/documents.py` §2217-2325 — the email-attachment child loop being extracted.
- `backend/app/services/ingest_enrich.py` §241-267 — where email headers already become
  metadata and where `thread_key` is computed.
- `backend/app/services/email_extraction_service.py` — `parse_eml_bytes`, `parse_msg_bytes`,
  `strip_quoted_replies`, `sanitize_attachment_filename`, `MAX_ATTACHMENTS_PER_EMAIL`.

### Gmail
- `backend/app/services/google/gmail.py` — shipped read-only Gmail calls and their error wording.
- `backend/app/services/oauth_service.py` §38-100 — `gmail.readonly` is **already granted**;
  the "one connection, not two" decision and the re-consent warning.
- `backend/app/security/egress.py` §266, §336, §358 — the `gmail_read` key.
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages —
  `raw` is *"RFC 2822 formatted and base64url encoded"*; `internalDate` is *"more reliable than
  the `Date` header"*; `threadId` requires RFC-2822 `References`/`In-Reply-To`.
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list —
  *"each message resource contains only an `id` and a `threadId`"*; `maxResults` default 100,
  max 500.

### Rules that bind this phase
- `CLAUDE.md` — provider-docs-first; migrations via the SQL editor then
  `scripts/regenerate-full-schema.sh` (no `--reset`); G-1…G-8; the backend baseline gate;
  `GSD_VITEST_MAX_WORKERS=2`.
- `AGENTS.md` §6.3 — the reviewer must not have shaped the build. ⛔ Unmet this phase.
- `docs/HOT-FILE-LEDGER.md` — same-commit sync rule; a row for
  `email_extraction_service.py` is owed.
- `docs/PLANNING-PROPORTION.md` — G-8's cost table.
- `.planning/seeds/SEED-212-meeting-transcripts-as-a-first-class-event-shaped-source.md` —
  stays out, trigger intact.
- `.planning/reported-bugs/BUG-260908-02-disabled-connection-is-still-offered-as-a-library-source.md`
  — folded (`D-240-19`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets — the "~80% already ships" claim, verified file by file
- `parse_eml_bytes()` / `parse_msg_bytes()` → `ParsedEmail` already carries `message_id`,
  `in_reply_to`, `references`. **They are parsed today and read by nothing beyond a metadata
  copy** — the v3.8 audit finding, still true at `ingest_enrich.py:261-266`.
- `strip_quoted_replies()` runs **before** chunking — the retrieval-poisoning mitigation SC#1
  depends on already exists, and its `>`-line handling carries a recorded correction.
- Attachments-as-children ship with caps (`MAX_ATTACHMENTS_PER_EMAIL=50`,
  `MAX_ATTACHMENT_BYTES=25MB`) and a `document_relationships` row of type `attached_to`.
- `browse()`'s **virtual-root** pattern (`my_drive` / `shared_drives`, returned before any
  network call) is the seam `D-240-01` rides.
- `send_pinned_http` + per-capability egress keys; `source_max_file_bytes()` (Phase 239's single
  operator ceiling); `mint_document_row(on_conflict="link")`.
- `view_filter_compiler.py` — Phase 237's proven seam for promoting a document fact to a filter.

### Established Patterns
- **A source family is DATA, not code** — and `base.py`'s comments show the rule being broken
  twice inside the module that states it. Any provider branch added there fails the phase.
- **Two ingest paths, and they drift.** Three prior disagreements are narrated in
  `ingest_splice.py`; `D-240-08` is the fourth. **Assume divergence; prove convergence.**
- **A guard nobody has seen fire is one person's word** — every fence driven RED against a
  planted defect, then the file restored md5-identical.
- **The registry is the one place a disabled connection is refused** (`BUG-260907-03`) — mail
  inherits that refusal for free, which is `D-240-01`'s second dividend.

### Integration Points
- `GoogleDriveSourceAdapter.browse/list_files/read_file` → `sources/mail/` (three delegations).
- `ingest_enrich.enrich_for_ingest` → `thread_key` write (one call, one column).
- `ingest_splice.splice_document` **and** `api/documents.ingest_document` → one shared
  attachment function.
- `CreateWatchModal` / `SourceFolderPicker` → a mail label is just another node; ⛔ but see
  `D-240-19`, that picker currently offers **disabled** connections.
- `DocumentDetailPanel` → a Conversation section in the Phase 117 accordion shell.

</code_context>

<specifics>
## Specific Ideas

- The phase title is the acceptance bar, and the evidence is an **md5 of `base.py` before and
  after**. Phase 239 proved a zero-code claim by hash rather than by assertion; this phase
  copies that method deliberately.
- Publish the **delegation cost in lines** the way Phase 238 published `352 L vs Drive's 399`.
  If mail costs the adapter more than a few dozen lines, say so — a refuted thesis recorded
  plainly is worth more than a satisfied one that was never tested.
- The 14-message-thread fixture is the phase's single most valuable artefact: it is the only
  thing that can make SC#1 fail.

</specifics>

<deferred>
## Deferred Ideas

- **Microsoft Graph mail** → `SEED-260` (to plant). Trigger: `MICROSOFT_OAUTH_CLIENT_ID` is
  configured **and** Phase 238's row `M-1` has been driven. Needs the `Mail.Read` scope and
  therefore a re-consent.
- **Meeting transcripts** → `SEED-212`, unchanged, trigger intact. Event-shaped, not
  message-shaped; folding it in is how this phase becomes two.
- **Backfilling `thread_key` for mail already in the Library** — the column ships nullable and
  forward-only. An opt-in re-derive is a small later task; doing it inside migration 175 would
  make a schema change do data work.
- **Native `threadId` as a fallback when headers are absent** — held until UAT measures whether
  broken `References` chains actually occur in the operator's mailbox (`D-240-05`).
- **Retrieval-side thread collapsing** — routed to **Phase 241**, which already owns
  `retrieval_service.py`'s owed extraction and the recall harness (`D-240-10`).
- **`BUG-260905-01`** (cloud import lives in the chat composer and writes to the Library root) —
  reviewed, **not folded**: a different door on a different surface.
- **Sending / drafting / labelling mail** — `gmail.compose` is on the token and stays unused;
  no outbound capability ships without its approval model.

</deferred>

---

*Phase: 240-mail-is-a-shape-not-a-fourth-adapter*
*Context gathered: 2026-09-09*

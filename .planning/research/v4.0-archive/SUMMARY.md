# Project Research Summary

**Project:** Agentic RAG — v4.0 "Connected Knowledge"
**Domain:** Scheduled, permission-aware, multi-source document ingestion at scale, retrofitted onto an existing production RAG/DMS platform
**Researched:** 2026-09-04
**Confidence:** HIGH overall — every claim below is grounded in either a file:line in this repo (read at HEAD 2026-09-04), a live PyPI/vendor-doc check, or a named disclosed security incident. MEDIUM/LOW markers are preserved per-claim below, not flattened.

---

## Executive Summary

v4.0 turns the Library from "a person uploads a file" into "a person connects a source once, previews exactly what a sync would bring in, and the Library keeps reading it on a schedule." All four researchers converge on the same structural verdict: **this milestone needs zero new Python packages and no new always-on process.** Every technical primitive it needs — pinned egress, OAuth token storage, an MCP client, RFC822 email parsing, and a `FOR UPDATE SKIP LOCKED` durable-claim pattern — already ships in this codebase for other purposes (v3.9 connectors, Phase 204 scheduler, Phase 203 email attachments). The recommended approach is therefore almost entirely **extraction and generalization**, not invention: pull the row-minting logic out of `documents.py`'s `/upload` route into one shared splice, build one `list -> read -> hash -> splice` adapter contract that Drive/Graph/MCP-file/mail sit thin on top of, and reuse the scheduler's proven claim transaction for a second table (`ingestion_jobs`) rather than building a second scheduler.

The differentiator the feature research surfaces is genuinely uncontested in the competitive landscape: **no competitor (Onyx, Microsoft 365 Copilot connectors, Glean, Dropbox Dash, NotebookLM, Slack) shows a user what a sync would bring in before it brings it in.** The three-way preview (*will be added / already here / can't read*) is low-invention-risk (it's Migration Manager's scan pattern, applied to RAG for the first time) and high-differentiation. But the milestone's stated plan currently over-promises how cheap that preview's "already here" answer is (see Contradiction 1 below), and the milestone's permission model — while a defensible, deliberately-capped v1 — creates a specific, named new risk class: a corpus that was previously safe by construction (every document was placed by a person who could already read it) stops being safe by construction the moment a machine places documents on a clock from a source this system does not own. Every pitfall in the security-critical tier (Pitfalls 1-4) is downstream of that one sentence.

The recommended mitigation shape is consistent across all four files: **schema-level fences, not process discipline.** Widen RLS policies before DEFINER retrieval functions (never the reverse — the reverse is a leak that looks like a feature); make the durable queue's correctness provable against the *existing* `/upload` route before any new adapter uses it; and treat email as a shape decision sequenced last, so three source families ship even if mail is cut. The single highest-value engineering discipline named repeatedly is: **a listing must assert `complete=True` before it may write a single "missing" verdict** — without it, a rate-limited page of pagination looks identical to a mass deletion, and that exact failure mode has already destroyed a real production knowledge base (Onyx issue #1161, closed as not planned).

---

## Key Findings

### Recommended Stack

Full detail: `STACK.md`. Every one of the six stack axes the milestone touches resolves to code already in this repo — see the file's own headline table. The two genuinely new pieces of *infrastructure* are a durable ingestion job queue (a plain Postgres table, not a broker) and ~5 new env knobs; everything else is new rows in existing registries.

**Core technologies (all already installed, zero `requirements.txt` changes):**
- `httpx` via `security/egress.send_pinned_http` — the one transport for Drive, Graph, Gmail and Graph-mail. A vendor SDK (`msgraph-sdk`, `google-api-python-client`) would bypass DNS pinning, the allow-list, redirect refusal and the size cap — `cloud_storage.py:252` records this as a prior CR finding on the Drive path. **HIGH confidence.**
- `asyncpg` + a plain table + `FOR UPDATE SKIP LOCKED` — the durable ingestion queue. `db/schedules.py:264-340` (`claim_due_schedules`) is the exact pattern to copy; `pgmq`/`arq`/`celery`/etc. were all rejected because each adds either a broker process (a `docker-compose.prod.yml` service + deploy-drift-script changes) or an extension outside the local<->cloud parity path. **HIGH confidence.**
- `hashlib.sha256` — content hashing, unchanged. It is the existing dedup key (`documents.py:620`, unique index `documents_dedup_idx`). Hashing anything other than exactly what `/upload` hashes breaks interoperability with the shipped dedup path. **HIGH confidence.**
- `email_extraction_service.py` (Phase 203) — RFC822 parse, quoted-reply stripping, attachments-as-children. No email library needed; `talon`/`email-reply-parser` are effectively abandoned (last releases 2017/2020) and redundant besides. **HIGH confidence.**
- `tiktoken` — token-budget batching for the embedding call, which today sends every chunk of a document in one unbounded request (`openai_service.py:2129`). OpenAI's real ceiling is 300,000 tokens *summed across all inputs*, not just an array-length cap. **HIGH confidence (verified against OpenAI's API reference).**

**Critical stack-level finding not to lose:** the Microsoft Graph `/content` endpoint returns a **302** to a pre-authenticated URL on a different host (`*.1drv.com` / `*.sharepoint.com`), and this app's egress binder refuses redirects by design (`EgressRefused("redirected")`). The adapter must do a `$select=@microsoft.graph.downloadUrl` call, then a *second* pinned request under a *separate* egress key (`graph_download`) to the returned host. This is not a workaround; it's Microsoft's documented path. **HIGH confidence, verified against MS Learn.**

### Expected Features

Full detail: `FEATURES.md`. Confidence: HIGH on Onyx (source read directly) and Microsoft 365 Copilot connectors (docs read verbatim); MEDIUM-HIGH on Glean; MEDIUM on Dash/Notion/NotebookLM/Slack; LOW on LlamaCloud (stated as a gap, not filled).

**Must have (table stakes) — all with a named competitor precedent:**
- Map one external folder -> one Library folder per connection (TS-1)
- A stated, editable check interval + "check now" on demand (TS-2/TS-3)
- A named connection state, always visible, plus **two separate timestamps** — "last checked" and "last change found" (TS-4/TS-5) — Microsoft's own wording is the best in class: *"The connection is as fresh as the last sync time."*
- Per-run history with item-level errors separated from run-level failure (TS-6)
- Type coverage stated up front, derived from the existing `acceptedFormats.ts` (never re-typed) (TS-10)
- Rules route synced documents through the *existing* classification splice; unmatched -> review queue, never silent auto-file (TS-11)
- Pause without deleting; disconnect answers what happens to the documents (TS-9/TS-12)

**Should have (differentiators — genuinely unoccupied in this product class):**
- **D-1: the three-way preview, writing nothing until a person confirms.** The milestone's headline claim. No competitor studied does this before their first index.
- D-2: the preview shows *where rules would file each document* — a dry run of the classification engine itself, not just a file count.
- D-3: refusal-shaped honesty about freshness ("checked every N minutes," never "instantly"/"real-time"/"on change"/"always up to date") — enforced by a vocabulary fence test, not by discipline, mirroring the existing `acceptedFormats.ts` subset-fence pattern.
- D-5: a removed-at-source **review queue**, never an automatic deletion — see Convergent Finding 2 below.

**Defer to v4.x / v5+ (explicit, with triggers):**
- D-2 rules preview, D-7 source-facts-as-filterable-fields, D-9 footprint estimate — each has a named trigger (first 500+ file import, first rule mentioning a source path, embed-batching landing).
- Per-document ACL mirroring (SEED-211's BUILD half) — explicitly deferred; even Onyx puts this behind its Enterprise tier for 10 named connectors because it requires identity mapping to the source directory.
- Delta cursors / webhooks — deferred; the "checked every N minutes" sentence changes in the same commit one lands.

**Anti-features — things named competitors ship that this milestone must deliberately not copy**, each with cited evidence: auto-delete on absence (AF-1, see Convergent Finding 2), visibility that can't be changed after setup (AF-2), a rule/scope change requiring connection deletion (AF-3), a green "ready" verdict over zero usable files (AF-4), overclaimed freshness language (AF-5), per-document ACL mirroring in v1 (AF-6), a second rule engine for sync routing (AF-8), a source-mirroring folder tree (AF-10).

### Architecture Approach

Full detail: `ARCHITECTURE.md`. The system is layered as: **one adapter contract** (`SourceAdapter` Protocol: `browse`/`list`/`read`/`check`, returning `SourceListing`/`SourceBytes` — deliberately opaque above the adapter boundary, mirroring the shipped outbound `connectors/protocol.py` shape) -> **one ingest splice** (`ingest_splice.mint_document_row()` + `splice_document()`, extracted from today's inline `/upload` row-minting code) -> **two poll loops sharing the shipped claim pattern** (`WatchService` does the cheap `list`-only diff; `IngestQueueService` does the expensive `read`-and-splice work, fed by a table, not a direct call) -> **a four-site RLS widening** for connection-scoped visibility.

**Major components:**
1. `backend/app/services/sources/*` (NEW) — the adapter contract + registry + one module per family (`drive_adapter.py`, `graph_adapter.py`, `mcp_file_adapter.py`, `mail_adapter.py`), mirroring `connectors/registry.py`'s import-time-asserted closed-set pattern.
2. `backend/app/services/ingest_splice.py` (NEW) — the one place a `documents` row is born, extracted from `documents.py`'s `_upload_pipeline` and `/upload`'s inline preamble. `mint_document_row`'s three-way verdict (`created`/`already_here`/`refused`) *is* the preview's three-way split — implementing them separately guarantees they eventually disagree.
3. `WatchService` + `IngestQueueService` (NEW) — two lifespan poll loops, same shape as the shipped `SchedulerService`, communicating through the `ingestion_jobs` table rather than a direct call (this table boundary is what makes cap/retry/resume possible at all).
4. Four-site RLS widening for `connection_grants_org_visibility` — two policies (`documents`, `document_chunks`) and two `SECURITY DEFINER` functions (`match_document_chunks`, `keyword_search_chunks`) all gain the identical disjunct. `retrieval_service.py` itself needs **zero changes** — the whole visibility decision lives in SQL.

### Critical Pitfalls

Full detail: `PITFALLS.md`. Top five, in the file's own stated priority (silence, not severity, is the ranking axis):

1. **Connection-scoped visibility is silently widened by folder placement, and the rules engine is the mechanism.** A document's actual visibility in this schema is a property of the *folder* it lands in (`folder_is_org_shared`), not a property of the connection. A classification rule that routes a document into an org-shared folder is, structurally, an authorization grant wearing a filing costume. **Avoid:** the SELECT policy must read the *narrower* of folder-derived and connection-derived visibility, never the union; a rule targeting a shared folder for a private-connection document must produce a suggestion requiring human accept, never an auto-move.
2. **"Connection-scoped" answers who may read the corpus, not whose corpus this is** — the connecting user (often an admin, often the org's widest-access account) becomes an unintentional gateway, and unlike Microsoft Copilot's failure mode (over-broad retrieval, still checked against the *asking* user), this app does not even re-check source-side rights at query time. **Avoid:** record the connecting principal on every ingested row; cap blast radius at connect time (a folder/site picker, never "the whole drive"); make org-visibility an explicit second, audited act, never the connect-time default.
3. **Retrieval leaks substance without leaking identity, so the ordinary "who opened this file" audit can never detect the disclosure.** A RAG answer quotes a document's contents and cites it without ever generating a file-access event. **Avoid:** log the retrieval set itself — every hit on a `source_connection_id` document writes an `audit_log` row, queryable by document, written by the retrieval service below the model (never inferred from citations).
4. **The corpus becomes attacker-influenced, and this app already holds the full "lethal trifecta"** (private data + untrusted content + external communication via granted write tools) in one session. Four disclosed, named incidents map directly onto this milestone's four source families (EchoLeak->mail, AgentFlayer->Drive, ShadowLeak->mail/server-side exfiltration, GitHub MCP->the MCP file family). **Avoid:** the only real architectural control is fencing write-capable connector tools out of any turn whose retrieval set contains connection-sourced content, unless a human approves that specific call — cheap here because the approval checkpoint already exists; this is arming it, not building it. Prompt-level "treat as data" instructions are real-but-partial and unproven — this project's own `SEED-188` notes nobody has ever tried to break them.
5. **Polling-loop failures that produce silent wrongness rather than errors** — ranked by silence, not severity. The worst-in-class: Google's own tracker documents an open case where Drive returns an empty page with a *non-null* `nextPageToken` on shared drives; a naive `while token: if empty: break` silently truncates the corpus. The single highest-value fix named across the whole research set: **`missing` may only be written from a listing whose final page returned `complete=True`.**

---

## CONVERGENT FINDINGS (highest confidence — reached independently by 2+ researchers)

1. **The durable queue is a plain Postgres table reusing the shipped `FOR UPDATE SKIP LOCKED` claim pattern from `db/schedules.py` — no broker, no new process.** STACK and ARCHITECTURE reached this independently, from different angles: STACK compared it against seven alternatives (`arq`/`dramatiq`/`rq`/`celery`/`procrastinate`/`pgqueuer`/`pgmq`) on packaging/RLS/local-cloud-parity grounds and rejected all seven; ARCHITECTURE traced the actual call graph and found `SchedulerService`'s own module docblock already states the reason no leader election is needed, and that the identical transaction shape (claim + in-transaction advance) generalizes cleanly to a second table with a different claim key. PITFALLS independently names this as `P-QUEUE`'s **ARCH**-tier prerequisite, citing `SEED-077`'s "nothing survives a restart today" gap. **All three files land on the same shape, from three different evidentiary paths.**

2. **No auto-delete on absence — supported independently by FEATURES and PITFALLS via different incidents.** FEATURES cites Onyx issue #1161 (an *offline* web connector run logged "removed 976 docs that were detected as deleted," closed as not planned) and Microsoft's own 28-day auto-removal (which Microsoft's own docs admit fires "even when the cause is connection failure"). PITFALLS independently cites Google Drive's empty-page-with-non-null-`nextPageToken` tracker issue (406305173) as the mechanism by which a *transient* pagination fault would trigger the same catastrophic misread if a naive "not seen => deleted" rule existed here. **Two different failure vectors (an unreachable competitor product, and a documented API quirk in one of our own four source families) converge on the identical prevention: absence is never itself an action; only a listing that completed successfully may ever downgrade a document's state, and even then to "missing," never to deletion.**

3. **The preview and the deletion-detection pass are the same cheap `list`-only call.** FEATURES derives this from Onyx's own three-part connector contract (`Load`/`Poll`/`Slim`, where `Slim` — IDs only, no bytes — exists specifically for the pruning job). ARCHITECTURE derives the identical conclusion independently from this codebase's own shape: `mint_document_row`'s three-way verdict *is* `list`'s natural classification, and re-running the same diff later is what detects removal. Both land on: **one adapter method (`list`), two product features (preview at connect time, "what changed" at every subsequent tick) — implementing them as two different code paths guarantees they eventually disagree.**

4. **"One rule engine, not two" is independently reached by FEATURES (competitive: SEED-209/SEED-243's own deferred text), ARCHITECTURE (a concrete `rule_scope` discriminator + `SOURCE_FIELDS` whitelist on the existing `classification_matcher`), and PITFALLS (Pitfall 10 and the anti-feature AF-8, both citing the same "two rule engines means guarantees hold at the door people watch and not the door the volume comes through" framing).** All three independently reject a second, sync-specific rules surface.

5. **Widen RLS policies before `SECURITY DEFINER` retrieval functions, in one transaction, never the reverse.** ARCHITECTURE states this as Anti-Pattern 3 with a precise two-row truth table (policy-only-widened = annoying; DEFINER-only-widened = "the agent retrieves and cites chunks the Library refuses to display" — a leak). PITFALLS reaches the same ordering requirement independently as part of Pitfall 1's fix and lists it explicitly in the "ordering hazards" framing embedded in its Pitfall-to-Phase table. Both files independently specify the negative test: drive a second user in the same org, connection still `private`, RED against all four sites before the widening.

---

## CONTRADICTIONS OF THE STATED PLAN (raised, not smoothed over)

**1. PROJECT.md's claim that "already here" is "a `content_hash` lookup, not a guess" is FALSE for a list-only preview pass — refuted independently by STACK and FEATURES.**

PROJECT.md, verbatim: *"The preview splits three ways: will be added / already here (a `content_hash` lookup, not a guess) / type not supported."*

FEATURES (F-3) measured this against both this codebase and both provider APIs and found it cannot be true from a list-only pass:
- This app: `documents.py:620` computes `content_hash = sha256(raw)` **over the raw bytes** — it requires downloading the file, which the preview is explicitly supposed to avoid.
- Google Drive: `md5Checksum`/`sha256Checksum` are populated only for binary uploads; native Docs/Sheets/Slides have **no content hash at all**.
- Microsoft Graph: "QuickXorHash is the only value guaranteed to be available" for OneDrive work/school; current Graph docs mark `sha256Hash` as **unsupported**; and Microsoft's own docs state hash values are updated **only after the item is downloaded**.

STACK reaches the identical conclusion independently, from the API-limits angle rather than the product-fidelity angle: provider metadata (`md5Checksum`, `eTag`/`cTag`) answers *"should I download this?"*, and `sha256(bytes)` answers *"have I already got this?"* — "two different questions, and conflating them is how a preview ends up lying in both directions."

**Both files independently propose the same resolution**, which is offered as a decision for the roadmapper, not a discovery to smooth over: a **two-tier identity**. Tier 1 (list-only, cheap): `(source_system, external_id, source_version)` — an opaque, provider-supplied version signal compared for equality, never trusted as a real hash. Tier 2 (exact, at ingest time): the existing `sha256` dedupe still runs at splice time. The preview's "already here" bucket must be honestly labeled — FEATURES proposes *"Already here (matched by source file, not by content)"* — with a fourth, small "can't tell without reading it" bucket, rather than forcing every row into three buckets that overclaim certainty.

**2. PROJECT.md folds `SEED-048` as "embedding-provider fallback" — STACK found cross-provider fallback is unsafe as stated and must be redefined.**

`document_chunks.embedding` is `vector(N)` for a single global `N` (currently 1536, set in `config.py`). STACK's finding: matching the dimension across providers is *possible* (OpenAI's `dimensions` param, Gemini's `output_dimensionality`) but **matching the dimension does not make the vectors compatible** — different providers produce different vector spaces. A corpus half-embedded by OpenAI and half by Gemini has **silently degraded recall with a green status everywhere** — STACK calls this "the worst failure mode this milestone could ship, on the milestone whose requirement is filtered-vector recall at corpus scale."

STACK's redefinition, in priority order: (1) retry the same endpoint with backoff/jitter on 429/5xx (closes `BUG-260815-05` alone); (2) fail over to a *different credential/endpoint for the same model* (a second OpenAI key, an Azure OpenAI deployment, an OpenAI-compatible mirror — same vector space, safe); (3) trip `circuit_breaker.py` and **pause the queue** with a named, user-visible refusal, using the durable queue's own retry/backoff mechanism. A deliberate cross-provider swap remains the existing, corpus-wide re-embed job (Phase 111.1) — never an automatic mid-corpus substitution.

**3. PROJECT.md's own scoping note calls email "a second SHAPE smuggled in as a fourth provider" — STACK found this over-stated about the code (softened), while PITFALLS independently confirms the manifestation is dedup/retrieval poisoning, not a broken adapter. Both agree: mail last, as its own shape phase.**

STACK measured that ~80% of the "email is a second shape" problem is **already solved** in this repo: `strip_quoted_replies()` ships and runs before chunking; attachments-as-children ships with caps (`MAX_ATTACHMENTS_PER_EMAIL=50`, `MAX_ATTACHMENT_BYTES=25MB`); both Gmail and Graph mail fetches land on the same `parse_eml_bytes()` — "one parser, two adapters, zero new code paths." What STACK found still owed is narrower than PROJECT.md's framing suggests: **the message-vs-thread document-boundary decision**, and wiring the already-parsed `message_id`/`in_reply_to`/`references` fields (currently parsed and read by nothing — a finding independently confirmed from the v3.8 milestone audit) into an actual `thread_key` grouping column.

PITFALLS independently corroborates from the failure-mode side (Pitfall 11): the risk is not that the adapter breaks, it's that **quoted-reply duplication poisons dedup and retrieval** — a 14-message thread contains message 1 fourteen times; hash dedup never fires because each body differs by the accreted quote block; retrieval returns the same paragraph fourteen times. PITFALLS states plainly that the tool to prevent this (`email_extraction_service`) already exists — "so the pitfall is not building it, it is failing to route the sync path through it," i.e. the same "two ingest doors" defect described in Contradiction/Defect territory below.

**Both files' recommendation is identical and should be read as the softened position**: ship Drive/Graph/MCP-file first, on the file shape; email is its own phase, sequenced **last**, with an explicit shape decision (STACK recommends **one message = one document**, storing `thread_key` as a retrieval-grouping column; PITFALLS independently recommends the opposite default — **the thread is the document, newest message is the version** — explicitly calling this an opinion, not a finding, because the two files disagree on the resolution while agreeing on the sequencing and the risk). **The residual open decision for the roadmapper is genuinely unresolved between the two files and is listed under Open Questions below, not silently picked.**

---

## DEFECTS FOUND IN SHIPPED CODE (not milestone scope by default — the roadmapper decides whether to fold)

1. **`backend/app/api/connectors.py:1693` (`import_connection_file`, Phase 216 `ATTACH-01`) mints a `documents` row that cannot match the schema.** ARCHITECTURE (verified by direct schema read) and PITFALLS (verified independently, same defect, same evidence) both report this:
   ```python
   doc_row = {
       "id": doc_id, "user_id": user["id"], "filename": filename,
       "mime_type": mime_type, "file_size": len(raw_bytes),
       "status": "processing",
       "storage_path": storage_path,        # <- connectors.py:1693
       ...
   }
   ```
   `documents` (`full-schema.sql:1123-1146`) has **no `storage_path` column**, and its `file_path` column is `NOT NULL` and unsupplied. The row also omits `content_hash`, `folder_id`, `version_number`, and `is_latest`.
   - **VERIFIED (schema-read, HIGH confidence):** the key does not exist on the table; `file_path` is `NOT NULL` and absent from the insert.
   - **UNVERIFIED (runtime, both files flag this identically):** whether PostgREST rejects with `PGRST204` (unknown column) or `23502` (not-null violation) was not driven; the INSERT cannot succeed as written either way, meaning ATTACH-01's import has **probably never written a row**.
   - **Structural consequence, even if it somehow succeeded:** a row missing `content_hash` is invisible to the preview's "already here" lookup, and a row missing `is_latest` is invisible to `match_document_chunks`, whose body filters `AND d.is_latest = true`.

2. **The Phase 203 email-attachment cascade inside `ingest_document` (`documents.py:2380-2444` / `:2405-2443` per PITFALLS' independent line numbers) inserts rows with no dedup check, wrapped in a blanket `except Exception: log.warning(...)`.** PITFALLS' framing (Pitfall 9): this is *already* a second ingest door in production, proving the "two doors" risk is not hypothetical — the shipped upload path's dedup/versioning protections live in the `/upload` HTTP handler (`documents.py:547`), not in `ingest_document` (`:2030`) itself, so any caller of `ingest_document` that isn't `/upload` inherits none of them. The broad exception handler means a failure partway through the attachment cascade **abandons remaining attachments with a log line and no user-visible signal**. PITFALLS flags one downstream consequence as inference rather than measurement: two different emails carrying an identical attachment would likely collide on `documents_dedup_idx` (both `folder_id IS NULL`), raise inside the unguarded insert, and be silently swallowed — "one test reproduces or refutes this; it is worth writing either way." Not independently corroborated by a second researcher beyond the shared Pitfall 9 write-up, so it carries PITFALLS' single-source confidence marker, stated as such.

Both defects are cited by ARCHITECTURE as the concrete evidence for why the splice-extraction phase (its proposed Phase 229) must happen before any new adapter ships — a second and third producer of a hand-rolled `documents` row would each get it wrong differently.

---

## THE ORDERING HAZARDS

1. **Widening the `SECURITY DEFINER` retrieval functions (`match_document_chunks`, `keyword_search_chunks`) before the RLS policies makes the agent cite chunks the Library refuses to show.** This is the dangerous direction of a two-way risk (ARCHITECTURE's Anti-Pattern 3 truth table; independently named in PITFALLS' ordering-hazard framing). The safe direction (policies-only-widened) is merely annoying (Library shows a doc the agent can't retrieve). Both files require: widen the two RLS policies first, the two DEFINER bodies last, inside **one transaction**, with the negative case (second user, same org, connection still `private`) driven RED against all four sites *before* the widening.

2. **The splice extraction and the durable queue must land before the first real adapter.** ARCHITECTURE states this as the load-bearing edge in its build-order dependency table: "every producer calls the splice. Extracting it while four producers exist means a red test cannot be attributed to one." PITFALLS independently frames the queue side as a **prerequisite**, not a parallel task: "P-QUEUE must precede any adapter reaching a real customer" — because "nothing is ingested until a person says so" and "cap, retry, resume" are queue properties a `BackgroundTask` fan-out does not have, and retrofitting a queue under a running watch means a backlog with no drain.

3. **The classification rules engine becomes an access-control surface the moment it can route a connector document into a folder — and this must be fenced before, not discovered after, rules can move documents.** Pitfall 1 (independently corroborated by ARCHITECTURE's Pattern 3 write-up on the same rules engine) is explicit: a rule reading "anything from the DMT SharePoint library -> Programme Docs" is, in this schema, *also* an authorization grant, because visibility is a property of the folder a document lands in, not a property of the document itself. The fence (narrower-of-two visibility, never the union; a widening rule produces a suggestion requiring human accept, never an auto-move) must exist in the same phase that lets connector documents reach the rules engine at all — not retrofitted after a rule has silently over-shared a corpus.

4. **The queue's correctness should be proven against the existing `/upload` route before any connector uses it.** ARCHITECTURE names this explicitly in its build-order rationale ("PROVE IT ON `/upload` FIRST... so cap/retry/resume are proven by the path with 30 phases of coverage, before any connector uses it. A queue whose first customer is a new adapter makes every red run ambiguous between the two.") — a hazard specific to this milestone's retrofit context that would not exist on a greenfield build.

5. **A `SourceListing` must assert `complete=True` before any diff may write a `missing` verdict — architecturally, not as a discipline.** Named independently by ARCHITECTURE (the `SourceListing.complete` field docblock: *"a `missing` verdict may ONLY be written from a listing whose final page returned complete=True... a 429 becomes a corpus-wide 'everything is gone'"*) and PITFALLS (Pitfall 5's top-ranked "silent, worst in class" row, citing Google's own tracker issue 406305173 as the concrete mechanism). This is Convergent Finding 2's structural enforcement point.

---

## A RECONCILED BUILD ORDER

ARCHITECTURE proposed a numbered sequence (indicative phase numbers 228-238, since phase numbering resumes at 228 for v3.9 closeout per PROJECT.md). STACK's dependency facts (no new packages; Graph's 302/egress problem is adapter-internal, not sequencing-relevant; the durable queue needs no new process) and PITFALLS' phase-slot recommendations (`P-CONTRACT`/`P-PERM`/`P-QUEUE`/`P-WATCH`/`P-LIFECYCLE`/`P-UNTRUSTED`/`P-RULES`/`P-MAIL`/`P-SCALE`) do not contradict ARCHITECTURE's ordering — they refine it. **One disagreement is worth naming explicitly:** PITFALLS recommends `P-CONTRACT` (the splice extraction) and `P-PERM` (the visibility schema) as **one wave, not sequential**, "because the visibility column and the splice extraction touch the same rows" (both touch `documents`). ARCHITECTURE's numbered sequence instead sequences the splice extraction (229) strictly before the visibility model (231, in parallel with the adapter contract, 232). **Resolution taken below: keep them as two phases but land them adjacent and reviewed together** — ARCHITECTURE's own migration-numbering table already interleaves them (153 = queue, 154 = visibility, both before 155-158's watch tables), and a single combined migration wave is easy to accept later if execution shows the split is artificial; the reverse (discovering mid-execution that they needed to be split) is more expensive. This is presented as a reconciliation, not as a silent pick of one file over the other.

```
228  v3.9 CLOSEOUT                                    already decided - owed UAT, resume-path bug
                                                       cluster, code-review, app.<domain> move
        |
229  THE SPLICE EXTRACTION                             REFACTOR ONLY - no user-facing capability
     |   ingest_splice.py: mint_document_row() + splice_document(), extracted from
     |   documents.py's _upload_pipeline + /upload row-mint preamble
     |   FIXES the ATTACH-01 storage_path/content_hash/is_latest defect (Defect 1)
     |   discharges the G-5 obligation already owed on documents.py (30 phases / 2535 L)
     |   dependency: none - this is the prerequisite everything else calls
        |
230  THE DURABLE QUEUE                                 mig 153_ingestion_jobs.sql
     |   db/ingest_jobs.py, services/ingest_queue.py, main.py lifespan, INGEST_* env vars
     |   deploy-drift same-commit: docker-compose.prod.yml / onebox.env.example / OPERATOR.md
     |   PROVEN ON /upload FIRST (Ordering Hazard 4) before any adapter uses it
     |   dependency: 229 (the splice it will call)
        |
        +------------------------------+---------------------------------------------
        v                              v
231  VISIBILITY MODEL                232  ADAPTER CONTRACT + GOOGLE DRIVE
     mig 154 - 4-site RLS widening        services/sources/{protocol,registry,hashing,cursor}
     POLICIES FIRST, DEFINER LAST         + drive_adapter.py; retires cloud_storage.py
     (Ordering Hazard 1)                  re-points connectors.py's file-import route
     THREAT MODEL MANDATORY here          Google chosen first: zero new OAuth scopes,
     the UI's plain visibility sentence   two-thirds of the code already exists
     dependency: 229 (same rows touched - land adjacent per PITFALLS' reconciliation above)
        |                              |
        +--------------+---------------+
                       v
                 233  THE PREVIEW / DRY RUN                          no migration
                       list() + mint_document_row(dry_run=True) over a SourceListing
                       Convergent Finding 3: preview == the diff pass, same code
                       Contradiction 1's two-tier identity lands HERE, not assumed earlier
                       dependency: 229 + 232 (cannot exist before either)
                       v
                 234  THE WATCH LOOP + FIRST REAL SYNC
                       migs 155 connector_watches - 156 connector_watch_items -
                            157 documents_source_state
                       the lifecycle diff + the complete=True assertion (Ordering Hazard 5)
                       THIS COMMIT RETIRES THE CLAUDE.md manual-upload-only RULE (SEED-142)
                       THREAT MODEL: untrusted content enters the answered corpus -
                          Pitfall 4's trifecta fence MUST land in this same phase, never after
                       dependency: 229+230+231+232 all four - this is the first phase where a
                       document a human did not place can reach a live customer
                       v
                 235  ONE RULE ENGINE                                 mig 158
                       classification_rules gains rule_scope + SOURCE_FIELDS whitelist
                       Convergent Finding 4 + Ordering Hazard 3's fence must be live before
                       this phase lets a rule touch a connector document
                       dependency: 234 (needs a real corpus + real SourceFile fields to tune against)
        +--------------+--------------+
        v                             v
236  MICROSOFT GRAPH              237  MCP FILE SURFACE
     + graph_read / graph_download      tool binding stored as DATA on the watch row
     egress keys; the 302 dance         (adding a source = a row, not code - the proof
     (STACK sec1) is adapter-internal   that Pitfall 12's fence held)
     if this is not SMALL, 232's
        contract was wrong - and
        THAT is the finding
                       |
                       v
                 238  EMAIL / MAILBOX          A SHAPE PHASE, NOT AN ADAPTER PHASE
                       own discuss-phase; sequenced LAST so 3 families ship if cut
                       the message-vs-thread boundary is UNRESOLVED between STACK and
                       PITFALLS - see Open Questions below; do not silently pick one at
                       this point in a plan, force the decision explicitly in discuss-phase
```

**P-SCALE (pgvector recall hardening) and P-UNTRUSTED's adversarial corpus are cross-cutting, not slotted phases**, per PITFALLS: the recall harness should exist before the first bulk sync (recommended to ride inside 230/234's work, tuning follows in a HARD phase once real corpus growth is observed), and the adversarial-injection corpus is a GA gate that should be built once the trifecta fence (234) exists, not before it.

---

## OPEN QUESTIONS FOR THE ROADMAPPER (not answered here — carried forward as stated)

- **The disconnect policy (retain / freeze / purge)** — `SEED-210`'s explicitly undecided row. PITFALLS offers freeze-by-default as a named opinion (retrieval stops immediately, rows retained for a stated window, "Purge now" / "Reconnect to resume" as two explicit buttons) but states plainly this is an opinion, not a finding, "because silence is the failing option." FEATURES independently recommends the same default but from Microsoft's shipped `Copilot Visibility` toggle as precedent. Both are offered as strong recommendations, not decisions — the roadmapper should treat this as still open.
- **There is no in-app notification surface in this product**, so a broken watch is discovered only by whoever next opens the page. FEATURES names this a real, unresolved dependency gap (TS-8) with three cost-ordered options (Library Health tab signal / email on permanent failure / reuse the approval-checkpoint surface) and explicitly asks that this be named in the roadmap rather than discovered mid-phase.
- **pgvector version parity (local vs cloud) before `hnsw.iterative_scan` can be planned as the `SEED-076` remedy.** PITFALLS flags this must be verified live before being relied on — "local Supabase and cloud Supabase can differ, which is exactly the cloud-parity drift class this project already tracks."
- **Message-vs-thread as the email document boundary.** STACK and PITFALLS independently recommend opposite defaults (message-as-document vs thread-as-document respectively — see Contradiction 3 above) while agreeing on every surrounding fact. This is a genuine unresolved disagreement between two research files, not a gap either one left open, and should be forced as an explicit decision in `P-MAIL`'s discuss-phase rather than silently inherited from whichever file is read last.

---

## Implications for Roadmap

### Phase: The Splice Extraction (build-order slot 229)
**Rationale:** every future producer of a `documents` row calls this. Extracting it while multiple producers already exist (the `/upload` route, the email-attachment cascade) makes a future red test unattributable to one. It is also the one phase with no new user-facing capability, discharging a G-5 hot-file obligation this codebase already owes on `documents.py`.
**Delivers:** `ingest_splice.mint_document_row()` / `splice_document()`; fixes Defect 1 (`ATTACH-01`'s broken row mint) as a side effect.
**Addresses:** the "one ingest splice" binding constraint from PROJECT.md.
**Avoids:** Pitfall 9 (two ingest doors), Pitfall 10 (guarantees that hold at the door people watch, not the door volume comes through), Defect 1 and Defect 2.

### Phase: The Durable Queue (slot 230)
**Rationale:** "nothing is ingested until a person says so" and "cap, retry, resume" are properties only a durable claim table has; a `BackgroundTask` fan-out has none of them, and retrofitting under a live watch means an undrained backlog.
**Delivers:** `ingestion_jobs` table + `IngestQueueService`, proven against the existing `/upload` route before any connector uses it.
**Uses:** the shipped `FOR UPDATE SKIP LOCKED` claim pattern from `db/schedules.py` (Convergent Finding 1).
**Avoids:** Pitfall 6 (first-sync stampede), Pitfall 5's partial-failure-retried-from-scratch and 429/token-expiry rows.

### Phase: Visibility Model + Adapter Contract + Google Drive (slots 231/232, parallel wave, land adjacent per the reconciliation above)
**Rationale:** the moment the first connector document lands, ownership-based RLS stops being sound (the single sentence every security-critical pitfall inherits from). The contract must exist before a preview can be built once, not per-provider. Drive first: zero new OAuth scopes, two-thirds of the code already exists.
**Delivers:** the 4-site RLS widening (`connection_grants_org_visibility`); `services/sources/*` + `drive_adapter.py`; retirement of `cloud_storage.py`'s per-provider branching.
**Implements:** the "watched source is DATA, not code" architecture component; Ordering Hazard 1's policies-first/DEFINER-last sequencing, driven RED before widening.

### Phase: The Preview / Dry Run (slot 233)
**Rationale:** cheap only once `list()` and `mint_document_row`'s three-way verdict both exist — building it earlier means a Drive-shaped preview rewritten three times.
**Delivers:** the milestone's headline differentiator (D-1), implementing Contradiction 1's two-tier identity resolution honestly in the UI copy.
**Addresses:** D-1/D-2/D-3/F-1/F-2/F-3 from FEATURES.md.
**Avoids:** AF-4 (a green verdict hiding that nothing will work).

### Phase: The Watch Loop + First Real Sync (slot 234)
**Rationale:** the first phase where a document a human did not place can reach a live customer — everything above it is a prerequisite, nothing below it can be deferred past it.
**Delivers:** `connector_watches`/`connector_watch_items`/`documents.source_state`; the lifecycle diff with the mandatory `complete=True` assertion (Ordering Hazard 5); retires the `CLAUDE.md` manual-upload-only rule in this same commit (`SEED-142`).
**Addresses:** TS-1 through TS-9, TS-12; LIB-08/09/10.
**Avoids:** Pitfall 4's lethal trifecta (fence must land in this phase, never after), Pitfall 8's lifecycle mishandling, Pitfall 13's `SEED-239` blast-radius risk.

### Phase: One Rule Engine (slot 235)
**Rationale:** needs a real corpus and real `SourceFile` fields to tune a routing rule against.
**Delivers:** `classification_rules.rule_scope` + a `SOURCE_FIELDS` whitelist on the existing `classification_matcher`.
**Avoids:** Pitfall 1 (rules as an unfenced authorization surface) and AF-8 (a second rule engine).

### Phase: Microsoft Graph, then MCP File Surface (slots 236/237)
**Rationale:** each is the test of whether the contract built in 232 actually holds — if either is not small, the contract was wrong, and that is the finding, not a surprise to absorb quietly.
**Delivers:** the `graph_read`/`graph_download` egress keys and the 302 two-step dance; a per-connection MCP tool binding stored as data (proving Pitfall 12's "adding a source adds rows, not code" fence).

### Phase: Email / Mailbox (slot 238, last, its own discuss-phase)
**Rationale:** a shape decision, not an adapter task — sequenced last so three families ship even if this one is cut.
**Delivers:** `mail_adapter.py` over the existing `email_extraction_service`, plus a forced resolution of the message-vs-thread boundary (currently unresolved between two research files — see Open Questions).
**Avoids:** Pitfall 11 (dedup/retrieval poisoning via quoted-reply duplication and unstable document boundaries), Anti-Pattern 5 (treating email as a fourth ordinary adapter).

### Phase Ordering Rationale

- Dependencies are schema-driven, not feature-driven: 229 and 230/231 all touch `documents` and must exist before any row a human didn't place can be written.
- The security-critical pitfalls (1-4) are architectural, not hardening — they must be designed into the phases that first let a machine write into the corpus (231/234), not retrofitted after.
- The two-adapter proof point (232 then 236/237) is a deliberate check on the milestone's own binding constraint — if adapters 2 and 3 are not small, that is itself a roadmap-level finding requiring a stop, per Pitfall 12.
- Email is ordered last specifically so a scope cut costs no architecture (STACK's explicit finding: "the byte contract is identical when it comes back").

### Research Flags

Phases likely needing deeper research during planning:
- **Slot 231 (Visibility Model):** the RLS four-site interaction with the existing folder-sharing model is genuinely novel territory for this codebase — Pitfall 1's fence needs a concrete "narrower of two" predicate design, not just the disjunct sketched in ARCHITECTURE.
- **Slot 234 (Watch Loop + first sync):** the mandatory threat-model / adversarial-corpus work (Pitfall 4) needs its own research pass — this is a security design problem, not a feature-build one.
- **Slot 236 (Microsoft Graph):** two facts are explicitly marked MEDIUM confidence and unverified against a live tenant — `driveItem.file.hashes` member availability (`quickXorHash` vs `sha1Hash`/`sha256Hash`), and whether `Files.Read.All`/`Sites.Read.All` self-consent actually works in a typical enterprise tenant vs requiring admin approval.
- **Slot 238 (Email):** the message-vs-thread decision is unresolved between two research files (Open Questions) and needs its own discuss-phase before planning.

Phases with standard, well-documented patterns (skip research-phase):
- **Slot 229 (Splice extraction):** pure refactor of code already read at file:line; no external unknowns.
- **Slot 230 (Durable queue):** the pattern is already shipped and running in this exact codebase (`db/schedules.py`); this is a copy, not a design.
- **Slot 232 (Drive adapter):** two-thirds of the code already exists in `cloud_storage.py`; zero new OAuth scopes.
- **Slot 235 (Rule engine scope):** a scope discriminator on an existing, well-understood matcher.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | every recommendation grounded in a file:line read at HEAD plus a live PyPI/vendor-doc version check on 2026-09-04; two items explicitly flagged MEDIUM (Graph hash-member availability, Gemini embedding batch limits — not published) |
| Features | HIGH on Onyx + Microsoft (source/docs read directly); MEDIUM-HIGH on Glean; MEDIUM on Dash/Notion/NotebookLM/Slack (help-centre pages only); explicitly LOW on LlamaCloud (stated as an unfilled gap, not guessed) |
| Architecture | HIGH — every integration point read from source at HEAD with line numbers; four items explicitly marked UNVERIFIED (the `storage_path` runtime failure mode, Drive shared-drive invisibility consequence, which `search_documents` callers pass user-scoped vs service-role clients, and whether any Graph/delta code exists anywhere untraversed) |
| Pitfalls | HIGH on repo-grounded pitfalls and disclosed security incidents (named CVEs/advisories); MEDIUM on provider-API sync edge cases (official docs, not reproduced); explicitly LOW/inference-marked on three items (the attachment dedup-collision consequence, the P-MAIL v1 boundary recommendation, the freeze-on-disconnect recommendation) |

**Overall confidence:** HIGH. The unusual strength of this research set is that nearly every claim is anchored to a specific file:line in this repository rather than to general best practice — which is also why the two genuine contradictions found (Contradictions 1 and 2) are trustworthy: they were found by *measuring against the actual schema and actual API limits*, not by disagreement of opinion.

### Gaps to Address

- **The message-vs-thread email boundary** — genuinely unresolved between STACK and PITFALLS (see Open Questions). Force this as an explicit decision in `P-MAIL`'s discuss-phase; do not let a plan silently inherit one file's recommendation.
- **The disconnect policy (retain/freeze/purge)** — `SEED-210`'s explicitly undecided row; two files offer freeze-by-default as an opinion, not a finding. Needs an explicit operator decision at scoping for slot 234/238, not an inherited default.
- **Whether `import_connection_file`'s broken row-mint has actually ever succeeded in production** — schema mismatch is verified; the runtime error mode (`PGRST204` vs `23502`) is not driven. Worth a quick check before slot 229 is planned around it as "this route currently does nothing."
- **Whether Drive shared-drive items are actually invisible today** — the absence of `supportsAllDrives`/`corpora`/`includeItemsFromAllDrives` from the current Drive list call is verified; the consequence (shared-drive items missing from every existing Drive-touching feature) is inferred, not driven.
- **Local vs cloud pgvector version parity** — must be verified live before `hnsw.iterative_scan` is planned as the `SEED-076` remedy in any `P-SCALE` phase.
- **No in-app notification surface exists** — TS-8's three candidate homes (Health tab / email / approval-checkpoint reuse) are options, not a decision; needs to be named explicitly in the roadmap rather than discovered mid-phase.

## Sources

### Primary (HIGH confidence — read directly at HEAD 2026-09-04, or official docs)
- `backend/app/api/documents.py`, `backend/app/api/connectors.py`, `backend/app/services/cloud_storage.py`, `backend/app/services/email_extraction_service.py`, `backend/app/db/schedules.py`, `backend/app/services/scheduler_service.py`, `backend/app/security/egress.py`, `backend/app/services/mcp_client.py`, `backend/app/services/oauth_service.py`, `backend/app/services/retrieval_service.py`, `backend/app/services/classification_matcher.py`, `supabase/full-schema.sql`, `supabase/migrations/*` — this repository, all four research files
- Live PyPI JSON API version checks (2026-09-04): `msgraph-sdk` 1.62.0, `google-api-python-client` 2.200.0, `arq` 0.28.0, `celery` 5.6.3, `pgqueuer` 1.3.2, `tembo-pgmq-python` 0.10.0, `talon` 1.4.4, and others — STACK.md
- driveItem: get content (learn.microsoft.com/en-us/graph/api/driveitem-get-content), Delta query overview (learn.microsoft.com/en-us/graph/delta-query-overview), OpenAI embeddings API reference (developers.openai.com/api/reference/resources/embeddings/methods/create), Search for files / Drive v3 (developers.google.com/workspace/drive/api/guides/search-files) — STACK.md
- github.com/onyx-dot-app/onyx source (interfaces.py, README) and github.com/onyx-dot-app/onyx/issues/1161 — FEATURES.md
- learn.microsoft.com/.../copilot/connectors/manage-connector, manage-access-permissions — FEATURES.md
- EchoLeak CVE-2025-32711 (hackthebox.com/blog/cve-2025-32711-echoleak-copilot-vulnerability), AgentFlayer (labs.zenity.io/p/agentflayer-chatgpt-connectors-0click-attack-5b41), ShadowLeak (thehackernews.com/2025/09/shadowleak-zero-click-flaw-leaks-gmail.html), GitHub MCP exfiltration (invariantlabs.ai/blog/mcp-github-vulnerability), the lethal trifecta / Simon Willison (simonwillison.net/2025/Jun/16/the-lethal-trifecta/) — PITFALLS.md
- Google Drive issue 406305173 — empty page with non-null nextPageToken (issuetracker.google.com/issues/406305173) — PITFALLS.md

### Secondary (MEDIUM confidence)
- docs.glean.com/*, help.dropbox.com/learn.dropbox.com, notion.com/help/notion-ai-connectors, slack.com/features/enterprise-search, workspaceupdates.googleblog.com (NotebookLM) — FEATURES.md
- Microsoft 365 Copilot best practices with SharePoint (learn.microsoft.com/en-us/sharepoint/sharepoint-copilot-best-practices), pgvector 0.8 iterative scans / Nile (thenile.dev/blog/pgvector-080), Embeddings in production costs / Barnacle Labs (medium.com/barnacle-labs/embeddings-in-production-or-how-nothing-scales-like-youd-expect-it-to-part-1-costs-to-embed-a82482765215) — PITFALLS.md
- Graph driveItem.file.hashes member availability, Gemini embedding batch-size limits (not published) — STACK.md, explicitly flagged MEDIUM

### Tertiary (LOW confidence, needs validation)
- LlamaCloud connector sync semantics — FEATURES.md states plainly this could not be verified and makes no claim beyond LlamaCloud's existence
- The identical-attachment dedup-collision consequence in Pitfall 9; the P-MAIL v1 boundary recommendation; the freeze-on-disconnect recommendation — all three explicitly marked as inference/opinion in PITFALLS.md, not measured findings

---
*Research completed: 2026-09-04*
*Ready for roadmap: yes*

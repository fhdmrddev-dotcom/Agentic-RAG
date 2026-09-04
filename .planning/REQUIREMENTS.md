# Requirements — Milestone v4.0 Connected Knowledge

**Defined:** 2026-09-04 · **Phases:** continue at 228 · **Research:** `.planning/research/SUMMARY.md` (committed `79fdda06b`)

**Milestone goal:** The knowledge base stops depending on somebody remembering to upload — a source is
connected **once**, previewed before it brings anything in, and then watched on the **shipped**
scheduler, safely and at a customer's scale.

⚠ **`LIB-08` / `LIB-09` / `LIB-10` appear in this file for the FIRST time.** They were written into the
v3.9 ROADMAP as a phase heading and never into a requirements file, which is why no coverage check
could ever see them. That is the same gap recorded for `LIB-05..07`. They are carried here verbatim in
intent from the deferred Phase 219, **with `LIB-09` amended** — see the decision log below.

---

## Decisions taken at requirements scoping (2026-09-04, operator)

Four decisions were forced by research. Three of them **contradict** what `PROJECT.md` asserted at
intake; the originals are quoted rather than overwritten, because the contradiction being found is the
finding.

| # | `PROJECT.md` said | Research measured | **Decision** |
|---|---|---|---|
| D-1 | The preview's *"already here"* bucket is *"a `content_hash` lookup, not a guess"* | **False for a list-only pass.** `documents.py:620` hashes raw BYTES (needs a download — the thing the preview exists to avoid); Drive has **no** hash for native Docs/Sheets/Slides; Graph guarantees only `quickXorHash` and populates hashes **after** download. Reached independently by STACK and FEATURES. | ⭐ **Two-tier identity + honest labels + a FOURTH bucket.** Tier 1 (list-only): `(source_system, external_id, source_version)` compared for equality, **never called a hash**. Tier 2: the existing `sha256` dedupe still runs at splice. Bucket relabelled *"Already here (matched by source file, not by content)"*, plus *"Can't tell without reading it"*. |
| D-2 | `SEED-048` folds as *"embedding-provider fallback"* | **Unsafe as stated.** `document_chunks.embedding` is `vector(N)` with one global `N`; matching the DIMENSION does not make vector SPACES compatible. A half-OpenAI/half-Gemini corpus **degrades recall silently with green status everywhere** — on the milestone whose own requirement is recall at corpus scale. | ⭐ **Same-space fallback only.** (1) retry same endpoint with backoff/jitter on 429/5xx; (2) fail over to a different credential/endpoint for the **same model**; (3) trip `circuit_breaker.py` and **pause the queue** with a named, user-visible refusal. A cross-provider swap stays the existing corpus-wide re-embed job — **never** an automatic mid-corpus substitution. |
| D-3 | Email is *"a second SHAPE smuggled in as a fourth provider"* | **Over-stated about the code.** ~80% already ships: `strip_quoted_replies()` runs before chunking; attachments-as-children ship with caps; Gmail and Graph both land on one `parse_eml_bytes()`. PITFALLS agrees the manifestation is dedup/retrieval poisoning, not a broken adapter. Both files agree mail goes **last**; they **disagree** on the boundary. | ⭐ **One message = one document; `thread_key` groups.** This finally READS `message_id` / `in_reply_to` / `references`, which ship parsed and consumed by nothing (a v3.8 audit finding). Safe because `strip_quoted_replies` already runs before chunking, so the poisoning that motivates thread-as-document is already mitigated. **The intake warning is SOFTENED, not withdrawn** — mail is still sequenced last, as its own phase. |
| D-4 | `SEED-210` left the disconnect policy **explicitly undecided** — *"the moment a user most expects their data to stop being used, and the moment an implementation is most likely to leave it in place"* | Microsoft ships the freeze shape as precedent (a Copilot Visibility toggle: *"it can still crawl … but the data isn't used for search results"*) | ⭐ **Freeze by default.** Documents stay but are **excluded from retrieval**, the state is visible, and two named actions exist: **Purge now** and **Reconnect**. Reversible; never destroys knowledge on an accidental or token-expiry disconnect. |

**D-5 — two shipped defects are FOLDED, not scoped separately** (orchestrator call, stated for the
record): `connectors.py:1693` (`ATTACH-01` mints a `documents` row with a `storage_path` key against a
table that has no such column and a `NOT NULL file_path`, omitting `content_hash` / `folder_id` /
`version_number` / `is_latest` — **VERIFIED by schema read; the runtime error is UNVERIFIED**, meaning
that import has probably never written a row) and the Phase 203 attachment cascade
(`documents.py:2380-2444` inserts with no dedup check inside a blanket `except Exception: log.warning`).
Both are fixed as a **side effect** of `TRUST-01`, which is the first build slot. They are the concrete
evidence for why that extraction must precede any new adapter.

---

## v4.0 Requirements

### Watched sources — the carried Phase 219 core

- [ ] **LIB-08**: A person maps a folder from a connected source to a Library folder, and it is checked on a schedule — using the **shipped** scheduler (`scheduler_service.py` / `claim_due_schedules`), never a new one.
- [ ] **LIB-09**: Before the first import, a person sees what it **would** add — and **nothing is ingested until they confirm**. ⚠ **AMENDED at scoping (D-1):** the split is **four** buckets, not three, and the second is *"Already here (matched by source file, not by content)"* rather than a `content_hash` claim the preview structurally cannot make.
- [ ] **LIB-10**: A source that has stopped reading **says so**, says **when** it stopped, and offers **the one action** that fixes it. It is never silently quiet.

### The source contract — one contract, thin adapters

- [ ] **SRC-01**: Every source family implements ONE adapter contract (`browse` / `list` / `read` / `check`). Adding a family adds an **adapter**, not an ingest path. Provider specifics (pagination cursors, Graph drive/site ids, Drive shared-drive vs my-drive, MCP tool-name variance) stay behind that boundary.
- [ ] **SRC-02**: A person watches a **Google Drive** folder. (No new OAuth scope — `drive.readonly` is already granted.)
- [ ] **SRC-03**: A person watches a **OneDrive or SharePoint** folder via Microsoft Graph. ⚠ Graph `/content` returns a **302** and `egress.py` refuses redirects by design — the adapter must `$select=@microsoft.graph.downloadUrl` and make a second pinned call to a different host with its own egress key. The redirect must **not** leak into the shared contract.
- [ ] **SRC-04**: A person watches a folder exposed by **any connected MCP server** with a file surface.
- [ ] **SRC-05**: A person watches a **mailbox**. **One message = one document**, with `thread_key` stored as a retrieval-grouping column (D-3).
- [ ] **SRC-06**: A `missing` verdict may be written **only** from a listing whose final page asserted completeness. An incomplete listing (a 429 mid-pagination; Drive's empty-page-with-non-null-`nextPageToken`) can **never** mark a corpus deleted.

### The preview — the milestone's differentiator

- [ ] **PREV-01**: The preview shows four honestly-labelled buckets: *will be added* · *already here (matched by source file, not by content)* · *type not supported* · *can't tell without reading it*.
- [ ] **PREV-02**: Identity is two-tier — a cheap `(source_system, external_id, source_version)` key at preview time; the existing `sha256` dedupe still runs at splice time (D-1).
- [ ] **PREV-03**: The preview evaluates routing rules and **writes nothing** — a person sees where files would land before any row exists.

### Visibility and lifecycle — the inbound envelope

- [ ] **VIS-01**: Everything ingested through one connection inherits ONE visibility, enforced in **RLS** at all four sites (the `documents` and `document_chunks` policies **and** the bodies of `match_document_chunks` and `keyword_search_chunks`) — not in application code.
- [ ] **VIS-02**: The UI states the visibility scope **plainly, in this product's own terms**, wherever a connection is configured. Silence is not an option the milestone allows.
- [ ] **VIS-03**: A file removed at the source is **NOT** removed from the Library unless explicitly asked for. A revoked share never silently deletes knowledge the agent depends on.
- [ ] **VIS-04**: Each remaining source lifecycle event — unshared, moved, modified — has a defined and observable outcome.
- [ ] **VIS-05**: Disconnecting a connection **freezes** its documents: they remain, are **excluded from retrieval**, the state is visible, and **Purge now** and **Reconnect** are named actions (D-4).
- [ ] **VIS-06**: A routing rule that would **widen** a document's visibility produces a **suggestion requiring human accept**, never an automatic move. ⚠ In this schema visibility is a property of the **folder**, so the rules engine is an access-control surface.

### Ingest at scale

- [ ] **QUEUE-01**: Ingestion runs through a durable queue with **cap, retry and resume** — replacing the in-process `BackgroundTask` — reusing the shipped `FOR UPDATE SKIP LOCKED` claim pattern and adding **no broker and no new process**.
- [ ] **QUEUE-02**: The queue's correctness is proven against the existing `/upload` route **before** any connector uses it.
- [ ] **QUEUE-03**: Two runs of the same watched source never overlap — a poll slower than its interval does not run concurrently with itself.
- [ ] **QUEUE-04**: Embedding calls are batched within real provider limits (OpenAI: 2048 inputs · 8192 tokens per input · **300,000 tokens per request** — the token ceiling is the one a naive batcher misses).
- [ ] **QUEUE-05**: An embedding failure retries the same endpoint, then fails over to a **same-vector-space** alternate endpoint, then trips the breaker and **pauses the queue with a named, user-visible refusal**. No automatic cross-provider substitution (D-2). Closes `BUG-260815-05`, where a 429 surfaced as *"your documents returned nothing"*.
- [ ] **QUEUE-06**: Filtered vector search still returns the right chunks as the corpus grows to customer scale.

### Trust — what enters is untrusted

- [ ] **TRUST-01**: There is **ONE ingest splice**. Every producer — `/upload`, connector attach, watched sync, the email cascade — mints its document row through it. (Fixes D-5's two shipped defects as a side effect.)
- [ ] **TRUST-02**: The written anti-prompt-injection discipline is **actually attacked** by an adversarial corpus suite that fails when a defence is removed.
- [ ] **TRUST-03**: Write-capable connector tools are fenced out of turns whose retrieval set contains connection-sourced content — built on the shipped approval checkpoint, inventing nothing.
- [ ] **TRUST-04**: A document carries whether it was **machine-placed** and from which connection, and that fact is visible at retrieval and citation time.

### One rule engine, not two

- [ ] **RULES-01**: Watch-routing rules and classification rules share ONE AST and ONE matcher, discriminated by scope — because a watch rule at preview time has only `name` / `mime` / `path` / `size`, while a classification rule matches extracted metadata that exists only after extraction.
- [ ] **RULES-02**: Source facts (source system, external path, site/library, sender) become **first-class filterable fields**, so a rule and a saved View can both use them.

### An honest surface

- [ ] **SURF-01**: The screen says **"checked every N minutes"** — never *"instantly"* or *"on change"*. There is no delta cursor and no webhook; when one lands, the sentence changes in the same commit.
- [ ] **SURF-02**: A person can see what a sync **actually did** — a per-source run history with counts and errors.
- [ ] **SURF-03**: A broken watch reaches a person who is not already looking at the page. ⚠ **There is no in-app notification surface in this product** — this requirement names that gap rather than assuming one exists.

### v3.9 closeout — the debt gets a phase number

- [ ] **DEBT-01**: v3.9's owed verification is driven or explicitly re-deferred with a reason: Phase 210's 4 undriven SC, Phase 211's UAT + schema regeneration, Phase 214's eight-row cross-provider roster and eight G-4 operator drives, Phase 217's 16 UAT rows.
- [ ] **DEBT-02**: The resume-path bug cluster is **triaged together** — `BUG-260818-01/02/03` and `BUG-260823-02/03/04`. A user today cannot tell Resume from Continue, and fixing one leaves the moment still lying.
- [ ] **DEBT-03**: `/code-review ultra review-base-225` runs on the OAuth state rework (skipped at Phase 225 only because credits were exhausted).
- [ ] **DEBT-04**: The product serves from `app.<domain>` with the landing at the root — seven steps across Vercel / Coolify / Supabase Auth / CORS, **verified on a preview before promoting** (`SEED-242`).
- [ ] **DEBT-05**: The backend unit baseline is re-derived honestly and can gate again. `pytest tests/unit -q --continue-on-collection-errors` reads **95 failed / 3394 passed / 2 errors**; the `71` quoted all through v3.9 was measured over a different set.

---

## Future Requirements (deferred, triggers intact)

| Item | Trigger to re-open |
|---|---|
| **Meeting transcripts as an event-shaped source** (`SEED-212`) | Any Teams / Zoom / Meet / transcription connector is proposed; **or** a user asks the knowledge base what was decided in a meeting; **or** chunking is revisited for any non-page-shaped source. |
| **Per-document ACL mirroring / metadata-derived permissions — the M-Files model** (`SEED-211`) | Connection-scoped visibility is **measured** insufficient by a real tenant. The fork is DECIDED and a migration path recorded this milestone; only the BUILD is deferred. ⚠ Corroborated as a reasonable deferral: per-doc ACL mirroring is enterprise-only and connector-allowlisted even in Onyx. |
| **Delta / change-notification sync** (webhooks, `startPageToken`, Graph delta) | Polling is measured too slow or too expensive by a real customer. ⚠ `SURF-01`'s sentence changes **in the same commit**. Costs are real: Outlook delta tokens have no fixed expiry, `410 Gone` forces a full resync, and replays are documented — every property a delta needs, polling needs anyway. |
| **Inbound / Open Platform** — public REST API, webhooks, service accounts, us-as-an-MCP-server (`SEED-013`, `SEED-195`) | Its own milestone. Naming coincidence with v3.9's "Connections", not a scope argument. |
| **Structure-aware chunking** (`SEED-060`) and **Documents-space redesign** (`SEED-224`) | Folded into this milestone's seed list but **not** given requirements — they ride whichever phase touches their surface, or return here. |
| **PII / DLP redaction** (`SEED-079`) beyond `TRUST-04`'s provenance marking | A regulated customer or the co-tenant SaaS tier exists. |
| **Data-subject rights / erasure export** (`SEED-072`) beyond `VIS-05`'s purge | An EU customer or co-tenant exists. `VIS-05` answers only the disconnect row. |

---

## Out of Scope (explicit exclusions, with reasoning)

| Excluded | Why |
|---|---|
| **Automatic deletion of Library documents when a file disappears at the source** | Evidenced as harmful, not merely disfavoured. Microsoft removes items not rediscovered for 28 days *in the same sentence that concedes the cause may be connection failure*; Onyx issue #1161 records a web connector with no internet logging `removed 976 docs that were detected as deleted in the source` and emptying the knowledge base — **closed as not planned**. Google Drive's empty-page-with-non-null-`nextPageToken` tracker issue is the concrete mechanism here. `VIS-03` + `SRC-06` are the fences. |
| **Automatic cross-provider embedding substitution** | D-2. One global `vector(N)`; different vector spaces; silently degraded recall with green status everywhere. |
| **Building the M-Files metadata-derived permission model** | D-4 of the intake decisions — decided and recorded with a migration path, deliberately not built. Retrofitting is a re-ingest, not a migration, which is why the DECISION could not wait even though the BUILD can. |
| **Real-time / webhook sync, and the words "instantly" and "on change"** | No delta cursor and no webhook exists. `SURF-01` forbids the wording, not just the feature. |
| **A second scheduler** | `LIB-08` requires the shipped one. A second scheduler re-litigates a solved split-brain problem. |
| **A separate always-on worker process or a message broker** | `QUEUE-01`. Every broker option adds a compose service that `check-deploy-drift.sh` hard-fails on; pgmq puts job bodies outside RLS and into the local↔cloud parity path. |
| **Any new Python package** | Research found all six axes resolve to primitives already at HEAD. A new dependency is a finding to raise, not a default. |
| **OCR and full-page vision** | Unchanged from `SEED-226`; reaching for either means something stopped being what it said it was. |

---

## Traceability

**Filled by the roadmapper 2026-09-04** against `.planning/ROADMAP.md` → *v4.0 Connected Knowledge —
ACTIVE*. **38 REQ-IDs · 38 mapped · 0 orphans · 0 duplicates.**

⚠ **The count is 38, not the 34 quoted at intake.** LIB 3 · SRC 6 · PREV 3 · VIS 6 · QUEUE 6 ·
TRUST 4 · RULES 2 · SURF 3 · DEBT 5. `38 − 5 DEBT = 33`, which is probably where *34* came from. The
intake figure is recorded rather than overwritten, because a coverage check run against the wrong
denominator is exactly how `LIB-08/09/10` survived an entire milestone living only in a heading.

| REQ-ID | Phase | Status | Note |
|---|---|---|---|
| LIB-08 | 234 | Pending | The watch loop, on the **shipped** scheduler |
| LIB-09 | 233 | Pending | Amended by D-1 — four buckets, not three |
| LIB-10 | 235 | Pending | |
| SRC-01 | 232 | Pending | The contract; **measured** at 238 and 239 |
| SRC-02 | 232 | Pending | No new OAuth scope |
| SRC-03 | 238 | Pending | ⚠ Graph 302 / `downloadUrl` stays adapter-internal |
| SRC-04 | 239 | Pending | Adding a source adds **rows, not code** |
| SRC-05 | 240 | Pending | Shape phase, own discuss-phase, sequenced last |
| SRC-06 | 234 | Pending | ⚠ **H-5** — structural, same plan as the diff |
| PREV-01 | 233 | Pending | ⚠ **G-2 sketch mandatory** |
| PREV-02 | 233 | Pending | D-1's two-tier identity |
| PREV-03 | 233 | Pending | The preview writes nothing |
| VIS-01 | 231 | Pending | ⚠ **H-1** — policies first, DEFINER bodies last, one transaction |
| VIS-02 | 231 | Pending | ⚠ **G-2 sketch** — the sentence is the deliverable |
| VIS-03 | 234 | Pending | Absence never deletes |
| VIS-04 | 234 | Pending | |
| VIS-05 | 234 | Pending | ⚠ **Not 235** — freeze is retrieval-affecting and security-bearing (D-4) |
| VIS-06 | 234 | Pending | ⚠ **H-4, MEASURED** — rule eval lives inside `ingest_document` (`documents.py:2483`), so 234 is the phase where connector documents first reach the rules engine, not 237 |
| QUEUE-01 | 230 | Pending | |
| QUEUE-02 | 230 | Pending | ⚠ **H-3** — proven on `/upload` first |
| QUEUE-03 | 234 | Pending | ⚠ **Not 230** — it is a watch lease; nothing to overlap until a watch exists |
| QUEUE-04 | 230 | Pending | The 300,000-token-per-request ceiling is the one a naive batcher misses |
| QUEUE-05 | 230 | Pending | D-2 — same-vector-space fallback only; closes ⛔ `BUG-260815-05` |
| QUEUE-06 | 241 | Pending | Harness ships at **230**; tuning and verdict here |
| TRUST-01 | 229 | Pending | ⚠ **H-2** — precedes every adapter; fixes D-5's two shipped defects |
| TRUST-02 | 236 | Pending | GA gate; ⚠ full 8-row native roster |
| TRUST-03 | 234 | Pending | Pitfall 4's trifecta fence — same phase as the first sync, never after |
| TRUST-04 | 231 | Pending | Provenance from the first row, not retrofitted |
| RULES-01 | 237 | Pending | One AST, one matcher, scope discriminator |
| RULES-02 | 237 | Pending | Source facts as first-class filterable fields |
| SURF-01 | 234 | Pending | *"checked every N minutes"* — never *"instantly"* |
| SURF-02 | 235 | Pending | ⚠ **G-2 sketch** |
| SURF-03 | 235 | Pending | ⚠⚠ **Home is an OPEN SCOPING DECISION** — there is no in-app notification surface in this product. Forced at 235's discuss-phase; recommendation is an app-shell signal **plus** the Health-tab row. **Closing it against the Health tab alone does not satisfy the requirement.** |
| DEBT-01 | 228 | Pending | Owed v3.9 verification — driven or re-deferred with a reason |
| DEBT-02 | 228 | Pending | Resume-path cluster **triaged together** |
| DEBT-03 | 228 | Pending | `/code-review ultra review-base-225` |
| DEBT-04 | 228 | Pending | ⚠ **Gated on a production push — may be driven OUT OF ORDER**, recorded against 228 wherever it lands (`SEED-242`) |
| DEBT-05 | 228 | Pending | The baseline must state the command **and** its flag |

**Per-phase totals:** 228 → 5 · 229 → 1 · 230 → 4 · 231 → 3 · 232 → 2 · 233 → 4 · 234 → 9 · 235 → 3 ·
236 → 1 · 237 → 2 · 238 → 1 · 239 → 1 · 240 → 1 · 241 → 1. **Sum = 38.**

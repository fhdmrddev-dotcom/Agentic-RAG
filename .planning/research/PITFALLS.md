# Pitfalls Research

**Domain:** Adding **scheduled, permission-aware, multi-source ingestion** (Google Drive · OneDrive/SharePoint · MCP file surface · mailbox) to an **existing, production, manual-upload-only** enterprise RAG platform with an ownership/org-scoped RLS model, a shipped outbound connector platform (OAuth + MCP + per-tool grants + approval checkpoint + audit receipts), and a shipped workflow scheduler.
**Milestone:** v4.0 Connected Knowledge · **Researched:** 2026-09-04
**Confidence:** **HIGH** on the repo-grounded pitfalls (read from `backend/app/api/documents.py`, `backend/app/db/schedules.py`, `backend/app/services/scheduler_service.py`, `supabase/full-schema.sql` on this date) · **HIGH** on the disclosed security incidents (named CVEs / vendor advisories / researcher writeups) · **MEDIUM** on provider-API sync edge cases (official docs + vendor Q&A, not reproduced here) · **LOW / marked inline** where a claim is inference rather than a documented case.

> **Framing — read this before using the list.** This milestone is not building a RAG pipeline. Chunking, embedding, pgvector retrieval, versioning, classification rules, folders, views, relationships, RLS, the scheduler, OAuth, MCP, per-tool grants and the approval checkpoint **all already exist and are trusted**. The entire risk surface is the **seam**: a second door into a corpus that has only ever had one door, opened by a machine instead of a person, on a clock, from sources this system does not own.
>
> ⭐ **The single most important sentence in this document** is `SEED-210`'s, and it is repeated here because every pitfall below inherits from it: *until now, every document in the corpus was deliberately placed by a person who could already read it — which is what made ownership-based RLS sound.* **The commit that retires the manual-upload-only rule retires that guarantee.** Pitfalls 1–5 are all downstream of that one fact.
>
> ⚠ **The permission model is DECIDED and is NOT re-litigated here.** Connection-scoped visibility (`SEED-210` Option 3) is the shipped v1. What follows is **how that decision bites**, so each bite can be fenced explicitly rather than discovered by a customer.

## Phase-slot legend

Phase numbers for this milestone are not assigned yet (numbering resumes at **228**, and **228 is the v3.9 closeout** per `PROJECT.md`). Every pitfall below names a **slot**, and the roadmapper maps slots → numbers. `ARCH` = must be decided in the phase that writes the first line of schema; `HARD` = hardening, can follow the build.

| Slot | Working name | Kind | Why it exists as a separate slot |
|---|---|---|---|
| `P-CONTRACT` | The source contract + **one ingest door** | **ARCH** | `list → read → hash → splice` as data, not code; and the retrofit of the existing upload path onto it |
| `P-PERM` | Inbound permission envelope | **ARCH** | connection-scoped visibility, its schema, and the fences below |
| `P-QUEUE` | Durable ingestion job queue | **ARCH** | `SEED-077` — nothing survives a restart today |
| `P-WATCH` | The watch loop, preview, source-health surface | build | binds to the **shipped** scheduler; owns the honest sentences |
| `P-LIFECYCLE` | Deletion / revocation / retention / disconnect policy | **ARCH decision, build in-phase** | `SEED-210`'s undecided row + `SEED-072` |
| `P-UNTRUSTED` | Threat model + adversarial corpus | **ARCH fence + HARD suite** | `SEED-188`; the fence is architectural, the corpus is hardening |
| `P-RULES` | One rule engine (watch routing × classification) | build | `SEED-209` / `SEED-243` |
| `P-MAIL` | Mailbox as a **shape** | build, **last** | the known shape-risk stated at intake |
| `P-SCALE` | Recall + corpus-scale hardening | **HARD** | `SEED-076`, `SEED-048`, `SEED-197` |

---

## Critical Pitfalls

### Pitfall 1: Connection-scoped visibility is silently widened by *folder placement* — and the rules engine is the thing that widens it

**What goes wrong:**
The decision is "everything from one connection inherits ONE visibility." But in this codebase **visibility is not a property of a document — it is a property of the folder the document lands in.** Measured in `supabase/full-schema.sql:5452`, the SELECT policy on `public.documents` is:

```
(org_id IN current_user_org_ids()) AND ( auth.uid() = user_id
                                         OR (folder_id IS NOT NULL AND folder_is_org_shared(folder_id)) )
```

So a synced document placed into an **org-shared folder** is readable by every member of the org, regardless of what the connection's stated visibility said. And `SEED-209`'s binding rule — connector documents must route through the classification splice — means a **rule can move a document into a folder**, i.e. the routing engine is an access-control surface wearing the costume of a filing cabinet. A rule reading *"anything from the DMT SharePoint library → Programme Docs"* is, in this schema, also an authorization grant.

**Why it happens:** The two subsystems were designed under different assumptions. Folder sharing (v3.4) assumed a human chose to share a folder they owned. Classification rules (Phase 118) assumed placement was a filing convenience with a human Accept step. Neither assumed a machine placing ten thousand documents an hour.

**How to avoid (concrete):**
1. Make visibility a **stored fact on the document, sourced from the connection** (e.g. `documents.source_connection_id` plus a visibility derived at insert), and make the SELECT policy read **the narrower of** folder-derived and connection-derived visibility. Never the union.
2. **Refuse the widening move rather than silently performing it:** a classification rule whose target folder is org-shared must not apply to a document whose connection visibility is private — it produces a *suggestion the human must accept* (Phase 118 already ships exactly this concept: a `_classification` suggestion plus an explicit Accept), never an auto-move.
3. State it in the UI at connect time, in the same sentence as the visibility: *"Files from this connection are visible to you only. Filing rules cannot make them visible to more people."*

**Warning signs:** a synced document appears in another user's search results; a `classification.apply` audit row whose target folder is org-shared and whose document has a `source_connection_id`; the phrase "we'll just reuse folder sharing" in a plan.

**Phase to address:** `P-PERM` (**ARCH** — a schema + policy decision), with the refusal in `P-RULES`.

---

### Pitfall 2: "Connection-scoped" answers *who may read the corpus* and not *whose corpus this is* — the connecting user becomes an unintentional gateway

**What goes wrong:**
Under Option 3, everything a connection ingests inherits the **connecting user's** visibility. The connecting user is typically an admin or a power user, and their Drive/SharePoint access is usually the *widest* in the org. The result is the inverse of the Copilot problem rather than a fix for it: instead of over-broad retrieval, you get **an index built from one privileged person's view of the world, then answered on that person's behalf** — including in unattended, scheduled workflow runs launched under their `user_id` (`scheduler_service.launch_scheduled_run` explicitly stamps runs with the schedule owner, which is correct for isolation and is exactly what makes this concentration possible).

This is the documented Microsoft failure mode with the polarity flipped. Copilot returns only what the *asking* user can already open, and organisations still found that catastrophic — Concentric AI's figure of ~16% of business-critical data being overshared, ~802,000 exposed files per organisation, is the number the whole "prepare SharePoint before you enable Copilot" industry grew around ([Microsoft's own guidance](https://learn.microsoft.com/en-us/sharepoint/sharepoint-copilot-best-practices), [Petri](https://petri.com/copilot-didnt-overshare-your-data-your-permissions-did/)). ⚠ **Under connection-scoped visibility we do not even have Copilot's protection**, because retrieval is not re-checked against the asking user's source-side rights at all.

**Why it happens:** Option 3 is chosen (correctly) to cap the access-control surface. The failure is not in the choice; it is in not *naming* the resulting concentration, and in letting the connecting user be an org admin by default.

**How to avoid:**
- Record the **connecting principal** on every ingested row and show it in the Library (`Synced by Alice from Finance Drive`) — provenance as a first-class field is already `SEED-209`'s ask.
- **Cap the blast radius at connect time**, not at query time: the preview (already in scope) must state *how many files* and *from which folder tree*, and a connection must be scoped to a folder/site/label — never "the whole drive" — in v1.
- Make the org-shared case an **explicit, separate act**: connecting is private-by-default; making a connection's corpus org-visible is a second, audited decision with a named consequence sentence.
- Write the migration path to `SEED-211` (metadata-derived permissions) into the schema **now** — a nullable `source_principals jsonb` column that nothing reads yet costs nothing and turns the later model into a backfill instead of a re-ingest.

**Warning signs:** the connect flow has no folder picker; the preview says "12,431 files" and offers only OK; a security questionnaire asks "whose permissions decide what the assistant can quote?" and the answer needs a paragraph.

**Phase to address:** `P-PERM` (**ARCH**).

---

### Pitfall 3: Retrieval leaks *substance* without leaking *identity* — so the ordinary audit ("who opened this file?") cannot detect the disclosure

**What goes wrong:**
`SEED-210` states it exactly: a synthesised answer quotes a document's contents, cites it, and never had to open the file. Every incident-response tool an enterprise owns is built around **file access events**. A RAG answer produces none. So under connection-scoped visibility the failure mode is not "user X opened file Y" — it is "user X received three paragraphs of file Y's content, and the source system logged nothing." After the fact, detection is impossible unless *we* logged it.

This is the property that made EchoLeak (CVE-2025-32711, CVSS 9.3) so severe — it exfiltrated through the model's own natural-language channel, where "traditional defenses like antivirus, firewalls, or static file scanning" do not apply ([Aim Security via HackTheBox](https://www.hackthebox.com/blog/cve-2025-32711-echoleak-copilot-vulnerability); [arXiv 2509.10540](https://arxiv.org/html/2509.10540v1)).

**How to avoid:**
- **Log the retrieval set, not just the answer.** Every `search_documents` hit that resolves to a document with a `source_connection_id` writes an `audit_log` row: asking user, document id, connection id, similarity. This is the inbound analogue of the shipped outbound audit receipt, and the project already owns the receipt vocabulary and the immutable INSERT-only `audit_log` table (D-10).
- Make that ledger **queryable by document**, so *"who has been answered from this file?"* is one query — the question a customer asks on the day a share turns out to have been wrong.
- ⚠ Do **not** rely on citations for this. Citations are a UI affordance the model participates in; the audit row must be written by the retrieval service, below the model.

**Warning signs:** the only record of a synced document being used is a chat transcript; nobody can answer "which users have seen content from connection C" without reading messages.

**Phase to address:** `P-PERM` (**ARCH** — the row must exist from the first sync; retrofitting means the first months are permanently unauditable).

---

### Pitfall 4: The corpus becomes attacker-influenced, and this app already holds the whole lethal trifecta in one session

**What goes wrong:**
The moment a shared drive or a mailbox feeds the index, **anyone who can drop a file in that drive, or send mail to that mailbox, can write into the agent's context.** Combine that with the shipped v3.9 capability set and the configuration is Simon Willison's [lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) exactly: **private data** (the KB, plus every other connected service) + **untrusted content** (the synced corpus) + **external communication** (`send_email` / `create_ticket` / `post_message` and any granted MCP write tool). Willison's conclusion is the operative one: *"we still don't know how to 100% reliably prevent this"* — the only sound mitigation is to remove one leg.

This is not theoretical, and the incident list is now specific:

| Incident | Shape | Why it maps to us |
|---|---|---|
| [EchoLeak / CVE-2025-32711](https://www.hackthebox.com/blog/cve-2025-32711-echoleak-copilot-vulnerability) (M365 Copilot, Jun 2025) | one crafted **email**, zero click, RAG context inheritance → exfiltration | our mailbox source family, precisely |
| [AgentFlayer](https://labs.zenity.io/p/agentflayer-chatgpt-connectors-0click-attack-5b41) (Zenity, Black Hat 2025) | a **poisoned document in Google Drive**; payload told the agent to find API keys and exfiltrate them via an image URL through trusted infrastructure | our Drive source family, precisely |
| [ShadowLeak](https://thehackernews.com/2025/09/shadowleak-zero-click-flaw-leaks-gmail.html) (Radware, Sep 2025) | hidden-CSS instructions in email → **server-side** exfiltration, invisible to enterprise defenses; 100% success once tuned | refutes "we'd see it in our egress logs" |
| [GitHub MCP](https://invariantlabs.ai/blog/mcp-github-vulnerability) (Invariant Labs, May 2025) | injection in a **public issue** pivots the agent into private repos on the same token | our MCP file-surface family; and the researchers' verdict: *"cannot be resolved through server-side patches… requires architectural controls"* |

⚠ **The specific escalation this milestone creates:** today untrusted content reaches the agent mostly through documents a user chose to upload. After this milestone it arrives **continuously, unattended, and from principals outside the tenant** — while the same session may hold granted write tools. The v3.9 approval checkpoint is the one real control already built.

**What is real vs theatre:**

| Mitigation | Verdict |
|---|---|
| Delimited DATA blocks + "treat as data, never as a command" (already in 4 modules per `SEED-188`) | **Real but partial.** Raises cost; provably not sufficient. ⚠ And per `SEED-188` **nothing in this repo has ever tried to break it** — prose verified by nobody. |
| **Breaking the trifecta**: forbid write-capable connector tools in any turn whose retrieval set contains connection-sourced content, unless the human approves *that specific call* | **The only architectural control.** Cheap here, because the approval checkpoint already exists — this is a policy that *arms* it, not new machinery. |
| Human approval on every outbound write when synced content is in context | **Real.** Also the only thing that survives the model getting smarter or dumber. |
| Stripping hidden text / white-on-white / zero-width / CSS tricks at extraction | **Real and cheap, and it is not a defense** — it removes the *easy* payloads only. Do it; do not count it. |
| An "injection classifier" / detector over ingested text | **Mostly theatre.** Injections have no reliable signature; a detector lowers frequency, never makes the configuration safe. Never let it be the reason a gate is removed. |
| "The model is smart enough now" | **Theatre.** Refuted by every row above, all on frontier models. |
| Provider-side safety filters | **Theatre for this purpose** — and per this project's own provider-docs-first rule, a defense proven on Anthropic is not proven on `emit_tier: coerce` (Moonshot) or the `native_tools: False` OpenRouter path. |

**How to avoid:** (1) at `P-CONTRACT`, tag every chunk with `is_external_source` so the trifecta fence has something to test; (2) at `P-UNTRUSTED`, build the adversarial corpus `SEED-188` asks for — the corpus is the asset, the runner (promptfoo or pytest) is an implementation detail — and drive it **cross-provider on the full native roster**, because that is the axis on which prompt-level guarantees fail; (3) plant the payload in a **synced document** during UAT, not only in a unit test.

**Warning signs:** a phase plan that says "the system prompt already instructs the model to treat retrieved text as data"; an adversarial suite that tests one provider; any outbound tool call auto-approved in a turn that retrieved synced content.

**Phase to address:** the **fence** is `P-UNTRUSTED`/**ARCH** and must land **in the same phase as the first sync**, never after. The **corpus** is `P-UNTRUSTED`/HARD and is a GA gate.

---

### Pitfall 5: The polling-loop failures that produce **silent wrongness** rather than errors

The classification below is the deliverable; the ranking is *silence*, not severity. A loud failure has a support ticket; a silent one has a customer who quietly stops trusting the answers.

| Failure | Silent? | What actually happens here | Warning sign | Prevention |
|---|---|---|---|---|
| **Pagination cursor shifts under you** | ⚠ **SILENT — worst in class** | Google's own tracker carries an open case where Drive returns **an empty page with a non-null `nextPageToken`** on shared drives, intermittently ([issuetracker 406305173](https://issuetracker.google.com/issues/406305173)). A naive `while token: if not page.files: break` **silently skips the rest of the drive** | the preview's file count differs run to run for an unchanged folder | never treat an empty page as the end — only a **missing** `nextPageToken` ends a listing; assert this run's count against the previous run and surface a drop |
| **Delta / history token invalidation** | ⚠ **SILENT if mishandled** | Graph returns `410 Gone / resyncRequired` with **no published TTL** for driveItems ([MS Q&A](https://learn.microsoft.com/en-us/answers/questions/5856875/microsoft-graph-delta-api-clarification-on-delta-t)); Gmail `historyId` expires (days → ~30) and `history.list` answers **404** ([Google sync guide](https://developers.google.com/workspace/gmail/api/guides/sync)). Swallowing either means "no changes" forever | a source shows "last checked 3 minutes ago" and has ingested nothing for weeks | ⭐ **This milestone's cursorless design is a genuine advantage — keep it.** `PROJECT.md` binds the UI to *"checked every N minutes"* with no delta cursor: full list + `content_hash` diff is **self-healing by construction**. When a cursor is added later, a 410/404 must force a full list, and the fallback must be **counted and surfaced**, never logged |
| **Overlapping runs of the same schedule** | ⚠ **SILENT, and it is live today** | `claim_due_schedules` (`backend/app/db/schedules.py:263`) is rigorous about *duplicate firing* — `FOR UPDATE SKIP LOCKED` + in-transaction `next_run_at` advance — but there is **no in-flight check**. A poll that takes longer than its interval is claimed again on the next tick and a second sync of the same source runs concurrently | two ingestion jobs for the same file id; duplicate rows or `23505` storms | add a **per-source lease** (`sync_state.leased_until`) checked in the same claim transaction; the second tick records `skipped_still_running` **as a visible fact**, never as nothing |
| **A poll slower than its interval** | ⚠ SILENT | the first sync of a 10k-file drive against a 15-minute schedule | `last_run_at` and `next_run_at` converging; queue depth rising monotonically | the lease above, plus an honest source state (*still importing — 2,140 of 12,431*) |
| **Missed window / downtime** | **not silent, and correctly handled** | `compute_next_run_at` computes from *now* with no catch-up, so the missed tick is skipped. ⭐ With a cursorless full list this is **harmless** — the next poll finds everything | — | keep the full-list design; if a cursor lands, this row flips to SILENT |
| **Clock / timezone drift** | mostly loud | `models/schedule.py` resolves IANA zones via `zoneinfo` and normalises to UTC; an unadvanceable cadence **deactivates** the row with `last_status='cadence_error'` rather than looping forever | a source silently `is_active=false` | ⚠ the row is deactivated **and nobody is told** — the source-health surface must render `cadence_error` as a source that stopped, with the one action that fixes it |
| **Partial failure retried from the start** | ⚠ SILENT + expensive | no durable job today (`SEED-077`): a 9,000-of-10,000 failure restarts at zero, re-embedding 9,000 files at full token price | embedding spend spikes with no new documents | per-file job granularity in `P-QUEUE`; the `content_hash` short-circuit makes a restart cheap **only if the hash check runs before the embed** |
| **429 / rate limits** | loud at the API, ⚠ **silent to the user** | `BUG-260815-05` already recorded the shape: an embedding-provider 429 surfaced as *"your documents returned nothing"* | files stuck `pending` / `processing` | `Retry-After`-aware backoff + dead-letter (`SEED-077` step 4); a document that exhausted its retries must be **visible and re-queueable**, never stuck |
| **Token expiry mid-run** | loud if unhandled, ⚠ silent if caught-and-continued | Gmail/Graph access tokens expire hourly; a long first sync will cross it | a sync that always completes ~60 min of work | refresh **inside** the loop (the v3.9 refresh path exists); a refresh failure **aborts and marks the source**, never skips files |
| **Duplicate ingestion** | ⚠ SILENT **today, by construction** | see Pitfall 9 — the dedup lives in the HTTP handler, not in the ingest function | duplicates visible only to the user | one splice (Pitfall 9) |
| **A source that has stopped reading** | ⚠ SILENT unless built | revoked OAuth grant, deleted folder, or `SEED-239`'s single malformed `config` row taking the whole connections list to 503 | "why is the assistant answering with old information?" | this is `LIB-10` and it is a **first-class requirement**, not telemetry: what stopped, when, and the one action |

**Phase to address:** the lease and the honest states are `P-WATCH`; the queue/retry/dead-letter is `P-QUEUE` (**ARCH**); the pagination and token rules belong in the **adapter contract** at `P-CONTRACT`, so all four adapters inherit them (see Pitfall 12).

---

### Pitfall 6: First-sync stampede — the enterprise buyer's first action is the one the system has never survived

**What goes wrong:**
`SEED-077` states it flatly: ingestion is an in-process FastAPI `BackgroundTask` per upload (`documents.py:497-498`) with **no durable queue, no concurrency cap, no retry, no resume, no cross-worker coordination**. Under manual upload that is a rare annoyance. Under "connect the Finance drive," one click becomes thousands of concurrent pipelines competing for the same threadpool, the same extraction subprocesses, and a **single OpenAI embeddings endpoint** (`SEED-048` — hardwired, no fallback, no `try/except`).

Compounding, measured in this repo: `embed_texts` passes the **entire** chunk list into one `embeddings.create(input=texts)` call with no batching (`SEED-197`), against a provider cap of 2048 inputs; and `embed_and_store_table_chunks` pairs results with `zip(...)`, which — if a provider ever returned fewer embeddings than inputs — would **drop the surplus chunks with no error and mark the document fully ingested**. That pairing is `SEED-197`'s named latent failure, and a one-line `len()` assertion closes it.

Cost is the other half. Industry write-ups put a 1M-document backfill at roughly **$4,400** of embeddings and, at OpenAI's default TPM limits, ~**87 days** of wall clock ([Barnacle Labs](https://medium.com/barnacle-labs/embeddings-in-production-or-how-nothing-scales-like-youd-expect-it-to-part-1-costs-to-embed-a82482765215)); the recurring lesson is that **a backfill has none of the governors online traffic has** ([TianPan](https://tianpan.co/blog/2026/07/06/the-backfill-that-re-ran-your-entire-ai-bill)). A "re-sync everything" button is a five-figure surprise wearing a friendly label.

**How to avoid:**
- `P-QUEUE` **before** `P-WATCH` reaches anyone real: persist the job before returning, a consumer with a **global + per-user cap**, retry with `Retry-After` backoff, a dead-letter, and resume-on-restart. `SEED-077` names the cheapest first cut (reuse the Redis run-buffer substrate) and it is the right one.
- Batch inside `embed_texts` (512/request) **in the service, not at call sites**, so every caller inherits it; assert `len(embeddings) == len(texts)` before any `zip`.
- Embedding **provider fallback** (`SEED-048`) — the multi-provider picker shipped in Phase 111.1; the ingest path must actually use it rather than the hardwired client.
- **Show cost before spending it.** The preview already splits *will be added / already here / unsupported* — add an estimate (files, chunks, approximate tokens) to the *will be added* arm. That turns the most expensive irreversible action in the product into an informed one.
- **Never offer an unbounded "re-sync all"** without a typed confirmation naming the file count.

**Warning signs:** a preview screen with a count but no size; embedding spend moving without new documents; documents stuck `processing` after a deploy; both `WORKER_COUNT=2` workers saturated during a sync.

**Phase to address:** `P-QUEUE` (**ARCH**); preview economics in `P-WATCH`.

---

### Pitfall 7: pgvector recall degrades as the corpus grows — and this milestone is what makes the corpus grow

**What goes wrong:**
`SEED-076` is precise: `match_document_chunks` applies the tenant and metadata predicates **inside the same query as the approximate HNSW scan**, with `hnsw.ef_search` at its default of 40 and no per-tenant or partial index. With approximate indexes the filter is applied **after** the fixed candidate batch: if a predicate matches 10% of rows, a default `ef_search=40` yields ~4 surviving rows, and the `LIMIT` is silently under-filled ([ClickHouse](https://clickhouse.com/resources/engineering/scale-vector-search-postgres), [Nile](https://www.thenile.dev/blog/pgvector-080)). The user experience is *"the answer is in a document and the agent didn't find it."* No error, ever.

⚠ **This milestone is the trigger, and it fires twice.** It multiplies corpus size *and* it adds new filter axes — `source_connection_id`, connection visibility, provenance fields — which makes filtered search the **default** retrieval path rather than an occasional one.

**How to avoid:**
- Adopt **pgvector 0.8 iterative scan** (`SET LOCAL hnsw.iterative_scan = strict_order`, tune `hnsw.max_scan_tuples`, default 20,000). This is the purpose-built fix and it did not exist when `SEED-076` was planted. **Verify the deployed pgvector version first** — local Supabase and cloud Supabase can differ, which is exactly the cloud-parity drift class this project already tracks.
- Failing that, set `hnsw.ef_search` proportional to filter selectivity.
- **Build the recall harness before the corpus arrives**, not after: a synthetic multi-connection corpus and a measured recall number. There is no recall test at any scale today, so there will be no way to tell whether a customer complaint is recall or relevance.
- Instrument the **under-fill signal**: a filtered search returning fewer than `match_count` rows is a measurable event — log it and expose it in Library Health (the Health tab landed in Phase 217.1).

**Warning signs:** searches returning fewer than the requested chunk count; grounding quality falling as the KB grows; "it used to find that."

**Phase to address:** `P-SCALE` (**HARD**) — but the **harness** must exist before the first bulk sync or there is no baseline. Recommend the harness in `P-QUEUE` and the tuning in `P-SCALE`.

---

### Pitfall 8: Lifecycle — ignoring source events is a disclosure; honouring them aggressively is data loss. Both are somebody's shipped default.

**What goes wrong, in both directions:**

*Ignored:* `SEED-210` Problem 2 — a file is deleted, unshared, moved to a restricted library, and **nothing happens**: the row, chunks and embeddings keep answering. A share revoked six months ago still serving answers is the same disclosure as Pitfall 1, with the added property that **nobody is looking for it any more.** The industry's own framing is that entitlements should be synced *more often* than content, because they change more often and matter more ([Truto](https://truto.one/blog/how-to-maintain-document-level-rbac-in-enterprise-rag-pipelines/), [Microsoft ISE](https://devblogs.microsoft.com/ise/sharepoint-doc-level-access/)).

*Honoured too aggressively:* `PROJECT.md` already binds the correct default — *a file removed at the source is NOT removed from the Library unless explicitly asked for* — because a revoked share must never silently delete knowledge the agent depends on. The subtler failure worth naming: **a source-side reorganisation looks exactly like a mass deletion.** Someone moves a SharePoint library, or the OAuth scope narrows, and a naive "not in the listing ⇒ gone" rule purges thousands of documents in one tick. ⚠ Under a cursorless full-list design **a single failed page of pagination is indistinguishable from "these files no longer exist"** — which is why Pitfall 5's first row is a data-loss bug, not merely a completeness bug.

**How to avoid:**
- **Absence is never an action.** A file missing from a listing sets `source_state = 'not_seen_since <ts>'`. Only an explicit confirmed user action, or *N* consecutive **verified-complete** listings, may escalate.
- **Separate three verbs and never conflate them:** `retire from retrieval` (stop answering, keep the row — the safe default, and the existing `is_latest=false` mechanism already does exactly this), `soft-delete` (hidden, restorable), `purge` (row + chunks + embeddings + storage object). Only `purge` is irreversible, and only a human may reach it.
- **Answer the disconnect row explicitly** — `SEED-210` calls it the one undecided policy question and `SEED-072` is its compliance sibling. **Recommendation (an opinion, offered because silence is the failing option):** *on disconnect, FREEZE by default* — retrieval stops immediately (that is the moment a user most expects their data to stop being used), rows and chunks are retained for a stated window (30 days), and the UI offers **Purge now** and **Reconnect to resume** as two named buttons. Freeze is reversible, satisfies the expectation, and does not destroy knowledge on an accidental disconnect. Whatever is chosen, **the sentence belongs on the disconnect confirmation**, not in a doc.
- ⚠ **Purge must be complete or it is worse than nothing:** `documents` + `document_chunks` + `document_images` + `document_tables` + `document_relationships` + the Storage object. A purge that leaves chunks behind leaves an index answering from a document nobody can find. And `audit_log`/`harness_audit` are deliberately immutable (D-09/D-10), so the erasure-vs-audit tension (`SEED-072`) must be answered here rather than discovered at a GDPR request.

**Warning signs:** a sync run whose delete count is a large fraction of the corpus; any code path where "not in listing" leads directly to `DELETE`; a disconnect dialog with no consequence sentence; a purge that does not enumerate every child table.

**Phase to address:** `P-LIFECYCLE` (**ARCH decision at scoping, built in-phase**). The `source_state` column is `P-PERM` / `P-CONTRACT` schema.

---

### Pitfall 9: The retrofit — the existing upload path already has **two doors**, and only one of them dedups

**What goes wrong (measured in this repo, 2026-09-04 — the highest-confidence pitfall in this document):**

The manual-upload path's protections are **not in the ingest function. They are in the HTTP handler.**

- `upload_document` (`backend/app/api/documents.py:547`) computes `content_hash` at **`:620`**, runs the folder-scoped dedup SELECT at **`:624-640`**, and does the filename→`version_number` bump with the `is_latest=false` cascade at **`:643-663`**.
- `ingest_document` (`:2030`) — the function a sync adapter would naturally reuse — contains the classification splice (`:2469`), the multimodal extraction and the metadata write, **but none of the dedup or versioning.**
- ⚠ **The precedent already exists in-tree.** The Phase 203 email-attachment cascade inside `ingest_document` (`:2405-2417`) inserts a `documents` row with a computed `content_hash` and **no dedup check at all** — a second ingest door that skips the first door's protection. The whole cascade is wrapped in `except Exception: log.warning(...)` (`:2443`), so a failure part-way through **abandons the remaining attachments with a warning line and no user-visible signal**.
- The real backstop is a **database** unique index: `documents_dedup_idx ON (user_id, content_hash, COALESCE(folder_id, '000…')) WHERE status <> 'failed'` (`full-schema.sql:3021`). ⚠ *Inference, not measured:* two different emails carrying the identical attachment would collide in that index (both `folder_id IS NULL`), raise inside the unguarded insert, and be swallowed by the broad handler — **losing the remaining attachments silently.** One test reproduces or refutes this; it is worth writing either way.

**Why it happens:** every protection was added at the door that existed. Nobody wrote them at the door that did not.

**How to avoid:**
- **`P-CONTRACT` is a refactor phase before it is a feature phase.** Extract `hash → dedup → version → splice` out of `upload_document` into a service (`ingestion_splice.py`) that **both** the HTTP handler and every adapter call. `documents.py` is 2,535 lines and a G-5-firing hot file that had no ledger row until 217.1 — this extraction is owed anyway.
- Make the contract's dedup key an explicit decision, because the upload key does not transfer. Upload dedups on `(user_id, content_hash, folder_id)`. A synced file also needs a **source identity** — `(connection_id, external_id)` — because the same file renamed at the source is *the same document*, and two different source files with identical bytes are *not necessarily* one document. `SEED-209`'s identity key is this decision.
- **Prove the two doors agree** with a test that pushes the same bytes through both paths and asserts identical rows. That test is the only mechanically enforceable version of the "one ingest splice" rule.

**Warning signs:** a sync adapter that calls `supabase.table("documents").insert(...)` directly; a plan whose `files_modified` adds ingestion logic to a new module without touching `documents.py`; duplicates appearing only for synced sources; `23505` in the logs.

**Phase to address:** `P-CONTRACT` (**ARCH**, and a **prerequisite**, not a parallel task).

---

### Pitfall 10: Guarantees that hold at the door people watch and not at the door the volume comes through

**What goes wrong:** `SEED-209` names it exactly — *"a guarantee that covers the door people watch and not the door the volume comes through."* Concretely, everything below currently lives inside `upload_document`, or inside `ingest_document`'s upload-shaped assumptions, and each is invisible-if-skipped, because the documents *do* appear, merely un-processed:

| Guarantee | Where it lives | What "skipped" looks like |
|---|---|---|
| Classification rule eval | `ingest_document:2469` | documents arrive **unclassified**; rules "work" for 40 manual uploads and not for 40,000 synced ones |
| Custom-metadata extraction + per-field confidence | the metadata pass in `ingest_document` | ConfidenceChips absent on exactly the documents nobody reviewed |
| MIME allow-list + `_EXT_MIME_OVERRIDES` for lying senders | handler + attachment cascade (**two copies already**) | a **third** copy for sync = three notions of "a file we accept" |
| 50 MB body limit / attachment count caps | `upload_document` + `email_extraction_service` | unbounded memory on a large source file — see below |
| Folder-ownership check | `upload_document:603-618` | a sync writing into a folder the connection owner does not own |
| Storage-upload-failure ⇒ no row | attachment cascade `:2392-2404` | rows whose `file_path` points at nothing, indistinguishable from real ones until read |

**Unbounded memory deserves its own line.** `content_hash = hashlib.sha256(raw)` needs the **whole file in memory**, and extraction does too. A user's Drive contains a 2 GB video and a 400 MB PST their laptop never opened. Manual upload is bounded by a human's patience and a 50 MB check; a sync is bounded by nothing.

**How to avoid:** the same extraction as Pitfall 9 — one splice, one MIME policy, one size policy, one folder check — plus a **size/type refusal in the lister, before the download**, so an oversized file becomes a *"type not supported / too large"* row in the preview (an arm the preview already has) instead of an OOM in a worker. Stream-hash where the adapter can. ⚠ Prefer the **provider's own** checksum/`modifiedTime` for the *has it changed?* test, and compute `content_hash` only for files that will actually be ingested.

**Warning signs:** synced documents with empty metadata; a rules surface whose match count is implausibly low; worker RSS spikes during sync; classification rules that "don't seem to do anything."

**Phase to address:** `P-CONTRACT` (**ARCH**) for the splice; the preview's refusal arm in `P-WATCH`; rule semantics in `P-RULES`.

---

### Pitfall 11: Email is a second **shape**, and the mistake shows up as *dedup and retrieval poisoning*, not as a broken adapter

**What goes wrong:** `PROJECT.md` already flags this at intake, so the useful contribution is **how it manifests**. The adapter will work. The corpus will be wrong.

1. **No stable document boundary.** Is a document a message, a thread, or a thread-so-far? Choose *message* and the answer to "what did we agree with the vendor?" is scattered over 14 rows. Choose *thread* and the document **changes every time someone replies** — its `content_hash` changes, so it re-embeds, so its version number climbs forever, and a versioning model built for *a person uploading v2 of a contract* becomes noise.
2. **Quoted-reply duplication poisons dedup and retrieval.** A 14-message thread contains message 1 fourteen times. Hash dedup never fires (each body differs by the accreted quote block); the index holds fourteen near-identical chunks; retrieval returns the same paragraph fourteen times and crowds out everything else. The standard advice is exactly this — **strip signatures and quoted chains before embedding** ([Nylas](https://cli.nylas.com/guides/rag-over-email)). ⭐ **This app already has the tool**: `email_extraction_service` was built in Phase 203 to strip quoted reply/forwarding chains. So the pitfall is not *building* it — it is **failing to route the sync path through it** (Pitfall 9 again).
3. **The dedup facts exist and are read by nothing.** The v3.8 audit already recorded that *email thread dedup is stored and read by nothing*, and `email_extraction_service` parses `message_id` (`:281`, `:377`) which is never used as an identity key. ⚠ A synced mailbox is the first path on which that becomes a live defect rather than dead data. `Message-ID` / `In-Reply-To` / `References` are the correct thread identity and they are already parsed.
4. **Attachments-as-children multiply everything.** The cascade exists (a `documents` row + an `attached_to` relationship) with caps of 50 attachments / 25 MB. A 20,000-message mailbox carries a long attachment tail, each one its own document, extraction and embedding job — **and the same attachment appears in every message of the thread.**
5. **Signature/footer noise** — confidentiality boilerplate is the single most-repeated text in any corpus and will win the similarity search for "confidential."
6. **The permission shape does not match.** A mailbox has no ACL to flatten; its content is one person's private correspondence. Connection-scoped visibility maps *better* here than for Drive — but a mailbox connected by an admin and then made org-visible is a far worse disclosure than a drive, because nobody ever "shared" any of it.

**How to avoid:** ⭐ **Do not ship mail as the fourth adapter in the same phase as the three file adapters.** Ship Drive / OneDrive / MCP-file on the file shape, prove the contract holds across three, **then** take mail as its own phase with its own boundary decision. Recommended v1 boundary (an opinion): **the thread is the document, the newest message is the version, quoted chains and signatures are stripped before hashing and embedding, the `Message-ID` set is the identity, attachments are children deduped by their own `content_hash`.** And re-read `SEED-212` before writing it — transcripts are the same class of problem, and one boundary decision made for both is worth more than two.

**Warning signs:** the same paragraph returned three times in one retrieval set; email documents whose `version_number` climbs weekly; a plan that lists mail alongside Drive as "one more adapter."

**Phase to address:** `P-MAIL` — **last**, and explicitly a shape decision, not an adapter task.

---

### Pitfall 12: "Four adapters" becomes "four codebases" — and the mechanism is the *exception*, never the design

**What goes wrong:** Everyone starts with the right abstraction. It dies one reasonable exception at a time. Graph needs a delta token, so a `cursor` field appears. Drive shared-drive listing needs `includeItemsFromAllDrives`, so an options bag appears. Mail has no path, so `path` becomes optional. MCP servers vary, so a `capabilities` probe appears. Six months later the "generic contract" is a dataclass every adapter ignores, and the *scheduler* has four branches on `provider`. `PROJECT.md`'s constraint is the right one — *"if each source family grows its own ingest path, this is four milestones wearing one name"* — but a constraint stated in prose is precisely what this project has repeatedly measured as unenforceable.

**What forces it to hold (concrete, in rough order of power):**
1. **A third implementation, early.** Two adapters can share an interface by coincidence. Build **MCP-file second, not last** — it is the most alien of the three file sources, and it is what proves the contract rather than the pair.
2. **The adapter returns data, never behaviour.** `list() -> Iterable[SourceItem]` where `SourceItem` is `{external_id, name, path, size, mime, remote_checksum, modified_at, parent_id}`, and `read(external_id) -> bytes`. **Everything else — hashing, dedup, versioning, classification, chunking, embedding, retry, the queue, the audit row — lives once, above the adapter.** This is the same verdict the v3.9 outbound side already reached (a connection is data: identity + auth + discovered tools + grants).
3. **The generic layer owns pagination, backoff and token refresh** (see Pitfall 5). If each adapter implements its own retry, one adapter's 429 handling is right and three are wrong, and you will not know which.
4. **A grep-able fence in CI:** no `provider ==` / `isinstance(adapter, …)` branch outside `adapters/`. This project already ships bespoke gate scripts (`check-deploy-drift.sh`, `check-gap-closure-rounds.cjs`, `check-claude-md-size.cjs`); one more is cheap and is the only thing that fires in the turn the exception is authored.
5. **One conformance suite parameterised over every adapter**, including a fake. A new source family that cannot pass it is not a new source family.
6. **Adding a source should add rows, not code.** Where an adapter needs configuration (scopes, roots, page size), it is a **row** — v3.9's shipped verdict, applied inbound.

**Warning signs:** the third adapter's PR modifies files in the shared layer; `if provider ==` anywhere outside `adapters/`; an adapter importing `supabase` or `embedding_service`; the contract dataclass growing optional fields whose only consumer is one adapter.

**Phase to address:** `P-CONTRACT` (**ARCH**) — and the fence must be committed **with the second adapter**, not after the fourth.

---

### Pitfall 13: `SEED-239`'s blast radius, applied to a background watcher

**What goes wrong:** `list_connections` validates each row inside a list comprehension against an `extra='forbid'` union, so **one malformed `config` key answers 503 for every connection in the org** — measured live on 2026-09-01 (nine connections, one bad key, whole page dead). A watcher amplifies that from a page failure into a **silent ingestion outage**: every source stops reading, and the only symptom is stale answers. It is likeliest exactly when a migration is applied in one environment and not the other — the cloud-parity state this project already tracks as its #1 deploy gotcha.

**How to avoid:** validate per row; a bad row degrades to an honest single-row error and **must not read as "this connection is fine."** In the watcher, a source that cannot be loaded is a source that has **stopped**, surfaced through the same `LIB-10` state as a revoked token.

**Warning signs:** "Could not load connections" while individual connections are demonstrably fine; a sync that stops across all sources simultaneously after a deploy.

**Phase to address:** `P-WATCH` (fold `SEED-239`), or `P-CONTRACT` if the watcher reads connections directly.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Sync writes `documents` rows directly instead of through the shared splice | ships the first adapter in a day | classification, metadata, MIME policy, size caps and dedup silently do not apply to 99% of the corpus; unfixable without a re-ingest | **never** — this is the milestone's binding rule (`SEED-209`) |
| Visibility inferred from folder placement (today's behaviour) | zero schema change | rules become an authorization surface (Pitfall 1); disclosure with no audit trail | **never** for connection-sourced documents |
| Deferring the durable queue "until we see load" | one phase saved | the load event *is* the customer's first day; work is lost on restart with no resume | **never** for the sync path. Acceptable to leave the *manual upload* path on `BackgroundTask` **only if** it delegates to the same queue |
| Per-adapter retry/backoff | each adapter ships independently | four retry policies, three of them wrong, no single place to fix a 429 | only inside `adapters/` for **provider-specific error mapping**, never for the policy |
| No `source_principals` column because Option 3 does not need it | smaller schema | `SEED-211` becomes a re-ingest instead of a backfill | **never** — a nullable unread column is free insurance |
| Prompt-level anti-injection with no adversarial test | already written, feels done | `SEED-188` exactly: a defense with no counterfactual, degrading silently across model and provider upgrades | acceptable **only** while write tools are fenced out of turns containing external content |
| "Not in the source listing ⇒ delete" | keeps the Library tidy | one bad pagination page destroys a corpus (Pitfalls 5, 8) | **never** |
| Treating mail as the fourth adapter | one phase instead of two | corpus poisoned by quoted duplication; version churn; dedup that can never fire | **never** — split the phase |
| Unbounded "Re-sync everything" button | trivially implemented; users ask for it | full-price re-embedding of the whole corpus, unbounded and uncapped | only behind a typed confirmation showing file + token count |
| Sync worker running as a service identity | simpler credentials | a sync that retrieves and writes across tenants | **never** — stamp the connection owner, as `launch_scheduled_run` already does for runs |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| **Google Drive** | treating an empty page as end-of-list | only a **missing** `nextPageToken` ends a listing — Drive intermittently returns an empty page with a non-null token on shared drives ([issuetracker 406305173](https://issuetracker.google.com/issues/406305173)) |
| **Google Drive** | listing "my drive" and missing shared drives | `includeItemsFromAllDrives` + `supportsAllDrives`; treat each shared drive as its own connection scope |
| **Google Drive** | trying to `read` a native Doc/Sheet/Slide | native types have **no bytes** — they must be *exported* to a MIME type, and the export has no stable checksum, so `modifiedTime`/`version` is the change signal, not the hash |
| **Microsoft Graph** | assuming a delta token has a TTL you can rely on | there is **no published TTL** for driveItems; `410 resyncRequired` is a **normal recovery path**, not an exception — full resync, and stagger schedules to avoid synchronised token refresh ([MS Q&A](https://learn.microsoft.com/en-us/answers/questions/5856875/microsoft-graph-delta-api-clarification-on-delta-t)) |
| **Microsoft Graph** | one connection = one tenant | a SharePoint *site*, a *drive* and a *list* are different delta surfaces with different behaviour; scope a connection to one |
| **Gmail** | storing `historyId` and never handling its expiry | `history.list` answers **404** when the id is too old (typically days, up to ~30) → fall back to full sync; **both** code paths are mandatory ([Google](https://developers.google.com/workspace/gmail/api/guides/sync)) |
| **Gmail / Graph mail** | hourly access-token expiry mid-run | refresh **inside** the sync loop; a refresh failure aborts and marks the source rather than skipping messages |
| **MCP file surface** | trusting tool descriptions and returned content as instructions | MCP content is untrusted by definition (Pitfall 4, GitHub-MCP class); a file surface is `list`/`read` **only** — never grant a write tool to the watcher's credential |
| **MCP** | assuming every server exposes the same file semantics | probe capabilities once at connect, store the result as a **row**, and refuse a source whose surface does not satisfy the contract — with a stated reason |
| **All four** | per-adapter 429 handling | one `Retry-After`-aware policy in the generic layer; adapters only map provider errors into the shared taxonomy |
| **Embeddings provider** | one unbatched request per document | batch at 512 inside `embed_texts`; assert `len(embeddings) == len(texts)` before any `zip` (`SEED-197`) |
| **Supabase / pgvector** | assuming local and cloud carry the same pgvector version | verify before relying on `hnsw.iterative_scan`; the local↔cloud parity checklist exists and this is a new line on it |

## Performance Traps

| Trap | Symptoms | Prevention | When it breaks |
|---|---|---|---|
| First-sync stampede | all workers saturated; uploads queue behind a sync; documents stuck `pending` | durable queue + global/per-user concurrency cap (`SEED-077`) | **the first real customer connection** — a few thousand files |
| Unbatched `embed_texts` | provider 400 mentioning an input/array limit | batch at 512 inside the service | > 2048 chunks in one document — a large spreadsheet reaches it (`SEED-197`) |
| Embedding SPOF | a provider 429 surfaces as *"your documents returned nothing"* (`BUG-260815-05`) | fallback provider + backoff + dead-letter (`SEED-048`) | any provider incident during a bulk sync |
| Filtered-HNSW recall collapse | fewer than `match_count` chunks returned; "the answer is in a doc and it didn't find it" | `hnsw.iterative_scan` / `ef_search`; a recall harness with a baseline | when any one connection owns a small fraction of `document_chunks` — i.e. **on success** |
| Whole-file-in-memory hashing + extraction | worker RSS spikes; an OOM kill mid-sync loses all in-flight work | size/type refusal in the **lister**, before download; stream where possible | a single 500 MB file in a watched folder |
| Overlapping schedule runs | duplicate jobs; `23505` storms; doubled spend | per-source lease in the claim transaction | when a sync exceeds its interval — i.e. **on the first sync** |
| Attachment fan-out from mail | document count 5–10× the message count | dedup attachments by `content_hash` across the mailbox; cap per thread | a 20k-message mailbox |
| Re-embedding on every poll | steady embedding spend against a static corpus | change-detect on the **provider's** checksum/`modifiedTime` first; hash only candidates | immediately, and silently — it looks like normal usage |

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Placing synced documents in an org-shared folder | org-wide disclosure of content only the connecting user could read | narrower-of-two visibility; refuse widening moves (Pitfall 1) |
| No retrieval audit for connection-sourced documents | the disclosure is undetectable and unprovable after the fact | an `audit_log` row per retrieval hit on a `source_connection_id` document (Pitfall 3) |
| Write-capable connector tools live in a session that retrieved external content | the lethal trifecta; the EchoLeak / AgentFlayer / ShadowLeak / GitHub-MCP class | fence: external content in the retrieval set ⇒ writes require the shipped per-call approval |
| Trusting the written anti-injection discipline | `SEED-188` — a defense with no counterfactual, unproven cross-provider | adversarial corpus, driven on the full native roster, planted **in a synced document** |
| Not stripping hidden text / white-on-white / zero-width at extraction | the exact payload vehicle in ShadowLeak and AgentFlayer | strip at extraction; treat as hygiene, **never** as the control |
| Source deletion/revocation ignored | a revoked share still answering months later, unwatched | `source_state`; retire-from-retrieval on confirmed revocation |
| Connection disconnected, data retained silently | the moment a user most expects their data to stop being used | freeze-by-default + a stated sentence + Purge now (Pitfall 8) |
| Partial purge | an index answering from a document nobody can find | enumerate every child table + Storage; test it |
| Ingesting a source with no DLP pass | `SEED-079` — PII flows verbatim into chunks, prompts, third-party providers and LangSmith traces (**tracing is on by default**) | at minimum, make the trace/egress exposure an explicit documented decision for connection-sourced content **before** the first sync |
| Service-role / system identity for the sync worker | a sync running as "the system" retrieves and writes across tenants | stamp every ingest with the connection owner, exactly as `launch_scheduled_run` stamps runs |

## UX Pitfalls

| Pitfall | User impact | Better approach |
|---|---|---|
| Saying "instantly" or "on change" | a user believes a file appears when saved; it appears up to N minutes later, and they conclude the product is broken | ⚠ **already binding:** *"checked every N minutes"*, and the sentence changes in the same commit a webhook lands |
| A silent source | stale answers delivered with full confidence — the worst failure a knowledge product has | `LIB-10`: what stopped, when, and the one action that fixes it |
| A preview that is only a count | the most expensive irreversible action in the product is taken blind | the three-way split (**already in scope**) plus a size/token estimate on the *will be added* arm |
| Visibility explained in a settings doc | nobody reads it; the security review finds it | one sentence at connect time, in the flow, next to the button |
| Progress shown as a spinner | a 4-hour first sync looks hung | *"2,140 of 12,431 — about 40 minutes left"*. ⚠ Note `DocumentUpload.tsx` reports **no byte progress** (`onUploadProgress` absent), so per-file percentage is unknowable — count files, not bytes |
| Sync failures visible only in logs | the user learns from a wrong answer | a per-source failure count with the failing files nameable and re-queueable (the dead-letter as a **surface**) |
| Disconnect with no consequence sentence | data silently retained, or silently destroyed; either is a complaint | name the outcome on the confirm and offer the alternative |
| Duplicates visible in the Library | trust collapses instantly and permanently | the *already here* arm of the preview is the user-facing proof that dedup works — make it a real `content_hash` lookup, as specified |

## "Looks Done But Isn't" Checklist

- [ ] **Sync ingestion:** often missing the classification splice — verify a synced document carries a `_classification` suggestion and custom-metadata confidence, not just text
- [ ] **Dedup:** often only in the HTTP handler — verify the same bytes through the upload door and the sync door produce **one** row, by test
- [ ] **Versioning:** often untested for the source-side rename — verify a rename at source does not create a second document, and an edit at source does not create a hundred
- [ ] **Connection-scoped visibility:** often enforced in the API and not in RLS — verify a **direct** Postgres query as another user cannot read a connection's documents
- [ ] **Rules routing:** often can widen visibility — verify a rule targeting an org-shared folder does **not** auto-move a private-connection document
- [ ] **The watch loop:** often has no overlap guard — verify two ticks 1s apart with a slow source produce **one** sync
- [ ] **Pagination:** often stops on an empty page — verify the lister continues while a `nextPageToken` exists
- [ ] **Restart resume:** often untested — verify a worker kill mid-sync leaves zero documents stuck `processing` after restart
- [ ] **Token refresh:** often only tested at request time — verify a refresh **during** a long sync
- [ ] **Deletion:** often propagates — verify a file removed at source does **not** delete the Library row, and *does* change `source_state`
- [ ] **Disconnect:** often does nothing — verify retrieval stops immediately and the UI said it would
- [ ] **Purge:** often partial — verify `document_chunks`, `document_images`, `document_tables`, `document_relationships` and the Storage object are all gone
- [ ] **Prompt injection:** often "handled" by a system-prompt sentence — verify a planted payload in a **synced** document fails to trigger a write tool, on **every** provider in the roster
- [ ] **Audit:** often covers writes only — verify a retrieval hit on a connection-sourced document produces an `audit_log` row
- [ ] **Email:** often ingests quoted chains — verify a 10-message thread produces one document without ten copies of message 1
- [ ] **The abstraction:** often already broken — verify no `provider ==` branch exists outside `adapters/`, and that the conformance suite runs against all four

## Recovery Strategies

| Pitfall | Recovery cost | Recovery steps |
|---|---|---|
| Synced documents flattened into an over-broad visibility | **HIGH** | retire the connection's documents from retrieval immediately (one predicate — which is why the column must exist); query the retrieval audit for who was answered from them; disclose; re-scope; only then re-enable |
| Sync bypassed the ingest splice | **HIGH — a re-ingest, not a migration** (`SEED-210`'s own warning) | route the splice; re-run classification + metadata over affected rows; **the embeddings survive** if chunking did not change — the one thing that keeps this from being catastrophic |
| Duplicates in the corpus | MEDIUM | group by `(user_id, content_hash)`, keep the oldest, retire the rest via `is_latest=false` (never delete — a relationship or a citation may point at it) |
| Prompt-injection incident with a write tool | **HIGH** | revoke the connection's grants; the shipped outbound audit receipts give the full list of what was sent and where; disable auto-approval globally (the kill-switch grid exists); *then* build the corpus |
| Source deletions silently propagated (data loss) | MEDIUM→HIGH | recoverable only if `purge` was never reached — which is why the three verbs are separate and only a human may purge |
| Embedding cost blowout | LOW (money) / MEDIUM (trust) | cap first, explain second; a per-connection spend counter next to the file count prevents the repeat |
| Recall degradation discovered late | MEDIUM | enable iterative scan / raise `ef_search` — a config change, not a re-index — **but only if a baseline exists**, which is why the harness is a prerequisite |
| Four codebases | **HIGHEST of all — it is a milestone, not a fix** | the only cheap moment is before the second adapter merges |

## Pitfall-to-Phase Mapping

| # | Pitfall | Slot | Kind | Verification that prevention worked |
|---|---|---|---|---|
| 1 | Folder placement widens connection visibility | `P-PERM` + `P-RULES` | **ARCH** | direct-SQL test as a second user; a rule targeting a shared folder produces a suggestion, not a move |
| 2 | Connecting user becomes a gateway | `P-PERM` | **ARCH** | connect flow requires a scope; preview states count + tree; `source_principals` column exists |
| 3 | Retrieval leaks substance with no audit | `P-PERM` | **ARCH** | one `audit_log` row per connection-sourced retrieval hit; "who saw content from C" is one query |
| 4 | Lethal trifecta / indirect injection | `P-UNTRUSTED` (fence **ARCH**, corpus HARD) | both | a planted payload in a synced document fails to trigger a write tool, on the full native roster |
| 5 | Silent polling failures | `P-WATCH` + `P-CONTRACT` + `P-QUEUE` | ARCH + build | two-ticks-one-sync test; empty-page-continues test; forced token-expiry test; a visible `skipped_still_running` |
| 6 | First-sync stampede + cost | `P-QUEUE` (**ARCH**), preview in `P-WATCH` | **ARCH** | kill a worker mid-sync → zero stuck documents; the cap observed under a 5k-file synthetic; the preview shows an estimate |
| 7 | pgvector recall at scale | harness in `P-QUEUE`, tuning in `P-SCALE` | HARD | measured recall on a synthetic multi-connection corpus, before and after |
| 8 | Lifecycle: ignored vs over-honoured | `P-LIFECYCLE` | **ARCH decision** | absence never deletes; disconnect freezes and says so; purge enumerated and tested |
| 9 | Two ingest doors / dedup in the handler | `P-CONTRACT` | **ARCH, prerequisite** | same bytes through both doors ⇒ identical rows, by test |
| 10 | Guarantees at the watched door only | `P-CONTRACT` + `P-RULES` | **ARCH** | a synced doc carries classification + metadata + MIME/size policy identically to an uploaded one |
| 11 | Email is a shape | `P-MAIL` (**last**) | build | a 10-message thread ⇒ one document, no quoted duplication, stable identity across replies |
| 12 | Four adapters ⇒ four codebases | `P-CONTRACT`, fence with adapter #2 | **ARCH** | CI fence: no `provider ==` outside `adapters/`; conformance suite green for all four + a fake |
| 13 | `SEED-239` blast radius on a watcher | `P-WATCH` | build | one malformed config row degrades one source, not all sources |

### Recommended ordering consequence for the roadmapper

`P-CONTRACT` and `P-PERM` are **both** prerequisites and both are schema-bearing; they should be **one wave, not sequential**, because the visibility column and the splice extraction touch the same rows. `P-QUEUE` must precede any adapter reaching a real customer. `P-WATCH` is the first *user-visible* phase and should ship with **exactly one** adapter. The **second** adapter is where the abstraction fence is committed. **`P-MAIL` is last and is a shape phase.** `P-UNTRUSTED`'s fence rides with the first sync; its corpus is a GA gate. `P-SCALE` follows real corpus growth, but its **harness** ships early.

## Sources

**Disclosed incidents (HIGH confidence — named CVEs / vendor advisories / researcher writeups):**
- [EchoLeak CVE-2025-32711 — HackTheBox analysis](https://www.hackthebox.com/blog/cve-2025-32711-echoleak-copilot-vulnerability) · [arXiv 2509.10540](https://arxiv.org/html/2509.10540v1) · [Sentra](https://sentra.io/blog/copilot-echoleak-prompt-injection)
- [AgentFlayer — Zenity Labs, Black Hat 2025](https://labs.zenity.io/p/agentflayer-chatgpt-connectors-0click-attack-5b41) · [CSO Online](https://www.csoonline.com/article/4036868/black-hat-researchers-demonstrate-zero-click-prompt-injection-attacks-in-popular-ai-agents.html)
- [ShadowLeak — Radware, via The Hacker News](https://thehackernews.com/2025/09/shadowleak-zero-click-flaw-leaks-gmail.html) · [Infosecurity Magazine](https://www.infosecurity-magazine.com/news/vulnerability-chatgpt-agent-gmail/)
- [GitHub MCP exfiltration — Invariant Labs](https://invariantlabs.ai/blog/mcp-github-vulnerability) · [devclass](https://www.devclass.com/ai-ml/2025/05/27/researchers-warn-of-prompt-injection-vulnerability-in-github-mcp-with-no-obvious-fix/1623458)
- [The lethal trifecta — Simon Willison](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)

**Permission-aware indexing / oversharing (HIGH on Microsoft's own guidance; MEDIUM on vendor-blog figures):**
- [Microsoft 365 Copilot best practices with SharePoint](https://learn.microsoft.com/en-us/sharepoint/sharepoint-copilot-best-practices) · [Restricted SharePoint Search](https://learn.microsoft.com/en-us/sharepoint/restricted-sharepoint-search) — ⚠ **the cost of the best-documented mitigation, stated by its own vendor: max 100 sites, explicitly temporary, new enablement blocked from 2026-07-31 and retiring 2027-01-31**, replaced by per-site Restricted Content Discovery
- [Mitigate oversharing — Microsoft Community Hub](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/mitigate-oversharing-to-govern-microsoft-365-copilot-and-agents/4448744) · [Petri: "Copilot didn't overshare your data. Your permissions did."](https://petri.com/copilot-didnt-overshare-your-data-your-permissions-did/)
- [Propagating SharePoint document permissions to AI Search and RAG pipelines — Microsoft ISE](https://devblogs.microsoft.com/ise/sharepoint-doc-level-access/) · [Document-level RBAC for RAG pipelines — Truto](https://truto.one/blog/how-to-maintain-document-level-rbac-in-enterprise-rag-pipelines/) (MEDIUM — vendor blog, but its "sync entitlements more often than content" and "re-check at query time" patterns are corroborated by the Microsoft ISE post)

**Provider sync semantics (HIGH — official docs / official Q&A):**
- [Google: Synchronize clients with Gmail](https://developers.google.com/workspace/gmail/api/guides/sync) · [Drive: manage changes](https://developers.google.com/workspace/drive/api/guides/manage-changes) · [Drive issue 406305173 — empty page with a non-null `nextPageToken` on shared drives](https://issuetracker.google.com/issues/406305173)
- [Microsoft Graph delta query overview](https://learn.microsoft.com/en-us/graph/delta-query-overview) · [MS Q&A: delta token expiration and 410 resyncRequired](https://learn.microsoft.com/en-us/answers/questions/5856875/microsoft-graph-delta-api-clarification-on-delta-t)

**Scale (MEDIUM — engineering write-ups, corroborated across sources):**
- [pgvector 0.8 iterative scans — Nile](https://www.thenile.dev/blog/pgvector-080) · [Scaling vector search in Postgres — ClickHouse](https://clickhouse.com/resources/engineering/scale-vector-search-postgres)
- [Embeddings in production: costs to embed — Barnacle Labs](https://medium.com/barnacle-labs/embeddings-in-production-or-how-nothing-scales-like-youd-expect-it-to-part-1-costs-to-embed-a82482765215) · [The backfill that re-ran your entire AI bill](https://tianpan.co/blog/2026/07/06/the-backfill-that-re-ran-your-entire-ai-bill)
- [RAG over email — Nylas](https://cli.nylas.com/guides/rag-over-email) (MEDIUM — vendor guide; the strip-signatures-and-quoted-chains advice is standard practice, not a measured result)

**This repository (HIGHEST confidence — read on 2026-09-04):**
- `backend/app/api/documents.py` — `upload_document:547`, `content_hash:620`, dedup `:624-640`, versioning `:643-663`, `_upload_pipeline:239`, `ingest_document:2030`, attachment cascade `:2405-2443`, classification splice `:2469`
- `supabase/full-schema.sql` — documents SELECT policy `:5452`, `documents_dedup_idx:3021`, `documents_completed_hash_unique_idx:3014`
- `backend/app/db/schedules.py:263` (`claim_due_schedules`), `backend/app/models/schedule.py` (`compute_next_run_at`), `backend/app/services/scheduler_service.py`
- `backend/app/services/email_extraction_service.py` — quoted-chain stripping, `message_id:281/377`, attachment caps
- Seeds: `SEED-210` `SEED-209` `SEED-211` `SEED-188` `SEED-077` `SEED-076` `SEED-197` `SEED-048` `SEED-079` `SEED-072` `SEED-239` `SEED-142` · `PROJECT.md` (v4.0 scope + binding constraints) · `STATE.md` · `CLAUDE.md`

**Explicitly marked as inference rather than documented cases:** the identical-attachment unique-index collision in Pitfall 9 (derivable from the index definition plus the unguarded insert; one test settles it); the `P-MAIL` v1 boundary recommendation in Pitfall 11; the freeze-on-disconnect recommendation in Pitfall 8. Each is offered as an opinion because `SEED-210`'s own rule applies — *a legitimate v1 is fine; silence is not.*

---
*Pitfalls research for: scheduled multi-source ingestion retrofitted onto an existing production RAG platform (v4.0 Connected Knowledge)*
*Researched: 2026-09-04*

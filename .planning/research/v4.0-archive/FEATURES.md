# Feature Research — v4.0 Connected Knowledge

**Domain:** Scheduled, permission-aware ingestion from connected sources into an existing RAG/DMS Library
**Researched:** 2026-09-04
**Confidence:** HIGH on Onyx (source code + docs read directly) and Microsoft 365 Copilot connectors (Learn docs read verbatim) · MEDIUM-HIGH on Glean (builds on `.planning/research/deep-dive/GLEAN.md` + docs) · MEDIUM on Dropbox Dash, Notion AI, NotebookLM, Slack (help-centre + announcement pages only) · **LOW on LlamaCloud connectors — its Drive/SharePoint data-source pages document authentication only and say nothing about sync cadence, deletions, previews or unsupported types. Stated as a gap, not filled with a guess.**

> **This file supersedes the v3.6 Visual/No-Code Workflow Studio FEATURES.md** that occupied this slot (prior content preserved in git history). It covers **only the six features being ADDED in v4.0**. Manual upload, folders, chunking, pgvector retrieval, custom metadata, saved views, relationships, auto-classification, governance health, the v3.9 connector platform, the Phase 216 one-file attach, the five-tab Library and the Phase 204 scheduler are **already shipped and are treated here as dependencies, never as candidates.**

---

## Part 0 — The three findings that should shape the roadmap before any feature list

### F-1 ⭐ The preview/dry-run moment is genuine white space in this product class — and it exists everywhere in the class next door

**Measured, not assumed.** I read the setup and management documentation for Onyx, Microsoft 365 Copilot connectors, Glean, Dropbox Dash, Notion AI connectors, NotebookLM and LlamaCloud. **None of them shows you what a sync would bring in before it brings it.** In every one, the setup wizard ends and indexing begins; the counts appear *afterwards*, on a status page, as a fait accompli. Onyx's connector creation form goes straight to a `Scheduled` index attempt. Microsoft's ends in `Syncing`. Dash's ends in `Syncing: "This can take a few hours to a few days, depending on how much content is in the source."`

⚠ **This is a negative claim and is flagged as such.** It rests on the absence of any preview/dry-run/assessment step in each product's own setup documentation, not on a vendor statement that no such step exists. Confidence MEDIUM-HIGH.

**But the pattern is fully developed one product class over**, and that is where the screen design should be stolen from:

| Where the pattern lives | What it does | Quotable |
|---|---|---|
| **Microsoft Migration Manager** (`mm-scan`) | A **scan phase that crawls the source and produces reports without moving any data** — path-length violations, unsupported file types, over-size items, permission-scope counts. Per-source-path rows with "migration readiness *warnings*". Downloadable **summary report** and **detailed scan log listing every file**. | "Migration readiness *warnings* gives you insight into any issues and how to remediate them." |
| **Open WebUI `oikb` KB sync** | `--dry-run` flag | "preview exactly what would change and upload nothing" |
| **DataHub CLI** | `--dry-run` (all steps except the write) **and** a separate `--preview` (limited ingestion, to see results fast) | Two different questions, two different flags |
| **rclone / RcloneView** | `--dry-run` before transfer | The oldest form of the idea |
| **Fivetran** | Schema selection + **Schema Change Handling** *before* and *during* the connection's life: `Allow all` / `Allow columns` / `Block all` | The rules half of a preview |

⭐ **The takeaway for the roadmap: the preview is not a novel invention that needs proving — it is a proven pattern from migration tooling that has never been applied to RAG ingestion.** That is the strongest possible position: low invention risk, high differentiation.

### F-2 ⭐ The preview and the deletion-detection pass are THE SAME CHEAP CALL — Onyx already proves it

Onyx's connector contract (read directly from `backend/onyx/connectors/interfaces.py`) splits into exactly three flows, and the third one is the whole answer:

```python
class LoadConnector(BaseConnector):
    def load_from_state(self) -> GenerateDocumentsOutput:   # "Complete state or savestate file pull"

class PollConnector(BaseConnector):
    def poll_source(self, start, end) -> GenerateDocumentsOutput:   # "Small set updates by time"

class SlimConnector(BaseConnector):
    def retrieve_all_slim_docs(self, start, end, callback) -> GenerateSlimDocumentOutput:
        """Retrieve just document IDs"""
```

Onyx's own README describes the Slim connector as *"only fetches the IDs of the documents, not the documents themselves"* — **built for the pruning job**, i.e. deletion detection. A list-only, bytes-free enumeration.

⭐ **That same list-only enumeration IS the preview.** `list` (IDs + names + types + sizes + modified time) answers all three preview buckets without reading a single byte, and re-run later it answers "what disappeared". **One adapter method, two features.** This maps directly onto the milestone's binding `list → read → hash → splice` contract: **the preview is `list` alone; the ingest is `read → hash → splice`.**

Onyx's contract also carries `validate_connector_settings()` — *"Override if connector needs to validate credentials or settings. Raise an exception if invalid, otherwise do nothing"* — which is the "a source that stopped reading says so" feature, expressed as one method on the same contract.

### F-3 ⛔ "Already here is a `content_hash` lookup, not a guess" is only true AFTER the bytes are downloaded — and that breaks the cheap preview

`PROJECT.md` states the preview's *already here* bucket is "a `content_hash` lookup, not a guess". Measured against both this codebase and both provider APIs, **that cannot be done from a list-only pass**:

- **Ours:** `backend/app/api/documents.py:620` computes `content_hash = hashlib.sha256(raw).hexdigest()` **over the raw uploaded bytes**, and `:629` dedupes with `.eq("content_hash", …)`. It requires the bytes.
- **Google Drive:** `md5Checksum` / `sha256Checksum` are populated **only for binary uploads**. Native Docs/Sheets/Slides have no content hash at all — the documented workaround is comparing `version` or `modifiedTime`.
- **Microsoft Graph:** *"QuickXorHash is the only value guaranteed to be available"* for OneDrive work/school; `sha1Hash`/`crc32Hash`/`sha256Hash` are **not available** on OneDrive for Business / SharePoint Server 2016; current Graph docs **mark `sha256Hash` as unsupported and say not to use it**; and *"if hash values are not available … hash values on an item will be updated after the item is downloaded."*

⭐ **Recommended resolution (hand this to the roadmapper as a decision, not a discovery):** *already here* is a **two-tier** answer.
1. **Tier 1 — identity key, cheap, list-only:** `(source_system, external_id, source_version)` where `source_version` is `etag` / `version` / `modifiedTime` / `quickXorHash` — whatever that adapter can get for free. This is SEED-209's proposed identity key and it is the only thing a preview can honestly use.
2. **Tier 2 — `content_hash`, exact, at ingest:** the existing sha256 dedupe still runs at splice time and still catches "this was also uploaded by hand". A file that Tier 1 called *will be added* and Tier 2 recognises becomes a **version**, not a twin.

The preview must therefore label the bucket honestly: **"Already here (matched by source file, not by content)"** — and a fourth, small bucket, **"Can't tell without reading it"**, is more honest than forcing every row into three.

---

## Feature Landscape

### Table Stakes (users will assume these exist)

| # | Feature | Why expected — grounded in what a real product does | Complexity | Depends on (SHIPPED) |
|---|---|---|---|---|
| TS-1 | **Map one external folder → one Library folder, per connection** | Every product scopes a connection to a subtree. Glean: *"content inclusion and exclusion filters … and crawl scope settings"*. Onyx: per-connector config + `Indexing Start Date`. Without scoping, the first thing every user does is ingest their entire Drive by accident. | **MED** | v3.9 connector platform (`connector_connections`, `connector_service.py`); Library folder tree (`FolderTree.tsx`, `api/folders.py`) |
| TS-2 | **A stated check interval, editable** | Onyx ships `Refresh Frequency` — *"The frequency at which new data should be retrieved from the source"*, **default 30 minutes**. Microsoft: *"repeat crawls within a day with intervals ranging from 15 minutes to 12 hours"*. Users expect to see and change the number. | **LOW** | Phase 204 scheduler — `scheduler_service.py` poll loop, `MIN_INTERVAL_SECONDS = 60` and the `schedule_cadence_exactly_one` CHECK in `models/schedule.py` |
| TS-3 | **"Check now" / on-demand run** | Microsoft ships **on-demand crawl** with a full-vs-incremental dropdown. NotebookLM ships a per-source **"Click to sync with Google Drive"** button. Onyx ships *"initiate a complete re-indexing"* from the Manage menu. Nobody waits 30 minutes to test a change. | **LOW** | Scheduler (manual claim path); `schedules.py` API already has POST for a manual fire |
| TS-4 | **A named connection state, always visible** | Microsoft: `Syncing / Ready / Paused / Failed / Delete failed`. Dash: `Not connected / Enabled / Syncing / Connected / Error`. Onyx: `Indexed / Scheduled / Indexing / Initial Indexing / Paused / Error`. **All three converge on five-ish states — copy the convergence.** | **LOW** | `applicationAvailability.ts` + `AvailabilityLine.tsx` (221-02) already do exactly this shape for per-application readiness — extend, do not invent |
| TS-5 | **"Last checked" and "last change found" as separate facts** | Microsoft, verbatim: *"**Last sync time** indicates when the last successful crawl happened. **The connection is as fresh as the last sync time.**"* One timestamp is not enough — "checked 4 min ago, found nothing new in 3 days" is a healthy source; "checked 3 days ago" is a broken one, and one field cannot say both. | **LOW** | New columns on the watch row; Library Health tab (`knowledge_health.py`) is the display home |
| TS-6 | **A per-run history with counts and errors** | Microsoft's connection pane: **Details / Errors / Statistics** tabs showing *"the number of items indexed, item errors, user and group errors"*, plus **CSV export** of connection config. Onyx: `IndexAttempt` rows rendered as indexing-attempt history + `SyncAttemptsTabs`. Bedrock: per-sync-event **"View warnings"**. | **MED** | `audit_log` (the outbound receipt precedent from v3.9); Library `indexing` tab already exists as a mount point |
| TS-7 | **The connection says who it is authenticated as** | Every OAuth product shows the connected account. It is also the honest half of the visibility sentence — *we can only see what that account can see*. | **LOW** | v3.9 OAuth (Phase 215/221), `ConnectionsTab.tsx` |
| TS-8 | **Failure notification that reaches a human who is not looking at the page** | Microsoft sends permanent-crawl-failure notifications to the **service health dashboard**, an admin-home notification bar, and an **email subscription** ("Issues in your environment that require action"). A watcher failing silently is the defining failure of this feature class. | **MED** | ⚠ **No in-app notification surface exists here.** Nearest shipped analogue is `PendingAskCard.tsx` / the approval checkpoint. This is a real gap — see PITFALL note in Dependencies. |
| TS-9 | **Pause without deleting** | Microsoft: *"Paused — the crawls are paused by the admin … **However, the data from this connection continues to be searchable.**"* Onyx: `Paused` = "suspended but accessible". Users expect pause to stop *reading*, never to stop *knowing*. | **LOW** | Library retrieval path unchanged; one flag on the watch row |
| TS-10 | **Type coverage stated up front** | NotebookLM states its limit plainly: auto-sync works only for native Workspace files; *"web links, pasted text, local PDFs, and audio files won't refresh automatically."* Users assume everything syncs unless told otherwise. | **LOW** | ⭐ `frontend/src/components/ingestion/acceptedFormats.ts` — the ONE accepted-formats list, already fenced as a **subset** of `ALLOWED_MIME_TYPES` in `documents.py`. The preview's *"type not supported"* bucket must derive from this, never re-type it. |
| TS-11 | **Rules decide the folder; unmatched goes to a review queue** | Fivetran's `Schema Change Handling` is the same idea at table grain: `Allow all` / `Allow columns` / `Block all`, changeable at any time. SEED-209 already specifies the behaviour: rules **suggest, never move**; unmatched → **review queue, never silent default filing**. | **MED** | ⭐ Phase 118 classification rules — `classification_rules.py`, `classification_matcher.py`, `RuleBuilderPanel.tsx`. Its own docstring: *"a rule is evaluated **on upload by the ingest splice**"* — the connector must arrive through that splice (SEED-209's binding rule). |
| TS-12 | **Disconnect answers what happens to the documents** | Microsoft's answer is deletion of the connection with a `Delete failed` state if it goes wrong. Onyx deletes the connector's documents. SEED-072/SEED-210 name this as **undecided policy** here: retain / freeze / purge. Users will not accept "unspecified". | **MED** | SEED-072 (erasure), `documents` soft-delete, `audit_log` |

### Differentiators (real competitive advantage — nobody in this class ships these)

| # | Feature | Value proposition | Complexity | Depends on (SHIPPED) |
|---|---|---|---|---|
| **D-1** ⭐ | **The three-way preview, with nothing ingested until a person says so** | **The milestone's headline claim, and it is genuinely unoccupied in this product class (F-1).** Every competitor's first act is to index. Ours is to *show a bill*. This is the single sentence a demo is built on: *"before it takes anything, it shows you exactly what it would take."* | **HIGH** | The `list` half of the new adapter contract; `acceptedFormats.ts`; Library folder tree |
| **D-2** ⭐ | **The preview shows where the rules WOULD file each document** | Nobody previews *routing*. Microsoft's scan previews *readiness*; Fivetran previews *schema*. Previewing **"812 files → 6 folders by 4 rules; 24 match no rule"** turns the preview from a file count into a **dry run of the classification engine**, which is the thing SEED-209 says must not grow a second implementation. | **MED** (rules engine exists; needs a no-write evaluation mode) | ⭐ Phase 118 `classification_matcher.py` — needs a pure `evaluate_without_persisting` path |
| **D-3** ⭐ | **Refusal-shaped honesty about freshness, enforced in the copy** | Microsoft is the only vendor that words this well (*"The connection is as fresh as the last sync time"*) and even they bury it in docs. Glean says permissions *"sync in real time"*; NotebookLM says content *"updates automatically to match"*; Slack claims *"no indexing or storing — just the most up-to-date information, always"*. **Shipping a product that refuses to say "instantly" is a trust position, not a limitation** — and it is already this project's house style (run honesty, `Needs you`, publish refusals). | **LOW** | The v3.7/v3.9 vocabulary-module pattern (`doorVocabulary.ts`, `publishRefusalVocabulary.ts`) — one `watchVocabulary.ts` with a fence forbidding the banned words |
| **D-4** ⭐ | **The visibility sentence, shown at the moment of consequence** | Onyx has the best sentence in the class (*"Only the user who created the Connector may see data from this Connector in Onyx"*) but shows it once in a form. Microsoft shows two options and then **cannot change them afterwards**. Ours should restate it **on the preview confirm button's screen**, where it is a consequence rather than a setting. | **LOW** | `connectionsCopy.ts` / `connectionRefusalCopy.ts` pattern |
| **D-5** ⭐ | **A removed-at-source *review queue*, not a deletion** | Everyone else deletes: Elastic full sync *"deletes any documents in Elasticsearch which no longer exist in the third-party data source"*; Microsoft auto-removes at 28 days; Onyx prunes on a 30-day timer. **We surface the fact and let a person decide** — which is the same suggest-never-move grain Phase 118 already shipped for classification. Consistency with an existing shipped behaviour is what makes this cheap. | **MED** | Phase 118 suggest-never-move UX grain; `documents` soft-delete; Library `health` tab |
| **D-6** | **The preview is re-runnable on an established connection ("what would the next check bring?")** | DataHub separates `--dry-run` from `--preview` for a reason. A preview that only exists at setup is a one-time gate; a preview that can be run against a live watch is an **ongoing control**, and it is free once `list` exists. | **LOW** (given D-1) | D-1 |
| **D-7** | **Source facts as first-class filterable metadata** | SEED-209's gap: nobody can write *"anything from the DMT SharePoint library → class: Programme Doc"* today. Glean/Copilot index source metadata but expose it as ranking signal, not as a user-writable rule vocabulary. Our custom-field whitelist is already *built-ins ∪ enabled custom fields*, so this is a **mapping, not a system**. | **MED** | ⭐ `document_view_resolver.py:128-150` (the whitelist), custom field definitions, saved Views (`document_views.py`) |
| **D-8** | **A named, auditable "what this watch actually did" receipt per run** | v3.9 already ships an **audit receipt per outbound call**. Extending the same receipt shape inbound gives a symmetry no competitor has: egress and ingress in one ledger, one vocabulary. Glean logs agent actions; nobody logs *ingestion decisions* at receipt grain. | **MED** | `audit_log`, the v3.9 receipt vocabulary, admin Audit tab (`AuditTab.tsx`) |
| **D-9** | **Ingest-time footprint estimate in the preview** (pages / chunks / embedding calls) | Nobody shows cost before ingestion. Given `SEED-076/077` (embed batching, provider fallback) are in this milestone anyway, the estimate is a by-product of work already being done, and it converts the preview from "what" into "what it will cost me". | **MED** | SEED-243's page-count finding (`extraction_service.py:172` already iterates `reader.pages` and discards the count) |

### Anti-Features (things these products actually ship that this milestone should deliberately NOT do)

Every row below is something a **named real product does today**, with the evidence.

| # | Anti-feature | Who ships it | Why it is a trap here | What we do instead |
|---|---|---|---|---|
| **AF-1** ⛔ | **Auto-delete documents that stop being seen at the source** | **Microsoft, verbatim:** *"If connection failures prevent delete detection from running reliably, items that aren't rediscovered during crawls for 28 days are automatically removed from the Microsoft 365 index to maintain compliance."* Also **Elastic** (full sync deletes), **Onyx** (`Prune Frequency`, default 30 days). | ⭐ **Onyx issue #1161 is the proof this fails catastrophically:** a web connector run **with no internet connection** logged `New Doc Cnt: 0 (also removed 976 docs that were detected as deleted in the source) Total Doc Cnt: 0` — an unreachable source was read as "everything was deleted", and the knowledge base was emptied. **Closed as not planned.** Note Microsoft's own sentence admits the same hazard and deletes anyway. | **PROJECT.md's rule is correct and now has evidence behind it.** A file gone at the source becomes a **surfaced fact plus an offered action** (D-5), never an automatic removal. |
| **AF-2** ⛔ | **Visibility that cannot be changed after setup** | **Microsoft, verbatim:** *"Updating access permissions after you create the connection isn't currently supported."* The documented remedy is **delete the connection and recreate it**. | Our connection-scoped visibility (SEED-210 Option 3) is deliberately **cruder** than per-document ACLs. Crude + immutable = a mistake that costs a full re-ingest. Crude + editable is defensible. | Visibility is **one editable field on the connection**, and changing it is an audited event that re-scopes rows — never a re-ingest. |
| **AF-3** ⛔ | **A rule/scope change that requires deleting the connection** | **Microsoft, verbatim:** *"To update this connection, first delete the existing connection and create a new one with a data source exclusion filter that excludes the items you no longer want to index."* | Same trap as AF-2, one layer up. It also **destroys the run history**, which is the surface a user needs most when a rule was wrong. | Scope + rules are editable in place; the next scheduled check reconciles. Because rules **suggest and never move** (Phase 118), a changed rule cannot silently relocate ten thousand documents. |
| **AF-4** ⛔ | **A green verdict that hides that nothing will work** | **Microsoft Migration Manager:** *"Even if a scan task includes only unsupported files for all failed items, it can still achieve a **'Ready to migrate'** status."* | This is the exact way to ruin D-1. A preview that says READY over `will be added: 0` is worse than no preview, because it converts a user's caution into false confidence. | The preview's verdict is **the counts themselves** — the confirm button reads **"Bring in 812 files"**, and at zero it is disabled and says why. **No status word ever summarises the three buckets.** |
| **AF-5** ⛔ | **"Instantly" / "on change" / "real-time" / "always up to date"** | **Glean:** *"permission changes sync in real time"* · **NotebookLM:** *"the information within the notebook updates automatically to match"* (the announcement gives **no cadence at all** — I checked) · **Slack:** *"no indexing or storing — just the most up-to-date information, always"*. | Slack's claim is *true* because it is federated (query-time, no copy). **Ours cannot be, because we chunk and embed.** Copying the vocabulary of a federated product into a copying product is the specific lie PROJECT.md forbids. | **"Checked every N minutes."** Plus the two separate timestamps (TS-5). Enforced by a vocabulary fence, not by discipline. |
| **AF-6** ⛔ | **Per-document ACL mirroring in v1** | **Glean** (permission map per source, delta-synced) · **Onyx** `Auto Sync Permissions` (**Enterprise Edition only**, and only for 10 named connectors) · **Copilot** *"Only people with access to this data source"* (needs Entra identity mapping) · **Notion AI**, **Slack**, **Gemini** (all live-permission at query time). | ⚠ **The evidence supports the decision already taken.** Onyx — the closest architectural sibling — puts this **behind its paid tier and behind a per-connector allowlist**, because it requires identity mapping between our users and the source directory. That is its own project, exactly as SEED-210 Option 2 says. | **SEED-210 Option 3 as shipped v1**, stated plainly, with SEED-211's metadata-derived model recorded with a migration path. The re-open trigger is a real tenant measuring it insufficient. |
| **AF-7** ⛔ | **Silent scope creep from "a folder" to "the whole drive"** | Glean: *"most datasources require Glean support assistance for implementing crawl restrictions"* — i.e. the default is broad and narrowing needs a support ticket. | A watch that quietly widens is how a connection-scoped visibility model becomes a breach. The mapped folder is a **boundary**, not a starting point. | The watch is bound to one external folder id. A file that moves **out** of the mapped folder stops being watched and is surfaced as a lifecycle event — never followed. |
| **AF-8** ⛔ | **A second rule engine for "sync rules"** | Fivetran, Airbyte and every ETL product have connection-level rules entirely separate from anything downstream. It is the natural shape and it is wrong here. | SEED-209 + SEED-243 both say it explicitly: *"designed together rather than growing two rule engines."* A sync-side rule engine means classification guarantees hold for the door people watch and not the door the volume comes through. | The watch contributes **source facts to the existing field vocabulary** (D-7) and reuses Phase 118 matching. The only watch-owned settings are **scope, cadence, visibility, and update policy**. |
| **AF-9** ⛔ | **A separate "sync scheduler"** | Onyx, Glean and Copilot each run their own crawl scheduler with its own cadence semantics. | PROJECT.md forbids a new scheduler. It is also the correct call for a measured reason: `scheduler_service.py`'s duplicate-firing guarantee lives in `claim_due_schedules` (`FOR UPDATE SKIP LOCKED` + in-transaction `next_run_at` advance) and works **with no leader election across every uvicorn worker**. A second scheduler re-litigates a solved split-brain problem. | New **due-work kind** on the shipped claiming transaction. `MIN_INTERVAL_SECONDS = 60` and the `schedule_cadence_exactly_one` CHECK come for free. |
| **AF-10** ⛔ | **A source-mirroring folder tree in the Library** | The obvious thing; SEED-209 argues against it directly. | A mirrored tree must be re-mirrored on every source move, and it permanently fights the Library's own folder model. | **Mirror the source tree as metadata, not folders** (SEED-209 §3). Saved Views already render *"OneDrive / DMT / Contracts"* for free. |
| **AF-11** ⛔ | **Auto-filing everything unmatched into "Uncategorised"** | The default of most DMS imports. | SEED-209: *"Ten thousand documents landing in 'Uncategorised' is how a document-management system dies, and it is indistinguishable from working until someone searches."* | A **review queue** with a count on the Library Health tab, surfaced in the preview *before* the import (D-2). |
| **AF-12** ⛔ | **A "connected" state that means "credentials accepted"** | Dash's `Connected` means finished syncing; but many products (and our own v3.9 `CHAT-06` finding) show a green connection that has done nothing. | v3.9 already shipped two requirements *"narrower than their wording"* for exactly this reason. A watch that has never successfully listed anything must not read as healthy. | The state machine's first successful `list` is what promotes a watch out of `Never checked`. |

---

## Part 1 — The four deep-dive questions, answered

### Q1. The preview / dry-run moment — what the screen contains

Answered structurally in F-1/F-2/F-3. The **recommended screen**, assembled from Migration Manager's scan report + this product's own vocabulary conventions:

```
Google Drive · "Programme Docs"  →  Library / Projects / DMT
Checked just now · nothing has been brought in yet

  ┌ Will be added ─────────────────────────────── 812 files ┐
  │  Rules will file 788 of them into 6 folders.            │  ← D-2
  │  24 match no rule and will wait for you in Review.      │
  │  ~9,400 pages · ~11,000 chunks to embed                 │  ← D-9
  │  [ Show the list ]                                      │
  └─────────────────────────────────────────────────────────┘

  ┌ Already here ──────────────────────────────── 145 files ┐
  │  Matched by source file, not by content.                │  ← F-3, honest label
  │  Nothing will be added for these.                       │
  └─────────────────────────────────────────────────────────┘

  ┌ Can't read these ───────────────────────────── 37 files ┐
  │  31  file type we don't read yet  (.psd, .zip, .mp4)    │  ← from acceptedFormats.ts
  │   4  larger than the 50 MB limit                        │
  │   2  we don't have permission to open                   │
  └─────────────────────────────────────────────────────────┘

  Everything brought in here will be visible to <scope>.      ← D-4, at the point of consequence

  [ Bring in 812 files ]   [ Not yet ]
```

Non-negotiables derived from the evidence:
- **The verb carries the count** (AF-4). No word ever summarises the three buckets.
- **"Can't read these" is grouped by reason**, the way Migration Manager groups warnings — a flat list of 37 failures teaches nothing.
- **A downloadable/expandable per-file list**, as Migration Manager ships (*"download a detailed scan log, listing every file in the source path"*). It is what makes the number believable.
- **The preview writes nothing.** `oikb`'s phrasing is the acceptance test: *"preview exactly what would change and upload nothing."*

### Q2. How products communicate freshness — and where they overclaim

| Product | Wording | Verdict |
|---|---|---|
| **Microsoft 365 Copilot connectors** | *"**Ready** — the connection is ready, and there's no active crawl running against it. **Last sync time** indicates when the last successful crawl happened. **The connection is as fresh as the last sync time.**"* | ⭐ **The best sentence found in the entire study.** It defines freshness as an *observed fact*, not a promise. **Steal this shape verbatim.** |
| **Onyx** | `Refresh Frequency` — *"The frequency at which new data should be retrieved from the source"*, **default 30 minutes**. `Prune Frequency` — *"The frequency at which old data (that no longer exists in the source) should be removed"*, **default 30 days**. | Honest: cadence is a **user-visible setting with a number**. Note the deliberate asymmetry — **additions every 30 minutes, deletions every 30 days.** |
| **Dropbox Dash** | *"**Syncing** — Dash is syncing content from the app. This can take a few hours to a few days, depending on how much content is in the source."* | Honest about *initial* load. Rare and worth copying for the first preview-confirmed ingest. |
| **Glean** | *"permission changes **sync in real time**"* / *"reflected immediately in results"* | ⚠ **Overclaim** for anything the user can verify. Glean's own docs elsewhere describe crawls as *"daily, weekly, or custom intervals"* with a one-time full sync first. Two different cadences described in two different registers. |
| **NotebookLM / Gemini** | *"as the content in your Drive files evolves, the information within the notebook updates automatically to match"* | ⚠ **Overclaim by omission.** I fetched the announcement specifically to find a cadence: **there is none — no interval, no "checks every", nothing.** "Automatically" is doing all the work. |
| **Slack Enterprise Search** | *"no indexing or storing — just the most up-to-date information, always"* | ✅ **True for Slack, and unavailable to us.** Federated/query-time retrieval genuinely has no staleness. **This is the sentence we must never borrow**, because borrowing it is the exact lie that copying-plus-chunking makes. |

**Recommended sentences for this product (concrete, per the downstream consumer's ask):**

- Healthy: **"Checked every 30 minutes. Last checked 4 minutes ago. Last new file found 3 days ago."**
- Never yet: **"Not checked yet. The first check runs within 30 minutes, or check now."**
- Definitional line, on the source detail: **"This folder is as current as the last check."**
- Banned, by fence: `instantly` · `on change` · `real-time` · `real time` · `live` · `always up to date` · `immediately`.

⭐ **Make the ban executable.** This project's own pattern is the answer: a `watchVocabulary.ts` leaf plus a fence test asserting no banned substring appears in any string it exports — the same shape as `acceptedFormats.ts`'s subset fence against `ALLOWED_MIME_TYPES`. A style rule nobody can violate beats a style rule.

### Q3. Explaining permission scope in plain language when it is connection-scoped

**The best real sentence in the class is Onyx's**, and it is exactly our model:

> **Private:** *"Only the user who created the Connector may see data from this Connector in Onyx."*
> **Public:** *"All Onyx users may see data from this Connector."*
> **Auto Sync Permissions:** Onyx maintains access controls from the source — *Enterprise Edition, 10 named connectors only.*

Onyx names the scope **in terms of who can see it in OUR product**, never in terms of the source's model. That is the trick: it doesn't have to explain SharePoint inheritance, and it doesn't have to apologise.

Microsoft's pair is the runner-up and shows the failure mode of framing it as a source promise:
> *"**Only people with access to this data source**: The connector respects source system access control lists (ACLs)."*
> *"**Visible to everyone**: The connector grants access to all users in the organization."*
…with the standing warning: *"Incorrect access permission settings, such as granting access to **Everyone**, can lead to oversharing of sensitive content."*

⭐ **Proposed honest, non-alarming sentence for connection-scoped visibility**, written to satisfy SEED-210's *"Option 3 or 4 is a legitimate v1 — silence is not"*:

> **"Everything this connection brings in will be visible to *everyone in <Org>*.**
> We don't copy per-file sharing from Google Drive. If a file is restricted to a few people there, bringing it in here makes it readable — and quotable in answers — by everyone in the scope above.
> You're connected as **fhdmrd@gmail.com**, so we can only ever see what that account can see.
> *Change who can see this →*"

Why each line earns its place:
1. **Scope first, in our terms** (Onyx's move) — the user learns the outcome before the mechanism.
2. **The negative is stated, not hidden** — this is the whole point of SEED-210. "We don't copy per-file sharing" is one clause and it forecloses silence.
3. **"and quotable in answers"** — SEED-210's own sharpest observation is that *"a synthesised answer can leak a document's substance without ever surfacing its name."* A visibility sentence that only mentions *seeing* under-describes a RAG system.
4. **The connected identity is the natural upper bound** and reads as reassurance rather than warning — SEED-210 Option 4's honest half, for free.
5. **A link, not a modal.** AF-2: changeable, always.

⚠ **Do not use a red/warning treatment.** Microsoft's own guidance frames "Everyone" as a hazard; the reco.ai framing of the whole class is sharper — *"Gemini does not create new access; it activates years of access debt at machine speed."* But a warning-coloured banner on every connection trains people to dismiss it. **Plain body text at the point of consequence (the preview confirm) beats a yellow box at setup.**

### Q4. Deletion and revocation UX — what others do

| Event at source | Onyx | Microsoft Copilot connectors | NotebookLM / Gemini | Elastic | **Recommended here** |
|---|---|---|---|---|---|
| **File deleted** | Pruned on `Prune Frequency`, **default 30 days** | **Auto-removed after 28 days** of not being rediscovered — *even when the cause is connection failure* | *"strictly respect file deletions"* — the source is gone, so the source is gone | Full sync *"deletes any documents in Elasticsearch which no longer exist"* | ⭐ **Surfaced, never removed.** `"3 files are no longer at the source. They're still in your Library. [Review] [Remove them]"` |
| **Unshared / permission narrowed** | Only meaningful under EE `Auto Sync Permissions` | ACL delta via identity crawl | *"If a user's access to a Drive file is revoked, they will no longer be able to use that file as a source"* — possible **only because Gemini keeps the file live rather than copying it** | Access-control sync (EE) | **Surface it. Do not act.** It changes nothing about connection-scoped visibility, and pretending otherwise would be a false security claim. Record it on the document row as a source fact (D-7). |
| **Moved** | Re-crawled; out-of-scope items get pruned eventually | Depends on scope filters | n/a | n/a | **Moved out of the mapped folder = stops being watched, stays in the Library, says so.** Never follow it (AF-7). |
| **Modified** | Re-index → replace | Incremental crawl → update | Auto-sync (native Workspace files only) | Incremental sync by id+timestamp | **New version** via the shipped `version_number` / `is_latest` model, gated by the update policy the rules set. |
| **Connection disconnected** | Deleting the connector removes its documents | Delete removes the connection; `Delete failed` if it goes wrong. Separately, a **`Copilot Visibility` toggle**: *"If the connection is off, it can still crawl the data source, but the data isn't used for search results."* | n/a | n/a | ⭐ **Three named choices at disconnect time — retain / freeze / purge** — which is SEED-072's undecided row, and Microsoft's visibility toggle is a shipped precedent for **freeze**. Default: **freeze** (documents stay, stop being retrieved, can be restored). |

⭐ **The strongest single argument for the milestone's no-auto-delete rule is Onyx issue #1161** (AF-1): an offline network deleted 976 documents, and the issue was **closed as not planned**. Microsoft's own wording concedes the same hazard — *"if connection failures prevent delete detection from running reliably"* — and deletes at 28 days regardless. **A deletion pass cannot distinguish "gone" from "unreachable" without a healthy source, and a healthy source is exactly what you don't have when it matters.**

### Q5. Where the "what did it actually do" surface lives

Three shipped precedents, all agreeing on placement:

- **Onyx:** on the connector's own page, under **Advanced** — indexing-attempt history, prune/refresh settings, and `SyncAttemptsTabs` for permission syncs. Backed by an `IndexAttempt` row per run (status + stage metrics) served from `/admin/cc-pair/{id}/index-attempts`.
- **Microsoft:** on the connection detail pane — **Details** (items indexed, item errors, **user and group errors**), **Errors**, **Statistics** (indexing activity, crawl statistics), plus **Export configuration** to CSV and **service-health notifications** for permanent failures.
- **Bedrock:** per-sync-event rows with **"View warnings"** and a documents-ingested count.

**Recommendation:** the run log lives **on the source, not in a global feed**, and it is a **row per check**:

```
Today 14:32   Checked · 3 added · 1 updated · 0 removed · 2 couldn't be read   [details]
Today 14:02   Checked · nothing changed
Today 13:32   Couldn't check · Google refused the connection (sign-in expired)  [Reconnect]
```

Two things the competitors get right and must be copied: **item-level errors are separate from run-level failure** (Microsoft splits "item errors" from a `Failed` connection state — a run that read 998 of 1000 files is a *successful run with two problems*, not a failure), and **the Library Health tab is the right roll-up home** — it already exists (`knowledge_health.py`, `LibraryPage` `health` tab) and already carries the "signal → the action that fixes it" grain from Phase 119.

**"A source that stopped reading says so"** — the shipped-elsewhere pattern to copy is Onyx's: *units that fail repeatedly **auto-pause** and can be resumed by an operator*, plus `validate_connector_settings()` raising at credential-swap time. Our sentence:

> **"Stopped 2 days ago.** Google Drive refused the connection — the sign-in expired.
> The 412 documents already here are unaffected and still searchable.
> **[ Reconnect Google Drive ]**"

Three obligations in it, matching PROJECT.md's *"says so, says when, and offers the one action that fixes it"*: the state, the timestamp, **one** button. Plus the reassurance Microsoft and Onyx both make explicit (*"data … continues to be searchable"*), because the first fear on seeing an error is that the knowledge went away.

---

## Feature Dependencies

```
[Adapter contract: list → read → hash → splice]
    ├──enables──> [D-1 Three-way preview]        (uses `list` ONLY, never `read`)
    │                  └──requires──> [acceptedFormats.ts / ALLOWED_MIME_TYPES]   SHIPPED
    │                  └──requires──> [F-3 identity key (source_system, external_id, source_version)]
    │                  └──enhanced by──> [D-2 rules preview] ──requires──> [Phase 118 classification_matcher]  SHIPPED
    ├──enables──> [D-5 removed-at-source review]  (same `list` pass, run again)
    └──requires──> [v3.9 connector platform + OAuth (Phase 215/221)]   SHIPPED

[TS-2 cadence] ──requires──> [Phase 204 scheduler_service + claim_due_schedules]   SHIPPED
[TS-4/5/6 state, freshness, run log] ──requires──> [a watch row + a run row]   NEW
        └──displayed in──> [LibraryPage `indexing` + `health` tabs]   SHIPPED
[TS-8 failure notification] ──requires──> [an in-app notification surface]   ⛔ DOES NOT EXIST
[TS-11 rules routing] ──requires──> [the ingest splice]   SHIPPED (SEED-209's binding rule)
        └──requires──> [D-7 source facts as custom fields] ──requires──> [document_view_resolver whitelist]  SHIPPED
[TS-12 disconnect policy] ──requires──> [SEED-072 retain/freeze/purge decision]   ⛔ UNDECIDED
[D-4 visibility sentence] ──requires──> [SEED-210 Option 3 storage: one visibility field per connection]   NEW

[AF-9 second scheduler]  ──conflicts with──> [Phase 204 scheduler]
[AF-8 second rule engine] ──conflicts with──> [Phase 118 classification rules]  (SEED-209 + SEED-243)
[AF-6 per-doc ACL mirroring] ──conflicts with──> [SEED-210 Option 3 as shipped v1]
```

### Dependency notes — the ones that will bite

- **D-1 requires the identity key, and the identity key is a migration.** `content_hash` alone cannot answer *already here* from a list-only pass (F-3). The `(source_system, external_id, source_version)` triple must land on `documents` **before** the preview is built, or the preview will lie in its cheapest bucket.
- **D-2 requires the classification matcher to run without persisting.** `classification_rules.py`'s own docstring says *"there is no resolve route here; a rule is evaluated **on upload by the ingest splice**"* — a pure evaluation path is genuinely new code, but small, and it is the one thing that keeps SEED-209's "one rule engine" promise honest.
- **TS-8 has no home.** There is no in-app notification surface in this product. Options in cost order: (a) the Library Health tab signal (cheapest, but only seen by someone who looks), (b) an email on permanent failure (Microsoft's model), (c) reuse the approval-checkpoint surface. **Name this in the roadmap rather than discovering it in a phase.**
- **The scheduler is workflow-shaped.** `models/schedule.py` and `db/schedules.py` are built around `workflow_schedules` and launching a run via `_build_resume_context`. A watch is a *different kind of due work* on the same claiming transaction — plan for a **second consumer of `FOR UPDATE SKIP LOCKED` claiming**, not a second scheduler and not a workflow-shaped hack.
- **Email is a shape, not an adapter** (PROJECT.md already says this). Add the measured detail: **Onyx models Gmail as a connector but with a document boundary of one message**, and its checkpointing (`CheckpointedConnector`) exists partly because mailboxes don't enumerate cheaply. Our `list` contract assumes stable ids and a hash-ish version; a mailbox gives you neither for threads.

---

## MVP Definition

### Launch with (the watch loop that can be defended)

- [ ] **The adapter contract** — `list` (ids, names, types, sizes, modified/version) + `read` + `hash` + splice. Drive first, then Graph. *Because everything below is a projection of `list`.*
- [ ] **D-1 the three-way preview + a fourth "can't tell" bucket**, writing nothing, with a counted verb button. *The milestone's distinctive claim (F-1).*
- [ ] **F-3 the identity key** on `documents`. *Without it the preview's second bucket is a guess.*
- [ ] **TS-1/2/3** scope, stated interval, check-now — on the shipped scheduler.
- [ ] **TS-4/5** connection state + two timestamps, worded per D-3, fenced against the banned words.
- [ ] **TS-6** per-check run log with item-errors separated from run-failure.
- [ ] **D-4 the visibility sentence**, on the preview confirm and on the connection, editable (AF-2).
- [ ] **TS-11** rules route through the shipped splice; unmatched → review queue (AF-11).
- [ ] **TS-9 + the stopped-reading state** with one fix action, plus the "already here is unaffected" reassurance.
- [ ] **TS-12** disconnect answered — recommend **freeze** as default, with retain/purge named.

### Add after validation (v4.x)

- [ ] **D-2 rules preview inside the preview** — *trigger: the first user who imports 500+ files and asks "where did they all go?"*
- [ ] **D-5 removed-at-source review queue** — *trigger: the second `list` pass exists; this is nearly free then.*
- [ ] **D-7 source facts as filterable custom fields** — *trigger: the first rule someone wants to write mentions a site, library or sender.*
- [ ] **D-9 footprint estimate** — *trigger: SEED-076/077's embed batching lands, which makes the numbers real.*
- [ ] **TS-8 failure notification off-page** — *trigger: the first watch that was broken for more than a day before anyone noticed.*

### Future consideration (v5+)

- [ ] **Per-document ACL mirroring (SEED-211 / SEED-210 Option 2)** — defer: needs identity mapping to the source directory; Onyx puts it behind its paid tier for this reason. *Re-open trigger already recorded: a real tenant measures connection-scoped visibility insufficient.*
- [ ] **Delta cursors / webhooks** — defer: the moment one lands, the "checked every N minutes" sentence changes in the same commit (PROJECT.md).
- [ ] **Email/mailbox as a source** — defer within the milestone if it starts behaving like a shape decision, which PROJECT.md predicts and Onyx's checkpointing corroborates.

## Feature Prioritization Matrix

| Feature | User value | Cost | Priority |
|---|---|---|---|
| Adapter contract (`list`-first) | HIGH | MED | **P1** |
| D-1 three-way preview | **HIGH (the differentiator)** | HIGH | **P1** |
| F-3 identity key | MED (invisible) | MED | **P1** — blocks D-1 |
| TS-2 stated interval on shipped scheduler | HIGH | LOW | **P1** |
| D-3 honest freshness wording + fence | HIGH (trust) | LOW | **P1** |
| D-4 visibility sentence, editable | HIGH (SEED-210) | LOW | **P1** |
| TS-11 rules through the shipped splice | HIGH | MED | **P1** — SEED-209 binding |
| TS-4/5/6 state, timestamps, run log | HIGH | MED | **P1** |
| Stopped-reading state + one fix action | HIGH | LOW | **P1** |
| TS-12 disconnect policy | MED | MED | **P1** (decision) / P2 (build) |
| D-2 rules preview | HIGH | MED | **P2** |
| D-5 removed-at-source review | MED | MED | **P2** |
| D-7 source facts as fields | HIGH | MED | **P2** |
| D-8 inbound audit receipt | MED | MED | **P2** |
| D-9 footprint estimate | MED | MED | **P3** |
| TS-8 off-page notification | MED | MED | **P3** |
| D-6 re-runnable preview | MED | LOW | **P3** (free after D-1) |

## Competitor Feature Analysis

| Feature | Onyx (OSS) | Microsoft 365 Copilot connectors | Glean | NotebookLM / Gemini | Dropbox Dash / Notion AI / Slack | **Our approach** |
|---|---|---|---|---|---|---|
| **Preview before ingest** | ❌ none | ❌ none in connectors (its *migration* tooling has a full scan) | ❌ none | ❌ none | ❌ none | ⭐ **Three-way preview, ingests nothing until asked** |
| **Freshness wording** | `Refresh Frequency`, default **30 min** | ⭐ *"as fresh as the last sync time"* | ⚠ *"real time"* | ⚠ *"automatically"*, no cadence | ⚠ Slack: *"always"* (federated — true for them) | **"Checked every N minutes"** + two timestamps, fenced |
| **Permission model** | Private / Public / **Auto Sync (EE only, 10 connectors)** | *"Only people with access"* / *"Visible to everyone"*, **immutable after setup** | Full ACL mirror + delta sync | Live per-user Drive permission (no copy) | Per-user permission-aware | **Connection-scoped, stated plainly, editable** |
| **Source deletion** | Prune, default **30 days** | ⛔ **auto-remove at 28 days**, even on failure | Activity crawl | Respects deletions | — | ⭐ **Surface + offer; never automatic** |
| **Revocation** | EE only | Identity crawl | Real-time delta | Access removed immediately | Query-time | **Surfaced as a source fact; no false claim** |
| **Run visibility** | `IndexAttempt` history + `SyncAttemptsTabs` | Details / Errors / Statistics + CSV + service-health alerts | Admin audit logs | ❌ | Status column | **Per-check rows on the source; roll-up on Library Health** |
| **Routing rules** | Document sets, post-hoc | Exclusion filters (⛔ recreate to change) | Inclusion/exclusion filters (support ticket for most) | ❌ | ❌ | ⭐ **The shipped classification rules, previewed** |
| **Connector abstraction** | ⭐ `Load / Poll / Slim` + `validate_connector_settings` | Graph connector SDK | Indexing SDK / MCP / Push API | ❌ | ❌ | **`list → read → hash → splice`, adapters are data** |

---

## Sources

**Read directly (HIGH confidence)**
- `github.com/onyx-dot-app/onyx` — `backend/onyx/connectors/interfaces.py` (the full base-class hierarchy, quoted above) and `backend/onyx/connectors/README.md` (Load / Poll / Slim contract, registration checklist).
- `github.com/onyx-dot-app/onyx/issues/1161` — the offline-connector mass-deletion (`removed 976 docs`), **closed as not planned**.
- `docs.onyx.app/admins/connectors/overview` — Access Type (Private / Public / Auto Sync Permissions), Refresh Frequency (30 min), Prune Frequency (30 days), Indexing Start Date, connector status values.
- `learn.microsoft.com/.../copilot/connectors/manage-connector` — connection states verbatim, on-demand crawl, the **28-day auto-removal**, Copilot Visibility toggle, permanent-failure notifications, CSV export, delete-and-recreate-to-change-scope.
- `learn.microsoft.com/.../copilot/connectors/manage-access-permissions` — the two access options verbatim + *"Updating access permissions after you create the connection isn't currently supported."*
- `elastic.co/docs/reference/search-connectors/content-syncs` — full sync deletes; incremental requires a prior full sync.
- `workspaceupdates.googleblog.com` (2026-05) — NotebookLM Drive auto-sync: *"updates automatically to match"*, deletions/permissions respected, **no cadence stated**.
- `.planning/research/deep-dive/GLEAN.md` (this repo, 2026-07-24) — 275+ connectors, permission inheritance, real-time permission sync, crawl types; built on, not repeated.

**Search-derived, corroborated (MEDIUM–MEDIUM-HIGH)**
- `learn.microsoft.com/.../sharepointmigration/mm-scan` + `mm-unsupported-files` — the pre-migration scan, its reports, and the **"Ready to migrate" despite all-unsupported** behaviour.
- `docs.glean.com/connectors/crawling-types`, `/connectors/about`, `/get-started/setup/connect-data-sources` — four crawl types; *"crawls and syncs are scheduled … daily, weekly, or custom intervals"*; *"most datasources require Glean support assistance for implementing crawl restrictions"*.
- `help.dropbox.com` / `learn.dropbox.com` — Dash app status values and their definitions.
- `notion.com/help/notion-ai-connectors` (+ Slack/Drive pages) — permission-aware per user; admin + Business/Enterprise plan gating.
- `slack.com/features/enterprise-search` — *"no indexing or storing — just the most up-to-date information, always"* (federated).
- Fivetran docs — `Schema Change Handling`: `Allow all` / `Allow columns` / `Block all`, changeable at any time.
- `docs.openwebui.com/ecosystem/knowledge-base-sync` (`--dry-run`: *"preview exactly what would change and upload nothing"*), DataHub CLI (`--dry-run` / `--preview`), RcloneView dry-run.
- Google Drive API (`md5Checksum` binary-only) and Microsoft Graph `hashes` resource (`quickXorHash` only guaranteed; `sha256Hash` unsupported) — the F-3 evidence.
- `reco.ai` on Gemini/Workspace — *"Gemini does not create new access; it activates years of access debt at machine speed."*
- `knostic.ai` on Glean — permissions enforced at retrieval, not at answer synthesis (via GLEAN.md).

**Could not verify — stated rather than guessed**
- ⛔ **LlamaCloud connector sync semantics.** The Google Drive and SharePoint data-source pages document service-account auth and nothing else — no sync schedule, no deletion behaviour, no preview, no unsupported-type handling. One page is labelled deprecated. **No claim is made about LlamaCloud in the tables above beyond its existence.**
- ⛔ **Glean's actual default crawl frequencies.** `crawling-types` states *"All crawling frequencies are default settings … can be customized"* but **discloses no values**. The "Refresh rates" page was not reachable.
- ⛔ **Whether Onyx pauses a connector on the FIRST validation failure or after N.** Evidence supports auto-pause on repeated failure; the threshold was not established.
- ⛔ **Notion AI / Slack connector sync cadence.** Neither help centre states an interval. Both frame their connectors as permission-aware; neither says how fresh the answer is.

---
*Feature research for: scheduled, permission-aware connected-source ingestion (v4.0 Connected Knowledge)*
*Researched: 2026-09-04*

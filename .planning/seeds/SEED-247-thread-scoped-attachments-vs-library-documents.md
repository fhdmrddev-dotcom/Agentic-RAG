---
id: SEED-247
title: A file attached in chat should belong to the THREAD, not the Library — the data model cannot express "temporary" at all
status: planted
planted: 2026-09-05
planted_by: Operator, 2026-09-05 at Phase 229 close — "anything in the chat should stay temporarily in that thread, not in the library itself … it should be ingested or scoped to that thread, not in the library"
surface: Agentic-RAG
severity: info
category: product / ingestion scope + knowledge-base hygiene
priority: medium   # narrowed at Phase 244 discuss — only Q4 (promote-to-Library) remains open
scope: Medium-Large — a new document SCOPE, plus retrieval and lifecycle rules; not merely a UI move
affected_areas: [chat, composer, documents, folders, retrieval, ingestion, workspace-files, library]
related_seeds: [SEED-209, SEED-210, SEED-038, SEED-224]
related_bugs: [BUG-260905-01]
trigger_when: >
  Re-open when ANY of these is true: (1) Phase 233 (the preview / destination-folder work) is scoped —
  it will decide where an imported file lands and must not assume "always the Library"; (2) anyone adds
  a local-file upload to the chat composer, since that is the moment the scope question becomes
  unavoidable; (3) a user reports the knowledge base is polluted with conversational scratch, or asks
  how to attach a file "just for this chat"; (4) retrieval is observed citing a file the person attached
  to an unrelated conversation; (5) SEED-038's generated-files/artifacts unification is scheduled — that
  seed and this one are two halves of "what is a file's scope in this product".
---

# SEED-247: A chat attachment belongs to the thread, not the Library

## The operator's model, in their words

> *"Ingestion and connection to cloud should be from the document section. Anything in the chat should be
> uploaded either from cloud or from hard — but it should be ingested or scoped to that thread, not in
> the library."*

Two surfaces, two meanings:

| Surface | Meaning | Lifetime |
|---|---|---|
| **Library / Documents** | Curated organisational knowledge | Permanent, foldered, retrievable by everything |
| **Chat attachment** | Working material for *this* conversation | Temporary, thread-scoped, not part of the KB |

## ⛔ The data model cannot express this today

Measured 2026-09-05: **`documents` has no `thread_id` column.** Full column list —
`id, user_id, filename, file_path, file_size, mime_type, status, error_message, chunk_count, created_at,
updated_at, content_hash, metadata, folder_id, version_number, is_latest, full_markdown, ingestion_step,
extractor, document_type_norm, date_typed, org_id`.

`workspace_files` **is** per-thread, but it is the **agent's** workspace — files the agent produces during
a run — not a home for a person's attachment.

**So every ingested file is permanent, user-global and in the Library.** "Temporary" is not a state this
product can currently represent.

## Why this matters

A person drops a file into chat while thinking something through. It becomes a permanent Library document
at root, chunked and embedded, and is then **retrievable by every future question they ask** — including
unrelated ones. The knowledge base silently accumulates conversational scratch as if it were curated
knowledge, and the only remedy is manual deletion.

⚠ This is the **inbound mirror of the hygiene problem `SEED-209`/`SEED-210` describe for connectors**:
something enters the corpus without anyone deciding it should be part of the corpus.

## The questions this seed owns — none answered here

1. **Where does a thread-scoped file live?** A `thread_id` on `documents` with a scope flag · a separate
   table · or reuse `workspace_files` with a new owner kind. Each has different retrieval consequences.
2. **Is it retrievable, and by whom?** Presumably yes *inside that thread* and no outside — which means
   retrieval gains a scope term, and that touches the same four RLS sites Phase 231 is about to write.
   ⭐ **That is the sequencing point: it is cheap to allow for at 231 and expensive afterwards.**
3. **What happens when the thread is deleted?** Cascade, orphan, or offer promotion to the Library.
4. **Can a person promote one to the Library?** Almost certainly yes — *"this turned out to be worth
   keeping"* is the natural flow, and it should be an explicit act.
5. **Does it dedupe against Library documents?** `documents_dedup_idx` is
   `(user_id, content_hash, COALESCE(folder_id, …))` — a thread scope needs deciding here or two copies
   collide, or wrongly deduplicate.
6. **Chunking and embedding cost** — does a temporary file get embedded at all, or read inline?

## Relationship to the immediate defect

`BUG-260905-01` records what is broken *today*: the cloud-import door sits in the chat composer, writes to
the Library **root** with no folder picker, and the chat has **no local-file upload at all** — the two
doors are exactly inverted. **The folder picker and moving import into the Library are small and fit
Phase 233.** This seed is the larger half and must not be smuggled into a phase that has not scoped it.

---

## ⭐ ROUTED AT PHASE 244 DISCUSS (2026-09-11) — FIVE OF THE SIX QUESTIONS ARE ANSWERED

`trigger_when` arm **(2)** — *"anyone adds a local-file upload to the chat composer"* — **fired**.
`SHELL-04` does exactly that, so this seed was read and ruled on rather than walked past.
Decisions live in `.planning/phases/244-the-chat-shell-and-the-composer/244-CONTEXT.md`.

| Q | Answer | Decision |
|---|---|---|
| **1** Where does a thread-scoped file live? | **Reuse `workspace_files`** via the shipped `POST /threads/{id}/workspace/files`. **No migration.** | `D-244-01` |
| **2** Is it retrievable, and by whom? | **Read INLINE only — never chunked, never embedded.** So retrieval gains **no** scope term and the four Phase 231 RLS sites are untouched | `D-244-03` |
| **3** What happens when the thread is deleted? | **Cascade** — `workspace_files.thread_id … ON DELETE CASCADE` already (migration 054:7) | `D-244-04` |
| **4** Can a person promote one to the Library? | ⛔ **DEFERRED** — not asked for by any criterion; needs a folder picker, the mint/splice path and a dedup ruling | deferred |
| **5** Does it dedupe against Library documents? | **MOOT** — an attachment mints **no `documents` row at all**, so `documents_dedup_idx` is never reached | by construction |
| **6** Chunking / embedding cost? | **Zero — it is never embedded.** Same answer as Q2 | `D-244-03` |

⛔⛔ **THIS SEED'S OWN PREMISE WAS MEASURED FALSE, and the original is kept above rather than edited.**
It states: *"`workspace_files` **is** per-thread, but it is the **agent's** workspace — files the agent
produces during a run — not a home for a person's attachment."* **At HEAD that is not true.** Phase 100
(TMPL-01) shipped `POST /threads/{id}/workspace/files` — a **user-written**, thread-scoped,
TTL-expiring, magic-byte-validated upload with an RLS **insert** policy for the user
(`workspace_files_insert_own`), a 10 MB cap checked three times, 15 accepted extensions, a panel
renderer, an API client, and a caller already in the chat shell (`ChatLayout.tsx:377`). So *"temporary"*
**is** a state this product can represent, and has been able to since Phase 100. **The seed's
conclusion — a chat attachment should not enter the Library — stands; its claim about what the data
model can express does not.** `SEED-042`'s matching estimate (*"option (ii) costs a new write endpoint
+ RLS"*) is refuted the same way.

⚠ **Status stays `planted`, deliberately, on ONE question only: Q4 (promote to the Library).** Every
other question is answered and must not be re-proposed.
**Narrowed `re_open_trigger`:** the first time a person asks to keep a chat attachment permanently, OR
`SEED-038`'s generated-files/artifacts unification is scheduled — since *"what is a file's scope in
this product"* is then being answered whole.

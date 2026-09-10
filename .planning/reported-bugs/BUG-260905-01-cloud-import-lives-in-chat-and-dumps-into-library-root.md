---
id: BUG-260905-01
title: Cloud import is in the CHAT composer, writes permanently to the Library ROOT with no folder choice — and chat has no local-file upload at all
surface: Agentic-RAG
severity: major
status: open
reported: 2026-09-05
reported_by: Operator, manual testing at Phase 229 close
affected_areas: [chat, composer, connectors, ingestion, documents, library, folders]
folded_into:
re_open_trigger:
related: [SEED-247, ATTACH-01, SEED-213]
---

## What the operator observed

> *"The door is not where intended — the import should be from the Library, not from the chat. Anything
> in the chat should stay temporarily in that thread, not in the Library itself. I do not see any upload
> button, only Import from Cloud. It imported correctly and ingested, but it ingested into a folder I did
> not want — the root."*

## Measured, 2026-09-05 — all three parts confirmed

**1. The cloud-import door is in the chat composer only.**
`MessageInput.tsx:363-379` — the `+` button opens a menu whose first item is *"Import from Cloud
Storage…"*, mounting `ConnectedFilePickerModal` (`MessageInput.tsx:633`). There is **no cloud-import entry
point anywhere in the Library**.

**2. It writes permanently to the Library ROOT, and cannot do otherwise.**
`connectors.py:1703-1709` calls `async_mint_document_row(...)` with **no `folder_id`** and **no `org_id`**:

```python
mint_result = await async_mint_document_row(
    raw=raw_bytes, filename=filename, mime_type=mime_type,
    user_id=user["id"], supabase=supabase,
)   # ← no folder_id, no org_id
```

`folder_id` therefore defaults to `None` = root. **The modal has no folder picker**, so this is not a
missed selection — there is nothing to select. ⚠ Note this is *not* a Phase 229 regression: 229 correctly
preserved the call's existing shape, and before 229 the route failed outright (`PGRST204`). **229 is what
made this reachable enough to notice.**

**3. Chat has NO local-file upload at all.** Grepped `MessageInput.tsx` for `type="file"`, `Paperclip`,
`onDrop`, `uploadDocument` — **zero hits**. So the composer can import from the cloud but cannot accept a
file from your own machine. The upload button lives only in the Library
(`LibraryPage.tsx:555` → `DocumentUpload`). **The two doors are exactly inverted.**

## The deeper problem — there is no such thing as a thread-scoped document

The operator's model is *"chat attachments are temporary and belong to the thread; the Library is the
permanent knowledge base."* **That distinction cannot currently be expressed:**

- `documents` has **no `thread_id` column** (full column list read live: `id, user_id, filename, file_path,
  file_size, mime_type, status, error_message, chunk_count, created_at, updated_at, content_hash, metadata,
  folder_id, version_number, is_latest, full_markdown, ingestion_step, extractor, document_type_norm,
  date_typed, org_id`).
- `workspace_files` **is** per-thread, but it is the **agent's** scratch workspace (files the agent
  produces), not a place a person's attachment can live.

So today **every ingested file is permanent, global-to-the-user, and in the Library**. Attaching a file
"just for this conversation" is not a thing the data model can represent. That is a missing capability,
not a bug — captured as `SEED-247`.

## Why it matters beyond tidiness

A person exploring an idea in chat drops in a file. It silently becomes a permanent Library document at
root, is chunked and embedded, and is then **retrievable by every future question they ask** — including
questions that have nothing to do with that conversation. The knowledge base accumulates conversational
scratch as though it were curated knowledge, and the only cleanup is manual deletion from the Library.

## What "fixed" looks like (direction, not a decision)

| Surface | Should do |
|---|---|
| **Library / Documents** | Own **both** doors — local upload **and** cloud import — **with a folder picker on each**, since this is the permanent knowledge base. |
| **Chat composer** | Accept a file from **hard drive or cloud**, scoped to **that thread**, not written to the Library. |

⚠ The second row needs the missing capability in `SEED-247` (thread-scoped documents) and is the larger
half. The first row is mostly a **move plus a folder picker** and is small by comparison.

## Suggested routing

- The **folder picker + moving cloud import into the Library** is a natural fit for **Phase 233** (the
  preview / "see it before it lands" phase), which is already about choosing what enters the Library and
  where. Adding a destination folder to that screen is squarely its subject.
- **Thread-scoped attachments** (`SEED-247`) is a separate capability and should not be smuggled into a
  phase that has not scoped it.

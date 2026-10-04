---
title: The document panel
slug: use/library/document-detail
section: use
audience: user
status: written
release: shipped
covers: [A18, A19, E11]
unreleased: [A19]
summary: >-
  Select a document to open its panel: details with a confidence chip on each field, its text,
  tables and images, the questions that found it, its links and any filing suggestion.
reviewed: 2026-10-04
---

Select any document in the Library to open its panel on the right. The panel shows what Syrel knows about the document and lets you correct it.

![The document panel with details, confidence chips and relationships](/docs-assets/shots/document-detail.png)

## Details and confidence

The **Details** section lists the facts Syrel read from the document — such as title, type, author and dates — plus any custom fields your organisation defines. Each field carries a confidence chip saying how sure the extraction was. The section's header counts fields that are low-confidence or empty, so you can see at a glance what needs a look.

- **Correct a value** by editing it in place. Your correction is marked as made by a person, recorded in the audit log, and protected: reading the document again later will not overwrite it.
- The confidence levels follow thresholds an operator can tune to the embedding model in use.

## What is inside

| Section | What it shows |
|---|---|
| Text | The document's full extracted text. |
| Chunks | The searchable sections Syrel split it into. |
| Tables | Tables read from the document as structured data. |
| Images | Images and figures, with the descriptions that make them searchable. If a document had more images than the reading limit allowed, the panel says how many were read. |
| Found by | The questions that found this document in search — "the questions that found it". |
| Conversation | For an email, the other messages in its thread. |
| Takeoff | For a `.dxf` drawing, the quantities read from it. |

## Relationships

Documents can be linked with a type: **supersedes**, **amends**, **references** or **attached to**. The Relationships section groups links by direction (this document supersedes X; Y supersedes this document). A linked document you are not allowed to open is shown as a masked row, so you know a link exists without seeing what it points to. Add a link with the type-first picker, which searches documents as you type.

The agent can follow these links too, when it answers in chat.

## Filing suggestions

When a rule matches a new upload, the Classification section shows one suggestion, such as "move to folder X because rule Y matched". Nothing moves until you accept. Accepting is recorded and can be undone; dismissing clears the suggestion.

## Where it came from

A document placed by a connected source, such as a watched Google Drive folder, says "Placed here by a connected source, not uploaded by a person."

## Downloading and file facts (v4.5)

v4.5, which has not shipped, adds a **File** section with the file's own facts — created, modified, pages, size, type and uploader — and a button to download the original file. Until then you cannot download an uploaded document's original file from this panel.

Word and PDF files are downloaded, not previewed inside Syrel.

## Related

- [The Library: documents and folders](/docs/use/library/documents)
- [Filing rules](/docs/use/library/filing-rules)

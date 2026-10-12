---
title: Finding a document
slug: use/library/find
section: use
audience: user
status: written
release: shipped
updated: v4.5
covers: [A12]
summary: >-
  Find lists every document in the Library that matches what it is, without asking the AI.
video: clip.use-library-find
reviewed: 2026-10-04
---

## What Find is for

Asking Syrel a question finds passages that answer it. Find answers a different question: *which documents are these?* For example, "every contract from Acme that supersedes another one", or "every report added this quarter that still has older versions".

## How it works

- The Library's Documents tab has a switch: **Find documents | Ask**.
- **Find documents** combines filters on the document's type, owner, date range, custom fields, folder (optionally including subfolders), its links to other documents in either direction ("supersedes X", "referenced by X") and its version state (latest, has earlier versions, or superseded).
- Results are one row per document, sorted by a field it names. Find never calls the AI and never ranks by meaning, so the same filters return the same list every time.
- **Ask** takes what you typed to a new chat as a question, without sending it, so you can check it first.

## What it does not change

Find does not change what you can see. It searches exactly the documents you can already open, and a document you cannot open never appears in its results.

## Related

- [The Library: documents and folders](/docs/use/library/documents)
- [Changelog: v4.5](/docs/changelog/v4.5)

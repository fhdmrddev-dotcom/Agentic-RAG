---
title: Adding documents
slug: use/library/ingestion
section: use
audience: user
status: written
release: shipped
covers: [A14, D21]
summary: >-
  Upload files, import one file from a connected cloud service, follow each document through
  Syrel's reading stages, and preview a connected source before anything lands.
video: clip.use-library-ingestion
reviewed: 2026-10-04
---

You can add documents to the Library in three ways: upload them, import a single file from a connected service, or connect a whole folder that Syrel keeps in sync. This page covers the first two, and the preview you see before a connected source's first import.

## Uploading files

1. Open **Library** and pick the folder the files should go into. You can add files only to a folder you own, or to the top level.
2. Drop files on the upload area on the **Documents** or **Ingestion** tab, or click it to choose files. You can upload several at once.

Each file can be up to 50 MB. Syrel reads:

| Kind | Formats |
|---|---|
| Documents | PDF, Word (DOCX), PowerPoint (PPTX), EPUB, HTML, plain text, Markdown |
| Spreadsheets | Excel (XLSX, XLS), CSV — their tables become data the agent can query |
| Email | `.eml` and Outlook `.msg` — sender, recipients, date and subject become details, and attachments become their own linked documents |
| Images | PNG, JPEG, WEBP, TIFF, BMP |
| Drawings | `.dxf` |

Uploading the same file twice at the same moment creates one document, not two. Uploading a file with the same name as an existing document creates a new version of it.

## Importing one file from the cloud

Beside the upload area, **Import from cloud** lets you pick one file from a connected service and bring it into the folder you have selected. Choose a folder first — an import needs somewhere to land. If no cloud storage is connected yet, the button says so; see [Connections](/docs/connect/overview).

## Following a document through ingestion

The **Ingestion** tab lists what is waiting, in progress and finished. Each document moves through up to six stages:

1. **Reading the file** — pulling the text out.
2. **Reading tables** — turning tables into structured data.
3. **Reading images** — describing images and figures so search can find them.
4. **Splitting into sections** — breaking the text into searchable pieces.
5. **Making it searchable** — building the search index for the document.
6. **Reading document details** — detecting the title, author, dates and similar facts.

A stage that does not apply to a file (a text file has no images) is struck through. When every applicable stage is done, the document reads **Ready**.

Ingestion runs in a durable queue: it survives server restarts and bursts of uploads, and retries what it can. If a document fails, Syrel names the stage and the reason rather than leaving it stuck; fix the cause and choose **Try again** or re-ingest it.

## Previewing a connected source

When you connect a folder from a service such as Google Drive for the first time, Syrel shows a preview before anything is written. The files are sorted into four groups — **will be added**, **already here**, **type not supported** and **can't tell without reading it** — along with where your routing rules would file each one. Nothing lands in the Library until you confirm. See [Keeping a folder in sync](/docs/connect/folder-watches).

## Related

- [The Library: documents and folders](/docs/use/library/documents)
- [How your documents are indexed](/docs/use/library/indexing)

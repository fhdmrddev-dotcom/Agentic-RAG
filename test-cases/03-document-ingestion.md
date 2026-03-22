# TC-03: Document Ingestion

## TC-03-01 — Upload a PDF

**GIVEN** I am on the Documents page (click Documents in sidebar)
**WHEN** I drag-and-drop a PDF file onto the upload zone
**THEN**
- The file appears in the document list with status "Processing"
- Status transitions to "Ready" when ingestion completes (Realtime update — no page refresh needed)
- The document shows its filename, file size, and upload date

---

## TC-03-02 — Upload a DOCX file

**GIVEN** the Documents page
**WHEN** I upload a `.docx` Word document
**THEN**
- The document ingests successfully and reaches "Ready" status
- No error messages appear

---

## TC-03-03 — Upload a Markdown file

**GIVEN** the Documents page
**WHEN** I upload a `.md` file
**THEN**
- Ingestion succeeds and status reaches "Ready"

---

## TC-03-04 — Upload an HTML file

**GIVEN** the Documents page
**WHEN** I upload an `.html` file
**THEN**
- Ingestion succeeds and status reaches "Ready"

---

## TC-03-05 — Upload a plain text file

**GIVEN** the Documents page
**WHEN** I upload a `.txt` file
**THEN**
- Ingestion succeeds and status reaches "Ready"

---

## TC-03-06 — Duplicate file detection

**GIVEN** a document is already uploaded
**WHEN** I upload the exact same file again (identical content)
**THEN**
- A notice appears: "already up to date" (or similar)
- No duplicate entry is created in the document list
- Status shows the existing document as "Ready"

---

## TC-03-07 — Updated file replaces stale version

**GIVEN** a document is already uploaded
**WHEN** I modify the file content and upload it again with the same name
**THEN**
- The old version is replaced
- The document list shows the updated file
- Re-ingestion runs and status returns to "Ready"

---

## TC-03-08 — Multi-file upload

**GIVEN** the Documents page
**WHEN** I select 3 files at once in the file picker (or drag multiple)
**THEN**
- All 3 files appear in the list and process concurrently
- Each reaches "Ready" independently
- Duplicate files among the batch are handled gracefully

---

## TC-03-09 — Metadata visible on document

**GIVEN** a document that has been successfully ingested
**WHEN** I click the chevron/expand icon on the document card
**THEN**
- Metadata panel expands showing: title, author, date, document_type, language, summary, topics (as pill badges)
- Fields not extractable show as blank or are omitted

---

## TC-03-10 — Delete a document

**GIVEN** an ingested document
**WHEN** I click the delete button on the document card and confirm
**THEN**
- The document is removed from the list
- Its chunks are deleted from the vector store (cascade)
- The document is no longer retrievable in chat

---

## TC-03-11 — Empty file upload

**GIVEN** an empty file (0 bytes)
**WHEN** I upload it
**THEN**
- An error status is shown ("Failed" or similar)
- No crash occurs; other uploads continue normally

# TC-09: Edge Cases & Resilience

## TC-09-01 — Ask a question with no documents uploaded

**GIVEN** no documents have been ingested
**WHEN** I ask "What do my documents say about X?"
**THEN**
- The assistant responds gracefully ("No relevant documents found" or falls back to general knowledge)
- No crash, no empty tool panel, no raw JSON error

---

## TC-09-02 — Ask a question with no relevant documents

**GIVEN** documents about Topic A are ingested (e.g., cooking recipes)
**WHEN** I ask about Topic B (e.g., "Explain quantum computing")
**THEN**
- The assistant either uses web_search (if enabled) or states it has no relevant documents
- It does not hallucinate content from the wrong documents

---

## TC-09-03 — Empty message submission

**GIVEN** the chat input is empty
**WHEN** I press Enter or click Send
**THEN**
- Nothing happens (message not sent)
- No API call is made
- No empty message appears in the chat

---

## TC-09-04 — Very long user message

**GIVEN** a text block of 2000+ characters is pasted into the chat input
**WHEN** I send it
**THEN**
- The message is sent without truncation
- The layout doesn't break
- The assistant responds normally

---

## TC-09-05 — Network error during streaming

**GIVEN** a message is being streamed
**WHEN** the backend is stopped mid-stream (kill the uvicorn process)
**THEN**
- The streaming stops
- The partial response remains visible
- The input is re-enabled (no permanent "Sending..." state)
- The app doesn't crash or go blank

---

## TC-09-06 — Backend not running

**GIVEN** the backend is not running
**WHEN** I try to send a message
**THEN**
- An error is shown in the chat (not a blank screen)
- The UI remains functional

---

## TC-09-07 — Upload unsupported file type

**GIVEN** the Documents page
**WHEN** I try to upload a `.exe`, `.zip`, or other unsupported file
**THEN**
- The file is rejected (error status shown or upload blocked)
- No crash occurs
- Other valid files can still be uploaded

---

## TC-09-08 — Corrupt PDF upload

**GIVEN** a PDF file that is malformed (truncated or corrupted)
**WHEN** I upload it
**THEN**
- Ingestion fails with an error status ("Failed")
- The document shows the failed state in the list
- Other documents and the app continue working normally

---

## TC-09-09 — Delete a document that is currently being retrieved

**GIVEN** a document is in an active chat retrieval (mid-stream response)
**WHEN** (in another tab) I delete that document
**THEN**
- The current stream completes using the already-retrieved chunks
- Subsequent queries no longer find that document

---

## TC-09-10 — Concurrent uploads (stress test)

**GIVEN** the Documents page
**WHEN** I upload 10 files simultaneously
**THEN**
- All 10 appear in the list with "Processing" status
- They progress to "Ready" as each finishes
- No uploads silently fail without a status update
- The UI remains responsive during processing

---

## TC-09-11 — Very large document

**GIVEN** a document > 1MB (e.g., a 100-page PDF)
**WHEN** I upload it
**THEN**
- Chunking and embedding complete (may take longer)
- The document eventually reaches "Ready"
- It is retrievable in chat (relevant chunks returned, not the whole document)

---

## TC-09-12 — Special characters in folder name

**GIVEN** I create a folder with special characters (e.g., "Q&A / 2025")
**WHEN** I try to navigate to it via the folder tree
**THEN**
- The folder is created and displayed correctly
- Path resolution works correctly in KB tools

---

## TC-09-13 — Re-ingestion after updating embedding model

**GIVEN** `EMBEDDING_MODEL` is changed in backend/.env (e.g., from 1536 to 3072 dimensions)
**WHEN** I attempt to retrieve documents ingested under the old model
**THEN**
- Retrieval may return poor results (expected — old embeddings are incompatible)
- The system doesn't crash
- After re-ingesting all documents, retrieval returns to normal

---

## TC-09-14 — Thread with 50+ messages (long history)

**GIVEN** a thread with a very long conversation history
**WHEN** I send a new message
**THEN**
- The full history is loaded and sent to the LLM (stateless history management)
- The response is coherent and context-aware
- The layout handles the long message list without visual bugs (scrolling works)

---

## TC-09-15 — Explorer mode with empty knowledge base

**GIVEN** no documents or folders exist
**WHEN** (Explorer mode) I ask "What's in my knowledge base?"
**THEN**
- `ls` or `tree` is called, returns empty result
- The assistant responds gracefully: "Your knowledge base is empty" or similar
- No crash, no raw JSON shown

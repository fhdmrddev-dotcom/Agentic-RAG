# TC-05: General Chat Mode

## TC-05-01 — Basic RAG retrieval

**GIVEN** a document about machine learning is ingested
**WHEN** I ask "What is overfitting?"
**THEN**
- The assistant returns an answer grounded in the document content
- The response streams progressively (not all at once)
- A thinking/loading indicator is visible while streaming

---

## TC-05-02 — Semantic search across multiple documents

**GIVEN** 3+ documents on different topics are ingested
**WHEN** I ask a question that only one document can answer
**THEN**
- The assistant retrieves the correct document
- The answer is relevant and accurate to that document's content

---

## TC-05-03 — search_documents tool call visible in UI

**GIVEN** a document is ingested
**WHEN** I ask a question that triggers the search_documents tool
**THEN**
- A "Searching documents" tool call panel appears in the assistant message
- The panel shows the tool name and can be expanded/collapsed
- The final response uses the retrieved content

---

## TC-05-04 — query_documents tool — count documents

**GIVEN** several documents are ingested
**WHEN** I ask "How many documents do I have?"
**THEN**
- The `query_documents` tool is called (visible in tool panel)
- The assistant returns the correct count

---

## TC-05-05 — query_documents tool — filter by type

**GIVEN** a mix of PDF and DOCX documents ingested
**WHEN** I ask "List all my PDF files"
**THEN**
- `query_documents` runs a SQL SELECT with file_type filter
- The assistant lists only PDF filenames

---

## TC-05-06 — Metadata filter in search

**GIVEN** documents with extracted metadata (author, date, document_type)
**WHEN** I ask "Find documents written by [Author Name]"
**THEN**
- The assistant uses `search_documents` with a `metadata_filter` for author
- Only documents matching that author are returned

---

## TC-05-07 — analyze_document tool — summarize a document

**GIVEN** a long document (e.g., a multi-page PDF) is ingested
**WHEN** I ask "Summarize the [filename] document"
**THEN**
- The `analyze_document` tool is called
- A sub-agent streaming panel appears showing the analysis in real-time
- After completion, the assistant gives a final synthesized summary
- The ToolCallPanel shows a nested sub-agent result view

---

## TC-05-08 — web_search tool (if Tavily key configured)

**GIVEN** `TAVILY_API_KEY` is set in backend/.env
**WHEN** I ask "What is the latest version of Python?"
**THEN**
- The `web_search` tool fires (visible in tool panel)
- The response includes a source URL
- The answer reflects current internet information

---

## TC-05-09 — Multi-turn conversation context

**GIVEN** an ongoing thread with several exchanges
**WHEN** I ask a follow-up that references a previous answer (e.g., "Can you expand on that last point?")
**THEN**
- The assistant correctly references the prior exchange
- The response is contextually coherent

---

## TC-05-10 — Model selector

**GIVEN** multiple models are configured in the settings
**WHEN** I select a different model from the dropdown in the toolbar
**THEN**
- The model name changes in the selector
- The next message is sent using the selected model (visible in LangSmith traces)

---

## TC-05-11 — Streaming can handle long responses

**GIVEN** a large document is ingested
**WHEN** I ask a broad question that generates a long answer
**THEN**
- The response streams without freezing or layout breaking
- Scroll follows the content as it streams in
- No truncation mid-sentence (unless length limit is hit, which shows a note)

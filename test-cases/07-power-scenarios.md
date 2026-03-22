# TC-07: Power Scenarios

Multi-step, multi-tool chains that demonstrate the full intelligence of the agentic system.

---

## TC-07-01 — "Find and summarize" chain

**Setup:** Upload 3 research papers on AI topics into a folder named "Research"

**WHEN** (General mode) I ask:
> "Find all documents related to neural networks and give me a detailed summary of the most relevant one"

**Expected tool chain:**
1. `search_documents` — semantic search for "neural networks"
2. `analyze_document` — full analysis of the top result
3. Sub-agent streaming panel appears
4. Final response: synthesized summary with source attribution

**Power demonstrated:** Semantic retrieval → deep analysis in one natural language query

---

## TC-07-02 — "Explore and read" chain

**Setup:** Upload a technical specification PDF into folder "Specs/Backend"

**WHEN** (Explorer mode) I ask:
> "Find the backend specification and show me the section about authentication"

**Expected tool chain:**
1. `glob` or `tree` — locate the file
2. `grep` — find lines matching "authentication" or "auth"
3. `read_document` with `start_line`/`end_line` — read the relevant section
4. Final response: quotes or paraphrases the authentication section

**Power demonstrated:** Navigate by name → search content → read targeted section

---

## TC-07-03 — "Query then analyze" chain

**Setup:** Multiple financial reports uploaded

**WHEN** (General mode) I ask:
> "Which document was uploaded most recently, and what does it say about Q4 revenue?"

**Expected tool chain:**
1. `query_documents` — `SELECT filename, created_at FROM documents ORDER BY created_at DESC LIMIT 1`
2. `analyze_document` — full read of that document
3. Final response: answers based on the most recent document's Q4 revenue content

**Power demonstrated:** SQL-level introspection → deep content analysis in one query

---

## TC-07-04 — "Metadata-filtered semantic search"

**Setup:** Upload documents with different authors and document types (reports, papers, manuals)

**WHEN** (General mode) I ask:
> "Find any quarterly reports from 2024 that discuss budget forecasts"

**Expected tool chain:**
1. `search_documents` with `metadata_filter: { document_type: "report" }` and query "budget forecast"
2. Results filtered by metadata + re-ranked by semantic relevance
3. Final response: relevant excerpts with source attribution

**Power demonstrated:** Hybrid semantic + metadata filtering in a single retrieval

---

## TC-07-05 — Knowledge base audit in Explorer mode

**Setup:** A knowledge base with 10+ documents across 3+ folders, some misnamed or miscategorized

**WHEN** (Explorer mode) I ask:
> "Audit my knowledge base. List all folders, count documents in each, identify any documents that seem misplaced based on their content vs folder name"

**Expected tool chain:**
1. `tree` — full structure
2. `ls` — per-folder listing
3. `grep` or `read_document` — sample content of suspicious files
4. Final response: structured audit report with findings and suggestions

**Power demonstrated:** Agentic multi-step reasoning over the KB structure

---

## TC-07-06 — Cross-document comparison

**Setup:** Upload two competing product specs or two versions of the same report

**WHEN** (General mode) I ask:
> "Compare [Document A] and [Document B] — what are the key differences?"

**Expected tool chain:**
1. `analyze_document` for Document A (sub-agent streaming)
2. `analyze_document` for Document B (sub-agent streaming)
3. Final response: structured comparison (potentially with a table or bullet points)

**Power demonstrated:** Parallel sub-agent analysis → comparative synthesis

---

## TC-07-07 — Full pipeline end-to-end (upload → query)

**WHEN** I:
1. Upload a new document on the Documents page
2. Wait for ingestion to complete (Realtime status update)
3. Switch to Chat
4. Ask a question that only that document can answer

**THEN**
- The assistant retrieves content from the just-uploaded document
- The answer is accurate

**Power demonstrated:** Full pipeline: upload → chunk → embed → store → retrieve → answer

---

## TC-07-08 — Tool chaining: discover → read → answer

**Setup:** Upload a document with a known fact buried inside it

**WHEN** (General mode) I ask:
> "What does the [filename] document say about [specific buried fact]?"

**Expected tool chain:**
1. `glob` — find the document ID by name
2. `grep` — find the line range containing the fact
3. `read_document` — read that section
4. Final response: quotes the buried fact accurately

**Power demonstrated:** Name resolution → content targeting → precise extraction

---

## TC-07-09 — Real-time ingestion + immediate retrieval

**WHEN** (two-step test):
1. Upload a large PDF (5+ pages)
2. Immediately ask a question about it while it's still "Processing"
3. Wait for ingestion, then ask again

**THEN**
- While processing: no results, or the assistant says the document isn't ready
- After "Ready": the document is retrievable and the answer is correct

**Power demonstrated:** Graceful handling of in-progress ingestion; correct state after completion

---

## TC-07-10 — Multi-language document

**Setup:** Upload a document written in French or Spanish

**WHEN** I ask (in English): "What is this document about?"

**THEN**
- Metadata extraction identifies the language (e.g., `language: "French"`)
- The assistant can summarize it (translation by the LLM)
- The metadata panel shows the detected language

**Power demonstrated:** Multi-language ingestion, metadata detection, cross-language retrieval

# TC-06: Explorer Mode

Explorer mode activates a KB-specialist sub-agent with 6 dedicated tools:
`ls`, `tree`, `grep`, `glob`, `read_document`, `analyze_document`.

---

## TC-06-01 — Activate Explorer mode

**GIVEN** the chat input toolbar is visible
**WHEN** I click the mode selector (shows "General") and select "Explorer"
**THEN**
- The button label changes to "Explorer" and is visually highlighted (primary color)
- The dropdown shows "Explorer" as the active option with an "active" badge

---

## TC-06-02 — Deactivate back to General

**GIVEN** Explorer mode is active
**WHEN** I click the mode selector and choose "General"
**THEN**
- The button returns to "General" (default style, no highlight)

---

## TC-06-03 — `ls` — list root folder contents

**GIVEN** folders and documents exist in the knowledge base
**WHEN** (Explorer mode) I ask "What's at the root of my knowledge base?"
**THEN**
- The `ls` tool is called with `path='/'`
- The ToolCallPanel shows a FolderOpen icon and "Listing /..."
- Expanded view shows separate sections for folders and documents
- The final response describes the top-level contents in prose

---

## TC-06-04 — `ls` — list contents of a specific folder

**GIVEN** a folder "Finance" exists with subfolders and documents
**WHEN** (Explorer mode) I ask "What's inside my Finance folder?"
**THEN**
- `ls` is called with `path='/Finance'`
- The result lists the immediate children (subfolders + documents)
- The response describes what was found

---

## TC-06-05 — `tree` — show full hierarchy

**GIVEN** a nested folder structure with documents
**WHEN** (Explorer mode) I ask "Show me the full structure of my knowledge base as a tree"
**THEN**
- The `tree` tool is called
- The ToolCallPanel shows a GitBranch icon
- Expanded view renders a recursive indented hierarchy (folders with nested contents)
- The response summarizes the structure

---

## TC-06-06 — `tree` — depth-limited view

**GIVEN** a deeply nested folder structure
**WHEN** (Explorer mode) I ask "Show me my folder tree, but only 2 levels deep"
**THEN**
- `tree` is called with `depth=2`
- Folders beyond depth 2 show a truncation indicator
- The response respects the depth limit

---

## TC-06-07 — `grep` — find documents containing a keyword

**GIVEN** documents are ingested with known content
**WHEN** (Explorer mode) I ask "Which documents mention the word 'revenue'?"
**THEN**
- The `grep` tool fires with `pattern='revenue'`
- The ToolCallPanel shows a TextSearch icon and a result count badge
- Expanded view shows a scrollable list of matching filenames
- The response names the documents found

---

## TC-06-08 — `grep` — regex pattern search

**GIVEN** documents with structured content (e.g., dates, codes)
**WHEN** (Explorer mode) I ask "Find documents containing a date in the format YYYY-MM-DD"
**THEN**
- `grep` is called with `pattern='\d{4}-\d{2}-\d{2}'`
- Matching documents are returned
- The response correctly identifies the files

---

## TC-06-09 — `glob` — find all PDFs

**GIVEN** a mix of PDF and non-PDF documents
**WHEN** (Explorer mode) I ask "Find all my PDF files"
**THEN**
- The `glob` tool fires with `pattern='*.pdf'`
- The ToolCallPanel shows a FileSearch icon and a result count
- All PDFs are listed in the expanded panel
- The response lists the PDF filenames

---

## TC-06-10 — `glob` — find files by name pattern

**GIVEN** documents with names like "report_2024.pdf", "report_2023.pdf", "summary.docx"
**WHEN** (Explorer mode) I ask "Find all files starting with 'report'"
**THEN**
- `glob` fires with `pattern='report*'`
- Only the matching files are returned
- Summary.docx is not included

---

## TC-06-11 — `glob` — recursive search with `**`

**GIVEN** the same filename exists in multiple nested folders
**WHEN** (Explorer mode) I ask "Find all files named 'budget.xlsx' anywhere in my knowledge base"
**THEN**
- `glob` fires with `pattern='**/budget.xlsx'`
- All instances across all folder depths are returned

---

## TC-06-12 — `read_document` — read full document

**GIVEN** a document is ingested (has a document ID from glob/ls)
**WHEN** (Explorer mode) I ask the agent to "show me the full content of [filename]"
**THEN**
- The agent first calls `glob` or `ls` to find the document_id
- Then calls `read_document` with that ID
- The ToolCallPanel shows a BookOpen icon
- The expanded view shows the document content in a monospace scrollable area with line numbers
- The response quotes or summarizes the content

---

## TC-06-13 — `read_document` — read specific line range

**GIVEN** a large document is ingested
**WHEN** (Explorer mode) I ask "Show me lines 10 to 30 of [filename]"
**THEN**
- `read_document` is called with `start_line=10, end_line=30`
- Only lines 10–30 are returned, prefixed with line numbers
- The response discusses the content of those lines

---

## TC-06-14 — `analyze_document` — deep document analysis in Explorer mode

**GIVEN** a multi-page document is ingested
**WHEN** (Explorer mode) I ask "Give me a detailed analysis of [filename]"
**THEN**
- The `analyze_document` tool fires
- A sub-agent streaming panel appears in the ToolCallPanel
- The sub-agent output streams live
- The final response provides a comprehensive analysis

---

## TC-06-15 — Explorer mode does NOT use web_search or query_documents

**GIVEN** Explorer mode is active
**WHEN** I ask "Which files were uploaded this month?" (SQL-style question)
**THEN**
- `query_documents` is NOT called (not in explorer tool set)
- The agent uses KB navigation tools instead (e.g., `ls` or `glob`) or states it cannot perform SQL queries in this mode
- No web_search tool appears either

---

## TC-06-16 — Explorer mode: full KB tour chain

**GIVEN** a multi-folder knowledge base with diverse documents
**WHEN** (Explorer mode) I ask "Give me a complete tour of my knowledge base — what folders exist, what documents are in each, and what topics they cover?"
**THEN**
- Agent calls `tree` to get the structure
- Agent calls `ls` on specific folders
- Agent calls `grep` or `read_document` to sample content
- Multiple tool call panels are visible in sequence
- The final response is a structured prose summary of the entire knowledge base

---

## TC-06-17 — Mode persists during a thread session

**GIVEN** Explorer mode is active and I've exchanged several messages
**WHEN** I send another message without changing the mode
**THEN**
- Each message continues to use Explorer mode
- The mode selector still shows "Explorer"
- Tool panels continue to show KB tools only

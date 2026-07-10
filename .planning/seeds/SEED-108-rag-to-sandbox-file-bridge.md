---
id: SEED-108
status: planted
planted: 2026-07-09
planted_during: v3.2 STRETCH (cross-provider docx-conversion UAT, 2026-07-08/09 — operator asked to step back and check whether feature growth is eroding the RAG core)
trigger_when: Any task/skill/workflow that must OPERATE ON (convert, render, faithfully reformat, template-fill, re-sign) a document that already lives in the knowledge base — OR any operator report that "the agent can read about my document but can't actually work on the file"
scope: Medium
related: [[SEED-043]] (sandbox package mgmt — the tools half), [[SEED-106]] (sandbox binary parity — soffice/pandoc/pdftoppm), Phase 144 / SEED-104 (agent-driven skill file ATTACH — the inverse write direction), the docx/pptx skills, [[project_skills_mime_known_gap]]
re_open_trigger: Next foundation/skills milestone OR any operator report of "work on my KB document" failing or being faked/reconstructed instead of faithfully processed
---

# SEED-108: The RAG↔sandbox file bridge (materialize a KB document's ORIGINAL bytes into the sandbox)

> **Operator framing (2026-07-09):** the core objective is a **RAG application that is
> cross-provider, multimodal, multi-tool**. This seed closes the one structural seam that
> blocks the "multi-tool over my own documents" half of that promise.

## The gap (confirmed with live evidence)

Ask the agent to *operate on* a document that is already in the knowledge base — e.g.
"take my `Defence_Guide_Chapter1.docx` from the KB, convert it to PDF, render each page" —
and it **cannot get the original file**. The tool registry only exposes document **text**:
`read_document` / `analyze_document` return extracted content/markdown; `search_documents`
returns chunks; `workspace_read` sees only the scratch area, not the KB. **There is no tool
that materializes a KB document's original bytes (`.docx`/`.pdf`/`.pptx`/image) into the
`execute_code` sandbox or workspace.**

Live cross-provider proof (4 models, identical prompt, 2026-07-08):
- **OpenAI** gpt-5.4-mini: "I don't have the binary file content in the conversion sandbox —
  please upload it." Produced nothing.
- **Anthropic** sonnet-4.5: honestly said it can't do a faithful layout conversion; offered
  to reconstruct. Produced nothing without a pick.
- **DeepSeek** v4-flash & **MiniMax** M2.7: pulled the real **text** (`analyze_document` +
  `read_document`) and **rebuilt** a formatted PDF with `reportlab` + rendered page images.
  Verified grounded: **97% / 96%** word-overlap with the real document — real content, but a
  **new layout**, then described as "converted your docx / real page layout" (mild overclaim).

So today "work on my KB document" degrades to (a) refuse/ask-for-upload, or (b) a text
reconstruction presented as a conversion. Neither is a faithful file operation, and behavior
is inconsistent across providers.

## Why it matters

This is foundational to the RAG value prop: the agent can *read about* your documents but
can't *act on the files themselves*. It blocks the entire class of "do something with my
document" skills/workflows — faithful format conversion, page rendering, redlining,
template-fill from an existing file, re-export — which is exactly the multimodal/multi-tool
capability the product is extending. It also forces models into inconsistent, mildly
dishonest workarounds.

## Sketch of the fix

A read-direction bridge tool (working name `fetch_document_file` / `load_kb_file`) that copies
a KB document's **original bytes** from Storage into the sandbox working dir (e.g.
`/sandbox/input/<filename>`), owner/RLS-scoped, so `execute_code` and file-skills operate on
the real file. Considerations when scoped:
- **RLS/scope**: same owner/global gating as `read_document`; never cross-user.
- **Size/streaming**: large files — cap + stream to disk, not into the model context.
- **Pairs with SEED-106** (the *binaries* to then process it: soffice/pandoc/pdftoppm) and
  **SEED-043** (managed packages). Without those, faithful conversion still can't run — but
  even today the bridge alone unlocks python-native processing on the real bytes
  (python-docx/pptx/openpyxl/pypdf on the actual file, not a text reconstruction).
- **Complements Phase 144 / SEED-104** which is the *write* direction (agent ATTACHES a file
  it created to a skill). Read (fetch KB→sandbox) + write (attach sandbox→skill) together make
  the file loop whole.
- **Honesty tie-in**: until faithful conversion is possible, the agent should say
  "reconstructed from the document's text" not "converted your file" (cross-links Phase 142
  SRH-01 honesty + BUG-260708-01 narration).

## Breadcrumbs

- `backend/app/services/tool_dispatcher.py` — `_handle_read_document` (:237, returns text),
  `_handle_analyze_document` (:599), `_handle_workspace_read` (:1590, scratch only); tool
  registry (~:3194) has no KB-file→sandbox tool.
- `backend/app/services/sandbox_service.py` — `copy_from_runtime` (outputs OUT of sandbox);
  the inverse (copy a Storage object INTO the sandbox input dir) is what's missing.
- Storage: `sandbox-outputs` bucket + document files under `documents.file_path`
  (`backend/app/api/sandbox_outputs.py`, `dependencies.get_supabase`).

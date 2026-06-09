# C — Document Template-Fill: Technical Patterns (v2.9 exploration)

**Research question:** How is "document template-fill" actually built? Cover placeholder/schema
approaches, the LLM mapping pattern, ephemeral in-chat upload, validation, and the lowest-risk
implementation path on **our** stack (sandbox already ships python-docx 1.1.2, python-pptx 1.0.2,
openpyxl 3.1.5, reportlab 4.2.5).

**Date:** 2026-06-08 · **Author:** research subagent · **Status:** exploration input for v2.9 scope

---

## TL;DR for v2.9 scope

1. **There are two fundamentally different template-fill strategies**, and we should support
   *both* as separate workflow patterns, not one:
   - **(A) Author-time placeholder templates** — the template *creator* embeds machine-readable
     markers (`{{jinja}}` for docx via **docxtpl**, `{{placeholder}}` text for Google Docs
     `replaceAllText`, **content controls / SDT** with data-binding for enterprise Word). This is
     the *reliable, formatting-preserving* path. The LLM only produces a **context dict**, never
     touches the file bytes.
   - **(B) Schema-discovery fill** — user uploads an *arbitrary* template with no markers; the
     agent must *infer* where things go (read the docx/pptx/xlsx structure, build a fill-schema,
     fill blanks or content controls). This is the "magic" path the operator wants but it is
     materially less reliable and the source of nearly every formatting-loss / corruption failure
     mode below.
2. **Lowest-risk path on our stack:** add **`docxtpl`** (pulls jinja2 + lxml, both already present)
   to the sandbox for `.docx`; keep **python-pptx** run-level replacement for `.pptx`; **openpyxl**
   in-place cell writes for `.xlsx` — but **gate on the known round-trip data-loss**
   (openpyxl drops charts/images/pivots on load→save). Render **inside our existing Docker
   sandbox** (sealed, no network) via `execute_code`, which also neutralizes the docxtpl/Jinja
   **SSTI→RCE** risk (see §1.1 + §5.3).
3. **The LLM never renders the file.** Use a **Pydantic structured-output** "field map" (matches
   our "Pydantic for structured outputs, raw SDK" rule), then a **deterministic programmatic
   render step**. This maps cleanly onto the existing Harness: `llm_single` (or `llm_agent` with
   `search`/`query_tables`) to build the context → `programmatic` phase to render → **validation
   gate** to check completeness + integrity. No new engine needed.
4. **Ephemeral upload = a TTL'd workspace file, not a KB document.** Store the uploaded template in
   Supabase Storage scoped to the thread/workspace with an `expires_at` and a sweep job; never run
   it through ingestion/embedding. This mirrors how OpenAI (assistant-thread files auto-expire
   ~7 days), and how ChatGPT "temporary chat" / per-chat attachments behave.

---

## 1. Template placeholder / schema approaches & formatting tradeoffs

### 1.1 `.docx` — the landscape (best → worst for formatting fidelity)

**docxtpl (python-docx-template), current 0.20.x** — *recommended for docx.* Uses a real `.docx`
as a Jinja2 template; `python-docx` for the OOXML, Jinja2 for the tags. Workflow:
`DocxTemplate("t.docx")` → `doc.render(context)` → `doc.save("out.docx")`.
([docs](https://docxtpl.readthedocs.io/), [GitHub](https://github.com/elapouya/python-docx-template))

- **Tag vocabulary** that solves the "Word splits a run" problem structurally:
  `{{ var }}` (inline), `{%p %}` (paragraph-level), `{%tr %}` (repeat/guard table **rows**),
  `{%tc %}` (table **columns**), `{%r %}` (run-level), `{# #}` comments; cell spanning via
  `{% colspan %}` / `{% hm %}` / `{% vm %}`, cell background `{% cellbg %}`.
- **Rich content:** `RichText`/`R()` for runtime-styled text, `InlineImage` (Mm/Inches/Pt),
  subdocuments (`new_subdoc()`), `replace_pic()`/`replace_media()` for header/footer images,
  hyperlinks via `build_url_id()`.
- **Validation hooks built in:** `get_undeclared_template_variables()` lists every `{{tag}}` the
  template expects — this is our completeness/coverage oracle (see §4).
- **Gotchas / failure modes:** a Jinja tag must live **inside one paragraph/run/row** (can't span
  structural boundaries); don't use `{%p`/`{%tr`/`{%tc`/`{%r` twice in the same element; `RichText`
  renders *before* filters so it's incompatible with Jinja filters; Word 2016 ignores `\t`/leading
  spaces (use `RichText`); unescaped `<`,`>`,`&` corrupt the XML unless you use `RichText`, `|e`,
  `escape()`, or `render(context, autoescape=True)`.
- **SECURITY (load-bearing):** docxtpl renders Jinja2 *server-side*. If the **template author is
  untrusted**, this is textbook **SSTI → RCE** — the exact vuln class that hit
  **adfinis/document-merge-service (a docxtpl-based service): RCE via SSTI**
  ([advisory GHSA-v5gf-r78h-55q6](https://github.com/adfinis/document-merge-service/security/advisories/GHSA-v5gf-r78h-55q6);
  general [OnSecurity Jinja2 SSTI](https://onsecurity.io/article/server-side-template-injection-with-jinja2/),
  [RAGFlow GHSA-vvwj-fvwh-4whx](https://github.com/infiniflow/ragflow/security/advisories/GHSA-vvwj-fvwh-4whx)).
  Mitigation: `doc.render(context, jinja_env=...)` accepts a custom env — pass
  **`jinja2.sandbox.SandboxedEnvironment()`** ([Jinja API](https://jinja.palletsprojects.com/en/stable/api/),
  [docxtpl jinja_env usage](https://github.com/elapouya/python-docx-template/blob/master/tests/custom_jinja_filters.py)),
  AND render inside our sealed Docker sandbox so even a sandbox-escape Jinja payload has no network
  and no host FS.

**python-docx 1.1.2 (raw) — placeholder replace** — *use for schema-discovery / no-Jinja templates.*
The naive trap: assigning `paragraph.text = ...` **destroys all runs and their formatting** —
"changing a paragraph's text removes all styles and runs from it." The correct technique is
**run-level replacement**: iterate `paragraph.runs`, and for each run whose `.text` contains the
marker, do `run.text = run.text.replace(key, value)` — preserving that run's font/size/color
([xa0.de — preserving style](https://blog.xa0.de/post/Filling-a-docx-template-with-Python-while-preserving-style/),
[python-docx #415](https://github.com/python-openxml/python-docx/issues/415),
[#519 splitting a run](https://github.com/python-openxml/python-docx/issues/519)).
- **The dominant failure mode:** Word silently splits a marker across runs (`{NAM` | `E}`), so the
  full string is never found and replacement **fails silently**. Two defenses: (a) tell the user to
  type each placeholder "in one go" (single-run); (b) **normalize runs** by merging adjacent
  same-format runs before matching, or detect+repair split markers. Libraries that wrap this:
  **`python-docx-replace`** ([PyPI](https://pypi.org/project/python-docx-replace/)).
- **Tables/merge cells:** python-docx can read/write cell text but merged cells are surfaced as
  repeated cell references; writing into the wrong grid cell of a merge produces duplicated text.

**Content controls / Structured Document Tags (SDT) + XML data-binding** — *the enterprise-grade,
most robust marker*, but heavy. A content control is a first-class Word placeholder that can
**data-bind** to a `CustomXmlPart` via XPath; you ship `template.docx` + an XML data blob and Word
hydrates the controls ([CodeProject](https://www.codeproject.com/Articles/96408/Content-Controls-and-Open-XML-2-0-SDK),
[Lenni Lobel](https://lennilobel.wordpress.com/2009/11/20/dataview-separation-in-word-2007-using-word-xml-data-binding-and-openxml/),
[OpenDoPE](https://www.opendope.org/approach_our.html)). The reference toolchain is the **Microsoft
Open XML SDK** (server-side, no Word install) with `MailMerge`/merge-field support
([MailMerge class](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.mailmerge?view=openxml-3.0.1)).
- **Tradeoff for us:** Open XML SDK is **.NET**; we are Python — not a fit. python-docx has **no
  high-level SDT API**, so we'd manipulate `w:sdt` elements via `lxml` ourselves. SDT-binding is the
  *most formatting-safe* (the marker is a real Word object, not text that can split) but the
  authoring + Python-side plumbing cost is high. **Recommendation: defer SDT to a later milestone;
  docxtpl covers ~90% at far lower cost.**

### 1.2 `.pptx` — python-pptx 1.0.2

- **Placeholders are inheritance-based**: position/size/fill/line/font are inherited from the layout
  placeholder; directly-applied formatting overrides it. Fill by walking shapes with
  `shape.has_text_frame`, then replace text **at the run level** inside
  `shape.text_frame.paragraphs[i].runs[j]` (same run-split discipline as docx)
  ([placeholders-using](https://python-pptx.readthedocs.io/en/latest/user/placeholders-using.html),
  [placeholders-understanding](https://python-pptx.readthedocs.io/en/latest/user/placeholders-understanding.html),
  [text](https://python-pptx.readthedocs.io/en/stable/user/text.html)).
- **Hard limitation:** python-pptx **cannot add or remove rows/columns of an existing table**
  ([#192](https://github.com/scanny/python-pptx/issues/192),
  [table API](https://python-pptx.readthedocs.io/en/latest/api/table.html)). For variable-length
  data (e.g. an N-row risk register slide) you must pre-size the table in the template, or build a
  new table and copy cells. Merged cells: `is_merge_origin`, `cell.split()` to un-merge, but the
  grid count is fixed ([cell merge](https://python-pptx.readthedocs.io/en/stable/dev/analysis/tbl-merge.html)).
- **No native Jinja equivalent** — there is no widely-adopted "pptx-template" lib on par with
  docxtpl, so pptx is inherently the **schema-discovery / run-replace** path. Fixed-shape decks
  (title, body, fixed table) fill cleanly; dynamic-count decks are the risk.

### 1.3 `.xlsx` — openpyxl 3.1.5

- Fill is the easiest mechanically: `wb = load_workbook("t.xlsx")`, write `ws["B2"] = value` or
  `ws.cell(row, col).value = value`, `wb.save("out.xlsx")`. Cell **styles survive** edits; merged
  cells take the value/border on the **top-left** cell only (others are `None`).
- **CRITICAL round-trip data loss:** openpyxl "does **not** read all possible items in an Excel
  file, so **shapes will be lost** from existing files if opened and saved." Only cells (values,
  styles, hyperlinks, comments) + some sheet attributes are copied — **images, charts, pivot
  tables** are dropped on load→save; there is "no management API for pivot tables, charts, images"
  ([styles docs](https://openpyxl.readthedocs.io/en/stable/styles.html),
  [pivot docs](https://openpyxl.readthedocs.io/en/stable/pivot.html),
  [changes/limitations](https://openpyxl.readthedocs.io/en/3.1/changes.html)). So a polished xlsx
  template *with an embedded chart/logo* will come back **stripped**. Mitigations: (a) require the
  xlsx template to carry **no charts/images** (data + named ranges only) and generate charts
  separately; (b) keep VBA via `keep_vba=True`; (c) for high-fidelity Excel, prefer
  Open-XML-direct manipulation — out of scope for v2.9.
- **Column/row-level styling** only applies to *new* cells created in Excel after save — to style a
  full row/col you must style each cell individually (file-format restriction).

### 1.4 Google Docs / Sheets API templating (for completeness — not our stack today)

Pattern: **Drive `files.copy`** the template → **`documents.batchUpdate`** with
`ReplaceAllTextRequest` (`containsText:{text:"{{name}}", matchCase:true}`, `replaceText:"..."`),
batch many replacements in one call; applies across all tabs by default; image swap via separate
requests ([merge how-to](https://developers.google.com/workspace/docs/api/how-tos/merge),
[mail-merge sample](https://developers.google.com/workspace/docs/api/samples/mail-merge),
[batchUpdate ref](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate)).
- **Tradeoff:** zero local formatting-loss risk (Google renders), but requires OAuth + Drive
  storage + connectors — none of which exist in our app. This is **plugin `data_source` /
  connector territory (deferred)**, not v2.9 core. Worth flagging as the cleanest path *if/when* we
  add a Google connector, because `replaceAllText` sidesteps the run-split problem entirely.

---

## 2. The LLM pattern: KB → placeholder schema → render

**Golden rule: the LLM produces *data*, deterministic code produces the *file*.** This matches our
project rules ("Pydantic for structured outputs", "raw SDK, no LangChain/LangGraph").

**Recommended pipeline (maps 1:1 onto the existing Harness):**

1. **Schema extraction.** Derive the placeholder schema from the template:
   - docxtpl: `get_undeclared_template_variables()` → the exact set of required keys.
   - python-docx/pptx/openpyxl: scan for markers / named ranges / content controls → build a
     `List[FieldSpec]` (name, type, where-it-lives, repeatable?).
2. **Field-map generation (LLM, grounded).** One `llm_single`/`llm_agent` call per template (or per
   section) that, given the **retrieved KB chunks**, returns a **Pydantic model** whose fields are
   exactly the placeholder keys. Each field carries its **citation(s)** — the well-established
   pattern is to add `source_page`/`source_doc`/`chunk_id` fields and instruct "leave null if the
   context doesn't support it" ([freeCodeCamp Pydantic](https://www.freecodecamp.org/news/how-to-keep-llm-outputs-predictable-using-pydantic-validation/),
   [dida structured outputs](https://dida.do/blog/structured-outputs-with-openai-and-pydantic),
   [MachineLearningMastery](https://machinelearningmastery.com/the-complete-guide-to-using-pydantic-for-validating-llm-outputs/)).
   For repeatable sections (risk rows, WBS items) the field is a `List[RowModel]`.
3. **Grounding / RAG.** Retrieve with our existing hybrid search **scoped to the project folder**,
   pass chunks as context, require citations. RAG grounding is what keeps fields factual; structured
   output keeps them machine-placeable
   ([LlamaIndex structured extraction](https://developers.llamaindex.ai/python/examples/structured_outputs/structured_outputs/)).
4. **Partial-fill + human review.** Don't force every field. Allow `null`/`"<<MISSING: reason>>"`
   so the LLM can *decline* rather than hallucinate; surface the unfilled set to the user. docxtpl's
   `get_undeclared_template_variables()` + the null-fields list = the review checklist. This is a
   natural **`llm_human_input` (ask_user)** pause in the harness: "I filled 14/18 fields; 4 have no
   KB support — provide values or confirm leaving blank."
5. **Deterministic render** in the sandbox (`programmatic` phase / `execute_code`): feed the
   validated context dict to docxtpl/python-pptx/openpyxl → emit the file as a **workspace output
   file** (we already have OutputFileCard + per-thread versioned files).

**Why structured-output-then-render beats "LLM writes the OOXML":** LLMs producing raw docx/OOXML or
calling python-docx free-hand is exactly where corrupted files and silent formatting loss come from.
Constrain the model to a typed field map; let pinned library code touch the bytes.

---

## 3. Ephemeral / temporary in-chat upload (template ≠ KB document)

The requirement: upload a template that is the **output shape for one task** and is **not**
permanently ingested/embedded into the knowledge base.

**How products scope/store/expire this:**

- **OpenAI Files API:** default — files persist until deleted; `purpose=batch` auto-expires ~30d;
  **Assistants thread uploads auto-expire ~7 days after last activity** even without a flag;
  `expires_after` configurable 14–30 days
  ([Files create ref](https://developers.openai.com/api/reference/resources/files/methods/create),
  [File uploads FAQ](https://help.openai.com/en/articles/8555545-file-uploads-faq),
  [data controls](https://platform.openai.com/docs/guides/your-data)).
- **Anthropic Files API:** persist **until explicitly DELETEd** — no auto-expiry
  ([Files API docs](https://docs.anthropic.com/en/docs/build-with-claude/files)).
- **Product UX scoping:** ChatGPT **"temporary chat"** and **per-chat attachments** = session-scoped,
  not added to long-term memory; **Claude Projects** separate *Project Knowledge* (persistent,
  cross-chat) from a **per-chat attachment** (≤20 files/chat, ≤30 MB each, scoped to that chat)
  ([Claude vs ChatGPT file handling](https://www.datastudios.org/post/chatgpt-vs-claude-for-file-upload-reading-capabilities-full-comparison-and-report-models-file),
  [ChatGPT retention](https://help.openai.com/en/articles/8983778-chat-and-file-retention-policies-in-chatgpt)).
- **The reusable pattern:** apply **TTL only to files explicitly created as temporary** — store
  `expires_at` in metadata at creation, **sweep on access + on a cron**; or hand out **presigned
  upload/download URLs** (S3/Supabase) with short lifetimes (S3 presigned ≤7 days max)
  ([open-webui file-TTL discussion](https://github.com/open-webui/open-webui/discussions/23380),
  [presigned URL guide](https://oneuptime.com/blog/post/2026-02-12-generate-presigned-urls-temporary-s3-access/view)).

**Recommendation for our stack (no provider-side files — we're stateless completions):**
- Reuse **the existing per-thread workspace** (v2.7 versioned files in Supabase Storage). Add a
  file *kind* = `template_input` (or `ephemeral`) with an `expires_at` column and **RLS-scoped to
  the owning thread/workspace**.
- The uploaded template is **never** sent to ingestion/embedding and **never** appears in KB search.
  It is read by the render step only.
- Expiry: cron/sweep deletes `expires_at < now()` (e.g. 24h after thread inactivity, mirroring
  OpenAI's 7-day-after-last-activity idea but tighter). Output file (the filled doc) can be promoted
  to a normal workspace file the user keeps.
- This is a **storage + lifecycle** change, **not** a new ingestion pipeline — low blast radius.

---

## 4. Validation: is the filled template correct, complete, and not hallucinated?

Three independent layers — all cheap, all should be **validation gates** in the harness:

**(a) Structural / completeness (deterministic, no LLM):**
- **Coverage:** every placeholder key from `get_undeclared_template_variables()` (docx) / the
  detected marker set must be present in the context; report unfilled keys. Jinja's
  `StrictUndefined` makes a missing key raise instead of silently rendering blank.
- **Type/format:** Pydantic validators on the field map (dates parse, numbers numeric, enums in
  range) before render ([Pydantic LLM validation](https://www.freecodecamp.org/news/how-to-keep-llm-outputs-predictable-using-pydantic-validation/)).
- **File integrity (corruption guard):** after render, **re-open the output** with the same library
  (`Document(out)`, `Presentation(out)`, `load_workbook(out)`) and assert it loads + has expected
  paragraph/slide/sheet counts. A file that opens clean is a strong "not corrupted" signal. Catch
  docxtpl `TemplateSyntaxError` (bad tags), unescaped-XML corruption, openpyxl save errors.

**(b) Faithfulness / anti-hallucination (LLM-as-judge + claims):**
- **Claim-level verification:** decompose each filled field into atomic claims, verify each against
  the cited KB chunk, score % supported — the standard RAG faithfulness recipe
  ([Datadog LLM-as-judge](https://www.datadoghq.com/blog/ai/llm-hallucination-detection/),
  [Deepchecks](https://deepchecks.com/llm-hallucination-detection-and-mitigation-best-techniques/),
  [faithfulness metrics survey, arXiv:2501.00269](https://arxiv.org/pdf/2501.00269)).
- **Citation traceability:** every non-trivial field must carry a `chunk_id`/page; a field with no
  retrievable source is flagged for review (treat as potential factuality hallucination)
  ([faithfulness vs factuality survey, arXiv:2510.06265](https://arxiv.org/html/2510.06265v2)).
- **Known limitation:** retrieval-based checks are only as good as retrieval — if the KB lacks the
  fact, the judge may *miss* a hallucination or *false-flag* a correct value. So pair the judge with
  the **human-review** step (§2.4), don't treat it as a hard pass/fail by itself.

**(c) Multidimensional acceptance:** a fill can be "faithful yet incomplete" or "complete yet poorly
grounded." Score **coverage × faithfulness × integrity** separately and show all three to the user
rather than one number ([hallucination survey, arXiv:2510.06265](https://arxiv.org/pdf/2510.06265)).

---

## 5. Lowest-risk implementation path on OUR stack

Our sandbox already ships (pinned, `backend/Dockerfile.sandbox`):
`python-pptx==1.0.2`, `openpyxl==3.1.5`, `python-docx==1.1.2`, `reportlab==4.2.5`, plus pandas/numpy.
**`docxtpl` and `jinja2` are NOT installed** today (jinja2/lxml come transitively with docxtpl).

**5.1 Format-by-format recommendation**

| Format | Engine | Mode | Main risk to gate |
|---|---|---|---|
| `.docx` | **add `docxtpl`** (author-time `{{jinja}}`) + python-docx run-replace fallback | A (preferred) / B | run-split silent miss; **SSTI** if author untrusted |
| `.pptx` | **python-pptx** run-level replace | B (schema-discovery) | **cannot add table rows** → pre-size template |
| `.xlsx` | **openpyxl** in-place cell write | B | **charts/images/pivots dropped on save** |
| `.pdf` | **reportlab** generate-from-data (not fill) | generate | not a true "fill"; build from context |

**5.2 Harness mapping (no new engine, reuse v2.8 primitives)**
1. `programmatic` — parse template, extract placeholder schema (`get_undeclared_template_variables`
   / marker scan), emit `FieldSpec[]`.
2. `llm_agent` (tools: `search`, `query_documents`, `query_tables`, scoped to the project folder) —
   produce the Pydantic field-map **with citations + nullable fields**.
3. **validation gate** — coverage + Pydantic type checks; **bounded retry** if fields missing.
4. `llm_human_input` (ask_user) — surface unfilled/uncited fields for operator decision.
5. `programmatic` (`execute_code`) — render in sandbox, **re-open output to assert integrity**, emit
   as workspace output file.
6. **validation gate** — faithfulness/LLM-judge score; flag low-grounded fields.

**5.3 Why this is low-risk**
- **No shared-path changes:** template-fill is a *new tool / workflow phase type composition*, not a
  change to the streaming/SSE/agent-loop hot files. Honors the "never break working things" RED LINE.
- **SSTI contained twice:** `SandboxedEnvironment` for Jinja **and** rendering inside the sealed,
  network-less Docker sandbox. Even so, treat **user-uploaded docx-with-Jinja as untrusted** and
  prefer author-time templates from the project library (trusted) for the docxtpl path; reserve
  arbitrary uploads for the *non-Jinja* run-replace path.
- **Ephemeral storage = additive:** new `expires_at`/`kind` on the existing workspace-files table +
  a sweep; no ingestion-pipeline touch, no embedding cost, RLS already isolates per-user.
- **Validation is reusable harness machinery:** completeness/integrity/faithfulness are exactly the
  4-kind validation gates the harness already runs.

**5.4 Concrete failure modes to budget for (test these in UAT)**
- docx marker split across runs → silent non-replacement (author guidance + run-normalization).
- docx unescaped `& < >` in KB values → corrupt XML (force `autoescape`/`RichText`/`|e`).
- docxtpl tag spanning a paragraph/row boundary → `TemplateSyntaxError`.
- pptx variable-row table → can't grow; pre-size or rebuild table.
- xlsx template with chart/logo → **stripped on save** (require chart-free templates or regenerate).
- merged cells (docx & xlsx & pptx) → write to the wrong grid cell → duplicated/lost text.
- any engine → produced file won't open → **re-open-to-validate** catches it before the user does.
- SSTI payload in an uploaded "template" → arbitrary code; sandbox + SandboxedEnvironment + trusted-
  author-only Jinja.

---

## Sources

- docxtpl docs — https://docxtpl.readthedocs.io/ · PyPI https://pypi.org/project/docxtpl/ · GitHub https://github.com/elapouya/python-docx-template · jinja_env test https://github.com/elapouya/python-docx-template/blob/master/tests/custom_jinja_filters.py
- python-docx run/formatting — https://blog.xa0.de/post/Filling-a-docx-template-with-Python-while-preserving-style/ · https://github.com/python-openxml/python-docx/issues/415 · https://github.com/python-openxml/python-docx/issues/519 · https://pypi.org/project/python-docx-replace/
- python-pptx — https://python-pptx.readthedocs.io/en/latest/user/placeholders-using.html · https://python-pptx.readthedocs.io/en/latest/user/placeholders-understanding.html · https://python-pptx.readthedocs.io/en/latest/api/table.html · https://python-pptx.readthedocs.io/en/stable/dev/analysis/tbl-merge.html · https://github.com/scanny/python-pptx/issues/192
- openpyxl — https://openpyxl.readthedocs.io/en/stable/styles.html · https://openpyxl.readthedocs.io/en/stable/pivot.html · https://openpyxl.readthedocs.io/en/3.1/changes.html
- Open XML SDK / content controls — https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.mailmerge?view=openxml-3.0.1 · https://www.codeproject.com/Articles/96408/Content-Controls-and-Open-XML-2-0-SDK · https://lennilobel.wordpress.com/2009/11/20/dataview-separation-in-word-2007-using-word-xml-data-binding-and-openxml/ · https://www.opendope.org/approach_our.html
- Google Docs API — https://developers.google.com/workspace/docs/api/how-tos/merge · https://developers.google.com/workspace/docs/api/samples/mail-merge · https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate
- LLM structured output / Pydantic / RAG — https://www.freecodecamp.org/news/how-to-keep-llm-outputs-predictable-using-pydantic-validation/ · https://dida.do/blog/structured-outputs-with-openai-and-pydantic · https://machinelearningmastery.com/the-complete-guide-to-using-pydantic-for-validating-llm-outputs/ · https://developers.llamaindex.ai/python/examples/structured_outputs/structured_outputs/
- Ephemeral file upload / retention — https://developers.openai.com/api/reference/resources/files/methods/create · https://help.openai.com/en/articles/8555545-file-uploads-faq · https://help.openai.com/en/articles/8983778-chat-and-file-retention-policies-in-chatgpt · https://docs.anthropic.com/en/docs/build-with-claude/files · https://www.datastudios.org/post/chatgpt-vs-claude-for-file-upload-reading-capabilities-full-comparison-and-report-models-file · https://github.com/open-webui/open-webui/discussions/23380 · https://oneuptime.com/blog/post/2026-02-12-generate-presigned-urls-temporary-s3-access/view
- Hallucination / faithfulness validation — https://www.datadoghq.com/blog/ai/llm-hallucination-detection/ · https://deepchecks.com/llm-hallucination-detection-and-mitigation-best-techniques/ · https://arxiv.org/pdf/2501.00269 · https://arxiv.org/html/2510.06265v2 · https://arxiv.org/pdf/2510.06265
- SSTI / security — https://github.com/adfinis/document-merge-service/security/advisories/GHSA-v5gf-r78h-55q6 · https://onsecurity.io/article/server-side-template-injection-with-jinja2/ · https://github.com/infiniflow/ragflow/security/advisories/GHSA-vvwj-fvwh-4whx · https://jinja.palletsprojects.com/en/stable/api/ · https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server-side_Template_Injection

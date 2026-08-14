---
id: SEED-158
title: A real client template has no {{ placeholders }} — and the app cannot use it at all
status: open
planted: 2026-08-14
planted_by: Quick task 260814-q5r — operator scenario during the end-to-end UAT
surface: Agentic-RAG
severity: high
affected_areas: [templates, template_render_service, workflow-authoring, document-editing, sandbox]
requirements: [AUTH-03]
re_open_trigger: >
  A real (non-fixture) customer template failing to bind because it carries no Jinja tokens, OR
  any phase that proposes authoring/editing placeholders into a document, OR the document-editing
  capability of [[SEED-161]] being scheduled. Whichever comes first.
---

# The plain-template case — the common one, and the one we cannot serve

## The operator's scenario (2026-08-14)

> *"suppose that we have weekly report where I should populate the KPIs, the progress this week,
> the risks, other things. And my template does not include placeholders — it's a template with
> plain language description. Be able maybe to modify template, put the placeholders, and then
> this workflow…"*

## Measured

- The render engine is **docxtpl / Jinja**. `parse_docx_template_variables`
  (`template_render_service.py:355-413`) finds `{{ … }}` and `{% for … %}` tokens and returns
  `None` when there are none.
- **Nothing in the codebase can WRITE placeholders into a document.** Searched
  `backend/app/**` for any placeholder-authoring capability: none exists.
- A plain `.docx` therefore binds successfully, parses to zero fields, and — after
  `260814-q5r` — honestly reports *"We read this template and found no fill-in fields in it."*
  Honest, and useless: the workflow can never fill it.
- The parser is additionally **Word-only** (`word/document.xml` + headers/footers), so `.pptx`
  and `.xlsx` — both accepted by the upload door — can never yield fields at all.

## Why this is the common case, not the edge case

Every template that arrives from a client, a regulator or a PMO is a **finished document**:
styles, tables, numbering, headers, branding, an approved layout. Nobody hands over a file with
`{{ overall_rag_status }}` in it. Requiring Jinja tokens means requiring the customer to learn our
templating syntax before the product does anything — which is the adoption wall.

## ⚠ The argument AGAINST the obvious fix, recorded so it is not skipped

"Let the AI add the placeholders" is the natural answer and it carries a real risk that must be
weighed rather than discovered later: **the moment the AI rewrites the file, the document the
customer approved is no longer the document that gets filled.** A round-trip through a generated
rewrite can silently change styles, break table structure, drop headers or mangle numbering — and
it will be noticed by the client, not by us. Building it properly means building a document
editor, which is [[SEED-161]] and a different milestone.

## Three shapes, cheapest first (none decided)

1. **Propose, don't edit.** The AI reads the document and proposes a mapping — *"I'd fill this
   paragraph with `progress_this_week`"* — the human approves, and the edit is applied
   mechanically with a visible diff. Preserves the "we never silently touch your document" rule.
2. **Fill under headings, no Jinja at all.** A plain template's prose headings (*Progress this
   week*, *Risks*) **already are** a schema. This drops the Jinja requirement entirely, but needs
   a second render strategy beside docxtpl — the bigger change, and possibly the better product.
3. **Author the tokens for them** (the operator's literal suggestion). Highest value, highest
   blast radius, blocked on [[SEED-161]].

⚠ **The Jinja requirement is an IMPLEMENTATION constraint leaking into the user's workflow.**
That framing should survive into whatever phase takes this: the customer's problem is not "my
template lacks tokens", it is "fill my document".

Related: [[SEED-157]] (template-first authoring), [[SEED-161]] (in-app document editing).

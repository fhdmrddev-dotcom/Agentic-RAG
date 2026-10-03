# Requirements: Milestone v4.5 Find It, Show It

**Defined:** 2026-09-29 (operator intake; research skipped, seeds hold the analysis)
**Core value:** Find documents by what they ARE, get the file back out, and let the agent answer with interactive artifacts.

Postponed by operator: hardening/testing milestone, plugins/ecosystem work. Out of scope: SEED-211 (permissions derived from metadata) - a security fork, not a findability feature.

## v4.5 Requirements

### Find the document (FIND) - SEED-243, SEED-153, SEED-224

- [ ] **FIND-01**: User can search for documents by type, owner, dates, custom fields, folder path, relationships and version state, and gets documents back rather than passages.
- [ ] **FIND-02**: Document search is its own mode beside RAG search; the two never share a ranking.
- [ ] **FIND-03**: Folder path, relationships and version lineage are filterable dimensions.
- [x] **FIND-04**: User can download the original file of any document they can access; the UI states latest vs viewed version; the URL is short-lived and minted only after an org authorization check.
- [x] **FIND-05**: Document detail shows rich file facts: created, modified, pages, size, type, uploader.
- [ ] **FIND-06**: The Classification page is renamed for what people do there and mounted inside the Library.
- [x] **FIND-07**: The agent can pass date and dimension filters into retrieval, so "October revenue" cannot return March.

### Agent-authored artifacts (ART) - SEED-193 (SEED-194 rides the same rail later)

- [ ] **ART-01**: Agent can emit a validated chart spec that renders as an interactive chart in chat.
- [ ] **ART-02**: Components come from a closed registry; an unknown component or malformed props render nothing and show a notice, never raw passthrough.
- [ ] **ART-03**: The underlying rows stay attached so a follow-up can re-encode the chart without re-running the query.
- [ ] **ART-04**: Table and metric components join the registry as the second and third entries.
- [ ] **ART-05**: The artifact reloads identically from history and works across the full native provider roster.

### Retention (RET) - SEED-250

- [ ] **RET-01**: Admin can set a retention policy per document class or folder (period and action).
- [ ] **RET-02**: A legal hold blocks disposition.
- [ ] **RET-03**: Disposition runs on a schedule and writes an audit record.
- [ ] **RET-04**: Archived documents drop out of default retrieval but stay findable.

### Thread attachments (ATT) - SEED-247

- [ ] **ATT-01**: A chat attachment is ingested and scoped to its thread, not the Library.
- [ ] **ATT-02**: Cloud connection and Library ingestion happen only from the Documents section.
- [ ] **ATT-03**: User can explicitly promote a thread attachment into the Library.

### Public docs, API reference & video (DOCS) - added 2026-10-04 (operator)

- [ ] **DOCS-01**: Anyone can read Syrel's documentation at `/docs` on the landing domain, in the landing's own look (sketch 276 winner B), on desktop and phone.
- [ ] **DOCS-02**: Every surface in the coverage inventory (`.planning/research/docs-coverage-inventory.md`, 261 items) has a docs page, and a gate fails the build when a new page, tool, step type or endpoint has none.
- [ ] **DOCS-03**: A developer can browse a "Syrel API" reference generated from the OpenAPI document, with internal operations hidden and concept pages for auth, orgs, streaming and errors.
- [ ] **DOCS-04**: In production, the live `/docs`, `/redoc` and `/openapi.json` require sign-in; locally they stay open.
- [ ] **DOCS-05**: A visitor can read a changelog generated from `docs/history/`, where unreleased work is labelled as not yet released.
- [ ] **DOCS-06**: The docs home and guides play Syrel videos (Remotion player and clips, NotebookLM explainers), and the landing page says Syrel instead of Agentic RAG.

## Future Requirements

- SEED-194 image generation as an artifact type; data-thread branch/compare (SEED-193 ambitious half)
- SEED-211 permissions derived from metadata; SEED-224 full five-tab document space redesign
- Hardening/testing milestone; plugins/ecosystem (SEED-291..294)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIND-01 | Phase 271 | Pending |
| FIND-02 | Phase 271 | Pending |
| FIND-03 | Phase 271 | Pending |
| FIND-04 | Phase 270 | Complete |
| FIND-05 | Phase 270 | Complete |
| FIND-06 | Phase 271 | Pending |
| FIND-07 | Phase 272 | Complete (SC#4 6/8 by decision) |
| ART-01 | Phase 273 | Pending |
| ART-02 | Phase 273 | Pending |
| ART-03 | Phase 273 | Pending |
| ART-04 | Phase 273 | Pending |
| ART-05 | Phase 273 | Pending |
| RET-01 | Phase 275 | Pending |
| RET-02 | Phase 275 | Pending |
| RET-03 | Phase 275 | Pending |
| RET-04 | Phase 275 | Pending |
| ATT-01 | Phase 274 | Pending |
| ATT-02 | Phase 274 | Pending |
| ATT-03 | Phase 274 | Pending |
| DOCS-01 | Phase 276 | Pending |
| DOCS-02 | Phase 276 | Pending |
| DOCS-03 | Phase 276 | Pending |
| DOCS-04 | Phase 276 | Pending |
| DOCS-05 | Phase 276 | Pending |
| DOCS-06 | Phase 276 | Pending |

**Coverage:** 25 v1 requirements, 25 mapped, 0 unmapped, 0 duplicated (roadmap 2026-09-29; DOCS-01..06 added 2026-10-04).

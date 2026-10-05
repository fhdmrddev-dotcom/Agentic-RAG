# Syrel — Release History

> **Product:** Syrel (formerly Agentic RAG) · **Doc status:** DRAFT — generated 2026-10-04 from planning records; verify before publishing

Syrel is a chat-first AI agent that answers from your own documents with citations, runs code in a sealed sandbox, learns skills that persist, and runs validated, multi-step workflows that produce real deliverables. This folder tells the story of how it was built, one release at a time — from a folder-aware document chat in March 2026 to installable Experts and live in-chat charts in October 2026.

## How to read these files

Every release file has the same sections:

| Section | What it gives you |
|---|---|
| **In one sentence** | The release in plain language |
| **What shipped** | User-facing capabilities |
| **How it works** | The technical design, with real file paths |
| **Status today** | Whether each capability is still true, changed, or replaced — with evidence |
| **Gaps and deferred work** | What was promised and not delivered |
| **Video beats** | 3–5 scenes for a motion-graphics explainer |

⚠ **Read "Status today" before quoting a release.** Many early decisions were later reversed (for example "global" sharing became organisation sharing in v3.4, and Experts changed from narrowing to only adding capability in v4.4). A feature described in an early release may not work that way now.

## The arc in five chapters

| Chapter | Releases | What changed for the user |
|---|---|---|
| 1. A document chat that can be trusted | v1.0 – v2.4 | Folders, agent exploration, skills, sandboxed code, citations and confidence, audit log, memory, tables and images |
| 2. An agent that keeps working | v2.5 – v2.8 | Streams survive refresh, multi-worker server, nine providers, a workspace panel, and a strict workflow mode |
| 3. Workflows anyone can author | v2.9 – v3.3 | Plain-language Workflow Studio, document management, skill evals, operator Control Room |
| 4. Organisations and connections | v3.4 – v4.2 | Multi-tenant orgs, a drag-and-drop canvas, connectors to outside services, watched knowledge sources |
| 5. A product you can sell | v4.3 – v4.5 | Metered usage and tiers, installable Experts, find-by-what-it-is, live charts in chat |

## Releases

| Release | Shipped | Phases | In one sentence |
|---|---|---|---|
| [v1.0 Knowledge Base Explorer](v1.0-knowledge-base-explorer.md) | 2026-03-29 | 1–8 | A real folder system, and an agent that explores the library like a developer explores a codebase. |
| [v2.0 Agent Skills & Code Execution](v2.0-agent-skills-and-code-execution.md) | 2026-04-04 | 9–17 | Teachable skills, tool memory, and Python in a sandbox that produces downloadable files. |
| [v2.1 Stability & RAG Correctness](v2.1-stability-and-rag-correctness.md) | 2026-04-11 | 18–25 | No more blank answers, long chats stay in context, retrieval returns the right results. |
| [v2.2 Trust & Compliance](v2.2-trust-and-compliance.md) | 2026-04-16 | 26–32 | Evidence and confidence on every answer, document versions, a tamper-resistant audit log. |
| [v2.3 Memory, Multimodal & Experience](v2.3-memory-multimodal-and-experience.md) | 2026-04-19 | 33–43 | Remembers you, reads tables and images, library health, feedback, mobile-ready. |
| [v2.4 Stability, Polish & UX Fixes](v2.4-stability-polish-and-ux-fixes.md) | 2026-04-30 | 44–57 | Dependable tools on every provider, model fallback, live progress. |
| [v2.5 Deployment Strategy](v2.5-deployment-strategy.md) | 2026-05-09 | 058–067.5 | Answers keep streaming through refreshes, tab switches and second tabs. *(Name is a known misnomer — see file.)* |
| [v2.6 Foundation](v2.6-foundation-rag-quality-multi-worker-polish.md) | 2026-05-27 | 068–082 | Better extraction, multi-worker server, nine providers, settings in the database. |
| [v2.7 Agent Workspace & Panel](v2.7-agent-workspace-and-panel.md) | 2026-05-30 | 083–088 | A private workspace per chat: files, to-dos, helper agents, questions to the user. |
| [v2.8 Harness Engine & Workflow Mode](v2.8-harness-engine-and-workflow-mode.md) | 2026-06-07 | 089–096 | A strict, ordered, audited workflow mode alongside free chat. |
| [v2.9 Workflow Studio](v2.9-workflow-studio.md) | 2026-06-15 | 097–104 | Describe a workflow in plain language and get a cited Word deliverable. |
| [v3.0 Document Management](v3.0-document-management.md) | 2026-06-21 | 110–119 | Metadata, virtual folders, links, suggested classification, health. |
| [v3.1 Workflow & Skill Studio — Trust](v3.1-workflow-and-skill-studio-trust-clarity-triggers.md) | 2026-06-28 | 120–129 | Honest structured output on every provider, Skill Trigger Tuner. |
| [v3.2 Skill Eval Studio](v3.2-skill-eval-studio-and-self-improving.md) | 2026-07-10 | 132–145 | Test cases, with-vs-without comparisons, eval-gated publishing, skill-creator. |
| [v3.3 Operator UX](v3.3-operator-ux.md) | 2026-07-18 | 146–159 | Control Room, model registry, encrypted keys, install wizard. |
| [v3.4 Multi-Tenancy & Org Access](v3.4-multi-tenancy-and-org-access.md) | 2026-07-22 | 160–168 | From per-user app to organisation-aware platform. |
| [v3.5 UX Consolidation & Chat Polish](v3.5-ux-consolidation-and-chat-polish.md) | 2026-07-23 | 174–177 | Chat tells the truth about what a run is doing. |
| [v3.6 Visual / No-Code Workflow Studio](v3.6-visual-no-code-workflow-studio.md) | 2026-08-09 | 181–190 | Draw a business process on a drag-and-drop canvas. |
| [v3.7 Workflow Product Completion](v3.7-workflow-product-completion.md) | 2026-08-24 | 192–200.3 | Find, build, test-run, stop and review workflows end to end. |
| [v3.8 Document Intelligence, Automations & Connectors](v3.8-document-intelligence-automations-connectors.md) | 2026-08-26 | 201–209 | Tables and email, scheduled runs under a spend cap, first MCP connections. |
| [v3.9 Connections: Any Service, Any Tool](v3.9-connections-any-service-any-tool.md) | 2026-09-04 | 210–227 | Connect a service, see its tools, grant each one, use it by name. |
| [v4.0 Connected Knowledge](v4.0-connected-knowledge.md) | 2026-09-10 | 228–241 | Connect a source once; the Library keeps reading it on a schedule. |
| [v4.1 Ship It & Feel It](v4.1-ship-it-and-feel-it.md) | 2026-09-13 | 242–246 | Proved v4.0 in production, calmer chat, measured a search-quality cliff. |
| [v4.2 Connected Knowledge You Can Run](v4.2-the-connected-knowledge-you-can-actually-run.md) | 2026-09-18 | 247–254 | Honest sources, safe credentials, register your own model from the UI. |
| [v4.3 What You Can Actually Sell](v4.3-what-you-can-actually-sell.md) | 2026-09-23 | 255–264 | Every token priced, tiers enforced, Experts as installable bundles. |
| [v4.4 Experts That Actually Work](v4.4-experts-that-actually-work.md) | 2026-09-29 | 265–269 | Per-org Expert install, additive-only scope, per-Expert spend, five starter Experts. |
| [v4.5 Find It, Show It](v4.5-find-it-show-it.md) | *in progress* | 270–275 | Find documents by what they are, respect named periods, live charts in chat. *(Not yet deployed.)* |

## Caveats that apply to every file

- **Generated from planning records.** Where records disagreed with each other, the file says so rather than picking one.
- **"Unverified" means unverified.** A capability is only marked "Still true" when there is code evidence.
- **Not for publishing as-is.** Several files flag claims to check before any customer-facing use.
- **The logo does not exist yet.** Video beats use `[Syrel logo placeholder]`.

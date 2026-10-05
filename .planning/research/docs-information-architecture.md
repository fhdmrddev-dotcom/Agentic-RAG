# Syrel public docs: information architecture

**Derived:** 2026-10-04 from `.planning/research/docs-coverage-inventory.md`. Row IDs (A1, B1, …) refer to that file.
**Host:** the landing domain at `/docs`, as a third Vite entry (`docs.html` → `src/docs/`) beside `index.html` (landing) and `app.html` (app). Layout follows sketch 276, winner **B** (landing-native).
**Content source:** Markdown under `docs/public/<section>/<slug>.md`, built into the docs entry.
**Honesty rule (sketch 276):**
- Describe only shipped, still-true behaviour.
- Badge `v4.5` rows "Not yet released".
- Locked tabs say what exists today; they never imply a capability.

**Video column:**
- `—` none
- `clip` a 15-s Remotion clip (lazy `<Player>`)
- `explainer` a NotebookLM explainer, one per section at most

---

## 1. Get started (`get-started/`)

| Slug | Title | Audience | Purpose | Covers | Video |
|---|---|---|---|---|---|
| `get-started/overview` | What Syrel is | user | One page: knowledge base, agent, sandbox, workflows, Experts | (index) | explainer |
| `get-started/quickstart` | Your first answer in five minutes | user | Upload a file, ask, read citations | A5 | clip |
| `get-started/sign-in` | Sign in and accept an invitation | user | Account, invite link, SSO redirect | A1, A2 | — |
| `get-started/workspaces-and-orgs` | Organisations and what is shared | user | Org switcher, private vs org vs global scope | A3 | — |
| `get-started/navigating-syrel` | Finding your way around | user | The rail: Chat, Workflows, Library, Connections, Skills, Experts, Settings | (A-nav) | clip |
| `get-started/key-concepts` | Key concepts | user | Glossary: thread, run, document, view, skill, workflow, Expert, connection | (index) | — |

## 2. Use Syrel (`use/`)

| Slug | Title | Audience | Purpose | Covers | Video |
|---|---|---|---|---|---|
| `use/chat` | Chatting with Syrel | user | Composer, tool cards, run status, stopping, handoff | A5, A9 | clip |
| `use/chat-modes` | Deep mode and Workflow mode | user | When the agent improvises vs follows a workflow | A6, C25 | clip |
| `use/chat-scope` | Limiting a chat to a folder | user | Scope chip, what the agent can see | A8 | — |
| `use/attachments` | Attaching files to a chat | user | Upload and connected-file picker; v4.5 thread-scoping note | A7 | — |
| `use/choosing-a-model` | Choosing a model | user | Per-user default within the allowed set | E20 | — |
| `use/workspace-panel` | The workspace panel | user | Files, versions, diffs, todos, tasks, questions | A10, B21-B26, B28 | clip |
| `use/agent-tools` | What the agent can do (tool reference) | user | Every tool in plain words, grouped | B1-B11, B27 | — |
| `use/memory` | Memory | user | What Syrel remembers, and where you see it | A37, B19, B20 | — |
| `use/web-search` | Web search | user | When it is on, and what it costs | B13, F14 | — |
| `use/code-execution` | Running code and making files | user | Sandbox, charts, DOCX/XLSX/PDF outputs | B12, B14 | — |
| `use/artifacts` | Charts, tables and metrics in answers | user | `show_artifact` (Not yet released) | B29 | clip |
| `use/library/documents` | The Library: documents and folders | user | Folder tree, document table, sharing | A11 | clip |
| `use/library/find` | Finding a document | user | Find mode with structure filters (Not yet released) | A12 | clip |
| `use/library/views` | Saved views (virtual folders) | user | No-code filters, relative dates | A13 | — |
| `use/library/ingestion` | Adding documents | user | Upload, queue, cloud import, preview then confirm | A14, D21 | clip |
| `use/library/indexing` | How your documents are indexed | admin | Vector store, embedding model, re-embed | A15 | — |
| `use/library/health` | Knowledge health | user | Broken links, unclassified, low confidence, checked queries | A16 | — |
| `use/library/filing-rules` | Filing rules | user | Classification rules, suggested-never-moved | A17 | — |
| `use/library/document-detail` | The document panel | user | Metadata, confidence, relationships, versions, download, file facts | A18, A19, E11 | — |
| `use/library/takeoff` | CAD takeoff and rate matching | user | Quantity takeoff, BOQ matching | A20 | — |

## 3. Automate (`automate/`)

| Slug | Title | Audience | Purpose | Covers | Video |
|---|---|---|---|---|---|
| `automate/workflows/overview` | What a workflow is | user | Steps, checks, deliverables; why it differs from chat | (index) | explainer |
| `automate/workflows/library` | The Workflows page | user | Published, drafts, starters | A21, C31 | — |
| `automate/workflows/builder` | Building a workflow | user | Describe door, template door, canvas, inputs | A22, C28, C29 | clip |
| `automate/workflows/step-types` | Step types | user | The 7 steps, in their product words | C1-C7, C19 | — |
| `automate/workflows/checks` | Checks that must pass | user | The 10 validators | C8-C17 | — |
| `automate/workflows/grounding` | Grounding and citations | user | Citation policy dial; "must prove it" | C27 | — |
| `automate/workflows/deliverables` | Producing a deliverable | user | Templates and `render_template` | B30, C18 | — |
| `automate/workflows/publish` | Publishing (the gauntlet) | user | 8 stages, judge hard-wall | A23, C30 | clip |
| `automate/workflows/running` | Running a workflow | user | Run modal, from chat | C24, C25 | — |
| `automate/workflows/runs` | Watching and reviewing runs | user | Run page, phase spine, run log | A24, A25 | clip |
| `automate/workflows/schedules` | Scheduling | user | Recurring runs | C26 | — |
| `automate/skills/overview` | Skills | user | What a skill is, enabling, sharing, import/export | A27, B15, B16, E14 | explainer |
| `automate/skills/create-from-chat` | Teaching Syrel a skill from chat | user | `save_skill`, attached files | B17, B18 | — |
| `automate/skills/evals` | Evaluating a skill | operator | Test cases, matrix runs, ratings | A28 | — |
| `automate/skills/triggering` | Tuning when a skill triggers | operator | Triggering tab, Tuner | A29, A31 | — |
| `automate/skills/versions` | Versions and proposals | operator | Immutable versions, improvement proposals | A30 | — |

## 4. Connect (`connect/`)

| Slug | Title | Audience | Purpose | Covers | Video |
|---|---|---|---|---|---|
| `connect/overview` | Connections | user | Catalog, add, check, auth types | A26, D14 | clip |
| `connect/oauth-apps` | Setting up OAuth apps | operator | Google, Microsoft, GitHub client ids | D15 | — |
| `connect/google-workspace` | Google Workspace | user | 26 tools (15 read, 11 write), Drive sync | D1 | — |
| `connect/microsoft-365` | Microsoft 365 | user | OneDrive/SharePoint as a source | D2 | — |
| `connect/slack` | Slack | user | 5 tools | D3 | — |
| `connect/jira` | Jira | user | 4 tools + tickets | D4 | — |
| `connect/email-smtp` | Email (SMTP) | admin | Outbound mail | D5 | — |
| `connect/custom-mcp` | Any MCP server | user | Paste a URL, auth probe, tool discovery | D6, D16, B32 | clip |
| `connect/mcp-catalog` | Catalog MCP services | user | GitHub, Notion, Figma, Linear, Sentry, Intercom, Miro | D7-D13 | — |
| `connect/tool-grants` | Allow, ask or deny each tool | admin | Per-tool posture | D22, B31 | — |
| `connect/live-sending` | Real sending vs recorded | operator | `live_connectors` (off by default), external steps | D23, C7, C21-C23 | — |
| `connect/folder-watches` | Keeping a folder in sync | user | Watches, visibility, deletion guard, health | D17-D19, D24, D25 | — |
| `connect/mail-sources` | A mailbox as a source | user | Gmail/IMAP plus attachments | D20 | — |

## 5. Experts (`experts/`)

| Slug | Title | Audience | Purpose | Covers | Video |
|---|---|---|---|---|---|
| `experts/what-are-experts` | What an Expert is | user | Data bundle: skills, scope, tiles; adds, never restricts | (index) | explainer |
| `experts/catalog` | The Experts catalog | user | Browse, what it needs, start a chat | A32 | clip |
| `experts/using-experts` | Bringing an Expert into a chat | user | Invite dialog, active chip | A33 | — |
| `experts/authoring` | Authoring and installing Experts | admin | Studio sections, install, grants, audience | A40 | clip |

## 6. Administer (`administer/`)

| Slug | Title | Audience | Purpose | Covers | Video |
|---|---|---|---|---|---|
| `administer/org/members` | Members | admin | Roster | A39 | — |
| `administer/org/invitations` | Invitations and roles | admin | Invite, resend, revoke; email provider | A43, I13 | — |
| `administer/org/sso` | Single sign-on | admin | SSO providers, operator approval | A44 | — |
| `administer/org/audit` | Org audit | admin | What is recorded | A41 | — |
| `administer/org/settings` | Org settings | admin | Org-level knobs | A42, E21 | — |
| `administer/org/plans-and-tiers` | Plans and tiers | admin | Tier capabilities; Subscription tab is "coming soon" | A45, E22 | — |
| `administer/org/retention` | Retention | admin | Locked today; planned (Phase 275) | A46, E23 | — |
| `administer/settings/ai-model` | AI model settings | operator | Providers, default model, limits, model roles | A34, E1-E4 | — |
| `administer/settings/search` | Search settings | operator | Embeddings, extraction, reranking, retrieval, vision | A35, E6-E10, F12, F13 | — |
| `administer/settings/integrations` | Integration settings | operator | Web search, code execution, file limits | A36, E12, E13, E15 | — |
| `administer/models/providers` | Model providers | operator | 8 providers, pinning, OpenRouter strategy | F1-F8, E5, I14 | — |
| `administer/control-room/control-plane` | Control Plane | operator | Health, active runs, Kill, backpressure | A47 | clip |
| `administer/control-room/users-and-access` | Users and access | operator | Disable/enable, operator grants | A48 | — |
| `administer/control-room/feature-visibility` | Who sees which feature | operator | 6 governed features and their audiences | E18 | — |
| `administer/control-room/kill-switches` | Kill switches and maintenance | operator | 6 flags, maintenance banner | A4, E16, E19 | — |
| `administer/control-room/model-registry` | Model Registry | operator | Capabilities as data, discovery, lock | A49, F15 | — |
| `administer/control-room/audit` | Platform audit | operator | Browse, CSV export | A51 | — |
| `administer/control-room/spend` | Spend | operator | By Expert, rates, run ledger | A52 | — |

## 7. Deploy & operate (`deploy/`)

| Slug | Title | Audience | Purpose | Covers | Video |
|---|---|---|---|---|---|
| `deploy/choose-a-home` | Where Syrel can run | operator | Homes A-D | I1 | explainer |
| `deploy/one-box` | One-box install | operator | The canonical path | I2 | — |
| `deploy/environment-variables` | Environment variables | operator | All 59 onebox vars; `FRONTEND_URL` list | I3, I8 | — |
| `deploy/database` | Database and migrations | operator | Bootstrap, pooler DSN | I4, I7 | — |
| `deploy/redis` | Redis | operator | TLS, never exposed | I6 | — |
| `deploy/setup-wizard` | The setup wizard | operator | 6 steps, setup token, finalize | A53, A54, I5, H38 | clip |
| `deploy/background-processes` | Workers, scheduler, ingest, watches | operator | Process flags | I9 | — |
| `deploy/sandbox` | The code sandbox image | operator | Build, tag, packages | I10 | — |
| `deploy/local-models` | Local and self-hosted models | operator | Ollama, LM Studio, custom | F9-F11, I16 | — |
| `deploy/domains` | Domains and routing | operator | `app.<domain>` | I15 | — |
| `deploy/observability` | Observability | operator | LangSmith, `/health` | F16, I17 | — |
| `deploy/verify` | Verification checklist | operator | Post-install checks + security advisors | I18 | — |
| `deploy/upgrading` | Upgrading | operator | Migrations between versions | I19 | — |

## 8. Extend Syrel (`extend/`)

| Slug | Title | Audience | Purpose | Covers | Video |
|---|---|---|---|---|---|
| `extend/extension-contract` | The extension contract | developer | Data, external process, sandbox; the 3 refusals | G7-G10, C20 | explainer |
| `extend/skill-packages` | Skill packages | developer | SKILL.md format, import/export | G1 | — |
| `extend/workflows-as-data` | Workflows as data | developer | Definition JSON, validate, publish | G2 | — |
| `extend/templates-and-schemas` | Templates and schemas | developer | DOCX templates, metadata fields | G3 | — |
| `extend/expert-bundles` | Expert bundles | developer | What an Expert carries | G4 | — |
| `extend/mcp-servers` | Bring an MCP server | developer | Build or host one Syrel can call | G5 | — |
| `extend/sandbox-compute` | Sandbox compute | developer | Transforms in Docker | G6 | — |

## 9. API reference (`api/`)

| Slug | Title | Audience | Purpose | Covers | Video |
|---|---|---|---|---|---|
| `api/overview` | The Syrel API | developer | Everything the app does goes through it; status of third-party access | (index) | explainer |
| `api/concepts/authentication` | Authentication | developer | Supabase JWT + `X-Org-Id`; **no API keys today** | H41 | — |
| `api/concepts/orgs-and-rls` | Organisations and row-level security | developer | What a token can see | H42 | — |
| `api/concepts/streaming` | Streaming (SSE) and reconnecting | developer | `POST /messages` stream, `GET /runs/{id}/stream?since=` | H43, E17 | — |
| `api/concepts/errors` | Errors | developer | 401 vs 503, 403 tier/feature, 404-not-403, 409, 422, `If-Match` | H44, H48 | — |
| `api/concepts/limits-and-spend` | Limits and spend | developer | No HTTP rate limit; run token caps; tiers | H45 | — |
| `api/concepts/pagination` | Pagination | developer | `limit`/`offset`/`page_size` per endpoint | H46 | — |
| `api/concepts/webhooks` | Webhooks | developer | None inbound today; OAuth callbacks only | H47 | — |
| `api/concepts/feature-gates` | Feature gates | developer | 403 hidden feature vs 404 canvas/operator | H49 | — |
| `api/guides/chat-from-a-script` | Chat from a script | developer | Create thread, send, stream, reconnect | H1, H2 | — |
| `api/guides/upload-and-search` | Upload and search documents | developer | Upload, ingest status, search | H6, H8 | — |
| `api/guides/navigate-the-knowledge-base` | Navigate the knowledge base | developer | `/kb` ls/tree/grep/glob/read | H15 | — |
| `api/guides/run-a-workflow` | Run a workflow | developer | `workflow_definition_id` on send, read the run | H26-H28 | — |
| `api/reference/<tag>` | Generated reference, one page per tag | developer | Every public operation | H1-H14, H18-H24, H26-H36, H39 | — |
| `api/reference/operator` | Operator API | operator | `/admin` (404 when not an operator) | H37 | — |
| `api/internal-endpoints` | Internal and legacy endpoints | developer | What exists but is not a contract | H16, H17, H25, H40 + hidden set | — |
| `api/roadmap-open-platform` | Coming: API keys, webhooks, MCP server | developer | SEED-013 (planted) | (h.2) | — |

## 10. Security & trust (`security/`)

| Slug | Title | Audience | Purpose | Covers | Video |
|---|---|---|---|---|---|
| `security/data-isolation` | How your data is isolated | user/admin | RLS, orgs, shared scope | (H42) | explainer |
| `security/secrets` | Secrets and keys | operator | Encryption at rest; Secrets tab is "coming soon" | A50, I12 | — |
| `security/egress-controls` | What Syrel can reach | admin | Egress validation, grants, live sending off by default | D26 | — |
| `security/sandbox-isolation` | Sandbox isolation | operator | Docker socket, single-tenant only | I11 | — |
| `security/audit-trails` | Audit trails | user/admin | Your log, org log, platform log | A38 | — |
| `security/prompt-injection` | Prompt-injection defences | admin | TRUST-03 trifecta for synced content | (concept) | — |

## 11. Changelog (`changelog/`)

| Slug | Title | Audience | Purpose | Covers | Video |
|---|---|---|---|---|---|
| `changelog/index` | What's new | all | One row per milestone, "shipped, not promised" | — | — |
| `changelog/<version>` | v1.0 … v4.5 | all | Generated from `docs/history/*.md` (25 files today); v4.5 = "not yet released" | — | — |

**Page count: 6 + 20 + 16 + 13 + 4 + 18 + 13 + 7 + 17 (+ generated tag pages) + 6 + 2 (+ 25 versions) = 122 hand-written pages**, plus about 33 generated API tag pages and about 25 changelog entries.

---

## API reference plan

| Decision | Recommendation |
|---|---|
| Source | `docs/public/api/openapi.snapshot.json`, regenerated from the code with no server (the import command is in the inventory). Add a CI drift check, in the same spirit as `check-deploy-drift.sh`, so the snapshot cannot go stale silently. |
| Build-time filter | A Node script writes `openapi.public.json` from the snapshot. It (1) sets `info.title` = "Syrel API" and a version from the milestone, without touching code; (2) adds `servers`; (3) drops the hidden set below; (4) moves `/admin/*` into a separate `openapi.operator.json`; (5) adds `x-tagGroups` matching the docs sections; (6) adds `x-badges: Not yet released` to v4.5 ops; (7) adds a `X-Org-Id` header parameter component. |
| Renderer | **Scalar** (`@scalar/api-reference-react`, MIT) mounted inside the docs Vite entry at `/docs/api`. It reads the **static, pre-filtered** JSON at build time and never calls a live backend. Its dark theme can take the Deep Midnight tokens. **Fallback:** Redoc (`@redocly/cli build-docs`, MIT) to a static HTML page if Scalar's bundle weight is a problem. Keep FastAPI's `/docs` on each deployment as the live, per-box explorer. |
| Grouping | By router tag, under these `x-tagGroups`: **Chat & runs** (threads, runs, panel, workspace, sandbox-outputs) · **Documents** (documents, takeoff, document-search, document-views, document-relationships, document-governance, metadata-fields, classification-rules, folders, kb, checked-queries) · **Automation** (workflows, schedules, workflow-runs, skills, skill-evals, skill-test-cases, skill-tuner) · **Connect** (connectors, sources) · **Experts** (experts) · **Account & org** (org, preferences, features, model-registry, settings, audit, feedback) · **System** (`/health`, `/models`). |
| Hidden (removed from the public doc) | `/setup/*` and `/public-config` (Deploy docs only); OAuth callbacks (2); `/admin/control-plane/record`, `/admin/backpressure`; `/evals/*`; `/api/sources/*` alias (9); `/__test__/*` (never mounted in prod). |
| Flagged (kept, marked "UI-internal: may change") | `/workflows/grounding-bundle`, `/workflows/validate`, `/threads/{id}/snapshot`, `/threads/expert-scope-preview`, `/library/index-summary`, `/knowledge-health/*` (legacy). |
| Gated (kept, with an audience badge) | `skill-evals`/`skill-test-cases`/`skill-tuner` (operators by default), `settings` writes (`model_management`), connectors writes (org admin; live sending flag), canvas routes (404 when off). |
| Concepts pages (hand-written) | auth · orgs & RLS · streaming & reconnect · errors · limits & spend · pagination · webhooks (none) · feature gates. |
| Must say plainly | No API keys, PATs or service accounts exist; a script authenticates as a signed-in user. The planned answer is SEED-013. |

---

## Coverage table

| Inventory section | Items | Covered by a page | Gaps |
|---|---|---|---|
| a. App pages & tabs | 54 | 54 | 0 |
| b. Agent tools | 32 | 32 | 0 |
| c. Workflow engine | 31 | 31 | 0 (C20 named as internal on `extend/extension-contract`) |
| d. Connectors | 26 | 26 | 0 |
| e. Settings & knobs | 23 | 23 | 0 (E17 is a footnote, not a knob) |
| f. Model providers | 16 | 16 | 0 |
| g. Extension | 10 | 10 | 0 |
| h. HTTP API (40 groups + 9 concepts) | 49 | 49 | 0 (H40 is listed as "never published" on `api/internal-endpoints`) |
| i. Deploy & ops | 20 | 19 | **1 by decision:** I20 (hosted Vercel + Coolify pipeline) is an internal runbook, not public docs |
| **Total** | **261** | **260 (99.6%), 100% of public-facing items** | I20 excluded on purpose |

**Open decisions for the docs phase (not coverage gaps):**
1. `/knowledge-health/*`: document as legacy, or retire the endpoints.
2. Whether `api/reference/operator` is public, or shipped only inside the operator's own deployment.
3. The renderer choice (Scalar recommended, Redoc fallback).
4. Clip count (18 `clip` cells + 8 `explainer` cells) vs sketch 276's video budget.

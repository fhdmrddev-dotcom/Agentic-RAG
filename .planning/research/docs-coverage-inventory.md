# Syrel public docs: coverage inventory

**Derived:** 2026-10-04, `develop` @ `c8d4e3378` (prod = `origin/production` @ `82babd8d0`, v4.4).
**Purpose:** every user-, admin-, operator- and developer-facing surface, so the docs phase can be planned against a closed list. The product is **Syrel**; the code still says *Agentic RAG*, and code identifiers below are quoted as they are.
**Rule:** each section names the file (and command) its list came from. **Re-derive the list from there; do not edit counts by hand.**

### Status legend

| Status | Meaning |
|---|---|
| `shipped` | Live in production v4.4 (present on `origin/production`) |
| `v4.5` | Built on `develop` in v4.5 (Phases 270-273) and **not released**. The docs must say "not yet released". |
| `flag-off` | Shipped, but off by default behind a feature or flag |
| `gated` | Shipped, but visible only to an audience (operators, or org admins) |
| `locked` | Shipped as a visible "coming soon" lock, with no capability behind it |
| `not built → SEED-NNN` | Absent; the seed holds the planned answer |

**Audience:** `user` (any member) · `admin` (org admin, holding `org:manage`/`org:invite`/`sso`) · `operator` (platform operator: the `OPERATOR_EMAILS` allowlist plus grants) · `developer` (API, extension and self-host builders).

**Proposed doc page** = a slug under `docs/public/` (the tree is in `docs-information-architecture.md`).

---

## a. App pages & tabs

**Sources:**
- `frontend/src/lib/nav-items.ts`: `NAV_ITEMS` (7 rail entries)
- `frontend/src/App.tsx:129`: `ActiveView` union (12 members)
- `frontend/src/components/layout/ChatLayout.tsx:828-1045`: view branches
- `frontend/src/lib/activeViewReachability.ts`: the view-to-branch fence
- Tabs: `LibraryPage.tsx:127` `TAB_LABELS` · `SettingsPage.tsx:1152-1167` `TabsTrigger` · `ControlRoomPage.tsx:121` `TABS` · `components/org/OrgAdminShell.tsx:86` `TABS` · `SkillStudioPage.tsx:50` · `WorkflowsPage.tsx:267` `PageView`
- Setup steps: `pages/SetupWizard.tsx:240-300` `renderStep`
- Pre-auth paths: `App.tsx:155,310,327` (`/admin/spend`, `/setup`, `/invite`). There is **no URL router**; these are literal pathname checks.

Nav rail on `develop` (7): Chat · Workflows (`workflow_authoring`) · Library · Connections · Skills · Experts · Settings (`model_management`). Prod has an 8th entry, `classification-rules`, which v4.5 Phase 271 removes and replaces with Library → Filing rules.

| ID | Surface | Where (component) | Status | Audience | Proposed doc page |
|---|---|---|---|---|---|
| A1 | Sign in / sign up | `pages/AuthPage.tsx` | shipped | user | `get-started/sign-in` |
| A2 | Accept an org invitation (`/invite`) | `pages/AcceptInvitePage.tsx` | shipped | user | `get-started/sign-in` |
| A3 | Org switcher (member of 2+ orgs) | OrgProvider / layout | shipped | user | `get-started/workspaces-and-orgs` |
| A4 | Maintenance banner | `App.tsx` reads public `/health` | shipped | user | `administer/control-room/kill-switches` |
| A5 | Chat: thread list, composer, model picker, tool cards, run status strip, thinking block | view `chat` | shipped | user | `use/chat` |
| A6 | Chat modes: Deep (agent) vs Workflow (harness) pill | `models/thread.py:433` `mode: deep\|harness` | shipped | user | `use/chat-modes` |
| A7 | Chat attachments: upload plus connected-file picker | `ChatAttachmentChip`, `ConnectedFilePickerModal` | shipped (thread-scoped attachments + Save to Library shipped in v4.5 Phase 274) | user | `use/attachments` |
| A8 | Chat scope: folder scope chip, scope-effect note | `ChatArea.tsx`, `/threads/{id}/scope-effect` | shipped | user | `use/chat-scope` |
| A9 | Thread handoff (summarise into a new thread) | `POST /threads/{id}/handoff` | shipped | user | `use/chat` |
| A10 | Workspace panel: Files, Todos, Tasks/phase timeline, ask-user card, diffs, template upload | `components/panel/*` | shipped | user | `use/workspace-panel` |
| A11 | Library → Documents tab (folders tree, table) | `LibraryPage` `documents` | shipped | user | `use/library/documents` |
| A12 | Library → Documents → **Find** mode (document search) | `findState.ts`, `/document-search` | v4.5 (271) | user | `use/library/find` |
| A13 | Library → Views tab (saved virtual folders) | `views` | shipped | user | `use/library/views` |
| A14 | Library → Ingestion tab (upload, queue, cloud import) | `IngestionTab`, `LibraryCloudImport` | shipped | user | `use/library/ingestion` |
| A15 | Library → Indexing tab (vector store, embedding model, folder cards) | `indexing`, `/library/index-summary` | shipped (requires `model_management`) | admin | `use/library/indexing` |
| A16 | Library → Health tab (governance signals, checked queries) | `health`, `/document-governance`, `/checked-queries` | shipped (`governance_health`) | user | `use/library/health` |
| A17 | Library → Filing rules sub-view (was the Classification page) | `ClassificationRulesPage`, `RuleBuilderPanel` | v4.5 (271); prod = `classification-rules` nav view | user | `use/library/filing-rules` |
| A18 | Document detail panel: metadata, confidence chips, relationships, versions, "questions that found it" | `metadata/DocumentDetailPanel.tsx` | shipped | user | `use/library/document-detail` |
| A19 | Document detail: download original plus file facts | `POST /documents/{id}/download-url` | v4.5 (270) | user | `use/library/document-detail` |
| A20 | CAD takeoff / BOQ rate matching | `api/takeoff.py` | shipped | user | `use/library/takeoff` |
| A21 | Workflows → Library (published, drafts, starters, run, schedule) | `WorkflowsPage` `library`, `RunModal`, `WorkflowScheduleModal` | shipped | user | `automate/workflows/library` |
| A22 | Workflows → Builder (describe door, template door, canvas, step forms) | `WorkflowBuilderPage`, `WorkflowCanvas` | shipped (`workflow_authoring`, `visual_workflow_canvas` = everyone) | user | `automate/workflows/builder` |
| A23 | Workflows → Publish gauntlet (8 stages, judge hard-wall) | `PublishGauntlet.tsx` | shipped | user | `automate/workflows/publish` |
| A24 | Workflows → Run log | `PageView "run-log"` | shipped | user | `automate/workflows/runs` |
| A25 | Workflow run page (phase spine, citations, verdicts) | view `workflow-run` (canvas-gated) | shipped | user | `automate/workflows/runs` |
| A26 | Connections page (catalog, add, check, grants, browse) | `ConnectionsPage` → `settings/ConnectionsTab` | shipped | user (writes: admin) | `connect/overview` |
| A27 | Skills page (list, create, import/export, files, enable, share) | `SkillsPage.tsx` | shipped | user | `automate/skills/overview` |
| A28 | Skill Studio → Evals tab | `SkillStudioPage` `evals` | gated (`skill_studio` = operators) | operator | `automate/skills/evals` |
| A29 | Skill Studio → Triggering tab | `triggering` | gated | operator | `automate/skills/triggering` |
| A30 | Skill Studio → Versions tab (immutable versions, proposals) | `versions` | gated | operator | `automate/skills/versions` |
| A31 | Skill Trigger Tuner page | `SkillTunerPage.tsx` | gated | operator | `automate/skills/triggering` |
| A32 | Experts catalog, detail modal, start an Expert chat | `experts/catalog/*` | shipped | user | `experts/catalog` |
| A33 | Invite an Expert into a chat | `chat/InviteExpertDialog.tsx`, `ActiveExpertChip` | shipped | user | `experts/using-experts` |
| A34 | Settings → AI Model (providers, active model, context and sub-agent, tuner model) | `SettingsPage` tab 0 | gated (`model_management` = operators) | operator | `administer/settings/ai-model` |
| A35 | Settings → Search (embeddings and extraction, reranking, images/scans, retrieval) | tab 1 (`settings.tab.retrieval` = "Search") | gated | operator | `administer/settings/search` |
| A36 | Settings → Integrations (web search, code execution, source file ceiling) | tab 2 | gated | operator | `administer/settings/integrations` |
| A37 | Settings → Memory (read-only memory list) | tab 3 | shipped | user | `use/memory` |
| A38 | Settings → Audit Log (own activity) | tab 4 | shipped | user | `security/audit-trails` |
| A39 | Org admin → Members | `OrgAdminShell` `members` | gated (org admin) | admin | `administer/org/members` |
| A40 | Org admin → Experts (authoring studio: identity, knowledge scope, bound capabilities, action tiles, access grants) | `ExpertAuthoringStudio.tsx` | gated | admin | `experts/authoring` |
| A41 | Org admin → Audit | `audit` | gated | admin | `administer/org/audit` |
| A42 | Org admin → Settings | `settings` | gated | admin | `administer/org/settings` |
| A43 | Org admin → Invitations & Roles | `invitations` | gated | admin | `administer/org/invitations` |
| A44 | Org admin → SSO | `sso` | gated | admin | `administer/org/sso` |
| A45 | Org admin → Subscription | `subscription` | locked; not built (no billing seed; tiers exist in `tier_capabilities`) | admin | `administer/org/plans-and-tiers` |
| A46 | Org admin → Retention | `retention` | locked; v4.5 Phase 275 (not built) → SEED-250, SEED-345 | admin | `administer/org/retention` |
| A47 | Control Room → Control Plane (dependency health, active runs plus Kill, kill switches, maintenance, backpressure) | `ControlRoomPage` `control-plane` | gated (operator) | operator | `administer/control-room/control-plane` |
| A48 | Control Room → Users & Access (roster, disable/enable, operator grant, feature-visibility map) | `users-access` | gated | operator | `administer/control-room/users-and-access` |
| A49 | Control Room → Model Registry (capabilities, discovery, add by id, lock) | `model-registry` | gated | operator | `administer/control-room/model-registry` |
| A50 | Control Room → Secrets | `secrets` | locked (encrypt-at-rest ships via `SECRETS_ENCRYPTION_KEY`; no UI) | operator | `security/secrets` |
| A51 | Control Room → Audit log (platform audit, CSV export) | `audit` | gated | operator | `administer/control-room/audit` |
| A52 | Spend page (`/admin/spend`): spend by Expert, rates, run ledger | `pages/admin/AdminSpendPage.tsx` | gated | operator | `administer/control-room/spend` |
| A53 | Setup wizard (`/setup`), 6 steps: Environment detect, Preset, Connection bind, Operator bootstrap, Provider key, Smoke checklist | `pages/SetupWizard.tsx`, `components/setup/*` | shipped | operator | `deploy/setup-wizard` |
| A54 | Finalized lockout (`/setup` after finalize) | `FinalizedLockout.tsx` | shipped | operator | `deploy/setup-wizard` |

**Count: 54 surfaces** (7 nav entries, 12 views, 5 Library tabs + 1 sub-view + Find, 5 Settings tabs, 5 Control Room tabs, 8 Org admin tabs, 3 Skill Studio tabs + Tuner, 3 Workflows page views + run page, 6 setup steps rolled into A53).

---

## b. Agent tools

**Sources:** `backend/app/services/tool_dispatcher.py:4542` `_TOOL_REGISTRY` (30 keys). Chat schemas and descriptions come from `backend/app/services/openai_service.py:1310` `get_tools()`, which returns **29**: `render_template` is workflow-only. Gating is in `get_tools`: `web_search` ← `web_search_enabled`, `execute_code` ← `sandbox_enabled`, `save_skill` ← `self_improve_enabled`.
**Re-derive:** `python -c "from app.services.tool_dispatcher import _TOOL_REGISTRY; print(list(_TOOL_REGISTRY))"`.

| ID | Tool | Plain description | Status | Audience | Doc page |
|---|---|---|---|---|---|
| B1 | `search_documents` | Semantic + keyword search over your documents; returns cited chunks; honours date and dimension filters (v4.5 272) | shipped | user | `use/agent-tools#knowledge` |
| B2 | `query_documents` | Read-only SQL over your documents/folders tables for structured questions | shipped | user | same |
| B3 | `query_documents_by_view` | Lists every document matching a saved view or exact metadata (no ranking) | shipped | user | same |
| B4 | `get_related_documents` | Typed, human-curated document links in both directions | shipped | user | same |
| B5 | `ls` | List a folder's contents | shipped | user | `use/agent-tools#navigate` |
| B6 | `tree` | Show the folder hierarchy | shipped | user | same |
| B7 | `grep` | Regex search across document text | shipped | user | same |
| B8 | `glob` | Find documents by filename pattern | shipped | user | same |
| B9 | `read_document` | Read a document's text (line ranges) | shipped | user | same |
| B10 | `analyze_document` | Whole-document analysis (summarise, compare, critique) | shipped | user | same |
| B11 | `query_tables` | Query tables extracted from a document | shipped | user | same |
| B12 | `fetch_document_file` | Copy a document's original file into the sandbox | shipped | user | `use/code-execution` |
| B13 | `web_search` | Live web search (Tavily) | flag (`web_search_enabled`, needs key) | user | `use/web-search` |
| B14 | `execute_code` | Run Python in a Docker sandbox and return files/charts | flag (`SANDBOX_ENABLED`) | user | `use/code-execution` |
| B15 | `load_skill` | Load a skill's instructions and file list | shipped | user | `automate/skills/overview` |
| B16 | `read_skill_file` | Read a file attached to a skill | shipped | user | same |
| B17 | `save_skill` | Create/update a skill from chat (self-improvement) | flag (`self_improve_enabled`, default on) | user | `automate/skills/create-from-chat` |
| B18 | `attach_skill_file` | Save a helper file onto a skill you own | shipped | user | same |
| B19 | `remember` | Store a fact/preference across conversations | shipped | user | `use/memory` |
| B20 | `recall` | Read stored memory | shipped | user | `use/memory` |
| B21 | `workspace_write` | Write a file to the thread workspace | shipped | user | `use/workspace-panel` |
| B22 | `workspace_read` | Read a workspace file | shipped | user | same |
| B23 | `workspace_list` | List workspace files | shipped | user | same |
| B24 | `workspace_delete` | Delete a workspace file (and its history) | shipped | user | same |
| B25 | `workspace_diff` | Diff two versions of a workspace file | shipped | user | same |
| B26 | `write_todos` | Publish a task list to the panel | shipped | user | same |
| B27 | `task` | Spawn a bounded sub-agent | shipped | user | `use/agent-tools#delegation` |
| B28 | `ask_user` | Pause and ask you a question | shipped | user | `use/workspace-panel` |
| B29 | `show_artifact` | Render a chart, table or metric under the answer | v4.5 (273, in progress) | user | `use/artifacts` |
| B30 | `render_template` | Fill a DOCX template into a deliverable (workflow steps only) | shipped | user | `automate/workflows/deliverables` |
| B31 | Connector service tools (Google 26, Slack 5, Jira 4) | First-party tools exposed when a connection is granted. `services/connectors/service_tools.py:86` `SERVICE_TOOL_SPECS` | shipped | user | `connect/tool-grants` |
| B32 | MCP server tools (dynamic) | Tools discovered on a connected MCP server, with per-tool allow/ask/deny | shipped | user | `connect/custom-mcp` |

**Count: 32** (30 registry + 2 dynamic families).

---

## c. Workflow step types, validators, emitters, programmatic functions

**Sources:**
- `backend/app/services/harness/phase_types.py:2928` `PHASE_TYPE_REGISTRY_ENTRIES` (7)
- `harness/validators.py:62` `VALIDATOR_REGISTRY` (10); `PROGRAMMATIC_VALIDATOR_REGISTRY` is empty at import (populated via `validators.py:101`)
- `harness/emitters.py:61` `EMITTER_REGISTRY` (1)
- `harness/programmatic.py:36` `PROGRAMMATIC_PHASE_REGISTRY` (2)
- User-facing labels: `frontend/src/components/workflows/phaseVocabulary.ts:212-261`
- `models/harness.py:355` external-action capabilities
- Schedules: `api/schedules.py`
- Run start: `models/message.py:61` `workflow_definition_id` on `POST /threads/{id}/messages`. There is **no** `/workflows/{id}/run` route.

The core is **closed** (`docs/EXTENSION-CONTRACT.md` Refusal 1), so these lists are complete by design.

| ID | Item | User label (phaseVocabulary) | Kind | Status | Audience | Doc page |
|---|---|---|---|---|---|---|
| C1 | `programmatic` | "Prepare the inputs": a fixed server step | step type | shipped | user | `automate/workflows/step-types` |
| C2 | `llm_single` | "Write it up": one pass | step type | shipped | user | same |
| C3 | `llm_agent` | "Work out how to do it": tool-using agent | step type | shipped | user | same |
| C4 | `llm_batch_agents` | "Work on the parts together": parallel agents (`concat` / `concat_numbered`) | step type | shipped | user | same |
| C5 | `llm_human_input` | "Check with you": pauses for your answer | step type | shipped | user | same |
| C6 | `llm_emit` | "Produce the deliverable": fills a template | step type | shipped | user | same |
| C7 | `external_action` | "Reach outside": approval before acting externally | step type | shipped (real sending `flag-off`: `live_connectors`) | user | same + `connect/live-sending` |
| C8 | `json_schema` | Output must match a JSON schema | validator | shipped | user | `automate/workflows/checks` |
| C9 | `regex_match` | Output must match a pattern | validator | shipped | user | same |
| C10 | `workspace_file_exists` | A named file must exist | validator | shipped | user | same |
| C11 | `programmatic` | Server-side programmatic check | validator | shipped | user | same |
| C12 | `citations_required` | Claims must carry citations | validator | shipped | user | same |
| C13 | `output_file_valid` | Produced DOCX/PPTX/XLSX opens and is valid | validator | shipped | user | same |
| C14 | `structure_check` | Required sections/structure present | validator | shipped | user | same |
| C15 | `llm_judge_rubric` | LLM judge scores against a rubric | validator | shipped | user | same |
| C16 | `freshness` | Sources must be recent enough | validator | shipped | user | same |
| C17 | `action_risk_approval` | Human approval checkpoint for risky actions (armed by default) | validator | shipped | user | same |
| C18 | `render_template` | DOCX template fill (docxtpl) | emitter | shipped | user | `automate/workflows/deliverables` |
| C19 | `split_topic` | Splits a topic into parts for batch steps | programmatic fn | shipped | user | `automate/workflows/step-types` |
| C20 | `eval_slow_step` | Internal eval fixture | programmatic fn | shipped (internal) | developer | `extend/extension-contract` (named as internal) |
| C21 | `send_email` | Email via SMTP connection | external capability | shipped (sends only when `live_connectors` on) | user | `connect/live-sending` |
| C22 | `create_ticket` | Jira ticket | external capability | same | user | same |
| C23 | `post_message` | Slack message | external capability | same | user | same |
| C24 | Run from Workflows library / Run modal | trigger | shipped | user | `automate/workflows/running` |
| C25 | Run from chat (Workflow mode pill) | trigger | shipped | user | same |
| C26 | Scheduled run (`/workflows/{id}/schedules`, scheduler process) | trigger | shipped (needs `SCHEDULER_PROCESS_ENABLED`) | user | `automate/workflows/schedules` |
| C27 | Grounding dial / citation policy (`strict\|flag\|partial\|draft`) | concept | shipped | user | `automate/workflows/grounding` |
| C28 | Declared inputs (`text\|number\|date\|enum\|file\|kb_auto`) | concept | shipped | user | `automate/workflows/builder` |
| C29 | AI describe door + template door (`POST /workflows/generate`) | concept | shipped | user | `automate/workflows/builder` |
| C30 | Publish gauntlet (8 stages incl. judge) | concept | shipped | user | `automate/workflows/publish` |
| C31 | Starter workflows (`GET /workflows/starters`) | concept | shipped | user | `automate/workflows/library` |

**Count: 31** (7 step types, 10 validators, 1 emitter, 2 programmatic functions, 3 capabilities, 3 triggers, 5 concepts).

---

## d. Connectors / services catalog

**Sources:**
- `frontend/src/components/settings/servicesCatalog.ts`: `POPULAR_SERVICES` (13 entries; `shape`: `mcp` / `oauth` / none = service-only)
- `backend/app/models/connector.py:362` `AuthType = static_key | oauth_byo | mcp`; `:434` grant posture; `:441` ingest visibility
- `backend/app/services/connectors/service_tools.py:86` `SERVICE_TOOL_SPECS`
- `backend/app/services/google/*.py` (26 Google functions)
- `backend/app/services/sources/adapters/` (google_drive, microsoft_graph, mcp_source, mock_source) + `sources/mail/` (gmail, mailbox)
- `backend/app/services/mcp_client.py`; egress guard `app/security/egress.py`

| ID | Item | Shape / mechanism | Status | Audience | Doc page |
|---|---|---|---|---|---|
| D1 | Google Workspace (Drive, Docs, Sheets, Gmail, Calendar, Contacts: 26 tools, 15 read + 11 write) | `oauth` (google) | shipped | user | `connect/google-workspace` |
| D2 | Microsoft 365 (OneDrive, SharePoint, Graph) | `oauth` (microsoft) as a source adapter; no chat service tools | shipped (source sync) | user | `connect/microsoft-365` |
| D3 | Slack (5 tools: list channels/users, read, search, post) | service-only (`static_key`) | shipped | user | `connect/slack` |
| D4 | Jira (4 tools: search, get, list projects, comment; create_ticket) | service-only | shipped | user | `connect/jira` |
| D5 | Email (SMTP) (`send_email`, starttls/implicit) | service-only | shipped | user | `connect/email-smtp` |
| D6 | Custom MCP Server (paste a URL, discover tools, OAuth or token) | `mcp` | shipped | user | `connect/custom-mcp` |
| D7 | GitHub | `mcp` (oauthProvider github) | shipped (catalog entry) | user | `connect/mcp-catalog` |
| D8 | Notion | `mcp` | shipped (catalog entry) | user | same |
| D9 | Figma | `mcp` | shipped (catalog entry) | user | same |
| D10 | Linear | `mcp` | shipped (catalog entry) | user | same |
| D11 | Sentry | `mcp` | shipped (catalog entry) | user | same |
| D12 | Intercom | `mcp` | shipped (catalog entry) | user | same |
| D13 | Miro | `mcp` | shipped (catalog entry) | user | same |
| D14 | Auth: static key | `static_key` | shipped | admin | `connect/overview#auth` |
| D15 | Auth: OAuth (bring-your-own client: Google, Microsoft, GitHub) | `oauth_byo`; env `*_OAUTH_CLIENT_ID/SECRET` | shipped | admin/operator | `connect/oauth-apps` |
| D16 | Auth: MCP (probe-auth, MCP OAuth with its own authorization server) | `mcp` | shipped | admin | `connect/custom-mcp` |
| D17 | Source sync: Google Drive folder watch | `adapters/google_drive.py` + `connector_watches` | shipped | user | `connect/folder-watches` |
| D18 | Source sync: Microsoft Graph folder watch | `adapters/microsoft_graph.py` | shipped | user | same |
| D19 | Source sync: MCP source | `adapters/mcp_source.py` | shipped | user | same |
| D20 | Mail as a source (Gmail, IMAP mailbox; attachments ingested) | `sources/mail/` | shipped | user | `connect/mail-sources` |
| D21 | Preview-then-confirm import, single-file cloud import | `/connectors/connections/{id}/preview[/confirm]`, `/files/{fid}/import` | shipped | user | `use/library/ingestion` |
| D22 | Per-tool grants: allow / ask / deny | `ToolGrantPosture`, `PATCH .../grants` | shipped | admin | `connect/tool-grants` |
| D23 | Live outbound sending switch | feature `live_connectors` = **off** | flag-off | operator | `connect/live-sending` |
| D24 | Ingest visibility: private / org / dept | `IngestVisibility` | shipped | admin | `connect/folder-watches` |
| D25 | Source health and failure causes | `/sources/health`, `sources/failure_cause.py` | shipped | user | `connect/folder-watches#health` |
| D26 | Egress safety (MCP destination validation, SSRF guard) | `security/egress.py` `validate_mcp_destination` | shipped | developer | `security/egress-controls` |

**Count: 26.** The broad catalog, inbound webhooks and a connector directory are deferred to Open Platform (`docs/CONNECTOR-ARCHITECTURE.md` §verdict; SEED-013 / SEED-014 `planted`).

---

## e. Settings & admin knobs

**Sources:**
- `backend/app/models/user_settings.py:185` `UserEffectiveSettings`: **65 fields**. Re-derive with `UserEffectiveSettings.model_fields`.
- `user_settings.py:1579` `_GOVERNED_FEATURES` (6 feature-visibility keys)
- `backend/app/api/admin.py:76` `_FLAG_HUMAN_NAMES` (6 kill switches)
- `api/me_preferences.py`
- `services/entitlement_service.py` (`tier_capabilities`)

| ID | Group (fields) | Status | Audience | Doc page |
|---|---|---|---|---|
| E1 | LLM providers and keys: `providers`, `active_provider`, `llm_api_key`, `llm_base_url` | shipped | operator | `administer/settings/ai-model` |
| E2 | Default model and allowed models: `llm_model`, `available_models` | shipped | operator | same |
| E3 | Context and output limits: `context_window_max_tokens`, `llm_max_output_tokens`, `sub_agent_model`, `sub_agent_max_output_tokens` | shipped | operator | same |
| E4 | Model roles: `skill_builder_model`, `harness_judge_model`, `extraction_model` | shipped | operator | same |
| E5 | OpenRouter tool strategy: `openrouter_tool_strategy` | shipped | operator | `administer/models/providers#openrouter` |
| E6 | Embeddings: `embedding_provider`, `embedding_model`, `embedding_dimensions`, `embedding_api_key`, `embedding_base_url` (changing dims re-embeds everything) | shipped | operator | `administer/settings/search` |
| E7 | Reranking: `rerank_enabled`, `rerank_provider` (api=Cohere / local), `rerank_api_key`, `rerank_model`, `rerank_top_n` | shipped | operator | same |
| E8 | Retrieval and hybrid search: `retrieval_top_k`, `retrieval_match_threshold`, `hybrid_search_enabled`, `hybrid_candidate_count`, `vector_search_weight`, `keyword_search_weight`, `rrf_k`, `hnsw_ef_search`, `hnsw_iterative_scan` | shipped | operator | same |
| E9 | Extraction engines: `extraction_text_engine_pdf/_docx`, `extraction_table_engine_pdf`, `extraction_image_engine_pdf/_docx`, `extraction_equation_engine`, `extraction_per_call_hints_enabled`, `extraction_window_cap`, `extraction_provider` | shipped | operator | same |
| E10 | Images, scans, drawings: `vision_model`, `vision_max_pages`, `multimodal_max_vision_calls`, `multimodal_max_b64_bytes_kb` | shipped | operator | same |
| E11 | Metadata enrichment and confidence: `metadata_enrichment_mode`, `confidence_bucket_high/_medium` | shipped | operator | `use/library/document-detail#confidence` |
| E12 | Web search: `web_search_enabled`, `web_search_max_results`, `tavily_api_key` | shipped | operator | `administer/settings/integrations` |
| E13 | Code execution: `sandbox_enabled` | shipped | operator | same |
| E14 | Skills: `self_improve_enabled`, `skill_catalog_max_tokens` | shipped | operator | `automate/skills/overview` |
| E15 | File limits and link lifetimes: `source_max_file_size_mb`, `template_ttl_hours`, `document_download_url_ttl_seconds` | shipped (last one v4.5) | operator | `administer/settings/integrations` |
| E16 | System switches: `workflows_enabled`, `maintenance_mode`, `document_management_enabled`, `model_discovery_filter_enabled`, `setup_complete`, `feature_visibility` | shipped | operator | `administer/control-room/kill-switches` |
| E17 | Streaming internals: `chat_tool_args_progress_emit_boundary_bytes` | shipped (internal, do not document as a knob) | developer | `api/concepts/streaming` (footnote) |
| E18 | Feature visibility (6): `skill_studio`=operators, `model_management`=operators, `workflow_authoring`=everyone, `governance_health`=everyone, `visual_workflow_canvas`=everyone, `live_connectors`=**off** | shipped | operator | `administer/control-room/feature-visibility` |
| E19 | Kill switches (6, `PUT /admin/flags`): web search, code sandbox, self-improvement, workflows, maintenance mode, model discovery filter | shipped | operator | `administer/control-room/kill-switches` |
| E20 | Per-user model default (`/me/preferences`), within the operator's allowed set and lock | shipped | user | `use/choosing-a-model` |
| E21 | Org-level settings tab | shipped | admin | `administer/org/settings` |
| E22 | Plans and tiers (`tier_capabilities`; 403 names the required tier) | shipped (no self-serve billing) | admin/operator | `administer/org/plans-and-tiers` |
| E23 | Per-org retention and rate-limit settings | not built → SEED-345 (`planted`), Phase 275 | admin | `administer/org/retention` |

**Count: 23 groups covering all 65 fields**, plus 6 feature keys and 6 flags. Field arithmetic: E1-E16 + E17 = 65 (checked).

---

## f. Model providers

**Sources:**
- `backend/app/config.py` `MODEL_CAPABILITIES`: **61 models / 8 providers**, grouped by `.provider`
- `ROUTING_PROVIDERS`, `_SELF_HOSTED_PROVIDERS` (`ollama`, `lmstudio`, `custom`), `API_SURFACES={'responses'}`
- `PROVIDER_CONTEXT_DEFAULTS`; `docs/LOCAL-MODELS.md`

Capabilities are **data**: 12 of 15 `ModelCapability` fields are editable in Control Room → Model Registry (migration 190).

| ID | Provider | Registry models | Notes | Status | Audience | Doc page |
|---|---|---|---|---|---|---|
| F1 | OpenAI | 17 | Chat Completions + Responses API surface | shipped | operator | `administer/models/providers` |
| F2 | Anthropic | 7 | native SDK | shipped | operator | same |
| F3 | Google (Gemini) | 7 | native Gen AI SDK | shipped | operator | same |
| F4 | DeepSeek | 2 | strict JSON schema inert | shipped | operator | same |
| F5 | Zhipu / GLM | 8 | | shipped | operator | same |
| F6 | MiniMax | 8 | | shipped | operator | same |
| F7 | Moonshot / Kimi | 3 | `emit_tier: coerce` | shipped | operator | same |
| F8 | OpenRouter | 9 | non-native tool path; experimental | shipped | operator | same |
| F9 | Ollama (self-hosted) | n/a | base URL + optional key | shipped | operator | `deploy/local-models` |
| F10 | LM Studio (self-hosted) | n/a | exact slug required | shipped | operator | same |
| F11 | Custom OpenAI-compatible endpoint | n/a | `custom` | shipped | operator | same |
| F12 | Embeddings providers (OpenAI or local, e.g. Qwen3 via LM Studio) | n/a | dims switch deletes vectors | shipped | operator | `administer/settings/search` |
| F13 | Reranker (Cohere API or local sentence-transformers) | n/a | | shipped | operator | same |
| F14 | Web search (Tavily) | n/a | | shipped | operator | `use/web-search` |
| F15 | Model Registry: add by id, discovery, per-model capability edits, lock | n/a | | shipped | operator | `administer/control-room/model-registry` |
| F16 | Observability: LangSmith tracing (`LANGSMITH_API_KEY`) | n/a | | shipped | operator | `deploy/observability` |

**Count: 16.** Per-org BYO provider keys: not built → SEED-120 (`open`).

---

## g. Extension mechanisms

**Sources:** `docs/EXTENSION-CONTRACT.md` §3-§4; `docs/extensions/README.md` (+ `skill-package-example/SKILL.md`, `workflow-definition-example.json`, `mcp-server-example.md`, `sandbox-transform-example.py`).

| ID | Mechanism | Status | Audience | Doc page |
|---|---|---|---|---|
| G1 | Skills as data (SKILL.md package, files, import/export) | shipped | developer | `extend/skill-packages` |
| G2 | Workflows as data (definition JSON, validate/publish) | shipped | developer | `extend/workflows-as-data` |
| G3 | Templates and schemas (DOCX templates, metadata fields, JSON schemas) | shipped | developer | `extend/templates-and-schemas` |
| G4 | Experts as data bundles (skills, scope, tiles, grants) | shipped | developer | `extend/expert-bundles` |
| G5 | External process: MCP servers | shipped | developer | `extend/mcp-servers` |
| G6 | Sandboxed code: Docker compute (`execute_code`, sandbox image) | shipped | developer | `extend/sandbox-compute` |
| G7 | Refusal 1: no third-party executors, emitters or validators | policy | developer | `extend/extension-contract#refusals` |
| G8 | Refusal 2: no generic HTTP egress node | policy | developer | same |
| G9 | Refusal 3: no branching/looping graphs as plugins | policy | developer | same |
| G10 | Mechanical enforcement (closed-registry tests) | shipped | developer | `extend/extension-contract` |

**Count: 10.** Packs and plugins sold to clients are not built (SEED-291..294; operator blockers on legal entity).

---

## h. HTTP API

### h.1 How Swagger is exposed

| Fact | Evidence |
|---|---|
| FastAPI defaults: **`/docs`** (Swagger UI), **`/redoc`**, **`/openapi.json`**. Title `Agentic RAG API`, version `1.0.0`, no `servers` block. | `backend/app/main.py:752` (no `docs_url` override) |
| `/openapi.json` is replaced by `build_canvas_aware_openapi(app)`. When `visual_workflow_canvas` is `off`, canvas-gated paths and models are filtered per request; when on, the full document is served. | `main.py:769`; `middleware/canvas_gate.py:356` |
| `/docs` returns 200 in both flag states (static shell) | `main.py:765` comment |
| Anonymous once the box is finalized. Before `/setup/finalize`, `SetupMiddleware` allows only `/health`, `/public-config`, `/setup/*`, so `/docs` is blocked. During `maintenance_mode`, only `/auth*` and `/admin*` pass. | `middleware/setup.py:31-33`; `middleware/maintenance.py:45` |
| One security scheme: `HTTPBearer`. **265** ops declare it, 3 declare it twice, **14** declare none (`/health`, `/models`, `/public-config`, 8 `/setup/*` that use the `X-Setup-Token` header instead, 2 OAuth callbacks, `/org/sso/route`). | snapshot analysis |
| CORS `allow_origins` = the `FRONTEND_URL` list, so a browser on another origin is refused. Server-to-server calls are unaffected. | `main.py:826` |
| `test_fixtures` router (`/__test__/inject-failed-run`) is mounted only with `ENABLE_TEST_FIXTURES=1` and refuses to start in production. **Not in the snapshot.** | `main.py:921-929` |

### h.2 How a third party authenticates today

**Only with a Supabase user JWT.** No API keys, personal access tokens, service accounts or OAuth-client credentials for Syrel's own API exist.

- `backend/app/dependencies.py:21` `bearer_scheme = HTTPBearer()`.
- `get_current_user` (`:300`) validates every token with `supabase.auth.get_user(token)` (GoTrue) and then applies a ban check. Operator routes use `authenticate_operator_request` (`:453`) and fold every failure into 404. Canvas routes use `authenticate_canvas_request` (`:696`). Org scoping uses an `X-Org-Id` header that is validated against `org_members` (`get_active_org_id`, `:899`).
- Nothing else exists. `grep APIKeyHeader|x-api-key|personal_access|api_tokens` over `app/api`, `app/dependencies.py` and `app/middleware` returns **0** hits. The only non-JWT credential is `X-Setup-Token` (`api/setup.py:160`), a one-time pre-auth wizard token that is refused after finalize.
- **In practice:** a script can sign in as a real user against Supabase Auth (the anon key and URL come from public `GET /public-config`), then send `Authorization: Bearer <access_token>` plus `X-Org-Id`. That is user impersonation with ~1 h tokens and refresh handling. It is not a supported integration path, and the docs must say so.
- **Planned answer: SEED-013** *"External Integrations: public API, MCP server, webhooks, service accounts"*, `status: planted`, `priority: high`. It is the "Open Platform" milestone that `docs/CONNECTOR-ARCHITECTURE.md` (D-v3.6-01) sequences connector breadth behind. Related: SEED-014 (automations, `planted`), SEED-345 (per-org rate limits, `planted`), SEED-120 (BYO provider keys, `open`).

### h.3 Routers → prefix, tag, ops, auth, audience

**Sources:**
- `backend/app/api/*.py`: `APIRouter(prefix, tags)` and `Depends(...)` greps
- `main.py:862-903`: include order
- Op counts: `docs/public/api/openapi.snapshot.json` (**231 paths / 282 operations / 216 schemas / 41 tag groups**)

Auth codes:
- `JWT` = `get_current_user`
- `ORG` = also `X-Org-Id` with `require_org_manage`/`invite`/`sso` on writes
- `OP` = operator, 404 when denied
- `VIS(x)` = `require_visible(x)`, 403 when hidden
- `CANVAS` = `require_canvas`, 404 when the canvas is off
- `SETUP` = `X-Setup-Token`
- `PUB` = none

| ID | Tag | Router file | Prefix(es) | Ops | Auth | Audience | API ref | Notes |
|---|---|---|---|---|---|---|---|---|
| H1 | threads | `threads.py` | `/threads` | 14 | JWT, ORG (1) | user | public | Core: create thread, `POST /messages` (SSE), workflow runs start here |
| H2 | runs | `runs.py` | `/runs` | 4 | JWT | user | public | stream (`?since=` replay), cancel, continue, ask-user response |
| H3 | panel | `panel.py` | `/threads/{id}/…` | 3 | JWT | user | public | todos, tasks, pending ask_user |
| H4 | workspace | `workspace.py` | `/threads/{id}/workspace` | 7 | JWT, ORG | user | public | files, versions, diff, raw, attach-from-connection |
| H5 | sandbox-outputs | `sandbox_outputs.py` | `/sandbox-outputs` | 1 | JWT | user | public | |
| H6 | documents | `documents.py` + `document_queries.py` | `/documents` | 18 | JWT (RLS) | user | public | upload, list, content, chunks, tables, images, versions, metadata, move, reingest; `download-url` = v4.5 |
| H7 | takeoff | `takeoff.py` | `/documents/{id}/takeoff` | 3 | JWT | user | public | CAD takeoff / BOQ |
| H8 | document-search | `document_search.py` | `/document-search` | 1 | JWT | user | public (v4.5) | not on prod |
| H9 | document-views | `document_views.py` | `/document-views` | 6 | JWT | user | public | |
| H10 | document-relationships | `document_relationships.py` | `/document-relationships` | 3 | JWT | user | public | |
| H11 | document-governance | `document_governance.py` | `/document-governance` | 3 | JWT, VIS(governance_health) | user | public | |
| H12 | metadata-fields | `metadata_fields.py` | `/metadata-fields` | 4 | JWT | user | public | |
| H13 | classification-rules | `classification_rules.py` | `/classification-rules` | 4 | JWT | user | public | "Filing rules" in UI (v4.5) |
| H14 | folders | `folders.py` | `/folders` | 7 | JWT | user | public | toggle-global = shared scope |
| H15 | kb | `kb.py` | `/kb` | 5 | JWT | developer | public | ls/tree/grep/glob/read. **No frontend caller**; a pure developer API |
| H16 | library | `library.py` | `/library` | 1 | JWT, VIS(model_management) | admin | flag (UI-shaped) | |
| H17 | knowledge-health | `knowledge_health.py` | `/knowledge-health` | 8 | JWT | user | flag (legacy) | its page was retired (217.1-14); one remaining client in `lib/api/knowledge.ts` |
| H18 | checked-queries | `checked_queries.py` | `/checked-queries` | 6 | JWT | user | public | |
| H19 | sources | `sources.py` | `/sources` **and** `/api/sources` | 18 (9 unique) | JWT | user | public; **hide the `/api` alias** | folder watches, sync, purge, health |
| H20 | connectors | `connectors.py` | `/connectors` | 21 | JWT, ORG writes, VIS(live_connectors) on 9 | user/admin | public; **hide 2 OAuth callbacks** | |
| H21 | skills | `skills.py` | `/skills` | 12 | JWT | user | public | import/export SKILL packages |
| H22 | skill-evals | `evals.py` | `/skills/{id}/evals`, `/proposals`, `/description-proposals` | 17 | JWT, VIS(skill_studio) | operator | public (gated) | |
| H23 | skill-test-cases | `skill_test_cases.py` | `/skills/{id}/test-cases`, `/test-cases`, `/versions` | 5 | JWT, VIS(skill_studio) | operator | public (gated) | |
| H24 | skill-tuner | `skill_tuner.py` | `/skills/{id}/tuner` | 6 | JWT, VIS(skill_studio) | operator | public (gated) | SSE stream |
| H25 | evals | `evals.py` (`router_evals`) | `/evals` | 3 | JWT, operator check | operator | **internal** | engine sweep and health |
| H26 | workflows | `workflows.py` | `/workflows` | 15 | JWT, VIS(workflow_authoring), CANVAS (9) | user | public; flag `grounding-bundle`, `validate` as builder-internal | `If-Match` on update |
| H27 | schedules | `schedules.py` | `/schedules`, `/workflows/{id}/schedules` | 6 | JWT, VIS(workflow_authoring) | user | public | |
| H28 | workflow-runs | `workflow_runs.py` | `/workflow-runs` | 3 | CANVAS | user | public | |
| H29 | experts | `experts.py` | `/experts` | 13 | JWT, ORG | user/admin | public | draft (AI), install, grants, resolve |
| H30 | feedback | `feedback.py` | `/feedback` | 2 | JWT | user | public | |
| H31 | settings | `settings.py` | `/settings` | 5 | JWT, VIS(model_management) on writes | operator | public (gated) | re-embed |
| H32 | preferences | `me_preferences.py` | `/me/preferences` | 2 | JWT | user | public | |
| H33 | model-registry | `model_registry.py` | `/models/registry` | 1 | JWT | user | public | author-safe projection |
| H34 | features | `features.py` | `/features` | 1 | JWT | user | public | effective feature map |
| H35 | audit | `audit.py` | `/audit-logs` | 2 | JWT (own rows) | user | public | CSV export |
| H36 | org | `org.py` | `/org` | 14 | JWT, ORG (manage/invite/sso); `/org/sso/route` PUB | admin | public | members, invitations, SSO |
| H37 | admin (+ admin-spend) | `admin.py`, `admin_spend.py` | `/admin` | 27 (4 spend) | OP (404) | operator | **separate operator reference**; hide `control-plane/record`, `backpressure` | |
| H38 | setup / setup-public | `setup.py` | `/setup`, `/public-config` | 8 + 1 | SETUP / PUB | operator | **document in Deploy, hide from API ref** | refused after finalize |
| H39 | (untagged) | `main.py:835,851` | `/health`, `/models` | 2 | PUB | developer | public | health = maintenance flag; models = available list |
| H40 | test fixtures | `test_fixtures.py` | `/__test__` | (not mounted) | env-gated | n/a | **never publish** | |

**Count: 40 router groups** (39 in the snapshot + test fixtures). **282 ops** in the snapshot, of which 9 are `/api/sources` duplicates, giving **273 unique**.

**Internal / hide-or-flag set (38 ops = 29 distinct + 9 alias duplicates):**
- `/setup/*` (8) and `/public-config` (1): Deploy docs only
- `/connectors/oauth/callback` and `/connectors/mcp/oauth/callback` (2): browser redirect legs
- `/admin/control-plane/record`, `/admin/backpressure` (2)
- `/evals/*` (3)
- `/workflows/grounding-bundle`, `/workflows/validate` (2): builder internals, mark "UI-internal"
- `/threads/{id}/snapshot`, `/threads/expert-scope-preview` (2): UI reconnect and preview
- `/library/index-summary` (1)
- `/knowledge-health/*` (8): legacy, flag rather than hide
- the `/api/sources` alias (9 duplicates)

### h.4 Cross-cutting API concepts found in code

| ID | Concept | Evidence | Status | Doc page |
|---|---|---|---|---|
| H41 | Auth: Supabase JWT + `X-Org-Id` | `dependencies.py:300,899` | shipped | `api/concepts/authentication` |
| H42 | Orgs, RLS, shared scope (global folders/skills) | CLAUDE.md rule; `get_user_supabase_client` | shipped | `api/concepts/orgs-and-rls` |
| H43 | Streaming: SSE on `POST /threads/{id}/messages`; reconnect via `GET /runs/{id}/stream?since=<redis-id>` (Redis Stream replay) | `api/runs.py:18,92` | shipped | `api/concepts/streaming` |
| H44 | Errors: 401 bad token vs **503 auth unreachable**; 403 banned or tier-denied (names the required tier); **404-not-403** for operator, canvas and cross-org misses; 409 setup finalized; 422 validation | `dependencies.py:345-372`; `entitlement_service.py:7` | shipped | `api/concepts/errors` |
| H45 | Limits: **no HTTP rate limiting**. Per-run token caps (`cap_paused`, circuit breaker); tier entitlements; spend ledger | `services/circuit_breaker.py`; SEED-345 | shipped (rate limits not built → SEED-345) | `api/concepts/limits-and-spend` |
| H46 | Pagination: `limit`/`offset`/`page_size` query params (not uniform) | `grep Query` over `api/*.py` | shipped | `api/concepts/pagination` |
| H47 | Webhooks: **none inbound** (only OAuth callbacks); outbound only via `external_action` | ops list | not built → SEED-013 | `api/concepts/webhooks` |
| H48 | Optimistic concurrency: `If-Match` on workflow update | `workflows.py:1506` | shipped | `api/concepts/errors#conflicts` |
| H49 | Feature gates in the API (403 visible vs 404 canvas/operator) | `dependencies.py:651,741` | shipped | `api/concepts/feature-gates` |

---

## i. Deployment & operations

**Sources:**
- `docs/OPERATOR.md` (headings)
- `docker-compose.prod.yml` services: `frontend`, `backend`, `redis`, `agentic-rag`, volume `setup_data`
- `deploy/onebox.env.example`: **59** vars, list with `grep -oE "^[A-Z_]+="`
- `backend/Dockerfile`, `backend/Dockerfile.sandbox`
- `docs/DEPLOYMENT-*.md`, `docs/LOCAL-MODELS.md`, `docs/SANDBOX-PACKAGES.md`, `supabase/SETUP.md`, `REDIS-SETUP.md`

| ID | Item | Status | Audience | Doc page |
|---|---|---|---|---|
| I1 | Four homes: A managed SaaS, B one-box (canonical), C bring-your-own-cloud, D on-prem/local-GPU | shipped | operator | `deploy/choose-a-home` |
| I2 | One-box: clone, `.env`, bootstrap DB, compose up, open | shipped | operator | `deploy/one-box` |
| I3 | Env var reference (59 vars in `onebox.env.example`) | shipped | operator | `deploy/environment-variables` |
| I4 | Database bootstrap (`supabase/full-schema.sql`, numbered migrations, apply via SQL editor) | shipped | operator | `deploy/database` |
| I5 | Setup wizard (`/setup`, token-gated, 6 steps, finalize lock) | shipped | operator | `deploy/setup-wizard` |
| I6 | Redis (TLS `rediss://` when managed; don't expose) | shipped | operator | `deploy/redis` |
| I7 | Postgres DSN: session pooler `:5432` | shipped | operator | `deploy/database` |
| I8 | `FRONTEND_URL` is a comma-separated origin list (CORS) | shipped | operator | `deploy/environment-variables` |
| I9 | Workers: `WORKER_COUNT=2`, scheduler, ingest worker, watch process | shipped | operator | `deploy/background-processes` |
| I10 | Sandbox image build and tag (`agentic-rag-sandbox:<tag>` = `SANDBOX_IMAGE`); package list | shipped | operator | `deploy/sandbox` |
| I11 | Sandbox mounts the Docker socket: **single-tenant boxes only** | shipped (constraint) | operator | `security/sandbox-isolation` |
| I12 | `SECRETS_ENCRYPTION_KEY` (encrypt at rest) | shipped | operator | `security/secrets` |
| I13 | Invitation email provider (default: logs the link) | shipped | operator | `administer/org/invitations` |
| I14 | Pin known-good models per environment | shipped | operator | `administer/models/providers` |
| I15 | Production subdomain routing (`app.<domain>`, landing on apex) | shipped | operator | `deploy/domains` |
| I16 | Local models (Ollama / LM Studio / custom; GPU) | shipped | operator | `deploy/local-models` |
| I17 | Observability (LangSmith; health endpoint) | shipped | operator | `deploy/observability` |
| I18 | Verification checklist (real box) + Supabase security advisors | shipped | operator | `deploy/verify` |
| I19 | Upgrades and migrations between versions | shipped (process) | operator | `deploy/upgrading` |
| I20 | Hosted SaaS deploy pipeline (Vercel + Coolify) | internal | n/a | **not public**: internal runbook only |

**Count: 20** (19 public + 1 internal).

---

## Totals

| Section | Items | Source of truth |
|---|---|---|
| a. App pages & tabs | 54 | `nav-items.ts`, `App.tsx:129`, tab constants |
| b. Agent tools | 32 | `_TOOL_REGISTRY` (30) + 2 dynamic families |
| c. Workflow engine | 31 | harness registries + `phaseVocabulary.ts` |
| d. Connectors | 26 | `servicesCatalog.ts` + `models/connector.py` + adapters |
| e. Settings & knobs | 23 groups (65 fields, 6 features, 6 flags) | `UserEffectiveSettings` |
| f. Model providers | 16 | `MODEL_CAPABILITIES` (61 models / 8 providers) + self-hosted |
| g. Extension | 10 | `EXTENSION-CONTRACT.md` |
| h. HTTP API | 40 router groups + 9 concepts = 49 | OpenAPI snapshot (282 ops) |
| i. Deploy & ops | 20 | `OPERATOR.md`, compose, onebox env |
| **Total** | **261** | |

## OpenAPI export record

- Command (run from `backend/`, venv, `.env` loaded via `python-dotenv`, **no server started**):
  `./venv/Scripts/python.exe -c "from dotenv import load_dotenv; load_dotenv('.env'); import json; from app.main import app; json.dump(app.openapi(), open('../docs/public/api/openapi.snapshot.json','w'), indent=1)"`
- Result: **success**. 231 paths · 282 operations · 216 component schemas · 41 tag groups · 1 security scheme (`HTTPBearer`).
- Generated with the canvas **on**: `workflow-runs` is present. When it is off, the live `/openapi.json` hides the canvas paths.
- Secret scan of the snapshot: 0 matches for `sk-…`, `eyJ…`, IPv4, `supabase.co` or emails.
- Only noise: a `RequestsDependencyWarning` (urllib3/chardet versions).

## Surfaces with no doc home yet (decisions for the docs phase)

1. **`/kb/*` (5 ops)**: a developer API with no UI. Recommended home: `api/guides/navigate-the-knowledge-base`.
2. **`/knowledge-health/*` (8 ops)**: the UI page was retired. Either document it as legacy or retire the endpoints (that is a code decision, not a docs one).
3. **Third-party access**: there is nothing to document beyond "user JWT only". `api/concepts/authentication` must state it, and `api/roadmap-open-platform` should point at SEED-013.
4. **Locked tabs** (Subscription, Retention, Secrets): one page each saying what exists today and what is coming. Never imply a capability.
5. **`eval_slow_step`** programmatic function: internal test fixture. Name it as internal and do not present it as a step a user can pick.

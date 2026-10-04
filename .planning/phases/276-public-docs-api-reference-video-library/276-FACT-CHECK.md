# Phase 276 — docs content fact-check log (276-04)

**Reviewed:** 2026-10-04 · **Base:** `develop` @ `8d0d2a5b6` (production = v4.4, `82babd8d0`).
**Method (D-04):** every claim on a written page was checked against `docs/history/v*.md` → **Status today**
(or **What shipped** where Status today is silent and the code confirms it), or against the code path named.
Drafted from `docs/history/` + `.planning/research/docs-coverage-inventory.md`; the NotebookLM notebook
(`78d31d07…`) was not queried — no notebook tool was available to this executor, and the plan allows the
history + inventory route. **Verdicts:** `kept` (true as written) · `corrected` (the source or the first
draft said something else; the page says what is true) · `removed` (could not be verified; not on the page).

⚠ `docs/history/README.md` marks every history file DRAFT. Where a history file and the code disagree, the
code wins and the row says so.

## Get started

| Page | Claim | Source | Verdict |
|---|---|---|---|
| get-started/overview | Syrel answers from your documents with citations, runs code in a sandbox, learns skills, runs checked workflows | `docs/history/README.md` intro; v2.0, v2.2, v2.8 Status today | kept |
| get-started/overview | Code runs only when the operator has switched the sandbox on | v2.0 Status today (`SANDBOX_ENABLED`); inventory B14 | kept |
| get-started/overview | Experts are installable bundles of skills, knowledge, connections | v4.3 What shipped; v4.4 Status today (per-org install) | kept |
| get-started/overview | Connections to Google Workspace, Slack, Jira, email, any MCP server, each tool allow/ask/deny | v3.9 Status today (per-tool grants); `frontend/src/landing/facts.ts` `CONNECTOR_CATALOG` | kept |
| get-started/overview | Confidence badge High/Medium/Low; unmarked claim = general knowledge | v2.2 Status today; v3.3 What shipped (inline citations); `ConfidenceBadge.tsx` | kept |
| get-started/overview | Org isolation enforced by the database | v3.4 Status today (membership RLS, user-JWT clients) | kept |
| get-started/overview | KB-reading workflow step must cite or fail | v3.6 Status today (derived grounding) | kept |
| get-started/overview | Outside actions stop for approval; real sending off until an operator turns it on | v3.6 Status today (`live_connectors: off`, approval checkpoints) | kept |
| get-started/overview | Word/PDF downloaded, not previewed in-app | v2.7 Status today ("In-panel preview of Office/PDF files: Still not built"); SEED-338 | kept (required sentence) |
| get-started/overview | Released version is v4.4; v4.5 still being built | `docs/history/README.md` releases table | kept |
| get-started/overview | No API keys, webhooks or rate limits | inventory h.2, H45, H47; SEED-013 | kept (required sentence + link) |
| get-started/quickstart | Upload limit 50 MB | v2.4 Status today (`MAX_FILE_SIZE`) | kept |
| get-started/quickstart | Accepted formats list | `facts.ts` `INGEST_FORMATS` | kept |
| get-started/quickstart | Upload into a folder you own or the top level | `LibraryPage.tsx` `canUploadToFolder` | kept |
| get-started/quickstart | Six stage names, skipped stages struck through, "Ready" | `lib/termMap.ts` `ingest.*`; `IngestionStrip.tsx` header | kept |
| get-started/quickstart | Failed row names the stage; re-ingest from the row | `models/document.py` `ingestion_step`; `DocumentRow.tsx` `onReingest` | kept |
| get-started/quickstart | "Searching knowledge base…" activity line | `lib/toolMeta.ts:350` | kept |
| get-started/quickstart | `[n]` marker hover preview, click pins + highlights References | v3.3 What shipped / Status today (inline citations) | kept |
| get-started/quickstart | Low-confidence answers carry a disclaimer | v2.2 What shipped; `ConfidenceBadge.tsx` (`disclaimer`) | kept |
| get-started/sign-in | Email first → SSO redirect or password field; "Sign in with SSO" link | v3.4 Status today (SAML SSO, identifier-first); `SignInForm.tsx` | kept |
| get-started/sign-in | Password sign-in always remains as fallback | v3.4 What shipped | kept |
| get-started/sign-in | New account = own personal organisation | v3.4 What shipped | kept; first draft's "try Syrel straight away" **removed** (a signup org has no tier — v4.4 Key decisions D-269-P1) |
| get-started/sign-in | Invitation: sign-in/sign-up, already-a-member, expired/revoked copy | `pages/AcceptInvitePage.tsx` | kept |
| get-started/sign-in | Roles Member / Org admin | v3.4 What shipped (invitations) | kept |
| get-started/sign-in | No invitation email until an email provider is configured | inventory I13 | kept |
| get-started/sign-in | Disabled account → "contact your administrator" | `dependencies.py` ban check (403 "This account is disabled — contact your administrator.") | kept |
| get-started/workspaces-and-orgs | Org switcher in the profile menu (bottom of rail) with role badge, theme, sign out | v3.4 What shipped + Status today (`ProfileMenu.tsx`) | kept |
| get-started/workspaces-and-orgs | Org admin area via shield; tabs listed | v3.4 Status today (`OrgAdminShell.tsx`); `NavPanel.tsx` (`canManage` shield) | kept |
| get-started/workspaces-and-orgs | Private / org-shared / built-in scopes; `is_system_global` not user-settable | v3.4 What shipped ("Global became two clear ideas"); v1.0/v2.0 Status today | kept |
| get-started/workspaces-and-orgs | "Share with org" / "Make private" / "Shared with org" labels | `components/ingestion/FolderNode.tsx` | kept |
| get-started/workspaces-and-orgs | Sharing a skill requires a passing eval; owner override recorded | `api/skills.py` `toggle_global` (409 `publish_gate_unmet`, override → `skill_publish_overrides`) | corrected (first draft said a skill can simply be shared) |
| get-started/workspaces-and-orgs | Connections org-wide reads, org-admin writes | `main.py:907` connectors comment; inventory A26 | kept |
| get-started/workspaces-and-orgs | Experts installed per org; copy not readable by other orgs | v4.4 Status today | kept |
| get-started/workspaces-and-orgs | Personal default model within allowed set, lock | v3.4 Status today | kept |
| get-started/navigating-syrel | Seven rail entries and their labels | `lib/nav-items.ts` `NAV_ITEMS` | kept |
| get-started/navigating-syrel | Workflows gated by `workflow_authoring` (everyone by default) | `nav-items.ts`; inventory E18 | kept |
| get-started/navigating-syrel | **Settings is in the rail only for people with `model_management` (operators by default)** | `nav-items.ts` (`feature: "model_management"`); `visibleNavItems` | corrected — the inventory lists Memory/Audit Log as `user` tabs, but the only rail entry to Settings is gated; see SUMMARY finding |
| get-started/navigating-syrel | Org admin shield for admins; Control Room + Spend for operators | `NavPanel.tsx` (`canManage`, `isOperator`) | kept |
| get-started/navigating-syrel | Chat list date grouping + filter; ⌘K / Ctrl+K finder | v3.3 Status today | kept |
| get-started/navigating-syrel | v4.4 has a Classification rail entry; v4.5 moves it into the Library | inventory a. preamble; v3.0 + v4.5 Status today | kept (A17 listed `unreleased`) |
| get-started/navigating-syrel | First draft: open a run's page "from the chat that started it" | memory note: the app has no URL router; not verified | removed |
| get-started/key-concepts | Stateless chat — history stored and sent by Syrel | CLAUDE.md rule; v2.0 Status today (history reconstruction) | kept |
| get-started/key-concepts | Runs survive refresh / tabs | v2.5 Status today (run-backed streaming) | kept |
| get-started/key-concepts | Same-name re-upload → new version | v2.2 Status today | kept |
| get-started/key-concepts | Server controls workflow transitions; model cannot skip/reorder | v2.8 What shipped; v2.8 Status today (harness engine) | kept |
| get-started/key-concepts | Expert adds, never removes a tool | v4.4 Status today ("An Expert only adds tools") | kept |
| get-started/key-concepts | Publishing = gate before a frozen runnable version | `db/workflows.py` (workflows visible to creator + system-global only) | corrected (first draft: "before others can run it") |

## Use — chat

| Page | Claim | Source | Verdict |
|---|---|---|---|
| use/chat | Model picker lists allowed models; unregistered model warning | v4.2 Status today (MODEL-05 block in `MessageInput.tsx`) | kept |
| use/chat | General / Explorer selector; Explorer = KB tools + analysis, prose answers | v1.0 Status today (Explorer mode); v3.1 Status today (two-pill composer) | kept |
| use/chat | Attach a local file; pick a connected file | v4.1 Status today (`useComposerAttachments.ts`); v3.9 Status today (`ConnectedFilePickerModal.tsx`) | kept |
| use/chat | Scope chip in the composer | v4.4 Status today (mid-thread scope) | kept |
| use/chat | Connector chips show active connections | v3.9 Status today (`ActiveConnectorChips.tsx`) | kept |
| use/chat | Invite an Expert from the composer | `MessageInput.tsx` imports `InviteExpertDialog` | kept |
| use/chat | Activity line, tool cards with details, timer + step counter, provider·model | v2.4 / v2.6 / v2.8 / v3.9 Status today (`RunCard.tsx`, `ToolCallPanel.tsx`, `ElapsedTimer`) | kept |
| use/chat | Calm thinking line expanding into a timeline | v4.1 What shipped + Status today (`ThinkingBlock.tsx`) | kept |
| use/chat | Approvals answered in the thread and in the panel | v4.1 Status today (in-thread approvals) | kept |
| use/chat | Suggestions (2-3 pills) | v2.2 Status today | kept |
| use/chat | Thumbs up/down with reasons | v2.3 Status today (`MessageFeedback.tsx`) | kept |
| use/chat | Stop keeps partial answer; stopped survives reload | v2.4 What shipped; v3.5 What shipped ("Response stopped" survives reload) | kept |
| use/chat | Runs survive refresh/tab switch/second tab | v2.5 Status today | kept |
| use/chat | Time limit → "Agent reached time limit" + Resume | v2.5 Status today (`RunCard.tsx`) | kept |
| use/chat | Paused at spending cap keeps composer usable | v4.1 What shipped | kept |
| use/chat | Model fallback notice naming both models | v2.4 Status today; v3.3 What shipped | kept |
| use/chat | Handoff = new chat scoped to another Expert with summary; one active Expert per chat | v4.4 What shipped + Key decisions | kept |
| use/chat | Handoff proven on one provider; summariser can lose instructions on some | v4.4 Status today (Unverified; SEED-327) | kept as a Note |
| use/chat-modes | Deep vs Workflow (`mode: deep \| harness`) | `models/thread.py` `ThreadWorkflowState`; v2.8 Status today | kept |
| use/chat-modes | Workflow mode started from the Workflows page; a run opens a chat | `WorkflowsPage.tsx` / `ChatLayout.tsx` (createThread + sendMessage with `workflow_definition_id`) | kept |
| use/chat-modes | Composer reads "Workflow running — Cancel to switch back"; selector controlled by the workflow | `MessageInput.tsx:564,854` | kept |
| use/chat-modes | Per-step tool limits; checks between steps | v2.8 What shipped | kept |
| use/chat-modes | Continue at step cap, bounded | v2.8 Status today (`/runs/{id}/continue`) | kept |
| use/chat-modes | Panel phase timeline | v2.8 Status today | kept |

## Use — Library

| Page | Claim | Source | Verdict |
|---|---|---|---|
| use/library/documents | Five tabs Documents · Views · Ingestion · Indexing · Health | `LibraryPage.tsx` `TAB_LABELS` | kept |
| use/library/documents | Nested folders; delete removes contents | v1.0 Status today | kept |
| use/library/documents | Share with org / Make private; members can read docs in shared folder | `FolderNode.tsx`; v1.0 Status today (`is_org_shared`) | kept |
| use/library/documents | Upload only into own folders; cloud import beside upload | `LibraryPage.tsx:429,953-971` | kept |
| use/library/documents | Versions: badge, citations name version, older drop out, restore, delete one/all | v2.2 + v2.4 Status today | kept |
| use/library/documents | Re-ingest with current extraction settings | v2.6 What shipped (re-extract on demand) | kept |
| use/library/documents | Detail panel sections | `DocumentDetailPanel.tsx` `PanelSection` titles | kept |
| use/library/documents | Connection-placed document says so | `DocumentDetailPanel.tsx` (TRUST-04 notice) | kept |
| use/library/documents | Find documents \| Ask is v4.5 | v4.5 Status today ("Find documents: Not yet deployed") | kept (A12 `unreleased`) |
| use/library/ingestion | Formats table | `facts.ts` `INGEST_FORMATS`; v3.8 What shipped (CSV/spreadsheet tables, email headers + attachments) | kept |
| use/library/ingestion | Same file twice at once → one document | v2.6 What shipped (duplicate uploads prevented) | kept |
| use/library/ingestion | Import from cloud needs a folder; says when no storage connected | `LibraryCloudImport.tsx` copy | kept |
| use/library/ingestion | Six stages with plain labels | `lib/termMap.ts` | kept |
| use/library/ingestion | Durable queue survives restarts, retries, names failure | v4.0 What shipped + Status today (durable ingestion queue) | kept |
| use/library/ingestion | Preview four groups before first import; nothing written until confirm | v4.0 What shipped; inventory D21 | kept; first draft's "filing rules" → "routing rules" (**corrected**: "Filing rules" is the v4.5 name) |
| use/library/find | Whole page is v4.5 and described as upcoming | v4.5 What shipped + Status today ("Not yet deployed; operator sign-off owed") | kept (`release: v4.5`) |
| use/library/find | Find never calls the AI; one row per document; sorted by a stated field | v4.5 What shipped | kept (future tense) |
| use/library/find | Find searches only documents you can open | `api/document_search.py` (`get_user_supabase_client`, user-JWT RLS) | kept |
| use/library/document-detail | Details with per-field confidence chip; header counts low/empty | v3.0 Status today; `DocumentDetailPanel.tsx` (`lowPlusEmpty`) | kept |
| use/library/document-detail | Human corrections marked, audited, protected from re-extraction | v3.0 Status today (`_source='user'` guard) | kept |
| use/library/document-detail | Confidence thresholds tunable by operator | v2.2/v2.6 Status today (`confidence_bucket_*`); inventory E11 | kept |
| use/library/document-detail | Sections Text, Chunks, Tables, Images, Found by, Conversation, Takeoff | `DocumentDetailPanel.tsx`; image-count notice landed 2026-08-28 (`cfc411b51`, before v4.4) | kept |
| use/library/document-detail | Relationship types, grouped by direction, masked rows, typeahead | v3.0 What shipped + Status today (`RelationshipsSection.tsx`) | kept |
| use/library/document-detail | Classification suggestion: nothing moves until accepted; undo | v3.0 What shipped | kept |
| use/library/document-detail | Download + file facts are v4.5 | v4.5 Status today | kept (A19 `unreleased`) |
| use/library/document-detail | Word/PDF downloaded, not previewed | v2.7 Status today; SEED-338 | kept (required sentence) |

## Automate — workflows

| Page | Claim | Source | Verdict |
|---|---|---|---|
| automate/workflows/overview | Seven step kinds | v2.8 Status today ("now 7"); `phaseVocabulary.ts` `PHASE_TYPE_SENTENCES` | kept |
| automate/workflows/overview | Failed check → bounded retry, jump, or failed run; never loops | v2.8 What shipped | kept |
| automate/workflows/overview | KB-reading step strict; cannot loosen | v3.6 What shipped + Status today | kept |
| automate/workflows/overview | Declared inputs (text, number, date, choice, file) | inventory C28 (`text\|number\|date\|enum\|file\|kb_auto`) | kept (`kb_auto` not described) |
| automate/workflows/overview | Deliverable rendered by fixed code, reopened and checked | v2.9 What shipped; v2.9 Status today (`docxtpl`, `output_file_valid`) | kept |
| automate/workflows/overview | Published workflows frozen; audit trail insert-only | v2.8 What shipped + Status today; `api/workflows.py` (published 409, immutability trigger) | kept |
| automate/workflows/overview | **Workflows are personal: visible to their creator; starters visible to everyone** | `db/workflows.py` `list_published_workflows` (`is_system_global OR created_by`), `full-schema.sql` RLS on `workflow_definitions` | corrected — first draft said publishing lets "anyone else" run it |
| automate/workflows/overview | Runs resume after a restart | v2.8 What shipped ("Survives restarts") | kept |
| automate/workflows/overview | Outside actions always armed; "Not sent — recorded" | v3.6 What shipped + Status today | kept |
| automate/workflows/overview | Spend/time caps stop unattended runs via the cancel path | v3.8 Status today (circuit breaker); v3.7 Status today (stop path) | kept |
| automate/workflows/overview | Tier gates authoring and running; refusal names the plan | v4.3 What shipped + Status today (`require_capability` callers) | kept |
| automate/workflows/overview | Word/PDF downloaded, not previewed | SEED-338 | kept (required sentence) |
| automate/workflows/builder | Chooser copy "How do you want to start?", doors "Draft it for me" / "Build it myself" and their descriptions | `workflows/doorVocabulary.ts` | kept |
| automate/workflows/builder | Draft grounded in folders/tools/skills/template; retries on validation failure | v2.9 What shipped (describe it in plain language) | kept |
| automate/workflows/builder | Copy a starter into a draft | v3.2 What shipped + Status today (Starters shelf) | kept |
| automate/workflows/builder | Canvas add/move/connect/configure/delete; server verdict badges | v3.6 What shipped + Status today | kept |
| automate/workflows/builder | Plain-word step faces, technical names on reveal | `phaseVocabulary.ts` (`PHASE_TYPE_SENTENCES` / `PHASE_TYPE_LABELS`) | kept |
| automate/workflows/builder | Drag autosaves without a new version | v3.6 What shipped | kept |
| automate/workflows/builder | Stale save refused (If-Match) | `api/workflows.py:1506` (`If-Match`, `stale_token` 409) | corrected — v3.6 wording "two people edit the same shared workflow" cannot happen (workflows are creator-only); the page says "for example in another tab" |
| automate/workflows/builder | Canvas on for everyone; operator can switch off | v3.6 Status today (default flipped to everyone) | kept |
| automate/workflows/builder | Project folder binding fixed at run start | v2.9 Status today (project binding + server-side scope) | kept |
| automate/workflows/builder | Skill version frozen into published workflow | v2.9 What shipped + Status today (`skill_snapshot.py`) | kept |
| automate/workflows/builder | Model chosen from the registry | v3.7 Status today | kept |
| automate/workflows/builder | Reach-outside: service → action, args from input/fixed/earlier step; publish refuses unsupplied required args | v3.9 What shipped; v3.6 Status today (`arg_sources`) | kept |
| automate/workflows/builder | Template bound at authoring time, filled every run | v3.7 What shipped | kept |
| automate/workflows/publish | **Ten stages** and their meanings | `PublishGauntlet.tsx:196-207` `STAGES`; `facts.ts` `GAUNTLET_STAGES` (10) | corrected — inventory A23/C30 and the IA say "8 stages"; v2.9 history itself notes 10 today |
| automate/workflows/publish | Worded verdict, raw detail on demand | v3.1 What shipped (pip strip, worded verdict) | kept |
| automate/workflows/publish | Golden run is real; human-input auto-continues with first choice | v2.9 Status today; v3.7 Status today (`human_input.py` `is_golden_run`) | kept |
| automate/workflows/publish | Judge = independent model graded against the requirement; operator picks the judge model | v2.9 What shipped; inventory E4 (`harness_judge_model`) | kept |
| automate/workflows/publish | Published version cannot be edited | `api/workflows.py` (published-row 409 + immutability trigger) | kept; first draft's "editing works on a new draft" **removed** (not verified) |
| automate/workflows/publish | Word/PDF downloaded, not previewed | SEED-338 | kept (required sentence) |

## Changelog corrections (`docs/public/changelog/overrides.json`)

| Version | Correction | Source | Verdict |
|---|---|---|---|
| v1.0 | Global folders → org sharing (v3.4); thread scope changeable (v4.4) | v1.0 Status today | kept |
| v2.0 | Global skills → org sharing (v3.4); skills versioned (v3.2) | v2.0 Status today | kept |
| v2.3 | Library Health page → Library Health tab (v3.9) | v2.3 Status today | kept; "feedback stats not shown" **removed** (history marks it Unverified) |
| v2.9 | 10 stages, not 8; read-only graph → canvas (v3.6) | v2.9 Status today + What shipped note | kept |
| v3.0 | Global sharing of views/rules/fields → platform-seeded only; governance page folded into Health | v3.0 Status today | kept |
| v3.6 | Canvas on for everyone since v3.9 | v3.6 Status today | kept |
| v4.0 | Watch loop ships switched off | v4.0 Status today (`watch_process_enabled: False`); `config.py:1412` | kept |
| v4.3 | Restricted Expert no longer removes tools; knowledge copied per org | v4.3 Status today | kept |

## Stubs (Task 1) — spot checks of facts introduced in rewritten summaries

| Page | Claim | Source | Verdict |
|---|---|---|---|
| connect/folder-watches | Watch process off by default | `config.py:1412`; v4.0 Status today | kept |
| automate/workflows/schedules | Scheduler process off by default | `config.py:1359`; `deploy/onebox.env.example:74` | kept |
| connect/microsoft-365 | No Microsoft chat tools; SharePoint not available | inventory D2; v4.0 Status today (SEED-256 deferred) | kept (inventory's "SharePoint" corrected) |
| connect/custom-mcp, extend/mcp-servers | MCP server must use HTTPS at a public address | `security/egress.py` `validate_mcp_destination` (scheme must be https; private/loopback/metadata refused) | kept |
| use/library/filing-rules | Rules ship today (Classification page); the move to Library is v4.5 | v3.0 + v4.5 Status today | corrected — the mechanical rule would have marked the whole page v4.5 |
| use/library/takeoff | Began as a v3.9 spike | v3.9 What shipped + Status today ("spike code") | kept |
| use/memory | Settings rail entry gated by model management | `nav-items.ts` | corrected (see navigating-syrel) |
| administer/control-room/kill-switches | Six flags | inventory E19; `api/admin.py` `_FLAG_HUMAN_NAMES` | kept |
| administer/models/providers | Eight providers | `facts.ts` `MODEL_PROVIDERS` | kept |
| deploy/setup-wizard | Six steps incl. "preset"; no preset count stated | inventory A53 | kept (no "three presets") |
| api/concepts/webhooks, limits-and-spend, roadmap-open-platform | Not available today; SEED-013 / SEED-345 | inventory h.2, H45, H47 | kept |
